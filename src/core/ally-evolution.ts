/**
 * Ally Evolution System — allies can evolve when they reach the required level.
 * Evolution changes their species, stats, types, and potentially learns new skills.
 *
 * Allies share a fraction of EXP when enemies are defeated. When they level up,
 * they are checked for evolution using the same EvolutionDef table as the player.
 */

import { Entity } from "./entity";
import { getEvolution, EvolutionDef } from "./evolution";
import { SPECIES } from "./pokemon-data";
import { SKILL_DB, createSkill } from "./skill";
import { processLevelUp, LevelUpResult } from "./leveling";

/** Fraction of EXP that allies receive (50% of what the player gets) */
const ALLY_EXP_SHARE = 0.5;

export interface AllyEvolutionResult {
  oldSpeciesId: string;
  newSpeciesId: string;
  oldName: string;
  newName: string;
  hpGain: number;
  atkGain: number;
  defGain: number;
  newSkill?: string; // skill name if learned
}

export interface AllyLevelUpResult {
  ally: Entity;
  levelUps: LevelUpResult[];
  evolution?: AllyEvolutionResult;
}

/**
 * Check if an ally can evolve at their current level.
 * Uses getEvolution() from evolution.ts.
 */
export function canAllyEvolve(speciesId: string, level: number): boolean {
  return getEvolution(speciesId, level) !== null;
}

/**
 * Perform the evolution — update entity stats, species, and potentially learn a new skill.
 * Returns evolution result details for display.
 */
export function evolveAlly(entity: Entity, evoDef: EvolutionDef): AllyEvolutionResult {
  const oldSpeciesId = entity.speciesId ?? "";
  const oldName = entity.name;

  // Apply stat bonuses from the evolution
  entity.stats.maxHp += evoDef.hpBonus;
  entity.stats.hp += evoDef.hpBonus;
  entity.stats.atk += evoDef.atkBonus;
  entity.stats.def += evoDef.defBonus;

  // Update species identity
  entity.speciesId = evoDef.to;
  entity.name = evoDef.newName;

  // Update types and attack type from new species data
  const newSpecies = SPECIES[evoDef.to];
  if (newSpecies) {
    entity.types = newSpecies.types;
    entity.attackType = newSpecies.attackType;
    entity.spriteKey = newSpecies.spriteKey;
  }

  // Try to learn new skill
  let newSkillName: string | undefined;
  if (evoDef.newSkillId && SKILL_DB[evoDef.newSkillId]) {
    const alreadyKnown = entity.skills.some(s => s.id === evoDef.newSkillId);
    if (!alreadyKnown) {
      if (entity.skills.length < 4) {
        entity.skills.push(createSkill(SKILL_DB[evoDef.newSkillId]));
      } else {
        // Replace weakest skill (lowest power)
        const weakestIdx = entity.skills.reduce((minIdx, s, i) =>
          s.power < entity.skills[minIdx].power ? i : minIdx, 0
        );
        entity.skills[weakestIdx] = createSkill(SKILL_DB[evoDef.newSkillId]);
      }
      newSkillName = SKILL_DB[evoDef.newSkillId].name;
    }
  }

  return {
    oldSpeciesId,
    newSpeciesId: evoDef.to,
    oldName,
    newName: evoDef.newName,
    hpGain: evoDef.hpBonus,
    atkGain: evoDef.atkBonus,
    defGain: evoDef.defBonus,
    newSkill: newSkillName,
  };
}

/**
 * Distribute EXP to all living allies and process level ups + evolution.
 * Returns an array of results for each ally that leveled up or evolved.
 *
 * @param allies - Array of ally entities
 * @param expGain - The base EXP the player earned (allies get ALLY_EXP_SHARE of this)
 * @returns Array of per-ally results (only includes allies that leveled up)
 */
export function distributeAllyExp(
  allies: Entity[],
  expGain: number,
): AllyLevelUpResult[] {
  const allyExp = Math.floor(expGain * ALLY_EXP_SHARE);
  if (allyExp <= 0) return [];

  const results: AllyLevelUpResult[] = [];

  for (const ally of allies) {
    if (!ally.alive || !ally.speciesId) continue;

    // Allies use a simple per-entity totalExp tracking approach:
    // Since allies don't have persistent totalExp, we compute it from their current level
    // and add the new EXP, then use processLevelUp to check for level ups.
    // We track allyTotalExp on the entity itself as an ad-hoc property.
    const allyEntity = ally as Entity & { allyTotalExp?: number };
    if (allyEntity.allyTotalExp === undefined) {
      // Initialize: assume they are at the start of their current level
      allyEntity.allyTotalExp = 0;
    }
    allyEntity.allyTotalExp += allyExp;

    // Process level ups
    const levelResult = processLevelUp(ally.stats, allyExp, allyEntity.allyTotalExp);
    allyEntity.allyTotalExp = levelResult.totalExp;

    if (levelResult.results.length === 0) continue;

    const allyResult: AllyLevelUpResult = {
      ally,
      levelUps: levelResult.results,
    };

    // Check for evolution on the latest level
    const latestLevel = levelResult.results[levelResult.results.length - 1].newLevel;
    const evoDef = getEvolution(ally.speciesId, latestLevel);
    if (evoDef) {
      allyResult.evolution = evolveAlly(ally, evoDef);
    }

    results.push(allyResult);
  }

  return results;
}
