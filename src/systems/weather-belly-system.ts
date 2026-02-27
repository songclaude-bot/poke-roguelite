/**
 * WeatherBellySystem — Extracted from DungeonScene.
 * Manages weather state, weather visuals, weather transitions, weather damage,
 * belly (hunger) drain, belly warnings, and belly HUD bar.
 */
import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { Entity } from "../core/entity";
import { DungeonDef } from "../core/dungeon-data";
import {
  WeatherType, WEATHERS, isWeatherImmune,
  rollFloorWeather, WeatherIntensity, INTENSITY_MULTIPLIER,
  INTENSITY_COLOR, getWeatherIntensity, shouldWeatherTransition,
} from "../core/weather";
import { generateForecast, forecastToString } from "../core/weather-forecast";
import { FloorEventType } from "../core/floor-events";
import { ActiveBlessing, getBlessingEffect } from "../core/blessings";
import { DifficultyModifiers } from "../core/difficulty-settings";
import { NGPlusBonusEffects } from "../core/new-game-plus";
import { sfxWeatherChange } from "../core/sound-manager";
import { RunLog, RunLogEvent } from "../core/run-log";

// ── Host interface: what WeatherBellySystem needs from DungeonScene ──

export interface WeatherBellyHost {
  // Read-only game state
  readonly player: Entity;
  readonly currentFloor: number;
  readonly dungeonDef: DungeonDef;
  readonly allEntities: Entity[];
  readonly difficultyMods: DifficultyModifiers;
  readonly ngPlusBonuses: NGPlusBonusEffects;
  readonly activeBlessings: ActiveBlessing[];
  readonly runLog: RunLog;

  // Floor event (for FamineFloor belly multiplier)
  readonly floorEvent: { type: string } | null;

  // Talent effects for belly drain
  readonly talentEffects: { bellyDrainReduction?: number };

  // Turn manager (for turn count used in reminders)
  readonly turnManager: { turn: number };

  // Callbacks (delegate back to DungeonScene)
  showLog(msg: string): void;
  updateHUD(): void;
  showDamagePopup(x: number, y: number, dmg: number, alpha: number, label?: string): void;
  checkPlayerDeath(): void;
  checkDeath(entity: Entity): void;
}

// ── WeatherBellySystem class ──

export class WeatherBellySystem {

  // ── Weather state ──
  currentWeather = WeatherType.None;
  currentWeatherIntensity = WeatherIntensity.Mild;
  floorTurns = 0;

  // Weather HUD elements (created by initWeatherHUD)
  private weatherText!: Phaser.GameObjects.Text;
  weatherIntensityHudText: Phaser.GameObjects.Text | null = null;
  weatherForecastHudText: Phaser.GameObjects.Text | null = null;
  private weatherOverlay: Phaser.GameObjects.Rectangle | null = null;
  private weatherParticles: Phaser.GameObjects.Graphics | null = null;
  private weatherTimer: Phaser.Time.TimerEvent | null = null;

  // ── Belly (hunger) state ──
  belly = 100;
  maxBelly = 100;

  // Belly HUD elements
  private bellyBarBg!: Phaser.GameObjects.Graphics;
  private bellyBarFill!: Phaser.GameObjects.Graphics;
  bellyText!: Phaser.GameObjects.Text;
  private bellyWarningShown = false;
  private bellyUrgentShown = false;

  constructor(private host: WeatherBellyHost) {}

  protected get scene(): Phaser.Scene { return this.host as any; }

  // ══════════════════════════════════════════
  //  Belly Methods
  // ══════════════════════════════════════════

  /** Initialize belly state from saved data / upgrade bonuses */
  initBelly(maxBelly: number, belly?: number) {
    this.maxBelly = maxBelly;
    this.belly = belly ?? maxBelly;
    this.bellyWarningShown = this.belly <= this.maxBelly * 0.2;
    this.bellyUrgentShown = this.belly <= this.maxBelly * 0.1;
  }

