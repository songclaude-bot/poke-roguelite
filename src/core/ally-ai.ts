import { Direction, DIR_DX, DIR_DY } from "./direction";
import { TerrainType } from "./dungeon-generator";
import { Entity, canMoveTo, canMoveDiagonal, chebyshevDist } from "./entity";

// ── Constants ──
const LEASH_DIST = 5;        // max distance before forced follow
const FOLLOW_DIST = 2;       // ideal follow distance
const ATTACK_CHASE_RANGE = 3; // range to chase enemies
const MAX_PATH_SEARCH = 200;  // BFS node limit (keep fast)

// ── FSM States ──
export enum AllyState {
  Follow = "follow",
  Chase = "chase",
  Attack = "attack",
  Yield = "yield",   // move out of player's way
}

// ── Recruitment ──

export function recruitChance(playerLevel: number, enemyLevel: number): number {
  const levelBonus = Math.max(0, (playerLevel - enemyLevel) * 2);
  return Math.min(40, 15 + levelBonus);
}

export function tryRecruit(playerLevel: number, enemyLevel: number): boolean {
  return Math.random() * 100 < recruitChance(playerLevel, enemyLevel);
}

// ── Direction helpers ──

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

// ── BFS Pathfinding ──

interface PathNode {
  x: number;
  y: number;
  parentIdx: number;
  dir: Direction;
}

/**
 * BFS pathfinding from (sx,sy) to (tx,ty).
 * Returns the first Direction to move, or null if no path.
 * Ignores entities in `ignoreEntities` for blocking checks.
 */
function bfsPathDir(
  sx: number, sy: number,
  tx: number, ty: number,
  terrain: TerrainType[][],
  w: number, h: number,
  allEntities: Entity[],
  self: Entity,
  ignoreEntities: Entity[] = []
): Direction | null {
  if (sx === tx && sy === ty) return null;

  // For BFS, build a filtered entity list (exclude ignore list)
  const blockEntities = allEntities.filter(e => !ignoreEntities.includes(e));

  const visited = new Set<number>();
  const key = (x: number, y: number) => y * w + x;
  visited.add(key(sx, sy));

  const queue: PathNode[] = [];
  // Seed with all 8 directions
  for (let d = 0; d < 8; d++) {
    const dir = d as Direction;
    const nx = sx + DIR_DX[dir];
    const ny = sy + DIR_DY[dir];
    if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
    if (terrain[ny][nx] !== TerrainType.GROUND) continue;

    // Check diagonal wall corners
    const ddx = DIR_DX[dir];
    const ddy = DIR_DY[dir];
    if (ddx !== 0 && ddy !== 0) {
      if (terrain[sy][sx + ddx] !== TerrainType.GROUND) continue;
      if (terrain[sy + ddy][sx] !== TerrainType.GROUND) continue;
    }

    // Target tile reached in one step
    if (nx === tx && ny === ty) return dir;

    // Check if walkable (allow target tile even if occupied)
    const blocked = blockEntities.some(e => e !== self && e.alive && e.tileX === nx && e.tileY === ny);
    if (blocked) continue;

    const k = key(nx, ny);
    if (visited.has(k)) continue;
    visited.add(k);
    queue.push({ x: nx, y: ny, parentIdx: -1, dir });
  }

  // BFS
  let head = 0;
  while (head < queue.length && head < MAX_PATH_SEARCH) {
    const node = queue[head++];
    for (let d = 0; d < 8; d++) {
      const dir = d as Direction;
      const nx = node.x + DIR_DX[dir];
      const ny = node.y + DIR_DY[dir];
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      if (terrain[ny][nx] !== TerrainType.GROUND) continue;

      const ddx = DIR_DX[dir];
      const ddy = DIR_DY[dir];
      if (ddx !== 0 && ddy !== 0) {
        if (terrain[node.y][node.x + ddx] !== TerrainType.GROUND) continue;
        if (terrain[node.y + ddy][node.x] !== TerrainType.GROUND) continue;
      }

      if (nx === tx && ny === ty) return node.dir ?? queue[head - 1].dir;

      const k = key(nx, ny);
      if (visited.has(k)) continue;
      visited.add(k);

      const blocked = blockEntities.some(e => e !== self && e.alive && e.tileX === nx && e.tileY === ny);
      if (blocked) continue;

      queue.push({ x: nx, y: ny, parentIdx: head - 1, dir: node.dir });
    }
  }

  return null; // no path found
}

// ── Find nearest enemy ──

