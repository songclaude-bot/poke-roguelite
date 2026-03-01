/**
 * MinimapSystem — Extracted from DungeonScene.
 * Manages minimap rendering, fog-of-war (visited/currentlyVisible),
 * exploration percentage tracking, exploration rewards, and the full-map overlay.
 */
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { Entity } from "../core/entity";
import { DungeonData, TerrainType } from "../core/dungeon-generator";
import { DungeonDef } from "../core/dungeon-data";
import { FloorTheme, darkenColor } from "../core/floor-themes";
import {
  ExplorationTier, EXPLORATION_TIERS, getNewTiers,
} from "../core/exploration-rewards";
import { processLevelUp } from "../core/leveling";
import { RunLog, RunLogEvent } from "../core/run-log";
import { TurnManager } from "../core/turn-manager";
import { FloorTrap } from "../core/trap";
import { FloorHazard } from "../core/hazard-tiles";
import { TrapHazardSystem } from "./trap-hazard-system";
import { DungeonMutation, MutationType, hasMutation, getMutationEffect } from "../core/dungeon-mutations";
import { FloorEvent, FloorEventType } from "../core/floor-events";
import { ActiveBlessing, getBlessingEffect } from "../core/blessings";
import { Shrine } from "../core/dungeon-shrines";
import { PuzzleSystem } from "./puzzle-system";
import { SecretRoomSystem } from "./secret-room-system";
import { sfxLevelUp, sfxBuff } from "../core/sound-manager";
import { DomHudElements, setDomHudInteractive } from "../ui/dom-hud";

// ── Host interface: what MinimapSystem needs from DungeonScene ──

export interface MinimapHost {
  // Dungeon data
  readonly dungeon: DungeonData;

  // Player
  readonly player: Entity;

  // Entities
  readonly enemies: Entity[];
  readonly allies: Entity[];
  readonly floorItems: { x: number; y: number; item: { name: string }; sprite: Phaser.GameObjects.Text }[];

  // Floor features
  readonly shopRoom: { x: number; y: number; w: number; h: number } | null;
  readonly shopClosed: boolean;
  readonly eventRoom: { x: number; y: number; w: number; h: number } | null;
  readonly eventTriggered: boolean;
  readonly puzzleSys: PuzzleSystem;
  readonly floorShrine: Shrine | null;
  readonly shrineTileX: number;
  readonly shrineTileY: number;
  readonly shrineUsed: boolean;
  readonly secretRoomSys: SecretRoomSystem;
  readonly trapHazardSys: TrapHazardSystem;

  // Theme
  readonly currentTheme: FloorTheme;

  // Game state
  readonly currentFloor: number;
  readonly dungeonDef: DungeonDef;
  readonly floorMutations: DungeonMutation[];
  readonly floorEvent: FloorEvent | null;
  readonly talentEffects: Record<string, number>;
  readonly activeBlessings: ActiveBlessing[];
  readonly gameOver: boolean;
  readonly turnManager: TurnManager;
  readonly runLog: RunLog;

  // HUD
  readonly domHud: DomHudElements | null;

  // Mutable shared state
  gold: number;
  totalExp: number;

  // Callbacks
  showLog(msg: string): void;
  updateHUD(): void;
}

// ── MinimapSystem class ──

export class MinimapSystem {
  // ── Minimap graphics objects ──
  private minimapGfx!: Phaser.GameObjects.Graphics;
  private minimapBg!: Phaser.GameObjects.Graphics;
  private minimapBorder!: Phaser.GameObjects.Graphics;
  private minimapVisible = true;
  private minimapExpanded = false;
  private minimapHitZone!: Phaser.GameObjects.Zone;
  private minimapLegendTexts: Phaser.GameObjects.Text[] = [];

  // ── Fog of war ──
  visited!: boolean[][];
  currentlyVisible!: boolean[][];

  // ── Constants ──
  private readonly MINIMAP_TILE_SMALL = 3;
  private readonly MINIMAP_TILE_LARGE = 7;
  private readonly MINIMAP_TILE_FULLMAP = 4;
  private readonly MINIMAP_X_SMALL = GAME_WIDTH - 80;
  private readonly MINIMAP_Y_SMALL = 4;

  // ── Exploration percentage text ──
  private explorationText!: Phaser.GameObjects.Text;

