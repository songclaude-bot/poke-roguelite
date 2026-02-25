/**
 * Secret Room System — Phase 284
 *
 * Hidden rooms behind fake walls that reward exploration-focused players.
 * 5% chance per floor (minimum floor 3, not last floor).
 *
 * Room Types:
 *   TreasureVault  — 3-5 rare items + gold pile
 *   HealingSpring  — Full HP/PP restore + 10-turn AtkUp+DefUp
 *   SkillShrine    — Learn a random rare skill
 *   TrainingRoom   — Gain 2 level-ups worth of EXP
 *   WarpHub        — Warp to any previously visited floor
 */

// ── Enums & Interfaces ──

export enum SecretRoomType {
  TreasureVault = "treasureVault",
  HealingSpring = "healingSpring",
  SkillShrine = "skillShrine",
  TrainingRoom = "trainingRoom",
  WarpHub = "warpHub",
}

export interface SecretReward {
  /** For TreasureVault: list of item IDs dropped */
  items?: string[];
  /** For TreasureVault: gold amount */
  gold?: number;
  /** For HealingSpring: full HP/PP restore + buff turns */
  healFull?: boolean;
  buffTurns?: number;
  /** For SkillShrine: the skill ID to learn */
  skillId?: string;
  /** For TrainingRoom: total EXP to grant */
  exp?: number;
  /** For WarpHub: allows choosing a floor */
  warpEnabled?: boolean;
}

export interface SecretRoom {
  type: SecretRoomType;
  name: string;
  reward: SecretReward;
  discovered: boolean;
}

// ── Display Names ──

const SECRET_ROOM_NAMES: Record<SecretRoomType, string> = {
  [SecretRoomType.TreasureVault]: "Treasure Vault",
  [SecretRoomType.HealingSpring]: "Healing Spring",
  [SecretRoomType.SkillShrine]: "Skill Shrine",
  [SecretRoomType.TrainingRoom]: "Training Room",
  [SecretRoomType.WarpHub]: "Warp Hub",
};

// ── Item Pools for TreasureVault ──

const EARLY_TREASURE_ITEMS = [
  "oranBerry", "sitrusBerry", "apple", "bigApple", "pechaberry",
  "blastSeed", "maxElixir",
];

const MID_TREASURE_ITEMS = [
  "sitrusBerry", "reviveSeed", "bigApple", "maxElixir", "luminousOrb",
  "xAttack", "xDefend", "megaOranBerry",
];

const LATE_TREASURE_ITEMS = [
  "megaSitrusBerry", "goldenApple", "autoReviver", "megaElixir",
  "megaBlastSeed", "megaXAttack", "megaXDefend", "crystalPebble",
  "meteorRock",
];

function getTreasureItemPool(floor: number): string[] {
  if (floor <= 6) return EARLY_TREASURE_ITEMS;
  if (floor <= 15) return [...EARLY_TREASURE_ITEMS, ...MID_TREASURE_ITEMS];
  return [...MID_TREASURE_ITEMS, ...LATE_TREASURE_ITEMS];
}

// ── Rare Skill Pool for SkillShrine ──

const RARE_SKILL_IDS = [
  "surf", "flamethrower", "thunderbolt", "iceBeam", "shadowBall",
  "focusPunch", "dragonPulse", "earthquake", "psybeam", "swordsDance",
  "ironDefense",
];

// ── Spawn Decision ──

/**
 * Determine whether a secret room should spawn on this floor.
 * - 5% chance per floor
 * - Minimum floor 3
 * - Not on the last floor
 */
export function shouldSpawnSecretRoom(floor: number, totalFloors: number): boolean {
  if (floor < 3) return false;
  if (floor >= totalFloors) return false;
  return Math.random() < 0.05;
}

// ── Generation ──

/** All room types, equally weighted */
const ALL_TYPES: SecretRoomType[] = [
  SecretRoomType.TreasureVault,
  SecretRoomType.HealingSpring,
  SecretRoomType.SkillShrine,
  SecretRoomType.TrainingRoom,
  SecretRoomType.WarpHub,
];

/**
 * Generate a secret room appropriate for the given floor and dungeon difficulty.
 */
export function generateSecretRoom(floor: number, difficulty: number): SecretRoom {
  const type = ALL_TYPES[Math.floor(Math.random() * ALL_TYPES.length)];
  const reward = getSecretRoomReward(type, floor, difficulty);
  return {
    type,
    name: SECRET_ROOM_NAMES[type],
    reward,
    discovered: false,
  };
}

/**
 * Build the reward object for a given secret room type, floor, and difficulty.
 */
export function getSecretRoomReward(
  type: SecretRoomType,
  floor: number,
  difficulty = 1.0,
): SecretReward {
  switch (type) {

    case SecretRoomType.TreasureVault: {
      const pool = getTreasureItemPool(floor);
      const itemCount = 3 + Math.floor(Math.random() * 3); // 3-5 items
      const items: string[] = [];
      for (let i = 0; i < itemCount; i++) {
        items.push(pool[Math.floor(Math.random() * pool.length)]);
      }
      const gold = Math.floor((80 + floor * 15) * difficulty);
      return { items, gold };
    }

    case SecretRoomType.HealingSpring:
      return { healFull: true, buffTurns: 10 };

    case SecretRoomType.SkillShrine: {
      const skillId = RARE_SKILL_IDS[Math.floor(Math.random() * RARE_SKILL_IDS.length)];
      return { skillId };
    }

    case SecretRoomType.TrainingRoom: {
      // Grant 2 level-ups worth of EXP based on player's approximate level
      // Use a formula: EXP = sum of (10 + (level-1)*5) for 2 levels
      // Approximate at floor-based level: level ~ 4 + floor
      const approxLevel = 4 + floor;
      const exp = (10 + (approxLevel - 1) * 5) + (10 + approxLevel * 5);
      return { exp: Math.floor(exp * difficulty) };
    }

    case SecretRoomType.WarpHub:
      return { warpEnabled: true };

    default:
      return {};
  }
}
