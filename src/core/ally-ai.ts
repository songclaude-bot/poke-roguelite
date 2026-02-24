import { Direction, DIR_DX, DIR_DY } from "./direction";
import { TerrainType } from "./dungeon-generator";
import { Entity, canMoveTo, canMoveDiagonal, chebyshevDist, AllyTactic } from "./entity";
import { Skill, SkillEffect, SkillRange } from "./skill";
import { getEffectiveness } from "./type-chart";

// ── Constants ──
const BASE_FOLLOW_DIST = 2;  // ideal follow distance for position 0
const BASE_LEASH_DIST = 5;   // max distance before forced follow for position 0
const ATTACK_CHASE_RANGE = 3; // range to chase enemies
const GO_AFTER_FOES_RANGE = 8; // range for GoAfterFoes tactic
const MAX_PATH_SEARCH = 200;  // BFS node limit (keep fast)

/** Get follow distance based on party position (0-indexed) */
export function getFollowDist(partyPosition: number): number {
  return BASE_FOLLOW_DIST + partyPosition; // pos 0 = 2, pos 1 = 3, pos 2 = 4, pos 3 = 5
}

/** Get leash distance based on party position (0-indexed) */
export function getLeashDist(partyPosition: number): number {
  return BASE_LEASH_DIST + partyPosition; // pos 0 = 5, pos 1 = 6, pos 2 = 7, pos 3 = 8
}

// ── FSM States ──
export enum AllyState {
  Follow = "follow",
  Chase = "chase",
  Attack = "attack",
  Yield = "yield",   // move out of player's way
}

// ── Recruitment ──

export function recruitChance(playerLevel: number, enemyLevel: number, bonus = 0): number {
  const levelBonus = Math.max(0, (playerLevel - enemyLevel) * 2);
  return Math.min(60, 15 + levelBonus + bonus);
}

export function tryRecruit(playerLevel: number, enemyLevel: number, bonus = 0): boolean {
  return Math.random() * 100 < recruitChance(playerLevel, enemyLevel, bonus);
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
  allEntities: Entity[],
  partyPosition: number = 0
): { moveDir: Direction | null; attackTarget: Entity | null } {
  const tactic = ally.allyTactic ?? AllyTactic.FollowMe;

  // Dispatch to tactic-specific AI
  switch (tactic) {
    case AllyTactic.GoAfterFoes:
      return allyAI_GoAfterFoes(ally, player, enemies, terrain, width, height, allEntities, partyPosition);
    case AllyTactic.StayHere:
      return allyAI_StayHere(ally, enemies);
    case AllyTactic.Scatter:
      return allyAI_Scatter(ally, player, enemies, terrain, width, height, allEntities);
    case AllyTactic.FollowMe:
    default:
      return allyAI_FollowMe(ally, player, enemies, terrain, width, height, allEntities, partyPosition);
  }
}

// ── Tactic: FollowMe (default — original behavior) ──

function allyAI_FollowMe(
  ally: Entity,
  player: Entity,
  enemies: Entity[],
  terrain: TerrainType[][],
  width: number,
  height: number,
  allEntities: Entity[],
  partyPosition: number = 0
): { moveDir: Direction | null; attackTarget: Entity | null } {
  const distToPlayer = chebyshevDist(ally.tileX, ally.tileY, player.tileX, player.tileY);
  const followDist = getFollowDist(partyPosition);
  const leashDist = getLeashDist(partyPosition);

  // Determine FSM state
  let state = resolveState(ally, player, enemies, distToPlayer, followDist, leashDist);

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
      if (distToPlayer <= followDist) {
        return { moveDir: null, attackTarget: null }; // close enough, idle
      }
      return { moveDir: bfsToPlayer(ally, player, terrain, width, height, allEntities), attackTarget: null };
    }
  }
}

// ── Tactic: GoAfterFoes — aggressively pursue enemies up to 8 tiles ──