  // ── Full map overlay ──
  fullMapOpen = false;
  private fullMapOverlayBg: Phaser.GameObjects.Graphics | null = null;
  private fullMapGfx: Phaser.GameObjects.Graphics | null = null;
  private fullMapCloseZone: Phaser.GameObjects.Zone | null = null;
  private fullMapUI: Phaser.GameObjects.GameObject[] = [];

  // MAP button (near minimap)
  private mapButton!: Phaser.GameObjects.Text;

  // ── Exploration reward state ──
  private lastExplorationPercent = 0;
  private explorationRewardsGranted = new Set<number>();

  constructor(private host: MinimapHost) {}

  protected get scene(): Phaser.Scene { return this.host as any; }

  // ── Initialization ──

  /** Initialize fog-of-war arrays for a new floor */
  initFogOfWar(width: number, height: number) {
    this.visited = Array.from({ length: height }, () => new Array(width).fill(false));
    this.currentlyVisible = Array.from({ length: height }, () => new Array(width).fill(false));
  }

  /** Reset exploration reward state for a new floor */
  resetExplorationState() {
    this.lastExplorationPercent = 0;
    this.explorationRewardsGranted = new Set<number>();
    this.fullMapOpen = false;
    this.fullMapOverlayBg = null;
    this.fullMapGfx = null;
    this.fullMapCloseZone = null;
    this.fullMapUI = [];
  }

  /** Create and set up the minimap UI elements */
  createMinimapUI() {
    const scene = this.scene;
    const { width, height } = this.host.dungeon;

    this.minimapBg = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.minimapBorder = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.minimapGfx = scene.add.graphics().setScrollFactor(0).setDepth(101);
    this.minimapExpanded = false;
    this.minimapLegendTexts = [];

    // Initial draw
    this.updateMinimap();

    // Tap on minimap zone to toggle small <-> large
    const smW = width * this.MINIMAP_TILE_SMALL + 4;
    const smH = height * this.MINIMAP_TILE_SMALL + 4;
    this.minimapHitZone = scene.add.zone(
      this.MINIMAP_X_SMALL - 2 + smW / 2,
      this.MINIMAP_Y_SMALL - 2 + smH / 2,
      smW, smH
    ).setScrollFactor(0).setDepth(102).setInteractive();
    this.minimapHitZone.on("pointerdown", () => {
      this.minimapExpanded = !this.minimapExpanded;
      this.updateMinimapHitZone();
      this.updateMinimap();
    });

    // MAP button (top-right, near minimap)
    this.fullMapOpen = false;
    this.fullMapUI = [];
    this.mapButton = scene.add.text(
      this.MINIMAP_X_SMALL - 2, this.MINIMAP_Y_SMALL + height * this.MINIMAP_TILE_SMALL + 10,
      "MAP",
      {
        fontSize: "8px", color: "#60a5fa", fontFamily: "monospace", fontStyle: "bold",
        backgroundColor: "#1a1a2ecc", padding: { x: 4, y: 2 },
      }
    ).setScrollFactor(0).setDepth(110).setInteractive();
    this.mapButton.on("pointerdown", () => {
      if (this.fullMapOpen) return;
      this.openFullMap();
    });
  }

  // ── Fog of War ──

