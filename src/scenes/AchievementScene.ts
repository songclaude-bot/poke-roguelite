import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { loadMeta } from "../core/save-system";
import { ACHIEVEMENTS, PlayerStats } from "../core/achievements";

export class AchievementScene extends Phaser.Scene {
  constructor() {
    super({ key: "AchievementScene" });
  }

  create() {
    const meta = loadMeta();

    // Build player stats from meta
    const stats: PlayerStats = {
      totalRuns: meta.totalRuns,
      totalClears: meta.totalClears,
      totalGold: meta.totalGold,
      bestFloor: meta.bestFloor,
      totalEnemiesDefeated: meta.totalEnemiesDefeated ?? 0,
      totalTurns: meta.totalTurns ?? 0,
      endlessBestFloor: meta.endlessBestFloor ?? 0,
      challengeClears: meta.challengeClears ?? 0,
      uniqueStartersUsed: (meta.startersUsed ?? []).length,
    };

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1a);

    // Title
    this.add.text(GAME_WIDTH / 2, 25, "Stats & Achievements", {
      fontSize: "16px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    // Stats section
    const statsText = [
      `Runs: ${stats.totalRuns}  |  Clears: ${stats.totalClears}`,
      `Best Floor: B${stats.bestFloor}F  |  Gold Earned: ${stats.totalGold}`,
      `Enemies Defeated: ${stats.totalEnemiesDefeated}`,
      `Total Turns: ${stats.totalTurns}`,
      `Endless Best: B${stats.endlessBestFloor}F`,
      `Challenge Clears: ${stats.challengeClears}`,
      `Starters Used: ${stats.uniqueStartersUsed}`,
    ].join("\n");

    this.add.text(GAME_WIDTH / 2, 55, statsText, {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace", align: "center",
      lineSpacing: 4,
    }).setOrigin(0.5, 0);

    // Achievements section - scrollable
    const scrollTop = 150;
    const scrollBottom = GAME_HEIGHT - 40;
    const container = this.add.container(0, 0);
    let cy = scrollTop;

    const unlocked = ACHIEVEMENTS.filter(a => a.condition(stats));
    const locked = ACHIEVEMENTS.filter(a => !a.condition(stats));

    // Unlocked count
    this.add.text(GAME_WIDTH / 2, scrollTop - 15, `Achievements: ${unlocked.length}/${ACHIEVEMENTS.length}`, {
      fontSize: "10px", color: "#667eea", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Progress bar
    const barW = 280;
    const progress = unlocked.length / ACHIEVEMENTS.length;
    this.add.rectangle(GAME_WIDTH / 2, scrollTop - 2, barW, 4, 0x222244);
    this.add.rectangle(GAME_WIDTH / 2 - barW / 2 + (barW * progress) / 2, scrollTop - 2, barW * progress, 4, 0x667eea);

    for (const ach of [...unlocked, ...locked]) {
      const isUnlocked = unlocked.includes(ach);
      const bg = this.add.rectangle(GAME_WIDTH / 2, cy, 320, 34, isUnlocked ? 0x1a2a1a : 0x1a1a2e, 0.9)
        .setStrokeStyle(1, isUnlocked ? 0x4ade80 : 0x222233);

      const icon = this.add.text(GAME_WIDTH / 2 - 148, cy - 6, isUnlocked ? ach.icon : "?", {
        fontSize: "12px", color: isUnlocked ? "#fbbf24" : "#444460", fontFamily: "monospace", fontStyle: "bold",
      });

      const name = this.add.text(GAME_WIDTH / 2 - 120, cy - 8, ach.name, {
        fontSize: "10px", color: isUnlocked ? "#4ade80" : "#444460", fontFamily: "monospace", fontStyle: "bold",
      });

      const desc = this.add.text(GAME_WIDTH / 2 - 120, cy + 5, ach.description, {
        fontSize: "8px", color: isUnlocked ? "#94a3b8" : "#333350", fontFamily: "monospace",
      });

      container.add([bg, icon, name, desc]);
      cy += 40;
    }

    // Scroll logic (same pattern as HubScene)
    const contentH = cy - scrollTop;
    const scrollH = scrollBottom - scrollTop;
    const maxScroll = Math.max(0, contentH - scrollH);

    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillRect(0, scrollTop, GAME_WIDTH, scrollH);
    container.setMask(maskShape.createGeometryMask());

    if (maxScroll > 0) {
      let dragStartY = 0;
      let scrollOffset = 0;
      this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => { dragStartY = ptr.y; });
      this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
        if (!ptr.isDown) return;
        const dy = ptr.y - dragStartY;
        dragStartY = ptr.y;
        scrollOffset = Math.max(-maxScroll, Math.min(0, scrollOffset + dy));
        container.y = scrollOffset;
      });
    }

    // Back button
    const back = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20, "[Back to Town]", {
      fontSize: "13px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setInteractive();
    back.on("pointerdown", () => this.scene.start("HubScene"));
  }
}
