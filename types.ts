/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
export enum BuildingType {
  None = 'None',
  Road = 'Road',
  Residential = 'Residential',
  Commercial = 'Commercial',
  Industrial = 'Industrial',
  Park = 'Park',
  Repair = 'Repair',
}

export enum EmergencyType {
  Fire = 'Fire',
  Crime = 'Crime',
  Medical = 'Medical',
  Structural = 'Structural'
}

export enum GameMode {
  Vigilante = 'Vigilante',
  Builder = 'Builder'
}

export interface Emergency {
  id: string;
  type: EmergencyType;
  x: number;
  y: number;
  severity: number; // 1-5
  progress: number; // 0-100 (100 means resolved)
  active: boolean;
  startTime: number;
}

export interface PlayerState {
  x: number;
  y: number;
  targetX: number | null;
  targetY: number | null;
  energy: number;
  level: number;
  reputation: number;
  suitType: 'basic' | 'flight' | 'speed';
}

export interface BuildingConfig {
  type: BuildingType;
  cost: number;
  name: string;
  description: string;
  color: string; // Main color for 3D material
  popGen: number; // Population generation per tick
  incomeGen: number; // Money generation per tick
}

export interface TileData {
  x: number;
  y: number;
  buildingType: BuildingType;
  // Suggested by AI for visual variety later
  variant?: number;
  constructionProgress?: number; // 0 to 100
  condition?: number; // 0 to 100
}

export type Grid = TileData[][];

export interface CityStats {
  money: number;
  population: number;
  reputation: number;
  day: number;
}

export interface AIGoal {
  id: string;
  description: string;
  targetType: 'population' | 'money' | 'building_count' | 'emergency_resolved' | 'reputation';
  targetValue: number;
  buildingType?: BuildingType; // If target is building_count
  reward: number;
  completed: boolean;
}

export interface NewsItem {
  id: string;
  text: string;
  type: 'positive' | 'negative' | 'neutral';
}

export interface CityData {
  stats: CityStats;
  grid: Grid;
  currentGoal: AIGoal | null;
  player: PlayerState;
  emergencies: Emergency[];
  gameMode: GameMode;
  updatedAt: number;
}
