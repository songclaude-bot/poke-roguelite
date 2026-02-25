/**
 * Quest / Mission Board System
 *
 * Provides daily quests (3 per day, seeded by date) and persistent challenge quests.
 * Quest progress is tracked during dungeon runs and saved in MetaSaveData.
 */

import { DUNGEONS, DungeonDef } from "./dungeon-data";
import type { MetaSaveData } from "./save-system";

// ── Enums & Interfaces ──

export enum QuestType {
  DefeatEnemies = "DefeatEnemies",
  ClearDungeon = "ClearDungeon",
  CollectItems = "CollectItems",
  ReachFloor = "ReachFloor",
  SpeedClear = "SpeedClear",
  NoItemClear = "NoItemClear",
  ChainCombo = "ChainCombo",
  DefeatBoss = "DefeatBoss",
}

export interface QuestReward {
  gold: number;
  exp?: number;
  itemId?: string;
  itemCount?: number;
}

export interface Quest {
  id: string;
  name: string;
  description: string;
  type: QuestType;
  target: number;
  progress: number;
  reward: QuestReward;
  dungeonId?: string;
  expiresAt?: number;
  completed: boolean;
  claimed: boolean;
}

// ── Seeded RNG (simple mulberry32) ──

function seedFromDate(date: Date): number {
  const str = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Daily Quest Templates ──

interface DailyTemplate {
  type: QuestType;
  nameTemplate: string;
  descTemplate: string;
  targetRange: [number, number]; // min, max (inclusive)
  rewardGold: number;
  needsDungeon?: boolean; // fill in a random unlocked dungeon name
}

const DAILY_TEMPLATES: DailyTemplate[] = [
  {
    type: QuestType.DefeatEnemies,
    nameTemplate: "Defeat {target} enemies",
    descTemplate: "Defeat {target} enemies in dungeons",
    targetRange: [15, 30],
    rewardGold: 100,
  },
  {
    type: QuestType.ClearDungeon,
    nameTemplate: "Clear {dungeon}",
    descTemplate: "Clear {dungeon} from top to bottom",
    targetRange: [1, 1],
    rewardGold: 200,
    needsDungeon: true,
  },
  {
    type: QuestType.CollectItems,
    nameTemplate: "Collect {target} items",
    descTemplate: "Pick up {target} items in a single run",
    targetRange: [3, 8],
    rewardGold: 80,
  },
  {
    type: QuestType.ReachFloor,
    nameTemplate: "Reach B{target}F",
    descTemplate: "Reach floor {target} in any dungeon",
    targetRange: [5, 15],
    rewardGold: 150,
  },
  {
    type: QuestType.ChainCombo,
    nameTemplate: "Get a B-rank chain",
    descTemplate: "Achieve a B-rank chain or better in a run",
    targetRange: [2, 2], // B = 1.5x, we check tier name
    rewardGold: 120,
  },
  {
    type: QuestType.DefeatEnemies,
    nameTemplate: "Defeat {target} enemies",
    descTemplate: "Defeat {target} enemies across all runs",
    targetRange: [30, 50],
    rewardGold: 150,
  },
  {
    type: QuestType.ReachFloor,
    nameTemplate: "Reach B{target}F",
    descTemplate: "Reach floor {target} in any dungeon",
    targetRange: [10, 20],
    rewardGold: 200,
  },
  {
    type: QuestType.CollectItems,
    nameTemplate: "Collect {target} items",
    descTemplate: "Pick up {target} items in a single run",
    targetRange: [5, 12],
    rewardGold: 100,
  },
];

// ── Challenge Quest Definitions (static, always available) ──

interface ChallengeTemplate {
  id: string;
  name: string;
  description: string;
  type: QuestType;
  target: number;
  reward: QuestReward;
}

const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    id: "ch_defeat100",
    name: "Monster Hunter",
    description: "Defeat 100 enemies total",
    type: QuestType.DefeatEnemies,
    target: 100,
    reward: { gold: 500 },
  },
  {
    id: "ch_clear5",
    name: "Dungeon Crawler",
    description: "Clear 5 different dungeons",
    type: QuestType.ClearDungeon,
    target: 5,
    reward: { gold: 300 },
  },
  {
    id: "ch_sssChain",
    name: "Chain Master",
    description: "Achieve SSS chain rank in a run",
    type: QuestType.ChainCombo,
    target: 6, // SSS = tier index 6
    reward: { gold: 1000 },
  },
  {
    id: "ch_noItem",
    name: "Purist",
    description: "Clear a dungeon without using items",
    type: QuestType.NoItemClear,
    target: 1,
    reward: { gold: 400 },
  },
  {
    id: "ch_defeatBoss",
    name: "Legendary Slayer",
    description: "Defeat a legendary Pokemon",
    type: QuestType.DefeatBoss,
    target: 1,
    reward: { gold: 800 },
  },
  {
    id: "ch_defeat500",
    name: "Exterminator",
    description: "Defeat 500 enemies total",
    type: QuestType.DefeatEnemies,
    target: 500,
    reward: { gold: 1500 },
  },
  {
    id: "ch_clear15",
    name: "Explorer",
    description: "Clear 15 different dungeons",
    type: QuestType.ClearDungeon,
    target: 15,
    reward: { gold: 800 },
  },
  {
    id: "ch_speedClear",
    name: "Speed Demon",
    description: "Clear a dungeon in under 200 turns",
    type: QuestType.SpeedClear,
    target: 200,
    reward: { gold: 600 },
  },
];

