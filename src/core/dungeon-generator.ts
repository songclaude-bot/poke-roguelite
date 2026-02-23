import * as ROT from "rot-js";
import { MAP_WIDTH, MAP_HEIGHT } from "../config";

export enum TerrainType {
  WALL = 0,
  WATER = 1,
  GROUND = 2,
}

export interface DungeonData {
  width: number;
  height: number;
  terrain: TerrainType[][];
  rooms: { x: number; y: number; w: number; h: number }[];
  stairsPos: { x: number; y: number };
  playerStart: { x: number; y: number };
}

export function generateDungeon(
  width = MAP_WIDTH,
  height = MAP_HEIGHT
): DungeonData {
  const terrain: TerrainType[][] = [];
  for (let y = 0; y < height; y++) {
    terrain[y] = [];
    for (let x = 0; x < width; x++) {
      terrain[y][x] = TerrainType.WALL;
    }
  }

  // Use rot.js Uniform dungeon generator
  const digger = new ROT.Map.Uniform(width, height, {
    roomWidth: [3, 7],
    roomHeight: [3, 5],
    roomDugPercentage: 0.4,
  });

  digger.create((x, y, value) => {
    // value 0 = floor, 1 = wall
    if (value === 0) {
      terrain[y][x] = TerrainType.GROUND;
    }
  });

  // Extract room data
  const rotRooms = digger.getRooms();
  const rooms = rotRooms.map((r) => ({
    x: r.getLeft(),
    y: r.getTop(),
    w: r.getRight() - r.getLeft() + 1,
    h: r.getBottom() - r.getTop() + 1,
  }));

  // Player starts in first room center
  const firstRoom = rooms[0];
  const playerStart = {
    x: Math.floor(firstRoom.x + firstRoom.w / 2),
    y: Math.floor(firstRoom.y + firstRoom.h / 2),
  };

  // Stairs in last room center (farthest from player)
  const lastRoom = rooms[rooms.length - 1];
  const stairsPos = {
    x: Math.floor(lastRoom.x + lastRoom.w / 2),
    y: Math.floor(lastRoom.y + lastRoom.h / 2),
  };

  return { width, height, terrain, rooms, stairsPos, playerStart };
}
