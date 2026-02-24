import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { loadMeta, MetaSaveData } from "../core/save-system";
import { ACHIEVEMENTS, PlayerStats } from "../core/achievements";
import { DUNGEONS, CHALLENGE_MODES } from "../core/dungeon-data";
import { SPECIES } from "../core/pokemon-data";
import { STARTER_LIST } from "../core/starter-data";

type TabId = "achievements" | "statistics";

export class AchievementScene extends Phaser.Scene {
  private meta!: MetaSaveData;
  private stats!: PlayerStats;
  private activeTab: TabId = "achievements";

  // Containers for each tab's content
  private achievementContainer!: Phaser.GameObjects.Container;
  private statisticsContainer!: Phaser.GameObjects.Container;

  // Non-scrolling elements for achievements tab (progress bar, count text)
  private achFixedElements: Phaser.GameObjects.GameObject[] = [];

  // Tab button references for styling
  private tabAchBtn!: Phaser.GameObjects.Text;
  private tabStatsBtn!: Phaser.GameObjects.Text;
  private tabAchUnderline!: Phaser.GameObjects.Rectangle;
  private tabStatsUnderline!: Phaser.GameObjects.Rectangle;

  // Scroll state
  private scrollOffset = 0;
  private maxScroll = 0;
  private isDragging = false;
  private dragStartY = 0;

  // Scroll area bounds
  private readonly SCROLL_TOP = 90;
  private readonly SCROLL_BOTTOM = GAME_HEIGHT - 40;

  constructor() {
    super({ key: "AchievementScene" });
  }

  create() {
    this.meta = loadMeta();

    this.stats = {
      totalRuns: this.meta.totalRuns,
      totalClears: this.meta.totalClears,
      totalGold: this.meta.totalGold,
      bestFloor: this.meta.bestFloor,
      totalEnemiesDefeated: this.meta.totalEnemiesDefeated ?? 0,
      totalTurns: this.meta.totalTurns ?? 0,
      endlessBestFloor: this.meta.endlessBestFloor ?? 0,
      challengeClears: this.meta.challengeClears ?? 0,
      uniqueStartersUsed: (this.meta.startersUsed ?? []).length,
    };

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1a);

