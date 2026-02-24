import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import {
  loadMeta, saveMeta, loadDungeon, clearDungeonSave,
  hasDungeonSave, deserializeSkills, deserializeInventory,
  MetaSaveData,
} from "../core/save-system";
import { DUNGEONS, DungeonDef, getUnlockedDungeons } from "../core/dungeon-data";
import { initAudio, startBgm, stopBgm } from "../core/sound-manager";

/**
 * HubScene — the town between dungeon runs.
 * Now supports multiple dungeon selection.
 */
export class HubScene extends Phaser.Scene {
  private meta!: MetaSaveData;

  constructor() {
    super({ key: "HubScene" });
  }

  init(data?: { gold?: number; cleared?: boolean; bestFloor?: number }) {
    this.meta = loadMeta();

    if (data?.gold !== undefined) {
      this.meta.gold += data.gold;
      this.meta.totalGold += data.gold;
      this.meta.totalRuns++;
      if (data.cleared) this.meta.totalClears++;
      if (data.bestFloor && data.bestFloor > this.meta.bestFloor) {
        this.meta.bestFloor = data.bestFloor;
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
      this.createButton(GAME_WIDTH / 2, y, btnW, 42,
        `Continue: ${saveName} B${save?.floor ?? "?"}F`,
        "Resume your saved run",
        "#4ade80",
        () => this.continueSave()
      );
      y += 52;
    }

    // ── Bottom fixed buttons (high depth to stay on top) ──
    const currentStarter = this.meta.starter ?? "mudkip";
    const starterName = currentStarter.charAt(0).toUpperCase() + currentStarter.slice(1);

    const fixedY = GAME_HEIGHT - 118;
    // Solid background behind fixed buttons — covers from scroll end to bottom
    const fixedBgTop = fixedY - 30;
    const fixedBgH = GAME_HEIGHT - fixedBgTop;
    this.add.rectangle(GAME_WIDTH / 2, fixedBgTop + fixedBgH / 2, GAME_WIDTH, fixedBgH, 0x1a2744).setDepth(50);

    this.createFixedButton(GAME_WIDTH / 2, fixedY, btnW, 32,
      `Starter: ${starterName}`, "Tap to change", "#f472b6",
      () => this.showStarterSelect()
    );
    this.createFixedButton(GAME_WIDTH / 2, fixedY + 36, btnW, 32,
      "Upgrade Shop", `Gold: ${this.meta.gold}`, "#fbbf24",
      () => this.scene.start("UpgradeScene")
    );
    this.createFixedButton(GAME_WIDTH / 2, fixedY + 72, btnW, 32,
      "Records", `Clears: ${this.meta.totalClears}  Best: B${this.meta.bestFloor}F`, "#60a5fa",
      () => this.showNotice(
        `Total Runs: ${this.meta.totalRuns}\nClears: ${this.meta.totalClears}\nBest Floor: B${this.meta.bestFloor}F\nTotal Gold: ${this.meta.totalGold}`
      )
    );

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 8, "v0.22.0", {
      fontSize: "8px", color: "#444460", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(51);

    // ── Scrollable dungeon list ──
    const scrollTop = y;
    const scrollBottom = fixedY - 16;
    const scrollH = scrollBottom - scrollTop;

    // Container for all dungeon buttons
    const container = this.add.container(0, 0).setDepth(10);
    let cy2 = scrollTop;

    const header = this.add.text(15, cy2, "── Dungeons ──", {
      fontSize: "10px", color: "#94a3b8", fontFamily: "monospace",
    });
    container.add(header);
    cy2 += 18;

    for (const dg of Object.values(DUNGEONS)) {
      const isUnlocked = dg.unlockClears <= this.meta.totalClears;
      const color = isUnlocked ? "#e0e0e0" : "#444460";
      const desc = isUnlocked ? dg.description : `Unlock: ${dg.unlockClears} clears needed`;

      const bg = this.add.rectangle(GAME_WIDTH / 2, cy2, btnW, 38, 0x1a1a2e, 0.9)
        .setStrokeStyle(1, isUnlocked ? 0x334155 : 0x222233);
      container.add(bg);

      if (isUnlocked) {
        const dgId = dg.id;
        bg.setInteractive({ useHandCursor: true });
        bg.on("pointerover", () => bg.setFillStyle(0x2a2a4e, 1));
        bg.on("pointerout", () => bg.setFillStyle(0x1a1a2e, 0.9));
        bg.on("pointerdown", () => this.enterDungeon(dgId));
      }

      const t1 = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 10, cy2 - 9, dg.name, {
        fontSize: "11px", color, fontFamily: "monospace", fontStyle: "bold",
      });
      const t2 = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 10, cy2 + 5, desc, {
        fontSize: "8px", color: "#666680", fontFamily: "monospace",
      });
      container.add([t1, t2]);
      cy2 += 44;
    }

    const contentH = cy2 - scrollTop;
    const maxScroll = Math.max(0, contentH - scrollH);

    // Mask for scrollable area
    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillRect(0, scrollTop, GAME_WIDTH, scrollH);
    const mask = maskShape.createGeometryMask();
    container.setMask(mask);

    // Touch/mouse scroll
    if (maxScroll > 0) {
      let dragStartY = 0;
      let scrollOffset = 0;

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

      // Scroll indicator
      const indicatorH = Math.max(20, (scrollH / contentH) * scrollH);
      const indicator = this.add.rectangle(
        GAME_WIDTH - 4, scrollTop, 3, indicatorH, 0x667eea, 0.5
      ).setOrigin(0.5, 0);

      this.time.addEvent({
        delay: 50, loop: true,
        callback: () => {
          const ratio = -scrollOffset / maxScroll;
          indicator.y = scrollTop + ratio * (scrollH - indicatorH);
        },
      });
    }
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
  ) {
    const bg = this.add.rectangle(x, y, w, h, 0x1a1a2e, 0.9)
      .setStrokeStyle(1, callback ? 0x334155 : 0x222233)
      .setDepth(51);
    if (callback) {
      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerover", () => bg.setFillStyle(0x2a2a4e, 1));
      bg.on("pointerout", () => bg.setFillStyle(0x1a1a2e, 0.9));
      bg.on("pointerdown", callback);
    }

    this.add.text(x - w / 2 + 12, y - 8, title, {
      fontSize: "11px", color, fontFamily: "monospace", fontStyle: "bold",
    }).setDepth(52);
    this.add.text(x - w / 2 + 12, y + 5, desc, {
      fontSize: "8px", color: "#666680", fontFamily: "monospace",
    }).setDepth(52);
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

    const overlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85
    ).setDepth(200).setInteractive();
    uiItems.push(overlay);

