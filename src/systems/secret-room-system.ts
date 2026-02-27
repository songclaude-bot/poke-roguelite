/**
 * SecretRoomSystem — Extracted from DungeonScene.
 * Manages all secret room logic: wall detection, carving, shimmer hint,
 * discovery, and room-type-specific rewards (treasure, healing, skill, training, warp).
 */
import { GAME_WIDTH, GAME_HEIGHT, TILE_DISPLAY } from "../config";
import { Entity } from "../core/entity";
import { SkillEffect, SKILL_DB, createSkill } from "../core/skill";
import { ItemDef, ItemStack, ITEM_DB, MAX_INVENTORY } from "../core/item";
import { DungeonData, TerrainType } from "../core/dungeon-generator";
import { DungeonDef } from "../core/dungeon-data";
import { SecretRoomType, SecretRoom } from "../core/secret-rooms";
import { processLevelUp } from "../core/leveling";
import { RunLog, RunLogEvent } from "../core/run-log";
import { DungeonModifier } from "../core/dungeon-modifiers";
import { Relic } from "../core/relics";
import { ScoreChain } from "../core/score-chain";
import {
  sfxPickup, sfxHit, sfxHeal, sfxSkill, sfxLevelUp, sfxStairs,
} from "../core/sound-manager";

// ── Host interface: what SecretRoomSystem needs from DungeonScene ──

export interface SecretRoomHost {
  // Phaser Scene API (for add, tweens, time, cameras)
  scene: Phaser.Scene;

  // Read-only game state
  readonly player: Entity;
  readonly currentFloor: number;
  readonly dungeonDef: DungeonDef;
  readonly dungeon: DungeonData;
  readonly turnManager: { turn: number };
  readonly runLog: RunLog;
  readonly scoreChain: ScoreChain;

  // Mutable shared state
  gold: number;
  totalExp: number;
  inventory: ItemStack[];
  belly: number;
  gameOver: boolean;
  allies: Entity[];
  floorItems: { x: number; y: number; item: ItemDef; sprite: Phaser.GameObjects.Text }[];
  themeOverlay: Phaser.GameObjects.Graphics | null;
  currentTheme: { floorColor: number };
  visited: boolean[][];
  currentlyVisible: boolean[][];
  starterId: string;
  challengeMode: string | null;
  activeModifiers: DungeonModifier[];
  legendaryEncountered: boolean;
  questItemsCollected: number;
  questItemsUsed: boolean;
  activeRelics: Relic[];
  runElapsedSeconds: number;

  // Callbacks (delegate back to DungeonScene)
  showLog(msg: string): void;
  updateHUD(): void;
  stopAutoExplore(): void;
  showDamagePopup(x: number, y: number, amount: number, alpha: number, text?: string): void;
  serializeAllies(): unknown;
}

// ── SecretRoomSystem class ──

export class SecretRoomSystem {
  // ── Secret-room-specific state (moved from DungeonScene) ──
  secretRoomData: SecretRoom | null = null;
  secretWallPos: { x: number; y: number } | null = null;
  private secretRoomTiles: { x: number; y: number }[] = [];
  secretEffectTile: { x: number; y: number } | null = null;
  secretRoomDiscovered = false;
  secretRoomUsed = false;
  private secretRoomGraphics: Phaser.GameObjects.Graphics[] = [];
  private secretWallShimmerTimer: Phaser.Time.TimerEvent | null = null;
  private secretWallShimmerGfx: Phaser.GameObjects.Graphics | null = null;
  private secretRoomUI: Phaser.GameObjects.GameObject[] = [];
  secretWarpOpen = false;

  constructor(private host: SecretRoomHost) {}

  /** Reset all secret room state for a new floor */
  reset() {
    this.secretRoomData = null;
    this.secretWallPos = null;
    this.secretRoomTiles = [];
    this.secretEffectTile = null;
    this.secretRoomDiscovered = false;
    this.secretRoomUsed = false;
    this.secretRoomGraphics = [];
    this.secretWallShimmerTimer = null;
    this.secretWallShimmerGfx = null;
    this.secretRoomUI = [];
    this.secretWarpOpen = false;
  }

  // ── Dungeon Generation Helpers ──

