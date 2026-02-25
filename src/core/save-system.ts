/**
 * Save system — localStorage-based persistence.
 * Handles both mid-dungeon saves and meta progression.
 */

import { Skill, SKILL_DB, createSkill } from "./skill";
import { ItemStack, ITEM_DB } from "./item";
import type { Quest } from "./quests";

const SAVE_KEY = "poke-roguelite-save";
const META_KEY = "poke-roguelite-meta";

// ── Mid-Dungeon Save ──

export interface DungeonSaveData {
  version: number;
  timestamp: number;
  // Floor state
  floor: number;
  dungeonId: string; // which dungeon (for future multi-dungeon)
  // Player state
  hp: number;
  maxHp: number;
  level: number;
  atk: number;
  def: number;
  totalExp: number;
  // Skills (saved as IDs + current PP)
  skills: { id: string; currentPp: number }[];
  // Inventory (saved as IDs + counts)
  inventory: { itemId: string; count: number }[];
  // Starter species
  starter?: string;
  // Challenge mode (if any)
  challengeMode?: string;
  // Dungeon modifiers (if any)
  modifiers?: string[];
}

export interface MetaSaveData {
  version: number;
  // Gold (earned in dungeons, 50% kept on death)
  gold: number;
  totalGold: number;
  // Best records
  bestFloor: number;
  totalClears: number;
  totalRuns: number;
  // Storage items (persisted between runs)
  storage: { itemId: string; count: number }[];
  // Upgrades purchased
  upgrades: Record<string, number>; // upgradeId → level
  // Starter pokemon (unlocked by clears)
  starter?: string; // speciesId (default: "mudkip")
  // Achievement tracking stats
  totalEnemiesDefeated: number;
  totalTurns: number;
  endlessBestFloor: number;
  challengeClears: number;
  startersUsed: string[];  // array of starter IDs used
  // Pokedex tracking
  pokemonSeen: string[];   // species IDs the player has seen (fought or used)
  pokemonUsed: string[];   // species IDs the player has used as starter
  // Move Tutor: custom skill loadouts per starter
  customSkills?: Record<string, string[]>; // starterId -> [skillId, skillId, ...]
  // Held items
  ownedHeldItems?: string[];    // array of held item IDs the player owns
  equippedHeldItem?: string;    // currently equipped held item ID
  // Ability upgrade levels (AbilityId → level 1-5)
  abilityLevels?: Record<string, number>;
  // New Game Plus prestige level (0 = normal, 1 = NG+1, etc.)
  ngPlusLevel?: number;
  // Enchantment applied to the equipped held item
  enchantmentId?: string;
  // Quick restart: last dungeon played
  lastDungeonId?: string;
  lastChallenge?: string;
  // Per-dungeon run counts (dungeonId → count)
  dungeonRunCounts?: Record<string, number>;
  // Dungeon completion tracker: IDs of dungeons cleared at least once
  clearedDungeons?: string[];
  // Passive income: timestamp of last hub visit (Date.now())
  lastVisitTimestamp?: number;
  // Speed run best times per dungeon (dungeonId → best time in seconds)
  bestTimes?: Record<string, number>;
  // Quest / Mission Board
  activeQuests?: Quest[];       // current daily quests
  questLastDate?: string;       // date string (YYYY-MM-DD) of when daily quests were generated
  challengeQuests?: Quest[];    // persistent challenge quests
  // Talent Tree levels (talentId → level)
  talentLevels?: Record<string, number>;
}

const SAVE_VERSION = 1;

// ── Dungeon Save ──

export function saveDungeon(data: DungeonSaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    console.warn("Failed to save dungeon data");
  }
}

