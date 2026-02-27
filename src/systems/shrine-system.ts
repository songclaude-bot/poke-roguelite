/**
 * ShrineSystem — Extracted from DungeonScene.
 * Manages all shrine logic: placement, visuals, UI overlay, and effect application.
 */
import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, TILE_DISPLAY } from "../config";
import { Entity } from "../core/entity";
import { TerrainType } from "../core/dungeon-generator";
import { DungeonDef } from "../core/dungeon-data";
import {
  ShrineType, Shrine, ShrineChoice, ShrineEffect,
  generateShrine, shouldSpawnShrine,
} from "../core/dungeon-shrines";
import {
  Blessing, getRandomBlessing, getRandomCurse, rollBlessingOrCurse,
} from "../core/blessings";
import { processLevelUp } from "../core/leveling";
import { sfxHeal, sfxMenuOpen } from "../core/sound-manager";

// ── Host interface: what ShrineSystem needs from DungeonScene ──

export interface ShrineHost {
  /** Phaser Scene API (for add, tweens, time, cameras) */
  scene: Phaser.Scene;

  // Read-only game state
  readonly player: Entity;
  readonly currentFloor: number;
  readonly dungeonDef: DungeonDef;

  // Mutable shared state
  gold: number;
  totalExp: number;
  belly: number;

  // Callbacks (delegate back to DungeonScene)
  showLog(msg: string): void;
  updateHUD(): void;
  updateMinimap(): void;
  stopAutoExplore(): void;
  grantBlessing(blessing: Blessing): void;
  setDomHudInteractive(enabled: boolean): void;
}

// ── ShrineSystem class ──

export class ShrineSystem {
  // ── Shrine-specific state (moved from DungeonScene) ──
  floorShrine: Shrine | null = null;
  shrineTileX = -1;
  shrineTileY = -1;
  shrineUsed = false;
  shrineOpen = false;
  private shrineUI: Phaser.GameObjects.GameObject[] = [];
  private shrineGraphic: Phaser.GameObjects.Graphics | null = null;
  private shrineMarker: Phaser.GameObjects.Text | null = null;

  constructor(private host: ShrineHost) {}

  /** Reset all shrine state for a new floor */
  reset() {
    this.floorShrine = null;
    this.shrineTileX = -1;
    this.shrineTileY = -1;
    this.shrineUsed = false;
    this.shrineUI = [];
    this.shrineOpen = false;
    this.shrineGraphic = null;
    this.shrineMarker = null;
  }

  // ── Shrine Placement (called during dungeon generation) ──

  /**
   * Try to spawn a shrine on this floor.
   * Returns true if a shrine was placed.
   */
  trySpawnShrine(
    rooms: { x: number; y: number; w: number; h: number }[],
    terrain: TerrainType[][],
    playerStart: { x: number; y: number },
    stairsPos: { x: number; y: number },
    isBossFloor: boolean,
    excludeRooms: ({ x: number; y: number; w: number; h: number } | null | undefined)[],
  ): boolean {
    if (!shouldSpawnShrine(this.host.currentFloor, this.host.dungeonDef.floors, isBossFloor)) return false;
    if (rooms.length <= 2) return false;

    const shrineCandidates: { x: number; y: number }[] = [];
    for (const rm of rooms) {
      // Skip player room, stairs room
      if (playerStart.x >= rm.x && playerStart.x < rm.x + rm.w &&
          playerStart.y >= rm.y && playerStart.y < rm.y + rm.h) continue;
      if (stairsPos.x >= rm.x && stairsPos.x < rm.x + rm.w &&
          stairsPos.y >= rm.y && stairsPos.y < rm.y + rm.h) continue;
      // Skip excluded special rooms
      if (excludeRooms.some(er => er === rm)) continue;
      // Collect interior ground tiles
      for (let ry = rm.y + 1; ry < rm.y + rm.h - 1; ry++) {
        for (let rx = rm.x + 1; rx < rm.x + rm.w - 1; rx++) {
          if (terrain[ry]?.[rx] === TerrainType.GROUND) {
            shrineCandidates.push({ x: rx, y: ry });
          }
        }
      }
    }

    if (shrineCandidates.length === 0) return false;

    const spot = shrineCandidates[Math.floor(Math.random() * shrineCandidates.length)];
    this.shrineTileX = spot.x;
    this.shrineTileY = spot.y;
    this.floorShrine = generateShrine(this.host.currentFloor, this.host.dungeonDef.difficulty);
    this.shrineUsed = false;
    this.drawShrine();
    this.host.showLog("You sense a mysterious shrine on this floor...");
    return true;
  }

