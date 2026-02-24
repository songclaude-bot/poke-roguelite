import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { DUNGEONS, DungeonDef, CHALLENGE_MODES } from "../core/dungeon-data";
import { SPECIES } from "../core/pokemon-data";
import { MetaSaveData, loadMeta } from "../core/save-system";
import { getHeldItem } from "../core/held-items";
import { SPECIES_ABILITIES, ABILITIES, AbilityId } from "../core/ability";
import { getAbilityLevel } from "../core/ability-upgrade";
import { getUpgradeBonus } from "./UpgradeScene";
import { rollModifiers, DungeonModifier } from "../core/dungeon-modifiers";
import { getDailyConfig } from "../core/daily-dungeon";
import { stopBgm } from "../core/sound-manager";
import { clearDungeonSave, saveMeta } from "../core/save-system";

/**
 * DungeonPreviewScene — shows dungeon info before entering.
 * Displays dungeon details, enemy preview, boss info, team info, and modifiers.
 */
export class DungeonPreviewScene extends Phaser.Scene {
  private meta!: MetaSaveData;
  private dungeonId!: string;
  private challengeMode?: string;

  constructor() {
    super({ key: "DungeonPreviewScene" });
  }

  init(data: { dungeonId: string; meta: MetaSaveData; challengeMode?: string }) {
    this.dungeonId = data.dungeonId;
    this.meta = data.meta;
    this.challengeMode = data.challengeMode;
  }

  create() {
    const dungeon = DUNGEONS[this.dungeonId];
    if (!dungeon) {
      this.scene.start("HubScene");
      return;
    }

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1a);

    // Scrollable content container
    const container = this.add.container(0, 0).setDepth(10);

    // Scroll area setup
    const scrollTop = 0;
    const scrollBottom = GAME_HEIGHT - 70; // leave room for buttons
    const scrollH = scrollBottom - scrollTop;

    // Mask for scrollable area
    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillRect(0, scrollTop, GAME_WIDTH, scrollH);
    const geoMask = maskShape.createGeometryMask();
    container.setMask(geoMask);

    let cy = 20;
    const padX = 20;
    const contentW = GAME_WIDTH - padX * 2;

