import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { loadMeta, saveMeta, MetaSaveData } from "../core/save-system";
import { SPECIES } from "../core/pokemon-data";
import { SKILL_DB, SkillRange } from "../core/skill";
import { getAvailableTutorMoves, TutorMove } from "../core/move-tutor";

/** Friendly range labels */
const RANGE_LABEL: Record<string, string> = {
  [SkillRange.Front1]: "1-tile",
  [SkillRange.Front2]: "2-tile",
  [SkillRange.FrontLine]: "Line",
  [SkillRange.Around]: "Around",
  [SkillRange.Room]: "Room",
  [SkillRange.Self]: "Self",
};

/** Type color map for skill type badges */
const TYPE_COLORS: Record<string, string> = {
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
};

export class MoveTutorScene extends Phaser.Scene {
  private meta!: MetaSaveData;
  private goldText!: Phaser.GameObjects.Text;
  private starterId!: string;
  private currentSkills: string[] = [];
  private availableMoves: TutorMove[] = [];

  // UI containers for dynamic refresh
  private currentSkillObjects: Phaser.GameObjects.GameObject[] = [];
  private moveListObjects: Phaser.GameObjects.GameObject[] = [];
  private confirmUI: Phaser.GameObjects.GameObject[] = [];

  // Scroll state
  private scrollContainer!: Phaser.GameObjects.Container;
  private scrollOffset = 0;
  private maxScroll = 0;
  private scrollTop = 0;
  private scrollHeight = 0;

  constructor() {
    super({ key: "MoveTutorScene" });
  }

  create() {
    this.meta = loadMeta();
    this.starterId = this.meta.starter ?? "mudkip";
    const species = SPECIES[this.starterId];
    if (!species) {
      this.scene.start("HubScene");
      return;
    }

    // Load current custom skills or default species skills
    const customSkills = this.meta.customSkills?.[this.starterId];
    if (customSkills && customSkills.length > 0) {
      this.currentSkills = [...customSkills];
    } else {
      this.currentSkills = [...species.skillIds.slice(0, 4)];
    }

    // Get available tutor moves
    this.availableMoves = getAvailableTutorMoves(this.starterId, this.meta.totalClears);

    // ── Background ──
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0f0f1a);

