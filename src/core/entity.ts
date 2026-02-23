import { Direction, DIR_DX, DIR_DY } from "./direction";
import { TerrainType } from "./dungeon-generator";
import { PokemonType } from "./type-chart";
import { Skill } from "./skill";
import { SkillEffect } from "./skill";
import { AbilityId } from "./ability";

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
  sturdyUsed?: boolean; // track if Sturdy was consumed this floor
}

/** Get effective ATK (with buffs + abilities) */
export function getEffectiveAtk(entity: Entity): number {
  let atk = entity.stats.atk;
  // Ability: Pure Power (+30% always)
  if (entity.ability === AbilityId.PurePower) atk = Math.floor(atk * 1.3);
  // Ability: Guts (+50% when has status effect)
  if (entity.ability === AbilityId.Guts && entity.statusEffects.length > 0) atk = Math.floor(atk * 1.5);
  // Buff: AtkUp (+50%)
  const hasAtkUp = entity.statusEffects.some(s => s.type === SkillEffect.AtkUp);
  if (hasAtkUp) atk = Math.floor(atk * 1.5);
  return atk;
}

/** Get effective DEF (with buffs) */
export function getEffectiveDef(entity: Entity): number {
  const hasDefUp = entity.statusEffects.some(s => s.type === SkillEffect.DefUp);
  return hasDefUp ? Math.floor(entity.stats.def * 1.5) : entity.stats.def;
}

/** Tick status effects at end of turn, remove expired ones */
export function tickStatusEffects(entity: Entity): string[] {
  const messages: string[] = [];
  entity.statusEffects = entity.statusEffects.filter(s => {
    s.turnsLeft--;
    if (s.turnsLeft <= 0) {
      messages.push(`${entity.name}'s ${s.type} wore off.`);
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
