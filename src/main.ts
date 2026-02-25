import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { HubScene } from "./scenes/HubScene";
import { DungeonScene } from "./scenes/DungeonScene";
import { UpgradeScene } from "./scenes/UpgradeScene";
import { AchievementScene } from "./scenes/AchievementScene";
import { PokedexScene } from "./scenes/PokedexScene";
import { MoveTutorScene } from "./scenes/MoveTutorScene";
import { HeldItemScene } from "./scenes/HeldItemScene";
import { CraftingScene } from "./scenes/CraftingScene";
import { HelpScene } from "./scenes/HelpScene";
import { AbilityUpgradeScene } from "./scenes/AbilityUpgradeScene";
import { DungeonPreviewScene } from "./scenes/DungeonPreviewScene";
import { LeaderboardScene } from "./scenes/LeaderboardScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "./config";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.BG,
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    preserveDrawingBuffer: true,
    antialias: false,
  },
  scene: [BootScene, HubScene, DungeonPreviewScene, DungeonScene, UpgradeScene, AchievementScene, PokedexScene, MoveTutorScene, HeldItemScene, CraftingScene, HelpScene, AbilityUpgradeScene, LeaderboardScene, SettingsScene],
};

const game = new Phaser.Game(config);

// ── High-DPI text fix: patch Phaser Text to auto-set resolution ──
// Makes all text render at native pixel density → no blurriness on PC/retina.
const textDpr = Math.min(window.devicePixelRatio || 1, 3);
if (textDpr > 1) {
  const origSetStyle = Phaser.GameObjects.Text.prototype.setStyle;
  Phaser.GameObjects.Text.prototype.setStyle = function (this: Phaser.GameObjects.Text, style: object) {
    const result = origSetStyle.call(this, style);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (this.style && (this.style as any).resolution !== textDpr) {
      this.setResolution(textDpr);
    }
    return result;
  };

  // Patch updateText — called during construction and text changes
  const origUpdateText = Phaser.GameObjects.Text.prototype.updateText;
  Phaser.GameObjects.Text.prototype.updateText = function (this: Phaser.GameObjects.Text) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (this.style && (this.style as any).resolution !== textDpr) {
      this.setResolution(textDpr);
    }
    return origUpdateText.call(this);
  };
}

// Expose for debugging
(window as unknown as Record<string, unknown>).__GAME = game;
