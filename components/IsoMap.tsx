/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useRef, useEffect, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useThree, ThreeElements } from '@react-three/fiber';
import { MapControls, Environment, SoftShadows, Instance, Instances, Float, useTexture, Outlines, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { MathUtils, Texture } from 'three';
import { Grid, BuildingType, TileData, PlayerState, Emergency, EmergencyType } from '../types';
import { GRID_SIZE, BUILDINGS, EMERGENCIES } from '../constants';

// Fix for TypeScript not recognizing R3F elements in JSX
declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

// --- Constants & Helpers ---
const WORLD_OFFSET = GRID_SIZE / 2 - 0.5;
const gridToWorld = (x: number, y: number) => [x - WORLD_OFFSET, 0, y - WORLD_OFFSET] as [number, number, number];

// Deterministic random based on coordinates
const getHash = (x: number, y: number) => Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
const getRandomRange = (min: number, max: number) => Math.random() * (max - min) + min;

// Shared Geometries
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
const coneGeo = new THREE.ConeGeometry(1, 1, 4);
const sphereGeo = new THREE.SphereGeometry(1, 8, 8);

// --- 1. Advanced Procedural Buildings ---

// FIX: Wrap component in React.memo to ensure TypeScript recognizes it as a component that accepts a 'key' prop.
const WindowBlock = React.memo(({ position, scale, color = "#00f2ff" }: { position: [number, number, number], scale: [number, number, number], color?: string }) => (
  <mesh geometry={boxGeo} position={position} scale={scale}>
    <meshPhysicalMaterial 
      color={color} 
      emissive={color} 
      emissiveIntensity={0.8} 
      roughness={0.1} 
      metalness={0.9} 
      transparent 
      opacity={0.6}
      transmission={0.5}
      thickness={0.1}
    />
  </mesh>
));

const BlinkingSign = ({ position, color }: { position: [number, number, number], color: string }) => {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      const material = ref.current.material as THREE.MeshStandardMaterial;
      const blink = Math.sin(state.clock.elapsedTime * 4) > 0;
      material.emissiveIntensity = blink ? 2 : 0.2;
    }
  });

  return (
    <mesh ref={ref} geometry={boxGeo} position={position} scale={[0.4, 0.2, 0.05]}>
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={0.9} />
    </mesh>
  );
};

const Scaffolding = ({ scale }: { scale: [number, number, number] }) => (
  <group scale={scale}>
    <mesh geometry={boxGeo}>
      <meshStandardMaterial color="#fbbf24" wireframe />
    </mesh>
    <mesh geometry={boxGeo} scale={[0.95, 0.95, 0.95]}>
      <meshStandardMaterial color="#fbbf24" transparent opacity={0.3} />
    </mesh>
  </group>
);

