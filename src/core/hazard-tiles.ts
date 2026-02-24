/**
 * Dungeon Hazard Tiles — visible environmental terrain hazards.
 * Unlike traps (hidden until triggered), hazards are always visible
 * and affect any entity stepping on them each turn.
 */

import { PokemonType } from "./type-chart";

// ── Hazard Type Enum ──

export enum HazardType {
  Lava = "lava",
  Water = "water",
  ToxicSwamp = "toxicSwamp",
  IcePatch = "icePatch",
  Quicksand = "quicksand",
  ElectricFloor = "electricFloor",
}

// ── Hazard Effect Types ──

export type HazardEffect =
  | "none"         // No special effect beyond damage
  | "slow"         // Skip 1 turn (movement disabled)
  | "slide"        // Slide to next tile in movement direction
  | "trap"         // Trapped — skip next turn
  | "poison"       // Chance to inflict poison-like burn status
  | "paralyze";    // Chance to inflict paralysis

// ── Hazard Definition Interface ──

export interface HazardDef {
  id: string;
  type: HazardType;
  name: string;
  color: number;      // Phaser hex color for rendering
  damage: number;     // HP lost per step (0 = non-damaging)
  effect: HazardEffect;
  effectChance: number; // 0-1 probability of effect triggering (1.0 = always)
  immuneTypes: PokemonType[];  // Pokemon types immune to this hazard
}

// ── Hazard Definitions ──

const HAZARD_DEFS: Record<HazardType, HazardDef> = {
  [HazardType.Lava]: {
    id: "lava",
    type: HazardType.Lava,
    name: "Lava",
    color: 0xff4400,
    damage: 8,
    effect: "none",
    effectChance: 0,
    immuneTypes: [PokemonType.Fire],
  },
  [HazardType.Water]: {
    id: "water",
    type: HazardType.Water,
    name: "Water",
    color: 0x4488ff,
    damage: 0,
    effect: "slow",
    effectChance: 1.0,
    immuneTypes: [PokemonType.Water],
  },
  [HazardType.ToxicSwamp]: {
    id: "toxicSwamp",
    type: HazardType.ToxicSwamp,
    name: "Toxic Swamp",
    color: 0x884488,
    damage: 5,
    effect: "poison",
    effectChance: 0.35,
    immuneTypes: [PokemonType.Poison, PokemonType.Steel],
  },
  [HazardType.IcePatch]: {
    id: "icePatch",
    type: HazardType.IcePatch,
    name: "Ice Patch",
    color: 0xaaddff,
    damage: 0,
    effect: "slide",
    effectChance: 1.0,
    immuneTypes: [PokemonType.Ice],
  },
  [HazardType.Quicksand]: {
    id: "quicksand",
    type: HazardType.Quicksand,
    name: "Quicksand",
    color: 0xccaa66,
    damage: 3,
    effect: "trap",
    effectChance: 1.0,
    immuneTypes: [PokemonType.Flying, PokemonType.Ground],
  },
  [HazardType.ElectricFloor]: {
    id: "electricFloor",
    type: HazardType.ElectricFloor,
    name: "Electric Floor",
    color: 0xffee44,
    damage: 6,
    effect: "paralyze",
    effectChance: 0.25,
    immuneTypes: [PokemonType.Electric, PokemonType.Ground],
  },
};

// ── Public API ──

/** Get the hazard definition for a given hazard type */
export function getHazardDef(type: HazardType): HazardDef {
  return HAZARD_DEFS[type];
}

/** Check if a pokemon type grants immunity to a specific hazard */
export function isImmuneToHazard(hazardType: HazardType, pokemonTypes: PokemonType[]): boolean {
  const def = HAZARD_DEFS[hazardType];
  return pokemonTypes.some(t => def.immuneTypes.includes(t));
}

/**
 * Determine which hazard types can appear on a given floor.
 * Higher floors unlock more hazard types.
 * Some dungeons have themed hazards (volcano = lava, ocean = water, etc.)
 */
