import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { loadMeta, saveMeta, MetaSaveData } from "../core/save-system";
import {
  TalentCategory,
  TalentNode,
  TALENT_CATEGORY_COLORS,
  TALENT_CATEGORY_BG,
  getAllTalents,
  getTalentEffect,
  canUpgradeTalent,
  getUpgradeCost,
  getTotalTalentPoints,
  getTotalGoldInvested,
} from "../core/talent-tree";

/**
 * TalentTreeScene — persistent talent tree for investing gold into permanent bonuses.
 * Displays a 4-column layout (one per category) with scrollable talent nodes.
 */
export class TalentTreeScene extends Phaser.Scene {
  private meta!: MetaSaveData;
  private goldText!: Phaser.GameObjects.Text;
  private pointsText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "TalentTreeScene" });
  }

  create() {
    this.meta = loadMeta();

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0f0f1a);

    // Title
    this.add.text(GAME_WIDTH / 2, 22, "Talent Tree", {
      fontSize: "16px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    // Gold display
    this.goldText = this.add.text(GAME_WIDTH / 2, 44, `Gold: ${this.meta.gold}`, {
      fontSize: "12px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Total talent points
    const totalPoints = getTotalTalentPoints(this.meta.talentLevels ?? {});
    const totalInvested = getTotalGoldInvested(this.meta.talentLevels ?? {});
    this.pointsText = this.add.text(GAME_WIDTH / 2, 60, `Talent Points: ${totalPoints}  |  Invested: ${totalInvested}G`, {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Decorative line
    this.add.rectangle(GAME_WIDTH / 2, 72, GAME_WIDTH - 40, 1, 0x334155, 0.5);

    // ── Talent Grid ──
    const allTalents = getAllTalents();
    const categories = [
      TalentCategory.Offense,
      TalentCategory.Defense,
      TalentCategory.Utility,
      TalentCategory.Exploration,
    ];

    // Scrollable container
    const scrollTop = 78;
    const scrollBottom = GAME_HEIGHT - 55;
    const scrollH = scrollBottom - scrollTop;

    const container = this.add.container(0, 0).setDepth(10);

    // Mask for scrollable area
    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillRect(0, scrollTop, GAME_WIDTH, scrollH);
    const geoMask = maskShape.createGeometryMask();
    container.setMask(geoMask);

    // Scroll state
    let scrollOffset = 0;
    let maxScroll = 0;

    // Scroll indicator
    const indicator = this.add.rectangle(
      GAME_WIDTH - 4, scrollTop, 3, 20, 0x667eea, 0.5
    ).setOrigin(0.5, 0).setDepth(11).setVisible(false);

    const updateIndicator = () => {
      if (maxScroll <= 0) { indicator.setVisible(false); return; }
      indicator.setVisible(true);
      const indicatorH = Math.max(20, (scrollH / contentH) * scrollH);
      indicator.setSize(3, indicatorH);
      const ratio = -scrollOffset / maxScroll;
      indicator.y = scrollTop + ratio * (scrollH - indicatorH);
    };

    let contentH = 0;

    const renderTalents = () => {
      container.removeAll(true);
      let cy = scrollTop + 4;

      for (const category of categories) {
        const catTalents = allTalents.filter(t => t.category === category);
        const catColor = TALENT_CATEGORY_COLORS[category];
        const catBg = TALENT_CATEGORY_BG[category];

        // Category header
        const headerBg = this.add.rectangle(GAME_WIDTH / 2, cy + 10, GAME_WIDTH - 16, 24, catBg, 0.9)
          .setStrokeStyle(1, parseInt(catColor.replace("#", ""), 16), 0.6);
        container.add(headerBg);

        const headerText = this.add.text(GAME_WIDTH / 2, cy + 10, category, {
          fontSize: "11px", color: catColor, fontFamily: "monospace", fontStyle: "bold",
        }).setOrigin(0.5);
        container.add(headerText);

        cy += 28;

        // Talent rows
        for (const talent of catTalents) {
          const level = (this.meta.talentLevels ?? {})[talent.id] ?? 0;
          const isMaxed = level >= talent.maxLevel;
          const canUpgrade = canUpgradeTalent(talent.id, level, this.meta);
          const cost = isMaxed ? 0 : getUpgradeCost(talent.id, level);

          // Row background
          const rowH = 52;
          const rowBg = this.add.rectangle(GAME_WIDTH / 2, cy + rowH / 2, GAME_WIDTH - 20, rowH, 0x111122, 0.85)
            .setStrokeStyle(1, canUpgrade ? 0x4ade80 : 0x222233);
          container.add(rowBg);

          // Talent name
          const nameText = this.add.text(16, cy + 4, talent.name, {
            fontSize: "10px", color: isMaxed ? "#fbbf24" : "#e0e0e0",
            fontFamily: "monospace", fontStyle: "bold",
          });
          container.add(nameText);

          // Level stars
          let starStr = "";
          for (let i = 1; i <= talent.maxLevel; i++) {
            starStr += i <= level ? "\u2605" : "\u2606";
          }
          // For talents with many levels, use compact display
          const levelDisplay = talent.maxLevel > 5
            ? `${"★".repeat(Math.min(level, 5))}${"☆".repeat(Math.min(talent.maxLevel - level, 5))} ${level}/${talent.maxLevel}`
            : starStr;
          const starText = this.add.text(16, cy + 18, levelDisplay, {
            fontSize: "9px", color: "#fbbf24", fontFamily: "monospace",
          });
          container.add(starText);

          // Description with current effect value
          const effects = getTalentEffect(talent.id, level);
          const effectStr = level > 0
            ? Object.entries(effects).map(([, v]) =>
              typeof v === "number" && v % 1 !== 0 ? v.toFixed(2) : String(v)
            ).join(", ")
            : "0";
          const descText = this.add.text(16, cy + 32, `${talent.description} (now: ${effectStr})`, {
            fontSize: "8px", color: "#666680", fontFamily: "monospace",
          });
          container.add(descText);

          // Cost / Upgrade button (right side)
          if (isMaxed) {
            const maxLabel = this.add.text(GAME_WIDTH - 20, cy + 12, "MAX", {
              fontSize: "11px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
            }).setOrigin(1, 0);
            container.add(maxLabel);
          } else {
            const costColor = canUpgrade ? "#4ade80" : "#ef4444";
            const costLabel = this.add.text(GAME_WIDTH - 20, cy + 6, `${cost}G`, {
              fontSize: "10px", color: costColor, fontFamily: "monospace",
            }).setOrigin(1, 0);
            container.add(costLabel);

            if (canUpgrade) {
              const upgradeBtn = this.add.text(GAME_WIDTH - 20, cy + 22, "[Upgrade]", {
                fontSize: "9px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
              }).setOrigin(1, 0);
              container.add(upgradeBtn);

              // Make the whole row tappable
              rowBg.setInteractive({ useHandCursor: true });
              rowBg.on("pointerover", () => rowBg.setFillStyle(0x1a1a33, 1));
              rowBg.on("pointerout", () => rowBg.setFillStyle(0x111122, 0.85));
              rowBg.on("pointerup", (ptr: Phaser.Input.Pointer) => {
                if (ptr.getDistance() > 10) return; // scroll, not tap
                this.upgradeTalent(talent.id);
                const prevScroll = scrollOffset;
                renderTalents();
                scrollOffset = Math.max(-maxScroll, Math.min(0, prevScroll));
                container.y = scrollOffset;
                updateIndicator();
              });
            }
          }

          cy += rowH + 4;
        }

        cy += 8; // gap between categories
      }

      contentH = cy - scrollTop;
      maxScroll = Math.max(0, contentH - scrollH);
      updateIndicator();
    };

    renderTalents();

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

    // Back button
    this.addBackButton();
  }

  private upgradeTalent(talentId: string) {
    const level = (this.meta.talentLevels ?? {})[talentId] ?? 0;
    if (!canUpgradeTalent(talentId, level, this.meta)) return;

    const cost = getUpgradeCost(talentId, level);
    this.meta.gold -= cost;
    if (!this.meta.talentLevels) this.meta.talentLevels = {};
    this.meta.talentLevels[talentId] = level + 1;
    saveMeta(this.meta);

    // Update HUD texts
    this.goldText.setText(`Gold: ${this.meta.gold}`);
    const totalPoints = getTotalTalentPoints(this.meta.talentLevels);
    const totalInvested = getTotalGoldInvested(this.meta.talentLevels);
    this.pointsText.setText(`Talent Points: ${totalPoints}  |  Invested: ${totalInvested}G`);

    // Subtle gold pulse on the gold text instead of full-screen flash
    this.tweens.add({
      targets: this.goldText,
      scaleX: { from: 1, to: 1.2 },
      scaleY: { from: 1, to: 1.2 },
      duration: 150,
      yoyo: true,
    });
  }

  private addBackButton() {
    const backBtn = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 30, 200, 36, 0x1a1a2e, 0.9)
      .setStrokeStyle(1, 0x334155)
      .setInteractive({ useHandCursor: true });

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, "[ Back to Town ]", {
      fontSize: "13px", color: "#60a5fa", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    backBtn.on("pointerover", () => backBtn.setFillStyle(0x2a2a4e, 1));
    backBtn.on("pointerout", () => backBtn.setFillStyle(0x1a1a2e, 0.9));
    backBtn.on("pointerdown", () => this.scene.start("HubScene"));
  }
}