const SmokeStack = ({ position, active = true }: { position: [number, number, number], active?: boolean }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current && active) {
      ref.current.children.forEach((child, i) => {
        const cloud = child as THREE.Mesh;
        cloud.position.y += 0.01 + i * 0.005;
        cloud.scale.addScalar(0.005);
        
        const material = cloud.material as THREE.MeshStandardMaterial;
        if (material) {
          material.opacity -= 0.005;
          if (cloud.position.y > 1.5) {
            cloud.position.y = 0;
            cloud.scale.setScalar(0.1 + Math.random() * 0.1);
            material.opacity = 0.6;
          }
        }
      });
    } else if (ref.current) {
      // Hide smoke if inactive
      ref.current.children.forEach(child => {
        (child as THREE.Mesh).scale.setScalar(0);
      });
    }
  });

  return (
    <group position={position}>
      <mesh geometry={cylinderGeo} castShadow receiveShadow position={[0, 0.5, 0]} scale={[0.2, 1, 0.2]}>
        <meshStandardMaterial color="#4b5563" />
      </mesh>
      <group ref={ref} position={[0, 1, 0]}>
        {[0, 1, 2].map(i => (
          <mesh key={i} geometry={sphereGeo} position={[Math.random()*0.1, i*0.4, Math.random()*0.1]} scale={0.2}>
            <meshStandardMaterial color="#d1d5db" transparent opacity={0.6} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  );
};

interface BuildingMeshProps {
  type: BuildingType;
  baseColor: string;
  x: number;
  y: number;
  textures: Record<string, THREE.Texture>;
  opacity?: number;
  transparent?: boolean;
  constructionProgress?: number;
  condition?: number;
}

const ProceduralBuilding = React.memo(({ type, baseColor, x, y, textures, opacity = 1, transparent = false, constructionProgress = 100, condition = 100 }: BuildingMeshProps) => {
  console.log(`Rendering ProceduralBuilding at ${x},${y} type ${type}`);
  const hash = getHash(x, y);
  const variant = Math.floor(hash * 100); // 0-99
  const rotation = Math.floor(hash * 4) * (Math.PI / 2);
  
  const isUnderConstruction = constructionProgress < 100;
  const isBroken = condition <= 0;
  const isDegraded = condition < 50;

  // Color variation
  const color = useMemo(() => {
    const c = new THREE.Color(baseColor);
    c.offsetHSL(hash * 0.1 - 0.05, 0, hash * 0.2 - 0.1);
    if (isBroken) c.multiplyScalar(0.3);
    else if (isDegraded) c.multiplyScalar(0.7);
    return c;
  }, [baseColor, hash, isBroken, isDegraded]);

  const neonBlue = "#00f2ff";
  const electricPurple = "#bc13fe";
  const accentColor = hash > 0.5 ? neonBlue : electricPurple;

  const mainMat = useMemo(() => {
    let map = textures.concrete;
    let roughness = 0.6;
    let metalness = 0.4;
    
    if (type === BuildingType.Residential) {
      map = textures.brick;
      roughness = 0.8;
      metalness = 0.1;
    }
    if (type === BuildingType.Commercial) {
      map = textures.stone;
      roughness = 0.2;
      metalness = 0.8;
    }
    
    return new THREE.MeshStandardMaterial({ 
      color, 
      map: map,
      roughness, 
      metalness,
      opacity, 
      transparent,
      flatShading: false 
    });
  }, [color, opacity, transparent, type, textures]);

  const accentMat = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: new THREE.Color(color).multiplyScalar(0.7), 
    roughness: 0.3,
    metalness: 0.7,
    opacity, 
    transparent 
  }), [color, opacity, transparent]);

  const roofMat = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: new THREE.Color(color).multiplyScalar(0.5).offsetHSL(0,0,-0.1), 
    roughness: 0.8,
    metalness: 0.2,
    opacity, 
    transparent 
  }), [color, opacity, transparent]);

  const neonMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: isBroken ? 0 : 2,
    transparent: true,
    opacity: isBroken ? 0.2 : 0.9
  }), [accentColor, isBroken]);

  const commonProps = { castShadow: true, receiveShadow: true };
  const yOffset = -0.3;

  if (isUnderConstruction) {
    const scaleY = 0.2 + (constructionProgress / 100) * 0.8;
    return (
      <group position={[0, yOffset, 0]}>
        <Scaffolding scale={[0.9, scaleY, 0.9]} />
      </group>
    );
  }

  return (
    <group rotation={[0, rotation, 0]} position={[0, yOffset, 0]}>
      {(() => {
        switch (type) {
          case BuildingType.Residential:
            if (variant < 25) {
              // Cozy Cottage
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.3, 0]} scale={[0.7, 0.6, 0.6]} />
                  <mesh {...commonProps} material={roofMat} geometry={coneGeo} position={[0, 0.75, 0]} scale={[0.6, 0.4, 0.6]} rotation={[0, Math.PI/4, 0]} />
                  <WindowBlock position={[0.2, 0.3, 0.31]} scale={[0.15, 0.2, 0.05]} color={isBroken ? "#222" : undefined} />
                  <WindowBlock position={[-0.2, 0.3, 0.31]} scale={[0.15, 0.2, 0.05]} color={isBroken ? "#222" : undefined} />
                  <mesh {...commonProps} material={neonMat} geometry={boxGeo} position={[0, 0.05, 0.31]} scale={[0.4, 0.02, 0.02]} />
                </>
              );
            } else if (variant < 50) {
              // Modern Boxy
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[-0.1, 0.35, 0]} scale={[0.6, 0.7, 0.8]} />
                  <mesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0.25, 0.25, 0.1]} scale={[0.4, 0.5, 0.6]} />
                  <WindowBlock position={[-0.1, 0.5, 0.41]} scale={[0.4, 0.2, 0.05]} color={isBroken ? "#222" : undefined} />
                  <mesh {...commonProps} material={neonMat} geometry={boxGeo} position={[0.25, 0.5, 0.41]} scale={[0.02, 0.4, 0.02]} />
                </>
              );
            } else if (variant < 75) {
              // Townhouse
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.5, 0]} scale={[0.5, 1, 0.6]} />
                  <mesh {...commonProps} material={roofMat} geometry={boxGeo} position={[0, 1.05, 0]} scale={[0.55, 0.1, 0.65]} />
                  <WindowBlock position={[0, 0.7, 0.31]} scale={[0.3, 0.2, 0.05]} color={isBroken ? "#222" : undefined} />
                  <WindowBlock position={[0, 0.3, 0.31]} scale={[0.3, 0.2, 0.05]} color={isBroken ? "#222" : undefined} />
                  <mesh {...commonProps} material={neonMat} geometry={boxGeo} position={[0.26, 0.5, 0]} scale={[0.02, 0.8, 0.02]} />
                </>
              );
            } else {
              // Apartment Block (New)
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.6, 0]} scale={[0.8, 1.2, 0.8]} />
                  {Array.from({ length: 3 }).map((_, i) => (
                    <group key={i} position={[0, 0.3 + i * 0.3, 0]}>
                      <WindowBlock position={[0.2, 0, 0.41]} scale={[0.2, 0.15, 0.02]} color={isBroken ? "#222" : undefined} />
                      <WindowBlock position={[-0.2, 0, 0.41]} scale={[0.2, 0.15, 0.02]} color={isBroken ? "#222" : undefined} />
                    </group>
                  ))}
                  <mesh {...commonProps} material={neonMat} geometry={boxGeo} position={[0, 1.2, 0]} scale={[0.85, 0.05, 0.85]} />
                </>
              );
            }

          case BuildingType.Commercial:
            if (variant < 25) {
              // High-rise
              const height = 2.0 + hash * 2.0;
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, height/2, 0]} scale={[0.7, height, 0.7]} />
                  {Array.from({ length: Math.floor(height * 4) }).map((_, i) => (
                    <WindowBlock key={i} position={[0, 0.2 + i * 0.25, 0]} scale={[0.72, 0.1, 0.72]} color={isBroken ? "#222" : (i % 2 === 0 ? neonBlue : electricPurple)} />
                  ))}
                  <mesh {...commonProps} material={neonMat} geometry={boxGeo} position={[0, height + 0.1, 0]} scale={[0.4, 0.4, 0.4]} />
                  {!isBroken && <BlinkingSign position={[0, height * 0.8, 0.36]} color={accentColor} />}
                </>
              );
            } else if (variant < 50) {
              // Shop
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.4, 0]} scale={[0.9, 0.8, 0.8]} />
                  <WindowBlock position={[0, 0.3, 0.41]} scale={[0.8, 0.4, 0.05]} color={isBroken ? "#222" : undefined} />
                  <mesh {...commonProps} material={neonMat} geometry={boxGeo} position={[0, 0.75, 0.45]} scale={[0.8, 0.05, 0.1]} />
                  {!isBroken && <BlinkingSign position={[0, 0.6, 0.41]} color={accentColor} />}
                </>
              );
            } else if (variant < 75) {
              // Corner store
               return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[-0.2, 0.5, -0.2]} scale={[0.5, 1, 0.5]} />
                  <mesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0.1, 0.3, 0.1]} scale={[0.7, 0.6, 0.7]} />
                  <WindowBlock position={[0.1, 0.3, 0.46]} scale={[0.6, 0.3, 0.05]} color={isBroken ? "#222" : undefined} />
                  <mesh {...commonProps} material={neonMat} geometry={sphereGeo} position={[0.2, 0.7, 0.2]} scale={0.1} />
                  {!isBroken && <BlinkingSign position={[0.1, 0.5, 0.46]} color={accentColor} />}
                </>
               )
            } else {
              // Mall/Plaza (New)
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.25, 0]} scale={[0.95, 0.5, 0.95]} />
                  <mesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0, 0.6, 0]} scale={[0.6, 0.2, 0.6]} />
                  <WindowBlock position={[0, 0.25, 0.48]} scale={[0.8, 0.3, 0.02]} color={isBroken ? "#222" : undefined} />
                  <mesh {...commonProps} material={neonMat} geometry={boxGeo} position={[0, 0.5, 0]} scale={[1.0, 0.02, 1.0]} />
                  {!isBroken && <BlinkingSign position={[0, 0.6, 0.31]} color={accentColor} />}
                </>
              )
            }

          case BuildingType.Industrial:
            if (variant < 33) {
              // Factory
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.4, 0]} scale={[0.9, 0.8, 0.8]} />
                  <mesh {...commonProps} material={roofMat} geometry={boxGeo} position={[-0.2, 0.9, 0]} scale={[0.4, 0.2, 0.8]} rotation={[0,0,Math.PI/4]} />
                  <mesh {...commonProps} material={roofMat} geometry={boxGeo} position={[0.2, 0.9, 0]} scale={[0.4, 0.2, 0.8]} rotation={[0,0,Math.PI/4]} />
                  <SmokeStack position={[0.3, 0.4, 0.3]} active={!isBroken} />
                  <mesh {...commonProps} material={neonMat} geometry={boxGeo} position={[0, 0.1, 0.41]} scale={[0.2, 0.05, 0.02]} />
                </>
              );
            } else if (variant < 66) {
              // Warehouse
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[-0.2, 0.3, 0]} scale={[0.5, 0.6, 0.9]} />
                  <mesh {...commonProps} material={accentMat} geometry={cylinderGeo} position={[0.25, 0.4, -0.2]} scale={[0.2, 0.8, 0.2]} />
                  <mesh {...commonProps} material={accentMat} geometry={cylinderGeo} position={[0.25, 0.4, 0.25]} scale={[0.2, 0.8, 0.2]} />
                  <mesh {...commonProps} material={neonMat} geometry={boxGeo} position={[0.25, 0.85, 0]} scale={[0.05, 0.05, 0.6]} />
                </>
              );
            } else {
              // Power Plant (New)
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={cylinderGeo} position={[0, 0.5, 0]} scale={[0.4, 1, 0.4]} />
                  <mesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0, 0.1, 0]} scale={[0.8, 0.2, 0.8]} />
                  <mesh {...commonProps} material={neonMat} geometry={cylinderGeo} position={[0, 1.0, 0]} scale={[0.42, 0.05, 0.42]} />
                  <SmokeStack position={[0, 1, 0]} active={!isBroken} />
                </>
              )
            }

          case BuildingType.Park:
            const treeCount = 1 + Math.floor(hash * 3);
            const positions = [[-0.2, -0.2], [0.2, 0.2], [-0.2, 0.2], [0.2, -0.2]];
            
            return (
              <group position={[0, -yOffset - 0.29, 0]}>
                <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                    <planeGeometry args={[0.9, 0.9]} />
                    <meshStandardMaterial color="#064e3b" roughness={0.8} />
                </mesh>
                
                {variant < 50 ? (
                    <group position={[0,0.05,0]}>
                        <mesh material={new THREE.MeshStandardMaterial({color: '#1e293b'})} geometry={cylinderGeo} scale={[0.4, 0.1, 0.4]} castShadow receiveShadow />
                        <mesh material={new THREE.MeshStandardMaterial({color: neonBlue, emissive: neonBlue, emissiveIntensity: 1})} geometry={cylinderGeo} position={[0, 0.06, 0]} scale={[0.3, 0.05, 0.3]} />
                    </group>
                ) : (
                    // Zen Garden (New)
                    <group position={[0, 0.05, 0]}>
                        <mesh material={new THREE.MeshStandardMaterial({color: '#334155'})} geometry={boxGeo} scale={[0.6, 0.05, 0.6]} castShadow receiveShadow />
                        <mesh material={neonMat} geometry={boxGeo} position={[0, 0.05, 0]} scale={[0.1, 0.2, 0.1]} />
                    </group>
                )}

                {Array.from({length: treeCount}).map((_, i) => {
                    const pos = positions[i % positions.length];
                    const scale = 0.5 + getHash(x+i, y-i) * 0.5;
                    const treeColor = new THREE.Color("#065f46").offsetHSL(0, 0, getHash(x,y+i)*0.2);
                    return (
                    <group key={i} position={[pos[0], 0, pos[1]]} scale={scale} rotation={[0, getHash(i,x)*Math.PI, 0]}>
                        <mesh castShadow receiveShadow material={new THREE.MeshStandardMaterial({ color: '#451a03' })} geometry={cylinderGeo} position={[0, 0.15, 0]} scale={[0.1, 0.3, 0.1]} />
                        <mesh castShadow receiveShadow material={new THREE.MeshStandardMaterial({ color: treeColor, flatShading: true })} geometry={coneGeo} position={[0, 0.4, 0]} scale={[0.4, 0.5, 0.4]} />
                        <mesh castShadow receiveShadow material={new THREE.MeshStandardMaterial({ color: treeColor, flatShading: true })} geometry={coneGeo} position={[0, 0.65, 0]} scale={[0.3, 0.4, 0.3]} />
                    </group>
                    )
                })}
              </group>
            );
          case BuildingType.Road:
             return null;
          default:
            return null;
        }
      })()}
    </group>
  );
});

