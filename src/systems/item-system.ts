/**
 * ItemSystem — Extracted from DungeonScene.
 * Manages floor items (spawn, pickup, rendering), bag UI, item usage, and quick-slot.
 */
import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, TILE_DISPLAY } from "../config";
import { Entity } from "../core/entity";
import { DIR_DX, DIR_DY } from "../core/direction";
import { TerrainType } from "../core/dungeon-generator";
import { ItemDef, ItemStack, rollFloorItem, MAX_INVENTORY, ITEM_DB, ItemCategory } from "../core/item";
import { getAffinityMultiplier } from "../core/item-affinity";
import { getTypeGem } from "../core/type-gems";
import { SkillEffect, SKILL_DB, createSkill } from "../core/skill";
import { DomHudElements, setDomHudInteractive } from "../ui/dom-hud";
import {
  sfxHeal, sfxMenuOpen, sfxMenuClose, sfxItemPickup, sfxBuff,
} from "../core/sound-manager";
import { serializeInventory, clearDungeonSave } from "../core/save-system";
import { ScoreChain, addChainAction, resetChain } from "../core/score-chain";
import { RunLog, RunLogEvent } from "../core/run-log";
import { getItemSellPrice } from "../core/dungeon-shop";
import {
  hasMutation, getMutationEffect, MutationType, DungeonMutation,
} from "../core/dungeon-mutations";
import { PokemonType } from "../core/type-chart";

// ── Public type for floor items ──

export interface FloorItem {
  x: number;
  y: number;
  item: ItemDef;
  sprite: Phaser.GameObjects.Text;
}

// ── Host interface: what ItemSystem needs from DungeonScene ──

export interface ItemHost {
  // ── Read-only game state ──
  readonly player: Entity;
  readonly enemies: Entity[];
  readonly allies: Entity[];
  readonly allEntities: Entity[];
  readonly currentFloor: number;
  readonly challengeMode: string | null;
  readonly dungeonDef: { id: string; floors: number; difficulty: number; itemsPerFloor: number };
  readonly turnManager: { isBusy: boolean; turn: number };
  readonly gameOver: boolean;
  readonly scoreChain: ScoreChain;
  readonly runLog: RunLog;

  // ── Mutable shared state ──
  inventory: ItemStack[];
  belly: number;
  readonly maxBelly: number;
  gold: number;
  questItemsCollected: number;
  questItemsUsed: boolean;
  chainActionThisTurn: boolean;
  activeTypeGems: Map<string, number>;

  // ── Shop-related read state ──
  readonly shopTiles: { x: number; y: number; shopIdx: number; sprite: Phaser.GameObjects.Text; priceTag: Phaser.GameObjects.Text }[];
  readonly shopItems: { itemId: string; price: number; stock: number }[];
  readonly shopClosed: boolean;
  readonly playerInShopRoom: boolean;

  // ── Modifiers / multipliers ──
  readonly ngPlusBonuses: { startWithItem: boolean; itemDropPercent: number };
  readonly difficultyMods: { itemDropMult: number; goldMult: number };
  readonly modifierEffects: { goldMult: number };
  readonly heldItemEffect: { goldBonus?: number };
  readonly enchantment: { id: string } | null;
  readonly talentEffects: { itemSpawnPercent?: number; goldPercent?: number };
  readonly relicEffects: { goldMult?: number };
  readonly floorMutations: DungeonMutation[];
  readonly persistentInventory: ItemStack[] | null;

  // ── DOM HUD ──
  readonly domHud: DomHudElements | null;

  // ── Overlay state checks ──
  readonly menuOpen: boolean;
  readonly settingsOpen: boolean;
  readonly shopOpen: boolean;
  readonly teamPanelOpen: boolean;
  readonly relicOverlayOpen: boolean;
  isEventOpen(): boolean;
  isFullMapOpen(): boolean;
  isShrineOpen(): boolean;

  // ── Callbacks (delegate back to DungeonScene) ──
  showLog(msg: string): void;
  updateHUD(): void;
  updateChainHUD(): void;
  updateTypeGemHUD(): void;
  resetBellyWarnings(): void;
  flashEntity(entity: Entity, effectiveness: number): void;
  checkDeath(entity: Entity): void;
  showDamagePopup(x: number, y: number, dmg: number, alpha: number): void;
  showHealPopup(x: number, y: number, amount: number): void;
  findWalkableTile(): { x: number; y: number } | null;
  tileToPixelX(tileX: number): number;
  tileToPixelY(tileY: number): number;
  triggerShopTheft(): void;
  showSellPrompt(inventoryIndex: number): void;

  // ── Scene transition support ──
  starterId: string;
  seenSpecies: Set<string>;
  enemiesDefeated: number;
  getQuestTrackingData(): Record<string, unknown>;
}

// ── ItemSystem class ──

export class ItemSystem {
  // ── Floor item state (moved from DungeonScene) ──
  floorItems: FloorItem[] = [];

  // ── Bag UI state ──
  bagOpen = false;
  private bagUI: Phaser.GameObjects.GameObject[] = [];

  // ── Quick-slot ──
  lastUsedItemId: string | null = null;

  constructor(private host: ItemHost) {}

  protected get scene(): Phaser.Scene { return this.host as any; }

