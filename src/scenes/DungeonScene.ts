import Phaser from "phaser";
import {
  GAME_HEIGHT,
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

const MOVE_DURATION = 150; // ms per tile movement
const ENEMIES_PER_ROOM = 1; // enemies spawned per room (except player's room)

// Sprite frame counts (from AnimData.xml)
const MUDKIP_WALK_FRAMES = 6;
const MUDKIP_IDLE_FRAMES = 7;
const ZUBAT_WALK_FRAMES = 8;
const ZUBAT_IDLE_FRAMES = 8;

export class DungeonScene extends Phaser.Scene {
  private dungeon!: DungeonData;
  private turnManager = new TurnManager();

  private player!: Entity;
  private enemies: Entity[] = [];
  private allEntities: Entity[] = [];

  // HUD references
  private hpText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "DungeonScene" });
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

    // ── Create animations ──
    this.createAnimations("mudkip", MUDKIP_WALK_FRAMES, MUDKIP_IDLE_FRAMES);
    this.createAnimations("zubat", ZUBAT_WALK_FRAMES, ZUBAT_IDLE_FRAMES);

    // ── Player entity ──
    this.player = {
      tileX: playerStart.x,
      tileY: playerStart.y,
      facing: Direction.Down,
      stats: { hp: 50, maxHp: 50, atk: 12, def: 6, level: 5 },
      alive: true,
      spriteKey: "mudkip",
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
    for (let i = 1; i < rooms.length; i++) {
      const room = rooms[i];
      for (let e = 0; e < ENEMIES_PER_ROOM; e++) {
        const ex = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
        const ey = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
        if (terrain[ey][ex] !== TerrainType.GROUND) continue;
        // Don't spawn on stairs
        if (ex === stairsPos.x && ey === stairsPos.y) continue;

        const enemy: Entity = {
          tileX: ex,
          tileY: ey,
          facing: Direction.Down,
          stats: { hp: 20, maxHp: 20, atk: 8, def: 3, level: 3 },
          alive: true,
          spriteKey: "zubat",
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
      if (this.turnManager.isBusy || !this.player.alive) return;

      const dx = pointer.worldX - this.player.sprite!.x;
      const dy = pointer.worldY - this.player.sprite!.y;
      if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;

      const angle = Math.atan2(dy, dx);
      const dir = angleToDirection(angle);
      this.handlePlayerAction(dir);
    });

    // ── HUD ──
    this.hpText = this.add
      .text(8, 6, "", { fontSize: "11px", color: "#e0e0e0", fontFamily: "monospace" })
      .setScrollFactor(0).setDepth(100);
    this.turnText = this.add
      .text(8, 22, "", { fontSize: "11px", color: "#60a5fa", fontFamily: "monospace" })
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
    const hpBar = "█".repeat(Math.ceil((p.hp / p.maxHp) * 8));
    const hpEmpty = "░".repeat(8 - hpBar.length);
    this.hpText.setText(`B1F  HP ${hpBar}${hpEmpty} ${p.hp}/${p.maxHp}`);
    this.turnText.setText(`Lv.${p.level}  Turn ${this.turnManager.turn}`);
  }

  private showLog(msg: string) {
    this.logText.setText(msg);
    // Auto-clear after 2 seconds
    this.time.delayedCall(2000, () => {
      if (this.logText.text === msg) this.logText.setText("");
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
    }

    this.updateHUD();
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

      // Damage calculation: atk - def/2, minimum 1
      const dmg = Math.max(1, attacker.stats.atk - Math.floor(defender.stats.def / 2));
      defender.stats.hp = Math.max(0, defender.stats.hp - dmg);

      // Flash the defender red
      if (defender.sprite) {
        defender.sprite.setTint(0xff4444);
        this.time.delayedCall(200, () => {
          if (defender.sprite) defender.sprite.clearTint();
        });
      }

      const attackerName = attacker === this.player ? "Mudkip" : "Zubat";
      const defenderName = defender === this.player ? "Mudkip" : "Zubat";
      this.showLog(`${attackerName} attacks ${defenderName}! ${dmg} damage!`);

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
          this.showLog("Mudkip fainted!");
        } else {
          this.showLog(`${defenderName} fainted! +15 EXP`);
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
