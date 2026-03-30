/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Grid, TileData, BuildingType, CityStats, AIGoal, NewsItem, Emergency, EmergencyType, PlayerState, GameMode } from './types';
import { GRID_SIZE, BUILDINGS, TICK_RATE_MS, INITIAL_MONEY, INITIAL_REPUTATION, INITIAL_PLAYER_STATE, EMERGENCIES } from './constants';
import IsoMap from './components/IsoMap';
import UIOverlay from './components/UIOverlay';
import StartScreen from './components/StartScreen';
import { generateVigilanteGoal } from './services/cityService';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { saveCityData, loadCityData, testConnection } from './services/firebaseService';

// Initialize grid with DTLA-inspired core
const createInitialGrid = (): Grid => {
  const grid: Grid = [];
  const center = Math.floor(GRID_SIZE / 2);

  for (let y = 0; y < GRID_SIZE; y++) {
    const row: TileData[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      let bType = BuildingType.None;
      
      // DTLA Grid Layout (Roads every 4 tiles)
      if (x % 4 === 0 || y % 4 === 0) {
        bType = BuildingType.Road;
      } else {
        // Core (Financial District)
        const dist = Math.max(Math.abs(x - center), Math.abs(y - center));
        if (dist < 4) {
          bType = BuildingType.Commercial; // Skyscrapers
        } else if (dist < 8) {
          bType = Math.random() > 0.5 ? BuildingType.Residential : BuildingType.Commercial;
        } else if (dist < 12) {
          bType = Math.random() > 0.7 ? BuildingType.Industrial : BuildingType.Residential;
        }
      }

      row.push({ 
        x, y, 
        buildingType: bType,
        constructionProgress: bType !== BuildingType.None ? 100 : 0,
        condition: 100
      });
    }
    grid.push(row);
  }
  return grid;
};

