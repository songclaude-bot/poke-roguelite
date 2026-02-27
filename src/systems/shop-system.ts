/**
 * ShopSystem — Extracted from DungeonScene.
 * Manages Kecleon Shop: placement, UI, buying, selling, theft detection, and visuals.
 */
import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, TILE_DISPLAY, TILE_SCALE } from "../config";
import { Entity } from "../core/entity";
import { Direction } from "../core/direction";
import { TerrainType } from "../core/dungeon-generator";
import { DungeonDef, getDungeonFloorEnemies } from "../core/dungeon-data";
import { SPECIES, createSpeciesSkills } from "../core/pokemon-data";
import { SPECIES_ABILITIES } from "../core/ability";
import { ItemDef, ItemStack, MAX_INVENTORY, ITEM_DB } from "../core/item";
import {
  ShopItem, ShopConfig, generateShopInventory, shouldSpawnShop,
  getItemSellPrice,
} from "../core/dungeon-shop";
import {
  RunLog, RunLogEvent,
} from "../core/run-log";
import { sfxShop } from "../core/sound-manager";

// ── Host interface: what ShopSystem needs from DungeonScene ──

export interface ShopHost {
  /** Phaser Scene API */
  scene: Phaser.Scene;

  // Read-only game state
  readonly player: Entity;
  readonly currentFloor: number;
  readonly dungeonDef: DungeonDef;
  readonly dungeon: { terrain: TerrainType[][]; width: number; height: number };
  readonly enemies: Entity[];
  readonly allEntities: Entity[];
  readonly inventory: ItemStack[];
  readonly turnManager: { turn: number };
  readonly runLog: RunLog;

  // Mutable shared state
  gold: number;

  // Callbacks
  showLog(msg: string): void;
  updateHUD(): void;
  tileToPixelX(tx: number): number;
  tileToPixelY(ty: number): number;
}

// ── ShopSystem class ──

export class ShopSystem {
  // ── Public state (accessed from outside) ──
  shopRoom: { x: number; y: number; w: number; h: number } | null = null;
  shopOpen = false;
  shopClosed = false; // set true after theft — shop closes for this floor

  // ── Internal state (shopItems & shopTiles exposed for ItemSystem) ──
  private shopConfig: ShopConfig | null = null;
  shopItems: ShopItem[] = [];
  private shopUI: Phaser.GameObjects.GameObject[] = [];
  shopTiles: { x: number; y: number; shopIdx: number; sprite: Phaser.GameObjects.Text; priceTag: Phaser.GameObjects.Text }[] = [];
  private shopCarpet: Phaser.GameObjects.Graphics | null = null;
  private shopWelcomeShown = false;
  private playerInShopRoom = false;
  private shopGoldHud: Phaser.GameObjects.Text | null = null;
  private shopTheftTriggered = false;

  constructor(private host: ShopHost) {}

  /** Reset all shop state for a new floor */
  reset() {
    this.shopConfig = null;
    this.shopItems = [];
    this.shopRoom = null;
    this.shopUI = [];
    this.shopOpen = false;
    this.shopTiles = [];
    this.shopCarpet = null;
    this.shopWelcomeShown = false;
    this.playerInShopRoom = false;
    this.shopGoldHud = null;
    this.shopTheftTriggered = false;
    this.shopClosed = false;
  }

  // ── Convenience: read-only accessors for menu conditions ──

  /** Whether the player is currently inside the shop room */
  get isPlayerInShopRoom() { return this.playerInShopRoom; }
  /** Whether any shop items remain in stock */
  get hasAvailableItems() { return this.shopItems.some(si => si.price > 0); }

  // ── Shop Placement (called during dungeon generation) ──

