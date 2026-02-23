import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { DungeonScene } from "./scenes/DungeonScene";
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
  scene: [BootScene, DungeonScene],
};

const game = new Phaser.Game(config);

// Expose for debugging
(window as unknown as Record<string, unknown>).__GAME = game;
