/**
 * AutoExploreSystem — Extracted from DungeonScene.
 * Manages all auto-explore logic: BFS pathfinding, step loop,
 * stop condition checking, and UI indicator.
 */
import { GAME_WIDTH } from "../config";
import { Direction, DIR_DX, DIR_DY } from "../core/direction";
import { Entity, chebyshevDist } from "../core/entity";
import { ItemDef } from "../core/item";
import { DungeonData, TerrainType } from "../core/dungeon-generator";
import { TurnManager } from "../core/turn-manager";
import { PuzzleSystem } from "./puzzle-system";
import { TrapHazardSystem } from "./trap-hazard-system";

// ── Host interface: what AutoExploreSystem needs from DungeonScene ──

export interface AutoExploreHost {
  // Phaser Scene API (for add, tweens, time, input)
  scene: Phaser.Scene;

  // Read-only game state
  readonly player: Entity;
  readonly enemies: Entity[];
  readonly allEntities: Entity[];
  readonly dungeon: DungeonData;
  readonly visited: boolean[][];
  readonly turnManager: TurnManager;
  readonly gameOver: boolean;
  readonly floorItems: { x: number; y: number; item: ItemDef; sprite: Phaser.GameObjects.Text }[];
  readonly puzzleSys: PuzzleSystem;
  readonly trapHazardSys: TrapHazardSystem;

  // UI guard flags (read-only for stop-condition checks)
  readonly bagOpen: boolean;
  readonly menuOpen: boolean;
  readonly settingsOpen: boolean;
  readonly shopOpen: boolean;
  readonly teamPanelOpen: boolean;
  readonly eventOpen: boolean;
  readonly fullMapOpen: boolean;
  readonly relicOverlayOpen: boolean;
  readonly shrineOpen: boolean;

  // Callbacks (delegate back to DungeonScene)
  showLog(msg: string): void;
  updateHUD(): void;
  canEntityMove(entity: Entity, dir: Direction): boolean;
  moveEntity(entity: Entity, dir: Direction): Promise<void>;
  recoverPP(entity: Entity): void;
  checkShop(): void;
  checkMonsterHouse(): void;
  checkEventRoom(): void;
  checkShrine(): void;
  tickBelly(): void;
  tickWeather(): void;
  tickEntityStatus(entity: Entity): void;
  checkExplorationRewards(): void;
  showGameOver(): void;
  getAllyActions(): (() => Promise<void>)[];
  getEnemyActions(): (() => Promise<void>)[];
}

// ── AutoExploreSystem class ──

export class AutoExploreSystem {
  // ── Auto-explore state (moved from DungeonScene) ──
  autoExploring = false;
  private autoExploreTimer: Phaser.Time.TimerEvent | null = null;
  private autoExploreText: Phaser.GameObjects.Text | null = null;
  private autoExploreTween: Phaser.Tweens.Tween | null = null;

  constructor(private host: AutoExploreHost) {}

  /** Reset all auto-explore state for a new floor */
  reset() {
    this.autoExploring = false;
    this.autoExploreTimer = null;
    this.autoExploreText = null;
    this.autoExploreTween = null;
  }

