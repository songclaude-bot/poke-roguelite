/**
 * Floor Events — random global effects that apply to an entire dungeon floor.
 * These provide variety and challenge by modifying gameplay rules for one floor.
 * Distinct from tile-based DungeonEvents (dungeon-events.ts) and DungeonMutations.
 */

export enum FloorEventType {
  MonsterHouse = "monsterHouse",        // Already exists — skip implementation
  TreasureFloor = "treasureFloor",      // 2x items, 2x gold drops
  FoggyFloor = "foggyFloor",            // Reduced sight range to 2
  WindyFloor = "windyFloor",            // Random knockback on hit
  GravityFloor = "gravityFloor",        // Flying types lose their flying type advantage
  InverseFloor = "inverseFloor",        // Type effectiveness is reversed
  ZeroIslandFloor = "zeroIslandFloor",  // Level reset to 1 for this floor (stats scaled)
  LuckyFloor = "luckyFloor",            // All enemies drop items
  FamineFloor = "famineFloor",          // No items spawn, belly drains 2x
  WarpFloor = "warpFloor",             // Enemies randomly teleport each turn
}

export interface FloorEvent {
  type: FloorEventType;
  name: string;
  description: string;
  color: number;
  icon: string;
  /** Relative spawn weight (higher = more common). */
  weight: number;
  /** Minimum floor number to appear on. */
  minFloor: number;
  /** Minimum dungeon difficulty to appear on (0 = any). */
  minDifficulty: number;
}

export const FLOOR_EVENTS: Record<FloorEventType, FloorEvent> = {
  [FloorEventType.MonsterHouse]: {
    type: FloorEventType.MonsterHouse,
    name: "Monster House",
    description: "A room packed with hostile Pokemon!",
    color: 0xff4444,
    icon: "\u{1F47E}",  // 👾
    weight: 0,           // handled separately
    minFloor: 1,
    minDifficulty: 0,
  },
  [FloorEventType.TreasureFloor]: {
    type: FloorEventType.TreasureFloor,
    name: "Treasure Floor",
    description: "Items and gold are doubled on this floor!",
    color: 0xfde68a,
    icon: "\u{1F4B0}",  // 💰
    weight: 1.2,
    minFloor: 2,
    minDifficulty: 0,
  },
  [FloorEventType.FoggyFloor]: {
    type: FloorEventType.FoggyFloor,
    name: "Foggy Floor",
    description: "Dense fog limits sight to 2 tiles.",
    color: 0x94a3b8,
    icon: "\u{1F32B}\uFE0F",  // 🌫️
    weight: 1.5,
    minFloor: 3,
    minDifficulty: 0,
  },
  [FloorEventType.WindyFloor]: {
    type: FloorEventType.WindyFloor,
    name: "Windy Floor",
    description: "Attacks cause knockback! Watch your footing.",
    color: 0x7dd3fc,
    icon: "\u{1F4A8}",  // 💨
    weight: 1.0,
    minFloor: 3,
    minDifficulty: 1.0,
  },
  [FloorEventType.GravityFloor]: {
    type: FloorEventType.GravityFloor,
    name: "Gravity Floor",
    description: "Heavy gravity grounds all flying-type advantages.",
    color: 0xa78bfa,
    icon: "\u{2B07}\uFE0F",  // ⬇️
    weight: 0.8,
    minFloor: 4,
    minDifficulty: 1.0,
  },
  [FloorEventType.InverseFloor]: {
    type: FloorEventType.InverseFloor,
    name: "Inverse Floor",
    description: "Type effectiveness is reversed! Super effective becomes weak.",
    color: 0xf472b6,
    icon: "\u{1F503}",  // 🔃
    weight: 0.6,
    minFloor: 5,
    minDifficulty: 2.0,
  },
  [FloorEventType.ZeroIslandFloor]: {
    type: FloorEventType.ZeroIslandFloor,
    name: "Zero Island Floor",
    description: "All levels reset to 1. A true test of skill!",
    color: 0xfbbf24,
    icon: "\u{1F300}",  // 🌀
    weight: 0.3,
    minFloor: 6,
    minDifficulty: 3.0,
  },
  [FloorEventType.LuckyFloor]: {
    type: FloorEventType.LuckyFloor,
    name: "Lucky Floor",
    description: "Every defeated enemy drops an item!",
    color: 0x4ade80,
    icon: "\u{1F340}",  // 🍀
    weight: 0.8,
    minFloor: 2,
    minDifficulty: 0,
  },
  [FloorEventType.FamineFloor]: {
    type: FloorEventType.FamineFloor,
    name: "Famine Floor",
    description: "No items on the floor. Belly drains twice as fast!",
    color: 0xef4444,
    icon: "\u{1F480}",  // 💀
    weight: 0.7,
    minFloor: 4,
    minDifficulty: 1.5,
  },
  [FloorEventType.WarpFloor]: {
    type: FloorEventType.WarpFloor,
    name: "Warp Floor",
    description: "Enemies may teleport randomly each turn!",
    color: 0xc084fc,
    icon: "\u{2728}",  // ✨
    weight: 1.0,
    minFloor: 3,
    minDifficulty: 1.0,
  },
};

/** All rollable floor events (excludes MonsterHouse which is handled separately). */
const ROLLABLE_EVENTS: FloorEvent[] = Object.values(FLOOR_EVENTS).filter(
  e => e.type !== FloorEventType.MonsterHouse && e.weight > 0
);

/**
 * Roll a floor event for the given floor and difficulty.
 * Returns null if no event triggers (70% base chance of no event).
 * @param floor Current dungeon floor number.
 * @param difficulty Dungeon difficulty rating.
 */
export function rollFloorEvent(floor: number, difficulty: number): FloorEvent | null {
  // 70% chance of no event at all
  if (Math.random() < 0.7) return null;

  // Filter eligible events by floor and difficulty requirements
  const candidates = ROLLABLE_EVENTS.filter(
    e => floor >= e.minFloor && difficulty >= e.minDifficulty
  );
  if (candidates.length === 0) return null;

  // Weighted random selection
  const totalWeight = candidates.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const event of candidates) {
    roll -= event.weight;
    if (roll <= 0) return event;
  }
  return candidates[candidates.length - 1]; // fallback
}

/**
 * Invert a type effectiveness multiplier for InverseFloor.
 * super effective (2.0) -> not very effective (0.5)
 * not very effective (0.5) -> super effective (2.0)
 * immune (0) -> super effective (2.0)
 * neutral (1.0) -> neutral (1.0)
 */
export function invertEffectiveness(effectiveness: number): number {
  if (effectiveness === 0) return 2.0;
  if (effectiveness === 1.0) return 1.0;
  return 1.0 / effectiveness;
}

/**
 * Get the hex color string for a floor event (for UI display).
 */
export function floorEventColorHex(event: FloorEvent): string {
  return `#${event.color.toString(16).padStart(6, "0")}`;
}
