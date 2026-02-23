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
  Entity, canMoveTo, canMoveDiagonal, chebyshevDist,
  getEffectiveAtk, getEffectiveDef, tickStatusEffects, isParalyzed, StatusEffect,
} from "../core/entity";
import { getEnemyMoveDirection, isAdjacentToPlayer, directionToPlayer } from "../core/enemy-ai";
import { getAllyMoveDirection, tryRecruit, directionTo } from "../core/ally-ai";
import { PokemonType, getEffectiveness, effectivenessText } from "../core/type-chart";
import { Skill, SkillRange, SkillEffect } from "../core/skill";
import { getSkillTargetTiles } from "../core/skill-targeting";
import { ItemDef, ItemStack, rollFloorItem, MAX_INVENTORY, ITEM_DB } from "../core/item";
import { SPECIES, PokemonSpecies, createSpeciesSkills } from "../core/pokemon-data";
import { DungeonDef, BossDef, getDungeon, getDungeonFloorEnemies } from "../core/dungeon-data";
import { expFromEnemy, processLevelUp } from "../core/leveling";
import {
  saveDungeon, clearDungeonSave, serializeSkills, serializeInventory,
  deserializeSkills as deserializeSkillsFn,
  goldFromRun, loadMeta, saveMeta,
} from "../core/save-system";
import { getUpgradeBonus } from "../scenes/UpgradeScene";
import {
  initAudio, startBgm, stopBgm,
  sfxHit, sfxSuperEffective, sfxNotEffective, sfxMove, sfxPickup,
  sfxLevelUp, sfxRecruit, sfxStairs, sfxDeath, sfxBossDefeat,
  sfxHeal, sfxSkill, sfxMenuOpen, sfxMenuClose,
} from "../core/sound-manager";

interface AllyData {
  speciesId: string;
  hp: number; maxHp: number;
  atk: number; def: number;
  level: number;
  skills: { id: string; currentPp: number }[];
}

const MOVE_DURATION = 150; // ms per tile movement
const ENEMIES_PER_ROOM = 1; // base enemies per room (except player's room)
const MAX_ALLIES = 2; // max party members (excluding player)

