/**
 * Skill (Move) system — PMD-style 4-skill slot system.
 * PP is consumed on use. 1 PP recovered per movement turn.
 */

import { PokemonType } from "./type-chart";

/** Targeting range of a skill */
export enum SkillRange {
  /** Adjacent 1 tile in facing direction */
  Front1 = "front1",
  /** 2 tiles in facing direction */
  Front2 = "front2",
  /** Straight line in facing direction (up to 10 tiles, piercing) */
  FrontLine = "frontLine",
  /** All 8 adjacent tiles around self */
  Around = "around",
  /** Entire room (or radius 3 in corridor) */
  Room = "room",
  /** Self only (buff/heal) */
  Self = "self",
}

/** Effect applied on hit */
export enum SkillEffect {
  None = "none",
  AtkUp = "atkUp",         // +50% ATK for 5 turns
  DefUp = "defUp",         // +50% DEF for 5 turns
  Heal = "heal",           // Restore HP
  Burn = "burn",           // DoT: 5 dmg/turn for 3 turns
  Paralyze = "paralyze",   // 50% chance to skip turn for 3 turns
}

export interface Skill {
  id: string;
  name: string;
  type: PokemonType;
  power: number;          // 0 = non-damaging (buff/heal)
  pp: number;             // max PP
  currentPp: number;      // current PP
  range: SkillRange;
  accuracy: number;       // 0-100, percentage
  effect?: SkillEffect;
  effectChance?: number;  // 0-100, percentage to apply effect
  description: string;
}

/** Create a fresh skill instance from a template */
export function createSkill(template: Omit<Skill, "currentPp">): Skill {
  return { ...template, currentPp: template.pp };
}

// ─── Skill Database ───

export const SKILL_DB: Record<string, Omit<Skill, "currentPp">> = {
  tackle: {
    id: "tackle",
    name: "Tackle",
    type: PokemonType.Normal,
    power: 8,
    pp: 25,
    range: SkillRange.Front1,
    accuracy: 95,
    description: "A basic charge attack.",
  },
  waterGun: {
    id: "waterGun",
    name: "Water Gun",
    type: PokemonType.Water,
    power: 12,
    pp: 18,
    range: SkillRange.FrontLine,
    accuracy: 90,
    description: "Shoots a stream of water in a line.",
  },
  waterPulse: {
    id: "waterPulse",
    name: "Water Pulse",
    type: PokemonType.Water,
    power: 15,
    pp: 12,
    range: SkillRange.Front2,
    accuracy: 85,
    description: "Sends out a pulse of water. 2-tile range.",
  },
  surf: {
    id: "surf",
    name: "Surf",
    type: PokemonType.Water,
    power: 18,
    pp: 8,
    range: SkillRange.Room,
    accuracy: 90,
    description: "Hits all enemies in the room with a wave.",
  },
  swordsDance: {
    id: "swordsDance",
    name: "Swords Dance",
    type: PokemonType.Normal,
    power: 0,
    pp: 10,
    range: SkillRange.Self,
    accuracy: 100,
    effect: SkillEffect.AtkUp,
    description: "Raises ATK by 50% for 5 turns.",
  },
  // Zubat skills
  wingAttack: {
    id: "wingAttack",
    name: "Wing Attack",
    type: PokemonType.Flying,
    power: 12,
    pp: 20,
    range: SkillRange.Front1,
    accuracy: 95,
    description: "Strikes with wings.",
  },
  leechLife: {
    id: "leechLife",
    name: "Leech Life",
    type: PokemonType.Bug,
    power: 10,
    pp: 12,
    range: SkillRange.Front1,
    accuracy: 90,
    description: "Drains HP from the target.",
  },
  poisonSting: {
    id: "poisonSting",
    name: "Poison Sting",
    type: PokemonType.Poison,
    power: 8,
    pp: 20,
    range: SkillRange.Front2,
    accuracy: 90,
    description: "A toxic barb. 2-tile range.",
  },
  supersonic: {
    id: "supersonic",
    name: "Supersonic",
    type: PokemonType.Normal,
    power: 0,
    pp: 15,
    range: SkillRange.FrontLine,
    accuracy: 70,
    effect: SkillEffect.Paralyze,
    effectChance: 100,
    description: "Confusing sound waves. May paralyze.",
  },
};

/** Get default skills for a pokemon by sprite key */
export function getDefaultSkills(spriteKey: string): Skill[] {
  switch (spriteKey) {
    case "mudkip":
      return [
        createSkill(SKILL_DB.tackle),
        createSkill(SKILL_DB.waterGun),
        createSkill(SKILL_DB.waterPulse),
        createSkill(SKILL_DB.swordsDance),
      ];
    case "zubat":
      return [
        createSkill(SKILL_DB.wingAttack),
        createSkill(SKILL_DB.leechLife),
        createSkill(SKILL_DB.poisonSting),
        createSkill(SKILL_DB.supersonic),
      ];
    default:
      return [createSkill(SKILL_DB.tackle)];
  }
}
