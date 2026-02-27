/**
 * TrapHazardSystem — Extracted from DungeonScene.
 * Manages all trap and hazard tile logic: spawning, visuals, player/entity checks, effects.
 */
import Phaser from "phaser";
import { TILE_DISPLAY } from "../config";
import { Entity } from "../core/entity";
import { TerrainType, DungeonData } from "../core/dungeon-generator";
import { DungeonDef } from "../core/dungeon-data";
import { TrapType, FloorTrap, trapsPerFloor, generateTraps } from "../core/trap";
import {
  HazardType, FloorHazard, isImmuneToHazard, generateHazards,
} from "../core/hazard-tiles";
import { AbilityId } from "../core/ability";
import { SkillEffect } from "../core/skill";
import { PokemonType } from "../core/type-chart";
import { Direction, DIR_DX, DIR_DY } from "../core/direction";
import { ScoreChain, resetChain } from "../core/score-chain";
import { sfxTrap } from "../core/sound-manager";
import { ItemStack } from "../core/item";

// ── Host interface: what TrapHazardSystem needs from DungeonScene ──

export interface TrapHazardHost {
  // Read-only game state
  readonly player: Entity;
  readonly dungeon: DungeonData;
  readonly currentFloor: number;
  readonly dungeonDef: DungeonDef;
  readonly allEntities: Entity[];
  readonly enemies: Entity[];
  readonly ngPlusLevel: number;
  readonly difficultyMods: { trapFreqMult: number; enemyHpMult: number; enemyAtkMult: number };
  readonly isBossRush: boolean;
  readonly floorItems: { x: number; y: number }[];
  readonly allies: Entity[];

  // Mutable shared state
  belly: number;
  inventory: ItemStack[];
  scoreChain: ScoreChain;
  seenSpecies: Set<string>;

  // Minimap visibility (for hazard log filtering)
  readonly minimapCurrentlyVisible: boolean[][];

  // Callbacks (delegate back to DungeonScene)
  showLog(msg: string): void;
  updateHUD(): void;
  updateChainHUD(): void;
  tileToPixelX(tileX: number): number;
  tileToPixelY(tileY: number): number;
  showDamagePopup(x: number, y: number, dmg: number, alpha: number): void;
  checkPlayerDeath(): void;
  spawnSummonTrapEnemies(trapX: number, trapY: number): void;
}

// ── TrapHazardSystem class ──

export class TrapHazardSystem {
  // ── Public state (read by minimap, event room, etc.) ──
  floorTraps: FloorTrap[] = [];
  floorHazards: FloorHazard[] = [];

  // ── Private state ──
  private trapGraphics: Phaser.GameObjects.Graphics[] = [];
  private hazardGraphics: Phaser.GameObjects.Graphics[] = [];
  private hazardTweens: Phaser.Tweens.Tween[] = [];

  constructor(private host: TrapHazardHost) {}

  protected get scene(): Phaser.Scene { return this.host as any; }

  /** Reset all trap and hazard state for a new floor */
  reset() {
    this.floorTraps = [];
    this.trapGraphics = [];
    this.floorHazards = [];
    this.hazardGraphics = [];
    this.hazardTweens = [];
  }

  // ── Trap Spawning (called during dungeon generation) ──

  /**
   * Spawn hidden floor traps.
   * @param occupiedPositions Set of "x,y" strings that are already occupied
   * @returns the Set of occupied positions (with trap positions added)
   */
  spawnTraps(occupiedPositions: Set<string>): Set<string> {
    const { width, height, terrain, stairsPos, playerStart } = this.host.dungeon;
    const trapCount = Math.floor(
      trapsPerFloor(this.host.currentFloor, this.host.dungeonDef.difficulty) *
      this.host.difficultyMods.trapFreqMult
    );

    this.floorTraps = generateTraps(
      width, height, terrain as unknown as number[][],
      trapCount,
      stairsPos.x, stairsPos.y,
      playerStart.x, playerStart.y,
      occupiedPositions,
      TerrainType.GROUND as unknown as number,
    );

    // Return updated occupied set (with trap positions)
    const updated = new Set<string>(occupiedPositions);
    for (const ft of this.floorTraps) updated.add(`${ft.x},${ft.y}`);
    return updated;
  }

