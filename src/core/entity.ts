import { Direction, DIR_DX, DIR_DY } from "./direction";
import { TerrainType } from "./dungeon-generator";
import { PokemonType } from "./type-chart";
import { Skill } from "./skill";
import { SkillEffect } from "./skill";
import { AbilityId } from "./ability";
import {
  getGutsMultiplier,
  getPurePowerMultiplier,
  getNoGuardAtkBonus,
  getRockHeadDefBonus,
  getShieldDustDefBonus,
} from "./ability-upgrade";

/** Ally tactic modes for the command system */
export enum AllyTactic {
  FollowMe = "followMe",       // Default: follow player, attack nearby enemies
  GoAfterFoes = "goAfterFoes", // Aggressively pursue enemies in range
  StayHere = "stayHere",       // Stay in current position, attack if adjacent
  Scatter = "scatter",         // Spread out, explore independently
}

export interface EntityStats {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  level: number;
}

export interface StatusEffect {
  type: SkillEffect;
  turnsLeft: number;
  /** Badly Poisoned: tracks escalating damage (1, 2, 3, ...) */
  poisonCounter?: number;
  /** Cursed: tracks turns elapsed since curse started (triggers every 4 turns) */
  curseTick?: number;
}

export interface Entity {
  tileX: number;
  tileY: number;
  facing: Direction;
  stats: EntityStats;
  alive: boolean;
  sprite?: Phaser.GameObjects.Sprite;
  spriteKey: string; // e.g. "mudkip" or "zubat"
  name: string; // display name e.g. "Mudkip"
  types: PokemonType[]; // pokemon types for effectiveness calc
  attackType: PokemonType; // type of basic attack (STAB type)
  skills: Skill[];
  statusEffects: StatusEffect[];
  isAlly?: boolean; // true if recruited ally
  isBoss?: boolean; // true if floor boss
  speciesId?: string; // species key for serialization
  ability?: AbilityId; // passive ability
  abilityLevel?: number; // ability upgrade level (1-5, default 1)
  sturdyUsed?: boolean; // track if Sturdy was consumed this floor
  allyTactic?: AllyTactic; // current tactic mode for ally command system
}

/** Get effective ATK (with buffs + abilities, scaled by ability level) */
export function getEffectiveAtk(entity: Entity): number {
  let atk = entity.stats.atk;
  const aLv = entity.abilityLevel ?? 1;
  // Ability: Pure Power (scaled by level)
  if (entity.ability === AbilityId.PurePower) atk = Math.floor(atk * getPurePowerMultiplier(aLv));
  // Ability: Guts (scaled by level)
  if (entity.ability === AbilityId.Guts && entity.statusEffects.length > 0) atk = Math.floor(atk * getGutsMultiplier(aLv));
  // Ability: No Guard bonus ATK at higher levels
  if (entity.ability === AbilityId.NoGuard) atk = Math.floor(atk * getNoGuardAtkBonus(aLv));
  // Buff: AtkUp (+50%)
  const hasAtkUp = entity.statusEffects.some(s => s.type === SkillEffect.AtkUp);
  if (hasAtkUp) atk = Math.floor(atk * 1.5);
  return atk;
}

/** Get effective DEF (with buffs + abilities, scaled by ability level) */
export function getEffectiveDef(entity: Entity): number {
  let def = entity.stats.def;
  const aLv = entity.abilityLevel ?? 1;
  // Ability: Rock Head bonus DEF at higher levels
  if (entity.ability === AbilityId.RockHead) def = Math.floor(def * getRockHeadDefBonus(aLv));
  // Ability: Shield Dust bonus DEF at higher levels
  if (entity.ability === AbilityId.ShieldDust) def = Math.floor(def * getShieldDustDefBonus(aLv));
  // Buff: DefUp (+50%)
  const hasDefUp = entity.statusEffects.some(s => s.type === SkillEffect.DefUp);
  if (hasDefUp) def = Math.floor(def * 1.5);
  return def;
}

/** Human-readable labels for status effect wear-off messages */
const STATUS_WORE_OFF_LABEL: Record<string, string> = {
  [SkillEffect.Burn]: "Burn",
  [SkillEffect.Paralyze]: "Paralysis",
  [SkillEffect.AtkUp]: "ATK boost",
  [SkillEffect.DefUp]: "DEF boost",
  [SkillEffect.Frozen]: "Freeze",
  [SkillEffect.BadlyPoisoned]: "Bad Poison",
  [SkillEffect.Flinch]: "Flinch",
  [SkillEffect.Drowsy]: "Drowsiness",
  [SkillEffect.Cursed]: "Curse",
};

