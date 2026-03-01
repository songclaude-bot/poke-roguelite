import { Direction, DIR_DX, DIR_DY } from "./direction";
import { TerrainType } from "./dungeon-generator";
import { Entity, canMoveTo, canMoveDiagonal, chebyshevDist } from "./entity";

const DETECTION_RANGE = 5; // tiles
const BFS_MAX_DIST = 12; // max BFS search depth (tiles)

// 8 directions: cardinal first for more natural corridor movement
const BFS_DIRS: { dx: number; dy: number }[] = [
  { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
  { dx: 1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 },
];

function dxdyToDirection(dx: number, dy: number): Direction | null {
  for (let d = 0; d < 8; d++) {
    if (DIR_DX[d as Direction] === dx && DIR_DY[d as Direction] === dy) {
      return d as Direction;
    }
  }
  return null;
}

/**
 * Determine the best direction for an enemy to move toward the player
 * using BFS pathfinding. Returns the direction for the first step,
 * or null if should stay (adjacent, out of range, or no path).
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

  // BFS from enemy to player (bounded by BFS_MAX_DIST)
  const ex = enemy.tileX;
  const ey = enemy.tileY;
  const px = player.tileX;
  const py = player.tileY;

  // Use flat arrays for performance (avoid 2D allocation per enemy per turn)
  const size = width * height;
  const visited = new Uint8Array(size);
  const parentDx = new Int8Array(size);
  const parentDy = new Int8Array(size);

  visited[ey * width + ex] = 1;
  const queue: number[] = [ex, ey]; // flat pairs: x, y
  let head = 0;

  while (head < queue.length) {
    const cx = queue[head++];
    const cy = queue[head++];
    const cIdx = cy * width + cx;

    // BFS depth limit
    // Count steps by tracing back (approximate via Chebyshev from start)
    if (chebyshevDist(cx, cy, ex, ey) > BFS_MAX_DIST) continue;

    for (const d of BFS_DIRS) {
      const nx = cx + d.dx;
      const ny = cy + d.dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (visited[nIdx]) continue;
      if (terrain[ny][nx] !== TerrainType.GROUND) continue;

      // Diagonal wall-clip prevention
      if (d.dx !== 0 && d.dy !== 0) {
        if (terrain[cy][cx + d.dx] !== TerrainType.GROUND) continue;
        if (terrain[cy + d.dy][cx] !== TerrainType.GROUND) continue;
      }

      visited[nIdx] = 1;
      parentDx[nIdx] = d.dx;
      parentDy[nIdx] = d.dy;

      // Found player — trace back to get first step from enemy
      if (nx === px && ny === py) {
        return traceFirstStep(ex, ey, px, py, parentDx, parentDy, width, entities, enemy, terrain, height);
      }

      // Don't BFS through tiles occupied by other entities (but still find paths past them)
      const occupied = entities.some(
        e => e !== enemy && e !== player && e.alive && e.tileX === nx && e.tileY === ny
      );
      if (!occupied) {
        queue.push(nx, ny);
      }
    }
  }

  return null; // No path found
}

/**
 * Trace the BFS parent chain from player back to enemy, return the first step direction.
 * Also validates that the first step is actually walkable (entity collision).
 */
function traceFirstStep(
  startX: number, startY: number,
  goalX: number, goalY: number,
  parentDx: Int8Array, parentDy: Int8Array,
  width: number,
  entities: Entity[], self: Entity,
  terrain: TerrainType[][], height: number
): Direction | null {
  let cx = goalX;
  let cy = goalY;

  while (true) {
    const idx = cy * width + cx;
    const pdx = parentDx[idx];
    const pdy = parentDy[idx];
    if (pdx === 0 && pdy === 0 && !(cx === startX && cy === startY)) return null;
    const prevX = cx - pdx;
    const prevY = cy - pdy;
    if (prevX === startX && prevY === startY) {
      // pdx, pdy is the step from start — convert to Direction
      const dir = dxdyToDirection(pdx, pdy);
      if (dir === null) return null;
      // Validate the step is still walkable (entity may have moved)
      const nx = startX + pdx;
      const ny = startY + pdy;
      if (!canMoveTo(nx, ny, terrain, width, height, entities, self)) return null;
      if (!canMoveDiagonal(startX, startY, dir, terrain, width, height)) return null;
      return dir;
    }
    cx = prevX;
    cy = prevY;
  }
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
