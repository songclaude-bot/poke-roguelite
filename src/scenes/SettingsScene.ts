import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import {
  DifficultyLevel,
  DIFFICULTY_DESCRIPTIONS,
  getDifficultyModifiers,
  loadDifficulty,
  saveDifficulty,
} from "../core/difficulty-settings";
import {
  getBgmVolume, setSfxVolume, getSfxVolume, setBgmVolume,
} from "../core/sound-manager";

/**
 * SettingsScene — Settings screen accessible from the Hub.
 * Provides difficulty selection, sound toggle, and progress reset.
 */
export class SettingsScene extends Phaser.Scene {
  private selectedDifficulty!: DifficultyLevel;
  private diffButtons: {
    level: DifficultyLevel;
    bg: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
    desc: Phaser.GameObjects.Text;
    border: Phaser.GameObjects.Rectangle;
  }[] = [];
  private modifierTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: "SettingsScene" });
  }

  create() {
    this.selectedDifficulty = loadDifficulty();
    this.diffButtons = [];
    this.modifierTexts = [];

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0f1729);

    // Title
    this.add.text(GAME_WIDTH / 2, 28, "Settings", {
      fontSize: "18px", color: "#e0e0e0", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    // Back button
    const backBtn = this.add.text(16, 24, "[Back]", {
      fontSize: "12px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    backBtn.on("pointerdown", () => this.scene.start("HubScene"));

    // ── Difficulty Section ──
    this.add.text(GAME_WIDTH / 2, 60, "-- Difficulty --", {
      fontSize: "11px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5);

    const levels: { level: DifficultyLevel; label: string; color: number; textColor: string }[] = [
      { level: DifficultyLevel.Easy, label: "Easy", color: 0x166534, textColor: "#4ade80" },
      { level: DifficultyLevel.Normal, label: "Normal", color: 0x334155, textColor: "#e0e0e0" },
      { level: DifficultyLevel.Hard, label: "Hard", color: 0x7c2d12, textColor: "#fb923c" },
      { level: DifficultyLevel.Nightmare, label: "Nightmare", color: 0x7f1d1d, textColor: "#ef4444" },
    ];

    const btnW = 150;
    const btnH = 34;
    const startY = 84;
    const gapX = 4;
    const halfBtnW = btnW / 2;

    // 2x2 grid layout
    for (let i = 0; i < levels.length; i++) {
      const { level, label, color, textColor } = levels[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = GAME_WIDTH / 2 + (col === 0 ? -halfBtnW - gapX / 2 : halfBtnW + gapX / 2);
      const y = startY + row * (btnH + 4);

      const isSelected = level === this.selectedDifficulty;

      // Selection border (visible when selected)
      const border = this.add.rectangle(x, y, btnW + 4, btnH + 4, 0x000000, 0)
        .setStrokeStyle(2, 0xfbbf24)
        .setVisible(isSelected);

      const bg = this.add.rectangle(x, y, btnW, btnH, color, isSelected ? 1.0 : 0.5)
        .setStrokeStyle(1, isSelected ? 0xfbbf24 : 0x556677)
        .setInteractive({ useHandCursor: true });

      const lblText = this.add.text(x, y - 5, label, {
        fontSize: "12px", color: textColor, fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5);

      const descText = this.add.text(x, y + 9, DIFFICULTY_DESCRIPTIONS[level], {
        fontSize: "7px", color: "#94a3b8", fontFamily: "monospace",
      }).setOrigin(0.5);

      bg.on("pointerover", () => { if (level !== this.selectedDifficulty) bg.setAlpha(0.8); });
      bg.on("pointerout", () => { if (level !== this.selectedDifficulty) bg.setAlpha(1); });
      bg.on("pointerdown", () => this.selectDifficulty(level));

      this.diffButtons.push({ level, bg, label: lblText, desc: descText, border });
    }

    // Modifier summary (below buttons)
    const summaryY = startY + 2 * (btnH + 4) + 12;
    this.add.text(GAME_WIDTH / 2, summaryY, "Current modifiers:", {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5);

    this.renderModifierSummary(summaryY + 14);

    // ── Sound Section ──
    const soundY = summaryY + 80;
    this.add.text(GAME_WIDTH / 2, soundY, "-- Sound --", {
      fontSize: "11px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5);

    const bgmVol = getBgmVolume();
    const sfxVol = getSfxVolume();
    const bgmOn = bgmVol > 0;
    const sfxOn = sfxVol > 0;

    // BGM toggle
    const bgmBtnBg = this.add.rectangle(GAME_WIDTH / 2 - 60, soundY + 26, 100, 28, bgmOn ? 0x166534 : 0x3f1212, 0.8)
      .setStrokeStyle(1, 0x556677).setInteractive({ useHandCursor: true });
    const bgmLabel = this.add.text(GAME_WIDTH / 2 - 60, soundY + 26, `BGM: ${bgmOn ? "ON" : "OFF"}`, {
      fontSize: "11px", color: bgmOn ? "#4ade80" : "#ef4444", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    bgmBtnBg.on("pointerdown", () => {
      const isOn = getBgmVolume() > 0;
      setBgmVolume(isOn ? 0 : 0.3);
      const newOn = getBgmVolume() > 0;
      bgmLabel.setText(`BGM: ${newOn ? "ON" : "OFF"}`).setColor(newOn ? "#4ade80" : "#ef4444");
      bgmBtnBg.setFillStyle(newOn ? 0x166534 : 0x3f1212, 0.8);
    });

    // SFX toggle
    const sfxBtnBg = this.add.rectangle(GAME_WIDTH / 2 + 60, soundY + 26, 100, 28, sfxOn ? 0x166534 : 0x3f1212, 0.8)
      .setStrokeStyle(1, 0x556677).setInteractive({ useHandCursor: true });
    const sfxLabel = this.add.text(GAME_WIDTH / 2 + 60, soundY + 26, `SFX: ${sfxOn ? "ON" : "OFF"}`, {
      fontSize: "11px", color: sfxOn ? "#4ade80" : "#ef4444", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    sfxBtnBg.on("pointerdown", () => {
      const isOn = getSfxVolume() > 0;
      setSfxVolume(isOn ? 0 : 0.4);
      const newOn = getSfxVolume() > 0;
      sfxLabel.setText(`SFX: ${newOn ? "ON" : "OFF"}`).setColor(newOn ? "#4ade80" : "#ef4444");
      sfxBtnBg.setFillStyle(newOn ? 0x166534 : 0x3f1212, 0.8);
    });

    // ── Reset Progress Section ──
    const resetY = soundY + 80;
    this.add.text(GAME_WIDTH / 2, resetY, "-- Danger Zone --", {
      fontSize: "11px", color: "#ef4444", fontFamily: "monospace",
    }).setOrigin(0.5);

    const resetBg = this.add.rectangle(GAME_WIDTH / 2, resetY + 28, 200, 32, 0x3f1212, 0.8)
      .setStrokeStyle(1, 0xef4444).setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH / 2, resetY + 28, "Reset All Progress", {
      fontSize: "12px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    resetBg.on("pointerdown", () => this.showResetConfirmation());

    // Difficulty note about leaderboards
    const noteY = resetY + 72;
    this.add.text(GAME_WIDTH / 2, noteY, "Note: Non-Normal difficulty runs are\ntagged on the leaderboard.", {
      fontSize: "8px", color: "#666680", fontFamily: "monospace", align: "center",
    }).setOrigin(0.5);
  }

  private selectDifficulty(level: DifficultyLevel) {
    this.selectedDifficulty = level;
    saveDifficulty(level);

    // Update button visuals
    for (const btn of this.diffButtons) {
      const isSelected = btn.level === level;
      btn.border.setVisible(isSelected);
      btn.bg.setAlpha(1);
      if (isSelected) {
        btn.bg.setStrokeStyle(1, 0xfbbf24);
        btn.bg.setFillStyle(btn.bg.fillColor, 1.0);
      } else {
        btn.bg.setStrokeStyle(1, 0x556677);
        btn.bg.setFillStyle(btn.bg.fillColor, 0.5);
      }
    }

    // Refresh modifier summary
    for (const t of this.modifierTexts) t.destroy();
    this.modifierTexts = [];
    // Recalculate y position (same as in create)
    const btnH = 34;
    const startY = 84;
    const summaryBaseY = startY + 2 * (btnH + 4) + 12 + 14;
    this.renderModifierSummary(summaryBaseY);
  }

  private renderModifierSummary(y: number) {
    const mods = getDifficultyModifiers(this.selectedDifficulty);
    const lines: { label: string; value: number; unit: string; goodIfLow?: boolean }[] = [
      { label: "Enemy HP", value: mods.enemyHpMult, unit: "x", goodIfLow: true },
      { label: "Enemy ATK", value: mods.enemyAtkMult, unit: "x", goodIfLow: true },
      { label: "Damage Taken", value: mods.playerDamageMult, unit: "x", goodIfLow: true },
      { label: "Gold", value: mods.goldMult, unit: "x" },
      { label: "EXP", value: mods.expMult, unit: "x" },
      { label: "Items", value: mods.itemDropMult, unit: "x" },
      { label: "Hunger", value: mods.bellyDrainMult, unit: "x", goodIfLow: true },
      { label: "Traps", value: mods.trapFreqMult, unit: "x", goodIfLow: true },
    ];

    const cols = 2;
    const colW = 150;
    const rowH = 12;

    for (let i = 0; i < lines.length; i++) {
      const { label, value, goodIfLow } = lines[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = GAME_WIDTH / 2 + (col === 0 ? -colW / 2 : colW / 2);
      const ty = y + row * rowH;

      let color = "#94a3b8"; // neutral
      if (value < 1.0) color = goodIfLow ? "#4ade80" : "#ef4444";
      else if (value > 1.0) color = goodIfLow ? "#ef4444" : "#4ade80";

      const text = this.add.text(x, ty, `${label}: ${value.toFixed(1)}x`, {
        fontSize: "8px", color, fontFamily: "monospace",
      }).setOrigin(0.5, 0);
      this.modifierTexts.push(text);
    }
  }

  private showResetConfirmation() {
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85
    ).setDepth(300).setInteractive();

    const box = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, 280, 140, 0x1a1a2e, 0.98
    ).setStrokeStyle(2, 0xef4444).setDepth(301);

    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 45, "Are you sure?", {
      fontSize: "14px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(302);

    const msg = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, "This will delete ALL save data.\nThis cannot be undone!", {
      fontSize: "10px", color: "#e0e0e0", fontFamily: "monospace", align: "center",
    }).setOrigin(0.5).setDepth(302);

    // Confirm button
    const confirmBg = this.add.rectangle(GAME_WIDTH / 2 - 55, GAME_HEIGHT / 2 + 25, 90, 30, 0x7f1d1d, 0.9)
      .setStrokeStyle(1, 0xef4444).setDepth(302).setInteractive({ useHandCursor: true });
    const confirmLabel = this.add.text(GAME_WIDTH / 2 - 55, GAME_HEIGHT / 2 + 25, "Delete All", {
      fontSize: "10px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(303);

    // Cancel button
    const cancelBg = this.add.rectangle(GAME_WIDTH / 2 + 55, GAME_HEIGHT / 2 + 25, 90, 30, 0x1e3a5f, 0.9)
      .setStrokeStyle(1, 0x60a5fa).setDepth(302).setInteractive({ useHandCursor: true });
    const cancelLabel = this.add.text(GAME_WIDTH / 2 + 55, GAME_HEIGHT / 2 + 25, "Cancel", {
      fontSize: "10px", color: "#60a5fa", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(303);

    const cleanup = () => {
      overlay.destroy(); box.destroy(); title.destroy(); msg.destroy();
      confirmBg.destroy(); confirmLabel.destroy(); cancelBg.destroy(); cancelLabel.destroy();
    };

    cancelBg.on("pointerdown", cleanup);
    overlay.on("pointerdown", cleanup);

    confirmBg.on("pointerdown", () => {
      // Clear all game-related localStorage keys
      const keysToRemove = [
        "poke-roguelite-meta",
        "poke-roguelite-save",
        "poke-roguelite-leaderboard",
        "poke-roguelite-recent-runs",
        "poke-roguelite-daily-scores",
        "poke-roguelite-daily-attempt",
        "poke-roguelite-difficulty",
        "poke-roguelite-audio",
        "poke-roguelite-dpadSide",
      ];
      for (const key of keysToRemove) {
        try { localStorage.removeItem(key); } catch { /* ignore */ }
      }

      cleanup();

      // Show confirmation message briefly, then restart
      const doneText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "Progress reset!\nRestarting...", {
        fontSize: "14px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold", align: "center",
      }).setOrigin(0.5).setDepth(400);

      this.time.delayedCall(1200, () => {
        doneText.destroy();
        this.scene.start("HubScene");
      });
    });
  }
}
