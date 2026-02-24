/**
 * Daily Dungeon — a seed-based dungeon that changes every day.
 * Players can attempt it once per day. Scores saved to localStorage.
 */

import { DUNGEONS } from "./dungeon-data";

export interface DailyDungeonConfig {
  date: string;          // YYYY-MM-DD
  seed: number;
  baseDungeonId: string; // template dungeon
  modifiers: string[];   // e.g., ["strongEnemies", "fewItems"]
  floors: number;
  difficulty: number;
}

export interface DailyScore {
  date: string;
  floorsReached: number;
  enemiesDefeated: number;
  turnsUsed: number;
  score: number;
  cleared: boolean;
  starter: string;
}

/** Simple hash from date string to number */
function dateToSeed(dateStr: string): number {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = ((h << 5) - h + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Seeded pseudo-random number generator */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/** Get today's daily dungeon configuration */
export function getDailyConfig(): DailyDungeonConfig {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const seed = dateToSeed(today);
  const rng = seededRandom(seed);

  // Pick a random dungeon as template (exclude special dungeons)
  const dungeonIds = Object.keys(DUNGEONS).filter(id =>
    id !== "endlessDungeon" && id !== "destinyTower" && id !== "dailyDungeon"
  );
  const baseIdx = Math.floor(rng() * dungeonIds.length);
  const baseDungeonId = dungeonIds[baseIdx];

  // Random modifiers (1-2)
  const allModifiers = ["strongEnemies", "fewItems", "fastPace", "moreGold", "toughBoss"];
  const modCount = 1 + Math.floor(rng() * 2); // 1-2 modifiers
  const modifiers: string[] = [];
  for (let i = 0; i < modCount; i++) {
    const m = allModifiers[Math.floor(rng() * allModifiers.length)];
    if (!modifiers.includes(m)) modifiers.push(m);
  }

  // Floors: 15-25
  const floors = 15 + Math.floor(rng() * 11);
  // Difficulty: 3.0-7.0
  const difficulty = 3.0 + rng() * 4.0;

  return { date: today, seed, baseDungeonId, modifiers, floors, difficulty };
}

/** Calculate daily dungeon score */
export function calculateDailyScore(
  floorsReached: number, enemiesDefeated: number, turnsUsed: number, cleared: boolean
): number {
  let score = floorsReached * 100 + enemiesDefeated * 10;
  if (cleared) score += 500; // clear bonus
  // Speed bonus: fewer turns = more points
  score += Math.max(0, 2000 - turnsUsed);
  return Math.max(0, score);
}

// localStorage key for daily scores
const DAILY_KEY = "poke-roguelite-daily";

/** Save a daily score entry */
export function saveDailyScore(entry: DailyScore): void {
  const data = loadDailyScores();
  // Only one attempt per day — keep higher score
  const existing = data.findIndex(d => d.date === entry.date);
  if (existing >= 0) {
    if (entry.score > data[existing].score) data[existing] = entry;
  } else {
    data.push(entry);
  }
  // Keep last 30 days
  data.sort((a, b) => b.date.localeCompare(a.date));
  while (data.length > 30) data.pop();
  localStorage.setItem(DAILY_KEY, JSON.stringify(data));
}

/** Load all daily scores from localStorage */
export function loadDailyScores(): DailyScore[] {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** Check if player already attempted today's daily dungeon */
export function hasDailyAttempt(date: string): boolean {
  return loadDailyScores().some(d => d.date === date);
}
