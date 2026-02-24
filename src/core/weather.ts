/**
 * Weather system — affects battles on dungeon floors.
 * Each floor may have a weather condition that modifies gameplay.
 */

import { PokemonType } from "./type-chart";

export enum WeatherType {
  None = "none",
  Rain = "rain",         // Boosts Water, weakens Fire, SwiftSwim doubles speed
  Sandstorm = "sandstorm", // Rock/Steel/Ground immune, others take 5 dmg/turn
  Hail = "hail",         // Ice immune, others take 5 dmg/turn
}

export interface WeatherDef {
  type: WeatherType;
  name: string;
  description: string;
  color: string;        // HUD color
  symbol: string;       // Display symbol
}

export const WEATHERS: Record<WeatherType, WeatherDef> = {
  [WeatherType.None]: {
    type: WeatherType.None,
    name: "Clear",
    description: "",
    color: "#94a3b8",
    symbol: "",
  },
  [WeatherType.Rain]: {
    type: WeatherType.Rain,
    name: "Rain",
    description: "Water +50%, Fire -50%",
    color: "#3b82f6",
    symbol: "🌧",
  },
  [WeatherType.Sandstorm]: {
    type: WeatherType.Sandstorm,
    name: "Sandstorm",
    description: "Non Rock/Steel/Ground take 5 dmg/turn",
    color: "#d4a574",
    symbol: "🌪",
  },
  [WeatherType.Hail]: {
    type: WeatherType.Hail,
    name: "Hail",
    description: "Non Ice types take 5 dmg/turn",
    color: "#93c5fd",
    symbol: "❄",
  },
};

/** Get weather damage multiplier for a skill type */
export function weatherDamageMultiplier(weather: WeatherType, skillType: PokemonType): number {
  if (weather === WeatherType.Rain) {
    if (skillType === PokemonType.Water) return 1.5;
    if (skillType === PokemonType.Fire) return 0.5;
  }
  return 1.0;
}

/** Check if entity types are immune to weather chip damage */
export function isWeatherImmune(weather: WeatherType, types: PokemonType[]): boolean {
  if (weather === WeatherType.Sandstorm) {
    return types.some(t => t === PokemonType.Rock || t === PokemonType.Steel || t === PokemonType.Ground);
  }
  if (weather === WeatherType.Hail) {
    return types.some(t => t === PokemonType.Ice);
  }
  return true; // No chip damage for Rain/None
}

/** Roll weather for a dungeon floor (based on dungeon-specific weights) */
export function rollFloorWeather(dungeonId: string, floor: number): WeatherType {
  // Higher floors have more weather variety
  const chance = Math.min(0.4, 0.1 + floor * 0.05);
  if (Math.random() > chance) return WeatherType.None;

  // Dungeon-specific weather pools
  const pools: Record<string, WeatherType[]> = {
    beachCave: [WeatherType.Rain],
    tinyWoods: [WeatherType.Rain],
    thunderwaveCave: [WeatherType.Rain, WeatherType.Sandstorm],
    mtSteel: [WeatherType.Sandstorm],
    skyTower: [WeatherType.Hail, WeatherType.Rain],
    frostyForest: [WeatherType.Hail],
    magmaCavern: [WeatherType.Sandstorm],
    sinisterWoods: [WeatherType.Rain, WeatherType.Hail],
    overgrownForest: [WeatherType.Rain],
    toxicSwamp: [WeatherType.Rain, WeatherType.Sandstorm],
    moonlitCave: [WeatherType.Hail],
    dragonsLair: [WeatherType.Sandstorm, WeatherType.Hail],
    steelFortress: [WeatherType.Sandstorm, WeatherType.Hail],
    buriedRuins: [WeatherType.Sandstorm],
    stormySea: [WeatherType.Rain],
    ampPlains: [WeatherType.Rain, WeatherType.Sandstorm],
    verdantForest: [WeatherType.Rain],
    mysticSanctum: [WeatherType.Hail, WeatherType.Rain],
    shadowForest: [WeatherType.Rain, WeatherType.Hail],
    windySummit: [WeatherType.Rain, WeatherType.Sandstorm],
    battleArena: [WeatherType.Sandstorm],
    rockyCavern: [WeatherType.Sandstorm],
    frozenTundra: [WeatherType.Hail],
    meadowPath: [WeatherType.Rain],
    petalGarden: [WeatherType.Rain],
    emberGrotto: [WeatherType.Sandstorm],
    coralReef: [WeatherType.Rain],
    voltageLab: [WeatherType.Rain, WeatherType.Sandstorm],
    venomDepths: [WeatherType.Rain, WeatherType.Sandstorm],
    quakeTunnel: [WeatherType.Sandstorm],
    destinyTower: [WeatherType.Rain, WeatherType.Sandstorm, WeatherType.Hail],
  };

  const pool = pools[dungeonId] ?? [WeatherType.Rain, WeatherType.Sandstorm, WeatherType.Hail];
  return pool[Math.floor(Math.random() * pool.length)];
}
