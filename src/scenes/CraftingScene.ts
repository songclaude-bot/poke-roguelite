import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { loadMeta, saveMeta, MetaSaveData } from "../core/save-system";
import {
  CRAFTING_RECIPES,
  CraftingRecipe,
  canCraft,
  isRecipeUnlocked,
  getItemName,
  getStorageItemCount,
  addToStorage,
  removeFromStorage,
  cleanStorage,
} from "../core/crafting";

/**
 * CraftingScene — the Item Forge in hub town.
 * Players can combine stored items to create better ones.
 */
export class CraftingScene extends Phaser.Scene {
  private meta!: MetaSaveData;
  private goldText!: Phaser.GameObjects.Text;
  private storageText!: Phaser.GameObjects.Text;

  // Scroll state
  private listContainer!: Phaser.GameObjects.Container;
  private scrollOffset = 0;
  private maxScroll = 0;

  constructor() {
    super({ key: "CraftingScene" });
  }

  create() {
    this.meta = loadMeta();

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0f0f1a);

    // Title
    this.add.text(GAME_WIDTH / 2, 25, "Item Forge", {
      fontSize: "18px", color: "#ff8c42", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    // Gold display
    this.goldText = this.add.text(GAME_WIDTH / 2, 50, `Gold: ${this.meta.gold}`, {
      fontSize: "13px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Stored items counter
    const totalStored = getStorageItemCount(this.meta.storage);
    this.storageText = this.add.text(GAME_WIDTH / 2, 68, `Stored Items: ${totalStored}`, {
      fontSize: "11px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Separator
    this.add.text(GAME_WIDTH / 2, 85, "────────────────────────────────", {
      fontSize: "8px", color: "#334155", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Scrollable recipe list
    const scrollTop = 95;
    const scrollBottom = GAME_HEIGHT - 55;
    const scrollH = scrollBottom - scrollTop;

    this.listContainer = this.add.container(0, 0).setDepth(10);

    // Mask for scroll area
    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillRect(0, scrollTop, GAME_WIDTH, scrollH);
    const geoMask = maskShape.createGeometryMask();
    this.listContainer.setMask(geoMask);

    // Render recipe list
    this.renderRecipeList(scrollTop);

    // Calculate max scroll
    const contentH = this.getContentHeight();
    this.maxScroll = Math.max(0, contentH - scrollH);

    // Scroll indicator
    const indicator = this.add.rectangle(
      GAME_WIDTH - 4, scrollTop, 3, 20, 0x667eea, 0.5
    ).setOrigin(0.5, 0).setDepth(11).setVisible(this.maxScroll > 0);

    if (this.maxScroll > 0) {
      const indicatorH = Math.max(20, (scrollH / contentH) * scrollH);
      indicator.setSize(3, indicatorH);
    }

    const updateIndicator = () => {
      if (this.maxScroll <= 0) return;
      const indicatorH = indicator.height;
      const ratio = -this.scrollOffset / this.maxScroll;
      indicator.y = scrollTop + ratio * (scrollH - indicatorH);
    };

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
      this.scrollOffset = Math.max(-this.maxScroll, Math.min(0, this.scrollOffset + dy));
      this.listContainer.y = this.scrollOffset;
      updateIndicator();
    });

    // Back button (fixed at bottom)
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 30, GAME_WIDTH, 50, 0x0f0f1a).setDepth(50);
    const backBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, "[Back to Town]", {
      fontSize: "14px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setInteractive().setDepth(51);
    backBtn.on("pointerdown", () => {
      this.scene.start("HubScene");
    });
  }

  private getContentHeight(): number {
    let h = 10; // initial padding
    const unlockedRecipes = CRAFTING_RECIPES.filter(r => isRecipeUnlocked(r, this.meta.totalClears));
    const lockedRecipes = CRAFTING_RECIPES.filter(r => !isRecipeUnlocked(r, this.meta.totalClears));

    if (unlockedRecipes.length > 0) {
      h += 18; // header
      h += unlockedRecipes.length * 80; // each recipe row
    }

    if (lockedRecipes.length > 0) {
      h += 10; // gap
      h += 18; // header
      h += lockedRecipes.length * 36; // locked rows are smaller
    }

    // Storage inventory section
    h += 20; // gap
    h += 18; // header
    const storageItems = this.meta.storage.filter(s => s.count > 0);
    h += Math.max(1, Math.ceil(storageItems.length / 2)) * 22;

    return h;
  }

  private renderRecipeList(startY: number) {
    this.listContainer.removeAll(true);
    let y = startY + 10;
    const btnW = 320;

    const unlockedRecipes = CRAFTING_RECIPES.filter(r => isRecipeUnlocked(r, this.meta.totalClears));
    const lockedRecipes = CRAFTING_RECIPES.filter(r => !isRecipeUnlocked(r, this.meta.totalClears));

    // ── Unlocked Recipes ──
    if (unlockedRecipes.length > 0) {
      const header = this.add.text(15, y, "── Recipes ──", {
        fontSize: "10px", color: "#94a3b8", fontFamily: "monospace",
      });
      this.listContainer.add(header);
      y += 18;

      for (const recipe of unlockedRecipes) {
        this.renderRecipeRow(recipe, y, btnW);
        y += 80;
      }
    }

    // ── Locked Recipes ──
    if (lockedRecipes.length > 0) {
      y += 10;
      const header = this.add.text(15, y, "── Locked ──", {
        fontSize: "10px", color: "#555568", fontFamily: "monospace",
      });
      this.listContainer.add(header);
      y += 18;

      for (const recipe of lockedRecipes) {
        this.renderLockedRow(recipe, y, btnW);
        y += 36;
      }
    }

    // ── Storage Inventory ──
    y += 20;
    const storageHeader = this.add.text(15, y, "── Your Storage ──", {
      fontSize: "10px", color: "#94a3b8", fontFamily: "monospace",
    });
    this.listContainer.add(storageHeader);
    y += 18;

    const storageItems = this.meta.storage.filter(s => s.count > 0);
    if (storageItems.length === 0) {
      const emptyText = this.add.text(GAME_WIDTH / 2, y + 4, "No items stored yet", {
        fontSize: "9px", color: "#555568", fontFamily: "monospace",
      }).setOrigin(0.5, 0);
      this.listContainer.add(emptyText);
    } else {
      // Display in two columns
      const colW = 155;
      for (let i = 0; i < storageItems.length; i++) {
        const s = storageItems[i];
        const col = i % 2;
        const row = Math.floor(i / 2);
        const sx = 20 + col * colW;
        const sy = y + row * 22;
        const name = getItemName(s.itemId);
        const t = this.add.text(sx, sy, `${name} x${s.count}`, {
          fontSize: "9px", color: "#b0b0c0", fontFamily: "monospace",
        });
        this.listContainer.add(t);
      }
    }
  }

  private renderRecipeRow(recipe: CraftingRecipe, y: number, btnW: number) {
    const craftable = canCraft(recipe, this.meta.storage, this.meta.gold, this.meta.totalClears);

    // Background
    const bg = this.add.rectangle(GAME_WIDTH / 2, y + 34, btnW, 72, 0x1a1a2e, 0.9)
      .setStrokeStyle(1, craftable ? 0x445566 : 0x222233);
    this.listContainer.add(bg);

    // Recipe name + cost
    const nameColor = craftable ? "#ff8c42" : "#666680";
    const nameText = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 12, y + 6, recipe.name, {
      fontSize: "12px", color: nameColor, fontFamily: "monospace", fontStyle: "bold",
    });
    this.listContainer.add(nameText);

    // Gold cost (right-aligned)
    const costColor = this.meta.gold >= recipe.goldCost ? "#fde68a" : "#664444";
    const costText = this.add.text(GAME_WIDTH / 2 + btnW / 2 - 12, y + 7, `${recipe.goldCost}G`, {
      fontSize: "10px", color: costColor, fontFamily: "monospace",
    }).setOrigin(1, 0);
    this.listContainer.add(costText);

    // Ingredients line
    const ingParts: string[] = [];
    for (const ing of recipe.ingredients) {
      const name = getItemName(ing.itemId);
      const stored = this.meta.storage.find(s => s.itemId === ing.itemId);
      const have = stored ? stored.count : 0;
      const color = have >= ing.count ? "" : "!";
      ingParts.push(`${name} x${ing.count}${color.length > 0 ? ` (${have})` : ""}`);
    }
    const ingText = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 12, y + 24, ingParts.join(" + "), {
      fontSize: "8px", color: craftable ? "#88aa88" : "#666680", fontFamily: "monospace",
      wordWrap: { width: btnW - 24 },
    });
    this.listContainer.add(ingText);

    // Result line
    const resultName = getItemName(recipe.result.itemId);
    const resultLine = `-> ${resultName} x${recipe.result.count}`;
    const resultText = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 12, y + 40, resultLine, {
      fontSize: "9px", color: craftable ? "#4ade80" : "#555568", fontFamily: "monospace",
    });
    this.listContainer.add(resultText);

    // Craft button
    if (craftable) {
      const craftBtn = this.add.text(GAME_WIDTH / 2 + btnW / 2 - 12, y + 38, "[Craft]", {
        fontSize: "11px", color: "#ff8c42", fontFamily: "monospace",
        backgroundColor: "#2e2a1a",
        padding: { x: 6, y: 3 },
      }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
      this.listContainer.add(craftBtn);

      craftBtn.on("pointerdown", () => {
        this.executeCraft(recipe);
      });
    } else {
      // Show why it can't be crafted
      let reason = "";
      if (this.meta.gold < recipe.goldCost) {
        reason = "Not enough gold";
      } else {
        for (const ing of recipe.ingredients) {
          const stored = this.meta.storage.find(s => s.itemId === ing.itemId);
          const have = stored ? stored.count : 0;
          if (have < ing.count) {
            reason = `Need ${getItemName(ing.itemId)}`;
            break;
          }
        }
      }
      if (reason) {
        const reasonText = this.add.text(GAME_WIDTH / 2 + btnW / 2 - 12, y + 42, reason, {
          fontSize: "8px", color: "#664444", fontFamily: "monospace",
        }).setOrigin(1, 0);
        this.listContainer.add(reasonText);
      }
    }
  }

  private renderLockedRow(recipe: CraftingRecipe, y: number, btnW: number) {
    const bg = this.add.rectangle(GAME_WIDTH / 2, y + 12, btnW, 30, 0x1a1a2e, 0.6)
      .setStrokeStyle(1, 0x222233);
    this.listContainer.add(bg);

    const lockText = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 12, y + 5, `??? — ${recipe.requiredClears} clears to unlock`, {
      fontSize: "10px", color: "#444460", fontFamily: "monospace",
    });
    this.listContainer.add(lockText);
  }

  private executeCraft(recipe: CraftingRecipe) {
    // Double-check we can craft
    if (!canCraft(recipe, this.meta.storage, this.meta.gold, this.meta.totalClears)) return;

    // Deduct ingredients
    for (const ing of recipe.ingredients) {
      removeFromStorage(this.meta.storage, ing.itemId, ing.count);
    }

    // Deduct gold
    this.meta.gold -= recipe.goldCost;

    // Add result
    addToStorage(this.meta.storage, recipe.result.itemId, recipe.result.count);

    // Clean up zero-count entries
    this.meta.storage = cleanStorage(this.meta.storage);

    // Save
    saveMeta(this.meta);

    // Refresh the scene
    this.scene.restart();
  }
}
