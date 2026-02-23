import Phaser from "phaser";
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  TILE_SIZE,
  TILE_SCALE,
  TILE_DISPLAY,
} from "../config";
import { generateDungeon, DungeonData, TerrainType } from "../core/dungeon-generator";
import { getTileIndex } from "../core/autotiler";
import { Direction, DIR_DX, DIR_DY, angleToDirection } from "../core/direction";
import { TurnManager } from "../core/turn-manager";
import {
  Entity, canMoveTo, canMoveDiagonal,
  getEffectiveAtk, getEffectiveDef, tickStatusEffects, isParalyzed, StatusEffect,
} from "../core/entity";
import { getEnemyMoveDirection, isAdjacentToPlayer, directionToPlayer } from "../core/enemy-ai";
import { PokemonType, getEffectiveness, effectivenessText } from "../core/type-chart";
import { Skill, SkillRange, SkillEffect } from "../core/skill";
import { getSkillTargetTiles } from "../core/skill-targeting";
import { ItemDef, ItemStack, rollFloorItem, MAX_INVENTORY } from "../core/item";
import { SPECIES, PokemonSpecies, getFloorEnemies, createSpeciesSkills } from "../core/pokemon-data";

const MOVE_DURATION = 150; // ms per tile movement
const ENEMIES_PER_ROOM = 1; // base enemies per room (except player's room)
const MAX_FLOOR = 5; // B5F is the last floor
const ITEMS_PER_FLOOR = 3; // items spawned per floor

// Per-floor enemy scaling (uses species base stats)
function getEnemyStats(floor: number, species?: PokemonSpecies) {
  const scale = 1 + (floor - 1) * 0.25;
  const base = species?.baseStats ?? { hp: 20, atk: 8, def: 3 };
  return {
    hp: Math.floor(base.hp * scale),
    maxHp: Math.floor(base.hp * scale),
    atk: Math.floor(base.atk * scale),
    def: Math.floor(base.def * scale),
    level: 2 + floor,
  };
}

export class DungeonScene extends Phaser.Scene {
  private dungeon!: DungeonData;
  private turnManager = new TurnManager();
  private currentFloor = 1;

  private player!: Entity;
  private enemies: Entity[] = [];
  private allEntities: Entity[] = [];

  // Persistent player state across floors
  private persistentHp = 50;
  private persistentMaxHp = 50;
  private persistentSkills: Skill[] | null = null;

  // HUD references
  private hpText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private floorText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private skillButtons: Phaser.GameObjects.Text[] = [];

  // Skill state
  private activeSkillIndex = -1; // -1 = no skill selected

  // Item state
  private inventory: ItemStack[] = [];
  private floorItems: { x: number; y: number; item: ItemDef; sprite: Phaser.GameObjects.Text }[] = [];
  private persistentInventory: ItemStack[] | null = null;
  private bagOpen = false;
  private bagUI: Phaser.GameObjects.GameObject[] = [];

  // Game state
  private gameOver = false;

  constructor() {
    super({ key: "DungeonScene" });
  }

  init(data?: { floor?: number; hp?: number; maxHp?: number; skills?: Skill[]; inventory?: ItemStack[] }) {
    this.currentFloor = data?.floor ?? 1;
    this.persistentHp = data?.hp ?? 50;
    this.persistentMaxHp = data?.maxHp ?? 50;
    this.persistentSkills = data?.skills ?? null;
    this.persistentInventory = data?.inventory ?? null;
    this.enemies = [];
    this.allEntities = [];
    this.floorItems = [];
    this.gameOver = false;
    this.activeSkillIndex = -1;
    this.skillButtons = [];
    this.bagOpen = false;
    this.bagUI = [];
    this.turnManager = new TurnManager();
  }

  preload() {
    this.load.image("beachcave-tiles", "tilesets/BeachCave/tileset_0.png");

    // Load all pokemon sprites dynamically from SPECIES data
    const spriteMap: Record<string, string> = {
      mudkip: "0258", zubat: "0041", shellos: "0422", corsola: "0222", geodude: "0074",
    };
    for (const [key, dexNum] of Object.entries(spriteMap)) {
      const sp = SPECIES[key];
      if (!sp) continue;
      this.load.spritesheet(`${key}-walk`, `sprites/${dexNum}/Walk-Anim.png`, {
        frameWidth: sp.walkFrameWidth, frameHeight: sp.walkFrameHeight,
      });
      this.load.spritesheet(`${key}-idle`, `sprites/${dexNum}/Idle-Anim.png`, {
        frameWidth: sp.idleFrameWidth, frameHeight: sp.idleFrameHeight,
      });
    }
  }

