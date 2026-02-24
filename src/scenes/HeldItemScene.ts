import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { loadMeta, saveMeta, MetaSaveData } from "../core/save-system";
import { HELD_ITEMS, HeldItem, getHeldItem } from "../core/held-items";
import {
  getAvailableEnchantments, getEquippedEnchantment, Enchantment,
  enchantmentTierColor, enchantmentTierLabel,
} from "../core/enchantments";

/**
 * HeldItemScene — buy and equip held items + enchantment system.
 * The player can own multiple held items but equip only one at a time.
 * Each equipped held item can have one enchantment applied.
 */
export class HeldItemScene extends Phaser.Scene {
  private meta!: MetaSaveData;
  private goldText!: Phaser.GameObjects.Text;
  private equippedText!: Phaser.GameObjects.Text;

  // Scroll state
  private listContainer!: Phaser.GameObjects.Container;
  private scrollOffset = 0;
  private maxScroll = 0;

  constructor() {
    super({ key: "HeldItemScene" });
  }

  create() {
    this.meta = loadMeta();

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0f0f1a);

    // Title
    this.add.text(GAME_WIDTH / 2, 25, "Held Items", {
      fontSize: "18px", color: "#f59e0b", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    // Gold display
    this.goldText = this.add.text(GAME_WIDTH / 2, 50, `Gold: ${this.meta.gold}`, {
      fontSize: "13px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Currently equipped item + enchantment
    const equippedItem = this.meta.equippedHeldItem ? getHeldItem(this.meta.equippedHeldItem) : undefined;
    const enchantment = getEquippedEnchantment(this.meta);
    let equippedLabel = "Equipped: None";
    let equippedColor = "#666680";
    if (equippedItem) {
      equippedLabel = enchantment
        ? `Equipped: ${equippedItem.name} [${enchantment.name}]`
        : `Equipped: ${equippedItem.name}`;
      equippedColor = enchantment ? enchantmentTierColor(enchantment.tier) : "#4ade80";
    }
    this.equippedText = this.add.text(GAME_WIDTH / 2, 70, equippedLabel, {
      fontSize: "11px", color: equippedColor, fontFamily: "monospace",
    }).setOrigin(0.5);

    // Separator
    this.add.text(GAME_WIDTH / 2, 90, "────────────────────────────────", {
      fontSize: "8px", color: "#334155", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Scrollable item list
    const scrollTop = 100;
    const scrollBottom = GAME_HEIGHT - 55;
    const scrollH = scrollBottom - scrollTop;

    this.listContainer = this.add.container(0, 0).setDepth(10);

    // Mask for scroll area
    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillRect(0, scrollTop, GAME_WIDTH, scrollH);
    const geoMask = maskShape.createGeometryMask();
    this.listContainer.setMask(geoMask);

    // Render items
    this.renderItemList(scrollTop);

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
    const backBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 30, GAME_WIDTH, 50, 0x0f0f1a).setDepth(50);
    const backBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, "[Back to Town]", {
      fontSize: "14px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setInteractive().setDepth(51);
    backBtn.on("pointerdown", () => {
      this.scene.start("HubScene");
    });
  }

  private getContentHeight(): number {
    // Calculate total content height
    let h = 10; // initial padding
    const owned = this.meta.ownedHeldItems ?? [];
    const ownedItems = HELD_ITEMS.filter(item => owned.includes(item.id));
    const shopItems = HELD_ITEMS.filter(item => !owned.includes(item.id));

    if (ownedItems.length > 0) {
      h += 20; // "Owned Items" header
      h += ownedItems.length * 56;
      h += 10; // gap
    }

    if (shopItems.length > 0) {
      h += 20; // "Shop" header
      h += shopItems.length * 56;
    }

    // Enchantment section
    h += 15; // gap before enchantment section
    h += 20; // "Enchantments" header
    const available = getAvailableEnchantments(this.meta.totalClears);
    h += available.length * 56;
    // Show locked count hint if there are more
    const totalEnchantments = 10;
    if (available.length < totalEnchantments) {
      h += 20; // locked hint row
    }
    h += 20; // bottom padding

    return h;
  }

  private renderItemList(startY: number) {
    this.listContainer.removeAll(true);
    let y = startY + 10;

    const owned = this.meta.ownedHeldItems ?? [];
    const equipped = this.meta.equippedHeldItem;
    const ownedItems = HELD_ITEMS.filter(item => owned.includes(item.id));
    const shopItems = HELD_ITEMS.filter(item => !owned.includes(item.id));

    // ── Owned Items ──
    if (ownedItems.length > 0) {
      const header = this.add.text(15, y, "── Owned Items ──", {
        fontSize: "10px", color: "#94a3b8", fontFamily: "monospace",
      });
      this.listContainer.add(header);
      y += 20;

      for (const item of ownedItems) {
        const isEquipped = equipped === item.id;
        this.renderOwnedItem(item, y, isEquipped);
        y += 56;
      }
      y += 10;
    }

    // ── Shop Items ──
    if (shopItems.length > 0) {
      const header = this.add.text(15, y, "── Shop ──", {
        fontSize: "10px", color: "#94a3b8", fontFamily: "monospace",
      });
      this.listContainer.add(header);
      y += 20;

      for (const item of shopItems) {
        this.renderShopItem(item, y);
        y += 56;
      }
    }

    // ── Enchantments ──
    y += 15;
    this.renderEnchantmentSection(y);
  }

  private renderOwnedItem(item: HeldItem, y: number, isEquipped: boolean) {
    const btnW = 320;
    const bg = this.add.rectangle(GAME_WIDTH / 2, y + 20, btnW, 50, 0x1a1a2e, 0.9)
      .setStrokeStyle(1, isEquipped ? 0x4ade80 : 0x334155);
    this.listContainer.add(bg);

    // Item name (show enchantment on equipped item)
    const nameColor = isEquipped ? "#4ade80" : "#e0e0e0";
    const namePrefix = isEquipped ? "* " : "";
    const enchantment = isEquipped ? getEquippedEnchantment(this.meta) : null;
    const enchantSuffix = enchantment ? ` [${enchantment.name}]` : "";
    const nameText = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 12, y + 8, `${namePrefix}${item.name}${enchantSuffix}`, {
      fontSize: "12px", color: nameColor, fontFamily: "monospace", fontStyle: "bold",
    });
    this.listContainer.add(nameText);

    // Description
    const descText = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 12, y + 24, item.description, {
      fontSize: "9px", color: "#888898", fontFamily: "monospace",
    });
    this.listContainer.add(descText);

    // Equip / Unequip button
    if (isEquipped) {
      const unequipBtn = this.add.text(GAME_WIDTH / 2 + btnW / 2 - 12, y + 16, "[Unequip]", {
        fontSize: "10px", color: "#ef4444", fontFamily: "monospace",
        backgroundColor: "#2e1a1a",
        padding: { x: 6, y: 4 },
      }).setOrigin(1, 0).setInteractive();
      this.listContainer.add(unequipBtn);

      unequipBtn.on("pointerdown", () => {
        this.meta.equippedHeldItem = undefined;
        saveMeta(this.meta);
        this.scene.restart();
      });
    } else {
      const equipBtn = this.add.text(GAME_WIDTH / 2 + btnW / 2 - 12, y + 16, "[Equip]", {
        fontSize: "10px", color: "#4ade80", fontFamily: "monospace",
        backgroundColor: "#1a2e1a",
        padding: { x: 6, y: 4 },
      }).setOrigin(1, 0).setInteractive();
      this.listContainer.add(equipBtn);

      equipBtn.on("pointerdown", () => {
        this.meta.equippedHeldItem = item.id;
        saveMeta(this.meta);
        this.scene.restart();
      });
    }
  }

  private renderShopItem(item: HeldItem, y: number) {
    const btnW = 320;
    const isUnlocked = this.meta.totalClears >= item.unlockClears;
    const canAfford = this.meta.gold >= item.cost;

    const bg = this.add.rectangle(GAME_WIDTH / 2, y + 20, btnW, 50, 0x1a1a2e, 0.9)
      .setStrokeStyle(1, isUnlocked ? 0x334155 : 0x222233);
    this.listContainer.add(bg);

    if (!isUnlocked) {
      // Locked item
      const lockText = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 12, y + 8, `??? (${item.unlockClears} clears)`, {
        fontSize: "12px", color: "#444460", fontFamily: "monospace", fontStyle: "bold",
      });
      const lockDesc = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 12, y + 24, `Need ${item.unlockClears} clears to unlock`, {
        fontSize: "9px", color: "#333348", fontFamily: "monospace",
      });
      this.listContainer.add([lockText, lockDesc]);
      return;
    }

    // Item name
    const nameText = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 12, y + 8, item.name, {
      fontSize: "12px", color: "#e0e0e0", fontFamily: "monospace", fontStyle: "bold",
    });
    this.listContainer.add(nameText);

    // Description + cost
    const descText = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 12, y + 24,
      `${item.description}  |  ${item.cost}G`, {
      fontSize: "9px", color: canAfford ? "#888898" : "#664444", fontFamily: "monospace",
    });
    this.listContainer.add(descText);

