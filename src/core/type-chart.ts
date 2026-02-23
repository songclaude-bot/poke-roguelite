/**
 * Simplified Pokemon type effectiveness system.
 * Uses only the types relevant to current pokemon in the game.
 */

export enum PokemonType {
  Normal = "Normal",
  Water = "Water",
  Fire = "Fire",
  Grass = "Grass",
  Electric = "Electric",
  Flying = "Flying",
  Poison = "Poison",
  Ground = "Ground",
  Rock = "Rock",
  Bug = "Bug",
  Fighting = "Fighting",
  Steel = "Steel",
  Ghost = "Ghost",
  Psychic = "Psychic",
  Ice = "Ice",
}

/**
 * Type effectiveness multipliers.
 * Only populated for matchups used in the game currently.
 * Missing entries default to 1.0 (neutral).
 */
const EFFECTIVENESS: Partial<Record<PokemonType, Partial<Record<PokemonType, number>>>> = {
  [PokemonType.Water]: {
    [PokemonType.Fire]: 2.0,
    [PokemonType.Ground]: 2.0,
    [PokemonType.Rock]: 2.0,
    [PokemonType.Grass]: 0.5,
    [PokemonType.Water]: 0.5,
  },
  [PokemonType.Fire]: {
    [PokemonType.Grass]: 2.0,
    [PokemonType.Bug]: 2.0,
    [PokemonType.Water]: 0.5,
    [PokemonType.Rock]: 0.5,
    [PokemonType.Fire]: 0.5,
  },
  [PokemonType.Grass]: {
    [PokemonType.Water]: 2.0,
    [PokemonType.Ground]: 2.0,
    [PokemonType.Rock]: 2.0,
    [PokemonType.Fire]: 0.5,
    [PokemonType.Grass]: 0.5,
    [PokemonType.Flying]: 0.5,
    [PokemonType.Poison]: 0.5,
    [PokemonType.Bug]: 0.5,
  },
  [PokemonType.Electric]: {
    [PokemonType.Water]: 2.0,
    [PokemonType.Flying]: 2.0,
    [PokemonType.Ground]: 0,
    [PokemonType.Electric]: 0.5,
    [PokemonType.Grass]: 0.5,
  },
  [PokemonType.Flying]: {
    [PokemonType.Grass]: 2.0,
    [PokemonType.Bug]: 2.0,
    [PokemonType.Rock]: 0.5,
    [PokemonType.Electric]: 0.5,
  },
  [PokemonType.Poison]: {
    [PokemonType.Grass]: 2.0,
    [PokemonType.Poison]: 0.5,
    [PokemonType.Ground]: 0.5,
    [PokemonType.Rock]: 0.5,
  },
  [PokemonType.Ground]: {
    [PokemonType.Fire]: 2.0,
    [PokemonType.Electric]: 2.0,
    [PokemonType.Poison]: 2.0,
    [PokemonType.Rock]: 2.0,
    [PokemonType.Grass]: 0.5,
    [PokemonType.Bug]: 0.5,
    [PokemonType.Flying]: 0,
  },
  [PokemonType.Rock]: {
    [PokemonType.Fire]: 2.0,
    [PokemonType.Flying]: 2.0,
    [PokemonType.Bug]: 2.0,
    [PokemonType.Water]: 0.5,
    [PokemonType.Grass]: 0.5,
    [PokemonType.Ground]: 0.5,
  },
  [PokemonType.Bug]: {
    [PokemonType.Grass]: 2.0,
    [PokemonType.Poison]: 0.5,
    [PokemonType.Flying]: 0.5,
    [PokemonType.Fire]: 0.5,
    [PokemonType.Steel]: 0.5,
  },
  [PokemonType.Fighting]: {
    [PokemonType.Normal]: 2.0,
    [PokemonType.Rock]: 2.0,
    [PokemonType.Steel]: 2.0,
    [PokemonType.Flying]: 0.5,
    [PokemonType.Poison]: 0.5,
    [PokemonType.Bug]: 0.5,
  },
  [PokemonType.Steel]: {
    [PokemonType.Rock]: 2.0,
    [PokemonType.Bug]: 2.0,
    [PokemonType.Ice]: 2.0,
    [PokemonType.Fire]: 0.5,
    [PokemonType.Water]: 0.5,
    [PokemonType.Electric]: 0.5,
    [PokemonType.Steel]: 0.5,
  },
  [PokemonType.Ghost]: {
    [PokemonType.Ghost]: 2.0,
    [PokemonType.Psychic]: 2.0,
    [PokemonType.Normal]: 0,
  },
  [PokemonType.Psychic]: {
    [PokemonType.Fighting]: 2.0,
    [PokemonType.Poison]: 2.0,
    [PokemonType.Psychic]: 0.5,
    [PokemonType.Steel]: 0.5,
  },
  [PokemonType.Ice]: {
    [PokemonType.Grass]: 2.0,
    [PokemonType.Ground]: 2.0,
    [PokemonType.Flying]: 2.0,
    [PokemonType.Fire]: 0.5,
    [PokemonType.Water]: 0.5,
    [PokemonType.Ice]: 0.5,
    [PokemonType.Steel]: 0.5,
  },
};

/**
 * Get the type effectiveness multiplier for an attack type vs a defending pokemon's types.
 * For dual-type defenders, multiply both multipliers.
 */
export function getEffectiveness(attackType: PokemonType, defenderTypes: PokemonType[]): number {
  let multiplier = 1.0;
  for (const defType of defenderTypes) {
    const chart = EFFECTIVENESS[attackType];
    if (chart && chart[defType] !== undefined) {
      multiplier *= chart[defType]!;
    }
  }
  return multiplier;
}

/**
 * Get a display string for the effectiveness multiplier.
 */
export function effectivenessText(multiplier: number): string {
  if (multiplier >= 2.0) return "It's super effective!";
  if (multiplier > 0 && multiplier < 1.0) return "It's not very effective...";
  if (multiplier === 0) return "It has no effect...";
  return "";
}
