import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import {
  RunScore,
  getTopScores,
  getAllTimeTopScores,
  getRecentRuns,
  getAllTimeStats,
  getDungeonsWithScores,
} from "../core/leaderboard";
import { DUNGEONS } from "../core/dungeon-data";

type TabId = "dungeon" | "allTime" | "recent";

export class LeaderboardScene extends Phaser.Scene {
  private activeTab: TabId = "dungeon";
  private selectedDungeonId: string | null = null;
  private uiElements: Phaser.GameObjects.GameObject[] = [];
  private tabButtons: Phaser.GameObjects.GameObject[] = [];
  private contentContainer!: Phaser.GameObjects.Container;
  private scrollOffset = 0;
  private maxScroll = 0;
  private indicator!: Phaser.GameObjects.Rectangle;

  constructor() {
    super({ key: "LeaderboardScene" });
  }

  create() {
    this.scrollOffset = 0;
    this.maxScroll = 0;
    this.uiElements = [];
    this.tabButtons = [];

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1a);

    // Title
    this.add.text(GAME_WIDTH / 2, 25, "Hall of Fame", {
      fontSize: "16px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    // All-time stats summary
    const stats = getAllTimeStats();
    const summaryText = stats.bestScore
      ? `Best: ${stats.bestScore.score} pts  |  Runs Tracked: ${stats.totalRuns}`
      : "No runs recorded yet!";
    this.add.text(GAME_WIDTH / 2, 48, summaryText, {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Tab buttons
    this.createTabs();

    // Scroll indicator
    this.indicator = this.add.rectangle(
      GAME_WIDTH - 4, 110, 3, 20, 0x667eea, 0.5
    ).setOrigin(0.5, 0).setDepth(11).setVisible(false);

    // Content container
    this.contentContainer = this.add.container(0, 0).setDepth(5);

    // Mask for scrollable area
    const scrollTop = 110;
    const scrollBottom = GAME_HEIGHT - 45;
    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillRect(0, scrollTop, GAME_WIDTH, scrollBottom - scrollTop);
    const geoMask = maskShape.createGeometryMask();
    this.contentContainer.setMask(geoMask);

    // Default: show dungeon tab, auto-select first dungeon with scores
    const dungeonsWithScores = getDungeonsWithScores();
    if (dungeonsWithScores.length > 0) {
      this.selectedDungeonId = dungeonsWithScores[0];
    }
    this.renderContent();

    // Back button
    const backBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 30, 180, 34, 0x1a1a2e, 0.95)
      .setStrokeStyle(1, 0x334155).setInteractive({ useHandCursor: true }).setDepth(20);
    backBg.on("pointerover", () => backBg.setFillStyle(0x2a2a4e, 1));
    backBg.on("pointerout", () => backBg.setFillStyle(0x1a1a2e, 0.95));
    backBg.on("pointerdown", () => this.scene.start("HubScene"));
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, "Back to Town", {
      fontSize: "13px", color: "#60a5fa", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(20);

    // Scroll handling
    let dragStartY = 0;
    const scrollTop2 = 110;
    const scrollBottom2 = GAME_HEIGHT - 45;

    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (ptr.y >= scrollTop2 && ptr.y <= scrollBottom2) {
        dragStartY = ptr.y;
      }
    });

    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      if (!ptr.isDown || ptr.y < scrollTop2 || ptr.y > scrollBottom2) return;
      const dy = ptr.y - dragStartY;
      dragStartY = ptr.y;
      this.scrollOffset = Math.max(-this.maxScroll, Math.min(0, this.scrollOffset + dy));
      this.contentContainer.y = this.scrollOffset;
      this.updateIndicator();
    });
  }

  private createTabs() {
    // Clear old tab buttons
    this.tabButtons.forEach(o => o.destroy());
    this.tabButtons = [];

    const tabs: { id: TabId; label: string }[] = [
      { id: "dungeon", label: "By Dungeon" },
      { id: "allTime", label: "All Time" },
      { id: "recent", label: "Recent" },
    ];

    const tabW = 100;
    const tabH = 24;
    const startX = GAME_WIDTH / 2 - (tabs.length * tabW) / 2 + tabW / 2;
    const tabY = 72;

    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      const x = startX + i * tabW;
      const isActive = this.activeTab === tab.id;

      const bg = this.add.rectangle(x, tabY, tabW - 4, tabH,
        isActive ? 0x334155 : 0x1a1a2e, isActive ? 1 : 0.7
      ).setStrokeStyle(1, isActive ? 0x667eea : 0x222233)
        .setInteractive({ useHandCursor: true }).setDepth(10);

      const label = this.add.text(x, tabY, tab.label, {
        fontSize: "10px",
        color: isActive ? "#60a5fa" : "#666680",
        fontFamily: "monospace",
        fontStyle: isActive ? "bold" : "normal",
      }).setOrigin(0.5).setDepth(10);

      bg.on("pointerdown", () => {
        this.activeTab = tab.id;
        this.scrollOffset = 0;
        this.contentContainer.y = 0;
        this.createTabs();
        this.renderContent();
      });

      this.tabButtons.push(bg, label);
    }
  }

  private renderContent() {
    // Clear content
    this.contentContainer.removeAll(true);
    this.uiElements = [];

    switch (this.activeTab) {
      case "dungeon":
        this.renderDungeonTab();
        break;
      case "allTime":
        this.renderAllTimeTab();
        break;
      case "recent":
        this.renderRecentTab();
        break;
    }
  }

  private renderDungeonTab() {
    const scrollTop = 110;
    const scrollH = GAME_HEIGHT - 45 - scrollTop;
    let cy = scrollTop + 5;

    // Dungeon selector
    const dungeonsWithScores = getDungeonsWithScores();
    if (dungeonsWithScores.length === 0) {
      const noData = this.add.text(GAME_WIDTH / 2, cy + 40, "No runs recorded yet!\nComplete a dungeon to see\nyour scores here.", {
        fontSize: "11px", color: "#666680", fontFamily: "monospace", align: "center",
      }).setOrigin(0.5, 0);
      this.contentContainer.add(noData);
      this.maxScroll = 0;
      this.indicator.setVisible(false);
      return;
    }

    // Dungeon selector buttons (horizontal scroll area)
    const selectorLabel = this.add.text(15, cy, "Select Dungeon:", {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
    });
    this.contentContainer.add(selectorLabel);
    cy += 16;

    // Show dungeon names as selectable items
    for (const dId of dungeonsWithScores) {
      const dungeonDef = DUNGEONS[dId];
      const name = dungeonDef?.name ?? dId;
      const isSelected = dId === this.selectedDungeonId;

      const bg = this.add.rectangle(GAME_WIDTH / 2, cy, 320, 22,
        isSelected ? 0x334155 : 0x1a1a2e, isSelected ? 1 : 0.8
      ).setStrokeStyle(1, isSelected ? 0xfbbf24 : 0x222233)
        .setInteractive({ useHandCursor: true });

      const text = this.add.text(GAME_WIDTH / 2, cy, name, {
        fontSize: "10px",
        color: isSelected ? "#fbbf24" : "#e0e0e0",
        fontFamily: "monospace",
        fontStyle: isSelected ? "bold" : "normal",
      }).setOrigin(0.5);

      const scores = getTopScores(dId, 1);
      const bestText = scores.length > 0 ? `Best: ${scores[0].score}` : "";
      const best = this.add.text(GAME_WIDTH / 2 + 130, cy, bestText, {
        fontSize: "8px", color: "#94a3b8", fontFamily: "monospace",
      }).setOrigin(1, 0.5);

      bg.on("pointerdown", () => {
        this.selectedDungeonId = dId;
        this.scrollOffset = 0;
        this.contentContainer.y = 0;
        this.renderContent();
      });

      this.contentContainer.add([bg, text, best]);
      cy += 26;
    }

    cy += 8;

    // Show top scores for selected dungeon
    if (this.selectedDungeonId) {
      const scores = getTopScores(this.selectedDungeonId, 10);
      const dungeonDef = DUNGEONS[this.selectedDungeonId];
      const dungeonName = dungeonDef?.name ?? this.selectedDungeonId;

      const header = this.add.text(GAME_WIDTH / 2, cy, `Top Scores - ${dungeonName}`, {
        fontSize: "11px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5);
      this.contentContainer.add(header);
      cy += 20;

      if (scores.length === 0) {
        const noScores = this.add.text(GAME_WIDTH / 2, cy + 10, "No scores yet.", {
          fontSize: "10px", color: "#666680", fontFamily: "monospace",
        }).setOrigin(0.5);
        this.contentContainer.add(noScores);
        cy += 30;
      } else {
        cy = this.renderScoreList(scores, cy, true);
      }
    }

    const contentH = cy - scrollTop;
    this.maxScroll = Math.max(0, contentH - scrollH);
    this.updateIndicator();
  }

  private renderAllTimeTab() {
    const scrollTop = 110;
    const scrollH = GAME_HEIGHT - 45 - scrollTop;
    let cy = scrollTop + 5;

    const scores = getAllTimeTopScores(10);

    const header = this.add.text(GAME_WIDTH / 2, cy, "All-Time Best Scores", {
      fontSize: "11px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);
    this.contentContainer.add(header);
    cy += 20;

    if (scores.length === 0) {
      const noScores = this.add.text(GAME_WIDTH / 2, cy + 20, "No runs recorded yet!\nComplete a dungeon to see\nyour scores here.", {
        fontSize: "11px", color: "#666680", fontFamily: "monospace", align: "center",
      }).setOrigin(0.5, 0);
      this.contentContainer.add(noScores);
      this.maxScroll = 0;
      this.indicator.setVisible(false);
      return;
    }

    cy = this.renderScoreList(scores, cy, false);

    const contentH = cy - scrollTop;
    this.maxScroll = Math.max(0, contentH - scrollH);
    this.updateIndicator();
  }

  private renderRecentTab() {
    const scrollTop = 110;
    const scrollH = GAME_HEIGHT - 45 - scrollTop;
    let cy = scrollTop + 5;

    const runs = getRecentRuns(10);

    const header = this.add.text(GAME_WIDTH / 2, cy, "Recent Runs", {
      fontSize: "11px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);
    this.contentContainer.add(header);
    cy += 20;

    if (runs.length === 0) {
      const noRuns = this.add.text(GAME_WIDTH / 2, cy + 20, "No runs recorded yet!\nComplete a dungeon to see\nyour history here.", {
        fontSize: "11px", color: "#666680", fontFamily: "monospace", align: "center",
      }).setOrigin(0.5, 0);
      this.contentContainer.add(noRuns);
      this.maxScroll = 0;
      this.indicator.setVisible(false);
      return;
    }

    // Recent runs don't have rank-based coloring — just numbered
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      cy = this.renderRunEntry(run, i + 1, cy, false);
    }

    const contentH = cy - scrollTop;
    this.maxScroll = Math.max(0, contentH - scrollH);
    this.updateIndicator();
  }

  /**
   * Render a list of scores with rank coloring.
   * @param isDungeonSpecific - if true, skip showing dungeon name in each entry
   */
  private renderScoreList(scores: RunScore[], startY: number, isDungeonSpecific: boolean): number {
    let cy = startY;
    for (let i = 0; i < scores.length; i++) {
      const rank = i + 1;
      cy = this.renderRunEntry(scores[i], rank, cy, !isDungeonSpecific);
    }
    return cy;
  }

  /**
   * Render a single run entry.
   */
  private renderRunEntry(run: RunScore, rank: number, y: number, showDungeon: boolean): number {
    const entryH = showDungeon ? 58 : 48;

    // Rank coloring
    let rankColor = "#e0e0e0";
    let bgColor = 0x1a1a2e;
    let borderColor = 0x222233;
    if (rank === 1) {
      rankColor = "#fbbf24"; // Gold
      bgColor = 0x2a2520;
      borderColor = 0x665520;
    } else if (rank === 2) {
      rankColor = "#c0c0c0"; // Silver
      bgColor = 0x222530;
      borderColor = 0x555560;
    } else if (rank === 3) {
      rankColor = "#cd7f32"; // Bronze
      bgColor = 0x25201a;
      borderColor = 0x554830;
    }

    // Background
    const bg = this.add.rectangle(GAME_WIDTH / 2, y + entryH / 2, 330, entryH - 4, bgColor, 0.9)
      .setStrokeStyle(1, borderColor);
    this.contentContainer.add(bg);

    // Rank indicator
    const rankSymbol = rank <= 3 ? ["", "#1", "#2", "#3"][rank] : `#${rank}`;
    const rankText = this.add.text(20, y + 6, rankSymbol, {
      fontSize: "12px", color: rankColor, fontFamily: "monospace", fontStyle: "bold",
    });
    this.contentContainer.add(rankText);

    // Score
    const scoreText = this.add.text(55, y + 4, `${run.score} pts`, {
      fontSize: "12px", color: rankColor, fontFamily: "monospace", fontStyle: "bold",
    });
    this.contentContainer.add(scoreText);

    // Cleared badge
    const clearedBadge = run.cleared ? "CLEAR" : "FAIL";
    const clearedColor = run.cleared ? "#4ade80" : "#ef4444";
    const badge = this.add.text(GAME_WIDTH - 20, y + 4, clearedBadge, {
      fontSize: "9px", color: clearedColor, fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(1, 0);
    this.contentContainer.add(badge);

    // Starter name
    const starterName = run.starter.charAt(0).toUpperCase() + run.starter.slice(1);
    const detailLine1 = `${starterName}  B${run.floorsCleared}F  ${run.enemiesDefeated} KOs  ${run.turns}T`;
    const detail1 = this.add.text(55, y + 20, detailLine1, {
      fontSize: "8px", color: "#94a3b8", fontFamily: "monospace",
    });
    this.contentContainer.add(detail1);

    // Date + challenge mode
    const dateStr = this.formatDate(run.date);
    let line2 = dateStr;
    if (run.challengeMode) {
      const modeNames: Record<string, string> = { speedrun: "Speed Run", noItems: "No Items", solo: "Solo" };
      line2 += `  [${modeNames[run.challengeMode] ?? run.challengeMode}]`;
    }
    if (run.difficulty) {
      const diffNames: Record<string, string> = { easy: "Easy", hard: "Hard", nightmare: "Nightmare" };
      line2 += `  [${diffNames[run.difficulty] ?? run.difficulty}]`;
    }

    // Dungeon name (if showing across dungeons)
    if (showDungeon) {
      const dungeonDef = DUNGEONS[run.dungeonId];
      const dungeonName = dungeonDef?.name ?? run.dungeonId;
      const dungeonText = this.add.text(55, y + 32, dungeonName, {
        fontSize: "8px", color: "#667eea", fontFamily: "monospace",
      });
      this.contentContainer.add(dungeonText);

      const dateText = this.add.text(55, y + 44, line2, {
        fontSize: "7px", color: "#555566", fontFamily: "monospace",
      });
      this.contentContainer.add(dateText);
    } else {
      const dateText = this.add.text(55, y + 32, line2, {
        fontSize: "7px", color: "#555566", fontFamily: "monospace",
      });
      this.contentContainer.add(dateText);
    }

    return y + entryH + 2;
  }

  private formatDate(isoDate: string): string {
    try {
      const d = new Date(isoDate);
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const year = d.getFullYear();
      return `${year}-${month}-${day}`;
    } catch {
      return isoDate;
    }
  }

  private updateIndicator() {
    const scrollTop = 110;
    const scrollH = GAME_HEIGHT - 45 - scrollTop;

    if (this.maxScroll <= 0) {
      this.indicator.setVisible(false);
      return;
    }

    const indicatorH = Math.max(20, (scrollH / (scrollH + this.maxScroll)) * scrollH);
    this.indicator.setVisible(true).setSize(3, indicatorH);
    const ratio = -this.scrollOffset / this.maxScroll;
    this.indicator.y = scrollTop + ratio * (scrollH - indicatorH);
  }
}