    // Buy button
    const buyBtn = this.add.text(GAME_WIDTH / 2 + btnW / 2 - 12, y + 16,
      canAfford ? "[Buy]" : "[Buy]", {
      fontSize: "10px",
      color: canAfford ? "#fbbf24" : "#444460",
      fontFamily: "monospace",
      backgroundColor: canAfford ? "#2e2a1a" : "#1a1a1a",
      padding: { x: 6, y: 4 },
    }).setOrigin(1, 0);
    this.listContainer.add(buyBtn);

    if (canAfford) {
      buyBtn.setInteractive();
      buyBtn.on("pointerdown", () => {
        this.purchaseItem(item);
      });
    }
  }

  // ── Enchantment Section ──

  private renderEnchantmentSection(startY: number) {
    let y = startY;
    const btnW = 320;

    // Section header
    const header = this.add.text(15, y, "── Enchantments ──", {
      fontSize: "10px", color: "#c084fc", fontFamily: "monospace",
    });
    this.listContainer.add(header);
    y += 20;

    const hasEquippedItem = !!this.meta.equippedHeldItem;
    const currentEnchantment = getEquippedEnchantment(this.meta);
    const available = getAvailableEnchantments(this.meta.totalClears);

    for (const ench of available) {
      const isCurrentEnchant = currentEnchantment?.id === ench.id;
      const canAfford = this.meta.gold >= ench.goldCost;
      const tierColor = enchantmentTierColor(ench.tier);
      const tierLabel = enchantmentTierLabel(ench.tier);

      // Background card
      const bg = this.add.rectangle(GAME_WIDTH / 2, y + 20, btnW, 50, 0x1a1a2e, 0.9)
        .setStrokeStyle(1, isCurrentEnchant ? 0xc084fc : 0x2a2a3e);
      this.listContainer.add(bg);

      // Enchantment name with tier stars
      const nameLabel = `${tierLabel} ${ench.name}`;
      const nameText = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 12, y + 8, nameLabel, {
        fontSize: "12px", color: isCurrentEnchant ? "#c084fc" : tierColor, fontFamily: "monospace", fontStyle: "bold",
      });
      this.listContainer.add(nameText);

      // Description + cost
      const costLabel = isCurrentEnchant ? "(Active)" : `${ench.goldCost}G`;
      const descLabel = `${ench.description}  |  ${costLabel}`;
      const descColor = isCurrentEnchant ? "#a78bfa" : (canAfford && hasEquippedItem ? "#888898" : "#554444");
      const descText = this.add.text(GAME_WIDTH / 2 - btnW / 2 + 12, y + 24, descLabel, {
        fontSize: "9px", color: descColor, fontFamily: "monospace",
      });
      this.listContainer.add(descText);

      // Enchant button
      if (isCurrentEnchant) {
        // Show "Applied" badge instead of button
        const appliedBtn = this.add.text(GAME_WIDTH / 2 + btnW / 2 - 12, y + 16, "[Active]", {
          fontSize: "10px", color: "#c084fc", fontFamily: "monospace",
          backgroundColor: "#2a1a3e",
          padding: { x: 6, y: 4 },
        }).setOrigin(1, 0);
        this.listContainer.add(appliedBtn);
      } else {
        // Determine if button should be enabled
        const canEnchant = hasEquippedItem && canAfford;
        let btnLabel = "[Enchant]";
        let btnColor = "#c084fc";
        let btnBg = "#2a1a3e";

        if (!hasEquippedItem) {
          btnLabel = "[No Item]";
          btnColor = "#444460";
          btnBg = "#1a1a1a";
        } else if (!canAfford) {
          btnColor = "#444460";
          btnBg = "#1a1a1a";
        }

        const enchantBtn = this.add.text(GAME_WIDTH / 2 + btnW / 2 - 12, y + 16, btnLabel, {
          fontSize: "10px", color: btnColor, fontFamily: "monospace",
          backgroundColor: btnBg,
          padding: { x: 6, y: 4 },
        }).setOrigin(1, 0);
        this.listContainer.add(enchantBtn);

        if (canEnchant) {
          enchantBtn.setInteractive();
          enchantBtn.on("pointerdown", () => {
            this.applyEnchantment(ench);
          });
        }
      }

      y += 56;
    }

    // Locked enchantment hint
    const totalEnchantments = 10;
    const lockedCount = totalEnchantments - available.length;
    if (lockedCount > 0) {
      const lockHint = this.add.text(GAME_WIDTH / 2, y + 5,
        `${lockedCount} more enchantment${lockedCount > 1 ? "s" : ""} unlock with more clears...`, {
        fontSize: "9px", color: "#444460", fontFamily: "monospace",
      }).setOrigin(0.5, 0);
      this.listContainer.add(lockHint);
    }
  }

  private applyEnchantment(ench: Enchantment) {
    if (this.meta.gold < ench.goldCost) return;
    if (!this.meta.equippedHeldItem) return;

    this.meta.gold -= ench.goldCost;
    this.meta.enchantmentId = ench.id;
    saveMeta(this.meta);
    this.scene.restart();
  }

  private purchaseItem(item: HeldItem) {
    if (this.meta.gold < item.cost) return;

    this.meta.gold -= item.cost;
    if (!this.meta.ownedHeldItems) this.meta.ownedHeldItems = [];
    this.meta.ownedHeldItems.push(item.id);

    // Auto-equip if nothing equipped
    if (!this.meta.equippedHeldItem) {
      this.meta.equippedHeldItem = item.id;
    }

    saveMeta(this.meta);
    this.scene.restart();
  }
}
