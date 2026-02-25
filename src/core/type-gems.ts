/**
 * Type Gem System — consumable items that boost moves of a specific type.
 * Each gem corresponds to a Pokemon type and boosts matching skill damage by 50%.
 */

import { PokemonType } from "./type-chart";

export interface TypeGem {
  id: string;
  name: string;
  type: PokemonType;
  color: number;
  boostPercent: number;  // default 50
}

// Define gems for all 18 types
export const TYPE_GEMS: Record<string, TypeGem> = {
  fireGem: { id: "fireGem", name: "Fire Gem", type: PokemonType.Fire, color: 0xff4444, boostPercent: 50 },
  waterGem: { id: "waterGem", name: "Water Gem", type: PokemonType.Water, color: 0x4488ff, boostPercent: 50 },
  grassGem: { id: "grassGem", name: "Grass Gem", type: PokemonType.Grass, color: 0x44cc44, boostPercent: 50 },
  electricGem: { id: "electricGem", name: "Electric Gem", type: PokemonType.Electric, color: 0xffcc00, boostPercent: 50 },
  iceGem: { id: "iceGem", name: "Ice Gem", type: PokemonType.Ice, color: 0x88ccff, boostPercent: 50 },
  fightingGem: { id: "fightingGem", name: "Fighting Gem", type: PokemonType.Fighting, color: 0xcc4422, boostPercent: 50 },
  poisonGem: { id: "poisonGem", name: "Poison Gem", type: PokemonType.Poison, color: 0x9944cc, boostPercent: 50 },
  groundGem: { id: "groundGem", name: "Ground Gem", type: PokemonType.Ground, color: 0xccaa44, boostPercent: 50 },
  flyingGem: { id: "flyingGem", name: "Flying Gem", type: PokemonType.Flying, color: 0x8899ff, boostPercent: 50 },
  psychicGem: { id: "psychicGem", name: "Psychic Gem", type: PokemonType.Psychic, color: 0xff44aa, boostPercent: 50 },
  bugGem: { id: "bugGem", name: "Bug Gem", type: PokemonType.Bug, color: 0x88aa22, boostPercent: 50 },
  rockGem: { id: "rockGem", name: "Rock Gem", type: PokemonType.Rock, color: 0xaa8844, boostPercent: 50 },
  ghostGem: { id: "ghostGem", name: "Ghost Gem", type: PokemonType.Ghost, color: 0x6644aa, boostPercent: 50 },
  dragonGem: { id: "dragonGem", name: "Dragon Gem", type: PokemonType.Dragon, color: 0x6644cc, boostPercent: 50 },
  darkGem: { id: "darkGem", name: "Dark Gem", type: PokemonType.Dark, color: 0x554444, boostPercent: 50 },
  steelGem: { id: "steelGem", name: "Steel Gem", type: PokemonType.Steel, color: 0xaaaacc, boostPercent: 50 },
  fairyGem: { id: "fairyGem", name: "Fairy Gem", type: PokemonType.Fairy, color: 0xffaacc, boostPercent: 50 },
  normalGem: { id: "normalGem", name: "Normal Gem", type: PokemonType.Normal, color: 0xaaaaaa, boostPercent: 50 },
};

export function getTypeGem(id: string): TypeGem | undefined {
  return TYPE_GEMS[id];
}

/** Roll a random type gem */
export function rollRandomTypeGem(): TypeGem {
  const gems = Object.values(TYPE_GEMS);
  return gems[Math.floor(Math.random() * gems.length)];
}

/** Roll a type gem matching the player's type (50% chance) or random (50%) */
export function rollTypeGemForPlayer(playerTypes: PokemonType[]): TypeGem {
  if (Math.random() < 0.5 && playerTypes.length > 0) {
    const pt = playerTypes[Math.floor(Math.random() * playerTypes.length)];
    const matching = Object.values(TYPE_GEMS).find(g => g.type === pt);
    if (matching) return matching;
  }
  return rollRandomTypeGem();
}
