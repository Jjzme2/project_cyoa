import { WorldState } from './goap';

export interface ProcGenSeed {
  worldSeed: number;
  storySalt: string;
  nodeSalt: string;
}

export type Biome = 'forest' | 'desert' | 'mountains' | 'swamp' | 'tundra' | 'coast' | 'caverns' | 'plains' | 'volcanic' | 'ruins';
export type Weather = 'clear' | 'rain' | 'storm' | 'fog' | 'snow' | 'heatwave' | 'aurora';
export type TimeOfDay = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk' | 'evening' | 'midnight' | 'deepnight';

export interface Landmark {
  name: string;
  description: string;
  type: string;
}

export interface GeneratedEnvironment {
  biome: Biome;
  weather: Weather;
  timeOfDay: TimeOfDay;
  landmarks: Landmark[];
  ambientDescription: string;
}

export interface EncounterEntry {
  id: string;
  description: string;
  weight: number;
  preconditions: Partial<WorldState>;
  effects: Partial<WorldState>;
  narrativeHook: string;
}

export interface EncounterTable {
  entries: EncounterEntry[];
  totalWeight: number;
}

export interface ProcGenQuest {
  id: string;
  giverId: string;
  type: 'fetch' | 'kill' | 'escort' | 'explore' | 'deliver';
  target: string;
  rewardText: string;
  narrativePrompt: string;
}
