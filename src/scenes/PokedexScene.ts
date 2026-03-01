import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { loadMeta } from "../core/save-system";
import { SPECIES, PokemonSpecies, LEVELUP_SKILLS } from "../core/pokemon-data";
import { PokemonType } from "../core/type-chart";
import { SKILL_DB } from "../core/skill";
import { getEvolutionChain, hasEvolutionChain, EvolutionNode } from "../core/evolution-chain";
import { SPRITE_DEX } from "../core/sprite-map";

/** Color map for Pokemon types */
const TYPE_COLORS: Record<string, string> = {
  Water: "#6390F0",
  Fire: "#EE8130",
  Grass: "#7AC74C",
  Electric: "#F7D02C",
  Poison: "#A33EA1",
  Ground: "#E2BF65",
  Rock: "#B6A136",
  Bug: "#A6B91A",
  Fighting: "#C22E28",
  Steel: "#B7B7CE",
  Ghost: "#735797",
  Psychic: "#F95587",
  Ice: "#96D9D6",
  Dark: "#705746",
  Fairy: "#D685AD",
  Dragon: "#6F35FC",
  Flying: "#A98FF3",
  Normal: "#A8A77A",
};

/**
 * PokedexScene — shows all Pokemon species in the game.
 * Uses optimized virtual scrolling: data binding only on row boundary change,
 * position-only updates on sub-row scroll for smooth 60fps on mobile.
 */
export class PokedexScene extends Phaser.Scene {
  constructor() {
    super({ key: "PokedexScene" });
  }

  create() {
    const meta = loadMeta();
    const seenSet = new Set(meta.pokemonSeen ?? []);
    const usedSet = new Set(meta.pokemonUsed ?? []);

    // Build sorted species list (by Pokedex number)
    const allSpecies: PokemonSpecies[] = Object.values(SPECIES);
    allSpecies.sort((a, b) => {
      const dexA = parseInt(SPRITE_DEX[a.id] ?? "9999", 10);
      const dexB = parseInt(SPRITE_DEX[b.id] ?? "9999", 10);
      return dexA - dexB;
    });

    const totalCount = allSpecies.length;
    const seenCount = allSpecies.filter(sp => seenSet.has(sp.id)).length;

    // ── Detail overlay state ──
    let detailOpen = false;
    let detailObjects: Phaser.GameObjects.GameObject[] = [];

    // ── Background ──
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1a);

