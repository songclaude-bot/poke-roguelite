/**
 * GauntletSystem — Extracted from DungeonScene.
 * Manages boss gauntlet encounters: wave spawning, HUD, rewards, cleanup.
 */
import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, TILE_DISPLAY, TILE_SCALE } from "../config";
import { Entity } from "../core/entity";
import { Direction } from "../core/direction";
import { TerrainType, DungeonData } from "../core/dungeon-generator";
import { DungeonDef } from "../core/dungeon-data";
import {
  GauntletConfig, getGauntletReward,
} from "../core/boss-gauntlet";
import { SPECIES, createSpeciesSkills } from "../core/pokemon-data";
import { SPECIES_ABILITIES } from "../core/ability";
import { ItemStack, ITEM_DB, MAX_INVENTORY } from "../core/item";
import { RunLog, RunLogEvent } from "../core/run-log";
import { TurnManager } from "../core/turn-manager";
import { DifficultyModifiers } from "../core/difficulty-settings";
import { DungeonMutation, MutationType, hasMutation, getMutationEffect } from "../core/dungeon-mutations";
import { switchToBossTheme } from "../core/sound-manager";

// ── Helper (duplicated from DungeonScene module-level function) ──
import { PokemonSpecies } from "../core/pokemon-data";

function getEnemyStats(floor: number, difficulty: number, species?: PokemonSpecies, ngPlusBonus = 0) {
  const scale = (1 + (floor - 1) * 0.25) * difficulty * (1 + ngPlusBonus * 0.1);
  const base = species?.baseStats ?? { hp: 20, atk: 8, def: 3 };
  return {
    hp: Math.floor(base.hp * scale),
    maxHp: Math.floor(base.hp * scale),
    atk: Math.floor(base.atk * scale),
    def: Math.floor(base.def * scale),
  };
}

function tileToPixelX(tileX: number): number {
  return tileX * TILE_DISPLAY + TILE_DISPLAY / 2;
}
function tileToPixelY(tileY: number): number {
  return tileY * TILE_DISPLAY + TILE_DISPLAY / 2;
}

// ── Host interface: what GauntletSystem needs from DungeonScene ──

export interface GauntletHost {
  /** Phaser Scene API (for add, tweens, time, cameras, textures, anims) */
  scene: Phaser.Scene;

  // Read-only game state
  readonly player: Entity;
  readonly currentFloor: number;
  readonly dungeonDef: DungeonDef;
  readonly dungeon: DungeonData;
  readonly ngPlusLevel: number;
  readonly difficultyMods: DifficultyModifiers;
  readonly floorMutations: DungeonMutation[];
  readonly turnManager: TurnManager;
  readonly runLog: RunLog;
  readonly gameOver: boolean;

  // Mutable shared state
  gold: number;
  totalExp: number;
  enemies: Entity[];
  allEntities: Entity[];
  inventory: ItemStack[];
  seenSpecies: Set<string>;
  bossEntity: Entity | null;
  bossHpBar: Phaser.GameObjects.Graphics | null;
  bossHpBg: Phaser.GameObjects.Graphics | null;
  bossNameText: Phaser.GameObjects.Text | null;

  // Callbacks
  showLog(msg: string): void;
  updateHUD(): void;
  tryRelicDrop(dropType: "boss" | "gauntlet" | "legendary"): void;
  /** Cleanup legendary/mini-boss HP bars that may overlap with gauntlet HUD */
  cleanupExtraHpBars(): void;
}

// ── GauntletSystem class ──

export class GauntletSystem {
  // ── Public state (read by DungeonScene guards) ──
  gauntletActive = false;
  gauntletStairsLocked = false;
  gauntletEnemies: Entity[] = [];
  totalWavesCleared = 0;

  // ── Private state ──
  private gauntletConfig: GauntletConfig | null = null;
  private gauntletCurrentWave = 0;
  private gauntletWaveText: Phaser.GameObjects.Text | null = null;
  private gauntletVignette: Phaser.GameObjects.Graphics | null = null;
  private gauntletVignetteTween: Phaser.Tweens.Tween | null = null;

  constructor(private host: GauntletHost) {}

