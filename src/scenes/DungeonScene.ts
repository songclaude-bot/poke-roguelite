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
import { Entity, canMoveTo, canMoveDiagonal, chebyshevDist } from "../core/entity";
import { getEnemyMoveDirection, isAdjacentToPlayer, directionToPlayer } from "../core/enemy-ai";
import { PokemonType, getEffectiveness, effectivenessText } from "../core/type-chart";

const MOVE_DURATION = 150; // ms per tile movement
const ENEMIES_PER_ROOM = 1; // base enemies per room (except player's room)
const MAX_FLOOR = 5; // B5F is the last floor

// Sprite frame counts (from AnimData.xml)
const MUDKIP_WALK_FRAMES = 6;
const MUDKIP_IDLE_FRAMES = 7;
const ZUBAT_WALK_FRAMES = 8;
const ZUBAT_IDLE_FRAMES = 8;

// Per-floor enemy scaling
function getEnemyStats(floor: number) {
  const scale = 1 + (floor - 1) * 0.25; // 1.0, 1.25, 1.5, 1.75, 2.0
  return {
    hp: Math.floor(20 * scale),
    maxHp: Math.floor(20 * scale),
    atk: Math.floor(8 * scale),
    def: Math.floor(3 * scale),
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

  // Persistent player HP across floors
  private persistentHp = 50;
  private persistentMaxHp = 50;

  // HUD references
  private hpText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private floorText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;

  // Game state
  private gameOver = false;

  constructor() {
    super({ key: "DungeonScene" });
  }

  init(data?: { floor?: number; hp?: number; maxHp?: number }) {
    this.currentFloor = data?.floor ?? 1;
    this.persistentHp = data?.hp ?? 50;
    this.persistentMaxHp = data?.maxHp ?? 50;
    this.enemies = [];
    this.allEntities = [];
    this.gameOver = false;
    this.turnManager = new TurnManager();
  }

  preload() {
    this.load.image("beachcave-tiles", "tilesets/BeachCave/tileset_0.png");
    // Mudkip sprites
    this.load.spritesheet("mudkip-walk", "sprites/0258/Walk-Anim.png", {
      frameWidth: 32, frameHeight: 40,
    });
    this.load.spritesheet("mudkip-idle", "sprites/0258/Idle-Anim.png", {
      frameWidth: 24, frameHeight: 40,
    });
    // Zubat sprites
    this.load.spritesheet("zubat-walk", "sprites/0041/Walk-Anim.png", {
      frameWidth: 32, frameHeight: 56,
    });
    this.load.spritesheet("zubat-idle", "sprites/0041/Idle-Anim.png", {
      frameWidth: 32, frameHeight: 56,
    });
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

    // ── Create animations (only on first floor — they persist in cache) ──
    if (!this.anims.exists("mudkip-walk-0")) {
      this.createAnimations("mudkip", MUDKIP_WALK_FRAMES, MUDKIP_IDLE_FRAMES);
      this.createAnimations("zubat", ZUBAT_WALK_FRAMES, ZUBAT_IDLE_FRAMES);
    }

    // ── Player entity ──
    this.player = {
      tileX: playerStart.x,
      tileY: playerStart.y,
      facing: Direction.Down,
      stats: {
        hp: this.persistentHp,
        maxHp: this.persistentMaxHp,
        atk: 12, def: 6, level: 5,
      },
      alive: true,
      spriteKey: "mudkip",
      name: "Mudkip",
      types: [PokemonType.Water],
      attackType: PokemonType.Water,
    };
    this.player.sprite = this.add.sprite(
      this.tileToPixelX(this.player.tileX),
      this.tileToPixelY(this.player.tileY),
      "mudkip-idle"
    );
    this.player.sprite.setScale(TILE_SCALE).setDepth(10);
    this.player.sprite.play(`mudkip-idle-${Direction.Down}`);
    this.allEntities.push(this.player);

    // ── Spawn enemies in rooms (skip first room = player's room) ──
    const rooms = this.dungeon.rooms;
    const enemyStats = getEnemyStats(this.currentFloor);
    for (let i = 1; i < rooms.length; i++) {
      const room = rooms[i];
      for (let e = 0; e < ENEMIES_PER_ROOM; e++) {
        const ex = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
        const ey = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
        if (terrain[ey][ex] !== TerrainType.GROUND) continue;
        if (ex === stairsPos.x && ey === stairsPos.y) continue;

        const enemy: Entity = {
          tileX: ex,
          tileY: ey,
          facing: Direction.Down,
          stats: { ...enemyStats },
          alive: true,
          spriteKey: "zubat",
          name: "Zubat",
          types: [PokemonType.Poison, PokemonType.Flying],
          attackType: PokemonType.Flying,
        };
        enemy.sprite = this.add.sprite(
          this.tileToPixelX(ex),
          this.tileToPixelY(ey),
          "zubat-idle"
        );
        enemy.sprite.setScale(TILE_SCALE).setDepth(9);
        enemy.sprite.play(`zubat-idle-${Direction.Down}`);

        this.enemies.push(enemy);
        this.allEntities.push(enemy);
      }
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
      this.handlePlayerAction(dir);
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
      .text(8, GAME_HEIGHT - 120, "", {
        fontSize: "10px", color: "#fbbf24", fontFamily: "monospace",
        wordWrap: { width: 340 },
      })
      .setScrollFactor(0).setDepth(100);

    // Bottom buttons
    const btnY = GAME_HEIGHT - 80;
    ["기술1", "기술2", "기술3", "기술4"].forEach((label, i) => {
      this.add.text(20 + i * 85, btnY, `[${label}]`, {
        fontSize: "12px", color: "#667eea", fontFamily: "monospace",
      }).setScrollFactor(0).setDepth(100).setInteractive();
    });

    const menuY = GAME_HEIGHT - 50;
    ["가방", "팀", "대기", "💾저장"].forEach((label, i) => {
      this.add.text(15 + i * 88, menuY, `[${label}]`, {
        fontSize: "11px", color: "#666680", fontFamily: "monospace",
      }).setScrollFactor(0).setDepth(100).setInteractive();
    });

    this.updateHUD();

    // Floor entrance message
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

  private updateHUD() {
    const p = this.player.stats;
    const hpRatio = p.hp / p.maxHp;
    const hpBar = "█".repeat(Math.ceil(hpRatio * 8));
    const hpEmpty = "░".repeat(8 - hpBar.length);
    const hpColor = hpRatio > 0.5 ? "#4ade80" : hpRatio > 0.25 ? "#fbbf24" : "#ef4444";
    this.floorText.setText(`Beach Cave  B${this.currentFloor}F`);
    this.hpText.setText(`HP ${hpBar}${hpEmpty} ${p.hp}/${p.maxHp}`);
    this.hpText.setColor(hpColor);
    this.turnText.setText(`Lv.${p.level}  Turn ${this.turnManager.turn}`);
  }

  private showLog(msg: string) {
    this.logText.setText(msg);
    this.time.delayedCall(2500, () => {
      if (this.logText.text === msg) this.logText.setText("");
    });
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
      // Dungeon clear!
      this.showDungeonClear();
      return;
    }

    this.gameOver = true; // prevent input during transition
    this.showLog(`Went to B${this.currentFloor + 1}F!`);

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(600, () => {
      this.scene.restart({
        floor: this.currentFloor + 1,
        hp: this.player.stats.hp,
        maxHp: this.player.stats.maxHp,
      });
    });
  }

  private showDungeonClear() {
    this.gameOver = true;

    // Dark overlay
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.7
    ).setScrollFactor(0).setDepth(200);

    const titleText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "DUNGEON CLEAR!", {
      fontSize: "20px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    const detailText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `Beach Cave B${MAX_FLOOR}F cleared!`, {
      fontSize: "12px", color: "#e0e0e0", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    const restartText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50, "[Tap to restart]", {
      fontSize: "14px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setInteractive();

    restartText.on("pointerdown", () => {
      this.scene.start("DungeonScene", { floor: 1 });
    });

    // Pulsing animation on title
    this.tweens.add({
      targets: titleText,
      alpha: { from: 1, to: 0.6 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
  }

  private showGameOver() {
    this.gameOver = true;

    const overlay = this.add.rectangle(
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

    // Check if there's an enemy in the target direction → attack
    const targetX = this.player.tileX + DIR_DX[dir];
    const targetY = this.player.tileY + DIR_DY[dir];
    const targetEnemy = this.enemies.find(
      (e) => e.alive && e.tileX === targetX && e.tileY === targetY
    );

    if (targetEnemy) {
      // Attack turn
      await this.turnManager.executeTurn(
        () => this.performAttack(this.player, targetEnemy),
        this.getEnemyActions()
      );
    } else {
      // Move turn
      const canMove = this.canEntityMove(this.player, dir);
      if (!canMove) {
        // Face direction but don't use a turn
        this.player.sprite!.play(`${this.player.spriteKey}-idle-${dir}`);
        return;
      }
      await this.turnManager.executeTurn(
        () => this.moveEntity(this.player, dir),
        this.getEnemyActions()
      );

      // After moving, check if player stepped on stairs
      this.checkStairs();
    }

    this.updateHUD();

    // Check game over (player died from enemy attack)
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

  private performAttack(attacker: Entity, defender: Entity): Promise<void> {
    return new Promise((resolve) => {
      const dir = attacker === this.player
        ? attacker.facing
        : directionToPlayer(attacker, this.player);
      attacker.facing = dir;
      attacker.sprite!.play(`${attacker.spriteKey}-idle-${dir}`);

      // Type effectiveness
      const effectiveness = getEffectiveness(attacker.attackType, defender.types);
      const effText = effectivenessText(effectiveness);

      // Damage calculation: (atk - def/2) * type_effectiveness, minimum 1
      const baseDmg = Math.max(1, attacker.stats.atk - Math.floor(defender.stats.def / 2));
      const dmg = Math.max(1, Math.floor(baseDmg * effectiveness));
      defender.stats.hp = Math.max(0, defender.stats.hp - dmg);

      // Flash the defender — color based on effectiveness
      if (defender.sprite) {
        const tintColor = effectiveness >= 2.0 ? 0xff2222 : effectiveness < 1.0 ? 0x8888ff : 0xff4444;
        defender.sprite.setTint(tintColor);
        this.time.delayedCall(200, () => {
          if (defender.sprite) defender.sprite.clearTint();
        });
      }

      // Build log message
      let logMsg = `${attacker.name} attacks ${defender.name}! ${dmg} damage!`;
      if (effText) logMsg += `\n${effText}`;
      this.showLog(logMsg);

      // Check death
      if (defender.stats.hp <= 0) {
        defender.alive = false;
        if (defender.sprite) {
          this.tweens.add({
            targets: defender.sprite,
            alpha: 0,
            duration: 300,
            onComplete: () => {
              defender.sprite?.destroy();
              defender.sprite = undefined;
            },
          });
        }
        if (defender === this.player) {
          this.showLog(`${this.player.name} fainted!`);
        } else {
          const expGain = 10 + this.currentFloor * 5;
          this.showLog(`${defender.name} fainted! +${expGain} EXP`);
        }
      }

      this.time.delayedCall(250, resolve);
    });
  }

  // ── Enemy AI ──

  private getEnemyActions(): (() => Promise<void>)[] {
    return this.enemies
      .filter((e) => e.alive)
      .map((enemy) => {
        return async () => {
          if (!enemy.alive || !this.player.alive) return;

          // If adjacent to player, attack
          if (isAdjacentToPlayer(enemy, this.player)) {
            const dir = directionToPlayer(enemy, this.player);
            enemy.facing = dir;
            await this.performAttack(enemy, this.player);
            this.updateHUD();
            return;
          }

          // Try to move toward player
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
