/**
 * Run Log — tracks all significant events during a dungeon run.
 *
 * Lightweight append-only log that records key moments (kills, damage, items,
 * level-ups, floor changes, discoveries, etc.).  Stats are computed on demand
 * from the raw entries so the runtime cost is a single array push per event.
 *
 * Capped at MAX_ENTRIES to avoid runaway memory on very long Endless runs.
 */

// ── Event Types ──────────────────────────────────────────────

export enum RunLogEvent {
  EnemyDefeated     = "EnemyDefeated",
  BossDefeated      = "BossDefeated",
  LegendaryDefeated = "LegendaryDefeated",
  DamageTaken       = "DamageTaken",
  DamageDealt       = "DamageDealt",
  ItemUsed          = "ItemUsed",
  ItemPickedUp      = "ItemPickedUp",
  SkillUsed         = "SkillUsed",
  LevelUp           = "LevelUp",
  FloorAdvanced     = "FloorAdvanced",
  GauntletCleared   = "GauntletCleared",
  SecretRoomFound   = "SecretRoomFound",
  PuzzleSolved      = "PuzzleSolved",
  ShopVisited       = "ShopVisited",
  RelicFound        = "RelicFound",
  ChainTierUp       = "ChainTierUp",
  WeatherChanged    = "WeatherChanged",
  MutationActive    = "MutationActive",
  PlayerDied        = "PlayerDied",
  DungeonCleared    = "DungeonCleared",
}

// ── Entry ────────────────────────────────────────────────────

export interface RunLogEntry {
  turn: number;
  floor: number;
  event: RunLogEvent;
  detail: string;
  timestamp: number;   // Date.now() at the moment the entry was created
}

// ── Summary Stats ────────────────────────────────────────────

export interface RunSummaryStats {
  totalEnemiesDefeated: number;
  bossesDefeated: number;
  legendariesDefeated: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  totalItemsUsed: number;
  totalItemsPickedUp: number;
  totalSkillsUsed: number;
  uniqueSkillsUsed: number;
  levelUps: number;
  floorsExplored: number;
  gauntletsCleared: number;
  secretRoomsFound: number;
  puzzlesSolved: number;
  shopsVisited: number;
  relicsFound: number;
  bestChainTier: string;
  weatherChanges: number;
  mutationsEncountered: number;
}

// ── Performance Grade ────────────────────────────────────────

export type PerformanceGrade = "D" | "C" | "B" | "A" | "S" | "SS" | "SSS";

export function calculatePerformanceGrade(
  stats: RunSummaryStats,
  cleared: boolean,
  floorsTotal: number,
  turns: number,
): PerformanceGrade {
  let score = 0;

  // Clearing the dungeon is the biggest contributor
  if (cleared) score += 40;

  // Floor progress ratio
  score += Math.min(20, Math.floor((stats.floorsExplored / Math.max(1, floorsTotal)) * 20));

  // Kill efficiency: enemies per floor
  const killsPerFloor = stats.totalEnemiesDefeated / Math.max(1, stats.floorsExplored);
  score += Math.min(10, Math.floor(killsPerFloor * 2));

  // Boss/legendary bonuses
  score += stats.bossesDefeated * 3;
  score += stats.legendariesDefeated * 5;

  // Discoveries / optional content
  score += stats.secretRoomsFound * 3;
  score += stats.puzzlesSolved * 3;
  score += stats.gauntletsCleared * 4;

  // Chain performance
  const chainMap: Record<string, number> = { C: 1, B: 2, A: 3, S: 5, SS: 7, SSS: 10 };
  score += chainMap[stats.bestChainTier] ?? 0;

  // Turn efficiency (fewer turns = better; baseline 10 turns/floor)
  const turnsPerFloor = turns / Math.max(1, stats.floorsExplored);
  if (turnsPerFloor <= 8) score += 5;
  else if (turnsPerFloor <= 15) score += 3;

  // Grade thresholds
  if (score >= 85) return "SSS";
  if (score >= 70) return "SS";
  if (score >= 55) return "S";
  if (score >= 40) return "A";
  if (score >= 25) return "B";
  if (score >= 12) return "C";
  return "D";
}

export function gradeColor(grade: PerformanceGrade): string {
  switch (grade) {
    case "SSS": return "#fbbf24";
    case "SS":  return "#a855f7";
    case "S":   return "#60a5fa";
    case "A":   return "#4ade80";
    case "B":   return "#ffffff";
    case "C":   return "#94a3b8";
    case "D":   return "#6b7280";
  }
}

// ── Run Log Class ────────────────────────────────────────────

const MAX_ENTRIES = 500;

export class RunLog {
  entries: RunLogEntry[] = [];

  /** Append an entry.  Drops oldest entries when over MAX_ENTRIES. */
  add(event: RunLogEvent, detail: string, floor: number, turn: number): void {
    this.entries.push({ turn, floor, event, detail, timestamp: Date.now() });
    if (this.entries.length > MAX_ENTRIES) {
      // Remove the oldest 50 entries in bulk to avoid trimming every call
      this.entries.splice(0, 50);
    }
  }

  /** Filter by event type */
  getByEvent(event: RunLogEvent): RunLogEntry[] {
    return this.entries.filter(e => e.event === event);
  }

