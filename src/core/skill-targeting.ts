/**
 * Skill targeting — resolves which tiles a skill affects based on its range type.
 */

import { Direction, DIR_DX, DIR_DY } from "./direction";
import { SkillRange } from "./skill";
import { TerrainType } from "./dungeon-generator";

export interface TilePos {
  x: number;
  y: number;
}

/**
 * Get the tiles affected by a skill from a given position and facing direction.
 * Returns an array of tile positions that the skill hits.
 */
export function getSkillTargetTiles(
  range: SkillRange,
  userX: number,
  userY: number,
  facing: Direction,
  terrain: TerrainType[][],
  mapWidth: number,
  mapHeight: number
): TilePos[] {
  switch (range) {
    case SkillRange.Self:
      return [{ x: userX, y: userY }];

    case SkillRange.Front1:
      return getFrontTiles(userX, userY, facing, 1, terrain, mapWidth, mapHeight);

    case SkillRange.Front2:
      return getFrontTiles(userX, userY, facing, 2, terrain, mapWidth, mapHeight);

    case SkillRange.FrontLine:
      return getFrontTiles(userX, userY, facing, 10, terrain, mapWidth, mapHeight);

    case SkillRange.Around:
      return getAroundTiles(userX, userY, mapWidth, mapHeight);

    case SkillRange.Room:
      return getRoomTiles(userX, userY, terrain, mapWidth, mapHeight);
  }
}

/** Get tiles in a straight line from user, stopping at walls */
function getFrontTiles(
  ux: number, uy: number,
  facing: Direction,
  maxRange: number,
  terrain: TerrainType[][],
  w: number, h: number
): TilePos[] {
  const tiles: TilePos[] = [];
  const dx = DIR_DX[facing];
  const dy = DIR_DY[facing];

  for (let i = 1; i <= maxRange; i++) {
    const tx = ux + dx * i;
    const ty = uy + dy * i;
    if (tx < 0 || tx >= w || ty < 0 || ty >= h) break;
    if (terrain[ty][tx] === TerrainType.WALL) break;
    tiles.push({ x: tx, y: ty });
  }
  return tiles;
}

/** Get all 8 adjacent tiles (that are not walls) */
function getAroundTiles(ux: number, uy: number, w: number, h: number): TilePos[] {
  const tiles: TilePos[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const tx = ux + dx;
      const ty = uy + dy;
      if (tx >= 0 && tx < w && ty >= 0 && ty < h) {
        tiles.push({ x: tx, y: ty });
      }
    }
  }
  return tiles;
}

/** Get all GROUND tiles in the same room, or radius 3 if in a corridor */
function getRoomTiles(
  ux: number, uy: number,
  terrain: TerrainType[][],
  w: number, h: number
): TilePos[] {
  const tiles: TilePos[] = [];
  // Use flood-fill from user position, limited to GROUND tiles
  // For simplicity, use a radius-based approach (radius 5 = typical room size)
  const ROOM_RADIUS = 5;
  const visited = new Set<string>();

  const queue: TilePos[] = [{ x: ux, y: uy }];
  visited.add(`${ux},${uy}`);

  while (queue.length > 0) {
    const curr = queue.shift()!;

    // Don't include the user's own tile in room attack targets
    if (curr.x !== ux || curr.y !== uy) {
      tiles.push(curr);
    }

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = curr.x + dx;
        const ny = curr.y + dy;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        if (terrain[ny][nx] === TerrainType.WALL) continue;

        // Limit to Chebyshev distance from user
        const dist = Math.max(Math.abs(nx - ux), Math.abs(ny - uy));
        if (dist > ROOM_RADIUS) continue;

        visited.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }

  return tiles;
}