function App() {
  // --- Game State ---
  const [gameStarted, setGameStarted] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [grid, setGrid] = useState<Grid>(createInitialGrid);
  const [stats, setStats] = useState<CityStats>({ money: INITIAL_MONEY, population: 0, reputation: INITIAL_REPUTATION, day: 1 });
  const [selectedTool, setSelectedTool] = useState<BuildingType>(BuildingType.Road);
  
  // --- Vigilante State ---
  const [player, setPlayer] = useState<PlayerState>(INITIAL_PLAYER_STATE);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  
  // --- AI State ---
  const [currentGoal, setCurrentGoal] = useState<AIGoal | null>(null);
  const [isGeneratingGoal, setIsGeneratingGoal] = useState(false);
  
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.Vigilante);
  
  // Refs for accessing state inside intervals without dependencies
  const gridRef = useRef(grid);
  const statsRef = useRef(stats);
  const goalRef = useRef(currentGoal);
  const aiEnabledRef = useRef(aiEnabled);
  const userRef = useRef(user);
  const playerRef = useRef(player);
  const emergenciesRef = useRef(emergencies);
  const gameModeRef = useRef(gameMode);

  // Sync refs
  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { statsRef.current = stats; }, [stats]);
  useEffect(() => { goalRef.current = currentGoal; }, [currentGoal]);
  useEffect(() => { aiEnabledRef.current = aiEnabled; }, [aiEnabled]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { playerRef.current = player; }, [player]);
  useEffect(() => { emergenciesRef.current = emergencies; }, [emergencies]);
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);

  const handleStart = useCallback(async (enabled: boolean, loggedInUser: User | null) => {
    setAiEnabled(enabled);
    setUser(loggedInUser);
    
    if (loggedInUser) {
      setIsLoading(true);
      const savedData = await loadCityData(loggedInUser.uid);
      if (savedData) {
        setGrid(savedData.grid);
        setStats(savedData.stats);
        setCurrentGoal(savedData.currentGoal);
        if (savedData.player) setPlayer(savedData.player);
        if (savedData.emergencies) setEmergencies(savedData.emergencies);
        if (savedData.gameMode) setGameMode(savedData.gameMode);
      }
      setIsLoading(false);
    }
    
    setGameStarted(true);
    
    // Persist game state for auto-resume
    localStorage.setItem('sky_metropolis_active', 'true');
    localStorage.setItem('sky_metropolis_ai_enabled', enabled.toString());
  }, []);

  // --- Persistence Logic ---
  
  useEffect(() => {
    testConnection();
    // Listen for auth state changes to handle persistent login
    const unsubscribe = onAuthStateChanged(auth, async (loggedInUser) => {
      setUser(loggedInUser);
      setIsAuthChecking(false);
      
      // Auto-resume if user is logged in and was previously in a game
      const wasGameActive = localStorage.getItem('sky_metropolis_active') === 'true';
      if (loggedInUser && wasGameActive && !gameStarted) {
        const savedAiEnabled = localStorage.getItem('sky_metropolis_ai_enabled') !== 'false';
        handleStart(savedAiEnabled, loggedInUser);
      }
    });
    return () => unsubscribe();
  }, [gameStarted, handleStart]);

  const saveToCloud = useCallback(async (customGrid?: Grid, customStats?: CityStats) => {
    if (!userRef.current || !gameStarted) return;
    
    await saveCityData(userRef.current.uid, {
      grid: customGrid || gridRef.current,
      stats: customStats || statsRef.current,
      currentGoal: goalRef.current,
      player: playerRef.current,
      emergencies: emergenciesRef.current,
      gameMode: gameModeRef.current,
      updatedAt: Date.now()
    });
  }, [gameStarted]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!gameStarted || !user) return;
    const interval = setInterval(() => saveToCloud(), 30000);
    return () => clearInterval(interval);
  }, [gameStarted, user, saveToCloud]);

  // --- AI Logic Wrappers ---

  const fetchNewGoal = useCallback(async () => {
    if (isGeneratingGoal || !aiEnabledRef.current) return;
    setIsGeneratingGoal(true);
    // Short delay for visual effect
    await new Promise(r => setTimeout(r, 500));
    
    const newGoal = await generateVigilanteGoal(statsRef.current, emergenciesRef.current);
    if (newGoal) {
      setCurrentGoal(newGoal);
    } else {
      // Retry soon if failed, but only if AI still enabled
      if(aiEnabledRef.current) setTimeout(fetchNewGoal, 5000);
    }
    setIsGeneratingGoal(false);
  }, [isGeneratingGoal]); 

  // --- Initial Setup ---
  useEffect(() => {
    if (!gameStarted) return;

    if (aiEnabled && !currentGoal) {
      fetchNewGoal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStarted]);


  // --- City Growth Logic ---

  const autoGrowCity = useCallback(() => {
    if (gameModeRef.current !== GameMode.Vigilante) return;
    
    // 5% chance to grow a new building every tick
    if (Math.random() > 0.05) return;

    const newGrid = [...gridRef.current.map(row => [...row])];
    const emptyTiles: {x: number, y: number}[] = [];
    
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (newGrid[y][x].buildingType === BuildingType.None) {
          // Check if near a road
          const neighbors = [
            {x: x-1, y}, {x: x+1, y}, {x, y: y-1}, {x, y: y+1}
          ];
          const nearRoad = neighbors.some(n => 
            n.x >= 0 && n.x < GRID_SIZE && n.y >= 0 && n.y < GRID_SIZE && 
            newGrid[n.y][n.x].buildingType === BuildingType.Road
          );
          
          if (nearRoad) emptyTiles.push({x, y});
        }
      }
    }

    if (emptyTiles.length > 0) {
      const target = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
      const types = [BuildingType.Residential, BuildingType.Commercial, BuildingType.Industrial, BuildingType.Park];
      const newType = types[Math.floor(Math.random() * types.length)];
      
      newGrid[target.y][target.x] = {
        ...newGrid[target.y][target.x],
        buildingType: newType,
        constructionProgress: 0,
        condition: 100
      };
      
      setGrid(newGrid);
    }
  }, []);

  // --- Game Loop ---
  useEffect(() => {
    if (!gameStarted) return;

    const intervalId = setInterval(() => {
      // 1. Update Player Movement
      setPlayer(prev => {
        if (prev.targetX === null || prev.targetY === null) return prev;
        
        const dx = prev.targetX - prev.x;
        const dy = prev.targetY - prev.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 0.1) {
          return { ...prev, x: prev.targetX, y: prev.targetY, targetX: null, targetY: null };
        }
        
        const speed = prev.suitType === 'speed' ? 0.8 : 0.4;
        const moveX = (dx / dist) * speed;
        const moveY = (dy / dist) * speed;
        
        return { ...prev, x: prev.x + moveX, y: prev.y + moveY };
      });

      // 2. Generate Emergencies
      if (Math.random() < 0.1 && emergenciesRef.current.filter(e => e.active).length < 5) {
        const x = Math.floor(Math.random() * GRID_SIZE);
        const y = Math.floor(Math.random() * GRID_SIZE);
        const types = Object.values(EmergencyType);
        const type = types[Math.floor(Math.random() * types.length)];
        
        const newEmergency: Emergency = {
          id: Date.now().toString(),
          type,
          x,
          y,
          severity: Math.floor(Math.random() * 5) + 1,
          progress: 0,
          active: true,
          startTime: Date.now()
        };
        
        setEmergencies(prev => [...prev, newEmergency]);
      }

      // 3. Update Emergencies & Player Interaction
      setEmergencies(prev => {
        const p = playerRef.current;
        return prev.map(e => {
          if (!e.active) return e;
          
          // If player is close, resolve emergency
          const dist = Math.sqrt(Math.pow(e.x - p.x, 2) + Math.pow(e.y - p.y, 2));
          if (dist < 1.0) {
            const resolveSpeed = 10 + (p.level * 2);
            const newProgress = Math.min(100, e.progress + resolveSpeed);
            if (newProgress === 100) {
              // Resolved!
              setStats(s => ({ ...s, reputation: s.reputation + (e.severity * 10), money: s.money + (e.severity * 5) }));
              return { ...e, progress: 100, active: false };
            }
            return { ...e, progress: newProgress };
          }
          
          return e;
        });
      });

      // 4. Update Grid (Construction & Decay)
      setGrid(prev => {
        let changed = false;
        const newGrid = prev.map(row => row.map(tile => {
          if (tile.buildingType !== BuildingType.None && tile.constructionProgress < 100) {
            changed = true;
            return { ...tile, constructionProgress: Math.min(100, tile.constructionProgress + 5) };
          }
          return tile;
        }));
        return changed ? newGrid : prev;
      });

      // 5. Automatic City Growth
      autoGrowCity();

      // 6. Update Stats & Goals
      setStats(prev => {
        const newStats = {
          ...prev,
          day: prev.day + 1,
        };
        
        // Check Goal Completion
        const goal = goalRef.current;
        if (aiEnabledRef.current && goal && !goal.completed) {
          let isMet = false;
          if (goal.targetType === 'reputation' && newStats.reputation >= goal.targetValue) isMet = true;
          if (goal.targetType === 'emergency_resolved') {
             const resolvedCount = emergenciesRef.current.filter(e => !e.active && e.progress === 100).length;
             if (resolvedCount >= goal.targetValue) isMet = true;
          }

          if (isMet) {
            setCurrentGoal({ ...goal, completed: true });
          }
        }

        return newStats;
      });

    }, 200); // Faster tick for movement smoothness

    return () => clearInterval(intervalId);
  }, [gameStarted]);


  // --- Interaction Logic ---

  const handleTileClick = useCallback((x: number, y: number) => {
    if (!gameStarted) return; 

    if (gameModeRef.current === GameMode.Builder) {
      const tool = selectedTool;
      const config = BUILDINGS[tool];
      
      if (tool === BuildingType.None) {
        // Bulldoze
        const newGrid = [...gridRef.current.map(row => [...row])];
        newGrid[y][x] = { ...newGrid[y][x], buildingType: BuildingType.None, constructionProgress: 0, condition: 100 };
        setGrid(newGrid);
      } else if (tool === BuildingType.Repair) {
        // Repair
        const newGrid = [...gridRef.current.map(row => [...row])];
        newGrid[y][x] = { ...newGrid[y][x], condition: 100 };
        setGrid(newGrid);
      } else if (statsRef.current.money >= config.cost) {
        // Build
        const newGrid = [...gridRef.current.map(row => [...row])];
        newGrid[y][x] = { 
          ...newGrid[y][x], 
          buildingType: tool, 
          constructionProgress: 0, 
          condition: 100 
        };
        setGrid(newGrid);
        setStats(prev => ({ ...prev, money: prev.money - config.cost }));
      }
    } else {
      // Vigilante Mode: Move Player
      setPlayer(prev => ({ ...prev, targetX: x, targetY: y }));
    }
  }, [gameStarted, selectedTool]);

  const handleClaimReward = () => {
    if (currentGoal && currentGoal.completed) {
      const newStats = { ...statsRef.current, money: statsRef.current.money + currentGoal.reward };
      setStats(newStats);
      setCurrentGoal(null);
      fetchNewGoal();
      saveToCloud(undefined, newStats); // Immediate save
    }
  };

  console.log("App rendering, gameStarted:", gameStarted, "grid size:", grid.length);

  return (
    <div className="relative w-screen h-screen overflow-hidden selection:bg-transparent selection:text-transparent bg-sky-900">
      {/* 3D Rendering Layer - Always visible now, providing background for start screen */}
      <IsoMap 
        grid={grid} 
        onTileClick={handleTileClick} 
        hoveredTool={selectedTool}
        population={stats.population}
        player={player}
        emergencies={emergencies}
      />
      
      {/* Start Screen Overlay */}
      {!gameStarted && !isAuthChecking && (
        <StartScreen onStart={handleStart} />
      )}

      {/* Initial Auth Loading */}
      {isAuthChecking && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-[70] bg-slate-900/40 backdrop-blur-sm text-white">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
          <p className="text-xs font-mono tracking-[0.3em] animate-pulse uppercase">Establishing Connection</p>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-[60] bg-slate-900/80 backdrop-blur-md text-white">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-xl font-bold tracking-widest animate-pulse">RESTORING METROPOLIS...</p>
        </div>
      )}

      {/* UI Layer */}
      {gameStarted && (
        <UIOverlay
          stats={stats}
          selectedTool={selectedTool}
          onSelectTool={setSelectedTool}
          currentGoal={currentGoal}
          onClaimReward={handleClaimReward}
          isGeneratingGoal={isGeneratingGoal}
          aiEnabled={aiEnabled}
          emergencies={emergencies}
          player={player}
          gameMode={gameMode}
          onSetGameMode={setGameMode}
        />
      )}

      {/* CSS for animations and utility */}
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        .animate-fade-in { animation: fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        .mask-image-b { -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%); mask-image: linear-gradient(to bottom, transparent 0%, black 15%); }
        
        /* Vertical text for toolbar label */
        .writing-mode-vertical { writing-mode: vertical-rl; text-orientation: mixed; }
        
        /* Custom scrollbar for news */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
      `}</style>
    </div>
  );
}

export default App;