  /** Filter by floor number */
  getByFloor(floor: number): RunLogEntry[] {
    return this.entries.filter(e => e.floor === floor);
  }

  /** Compute aggregate stats from all entries */
  getSummaryStats(): RunSummaryStats {
    let totalDamageDealt = 0;
    let totalDamageTaken = 0;
    const uniqueSkills = new Set<string>();
    let bestChainTier = "";
    const chainRank: Record<string, number> = { "": 0, C: 1, B: 2, A: 3, S: 4, SS: 5, SSS: 6 };

    for (const e of this.entries) {
      switch (e.event) {
        case RunLogEvent.DamageDealt: {
          const n = parseInt(e.detail, 10);
          if (!isNaN(n)) totalDamageDealt += n;
          break;
        }
        case RunLogEvent.DamageTaken: {
          const n = parseInt(e.detail, 10);
          if (!isNaN(n)) totalDamageTaken += n;
          break;
        }
        case RunLogEvent.SkillUsed:
          uniqueSkills.add(e.detail);
          break;
        case RunLogEvent.ChainTierUp: {
          const tier = e.detail;
          if ((chainRank[tier] ?? 0) > (chainRank[bestChainTier] ?? 0)) {
            bestChainTier = tier;
          }
          break;
        }
      }
    }

    const count = (ev: RunLogEvent) => this.getByEvent(ev).length;

    return {
      totalEnemiesDefeated: count(RunLogEvent.EnemyDefeated),
      bossesDefeated:       count(RunLogEvent.BossDefeated),
      legendariesDefeated:  count(RunLogEvent.LegendaryDefeated),
      totalDamageDealt,
      totalDamageTaken,
      totalItemsUsed:       count(RunLogEvent.ItemUsed),
      totalItemsPickedUp:   count(RunLogEvent.ItemPickedUp),
      totalSkillsUsed:      count(RunLogEvent.SkillUsed),
      uniqueSkillsUsed:     uniqueSkills.size,
      levelUps:             count(RunLogEvent.LevelUp),
      floorsExplored:       count(RunLogEvent.FloorAdvanced),
      gauntletsCleared:     count(RunLogEvent.GauntletCleared),
      secretRoomsFound:     count(RunLogEvent.SecretRoomFound),
      puzzlesSolved:        count(RunLogEvent.PuzzleSolved),
      shopsVisited:         count(RunLogEvent.ShopVisited),
      relicsFound:          count(RunLogEvent.RelicFound),
      bestChainTier,
      weatherChanges:       count(RunLogEvent.WeatherChanged),
      mutationsEncountered: count(RunLogEvent.MutationActive),
    };
  }

  /** Get notable events (boss kills, legendaries, relics, puzzles, secrets) */
  getNotableEvents(): RunLogEntry[] {
    const notable = new Set([
      RunLogEvent.BossDefeated,
      RunLogEvent.LegendaryDefeated,
      RunLogEvent.SecretRoomFound,
      RunLogEvent.PuzzleSolved,
      RunLogEvent.GauntletCleared,
      RunLogEvent.RelicFound,
      RunLogEvent.LevelUp,
      RunLogEvent.DungeonCleared,
      RunLogEvent.PlayerDied,
    ]);
    return this.entries.filter(e => notable.has(e.event));
  }

  /** Get a floor-by-floor timeline of major events (for the scrollable summary) */
  getTimeline(): { floor: number; events: string[] }[] {
    const map = new Map<number, string[]>();
    const significant = new Set([
      RunLogEvent.EnemyDefeated,
      RunLogEvent.BossDefeated,
      RunLogEvent.LegendaryDefeated,
      RunLogEvent.LevelUp,
      RunLogEvent.SecretRoomFound,
      RunLogEvent.PuzzleSolved,
      RunLogEvent.GauntletCleared,
      RunLogEvent.ShopVisited,
      RunLogEvent.WeatherChanged,
      RunLogEvent.MutationActive,
      RunLogEvent.RelicFound,
      RunLogEvent.DungeonCleared,
      RunLogEvent.PlayerDied,
    ]);

    // Count enemy defeats per floor and merge into timeline
    const floorKills = new Map<number, number>();

    for (const e of this.entries) {
      if (e.event === RunLogEvent.EnemyDefeated) {
        floorKills.set(e.floor, (floorKills.get(e.floor) ?? 0) + 1);
        continue;
      }
      if (!significant.has(e.event)) continue;
      if (!map.has(e.floor)) map.set(e.floor, []);
      map.get(e.floor)!.push(e.detail);
    }

    // Merge kill counts
    for (const [floor, kills] of floorKills) {
      if (!map.has(floor)) map.set(floor, []);
      map.get(floor)!.unshift(`Defeated ${kills} enemies`);
    }

    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([floor, events]) => ({ floor, events }));
  }

  /** Serialise to a plain object (for passing between scenes via restart data) */
  serialize(): RunLogEntry[] {
    return this.entries;
  }

  /** Restore from serialised data */
  static deserialize(data: RunLogEntry[]): RunLog {
    const log = new RunLog();
    log.entries = data;
    return log;
  }
}

// ── Factory ──────────────────────────────────────────────────

export function createRunLog(): RunLog {
  return new RunLog();
}
