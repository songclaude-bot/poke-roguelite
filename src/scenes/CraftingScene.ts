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
import {
  SynthesisRecipe,
  getSynthesisRecipes,
  getSynthesisItemName,
  canSynthesize,
  performSynthesis,
  getTierColor,
  getTierLabel,
} from "../core/item-synthesis";

type TabMode = "crafting" | "synthesis";

/**
 * CraftingScene — the Item Forge in hub town.
 * Players can combine stored items to create better ones.
 * Two tabs: Crafting (combine different items) and Synthesis (upgrade duplicates).
 */
export class CraftingScene extends Phaser.Scene {
  private meta!: MetaSaveData;
  private goldText!: Phaser.GameObjects.Text;
  private storageText!: Phaser.GameObjects.Text;

  // Scroll state
  private listContainer!: Phaser.GameObjects.Container;
  private scrollOffset = 0;
  private maxScroll = 0;

  // Tab state
  private currentTab: TabMode = "crafting";

  // Tab button references for styling
  private craftingTabBtn!: Phaser.GameObjects.Text;
  private synthesisTabBtn!: Phaser.GameObjects.Text;

  // Scroll area dimensions
  private scrollTop = 95;
  private scrollBottom = 0;
  private scrollH = 0;

  // Scroll indicator
  private scrollIndicator!: Phaser.GameObjects.Rectangle;

  constructor() {
    super({ key: "CraftingScene" });
  }

  create() {
    this.meta = loadMeta();
    this.scrollBottom = GAME_HEIGHT - 55;
    this.scrollH = this.scrollBottom - this.scrollTop;

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0f0f1a);

