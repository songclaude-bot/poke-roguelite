/**
 * EventRoomSystem — Extracted from DungeonScene.
 * Manages event room placement, visuals, UI overlay, and effect application.
 */
import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, TILE_DISPLAY, TILE_SCALE } from "../config";
import { Entity, AllyTactic } from "../core/entity";
import { Direction } from "../core/direction";
import { TerrainType } from "../core/dungeon-generator";
import { DungeonDef, getDungeonFloorEnemies } from "../core/dungeon-data";
import { DungeonEvent, EventChoice, rollDungeonEvent } from "../core/dungeon-events";
import { ItemStack, rollFloorItem, MAX_INVENTORY, ITEM_DB } from "../core/item";
import { SPECIES, createSpeciesSkills, PokemonSpecies } from "../core/pokemon-data";
import { SkillEffect } from "../core/skill";
import { processLevelUp } from "../core/leveling";
import { SPECIES_ABILITIES } from "../core/ability";
import { FloorTrap } from "../core/trap";
import { TrapHazardSystem } from "./trap-hazard-system";
import {
  sfxHeal, sfxMenuOpen, sfxBuff, sfxHit, sfxItemPickup,
  sfxLevelUp, sfxRecruit,
} from "../core/sound-manager";

// ── Host interface: what EventRoomSystem needs from DungeonScene ──

export interface EventRoomHost {
  // Read-only game state
  readonly player: Entity;
  readonly currentFloor: number;
  readonly dungeonDef: DungeonDef;
  readonly ngPlusLevel: number;
  readonly difficultyMods: { enemyHpMult: number; enemyAtkMult: number };
  readonly dungeon: { terrain: TerrainType[][]; width: number; height: number };

  // Mutable shared state
  gold: number;
  totalExp: number;
  belly: number;
  readonly maxBelly: number;
  inventory: ItemStack[];
  enemies: Entity[];
  allies: Entity[];
  allEntities: Entity[];
  seenSpecies: Set<string>;
  trapHazardSys: TrapHazardSystem;

  // Callbacks (delegate back to DungeonScene)
  showLog(msg: string): void;
  updateHUD(): void;
  stopAutoExplore(): void;
  setDomHudInteractive(enabled: boolean): void;
  tileToPixelX(tileX: number): number;
  tileToPixelY(tileY: number): number;
  getEndlessEnemies(floor: number): string[];
  resetBellyWarnings(): void;

  // Minimap
  minimapSys: {
    visited: boolean[][];
    currentlyVisible: boolean[][];
    updateMinimap(): void;
    checkExplorationRewards(): void;
  };
}

// ── EventRoomSystem class ──

export class EventRoomSystem {
  // ── Public state (read by DungeonScene for guards & room exclusion) ──
  eventRoom: { x: number; y: number; w: number; h: number } | null = null;
  eventTriggered = false;
  eventOpen = false;
  currentEvent: DungeonEvent | null = null;

  // ── Private state ──
  private eventUI: Phaser.GameObjects.GameObject[] = [];
  private eventMarker: Phaser.GameObjects.Text | null = null;

  constructor(private host: EventRoomHost) {}

  protected get scene(): Phaser.Scene { return this.host as any; }

  /** Reset all event room state for a new floor */
  reset() {
    this.eventRoom = null;
    this.eventTriggered = false;
    this.eventOpen = false;
    this.eventUI = [];
    this.currentEvent = null;
    this.eventMarker = null;
  }

  // ── Event Room Placement (called during dungeon generation) ──

