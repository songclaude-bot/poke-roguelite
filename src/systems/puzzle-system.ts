/**
 * PuzzleSystem — Extracted from DungeonScene.
 * Manages all puzzle room logic: intro, activation, tile sequences,
 * switch order, memory match, enemy rush, item sacrifice, and resolution.
 */
import { GAME_WIDTH, GAME_HEIGHT, TILE_DISPLAY, TILE_SCALE } from "../config";
import { Direction } from "../core/direction";
import { Entity } from "../core/entity";
import { ItemStack, ITEM_DB, MAX_INVENTORY } from "../core/item";
import { SPECIES, PokemonSpecies, createSpeciesSkills } from "../core/pokemon-data";
import { DungeonDef, getDungeonFloorEnemies } from "../core/dungeon-data";
import { DungeonData, TerrainType } from "../core/dungeon-generator";
import {
  PuzzleType, PuzzleRoom, PuzzleReward, generatePuzzleTiles,
  getPuzzleTileCount, getPuzzleReward, SWITCH_COLORS, SWITCH_LABELS,
} from "../core/puzzle-rooms";
import { DungeonMutation, MutationType, hasMutation, getMutationEffect } from "../core/dungeon-mutations";
import { ActiveBlessing, getRandomBlessing, getRandomCurse } from "../core/blessings";
import { DifficultyModifiers } from "../core/difficulty-settings";
import { ScoreChain, addChainAction } from "../core/score-chain";
import { processLevelUp } from "../core/leveling";
import { RunLog, RunLogEvent } from "../core/run-log";
import { SPECIES_ABILITIES } from "../core/ability";
import { sfxPickup, sfxHit, sfxSkill, sfxLevelUp, sfxVictory, sfxGameOver } from "../core/sound-manager";

// ── Host interface: what PuzzleSystem needs from DungeonScene ──

export interface PuzzleHost {
  // Phaser Scene API (for add, tweens, time, textures, anims)
  scene: Phaser.Scene;

  // Read-only game state
  readonly player: Entity;
  readonly currentFloor: number;
  readonly dungeonDef: DungeonDef;
  readonly dungeon: DungeonData;
  readonly difficultyMods: DifficultyModifiers;
  readonly ngPlusLevel: number;
  readonly floorMutations: DungeonMutation[];
  readonly activeBlessings: ActiveBlessing[];
  readonly scoreChain: ScoreChain;
  readonly turnManager: { turn: number };
  readonly runLog: RunLog;

  // Mutable shared state (PuzzleSystem reads & writes)
  inventory: ItemStack[];
  enemies: Entity[];
  allEntities: Entity[];
  seenSpecies: Set<string>;
  gold: number;
  totalExp: number;

  // Callbacks (delegate back to DungeonScene)
  showLog(msg: string): void;
  updateHUD(): void;
  grantBlessing(blessing: unknown): void;
  stopAutoExplore(): void;
  getEndlessEnemies(floor: number): string[];
}

// Per-floor enemy scaling (same formula as DungeonScene)
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

function tileToPixelX(tileX: number): number { return tileX * TILE_DISPLAY + TILE_DISPLAY / 2; }
function tileToPixelY(tileY: number): number { return tileY * TILE_DISPLAY + TILE_DISPLAY / 2; }

// ── PuzzleSystem class ──

export class PuzzleSystem {
  // ── Puzzle-specific state (moved from DungeonScene) ──
  puzzleRoom: { x: number; y: number; w: number; h: number } | null = null;
  puzzleData: PuzzleRoom | null = null;
  puzzleTriggered = false;
  puzzleActive = false;
  puzzleSolved = false;
  puzzleFailed = false;
  private puzzleTiles: { x: number; y: number }[] = [];
  private puzzleTileGraphics: Phaser.GameObjects.Graphics[] = [];
  private puzzleTileTweens: Phaser.Tweens.Tween[] = [];
  private puzzleSequence: number[] = [];
  private puzzlePlayerStep = 0;
  private puzzleWrongAttempts = 0;
  private puzzleTurnsUsed = 0;
  puzzleEnemies: Entity[] = [];
  puzzleMarker: Phaser.GameObjects.Text | null = null;
  private puzzleCarpet: Phaser.GameObjects.Graphics | null = null;
  private puzzleHudText: Phaser.GameObjects.Text | null = null;
  private puzzleHudBg: Phaser.GameObjects.Graphics | null = null;
  private puzzleUI: Phaser.GameObjects.GameObject[] = [];
  private puzzleShowingSequence = false;