  /**
   * Try to spawn a shop on this floor.
   * @param rooms   All dungeon rooms
   * @param playerStart  Player spawn position
   * @param stairsPos    Stairs position
   * @param isBossFloor  Is this a boss floor?
   * @param terrain      2D terrain array
   * @returns true if a shop was placed
   */
  trySpawnShop(
    rooms: { x: number; y: number; w: number; h: number }[],
    playerStart: { x: number; y: number },
    stairsPos: { x: number; y: number },
    isBossFloor: boolean,
    terrain: TerrainType[][],
  ): boolean {
    if (isBossFloor || !shouldSpawnShop(this.host.currentFloor, this.host.dungeonDef.floors) || rooms.length <= 2) return false;

    const scene = this.host.scene;
    // Pick a room that isn't the player's or stairs room
    const shopCandidates = rooms.filter(r =>
      // Not the player's room
      !(playerStart.x >= r.x && playerStart.x < r.x + r.w &&
        playerStart.y >= r.y && playerStart.y < r.y + r.h) &&
      // Not the stairs room
      !(stairsPos.x >= r.x && stairsPos.x < r.x + r.w &&
        stairsPos.y >= r.y && stairsPos.y < r.y + r.h)
    );
    if (shopCandidates.length === 0) return false;

    const shopRm = shopCandidates[Math.floor(Math.random() * shopCandidates.length)];
    this.shopRoom = shopRm;
    this.shopConfig = generateShopInventory(this.host.currentFloor, this.host.dungeonDef.difficulty);
    this.shopItems = this.shopConfig.items;

    // Draw shop carpet (tan rectangle under items)
    this.shopCarpet = scene.add.graphics().setDepth(3);
    this.shopCarpet.fillStyle(0xd2b48c, 0.3);
    this.shopCarpet.fillRect(
      (shopRm.x + 1) * TILE_DISPLAY,
      (shopRm.y + 1) * TILE_DISPLAY,
      (shopRm.w - 2) * TILE_DISPLAY,
      (shopRm.h - 2) * TILE_DISPLAY,
    );
    // Carpet border
    this.shopCarpet.lineStyle(1, 0xd2b48c, 0.5);
    this.shopCarpet.strokeRect(
      (shopRm.x + 1) * TILE_DISPLAY,
      (shopRm.y + 1) * TILE_DISPLAY,
      (shopRm.w - 2) * TILE_DISPLAY,
      (shopRm.h - 2) * TILE_DISPLAY,
    );

    // Place shop items on the floor in the room
    for (let si = 0; si < this.shopItems.length; si++) {
      const sx = shopRm.x + 1 + (si % Math.max(1, shopRm.w - 2));
      const sy = shopRm.y + 1 + Math.floor(si / Math.max(1, shopRm.w - 2));
      if (sy >= shopRm.y + shopRm.h - 1) break;
      if (terrain[sy][sx] !== TerrainType.GROUND) continue;

      const shopItem = this.shopItems[si];
      const itemDef = ITEM_DB[shopItem.itemId];
      if (!itemDef) continue;
      const sprite = scene.add.text(
        sx * TILE_DISPLAY + TILE_DISPLAY / 2,
        sy * TILE_DISPLAY + TILE_DISPLAY / 2,
        "\uD83D\uDCB0", { fontSize: "14px", fontFamily: "monospace" }
      ).setOrigin(0.5).setDepth(7);

      // Price tag (yellow, 7px, floating above)
      const priceTag = scene.add.text(
        sx * TILE_DISPLAY + TILE_DISPLAY / 2,
        sy * TILE_DISPLAY + TILE_DISPLAY + 2,
        `${shopItem.price}G`, { fontSize: "7px", color: "#fbbf24", fontFamily: "monospace" }
      ).setOrigin(0.5).setDepth(7);

      this.shopTiles.push({ x: sx, y: sy, shopIdx: si, sprite, priceTag });
    }

    // Kecleon shopkeeper sign
    const kcX = shopRm.x * TILE_DISPLAY + (shopRm.w * TILE_DISPLAY) / 2;
    const kcY = shopRm.y * TILE_DISPLAY + 4;
    scene.add.text(kcX, kcY, "Kecleon Shop", {
      fontSize: "8px", color: "#4ade80", fontFamily: "monospace",
      backgroundColor: "#1a1a2ecc", padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(8);

    this.host.showLog("There's a Kecleon Shop on this floor!");
    return true;
  }

  // ── Player Step Check ──

  /** Check if player is in shop room, handle enter/exit/buy prompt */
  checkShop() {
    if (!this.shopRoom || this.shopOpen || this.shopClosed) return;
    const r = this.shopRoom;
    const px = this.host.player.tileX;
    const py = this.host.player.tileY;
    const inShop = px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;

    if (inShop && !this.playerInShopRoom) {
      // Player just entered the shop room
      this.playerInShopRoom = true;
      if (!this.shopWelcomeShown) {
        this.shopWelcomeShown = true;
        this.host.showLog("Welcome to the Shop!");
        // Run log: shop visited
        this.host.runLog.add(RunLogEvent.ShopVisited, "Kecleon Shop", this.host.currentFloor, this.host.turnManager.turn);
        sfxShop();
      }
      if (this.shopItems.length > 0) {
        this.host.showLog(`Gold: ${this.host.gold}G. Step on items to buy!`);
      }
      // Show gold HUD
      this.showShopGoldHud();
    } else if (!inShop && this.playerInShopRoom) {
      // Player just left the shop room -- check for theft
      this.playerInShopRoom = false;
      this.hideShopGoldHud();
      this.checkShopTheft();
    }

    // Step-on-item buy prompt
    if (inShop) {
      const shopTile = this.shopTiles.find(st => st.x === px && st.y === py);
      if (shopTile) {
        const si = this.shopItems[shopTile.shopIdx];
        if (si) {
          const itemDef = ITEM_DB[si.itemId];
          if (itemDef) {
            this.showShopBuyPrompt(shopTile.shopIdx);
          }
        }
      }
      // Update gold HUD
      this.updateShopGoldHud();
    }
  }

  // ── Gold HUD ──

  /** Show prominent gold balance when in shop room */
  showShopGoldHud() {
    this.hideShopGoldHud();
    this.shopGoldHud = this.host.scene.add.text(GAME_WIDTH / 2, 50, `Gold: ${this.host.gold}G`, {
      fontSize: "12px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
      backgroundColor: "#1a1a2ecc", padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(105);
  }

  updateShopGoldHud() {
    if (this.shopGoldHud) {
      this.shopGoldHud.setText(`Gold: ${this.host.gold}G`);
    }
  }

  hideShopGoldHud() {
    if (this.shopGoldHud) {
      this.shopGoldHud.destroy();
      this.shopGoldHud = null;
    }
  }

  // ── Theft Detection ──

  /** Check if the player took items from the shop without paying */
  private checkShopTheft() {
    if (this.shopTheftTriggered || this.shopClosed) return;
    // not implemented as walking-out-with-item since items use the buy prompt system
    // Theft only triggers if player picked up a shop item using the floor pickup action
    // (This is checked in pickupItem)
  }

  /** Spawn anti-theft security enemies at shop room exits */
  triggerShopTheft() {
    if (this.shopTheftTriggered) return;
    this.shopTheftTriggered = true;
    this.shopClosed = true;
    const scene = this.host.scene;

    // Big warning text
    this.host.showLog("Stop, thief!");
    scene.cameras.main.shake(300, 0.015);
    scene.cameras.main.flash(200, 255, 0, 0);

    const warningText = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "Stop, thief!", {
      fontSize: "22px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300);
    scene.tweens.add({
      targets: warningText,
      y: GAME_HEIGHT / 2 - 80,
      alpha: { from: 1, to: 0 },
      scaleX: { from: 1, to: 1.3 },
      scaleY: { from: 1, to: 1.3 },
      duration: 2000,
      ease: "Quad.easeOut",
      onComplete: () => warningText.destroy(),
    });

    // Spawn 2-3 powerful security enemies at room exits
    const r = this.shopRoom!;
    const terrain = this.host.dungeon.terrain;
    const width = this.host.dungeon.width;
    const height = this.host.dungeon.height;
    const securityLevel = this.host.player.stats.level + 5;
    const securityCount = 2 + Math.floor(Math.random() * 2); // 2-3
    const exitTiles: { x: number; y: number }[] = [];

    // Find exit tiles: ground tiles just outside the room borders
    for (let x = r.x; x < r.x + r.w; x++) {
      // Top edge exit
      if (r.y - 1 >= 0 && terrain[r.y - 1][x] === TerrainType.GROUND) exitTiles.push({ x, y: r.y - 1 });
      // Bottom edge exit
      if (r.y + r.h < height && terrain[r.y + r.h][x] === TerrainType.GROUND) exitTiles.push({ x, y: r.y + r.h });
    }
    for (let y = r.y; y < r.y + r.h; y++) {
      // Left edge exit
      if (r.x - 1 >= 0 && terrain[y][r.x - 1] === TerrainType.GROUND) exitTiles.push({ x: r.x - 1, y });
      // Right edge exit
      if (r.x + r.w < width && terrain[y][r.x + r.w] === TerrainType.GROUND) exitTiles.push({ x: r.x + r.w, y });
    }

    // Deduplicate and filter occupied tiles
    const uniqueExits = exitTiles.filter((t, i, arr) =>
      arr.findIndex(e => e.x === t.x && e.y === t.y) === i &&
      !this.host.allEntities.some(e => e.alive && e.tileX === t.x && e.tileY === t.y)
    );

    // Spawn enemies at up to securityCount exits
    const floorSpeciesIds = getDungeonFloorEnemies(this.host.dungeonDef, this.host.currentFloor);
    const floorSpecies = floorSpeciesIds.map(id => SPECIES[id]).filter(Boolean);
    const securitySpecies = floorSpecies.length > 0 ? floorSpecies[0] : SPECIES.zubat;

    for (let i = 0; i < Math.min(securityCount, uniqueExits.length); i++) {
      const pos = uniqueExits[i];
      const secStats = {
        hp: Math.floor(securitySpecies.baseStats.hp * 3),
        maxHp: Math.floor(securitySpecies.baseStats.hp * 3),
        atk: Math.floor(securitySpecies.baseStats.atk * 2.5),
        def: Math.floor(securitySpecies.baseStats.def * 2),
        level: securityLevel,
      };

      const enemy: Entity = {
        tileX: pos.x, tileY: pos.y,
        facing: Direction.Down,
        stats: secStats,
        alive: true,
        spriteKey: securitySpecies.spriteKey,
        name: `Security ${securitySpecies.name}`,
        types: securitySpecies.types,
        attackType: securitySpecies.attackType,
        skills: createSpeciesSkills(securitySpecies),
        statusEffects: [],
        speciesId: securitySpecies.spriteKey,
        ability: SPECIES_ABILITIES[securitySpecies.spriteKey],
      };
      const eTex = `${securitySpecies.spriteKey}-idle`;
      if (scene.textures.exists(eTex)) {
        enemy.sprite = scene.add.sprite(
          this.host.tileToPixelX(pos.x), this.host.tileToPixelY(pos.y), eTex
        );
        enemy.sprite.setScale(TILE_SCALE).setDepth(9);
        // Red tint for security
        enemy.sprite.setTint(0xff4444);
        const eAnim = `${securitySpecies.spriteKey}-idle-${Direction.Down}`;
        if (scene.anims.exists(eAnim)) enemy.sprite.play(eAnim);
      }
      this.host.enemies.push(enemy);
      this.host.allEntities.push(enemy);
    }

    // Remove shop visuals (carpet, item sprites, price tags)
    this.clearShopVisuals();
    this.hideShopGoldHud();
  }

  /** Remove all shop visual elements */
  clearShopVisuals() {
    for (const st of this.shopTiles) {
      st.sprite.destroy();
      st.priceTag.destroy();
    }
    this.shopTiles = [];
    if (this.shopCarpet) {
      this.shopCarpet.destroy();
      this.shopCarpet = null;
    }
  }

  // ── Shop Buy Prompt (step-on tile) ──

  /** Show buy prompt overlay when player steps on a shop item */
  private showShopBuyPrompt(shopIdx: number) {
    if (this.shopOpen || this.shopClosed) return;
    const si = this.shopItems[shopIdx];
    if (!si) return;
    const itemDef = ITEM_DB[si.itemId];
    if (!itemDef) return;
    const scene = this.host.scene;

    sfxShop();
    this.shopOpen = true;

    // Semi-transparent dark background
    const overlay = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(200).setInteractive();
    this.shopUI.push(overlay);

    // Prompt box
    const boxW = 260;
    const boxH = 120;
    const boxX = (GAME_WIDTH - boxW) / 2;
    const boxY = (GAME_HEIGHT - boxH) / 2;
    const box = scene.add.graphics().setScrollFactor(0).setDepth(201);
    box.fillStyle(0x1a1a2e, 0.95);
    box.fillRoundedRect(boxX, boxY, boxW, boxH, 8);
    box.lineStyle(2, 0xfbbf24, 1);
    box.strokeRoundedRect(boxX, boxY, boxW, boxH, 8);
    this.shopUI.push(box);

    // Item name and price
    const nameText = scene.add.text(GAME_WIDTH / 2, boxY + 18, `${itemDef.name} - ${si.price}G`, {
      fontSize: "13px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    this.shopUI.push(nameText);

    // Description
    const descText = scene.add.text(GAME_WIDTH / 2, boxY + 38, itemDef.description, {
      fontSize: "9px", color: "#aaaaaa", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    this.shopUI.push(descText);

    // "Buy?" label
    const buyLabel = scene.add.text(GAME_WIDTH / 2, boxY + 58, "Buy?", {
      fontSize: "11px", color: "#e0e0e0", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    this.shopUI.push(buyLabel);

    const canBuy = this.host.gold >= si.price;

    // Yes button
    const yesBtn = scene.add.text(GAME_WIDTH / 2 - 50, boxY + 80, "[Yes]", {
      fontSize: "13px", color: canBuy ? "#4ade80" : "#666666", fontFamily: "monospace",
      backgroundColor: "#2a2a4e", padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202).setInteractive();
    this.shopUI.push(yesBtn);

    if (canBuy) {
      yesBtn.on("pointerdown", () => {
        this.buyShopItemNew(shopIdx);
        this.closeShopUI();
      });
    } else {
      yesBtn.on("pointerdown", () => {
        this.host.showLog("Not enough gold!");
        this.closeShopUI();
      });
    }

    // No button
    const noBtn = scene.add.text(GAME_WIDTH / 2 + 50, boxY + 80, "[No]", {
      fontSize: "13px", color: "#ef4444", fontFamily: "monospace",
      backgroundColor: "#2a2a4e", padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202).setInteractive();
    this.shopUI.push(noBtn);
    noBtn.on("pointerdown", () => this.closeShopUI());
  }

  /** Buy an item from the step-on shop system */
  private buyShopItemNew(shopIdx: number) {
    const si = this.shopItems[shopIdx];
    if (!si || this.host.gold < si.price) return;
    const itemDef = ITEM_DB[si.itemId];
    if (!itemDef) return;

    // Check inventory space
    if (this.host.inventory.length >= MAX_INVENTORY) {
      const existing = this.host.inventory.find(s => s.item.id === si.itemId && itemDef.stackable);
      if (!existing) {
        this.host.showLog("Bag is full! Can't buy.");
        return;
      }
    }

    // Deduct gold
    this.host.gold -= si.price;

    // Add to inventory
    const existing = this.host.inventory.find(s => s.item.id === si.itemId && itemDef.stackable);
    if (existing) {
      existing.count++;
    } else {
      this.host.inventory.push({ item: itemDef, count: 1 });
    }
    this.host.showLog(`Bought ${itemDef.name} for ${si.price}G!`);

    // Decrease stock
    si.stock--;
    if (si.stock <= 0) {
      // Remove from shop -- find and destroy the tile sprite
      const tileIdx = this.shopTiles.findIndex(st => st.shopIdx === shopIdx);
      if (tileIdx >= 0) {
        this.shopTiles[tileIdx].sprite.destroy();
        this.shopTiles[tileIdx].priceTag.destroy();
        this.shopTiles.splice(tileIdx, 1);
      }
      // Mark item as empty (set price to 0 to indicate sold out)
      this.shopItems[shopIdx] = { itemId: "", price: 0, stock: 0 };
    }

    this.host.updateHUD();
    this.updateShopGoldHud();
  }

  // ── Full Shop UI Overlay ──

  /** Open the full shop overlay (from menu) */
  openShopUI() {
    if (this.shopOpen || this.shopClosed) return;
    // Filter out sold-out items (price=0 means sold out)
    const availableItems = this.shopItems.filter(si => si.price > 0);
    if (availableItems.length === 0) {
      this.host.showLog("Shop is empty!");
      return;
    }
    const scene = this.host.scene;
    sfxShop();
    this.shopOpen = true;

    // Dim overlay
    const overlay = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
      .setScrollFactor(0).setDepth(200).setInteractive();
    this.shopUI.push(overlay);

    // Title
    const title = scene.add.text(GAME_WIDTH / 2, 40, `Kecleon Shop  Gold: ${this.host.gold}G`, {
      fontSize: "12px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.shopUI.push(title);

    // Item list
    const startY = 70;
    let row = 0;
    for (let i = 0; i < this.shopItems.length; i++) {
      const si = this.shopItems[i];
      if (si.price <= 0) continue; // sold out
      const itemDef = ITEM_DB[si.itemId];
      if (!itemDef) continue;
      const y = startY + row * 32;
      const canBuy = this.host.gold >= si.price;
      const stockStr = si.stock > 1 ? ` x${si.stock}` : "";
      const label = `${itemDef.name}${stockStr} - ${si.price}G`;
      const color = canBuy ? "#e0e0e0" : "#666666";

      const itemBtn = scene.add.text(GAME_WIDTH / 2 - 80, y, label, {
        fontSize: "11px", color, fontFamily: "monospace",
        backgroundColor: "#1a1a2eee", padding: { x: 6, y: 4 },
      }).setScrollFactor(0).setDepth(201).setInteractive();
      this.shopUI.push(itemBtn);

      if (canBuy) {
        const buyBtn = scene.add.text(GAME_WIDTH / 2 + 80, y, "[Buy]", {
          fontSize: "11px", color: "#fbbf24", fontFamily: "monospace",
          backgroundColor: "#333344ee", padding: { x: 4, y: 4 },
        }).setScrollFactor(0).setDepth(201).setInteractive();
        this.shopUI.push(buyBtn);

        const idx = i;
        buyBtn.on("pointerdown", () => this.buyShopItem(idx));
      }

      // Description
      const desc = scene.add.text(GAME_WIDTH / 2 - 80, y + 15, itemDef.description, {
        fontSize: "8px", color: "#888888", fontFamily: "monospace",
      }).setScrollFactor(0).setDepth(201);
      this.shopUI.push(desc);
      row++;
    }

    // Close button
    const closeBtn = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 60, "[Close Shop]", {
      fontSize: "12px", color: "#ef4444", fontFamily: "monospace",
      backgroundColor: "#1a1a2eee", padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setInteractive();
    this.shopUI.push(closeBtn);

    closeBtn.on("pointerdown", () => this.closeShopUI());
  }

  /** Buy from the full shop overlay */
  private buyShopItem(index: number) {
    const si = this.shopItems[index];
    if (!si || si.price <= 0 || this.host.gold < si.price) return;
    const itemDef = ITEM_DB[si.itemId];
    if (!itemDef) return;

    // Check inventory space
    if (this.host.inventory.length >= MAX_INVENTORY) {
      const existing = this.host.inventory.find(s => s.item.id === si.itemId && itemDef.stackable);
      if (!existing) {
        this.host.showLog("Bag is full! Can't buy.");
        return;
      }
    }

    // Deduct gold
    this.host.gold -= si.price;

    // Add to inventory
    const existing = this.host.inventory.find(s => s.item.id === si.itemId && itemDef.stackable);
    if (existing) existing.count++;
    else this.host.inventory.push({ item: itemDef, count: 1 });
    this.host.showLog(`Bought ${itemDef.name} for ${si.price}G!`);

    // Decrease stock
    si.stock--;
    if (si.stock <= 0) {
      // Remove tile visual
      const tileIdx = this.shopTiles.findIndex(st => st.shopIdx === index);
      if (tileIdx >= 0) {
        this.shopTiles[tileIdx].sprite.destroy();
        this.shopTiles[tileIdx].priceTag.destroy();
        this.shopTiles.splice(tileIdx, 1);
      }
      this.shopItems[index] = { itemId: "", price: 0, stock: 0 };
    }

    // Refresh UI
    this.closeShopUI();
    if (this.shopItems.some(si2 => si2.price > 0)) {
      this.openShopUI();
    }
    this.host.updateHUD();
    this.updateShopGoldHud();
  }

  // ── Sell ──

  /** Show sell prompt for an item when in shop room */
  showSellPrompt(inventoryIndex: number) {
    if (this.shopOpen || !this.playerInShopRoom || this.shopClosed) return;
    const stack = this.host.inventory[inventoryIndex];
    if (!stack) return;
    const sellPrice = getItemSellPrice(stack.item.id, this.host.currentFloor);
    const scene = this.host.scene;

    sfxShop();
    this.shopOpen = true;

    // Semi-transparent dark background
    const overlay = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(200).setInteractive();
    this.shopUI.push(overlay);

    // Prompt box
    const boxW = 260;
    const boxH = 100;
    const boxX = (GAME_WIDTH - boxW) / 2;
    const boxY = (GAME_HEIGHT - boxH) / 2;
    const box = scene.add.graphics().setScrollFactor(0).setDepth(201);
    box.fillStyle(0x1a1a2e, 0.95);
    box.fillRoundedRect(boxX, boxY, boxW, boxH, 8);
    box.lineStyle(2, 0x4ade80, 1);
    box.strokeRoundedRect(boxX, boxY, boxW, boxH, 8);
    this.shopUI.push(box);

    // Sell text
    const sellText = scene.add.text(GAME_WIDTH / 2, boxY + 20, `Sell ${stack.item.name} for ${sellPrice}G?`, {
      fontSize: "11px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    this.shopUI.push(sellText);

    // Yes button
    const yesBtn = scene.add.text(GAME_WIDTH / 2 - 50, boxY + 60, "[Yes]", {
      fontSize: "13px", color: "#4ade80", fontFamily: "monospace",
      backgroundColor: "#2a2a4e", padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202).setInteractive();
    this.shopUI.push(yesBtn);

    yesBtn.on("pointerdown", () => {
      this.sellItem(inventoryIndex, sellPrice);
      this.closeShopUI();
    });

    // No button
    const noBtn = scene.add.text(GAME_WIDTH / 2 + 50, boxY + 60, "[No]", {
      fontSize: "13px", color: "#ef4444", fontFamily: "monospace",
      backgroundColor: "#2a2a4e", padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202).setInteractive();
    this.shopUI.push(noBtn);
    noBtn.on("pointerdown", () => this.closeShopUI());
  }

  /** Execute selling an item */
  private sellItem(inventoryIndex: number, sellPrice: number) {
    const stack = this.host.inventory[inventoryIndex];
    if (!stack) return;

    this.host.gold += sellPrice;
    this.host.showLog(`Sold ${stack.item.name} for ${sellPrice}G!`);

    stack.count--;
    if (stack.count <= 0) {
      this.host.inventory.splice(inventoryIndex, 1);
    }

    this.host.updateHUD();
    this.updateShopGoldHud();
  }

  // ── Close UI ──

  closeShopUI() {
    for (const obj of this.shopUI) obj.destroy();
    this.shopUI = [];
    this.shopOpen = false;
  }
}
