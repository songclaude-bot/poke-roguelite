/**
 * Dungeon Mutation System — per-floor random mutations that alter gameplay each run.
 *
 * Unlike DungeonModifiers (applied once to the whole run), mutations are rolled
 * independently for each floor, making every floor feel unique.
 */

export enum MutationType {
  GiantEnemies = "giantEnemies",
  TinyDungeon = "tinyDungeon",
  DarkFloor = "darkFloor",
  GoldenAge = "goldenAge",
  ItemRain = "itemRain",
  EnemySwarm = "enemySwarm",
  FastEnemies = "fastEnemies",
  RegenFloor = "regenFloor",
  CursedFloor = "cursedFloor",
  TypeShift = "typeShift",
  MirrorWorld = "mirrorWorld",
  TreasureFloor = "treasureFloor",
}

export interface DungeonMutation {
  type: MutationType;
  name: string;
  description: string;
  icon: string;
  isPositive: boolean;
  color: number;
}

/** Full mutation definitions table */
const MUTATION_DEFS: Record<MutationType, DungeonMutation> = {
  [MutationType.GiantEnemies]: {
    type: MutationType.GiantEnemies,
    name: "Giant Enemies",
    description: "Enemies are 1.5x larger with +30% HP",
    icon: "\u{1F9CC}",          // troll emoji – big creature
    isPositive: false,
    color: 0xef4444,
  },
  [MutationType.TinyDungeon]: {
    type: MutationType.TinyDungeon,
    name: "Tiny Dungeon",
    description: "Rooms and corridors are smaller",
    icon: "\u{1F30D}",          // globe
    isPositive: true,
    color: 0x60a5fa,
  },
  [MutationType.DarkFloor]: {
    type: MutationType.DarkFloor,
    name: "Dark Floor",
    description: "Sight range reduced to 2 tiles",
    icon: "\u{1F311}",          // new moon
    isPositive: false,
    color: 0x6b21a8,
  },
  [MutationType.GoldenAge]: {
    type: MutationType.GoldenAge,
    name: "Golden Age",
    description: "2x gold drops from all sources",
    icon: "\u{1F4B0}",          // money bag
    isPositive: true,
    color: 0xfbbf24,
  },
  [MutationType.ItemRain]: {
    type: MutationType.ItemRain,
    name: "Item Rain",
    description: "50% more items spawn on each floor",
    icon: "\u{1F381}",          // gift
    isPositive: true,
    color: 0x4ade80,
  },
  [MutationType.EnemySwarm]: {
    type: MutationType.EnemySwarm,
    name: "Enemy Swarm",
    description: "50% more enemies per floor",
    icon: "\u{1F41B}",          // bug
    isPositive: false,
    color: 0xdc2626,
  },
  [MutationType.FastEnemies]: {
    type: MutationType.FastEnemies,
    name: "Fast Enemies",
    description: "Enemies have 20% chance of double-move",
    icon: "\u{26A1}",           // lightning
    isPositive: false,
    color: 0xf97316,
  },
  [MutationType.RegenFloor]: {
    type: MutationType.RegenFloor,
    name: "Regen Floor",
    description: "Regenerate 1 HP every 3 turns",
    icon: "\u{1F49A}",          // green heart
    isPositive: true,
    color: 0x22c55e,
  },
  [MutationType.CursedFloor]: {
    type: MutationType.CursedFloor,
    name: "Cursed Floor",
    description: "Lose 1 HP every 10 turns",
    icon: "\u{1F480}",          // skull
    isPositive: false,
    color: 0x991b1b,
  },
  [MutationType.TypeShift]: {
    type: MutationType.TypeShift,
    name: "Type Shift",
    description: "All enemies change to a random type",
    icon: "\u{1F300}",          // cyclone
    isPositive: false,
    color: 0xa855f7,
  },
  [MutationType.MirrorWorld]: {
    type: MutationType.MirrorWorld,
    name: "Mirror World",
    description: "Player and enemy ATK/DEF are swapped",
    icon: "\u{1FA9E}",          // mirror
    isPositive: false,
    color: 0x818cf8,
  },
  [MutationType.TreasureFloor]: {
    type: MutationType.TreasureFloor,
    name: "Treasure Floor",
    description: "Rare items appear but enemies +50% stronger",
    icon: "\u{1F48E}",          // gem
    isPositive: false,
    color: 0xfde68a,
  },
};

