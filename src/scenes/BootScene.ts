import Phaser from "phaser";
import { DungeonScene } from "./DungeonScene";
import { COLORS, GAME_WIDTH, GAME_HEIGHT } from "../config";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  create() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add
      .text(cx, cy - 40, "Poke Roguelite", {
        fontSize: "24px",
        color: "#e0e0e0",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy + 10, "Tap to Start", {
        fontSize: "14px",
        color: "#667eea",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy + 50, "v0.1.0 — Phase 1 MVP", {
        fontSize: "10px",
        color: "#666680",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    this.input.once("pointerdown", () => {
      this.scene.start("DungeonScene");
    });
  }
}