// --- 2. Dynamic Systems (Traffic, Citizens, Environment) ---

const carColors = ['#ef4444', '#3b82f6', '#eab308', '#ffffff', '#1f2937', '#f97316'];

const TrafficLight = React.memo(({ x, y, horizontal }: { x: number, y: number, horizontal: boolean }) => {
  const [wx, _, wz] = gridToWorld(x, y);
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.elapsedTime;
    const cycle = Math.floor(time / 4) % 3; // 0: Green, 1: Yellow, 2: Red
    
    // We alternate based on horizontal/vertical
    // If horizontal, we use the cycle directly. If vertical, we offset it.
    const phase = horizontal ? cycle : (cycle + 1.5) % 3;
    
    const isGreen = phase < 1.2;
    const isYellow = phase >= 1.2 && phase < 1.8;
    const isRed = phase >= 1.8;

    groupRef.current.children.forEach((child, i) => {
      if (i === 0) (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: isRed ? '#ff0000' : '#220000', emissive: isRed ? '#ff0000' : '#000000', emissiveIntensity: isRed ? 2 : 0 });
      if (i === 1) (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: isYellow ? '#ffff00' : '#222200', emissive: isYellow ? '#ffff00' : '#000000', emissiveIntensity: isYellow ? 2 : 0 });
      if (i === 2) (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: isGreen ? '#00ff00' : '#002200', emissive: isGreen ? '#00ff00' : '#000000', emissiveIntensity: isGreen ? 2 : 0 });
    });
  });

  return (
    <group position={[wx, -0.3, wz]}>
      {/* Pole */}
      <mesh geometry={cylinderGeo} position={[0.4, 0.4, 0.4]} scale={[0.05, 0.8, 0.05]}>
        <meshStandardMaterial color="#333" />
      </mesh>
      {/* Head */}
      <mesh geometry={boxGeo} position={[0.4, 0.7, 0.4]} scale={[0.15, 0.35, 0.15]}>
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Lights */}
      <group ref={groupRef} position={[0.4, 0.7, 0.4]}>
        <mesh geometry={sphereGeo} position={[0, 0.1, 0.08]} scale={0.04} />
        <mesh geometry={sphereGeo} position={[0, 0, 0.08]} scale={0.04} />
        <mesh geometry={sphereGeo} position={[0, -0.1, 0.08]} scale={0.04} />
      </group>
    </group>
  );
});

