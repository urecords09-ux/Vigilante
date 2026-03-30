/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useRef } from 'react';
import { BuildingType, CityStats, AIGoal, NewsItem, Emergency, PlayerState, GameMode } from '../types';
import { BUILDINGS, EMERGENCIES } from '../constants';

interface UIOverlayProps {
  stats: CityStats;
  selectedTool: BuildingType;
  onSelectTool: (type: BuildingType) => void;
  currentGoal: AIGoal | null;
  onClaimReward: () => void;
  isGeneratingGoal: boolean;
  aiEnabled: boolean;
  emergencies: Emergency[];
  player: PlayerState;
  gameMode: GameMode;
  onSetGameMode: (mode: GameMode) => void;
}

const tools = [
  BuildingType.None, // Bulldoze
  BuildingType.Road,
  BuildingType.Residential,
  BuildingType.Commercial,
  BuildingType.Industrial,
  BuildingType.Park,
  BuildingType.Repair,
];

const ToolButton: React.FC<{
  type: BuildingType;
  isSelected: boolean;
  onClick: () => void;
  money: number;
}> = ({ type, isSelected, onClick, money }) => {
  const config = BUILDINGS[type];
  const canAfford = money >= config.cost;
  const isBulldoze = type === BuildingType.None;
  
  // Use 3D color for preview
  const bgColor = isBulldoze ? config.color : config.color;

  return (
    <button
      onClick={onClick}
      disabled={!isBulldoze && !canAfford}
      className={`
        relative flex flex-col items-center justify-center rounded-lg border-2 transition-all shadow-lg backdrop-blur-sm flex-shrink-0
        w-14 h-14 md:w-16 md:h-16
        ${isSelected ? 'border-white bg-white/20 scale-110 z-10' : 'border-gray-600 bg-gray-900/80 hover:bg-gray-800'}
        ${!isBulldoze && !canAfford ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      title={config.description}
    >
      <div className="w-6 h-6 md:w-8 md:h-8 rounded mb-0.5 md:mb-1 border border-black/30 shadow-inner flex items-center justify-center overflow-hidden" style={{ backgroundColor: isBulldoze ? 'transparent' : bgColor }}>
        {isBulldoze && <div className="w-full h-full bg-red-600 text-white flex justify-center items-center font-bold text-base md:text-lg">✕</div>}
        {type === BuildingType.Road && <div className="w-full h-2 bg-gray-800 transform -rotate-45"></div>}
      </div>
      <span className="text-[8px] md:text-[10px] font-bold text-white uppercase tracking-wider drop-shadow-md leading-none">{config.name}</span>
      {config.cost > 0 && (
        <span className={`text-[8px] md:text-[10px] font-mono leading-none ${canAfford ? 'text-green-300' : 'text-red-400'}`}>${config.cost}</span>
      )}
    </button>
  );
};

const UIOverlay: React.FC<UIOverlayProps> = ({
  stats,
  selectedTool,
  onSelectTool,
  currentGoal,
  onClaimReward,
  isGeneratingGoal,
  aiEnabled,
  emergencies,
  player,
  gameMode,
  onSetGameMode
}) => {
  const activeEmergencies = emergencies.filter(e => e.active);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 md:p-4 font-sans z-10">
      
      {/* Top Bar: Stats & Goal */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start pointer-events-auto gap-2 w-full max-w-full">
        
        <div className="flex flex-col gap-2">
          {/* Mode Toggle */}
          <div className="flex bg-gray-900/90 rounded-xl border border-gray-700 p-1 self-start">
            <button 
              onClick={() => onSetGameMode(GameMode.Vigilante)}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${gameMode === GameMode.Vigilante ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              Vigilante
            </button>
            <button 
              onClick={() => onSetGameMode(GameMode.Builder)}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${gameMode === GameMode.Builder ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              Builder
            </button>
          </div>

          {/* Stats */}
          <div className="bg-gray-900/90 text-white p-2 md:p-3 rounded-xl border border-gray-700 shadow-2xl backdrop-blur-md flex gap-3 md:gap-6 items-center justify-between md:justify-start w-full md:w-auto">
          <div className="flex flex-col">
            <span className="text-[8px] md:text-[10px] text-gray-400 uppercase font-bold tracking-widest">Reputation</span>
            <span className="text-lg md:text-2xl font-black text-yellow-400 font-mono drop-shadow-md">{stats.reputation.toLocaleString()}</span>
          </div>
          <div className="w-px h-6 md:h-8 bg-gray-700"></div>
          <div className="flex flex-col">
            <span className="text-[8px] md:text-[10px] text-gray-400 uppercase font-bold tracking-widest">Treasury</span>
            <span className="text-base md:text-xl font-bold text-green-400 font-mono drop-shadow-md">${stats.money.toLocaleString()}</span>
          </div>
          <div className="w-px h-6 md:h-8 bg-gray-700"></div>
          <div className="flex flex-col items-end">
             <span className="text-[8px] md:text-[10px] text-gray-400 uppercase font-bold tracking-widest">Level</span>
             <span className="text-base md:text-lg font-bold text-blue-400 font-mono">{player.level}</span>
          </div>
        </div>
      </div>

      {/* AI Goal Panel */}
        <div className={`w-full md:w-80 bg-indigo-900/90 text-white rounded-xl border-2 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.4)] backdrop-blur-md overflow-hidden transition-all ${!aiEnabled ? 'opacity-80 grayscale-[0.5]' : ''}`}>
          <div className="bg-indigo-800/80 px-3 md:px-4 py-1.5 md:py-2 flex justify-between items-center border-b border-indigo-600">
            <span className="font-bold uppercase text-[10px] md:text-xs tracking-widest flex items-center gap-2 shadow-sm">
              <span className={`w-2 h-2 rounded-full ${isGeneratingGoal ? 'bg-yellow-400 animate-ping' : 'bg-cyan-400 animate-pulse'}`}></span>
              Vigilante Advisor
            </span>
            {isGeneratingGoal && <span className="text-[10px] animate-pulse text-yellow-300 font-mono">Scanning...</span>}
          </div>
          
          <div className="p-3 md:p-4">
            {currentGoal ? (
              <>
                <p className="text-xs md:text-sm font-medium text-indigo-100 mb-2 md:mb-3 leading-tight drop-shadow">"{currentGoal.description}"</p>
                
                <div className="flex justify-between items-center mt-1 md:mt-2 bg-indigo-950/60 p-1.5 md:p-2 rounded-lg border border-indigo-700/50">
                  <div className="text-[10px] md:text-xs text-gray-300">
                    Target: <span className="font-mono font-bold text-white">
                      {currentGoal.targetValue} {currentGoal.targetType === 'reputation' ? 'Rep' : 'Resolved'}
                    </span>
                  </div>
                  <div className="text-[10px] md:text-xs text-yellow-300 font-bold font-mono bg-yellow-900/50 px-2 py-0.5 rounded border border-yellow-600/50">
                    +${currentGoal.reward}
                  </div>
                </div>

                {currentGoal.completed && (
                  <button
                    onClick={onClaimReward}
                    className="mt-2 md:mt-3 w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-1.5 md:py-2 px-4 rounded shadow-[0_0_15px_rgba(34,197,94,0.6)] transition-all animate-bounce text-xs md:text-sm uppercase tracking-wide border border-green-400/50"
                  >
                    Claim Reward
                  </button>
                )}
              </>
            ) : (
              <div className="text-xs md:text-sm text-gray-400 py-2 italic flex items-center gap-2">
                Scanning for threats...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar: Active Emergencies & Controls */}
      <div className="flex flex-col-reverse md:flex-row md:justify-between md:items-end pointer-events-auto mt-auto gap-2 w-full max-w-full">
        
        {/* Conditional Controls based on Mode */}
        {gameMode === GameMode.Vigilante ? (
          /* Suit Controls */
          <div className="flex gap-1 md:gap-2 bg-gray-900/80 p-1 md:p-2 rounded-2xl border border-gray-600/50 backdrop-blur-xl shadow-2xl w-full md:w-auto overflow-x-auto no-scrollbar justify-start md:justify-start">
            <div className="flex gap-1 md:gap-2 min-w-max px-1">
              <button 
                className={`p-2 rounded-lg border-2 transition-all ${player.suitType === 'basic' ? 'border-blue-400 bg-blue-900/40' : 'border-gray-700 bg-gray-800/40'}`}
                onClick={() => {/* Implement suit change logic in App.tsx later */}}
              >
                <div className="text-[10px] font-bold text-white uppercase">Standard</div>
              </button>
              <button 
                className={`p-2 rounded-lg border-2 transition-all ${player.suitType === 'speed' ? 'border-yellow-400 bg-yellow-900/40' : 'border-gray-700 bg-gray-800/40'}`}
                onClick={() => {/* Implement suit change logic in App.tsx later */}}
              >
                <div className="text-[10px] font-bold text-white uppercase">Speed</div>
              </button>
            </div>
            <div className="text-[8px] text-gray-500 uppercase writing-mode-vertical flex items-center justify-center font-bold tracking-widest border-l border-gray-700 pl-1 ml-1 select-none">Suits</div>
          </div>
        ) : (
          /* Build Toolbar */
          <div className="flex gap-1 md:gap-2 bg-gray-900/80 p-1 md:p-2 rounded-2xl border border-gray-600/50 backdrop-blur-xl shadow-2xl w-full md:w-auto overflow-x-auto no-scrollbar justify-start md:justify-start">
            <div className="flex gap-1 md:gap-2 min-w-max px-1">
              {tools.map((type) => (
                <ToolButton
                  key={type}
                  type={type}
                  isSelected={selectedTool === type}
                  onClick={() => onSelectTool(type)}
                  money={stats.money}
                />
              ))}
            </div>
            <div className="text-[8px] text-gray-500 uppercase writing-mode-vertical flex items-center justify-center font-bold tracking-widest border-l border-gray-700 pl-1 ml-1 select-none">Build</div>
          </div>
        )}

        {/* Active Emergencies Feed */}
        <div className="w-full md:w-80 h-32 md:h-48 bg-black/80 text-white rounded-xl border border-gray-700/80 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden relative">
          <div className="bg-gray-800/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-300 border-b border-gray-600 flex justify-between items-center">
            <span>Active Threats</span>
            <span className={`w-1.5 h-1.5 rounded-full ${activeEmergencies.length > 0 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
          </div>
          
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-30 z-20"></div>
          
          <div className="flex-1 overflow-y-auto p-2 md:p-3 space-y-2 text-[10px] md:text-xs font-mono scroll-smooth z-10">
            {activeEmergencies.length === 0 && <div className="text-gray-500 italic text-center mt-10">All sectors clear.</div>}
            {activeEmergencies.map((e) => {
              const config = EMERGENCIES[e.type];
              return (
                <div key={e.id} className="border-l-2 pl-2 py-1 bg-gray-900/40 border-red-500 animate-fade-in flex justify-between items-center">
                  <div>
                    <span className="font-bold" style={{ color: config.color }}>{config.name}</span>
                    <p className="text-[8px] text-gray-400">Sector {e.x}, {e.y} | Severity {e.severity}</p>
                  </div>
                  <div className="text-right">
                    <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${e.progress}%` }}></div>
                    </div>
                    <span className="text-[8px] text-blue-300">{e.progress}% Resolved</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
      
      {/* Credits */}
      <div className="absolute bottom-1 right-2 md:right-4 text-[8px] md:text-[9px] text-white/30 font-mono text-right pointer-events-auto hover:text-white/60 transition-colors">
        <a href="https://x.com/ammaar" target="_blank" rel="noreferrer">Created by @ammaar</a>
      </div>
    </div>
  );
};

export default UIOverlay;