    const title = this.add.text(GAME_WIDTH / 2, 30, "── Choose Starter ──", {
      fontSize: "14px", color: "#f472b6", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(201);
    uiItems.push(title);

    // Starter options: id, name, unlock condition (clears needed)
    const starters: { id: string; name: string; unlock: number }[] = [
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
    ];

    const current = this.meta.starter ?? "mudkip";

    // Scrollable container for starters
    const scrollTop2 = 50;
    const scrollBottom2 = GAME_HEIGHT - 50;
    const scrollH2 = scrollBottom2 - scrollTop2;
    const container2 = this.add.container(0, 0).setDepth(202);
    uiItems.push(container2);

    let sy = scrollTop2 + 10;
    for (const s of starters) {
      const isUnlocked = this.meta.totalClears >= s.unlock;
      const isCurrent = s.id === current;
      const color = isCurrent ? "#fbbf24" : isUnlocked ? "#e0e0e0" : "#444460";
      const label = isCurrent ? `★ ${s.name}` : s.name;
      const desc = isUnlocked
        ? (isCurrent ? "Currently selected" : "Tap to select")
        : `Need ${s.unlock} clears (have ${this.meta.totalClears})`;

      const bg2 = this.add.rectangle(GAME_WIDTH / 2, sy, 300, 30, 0x1a1a2e, 0.95)
        .setStrokeStyle(1, isCurrent ? 0xfbbf24 : isUnlocked ? 0x334155 : 0x222233);
      container2.add(bg2);

      const nameText = this.add.text(GAME_WIDTH / 2 - 130, sy - 7, label, {
        fontSize: "11px", color, fontFamily: "monospace", fontStyle: "bold",
      });
      container2.add(nameText);

      const descText = this.add.text(GAME_WIDTH / 2 - 130, sy + 5, desc, {
        fontSize: "7px", color: "#666680", fontFamily: "monospace",
      });
      container2.add(descText);

      if (isUnlocked && !isCurrent) {
        bg2.setInteractive({ useHandCursor: true });
        bg2.on("pointerover", () => bg2.setFillStyle(0x2a2a4e, 1));
        bg2.on("pointerout", () => bg2.setFillStyle(0x1a1a2e, 0.95));
        bg2.on("pointerdown", () => {
          this.meta.starter = s.id;
          saveMeta(this.meta);
          uiItems.forEach(o => o.destroy());
          this.scene.restart();
        });
      }

      sy += 36;
    }

    // Close button inside scroll
    const closeBtn = this.add.text(GAME_WIDTH / 2, sy + 5, "[Close]", {
      fontSize: "13px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setInteractive();
    container2.add(closeBtn);
    closeBtn.on("pointerdown", () => uiItems.forEach(o => o.destroy()));

    // Mask + scroll
    const contentH2 = sy + 30 - scrollTop2;
    const maxScroll2 = Math.max(0, contentH2 - scrollH2);
    const maskShape2 = this.make.graphics({ x: 0, y: 0 });
    maskShape2.fillRect(0, scrollTop2, GAME_WIDTH, scrollH2);
    uiItems.push(maskShape2 as unknown as Phaser.GameObjects.GameObject);
    container2.setMask(maskShape2.createGeometryMask());

    if (maxScroll2 > 0) {
      let dragStart2 = 0;
      let scrollOff2 = 0;
      overlay.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
        dragStart2 = ptr.y;
      });
      this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
        if (!ptr.isDown) return;
        const dy = ptr.y - dragStart2;
        dragStart2 = ptr.y;
        scrollOff2 = Math.max(-maxScroll2, Math.min(0, scrollOff2 + dy));
        container2.y = scrollOff2;
      });
    } else {
      overlay.on("pointerdown", () => uiItems.forEach(o => o.destroy()));
    }
  }
}