function allyAI_GoAfterFoes(
  ally: Entity,
  player: Entity,
  enemies: Entity[],
  terrain: TerrainType[][],
  width: number,
  height: number,
  allEntities: Entity[],
  partyPosition: number = 0
): { moveDir: Direction | null; attackTarget: Entity | null } {
  const distToPlayer = chebyshevDist(ally.tileX, ally.tileY, player.tileX, player.tileY);
  const leashDist = getLeashDist(partyPosition);

  // Still yield to player if blocking
  if (distToPlayer === 1 && isBlockingPlayer(ally, player)) {
    const yieldDir = findYieldDirection(ally, player, terrain, width, height, allEntities);
    return { moveDir: yieldDir, attackTarget: null };
  }

  // Attack adjacent enemy first
  for (const e of enemies) {
    if (!e.alive || e.isAlly) continue;
    if (chebyshevDist(ally.tileX, ally.tileY, e.tileX, e.tileY) === 1) {
      return { moveDir: null, attackTarget: e };
    }
  }

  // Chase nearest enemy up to 8 tiles (ignoring leash)
  const nearestEnemy = findNearestEnemy(ally, enemies, GO_AFTER_FOES_RANGE);
  if (nearestEnemy) {
    const dir = bfsPathDir(
      ally.tileX, ally.tileY,
      nearestEnemy.tileX, nearestEnemy.tileY,
      terrain, width, height, allEntities, ally
    );
    if (dir !== null) return { moveDir: dir, attackTarget: null };
  }

  // No enemy in range — fall back to following player loosely
  if (distToPlayer > leashDist) {
    return { moveDir: bfsToPlayer(ally, player, terrain, width, height, allEntities), attackTarget: null };
  }
  return { moveDir: null, attackTarget: null };
}

// ── Tactic: StayHere — don't move, attack if adjacent ──

function allyAI_StayHere(
  ally: Entity,
  enemies: Entity[]
): { moveDir: Direction | null; attackTarget: Entity | null } {
  // Attack adjacent enemy
  for (const e of enemies) {
    if (!e.alive || e.isAlly) continue;
    if (chebyshevDist(ally.tileX, ally.tileY, e.tileX, e.tileY) === 1) {
      return { moveDir: null, attackTarget: e };
    }
  }
  // Don't move at all
  return { moveDir: null, attackTarget: null };
}

// ── Tactic: Scatter — move randomly, attack adjacent enemies ──

function allyAI_Scatter(
  ally: Entity,
  player: Entity,
  enemies: Entity[],
  terrain: TerrainType[][],
  width: number,
  height: number,
  allEntities: Entity[]
): { moveDir: Direction | null; attackTarget: Entity | null } {
  // Attack adjacent enemy first
  for (const e of enemies) {
    if (!e.alive || e.isAlly) continue;
    if (chebyshevDist(ally.tileX, ally.tileY, e.tileX, e.tileY) === 1) {
      return { moveDir: null, attackTarget: e };
    }
  }

  // Move in a random walkable direction
  const shuffledDirs: Direction[] = [];
  for (let d = 0; d < 8; d++) shuffledDirs.push(d as Direction);
  // Fisher-Yates shuffle
  for (let i = shuffledDirs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledDirs[i], shuffledDirs[j]] = [shuffledDirs[j], shuffledDirs[i]];
  }

  for (const dir of shuffledDirs) {
    const nx = ally.tileX + DIR_DX[dir];
    const ny = ally.tileY + DIR_DY[dir];
    if (canMoveTo(nx, ny, terrain, width, height, allEntities, ally) &&
        canMoveDiagonal(ally.tileX, ally.tileY, dir, terrain, width, height)) {
      return { moveDir: dir, attackTarget: null };
    }
  }

  return { moveDir: null, attackTarget: null };
}

// ── FSM State Resolution ──

