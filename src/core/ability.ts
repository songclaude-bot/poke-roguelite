/**
 * Passive abilities — each Pokemon species has one ability that provides
 * a passive effect during dungeon exploration.
 */

export enum AbilityId {
  Torrent = "torrent",       // +50% Water dmg when HP < 33%
  Sturdy = "sturdy",         // Survive one lethal hit with 1 HP
  RockHead = "rockHead",     // Immune to recoil/trap damage
  Guts = "guts",             // +50% ATK when has a status effect
  PurePower = "purePower",   // +30% ATK always
  NoGuard = "noGuard",       // All attacks hit (100% accuracy both ways)
  RunAway = "runAway",       // Warp traps warp to stairs instead
  ShieldDust = "shieldDust", // Immune to secondary effects (status from skills)
  Static = "static",         // 30% chance to paralyze attackers
  Pickup = "pickup",         // 10% chance to find items after defeating enemy
  SwiftSwim = "swiftSwim",   // Double speed in rain (extra action)
  Levitate = "levitate",     // Immune to ground traps
  FlameBody = "flameBody",   // 30% chance to burn attackers
}

export interface AbilityDef {
  id: AbilityId;
  name: string;
  description: string;
}

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  [AbilityId.Torrent]: {
    id: AbilityId.Torrent,
    name: "Torrent",
    description: "Water moves deal +50% damage when HP is below 1/3.",
  },
  [AbilityId.Sturdy]: {
    id: AbilityId.Sturdy,
    name: "Sturdy",
    description: "Survives a lethal hit once per floor with 1 HP.",
  },
  [AbilityId.RockHead]: {
    id: AbilityId.RockHead,
    name: "Rock Head",
    description: "Takes no damage from traps.",
  },
  [AbilityId.Guts]: {
    id: AbilityId.Guts,
    name: "Guts",
    description: "ATK is boosted by 50% when afflicted with a status.",
  },
  [AbilityId.PurePower]: {
    id: AbilityId.PurePower,
    name: "Pure Power",
    description: "ATK is always boosted by 30%.",
  },
  [AbilityId.NoGuard]: {
    id: AbilityId.NoGuard,
    name: "No Guard",
    description: "All moves used by or against this Pokemon always hit.",
  },
  [AbilityId.RunAway]: {
    id: AbilityId.RunAway,
    name: "Run Away",
    description: "Warp Traps teleport you near the stairs.",
  },
  [AbilityId.ShieldDust]: {
    id: AbilityId.ShieldDust,
    name: "Shield Dust",
    description: "Immune to secondary effects from enemy moves.",
  },
  [AbilityId.Static]: {
    id: AbilityId.Static,
    name: "Static",
    description: "30% chance to paralyze an attacker on contact.",
  },
  [AbilityId.Pickup]: {
    id: AbilityId.Pickup,
    name: "Pickup",
    description: "10% chance to find an item when defeating an enemy.",
  },
  [AbilityId.SwiftSwim]: {
    id: AbilityId.SwiftSwim,
    name: "Swift Swim",
    description: "Moves faster in rain weather.",
  },
  [AbilityId.Levitate]: {
    id: AbilityId.Levitate,
    name: "Levitate",
    description: "Immune to Ground-type traps.",
  },
  [AbilityId.FlameBody]: {
    id: AbilityId.FlameBody,
    name: "Flame Body",
    description: "30% chance to burn an attacker on contact.",
  },
};

