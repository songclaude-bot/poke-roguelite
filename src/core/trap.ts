/**
 * Trap system — hidden traps on dungeon floors.
 * Stepping on a trap triggers its effect.
 */

export enum TrapType {
  Spike = "spike",          // 15% max HP damage
  Poison = "poison",        // Inflict Burn status
  Warp = "warp",            // Teleport to random tile
  Spin = "spin",            // Reduce accuracy for 5 turns
  Slowdown = "slowdown",    // Reduce ATK by 10% for rest of floor
  Blast = "blast",          // 25% max HP damage in 3x3 area
  Trip = "trip",            // Drop a random item from inventory
  Seal = "seal",            // Disable a random skill for 10 turns
}

export interface TrapDef {
  type: TrapType;
  name: string;
  symbol: string;
  color: string;
  hexColor: number;  // Phaser hex color for graphics drawing
  description: string;
}

export const TRAPS: Record<TrapType, TrapDef> = {
  [TrapType.Spike]: {
    type: TrapType.Spike,
    name: "Spike Trap",
    symbol: "▲",
    color: "#ef4444",
    hexColor: 0xef4444,
    description: "Deals damage!",
  },
  [TrapType.Poison]: {
    type: TrapType.Poison,
    name: "Poison Trap",
    symbol: "☠",
    color: "#a855f7",
    hexColor: 0xa855f7,
    description: "Inflicts burn!",
  },
  [TrapType.Warp]: {
    type: TrapType.Warp,
    name: "Warp Trap",
    symbol: "◈",
    color: "#3b82f6",
    hexColor: 0x3b82f6,
    description: "Teleports you!",
  },
  [TrapType.Spin]: {
    type: TrapType.Spin,
    name: "Spin Trap",
    symbol: "✧",
    color: "#fbbf24",
    hexColor: 0xfbbf24,
    description: "Reduces accuracy!",
  },
  [TrapType.Slowdown]: {
    type: TrapType.Slowdown,
    name: "Slowdown Trap",
    symbol: "◎",
    color: "#f97316",
    hexColor: 0xf97316,
    description: "Weakens attack!",
  },
  [TrapType.Blast]: {
    type: TrapType.Blast,
    name: "Blast Trap",
    symbol: "◆",
    color: "#dc2626",
    hexColor: 0xdc2626,
    description: "Area explosion!",
  },
  [TrapType.Trip]: {
    type: TrapType.Trip,
    name: "Trip Trap",
    symbol: "■",
    color: "#78716c",
    hexColor: 0x78716c,
    description: "Drops an item!",
  },
  [TrapType.Seal]: {
    type: TrapType.Seal,
    name: "Seal Trap",
    symbol: "✦",
    color: "#6366f1",
    hexColor: 0x6366f1,
    description: "Seals a skill!",
  },
};

export interface FloorTrap {
  x: number;
  y: number;
  trap: TrapDef;
  revealed: boolean;
  triggered: boolean;
}

/** Roll a random trap type for floor spawning */
export function rollTrap(): TrapDef {
  const types = Object.values(TrapType);
  return TRAPS[types[Math.floor(Math.random() * types.length)]];
}

/** Number of traps per floor (scales with floor and difficulty) */
export function trapsPerFloor(floor: number, difficulty?: number): number {
  const base = Math.min(5, 1 + Math.floor(floor / 2));
  if (difficulty !== undefined) {
    return Math.floor(base + difficulty * 1.5);
  }
  return base;
}

/**
 * Generate traps for a dungeon floor.
 * Avoids stairs, player start, items, and other occupied positions.
 */
export function generateTraps(
  width: number,
  height: number,
  terrain: number[][],
  count: number,
  stairsX: number,
  stairsY: number,
  playerX: number,
  playerY: number,
  occupiedPositions: Set<string>,  // "x,y" strings of occupied tiles
  groundValue: number,             // TerrainType.GROUND value
): FloorTrap[] {
  const traps: FloorTrap[] = [];

  for (let i = 0; i < count; i++) {
    let attempts = 0;
    while (attempts < 50) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);

      if (terrain[y]?.[x] !== groundValue) { attempts++; continue; }
      if (x === stairsX && y === stairsY) { attempts++; continue; }
      if (x === playerX && y === playerY) { attempts++; continue; }
      if (occupiedPositions.has(`${x},${y}`)) { attempts++; continue; }
      if (traps.some(t => t.x === x && t.y === y)) { attempts++; continue; }

      const trap = rollTrap();
      traps.push({
        x,
        y,
        trap,
        revealed: false,
        triggered: false,
      });
      break;
    }
  }

  return traps;
}
