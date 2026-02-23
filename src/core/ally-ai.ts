import { Direction, DIR_DX, DIR_DY } from "./direction";
import { TerrainType } from "./dungeon-generator";
import { Entity, canMoveTo, canMoveDiagonal, chebyshevDist } from "./entity";

const ALLY_FOLLOW_DIST = 3; // try to stay within 3 tiles of player

/** Recruitment chance after defeating an enemy */
export function recruitChance(playerLevel: number, enemyLevel: number): number {
  // Base 15%, +2% per level advantage, capped at 40%
  const levelBonus = Math.max(0, (playerLevel - enemyLevel) * 2);
  return Math.min(40, 15 + levelBonus);
}

/** Check if recruitment roll succeeds */
export function tryRecruit(playerLevel: number, enemyLevel: number): boolean {
  return Math.random() * 100 < recruitChance(playerLevel, enemyLevel);
}

/** Find closest enemy to an ally within range */
export function findNearestEnemy(
  ally: Entity,
  enemies: Entity[],
  range: number = 5
): Entity | null {
  let nearest: Entity | null = null;
  let nearestDist = range + 1;
  for (const e of enemies) {
    if (!e.alive || e.isAlly) continue;
    const d = chebyshevDist(ally.tileX, ally.tileY, e.tileX, e.tileY);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = e;
    }
  }
  return nearest;
}

/** Determine direction from entity A to entity B */
export function directionTo(from: Entity, to: Entity): Direction {
  const dx = Math.sign(to.tileX - from.tileX);
  const dy = Math.sign(to.tileY - from.tileY);

  if (dx === 0 && dy === -1) return Direction.Up;
  if (dx === 1 && dy === -1) return Direction.UpRight;
  if (dx === 1 && dy === 0) return Direction.Right;
  if (dx === 1 && dy === 1) return Direction.DownRight;
  if (dx === 0 && dy === 1) return Direction.Down;
  if (dx === -1 && dy === 1) return Direction.DownLeft;
  if (dx === -1 && dy === 0) return Direction.Left;
  if (dx === -1 && dy === -1) return Direction.UpLeft;
  return Direction.Down;
}

/** Get the best move direction for an ally — follow player, attack nearby enemies */
export function getAllyMoveDirection(
  ally: Entity,
  player: Entity,
  enemies: Entity[],
  terrain: TerrainType[][],
  width: number,
  height: number,
  allEntities: Entity[]
): { moveDir: Direction | null; attackTarget: Entity | null } {
  // Check if adjacent to an enemy — attack instead of moving
  for (const e of enemies) {
    if (!e.alive || e.isAlly) continue;
    if (chebyshevDist(ally.tileX, ally.tileY, e.tileX, e.tileY) === 1) {
      return { moveDir: null, attackTarget: e };
    }
  }

  // Check if there's a nearby enemy to chase
  const nearestEnemy = findNearestEnemy(ally, enemies, 4);
  const distToPlayer = chebyshevDist(ally.tileX, ally.tileY, player.tileX, player.tileY);

  // Choose target: chase enemy if close, otherwise follow player
  let target: Entity;
  if (nearestEnemy && distToPlayer <= ALLY_FOLLOW_DIST + 2) {
    target = nearestEnemy;
  } else {
    target = player;
  }

  // Don't move if already adjacent to target
  const distToTarget = chebyshevDist(ally.tileX, ally.tileY, target.tileX, target.tileY);
  if (distToTarget <= 1) return { moveDir: null, attackTarget: null };

  // Find best direction toward target
  let bestDir: Direction | null = null;
  let bestDist = distToTarget;

  for (let d = 0; d < 8; d++) {
    const dir = d as Direction;
    const nx = ally.tileX + DIR_DX[dir];
    const ny = ally.tileY + DIR_DY[dir];

    if (!canMoveTo(nx, ny, terrain, width, height, allEntities, ally)) continue;
    if (!canMoveDiagonal(ally.tileX, ally.tileY, dir, terrain, width, height)) continue;

    const newDist = chebyshevDist(nx, ny, target.tileX, target.tileY);
    if (newDist < bestDist) {
      bestDist = newDist;
      bestDir = dir;
    }
  }

  return { moveDir: bestDir, attackTarget: null };
}
