import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { loadJournal, DungeonRecord } from "../core/dungeon-journal";
import { DUNGEONS } from "../core/dungeon-data";

/**
 * JournalScene — displays the player's dungeon exploration journal.
 * Shows stats per dungeon: times entered/cleared, best floor, best time, enemies, gold, species.
 */
export class JournalScene extends Phaser.Scene {
  private scrollContainer!: Phaser.GameObjects.Container;
  private scrollOffset = 0;
  private maxScroll = 0;
  private isDragging = false;
  private dragStartY = 0;

  private readonly SCROLL_TOP = 50;
  private readonly SCROLL_BOTTOM = GAME_HEIGHT - 40;

  constructor() {
    super({ key: "JournalScene" });
  }

  create() {
    const journal = loadJournal();

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1a);

    // Title
    this.add.text(GAME_WIDTH / 2, 18, "Dungeon Journal", {
      fontSize: "15px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    // Subtitle: total dungeons explored
    const entries = Object.values(journal);
    const explored = entries.filter(r => r.timesEntered > 0).length;
    const totalDungeons = Object.keys(DUNGEONS).length;
    this.add.text(GAME_WIDTH / 2, 38, `Explored: ${explored} / ${totalDungeons}`, {
      fontSize: "10px", color: "#667eea", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Scrollable container
    this.scrollContainer = this.add.container(0, 0);

    // Build list — sort by timesEntered descending, then alphabetical
    const records = this.getSortedRecords(journal);

    let cy = this.SCROLL_TOP + 8;

    if (records.length === 0) {
      const emptyText = this.add.text(GAME_WIDTH / 2, cy + 40, "No dungeons explored yet.\nEnter a dungeon to start tracking!", {
        fontSize: "10px", color: "#64748b", fontFamily: "monospace", align: "center",
      }).setOrigin(0.5);
      this.scrollContainer.add(emptyText);
    } else {
      for (const rec of records) {
        cy = this.renderRecord(rec, cy);
        cy += 8; // gap between entries
      }
    }

    // Calculate scroll bounds
    const contentH = cy - this.SCROLL_TOP;
    const scrollH = this.SCROLL_BOTTOM - this.SCROLL_TOP;
    this.maxScroll = Math.max(0, contentH - scrollH + 16);

    // Mask for scrollable area
    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillRect(0, this.SCROLL_TOP, GAME_WIDTH, scrollH);
    const mask = maskShape.createGeometryMask();
    this.scrollContainer.setMask(mask);

    // Set up scroll input
    this.setupScrollInput();

    // Back button
    const back = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20, "[Back to Town]", {
      fontSize: "13px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setInteractive();
    back.on("pointerdown", () => this.scene.start("HubScene"));
  }

  // ────────────────────────────────────────────
  // Record Rendering
  // ────────────────────────────────────────────

  private renderRecord(rec: DungeonRecord, startY: number): number {
    const container = this.scrollContainer;
    const dungeonDef = DUNGEONS[rec.dungeonId];
    const dungeonName = dungeonDef ? dungeonDef.name : rec.dungeonId;
    const totalFloors = dungeonDef ? dungeonDef.floors : 0;

    const LEFT = 20;
    const RIGHT = GAME_WIDTH - 20;
    const CARD_W = RIGHT - LEFT;

    // Card height depends on content
    const cardH = 86;
    const cardCenterY = startY + cardH / 2;

    // Card background
    const cleared = rec.timesCleared > 0;
    const bgColor = cleared ? 0x0f1a2e : 0x12121e;
    const strokeColor = cleared ? 0x3b82f6 : 0x222244;

    const bg = this.add.rectangle(GAME_WIDTH / 2, cardCenterY, CARD_W, cardH, bgColor, 0.9)
      .setStrokeStyle(1, strokeColor);
    container.add(bg);

    // Dungeon name
    const nameColor = cleared ? "#60a5fa" : "#94a3b8";
    const nameText = this.add.text(LEFT + 8, startY + 8, dungeonName, {
      fontSize: "11px", color: nameColor, fontFamily: "monospace", fontStyle: "bold",
    });
    container.add(nameText);

    // Clear badge
    if (cleared) {
      const badge = this.add.text(RIGHT - 8, startY + 8, "CLEARED", {
        fontSize: "8px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(1, 0);
      container.add(badge);
    }

    // Row 1: Entered / Cleared
    const row1Y = startY + 26;
    const enteredText = this.add.text(LEFT + 8, row1Y, `Entered: ${rec.timesEntered}`, {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
    });
    container.add(enteredText);

    const clearedText = this.add.text(LEFT + 120, row1Y, `Cleared: ${rec.timesCleared}`, {
      fontSize: "9px", color: cleared ? "#4ade80" : "#444460", fontFamily: "monospace",
    });
    container.add(clearedText);

    // Clear rate
    const clearRate = rec.timesEntered > 0
      ? ((rec.timesCleared / rec.timesEntered) * 100).toFixed(0) + "%"
      : "---";
    const rateText = this.add.text(RIGHT - 8, row1Y, clearRate, {
      fontSize: "9px", color: "#667eea", fontFamily: "monospace",
    }).setOrigin(1, 0);
    container.add(rateText);

    // Row 2: Best floor / Best time
    const row2Y = startY + 42;
    const floorStr = rec.bestFloor > 0
      ? `Best: B${rec.bestFloor}F` + (totalFloors > 0 ? `/${totalFloors}F` : "")
      : "Best: ---";
    const floorText = this.add.text(LEFT + 8, row2Y, floorStr, {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
    });
    container.add(floorText);

    const timeStr = rec.bestTime > 0 ? `Time: ${this.formatTime(rec.bestTime)}` : "Time: ---";
    const timeText = this.add.text(RIGHT - 8, row2Y, timeStr, {
      fontSize: "9px", color: rec.bestTime > 0 ? "#fbbf24" : "#444460", fontFamily: "monospace",
    }).setOrigin(1, 0);
    container.add(timeText);

    // Row 3: Enemies defeated / Gold earned
    const row3Y = startY + 58;
    const enemyStr = `Defeated: ${this.formatNumber(rec.totalEnemiesDefeated)}`;
    const enemyText = this.add.text(LEFT + 8, row3Y, enemyStr, {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
    });
    container.add(enemyText);

    const goldStr = `Gold: ${this.formatNumber(rec.totalGoldEarned)}`;
    const goldText = this.add.text(RIGHT - 8, row3Y, goldStr, {
      fontSize: "9px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(1, 0);
    container.add(goldText);

    // Row 4: Species encountered + first clear date
    const row4Y = startY + 72;
    const speciesStr = `Species: ${rec.speciesEncountered.length}`;
    const speciesText = this.add.text(LEFT + 8, row4Y, speciesStr, {
      fontSize: "8px", color: "#667eea", fontFamily: "monospace",
    });
    container.add(speciesText);

    if (rec.firstClearDate) {
      const dateText = this.add.text(RIGHT - 8, row4Y, `1st Clear: ${rec.firstClearDate}`, {
        fontSize: "8px", color: "#4ade80", fontFamily: "monospace",
      }).setOrigin(1, 0);
      container.add(dateText);
    }

    return startY + cardH;
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
      this.scrollContainer.y = this.scrollOffset;
    });

    this.input.on("pointerup", () => {
      this.isDragging = false;
    });
  }

  // ────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────

  private getSortedRecords(journal: Record<string, DungeonRecord>): DungeonRecord[] {
    return Object.values(journal)
      .filter(r => r.timesEntered > 0)
      .sort((a, b) => {
        // Cleared dungeons first, then by timesEntered desc
        if (a.timesCleared > 0 && b.timesCleared === 0) return -1;
        if (a.timesCleared === 0 && b.timesCleared > 0) return 1;
        if (b.timesEntered !== a.timesEntered) return b.timesEntered - a.timesEntered;
        // Alphabetical fallback
        const nameA = DUNGEONS[a.dungeonId]?.name ?? a.dungeonId;
        const nameB = DUNGEONS[b.dungeonId]?.name ?? b.dungeonId;
        return nameA.localeCompare(nameB);
      });
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  private formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 10_000) return (n / 1_000).toFixed(1) + "K";
    return n.toLocaleString();
  }
}
