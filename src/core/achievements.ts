export interface Achievement {
  id: string;
  name: string;
  description: string;
  condition: (stats: PlayerStats) => boolean;
  icon: string;  // emoji-like text symbol
}

export interface PlayerStats {
  totalRuns: number;
  totalClears: number;
  totalGold: number;
  bestFloor: number;
  totalEnemiesDefeated: number;
  totalTurns: number;
  endlessBestFloor: number;
  challengeClears: number;
  uniqueStartersUsed: number;
  // New feature stats
  totalShrinesUsed: number;
  maxActiveBlessings: number;
  dungeonsClearedWithCurses: number;
  forgeLevel: number;
  uniqueTypeGemsUsed: number;
  totalRescues: number;
  totalEliteDefeated: number;
  totalShadowDefeated: number;
  totalAncientDefeated: number;
  bestChainTier: string;
  totalPuzzlesSolved: number;
  maxRelicsHeld: number;
  totalAllyEvolutions: number;
  bestTurnClear: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  // Run milestones
  { id: "firstRun", name: "First Steps", description: "Complete your first dungeon run", condition: s => s.totalRuns >= 1, icon: "I" },
  { id: "tenRuns", name: "Adventurer", description: "Complete 10 dungeon runs", condition: s => s.totalRuns >= 10, icon: "II" },
  { id: "fiftyRuns", name: "Veteran Explorer", description: "Complete 50 dungeon runs", condition: s => s.totalRuns >= 50, icon: "III" },
  { id: "hundredRuns", name: "Dungeon Master", description: "Complete 100 dungeon runs", condition: s => s.totalRuns >= 100, icon: "IV" },

  // Clear milestones
  { id: "firstClear", name: "Victorious", description: "Clear your first dungeon", condition: s => s.totalClears >= 1, icon: "*" },
  { id: "tenClears", name: "Conqueror", description: "Clear 10 dungeons", condition: s => s.totalClears >= 10, icon: "**" },
  { id: "fiftyClears", name: "Legend", description: "Clear 50 dungeons", condition: s => s.totalClears >= 50, icon: "***" },
  { id: "hundredClears", name: "Mythic Explorer", description: "Clear 100 dungeons", condition: s => s.totalClears >= 100, icon: "****" },

  // Gold milestones
  { id: "thousandGold", name: "Rich", description: "Earn 1,000 total gold", condition: s => s.totalGold >= 1000, icon: "$" },
  { id: "tenThousandGold", name: "Wealthy", description: "Earn 10,000 total gold", condition: s => s.totalGold >= 10000, icon: "$$" },
  { id: "hundredThousandGold", name: "Tycoon", description: "Earn 100,000 total gold", condition: s => s.totalGold >= 100000, icon: "$$$" },

  // Enemies
  { id: "hundredEnemies", name: "Fighter", description: "Defeat 100 enemies", condition: s => s.totalEnemiesDefeated >= 100, icon: "!" },
  { id: "thousandEnemies", name: "Warrior", description: "Defeat 1,000 enemies", condition: s => s.totalEnemiesDefeated >= 1000, icon: "!!" },
  { id: "fiveThousandEnemies", name: "Champion", description: "Defeat 5,000 enemies", condition: s => s.totalEnemiesDefeated >= 5000, icon: "!!!" },

  // Endless
  { id: "endless20", name: "Deep Diver", description: "Reach B20F in Endless Abyss", condition: s => s.endlessBestFloor >= 20, icon: "~" },
  { id: "endless50", name: "Abyss Walker", description: "Reach B50F in Endless Abyss", condition: s => s.endlessBestFloor >= 50, icon: "~~" },
  { id: "endless100", name: "Infinity", description: "Reach B100F in Endless Abyss", condition: s => s.endlessBestFloor >= 100, icon: "~~~" },

  // Challenge
  { id: "challenge1", name: "Challenger", description: "Clear a challenge mode", condition: s => s.challengeClears >= 1, icon: "+" },
  { id: "challenge5", name: "Elite Challenger", description: "Clear 5 challenge modes", condition: s => s.challengeClears >= 5, icon: "++" },

  // Variety
  { id: "fiveStarters", name: "Collector", description: "Use 5 different starters", condition: s => s.uniqueStartersUsed >= 5, icon: "#" },
  { id: "twentyStarters", name: "Pokemon Trainer", description: "Use 20 different starters", condition: s => s.uniqueStartersUsed >= 20, icon: "##" },

  // Shrines & Blessings
  { id: "shrineSeeker", name: "Shrine Seeker", description: "Use 10 shrines across all runs", condition: s => s.totalShrinesUsed >= 10, icon: "^" },
  { id: "blessedSoul", name: "Blessed Soul", description: "Have 3 active blessings at once", condition: s => s.maxActiveBlessings >= 3, icon: "^^" },
  { id: "curseBreaker", name: "Curse Breaker", description: "Complete a dungeon with 2+ active curses", condition: s => s.dungeonsClearedWithCurses >= 1, icon: "^!" },

  // Forge
  { id: "masterForger", name: "Master Forger", description: "Reach forge level 5", condition: s => s.forgeLevel >= 5, icon: "%" },

  // Type Gems
  { id: "gemCollector", name: "Gem Collector", description: "Use 10 different type gems", condition: s => s.uniqueTypeGemsUsed >= 10, icon: "<>" },

  // Rescue
  { id: "rescueRanger", name: "Rescue Ranger", description: "Get rescued 5 times total", condition: s => s.totalRescues >= 5, icon: "+" },

  // Enemy Variants
  { id: "variantHunter", name: "Variant Hunter", description: "Defeat 10 Elite enemies", condition: s => s.totalEliteDefeated >= 10, icon: "E" },
  { id: "shadowSlayer", name: "Shadow Slayer", description: "Defeat 5 Shadow enemies", condition: s => s.totalShadowDefeated >= 5, icon: "S" },
  { id: "ancientConqueror", name: "Ancient Conqueror", description: "Defeat an Ancient enemy", condition: s => s.totalAncientDefeated >= 1, icon: "A" },

  // Chain
  { id: "chainMaster", name: "Chain Master", description: "Reach SSS chain tier", condition: s => s.bestChainTier === "SSS", icon: "&&" },

  // Puzzle
  { id: "puzzleMaster", name: "Puzzle Master", description: "Solve 20 puzzles total", condition: s => s.totalPuzzlesSolved >= 20, icon: "?" },

  // Relics
  { id: "fullHouse", name: "Full House", description: "Have 3 relics at once", condition: s => s.maxRelicsHeld >= 3, icon: "R" },

  // Ally Evolution
  { id: "evolutionExpert", name: "Evolution Expert", description: "Evolve an ally in a dungeon", condition: s => s.totalAllyEvolutions >= 1, icon: ">" },

  // Speed
  { id: "speedDemon", name: "Speed Demon", description: "Clear a dungeon in under 50 turns", condition: s => s.bestTurnClear > 0 && s.bestTurnClear < 50, icon: "!" },
];