/** Pairs of mutation types that cannot appear together on the same floor */
const EXCLUSIVE_PAIRS: [MutationType, MutationType][] = [
  [MutationType.GoldenAge, MutationType.CursedFloor],
  [MutationType.RegenFloor, MutationType.CursedFloor],
  [MutationType.ItemRain, MutationType.EnemySwarm],       // too polarised
  [MutationType.TinyDungeon, MutationType.EnemySwarm],    // cramped + extra enemies = unfair
];

/**
 * Numeric effects table (multipliers / values) for each mutation.
 * Access via `getMutationEffect(type, key)`.
 */
const MUTATION_EFFECTS: Record<MutationType, Record<string, number>> = {
  [MutationType.GiantEnemies]: { enemySpriteScale: 1.5, enemyHpMult: 1.3 },
  [MutationType.TinyDungeon]: {},                                     // handled by dungeon generator flag
  [MutationType.DarkFloor]:   { sightRadius: 2 },
  [MutationType.GoldenAge]:   { goldMult: 2.0 },
  [MutationType.ItemRain]:    { itemMult: 1.5 },
  [MutationType.EnemySwarm]:  { enemyCountMult: 1.5 },
  [MutationType.FastEnemies]: { doubleMoveChance: 0.2 },
  [MutationType.RegenFloor]:  { regenInterval: 3, regenAmount: 1 },
  [MutationType.CursedFloor]: { curseInterval: 10, curseDamage: 1 },
  [MutationType.TypeShift]:   {},                                     // type chosen at runtime
  [MutationType.MirrorWorld]: {},                                     // swap at floor init
  [MutationType.TreasureFloor]: { enemyAtkMult: 1.5, enemyHpMult: 1.5, extraRareItems: 3 },
};

/** Look up the full definition for a mutation type */
export function getMutationDef(type: MutationType): DungeonMutation {
  return MUTATION_DEFS[type];
}

/**
 * Get a single numeric effect value for a mutation.
 * Returns `0` if the key does not exist for that mutation.
 */
export function getMutationEffect(type: MutationType, key: string): number {
  return MUTATION_EFFECTS[type]?.[key] ?? 0;
}

/** Check whether two mutation types are mutually exclusive */
function areExclusive(a: MutationType, b: MutationType): boolean {
  return EXCLUSIVE_PAIRS.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a),
  );
}

/**
 * Roll random mutations for a given floor.
 *
 * - Each floor has a 20% base chance of getting any mutation.
 * - A floor can receive up to 2 mutations.
 * - Mutually exclusive pairs are enforced.
 */
export function rollMutations(floor: number, _dungeonId: string): DungeonMutation[] {
  // 80% chance: no mutations this floor
  if (Math.random() > 0.20) return [];

  // Decide count: 70% = 1, 30% = 2
  const maxCount = Math.random() < 0.70 ? 1 : 2;

  const allTypes = Object.values(MutationType);
  const pool = [...allTypes];
  const selected: DungeonMutation[] = [];

  for (let i = 0; i < maxCount && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const chosen = pool[idx];

    // Remove chosen from pool
    pool.splice(idx, 1);

    // Remove any exclusive partners from the pool
    for (let j = pool.length - 1; j >= 0; j--) {
      if (areExclusive(chosen, pool[j])) {
        pool.splice(j, 1);
      }
    }

    selected.push(getMutationDef(chosen));
  }

  return selected;
}

/** Check whether a specific mutation type is active in a list */
export function hasMutation(mutations: DungeonMutation[], type: MutationType): boolean {
  return mutations.some(m => m.type === type);
}

/** Convenience: return the hex color string for a mutation (for Phaser text styling) */
export function mutationColorHex(m: DungeonMutation): string {
  return `#${m.color.toString(16).padStart(6, "0")}`;
}
