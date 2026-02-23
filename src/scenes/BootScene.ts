import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { hasDungeonSave } from "../core/save-system";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  create() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Background
    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1a);

    // Title
    this.add.text(cx, cy - 60, "Poke Roguelite", {
      fontSize: "24px", color: "#e0e0e0", fontFamily: "monospace",
    }).setOrigin(0.5);

    this.add.text(cx, cy - 30, "Mystery Dungeon", {
      fontSize: "14px", color: "#667eea", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Subtitle
    const hasSave = hasDungeonSave();
    const subtitle = hasSave ? "Saved run found!" : "Tap to Start";

    this.add.text(cx, cy + 20, subtitle, {
      fontSize: "14px", color: hasSave ? "#4ade80" : "#667eea", fontFamily: "monospace",
    }).setOrigin(0.5);

    this.add.text(cx, cy + 60, "v0.5.0 — Phase 5: Polish", {
      fontSize: "9px", color: "#444460", fontFamily: "monospace",
    }).setOrigin(0.5);

    this.input.once("pointerdown", () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(350, () => {
        this.scene.start("HubScene");
      });
    });
  }
}