export function rollFloorHazards(floor: number, dungeonId: string): HazardType[] {
  const hazards: HazardType[] = [];

  // ── Dungeon-themed hazards (always available if dungeon matches) ──
  const dungeonThemes: Record<string, HazardType[]> = {
    // Volcano / fire themed dungeons
    magmaCavern: [HazardType.Lava],
    emberGrotto: [HazardType.Lava],
    // Water / ocean themed dungeons
    beachCave: [HazardType.Water],
    stormySea: [HazardType.Water],
    coralReef: [HazardType.Water],
    // Toxic / poison themed dungeons
    toxicSwamp: [HazardType.ToxicSwamp],
    sinisterWoods: [HazardType.ToxicSwamp],
    // Ice / frost themed dungeons
    frostyForest: [HazardType.IcePatch],
    frozenTundra: [HazardType.IcePatch],
    // Electric themed dungeons
    thunderwaveCave: [HazardType.ElectricFloor],
    voltageLab: [HazardType.ElectricFloor],
    ampPlains: [HazardType.ElectricFloor],
    // Ground / rock themed dungeons
    quakeTunnel: [HazardType.Quicksand],
    rockyCavern: [HazardType.Quicksand],
    buriedRuins: [HazardType.Quicksand],
  };

  // Add themed hazards for this dungeon
  const themed = dungeonThemes[dungeonId];
  if (themed) {
    for (const h of themed) {
      if (!hazards.includes(h)) hazards.push(h);
    }
  }

  // ── Floor-based unlocks (generic hazards become available on deeper floors) ──
  // Floor 1-2: only themed hazards
  // Floor 3+: Water, Quicksand available
  // Floor 5+: ToxicSwamp, IcePatch available
  // Floor 7+: Lava, ElectricFloor available
  // Floor 10+: all hazards available

  const floorPool: { minFloor: number; type: HazardType }[] = [
    { minFloor: 3, type: HazardType.Water },
    { minFloor: 3, type: HazardType.Quicksand },
    { minFloor: 5, type: HazardType.ToxicSwamp },
    { minFloor: 5, type: HazardType.IcePatch },
    { minFloor: 7, type: HazardType.Lava },
    { minFloor: 7, type: HazardType.ElectricFloor },
  ];

  for (const entry of floorPool) {
    if (floor >= entry.minFloor && !hazards.includes(entry.type)) {
      hazards.push(entry.type);
    }
  }

  return hazards;
}

/**
 * Decide how many ground tiles should have hazards (as a fraction).
 * Returns a value between 0.05 and 0.15, scaling with floor.
 */
export function hazardDensity(floor: number): number {
  // 5% at floor 1, +1% per floor, cap at 15%
  return Math.min(0.15, 0.05 + (floor - 1) * 0.01);
}

/** Structure for a placed hazard tile on the floor */
export interface FloorHazard {
  x: number;
  y: number;
  type: HazardType;
  def: HazardDef;
}

/**
 * Generate hazard tile placements for a dungeon floor.
 * Scatters hazards on ground tiles, avoiding stairs, spawn, and item positions.
 */
export function generateHazards(
  width: number,
  height: number,
  terrain: number[][],
  floor: number,
  dungeonId: string,
  stairsX: number,
  stairsY: number,
  playerX: number,
  playerY: number,
  occupiedPositions: Set<string>,  // "x,y" strings of tiles to avoid
  groundValue: number,
): FloorHazard[] {
  const availableTypes = rollFloorHazards(floor, dungeonId);
  if (availableTypes.length === 0) return [];

  const density = hazardDensity(floor);

  // Count ground tiles
  let groundCount = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (terrain[y]?.[x] === groundValue) groundCount++;
    }
  }

  const targetCount = Math.floor(groundCount * density);
  const hazards: FloorHazard[] = [];
  const placedSet = new Set<string>();

  for (let i = 0; i < targetCount; i++) {
    let attempts = 0;
    while (attempts < 50) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);
      const key = `${x},${y}`;

      if (terrain[y]?.[x] !== groundValue) { attempts++; continue; }
      if (x === stairsX && y === stairsY) { attempts++; continue; }
      if (x === playerX && y === playerY) { attempts++; continue; }
      // Also avoid 1-tile radius around player start
      if (Math.abs(x - playerX) <= 1 && Math.abs(y - playerY) <= 1) { attempts++; continue; }
      if (occupiedPositions.has(key)) { attempts++; continue; }
      if (placedSet.has(key)) { attempts++; continue; }

      const hazardType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      const def = HAZARD_DEFS[hazardType];
      hazards.push({ x, y, type: hazardType, def });
      placedSet.add(key);
      break;
    }
  }

  return hazards;
}
