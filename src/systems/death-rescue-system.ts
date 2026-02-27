/**
 * DeathRescueSystem — Extracted from DungeonScene.
 * Manages game-over flow, rescue prompts, dungeon clear screens,
 * run summary display, quick retry, save/autosave.
 */
import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, TILE_DISPLAY, TILE_SCALE } from "../config";
import { Entity } from "../core/entity";
import { DungeonDef, CHALLENGE_MODES } from "../core/dungeon-data";
import { DungeonData } from "../core/dungeon-generator";
import { ItemStack } from "../core/item";
import { Relic } from "../core/relics";
import { SPECIES } from "../core/pokemon-data";
import { Skill } from "../core/skill";
import {
  ScoreChain, getChainTier, getChainColor,
} from "../core/score-chain";
import {
  RunLog, RunLogEvent,
  calculatePerformanceGrade, gradeColor,
} from "../core/run-log";
import {
  ActiveBlessing, getBlessingEffect,
} from "../core/blessings";
import { DungeonModifier, ModifierEffects } from "../core/dungeon-modifiers";
import { HeldItemEffect } from "../core/held-items";
import { Enchantment } from "../core/enchantments";
import {
  DifficultyLevel, DifficultyModifiers, isNonNormalDifficulty,
} from "../core/difficulty-settings";
import { NGPlusBonusEffects } from "../core/new-game-plus";
import {
  RescueOption, MAX_RESCUES_PER_RUN, getRescueOptions,
} from "../core/rescue-system";
import {
  saveDungeon, clearDungeonSave, serializeSkills, serializeInventory,
  goldFromRun, loadMeta, saveMeta,
} from "../core/save-system";
import { addToStorage } from "../core/crafting";
import { calculateScore, saveRunScore } from "../core/leaderboard";
import { getDailyConfig, calculateDailyScore, saveDailyScore } from "../core/daily-dungeon";
import {
  loadJournal, recordDungeonClear,
  recordDungeonDefeat, recordSpeciesEncountered,
} from "../core/dungeon-journal";
import {
  generateDailyQuests, getChallengeQuests, updateQuestProgress,
  getTodayDateString, RunQuestData,
} from "../core/quests";
import {
  MutationType, hasMutation, getMutationEffect, DungeonMutation,
} from "../core/dungeon-mutations";
import { DomHudElements, setDomHudInteractive } from "../ui/dom-hud";
import {
  stopBgm, startBgm,
  sfxVictory, sfxGameOver,
} from "../core/sound-manager";
import { LegendaryEncounter } from "../core/legendary-encounters";
import { TurnManager } from "../core/turn-manager";

// ── Host interface: what DeathRescueSystem needs from DungeonScene ──

export interface DeathRescueHost {
  /** Phaser Scene API (for add, tweens, time, cameras, scene) */
  scene: Phaser.Scene;

  // ── Read-only game state ──
  readonly player: Entity;
  readonly enemies: Entity[];
  readonly allies: Entity[];
  readonly allEntities: Entity[];
  readonly dungeon: DungeonData;
  readonly dungeonDef: DungeonDef;
  readonly currentFloor: number;
  readonly turnManager: TurnManager;

  // Run metadata (read-only)
  readonly starterId: string;
  readonly challengeMode: string | null;
  readonly scoreChain: ScoreChain;
  readonly runLog: RunLog;
  readonly activeModifiers: DungeonModifier[];
  readonly modifierEffects: ModifierEffects;
  readonly heldItemEffect: HeldItemEffect;
  readonly enchantment: Enchantment | null;
  readonly difficultyLevel: DifficultyLevel;
  readonly difficultyMods: DifficultyModifiers;
  readonly ngPlusLevel: number;
  readonly ngPlusBonuses: NGPlusBonusEffects;
  readonly talentEffects: Record<string, number>;
  readonly seenSpecies: Set<string>;
  readonly floorMutations: DungeonMutation[];
  readonly activeBlessings: ActiveBlessing[];
  readonly relicEffects: Record<string, number>;
  readonly isBossRush: boolean;
  readonly legendaryEncountered: boolean;
  readonly legendaryEntity: Entity | null;
  readonly legendaryEncounter: LegendaryEncounter | null;
  readonly enemiesDefeated: number;
  readonly questItemsCollected: number;
  readonly questItemsUsed: boolean;
  readonly floorTurns: number;

  // Gauntlet system state
  readonly gauntletSys: { totalWavesCleared: number };

  // DOM HUD
  readonly domHud: DomHudElements | null;

  // D-Pad UI elements (hidden on game-over)
  readonly dpadUI: Phaser.GameObjects.GameObject[];

  // ── Mutable shared state ──
  gold: number;
  totalExp: number;
  inventory: ItemStack[];
  bossesDefeated: number;
  runElapsedSeconds: number;

  // ── Callbacks (delegate back to DungeonScene) ──
  showLog(msg: string): void;
  updateHUD(): void;
  stopAutoExplore(): void;
  serializeAllies(): { speciesId: string; hp: number; maxHp: number; atk: number; def: number; level: number; skills: { id: string; currentPp: number }[] }[];
  getQuestTrackingData(): Record<string, unknown>;
  tileToPixelX(tileX: number): number;
  tileToPixelY(tileY: number): number;
  formatTime(totalSeconds: number): string;
}

// ── DeathRescueSystem class ──

export class DeathRescueSystem {
  // ── Death/rescue state (moved from DungeonScene) ──
  gameOver = false;
  rescueCount = 0;

  constructor(private host: DeathRescueHost) {}

  /** Reset state for a new run / floor */
  reset() {
    this.gameOver = false;
    // rescueCount persists across floors within a run;
    // it is only reset via class re-instantiation (new DungeonScene)
  }

  // ── Save ──