export function findNearestEnemy(
  ally: Entity,
  enemies: Entity[],
  range: number = ATTACK_CHASE_RANGE
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

// ── Main AI: FSM + BFS ──

export function getAllyMoveDirection(
  ally: Entity,
  player: Entity,
  enemies: Entity[],
  terrain: TerrainType[][],
  width: number,
  height: number,
  allEntities: Entity[]
): { moveDir: Direction | null; attackTarget: Entity | null } {
  const distToPlayer = chebyshevDist(ally.tileX, ally.tileY, player.tileX, player.tileY);

  // Determine FSM state
  let state = resolveState(ally, player, enemies, distToPlayer);

  switch (state) {
    case AllyState.Yield: {
      // Player is adjacent and ally is blocking — move to a nearby open tile
      const yieldDir = findYieldDirection(ally, player, terrain, width, height, allEntities);
      return { moveDir: yieldDir, attackTarget: null };
    }

    case AllyState.Attack: {
      // Adjacent to an enemy — attack it
      for (const e of enemies) {
        if (!e.alive || e.isAlly) continue;
        if (chebyshevDist(ally.tileX, ally.tileY, e.tileX, e.tileY) === 1) {
          return { moveDir: null, attackTarget: e };
        }
      }
      // fallthrough to follow
      return { moveDir: bfsToPlayer(ally, player, terrain, width, height, allEntities), attackTarget: null };
    }

    case AllyState.Chase: {
      // Chase nearby enemy using BFS
      const nearestEnemy = findNearestEnemy(ally, enemies, ATTACK_CHASE_RANGE);
      if (nearestEnemy) {
        const dir = bfsPathDir(
          ally.tileX, ally.tileY,
          nearestEnemy.tileX, nearestEnemy.tileY,
          terrain, width, height, allEntities, ally
        );
        if (dir !== null) return { moveDir: dir, attackTarget: null };
      }
      // fallthrough to follow
      return { moveDir: bfsToPlayer(ally, player, terrain, width, height, allEntities), attackTarget: null };
    }

    case AllyState.Follow:
    default: {
      if (distToPlayer <= FOLLOW_DIST) {
        return { moveDir: null, attackTarget: null }; // close enough, idle
      }
      return { moveDir: bfsToPlayer(ally, player, terrain, width, height, allEntities), attackTarget: null };
    }
  }
}

// ── FSM State Resolution ──

function resolveState(
  ally: Entity,
  player: Entity,
  enemies: Entity[],
  distToPlayer: number
): AllyState {
  // Check if ally is blocking the player's potential movement paths
  if (distToPlayer === 1 && isBlockingPlayer(ally, player)) {
    return AllyState.Yield;
  }

  // Leash: too far from player → follow
  if (distToPlayer > LEASH_DIST) {
    return AllyState.Follow;
  }

  // Adjacent enemy → attack
  for (const e of enemies) {
    if (!e.alive || e.isAlly) continue;
    if (chebyshevDist(ally.tileX, ally.tileY, e.tileX, e.tileY) === 1) {
      return AllyState.Attack;
    }
  }

  // Nearby enemy → chase (only if reasonably close to player)
  const nearestEnemy = findNearestEnemy(ally, enemies, ATTACK_CHASE_RANGE);
  if (nearestEnemy && distToPlayer <= LEASH_DIST - 1) {
    return AllyState.Chase;
  }

  return AllyState.Follow;
}

// ── Blocking Detection ──

/**
 * Check if ally is directly in front of or adjacent-blocking the player.
 * An ally is "blocking" if it's on a tile the player likely wants to move through.
 * We check if there's an enemy nearby in the direction from player to ally,
 * meaning the player probably wants to pass through.
 */
function isBlockingPlayer(ally: Entity, player: Entity): boolean {
  // Ally is between player and the direction player is facing
  const dx = ally.tileX - player.tileX;
  const dy = ally.tileY - player.tileY;
  const pdx = DIR_DX[player.facing];
  const pdy = DIR_DY[player.facing];

  // Ally is in the direction the player is facing
  return dx === pdx && dy === pdy;
}

// ── Yield Direction ──

/**
 * When yielding, find a tile perpendicular to the player's facing direction
 * that's still ground and not blocked.
 */
function findYieldDirection(
  ally: Entity,
  player: Entity,
  terrain: TerrainType[][],
  width: number,
  height: number,
  allEntities: Entity[]
): Direction | null {
  // Try perpendicular directions first, then diagonal, then any open
  const facing = player.facing;
  const perp = getPerpendicularDirs(facing);

  // Priority: perpendicular to player facing → other open tiles
  const tryOrder = [...perp, ...getAllDirsExcept(facing)];

  for (const dir of tryOrder) {
    const nx = ally.tileX + DIR_DX[dir];
    const ny = ally.tileY + DIR_DY[dir];
    if (canMoveTo(nx, ny, terrain, width, height, allEntities, ally) &&
        canMoveDiagonal(ally.tileX, ally.tileY, dir, terrain, width, height)) {
      return dir;
    }
  }

  return null; // can't yield — nowhere to go
}

function getPerpendicularDirs(facing: Direction): Direction[] {
  const dx = DIR_DX[facing];
  const dy = DIR_DY[facing];
  const results: Direction[] = [];

  // Perpendicular = rotate 90° both ways
  for (let d = 0; d < 8; d++) {
    const dir = d as Direction;
    const ddx = DIR_DX[dir];
    const ddy = DIR_DY[dir];
    // Perpendicular check: dot product ≈ 0
    if (dx * ddx + dy * ddy === 0) {
      results.push(dir);
    }
  }
  return results;
}

function getAllDirsExcept(exclude: Direction): Direction[] {
  const dirs: Direction[] = [];
  for (let d = 0; d < 8; d++) {
    if (d !== exclude) dirs.push(d as Direction);
  }
  return dirs;
}

// ── BFS to player ──

function bfsToPlayer(
  ally: Entity,
  player: Entity,
  terrain: TerrainType[][],
  width: number,
  height: number,
  allEntities: Entity[]
): Direction | null {
  // When pathfinding to player, ignore player as obstacle so we can path adjacent
  return bfsPathDir(
    ally.tileX, ally.tileY,
    player.tileX, player.tileY,
    terrain, width, height,
    allEntities, ally,
    [player] // ignore player as blocker
  );
}