  /**
   * Find a suitable wall tile adjacent to a corridor that can host a secret entrance.
   * The wall must have enough space behind it (3x3 area that is currently all walls).
   * Returns the wall position and the direction into the wall (for carving the room).
   */
  findSecretWallPosition(
    terrain: TerrainType[][],
    rooms: { x: number; y: number; w: number; h: number }[],
    mapW: number, mapH: number,
    playerStart: { x: number; y: number },
    stairsPos: { x: number; y: number },
  ): { wall: { x: number; y: number }; insideDir: { dx: number; dy: number } } | null {
    // Build a set of room interior tiles (to avoid placing inside existing rooms)
    const roomTileSet = new Set<string>();
    for (const r of rooms) {
      for (let ry = r.y; ry < r.y + r.h; ry++) {
        for (let rx = r.x; rx < r.x + r.w; rx++) {
          roomTileSet.add(`${rx},${ry}`);
        }
      }
    }

    // Candidate walls: wall tiles adjacent to at least one ground tile (corridor or room edge)
    const candidates: { wall: { x: number; y: number }; insideDir: { dx: number; dy: number } }[] = [];
    const dirs = [
      { dx: 0, dy: -1 }, // north
      { dx: 0, dy: 1 },  // south
      { dx: -1, dy: 0 }, // west
      { dx: 1, dy: 0 },  // east
    ];

    for (let y = 2; y < mapH - 5; y++) {
      for (let x = 2; x < mapW - 5; x++) {
        if (terrain[y][x] !== TerrainType.WALL) continue;
        // Skip if too close to player start or stairs
        const distPlayer = Math.abs(x - playerStart.x) + Math.abs(y - playerStart.y);
        const distStairs = Math.abs(x - stairsPos.x) + Math.abs(y - stairsPos.y);
        if (distPlayer < 4 || distStairs < 4) continue;

        for (const d of dirs) {
          const adjX = x + d.dx;
          const adjY = y + d.dy;
          if (adjX < 0 || adjX >= mapW || adjY < 0 || adjY >= mapH) continue;
          if (terrain[adjY][adjX] !== TerrainType.GROUND) continue;

          // The "inside" direction is opposite to the corridor side
          const insideDx = -d.dx;
          const insideDy = -d.dy;

          // Check if a 3x3 area behind this wall (in insideDir) is all walls
          const behindX = x + insideDx;
          const behindY = y + insideDy;
          let valid = true;

          // Check a 3x3 region centered on behindX,behindY
          for (let dy2 = -1; dy2 <= 1; dy2++) {
            for (let dx2 = -1; dx2 <= 1; dx2++) {
              const cx = behindX + dx2;
              const cy = behindY + dy2;
              if (cx < 1 || cx >= mapW - 1 || cy < 1 || cy >= mapH - 1) { valid = false; break; }
              if (terrain[cy][cx] !== TerrainType.WALL) { valid = false; break; }
              if (roomTileSet.has(`${cx},${cy}`)) { valid = false; break; }
            }
            if (!valid) break;
          }

          // Also check a 1-tile buffer around the 3x3 to avoid bleeding into corridors
          if (valid) {
            for (let dy2 = -2; dy2 <= 2; dy2++) {
              for (let dx2 = -2; dx2 <= 2; dx2++) {
                // Skip the inner 3x3, only check the border ring
                if (Math.abs(dy2) <= 1 && Math.abs(dx2) <= 1) continue;
                const cx = behindX + dx2;
                const cy = behindY + dy2;
                if (cx < 0 || cx >= mapW || cy < 0 || cy >= mapH) { valid = false; break; }
                // Buffer tiles should be walls (to prevent merging with other rooms)
                if (terrain[cy][cx] !== TerrainType.WALL) { valid = false; break; }
              }
              if (!valid) break;
            }
          }

          if (valid) {
            candidates.push({ wall: { x, y }, insideDir: { dx: insideDx, dy: insideDy } });
          }
        }
      }
    }

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * Carve a 3x3 secret room behind the secret wall tile.
   * Returns the list of ground tiles created (excluding the wall tile itself).
   */
  carveSecretRoom(
    wallPos: { x: number; y: number },
    insideDir: { dx: number; dy: number },
    terrain: TerrainType[][],
    mapW: number, mapH: number,
  ): { x: number; y: number }[] {
    const tiles: { x: number; y: number }[] = [];
    const behindX = wallPos.x + insideDir.dx;
    const behindY = wallPos.y + insideDir.dy;

    // Carve a 3x3 room centered on (behindX, behindY)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = behindX + dx;
        const ty = behindY + dy;
        if (tx < 1 || tx >= mapW - 1 || ty < 1 || ty >= mapH - 1) continue;
        terrain[ty][tx] = TerrainType.GROUND;
        tiles.push({ x: tx, y: ty });
      }
    }

