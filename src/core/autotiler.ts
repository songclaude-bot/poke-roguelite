import { TerrainType } from "./dungeon-generator";

// DTEF tileset layout constants
const DTEF_TILESET_WIDTH = 6; // tiles per terrain column
const DTEF_TOTAL_COLS = 18; // 3 terrains × 6 columns each

// Neighbor layout:
//   4  A  1
//   D  X  B
//   3  C  2
// A=up, B=right, C=down, D=left
// 1=up-right, 2=down-right, 3=down-left, 4=up-left
// Letters/numbers in mask name = neighbors that ARE the same terrain type
// Diagonals only relevant when BOTH adjacent cardinals match

// MaskCoordinate: exact (x, y) position within the 6×8 terrain sub-grid
// Source: keldaanCommunity/pokemonAutoChess app/config/maps/tileset.ts
const MaskCoordinate: Record<string, { x: number; y: number }> = {
  // No neighbors / isolated
  X:    { x: 4, y: 1 },

  // Single cardinal
  A:    { x: 4, y: 4 },
  B:    { x: 3, y: 3 },
  C:    { x: 4, y: 2 },
  D:    { x: 5, y: 3 },

  // Two cardinals
  AB:   { x: 3, y: 2 },
  AC:   { x: 3, y: 1 },
  AD:   { x: 5, y: 1 },
  BC:   { x: 3, y: 0 },
  BD:   { x: 4, y: 0 },
  CD:   { x: 5, y: 0 },

  // Three cardinals
  ABC:  { x: 3, y: 4 },
  ABD:  { x: 2, y: 4 },
  ACD:  { x: 5, y: 4 },
  BCD:  { x: 2, y: 3 },

  // Four cardinals (no diagonals)
  ABCD: { x: 4, y: 3 },

  // Two cardinals + 1 corner
  A1B:  { x: 0, y: 2 },
  B2C:  { x: 0, y: 0 },
  C3D:  { x: 2, y: 0 },
  AD4:  { x: 2, y: 2 },

  // Three cardinals + 1 corner
  A1BC:   { x: 2, y: 5 },
  AB2C:   { x: 2, y: 6 },
  B2CD:   { x: 5, y: 5 },
  BC3D:   { x: 4, y: 5 },
  AC3D:   { x: 3, y: 6 },
  ACD4:   { x: 3, y: 5 },
  A1BD:   { x: 5, y: 6 },
  ABD4:   { x: 4, y: 6 },

  // Two cardinals + 2 adjacent corners
  A1B2C:  { x: 0, y: 1 },
  B2C3D:  { x: 1, y: 0 },
  AC3D4:  { x: 2, y: 1 },
  A1BD4:  { x: 1, y: 2 },

  // Four cardinals + 1 corner
  A1BCD:  { x: 2, y: 7 },
  AB2CD:  { x: 0, y: 7 },
  ABC3D:  { x: 1, y: 7 },
  ABCD4:  { x: 3, y: 7 },

  // Four cardinals + 2 adjacent corners
  A1B2CD: { x: 1, y: 3 },
  AB2C3D: { x: 0, y: 4 },
  ABC3D4: { x: 0, y: 3 },
  A1BCD4: { x: 1, y: 4 },

  // Four cardinals + 3 corners
  A1B2C3D:  { x: 1, y: 6 },
  AB2C3D4:  { x: 0, y: 6 },
  A1BC3D4:  { x: 0, y: 5 },
  A1B2CD4:  { x: 1, y: 5 },

  // Four cardinals + 2 opposite corners
  A1BC3D:   { x: 4, y: 7 },
  AB2CD4:   { x: 5, y: 7 },

  // All neighbors match (center tile)
  A1B2C3D4: { x: 1, y: 1 },
};

function computeMaskName(
  terrain: TerrainType[][],
  x: number,
  y: number,
  type: TerrainType,
  width: number,
  height: number
): string {
  const matches = (tx: number, ty: number): boolean => {
    if (tx < 0 || tx >= width || ty < 0 || ty >= height) return true; // borders = same type
    return terrain[ty][tx] === type;
  };

  // Cardinals
  const a = matches(x, y - 1); // up
  const b = matches(x + 1, y); // right
  const c = matches(x, y + 1); // down
  const d = matches(x - 1, y); // left

  // Diagonals (only count when both adjacent cardinals match)
  const d1 = a && b && matches(x + 1, y - 1); // up-right
  const d2 = b && c && matches(x + 1, y + 1); // down-right
  const d3 = c && d && matches(x - 1, y + 1); // down-left
  const d4 = a && d && matches(x - 1, y - 1); // up-left

  // Build mask name in DTEF order: A [1] B [2] C [3] D [4]
  let name = "";
  if (a) name += "A";
  if (d1) name += "1";
  if (b) name += "B";
  if (d2) name += "2";
  if (c) name += "C";
  if (d3) name += "3";
  if (d) name += "D";
  if (d4) name += "4";

  if (name === "") name = "X"; // isolated tile

  return name;
}

/**
 * Get the tile index in the tileset for a given terrain position.
 * Returns a 0-based index into the 18-column × 8-row tileset grid.
 */
export function getTileIndex(
  terrain: TerrainType[][],
  x: number,
  y: number,
  width: number,
  height: number
): number {
  const type = terrain[y][x];
  const maskName = computeMaskName(terrain, x, y, type, width, height);

  const coord = MaskCoordinate[maskName];
  if (!coord) {
    // Fallback: fully surrounded center tile
    const fallback = MaskCoordinate["A1B2C3D4"];
    const col = fallback.x + type * DTEF_TILESET_WIDTH;
    return fallback.y * DTEF_TOTAL_COLS + col;
  }

  const globalCol = coord.x + type * DTEF_TILESET_WIDTH;
  return coord.y * DTEF_TOTAL_COLS + globalCol;
}
