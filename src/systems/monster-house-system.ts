/**
 * MonsterHouseSystem — Extracted from DungeonScene.
 * Manages monster house placement, triggering, enemy spawning, and clear rewards.
 */
import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, TILE_DISPLAY, TILE_SCALE } from "../config";
import { Entity, StatusEffect } from "../core/entity";
import { Direction } from "../core/direction";
import { TerrainType } from "../core/dungeon-generator";
import { DungeonDef, getDungeonFloorEnemies } from "../core/dungeon-data";
import { SPECIES, PokemonSpecies, createSpeciesSkills } from "../core/pokemon-data";
import { SPECIES_ABILITIES } from "../core/ability";
import { processLevelUp } from "../core/leveling";
import { DifficultyModifiers } from "../core/difficulty-settings";
import { ModifierEffects } from "../core/dungeon-modifiers";
import { NGPlusBonusEffects } from "../core/new-game-plus";
import { HeldItemEffect } from "../core/held-items";
import {
  DungeonMutation, MutationType, hasMutation, getMutationEffect,
} from "../core/dungeon-mutations";
import {
  ScoreChain, addChainAction,
} from "../core/score-chain";
import { sfxVictory } from "../core/sound-manager";
import { ItemSystem } from "./item-system";
import { loadMeta, saveMeta } from "../core/save-system";

/** Monster House types */
export enum MonsterHouseType {
  Standard = "standard",   // Extra enemies spawn
  Treasure = "treasure",   // More items + more enemies, 2x gold on clear
  Ambush = "ambush",       // Enemies invisible until triggered, then all attack
}

// ── Host interface: what MonsterHouseSystem needs from DungeonScene ──

export interface MonsterHouseHost {
  // Read-only game state
  readonly player: Entity;
  readonly currentFloor: number;
  readonly dungeonDef: DungeonDef;
  readonly dungeon: { terrain: TerrainType[][] };
  readonly enemies: Entity[];
  readonly allEntities: Entity[];
  readonly ngPlusLevel: number;
  readonly difficultyMods: DifficultyModifiers;
  readonly modifierEffects: ModifierEffects;
  readonly heldItemEffect: HeldItemEffect;
  readonly ngPlusBonuses: NGPlusBonusEffects;
  readonly floorMutations: DungeonMutation[];
  readonly scoreChain: ScoreChain;
  readonly seenSpecies: Set<string>;
  readonly itemSys: ItemSystem;
  readonly shopRoom: { x: number; y: number; w: number; h: number } | null;

  // Mutable shared state
  gold: number;
  totalExp: number;
  chainActionThisTurn: boolean;

  // Callbacks
  showLog(msg: string): void;
  updateHUD(): void;
  updateChainHUD(): void;
  tileToPixelX(tx: number): number;
  tileToPixelY(ty: number): number;
  getEndlessEnemies(floor: number): string[];
  getEnemyStats(floor: number, difficulty: number, species?: PokemonSpecies, ngPlusBonus?: number): {
    hp: number; maxHp: number; atk: number; def: number; level: number;
  };
}

// ── MonsterHouseSystem class ──

export class MonsterHouseSystem {
  // ── Monster house state (moved from DungeonScene) ──
  monsterHouseRoom: { x: number; y: number; w: number; h: number } | null = null;
  monsterHouseCleared = false;
  private monsterHouseTriggered = false;
  private monsterHouseType: MonsterHouseType = MonsterHouseType.Standard;
  private monsterHouseEnemies: Entity[] = [];

  constructor(private host: MonsterHouseHost) {}

  protected get scene(): Phaser.Scene { return this.host as any; }

  /** Reset all monster house state for a new floor */
  reset() {
    this.monsterHouseRoom = null;
    this.monsterHouseTriggered = false;
    this.monsterHouseType = MonsterHouseType.Standard;
    this.monsterHouseCleared = false;
    this.monsterHouseEnemies = [];
  }

  // ── Monster House Placement (called during dungeon generation) ──

  /**
   * Try to spawn a monster house on this floor.
   * Returns true if a monster house was placed.
   */
  trySpawnMonsterHouse(
    rooms: { x: number; y: number; w: number; h: number }[],
    playerStart: { x: number; y: number },
    terrain: TerrainType[][],
    stairsPos: { x: number; y: number },
    isBossFloor: boolean,
  ): boolean {
    if (this.host.currentFloor < 3 || isBossFloor || Math.random() >= 0.15 || rooms.length <= 2) return false;

    const mhCandidates = rooms.filter(r =>
      !(playerStart.x >= r.x && playerStart.x < r.x + r.w &&
        playerStart.y >= r.y && playerStart.y < r.y + r.h) &&
      r !== this.host.shopRoom &&
      r.w * r.h >= 16
    );
    if (mhCandidates.length === 0) return false;

    this.monsterHouseRoom = mhCandidates[Math.floor(Math.random() * mhCandidates.length)];

    // Roll monster house type: 50% Standard, 25% Treasure, 25% Ambush
    const typeRoll = Math.random();
    if (typeRoll < 0.50) {
      this.monsterHouseType = MonsterHouseType.Standard;
    } else if (typeRoll < 0.75) {
      this.monsterHouseType = MonsterHouseType.Treasure;
    } else {
      this.monsterHouseType = MonsterHouseType.Ambush;
    }

    // Treasure type: pre-place extra items in the room
    if (this.monsterHouseType === MonsterHouseType.Treasure) {
      const mhRoom = this.monsterHouseRoom;
      const treasureCount = 2 + Math.floor(Math.random() * 3); // 2-4 extra items
      this.host.itemSys.spawnMonsterHouseItems(terrain, stairsPos, mhRoom, treasureCount);
    }

    return true;
  }