  /** Reveal tiles around a point (Chebyshev distance) */
  revealArea(cx: number, cy: number, radius: number) {
    const { width, height } = this.host.dungeon;
    // Reset currentlyVisible for fresh computation
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.currentlyVisible[y][x] = false;
      }
    }
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          this.visited[ny][nx] = true;
          this.currentlyVisible[ny][nx] = true;
        }
      }
    }
    // Also mark tiles around allies as currently visible
    for (const a of this.host.allies) {
      if (!a.alive) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = a.tileX + dx;
          const ny = a.tileY + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            this.currentlyVisible[ny][nx] = true;
            this.visited[ny][nx] = true;
          }
        }
      }
    }
  }

  // ── Minimap Rendering ──

  /** Get current minimap tile size and origin based on expanded state */
  private getMinimapParams() {
    const { width, height } = this.host.dungeon;
    if (this.minimapExpanded) {
      const t = this.MINIMAP_TILE_LARGE;
      const totalW = width * t;
      const totalH = height * t;
      const mx = Math.floor((GAME_WIDTH - totalW) / 2);
      const my = Math.floor((GAME_HEIGHT - totalH) / 2) - 10;
      return { t, mx, my, totalW, totalH };
    }
    const t = this.MINIMAP_TILE_SMALL;
    const totalW = width * t;
    const totalH = height * t;
    return { t, mx: this.MINIMAP_X_SMALL, my: this.MINIMAP_Y_SMALL, totalW, totalH };
  }

  /** Update the hit zone position/size to match current minimap mode */
  private updateMinimapHitZone() {
    const { mx, my, totalW, totalH } = this.getMinimapParams();
    const pad = 4;
    this.minimapHitZone.setPosition(mx - pad / 2 + totalW / 2, my - pad / 2 + totalH / 2);
    this.minimapHitZone.setSize(totalW + pad, totalH + pad);
  }

  /** Draw minimap terrain and entities onto a graphics object at given position/scale */
  private drawMinimapContent(
    gfx: Phaser.GameObjects.Graphics,
    t: number, mx: number, my: number,
    expanded: boolean
  ) {
    const { width, height, terrain } = this.host.dungeon;
    const minimapFloorColor = this.host.currentTheme.floorColor;
    const dimFloorColor = darkenColor(minimapFloorColor, 0.35);

    // ── Terrain with fog of war ──
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (terrain[y][x] === TerrainType.GROUND) {
          if (this.currentlyVisible[y][x]) {
            // Currently in player's sight — full brightness
            gfx.fillStyle(minimapFloorColor, 0.9);
          } else if (this.visited[y][x]) {
            // Previously explored but out of sight — dim/dark gray
            gfx.fillStyle(dimFloorColor, 0.6);
          } else {
            // Unexplored — completely dark (skip drawing, bg is already black)
            continue;
          }
          gfx.fillRect(mx + x * t, my + y * t, t, t);
        }
      }
    }

    // ── Shop room outline (purple/magenta) ──
    if (this.host.shopRoom && !this.host.shopClosed) {
      const sr = this.host.shopRoom;
      let shopVisible = false;
      for (let sy = sr.y; sy < sr.y + sr.h && !shopVisible; sy++) {
        for (let sx = sr.x; sx < sr.x + sr.w && !shopVisible; sx++) {
          if (this.visited[sy]?.[sx]) shopVisible = true;
        }
      }
      if (shopVisible) {
        // Fill shop room tiles with purple tint
        gfx.fillStyle(0xc026d3, 0.2);
        for (let sy = sr.y; sy < sr.y + sr.h; sy++) {
          for (let sx = sr.x; sx < sr.x + sr.w; sx++) {
            if (this.visited[sy]?.[sx] && this.host.dungeon.terrain[sy]?.[sx] === TerrainType.GROUND) {
              gfx.fillRect(mx + sx * t, my + sy * t, t, t);
            }
          }
        }
        // Magenta border
        gfx.lineStyle(expanded ? 2 : 1, 0xc026d3, 0.8);
        gfx.strokeRect(
          mx + sr.x * t - 1, my + sr.y * t - 1,
          sr.w * t + 2, sr.h * t + 2
        );
      }
    }

    // ── Event room outline (cyan border) ──
    if (this.host.eventRoom && !this.host.eventTriggered) {
      const er = this.host.eventRoom;
      let eventVisible = false;
      for (let ey = er.y; ey < er.y + er.h && !eventVisible; ey++) {
        for (let ex = er.x; ex < er.x + er.w && !eventVisible; ex++) {
          if (this.visited[ey]?.[ex]) eventVisible = true;
        }
      }
      if (eventVisible) {
        gfx.lineStyle(expanded ? 2 : 1, 0x22d3ee, 0.8);
        gfx.strokeRect(
          mx + er.x * t - 1, my + er.y * t - 1,
          er.w * t + 2, er.h * t + 2
        );
      }
    }

    // ── Puzzle room outline (teal fill + border) ──
    if (this.host.puzzleSys.puzzleRoom && !this.host.puzzleSys.puzzleSolved && !this.host.puzzleSys.puzzleFailed) {
      const pr = this.host.puzzleSys.puzzleRoom;
      let puzzleVisible = false;
      for (let py = pr.y; py < pr.y + pr.h && !puzzleVisible; py++) {
        for (let px = pr.x; px < pr.x + pr.w && !puzzleVisible; px++) {
          if (this.visited[py]?.[px]) puzzleVisible = true;
        }
      }
      if (puzzleVisible) {
        // Teal tint on room tiles
        gfx.fillStyle(0x22d3ee, 0.25);
        for (let py = pr.y; py < pr.y + pr.h; py++) {
          for (let px = pr.x; px < pr.x + pr.w; px++) {
            if (this.visited[py]?.[px] && this.host.dungeon.terrain[py]?.[px] === TerrainType.GROUND) {
              gfx.fillRect(mx + px * t, my + py * t, t, t);
            }
          }
        }
        // Teal border
        gfx.lineStyle(expanded ? 2 : 1, 0x22d3ee, 0.9);
        gfx.strokeRect(
          mx + pr.x * t - 1, my + pr.y * t - 1,
          pr.w * t + 2, pr.h * t + 2
        );
      }
    }

    // ── Shrine (purple dot, only if visited and not used) ──
    if (this.host.floorShrine && !this.host.shrineUsed && this.host.shrineTileX >= 0) {
      if (this.visited[this.host.shrineTileY]?.[this.host.shrineTileX]) {
        const shrineColor = this.host.floorShrine.color;
        gfx.fillStyle(shrineColor, 1);
        const shrp = expanded ? 1 : 0;
        gfx.fillRect(
          mx + this.host.shrineTileX * t - shrp, my + this.host.shrineTileY * t - shrp,
          t + shrp * 2, t + shrp * 2
        );
      }
    }

    // ── Secret Room (gold dot, only after discovery) ──
    if (this.host.secretRoomSys.secretRoomDiscovered && this.host.secretRoomSys.secretEffectTile) {
      const srt = this.host.secretRoomSys.secretEffectTile;
      if (this.visited[srt.y]?.[srt.x]) {
        gfx.fillStyle(0xfbbf24, 1);
        const srp = expanded ? 1 : 0;
        gfx.fillRect(
          mx + srt.x * t - srp, my + srt.y * t - srp,
          t + srp * 2, t + srp * 2
        );
      }
    }

    // ── Stairs (blue dot, only if visited) ──
    const { stairsPos } = this.host.dungeon;
    if (this.visited[stairsPos.y]?.[stairsPos.x]) {
      gfx.fillStyle(0x60a5fa, 1);
      const sp = expanded ? 1 : 0;
      gfx.fillRect(
        mx + stairsPos.x * t - sp, my + stairsPos.y * t - sp,
        t + sp * 2, t + sp * 2
      );
    }

    // ── Floor items (yellow dots, only in visited tiles) ──
    gfx.fillStyle(0xfde047, 1);
    for (const fi of this.host.floorItems) {
      if (this.visited[fi.y]?.[fi.x]) {
        gfx.fillRect(mx + fi.x * t, my + fi.y * t, t, t);
      }
    }

    // ── Revealed traps ──
    for (const tr of this.host.trapHazardSys.floorTraps) {
      if (tr.revealed) {
        gfx.fillStyle(tr.trap.hexColor, 1);
        gfx.fillRect(mx + tr.x * t, my + tr.y * t, t, t);
      }
    }

    // ── Hazard tiles (visible in explored areas) ──
    for (const hz of this.host.trapHazardSys.floorHazards) {
      if (this.visited[hz.y]?.[hz.x]) {
        gfx.fillStyle(hz.def.color, 0.8);
        gfx.fillRect(mx + hz.x * t, my + hz.y * t, t, t);
      }
    }

    // ── Enemies (red dots, only currently visible) ──
    for (const e of this.host.enemies) {
      if (e.alive && this.currentlyVisible[e.tileY]?.[e.tileX]) {
        if (e.isBoss) {
          gfx.fillStyle(0xff2222, 1);
          gfx.fillRect(mx + e.tileX * t - 1, my + e.tileY * t - 1, t + 2, t + 2);
        } else {
          gfx.fillStyle(0xef4444, 1);
          gfx.fillRect(mx + e.tileX * t, my + e.tileY * t, t, t);
        }
      }
    }

    // ── Allies (green dots) ──
    gfx.fillStyle(0x4ade80, 1);
    for (const a of this.host.allies) {
      if (a.alive) {
        gfx.fillRect(mx + a.tileX * t, my + a.tileY * t, t, t);
      }
    }

    // ── Player (green dot, slightly larger) ──
    gfx.fillStyle(0x4ade80, 1);
    gfx.fillRect(
      mx + this.host.player.tileX * t - 1,
      my + this.host.player.tileY * t - 1,
      t + 2, t + 2
    );
  }

  // ── Exploration ──

  /** Calculate exploration percentage */
  getExplorationPercent(): number {
    const { width, height, terrain } = this.host.dungeon;
    let totalWalkable = 0;
    let explored = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (terrain[y][x] === TerrainType.GROUND) {
          totalWalkable++;
          if (this.visited[y][x]) explored++;
        }
      }
    }
    return totalWalkable > 0 ? Math.floor((explored / totalWalkable) * 100) : 0;
  }

  // ── Main Update ──

  /** Main minimap update loop — call after each turn/action */
  updateMinimap() {
    if (!this.minimapVisible) return;
    const { width, height } = this.host.dungeon;
    const { t, mx, my, totalW, totalH } = this.getMinimapParams();
    const expanded = this.minimapExpanded;
    const pad = 4;

    // Reveal area around player each update (DarkFloor mutation reduces radius, talent increases)
    // FoggyFloor event: override sight to 2
    const revealTalentBonus = this.host.talentEffects.sightRangeBonus ?? 0;
    const blessingSightReduction = getBlessingEffect(this.host.activeBlessings, "sightReduction");
    const baseSight = this.host.floorEvent?.type === FloorEventType.FoggyFloor
      ? 2
      : (hasMutation(this.host.floorMutations, MutationType.DarkFloor)
        ? getMutationEffect(MutationType.DarkFloor, "sightRadius")
        : 4);
    const revealRadius = Math.max(1, (baseSight + revealTalentBonus) - blessingSightReduction);
    this.revealArea(this.host.player.tileX, this.host.player.tileY, revealRadius);

    // ── Background (themed) ──
    this.minimapBg.clear();
    this.minimapBg.fillStyle(0x000000, expanded ? 0.92 : 0.85);
    this.minimapBg.fillRoundedRect(mx - pad, my - pad, totalW + pad * 2, totalH + pad * 2, 4);

    // ── Border ──
    this.minimapBorder.clear();
    this.minimapBorder.lineStyle(1, expanded ? 0x5566aa : 0x334466, expanded ? 0.9 : 0.6);
    this.minimapBorder.strokeRoundedRect(mx - pad, my - pad, totalW + pad * 2, totalH + pad * 2, 4);

    // ── Draw minimap content ──
    this.minimapGfx.clear();
    this.drawMinimapContent(this.minimapGfx, t, mx, my, expanded);

    // ── Legend + Exploration % ──
    this.updateMinimapLegend(expanded, mx, my, totalW, totalH, pad);

    // ── Exploration percentage text ──
    this.updateExplorationText(mx, my, totalW, totalH, pad);

    // ── Update full map overlay if open ──
    if (this.fullMapOpen) {
      this.drawFullMapOverlay();
    }
  }

  // ── Exploration Text ──

  /** Update exploration percentage text below minimap */
  private updateExplorationText(
    mx: number, my: number,
    totalW: number, totalH: number, pad: number
  ) {
    const scene = this.scene;
    const pct = this.getExplorationPercent();
    const expanded = this.minimapExpanded;

    // Position below minimap (or below legend if expanded)
    let textY = my + totalH + pad + 2;
    if (expanded) {
      // Legend takes extra space in expanded mode
      textY += 30;
    }

    if (!this.explorationText || !this.explorationText.scene) {
      this.explorationText = scene.add.text(0, 0, "", {
        fontSize: "7px", fontFamily: "monospace", color: "#aab0c8",
      }).setScrollFactor(0).setDepth(102);
    }

    if (pct >= 100) {
      this.explorationText.setText("\u2605 FULLY EXPLORED");
      this.explorationText.setColor("#4ade80");
    } else if (pct >= 75) {
      this.explorationText.setText(`\u25C9 Explored: ${pct}%`);
      this.explorationText.setColor("#fbbf24");
    } else if (pct >= 50) {
      this.explorationText.setText(`\u25CE Explored: ${pct}%`);
      this.explorationText.setColor("#60a5fa");
    } else {
      this.explorationText.setText(`Explored: ${pct}%`);
      this.explorationText.setColor("#aab0c8");
    }

    this.explorationText.setPosition(mx + totalW / 2, textY);
    this.explorationText.setOrigin(0.5, 0);
    this.explorationText.setVisible(!expanded); // only show in compact mode; expanded has its own
  }

  // ── Exploration Rewards ──

  /** Check exploration percentage and grant tier rewards when thresholds are crossed */
  checkExplorationRewards() {
    const pct = this.getExplorationPercent() / 100; // 0.0-1.0
    const newTiers = getNewTiers(this.lastExplorationPercent, pct);
    this.lastExplorationPercent = pct;

    for (const tier of newTiers) {
      // Guard against duplicate grants on the same floor
      const key = Math.round(tier.threshold * 100);
      if (this.explorationRewardsGranted.has(key)) continue;
      this.explorationRewardsGranted.add(key);

      // Grant gold
      this.host.gold += tier.goldBonus;

      // Grant EXP and process level-ups
      this.host.totalExp += tier.expBonus;
      const levelResult = processLevelUp(this.host.player.stats, tier.expBonus, this.host.totalExp);
      this.host.totalExp = levelResult.totalExp;
      for (const r of levelResult.results) {
        this.host.showLog(`Level up! Lv.${r.newLevel} HP+${r.hpGain} ATK+${r.atkGain} DEF+${r.defGain}`);
        sfxLevelUp();
      }

      // Play sound
      sfxBuff();

      // Show brief announcement banner
      this.showExplorationRewardBanner(tier);

      // Log message
      this.host.showLog(`${tier.icon} ${tier.label} Bonus! +${tier.goldBonus}G +${tier.expBonus} EXP`);

      // Add to run log
      this.host.runLog.add(
        RunLogEvent.FloorAdvanced,
        `${tier.label} bonus (${Math.round(tier.threshold * 100)}% explored): +${tier.goldBonus}G +${tier.expBonus} EXP`,
        this.host.currentFloor,
        this.host.turnManager.turn,
      );
    }

    if (newTiers.length > 0) {
      this.host.updateHUD();
    }
  }

  /** Show a brief floating banner for an exploration reward */
  private showExplorationRewardBanner(tier: ExplorationTier) {
    const scene = this.scene;
    const label = `${tier.icon} ${tier.label} Bonus!`;
    const detail = `+${tier.goldBonus}G  +${tier.expBonus} EXP`;

    // Background bar
    const bannerBg = scene.add.rectangle(GAME_WIDTH / 2, 100, 220, 36, 0x000000, 0.75)
      .setScrollFactor(0).setDepth(250).setOrigin(0.5);
    bannerBg.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(tier.color).color, 0.9);

    const labelText = scene.add.text(GAME_WIDTH / 2, 93, label, {
      fontSize: "10px", fontFamily: "monospace", fontStyle: "bold",
      color: tier.color, stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(251);

    const detailText = scene.add.text(GAME_WIDTH / 2, 107, detail, {
      fontSize: "8px", fontFamily: "monospace",
      color: "#ffffff", stroke: "#000000", strokeThickness: 1,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(251);

    // Slide in from top and fade out
    bannerBg.setAlpha(0).setY(80);
    labelText.setAlpha(0).setY(73);
    detailText.setAlpha(0).setY(87);

    scene.tweens.add({
      targets: [bannerBg, labelText, detailText],
      y: "+=20",
      alpha: 1,
      duration: 300,
      ease: "Back.easeOut",
      onComplete: () => {
        scene.time.delayedCall(1800, () => {
          if (!bannerBg.active) return; // Guard: objects may be destroyed on scene restart
          scene.tweens.add({
            targets: [bannerBg, labelText, detailText],
            alpha: 0,
            y: "-=10",
            duration: 400,
            ease: "Sine.easeIn",
            onComplete: () => {
              if (bannerBg.active) bannerBg.destroy();
              if (labelText.active) labelText.destroy();
              if (detailText.active) detailText.destroy();
            },
          });
        });
      },
    });
  }

  // ── Legend ──

  private updateMinimapLegend(
    show: boolean, mx: number, my: number,
    totalW: number, totalH: number, pad: number
  ) {
    const scene = this.scene;
    // Clean up old legend texts
    for (const lt of this.minimapLegendTexts) lt.destroy();
    this.minimapLegendTexts = [];

    if (show) {
      // ── Expanded mode: full legend below the map ──
      const legendY = my + totalH + pad + 4;
      const legendStyle: Phaser.Types.GameObjects.Text.TextStyle = {
        fontSize: "8px", fontFamily: "monospace", color: "#aab0c8",
      };
      const entries: { color: string; label: string }[] = [
        { color: "#4ade80", label: "You" },
        { color: "#4ade80", label: "Ally" },
        { color: "#ef4444", label: "Foe" },
        { color: "#fde047", label: "Item" },
        { color: "#60a5fa", label: "Stairs" },
        { color: "#a855f7", label: "Trap" },
      ];

      const entryWidth = 42;
      const cols = 3;
      const rows = Math.ceil(entries.length / cols);
      const gridW = cols * entryWidth;
      const startX = mx + Math.floor((totalW - gridW) / 2);

      for (let i = 0; i < entries.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const ex = startX + col * entryWidth;
        const ey = legendY + row * 12;
        const { color, label } = entries[i];
        const txt = scene.add.text(ex, ey, `\u25CF ${label}`, {
          ...legendStyle, color,
        }).setScrollFactor(0).setDepth(102);
        this.minimapLegendTexts.push(txt);
      }

      // Exploration % in expanded mode (colored by tier)
      const pct = this.getExplorationPercent();
      const pctColor = pct >= 100 ? "#4ade80" : pct >= 75 ? "#fbbf24" : pct >= 50 ? "#60a5fa" : "#aab0c8";
      const pctLabel = pct >= 100 ? "\u2605 FULLY EXPLORED" : pct >= 75 ? `\u25C9 Explored: ${pct}%` : pct >= 50 ? `\u25CE Explored: ${pct}%` : `Explored: ${pct}%`;
      const pctTxt = scene.add.text(
        mx + totalW / 2, legendY + rows * 12 + 2,
        pctLabel,
        { fontSize: "8px", fontFamily: "monospace", color: pctColor, fontStyle: pct >= 100 ? "bold" : "normal" }
      ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(102);
      this.minimapLegendTexts.push(pctTxt);

      // "Tap to close" hint
      const hintTxt = scene.add.text(
        mx + totalW / 2, legendY + rows * 12 + 14,
        "tap map to close",
        { fontSize: "7px", fontFamily: "monospace", color: "#555570" }
      ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(102);
      this.minimapLegendTexts.push(hintTxt);
    } else {
      // ── Compact mode: small colored dots in minimap corner as legend ──
      const dotEntries: { color: number; }[] = [
        { color: 0x4ade80 },  // Player/Ally (green)
        { color: 0xef4444 },  // Enemy (red)
        { color: 0xfde047 },  // Item (yellow)
        { color: 0x60a5fa },  // Stairs (blue)
      ];
      const dotSize = 3;
      const dotGap = 5;
      const dotStartX = mx + totalW - (dotEntries.length * dotGap) + 1;
      const dotY = my + totalH + pad + 1;

      // Use a small text as container for legend dots
      for (let i = 0; i < dotEntries.length; i++) {
        const dx = dotStartX + i * dotGap;
        const colorHex = "#" + dotEntries[i].color.toString(16).padStart(6, "0");
        const dot = scene.add.text(dx, dotY, "\u25CF", {
          fontSize: "5px", fontFamily: "monospace", color: colorHex,
        }).setScrollFactor(0).setDepth(102);
        this.minimapLegendTexts.push(dot);
      }
    }
  }

  // ── Full Map Overlay ──

  /** Open the full-screen map overlay */
  openFullMap() {
    const scene = this.scene;
    if (this.fullMapOpen) return;
    this.fullMapOpen = true;
    if (this.host.domHud) setDomHudInteractive(this.host.domHud, false);

    // Turns are paused via fullMapOpen guard checks on all input handlers

    const overlayDepth = 500;

    // Semi-transparent dark background
    this.fullMapOverlayBg = scene.add.graphics().setScrollFactor(0).setDepth(overlayDepth);
    this.fullMapOverlayBg.fillStyle(0x000000, 0.85);
    this.fullMapOverlayBg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Full map graphics
    this.fullMapGfx = scene.add.graphics().setScrollFactor(0).setDepth(overlayDepth + 1);

    // Draw the full map
    this.drawFullMapOverlay();

    // Title
    const titleTxt = scene.add.text(
      GAME_WIDTH / 2, 12, `${this.host.dungeonDef.name} B${this.host.currentFloor}F`,
      { fontSize: "10px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold" }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(overlayDepth + 2);
    this.fullMapUI.push(titleTxt);

    // Legend at the bottom
    const legendY = GAME_HEIGHT - 40;
    const legendEntries: { color: string; label: string }[] = [
      { color: "#4ade80", label: "Player" },
      { color: "#ef4444", label: "Enemy" },
      { color: "#fde047", label: "Item" },
      { color: "#60a5fa", label: "Stairs" },
    ];
    const legendStartX = GAME_WIDTH / 2 - (legendEntries.length * 45) / 2;
    for (let i = 0; i < legendEntries.length; i++) {
      const { color, label } = legendEntries[i];
      const lt = scene.add.text(
        legendStartX + i * 45, legendY,
        `\u25CF ${label}`,
        { fontSize: "8px", fontFamily: "monospace", color }
      ).setScrollFactor(0).setDepth(overlayDepth + 2);
      this.fullMapUI.push(lt);
    }

    // Exploration % (colored by tier)
    const pct = this.getExplorationPercent();
    const pctColor = pct >= 100 ? "#4ade80" : pct >= 75 ? "#fbbf24" : pct >= 50 ? "#60a5fa" : "#aab0c8";
    const pctLabel = pct >= 100 ? "\u2605 FULLY EXPLORED" : pct >= 75 ? `\u25C9 Explored: ${pct}%` : pct >= 50 ? `\u25CE Explored: ${pct}%` : `Explored: ${pct}%`;
    const pctTxt = scene.add.text(
      GAME_WIDTH / 2, legendY + 14, pctLabel,
      { fontSize: "8px", fontFamily: "monospace", color: pctColor, fontStyle: pct >= 100 ? "bold" : "normal" }
    ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(overlayDepth + 2);
    this.fullMapUI.push(pctTxt);

    // "Tap to close" hint
    const hintTxt = scene.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT - 10,
      "tap anywhere to close",
      { fontSize: "7px", fontFamily: "monospace", color: "#555570" }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(overlayDepth + 2);
    this.fullMapUI.push(hintTxt);

    // Close zone (covers full screen)
    this.fullMapCloseZone = scene.add.zone(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT
    ).setScrollFactor(0).setDepth(overlayDepth + 3).setInteractive();
    this.fullMapCloseZone.on("pointerdown", () => {
      this.closeFullMap();
    });
  }

  /** Draw the full map overlay content */
  private drawFullMapOverlay() {
    if (!this.fullMapGfx) return;
    this.fullMapGfx.clear();

    const { width, height } = this.host.dungeon;
    const t = this.MINIMAP_TILE_FULLMAP; // 4px per tile
    const totalW = width * t;
    const totalH = height * t;
    const mx = Math.floor((GAME_WIDTH - totalW) / 2);
    const my = Math.floor((GAME_HEIGHT - totalH) / 2);

    // Dark background for the map area
    this.fullMapGfx.fillStyle(0x111122, 0.9);
    this.fullMapGfx.fillRoundedRect(mx - 4, my - 4, totalW + 8, totalH + 8, 4);
    this.fullMapGfx.lineStyle(1, 0x5566aa, 0.8);
    this.fullMapGfx.strokeRoundedRect(mx - 4, my - 4, totalW + 8, totalH + 8, 4);

    // Draw content using shared method
    this.drawMinimapContent(this.fullMapGfx, t, mx, my, true);
  }

  /** Close the full-screen map overlay */
  closeFullMap() {
    const scene = this.scene;
    if (!this.fullMapOpen) return;
    this.fullMapOpen = false;
    if (this.host.domHud) setDomHudInteractive(this.host.domHud, true);

    // Turns resume automatically since fullMapOpen guard is cleared

    // Destroy overlay elements
    if (this.fullMapOverlayBg) {
      this.fullMapOverlayBg.destroy();
      this.fullMapOverlayBg = null;
    }
    if (this.fullMapGfx) {
      this.fullMapGfx.destroy();
      this.fullMapGfx = null;
    }
    if (this.fullMapCloseZone) {
      this.fullMapCloseZone.destroy();
      this.fullMapCloseZone = null;
    }
    for (const obj of this.fullMapUI) {
      if (obj && (obj as any).destroy) (obj as any).destroy();
    }
    this.fullMapUI = [];
  }
}