export function loadDungeon(): DungeonSaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as DungeonSaveData;
    if (data.version !== SAVE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearDungeonSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export function hasDungeonSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

// ── Meta Save ──

function defaultMeta(): MetaSaveData {
  return {
    version: SAVE_VERSION,
    gold: 0,
    totalGold: 0,
    bestFloor: 0,
    totalClears: 0,
    totalRuns: 0,
    storage: [],
    upgrades: {},
    totalEnemiesDefeated: 0,
    totalTurns: 0,
    endlessBestFloor: 0,
    challengeClears: 0,
    startersUsed: [],
    pokemonSeen: [],
    pokemonUsed: [],
  };
}

export function loadMeta(): MetaSaveData {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return defaultMeta();
    const data = JSON.parse(raw) as MetaSaveData;
    if (data.version !== SAVE_VERSION) return defaultMeta();
    // Backward compatibility: fill in new fields if missing from old saves
    if (data.totalEnemiesDefeated === undefined) data.totalEnemiesDefeated = 0;
    if (data.totalTurns === undefined) data.totalTurns = 0;
    if (data.endlessBestFloor === undefined) data.endlessBestFloor = 0;
    if (data.challengeClears === undefined) data.challengeClears = 0;
    if (data.startersUsed === undefined) data.startersUsed = [];
    if (data.pokemonSeen === undefined) data.pokemonSeen = [];
    if (data.pokemonUsed === undefined) data.pokemonUsed = [];
    if (data.customSkills === undefined) data.customSkills = {};
    if (data.ownedHeldItems === undefined) data.ownedHeldItems = [];
    if (data.equippedHeldItem === undefined) data.equippedHeldItem = undefined;
    if (data.abilityLevels === undefined) data.abilityLevels = {};
    if (data.ngPlusLevel === undefined) data.ngPlusLevel = 0;
    if (data.enchantmentId === undefined) data.enchantmentId = undefined;
    if (data.lastDungeonId === undefined) data.lastDungeonId = undefined;
    if (data.lastChallenge === undefined) data.lastChallenge = undefined;
    if (data.dungeonRunCounts === undefined) data.dungeonRunCounts = {};
    if (data.clearedDungeons === undefined) data.clearedDungeons = [];
    if (data.lastVisitTimestamp === undefined) data.lastVisitTimestamp = undefined;
    if (data.bestTimes === undefined) data.bestTimes = {};
    if (data.activeQuests === undefined) data.activeQuests = [];
    if (data.questLastDate === undefined) data.questLastDate = undefined;
    if (data.challengeQuests === undefined) data.challengeQuests = [];
    if (data.talentLevels === undefined) data.talentLevels = {};
    return data;
  } catch {
    return defaultMeta();
  }
}

export function saveMeta(data: MetaSaveData): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(data));
  } catch {
    console.warn("Failed to save meta data");
  }
}

// ── Serialization Helpers ──

export function serializeSkills(skills: Skill[]): { id: string; currentPp: number }[] {
  return skills.map(s => ({ id: s.id, currentPp: s.currentPp }));
}

export function deserializeSkills(data: { id: string; currentPp: number }[]): Skill[] {
  return data.map(d => {
    const template = SKILL_DB[d.id];
    if (!template) return createSkill(SKILL_DB.tackle);
    const skill = createSkill(template);
    skill.currentPp = d.currentPp;
    return skill;
  });
}

export function serializeInventory(inv: ItemStack[]): { itemId: string; count: number }[] {
  return inv.map(s => ({ itemId: s.item.id, count: s.count }));
}

export function deserializeInventory(data: { itemId: string; count: number }[]): ItemStack[] {
  return data
    .map(d => {
      const item = ITEM_DB[d.itemId];
      if (!item) return null;
      return { item, count: d.count } as ItemStack;
    })
    .filter((s): s is ItemStack => s !== null);
}

// ── Gold Calculations ──

/** Gold earned from a dungeon run */
export function goldFromRun(floor: number, enemiesDefeated: number, cleared: boolean): number {
  const base = floor * 20 + enemiesDefeated * 5;
  return cleared ? base * 2 : Math.floor(base * 0.5);
}
