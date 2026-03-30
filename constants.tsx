/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { BuildingConfig, BuildingType, EmergencyType } from './types';

// Map Settings
export const GRID_SIZE = 20;

// Game Settings
export const TICK_RATE_MS = 2000; // Game loop updates every 2 seconds
export const INITIAL_MONEY = 1000;
export const INITIAL_REPUTATION = 0;

export const BUILDINGS: Record<BuildingType, BuildingConfig> = {
  [BuildingType.None]: {
    type: BuildingType.None,
    cost: 0,
    name: 'Bulldoze',
    description: 'Clear a tile',
    color: '#ef4444', // Used for UI
    popGen: 0,
    incomeGen: 0,
  },
  [BuildingType.Road]: {
    type: BuildingType.Road,
    cost: 10,
    name: 'Road',
    description: 'Connects buildings.',
    color: '#374151', // gray-700
    popGen: 0,
    incomeGen: 0,
  },
  [BuildingType.Residential]: {
    type: BuildingType.Residential,
    cost: 100,
    name: 'House',
    description: '+5 Pop/day',
    color: '#f87171', // red-400
    popGen: 5,
    incomeGen: 0,
  },
  [BuildingType.Commercial]: {
    type: BuildingType.Commercial,
    cost: 200,
    name: 'Shop',
    description: '+$15/day',
    color: '#60a5fa', // blue-400
    popGen: 0,
    incomeGen: 15,
  },
  [BuildingType.Industrial]: {
    type: BuildingType.Industrial,
    cost: 400,
    name: 'Factory',
    description: '+$40/day',
    color: '#facc15', // yellow-400
    popGen: 0,
    incomeGen: 40,
  },
  [BuildingType.Park]: {
    type: BuildingType.Park,
    cost: 50,
    name: 'Park',
    description: 'Looks nice.',
    color: '#4ade80', // green-400
    popGen: 1,
    incomeGen: 0,
  },
  [BuildingType.Repair]: {
    type: BuildingType.Repair,
    cost: 10,
    name: 'Repair',
    description: 'Restore building condition',
    color: '#a855f7', // purple-500
    popGen: 0,
    incomeGen: 0,
  },
};

export const EMERGENCIES: Record<EmergencyType, { name: string, color: string, icon: string }> = {
  [EmergencyType.Fire]: { name: 'Fire', color: '#ff4400', icon: '🔥' },
  [EmergencyType.Crime]: { name: 'Crime', color: '#ff00ff', icon: '🦹' },
  [EmergencyType.Medical]: { name: 'Medical', color: '#00ffff', icon: '🚑' },
  [EmergencyType.Structural]: { name: 'Structural', color: '#ffff00', icon: '🏗️' },
};

export const INITIAL_PLAYER_STATE = {
  x: 10,
  y: 10,
  targetX: null,
  targetY: null,
  energy: 100,
  level: 1,
  reputation: 0,
  suitType: 'basic' as const,
};