  constructor(private host: PuzzleHost) {}

  /** Reset all puzzle state for a new floor */
  reset() {
    this.puzzleRoom = null;
    this.puzzleData = null;
    this.puzzleTriggered = false;
    this.puzzleActive = false;
    this.puzzleSolved = false;
    this.puzzleFailed = false;
    this.puzzleTiles = [];
    this.puzzleTileGraphics = [];
    this.puzzleTileTweens = [];
    this.puzzleSequence = [];
    this.puzzlePlayerStep = 0;
    this.puzzleWrongAttempts = 0;
    this.puzzleTurnsUsed = 0;
    this.puzzleEnemies = [];
    this.puzzleMarker = null;
    this.puzzleCarpet = null;
    this.puzzleHudText = null;
    this.puzzleHudBg = null;
    this.puzzleUI = [];
    this.puzzleShowingSequence = false;
  }

  /**
   * Setup puzzle room visuals (called from create() after dungeon generation).
   * Draws carpet, marker, and tile graphics.
   */
  setup(room: { x: number; y: number; w: number; h: number }, data: PuzzleRoom) {
    this.puzzleRoom = room;
    this.puzzleData = data;
    const scene = this.host.scene;

    // Puzzle room carpet (teal border on inner area)
    this.puzzleCarpet = scene.add.graphics().setDepth(3);
    this.puzzleCarpet.fillStyle(0x22d3ee, 0.12);
    this.puzzleCarpet.fillRect(
      (room.x + 1) * TILE_DISPLAY, (room.y + 1) * TILE_DISPLAY,
      (room.w - 2) * TILE_DISPLAY, (room.h - 2) * TILE_DISPLAY,
    );
    this.puzzleCarpet.lineStyle(1, 0x22d3ee, 0.4);
    this.puzzleCarpet.strokeRect(
      (room.x + 1) * TILE_DISPLAY, (room.y + 1) * TILE_DISPLAY,
      (room.w - 2) * TILE_DISPLAY, (room.h - 2) * TILE_DISPLAY,
    );

    // "?" marker at room center
    const pzMarkerX = Math.floor(room.x + room.w / 2);
    const pzMarkerY = Math.floor(room.y + room.h / 2);
    this.puzzleMarker = scene.add.text(
      pzMarkerX * TILE_DISPLAY + TILE_DISPLAY / 2,
      pzMarkerY * TILE_DISPLAY + TILE_DISPLAY / 2 - 8,
      "?", { fontSize: "18px", color: "#22d3ee", fontFamily: "monospace", fontStyle: "bold",
        stroke: "#000000", strokeThickness: 3 },
    ).setOrigin(0.5).setDepth(8);

    // Pulse animation on the marker
    scene.tweens.add({
      targets: this.puzzleMarker,
      scaleX: { from: 1, to: 1.3 },
      scaleY: { from: 1, to: 1.3 },
      alpha: { from: 1, to: 0.6 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Generate puzzle tiles for the room
    const pzType = data.type;
    const tileCount = getPuzzleTileCount(pzType, data.difficulty);
    if (pzType !== PuzzleType.EnemyRush) {
      this.puzzleTiles = generatePuzzleTiles(room.x, room.y, room.w, room.h, tileCount);
      // Build random sequence
      this.puzzleSequence = this.puzzleTiles.map((_, i) => i);
      // Shuffle for tile sequence / memory match / switch order
      for (let si = this.puzzleSequence.length - 1; si > 0; si--) {
        const sj = Math.floor(Math.random() * (si + 1));
        [this.puzzleSequence[si], this.puzzleSequence[sj]] = [this.puzzleSequence[sj], this.puzzleSequence[si]];
      }

      // Draw puzzle tile indicators on the world (initially hidden, shown when puzzle activates)
      for (let ti = 0; ti < this.puzzleTiles.length; ti++) {
        const pt = this.puzzleTiles[ti];
        const gfx = scene.add.graphics().setDepth(4);
        // Determine tile color based on puzzle type
        let tileColor = 0x22d3ee; // default teal
        if (pzType === PuzzleType.SwitchOrder && ti < SWITCH_COLORS.length) {
          tileColor = SWITCH_COLORS[ti];
        }
        gfx.fillStyle(tileColor, 0.0); // initially invisible
        gfx.fillRect(
          pt.x * TILE_DISPLAY + 4, pt.y * TILE_DISPLAY + 4,
          TILE_DISPLAY - 8, TILE_DISPLAY - 8,
        );
        gfx.setVisible(false);
        this.puzzleTileGraphics.push(gfx);
      }
    }

    this.host.showLog("There's a Puzzle Room on this floor!");
  }

  // ── Entry Point ──

  checkPuzzleRoom() {
    if (!this.puzzleRoom || !this.puzzleData || this.puzzleSolved || this.puzzleFailed) return;
    if (this.puzzleTriggered && this.puzzleActive) {
      this.handlePuzzleStep();
      return;
    }
    const r = this.puzzleRoom;
    const px = this.host.player.tileX;
    const py = this.host.player.tileY;
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) {
      if (!this.puzzleTriggered) {
        this.puzzleTriggered = true;
        this.host.stopAutoExplore();
        if (this.puzzleMarker) {
          this.puzzleMarker.destroy();
          this.puzzleMarker = null;
        }
        this.showPuzzleIntro();
      }
    }
  }

  // ── Intro UI ──

  private showPuzzleIntro() {
    if (!this.puzzleData) return;
    const scene = this.host.scene;

    const overlay = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
      .setScrollFactor(0).setDepth(200).setInteractive();
    this.puzzleUI.push(overlay);

    const title = scene.add.text(GAME_WIDTH / 2, 100, "Puzzle Room", {
      fontSize: "16px", color: "#22d3ee", fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.puzzleUI.push(title);

    const typeLabels: Record<PuzzleType, string> = {
      [PuzzleType.TileSequence]: "Tile Sequence",
      [PuzzleType.SwitchOrder]: "Switch Order",
      [PuzzleType.MemoryMatch]: "Memory Match",
      [PuzzleType.EnemyRush]: "Enemy Rush",
      [PuzzleType.ItemSacrifice]: "Item Sacrifice",
    };
    const typeName = scene.add.text(GAME_WIDTH / 2, 130, typeLabels[this.puzzleData.type], {
      fontSize: "12px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.puzzleUI.push(typeName);

    const desc = scene.add.text(GAME_WIDTH / 2, 170, this.puzzleData.description, {
      fontSize: "10px", color: "#c0c8e0", fontFamily: "monospace",
      wordWrap: { width: 280 }, align: "center", lineSpacing: 4,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(201);
    this.puzzleUI.push(desc);

    const reward = this.puzzleData.reward;
    const rewardItems = reward.items.map(id => ITEM_DB[id]?.name ?? id).join(", ");
    const rewardText = scene.add.text(GAME_WIDTH / 2, 220, `Reward: ${reward.gold}G, ${reward.exp} EXP\n${rewardItems}`, {
      fontSize: "9px", color: "#4ade80", fontFamily: "monospace",
      wordWrap: { width: 280 }, align: "center",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(201);
    this.puzzleUI.push(rewardText);

    const btnBg = scene.add.rectangle(GAME_WIDTH / 2, 310, 160, 40, 0x1a1a2e, 0.95)
      .setScrollFactor(0).setDepth(201).setInteractive()
      .setStrokeStyle(1, 0x22d3ee, 0.8);
    this.puzzleUI.push(btnBg);

    const btnText = scene.add.text(GAME_WIDTH / 2, 310, "Begin!", {
      fontSize: "14px", color: "#22d3ee", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    this.puzzleUI.push(btnText);

    btnBg.on("pointerover", () => { btnBg.setStrokeStyle(2, 0xfbbf24, 1); btnText.setColor("#fbbf24"); });
    btnBg.on("pointerout", () => { btnBg.setStrokeStyle(1, 0x22d3ee, 0.8); btnText.setColor("#22d3ee"); });
    btnBg.on("pointerdown", () => { this.closePuzzleUI(); this.activatePuzzle(); });

    const skipBg = scene.add.rectangle(GAME_WIDTH / 2, 365, 160, 30, 0x1a1a2e, 0.7)
      .setScrollFactor(0).setDepth(201).setInteractive()
      .setStrokeStyle(1, 0x666680, 0.5);
    this.puzzleUI.push(skipBg);

    const skipText = scene.add.text(GAME_WIDTH / 2, 365, "Skip", {
      fontSize: "10px", color: "#666680", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    this.puzzleUI.push(skipText);

    skipBg.on("pointerdown", () => {
      this.closePuzzleUI();
      this.puzzleFailed = true;
      this.host.showLog("You skipped the puzzle.");
    });
  }

  private closePuzzleUI() {
    for (const obj of this.puzzleUI) obj.destroy();
    this.puzzleUI = [];
  }

  // ── Activation ──

  private activatePuzzle() {
    if (!this.puzzleData || !this.puzzleRoom) return;
    this.puzzleActive = true;
    this.puzzlePlayerStep = 0;
    this.puzzleWrongAttempts = 0;
    this.puzzleTurnsUsed = 0;

    this.showPuzzleHud();

    switch (this.puzzleData.type) {
      case PuzzleType.TileSequence: this.showPuzzleTileSequence(); break;
      case PuzzleType.SwitchOrder: this.showPuzzleSwitchOrder(); break;
      case PuzzleType.MemoryMatch: this.showPuzzleMemoryMatch(); break;
      case PuzzleType.EnemyRush: this.spawnPuzzleEnemies(); break;
      case PuzzleType.ItemSacrifice: this.showPuzzleAltar(); break;
    }
  }

  // ── HUD ──

  private showPuzzleHud() {
    this.hidePuzzleHud();
    if (!this.puzzleData) return;
    const scene = this.host.scene;

    const pzType = this.puzzleData.type;
    let instructions = "";
    switch (pzType) {
      case PuzzleType.TileSequence: instructions = "Step on tiles in order!"; break;
      case PuzzleType.SwitchOrder: instructions = "Step on switches in order!"; break;
      case PuzzleType.MemoryMatch: instructions = "Memorize the pattern!"; break;
      case PuzzleType.EnemyRush: instructions = `Defeat all enemies! (${this.puzzleData.timeLimit ?? 15} turns)`; break;
      case PuzzleType.ItemSacrifice: instructions = "Drop any item on the altar!"; break;
    }

    this.puzzleHudBg = scene.add.graphics().setScrollFactor(0).setDepth(110);
    this.puzzleHudBg.fillStyle(0x0a1520, 0.85);
    this.puzzleHudBg.fillRoundedRect(GAME_WIDTH / 2 - 130, 58, 260, 22, 4);
    this.puzzleHudBg.lineStyle(1, 0x22d3ee, 0.5);
    this.puzzleHudBg.strokeRoundedRect(GAME_WIDTH / 2 - 130, 58, 260, 22, 4);

    this.puzzleHudText = scene.add.text(GAME_WIDTH / 2, 69, instructions, {
      fontSize: "9px", color: "#22d3ee", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(111);
  }

  private updatePuzzleHud() {
    if (!this.puzzleHudText || !this.puzzleData) return;
    const pzType = this.puzzleData.type;
    let text = "";
    switch (pzType) {
      case PuzzleType.TileSequence: text = `Step on tiles in order! (${this.puzzlePlayerStep}/${this.puzzleTiles.length})`; break;
      case PuzzleType.SwitchOrder: text = `Switch order! (${this.puzzlePlayerStep}/${this.puzzleTiles.length})`; break;
      case PuzzleType.MemoryMatch: {
        const maxWrong = 2;
        text = `Reproduce pattern! (${this.puzzlePlayerStep}/${this.puzzleTiles.length}) Tries: ${maxWrong - this.puzzleWrongAttempts}`;
        break;
      }
      case PuzzleType.EnemyRush: {
        const alive = this.puzzleEnemies.filter(e => e.alive).length;
        const limit = this.puzzleData.timeLimit ?? 15;
        text = `Enemies: ${alive} left | Turn ${this.puzzleTurnsUsed}/${limit}`;
        break;
      }
      case PuzzleType.ItemSacrifice: text = "Drop any item on the glowing altar!"; break;
    }
    this.puzzleHudText.setText(text);
  }

  private hidePuzzleHud() {
    if (this.puzzleHudText) { this.puzzleHudText.destroy(); this.puzzleHudText = null; }
    if (this.puzzleHudBg) { this.puzzleHudBg.destroy(); this.puzzleHudBg = null; }
  }

  // ── Tile Sequence ──

  private showPuzzleTileSequence() {
    const scene = this.host.scene;
    this.puzzleShowingSequence = true;

    for (const gfx of this.puzzleTileGraphics) { gfx.setVisible(true); gfx.setAlpha(0.3); }

    let delay = 500;
    for (let i = 0; i < this.puzzleSequence.length; i++) {
      const tileIdx = this.puzzleSequence[i];
      const pt = this.puzzleTiles[tileIdx];
      scene.time.delayedCall(delay, () => { this.flashPuzzleTile(pt.x, pt.y, 0x44ff44, 800); });
      delay += 1200;
    }

    scene.time.delayedCall(delay + 200, () => {
      this.puzzleShowingSequence = false;
      this.host.showLog("Now step on the tiles in that order!");
      this.updatePuzzleHud();
    });
  }

  // ── Switch Order ──

  private showPuzzleSwitchOrder() {
    const scene = this.host.scene;
    this.puzzleShowingSequence = true;

    for (let i = 0; i < this.puzzleTileGraphics.length; i++) {
      const gfx = this.puzzleTileGraphics[i];
      gfx.setVisible(true);
      gfx.clear();
      const color = SWITCH_COLORS[i % SWITCH_COLORS.length];
      const pt = this.puzzleTiles[i];
      gfx.fillStyle(color, 0.5);
      gfx.fillRect(pt.x * TILE_DISPLAY + 4, pt.y * TILE_DISPLAY + 4, TILE_DISPLAY - 8, TILE_DISPLAY - 8);
    }

    let delay = 500;
    for (let i = 0; i < this.puzzleSequence.length; i++) {
      const tileIdx = this.puzzleSequence[i];
      const pt = this.puzzleTiles[tileIdx];
      const color = SWITCH_COLORS[tileIdx % SWITCH_COLORS.length];
      scene.time.delayedCall(delay, () => {
        this.flashPuzzleTile(pt.x, pt.y, color, 600);
        const label = SWITCH_LABELS[tileIdx % SWITCH_LABELS.length];
        this.host.showLog(`${label}!`);
      });
      delay += 900;
    }

    scene.time.delayedCall(delay + 200, () => {
      this.puzzleShowingSequence = false;
      this.host.showLog("Step on the switches in that order!");
      this.updatePuzzleHud();
    });
  }

  // ── Memory Match ──

  private showPuzzleMemoryMatch() {
    const scene = this.host.scene;
    this.puzzleShowingSequence = true;

    for (const gfx of this.puzzleTileGraphics) { gfx.setVisible(true); gfx.setAlpha(0.2); }

    let delay = 500;
    for (let i = 0; i < this.puzzleSequence.length; i++) {
      const tileIdx = this.puzzleSequence[i];
      const pt = this.puzzleTiles[tileIdx];
      scene.time.delayedCall(delay, () => { this.flashPuzzleTile(pt.x, pt.y, 0xffffff, 600); });
      delay += 900;
    }

    scene.time.delayedCall(delay + 200, () => {
      this.puzzleShowingSequence = false;
      this.host.showLog("Now reproduce the pattern!");
      this.updatePuzzleHud();
    });
  }

  // ── Enemy Rush ──

  private spawnPuzzleEnemies() {
    if (!this.puzzleRoom || !this.puzzleData) return;
    const scene = this.host.scene;
    const host = this.host;
    const r = this.puzzleRoom;
    const count = getPuzzleTileCount(PuzzleType.EnemyRush, this.puzzleData.difficulty);

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
          tileToPixelX(ex), tileToPixelY(ey), eTex,
        );
        enemy.sprite.setScale(TILE_SCALE).setDepth(9);
        const eAnim = `${sp.spriteKey}-idle-${Direction.Down}`;
        if (scene.anims.exists(eAnim)) enemy.sprite.play(eAnim);
      }
      host.enemies.push(enemy);
      host.allEntities.push(enemy);
      this.puzzleEnemies.push(enemy);
      host.seenSpecies.add(sp.spriteKey);
    }

    host.showLog(`${count} enemies appeared! Defeat them all!`);
    this.updatePuzzleHud();
  }

  // ── Item Sacrifice ──

  private showPuzzleAltar() {
    if (this.puzzleTiles.length === 0) return;
    const scene = this.host.scene;
    const pt = this.puzzleTiles[0];

    if (this.puzzleTileGraphics.length > 0) {
      const gfx = this.puzzleTileGraphics[0];
      gfx.setVisible(true);
      gfx.clear();
      gfx.fillStyle(0xfbbf24, 0.5);
      gfx.fillRect(pt.x * TILE_DISPLAY + 2, pt.y * TILE_DISPLAY + 2, TILE_DISPLAY - 4, TILE_DISPLAY - 4);
      gfx.lineStyle(2, 0xfbbf24, 0.8);
      gfx.strokeRect(pt.x * TILE_DISPLAY + 2, pt.y * TILE_DISPLAY + 2, TILE_DISPLAY - 4, TILE_DISPLAY - 4);
    }

    const tween = scene.tweens.add({
      targets: this.puzzleTileGraphics[0],
      alpha: { from: 0.5, to: 1.0 }, duration: 600, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
    });
    this.puzzleTileTweens.push(tween);

    const altarIcon = scene.add.text(
      pt.x * TILE_DISPLAY + TILE_DISPLAY / 2, pt.y * TILE_DISPLAY + TILE_DISPLAY / 2,
      "🔥", { fontSize: "16px", fontFamily: "monospace" },
    ).setOrigin(0.5).setDepth(7);
    this.puzzleUI.push(altarIcon);

    this.host.showLog("Step on the altar with an item in your bag!");
    this.updatePuzzleHud();
  }

  // ── Tile Flash ──

  private flashPuzzleTile(x: number, y: number, color: number, duration: number) {
    const scene = this.host.scene;
    const flash = scene.add.graphics().setDepth(5);
    flash.fillStyle(color, 0.7);
    flash.fillRect(x * TILE_DISPLAY + 2, y * TILE_DISPLAY + 2, TILE_DISPLAY - 4, TILE_DISPLAY - 4);

    scene.tweens.add({
      targets: flash, alpha: { from: 0.7, to: 0 }, duration, ease: "Quad.easeOut",
      onComplete: () => flash.destroy(),
    });
  }

  // ── Step Logic ──

  private handlePuzzleStep() {
    if (!this.puzzleData || this.puzzleSolved || this.puzzleFailed) return;
    if (this.puzzleShowingSequence) return;

    const px = this.host.player.tileX;
    const py = this.host.player.tileY;

    switch (this.puzzleData.type) {
      case PuzzleType.TileSequence:
      case PuzzleType.SwitchOrder:
      case PuzzleType.MemoryMatch:
        this.handleStepOnPuzzleTile(px, py); break;
      case PuzzleType.EnemyRush:
        this.handleEnemyRushTurn(); break;
      case PuzzleType.ItemSacrifice:
        this.handleItemSacrificeTile(px, py); break;
    }
  }

  private handleStepOnPuzzleTile(px: number, py: number) {
    const tileIdx = this.puzzleTiles.findIndex(t => t.x === px && t.y === py);
    if (tileIdx === -1) return;

    const expectedIdx = this.puzzleSequence[this.puzzlePlayerStep];

    if (tileIdx === expectedIdx) {
      this.puzzlePlayerStep++;
      this.flashPuzzleTile(px, py, 0x44ff44, 400);
      sfxPickup();
      this.updatePuzzleHud();
      if (this.puzzlePlayerStep >= this.puzzleSequence.length) { this.solvePuzzle(); }
    } else {
      this.flashPuzzleTile(px, py, 0xff4444, 400);
      sfxHit();
      if (this.puzzleData?.type === PuzzleType.MemoryMatch) {
        this.puzzleWrongAttempts++;
        if (this.puzzleWrongAttempts >= 2) { this.failPuzzle(); return; }
        this.host.showLog(`Wrong! ${2 - this.puzzleWrongAttempts} tries left.`);
      } else {
        this.host.showLog("Wrong order! Resetting...");
      }
      this.puzzlePlayerStep = 0;
      this.updatePuzzleHud();
    }
  }

  /** Handle Enemy Rush turn tick (called externally too, for enemy turn integration) */
  handleEnemyRushTurn() {
    this.puzzleTurnsUsed++;
    this.updatePuzzleHud();

    const allDead = this.puzzleEnemies.every(e => !e.alive);
    if (allDead) { this.solvePuzzle(); return; }

    const limit = this.puzzleData?.timeLimit ?? 15;
    if (this.puzzleTurnsUsed >= limit) { this.failPuzzle(); }
  }

  private handleItemSacrificeTile(px: number, py: number) {
    if (this.puzzleTiles.length === 0) return;
    const altar = this.puzzleTiles[0];
    if (px !== altar.x || py !== altar.y) return;

    if (this.host.inventory.length === 0) {
      this.host.showLog("You need an item to sacrifice!");
      return;
    }

    const stack = this.host.inventory[0];
    const itemName = stack.item.name;
    stack.count--;
    if (stack.count <= 0) this.host.inventory.splice(0, 1);

    this.host.showLog(`Sacrificed ${itemName} on the altar!`);
    sfxSkill();
    this.solvePuzzle();
  }

  // ── Resolution ──

  private solvePuzzle() {
    if (!this.puzzleData) return;
    const host = this.host;
    const scene = host.scene;
    this.puzzleSolved = true;
    this.puzzleActive = false;

    host.runLog.add(RunLogEvent.PuzzleSolved, this.puzzleData.type, host.currentFloor, host.turnManager.turn);

    const reward = getPuzzleReward(this.puzzleData);

    // Gold (with GoldenAge mutation multiplier)
    const puzzleMutGoldMult = hasMutation(host.floorMutations, MutationType.GoldenAge)
      ? getMutationEffect(MutationType.GoldenAge, "goldMult") : 1;
    host.gold += Math.floor(reward.gold * puzzleMutGoldMult);

    // EXP
    const levelResult = processLevelUp(host.player.stats, reward.exp, host.totalExp);
    host.totalExp = levelResult.totalExp;
    for (const r of levelResult.results) {
      sfxLevelUp();
      host.showLog(`Level up! Lv.${r.newLevel}! HP+${r.hpGain} ATK+${r.atkGain} DEF+${r.defGain}`);
    }

    // Items
    for (const itemId of reward.items) {
      const itemDef = ITEM_DB[itemId];
      if (!itemDef) continue;
      if (host.inventory.length >= MAX_INVENTORY) {
        host.showLog(`Bag full! Couldn't get ${itemDef.name}.`);
        continue;
      }
      const existing = host.inventory.find(s => s.item.id === itemDef.id && itemDef.stackable);
      if (existing) existing.count++;
      else host.inventory.push({ item: itemDef, count: 1 });
    }

    // Blessing reward
    if (host.activeBlessings.length < 5) {
      scene.time.delayedCall(500, () => host.grantBlessing(getRandomBlessing()));
    }

    // Score chain bonus
    const chainBonus = addChainAction(host.scoreChain, "monsterHouseClear");
    if (chainBonus > 0) host.showLog(`Puzzle Chain +${chainBonus} pts!`);

    this.puzzleSuccessEffect();

    const itemNames = reward.items.map(id => ITEM_DB[id]?.name ?? id).join(", ");
    this.showPuzzleResult("Puzzle Solved!", `+${reward.gold}G, +${reward.exp} EXP\n${itemNames}`, "#4ade80");

    this.cleanupPuzzleTiles();
    this.hidePuzzleHud();
    sfxVictory();
  }

  private failPuzzle() {
    if (!this.puzzleData) return;
    const host = this.host;
    const scene = host.scene;
    this.puzzleFailed = true;
    this.puzzleActive = false;

    this.puzzleFailEffect();
    this.showPuzzleResult("Puzzle Failed", "Better luck next time...", "#ef4444");

    if (host.activeBlessings.length < 5) {
      scene.time.delayedCall(500, () => host.grantBlessing(getRandomCurse()));
    }

    this.cleanupPuzzleTiles();
    this.hidePuzzleHud();
    sfxGameOver();
  }

  // ── Visual Effects ──

  private showPuzzleResult(title: string, message: string, color: string) {
    const scene = this.host.scene;

    const overlay = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(200).setInteractive();
    const titleText = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, title, {
      fontSize: "18px", color, fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    const msgText = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, message, {
      fontSize: "11px", color: "#e0e0e0", fontFamily: "monospace",
      wordWrap: { width: 280 }, align: "center",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    scene.time.delayedCall(2000, () => { overlay.destroy(); titleText.destroy(); msgText.destroy(); });
  }

  private puzzleSuccessEffect() {
    if (!this.puzzleRoom) return;
    const scene = this.host.scene;
    const r = this.puzzleRoom;
    const cx = (r.x + r.w / 2) * TILE_DISPLAY;
    const cy = (r.y + r.h / 2) * TILE_DISPLAY;

    const flash = scene.add.graphics().setDepth(15);
    flash.fillStyle(0x44ff44, 0.3);
    flash.fillRect(r.x * TILE_DISPLAY, r.y * TILE_DISPLAY, r.w * TILE_DISPLAY, r.h * TILE_DISPLAY);
    scene.tweens.add({ targets: flash, alpha: { from: 0.3, to: 0 }, duration: 1000, ease: "Quad.easeOut", onComplete: () => flash.destroy() });

    for (let i = 0; i < 8; i++) {
      const p = scene.add.graphics().setDepth(16);
      p.fillStyle(0x44ff44, 1); p.fillCircle(0, 0, 3);
      p.setPosition(cx + (Math.random() - 0.5) * r.w * TILE_DISPLAY, cy);
      scene.tweens.add({
        targets: p, y: p.y - 40 - Math.random() * 40, x: p.x + (Math.random() - 0.5) * 30,
        alpha: { from: 1, to: 0 }, duration: 800 + Math.random() * 400, ease: "Quad.easeOut",
        onComplete: () => p.destroy(),
      });
    }
  }

  private puzzleFailEffect() {
    if (!this.puzzleRoom) return;
    const scene = this.host.scene;
    const r = this.puzzleRoom;

    const flash = scene.add.graphics().setDepth(15);
    flash.fillStyle(0xff4444, 0.3);
    flash.fillRect(r.x * TILE_DISPLAY, r.y * TILE_DISPLAY, r.w * TILE_DISPLAY, r.h * TILE_DISPLAY);
    scene.tweens.add({ targets: flash, alpha: { from: 0.3, to: 0 }, duration: 1000, ease: "Quad.easeOut", onComplete: () => flash.destroy() });
  }

  private cleanupPuzzleTiles() {
    for (const tween of this.puzzleTileTweens) { if (tween.isPlaying()) tween.stop(); }
    this.puzzleTileTweens = [];
    for (const gfx of this.puzzleTileGraphics) { gfx.destroy(); }
    this.puzzleTileGraphics = [];
    if (this.puzzleCarpet) { this.puzzleCarpet.destroy(); this.puzzleCarpet = null; }
  }
}
