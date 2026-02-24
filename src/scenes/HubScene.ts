import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import {
  loadMeta, saveMeta, loadDungeon, clearDungeonSave,
  hasDungeonSave, deserializeSkills, deserializeInventory,
  MetaSaveData,
} from "../core/save-system";
import { DUNGEONS, DungeonDef, getUnlockedDungeons, CHALLENGE_MODES } from "../core/dungeon-data";
import { initAudio, startBgm, stopBgm } from "../core/sound-manager";

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
    this.add.text(GAME_WIDTH / 2, 72, `Runs: ${this.meta.totalRuns}  Clears: ${this.meta.totalClears}`, {
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

    const fixedY = GAME_HEIGHT - 152;
    // Solid background behind fixed buttons — covers from scroll end to bottom
    const fixedBgTop = fixedY - 30;
    const fixedBgH = GAME_HEIGHT - fixedBgTop;
    this.add.rectangle(GAME_WIDTH / 2, fixedBgTop + fixedBgH / 2, GAME_WIDTH, fixedBgH, 0x1a2744).setDepth(50);

    const starterBtnResult = this.createFixedButton(GAME_WIDTH / 2, fixedY, btnW, 30,
      `Starter: ${starterName}`, "Tap to change", "#f472b6",
      () => this.showStarterSelect()
    );
    this.starterLabel = starterBtnResult.titleText;
    this.starterDesc = starterBtnResult.descText;
    this.createFixedButton(GAME_WIDTH / 2, fixedY + 34, btnW, 30,
      "Upgrade Shop", `Gold: ${this.meta.gold}`, "#fbbf24",
      () => this.scene.start("UpgradeScene")
    );
    const seenCount = (this.meta.pokemonSeen ?? []).length;
    this.createFixedButton(GAME_WIDTH / 2, fixedY + 68, btnW, 30,
      "Pokedex", `Seen: ${seenCount} Pokemon`, "#e879f9",
      () => this.scene.start("PokedexScene")
    );
    this.createFixedButton(GAME_WIDTH / 2, fixedY + 102, btnW, 30,
      "Records", `Clears: ${this.meta.totalClears}  Best: B${this.meta.bestFloor}F`, "#60a5fa",
      () => this.scene.start("AchievementScene")
    );

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 8, "v2.0.0", {
      fontSize: "8px", color: "#444460", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(51);

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
      // Special case: Endless Dungeon is shown as a separate button above the tier list
      if (dg.id === "endlessDungeon") continue;
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

    const renderList = () => {
      // Clear container
      container.removeAll(true);
      let cy = scrollTop;

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
        const headerText = `${arrow} ${tier.label}: ${tier.name} (${dungeons.length})${lockIcon}`;

        // Track position for auto-scroll
        if (tier.id === highestUnlockedTierId) {
          highestUnlockedTierY = cy - scrollTop;
        }

        // Tier header background
        const hdrBg = this.add.rectangle(GAME_WIDTH / 2, cy, btnW, 28, tier.color, 0.85)
          .setStrokeStyle(1, allLocked ? 0x222233 : 0x556677);
        container.add(hdrBg);

        // Tier header text
        const hdrText = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 8, cy - 6, headerText, {
          fontSize: "10px", color: allLocked ? "#555566" : tier.textColor,
          fontFamily: "monospace", fontStyle: "bold",
        });
        container.add(hdrText);

        // Unlocked count subtitle
        const hdrSub = this.add.text(GAME_WIDTH / 2 + btnW / 2 - 8, cy - 6,
          `${unlockedCount}/${dungeons.length} unlocked`, {
          fontSize: "7px", color: allLocked ? "#444455" : "#778899",
          fontFamily: "monospace",
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

            const t1 = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 14, cy - 9, dg.name, {
              fontSize: "11px", color, fontFamily: "monospace", fontStyle: "bold",
            });
            const t2 = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 14, cy + 5, desc, {
              fontSize: "8px", color: "#666680", fontFamily: "monospace",
            });
            container.add([t1, t2]);
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
    stopBgm();
    clearDungeonSave();
    this.meta.totalRuns++;
    saveMeta(this.meta);

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(450, () => {
      this.scene.start("DungeonScene", {
        floor: 1, fromHub: true, dungeonId,
        starter: this.meta.starter ?? "mudkip",
      });
    });
  }

  private enterChallengeMode(challengeId: string) {
    // Pick a random unlocked dungeon (excluding endless and destiny tower)
    const unlocked = getUnlockedDungeons(this.meta.totalClears)
      .filter(d => d.id !== "endlessDungeon" && d.id !== "destinyTower");
    if (unlocked.length === 0) return;
    const pick = unlocked[Math.floor(Math.random() * unlocked.length)];
    this.enterDungeonWithChallenge(pick.id, challengeId);
  }

  private enterDungeonWithChallenge(dungeonId: string, challengeMode: string) {
    stopBgm();
    clearDungeonSave();
    this.meta.totalRuns++;
    saveMeta(this.meta);

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(450, () => {
      this.scene.start("DungeonScene", {
        floor: 1, fromHub: true, dungeonId,
        starter: this.meta.starter ?? "mudkip",
        challengeMode,
      });
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
    return [
      { id: "mudkip", name: "Mudkip", unlock: 0 },
      { id: "pikachu", name: "Pikachu", unlock: 1 },
      { id: "caterpie", name: "Caterpie", unlock: 0 },
      { id: "geodude", name: "Geodude", unlock: 2 },
      { id: "machop", name: "Machop", unlock: 3 },
      { id: "magnemite", name: "Magnemite", unlock: 4 },
      { id: "gastly", name: "Gastly", unlock: 5 },
      { id: "snorunt", name: "Snorunt", unlock: 6 },
      { id: "charmander", name: "Charmander", unlock: 2 },
      { id: "eevee", name: "Eevee", unlock: 4 },
      { id: "chikorita", name: "Chikorita", unlock: 6 },
      { id: "bellsprout", name: "Bellsprout", unlock: 8 },
      { id: "shroomish", name: "Shroomish", unlock: 9 },
      { id: "dratini", name: "Dratini", unlock: 10 },
      { id: "ralts", name: "Ralts", unlock: 11 },
      { id: "poochyena", name: "Poochyena", unlock: 7 },
      { id: "beldum", name: "Beldum", unlock: 12 },
      { id: "sandshrew", name: "Sandshrew", unlock: 13 },
      { id: "trapinch", name: "Trapinch", unlock: 14 },
      { id: "skarmory", name: "Skarmory", unlock: 15 },
      { id: "houndour", name: "Houndour", unlock: 16 },
      { id: "sneasel", name: "Sneasel", unlock: 17 },
      { id: "riolu", name: "Riolu", unlock: 18 },
      { id: "larvitar", name: "Larvitar", unlock: 19 },
      { id: "taillow", name: "Taillow", unlock: 8 },
      { id: "starly", name: "Starly", unlock: 5 },
      { id: "oddish", name: "Oddish", unlock: 4 },
      { id: "budew", name: "Budew", unlock: 6 },
      { id: "vulpix", name: "Vulpix", unlock: 7 },
      { id: "ponyta", name: "Ponyta", unlock: 10 },
      { id: "staryu", name: "Staryu", unlock: 8 },
      { id: "clamperl", name: "Clamperl", unlock: 9 },
      { id: "shinx", name: "Shinx", unlock: 6 },
      { id: "electrike", name: "Electrike", unlock: 8 },
      { id: "gulpin", name: "Gulpin", unlock: 10 },
      { id: "ekans", name: "Ekans", unlock: 11 },
      { id: "cubone", name: "Cubone", unlock: 12 },
      { id: "diglett", name: "Diglett", unlock: 9 },
      { id: "paras", name: "Paras", unlock: 5 },
      { id: "venonat", name: "Venonat", unlock: 7 },
      { id: "shieldon", name: "Shieldon", unlock: 13 },
      { id: "bronzor", name: "Bronzor", unlock: 14 },
      { id: "misdreavus", name: "Misdreavus", unlock: 11 },
      { id: "duskull", name: "Duskull", unlock: 13 },
      { id: "axew", name: "Axew", unlock: 12 },
      { id: "deino", name: "Deino", unlock: 14 },
      { id: "snubbull", name: "Snubbull", unlock: 9 },
      { id: "togepi", name: "Togepi", unlock: 7 },
      { id: "snover", name: "Snover", unlock: 10 },
      { id: "bergmite", name: "Bergmite", unlock: 11 },
      { id: "spoink", name: "Spoink", unlock: 9 },
      { id: "stunky", name: "Stunky", unlock: 10 },
      { id: "purrloin", name: "Purrloin", unlock: 11 },
      { id: "pidove", name: "Pidove", unlock: 8 },
      { id: "rufflet", name: "Rufflet", unlock: 12 },
      { id: "tyrogue", name: "Tyrogue", unlock: 10 },
      { id: "crabrawler", name: "Crabrawler", unlock: 11 },
      { id: "roggenrola", name: "Roggenrola", unlock: 12 },
      { id: "rockruff", name: "Rockruff", unlock: 10 },
      { id: "lillipup", name: "Lillipup", unlock: 7 },
      { id: "minccino", name: "Minccino", unlock: 8 },
      { id: "foongus", name: "Foongus", unlock: 12 },
      { id: "petilil", name: "Petilil", unlock: 10 },
      { id: "feebas", name: "Feebas", unlock: 11 },
      { id: "wailmer", name: "Wailmer", unlock: 12 },
      { id: "litwick", name: "Litwick", unlock: 13 },
      { id: "growlithe", name: "Growlithe", unlock: 10 },
      { id: "joltik", name: "Joltik", unlock: 12 },
      { id: "tynamo", name: "Tynamo", unlock: 11 },
      { id: "trubbish", name: "Trubbish", unlock: 11 },
      { id: "skorupi", name: "Skorupi", unlock: 12 },
      { id: "mudbray", name: "Mudbray", unlock: 13 },
      { id: "hippopotas", name: "Hippopotas", unlock: 12 },
      { id: "dwebble", name: "Dwebble", unlock: 13 },
      { id: "binacle", name: "Binacle", unlock: 12 },
      { id: "nincada", name: "Nincada", unlock: 11 },
      { id: "venipede", name: "Venipede", unlock: 12 },
      { id: "mienfoo", name: "Mienfoo", unlock: 13 },
      { id: "timburr", name: "Timburr", unlock: 11 },
      { id: "klink", name: "Klink", unlock: 13 },
      { id: "ferroseed", name: "Ferroseed", unlock: 14 },
      { id: "phantump", name: "Phantump", unlock: 12 },
      { id: "honedge", name: "Honedge", unlock: 13 },
      { id: "solosis", name: "Solosis", unlock: 12 },
      { id: "elgyem", name: "Elgyem", unlock: 13 },
      { id: "cryogonal", name: "Cryogonal", unlock: 14 },
      { id: "cubchoo", name: "Cubchoo", unlock: 13 },
      { id: "sandile", name: "Sandile", unlock: 12 },
      { id: "inkay", name: "Inkay", unlock: 13 },
      { id: "spritzee", name: "Spritzee", unlock: 14 },
      { id: "swirlix", name: "Swirlix", unlock: 12 },
      { id: "goomy", name: "Goomy", unlock: 14 },
      { id: "jangmoo", name: "Jangmo-o", unlock: 13 },
      { id: "noibat", name: "Noibat", unlock: 12 },
      { id: "vullaby", name: "Vullaby", unlock: 13 },
      { id: "stufful", name: "Stufful", unlock: 14 },
      { id: "furfrou", name: "Furfrou", unlock: 12 },
      { id: "wimpod", name: "Wimpod", unlock: 15 },
      { id: "tympole", name: "Tympole", unlock: 14 },
      { id: "salandit", name: "Salandit", unlock: 15 },
      { id: "larvesta", name: "Larvesta", unlock: 14 },
      { id: "fomantis", name: "Fomantis", unlock: 13 },
      { id: "morelull", name: "Morelull", unlock: 14 },
      { id: "charjabug", name: "Charjabug", unlock: 15 },
      { id: "helioptile", name: "Helioptile", unlock: 14 },
      { id: "mareanie", name: "Mareanie", unlock: 15 },
      { id: "croagunk", name: "Croagunk", unlock: 14 },
      { id: "sandygast", name: "Sandygast", unlock: 15 },
      { id: "silicobra", name: "Silicobra", unlock: 14 },
      { id: "carbink", name: "Carbink", unlock: 15 },
      { id: "minior", name: "Minior", unlock: 14 },
      { id: "dewpider", name: "Dewpider", unlock: 13 },
      { id: "sizzlipede", name: "Sizzlipede", unlock: 14 },
      { id: "pancham", name: "Pancham", unlock: 15 },
      { id: "hawlucha", name: "Hawlucha", unlock: 14 },
      { id: "durant", name: "Durant", unlock: 16 },
      { id: "togedemaru", name: "Togedemaru", unlock: 15 },
      { id: "drifloon", name: "Drifloon", unlock: 14 },
      { id: "golett", name: "Golett", unlock: 15 },
      { id: "hatenna", name: "Hatenna", unlock: 16 },
      { id: "indeedee", name: "Indeedee", unlock: 15 },
      { id: "vanillite", name: "Vanillite", unlock: 16 },
      { id: "snom", name: "Snom", unlock: 15 },
      { id: "nickit", name: "Nickit", unlock: 14 },
      { id: "impidimp", name: "Impidimp", unlock: 15 },
      { id: "milcery", name: "Milcery", unlock: 16 },
      { id: "comfey", name: "Comfey", unlock: 15 },
      { id: "turtonator", name: "Turtonator", unlock: 16 },
      { id: "drampa", name: "Drampa", unlock: 15 },
      { id: "rookidee", name: "Rookidee", unlock: 14 },
      { id: "archen", name: "Archen", unlock: 15 },
      { id: "wooloo", name: "Wooloo", unlock: 14 },
      { id: "skwovet", name: "Skwovet", unlock: 15 },
      { id: "bruxish", name: "Bruxish", unlock: 17 },
      { id: "chewtle", name: "Chewtle", unlock: 16 },
      { id: "litleo", name: "Litleo", unlock: 15 },
      { id: "torchic", name: "Torchic", unlock: 16 },
      { id: "gossifleur", name: "Gossifleur", unlock: 17 },
      { id: "bounsweet", name: "Bounsweet", unlock: 16 },
      { id: "yamper", name: "Yamper", unlock: 17 },
      { id: "pincurchin", name: "Pincurchin", unlock: 16 },
      { id: "skrelp", name: "Skrelp", unlock: 15 },
      { id: "toxel", name: "Toxel", unlock: 16 },
      { id: "drilbur", name: "Drilbur", unlock: 17 },
      { id: "barboach", name: "Barboach", unlock: 16 },
      { id: "nacli", name: "Nacli", unlock: 17 },
      { id: "tyrunt", name: "Tyrunt", unlock: 16 },
      { id: "blipbug", name: "Blipbug", unlock: 15 },
      { id: "cutiefly", name: "Cutiefly", unlock: 16 },
      { id: "clobbopus", name: "Clobbopus", unlock: 17 },
      { id: "passimian", name: "Passimian", unlock: 16 },
      { id: "tinkatink", name: "Tinkatink", unlock: 17 },
      { id: "varoom", name: "Varoom", unlock: 16 },
      { id: "greavard", name: "Greavard", unlock: 15 },
      { id: "sinistea", name: "Sinistea", unlock: 16 },
      { id: "flittle", name: "Flittle", unlock: 17 },
      { id: "espurr", name: "Espurr", unlock: 16 },
      { id: "cetoddle", name: "Cetoddle", unlock: 17 },
      { id: "frigibax", name: "Frigibax", unlock: 16 },
      { id: "zorua", name: "Zorua", unlock: 15 },
      { id: "pawniard", name: "Pawniard", unlock: 16 },
      { id: "fidough", name: "Fidough", unlock: 17 },
      { id: "dedenne", name: "Dedenne", unlock: 16 },
      { id: "cyclizar", name: "Cyclizar", unlock: 17 },
      { id: "tatsugiri", name: "Tatsugiri", unlock: 16 },
      { id: "wingull", name: "Wingull", unlock: 15 },
      { id: "swablu", name: "Swablu", unlock: 16 },
      { id: "lechonk", name: "Lechonk", unlock: 15 },
      { id: "tandemaus", name: "Tandemaus", unlock: 16 },
      { id: "buizel", name: "Buizel", unlock: 18 },
      { id: "finizen", name: "Finizen", unlock: 17 },
      { id: "fletchinder", name: "Fletchinder", unlock: 18 },
      { id: "heatmor", name: "Heatmor", unlock: 17 },
      { id: "smoliv", name: "Smoliv", unlock: 16 },
      { id: "deerling", name: "Deerling", unlock: 17 },
      { id: "pachirisu", name: "Pachirisu", unlock: 18 },
      { id: "emolga", name: "Emolga", unlock: 17 },
      { id: "glimmet", name: "Glimmet", unlock: 18 },
      { id: "koffing", name: "Koffing", unlock: 17 },
      { id: "wooper", name: "Wooper", unlock: 16 },
      { id: "baltoy", name: "Baltoy", unlock: 17 },
      { id: "anorith", name: "Anorith", unlock: 18 },
      { id: "lunatone", name: "Lunatone", unlock: 17 },
      { id: "surskit", name: "Surskit", unlock: 16 },
      { id: "volbeat", name: "Volbeat", unlock: 17 },
      { id: "scraggy", name: "Scraggy", unlock: 18 },
      { id: "mankey", name: "Mankey", unlock: 17 },
      { id: "klefki", name: "Klefki", unlock: 18 },
      { id: "mawile", name: "Mawile", unlock: 17 },
      { id: "rotom", name: "Rotom", unlock: 18 },
      { id: "dreepy", name: "Dreepy", unlock: 17 },
      { id: "munna", name: "Munna", unlock: 16 },
      { id: "chingling", name: "Chingling", unlock: 17 },
      { id: "smoochum", name: "Smoochum", unlock: 18 },
      { id: "delibird", name: "Delibird", unlock: 17 },
      { id: "nuzleaf", name: "Nuzleaf", unlock: 16 },
      { id: "spiritomb", name: "Spiritomb", unlock: 17 },
      { id: "marill", name: "Marill", unlock: 18 },
      { id: "cleffa", name: "Cleffa", unlock: 17 },
      { id: "druddigon", name: "Druddigon", unlock: 18 },
      { id: "applin", name: "Applin", unlock: 17 },
      { id: "hoppip", name: "Hoppip", unlock: 16 },
      { id: "tropius", name: "Tropius", unlock: 17 },
      { id: "aipom", name: "Aipom", unlock: 16 },
      { id: "smeargle", name: "Smeargle", unlock: 17 },
      { id: "poliwag", name: "Poliwag", unlock: 19 },
      { id: "corphish", name: "Corphish", unlock: 18 },
      { id: "magby", name: "Magby", unlock: 19 },
      { id: "darumaka", name: "Darumaka", unlock: 18 },
      { id: "sewaddle", name: "Sewaddle", unlock: 17 },
      { id: "pumpkaboo", name: "Pumpkaboo", unlock: 18 },
      { id: "plusle", name: "Plusle", unlock: 19 },
      { id: "minun", name: "Minun", unlock: 18 },
      { id: "nidoranF", name: "NidoranF", unlock: 19 },
      { id: "seviper", name: "Seviper", unlock: 18 },
      { id: "gligar", name: "Gligar", unlock: 19 },
      { id: "rhyhorn", name: "Rhyhorn", unlock: 18 },
      { id: "sudowoodo", name: "Sudowoodo", unlock: 19 },
      { id: "boldore", name: "Boldore", unlock: 18 },
      { id: "pineco", name: "Pineco", unlock: 17 },
      { id: "heracross", name: "Heracross", unlock: 18 },
      { id: "hitmonlee", name: "Hitmonlee", unlock: 19 },
      { id: "hitmonchan", name: "Hitmonchan", unlock: 18 },
      { id: "steelix", name: "Steelix", unlock: 19 },
      { id: "scizor", name: "Scizor", unlock: 18 },
      { id: "banette", name: "Banette", unlock: 19 },
      { id: "shedinja", name: "Shedinja", unlock: 18 },
      { id: "slowpoke", name: "Slowpoke", unlock: 17 },
      { id: "girafarig", name: "Girafarig", unlock: 18 },
      { id: "glaceon", name: "Glaceon", unlock: 19 },
      { id: "beartic", name: "Beartic", unlock: 18 },
      { id: "umbreon", name: "Umbreon", unlock: 19 },
      { id: "cacturne", name: "Cacturne", unlock: 18 },
      { id: "granbull", name: "Granbull", unlock: 19 },
      { id: "togekiss", name: "Togekiss", unlock: 18 },
      { id: "shelgon", name: "Shelgon", unlock: 19 },
      { id: "gabite", name: "Gabite", unlock: 18 },
      { id: "noctowl", name: "Noctowl", unlock: 17 },
      { id: "xatu", name: "Xatu", unlock: 18 },
      { id: "kangaskhan", name: "Kangaskhan", unlock: 19 },
      { id: "tauros", name: "Tauros", unlock: 18 },
      { id: "psyduck", name: "Psyduck", unlock: 20 },
      { id: "seel", name: "Seel", unlock: 19 },
      { id: "cyndaquil", name: "Cyndaquil", unlock: 20 },
      { id: "fennekin", name: "Fennekin", unlock: 19 },
      { id: "sunkern", name: "Sunkern", unlock: 18 },
      { id: "cacnea", name: "Cacnea", unlock: 19 },
      { id: "pichu", name: "Pichu", unlock: 18 },
      { id: "chinchou", name: "Chinchou", unlock: 19 },
      { id: "weedle", name: "Weedle", unlock: 18 },
      { id: "qwilfish", name: "Qwilfish", unlock: 19 },
      { id: "donphan", name: "Donphan", unlock: 20 },
      { id: "marowak", name: "Marowak", unlock: 19 },
      { id: "onix", name: "Onix", unlock: 20 },
      { id: "omanyte", name: "Omanyte", unlock: 19 },
      { id: "scyther", name: "Scyther", unlock: 20 },
      { id: "pinsir", name: "Pinsir", unlock: 19 },
      { id: "medicham", name: "Medicham", unlock: 20 },
      { id: "lucario", name: "Lucario", unlock: 19 },
      { id: "metang", name: "Metang", unlock: 20 },
      { id: "lairon", name: "Lairon", unlock: 19 },
      { id: "gengar", name: "Gengar", unlock: 20 },
      { id: "chandelure", name: "Chandelure", unlock: 19 },
      { id: "alakazam", name: "Alakazam", unlock: 20 },
      { id: "gardevoir", name: "Gardevoir", unlock: 19 },
      { id: "lapras", name: "Lapras", unlock: 20 },
      { id: "weavile", name: "Weavile", unlock: 19 },
      { id: "honchkrow", name: "Honchkrow", unlock: 20 },
      { id: "houndoom", name: "Houndoom", unlock: 19 },
      { id: "florges", name: "Florges", unlock: 20 },
      { id: "mimikyu", name: "Mimikyu", unlock: 19 },
      { id: "dragonite", name: "Dragonite", unlock: 20 },
      { id: "flygon", name: "Flygon", unlock: 19 },
      { id: "staraptor", name: "Staraptor", unlock: 20 },
      { id: "braviary", name: "Braviary", unlock: 19 },
      { id: "snorlax", name: "Snorlax", unlock: 20 },
      { id: "zangoose", name: "Zangoose", unlock: 19 },
      { id: "gyarados", name: "Gyarados", unlock: 22 },
      { id: "kingdra", name: "Kingdra", unlock: 21 },
      { id: "blaziken", name: "Blaziken", unlock: 22 },
      { id: "typhlosion", name: "Typhlosion", unlock: 21 },
      { id: "venusaur", name: "Venusaur", unlock: 22 },
      { id: "sceptile", name: "Sceptile", unlock: 21 },
      { id: "jolteon", name: "Jolteon", unlock: 22 },
      { id: "ampharos", name: "Ampharos", unlock: 21 },
      { id: "nidoking", name: "Nidoking", unlock: 22 },
      { id: "crobat", name: "Crobat", unlock: 21 },
      { id: "krookodile", name: "Krookodile", unlock: 22 },
      { id: "nidoqueen", name: "Nidoqueen", unlock: 21 },
      { id: "tyranitar", name: "Tyranitar", unlock: 22 },
      { id: "aerodactyl", name: "Aerodactyl", unlock: 21 },
      { id: "yanmega", name: "Yanmega", unlock: 22 },
      { id: "scolipede", name: "Scolipede", unlock: 21 },
      { id: "conkeldurr", name: "Conkeldurr", unlock: 22 },
      { id: "machamp", name: "Machamp", unlock: 21 },
      { id: "magnezone", name: "Magnezone", unlock: 22 },
      { id: "empoleon", name: "Empoleon", unlock: 21 },
      { id: "dusknoir", name: "Dusknoir", unlock: 22 },
      { id: "cofagrigus", name: "Cofagrigus", unlock: 21 },
      { id: "reuniclus", name: "Reuniclus", unlock: 22 },
      { id: "gothitelle", name: "Gothitelle", unlock: 21 },
      { id: "mamoswine", name: "Mamoswine", unlock: 22 },
      { id: "walrein", name: "Walrein", unlock: 21 },
      { id: "darkrai", name: "Darkrai", unlock: 22 },
      { id: "hydreigon", name: "Hydreigon", unlock: 21 },
      { id: "sylveon", name: "Sylveon", unlock: 22 },
      { id: "hatterene", name: "Hatterene", unlock: 21 },
      { id: "haxorus", name: "Haxorus", unlock: 22 },
      { id: "goodra", name: "Goodra", unlock: 21 },
      { id: "pidgeot", name: "Pidgeot", unlock: 22 },
      { id: "noivern", name: "Noivern", unlock: 21 },
      { id: "blissey", name: "Blissey", unlock: 22 },
      { id: "porygonZ", name: "Porygon-Z", unlock: 21 },
      // 10th dungeon starters
      { id: "blastoise", name: "Blastoise", unlock: 24 },
      { id: "feraligatr", name: "Feraligatr", unlock: 23 },
      { id: "charizard", name: "Charizard", unlock: 24 },
      { id: "delphox", name: "Delphox", unlock: 23 },
      { id: "torterra", name: "Torterra", unlock: 24 },
      { id: "serperior", name: "Serperior", unlock: 23 },
      { id: "electivire", name: "Electivire", unlock: 24 },
      { id: "luxray", name: "Luxray", unlock: 23 },
      { id: "roserade", name: "Roserade", unlock: 24 },
      { id: "vileplume", name: "Vileplume", unlock: 23 },
      { id: "rhyperior", name: "Rhyperior", unlock: 24 },
      { id: "dugtrio", name: "Dugtrio", unlock: 23 },
      { id: "golem", name: "Golem", unlock: 24 },
      { id: "terrakion", name: "Terrakion", unlock: 23 },
      { id: "pheromosa", name: "Pheromosa", unlock: 24 },
      { id: "escavalier", name: "Escavalier", unlock: 23 },
      { id: "kommoO", name: "Kommo-o", unlock: 24 },
      { id: "gallade", name: "Gallade", unlock: 23 },
      { id: "corviknight", name: "Corviknight", unlock: 24 },
      { id: "bastiodon", name: "Bastiodon", unlock: 23 },
      { id: "aegislash", name: "Aegislash", unlock: 24 },
      { id: "jellicent", name: "Jellicent", unlock: 23 },
      { id: "slowking", name: "Slowking", unlock: 24 },
      { id: "bronzong", name: "Bronzong", unlock: 23 },
      { id: "froslass", name: "Froslass", unlock: 24 },
      { id: "abomasnow", name: "Abomasnow", unlock: 23 },
      { id: "sharpedo", name: "Sharpedo", unlock: 24 },
      { id: "zoroark", name: "Zoroark", unlock: 23 },
      { id: "primarina", name: "Primarina", unlock: 24 },
      { id: "diancie", name: "Diancie", unlock: 23 },
      { id: "dragapult", name: "Dragapult", unlock: 24 },
      { id: "duraludon", name: "Duraludon", unlock: 23 },
      { id: "swellow", name: "Swellow", unlock: 24 },
      { id: "talonflame", name: "Talonflame", unlock: 23 },
      { id: "slaking", name: "Slaking", unlock: 24 },
      { id: "lopunny", name: "Lopunny", unlock: 23 },
      // 11th dungeon starters (Legendary post-game)
      { id: "suicune", name: "Suicune", unlock: 26 },
      { id: "lugia", name: "Lugia", unlock: 25 },
      { id: "entei", name: "Entei", unlock: 26 },
      { id: "hoOh", name: "Ho-Oh", unlock: 25 },
      { id: "celebi", name: "Celebi", unlock: 26 },
      { id: "virizion", name: "Virizion", unlock: 25 },
      { id: "raikou", name: "Raikou", unlock: 26 },
      { id: "zekrom", name: "Zekrom", unlock: 25 },
      { id: "nihilego", name: "Nihilego", unlock: 26 },
      { id: "naganadel", name: "Naganadel", unlock: 25 },
      { id: "groudon", name: "Groudon", unlock: 26 },
      { id: "landorus", name: "Landorus", unlock: 25 },
      { id: "regirock", name: "Regirock", unlock: 26 },
      { id: "stakataka", name: "Stakataka", unlock: 25 },
      { id: "genesect", name: "Genesect", unlock: 26 },
      { id: "buzzwole", name: "Buzzwole", unlock: 25 },
      { id: "cobalion", name: "Cobalion", unlock: 26 },
      { id: "marshadow", name: "Marshadow", unlock: 25 },
      { id: "registeel", name: "Registeel", unlock: 26 },
      { id: "solgaleo", name: "Solgaleo", unlock: 25 },
      { id: "giratina", name: "Giratina", unlock: 26 },
      { id: "lunala", name: "Lunala", unlock: 25 },
      { id: "mewtwo", name: "Mewtwo", unlock: 26 },
      { id: "deoxys", name: "Deoxys", unlock: 25 },
      { id: "regice", name: "Regice", unlock: 26 },
      { id: "kyurem", name: "Kyurem", unlock: 25 },
      { id: "yveltal", name: "Yveltal", unlock: 26 },
      { id: "hoopa", name: "Hoopa", unlock: 25 },
      { id: "xerneas", name: "Xerneas", unlock: 26 },
      { id: "magearna", name: "Magearna", unlock: 25 },
      { id: "rayquaza", name: "Rayquaza", unlock: 26 },
      { id: "dialga", name: "Dialga", unlock: 25 },
      { id: "tornadus", name: "Tornadus", unlock: 26 },
      { id: "articuno", name: "Articuno", unlock: 25 },
      { id: "arceus", name: "Arceus", unlock: 26 },
      { id: "regigigas", name: "Regigigas", unlock: 25 },
      // 12th dungeon starters (FINAL tier)
      { id: "kyogre", name: "Kyogre", unlock: 28 },
      { id: "palkia", name: "Palkia", unlock: 27 },
      { id: "reshiram", name: "Reshiram", unlock: 28 },
      { id: "victini", name: "Victini", unlock: 27 },
      { id: "shaymin", name: "Shaymin", unlock: 28 },
      { id: "tapuBulu", name: "Tapu Bulu", unlock: 27 },
      { id: "thundurus", name: "Thundurus", unlock: 28 },
      { id: "zeraora", name: "Zeraora", unlock: 27 },
      { id: "eternatus", name: "Eternatus", unlock: 28 },
      { id: "poipole", name: "Poipole", unlock: 27 },
      { id: "zygarde", name: "Zygarde", unlock: 28 },
      { id: "excadrill", name: "Excadrill", unlock: 27 },
      { id: "lycanroc", name: "Lycanroc", unlock: 28 },
      { id: "gigalith", name: "Gigalith", unlock: 27 },
      { id: "volcarona", name: "Volcarona", unlock: 28 },
      { id: "golisopod", name: "Golisopod", unlock: 27 },
      { id: "urshifu", name: "Urshifu", unlock: 28 },
      { id: "keldeo", name: "Keldeo", unlock: 27 },
      { id: "heatran", name: "Heatran", unlock: 28 },
      { id: "kartana", name: "Kartana", unlock: 27 },
      { id: "spectrier", name: "Spectrier", unlock: 28 },
      { id: "polteageist", name: "Polteageist", unlock: 27 },
      { id: "mew", name: "Mew", unlock: 28 },
      { id: "cresselia", name: "Cresselia", unlock: 27 },
      { id: "calyrexIce", name: "Calyrex-Ice", unlock: 28 },
      { id: "cloyster", name: "Cloyster", unlock: 27 },
      { id: "grimmsnarl", name: "Grimmsnarl", unlock: 28 },
      { id: "incineroar", name: "Incineroar", unlock: 27 },
      { id: "zacian", name: "Zacian", unlock: 28 },
      { id: "tapuLele", name: "Tapu Lele", unlock: 27 },
      { id: "garchomp", name: "Garchomp", unlock: 28 },
      { id: "latios", name: "Latios", unlock: 27 },
      { id: "zapdos", name: "Zapdos", unlock: 28 },
      { id: "moltres", name: "Moltres", unlock: 27 },
      { id: "silvally", name: "Silvally", unlock: 28 },
      { id: "meloetta", name: "Meloetta", unlock: 27 },
    ];
  }
}
