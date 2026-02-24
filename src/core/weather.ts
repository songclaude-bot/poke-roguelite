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
    mossBurrow: [WeatherType.Rain],
    ironWorks: [WeatherType.Sandstorm, WeatherType.Hail],
    phantomCrypt: [WeatherType.Hail],
    wyrmAbyss: [WeatherType.Sandstorm, WeatherType.Hail],
    enchantedGlade: [WeatherType.Rain],
    glacialCavern: [WeatherType.Hail],
    astralSpire: [WeatherType.Rain, WeatherType.Hail],
    shadowAlley: [WeatherType.Sandstorm, WeatherType.Hail],
    galeCliffs: [WeatherType.Rain, WeatherType.Sandstorm],
    brawlDojo: [WeatherType.Sandstorm],
    boulderPass: [WeatherType.Sandstorm],
    tranquilGrove: [WeatherType.Rain],
    fungalMarsh: [WeatherType.Rain],
    abyssalTrench: [WeatherType.Rain],
    infernoPit: [WeatherType.Sandstorm],
    voltageSpire: [WeatherType.Rain, WeatherType.Sandstorm],
    corrosiveSewer: [WeatherType.Rain, WeatherType.Sandstorm],
    seismicFault: [WeatherType.Sandstorm],
    stalactiteGrotto: [WeatherType.Sandstorm],
    chitinBurrow: [WeatherType.Rain],
    valorArena: [WeatherType.Sandstorm],
    titaniumMine: [WeatherType.Sandstorm, WeatherType.Hail],
    spectralWoods: [WeatherType.Hail],
    cosmicRift: [WeatherType.Rain, WeatherType.Hail],
    frostbiteChasm: [WeatherType.Hail],
    midnightAlley: [WeatherType.Sandstorm, WeatherType.Hail],
    pixieHollow: [WeatherType.Rain],
    drakeNest: [WeatherType.Sandstorm, WeatherType.Hail],
    stormyNest: [WeatherType.Rain, WeatherType.Sandstorm],
    cozyBurrow: [WeatherType.Rain],
    tidalGrotto: [WeatherType.Rain],
    blazingCaldera: [WeatherType.Sandstorm],
    verdantCanopy: [WeatherType.Rain],
    sparkingPlant: [WeatherType.Rain, WeatherType.Sandstorm],
    venomousReef: [WeatherType.Rain, WeatherType.Sandstorm],
    shiftingSands: [WeatherType.Sandstorm],
    crystalCavern: [WeatherType.Sandstorm, WeatherType.Hail],
    silkWeb: [WeatherType.Rain],
    championDojo: [WeatherType.Sandstorm],
    forgeMountain: [WeatherType.Sandstorm, WeatherType.Hail],
    hauntedManor: [WeatherType.Hail],
    dreamTemple: [WeatherType.Rain, WeatherType.Hail],
    permafrostPeak: [WeatherType.Hail],
    thiefsDen: [WeatherType.Sandstorm, WeatherType.Hail],
    sugarGarden: [WeatherType.Rain],
    draconicSpire: [WeatherType.Sandstorm, WeatherType.Hail],
    skyHighNest: [WeatherType.Rain, WeatherType.Sandstorm],
    pastoralPlains: [WeatherType.Rain],
    abyssalDepths: [WeatherType.Rain],
    volcanicCore: [WeatherType.Sandstorm],
    ancientWoods: [WeatherType.Rain],
    thunderDome: [WeatherType.Rain, WeatherType.Sandstorm],
    miasmaSwamp: [WeatherType.Rain, WeatherType.Sandstorm],
    tectonicRift: [WeatherType.Sandstorm],
    // Phase 124-126: Rock/Bug/Fighting 5th
    crystalDepths: [WeatherType.Sandstorm, WeatherType.None],
    silkwoodGrove: [WeatherType.Rain, WeatherType.None],
    warlordsArena: [WeatherType.Sandstorm, WeatherType.None],
    // Phase 127-129: Steel/Ghost/Psychic 5th
    steelworksCitadel: [WeatherType.None, WeatherType.Sandstorm],
    spectralCrypt: [WeatherType.None, WeatherType.Hail],
    astralSanctum: [WeatherType.None, WeatherType.Hail],
    // Phase 130-132: Ice/Dark/Fairy 5th
    glacialAbyss: [WeatherType.Hail],
    shadowLabyrinth: [WeatherType.Sandstorm, WeatherType.Hail],
    faerieGarden: [WeatherType.Rain],
    // Phase 133-135: Dragon/Flying/Normal 5th
    dragonsDen: [WeatherType.Sandstorm, WeatherType.Hail],
    stormySkies: [WeatherType.Rain, WeatherType.Sandstorm],
    verdantMeadow: [WeatherType.Rain],
    // Phase 137-139: Water/Fire/Grass/Electric/Poison/Ground 6th
    tidalTrench: [WeatherType.Rain],
    infernoPeak: [WeatherType.Sandstorm],
    eternaForest: [WeatherType.Rain],
    voltChamber: [WeatherType.Rain, WeatherType.Sandstorm],
    // venomDepths already defined above
    faultlineChasm: [WeatherType.Sandstorm],
    // Phase 140-142: Rock/Bug/Fighting/Steel/Ghost/Psychic 6th
    fossilCrypt: [WeatherType.Sandstorm],
    cocoonHollow: [WeatherType.Rain],
    titansDojo: [WeatherType.Sandstorm],
    ironVault: [WeatherType.Sandstorm, WeatherType.Hail],
    phantomRift: [WeatherType.Hail],
    mindPalace: [WeatherType.Rain, WeatherType.Hail],
    // Phase 143-145: Ice/Dark/Fairy/Dragon/Flying/Normal 6th
    frozenCitadel: [WeatherType.Hail],
    eclipseVault: [WeatherType.Sandstorm, WeatherType.Hail],
    moonlitGarden: [WeatherType.Rain],
    wyrmsNest: [WeatherType.Sandstorm, WeatherType.Hail],
    skyPinnacle: [WeatherType.Rain, WeatherType.Sandstorm],
    primevalPlains: [WeatherType.Rain, WeatherType.Sandstorm],
    // Phase 148-150: Water/Fire/Grass/Electric/Poison/Ground 7th
    abyssopelagic: [WeatherType.Rain],
    calderaCore: [WeatherType.Sandstorm],
    primordialCanopy: [WeatherType.Rain],
    plasmaCorridor: [WeatherType.Rain, WeatherType.Sandstorm],
    corrosivePit: [WeatherType.Rain, WeatherType.Sandstorm],
    mantleCavern: [WeatherType.Sandstorm],
    // Phase 151-153: Rock/Bug/Fighting/Steel/Ghost/Psychic 7th
    obsidianForge: [WeatherType.Sandstorm],
    chitinLabyrinth: [WeatherType.Rain],
    colosseum: [WeatherType.Sandstorm],
    steelAbyss: [WeatherType.Sandstorm, WeatherType.Hail],
    necropolisDepths: [WeatherType.Hail],
    cosmicLibrary: [WeatherType.Rain, WeatherType.Hail],
    // Phase 154-156: Ice/Dark/Fairy/Dragon/Flying/Normal 7th
    glacierFortress: [WeatherType.Hail],
    umbralCitadel: [WeatherType.Sandstorm, WeatherType.Hail],
    sylvanSanctuary: [WeatherType.Rain],
    dragonsSpine: [WeatherType.Sandstorm, WeatherType.Hail],
    stratosphere: [WeatherType.Rain, WeatherType.Sandstorm],
    sovereignHall: [WeatherType.Rain, WeatherType.Sandstorm],
    // Phase 158-160: 8th Tier
    hadopelagicTrench: [WeatherType.Rain],
    primordialCaldera: [WeatherType.Sandstorm],
    worldTreeRoots: [WeatherType.Rain],
    teslaSpire: [WeatherType.Rain, WeatherType.Sandstorm],
    bileswamp: [WeatherType.Rain, WeatherType.Sandstorm],
    tectonicAbyss: [WeatherType.Sandstorm],
    // Phase 161-163: 8th Tier Rock/Bug/Fighting/Steel/Ghost/Psychic
    crystalVein: [WeatherType.Sandstorm],
    hiveMind: [WeatherType.Rain],
    grandArena: [WeatherType.Sandstorm, WeatherType.Rain],
    adamantineChamber: [WeatherType.Sandstorm, WeatherType.Hail],
    voidBreach: [WeatherType.Hail],
    etherealNexus: [WeatherType.Rain, WeatherType.Hail],
    // Phase 164-166: 8th Tier Ice/Dark/Fairy/Dragon/Flying/Normal
    glacialTomb: [WeatherType.Hail],
    abyssalShadow: [WeatherType.None, WeatherType.Sandstorm],
    enchantedGrove: [WeatherType.None, WeatherType.Rain],
    wyrmpeakSummit: [WeatherType.Sandstorm, WeatherType.Hail],
    galeStronghold: [WeatherType.Rain, WeatherType.Hail],
    apexArena: [WeatherType.None, WeatherType.Sandstorm],
    destinyTower: [WeatherType.Rain, WeatherType.Sandstorm, WeatherType.Hail],
  };

  const pool = pools[dungeonId] ?? [WeatherType.Rain, WeatherType.Sandstorm, WeatherType.Hail];
  return pool[Math.floor(Math.random() * pool.length)];
}