// ── Utility: get random unlocked dungeon ──

function getRandomUnlockedDungeon(rng: () => number, meta: MetaSaveData): DungeonDef | null {
  const all = Object.values(DUNGEONS).filter(
    d => d.unlockClears <= meta.totalClears
      && d.id !== "endlessDungeon"
      && d.id !== "dailyDungeon"
      && d.id !== "bossRush"
  );
  if (all.length === 0) return null;
  return all[Math.floor(rng() * all.length)];
}

// ── Chain tier helpers ──

/** Map chain tier name to a numeric index for comparison */
const CHAIN_TIER_INDEX: Record<string, number> = {
  "": 0,
  C: 1,
  B: 2,
  A: 3,
  S: 4,
  SS: 5,
  SSS: 6,
};

function chainTierFromTarget(target: number): string {
  const entries = Object.entries(CHAIN_TIER_INDEX);
  for (const [name, idx] of entries) {
    if (idx === target) return name;
  }
  return "B";
}

// ── Quest Generation ──

/**
 * Generate 3 daily quests seeded by the given date.
 * Uses the player's meta to pick appropriate random dungeons.
 */
export function generateDailyQuests(date: Date, meta: MetaSaveData): Quest[] {
  const seed = seedFromDate(date);
  const rng = mulberry32(seed);

  // Shuffle template indices to pick 3 unique-ish quests
  const indices = Array.from({ length: DAILY_TEMPLATES.length }, (_, i) => i);
  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  // Midnight of next day for expiration
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const expiresAt = tomorrow.getTime();

  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const quests: Quest[] = [];
  for (let i = 0; i < 3; i++) {
    const tmpl = DAILY_TEMPLATES[indices[i % DAILY_TEMPLATES.length]];
    const target = tmpl.targetRange[0] + Math.floor(rng() * (tmpl.targetRange[1] - tmpl.targetRange[0] + 1));

    let dungeonId: string | undefined;
    let dungeonName = "";
    if (tmpl.needsDungeon) {
      const dg = getRandomUnlockedDungeon(rng, meta);
      if (dg) {
        dungeonId = dg.id;
        dungeonName = dg.name;
      } else {
        dungeonName = "Beach Cave";
        dungeonId = "beachCave";
      }
    }

    const name = tmpl.nameTemplate
      .replace("{target}", String(target))
      .replace("{dungeon}", dungeonName);
    const description = tmpl.descTemplate
      .replace("{target}", String(target))
      .replace("{dungeon}", dungeonName);

    quests.push({
      id: `daily_${dateStr}_${i}`,
      name,
      description,
      type: tmpl.type,
      target,
      progress: 0,
      reward: { gold: tmpl.rewardGold },
      dungeonId,
      expiresAt,
      completed: false,
      claimed: false,
    });
  }

  return quests;
}

