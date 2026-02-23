/**
 * Dungeon definitions — each dungeon has its own tileset, enemy pool, and floor count.
 */

export interface DungeonDef {
  id: string;
  name: string;
  tilesetPath: string;      // path to tileset PNG
  tilesetKey: string;        // Phaser asset key
  floors: number;            // total floors
  enemySpeciesIds: string[]; // species IDs from SPECIES record
  /** Per-floor enemy distribution: floorIndex (1-based) → species IDs */
  floorEnemies: Record<number, string[]>;
  /** Difficulty scaling: multiplier applied to enemy stats */
  difficulty: number;
  /** Items per floor */
  itemsPerFloor: number;
  /** Unlock requirement: min total clears */
  unlockClears: number;
  /** Description shown in hub */
  description: string;
}

export const DUNGEONS: Record<string, DungeonDef> = {
  beachCave: {
    id: "beachCave",
    name: "Beach Cave",
    tilesetPath: "tilesets/BeachCave/tileset_0.png",
    tilesetKey: "beachcave-tiles",
    floors: 5,
    enemySpeciesIds: ["zubat", "shellos", "corsola", "geodude"],
    floorEnemies: {
      1: ["zubat"],
      2: ["zubat", "shellos"],
      3: ["zubat", "shellos", "corsola"],
      4: ["shellos", "corsola", "geodude"],
      5: ["corsola", "geodude"],
    },
    difficulty: 1.0,
    itemsPerFloor: 3,
    unlockClears: 0,
    description: "B1F~B5F. Water and Rock types.",
  },
  thunderwaveCave: {
    id: "thunderwaveCave",
    name: "Thunderwave Cave",
    tilesetPath: "tilesets/ThunderwaveCave/tileset_0.png",
    tilesetKey: "thunderwave-tiles",
    floors: 6,
    enemySpeciesIds: ["voltorb", "magnemite", "pikachu"],
    floorEnemies: {
      1: ["voltorb"],
      2: ["voltorb", "magnemite"],
      3: ["voltorb", "magnemite"],
      4: ["magnemite", "pikachu"],
      5: ["magnemite", "pikachu"],
      6: ["pikachu"],
    },
    difficulty: 1.3,
    itemsPerFloor: 3,
    unlockClears: 1,
    description: "B1F~B6F. Electric types. Harder!",
  },
  tinyWoods: {
    id: "tinyWoods",
    name: "Tiny Woods",
    tilesetPath: "tilesets/TinyWoods/tileset_0.png",
    tilesetKey: "tinywoods-tiles",
    floors: 4,
    enemySpeciesIds: ["caterpie", "pidgey"],
    floorEnemies: {
      1: ["caterpie"],
      2: ["caterpie", "pidgey"],
      3: ["pidgey", "caterpie"],
      4: ["pidgey"],
    },
    difficulty: 0.8,
    itemsPerFloor: 4,
    unlockClears: 0,
    description: "B1F~B4F. Bug and Flying. Easy!",
  },
};

/** Get dungeon by ID */
export function getDungeon(id: string): DungeonDef {
  return DUNGEONS[id] ?? DUNGEONS.beachCave;
}

/** Get all unlocked dungeons given total clears */
export function getUnlockedDungeons(totalClears: number): DungeonDef[] {
  return Object.values(DUNGEONS).filter(d => d.unlockClears <= totalClears);
}

/** Get floor enemies for a specific dungeon+floor */
export function getDungeonFloorEnemies(dungeon: DungeonDef, floor: number): string[] {
  return dungeon.floorEnemies[floor] ?? dungeon.enemySpeciesIds;
}
