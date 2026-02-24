/**
 * Puzzle Room System — Phase 275
 *
 * Special rooms that appear in dungeons containing interactive puzzles.
 * Solving them grants gold, EXP, and item rewards.
 *
 * Puzzle Types:
 *   TileSequence  — Step on highlighted tiles in order
 *   SwitchOrder   — Activate colored switches in the correct order
 *   MemoryMatch   — Reproduce a flashing tile pattern
 *   EnemyRush     — Defeat all enemies within a turn limit
 *   ItemSacrifice — Drop any item on the altar tile
 */

// ── Enums & Interfaces ──

export enum PuzzleType {
  TileSequence = "tileSequence",
  SwitchOrder = "switchOrder",
  MemoryMatch = "memoryMatch",
  EnemyRush = "enemyRush",
  ItemSacrifice = "itemSacrifice",
}

export interface PuzzleReward {
  gold: number;
  exp: number;
  items: string[];
}

export interface PuzzleRoom {
  type: PuzzleType;
  description: string;
  difficulty: number;       // 1-3 scale
  reward: PuzzleReward;
  solved: boolean;
  timeLimit?: number;       // turns (EnemyRush only)
}

// ── Puzzle Descriptions ──

const PUZZLE_DESCRIPTIONS: Record<PuzzleType, string> = {
  [PuzzleType.TileSequence]: "Step on the glowing tiles in the correct order!",
  [PuzzleType.SwitchOrder]: "Activate the colored switches in the right sequence!",
  [PuzzleType.MemoryMatch]: "Watch the pattern, then reproduce it!",
  [PuzzleType.EnemyRush]: "Defeat all enemies before time runs out!",
  [PuzzleType.ItemSacrifice]: "Place an offering on the altar!",
};

// ── Reward Item Pools ──

const EARLY_REWARD_ITEMS = ["oranBerry", "apple", "pechaberry"];
const MID_REWARD_ITEMS = ["sitrusBerry", "maxElixir", "reviveSeed", "bigApple"];
const LATE_REWARD_ITEMS = ["allPowerOrb", "luminousOrb", "escapeOrb"];

function getRewardItemPool(floor: number): string[] {
  if (floor <= 5) return EARLY_REWARD_ITEMS;
  if (floor <= 12) return [...EARLY_REWARD_ITEMS, ...MID_REWARD_ITEMS];
  return [...MID_REWARD_ITEMS, ...LATE_REWARD_ITEMS];
}

// ── Puzzle Generation ──

/** All puzzle types equally weighted */
const ALL_TYPES = [
  PuzzleType.TileSequence,
  PuzzleType.SwitchOrder,
  PuzzleType.MemoryMatch,
  PuzzleType.EnemyRush,
  PuzzleType.ItemSacrifice,
];

/**
 * Determine whether a puzzle room should spawn on this floor.
 * - 10% chance per floor
 * - Never on floor 1 or the last floor
 */
export function shouldSpawnPuzzle(floor: number, totalFloors: number): boolean {
  if (floor <= 1 || floor >= totalFloors) return false;
  return Math.random() < 0.10;
}

/**
 * Generate a random puzzle appropriate for the given floor depth.
 */
export function generatePuzzle(floor: number, difficulty: number): PuzzleRoom {
  const type = ALL_TYPES[Math.floor(Math.random() * ALL_TYPES.length)];

  // Puzzle difficulty scales with floor: 1 (easy), 2 (medium), 3 (hard)
  const puzzleDifficulty = floor <= 5 ? 1 : floor <= 12 ? 2 : 3;

  const reward = buildReward(floor, puzzleDifficulty, difficulty);

  const puzzle: PuzzleRoom = {
    type,
    description: PUZZLE_DESCRIPTIONS[type],
    difficulty: puzzleDifficulty,
    reward,
    solved: false,
  };

  // EnemyRush gets a turn limit
  if (type === PuzzleType.EnemyRush) {
    puzzle.timeLimit = 15;
  }

  return puzzle;
}

/**
 * Build the reward for a puzzle based on floor and difficulty.
 */
function buildReward(floor: number, puzzleDifficulty: number, dungeonDifficulty: number): PuzzleReward {
  const baseGold = 40 + floor * 8;
  const gold = Math.floor(baseGold * (0.8 + puzzleDifficulty * 0.3) * dungeonDifficulty);

  const baseExp = 20 + floor * 5;
  const exp = Math.floor(baseExp * (0.8 + puzzleDifficulty * 0.3));

  // 1-2 reward items
  const pool = getRewardItemPool(floor);
  const itemCount = puzzleDifficulty >= 2 ? 2 : 1;
  const items: string[] = [];
  for (let i = 0; i < itemCount; i++) {
    items.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  return { gold, exp, items };
}

/**
 * Get the reward for a solved puzzle. Returns the puzzle's reward object.
 */
export function getPuzzleReward(puzzle: PuzzleRoom): PuzzleReward {
  return puzzle.reward;
}

// ── Puzzle Tile Helpers ──

/**
 * Generate tile positions for TileSequence / SwitchOrder / MemoryMatch puzzles.
 * Returns an array of {x, y} positions within the given room bounds.
 */
export function generatePuzzleTiles(
  roomX: number, roomY: number, roomW: number, roomH: number,
  count: number
): { x: number; y: number }[] {
  const tiles: { x: number; y: number }[] = [];
  const usedKeys = new Set<string>();

  // Place tiles in the interior of the room (1-tile margin)
  const minX = roomX + 1;
  const maxX = roomX + roomW - 2;
  const minY = roomY + 1;
  const maxY = roomY + roomH - 2;

  let attempts = 0;
  while (tiles.length < count && attempts < 50) {
    const x = minX + Math.floor(Math.random() * Math.max(1, maxX - minX + 1));
    const y = minY + Math.floor(Math.random() * Math.max(1, maxY - minY + 1));
    const key = `${x},${y}`;
    if (!usedKeys.has(key)) {
      usedKeys.add(key);
      tiles.push({ x, y });
    }
    attempts++;
  }

  return tiles;
}

/**
 * Get the number of puzzle tiles based on puzzle type and difficulty.
 */
export function getPuzzleTileCount(type: PuzzleType, difficulty: number): number {
  switch (type) {
    case PuzzleType.TileSequence:
      return 3 + Math.min(2, difficulty - 1); // 3-5
    case PuzzleType.SwitchOrder:
      return 3; // always 3 switches
    case PuzzleType.MemoryMatch:
      return 4 + Math.min(2, difficulty - 1); // 4-6
    case PuzzleType.EnemyRush:
      return 4 + Math.min(2, difficulty - 1); // 4-6 enemies
    case PuzzleType.ItemSacrifice:
      return 1; // single altar tile
    default:
      return 3;
  }
}

/**
 * Switch colors for SwitchOrder puzzle.
 */
export const SWITCH_COLORS = [0xff4444, 0x4488ff, 0xffcc00] as const; // red, blue, yellow
export const SWITCH_LABELS = ["Red", "Blue", "Yellow"] as const;
