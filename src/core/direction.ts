// PMD 8-direction system
// Sprite row order: Down=0, DownRight=1, Right=2, UpRight=3, Up=4, UpLeft=5, Left=6, DownLeft=7

export enum Direction {
  Down = 0,
  DownRight = 1,
  Right = 2,
  UpRight = 3,
  Up = 4,
  UpLeft = 5,
  Left = 6,
  DownLeft = 7,
}

// Tile offsets per direction
export const DIR_DX: Record<Direction, number> = {
  [Direction.Down]: 0,
  [Direction.DownRight]: 1,
  [Direction.Right]: 1,
  [Direction.UpRight]: 1,
  [Direction.Up]: 0,
  [Direction.UpLeft]: -1,
  [Direction.Left]: -1,
  [Direction.DownLeft]: -1,
};

export const DIR_DY: Record<Direction, number> = {
  [Direction.Down]: 1,
  [Direction.DownRight]: 1,
  [Direction.Right]: 0,
  [Direction.UpRight]: -1,
  [Direction.Up]: -1,
  [Direction.UpLeft]: -1,
  [Direction.Left]: 0,
  [Direction.DownLeft]: 1,
};

/**
 * Convert an angle (radians, atan2 convention) to nearest 8-direction.
 * atan2: 0=right, π/2=down, ±π=left, -π/2=up
 */
export function angleToDirection(radians: number): Direction {
  // Add 22.5° offset so each 45° sector is centered on its direction
  const deg = ((radians * 180) / Math.PI + 360 + 22.5) % 360;
  const sector = Math.floor(deg / 45);
  const ANGLE_TO_DIR: Direction[] = [
    Direction.Right,
    Direction.DownRight,
    Direction.Down,
    Direction.DownLeft,
    Direction.Left,
    Direction.UpLeft,
    Direction.Up,
    Direction.UpRight,
  ];
  return ANGLE_TO_DIR[sector];
}
