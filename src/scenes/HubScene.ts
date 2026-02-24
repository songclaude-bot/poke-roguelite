import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import {
  loadMeta, saveMeta, loadDungeon, clearDungeonSave,
  hasDungeonSave, deserializeSkills, deserializeInventory,
  MetaSaveData,
} from "../core/save-system";
import { getHeldItem } from "../core/held-items";
import { DUNGEONS, DungeonDef, getUnlockedDungeons, CHALLENGE_MODES } from "../core/dungeon-data";
import { initAudio, startBgm } from "../core/sound-manager";
import { getDailyConfig, hasDailyAttempt, loadDailyScores } from "../core/daily-dungeon";
import { getStorageItemCount, addToStorage } from "../core/crafting";
import { SPECIES_ABILITIES, ABILITIES } from "../core/ability";
import { getAbilityLevel } from "../core/ability-upgrade";
import { STARTER_LIST } from "../core/starter-data";
import {
  getNGPlusLevel, canActivateNGPlus, activateNGPlus,
  getCurrentBonuses, getNextNGPlusRequirement,
} from "../core/new-game-plus";
import {
  calculatePassiveIncome, getIncomeRate, updateLastVisit,
} from "../core/passive-income";

/**
 * HubScene — the town between dungeon runs.
 * Now supports multiple dungeon selection.
 */
