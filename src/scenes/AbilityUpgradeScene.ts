import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { loadMeta, saveMeta, MetaSaveData } from "../core/save-system";
import { AbilityId, ABILITIES, SPECIES_ABILITIES } from "../core/ability";
import {
  ABILITY_UPGRADES,
  getAbilityLevel,
  getAbilityUpgrade,
  getNextAbilityUpgrade,
} from "../core/ability-upgrade";

/**
 * AbilityUpgradeScene — "Ability Dojo" in the hub town.
 * Players can enhance their starter Pokemon's passive ability using gold.
 */
export class AbilityUpgradeScene extends Phaser.Scene {
  private meta!: MetaSaveData;

  constructor() {
    super({ key: "AbilityUpgradeScene" });
  }

  create() {
    this.meta = loadMeta();

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0f0f1a);

    // Decorative dojo feel
    this.add.rectangle(GAME_WIDTH / 2, 60, GAME_WIDTH - 40, 2, 0x667eea, 0.3);

    // Title
    this.add.text(GAME_WIDTH / 2, 30, "Ability Dojo", {
      fontSize: "18px", color: "#667eea", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    // Gold display
    const goldText = this.add.text(GAME_WIDTH / 2, 55, `Gold: ${this.meta.gold}`, {
      fontSize: "13px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Get current starter info
    const starterId = this.meta.starter ?? "mudkip";
    const abilityId = SPECIES_ABILITIES[starterId] ?? SPECIES_ABILITIES["mudkip"];
    const abilityDef = ABILITIES[abilityId];
    const tiers = ABILITY_UPGRADES[abilityId];

    if (!abilityDef || !tiers) {
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "No ability data found.", {
        fontSize: "12px", color: "#ef4444", fontFamily: "monospace",
      }).setOrigin(0.5);
      this.addBackButton();
      return;
    }

    const currentLevel = getAbilityLevel(this.meta.abilityLevels, abilityId);
    const currentUpgrade = getAbilityUpgrade(abilityId, currentLevel)!;
    const nextUpgrade = getNextAbilityUpgrade(abilityId, currentLevel);
    const isMaxed = !nextUpgrade;

    // Starter name
    const starterName = starterId.charAt(0).toUpperCase() + starterId.slice(1);
    this.add.text(GAME_WIDTH / 2, 80, `${starterName}'s Ability`, {
      fontSize: "11px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Current ability name
    this.add.text(GAME_WIDTH / 2, 105, currentUpgrade.name, {
      fontSize: "16px", color: "#e0e0e0", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    // Current description
    this.add.text(GAME_WIDTH / 2, 128, currentUpgrade.description, {
      fontSize: "10px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Level bar with stars
    const maxLevel = tiers.length;
    let starStr = "";
    for (let i = 1; i <= maxLevel; i++) {
      starStr += i <= currentLevel ? "\u2605" : "\u2606";
    }
    this.add.text(GAME_WIDTH / 2, 155, starStr, {
      fontSize: "22px", color: "#fbbf24", fontFamily: "monospace",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 178, `Level ${currentLevel} / ${maxLevel}`, {
      fontSize: "10px", color: "#666680", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Decorative line
    this.add.rectangle(GAME_WIDTH / 2, 195, GAME_WIDTH - 60, 1, 0x334155, 0.5);

    // Next upgrade details
    if (isMaxed) {
      this.add.text(GAME_WIDTH / 2, 220, "-- MAX LEVEL --", {
        fontSize: "14px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5);

      this.add.text(GAME_WIDTH / 2, 245, "This ability is fully enhanced!", {
        fontSize: "10px", color: "#94a3b8", fontFamily: "monospace",
      }).setOrigin(0.5);
    } else {
      this.add.text(GAME_WIDTH / 2, 210, "Next Upgrade:", {
        fontSize: "11px", color: "#60a5fa", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5);

      this.add.text(GAME_WIDTH / 2, 232, nextUpgrade.name, {
        fontSize: "14px", color: "#e0e0e0", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5);

      this.add.text(GAME_WIDTH / 2, 252, nextUpgrade.description, {
        fontSize: "10px", color: "#94a3b8", fontFamily: "monospace",
      }).setOrigin(0.5);

      // Cost
      const costColor = this.meta.gold >= nextUpgrade.cost ? "#4ade80" : "#ef4444";
      this.add.text(GAME_WIDTH / 2, 278, `Cost: ${nextUpgrade.cost}G`, {
        fontSize: "12px", color: costColor, fontFamily: "monospace",
      }).setOrigin(0.5);

      // Required clears
      const hasClears = this.meta.totalClears >= nextUpgrade.requiredClears;
      const clearsColor = hasClears ? "#4ade80" : "#ef4444";
      this.add.text(GAME_WIDTH / 2, 296, `Requires: ${nextUpgrade.requiredClears} clears (have ${this.meta.totalClears})`, {
        fontSize: "10px", color: clearsColor, fontFamily: "monospace",
      }).setOrigin(0.5);

      // Upgrade button
      const canUpgrade = this.meta.gold >= nextUpgrade.cost && hasClears;
      const btnColor = canUpgrade ? 0x2a4a3a : 0x222233;
      const btnStroke = canUpgrade ? 0x4ade80 : 0x333344;
      const btnTextColor = canUpgrade ? "#4ade80" : "#444460";

      const upgBtnColor = canUpgrade ? 0x1e3a5f : 0x222233;
      const upgBtnStroke = canUpgrade ? 0x667eea : 0x333344;
      const upgBtnTextColor = canUpgrade ? "#667eea" : "#444460";

      const upgBtn = this.add.rectangle(GAME_WIDTH / 2, 340, 200, 40, upgBtnColor, 0.9)
        .setStrokeStyle(2, upgBtnStroke);

      const upgBtnText = this.add.text(GAME_WIDTH / 2, 340, "Upgrade", {
        fontSize: "14px", color: upgBtnTextColor, fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5);

      if (canUpgrade) {
        upgBtn.setInteractive({ useHandCursor: true });
        upgBtn.on("pointerover", () => upgBtn.setFillStyle(0x2e5a8f, 1));
        upgBtn.on("pointerout", () => upgBtn.setFillStyle(0x1e3a5f, 0.9));
        upgBtn.on("pointerdown", () => {
          // Perform upgrade
          this.meta.gold -= nextUpgrade.cost;
          if (!this.meta.abilityLevels) this.meta.abilityLevels = {};
          this.meta.abilityLevels[abilityId] = currentLevel + 1;
          saveMeta(this.meta);

          // Flash effect
          this.cameras.main.flash(300, 102, 126, 234);

          // Restart scene to refresh display
          this.scene.restart();
        });
      }
    }

    // All abilities overview (collapsed list below)
    this.addAbilityOverview(abilityId, currentLevel, 390);

    // Back button
    this.addBackButton();
  }

  private addAbilityOverview(currentAbilityId: AbilityId, currentLevel: number, startY: number) {
    this.add.rectangle(GAME_WIDTH / 2, startY - 10, GAME_WIDTH - 60, 1, 0x334155, 0.5);

    this.add.text(GAME_WIDTH / 2, startY + 5, "All Ability Tiers", {
      fontSize: "10px", color: "#667eea", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    const tiers = ABILITY_UPGRADES[currentAbilityId];
    if (!tiers) return;

    let y = startY + 28;
    for (const tier of tiers) {
      const isCurrent = tier.level === currentLevel;
      const isUnlocked = tier.level <= currentLevel;
      const icon = isUnlocked ? "\u2713" : "\u2022";
      const color = isCurrent ? "#fbbf24" : isUnlocked ? "#4ade80" : "#666680";

      this.add.text(30, y, `${icon} Lv.${tier.level}: ${tier.name}`, {
        fontSize: "9px", color, fontFamily: "monospace", fontStyle: isCurrent ? "bold" : "normal",
      });

      this.add.text(GAME_WIDTH - 30, y, tier.level === 1 ? "Free" : `${tier.cost}G`, {
        fontSize: "9px", color: isUnlocked ? "#4ade80" : "#666680", fontFamily: "monospace",
      }).setOrigin(1, 0);

      this.add.text(30, y + 12, `  ${tier.description}`, {
        fontSize: "8px", color: "#555566", fontFamily: "monospace",
      });

      y += 30;
    }
  }

  private addBackButton() {
    const backBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 30, 180, 34, 0x1a1a2e, 0.95)
      .setStrokeStyle(1, 0x334155).setInteractive({ useHandCursor: true });
    backBg.on("pointerover", () => backBg.setFillStyle(0x2a2a4e, 1));
    backBg.on("pointerout", () => backBg.setFillStyle(0x1a1a2e, 0.95));
    backBg.on("pointerdown", () => this.scene.start("HubScene"));
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, "Back to Town", {
      fontSize: "13px", color: "#60a5fa", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);
  }
}