    // Title
    this.add.text(GAME_WIDTH / 2, 18, "Stats & Achievements", {
      fontSize: "15px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    // ── Tab Buttons ──
    this.createTabs();

    // ── Build Both Tab Contents ──
    this.achievementContainer = this.add.container(0, 0);
    this.statisticsContainer = this.add.container(0, 0);

    this.buildAchievementsTab();
    this.buildStatisticsTab();

    // Mask for scrollable area
    const scrollH = this.SCROLL_BOTTOM - this.SCROLL_TOP;
    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillRect(0, this.SCROLL_TOP, GAME_WIDTH, scrollH);
    const mask = maskShape.createGeometryMask();
    this.achievementContainer.setMask(mask);
    this.statisticsContainer.setMask(mask);

    // Set up scroll input
    this.setupScrollInput();

    // Show default tab
    this.switchTab("achievements");

    // Back button
    const back = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20, "[Back to Town]", {
      fontSize: "13px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setInteractive();
    back.on("pointerdown", () => this.scene.start("HubScene"));
  }

  // ────────────────────────────────────────────
  // Tab System
  // ────────────────────────────────────────────

  private createTabs() {
    const tabY = 42;
    const leftX = GAME_WIDTH / 4;
    const rightX = (GAME_WIDTH / 4) * 3;

    // Achievement tab button
    this.tabAchBtn = this.add.text(leftX, tabY, "Achievements", {
      fontSize: "11px", color: "#ffffff", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.tabAchBtn.on("pointerdown", () => this.switchTab("achievements"));

    // Statistics tab button
    this.tabStatsBtn = this.add.text(rightX, tabY, "Statistics", {
      fontSize: "11px", color: "#ffffff", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.tabStatsBtn.on("pointerdown", () => this.switchTab("statistics"));

    // Underlines (active indicator)
    this.tabAchUnderline = this.add.rectangle(leftX, tabY + 12, 90, 2, 0xfbbf24);
    this.tabStatsUnderline = this.add.rectangle(rightX, tabY + 12, 80, 2, 0xfbbf24);

    // Separator line
    this.add.rectangle(GAME_WIDTH / 2, tabY + 18, GAME_WIDTH - 20, 1, 0x222244);
  }

  private switchTab(tab: TabId) {
    this.activeTab = tab;
    this.scrollOffset = 0;

    // Update tab button styles
    const activeColor = "#fbbf24";
    const inactiveColor = "#667eea";

    if (tab === "achievements") {
      this.tabAchBtn.setColor(activeColor);
      this.tabStatsBtn.setColor(inactiveColor);
      this.tabAchUnderline.setVisible(true);
      this.tabStatsUnderline.setVisible(false);

      this.achievementContainer.setVisible(true);
      this.achievementContainer.y = 0;
      this.statisticsContainer.setVisible(false);

      for (const el of this.achFixedElements) {
        (el as unknown as Phaser.GameObjects.Components.Visible).setVisible(true);
      }

      this.maxScroll = this.achMaxScroll;
    } else {
      this.tabAchBtn.setColor(inactiveColor);
      this.tabStatsBtn.setColor(activeColor);
      this.tabAchUnderline.setVisible(false);
      this.tabStatsUnderline.setVisible(true);

      this.achievementContainer.setVisible(false);
      this.statisticsContainer.setVisible(true);
      this.statisticsContainer.y = 0;

      for (const el of this.achFixedElements) {
        (el as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
      }

      this.maxScroll = this.statsMaxScroll;
    }
  }

  // ────────────────────────────────────────────
  // Scroll Input
  // ────────────────────────────────────────────

  private setupScrollInput() {
    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (ptr.y >= this.SCROLL_TOP && ptr.y <= this.SCROLL_BOTTOM) {
        this.isDragging = true;
        this.dragStartY = ptr.y;
      }
    });

    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      if (!ptr.isDown || !this.isDragging) return;
      const dy = ptr.y - this.dragStartY;
      this.dragStartY = ptr.y;
      this.scrollOffset = Math.max(-this.maxScroll, Math.min(0, this.scrollOffset + dy));

      if (this.activeTab === "achievements") {
        this.achievementContainer.y = this.scrollOffset;
      } else {
        this.statisticsContainer.y = this.scrollOffset;
      }
    });

    this.input.on("pointerup", () => {
      this.isDragging = false;
    });
  }

  // ────────────────────────────────────────────
  // Achievements Tab (existing logic, refactored)
  // ────────────────────────────────────────────

  private achMaxScroll = 0;

  private buildAchievementsTab() {
    const scrollTop = this.SCROLL_TOP;
    const scrollBottom = this.SCROLL_BOTTOM;
    const container = this.achievementContainer;

    const unlocked = ACHIEVEMENTS.filter(a => a.condition(this.stats));
    const locked = ACHIEVEMENTS.filter(a => !a.condition(this.stats));

    // Unlocked count (fixed, not in scroll container)
    const countText = this.add.text(GAME_WIDTH / 2, scrollTop - 8, `Unlocked: ${unlocked.length} / ${ACHIEVEMENTS.length}`, {
      fontSize: "10px", color: "#667eea", fontFamily: "monospace",
    }).setOrigin(0.5);
    this.achFixedElements.push(countText);

    // Progress bar (fixed)
    const barW = 280;
    const progress = ACHIEVEMENTS.length > 0 ? unlocked.length / ACHIEVEMENTS.length : 0;
    const barBg = this.add.rectangle(GAME_WIDTH / 2, scrollTop + 4, barW, 4, 0x222244);
    const barFill = this.add.rectangle(
      GAME_WIDTH / 2 - barW / 2 + (barW * progress) / 2,
      scrollTop + 4, barW * progress, 4, 0x667eea
    );
    this.achFixedElements.push(barBg, barFill);

    // Achievement list (scrollable)
    let cy = scrollTop + 18;

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

    const contentH = cy - scrollTop - 18;
    const scrollH = scrollBottom - scrollTop;
    this.achMaxScroll = Math.max(0, contentH - scrollH + 18);
  }

  // ────────────────────────────────────────────
  // Statistics Tab
  // ────────────────────────────────────────────

  private statsMaxScroll = 0;

  private buildStatisticsTab() {
    const container = this.statisticsContainer;
    const scrollTop = this.SCROLL_TOP;
    const scrollBottom = this.SCROLL_BOTTOM;
    const meta = this.meta;
    const stats = this.stats;

    // Layout helpers
    const LEFT_MARGIN = 24;
    const RIGHT_MARGIN = GAME_WIDTH - 24;
    let cy = scrollTop + 4;

    const addHeader = (text: string) => {
      const hdr = this.add.text(LEFT_MARGIN, cy, text, {
        fontSize: "11px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
      });
      container.add(hdr);
      cy += 4;
      // Underline
      const line = this.add.rectangle(GAME_WIDTH / 2, cy + 8, GAME_WIDTH - 48, 1, 0x333350);
      container.add(line);
      cy += 14;
    };

    const addRow = (label: string, value: string, valueColor = "#ffffff") => {
      const lbl = this.add.text(LEFT_MARGIN + 4, cy, label, {
        fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
      });
      const val = this.add.text(RIGHT_MARGIN - 4, cy, value, {
        fontSize: "9px", color: valueColor, fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(1, 0);
      container.add([lbl, val]);
      cy += 16;
    };

    const addSpacer = (h = 8) => { cy += h; };

    // ── 1. General Stats ──
    addHeader("General Stats");

    addRow("Total Runs", `${stats.totalRuns}`);
    addRow("Total Clears", `${stats.totalClears}`);

    const clearRate = stats.totalRuns > 0
      ? ((stats.totalClears / stats.totalRuns) * 100).toFixed(1) + "%"
      : "0.0%";
    addRow("Clear Rate", clearRate, "#4ade80");

    addRow("Total Gold Earned", this.formatNumber(stats.totalGold), "#fbbf24");
    addRow("Current Gold", this.formatNumber(meta.gold), "#fbbf24");
    addRow("Best Floor Reached", `B${stats.bestFloor}F`);
    addRow("Total Turns Taken", this.formatNumber(stats.totalTurns));
    addRow("Total Enemies Defeated", this.formatNumber(stats.totalEnemiesDefeated));

    addSpacer();

    // ── 2. Endless Mode Stats ──
    addHeader("Endless Mode");

    addRow("Best Floor (Endless)", stats.endlessBestFloor > 0 ? `B${stats.endlessBestFloor}F` : "---");

    addSpacer();

    // ── 3. Challenge Mode Stats ──
    addHeader("Challenge Mode");

    addRow("Total Challenge Clears", `${stats.challengeClears}`);

    // List which challenges exist
    for (const ch of CHALLENGE_MODES) {
      const completed = stats.challengeClears > 0; // We don't track per-challenge, just total
      const chLabel = `  ${ch.name}`;
      const chVal = completed ? "Cleared" : "---";
      addRow(chLabel, chVal, completed ? "#4ade80" : "#444460");
    }

    addSpacer();

    // ── 4. Collection Stats ──
    addHeader("Collection");

    // Count starters that the player has unlocked (totalClears >= unlock requirement)
    const allStarters = this.getStarterList();
    const unlockedStarters = allStarters.filter(s => meta.totalClears >= s.unlock).length;
    addRow("Starters Unlocked", `${unlockedStarters} / ${allStarters.length}`, "#a855f7");

    // Pokemon Seen
    const totalSpeciesCount = Object.keys(SPECIES).length;
    const seenCount = (meta.pokemonSeen ?? []).length;
    addRow("Pokemon Seen", `${seenCount} / ${totalSpeciesCount}`, "#60a5fa");

    // Pokemon Used as Starter
    const usedCount = (meta.pokemonUsed ?? []).length;
    addRow("Pokemon Used as Starter", `${usedCount} / ${totalSpeciesCount}`, "#60a5fa");

    // Dungeons Cleared — count unique dungeons in the dungeon list (excluding endless/bossRush/daily)
    const allDungeonKeys = Object.keys(DUNGEONS).filter(
      k => k !== "endlessDungeon" && k !== "bossRush" && k !== "dailyDungeon"
    );
    const totalDungeonCount = allDungeonKeys.length;
    // We don't track per-dungeon clears in MetaSaveData, so show total count
    const unlockedDungeons = allDungeonKeys.filter(k => meta.totalClears >= DUNGEONS[k].unlockClears).length;
    addRow("Dungeons Unlocked", `${unlockedDungeons} / ${totalDungeonCount}`, "#a855f7");

    // Achievements Earned
    const unlockedAch = ACHIEVEMENTS.filter(a => a.condition(stats)).length;
    addRow("Achievements Earned", `${unlockedAch} / ${ACHIEVEMENTS.length}`, "#667eea");

    addSpacer();

    // ── 5. Averages ──
    addHeader("Averages");

    const avgGold = stats.totalRuns > 0
      ? Math.floor(stats.totalGold / stats.totalRuns)
      : 0;
    addRow("Avg Gold per Run", this.formatNumber(avgGold), "#fbbf24");

    const avgEnemies = stats.totalRuns > 0
      ? Math.floor(stats.totalEnemiesDefeated / stats.totalRuns)
      : 0;
    addRow("Avg Enemies per Run", `${avgEnemies}`);

    const avgTurns = stats.totalRuns > 0
      ? Math.floor(stats.totalTurns / stats.totalRuns)
      : 0;
    addRow("Avg Turns per Run", `${avgTurns}`);

    addSpacer();

    // ── 6. Item Forge Stats ──
    addHeader("Item Storage");

    const totalItemsInStorage = (meta.storage ?? []).reduce((sum, s) => sum + s.count, 0);
    addRow("Total Items in Storage", `${totalItemsInStorage}`);

    const uniqueItemTypes = (meta.storage ?? []).length;
    addRow("Unique Item Types", `${uniqueItemTypes}`);

    addSpacer();

    // ── 7. Held Items & Abilities ──
    addHeader("Equipment");

    const ownedHeld = (meta.ownedHeldItems ?? []).length;
    addRow("Held Items Owned", `${ownedHeld}`);

    const equippedItem = meta.equippedHeldItem ?? "None";
    const displayEquipped = equippedItem === "None"
      ? "None"
      : equippedItem.charAt(0).toUpperCase() + equippedItem.slice(1);
    addRow("Equipped Item", displayEquipped, equippedItem === "None" ? "#444460" : "#f472b6");

    const abilityCount = Object.keys(meta.abilityLevels ?? {}).length;
    addRow("Abilities Upgraded", `${abilityCount}`);

    // Calculate content height for scroll
    const contentH = cy - scrollTop;
    const scrollH = scrollBottom - scrollTop;
    this.statsMaxScroll = Math.max(0, contentH - scrollH + 10);
  }

  // ────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────

  private formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 10_000) return (n / 1_000).toFixed(1) + "K";
    return n.toLocaleString();
  }

  private getStarterList(): { id: string; name: string; unlock: number }[] {
    return STARTER_LIST;
  }
}
