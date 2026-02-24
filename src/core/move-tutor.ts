/**
 * Move Tutor — lets the player teach their starter new skills using gold.
 * Available skills are determined by the starter's types (STAB + Normal).
 */

import { SKILL_DB } from "./skill";
import { SPECIES } from "./pokemon-data";
import { PokemonType } from "./type-chart";

export interface TutorMove {
  skillId: string;
  cost: number;           // gold cost
  requiredClears: number; // unlock condition (totalClears)
}

/**
 * Get available tutor moves for a given starter species.
 * Includes same-type (STAB) skills and Normal-type skills.
 * Filters by totalClears for progressive unlocking.
 */
export function getAvailableTutorMoves(starterId: string, totalClears: number): TutorMove[] {
  const species = SPECIES[starterId];
  if (!species) return [];

  const starterTypes: PokemonType[] = species.types;
  const moves: TutorMove[] = [];

  for (const [id, skill] of Object.entries(SKILL_DB)) {
    const isSTAB = starterTypes.includes(skill.type);
    const isNormal = skill.type === PokemonType.Normal;

    if (!isSTAB && !isNormal) continue;

    // Cost based on power tier:
    // Low power (0-10):   100-160G  (early, cheap)
    // Mid power (11-16):  200-340G  (mid-game)
    // High power (17+):   400-600G  (late-game, expensive)
    let cost: number;
    if (skill.power === 0) {
      // Status/buff moves: moderate cost
      cost = 150;
    } else if (skill.power <= 10) {
      cost = 80 + skill.power * 8;
    } else if (skill.power <= 16) {
      cost = 120 + skill.power * 14;
    } else {
      cost = 200 + skill.power * 18;
    }

    // STAB bonus skills are slightly cheaper than off-type
    if (isSTAB && !isNormal) {
      cost = Math.floor(cost * 0.85);
    }

    // Required clears: higher power = more clears needed
    let reqClears: number;
    if (skill.power <= 10) {
      reqClears = 0;
    } else if (skill.power <= 14) {
      reqClears = 1;
    } else if (skill.power <= 18) {
      reqClears = 3;
    } else {
      reqClears = 5;
    }

    moves.push({
      skillId: id,
      cost,
      requiredClears: reqClears,
    });
  }

  // Filter by required clears and sort by cost
  return moves
    .filter(m => m.requiredClears <= totalClears)
    .sort((a, b) => a.cost - b.cost);
}