/**
 * Get challenge quests. These are always available and persist until completed.
 * If the player already has saved challenge quests, merge with templates
 * (add any new ones, keep progress on existing ones).
 */
export function getChallengeQuests(meta: MetaSaveData): Quest[] {
  const existingMap = new Map<string, Quest>();
  if (meta.challengeQuests && meta.challengeQuests.length > 0) {
    for (const q of meta.challengeQuests) {
      existingMap.set(q.id, q);
    }
  }

  return CHALLENGE_TEMPLATES.map(tmpl => {
    const prev = existingMap.get(tmpl.id);
    if (prev) return prev;
    return {
      id: tmpl.id,
      name: tmpl.name,
      description: tmpl.description,
      type: tmpl.type,
      target: tmpl.target,
      progress: 0,
      reward: tmpl.reward,
      completed: false,
      claimed: false,
    };
  });
}

// ── Quest Progress Tracking ──

/**
 * Run-end data used to update quest progress.
 * Collected during a dungeon run and passed to updateQuestProgress.
 */
export interface RunQuestData {
  enemiesDefeated: number;
  cleared: boolean;
  dungeonId: string;
  itemsCollected: number;
  floorReached: number;
  bestChainTier: string; // "", "C", "B", "A", "S", "SS", "SSS"
  bossDefeated: boolean;
  legendaryDefeated: boolean;
  noItemsUsed: boolean;
  turnsUsed: number;
}

/**
 * Update quest progress based on run data.
 * Call this after each dungeon run (clear or game over).
 */
export function updateQuestProgress(quests: Quest[], runData: RunQuestData): void {
  for (const quest of quests) {
    if (quest.completed || quest.claimed) continue;

    switch (quest.type) {
      case QuestType.DefeatEnemies:
        quest.progress += runData.enemiesDefeated;
        break;

      case QuestType.ClearDungeon:
        if (runData.cleared) {
          if (quest.dungeonId) {
            // Daily quest: clear a specific dungeon
            if (runData.dungeonId === quest.dungeonId) {
              quest.progress += 1;
            }
          } else {
            // Challenge quest: clear N different dungeons — increment always
            quest.progress += 1;
          }
        }
        break;

      case QuestType.CollectItems:
        // Track max items collected in a single run
        if (runData.itemsCollected > quest.progress) {
          quest.progress = runData.itemsCollected;
        }
        break;

      case QuestType.ReachFloor:
        if (runData.floorReached > quest.progress) {
          quest.progress = runData.floorReached;
        }
        break;

      case QuestType.SpeedClear:
        // Target = max turns. If cleared in fewer turns, quest is met.
        if (runData.cleared && runData.turnsUsed <= quest.target) {
          quest.progress = quest.target; // mark as achieved
        }
        break;

      case QuestType.NoItemClear:
        if (runData.cleared && runData.noItemsUsed) {
          quest.progress += 1;
        }
        break;

      case QuestType.ChainCombo: {
        const tierIdx = CHAIN_TIER_INDEX[runData.bestChainTier] ?? 0;
        if (tierIdx >= quest.target) {
          quest.progress = quest.target;
        } else if (tierIdx > quest.progress) {
          quest.progress = tierIdx;
        }
        break;
      }

      case QuestType.DefeatBoss:
        if (runData.legendaryDefeated || runData.bossDefeated) {
          quest.progress += 1;
        }
        break;
    }

    // Check completion
    if (quest.progress >= quest.target) {
      quest.progress = quest.target;
      quest.completed = true;
    }
  }
}

/**
 * Claim a completed quest's reward.
 * Returns the reward if successfully claimed, null otherwise.
 */
export function claimQuestReward(quest: Quest): QuestReward | null {
  if (!quest.completed || quest.claimed) return null;
  quest.claimed = true;
  return quest.reward;
}

/**
 * Check if any quests are claimable (completed but not claimed).
 */
export function hasClaimableQuests(quests: Quest[]): boolean {
  return quests.some(q => q.completed && !q.claimed);
}

/**
 * Get the date string (YYYY-MM-DD) for today.
 */
export function getTodayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
