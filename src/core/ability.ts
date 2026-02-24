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
  mudbray: AbilityId.Guts,
  hippopotas: AbilityId.RockHead,
  dwebble: AbilityId.Sturdy,
  binacle: AbilityId.Guts,
  nincada: AbilityId.RockHead,
  venipede: AbilityId.ShieldDust,
  mienfoo: AbilityId.PurePower,
  timburr: AbilityId.Guts,
  klink: AbilityId.Sturdy,
  ferroseed: AbilityId.Sturdy,
  phantump: AbilityId.Levitate,
  honedge: AbilityId.NoGuard,
  solosis: AbilityId.ShieldDust,
  elgyem: AbilityId.ShieldDust,
  cryogonal: AbilityId.Levitate,
  cubchoo: AbilityId.Torrent, // SlushRush equivalent
  sandile: AbilityId.Guts, // Intimidate equivalent
  inkay: AbilityId.ShieldDust, // Contrary equivalent
  spritzee: AbilityId.ShieldDust, // Healer equivalent
  swirlix: AbilityId.Torrent, // SweetVeil equivalent
  goomy: AbilityId.Torrent, // SapSipper equivalent
  jangmoo: AbilityId.Sturdy, // Bulletproof equivalent
  noibat: AbilityId.Levitate, // Infiltrator equivalent
  vullaby: AbilityId.Sturdy, // Overcoat equivalent
  stufful: AbilityId.Guts, // Fluffy equivalent
  furfrou: AbilityId.ShieldDust, // FurCoat equivalent
  wimpod: AbilityId.SwiftSwim, // WimpOut equivalent
  tympole: AbilityId.SwiftSwim,
  salandit: AbilityId.FlameBody, // Corrosion equivalent
  larvesta: AbilityId.FlameBody,
  fomantis: AbilityId.Torrent, // Contrary equivalent
  morelull: AbilityId.ShieldDust, // Effect Spore equivalent
  charjabug: AbilityId.Sturdy, // Battery equivalent
  helioptile: AbilityId.Static, // Dry Skin equivalent
  mareanie: AbilityId.Sturdy, // Regenerator equivalent
  croagunk: AbilityId.Guts, // Dry Skin equivalent
  sandygast: AbilityId.Levitate, // Water Compaction equivalent
  silicobra: AbilityId.Sturdy, // Shed Skin equivalent
  carbink: AbilityId.Sturdy, // Clear Body equivalent
  minior: AbilityId.ShieldDust, // Shields Down equivalent
  dewpider: AbilityId.SwiftSwim, // Water Bubble equivalent
  sizzlipede: AbilityId.FlameBody,
  pancham: AbilityId.Guts, // Iron Fist equivalent
  hawlucha: AbilityId.PurePower, // Unburden equivalent
  durant: AbilityId.Sturdy, // Hustle equivalent
  togedemaru: AbilityId.Static, // Iron Barbs equivalent
  drifloon: AbilityId.Levitate, // Aftermath equivalent
  golett: AbilityId.Sturdy, // Iron Fist equivalent
  hatenna: AbilityId.ShieldDust, // Magic Bounce equivalent
  indeedee: AbilityId.PurePower, // Inner Focus equivalent
  vanillite: AbilityId.ShieldDust, // Ice Body equivalent
  snom: AbilityId.ShieldDust, // Ice Scales equivalent
  nickit: AbilityId.Pickup, // Run Away equivalent
  impidimp: AbilityId.Guts, // Prankster equivalent
  milcery: AbilityId.ShieldDust, // Sweet Veil equivalent
  comfey: AbilityId.ShieldDust, // Triage equivalent
  turtonator: AbilityId.Sturdy, // Shell Armor equivalent
  drampa: AbilityId.Guts, // Berserk equivalent
  rookidee: AbilityId.Guts, // Big Pecks equivalent
  archen: AbilityId.Guts, // Defeatist equivalent
  wooloo: AbilityId.Pickup, // Fluffy equivalent
  skwovet: AbilityId.Pickup, // Cheek Pouch equivalent
  bruxish: AbilityId.PurePower, // Strong Jaw equivalent
  chewtle: AbilityId.Sturdy, // Strong Jaw equivalent
  litleo: AbilityId.Guts, // Unnerve equivalent
  torchic: AbilityId.Torrent, // Speed Boost → Torrent equivalent
  gossifleur: AbilityId.ShieldDust, // Cotton Down equivalent
  bounsweet: AbilityId.ShieldDust, // Leaf Guard equivalent
  yamper: AbilityId.Static, // Ball Fetch equivalent
  pincurchin: AbilityId.Static,
  skrelp: AbilityId.ShieldDust, // Poison Point equivalent
  toxel: AbilityId.Static, // Rattled equivalent
  drilbur: AbilityId.Guts, // Sand Rush equivalent
  barboach: AbilityId.SwiftSwim, // Oblivious equivalent
  // Phase 124-126: Rock/Bug/Fighting 5th
  nacli: AbilityId.Sturdy,
  tyrunt: AbilityId.Guts, // StrongJaw equivalent
  blipbug: AbilityId.ShieldDust, // CompoundEyes equivalent
  cutiefly: AbilityId.ShieldDust,
  clobbopus: AbilityId.Guts, // Limber equivalent
  passimian: AbilityId.PurePower, // Defiant equivalent
  // Phase 127-129: Steel/Ghost/Psychic 5th
  tinkatink: AbilityId.ShieldDust, // Mold Breaker equivalent
  varoom: AbilityId.FlameBody, // Overcoat equivalent (engine/exhaust)
  greavard: AbilityId.Pickup, // Fluffy equivalent
  sinistea: AbilityId.ShieldDust, // Weak Armor equivalent
  flittle: AbilityId.RunAway, // Speed Boost equivalent
  espurr: AbilityId.ShieldDust, // Keen Eye equivalent
  // Phase 130-132: Ice/Dark/Fairy 5th
  cetoddle: AbilityId.Sturdy, // Thick Fat equivalent
  frigibax: AbilityId.RockHead, // Thermal Exchange equivalent
  zorua: AbilityId.RunAway, // Illusion equivalent
  pawniard: AbilityId.PurePower, // Defiant equivalent
  fidough: AbilityId.ShieldDust, // Own Tempo equivalent
  dedenne: AbilityId.Static, // Cheek Pouch equivalent
  // Phase 133-135: Dragon/Flying/Normal 5th
  cyclizar: AbilityId.ShieldDust, // Shed Skin equivalent
  tatsugiri: AbilityId.SwiftSwim, // Commander equivalent
  wingull: AbilityId.SwiftSwim, // Hydration equivalent
  swablu: AbilityId.ShieldDust, // Natural Cure equivalent
  lechonk: AbilityId.Pickup, // Aroma Veil equivalent
  tandemaus: AbilityId.Pickup, // Run Away equivalent
  // Phase 137-139: Water/Fire/Grass/Electric/Poison/Ground 6th
  buizel: AbilityId.SwiftSwim,
  finizen: AbilityId.SwiftSwim, // Water Veil equivalent
  fletchinder: AbilityId.FlameBody, // Flame Body
  heatmor: AbilityId.FlameBody, // Flash Fire equivalent
  smoliv: AbilityId.ShieldDust, // Harvest equivalent
  deerling: AbilityId.RunAway, // Sap Sipper equivalent
  pachirisu: AbilityId.Static, // Volt Absorb equivalent
  emolga: AbilityId.Static, // Motor Drive equivalent
  glimmet: AbilityId.Sturdy, // Toxic Debris equivalent
  koffing: AbilityId.Levitate,
  wooper: AbilityId.SwiftSwim, // Water Absorb equivalent
  baltoy: AbilityId.Levitate,
  // Phase 140-142: Rock/Bug/Fighting/Steel/Ghost/Psychic 6th
  anorith: AbilityId.Sturdy, // Battle Armor equivalent
  lunatone: AbilityId.Levitate,
  surskit: AbilityId.SwiftSwim, // Rain Dish equivalent
  volbeat: AbilityId.ShieldDust, // Illuminate equivalent
  scraggy: AbilityId.Guts, // Moxie equivalent
  mankey: AbilityId.Guts, // Vital Spirit equivalent
  klefki: AbilityId.ShieldDust, // Prankster equivalent
  mawile: AbilityId.Sturdy, // Intimidate equivalent
  rotom: AbilityId.Levitate,
  dreepy: AbilityId.RunAway, // Clear Body equivalent
  munna: AbilityId.ShieldDust, // Synchronize equivalent
  chingling: AbilityId.Levitate,
  // Phase 143-145: Ice/Dark/Fairy/Dragon/Flying/Normal 6th
  smoochum: AbilityId.ShieldDust, // Oblivious equivalent
  delibird: AbilityId.Pickup, // Vital Spirit equivalent
  nuzleaf: AbilityId.Pickup, // Chlorophyll equivalent
  spiritomb: AbilityId.Sturdy, // Pressure equivalent
  marill: AbilityId.SwiftSwim, // Huge Power equivalent
  cleffa: AbilityId.ShieldDust, // Magic Guard equivalent
  druddigon: AbilityId.Guts, // Rough Skin equivalent
  applin: AbilityId.Sturdy, // Ripen equivalent
  hoppip: AbilityId.RunAway, // Chlorophyll equivalent
  tropius: AbilityId.Torrent, // Harvest equivalent
  aipom: AbilityId.Pickup, // Run Away equivalent
  smeargle: AbilityId.ShieldDust, // Own Tempo equivalent
  // Phase 148-150: Water/Fire/Grass/Electric/Poison/Ground 7th
  poliwag: AbilityId.SwiftSwim, // Water Absorb equivalent
  corphish: AbilityId.Guts, // Adaptability equivalent
  magby: AbilityId.FlameBody,
  darumaka: AbilityId.Guts, // Hustle equivalent
  sewaddle: AbilityId.ShieldDust, // Swarm equivalent
  pumpkaboo: AbilityId.Levitate, // Frisk equivalent
  plusle: AbilityId.Static, // Plus equivalent
  minun: AbilityId.Static, // Minus equivalent
  nidoranF: AbilityId.PurePower, // Poison Point equivalent
  seviper: AbilityId.Guts, // Shed Skin equivalent
  gligar: AbilityId.Levitate, // Hyper Cutter equivalent
  rhyhorn: AbilityId.RockHead, // Lightning Rod equivalent
  // Phase 151-153: Rock/Bug/Fighting/Steel/Ghost/Psychic 7th tier
  sudowoodo: AbilityId.Sturdy, // Rock Head equivalent
  boldore: AbilityId.Sturdy,
  pineco: AbilityId.Sturdy, // Overcoat equivalent
  heracross: AbilityId.Guts, // Moxie equivalent
  hitmonlee: AbilityId.PurePower, // Limber equivalent
  hitmonchan: AbilityId.Guts, // Iron Fist equivalent
  steelix: AbilityId.Sturdy, // Rock Head equivalent
  scizor: AbilityId.ShieldDust, // Technician equivalent
  banette: AbilityId.Guts, // Cursed Body equivalent
  shedinja: AbilityId.ShieldDust, // Wonder Guard equivalent
  slowpoke: AbilityId.ShieldDust, // Own Tempo equivalent
  girafarig: AbilityId.ShieldDust, // Inner Focus equivalent
  // Phase 154-156: Ice/Dark/Fairy/Dragon/Flying/Normal 7th
  glaceon: AbilityId.ShieldDust, // Ice Body equivalent
  beartic: AbilityId.Guts, // Snow Cloak equivalent
  umbreon: AbilityId.ShieldDust, // Synchronize equivalent
  cacturne: AbilityId.Pickup, // Sand Veil equivalent
  granbull: AbilityId.Guts, // Intimidate equivalent
  togekiss: AbilityId.ShieldDust, // Serene Grace equivalent
  shelgon: AbilityId.RockHead, // Rock Head
  gabite: AbilityId.RockHead, // Rough Skin equivalent
  noctowl: AbilityId.ShieldDust, // Insomnia equivalent
  xatu: AbilityId.ShieldDust, // Synchronize equivalent
  kangaskhan: AbilityId.Guts, // Scrappy equivalent
  tauros: AbilityId.Guts, // Intimidate equivalent
  // Phase 158-160: 8th Tier
  psyduck: AbilityId.SwiftSwim, // Cloud Nine equivalent
  seel: AbilityId.SwiftSwim, // Thick Fat equivalent
  cyndaquil: AbilityId.FlameBody, // Blaze equivalent
  fennekin: AbilityId.FlameBody, // Blaze equivalent
  sunkern: AbilityId.ShieldDust, // Chlorophyll equivalent
  cacnea: AbilityId.Guts, // Sand Veil equivalent
  pichu: AbilityId.Static,
  chinchou: AbilityId.Static, // Volt Absorb equivalent
  weedle: AbilityId.ShieldDust, // Shield Dust
  qwilfish: AbilityId.Guts, // Intimidate equivalent
  donphan: AbilityId.Sturdy,
  marowak: AbilityId.RockHead, // Lightning Rod equivalent
  // Phase 161-163: 8th Tier
  onix: AbilityId.Sturdy,
  omanyte: AbilityId.SwiftSwim,
  scyther: AbilityId.Guts,
  pinsir: AbilityId.Guts,
  medicham: AbilityId.PurePower,
  lucario: AbilityId.Guts,
  metang: AbilityId.Sturdy,
  lairon: AbilityId.Sturdy,
  gengar: AbilityId.Levitate,
  chandelure: AbilityId.FlameBody,
  alakazam: AbilityId.ShieldDust,
  gardevoir: AbilityId.ShieldDust,
  omastar: AbilityId.SwiftSwim,
  metagross: AbilityId.Sturdy,
  aggron: AbilityId.Sturdy,
  // Phase 164-166: 8th Tier Ice/Dark/Fairy/Dragon/Flying/Normal
  lapras: AbilityId.SwiftSwim, // Water Absorb equivalent
  weavile: AbilityId.PurePower, // Pressure equivalent
  honchkrow: AbilityId.Guts, // Super Luck equivalent
  houndoom: AbilityId.FlameBody, // Flash Fire equivalent
  florges: AbilityId.ShieldDust, // Flower Veil equivalent
  mimikyu: AbilityId.Sturdy, // Disguise equivalent
  dragonite: AbilityId.PurePower, // Inner Focus equivalent
  flygon: AbilityId.Levitate,
  staraptor: AbilityId.Guts, // Intimidate equivalent
  braviary: AbilityId.Guts, // Sheer Force equivalent
  snorlax: AbilityId.Sturdy, // Thick Fat equivalent
  zangoose: AbilityId.Guts, // Immunity equivalent
  // Phase 168-170: 9th Tier Water/Fire/Grass/Electric/Poison/Ground
  gyarados: AbilityId.Guts, // Intimidate equivalent
  kingdra: AbilityId.SwiftSwim, // Sniper equivalent
  blaziken: AbilityId.PurePower, // Speed Boost equivalent
  typhlosion: AbilityId.FlameBody, // Blaze equivalent
  venusaur: AbilityId.Torrent, // Overgrow equivalent
  sceptile: AbilityId.PurePower, // Unburden equivalent
  jolteon: AbilityId.Static, // Volt Absorb equivalent
  ampharos: AbilityId.Static, // Plus equivalent
  nidoking: AbilityId.Guts, // Sheer Force equivalent
  crobat: AbilityId.Levitate, // Inner Focus equivalent
  krookodile: AbilityId.Guts, // Intimidate equivalent
  nidoqueen: AbilityId.Sturdy, // Poison Point equivalent
  // Phase 171-173: 9th Tier Rock/Bug/Fighting/Steel/Ghost/Psychic
  tyranitar: AbilityId.Guts, // Sand Stream equivalent
  aerodactyl: AbilityId.RockHead, // Rock Head
  yanmega: AbilityId.PurePower, // Speed Boost equivalent
  scolipede: AbilityId.PurePower, // Speed Boost equivalent
  conkeldurr: AbilityId.Guts, // Guts
  machamp: AbilityId.NoGuard, // No Guard
  magnezone: AbilityId.Sturdy, // Sturdy
  empoleon: AbilityId.Sturdy, // Defiant equivalent
  dusknoir: AbilityId.Levitate, // Pressure equivalent
  cofagrigus: AbilityId.FlameBody, // Mummy equivalent (burns on contact)
  reuniclus: AbilityId.ShieldDust, // Magic Guard equivalent
  gothitelle: AbilityId.ShieldDust, // Shadow Tag equivalent
  // Phase 174-176: 9th Tier Ice/Dark/Fairy/Dragon/Flying/Normal
  mamoswine: AbilityId.RockHead, // Thick Fat equivalent
  walrein: AbilityId.Sturdy, // Thick Fat equivalent
  darkrai: AbilityId.PurePower, // Bad Dreams equivalent
  hydreigon: AbilityId.Guts, // Levitate equivalent
  sylveon: AbilityId.ShieldDust, // Cute Charm equivalent
  hatterene: AbilityId.ShieldDust, // Magic Bounce equivalent
  haxorus: AbilityId.PurePower, // Mold Breaker equivalent
  goodra: AbilityId.Guts, // Sap Sipper equivalent
  pidgeot: AbilityId.Guts, // Big Pecks equivalent
  noivern: AbilityId.Levitate, // Infiltrator equivalent
  blissey: AbilityId.Sturdy, // Natural Cure equivalent
  porygonZ: AbilityId.PurePower, // Adaptability equivalent
  // Phase 178-180: 10th Tier Water/Fire/Grass/Electric/Poison/Ground
  blastoise: AbilityId.Torrent, // Torrent
  feraligatr: AbilityId.Guts, // Sheer Force equivalent
  charizard: AbilityId.FlameBody, // Blaze equivalent
  delphox: AbilityId.FlameBody, // Blaze equivalent
  torterra: AbilityId.Sturdy, // Overgrow equivalent
  serperior: AbilityId.PurePower, // Contrary equivalent
  electivire: AbilityId.Guts, // Motor Drive equivalent
  luxray: AbilityId.Guts, // Intimidate equivalent
  roserade: AbilityId.PurePower, // Technician equivalent
  vileplume: AbilityId.ShieldDust, // Effect Spore equivalent
  rhyperior: AbilityId.Sturdy, // Solid Rock equivalent
  dugtrio: AbilityId.NoGuard, // Arena Trap equivalent
  // Phase 181-183: 10th Tier Rock/Bug/Fighting/Steel/Ghost/Psychic
  golem: AbilityId.Sturdy, // Sturdy
  terrakion: AbilityId.PurePower, // Justified equivalent
  pheromosa: AbilityId.PurePower, // Beast Boost equivalent
  escavalier: AbilityId.Sturdy, // Shell Armor equivalent
  kommoo: AbilityId.Guts, // Bulletproof equivalent
  gallade: AbilityId.PurePower, // Sharpness equivalent
  corviknight: AbilityId.Sturdy, // Mirror Armor equivalent
  bastiodon: AbilityId.Sturdy, // Sturdy
  aegislash: AbilityId.NoGuard, // Stance Change equivalent
  jellicent: AbilityId.SwiftSwim, // Water Absorb equivalent
  slowking: AbilityId.ShieldDust, // Own Tempo equivalent
  bronzong: AbilityId.Levitate, // Levitate
  // Phase 184-186: 10th Tier Ice/Dark/Fairy/Dragon/Flying/Normal
  froslass: AbilityId.Levitate, // Snow Cloak equivalent
  abomasnow: AbilityId.Sturdy, // Snow Warning equivalent
  sharpedo: AbilityId.PurePower, // Speed Boost equivalent
  zoroark: AbilityId.PurePower, // Illusion equivalent
  primarina: AbilityId.Torrent, // Torrent
  diancie: AbilityId.Sturdy, // Clear Body equivalent
  dragapult: AbilityId.Levitate, // Clear Body equivalent
  duraludon: AbilityId.Sturdy, // Stalwart equivalent
  swellow: AbilityId.Guts, // Guts
  talonflame: AbilityId.FlameBody, // Flame Body
  slaking: AbilityId.PurePower, // Truant → compensated with raw power
  lopunny: AbilityId.Guts, // Limber equivalent
  // Phase 188-190: 11th Tier Water/Fire/Grass/Electric/Poison/Ground
  suicune: AbilityId.SwiftSwim, // Pressure equivalent
  lugia: AbilityId.Sturdy, // Multiscale equivalent
  hooh: AbilityId.FlameBody, // Regenerator equivalent
  entei: AbilityId.PurePower, // Pressure equivalent
  celebi: AbilityId.ShieldDust, // Natural Cure equivalent
  virizion: AbilityId.PurePower, // Justified equivalent
  raikou: AbilityId.Static, // Pressure equivalent
  zekrom: AbilityId.PurePower, // Teravolt equivalent
  nihilego: AbilityId.Sturdy, // Beast Boost equivalent
  naganadel: AbilityId.PurePower, // Beast Boost equivalent
  groudon: AbilityId.Sturdy, // Drought equivalent
  landorus: AbilityId.Guts, // Sand Force equivalent
  // Phase 191-193: 11th Tier Rock/Bug/Fighting/Steel/Ghost/Psychic
  regirock: AbilityId.Sturdy, // Clear Body equivalent
  stakataka: AbilityId.Sturdy, // Beast Boost equivalent
  genesect: AbilityId.PurePower, // Download equivalent
  buzzwole: AbilityId.Guts, // Beast Boost equivalent
  cobalion: AbilityId.Sturdy, // Justified equivalent
  marshadow: AbilityId.PurePower, // Technician equivalent
  registeel: AbilityId.Sturdy, // Clear Body equivalent
  solgaleo: AbilityId.PurePower, // Full Metal Body equivalent
  giratina: AbilityId.Levitate, // Pressure equivalent
  lunala: AbilityId.ShieldDust, // Shadow Shield equivalent
  mewtwo: AbilityId.PurePower, // Pressure equivalent
  deoxys: AbilityId.PurePower, // Pressure equivalent
  // Phase 194-196: 11th Tier Ice/Dark/Fairy/Dragon/Flying/Normal
  regice: AbilityId.Sturdy, // Clear Body equivalent
  kyurem: AbilityId.PurePower, // Pressure equivalent
  yveltal: AbilityId.PurePower, // Dark Aura equivalent
  hoopa: AbilityId.PurePower, // Magician equivalent
  xerneas: AbilityId.PurePower, // Fairy Aura equivalent
  magearna: AbilityId.Sturdy, // Soul-Heart equivalent
  rayquaza: AbilityId.PurePower, // Air Lock equivalent
  dialga: AbilityId.Sturdy, // Pressure equivalent
  tornadus: AbilityId.Guts, // Defiant equivalent
  articuno: AbilityId.ShieldDust, // Pressure equivalent
  arceus: AbilityId.PurePower, // Multitype equivalent
  regigigas: AbilityId.Sturdy, // Slow Start equivalent
  // Phase 198-200: 12th Tier (FINAL) Water/Fire/Grass/Electric/Poison/Ground
  kyogre: AbilityId.SwiftSwim, // Drizzle equivalent
  palkia: AbilityId.PurePower, // Pressure equivalent
  reshiram: AbilityId.FlameBody, // Turboblaze equivalent
  victini: AbilityId.PurePower, // Victory Star equivalent
  shaymin: AbilityId.ShieldDust, // Natural Cure equivalent
  tapuBulu: AbilityId.PurePower, // Grassy Surge equivalent
  thundurus: AbilityId.Static, // Prankster equivalent
  zeraora: AbilityId.PurePower, // Volt Absorb equivalent
  eternatus: AbilityId.Sturdy, // Pressure equivalent
  poipole: AbilityId.PurePower, // Beast Boost equivalent
  zygarde: AbilityId.Sturdy, // Aura Break equivalent
  excadrill: AbilityId.Guts, // Sand Rush equivalent
  // Phase 201-203: 12th Tier Rock/Bug/Fighting/Steel/Ghost/Psychic
  lycanroc: AbilityId.Guts,
  gigalith: AbilityId.Sturdy,
  volcarona: AbilityId.FlameBody,
  golisopod: AbilityId.Sturdy,
  urshifu: AbilityId.PurePower,
  keldeo: AbilityId.Guts,
  heatran: AbilityId.FlameBody,
  kartana: AbilityId.PurePower,
  spectrier: AbilityId.PurePower,
  polteageist: AbilityId.ShieldDust,
  mew: AbilityId.ShieldDust,
  cresselia: AbilityId.Levitate,
  // Phase 204-206: 12th Tier (FINAL) Ice/Dark/Fairy/Dragon/Flying/Normal
  calyrexIce: AbilityId.PurePower, // As High King equivalent
  cloyster: AbilityId.Sturdy, // Shell Armor equivalent
  grimmsnarl: AbilityId.PurePower, // Prankster equivalent
  incineroar: AbilityId.Guts, // Intimidate equivalent
  zacian: AbilityId.PurePower, // Intrepid Sword equivalent
  tapuLele: AbilityId.ShieldDust, // Psychic Surge equivalent
  garchomp: AbilityId.Guts, // Rough Skin equivalent
  latios: AbilityId.Levitate, // Levitate
  zapdos: AbilityId.Static, // Static / Pressure
  moltres: AbilityId.FlameBody, // Flame Body equivalent
  silvally: AbilityId.PurePower, // RKS System equivalent
  meloetta: AbilityId.ShieldDust, // Serene Grace equivalent
};