    // ── Title ──
    this.add.text(GAME_WIDTH / 2, 24, "Move Tutor", {
      fontSize: "16px", color: "#a855f7", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    // ── Starter info ──
    const typesStr = species.types.join(" / ");
    this.add.text(GAME_WIDTH / 2, 48, `${species.name}  (${typesStr})`, {
      fontSize: "11px", color: "#e0e0e0", fontFamily: "monospace",
    }).setOrigin(0.5);

    // ── Gold ──
    this.goldText = this.add.text(GAME_WIDTH / 2, 66, `Gold: ${this.meta.gold}`, {
      fontSize: "11px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5);

    // ── Current Skills Section ──
    this.add.text(15, 86, "Current Skills:", {
      fontSize: "10px", color: "#94a3b8", fontFamily: "monospace", fontStyle: "bold",
    });

    this.renderCurrentSkills();

    // ── Available Moves Section ──
    const availLabel = this.add.text(15, 200, "Available Moves:", {
      fontSize: "10px", color: "#94a3b8", fontFamily: "monospace", fontStyle: "bold",
    });

    // Scroll area
    this.scrollTop = 218;
    const bottomBarY = GAME_HEIGHT - 50;
    this.scrollHeight = bottomBarY - this.scrollTop - 10;

    this.scrollContainer = this.add.container(0, 0).setDepth(10);

    // Mask for scrollable area
    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillRect(0, this.scrollTop, GAME_WIDTH, this.scrollHeight);
    const geoMask = maskShape.createGeometryMask();
    this.scrollContainer.setMask(geoMask);

    this.renderMoveList();

    // ── Scroll input ──
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gos: unknown[], _dx: number, dy: number) => {
      this.scroll(dy);
    });

    let dragStartY = 0;
    let dragScrollStart = 0;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.y >= this.scrollTop && p.y <= this.scrollTop + this.scrollHeight) {
        dragStartY = p.y;
        dragScrollStart = this.scrollOffset;
      }
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.isDown && dragStartY >= this.scrollTop) {
        const dy = dragStartY - p.y;
        this.scrollTo(dragScrollStart + dy);
      }
    });

    // ── Back button ──
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 28, GAME_WIDTH, 56, 0x0f0f1a).setDepth(50);
    const backBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 30, 180, 34, 0x1a1a2e, 0.95)
      .setStrokeStyle(1, 0x334155).setInteractive({ useHandCursor: true }).setDepth(51);
    backBg.on("pointerover", () => backBg.setFillStyle(0x2a2a4e, 1));
    backBg.on("pointerout", () => backBg.setFillStyle(0x1a1a2e, 0.95));
    backBg.on("pointerdown", () => this.scene.start("HubScene"));
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, "Back to Town", {
      fontSize: "13px", color: "#60a5fa", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(51);
  }

  private scroll(dy: number) {
    this.scrollTo(this.scrollOffset + dy * 0.5);
  }

  private scrollTo(offset: number) {
    this.scrollOffset = Math.max(0, Math.min(this.maxScroll, offset));
    this.scrollContainer.setY(-this.scrollOffset);
  }

  private renderCurrentSkills() {
    // Clear old
    for (const obj of this.currentSkillObjects) obj.destroy();
    this.currentSkillObjects = [];

    for (let i = 0; i < 4; i++) {
      const y = 104 + i * 24;
      const skillId = this.currentSkills[i];

      if (skillId && SKILL_DB[skillId]) {
        const skill = SKILL_DB[skillId];
        const typeColor = TYPE_COLORS[skill.type] ?? "#a8a878";
        const rangeStr = RANGE_LABEL[skill.range] ?? skill.range;

        // Slot number
        const slotText = this.add.text(15, y, `[${i + 1}]`, {
          fontSize: "10px", color: "#666680", fontFamily: "monospace",
        });

        // Skill name
        const nameText = this.add.text(40, y, skill.name, {
          fontSize: "10px", color: typeColor, fontFamily: "monospace", fontStyle: "bold",
        });

        // Power + Range
        const infoStr = skill.power > 0 ? `Pwr:${skill.power}  ${rangeStr}` : `${rangeStr}`;
        const infoText = this.add.text(160, y, infoStr, {
          fontSize: "9px", color: "#888888", fontFamily: "monospace",
        });

        // Type badge
        const typeText = this.add.text(290, y, skill.type, {
          fontSize: "8px", color: typeColor, fontFamily: "monospace",
        });

        this.currentSkillObjects.push(slotText, nameText, infoText, typeText);
      } else {
        const slotText = this.add.text(15, y, `[${i + 1}]`, {
          fontSize: "10px", color: "#666680", fontFamily: "monospace",
        });
        const emptyText = this.add.text(40, y, "(empty)", {
          fontSize: "10px", color: "#444460", fontFamily: "monospace",
        });
        this.currentSkillObjects.push(slotText, emptyText);
      }
    }
  }

  private renderMoveList() {
    // Clear old
    this.scrollContainer.removeAll(true);
    for (const obj of this.moveListObjects) obj.destroy();
    this.moveListObjects = [];

    let cy = this.scrollTop;
    const itemH = 42;

    for (const move of this.availableMoves) {
      const skill = SKILL_DB[move.skillId];
      if (!skill) continue;

      // Skip skills the player already has
      if (this.currentSkills.includes(move.skillId)) continue;

      const typeColor = TYPE_COLORS[skill.type] ?? "#a8a878";
      const rangeStr = RANGE_LABEL[skill.range] ?? skill.range;
      const canAfford = this.meta.gold >= move.cost;

      // Background row
      const bg = this.add.rectangle(GAME_WIDTH / 2, cy + itemH / 2, GAME_WIDTH - 16, itemH - 4, 0x1a1a2e, 0.85)
        .setStrokeStyle(1, canAfford ? 0x334155 : 0x222233);
      this.scrollContainer.add(bg);

      // Skill name
      const nameText = this.add.text(18, cy + 4, skill.name, {
        fontSize: "10px", color: typeColor, fontFamily: "monospace", fontStyle: "bold",
      });
      this.scrollContainer.add(nameText);

      // Power + Range + Type
      const pwrStr = skill.power > 0 ? `Pwr:${skill.power}` : "Status";
      const detailText = this.add.text(18, cy + 20, `${pwrStr}  ${rangeStr}  ${skill.type}`, {
        fontSize: "8px", color: "#888888", fontFamily: "monospace",
      });
      this.scrollContainer.add(detailText);

      // Description (truncated)
      const descStr = skill.description.length > 30
        ? skill.description.substring(0, 28) + ".."
        : skill.description;
      const descText = this.add.text(150, cy + 4, descStr, {
        fontSize: "7px", color: "#666680", fontFamily: "monospace",
        wordWrap: { width: 180 },
      });
      this.scrollContainer.add(descText);

      // Cost
      const costText = this.add.text(GAME_WIDTH - 18, cy + 12, `${move.cost}G`, {
        fontSize: "11px",
        color: canAfford ? "#fde68a" : "#ef4444",
        fontFamily: "monospace",
        fontStyle: "bold",
      }).setOrigin(1, 0);
      this.scrollContainer.add(costText);

      // Make interactive if affordable
      if (canAfford) {
        bg.setInteractive({ useHandCursor: true });
        bg.on("pointerover", () => bg.setFillStyle(0x2a2a4e, 1));
        bg.on("pointerout", () => bg.setFillStyle(0x1a1a2e, 0.85));
        bg.on("pointerdown", () => {
          this.showLearnConfirm(move);
        });
      }

      cy += itemH;
    }

    const contentH = cy - this.scrollTop;
    this.maxScroll = Math.max(0, contentH - this.scrollHeight);
    this.scrollOffset = 0;
    this.scrollContainer.setY(0);
  }

  private showLearnConfirm(move: TutorMove) {
    // Clear any existing confirm UI
    this.clearConfirmUI();

    const skill = SKILL_DB[move.skillId];
    if (!skill) return;

    const typeColor = TYPE_COLORS[skill.type] ?? "#a8a878";

    // Overlay
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
      .setDepth(100).setInteractive();
    this.confirmUI.push(overlay);

    // Panel background
    const panelH = 280;
    const panelY = GAME_HEIGHT / 2 - 20;
    const panelBg = this.add.rectangle(GAME_WIDTH / 2, panelY, GAME_WIDTH - 30, panelH, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xa855f7).setDepth(101);
    this.confirmUI.push(panelBg);

    // Title
    const title = this.add.text(GAME_WIDTH / 2, panelY - panelH / 2 + 20, `Learn ${skill.name}?`, {
      fontSize: "14px", color: typeColor, fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(102);
    this.confirmUI.push(title);

    // Skill details
    const rangeStr = RANGE_LABEL[skill.range] ?? skill.range;
    const pwrStr = skill.power > 0 ? `Power: ${skill.power}` : "Status Move";
    const details = this.add.text(GAME_WIDTH / 2, panelY - panelH / 2 + 42, `${pwrStr}  |  ${rangeStr}  |  ${skill.type}`, {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(102);
    this.confirmUI.push(details);

    const desc = this.add.text(GAME_WIDTH / 2, panelY - panelH / 2 + 58, skill.description, {
      fontSize: "8px", color: "#666680", fontFamily: "monospace",
      wordWrap: { width: 280 },
    }).setOrigin(0.5).setDepth(102);
    this.confirmUI.push(desc);

    // Cost
    const costLabel = this.add.text(GAME_WIDTH / 2, panelY - panelH / 2 + 76, `Cost: ${move.cost}G`, {
      fontSize: "11px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(102);
    this.confirmUI.push(costLabel);

    // Prompt
    const prompt = this.add.text(GAME_WIDTH / 2, panelY - panelH / 2 + 100, "Replace which skill?", {
      fontSize: "11px", color: "#e0e0e0", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(102);
    this.confirmUI.push(prompt);

    // Show 4 skill slots to replace
    for (let i = 0; i < 4; i++) {
      const slotY = panelY - panelH / 2 + 125 + i * 32;
      const existingId = this.currentSkills[i];
      const existing = existingId ? SKILL_DB[existingId] : null;

      const slotBg = this.add.rectangle(GAME_WIDTH / 2, slotY + 8, GAME_WIDTH - 60, 28, 0x222240, 0.9)
        .setStrokeStyle(1, 0x445566).setDepth(102).setInteractive({ useHandCursor: true });
      this.confirmUI.push(slotBg);

      if (existing) {
        const existColor = TYPE_COLORS[existing.type] ?? "#a8a878";
        const existRange = RANGE_LABEL[existing.range] ?? existing.range;
        const existPwr = existing.power > 0 ? `Pwr:${existing.power}` : "Status";
        const slotText = this.add.text(30, slotY + 1, `[${i + 1}] ${existing.name}  ${existPwr}  ${existRange}`, {
          fontSize: "9px", color: existColor, fontFamily: "monospace",
        }).setDepth(103);
        this.confirmUI.push(slotText);
      } else {
        const slotText = this.add.text(30, slotY + 1, `[${i + 1}] (empty)`, {
          fontSize: "9px", color: "#444460", fontFamily: "monospace",
        }).setDepth(103);
        this.confirmUI.push(slotText);
      }

      slotBg.on("pointerover", () => slotBg.setFillStyle(0x3a3a5e, 1));
      slotBg.on("pointerout", () => slotBg.setFillStyle(0x222240, 0.9));
      slotBg.on("pointerdown", () => {
        this.learnSkill(move, i);
      });
    }

    // Cancel button
    const cancelY = panelY + panelH / 2 - 22;
    const cancelBtn = this.add.text(GAME_WIDTH / 2, cancelY, "[Cancel]", {
      fontSize: "12px", color: "#ef4444", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(102).setInteractive({ useHandCursor: true });
    this.confirmUI.push(cancelBtn);
    cancelBtn.on("pointerdown", () => this.clearConfirmUI());
  }

  private learnSkill(move: TutorMove, replaceIndex: number) {
    if (this.meta.gold < move.cost) {
      this.clearConfirmUI();
      return;
    }

    const skill = SKILL_DB[move.skillId];
    if (!skill) {
      this.clearConfirmUI();
      return;
    }

    // Deduct gold
    this.meta.gold -= move.cost;

    // Update custom skills
    if (!this.meta.customSkills) this.meta.customSkills = {};
    this.currentSkills[replaceIndex] = move.skillId;
    // Ensure we always store exactly 4 slots (or fewer if species has fewer)
    this.meta.customSkills[this.starterId] = [...this.currentSkills];

    // Save
    saveMeta(this.meta);

    // Refresh UI
    this.clearConfirmUI();
    this.goldText.setText(`Gold: ${this.meta.gold}`);
    this.renderCurrentSkills();
    this.renderMoveList();
    this.scrollTo(0);
  }

  private clearConfirmUI() {
    for (const obj of this.confirmUI) obj.destroy();
    this.confirmUI = [];
  }
}