/** Species → Ability mapping */
export const SPECIES_ABILITIES: Record<string, AbilityId> = {
  mudkip: AbilityId.Torrent,
  zubat: AbilityId.Levitate,
  shellos: AbilityId.SwiftSwim,
  corsola: AbilityId.Sturdy,
  geodude: AbilityId.RockHead,
  pikachu: AbilityId.Static,
  voltorb: AbilityId.Static,
  magnemite: AbilityId.Sturdy,
  caterpie: AbilityId.ShieldDust,
  pidgey: AbilityId.RunAway,
  aron: AbilityId.Sturdy,
  meditite: AbilityId.PurePower,
  machop: AbilityId.Guts,
  gastly: AbilityId.Levitate,
  drowzee: AbilityId.NoGuard,
  snorunt: AbilityId.ShieldDust,
  charmander: AbilityId.Torrent, // Blaze doesn't exist, use Torrent as fire equiv
  eevee: AbilityId.RunAway,
  numel: AbilityId.RockHead,
  slugma: AbilityId.FlameBody,
  torkoal: AbilityId.Sturdy,
  murkrow: AbilityId.RunAway,
  sableye: AbilityId.Pickup,
  absol: AbilityId.PurePower,
  chikorita: AbilityId.Torrent, // Overgrow equivalent
  bellsprout: AbilityId.NoGuard,
  shroomish: AbilityId.ShieldDust,
  grimer: AbilityId.Guts,
  nidoranM: AbilityId.PurePower,
  tentacool: AbilityId.SwiftSwim,
  clefairy: AbilityId.ShieldDust,
  jigglypuff: AbilityId.ShieldDust,
  ralts: AbilityId.Static, // Trace equivalent
  dratini: AbilityId.ShieldDust,
  bagon: AbilityId.RockHead,
  gible: AbilityId.RockHead,
  poochyena: AbilityId.RunAway,
  beldum: AbilityId.RockHead,
  skarmory: AbilityId.ShieldDust,
  sandshrew: AbilityId.RockHead,
  trapinch: AbilityId.NoGuard,
  phanpy: AbilityId.Guts,
  horsea: AbilityId.SwiftSwim,
  lotad: AbilityId.SwiftSwim,
  carvanha: AbilityId.Guts,
  elekid: AbilityId.Static,
  mareep: AbilityId.Static,
  wurmple: AbilityId.ShieldDust,
  spinarak: AbilityId.ShieldDust,
  abra: AbilityId.ShieldDust,
  natu: AbilityId.ShieldDust,
  houndour: AbilityId.FlameBody,
  sneasel: AbilityId.Pickup,
  taillow: AbilityId.Guts,
  starly: AbilityId.Guts,
  makuhita: AbilityId.Guts,
  riolu: AbilityId.Sturdy,
  larvitar: AbilityId.Guts,
  nosepass: AbilityId.Sturdy,
  swinub: AbilityId.Pickup,
  spheal: AbilityId.SwiftSwim,
  zigzagoon: AbilityId.Pickup,
  whismur: AbilityId.ShieldDust,
  oddish: AbilityId.ShieldDust,
  budew: AbilityId.Pickup,
  vulpix: AbilityId.FlameBody,
  ponyta: AbilityId.RunAway,
  staryu: AbilityId.SwiftSwim,
  clamperl: AbilityId.ShieldDust,
  shinx: AbilityId.Static,
  electrike: AbilityId.Static,
  gulpin: AbilityId.Guts,
  ekans: AbilityId.ShieldDust,
  cubone: AbilityId.RockHead,
  diglett: AbilityId.NoGuard,
  paras: AbilityId.ShieldDust,
  venonat: AbilityId.ShieldDust,
  shieldon: AbilityId.Sturdy,
  bronzor: AbilityId.Levitate,
  misdreavus: AbilityId.Levitate,
  duskull: AbilityId.Levitate,
  axew: AbilityId.Guts,
  deino: AbilityId.Guts,
  snubbull: AbilityId.Guts,
  togepi: AbilityId.ShieldDust,
  snover: AbilityId.Sturdy,
  bergmite: AbilityId.Sturdy,
  spoink: AbilityId.ShieldDust,
  stunky: AbilityId.ShieldDust,
  purrloin: AbilityId.NoGuard,
  pidove: AbilityId.ShieldDust,
  rufflet: AbilityId.Guts,
  tyrogue: AbilityId.Guts,
  crabrawler: AbilityId.Guts,
  roggenrola: AbilityId.Sturdy,
  rockruff: AbilityId.Guts,
  lillipup: AbilityId.Guts,
  minccino: AbilityId.ShieldDust,
  foongus: AbilityId.ShieldDust,
  petilil: AbilityId.Torrent, // Overgrow equivalent
  feebas: AbilityId.SwiftSwim,
  wailmer: AbilityId.SwiftSwim,
  litwick: AbilityId.FlameBody,
  growlithe: AbilityId.FlameBody,
  joltik: AbilityId.Static,
  tynamo: AbilityId.Levitate,
  trubbish: AbilityId.Guts,
  skorupi: AbilityId.ShieldDust,
};
