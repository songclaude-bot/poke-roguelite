/**
 * StairsSystem — Extracted from DungeonScene.
 * Manages stairs detection, floor advancement, and the visual stairs marker.
 */
import Phaser from "phaser";
import { TILE_DISPLAY } from "../config";
import { Entity } from "../core/entity";
import { DungeonDef } from "../core/dungeon-data";
import { DungeonData } from "../core/dungeon-generator";
import { ItemStack } from "../core/item";
import { Relic } from "../core/relics";
import { ScoreChain, addChainAction } from "../core/score-chain";
import { RunLog, RunLogEvent } from "../core/run-log";
import {
  ActiveBlessing, tickBlessingDurations, serializeBlessings,
} from "../core/blessings";
import { DungeonModifier } from "../core/dungeon-modifiers";
import { ModifierEffects } from "../core/dungeon-modifiers";
import { HeldItemEffect } from "../core/held-items";
import { sfxStairs } from "../core/sound-manager";
import { LegendaryEncounter } from "../core/legendary-encounters";
import { DomHudElements, setDomHudInteractive } from "../ui/dom-hud";

// ── Host interface: what StairsSystem needs from DungeonScene ──

export interface StairsHost {
  // Dungeon layout
  readonly dungeon: DungeonData;
  readonly dungeonDef: DungeonDef;
  readonly currentFloor: number;

  // Player & allies
  readonly player: Entity;
  serializeAllies(): { speciesId: string; hp: number; maxHp: number; atk: number; def: number; level: number; skills: { id: string; currentPp: number }[] }[];

  // Inventory & resources
  inventory: ItemStack[];
  belly: number;
  totalExp: number;
  gold: number;

  // Run metadata
  readonly starterId: string;
  readonly challengeMode: string | null;
  readonly runElapsedSeconds: number;
  readonly scoreChain: ScoreChain;
  readonly legendaryEncountered: boolean;
  readonly questItemsCollected: number;
  readonly questItemsUsed: boolean;
  readonly activeRelics: Relic[];
  readonly runLog: RunLog;
  activeBlessings: ActiveBlessing[];
  readonly activeModifiers: DungeonModifier[];
  readonly modifierEffects: ModifierEffects;
  readonly heldItemEffect: HeldItemEffect;
  readonly floorTurns: number;

  // Boss / legendary / gauntlet state
  readonly bossEntity: Entity | null;
  legendaryEntity: Entity | null;
  legendaryEncounter: LegendaryEncounter | null;
  readonly legendaryHpBg: Phaser.GameObjects.Graphics | null;
  readonly legendaryHpBar: Phaser.GameObjects.Graphics | null;
  readonly legendaryNameText: Phaser.GameObjects.Text | null;
  legendaryParticleTimer: Phaser.Time.TimerEvent | null;
  legendaryParticleGraphics: Phaser.GameObjects.Graphics | null;
  readonly gauntletStairsLocked: boolean;

  // Turn tracking
  readonly turnCount: number;

  // Flags
  gameOver: boolean;

  // DOM HUD
  domHud: DomHudElements | null;
  domHudElement: Phaser.GameObjects.DOMElement | null;

  // Callbacks
  showLog(msg: string): void;
  showDungeonClear(): void;
  autoSave(): void;
  updateChainHUD(): void;
  stopAutoExplore(): void;
}

// ── StairsSystem class ──

export class StairsSystem {
  constructor(private host: StairsHost) {}

  protected get scene(): Phaser.Scene { return this.host as any; }

  // ── Stairs Visual ──

  /** Draw the stairs marker on the dungeon floor (called during create()) */
  drawStairsMarker(): Phaser.GameObjects.Graphics {
    const scene = this.scene;
    const { stairsPos } = this.host.dungeon;
    const stairsGfx = scene.add.graphics();
    const sx = stairsPos.x * TILE_DISPLAY + TILE_DISPLAY / 2;
    const sy = stairsPos.y * TILE_DISPLAY + TILE_DISPLAY / 2;
    stairsGfx.fillStyle(0xfbbf24, 0.9);
    stairsGfx.fillTriangle(sx, sy - 14, sx + 10, sy, sx - 10, sy);
    stairsGfx.fillTriangle(sx, sy + 14, sx + 10, sy, sx - 10, sy);
    stairsGfx.setDepth(5);
    return stairsGfx;
  }

  // ── Player Step Check ──