  /** Create belly HUD bar graphics (call during create phase) */
  initBellyHUD() {
    const scene = this.scene;

    // Belly Bar background (below HP bar)
    this.bellyBarBg = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.bellyBarBg.fillStyle(0x1a1a2e, 0.9);
    this.bellyBarBg.fillRoundedRect(38, 19, 100, 6, 2);
    this.bellyBarBg.lineStyle(1, 0x333355);
    this.bellyBarBg.strokeRoundedRect(38, 19, 100, 6, 2);

    // Belly Bar fill
    this.bellyBarFill = scene.add.graphics().setScrollFactor(0).setDepth(101);

    // Belly text label (on the bar)
    this.bellyText = scene.add.text(40, 19, "", {
      fontSize: "5px", color: "#ffffff", fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(102);
  }

  /** Update belly HUD bar graphics (called from updateHUD) */
  updateBellyHUD() {
    const bellyRatio = this.maxBelly > 0 ? this.belly / this.maxBelly : 0;
    this.bellyBarFill.clear();
    const bellyBarColor = bellyRatio > 0.5 ? 0x4ade80 : bellyRatio > 0.2 ? 0xfbbf24 : 0xef4444;
    const bellyBarWidth = Math.max(0, Math.floor(98 * bellyRatio));
    this.bellyBarFill.fillStyle(bellyBarColor, 1);
    this.bellyBarFill.fillRoundedRect(39, 20, bellyBarWidth, 4, 1);
    this.bellyText.setText(`${Math.floor(this.belly)}/${this.maxBelly}`);
  }

  /** Tick belly drain each turn */
  tickBelly() {
    const host = this.host;
    if (this.belly > 0) {
      // Difficulty-based drain: higher difficulty = faster hunger, NG+ reduces drain
      const ngBellyMult = 1 - host.ngPlusBonuses.bellyDrainReduction / 100;
      const talentBellyMult = 1 - (host.talentEffects.bellyDrainReduction ?? 0) / 100;
      const blessingBellyMult = 1 + getBlessingEffect(host.activeBlessings, "bellyDrainMult");
      // FamineFloor: belly drains 2x faster
      const famineFloorMult = host.floorEvent?.type === FloorEventType.FamineFloor ? 2.0 : 1.0;
      const drainRate = (0.5 + host.dungeonDef.difficulty * 0.1) * host.difficultyMods.bellyDrainMult * ngBellyMult * talentBellyMult * blessingBellyMult * famineFloorMult;
      const prevBelly = this.belly;
      this.belly = Math.max(0, this.belly - drainRate);

      if (this.belly <= 0) {
        // Just hit 0 this tick
        this.belly = 0;
        host.showLog("Your belly is empty! HP will drain each turn!");
        this.bellyWarningShown = true;
        this.bellyUrgentShown = true;
      } else if (this.belly <= this.maxBelly * 0.1 && !this.bellyUrgentShown) {
        // Urgent warning at 10%
        host.showLog("You're starving! Find food quickly!");
        this.bellyUrgentShown = true;
      } else if (this.belly <= this.maxBelly * 0.2 && prevBelly > this.maxBelly * 0.2 && !this.bellyWarningShown) {
        // Warning at 20%
        host.showLog("Your belly is getting empty...");
        this.bellyWarningShown = true;
      }
    } else {
      // Starving: lose HP based on max HP (min 1, ~2% of maxHp)
      const starveDmg = Math.max(1, Math.floor(host.player.stats.maxHp * 0.02));
      host.player.stats.hp = Math.max(0, host.player.stats.hp - starveDmg);
      if (host.player.sprite) host.showDamagePopup(host.player.sprite.x, host.player.sprite.y, starveDmg, 0.5);
      // Show periodic reminders
      if (host.turnManager.turn % 5 === 0) {
        host.showLog(`Starving! Took ${starveDmg} damage!`);
      }
      host.checkPlayerDeath();
    }
  }

  /** Reset belly warning flags (call when belly is restored by food) */
  resetBellyWarnings() {
    if (this.belly > this.maxBelly * 0.2) {
      this.bellyWarningShown = false;
      this.bellyUrgentShown = false;
    } else if (this.belly > this.maxBelly * 0.1) {
      this.bellyUrgentShown = false;
    }
  }

  // ══════════════════════════════════════════
  //  Weather Methods
  // ══════════════════════════════════════════

  /** Initialize weather for a new floor and create weather HUD (call during create phase) */
  initWeatherHUD() {
    const scene = this.scene;
    const host = this.host;

    this.currentWeather = rollFloorWeather(host.dungeonDef.id, host.currentFloor);
    this.currentWeatherIntensity = getWeatherIntensity(host.currentFloor, host.dungeonDef.floors);
    this.floorTurns = 0;

    this.weatherText = scene.add.text(GAME_WIDTH / 2, 24, "", {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);

    if (this.currentWeather !== WeatherType.None) {
      const wd = WEATHERS[this.currentWeather];
      const intLabel = this.currentWeatherIntensity;
      this.weatherText.setText(`${wd.symbol} ${wd.name} (${intLabel}): ${wd.description}`);
      this.weatherText.setColor(INTENSITY_COLOR[this.currentWeatherIntensity]);
      sfxWeatherChange();
      host.showLog(`The weather is ${wd.name} (${intLabel})!`);
      // Run log: weather on floor start
      host.runLog.add(RunLogEvent.WeatherChanged, wd.name, host.currentFloor, host.turnManager.turn);
    }
    this.setupWeatherVisuals();

    // ── Weather HUD Indicator ──
    this.weatherIntensityHudText = null;
    if (this.currentWeather !== WeatherType.None) {
      const weatherNames: Record<string, string> = {
        [WeatherType.Rain]: "Rain",
        [WeatherType.Sandstorm]: "Sandstorm",
        [WeatherType.Hail]: "Hail",
      };
      const intLabel = this.currentWeatherIntensity;
      this.weatherIntensityHudText = scene.add.text(GAME_WIDTH - 10, 55,
        `${weatherNames[this.currentWeather]} (${intLabel})`, {
        fontSize: "8px", color: INTENSITY_COLOR[this.currentWeatherIntensity], fontFamily: "monospace",
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    }

    // ── Weather Forecast HUD (next 2 floors) ──
    this.weatherForecastHudText = null;
    if (host.dungeonDef.id !== "bossRush") {
      const forecastStart = host.currentFloor + 1;
      const forecastCount = Math.min(2, Math.max(0, host.dungeonDef.floors - host.currentFloor));
      if (forecastCount > 0) {
        const forecasts = generateForecast(host.dungeonDef.id, forecastStart, forecastCount, host.dungeonDef.floors);
        const lines = forecasts.map(f => forecastToString(f));
        this.weatherForecastHudText = scene.add.text(GAME_WIDTH - 10, 65,
          lines.join("  "), {
          fontSize: "7px", color: "#6b7280", fontFamily: "monospace",
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
      }
    }
  }

  /** Tick weather: increment floorTurns, check transition, apply chip damage */
  tickWeather() {
    this.floorTurns++;

    // Check mid-floor weather transition every 10 turns
    if (this.floorTurns % 10 === 0 && this.currentWeather !== WeatherType.None) {
      this.checkWeatherTransition();
    }

    if (this.currentWeather === WeatherType.None || this.currentWeather === WeatherType.Rain) return;
    const BASE_WEATHER_DMG = 5;
    const intensityMult = INTENSITY_MULTIPLIER[this.currentWeatherIntensity];
    const WEATHER_DMG = Math.max(1, Math.floor(BASE_WEATHER_DMG * intensityMult));

    const host = this.host;
    // Apply chip damage to all entities not immune
    for (const entity of host.allEntities) {
      if (!entity.alive) continue;
      if (isWeatherImmune(this.currentWeather, entity.types)) continue;

      entity.stats.hp = Math.max(0, entity.stats.hp - WEATHER_DMG);
      if (entity.sprite) {
        host.showDamagePopup(entity.sprite.x, entity.sprite.y, WEATHER_DMG, 0.5);
      }
      if (entity === host.player) {
        host.checkPlayerDeath();
      } else if (entity.stats.hp <= 0) {
        host.checkDeath(entity);
      }
    }
  }

  /** Check and perform a mid-floor weather transition */
  private checkWeatherTransition() {
    const host = this.host;
    if (!shouldWeatherTransition(host.currentFloor)) return;
    const newWeather = rollFloorWeather(host.dungeonDef.id, host.currentFloor);
    if (newWeather === this.currentWeather) return; // no change

    this.currentWeather = newWeather;
    host.showLog("The weather changed!");

    // Update weather text HUD
    if (this.currentWeather !== WeatherType.None) {
      const wd = WEATHERS[this.currentWeather];
      const intLabel = this.currentWeatherIntensity;
      this.weatherText.setText(`${wd.symbol} ${wd.name} (${intLabel}): ${wd.description}`);
      this.weatherText.setColor(INTENSITY_COLOR[this.currentWeatherIntensity]);
      sfxWeatherChange();
      host.showLog(`The weather is now ${wd.name} (${intLabel})!`);
      // Run log: weather changed mid-floor
      host.runLog.add(RunLogEvent.WeatherChanged, wd.name, host.currentFloor, host.turnManager.turn);
    } else {
      this.weatherText.setText("");
    }

    // Update the compact HUD indicator
    if (this.weatherIntensityHudText) {
      this.weatherIntensityHudText.destroy();
      this.weatherIntensityHudText = null;
    }
    if (this.currentWeather !== WeatherType.None) {
      const scene = host as any as Phaser.Scene;
      const weatherNames: Record<string, string> = {
        [WeatherType.Rain]: "Rain",
        [WeatherType.Sandstorm]: "Sandstorm",
        [WeatherType.Hail]: "Hail",
      };
      const intLabel = this.currentWeatherIntensity;
      this.weatherIntensityHudText = scene.add.text(GAME_WIDTH - 10, 55,
        `${weatherNames[this.currentWeather]} (${intLabel})`, {
        fontSize: "8px", color: INTENSITY_COLOR[this.currentWeatherIntensity], fontFamily: "monospace",
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

      // Flash effect on weather change
      this.weatherIntensityHudText.setAlpha(0);
      scene.tweens.add({
        targets: this.weatherIntensityHudText,
        alpha: { from: 0, to: 1 },
        duration: 300,
        yoyo: true,
        repeat: 2,
        onComplete: () => { if (this.weatherIntensityHudText) this.weatherIntensityHudText.setAlpha(1); },
      });
    }

    // Rebuild weather visuals
    this.setupWeatherVisuals();
  }

  // ── Weather Visuals ──

  private clearWeatherVisuals() {
    if (this.weatherOverlay) { this.weatherOverlay.destroy(); this.weatherOverlay = null; }
    if (this.weatherParticles) { this.weatherParticles.destroy(); this.weatherParticles = null; }
    if (this.weatherTimer) { this.weatherTimer.destroy(); this.weatherTimer = null; }
  }

  private setupWeatherVisuals() {
    this.clearWeatherVisuals();
    if (this.currentWeather === WeatherType.None) return;
    const scene = this.scene;

    switch (this.currentWeather) {
      case WeatherType.Rain: {
        // Blue-tinted overlay
        this.weatherOverlay = scene.add.rectangle(
          GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT,
          0x3b82f6, 0.06
        ).setScrollFactor(0).setDepth(150);

        // Rain particle effect
        const gfx = scene.add.graphics().setScrollFactor(0).setDepth(150);
        this.weatherParticles = gfx;
        this.weatherTimer = scene.time.addEvent({
          delay: 80,
          loop: true,
          callback: () => {
            gfx.clear();
            gfx.lineStyle(1, 0x6390f0, 0.3);
            for (let i = 0; i < 40; i++) {
              const x = Math.random() * GAME_WIDTH;
              const y = Math.random() * GAME_HEIGHT;
              gfx.lineBetween(x, y, x - 3, y + 12);
            }
          },
        });
        break;
      }
      case WeatherType.Sandstorm: {
        // Brown/sepia overlay
        this.weatherOverlay = scene.add.rectangle(
          GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT,
          0xd4a574, 0.08
        ).setScrollFactor(0).setDepth(150);

        // Sand particles blowing horizontally
        const gfx = scene.add.graphics().setScrollFactor(0).setDepth(150);
        this.weatherParticles = gfx;
        this.weatherTimer = scene.time.addEvent({
          delay: 100,
          loop: true,
          callback: () => {
            gfx.clear();
            gfx.fillStyle(0xd4a843, 0.15);
            for (let i = 0; i < 30; i++) {
              const x = Math.random() * GAME_WIDTH;
              const y = Math.random() * GAME_HEIGHT;
              gfx.fillCircle(x, y, 1 + Math.random() * 2);
            }
          },
        });
        break;
      }
      case WeatherType.Hail: {
        // White/light blue overlay
        this.weatherOverlay = scene.add.rectangle(
          GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT,
          0x93c5fd, 0.06
        ).setScrollFactor(0).setDepth(150);

        // Hail particles (small white dots)
        const gfx = scene.add.graphics().setScrollFactor(0).setDepth(150);
        this.weatherParticles = gfx;
        this.weatherTimer = scene.time.addEvent({
          delay: 120,
          loop: true,
          callback: () => {
            gfx.clear();
            gfx.fillStyle(0xffffff, 0.25);
            for (let i = 0; i < 25; i++) {
              const x = Math.random() * GAME_WIDTH;
              const y = Math.random() * GAME_HEIGHT;
              gfx.fillCircle(x, y, 1 + Math.random());
            }
          },
        });
        break;
      }
    }
  }
}
