import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { loadMeta, saveMeta, MetaSaveData } from "../core/save-system";

interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costScale: number; // cost = baseCost + level * costScale
}

const UPGRADES: UpgradeDef[] = [
  {
    id: "maxHp",
    name: "HP Boost",
    description: "+5 max HP per level",
    maxLevel: 10,
    baseCost: 50,
    costScale: 30,
  },
  {
    id: "atk",
    name: "ATK Boost",
    description: "+1 ATK per level",
    maxLevel: 10,
    baseCost: 80,
    costScale: 50,
  },
  {
    id: "def",
    name: "DEF Boost",
    description: "+1 DEF per level",
    maxLevel: 10,
    baseCost: 80,
    costScale: 50,
  },
  {
    id: "bagSize",
    name: "Bigger Bag",
    description: "+2 inventory slots per level",
    maxLevel: 5,
    baseCost: 100,
    costScale: 80,
  },
  {
    id: "startItems",
    name: "Starter Kit",
    description: "Start with Oran Berry (+1 per level)",
    maxLevel: 3,
    baseCost: 60,
    costScale: 40,
  },
];

export class UpgradeScene extends Phaser.Scene {
  private meta!: MetaSaveData;
  private goldText!: Phaser.GameObjects.Text;
  private upgradeTexts: Phaser.GameObjects.Text[] = [];
  private costTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: "UpgradeScene" });
  }

  create() {
    this.meta = loadMeta();

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0f0f1a);

    // Title
    this.add.text(GAME_WIDTH / 2, 30, "Upgrade Shop", {
      fontSize: "18px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    // Gold
    this.goldText = this.add.text(GAME_WIDTH / 2, 58, `Gold: ${this.meta.gold}`, {
      fontSize: "13px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Upgrades list
    const startY = 100;
    const gap = 80;

    UPGRADES.forEach((upg, i) => {
      const y = startY + i * gap;
      const currentLv = this.meta.upgrades[upg.id] ?? 0;
      const maxed = currentLv >= upg.maxLevel;
      const cost = upg.baseCost + currentLv * upg.costScale;

      // Name + level
      const nameText = this.add.text(20, y, `${upg.name}  Lv.${currentLv}/${upg.maxLevel}`, {
        fontSize: "13px", color: maxed ? "#4ade80" : "#e0e0e0", fontFamily: "monospace", fontStyle: "bold",
      });
      this.upgradeTexts.push(nameText);

      // Description
      this.add.text(20, y + 18, upg.description, {
        fontSize: "9px", color: "#666680", fontFamily: "monospace",
      });

      // Cost / Buy button
      if (!maxed) {
        const canAfford = this.meta.gold >= cost;
        const costText = this.add.text(20, y + 36, `Cost: ${cost}G`, {
          fontSize: "10px", color: canAfford ? "#fde68a" : "#ef4444", fontFamily: "monospace",
        });
        this.costTexts.push(costText);

        const buyBtn = this.add.text(280, y + 10, "[BUY]", {
          fontSize: "12px",
          color: canAfford ? "#4ade80" : "#444460",
          fontFamily: "monospace",
          backgroundColor: canAfford ? "#1a2e1a" : "#1a1a1a",
          padding: { x: 8, y: 6 },
        }).setInteractive();

        if (canAfford) {
          buyBtn.on("pointerdown", () => {
            this.purchaseUpgrade(upg.id, cost);
          });
        }
      } else {
        this.add.text(280, y + 10, "MAX", {
          fontSize: "12px", color: "#4ade80", fontFamily: "monospace",
          padding: { x: 8, y: 6 },
        });
      }
    });

    // Back button
    const backBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 50, "[Back to Town]", {
      fontSize: "14px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setInteractive();
    backBtn.on("pointerdown", () => {
      this.scene.start("HubScene");
    });
  }

  private purchaseUpgrade(upgradeId: string, cost: number) {
    if (this.meta.gold < cost) return;

    this.meta.gold -= cost;
    this.meta.upgrades[upgradeId] = (this.meta.upgrades[upgradeId] ?? 0) + 1;
    saveMeta(this.meta);

    // Refresh scene
    this.scene.restart();
  }
}

/** Get upgrade bonus for a given upgrade ID */
export function getUpgradeBonus(meta: MetaSaveData, upgradeId: string): number {
  return meta.upgrades[upgradeId] ?? 0;
}