  /**
   * Try to spawn an event room on this floor.
   * 20% chance on floor 3+, not boss floor, needs >2 rooms.
   * Returns true if an event was placed.
   */
  trySpawnEventRoom(
    rooms: { x: number; y: number; w: number; h: number }[],
    playerStart: { x: number; y: number },
    stairsPos: { x: number; y: number },
    isBossFloor: boolean,
    excludeRooms: ({ x: number; y: number; w: number; h: number } | null | undefined)[],
  ): boolean {
    if (this.host.currentFloor < 3 || isBossFloor || rooms.length <= 2) return false;
    if (Math.random() >= 0.20) return false;

    const eventCandidates = rooms.filter(r =>
      // Not the player's room
      !(playerStart.x >= r.x && playerStart.x < r.x + r.w &&
        playerStart.y >= r.y && playerStart.y < r.y + r.h) &&
      // Not the stairs room
      !(stairsPos.x >= r.x && stairsPos.x < r.x + r.w &&
        stairsPos.y >= r.y && stairsPos.y < r.y + r.h) &&
      // Not excluded special rooms
      !excludeRooms.some(er => er === r)
    );

    if (eventCandidates.length === 0) return false;

    const evRoom = eventCandidates[Math.floor(Math.random() * eventCandidates.length)];
    const rolledEvent = rollDungeonEvent(this.host.currentFloor);
    if (!rolledEvent) return false;

    this.eventRoom = evRoom;
    this.currentEvent = rolledEvent;
    this.placeEventMarker(evRoom);
    return true;
  }

  // ── Event Marker Visual ──