    // ── Title ──
    this.add.text(GAME_WIDTH / 2, 20, "Pokemon Codex", {
      fontSize: "16px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    // ── Seen count ──
    this.add.text(GAME_WIDTH / 2, 40, `Seen: ${seenCount} / ${totalCount}`, {
      fontSize: "10px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5);

    // ── Progress bar ──
    const barW = 280;
    const progress = totalCount > 0 ? seenCount / totalCount : 0;
    this.add.rectangle(GAME_WIDTH / 2, 53, barW, 4, 0x222244);
    if (progress > 0) {
      this.add.rectangle(
        GAME_WIDTH / 2 - barW / 2 + (barW * progress) / 2, 53,
        barW * progress, 4, 0x667eea
      );
    }

    // ── Filter tabs ──
    type FilterMode = "all" | "seen" | "used";
    let filterMode: FilterMode = "all";

    const filterY = 68;
    const tabW = 90;
    const tabLabels: { mode: FilterMode; label: string }[] = [
      { mode: "all", label: "All" },
      { mode: "seen", label: "Seen" },
      { mode: "used", label: "Used" },
    ];

    const tabBgs: Phaser.GameObjects.Rectangle[] = [];
    const tabTexts: Phaser.GameObjects.Text[] = [];

    for (let i = 0; i < tabLabels.length; i++) {
      const tx = GAME_WIDTH / 2 + (i - 1) * (tabW + 4);
      const bg = this.add.rectangle(tx, filterY, tabW, 18, 0x1a1a2e, 0.95)
        .setStrokeStyle(1, 0x334155).setInteractive({ useHandCursor: true });
      const txt = this.add.text(tx, filterY, tabLabels[i].label, {
        fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
      }).setOrigin(0.5);
      tabBgs.push(bg);
      tabTexts.push(txt);

      const mode = tabLabels[i].mode;
      bg.on("pointerdown", () => {
        if (detailOpen) return;
        filterMode = mode;
        updateTabs();
        rebuildFilteredList();
        scrollOffset = 0;
        lastStartIdx = -1;
        renderVisible();
      });
    }

    const updateTabs = () => {
      for (let i = 0; i < tabLabels.length; i++) {
        const active = tabLabels[i].mode === filterMode;
        tabBgs[i].setFillStyle(active ? 0x2a2a4e : 0x1a1a2e, 0.95);
        tabBgs[i].setStrokeStyle(1, active ? 0x667eea : 0x334155);
        tabTexts[i].setColor(active ? "#667eea" : "#94a3b8");
      }
    };
    updateTabs();

    // ── Virtual scroll setup ──
    const scrollTop = 82;
    const scrollBottom = GAME_HEIGHT - 62;
    const scrollH = scrollBottom - scrollTop;
    const ITEM_H = 32;
    const POOL_SIZE = Math.ceil(scrollH / ITEM_H) + 2;

    // Mask for scroll area
    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillRect(0, scrollTop, GAME_WIDTH, scrollH);
    const mask = maskShape.createGeometryMask();

    // Object pool — each row has fixed game objects, rebound on visible range change
    const poolContainer = this.add.container(0, 0).setMask(mask);

    interface PoolRow {
      bg: Phaser.GameObjects.Rectangle;
      idxText: Phaser.GameObjects.Text;
      nameText: Phaser.GameObjects.Text;
      typeText: Phaser.GameObjects.Text;
      statsText: Phaser.GameObjects.Text;
      starIcon: Phaser.GameObjects.Text;
      boundIdx: number; // currently bound data index (-1 = unbound)
    }

    const pool: PoolRow[] = [];

    for (let i = 0; i < POOL_SIZE; i++) {
      const bg = this.add.rectangle(GAME_WIDTH / 2, 0, 340, ITEM_H - 2, 0x1a1a2e, 0.9)
        .setStrokeStyle(1, 0x222233);
      const idxText = this.add.text(12, 0, "", {
        fontSize: "8px", color: "#555570", fontFamily: "monospace",
      });
      const nameText = this.add.text(50, 0, "", {
        fontSize: "10px", color: "#e0e0e0", fontFamily: "monospace", fontStyle: "bold",
      });
      const typeText = this.add.text(180, 0, "", {
        fontSize: "8px", color: "#94a3b8", fontFamily: "monospace",
      });
      const statsText = this.add.text(268, 0, "", {
        fontSize: "8px", color: "#777790", fontFamily: "monospace",
      });
      const starIcon = this.add.text(40, 0, "", {
        fontSize: "9px", color: "#fbbf24", fontFamily: "monospace",
      });
      poolContainer.add([bg, idxText, nameText, typeText, statsText, starIcon]);
      pool.push({ bg, idxText, nameText, typeText, statsText, starIcon, boundIdx: -1 });
    }

    // Cached filtered list — only rebuilt on filter change
    let filteredList: PokemonSpecies[] = allSpecies;

    const rebuildFilteredList = () => {
      switch (filterMode) {
        case "seen":
          filteredList = allSpecies.filter(sp => seenSet.has(sp.id));
          break;
        case "used":
          filteredList = allSpecies.filter(sp => usedSet.has(sp.id));
          break;
        default:
          filteredList = allSpecies;
          break;
      }
    };

    let scrollOffset = 0;
    let maxScroll = 0;
    let lastStartIdx = -1;

    /** Bind data to a pool row (expensive — calls setText). Only when dataIdx changes. */
    const bindRowData = (row: PoolRow, dataIdx: number) => {
      if (row.boundIdx === dataIdx) return; // already bound to this data
      row.boundIdx = dataIdx;

      if (dataIdx < 0 || dataIdx >= filteredList.length) {
        row.bg.setVisible(false);
        row.idxText.setVisible(false);
        row.nameText.setVisible(false);
        row.typeText.setVisible(false);
        row.statsText.setVisible(false);
        row.starIcon.setVisible(false);
        return;
      }

      const sp = filteredList[dataIdx];
      const isSeen = seenSet.has(sp.id);
      const isUsed = usedSet.has(sp.id);

      row.bg.setVisible(true);
      row.idxText.setVisible(true);
      row.nameText.setVisible(true);
      row.typeText.setVisible(true);
      row.statsText.setVisible(true);
      row.starIcon.setVisible(true);

      if (isSeen) {
        const dexNum = SPRITE_DEX[sp.id] ?? "????";
        row.idxText.setText(dexNum).setColor("#555570");
        row.nameText.setText(sp.name).setColor("#e0e0e0");
        const typeStr = sp.types.join("/");
        const primaryTypeColor = TYPE_COLORS[sp.types[0]] ?? "#94a3b8";
        row.typeText.setText(typeStr).setColor(primaryTypeColor);
        const bs = sp.baseStats;
        row.statsText.setText(`${bs.hp}/${bs.atk}/${bs.def}`).setColor("#777790");
        row.bg.setStrokeStyle(1, isUsed ? 0x4ade80 : 0x222233);
        row.starIcon.setText(isUsed ? "\u2605" : "");
      } else {
        row.idxText.setText("????").setColor("#333350");
        row.nameText.setText("???").setColor("#333350");
        row.typeText.setText("???").setColor("#333350");
        row.statsText.setText("??/??/??").setColor("#333350");
        row.bg.setStrokeStyle(1, 0x222233);
        row.starIcon.setText("");
      }
    };

    /** Update Y positions of a pool row (cheap — no setText). */
    const updateRowY = (row: PoolRow, centerY: number) => {
      row.bg.setY(centerY);
      row.idxText.setY(centerY - 4);
      row.nameText.setY(centerY - 6);
      row.typeText.setY(centerY - 6);
      row.statsText.setY(centerY - 6);
      row.starIcon.setY(centerY - 5);
    };

    const renderVisible = () => {
      const totalH = filteredList.length * ITEM_H;
      maxScroll = Math.max(0, totalH - scrollH);
      scrollOffset = Math.min(scrollOffset, maxScroll);

      const startIdx = Math.floor(scrollOffset / ITEM_H);
      const rangeChanged = startIdx !== lastStartIdx;

      for (let i = 0; i < POOL_SIZE; i++) {
        const dataIdx = startIdx + i;
        const yPos = scrollTop + 10 + dataIdx * ITEM_H - scrollOffset;

        if (rangeChanged) {
          bindRowData(pool[i], dataIdx);
        }
        updateRowY(pool[i], yPos);
      }

      lastStartIdx = startIdx;

      // Update scroll indicator
      if (maxScroll > 0) {
        scrollIndicator.setVisible(true);
        const indicatorH = Math.max(20, (scrollH / totalH) * scrollH);
        scrollIndicator.setSize(3, indicatorH);
        const ratio = maxScroll > 0 ? scrollOffset / maxScroll : 0;
        scrollIndicator.y = scrollTop + ratio * (scrollH - indicatorH);
      } else {
        scrollIndicator.setVisible(false);
      }
    };

    // Scroll indicator
    const scrollIndicator = this.add.rectangle(
      GAME_WIDTH - 4, scrollTop, 3, 20, 0x667eea, 0.5
    ).setOrigin(0.5, 0).setVisible(false);

    // Initial render
    renderVisible();

    // ── Scroll handling (with tap detection) ──
    let dragStartY = 0;
    let dragStartX = 0;
    let isDragging = false;
    let dragDistance = 0;
    const TAP_THRESHOLD = 6;

    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (detailOpen) return;
      if (ptr.y >= scrollTop && ptr.y <= scrollBottom) {
        dragStartY = ptr.y;
        dragStartX = ptr.x;
        isDragging = true;
        dragDistance = 0;
      }
    });

    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      if (detailOpen) return;
      if (!ptr.isDown || !isDragging) return;
      const dy = ptr.y - dragStartY;
      dragDistance += Math.abs(dy) + Math.abs(ptr.x - dragStartX);
      dragStartY = ptr.y;
      dragStartX = ptr.x;
      scrollOffset = Math.max(0, Math.min(maxScroll, scrollOffset - dy));
      renderVisible();
    });

