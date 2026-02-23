import Phaser from "phaser";
import {
  COLORS,
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE_SIZE,
  TILE_SCALE,
  TILE_DISPLAY,
  MAP_WIDTH,
  MAP_HEIGHT,
} from "../config";
import { generateDungeon, DungeonData } from "../core/dungeon-generator";
import { getTileIndex } from "../core/autotiler";

export class DungeonScene extends Phaser.Scene {
  private dungeon!: DungeonData;

  constructor() {
    super({ key: "DungeonScene" });
  }

  preload() {
    // Load BeachCave tileset as image (18×8 grid of 24×24 tiles)
    this.load.image("beachcave-tiles", "tilesets/BeachCave/tileset_0.png");
  }

  create() {
    // Generate dungeon
    this.dungeon = generateDungeon();
    const { width, height, terrain, playerStart, stairsPos } = this.dungeon;

    // Build tile data array (2D array of tile indices)
    const tileData: number[][] = [];
    for (let y = 0; y < height; y++) {
      tileData[y] = [];
      for (let x = 0; x < width; x++) {
        tileData[y][x] = getTileIndex(terrain, x, y, width, height);
      }
    }

    // Create Phaser tilemap from data
    const map = this.make.tilemap({
      data: tileData,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });

    const tileset = map.addTilesetImage("beachcave-tiles")!;
    const layer = map.createLayer(0, tileset, 0, 0)!;
    layer.setScale(TILE_SCALE);

    // Draw stairs marker (yellow diamond)
    const stairsGfx = this.add.graphics();
    const sx = stairsPos.x * TILE_DISPLAY + TILE_DISPLAY / 2;
    const sy = stairsPos.y * TILE_DISPLAY + TILE_DISPLAY / 2;
    stairsGfx.fillStyle(0xfbbf24, 0.9);
    stairsGfx.fillTriangle(sx, sy - 14, sx + 10, sy, sx - 10, sy);
    stairsGfx.fillTriangle(sx, sy + 14, sx + 10, sy, sx - 10, sy);

    // Player placeholder (pink circle)
    const playerGfx = this.add.graphics();
    const px = playerStart.x * TILE_DISPLAY + TILE_DISPLAY / 2;
    const py = playerStart.y * TILE_DISPLAY + TILE_DISPLAY / 2;
    playerGfx.fillStyle(COLORS.ACCENT_PINK, 1);
    playerGfx.fillCircle(px, py, 16);

    // Camera setup
    const mapPixelW = width * TILE_DISPLAY;
    const mapPixelH = height * TILE_DISPLAY;
    this.cameras.main.setBounds(0, 0, mapPixelW, mapPixelH);
    this.cameras.main.centerOn(px, py);

    // ── HUD (fixed to camera) ──
    this.add
      .text(8, 8, "B1F  HP ████████  🍎 100", {
        fontSize: "11px",
        color: "#e0e0e0",
        fontFamily: "monospace",
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.add
      .text(8, 24, "Lv.5  PP ████████", {
        fontSize: "11px",
        color: "#60a5fa",
        fontFamily: "monospace",
      })
      .setScrollFactor(0)
      .setDepth(100);

    // Bottom skill buttons
    const btnY = GAME_HEIGHT - 80;
    const btnLabels = ["기술1", "기술2", "기술3", "기술4"];
    btnLabels.forEach((label, i) => {
      const bx = 20 + i * 85;
      this.add
        .text(bx, btnY, `[${label}]`, {
          fontSize: "12px",
          color: "#667eea",
          fontFamily: "monospace",
        })
        .setScrollFactor(0)
        .setDepth(100)
        .setInteractive();
    });

    // Bottom menu buttons
    const menuY = GAME_HEIGHT - 50;
    const menuLabels = ["가방", "팀", "대기", "💾저장"];
    menuLabels.forEach((label, i) => {
      const bx = 15 + i * 88;
      this.add
        .text(bx, menuY, `[${label}]`, {
          fontSize: "11px",
          color: "#666680",
          fontFamily: "monospace",
        })
        .setScrollFactor(0)
        .setDepth(100)
        .setInteractive();
    });
  }
}
