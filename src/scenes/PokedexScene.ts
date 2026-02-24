import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { loadMeta } from "../core/save-system";
import { SPECIES, PokemonSpecies } from "../core/pokemon-data";
import { PokemonType } from "../core/type-chart";

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
 * Displays discovered/undiscovered status based on player encounters.
 * Uses virtual scrolling (object pool) for performance with 460+ species.
 */
export class PokedexScene extends Phaser.Scene {
  constructor() {
    super({ key: "PokedexScene" });
  }

  create() {
    const meta = loadMeta();
    const seenSet = new Set(meta.pokemonSeen ?? []);
    const usedSet = new Set(meta.pokemonUsed ?? []);

    // Build sorted species list (alphabetical by name)
    const allSpecies: PokemonSpecies[] = Object.values(SPECIES);
    allSpecies.sort((a, b) => a.name.localeCompare(b.name));

    const totalCount = allSpecies.length;
    const seenCount = allSpecies.filter(sp => seenSet.has(sp.id)).length;

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
        filterMode = mode;
        updateTabs();
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
    const scrollBottom = GAME_HEIGHT - 35;
    const scrollH = scrollBottom - scrollTop;
    const ITEM_H = 32;
    const POOL_SIZE = Math.ceil(scrollH / ITEM_H) + 2;

    // Mask for scroll area
    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillRect(0, scrollTop, GAME_WIDTH, scrollH);
    const mask = maskShape.createGeometryMask();

    // Object pool
    const poolContainer = this.add.container(0, 0).setMask(mask);
    const pool: {
      bg: Phaser.GameObjects.Rectangle;
      idxText: Phaser.GameObjects.Text;
      nameText: Phaser.GameObjects.Text;
      typeText: Phaser.GameObjects.Text;
      statsText: Phaser.GameObjects.Text;
      starIcon: Phaser.GameObjects.Text;
      idx: number;
    }[] = [];

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
      pool.push({ bg, idxText, nameText, typeText, statsText, starIcon, idx: -1 });
    }

    // Filtered list
    let filteredList: PokemonSpecies[] = [];

    const getFilteredList = (): PokemonSpecies[] => {
      switch (filterMode) {
        case "seen":
          return allSpecies.filter(sp => seenSet.has(sp.id));
        case "used":
          return allSpecies.filter(sp => usedSet.has(sp.id));
        default:
          return allSpecies;
      }
    };

    let scrollOffset = 0;
    let maxScroll = 0;

    const bindRow = (row: typeof pool[0], dataIdx: number, yPos: number) => {
      row.idx = dataIdx;
      const centerY = yPos;
      row.bg.setY(centerY);

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
        // Seen Pokemon - show full info
        const dexIdx = allSpecies.indexOf(sp) + 1;
        const dexStr = String(dexIdx).padStart(4, "0");
        row.idxText.setText(dexStr).setColor("#555570").setY(centerY - 4);

        row.nameText.setText(sp.name).setColor("#e0e0e0").setY(centerY - 6);

        // Type display with color
        const typeStr = sp.types.map(t => t).join("/");
        const primaryTypeColor = TYPE_COLORS[sp.types[0]] ?? "#94a3b8";
        row.typeText.setText(typeStr).setColor(primaryTypeColor).setY(centerY - 6);

        // Stats
        const bs = sp.baseStats;
        row.statsText.setText(`${bs.hp}/${bs.atk}/${bs.def}`)
          .setColor("#777790").setY(centerY - 6);

        // Type label under name
        row.bg.setStrokeStyle(1, isUsed ? 0x4ade80 : 0x222233);

        // Star icon for used
        row.starIcon.setText(isUsed ? "\u2605" : "").setY(centerY - 5);
      } else {
        // Unseen Pokemon - show as ???
        row.idxText.setText("????").setColor("#333350").setY(centerY - 4);
        row.nameText.setText("???").setColor("#333350").setY(centerY - 6);
        row.typeText.setText("???").setColor("#333350").setY(centerY - 6);
        row.statsText.setText("??/??/??").setColor("#333350").setY(centerY - 6);
        row.bg.setStrokeStyle(1, 0x222233);
        row.starIcon.setText("").setY(centerY - 5);
      }
    };

    const renderVisible = () => {
      filteredList = getFilteredList();
      const totalH = filteredList.length * ITEM_H;
      maxScroll = Math.max(0, totalH - scrollH);
      scrollOffset = Math.min(scrollOffset, maxScroll);

      const startIdx = Math.floor(scrollOffset / ITEM_H);
      for (let i = 0; i < POOL_SIZE; i++) {
        const dataIdx = startIdx + i;
        const yPos = scrollTop + 10 + dataIdx * ITEM_H - scrollOffset;
        bindRow(pool[i], dataIdx, yPos);
      }

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

    // ── Scroll handling ──
    let dragStartY = 0;
    let isDragging = false;

    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (ptr.y >= scrollTop && ptr.y <= scrollBottom) {
        dragStartY = ptr.y;
        isDragging = true;
      }
    });

    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      if (!ptr.isDown || !isDragging) return;
      const dy = ptr.y - dragStartY;
      dragStartY = ptr.y;
      scrollOffset = Math.max(0, Math.min(maxScroll, scrollOffset - dy));
      renderVisible();
    });

    this.input.on("pointerup", () => { isDragging = false; });

    // ── Column header ──
    const headerBg = this.add.rectangle(GAME_WIDTH / 2, scrollTop - 4, 340, 12, 0x0a0a1a);
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

    // ── Back button ──
    const back = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 18, "[Back to Town]", {
      fontSize: "13px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on("pointerdown", () => this.scene.start("HubScene"));
  }
}