  /** Reset all item state for a new floor */
  reset() {
    this.floorItems = [];
    this.bagOpen = false;
    this.bagUI = [];
  }

  // ══════════════════════════════════════════════
  // ── Floor Item Spawning
  // ══════════════════════════════════════════════

  /** Get the icon character for an item */
  private itemIcon(item: ItemDef): string {
    return item.category === "berry" ? "●"
      : item.category === "seed" ? "◆"
      : item.category === "gem" ? "◇"
      : "★";
  }

  /** Get the color for an item sprite */
  private itemColor(item: ItemDef): string {
    return item.category === "berry" ? "#ff6b9d"
      : item.category === "seed" ? "#4ade80"
      : item.category === "gem" ? "#ddaaff"
      : "#60a5fa";
  }

  /** Create a floor item sprite at tile position */
  createFloorItemSprite(ix: number, iy: number, item: ItemDef, colorOverride?: string): Phaser.GameObjects.Text {
    const icon = this.itemIcon(item);
    const color = colorOverride ?? this.itemColor(item);
    return this.scene.add.text(
      ix * TILE_DISPLAY + TILE_DISPLAY / 2,
      iy * TILE_DISPLAY + TILE_DISPLAY / 2,
      icon, { fontSize: "16px", color, fontFamily: "monospace" }
    ).setOrigin(0.5).setDepth(6);
  }

  /** Initialize inventory from persistent data and give NG+ start item */
  initInventory() {
    const host = this.host;
    host.inventory = host.persistentInventory ?? [];

    // NG+ bonus: start with a random item on new runs (floor 1, no persisted inventory)
    if (host.ngPlusBonuses.startWithItem && host.currentFloor === 1 && !host.persistentInventory) {
      const startItem = rollFloorItem();
      const existing = host.inventory.find(s => s.item.id === startItem.id && startItem.stackable);
      if (existing) existing.count++;
      else host.inventory.push({ item: startItem, count: 1 });
    }
  }

  /**
   * Spawn floor items during dungeon generation.
   * Returns the count of items actually placed.
   */
  spawnFloorItems(
    rooms: { x: number; y: number; w: number; h: number }[],
    terrain: TerrainType[][],
    playerStart: { x: number; y: number },
    stairsPos: { x: number; y: number },
  ): number {
    const host = this.host;
    const ngItemDropMult = 1 + host.ngPlusBonuses.itemDropPercent / 100;
    const enchItemMult = host.enchantment?.id === "lucky" ? 1.05 : 1.0;
    const mutItemMult = hasMutation(host.floorMutations, MutationType.ItemRain) ? getMutationEffect(MutationType.ItemRain, "itemMult") : 1;
    const talentItemMult = 1 + (host.talentEffects.itemSpawnPercent ?? 0) / 100;
    const itemCount = Math.max(1, Math.floor(
      host.dungeonDef.itemsPerFloor * host.difficultyMods.itemDropMult * ngItemDropMult * enchItemMult * mutItemMult * talentItemMult
    ));

    const occupied = new Set<string>();
    occupied.add(`${stairsPos.x},${stairsPos.y}`);
    occupied.add(`${playerStart.x},${playerStart.y}`);
    for (const fi of this.floorItems) occupied.add(`${fi.x},${fi.y}`);

    let placed = 0;
    for (let i = 0; i < itemCount; i++) {
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      const ix = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
      const iy = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
      if (terrain[iy][ix] !== TerrainType.GROUND) continue;
      const key = `${ix},${iy}`;
      if (occupied.has(key)) continue;

      const item = rollFloorItem();
      const sprite = this.createFloorItemSprite(ix, iy, item);
      this.floorItems.push({ x: ix, y: iy, item, sprite });
      occupied.add(key);
      placed++;
    }
    return placed;
  }

  /**
   * Spawn extra items (treasure mutation / treasure floor event).
   * Uses golden color override.
   */
  spawnTreasureItems(
    rooms: { x: number; y: number; w: number; h: number }[],
    terrain: TerrainType[][],
    stairsPos: { x: number; y: number },
    count: number,
  ) {
    const occupied = this.getOccupiedPositions();
    occupied.add(`${stairsPos.x},${stairsPos.y}`);

    for (let i = 0; i < count; i++) {
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      const ix = room.x + 1 + Math.floor(Math.random() * Math.max(1, room.w - 2));
      const iy = room.y + 1 + Math.floor(Math.random() * Math.max(1, room.h - 2));
      if (terrain[iy]?.[ix] !== TerrainType.GROUND) continue;
      const key = `${ix},${iy}`;
      if (occupied.has(key)) continue;

      const item = rollFloorItem();
      const sprite = this.createFloorItemSprite(ix, iy, item, "#fde68a");
      this.floorItems.push({ x: ix, y: iy, item, sprite });
      occupied.add(key);
    }
  }

  /**
   * Spawn extra items in monster house treasure room.
   */
  spawnMonsterHouseItems(
    terrain: TerrainType[][],
    stairsPos: { x: number; y: number },
    room: { x: number; y: number; w: number; h: number },
    count: number,
  ) {
    const occupied = this.getOccupiedPositions();
    occupied.add(`${stairsPos.x},${stairsPos.y}`);

    for (let ti = 0; ti < count; ti++) {
      const ix = room.x + 1 + Math.floor(Math.random() * Math.max(1, room.w - 2));
      const iy = room.y + 1 + Math.floor(Math.random() * Math.max(1, room.h - 2));
      if (terrain[iy]?.[ix] !== TerrainType.GROUND) continue;
      const key = `${ix},${iy}`;
      if (occupied.has(key)) continue;

      const item = rollFloorItem();
      const sprite = this.createFloorItemSprite(ix, iy, item);
      this.floorItems.push({ x: ix, y: iy, item, sprite });
      occupied.add(key);
    }
  }