  create() {
    this.dungeon = generateDungeon();
    const { width, height, terrain, playerStart, stairsPos } = this.dungeon;

    // ── Tilemap ──
    const tileData: number[][] = [];
    for (let y = 0; y < height; y++) {
      tileData[y] = [];
      for (let x = 0; x < width; x++) {
        tileData[y][x] = getTileIndex(terrain, x, y, width, height);
      }
    }
    const map = this.make.tilemap({
      data: tileData, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE,
    });
    const tileset = map.addTilesetImage("beachcave-tiles")!;
    map.createLayer(0, tileset, 0, 0)!.setScale(TILE_SCALE);

    // Stairs marker
    const stairsGfx = this.add.graphics();
    const sx = stairsPos.x * TILE_DISPLAY + TILE_DISPLAY / 2;
    const sy = stairsPos.y * TILE_DISPLAY + TILE_DISPLAY / 2;
    stairsGfx.fillStyle(0xfbbf24, 0.9);
    stairsGfx.fillTriangle(sx, sy - 14, sx + 10, sy, sx - 10, sy);
    stairsGfx.fillTriangle(sx, sy + 14, sx + 10, sy, sx - 10, sy);
    stairsGfx.setDepth(5);

    // ── Create animations for all species ──
    if (!this.anims.exists("mudkip-walk-0")) {
      for (const sp of Object.values(SPECIES)) {
        this.createAnimations(sp.spriteKey, sp.walkFrames, sp.idleFrames);
      }
    }

    // ── Player entity ──
    const playerSp = SPECIES.mudkip;
    const playerSkills = this.persistentSkills ?? createSpeciesSkills(playerSp);
    this.player = {
      tileX: playerStart.x,
      tileY: playerStart.y,
      facing: Direction.Down,
      stats: {
        hp: this.persistentHp,
        maxHp: this.persistentMaxHp,
        atk: playerSp.baseStats.atk, def: playerSp.baseStats.def, level: 5,
      },
      alive: true,
      spriteKey: playerSp.spriteKey,
      name: playerSp.name,
      types: playerSp.types,
      attackType: playerSp.attackType,
      skills: playerSkills,
      statusEffects: [],
    };
    this.player.sprite = this.add.sprite(
      this.tileToPixelX(this.player.tileX),
      this.tileToPixelY(this.player.tileY),
      "mudkip-idle"
    );
    this.player.sprite.setScale(TILE_SCALE).setDepth(10);
    this.player.sprite.play(`mudkip-idle-${Direction.Down}`);
    this.allEntities.push(this.player);

    // ── Spawn enemies (floor-specific species) ──
    const rooms = this.dungeon.rooms;
    const floorSpecies = getFloorEnemies(this.currentFloor);
    if (floorSpecies.length === 0) floorSpecies.push(SPECIES.zubat); // fallback

    for (let i = 1; i < rooms.length; i++) {
      const room = rooms[i];
      for (let e = 0; e < ENEMIES_PER_ROOM; e++) {
        const ex = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
        const ey = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
        if (terrain[ey][ex] !== TerrainType.GROUND) continue;
        if (ex === stairsPos.x && ey === stairsPos.y) continue;

        // Pick random species from floor pool
        const sp = floorSpecies[Math.floor(Math.random() * floorSpecies.length)];
        const enemyStats = getEnemyStats(this.currentFloor, sp);

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
        };
        enemy.sprite = this.add.sprite(
          this.tileToPixelX(ex), this.tileToPixelY(ey), `${sp.spriteKey}-idle`
        );
        enemy.sprite.setScale(TILE_SCALE).setDepth(9);
        enemy.sprite.play(`${sp.spriteKey}-idle-${Direction.Down}`);
        this.enemies.push(enemy);
        this.allEntities.push(enemy);
      }
    }

    // ── Spawn floor items ──
    this.inventory = this.persistentInventory ?? [];
    for (let i = 0; i < ITEMS_PER_FLOOR; i++) {
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      const ix = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
      const iy = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
      if (terrain[iy][ix] !== TerrainType.GROUND) continue;
      if (ix === stairsPos.x && iy === stairsPos.y) continue;
      if (ix === playerStart.x && iy === playerStart.y) continue;

      const item = rollFloorItem();
      const icon = item.category === "berry" ? "●" : item.category === "seed" ? "◆" : "★";
      const color = item.category === "berry" ? "#ff6b9d" : item.category === "seed" ? "#4ade80" : "#60a5fa";
      const sprite = this.add.text(
        ix * TILE_DISPLAY + TILE_DISPLAY / 2,
        iy * TILE_DISPLAY + TILE_DISPLAY / 2,
        icon, { fontSize: "16px", color, fontFamily: "monospace" }
      ).setOrigin(0.5).setDepth(6);

      this.floorItems.push({ x: ix, y: iy, item, sprite });
    }

