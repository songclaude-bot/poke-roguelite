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

const WALK_FRAMES = 6;
const IDLE_FRAMES = 7;
const MOVE_DURATION = 180; // ms per tile movement

export class DungeonScene extends Phaser.Scene {
  private dungeon!: DungeonData;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private playerTileX = 0;
  private playerTileY = 0;
  private isMoving = false;
  private facing: Direction = Direction.Down;

  constructor() {
    super({ key: "DungeonScene" });
  }

  preload() {
    this.load.image("beachcave-tiles", "tilesets/BeachCave/tileset_0.png");
    this.load.spritesheet("mudkip-walk", "sprites/0258/Walk-Anim.png", {
      frameWidth: 32,
      frameHeight: 40,
    });
    this.load.spritesheet("mudkip-idle", "sprites/0258/Idle-Anim.png", {
      frameWidth: 24,
      frameHeight: 40,
    });
  }

  create() {
    // Generate dungeon
    this.dungeon = generateDungeon();
    const { width, height, terrain, playerStart, stairsPos } = this.dungeon;

    // Build and render tilemap
    const tileData: number[][] = [];
    for (let y = 0; y < height; y++) {
      tileData[y] = [];
      for (let x = 0; x < width; x++) {
        tileData[y][x] = getTileIndex(terrain, x, y, width, height);
      }
    }

    const map = this.make.tilemap({
      data: tileData,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tileset = map.addTilesetImage("beachcave-tiles")!;
    const layer = map.createLayer(0, tileset, 0, 0)!;
    layer.setScale(TILE_SCALE);

    // Stairs marker (yellow diamond)
    const stairsGfx = this.add.graphics();
    const sx = stairsPos.x * TILE_DISPLAY + TILE_DISPLAY / 2;
    const sy = stairsPos.y * TILE_DISPLAY + TILE_DISPLAY / 2;
    stairsGfx.fillStyle(0xfbbf24, 0.9);
    stairsGfx.fillTriangle(sx, sy - 14, sx + 10, sy, sx - 10, sy);
    stairsGfx.fillTriangle(sx, sy + 14, sx + 10, sy, sx - 10, sy);
    stairsGfx.setDepth(5);

    // ── Create animations ──

    // Walk: 8 directions × 6 frames each
    for (let dir = 0; dir < 8; dir++) {
      this.anims.create({
        key: `walk-${dir}`,
        frames: this.anims.generateFrameNumbers("mudkip-walk", {
          start: dir * WALK_FRAMES,
          end: dir * WALK_FRAMES + WALK_FRAMES - 1,
        }),
        frameRate: 10,
        repeat: -1,
      });
    }

    // Idle: 8 directions × 7 frames each
    for (let dir = 0; dir < 8; dir++) {
      this.anims.create({
        key: `idle-${dir}`,
        frames: this.anims.generateFrameNumbers("mudkip-idle", {
          start: dir * IDLE_FRAMES,
          end: dir * IDLE_FRAMES + IDLE_FRAMES - 1,
        }),
        frameRate: 5,
        repeat: -1,
      });
    }

    // ── Player sprite ──
    this.playerTileX = playerStart.x;
    this.playerTileY = playerStart.y;

    this.playerSprite = this.add.sprite(
      this.tileToPixelX(this.playerTileX),
      this.tileToPixelY(this.playerTileY),
      "mudkip-idle"
    );
    this.playerSprite.setScale(TILE_SCALE);
    this.playerSprite.setDepth(10);
    this.playerSprite.play(`idle-${Direction.Down}`);

    // ── Camera: follow player ──
    const mapPixelW = width * TILE_DISPLAY;
    const mapPixelH = height * TILE_DISPLAY;
    this.cameras.main.setBounds(0, 0, mapPixelW, mapPixelH);
    this.cameras.main.startFollow(this.playerSprite, true, 0.15, 0.15);

    // ── Input: tap to move in 8 directions ──
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.isMoving) return;

      const worldX = pointer.worldX;
      const worldY = pointer.worldY;
      const dx = worldX - this.playerSprite.x;
      const dy = worldY - this.playerSprite.y;

      // Ignore taps very close to player
      if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;

      const angle = Math.atan2(dy, dx);
      const dir = angleToDirection(angle);
      this.tryMove(dir);
    });

    // ── HUD (fixed to camera) ──
    this.add
      .text(8, 8, "B1F  HP ████████  🍎 100", {
        fontSize: "11px",
        color: "#e0e0e0",
        fontFamily: "monospace",
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.add
      .text(8, 24, "Lv.5  PP ████████", {
        fontSize: "11px",
        color: "#60a5fa",
        fontFamily: "monospace",
      })
      .setScrollFactor(0)
      .setDepth(100);

    // Bottom skill buttons
    const btnY = GAME_HEIGHT - 80;
    ["기술1", "기술2", "기술3", "기술4"].forEach((label, i) => {
      this.add
        .text(20 + i * 85, btnY, `[${label}]`, {
          fontSize: "12px",
          color: "#667eea",
          fontFamily: "monospace",
        })
        .setScrollFactor(0)
        .setDepth(100)
        .setInteractive();
    });

    const menuY = GAME_HEIGHT - 50;
    ["가방", "팀", "대기", "💾저장"].forEach((label, i) => {
      this.add
        .text(15 + i * 88, menuY, `[${label}]`, {
          fontSize: "11px",
          color: "#666680",
          fontFamily: "monospace",
        })
        .setScrollFactor(0)
        .setDepth(100)
        .setInteractive();
    });
  }

  private tileToPixelX(tileX: number): number {
    return tileX * TILE_DISPLAY + TILE_DISPLAY / 2;
  }

  private tileToPixelY(tileY: number): number {
    return tileY * TILE_DISPLAY + TILE_DISPLAY / 2;
  }

  private tryMove(dir: Direction) {
    this.facing = dir;

    const dx = DIR_DX[dir];
    const dy = DIR_DY[dir];
    const newX = this.playerTileX + dx;
    const newY = this.playerTileY + dy;

    // Bounds check
    if (newX < 0 || newX >= this.dungeon.width || newY < 0 || newY >= this.dungeon.height) {
      this.playerSprite.play(`idle-${dir}`);
      return;
    }

    // Collision: can only walk on GROUND tiles
    if (this.dungeon.terrain[newY][newX] !== TerrainType.GROUND) {
      this.playerSprite.play(`idle-${dir}`);
      return;
    }

    // Diagonal movement: check if both adjacent cardinals are passable
    if (dx !== 0 && dy !== 0) {
      const cardX = this.dungeon.terrain[this.playerTileY][newX];
      const cardY = this.dungeon.terrain[newY][this.playerTileX];
      if (cardX !== TerrainType.GROUND || cardY !== TerrainType.GROUND) {
        this.playerSprite.play(`idle-${dir}`);
        return;
      }
    }

    // Execute movement
    this.isMoving = true;
    this.playerTileX = newX;
    this.playerTileY = newY;
    this.playerSprite.play(`walk-${dir}`);

    this.tweens.add({
      targets: this.playerSprite,
      x: this.tileToPixelX(newX),
      y: this.tileToPixelY(newY),
      duration: MOVE_DURATION,
      ease: "Linear",
      onComplete: () => {
        this.isMoving = false;
        this.playerSprite.play(`idle-${dir}`);
      },
    });
  }
}