  saveGame() {
    if (this.gameOver) return;
    const h = this.host;
    saveDungeon({
      version: 1,
      timestamp: Date.now(),
      floor: h.currentFloor,
      dungeonId: h.dungeonDef.id,
      hp: h.player.stats.hp,
      maxHp: h.player.stats.maxHp,
      level: h.player.stats.level,
      atk: h.player.stats.atk,
      def: h.player.stats.def,
      totalExp: h.totalExp,
      belly: (h as any).belly,
      skills: serializeSkills(h.player.skills),
      inventory: serializeInventory(h.inventory),
      allies: h.serializeAllies(),
      starter: h.starterId,
      challengeMode: h.challengeMode ?? undefined,
      modifiers: h.activeModifiers.length > 0 ? h.activeModifiers.map(m => m.id) : undefined,
    });
    h.showLog("Game saved!");
  }

  /** Silent auto-save (no log message) */
  autoSave() {
    if (this.gameOver) return;
    const h = this.host;
    saveDungeon({
      version: 1,
      timestamp: Date.now(),
      floor: h.currentFloor,
      dungeonId: h.dungeonDef.id,
      hp: h.player.stats.hp,
      maxHp: h.player.stats.maxHp,
      level: h.player.stats.level,
      atk: h.player.stats.atk,
      def: h.player.stats.def,
      totalExp: h.totalExp,
      belly: (h as any).belly,
      skills: serializeSkills(h.player.skills),
      inventory: serializeInventory(h.inventory),
      allies: h.serializeAllies(),
      starter: h.starterId,
      challengeMode: h.challengeMode ?? undefined,
      modifiers: h.activeModifiers.length > 0 ? h.activeModifiers.map(m => m.id) : undefined,
    });
  }

  // ── Game Over Flow ──

  showGameOver() {
    this.host.stopAutoExplore();

    // Check if rescue is available before committing to game over
    const meta = loadMeta();
    const rescueGold = meta.gold + this.host.gold; // meta (saved) gold + run gold
    const options = getRescueOptions(this.host.currentFloor, this.host.dungeonDef.difficulty, rescueGold);
    if (this.rescueCount < MAX_RESCUES_PER_RUN && options.length > 0) {
      // Pause the game but don't finalize game over yet
      stopBgm();
      this.showRescuePrompt(options, rescueGold);
      return;
    }

    // No rescue available — proceed to final game over
    this.showGameOverScreen();
  }

  // ── Rescue Prompt ──

  /**
   * Rescue prompt overlay — shown when the player faints but can afford a rescue.
   * Displays rescue options as buttons and a "Give up" fallback.
   */
  private showRescuePrompt(options: RescueOption[], availableGold: number) {
    const scene = this.host.scene;
    const rescueUI: Phaser.GameObjects.GameObject[] = [];
    // Disable DOM HUD buttons while rescue prompt is open
    if (this.host.domHud) setDomHudInteractive(this.host.domHud, false);

    // Dark overlay
    const bg = scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.8
    ).setScrollFactor(0).setDepth(200).setInteractive();
    rescueUI.push(bg);