export class HubScene extends Phaser.Scene {
  private meta!: MetaSaveData;
  private starterLabel: Phaser.GameObjects.Text | null = null;
  private starterDesc: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: "HubScene" });
  }

  init(data?: {
    gold?: number;
    cleared?: boolean;
    bestFloor?: number;
    enemiesDefeated?: number;
    turns?: number;
    dungeonId?: string;
    starter?: string;
    challengeMode?: string;
    pokemonSeen?: string[];
    inventory?: { itemId: string; count: number }[];
  }) {
    this.meta = loadMeta();

    if (data?.gold !== undefined) {
      this.meta.gold += data.gold;
      this.meta.totalGold += data.gold;
      this.meta.totalRuns++;
      if (data.cleared) this.meta.totalClears++;
      if (data.bestFloor && data.bestFloor > this.meta.bestFloor) {
        this.meta.bestFloor = data.bestFloor;
      }
      // Track achievement stats
      this.meta.totalEnemiesDefeated += data.enemiesDefeated ?? 0;
      this.meta.totalTurns += data.turns ?? 0;
      // Endless best floor
      if (data.dungeonId === "endlessDungeon" && data.bestFloor) {
        if (data.bestFloor > this.meta.endlessBestFloor) {
          this.meta.endlessBestFloor = data.bestFloor;
        }
      }
      // Challenge clears
      if (data.cleared && data.challengeMode) {
        this.meta.challengeClears++;
      }
      // Starter usage tracking
      if (data.starter && !this.meta.startersUsed.includes(data.starter)) {
        this.meta.startersUsed.push(data.starter);
      }
      // Pokedex: merge seen Pokemon from this run
      if (data.pokemonSeen && data.pokemonSeen.length > 0) {
        const seenSet = new Set(this.meta.pokemonSeen);
        for (const id of data.pokemonSeen) {
          seenSet.add(id);
        }
        this.meta.pokemonSeen = Array.from(seenSet);
      }
      // Pokedex: track starter as "used"
      if (data.starter && !this.meta.pokemonUsed.includes(data.starter)) {
        this.meta.pokemonUsed.push(data.starter);
      }
      // Auto-store inventory items from dungeon run
      if (data.inventory && data.inventory.length > 0) {
        for (const stack of data.inventory) {
          addToStorage(this.meta.storage, stack.itemId, stack.count);
        }
      }
      // Track cleared dungeons
      if (data.cleared && data.dungeonId) {
        if (!this.meta.clearedDungeons) this.meta.clearedDungeons = [];
        if (!this.meta.clearedDungeons.includes(data.dungeonId)) {
          this.meta.clearedDungeons.push(data.dungeonId);
        }
      }
      // Track last dungeon for quick re-entry
      if (data.dungeonId) {
        this.meta.lastDungeonId = data.dungeonId;
        this.meta.lastChallenge = data.challengeMode ?? undefined;
      }
      saveMeta(this.meta);
    }
  }

  create() {
    initAudio();
    startBgm("hub");

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a2744);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 100, GAME_WIDTH, 200, 0x2d5a27);

    // Stars
    for (let i = 0; i < 25; i++) {
      const sx = Math.random() * GAME_WIDTH;
      const sy = Math.random() * 160;
      const star = this.add.circle(sx, sy, Math.random() * 2 + 1, 0xffffff, Math.random() * 0.5 + 0.3);
      this.tweens.add({
        targets: star,
        alpha: { from: star.alpha, to: star.alpha * 0.3 },
        duration: 1000 + Math.random() * 2000,
        yoyo: true, repeat: -1,
      });
    }

    // Title
    this.add.text(GAME_WIDTH / 2, 30, "Pokemon Square", {
      fontSize: "16px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    // Gold + Records
    this.add.text(GAME_WIDTH / 2, 55, `Gold: ${this.meta.gold}`, {
      fontSize: "12px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Passive income rate display
    const incomeRate = getIncomeRate(this.meta);
    this.add.text(GAME_WIDTH / 2, 68, `+${incomeRate}G/hr`, {
      fontSize: "9px", color: "#c9a833", fontFamily: "monospace",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 80, `Runs: ${this.meta.totalRuns}  Clears: ${this.meta.totalClears}`, {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5);

    // ── Dungeon Selection ──
    const unlocked = getUnlockedDungeons(this.meta.totalClears);
    const hasSave = hasDungeonSave();
    let y = 105;
    const btnW = 320;

    // Continue saved run (if exists)
    if (hasSave) {
      const save = loadDungeon();
      const saveName = save ? (DUNGEONS[save.dungeonId]?.name ?? save.dungeonId) : "Unknown";
      const saveChallenge = save?.challengeMode ? CHALLENGE_MODES.find(c => c.id === save.challengeMode) : null;
      const challengeTag = saveChallenge ? ` [${saveChallenge.name}]` : "";
      this.createButton(GAME_WIDTH / 2, y, btnW, 42,
        `Continue: ${saveName} B${save?.floor ?? "?"}F${challengeTag}`,
        saveChallenge ? `Resume ${saveChallenge.name} challenge run` : "Resume your saved run",
        saveChallenge ? saveChallenge.color : "#4ade80",
        () => this.continueSave()
      );
      y += 52;
    }

    // Last Dungeon quick access (if player has a last dungeon)
    if (this.meta.lastDungeonId && !hasSave) {
      const lastDungeon = DUNGEONS[this.meta.lastDungeonId];
      if (lastDungeon) {
        const lastChallengeDef = this.meta.lastChallenge
          ? CHALLENGE_MODES.find(c => c.id === this.meta.lastChallenge)
          : null;
        const challengeTag = lastChallengeDef ? ` [${lastChallengeDef.name}]` : "";
        const runCount = (this.meta.dungeonRunCounts ?? {})[this.meta.lastDungeonId] ?? 0;
        this.createButton(GAME_WIDTH / 2, y, btnW, 42,
          `Last Dungeon: ${lastDungeon.name}${challengeTag}`,
          `Quick re-enter  (${runCount} runs)`,
          "#f59e0b",
          () => {
            if (this.meta.lastChallenge) {
              this.enterDungeonWithChallenge(this.meta.lastDungeonId!, this.meta.lastChallenge);
            } else {
              this.enterDungeon(this.meta.lastDungeonId!);
            }
          }
        );
        y += 52;
      }
    }

    // Daily Dungeon button (unlocked after 5 clears)
    if (this.meta.totalClears >= 5) {
      const dailyConfig = getDailyConfig();
      const attempted = hasDailyAttempt(dailyConfig.date);
      const modText = dailyConfig.modifiers.join(", ");
      this.createButton(GAME_WIDTH / 2, y, btnW, 42,
        attempted ? "Daily Done!" : "Daily Dungeon",
        attempted ? "Come back tomorrow!" : `${dailyConfig.floors}F  Diff ${dailyConfig.difficulty.toFixed(1)}  [${modText}]`,
        attempted ? "#444460" : "#10b981",
        attempted ? undefined : () => this.enterDungeon("dailyDungeon")
      );
      y += 52;
    }

    // Endless Dungeon button (unlocked after 10 clears)
    if (this.meta.totalClears >= 10) {
      this.createButton(GAME_WIDTH / 2, y, btnW, 42,
        "Endless Abyss \u221E",
        "Infinite floors. How deep can you go?",
        "#ef4444",
        () => this.enterDungeon("endlessDungeon")
      );
      y += 52;
    }

    // Boss Rush button (unlocked after 30 clears)
    if (this.meta.totalClears >= 30) {
      this.createButton(GAME_WIDTH / 2, y, btnW, 42,
        "Boss Rush",
        "10 boss fights! Survive them all!",
        "#dc2626",
        () => this.enterDungeon("bossRush")
      );
      y += 52;
    }

    // ── Challenge Mode Buttons ──
    const challengeIcons: Record<string, string> = { speedrun: "\u26A1", noItems: "\uD83D\uDEAB", solo: "\uD83D\uDC64" };
    for (const ch of CHALLENGE_MODES) {
      if (this.meta.totalClears >= ch.unlockClears) {
        this.createButton(GAME_WIDTH / 2, y, btnW, 42,
          `${challengeIcons[ch.id] ?? ""} ${ch.name} Challenge`,
          ch.description,
          ch.color,
          () => this.enterChallengeMode(ch.id)
        );
        y += 52;
      }
    }

    // ── Bottom fixed buttons (high depth to stay on top) ──
    const currentStarter = this.meta.starter ?? "mudkip";
    const starterName = currentStarter.charAt(0).toUpperCase() + currentStarter.slice(1);

    const fixedY = GAME_HEIGHT - 268;
    const btnSpacing = 28;
    // Solid background behind fixed buttons — covers from scroll end to bottom
    const fixedBgTop = fixedY - 30;
    const fixedBgH = GAME_HEIGHT - fixedBgTop;
    this.add.rectangle(GAME_WIDTH / 2, fixedBgTop + fixedBgH / 2, GAME_WIDTH, fixedBgH, 0x1a2744).setDepth(50);

    const starterBtnResult = this.createFixedButton(GAME_WIDTH / 2, fixedY, btnW, 28,
      `Starter: ${starterName}`, "Tap to change", "#f472b6",
      () => this.showStarterSelect()
    );
    this.starterLabel = starterBtnResult.titleText;
    this.starterDesc = starterBtnResult.descText;
    this.createFixedButton(GAME_WIDTH / 2, fixedY + btnSpacing, btnW, 28,
      "Upgrade Shop", `Gold: ${this.meta.gold}`, "#fbbf24",
      () => this.scene.start("UpgradeScene")
    );
    const equippedHeldItem = this.meta.equippedHeldItem ? getHeldItem(this.meta.equippedHeldItem) : undefined;
    const heldItemDesc = equippedHeldItem ? equippedHeldItem.name : "None equipped";
    this.createFixedButton(GAME_WIDTH / 2, fixedY + btnSpacing * 2, btnW, 28,
      "Held Items", heldItemDesc, "#f59e0b",
      () => this.scene.start("HeldItemScene")
    );
    this.createFixedButton(GAME_WIDTH / 2, fixedY + btnSpacing * 3, btnW, 28,
      "Move Tutor", "Teach new skills!", "#a855f7",
      () => this.scene.start("MoveTutorScene")
    );
    const starterAbility = SPECIES_ABILITIES[currentStarter] ?? SPECIES_ABILITIES["mudkip"];
    const abilityDef = ABILITIES[starterAbility];
    const abilityLv = getAbilityLevel(this.meta.abilityLevels, starterAbility);
    const abilityDesc = abilityDef ? `${abilityDef.name} Lv.${abilityLv}` : "Enhance ability";
    this.createFixedButton(GAME_WIDTH / 2, fixedY + btnSpacing * 4, btnW, 28,
      "Ability Dojo", abilityDesc, "#667eea",
      () => this.scene.start("AbilityUpgradeScene")
    );
    const storedItemCount = getStorageItemCount(this.meta.storage);
    this.createFixedButton(GAME_WIDTH / 2, fixedY + btnSpacing * 5, btnW, 28,
      "Item Forge", `Stored: ${storedItemCount} items`, "#ff8c42",
      () => this.scene.start("CraftingScene")
    );
    const seenCount = (this.meta.pokemonSeen ?? []).length;
    this.createFixedButton(GAME_WIDTH / 2, fixedY + btnSpacing * 6, btnW, 28,
      "Pokedex", `Seen: ${seenCount} Pokemon`, "#e879f9",
      () => this.scene.start("PokedexScene")
    );
    this.createFixedButton(GAME_WIDTH / 2, fixedY + btnSpacing * 7, btnW, 28,
      "Records", `Clears: ${this.meta.totalClears}  Best: B${this.meta.bestFloor}F`, "#60a5fa",
      () => this.scene.start("AchievementScene")
    );

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 8, "v4.0.0", {
      fontSize: "8px", color: "#444460", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(51);

    // ── NG+ Indicator ──
    const currentNGLevel = getNGPlusLevel(this.meta);
    const ngCanActivate = canActivateNGPlus(this.meta);

    if (ngCanActivate || currentNGLevel > 0) {
      const ngLabel = ngCanActivate
        ? "NG+ Available!"
        : `NG+${currentNGLevel}`;
      const ngColor = ngCanActivate ? "#fbbf24" : "#a855f7";
      const ngIndicator = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20, ngLabel, {
        fontSize: "9px", color: ngColor, fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setDepth(52).setInteractive({ useHandCursor: true });

      if (ngCanActivate) {
        // Glowing pulse animation for available NG+
        this.tweens.add({
          targets: ngIndicator,
          alpha: { from: 1, to: 0.4 },
          duration: 800, yoyo: true, repeat: -1,
        });
      }

      ngIndicator.on("pointerdown", () => this.showNGPlusPanel());
    }

    // Settings button (gear icon)
    const settingsBtn = this.add.text(GAME_WIDTH - 50, GAME_HEIGHT - 8, "[Gear]", {
      fontSize: "10px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(51).setInteractive({ useHandCursor: true });
    settingsBtn.on("pointerdown", () => this.scene.start("SettingsScene"));

    // Help button
    const helpBtn = this.add.text(GAME_WIDTH - 20, GAME_HEIGHT - 8, "[?]", {
      fontSize: "10px", color: "#667eea", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(51).setInteractive({ useHandCursor: true });
    helpBtn.on("pointerdown", () => this.scene.start("HelpScene"));

    // Hall of Fame button
    const hofBtn = this.add.text(20, GAME_HEIGHT - 8, "[Hall of Fame]", {
      fontSize: "8px", color: "#fbbf24", fontFamily: "monospace",
    }).setOrigin(0, 0.5).setDepth(51).setInteractive({ useHandCursor: true });
    hofBtn.on("pointerdown", () => this.scene.start("LeaderboardScene"));

    // ── Scrollable dungeon list with collapsible tiers ──
    const scrollTop = y;
    const scrollBottom = fixedY - 16;
    const scrollH = scrollBottom - scrollTop;

    // Tier definitions: difficulty range → tier info
    const TIER_DEFS: { id: string; name: string; label: string; minDiff: number; maxDiff: number; color: number; textColor: string }[] = [
      { id: "t1",  name: "Beginner",     label: "Tier 1",  minDiff: 0,   maxDiff: 1.09,  color: 0x334455, textColor: "#7a8a9a" },
      { id: "t2",  name: "Novice",        label: "Tier 2",  minDiff: 1.1, maxDiff: 1.69,  color: 0x2a4a3a, textColor: "#88b899" },
      { id: "t3",  name: "Intermediate",  label: "Tier 3",  minDiff: 1.7, maxDiff: 2.09,  color: 0x3a4a2a, textColor: "#a8c888" },
      { id: "t4",  name: "Advanced",      label: "Tier 4",  minDiff: 2.1, maxDiff: 3.09,  color: 0x4a4a2a, textColor: "#c8c888" },
      { id: "t5",  name: "Expert",        label: "Tier 5",  minDiff: 3.1, maxDiff: 4.09,  color: 0x5a3a2a, textColor: "#d8a878" },
      { id: "t6",  name: "Master",        label: "Tier 6",  minDiff: 4.1, maxDiff: 4.59,  color: 0x5a2a3a, textColor: "#d888a8" },
      { id: "t7",  name: "Champion",      label: "Tier 7",  minDiff: 4.6, maxDiff: 5.09,  color: 0x4a2a5a, textColor: "#b888d8" },
      { id: "t8",  name: "Elite",         label: "Tier 8",  minDiff: 5.1, maxDiff: 5.59,  color: 0x3a2a5a, textColor: "#9888d8" },
      { id: "t9",  name: "Legendary",     label: "Tier 9",  minDiff: 5.6, maxDiff: 6.09,  color: 0x2a3a6a, textColor: "#88a8e8" },
      { id: "t10", name: "Mythical",      label: "Tier 10", minDiff: 6.1, maxDiff: 6.59,  color: 0x2a4a6a, textColor: "#88c8e8" },
      { id: "t11", name: "Godlike",       label: "Tier 11", minDiff: 6.6, maxDiff: 7.99,  color: 0x5a2a5a, textColor: "#e888e8" },
      { id: "t12", name: "FINAL",         label: "Tier 12", minDiff: 8.0, maxDiff: 9.99,  color: 0x6a1a1a, textColor: "#f85858" },
      { id: "sp",  name: "Destiny Tower", label: "Special", minDiff: -1,  maxDiff: -1,    color: 0x6a5a1a, textColor: "#ffd700" },
    ];

    // Group dungeons by tier
    const allDungeons = Object.values(DUNGEONS);
    const tierGroups: { tier: typeof TIER_DEFS[0]; dungeons: DungeonDef[] }[] = TIER_DEFS.map(t => ({ tier: t, dungeons: [] }));

    for (const dg of allDungeons) {
      // Special case: Endless Dungeon, Daily Dungeon, and Boss Rush are shown as separate buttons above the tier list
      if (dg.id === "endlessDungeon" || dg.id === "dailyDungeon" || dg.id === "bossRush") continue;
      // Special case: Destiny Tower always goes to the "Special" tier
      if (dg.id === "destinyTower") {
        tierGroups[tierGroups.length - 1].dungeons.push(dg);
        continue;
      }
      for (const tg of tierGroups) {
        if (tg.tier.id === "sp") continue;
        if (dg.difficulty >= tg.tier.minDiff && dg.difficulty <= tg.tier.maxDiff) {
          tg.dungeons.push(dg);
          break;
        }
      }
    }

    // Remove empty tiers
    const activeTiers = tierGroups.filter(tg => tg.dungeons.length > 0);

    // Determine which tier is expanded by default: the highest tier that has at least one unlocked dungeon
    const expandedState: Record<string, boolean> = {};
    let highestUnlockedTierId: string | null = null;
    for (const tg of activeTiers) {
      const hasUnlocked = tg.dungeons.some(d => d.unlockClears <= this.meta.totalClears);
      expandedState[tg.tier.id] = false;
      if (hasUnlocked) highestUnlockedTierId = tg.tier.id;
    }
    if (highestUnlockedTierId) expandedState[highestUnlockedTierId] = true;

    // Container for all dungeon buttons
    const container = this.add.container(0, 0).setDepth(10);

    // Mask for scrollable area
    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillRect(0, scrollTop, GAME_WIDTH, scrollH);
    const geoMask = maskShape.createGeometryMask();
    container.setMask(geoMask);

    // Scroll state
    let scrollOffset = 0;
    let maxScroll = 0;
    let contentH = 0;

    // Scroll indicator
    const indicator = this.add.rectangle(
      GAME_WIDTH - 4, scrollTop, 3, 20, 0x667eea, 0.5
    ).setOrigin(0.5, 0).setDepth(11).setVisible(false);

    // Track the Y position of the highest unlocked tier header for auto-scroll
    let highestUnlockedTierY = 0;

    // Cleared dungeons set for quick lookup
    const clearedSet = new Set(this.meta.clearedDungeons ?? []);

    // Count total clearable dungeons (exclude special modes shown as separate buttons)
    const totalDungeons = Object.values(DUNGEONS).filter(
      d => d.id !== "endlessDungeon" && d.id !== "dailyDungeon" && d.id !== "bossRush"
    ).length;
    const totalCleared = Object.values(DUNGEONS).filter(
      d => d.id !== "endlessDungeon" && d.id !== "dailyDungeon" && d.id !== "bossRush" && clearedSet.has(d.id)
    ).length;

    const renderList = () => {
      // Clear container
      container.removeAll(true);
      let cy = scrollTop;

      // ── Overall Completion Display ──
      const allComplete = totalCleared >= totalDungeons && totalDungeons > 0;
      const completionLabel = allComplete
        ? "ALL DUNGEONS COMPLETE!"
        : `Dungeons Cleared: ${totalCleared} / ${totalDungeons}`;
      const completionColor = allComplete ? "#ffd700" : "#94a3b8";
      const completionText = this.add.text(GAME_WIDTH / 2, cy, completionLabel, {
        fontSize: allComplete ? "10px" : "9px", color: completionColor, fontFamily: "monospace",
        fontStyle: allComplete ? "bold" : "normal",
      }).setOrigin(0.5);
      container.add(completionText);
      cy += 14;

      // Progress bar
      const barW = 200;
      const barH = 6;
      const barX = GAME_WIDTH / 2 - barW / 2;
      const barBg = this.add.rectangle(GAME_WIDTH / 2, cy, barW, barH, 0x222233, 0.9)
        .setStrokeStyle(1, 0x334155);
      container.add(barBg);
      const fillRatio = totalDungeons > 0 ? totalCleared / totalDungeons : 0;
      if (fillRatio > 0) {
        const fillW = Math.max(2, barW * fillRatio);
        const fillColor = allComplete ? 0xffd700 : 0x4ade80;
        const barFill = this.add.rectangle(barX + fillW / 2, cy, fillW, barH - 2, fillColor, 0.9);
        container.add(barFill);
      }
      cy += 14;

      const listHeader = this.add.text(15, cy, "── Dungeons ──", {
        fontSize: "10px", color: "#94a3b8", fontFamily: "monospace",
      });
      container.add(listHeader);
      cy += 18;

      for (const tg of activeTiers) {
        const { tier, dungeons } = tg;
        const isExpanded = expandedState[tier.id];
        const unlockedCount = dungeons.filter(d => d.unlockClears <= this.meta.totalClears).length;
        const allLocked = unlockedCount === 0;
        const arrow = isExpanded ? "\u25BC" : "\u25B6";
        const lockIcon = allLocked ? " \uD83D\uDD12" : "";

        // Tier completion stats
        const tierClearedCount = dungeons.filter(d => clearedSet.has(d.id)).length;
        const tierComplete = tierClearedCount >= dungeons.length && dungeons.length > 0;

        const headerText = `${arrow} ${tier.label}: ${tier.name} (${dungeons.length})${lockIcon}`;

        // Track position for auto-scroll
        if (tier.id === highestUnlockedTierId) {
          highestUnlockedTierY = cy - scrollTop;
        }

        // Tier header background — gold tint when fully completed
        const hdrColor = tierComplete ? 0x4a4a1a : tier.color;
        const hdrStroke = tierComplete ? 0xffd700 : (allLocked ? 0x222233 : 0x556677);
        const hdrBg = this.add.rectangle(GAME_WIDTH / 2, cy, btnW, 28, hdrColor, 0.85)
          .setStrokeStyle(1, hdrStroke);
        container.add(hdrBg);

        // Tier header text
        const hdrText = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 8, cy - 6, headerText, {
          fontSize: "10px", color: allLocked ? "#555566" : tier.textColor,
          fontFamily: "monospace", fontStyle: "bold",
        });
        container.add(hdrText);

        // Tier completion info (right side)
        const tierInfoText = tierComplete
          ? "COMPLETE"
          : `${tierClearedCount}/${dungeons.length} cleared`;
        const tierInfoColor = tierComplete ? "#ffd700" : (allLocked ? "#444455" : "#778899");
        const hdrSub = this.add.text(GAME_WIDTH / 2 + btnW / 2 - 8, cy - 6, tierInfoText, {
          fontSize: "7px", color: tierInfoColor,
          fontFamily: "monospace", fontStyle: tierComplete ? "bold" : "normal",
        }).setOrigin(1, 0);
        container.add(hdrSub);

        // Make header tappable
        hdrBg.setInteractive({ useHandCursor: true });
        const tierId = tier.id;
        hdrBg.on("pointerover", () => hdrBg.setAlpha(1));
        hdrBg.on("pointerout", () => hdrBg.setAlpha(0.85));
        hdrBg.on("pointerdown", () => {
          expandedState[tierId] = !expandedState[tierId];
          const prevScroll = scrollOffset;
          renderList();
          // Restore scroll position (clamped to new max)
          scrollOffset = Math.max(-maxScroll, Math.min(0, prevScroll));
          container.y = scrollOffset;
          updateIndicator();
        });

        cy += 32;

        // Render dungeon items if expanded
        if (isExpanded) {
          for (const dg of dungeons) {
            const isUnlocked = dg.unlockClears <= this.meta.totalClears;
            const isCleared = clearedSet.has(dg.id);
            const color = isUnlocked ? "#e0e0e0" : "#444460";
            const desc = isUnlocked ? dg.description : `Unlock: ${dg.unlockClears} clears needed`;

            const bg = this.add.rectangle(GAME_WIDTH / 2, cy, btnW - 8, 38, 0x1a1a2e, 0.9)
              .setStrokeStyle(1, isUnlocked ? 0x334155 : 0x222233);
            container.add(bg);

            if (isUnlocked) {
              const dgId = dg.id;
              bg.setInteractive({ useHandCursor: true });
              bg.on("pointerover", () => bg.setFillStyle(0x2a2a4e, 1));
              bg.on("pointerout", () => bg.setFillStyle(0x1a1a2e, 0.9));
              bg.on("pointerdown", () => this.enterDungeon(dgId));
            }

            // Dungeon name
            const t1 = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 14, cy - 9, dg.name, {
              fontSize: "11px", color, fontFamily: "monospace", fontStyle: "bold",
            });
            container.add(t1);
            // Subtle green checkmark for cleared dungeons
            if (isCleared) {
              const checkT = this.add.text(GAME_WIDTH / 2 + btnW / 2 - 22, cy - 9, "\u2713", {
                fontSize: "11px", color: "#4ade80", fontFamily: "monospace",
              });
              container.add(checkT);
            }
            const t2 = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 14, cy + 5, desc, {
              fontSize: "8px", color: "#666680", fontFamily: "monospace",
            });
            container.add(t2);
            cy += 44;
          }
        }
      }

      contentH = cy - scrollTop;
      maxScroll = Math.max(0, contentH - scrollH);
      // Update indicator visibility and size
      if (maxScroll > 0) {
        const indicatorH = Math.max(20, (scrollH / contentH) * scrollH);
        indicator.setVisible(true).setSize(3, indicatorH);
      } else {
        indicator.setVisible(false);
      }
    };

    const updateIndicator = () => {
      if (maxScroll <= 0) return;
      const indicatorH = indicator.height;
      const ratio = -scrollOffset / maxScroll;
      indicator.y = scrollTop + ratio * (scrollH - indicatorH);
    };

    // Initial render
    renderList();

    // Auto-scroll to the highest unlocked tier
    if (highestUnlockedTierY > scrollH / 2 && maxScroll > 0) {
      scrollOffset = -Math.min(maxScroll, Math.max(0, highestUnlockedTierY - 10));
      container.y = scrollOffset;
      updateIndicator();
    }

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
      updateIndicator();
    });

    this.time.addEvent({
      delay: 50, loop: true,
      callback: () => updateIndicator(),
    });

    // ── Passive Income: Welcome Back Popup ──
    const passiveResult = calculatePassiveIncome(this.meta);
    if (passiveResult.gold > 0) {
      this.showPassiveIncomePopup(passiveResult.gold, passiveResult.hours, getIncomeRate(this.meta));
    }

    // Update last visit timestamp (always, even on first visit)
    updateLastVisit(this.meta);
  }

  private createButton(
    x: number, y: number, w: number, h: number,
    title: string, desc: string, color: string,
    callback?: () => void
  ) {
    const bg = this.add.rectangle(x, y, w, h, 0x1a1a2e, 0.9)
      .setStrokeStyle(1, callback ? 0x334155 : 0x222233);
    if (callback) {
      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerover", () => bg.setFillStyle(0x2a2a4e, 1));
      bg.on("pointerout", () => bg.setFillStyle(0x1a1a2e, 0.9));
      bg.on("pointerdown", callback);
    }

    this.add.text(x - w / 2 + 12, y - 10, title, {
      fontSize: "12px", color, fontFamily: "monospace", fontStyle: "bold",
    });
    this.add.text(x - w / 2 + 12, y + 5, desc, {
      fontSize: "9px", color: "#666680", fontFamily: "monospace",
    });
  }

  private createFixedButton(
    x: number, y: number, w: number, h: number,
    title: string, desc: string, color: string,
    callback?: () => void
  ): { titleText: Phaser.GameObjects.Text; descText: Phaser.GameObjects.Text } {
    const bg = this.add.rectangle(x, y, w, h, 0x1a1a2e, 0.9)
      .setStrokeStyle(1, callback ? 0x334155 : 0x222233)
      .setDepth(51);
    if (callback) {
      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerover", () => bg.setFillStyle(0x2a2a4e, 1));
      bg.on("pointerout", () => bg.setFillStyle(0x1a1a2e, 0.9));
      bg.on("pointerdown", callback);
    }

    const titleText = this.add.text(x - w / 2 + 12, y - 8, title, {
      fontSize: "11px", color, fontFamily: "monospace", fontStyle: "bold",
    }).setDepth(52);
    const descText = this.add.text(x - w / 2 + 12, y + 5, desc, {
      fontSize: "8px", color: "#666680", fontFamily: "monospace",
    }).setDepth(52);
    return { titleText, descText };
  }

  private enterDungeon(dungeonId: string) {
    this.scene.start("DungeonPreviewScene", {
      dungeonId,
      meta: this.meta,
    });
  }

  private enterChallengeMode(challengeId: string) {
    // Pick a random unlocked dungeon (excluding endless and destiny tower)
    const unlocked = getUnlockedDungeons(this.meta.totalClears)
      .filter(d => d.id !== "endlessDungeon" && d.id !== "destinyTower" && d.id !== "dailyDungeon" && d.id !== "bossRush");
    if (unlocked.length === 0) return;
    const pick = unlocked[Math.floor(Math.random() * unlocked.length)];
    this.enterDungeonWithChallenge(pick.id, challengeId);
  }

  private enterDungeonWithChallenge(dungeonId: string, challengeMode: string) {
    this.scene.start("DungeonPreviewScene", {
      dungeonId,
      meta: this.meta,
      challengeMode,
    });
  }

  private continueSave() {
    const save = loadDungeon();
    if (!save) {
      clearDungeonSave();
      return;
    }

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(450, () => {
      this.scene.start("DungeonScene", {
        floor: save.floor,
        hp: save.hp,
        maxHp: save.maxHp,
        level: save.level,
        atk: save.atk,
        def: save.def,
        exp: save.totalExp,
        skills: deserializeSkills(save.skills),
        inventory: deserializeInventory(save.inventory),
        fromHub: true,
        dungeonId: save.dungeonId,
        starter: save.starter ?? this.meta.starter ?? "mudkip",
        challengeMode: save.challengeMode,
        modifiers: save.modifiers,
      });
    });
  }

  private showNotice(msg: string) {
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7
    ).setDepth(200).setInteractive();

    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, msg, {
      fontSize: "12px", color: "#e0e0e0", fontFamily: "monospace", align: "center",
    }).setOrigin(0.5).setDepth(201);

    const close = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50, "[Close]", {
      fontSize: "14px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(201).setInteractive();

    const cleanup = () => { overlay.destroy(); text.destroy(); close.destroy(); };
    close.on("pointerdown", cleanup);
    overlay.on("pointerdown", cleanup);
  }

  private showPassiveIncomePopup(gold: number, hours: number, rate: number) {
    const uiItems: Phaser.GameObjects.GameObject[] = [];

    // Semi-transparent overlay (non-blocking — tap to dismiss)
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6
    ).setDepth(300).setInteractive();
    uiItems.push(overlay);

    // Popup panel background
    const panelW = 260;
    const panelH = 140;
    const panelX = GAME_WIDTH / 2;
    const panelY = GAME_HEIGHT / 2 - 40;
    const panel = this.add.rectangle(panelX, panelY, panelW, panelH, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xfbbf24).setDepth(301);
    uiItems.push(panel);

    // Title
    const titleText = this.add.text(panelX, panelY - 50, "Welcome back!", {
      fontSize: "14px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(302);
    uiItems.push(titleText);

    // Hours info
    const hoursText = this.add.text(panelX, panelY - 28,
      `Away for ${hours} hour${hours !== 1 ? "s" : ""}`, {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(302);
    uiItems.push(hoursText);

    // Gold amount (animated counting up)
    const goldDisplay = this.add.text(panelX, panelY, "0 Gold", {
      fontSize: "16px", color: "#fde68a", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(302);
    uiItems.push(goldDisplay);

    // Animate the gold counter
    const countDuration = Math.min(1500, gold * 20);
    this.tweens.addCounter({
      from: 0,
      to: gold,
      duration: Math.max(300, countDuration),
      ease: "Cubic.easeOut",
      onUpdate: (tween) => {
        const val = Math.floor(tween.getValue() ?? 0);
        goldDisplay.setText(`+${val} Gold`);
      },
      onComplete: () => {
        goldDisplay.setText(`+${gold} Gold`);
      },
    });

    // Rate info
    const rateText = this.add.text(panelX, panelY + 25,
      `Income rate: ${rate}G/hr`, {
      fontSize: "9px", color: "#c9a833", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(302);
    uiItems.push(rateText);

    // Collect button
    const collectBtn = this.add.text(panelX, panelY + 52, "[ Collect ]", {
      fontSize: "13px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(302).setInteractive({ useHandCursor: true });
    uiItems.push(collectBtn);

    let collected = false;
    const collect = () => {
      if (collected) return;
      collected = true;
      this.meta.gold += gold;
      this.meta.totalGold += gold;
      saveMeta(this.meta);
      uiItems.forEach(o => o.destroy());
    };

    collectBtn.on("pointerdown", collect);
    overlay.on("pointerdown", collect);

    // Auto-dismiss after 5 seconds
    this.time.delayedCall(5000, () => {
      if (!collected) collect();
    });
  }

  private showNGPlusPanel() {
    const uiItems: Phaser.GameObjects.GameObject[] = [];
    const currentLevel = getNGPlusLevel(this.meta);
    const ngCanActivate = canActivateNGPlus(this.meta);

    const overlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85
    ).setDepth(200).setInteractive();
    uiItems.push(overlay);

    // Title
    const title = this.add.text(GAME_WIDTH / 2, 30, "-- New Game Plus --", {
      fontSize: "14px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(201);
    uiItems.push(title);

    // Current NG+ level
    const levelLabel = currentLevel > 0
      ? `Current: NG+${currentLevel}`
      : "Not yet activated";
    const levelText = this.add.text(GAME_WIDTH / 2, 52, levelLabel, {
      fontSize: "11px", color: "#e0e0e0", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(201);
    uiItems.push(levelText);

    let cy = 75;

    // Current bonuses
    if (currentLevel > 0) {
      const bonusHeader = this.add.text(GAME_WIDTH / 2, cy, "Active Bonuses:", {
        fontSize: "10px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setDepth(201);
      uiItems.push(bonusHeader);
      cy += 16;

      const bonuses = getCurrentBonuses(currentLevel);
      for (const b of bonuses) {
        const bText = this.add.text(GAME_WIDTH / 2, cy, b.description, {
          fontSize: "8px", color: "#a5f3a3", fontFamily: "monospace",
        }).setOrigin(0.5).setDepth(201);
        uiItems.push(bText);
        cy += 13;
      }
      cy += 8;
    }

    // Next level preview
    const nextReq = getNextNGPlusRequirement(currentLevel);
    if (nextReq) {
      const nextHeader = this.add.text(GAME_WIDTH / 2, cy, `Next: NG+${currentLevel + 1} (${nextReq.clears} clears)`, {
        fontSize: "10px", color: "#fde68a", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setDepth(201);
      uiItems.push(nextHeader);
      cy += 16;

      const progress = `Progress: ${this.meta.totalClears}/${nextReq.clears} clears`;
      const progText = this.add.text(GAME_WIDTH / 2, cy, progress, {
        fontSize: "9px", color: this.meta.totalClears >= nextReq.clears ? "#4ade80" : "#94a3b8",
        fontFamily: "monospace",
      }).setOrigin(0.5).setDepth(201);
      uiItems.push(progText);
      cy += 16;

      const newLabel = this.add.text(GAME_WIDTH / 2, cy, "New bonuses:", {
        fontSize: "9px", color: "#fde68a", fontFamily: "monospace",
      }).setOrigin(0.5).setDepth(201);
      uiItems.push(newLabel);
      cy += 14;

      for (const b of nextReq.bonuses) {
        const bText = this.add.text(GAME_WIDTH / 2, cy, b.description, {
          fontSize: "8px", color: "#fef3c7", fontFamily: "monospace",
        }).setOrigin(0.5).setDepth(201);
        uiItems.push(bText);
        cy += 13;
      }
      cy += 12;
    } else {
      const maxText = this.add.text(GAME_WIDTH / 2, cy, "Maximum NG+ level reached!", {
        fontSize: "10px", color: "#a855f7", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setDepth(201);
      uiItems.push(maxText);
      cy += 20;
    }

    const cleanup = () => { uiItems.forEach(o => o.destroy()); };

    // Activate button (if available)
    if (ngCanActivate) {
      const activateBtn = this.add.text(GAME_WIDTH / 2 - 60, cy, "[Activate NG+]", {
        fontSize: "13px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setDepth(201).setInteractive({ useHandCursor: true });
      uiItems.push(activateBtn);

      activateBtn.on("pointerdown", () => {
        activateNGPlus(this.meta);
        cleanup();
        // Restart scene to reflect new NG+ level
        this.scene.restart();
      });

      const laterBtn = this.add.text(GAME_WIDTH / 2 + 60, cy, "[Later]", {
        fontSize: "13px", color: "#60a5fa", fontFamily: "monospace",
      }).setOrigin(0.5).setDepth(201).setInteractive({ useHandCursor: true });
      uiItems.push(laterBtn);
      laterBtn.on("pointerdown", cleanup);
    } else {
      const closeBtn = this.add.text(GAME_WIDTH / 2, cy, "[Close]", {
        fontSize: "13px", color: "#60a5fa", fontFamily: "monospace",
      }).setOrigin(0.5).setDepth(201).setInteractive({ useHandCursor: true });
      uiItems.push(closeBtn);
      closeBtn.on("pointerdown", cleanup);
    }
  }

  private showStarterSelect() {
    const uiItems: Phaser.GameObjects.GameObject[] = [];
    let starterSelectActive = true;

    const overlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85
    ).setDepth(200).setInteractive();
    uiItems.push(overlay);

    const title = this.add.text(GAME_WIDTH / 2, 30, "── Choose Starter ──", {
      fontSize: "14px", color: "#f472b6", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(201);
    uiItems.push(title);

    // Starter options
    const starters = this.getStarterList();
    const current = this.meta.starter ?? "mudkip";

    // Virtual scroll configuration
    const ITEM_H = 36;
    const VISIBLE_TOP = 50;
    const VISIBLE_BOTTOM = GAME_HEIGHT - 50;
    const VISIBLE_H = VISIBLE_BOTTOM - VISIBLE_TOP;
    const POOL_SIZE = Math.ceil(VISIBLE_H / ITEM_H) + 2; // enough to fill screen + buffer
    const TOTAL_H = starters.length * ITEM_H + 40; // +40 for close button
    const MAX_SCROLL = Math.max(0, TOTAL_H - VISIBLE_H);

    // Mask for scroll area
    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillRect(0, VISIBLE_TOP, GAME_WIDTH, VISIBLE_H);
    uiItems.push(maskShape as unknown as Phaser.GameObjects.GameObject);
    const mask = maskShape.createGeometryMask();

    // Create object pool (only POOL_SIZE rows, not 164!)
    const pool: { bg: Phaser.GameObjects.Rectangle; nameT: Phaser.GameObjects.Text; descT: Phaser.GameObjects.Text; idx: number }[] = [];
    const poolContainer = this.add.container(0, 0).setDepth(202).setMask(mask);
    uiItems.push(poolContainer);

    for (let i = 0; i < POOL_SIZE; i++) {
      const bg = this.add.rectangle(GAME_WIDTH / 2, 0, 300, 30, 0x1a1a2e, 0.95)
        .setStrokeStyle(1, 0x334155);
      const nameT = this.add.text(GAME_WIDTH / 2 - 130, 0, "", {
        fontSize: "11px", color: "#e0e0e0", fontFamily: "monospace", fontStyle: "bold",
      });
      const descT = this.add.text(GAME_WIDTH / 2 - 130, 0, "", {
        fontSize: "7px", color: "#666680", fontFamily: "monospace",
      });
      poolContainer.add([bg, nameT, descT]);
      bg.setInteractive({ useHandCursor: true });
      pool.push({ bg, nameT, descT, idx: -1 });
    }

    // Close button
    const closeBtn = this.add.text(GAME_WIDTH / 2, 0, "[Close]", {
      fontSize: "13px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setInteractive().setDepth(202);
    poolContainer.add(closeBtn);

    let scrollOffset = 0;

    // Find current starter and scroll to it
    const currentIdx = starters.findIndex(s => s.id === current);
    if (currentIdx > 5) {
      scrollOffset = Math.min(MAX_SCROLL, (currentIdx - 3) * ITEM_H);
    }

    const cleanup = () => {
      if (!starterSelectActive) return;
      starterSelectActive = false;
      // Remove our specific pointermove listener
      this.input.off("pointermove", scrollHandler);
      uiItems.forEach(o => o.destroy());
    };

    const bindRow = (row: typeof pool[0], dataIdx: number, yPos: number) => {
      row.idx = dataIdx;
      row.bg.setY(yPos);
      row.nameT.setY(yPos - 7);
      row.descT.setY(yPos + 5);

      if (dataIdx < 0 || dataIdx >= starters.length) {
        row.bg.setVisible(false);
        row.nameT.setVisible(false);
        row.descT.setVisible(false);
        return;
      }

      const s = starters[dataIdx];
      const isUnlocked = this.meta.totalClears >= s.unlock;
      const isCurrent = s.id === (this.meta.starter ?? "mudkip");
      const color = isCurrent ? "#fbbf24" : isUnlocked ? "#e0e0e0" : "#444460";

      row.bg.setVisible(true).setFillStyle(0x1a1a2e, 0.95)
        .setStrokeStyle(1, isCurrent ? 0xfbbf24 : isUnlocked ? 0x334155 : 0x222233);
      row.nameT.setVisible(true).setText(isCurrent ? `★ ${s.name}` : s.name).setColor(color);
      row.descT.setVisible(true).setText(
        isUnlocked ? (isCurrent ? "Currently selected" : "Tap to select")
          : `Need ${s.unlock} clears (have ${this.meta.totalClears})`
      );

      row.bg.removeAllListeners("pointerdown");
      row.bg.removeAllListeners("pointerover");
      row.bg.removeAllListeners("pointerout");

      if (isUnlocked && !isCurrent) {
        row.bg.on("pointerover", () => row.bg.setFillStyle(0x2a2a4e, 1));
        row.bg.on("pointerout", () => row.bg.setFillStyle(0x1a1a2e, 0.95));
        row.bg.on("pointerdown", () => {
          this.meta.starter = s.id;
          saveMeta(this.meta);
          // Update hub starter label without scene restart
          const name = s.name.charAt(0).toUpperCase() + s.name.slice(1);
          if (this.starterLabel) this.starterLabel.setText(`Starter: ${name}`);
          // Refresh visible rows to show new selection
          renderVisible();
        });
      }
    };

    const renderVisible = () => {
      const startIdx = Math.floor(scrollOffset / ITEM_H);
      for (let i = 0; i < POOL_SIZE; i++) {
        const dataIdx = startIdx + i;
        const yPos = VISIBLE_TOP + 10 + dataIdx * ITEM_H - scrollOffset;
        bindRow(pool[i], dataIdx, yPos);
      }
      // Position close button after last item
      const closeBtnY = VISIBLE_TOP + 10 + starters.length * ITEM_H - scrollOffset + 10;
      closeBtn.setY(closeBtnY);
    };

    renderVisible();
    closeBtn.on("pointerdown", cleanup);

    // Scroll handling
    let dragStartY = 0;
    let isDragging = false;

    overlay.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      dragStartY = ptr.y;
      isDragging = true;
    });

    // Use named function for clean removal
    const scrollHandler = (ptr: Phaser.Input.Pointer) => {
      if (!starterSelectActive || !ptr.isDown || !isDragging) return;
      const dy = ptr.y - dragStartY;
      dragStartY = ptr.y;
      scrollOffset = Math.max(0, Math.min(MAX_SCROLL, scrollOffset - dy));
      renderVisible();
    };
    this.input.on("pointermove", scrollHandler);

    this.input.on("pointerup", () => { isDragging = false; });
  }

  private getStarterList(): { id: string; name: string; unlock: number }[] {
    return STARTER_LIST;
  }
}