  /** Spawn reward items on the floor with pop-in animation */
  spawnMonsterHouseRewardItems(room: { x: number; y: number; w: number; h: number }, terrain: TerrainType[][], count: number) {
    const scene = this.scene;
    const occupied = this.getOccupiedPositions();

    for (let i = 0; i < count; i++) {
      const ix = room.x + 1 + Math.floor(Math.random() * Math.max(1, room.w - 2));
      const iy = room.y + 1 + Math.floor(Math.random() * Math.max(1, room.h - 2));
      if (terrain[iy]?.[ix] !== TerrainType.GROUND) continue;
      const key = `${ix},${iy}`;
      if (occupied.has(key)) continue;

      const item = rollFloorItem();
      const sprite = this.createFloorItemSprite(ix, iy, item);

      // Reward items spawn with a pop-in animation
      sprite.setScale(0);
      scene.tweens.add({
        targets: sprite,
        scaleX: 1, scaleY: 1,
        duration: 400,
        delay: i * 150,
        ease: "Back.easeOut",
      });

      this.floorItems.push({ x: ix, y: iy, item, sprite });
      occupied.add(key);
    }
  }

  /** Destroy all floor items (e.g. FamineFloor event) */
  clearFloorItems() {
    for (const fi of this.floorItems) {
      if (fi.sprite) fi.sprite.destroy();
    }
    this.floorItems = [];
  }

  /** Get occupied positions set for trap/hazard placement */
  getOccupiedPositions(): Set<string> {
    const set = new Set<string>();
    for (const fi of this.floorItems) set.add(`${fi.x},${fi.y}`);
    return set;
  }

  // ══════════════════════════════════════════════
  // ── Floor Item Check (step notification)
  // ══════════════════════════════════════════════

  /** Check if player is standing on a floor item and show notification */
  checkFloorItem() {
    const itemHere = this.floorItems.find(
      fi => fi.x === this.host.player.tileX && fi.y === this.host.player.tileY
    );
    if (itemHere) {
      this.host.showLog(`There's a ${itemHere.item.name} here. [줍기] to pick up.`);
    }
  }

  // ══════════════════════════════════════════════
  // ── Pickup
  // ══════════════════════════════════════════════

  pickupItem() {
    const host = this.host;
    if (host.turnManager.isBusy || !host.player.alive || host.gameOver) return;

    if (host.challengeMode === "noItems") {
      host.showLog("Items are forbidden!");
      return;
    }

    // Anti-theft: check if player is stepping on a shop tile
    const shopTile = host.shopTiles.find(st => st.x === host.player.tileX && st.y === host.player.tileY);
    if (shopTile && !host.shopClosed) {
      const si = host.shopItems[shopTile.shopIdx];
      if (si && si.price > 0) {
        const itemDef = ITEM_DB[si.itemId];
        if (itemDef) {
          // Give the item to the player
          if (host.inventory.length < MAX_INVENTORY) {
            const existing = host.inventory.find(s => s.item.id === si.itemId && itemDef.stackable);
            if (existing) existing.count++;
            else host.inventory.push({ item: itemDef, count: 1 });
          }
          // Remove shop tile visual
          shopTile.sprite.destroy();
          shopTile.priceTag.destroy();
          const stIdx = host.shopTiles.indexOf(shopTile);
          if (stIdx >= 0) host.shopTiles.splice(stIdx, 1);
          host.shopItems[shopTile.shopIdx] = { itemId: "", price: 0, stock: 0 };
          // Trigger theft
          host.triggerShopTheft();
          host.updateHUD();
          return;
        }
      }
    }

    const idx = this.floorItems.findIndex(
      fi => fi.x === host.player.tileX && fi.y === host.player.tileY
    );
    if (idx === -1) {
      host.showLog("Nothing here to pick up.");
      return;
    }

    if (host.inventory.length >= MAX_INVENTORY) {
      host.showLog("Inventory is full!");
      return;
    }

    const fi = this.floorItems[idx];
    // Add to inventory (stack if possible)
    const existing = host.inventory.find(s => s.item.id === fi.item.id && fi.item.stackable);
    if (existing) {
      existing.count++;
    } else {
      host.inventory.push({ item: fi.item, count: 1 });
    }

    sfxItemPickup();
    fi.sprite.destroy();
    this.floorItems.splice(idx, 1);
    host.showLog(`Picked up ${fi.item.name}!`);
    // Run log: item picked up
    host.runLog.add(RunLogEvent.ItemPickedUp, fi.item.name, host.currentFloor, host.turnManager.turn);
    this.updateQuickSlotLabel();
    host.questItemsCollected++;

    // Score chain: item pickup
    addChainAction(host.scoreChain, "itemPickup");
    host.chainActionThisTurn = true;
    host.updateChainHUD();
  }

  // ══════════════════════════════════════════════
  // ── Bag UI
  // ══════════════════════════════════════════════

