/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { AIGoal, BuildingType, CityStats, Grid, NewsItem, Emergency } from "../types";
import { BUILDINGS } from "../constants";

// --- Local Goal Generation (Replacing AI) ---

const VIGILANTE_GOAL_TEMPLATES = [
  { id: 'save_people', description: "Citizens are in danger! Resolve {target} emergencies to restore order.", type: 'emergency_resolved', base: 3, step: 5 },
  { id: 'hero_rep', description: "The city needs a symbol of hope. Reach {target} Reputation points.", type: 'reputation', base: 100, step: 200 },
  { id: 'population_safety', description: "Ensure the safety of our growing population. Protect {target} citizens.", type: 'population', base: 50, step: 100 },
];

export const generateVigilanteGoal = async (stats: CityStats, emergencies: Emergency[]): Promise<AIGoal | null> => {
  const template = VIGILANTE_GOAL_TEMPLATES[Math.floor(Math.random() * VIGILANTE_GOAL_TEMPLATES.length)];
  
  let targetValue = 0;
  if (template.type === 'emergency_resolved') {
    const resolvedCount = emergencies.filter(e => !e.active && e.progress === 100).length;
    targetValue = resolvedCount + template.base + Math.floor(Math.random() * template.step);
  } else if (template.type === 'reputation') {
    targetValue = stats.reputation + template.base + Math.floor(Math.random() * template.step);
  } else if (template.type === 'population') {
    targetValue = stats.population + template.base + Math.floor(Math.random() * template.step);
  }

  return {
    id: Date.now().toString(),
    description: template.description.replace("{target}", targetValue.toString()),
    targetType: template.type as any,
    targetValue,
    reward: 500 + Math.floor(Math.random() * 1000),
    completed: false
  };
};

export const generateCityGoal = async (stats: CityStats, grid: Grid): Promise<AIGoal | null> => {
  const templates = [
    { description: "Grow the population to {target} citizens.", type: 'population', base: 50, step: 100 },
    { description: "Increase city treasury to ${target}.", type: 'money', base: 1000, step: 2000 },
  ];
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  let targetValue = 0;
  if (template.type === 'population') {
    targetValue = stats.population + template.base + Math.floor(Math.random() * template.step);
  } else if (template.type === 'money') {
    targetValue = stats.money + template.base + Math.floor(Math.random() * template.step);
  }

  return {
    id: Math.random().toString(36).substr(2, 9),
    description: template.description.replace("{target}", targetValue.toString()),
    targetType: template.type as any,
    targetValue,
    reward: 500 + Math.floor(Math.random() * 1000),
    completed: false
  };
};

// --- Local News Feed Generation (Replacing AI) ---

const NEWS_TEMPLATES = [
  { text: "Local cat stuck in tree; fire department busy with city planning instead.", type: 'neutral' },
  { text: "New park opens; citizens report 5% increase in happiness and 10% increase in bird sightings.", type: 'positive' },
  { text: "Traffic congestion at peak hours; Mayor suggests everyone just 'walk faster'.", type: 'neutral' },
  { text: "Industrial sector reports record profits; sky turns slightly more 'neon' than usual.", type: 'positive' },
  { text: "Residential property values on the rise; young professionals looking for smaller boxes.", type: 'neutral' },
  { text: "Mysterious glowing orb spotted over the industrial district; 'It's just a weather balloon', says official.", type: 'neutral' },
  { text: "City treasury reports surplus; citizens wonder where the gold-plated statues are.", type: 'positive' },
  { text: "Commercial district holds annual 'Buy Everything' sale; economy stimulated.", type: 'positive' },
  { text: "Pothole in sector 7 becomes local tourist attraction; named 'The Abyss'.", type: 'negative' },
  { text: "Local genius invents 'Self-Driving Road'; road remains stationary, cars still needed.", type: 'neutral' },
];

export const generateNewsEvent = async (stats: CityStats, recentAction: string | null): Promise<NewsItem | null> => {
  const template = NEWS_TEMPLATES[Math.floor(Math.random() * NEWS_TEMPLATES.length)];
  
  return {
    id: Date.now().toString() + Math.random(),
    text: template.text,
    type: template.type as any,
  };
};
