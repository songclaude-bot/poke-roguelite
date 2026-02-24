/**
 * Evolution system — certain Pokemon can evolve at specific levels.
 * Evolution grants stat bonuses and may add new skills.
 */

export interface EvolutionDef {
  from: string;       // species ID
  to: string;         // evolved species ID (reuses from or new key)
  level: number;      // minimum level to evolve
  newName: string;    // display name after evolution
  hpBonus: number;    // bonus HP on evolution
  atkBonus: number;   // bonus ATK
  defBonus: number;   // bonus DEF
  newSkillId?: string; // optional new skill learned
}

export const EVOLUTIONS: EvolutionDef[] = [
  { from: "mudkip", to: "marshtomp", level: 16, newName: "Marshtomp", hpBonus: 15, atkBonus: 4, defBonus: 3, newSkillId: "surf" },
  { from: "pikachu", to: "raichu", level: 16, newName: "Raichu", hpBonus: 10, atkBonus: 5, defBonus: 2, newSkillId: "thunderShock" },
  { from: "machop", to: "machoke", level: 16, newName: "Machoke", hpBonus: 15, atkBonus: 5, defBonus: 3, newSkillId: "focusPunch" },
  { from: "geodude", to: "graveler", level: 16, newName: "Graveler", hpBonus: 12, atkBonus: 3, defBonus: 5, newSkillId: "rockThrow" },
  { from: "gastly", to: "haunter", level: 16, newName: "Haunter", hpBonus: 8, atkBonus: 6, defBonus: 2, newSkillId: "shadowBall" },
  { from: "caterpie", to: "butterfree", level: 10, newName: "Butterfree", hpBonus: 12, atkBonus: 4, defBonus: 3, newSkillId: "gust" },
  { from: "pidgey", to: "pidgeotto", level: 14, newName: "Pidgeotto", hpBonus: 10, atkBonus: 4, defBonus: 3, newSkillId: "wingAttack" },
  { from: "aron", to: "lairon", level: 16, newName: "Lairon", hpBonus: 15, atkBonus: 4, defBonus: 6, newSkillId: "ironDefense" },
  { from: "drowzee", to: "hypno", level: 16, newName: "Hypno", hpBonus: 12, atkBonus: 5, defBonus: 4, newSkillId: "psybeam" },
  { from: "charmander", to: "charmeleon", level: 16, newName: "Charmeleon", hpBonus: 12, atkBonus: 5, defBonus: 3, newSkillId: "flamethrower" },
  { from: "eevee", to: "espeon", level: 16, newName: "Espeon", hpBonus: 10, atkBonus: 5, defBonus: 4, newSkillId: "confusion" },
  { from: "slugma", to: "magcargo", level: 16, newName: "Magcargo", hpBonus: 15, atkBonus: 4, defBonus: 6, newSkillId: "lavaSurf" },
  { from: "numel", to: "camerupt", level: 16, newName: "Camerupt", hpBonus: 15, atkBonus: 5, defBonus: 4, newSkillId: "earthPower" },
  { from: "chikorita", to: "bayleef", level: 16, newName: "Bayleef", hpBonus: 12, atkBonus: 3, defBonus: 4, newSkillId: "razorLeaf" },
  { from: "bellsprout", to: "weepinbell", level: 16, newName: "Weepinbell", hpBonus: 10, atkBonus: 5, defBonus: 2, newSkillId: "seedBomb" },
  { from: "shroomish", to: "breloom", level: 16, newName: "Breloom", hpBonus: 12, atkBonus: 6, defBonus: 3, newSkillId: "focusPunch" },
  { from: "snorunt", to: "glalie", level: 16, newName: "Glalie", hpBonus: 12, atkBonus: 5, defBonus: 5, newSkillId: "iceBeam" },
  { from: "grimer", to: "muk", level: 16, newName: "Muk", hpBonus: 15, atkBonus: 5, defBonus: 4, newSkillId: "venoshock" },
  { from: "nidoranM", to: "nidorino", level: 16, newName: "Nidorino", hpBonus: 12, atkBonus: 6, defBonus: 3, newSkillId: "sludgeBomb" },
  { from: "tentacool", to: "tentacruel", level: 16, newName: "Tentacruel", hpBonus: 14, atkBonus: 5, defBonus: 5, newSkillId: "venoshock" },
  { from: "clefairy", to: "clefable", level: 16, newName: "Clefable", hpBonus: 15, atkBonus: 4, defBonus: 5, newSkillId: "moonblast" },
  { from: "jigglypuff", to: "wigglytuff", level: 16, newName: "Wigglytuff", hpBonus: 18, atkBonus: 3, defBonus: 4, newSkillId: "dazzlingGleam" },
  { from: "ralts", to: "kirlia", level: 16, newName: "Kirlia", hpBonus: 10, atkBonus: 7, defBonus: 3, newSkillId: "moonblast" },
  { from: "dratini", to: "dragonair", level: 16, newName: "Dragonair", hpBonus: 12, atkBonus: 6, defBonus: 4, newSkillId: "dragonPulse" },
  { from: "bagon", to: "shelgon", level: 16, newName: "Shelgon", hpBonus: 15, atkBonus: 5, defBonus: 6, newSkillId: "dracoMeteor" },
  { from: "gible", to: "gabite", level: 16, newName: "Gabite", hpBonus: 14, atkBonus: 7, defBonus: 4, newSkillId: "dracoMeteor" },
  { from: "poochyena", to: "mightyena", level: 16, newName: "Mightyena", hpBonus: 14, atkBonus: 6, defBonus: 4, newSkillId: "darkPulse" },
  { from: "beldum", to: "metang", level: 16, newName: "Metang", hpBonus: 16, atkBonus: 5, defBonus: 7, newSkillId: "flashCannon" },
  { from: "aron", to: "lairon", level: 16, newName: "Lairon", hpBonus: 18, atkBonus: 5, defBonus: 8, newSkillId: "ironHead" },
  { from: "sandshrew", to: "sandslash", level: 16, newName: "Sandslash", hpBonus: 14, atkBonus: 6, defBonus: 6, newSkillId: "earthPower" },
  { from: "trapinch", to: "vibrava", level: 16, newName: "Vibrava", hpBonus: 12, atkBonus: 7, defBonus: 4, newSkillId: "earthPower" },
  { from: "phanpy", to: "donphan", level: 16, newName: "Donphan", hpBonus: 16, atkBonus: 6, defBonus: 6, newSkillId: "earthPower" },
  { from: "horsea", to: "seadra", level: 16, newName: "Seadra", hpBonus: 12, atkBonus: 7, defBonus: 5, newSkillId: "brine" },
  { from: "lotad", to: "lombre", level: 16, newName: "Lombre", hpBonus: 14, atkBonus: 5, defBonus: 5, newSkillId: "waterPulse" },
  { from: "carvanha", to: "sharpedo", level: 16, newName: "Sharpedo", hpBonus: 12, atkBonus: 8, defBonus: 3, newSkillId: "darkPulse" },
  { from: "elekid", to: "electabuzz", level: 16, newName: "Electabuzz", hpBonus: 14, atkBonus: 7, defBonus: 4, newSkillId: "thunderbolt" },
  { from: "mareep", to: "flaaffy", level: 16, newName: "Flaaffy", hpBonus: 14, atkBonus: 6, defBonus: 5, newSkillId: "thunderbolt" },
  { from: "wurmple", to: "silcoon", level: 10, newName: "Silcoon", hpBonus: 8, atkBonus: 3, defBonus: 5, newSkillId: "signalBeam" },
  { from: "spinarak", to: "ariados", level: 16, newName: "Ariados", hpBonus: 14, atkBonus: 6, defBonus: 5, newSkillId: "signalBeam" },
  { from: "abra", to: "kadabra", level: 14, newName: "Kadabra", hpBonus: 10, atkBonus: 8, defBonus: 4, newSkillId: "psychic" },
  { from: "natu", to: "xatu", level: 16, newName: "Xatu", hpBonus: 14, atkBonus: 6, defBonus: 5, newSkillId: "psychic" },
  { from: "houndour", to: "houndoom", level: 16, newName: "Houndoom", hpBonus: 14, atkBonus: 6, defBonus: 4, newSkillId: "flamethrower" },
  { from: "sneasel", to: "weavile", level: 16, newName: "Weavile", hpBonus: 12, atkBonus: 8, defBonus: 4, newSkillId: "darkPulse" },
  { from: "taillow", to: "swellow", level: 16, newName: "Swellow", hpBonus: 12, atkBonus: 7, defBonus: 4, newSkillId: "braveBird" },
  { from: "starly", to: "staravia", level: 14, newName: "Staravia", hpBonus: 10, atkBonus: 6, defBonus: 4, newSkillId: "airSlash" },
  { from: "makuhita", to: "hariyama", level: 16, newName: "Hariyama", hpBonus: 18, atkBonus: 6, defBonus: 4, newSkillId: "focusPunch" },
  { from: "riolu", to: "lucario", level: 14, newName: "Lucario", hpBonus: 12, atkBonus: 8, defBonus: 5, newSkillId: "auraSphere" },
  { from: "larvitar", to: "pupitar", level: 16, newName: "Pupitar", hpBonus: 15, atkBonus: 5, defBonus: 7, newSkillId: "stoneEdge" },
  { from: "swinub", to: "piloswine", level: 16, newName: "Piloswine", hpBonus: 16, atkBonus: 5, defBonus: 5, newSkillId: "avalanche" },
  { from: "spheal", to: "sealeo", level: 16, newName: "Sealeo", hpBonus: 15, atkBonus: 5, defBonus: 6, newSkillId: "iceBeam" },
  { from: "zigzagoon", to: "linoone", level: 14, newName: "Linoone", hpBonus: 12, atkBonus: 6, defBonus: 4, newSkillId: "headbutt" },
  { from: "whismur", to: "loudred", level: 16, newName: "Loudred", hpBonus: 14, atkBonus: 6, defBonus: 4, newSkillId: "hyperVoice" },
  { from: "oddish", to: "gloom", level: 14, newName: "Gloom", hpBonus: 12, atkBonus: 5, defBonus: 5, newSkillId: "petalDance" },
  { from: "budew", to: "roselia", level: 14, newName: "Roselia", hpBonus: 10, atkBonus: 7, defBonus: 4, newSkillId: "energyBall" },
  { from: "vulpix", to: "ninetales", level: 14, newName: "Ninetales", hpBonus: 12, atkBonus: 8, defBonus: 5, newSkillId: "flamethrower" },
  { from: "ponyta", to: "rapidash", level: 14, newName: "Rapidash", hpBonus: 14, atkBonus: 9, defBonus: 4, newSkillId: "fireBlast" },
  { from: "staryu", to: "starmie", level: 14, newName: "Starmie", hpBonus: 10, atkBonus: 8, defBonus: 5, newSkillId: "surf" },
  { from: "clamperl", to: "huntail", level: 14, newName: "Huntail", hpBonus: 12, atkBonus: 9, defBonus: 5, newSkillId: "surf" },
  { from: "shinx", to: "luxio", level: 14, newName: "Luxio", hpBonus: 12, atkBonus: 8, defBonus: 4, newSkillId: "wildCharge" },
  { from: "electrike", to: "manectric", level: 14, newName: "Manectric", hpBonus: 10, atkBonus: 9, defBonus: 4, newSkillId: "thunderbolt" },
  { from: "gulpin", to: "swalot", level: 14, newName: "Swalot", hpBonus: 15, atkBonus: 7, defBonus: 6, newSkillId: "sludgeBomb" },
  { from: "ekans", to: "arbok", level: 14, newName: "Arbok", hpBonus: 12, atkBonus: 9, defBonus: 4, newSkillId: "venoshock" },
  { from: "cubone", to: "marowak", level: 14, newName: "Marowak", hpBonus: 12, atkBonus: 9, defBonus: 5, newSkillId: "earthPower" },
  { from: "diglett", to: "dugtrio", level: 14, newName: "Dugtrio", hpBonus: 8, atkBonus: 10, defBonus: 3, newSkillId: "earthPower" },
  { from: "paras", to: "parasect", level: 14, newName: "Parasect", hpBonus: 12, atkBonus: 8, defBonus: 6, newSkillId: "xScissor" },
  { from: "venonat", to: "venomoth", level: 14, newName: "Venomoth", hpBonus: 10, atkBonus: 8, defBonus: 4, newSkillId: "signalBeam" },
  { from: "shieldon", to: "bastiodon", level: 14, newName: "Bastiodon", hpBonus: 15, atkBonus: 5, defBonus: 10, newSkillId: "flashCannon" },
  { from: "bronzor", to: "bronzong", level: 14, newName: "Bronzong", hpBonus: 12, atkBonus: 7, defBonus: 8, newSkillId: "flashCannon" },
  { from: "misdreavus", to: "mismagius", level: 14, newName: "Mismagius", hpBonus: 10, atkBonus: 9, defBonus: 4, newSkillId: "shadowBall" },
  { from: "duskull", to: "dusclops", level: 14, newName: "Dusclops", hpBonus: 14, atkBonus: 6, defBonus: 8, newSkillId: "shadowBall" },
  { from: "axew", to: "fraxure", level: 14, newName: "Fraxure", hpBonus: 12, atkBonus: 10, defBonus: 4, newSkillId: "dragonRush" },
  { from: "deino", to: "zweilous", level: 14, newName: "Zweilous", hpBonus: 14, atkBonus: 8, defBonus: 6, newSkillId: "dragonPulse" },
  { from: "snubbull", to: "granbull", level: 14, newName: "Granbull", hpBonus: 12, atkBonus: 10, defBonus: 5, newSkillId: "playRough" },
  { from: "togepi", to: "togetic", level: 14, newName: "Togetic", hpBonus: 10, atkBonus: 7, defBonus: 7, newSkillId: "moonblast" },
  { from: "snover", to: "abomasnow", level: 14, newName: "Abomasnow", hpBonus: 14, atkBonus: 8, defBonus: 6, newSkillId: "iceBeam" },
  { from: "bergmite", to: "avalugg", level: 14, newName: "Avalugg", hpBonus: 16, atkBonus: 6, defBonus: 10, newSkillId: "iceHammer" },
  { from: "spoink", to: "grumpig", level: 14, newName: "Grumpig", hpBonus: 12, atkBonus: 7, defBonus: 7, newSkillId: "psychic" },
  { from: "stunky", to: "skuntank", level: 14, newName: "Skuntank", hpBonus: 14, atkBonus: 8, defBonus: 6, newSkillId: "darkPulse" },
  { from: "purrloin", to: "liepard", level: 14, newName: "Liepard", hpBonus: 10, atkBonus: 10, defBonus: 4, newSkillId: "foulPlay" },
  { from: "pidove", to: "tranquill", level: 14, newName: "Tranquill", hpBonus: 10, atkBonus: 8, defBonus: 6, newSkillId: "hurricane" },
  { from: "rufflet", to: "braviary", level: 14, newName: "Braviary", hpBonus: 14, atkBonus: 10, defBonus: 4, newSkillId: "bravebird" },
  { from: "tyrogue", to: "hitmonchan", level: 14, newName: "Hitmonchan", hpBonus: 10, atkBonus: 10, defBonus: 6, newSkillId: "closeCombat" },
  { from: "crabrawler", to: "crabominable", level: 14, newName: "Crabominable", hpBonus: 16, atkBonus: 10, defBonus: 4, newSkillId: "hammerArm" },
  { from: "roggenrola", to: "boldore", level: 14, newName: "Boldore", hpBonus: 14, atkBonus: 8, defBonus: 8, newSkillId: "rockWrecker" },
  { from: "rockruff", to: "lycanroc", level: 14, newName: "Lycanroc", hpBonus: 10, atkBonus: 12, defBonus: 4, newSkillId: "stoneEdge" },
  { from: "lillipup", to: "herdier", level: 14, newName: "Herdier", hpBonus: 12, atkBonus: 8, defBonus: 6, newSkillId: "triAttack" },
  { from: "minccino", to: "cinccino", level: 14, newName: "Cinccino", hpBonus: 10, atkBonus: 8, defBonus: 6, newSkillId: "hyperVoice" },
  { from: "foongus", to: "amoonguss", level: 14, newName: "Amoonguss", hpBonus: 16, atkBonus: 6, defBonus: 8, newSkillId: "energyBall" },
  { from: "petilil", to: "lilligant", level: 14, newName: "Lilligant", hpBonus: 10, atkBonus: 10, defBonus: 4, newSkillId: "petalDance" },
  { from: "feebas", to: "milotic", level: 14, newName: "Milotic", hpBonus: 12, atkBonus: 8, defBonus: 8, newSkillId: "dive" },
  { from: "wailmer", to: "wailord", level: 14, newName: "Wailord", hpBonus: 20, atkBonus: 6, defBonus: 6, newSkillId: "brine" },
];

/** Check if a species can evolve at a given level */
export function getEvolution(speciesId: string, level: number): EvolutionDef | null {
  return EVOLUTIONS.find(e => e.from === speciesId && level >= e.level) ?? null;
}
