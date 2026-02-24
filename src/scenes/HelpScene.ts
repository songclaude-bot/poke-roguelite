import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";

interface HelpSection {
  title: string;
  body: string;
}

const HELP_SECTIONS: HelpSection[] = [
  {
    title: "Basics",
    body:
      "Use the D-Pad to move in 8 directions.\n" +
      "The game is turn-based: you move, then enemies move.\n" +
      "Find the gold stairs marker to descend deeper.\n" +
      "Reach the final floor and defeat the boss to clear!",
  },
  {
    title: "Combat",
    body:
      "Walk into an enemy to perform a basic attack.\n" +
      "Use skills (right-side buttons) for stronger moves.\n" +
      "Type effectiveness matters: super effective = 1.5x,\n" +
      "not very effective = 0.5x, immune = 0x damage.\n" +
      "Face the enemy with the D-Pad before using a skill.",
  },
  {
    title: "Items",
    body:
      "Items appear on the dungeon floor as icons.\n" +
      "Walk over an item and tap the bag icon to pick up.\n" +
      "Open inventory to use items: Oran Berry heals HP,\n" +
      "Apple restores Belly, Elixir restores PP.\n" +
      "Max inventory: 16 items. Choose wisely!",
  },
  {
    title: "Allies",
    body:
      "Defeated enemies have a ~10% chance to be recruited.\n" +
      "Recruited allies follow you and fight alongside you.\n" +
      "Max party size: 4 allies + you.\n" +
      "Allies persist across floors in the same dungeon run.\n" +
      "Keep them alive -- they don't revive!",
  },
  {
    title: "Belly",
    body:
      "Your Belly decreases by 1 each turn you take.\n" +
      "When Belly reaches 0, you lose HP every turn!\n" +
      "Eat Apples (plain, Big, Perfect) to restore Belly.\n" +
      "Upgrade max Belly at the shop in town.\n" +
      "Plan your food supply before long dungeons.",
  },
  {
    title: "Skills",
    body:
      "You can equip up to 4 skills at a time.\n" +
      "Each skill has limited PP (power points).\n" +
      "When PP runs out, you can't use that skill.\n" +
      "Elixirs restore PP. Max Elixir restores all PP.\n" +
      "Learn new skills at level up or from the Move Tutor.",
  },
  {
    title: "Held Items",
    body:
      "Equip one held item for a passive bonus.\n" +
      "Examples: HP boost, ATK boost, hunger reduction.\n" +
      "Buy held items from the Held Item shop in town.\n" +
      "Only one held item can be active at a time.\n" +
      "Choose one that fits your playstyle!",
  },
  {
    title: "Weather",
    body:
      "Some floors have weather effects:\n" +
      "Rain: Water moves boosted, Fire moves weakened.\n" +
      "Sandstorm: Damages non-Rock/Ground/Steel each turn.\n" +
      "Hail: Damages non-Ice types each turn.\n" +
      "Sun: Fire moves boosted, Water moves weakened.\n" +
      "Certain abilities grant weather immunity.",
  },
  {
    title: "Traps",
    body:
      "Hidden traps are scattered on dungeon floors.\n" +
      "Traps are revealed when you step nearby.\n" +
      "Effects: damage, stat drop, warp, PP drain, etc.\n" +
      "Watch for trap icons on revealed tiles!\n" +
      "Some upgrades reduce trap damage.",
  },
  {
    title: "Special Modes",
    body:
      "Endless Abyss: Infinite floors. How deep can you go?\n" +
      "  Unlocks at 10 clears.\n" +
      "Boss Rush: 10 boss fights in a row!\n" +
      "  Unlocks at 30 clears.\n" +
      "Daily Dungeon: Seeded run with unique modifiers.\n" +
      "  Unlocks at 5 clears. One attempt per day.\n" +
      "Challenges: Speedrun, No Items, Solo modes.",
  },
  {
    title: "Tips",
    body:
      "- Save Apples for deep floors where Belly matters.\n" +
      "- Use type advantages: bring varied skill types.\n" +
      "- Recruit allies early for extra damage and tanking.\n" +
      "- Upgrade HP and Belly first at the shop.\n" +
      "- Check the Pokedex to track seen Pokemon.\n" +
      "- Boss floors: heal up and restore PP before stairs.\n" +
      "- Kecleon Shops appear randomly -- buy wisely!",
  },
];

/**
 * HelpScene -- in-game tutorial / help pages.
 * Scrollable list of sections explaining all game mechanics.
 */
export class HelpScene extends Phaser.Scene {
  constructor() {
    super({ key: "HelpScene" });
  }

  create() {
    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1a);

    // Title
    this.add.text(GAME_WIDTH / 2, 25, "Help & Tutorial", {
      fontSize: "16px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 45, "Scroll down to read all sections", {
      fontSize: "8px", color: "#666680", fontFamily: "monospace",
    }).setOrigin(0.5);

    // ── Scrollable content ──
    const scrollTop = 60;
    const scrollBottom = GAME_HEIGHT - 40;
    const scrollH = scrollBottom - scrollTop;
    const container = this.add.container(0, 0);

    let cy = scrollTop + 8;
    const contentW = GAME_WIDTH - 32;
    const padX = 16;

    for (const section of HELP_SECTIONS) {
      // Section header
      const header = this.add.text(padX, cy, `-- ${section.title} --`, {
        fontSize: "12px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
      });
      container.add(header);
      cy += 20;

      // Section body -- render with word wrap
      const body = this.add.text(padX, cy, section.body, {
        fontSize: "9px",
        color: "#94a3b8",
        fontFamily: "monospace",
        lineSpacing: 3,
        wordWrap: { width: contentW, useAdvancedWrap: true },
      });
      container.add(body);
      cy += body.height + 16;
    }

    // ── Scroll logic (same pattern as AchievementScene) ──
    const contentH = cy - scrollTop;
    const maxScroll = Math.max(0, contentH - scrollH);

    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillRect(0, scrollTop, GAME_WIDTH, scrollH);
    container.setMask(maskShape.createGeometryMask());

    // Scroll indicator
    const indicator = this.add.rectangle(
      GAME_WIDTH - 4, scrollTop, 3, 20, 0x667eea, 0.5
    ).setOrigin(0.5, 0).setDepth(11).setVisible(maxScroll > 0);

    if (maxScroll > 0) {
      const indicatorH = Math.max(20, (scrollH / contentH) * scrollH);
      indicator.setSize(3, indicatorH);

      let dragStartY = 0;
      let scrollOffset = 0;

      const updateIndicator = () => {
        const ratio = -scrollOffset / maxScroll;
        indicator.y = scrollTop + ratio * (scrollH - indicatorH);
      };

      this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
        dragStartY = ptr.y;
      });
      this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
        if (!ptr.isDown) return;
        const dy = ptr.y - dragStartY;
        dragStartY = ptr.y;
        scrollOffset = Math.max(-maxScroll, Math.min(0, scrollOffset + dy));
        container.y = scrollOffset;
        updateIndicator();
      });
    }

    // Back button
    const back = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20, "[Back to Town]", {
      fontSize: "13px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setInteractive();
    back.on("pointerdown", () => this.scene.start("HubScene"));
  }
}