    // Store internally for use by drawSecretRoomEffectTile and tryOpenSecretWall
    this.secretRoomTiles = tiles;
    return tiles;
  }

  /**
   * Start a subtle shimmer animation on the secret wall tile (hint for players).
   * Every 3 seconds, the wall flickers briefly.
   */
  startSecretWallShimmer() {
    if (!this.secretWallPos) return;
    const scene = this.host.scene;

    this.secretWallShimmerGfx = scene.add.graphics().setDepth(3);

    this.secretWallShimmerTimer = scene.time.addEvent({
      delay: 3000,
      loop: true,
      callback: () => {
        if (!this.secretWallPos || this.secretRoomDiscovered) {
          if (this.secretWallShimmerTimer) {
            this.secretWallShimmerTimer.destroy();
            this.secretWallShimmerTimer = null;
          }
          if (this.secretWallShimmerGfx) {
            this.secretWallShimmerGfx.destroy();
            this.secretWallShimmerGfx = null;
          }
          return;
        }

        // Only shimmer if tile is currently visible or visited
        const wx = this.secretWallPos.x;
        const wy = this.secretWallPos.y;
        if (!this.host.currentlyVisible[wy]?.[wx] && !this.host.visited[wy]?.[wx]) return;

        // Brief alpha twitch
        const gfx = this.secretWallShimmerGfx!;
        gfx.clear();
        gfx.fillStyle(0xfbbf24, 0.3);
        gfx.fillRect(
          wx * TILE_DISPLAY + 2, wy * TILE_DISPLAY + 2,
          TILE_DISPLAY - 4, TILE_DISPLAY - 4,
        );

        // Fade out after 200ms
        scene.time.delayedCall(200, () => {
          if (gfx && gfx.scene) gfx.clear();
        });
      },
    });
  }

  // ── Secret Wall Opening ──

  /**
   * Check if the player is walking into a secret wall tile and open it.
   * Returns true if the wall was opened (so player can move there).
   */
  tryOpenSecretWall(targetX: number, targetY: number): boolean {
    if (!this.secretWallPos || this.secretRoomDiscovered) return false;
    if (targetX !== this.secretWallPos.x || targetY !== this.secretWallPos.y) return false;

    const host = this.host;
    const scene = host.scene;

    // Open the secret wall -- change it to ground
    host.dungeon.terrain[targetY][targetX] = TerrainType.GROUND;
    this.secretRoomDiscovered = true;
    // Run log: secret room found
    host.runLog.add(RunLogEvent.SecretRoomFound, this.secretRoomData?.type ?? "Secret Room", host.currentFloor, host.turnManager.turn);

    // Stop shimmer
    if (this.secretWallShimmerTimer) {
      this.secretWallShimmerTimer.destroy();
      this.secretWallShimmerTimer = null;
    }
    if (this.secretWallShimmerGfx) {
      this.secretWallShimmerGfx.destroy();
      this.secretWallShimmerGfx = null;
    }

    // Visual: update the theme overlay for newly carved tiles
    if (host.themeOverlay) {
      // Draw ground overlay on the wall tile + secret room tiles
      const allNewTiles = [{ x: targetX, y: targetY }, ...this.secretRoomTiles];
      for (const tile of allNewTiles) {
        host.themeOverlay.fillStyle(host.currentTheme.floorColor, 0.18);
        host.themeOverlay.fillRect(
          tile.x * TILE_DISPLAY, tile.y * TILE_DISPLAY,
          TILE_DISPLAY, TILE_DISPLAY,
        );
      }
    }

    // Camera shake for dramatic reveal
    scene.cameras.main.shake(200, 0.005);

    // Sound effect
    sfxPickup();

    // Show announcement
    this.showSecretRoomAnnouncement();

    // Draw room effect tile graphics
    this.drawSecretRoomEffectTile();

    // Mark secret room data as discovered
    if (this.secretRoomData) {
      this.secretRoomData.discovered = true;
    }

    return true;
  }

  // ── Announcement ──

  /**
   * Show a prominent "You found a Secret Room!" announcement with gold sparkle.
   */
  private showSecretRoomAnnouncement() {
    if (!this.secretRoomData) return;
    const scene = this.host.scene;

    const typeLabel = this.secretRoomData.name;
    this.host.showLog(`You found a Secret Room! (${typeLabel})`);

    // Create a centered gold announcement text
    const announce = scene.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40,
      `Secret Room Found!\n${typeLabel}`,
      {
        fontSize: "14px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
        stroke: "#000000", strokeThickness: 3, align: "center",
        backgroundColor: "#1a1a2ecc", padding: { x: 12, y: 8 },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(150);

    // Sparkle particles around announcement
    const sparkleGfx = scene.add.graphics().setScrollFactor(0).setDepth(149);
    for (let i = 0; i < 8; i++) {
      const sx = GAME_WIDTH / 2 + (Math.random() - 0.5) * 120;
      const sy = GAME_HEIGHT / 2 - 40 + (Math.random() - 0.5) * 60;
      sparkleGfx.fillStyle(0xfbbf24, 0.8);
      sparkleGfx.fillCircle(sx, sy, 2 + Math.random() * 2);
    }

    // Fade out after 2 seconds
    scene.tweens.add({
      targets: announce,
      alpha: 0,
      duration: 500,
      delay: 1800,
      onComplete: () => {
        announce.destroy();
        sparkleGfx.destroy();
      },
    });

    scene.tweens.add({
      targets: sparkleGfx,
      alpha: 0,
      duration: 500,
      delay: 1800,
    });
  }

  // ── Effect Tile Drawing ──

  /**
   * Draw the effect tile graphic in the center of the secret room based on type.
   */
  private drawSecretRoomEffectTile() {
    if (!this.secretEffectTile || !this.secretRoomData) return;
    const scene = this.host.scene;
    const host = this.host;

    const tx = this.secretEffectTile.x;
    const ty = this.secretEffectTile.y;
    const px = tx * TILE_DISPLAY;
    const py = ty * TILE_DISPLAY;

    const gfx = scene.add.graphics().setDepth(4);

    switch (this.secretRoomData.type) {
      case SecretRoomType.TreasureVault: {
        // Gold carpet + item sprites placed as floor items
        gfx.fillStyle(0xfbbf24, 0.15);
        for (const tile of this.secretRoomTiles) {
          gfx.fillRect(tile.x * TILE_DISPLAY, tile.y * TILE_DISPLAY, TILE_DISPLAY, TILE_DISPLAY);
        }
        // Place items on the secret room tiles
        if (this.secretRoomData.reward.items) {
          const items = this.secretRoomData.reward.items;
          const placementTiles = this.secretRoomTiles.filter(
            t => !(t.x === this.secretEffectTile!.x && t.y === this.secretEffectTile!.y)
          );
          for (let i = 0; i < items.length && i < placementTiles.length; i++) {
            const itemId = items[i];
            const itemDef = ITEM_DB[itemId];
            if (!itemDef) continue;
            const pt = placementTiles[i];
            const sprite = scene.add.text(
              pt.x * TILE_DISPLAY + TILE_DISPLAY / 2,
              pt.y * TILE_DISPLAY + TILE_DISPLAY / 2,
              "\u2605", { fontSize: "14px", color: "#fde047" }
            ).setOrigin(0.5).setDepth(6);
            host.floorItems.push({ x: pt.x, y: pt.y, item: itemDef, sprite });
          }
        }
        // Gold text at center
        if (this.secretRoomData.reward.gold) {
          const goldText = scene.add.text(
            px + TILE_DISPLAY / 2, py + TILE_DISPLAY / 2,
            `${this.secretRoomData.reward.gold}G`,
            { fontSize: "10px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
              stroke: "#000000", strokeThickness: 2 }
          ).setOrigin(0.5).setDepth(7);
          this.secretRoomGraphics.push(goldText as unknown as Phaser.GameObjects.Graphics);
        }
        break;
      }

      case SecretRoomType.HealingSpring: {
        // Blue glowing center tile
        gfx.fillStyle(0x60a5fa, 0.35);
        gfx.fillRect(px + 4, py + 4, TILE_DISPLAY - 8, TILE_DISPLAY - 8);
        // Pulsing blue glow
        scene.tweens.add({
          targets: gfx,
          alpha: { from: 1, to: 0.5 },
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
        // Label
        const healLabel = scene.add.text(
          px + TILE_DISPLAY / 2, py - 6,
          "Spring", { fontSize: "7px", color: "#60a5fa", fontFamily: "monospace",
            stroke: "#000000", strokeThickness: 2 }
        ).setOrigin(0.5).setDepth(7);
        this.secretRoomGraphics.push(healLabel as unknown as Phaser.GameObjects.Graphics);
        break;
      }

      case SecretRoomType.SkillShrine: {
        // Purple glowing tile
        gfx.fillStyle(0xa855f7, 0.35);
        gfx.fillRect(px + 4, py + 4, TILE_DISPLAY - 8, TILE_DISPLAY - 8);
        scene.tweens.add({
          targets: gfx,
          alpha: { from: 1, to: 0.5 },
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
        const shrineLabel = scene.add.text(
          px + TILE_DISPLAY / 2, py - 6,
          "Shrine", { fontSize: "7px", color: "#a855f7", fontFamily: "monospace",
            stroke: "#000000", strokeThickness: 2 }
        ).setOrigin(0.5).setDepth(7);
        this.secretRoomGraphics.push(shrineLabel as unknown as Phaser.GameObjects.Graphics);
        break;
      }

      case SecretRoomType.TrainingRoom: {
        // Orange tile
        gfx.fillStyle(0xf59e0b, 0.35);
        gfx.fillRect(px + 4, py + 4, TILE_DISPLAY - 8, TILE_DISPLAY - 8);
        scene.tweens.add({
          targets: gfx,
          alpha: { from: 1, to: 0.5 },
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
        const trainLabel = scene.add.text(
          px + TILE_DISPLAY / 2, py - 6,
          "Training", { fontSize: "7px", color: "#f59e0b", fontFamily: "monospace",
            stroke: "#000000", strokeThickness: 2 }
        ).setOrigin(0.5).setDepth(7);
        this.secretRoomGraphics.push(trainLabel as unknown as Phaser.GameObjects.Graphics);
        break;
      }

      case SecretRoomType.WarpHub: {
        // Swirling portal (teal/cyan)
        gfx.fillStyle(0x22d3ee, 0.4);
        gfx.fillCircle(px + TILE_DISPLAY / 2, py + TILE_DISPLAY / 2, TILE_DISPLAY / 3);
        gfx.lineStyle(2, 0x22d3ee, 0.6);
        gfx.strokeCircle(px + TILE_DISPLAY / 2, py + TILE_DISPLAY / 2, TILE_DISPLAY / 3 + 4);
        scene.tweens.add({
          targets: gfx,
          angle: { from: 0, to: 360 },
          duration: 3000,
          repeat: -1,
          ease: "Linear",
        });
        const warpLabel = scene.add.text(
          px + TILE_DISPLAY / 2, py - 6,
          "Warp", { fontSize: "7px", color: "#22d3ee", fontFamily: "monospace",
            stroke: "#000000", strokeThickness: 2 }
        ).setOrigin(0.5).setDepth(7);
        this.secretRoomGraphics.push(warpLabel as unknown as Phaser.GameObjects.Graphics);
        break;
      }
    }

    this.secretRoomGraphics.push(gfx);
  }

  // ── Room Check (Player Step) ──

  /**
   * Check if the player is standing on the secret room effect tile and apply the reward.
   */
  checkSecretRoom() {
    if (!this.secretRoomData || !this.secretRoomDiscovered || this.secretRoomUsed) return;
    if (!this.secretEffectTile) return;
    if (this.secretWarpOpen) return; // warp overlay already open

    const px = this.host.player.tileX;
    const py = this.host.player.tileY;
    const ex = this.secretEffectTile.x;
    const ey = this.secretEffectTile.y;

    // For TreasureVault, collect gold when stepping on center tile
    if (this.secretRoomData.type === SecretRoomType.TreasureVault) {
      if (px === ex && py === ey) {
        this.applySecretRewardTreasure();
      }
      return;
    }

    // For other types, stepping on the effect tile triggers the reward
    if (px !== ex || py !== ey) return;

    switch (this.secretRoomData.type) {
      case SecretRoomType.HealingSpring:
        this.applySecretRewardHealing();
        break;
      case SecretRoomType.SkillShrine:
        this.applySecretRewardSkill();
        break;
      case SecretRoomType.TrainingRoom:
        this.applySecretRewardTraining();
        break;
      case SecretRoomType.WarpHub:
        this.showWarpHubOverlay();
        break;
    }
  }

  // ── Reward Application ──

  /** TreasureVault: collect gold from center tile */
  private applySecretRewardTreasure() {
    if (!this.secretRoomData?.reward.gold) return;
    this.secretRoomUsed = true;
    const goldAmount = this.secretRoomData.reward.gold;
    this.host.gold += goldAmount;
    sfxPickup();
    this.host.showLog(`Collected ${goldAmount} Gold from the Treasure Vault!`);

    // Flash gold text popup
    if (this.host.player.sprite) {
      this.host.showDamagePopup(
        this.host.player.sprite.x, this.host.player.sprite.y - 10,
        0, 1, `+${goldAmount}G`
      );
    }
    this.host.updateHUD();
  }

  /** HealingSpring: full HP/PP restore + AtkUp+DefUp buff for 10 turns */
  private applySecretRewardHealing() {
    this.secretRoomUsed = true;
    sfxHeal();

    const player = this.host.player;

    // Full HP restore
    player.stats.hp = player.stats.maxHp;

    // Full PP restore for all skills
    for (const sk of player.skills) {
      sk.currentPp = sk.pp;
    }

    // Temporary AtkUp + DefUp buff
    const buffTurns = this.secretRoomData?.reward.buffTurns ?? 10;
    if (!player.statusEffects.some(s => s.type === SkillEffect.AtkUp)) {
      player.statusEffects.push({ type: SkillEffect.AtkUp, turnsLeft: buffTurns });
    }
    if (!player.statusEffects.some(s => s.type === SkillEffect.DefUp)) {
      player.statusEffects.push({ type: SkillEffect.DefUp, turnsLeft: buffTurns });
    }

    this.host.showLog("The Healing Spring fully restores your HP and PP!");
    this.host.showLog("ATK and DEF boosted for 10 turns!");

    // Heal allies too
    for (const ally of this.host.allies) {
      if (ally.alive) {
        ally.stats.hp = ally.stats.maxHp;
        for (const sk of ally.skills) {
          sk.currentPp = sk.pp;
        }
      }
    }

    this.host.updateHUD();
  }

  /** SkillShrine: learn a random rare skill (replace weakest skill if 4 skills already) */
  private applySecretRewardSkill() {
    this.secretRoomUsed = true;
    const skillId = this.secretRoomData?.reward.skillId;
    if (!skillId || !SKILL_DB[skillId]) {
      this.host.showLog("The shrine is empty...");
      return;
    }

    sfxSkill();
    const template = SKILL_DB[skillId];
    const newSkill = createSkill(template);
    const player = this.host.player;

    if (player.skills.length < 4) {
      // Has room -- just add
      player.skills.push(newSkill);
      this.host.showLog(`Learned ${newSkill.name} from the Skill Shrine!`);
    } else {
      // Replace the lowest-power skill
      let weakestIdx = 0;
      let weakestPower = Infinity;
      for (let i = 0; i < player.skills.length; i++) {
        if (player.skills[i].power < weakestPower) {
          weakestPower = player.skills[i].power;
          weakestIdx = i;
        }
      }
      const replaced = player.skills[weakestIdx];
      player.skills[weakestIdx] = newSkill;
      this.host.showLog(`Learned ${newSkill.name}! (Replaced ${replaced.name})`);
    }

    this.host.updateHUD();
  }

  /** TrainingRoom: grant 2 level-ups worth of EXP */
  private applySecretRewardTraining() {
    this.secretRoomUsed = true;
    const expGain = this.secretRoomData?.reward.exp ?? 100;
    sfxLevelUp();

    this.host.totalExp += expGain;
    this.host.showLog(`Gained ${expGain} EXP from the Training Room!`);

    // Process level ups
    const { results } = processLevelUp(this.host.player.stats, 0, this.host.totalExp);
    for (const r of results) {
      this.host.showLog(`Level Up! Lv${r.newLevel}! HP+${r.hpGain} ATK+${r.atkGain} DEF+${r.defGain}`);
    }

    if (this.host.player.sprite) {
      this.host.showDamagePopup(
        this.host.player.sprite.x, this.host.player.sprite.y - 10,
        0, 1, `+${expGain} EXP`
      );
    }

    this.host.updateHUD();
  }

  // ── Warp Hub ──

  /**
   * Show WarpHub floor selection overlay.
   * Allows the player to choose any floor from 1 to currentFloor - 1.
   */
  private showWarpHubOverlay() {
    const host = this.host;
    const scene = host.scene;

    if (this.secretWarpOpen || host.currentFloor <= 1) {
      host.showLog("The portal flickers but has nowhere to send you...");
      this.secretRoomUsed = true;
      return;
    }

    this.secretWarpOpen = true;
    host.stopAutoExplore();

    // Dim overlay
    const overlay = scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.75
    ).setScrollFactor(0).setDepth(200).setInteractive();
    this.secretRoomUI.push(overlay);

    // Title
    const title = scene.add.text(GAME_WIDTH / 2, 60, "Warp Hub", {
      fontSize: "16px", color: "#22d3ee", fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.secretRoomUI.push(title);

    const subtitle = scene.add.text(GAME_WIDTH / 2, 85, "Choose a floor to warp to:", {
      fontSize: "10px", color: "#aab0c8", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.secretRoomUI.push(subtitle);

    // Floor buttons (scrollable list of floors 1 to currentFloor - 1)
    const maxFloor = host.currentFloor - 1;
    const buttonsPerRow = 4;
    const btnW = 60;
    const btnH = 28;
    const gap = 6;
    const startY = 110;

    for (let f = 1; f <= maxFloor; f++) {
      const row = Math.floor((f - 1) / buttonsPerRow);
      const col = (f - 1) % buttonsPerRow;
      const bx = GAME_WIDTH / 2 - ((Math.min(maxFloor, buttonsPerRow) * (btnW + gap) - gap) / 2) + col * (btnW + gap) + btnW / 2;
      const by = startY + row * (btnH + gap);

      // Only show if it fits on screen
      if (by > GAME_HEIGHT - 100) continue;

      const btn = scene.add.text(bx, by, `B${f}F`, {
        fontSize: "11px", color: "#e0e0e0", fontFamily: "monospace", fontStyle: "bold",
        backgroundColor: "#334466", padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });

      btn.on("pointerover", () => btn.setColor("#22d3ee"));
      btn.on("pointerout", () => btn.setColor("#e0e0e0"));
      btn.on("pointerdown", () => {
        this.executeWarp(f);
      });

      this.secretRoomUI.push(btn);
    }

    // Cancel button
    const cancelBtn = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 60, "Cancel", {
      fontSize: "12px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
      backgroundColor: "#1a1a2ecc", padding: { x: 16, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });

    cancelBtn.on("pointerover", () => cancelBtn.setColor("#ff7777"));
    cancelBtn.on("pointerout", () => cancelBtn.setColor("#ef4444"));
    cancelBtn.on("pointerdown", () => {
      this.closeWarpHubOverlay();
    });

    this.secretRoomUI.push(cancelBtn);
  }

  /**
   * Execute the warp to a chosen floor.
   */
  private executeWarp(targetFloor: number) {
    this.closeWarpHubOverlay();
    this.secretRoomUsed = true;
    const host = this.host;
    const scene = host.scene;

    sfxStairs();
    host.showLog(`Warped to B${targetFloor}F!`);

    host.gameOver = true;

    // Pass modifier IDs through floor transitions
    const modifierIds = host.activeModifiers.length > 0 ? host.activeModifiers.map(m => m.id) : undefined;

    scene.cameras.main.fadeOut(500, 0, 0, 0);
    scene.time.delayedCall(600, () => {
      (scene as any).scene.restart({
        floor: targetFloor,
        hp: host.player.stats.hp,
        maxHp: host.player.stats.maxHp,
        skills: host.player.skills,
        inventory: host.inventory,
        level: host.player.stats.level,
        atk: host.player.stats.atk,
        def: host.player.stats.def,
        exp: host.totalExp,
        dungeonId: host.dungeonDef.id,
        allies: host.serializeAllies(),
        belly: host.belly,
        starter: host.starterId,
        challengeMode: host.challengeMode ?? undefined,
        modifiers: modifierIds,
        runElapsedTime: host.runElapsedSeconds,
        scoreChain: host.scoreChain,
        legendaryEncountered: host.legendaryEncountered,
        questItemsCollected: host.questItemsCollected,
        questItemsUsed: host.questItemsUsed,
        relics: host.activeRelics,
        runLogEntries: host.runLog.serialize(),
      });
    });
  }

  /**
   * Close the WarpHub overlay.
   */
  private closeWarpHubOverlay() {
    this.secretWarpOpen = false;
    for (const obj of this.secretRoomUI) {
      if (obj && (obj as Phaser.GameObjects.GameObject).scene) {
        obj.destroy();
      }
    }
    this.secretRoomUI = [];
  }
}