    // Title
    const title = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 90, "You've been knocked out!", {
      fontSize: "16px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    rescueUI.push(title);

    // Subtitle with remaining rescues
    const remaining = MAX_RESCUES_PER_RUN - this.rescueCount;
    const subtitle = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 68, `Rescue available! (${remaining} left this run)`, {
      fontSize: "10px", color: "#fbbf24", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    rescueUI.push(subtitle);

    // Gold display
    const goldInfo = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 52, `Your Gold: ${availableGold}G`, {
      fontSize: "10px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    rescueUI.push(goldInfo);

    // Rescue option buttons
    let yOffset = GAME_HEIGHT / 2 - 28;
    for (const option of options) {
      // Option button background
      const btnBg = scene.add.rectangle(
        GAME_WIDTH / 2, yOffset + 12, 280, 44,
        0x1e293b, 0.9
      ).setScrollFactor(0).setDepth(201).setInteractive();
      rescueUI.push(btnBg);

      // Option label
      const labelColor = option.hpPercent >= 100 ? "#34d399" : "#60a5fa";
      const labelText = scene.add.text(GAME_WIDTH / 2, yOffset + 4, option.label, {
        fontSize: "13px", color: labelColor, fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
      rescueUI.push(labelText);

      // Option description
      const descText = scene.add.text(GAME_WIDTH / 2, yOffset + 20, option.description, {
        fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
      rescueUI.push(descText);

      // Border highlight on hover
      btnBg.on("pointerover", () => btnBg.setStrokeStyle(1, 0x60a5fa));
      btnBg.on("pointerout", () => btnBg.setStrokeStyle(0));

      // Handle rescue selection
      const selectedOption = option;
      btnBg.on("pointerdown", () => {
        for (const el of rescueUI) el.destroy();
        this.executeRescue(selectedOption);
      });

      yOffset += 52;
    }

    // "Give up" button (styled rectangle)
    const giveUpY = yOffset + 16;
    const giveUpBg = scene.add.rectangle(GAME_WIDTH / 2, giveUpY, 140, 32, 0x1a1a2e, 0.9)
      .setStrokeStyle(1, 0x6b7280).setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });
    rescueUI.push(giveUpBg);
    const giveUpLabel = scene.add.text(GAME_WIDTH / 2, giveUpY, "Give Up", {
      fontSize: "13px", color: "#6b7280", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    rescueUI.push(giveUpLabel);

    giveUpBg.on("pointerover", () => { giveUpBg.setStrokeStyle(1, 0xef4444); giveUpLabel.setColor("#ef4444"); });
    giveUpBg.on("pointerout", () => { giveUpBg.setStrokeStyle(1, 0x6b7280); giveUpLabel.setColor("#6b7280"); });
    giveUpBg.on("pointerdown", () => {
      for (const el of rescueUI) el.destroy();
      this.showGameOverScreen();
    });
  }

  // ── Execute Rescue ──

  /**
   * Execute a rescue: deduct gold, restore HP, optionally remove items, clear enemies, resume play.
   */
  private executeRescue(option: RescueOption) {
    const h = this.host;
    const scene = h.scene;
    const meta = loadMeta();
    let costRemaining = option.goldCost;

    // First deduct from run gold, then from meta gold
    if (h.gold >= costRemaining) {
      h.gold -= costRemaining;
      costRemaining = 0;
    } else {
      costRemaining -= h.gold;
      h.gold = 0;
      meta.gold = Math.max(0, meta.gold - costRemaining);
      saveMeta(meta);
    }

    // Increment rescue count
    this.rescueCount++;

    // Restore HP and alive state
    h.player.stats.hp = Math.floor(h.player.stats.maxHp * option.hpPercent / 100);
    h.player.alive = true;

    // Stop any ongoing tweens on the player sprite (e.g. death fade-out)
    if (h.player.sprite) {
      scene.tweens.killTweensOf(h.player.sprite);
      h.player.sprite.setAlpha(1);
    } else {
      // Sprite was already destroyed by death tween — recreate it
      const sp = SPECIES[h.starterId];
      if (sp) {
        const texKey = `${sp.spriteKey}-idle`;
        if (scene.textures.exists(texKey)) {
          h.player.sprite = scene.add.sprite(
            h.tileToPixelX(h.player.tileX),
            h.tileToPixelY(h.player.tileY),
            texKey
          ).setScale(TILE_SCALE).setDepth(10);
          const animKey = `${sp.spriteKey}-idle-${h.player.facing}`;
          if (scene.anims.exists(animKey)) h.player.sprite.play(animKey);
        }
      }
    }

    // If basic rescue, remove half the inventory items randomly
    if (!option.keepItems && h.inventory.length > 0) {
      const removeCount = Math.floor(h.inventory.length / 2);
      for (let i = 0; i < removeCount; i++) {
        const idx = Math.floor(Math.random() * h.inventory.length);
        h.inventory.splice(idx, 1);
      }
    }

    // Revive fainted allies and restore their sprites
    for (const ally of h.allies) {
      if (!ally.alive) {
        ally.alive = true;
        ally.stats.hp = Math.floor(ally.stats.maxHp * 0.5);
      }
      // Stop any death fade tween and ensure sprite is visible
      if (ally.sprite) {
        scene.tweens.killTweensOf(ally.sprite);
        ally.sprite.setAlpha(1);
      } else {
        // Recreate destroyed sprite
        const allySp = ally.speciesId ? SPECIES[ally.speciesId] : undefined;
        if (allySp) {
          const allyTex = `${allySp.spriteKey}-idle`;
          if (scene.textures.exists(allyTex)) {
            ally.sprite = scene.add.sprite(
              h.tileToPixelX(ally.tileX), h.tileToPixelY(ally.tileY), allyTex
            ).setScale(TILE_SCALE).setDepth(10);
          }
        }
        // Re-add to allEntities if missing
        if (!h.allEntities.includes(ally)) {
          (h.allEntities as Entity[]).push(ally);
        }
      }
    }

    // Reset turn manager busy state to unblock input after rescue
    h.turnManager.forceIdle();

    // Ensure gameOver stays false (was not set since we intercepted before showGameOverScreen)
    this.gameOver = false;

    // Re-enable DOM HUD buttons (rescue overlay may have blocked them)
    if (h.domHud) setDomHudInteractive(h.domHud, true);

    // Visual feedback: rescue flash
    scene.cameras.main.flash(600, 100, 200, 255);
    if (h.player.sprite) {
      h.player.sprite.setTint(0x64b5f6);
      scene.time.delayedCall(800, () => {
        if (h.player.sprite) h.player.sprite.clearTint();
      });
    }

    // Show rescue success message
    h.showLog(`Rescue successful! Restored to ${option.hpPercent}% HP. (${MAX_RESCUES_PER_RUN - this.rescueCount} rescues left)`);

    // Run log entry
    h.runLog.add(RunLogEvent.PlayerDied, `Rescued on B${h.currentFloor}F (${option.label})`, h.currentFloor, h.turnManager.turn);

    // Resume BGM
    startBgm(h.dungeonDef.id);

    // Update HUD to reflect HP/inventory changes
    h.updateHUD();
  }

  // ── Game Over Screen ──

  /**
   * Final game over screen — shown when rescue is declined or unavailable.
   * Contains all the original game over logic (gold salvage, scoring, stats, buttons).
   */
  private showGameOverScreen() {
    const h = this.host;
    const scene = h.scene;
    this.gameOver = true;
    stopBgm();
    sfxGameOver();
    clearDungeonSave();
    // Run log: player died
    h.runLog.add(RunLogEvent.PlayerDied, `Fainted on B${h.currentFloor}F`, h.currentFloor, h.turnManager.turn);

    const goHeldGoldMult = 1 + (h.heldItemEffect.goldBonus ?? 0) / 100;
    const ngGoGoldMult = 1 + h.ngPlusBonuses.goldPercent / 100;
    const goEnchGoldMult = h.enchantment?.id === "abundance" ? 1.15 : 1.0;
    const goMutGoldMult = hasMutation(h.floorMutations, MutationType.GoldenAge) ? getMutationEffect(MutationType.GoldenAge, "goldMult") : 1;
    const goTalentGoldMult = 1 + (h.talentEffects.goldPercent ?? 0) / 100;
    const goRelicGoldMult = 1 + (h.relicEffects.goldMult ?? 0);
    const gold = Math.floor(goldFromRun(h.currentFloor, h.enemiesDefeated, false) * h.modifierEffects.goldMult * goHeldGoldMult * h.difficultyMods.goldMult * ngGoGoldMult * goEnchGoldMult * goMutGoldMult * goTalentGoldMult * goRelicGoldMult);

    // Journal: record dungeon defeat with species encountered
    {
      const defeatJournal = loadJournal();
      recordDungeonDefeat(defeatJournal, h.dungeonDef.id, h.currentFloor, h.enemiesDefeated, gold);
      for (const sid of h.seenSpecies) {
        recordSpeciesEncountered(defeatJournal, h.dungeonDef.id, sid);
      }
    }

    // Hide DOM HUD and D-pad behind game over overlay
    if (h.domHud) setDomHudInteractive(h.domHud, false);
    for (const obj of h.dpadUI) { if ("setVisible" in obj && typeof (obj as Phaser.GameObjects.GameObject & {setVisible:(v:boolean)=>void}).setVisible === "function") (obj as Phaser.GameObjects.GameObject & {setVisible:(v:boolean)=>void}).setVisible(false); }

    // Full-screen opaque overlay
    scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x0a0a1a, 0.95
    ).setScrollFactor(0).setDepth(200);

    scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, "GAME OVER", {
      fontSize: "24px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, `Fainted on B${h.currentFloor}F`, {
      fontSize: "12px", color: "#e0e0e0", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 12, `Salvaged ${gold} Gold`, {
      fontSize: "11px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 2, `Time: ${h.formatTime(h.runElapsedSeconds)}`, {
      fontSize: "10px", color: "#6b7280", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    // Daily dungeon: calculate and save score on game over
    let dailyScoreValue = 0;
    if (h.dungeonDef.id === "dailyDungeon") {
      const dailyConfig = getDailyConfig();
      dailyScoreValue = calculateDailyScore(
        h.currentFloor, h.enemiesDefeated, h.turnManager.turn, false
      );
      saveDailyScore({
        date: dailyConfig.date,
        floorsReached: h.currentFloor,
        enemiesDefeated: h.enemiesDefeated,
        turnsUsed: h.turnManager.turn,
        score: dailyScoreValue,
        cleared: false,
        starter: h.starterId,
      });
    }

    // Leaderboard: calculate and save run score on game over (with chain bonus)
    const goBaseScore = calculateScore({
      dungeonId: h.dungeonDef.id,
      starter: h.starterId,
      floorsCleared: h.currentFloor,
      enemiesDefeated: h.enemiesDefeated,
      turns: h.turnManager.turn,
      goldEarned: gold,
      cleared: false,
      totalFloors: h.dungeonDef.floors,
      challengeMode: h.challengeMode ?? undefined,
    });
    const goChainBonus = h.scoreChain.totalBonusScore;
    const goRunScore = goBaseScore + goChainBonus;
    saveRunScore({
      dungeonId: h.dungeonDef.id,
      starter: h.starterId,
      score: goRunScore,
      floorsCleared: h.currentFloor,
      enemiesDefeated: h.enemiesDefeated,
      turns: h.turnManager.turn,
      goldEarned: gold,
      cleared: false,
      date: new Date().toISOString(),
      challengeMode: h.challengeMode ?? undefined,
      difficulty: isNonNormalDifficulty(h.difficultyLevel) ? h.difficultyLevel : undefined,
    });

    // Run counter for this dungeon
    const goMeta = loadMeta();
    const goDungeonRunCount = (goMeta.dungeonRunCounts ?? {})[h.dungeonDef.id] ?? 0;

    // Chain bonus display
    const goMaxTier = getChainTier(h.scoreChain.maxChainReached);
    const goChainStr = goMaxTier
      ? `Best Chain: ${goMaxTier} (x${h.scoreChain.maxChainReached.toFixed(1)})  +${goChainBonus} pts`
      : "";

    // Stats summary
    const goStats = [
      `Run #${goDungeonRunCount}`,
      `Lv.${h.player.stats.level}  Defeated: ${h.enemiesDefeated}  Turns: ${h.turnManager.turn}`,
      h.dungeonDef.id === "dailyDungeon" ? `Daily Score: ${dailyScoreValue}` : "",
      h.isBossRush ? `Bosses Defeated: ${h.bossesDefeated}/10` : "",
      h.gauntletSys.totalWavesCleared > 0 ? `Gauntlet Waves: ${h.gauntletSys.totalWavesCleared}` : "",
      goChainStr,
      `Score: ${goRunScore}`,
    ].filter(Boolean).join("\n");
    scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 22, goStats, {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace", align: "center",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(201);

    // Performance grade
    const goGrade = calculatePerformanceGrade(h.runLog.getSummaryStats(), false, h.dungeonDef.floors, h.turnManager.turn);
    scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 80, `Grade: ${goGrade}`, {
      fontSize: "14px", color: gradeColor(goGrade), fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    // ── Styled buttons ──
    const btnW = 240;
    const btnH = 36;
    const btnBaseY = GAME_HEIGHT / 2 + 108;
    const btnGap = 44;

    // Return to Town
    const rtBg = scene.add.rectangle(GAME_WIDTH / 2, btnBaseY, btnW, btnH, 0x1e3a5f, 0.95)
      .setStrokeStyle(1, 0x3b82f6).setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });
    scene.add.text(GAME_WIDTH / 2, btnBaseY, "Return to Town", {
      fontSize: "13px", color: "#60a5fa", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    rtBg.on("pointerover", () => rtBg.setFillStyle(0x2a4a6f, 1));
    rtBg.on("pointerout", () => rtBg.setFillStyle(0x1e3a5f, 0.95));
    rtBg.on("pointerdown", () => {
      (h.scene as any).scene.start("HubScene", {
        gold,
        cleared: false,
        bestFloor: h.currentFloor,
        enemiesDefeated: h.enemiesDefeated,
        turns: h.turnManager.turn,
        dungeonId: h.dungeonDef.id,
        starter: h.starterId,
        challengeMode: h.challengeMode ?? undefined,
        pokemonSeen: Array.from(h.seenSpecies),
        inventory: serializeInventory(h.inventory),
        ...h.getQuestTrackingData(),
      });
    });

    // Quick Retry
    const qrBg = scene.add.rectangle(GAME_WIDTH / 2, btnBaseY + btnGap, btnW, btnH, 0x3a2a1a, 0.95)
      .setStrokeStyle(1, 0xf59e0b).setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });
    scene.add.text(GAME_WIDTH / 2, btnBaseY + btnGap, "Quick Retry", {
      fontSize: "13px", color: "#f59e0b", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    qrBg.on("pointerover", () => qrBg.setFillStyle(0x4a3a2a, 1));
    qrBg.on("pointerout", () => qrBg.setFillStyle(0x3a2a1a, 0.95));
    qrBg.on("pointerdown", () => {
      this.quickRetry(gold, false);
    });

    // Run Summary
    const rsBg = scene.add.rectangle(GAME_WIDTH / 2, btnBaseY + btnGap * 2, btnW, btnH, 0x1a0a2a, 0.95)
      .setStrokeStyle(1, 0xa855f7).setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });
    scene.add.text(GAME_WIDTH / 2, btnBaseY + btnGap * 2, "Run Summary", {
      fontSize: "13px", color: "#a855f7", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    rsBg.on("pointerover", () => rsBg.setFillStyle(0x2a1a3a, 1));
    rsBg.on("pointerout", () => rsBg.setFillStyle(0x1a0a2a, 0.95));
    rsBg.on("pointerdown", () => {
      this.showRunSummary(false, h.dungeonDef.floors);
    });
  }

  // ── Dungeon Clear Screen ──

  showDungeonClear() {
    const h = this.host;
    const scene = h.scene;
    this.gameOver = true;
    stopBgm();
    sfxVictory();
    clearDungeonSave();
    // Run log: dungeon cleared
    h.runLog.add(RunLogEvent.DungeonCleared, `${h.dungeonDef.name} cleared!`, h.currentFloor, h.turnManager.turn);

    // Boss bonus: +50% gold if dungeon has a boss; Boss Rush always counts as boss dungeon
    const baseGold = goldFromRun(h.currentFloor, h.enemiesDefeated, true);
    const ngGoldBonus = 1 + h.ngPlusBonuses.goldPercent / 100; // NG+ gold bonus
    const challengeGoldMultiplier = h.challengeMode === "speedrun" ? 2 : 1; // Speed Run = 2x gold
    const modGoldMult = h.modifierEffects.goldMult; // Dungeon modifier gold multiplier
    const clearHeldGoldMult = 1 + (h.heldItemEffect.goldBonus ?? 0) / 100;
    const clearEnchGoldMult = h.enchantment?.id === "abundance" ? 1.15 : 1.0;
    const hasBoss = h.dungeonDef.boss || h.isBossRush;
    const clearMutGoldMult = hasMutation(h.floorMutations, MutationType.GoldenAge) ? getMutationEffect(MutationType.GoldenAge, "goldMult") : 1;
    const clearTalentGoldMult = 1 + (h.talentEffects.goldPercent ?? 0) / 100;
    const clearRelicGoldMult = 1 + (h.relicEffects.goldMult ?? 0);
    const clearBlessingGoldMult = 1 + getBlessingEffect(h.activeBlessings, "goldMult");
    const gold = Math.floor((hasBoss ? baseGold * 1.5 : baseGold) * ngGoldBonus * challengeGoldMultiplier * modGoldMult * clearHeldGoldMult * h.difficultyMods.goldMult * clearEnchGoldMult * clearMutGoldMult * clearTalentGoldMult * clearRelicGoldMult * clearBlessingGoldMult);

    scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.85
    ).setScrollFactor(0).setDepth(200);

    // Use top-down layout to avoid overlap
    let clearY = 60;

    const titleText = scene.add.text(GAME_WIDTH / 2, clearY, "DUNGEON CLEAR!", {
      fontSize: "20px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    clearY += 30;

    // Challenge mode info on clear screen
    if (h.challengeMode) {
      const chDef = CHALLENGE_MODES.find(c => c.id === h.challengeMode);
      if (chDef) {
        scene.add.text(GAME_WIDTH / 2, clearY, `Challenge: ${chDef.name}`, {
          fontSize: "10px", color: chDef.color, fontFamily: "monospace", fontStyle: "bold",
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
        clearY += 18;
      }
    }

    scene.add.text(GAME_WIDTH / 2, clearY, `${h.dungeonDef.name} B${h.dungeonDef.floors}F cleared!`, {
      fontSize: "12px", color: "#e0e0e0", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    clearY += 24;

    scene.add.text(GAME_WIDTH / 2, clearY, `Earned ${gold} Gold!`, {
      fontSize: "13px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    clearY += 22;

    // Daily dungeon: calculate and save score
    let dailyScoreValue = 0;
    if (h.dungeonDef.id === "dailyDungeon") {
      const dailyConfig = getDailyConfig();
      dailyScoreValue = calculateDailyScore(
        h.currentFloor, h.enemiesDefeated, h.turnManager.turn, true
      );
      saveDailyScore({
        date: dailyConfig.date,
        floorsReached: h.currentFloor,
        enemiesDefeated: h.enemiesDefeated,
        turnsUsed: h.turnManager.turn,
        score: dailyScoreValue,
        cleared: true,
        starter: h.starterId,
      });
    }

    // Leaderboard: calculate and save run score (with chain bonus added)
    const clearBaseScore = calculateScore({
      dungeonId: h.dungeonDef.id,
      starter: h.starterId,
      floorsCleared: h.dungeonDef.floors,
      enemiesDefeated: h.enemiesDefeated,
      turns: h.turnManager.turn,
      goldEarned: gold,
      cleared: true,
      totalFloors: h.dungeonDef.floors,
      challengeMode: h.challengeMode ?? undefined,
    });
    const clearChainBonus = h.scoreChain.totalBonusScore;
    const clearRunScore = clearBaseScore + clearChainBonus;
    saveRunScore({
      dungeonId: h.dungeonDef.id,
      starter: h.starterId,
      score: clearRunScore,
      floorsCleared: h.dungeonDef.floors,
      enemiesDefeated: h.enemiesDefeated,
      turns: h.turnManager.turn,
      goldEarned: gold,
      cleared: true,
      date: new Date().toISOString(),
      challengeMode: h.challengeMode ?? undefined,
      difficulty: isNonNormalDifficulty(h.difficultyLevel) ? h.difficultyLevel : undefined,
    });

    // Journal: record dungeon clear with species encountered
    {
      const clearJournal = loadJournal();
      recordDungeonClear(clearJournal, h.dungeonDef.id, h.dungeonDef.floors, h.runElapsedSeconds, h.enemiesDefeated, gold);
      for (const sid of h.seenSpecies) {
        recordSpeciesEncountered(clearJournal, h.dungeonDef.id, sid);
      }
    }

    // Run counter for this dungeon
    const clearMeta = loadMeta();
    const clearDungeonRunCount = (clearMeta.dungeonRunCounts ?? {})[h.dungeonDef.id] ?? 0;

    // Speed run timer: check and save best time
    const runTime = h.runElapsedSeconds;
    if (!clearMeta.bestTimes) clearMeta.bestTimes = {};
    const prevBest = clearMeta.bestTimes[h.dungeonDef.id];
    const isNewBest = prevBest === undefined || runTime < prevBest;
    if (isNewBest) {
      clearMeta.bestTimes[h.dungeonDef.id] = runTime;
      saveMeta(clearMeta);
    }

    // Time display on clear screen
    const timeStr = `Time: ${h.formatTime(runTime)}`;
    const bestStr = isNewBest
      ? `Best: ${h.formatTime(runTime)}`
      : `Best: ${h.formatTime(prevBest!)}`;
    scene.add.text(GAME_WIDTH / 2, clearY, `${timeStr}    ${bestStr}`, {
      fontSize: "10px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    clearY += 16;

    // "New Best Time!" banner
    if (isNewBest) {
      scene.add.text(GAME_WIDTH / 2, clearY, "New Best Time!", {
        fontSize: "10px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
      clearY += 16;
    }

    // Chain bonus display
    const clearMaxTier = getChainTier(h.scoreChain.maxChainReached);
    const clearChainStr = clearMaxTier
      ? `Best Chain: ${clearMaxTier} (x${h.scoreChain.maxChainReached.toFixed(1)})  +${clearChainBonus} pts`
      : "";

    // Stats summary
    const clearStats = [
      `Run #${clearDungeonRunCount}`,
      `Lv.${h.player.stats.level}  Defeated: ${h.enemiesDefeated}  Turns: ${h.turnManager.turn}`,
      h.allies.length > 0 ? `Team: ${h.allies.filter(a => a.alive).map(a => a.name).join(", ")}` : "",
      h.ngPlusLevel > 0 ? `NG+${h.ngPlusLevel}` : "",
      h.challengeMode === "speedrun" ? "Speed Run Bonus: 2x Gold!" : "",
      h.dungeonDef.id === "dailyDungeon" ? `Daily Score: ${dailyScoreValue}` : "",
      h.isBossRush ? `Bosses Defeated: ${h.bossesDefeated}/10` : "",
      h.gauntletSys.totalWavesCleared > 0 ? `Gauntlet Waves: ${h.gauntletSys.totalWavesCleared}` : "",
      clearChainStr,
      `Score: ${clearRunScore}`,
    ].filter(Boolean).join("\n");
    clearY += 4;
    const statsText = scene.add.text(GAME_WIDTH / 2, clearY, clearStats, {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace", align: "center",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(201);
    clearY += statsText.height + 10;

    // Performance grade
    const clearGrade = calculatePerformanceGrade(h.runLog.getSummaryStats(), true, h.dungeonDef.floors, h.turnManager.turn);
    scene.add.text(GAME_WIDTH / 2, clearY, `Grade: ${clearGrade}`, {
      fontSize: "13px", color: gradeColor(clearGrade), fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    clearY += 24;

    // Buttons at bottom — use fixed positions from bottom
    const btnY1 = Math.max(clearY, GAME_HEIGHT - 120);
    const btnW = 200;
    const btnH = 32;

    const townBtnBg = scene.add.rectangle(GAME_WIDTH / 2, btnY1, btnW, btnH, 0x1e40af, 0.9)
      .setStrokeStyle(1, 0x60a5fa).setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });
    scene.add.text(GAME_WIDTH / 2, btnY1, "Return to Town", {
      fontSize: "13px", color: "#ffffff", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    townBtnBg.on("pointerover", () => townBtnBg.setFillStyle(0x2563eb, 1));
    townBtnBg.on("pointerout", () => townBtnBg.setFillStyle(0x1e40af, 0.9));
    townBtnBg.on("pointerdown", () => {
      (h.scene as any).scene.start("HubScene", {
        gold,
        cleared: true,
        bestFloor: h.dungeonDef.floors,
        enemiesDefeated: h.enemiesDefeated,
        turns: h.turnManager.turn,
        dungeonId: h.dungeonDef.id,
        starter: h.starterId,
        challengeMode: h.challengeMode ?? undefined,
        pokemonSeen: Array.from(h.seenSpecies),
        inventory: serializeInventory(h.inventory),
        ...h.getQuestTrackingData(),
      });
    });

    const btnY2 = btnY1 + btnH + 6;
    const retryBtnBg = scene.add.rectangle(GAME_WIDTH / 2, btnY2, btnW, btnH, 0x92400e, 0.9)
      .setStrokeStyle(1, 0xf59e0b).setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });
    scene.add.text(GAME_WIDTH / 2, btnY2, "Run Again", {
      fontSize: "13px", color: "#ffffff", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    retryBtnBg.on("pointerover", () => retryBtnBg.setFillStyle(0xb45309, 1));
    retryBtnBg.on("pointerout", () => retryBtnBg.setFillStyle(0x92400e, 0.9));
    retryBtnBg.on("pointerdown", () => {
      this.quickRetry(gold, true);
    });

    const btnY3 = btnY2 + btnH + 6;
    const summaryBtnBg = scene.add.rectangle(GAME_WIDTH / 2, btnY3, btnW * 0.8, 26, 0x2a2a4e, 0.9)
      .setStrokeStyle(1, 0xa855f7).setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });
    scene.add.text(GAME_WIDTH / 2, btnY3, "Run Summary", {
      fontSize: "11px", color: "#a855f7", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    summaryBtnBg.on("pointerdown", () => {
      this.showRunSummary(true, h.dungeonDef.floors);
    });

    // Gentle gold glow on title
    scene.tweens.add({
      targets: titleText,
      alpha: { from: 1, to: 0.7 },
      duration: 1200, yoyo: true, repeat: -1,
    });
  }

  // ── Run Summary ──

  /**
   * Run Summary overlay — shows detailed stats, notable events, timeline, and performance grade.
   */
  showRunSummary(cleared: boolean, totalFloors: number) {
    const h = this.host;
    const scene = h.scene;
    const stats = h.runLog.getSummaryStats();
    const grade = calculatePerformanceGrade(stats, cleared, totalFloors, h.turnManager.turn);
    const notable = h.runLog.getNotableEvents();
    const timeline = h.runLog.getTimeline();

    // Full-screen overlay
    const bg = scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x0a0a1a, 0.95
    ).setScrollFactor(0).setDepth(300).setInteractive();

    const uiElements: Phaser.GameObjects.GameObject[] = [bg];

    // Title + grade
    const gradeStr = `Grade: ${grade}`;
    const titleEl = scene.add.text(GAME_WIDTH / 2, 30, "RUN SUMMARY", {
      fontSize: "16px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
    uiElements.push(titleEl);

    const gradeEl = scene.add.text(GAME_WIDTH / 2, 50, gradeStr, {
      fontSize: "22px", color: gradeColor(grade), fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
    uiElements.push(gradeEl);

    // Grade pulse animation
    scene.tweens.add({
      targets: gradeEl,
      scaleX: 1.15, scaleY: 1.15,
      duration: 600, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
    });

    // Key stats section
    const statsLines = [
      `Enemies Defeated: ${stats.totalEnemiesDefeated}`,
      `Damage Dealt: ${stats.totalDamageDealt}`,
      `Damage Taken: ${stats.totalDamageTaken}`,
      `Items Used: ${stats.totalItemsUsed}  Picked Up: ${stats.totalItemsPickedUp}`,
      `Skills Used: ${stats.totalSkillsUsed}  Unique: ${stats.uniqueSkillsUsed}`,
      `Level Ups: ${stats.levelUps}`,
      `Floors: ${stats.floorsExplored}`,
      stats.bestChainTier ? `Best Chain: ${stats.bestChainTier}` : "",
    ].filter(Boolean).join("\n");

    const statsEl = scene.add.text(GAME_WIDTH / 2, 75, statsLines, {
      fontSize: "9px", color: "#cbd5e1", fontFamily: "monospace", align: "center",
      lineSpacing: 2,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(301);
    uiElements.push(statsEl);

    // Notable events section
    let notableY = 160;
    if (stats.bossesDefeated > 0 || stats.legendariesDefeated > 0 || stats.secretRoomsFound > 0 ||
        stats.puzzlesSolved > 0 || stats.gauntletsCleared > 0 || stats.shopsVisited > 0) {
      const notableHeader = scene.add.text(GAME_WIDTH / 2, notableY, "NOTABLE EVENTS", {
        fontSize: "10px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
      uiElements.push(notableHeader);
      notableY += 15;

      const notableLines: string[] = [];
      if (stats.bossesDefeated > 0) notableLines.push(`Bosses Defeated: ${stats.bossesDefeated}`);
      if (stats.legendariesDefeated > 0) notableLines.push(`Legendaries Defeated: ${stats.legendariesDefeated}`);
      if (stats.secretRoomsFound > 0) notableLines.push(`Secret Rooms: ${stats.secretRoomsFound}`);
      if (stats.puzzlesSolved > 0) notableLines.push(`Puzzles Solved: ${stats.puzzlesSolved}`);
      if (stats.gauntletsCleared > 0) notableLines.push(`Gauntlets Cleared: ${stats.gauntletsCleared}`);
      if (stats.shopsVisited > 0) notableLines.push(`Shops Visited: ${stats.shopsVisited}`);
      if (stats.weatherChanges > 0) notableLines.push(`Weather Changes: ${stats.weatherChanges}`);
      if (stats.mutationsEncountered > 0) notableLines.push(`Mutations: ${stats.mutationsEncountered}`);

      const notableEl = scene.add.text(GAME_WIDTH / 2, notableY, notableLines.join("\n"), {
        fontSize: "9px", color: "#94a3b8", fontFamily: "monospace", align: "center",
        lineSpacing: 2,
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(301);
      uiElements.push(notableEl);
      notableY += notableLines.length * 12 + 10;
    }

    // Timeline section (scrollable)
    if (timeline.length > 0) {
      const timelineHeader = scene.add.text(GAME_WIDTH / 2, notableY, "TIMELINE", {
        fontSize: "10px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
      uiElements.push(timelineHeader);
      notableY += 16;

      // Build timeline text lines
      const timelineLines: string[] = [];
      for (const entry of timeline) {
        timelineLines.push(`--- B${entry.floor}F ---`);
        for (const ev of entry.events) {
          timelineLines.push(`  ${ev}`);
        }
      }

      // Clamp viewable area: show timeline in a scrollable mask area
      const timelineAreaHeight = GAME_HEIGHT - notableY - 50;
      const maxVisibleLines = Math.floor(timelineAreaHeight / 11);
      let scrollOffset = 0;
      const totalLines = timelineLines.length;

      const renderTimeline = () => {
        // Remove previous timeline text elements
        const toRemove = uiElements.filter(el => (el as any).__isTimelineLine);
        for (const el of toRemove) {
          el.destroy();
          uiElements.splice(uiElements.indexOf(el), 1);
        }

        const visibleLines = timelineLines.slice(scrollOffset, scrollOffset + maxVisibleLines);
        for (let i = 0; i < visibleLines.length; i++) {
          const line = visibleLines[i];
          const isFloorHeader = line.startsWith("---");
          const lineEl = scene.add.text(20, notableY + i * 11, line, {
            fontSize: "8px",
            color: isFloorHeader ? "#fbbf24" : "#94a3b8",
            fontFamily: "monospace",
            fontStyle: isFloorHeader ? "bold" : "normal",
          }).setScrollFactor(0).setDepth(301);
          (lineEl as any).__isTimelineLine = true;
          uiElements.push(lineEl);
        }

        // Scroll indicator
        if (totalLines > maxVisibleLines) {
          const pct = Math.round((scrollOffset / Math.max(1, totalLines - maxVisibleLines)) * 100);
          const scrollIndicator = scene.add.text(GAME_WIDTH - 15, notableY, `${pct}%`, {
            fontSize: "8px", color: "#6b7280", fontFamily: "monospace",
          }).setOrigin(1, 0).setScrollFactor(0).setDepth(301);
          (scrollIndicator as any).__isTimelineLine = true;
          uiElements.push(scrollIndicator);
        }
      };

      renderTimeline();

      // Scroll buttons (if needed)
      if (totalLines > maxVisibleLines) {
        const scrollUpBtn = scene.add.text(GAME_WIDTH - 20, notableY + 12, "[^]", {
          fontSize: "10px", color: "#60a5fa", fontFamily: "monospace",
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(302).setInteractive();
        scrollUpBtn.on("pointerdown", () => {
          scrollOffset = Math.max(0, scrollOffset - 5);
          renderTimeline();
        });
        uiElements.push(scrollUpBtn);

        const scrollDownBtn = scene.add.text(GAME_WIDTH - 20, GAME_HEIGHT - 55, "[v]", {
          fontSize: "10px", color: "#60a5fa", fontFamily: "monospace",
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(302).setInteractive();
        scrollDownBtn.on("pointerdown", () => {
          scrollOffset = Math.min(totalLines - maxVisibleLines, scrollOffset + 5);
          renderTimeline();
        });
        uiElements.push(scrollDownBtn);
      }
    }

    // Close button
    const closeBtn = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, "[Close]", {
      fontSize: "14px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(302).setInteractive();
    closeBtn.on("pointerdown", () => {
      for (const el of uiElements) el.destroy();
    });
    uiElements.push(closeBtn);
  }

  // ── Quick Retry ──

  /**
   * Quick Retry / Run Again — saves run results and immediately re-enters the same dungeon.
   * Mirrors the gold/stats saving logic from HubScene.init + DungeonPreviewScene.launchDungeon.
   */
  quickRetry(gold: number, cleared: boolean) {
    const h = this.host;
    const scene = h.scene;
    const meta = loadMeta();

    // 1. Save run results (same as HubScene.init)
    meta.gold += gold;
    meta.totalGold += gold;
    meta.totalRuns++;
    if (cleared) meta.totalClears++;
    const bestFloor = cleared ? h.dungeonDef.floors : h.currentFloor;
    if (bestFloor > meta.bestFloor) meta.bestFloor = bestFloor;
    meta.totalEnemiesDefeated += h.enemiesDefeated;
    meta.totalTurns += h.turnManager.turn;
    if (h.dungeonDef.id === "endlessDungeon" && bestFloor > meta.endlessBestFloor) {
      meta.endlessBestFloor = bestFloor;
    }
    if (cleared && h.challengeMode) {
      meta.challengeClears++;
    }
    if (h.starterId && !meta.startersUsed.includes(h.starterId)) {
      meta.startersUsed.push(h.starterId);
    }
    // Pokedex: merge seen Pokemon from this run
    const seenSet = new Set(meta.pokemonSeen);
    for (const id of h.seenSpecies) {
      seenSet.add(id);
    }
    meta.pokemonSeen = Array.from(seenSet);
    if (h.starterId && !meta.pokemonUsed.includes(h.starterId)) {
      meta.pokemonUsed.push(h.starterId);
    }
    // Auto-store inventory items from dungeon run
    const invData = serializeInventory(h.inventory);
    for (const stack of invData) {
      addToStorage(meta.storage, stack.itemId, stack.count);
    }

    // Track cleared dungeons
    if (cleared) {
      if (!meta.clearedDungeons) meta.clearedDungeons = [];
      if (!meta.clearedDungeons.includes(h.dungeonDef.id)) {
        meta.clearedDungeons.push(h.dungeonDef.id);
      }
    }

    // Journal: record quick-retry run results
    {
      const qrJournal = loadJournal();
      if (cleared) {
        recordDungeonClear(qrJournal, h.dungeonDef.id, h.dungeonDef.floors, h.runElapsedSeconds, h.enemiesDefeated, gold);
      } else {
        recordDungeonDefeat(qrJournal, h.dungeonDef.id, h.currentFloor, h.enemiesDefeated, gold);
      }
      for (const sid of h.seenSpecies) {
        recordSpeciesEncountered(qrJournal, h.dungeonDef.id, sid);
      }
    }

    // 2. Save last dungeon info
    meta.lastDungeonId = h.dungeonDef.id;
    meta.lastChallenge = h.challengeMode ?? undefined;

    // 3. Increment per-dungeon run count for the NEW run
    if (!meta.dungeonRunCounts) meta.dungeonRunCounts = {};
    meta.dungeonRunCounts[h.dungeonDef.id] = (meta.dungeonRunCounts[h.dungeonDef.id] ?? 0) + 1;

    // 4. Increment totalRuns for the new run (DungeonPreviewScene does this)
    meta.totalRuns++;

    // 4b. Update quest progress for this run
    const today = getTodayDateString();
    if (meta.questLastDate !== today) {
      meta.activeQuests = generateDailyQuests(new Date(), meta);
      meta.questLastDate = today;
    }
    if (!meta.challengeQuests || meta.challengeQuests.length === 0) {
      meta.challengeQuests = getChallengeQuests(meta);
    }
    const bestChainTier = getChainTier(h.scoreChain.maxChainReached);
    const qrBossDefeated = h.isBossRush ? h.bossesDefeated > 0 : !!h.dungeonDef.boss;
    const qrLegendaryDefeated = h.legendaryEncountered && h.legendaryEntity === null && h.legendaryEncounter === null;
    const runQuestData: RunQuestData = {
      enemiesDefeated: h.enemiesDefeated,
      cleared,
      dungeonId: h.dungeonDef.id,
      itemsCollected: h.questItemsCollected,
      floorReached: bestFloor,
      bestChainTier,
      bossDefeated: qrBossDefeated,
      legendaryDefeated: qrLegendaryDefeated,
      noItemsUsed: !h.questItemsUsed,
      turnsUsed: h.turnManager.turn,
    };
    if (meta.activeQuests && meta.activeQuests.length > 0) {
      updateQuestProgress(meta.activeQuests, runQuestData);
    }
    if (meta.challengeQuests && meta.challengeQuests.length > 0) {
      updateQuestProgress(meta.challengeQuests, runQuestData);
    }

    saveMeta(meta);
    clearDungeonSave();

    // 5. Start new dungeon (same as DungeonPreviewScene.launchDungeon)
    stopBgm();
    scene.cameras.main.fadeOut(400, 0, 0, 0);
    scene.time.delayedCall(450, () => {
      const launchData: Record<string, unknown> = {
        floor: 1,
        fromHub: true,
        dungeonId: h.dungeonDef.id,
        starter: h.starterId,
      };
      if (h.challengeMode) {
        launchData.challengeMode = h.challengeMode;
      }
      (h.scene as any).scene.start("DungeonScene", launchData);
    });
  }
}