  /** Place the "!" marker at the center of the event room */
  private placeEventMarker(evRoom: { x: number; y: number; w: number; h: number }) {
    const scene = this.scene;
    const markerX = Math.floor(evRoom.x + evRoom.w / 2);
    const markerY = Math.floor(evRoom.y + evRoom.h / 2);
    this.eventMarker = scene.add.text(
      markerX * TILE_DISPLAY + TILE_DISPLAY / 2,
      markerY * TILE_DISPLAY + TILE_DISPLAY / 2 - 8,
      "!", { fontSize: "18px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
        stroke: "#000000", strokeThickness: 3 }
    ).setOrigin(0.5).setDepth(8);

    // Pulse animation on the marker
    scene.tweens.add({
      targets: this.eventMarker,
      scaleX: { from: 1, to: 1.3 },
      scaleY: { from: 1, to: 1.3 },
      alpha: { from: 1, to: 0.6 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  // ── Player Step Check ──

  /** Check if player stepped into the event room */
  checkEventRoom() {
    if (!this.eventRoom || this.eventTriggered || this.eventOpen) return;
    const r = this.eventRoom;
    const px = this.host.player.tileX;
    const py = this.host.player.tileY;
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) {
      this.eventTriggered = true;
      // Remove the "!" marker
      if (this.eventMarker) {
        this.eventMarker.destroy();
        this.eventMarker = null;
      }
      // Open the event overlay
      this.openEventUI();
    }
  }

  // ── Event UI Overlay ──

  /** Open the event choice overlay */
  private openEventUI() {
    if (this.eventOpen || !this.currentEvent) return;
    const scene = this.scene;
    sfxMenuOpen();
    this.eventOpen = true;
    this.host.stopAutoExplore();

    const event = this.currentEvent;

    // Dim overlay
    const overlay = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75)
      .setScrollFactor(0).setDepth(200).setInteractive();
    this.eventUI.push(overlay);

    // Event name (title)
    const titleText = scene.add.text(GAME_WIDTH / 2, 60, event.name, {
      fontSize: "16px", color: "#22d3ee", fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.eventUI.push(titleText);

    // Decorative line
    const line = scene.add.graphics().setScrollFactor(0).setDepth(201);
    line.lineStyle(1, 0x22d3ee, 0.5);
    line.lineBetween(GAME_WIDTH / 2 - 120, 82, GAME_WIDTH / 2 + 120, 82);
    this.eventUI.push(line);

    // Description text (word-wrapped)
    const descText = scene.add.text(GAME_WIDTH / 2, 105, event.description, {
      fontSize: "10px", color: "#c0c8e0", fontFamily: "monospace",
      wordWrap: { width: 280 }, align: "center", lineSpacing: 4,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(201);
    this.eventUI.push(descText);

    // Choice buttons
    const choiceStartY = 220;
    for (let i = 0; i < event.choices.length; i++) {
      const choice = event.choices[i];
      const cy = choiceStartY + i * 80;

      // Choice button background
      const btnBg = scene.add.rectangle(GAME_WIDTH / 2, cy, 280, 60, 0x1a1a2e, 0.95)
        .setScrollFactor(0).setDepth(201).setInteractive()
        .setStrokeStyle(1, 0x22d3ee, 0.6);
      this.eventUI.push(btnBg);

      // Choice label
      const labelText = scene.add.text(GAME_WIDTH / 2, cy - 12, choice.label, {
        fontSize: "12px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
      this.eventUI.push(labelText);

      // Choice description
      const choiceDesc = scene.add.text(GAME_WIDTH / 2, cy + 8, choice.description, {
        fontSize: "9px", color: "#888ea8", fontFamily: "monospace",
        wordWrap: { width: 250 }, align: "center",
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(202);
      this.eventUI.push(choiceDesc);

      // Hover effects
      btnBg.on("pointerover", () => {
        btnBg.setStrokeStyle(2, 0xfbbf24, 1);
        labelText.setColor("#ffffff");
      });
      btnBg.on("pointerout", () => {
        btnBg.setStrokeStyle(1, 0x22d3ee, 0.6);
        labelText.setColor("#fbbf24");
      });

      // Click handler
      btnBg.on("pointerdown", () => {
        this.applyEventEffect(choice);
      });
    }
  }

  /** Close event overlay */
  private closeEventUI() {
    for (const obj of this.eventUI) obj.destroy();
    this.eventUI = [];
    this.eventOpen = false;
  }

  /** Show a brief result message after event choice */
  private showEventResult(message: string, color = "#4ade80") {
    this.closeEventUI();
    const scene = this.scene;

    // Brief result overlay
    const overlay = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(200).setInteractive();

    const resultText = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, message, {
      fontSize: "12px", color, fontFamily: "monospace", fontStyle: "bold",
      wordWrap: { width: 280 }, align: "center",
      stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    // Auto-dismiss after 1.5 seconds
    scene.time.delayedCall(1500, () => {
      overlay.destroy();
      resultText.destroy();
      this.host.updateHUD();
      this.host.minimapSys.updateMinimap();
    });
  }

  // ── Effect Application ──

  /** Apply the chosen event effect */
  private applyEventEffect(choice: EventChoice) {
    const effectId = choice.effectId;
    const value = choice.effectValue ?? 0;
    const host = this.host;

    switch (effectId) {
      case "nothing": {
        this.closeEventUI();
        host.showLog("You decided to move on.");
        break;
      }

      case "wishingWell_toss": {
        // Requires gold
        if (host.gold < value) {
          host.showLog(`Not enough gold! Need ${value}G.`);
          return; // Don't close UI, let player pick another choice
        }
        host.gold -= value;
        const roll = Math.random();
        if (roll < 0.33) {
          host.player.stats.atk += 3;
          this.showEventResult("The well grants power!\nATK +3!", "#ff6b6b");
        } else if (roll < 0.66) {
          host.player.stats.def += 3;
          this.showEventResult("The well grants resilience!\nDEF +3!", "#60a5fa");
        } else {
          host.player.stats.maxHp += 20;
          host.player.stats.hp = Math.min(host.player.stats.hp + 20, host.player.stats.maxHp);
          this.showEventResult("The well grants vitality!\nMax HP +20!", "#4ade80");
        }
        sfxBuff();
        host.showLog("Your wish was granted!");
        break;
      }

      case "stash_open": {
        this.closeEventUI();
        if (Math.random() < 0.5) {
          // Good outcome: 2-3 items
          const itemCount = 2 + Math.floor(Math.random() * 2);
          let addedCount = 0;
          for (let i = 0; i < itemCount; i++) {
            if (host.inventory.length >= MAX_INVENTORY) break;
            const item = rollFloorItem();
            const existing = host.inventory.find(s => s.item.id === item.id && item.stackable);
            if (existing) existing.count++;
            else host.inventory.push({ item, count: 1 });
            addedCount++;
          }
          sfxItemPickup();
          this.showEventResult(`Found ${addedCount} items in the stash!`, "#4ade80");
          host.showLog(`Found ${addedCount} items!`);
        } else {
          // Bad outcome: spawn 2-3 enemies
          host.showLog("It was a trap! Enemies appear!");
          this.spawnEventEnemies(2 + Math.floor(Math.random() * 2));
          this.showEventResult("Enemies burst out of the stash!", "#ef4444");
        }
        break;
      }

      case "statue_pray": {
        host.player.stats.hp = host.player.stats.maxHp;
        sfxHeal();
        this.showEventResult("The statue's warmth heals you fully!\nHP fully restored!", "#4ade80");
        host.showLog("HP fully restored!");
        break;
      }

      case "statue_smash": {
        // Take damage
        host.player.stats.hp = Math.max(1, host.player.stats.hp - value);
        // Give 3 random items
        let addedCount = 0;
        for (let i = 0; i < 3; i++) {
          if (host.inventory.length >= MAX_INVENTORY) break;
          const item = rollFloorItem();
          const existing = host.inventory.find(s => s.item.id === item.id && item.stackable);
          if (existing) existing.count++;
          else host.inventory.push({ item, count: 1 });
          addedCount++;
        }
        sfxHit();
        this.showEventResult(`Smashed! Took ${value} damage.\nFound ${addedCount} items!`, "#fbbf24");
        host.showLog(`Took ${value} damage but found ${addedCount} items!`);
        break;
      }

      case "traveler_feed": {
        // Check if player has an Apple
        const appleIdx = host.inventory.findIndex(s => s.item.id === "apple" || s.item.id === "bigApple" || s.item.id === "goldenApple");
        if (appleIdx === -1) {
          host.showLog("You don't have any Apples!");
          return; // Don't close UI
        }
        // Consume the apple
        const stack = host.inventory[appleIdx];
        stack.count--;
        if (stack.count <= 0) host.inventory.splice(appleIdx, 1);

        // Recruit a random ally
        this.spawnEventAlly();
        sfxRecruit();
        this.showEventResult("The traveler is grateful!\nThey join your team!", "#ff6b9d");
        host.showLog("A grateful traveler joins you!");
        break;
      }

      case "chest_open": {
        // Give a powerful item (orb or rare seed)
        const powerfulItems = ["allPowerOrb", "reviveSeed", "luminousOrb", "maxElixir", "sitrusBerry"];
        const itemId = powerfulItems[Math.floor(Math.random() * powerfulItems.length)];
        const item = ITEM_DB[itemId];
        if (host.inventory.length < MAX_INVENTORY && item) {
          const existing = host.inventory.find(s => s.item.id === item.id && item.stackable);
          if (existing) existing.count++;
          else host.inventory.push({ item, count: 1 });
        }
        // Apply Burn status
        host.player.statusEffects.push({ type: SkillEffect.Burn, turnsLeft: 5 });
        sfxItemPickup();
        this.showEventResult(`Got ${item?.name ?? "an item"}!\nBut you were cursed with Burn!`, "#bb44ff");
        host.showLog(`Got ${item?.name ?? "an item"}, but burned!`);
        break;
      }

      case "train_do": {
        // Grant EXP but lose 30% belly
        const bellyLoss = Math.floor(host.maxBelly * 0.3);
        host.belly = Math.max(0, host.belly - bellyLoss);
        // Process level ups
        const levelResult = processLevelUp(host.player.stats, value, host.totalExp);
        host.totalExp = levelResult.totalExp;
        for (const r of levelResult.results) {
          sfxLevelUp();
          host.showLog(`Level up! Lv.${r.newLevel}! HP+${r.hpGain} ATK+${r.atkGain} DEF+${r.defGain}`);
        }
        sfxBuff();
        this.showEventResult(`Intense training!\n+${value} EXP, Belly -${bellyLoss}`, "#fbbf24");
        host.showLog(`Gained ${value} EXP! Belly -${bellyLoss}.`);
        break;
      }

      case "fortune_pay": {
        if (host.gold < value) {
          host.showLog(`Not enough gold! Need ${value}G.`);
          return; // Don't close UI
        }
        host.gold -= value;
        // Reveal entire floor
        const { width, height } = host.dungeon;
        for (let fy = 0; fy < height; fy++) {
          for (let fx = 0; fx < width; fx++) {
            host.minimapSys.visited[fy][fx] = true;
            host.minimapSys.currentlyVisible[fy][fx] = true;
          }
        }
        // Reveal all traps too
        for (const trap of host.trapHazardSys.floorTraps) {
          trap.revealed = true;
        }
        host.minimapSys.updateMinimap();
        host.minimapSys.checkExplorationRewards();
        sfxBuff();
        this.showEventResult("The orb reveals all secrets!\nFloor map fully revealed!", "#22d3ee");
        host.showLog("Floor layout fully revealed!");
        break;
      }

      case "rest_do": {
        host.player.stats.hp = host.player.stats.maxHp;
        host.belly = Math.min(host.maxBelly, host.belly + value);
        host.resetBellyWarnings();
        sfxHeal();
        this.showEventResult(`You rest peacefully...\nHP fully restored! Belly +${value}`, "#4ade80");
        host.showLog(`Rested! HP restored, Belly +${value}.`);
        break;
      }

      default: {
        this.closeEventUI();
        host.showLog("Nothing happened.");
        break;
      }
    }
  }

  // ── Helper: Spawn Enemies in Event Room ──

  /** Spawn enemies in the event room (for Abandoned Stash trap) */
  private spawnEventEnemies(count: number) {
    if (!this.eventRoom) return;
    const host = this.host;
    const scene = host as any as Phaser.Scene;
    const r = this.eventRoom;
    const floorSpeciesIds = (host.dungeonDef.id === "endlessDungeon" || host.dungeonDef.id === "dailyDungeon")
      ? host.getEndlessEnemies(host.currentFloor)
      : getDungeonFloorEnemies(host.dungeonDef, host.currentFloor);
    const floorSpecies = floorSpeciesIds.map(id => SPECIES[id]).filter(Boolean);
    if (floorSpecies.length === 0) return;

    for (let i = 0; i < count; i++) {
      const ex = r.x + 1 + Math.floor(Math.random() * Math.max(1, r.w - 2));
      const ey = r.y + 1 + Math.floor(Math.random() * Math.max(1, r.h - 2));
      if (host.dungeon.terrain[ey]?.[ex] !== TerrainType.GROUND) continue;
      if (host.allEntities.some(e => e.alive && e.tileX === ex && e.tileY === ey)) continue;

      const sp = floorSpecies[Math.floor(Math.random() * floorSpecies.length)];
      const enemyStats = getEnemyStats(host.currentFloor, host.dungeonDef.difficulty, sp, host.ngPlusLevel);

      if (host.difficultyMods.enemyHpMult !== 1) {
        enemyStats.hp = Math.floor(enemyStats.hp * host.difficultyMods.enemyHpMult);
        enemyStats.maxHp = Math.floor(enemyStats.maxHp * host.difficultyMods.enemyHpMult);
      }
      if (host.difficultyMods.enemyAtkMult !== 1) {
        enemyStats.atk = Math.floor(enemyStats.atk * host.difficultyMods.enemyAtkMult);
      }

      const enemy: Entity = {
        tileX: ex, tileY: ey,
        facing: Direction.Down,
        stats: { ...enemyStats },
        alive: true,
        spriteKey: sp.spriteKey,
        name: sp.name,
        types: sp.types,
        attackType: sp.attackType,
        skills: createSpeciesSkills(sp),
        statusEffects: [],
        speciesId: sp.spriteKey,
        ability: SPECIES_ABILITIES[sp.spriteKey],
      };
      const eTex = `${sp.spriteKey}-idle`;
      if (scene.textures.exists(eTex)) {
        enemy.sprite = scene.add.sprite(
          host.tileToPixelX(ex), host.tileToPixelY(ey), eTex
        );
        enemy.sprite.setScale(TILE_SCALE).setDepth(9);
        const eAnim = `${sp.spriteKey}-idle-${Direction.Down}`;
        if (scene.anims.exists(eAnim)) enemy.sprite.play(eAnim);
      }
      host.enemies.push(enemy);
      host.allEntities.push(enemy);
      host.seenSpecies.add(sp.spriteKey);
    }
  }

  // ── Helper: Spawn Ally from Lost Traveler Event ──

  /** Spawn a temporary ally from the Lost Traveler event */
  private spawnEventAlly() {
    const MAX_ALLIES = 4;
    if (!this.eventRoom || this.host.allies.length >= MAX_ALLIES) return;
    const host = this.host;
    const scene = host as any as Phaser.Scene;
    const r = this.eventRoom;

    // Pick a random species from the current floor's enemy pool
    const floorSpeciesIds = (host.dungeonDef.id === "endlessDungeon" || host.dungeonDef.id === "dailyDungeon")
      ? host.getEndlessEnemies(host.currentFloor)
      : getDungeonFloorEnemies(host.dungeonDef, host.currentFloor);
    const floorSpecies = floorSpeciesIds.map(id => SPECIES[id]).filter(Boolean);
    if (floorSpecies.length === 0) return;

    const sp = floorSpecies[Math.floor(Math.random() * floorSpecies.length)];
    const allyStats = getEnemyStats(host.currentFloor, host.dungeonDef.difficulty * 0.9, sp, host.ngPlusLevel);

    // Place ally near event room center
    const ax = Math.floor(r.x + r.w / 2);
    const ay = Math.floor(r.y + r.h / 2);

    const ally: Entity = {
      tileX: ax, tileY: ay,
      facing: Direction.Down,
      stats: { ...allyStats },
      alive: true,
      spriteKey: sp.spriteKey,
      name: sp.name,
      types: sp.types,
      attackType: sp.attackType,
      skills: createSpeciesSkills(sp),
      statusEffects: [],
      isAlly: true,
      speciesId: sp.spriteKey,
      ability: SPECIES_ABILITIES[sp.spriteKey],
      allyTactic: AllyTactic.FollowMe,
    };

    const recruitTex = `${sp.spriteKey}-idle`;
    if (scene.textures.exists(recruitTex)) {
      ally.sprite = scene.add.sprite(
        host.tileToPixelX(ax), host.tileToPixelY(ay), recruitTex
      ).setScale(TILE_SCALE).setDepth(10);
      const recruitAnim = `${sp.spriteKey}-idle-${Direction.Down}`;
      if (scene.anims.exists(recruitAnim)) ally.sprite.play(recruitAnim);
    }

    // Pink tint flash for recruitment
    if (ally.sprite) ally.sprite.setTint(0xff88cc);
    scene.time.delayedCall(400, () => { if (ally.sprite) ally.sprite.clearTint(); });

    const heart = scene.add.text(
      host.tileToPixelX(ax), host.tileToPixelY(ay) - 20,
      "\u2665", { fontSize: "18px", color: "#ff6b9d", fontFamily: "monospace" }
    ).setOrigin(0.5).setDepth(50);
    scene.tweens.add({
      targets: heart, y: heart.y - 30, alpha: { from: 1, to: 0 },
      duration: 1000, ease: "Quad.easeOut",
      onComplete: () => heart.destroy(),
    });

    host.allies.push(ally);
    host.allEntities.push(ally);
    host.seenSpecies.add(sp.spriteKey);
  }
}

// ── Local helper: getEnemyStats (mirror of DungeonScene's local function) ──

function getEnemyStats(floor: number, difficulty: number, species?: PokemonSpecies, ngPlusBonus = 0) {
  const scale = (1 + (floor - 1) * 0.25) * difficulty * (1 + ngPlusBonus * 0.1);
  const base = species?.baseStats ?? { hp: 20, atk: 8, def: 3 };
  return {
    hp: Math.floor(base.hp * scale),
    maxHp: Math.floor(base.hp * scale),
    atk: Math.floor(base.atk * scale),
    def: Math.floor(base.def * scale),
    level: 2 + floor,
  };
}