    this.input.on("pointerup", (ptr: Phaser.Input.Pointer) => {
      if (detailOpen) return;
      if (isDragging && dragDistance < TAP_THRESHOLD) {
        handleRowTap(ptr.y);
      }
      isDragging = false;
    });

    // ── Row tap handler ──
    const handleRowTap = (tapY: number) => {
      if (tapY < scrollTop || tapY > scrollBottom) return;
      const relY = tapY - scrollTop + scrollOffset - 10;
      const dataIdx = Math.floor(relY / ITEM_H);
      if (dataIdx < 0 || dataIdx >= filteredList.length) return;
      const sp = filteredList[dataIdx];
      if (!seenSet.has(sp.id)) return;
      openDetailPanel(sp);
    };

    // ── Column header ──
    this.add.rectangle(GAME_WIDTH / 2, scrollTop - 4, 340, 12, 0x0a0a1a);
    this.add.text(12, scrollTop - 8, "#", {
      fontSize: "7px", color: "#555570", fontFamily: "monospace",
    });
    this.add.text(50, scrollTop - 8, "Name", {
      fontSize: "7px", color: "#555570", fontFamily: "monospace",
    });
    this.add.text(180, scrollTop - 8, "Type", {
      fontSize: "7px", color: "#555570", fontFamily: "monospace",
    });
    this.add.text(268, scrollTop - 8, "HP/ATK/DEF", {
      fontSize: "7px", color: "#555570", fontFamily: "monospace",
    });