  // ── Shrine Visuals ──

  /** Draw the shrine visual on the dungeon floor */
  private drawShrine() {
    if (this.shrineTileX < 0 || !this.floorShrine) return;
    const scene = this.host.scene;
    const shrine = this.floorShrine;

    // Diamond glow graphic at the shrine tile
    this.shrineGraphic = scene.add.graphics().setDepth(5);
    const cx = this.shrineTileX * TILE_DISPLAY + TILE_DISPLAY / 2;
    const cy = this.shrineTileY * TILE_DISPLAY + TILE_DISPLAY / 2;
    // Glow circle
    this.shrineGraphic.fillStyle(shrine.color, 0.25);
    this.shrineGraphic.fillCircle(cx, cy, TILE_DISPLAY * 0.6);
    // Inner diamond shape
    this.shrineGraphic.fillStyle(shrine.color, 0.5);
    this.shrineGraphic.fillPoints([
      new Phaser.Geom.Point(cx, cy - 14),
      new Phaser.Geom.Point(cx + 10, cy),
      new Phaser.Geom.Point(cx, cy + 14),
      new Phaser.Geom.Point(cx - 10, cy),
    ], true);
    // Border
    this.shrineGraphic.lineStyle(1, shrine.color, 0.8);
    this.shrineGraphic.strokePoints([
      new Phaser.Geom.Point(cx, cy - 14),
      new Phaser.Geom.Point(cx + 10, cy),
      new Phaser.Geom.Point(cx, cy + 14),
      new Phaser.Geom.Point(cx - 10, cy),
    ], true);

    // Shrine marker icon with pulse animation
    this.shrineMarker = scene.add.text(cx, cy - 12, shrine.icon, {
      fontSize: "16px", fontFamily: "monospace",
      stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5).setDepth(8);

    scene.tweens.add({
      targets: this.shrineMarker,
      scaleX: { from: 1, to: 1.3 },
      scaleY: { from: 1, to: 1.3 },
      alpha: { from: 1, to: 0.6 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  // ── Player Step Check ──

  /** Check if player stepped on the shrine tile */
  checkShrine() {
    if (!this.floorShrine || this.shrineUsed || this.shrineOpen) return;
    if (this.host.player.tileX === this.shrineTileX && this.host.player.tileY === this.shrineTileY) {
      this.openShrineUI();
    }
  }

  // ── Shrine UI Overlay ──

  /** Open the shrine choice overlay */
  private openShrineUI() {
    if (this.shrineOpen || !this.floorShrine || this.shrineUsed) return;
    const scene = this.host.scene;
    sfxMenuOpen();
    this.shrineOpen = true;
    this.host.setDomHudInteractive(false);
    this.host.stopAutoExplore();

    const shrine = this.floorShrine;

    // Dim overlay
    const overlay = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75)
      .setScrollFactor(0).setDepth(200).setInteractive();
    this.shrineUI.push(overlay);

    // Shrine title
    const clrHex = `#${shrine.color.toString(16).padStart(6, "0")}`;
    const titleText = scene.add.text(GAME_WIDTH / 2, 55, `${shrine.icon} ${shrine.name}`, {
      fontSize: "16px", color: clrHex, fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.shrineUI.push(titleText);

    // Decorative line
    const line = scene.add.graphics().setScrollFactor(0).setDepth(201);
    line.lineStyle(1, shrine.color, 0.5);
    line.lineBetween(GAME_WIDTH / 2 - 120, 77, GAME_WIDTH / 2 + 120, 77);
    this.shrineUI.push(line);

    // Description
    const descText = scene.add.text(GAME_WIDTH / 2, 100, shrine.description, {
      fontSize: "10px", color: "#c0c8e0", fontFamily: "monospace",
      wordWrap: { width: 280 }, align: "center", lineSpacing: 4,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(201);
    this.shrineUI.push(descText);

    // Choice buttons
    const choiceStartY = 210;
    for (let i = 0; i < shrine.choices.length; i++) {
      const choice = shrine.choices[i];
      const choiceY = choiceStartY + i * 80;

      // Button background
      const btnColor = Phaser.Display.Color.HexStringToColor(choice.color).color;
      const btnBg = scene.add.rectangle(GAME_WIDTH / 2, choiceY, 280, 60, 0x1a1a2e, 0.95)
        .setScrollFactor(0).setDepth(201).setInteractive()
        .setStrokeStyle(1, btnColor, 0.6);
      this.shrineUI.push(btnBg);

      // Choice label
      const labelText = scene.add.text(GAME_WIDTH / 2, choiceY - 12, choice.label, {
        fontSize: "12px", color: choice.color, fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
      this.shrineUI.push(labelText);

      // Choice description
      const choiceDesc = scene.add.text(GAME_WIDTH / 2, choiceY + 8, choice.description, {
        fontSize: "9px", color: "#888ea8", fontFamily: "monospace",
        wordWrap: { width: 250 }, align: "center",
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(202);
      this.shrineUI.push(choiceDesc);

      // Hover effects
      btnBg.on("pointerover", () => {
        btnBg.setStrokeStyle(2, 0xfbbf24, 1);
        labelText.setColor("#ffffff");
      });
      btnBg.on("pointerout", () => {
        btnBg.setStrokeStyle(1, btnColor, 0.6);
        labelText.setColor(choice.color);
      });

      // Click handler
      btnBg.on("pointerdown", () => {
        this.applyShrineEffect(choice);
      });
    }
  }

  /** Close shrine overlay */
  private closeShrineUI() {
    for (const obj of this.shrineUI) obj.destroy();
    this.shrineUI = [];
    this.shrineOpen = false;
    this.host.setDomHudInteractive(true);
  }

  /** Show a brief result message after shrine use */
  private showShrineResult(message: string, color = "#4ade80") {
    this.closeShrineUI();
    this.shrineUsed = true;
    const scene = this.host.scene;

    // Remove shrine visuals
    if (this.shrineGraphic) {
      this.shrineGraphic.destroy();
      this.shrineGraphic = null;
    }
    if (this.shrineMarker) {
      this.shrineMarker.destroy();
      this.shrineMarker = null;
    }

    // Brief result overlay
    const overlay = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(200).setInteractive();

    const resultText = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, message, {
      fontSize: "12px", color, fontFamily: "monospace", fontStyle: "bold",
      wordWrap: { width: 280 }, align: "center",
      stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    // Auto-dismiss after 1.5 seconds
    scene.time.delayedCall(1500, () => {
      overlay.destroy();
      resultText.destroy();
      this.host.updateHUD();
      this.host.updateMinimap();
    });
  }

  // ── Effect Application ──

  /** Apply the chosen shrine effect */
  private applyShrineEffect(choice: ShrineChoice) {
    const eff = choice.effect;
    const host = this.host;

    switch (eff.type) {
      case "heal": {
        if (eff.value === 0) {
          // "Leave" / "Walk Away" -- no effect
          this.closeShrineUI();
          this.shrineUsed = true;
          // Remove shrine visuals
          if (this.shrineGraphic) { this.shrineGraphic.destroy(); this.shrineGraphic = null; }
          if (this.shrineMarker) { this.shrineMarker.destroy(); this.shrineMarker = null; }
          host.showLog("You left the shrine.");
          return;
        }
        if (eff.value === -1) {
          // Full heal
          host.player.stats.hp = host.player.stats.maxHp;
          sfxHeal();
          this.showShrineResult("The shrine's light washes over you.\nHP fully restored!", "#22c55e");
          host.showLog("The shrine fully healed your HP!");
        } else if (eff.value && eff.value > 0) {
          // Percentage heal
          const healAmt = Math.floor(host.player.stats.maxHp * (eff.value / 100));
          host.player.stats.hp = Math.min(host.player.stats.maxHp, host.player.stats.hp + healAmt);
          sfxHeal();
          this.showShrineResult(`Restored ${healAmt} HP!`, "#22c55e");
          host.showLog(`The shrine restored ${healAmt} HP!`);
        }
        break;
      }

      case "hpSacrifice": {
        const sacrificeAmt = Math.floor(host.player.stats.maxHp * ((eff.value ?? 25) / 100));
        if (host.player.stats.hp <= sacrificeAmt) {
          host.showLog("Not enough HP to sacrifice!");
          return; // Don't close -- let player pick another option
        }
        host.player.stats.hp -= sacrificeAmt;
        if (eff.blessing) {
          host.grantBlessing(eff.blessing);
        }
        this.showShrineResult(`Sacrificed ${sacrificeAmt} HP.\nBlessing granted!`, "#f97316");
        host.showLog(`You sacrificed ${sacrificeAmt} HP at the shrine!`);
        break;
      }

      case "bellySacrifice": {
        const bellyCost = eff.value ?? 30;
        if (host.belly < bellyCost) {
          host.showLog("Not enough belly to sacrifice!");
          return; // Don't close
        }
        host.belly -= bellyCost;
        // Give gold
        const goldAmt = this.floorShrine?.type === ShrineType.Sacrifice
          ? Math.floor(100 + host.currentFloor * 15 + host.dungeonDef.difficulty * 20)
          : 150;
        host.gold += goldAmt;
        this.showShrineResult(`Sacrificed ${bellyCost} belly.\nGained ${goldAmt}G!`, "#fbbf24");
        host.showLog(`Sacrificed belly at the shrine. Gained ${goldAmt}G!`);
        break;
      }

      case "gold": {
        const goldAmt = eff.value ?? 100;
        host.gold += goldAmt;
        this.showShrineResult(`Found ${goldAmt} gold!`, "#fbbf24");
        host.showLog(`The shrine granted ${goldAmt} gold!`);
        break;
      }

      case "blessing": {
        if (eff.blessing) {
          host.grantBlessing(eff.blessing);
          this.showShrineResult(`Blessed!\n${eff.blessing.name}`, "#4ade80");
        } else {
          const b = getRandomBlessing();
          host.grantBlessing(b);
          this.showShrineResult(`Blessed!\n${b.name}`, "#4ade80");
        }
        break;
      }

      case "curse": {
        if (eff.blessing) {
          host.grantBlessing(eff.blessing);
          this.showShrineResult(`Cursed!\n${eff.blessing.name}`, "#ef4444");
        } else {
          const c = getRandomCurse();
          host.grantBlessing(c);
          this.showShrineResult(`Cursed!\n${c.name}`, "#ef4444");
        }
        break;
      }

      case "random": {
        // 50/50 blessing or curse (gamble)
        const rolled = eff.blessing ?? rollBlessingOrCurse();
        host.grantBlessing(rolled);
        if (rolled.isCurse) {
          this.showShrineResult(`Bad luck!\n${rolled.name}`, "#ef4444");
          host.showLog(`The gamble shrine cursed you: ${rolled.name}`);
        } else {
          this.showShrineResult(`Lucky!\n${rolled.name}`, "#4ade80");
          host.showLog(`The gamble shrine blessed you: ${rolled.name}`);
        }
        break;
      }

      case "restorePP": {
        for (const sk of host.player.skills) {
          sk.currentPp = sk.pp;
        }
        sfxHeal();
        this.showShrineResult("All skill PP restored!", "#38bdf8");
        host.showLog("The shrine restored all your PP!");
        break;
      }

      case "exp": {
        const expAmt = eff.value ?? 50;
        host.totalExp += expAmt;
        const lvlResult = processLevelUp(host.player.stats, expAmt, host.totalExp);
        host.totalExp = lvlResult.totalExp;
        this.showShrineResult(`Gained ${expAmt} EXP!`, "#c084fc");
        host.showLog(`The shrine granted ${expAmt} EXP!`);
        break;
      }

      case "learnSkill": {
        // For now, just grant EXP as a placeholder
        const expAmtSk = eff.value ?? 50;
        host.totalExp += expAmtSk;
        const lvlResultSk = processLevelUp(host.player.stats, expAmtSk, host.totalExp);
        host.totalExp = lvlResultSk.totalExp;
        this.showShrineResult(`Gained ${expAmtSk} EXP from ancient knowledge!`, "#38bdf8");
        host.showLog(`The shrine imparted ancient knowledge: ${expAmtSk} EXP!`);
        break;
      }

      case "item": {
        // Reserved for future use
        this.showShrineResult("Nothing happened.", "#888888");
        break;
      }

      default: {
        this.closeShrineUI();
        this.shrineUsed = true;
        break;
      }
    }
  }
}