  /**
   * BFS to find direction toward the nearest unexplored (not-yet-visited) floor tile.
   * Returns the Direction the player should take as the first step, or null if none reachable.
   */
  private autoExploreBFS(): Direction | null {
    const { width, height, terrain } = this.host.dungeon;
    const px = this.host.player.tileX;
    const py = this.host.player.tileY;

    // BFS from player position
    const dist: number[][] = Array.from({ length: height }, () => new Array(width).fill(-1));
    const parent: { dx: number; dy: number }[][] = Array.from(
      { length: height }, () => new Array(width).fill(null)
    );
    dist[py][px] = 0;

    // BFS queue: [x, y]
    const queue: [number, number][] = [[px, py]];
    let head = 0;

    // 8 directions: prefer cardinal first for more natural corridor movement
    const bfsDirs: { dx: number; dy: number }[] = [
      { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
      { dx: 1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 },
    ];

    while (head < queue.length) {
      const [cx, cy] = queue[head++];

      for (const d of bfsDirs) {
        const nx = cx + d.dx;
        const ny = cy + d.dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        if (dist[ny][nx] !== -1) continue;
        if (terrain[ny][nx] !== TerrainType.GROUND) continue;

        // For diagonal moves, check both adjacent cardinals are ground (wall-clip prevention)
        if (d.dx !== 0 && d.dy !== 0) {
          if (terrain[cy][cx + d.dx] !== TerrainType.GROUND) continue;
          if (terrain[cy + d.dy][cx] !== TerrainType.GROUND) continue;
        }

        dist[ny][nx] = dist[cy][cx] + 1;
        parent[ny][nx] = { dx: d.dx, dy: d.dy };

        // Found an unexplored tile — trace back to find first step
        if (!this.host.visited[ny][nx]) {
          return this.traceAutoExplorePath(px, py, nx, ny, parent);
        }

        // Don't BFS through tiles occupied by enemies (but still explore past them)
        const blocked = this.host.allEntities.some(
          e => e !== this.host.player && e.alive && e.tileX === nx && e.tileY === ny
        );
        if (!blocked) {
          queue.push([nx, ny]);
        }
      }
    }

    return null; // No reachable unexplored tiles
  }

  /** Trace the BFS parent chain back to get the direction for the first step from player */
  private traceAutoExplorePath(
    startX: number, startY: number,
    goalX: number, goalY: number,
    parentMap: { dx: number; dy: number }[][]
  ): Direction | null {
    let cx = goalX;
    let cy = goalY;

    // Walk backward from goal to start
    while (true) {
      const p = parentMap[cy][cx];
      if (!p) return null;
      const prevX = cx - p.dx;
      const prevY = cy - p.dy;
      if (prevX === startX && prevY === startY) {
        // p.dx, p.dy is the step from start — this is our direction
        return this.dxdyToDirection(p.dx, p.dy);
      }
      cx = prevX;
      cy = prevY;
    }
  }

  /** Convert dx,dy offset to Direction enum */
  private dxdyToDirection(dx: number, dy: number): Direction | null {
    for (let d = 0; d < 8; d++) {
      if (DIR_DX[d as Direction] === dx && DIR_DY[d as Direction] === dy) {
        return d as Direction;
      }
    }
    return null;
  }

  /** Check if auto-explore should stop (returns reason string or null if should continue) */
  private checkAutoExploreStop(): string | null {
    const px = this.host.player.tileX;
    const py = this.host.player.tileY;

    // Player died or game over
    if (!this.host.player.alive || this.host.gameOver) return "danger";

    // Enemy visible (within player's sight range = 4 tiles, same as revealArea radius)
    for (const e of this.host.enemies) {
      if (e.alive && this.host.visited[e.tileY]?.[e.tileX]) {
        const dist = chebyshevDist(px, py, e.tileX, e.tileY);
        if (dist <= 4) return `${e.name} spotted nearby!`;
      }
    }

    // Item found nearby (within 2 tiles)
    for (const fi of this.host.floorItems) {
      const dist = chebyshevDist(px, py, fi.x, fi.y);
      if (dist <= 2 && this.host.visited[fi.y]?.[fi.x]) return `Found ${fi.item.name} nearby!`;
    }

    // Stairs found nearby (within 3 tiles)
    const { stairsPos } = this.host.dungeon;
    if (this.host.visited[stairsPos.y]?.[stairsPos.x]) {
      const stairDist = chebyshevDist(px, py, stairsPos.x, stairsPos.y);
      if (stairDist <= 3) return "Stairs nearby!";
    }

    return null;
  }

  /** Start auto-explore mode */
  startAutoExplore() {
    if (this.autoExploring) {
      this.stopAutoExplore("Cancelled.");
      return;
    }
    if (this.host.turnManager.isBusy || !this.host.player.alive || this.host.gameOver ||
        this.host.bagOpen || this.host.menuOpen || this.host.settingsOpen || this.host.shopOpen || this.host.teamPanelOpen || this.host.eventOpen || this.host.fullMapOpen || this.host.relicOverlayOpen) return;

    // Check stop conditions before even starting
    const preCheck = this.checkAutoExploreStop();
    if (preCheck) {
      this.host.showLog(preCheck);
      return;
    }

    this.autoExploring = true;
    this.host.showLog("Auto-exploring...");

    // Show pulsing AUTO indicator
    this.showAutoExploreIndicator();

    const scene = this.host.scene;

    // Add global tap-to-cancel listener with a short delay so the current tap doesn't cancel immediately
    scene.time.delayedCall(200, () => {
      if (this.autoExploring) {
        scene.input.on("pointerdown", this.onAutoExploreInterrupt, this);
      }
    });

    // Start the auto-step loop
    this.autoExploreStep();
  }

  /** Perform one auto-explore step, then schedule the next */
  private async autoExploreStep() {
    if (!this.autoExploring) return;
    const scene = this.host.scene;

    if (this.host.turnManager.isBusy) {
      // Wait and retry
      this.autoExploreTimer = scene.time.delayedCall(50, () => this.autoExploreStep());
      return;
    }

    // Check stop conditions before moving
    const stopReason = this.checkAutoExploreStop();
    if (stopReason) {
      this.stopAutoExplore(stopReason);
      return;
    }

    // Find the next direction via BFS
    const dir = this.autoExploreBFS();
    if (dir === null) {
      this.stopAutoExplore("No more areas to explore.");
      return;
    }

    // Check if we can actually move there (entity collision etc.)
    if (!this.host.canEntityMove(this.host.player, dir)) {
      // Might be temporarily blocked by an entity; try again next tick
      this.autoExploreTimer = scene.time.delayedCall(100, () => this.autoExploreStep());
      return;
    }

    // Record HP before the step to detect damage taken
    const hpBefore = this.host.player.stats.hp;

    // Perform the turn (same as handlePlayerAction for movement)
    this.host.player.facing = dir;

    await this.host.turnManager.executeTurn(
      () => this.host.moveEntity(this.host.player, dir),
      [...this.host.getAllyActions(), ...this.host.getEnemyActions()]
    );

    // PP recovery on movement
    this.host.recoverPP(this.host.player);

    // Check for items on ground (but don't stop for it — stop condition handles nearby items)
    const itemHere = this.host.floorItems.find(
      fi => fi.x === this.host.player.tileX && fi.y === this.host.player.tileY
    );
    if (itemHere) {
      this.stopAutoExplore(`Found ${itemHere.item.name}!`);
      this.host.tickBelly();
      this.host.tickWeather();
      this.host.tickEntityStatus(this.host.player);
      this.host.updateHUD();
      return;
    }

    // Traps, hazards, stairs, shop, monster house checks
    this.host.trapHazardSys.checkTraps();
    this.host.trapHazardSys.checkPlayerHazard();
    this.host.trapHazardSys.revealNearbyTraps();
    // Don't call checkStairs — that would auto-advance the floor. Let the stop condition handle it.
    this.host.checkShop();
    this.host.checkMonsterHouse();
    this.host.checkEventRoom();
    this.host.puzzleSys.checkPuzzleRoom();
    this.host.checkShrine();

    // Belly drain, weather, status
    this.host.tickBelly();
    this.host.tickWeather();
    this.host.tickEntityStatus(this.host.player);
    this.host.updateHUD();

    // Check exploration reward tiers during auto-explore
    this.host.checkExplorationRewards();

    // Check if player died from belly/status/traps
    if (!this.host.player.alive && !this.host.gameOver) {
      this.stopAutoExplore();
      this.host.showGameOver();
      return;
    }

    // Check if player took damage this step (trap, burn, hunger, etc.)
    if (this.host.player.stats.hp < hpBefore) {
      this.stopAutoExplore("Took damage!");
      return;
    }

    // Check stop conditions again after the move
    if (!this.autoExploring) return; // might have been stopped by monster house trigger etc.
    const postStopReason = this.checkAutoExploreStop();
    if (postStopReason) {
      this.stopAutoExplore(postStopReason);
      return;
    }

    // Schedule next step (150ms for faster-than-manual movement)
    this.autoExploreTimer = scene.time.delayedCall(150, () => this.autoExploreStep());
  }

  /** Stop auto-explore and clean up */
  stopAutoExplore(reason?: string) {
    if (!this.autoExploring) return;
    this.autoExploring = false;

    if (this.autoExploreTimer) {
      this.autoExploreTimer.destroy();
      this.autoExploreTimer = null;
    }

    const scene = this.host.scene;

    // Remove the interrupt listener if still active
    scene.input.off("pointerdown", this.onAutoExploreInterrupt, this);

    // Hide AUTO indicator
    this.hideAutoExploreIndicator();

    if (reason) {
      this.host.showLog(reason);
    }
  }

  /** Handler for user tap to interrupt auto-explore */
  private onAutoExploreInterrupt = () => {
    if (this.autoExploring) {
      this.stopAutoExplore("Stopped.");
    }
  };

  /** Show the pulsing AUTO indicator in top-right corner */
  private showAutoExploreIndicator() {
    if (this.autoExploreText) this.autoExploreText.destroy();
    if (this.autoExploreTween) this.autoExploreTween.destroy();

    const scene = this.host.scene;

    this.autoExploreText = scene.add.text(GAME_WIDTH - 8, 66, "AUTO", {
      fontSize: "11px",
      color: "#4ade80",
      fontFamily: "monospace",
      fontStyle: "bold",
      backgroundColor: "#00000088",
      padding: { x: 4, y: 2 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(105);

    this.autoExploreTween = scene.tweens.add({
      targets: this.autoExploreText,
      alpha: { from: 1.0, to: 0.5 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /** Hide the AUTO indicator */
  private hideAutoExploreIndicator() {
    if (this.autoExploreTween) {
      this.autoExploreTween.destroy();
      this.autoExploreTween = null;
    }
    if (this.autoExploreText) {
      this.autoExploreText.destroy();
      this.autoExploreText = null;
    }
  }
}
