/**
 * Floor themes — visual themes for dungeon tiles based on dungeon type/identity.
 * Each theme defines colors for walls, floors, corridors, ambient tint, and fog.
 */

import { DUNGEONS } from "./dungeon-data";
import { SPECIES } from "./pokemon-data";
import { PokemonType } from "./type-chart";

export interface FloorTheme {
  id: string;
  name: string;
  wallColor: number;       // hex color for wall tiles
  floorColor: number;      // hex color for floor tiles
  floorAltColor: number;   // alternate floor color (checkerboard pattern)
  corridorColor: number;   // color for corridors (slightly different from rooms)
  ambientTint: number;     // subtle tint applied to the whole scene
  fogColor: number;        // fog of war color
}

/** All 12 floor themes */
const FLOOR_THEMES: Record<string, FloorTheme> = {
  cave: {
    id: "cave",
    name: "Cave",
    wallColor: 0x4a3728,
    floorColor: 0x8b7355,
    floorAltColor: 0x7d6548,
    corridorColor: 0x6b5540,
    ambientTint: 0xddccaa,
    fogColor: 0x1a1008,
  },
  forest: {
    id: "forest",
    name: "Forest",
    wallColor: 0x1a3a1a,
    floorColor: 0x3d5c3d,
    floorAltColor: 0x2d4c2d,
    corridorColor: 0x2a4a2a,
    ambientTint: 0xccddcc,
    fogColor: 0x0a1a0a,
  },
  ocean: {
    id: "ocean",
    name: "Ocean",
    wallColor: 0x1a2a3a,
    floorColor: 0x3a5a7a,
    floorAltColor: 0x2a4a6a,
    corridorColor: 0x2a3a5a,
    ambientTint: 0xccccee,
    fogColor: 0x080a18,
  },
  volcano: {
    id: "volcano",
    name: "Volcano",
    wallColor: 0x3a1a0a,
    floorColor: 0x6a3020,
    floorAltColor: 0x5a2818,
    corridorColor: 0x4a2010,
    ambientTint: 0xeeccaa,
    fogColor: 0x180a05,
  },
  temple: {
    id: "temple",
    name: "Temple",
    wallColor: 0x2a1a3a,
    floorColor: 0x5a3a6a,
    floorAltColor: 0x4a2a5a,
    corridorColor: 0x3a2050,
    ambientTint: 0xddccee,
    fogColor: 0x0a0818,
  },
  shadow: {
    id: "shadow",
    name: "Shadow",
    wallColor: 0x0a0a15,
    floorColor: 0x2a2a35,
    floorAltColor: 0x1a1a25,
    corridorColor: 0x15151f,
    ambientTint: 0xbbbbcc,
    fogColor: 0x050508,
  },
  metal: {
    id: "metal",
    name: "Metal",
    wallColor: 0x2a2a30,
    floorColor: 0x5a5a65,
    floorAltColor: 0x4a4a55,
    corridorColor: 0x3a3a45,
    ambientTint: 0xccccdd,
    fogColor: 0x0a0a10,
  },
  dojo: {
    id: "dojo",
    name: "Dojo",
    wallColor: 0x3a2818,
    floorColor: 0x7a6040,
    floorAltColor: 0x6a5030,
    corridorColor: 0x5a4828,
    ambientTint: 0xddccbb,
    fogColor: 0x140e08,
  },
  sky: {
    id: "sky",
    name: "Sky",
    wallColor: 0x2a3a5a,
    floorColor: 0x5a7a9a,
    floorAltColor: 0x4a6a8a,
    corridorColor: 0x3a5a7a,
    ambientTint: 0xccddee,
    fogColor: 0x0a1018,
  },
  toxic: {
    id: "toxic",
    name: "Toxic",
    wallColor: 0x1a2a1a,
    floorColor: 0x4a3a5a,
    floorAltColor: 0x3a2a4a,
    corridorColor: 0x2a2040,
    ambientTint: 0xccddcc,
    fogColor: 0x080a08,
  },
  frost: {
    id: "frost",
    name: "Frost",
    wallColor: 0x1a2a3a,
    floorColor: 0x6a8aaa,
    floorAltColor: 0x5a7a9a,
    corridorColor: 0x4a6a8a,
    ambientTint: 0xddeeff,
    fogColor: 0x0a1020,
  },
  void: {
    id: "void",
    name: "Void",
    wallColor: 0x050510,
    floorColor: 0x151525,
    floorAltColor: 0x0a0a1a,
    corridorColor: 0x0a0a15,
    ambientTint: 0xaaaacc,
    fogColor: 0x020205,
  },
};

/**
 * Map dungeon IDs to theme IDs based on their primary enemy types.
 * This avoids expensive runtime lookups each floor.
 */