  /** Check if the player is standing on the stairs tile */
  checkStairs() {
    const { stairsPos } = this.host.dungeon;
    if (this.host.player.tileX === stairsPos.x && this.host.player.tileY === stairsPos.y) {
      // Block stairs if boss is alive (but allow flee from legendary encounters)
      if (this.host.bossEntity && this.host.bossEntity.alive) {
        this.host.showLog("The stairs are sealed! Defeat the boss first!");
        return;
      }
      // Block stairs during gauntlet
      if (this.host.gauntletStairsLocked) {
        this.host.showLog("The stairs are sealed! Clear the gauntlet first!");
        return;
      }
      // Legendary encounter: player can flee (use stairs) with no reward
      if (this.host.legendaryEntity && this.host.legendaryEntity.alive) {
        this.host.showLog("The legendary Pokemon disappeared...");
        // Clean up legendary entity visuals
        if (this.host.legendaryEntity.sprite) this.host.legendaryEntity.sprite.destroy();
        this.host.legendaryEntity.alive = false;
        this.host.legendaryEntity = null;
        this.host.legendaryEncounter = null;
        if (this.host.legendaryHpBg) { this.host.legendaryHpBg.setVisible(false); }
        if (this.host.legendaryHpBar) { this.host.legendaryHpBar.setVisible(false); }
        if (this.host.legendaryNameText) { this.host.legendaryNameText.setVisible(false); }
        if (this.host.legendaryParticleTimer) { this.host.legendaryParticleTimer.destroy(); this.host.legendaryParticleTimer = null; }
        if (this.host.legendaryParticleGraphics) { this.host.legendaryParticleGraphics.destroy(); this.host.legendaryParticleGraphics = null; }
      }
      this.advanceFloor();
    }
  }

  // ── Floor Advancement ──

  /** Advance to the next floor — serializes state and restarts the scene */
  private advanceFloor() {
    this.host.stopAutoExplore();
    // Endless dungeon never shows clear screen — always advance
    // Daily dungeon and other dungeons show clear when floors are completed
    if (this.host.dungeonDef.id !== "endlessDungeon" && this.host.currentFloor >= this.host.dungeonDef.floors) {
      this.host.showDungeonClear();
      return;
    }

    // Apply healOnFloor modifier before advancing
    if (this.host.modifierEffects.healOnFloor) {
      this.host.player.stats.hp = this.host.player.stats.maxHp;
    }

    // Held item: heal per floor
    const healPerFloor = this.host.heldItemEffect.healPerFloor ?? 0;
    if (healPerFloor > 0 && this.host.player.stats.hp < this.host.player.stats.maxHp) {
      this.host.player.stats.hp = Math.min(this.host.player.stats.maxHp, this.host.player.stats.hp + healPerFloor);
      this.host.showLog(`Held item healed ${healPerFloor} HP!`);
    }

    // Score chain: quick floor bonus if cleared in under 20 turns
    if (this.host.floorTurns < 20) {
      const bonus = addChainAction(this.host.scoreChain, "quickFloor");
      if (bonus > 0) this.host.showLog(`Quick clear! Chain +${bonus} pts!`);
      this.host.updateChainHUD();
    }

    // Auto-save before advancing floor
    this.host.autoSave();

    this.host.gameOver = true;
    sfxStairs();
    this.host.showLog(`Went to B${this.host.currentFloor + 1}F!`);

    // Run log: floor advance
    this.host.runLog.add(RunLogEvent.FloorAdvanced, `Advanced to B${this.host.currentFloor + 1}F`, this.host.currentFloor, this.host.turnCount);

    // Tick blessing/curse durations on floor advance
    const prevBlessingCount = this.host.activeBlessings.length;
    this.host.activeBlessings = tickBlessingDurations(this.host.activeBlessings);
    if (this.host.activeBlessings.length < prevBlessingCount) {
      this.host.showLog("Some blessings/curses have expired.");
    }

    // Pass modifier IDs through floor transitions
    const modifierIds = this.host.activeModifiers.length > 0 ? this.host.activeModifiers.map(m => m.id) : undefined;

    if (this.host.domHud) setDomHudInteractive(this.host.domHud, false);

    let restarted = false;
    const doRestart = () => {
      if (restarted) return;
      restarted = true;
      // Clean up DOM HUD before restart
      if (this.host.domHudElement) {
        this.host.domHudElement.destroy();
        this.host.domHudElement = null;
        this.host.domHud = null;
      }
      (this.scene as any).scene.restart({
        floor: this.host.currentFloor + 1,
        hp: this.host.player.stats.hp,
        maxHp: this.host.player.stats.maxHp,
        skills: this.host.player.skills,
        inventory: this.host.inventory,
        level: this.host.player.stats.level,
        atk: this.host.player.stats.atk,
        def: this.host.player.stats.def,
        exp: this.host.totalExp,
        dungeonId: this.host.dungeonDef.id,
        allies: this.host.serializeAllies(),
        belly: this.host.belly,
        starter: this.host.starterId,
        challengeMode: this.host.challengeMode ?? undefined,
        modifiers: modifierIds,
        runElapsedTime: this.host.runElapsedSeconds,
        scoreChain: this.host.scoreChain,
        legendaryEncountered: this.host.legendaryEncountered,
        questItemsCollected: this.host.questItemsCollected,
        questItemsUsed: this.host.questItemsUsed,
        relics: this.host.activeRelics,
        runLogEntries: this.host.runLog.serialize(),
        blessings: serializeBlessings(this.host.activeBlessings),
      });
    };

    this.scene.cameras.main.fadeOut(500, 0, 0, 0);
    this.scene.cameras.main.once("camerafadeoutcomplete", doRestart);
    // Safety fallback using native setTimeout (Phaser timers may stall with the scene)
    setTimeout(doRestart, 1200);
  }
}