/** Tick status effects at end of turn, remove expired ones */
export function tickStatusEffects(entity: Entity): string[] {
  const messages: string[] = [];
  entity.statusEffects = entity.statusEffects.filter(s => {
    // Frozen: 20% chance to thaw early each turn
    if (s.type === SkillEffect.Frozen && Math.random() < 0.2) {
      messages.push(`${entity.name} thawed out!`);
      return false;
    }

    // Badly Poisoned: increment damage counter each tick
    if (s.type === SkillEffect.BadlyPoisoned) {
      s.poisonCounter = (s.poisonCounter ?? 0) + 1;
    }

    // Cursed: increment curse tick counter
    if (s.type === SkillEffect.Cursed) {
      s.curseTick = (s.curseTick ?? 0) + 1;
    }

    s.turnsLeft--;
    if (s.turnsLeft <= 0) {
      const label = STATUS_WORE_OFF_LABEL[s.type] ?? s.type;
      messages.push(`${entity.name}'s ${label} wore off!`);
      return false;
    }
    return true;
  });
  return messages;
}

/** Check if entity is paralyzed (50% skip) */
export function isParalyzed(entity: Entity): boolean {
  return entity.statusEffects.some(s => s.type === SkillEffect.Paralyze) && Math.random() < 0.5;
}

/** Check if entity is frozen (always skip while frozen) */
export function isFrozen(entity: Entity): boolean {
  return entity.statusEffects.some(s => s.type === SkillEffect.Frozen);
}

/** Check if entity flinched (skip one turn, auto-remove) */
export function isFlinched(entity: Entity): boolean {
  const flinch = entity.statusEffects.find(s => s.type === SkillEffect.Flinch);
  if (flinch) {
    // Remove flinch immediately after checking — it's a one-turn effect
    entity.statusEffects = entity.statusEffects.filter(s => s.type !== SkillEffect.Flinch);
    return true;
  }
  return false;
}

/** Check if drowsy entity falls asleep this turn (30% chance) */
export function isDrowsySleep(entity: Entity): boolean {
  return entity.statusEffects.some(s => s.type === SkillEffect.Drowsy) && Math.random() < 0.3;
}

/** Remove freeze status (e.g. when hit by fire) */
export function thawEntity(entity: Entity): boolean {
  const wasFrozen = entity.statusEffects.some(s => s.type === SkillEffect.Frozen);
  if (wasFrozen) {
    entity.statusEffects = entity.statusEffects.filter(s => s.type !== SkillEffect.Frozen);
  }
  return wasFrozen;
}

/** Get the current badly poisoned damage for this tick */
export function getBadlyPoisonedDamage(entity: Entity): number {
  const bp = entity.statusEffects.find(s => s.type === SkillEffect.BadlyPoisoned);
  return bp ? (bp.poisonCounter ?? 1) : 0;
}

/** Check if cursed entity should take damage this tick (every 4 turns) */
export function getCurseDamage(entity: Entity): number {
  const curse = entity.statusEffects.find(s => s.type === SkillEffect.Cursed);
  if (!curse) return 0;
  // Damage triggers every 4 ticks
  if ((curse.curseTick ?? 0) % 4 === 0 && (curse.curseTick ?? 0) > 0) {
    return Math.max(1, Math.floor(entity.stats.maxHp * 0.25));
  }
  return 0;
}

/**
 * Check if a tile is walkable and not occupied by another entity.
 */
export function canMoveTo(
  x: number,
  y: number,
  terrain: TerrainType[][],
  width: number,
  height: number,
  entities: Entity[],
  self: Entity
): boolean {
  if (x < 0 || x >= width || y < 0 || y >= height) return false;
  if (terrain[y][x] !== TerrainType.GROUND) return false;
  // Check no other living entity occupies this tile
  for (const e of entities) {
    if (e !== self && e.alive && e.tileX === x && e.tileY === y) return false;
  }
  return true;
}

/**
 * Check if diagonal movement is valid (both adjacent cardinals must be passable).
 */
export function canMoveDiagonal(
  fromX: number,
  fromY: number,
  dir: Direction,
  terrain: TerrainType[][],
  width: number,
  height: number
): boolean {
  const dx = DIR_DX[dir];
  const dy = DIR_DY[dir];
  if (dx === 0 || dy === 0) return true; // not diagonal
  // Both adjacent cardinal tiles must be ground
  if (fromY + dy < 0 || fromY + dy >= height) return false;
  if (fromX + dx < 0 || fromX + dx >= width) return false;
  return (
    terrain[fromY][fromX + dx] === TerrainType.GROUND &&
    terrain[fromY + dy][fromX] === TerrainType.GROUND
  );
}

/**
 * Simple Manhattan distance.
 */
export function manhattanDist(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/**
 * Chebyshev distance (allows diagonals = 1 step).
 */
export function chebyshevDist(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}