    // Title
    this.add.text(GAME_WIDTH / 2, 18, "Item Forge", {
      fontSize: "18px", color: "#ff8c42", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    // Gold display
    this.goldText = this.add.text(GAME_WIDTH / 2, 40, `Gold: ${this.meta.gold}`, {
      fontSize: "13px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Stored items counter
    const totalStored = getStorageItemCount(this.meta.storage);
    this.storageText = this.add.text(GAME_WIDTH / 2, 56, `Stored Items: ${totalStored}`, {
      fontSize: "11px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5);

    // ── Tab Buttons ──
    const tabY = 74;
    const tabW = 140;

    // Crafting tab
    this.craftingTabBtn = this.add.text(GAME_WIDTH / 2 - tabW / 2 - 5, tabY, "Crafting", {
      fontSize: "12px", color: "#ff8c42", fontFamily: "monospace", fontStyle: "bold",
      backgroundColor: "#1a1a2e",
      padding: { x: 10, y: 4 },
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

    this.synthesisTabBtn = this.add.text(GAME_WIDTH / 2 + tabW / 2 + 5, tabY, "Synthesis", {
      fontSize: "12px", color: "#666680", fontFamily: "monospace",
      backgroundColor: "#0f0f1a",
      padding: { x: 10, y: 4 },
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

    this.craftingTabBtn.on("pointerdown", () => {
      if (this.currentTab === "crafting") return;
      this.currentTab = "crafting";
      this.refreshTabs();
      this.rebuildList();
    });

    this.synthesisTabBtn.on("pointerdown", () => {
      if (this.currentTab === "synthesis") return;
      this.currentTab = "synthesis";
      this.refreshTabs();
      this.rebuildList();
    });

    // Separator
    this.add.text(GAME_WIDTH / 2, 88, "────────────────────────────────", {
      fontSize: "8px", color: "#334155", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Scrollable content container
    this.listContainer = this.add.container(0, 0).setDepth(10);

    // Mask for scroll area
    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillRect(0, this.scrollTop, GAME_WIDTH, this.scrollH);
    const geoMask = maskShape.createGeometryMask();
    this.listContainer.setMask(geoMask);

    // Scroll indicator
    this.scrollIndicator = this.add.rectangle(
      GAME_WIDTH - 4, this.scrollTop, 3, 20, 0x667eea, 0.5
    ).setOrigin(0.5, 0).setDepth(11);

    // Initial render
    this.rebuildList();

    // Touch/mouse scroll
    let dragStartY = 0;

    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (ptr.y >= this.scrollTop && ptr.y <= this.scrollBottom) {
        dragStartY = ptr.y;
      }
    });

    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      if (!ptr.isDown || ptr.y < this.scrollTop || ptr.y > this.scrollBottom) return;
      const dy = ptr.y - dragStartY;
      dragStartY = ptr.y;
      this.scrollOffset = Math.max(-this.maxScroll, Math.min(0, this.scrollOffset + dy));
      this.listContainer.y = this.scrollOffset;
      this.updateIndicatorPos();
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

  // ── Tab styling ──

  private refreshTabs() {
    if (this.currentTab === "crafting") {
      this.craftingTabBtn.setColor("#ff8c42").setFontStyle("bold").setBackgroundColor("#1a1a2e");
      this.synthesisTabBtn.setColor("#666680").setFontStyle("").setBackgroundColor("#0f0f1a");
    } else {
      this.craftingTabBtn.setColor("#666680").setFontStyle("").setBackgroundColor("#0f0f1a");
      this.synthesisTabBtn.setColor("#fbbf24").setFontStyle("bold").setBackgroundColor("#1a1a2e");
    }
  }

  // ── Rebuild the list based on current tab ──

  private rebuildList() {
    this.scrollOffset = 0;
    this.listContainer.y = 0;

    if (this.currentTab === "crafting") {
      this.renderCraftingList(this.scrollTop);
    } else {
      this.renderSynthesisList(this.scrollTop);
    }

    const contentH = this.currentTab === "crafting"
      ? this.getCraftingContentHeight()
      : this.getSynthesisContentHeight();
    this.maxScroll = Math.max(0, contentH - this.scrollH);

    // Update scroll indicator
    this.scrollIndicator.setVisible(this.maxScroll > 0);
    if (this.maxScroll > 0) {
      const indicatorH = Math.max(20, (this.scrollH / contentH) * this.scrollH);
      this.scrollIndicator.setSize(3, indicatorH);
    }
    this.updateIndicatorPos();
  }

  private updateIndicatorPos() {
    if (this.maxScroll <= 0) return;
    const indicatorH = this.scrollIndicator.height;
    const ratio = -this.scrollOffset / this.maxScroll;
    this.scrollIndicator.y = this.scrollTop + ratio * (this.scrollH - indicatorH);
  }

  // ══════════════════════════════════
  //  CRAFTING TAB (existing logic)
  // ══════════════════════════════════

  private getCraftingContentHeight(): number {
    let h = 10;
    const unlockedRecipes = CRAFTING_RECIPES.filter(r => isRecipeUnlocked(r, this.meta.totalClears));
    const lockedRecipes = CRAFTING_RECIPES.filter(r => !isRecipeUnlocked(r, this.meta.totalClears));

    if (unlockedRecipes.length > 0) {
      h += 18;
      h += unlockedRecipes.length * 80;
    }

    if (lockedRecipes.length > 0) {
      h += 10;
      h += 18;
      h += lockedRecipes.length * 36;
    }

    h += 20;
    h += 18;
    const storageItems = this.meta.storage.filter(s => s.count > 0);
    h += Math.max(1, Math.ceil(storageItems.length / 2)) * 22;

    return h;
  }

  private renderCraftingList(startY: number) {
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
    this.renderStorageSection(y);
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
    if (!canCraft(recipe, this.meta.storage, this.meta.gold, this.meta.totalClears)) return;

    for (const ing of recipe.ingredients) {
      removeFromStorage(this.meta.storage, ing.itemId, ing.count);
    }
    this.meta.gold -= recipe.goldCost;
    addToStorage(this.meta.storage, recipe.result.itemId, recipe.result.count);
    this.meta.storage = cleanStorage(this.meta.storage);
    saveMeta(this.meta);
    this.scene.restart();
  }

  // ══════════════════════════════════
  //  SYNTHESIS TAB (new)
  // ══════════════════════════════════

  private getSynthesisContentHeight(): number {
    let h = 10; // initial padding
    const recipes = getSynthesisRecipes();
    h += 18; // header
    h += recipes.length * 80; // each recipe row

    // Storage section
    h += 20;
    h += 18;
    const storageItems = this.meta.storage.filter(s => s.count > 0);
    h += Math.max(1, Math.ceil(storageItems.length / 2)) * 22;

    return h;
  }

  private renderSynthesisList(startY: number) {
    this.listContainer.removeAll(true);
    let y = startY + 10;
    const btnW = 320;

    const recipes = getSynthesisRecipes();

    // Header
    const header = this.add.text(15, y, "── Upgrade Recipes ──", {
      fontSize: "10px", color: "#fbbf24", fontFamily: "monospace",
    });
    this.listContainer.add(header);
    y += 18;

    for (const recipe of recipes) {
      this.renderSynthesisRow(recipe, y, btnW);
      y += 80;
    }

    // ── Storage Inventory ──
    this.renderStorageSection(y);
  }

  private renderSynthesisRow(recipe: SynthesisRecipe, y: number, btnW: number) {
    const available = canSynthesize(recipe, this.meta.storage, this.meta.gold);

    // Background — green-tinted if available
    const bg = this.add.rectangle(GAME_WIDTH / 2, y + 34, btnW, 72, 0x1a1a2e, 0.9)
      .setStrokeStyle(1, available ? 0x446644 : 0x222233);
    this.listContainer.add(bg);

    // Output item name (with tier color)
    const outputName = getSynthesisItemName(recipe.outputId);
    const tierColor = available ? getTierColor(recipe.tier) : "#666680";
    const nameText = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 12, y + 6, outputName, {
      fontSize: "12px", color: tierColor, fontFamily: "monospace", fontStyle: "bold",
    });
    this.listContainer.add(nameText);

    // Tier label
    const tierLabel = this.add.text(GAME_WIDTH / 2 + btnW / 2 - 55, y + 7, getTierLabel(recipe.tier), {
      fontSize: "8px", color: tierColor, fontFamily: "monospace",
    }).setOrigin(1, 0);
    this.listContainer.add(tierLabel);

    // Gold cost (right-aligned)
    const costColor = this.meta.gold >= recipe.goldCost ? "#fde68a" : "#664444";
    const costText = this.add.text(GAME_WIDTH / 2 + btnW / 2 - 12, y + 7, `${recipe.goldCost}G`, {
      fontSize: "10px", color: costColor, fontFamily: "monospace",
    }).setOrigin(1, 0);
    this.listContainer.add(costText);

    // Input materials line
    const inputName = getSynthesisItemName(recipe.inputId);
    const stored = this.meta.storage.find(s => s.itemId === recipe.inputId);
    const have = stored ? stored.count : 0;
    const enough = have >= recipe.inputCount;
    const inputLine = `${inputName} x${recipe.inputCount}${!enough ? ` (have ${have})` : ""}`;
    const ingText = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 12, y + 24, inputLine, {
      fontSize: "9px", color: enough ? "#88aa88" : "#666680", fontFamily: "monospace",
    });
    this.listContainer.add(ingText);

    // Arrow + result description
    const outputItem = getSynthesisItemName(recipe.outputId);
    const resultText = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 12, y + 40, `-> ${outputItem} x1`, {
      fontSize: "9px", color: available ? "#fbbf24" : "#555568", fontFamily: "monospace",
    });
    this.listContainer.add(resultText);

    // Synthesize button
    if (available) {
      const synthBtn = this.add.text(GAME_WIDTH / 2 + btnW / 2 - 12, y + 38, "[Synthesize]", {
        fontSize: "11px", color: "#fbbf24", fontFamily: "monospace",
        backgroundColor: "#2e2a1a",
        padding: { x: 6, y: 3 },
      }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
      this.listContainer.add(synthBtn);

      synthBtn.on("pointerdown", () => {
        this.executeSynthesis(recipe);
      });
    } else {
      let reason = "";
      if (this.meta.gold < recipe.goldCost) {
        reason = "Not enough gold";
      } else if (!enough) {
        reason = `Need ${recipe.inputCount - have} more`;
      }
      if (reason) {
        const reasonText = this.add.text(GAME_WIDTH / 2 + btnW / 2 - 12, y + 42, reason, {
          fontSize: "8px", color: "#664444", fontFamily: "monospace",
        }).setOrigin(1, 0);
        this.listContainer.add(reasonText);
      }
    }
  }

  private executeSynthesis(recipe: SynthesisRecipe) {
    if (!canSynthesize(recipe, this.meta.storage, this.meta.gold)) return;

    const result = performSynthesis(recipe, this.meta.storage, this.meta.gold);
    this.meta.storage = result.storage;
    this.meta.gold -= result.goldSpent;
    saveMeta(this.meta);

    // Golden flash animation before restart
    this.cameras.main.flash(400, 255, 215, 0);
    this.time.delayedCall(450, () => {
      this.scene.restart();
    });
  }

  // ══════════════════════════════════
  //  SHARED: Storage section
  // ══════════════════════════════════

  private renderStorageSection(y: number) {
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
      const colW = 155;
      for (let i = 0; i < storageItems.length; i++) {
        const s = storageItems[i];
        const col = i % 2;
        const row = Math.floor(i / 2);
        const sx = 20 + col * colW;
        const sy = y + row * 22;
        const name = getItemName(s.itemId);
        // Gold tint for upgraded items (starts with star)
        const isUpgraded = name.startsWith("★");
        const t = this.add.text(sx, sy, `${name} x${s.count}`, {
          fontSize: "9px", color: isUpgraded ? "#fbbf24" : "#b0b0c0", fontFamily: "monospace",
        });
        this.listContainer.add(t);
      }
    }
  }
}