    // ── Dungeon Info Header ──
    const nameText = this.add.text(GAME_WIDTH / 2, cy, dungeon.name, {
      fontSize: "18px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);
    container.add(nameText);
    cy += 28;

    // Floor count
    const floorText = this.dungeonId === "endlessDungeon"
      ? "Infinite Floors"
      : `B1F - B${dungeon.floors}F`;
    const floorLabel = this.add.text(GAME_WIDTH / 2, cy, floorText, {
      fontSize: "11px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5);
    container.add(floorLabel);
    cy += 18;

    // Difficulty stars
    const maxStars = 5;
    const diffNormalized = Math.min(maxStars, Math.round(dungeon.difficulty));
    const filledStars = "\u2605".repeat(diffNormalized);
    const emptyStars = "\u2606".repeat(maxStars - diffNormalized);
    const diffLabel = this.add.text(GAME_WIDTH / 2, cy,
      `Difficulty: ${filledStars}${emptyStars}`, {
      fontSize: "12px", color: "#f59e0b", fontFamily: "monospace",
    }).setOrigin(0.5);
    container.add(diffLabel);
    cy += 18;

    // Dungeon type badge
    const dungeonType = this.inferDungeonType(dungeon);
    const typeBadge = this.add.text(GAME_WIDTH / 2, cy, dungeonType, {
      fontSize: "10px", color: this.getTypeColor(dungeonType), fontFamily: "monospace",
      backgroundColor: "#1a1a2e", padding: { x: 8, y: 3 },
    }).setOrigin(0.5);
    container.add(typeBadge);
    cy += 22;

    // Challenge mode badge (if applicable)
    if (this.challengeMode) {
      const ch = CHALLENGE_MODES.find(c => c.id === this.challengeMode);
      if (ch) {
        const challengeBadge = this.add.text(GAME_WIDTH / 2, cy,
          `Challenge: ${ch.name}`, {
          fontSize: "10px", color: ch.color, fontFamily: "monospace",
          backgroundColor: "#1a1a2e", padding: { x: 8, y: 3 },
        }).setOrigin(0.5);
        container.add(challengeBadge);
        cy += 20;

        const challengeDesc = this.add.text(GAME_WIDTH / 2, cy, ch.description, {
          fontSize: "9px", color: "#666680", fontFamily: "monospace",
        }).setOrigin(0.5);
        container.add(challengeDesc);
        cy += 18;
      }
    }

    // Separator
    cy += 4;
    const sep1 = this.add.rectangle(GAME_WIDTH / 2, cy, contentW, 1, 0x334155);
    container.add(sep1);
    cy += 10;

    // ── Enemy Preview ──
    const enemySectionTitle = this.add.text(padX, cy, "-- Known Pokemon --", {
      fontSize: "11px", color: "#60a5fa", fontFamily: "monospace", fontStyle: "bold",
    });
    container.add(enemySectionTitle);
    cy += 18;

    const enemyIds = dungeon.enemySpeciesIds.length > 0
      ? dungeon.enemySpeciesIds
      : this.getSpecialDungeonEnemies(dungeon);

    const displayEnemies = enemyIds.slice(0, 4);

    if (displayEnemies.length === 0) {
      const noEnemy = this.add.text(padX + 10, cy, "??? (Unknown enemies)", {
        fontSize: "10px", color: "#666680", fontFamily: "monospace",
      });
      container.add(noEnemy);
      cy += 16;
    } else {
      for (const eid of displayEnemies) {
        const sp = SPECIES[eid];
        if (!sp) continue;
        const typeStr = sp.types.map(t => t).join("/");
        const enemyRow = this.add.text(padX + 10, cy,
          `${sp.name}  [${typeStr}]`, {
          fontSize: "10px", color: "#e0e0e0", fontFamily: "monospace",
        });
        container.add(enemyRow);
        cy += 16;
      }
    }

    if (enemyIds.length > 4) {
      const moreText = this.add.text(padX + 10, cy,
        `...and ${enemyIds.length - 4} more`, {
        fontSize: "9px", color: "#666680", fontFamily: "monospace",
      });
      container.add(moreText);
      cy += 16;
    }

    cy += 6;

    // ── Boss Info ──
    if (dungeon.boss) {
      const sep2 = this.add.rectangle(GAME_WIDTH / 2, cy, contentW, 1, 0x334155);
      container.add(sep2);
      cy += 10;

      const bossSectionTitle = this.add.text(padX, cy, "-- Floor Boss --", {
        fontSize: "11px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
      });
      container.add(bossSectionTitle);
      cy += 18;

      const bossSp = SPECIES[dungeon.boss.speciesId];
      const bossTypeStr = bossSp ? bossSp.types.map(t => t).join("/") : "???";
      const bossName = this.add.text(padX + 10, cy,
        `${dungeon.boss.name}  [${bossTypeStr}]`, {
        fontSize: "10px", color: "#fca5a5", fontFamily: "monospace",
      });
      container.add(bossName);
      cy += 16;

      // Danger meter based on statMultiplier
      const mult = dungeon.boss.statMultiplier;
      const dangerLevel = Math.min(10, Math.round(mult));
      const dangerBarW = contentW - 20;
      const dangerBg = this.add.rectangle(padX + 10 + dangerBarW / 2, cy + 4, dangerBarW, 10, 0x1a1a2e)
        .setStrokeStyle(1, 0x334155);
      container.add(dangerBg);
      const fillW = (dangerLevel / 10) * dangerBarW;
      const dangerColor = dangerLevel <= 3 ? 0x4ade80 : dangerLevel <= 6 ? 0xfbbf24 : 0xef4444;
      const dangerFill = this.add.rectangle(padX + 10 + fillW / 2, cy + 4, fillW, 8, dangerColor);
      container.add(dangerFill);
      const dangerLabel = this.add.text(padX + 10 + dangerBarW + 5, cy,
        `x${mult.toFixed(1)}`, {
        fontSize: "9px", color: "#ef4444", fontFamily: "monospace",
      });
      container.add(dangerLabel);
      cy += 20;
    } else if (this.dungeonId === "bossRush") {
      const sep2 = this.add.rectangle(GAME_WIDTH / 2, cy, contentW, 1, 0x334155);
      container.add(sep2);
      cy += 10;

      const bossSectionTitle = this.add.text(padX, cy, "-- Boss Rush --", {
        fontSize: "11px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
      });
      container.add(bossSectionTitle);
      cy += 18;

      const bossDesc = this.add.text(padX + 10, cy, "10 consecutive boss fights!", {
        fontSize: "10px", color: "#fca5a5", fontFamily: "monospace",
      });
      container.add(bossDesc);
      cy += 16;
    }

    cy += 6;

    // ── Your Team Info ──
    const sep3 = this.add.rectangle(GAME_WIDTH / 2, cy, contentW, 1, 0x334155);
    container.add(sep3);
    cy += 10;

    const teamSectionTitle = this.add.text(padX, cy, "-- Your Team --", {
      fontSize: "11px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
    });
    container.add(teamSectionTitle);
    cy += 18;

    const starterId = this.meta.starter ?? "mudkip";
    const starterSp = SPECIES[starterId];
    const starterName = starterSp ? starterSp.name : starterId;
    const starterTypes = starterSp ? starterSp.types.map(t => t).join("/") : "???";

    // Calculate effective stats from upgrades
    const hpBonus = getUpgradeBonus(this.meta, "maxHp") * 5;
    const atkBonus = getUpgradeBonus(this.meta, "atk");
    const defBonus = getUpgradeBonus(this.meta, "def");
    const baseHp = starterSp ? starterSp.baseStats.hp : 50;

    // Held item bonuses
    const equippedId = this.meta.equippedHeldItem;
    const heldItem = equippedId ? getHeldItem(equippedId) : undefined;
    const heldHpBonus = heldItem?.effect.hpBonus ?? 0;

    const totalHp = baseHp + hpBonus + heldHpBonus;

    const starterRow = this.add.text(padX + 10, cy,
      `${starterName}  [${starterTypes}]`, {
      fontSize: "10px", color: "#e0e0e0", fontFamily: "monospace",
    });
    container.add(starterRow);
    cy += 16;

    const starterStats = this.add.text(padX + 10, cy,
      `Lv.1  HP: ${totalHp}`, {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
    });
    container.add(starterStats);
    cy += 16;

    // Held item
    const heldItemName = heldItem ? heldItem.name : "None";
    const heldRow = this.add.text(padX + 10, cy,
      `Held Item: ${heldItemName}`, {
      fontSize: "9px", color: heldItem ? "#f59e0b" : "#666680", fontFamily: "monospace",
    });
    container.add(heldRow);
    cy += 16;

    // Ability
    const abilityId = SPECIES_ABILITIES[starterId] ?? SPECIES_ABILITIES["mudkip"];
    const abilityDef = ABILITIES[abilityId];
    const abilityLv = getAbilityLevel(this.meta.abilityLevels, abilityId);
    if (abilityDef) {
      const abilityRow = this.add.text(padX + 10, cy,
        `Ability: ${abilityDef.name} Lv.${abilityLv}`, {
        fontSize: "9px", color: "#667eea", fontFamily: "monospace",
      });
      container.add(abilityRow);
      cy += 16;
    }

    cy += 6;

    // ── Modifiers Preview ──
    // For regular dungeons, roll modifiers preview
    // For daily dungeon, show daily modifiers
    const isSpecial = ["endlessDungeon", "bossRush", "dailyDungeon"].includes(this.dungeonId);
    let previewModifiers: DungeonModifier[] = [];

    if (this.dungeonId === "dailyDungeon") {
      // Daily dungeon has fixed modifiers from config
      const dailyConfig = getDailyConfig();
      // Daily modifiers are strings, not full DungeonModifier objects
      // Show them as text
      if (dailyConfig.modifiers.length > 0) {
        const sep4 = this.add.rectangle(GAME_WIDTH / 2, cy, contentW, 1, 0x334155);
        container.add(sep4);
        cy += 10;

        const modSectionTitle = this.add.text(padX, cy, "-- Daily Modifiers --", {
          fontSize: "11px", color: "#10b981", fontFamily: "monospace", fontStyle: "bold",
        });
        container.add(modSectionTitle);
        cy += 18;

        for (const modName of dailyConfig.modifiers) {
          const modRow = this.add.text(padX + 10, cy,
            `* ${modName}`, {
            fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
          });
          container.add(modRow);
          cy += 14;
        }
        cy += 6;
      }
    } else if (!isSpecial && !this.challengeMode) {
      // Regular dungeons get random modifiers
      previewModifiers = rollModifiers();
      if (previewModifiers.length > 0) {
        const sep4 = this.add.rectangle(GAME_WIDTH / 2, cy, contentW, 1, 0x334155);
        container.add(sep4);
        cy += 10;

        const modSectionTitle = this.add.text(padX, cy, "-- Run Modifiers --", {
          fontSize: "11px", color: "#a855f7", fontFamily: "monospace", fontStyle: "bold",
        });
        container.add(modSectionTitle);
        cy += 18;

        for (const mod of previewModifiers) {
          const modRow = this.add.text(padX + 10, cy,
            `${mod.name}: ${mod.description}`, {
            fontSize: "9px", color: mod.color, fontFamily: "monospace",
          });
          container.add(modRow);
          cy += 14;
        }
        cy += 6;
      }
    }

    // ── Description ──
    const sep5 = this.add.rectangle(GAME_WIDTH / 2, cy, contentW, 1, 0x334155);
    container.add(sep5);
    cy += 10;

    const descText = this.add.text(GAME_WIDTH / 2, cy, dungeon.description, {
      fontSize: "9px", color: "#666680", fontFamily: "monospace",
      align: "center", wordWrap: { width: contentW },
    }).setOrigin(0.5, 0);
    container.add(descText);
    cy += descText.height + 20;

    // Scroll state
    const contentH = cy;
    const maxScroll = Math.max(0, contentH - scrollH);
    let scrollOffset = 0;

    // Touch/mouse scroll
    let dragStartY = 0;

    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (ptr.y >= scrollTop && ptr.y <= scrollBottom) {
        dragStartY = ptr.y;
      }
    });

    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      if (!ptr.isDown || ptr.y < scrollTop || ptr.y > scrollBottom) return;
      const dy = ptr.y - dragStartY;
      dragStartY = ptr.y;
      scrollOffset = Math.max(-maxScroll, Math.min(0, scrollOffset + dy));
      container.y = scrollOffset;
    });

