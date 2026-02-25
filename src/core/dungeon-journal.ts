/**
 * Dungeon Journal — persistent record of dungeon exploration history.
 */

export interface DungeonRecord {
  dungeonId: string;
  timesEntered: number;
  timesCleared: number;
  bestFloor: number;
  bestTime: number;        // seconds, 0 = never cleared
  totalEnemiesDefeated: number;
  totalGoldEarned: number;
  speciesEncountered: string[]; // unique species IDs seen in this dungeon
  firstClearDate?: string;      // ISO date string
}

export function loadJournal(): Record<string, DungeonRecord> {
  try {
    const raw = localStorage.getItem("poke-roguelite-journal");
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function saveJournal(journal: Record<string, DungeonRecord>): void {
  try {
    localStorage.setItem("poke-roguelite-journal", JSON.stringify(journal));
  } catch { /* ignore */ }
}

export function getOrCreateRecord(journal: Record<string, DungeonRecord>, dungeonId: string): DungeonRecord {
  if (!journal[dungeonId]) {
    journal[dungeonId] = {
      dungeonId,
      timesEntered: 0,
      timesCleared: 0,
      bestFloor: 0,
      bestTime: 0,
      totalEnemiesDefeated: 0,
      totalGoldEarned: 0,
      speciesEncountered: [],
    };
  }
  return journal[dungeonId];
}

export function recordDungeonEntry(journal: Record<string, DungeonRecord>, dungeonId: string): void {
  const rec = getOrCreateRecord(journal, dungeonId);
  rec.timesEntered++;
  saveJournal(journal);
}

export function recordDungeonClear(journal: Record<string, DungeonRecord>, dungeonId: string, floor: number, time: number, enemies: number, gold: number): void {
  const rec = getOrCreateRecord(journal, dungeonId);
  rec.timesCleared++;
  if (floor > rec.bestFloor) rec.bestFloor = floor;
  if (rec.bestTime === 0 || time < rec.bestTime) rec.bestTime = time;
  rec.totalEnemiesDefeated += enemies;
  rec.totalGoldEarned += gold;
  if (!rec.firstClearDate) rec.firstClearDate = new Date().toISOString().split('T')[0];
  saveJournal(journal);
}

export function recordDungeonDefeat(journal: Record<string, DungeonRecord>, dungeonId: string, floor: number, enemies: number, gold: number): void {
  const rec = getOrCreateRecord(journal, dungeonId);
  if (floor > rec.bestFloor) rec.bestFloor = floor;
  rec.totalEnemiesDefeated += enemies;
  rec.totalGoldEarned += gold;
  saveJournal(journal);
}

export function recordSpeciesEncountered(journal: Record<string, DungeonRecord>, dungeonId: string, speciesId: string): void {
  const rec = getOrCreateRecord(journal, dungeonId);
  if (!rec.speciesEncountered.includes(speciesId)) {
    rec.speciesEncountered.push(speciesId);
    saveJournal(journal);
  }
}
