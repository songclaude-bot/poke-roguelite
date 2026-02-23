// Game constants
export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 640;

// Tile dimensions
export const TILE_SIZE = 24; // Native tile size from DTEF
export const TILE_SCALE = 2; // Render at 2x
export const TILE_DISPLAY = TILE_SIZE * TILE_SCALE; // 48px on screen

// Map dimensions (in tiles)
export const MAP_WIDTH = 24;
export const MAP_HEIGHT = 18;

// Colors
export const COLORS = {
  BG: 0x0a0a0f,
  TEXT: 0xe0e0e0,
  TEXT_DIM: 0x666680,
  ACCENT_PINK: 0xf43f5e,
  ACCENT_PURPLE: 0x667eea,
  HP_GREEN: 0x4ade80,
  HP_RED: 0xef4444,
  PP_BLUE: 0x60a5fa,
} as const;