    // ── Back button (above scroll area, with bg to prevent bleed-through) ──
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 30, GAME_WIDTH, 50, 0x0a0a1a).setDepth(50);
    const backBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 30, 180, 34, 0x1a1a2e, 0.95)
      .setStrokeStyle(1, 0x334155).setInteractive({ useHandCursor: true }).setDepth(51);
    backBg.on("pointerover", () => backBg.setFillStyle(0x2a2a4e, 1));
    backBg.on("pointerout", () => backBg.setFillStyle(0x1a1a2e, 0.95));
    backBg.on("pointerdown", () => {
      if (detailOpen) return;
      this.scene.start("HubScene");
    });
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, "Back to Town", {
      fontSize: "13px", color: "#60a5fa", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(52);

    // ═══════════════════════════════════════════════════════
    // ── Detail Panel (overlay) ──
    // ═══════════════════════════════════════════════════════

    const closeDetail = () => {
      for (const obj of detailObjects) {
        obj.destroy();
      }
      detailObjects = [];
      detailOpen = false;
    };

    const openDetailPanel = (sp: PokemonSpecies) => {
      if (detailOpen) closeDetail();
      detailOpen = true;

      const panelW = 330;
      const panelH = 520;
      const panelX = GAME_WIDTH / 2;
      const panelY = GAME_HEIGHT / 2;

      // Semi-transparent dark background overlay
      const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
        .setInteractive()
        .setDepth(100);
      overlay.on("pointerdown", () => closeDetail());
      detailObjects.push(overlay);

      // Main panel
      const panelBg = this.add.rectangle(panelX, panelY, panelW, panelH, 0x111122, 0.98)
        .setStrokeStyle(2, 0x667eea)
        .setDepth(101)
        .setInteractive(); // prevent click-through
      detailObjects.push(panelBg);

      let curY = panelY - panelH / 2 + 20;
      const leftX = panelX - panelW / 2 + 16;
      const centerX = panelX;

      // ── Pokemon Name (large) ──
      const nameText = this.add.text(centerX, curY, sp.name, {
        fontSize: "18px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setDepth(102);
      detailObjects.push(nameText);
      curY += 24;

      // ── Types with colors ──
      const typeStr = sp.types.join(" / ");
      const primaryColor = TYPE_COLORS[sp.types[0]] ?? "#94a3b8";
      const typeLabel = this.add.text(centerX, curY, typeStr, {
        fontSize: "11px", color: primaryColor, fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setDepth(102);
      detailObjects.push(typeLabel);
      curY += 20;

      // ── Base Stats ──
      const bs = sp.baseStats;
      const statsLabel = this.add.text(centerX, curY, `HP: ${bs.hp}  ATK: ${bs.atk}  DEF: ${bs.def}`, {
        fontSize: "10px", color: "#e0e0e0", fontFamily: "monospace",
      }).setOrigin(0.5).setDepth(102);
      detailObjects.push(statsLabel);
      curY += 14;

      // ── Stat bars ──
      const barMaxW = 120;
      const barH = 6;
      const statEntries: { label: string; value: number; max: number; color: number }[] = [
        { label: "HP", value: bs.hp, max: 80, color: 0x4ade80 },
        { label: "ATK", value: bs.atk, max: 30, color: 0xef4444 },
        { label: "DEF", value: bs.def, max: 20, color: 0x60a5fa },
      ];
      for (const stat of statEntries) {
        const lbl = this.add.text(leftX, curY, stat.label, {
          fontSize: "8px", color: "#94a3b8", fontFamily: "monospace",
        }).setDepth(102);
        detailObjects.push(lbl);

        const barStartX = leftX + 30;
        const barBg2 = this.add.rectangle(barStartX + barMaxW / 2, curY + 3, barMaxW, barH, 0x222244)
          .setDepth(102);
        detailObjects.push(barBg2);

        const ratio = Math.min(1, stat.value / stat.max);
        if (ratio > 0) {
          const fillW = barMaxW * ratio;
          const barFill = this.add.rectangle(barStartX + fillW / 2, curY + 3, fillW, barH, stat.color)
            .setDepth(102);
          detailObjects.push(barFill);
        }

        const valText = this.add.text(barStartX + barMaxW + 6, curY, String(stat.value), {
          fontSize: "8px", color: "#e0e0e0", fontFamily: "monospace",
        }).setDepth(102);
        detailObjects.push(valText);
        curY += 14;
      }
      curY += 4;

      // ── Known Skills ──
      const sectionLabel1 = this.add.text(leftX, curY, "-- Skills --", {
        fontSize: "9px", color: "#667eea", fontFamily: "monospace", fontStyle: "bold",
      }).setDepth(102);
      detailObjects.push(sectionLabel1);
      curY += 14;

      const shownSkills = new Set<string>();
      for (const skillId of sp.skillIds) {
        const skillDef = SKILL_DB[skillId];
        if (!skillDef) continue;
        shownSkills.add(skillId);
        const skillColor = TYPE_COLORS[skillDef.type] ?? "#94a3b8";
        const skillLine = this.add.text(leftX + 4, curY, `${skillDef.name} (${skillDef.type}, Pow:${skillDef.power})`, {
          fontSize: "8px", color: skillColor, fontFamily: "monospace",
        }).setDepth(102);
        detailObjects.push(skillLine);
        curY += 12;
      }

      // Levelup skills
      const levelupMap = LEVELUP_SKILLS[sp.id];
      if (levelupMap) {
        for (const [lvl, skillId] of Object.entries(levelupMap)) {
          if (shownSkills.has(skillId)) continue;
          shownSkills.add(skillId);
          const skillDef = SKILL_DB[skillId];
          if (!skillDef) continue;
          const skillColor = TYPE_COLORS[skillDef.type] ?? "#94a3b8";
          const skillLine = this.add.text(leftX + 4, curY, `Lv${lvl}: ${skillDef.name} (${skillDef.type})`, {
            fontSize: "8px", color: skillColor, fontFamily: "monospace",
          }).setDepth(102);
          detailObjects.push(skillLine);
          curY += 12;
        }
      }
      curY += 6;

      // ── Evolution Chain ──
      const sectionLabel2 = this.add.text(leftX, curY, "-- Evolution Chain --", {
        fontSize: "9px", color: "#667eea", fontFamily: "monospace", fontStyle: "bold",
      }).setDepth(102);
      detailObjects.push(sectionLabel2);
      curY += 16;

      if (hasEvolutionChain(sp.id)) {
        const chain = getEvolutionChain(sp.id);
        curY = renderEvolutionTree(chain, centerX, curY, 0);
      } else {
        const noEvoText = this.add.text(centerX, curY, "Does not evolve", {
          fontSize: "9px", color: "#555570", fontFamily: "monospace",
        }).setOrigin(0.5).setDepth(102);
        detailObjects.push(noEvoText);
        curY += 14;
      }

      // ── Close button ──
      const closeBtnY = panelY + panelH / 2 - 22;
      const closeBtnBg = this.add.rectangle(centerX, closeBtnY, 100, 28, 0x1a1a2e, 0.9)
        .setStrokeStyle(1, 0x334155)
        .setDepth(102)
        .setInteractive({ useHandCursor: true });
      closeBtnBg.on("pointerover", () => closeBtnBg.setFillStyle(0x2a2a4e, 1));
      closeBtnBg.on("pointerout", () => closeBtnBg.setFillStyle(0x1a1a2e, 0.9));
      closeBtnBg.on("pointerdown", () => closeDetail());
      detailObjects.push(closeBtnBg);

      const closeBtnText = this.add.text(centerX, closeBtnY, "Close", {
        fontSize: "11px", color: "#334155", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setDepth(103);
      detailObjects.push(closeBtnText);
    };

    // ── Render evolution tree (recursive) ──
    const renderEvolutionTree = (node: EvolutionNode, cx: number, startY: number, depth: number): number => {
      let curY = startY;

      const isSeen = seenSet.has(node.speciesId);
      const isUsed = usedSet.has(node.speciesId);

      let nameColor = "#555570";
      if (isUsed) {
        nameColor = "#4ade80";
      } else if (isSeen) {
        nameColor = "#e0e0e0";
      }

      if (!node.inSpecies && !isSeen) {
        const baseInChainSeen = depth === 0 ? false : true;
        nameColor = baseInChainSeen ? "#777790" : "#555570";
      }

      const displayName = isSeen || node.inSpecies ? node.name : "???";

      let prefix = "";
      if (depth > 0) {
        prefix = "  ".repeat(depth);
      }

      const lvlStr = node.evolveLevel ? ` (Lv.${node.evolveLevel})` : "";

      if (depth > 0) {
        const arrowY = curY - 6;
        const arrowText = this.add.text(cx, arrowY, `${prefix}-> ${displayName}${lvlStr}`, {
          fontSize: "9px", color: nameColor, fontFamily: "monospace",
        }).setOrigin(0.5).setDepth(102);
        detailObjects.push(arrowText);

        if (isUsed) {
          const star = this.add.text(cx + arrowText.width / 2 + 6, arrowY, "\u2605", {
            fontSize: "8px", color: "#fbbf24", fontFamily: "monospace",
          }).setOrigin(0, 0.5).setDepth(102);
          detailObjects.push(star);
        }
      } else {
        const baseText = this.add.text(cx, curY - 6, `${displayName}`, {
          fontSize: "10px", color: nameColor, fontFamily: "monospace", fontStyle: "bold",
        }).setOrigin(0.5).setDepth(102);
        detailObjects.push(baseText);

        if (isUsed) {
          const star = this.add.text(cx + baseText.width / 2 + 6, curY - 6, "\u2605", {
            fontSize: "8px", color: "#fbbf24", fontFamily: "monospace",
          }).setOrigin(0, 0.5).setDepth(102);
          detailObjects.push(star);
        }
      }

      if ((isSeen || node.inSpecies) && node.types.length > 0) {
        const typeStr2 = node.types.join("/");
        const tColor = TYPE_COLORS[node.types[0]] ?? "#94a3b8";
        const typeSmall = this.add.text(cx, curY + 4, typeStr2, {
          fontSize: "7px", color: tColor, fontFamily: "monospace",
        }).setOrigin(0.5).setDepth(102);
        detailObjects.push(typeSmall);
        curY += 20;
      } else {
        curY += 14;
      }

      if (node.evolvesTo.length === 1) {
        curY = renderEvolutionTree(node.evolvesTo[0], cx, curY, depth + 1);
      } else if (node.evolvesTo.length > 1) {
        for (const child of node.evolvesTo) {
          curY = renderEvolutionTree(child, cx, curY, depth + 1);
        }
      }

      return curY;
    };
  }
}