  /** Reset all gauntlet state for a new floor */
  reset() {
    this.gauntletActive = false;
    this.gauntletConfig = null;
    this.gauntletCurrentWave = 0;
    this.totalWavesCleared = 0;
    this.gauntletEnemies = [];
    this.gauntletStairsLocked = false;
    this.gauntletWaveText = null;
    this.gauntletVignette = null;
    this.gauntletVignetteTween = null;
  }

  // ── Gauntlet Trigger (called during floor setup) ──

  /**
   * Activate the gauntlet with the given config (already generated externally).
   */
  activate(config: GauntletConfig) {
    this.gauntletConfig = config;
    this.gauntletActive = true;
    this.gauntletCurrentWave = 0;
    this.totalWavesCleared = 0;
    this.gauntletStairsLocked = true;
    this.gauntletEnemies = [];
  }

  // ── Start (called after scene is ready) ──

  /** Start the gauntlet: show announcement, create HUD, spawn first wave */
  start() {
    if (!this.gauntletConfig) return;
    const scene = this.host.scene;

    // Screen shake on gauntlet start
    scene.cameras.main.shake(500, 0.02);
    scene.cameras.main.flash(400, 255, 50, 50);

    // Big red "BOSS GAUNTLET!" announcement text
    const gauntletTitle = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "BOSS GAUNTLET!", {
      fontSize: "22px", color: "#ff2222", fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300);
    scene.tweens.add({
      targets: gauntletTitle,
      y: GAME_HEIGHT / 2 - 80,
      alpha: { from: 1, to: 0 },
      scaleX: { from: 1, to: 1.5 },
      scaleY: { from: 1, to: 1.5 },
      duration: 2500,
      ease: "Quad.easeOut",
      onComplete: () => gauntletTitle.destroy(),
    });

    this.host.showLog("A Boss Gauntlet begins! Defeat all waves!");

    // Create gauntlet wave HUD text (top center, red)
    this.gauntletWaveText = scene.add.text(
      GAME_WIDTH / 2, 86, `Wave 1/${this.gauntletConfig.waves.length}`,
      { fontSize: "11px", color: "#ff4444", fontFamily: "monospace", fontStyle: "bold",
        stroke: "#000000", strokeThickness: 2 }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(103);

    // Pulsing red vignette border
    this.gauntletVignette = scene.add.graphics().setScrollFactor(0).setDepth(99);
    this.drawGauntletVignette(0.3);
    // Pulsing tween for the vignette
    const vignetteObj = { alpha: 0.3 };
    this.gauntletVignetteTween = scene.tweens.add({
      targets: vignetteObj,
      alpha: { from: 0.15, to: 0.4 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        this.drawGauntletVignette(vignetteObj.alpha);
      },
    });

    // Switch to boss theme for dramatic effect
    switchToBossTheme();

    // Spawn the first wave after a brief delay
    scene.time.delayedCall(800, () => {
      this.spawnGauntletWave(0);
    });
  }

  /** Draw red vignette border overlay */
  private drawGauntletVignette(alpha: number) {
    if (!this.gauntletVignette) return;
    this.gauntletVignette.clear();
    // Draw red gradient border (4 edge rectangles)
    const borderW = 12;
    this.gauntletVignette.fillStyle(0xff0000, alpha);
    // top
    this.gauntletVignette.fillRect(0, 0, GAME_WIDTH, borderW);
    // bottom
    this.gauntletVignette.fillRect(0, GAME_HEIGHT - borderW, GAME_WIDTH, borderW);
    // left
    this.gauntletVignette.fillRect(0, 0, borderW, GAME_HEIGHT);
    // right
    this.gauntletVignette.fillRect(GAME_WIDTH - borderW, 0, borderW, GAME_HEIGHT);
  }

  /** Spawn a specific gauntlet wave's bosses */
  private spawnGauntletWave(waveIndex: number) {
    if (!this.gauntletConfig) return;
    if (waveIndex >= this.gauntletConfig.waves.length) return;
    const scene = this.host.scene;

    this.gauntletCurrentWave = waveIndex;
    this.gauntletEnemies = [];
    const wave = this.gauntletConfig.waves[waveIndex];
    const bossCount = wave.count ?? 1;
    const rooms = this.host.dungeon.rooms;

    // Pick the largest room (excluding the player's room) for boss placement
    const bossRoom = rooms.length > 1
      ? rooms.slice(1).reduce((best, r) => (r.w * r.h > best.w * best.h) ? r : best, rooms[1])
      : rooms[0];

    for (let i = 0; i < bossCount; i++) {
      const speciesId = i === 0 ? wave.bossSpecies : this.gauntletConfig.waves[waveIndex].bossSpecies;
      const sp = SPECIES[speciesId];
      if (!sp) continue;

      // Offset placement for multiple bosses
      const offsetX = i === 0 ? 0 : (i % 2 === 0 ? 1 : -1);
      const offsetY = i > 1 ? 1 : 0;
      let bx = bossRoom.x + Math.floor(bossRoom.w / 2) + offsetX;
      let by = bossRoom.y + Math.floor(bossRoom.h / 2) + offsetY;

      // Clamp to room bounds
      bx = Math.max(bossRoom.x + 1, Math.min(bossRoom.x + bossRoom.w - 2, bx));
      by = Math.max(bossRoom.y + 1, Math.min(bossRoom.y + bossRoom.h - 2, by));

      // Make sure tile is ground and not occupied
      if (this.host.dungeon.terrain[by]?.[bx] !== TerrainType.GROUND) continue;
      if (this.host.allEntities.some(e => e.alive && e.tileX === bx && e.tileY === by)) {
        // Try adjacent tile
        bx = Math.min(bossRoom.x + bossRoom.w - 2, bx + 1);
      }

      const baseStats = getEnemyStats(this.host.currentFloor, this.host.dungeonDef.difficulty, sp, this.host.ngPlusLevel);
      const bossStats = {
        hp: Math.floor(baseStats.hp * wave.hpMultiplier * this.host.difficultyMods.enemyHpMult),
        maxHp: Math.floor(baseStats.hp * wave.hpMultiplier * this.host.difficultyMods.enemyHpMult),
        atk: Math.floor(baseStats.atk * wave.hpMultiplier * this.host.difficultyMods.enemyAtkMult),
        def: Math.floor(baseStats.def * wave.hpMultiplier),
        level: wave.level,
      };

      const bossName = waveIndex === (this.gauntletConfig.waves.length - 1) && this.gauntletConfig.waves.length >= 3
        ? `Elite ${sp.name}` : `Gauntlet ${sp.name}`;

      const boss: Entity = {
        tileX: bx, tileY: by,
        facing: Direction.Down,
        stats: bossStats,
        alive: true,
        spriteKey: sp.spriteKey,
        name: bossName,
        types: sp.types,
        attackType: sp.attackType,
        skills: createSpeciesSkills(sp),
        statusEffects: [],
        speciesId: sp.spriteKey,
        isBoss: true,
        ability: SPECIES_ABILITIES[sp.spriteKey],
      };

      // Create sprite with boss entrance animation (fade-in + size bounce)
      const bossTex = `${sp.spriteKey}-idle`;
      if (scene.textures.exists(bossTex)) {
        boss.sprite = scene.add.sprite(
          tileToPixelX(bx), tileToPixelY(by), bossTex
        );
        boss.sprite.setScale(0).setDepth(11).setAlpha(0);
        const bossAnim = `${sp.spriteKey}-idle-${Direction.Down}`;
        if (scene.anims.exists(bossAnim)) boss.sprite.play(bossAnim);

        // Boss entrance animation: fade-in + size bounce
        scene.tweens.add({
          targets: boss.sprite,
          scaleX: TILE_SCALE * 1.5,
          scaleY: TILE_SCALE * 1.5,
          alpha: 1,
          duration: 500,
          ease: "Back.easeOut",
          onComplete: () => {
            // Settle to normal boss scale
            if (boss.sprite) {
              scene.tweens.add({
                targets: boss.sprite,
                scaleX: TILE_SCALE * 1.4,
                scaleY: TILE_SCALE * 1.4,
                duration: 200,
                ease: "Quad.easeOut",
              });
            }
          },
        });
      }

      // Orange-red tint aura for gauntlet bosses
      if (boss.sprite) boss.sprite.setTint(0xff8833);
      scene.time.delayedCall(800, () => { if (boss.sprite) boss.sprite.clearTint(); });

      // Track as the main boss entity for HP bar display (first boss of wave)
      if (i === 0) {
        this.host.bossEntity = boss;
      }

      this.gauntletEnemies.push(boss);
      this.host.enemies.push(boss);
      this.host.allEntities.push(boss);
      this.host.seenSpecies.add(sp.id);
    }

    // Create/update boss HP bar for the first boss of this wave
    this.createGauntletBossHpBar();

    // Update wave HUD text
    if (this.gauntletWaveText) {
      this.gauntletWaveText.setText(`Wave ${waveIndex + 1}/${this.gauntletConfig.waves.length}`);
    }

    this.host.updateHUD();
  }

  /** Create/refresh the boss HP bar for the gauntlet's current primary boss */
  private createGauntletBossHpBar() {
    const scene = this.host.scene;
    // Clean up existing boss HP bar
    if (this.host.bossHpBg) this.host.bossHpBg.destroy();
    if (this.host.bossHpBar) this.host.bossHpBar.destroy();
    if (this.host.bossNameText) this.host.bossNameText.destroy();

    if (!this.host.bossEntity) return;

    const barW = 200;
    const barX = (GAME_WIDTH - barW) / 2;
    const barY = 56;

    this.host.bossHpBg = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.host.bossHpBg.fillStyle(0x1a1a2e, 0.95);
    this.host.bossHpBg.fillRoundedRect(barX - 4, barY - 4, barW + 8, 24, 4);
    this.host.bossHpBg.lineStyle(2, 0xff4444);
    this.host.bossHpBg.strokeRoundedRect(barX - 4, barY - 4, barW + 8, 24, 4);

    this.host.bossHpBar = scene.add.graphics().setScrollFactor(0).setDepth(101);

    this.host.bossNameText = scene.add.text(GAME_WIDTH / 2, barY - 2, `★ ${this.host.bossEntity.name} ★`, {
      fontSize: "10px", color: "#ff6666", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(102);
  }

  // ── Wave Clear Check ──

  /** Check if all gauntlet enemies in the current wave are defeated */
  checkGauntletWaveCleared() {
    if (!this.gauntletActive || !this.gauntletConfig) return;
    const scene = this.host.scene;

    // Check if all gauntlet enemies in the current wave are dead
    const allDead = this.gauntletEnemies.every(e => !e.alive);
    if (!allDead) return;

    this.totalWavesCleared++;
    const totalWaves = this.gauntletConfig.waves.length;
    const currentWaveDisplay = this.gauntletCurrentWave + 1;

    if (currentWaveDisplay < totalWaves) {
      // More waves remain — show "Wave X/Y Cleared!" and prepare next wave
      const waveMsg = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20,
        `Wave ${currentWaveDisplay}/${totalWaves} Cleared!`,
        { fontSize: "18px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
          stroke: "#000000", strokeThickness: 4 }
      ).setOrigin(0.5).setScrollFactor(0).setDepth(300);
      scene.tweens.add({
        targets: waveMsg,
        y: GAME_HEIGHT / 2 - 50,
        alpha: { from: 1, to: 0 },
        duration: 2000,
        ease: "Quad.easeOut",
        onComplete: () => waveMsg.destroy(),
      });

      // Flash between waves
      scene.cameras.main.flash(300, 255, 200, 100);

      this.host.showLog(`Wave ${currentWaveDisplay}/${totalWaves} cleared!`);

      // Heal player 20% HP between waves if restBetweenWaves
      if (this.gauntletConfig.restBetweenWaves && this.host.player.alive) {
        const healAmount = Math.floor(this.host.player.stats.maxHp * 0.2);
        this.host.player.stats.hp = Math.min(this.host.player.stats.maxHp, this.host.player.stats.hp + healAmount);
        this.host.showLog(`Resting... Recovered ${healAmount} HP!`);
        this.host.updateHUD();
      }

      // Clean up current boss HP bar
      this.host.bossEntity = null;

      // Spawn next wave after a rest period (3 seconds)
      scene.time.delayedCall(3000, () => {
        this.spawnGauntletWave(this.gauntletCurrentWave + 1);
      });
    } else {
      // All waves cleared — gauntlet complete!
      this.gauntletActive = false;
      this.gauntletStairsLocked = false;
      this.host.bossEntity = null;

      // Run log: gauntlet cleared
      this.host.runLog.add(RunLogEvent.GauntletCleared, `${this.totalWavesCleared} waves`, this.host.currentFloor, this.host.turnManager.turn);

      // "GAUNTLET COMPLETE!" gold celebration text
      const completeText = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30,
        "GAUNTLET COMPLETE!",
        { fontSize: "20px", color: "#ffd700", fontFamily: "monospace", fontStyle: "bold",
          stroke: "#000000", strokeThickness: 5 }
      ).setOrigin(0.5).setScrollFactor(0).setDepth(300);
      scene.tweens.add({
        targets: completeText,
        y: GAME_HEIGHT / 2 - 70,
        alpha: { from: 1, to: 0 },
        scaleX: { from: 1, to: 1.4 },
        scaleY: { from: 1, to: 1.4 },
        duration: 3000,
        ease: "Quad.easeOut",
        onComplete: () => completeText.destroy(),
      });

      // Explosion particles on gauntlet completion
      this.spawnGauntletParticles();

      // Screen shake + gold flash
      scene.cameras.main.shake(600, 0.02);
      scene.cameras.main.flash(500, 255, 215, 0);

      // Award rewards (GoldenAge mutation multiplier)
      const reward = getGauntletReward(this.gauntletConfig, this.totalWavesCleared);
      const gauntletMutGoldMult = hasMutation(this.host.floorMutations, MutationType.GoldenAge) ? getMutationEffect(MutationType.GoldenAge, "goldMult") : 1;
      this.host.gold += Math.floor(reward.gold * gauntletMutGoldMult);
      this.host.totalExp += reward.exp;
      this.host.showLog(`Gauntlet complete! +${reward.gold}G +${reward.exp} EXP`);

      if (reward.item) {
        const itemDef = ITEM_DB[reward.item];
        if (itemDef && this.host.inventory.length < MAX_INVENTORY) {
          const existing = this.host.inventory.find(s => s.item.id === itemDef.id && itemDef.stackable);
          if (existing) existing.count++;
          else this.host.inventory.push({ item: itemDef, count: 1 });
          this.host.showLog(`Bonus: Received ${itemDef.name}!`);
        }
      }

      // Remove vignette and wave HUD
      this.cleanupGauntletHUD();

      // Relic drop: gauntlet clear
      this.host.tryRelicDrop("gauntlet");

      this.host.updateHUD();
    }
  }

  /** Spawn explosion particles for gauntlet completion */
  private spawnGauntletParticles() {
    const scene = this.host.scene;
    const colors = [0xffd700, 0xff6622, 0xff4444, 0xffaa00, 0xffffff];
    for (let i = 0; i < 20; i++) {
      const px = GAME_WIDTH / 2 + (Math.random() - 0.5) * 200;
      const py = GAME_HEIGHT / 2 + (Math.random() - 0.5) * 100;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 2 + Math.random() * 4;
      const particle = scene.add.graphics().setScrollFactor(0).setDepth(301);
      particle.fillStyle(color, 1);
      particle.fillCircle(px, py, size);
      scene.tweens.add({
        targets: particle,
        x: (Math.random() - 0.5) * 120,
        y: -40 - Math.random() * 80,
        alpha: { from: 1, to: 0 },
        scaleX: { from: 1, to: 0.2 },
        scaleY: { from: 1, to: 0.2 },
        duration: 800 + Math.random() * 600,
        ease: "Quad.easeOut",
        onComplete: () => particle.destroy(),
      });
    }
  }

  /** Clean up gauntlet HUD elements */
  cleanupGauntletHUD() {
    if (this.gauntletWaveText) {
      this.gauntletWaveText.destroy();
      this.gauntletWaveText = null;
    }
    if (this.gauntletVignetteTween) {
      this.gauntletVignetteTween.stop();
      this.gauntletVignetteTween = null;
    }
    if (this.gauntletVignette) {
      this.gauntletVignette.destroy();
      this.gauntletVignette = null;
    }
    // Clean up boss HP bar
    if (this.host.bossHpBg) { this.host.bossHpBg.destroy(); this.host.bossHpBg = null; }
    if (this.host.bossHpBar) { this.host.bossHpBar.destroy(); this.host.bossHpBar = null; }
    if (this.host.bossNameText) { this.host.bossNameText.destroy(); this.host.bossNameText = null; }
    // Clean up legendary/mini-boss HP bars (delegated back to DungeonScene)
    this.host.cleanupExtraHpBars();
  }
}