// Per-floor enemy scaling (uses species base stats + dungeon difficulty)
function getEnemyStats(floor: number, difficulty: number, species?: PokemonSpecies) {
  const scale = (1 + (floor - 1) * 0.25) * difficulty;
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
  private dungeonDef!: DungeonDef;
  private turnManager = new TurnManager();
  private currentFloor = 1;

  private player!: Entity;
  private enemies: Entity[] = [];
  private allies: Entity[] = [];
  private allEntities: Entity[] = [];

  // Persistent player state across floors
  private persistentHp = 50;
  private persistentMaxHp = 50;
  private persistentSkills: Skill[] | null = null;
  private persistentLevel = 5;
  private persistentAtk = 12;
  private persistentDef = 6;
  private totalExp = 0;

  // HUD references
  private hpText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private floorText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private skillButtons: Phaser.GameObjects.Text[] = [];

  // Minimap
  private minimapGfx!: Phaser.GameObjects.Graphics;
  private minimapBg!: Phaser.GameObjects.Graphics;
  private minimapVisible = true;
  private readonly MINIMAP_TILE = 3; // px per tile
  private readonly MINIMAP_X = GAME_WIDTH - 80; // top-right
  private readonly MINIMAP_Y = 4;

  // HP Bar graphics
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpBarFill!: Phaser.GameObjects.Graphics;
  private portraitSprite!: Phaser.GameObjects.Sprite;

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
  private enemiesDefeated = 0;

  // Boss state
  private bossEntity: Entity | null = null;
  private bossHpBar: Phaser.GameObjects.Graphics | null = null;
  private bossHpBg: Phaser.GameObjects.Graphics | null = null;
  private bossNameText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: "DungeonScene" });
  }

  private persistentAllies: AllyData[] | null = null;

  init(data?: { floor?: number; hp?: number; maxHp?: number; skills?: Skill[]; inventory?: ItemStack[]; level?: number; atk?: number; def?: number; exp?: number; fromHub?: boolean; dungeonId?: string; allies?: AllyData[] | null }) {
    // Apply upgrade bonuses on fresh run start (floor 1 from hub)
    const meta = loadMeta();
    const hpBonus = getUpgradeBonus(meta, "maxHp") * 5;
    const atkBonus = getUpgradeBonus(meta, "atk");
    const defBonus = getUpgradeBonus(meta, "def");

    this.dungeonDef = getDungeon(data?.dungeonId ?? "beachCave");
    const isNewRun = (data?.floor ?? 1) === 1 && !data?.hp;
    this.currentFloor = data?.floor ?? 1;
    this.persistentHp = data?.hp ?? (50 + hpBonus);
    this.persistentMaxHp = data?.maxHp ?? (50 + hpBonus);
    this.persistentSkills = data?.skills ?? null;
    this.persistentInventory = data?.inventory ?? null;
    this.persistentLevel = data?.level ?? 5;
    this.persistentAtk = data?.atk ?? (12 + atkBonus);
    this.persistentDef = data?.def ?? (6 + defBonus);
    this.totalExp = data?.exp ?? 0;
    this.enemies = [];
    this.allies = [];
    this.allEntities = [];
    this.floorItems = [];
    this.gameOver = false;
    this.bossEntity = null;
    this.bossHpBar = null;
    this.bossHpBg = null;
    this.bossNameText = null;
    this.activeSkillIndex = -1;
    this.skillButtons = [];
    this.bagOpen = false;
    this.bagUI = [];
    this.enemiesDefeated = 0;
    this.turnManager = new TurnManager();
    this.persistentAllies = data?.allies ?? null;

    // Give starter items on new run
    if (isNewRun) {
      const starterLevel = getUpgradeBonus(meta, "startItems");
      if (starterLevel > 0 && !this.persistentInventory) {
        this.persistentInventory = [{ item: ITEM_DB.oranBerry, count: starterLevel }];
      }
    }
  }

  preload() {
    // Load dungeon tileset
    this.load.image(this.dungeonDef.tilesetKey, this.dungeonDef.tilesetPath);

    // Sprite dex map for all pokemon
    const spriteMap: Record<string, string> = {
      mudkip: "0258", zubat: "0041", shellos: "0422", corsola: "0222", geodude: "0074",
      pikachu: "0025", voltorb: "0100", magnemite: "0081",
      caterpie: "0010", pidgey: "0016",
    };

    // Load player + all enemy species + ally species for this dungeon
    const allySpeciesIds = (this.persistentAllies ?? []).map(a => a.speciesId);
    const neededKeys = new Set<string>(["mudkip", ...this.dungeonDef.enemySpeciesIds, ...allySpeciesIds]);
    for (const key of neededKeys) {
      const dexNum = spriteMap[key];
      const sp = SPECIES[key];
      if (!sp || !dexNum) continue;
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
    const tileset = map.addTilesetImage(this.dungeonDef.tilesetKey)!;
    map.createLayer(0, tileset, 0, 0)!.setScale(TILE_SCALE);

    // Stairs marker
    const stairsGfx = this.add.graphics();
    const sx = stairsPos.x * TILE_DISPLAY + TILE_DISPLAY / 2;
    const sy = stairsPos.y * TILE_DISPLAY + TILE_DISPLAY / 2;
    stairsGfx.fillStyle(0xfbbf24, 0.9);
    stairsGfx.fillTriangle(sx, sy - 14, sx + 10, sy, sx - 10, sy);
    stairsGfx.fillTriangle(sx, sy + 14, sx + 10, sy, sx - 10, sy);
    stairsGfx.setDepth(5);

    // ── Create animations for needed species ──
    const neededKeys = new Set<string>(["mudkip", ...this.dungeonDef.enemySpeciesIds]);
    for (const key of neededKeys) {
      const sp = SPECIES[key];
      if (!sp || this.anims.exists(`${key}-walk-0`)) continue;
      this.createAnimations(sp.spriteKey, sp.walkFrames, sp.idleFrames);
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
        atk: this.persistentAtk, def: this.persistentDef, level: this.persistentLevel,
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

    // ── Spawn persistent allies ──
    if (this.persistentAllies) {
      for (let ai = 0; ai < this.persistentAllies.length; ai++) {
        const allyData = this.persistentAllies[ai];
        const sp = SPECIES[allyData.speciesId];
        if (!sp) continue;
        const ax = playerStart.x + (ai === 0 ? 1 : -1);
        const ay = playerStart.y;
        const validX = (ax >= 0 && ax < width && terrain[ay]?.[ax] === TerrainType.GROUND) ? ax : playerStart.x;
        const validY = (validX === playerStart.x && ay + 1 < height && terrain[ay + 1]?.[validX] === TerrainType.GROUND) ? ay + 1 : ay;

        const ally: Entity = {
          tileX: validX, tileY: validY === ay && validX === playerStart.x ? ay : validY,
          facing: Direction.Down,
          stats: { hp: allyData.hp, maxHp: allyData.maxHp, atk: allyData.atk, def: allyData.def, level: allyData.level },
          alive: true, spriteKey: sp.spriteKey, name: sp.name,
          types: sp.types, attackType: sp.attackType,
          skills: deserializeSkillsFn(allyData.skills),
          statusEffects: [], isAlly: true, speciesId: allyData.speciesId,
        };
        ally.sprite = this.add.sprite(
          this.tileToPixelX(ally.tileX), this.tileToPixelY(ally.tileY), `${sp.spriteKey}-idle`
        ).setScale(TILE_SCALE).setDepth(10);
        ally.sprite.play(`${sp.spriteKey}-idle-${Direction.Down}`);
        this.allies.push(ally);
        this.allEntities.push(ally);
      }
    }

    // ── Spawn enemies (dungeon + floor specific) ──
    const rooms = this.dungeon.rooms;
    const floorSpeciesIds = getDungeonFloorEnemies(this.dungeonDef, this.currentFloor);
    const floorSpecies = floorSpeciesIds.map(id => SPECIES[id]).filter(Boolean);
    if (floorSpecies.length === 0) floorSpecies.push(SPECIES.zubat);

    for (let i = 1; i < rooms.length; i++) {
      const room = rooms[i];
      for (let e = 0; e < ENEMIES_PER_ROOM; e++) {
        const ex = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
        const ey = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
        if (terrain[ey][ex] !== TerrainType.GROUND) continue;
        if (ex === stairsPos.x && ey === stairsPos.y) continue;

        // Pick random species from floor pool
        const sp = floorSpecies[Math.floor(Math.random() * floorSpecies.length)];
        const enemyStats = getEnemyStats(this.currentFloor, this.dungeonDef.difficulty, sp);

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
          speciesId: sp.spriteKey, // for recruitment
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

    // ── Spawn boss on final floor ──
    if (this.currentFloor === this.dungeonDef.floors && this.dungeonDef.boss) {
      const bossDef = this.dungeonDef.boss;
      const sp = SPECIES[bossDef.speciesId];
      if (sp) {
        // Place boss in the largest room (excluding player's room)
        const bossRoom = rooms.slice(1).reduce((best, r) =>
          (r.w * r.h > best.w * best.h) ? r : best, rooms[1]);
        const bx = bossRoom.x + Math.floor(bossRoom.w / 2);
        const by = bossRoom.y + Math.floor(bossRoom.h / 2);

        const baseStats = getEnemyStats(this.currentFloor, this.dungeonDef.difficulty, sp);
        const bossStats = {
          hp: Math.floor(baseStats.hp * bossDef.statMultiplier),
          maxHp: Math.floor(baseStats.hp * bossDef.statMultiplier),
          atk: Math.floor(baseStats.atk * bossDef.statMultiplier),
          def: Math.floor(baseStats.def * bossDef.statMultiplier),
          level: baseStats.level + 3,
        };

        const boss: Entity = {
          tileX: bx, tileY: by,
          facing: Direction.Down,
          stats: bossStats,
          alive: true,
          spriteKey: sp.spriteKey,
          name: bossDef.name,
          types: sp.types,
          attackType: sp.attackType,
          skills: createSpeciesSkills(sp),
          statusEffects: [],
          speciesId: sp.spriteKey,
          isBoss: true,
        };
        boss.sprite = this.add.sprite(
          this.tileToPixelX(bx), this.tileToPixelY(by), `${sp.spriteKey}-idle`
        );
        boss.sprite.setScale(TILE_SCALE * 1.5).setDepth(11);
        boss.sprite.play(`${sp.spriteKey}-idle-${Direction.Down}`);
        // Red tint aura for boss
        boss.sprite.setTint(0xff6666);
        this.time.delayedCall(800, () => { if (boss.sprite) boss.sprite.clearTint(); });

        this.bossEntity = boss;
        this.enemies.push(boss);
        this.allEntities.push(boss);
      }
    }

    // ── Spawn floor items ──
    this.inventory = this.persistentInventory ?? [];
    for (let i = 0; i < this.dungeonDef.itemsPerFloor; i++) {
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

    // ── Audio ──
    this.input.once("pointerdown", () => {
      initAudio();
      startBgm();
    });

    // ── Input ──
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.turnManager.isBusy || !this.player.alive || this.gameOver || this.bagOpen) return;

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
    // Portrait sprite (small idle frame)
    this.portraitSprite = this.add.sprite(20, 20, "mudkip-idle")
      .setScrollFactor(0).setDepth(101).setScale(1.2);
    this.portraitSprite.play("mudkip-idle-0");

    // HP Bar background
    this.hpBarBg = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.hpBarBg.fillStyle(0x1a1a2e, 0.9);
    this.hpBarBg.fillRoundedRect(38, 8, 100, 10, 3);
    this.hpBarBg.lineStyle(1, 0x333355);
    this.hpBarBg.strokeRoundedRect(38, 8, 100, 10, 3);

    // HP Bar fill
    this.hpBarFill = this.add.graphics().setScrollFactor(0).setDepth(101);

    this.floorText = this.add
      .text(8, 6, "", { fontSize: "11px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold" })
      .setScrollFactor(0).setDepth(100);
    this.hpText = this.add
      .text(40, 9, "", { fontSize: "8px", color: "#ffffff", fontFamily: "monospace" })
      .setScrollFactor(0).setDepth(102);
    this.turnText = this.add
      .text(8, 40, "", { fontSize: "10px", color: "#60a5fa", fontFamily: "monospace" })
      .setScrollFactor(0).setDepth(100);
    this.logText = this.add
      .text(8, GAME_HEIGHT - 130, "", {
        fontSize: "10px", color: "#fbbf24", fontFamily: "monospace",
        wordWrap: { width: 340 },
      })
      .setScrollFactor(0).setDepth(100);

    // ── Minimap ──
    this.minimapBg = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.minimapGfx = this.add.graphics().setScrollFactor(0).setDepth(101);
    this.createMinimap();

    // Minimap toggle
    const mmToggle = this.add.text(this.MINIMAP_X - 2, this.MINIMAP_Y + height * this.MINIMAP_TILE + 4, "[Map]", {
      fontSize: "8px", color: "#666680", fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(101).setInteractive();
    mmToggle.on("pointerdown", () => {
      this.minimapVisible = !this.minimapVisible;
      this.minimapBg.setVisible(this.minimapVisible);
      this.minimapGfx.setVisible(this.minimapVisible);
    });

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
        [...this.getAllyActions(), ...this.getEnemyActions()]
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

    const saveBtn = this.add.text(275, menuY, "[저장]", {
      fontSize: "11px", color: "#666680", fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(100).setInteractive();
    saveBtn.on("pointerdown", () => this.saveGame());

    // ── Boss HP Bar (fixed UI, hidden until boss floor) ──
    if (this.bossEntity) {
      const barW = 200;
      const barX = (GAME_WIDTH - barW) / 2;
      const barY = 56;

      this.bossHpBg = this.add.graphics().setScrollFactor(0).setDepth(100);
      this.bossHpBg.fillStyle(0x1a1a2e, 0.95);
      this.bossHpBg.fillRoundedRect(barX - 4, barY - 4, barW + 8, 24, 4);
      this.bossHpBg.lineStyle(2, 0xff4444);
      this.bossHpBg.strokeRoundedRect(barX - 4, barY - 4, barW + 8, 24, 4);

      this.bossHpBar = this.add.graphics().setScrollFactor(0).setDepth(101);

      this.bossNameText = this.add.text(GAME_WIDTH / 2, barY - 2, `★ ${this.bossEntity.name} ★`, {
        fontSize: "10px", color: "#ff6666", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(102);
    }

    this.updateHUD();

    // Boss floor entrance message
    if (this.bossEntity) {
      this.showLog(`⚠ BOSS FLOOR! ${this.bossEntity.name} awaits!`);
    } else {
      this.showLog(`${this.dungeonDef.name} B${this.currentFloor}F`);
    }
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

  private createMinimap() {
    const { width, height, terrain } = this.dungeon;
    const t = this.MINIMAP_TILE;
    const mx = this.MINIMAP_X;
    const my = this.MINIMAP_Y;

    // Background
    this.minimapBg.clear();
    this.minimapBg.fillStyle(0x000000, 0.7);
    this.minimapBg.fillRoundedRect(mx - 2, my - 2, width * t + 4, height * t + 4, 2);

    // Terrain
    this.minimapGfx.clear();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (terrain[y][x] === TerrainType.GROUND) {
          this.minimapGfx.fillStyle(0x334455, 1);
          this.minimapGfx.fillRect(mx + x * t, my + y * t, t, t);
        }
      }
    }

    // Stairs
    const { stairsPos } = this.dungeon;
    this.minimapGfx.fillStyle(0xfbbf24, 1);
    this.minimapGfx.fillRect(mx + stairsPos.x * t, my + stairsPos.y * t, t, t);
  }

  private updateMinimap() {
    if (!this.minimapVisible) return;
    const t = this.MINIMAP_TILE;
    const mx = this.MINIMAP_X;
    const my = this.MINIMAP_Y;
    const { width, height, terrain } = this.dungeon;

    this.minimapGfx.clear();

    // Terrain
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (terrain[y][x] === TerrainType.GROUND) {
          this.minimapGfx.fillStyle(0x334455, 1);
          this.minimapGfx.fillRect(mx + x * t, my + y * t, t, t);
        }
      }
    }

    // Stairs
    const { stairsPos } = this.dungeon;
    this.minimapGfx.fillStyle(0xfbbf24, 1);
    this.minimapGfx.fillRect(mx + stairsPos.x * t, my + stairsPos.y * t, t, t);

    // Floor items (pink dots)
    this.minimapGfx.fillStyle(0xff6b9d, 1);
    for (const fi of this.floorItems) {
      this.minimapGfx.fillRect(mx + fi.x * t, my + fi.y * t, t, t);
    }

    // Enemies (red dots, boss = larger)
    for (const e of this.enemies) {
      if (e.alive) {
        if (e.isBoss) {
          this.minimapGfx.fillStyle(0xff2222, 1);
          this.minimapGfx.fillRect(mx + e.tileX * t - 1, my + e.tileY * t - 1, t + 2, t + 2);
        } else {
          this.minimapGfx.fillStyle(0xef4444, 1);
          this.minimapGfx.fillRect(mx + e.tileX * t, my + e.tileY * t, t, t);
        }
      }
    }

    // Allies (blue dots)
    this.minimapGfx.fillStyle(0x60a5fa, 1);
    for (const a of this.allies) {
      if (a.alive) {
        this.minimapGfx.fillRect(mx + a.tileX * t, my + a.tileY * t, t, t);
      }
    }

    // Player (green dot, slightly larger)
    this.minimapGfx.fillStyle(0x4ade80, 1);
    this.minimapGfx.fillRect(
      mx + this.player.tileX * t - 1,
      my + this.player.tileY * t - 1,
      t + 2, t + 2
    );
  }

  private updateHUD() {
    const p = this.player.stats;
    const hpRatio = p.hp / p.maxHp;

    // Update HP bar graphics
    this.hpBarFill.clear();
    const barColor = hpRatio > 0.5 ? 0x4ade80 : hpRatio > 0.25 ? 0xfbbf24 : 0xef4444;
    const barWidth = Math.max(0, Math.floor(98 * hpRatio));
    this.hpBarFill.fillStyle(barColor, 1);
    this.hpBarFill.fillRoundedRect(39, 9, barWidth, 8, 2);

    this.floorText.setText(`${this.dungeonDef.name}  B${this.currentFloor}F`);
    this.floorText.setPosition(40, 22);
    this.hpText.setText(`${p.hp}/${p.maxHp}`);

    // Show active buffs
    const buffs = this.player.statusEffects.map(s => `${s.type}(${s.turnsLeft})`).join(" ");
    const buffStr = buffs ? `  ${buffs}` : "";
    this.turnText.setText(`Lv.${p.level}  EXP:${this.totalExp}  T${this.turnManager.turn}${buffStr}`);

    // Boss HP bar update
    if (this.bossEntity && this.bossHpBar) {
      this.bossHpBar.clear();
      if (this.bossEntity.alive) {
        const bossRatio = this.bossEntity.stats.hp / this.bossEntity.stats.maxHp;
        const barW = 200;
        const barX = (GAME_WIDTH - barW) / 2;
        const barY = 56;
        const bossBarColor = bossRatio > 0.5 ? 0xff4444 : bossRatio > 0.25 ? 0xff8844 : 0xffcc00;
        const bossBarWidth = Math.max(0, Math.floor(barW * bossRatio));
        this.bossHpBar.fillStyle(bossBarColor, 1);
        this.bossHpBar.fillRoundedRect(barX, barY, bossBarWidth, 12, 3);

        // HP text on bar
        if (this.bossNameText) {
          this.bossNameText.setText(`★ ${this.bossEntity.name} — ${this.bossEntity.stats.hp}/${this.bossEntity.stats.maxHp} ★`);
        }
      } else {
        // Boss defeated — hide bar
        if (this.bossHpBg) this.bossHpBg.setVisible(false);
        this.bossHpBar.setVisible(false);
        if (this.bossNameText) this.bossNameText.setVisible(false);
      }
    }

    this.updateSkillButtons();
    this.updateMinimap();
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
    sfxPickup();
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
    sfxMenuOpen();

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
    sfxMenuClose();
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
        if (this.player.sprite) this.showHealPopup(this.player.sprite.x, this.player.sprite.y, heal);
        break;
      }
      case "sitrusBerry": {
        const heal = Math.floor(this.player.stats.maxHp * 0.5);
        const actual = Math.min(heal, this.player.stats.maxHp - this.player.stats.hp);
        this.player.stats.hp += actual;
        this.showLog(`Used Sitrus Berry! Restored ${actual} HP.`);
        if (this.player.sprite) this.showHealPopup(this.player.sprite.x, this.player.sprite.y, actual);
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
        clearDungeonSave();
        const escGold = goldFromRun(this.currentFloor, this.enemiesDefeated, false);
        this.cameras.main.fadeOut(500);
        this.time.delayedCall(600, () => {
          this.scene.start("HubScene", { gold: escGold, cleared: false, bestFloor: this.currentFloor });
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

  // ── Save ──

  private saveGame() {
    if (this.gameOver) return;
    saveDungeon({
      version: 1,
      timestamp: Date.now(),
      floor: this.currentFloor,
      dungeonId: this.dungeonDef.id,
      hp: this.player.stats.hp,
      maxHp: this.player.stats.maxHp,
      level: this.player.stats.level,
      atk: this.player.stats.atk,
      def: this.player.stats.def,
      totalExp: this.totalExp,
      skills: serializeSkills(this.player.skills),
      inventory: serializeInventory(this.inventory),
    });
    this.showLog("Game saved!");
  }

  // ── Stairs ──

  private checkStairs() {
    const { stairsPos } = this.dungeon;
    if (this.player.tileX === stairsPos.x && this.player.tileY === stairsPos.y) {
      // Block stairs if boss is alive
      if (this.bossEntity && this.bossEntity.alive) {
        this.showLog("The stairs are sealed! Defeat the boss first!");
        return;
      }
      this.advanceFloor();
    }
  }

  private advanceFloor() {
    if (this.currentFloor >= this.dungeonDef.floors) {
      this.showDungeonClear();
      return;
    }

    this.gameOver = true;
    sfxStairs();
    this.showLog(`Went to B${this.currentFloor + 1}F!`);

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(600, () => {
      this.scene.restart({
        floor: this.currentFloor + 1,
        hp: this.player.stats.hp,
        maxHp: this.player.stats.maxHp,
        skills: this.player.skills,
        inventory: this.inventory,
        level: this.player.stats.level,
        atk: this.player.stats.atk,
        def: this.player.stats.def,
        exp: this.totalExp,
        dungeonId: this.dungeonDef.id,
        allies: this.serializeAllies(),
      });
    });
  }

  private showDungeonClear() {
    this.gameOver = true;
    stopBgm();
    clearDungeonSave();

    // Boss bonus: +50% gold if dungeon has a boss
    const baseGold = goldFromRun(this.currentFloor, this.enemiesDefeated, true);
    const gold = this.dungeonDef.boss ? Math.floor(baseGold * 1.5) : baseGold;

    this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.7
    ).setScrollFactor(0).setDepth(200);

    const titleText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, "DUNGEON CLEAR!", {
      fontSize: "20px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 15, `${this.dungeonDef.name} B${this.dungeonDef.floors}F cleared!`, {
      fontSize: "12px", color: "#e0e0e0", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, `Earned ${gold} Gold!`, {
      fontSize: "13px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    const restartText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50, "[Return to Town]", {
      fontSize: "14px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setInteractive();

    restartText.on("pointerdown", () => {
      this.scene.start("HubScene", { gold, cleared: true, bestFloor: this.dungeonDef.floors });
    });

    this.tweens.add({
      targets: titleText,
      alpha: { from: 1, to: 0.6 },
      duration: 800, yoyo: true, repeat: -1,
    });
  }

  private showGameOver() {
    this.gameOver = true;
    stopBgm();
    clearDungeonSave();

    const gold = goldFromRun(this.currentFloor, this.enemiesDefeated, false);

    this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.7
    ).setScrollFactor(0).setDepth(200);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "GAME OVER", {
      fontSize: "22px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 5, `Fainted on B${this.currentFloor}F`, {
      fontSize: "12px", color: "#e0e0e0", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 18, `Salvaged ${gold} Gold`, {
      fontSize: "11px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    const restartText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 55, "[Return to Town]", {
      fontSize: "14px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setInteractive();

    restartText.on("pointerdown", () => {
      this.scene.start("HubScene", { gold, cleared: false, bestFloor: this.currentFloor });
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
        [...this.getAllyActions(), ...this.getEnemyActions()]
      );
    } else {
      const canMove = this.canEntityMove(this.player, dir);
      if (!canMove) {
        this.player.sprite!.play(`${this.player.spriteKey}-idle-${dir}`);
        return;
      }
      await this.turnManager.executeTurn(
        () => this.moveEntity(this.player, dir),
        [...this.getAllyActions(), ...this.getEnemyActions()]
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
      if (entity === this.player) sfxMove();

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
      if (defender.sprite) {
        this.showDamagePopup(defender.sprite.x, defender.sprite.y, dmg, effectiveness);
      }

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
      sfxSkill();

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

      // Show visual effect on target tiles
      this.showSkillEffect(tiles, skill);

      // Find entities on those tiles (friendly fire prevention)
      const isUserFriendly = user === this.player || user.isAlly;
      const targets = this.allEntities.filter(e => {
        if (!e.alive || e === user) return false;
        if (!tiles.some(t => t.x === e.tileX && t.y === e.tileY)) return false;
        // Friendly = player or ally; don't hit same team
        const isTargetFriendly = e === this.player || e.isAlly;
        return isUserFriendly !== isTargetFriendly;
      });

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
          if (target.sprite) {
            this.showDamagePopup(target.sprite.x, target.sprite.y, dmg, effectiveness);
          }

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
        if (target.sprite) {
          target.sprite.setTint(0x44ff44);
          this.showHealPopup(target.sprite.x, target.sprite.y, healAmt);
        }
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

    // Sound effect based on effectiveness
    if (effectiveness >= 2.0) {
      sfxSuperEffective();
      this.cameras.main.shake(200, 0.008);
    } else if (effectiveness < 1.0) {
      sfxNotEffective();
    } else {
      sfxHit();
    }
  }

  /** Show visual effect on skill target tiles */
  private showSkillEffect(tiles: { x: number; y: number }[], skill: Skill) {
    const typeColors: Record<string, { color: number; symbol: string }> = {
      Water: { color: 0x3b82f6, symbol: "~" },
      Fire: { color: 0xef4444, symbol: "*" },
      Electric: { color: 0xfbbf24, symbol: "⚡" },
      Grass: { color: 0x22c55e, symbol: "♣" },
      Flying: { color: 0xa78bfa, symbol: ">" },
      Poison: { color: 0xa855f7, symbol: "☠" },
      Rock: { color: 0x92400e, symbol: "◆" },
      Ground: { color: 0xd97706, symbol: "▲" },
      Bug: { color: 0x84cc16, symbol: "●" },
      Normal: { color: 0xd1d5db, symbol: "✦" },
    };
    const tc = typeColors[skill.type] ?? typeColors.Normal;

    for (const t of tiles) {
      const px = t.x * TILE_DISPLAY + TILE_DISPLAY / 2;
      const py = t.y * TILE_DISPLAY + TILE_DISPLAY / 2;

      // Colored tile overlay
      const gfx = this.add.graphics().setDepth(15);
      gfx.fillStyle(tc.color, 0.4);
      gfx.fillRect(t.x * TILE_DISPLAY, t.y * TILE_DISPLAY, TILE_DISPLAY, TILE_DISPLAY);

      // Symbol
      const sym = this.add.text(px, py, tc.symbol, {
        fontSize: "16px", color: "#ffffff", fontFamily: "monospace",
        stroke: "#000000", strokeThickness: 2,
      }).setOrigin(0.5).setDepth(16);

      // Fade out
      this.tweens.add({
        targets: [gfx, sym],
        alpha: { from: 1, to: 0 },
        duration: 400,
        ease: "Quad.easeOut",
        onComplete: () => { gfx.destroy(); sym.destroy(); },
      });
    }
  }

  /** Floating damage number popup */
  private showDamagePopup(x: number, y: number, dmg: number, effectiveness: number) {
    const color = effectiveness >= 2.0 ? "#ff4444" : effectiveness < 1.0 ? "#8888ff" : "#ffffff";
    const size = effectiveness >= 2.0 ? "14px" : "11px";
    const popup = this.add.text(x, y - 10, `${dmg}`, {
      fontSize: size, color, fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);

    this.tweens.add({
      targets: popup,
      y: y - 40,
      alpha: { from: 1, to: 0 },
      duration: 800,
      ease: "Quad.easeOut",
      onComplete: () => popup.destroy(),
    });
  }

  /** Heal number popup (green) */
  private showHealPopup(x: number, y: number, amount: number) {
    sfxHeal();
    const popup = this.add.text(x, y - 10, `+${amount}`, {
      fontSize: "11px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);

    this.tweens.add({
      targets: popup,
      y: y - 40,
      alpha: { from: 1, to: 0 },
      duration: 800,
      ease: "Quad.easeOut",
      onComplete: () => popup.destroy(),
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
      sfxDeath();
      this.showLog(`${this.player.name} fainted!`);
    } else if (entity.isAlly) {
      // Ally fainted
      this.showLog(`${entity.name} fainted!`);
      this.allies = this.allies.filter(a => a !== entity);
    } else {
      // Enemy defeated — track for gold
      this.enemiesDefeated++;
      const isBossKill = entity.isBoss;
      // Grant EXP (boss gives 5x)
      const baseExp = expFromEnemy(entity.stats.level, this.currentFloor);
      const expGain = isBossKill ? baseExp * 5 : baseExp;
      this.totalExp += expGain;

      if (isBossKill) {
        // Boss defeat: big screen shake + special message
        sfxBossDefeat();
        this.cameras.main.shake(500, 0.015);
        this.showLog(`★ BOSS DEFEATED! ${entity.name} fell! +${expGain} EXP ★`);
        this.bossEntity = null;
        this.cameras.main.flash(300, 255, 255, 200);
      } else {
        this.showLog(`${entity.name} fainted! +${expGain} EXP`);
      }

      // Check level up
      const { results } = processLevelUp(
        this.player.stats, expGain, this.totalExp
      );
      this.totalExp = results.length > 0
        ? this.totalExp
        : this.totalExp;

      for (const r of results) {
        this.time.delayedCall(500, () => {
          sfxLevelUp();
          this.showLog(`Level up! Lv.${r.newLevel}! HP+${r.hpGain} ATK+${r.atkGain} DEF+${r.defGain}`);
          if (this.player.sprite) {
            this.player.sprite.setTint(0xffff44);
            this.time.delayedCall(600, () => {
              if (this.player.sprite) this.player.sprite.clearTint();
            });
          }
          this.updateHUD();
        });
      }

      // ── Recruitment check (bosses can't be recruited) ──
      if (!isBossKill && entity.speciesId && this.allies.length < MAX_ALLIES && tryRecruit(this.player.stats.level, entity.stats.level)) {
        this.time.delayedCall(800, () => {
          this.recruitEnemy(entity);
        });
      }
    }
  }

  /** Recruit a defeated enemy as ally */
  private recruitEnemy(entity: Entity) {
    const sp = entity.speciesId ? SPECIES[entity.speciesId] : null;
    if (!sp) return;

    // Create ally at the entity's last position
    const ally: Entity = {
      tileX: entity.tileX, tileY: entity.tileY,
      facing: Direction.Down,
      stats: {
        hp: Math.floor(entity.stats.maxHp * 0.5),
        maxHp: entity.stats.maxHp,
        atk: entity.stats.atk, def: entity.stats.def,
        level: entity.stats.level,
      },
      alive: true, spriteKey: sp.spriteKey, name: sp.name,
      types: sp.types, attackType: sp.attackType,
      skills: createSpeciesSkills(sp),
      statusEffects: [], isAlly: true, speciesId: entity.speciesId,
    };

    ally.sprite = this.add.sprite(
      this.tileToPixelX(ally.tileX), this.tileToPixelY(ally.tileY),
      `${sp.spriteKey}-idle`
    ).setScale(TILE_SCALE).setDepth(10);
    ally.sprite.play(`${sp.spriteKey}-idle-${Direction.Down}`);

    // Recruitment animation — pink heart + flash
    ally.sprite.setTint(0xff88cc);
    this.time.delayedCall(400, () => { if (ally.sprite) ally.sprite.clearTint(); });

    const heart = this.add.text(
      this.tileToPixelX(ally.tileX), this.tileToPixelY(ally.tileY) - 20,
      "♥", { fontSize: "18px", color: "#ff6b9d", fontFamily: "monospace" }
    ).setOrigin(0.5).setDepth(50);
    this.tweens.add({
      targets: heart, y: heart.y - 30, alpha: { from: 1, to: 0 },
      duration: 1000, ease: "Quad.easeOut",
      onComplete: () => heart.destroy(),
    });

    this.allies.push(ally);
    this.allEntities.push(ally);
    sfxRecruit();
    this.showLog(`${sp.name} joined your team!`);
    this.updateHUD();
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

          // Find closest adjacent target (player or ally)
          const adjacentTargets = [this.player, ...this.allies].filter(
            t => t.alive && chebyshevDist(enemy.tileX, enemy.tileY, t.tileX, t.tileY) === 1
          );
          if (adjacentTargets.length > 0) {
            // Prefer attacking player, otherwise random
            const target = adjacentTargets.find(t => t === this.player) ?? adjacentTargets[0];
            const dir = directionToPlayer(enemy, target);
            enemy.facing = dir;
            const usableSkills = enemy.skills.filter(s => s.currentPp > 0 && s.power > 0);
            if (usableSkills.length > 0 && Math.random() < 0.4) {
              const skill = usableSkills[Math.floor(Math.random() * usableSkills.length)];
              skill.currentPp--;
              await this.performSkill(enemy, skill, dir);
            } else {
              await this.performBasicAttack(enemy, target);
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

  // ── Ally AI ──

  private getAllyActions(): (() => Promise<void>)[] {
    return this.allies
      .filter((a) => a.alive)
      .map((ally) => {
        return async () => {
          if (!ally.alive || !this.player.alive) return;
          if (isParalyzed(ally)) return;
          tickStatusEffects(ally);

          const { moveDir, attackTarget } = getAllyMoveDirection(
            ally, this.player, this.enemies,
            this.dungeon.terrain, this.dungeon.width, this.dungeon.height,
            this.allEntities
          );

          if (attackTarget) {
            const dir = directionTo(ally, attackTarget);
            ally.facing = dir;
            // Use skill sometimes
            const usableSkills = ally.skills.filter(s => s.currentPp > 0 && s.power > 0);
            if (usableSkills.length > 0 && Math.random() < 0.35) {
              const skill = usableSkills[Math.floor(Math.random() * usableSkills.length)];
              skill.currentPp--;
              await this.performSkill(ally, skill, dir);
            } else {
              await this.performBasicAttack(ally, attackTarget);
            }
            this.updateHUD();
          } else if (moveDir !== null && this.canEntityMove(ally, moveDir)) {
            await this.moveEntity(ally, moveDir);
            this.recoverPP(ally);
          }
        };
      });
  }

  /** Serialize allies for floor transition / save */
  private serializeAllies(): AllyData[] {
    return this.allies.filter(a => a.alive).map(a => ({
      speciesId: a.speciesId!,
      hp: a.stats.hp,
      maxHp: a.stats.maxHp,
      atk: a.stats.atk,
      def: a.stats.def,
      level: a.stats.level,
      skills: serializeSkills(a.skills),
    }));
  }
}