  // ── Player Step Check ──

  /** Check if player stepped into the monster house room */
  checkMonsterHouse() {
    if (!this.monsterHouseRoom || this.monsterHouseTriggered) return;
    const r = this.monsterHouseRoom;
    const px = this.host.player.tileX;
    const py = this.host.player.tileY;
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) {
      this.monsterHouseTriggered = true;
      const scene = this.scene;

      // Type-specific warning colors and messages
      const typeConfig: Record<MonsterHouseType, { color: string, hexColor: number, label: string, flashR: number, flashG: number, flashB: number }> = {
        [MonsterHouseType.Standard]: { color: "#ff4444", hexColor: 0xff4444, label: "Monster House!", flashR: 255, flashG: 0, flashB: 0 },
        [MonsterHouseType.Treasure]: { color: "#ffd700", hexColor: 0xffd700, label: "Treasure House!", flashR: 255, flashG: 215, flashB: 0 },
        [MonsterHouseType.Ambush]: { color: "#bb44ff", hexColor: 0xbb44ff, label: "Ambush House!", flashR: 187, flashG: 68, flashB: 255 },
      };
      const cfg = typeConfig[this.monsterHouseType];

      // Camera shake (stronger for Ambush)
      const shakeIntensity = this.monsterHouseType === MonsterHouseType.Ambush ? 0.02 : 0.01;
      scene.cameras.main.shake(400, shakeIntensity);
      scene.cameras.main.flash(250, cfg.flashR, cfg.flashG, cfg.flashB);

      // Big warning text popup (centered, fades out)
      const warningText = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, cfg.label, {
        fontSize: "24px", color: cfg.color, fontFamily: "monospace", fontStyle: "bold",
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

      this.host.showLog(`It's a ${cfg.label}`);

      // Determine enemy count based on type + dungeon difficulty scaling
      const diffScale = 1 + (this.host.currentFloor - 3) * 0.15; // extra enemies on deeper floors
      let baseMin: number, baseMax: number;
      switch (this.monsterHouseType) {
        case MonsterHouseType.Standard:  baseMin = 3; baseMax = 5; break;
        case MonsterHouseType.Treasure:  baseMin = 5; baseMax = 8; break;
        case MonsterHouseType.Ambush:    baseMin = 4; baseMax = 6; break;
      }
      const scaledMin = Math.floor(baseMin * diffScale);
      const scaledMax = Math.floor(baseMax * diffScale);
      const count = scaledMin + Math.floor(Math.random() * (scaledMax - scaledMin + 1));

      const floorSpeciesIds = (this.host.dungeonDef.id === "endlessDungeon" || this.host.dungeonDef.id === "dailyDungeon")
        ? this.host.getEndlessEnemies(this.host.currentFloor)
        : getDungeonFloorEnemies(this.host.dungeonDef, this.host.currentFloor);
      const floorSpecies = floorSpeciesIds.map(id => SPECIES[id]).filter(Boolean);
      if (floorSpecies.length === 0) return;

      // Difficulty multiplier for monster house enemies
      const diffMult = this.monsterHouseType === MonsterHouseType.Ambush ? 1.3 : 1.2;

      this.monsterHouseEnemies = [];

      for (let i = 0; i < count; i++) {
        const ex = r.x + 1 + Math.floor(Math.random() * Math.max(1, r.w - 2));
        const ey = r.y + 1 + Math.floor(Math.random() * Math.max(1, r.h - 2));
        if (this.host.dungeon.terrain[ey]?.[ex] !== TerrainType.GROUND) continue;
        if (this.host.allEntities.some(e => e.alive && e.tileX === ex && e.tileY === ey)) continue;

        const sp = floorSpecies[Math.floor(Math.random() * floorSpecies.length)];
        const enemyStats = this.host.getEnemyStats(this.host.currentFloor, this.host.dungeonDef.difficulty * diffMult, sp, this.host.ngPlusLevel);

        // Apply difficulty setting modifiers to monster house enemies
        if (this.host.difficultyMods.enemyHpMult !== 1) {
          enemyStats.hp = Math.floor(enemyStats.hp * this.host.difficultyMods.enemyHpMult);
          enemyStats.maxHp = Math.floor(enemyStats.maxHp * this.host.difficultyMods.enemyHpMult);
        }
        if (this.host.difficultyMods.enemyAtkMult !== 1) {
          enemyStats.atk = Math.floor(enemyStats.atk * this.host.difficultyMods.enemyAtkMult);
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
            this.host.tileToPixelX(ex), this.host.tileToPixelY(ey), eTex
          );
          enemy.sprite.setScale(TILE_SCALE).setDepth(9);
          const eAnim = `${sp.spriteKey}-idle-${Direction.Down}`;
          if (scene.anims.exists(eAnim)) enemy.sprite.play(eAnim);

          // Ambush type: enemies start invisible (alpha 0), then fade in on trigger
          if (this.monsterHouseType === MonsterHouseType.Ambush) {
            enemy.sprite.setAlpha(0);
            scene.tweens.add({
              targets: enemy.sprite,
              alpha: 1,
              duration: 600,
              delay: 200 + i * 100,
              ease: "Power2",
            });
          }
        }
        this.host.enemies.push(enemy);
        this.host.allEntities.push(enemy);
        this.monsterHouseEnemies.push(enemy);
        this.host.seenSpecies.add(sp.id); // Pokedex tracking
      }

      // Also track any enemies already in the room before trigger as monster house enemies
      for (const e of this.host.enemies) {
        if (e.alive && !this.monsterHouseEnemies.includes(e) &&
            e.tileX >= r.x && e.tileX < r.x + r.w &&
            e.tileY >= r.y && e.tileY < r.y + r.h) {
          this.monsterHouseEnemies.push(e);
        }
      }
    }
  }

  /** Check if all monster house enemies are defeated, then reward */
  checkMonsterHouseCleared() {
    if (!this.monsterHouseRoom || !this.monsterHouseTriggered || this.monsterHouseCleared) return;
    if (this.monsterHouseEnemies.length === 0) return;

    // Check if all monster house enemies are dead
    const allDefeated = this.monsterHouseEnemies.every(e => !e.alive);
    if (!allDefeated) return;

    this.monsterHouseCleared = true;
    const scene = this.scene;

    // "Monster House Cleared!" popup
    const clearColor = this.monsterHouseType === MonsterHouseType.Treasure ? "#ffd700"
      : this.monsterHouseType === MonsterHouseType.Ambush ? "#bb44ff" : "#4ade80";
    const clearText = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "Monster House Cleared!", {
      fontSize: "20px", color: clearColor, fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300);
    scene.tweens.add({
      targets: clearText,
      y: GAME_HEIGHT / 2 - 80,
      alpha: { from: 1, to: 0 },
      scaleX: { from: 1, to: 1.2 },
      scaleY: { from: 1, to: 1.2 },
      duration: 2500,
      ease: "Quad.easeOut",
      onComplete: () => clearText.destroy(),
    });

    // Rewards based on type
    const r = this.monsterHouseRoom;
    switch (this.monsterHouseType) {
      case MonsterHouseType.Standard: {
        // 1 random item drop
        this.spawnMonsterHouseRewardItems(r, 1);
        this.host.showLog("Monster House cleared! A reward appeared!");
        break;
      }
      case MonsterHouseType.Treasure: {
        // 3-5 item drops + bonus gold (2x gold bonus)
        const itemCount = 3 + Math.floor(Math.random() * 3);
        this.spawnMonsterHouseRewardItems(r, itemCount);
        const mutGoldMult = hasMutation(this.host.floorMutations, MutationType.GoldenAge) ? getMutationEffect(MutationType.GoldenAge, "goldMult") : 1;
        const bonusGold = Math.floor((20 + this.host.currentFloor * 10) * 2 * mutGoldMult);
        this.host.gold += bonusGold;
        const meta = loadMeta();
        meta.gold = this.host.gold;
        saveMeta(meta);
        this.host.showLog(`Treasure House cleared! +${bonusGold}G and items!`);
        break;
      }
      case MonsterHouseType.Ambush: {
        // 2 item drops + EXP bonus
        this.spawnMonsterHouseRewardItems(r, 2);
        const heldExpMult = 1 + (this.host.heldItemEffect.expBonus ?? 0) / 100;
        const ngExpMultAmb = 1 + this.host.ngPlusBonuses.expPercent / 100;
        const expBonus = Math.floor((15 + this.host.currentFloor * 8) * this.host.modifierEffects.expMult * heldExpMult * ngExpMultAmb);
        this.host.totalExp += expBonus;
        // Process potential level ups from bonus EXP
        const levelResult = processLevelUp(this.host.player.stats, 0, this.host.totalExp);
        this.host.totalExp = levelResult.totalExp;
        this.host.showLog(`Ambush House survived! +${expBonus} EXP bonus!`);
        break;
      }
    }

    sfxVictory();
    scene.cameras.main.flash(300, 200, 255, 200);

    // Score chain: monster house clear
    {
      const mhBonus = addChainAction(this.host.scoreChain, "monsterHouseClear");
      this.host.chainActionThisTurn = true;
      if (mhBonus > 0) this.host.showLog(`Monster House chain bonus! +${mhBonus} pts!`);
      this.host.updateChainHUD();
    }

    this.host.updateHUD();
  }

  /** Spawn reward items on the floor inside a monster house room */
  private spawnMonsterHouseRewardItems(room: { x: number; y: number; w: number; h: number }, count: number) {
    this.host.itemSys.spawnMonsterHouseRewardItems(room, this.host.dungeon.terrain, count);
  }
}
