/**
 * Boss Gauntlet System — multi-wave boss encounters on specific dungeon floors.
 *
 * Gauntlet triggers:
 *  - Regular dungeons: floor at 50% of total floors => 2-wave mini-boss gauntlet
 *  - Boss Rush: every 3rd floor => 3-wave gauntlet
 *  - Destiny Tower: every 10th floor => 2-wave gauntlet
 */

import { DUNGEONS, getDungeonFloorEnemies, DungeonDef } from "./dungeon-data";
import { SPECIES } from "./pokemon-data";

// ── Interfaces ──

export interface BossWave {
  bossSpecies: string;   // species ID (key in SPECIES record)
  level: number;         // boss level
  hpMultiplier: number;  // multiplier applied to boss HP/stats
  /** If > 1, multiple bosses spawn in this wave (each at this multiplier) */
  count?: number;
}

export interface GauntletConfig {
  waves: BossWave[];
  restBetweenWaves: boolean;
  rewardPerWave: number; // gold reward per wave cleared
}

export interface GauntletReward {
  gold: number;
  exp: number;
  item?: string; // item ID from ITEM_DB
}

// ── Gauntlet reward items pool ──

const GAUNTLET_REWARD_ITEMS: string[] = [
  "sitrusBerry",
  "reviveSeed",
  "oranBerry",
  "maxElixir",
  "xAttack",
  "xDefend",
  "blazeSeed",
];

// ── Core Functions ──

/**
 * Determine whether a gauntlet should trigger on the given floor.
 *
 * Rules:
 *  - Regular dungeons: floor === Math.floor(totalFloors * 0.5) and totalFloors >= 6
 *  - Boss Rush ("bossRush"): every 3rd floor (floor % 3 === 0)
 *  - Destiny Tower ("destinyTower"): every 10th floor (floor % 10 === 0)
 *  - Endless Dungeon / Daily Dungeon: no gauntlet (they have their own mini-boss system)
 *  - Skip final floor (that already has the dungeon boss)
 */
export function shouldTriggerGauntlet(
  floor: number,
  dungeonId: string,
  totalFloors: number,
): boolean {
  // No gauntlet on floor 1
  if (floor <= 1) return false;

  // No gauntlet on the final floor (regular boss lives there)
  if (floor >= totalFloors && dungeonId !== "bossRush") return false;

  // Skip endless / daily — they have their own systems
  if (dungeonId === "endlessDungeon" || dungeonId === "dailyDungeon") return false;

  // Boss Rush: every 3rd floor
  if (dungeonId === "bossRush") {
    return floor % 3 === 0;
  }

  // Destiny Tower: every 10th floor
  if (dungeonId === "destinyTower") {
    return floor % 10 === 0;
  }

  // Regular dungeons: 50% floor, but only if dungeon has >= 6 floors
  if (totalFloors >= 6) {
    const midFloor = Math.floor(totalFloors * 0.5);
    return floor === midFloor;
  }

  return false;
}

/**
 * Generate a GauntletConfig for the given floor.
 *
 * Wave scaling:
 *  - Wave 1: 1 boss at 1.5x normal stats
 *  - Wave 2: either 1 boss at 2.0x or 2 bosses at 1.0x (50/50 variety)
 *  - Wave 3 (boss rush only): 1 elite boss at 3.0x
 */
export function generateGauntlet(
  floor: number,
  dungeonId: string,
  difficulty: number,
): GauntletConfig {
  const dungeon = DUNGEONS[dungeonId];
  const isBossRush = dungeonId === "bossRush";
  const isDestinyTower = dungeonId === "destinyTower";

  // Determine the number of waves
  const waveCount = isBossRush ? 3 : 2;

  // Pick boss species from the dungeon's enemy pool (scaled up)
  const pool = getGauntletSpeciesPool(dungeonId, floor);

  const waves: BossWave[] = [];
  const baseLevel = Math.floor(2 + floor + difficulty * 2);

  // Wave 1: 1 boss at 1.5x
  waves.push({
    bossSpecies: pickRandom(pool),
    level: baseLevel,
    hpMultiplier: 1.5,
    count: 1,
  });

  // Wave 2: variety — 50% chance of 2 bosses at 1.0x, otherwise 1 boss at 2.0x
  if (Math.random() < 0.5) {
    waves.push({
      bossSpecies: pickRandom(pool),
      level: baseLevel + 1,
      hpMultiplier: 1.0,
      count: 2,
    });
  } else {
    waves.push({
      bossSpecies: pickRandom(pool),
      level: baseLevel + 1,
      hpMultiplier: 2.0,
      count: 1,
    });
  }

  // Wave 3 (boss rush only): 1 elite boss at 3.0x
  if (isBossRush) {
    waves.push({
      bossSpecies: pickRandom(pool),
      level: baseLevel + 3,
      hpMultiplier: 3.0,
      count: 1,
    });
  }

  // restBetweenWaves — Destiny Tower is more brutal: no rest
  const restBetweenWaves = !isDestinyTower;

  // rewardPerWave scales with difficulty and floor
  const rewardPerWave = Math.floor(30 * difficulty * (1 + floor * 0.1));

  return {
    waves,
    restBetweenWaves,
    rewardPerWave,
  };
}

/**
 * Calculate total gauntlet rewards based on waves cleared.
 */
export function getGauntletReward(
  config: GauntletConfig,
  wavesCleared: number,
): GauntletReward {
  const gold = config.rewardPerWave * wavesCleared;
  const exp = Math.floor(gold * 0.8); // exp roughly proportional to gold

  // Bonus item if all waves cleared
  let item: string | undefined;
  if (wavesCleared >= config.waves.length) {
    item = GAUNTLET_REWARD_ITEMS[Math.floor(Math.random() * GAUNTLET_REWARD_ITEMS.length)];
  }

  return { gold, exp, item };
}

// ── Internal Helpers ──

/**
 * Get species pool for gauntlet bosses from the dungeon's enemy pool.
 * Falls back to all species if the dungeon has no enemy pool.
 */
function getGauntletSpeciesPool(dungeonId: string, floor: number): string[] {
  const dungeon = DUNGEONS[dungeonId];
  if (!dungeon) return Object.keys(SPECIES);

  // Try floor-specific enemies first, then general pool
  const floorEnemies = getDungeonFloorEnemies(dungeon, floor);
  if (floorEnemies.length > 0) {
    // Filter to only species that actually exist in SPECIES
    const valid = floorEnemies.filter(id => SPECIES[id]);
    if (valid.length > 0) return valid;
  }

  // Fallback: use dungeon's full enemy species list
  if (dungeon.enemySpeciesIds.length > 0) {
    const valid = dungeon.enemySpeciesIds.filter(id => SPECIES[id]);
    if (valid.length > 0) return valid;
  }

  // Last resort: all species
  return Object.keys(SPECIES);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