  toggleBag() {
    if (this.bagOpen) {
      this.closeBag();
    } else {
      this.openBag();
    }
  }

  openBag() {
    const host = this.host;
    const scene = host as any as Phaser.Scene;
    if (host.turnManager.isBusy || host.gameOver || host.menuOpen || host.settingsOpen || host.teamPanelOpen || host.isEventOpen() || host.isFullMapOpen() || host.relicOverlayOpen) return;
    sfxMenuOpen();
    this.bagOpen = true;
    if (host.domHud) setDomHudInteractive(host.domHud, false);

    // Dark overlay
    const overlay = scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.8
    ).setScrollFactor(0).setDepth(150).setInteractive();
    this.bagUI.push(overlay);

    const title = scene.add.text(GAME_WIDTH / 2, 30, "── Bag ──", {
      fontSize: "14px", color: "#fbbf24", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(151);
    this.bagUI.push(title);

    const inShopForSell = host.playerInShopRoom && !host.shopClosed;

    if (host.inventory.length === 0) {
      const empty = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "Empty", {
        fontSize: "12px", color: "#666680", fontFamily: "monospace",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(151);
      this.bagUI.push(empty);
    } else {
      host.inventory.forEach((stack, i) => {
        const y = 60 + i * 32;
        const icon = stack.item.category === "berry" ? "●" : stack.item.category === "seed" ? "◆" : stack.item.category === "gem" ? "◇" : "★";
        const countStr = stack.count > 1 ? ` x${stack.count}` : "";
        // Show sell price next to item name when in shop room
        const sellStr = inShopForSell ? ` (Sell: ${getItemSellPrice(stack.item.id, host.currentFloor)}G)` : "";
        const btn = scene.add.text(20, y, `${icon} ${stack.item.name}${countStr}${sellStr}`, {
          fontSize: "11px", color: "#e0e0e0", fontFamily: "monospace",
          backgroundColor: "#1a1a3e", padding: { x: 4, y: 4 },
          fixedWidth: inShopForSell ? 250 : 200,
        }).setScrollFactor(0).setDepth(151).setInteractive();

        const useBtn = scene.add.text(inShopForSell ? 280 : 230, y, "[Use]", {
          fontSize: "11px", color: "#4ade80", fontFamily: "monospace",
          padding: { x: 4, y: 4 },
        }).setScrollFactor(0).setDepth(151).setInteractive();

        const desc = scene.add.text(20, y + 16, stack.item.description, {
          fontSize: "9px", color: "#666680", fontFamily: "monospace",
        }).setScrollFactor(0).setDepth(151);

        useBtn.on("pointerdown", () => {
          this.useItem(i);
          this.closeBag();
        });

        this.bagUI.push(btn, useBtn, desc);

        // Add Sell button when in shop room
        if (inShopForSell) {
          const sellBtn = scene.add.text(320, y, "[Sell]", {
            fontSize: "11px", color: "#fbbf24", fontFamily: "monospace",
            padding: { x: 4, y: 4 },
          }).setScrollFactor(0).setDepth(151).setInteractive();

          sellBtn.on("pointerdown", () => {
            this.closeBag();
            host.showSellPrompt(i);
          });

          this.bagUI.push(sellBtn);
        }
      });
    }

    // Close button
    const closeBtn = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 50, "[Close]", {
      fontSize: "14px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(151).setInteractive();
    closeBtn.on("pointerdown", () => this.closeBag());
    this.bagUI.push(closeBtn);

    overlay.on("pointerdown", () => this.closeBag());
  }

  closeBag() {
    sfxMenuClose();
    this.bagOpen = false;
    if (this.host.domHud) setDomHudInteractive(this.host.domHud, true);
    this.bagUI.forEach(obj => obj.destroy());
    this.bagUI = [];
  }

  // ══════════════════════════════════════════════
  // ── Quick-slot
  // ══════════════════════════════════════════════

  /** Quick-slot: use the last-used item type again */
  useQuickSlot() {
    const host = this.host;
    if (host.turnManager.isBusy || !host.player.alive || host.gameOver || host.isFullMapOpen()) return;
    if (!this.lastUsedItemId) {
      host.showLog("No recent item. Use an item from the Bag first.");
      return;
    }
    const idx = host.inventory.findIndex(s => s.item.id === this.lastUsedItemId);
    if (idx === -1) {
      host.showLog(`No ${this.lastUsedItemId} left!`);
      return;
    }
    this.useItem(idx);
    this.closeBag(); // safety: close bag if somehow open
  }

  /** Update the quick-slot button label to show last used item (DOM HUD) */
  updateQuickSlotLabel() {
    if (!this.host.domHud) return;
    const btn = this.host.domHud.quickSlotBtn;
    if (!this.lastUsedItemId) {
      btn.textContent = "—";
      btn.style.color = "#555570";
      return;
    }
    const stack = this.host.inventory.find(s => s.item.id === this.lastUsedItemId);
    if (!stack) {
      btn.textContent = "✕";
      btn.style.color = "#555570";
      return;
    }
    const icon = stack.item.category === "berry" ? "●" : stack.item.category === "seed" ? "◆" : stack.item.category === "gem" ? "◇" : "★";
    const countStr = stack.count > 1 ? `${stack.count}` : "";
    btn.textContent = `${icon}${countStr}`;
    btn.style.color = "#4ade80";
  }

  // ══════════════════════════════════════════════
  // ── Item Usage
  // ══════════════════════════════════════════════

  useItem(index: number) {
    const host = this.host;
    if (host.challengeMode === "noItems") {
      host.showLog("Items are forbidden!");
      return;
    }

    const stack = host.inventory[index];
    if (!stack) return;

    const item = stack.item;
    this.lastUsedItemId = item.id;
    // Run log: item used
    host.runLog.add(RunLogEvent.ItemUsed, item.name, host.currentFloor, host.turnManager.turn);
    host.questItemsUsed = true;
    sfxHeal();

    switch (item.id) {
      case "oranBerry": {
        const affinityMult = getAffinityMultiplier(host.player.types, item.category, item.id);
        const baseHeal = Math.floor(30 * affinityMult);
        const heal = Math.min(baseHeal, host.player.stats.maxHp - host.player.stats.hp);
        host.player.stats.hp += heal;
        host.showLog(`Used Oran Berry! Restored ${heal} HP.${affinityMult > 1 ? " (Affinity Bonus!)" : ""}`);
        if (host.player.sprite) host.showHealPopup(host.player.sprite.x, host.player.sprite.y, heal);
        // Score chain: healing item resets chain
        if (host.scoreChain.currentMultiplier > 1.0) {
          resetChain(host.scoreChain);
          host.showLog("Chain reset (healed).");
          host.updateChainHUD();
        }
        break;
      }
      case "sitrusBerry": {
        const affinityMult = getAffinityMultiplier(host.player.types, item.category, item.id);
        const heal = Math.floor(host.player.stats.maxHp * 0.5 * affinityMult);
        const actual = Math.min(heal, host.player.stats.maxHp - host.player.stats.hp);
        host.player.stats.hp += actual;
        host.showLog(`Used Sitrus Berry! Restored ${actual} HP.${affinityMult > 1 ? " (Affinity Bonus!)" : ""}`);
        if (host.player.sprite) host.showHealPopup(host.player.sprite.x, host.player.sprite.y, actual);
        // Score chain: healing item resets chain
        if (host.scoreChain.currentMultiplier > 1.0) {
          resetChain(host.scoreChain);
          host.showLog("Chain reset (healed).");
          host.updateChainHUD();
        }
        break;
      }
      case "pechaberry": {
        host.player.statusEffects = [];
        host.showLog("Used Pecha Berry! Status cleared.");
        break;
      }
      case "reviveSeed": {
        const fainted = host.allies.find(a => !a.alive);
        if (fainted) {
          fainted.alive = true;
          fainted.stats.hp = Math.floor(fainted.stats.maxHp / 2);
          if (fainted.sprite) fainted.sprite.setAlpha(1);
          host.showLog(`Used Revive Seed! ${fainted.speciesId} was revived!`);
        } else {
          // Auto-use on death — just show message for now
          host.showLog("Revive Seed will activate if you faint.");
          return; // Don't consume
        }
        break;
      }
      case "blastSeed": {
        const affinityMult = getAffinityMultiplier(host.player.types, item.category, item.id);
        const dmg = Math.floor(40 * affinityMult);
        const dx = DIR_DX[host.player.facing];
        const dy = DIR_DY[host.player.facing];
        const tx = host.player.tileX + dx;
        const ty = host.player.tileY + dy;
        const target = host.enemies.find(e => e.alive && e.tileX === tx && e.tileY === ty);
        if (target) {
          target.stats.hp = Math.max(0, target.stats.hp - dmg);
          host.flashEntity(target, 2.0);
          host.showLog(`Blast Seed hit ${target.name}! ${dmg} dmg!${affinityMult > 1 ? " (Affinity Bonus!)" : ""}`);
          host.checkDeath(target);
        } else {
          host.showLog("Blast Seed missed! No enemy in front.");
        }
        break;
      }
      case "sleepSeed": {
        const dx = DIR_DX[host.player.facing];
        const dy = DIR_DY[host.player.facing];
        const tx = host.player.tileX + dx;
        const ty = host.player.tileY + dy;
        const target = host.enemies.find(e => e.alive && e.tileX === tx && e.tileY === ty);
        if (target) {
          target.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 5 });
          host.showLog(`Sleep Seed hit ${target.name}! Paralyzed!`);
        } else {
          host.showLog("Sleep Seed missed! No enemy in front.");
        }
        break;
      }
      case "escapeOrb": {
        host.showLog("Used Escape Orb! Escaped the dungeon!");
        (host as any).gameOver = true;
        clearDungeonSave();
        const scene = host as any as Phaser.Scene;
        scene.cameras.main.fadeOut(500);
        scene.time.delayedCall(600, () => {
          scene.scene.start("HubScene", {
            gold: 0,
            cleared: false,
            bestFloor: host.currentFloor,
            enemiesDefeated: host.enemiesDefeated,
            turns: host.turnManager.turn,
            dungeonId: host.dungeonDef.id,
            starter: host.starterId,
            challengeMode: host.challengeMode ?? undefined,
            pokemonSeen: Array.from(host.seenSpecies),
            inventory: serializeInventory(host.inventory),
            ...host.getQuestTrackingData(),
          });
        });
        break;
      }
      case "luminousOrb": {
        host.showLog("Used Luminous Orb! Floor layout revealed!");
        break;
      }
      case "allPowerOrb": {
        host.player.statusEffects.push({ type: SkillEffect.AtkUp, turnsLeft: 10 });
        host.player.statusEffects.push({ type: SkillEffect.DefUp, turnsLeft: 10 });
        sfxBuff();
        host.showLog("Used All-Power Orb! ATK & DEF boosted!");
        break;
      }
      case "apple": {
        const affinityMult = getAffinityMultiplier(host.player.types, item.category, item.id);
        const restore = Math.min(Math.floor(50 * affinityMult), host.maxBelly - host.belly);
        host.belly += restore;
        host.resetBellyWarnings();
        host.showLog(`Ate an Apple! Belly +${restore}. (${Math.floor(host.belly)}/${host.maxBelly})${affinityMult > 1 ? " (Affinity Bonus!)" : ""}`);
        break;
      }
      case "bigApple": {
        host.belly = host.maxBelly;
        host.resetBellyWarnings();
        host.showLog(`Ate a Big Apple! Belly fully restored!`);
        break;
      }
      case "grimyFood": {
        const affinityMult = getAffinityMultiplier(host.player.types, item.category, item.id);
        const grimyRestore = Math.min(Math.floor(30 * affinityMult), host.maxBelly - host.belly);
        host.belly += grimyRestore;
        host.resetBellyWarnings();
        host.showLog(`Ate Grimy Food... Belly +${grimyRestore}. (${Math.floor(host.belly)}/${host.maxBelly})${affinityMult > 1 ? " (Affinity Bonus!)" : ""}`);
        // 50% chance to cause Burn (poison-like DoT)
        if (Math.random() < 0.5) {
          if (!host.player.statusEffects.some(s => s.type === SkillEffect.Burn)) {
            host.player.statusEffects.push({ type: SkillEffect.Burn, turnsLeft: 5 });
            host.showLog("Ugh! The food was bad... You got burned!");
          }
        } else {
          // 50% chance: lose some HP directly
          const grimyDmg = Math.max(1, Math.floor(host.player.stats.maxHp * 0.1));
          host.player.stats.hp = Math.max(1, host.player.stats.hp - grimyDmg);
          if (host.player.sprite) host.showDamagePopup(host.player.sprite.x, host.player.sprite.y, grimyDmg, 0.8);
          host.showLog(`The food was rotten! Lost ${grimyDmg} HP!`);
        }
        break;
      }
      case "warpOrb": {
        let warped = 0;
        for (const e of host.enemies) {
          if (!e.alive) continue;
          const pt = host.findWalkableTile();
          if (pt) {
            e.tileX = pt.x; e.tileY = pt.y;
            if (e.sprite) e.sprite.setPosition(host.tileToPixelX(pt.x), host.tileToPixelY(pt.y));
            warped++;
          }
        }
        host.showLog(`Used Warp Orb! ${warped} enemies warped away!`);
        break;
      }
      case "foeHoldOrb": {
        let held = 0;
        for (const e of host.enemies) {
          if (!e.alive) continue;
          e.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 5 });
          held++;
        }
        host.showLog(`Used Foe-Hold Orb! ${held} enemies paralyzed!`);
        break;
      }
      case "maxElixir": {
        for (const sk of host.player.skills) { sk.currentPp = sk.pp; }
        host.showLog("Used Max Elixir! All PP restored!");
        break;
      }
      case "warpSeed": {
        const pt = host.findWalkableTile();
        if (pt) {
          host.player.tileX = pt.x; host.player.tileY = pt.y;
          if (host.player.sprite) host.player.sprite.setPosition(host.tileToPixelX(pt.x), host.tileToPixelY(pt.y));
          host.showLog("Used Warp Seed! Warped to a new location!");
        } else {
          host.showLog("Warp Seed fizzled...");
        }
        break;
      }
      case "stunSeed": {
        const dx = DIR_DX[host.player.facing];
        const dy = DIR_DY[host.player.facing];
        const tx = host.player.tileX + dx;
        const ty = host.player.tileY + dy;
        const target = host.enemies.find(e => e.alive && e.tileX === tx && e.tileY === ty);
        if (target) {
          target.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 3 });
          host.showLog(`Stun Seed hit ${target.name}! Stunned for 3 turns!`);
        } else {
          host.showLog("Stun Seed missed! No enemy in front.");
        }
        break;
      }
      case "healSeed": {
        host.player.statusEffects = [];
        const affinityMult = getAffinityMultiplier(host.player.types, item.category, item.id);
        const baseHeal = Math.floor(20 * affinityMult);
        const heal = Math.min(baseHeal, host.player.stats.maxHp - host.player.stats.hp);
        host.player.stats.hp += heal;
        host.showLog(`Used Heal Seed! Status cleared, restored ${heal} HP.${affinityMult > 1 ? " (Affinity Bonus!)" : ""}`);
        if (host.player.sprite) host.showHealPopup(host.player.sprite.x, host.player.sprite.y, heal);
        break;
      }
      case "vanishOrb": {
        host.player.statusEffects.push({ type: SkillEffect.DefUp, turnsLeft: 10 });
        if (host.player.sprite) host.player.sprite.setAlpha(0.3);
        host.showLog("Used Vanish Orb! You became invisible for 10 turns!");
        break;
      }
      // ── Base throwable/stat items ──
      case "pebble": {
        const dx = DIR_DX[host.player.facing];
        const dy = DIR_DY[host.player.facing];
        const tx = host.player.tileX + dx;
        const ty = host.player.tileY + dy;
        const target = host.enemies.find(e => e.alive && e.tileX === tx && e.tileY === ty);
        if (target) {
          target.stats.hp = Math.max(0, target.stats.hp - 15);
          host.flashEntity(target, 2.0);
          host.showLog(`Pebble hit ${target.name}! 15 dmg!`);
          host.checkDeath(target);
        } else {
          host.showLog("Pebble missed! No enemy in front.");
        }
        break;
      }
      case "gravelrock": {
        const dx = DIR_DX[host.player.facing];
        const dy = DIR_DY[host.player.facing];
        const tx = host.player.tileX + dx;
        const ty = host.player.tileY + dy;
        const target = host.enemies.find(e => e.alive && e.tileX === tx && e.tileY === ty);
        if (target) {
          target.stats.hp = Math.max(0, target.stats.hp - 25);
          host.flashEntity(target, 2.0);
          host.showLog(`Gravelrock hit ${target.name}! 25 dmg!`);
          host.checkDeath(target);
        } else {
          host.showLog("Gravelrock missed! No enemy in front.");
        }
        break;
      }
      case "xAttack": {
        host.player.statusEffects.push({ type: SkillEffect.AtkUp, turnsLeft: 10 });
        sfxBuff();
        host.showLog("Used X-Attack! ATK boosted for 10 turns!");
        break;
      }
      case "xDefend": {
        host.player.statusEffects.push({ type: SkillEffect.DefUp, turnsLeft: 10 });
        sfxBuff();
        host.showLog("Used X-Defend! DEF boosted for 10 turns!");
        break;
      }
      // ── Upgraded (Synthesized) Items ──
      case "megaOranBerry": {
        const affinityMult = getAffinityMultiplier(host.player.types, item.category, item.id);
        const baseHeal = Math.floor(80 * affinityMult);
        const heal = Math.min(baseHeal, host.player.stats.maxHp - host.player.stats.hp);
        host.player.stats.hp += heal;
        host.showLog(`Used Mega Oran Berry! Restored ${heal} HP.${affinityMult > 1 ? " (Affinity Bonus!)" : ""}`);
        if (host.player.sprite) host.showHealPopup(host.player.sprite.x, host.player.sprite.y, heal);
        if (host.scoreChain.currentMultiplier > 1.0) {
          resetChain(host.scoreChain);
          host.showLog("Chain reset (healed).");
          host.updateChainHUD();
        }
        break;
      }
      case "megaSitrusBerry": {
        const affinityMult = getAffinityMultiplier(host.player.types, item.category, item.id);
        const baseHeal = Math.floor(150 * affinityMult);
        const heal = Math.min(baseHeal, host.player.stats.maxHp - host.player.stats.hp);
        host.player.stats.hp += heal;
        host.showLog(`Used Mega Sitrus Berry! Restored ${heal} HP.${affinityMult > 1 ? " (Affinity Bonus!)" : ""}`);
        if (host.player.sprite) host.showHealPopup(host.player.sprite.x, host.player.sprite.y, heal);
        if (host.scoreChain.currentMultiplier > 1.0) {
          resetChain(host.scoreChain);
          host.showLog("Chain reset (healed).");
          host.updateChainHUD();
        }
        break;
      }
      case "goldenApple": {
        const affinityMult = getAffinityMultiplier(host.player.types, item.category, item.id);
        const restore = Math.min(Math.floor(200 * affinityMult), host.maxBelly - host.belly);
        host.belly += restore;
        host.resetBellyWarnings();
        host.showLog(`Ate a Golden Apple! Belly +${restore}. (${Math.floor(host.belly)}/${host.maxBelly})${affinityMult > 1 ? " (Affinity Bonus!)" : ""}`);
        break;
      }
      case "crystalPebble": {
        const dx = DIR_DX[host.player.facing];
        const dy = DIR_DY[host.player.facing];
        const tx = host.player.tileX + dx;
        const ty = host.player.tileY + dy;
        const target = host.enemies.find(e => e.alive && e.tileX === tx && e.tileY === ty);
        if (target) {
          target.stats.hp = Math.max(0, target.stats.hp - 30);
          host.flashEntity(target, 2.0);
          host.showLog(`Crystal Pebble hit ${target.name}! 30 dmg!`);
          host.checkDeath(target);
        } else {
          host.showLog("Crystal Pebble missed! No enemy in front.");
        }
        break;
      }
      case "meteorRock": {
        const dx = DIR_DX[host.player.facing];
        const dy = DIR_DY[host.player.facing];
        const tx = host.player.tileX + dx;
        const ty = host.player.tileY + dy;
        const target = host.enemies.find(e => e.alive && e.tileX === tx && e.tileY === ty);
        if (target) {
          target.stats.hp = Math.max(0, target.stats.hp - 50);
          host.flashEntity(target, 2.0);
          host.showLog(`Meteor Rock hit ${target.name}! 50 dmg!`);
          host.checkDeath(target);
        } else {
          host.showLog("Meteor Rock missed! No enemy in front.");
        }
        break;
      }
      case "autoReviver": {
        // Auto-use on death — just show message
        host.showLog("Auto Reviver will activate instantly if you faint.");
        return; // Don't consume
      }
      case "megaElixir": {
        for (const sk of host.player.skills) {
          sk.currentPp = sk.pp + 10;
        }
        host.showLog("Used Mega Elixir! All PP restored + 10 bonus PP!");
        break;
      }
      case "megaBlastSeed": {
        const affinityMult = getAffinityMultiplier(host.player.types, item.category, item.id);
        const dmg = Math.floor(80 * affinityMult);
        const dx = DIR_DX[host.player.facing];
        const dy = DIR_DY[host.player.facing];
        const tx = host.player.tileX + dx;
        const ty = host.player.tileY + dy;
        const target = host.enemies.find(e => e.alive && e.tileX === tx && e.tileY === ty);
        if (target) {
          target.stats.hp = Math.max(0, target.stats.hp - dmg);
          host.flashEntity(target, 2.0);
          host.showLog(`Mega Blast Seed hit ${target.name}! ${dmg} dmg!${affinityMult > 1 ? " (Affinity Bonus!)" : ""}`);
          host.checkDeath(target);
        } else {
          host.showLog("Mega Blast Seed missed! No enemy in front.");
        }
        break;
      }
      case "deepSleepSeed": {
        const dx = DIR_DX[host.player.facing];
        const dy = DIR_DY[host.player.facing];
        const tx = host.player.tileX + dx;
        const ty = host.player.tileY + dy;
        const target = host.enemies.find(e => e.alive && e.tileX === tx && e.tileY === ty);
        if (target) {
          target.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 8 });
          host.showLog(`Deep Sleep Seed hit ${target.name}! Deep sleep for 8 turns!`);
        } else {
          host.showLog("Deep Sleep Seed missed! No enemy in front.");
        }
        break;
      }
      case "megaXAttack": {
        host.player.statusEffects.push({ type: SkillEffect.AtkUp, turnsLeft: 15 });
        sfxBuff();
        host.showLog("Used Mega X-Attack! ATK greatly boosted for 15 turns!");
        break;
      }
      case "megaXDefend": {
        host.player.statusEffects.push({ type: SkillEffect.DefUp, turnsLeft: 15 });
        sfxBuff();
        host.showLog("Used Mega X-Defend! DEF greatly boosted for 15 turns!");
        break;
      }
      default: {
        // Type Gem handling
        if (item.category === ItemCategory.Gem && item.gemId) {
          const gem = getTypeGem(item.gemId);
          if (gem) {
            host.activeTypeGems.set(gem.type, gem.boostPercent);
            sfxBuff();
            host.showLog(`Used ${gem.name}! ${gem.type}-type moves boosted by ${gem.boostPercent}% this floor!`);
            host.updateTypeGemHUD();
            break;
          }
        }
        // TM handling
        if (item.tmSkillId) {
          this.useTM(index, item);
          return; // Don't consume here — handled inside useTM
        }
        host.showLog(`Used ${item.name}.`);
        break;
      }
    }

    // Consume item
    stack.count--;
    if (stack.count <= 0) {
      host.inventory.splice(index, 1);
    }

    host.updateHUD();
    this.updateQuickSlotLabel();
  }

  /** Use a TM to teach a skill — replaces the first (weakest) skill */
  private useTM(index: number, item: ItemDef) {
    const host = this.host;
    if (!item.tmSkillId) return;
    const newSkill = SKILL_DB[item.tmSkillId];
    if (!newSkill) { host.showLog("Invalid TM!"); return; }

    // Replace the skill with lowest power (or first non-Tackle)
    let replaceIdx = 0;
    let lowestPower = Infinity;
    for (let i = 0; i < host.player.skills.length; i++) {
      if (host.player.skills[i].power < lowestPower) {
        lowestPower = host.player.skills[i].power;
        replaceIdx = i;
      }
    }

    const oldName = host.player.skills[replaceIdx].name;
    host.player.skills[replaceIdx] = createSkill(SKILL_DB[item.tmSkillId]);
    host.showLog(`Learned ${newSkill.name}! (replaced ${oldName})`);

    // Consume TM
    const stack = host.inventory[index];
    stack.count--;
    if (stack.count <= 0) host.inventory.splice(index, 1);
    host.updateHUD();
  }

  /** Sync quick-slot display during HUD sync */
  syncQuickSlotHud() {
    const hud = this.host.domHud;
    if (!hud) return;
    if (!this.lastUsedItemId) {
      hud.quickSlotBtn.textContent = "—";
      hud.quickSlotBtn.style.color = "#555570";
    } else {
      const stack = this.host.inventory.find(s => s.item.id === this.lastUsedItemId);
      if (!stack) {
        hud.quickSlotBtn.textContent = "✕";
        hud.quickSlotBtn.style.color = "#555570";
      } else {
        const icon = stack.item.category === "berry" ? "●" : stack.item.category === "seed" ? "◆" : stack.item.category === "gem" ? "◇" : "★";
        const countStr = stack.count > 1 ? `${stack.count}` : "";
        hud.quickSlotBtn.textContent = `${icon}${countStr}`;
        hud.quickSlotBtn.style.color = "#4ade80";
      }
    }
  }
}
