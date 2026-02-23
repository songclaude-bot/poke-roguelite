import { Direction, DIR_DX, DIR_DY } from "./direction";
import { TerrainType } from "./dungeon-generator";
import { Entity, canMoveTo, canMoveDiagonal, chebyshevDist } from "./entity";

const DETECTION_RANGE = 5; // tiles

/**
 * Determine the best direction for an enemy to move toward the player.
 * Returns the direction to move, or null if should stay (adjacent or blocked).
 */
export function getEnemyMoveDirection(
  enemy: Entity,
  player: Entity,
  terrain: TerrainType[][],
  width: number,
  height: number,
  entities: Entity[]
): Direction | null {
  const dist = chebyshevDist(enemy.tileX, enemy.tileY, player.tileX, player.tileY);

  // Too far: wander or stay
  if (dist > DETECTION_RANGE) return null;

  // Adjacent (dist=1): don't move, will attack instead
  if (dist <= 1) return null;

  // Try to move toward player: pick the best of 8 directions
  let bestDir: Direction | null = null;
  let bestDist = dist;

  for (let d = 0; d < 8; d++) {
    const dir = d as Direction;
    const nx = enemy.tileX + DIR_DX[dir];
    const ny = enemy.tileY + DIR_DY[dir];

    if (!canMoveTo(nx, ny, terrain, width, height, entities, enemy)) continue;
    if (!canMoveDiagonal(enemy.tileX, enemy.tileY, dir, terrain, width, height)) continue;

    const newDist = chebyshevDist(nx, ny, player.tileX, player.tileY);
    if (newDist < bestDist) {
      bestDist = newDist;
      bestDir = dir;
    }
  }

  return bestDir;
}

/**
 * Check if enemy is adjacent to player (Chebyshev dist = 1).
 */
export function isAdjacentToPlayer(enemy: Entity, player: Entity): boolean {
  return chebyshevDist(enemy.tileX, enemy.tileY, player.tileX, player.tileY) === 1;
}

/**
 * Get the direction from enemy to player (for facing/attack).
 */
export function directionToPlayer(enemy: Entity, player: Entity): Direction {
  const dx = Math.sign(player.tileX - enemy.tileX);
  const dy = Math.sign(player.tileY - enemy.tileY);

  // Map (dx, dy) to Direction
  if (dx === 0 && dy === -1) return Direction.Up;
  if (dx === 1 && dy === -1) return Direction.UpRight;
  if (dx === 1 && dy === 0) return Direction.Right;
  if (dx === 1 && dy === 1) return Direction.DownRight;
  if (dx === 0 && dy === 1) return Direction.Down;
  if (dx === -1 && dy === 1) return Direction.DownLeft;
  if (dx === -1 && dy === 0) return Direction.Left;
  if (dx === -1 && dy === -1) return Direction.UpLeft;
  return Direction.Down; // fallback
}
