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
  // Rock
  rockThrow: {
    id: "rockThrow",
    name: "Rock Throw",
    type: PokemonType.Rock,
    power: 12,
    pp: 15,
    range: SkillRange.Front2,
    accuracy: 85,
    description: "Hurls a rock at the target.",
  },
  // Electric
  thunderShock: {
    id: "thunderShock",
    name: "ThunderShock",
    type: PokemonType.Electric,
    power: 10,
    pp: 20,
    range: SkillRange.FrontLine,
    accuracy: 90,
    effect: SkillEffect.Paralyze,
    effectChance: 30,
    description: "Shoots electricity. May paralyze.",
  },
  spark: {
    id: "spark",
    name: "Spark",
    type: PokemonType.Electric,
    power: 14,
    pp: 15,
    range: SkillRange.Front1,
    accuracy: 90,
    effect: SkillEffect.Paralyze,
    effectChance: 30,
    description: "Charges and tackles with electricity.",
  },
  thunderWave: {
    id: "thunderWave",
    name: "Thunder Wave",
    type: PokemonType.Electric,
    power: 0,
    pp: 15,
    range: SkillRange.Front2,
    accuracy: 80,
    effect: SkillEffect.Paralyze,
    effectChance: 100,
    description: "Sends a jolt to paralyze the target.",
  },
  sonicBoom: {
    id: "sonicBoom",
    name: "SonicBoom",
    type: PokemonType.Normal,
    power: 10,
    pp: 18,
    range: SkillRange.FrontLine,
    accuracy: 85,
    description: "Shockwave attack in a line.",
  },
  selfDestruct: {
    id: "selfDestruct",
    name: "Selfdestruct",
    type: PokemonType.Normal,
    power: 30,
    pp: 3,
    range: SkillRange.Around,
    accuracy: 100,
    description: "Explodes, hitting everything nearby.",
  },
  // Bug
  stringShot: {
    id: "stringShot",
    name: "String Shot",
    type: PokemonType.Bug,
    power: 0,
    pp: 20,
    range: SkillRange.Front2,
    accuracy: 85,
    effect: SkillEffect.Paralyze,
    effectChance: 100,
    description: "Slows down the target with silk.",
  },
  bugBite: {
    id: "bugBite",
    name: "Bug Bite",
    type: PokemonType.Bug,
    power: 10,
    pp: 18,
    range: SkillRange.Front1,
    accuracy: 95,
    description: "Bites the target with mandibles.",
  },
  // Flying
  gust: {
    id: "gust",
    name: "Gust",
    type: PokemonType.Flying,
    power: 10,
    pp: 20,
    range: SkillRange.Front2,
    accuracy: 90,
    description: "Whips up a gust of wind.",
  },
  quickAttack: {
    id: "quickAttack",
    name: "Quick Attack",
    type: PokemonType.Normal,
    power: 8,
    pp: 25,
    range: SkillRange.Front1,
    accuracy: 100,
    description: "A swift, sure-hit attack.",
  },
  // Fighting
  karateChop: {
    id: "karateChop",
    name: "Karate Chop",
    type: PokemonType.Fighting,
    power: 12,
    pp: 18,
    range: SkillRange.Front1,
    accuracy: 95,
    description: "A precise chopping attack.",
  },
  lowKick: {
    id: "lowKick",
    name: "Low Kick",
    type: PokemonType.Fighting,
    power: 10,
    pp: 20,
    range: SkillRange.Front1,
    accuracy: 90,
    description: "A low sweeping kick.",
  },
  focusPunch: {
    id: "focusPunch",
    name: "Focus Punch",
    type: PokemonType.Fighting,
    power: 22,
    pp: 6,
    range: SkillRange.Front1,
    accuracy: 80,
    description: "A devastating focused punch.",
  },
  meditate: {
    id: "meditate",
    name: "Meditate",
    type: PokemonType.Fighting,
    power: 0,
    pp: 15,
    range: SkillRange.Self,
    accuracy: 100,
    effect: SkillEffect.AtkUp,
    description: "Meditates to raise ATK.",
  },
  // Steel
  metalClaw: {
    id: "metalClaw",
    name: "Metal Claw",
    type: PokemonType.Steel,
    power: 12,
    pp: 20,
    range: SkillRange.Front1,
    accuracy: 90,
    description: "Slashes with metal claws.",
  },
  ironDefense: {
    id: "ironDefense",
    name: "Iron Defense",
    type: PokemonType.Steel,
    power: 0,
    pp: 10,
    range: SkillRange.Self,
    accuracy: 100,
    effect: SkillEffect.DefUp,
    description: "Hardens the body to raise DEF.",
  },
  headbutt: {
    id: "headbutt",
    name: "Headbutt",
    type: PokemonType.Normal,
    power: 14,
    pp: 15,
    range: SkillRange.Front1,
    accuracy: 90,
    description: "A charging headbutt attack.",
  },
  // Ghost
  shadowBall: {
    id: "shadowBall",
    name: "Shadow Ball",
    type: PokemonType.Ghost,
    power: 16,
    pp: 12,
    range: SkillRange.Front2,
    accuracy: 90,
    description: "Hurls a shadowy blob. 2-tile range.",
  },
  lick: {
    id: "lick",
    name: "Lick",
    type: PokemonType.Ghost,
    power: 8,
    pp: 20,
    range: SkillRange.Front1,
    accuracy: 90,
    effect: SkillEffect.Paralyze,
    effectChance: 30,
    description: "Licks the target. May paralyze.",
  },
  nightShade: {
    id: "nightShade",
    name: "Night Shade",
    type: PokemonType.Ghost,
    power: 12,
    pp: 15,
    range: SkillRange.FrontLine,
    accuracy: 85,
    description: "Eerie shadows strike in a line.",
  },
  // Psychic
  confusion: {
    id: "confusion",
    name: "Confusion",
    type: PokemonType.Psychic,
    power: 12,
    pp: 18,
    range: SkillRange.Front2,
    accuracy: 90,
    description: "Psychic attack. 2-tile range.",
  },
  psybeam: {
    id: "psybeam",
    name: "Psybeam",
    type: PokemonType.Psychic,
    power: 16,
    pp: 12,
    range: SkillRange.FrontLine,
    accuracy: 85,
    description: "Fires a peculiar ray in a line.",
  },
  hypnosis: {
    id: "hypnosis",
    name: "Hypnosis",
    type: PokemonType.Psychic,
    power: 0,
    pp: 12,
    range: SkillRange.Front2,
    accuracy: 70,
    effect: SkillEffect.Paralyze,
    effectChance: 100,
    description: "Puts the target to sleep (paralyze).",
  },
  // Ice
  iceBeam: {
    id: "iceBeam",
    name: "Ice Beam",
    type: PokemonType.Ice,
    power: 16,
    pp: 10,
    range: SkillRange.FrontLine,
    accuracy: 90,
    description: "Fires an icy beam in a line.",
  },
  iceShard: {
    id: "iceShard",
    name: "Ice Shard",
    type: PokemonType.Ice,
    power: 10,
    pp: 20,
    range: SkillRange.Front1,
    accuracy: 100,
    description: "An icy priority attack.",
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
