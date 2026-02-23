import Phaser from "phaser";
import { COLORS, GAME_WIDTH, GAME_HEIGHT, TILE_DISPLAY, MAP_WIDTH, MAP_HEIGHT } from "../config";

export class DungeonScene extends Phaser.Scene {
  constructor() {
    super({ key: "DungeonScene" });
  }

  create() {
    // Placeholder: draw a grid to verify the scene works
    const graphics = this.add.graphics();

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const px = x * TILE_DISPLAY;
        const py = y * TILE_DISPLAY;

        // Checkerboard pattern
        const isWall = (x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1);
        const color = isWall ? 0x1a1a25 : ((x + y) % 2 === 0 ? 0x111118 : 0x0e0e15);

        graphics.fillStyle(color, 1);
        graphics.fillRect(px, py, TILE_DISPLAY, TILE_DISPLAY);
      }
    }

    // Player placeholder (center of map)
    const playerX = Math.floor(MAP_WIDTH / 2) * TILE_DISPLAY + TILE_DISPLAY / 2;
    const playerY = Math.floor(MAP_HEIGHT / 2) * TILE_DISPLAY + TILE_DISPLAY / 2;

    graphics.fillStyle(COLORS.ACCENT_PINK, 1);
    graphics.fillCircle(playerX, playerY, 16);

    // Camera follows player position, centered on screen
    this.cameras.main.setBounds(
      0, 0,
      MAP_WIDTH * TILE_DISPLAY,
      MAP_HEIGHT * TILE_DISPLAY
    );
    this.cameras.main.centerOn(playerX, playerY);

    // HUD text
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

    // Bottom buttons placeholder
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
