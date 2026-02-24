/**
 * Leaderboard / Scoring System
 * Tracks personal best run scores per dungeon in localStorage.
 * Keeps top 10 per dungeon to prevent localStorage bloat.
 */

const STORAGE_KEY = "poke-roguelite-leaderboard";
const RECENT_KEY = "poke-roguelite-recent-runs";
const MAX_PER_DUNGEON = 10;
const MAX_RECENT = 20;

export interface RunScore {
  dungeonId: string;
  starter: string;
  score: number;
  floorsCleared: number;
  enemiesDefeated: number;
  turns: number;
  goldEarned: number;
  cleared: boolean;
  date: string; // ISO date string
  challengeMode?: string;
}

export interface RunScoreInput {
  dungeonId: string;
  starter: string;
  floorsCleared: number;
  enemiesDefeated: number;
  turns: number;
  goldEarned: number;
  cleared: boolean;
  totalFloors: number; // dungeon's total floor count, needed for turn efficiency
  challengeMode?: string;
}

/**
 * Calculate score from run data.
 *
 * - Base: floors cleared x 100
 * - Enemies defeated x 10
 * - Cleared bonus: +1000
 * - Gold earned x 1
 * - Turn efficiency bonus: if cleared, bonus = max(0, (totalFloors x 50 - turns) x 2)
 * - Challenge mode multiplier: speedrun 1.5x, noItems 1.3x, solo 1.5x
 */
export function calculateScore(data: RunScoreInput): number {
  let score = 0;

  // Base score from floors
  score += data.floorsCleared * 100;

  // Enemies defeated bonus
  score += data.enemiesDefeated * 10;

  // Cleared bonus
  if (data.cleared) {
    score += 1000;
  }

  // Gold earned
  score += data.goldEarned;

  // Turn efficiency bonus (only if cleared)
  if (data.cleared) {
    const efficiencyBonus = Math.max(0, (data.totalFloors * 50 - data.turns) * 2);
    score += efficiencyBonus;
  }

  // Challenge mode multiplier
  if (data.challengeMode) {
    const multipliers: Record<string, number> = {
      speedrun: 1.5,
      noItems: 1.3,
      solo: 1.5,
    };
    const mult = multipliers[data.challengeMode] ?? 1;
    score = Math.floor(score * mult);
  }

  return score;
}

/** Load all leaderboard data from localStorage */
function loadLeaderboard(): Record<string, RunScore[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, RunScore[]>;
  } catch {
    return {};
  }
}

/** Save leaderboard data to localStorage */
function saveLeaderboard(data: Record<string, RunScore[]>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage might be full; silently fail
  }
}

/** Load recent runs list */
function loadRecentRuns(): RunScore[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RunScore[];
  } catch {
    return [];
  }
}

/** Save recent runs list */
function saveRecentRuns(runs: RunScore[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(runs));
  } catch {
    // silently fail
  }
}

/**
 * Save a run score to localStorage.
 * Keeps top 10 per dungeon, sorted descending by score.
 * Also adds to recent runs list (max 20).
 */
export function saveRunScore(score: RunScore): void {
  // Save to per-dungeon leaderboard
  const board = loadLeaderboard();
  const list = board[score.dungeonId] ?? [];
  list.push(score);
  // Sort descending by score
  list.sort((a, b) => b.score - a.score);
  // Keep only top N
  board[score.dungeonId] = list.slice(0, MAX_PER_DUNGEON);
  saveLeaderboard(board);

  // Save to recent runs
  const recent = loadRecentRuns();
  recent.unshift(score); // newest first
  saveRecentRuns(recent.slice(0, MAX_RECENT));
}

/**
 * Get top scores for a specific dungeon.
 * @param dungeonId - The dungeon identifier
 * @param limit - Max number of scores to return (default 10)
 */
export function getTopScores(dungeonId: string, limit = 10): RunScore[] {
  const board = loadLeaderboard();
  const list = board[dungeonId] ?? [];
  return list.slice(0, limit);
}

/**
 * Get recent runs across all dungeons.
 * @param limit - Max number of runs to return (default 10)
 */
export function getRecentRuns(limit = 10): RunScore[] {
  const recent = loadRecentRuns();
  return recent.slice(0, limit);
}

/**
 * Get all-time top scores across all dungeons.
 * @param limit - Max number of scores to return (default 10)
 */
export function getAllTimeTopScores(limit = 10): RunScore[] {
  const board = loadLeaderboard();
  const allScores: RunScore[] = [];
  for (const dungeonId of Object.keys(board)) {
    allScores.push(...board[dungeonId]);
  }
  allScores.sort((a, b) => b.score - a.score);
  return allScores.slice(0, limit);
}

/**
 * Get aggregate stats across all runs.
 */
export function getAllTimeStats(): {
  totalScore: number;
  bestScore: RunScore | null;
  totalRuns: number;
} {
  const board = loadLeaderboard();
  const recent = loadRecentRuns();
  let totalScore = 0;
  let bestScore: RunScore | null = null;

  for (const dungeonId of Object.keys(board)) {
    for (const s of board[dungeonId]) {
      totalScore += s.score;
      if (!bestScore || s.score > bestScore.score) {
        bestScore = s;
      }
    }
  }

  return {
    totalScore,
    bestScore,
    totalRuns: recent.length,
  };
}

/**
 * Get list of dungeon IDs that have scores.
 */
export function getDungeonsWithScores(): string[] {
  const board = loadLeaderboard();
  return Object.keys(board).filter(id => board[id].length > 0);
}