  // ── Hazard Spawning ──

  /**
   * Spawn visible hazard tiles and render them.
   * @param occupiedPositions Set of "x,y" strings to avoid (including trap positions)
   */
  spawnHazards(occupiedPositions: Set<string>) {
    const { width, height, terrain, stairsPos, playerStart } = this.host.dungeon;

    this.floorHazards = generateHazards(
      width, height, terrain as unknown as number[][],
      this.host.currentFloor,
      this.host.dungeonDef.id,
      stairsPos.x, stairsPos.y,
      playerStart.x, playerStart.y,
      occupiedPositions,
      TerrainType.GROUND as unknown as number,
    );

    // Render hazard tiles and start visual effect tweens
    this.renderHazardTiles();
  }

  // ── Trap Checks ──

  /** Check if player stepped on a hidden trap and trigger it */
  checkTraps() {
    const ft = this.floorTraps.find(
      t => t.x === this.host.player.tileX && t.y === this.host.player.tileY && !t.triggered
    );
    if (!ft) return;

    sfxTrap();
    ft.triggered = true;
    ft.revealed = true;

    // Ability: Rock Head — immune to trap damage
    if (this.host.player.ability === AbilityId.RockHead) {
      this.host.showLog(`Stepped on a ${ft.trap.name}! Rock Head negated it!`);
      this.drawTrap(ft);
      this.host.updateHUD();
      return;
    }

    // Ability: Levitate — immune to ground-based traps (Spike, Warp, Blast, Sticky, Hunger)
    if (this.host.player.ability === AbilityId.Levitate &&
        (ft.trap.type === TrapType.Spike || ft.trap.type === TrapType.Warp || ft.trap.type === TrapType.Blast ||
         ft.trap.type === TrapType.Sticky || ft.trap.type === TrapType.Hunger)) {
      this.host.showLog(`Stepped on a ${ft.trap.name}! Levitate avoided it!`);
      this.drawTrap(ft);
      this.host.updateHUD();
      return;
    }

    this.host.showLog(`Stepped on a ${ft.trap.name}! ${ft.trap.description}`);
    this.scene.cameras.main.shake(150, 0.008);

    switch (ft.trap.type) {
      case TrapType.Spike: {
        const dmg = Math.floor(this.host.player.stats.maxHp * 0.15);
        this.host.player.stats.hp = Math.max(1, this.host.player.stats.hp - dmg);
        if (this.host.player.sprite) this.host.showDamagePopup(this.host.player.sprite.x, this.host.player.sprite.y, dmg, 1.0);
        // Score chain: taking trap damage resets chain
        if (this.host.scoreChain.currentMultiplier > 1.0) {
          resetChain(this.host.scoreChain);
          this.host.showLog("Chain broken!");
          this.host.updateChainHUD();
        }
        this.host.checkPlayerDeath();
        break;
      }
      case TrapType.Poison:
        if (!this.host.player.statusEffects.some(s => s.type === SkillEffect.Burn)) {
          this.host.player.statusEffects.push({ type: SkillEffect.Burn, turnsLeft: 5 });
          this.host.showLog("You were burned!");
        }
        if (this.host.player.sprite) this.host.player.sprite.setTint(0xa855f7);
        this.scene.time.delayedCall(300, () => { if (this.host.player.sprite) this.host.player.sprite.clearTint(); });
        break;
      case TrapType.Warp: {
        const { terrain, width, height, stairsPos } = this.host.dungeon;
        let wx: number, wy: number;
        let tries = 0;

        // Ability: RunAway — warp near stairs instead of random
        if (this.host.player.ability === AbilityId.RunAway) {
          const offsets = [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:1,y:-1},{x:1,y:1},{x:-1,y:1},{x:-1,y:-1}];
          let found = false;
          for (const off of offsets) {
            const tx = stairsPos.x + off.x;
            const ty = stairsPos.y + off.y;
            if (tx >= 0 && tx < width && ty >= 0 && ty < height &&
                terrain[ty][tx] === TerrainType.GROUND &&
                !this.host.allEntities.some(e => e !== this.host.player && e.alive && e.tileX === tx && e.tileY === ty)) {
              wx = tx; wy = ty; found = true; break;
            }
          }
          if (!found) { wx = stairsPos.x; wy = stairsPos.y; }
          this.host.showLog("Run Away warped you near the stairs!");
        } else {
          do {
            wx = Math.floor(Math.random() * width);
            wy = Math.floor(Math.random() * height);
            tries++;
          } while (tries < 200 && (terrain[wy][wx] !== TerrainType.GROUND ||
            this.host.allEntities.some(e => e !== this.host.player && e.alive && e.tileX === wx && e.tileY === wy)));
        }

        this.host.player.tileX = wx!;
        this.host.player.tileY = wy!;
        if (this.host.player.sprite) {
          this.host.player.sprite.setPosition(this.host.tileToPixelX(wx!), this.host.tileToPixelY(wy!));
        }
        this.scene.cameras.main.flash(200, 100, 100, 255);
        break;
      }
      case TrapType.Spin: {
        // Confusion: reduce accuracy for 5 turns (shown as paralyze debuff)
        this.host.showLog("You got confused!");
        if (!this.host.player.statusEffects.some(s => s.type === SkillEffect.Paralyze)) {
          this.host.player.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 5 });
        }
        this.scene.cameras.main.shake(200, 0.01);
        break;
      }
      case TrapType.Slowdown: {
        const reduction = Math.floor(this.host.player.stats.atk * 0.1);
        this.host.player.stats.atk = Math.max(1, this.host.player.stats.atk - reduction);
        this.host.showLog(`ATK reduced by ${reduction} for this floor!`);
        if (this.host.player.sprite) this.host.player.sprite.setTint(0xf97316);
        this.scene.time.delayedCall(400, () => { if (this.host.player.sprite) this.host.player.sprite.clearTint(); });
        break;
      }
      case TrapType.Blast: {
        // Deal 25% max HP damage to player
        const blastDmg = Math.floor(this.host.player.stats.maxHp * 0.25);
        this.host.player.stats.hp = Math.max(1, this.host.player.stats.hp - blastDmg);
        if (this.host.player.sprite) this.host.showDamagePopup(this.host.player.sprite.x, this.host.player.sprite.y, blastDmg, 1.0);
        // Also damage nearby enemies/allies in 3x3 area
        for (const entity of this.host.allEntities) {
          if (entity === this.host.player || !entity.alive) continue;
          const dx = Math.abs(entity.tileX - ft.x);
          const dy = Math.abs(entity.tileY - ft.y);
          if (dx <= 1 && dy <= 1) {
            const entityDmg = Math.floor(entity.stats.maxHp * 0.25);
            entity.stats.hp = Math.max(1, entity.stats.hp - entityDmg);
            if (entity.sprite) this.host.showDamagePopup(entity.sprite.x, entity.sprite.y, entityDmg, 1.0);
            this.host.showLog(`${entity.name} was caught in the blast!`);
          }
        }
        // Visual: flash red
        this.scene.cameras.main.flash(200, 255, 50, 50);
        this.host.checkPlayerDeath();
        break;
      }
      case TrapType.Trip:
        if (this.host.inventory.length > 0) {
          const lostIdx = Math.floor(Math.random() * this.host.inventory.length);
          const lost = this.host.inventory[lostIdx];
          this.host.showLog(`Dropped ${lost.item.name}!`);
          lost.count--;
          if (lost.count <= 0) this.host.inventory.splice(lostIdx, 1);
        } else {
          this.host.showLog("Nothing to drop!");
        }
        break;
      case TrapType.Seal: {
        const usableSkills = this.host.player.skills.filter(s => s.currentPp > 0);
        if (usableSkills.length > 0) {
          const skill = usableSkills[Math.floor(Math.random() * usableSkills.length)];
          skill.currentPp = 0;
          this.host.showLog(`${skill.name} was sealed!`);
          if (this.host.player.sprite) this.host.player.sprite.setTint(0x6366f1);
          this.scene.time.delayedCall(400, () => { if (this.host.player.sprite) this.host.player.sprite.clearTint(); });
        } else {
          this.host.showLog("No skills to seal!");
        }
        break;
      }
      case TrapType.Sticky: {
        // Reduce belly by 5 as a simplified sticky penalty
        this.host.belly = Math.max(0, this.host.belly - 5);
        this.host.showLog("Sticky goo drains your energy! Belly -5!");
        if (this.host.player.sprite) this.host.player.sprite.setTint(0xf59e0b);
        this.scene.time.delayedCall(400, () => { if (this.host.player.sprite) this.host.player.sprite.clearTint(); });
        break;
      }
      case TrapType.Hunger: {
        // Drain 20 belly instantly
        this.host.belly = Math.max(0, this.host.belly - 20);
        this.host.showLog("Extreme hunger strikes! Belly -20!");
        if (this.host.player.sprite) this.host.player.sprite.setTint(0x92400e);
        this.scene.time.delayedCall(400, () => { if (this.host.player.sprite) this.host.player.sprite.clearTint(); });
        break;
      }
      case TrapType.Summon: {
        // Delegate enemy spawning to host (complex dependency on enemy creation)
        this.host.spawnSummonTrapEnemies(ft.x, ft.y);
        break;
      }
      case TrapType.Grudge: {
        // Apply Cursed status for 8 turns
        if (!this.host.player.statusEffects.some(s => s.type === SkillEffect.Cursed)) {
          this.host.player.statusEffects.push({ type: SkillEffect.Cursed, turnsLeft: 8 });
          this.host.showLog("A dark curse falls upon you!");
        } else {
          this.host.showLog("The curse deepens...");
        }
        if (this.host.player.sprite) this.host.player.sprite.setTint(0x581c87);
        this.scene.time.delayedCall(400, () => { if (this.host.player.sprite) this.host.player.sprite.clearTint(); });
        break;
      }
    }

    this.drawTrap(ft);
    this.host.updateHUD();
  }

  /** Draw a revealed trap marker as a small colored circle on the tile */
  private drawTrap(trap: FloorTrap) {
    if (!trap.revealed) return;
    const gfx = this.scene.add.graphics();
    const cx = trap.x * TILE_DISPLAY + TILE_DISPLAY / 2;
    const cy = trap.y * TILE_DISPLAY + TILE_DISPLAY / 2;
    gfx.fillStyle(trap.trap.hexColor, 0.6);
    gfx.fillCircle(cx, cy, 4);
    gfx.setDepth(3);
    this.trapGraphics.push(gfx);
  }

  /** Reveal traps adjacent to the player (1 tile radius) */
  revealNearbyTraps() {
    for (const trap of this.floorTraps) {
      if (trap.revealed) continue;
      const dx = Math.abs(trap.x - this.host.player.tileX);
      const dy = Math.abs(trap.y - this.host.player.tileY);
      if (dx <= 1 && dy <= 1) {
        trap.revealed = true;
        this.drawTrap(trap);
      }
    }
  }

  // ── Hazard Tiles ──

  /** Render all hazard tiles as colored semi-transparent rectangles with visual effects */
  private renderHazardTiles() {
    const scene = this.scene;
    // Clean up any prior hazard graphics/tweens
    for (const gfx of this.hazardGraphics) gfx.destroy();
    for (const tw of this.hazardTweens) tw.destroy();
    this.hazardGraphics = [];
    this.hazardTweens = [];

    for (const hazard of this.floorHazards) {
      const gfx = scene.add.graphics();
      const px = hazard.x * TILE_DISPLAY;
      const py = hazard.y * TILE_DISPLAY;

      gfx.fillStyle(hazard.def.color, 0.4);
      gfx.fillRect(px, py, TILE_DISPLAY, TILE_DISPLAY);
      gfx.setDepth(2); // Above floor theme overlay (1), below traps (3)
      this.hazardGraphics.push(gfx);

      // Per-hazard visual effect tweens
      switch (hazard.type) {
        case HazardType.Lava: {
          // Subtle pulsing orange glow
          const lavaT = scene.tweens.add({
            targets: gfx,
            alpha: { from: 0.6, to: 1.0 },
            duration: 800 + Math.random() * 400,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
          this.hazardTweens.push(lavaT);
          break;
        }
        case HazardType.Water: {
          // Gentle blue shimmer
          const waterT = scene.tweens.add({
            targets: gfx,
            alpha: { from: 0.5, to: 0.85 },
            duration: 1200 + Math.random() * 600,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
          this.hazardTweens.push(waterT);
          break;
        }
        case HazardType.ToxicSwamp: {
          // Bubbling animation: scale tween
          const swampT = scene.tweens.add({
            targets: gfx,
            scaleX: { from: 1.0, to: 1.04 },
            scaleY: { from: 1.0, to: 1.04 },
            alpha: { from: 0.5, to: 0.8 },
            duration: 1000 + Math.random() * 800,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
            delay: Math.random() * 1000,
          });
          this.hazardTweens.push(swampT);
          break;
        }
        case HazardType.IcePatch: {
          // Static light blue with slight sparkle (gentle alpha oscillation)
          const iceT = scene.tweens.add({
            targets: gfx,
            alpha: { from: 0.55, to: 0.75 },
            duration: 2000 + Math.random() * 1000,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
          this.hazardTweens.push(iceT);
          break;
        }
        case HazardType.Quicksand: {
          // Slow rotation-like effect (gentle alpha pulse to suggest movement)
          const qsT = scene.tweens.add({
            targets: gfx,
            alpha: { from: 0.5, to: 0.8 },
            duration: 1500 + Math.random() * 500,
            yoyo: true,
            repeat: -1,
            ease: "Quad.easeInOut",
          });
          this.hazardTweens.push(qsT);
          break;
        }
        case HazardType.ElectricFloor: {
          // Rapid flicker (random alpha changes)
          const elecT = scene.tweens.add({
            targets: gfx,
            alpha: { from: 0.3, to: 0.9 },
            duration: 200 + Math.random() * 200,
            yoyo: true,
            repeat: -1,
            ease: "Stepped",
          });
          this.hazardTweens.push(elecT);
          break;
        }
      }
    }
  }

  /**
   * Check if the player is standing on a hazard tile and apply its effects.
   * Called after player movement.
   */
  checkPlayerHazard() {
    this.checkEntityHazard(this.host.player, true);
  }

  /**
   * Check if an entity is standing on a hazard tile and apply effects.
   * @param entity The entity to check
   * @param isPlayer Whether this is the player (for log messaging)
   */
  checkEntityHazard(entity: Entity, isPlayer: boolean) {
    if (!entity.alive) return;

    const hazard = this.floorHazards.find(
      h => h.x === entity.tileX && h.y === entity.tileY
    );
    if (!hazard) return;

    const entityTypes = entity.types as PokemonType[];

    // Check immunity
    if (isImmuneToHazard(hazard.type, entityTypes)) {
      if (isPlayer) {
        this.host.showLog(`${entity.name} is immune to ${hazard.def.name}!`);
      }
      return;
    }

    // Show step message
    if (isPlayer) {
      this.host.showLog(`Stepped on ${hazard.def.name}!`);
    } else if (this.host.minimapCurrentlyVisible[entity.tileY]?.[entity.tileX]) {
      this.host.showLog(`${entity.name} stepped on ${hazard.def.name}!`);
    }

    // Apply damage
    if (hazard.def.damage > 0) {
      entity.stats.hp = Math.max(1, entity.stats.hp - hazard.def.damage);
      if (entity.sprite) {
        this.host.showDamagePopup(entity.sprite.x, entity.sprite.y, hazard.def.damage, 1.0);
      }
      // Visual flash on the entity
      if (entity.sprite) {
        entity.sprite.setTint(hazard.def.color);
        this.scene.time.delayedCall(300, () => {
          if (entity.sprite) entity.sprite.clearTint();
        });
      }
    }

    // Apply special effect
    const effectRoll = Math.random();
    if (effectRoll < hazard.def.effectChance) {
      switch (hazard.def.effect) {
        case "slow": {
          // Skip next turn: apply paralyze-like status for 1 turn
          if (!entity.statusEffects.some(s => s.type === SkillEffect.Paralyze)) {
            entity.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 1 });
            if (isPlayer) this.host.showLog("Slowed by water!");
          }
          break;
        }
        case "slide": {
          // Slide in movement direction until hitting wall/entity
          const dx = DIR_DX[entity.facing];
          const dy = DIR_DY[entity.facing];
          let slideX = entity.tileX;
          let slideY = entity.tileY;
          const { terrain, width, height } = this.host.dungeon;

          for (let step = 0; step < 5; step++) {
            const nx = slideX + dx;
            const ny = slideY + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) break;
            if (terrain[ny][nx] !== TerrainType.GROUND) break;
            // Check entity collision
            if (this.host.allEntities.some(e => e !== entity && e.alive && e.tileX === nx && e.tileY === ny)) break;
            slideX = nx;
            slideY = ny;
          }

          if (slideX !== entity.tileX || slideY !== entity.tileY) {
            entity.tileX = slideX;
            entity.tileY = slideY;
            if (entity.sprite) {
              entity.sprite.setPosition(
                this.host.tileToPixelX(slideX),
                this.host.tileToPixelY(slideY)
              );
            }
            if (isPlayer) {
              this.host.showLog("Slid on the ice!");
              this.scene.cameras.main.flash(150, 170, 220, 255);
            }
          }
          break;
        }
        case "trap": {
          // Trapped — skip next turn
          if (!entity.statusEffects.some(s => s.type === SkillEffect.Paralyze)) {
            entity.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 1 });
            if (isPlayer) this.host.showLog("Trapped in quicksand!");
          }
          break;
        }
        case "poison": {
          // Chance of burn (poison-like) status
          if (!entity.statusEffects.some(s => s.type === SkillEffect.Burn)) {
            entity.statusEffects.push({ type: SkillEffect.Burn, turnsLeft: 5 });
            if (isPlayer) {
              this.host.showLog("Poisoned by toxic swamp!");
            } else if (this.host.minimapCurrentlyVisible[entity.tileY]?.[entity.tileX]) {
              this.host.showLog(`${entity.name} was poisoned!`);
            }
            if (entity.sprite) {
              entity.sprite.setTint(0xa855f7);
              this.scene.time.delayedCall(300, () => {
                if (entity.sprite) entity.sprite.clearTint();
              });
            }
          }
          break;
        }
        case "paralyze": {
          // Chance to inflict paralysis
          if (!entity.statusEffects.some(s => s.type === SkillEffect.Paralyze)) {
            entity.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 3 });
            if (isPlayer) {
              this.host.showLog("Paralyzed by electric floor!");
            } else if (this.host.minimapCurrentlyVisible[entity.tileY]?.[entity.tileX]) {
              this.host.showLog(`${entity.name} was paralyzed!`);
            }
            if (entity.sprite) {
              entity.sprite.setTint(0xffee44);
              this.scene.time.delayedCall(300, () => {
                if (entity.sprite) entity.sprite.clearTint();
              });
            }
          }
          break;
        }
      }
    }

    // Check death
    if (isPlayer) {
      this.host.checkPlayerDeath();
    } else if (entity.stats.hp <= 0) {
      entity.alive = false;
    }

    this.host.updateHUD();
  }
}