const TrafficSystem = ({ grid }: { grid: Grid }) => {
  const roadTiles = useMemo(() => {
    const roads: {x: number, y: number}[] = [];
    grid.forEach(row => row.forEach(tile => {
      if (tile.buildingType === BuildingType.Road) roads.push({x: tile.x, y: tile.y});
    }));
    return roads;
  }, [grid]);

  const buildingCount = useMemo(() => 
    grid.flat().filter(t => t.buildingType !== BuildingType.None && t.buildingType !== BuildingType.Road).length, 
  [grid]);

  const carCount = useMemo(() => Math.min(3 + buildingCount * 2, 60), [buildingCount]);
  const carsRef = useRef<THREE.InstancedMesh>(null);
  const carsState = useRef<Float32Array>(new Float32Array(0)); 
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (roadTiles.length < 2) return;
    carsState.current = new Float32Array(carCount * 6);
    const newColors = new Float32Array(carCount * 3);

    for (let i = 0; i < carCount; i++) {
      const startNode = roadTiles[Math.floor(Math.random() * roadTiles.length)];
      carsState.current[i*6 + 0] = startNode.x;
      carsState.current[i*6 + 1] = startNode.y;
      carsState.current[i*6 + 2] = startNode.x;
      carsState.current[i*6 + 3] = startNode.y;
      carsState.current[i*6 + 4] = 1; // force pick new target
      carsState.current[i*6 + 5] = getRandomRange(0.015, 0.035); // speed

      const color = new THREE.Color(carColors[Math.floor(Math.random() * carColors.length)]);
      newColors[i*3] = color.r; newColors[i*3+1] = color.g; newColors[i*3+2] = color.b;
    }

    if (carsRef.current) {
        carsRef.current.instanceColor = new THREE.InstancedBufferAttribute(newColors, 3);
    }
  }, [roadTiles, carCount]);

  useFrame((state) => {
    if (!carsRef.current || roadTiles.length < 2 || carsState.current.length === 0) return;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < carCount; i++) {
      const idx = i * 6;
      let curX = carsState.current[idx];
      let curY = carsState.current[idx+1];
      let tarX = carsState.current[idx+2];
      let tarY = carsState.current[idx+3];
      let progress = carsState.current[idx+4];
      const speed = carsState.current[idx+5];

      // Traffic Light Logic
      const dx = tarX - curX;
      const dy = tarY - curY;
      const isHorizontal = Math.abs(dx) > 0.5;
      
      // Check if entering an intersection
      let roadNeighbors = 0;
      if (tarX > 0 && grid[tarY][tarX-1].buildingType === BuildingType.Road) roadNeighbors++;
      if (tarX < GRID_SIZE - 1 && grid[tarY][tarX+1].buildingType === BuildingType.Road) roadNeighbors++;
      if (tarY > 0 && grid[tarY-1][tarX].buildingType === BuildingType.Road) roadNeighbors++;
      if (tarY < GRID_SIZE - 1 && grid[tarY+1][tarX].buildingType === BuildingType.Road) roadNeighbors++;
      const isIntersection = roadNeighbors >= 3;

      let canMove = true;
      if (isIntersection && progress > 0.7 && progress < 0.9) {
        const cycle = Math.floor(time / 4) % 3;
        const phase = isHorizontal ? cycle : (cycle + 1.5) % 3;
        const isRed = phase >= 1.8;
        const isYellow = phase >= 1.2 && phase < 1.8;
        
        if (isRed || isYellow) {
          canMove = false;
        }
      }

      if (canMove) {
        progress += speed;
      }

      if (progress >= 1) {
        curX = tarX;
        curY = tarY;
        progress = 0;
        
        const nextNeighbors: {x: number, y: number}[] = [];
        if (curX > 0 && grid[curY][curX-1].buildingType === BuildingType.Road) nextNeighbors.push({x: curX-1, y: curY});
        if (curX < GRID_SIZE - 1 && grid[curY][curX+1].buildingType === BuildingType.Road) nextNeighbors.push({x: curX+1, y: curY});
        if (curY > 0 && grid[curY-1][curX].buildingType === BuildingType.Road) nextNeighbors.push({x: curX, y: curY-1});
        if (curY < GRID_SIZE - 1 && grid[curY+1][curX].buildingType === BuildingType.Road) nextNeighbors.push({x: curX, y: curY+1});

        if (nextNeighbors.length > 0) {
            const valid = nextNeighbors.length > 1 
                ? nextNeighbors.filter(n => Math.abs(n.x - carsState.current[idx]) > 0.1 || Math.abs(n.y - carsState.current[idx+1]) > 0.1)
                : nextNeighbors;
            
            const next = valid.length > 0 
                ? valid[Math.floor(Math.random() * valid.length)]
                : nextNeighbors[0];
            
            tarX = next.x;
            tarY = next.y;
        } else {
            const rnd = roadTiles[Math.floor(Math.random() * roadTiles.length)];
            curX = rnd.x; curY = rnd.y; tarX = rnd.x; tarY = rnd.y;
        }
      }

      carsState.current[idx] = curX;
      carsState.current[idx+1] = curY;
      carsState.current[idx+2] = tarX;
      carsState.current[idx+3] = tarY;
      carsState.current[idx+4] = progress;

      // Interpolate position
      const gx = MathUtils.lerp(curX, tarX, progress);
      const gy = MathUtils.lerp(curY, tarY, progress);

      const angle = Math.atan2(dy, dx);
      const offsetAmt = 0.18;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      const offX = (-dy/len) * offsetAmt;
      const offY = (dx/len) * offsetAmt;

      const [wx, _, wz] = gridToWorld(gx + offX, gy + offY);

      dummy.position.set(wx, -0.3 + 0.075, wz);
      dummy.rotation.set(0, -angle, 0);
      dummy.scale.set(0.45, 0.15, 0.25); 
      
      dummy.updateMatrix();
      carsRef.current.setMatrixAt(i, dummy.matrix);
    }
    carsRef.current.instanceMatrix.needsUpdate = true;
  });

  if (roadTiles.length < 2) return null;

  return (
    <instancedMesh ref={carsRef} args={[boxGeo, undefined, carCount]} castShadow>
      <meshStandardMaterial roughness={0.5} metalness={0.3} />
    </instancedMesh>
  );
};


const clothesColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ffffff'];

const PopulationSystem = ({ population, grid }: { population: number, grid: Grid }) => {
    const agentCount = Math.min(Math.floor(population / 2), 300); 
    const meshRef = useRef<THREE.InstancedMesh>(null);
    
    // Find tiles where people can walk (Roads, Parks, empty ground)
    const walkableTiles = useMemo(() => {
        const tiles: {x: number, y: number}[] = [];
        grid.forEach(row => row.forEach(tile => {
          if (tile.buildingType === BuildingType.Road || tile.buildingType === BuildingType.Park || tile.buildingType === BuildingType.None) {
            tiles.push({x: tile.x, y: tile.y});
          }
        }));
        return tiles;
    }, [grid]);
    
    const agentsState = useRef<Float32Array>(new Float32Array(0));
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    useEffect(() => {
        if (agentCount === 0 || walkableTiles.length === 0) return;
        agentsState.current = new Float32Array(agentCount * 6);
        const newColors = new Float32Array(agentCount * 3);

        for(let i=0; i<agentCount; i++) {
            const t = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
            // Spawn with random offset in tile
            const x = t.x + getRandomRange(-0.4, 0.4);
            const y = t.y + getRandomRange(-0.4, 0.4);

            agentsState.current[i*6+0] = x;
            agentsState.current[i*6+1] = y;
            
            // Initial target
            const tt = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
            agentsState.current[i*6+2] = tt.x + getRandomRange(-0.4, 0.4);
            agentsState.current[i*6+3] = tt.y + getRandomRange(-0.4, 0.4);
            
            agentsState.current[i*6+4] = getRandomRange(0.005, 0.015); // speed
            agentsState.current[i*6+5] = Math.random() * Math.PI * 2; // anim

            const c = new THREE.Color(clothesColors[Math.floor(Math.random() * clothesColors.length)]);
            newColors[i*3] = c.r; newColors[i*3+1] = c.g; newColors[i*3+2] = c.b;
        }

        if (meshRef.current) {
            meshRef.current.instanceColor = new THREE.InstancedBufferAttribute(newColors, 3);
        }
    }, [agentCount, walkableTiles]);

    useFrame((state) => {
        if (!meshRef.current || agentCount === 0 || agentsState.current.length === 0) return;
        const time = state.clock.elapsedTime;

        for(let i=0; i<agentCount; i++) {
            const idx = i*6;
            let x = agentsState.current[idx];
            let y = agentsState.current[idx+1];
            let tx = agentsState.current[idx+2];
            let ty = agentsState.current[idx+3];
            const speed = agentsState.current[idx+4];
            const animOffset = agentsState.current[idx+5];

            const dx = tx - x;
            const dy = ty - y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < 0.1) {
                // Pick new random target from walkable
                if (walkableTiles.length > 0) {
                    const tt = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
                    tx = tt.x + getRandomRange(-0.4, 0.4);
                    ty = tt.y + getRandomRange(-0.4, 0.4);
                    agentsState.current[idx+2] = tx;
                    agentsState.current[idx+3] = ty;
                }
            } else {
                x += (dx/dist) * speed;
                y += (dy/dist) * speed;
                agentsState.current[idx] = x;
                agentsState.current[idx+1] = y;
            }

            const [wx, _, wz] = gridToWorld(x, y);

            // Walking bounce
            const bounce = Math.abs(Math.sin(time * 10 + animOffset)) * 0.03;

            // Person dimensions
            const height = 0.2;
            const width = 0.08;
            // Ground level approx -0.3 to -0.4
            const groundY = -0.35; 

            dummy.position.set(wx, groundY + height/2 + bounce, wz);
            dummy.rotation.set(0, -Math.atan2(dy, dx), 0);
            dummy.scale.set(width, height, width);
            
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    if (agentCount === 0) return null;

    return (
        <instancedMesh ref={meshRef} args={[boxGeo, undefined, agentCount]} castShadow>
            <meshStandardMaterial roughness={0.8} />
        </instancedMesh>
    )
};

// Clouds & Birds
const Cloud = ({ position, scale, speed }: { position: [number, number, number], scale: number, speed: number }) => {
    const group = useRef<THREE.Group>(null);
    useFrame((state, delta) => {
        if (group.current) {
            group.current.position.x += speed * delta;
            if (group.current.position.x > GRID_SIZE * 1.5) group.current.position.x = -GRID_SIZE * 1.5;
        }
    });

    const bubbles = useMemo(() => Array.from({length: 5 + Math.random() * 5}).map(() => ({
        pos: [getRandomRange(-1,1), getRandomRange(-0.5, 0.5), getRandomRange(-1,1)] as [number, number, number],
        scale: getRandomRange(0.5, 1.2)
    })), []);

    return (
        <group ref={group} position={position} scale={scale}>
            {bubbles.map((b, i) => (
                <mesh key={i} geometry={sphereGeo} position={b.pos} scale={b.scale} castShadow>
                    <meshStandardMaterial color="white" flatShading opacity={0.9} transparent />
                </mesh>
            ))}
        </group>
    )
}

const Bird = ({ position, speed, offset }: { position: [number, number, number], speed: number, offset: number }) => {
    const ref = useRef<THREE.Group>(null);
    useFrame((state) => {
        if(ref.current) {
            const time = state.clock.elapsedTime + offset;
            ref.current.position.x = position[0] + Math.sin(time * speed) * GRID_SIZE;
            ref.current.position.z = position[1] + Math.cos(time * speed) * GRID_SIZE/2;
            ref.current.rotation.y = -time * speed + Math.PI;
            ref.current.scale.y = 1 + Math.sin(time * 15) * 0.3;
        }
    });

    return (
        <group ref={ref} position={[position[0], position[2], position[1]]}>
            <mesh geometry={boxGeo} scale={[0.2, 0.05, 0.05]} position={[0.1,0,0]} rotation={[0, Math.PI/4, 0]}><meshBasicMaterial color="#333" /></mesh>
            <mesh geometry={boxGeo} scale={[0.2, 0.05, 0.05]} position={[-0.1,0,0]} rotation={[0, -Math.PI/4, 0]}><meshBasicMaterial color="#333" /></mesh>
        </group>
    )
}

const EnvironmentEffects = () => {
  console.log("Rendering EnvironmentEffects");
    return (
        <group raycast={() => null}>
             {/* Clouds */}
            <Cloud position={[-12, 8, 4]} scale={1.5} speed={0.3} />
            <Cloud position={[5, 9, -8]} scale={1.2} speed={0.5} />
            <Cloud position={[15, 7, 10]} scale={1.8} speed={0.2} />
            
            {/* Birds */}
            <group position={[0, 0, 0]} scale={0.8}>
                <Bird position={[0, 0, 10]} speed={0.6} offset={0} />
                <Bird position={[0, 0, 10]} speed={0.6} offset={1.2} />
                <Bird position={[0, 0, 10]} speed={0.6} offset={2.5} />
            </group>

            {/* Water */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} receiveShadow>
                <planeGeometry args={[GRID_SIZE * 4, GRID_SIZE * 4]} />
                <meshStandardMaterial color="#3b82f6" roughness={0.1} metalness={0.5} opacity={0.8} transparent />
            </mesh>
        </group>
    )
};


// --- 3. Vigilante Elements ---

const Player = ({ state }: { state: PlayerState }) => {
  const [wx, _, wz] = gridToWorld(state.x, state.y);
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((stateTime) => {
    if (groupRef.current) {
      // Hover effect
      groupRef.current.position.y = 0.5 + Math.sin(stateTime.clock.elapsedTime * 4) * 0.1;
      groupRef.current.rotation.y += 0.02;
    }
  });

  const suitColor = state.suitType === 'speed' ? '#fbbf24' : '#ef4444';

  return (
    <group ref={groupRef} position={[wx, 0.5, wz]}>
      {/* Hero Body */}
      <mesh castShadow>
        <boxGeometry args={[0.3, 0.4, 0.2]} />
        <meshStandardMaterial color={suitColor} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Hero Head */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#fca5a5" />
      </mesh>
      {/* Glow Effect */}
      <pointLight color={suitColor} intensity={1} distance={2} />
      <mesh scale={[0.4, 0.5, 0.3]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={suitColor} transparent opacity={0.2} />
      </mesh>
    </group>
  );
};

const EmergencyMarker = ({ emergency }: { emergency: Emergency }) => {
  const [wx, _, wz] = gridToWorld(emergency.x, emergency.y);
  const config = EMERGENCIES[emergency.type];
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y += 0.05;
      const scale = 1 + Math.sin(state.clock.elapsedTime * 6) * 0.2;
      ref.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group position={[wx, 0.2, wz]}>
      <group ref={ref}>
        <mesh castShadow>
          <octahedronGeometry args={[0.4, 0]} />
          <meshStandardMaterial 
            color={config.color} 
            emissive={config.color} 
            emissiveIntensity={1} 
            transparent 
            opacity={0.8} 
          />
        </mesh>
      </group>
      {/* Progress Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]}>
        <ringGeometry args={[0.45, 0.55, 32]} />
        <meshBasicMaterial color={config.color} transparent opacity={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.14, 0]}>
        <ringGeometry args={[0.45, 0.55, 32, 1, 0, (emergency.progress / 100) * Math.PI * 2]} />
        <meshBasicMaterial color="#fff" />
      </mesh>
    </group>
  );
};

// --- 4. Main Map Component ---

const RoadMarkings = React.memo(({ x, y, grid, yOffset }: { x: number; y: number; grid: Grid; yOffset: number }) => {
  const yellowMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fbbf24' }), []);
  const whiteMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', opacity: 0.6, transparent: true }), []);
  const curbMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9ca3af' }), []);
  
  const centerLineGeo = useMemo(() => new THREE.PlaneGeometry(0.04, 0.3), []);
  const edgeLineGeo = useMemo(() => new THREE.PlaneGeometry(0.02, 1.0), []);
  const curbGeo = useMemo(() => new THREE.BoxGeometry(0.08, 0.06, 1.0), []);

  const hasUp = y > 0 && grid[y - 1][x].buildingType === BuildingType.Road;
  const hasDown = y < GRID_SIZE - 1 && grid[y + 1][x].buildingType === BuildingType.Road;
  const hasLeft = x > 0 && grid[y][x - 1].buildingType === BuildingType.Road;
  const hasRight = x < GRID_SIZE - 1 && grid[y][x + 1].buildingType === BuildingType.Road;

  return (
    <group position={[0, yOffset, 0]}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        {/* Center dashed lines */}
        {(hasUp || hasDown || (!hasLeft && !hasRight)) && (
          <group>
            <mesh position={[0, 0.25, 0.001]} geometry={centerLineGeo} material={yellowMat} />
            <mesh position={[0, -0.25, 0.001]} geometry={centerLineGeo} material={yellowMat} />
          </group>
        )}
        {(hasLeft || hasRight) && (
          <group>
            <mesh position={[-0.25, 0, 0.001]} rotation={[0, 0, Math.PI / 2]} geometry={centerLineGeo} material={yellowMat} />
            <mesh position={[0.25, 0, 0.001]} rotation={[0, 0, Math.PI / 2]} geometry={centerLineGeo} material={yellowMat} />
          </group>
        )}

        {/* Edge lines */}
        {!hasLeft && <mesh position={[-0.44, 0, 0.002]} geometry={edgeLineGeo} material={whiteMat} />}
        {!hasRight && <mesh position={[0.44, 0, 0.002]} geometry={edgeLineGeo} material={whiteMat} />}
        {!hasUp && <mesh position={[0, 0.44, 0.002]} rotation={[0, 0, Math.PI / 2]} geometry={edgeLineGeo} material={whiteMat} />}
        {!hasDown && <mesh position={[0, -0.44, 0.002]} rotation={[0, 0, Math.PI / 2]} geometry={edgeLineGeo} material={whiteMat} />}
      </group>

      {/* Curbs (3D) */}
      {!hasLeft && <mesh position={[-0.47, 0.03, 0]} geometry={curbGeo} material={curbMat} castShadow receiveShadow />}
      {!hasRight && <mesh position={[0.47, 0.03, 0]} geometry={curbGeo} material={curbMat} castShadow receiveShadow />}
      {!hasUp && <mesh position={[0, 0.03, -0.47]} rotation={[0, Math.PI / 2, 0]} geometry={curbGeo} material={curbMat} castShadow receiveShadow />}
      {!hasDown && <mesh position={[0, 0.03, 0.47]} rotation={[0, Math.PI / 2, 0]} geometry={curbGeo} material={curbMat} castShadow receiveShadow />}
    </group>
  );
});

interface GroundTileProps {
    type: BuildingType;
    x: number;
    y: number;
    grid: Grid;
    onHover: (x: number, y: number) => void;
    onLeave: () => void;
    onClick: (x: number, y: number) => void;
}

// Ground Tile: Handles pointer events and forms base terrain
const GroundTile = React.memo(({ type, x, y, grid, onHover, onLeave, onClick }: GroundTileProps) => {
  if (x === 0 && y === 0) console.log("Rendering GroundTile at 0,0");
  const [wx, _, wz] = gridToWorld(x, y);
  
  let color = '#10b981';
  // Base level for tiles, slightly varying
  let topY = -0.3; 
  let thickness = 0.5;
  
  if (type === BuildingType.None) {
    const noise = getHash(x, y);
    color = noise > 0.7 ? '#059669' : noise > 0.3 ? '#10b981' : '#34d399';
    topY = -0.3 - noise * 0.1; // Slight height variation for grass
  } else if (type === BuildingType.Road) {
    const noise = getHash(x, y);
    const c = new THREE.Color('#374151');
    c.offsetHSL(0, 0, noise * 0.05 - 0.025);
    color = '#' + c.getHexString();
    topY = -0.29; // slightly higher
  } else {
    color = '#d1d5db'; // concrete base
    topY = -0.28;
  }

  const centerY = topY - thickness/2;

  return (
    <mesh 
        position={[wx, centerY, wz]} 
        receiveShadow castShadow
        onPointerEnter={(e) => { e.stopPropagation(); onHover(x, y); }}
        onPointerOut={(e) => { e.stopPropagation(); onLeave(); }}
        onPointerDown={(e) => {
            e.stopPropagation();
            if (e.button === 0) onClick(x, y);
        }}
    >
      <boxGeometry args={[1, thickness, 1]} />
      <meshStandardMaterial color={color} flatShading roughness={1} />
      {type === BuildingType.Road && <RoadMarkings x={x} y={y} grid={grid} yOffset={thickness / 2 + 0.001} />}
    </mesh>
  );
});

// Selection/Hover Cursor
const Cursor = ({ x, y, color }: { x: number, y: number, color: string }) => {
  const [wx, _, wz] = gridToWorld(x, y);
  return (
    <mesh position={[wx, -0.25, wz]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} depthTest={false} />
      <Outlines thickness={0.05} color="white" />
    </mesh>
  );
};



const MapContent = ({ grid, onTileClick, hoveredTile, hoveredTool, population, handleHover, handleLeave, player, emergencies }: { 
  grid: Grid, 
  onTileClick: (x: number, y: number) => void,
  hoveredTile: {x: number, y: number} | null,
  hoveredTool: BuildingType,
  population: number,
  handleHover: (x: number, y: number) => void,
  handleLeave: () => void,
  player: PlayerState,
  emergencies: Emergency[]
}) => {
  const textures = useTexture({
    brick: 'https://picsum.photos/seed/city-brick/512/512',
    stone: 'https://picsum.photos/seed/city-stone/512/512',
    concrete: 'https://picsum.photos/seed/city-concrete/512/512',
  });

  useMemo(() => {
    Object.values(textures).forEach(tex => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(4, 4); // Increased repeat for better detail
    });
  }, [textures]);

  const showPreview = hoveredTile && grid[hoveredTile.y][hoveredTile.x].buildingType !== hoveredTool && hoveredTool !== BuildingType.None;
  const previewColor = showPreview ? BUILDINGS[hoveredTool].color : 'white';
  const isBulldoze = hoveredTool === BuildingType.None;
  const previewPos = hoveredTile ? gridToWorld(hoveredTile.x, hoveredTile.y) : [0,0,0];

  return (
    <>
      <OrthographicCamera makeDefault zoom={45} position={[20, 20, 20]} near={-100} far={200} />
      
      <MapControls 
        enableRotate={true}
        enableZoom={true}
        minZoom={20}
        maxZoom={120}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={0.1}
        target={[0,-0.5,0]}
      />

      <ambientLight intensity={0.5} color="#cceeff" />
      <directionalLight
        castShadow
        position={[15, 20, 10]}
        intensity={2}
        color="#fffbeb"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-15} shadow-camera-right={15}
        shadow-camera-top={15} shadow-camera-bottom={-15}
      />
      <Environment preset="city" />

      <EnvironmentEffects />

      <group>
        {(() => { console.log("Rendering grid of size:", grid.length); return null; })()}
        {grid.map((row, y) =>
          row.map((tile, x) => {
            const [wx, _, wz] = gridToWorld(x, y);
            return (
              <React.Fragment key={`${x}-${y}`}>
                <GroundTile 
                    type={tile.buildingType} 
                    x={x} y={y} 
                    grid={grid}
                    onHover={handleHover}
                    onLeave={handleLeave}
                    onClick={onTileClick}
                />
                
                <group position={[wx, 0, wz]} raycast={() => null}>
                    {tile.buildingType !== BuildingType.None && tile.buildingType !== BuildingType.Road && (
                      <ProceduralBuilding 
                        type={tile.buildingType} 
                        baseColor={BUILDINGS[tile.buildingType].color} 
                        x={x} y={y} 
                        textures={textures}
                        constructionProgress={tile.constructionProgress}
                        condition={tile.condition}
                      />
                    )}
                </group>
              </React.Fragment>
            )
          })
        )}

        <group raycast={() => null}>
          <TrafficSystem grid={grid} />
          <PopulationSystem population={population} grid={grid} />
          
          {/* Vigilante Elements */}
          <Player state={player} />
          {emergencies.filter(e => e.active).map(e => (
            <EmergencyMarker key={e.id} emergency={e} />
          ))}

          {grid.map((row, y) => row.map((tile, x) => {
            if (tile.buildingType !== BuildingType.Road) return null;
            let roadNeighbors = 0;
            let hasHorizontal = false;
            if (x > 0 && grid[y][x-1].buildingType === BuildingType.Road) { roadNeighbors++; hasHorizontal = true; }
            if (x < GRID_SIZE - 1 && grid[y][x+1].buildingType === BuildingType.Road) { roadNeighbors++; hasHorizontal = true; }
            if (y > 0 && grid[y-1][x].buildingType === BuildingType.Road) roadNeighbors++;
            if (y < GRID_SIZE - 1 && grid[y+1][x].buildingType === BuildingType.Road) roadNeighbors++;
            if (roadNeighbors >= 3) return <TrafficLight key={`light-${x}-${y}`} x={x} y={y} horizontal={hasHorizontal} />;
            return null;
          }))}

          {showPreview && hoveredTile && (
            <group position={[previewPos[0], 0, previewPos[2]]}>
              <Float speed={3} rotationIntensity={0} floatIntensity={0.1} floatingRange={[0, 0.1]}>
                <ProceduralBuilding 
                  type={hoveredTool} 
                  baseColor={previewColor} 
                  x={hoveredTile.x} 
                  y={hoveredTile.y} 
                  textures={textures}
                  transparent 
                  opacity={0.7} 
                />
              </Float>
            </group>
          )}

          {hoveredTile && (
            <Cursor 
              x={hoveredTile.x} 
              y={hoveredTile.y} 
              color={isBulldoze ? '#ef4444' : (showPreview ? '#ffffff' : '#000000')} 
            />
          )}
        </group>
      </group>
    </>
  );
};