    // ── Bottom Buttons (fixed, not scrollable) ──
    const btnY = GAME_HEIGHT - 35;
    const btnW = 140;
    const btnH = 36;
    const btnGap = 10;

    // Button background area
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 35, GAME_WIDTH, 70, 0x0a0a1a).setDepth(50);

    // [Back] button
    const backBg = this.add.rectangle(GAME_WIDTH / 2 - btnW / 2 - btnGap / 2, btnY, btnW, btnH, 0x1a1a2e, 0.95)
      .setStrokeStyle(1, 0x334155).setDepth(51).setInteractive({ useHandCursor: true });
    const backText = this.add.text(GAME_WIDTH / 2 - btnW / 2 - btnGap / 2, btnY, "Back", {
      fontSize: "13px", color: "#94a3b8", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(52);

    backBg.on("pointerover", () => backBg.setFillStyle(0x2a2a4e, 1));
    backBg.on("pointerout", () => backBg.setFillStyle(0x1a1a2e, 0.95));
    backBg.on("pointerdown", () => {
      this.scene.start("HubScene");
    });

    // [Enter Dungeon] button
    const enterBg = this.add.rectangle(GAME_WIDTH / 2 + btnW / 2 + btnGap / 2, btnY, btnW, btnH, 0x1a3a1a, 0.95)
      .setStrokeStyle(1, 0x4ade80).setDepth(51).setInteractive({ useHandCursor: true });
    const enterText = this.add.text(GAME_WIDTH / 2 + btnW / 2 + btnGap / 2, btnY, "Enter Dungeon", {
      fontSize: "12px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(52);

    // Pulse animation on enter button
    this.tweens.add({
      targets: enterBg,
      alpha: { from: 0.95, to: 0.7 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    enterBg.on("pointerover", () => enterBg.setFillStyle(0x2a5a2a, 1));
    enterBg.on("pointerout", () => enterBg.setFillStyle(0x1a3a1a, 0.95));
    enterBg.on("pointerdown", () => {
      this.launchDungeon(previewModifiers);
    });
  }

  private launchDungeon(modifiers: DungeonModifier[]) {
    stopBgm();
    clearDungeonSave();
    this.meta.totalRuns++;
    // Track last dungeon and per-dungeon run count
    this.meta.lastDungeonId = this.dungeonId;
    this.meta.lastChallenge = this.challengeMode ?? undefined;
    if (!this.meta.dungeonRunCounts) this.meta.dungeonRunCounts = {};
    this.meta.dungeonRunCounts[this.dungeonId] = (this.meta.dungeonRunCounts[this.dungeonId] ?? 0) + 1;
    saveMeta(this.meta);

    const modifierIds = modifiers.map(m => m.id);

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(450, () => {
      const launchData: Record<string, unknown> = {
        floor: 1,
        fromHub: true,
        dungeonId: this.dungeonId,
        starter: this.meta.starter ?? "mudkip",
      };
      if (this.challengeMode) {
        launchData.challengeMode = this.challengeMode;
      }
      if (modifierIds.length > 0) {
        launchData.modifiers = modifierIds;
      }
      this.scene.start("DungeonScene", launchData);
    });
  }

  /** Infer the primary dungeon type from enemy species */
  private inferDungeonType(dungeon: DungeonDef): string {
    if (this.dungeonId === "endlessDungeon") return "Mixed";
    if (this.dungeonId === "bossRush") return "Boss Rush";
    if (this.dungeonId === "dailyDungeon") return "Daily";

    const typeCounts: Record<string, number> = {};
    for (const eid of dungeon.enemySpeciesIds) {
      const sp = SPECIES[eid];
      if (!sp) continue;
      for (const t of sp.types) {
        typeCounts[t] = (typeCounts[t] ?? 0) + 1;
      }
    }

    let bestType = "Normal";
    let bestCount = 0;
    for (const [type, count] of Object.entries(typeCounts)) {
      if (count > bestCount) {
        bestCount = count;
        bestType = type;
      }
    }
    return bestType;
  }

  /** Get enemy names for special dungeons that have empty enemySpeciesIds */
  private getSpecialDungeonEnemies(dungeon: DungeonDef): string[] {
    // For special dungeons, try to gather enemies from floorEnemies
    const seen = new Set<string>();
    for (const floorEnemies of Object.values(dungeon.floorEnemies)) {
      for (const eid of floorEnemies) {
        seen.add(eid);
      }
    }
    return Array.from(seen);
  }

  /** Get a color for the dungeon type badge */
  private getTypeColor(type: string): string {
    const typeColors: Record<string, string> = {
      Normal: "#a8a878",
      Water: "#6890f0",
      Fire: "#f08030",
      Grass: "#78c850",
      Electric: "#f8d030",
      Flying: "#a890f0",
      Poison: "#a040a0",
      Ground: "#e0c068",
      Rock: "#b8a038",
      Bug: "#a8b820",
      Fighting: "#c03028",
      Steel: "#b8b8d0",
      Ghost: "#705898",
      Psychic: "#f85888",
      Ice: "#98d8d8",
      Dark: "#705848",
      Fairy: "#ee99ac",
      Dragon: "#7038f8",
      Mixed: "#94a3b8",
      "Boss Rush": "#dc2626",
      Daily: "#10b981",
    };
    return typeColors[type] ?? "#94a3b8";
  }
}