function resolveState(
  ally: Entity,
  player: Entity,
  enemies: Entity[],
  distToPlayer: number,
  followDist: number = BASE_FOLLOW_DIST,
  leashDist: number = BASE_LEASH_DIST
): AllyState {
  // Check if ally is blocking the player's potential movement paths
  if (distToPlayer === 1 && isBlockingPlayer(ally, player)) {
    return AllyState.Yield;
  }

  // Leash: too far from player → follow
  if (distToPlayer > leashDist) {
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
  if (nearestEnemy && distToPlayer <= leashDist - 1) {
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

// ══════════════════════════════════════════════════════════
// ── Ally Skill Selection ──
// ══════════════════════════════════════════════════════════

/** Threshold below which an entity is considered low HP */
const LOW_HP_THRESHOLD = 0.4;
/** Player HP threshold for ally healing support (FollowMe only) */
const PLAYER_HEAL_THRESHOLD = 0.5;
/** Range within which allies consider healing nearby allies */
const HEAL_NEARBY_RANGE = 3;

/**
 * Check if an entity needs healing (below threshold % HP).
 */
function needsHealing(entity: Entity, threshold: number): boolean {
  return entity.alive && entity.stats.hp < entity.stats.maxHp * threshold;
}

/**
 * Find a healing skill with PP remaining from the ally's skill list.
 */
function findHealSkill(ally: Entity): Skill | null {
  return ally.skills.find(
    s => s.currentPp > 0 && s.effect === SkillEffect.Heal && s.range === SkillRange.Self
  ) ?? null;
}

/**
 * Find a buff skill (AtkUp or DefUp) that the ally doesn't already have active.
 */
function findBuffSkill(ally: Entity): Skill | null {
  const hasAtkUp = ally.statusEffects.some(s => s.type === SkillEffect.AtkUp);
  const hasDefUp = ally.statusEffects.some(s => s.type === SkillEffect.DefUp);
  return ally.skills.find(s => {
    if (s.currentPp <= 0 || s.range !== SkillRange.Self) return false;
    if (s.effect === SkillEffect.AtkUp && !hasAtkUp) return true;
    if (s.effect === SkillEffect.DefUp && !hasDefUp) return true;
    return false;
  }) ?? null;
}

/**
 * Find the best damaging skill against a target, considering type effectiveness.
 * Returns the skill with highest effective power (power * effectiveness).
 */
function findBestAttackSkill(ally: Entity, target: Entity): Skill | null {
  let bestSkill: Skill | null = null;
  let bestScore = 0;

  for (const skill of ally.skills) {
    if (skill.currentPp <= 0 || skill.power <= 0) continue;
    const eff = getEffectiveness(skill.type, target.types);
    // Skip immune moves
    if (eff === 0) continue;
    const score = skill.power * eff;
    if (score > bestScore) {
      bestScore = score;
      bestSkill = skill;
    }
  }
  return bestSkill;
}

/**
 * Find any super-effective skill against the target.
 */
function findSuperEffectiveSkill(ally: Entity, target: Entity): Skill | null {
  return ally.skills.find(s => {
    if (s.currentPp <= 0 || s.power <= 0) return false;
    return getEffectiveness(s.type, target.types) >= 2.0;
  }) ?? null;
}

/**
 * Select the best skill for an ally to use based on tactic and situation.
 * Returns the skill to use, or null to fall back to basic attack.
 *
 * Priority logic varies by tactic:
 * - FollowMe: balanced — heal self/player, buff, then best attack
 * - GoAfterFoes: offensive — prefer super-effective and high-power attacks
 * - StayHere: defensive — prefer heal/buff, then attack
 * - Scatter: random from available skills
 */
export function selectAllySkill(
  ally: Entity,
  target: Entity | null,
  allies: Entity[],
  player: Entity,
): Skill | null {
  const tactic = ally.allyTactic ?? AllyTactic.FollowMe;
  const healSkill = findHealSkill(ally);
  const buffSkill = findBuffSkill(ally);

  // ── Scatter: random skill choice ──
  if (tactic === AllyTactic.Scatter) {
    const usable = ally.skills.filter(s => s.currentPp > 0);
    if (usable.length === 0) return null;
    // Filter out heal if not needed
    const filtered = usable.filter(s => {
      if (s.effect === SkillEffect.Heal && !needsHealing(ally, LOW_HP_THRESHOLD)) return false;
      return true;
    });
    if (filtered.length === 0) return null;
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  // ── Healing priority (all tactics except Scatter, already handled) ──
  // Self-heal if below threshold
  if (healSkill && needsHealing(ally, LOW_HP_THRESHOLD)) {
    return healSkill;
  }

  // FollowMe: heal if player is below 50% HP and ally is adjacent
  if (tactic === AllyTactic.FollowMe && healSkill) {
    if (needsHealing(player, PLAYER_HEAL_THRESHOLD) &&
        chebyshevDist(ally.tileX, ally.tileY, player.tileX, player.tileY) <= 1) {
      // Self-heal skill can't target player directly, but ally can heal self
      // to preserve team HP pool. Only heal self if also somewhat hurt (>20% missing HP).
      if (needsHealing(ally, 0.8)) {
        return healSkill;
      }
    }
    // Also heal if a nearby ally is critically low
    for (const other of allies) {
      if (other === ally || !other.alive) continue;
      if (chebyshevDist(ally.tileX, ally.tileY, other.tileX, other.tileY) <= HEAL_NEARBY_RANGE) {
        // If nearby ally is very low, self-heal to preserve team
        if (needsHealing(other, 0.3) && needsHealing(ally, 0.7)) {
          return healSkill;
        }
      }
    }
  }

  // StayHere: prioritize heal/buff heavily
  if (tactic === AllyTactic.StayHere) {
    if (healSkill && needsHealing(ally, 0.6)) return healSkill;
    if (buffSkill) return buffSkill;
  }

  // ── Buff logic (FollowMe and GoAfterFoes) ──
  // Only buff if no active buff and in a moment of relative safety
  if (tactic === AllyTactic.FollowMe && buffSkill) {
    // Buff when not in immediate danger (no adjacent enemy or target is far)
    if (!target || (target && chebyshevDist(ally.tileX, ally.tileY, target.tileX, target.tileY) > 1)) {
      return buffSkill;
    }
  }

  // GoAfterFoes: only buff AtkUp (not DefUp) and only if not adjacent to enemy
  if (tactic === AllyTactic.GoAfterFoes && buffSkill && buffSkill.effect === SkillEffect.AtkUp) {
    if (!target || chebyshevDist(ally.tileX, ally.tileY, target.tileX, target.tileY) > 1) {
      return buffSkill;
    }
  }

  // ── Attack skill selection (requires a target) ──
  if (!target) return null;

  // GoAfterFoes: strongly prefer offensive skills
  if (tactic === AllyTactic.GoAfterFoes) {
    // Always prefer super-effective
    const superEff = findSuperEffectiveSkill(ally, target);
    if (superEff) return superEff;
    // Then best damaging skill
    const best = findBestAttackSkill(ally, target);
    if (best) return best;
    return null;
  }

  // FollowMe: balanced — prefer super-effective, then best attack with some randomness
  if (tactic === AllyTactic.FollowMe) {
    const superEff = findSuperEffectiveSkill(ally, target);
    if (superEff) return superEff;
    // Use skill ~60% of the time for variety (otherwise basic attack)
    if (Math.random() < 0.6) {
      const best = findBestAttackSkill(ally, target);
      if (best) return best;
    }
    return null;
  }

  // StayHere: already handled heal/buff above, just pick best attack
  if (tactic === AllyTactic.StayHere) {
    const best = findBestAttackSkill(ally, target);
    if (best) return best;
    return null;
  }

  return null;
}
