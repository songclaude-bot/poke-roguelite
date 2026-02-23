import { Direction, DIR_DX, DIR_DY } from "./direction";
import { TerrainType } from "./dungeon-generator";

export interface EntityStats {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  level: number;
}

export interface Entity {
  tileX: number;
  tileY: number;
  facing: Direction;
  stats: EntityStats;
  alive: boolean;
  sprite?: Phaser.GameObjects.Sprite;
  spriteKey: string; // e.g. "mudkip" or "zubat"
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