interface IsoMapProps {
  grid: Grid;
  onTileClick: (x: number, y: number) => void;
  hoveredTool: BuildingType;
  population: number;
  player: PlayerState;
  emergencies: Emergency[];
}

const IsoMap: React.FC<IsoMapProps> = ({ grid, onTileClick, hoveredTool, population, player, emergencies }) => {
  const [hoveredTile, setHoveredTile] = useState<{x: number, y: number} | null>(null);

  const handleHover = useCallback((x: number, y: number) => {
    setHoveredTile({ x, y });
  }, []);

  const handleLeave = useCallback(() => {
    setHoveredTile(null);
  }, []);

  // Preview Logic
  const showPreview = hoveredTile && grid[hoveredTile.y][hoveredTile.x].buildingType !== hoveredTool && hoveredTool !== BuildingType.None;
  const previewColor = showPreview ? BUILDINGS[hoveredTool].color : 'white';
  const isBulldoze = hoveredTool === BuildingType.None;
  
  const previewPos = hoveredTile ? gridToWorld(hoveredTile.x, hoveredTile.y) : [0,0,0];

  console.log("Rendering IsoMap with grid size:", grid.length);

  return (
    <div className="absolute inset-0 bg-sky-900 touch-none">
      <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true }} style={{ width: '100%', height: '100%' }}>
        <Suspense fallback={<mesh><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="red" /></mesh>}>
          <MapContent 
            grid={grid} 
            onTileClick={onTileClick} 
            hoveredTile={hoveredTile} 
            hoveredTool={hoveredTool} 
            population={population}
            handleHover={handleHover}
            handleLeave={handleLeave}
            player={player}
            emergencies={emergencies}
          />
          <SoftShadows size={10} samples={8} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default IsoMap;