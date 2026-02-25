import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { loadMeta, saveMeta, MetaSaveData } from "../core/save-system";
import { getHeldItem } from "../core/held-items";
import {
  getForgeLevel, getForgeCost, getForgeBonus,
  canForge, applyForge, MAX_FORGE_LEVEL,
} from "../core/forge";
import { sfxMenuOpen, sfxMenuClose, sfxBuff } from "../core/sound-manager";

/**
 * ForgeScene — upgrade held items at the hub to boost their stats.
 * Players spend gold to enhance their equipped held item up to +5.
 */
export class ForgeScene extends Phaser.Scene {
  private meta!: MetaSaveData;

  constructor() {
    super({ key: "ForgeScene" });
  }

  create() {
    this.meta = loadMeta();
    sfxMenuOpen();

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1a);

    // Title
    this.add.text(GAME_WIDTH / 2, 22, "Forge", {
      fontSize: "20px", color: "#f59e0b", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    // Anvil ASCII art
    const anvil = [
      "     ,/|",
      "    / ' |",
      "   /____\\|",
      "  |======|",
      "  |  /\\  |",
      " _|_/  \\_|_",
      "|__________|",
    ].join("\n");
    this.add.text(GAME_WIDTH / 2, 80, anvil, {
      fontSize: "9px", color: "#78716c", fontFamily: "monospace", lineSpacing: 1,
    }).setOrigin(0.5);

    // Separator
    this.add.text(GAME_WIDTH / 2, 130, "────────────────────────────────", {
      fontSize: "8px", color: "#334155", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Gold display
    this.add.text(GAME_WIDTH / 2, 146, `Gold: ${this.meta.gold}`, {
      fontSize: "13px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Current held item info
    const equippedId = this.meta.equippedHeldItem;
    const heldItem = equippedId ? getHeldItem(equippedId) : undefined;
    const forgeLevel = getForgeLevel(this.meta);
    const currentBonus = getForgeBonus(forgeLevel);

    if (!heldItem) {
      // No held item equipped
      this.add.text(GAME_WIDTH / 2, 200, "No held item equipped", {
        fontSize: "14px", color: "#664444", fontFamily: "monospace",
      }).setOrigin(0.5);

      this.add.text(GAME_WIDTH / 2, 224, "Equip a held item first", {
        fontSize: "10px", color: "#555568", fontFamily: "monospace",
      }).setOrigin(0.5);
    } else {
      // Item card background
      const cardY = 190;
      const cardH = 100;
      this.add.rectangle(GAME_WIDTH / 2, cardY, GAME_WIDTH - 40, cardH, 0x151d30, 0.95)
        .setStrokeStyle(1, 0x445566);

      // Item name
      this.add.text(GAME_WIDTH / 2, cardY - 32, heldItem.name, {
        fontSize: "16px", color: "#f59e0b", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5);

      // Item description / stats
      this.add.text(GAME_WIDTH / 2, cardY - 12, heldItem.description, {
        fontSize: "10px", color: "#94a3b8", fontFamily: "monospace",
      }).setOrigin(0.5);

      // Forge level stars
      const filledStars = "\u2605".repeat(forgeLevel);
      const emptyStars = "\u2606".repeat(MAX_FORGE_LEVEL - forgeLevel);
      const starsStr = filledStars + emptyStars;
      const starsColor = forgeLevel >= MAX_FORGE_LEVEL ? "#fbbf24" : "#f59e0b";
      this.add.text(GAME_WIDTH / 2, cardY + 8, starsStr, {
        fontSize: "18px", color: starsColor, fontFamily: "monospace",
      }).setOrigin(0.5);

      // Current bonus
      const bonusLabel = forgeLevel > 0 ? `+${currentBonus}% stats` : "No upgrades yet";
      const bonusColor = forgeLevel > 0 ? "#4ade80" : "#555568";
      this.add.text(GAME_WIDTH / 2, cardY + 30, bonusLabel, {
        fontSize: "12px", color: bonusColor, fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5);

      // Upgrade section
      const upgradeY = cardY + cardH / 2 + 40;

      if (forgeLevel >= MAX_FORGE_LEVEL) {
        // Maxed out
        this.add.text(GAME_WIDTH / 2, upgradeY, "MAX LEVEL", {
          fontSize: "16px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
        }).setOrigin(0.5);

        this.add.text(GAME_WIDTH / 2, upgradeY + 22, `+${currentBonus}% bonus to all held item stats`, {
          fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
        }).setOrigin(0.5);
      } else {
        // Show next upgrade info
        const cost = getForgeCost(forgeLevel);
        const nextBonus = getForgeBonus(forgeLevel + 1);
        const canAfford = canForge(this.meta);

        // Preview
        this.add.text(GAME_WIDTH / 2, upgradeY - 16, "Next Upgrade:", {
          fontSize: "10px", color: "#94a3b8", fontFamily: "monospace",
        }).setOrigin(0.5);

        this.add.text(GAME_WIDTH / 2, upgradeY + 2,
          `+${currentBonus}% -> +${nextBonus}%`, {
          fontSize: "14px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
        }).setOrigin(0.5);

        this.add.text(GAME_WIDTH / 2, upgradeY + 22,
          `Cost: ${cost} Gold`, {
          fontSize: "11px", color: canAfford ? "#fde68a" : "#664444", fontFamily: "monospace",
        }).setOrigin(0.5);

        // Upgrade button
        const btnY = upgradeY + 56;
        const btnW = 180;
        const btnH = 40;
        const btnColor = canAfford ? 0x2a2a0a : 0x1a1a1a;
        const btnStroke = canAfford ? 0xf59e0b : 0x333344;

        const upgBtn = this.add.rectangle(GAME_WIDTH / 2, btnY, btnW, btnH, btnColor, 0.9)
          .setStrokeStyle(2, btnStroke);

        const upgBtnText = this.add.text(GAME_WIDTH / 2, btnY, canAfford ? "Upgrade" : "Not Enough Gold", {
          fontSize: canAfford ? "14px" : "11px",
          color: canAfford ? "#f59e0b" : "#555568",
          fontFamily: "monospace",
          fontStyle: "bold",
        }).setOrigin(0.5);

        if (canAfford) {
          upgBtn.setInteractive({ useHandCursor: true });
          const hoverColor = 0x3a3a1a;
          upgBtn.on("pointerover", () => upgBtn.setFillStyle(hoverColor, 1));
          upgBtn.on("pointerout", () => upgBtn.setFillStyle(btnColor, 0.9));
          upgBtn.on("pointerdown", () => {
            this.doUpgrade();
          });
        }
      }
    }

    // Back button (fixed at bottom)
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 30, GAME_WIDTH, 50, 0x0a0a1a).setDepth(50);
    const backBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, "[Back to Town]", {
      fontSize: "14px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(51);
    backBtn.on("pointerdown", () => {
      sfxMenuClose();
      this.scene.start("HubScene");
    });
  }

  private doUpgrade() {
    if (!canForge(this.meta)) return;

    const result = applyForge(this.meta);
    saveMeta(this.meta);
    sfxBuff();

    // Golden flash animation before restart
    this.cameras.main.flash(400, 255, 215, 0);
    this.time.delayedCall(450, () => {
      this.scene.restart();
    });
  }
}