    // ── Camera ──
    const mapPixelW = width * TILE_DISPLAY;
    const mapPixelH = height * TILE_DISPLAY;
    this.cameras.main.setBounds(0, 0, mapPixelW, mapPixelH);
    this.cameras.main.startFollow(this.player.sprite!, true, 0.15, 0.15);

    // ── Input ──
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.turnManager.isBusy || !this.player.alive || this.gameOver) return;

      const dx = pointer.worldX - this.player.sprite!.x;
      const dy = pointer.worldY - this.player.sprite!.y;
      if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;

      const angle = Math.atan2(dy, dx);
      const dir = angleToDirection(angle);

      if (this.activeSkillIndex >= 0) {
        // Use selected skill in the tapped direction
        this.handleSkillUse(this.activeSkillIndex, dir);
        this.activeSkillIndex = -1;
        this.updateSkillButtons();
      } else {
        this.handlePlayerAction(dir);
      }
    });

    // ── HUD ──
    this.floorText = this.add
      .text(8, 6, "", { fontSize: "11px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold" })
      .setScrollFactor(0).setDepth(100);
    this.hpText = this.add
      .text(8, 22, "", { fontSize: "11px", color: "#e0e0e0", fontFamily: "monospace" })
      .setScrollFactor(0).setDepth(100);
    this.turnText = this.add
      .text(8, 38, "", { fontSize: "11px", color: "#60a5fa", fontFamily: "monospace" })
      .setScrollFactor(0).setDepth(100);
    this.logText = this.add
      .text(8, GAME_HEIGHT - 130, "", {
        fontSize: "10px", color: "#fbbf24", fontFamily: "monospace",
        wordWrap: { width: 340 },
      })
      .setScrollFactor(0).setDepth(100);

    // ── Skill Buttons ──
    this.createSkillButtons();

    // Menu buttons
    const menuY = GAME_HEIGHT - 40;
    const bagBtn = this.add.text(15, menuY, "[가방]", {
      fontSize: "11px", color: "#666680", fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(100).setInteractive();
    bagBtn.on("pointerdown", () => this.toggleBag());

    const waitBtn = this.add.text(105, menuY, "[대기]", {
      fontSize: "11px", color: "#666680", fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(100).setInteractive();
    waitBtn.on("pointerdown", () => {
      if (this.turnManager.isBusy || !this.player.alive || this.gameOver) return;
      this.turnManager.executeTurn(
        () => Promise.resolve(),
        this.getEnemyActions()
      ).then(() => {
        this.recoverPP(this.player);
        tickStatusEffects(this.player);
        this.updateHUD();
      });
    });

    this.add.text(195, menuY, "[줍기]", {
      fontSize: "11px", color: "#666680", fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(100).setInteractive()
      .on("pointerdown", () => this.pickupItem());

    this.add.text(285, menuY, "[💾저장]", {
      fontSize: "11px", color: "#666680", fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(100).setInteractive();

    this.updateHUD();
    this.showLog(`Beach Cave B${this.currentFloor}F`);
  }

  // ── Helpers ──

  private tileToPixelX(tileX: number): number {
    return tileX * TILE_DISPLAY + TILE_DISPLAY / 2;
  }

  private tileToPixelY(tileY: number): number {
    return tileY * TILE_DISPLAY + TILE_DISPLAY / 2;
  }

  private createAnimations(key: string, walkFrames: number, idleFrames: number) {
    for (let dir = 0; dir < 8; dir++) {
      this.anims.create({
        key: `${key}-walk-${dir}`,
        frames: this.anims.generateFrameNumbers(`${key}-walk`, {
          start: dir * walkFrames, end: dir * walkFrames + walkFrames - 1,
        }),
        frameRate: 10, repeat: -1,
      });
      this.anims.create({
        key: `${key}-idle-${dir}`,
        frames: this.anims.generateFrameNumbers(`${key}-idle`, {
          start: dir * idleFrames, end: dir * idleFrames + idleFrames - 1,
        }),
        frameRate: 5, repeat: -1,
      });
    }
  }

  // ── Skill Buttons ──

  private createSkillButtons() {
    const btnY = GAME_HEIGHT - 80;
    const skills = this.player.skills;

    for (let i = 0; i < 4; i++) {
      const skill = skills[i];
      const label = skill ? `${skill.name}\n${skill.currentPp}/${skill.pp}` : "---";
      const color = skill && skill.currentPp > 0 ? "#667eea" : "#444460";

      const btn = this.add.text(5 + i * 89, btnY, label, {
        fontSize: "10px", color, fontFamily: "monospace",
        fixedWidth: 85, align: "center",
        backgroundColor: "#1a1a2e",
        padding: { x: 2, y: 4 },
      }).setScrollFactor(0).setDepth(100).setInteractive();

      btn.on("pointerdown", () => {
        if (this.turnManager.isBusy || !this.player.alive || this.gameOver) return;
        if (!skill || skill.currentPp <= 0) {
          this.showLog("No PP left!");
          return;
        }

        if (skill.range === SkillRange.Self) {
          // Self-targeting skills activate immediately
          this.handleSkillUse(i, this.player.facing);
        } else {
          // Select skill, wait for direction tap
          if (this.activeSkillIndex === i) {
            this.activeSkillIndex = -1; // deselect
          } else {
            this.activeSkillIndex = i;
            this.showLog(`${skill.name} selected! Tap a direction.`);
          }
          this.updateSkillButtons();
        }
      });

      this.skillButtons.push(btn);
    }
  }

  private updateSkillButtons() {
    const skills = this.player.skills;
    for (let i = 0; i < this.skillButtons.length; i++) {
      const skill = skills[i];
      if (!skill) continue;
      const isSelected = this.activeSkillIndex === i;
      const haspp = skill.currentPp > 0;
      const color = isSelected ? "#fbbf24" : haspp ? "#667eea" : "#444460";
      const bg = isSelected ? "#2a2a4e" : "#1a1a2e";
      this.skillButtons[i].setText(`${skill.name}\n${skill.currentPp}/${skill.pp}`);
      this.skillButtons[i].setColor(color);
      this.skillButtons[i].setBackgroundColor(bg);
    }
  }

  private updateHUD() {
    const p = this.player.stats;
    const hpRatio = p.hp / p.maxHp;
    const hpBar = "█".repeat(Math.ceil(hpRatio * 8));
    const hpEmpty = "░".repeat(8 - hpBar.length);
    const hpColor = hpRatio > 0.5 ? "#4ade80" : hpRatio > 0.25 ? "#fbbf24" : "#ef4444";
    this.floorText.setText(`Beach Cave  B${this.currentFloor}F`);
    this.hpText.setText(`HP ${hpBar}${hpEmpty} ${p.hp}/${p.maxHp}`);
    this.hpText.setColor(hpColor);

    // Show active buffs
    const buffs = this.player.statusEffects.map(s => `${s.type}(${s.turnsLeft})`).join(" ");
    const buffStr = buffs ? `  ${buffs}` : "";
    this.turnText.setText(`Lv.${p.level}  Turn ${this.turnManager.turn}${buffStr}`);

    this.updateSkillButtons();
  }

  private showLog(msg: string) {
    this.logText.setText(msg);
    this.time.delayedCall(2500, () => {
      if (this.logText.text === msg) this.logText.setText("");
    });
  }

  // ── Items ──

  private pickupItem() {
    if (this.turnManager.isBusy || !this.player.alive || this.gameOver) return;

    const idx = this.floorItems.findIndex(
      fi => fi.x === this.player.tileX && fi.y === this.player.tileY
    );
    if (idx === -1) {
      this.showLog("Nothing here to pick up.");
      return;
    }

    if (this.inventory.length >= MAX_INVENTORY) {
      this.showLog("Inventory is full!");
      return;
    }

    const fi = this.floorItems[idx];
    // Add to inventory (stack if possible)
    const existing = this.inventory.find(s => s.item.id === fi.item.id && fi.item.stackable);
    if (existing) {
      existing.count++;
    } else {
      this.inventory.push({ item: fi.item, count: 1 });
    }

    fi.sprite.destroy();
    this.floorItems.splice(idx, 1);
    this.showLog(`Picked up ${fi.item.name}!`);
  }

  private toggleBag() {
    if (this.bagOpen) {
      this.closeBag();
    } else {
      this.openBag();
    }
  }

  private openBag() {
    if (this.turnManager.isBusy || this.gameOver) return;
    this.bagOpen = true;

    // Dark overlay
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.8
    ).setScrollFactor(0).setDepth(150).setInteractive();
    this.bagUI.push(overlay);

    const title = this.add.text(GAME_WIDTH / 2, 30, "── Bag ──", {
      fontSize: "14px", color: "#fbbf24", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(151);
    this.bagUI.push(title);

    if (this.inventory.length === 0) {
      const empty = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "Empty", {
        fontSize: "12px", color: "#666680", fontFamily: "monospace",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(151);
      this.bagUI.push(empty);
    } else {
      this.inventory.forEach((stack, i) => {
        const y = 60 + i * 32;
        const icon = stack.item.category === "berry" ? "●" : stack.item.category === "seed" ? "◆" : "★";
        const countStr = stack.count > 1 ? ` ×${stack.count}` : "";
        const btn = this.add.text(20, y, `${icon} ${stack.item.name}${countStr}`, {
          fontSize: "11px", color: "#e0e0e0", fontFamily: "monospace",
          backgroundColor: "#1a1a3e", padding: { x: 4, y: 4 },
          fixedWidth: 200,
        }).setScrollFactor(0).setDepth(151).setInteractive();

        const useBtn = this.add.text(230, y, "[Use]", {
          fontSize: "11px", color: "#4ade80", fontFamily: "monospace",
          padding: { x: 4, y: 4 },
        }).setScrollFactor(0).setDepth(151).setInteractive();

        const desc = this.add.text(20, y + 16, stack.item.description, {
          fontSize: "9px", color: "#666680", fontFamily: "monospace",
        }).setScrollFactor(0).setDepth(151);

        useBtn.on("pointerdown", () => {
          this.useItem(i);
          this.closeBag();
        });

        this.bagUI.push(btn, useBtn, desc);
      });
    }

    // Close button
    const closeBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 50, "[Close]", {
      fontSize: "14px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(151).setInteractive();
    closeBtn.on("pointerdown", () => this.closeBag());
    this.bagUI.push(closeBtn);

    overlay.on("pointerdown", () => this.closeBag());
  }

  private closeBag() {
    this.bagOpen = false;
    this.bagUI.forEach(obj => obj.destroy());
    this.bagUI = [];
  }

  private useItem(index: number) {
    const stack = this.inventory[index];
    if (!stack) return;

    const item = stack.item;

    switch (item.id) {
      case "oranBerry": {
        const heal = Math.min(30, this.player.stats.maxHp - this.player.stats.hp);
        this.player.stats.hp += heal;
        this.showLog(`Used Oran Berry! Restored ${heal} HP.`);
        break;
      }
      case "sitrusBerry": {
        const heal = Math.floor(this.player.stats.maxHp * 0.5);
        const actual = Math.min(heal, this.player.stats.maxHp - this.player.stats.hp);
        this.player.stats.hp += actual;
        this.showLog(`Used Sitrus Berry! Restored ${actual} HP.`);
        break;
      }
      case "pechaberry": {
        this.player.statusEffects = [];
        this.showLog("Used Pecha Berry! Status cleared.");
        break;
      }
      case "reviveSeed": {
        // Auto-use on death — just show message for now
        this.showLog("Revive Seed will activate if you faint.");
        // Don't consume here, consumed on death
        return; // Don't consume
      }
      case "blastSeed": {
        // Damage first enemy in facing direction
        const dx = DIR_DX[this.player.facing];
        const dy = DIR_DY[this.player.facing];
        const tx = this.player.tileX + dx;
        const ty = this.player.tileY + dy;
        const target = this.enemies.find(e => e.alive && e.tileX === tx && e.tileY === ty);
        if (target) {
          target.stats.hp = Math.max(0, target.stats.hp - 40);
          this.flashEntity(target, 2.0);
          this.showLog(`Blast Seed hit ${target.name}! 40 dmg!`);
          this.checkDeath(target);
        } else {
          this.showLog("Blast Seed missed! No enemy in front.");
        }
        break;
      }
      case "sleepSeed": {
        const dx = DIR_DX[this.player.facing];
        const dy = DIR_DY[this.player.facing];
        const tx = this.player.tileX + dx;
        const ty = this.player.tileY + dy;
        const target = this.enemies.find(e => e.alive && e.tileX === tx && e.tileY === ty);
        if (target) {
          target.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 5 });
          this.showLog(`Sleep Seed hit ${target.name}! Paralyzed!`);
        } else {
          this.showLog("Sleep Seed missed! No enemy in front.");
        }
        break;
      }
      case "escapeOrb": {
        this.showLog("Used Escape Orb! Escaped the dungeon!");
        this.gameOver = true;
        this.cameras.main.fadeOut(500);
        this.time.delayedCall(600, () => {
          this.scene.start("DungeonScene", { floor: 1 });
        });
        break;
      }
      case "luminousOrb": {
        // Just show a message — real map reveal would need fog of war
        this.showLog("Used Luminous Orb! Floor layout revealed!");
        break;
      }
      case "allPowerOrb": {
        this.player.statusEffects.push({ type: SkillEffect.AtkUp, turnsLeft: 10 });
        this.player.statusEffects.push({ type: SkillEffect.DefUp, turnsLeft: 10 });
        this.showLog("Used All-Power Orb! ATK & DEF boosted!");
        break;
      }
    }

    // Consume item
    stack.count--;
    if (stack.count <= 0) {
      this.inventory.splice(index, 1);
    }

    this.updateHUD();
  }

  /** Check for revive seed on death */
  private tryRevive(): boolean {
    const idx = this.inventory.findIndex(s => s.item.id === "reviveSeed");
    if (idx === -1) return false;

    const stack = this.inventory[idx];
    stack.count--;
    if (stack.count <= 0) this.inventory.splice(idx, 1);

    this.player.stats.hp = Math.floor(this.player.stats.maxHp * 0.5);
    this.player.alive = true;
    if (this.player.sprite) {
      this.player.sprite.setAlpha(1);
      this.player.sprite.setTint(0x44ff44);
      this.time.delayedCall(500, () => {
        if (this.player.sprite) this.player.sprite.clearTint();
      });
    }
    this.showLog("Revive Seed activated! Restored to 50% HP!");
    return true;
  }

  // ── Stairs ──

  private checkStairs() {
    const { stairsPos } = this.dungeon;
    if (this.player.tileX === stairsPos.x && this.player.tileY === stairsPos.y) {
      this.advanceFloor();
    }
  }

  private advanceFloor() {
    if (this.currentFloor >= MAX_FLOOR) {
      this.showDungeonClear();
      return;
    }

    this.gameOver = true;
    this.showLog(`Went to B${this.currentFloor + 1}F!`);

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(600, () => {
      this.scene.restart({
        floor: this.currentFloor + 1,
        hp: this.player.stats.hp,
        maxHp: this.player.stats.maxHp,
        skills: this.player.skills,
        inventory: this.inventory,
      });
    });
  }

  private showDungeonClear() {
    this.gameOver = true;

    this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.7
    ).setScrollFactor(0).setDepth(200);

    const titleText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "DUNGEON CLEAR!", {
      fontSize: "20px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `Beach Cave B${MAX_FLOOR}F cleared!`, {
      fontSize: "12px", color: "#e0e0e0", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    const restartText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50, "[Tap to restart]", {
      fontSize: "14px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setInteractive();

    restartText.on("pointerdown", () => {
      this.scene.start("DungeonScene", { floor: 1 });
    });

    this.tweens.add({
      targets: titleText,
      alpha: { from: 1, to: 0.6 },
      duration: 800, yoyo: true, repeat: -1,
    });
  }

  private showGameOver() {
    this.gameOver = true;

    this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.7
    ).setScrollFactor(0).setDepth(200);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, "GAME OVER", {
      fontSize: "22px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 5, `Fainted on B${this.currentFloor}F`, {
      fontSize: "12px", color: "#e0e0e0", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    const restartText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 45, "[Tap to retry]", {
      fontSize: "14px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setInteractive();

    restartText.on("pointerdown", () => {
      this.scene.start("DungeonScene", { floor: 1 });
    });
  }

  // ── Turn System ──

  private async handlePlayerAction(dir: Direction) {
    this.player.facing = dir;

    // Check if there's an enemy in the target direction → basic attack
    const targetX = this.player.tileX + DIR_DX[dir];
    const targetY = this.player.tileY + DIR_DY[dir];
    const targetEnemy = this.enemies.find(
      (e) => e.alive && e.tileX === targetX && e.tileY === targetY
    );

    if (targetEnemy) {
      await this.turnManager.executeTurn(
        () => this.performBasicAttack(this.player, targetEnemy),
        this.getEnemyActions()
      );
    } else {
      const canMove = this.canEntityMove(this.player, dir);
      if (!canMove) {
        this.player.sprite!.play(`${this.player.spriteKey}-idle-${dir}`);
        return;
      }
      await this.turnManager.executeTurn(
        () => this.moveEntity(this.player, dir),
        this.getEnemyActions()
      );

      // PP recovery: 1 PP for a random depleted skill on movement
      this.recoverPP(this.player);

      // Check for items on ground
      const itemHere = this.floorItems.find(
        fi => fi.x === this.player.tileX && fi.y === this.player.tileY
      );
      if (itemHere) {
        this.showLog(`There's a ${itemHere.item.name} here. [줍기] to pick up.`);
      }

      this.checkStairs();
    }

    // Tick status effects
    tickStatusEffects(this.player);
    this.updateHUD();

    if (!this.player.alive && !this.gameOver) {
      this.showGameOver();
    }
  }

  private async handleSkillUse(skillIndex: number, dir: Direction) {
    const skill = this.player.skills[skillIndex];
    if (!skill || skill.currentPp <= 0) return;

    this.player.facing = dir;
    skill.currentPp--;

    await this.turnManager.executeTurn(
      () => this.performSkill(this.player, skill, dir),
      this.getEnemyActions()
    );

    tickStatusEffects(this.player);
    this.updateHUD();

    if (!this.player.alive && !this.gameOver) {
      this.showGameOver();
    }
  }

  private canEntityMove(entity: Entity, dir: Direction): boolean {
    const nx = entity.tileX + DIR_DX[dir];
    const ny = entity.tileY + DIR_DY[dir];
    if (!canMoveTo(nx, ny, this.dungeon.terrain, this.dungeon.width, this.dungeon.height, this.allEntities, entity)) {
      return false;
    }
    return canMoveDiagonal(entity.tileX, entity.tileY, dir, this.dungeon.terrain, this.dungeon.width, this.dungeon.height);
  }

  private moveEntity(entity: Entity, dir: Direction): Promise<void> {
    return new Promise((resolve) => {
      entity.facing = dir;
      entity.tileX += DIR_DX[dir];
      entity.tileY += DIR_DY[dir];
      entity.sprite!.play(`${entity.spriteKey}-walk-${dir}`);

      this.tweens.add({
        targets: entity.sprite,
        x: this.tileToPixelX(entity.tileX),
        y: this.tileToPixelY(entity.tileY),
        duration: MOVE_DURATION,
        ease: "Linear",
        onComplete: () => {
          entity.sprite!.play(`${entity.spriteKey}-idle-${dir}`);
          resolve();
        },
      });
    });
  }

  /** PP recovery: on move, recover 1 PP on a random depleted skill */
  private recoverPP(entity: Entity) {
    const depleted = entity.skills.filter(s => s.currentPp < s.pp);
    if (depleted.length > 0) {
      const pick = depleted[Math.floor(Math.random() * depleted.length)];
      pick.currentPp = Math.min(pick.pp, pick.currentPp + 1);
    }
  }

  // ── Combat ──

  /** Basic (non-skill) attack — front 1 tile, uses entity's attackType */
  private performBasicAttack(attacker: Entity, defender: Entity): Promise<void> {
    return new Promise((resolve) => {
      const dir = attacker === this.player
        ? attacker.facing
        : directionToPlayer(attacker, this.player);
      attacker.facing = dir;
      attacker.sprite!.play(`${attacker.spriteKey}-idle-${dir}`);

      const effectiveness = getEffectiveness(attacker.attackType, defender.types);
      const effText = effectivenessText(effectiveness);

      const atk = getEffectiveAtk(attacker);
      const def = getEffectiveDef(defender);
      const baseDmg = Math.max(1, atk - Math.floor(def / 2));
      const dmg = Math.max(1, Math.floor(baseDmg * effectiveness));
      defender.stats.hp = Math.max(0, defender.stats.hp - dmg);

      this.flashEntity(defender, effectiveness);

      let logMsg = `${attacker.name} attacks ${defender.name}! ${dmg} dmg!`;
      if (effText) logMsg += `\n${effText}`;
      this.showLog(logMsg);

      this.checkDeath(defender);
      this.time.delayedCall(250, resolve);
    });
  }

  /** Skill-based attack — variable range, typed damage, effects */
  private performSkill(user: Entity, skill: Skill, dir: Direction): Promise<void> {
    return new Promise((resolve) => {
      user.facing = dir;
      user.sprite!.play(`${user.spriteKey}-idle-${dir}`);

      // Self-targeting (buff/heal)
      if (skill.range === SkillRange.Self) {
        this.applySkillEffect(user, user, skill);
        this.showLog(`${user.name} used ${skill.name}!`);
        this.time.delayedCall(250, resolve);
        return;
      }

      // Get target tiles
      const tiles = getSkillTargetTiles(
        skill.range, user.tileX, user.tileY, dir,
        this.dungeon.terrain, this.dungeon.width, this.dungeon.height
      );

      // Find entities on those tiles
      const targets = this.allEntities.filter(e =>
        e.alive && e !== user &&
        tiles.some(t => t.x === e.tileX && t.y === e.tileY)
      );

      if (targets.length === 0) {
        this.showLog(`${user.name} used ${skill.name}! But it missed!`);
        this.time.delayedCall(200, resolve);
        return;
      }

      // Apply damage to each target
      let totalHits = 0;
      for (const target of targets) {
        // Accuracy check
        if (Math.random() * 100 > skill.accuracy) {
          this.showLog(`${user.name}'s ${skill.name} missed ${target.name}!`);
          continue;
        }

        if (skill.power > 0) {
          const effectiveness = getEffectiveness(skill.type, target.types);
          const effText = effectivenessText(effectiveness);
          const atk = getEffectiveAtk(user);
          const def = getEffectiveDef(target);
          const baseDmg = Math.max(1, Math.floor(skill.power * atk / 10) - Math.floor(def / 2));
          const dmg = Math.max(1, Math.floor(baseDmg * effectiveness));
          target.stats.hp = Math.max(0, target.stats.hp - dmg);

          this.flashEntity(target, effectiveness);

          let logMsg = `${user.name}'s ${skill.name} hit ${target.name}! ${dmg} dmg!`;
          if (effText) logMsg += ` ${effText}`;
          this.showLog(logMsg);
          totalHits++;
        }

        // Apply effect
        this.applySkillEffect(user, target, skill);
        this.checkDeath(target);
      }

      if (totalHits === 0 && skill.power > 0) {
        this.showLog(`${user.name} used ${skill.name}!`);
      }

      this.time.delayedCall(300, resolve);
    });
  }

  private applySkillEffect(user: Entity, target: Entity, skill: Skill) {
    if (!skill.effect || skill.effect === SkillEffect.None) return;
    const chance = skill.effectChance ?? 100;
    if (Math.random() * 100 > chance) return;

    switch (skill.effect) {
      case SkillEffect.AtkUp:
        target.statusEffects.push({ type: SkillEffect.AtkUp, turnsLeft: 5 });
        this.showLog(`${target.name}'s ATK rose!`);
        if (target.sprite) target.sprite.setTint(0xff8844);
        this.time.delayedCall(300, () => { if (target.sprite) target.sprite.clearTint(); });
        break;

      case SkillEffect.DefUp:
        target.statusEffects.push({ type: SkillEffect.DefUp, turnsLeft: 5 });
        this.showLog(`${target.name}'s DEF rose!`);
        break;

      case SkillEffect.Heal: {
        const healAmt = Math.floor(target.stats.maxHp * 0.3);
        target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + healAmt);
        this.showLog(`${target.name} recovered ${healAmt} HP!`);
        if (target.sprite) target.sprite.setTint(0x44ff44);
        this.time.delayedCall(300, () => { if (target.sprite) target.sprite.clearTint(); });
        break;
      }

      case SkillEffect.Paralyze:
        if (!target.statusEffects.some(s => s.type === SkillEffect.Paralyze)) {
          target.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 3 });
          this.showLog(`${target.name} was paralyzed!`);
          if (target.sprite) target.sprite.setTint(0xffff00);
          this.time.delayedCall(300, () => { if (target.sprite) target.sprite.clearTint(); });
        }
        break;

      case SkillEffect.Burn:
        if (!target.statusEffects.some(s => s.type === SkillEffect.Burn)) {
          target.statusEffects.push({ type: SkillEffect.Burn, turnsLeft: 3 });
          this.showLog(`${target.name} was burned!`);
        }
        break;
    }
  }

  private flashEntity(entity: Entity, effectiveness: number) {
    if (!entity.sprite) return;
    const tintColor = effectiveness >= 2.0 ? 0xff2222 : effectiveness < 1.0 ? 0x8888ff : 0xff4444;
    entity.sprite.setTint(tintColor);
    this.time.delayedCall(200, () => {
      if (entity.sprite) entity.sprite.clearTint();
    });
  }

  private checkDeath(entity: Entity) {
    if (entity.stats.hp > 0 || !entity.alive) return;

    // Player: check revive seed
    if (entity === this.player) {
      if (this.tryRevive()) return;
    }

    entity.alive = false;
    if (entity.sprite) {
      this.tweens.add({
        targets: entity.sprite,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          entity.sprite?.destroy();
          entity.sprite = undefined;
        },
      });
    }
    if (entity === this.player) {
      this.showLog(`${this.player.name} fainted!`);
    } else {
      const expGain = 10 + this.currentFloor * 5;
      this.showLog(`${entity.name} fainted! +${expGain} EXP`);
    }
  }

  // ── Enemy AI ──

  private getEnemyActions(): (() => Promise<void>)[] {
    return this.enemies
      .filter((e) => e.alive)
      .map((enemy) => {
        return async () => {
          if (!enemy.alive || !this.player.alive) return;

          // Check paralysis
          if (isParalyzed(enemy)) {
            this.showLog(`${enemy.name} is paralyzed and can't move!`);
            return;
          }

          // Tick enemy status effects
          tickStatusEffects(enemy);

          if (isAdjacentToPlayer(enemy, this.player)) {
            const dir = directionToPlayer(enemy, this.player);
            enemy.facing = dir;
            // Pick a random usable skill or basic attack
            const usableSkills = enemy.skills.filter(s => s.currentPp > 0 && s.power > 0);
            if (usableSkills.length > 0 && Math.random() < 0.4) {
              const skill = usableSkills[Math.floor(Math.random() * usableSkills.length)];
              skill.currentPp--;
              await this.performSkill(enemy, skill, dir);
            } else {
              await this.performBasicAttack(enemy, this.player);
            }
            this.updateHUD();
            return;
          }

          const moveDir = getEnemyMoveDirection(
            enemy, this.player,
            this.dungeon.terrain, this.dungeon.width, this.dungeon.height,
            this.allEntities
          );

          if (moveDir !== null && this.canEntityMove(enemy, moveDir)) {
            await this.moveEntity(enemy, moveDir);
          }
        };
      });
  }
}
