/**
 * Pokemon species data — defines stats, types, sprites, skills for each species.
 */

import { PokemonType } from "./type-chart";
import { SKILL_DB, createSkill, Skill, SkillRange } from "./skill";

export interface PokemonSpecies {
  id: string;
  name: string;
  spriteKey: string;
  types: PokemonType[];
  attackType: PokemonType;
  /** Base stats at level 1 */
  baseStats: { hp: number; atk: number; def: number };
  /** Sprite dimensions */
  walkFrameWidth: number;
  walkFrameHeight: number;
  idleFrameWidth: number;
  idleFrameHeight: number;
  walkFrames: number;
  idleFrames: number;
  /** Skill IDs for this species */
  skillIds: string[];
  /** Which floors this enemy appears on (1-indexed) */
  floors: number[];
}

export const SPECIES: Record<string, PokemonSpecies> = {
  mudkip: {
    id: "mudkip",
    name: "Mudkip",
    spriteKey: "mudkip",
    types: [PokemonType.Water],
    attackType: PokemonType.Water,
    baseStats: { hp: 50, atk: 12, def: 6 },
    walkFrameWidth: 32, walkFrameHeight: 40,
    idleFrameWidth: 24, idleFrameHeight: 40,
    walkFrames: 6, idleFrames: 7,
    skillIds: ["tackle", "waterGun", "waterPulse", "swordsDance"],
    floors: [],
  },
  zubat: {
    id: "zubat",
    name: "Zubat",
    spriteKey: "zubat",
    types: [PokemonType.Poison, PokemonType.Flying],
    attackType: PokemonType.Flying,
    baseStats: { hp: 20, atk: 8, def: 3 },
    walkFrameWidth: 32, walkFrameHeight: 56,
    idleFrameWidth: 32, idleFrameHeight: 56,
    walkFrames: 8, idleFrames: 8,
    skillIds: ["wingAttack", "leechLife", "poisonSting", "supersonic"],
    floors: [1, 2, 3],
  },
  shellos: {
    id: "shellos",
    name: "Shellos",
    spriteKey: "shellos",
    types: [PokemonType.Water],
    attackType: PokemonType.Water,
    baseStats: { hp: 25, atk: 7, def: 5 },
    walkFrameWidth: 32, walkFrameHeight: 32,
    idleFrameWidth: 24, idleFrameHeight: 24,
    walkFrames: 6, idleFrames: 3,
    skillIds: ["waterGun", "tackle"],
    floors: [2, 3, 4],
  },
  corsola: {
    id: "corsola",
    name: "Corsola",
    spriteKey: "corsola",
    types: [PokemonType.Water, PokemonType.Rock],
    attackType: PokemonType.Water,
    baseStats: { hp: 30, atk: 9, def: 7 },
    walkFrameWidth: 24, walkFrameHeight: 32,
    idleFrameWidth: 24, idleFrameHeight: 32,
    walkFrames: 4, idleFrames: 3,
    skillIds: ["tackle", "waterGun"],
    floors: [3, 4, 5],
  },
  geodude: {
    id: "geodude",
    name: "Geodude",
    spriteKey: "geodude",
    types: [PokemonType.Rock, PokemonType.Ground],
    attackType: PokemonType.Rock,
    baseStats: { hp: 28, atk: 11, def: 8 },
    walkFrameWidth: 32, walkFrameHeight: 32,
    idleFrameWidth: 32, idleFrameHeight: 24,
    walkFrames: 4, idleFrames: 4,
    skillIds: ["tackle"],
    floors: [4, 5],
  },
};

/** Add Rock Throw to skill DB for Geodude */
if (!SKILL_DB.rockThrow) {
  SKILL_DB.rockThrow = {
    id: "rockThrow",
    name: "Rock Throw",
    type: PokemonType.Rock,
    power: 12,
    pp: 15,
    range: SkillRange.Front2,
    accuracy: 85,
    description: "Hurls a rock at the target.",
  };
  // Update geodude skills
  SPECIES.geodude.skillIds = ["tackle", "rockThrow"];
}

/** Get enemy species that appear on a given floor */
export function getFloorEnemies(floor: number): PokemonSpecies[] {
  return Object.values(SPECIES).filter(s => s.floors.includes(floor));
}

/** Create skills from species skill IDs */
export function createSpeciesSkills(species: PokemonSpecies): Skill[] {
  return species.skillIds
    .filter(id => SKILL_DB[id])
    .map(id => createSkill(SKILL_DB[id]));
}
