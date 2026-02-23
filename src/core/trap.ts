/**
 * Trap system — hidden traps on dungeon floors.
 * Stepping on a trap triggers its effect.
 */

export enum TrapType {
  Spike = "spike",        // 15 fixed damage
  Poison = "poison",      // Inflict poison status
  Slow = "slow",          // Paralyze for 3 turns
  Warp = "warp",          // Teleport to random tile
  Spin = "spin",          // Confusion (random movement for 3 turns)
  Sticky = "sticky",      // Lose a random item
  Hunger = "hunger",      // Drain 20 belly
}

export interface TrapDef {
  type: TrapType;
  name: string;
  symbol: string;
  color: string;
  description: string;
}

export const TRAPS: Record<TrapType, TrapDef> = {
  [TrapType.Spike]: {
    type: TrapType.Spike,
    name: "Spike Trap",
    symbol: "▲",
    color: "#ef4444",
    description: "Deals 15 damage!",
  },
  [TrapType.Poison]: {
    type: TrapType.Poison,
    name: "Poison Trap",
    symbol: "☠",
    color: "#a855f7",
    description: "Inflicts poison!",
  },
  [TrapType.Slow]: {
    type: TrapType.Slow,
    name: "Slow Trap",
    symbol: "◎",
    color: "#fbbf24",
    description: "Paralyzes for 3 turns!",
  },
  [TrapType.Warp]: {
    type: TrapType.Warp,
    name: "Warp Trap",
    symbol: "◈",
    color: "#60a5fa",
    description: "Teleports to a random spot!",
  },
  [TrapType.Spin]: {
    type: TrapType.Spin,
    name: "Spin Trap",
    symbol: "✧",
    color: "#f472b6",
    description: "Causes confusion!",
  },
  [TrapType.Sticky]: {
    type: TrapType.Sticky,
    name: "Sticky Trap",
    symbol: "■",
    color: "#78716c",
    description: "A random item is lost!",
  },
  [TrapType.Hunger]: {
    type: TrapType.Hunger,
    name: "Hunger Trap",
    symbol: "♨",
    color: "#fb923c",
    description: "Drains belly!",
  },
};

/** Roll a random trap type for floor spawning */
export function rollTrap(): TrapDef {
  const types = Object.values(TrapType);
  return TRAPS[types[Math.floor(Math.random() * types.length)]];
}

/** Number of traps per floor (scales with floor) */
export function trapsPerFloor(floor: number): number {
  return Math.min(5, 1 + Math.floor(floor / 2));
}
