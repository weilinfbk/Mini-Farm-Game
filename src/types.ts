
export type WeatherType = '晴朗' | '雨天' | '暴风雨' | '干旱';

export interface CropType {
  id: string;
  name: string;
  growthTime: number; // in seconds
  basePrice: number;
  seedPrice: number;
  minLevel: number;
  icon: string;
}

export interface PlayerCrop {
  id: string;
  cropId: string;
  plantedAt: number;
  wateredAt: number;
  stage: number; // 0: Seed, 1: Sprout, 2: Growing, 3: Mature
  isDead: boolean;
}

export interface FishType {
  id: string;
  name: string;
  basePrice: number;
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
}

export interface Player {
  id: string;
  name: string;
  gold: number;
  harvestCount: number;
  level: number;
  exp: number;
  inventory: Record<string, number>; // cropId or fishId -> count
  plots: (PlayerCrop | null)[];
  tools: {
    wateringCan: number; // level
    hoe: number;
    scythe: number;
    farm: number; // farm size level
    fishingRod: number; // fishing rod level
  };
}

export interface GameState {
  weather: WeatherType;
  marketPrices: Record<string, number>;
  leaderboard: { name: string; harvests: number }[];
}