const DUNGEON_THEME_MAP: Record<string, string> = {
  // Cave (Rock/Ground)
  beachCave: "cave",
  rockyCavern: "cave",
  buriedRuins: "cave",

  // Forest (Grass/Bug)
  tinyWoods: "forest",
  overgrownForest: "forest",
  verdantForest: "forest",
  petalGarden: "forest",

  // Ocean (Water)
  stormySea: "ocean",

  // Volcano (Fire)
  magmaCavern: "volcano",
  emberGrotto: "volcano",

  // Temple (Psychic/Fairy)
  moonlitCave: "temple",
  mysticSanctum: "temple",

  // Shadow (Dark/Ghost)
  sinisterWoods: "shadow",
  skyTower: "shadow",
  shadowForest: "shadow",

  // Metal (Steel/Electric)
  thunderwaveCave: "metal",
  steelFortress: "metal",
  ampPlains: "metal",

  // Dojo (Fighting/Normal)
  mtSteel: "dojo",
  battleArena: "dojo",
  meadowPath: "dojo",

  // Sky (Flying/Dragon)
  windySummit: "sky",
  dragonsLair: "sky",

  // Toxic (Poison)
  toxicSwamp: "toxic",

  // Frost (Ice)
  frostyForest: "frost",
  frozenTundra: "frost",

  // Void (special/endless)
  endlessDungeon: "void",
  dailyDungeon: "void",
};

/**
 * Infer theme from a dungeon's enemy types at runtime.
 * Used as fallback when the dungeon isn't in the manual map.
 */
function inferThemeFromDungeon(dungeonId: string): string {
  const def = DUNGEONS[dungeonId];
  if (!def) return "cave";

  // Tally types from enemy species
  const typeCounts: Partial<Record<PokemonType, number>> = {};
  for (const speciesId of def.enemySpeciesIds) {
    const sp = SPECIES[speciesId];
    if (!sp) continue;
    for (const t of sp.types) {
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }
  }

  // Find dominant type
  let dominantType: PokemonType = PokemonType.Normal;
  let maxCount = 0;
  for (const [t, count] of Object.entries(typeCounts)) {
    if (count! > maxCount) {
      maxCount = count!;
      dominantType = t as PokemonType;
    }
  }

  // Map dominant type to theme
  const typeToTheme: Partial<Record<PokemonType, string>> = {
    [PokemonType.Rock]: "cave",
    [PokemonType.Ground]: "cave",
    [PokemonType.Grass]: "forest",
    [PokemonType.Bug]: "forest",
    [PokemonType.Water]: "ocean",
    [PokemonType.Fire]: "volcano",
    [PokemonType.Psychic]: "temple",
    [PokemonType.Fairy]: "temple",
    [PokemonType.Dark]: "shadow",
    [PokemonType.Ghost]: "shadow",
    [PokemonType.Steel]: "metal",
    [PokemonType.Electric]: "metal",
    [PokemonType.Fighting]: "dojo",
    [PokemonType.Normal]: "dojo",
    [PokemonType.Flying]: "sky",
    [PokemonType.Dragon]: "sky",
    [PokemonType.Poison]: "toxic",
    [PokemonType.Ice]: "frost",
  };

  return typeToTheme[dominantType] ?? "cave";
}

/**
 * Get the floor theme for a dungeon by its ID.
 */
export function getFloorTheme(dungeonId: string): FloorTheme {
  const themeId = DUNGEON_THEME_MAP[dungeonId] ?? inferThemeFromDungeon(dungeonId);
  return FLOOR_THEMES[themeId] ?? FLOOR_THEMES.cave;
}

/**
 * Darken a color by a multiplier (0.0 = black, 1.0 = unchanged).
 * Operates on each RGB channel independently.
 */
export function darkenColor(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (Math.min(r, 255) << 16) | (Math.min(g, 255) << 8) | Math.min(b, 255);
}

/**
 * Get depth-adjusted theme: every 5 floors, colors get 5% darker.
 * This creates a sense of descending deeper.
 */
export function getDepthAdjustedTheme(dungeonId: string, floor: number): FloorTheme {
  const base = getFloorTheme(dungeonId);
  const depthSteps = Math.floor((floor - 1) / 5);
  if (depthSteps <= 0) return base;

  const factor = Math.pow(0.95, depthSteps);
  return {
    ...base,
    wallColor: darkenColor(base.wallColor, factor),
    floorColor: darkenColor(base.floorColor, factor),
    floorAltColor: darkenColor(base.floorAltColor, factor),
    corridorColor: darkenColor(base.corridorColor, factor),
    ambientTint: darkenColor(base.ambientTint, factor),
    fogColor: darkenColor(base.fogColor, factor),
  };
}
