import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import {
  loadMeta, saveMeta, loadDungeon, clearDungeonSave,
  hasDungeonSave, deserializeSkills, deserializeInventory,
  MetaSaveData,
} from "../core/save-system";

/**
 * HubScene — the town between dungeon runs.
 * Facilities: Dungeon entrance, Storage, Records, Upgrades.
 */
export class HubScene extends Phaser.Scene {
  private meta!: MetaSaveData;

  constructor() {
    super({ key: "HubScene" });
  }

  init(data?: { gold?: number; cleared?: boolean; bestFloor?: number }) {
    this.meta = loadMeta();

    // Apply rewards from completed run
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
    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a2744);

    // Ground
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 120, GAME_WIDTH, 240, 0x2d5a27);

    // Sky gradient effect (top)
    const skyGrad = this.add.graphics();
    skyGrad.fillGradientStyle(0x0a1628, 0x0a1628, 0x1a3a5c, 0x1a3a5c, 1);
    skyGrad.fillRect(0, 0, GAME_WIDTH, 200);

    // Stars
    for (let i = 0; i < 30; i++) {
      const sx = Math.random() * GAME_WIDTH;
      const sy = Math.random() * 180;
      const size = Math.random() * 2 + 1;
      const star = this.add.circle(sx, sy, size, 0xffffff, Math.random() * 0.5 + 0.3);
      this.tweens.add({
        targets: star,
        alpha: { from: star.alpha, to: star.alpha * 0.3 },
        duration: 1000 + Math.random() * 2000,
        yoyo: true, repeat: -1,
      });
    }

    // Title
    this.add.text(GAME_WIDTH / 2, 40, "Pokemon Square", {
      fontSize: "18px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    // Gold display
    this.add.text(GAME_WIDTH / 2, 70, `Gold: ${this.meta.gold}`, {
      fontSize: "12px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Records
    this.add.text(GAME_WIDTH / 2, 90, `Runs: ${this.meta.totalRuns}  Clears: ${this.meta.totalClears}  Best: B${this.meta.bestFloor}F`, {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5);

    // ── Facility Buttons ──
    const btnWidth = 300;
    const btnStartY = 160;
    const btnGap = 70;

    // 1. Dungeon entrance
    const hasSave = hasDungeonSave();
    this.createFacilityButton(
      GAME_WIDTH / 2, btnStartY,
      "Beach Cave",
      hasSave ? "Continue from saved floor" : "Enter the dungeon (B1F~B5F)",
      "🏔️",
      () => this.enterDungeon(),
      btnWidth
    );

    // 2. Continue from save (if exists)
    if (hasSave) {
      this.createFacilityButton(
        GAME_WIDTH / 2, btnStartY + btnGap,
        "Continue Saved Run",
        "Resume where you left off",
        "💾",
        () => this.continueSave(),
        btnWidth
      );
    }

    // 3. Upgrades
    const upgradeY = hasSave ? btnStartY + btnGap * 2 : btnStartY + btnGap;
    this.createFacilityButton(
      GAME_WIDTH / 2, upgradeY,
      "Upgrade Shop",
      "Spend gold on permanent upgrades",
      "⚒️",
      () => this.openUpgradeShop(),
      btnWidth
    );

    // 4. Storage
    this.createFacilityButton(
      GAME_WIDTH / 2, upgradeY + btnGap,
      "Storage",
      "Store items between runs",
      "📦",
      () => this.openStorage(),
      btnWidth
    );

    // 5. Records
    this.createFacilityButton(
      GAME_WIDTH / 2, upgradeY + btnGap * 2,
      "Records",
      "View your adventure log",
      "📖",
      () => this.showRecords(),
      btnWidth
    );

    // Version info
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20, "v0.3.0 — Phase 3", {
      fontSize: "9px", color: "#444460", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Mudkip sprite at the hub (if loaded)
    this.load.once("complete", () => this.addHubMudkip());
    if (this.textures.exists("mudkip-idle")) {
      this.addHubMudkip();
    }
  }

  private addHubMudkip() {
    if (!this.textures.exists("mudkip-idle")) return;
    const sprite = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT - 170, "mudkip-idle");
    sprite.setScale(3);
    if (this.anims.exists("mudkip-idle-0")) {
      sprite.play("mudkip-idle-0");
    }
    // Gentle bobbing
    this.tweens.add({
      targets: sprite,
      y: sprite.y - 4,
      duration: 1200, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
    });
  }

  private createFacilityButton(
    x: number, y: number,
    title: string, desc: string, icon: string,
    callback: () => void, width: number
  ) {
    const bg = this.add.rectangle(x, y, width, 50, 0x1a1a2e, 0.9)
      .setStrokeStyle(1, 0x334155)
      .setInteractive({ useHandCursor: true });

    this.add.text(x - width / 2 + 12, y - 12, `${icon} ${title}`, {
      fontSize: "13px", color: "#e0e0e0", fontFamily: "monospace", fontStyle: "bold",
    });

    this.add.text(x - width / 2 + 12, y + 6, desc, {
      fontSize: "9px", color: "#666680", fontFamily: "monospace",
    });

    bg.on("pointerover", () => bg.setFillStyle(0x2a2a4e, 1));
    bg.on("pointerout", () => bg.setFillStyle(0x1a1a2e, 0.9));
    bg.on("pointerdown", callback);
  }

  private enterDungeon() {
    // Start a new dungeon run
    clearDungeonSave();
    this.meta.totalRuns++;
    saveMeta(this.meta);

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(450, () => {
      this.scene.start("DungeonScene", { floor: 1, fromHub: true });
    });
  }

  private continueSave() {
    const save = loadDungeon();
    if (!save) {
      // Save corrupted — start fresh
      clearDungeonSave();
      this.enterDungeon();
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
      });
    });
  }

  private openUpgradeShop() {
    this.scene.start("UpgradeScene");
  }

  private openStorage() {
    // TODO: Phase 3-3
    this.showNotice("Storage coming soon!");
  }

  private showRecords() {
    this.showNotice(
      `Total Runs: ${this.meta.totalRuns}\n` +
      `Clears: ${this.meta.totalClears}\n` +
      `Best Floor: B${this.meta.bestFloor}F\n` +
      `Total Gold: ${this.meta.totalGold}`
    );
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

    const cleanup = () => {
      overlay.destroy();
      text.destroy();
      close.destroy();
    };
    close.on("pointerdown", cleanup);
    overlay.on("pointerdown", cleanup);
  }
}
