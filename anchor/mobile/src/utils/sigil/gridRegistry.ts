import { PlanetaryTier } from '@/types';

export interface GridConfig {
  tierName: string;
  size: number;
  coords: Record<number, { x: number; y: number }>;
  constant: number;
  maxValue: number;
}

export const GRID_REGISTRY: Record<PlanetaryTier, GridConfig> = {
  [PlanetaryTier.SATURN]: {
    tierName: "Saturn",
    size: 3,
    coords: {
      1: { x: 20, y: 20 }, 2: { x: 50, y: 20 }, 3: { x: 80, y: 20 },
      4: { x: 20, y: 50 }, 5: { x: 50, y: 50 }, 6: { x: 80, y: 50 },
      7: { x: 20, y: 80 }, 8: { x: 50, y: 80 }, 9: { x: 80, y: 80 }
    },
    constant: 15,
    maxValue: 9
  },
  [PlanetaryTier.JUPITER]: {
    tierName: "Jupiter",
    size: 4,
    coords: {
      1: { x: 20, y: 20 }, 2: { x: 40, y: 20 }, 3: { x: 60, y: 20 }, 4: { x: 80, y: 20 },
      5: { x: 20, y: 40 }, 6: { x: 40, y: 40 }, 7: { x: 60, y: 40 }, 8: { x: 80, y: 40 },
      9: { x: 20, y: 60 }, 10: { x: 40, y: 60 }, 11: { x: 60, y: 60 }, 12: { x: 80, y: 60 },
      13: { x: 20, y: 80 }, 14: { x: 40, y: 80 }, 15: { x: 60, y: 80 }, 16: { x: 80, y: 80 }
    },
    constant: 34,
    maxValue: 16
  },
  [PlanetaryTier.MARS]: {
    tierName: "Mars",
    size: 5,
    coords: {
      1: { x: 20, y: 20 }, 2: { x: 35, y: 20 }, 3: { x: 50, y: 20 }, 4: { x: 65, y: 20 }, 5: { x: 80, y: 20 },
      6: { x: 20, y: 35 }, 7: { x: 35, y: 35 }, 8: { x: 50, y: 35 }, 9: { x: 65, y: 35 }, 10: { x: 80, y: 35 },
      11: { x: 20, y: 50 }, 12: { x: 35, y: 50 }, 13: { x: 50, y: 50 }, 14: { x: 65, y: 50 }, 15: { x: 80, y: 50 },
      16: { x: 20, y: 65 }, 17: { x: 35, y: 65 }, 18: { x: 50, y: 65 }, 19: { x: 65, y: 65 }, 20: { x: 80, y: 65 },
      21: { x: 20, y: 80 }, 22: { x: 35, y: 80 }, 23: { x: 50, y: 80 }, 24: { x: 65, y: 80 }, 25: { x: 80, y: 80 }
    },
    constant: 65,
    maxValue: 25
  },
  [PlanetaryTier.SUN]: {
    tierName: "Sun",
    size: 6,
    coords: {
      1: { x: 20, y: 20 }, 2: { x: 32, y: 20 }, 3: { x: 44, y: 20 }, 4: { x: 56, y: 20 }, 5: { x: 68, y: 20 }, 6: { x: 80, y: 20 },
      7: { x: 20, y: 32 }, 8: { x: 32, y: 32 }, 9: { x: 44, y: 32 }, 10: { x: 56, y: 32 }, 11: { x: 68, y: 32 }, 12: { x: 80, y: 32 },
      13: { x: 20, y: 44 }, 14: { x: 32, y: 44 }, 15: { x: 44, y: 44 }, 16: { x: 56, y: 44 }, 17: { x: 68, y: 44 }, 18: { x: 80, y: 44 },
      19: { x: 20, y: 56 }, 20: { x: 32, y: 56 }, 21: { x: 44, y: 56 }, 22: { x: 56, y: 56 }, 23: { x: 68, y: 56 }, 24: { x: 80, y: 56 },
      25: { x: 20, y: 68 }, 26: { x: 32, y: 68 }, 27: { x: 44, y: 68 }, 28: { x: 56, y: 68 }, 29: { x: 68, y: 68 }, 30: { x: 80, y: 68 },
      31: { x: 20, y: 80 }, 32: { x: 32, y: 80 }, 33: { x: 44, y: 80 }, 34: { x: 56, y: 80 }, 35: { x: 68, y: 80 }, 36: { x: 80, y: 80 }
    },
    constant: 111,
    maxValue: 36
  },
  [PlanetaryTier.VENUS]: {
    tierName: "Venus",
    size: 7,
    coords: {
      1: { x: 20, y: 20 }, 2: { x: 30, y: 20 }, 3: { x: 40, y: 20 }, 4: { x: 50, y: 20 }, 5: { x: 60, y: 20 }, 6: { x: 70, y: 20 }, 7: { x: 80, y: 20 },
      8: { x: 20, y: 30 }, 9: { x: 30, y: 30 }, 10: { x: 40, y: 30 }, 11: { x: 50, y: 30 }, 12: { x: 60, y: 30 }, 13: { x: 70, y: 30 }, 14: { x: 80, y: 30 },
      15: { x: 20, y: 40 }, 16: { x: 30, y: 40 }, 17: { x: 40, y: 40 }, 18: { x: 50, y: 40 }, 19: { x: 60, y: 40 }, 20: { x: 70, y: 40 }, 21: { x: 80, y: 40 },
      22: { x: 20, y: 50 }, 23: { x: 30, y: 50 }, 24: { x: 40, y: 50 }, 25: { x: 50, y: 50 }, 26: { x: 60, y: 50 }, 27: { x: 70, y: 50 }, 28: { x: 80, y: 50 },
      29: { x: 20, y: 60 }, 30: { x: 30, y: 60 }, 31: { x: 40, y: 60 }, 32: { x: 50, y: 60 }, 33: { x: 60, y: 60 }, 34: { x: 70, y: 60 }, 35: { x: 80, y: 60 },
      36: { x: 20, y: 70 }, 37: { x: 30, y: 70 }, 38: { x: 40, y: 70 }, 39: { x: 50, y: 70 }, 40: { x: 60, y: 70 }, 41: { x: 70, y: 70 }, 42: { x: 80, y: 70 },
      43: { x: 20, y: 80 }, 44: { x: 30, y: 80 }, 45: { x: 40, y: 80 }, 46: { x: 50, y: 80 }, 47: { x: 60, y: 80 }, 48: { x: 70, y: 80 }, 49: { x: 80, y: 80 }
    },
    constant: 175,
    maxValue: 49
  }
};

export function getGridConfig(tier: PlanetaryTier): GridConfig {
  return GRID_REGISTRY[tier];
}
