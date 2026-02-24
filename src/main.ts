import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { HubScene } from "./scenes/HubScene";
import { DungeonScene } from "./scenes/DungeonScene";
import { UpgradeScene } from "./scenes/UpgradeScene";
import { AchievementScene } from "./scenes/AchievementScene";
import { PokedexScene } from "./scenes/PokedexScene";
import { MoveTutorScene } from "./scenes/MoveTutorScene";
import { HeldItemScene } from "./scenes/HeldItemScene";
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
  },
  scene: [BootScene, HubScene, DungeonScene, UpgradeScene, AchievementScene, PokedexScene, MoveTutorScene, HeldItemScene],
};

const game = new Phaser.Game(config);

// Expose for debugging
(window as unknown as Record<string, unknown>).__GAME = game;
