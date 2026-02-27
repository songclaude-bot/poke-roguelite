import Phaser from "phaser";
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  TILE_SIZE,
  TILE_SCALE,
  TILE_DISPLAY,
} from "../config";
import { createDomHud, layoutHudButtons, setDomHudInteractive, setDomSkillsVisible, DomHudElements } from "../ui/dom-hud";
import { generateDungeon, DungeonData, TerrainType } from "../core/dungeon-generator";
import { getTileIndex } from "../core/autotiler";
import { Direction, DIR_DX, DIR_DY, angleToDirection } from "../core/direction";
import { TurnManager } from "../core/turn-manager";
import {
  Entity, canMoveTo, canMoveDiagonal, chebyshevDist,
  getEffectiveAtk, getEffectiveDef, tickStatusEffects, isParalyzed, StatusEffect,
  isFrozen, isFlinched, isDrowsySleep, thawEntity, getBadlyPoisonedDamage, getCurseDamage,
  AllyTactic,
} from "../core/entity";
import { getEnemyMoveDirection, isAdjacentToPlayer, directionToPlayer } from "../core/enemy-ai";
import { getAllyMoveDirection, tryRecruit, directionTo, getFollowDist, selectAllySkill } from "../core/ally-ai";
import { PokemonType, getEffectiveness, effectivenessText } from "../core/type-chart";
import { Skill, SkillRange, SkillEffect, SKILL_DB, createSkill } from "../core/skill";
import { getSkillTargetTiles } from "../core/skill-targeting";
import { getEvolution } from "../core/evolution";
import { distributeAllyExp, AllyLevelUpResult } from "../core/ally-evolution";
import { ItemDef, ItemStack, rollFloorItem, MAX_INVENTORY, ITEM_DB, ItemCategory } from "../core/item";
import { getAffinityMultiplier, getItemAffinity } from "../core/item-affinity";
import { getTypeGem, TypeGem } from "../core/type-gems";
import { SPECIES, PokemonSpecies, createSpeciesSkills, getLearnableSkill } from "../core/pokemon-data";
import { DungeonDef, BossDef, getDungeon, getDungeonFloorEnemies, CHALLENGE_MODES } from "../core/dungeon-data";
import { expFromEnemy, processLevelUp } from "../core/leveling";
import {
  saveDungeon, clearDungeonSave, serializeSkills, serializeInventory,
  deserializeSkills as deserializeSkillsFn,
  goldFromRun, loadMeta, saveMeta,
} from "../core/save-system";
import { TrapDef, TrapType, rollTrap, trapsPerFloor, FloorTrap, TRAPS, generateTraps } from "../core/trap";
import {
  HazardType, FloorHazard, isImmuneToHazard, generateHazards,
} from "../core/hazard-tiles";
import { AbilityId, SPECIES_ABILITIES, ABILITIES } from "../core/ability";
import {
  getAbilityLevel, getTorrentValues, getSturdyHp,
  getStaticChance, getFlameBodyChance, getPickupChance,
  getRunAwayDodgeBonus, getLevitateDodgeBonus,
} from "../core/ability-upgrade";
import { WeatherType, WEATHERS, weatherDamageMultiplier, isWeatherImmune, rollFloorWeather, WeatherIntensity, INTENSITY_MULTIPLIER, INTENSITY_COLOR, getWeatherIntensity, shouldWeatherTransition, getWeatherSynergyBonus } from "../core/weather";
import { generateForecast, forecastToString } from "../core/weather-forecast";
import {
  ShopItem, ShopConfig, generateShopInventory, shouldSpawnShop,
  getItemSellPrice,
} from "../core/dungeon-shop";
import { getUpgradeBonus } from "../scenes/UpgradeScene";
import { HeldItemEffect, getHeldItem } from "../core/held-items";
import { getForgeBonus } from "../core/forge";
import { getEquippedEnchantment, Enchantment } from "../core/enchantments";
import { getDailyConfig, calculateDailyScore, saveDailyScore } from "../core/daily-dungeon";
import { calculateScore, saveRunScore } from "../core/leaderboard";
import {
  DungeonModifier, rollModifiers, modifiersFromIds, getModifierEffects, ModifierEffects,
} from "../core/dungeon-modifiers";
import {
  DifficultyLevel, DifficultyModifiers, getDifficultyModifiers, loadDifficulty, isNonNormalDifficulty,
} from "../core/difficulty-settings";
import {
  getNGPlusLevel, getNGPlusBonusEffects, NGPlusBonusEffects,
} from "../core/new-game-plus";
import { checkCombo, ComboEffect, SkillCombo } from "../core/skill-combos";
import {
  initAudio, startBgm, stopBgm, switchToBossTheme,
  sfxHit, sfxSuperEffective, sfxNotEffective, sfxMove, sfxPickup,
  sfxLevelUp, sfxRecruit, sfxStairs, sfxDeath, sfxBossDefeat,
  sfxHeal, sfxSkill, sfxMenuOpen, sfxMenuClose,
  sfxEvolution, sfxTrap, sfxVictory, sfxGameOver, sfxShop,
  sfxCombo, sfxCritical, sfxDodge, sfxItemPickup, sfxBuff, sfxWeatherChange,
  getBgmVolume, getSfxVolume, setBgmVolume, setSfxVolume,
} from "../core/sound-manager";
import { DungeonEvent, EventChoice, rollDungeonEvent } from "../core/dungeon-events";
import {
  FloorEvent, FloorEventType, rollFloorEvent, invertEffectiveness, floorEventColorHex,
} from "../core/floor-events";
import { FloorTheme, getDepthAdjustedTheme, darkenColor } from "../core/floor-themes";
import { addToStorage } from "../core/crafting";
import {
  ScoreChain, ChainAction, createScoreChain, addChainAction, resetChain,
  tickChainIdle, getChainTier, getChainColor, getChainHexColor,
} from "../core/score-chain";
import {
  BossWave, GauntletConfig, GauntletReward,
  shouldTriggerGauntlet, generateGauntlet, getGauntletReward,
} from "../core/boss-gauntlet";
import {
  PuzzleType, shouldSpawnPuzzle, generatePuzzle,
} from "../core/puzzle-rooms";
import { PuzzleSystem } from "../systems/puzzle-system";
import {
  LegendaryEncounter,
  shouldEncounterLegendary,
  rollLegendaryEncounter,
} from "../core/legendary-encounters";
import {
  DungeonMutation, MutationType,
  rollMutations, hasMutation, getMutationEffect, getMutationDef,
  mutationColorHex,
} from "../core/dungeon-mutations";
import {
  generateDailyQuests, getChallengeQuests, updateQuestProgress,
  getTodayDateString, RunQuestData,
} from "../core/quests";
import {
  SecretRoomType, SecretRoom, SecretReward,
  shouldSpawnSecretRoom, generateSecretRoom,
} from "../core/secret-rooms";
import { getAggregatedTalentEffects } from "../core/talent-tree";
import {
  Relic, RelicRarity, RELIC_DB, MAX_RELICS,
  rollRelicDrop, getRelicRarityColor, getAggregatedRelicEffects, hasRelicEffect,
} from "../core/relics";
import {
  RunLog, RunLogEvent, RunLogEntry,
  createRunLog, calculatePerformanceGrade, gradeColor,
} from "../core/run-log";
import {
  EnemyVariant, rollEnemyVariant, getVariantConfig, getVariantColor,
  getVariantHexColor, getVariantName, isSpecialVariant,
} from "../core/enemy-variants";
import {
  ActiveBlessing, Blessing, getBlessingEffect, tickBlessingDurations,
  activateBlessing, rollBlessingOrCurse, getRandomBlessing, getRandomCurse,
  serializeBlessings, deserializeBlessings,
} from "../core/blessings";
import {
  ShrineType, Shrine, ShrineChoice, ShrineEffect,
  generateShrine, shouldSpawnShrine,
} from "../core/dungeon-shrines";
import {
  RescueOption, MAX_RESCUES_PER_RUN,
  getRescueOptions,
} from "../core/rescue-system";
import {
  ExplorationTier, EXPLORATION_TIERS, getNewTiers,
} from "../core/exploration-rewards";
import {
  MiniBoss, shouldSpawnMiniBoss, rollMiniBoss, getMiniBossReward,
} from "../core/mini-bosses";
import {
  loadJournal, recordDungeonEntry, recordDungeonClear,
  recordDungeonDefeat, recordSpeciesEncountered,
} from "../core/dungeon-journal";

interface AllyData {
  speciesId: string;
  hp: number; maxHp: number;
  atk: number; def: number;
  level: number;
  skills: { id: string; currentPp: number }[];
}

const MOVE_DURATION = 150; // ms per tile movement
/** Enemies per room scales with floor */
function enemiesPerRoom(floor: number): number {
  return Math.min(3, 1 + Math.floor((floor - 1) / 3)); // 1→2→3
}

/** Monster House types */
enum MonsterHouseType {
  Standard = "standard",   // Extra enemies spawn
  Treasure = "treasure",   // More items + more enemies, 2x gold on clear
  Ambush = "ambush",       // Enemies invisible until triggered, then all attack
}
const MAX_ALLIES = 4; // max party members (excluding player)

// Per-floor enemy scaling (uses species base stats + dungeon difficulty + NG+ bonus)
function getEnemyStats(floor: number, difficulty: number, species?: PokemonSpecies, ngPlusBonus = 0) {
  const scale = (1 + (floor - 1) * 0.25) * difficulty * (1 + ngPlusBonus * 0.1);
  const base = species?.baseStats ?? { hp: 20, atk: 8, def: 3 };
  return {
    hp: Math.floor(base.hp * scale),
    maxHp: Math.floor(base.hp * scale),
    atk: Math.floor(base.atk * scale),
    def: Math.floor(base.def * scale),
    level: 2 + floor,
  };
}

export class DungeonScene extends Phaser.Scene {
  private dungeon!: DungeonData;
  private dungeonDef!: DungeonDef;
  private turnManager = new TurnManager();
  private currentFloor = 1;

  private player!: Entity;
  private enemies: Entity[] = [];
  private allies: Entity[] = [];
  private allEntities: Entity[] = [];

  // Persistent player state across floors
  private persistentHp = 50;
  private persistentMaxHp = 50;
  private persistentSkills: Skill[] | null = null;
  private persistentLevel = 5;
  private persistentAtk = 12;
  private persistentDef = 6;
  private totalExp = 0;

  // HUD references
  private hpText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private floorText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private logMessages: string[] = [];
  private skillButtons: Phaser.GameObjects.Text[] = [];

  // Minimap + Fog of War
  private minimapGfx!: Phaser.GameObjects.Graphics;
  private minimapBg!: Phaser.GameObjects.Graphics;
  private minimapBorder!: Phaser.GameObjects.Graphics;
  private minimapVisible = true;
  private minimapExpanded = false;
  private minimapHitZone!: Phaser.GameObjects.Zone;
  private minimapLegendTexts: Phaser.GameObjects.Text[] = [];
  private visited!: boolean[][];
  private currentlyVisible!: boolean[][]; // tiles currently in player's sight
  private readonly MINIMAP_TILE_SMALL = 3; // px per tile (small mode)
  private readonly MINIMAP_TILE_LARGE = 7; // px per tile (large mode)
  private readonly MINIMAP_TILE_FULLMAP = 4; // px per tile (full map overlay)
  private readonly MINIMAP_X_SMALL = GAME_WIDTH - 80; // top-right
  private readonly MINIMAP_Y_SMALL = 4;
  // Large mode positions computed dynamically (centered)

  // Exploration percentage
  private explorationText!: Phaser.GameObjects.Text;

  // Full map overlay
  private fullMapOpen = false;
  private fullMapOverlayBg: Phaser.GameObjects.Graphics | null = null;
  private fullMapGfx: Phaser.GameObjects.Graphics | null = null;
  private fullMapCloseZone: Phaser.GameObjects.Zone | null = null;
  private fullMapUI: Phaser.GameObjects.GameObject[] = [];

  // MAP button (near minimap)
  private mapButton!: Phaser.GameObjects.Text;

  // HP Bar graphics
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpBarFill!: Phaser.GameObjects.Graphics;
  private portraitSprite!: Phaser.GameObjects.Sprite;

  // Status icons HUD (next to HP bar)
  private statusHudTexts: Phaser.GameObjects.Text[] = [];

  // Status flash animation timers
  private statusFlashTimers: Phaser.Time.TimerEvent[] = [];

  // Belly Bar graphics
  private bellyBarBg!: Phaser.GameObjects.Graphics;
  private bellyBarFill!: Phaser.GameObjects.Graphics;
  private bellyText!: Phaser.GameObjects.Text;
  private bellyWarningShown = false; // track if 20% warning was shown this drain cycle
  private bellyUrgentShown = false;  // track if 10% warning was shown

  // Skill state
  private activeSkillIndex = -1; // -1 = no skill selected

  // Item state
  private inventory: ItemStack[] = [];
  private floorItems: { x: number; y: number; item: ItemDef; sprite: Phaser.GameObjects.Text }[] = [];
  private persistentInventory: ItemStack[] | null = null;
  private bagOpen = false;
  private bagUI: Phaser.GameObjects.GameObject[] = [];

  // Game state
  private gameOver = false;
  private enemiesDefeated = 0;
  // Rescue system — second chance on faint
  private rescueCount = 0;
  // Quest tracking
  private questItemsCollected = 0;
  private questItemsUsed = false;

  // Trap state
  private floorTraps: FloorTrap[] = [];
  private trapGraphics: Phaser.GameObjects.Graphics[] = [];

  // Hazard tile state
  private floorHazards: FloorHazard[] = [];
  private hazardGraphics: Phaser.GameObjects.Graphics[] = [];
  private hazardTweens: Phaser.Tweens.Tween[] = [];

  // Belly (hunger) state
  private belly = 100;
  private maxBelly = 100;
  private persistentBelly: number | null = null;

  // Shop state
  private shopConfig: ShopConfig | null = null;
  private shopItems: ShopItem[] = [];
  private shopRoom: { x: number; y: number; w: number; h: number } | null = null;
  private shopUI: Phaser.GameObjects.GameObject[] = [];
  private shopOpen = false;
  private gold = 0;
  private shopTiles: { x: number; y: number; shopIdx: number; sprite: Phaser.GameObjects.Text; priceTag: Phaser.GameObjects.Text }[] = [];
  private shopCarpet: Phaser.GameObjects.Graphics | null = null;
  private shopWelcomeShown = false;
  private playerInShopRoom = false;
  private shopGoldHud: Phaser.GameObjects.Text | null = null;
  private shopTheftTriggered = false;
  private shopClosed = false; // set true after theft — shop closes for this floor

  // Starter species
  private starterId = "mudkip";

  // Monster House
  private monsterHouseRoom: { x: number; y: number; w: number; h: number } | null = null;
  private monsterHouseTriggered = false;
  private monsterHouseType: MonsterHouseType = MonsterHouseType.Standard;
  private monsterHouseCleared = false;
  private monsterHouseEnemies: Entity[] = []; // track enemies spawned in monster house

  // Event Room
  private eventRoom: { x: number; y: number; w: number; h: number } | null = null;
  private eventTriggered = false;
  private eventOpen = false;
  private eventUI: Phaser.GameObjects.GameObject[] = [];
  private currentEvent: DungeonEvent | null = null;
  private eventMarker: Phaser.GameObjects.Text | null = null;

  // Floor Event (floor-wide global effect)
  private floorEvent: FloorEvent | null = null;
  private floorEventBadge: Phaser.GameObjects.Text | null = null;

  // Puzzle Room (delegated to PuzzleSystem)
  private puzzleSys!: PuzzleSystem;

  // NG+ prestige system
  private ngPlusLevel = 0;
  private ngPlusBonuses: NGPlusBonusEffects = getNGPlusBonusEffects(0);
  private ngPlusBadgeText: Phaser.GameObjects.Text | null = null;

  // Weather
  private currentWeather = WeatherType.None;
  private currentWeatherIntensity = WeatherIntensity.Mild;
  private weatherText!: Phaser.GameObjects.Text;
  private weatherIntensityHudText: Phaser.GameObjects.Text | null = null;
  private weatherForecastHudText: Phaser.GameObjects.Text | null = null;
  private weatherOverlay: Phaser.GameObjects.Rectangle | null = null;
  private weatherParticles: Phaser.GameObjects.Graphics | null = null;
  private weatherTimer: Phaser.Time.TimerEvent | null = null;
  private floorTurns = 0; // turns taken on the current floor

  // Boss state
  private bossEntity: Entity | null = null;
  private bossHpBar: Phaser.GameObjects.Graphics | null = null;
  private bossHpBg: Phaser.GameObjects.Graphics | null = null;
  private bossNameText: Phaser.GameObjects.Text | null = null;

  // Boss Gauntlet state
  private gauntletActive = false;
  private gauntletConfig: GauntletConfig | null = null;
  private gauntletCurrentWave = 0;        // 0-indexed current wave
  private gauntletTotalWavesCleared = 0;   // waves cleared for scoring
  private gauntletEnemies: Entity[] = [];  // enemies in current gauntlet wave
  private gauntletStairsLocked = false;
  // Gauntlet HUD elements
  private gauntletWaveText: Phaser.GameObjects.Text | null = null;
  private gauntletVignette: Phaser.GameObjects.Graphics | null = null;
  private gauntletVignetteTween: Phaser.Tweens.Tween | null = null;

  // Hamburger dropdown menu state
  private menuOpen = false;
  private menuUI: Phaser.GameObjects.GameObject[] = [];

  // Team (Ally Command) panel state
  private teamPanelOpen = false;
  private teamPanelUI: Phaser.GameObjects.GameObject[] = [];

  // Settings panel state
  private settingsOpen = false;
  private settingsUI: Phaser.GameObjects.GameObject[] = [];

  // D-Pad references for left/right switching
  private dpadUI: Phaser.GameObjects.GameObject[] = [];
  private dpadSide: "right" | "left" = "right"; // default: right (국룰 UX)

  // Quick-slot: last used item
  private lastUsedItemId: string | null = null;

  // DOM-based HUD overlay (always crisp text)
  private domHud: DomHudElements | null = null;
  private domHudElement: Phaser.GameObjects.DOMElement | null = null;

  // Challenge mode state
  private challengeMode: string | null = null;

  // Boss Rush state
  private isBossRush = false;
  private bossesDefeated = 0;
  private challengeTurnLimit = 0; // speedrun: max turns allowed
  private challengeBadgeText: Phaser.GameObjects.Text | null = null;

  // Legendary encounter state
  private legendaryEncountered = false; // max 1 per run
  private legendaryEntity: Entity | null = null;
  private legendaryEncounter: LegendaryEncounter | null = null;
  private legendaryHpBar: Phaser.GameObjects.Graphics | null = null;
  private legendaryHpBg: Phaser.GameObjects.Graphics | null = null;
  private legendaryNameText: Phaser.GameObjects.Text | null = null;
  private legendaryParticleTimer: Phaser.Time.TimerEvent | null = null;
  private legendaryParticleGraphics: Phaser.GameObjects.Graphics | null = null;

  // Mini-boss state
  private miniBossEntity: Entity | null = null;
  private miniBossData: MiniBoss | null = null;
  private miniBossHpBar: Phaser.GameObjects.Graphics | null = null;
  private miniBossHpBg: Phaser.GameObjects.Graphics | null = null;
  private miniBossNameText: Phaser.GameObjects.Text | null = null;

  // Dungeon modifier state
  private activeModifiers: DungeonModifier[] = [];
  private modifierEffects: ModifierEffects = getModifierEffects([]);

  // Difficulty settings
  private difficultyLevel: DifficultyLevel = DifficultyLevel.Normal;
  private difficultyMods: DifficultyModifiers = getDifficultyModifiers(DifficultyLevel.Normal);

  // Pokedex tracking: species encountered this run
  private seenSpecies = new Set<string>();

  // Held item effect (loaded from meta at init)
  private heldItemEffect: HeldItemEffect = {};

  // Enchantment on held item (loaded from meta at init)
  private enchantment: Enchantment | null = null;
  private phoenixUsed = false;  // Phoenix enchantment: one revive per run

  // Talent tree aggregated effects (loaded from meta at init)
  private talentEffects: Record<string, number> = {};

  // Auto-Explore state
  private autoExploring = false;
  private autoExploreTimer: Phaser.Time.TimerEvent | null = null;
  private autoExploreText: Phaser.GameObjects.Text | null = null;
  private autoExploreTween: Phaser.Tweens.Tween | null = null;

  // Exploration Reward state
  private lastExplorationPercent = 0;
  private explorationRewardsGranted = new Set<number>();

  // Skill Combo state
  private recentSkillIds: string[] = [];  // last 3 skill IDs used by player
  private comboDoubleDamage = false;      // next skill does 2x damage
  private comboCritGuarantee = false;     // next attack is guaranteed crit
  private comboSpeedBoost = false;        // get 2 actions next turn
  private comboDragonsRage = false;       // next attack deals 3x damage (Dragon's Rage)
  private comboShadowDanceTurns = 0;      // 100% dodge turns remaining (Shadow Dance)

  // Score Chain state
  private scoreChain: ScoreChain = createScoreChain();
  private chainHudText: Phaser.GameObjects.Text | null = null;
  private chainHudBg: Phaser.GameObjects.Graphics | null = null;
  private lastChainTier = "";
  private chainActionThisTurn = false; // tracks if a scoring action happened this turn

  // Floor Theme state
  private currentTheme!: FloorTheme;
  private themeOverlay: Phaser.GameObjects.Graphics | null = null;

  // Speed Run Timer
  private runElapsedSeconds = 0;          // total seconds elapsed across floors
  private timerText!: Phaser.GameObjects.Text;
  private timerEvent: Phaser.Time.TimerEvent | null = null;

  // Dungeon Mutation state (per-floor)
  private floorMutations: DungeonMutation[] = [];
  private mutationHudTexts: Phaser.GameObjects.Text[] = [];
  private typeShiftType: PokemonType | null = null;         // for TypeShift mutation
  private mirrorApplied = false;                            // track if MirrorWorld already applied

  // Secret Room state
  private secretRoomData: SecretRoom | null = null;
  private secretWallPos: { x: number; y: number } | null = null;  // the fake wall tile
  private secretRoomTiles: { x: number; y: number }[] = [];       // 3x3 ground tiles of the room
  private secretEffectTile: { x: number; y: number } | null = null; // center tile with effect
  private secretRoomDiscovered = false;
  private secretRoomUsed = false;                                    // reward already claimed
  private secretRoomGraphics: Phaser.GameObjects.Graphics[] = [];
  private secretWallShimmerTimer: Phaser.Time.TimerEvent | null = null;
  private secretWallShimmerGfx: Phaser.GameObjects.Graphics | null = null;
  private secretRoomUI: Phaser.GameObjects.GameObject[] = [];       // WarpHub UI overlay
  private secretWarpOpen = false;                                    // WarpHub overlay is open

  // Relic Artifact state (run-specific, max 3)
  private activeRelics: Relic[] = [];
  private relicEffects: Record<string, number> = {};  // aggregated relic effects cache
  private relicHudIcons: Phaser.GameObjects.Text[] = [];
  private relicOverlayOpen = false;
  private relicOverlayUI: Phaser.GameObjects.GameObject[] = [];
  private focusSashUsed = false;  // Focus Sash: one lethal-hit save per run

  // Enemy Variant tracking (Entity reference -> variant type, separate from Entity interface)
  private enemyVariantMap = new Map<Entity, EnemyVariant>();
  // Graphics objects for variant aura effects (keyed by entity for cleanup)
  private variantAuraGraphics = new Map<Entity, Phaser.GameObjects.Graphics>();

  // Run Log — battle log tracking all significant events across the run
  private runLog: RunLog = createRunLog();

  // Blessing & Curse state (run-specific, persist across floors)
  private activeBlessings: ActiveBlessing[] = [];
  private blessingHudIcons: Phaser.GameObjects.Text[] = [];

  // Shrine state (per-floor)
  private floorShrine: Shrine | null = null;
  private shrineTileX = -1;
  private shrineTileY = -1;
  private shrineUsed = false;
  private shrineUI: Phaser.GameObjects.GameObject[] = [];
  private shrineOpen = false;
  private shrineGraphic: Phaser.GameObjects.Graphics | null = null;
  private shrineMarker: Phaser.GameObjects.Text | null = null;

  // Type Gem state (per-floor: active type boosts, cleared on each new floor)
  private activeTypeGems: Map<string, number> = new Map(); // PokemonType -> boostPercent
  private typeGemHudIcons: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: "DungeonScene" });
  }

  private persistentAllies: AllyData[] | null = null;

  init(data?: { floor?: number; hp?: number; maxHp?: number; skills?: Skill[]; inventory?: ItemStack[]; level?: number; atk?: number; def?: number; exp?: number; fromHub?: boolean; dungeonId?: string; allies?: AllyData[] | null; belly?: number; starter?: string; challengeMode?: string; modifiers?: string[]; runElapsedTime?: number; scoreChain?: ScoreChain; legendaryEncountered?: boolean; questItemsCollected?: number; questItemsUsed?: boolean; relics?: Relic[]; runLogEntries?: RunLogEntry[]; blessings?: { id: string; remaining: number }[] }) {
    // Load D-Pad side preference
    try {
      const side = localStorage.getItem("poke-roguelite-dpadSide");
      if (side === "left" || side === "right") this.dpadSide = side;
    } catch { /* ignore */ }

    // Load difficulty settings
    this.difficultyLevel = loadDifficulty();
    this.difficultyMods = getDifficultyModifiers(this.difficultyLevel);

    // Apply upgrade bonuses on fresh run start (floor 1 from hub)
    const meta = loadMeta();
    const hpBonus = getUpgradeBonus(meta, "maxHp") * 5;
    const atkBonus = getUpgradeBonus(meta, "atk");
    const defBonus = getUpgradeBonus(meta, "def");

    // Load NG+ prestige bonuses
    this.ngPlusLevel = getNGPlusLevel(meta);
    this.ngPlusBonuses = getNGPlusBonusEffects(this.ngPlusLevel);
    this.ngPlusBadgeText = null;

    // Load held item effect
    const equippedId = meta.equippedHeldItem;
    const heldItem = equippedId ? getHeldItem(equippedId) : undefined;
    this.heldItemEffect = heldItem?.effect ?? {};
    // Apply forge bonus to held item stat bonuses
    const forgeBonus = 1 + getForgeBonus(meta.forgeLevel ?? 0) / 100;
    const heldHpBonus = Math.floor((this.heldItemEffect.hpBonus ?? 0) * forgeBonus);
    const heldAtkBonus = Math.floor((this.heldItemEffect.atkBonus ?? 0) * forgeBonus);
    const heldDefBonus = Math.floor((this.heldItemEffect.defBonus ?? 0) * forgeBonus);

    // Load enchantment on held item
    this.enchantment = equippedId ? getEquippedEnchantment(meta) : null;
    this.phoenixUsed = false;
    // Enchantment stat bonuses
    let enchHpBonus = 0;
    let enchAtkBonus = 0;
    let enchDefBonus = 0;
    if (this.enchantment) {
      switch (this.enchantment.id) {
        case "sharpness": enchAtkBonus = 3; break;
        case "resilience": enchDefBonus = 3; break;
        case "vitality":  enchHpBonus = 10; break;
        case "overlord":
          // +5% to all stats — applied after base stat calc below
          break;
      }
    }

    // Load talent tree bonuses
    this.talentEffects = getAggregatedTalentEffects(meta.talentLevels ?? {});

    this.dungeonDef = getDungeon(data?.dungeonId ?? "beachCave");
    const isNewRun = (data?.floor ?? 1) === 1 && !data?.hp;
    this.currentFloor = data?.floor ?? 1;

    // Journal: record dungeon entry on new runs
    if (isNewRun) {
      const journal = loadJournal();
      recordDungeonEntry(journal, this.dungeonDef.id);
    }

    // Endless dungeon: dynamically scale difficulty and items based on floor
    if (this.dungeonDef.id === "endlessDungeon") {
      this.dungeonDef = { ...this.dungeonDef }; // shallow copy to avoid mutating original
      this.dungeonDef.difficulty = 1.0 + (this.currentFloor * 0.1);
      this.dungeonDef.itemsPerFloor = Math.min(7, 3 + Math.floor(this.currentFloor / 15));
    }

    // Daily dungeon: apply seed-based config and modifiers
    if (this.dungeonDef.id === "dailyDungeon") {
      const dailyConfig = getDailyConfig();
      this.dungeonDef = { ...this.dungeonDef, floors: dailyConfig.floors, difficulty: dailyConfig.difficulty };
      // Apply modifiers
      if (dailyConfig.modifiers.includes("strongEnemies")) this.dungeonDef.difficulty *= 1.3;
      if (dailyConfig.modifiers.includes("fewItems")) this.dungeonDef.itemsPerFloor = 2;
      if (dailyConfig.modifiers.includes("toughBoss")) {
        // Boost boss stats if present
        if (this.dungeonDef.boss) {
          this.dungeonDef.boss = { ...this.dungeonDef.boss, statMultiplier: this.dungeonDef.boss.statMultiplier * 1.5 };
        }
      }
    }

    // Boss Rush: flag and shallow copy
    this.isBossRush = this.dungeonDef.id === "bossRush";
    this.bossesDefeated = 0;
    if (this.isBossRush) {
      this.dungeonDef = { ...this.dungeonDef };
    }

    // NG+ stat multipliers: hpPercent + allStatsPercent, atkPercent + allStatsPercent
    const ngHpMult = 1 + (this.ngPlusBonuses.hpPercent + this.ngPlusBonuses.allStatsPercent) / 100;
    const ngAtkMult = 1 + (this.ngPlusBonuses.atkPercent + this.ngPlusBonuses.allStatsPercent) / 100;
    const ngDefMult = 1 + this.ngPlusBonuses.allStatsPercent / 100;
    // Overlord enchantment: +5% to all stats (stacks multiplicatively with NG+)
    const overlordMult = this.enchantment?.id === "overlord" ? 1.05 : 1.0;
    // Talent tree stat multipliers
    const talentHpMult = 1 + (this.talentEffects.hpPercent ?? 0) / 100;
    const talentAtkMult = 1 + (this.talentEffects.atkPercent ?? 0) / 100;
    const talentDefMult = 1 + (this.talentEffects.defPercent ?? 0) / 100;
    const baseHp = Math.floor((50 + hpBonus + heldHpBonus + enchHpBonus) * ngHpMult * overlordMult * talentHpMult);
    const baseAtk = Math.floor((12 + atkBonus + heldAtkBonus + enchAtkBonus) * ngAtkMult * overlordMult * talentAtkMult);
    const baseDef = Math.floor((6 + defBonus + heldDefBonus + enchDefBonus) * ngDefMult * overlordMult * talentDefMult);

    this.persistentHp = data?.hp ?? baseHp;
    this.persistentMaxHp = data?.maxHp ?? baseHp;
    this.persistentSkills = data?.skills ?? null;
    this.persistentInventory = data?.inventory ?? null;
    this.persistentLevel = data?.level ?? 5;
    this.persistentAtk = data?.atk ?? baseAtk;
    this.persistentDef = data?.def ?? baseDef;
    this.totalExp = data?.exp ?? 0;
    this.enemies = [];
    this.allies = [];
    this.allEntities = [];
    this.floorItems = [];
    this.enemyVariantMap = new Map();
    this.variantAuraGraphics = new Map();
    this.gameOver = false;
    this.bossEntity = null;
    this.bossHpBar = null;
    this.bossHpBg = null;
    this.bossNameText = null;
    // Reset legendary encounter state (persist flag across floors)
    this.legendaryEncountered = data?.legendaryEncountered ?? false;
    this.legendaryEntity = null;
    this.legendaryEncounter = null;
    this.legendaryHpBar = null;
    this.legendaryHpBg = null;
    this.legendaryNameText = null;
    this.legendaryParticleTimer = null;
    this.legendaryParticleGraphics = null;
    // Reset mini-boss state
    this.miniBossEntity = null;
    this.miniBossData = null;
    this.miniBossHpBar = null;
    this.miniBossHpBg = null;
    this.miniBossNameText = null;
    // Reset gauntlet state
    this.gauntletActive = false;
    this.gauntletConfig = null;
    this.gauntletCurrentWave = 0;
    this.gauntletTotalWavesCleared = 0;
    this.gauntletEnemies = [];
    this.gauntletStairsLocked = false;
    this.gauntletWaveText = null;
    this.gauntletVignette = null;
    this.gauntletVignetteTween = null;
    this.activeSkillIndex = -1;
    this.skillButtons = [];
    this.bagOpen = false;
    this.bagUI = [];
    this.teamPanelOpen = false;
    this.teamPanelUI = [];
    this.enemiesDefeated = 0;
    // Quest tracking: restore from floor transition or reset on new run
    if (data?.floor && data.floor > 1) {
      this.questItemsCollected = data.questItemsCollected ?? 0;
      this.questItemsUsed = data.questItemsUsed ?? false;
    } else {
      this.questItemsCollected = 0;
      this.questItemsUsed = false;
    }

    // Relic state: restore from floor transition or reset on new run
    if (data?.relics && data.relics.length > 0) {
      this.activeRelics = data.relics;
      this.relicEffects = getAggregatedRelicEffects(this.activeRelics);
    } else {
      this.activeRelics = [];
      this.relicEffects = {};
    }
    this.focusSashUsed = false;
    this.relicHudIcons = [];
    this.relicOverlayOpen = false;
    this.relicOverlayUI = [];
    // Run log: restore from floor transition or create fresh on new run
    this.runLog = data?.runLogEntries ? RunLog.deserialize(data.runLogEntries) : createRunLog();
    // Blessing/curse state: restore from floor transition or reset on new run
    this.activeBlessings = data?.blessings ? deserializeBlessings(data.blessings) : [];
    this.blessingHudIcons = [];
    // Reset shrine state
    this.floorShrine = null;
    this.shrineTileX = -1;
    this.shrineTileY = -1;
    this.shrineUsed = false;
    this.shrineUI = [];
    this.shrineOpen = false;
    this.shrineGraphic = null;
    this.shrineMarker = null;
    // Reset type gem boosts (per-floor)
    this.activeTypeGems = new Map();
    this.typeGemHudIcons = [];
    // Reset combo state on new floor
    this.recentSkillIds = [];
    this.comboDoubleDamage = false;
    this.comboCritGuarantee = false;
    this.comboSpeedBoost = false;
    this.comboDragonsRage = false;
    this.comboShadowDanceTurns = 0;
    // Score chain persists across floors; create fresh on new run
    this.scoreChain = data?.scoreChain ?? createScoreChain();
    this.chainHudText = null;
    this.chainHudBg = null;
    this.lastChainTier = "";
    this.chainActionThisTurn = false;
    this.turnManager = new TurnManager();
    this.persistentAllies = data?.allies ?? null;
    this.floorTraps = [];
    this.trapGraphics = [];
    this.floorHazards = [];
    this.hazardGraphics = [];
    this.hazardTweens = [];
    const bellyBonus = getUpgradeBonus(meta, "bellyMax") * 20;
    this.maxBelly = 100 + bellyBonus;
    this.belly = data?.belly ?? this.maxBelly;
    this.bellyWarningShown = this.belly <= this.maxBelly * 0.2;
    this.bellyUrgentShown = this.belly <= this.maxBelly * 0.1;
    this.starterId = data?.starter ?? "mudkip";
    this.seenSpecies = new Set<string>();
    this.seenSpecies.add(this.starterId); // starter is always "seen"
    this.shopConfig = null;
    this.shopItems = [];
    this.shopRoom = null;
    this.shopUI = [];
    this.shopOpen = false;
    this.shopTiles = [];
    this.shopCarpet = null;
    this.shopWelcomeShown = false;
    this.playerInShopRoom = false;
    this.shopGoldHud = null;
    this.shopTheftTriggered = false;
    this.shopClosed = false;
    this.monsterHouseRoom = null;
    this.monsterHouseTriggered = false;
    this.monsterHouseType = MonsterHouseType.Standard;
    this.monsterHouseCleared = false;
    this.monsterHouseEnemies = [];
    this.eventRoom = null;
    this.eventTriggered = false;
    this.eventOpen = false;
    this.eventUI = [];
    this.currentEvent = null;
    this.eventMarker = null;
    // Reset puzzle room state (delegated to PuzzleSystem)
    this.puzzleSys = new PuzzleSystem(this as any);
    // Reset secret room state
    this.secretRoomData = null;
    this.secretWallPos = null;
    this.secretRoomTiles = [];
    this.secretEffectTile = null;
    this.secretRoomDiscovered = false;
    this.secretRoomUsed = false;
    this.secretRoomGraphics = [];
    this.secretWallShimmerTimer = null;
    this.secretWallShimmerGfx = null;
    this.secretRoomUI = [];
    this.secretWarpOpen = false;
    this.autoExploring = false;
    this.autoExploreTimer = null;
    this.autoExploreText = null;
    this.autoExploreTween = null;
    this.lastExplorationPercent = 0;
    this.explorationRewardsGranted = new Set<number>();
    this.fullMapOpen = false;
    this.fullMapOverlayBg = null;
    this.fullMapGfx = null;
    this.fullMapCloseZone = null;
    this.fullMapUI = [];
    // Speed run timer: carry over elapsed time from previous floors, or start fresh
    this.runElapsedSeconds = data?.runElapsedTime ?? 0;
    this.timerEvent = null;
    // NG+ starting gold bonus: add percentage of carried gold as bonus on new runs
    const ngGoldStartBonus = isNewRun && this.ngPlusBonuses.startingGoldPercent > 0
      ? Math.floor(meta.gold * this.ngPlusBonuses.startingGoldPercent / 100)
      : 0;
    this.gold = meta.gold + ngGoldStartBonus;

    // ── Challenge Mode ──
    this.challengeMode = data?.challengeMode ?? null;
    this.challengeTurnLimit = 0;
    this.challengeBadgeText = null;

    if (this.challengeMode === "speedrun") {
      this.challengeTurnLimit = this.dungeonDef.floors * 50;
    }

    if (this.challengeMode === "noItems") {
      // Reduce enemy difficulty by 15%
      this.dungeonDef = { ...this.dungeonDef };
      this.dungeonDef.difficulty = this.dungeonDef.difficulty * 0.85;
    }

    if (this.challengeMode === "solo" && isNewRun) {
      // Boost player stats by 30%
      this.persistentAtk = Math.floor(this.persistentAtk * 1.3);
      this.persistentDef = Math.floor(this.persistentDef * 1.3);
    }

    // ── Dungeon Modifiers (regular dungeons only, not endless/daily/challenge/bossRush) ──
    const isRegularDungeon = this.dungeonDef.id !== "endlessDungeon"
      && this.dungeonDef.id !== "dailyDungeon"
      && this.dungeonDef.id !== "bossRush"
      && !this.challengeMode;

    if (data?.modifiers && data.modifiers.length > 0) {
      // Reconstruct from IDs (floor transitions or save restore)
      this.activeModifiers = modifiersFromIds(data.modifiers);
    } else if (isRegularDungeon && data?.fromHub && isNewRun) {
      // Roll fresh modifiers on new run from hub
      this.activeModifiers = rollModifiers();
    } else {
      this.activeModifiers = [];
    }
    this.modifierEffects = getModifierEffects(this.activeModifiers);

    // Apply modifier effects to dungeon and player stats
    if (this.activeModifiers.length > 0) {
      this.dungeonDef = { ...this.dungeonDef };
      if (this.modifierEffects.difficultyMult !== 1) {
        this.dungeonDef.difficulty *= this.modifierEffects.difficultyMult;
      }
      if (this.modifierEffects.itemsPerFloorMod !== 0) {
        this.dungeonDef.itemsPerFloor = Math.max(0, this.dungeonDef.itemsPerFloor + this.modifierEffects.itemsPerFloorMod);
      }
      // Apply stat multipliers only on fresh run start (floor 1 from hub)
      if (isNewRun) {
        if (this.modifierEffects.playerAtkMult !== 1) {
          this.persistentAtk = Math.floor(this.persistentAtk * this.modifierEffects.playerAtkMult);
        }
        if (this.modifierEffects.playerDefMult !== 1) {
          this.persistentDef = Math.floor(this.persistentDef * this.modifierEffects.playerDefMult);
        }
      }
    }

    // Give starter items on new run
    if (isNewRun) {
      const starterLevel = getUpgradeBonus(meta, "startItems");
      if (starterLevel > 0 && !this.persistentInventory) {
        this.persistentInventory = [{ item: ITEM_DB.oranBerry, count: starterLevel }];
      }
    }
  }

  preload() {
    // Load dungeon tileset
    this.load.image(this.dungeonDef.tilesetKey, this.dungeonDef.tilesetPath);

    const spriteMap: Record<string, string> = {
      mudkip: "0258", zubat: "0041", shellos: "0422", corsola: "0222", geodude: "0074",
      pikachu: "0025", voltorb: "0100", magnemite: "0081",
      caterpie: "0010", pidgey: "0016",
      aron: "0304", meditite: "0307", machop: "0066",
      gastly: "0092", drowzee: "0096", snorunt: "0361",
      charmander: "0004", eevee: "0133",
      numel: "0322", slugma: "0218", torkoal: "0324",
      murkrow: "0198", sableye: "0302", absol: "0359",
      chikorita: "0152", bellsprout: "0069", shroomish: "0285",
      grimer: "0088", nidoranM: "0032", tentacool: "0072",
      clefairy: "0035", jigglypuff: "0039", ralts: "0280",
      dratini: "0147", bagon: "0371", gible: "0443",
      poochyena: "0261",
      beldum: "0374", skarmory: "0227",
      sandshrew: "0027", trapinch: "0328", phanpy: "0231",
      horsea: "0116", lotad: "0270", carvanha: "0318",
      elekid: "0239", mareep: "0179",
      wurmple: "0265", spinarak: "0167",
      abra: "0063", natu: "0177",
      houndour: "0228", sneasel: "0215",
      taillow: "0276", starly: "0396",
      makuhita: "0296", riolu: "0447",
      larvitar: "0246", nosepass: "0299",
      swinub: "0220", spheal: "0363",
      zigzagoon: "0263", whismur: "0293",
      oddish: "0043", budew: "0406",
      vulpix: "0037", ponyta: "0077",
      staryu: "0120", clamperl: "0366",
      shinx: "0403", electrike: "0309",
      gulpin: "0316", ekans: "0023",
      cubone: "0104", diglett: "0050",
      paras: "0046", venonat: "0048",
      shieldon: "0410", bronzor: "0436",
      misdreavus: "0200", duskull: "0355",
      axew: "0610", deino: "0633",
      snubbull: "0209", togepi: "0175",
      snover: "0459", bergmite: "0712",
      spoink: "0325",
      stunky: "0434", purrloin: "0509",
      pidove: "0519", rufflet: "0627",
      tyrogue: "0236", crabrawler: "0739",
      roggenrola: "0524", rockruff: "0744",
      lillipup: "0506", minccino: "0572",
      foongus: "0590", petilil: "0548",
      feebas: "0349", wailmer: "0320",
      litwick: "0607", growlithe: "0058",
      joltik: "0595", tynamo: "0602",
      trubbish: "0568", skorupi: "0451",
      mudbray: "0749", hippopotas: "0449",
      dwebble: "0557", binacle: "0688",
      nincada: "0290", venipede: "0543",
      mienfoo: "0619", timburr: "0532",
      klink: "0599", ferroseed: "0597",
      phantump: "0708", honedge: "0679",
      solosis: "0577", elgyem: "0605",
      cryogonal: "0615", cubchoo: "0613",
      sandile: "0551", inkay: "0686",
      spritzee: "0682", swirlix: "0684",
      goomy: "0704", jangmoo: "0782",
      noibat: "0714", vullaby: "0629",
      stufful: "0759", furfrou: "0676",
      wimpod: "0767", tympole: "0535",
      salandit: "0757", larvesta: "0636",
      fomantis: "0753", morelull: "0755",
      charjabug: "0737", helioptile: "0694",
      mareanie: "0747", croagunk: "0453",
      sandygast: "0769", silicobra: "0843",
      carbink: "0703", minior: "0774",
      dewpider: "0751", sizzlipede: "0850",
      pancham: "0674", hawlucha: "0701",
      // Phase 106-108: Steel/Ghost/Psychic 4th
      durant: "0632", togedemaru: "0777",
      drifloon: "0425", golett: "0622",
      hatenna: "0856", indeedee: "0876",
      // Phase 109-111: Ice/Dark/Fairy 4th
      vanillite: "0582", snom: "0872",
      nickit: "0827", impidimp: "0859",
      milcery: "0868", comfey: "0764",
      // Phase 112-114: Dragon/Flying/Normal 4th
      turtonator: "0776", drampa: "0780",
      rookidee: "0821", archen: "0566",
      wooloo: "0831", skwovet: "0819",
      // Phase 118-120: Water/Fire/Grass 5th
      bruxish: "0779", chewtle: "0833",
      litleo: "0667", torchic: "0255",
      gossifleur: "0829", bounsweet: "0761",
      // Phase 121-123: Electric/Poison/Ground 5th
      yamper: "0835", pincurchin: "0871",
      skrelp: "0690", toxel: "0848",
      drilbur: "0529", barboach: "0339",
      // Phase 124-126: Rock/Bug/Fighting 5th
      nacli: "0932", tyrunt: "0696", blipbug: "0824",
      cutiefly: "0742", clobbopus: "0852", passimian: "0766",
      // Phase 127-129: Steel/Ghost/Psychic 5th
      tinkatink: "0957", varoom: "0965",
      greavard: "0971", sinistea: "0854",
      flittle: "0955", espurr: "0677",
      // Phase 130-132: Ice/Dark/Fairy 5th
      cetoddle: "0974", frigibax: "0996",
      zorua: "0570", pawniard: "0624",
      fidough: "0926", dedenne: "0702",
      // Phase 133-135: Dragon/Flying/Normal 5th
      cyclizar: "0967", tatsugiri: "0978",
      wingull: "0278", swablu: "0333",
      lechonk: "0915", tandemaus: "0921",
      // Phase 137-139: Water/Fire/Grass/Electric/Poison/Ground 6th
      buizel: "0418", finizen: "0963",
      fletchinder: "0662", heatmor: "0631",
      smoliv: "0928", deerling: "0585",
      pachirisu: "0417", emolga: "0587",
      glimmet: "0969", koffing: "0109",
      wooper: "0194", baltoy: "0343",
      // Phase 140-142: Rock/Bug/Fighting/Steel/Ghost/Psychic 6th
      anorith: "0347", lunatone: "0337",
      surskit: "0283", volbeat: "0313",
      scraggy: "0559", mankey: "0056",
      klefki: "0707", mawile: "0303",
      rotom: "0479", dreepy: "0885",
      munna: "0517", chingling: "0433",
      // Phase 143-145: Ice/Dark/Fairy/Dragon/Flying/Normal 6th
      smoochum: "0238", delibird: "0225",
      nuzleaf: "0274", spiritomb: "0442",
      marill: "0183", cleffa: "0173",
      druddigon: "0621", applin: "0840",
      hoppip: "0187", tropius: "0357",
      aipom: "0190", smeargle: "0235",
      // Phase 148-150: Water/Fire/Grass/Electric/Poison/Ground 7th
      poliwag: "0060", corphish: "0341",
      magby: "0240", darumaka: "0554",
      sewaddle: "0540", pumpkaboo: "0710",
      plusle: "0311", minun: "0312",
      nidoranF: "0029", seviper: "0336",
      gligar: "0207", rhyhorn: "0111",
      // Phase 151-153: Rock/Bug/Fighting/Steel/Ghost/Psychic 7th
      sudowoodo: "0185", boldore: "0525",
      pineco: "0204", heracross: "0214",
      hitmonlee: "0106", hitmonchan: "0107",
      steelix: "0208", scizor: "0212",
      banette: "0354", shedinja: "0292",
      slowpoke: "0079", girafarig: "0203",
      // Phase 154-156: Ice/Dark/Fairy/Dragon/Flying/Normal 7th
      glaceon: "0471", beartic: "0614",
      umbreon: "0197", cacturne: "0332",
      granbull: "0210", togekiss: "0468",
      shelgon: "0372", gabite: "0444",
      noctowl: "0164", xatu: "0178",
      kangaskhan: "0115", tauros: "0128",
      // Phase 158-160: 8th Tier
      psyduck: "0054", seel: "0086",
      cyndaquil: "0155", fennekin: "0653",
      sunkern: "0191", cacnea: "0331",
      pichu: "0172", chinchou: "0170",
      weedle: "0013", qwilfish: "0211",
      donphan: "0232", marowak: "0105",
      // Phase 161-163: 8th Tier Rock/Bug/Fighting/Steel/Ghost/Psychic
      onix: "0095", omanyte: "0138",
      scyther: "0123", pinsir: "0127",
      medicham: "0308", lucario: "0448",
      metang: "0375", lairon: "0305",
      gengar: "0094", chandelure: "0609",
      alakazam: "0065", gardevoir: "0282",
      // Phase 164-166: 8th Tier Ice/Dark/Fairy/Dragon/Flying/Normal
      lapras: "0131", weavile: "0461",
      honchkrow: "0430", houndoom: "0229",
      florges: "0671", mimikyu: "0778",
      dragonite: "0149", flygon: "0330",
      staraptor: "0398", braviary: "0628",
      snorlax: "0143", zangoose: "0335",
      // Phase 168-170: 9th Tier Water/Fire/Grass/Electric/Poison/Ground
      gyarados: "0130", kingdra: "0230",
      blaziken: "0257", typhlosion: "0157",
      venusaur: "0003", sceptile: "0254",
      jolteon: "0135", ampharos: "0181",
      nidoking: "0034", crobat: "0169",
      krookodile: "0553", nidoqueen: "0031",
      // Phase 171-173: 9th Tier Rock/Bug/Fighting/Steel/Ghost/Psychic
      tyranitar: "0248", aerodactyl: "0142",
      yanmega: "0469", scolipede: "0545",
      conkeldurr: "0534", machamp: "0068",
      magnezone: "0462", empoleon: "0395",
      dusknoir: "0477", cofagrigus: "0563",
      reuniclus: "0579", gothitelle: "0576",
      // Phase 174-176: 9th Tier Ice/Dark/Fairy/Dragon/Flying/Normal
      mamoswine: "0473", walrein: "0365",
      darkrai: "0491", hydreigon: "0635",
      sylveon: "0700", hatterene: "0858",
      haxorus: "0612", goodra: "0706",
      pidgeot: "0018", noivern: "0715",
      blissey: "0242", porygonZ: "0474",
      // Phase 178-180: 10th Tier Water/Fire/Grass/Electric/Poison/Ground
      blastoise: "0009", feraligatr: "0160",
      charizard: "0006", delphox: "0655",
      torterra: "0389", serperior: "0497",
      electivire: "0466", luxray: "0405",
      roserade: "0407", vileplume: "0045",
      rhyperior: "0464", dugtrio: "0051",
      // Phase 181-183: 10th Tier Rock/Bug/Fighting/Steel/Ghost/Psychic
      golem: "0076", terrakion: "0639",
      pheromosa: "0795", escavalier: "0589",
      kommoo: "0784", gallade: "0475",
      corviknight: "0823", bastiodon: "0411",
      aegislash: "0681", jellicent: "0593",
      slowking: "0199", bronzong: "0437",
      // Phase 184-186: 10th Tier Ice/Dark/Fairy/Dragon/Flying/Normal
      froslass: "0478", abomasnow: "0460",
      sharpedo: "0319", zoroark: "0571",
      primarina: "0730", diancie: "0719",
      dragapult: "0887", duraludon: "0884",
      swellow: "0277", talonflame: "0663",
      slaking: "0289", lopunny: "0428",
      // Phase 188-190: 11th Tier Water/Fire/Grass/Electric/Poison/Ground
      suicune: "0245", lugia: "0249",
      hooh: "0250", entei: "0244",
      celebi: "0251", virizion: "0640",
      raikou: "0243", zekrom: "0644",
      nihilego: "0793", naganadel: "0804",
      groudon: "0383", landorus: "0645",
      // Phase 191-193: 11th Tier Rock/Bug/Fighting/Steel/Ghost/Psychic
      regirock: "0377", stakataka: "0805",
      genesect: "0649", buzzwole: "0794",
      cobalion: "0638", marshadow: "0802",
      registeel: "0379", solgaleo: "0791",
      giratina: "0487", lunala: "0792",
      mewtwo: "0150", deoxys: "0386",
      // Phase 194-196: 11th Tier Ice/Dark/Fairy/Dragon/Flying/Normal
      regice: "0378", kyurem: "0646",
      yveltal: "0717", hoopa: "0720",
      xerneas: "0716", magearna: "0801",
      rayquaza: "0384", dialga: "0483",
      tornadus: "0641", articuno: "0144",
      arceus: "0493", regigigas: "0486",
      // Phase 198-200: 12th Tier (FINAL) Water/Fire/Grass/Electric/Poison/Ground
      kyogre: "0382", palkia: "0484",
      reshiram: "0643", victini: "0494",
      shaymin: "0492", tapuBulu: "0787",
      thundurus: "0642", zeraora: "0807",
      eternatus: "0890", poipole: "0803",
      zygarde: "0718", excadrill: "0530",
      // Phase 201-203: 12th Tier (FINAL) Rock/Bug/Fighting/Steel/Ghost/Psychic
      lycanroc: "0745", gigalith: "0526",
      volcarona: "0637", golisopod: "0768",
      urshifu: "0892", keldeo: "0647",
      heatran: "0485", kartana: "0798",
      spectrier: "0897", polteageist: "0855",
      mew: "0151", cresselia: "0488",
      // Phase 204-206: 12th Tier (FINAL) Ice/Dark/Fairy/Dragon/Flying/Normal
      calyrexIce: "0898", cloyster: "0091",
      grimmsnarl: "0861", incineroar: "0727",
      zacian: "0888", tapuLele: "0786",
      garchomp: "0445", latios: "0381",
      zapdos: "0145", moltres: "0146",
      silvally: "0773", meloetta: "0648",
    };

    // Load player + all enemy species + ally species for this dungeon
    const allySpeciesIds = (this.persistentAllies ?? []).map(a => a.speciesId);
    const neededKeys = new Set<string>([this.starterId, ...this.dungeonDef.enemySpeciesIds, ...allySpeciesIds]);
    for (const key of neededKeys) {
      const dexNum = spriteMap[key];
      const sp = SPECIES[key];
      if (!sp || !dexNum) continue;
      this.load.spritesheet(`${key}-walk`, `sprites/${dexNum}/Walk-Anim.png`, {
        frameWidth: sp.walkFrameWidth, frameHeight: sp.walkFrameHeight,
      });
      this.load.spritesheet(`${key}-idle`, `sprites/${dexNum}/Idle-Anim.png`, {
        frameWidth: sp.idleFrameWidth, frameHeight: sp.idleFrameHeight,
      });
    }
  }

  create() {
    initAudio();
    startBgm(this.dungeonDef.id);

    this.dungeon = generateDungeon();
    const { width, height, terrain, playerStart, stairsPos } = this.dungeon;

    // ── Floor Theme ──
    this.currentTheme = getDepthAdjustedTheme(this.dungeonDef.id, this.currentFloor);

    // ── Roll Floor Mutations early (before spawning) ──
    this.floorMutations = rollMutations(this.currentFloor, this.dungeonDef.id);
    this.typeShiftType = null;
    this.mirrorApplied = false;
    this.mutationHudTexts = [];

    if (hasMutation(this.floorMutations, MutationType.TypeShift)) {
      const allTypes = Object.values(PokemonType);
      this.typeShiftType = allTypes[Math.floor(Math.random() * allTypes.length)];
    }

    const rooms = this.dungeon.rooms;

    // Build a set of room tiles for corridor vs room distinction
    const isRoomTile = new Set<string>();
    for (const room of rooms) {
      for (let ry = room.y; ry < room.y + room.h; ry++) {
        for (let rx = room.x; rx < room.x + room.w; rx++) {
          isRoomTile.add(`${rx},${ry}`);
        }
      }
    }

    // ── Tilemap ──
    const tileData: number[][] = [];
    for (let y = 0; y < height; y++) {
      tileData[y] = [];
      for (let x = 0; x < width; x++) {
        tileData[y][x] = getTileIndex(terrain, x, y, width, height);
      }
    }
    const map = this.make.tilemap({
      data: tileData, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE,
    });
    const tileset = map.addTilesetImage(this.dungeonDef.tilesetKey);
    if (tileset) {
      const layer = map.createLayer(0, tileset, 0, 0);
      if (layer) {
        layer.setScale(TILE_SCALE);
        // Apply ambient tint from the floor theme to the tilemap layer
        layer.setTint(this.currentTheme.ambientTint);
      }
    }

    // ── Theme Color Overlay ──
    // Draw a subtle colored overlay on top of the tilemap to unify the look
    this.themeOverlay = this.add.graphics().setDepth(1);
    const themeAlpha = 0.18; // subtle enough to not hide tileset art
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = terrain[y][x];
        let color: number;
        let alpha = themeAlpha;

        if (t === TerrainType.WALL) {
          color = this.currentTheme.wallColor;
          alpha = 0.25; // walls get a stronger tint
        } else if (t === TerrainType.GROUND) {
          const inRoom = isRoomTile.has(`${x},${y}`);
          if (inRoom) {
            // Checkerboard pattern for room floor tiles
            color = (x + y) % 2 === 0 ? this.currentTheme.floorColor : this.currentTheme.floorAltColor;
          } else {
            // Corridor tiles
            color = this.currentTheme.corridorColor;
          }
        } else {
          // Water or other terrain
          color = this.currentTheme.floorColor;
          alpha = 0.12;
        }

        this.themeOverlay.fillStyle(color, alpha);
        this.themeOverlay.fillRect(
          x * TILE_DISPLAY, y * TILE_DISPLAY,
          TILE_DISPLAY, TILE_DISPLAY
        );
      }
    }

    // Stairs marker
    const stairsGfx = this.add.graphics();
    const sx = stairsPos.x * TILE_DISPLAY + TILE_DISPLAY / 2;
    const sy = stairsPos.y * TILE_DISPLAY + TILE_DISPLAY / 2;
    stairsGfx.fillStyle(0xfbbf24, 0.9);
    stairsGfx.fillTriangle(sx, sy - 14, sx + 10, sy, sx - 10, sy);
    stairsGfx.fillTriangle(sx, sy + 14, sx + 10, sy, sx - 10, sy);
    stairsGfx.setDepth(5);

    // ── Create animations for needed species (wrapped in try/catch to protect UI) ──
    const neededKeys = new Set<string>([this.starterId, ...this.dungeonDef.enemySpeciesIds]);
    for (const key of neededKeys) {
      try {
        const sp = SPECIES[key];
        if (!sp || this.anims.exists(`${key}-walk-0`)) continue;
        this.createAnimations(sp.spriteKey, sp.walkFrames, sp.idleFrames);
      } catch (e) {
        console.warn(`[DungeonScene] Failed to create animations for "${key}":`, e);
      }
    }

    // ── Player entity ──
    const playerSp = SPECIES[this.starterId] ?? SPECIES.mudkip;
    // Use tutor-taught custom skills if available, otherwise default species skills
    let playerSkills = this.persistentSkills;
    if (!playerSkills) {
      const meta = loadMeta();
      const customIds = meta.customSkills?.[this.starterId];
      if (customIds && customIds.length > 0) {
        playerSkills = customIds
          .filter(id => SKILL_DB[id])
          .map(id => createSkill(SKILL_DB[id]));
      }
      if (!playerSkills || playerSkills.length === 0) {
        playerSkills = createSpeciesSkills(playerSp);
      }
    }
    // NG+ bonus PP: add extra PP to all player skills
    if (this.ngPlusBonuses.bonusPP > 0) {
      for (const sk of playerSkills) {
        sk.pp += this.ngPlusBonuses.bonusPP;
        sk.currentPp += this.ngPlusBonuses.bonusPP;
      }
    }
    this.player = {
      tileX: playerStart.x,
      tileY: playerStart.y,
      facing: Direction.Down,
      stats: {
        hp: this.persistentHp,
        maxHp: this.persistentMaxHp,
        atk: this.persistentAtk, def: this.persistentDef, level: this.persistentLevel,
      },
      alive: true,
      spriteKey: playerSp.spriteKey,
      name: playerSp.name,
      types: playerSp.types,
      attackType: playerSp.attackType,
      skills: playerSkills,
      statusEffects: [],
      ability: SPECIES_ABILITIES[this.starterId] ?? SPECIES_ABILITIES["mudkip"],
      abilityLevel: getAbilityLevel(loadMeta().abilityLevels, SPECIES_ABILITIES[this.starterId] ?? SPECIES_ABILITIES["mudkip"]),
      speciesId: this.starterId,
    };
    const playerTextureKey = `${playerSp.spriteKey}-idle`;
    if (this.textures.exists(playerTextureKey)) {
      this.player.sprite = this.add.sprite(
        this.tileToPixelX(this.player.tileX),
        this.tileToPixelY(this.player.tileY),
        playerTextureKey
      );
      this.player.sprite.setScale(TILE_SCALE).setDepth(10);
      const animKey = `${playerSp.spriteKey}-idle-${Direction.Down}`;
      if (this.anims.exists(animKey)) this.player.sprite.play(animKey);
    } else {
      // Fallback: draw a colored circle as placeholder
      const gfx = this.add.graphics();
      gfx.fillStyle(0x4ade80, 1);
      gfx.fillCircle(this.tileToPixelX(this.player.tileX), this.tileToPixelY(this.player.tileY), TILE_DISPLAY / 3);
      gfx.setDepth(10);
    }
    this.allEntities.push(this.player);

    // ── Spawn persistent allies ──
    if (this.persistentAllies) {
      for (let ai = 0; ai < this.persistentAllies.length; ai++) {
        const allyData = this.persistentAllies[ai];
        const sp = SPECIES[allyData.speciesId];
        if (!sp) continue;
        const ax = playerStart.x + (ai === 0 ? 1 : -1);
        const ay = playerStart.y;
        const validX = (ax >= 0 && ax < width && terrain[ay]?.[ax] === TerrainType.GROUND) ? ax : playerStart.x;
        const validY = (validX === playerStart.x && ay + 1 < height && terrain[ay + 1]?.[validX] === TerrainType.GROUND) ? ay + 1 : ay;

        const ally: Entity = {
          tileX: validX, tileY: validY === ay && validX === playerStart.x ? ay : validY,
          facing: Direction.Down,
          stats: { hp: allyData.hp, maxHp: allyData.maxHp, atk: allyData.atk, def: allyData.def, level: allyData.level },
          alive: true, spriteKey: sp.spriteKey, name: sp.name,
          types: sp.types, attackType: sp.attackType,
          skills: deserializeSkillsFn(allyData.skills),
          statusEffects: [], isAlly: true, speciesId: allyData.speciesId,
          ability: SPECIES_ABILITIES[allyData.speciesId],
          allyTactic: AllyTactic.FollowMe,
        };
        const allyTex = `${sp.spriteKey}-idle`;
        if (this.textures.exists(allyTex)) {
          ally.sprite = this.add.sprite(
            this.tileToPixelX(ally.tileX), this.tileToPixelY(ally.tileY), allyTex
          ).setScale(TILE_SCALE).setDepth(10);
          const allyAnim = `${sp.spriteKey}-idle-${Direction.Down}`;
          if (this.anims.exists(allyAnim)) ally.sprite.play(allyAnim);
        }
        this.allies.push(ally);
        this.allEntities.push(ally);
        this.seenSpecies.add(allyData.speciesId); // Pokedex tracking
      }
    }

    // ── Spawn enemies (dungeon + floor specific) — skip for Boss Rush (boss only) ──
    if (!this.isBossRush) {
      const floorSpeciesIds = (this.dungeonDef.id === "endlessDungeon" || this.dungeonDef.id === "dailyDungeon")
        ? this.getEndlessEnemies(this.currentFloor)
        : getDungeonFloorEnemies(this.dungeonDef, this.currentFloor);
      const floorSpecies = floorSpeciesIds.map(id => SPECIES[id]).filter(Boolean);
      if (floorSpecies.length === 0) floorSpecies.push(SPECIES.zubat);

      for (let i = 1; i < rooms.length; i++) {
        const room = rooms[i];
        const baseEnemyCount = this.modifierEffects.doubleEnemies ? enemiesPerRoom(this.currentFloor) * 2 : enemiesPerRoom(this.currentFloor);
        const mutEnemyMult = hasMutation(this.floorMutations, MutationType.EnemySwarm) ? getMutationEffect(MutationType.EnemySwarm, "enemyCountMult") : 1;
        const enemyCount = Math.max(1, Math.ceil(baseEnemyCount * mutEnemyMult));
        for (let e = 0; e < enemyCount; e++) {
          const ex = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
          const ey = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
          if (terrain[ey][ex] !== TerrainType.GROUND) continue;
          if (ex === stairsPos.x && ey === stairsPos.y) continue;

          // Pick random species from floor pool
          const sp = floorSpecies[Math.floor(Math.random() * floorSpecies.length)];
          const enemyStats = getEnemyStats(this.currentFloor, this.dungeonDef.difficulty, sp, this.ngPlusLevel);

          // Apply enemyHpMult modifier
          if (this.modifierEffects.enemyHpMult !== 1) {
            enemyStats.hp = Math.floor(enemyStats.hp * this.modifierEffects.enemyHpMult);
            enemyStats.maxHp = Math.floor(enemyStats.maxHp * this.modifierEffects.enemyHpMult);
          }

          // Apply difficulty setting modifiers to enemy stats
          if (this.difficultyMods.enemyHpMult !== 1) {
            enemyStats.hp = Math.floor(enemyStats.hp * this.difficultyMods.enemyHpMult);
            enemyStats.maxHp = Math.floor(enemyStats.maxHp * this.difficultyMods.enemyHpMult);
          }
          if (this.difficultyMods.enemyAtkMult !== 1) {
            enemyStats.atk = Math.floor(enemyStats.atk * this.difficultyMods.enemyAtkMult);
          }

          // ── Floor Mutation: GiantEnemies (+30% HP) ──
          if (hasMutation(this.floorMutations, MutationType.GiantEnemies)) {
            const hpM = getMutationEffect(MutationType.GiantEnemies, "enemyHpMult");
            enemyStats.hp = Math.floor(enemyStats.hp * hpM);
            enemyStats.maxHp = Math.floor(enemyStats.maxHp * hpM);
          }
          // ── Floor Mutation: TreasureFloor (+50% ATK & HP) ──
          if (hasMutation(this.floorMutations, MutationType.TreasureFloor)) {
            const tHp = getMutationEffect(MutationType.TreasureFloor, "enemyHpMult");
            const tAtk = getMutationEffect(MutationType.TreasureFloor, "enemyAtkMult");
            enemyStats.hp = Math.floor(enemyStats.hp * tHp);
            enemyStats.maxHp = Math.floor(enemyStats.maxHp * tHp);
            enemyStats.atk = Math.floor(enemyStats.atk * tAtk);
          }

          // ── Floor Mutation: TypeShift — override types ──
          const enemyTypes = this.typeShiftType ? [this.typeShiftType] : sp.types;
          const enemyAttackType = this.typeShiftType ?? sp.attackType;

          // ── Roll enemy variant ──
          const variant = rollEnemyVariant(this.currentFloor, this.dungeonDef.difficulty);
          const vConfig = getVariantConfig(variant);

          // Apply variant stat multipliers
          enemyStats.hp = Math.floor(enemyStats.hp * vConfig.hpMult);
          enemyStats.maxHp = Math.floor(enemyStats.maxHp * vConfig.hpMult);
          enemyStats.atk = Math.floor(enemyStats.atk * vConfig.atkMult);
          enemyStats.def = Math.floor(enemyStats.def * vConfig.defMult);

          const enemy: Entity = {
            tileX: ex, tileY: ey,
            facing: Direction.Down,
            stats: { ...enemyStats },
            alive: true,
            spriteKey: sp.spriteKey,
            name: getVariantName(sp.name, variant),
            types: enemyTypes,
            attackType: enemyAttackType,
            skills: createSpeciesSkills(sp),
            statusEffects: [],
            speciesId: sp.spriteKey, // for recruitment
            ability: SPECIES_ABILITIES[sp.spriteKey],
          };
          const eTex = `${sp.spriteKey}-idle`;
          if (this.textures.exists(eTex)) {
            enemy.sprite = this.add.sprite(
              this.tileToPixelX(ex), this.tileToPixelY(ey), eTex
            );
            const giantScale = hasMutation(this.floorMutations, MutationType.GiantEnemies)
              ? TILE_SCALE * getMutationEffect(MutationType.GiantEnemies, "enemySpriteScale")
              : TILE_SCALE;
            enemy.sprite.setScale(giantScale * vConfig.spriteScale).setDepth(9);
            const eAnim = `${sp.spriteKey}-idle-${Direction.Down}`;
            if (this.anims.exists(eAnim)) enemy.sprite.play(eAnim);

            // Apply variant tint
            if (isSpecialVariant(variant)) {
              enemy.sprite.setTint(vConfig.tint);
            }
          }

          // Track variant in separate map (keeps Entity interface clean)
          if (isSpecialVariant(variant)) {
            this.enemyVariantMap.set(enemy, variant);
          }

          this.enemies.push(enemy);
          this.allEntities.push(enemy);
          this.seenSpecies.add(sp.id); // Pokedex tracking
        }
      }
    }

    // ── Spawn boss on final floor ──
    if (this.currentFloor === this.dungeonDef.floors && this.dungeonDef.boss) {
      const bossDef = this.dungeonDef.boss;
      const sp = SPECIES[bossDef.speciesId];
      if (sp) {
        // Place boss in the largest room (excluding player's room)
        const bossRoom = rooms.slice(1).reduce((best, r) =>
          (r.w * r.h > best.w * best.h) ? r : best, rooms[1]);
        const bx = bossRoom.x + Math.floor(bossRoom.w / 2);
        const by = bossRoom.y + Math.floor(bossRoom.h / 2);

        const baseStats = getEnemyStats(this.currentFloor, this.dungeonDef.difficulty, sp, this.ngPlusLevel);
        const bossStats = {
          hp: Math.floor(baseStats.hp * bossDef.statMultiplier * this.difficultyMods.enemyHpMult),
          maxHp: Math.floor(baseStats.hp * bossDef.statMultiplier * this.difficultyMods.enemyHpMult),
          atk: Math.floor(baseStats.atk * bossDef.statMultiplier * this.difficultyMods.enemyAtkMult),
          def: Math.floor(baseStats.def * bossDef.statMultiplier),
          level: baseStats.level + 3,
        };

        const boss: Entity = {
          tileX: bx, tileY: by,
          facing: Direction.Down,
          stats: bossStats,
          alive: true,
          spriteKey: sp.spriteKey,
          name: bossDef.name,
          types: sp.types,
          attackType: sp.attackType,
          skills: createSpeciesSkills(sp),
          statusEffects: [],
          speciesId: sp.spriteKey,
          isBoss: true,
          ability: SPECIES_ABILITIES[sp.spriteKey],
        };
        const bossTex = `${sp.spriteKey}-idle`;
        if (this.textures.exists(bossTex)) {
          boss.sprite = this.add.sprite(
            this.tileToPixelX(bx), this.tileToPixelY(by), bossTex
          );
          boss.sprite.setScale(TILE_SCALE * 1.5).setDepth(11);
          const bossAnim = `${sp.spriteKey}-idle-${Direction.Down}`;
          if (this.anims.exists(bossAnim)) boss.sprite.play(bossAnim);
        }
        // Red tint aura for boss
        if (boss.sprite) boss.sprite.setTint(0xff6666);
        this.time.delayedCall(800, () => { if (boss.sprite) boss.sprite.clearTint(); });

        this.bossEntity = boss;
        this.enemies.push(boss);
        this.allEntities.push(boss);
        this.seenSpecies.add(sp.id); // Pokedex tracking
      }
    }

    // ── Endless dungeon: spawn mini-boss every 10 floors ──
    if (this.dungeonDef.id === "endlessDungeon" && this.currentFloor % 10 === 0) {
      const allSpecies = Object.keys(SPECIES);
      const bossSpeciesId = allSpecies[Math.floor(Math.random() * allSpecies.length)];
      const sp = SPECIES[bossSpeciesId];
      if (sp) {
        const bossRoom = rooms.slice(1).reduce((best, r) =>
          (r.w * r.h > best.w * best.h) ? r : best, rooms[1]);
        const bx = bossRoom.x + Math.floor(bossRoom.w / 2);
        const by = bossRoom.y + Math.floor(bossRoom.h / 2);

        const bossMultiplier = 2.0 + this.currentFloor * 0.2;
        const baseStats = getEnemyStats(this.currentFloor, this.dungeonDef.difficulty, sp, this.ngPlusLevel);
        const bossStats = {
          hp: Math.floor(baseStats.hp * bossMultiplier * this.difficultyMods.enemyHpMult),
          maxHp: Math.floor(baseStats.hp * bossMultiplier * this.difficultyMods.enemyHpMult),
          atk: Math.floor(baseStats.atk * bossMultiplier * this.difficultyMods.enemyAtkMult),
          def: Math.floor(baseStats.def * bossMultiplier),
          level: baseStats.level + 3,
        };

        const boss: Entity = {
          tileX: bx, tileY: by,
          facing: Direction.Down,
          stats: bossStats,
          alive: true,
          spriteKey: sp.spriteKey,
          name: `Abyss ${sp.name}`,
          types: sp.types,
          attackType: sp.attackType,
          skills: createSpeciesSkills(sp),
          statusEffects: [],
          speciesId: sp.spriteKey,
          isBoss: true,
          ability: SPECIES_ABILITIES[sp.spriteKey],
        };
        const bossTex = `${sp.spriteKey}-idle`;
        if (this.textures.exists(bossTex)) {
          boss.sprite = this.add.sprite(
            this.tileToPixelX(bx), this.tileToPixelY(by), bossTex
          );
          boss.sprite.setScale(TILE_SCALE * 1.5).setDepth(11);
          const bossAnim = `${sp.spriteKey}-idle-${Direction.Down}`;
          if (this.anims.exists(bossAnim)) boss.sprite.play(bossAnim);
        }
        // Purple tint aura for endless boss
        if (boss.sprite) boss.sprite.setTint(0xaa66ff);
        this.time.delayedCall(800, () => { if (boss.sprite) boss.sprite.clearTint(); });

        this.bossEntity = boss;
        this.enemies.push(boss);
        this.allEntities.push(boss);
        this.seenSpecies.add(sp.id); // Pokedex tracking
      }
    }

    // ── Boss Rush: spawn a boss on every floor ──
    if (this.isBossRush) {
      const allSpecies = Object.keys(SPECIES);
      const bossSpeciesId = allSpecies[Math.floor(Math.random() * allSpecies.length)];
      const sp = SPECIES[bossSpeciesId];
      if (sp) {
        const bossRoom = rooms.slice(1).reduce((best, r) =>
          (r.w * r.h > best.w * best.h) ? r : best, rooms[1]);
        const bx = bossRoom.x + Math.floor(bossRoom.w / 2);
        const by = bossRoom.y + Math.floor(bossRoom.h / 2);

        // Boss multiplier scales with floor: floor 1 = 4.5x, floor 10 = 18x
        const bossMultiplier = 3.0 + this.currentFloor * 1.5;
        const baseStats = getEnemyStats(this.currentFloor, this.dungeonDef.difficulty, sp, this.ngPlusLevel);
        const bossStats = {
          hp: Math.floor(baseStats.hp * bossMultiplier * this.difficultyMods.enemyHpMult),
          maxHp: Math.floor(baseStats.hp * bossMultiplier * this.difficultyMods.enemyHpMult),
          atk: Math.floor(baseStats.atk * bossMultiplier * this.difficultyMods.enemyAtkMult),
          def: Math.floor(baseStats.def * bossMultiplier),
          level: baseStats.level + 5 + this.currentFloor,
        };

        // Roman numerals for floor labels
        const romanNumerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
        const floorLabel = romanNumerals[this.currentFloor - 1] ?? `${this.currentFloor}`;
        const bossName = `${sp.name} Overlord ${floorLabel}`;

        const boss: Entity = {
          tileX: bx, tileY: by,
          facing: Direction.Down,
          stats: bossStats,
          alive: true,
          spriteKey: sp.spriteKey,
          name: bossName,
          types: sp.types,
          attackType: sp.attackType,
          skills: createSpeciesSkills(sp),
          statusEffects: [],
          speciesId: sp.spriteKey,
          isBoss: true,
          ability: SPECIES_ABILITIES[sp.spriteKey],
        };
        const bossTex = `${sp.spriteKey}-idle`;
        if (this.textures.exists(bossTex)) {
          boss.sprite = this.add.sprite(
            this.tileToPixelX(bx), this.tileToPixelY(by), bossTex
          );
          boss.sprite.setScale(TILE_SCALE * 1.5).setDepth(11);
          const bossAnim = `${sp.spriteKey}-idle-${Direction.Down}`;
          if (this.anims.exists(bossAnim)) boss.sprite.play(bossAnim);
        }
        // Crimson tint aura for Boss Rush bosses
        if (boss.sprite) boss.sprite.setTint(0xff2222);
        this.time.delayedCall(800, () => { if (boss.sprite) boss.sprite.clearTint(); });

        this.bossEntity = boss;
        this.enemies.push(boss);
        this.allEntities.push(boss);
        this.seenSpecies.add(sp.id); // Pokedex tracking
      }
    }

    // ── Legendary Encounter check (rare mini-boss) ──
    if (!this.bossEntity && !this.isBossRush && shouldEncounterLegendary(this.currentFloor, this.dungeonDef.floors, loadMeta(), this.legendaryEncountered)) {
      const encounter = rollLegendaryEncounter(this.currentFloor, this.dungeonDef.difficulty);
      const legendSp = SPECIES[encounter.speciesId];
      if (legendSp) {
        this.legendaryEncountered = true;
        this.legendaryEncounter = encounter;

        // Place legendary in the largest room (excluding player's room)
        const legendaryRoom = rooms.slice(1).reduce((best, r) =>
          (r.w * r.h > best.w * best.h) ? r : best, rooms[1]);
        const lx = legendaryRoom.x + Math.floor(legendaryRoom.w / 2);
        const ly = legendaryRoom.y + Math.floor(legendaryRoom.h / 2);

        const baseStats = getEnemyStats(this.currentFloor, this.dungeonDef.difficulty, legendSp, this.ngPlusLevel);
        const legendaryStats = {
          hp: Math.floor(baseStats.hp * encounter.hpMultiplier * this.difficultyMods.enemyHpMult),
          maxHp: Math.floor(baseStats.hp * encounter.hpMultiplier * this.difficultyMods.enemyHpMult),
          atk: Math.floor(baseStats.atk * encounter.atkMultiplier * this.difficultyMods.enemyAtkMult),
          def: Math.floor(baseStats.def * encounter.defMultiplier),
          level: encounter.level,
        };

        // Give the legendary its special move alongside its normal skills
        const legendarySkills = createSpeciesSkills(legendSp);
        const specialMoveTemplate = SKILL_DB[encounter.specialMove];
        if (specialMoveTemplate && !legendarySkills.some(s => s.id === encounter.specialMove)) {
          // Replace the weakest skill with the special move
          if (legendarySkills.length >= 4) {
            const weakest = legendarySkills.reduce((min, s, i) =>
              s.power < legendarySkills[min].power ? i : min, 0);
            legendarySkills[weakest] = createSkill(specialMoveTemplate);
          } else {
            legendarySkills.push(createSkill(specialMoveTemplate));
          }
        }

        const legendary: Entity = {
          tileX: lx, tileY: ly,
          facing: Direction.Down,
          stats: legendaryStats,
          alive: true,
          spriteKey: legendSp.spriteKey,
          name: encounter.name,
          types: legendSp.types,
          attackType: legendSp.attackType,
          skills: legendarySkills,
          statusEffects: [],
          speciesId: legendSp.spriteKey,
          isBoss: true, // treated as boss for AI targeting and exp
        };

        // Create sprite with 1.5x scale for imposing presence
        const legendTex = `${legendSp.spriteKey}-idle`;
        if (this.textures.exists(legendTex)) {
          legendary.sprite = this.add.sprite(
            this.tileToPixelX(lx), this.tileToPixelY(ly), legendTex
          );
          legendary.sprite.setScale(TILE_SCALE * 1.5).setDepth(11);
          const legendAnim = `${legendSp.spriteKey}-idle-${Direction.Down}`;
          if (this.anims.exists(legendAnim)) legendary.sprite.play(legendAnim);
        }

        // Golden tint flash for legendary entrance
        if (legendary.sprite) legendary.sprite.setTint(0xffd700);
        this.time.delayedCall(1200, () => { if (legendary.sprite) legendary.sprite.clearTint(); });

        this.legendaryEntity = legendary;
        this.enemies.push(legendary);
        this.allEntities.push(legendary);
        this.seenSpecies.add(legendSp.id); // Pokedex tracking
      }
    }

    // ── Mini-Boss spawn check (10% on non-boss floors after floor 3) ──
    {
      const mbIsBossFloor = !!(this.dungeonDef.boss && this.currentFloor === this.dungeonDef.floors) || this.isBossRush;
      if (!this.bossEntity && !this.legendaryEntity && !mbIsBossFloor
          && shouldSpawnMiniBoss(this.currentFloor, mbIsBossFloor, this.dungeonDef.difficulty)) {
        const mbData = rollMiniBoss(this.currentFloor, this.dungeonDef.difficulty);
        if (mbData) {
          const mbSp = SPECIES[mbData.speciesId];
          if (mbSp && rooms.length > 1) {
            this.miniBossData = mbData;
            const mbRoom = rooms.slice(1).reduce((best, r) =>
              (r.w * r.h > best.w * best.h) ? r : best, rooms[1]);
            const mbx = mbRoom.x + Math.floor(mbRoom.w / 2);
            const mby = mbRoom.y + Math.floor(mbRoom.h / 2);
            const baseStats = getEnemyStats(this.currentFloor, this.dungeonDef.difficulty, mbSp, this.ngPlusLevel);
            const mbStats = {
              hp: Math.floor(baseStats.hp * mbData.hpMult * this.difficultyMods.enemyHpMult),
              maxHp: Math.floor(baseStats.hp * mbData.hpMult * this.difficultyMods.enemyHpMult),
              atk: Math.floor(baseStats.atk * mbData.atkMult * this.difficultyMods.enemyAtkMult),
              def: Math.floor(baseStats.def * mbData.defMult),
              level: mbData.level,
            };
            const miniBoss: Entity = {
              tileX: mbx, tileY: mby,
              facing: Direction.Down,
              stats: mbStats,
              alive: true,
              spriteKey: mbSp.spriteKey,
              name: mbData.name,
              types: mbSp.types,
              attackType: mbSp.attackType,
              skills: createSpeciesSkills(mbSp),
              statusEffects: [],
              speciesId: mbSp.spriteKey,
              isMiniBoss: true,
              ability: SPECIES_ABILITIES[mbSp.spriteKey],
            };
            const mbTex = `${mbSp.spriteKey}-idle`;
            if (this.textures.exists(mbTex)) {
              miniBoss.sprite = this.add.sprite(
                this.tileToPixelX(mbx), this.tileToPixelY(mby), mbTex
              );
              miniBoss.sprite.setScale(TILE_SCALE * 1.25).setDepth(11);
              const mbAnim = `${mbSp.spriteKey}-idle-${Direction.Down}`;
              if (this.anims.exists(mbAnim)) miniBoss.sprite.play(mbAnim);
            }
            if (miniBoss.sprite) miniBoss.sprite.setTint(mbData.color);
            this.time.delayedCall(1000, () => { if (miniBoss.sprite) miniBoss.sprite.clearTint(); });
            this.miniBossEntity = miniBoss;
            this.enemies.push(miniBoss);
            this.allEntities.push(miniBoss);
            this.seenSpecies.add(mbSp.id);
          }
        }
      }
    }

    // ── Boss Gauntlet check ──
    if (!this.bossEntity && shouldTriggerGauntlet(this.currentFloor, this.dungeonDef.id, this.dungeonDef.floors)) {
      this.gauntletConfig = generateGauntlet(this.currentFloor, this.dungeonDef.id, this.dungeonDef.difficulty);
      this.gauntletActive = true;
      this.gauntletCurrentWave = 0;
      this.gauntletTotalWavesCleared = 0;
      this.gauntletStairsLocked = true;
      this.gauntletEnemies = [];
    }

    // ── Spawn floor items ──
    this.inventory = this.persistentInventory ?? [];

    // NG+ bonus: start with a random item on new runs (floor 1, no persisted inventory)
    if (this.ngPlusBonuses.startWithItem && this.currentFloor === 1 && !this.persistentInventory) {
      const startItem = rollFloorItem();
      const existing = this.inventory.find(s => s.item.id === startItem.id && startItem.stackable);
      if (existing) existing.count++;
      else this.inventory.push({ item: startItem, count: 1 });
    }
    const ngItemDropMult = 1 + this.ngPlusBonuses.itemDropPercent / 100;
    // Lucky enchantment: +5% item find chance
    const enchItemMult = this.enchantment?.id === "lucky" ? 1.05 : 1.0;
    const mutItemMult = hasMutation(this.floorMutations, MutationType.ItemRain) ? getMutationEffect(MutationType.ItemRain, "itemMult") : 1;
    const talentItemMult = 1 + (this.talentEffects.itemSpawnPercent ?? 0) / 100;
    const itemCount = Math.max(1, Math.floor(this.dungeonDef.itemsPerFloor * this.difficultyMods.itemDropMult * ngItemDropMult * enchItemMult * mutItemMult * talentItemMult));
    for (let i = 0; i < itemCount; i++) {
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      const ix = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
      const iy = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
      if (terrain[iy][ix] !== TerrainType.GROUND) continue;
      if (ix === stairsPos.x && iy === stairsPos.y) continue;
      if (ix === playerStart.x && iy === playerStart.y) continue;

      const item = rollFloorItem();
      const icon = item.category === "berry" ? "●" : item.category === "seed" ? "◆" : item.category === "gem" ? "◇" : "★";
      const color = item.category === "berry" ? "#ff6b9d" : item.category === "seed" ? "#4ade80" : item.category === "gem" ? "#ddaaff" : "#60a5fa";
      const sprite = this.add.text(
        ix * TILE_DISPLAY + TILE_DISPLAY / 2,
        iy * TILE_DISPLAY + TILE_DISPLAY / 2,
        icon, { fontSize: "16px", color, fontFamily: "monospace" }
      ).setOrigin(0.5).setDepth(6);

      this.floorItems.push({ x: ix, y: iy, item, sprite });
    }

    // ── Spawn floor traps (hidden) ──
    const trapCount = Math.floor(trapsPerFloor(this.currentFloor, this.dungeonDef.difficulty) * this.difficultyMods.trapFreqMult);
    // Collect occupied positions (items, enemies, etc.)
    const occupiedPositions = new Set<string>();
    for (const fi of this.floorItems) occupiedPositions.add(`${fi.x},${fi.y}`);
    for (const e of this.enemies) occupiedPositions.add(`${e.tileX},${e.tileY}`);
    for (const a of this.allies) occupiedPositions.add(`${a.tileX},${a.tileY}`);
    this.floorTraps = generateTraps(
      width, height, terrain as unknown as number[][],
      trapCount,
      stairsPos.x, stairsPos.y,
      playerStart.x, playerStart.y,
      occupiedPositions,
      TerrainType.GROUND as unknown as number,
    );

    // ── Spawn hazard tiles (visible terrain dangers) ──
    // Add trap positions to occupied set so hazards don't overlap
    const hazardOccupied = new Set<string>(occupiedPositions);
    for (const ft of this.floorTraps) hazardOccupied.add(`${ft.x},${ft.y}`);
    this.floorHazards = generateHazards(
      width, height, terrain as unknown as number[][],
      this.currentFloor,
      this.dungeonDef.id,
      stairsPos.x, stairsPos.y,
      playerStart.x, playerStart.y,
      hazardOccupied,
      TerrainType.GROUND as unknown as number,
    );
    // Render hazard tiles and start visual effect tweens
    this.renderHazardTiles();

    // ── Kecleon Shop (20% chance, not on boss floors) ──
    const isBossFloor = (this.dungeonDef.boss && this.currentFloor === this.dungeonDef.floors) || this.isBossRush;

    // Switch to boss BGM theme on boss floors for dramatic atmosphere
    if (isBossFloor) {
      switchToBossTheme();
    }

    if (!isBossFloor && shouldSpawnShop(this.currentFloor, this.dungeonDef.floors) && rooms.length > 2) {
      // Pick a room that isn't the player's or stairs room
      const shopCandidates = rooms.filter(r =>
        // Not the player's room
        !(playerStart.x >= r.x && playerStart.x < r.x + r.w &&
          playerStart.y >= r.y && playerStart.y < r.y + r.h) &&
        // Not the stairs room
        !(stairsPos.x >= r.x && stairsPos.x < r.x + r.w &&
          stairsPos.y >= r.y && stairsPos.y < r.y + r.h)
      );
      if (shopCandidates.length > 0) {
        const shopRm = shopCandidates[Math.floor(Math.random() * shopCandidates.length)];
        this.shopRoom = shopRm;
        this.shopConfig = generateShopInventory(this.currentFloor, this.dungeonDef.difficulty);
        this.shopItems = this.shopConfig.items;

        // Draw shop carpet (tan rectangle under items)
        this.shopCarpet = this.add.graphics().setDepth(3);
        this.shopCarpet.fillStyle(0xd2b48c, 0.3);
        this.shopCarpet.fillRect(
          (shopRm.x + 1) * TILE_DISPLAY,
          (shopRm.y + 1) * TILE_DISPLAY,
          (shopRm.w - 2) * TILE_DISPLAY,
          (shopRm.h - 2) * TILE_DISPLAY,
        );
        // Carpet border
        this.shopCarpet.lineStyle(1, 0xd2b48c, 0.5);
        this.shopCarpet.strokeRect(
          (shopRm.x + 1) * TILE_DISPLAY,
          (shopRm.y + 1) * TILE_DISPLAY,
          (shopRm.w - 2) * TILE_DISPLAY,
          (shopRm.h - 2) * TILE_DISPLAY,
        );

        // Place shop items on the floor in the room
        for (let si = 0; si < this.shopItems.length; si++) {
          const sx = shopRm.x + 1 + (si % Math.max(1, shopRm.w - 2));
          const sy = shopRm.y + 1 + Math.floor(si / Math.max(1, shopRm.w - 2));
          if (sy >= shopRm.y + shopRm.h - 1) break;
          if (terrain[sy][sx] !== TerrainType.GROUND) continue;

          const shopItem = this.shopItems[si];
          const itemDef = ITEM_DB[shopItem.itemId];
          if (!itemDef) continue;
          const sprite = this.add.text(
            sx * TILE_DISPLAY + TILE_DISPLAY / 2,
            sy * TILE_DISPLAY + TILE_DISPLAY / 2,
            "💰", { fontSize: "14px", fontFamily: "monospace" }
          ).setOrigin(0.5).setDepth(7);

          // Price tag (yellow, 7px, floating above)
          const priceTag = this.add.text(
            sx * TILE_DISPLAY + TILE_DISPLAY / 2,
            sy * TILE_DISPLAY + TILE_DISPLAY + 2,
            `${shopItem.price}G`, { fontSize: "7px", color: "#fbbf24", fontFamily: "monospace" }
          ).setOrigin(0.5).setDepth(7);

          this.shopTiles.push({ x: sx, y: sy, shopIdx: si, sprite, priceTag });
        }

        // Kecleon shopkeeper sign
        const kcX = shopRm.x * TILE_DISPLAY + (shopRm.w * TILE_DISPLAY) / 2;
        const kcY = shopRm.y * TILE_DISPLAY + 4;
        this.add.text(kcX, kcY, "Kecleon Shop", {
          fontSize: "8px", color: "#4ade80", fontFamily: "monospace",
          backgroundColor: "#1a1a2ecc", padding: { x: 4, y: 2 },
        }).setOrigin(0.5).setDepth(8);

        this.showLog("There's a Kecleon Shop on this floor!");
      }
    }

    // ── Monster House (15% chance on floor 3+, not boss/floor 1) ──
    if (this.currentFloor >= 3 && !isBossFloor && Math.random() < 0.15 && rooms.length > 2) {
      const mhCandidates = rooms.filter(r =>
        !(playerStart.x >= r.x && playerStart.x < r.x + r.w &&
          playerStart.y >= r.y && playerStart.y < r.y + r.h) &&
        r !== this.shopRoom &&
        r.w * r.h >= 16
      );
      if (mhCandidates.length > 0) {
        this.monsterHouseRoom = mhCandidates[Math.floor(Math.random() * mhCandidates.length)];
        // Roll monster house type: 50% Standard, 25% Treasure, 25% Ambush
        const typeRoll = Math.random();
        if (typeRoll < 0.50) {
          this.monsterHouseType = MonsterHouseType.Standard;
        } else if (typeRoll < 0.75) {
          this.monsterHouseType = MonsterHouseType.Treasure;
        } else {
          this.monsterHouseType = MonsterHouseType.Ambush;
        }

        // Treasure type: pre-place extra items in the room
        if (this.monsterHouseType === MonsterHouseType.Treasure) {
          const mhRoom = this.monsterHouseRoom;
          const treasureCount = 2 + Math.floor(Math.random() * 3); // 2-4 extra items
          for (let ti = 0; ti < treasureCount; ti++) {
            const ix = mhRoom.x + 1 + Math.floor(Math.random() * Math.max(1, mhRoom.w - 2));
            const iy = mhRoom.y + 1 + Math.floor(Math.random() * Math.max(1, mhRoom.h - 2));
            if (terrain[iy]?.[ix] !== TerrainType.GROUND) continue;
            if (ix === stairsPos.x && iy === stairsPos.y) continue;

            const item = rollFloorItem();
            const icon = item.category === "berry" ? "●" : item.category === "seed" ? "◆" : item.category === "gem" ? "◇" : "★";
            const color = item.category === "berry" ? "#ff6b9d" : item.category === "seed" ? "#4ade80" : item.category === "gem" ? "#ddaaff" : "#60a5fa";
            const sprite = this.add.text(
              ix * TILE_DISPLAY + TILE_DISPLAY / 2,
              iy * TILE_DISPLAY + TILE_DISPLAY / 2,
              icon, { fontSize: "16px", color, fontFamily: "monospace" }
            ).setOrigin(0.5).setDepth(6);
            this.floorItems.push({ x: ix, y: iy, item, sprite });
          }
        }
      }
    }

    // ── Event Room (20% chance on floor 3+, not boss floor) ──
    if (this.currentFloor >= 3 && !isBossFloor && Math.random() < 0.20 && rooms.length > 2) {
      const eventCandidates = rooms.filter(r =>
        // Not the player's room
        !(playerStart.x >= r.x && playerStart.x < r.x + r.w &&
          playerStart.y >= r.y && playerStart.y < r.y + r.h) &&
        // Not the stairs room
        !(stairsPos.x >= r.x && stairsPos.x < r.x + r.w &&
          stairsPos.y >= r.y && stairsPos.y < r.y + r.h) &&
        // Not the shop room
        r !== this.shopRoom &&
        // Not the monster house room
        r !== this.monsterHouseRoom
      );
      if (eventCandidates.length > 0) {
        const evRoom = eventCandidates[Math.floor(Math.random() * eventCandidates.length)];
        const rolledEvent = rollDungeonEvent(this.currentFloor);
        if (rolledEvent) {
          this.eventRoom = evRoom;
          this.currentEvent = rolledEvent;

          // Place "!" marker at center of event room
          const markerX = Math.floor(evRoom.x + evRoom.w / 2);
          const markerY = Math.floor(evRoom.y + evRoom.h / 2);
          this.eventMarker = this.add.text(
            markerX * TILE_DISPLAY + TILE_DISPLAY / 2,
            markerY * TILE_DISPLAY + TILE_DISPLAY / 2 - 8,
            "!", { fontSize: "18px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
              stroke: "#000000", strokeThickness: 3 }
          ).setOrigin(0.5).setDepth(8);

          // Pulse animation on the marker
          this.tweens.add({
            targets: this.eventMarker,
            scaleX: { from: 1, to: 1.3 },
            scaleY: { from: 1, to: 1.3 },
            alpha: { from: 1, to: 0.6 },
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }
      }
    }

    // ── Puzzle Room (10% chance on floor 2+, not boss/first/last) ──
    if (!isBossFloor && shouldSpawnPuzzle(this.currentFloor, this.dungeonDef.floors) && rooms.length > 2) {
      const puzzleCandidates = rooms.filter(r =>
        // Not the player's room
        !(playerStart.x >= r.x && playerStart.x < r.x + r.w &&
          playerStart.y >= r.y && playerStart.y < r.y + r.h) &&
        // Not the stairs room
        !(stairsPos.x >= r.x && stairsPos.x < r.x + r.w &&
          stairsPos.y >= r.y && stairsPos.y < r.y + r.h) &&
        // Not shop, monster house, or event room
        r !== this.shopRoom &&
        r !== this.monsterHouseRoom &&
        r !== this.eventRoom &&
        // Needs enough space (at least 3x3 interior)
        r.w >= 4 && r.h >= 4
      );
      if (puzzleCandidates.length > 0) {
        const pzRoom = puzzleCandidates[Math.floor(Math.random() * puzzleCandidates.length)];
        const puzzleData = generatePuzzle(this.currentFloor, this.dungeonDef.difficulty);
        this.puzzleSys.setup(pzRoom, puzzleData);
      }
    }

    // ── Secret Room (5% chance on floor 3+, not last floor, not boss floor) ──
    if (!isBossFloor && shouldSpawnSecretRoom(this.currentFloor, this.dungeonDef.floors)) {
      // Find a wall tile adjacent to a corridor (not inside a room) that can host a secret entrance
      const secretEntrance = this.findSecretWallPosition(terrain, rooms, width, height, playerStart, stairsPos);
      if (secretEntrance) {
        this.secretWallPos = secretEntrance.wall;
        this.secretRoomData = generateSecretRoom(this.currentFloor, this.dungeonDef.difficulty);

        // Carve out a 3x3 secret room behind the wall
        const roomTiles = this.carveSecretRoom(
          secretEntrance.wall, secretEntrance.insideDir,
          terrain, width, height
        );
        if (roomTiles.length > 0) {
          this.secretRoomTiles = roomTiles;
          // Center tile of the 3x3 is the effect tile
          this.secretEffectTile = roomTiles[Math.floor(roomTiles.length / 2)];

          // Start shimmer hint on the secret wall
          this.startSecretWallShimmer();
        } else {
          // Could not carve room — cancel
          this.secretRoomData = null;
          this.secretWallPos = null;
        }
      }
    }

    // ── Shrine (15% chance, floor 2+, not boss) ──
    if (shouldSpawnShrine(this.currentFloor, this.dungeonDef.floors, isBossFloor) && rooms.length > 2) {
      // Pick a valid ground tile not in player room, stairs room, or any special room
      const shrineCandidates: { x: number; y: number }[] = [];
      for (const rm of rooms) {
        // Skip player room, stairs room, and special rooms
        if (playerStart.x >= rm.x && playerStart.x < rm.x + rm.w &&
            playerStart.y >= rm.y && playerStart.y < rm.y + rm.h) continue;
        if (stairsPos.x >= rm.x && stairsPos.x < rm.x + rm.w &&
            stairsPos.y >= rm.y && stairsPos.y < rm.y + rm.h) continue;
        if (rm === this.shopRoom || rm === this.monsterHouseRoom ||
            rm === this.eventRoom || rm === this.puzzleSys.puzzleRoom) continue;
        // Collect interior ground tiles
        for (let ry = rm.y + 1; ry < rm.y + rm.h - 1; ry++) {
          for (let rx = rm.x + 1; rx < rm.x + rm.w - 1; rx++) {
            if (terrain[ry]?.[rx] === TerrainType.GROUND) {
              shrineCandidates.push({ x: rx, y: ry });
            }
          }
        }
      }
      if (shrineCandidates.length > 0) {
        const spot = shrineCandidates[Math.floor(Math.random() * shrineCandidates.length)];
        this.shrineTileX = spot.x;
        this.shrineTileY = spot.y;
        this.floorShrine = generateShrine(this.currentFloor, this.dungeonDef.difficulty);
        this.shrineUsed = false;
        this.drawShrine();
        this.showLog("You sense a mysterious shrine on this floor...");
      }
    }

    // ── Fog of War ──
    this.visited = Array.from({ length: height }, () => new Array(width).fill(false));
    this.currentlyVisible = Array.from({ length: height }, () => new Array(width).fill(false));
    const talentSightBonus = this.talentEffects.sightRangeBonus ?? 0;
    const sightRadius = (hasMutation(this.floorMutations, MutationType.DarkFloor)
      ? getMutationEffect(MutationType.DarkFloor, "sightRadius")
      : 4) + talentSightBonus;
    this.revealArea(playerStart.x, playerStart.y, sightRadius);

    // ── Camera ──
    const mapPixelW = width * TILE_DISPLAY;
    const mapPixelH = height * TILE_DISPLAY;
    this.cameras.main.setBounds(0, 0, mapPixelW, mapPixelH);
    this.cameras.main.startFollow(this.player.sprite!, true, 0.15, 0.15);

    // Input is handled by D-Pad and skill buttons below

    // ── HUD ──
    // Portrait sprite (small idle frame)
    const portraitTex = `${this.starterId}-idle`;
    if (this.textures.exists(portraitTex)) {
      this.portraitSprite = this.add.sprite(20, 20, portraitTex)
        .setScrollFactor(0).setDepth(101).setScale(1.2);
      if (this.anims.exists(`${this.starterId}-idle-0`)) {
        this.portraitSprite.play(`${this.starterId}-idle-0`);
      }
    }

    // HP Bar background
    this.hpBarBg = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.hpBarBg.fillStyle(0x1a1a2e, 0.9);
    this.hpBarBg.fillRoundedRect(38, 8, 100, 10, 3);
    this.hpBarBg.lineStyle(1, 0x333355);
    this.hpBarBg.strokeRoundedRect(38, 8, 100, 10, 3);

    // HP Bar fill
    this.hpBarFill = this.add.graphics().setScrollFactor(0).setDepth(101);

    // Belly Bar background (below HP bar)
    this.bellyBarBg = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.bellyBarBg.fillStyle(0x1a1a2e, 0.9);
    this.bellyBarBg.fillRoundedRect(38, 19, 100, 6, 2);
    this.bellyBarBg.lineStyle(1, 0x333355);
    this.bellyBarBg.strokeRoundedRect(38, 19, 100, 6, 2);

    // Belly Bar fill
    this.bellyBarFill = this.add.graphics().setScrollFactor(0).setDepth(101);

    // Belly text label (on the bar)
    this.bellyText = this.add.text(40, 19, "", {
      fontSize: "5px", color: "#ffffff", fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(102);

    this.floorText = this.add
      .text(8, 6, "", { fontSize: "11px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold" })
      .setScrollFactor(0).setDepth(100);
    this.hpText = this.add
      .text(40, 9, "", { fontSize: "8px", color: "#ffffff", fontFamily: "monospace" })
      .setScrollFactor(0).setDepth(102);
    this.turnText = this.add
      .text(8, 40, "", { fontSize: "10px", color: "#60a5fa", fontFamily: "monospace" })
      .setScrollFactor(0).setDepth(100);

    // Speed Run Timer display
    this.timerText = this.add
      .text(8, 52, this.formatTime(this.runElapsedSeconds), { fontSize: "8px", color: "#6b7280", fontFamily: "monospace" })
      .setScrollFactor(0).setDepth(100);

    // Timer event: ticks every second, pauses when menus/overlays are open
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        // Don't count time when game is over or menus/overlays are open
        if (this.gameOver) return;
        if (this.bagOpen || this.menuOpen || this.settingsOpen || this.shopOpen || this.eventOpen || this.teamPanelOpen || this.fullMapOpen || this.relicOverlayOpen || this.shrineOpen) return;
        this.runElapsedSeconds++;
        const timeStr = this.formatTime(this.runElapsedSeconds);
        this.timerText.setText(timeStr);
        if (this.domHud) this.domHud.timerLabel.textContent = timeStr;
      },
    });

    this.logText = this.add
      .text(8, GAME_HEIGHT - 230, "", {
        fontSize: "10px", color: "#fbbf24", fontFamily: "monospace",
        wordWrap: { width: 340 },
        backgroundColor: "#000000cc",
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0).setDepth(100);

    // ── Chain HUD ──
    this.chainHudBg = this.add.graphics().setScrollFactor(0).setDepth(99);
    this.chainHudText = this.add.text(GAME_WIDTH - 10, GAME_HEIGHT - 210, "", {
      fontSize: "11px", color: "#999999", fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 2,
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(100);
    this.chainHudText.setAlpha(0); // hidden initially
    this.lastChainTier = "";
    // If chain was carried from previous floor, show it
    if (this.scoreChain.currentMultiplier > 1.0) {
      this.updateChainHUD();
    }

    // ── Weather ──
    this.currentWeather = rollFloorWeather(this.dungeonDef.id, this.currentFloor);
    this.currentWeatherIntensity = getWeatherIntensity(this.currentFloor, this.dungeonDef.floors);
    this.floorTurns = 0;
    this.weatherText = this.add.text(GAME_WIDTH / 2, 24, "", {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);

    if (this.currentWeather !== WeatherType.None) {
      const wd = WEATHERS[this.currentWeather];
      const intLabel = this.currentWeatherIntensity;
      this.weatherText.setText(`${wd.symbol} ${wd.name} (${intLabel}): ${wd.description}`);
      this.weatherText.setColor(INTENSITY_COLOR[this.currentWeatherIntensity]);
      sfxWeatherChange();
      this.showLog(`The weather is ${wd.name} (${intLabel})!`);
      // Run log: weather on floor start
      this.runLog.add(RunLogEvent.WeatherChanged, wd.name, this.currentFloor, this.turnManager.turn);
    }
    this.setupWeatherVisuals();
    this.setupStatusFlashAnimations();

    // ── Weather HUD Indicator ──
    this.weatherIntensityHudText = null;
    if (this.currentWeather !== WeatherType.None) {
      const weatherNames: Record<string, string> = {
        [WeatherType.Rain]: "Rain",
        [WeatherType.Sandstorm]: "Sandstorm",
        [WeatherType.Hail]: "Hail",
      };
      const intLabel = this.currentWeatherIntensity;
      this.weatherIntensityHudText = this.add.text(GAME_WIDTH - 10, 55,
        `${weatherNames[this.currentWeather]} (${intLabel})`, {
        fontSize: "8px", color: INTENSITY_COLOR[this.currentWeatherIntensity], fontFamily: "monospace",
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    }

    // ── Weather Forecast HUD (next 2 floors) ──
    this.weatherForecastHudText = null;
    if (this.dungeonDef.id !== "bossRush") {
      const forecastStart = this.currentFloor + 1;
      const forecastCount = Math.min(2, Math.max(0, this.dungeonDef.floors - this.currentFloor));
      if (forecastCount > 0) {
        const forecasts = generateForecast(this.dungeonDef.id, forecastStart, forecastCount, this.dungeonDef.floors);
        const lines = forecasts.map(f => forecastToString(f));
        this.weatherForecastHudText = this.add.text(GAME_WIDTH - 10, 65,
          lines.join("  "), {
          fontSize: "7px", color: "#6b7280", fontFamily: "monospace",
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
      }
    }

    // ── Challenge Mode Badge ──
    if (this.challengeMode) {
      const chDef = CHALLENGE_MODES.find(c => c.id === this.challengeMode);
      if (chDef) {
        this.challengeBadgeText = this.add.text(GAME_WIDTH / 2, 36, `[${chDef.name.toUpperCase()}]`, {
          fontSize: "9px", color: chDef.color, fontFamily: "monospace", fontStyle: "bold",
          backgroundColor: "#00000088", padding: { x: 4, y: 1 },
        }).setOrigin(0.5).setScrollFactor(0).setDepth(103);

        if (this.challengeMode === "speedrun") {
          this.showLog(`Speed Run! Complete in ${this.challengeTurnLimit} turns!`);
        } else if (this.challengeMode === "noItems") {
          this.showLog("No Items challenge! Items are forbidden!");
        } else if (this.challengeMode === "solo") {
          this.showLog("Solo challenge! No allies, +30% stats!");
        }
      }
    }

    // ── NG+ Badge ──
    if (this.ngPlusLevel > 0) {
      const ngBadgeY = this.challengeMode ? 48 : 36;
      this.ngPlusBadgeText = this.add.text(GAME_WIDTH - 8, ngBadgeY, `NG+${this.ngPlusLevel}`, {
        fontSize: "8px", color: "#a855f7", fontFamily: "monospace", fontStyle: "bold",
        backgroundColor: "#00000088", padding: { x: 3, y: 1 },
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(103);
    }

    // ── Dungeon Modifier Badges ──
    if (this.activeModifiers.length > 0) {
      const badgeY = this.challengeMode ? 48 : 36; // offset below challenge badge if present
      for (let mi = 0; mi < this.activeModifiers.length; mi++) {
        const mod = this.activeModifiers[mi];
        this.add.text(GAME_WIDTH / 2, badgeY + mi * 12, `[${mod.name}]`, {
          fontSize: "8px", color: mod.color, fontFamily: "monospace", fontStyle: "bold",
          backgroundColor: "#00000088", padding: { x: 3, y: 1 },
        }).setOrigin(0.5).setScrollFactor(0).setDepth(103);
      }

      // Show modifier intro overlay (auto-dismiss after 2 seconds)
      const overlayBg = this.add.rectangle(
        GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH * 0.8, 30 + this.activeModifiers.length * 22,
        0x000000, 0.85
      ).setScrollFactor(0).setDepth(300);
      const overlayTexts: Phaser.GameObjects.Text[] = [];
      const overlayTitle = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10 - this.activeModifiers.length * 8, "Dungeon Modifiers", {
        fontSize: "11px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
      overlayTexts.push(overlayTitle);
      for (let mi = 0; mi < this.activeModifiers.length; mi++) {
        const mod = this.activeModifiers[mi];
        const modText = this.add.text(
          GAME_WIDTH / 2, GAME_HEIGHT / 2 + 6 + mi * 18 - (this.activeModifiers.length - 1) * 4,
          `[${mod.name}] ${mod.description}`,
          { fontSize: "9px", color: mod.color, fontFamily: "monospace", backgroundColor: "#00000066", padding: { x: 4, y: 2 } }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(301);
        overlayTexts.push(modText);
      }
      this.time.delayedCall(2000, () => {
        overlayBg.destroy();
        for (const t of overlayTexts) t.destroy();
      });
    }

    // ── Floor Mutation: MirrorWorld — swap player and all enemy ATK/DEF ──
    if (hasMutation(this.floorMutations, MutationType.MirrorWorld) && !this.mirrorApplied) {
      this.mirrorApplied = true;
      const pAtk = this.player.stats.atk;
      this.player.stats.atk = this.player.stats.def;
      this.player.stats.def = pAtk;
      for (const enemy of this.enemies) {
        const eAtk = enemy.stats.atk;
        enemy.stats.atk = enemy.stats.def;
        enemy.stats.def = eAtk;
      }
    }

    // ── Floor Mutation: TreasureFloor — spawn extra rare items ──
    if (hasMutation(this.floorMutations, MutationType.TreasureFloor)) {
      const extraCount = getMutationEffect(MutationType.TreasureFloor, "extraRareItems");
      for (let i = 0; i < extraCount; i++) {
        const room = rooms[Math.floor(Math.random() * rooms.length)];
        const ix = room.x + 1 + Math.floor(Math.random() * Math.max(1, room.w - 2));
        const iy = room.y + 1 + Math.floor(Math.random() * Math.max(1, room.h - 2));
        if (terrain[iy]?.[ix] !== TerrainType.GROUND) continue;

        const item = rollFloorItem();
        const icon = item.category === "berry" ? "\u25CF" : item.category === "seed" ? "\u25C6" : item.category === "gem" ? "\u25C7" : "\u2605";
        const color = "#fde68a"; // golden tint for treasure items
        const sprite = this.add.text(
          ix * TILE_DISPLAY + TILE_DISPLAY / 2,
          iy * TILE_DISPLAY + TILE_DISPLAY / 2,
          icon, { fontSize: "16px", color, fontFamily: "monospace" }
        ).setOrigin(0.5).setDepth(6);

        this.floorItems.push({ x: ix, y: iy, item, sprite });
      }
    }

    // ── Mutation HUD Badges (left side, below timer text) ──
    if (this.floorMutations.length > 0) {
      // Run log: mutations active on this floor
      for (const m of this.floorMutations) {
        this.runLog.add(RunLogEvent.MutationActive, m.name, this.currentFloor, this.turnManager.turn);
      }
      const mutBaseY = 64; // below timer text
      for (let mi = 0; mi < this.floorMutations.length; mi++) {
        const mut = this.floorMutations[mi];
        const colorStr = mutationColorHex(mut);
        const badge = this.add.text(8, mutBaseY + mi * 14, `${mut.icon} ${mut.name}`, {
          fontSize: "8px", color: colorStr, fontFamily: "monospace", fontStyle: "bold",
          backgroundColor: "#00000088", padding: { x: 3, y: 1 },
        }).setScrollFactor(0).setDepth(103).setInteractive();

        badge.on("pointerdown", () => {
          this.showLog(`${mut.name}: ${mut.description}`);
        });

        this.mutationHudTexts.push(badge);
      }

      // Mutation intro banner (auto-dismiss after 2.5s)
      const bannerBg = this.add.rectangle(
        GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH * 0.85, 30 + this.floorMutations.length * 22,
        0x000000, 0.88
      ).setScrollFactor(0).setDepth(600);
      const bannerTexts: Phaser.GameObjects.Text[] = [];
      const bannerTitle = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10 - this.floorMutations.length * 8, "Floor Mutation!", {
        fontSize: "11px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(601);
      bannerTexts.push(bannerTitle);
      for (let mi = 0; mi < this.floorMutations.length; mi++) {
        const mut = this.floorMutations[mi];
        const colorStr = mutationColorHex(mut);
        const mutText = this.add.text(
          GAME_WIDTH / 2, GAME_HEIGHT / 2 + 6 + mi * 18 - (this.floorMutations.length - 1) * 4,
          `${mut.icon} [${mut.name}] ${mut.description}`,
          { fontSize: "9px", color: colorStr, fontFamily: "monospace", backgroundColor: "#00000066", padding: { x: 4, y: 2 } }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(601);
        bannerTexts.push(mutText);
      }
      this.time.delayedCall(2500, () => {
        bannerBg.destroy();
        for (const t of bannerTexts) t.destroy();
      });

      for (const mut of this.floorMutations) {
        this.showLog(`Floor Mutation: ${mut.name} — ${mut.description}`);
      }
    }

    // ── Floor Event (floor-wide global effect) ──
    this.floorEvent = rollFloorEvent(this.currentFloor, this.dungeonDef.difficulty);
    if (this.floorEvent) {
      const fe = this.floorEvent;
      const feColorHex = floorEventColorHex(fe);

      // HUD badge (below mutation badges)
      const mutBadgeCount = this.mutationHudTexts?.length ?? 0;
      const feBadgeY = 64 + mutBadgeCount * 14;
      this.floorEventBadge = this.add.text(8, feBadgeY, `${fe.icon} ${fe.name}`, {
        fontSize: "8px", color: feColorHex, fontFamily: "monospace", fontStyle: "bold",
        backgroundColor: "#00000088", padding: { x: 3, y: 1 },
      }).setScrollFactor(0).setDepth(103).setInteractive();
      this.floorEventBadge.on("pointerdown", () => {
        this.showLog(`${fe.name}: ${fe.description}`);
      });

      // Auto-dismiss banner at screen center (delayed to avoid overlapping mutation banner)
      const bannerDelay = this.floorMutations.length > 0 ? 2800 : 200;
      this.time.delayedCall(bannerDelay, () => {
        const feBannerBg = this.add.rectangle(
          GAME_WIDTH / 2, 40, GAME_WIDTH * 0.85, 40,
          0x000000, 0.88
        ).setScrollFactor(0).setDepth(600);
        const feBannerTitle = this.add.text(GAME_WIDTH / 2, 32, `${fe.icon} ${fe.name}`, {
          fontSize: "12px", color: feColorHex, fontFamily: "monospace", fontStyle: "bold",
        }).setOrigin(0.5).setScrollFactor(0).setDepth(601);
        const feBannerDesc = this.add.text(GAME_WIDTH / 2, 46, fe.description, {
          fontSize: "8px", color: "#e2e8f0", fontFamily: "monospace",
        }).setOrigin(0.5).setScrollFactor(0).setDepth(601);
        this.time.delayedCall(2500, () => {
          feBannerBg.destroy();
          feBannerTitle.destroy();
          feBannerDesc.destroy();
        });
      });

      this.showLog(`Floor Event: ${fe.name} — ${fe.description}`);

      // Apply FamineFloor: destroy all floor items that were just spawned
      if (fe.type === FloorEventType.FamineFloor) {
        for (const fi of this.floorItems) {
          if (fi.sprite) fi.sprite.destroy();
        }
        this.floorItems = [];
      }

      // Apply TreasureFloor: spawn extra items (doubling)
      if (fe.type === FloorEventType.TreasureFloor) {
        const extraCount = Math.max(1, Math.floor(this.dungeonDef.itemsPerFloor));
        for (let i = 0; i < extraCount; i++) {
          const room = rooms[Math.floor(Math.random() * rooms.length)];
          const ix = room.x + 1 + Math.floor(Math.random() * Math.max(1, room.w - 2));
          const iy = room.y + 1 + Math.floor(Math.random() * Math.max(1, room.h - 2));
          if (terrain[iy]?.[ix] !== TerrainType.GROUND) continue;
          if (ix === stairsPos.x && iy === stairsPos.y) continue;
          const item = rollFloorItem();
          const icon = item.category === "berry" ? "\u25CF" : item.category === "seed" ? "\u25C6" : item.category === "gem" ? "\u25C7" : "\u2605";
          const color = "#fde68a"; // golden tint for treasure items
          const sprite = this.add.text(
            ix * TILE_DISPLAY + TILE_DISPLAY / 2,
            iy * TILE_DISPLAY + TILE_DISPLAY / 2,
            icon, { fontSize: "16px", color, fontFamily: "monospace" }
          ).setOrigin(0.5).setDepth(6);
          this.floorItems.push({ x: ix, y: iy, item, sprite });
        }
      }
    }

    // ── Minimap ──
    this.minimapBg = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.minimapBorder = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.minimapGfx = this.add.graphics().setScrollFactor(0).setDepth(101);
    this.minimapExpanded = false;
    this.minimapLegendTexts = [];
    this.createMinimap();

    // Tap on minimap zone to toggle small ↔ large
    const smW = width * this.MINIMAP_TILE_SMALL + 4;
    const smH = height * this.MINIMAP_TILE_SMALL + 4;
    this.minimapHitZone = this.add.zone(
      this.MINIMAP_X_SMALL - 2 + smW / 2,
      this.MINIMAP_Y_SMALL - 2 + smH / 2,
      smW, smH
    ).setScrollFactor(0).setDepth(102).setInteractive();
    this.minimapHitZone.on("pointerdown", () => {
      this.minimapExpanded = !this.minimapExpanded;
      this.updateMinimapHitZone();
      this.updateMinimap();
    });

    // ── MAP button (top-right, near minimap) ──
    this.fullMapOpen = false;
    this.fullMapUI = [];
    this.mapButton = this.add.text(
      this.MINIMAP_X_SMALL - 2, this.MINIMAP_Y_SMALL + height * this.MINIMAP_TILE_SMALL + 10,
      "MAP",
      {
        fontSize: "8px", color: "#60a5fa", fontFamily: "monospace", fontStyle: "bold",
        backgroundColor: "#1a1a2ecc", padding: { x: 4, y: 2 },
      }
    ).setScrollFactor(0).setDepth(110).setInteractive();
    this.mapButton.on("pointerdown", () => {
      if (this.fullMapOpen) return;
      this.openFullMap();
    });

    // ── Virtual D-Pad ──
    this.createDPad();

    // Skill buttons & action buttons are handled entirely by DOM HUD (initDomHud)

    // ── Hamburger menu button (top-right corner, clear of minimap) ──
    const hamX = GAME_WIDTH - 20;
    const hamY = 72;
    this.add.text(hamX, hamY, "☰", {
      fontSize: "18px", color: "#aab0c8", fontFamily: "monospace",
      backgroundColor: "#1a1a2ecc", padding: { x: 5, y: 2 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(110).setInteractive()
      .on("pointerdown", () => this.openHamburgerMenu());

    // ── Boss HP Bar (fixed UI, hidden until boss floor) ──
    if (this.bossEntity) {
      const barW = 200;
      const barX = (GAME_WIDTH - barW) / 2;
      const barY = 56;

      this.bossHpBg = this.add.graphics().setScrollFactor(0).setDepth(100);
      this.bossHpBg.fillStyle(0x1a1a2e, 0.95);
      this.bossHpBg.fillRoundedRect(barX - 4, barY - 4, barW + 8, 24, 4);
      this.bossHpBg.lineStyle(2, 0xff4444);
      this.bossHpBg.strokeRoundedRect(barX - 4, barY - 4, barW + 8, 24, 4);

      this.bossHpBar = this.add.graphics().setScrollFactor(0).setDepth(101);

      this.bossNameText = this.add.text(GAME_WIDTH / 2, barY - 2, `★ ${this.bossEntity.name} ★`, {
        fontSize: "10px", color: "#ff6666", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(102);
    }

    // ── Legendary HP Bar (golden, only when legendary encounter present) ──
    if (this.legendaryEntity && !this.bossEntity) {
      const barW = 200;
      const barX = (GAME_WIDTH - barW) / 2;
      const barY = 56;

      this.legendaryHpBg = this.add.graphics().setScrollFactor(0).setDepth(100);
      this.legendaryHpBg.fillStyle(0x1a1a2e, 0.95);
      this.legendaryHpBg.fillRoundedRect(barX - 4, barY - 4, barW + 8, 24, 4);
      this.legendaryHpBg.lineStyle(2, 0xffd700); // golden border
      this.legendaryHpBg.strokeRoundedRect(barX - 4, barY - 4, barW + 8, 24, 4);

      this.legendaryHpBar = this.add.graphics().setScrollFactor(0).setDepth(101);

      this.legendaryNameText = this.add.text(GAME_WIDTH / 2, barY - 2, `★ ${this.legendaryEntity.name} ★`, {
        fontSize: "10px", color: "#ffd700", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(102);

      // Ambient gold particle sparkles around the legendary
      this.legendaryParticleGraphics = this.add.graphics().setDepth(12);
      this.legendaryParticleTimer = this.time.addEvent({
        delay: 200,
        loop: true,
        callback: () => {
          if (!this.legendaryEntity || !this.legendaryEntity.alive || !this.legendaryEntity.sprite || !this.legendaryParticleGraphics) return;
          this.legendaryParticleGraphics.clear();
          const sx = this.legendaryEntity.sprite.x;
          const sy = this.legendaryEntity.sprite.y;
          for (let i = 0; i < 4; i++) {
            const px = sx + (Math.random() - 0.5) * 24;
            const py = sy + (Math.random() - 0.5) * 24;
            const alpha = 0.4 + Math.random() * 0.6;
            this.legendaryParticleGraphics.fillStyle(0xffd700, alpha);
            this.legendaryParticleGraphics.fillCircle(px, py, 1 + Math.random());
          }
        },
      });
    }

    // ── Mini-Boss HP Bar (orange, smaller than boss/legendary bar) ──
    if (this.miniBossEntity && !this.bossEntity && !this.legendaryEntity) {
      const barW = 160;
      const barX = (GAME_WIDTH - barW) / 2;
      const barY = 56;

      this.miniBossHpBg = this.add.graphics().setScrollFactor(0).setDepth(100);
      this.miniBossHpBg.fillStyle(0x1a1a2e, 0.95);
      this.miniBossHpBg.fillRoundedRect(barX - 4, barY - 4, barW + 8, 22, 4);
      this.miniBossHpBg.lineStyle(2, 0xff8800); // orange border
      this.miniBossHpBg.strokeRoundedRect(barX - 4, barY - 4, barW + 8, 22, 4);

      this.miniBossHpBar = this.add.graphics().setScrollFactor(0).setDepth(101);

      this.miniBossNameText = this.add.text(GAME_WIDTH / 2, barY - 2, `◆ ${this.miniBossEntity.name} ◆`, {
        fontSize: "9px", color: "#ff8800", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(102);
    }

    // ── DOM HUD overlay: crisp text at any DPI ──
    this.initDomHud();

    this.updateHUD();
    this.updateRelicHUD();
    this.updateBlessingHUD();
    this.updateTypeGemHUD();

    // Grant a random blessing/curse every 5 floors (starting floor 5)
    if (this.currentFloor > 1 && this.currentFloor % 5 === 0 && this.activeBlessings.length < 5) {
      const b = rollBlessingOrCurse();
      this.time.delayedCall(800, () => this.grantBlessing(b));
    }

    // Boss floor entrance message
    if (this.bossEntity) {
      this.showLog(`⚠ BOSS FLOOR! ${this.bossEntity.name} awaits!`);
    } else if (this.legendaryEntity && this.legendaryEncounter) {
      // Legendary encounter dramatic entrance
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.time.delayedCall(500, () => {
        this.cameras.main.fadeIn(500, 0, 0, 0);
      });
      switchToBossTheme();
      this.time.delayedCall(600, () => {
        this.showLog("A powerful presence approaches...");
      });
      this.time.delayedCall(1500, () => {
        if (this.legendaryEncounter) {
          this.showLog(this.legendaryEncounter.flavorText);
        }
      });
      this.time.delayedCall(2500, () => {
        if (this.legendaryEntity) {
          this.showLog(`★ ${this.legendaryEntity.name} appeared! ★`);
        }
      });
    } else if (this.miniBossEntity && this.miniBossData) {
      // Mini-boss entrance message
      this.showLog(`${this.dungeonDef.name} B${this.currentFloor}F`);
      this.time.delayedCall(600, () => {
        if (this.miniBossEntity) {
          this.showLog(`◆ A powerful ${this.miniBossEntity.name} lurks on this floor! ◆`);
        }
      });
    } else if (this.gauntletActive) {
      // Gauntlet announcement (deferred to give scene time to render)
      this.showLog(`${this.dungeonDef.name} B${this.currentFloor}F`);
      this.time.delayedCall(300, () => this.startGauntlet());
    } else {
      this.showLog(`${this.dungeonDef.name} B${this.currentFloor}F`);
    }

    // First-time tips for brand new players
    if (this.currentFloor === 1) {
      const tipMeta = loadMeta();
      if (tipMeta.totalRuns <= 1) {
        this.time.delayedCall(1500, () => {
          this.showLog("Tip: Use the D-Pad to move. Walk into enemies to attack!");
        });
        this.time.delayedCall(4500, () => {
          this.showLog("Tip: Find the stairs (gold marker) to go deeper!");
        });
      }
    }
  }

  // ── Helpers ──

  private tileToPixelX(tileX: number): number {
    return tileX * TILE_DISPLAY + TILE_DISPLAY / 2;
  }

  private tileToPixelY(tileY: number): number {
    return tileY * TILE_DISPLAY + TILE_DISPLAY / 2;
  }

  private createAnimations(key: string, walkFrames: number, idleFrames: number) {
    // Guard: skip if textures aren't loaded (prevents crash that kills all UI)
    if (!this.textures.exists(`${key}-walk`) || !this.textures.exists(`${key}-idle`)) {
      console.warn(`[DungeonScene] Missing sprite textures for "${key}", skipping animations`);
      return;
    }
    for (let dir = 0; dir < 8; dir++) {
      this.anims.create({
        key: `${key}-walk-${dir}`,
        frames: this.anims.generateFrameNumbers(`${key}-walk`, {
          start: dir * walkFrames, end: dir * walkFrames + walkFrames - 1,
        }),
        frameRate: 10, repeat: -1,
      });
      this.anims.create({
        key: `${key}-idle-${dir}`,
        frames: this.anims.generateFrameNumbers(`${key}-idle`, {
          start: dir * idleFrames, end: dir * idleFrames + idleFrames - 1,
        }),
        frameRate: 5, repeat: -1,
      });
    }
  }

  // ── Virtual D-Pad (supports left/right placement) ──

  private createDPad() {
    // Destroy old D-Pad if exists
    this.dpadUI.forEach(obj => obj.destroy());
    this.dpadUI = [];

    const isRight = this.dpadSide === "right";
    const cx = isRight ? GAME_WIDTH - 70 : 70;
    const cy = GAME_HEIGHT - 70;
    const r = 50;
    const btnR = 18;

    const bg = this.add.graphics().setScrollFactor(0).setDepth(108);
    bg.fillStyle(0x000000, 0.4);
    bg.fillCircle(cx, cy, r + 5);
    bg.lineStyle(2, 0x334155, 0.6);
    bg.strokeCircle(cx, cy, r + 5);
    this.dpadUI.push(bg);

    const dirs: { dir: Direction; label: string; dx: number; dy: number }[] = [
      { dir: Direction.Up, label: "▲", dx: 0, dy: -1 },
      { dir: Direction.UpRight, label: "◥", dx: 0.7, dy: -0.7 },
      { dir: Direction.Right, label: "▶", dx: 1, dy: 0 },
      { dir: Direction.DownRight, label: "◢", dx: 0.7, dy: 0.7 },
      { dir: Direction.Down, label: "▼", dx: 0, dy: 1 },
      { dir: Direction.DownLeft, label: "◣", dx: -0.7, dy: 0.7 },
      { dir: Direction.Left, label: "◀", dx: -1, dy: 0 },
      { dir: Direction.UpLeft, label: "◤", dx: -0.7, dy: -0.7 },
    ];

    for (const d of dirs) {
      const bx = cx + d.dx * (r - 5);
      const by = cy + d.dy * (r - 5);
      const btn = this.add.circle(bx, by, btnR, 0x1a1a2e, 0.7)
        .setScrollFactor(0).setDepth(109).setInteractive();
      const txt = this.add.text(bx, by, d.label, {
        fontSize: "12px", color: "#8899bb", fontFamily: "monospace",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(110);

      btn.on("pointerdown", () => {
        if (this.autoExploring) { this.stopAutoExplore("Stopped."); return; }
        if (this.turnManager.isBusy || !this.player.alive || this.gameOver || this.bagOpen || this.menuOpen || this.settingsOpen || this.teamPanelOpen || this.eventOpen || this.fullMapOpen || this.relicOverlayOpen || this.shrineOpen) return;
        txt.setColor("#fbbf24");
        this.time.delayedCall(150, () => txt.setColor("#8899bb"));
        this.handlePlayerAction(d.dir);
      });

      this.dpadUI.push(btn, txt);
    }

    // Wait button (center of D-Pad) — skip turn
    const waitBtn = this.add.circle(cx, cy, 14, 0x334155, 0.8)
      .setScrollFactor(0).setDepth(109).setInteractive();
    const waitTxt = this.add.text(cx, cy, "⏳", {
      fontSize: "10px", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(110);

    waitBtn.on("pointerdown", () => {
      if (this.autoExploring) { this.stopAutoExplore("Stopped."); return; }
      if (this.turnManager.isBusy || !this.player.alive || this.gameOver || this.bagOpen || this.menuOpen || this.settingsOpen || this.teamPanelOpen || this.eventOpen || this.fullMapOpen || this.relicOverlayOpen || this.shrineOpen) return;
      waitTxt.setAlpha(0.5);
      this.time.delayedCall(150, () => waitTxt.setAlpha(1));
      this.turnManager.executeTurn(
        () => Promise.resolve(),
        [...this.getAllyActions(), ...this.getEnemyActions()]
      ).then(() => {
        this.recoverPP(this.player);
        this.tickBelly();
        this.tickWeather();
        this.tickEntityStatus(this.player);
        this.updateHUD();
      });
    });

    this.dpadUI.push(waitBtn, waitTxt);
  }

  // ── Skill Buttons (opposite side of D-Pad, 2x2 grid) ──

  /** Skill buttons are now fully handled by DOM HUD — this is a no-op kept for call-site compatibility */
  private createSkillButtons() {
    // Phaser skill buttons removed — DOM HUD handles all skill UI
  }

  // Skill preview state
  private skillPreviewUI: Phaser.GameObjects.GameObject[] = [];
  private skillPreviewActive = false;

  private showSkillPreview(skillIndex: number) {
    this.clearSkillPreview();
    const skill = this.player.skills[skillIndex];
    if (!skill) return;
    this.skillPreviewActive = true;

    // Hide DOM skill buttons so they don't overlap OK/Cancel
    if (this.domHud) setDomSkillsVisible(this.domHud, false);

    const dir = this.player.facing;
    const tiles = getSkillTargetTiles(
      skill.range, this.player.tileX, this.player.tileY, dir,
      this.dungeon.terrain, this.dungeon.width, this.dungeon.height
    );

    // Highlight target tiles (bright orange-red, very visible)
    for (const t of tiles) {
      const px = t.x * TILE_DISPLAY + TILE_DISPLAY / 2;
      const py = t.y * TILE_DISPLAY + TILE_DISPLAY / 2;
      // Outer glow
      const glow = this.add.rectangle(px, py, TILE_DISPLAY + 2, TILE_DISPLAY + 2, 0xff6600, 0.25)
        .setDepth(7);
      this.skillPreviewUI.push(glow);
      // Main highlight — much bolder
      const highlight = this.add.rectangle(px, py, TILE_DISPLAY - 2, TILE_DISPLAY - 2, 0xfbbf24, 0.6)
        .setDepth(8);
      this.skillPreviewUI.push(highlight);
      this.tweens.add({
        targets: highlight, alpha: { from: 0.6, to: 0.35 },
        duration: 500, yoyo: true, repeat: -1,
      });
    }

    // Show info text
    const infoText = this.add.text(GAME_WIDTH / 2, 42, `${skill.name} (${skill.type}) Pow:${skill.power} PP:${skill.currentPp}/${skill.pp}`, {
      fontSize: "10px", color: "#fbbf24", fontFamily: "monospace", backgroundColor: "#000000cc",
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
    this.skillPreviewUI.push(infoText);

    // Replace skill buttons with Confirm/Cancel (same side as skill buttons, opposite D-Pad)
    const isRight = this.dpadSide === "right";
    const baseX = isRight ? 10 : GAME_WIDTH - 120;
    const baseY = GAME_HEIGHT - 95;

    const confirmBtn = this.add.text(baseX, baseY + 8, "  OK  ", {
      fontSize: "14px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
      backgroundColor: "#1a3a2e", padding: { x: 8, y: 8 },
    }).setScrollFactor(0).setDepth(210).setInteractive();

    const cancelBtn = this.add.text(baseX + 60, baseY + 8, "Cancel", {
      fontSize: "14px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
      backgroundColor: "#3a1a1e", padding: { x: 8, y: 8 },
    }).setScrollFactor(0).setDepth(210).setInteractive();

    this.skillPreviewUI.push(confirmBtn, cancelBtn);

    confirmBtn.on("pointerdown", () => {
      this.clearSkillPreview();
      this.handleSkillUse(skillIndex, this.player.facing);
    });

    cancelBtn.on("pointerdown", () => {
      this.clearSkillPreview();
    });
  }

  private clearSkillPreview() {
    for (const obj of this.skillPreviewUI) obj.destroy();
    this.skillPreviewUI = [];
    this.skillPreviewActive = false;
    // Restore DOM skill buttons
    if (this.domHud) setDomSkillsVisible(this.domHud, true);
  }

  /** Skill button updates are now handled by syncDomHud — this is a no-op */
  private updateSkillButtons() {
    // Phaser skill buttons removed — DOM HUD syncs skill state in syncDomHud()
  }
  /** Reveal tiles around a point (Chebyshev distance) */
  private revealArea(cx: number, cy: number, radius: number) {
    const { width, height } = this.dungeon;
    // Reset currentlyVisible for fresh computation
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.currentlyVisible[y][x] = false;
      }
    }
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          this.visited[ny][nx] = true;
          this.currentlyVisible[ny][nx] = true;
        }
      }
    }
    // Also mark tiles around allies as currently visible
    for (const a of this.allies) {
      if (!a.alive) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = a.tileX + dx;
          const ny = a.tileY + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            this.currentlyVisible[ny][nx] = true;
            this.visited[ny][nx] = true;
          }
        }
      }
    }
  }

  /** Get current minimap tile size and origin based on expanded state */
  private getMinimapParams() {
    const { width, height } = this.dungeon;
    if (this.minimapExpanded) {
      const t = this.MINIMAP_TILE_LARGE;
      const totalW = width * t;
      const totalH = height * t;
      const mx = Math.floor((GAME_WIDTH - totalW) / 2);
      const my = Math.floor((GAME_HEIGHT - totalH) / 2) - 10;
      return { t, mx, my, totalW, totalH };
    }
    const t = this.MINIMAP_TILE_SMALL;
    const totalW = width * t;
    const totalH = height * t;
    return { t, mx: this.MINIMAP_X_SMALL, my: this.MINIMAP_Y_SMALL, totalW, totalH };
  }

  /** Update the hit zone position/size to match current minimap mode */
  private updateMinimapHitZone() {
    const { mx, my, totalW, totalH } = this.getMinimapParams();
    const pad = 4;
    this.minimapHitZone.setPosition(mx - pad / 2 + totalW / 2, my - pad / 2 + totalH / 2);
    this.minimapHitZone.setSize(totalW + pad, totalH + pad);
  }

  private createMinimap() {
    // Initial draw happens through updateMinimap
    this.updateMinimap();
  }

  /** Draw minimap terrain and entities onto a graphics object at given position/scale */
  private drawMinimapContent(
    gfx: Phaser.GameObjects.Graphics,
    t: number, mx: number, my: number,
    expanded: boolean
  ) {
    const { width, height, terrain } = this.dungeon;
    const minimapFloorColor = this.currentTheme.floorColor;
    const dimFloorColor = darkenColor(minimapFloorColor, 0.35);

    // ── Terrain with fog of war ──
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (terrain[y][x] === TerrainType.GROUND) {
          if (this.currentlyVisible[y][x]) {
            // Currently in player's sight — full brightness
            gfx.fillStyle(minimapFloorColor, 0.9);
          } else if (this.visited[y][x]) {
            // Previously explored but out of sight — dim/dark gray
            gfx.fillStyle(dimFloorColor, 0.6);
          } else {
            // Unexplored — completely dark (skip drawing, bg is already black)
            continue;
          }
          gfx.fillRect(mx + x * t, my + y * t, t, t);
        }
      }
    }

    // ── Shop room outline (purple/magenta) ──
    if (this.shopRoom && !this.shopClosed) {
      const sr = this.shopRoom;
      let shopVisible = false;
      for (let sy = sr.y; sy < sr.y + sr.h && !shopVisible; sy++) {
        for (let sx = sr.x; sx < sr.x + sr.w && !shopVisible; sx++) {
          if (this.visited[sy]?.[sx]) shopVisible = true;
        }
      }
      if (shopVisible) {
        // Fill shop room tiles with purple tint
        gfx.fillStyle(0xc026d3, 0.2);
        for (let sy = sr.y; sy < sr.y + sr.h; sy++) {
          for (let sx = sr.x; sx < sr.x + sr.w; sx++) {
            if (this.visited[sy]?.[sx] && this.dungeon.terrain[sy]?.[sx] === TerrainType.GROUND) {
              gfx.fillRect(mx + sx * t, my + sy * t, t, t);
            }
          }
        }
        // Magenta border
        gfx.lineStyle(expanded ? 2 : 1, 0xc026d3, 0.8);
        gfx.strokeRect(
          mx + sr.x * t - 1, my + sr.y * t - 1,
          sr.w * t + 2, sr.h * t + 2
        );
      }
    }

    // ── Event room outline (cyan border) ──
    if (this.eventRoom && !this.eventTriggered) {
      const er = this.eventRoom;
      let eventVisible = false;
      for (let ey = er.y; ey < er.y + er.h && !eventVisible; ey++) {
        for (let ex = er.x; ex < er.x + er.w && !eventVisible; ex++) {
          if (this.visited[ey]?.[ex]) eventVisible = true;
        }
      }
      if (eventVisible) {
        gfx.lineStyle(expanded ? 2 : 1, 0x22d3ee, 0.8);
        gfx.strokeRect(
          mx + er.x * t - 1, my + er.y * t - 1,
          er.w * t + 2, er.h * t + 2
        );
      }
    }

    // ── Puzzle room outline (teal fill + border) ──
    if (this.puzzleSys.puzzleRoom && !this.puzzleSys.puzzleSolved && !this.puzzleSys.puzzleFailed) {
      const pr = this.puzzleSys.puzzleRoom;
      let puzzleVisible = false;
      for (let py = pr.y; py < pr.y + pr.h && !puzzleVisible; py++) {
        for (let px = pr.x; px < pr.x + pr.w && !puzzleVisible; px++) {
          if (this.visited[py]?.[px]) puzzleVisible = true;
        }
      }
      if (puzzleVisible) {
        // Teal tint on room tiles
        gfx.fillStyle(0x22d3ee, 0.25);
        for (let py = pr.y; py < pr.y + pr.h; py++) {
          for (let px = pr.x; px < pr.x + pr.w; px++) {
            if (this.visited[py]?.[px] && this.dungeon.terrain[py]?.[px] === TerrainType.GROUND) {
              gfx.fillRect(mx + px * t, my + py * t, t, t);
            }
          }
        }
        // Teal border
        gfx.lineStyle(expanded ? 2 : 1, 0x22d3ee, 0.9);
        gfx.strokeRect(
          mx + pr.x * t - 1, my + pr.y * t - 1,
          pr.w * t + 2, pr.h * t + 2
        );
      }
    }

    // ── Shrine (purple dot, only if visited and not used) ──
    if (this.floorShrine && !this.shrineUsed && this.shrineTileX >= 0) {
      if (this.visited[this.shrineTileY]?.[this.shrineTileX]) {
        const shrineColor = this.floorShrine.color;
        gfx.fillStyle(shrineColor, 1);
        const shrp = expanded ? 1 : 0;
        gfx.fillRect(
          mx + this.shrineTileX * t - shrp, my + this.shrineTileY * t - shrp,
          t + shrp * 2, t + shrp * 2
        );
      }
    }

    // ── Secret Room (gold dot, only after discovery) ──
    if (this.secretRoomDiscovered && this.secretEffectTile) {
      const srt = this.secretEffectTile;
      if (this.visited[srt.y]?.[srt.x]) {
        gfx.fillStyle(0xfbbf24, 1);
        const srp = expanded ? 1 : 0;
        gfx.fillRect(
          mx + srt.x * t - srp, my + srt.y * t - srp,
          t + srp * 2, t + srp * 2
        );
      }
    }

    // ── Stairs (blue dot, only if visited) ──
    const { stairsPos } = this.dungeon;
    if (this.visited[stairsPos.y]?.[stairsPos.x]) {
      gfx.fillStyle(0x60a5fa, 1);
      const sp = expanded ? 1 : 0;
      gfx.fillRect(
        mx + stairsPos.x * t - sp, my + stairsPos.y * t - sp,
        t + sp * 2, t + sp * 2
      );
    }

    // ── Floor items (yellow dots, only in visited tiles) ──
    gfx.fillStyle(0xfde047, 1);
    for (const fi of this.floorItems) {
      if (this.visited[fi.y]?.[fi.x]) {
        gfx.fillRect(mx + fi.x * t, my + fi.y * t, t, t);
      }
    }

    // ── Revealed traps ──
    for (const tr of this.floorTraps) {
      if (tr.revealed) {
        gfx.fillStyle(tr.trap.hexColor, 1);
        gfx.fillRect(mx + tr.x * t, my + tr.y * t, t, t);
      }
    }

    // ── Hazard tiles (visible in explored areas) ──
    for (const hz of this.floorHazards) {
      if (this.visited[hz.y]?.[hz.x]) {
        gfx.fillStyle(hz.def.color, 0.8);
        gfx.fillRect(mx + hz.x * t, my + hz.y * t, t, t);
      }
    }

    // ── Enemies (red dots, only currently visible) ──
    for (const e of this.enemies) {
      if (e.alive && this.currentlyVisible[e.tileY]?.[e.tileX]) {
        if (e.isBoss) {
          gfx.fillStyle(0xff2222, 1);
          gfx.fillRect(mx + e.tileX * t - 1, my + e.tileY * t - 1, t + 2, t + 2);
        } else {
          gfx.fillStyle(0xef4444, 1);
          gfx.fillRect(mx + e.tileX * t, my + e.tileY * t, t, t);
        }
      }
    }

    // ── Allies (green dots) ──
    gfx.fillStyle(0x4ade80, 1);
    for (const a of this.allies) {
      if (a.alive) {
        gfx.fillRect(mx + a.tileX * t, my + a.tileY * t, t, t);
      }
    }

    // ── Player (green dot, slightly larger) ──
    gfx.fillStyle(0x4ade80, 1);
    gfx.fillRect(
      mx + this.player.tileX * t - 1,
      my + this.player.tileY * t - 1,
      t + 2, t + 2
    );
  }

  /** Calculate exploration percentage */
  private getExplorationPercent(): number {
    const { width, height, terrain } = this.dungeon;
    let totalWalkable = 0;
    let explored = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (terrain[y][x] === TerrainType.GROUND) {
          totalWalkable++;
          if (this.visited[y][x]) explored++;
        }
      }
    }
    return totalWalkable > 0 ? Math.floor((explored / totalWalkable) * 100) : 0;
  }

  private updateMinimap() {
    if (!this.minimapVisible) return;
    const { width, height } = this.dungeon;
    const { t, mx, my, totalW, totalH } = this.getMinimapParams();
    const expanded = this.minimapExpanded;
    const pad = 4;

    // Reveal area around player each update (DarkFloor mutation reduces radius, talent increases)
    // FoggyFloor event: override sight to 2
    const revealTalentBonus = this.talentEffects.sightRangeBonus ?? 0;
    const blessingSightReduction = getBlessingEffect(this.activeBlessings, "sightReduction");
    const baseSight = this.floorEvent?.type === FloorEventType.FoggyFloor
      ? 2
      : (hasMutation(this.floorMutations, MutationType.DarkFloor)
        ? getMutationEffect(MutationType.DarkFloor, "sightRadius")
        : 4);
    const revealRadius = Math.max(1, (baseSight + revealTalentBonus) - blessingSightReduction);
    this.revealArea(this.player.tileX, this.player.tileY, revealRadius);

    // ── Background (themed) ──
    this.minimapBg.clear();
    this.minimapBg.fillStyle(0x000000, expanded ? 0.92 : 0.85);
    this.minimapBg.fillRoundedRect(mx - pad, my - pad, totalW + pad * 2, totalH + pad * 2, 4);

    // ── Border ──
    this.minimapBorder.clear();
    this.minimapBorder.lineStyle(1, expanded ? 0x5566aa : 0x334466, expanded ? 0.9 : 0.6);
    this.minimapBorder.strokeRoundedRect(mx - pad, my - pad, totalW + pad * 2, totalH + pad * 2, 4);

    // ── Draw minimap content ──
    this.minimapGfx.clear();
    this.drawMinimapContent(this.minimapGfx, t, mx, my, expanded);

    // ── Legend + Exploration % ──
    this.updateMinimapLegend(expanded, mx, my, totalW, totalH, pad);

    // ── Exploration percentage text ──
    this.updateExplorationText(mx, my, totalW, totalH, pad);

    // ── Update full map overlay if open ──
    if (this.fullMapOpen) {
      this.drawFullMapOverlay();
    }
  }

  /** Update exploration percentage text below minimap */
  private updateExplorationText(
    mx: number, my: number,
    totalW: number, totalH: number, pad: number
  ) {
    const pct = this.getExplorationPercent();
    const expanded = this.minimapExpanded;

    // Position below minimap (or below legend if expanded)
    let textY = my + totalH + pad + 2;
    if (expanded) {
      // Legend takes extra space in expanded mode
      textY += 30;
    }

    if (!this.explorationText || !this.explorationText.scene) {
      this.explorationText = this.add.text(0, 0, "", {
        fontSize: "7px", fontFamily: "monospace", color: "#aab0c8",
      }).setScrollFactor(0).setDepth(102);
    }

    if (pct >= 100) {
      this.explorationText.setText("\u2605 FULLY EXPLORED");
      this.explorationText.setColor("#4ade80");
    } else if (pct >= 75) {
      this.explorationText.setText(`\u25C9 Explored: ${pct}%`);
      this.explorationText.setColor("#fbbf24");
    } else if (pct >= 50) {
      this.explorationText.setText(`\u25CE Explored: ${pct}%`);
      this.explorationText.setColor("#60a5fa");
    } else {
      this.explorationText.setText(`Explored: ${pct}%`);
      this.explorationText.setColor("#aab0c8");
    }

    this.explorationText.setPosition(mx + totalW / 2, textY);
    this.explorationText.setOrigin(0.5, 0);
    this.explorationText.setVisible(!expanded); // only show in compact mode; expanded has its own
  }

  /** Check exploration percentage and grant tier rewards when thresholds are crossed */
  private checkExplorationRewards() {
    const pct = this.getExplorationPercent() / 100; // 0.0–1.0
    const newTiers = getNewTiers(this.lastExplorationPercent, pct);
    this.lastExplorationPercent = pct;

    for (const tier of newTiers) {
      // Guard against duplicate grants on the same floor
      const key = Math.round(tier.threshold * 100);
      if (this.explorationRewardsGranted.has(key)) continue;
      this.explorationRewardsGranted.add(key);

      // Grant gold
      this.gold += tier.goldBonus;

      // Grant EXP and process level-ups
      this.totalExp += tier.expBonus;
      const levelResult = processLevelUp(this.player.stats, tier.expBonus, this.totalExp);
      this.totalExp = levelResult.totalExp;
      for (const r of levelResult.results) {
        this.showLog(`Level up! Lv.${r.newLevel} HP+${r.hpGain} ATK+${r.atkGain} DEF+${r.defGain}`);
        sfxLevelUp();
      }

      // Play sound
      sfxBuff();

      // Show brief announcement banner
      this.showExplorationRewardBanner(tier);

      // Log message
      this.showLog(`${tier.icon} ${tier.label} Bonus! +${tier.goldBonus}G +${tier.expBonus} EXP`);

      // Add to run log
      this.runLog.add(
        RunLogEvent.FloorAdvanced,
        `${tier.label} bonus (${Math.round(tier.threshold * 100)}% explored): +${tier.goldBonus}G +${tier.expBonus} EXP`,
        this.currentFloor,
        this.turnManager.turn,
      );
    }

    if (newTiers.length > 0) {
      this.updateHUD();
    }
  }

  /** Show a brief floating banner for an exploration reward */
  private showExplorationRewardBanner(tier: ExplorationTier) {
    const label = `${tier.icon} ${tier.label} Bonus!`;
    const detail = `+${tier.goldBonus}G  +${tier.expBonus} EXP`;

    // Background bar
    const bannerBg = this.add.rectangle(GAME_WIDTH / 2, 100, 220, 36, 0x000000, 0.75)
      .setScrollFactor(0).setDepth(250).setOrigin(0.5);
    bannerBg.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(tier.color).color, 0.9);

    const labelText = this.add.text(GAME_WIDTH / 2, 93, label, {
      fontSize: "10px", fontFamily: "monospace", fontStyle: "bold",
      color: tier.color, stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(251);

    const detailText = this.add.text(GAME_WIDTH / 2, 107, detail, {
      fontSize: "8px", fontFamily: "monospace",
      color: "#ffffff", stroke: "#000000", strokeThickness: 1,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(251);

    // Slide in from top and fade out
    bannerBg.setAlpha(0).setY(80);
    labelText.setAlpha(0).setY(73);
    detailText.setAlpha(0).setY(87);

    this.tweens.add({
      targets: [bannerBg, labelText, detailText],
      y: "+=20",
      alpha: 1,
      duration: 300,
      ease: "Back.easeOut",
      onComplete: () => {
        this.time.delayedCall(1800, () => {
          this.tweens.add({
            targets: [bannerBg, labelText, detailText],
            alpha: 0,
            y: "-=10",
            duration: 400,
            ease: "Sine.easeIn",
            onComplete: () => {
              bannerBg.destroy();
              labelText.destroy();
              detailText.destroy();
            },
          });
        });
      },
    });
  }

  private updateMinimapLegend(
    show: boolean, mx: number, my: number,
    totalW: number, totalH: number, pad: number
  ) {
    // Clean up old legend texts
    for (const lt of this.minimapLegendTexts) lt.destroy();
    this.minimapLegendTexts = [];

    if (show) {
      // ── Expanded mode: full legend below the map ──
      const legendY = my + totalH + pad + 4;
      const legendStyle: Phaser.Types.GameObjects.Text.TextStyle = {
        fontSize: "8px", fontFamily: "monospace", color: "#aab0c8",
      };
      const entries: { color: string; label: string }[] = [
        { color: "#4ade80", label: "You" },
        { color: "#4ade80", label: "Ally" },
        { color: "#ef4444", label: "Foe" },
        { color: "#fde047", label: "Item" },
        { color: "#60a5fa", label: "Stairs" },
        { color: "#a855f7", label: "Trap" },
      ];

      const entryWidth = 42;
      const cols = 3;
      const rows = Math.ceil(entries.length / cols);
      const gridW = cols * entryWidth;
      const startX = mx + Math.floor((totalW - gridW) / 2);

      for (let i = 0; i < entries.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const ex = startX + col * entryWidth;
        const ey = legendY + row * 12;
        const { color, label } = entries[i];
        const txt = this.add.text(ex, ey, `\u25CF ${label}`, {
          ...legendStyle, color,
        }).setScrollFactor(0).setDepth(102);
        this.minimapLegendTexts.push(txt);
      }

      // Exploration % in expanded mode (colored by tier)
      const pct = this.getExplorationPercent();
      const pctColor = pct >= 100 ? "#4ade80" : pct >= 75 ? "#fbbf24" : pct >= 50 ? "#60a5fa" : "#aab0c8";
      const pctLabel = pct >= 100 ? "\u2605 FULLY EXPLORED" : pct >= 75 ? `\u25C9 Explored: ${pct}%` : pct >= 50 ? `\u25CE Explored: ${pct}%` : `Explored: ${pct}%`;
      const pctTxt = this.add.text(
        mx + totalW / 2, legendY + rows * 12 + 2,
        pctLabel,
        { fontSize: "8px", fontFamily: "monospace", color: pctColor, fontStyle: pct >= 100 ? "bold" : "normal" }
      ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(102);
      this.minimapLegendTexts.push(pctTxt);

      // "Tap to close" hint
      const hintTxt = this.add.text(
        mx + totalW / 2, legendY + rows * 12 + 14,
        "tap map to close",
        { fontSize: "7px", fontFamily: "monospace", color: "#555570" }
      ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(102);
      this.minimapLegendTexts.push(hintTxt);
    } else {
      // ── Compact mode: small colored dots in minimap corner as legend ──
      const dotEntries: { color: number; }[] = [
        { color: 0x4ade80 },  // Player/Ally (green)
        { color: 0xef4444 },  // Enemy (red)
        { color: 0xfde047 },  // Item (yellow)
        { color: 0x60a5fa },  // Stairs (blue)
      ];
      const dotSize = 3;
      const dotGap = 5;
      const dotStartX = mx + totalW - (dotEntries.length * dotGap) + 1;
      const dotY = my + totalH + pad + 1;

      // Use a small text as container for legend dots
      for (let i = 0; i < dotEntries.length; i++) {
        const dx = dotStartX + i * dotGap;
        const colorHex = "#" + dotEntries[i].color.toString(16).padStart(6, "0");
        const dot = this.add.text(dx, dotY, "\u25CF", {
          fontSize: "5px", fontFamily: "monospace", color: colorHex,
        }).setScrollFactor(0).setDepth(102);
        this.minimapLegendTexts.push(dot);
      }
    }
  }

  /** Open the full-screen map overlay */
  private openFullMap() {
    if (this.fullMapOpen) return;
    this.fullMapOpen = true;
    if (this.domHud) setDomHudInteractive(this.domHud, false);

    // Turns are paused via fullMapOpen guard checks on all input handlers

    const overlayDepth = 500;

    // Semi-transparent dark background
    this.fullMapOverlayBg = this.add.graphics().setScrollFactor(0).setDepth(overlayDepth);
    this.fullMapOverlayBg.fillStyle(0x000000, 0.85);
    this.fullMapOverlayBg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Full map graphics
    this.fullMapGfx = this.add.graphics().setScrollFactor(0).setDepth(overlayDepth + 1);

    // Draw the full map
    this.drawFullMapOverlay();

    // Title
    const titleTxt = this.add.text(
      GAME_WIDTH / 2, 12, `${this.dungeonDef.name} B${this.currentFloor}F`,
      { fontSize: "10px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold" }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(overlayDepth + 2);
    this.fullMapUI.push(titleTxt);

    // Legend at the bottom
    const legendY = GAME_HEIGHT - 40;
    const legendEntries: { color: string; label: string }[] = [
      { color: "#4ade80", label: "Player" },
      { color: "#ef4444", label: "Enemy" },
      { color: "#fde047", label: "Item" },
      { color: "#60a5fa", label: "Stairs" },
    ];
    const legendStartX = GAME_WIDTH / 2 - (legendEntries.length * 45) / 2;
    for (let i = 0; i < legendEntries.length; i++) {
      const { color, label } = legendEntries[i];
      const lt = this.add.text(
        legendStartX + i * 45, legendY,
        `\u25CF ${label}`,
        { fontSize: "8px", fontFamily: "monospace", color }
      ).setScrollFactor(0).setDepth(overlayDepth + 2);
      this.fullMapUI.push(lt);
    }

    // Exploration % (colored by tier)
    const pct = this.getExplorationPercent();
    const pctColor = pct >= 100 ? "#4ade80" : pct >= 75 ? "#fbbf24" : pct >= 50 ? "#60a5fa" : "#aab0c8";
    const pctLabel = pct >= 100 ? "\u2605 FULLY EXPLORED" : pct >= 75 ? `\u25C9 Explored: ${pct}%` : pct >= 50 ? `\u25CE Explored: ${pct}%` : `Explored: ${pct}%`;
    const pctTxt = this.add.text(
      GAME_WIDTH / 2, legendY + 14, pctLabel,
      { fontSize: "8px", fontFamily: "monospace", color: pctColor, fontStyle: pct >= 100 ? "bold" : "normal" }
    ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(overlayDepth + 2);
    this.fullMapUI.push(pctTxt);

    // "Tap to close" hint
    const hintTxt = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT - 10,
      "tap anywhere to close",
      { fontSize: "7px", fontFamily: "monospace", color: "#555570" }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(overlayDepth + 2);
    this.fullMapUI.push(hintTxt);

    // Close zone (covers full screen)
    this.fullMapCloseZone = this.add.zone(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT
    ).setScrollFactor(0).setDepth(overlayDepth + 3).setInteractive();
    this.fullMapCloseZone.on("pointerdown", () => {
      this.closeFullMap();
    });
  }

  /** Draw the full map overlay content */
  private drawFullMapOverlay() {
    if (!this.fullMapGfx) return;
    this.fullMapGfx.clear();

    const { width, height } = this.dungeon;
    const t = this.MINIMAP_TILE_FULLMAP; // 4px per tile
    const totalW = width * t;
    const totalH = height * t;
    const mx = Math.floor((GAME_WIDTH - totalW) / 2);
    const my = Math.floor((GAME_HEIGHT - totalH) / 2);

    // Dark background for the map area
    this.fullMapGfx.fillStyle(0x111122, 0.9);
    this.fullMapGfx.fillRoundedRect(mx - 4, my - 4, totalW + 8, totalH + 8, 4);
    this.fullMapGfx.lineStyle(1, 0x5566aa, 0.8);
    this.fullMapGfx.strokeRoundedRect(mx - 4, my - 4, totalW + 8, totalH + 8, 4);

    // Draw content using shared method
    this.drawMinimapContent(this.fullMapGfx, t, mx, my, true);
  }

  /** Close the full-screen map overlay */
  private closeFullMap() {
    if (!this.fullMapOpen) return;
    this.fullMapOpen = false;
    if (this.domHud) setDomHudInteractive(this.domHud, true);

    // Turns resume automatically since fullMapOpen guard is cleared

    // Destroy overlay elements
    if (this.fullMapOverlayBg) {
      this.fullMapOverlayBg.destroy();
      this.fullMapOverlayBg = null;
    }
    if (this.fullMapGfx) {
      this.fullMapGfx.destroy();
      this.fullMapGfx = null;
    }
    if (this.fullMapCloseZone) {
      this.fullMapCloseZone.destroy();
      this.fullMapCloseZone = null;
    }
    for (const obj of this.fullMapUI) {
      if (obj && (obj as any).destroy) (obj as any).destroy();
    }
    this.fullMapUI = [];
  }

  private updateHUD() {
    const p = this.player.stats;
    const hpRatio = p.hp / p.maxHp;

    // Update HP bar graphics
    this.hpBarFill.clear();
    const barColor = hpRatio > 0.5 ? 0x4ade80 : hpRatio > 0.25 ? 0xfbbf24 : 0xef4444;
    const barWidth = Math.max(0, Math.floor(98 * hpRatio));
    this.hpBarFill.fillStyle(barColor, 1);
    this.hpBarFill.fillRoundedRect(39, 9, barWidth, 8, 2);

    // Update Belly bar graphics
    const bellyRatio = this.maxBelly > 0 ? this.belly / this.maxBelly : 0;
    this.bellyBarFill.clear();
    const bellyBarColor = bellyRatio > 0.5 ? 0x4ade80 : bellyRatio > 0.2 ? 0xfbbf24 : 0xef4444;
    const bellyBarWidth = Math.max(0, Math.floor(98 * bellyRatio));
    this.bellyBarFill.fillStyle(bellyBarColor, 1);
    this.bellyBarFill.fillRoundedRect(39, 20, bellyBarWidth, 4, 1);
    this.bellyText.setText(`${Math.floor(this.belly)}/${this.maxBelly}`);

    const ngStr = this.ngPlusLevel > 0 ? ` NG+${this.ngPlusLevel}` : "";
    this.floorText.setText(`${this.dungeonDef.name}  B${this.currentFloor}F${ngStr}`);
    this.floorText.setPosition(40, 27);
    this.hpText.setText(`${p.hp}/${p.maxHp}`);

    // Show active buffs (compact version in turn text)
    const abilityName = this.player.ability ? ABILITIES[this.player.ability]?.name ?? "" : "";
    const abilityStr = abilityName ? ` [${abilityName}]` : "";
    const goldStr = this.gold > 0 ? ` ${this.gold}G` : "";
    this.turnText.setText(`Lv.${p.level}${goldStr} T${this.turnManager.turn}${abilityStr}`);

    // Status icons HUD (next to HP bar)
    this.updateStatusHud();

    // Status effect visual tint on player sprite
    this.updateStatusTint(this.player);

    // Boss HP bar update
    if (this.bossEntity && this.bossHpBar) {
      this.bossHpBar.clear();
      if (this.bossEntity.alive) {
        const bossRatio = this.bossEntity.stats.hp / this.bossEntity.stats.maxHp;
        const barW = 200;
        const barX = (GAME_WIDTH - barW) / 2;
        const barY = 56;
        const bossBarColor = bossRatio > 0.5 ? 0xff4444 : bossRatio > 0.25 ? 0xff8844 : 0xffcc00;
        const bossBarWidth = Math.max(0, Math.floor(barW * bossRatio));
        this.bossHpBar.fillStyle(bossBarColor, 1);
        this.bossHpBar.fillRoundedRect(barX, barY, bossBarWidth, 12, 3);

        // HP text on bar
        if (this.bossNameText) {
          this.bossNameText.setText(`★ ${this.bossEntity.name} — ${this.bossEntity.stats.hp}/${this.bossEntity.stats.maxHp} ★`);
        }
      } else {
        // Boss defeated — hide bar
        if (this.bossHpBg) this.bossHpBg.setVisible(false);
        this.bossHpBar.setVisible(false);
        if (this.bossNameText) this.bossNameText.setVisible(false);
      }
    }

    // Legendary HP bar update (golden bar)
    if (this.legendaryEntity && this.legendaryHpBar) {
      this.legendaryHpBar.clear();
      if (this.legendaryEntity.alive) {
        const legRatio = this.legendaryEntity.stats.hp / this.legendaryEntity.stats.maxHp;
        const barW = 200;
        const barX = (GAME_WIDTH - barW) / 2;
        const barY = 56;
        // Golden HP bar color scheme
        const legBarColor = legRatio > 0.5 ? 0xffd700 : legRatio > 0.25 ? 0xffaa00 : 0xff6600;
        const legBarWidth = Math.max(0, Math.floor(barW * legRatio));
        this.legendaryHpBar.fillStyle(legBarColor, 1);
        this.legendaryHpBar.fillRoundedRect(barX, barY, legBarWidth, 12, 3);

        if (this.legendaryNameText) {
          this.legendaryNameText.setText(`★ ${this.legendaryEntity.name} — ${this.legendaryEntity.stats.hp}/${this.legendaryEntity.stats.maxHp} ★`);
        }
      } else {
        // Legendary defeated — hide bar
        if (this.legendaryHpBg) this.legendaryHpBg.setVisible(false);
        this.legendaryHpBar.setVisible(false);
        if (this.legendaryNameText) this.legendaryNameText.setVisible(false);
        // Stop particle effects
        if (this.legendaryParticleTimer) { this.legendaryParticleTimer.destroy(); this.legendaryParticleTimer = null; }
        if (this.legendaryParticleGraphics) { this.legendaryParticleGraphics.destroy(); this.legendaryParticleGraphics = null; }
      }
    }

    // Mini-Boss HP bar update (orange bar)
    if (this.miniBossEntity && this.miniBossHpBar) {
      this.miniBossHpBar.clear();
      if (this.miniBossEntity.alive) {
        const mbRatio = this.miniBossEntity.stats.hp / this.miniBossEntity.stats.maxHp;
        const barW = 160;
        const barX = (GAME_WIDTH - barW) / 2;
        const barY = 56;
        const mbBarColor = mbRatio > 0.5 ? 0xff8800 : mbRatio > 0.25 ? 0xff6600 : 0xff4400;
        const mbBarWidth = Math.max(0, Math.floor(barW * mbRatio));
        this.miniBossHpBar.fillStyle(mbBarColor, 1);
        this.miniBossHpBar.fillRoundedRect(barX, barY, mbBarWidth, 10, 3);

        if (this.miniBossNameText) {
          this.miniBossNameText.setText(`◆ ${this.miniBossEntity.name} — ${this.miniBossEntity.stats.hp}/${this.miniBossEntity.stats.maxHp} ◆`);
        }
      } else {
        // Mini-boss defeated — hide bar
        if (this.miniBossHpBg) this.miniBossHpBg.setVisible(false);
        this.miniBossHpBar.setVisible(false);
        if (this.miniBossNameText) this.miniBossNameText.setVisible(false);
      }
    }

    // ── Challenge Mode HUD updates ──
    if (this.challengeMode === "speedrun" && this.challengeBadgeText) {
      const remaining = this.challengeTurnLimit - this.turnManager.turn;
      const urgentColor = remaining <= 20 ? "#ef4444" : "#fbbf24";
      this.challengeBadgeText.setText(`[SPEED RUN] ${remaining} turns left`);
      this.challengeBadgeText.setColor(urgentColor);

      // Check turn limit exceeded
      if (remaining <= 0 && !this.gameOver) {
        this.showLog("Time's up! You ran out of turns!");
        this.showGameOver();
      }
    }

    this.updateSkillButtons();
    this.updateMinimap();

    // Sync DOM HUD overlay
    this.syncDomHud();
  }

  private openHamburgerMenu() {
    if (this.menuOpen) {
      this.closeMenu();
      return;
    }
    if (this.bagOpen || this.settingsOpen || this.shopOpen || this.teamPanelOpen || this.eventOpen || this.fullMapOpen || this.relicOverlayOpen || this.shrineOpen) return;

    sfxMenuOpen();
    this.menuOpen = true;
    if (this.domHud) setDomHudInteractive(this.domHud, false);

    // Semi-transparent backdrop
    const backdrop = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5
    ).setScrollFactor(0).setDepth(150).setInteractive();
    backdrop.on("pointerdown", () => this.closeMenu());
    this.menuUI.push(backdrop);

    const items: { label: string; icon: string; action: () => void }[] = [
      { label: "Bag", icon: "🎒", action: () => { this.closeMenu(); this.openBag(); } },
      { label: "Save", icon: "💾", action: () => { this.closeMenu(); this.saveGame(); } },
      { label: "Give Up", icon: "🚪", action: () => { this.closeMenu(); this.confirmGiveUp(); } },
      { label: "Settings", icon: "⚙", action: () => { this.closeMenu(); this.openSettings(); } },
    ];
    // Add Shop option when player is in shop room
    if (this.playerInShopRoom && !this.shopClosed && this.shopItems.some(si => si.price > 0)) {
      items.splice(1, 0, { label: "Shop", icon: "💰", action: () => { this.closeMenu(); this.openShopUI(); } });
    }

    // Menu panel (size adjusts to number of items)
    const panelX = GAME_WIDTH - 130;
    const panelY = 90;
    const panelW = 120;
    const panelH = 28 + items.length * 36;
    const panel = this.add.graphics().setScrollFactor(0).setDepth(151);
    panel.fillStyle(0x1a1a2e, 0.95);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    panel.lineStyle(1, 0x334155);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);
    this.menuUI.push(panel);

    items.forEach((item, i) => {
      const y = panelY + 14 + i * 36;
      const btn = this.add.text(panelX + panelW / 2, y, `${item.icon} ${item.label}`, {
        fontSize: "13px", color: "#e0e0e0", fontFamily: "monospace",
        backgroundColor: "#2a2a4e", padding: { x: 10, y: 6 },
        fixedWidth: panelW - 12, align: "center",
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(152).setInteractive();

      btn.on("pointerover", () => btn.setColor("#fbbf24"));
      btn.on("pointerout", () => btn.setColor("#e0e0e0"));
      btn.on("pointerdown", () => item.action());
      this.menuUI.push(btn);
    });
  }

  private closeMenu() {
    sfxMenuClose();
    this.menuOpen = false;
    if (this.domHud) setDomHudInteractive(this.domHud, true);
    this.menuUI.forEach(obj => obj.destroy());
    this.menuUI = [];
  }

  // ── Team (Ally Command) Panel ──

  private teamPanelScroll = 0; // scroll offset for team panel

  private openTeamPanel() {
    if (this.teamPanelOpen) {
      this.closeTeamPanel();
      return;
    }
    if (this.bagOpen || this.menuOpen || this.settingsOpen || this.shopOpen || this.eventOpen || this.gameOver || this.fullMapOpen || this.relicOverlayOpen || this.shrineOpen) return;

    const liveAllies = this.allies.filter(a => a.alive);
    if (liveAllies.length === 0) {
      this.showLog("No allies in your team.");
      return;
    }

    sfxMenuOpen();
    this.teamPanelOpen = true;
    if (this.domHud) setDomHudInteractive(this.domHud, false);
    this.teamPanelScroll = 0;
    this.buildTeamPanelUI();
  }

  private closeTeamPanel() {
    sfxMenuClose();
    this.teamPanelOpen = false;
    if (this.domHud) setDomHudInteractive(this.domHud, true);
    this.teamPanelUI.forEach(obj => obj.destroy());
    this.teamPanelUI = [];
  }

  /** Swap two allies in formation order */
  private swapAllyOrder(idxA: number, idxB: number) {
    if (idxA < 0 || idxB < 0 || idxA >= this.allies.length || idxB >= this.allies.length) return;
    [this.allies[idxA], this.allies[idxB]] = [this.allies[idxB], this.allies[idxA]];
    this.buildTeamPanelUI();
  }

  /** Dismiss an ally from the party */
  private dismissAlly(ally: Entity) {
    // Remove from allies array
    this.allies = this.allies.filter(a => a !== ally);
    // Remove from allEntities
    this.allEntities = this.allEntities.filter(a => a !== ally);
    // Destroy sprite
    if (ally.sprite) {
      ally.sprite.destroy();
      ally.sprite = undefined;
    }
    ally.alive = false;
    this.showLog(`${ally.name} was dismissed from the team.`);

    // If no more allies, close panel
    if (this.allies.filter(a => a.alive).length === 0) {
      this.closeTeamPanel();
    } else {
      this.buildTeamPanelUI();
    }
    this.updateHUD();
  }

  /** Rebuild the team panel UI (called on open and after tactic/order change) */
  private buildTeamPanelUI() {
    // Destroy existing UI first
    this.teamPanelUI.forEach(obj => obj.destroy());
    this.teamPanelUI = [];

    const liveAllies = this.allies.filter(a => a.alive);

    // Semi-transparent backdrop
    const backdrop = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6
    ).setScrollFactor(0).setDepth(150).setInteractive();
    backdrop.on("pointerdown", () => this.closeTeamPanel());
    this.teamPanelUI.push(backdrop);

    // Panel dimensions — each ally row is taller to fit more info
    const panelW = GAME_WIDTH - 16;
    const rowH = 118;
    const headerH = 36;
    const footerH = 36;
    const contentH = liveAllies.length * rowH;
    const panelH = headerH + contentH + footerH;
    const panelX = 8;
    const panelY = Math.max(8, Math.floor((GAME_HEIGHT - panelH) / 2));

    // Panel background
    const panelGfx = this.add.graphics().setScrollFactor(0).setDepth(151);
    panelGfx.fillStyle(0x1a1a2e, 0.97);
    panelGfx.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    panelGfx.lineStyle(2, 0x60a5fa, 0.8);
    panelGfx.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);
    this.teamPanelUI.push(panelGfx);

    // Title
    const title = this.add.text(GAME_WIDTH / 2, panelY + 14, "Party Formation", {
      fontSize: "13px", color: "#60a5fa", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(152);
    this.teamPanelUI.push(title);

    // Tactic definitions for buttons
    const tacticDefs: { tactic: AllyTactic; label: string }[] = [
      { tactic: AllyTactic.FollowMe, label: "Follow" },
      { tactic: AllyTactic.GoAfterFoes, label: "Attack" },
      { tactic: AllyTactic.StayHere, label: "Stay" },
      { tactic: AllyTactic.Scatter, label: "Scatter" },
    ];

    // Ally rows
    liveAllies.forEach((ally, idx) => {
      const rowY = panelY + headerH + idx * rowH;
      const currentTactic = ally.allyTactic ?? AllyTactic.FollowMe;
      const allyIdx = this.allies.indexOf(ally);
      const followDist = getFollowDist(allyIdx >= 0 ? allyIdx : idx);

      // Row separator line
      if (idx > 0) {
        const sepGfx = this.add.graphics().setScrollFactor(0).setDepth(152);
        sepGfx.lineStyle(1, 0x60a5fa, 0.25);
        sepGfx.lineBetween(panelX + 8, rowY, panelX + panelW - 8, rowY);
        this.teamPanelUI.push(sepGfx);
      }

      // ── Row 1: Position number + Name + Level + Move buttons ──
      const posNum = `#${idx + 1}`;
      const posText = this.add.text(panelX + 8, rowY + 4, posNum, {
        fontSize: "11px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
      }).setScrollFactor(0).setDepth(152);
      this.teamPanelUI.push(posText);

      const nameStr = `${ally.name}  Lv.${ally.stats.level}`;
      const nameText = this.add.text(panelX + 30, rowY + 4, nameStr, {
        fontSize: "10px", color: "#e0e0e0", fontFamily: "monospace", fontStyle: "bold",
      }).setScrollFactor(0).setDepth(152);
      this.teamPanelUI.push(nameText);

      // Move Up / Move Down buttons (right side)
      const orderBtnW = 22;
      const orderBtnH = 14;
      const orderBtnX = panelX + panelW - 58;

      if (idx > 0) {
        const upBtn = this.add.text(orderBtnX, rowY + 2, "Up", {
          fontSize: "8px", color: "#60a5fa", fontFamily: "monospace",
          backgroundColor: "#2a2a4e", padding: { x: 3, y: 2 },
        }).setScrollFactor(0).setDepth(153).setInteractive();
        upBtn.on("pointerdown", (p: Phaser.Input.Pointer) => {
          p.event?.stopPropagation();
          this.swapAllyOrder(allyIdx, allyIdx - 1);
        });
        upBtn.on("pointerover", () => upBtn.setColor("#fbbf24"));
        upBtn.on("pointerout", () => upBtn.setColor("#60a5fa"));
        this.teamPanelUI.push(upBtn);
      }

      if (idx < liveAllies.length - 1) {
        const dnBtn = this.add.text(orderBtnX + orderBtnW + 4, rowY + 2, "Dn", {
          fontSize: "8px", color: "#60a5fa", fontFamily: "monospace",
          backgroundColor: "#2a2a4e", padding: { x: 3, y: 2 },
        }).setScrollFactor(0).setDepth(153).setInteractive();
        dnBtn.on("pointerdown", (p: Phaser.Input.Pointer) => {
          p.event?.stopPropagation();
          this.swapAllyOrder(allyIdx, allyIdx + 1);
        });
        dnBtn.on("pointerover", () => dnBtn.setColor("#fbbf24"));
        dnBtn.on("pointerout", () => dnBtn.setColor("#60a5fa"));
        this.teamPanelUI.push(dnBtn);
      }

      // ── Row 2: HP bar + Types + Follow distance ──
      const row2Y = rowY + 20;
      const hpRatio = ally.stats.hp / ally.stats.maxHp;
      const hpBarW = 80;
      const hpBarX = panelX + 10;

      const hpBg = this.add.graphics().setScrollFactor(0).setDepth(152);
      hpBg.fillStyle(0x333355, 1);
      hpBg.fillRoundedRect(hpBarX, row2Y, hpBarW, 7, 2);
      this.teamPanelUI.push(hpBg);

      const hpFill = this.add.graphics().setScrollFactor(0).setDepth(153);
      const hpColor = hpRatio > 0.5 ? 0x4ade80 : hpRatio > 0.25 ? 0xfbbf24 : 0xef4444;
      const fillW = Math.max(0, Math.floor(hpBarW * hpRatio));
      hpFill.fillStyle(hpColor, 1);
      hpFill.fillRoundedRect(hpBarX, row2Y, fillW, 7, 2);
      this.teamPanelUI.push(hpFill);

      const hpText = this.add.text(hpBarX + hpBarW + 4, row2Y - 1, `${ally.stats.hp}/${ally.stats.maxHp}`, {
        fontSize: "8px", color: "#aab0c8", fontFamily: "monospace",
      }).setScrollFactor(0).setDepth(152);
      this.teamPanelUI.push(hpText);

      // Types
      const typeStr = ally.types.join("/");
      const typeText = this.add.text(hpBarX + hpBarW + 60, row2Y - 1, typeStr, {
        fontSize: "8px", color: "#a78bfa", fontFamily: "monospace",
      }).setScrollFactor(0).setDepth(152);
      this.teamPanelUI.push(typeText);

      // Follow distance indicator
      const distText = this.add.text(panelX + panelW - 10, row2Y - 1, `${followDist}tile`, {
        fontSize: "7px", color: "#6b7280", fontFamily: "monospace",
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(152);
      this.teamPanelUI.push(distText);

      // ── Row 3: Skills list ──
      const row3Y = row2Y + 14;
      const skillNames = ally.skills.length > 0
        ? ally.skills.map(s => s.name).join(", ")
        : "(no skills)";
      const skillText = this.add.text(panelX + 10, row3Y, skillNames, {
        fontSize: "8px", color: "#8899bb", fontFamily: "monospace",
        wordWrap: { width: panelW - 24 },
      }).setScrollFactor(0).setDepth(152);
      this.teamPanelUI.push(skillText);

      // ── Row 4: Tactic buttons ──
      const row4Y = row3Y + 16;
      const btnW = 62;
      const totalBtnW = tacticDefs.length * btnW + (tacticDefs.length - 1) * 3;
      const btnStartX = panelX + (panelW - totalBtnW) / 2;

      tacticDefs.forEach((td, ti) => {
        const bx = btnStartX + ti * (btnW + 3);
        const isActive = currentTactic === td.tactic;
        const bgColor = isActive ? "#2a4a3e" : "#2a2a4e";
        const textColor = isActive ? "#4ade80" : "#8899bb";

        const btn = this.add.text(bx + btnW / 2, row4Y, td.label, {
          fontSize: "8px", color: textColor, fontFamily: "monospace",
          fontStyle: isActive ? "bold" : "normal",
          backgroundColor: bgColor,
          padding: { x: 3, y: 3 },
          fixedWidth: btnW - 4, align: "center",
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(153).setInteractive();

        btn.on("pointerdown", (p: Phaser.Input.Pointer) => {
          p.event?.stopPropagation();
          ally.allyTactic = td.tactic;
          this.buildTeamPanelUI();
        });
        btn.on("pointerover", () => { if (!isActive) btn.setColor("#fbbf24"); });
        btn.on("pointerout", () => { if (!isActive) btn.setColor(textColor); });
        this.teamPanelUI.push(btn);

        if (isActive) {
          const borderGfx = this.add.graphics().setScrollFactor(0).setDepth(152);
          borderGfx.lineStyle(1, 0x4ade80, 0.8);
          borderGfx.strokeRoundedRect(bx + 1, row4Y - 1, btnW - 2, 20, 3);
          this.teamPanelUI.push(borderGfx);
        }
      });

      // ── Row 5: Dismiss button ──
      const row5Y = row4Y + 24;
      const dismissBtn = this.add.text(panelX + panelW - 12, row5Y, "Dismiss", {
        fontSize: "8px", color: "#ef4444", fontFamily: "monospace",
        backgroundColor: "#3a1a2e", padding: { x: 4, y: 2 },
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(153).setInteractive();
      dismissBtn.on("pointerdown", (p: Phaser.Input.Pointer) => {
        p.event?.stopPropagation();
        this.dismissAlly(ally);
      });
      dismissBtn.on("pointerover", () => dismissBtn.setColor("#fbbf24"));
      dismissBtn.on("pointerout", () => dismissBtn.setColor("#ef4444"));
      this.teamPanelUI.push(dismissBtn);
    });

    // Close button
    const closeBtnY = panelY + panelH - 28;
    const closeBtn = this.add.text(GAME_WIDTH / 2, closeBtnY, "[ Close ]", {
      fontSize: "12px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
      backgroundColor: "#3a1a2e", padding: { x: 14, y: 5 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(153).setInteractive();
    closeBtn.on("pointerdown", () => this.closeTeamPanel());
    closeBtn.on("pointerover", () => closeBtn.setColor("#fbbf24"));
    closeBtn.on("pointerout", () => closeBtn.setColor("#ef4444"));
    this.teamPanelUI.push(closeBtn);
  }

  private confirmGiveUp() {
    if (this.gameOver) return;
    sfxMenuOpen();
    if (this.domHud) setDomHudInteractive(this.domHud, false);

    const uiElements: Phaser.GameObjects.GameObject[] = [];

    const backdrop = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7
    ).setScrollFactor(0).setDepth(160).setInteractive();
    uiElements.push(backdrop);

    const titleText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, "Give Up?", {
      fontSize: "18px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(161);
    uiElements.push(titleText);

    const warnText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, "All items & progress\nfrom this run will be lost!", {
      fontSize: "10px", color: "#fbbf24", fontFamily: "monospace", align: "center",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(161);
    uiElements.push(warnText);

    const yesBtn = this.add.text(GAME_WIDTH / 2 - 50, GAME_HEIGHT / 2 + 25, "[Yes]", {
      fontSize: "14px", color: "#ef4444", fontFamily: "monospace",
      backgroundColor: "#1a1a2ecc", padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(161).setInteractive();

    const noBtn = this.add.text(GAME_WIDTH / 2 + 50, GAME_HEIGHT / 2 + 25, "[No]", {
      fontSize: "14px", color: "#4ade80", fontFamily: "monospace",
      backgroundColor: "#1a1a2ecc", padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(161).setInteractive();

    uiElements.push(yesBtn, noBtn);

    const cleanup = () => { uiElements.forEach(o => o.destroy()); };

    noBtn.on("pointerdown", () => {
      sfxMenuClose();
      cleanup();
      if (this.domHud) setDomHudInteractive(this.domHud, true);
    });

    yesBtn.on("pointerdown", () => {
      cleanup();
      this.gameOver = true;
      stopBgm();
      clearDungeonSave();
      if (this.domHud) setDomHudInteractive(this.domHud, false);

      let transitioned = false;
      const doTransition = () => {
        if (transitioned) return;
        transitioned = true;
        if (this.domHudElement) {
          this.domHudElement.destroy();
          this.domHudElement = null as unknown as Phaser.GameObjects.DOMElement;
          this.domHud = null as unknown as DomHudElements;
        }
        this.scene.start("HubScene", {
          gold: 0,
          cleared: false,
          bestFloor: this.currentFloor,
          enemiesDefeated: this.enemiesDefeated,
          turns: this.turnManager.turn,
          dungeonId: this.dungeonDef.id,
          starter: this.starterId,
          challengeMode: this.challengeMode ?? undefined,
          pokemonSeen: Array.from(this.seenSpecies),
          inventory: serializeInventory(this.inventory),
          ...this.getQuestTrackingData(),
        });
      };

      this.cameras.main.fadeOut(500);
      this.cameras.main.once("camerafadeoutcomplete", doTransition);
      // Safety fallback using native setTimeout (Phaser timers may stall with the scene)
      setTimeout(doTransition, 1200);
    });
  }

  // ── Settings Panel ──

  private openSettings() {
    if (this.settingsOpen) return;
    sfxMenuOpen();
    this.settingsOpen = true;
    if (this.domHud) setDomHudInteractive(this.domHud, false);

    // Dark overlay
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85
    ).setScrollFactor(0).setDepth(150).setInteractive();
    this.settingsUI.push(overlay);

    const title = this.add.text(GAME_WIDTH / 2, 35, "⚙ Settings", {
      fontSize: "16px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(151);
    this.settingsUI.push(title);

    let yPos = 80;

    // ── BGM Volume ──
    const bgmLabel = this.add.text(GAME_WIDTH / 2, yPos, `♪ BGM Volume: ${Math.round(getBgmVolume() * 100)}%`, {
      fontSize: "12px", color: "#e0e0e0", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(151);
    this.settingsUI.push(bgmLabel);
    yPos += 28;

    // BGM slider bar
    const bgmBarX = 60;
    const bgmBarW = GAME_WIDTH - 120;
    const bgmBarY = yPos;
    const bgmBarBg = this.add.graphics().setScrollFactor(0).setDepth(151);
    bgmBarBg.fillStyle(0x334155, 1);
    bgmBarBg.fillRoundedRect(bgmBarX, bgmBarY, bgmBarW, 20, 4);
    this.settingsUI.push(bgmBarBg);

    const bgmFill = this.add.graphics().setScrollFactor(0).setDepth(152);
    const drawBgmFill = () => {
      bgmFill.clear();
      bgmFill.fillStyle(0x667eea, 1);
      bgmFill.fillRoundedRect(bgmBarX, bgmBarY, bgmBarW * getBgmVolume(), 20, 4);
    };
    drawBgmFill();
    this.settingsUI.push(bgmFill);

    const bgmHitArea = this.add.rectangle(bgmBarX + bgmBarW / 2, bgmBarY + 10, bgmBarW, 20, 0x000000, 0)
      .setScrollFactor(0).setDepth(153).setInteractive();
    bgmHitArea.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const ratio = Math.max(0, Math.min(1, (p.x - bgmBarX) / bgmBarW));
      setBgmVolume(ratio);
      bgmLabel.setText(`♪ BGM Volume: ${Math.round(ratio * 100)}%`);
      drawBgmFill();
    });
    this.settingsUI.push(bgmHitArea);
    yPos += 40;

    // ── SFX Volume ──
    const sfxLabel = this.add.text(GAME_WIDTH / 2, yPos, `🔊 SFX Volume: ${Math.round(getSfxVolume() * 100)}%`, {
      fontSize: "12px", color: "#e0e0e0", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(151);
    this.settingsUI.push(sfxLabel);
    yPos += 28;

    const sfxBarX = 60;
    const sfxBarW = GAME_WIDTH - 120;
    const sfxBarY = yPos;
    const sfxBarBg = this.add.graphics().setScrollFactor(0).setDepth(151);
    sfxBarBg.fillStyle(0x334155, 1);
    sfxBarBg.fillRoundedRect(sfxBarX, sfxBarY, sfxBarW, 20, 4);
    this.settingsUI.push(sfxBarBg);

    const sfxFill = this.add.graphics().setScrollFactor(0).setDepth(152);
    const drawSfxFill = () => {
      sfxFill.clear();
      sfxFill.fillStyle(0x4ade80, 1);
      sfxFill.fillRoundedRect(sfxBarX, sfxBarY, sfxBarW * getSfxVolume(), 20, 4);
    };
    drawSfxFill();
    this.settingsUI.push(sfxFill);

    const sfxHitArea = this.add.rectangle(sfxBarX + sfxBarW / 2, sfxBarY + 10, sfxBarW, 20, 0x000000, 0)
      .setScrollFactor(0).setDepth(153).setInteractive();
    sfxHitArea.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const ratio = Math.max(0, Math.min(1, (p.x - sfxBarX) / sfxBarW));
      setSfxVolume(ratio);
      sfxLabel.setText(`🔊 SFX Volume: ${Math.round(ratio * 100)}%`);
      drawSfxFill();
    });
    this.settingsUI.push(sfxHitArea);
    yPos += 50;

    // ── D-Pad Side ──
    const dpadLabel = this.add.text(GAME_WIDTH / 2, yPos, "D-Pad Position", {
      fontSize: "12px", color: "#e0e0e0", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(151);
    this.settingsUI.push(dpadLabel);
    yPos += 28;

    const leftColor = this.dpadSide === "left" ? "#fbbf24" : "#667eea";
    const rightColor = this.dpadSide === "right" ? "#fbbf24" : "#667eea";

    const leftBtn = this.add.text(GAME_WIDTH / 2 - 55, yPos, "◀ Left", {
      fontSize: "12px", color: leftColor, fontFamily: "monospace",
      backgroundColor: this.dpadSide === "left" ? "#3a3a5e" : "#1a1a2e",
      padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(152).setInteractive();

    const rightBtn = this.add.text(GAME_WIDTH / 2 + 55, yPos, "Right ▶", {
      fontSize: "12px", color: rightColor, fontFamily: "monospace",
      backgroundColor: this.dpadSide === "right" ? "#3a3a5e" : "#1a1a2e",
      padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(152).setInteractive();

    const updateDpadBtns = () => {
      leftBtn.setColor(this.dpadSide === "left" ? "#fbbf24" : "#667eea");
      leftBtn.setBackgroundColor(this.dpadSide === "left" ? "#3a3a5e" : "#1a1a2e");
      rightBtn.setColor(this.dpadSide === "right" ? "#fbbf24" : "#667eea");
      rightBtn.setBackgroundColor(this.dpadSide === "right" ? "#3a3a5e" : "#1a1a2e");
    };

    leftBtn.on("pointerdown", () => {
      this.dpadSide = "left";
      try { localStorage.setItem("poke-roguelite-dpadSide", "left"); } catch { /* ignore */ }
      updateDpadBtns();
      this.rebuildControls();
    });

    rightBtn.on("pointerdown", () => {
      this.dpadSide = "right";
      try { localStorage.setItem("poke-roguelite-dpadSide", "right"); } catch { /* ignore */ }
      updateDpadBtns();
      this.rebuildControls();
    });

    this.settingsUI.push(leftBtn, rightBtn);
    yPos += 50;

    // ── Close button ──
    const closeBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 60, "[Close]", {
      fontSize: "14px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(151).setInteractive();
    closeBtn.on("pointerdown", () => this.closeSettings());
    this.settingsUI.push(closeBtn);
  }

  private closeSettings() {
    sfxMenuClose();
    this.settingsOpen = false;
    if (this.domHud) setDomHudInteractive(this.domHud, true);
    this.settingsUI.forEach(obj => obj.destroy());
    this.settingsUI = [];
  }

  private rebuildControls() {
    // Rebuild D-Pad
    this.createDPad();
    // Re-layout DOM HUD buttons based on new D-pad side
    if (this.domHud) {
      layoutHudButtons(this.domHud, this.dpadSide, GAME_WIDTH, GAME_HEIGHT);
    }
  }

  /** Initialize DOM-based HUD overlay for always-crisp text rendering */
  private initDomHud() {
    const hud = createDomHud();
    this.domHud = hud;

    // Attach as Phaser DOMElement so it scales with the canvas
    this.domHudElement = this.add.dom(GAME_WIDTH / 2, GAME_HEIGHT / 2, hud.container);
    this.domHudElement.setScrollFactor(0);
    this.domHudElement.setDepth(500); // above everything

    // Layout buttons based on current D-pad side
    layoutHudButtons(hud, this.dpadSide, GAME_WIDTH, GAME_HEIGHT);

    // Wire up skill button events
    for (let i = 0; i < 4; i++) {
      hud.skillBtns[i].addEventListener("pointerdown", (e: Event) => {
        e.stopPropagation();
        if (this.turnManager.isBusy || !this.player.alive || this.gameOver || this.fullMapOpen || this.relicOverlayOpen) return;
        const skill = this.player.skills[i];
        if (!skill || skill.currentPp <= 0) {
          this.showLog("No PP left!");
          return;
        }
        // Show skill description tooltip
        this.showSkillDescTooltip(skill);
        this.showSkillPreview(i);
      });
    }

    // Wire up pickup button
    hud.pickupBtn.addEventListener("pointerdown", (e: Event) => {
      e.stopPropagation();
      this.pickupItem();
    });

    // Wire up quick-slot button
    hud.quickSlotBtn.addEventListener("pointerdown", (e: Event) => {
      e.stopPropagation();
      this.useQuickSlot();
    });

    // Wire up team button
    hud.teamBtn.addEventListener("pointerdown", (e: Event) => {
      e.stopPropagation();
      this.openTeamPanel();
    });

    // Hide original Phaser text elements (keep them updating for data, just invisible)
    this.floorText.setAlpha(0);
    this.hpText.setAlpha(0);
    this.turnText.setAlpha(0);
    this.timerText.setAlpha(0);
    this.bellyText.setAlpha(0);
    this.logText.setAlpha(0);
    if (this.chainHudText) this.chainHudText.setAlpha(0);
    // Phaser skill buttons & action buttons are no longer created — DOM HUD handles them
  }

  /** Show skill description tooltip at top of screen, auto-dismiss */
  private showSkillDescTooltip(skill: Skill) {
    if (!this.domHud) return;
    const box = this.domHud.skillDescBox;
    const typeStr = skill.type ? ` [${skill.type}]` : "";
    const rangeStr = skill.range !== "front1" ? ` Range:${skill.range}` : "";
    const effectStr = skill.effect ? ` (${skill.effect})` : "";
    box.innerHTML = `<b style="color:#fbbf24">${skill.name}</b>${typeStr} — Pow:${skill.power} PP:${skill.currentPp}/${skill.pp}${rangeStr}${effectStr}<br><span style="color:#94a3b8">${skill.description ?? ""}</span>`;
    box.style.display = "block";
    // Auto-hide after 3 seconds
    if (this.skillDescTimer) clearTimeout(this.skillDescTimer);
    this.skillDescTimer = window.setTimeout(() => {
      box.style.display = "none";
    }, 3000);
  }
  private skillDescTimer: number | null = null;

  /** Sync DOM HUD text from Phaser text values */
  private syncDomHud() {
    const hud = this.domHud;
    if (!hud) return;

    // Floor label
    hud.floorLabel.textContent = this.floorText.text;

    // HP label
    hud.hpLabel.textContent = this.hpText.text;

    // Turn / Level info
    hud.turnLabel.textContent = this.turnText.text;

    // Timer
    hud.timerLabel.textContent = this.timerText.text;

    // Belly
    hud.bellyLabel.textContent = this.bellyText.text;

    // Log box
    const logMsg = this.logMessages.join("\n");
    if (logMsg) {
      hud.logBox.textContent = logMsg;
      hud.logBox.style.display = "block";
    } else {
      hud.logBox.style.display = "none";
    }

    // Chain HUD
    if (this.chainHudText && this.chainHudText.text && this.scoreChain.currentMultiplier > 1.0) {
      hud.chainLabel.textContent = this.chainHudText.text;
      hud.chainLabel.style.color = this.chainHudText.style.color?.toString() ?? "#999999";
      hud.chainLabel.style.display = "block";
    } else {
      hud.chainLabel.style.display = "none";
    }

    // Skill buttons
    const skills = this.player.skills;
    for (let i = 0; i < 4; i++) {
      const skill = skills[i];
      const btn = hud.skillBtns[i];
      if (!skill) {
        btn.textContent = "---";
        btn.style.color = "#444460";
      } else {
        const haspp = skill.currentPp > 0;
        btn.textContent = `${skill.name} ${skill.currentPp}/${skill.pp}`;
        btn.style.color = haspp ? "#c0c8e0" : "#444460";
        btn.style.borderColor = haspp ? "#333355" : "#222240";
      }
    }

    // Quick-slot button sync
    if (!this.lastUsedItemId) {
      hud.quickSlotBtn.textContent = "—";
      hud.quickSlotBtn.style.color = "#555570";
    } else {
      const stack = this.inventory.find(s => s.item.id === this.lastUsedItemId);
      if (!stack) {
        hud.quickSlotBtn.textContent = "✕";
        hud.quickSlotBtn.style.color = "#555570";
      } else {
        const icon = stack.item.category === "berry" ? "●" : stack.item.category === "seed" ? "◆" : stack.item.category === "gem" ? "◇" : "★";
        const countStr = stack.count > 1 ? `${stack.count}` : "";
        hud.quickSlotBtn.textContent = `${icon}${countStr}`;
        hud.quickSlotBtn.style.color = "#4ade80";
      }
    }
  }

  private showLog(msg: string) {
    // Add to message history (max 4 messages)
    this.logMessages.push(msg);
    if (this.logMessages.length > 4) this.logMessages.shift();

    // Build display text with color hints via effectiveness keywords
    const displayText = this.logMessages.join("\n");
    this.logText.setText(displayText);

    // Sync to DOM log box
    if (this.domHud) {
      this.domHud.logBox.textContent = displayText;
      this.domHud.logBox.style.display = "block";
    }

    // Auto-clear oldest messages after delay
    const snapshot = [...this.logMessages];
    this.time.delayedCall(4000, () => {
      // Remove messages that are still in the log from this batch
      if (this.logMessages.length > 0 && this.logMessages[0] === snapshot[0]) {
        this.logMessages.shift();
        const txt = this.logMessages.join("\n");
        this.logText.setText(txt);
        if (this.domHud) {
          if (txt) {
            this.domHud.logBox.textContent = txt;
          } else {
            this.domHud.logBox.style.display = "none";
          }
        }
      }
    });
  }

  // ── Items ──

  private pickupItem() {
    if (this.turnManager.isBusy || !this.player.alive || this.gameOver) return;

    if (this.challengeMode === "noItems") {
      this.showLog("Items are forbidden!");
      return;
    }

    // Anti-theft: check if player is stepping on a shop tile
    const shopTile = this.shopTiles.find(st => st.x === this.player.tileX && st.y === this.player.tileY);
    if (shopTile && !this.shopClosed) {
      // Player is trying to pick up a shop item without paying — trigger theft!
      const si = this.shopItems[shopTile.shopIdx];
      if (si && si.price > 0) {
        const itemDef = ITEM_DB[si.itemId];
        if (itemDef) {
          // Give the item to the player
          if (this.inventory.length < MAX_INVENTORY) {
            const existing = this.inventory.find(s => s.item.id === si.itemId && itemDef.stackable);
            if (existing) existing.count++;
            else this.inventory.push({ item: itemDef, count: 1 });
          }
          // Remove shop tile visual
          shopTile.sprite.destroy();
          shopTile.priceTag.destroy();
          const stIdx = this.shopTiles.indexOf(shopTile);
          if (stIdx >= 0) this.shopTiles.splice(stIdx, 1);
          this.shopItems[shopTile.shopIdx] = { itemId: "", price: 0, stock: 0 };
          // Trigger theft
          this.triggerShopTheft();
          this.updateHUD();
          return;
        }
      }
    }

    const idx = this.floorItems.findIndex(
      fi => fi.x === this.player.tileX && fi.y === this.player.tileY
    );
    if (idx === -1) {
      this.showLog("Nothing here to pick up.");
      return;
    }

    if (this.inventory.length >= MAX_INVENTORY) {
      this.showLog("Inventory is full!");
      return;
    }

    const fi = this.floorItems[idx];
    // Add to inventory (stack if possible)
    const existing = this.inventory.find(s => s.item.id === fi.item.id && fi.item.stackable);
    if (existing) {
      existing.count++;
    } else {
      this.inventory.push({ item: fi.item, count: 1 });
    }

    sfxItemPickup();
    fi.sprite.destroy();
    this.floorItems.splice(idx, 1);
    this.showLog(`Picked up ${fi.item.name}!`);
    // Run log: item picked up
    this.runLog.add(RunLogEvent.ItemPickedUp, fi.item.name, this.currentFloor, this.turnManager.turn);
    this.updateQuickSlotLabel();
    this.questItemsCollected++;

    // Score chain: item pickup
    addChainAction(this.scoreChain, "itemPickup");
    this.chainActionThisTurn = true;
    this.updateChainHUD();
  }

  private toggleBag() {
    if (this.bagOpen) {
      this.closeBag();
    } else {
      this.openBag();
    }
  }

  private openBag() {
    if (this.turnManager.isBusy || this.gameOver || this.menuOpen || this.settingsOpen || this.teamPanelOpen || this.eventOpen || this.fullMapOpen || this.relicOverlayOpen) return;
    sfxMenuOpen();
    this.bagOpen = true;
    if (this.domHud) setDomHudInteractive(this.domHud, false);

    // Dark overlay
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.8
    ).setScrollFactor(0).setDepth(150).setInteractive();
    this.bagUI.push(overlay);

    const title = this.add.text(GAME_WIDTH / 2, 30, "── Bag ──", {
      fontSize: "14px", color: "#fbbf24", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(151);
    this.bagUI.push(title);

    const inShopForSell = this.playerInShopRoom && !this.shopClosed;

    if (this.inventory.length === 0) {
      const empty = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "Empty", {
        fontSize: "12px", color: "#666680", fontFamily: "monospace",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(151);
      this.bagUI.push(empty);
    } else {
      this.inventory.forEach((stack, i) => {
        const y = 60 + i * 32;
        const icon = stack.item.category === "berry" ? "●" : stack.item.category === "seed" ? "◆" : stack.item.category === "gem" ? "◇" : "★";
        const countStr = stack.count > 1 ? ` x${stack.count}` : "";
        // Show sell price next to item name when in shop room
        const sellStr = inShopForSell ? ` (Sell: ${getItemSellPrice(stack.item.id, this.currentFloor)}G)` : "";
        const btn = this.add.text(20, y, `${icon} ${stack.item.name}${countStr}${sellStr}`, {
          fontSize: "11px", color: "#e0e0e0", fontFamily: "monospace",
          backgroundColor: "#1a1a3e", padding: { x: 4, y: 4 },
          fixedWidth: inShopForSell ? 250 : 200,
        }).setScrollFactor(0).setDepth(151).setInteractive();

        const useBtn = this.add.text(inShopForSell ? 280 : 230, y, "[Use]", {
          fontSize: "11px", color: "#4ade80", fontFamily: "monospace",
          padding: { x: 4, y: 4 },
        }).setScrollFactor(0).setDepth(151).setInteractive();

        const desc = this.add.text(20, y + 16, stack.item.description, {
          fontSize: "9px", color: "#666680", fontFamily: "monospace",
        }).setScrollFactor(0).setDepth(151);

        useBtn.on("pointerdown", () => {
          this.useItem(i);
          this.closeBag();
        });

        this.bagUI.push(btn, useBtn, desc);

        // Add Sell button when in shop room
        if (inShopForSell) {
          const sellBtn = this.add.text(320, y, "[Sell]", {
            fontSize: "11px", color: "#fbbf24", fontFamily: "monospace",
            padding: { x: 4, y: 4 },
          }).setScrollFactor(0).setDepth(151).setInteractive();

          sellBtn.on("pointerdown", () => {
            this.closeBag();
            this.showSellPrompt(i);
          });

          this.bagUI.push(sellBtn);
        }
      });
    }

    // Close button
    const closeBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 50, "[Close]", {
      fontSize: "14px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(151).setInteractive();
    closeBtn.on("pointerdown", () => this.closeBag());
    this.bagUI.push(closeBtn);

    overlay.on("pointerdown", () => this.closeBag());
  }

  private closeBag() {
    sfxMenuClose();
    this.bagOpen = false;
    if (this.domHud) setDomHudInteractive(this.domHud, true);
    this.bagUI.forEach(obj => obj.destroy());
    this.bagUI = [];
  }

  /** Quick-slot: use the last-used item type again */
  private useQuickSlot() {
    if (this.turnManager.isBusy || !this.player.alive || this.gameOver || this.fullMapOpen) return;
    if (!this.lastUsedItemId) {
      this.showLog("No recent item. Use an item from the Bag first.");
      return;
    }
    const idx = this.inventory.findIndex(s => s.item.id === this.lastUsedItemId);
    if (idx === -1) {
      this.showLog(`No ${this.lastUsedItemId} left!`);
      return;
    }
    this.useItem(idx);
    this.closeBag(); // safety: close bag if somehow open
  }

  /** Update the quick-slot button label to show last used item (DOM HUD) */
  private updateQuickSlotLabel() {
    if (!this.domHud) return;
    const btn = this.domHud.quickSlotBtn;
    if (!this.lastUsedItemId) {
      btn.textContent = "—";
      btn.style.color = "#555570";
      return;
    }
    const stack = this.inventory.find(s => s.item.id === this.lastUsedItemId);
    if (!stack) {
      btn.textContent = "✕";
      btn.style.color = "#555570";
      return;
    }
    const icon = stack.item.category === "berry" ? "●" : stack.item.category === "seed" ? "◆" : stack.item.category === "gem" ? "◇" : "★";
    const countStr = stack.count > 1 ? `${stack.count}` : "";
    btn.textContent = `${icon}${countStr}`;
    btn.style.color = "#4ade80";
  }

  private useItem(index: number) {
    if (this.challengeMode === "noItems") {
      this.showLog("Items are forbidden!");
      return;
    }

    const stack = this.inventory[index];
    if (!stack) return;

    const item = stack.item;
    this.lastUsedItemId = item.id;
    // Run log: item used
    this.runLog.add(RunLogEvent.ItemUsed, item.name, this.currentFloor, this.turnManager.turn);
    this.questItemsUsed = true;
    sfxHeal();

    switch (item.id) {
      case "oranBerry": {
        const affinityMult = getAffinityMultiplier(this.player.types, item.category, item.id);
        const baseHeal = Math.floor(30 * affinityMult);
        const heal = Math.min(baseHeal, this.player.stats.maxHp - this.player.stats.hp);
        this.player.stats.hp += heal;
        this.showLog(`Used Oran Berry! Restored ${heal} HP.${affinityMult > 1 ? " (Affinity Bonus!)" : ""}`);
        if (this.player.sprite) this.showHealPopup(this.player.sprite.x, this.player.sprite.y, heal);
        // Score chain: healing item resets chain
        if (this.scoreChain.currentMultiplier > 1.0) {
          resetChain(this.scoreChain);
          this.showLog("Chain reset (healed).");
          this.updateChainHUD();
        }
        break;
      }
      case "sitrusBerry": {
        const affinityMult = getAffinityMultiplier(this.player.types, item.category, item.id);
        const heal = Math.floor(this.player.stats.maxHp * 0.5 * affinityMult);
        const actual = Math.min(heal, this.player.stats.maxHp - this.player.stats.hp);
        this.player.stats.hp += actual;
        this.showLog(`Used Sitrus Berry! Restored ${actual} HP.${affinityMult > 1 ? " (Affinity Bonus!)" : ""}`);
        if (this.player.sprite) this.showHealPopup(this.player.sprite.x, this.player.sprite.y, actual);
        // Score chain: healing item resets chain
        if (this.scoreChain.currentMultiplier > 1.0) {
          resetChain(this.scoreChain);
          this.showLog("Chain reset (healed).");
          this.updateChainHUD();
        }
        break;
      }
      case "pechaberry": {
        this.player.statusEffects = [];
        this.showLog("Used Pecha Berry! Status cleared.");
        break;
      }
      case "reviveSeed": {
        // Auto-use on death — just show message for now
        this.showLog("Revive Seed will activate if you faint.");
        // Don't consume here, consumed on death
        return; // Don't consume
      }
      case "blastSeed": {
        // Damage first enemy in facing direction
        const affinityMult = getAffinityMultiplier(this.player.types, item.category, item.id);
        const dmg = Math.floor(40 * affinityMult);
        const dx = DIR_DX[this.player.facing];
        const dy = DIR_DY[this.player.facing];
        const tx = this.player.tileX + dx;
        const ty = this.player.tileY + dy;
        const target = this.enemies.find(e => e.alive && e.tileX === tx && e.tileY === ty);
        if (target) {
          target.stats.hp = Math.max(0, target.stats.hp - dmg);
          this.flashEntity(target, 2.0);
          this.showLog(`Blast Seed hit ${target.name}! ${dmg} dmg!${affinityMult > 1 ? " (Affinity Bonus!)" : ""}`);
          this.checkDeath(target);
        } else {
          this.showLog("Blast Seed missed! No enemy in front.");
        }
        break;
      }
      case "sleepSeed": {
        const dx = DIR_DX[this.player.facing];
        const dy = DIR_DY[this.player.facing];
        const tx = this.player.tileX + dx;
        const ty = this.player.tileY + dy;
        const target = this.enemies.find(e => e.alive && e.tileX === tx && e.tileY === ty);
        if (target) {
          target.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 5 });
          this.showLog(`Sleep Seed hit ${target.name}! Paralyzed!`);
        } else {
          this.showLog("Sleep Seed missed! No enemy in front.");
        }
        break;
      }
      case "escapeOrb": {
        this.showLog("Used Escape Orb! Escaped the dungeon!");
        this.gameOver = true;
        clearDungeonSave();
        const heldGoldMult = 1 + (this.heldItemEffect.goldBonus ?? 0) / 100;
        const ngEscGoldMult = 1 + this.ngPlusBonuses.goldPercent / 100;
        const enchGoldMult = this.enchantment?.id === "abundance" ? 1.15 : 1.0;
        const escMutGoldMult = hasMutation(this.floorMutations, MutationType.GoldenAge) ? getMutationEffect(MutationType.GoldenAge, "goldMult") : 1;
        const escTalentGoldMult = 1 + (this.talentEffects.goldPercent ?? 0) / 100;
        const escRelicGoldMult = 1 + (this.relicEffects.goldMult ?? 0);
        const escGold = Math.floor(goldFromRun(this.currentFloor, this.enemiesDefeated, false) * this.modifierEffects.goldMult * heldGoldMult * this.difficultyMods.goldMult * ngEscGoldMult * enchGoldMult * escMutGoldMult * escTalentGoldMult * escRelicGoldMult);
        this.cameras.main.fadeOut(500);
        this.time.delayedCall(600, () => {
          this.scene.start("HubScene", {
            gold: escGold,
            cleared: false,
            bestFloor: this.currentFloor,
            enemiesDefeated: this.enemiesDefeated,
            turns: this.turnManager.turn,
            dungeonId: this.dungeonDef.id,
            starter: this.starterId,
            challengeMode: this.challengeMode ?? undefined,
            pokemonSeen: Array.from(this.seenSpecies),
            inventory: serializeInventory(this.inventory),
            ...this.getQuestTrackingData(),
          });
        });
        break;
      }
      case "luminousOrb": {
        // Just show a message — real map reveal would need fog of war
        this.showLog("Used Luminous Orb! Floor layout revealed!");
        break;
      }
      case "allPowerOrb": {
        this.player.statusEffects.push({ type: SkillEffect.AtkUp, turnsLeft: 10 });
        this.player.statusEffects.push({ type: SkillEffect.DefUp, turnsLeft: 10 });
        sfxBuff();
        this.showLog("Used All-Power Orb! ATK & DEF boosted!");
        break;
      }
      case "apple": {
        const affinityMult = getAffinityMultiplier(this.player.types, item.category, item.id);
        const restore = Math.min(Math.floor(50 * affinityMult), this.maxBelly - this.belly);
        this.belly += restore;
        this.resetBellyWarnings();
        this.showLog(`Ate an Apple! Belly +${restore}. (${Math.floor(this.belly)}/${this.maxBelly})${affinityMult > 1 ? " (Affinity Bonus!)" : ""}`);
        break;
      }
      case "bigApple": {
        this.belly = this.maxBelly;
        this.resetBellyWarnings();
        this.showLog(`Ate a Big Apple! Belly fully restored!`);
        break;
      }
      case "grimyFood": {
        const affinityMult = getAffinityMultiplier(this.player.types, item.category, item.id);
        const grimyRestore = Math.min(Math.floor(30 * affinityMult), this.maxBelly - this.belly);
        this.belly += grimyRestore;
        this.resetBellyWarnings();
        this.showLog(`Ate Grimy Food... Belly +${grimyRestore}. (${Math.floor(this.belly)}/${this.maxBelly})${affinityMult > 1 ? " (Affinity Bonus!)" : ""}`);
        // 50% chance to cause Burn (poison-like DoT)
        if (Math.random() < 0.5) {
          if (!this.player.statusEffects.some(s => s.type === SkillEffect.Burn)) {
            this.player.statusEffects.push({ type: SkillEffect.Burn, turnsLeft: 5 });
            this.showLog("Ugh! The food was bad... You got burned!");
          }
        } else {
          // 50% chance: lose some HP directly
          const grimyDmg = Math.max(1, Math.floor(this.player.stats.maxHp * 0.1));
          this.player.stats.hp = Math.max(1, this.player.stats.hp - grimyDmg);
          if (this.player.sprite) this.showDamagePopup(this.player.sprite.x, this.player.sprite.y, grimyDmg, 0.8);
          this.showLog(`The food was rotten! Lost ${grimyDmg} HP!`);
        }
        break;
      }
      case "warpOrb": {
        let warped = 0;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const pt = this.findWalkableTile();
          if (pt) {
            e.tileX = pt.x; e.tileY = pt.y;
            if (e.sprite) e.sprite.setPosition(this.tileToPixelX(pt.x), this.tileToPixelY(pt.y));
            warped++;
          }
        }
        this.showLog(`Used Warp Orb! ${warped} enemies warped away!`);
        break;
      }
      case "foeHoldOrb": {
        let held = 0;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          e.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 5 });
          held++;
        }
        this.showLog(`Used Foe-Hold Orb! ${held} enemies paralyzed!`);
        break;
      }
      case "maxElixir": {
        for (const sk of this.player.skills) { sk.currentPp = sk.pp; }
        this.showLog("Used Max Elixir! All PP restored!");
        break;
      }
      case "warpSeed": {
        const pt = this.findWalkableTile();
        if (pt) {
          this.player.tileX = pt.x; this.player.tileY = pt.y;
          if (this.player.sprite) this.player.sprite.setPosition(this.tileToPixelX(pt.x), this.tileToPixelY(pt.y));
          this.showLog("Used Warp Seed! Warped to a new location!");
        } else {
          this.showLog("Warp Seed fizzled...");
        }
        break;
      }
      case "stunSeed": {
        const dx = DIR_DX[this.player.facing];
        const dy = DIR_DY[this.player.facing];
        const tx = this.player.tileX + dx;
        const ty = this.player.tileY + dy;
        const target = this.enemies.find(e => e.alive && e.tileX === tx && e.tileY === ty);
        if (target) {
          target.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 3 });
          this.showLog(`Stun Seed hit ${target.name}! Stunned for 3 turns!`);
        } else {
          this.showLog("Stun Seed missed! No enemy in front.");
        }
        break;
      }
      case "healSeed": {
        this.player.statusEffects = [];
        const affinityMult = getAffinityMultiplier(this.player.types, item.category, item.id);
        const baseHeal = Math.floor(20 * affinityMult);
        const heal = Math.min(baseHeal, this.player.stats.maxHp - this.player.stats.hp);
        this.player.stats.hp += heal;
        this.showLog(`Used Heal Seed! Status cleared, restored ${heal} HP.${affinityMult > 1 ? " (Affinity Bonus!)" : ""}`);
        if (this.player.sprite) this.showHealPopup(this.player.sprite.x, this.player.sprite.y, heal);
        break;
      }
      case "vanishOrb": {
        // Make player invisible for 10 turns — enemies won't target
        this.player.statusEffects.push({ type: SkillEffect.DefUp, turnsLeft: 10 });
        if (this.player.sprite) this.player.sprite.setAlpha(0.3);
        this.showLog("Used Vanish Orb! You became invisible for 10 turns!");
        break;
      }
      case "reviveSeed": {
        const fainted = this.allies.find(a => !a.alive);
        if (fainted) {
          fainted.alive = true;
          fainted.stats.hp = Math.floor(fainted.stats.maxHp / 2);
          if (fainted.sprite) fainted.sprite.setAlpha(1);
          this.showLog(`Used Revive Seed! ${fainted.speciesId} was revived!`);
        } else {
          this.showLog("No fainted allies to revive.");
          return;
        }
        break;
      }
      case "allPowerOrb": {
        this.player.statusEffects.push({ type: SkillEffect.AtkUp, turnsLeft: 10 });
        this.player.statusEffects.push({ type: SkillEffect.DefUp, turnsLeft: 10 });
        sfxBuff();
        this.showLog("Used All-Power Orb! ATK and DEF boosted for 10 turns!");
        break;
      }
      case "escapeOrb": {
        this.showLog("Used Escape Orb! Escaping the dungeon...");
        this.time.delayedCall(800, () => {
          this.scene.start("HubScene", {
            gold: 0,
            cleared: false,
            bestFloor: this.currentFloor,
            enemiesDefeated: this.enemiesDefeated,
            turns: this.turnManager.turn,
            dungeonId: this.dungeonDef.id,
            starter: this.starterId,
            challengeMode: this.challengeMode ?? undefined,
            pokemonSeen: Array.from(this.seenSpecies),
            inventory: serializeInventory(this.inventory),
            ...this.getQuestTrackingData(),
          });
        });
        break;
      }
      // ── Base throwable/stat items ──
      case "pebble": {
        const dx = DIR_DX[this.player.facing];
        const dy = DIR_DY[this.player.facing];
        const tx = this.player.tileX + dx;
        const ty = this.player.tileY + dy;
        const target = this.enemies.find(e => e.alive && e.tileX === tx && e.tileY === ty);
        if (target) {
          target.stats.hp = Math.max(0, target.stats.hp - 15);
          this.flashEntity(target, 2.0);
          this.showLog(`Pebble hit ${target.name}! 15 dmg!`);
          this.checkDeath(target);
        } else {
          this.showLog("Pebble missed! No enemy in front.");
        }
        break;
      }
      case "gravelrock": {
        const dx = DIR_DX[this.player.facing];
        const dy = DIR_DY[this.player.facing];
        const tx = this.player.tileX + dx;
        const ty = this.player.tileY + dy;
        const target = this.enemies.find(e => e.alive && e.tileX === tx && e.tileY === ty);
        if (target) {
          target.stats.hp = Math.max(0, target.stats.hp - 25);
          this.flashEntity(target, 2.0);
          this.showLog(`Gravelrock hit ${target.name}! 25 dmg!`);
          this.checkDeath(target);
        } else {
          this.showLog("Gravelrock missed! No enemy in front.");
        }
        break;
      }
      case "xAttack": {
        this.player.statusEffects.push({ type: SkillEffect.AtkUp, turnsLeft: 10 });
        sfxBuff();
        this.showLog("Used X-Attack! ATK boosted for 10 turns!");
        break;
      }
      case "xDefend": {
        this.player.statusEffects.push({ type: SkillEffect.DefUp, turnsLeft: 10 });
        sfxBuff();
        this.showLog("Used X-Defend! DEF boosted for 10 turns!");
        break;
      }
      // ── Upgraded (Synthesized) Items ──
      case "megaOranBerry": {
        const affinityMult = getAffinityMultiplier(this.player.types, item.category, item.id);
        const baseHeal = Math.floor(80 * affinityMult);
        const heal = Math.min(baseHeal, this.player.stats.maxHp - this.player.stats.hp);
        this.player.stats.hp += heal;
        this.showLog(`Used Mega Oran Berry! Restored ${heal} HP.${affinityMult > 1 ? " (Affinity Bonus!)" : ""}`);
        if (this.player.sprite) this.showHealPopup(this.player.sprite.x, this.player.sprite.y, heal);
        if (this.scoreChain.currentMultiplier > 1.0) {
          resetChain(this.scoreChain);
          this.showLog("Chain reset (healed).");
          this.updateChainHUD();
        }
        break;
      }
      case "megaSitrusBerry": {
        const affinityMult = getAffinityMultiplier(this.player.types, item.category, item.id);
        const baseHeal = Math.floor(150 * affinityMult);
        const heal = Math.min(baseHeal, this.player.stats.maxHp - this.player.stats.hp);
        this.player.stats.hp += heal;
        this.showLog(`Used Mega Sitrus Berry! Restored ${heal} HP.${affinityMult > 1 ? " (Affinity Bonus!)" : ""}`);
        if (this.player.sprite) this.showHealPopup(this.player.sprite.x, this.player.sprite.y, heal);
        if (this.scoreChain.currentMultiplier > 1.0) {
          resetChain(this.scoreChain);
          this.showLog("Chain reset (healed).");
          this.updateChainHUD();
        }
        break;
      }
      case "goldenApple": {
        const affinityMult = getAffinityMultiplier(this.player.types, item.category, item.id);
        const restore = Math.min(Math.floor(200 * affinityMult), this.maxBelly - this.belly);
        this.belly += restore;
        this.resetBellyWarnings();
        this.showLog(`Ate a Golden Apple! Belly +${restore}. (${Math.floor(this.belly)}/${this.maxBelly})${affinityMult > 1 ? " (Affinity Bonus!)" : ""}`);
        break;
      }
      case "crystalPebble": {
        const dx = DIR_DX[this.player.facing];
        const dy = DIR_DY[this.player.facing];
        const tx = this.player.tileX + dx;
        const ty = this.player.tileY + dy;
        const target = this.enemies.find(e => e.alive && e.tileX === tx && e.tileY === ty);
        if (target) {
          target.stats.hp = Math.max(0, target.stats.hp - 30);
          this.flashEntity(target, 2.0);
          this.showLog(`Crystal Pebble hit ${target.name}! 30 dmg!`);
          this.checkDeath(target);
        } else {
          this.showLog("Crystal Pebble missed! No enemy in front.");
        }
        break;
      }
      case "meteorRock": {
        const dx = DIR_DX[this.player.facing];
        const dy = DIR_DY[this.player.facing];
        const tx = this.player.tileX + dx;
        const ty = this.player.tileY + dy;
        const target = this.enemies.find(e => e.alive && e.tileX === tx && e.tileY === ty);
        if (target) {
          target.stats.hp = Math.max(0, target.stats.hp - 50);
          this.flashEntity(target, 2.0);
          this.showLog(`Meteor Rock hit ${target.name}! 50 dmg!`);
          this.checkDeath(target);
        } else {
          this.showLog("Meteor Rock missed! No enemy in front.");
        }
        break;
      }
      case "autoReviver": {
        // Auto-use on death — just show message
        this.showLog("Auto Reviver will activate instantly if you faint.");
        return; // Don't consume
      }
      case "megaElixir": {
        for (const sk of this.player.skills) {
          sk.currentPp = sk.pp + 10;
        }
        this.showLog("Used Mega Elixir! All PP restored + 10 bonus PP!");
        break;
      }
      case "megaBlastSeed": {
        const affinityMult = getAffinityMultiplier(this.player.types, item.category, item.id);
        const dmg = Math.floor(80 * affinityMult);
        const dx = DIR_DX[this.player.facing];
        const dy = DIR_DY[this.player.facing];
        const tx = this.player.tileX + dx;
        const ty = this.player.tileY + dy;
        const target = this.enemies.find(e => e.alive && e.tileX === tx && e.tileY === ty);
        if (target) {
          target.stats.hp = Math.max(0, target.stats.hp - dmg);
          this.flashEntity(target, 2.0);
          this.showLog(`Mega Blast Seed hit ${target.name}! ${dmg} dmg!${affinityMult > 1 ? " (Affinity Bonus!)" : ""}`);
          this.checkDeath(target);
        } else {
          this.showLog("Mega Blast Seed missed! No enemy in front.");
        }
        break;
      }
      case "deepSleepSeed": {
        const dx = DIR_DX[this.player.facing];
        const dy = DIR_DY[this.player.facing];
        const tx = this.player.tileX + dx;
        const ty = this.player.tileY + dy;
        const target = this.enemies.find(e => e.alive && e.tileX === tx && e.tileY === ty);
        if (target) {
          target.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 8 });
          this.showLog(`Deep Sleep Seed hit ${target.name}! Deep sleep for 8 turns!`);
        } else {
          this.showLog("Deep Sleep Seed missed! No enemy in front.");
        }
        break;
      }
      case "megaXAttack": {
        this.player.statusEffects.push({ type: SkillEffect.AtkUp, turnsLeft: 15 });
        sfxBuff();
        this.showLog("Used Mega X-Attack! ATK greatly boosted for 15 turns!");
        break;
      }
      case "megaXDefend": {
        this.player.statusEffects.push({ type: SkillEffect.DefUp, turnsLeft: 15 });
        sfxBuff();
        this.showLog("Used Mega X-Defend! DEF greatly boosted for 15 turns!");
        break;
      }
      default: {
        // Type Gem handling
        if (item.category === ItemCategory.Gem && item.gemId) {
          const gem = getTypeGem(item.gemId);
          if (gem) {
            this.activeTypeGems.set(gem.type, gem.boostPercent);
            sfxBuff();
            this.showLog(`Used ${gem.name}! ${gem.type}-type moves boosted by ${gem.boostPercent}% this floor!`);
            this.updateTypeGemHUD();
            break;
          }
        }
        // TM handling
        if (item.tmSkillId) {
          this.useTM(index, item);
          return; // Don't consume here — handled inside useTM
        }
        this.showLog(`Used ${item.name}.`);
        break;
      }
    }

    // Consume item
    stack.count--;
    if (stack.count <= 0) {
      this.inventory.splice(index, 1);
    }

    this.updateHUD();
    this.updateQuickSlotLabel();
  }

  /** Find a random walkable tile (ground, no entity) */
  private findWalkableTile(): { x: number; y: number } | null {
    const { terrain, width, height } = this.dungeon;
    for (let tries = 0; tries < 200; tries++) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);
      if (terrain[y][x] !== TerrainType.GROUND) continue;
      if (this.allEntities.some(e => e.alive && e.tileX === x && e.tileY === y)) continue;
      return { x, y };
    }
    return null;
  }

  /** Use a TM to teach a skill — replaces the first (weakest) skill */
  private useTM(index: number, item: ItemDef) {
    if (!item.tmSkillId) return;
    const newSkill = SKILL_DB[item.tmSkillId];
    if (!newSkill) { this.showLog("Invalid TM!"); return; }

    // Replace the skill with lowest power (or first non-Tackle)
    let replaceIdx = 0;
    let lowestPower = Infinity;
    for (let i = 0; i < this.player.skills.length; i++) {
      if (this.player.skills[i].power < lowestPower) {
        lowestPower = this.player.skills[i].power;
        replaceIdx = i;
      }
    }

    const oldName = this.player.skills[replaceIdx].name;
    this.player.skills[replaceIdx] = createSkill(SKILL_DB[item.tmSkillId]);
    this.showLog(`Learned ${newSkill.name}! (replaced ${oldName})`);

    // Consume TM
    const stack = this.inventory[index];
    stack.count--;
    if (stack.count <= 0) this.inventory.splice(index, 1);
    this.updateHUD();
  }

  /** Check for auto reviver, revive seed, or Phoenix enchantment on death */
  private tryRevive(): boolean {
    // 0. Auto Reviver (upgraded item) — 75% HP, golden flash
    const autoIdx = this.inventory.findIndex(s => s.item.id === "autoReviver");
    if (autoIdx !== -1) {
      const stack = this.inventory[autoIdx];
      stack.count--;
      if (stack.count <= 0) this.inventory.splice(autoIdx, 1);

      this.player.stats.hp = Math.floor(this.player.stats.maxHp * 0.75);
      this.player.alive = true;
      if (this.player.sprite) {
        this.player.sprite.setAlpha(1);
        this.player.sprite.setTint(0xffdd44);
        this.time.delayedCall(500, () => {
          if (this.player.sprite) this.player.sprite.clearTint();
        });
      }
      this.cameras.main.flash(400, 255, 215, 0);
      this.showLog("Auto Reviver activated! Instantly restored to 75% HP!");
      return true;
    }

    // 1. Revive Seed (item) — 50% HP
    const idx = this.inventory.findIndex(s => s.item.id === "reviveSeed");
    if (idx !== -1) {
      const stack = this.inventory[idx];
      stack.count--;
      if (stack.count <= 0) this.inventory.splice(idx, 1);

      this.player.stats.hp = Math.floor(this.player.stats.maxHp * 0.5);
      this.player.alive = true;
      if (this.player.sprite) {
        this.player.sprite.setAlpha(1);
        this.player.sprite.setTint(0x44ff44);
        this.time.delayedCall(500, () => {
          if (this.player.sprite) this.player.sprite.clearTint();
        });
      }
      this.showLog("Revive Seed activated! Restored to 50% HP!");
      return true;
    }

    // 2. Phoenix enchantment — auto-revive once per run at 25% HP
    if (this.enchantment?.id === "phoenix" && !this.phoenixUsed) {
      this.phoenixUsed = true;
      this.player.stats.hp = Math.floor(this.player.stats.maxHp * 0.25);
      this.player.alive = true;

      // Dramatic phoenix animation
      if (this.player.sprite) {
        this.player.sprite.setAlpha(1);

        // Screen flash (golden)
        this.cameras.main.flash(600, 255, 180, 50);
        // Screen shake
        this.cameras.main.shake(400, 0.015);

        // Fire-like color cycle on player sprite
        this.player.sprite.setTint(0xff4400);
        this.time.delayedCall(150, () => {
          if (this.player.sprite) this.player.sprite.setTint(0xff8800);
        });
        this.time.delayedCall(300, () => {
          if (this.player.sprite) this.player.sprite.setTint(0xffcc00);
        });
        this.time.delayedCall(500, () => {
          if (this.player.sprite) this.player.sprite.setTint(0xffffff);
        });
        this.time.delayedCall(700, () => {
          if (this.player.sprite) this.player.sprite.clearTint();
        });

        // Rising "PHOENIX!" text popup
        const px = this.player.sprite.x;
        const py = this.player.sprite.y;
        const phoenixText = this.add.text(px, py - 10, "PHOENIX!", {
          fontSize: "16px",
          color: "#ff8800",
          fontFamily: "monospace",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 4,
        }).setOrigin(0.5).setDepth(310);

        this.tweens.add({
          targets: phoenixText,
          y: py - 60,
          alpha: { from: 1, to: 0 },
          scaleX: { from: 1.3, to: 0.8 },
          scaleY: { from: 1.3, to: 0.8 },
          duration: 1200,
          onComplete: () => phoenixText.destroy(),
        });
      }

      this.showLog("Phoenix enchantment activated! Revived at 25% HP!");
      return true;
    }

    return false;
  }

  // ── Save ──

  private saveGame() {
    if (this.gameOver) return;
    saveDungeon({
      version: 1,
      timestamp: Date.now(),
      floor: this.currentFloor,
      dungeonId: this.dungeonDef.id,
      hp: this.player.stats.hp,
      maxHp: this.player.stats.maxHp,
      level: this.player.stats.level,
      atk: this.player.stats.atk,
      def: this.player.stats.def,
      totalExp: this.totalExp,
      belly: this.belly,
      skills: serializeSkills(this.player.skills),
      inventory: serializeInventory(this.inventory),
      allies: this.serializeAllies(),
      starter: this.starterId,
      challengeMode: this.challengeMode ?? undefined,
      modifiers: this.activeModifiers.length > 0 ? this.activeModifiers.map(m => m.id) : undefined,
    });
    this.showLog("Game saved!");
  }

  /** Silent auto-save (no log message) */
  private autoSave() {
    if (this.gameOver) return;
    saveDungeon({
      version: 1,
      timestamp: Date.now(),
      floor: this.currentFloor,
      dungeonId: this.dungeonDef.id,
      hp: this.player.stats.hp,
      maxHp: this.player.stats.maxHp,
      level: this.player.stats.level,
      atk: this.player.stats.atk,
      def: this.player.stats.def,
      totalExp: this.totalExp,
      belly: this.belly,
      skills: serializeSkills(this.player.skills),
      inventory: serializeInventory(this.inventory),
      allies: this.serializeAllies(),
      starter: this.starterId,
      challengeMode: this.challengeMode ?? undefined,
      modifiers: this.activeModifiers.length > 0 ? this.activeModifiers.map(m => m.id) : undefined,
    });
  }

  /** Update the chain HUD indicator */
  private updateChainHUD() {
    if (!this.chainHudText || !this.chainHudBg) return;

    const mult = this.scoreChain.currentMultiplier;
    const tier = getChainTier(mult);

    if (!tier || mult <= 1.0) {
      // Hide HUD when no chain
      this.chainHudText.setAlpha(0);
      this.chainHudBg.clear();
      this.lastChainTier = "";
      if (this.domHud) this.domHud.chainLabel.style.display = "none";
      return;
    }

    const color = getChainColor(tier);
    const displayStr = `[${tier}] x${mult.toFixed(1)}`;

    this.chainHudText.setText(displayStr);
    this.chainHudText.setColor(color);
    this.chainHudText.setAlpha(0); // keep hidden, DOM shows it

    // Sync to DOM
    if (this.domHud) {
      this.domHud.chainLabel.textContent = displayStr;
      this.domHud.chainLabel.style.color = color;
      this.domHud.chainLabel.style.display = "block";
    }

    // Background box
    const bounds = this.chainHudText.getBounds();
    this.chainHudBg.clear();
    this.chainHudBg.fillStyle(0x000000, 0.7);
    this.chainHudBg.fillRoundedRect(bounds.x - 4, bounds.y - 2, bounds.width + 8, bounds.height + 4, 3);

    // Tier-up animation: brief scale pop + flash when tier changes
    if (tier !== this.lastChainTier && this.lastChainTier !== "") {
      // Run log: chain tier up
      this.runLog.add(RunLogEvent.ChainTierUp, tier, this.currentFloor, this.turnManager.turn);
      // Scale pop
      this.tweens.add({
        targets: this.chainHudText,
        scaleX: 1.4, scaleY: 1.4,
        duration: 150,
        yoyo: true,
        ease: "Quad.easeOut",
      });
      // Flash the screen briefly with tier color
      const hexColor = getChainHexColor(tier);
      const r = (hexColor >> 16) & 0xff;
      const g = (hexColor >> 8) & 0xff;
      const b = hexColor & 0xff;
      this.cameras.main.flash(150, r, g, b);
    }

    this.lastChainTier = tier;
  }

  /** Update the status icons HUD next to the HP bar */
  private updateStatusHud() {
    // Destroy previous status HUD texts
    for (const t of this.statusHudTexts) t.destroy();
    this.statusHudTexts = [];

    const effects = this.player.statusEffects;
    if (effects.length === 0) return;

    // Position: right of HP bar (HP bar ends at x=138, y=8)
    let xOffset = 142;
    const yPos = 8;

    // Status icon configs
    const statusConfig: Record<string, { label: string; color: string }> = {
      [SkillEffect.Burn]: { label: "BRN", color: "#ff6644" },
      [SkillEffect.Paralyze]: { label: "PAR", color: "#ffdd44" },
      [SkillEffect.AtkUp]: { label: "ATK\u2191", color: "#ff8844" },
      [SkillEffect.DefUp]: { label: "DEF\u2191", color: "#4488ff" },
      [SkillEffect.Frozen]: { label: "FRZ", color: "#88ccff" },
      [SkillEffect.BadlyPoisoned]: { label: "TOX", color: "#9944cc" },
      [SkillEffect.Flinch]: { label: "FLN", color: "#ffaa88" },
      [SkillEffect.Drowsy]: { label: "DRW", color: "#ccaadd" },
      [SkillEffect.Cursed]: { label: "CRS", color: "#aa44aa" },
    };

    for (const se of effects) {
      const cfg = statusConfig[se.type];
      if (!cfg) continue;

      const txt = this.add.text(xOffset, yPos, `${cfg.label}${se.turnsLeft}`, {
        fontSize: "7px",
        color: cfg.color,
        fontFamily: "monospace",
        fontStyle: "bold",
        backgroundColor: "#0a0a1ecc",
        padding: { x: 2, y: 1 },
      }).setScrollFactor(0).setDepth(102);

      this.statusHudTexts.push(txt);
      xOffset += txt.width + 3;
    }
  }

  /** Apply persistent status effect tint to entity sprite */
  private updateStatusTint(entity: { sprite?: Phaser.GameObjects.Sprite; statusEffects: StatusEffect[] }) {
    if (!entity.sprite) return;
    const hasBurn = entity.statusEffects.some(s => s.type === SkillEffect.Burn);
    const hasPara = entity.statusEffects.some(s => s.type === SkillEffect.Paralyze);
    const hasFrozen = entity.statusEffects.some(s => s.type === SkillEffect.Frozen);
    const hasBadlyPoisoned = entity.statusEffects.some(s => s.type === SkillEffect.BadlyPoisoned);
    const hasDrowsy = entity.statusEffects.some(s => s.type === SkillEffect.Drowsy);
    const hasCursed = entity.statusEffects.some(s => s.type === SkillEffect.Cursed);
    const hasAtkUp = entity.statusEffects.some(s => s.type === SkillEffect.AtkUp);
    const hasDefUp = entity.statusEffects.some(s => s.type === SkillEffect.DefUp);

    // Priority: Frozen > Cursed > Burn > BadlyPoisoned > Paralyze > Drowsy > buffs
    if (hasFrozen) {
      entity.sprite.setTint(0x88ccff); // Ice blue for frozen
    } else if (hasCursed) {
      entity.sprite.setTint(0x553366); // Dark purple for curse
    } else if (hasBurn) {
      entity.sprite.setTint(0xff8844); // Orange-red for burn
    } else if (hasBadlyPoisoned) {
      entity.sprite.setTint(0x9944cc); // Purple for bad poison
    } else if (hasPara) {
      entity.sprite.setTint(0xffff44); // Yellow for paralysis
    } else if (hasDrowsy) {
      entity.sprite.setTint(0xccaadd); // Light purple for drowsy
    } else if (hasAtkUp && hasDefUp) {
      entity.sprite.setTint(0x44ffff); // Cyan for both buffs
    } else if (hasAtkUp) {
      entity.sprite.setTint(0xff4444); // Red for ATK up
    } else if (hasDefUp) {
      entity.sprite.setTint(0x4444ff); // Blue for DEF up
    } else {
      entity.sprite.clearTint();
    }
  }

  /**
   * Tick status effects for an entity: apply burn damage, show wear-off popups,
   * and display log messages. Wraps the core tickStatusEffects function.
   */
  private tickEntityStatus(entity: Entity) {
    // Apply burn damage before ticking (so burn deals damage on the turn it expires too)
    const hasBurn = entity.statusEffects.some(s => s.type === SkillEffect.Burn);
    if (hasBurn && entity.alive) {
      const burnDmg = 5;
      entity.stats.hp = Math.max(0, entity.stats.hp - burnDmg);
      if (entity.sprite) {
        this.showDamagePopup(entity.sprite.x, entity.sprite.y, burnDmg, 1.0);
      }
      this.showLog(`${entity.name} is hurt by its burn!`);
      if (entity.stats.hp <= 0) {
        entity.alive = false;
      }
    }

    // Apply Badly Poisoned damage (escalating: 1, 2, 3, 4... per turn)
    const bpDmg = getBadlyPoisonedDamage(entity);
    if (bpDmg > 0 && entity.alive) {
      entity.stats.hp = Math.max(0, entity.stats.hp - bpDmg);
      if (entity.sprite) {
        this.showDamagePopup(entity.sprite.x, entity.sprite.y, bpDmg, 1.0);
      }
      this.showLog(`${entity.name} is hurt by bad poison! (${bpDmg} dmg)`);
      if (entity.stats.hp <= 0) {
        entity.alive = false;
      }
    }

    // Apply Curse damage (25% max HP every 4 turns)
    const curseDmg = getCurseDamage(entity);
    if (curseDmg > 0 && entity.alive) {
      entity.stats.hp = Math.max(0, entity.stats.hp - curseDmg);
      if (entity.sprite) {
        this.showDamagePopup(entity.sprite.x, entity.sprite.y, curseDmg, 1.0);
      }
      this.showLog(`${entity.name} is afflicted by the curse! (${curseDmg} dmg)`);
      if (entity.stats.hp <= 0) {
        entity.alive = false;
      }
    }

    // Tick turn counters and get wear-off messages
    const messages = tickStatusEffects(entity);
    for (const msg of messages) {
      this.showLog(msg);
      // Show floating popup for wear-off on player
      if (entity === this.player && entity.sprite) {
        this.showStatusPopup(entity.sprite.x, entity.sprite.y - 16, msg);
      }
    }

    // Update tint after status changes
    this.updateStatusTint(entity);
  }

  /** Show a floating status wear-off popup text */
  private showStatusPopup(x: number, y: number, text: string) {
    const popup = this.add.text(x, y - 8, text, {
      fontSize: "8px",
      color: "#88ff88",
      fontFamily: "monospace",
      fontStyle: "bold",
      backgroundColor: "#00000099",
      padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: popup,
      y: y - 30,
      alpha: 0,
      duration: 1200,
      ease: "Power2",
      onComplete: () => popup.destroy(),
    });
  }

  /**
   * Setup periodic flash animations for status effects on all entities.
   * Called once during floor setup. Burn: orange flash every 2s.
   * Paralyze: yellow jitter every 2s.
   */
  private setupStatusFlashAnimations() {
    // Clean up any existing timers
    for (const t of this.statusFlashTimers) t.destroy();
    this.statusFlashTimers = [];

    // Burn flash timer — every 2 seconds, flash burned entities orange
    const burnTimer = this.time.addEvent({
      delay: 2000,
      loop: true,
      callback: () => {
        const allEnts = [this.player, ...this.allies, ...this.enemies];
        for (const ent of allEnts) {
          if (!ent.alive || !ent.sprite) continue;
          if (!ent.statusEffects.some(s => s.type === SkillEffect.Burn)) continue;
          // Quick orange flash
          ent.sprite.setTint(0xff5500);
          this.time.delayedCall(150, () => {
            if (ent.sprite && ent.alive) this.updateStatusTint(ent);
          });
        }
      },
    });
    this.statusFlashTimers.push(burnTimer);

    // Paralyze jitter timer — every 2 seconds, jitter paralyzed entities
    const paraTimer = this.time.addEvent({
      delay: 2000,
      startAt: 1000, // offset so it doesn't overlap with burn flash
      loop: true,
      callback: () => {
        const allEnts = [this.player, ...this.allies, ...this.enemies];
        for (const ent of allEnts) {
          if (!ent.alive || !ent.sprite) continue;
          if (!ent.statusEffects.some(s => s.type === SkillEffect.Paralyze)) continue;
          // Quick yellow flash + small jitter
          const origX = ent.sprite.x;
          ent.sprite.setTint(0xffff00);
          this.tweens.add({
            targets: ent.sprite,
            x: origX + 2,
            duration: 50,
            yoyo: true,
            repeat: 2,
            onComplete: () => {
              if (ent.sprite && ent.alive) {
                ent.sprite.x = origX;
                this.updateStatusTint(ent);
              }
            },
          });
        }
      },
    });
    this.statusFlashTimers.push(paraTimer);

    // Frozen pulse timer — every 2.5 seconds, pulse ice-blue on frozen entities
    const frozenTimer = this.time.addEvent({
      delay: 2500,
      loop: true,
      callback: () => {
        const allEnts = [this.player, ...this.allies, ...this.enemies];
        for (const ent of allEnts) {
          if (!ent.alive || !ent.sprite) continue;
          if (!ent.statusEffects.some(s => s.type === SkillEffect.Frozen)) continue;
          ent.sprite.setTint(0x44aaff);
          this.time.delayedCall(200, () => {
            if (ent.sprite && ent.alive) this.updateStatusTint(ent);
          });
        }
      },
    });
    this.statusFlashTimers.push(frozenTimer);

    // Badly Poisoned pulse timer — every 2 seconds, purple pulse
    const toxicTimer = this.time.addEvent({
      delay: 2000,
      startAt: 500,
      loop: true,
      callback: () => {
        const allEnts = [this.player, ...this.allies, ...this.enemies];
        for (const ent of allEnts) {
          if (!ent.alive || !ent.sprite) continue;
          if (!ent.statusEffects.some(s => s.type === SkillEffect.BadlyPoisoned)) continue;
          ent.sprite.setTint(0x7722aa);
          this.time.delayedCall(150, () => {
            if (ent.sprite && ent.alive) this.updateStatusTint(ent);
          });
        }
      },
    });
    this.statusFlashTimers.push(toxicTimer);

    // Cursed pulse timer — every 3 seconds, dark flash
    const curseTimer = this.time.addEvent({
      delay: 3000,
      startAt: 1500,
      loop: true,
      callback: () => {
        const allEnts = [this.player, ...this.allies, ...this.enemies];
        for (const ent of allEnts) {
          if (!ent.alive || !ent.sprite) continue;
          if (!ent.statusEffects.some(s => s.type === SkillEffect.Cursed)) continue;
          ent.sprite.setTint(0x331144);
          this.time.delayedCall(200, () => {
            if (ent.sprite && ent.alive) this.updateStatusTint(ent);
          });
        }
      },
    });
    this.statusFlashTimers.push(curseTimer);
  }

  // ── Stairs ──

  // ── Traps ──

  private checkTraps() {
    const ft = this.floorTraps.find(
      t => t.x === this.player.tileX && t.y === this.player.tileY && !t.triggered
    );
    if (!ft) return;

    sfxTrap();
    ft.triggered = true;
    ft.revealed = true;

    // Ability: Rock Head — immune to trap damage
    if (this.player.ability === AbilityId.RockHead) {
      this.showLog(`Stepped on a ${ft.trap.name}! Rock Head negated it!`);
      this.drawTrap(ft);
      this.updateHUD();
      return;
    }

    // Ability: Levitate — immune to ground-based traps (Spike, Warp, Blast, Sticky, Hunger)
    if (this.player.ability === AbilityId.Levitate &&
        (ft.trap.type === TrapType.Spike || ft.trap.type === TrapType.Warp || ft.trap.type === TrapType.Blast ||
         ft.trap.type === TrapType.Sticky || ft.trap.type === TrapType.Hunger)) {
      this.showLog(`Stepped on a ${ft.trap.name}! Levitate avoided it!`);
      this.drawTrap(ft);
      this.updateHUD();
      return;
    }

    this.showLog(`Stepped on a ${ft.trap.name}! ${ft.trap.description}`);
    this.cameras.main.shake(150, 0.008);

    switch (ft.trap.type) {
      case TrapType.Spike: {
        const dmg = Math.floor(this.player.stats.maxHp * 0.15);
        this.player.stats.hp = Math.max(1, this.player.stats.hp - dmg);
        if (this.player.sprite) this.showDamagePopup(this.player.sprite.x, this.player.sprite.y, dmg, 1.0);
        // Score chain: taking trap damage resets chain
        if (this.scoreChain.currentMultiplier > 1.0) {
          resetChain(this.scoreChain);
          this.showLog("Chain broken!");
          this.updateChainHUD();
        }
        this.checkPlayerDeath();
        break;
      }
      case TrapType.Poison:
        if (!this.player.statusEffects.some(s => s.type === SkillEffect.Burn)) {
          this.player.statusEffects.push({ type: SkillEffect.Burn, turnsLeft: 5 });
          this.showLog("You were burned!");
        }
        if (this.player.sprite) this.player.sprite.setTint(0xa855f7);
        this.time.delayedCall(300, () => { if (this.player.sprite) this.player.sprite.clearTint(); });
        break;
      case TrapType.Warp: {
        const { terrain, width, height, stairsPos } = this.dungeon;
        let wx: number, wy: number;
        let tries = 0;

        // Ability: RunAway — warp near stairs instead of random
        if (this.player.ability === AbilityId.RunAway) {
          const offsets = [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:1,y:-1},{x:1,y:1},{x:-1,y:1},{x:-1,y:-1}];
          let found = false;
          for (const off of offsets) {
            const tx = stairsPos.x + off.x;
            const ty = stairsPos.y + off.y;
            if (tx >= 0 && tx < width && ty >= 0 && ty < height &&
                terrain[ty][tx] === TerrainType.GROUND &&
                !this.allEntities.some(e => e !== this.player && e.alive && e.tileX === tx && e.tileY === ty)) {
              wx = tx; wy = ty; found = true; break;
            }
          }
          if (!found) { wx = stairsPos.x; wy = stairsPos.y; }
          this.showLog("Run Away warped you near the stairs!");
        } else {
          do {
            wx = Math.floor(Math.random() * width);
            wy = Math.floor(Math.random() * height);
            tries++;
          } while (tries < 200 && (terrain[wy][wx] !== TerrainType.GROUND ||
            this.allEntities.some(e => e !== this.player && e.alive && e.tileX === wx && e.tileY === wy)));
        }

        this.player.tileX = wx!;
        this.player.tileY = wy!;
        if (this.player.sprite) {
          this.player.sprite.setPosition(this.tileToPixelX(wx!), this.tileToPixelY(wy!));
        }
        this.cameras.main.flash(200, 100, 100, 255);
        break;
      }
      case TrapType.Spin: {
        // Confusion: reduce accuracy for 5 turns (shown as paralyze debuff)
        this.showLog("You got confused!");
        if (!this.player.statusEffects.some(s => s.type === SkillEffect.Paralyze)) {
          this.player.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 5 });
        }
        this.cameras.main.shake(200, 0.01);
        break;
      }
      case TrapType.Slowdown: {
        const reduction = Math.floor(this.player.stats.atk * 0.1);
        this.player.stats.atk = Math.max(1, this.player.stats.atk - reduction);
        this.showLog(`ATK reduced by ${reduction} for this floor!`);
        if (this.player.sprite) this.player.sprite.setTint(0xf97316);
        this.time.delayedCall(400, () => { if (this.player.sprite) this.player.sprite.clearTint(); });
        break;
      }
      case TrapType.Blast: {
        // Deal 25% max HP damage to player
        const blastDmg = Math.floor(this.player.stats.maxHp * 0.25);
        this.player.stats.hp = Math.max(1, this.player.stats.hp - blastDmg);
        if (this.player.sprite) this.showDamagePopup(this.player.sprite.x, this.player.sprite.y, blastDmg, 1.0);
        // Also damage nearby enemies/allies in 3x3 area
        for (const entity of this.allEntities) {
          if (entity === this.player || !entity.alive) continue;
          const dx = Math.abs(entity.tileX - ft.x);
          const dy = Math.abs(entity.tileY - ft.y);
          if (dx <= 1 && dy <= 1) {
            const entityDmg = Math.floor(entity.stats.maxHp * 0.25);
            entity.stats.hp = Math.max(1, entity.stats.hp - entityDmg);
            if (entity.sprite) this.showDamagePopup(entity.sprite.x, entity.sprite.y, entityDmg, 1.0);
            this.showLog(`${entity.name} was caught in the blast!`);
          }
        }
        // Visual: flash red
        this.cameras.main.flash(200, 255, 50, 50);
        this.checkPlayerDeath();
        break;
      }
      case TrapType.Trip:
        if (this.inventory.length > 0) {
          const lostIdx = Math.floor(Math.random() * this.inventory.length);
          const lost = this.inventory[lostIdx];
          this.showLog(`Dropped ${lost.item.name}!`);
          lost.count--;
          if (lost.count <= 0) this.inventory.splice(lostIdx, 1);
        } else {
          this.showLog("Nothing to drop!");
        }
        break;
      case TrapType.Seal: {
        const usableSkills = this.player.skills.filter(s => s.currentPp > 0);
        if (usableSkills.length > 0) {
          const skill = usableSkills[Math.floor(Math.random() * usableSkills.length)];
          skill.currentPp = 0;
          this.showLog(`${skill.name} was sealed!`);
          if (this.player.sprite) this.player.sprite.setTint(0x6366f1);
          this.time.delayedCall(400, () => { if (this.player.sprite) this.player.sprite.clearTint(); });
        } else {
          this.showLog("No skills to seal!");
        }
        break;
      }
      case TrapType.Sticky: {
        // Reduce belly by 5 as a simplified sticky penalty
        this.belly = Math.max(0, this.belly - 5);
        this.showLog("Sticky goo drains your energy! Belly -5!");
        if (this.player.sprite) this.player.sprite.setTint(0xf59e0b);
        this.time.delayedCall(400, () => { if (this.player.sprite) this.player.sprite.clearTint(); });
        break;
      }
      case TrapType.Hunger: {
        // Drain 20 belly instantly
        this.belly = Math.max(0, this.belly - 20);
        this.showLog("Extreme hunger strikes! Belly -20!");
        if (this.player.sprite) this.player.sprite.setTint(0x92400e);
        this.time.delayedCall(400, () => { if (this.player.sprite) this.player.sprite.clearTint(); });
        break;
      }
      case TrapType.Summon: {
        // Spawn 2 enemies around the player
        const summonSpeciesIds = (this.dungeonDef.id === "endlessDungeon" || this.dungeonDef.id === "dailyDungeon")
          ? this.getEndlessEnemies(this.currentFloor)
          : getDungeonFloorEnemies(this.dungeonDef, this.currentFloor);
        const summonSpecies = summonSpeciesIds.map(id => SPECIES[id]).filter(Boolean);
        if (summonSpecies.length > 0) {
          const adjOffsets = [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:1,y:-1},{x:1,y:1},{x:-1,y:1},{x:-1,y:-1}];
          let spawned = 0;
          for (const off of adjOffsets) {
            if (spawned >= 2) break;
            const sx = this.player.tileX + off.x;
            const sy = this.player.tileY + off.y;
            if (sx < 0 || sx >= this.dungeon.width || sy < 0 || sy >= this.dungeon.height) continue;
            if (this.dungeon.terrain[sy]?.[sx] !== TerrainType.GROUND) continue;
            if (this.allEntities.some(e => e.alive && e.tileX === sx && e.tileY === sy)) continue;
            const sp = summonSpecies[Math.floor(Math.random() * summonSpecies.length)];
            const summonStats = getEnemyStats(this.currentFloor, this.dungeonDef.difficulty, sp, this.ngPlusLevel);
            if (this.difficultyMods.enemyHpMult !== 1) {
              summonStats.hp = Math.floor(summonStats.hp * this.difficultyMods.enemyHpMult);
              summonStats.maxHp = Math.floor(summonStats.maxHp * this.difficultyMods.enemyHpMult);
            }
            if (this.difficultyMods.enemyAtkMult !== 1) {
              summonStats.atk = Math.floor(summonStats.atk * this.difficultyMods.enemyAtkMult);
            }
            const summonEnemy: Entity = {
              tileX: sx, tileY: sy,
              facing: Direction.Down,
              stats: { ...summonStats },
              alive: true,
              spriteKey: sp.spriteKey,
              name: sp.name,
              types: sp.types,
              attackType: sp.attackType,
              skills: createSpeciesSkills(sp),
              statusEffects: [],
              speciesId: sp.spriteKey,
              ability: SPECIES_ABILITIES[sp.spriteKey],
            };
            const seTex = `${sp.spriteKey}-idle`;
            if (this.textures.exists(seTex)) {
              summonEnemy.sprite = this.add.sprite(
                this.tileToPixelX(sx), this.tileToPixelY(sy), seTex
              );
              summonEnemy.sprite.setScale(TILE_SCALE).setDepth(9);
              const seAnim = `${sp.spriteKey}-idle-${Direction.Down}`;
              if (this.anims.exists(seAnim)) summonEnemy.sprite.play(seAnim);
            }
            this.enemies.push(summonEnemy);
            this.allEntities.push(summonEnemy);
            this.seenSpecies.add(sp.spriteKey);
            spawned++;
          }
          if (spawned > 0) {
            this.showLog(`${spawned} enemies appeared!`);
            this.cameras.main.flash(200, 255, 50, 50);
          } else {
            this.showLog("The trap fizzled...");
          }
        }
        break;
      }
      case TrapType.Grudge: {
        // Apply Cursed status for 8 turns
        if (!this.player.statusEffects.some(s => s.type === SkillEffect.Cursed)) {
          this.player.statusEffects.push({ type: SkillEffect.Cursed, turnsLeft: 8 });
          this.showLog("A dark curse falls upon you!");
        } else {
          this.showLog("The curse deepens...");
        }
        if (this.player.sprite) this.player.sprite.setTint(0x581c87);
        this.time.delayedCall(400, () => { if (this.player.sprite) this.player.sprite.clearTint(); });
        break;
      }
    }

    this.drawTrap(ft);
    this.updateHUD();
  }

  /** Draw a revealed trap marker as a small colored circle on the tile */
  private drawTrap(trap: FloorTrap) {
    if (!trap.revealed) return;
    const gfx = this.add.graphics();
    const cx = trap.x * TILE_DISPLAY + TILE_DISPLAY / 2;
    const cy = trap.y * TILE_DISPLAY + TILE_DISPLAY / 2;
    gfx.fillStyle(trap.trap.hexColor, 0.6);
    gfx.fillCircle(cx, cy, 4);
    gfx.setDepth(3);
    this.trapGraphics.push(gfx);
  }

  /** Reveal traps adjacent to the player (1 tile radius) */
  private revealNearbyTraps() {
    for (const trap of this.floorTraps) {
      if (trap.revealed) continue;
      const dx = Math.abs(trap.x - this.player.tileX);
      const dy = Math.abs(trap.y - this.player.tileY);
      if (dx <= 1 && dy <= 1) {
        trap.revealed = true;
        this.drawTrap(trap);
      }
    }
  }

  // ── Hazard Tiles ──

  /** Render all hazard tiles as colored semi-transparent rectangles with visual effects */
  private renderHazardTiles() {
    // Clean up any prior hazard graphics/tweens
    for (const gfx of this.hazardGraphics) gfx.destroy();
    for (const tw of this.hazardTweens) tw.destroy();
    this.hazardGraphics = [];
    this.hazardTweens = [];

    for (const hazard of this.floorHazards) {
      const gfx = this.add.graphics();
      const px = hazard.x * TILE_DISPLAY;
      const py = hazard.y * TILE_DISPLAY;

      gfx.fillStyle(hazard.def.color, 0.4);
      gfx.fillRect(px, py, TILE_DISPLAY, TILE_DISPLAY);
      gfx.setDepth(2); // Above floor theme overlay (1), below traps (3)
      this.hazardGraphics.push(gfx);

      // Per-hazard visual effect tweens
      switch (hazard.type) {
        case HazardType.Lava: {
          // Subtle pulsing orange glow
          const lavaT = this.tweens.add({
            targets: gfx,
            alpha: { from: 0.6, to: 1.0 },
            duration: 800 + Math.random() * 400,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
          this.hazardTweens.push(lavaT);
          break;
        }
        case HazardType.Water: {
          // Gentle blue shimmer
          const waterT = this.tweens.add({
            targets: gfx,
            alpha: { from: 0.5, to: 0.85 },
            duration: 1200 + Math.random() * 600,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
          this.hazardTweens.push(waterT);
          break;
        }
        case HazardType.ToxicSwamp: {
          // Bubbling animation: scale tween
          const swampT = this.tweens.add({
            targets: gfx,
            scaleX: { from: 1.0, to: 1.04 },
            scaleY: { from: 1.0, to: 1.04 },
            alpha: { from: 0.5, to: 0.8 },
            duration: 1000 + Math.random() * 800,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
            delay: Math.random() * 1000,
          });
          this.hazardTweens.push(swampT);
          break;
        }
        case HazardType.IcePatch: {
          // Static light blue with slight sparkle (gentle alpha oscillation)
          const iceT = this.tweens.add({
            targets: gfx,
            alpha: { from: 0.55, to: 0.75 },
            duration: 2000 + Math.random() * 1000,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
          this.hazardTweens.push(iceT);
          break;
        }
        case HazardType.Quicksand: {
          // Slow rotation-like effect (gentle alpha pulse to suggest movement)
          const qsT = this.tweens.add({
            targets: gfx,
            alpha: { from: 0.5, to: 0.8 },
            duration: 1500 + Math.random() * 500,
            yoyo: true,
            repeat: -1,
            ease: "Quad.easeInOut",
          });
          this.hazardTweens.push(qsT);
          break;
        }
        case HazardType.ElectricFloor: {
          // Rapid flicker (random alpha changes)
          const elecT = this.tweens.add({
            targets: gfx,
            alpha: { from: 0.3, to: 0.9 },
            duration: 200 + Math.random() * 200,
            yoyo: true,
            repeat: -1,
            ease: "Stepped",
          });
          this.hazardTweens.push(elecT);
          break;
        }
      }
    }
  }

  /**
   * Check if the player is standing on a hazard tile and apply its effects.
   * Called after player movement.
   */
  private checkPlayerHazard() {
    this.checkEntityHazard(this.player, true);
  }

  /**
   * Check if an entity is standing on a hazard tile and apply effects.
   * @param entity The entity to check
   * @param isPlayer Whether this is the player (for log messaging)
   */
  private checkEntityHazard(entity: Entity, isPlayer: boolean) {
    if (!entity.alive) return;

    const hazard = this.floorHazards.find(
      h => h.x === entity.tileX && h.y === entity.tileY
    );
    if (!hazard) return;

    const entityTypes = entity.types as PokemonType[];

    // Check immunity
    if (isImmuneToHazard(hazard.type, entityTypes)) {
      if (isPlayer) {
        this.showLog(`${entity.name} is immune to ${hazard.def.name}!`);
      }
      return;
    }

    // Show step message
    if (isPlayer) {
      this.showLog(`Stepped on ${hazard.def.name}!`);
    } else if (this.currentlyVisible[entity.tileY]?.[entity.tileX]) {
      this.showLog(`${entity.name} stepped on ${hazard.def.name}!`);
    }

    // Apply damage
    if (hazard.def.damage > 0) {
      entity.stats.hp = Math.max(1, entity.stats.hp - hazard.def.damage);
      if (entity.sprite) {
        this.showDamagePopup(entity.sprite.x, entity.sprite.y, hazard.def.damage, 1.0);
      }
      // Visual flash on the entity
      if (entity.sprite) {
        entity.sprite.setTint(hazard.def.color);
        this.time.delayedCall(300, () => {
          if (entity.sprite) entity.sprite.clearTint();
        });
      }
    }

    // Apply special effect
    const effectRoll = Math.random();
    if (effectRoll < hazard.def.effectChance) {
      switch (hazard.def.effect) {
        case "slow": {
          // Skip next turn: apply paralyze-like status for 1 turn
          if (!entity.statusEffects.some(s => s.type === SkillEffect.Paralyze)) {
            entity.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 1 });
            if (isPlayer) this.showLog("Slowed by water!");
          }
          break;
        }
        case "slide": {
          // Slide in movement direction until hitting wall/entity
          const dx = DIR_DX[entity.facing];
          const dy = DIR_DY[entity.facing];
          let slideX = entity.tileX;
          let slideY = entity.tileY;
          const { terrain, width, height } = this.dungeon;

          for (let step = 0; step < 5; step++) {
            const nx = slideX + dx;
            const ny = slideY + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) break;
            if (terrain[ny][nx] !== TerrainType.GROUND) break;
            // Check entity collision
            if (this.allEntities.some(e => e !== entity && e.alive && e.tileX === nx && e.tileY === ny)) break;
            slideX = nx;
            slideY = ny;
          }

          if (slideX !== entity.tileX || slideY !== entity.tileY) {
            entity.tileX = slideX;
            entity.tileY = slideY;
            if (entity.sprite) {
              entity.sprite.setPosition(
                this.tileToPixelX(slideX),
                this.tileToPixelY(slideY)
              );
            }
            if (isPlayer) {
              this.showLog("Slid on the ice!");
              this.cameras.main.flash(150, 170, 220, 255);
            }
          }
          break;
        }
        case "trap": {
          // Trapped — skip next turn
          if (!entity.statusEffects.some(s => s.type === SkillEffect.Paralyze)) {
            entity.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 1 });
            if (isPlayer) this.showLog("Trapped in quicksand!");
          }
          break;
        }
        case "poison": {
          // Chance of burn (poison-like) status
          if (!entity.statusEffects.some(s => s.type === SkillEffect.Burn)) {
            entity.statusEffects.push({ type: SkillEffect.Burn, turnsLeft: 5 });
            if (isPlayer) {
              this.showLog("Poisoned by toxic swamp!");
            } else if (this.currentlyVisible[entity.tileY]?.[entity.tileX]) {
              this.showLog(`${entity.name} was poisoned!`);
            }
            if (entity.sprite) {
              entity.sprite.setTint(0xa855f7);
              this.time.delayedCall(300, () => {
                if (entity.sprite) entity.sprite.clearTint();
              });
            }
          }
          break;
        }
        case "paralyze": {
          // Chance to inflict paralysis
          if (!entity.statusEffects.some(s => s.type === SkillEffect.Paralyze)) {
            entity.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 3 });
            if (isPlayer) {
              this.showLog("Paralyzed by electric floor!");
            } else if (this.currentlyVisible[entity.tileY]?.[entity.tileX]) {
              this.showLog(`${entity.name} was paralyzed!`);
            }
            if (entity.sprite) {
              entity.sprite.setTint(0xffee44);
              this.time.delayedCall(300, () => {
                if (entity.sprite) entity.sprite.clearTint();
              });
            }
          }
          break;
        }
      }
    }

    // Check death
    if (isPlayer) {
      this.checkPlayerDeath();
    } else if (entity.stats.hp <= 0) {
      entity.alive = false;
    }

    this.updateHUD();
  }

  // ── Belly (Hunger) ──

  private tickBelly() {
    if (this.belly > 0) {
      // Difficulty-based drain: higher difficulty = faster hunger, NG+ reduces drain
      const ngBellyMult = 1 - this.ngPlusBonuses.bellyDrainReduction / 100;
      const talentBellyMult = 1 - (this.talentEffects.bellyDrainReduction ?? 0) / 100;
      const blessingBellyMult = 1 + getBlessingEffect(this.activeBlessings, "bellyDrainMult");
      // FamineFloor: belly drains 2x faster
      const famineFloorMult = this.floorEvent?.type === FloorEventType.FamineFloor ? 2.0 : 1.0;
      const drainRate = (0.5 + this.dungeonDef.difficulty * 0.1) * this.difficultyMods.bellyDrainMult * ngBellyMult * talentBellyMult * blessingBellyMult * famineFloorMult;
      const prevBelly = this.belly;
      this.belly = Math.max(0, this.belly - drainRate);

      if (this.belly <= 0) {
        // Just hit 0 this tick
        this.belly = 0;
        this.showLog("Your belly is empty! HP will drain each turn!");
        this.bellyWarningShown = true;
        this.bellyUrgentShown = true;
      } else if (this.belly <= this.maxBelly * 0.1 && !this.bellyUrgentShown) {
        // Urgent warning at 10%
        this.showLog("You're starving! Find food quickly!");
        this.bellyUrgentShown = true;
      } else if (this.belly <= this.maxBelly * 0.2 && prevBelly > this.maxBelly * 0.2 && !this.bellyWarningShown) {
        // Warning at 20%
        this.showLog("Your belly is getting empty...");
        this.bellyWarningShown = true;
      }
    } else {
      // Starving: lose HP based on max HP (min 1, ~2% of maxHp)
      const starveDmg = Math.max(1, Math.floor(this.player.stats.maxHp * 0.02));
      this.player.stats.hp = Math.max(0, this.player.stats.hp - starveDmg);
      if (this.player.sprite) this.showDamagePopup(this.player.sprite.x, this.player.sprite.y, starveDmg, 0.5);
      // Show periodic reminders
      if (this.turnManager.turn % 5 === 0) {
        this.showLog(`Starving! Took ${starveDmg} damage!`);
      }
      this.checkPlayerDeath();
    }
  }

  /** Reset belly warning flags (call when belly is restored by food) */
  private resetBellyWarnings() {
    if (this.belly > this.maxBelly * 0.2) {
      this.bellyWarningShown = false;
      this.bellyUrgentShown = false;
    } else if (this.belly > this.maxBelly * 0.1) {
      this.bellyUrgentShown = false;
    }
  }

  // ── Weather Tick ──

  private tickWeather() {
    this.floorTurns++;

    // Score chain: tick idle counter if no scoring action happened this turn
    if (!this.chainActionThisTurn && this.scoreChain.currentMultiplier > 1.0) {
      const wasReset = tickChainIdle(this.scoreChain);
      if (wasReset) {
        this.showLog("Chain expired (idle).");
        this.updateChainHUD();
      }
    }
    this.chainActionThisTurn = false; // reset for next turn

    // ── Floor Mutation: RegenFloor — heal 1 HP every N turns ──
    if (hasMutation(this.floorMutations, MutationType.RegenFloor) && this.player.alive) {
      const interval = getMutationEffect(MutationType.RegenFloor, "regenInterval") || 3;
      const amount = getMutationEffect(MutationType.RegenFloor, "regenAmount") || 1;
      if (this.floorTurns > 0 && this.floorTurns % interval === 0 && this.player.stats.hp < this.player.stats.maxHp) {
        this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + amount);
        if (this.player.sprite) {
          this.showDamagePopup(this.player.sprite.x, this.player.sprite.y, 0, 1, `+${amount} Regen`);
        }
      }
    }

    // ── Relic: Regeneration (Life Dew / Leftovers) ──
    if (this.player.alive && (this.relicEffects.regenAmount ?? 0) > 0 && (this.relicEffects.regenInterval ?? 0) > 0) {
      const relicRegenInterval = this.relicEffects.regenInterval;
      const relicRegenAmount = this.relicEffects.regenAmount;
      if (this.floorTurns > 0 && this.floorTurns % relicRegenInterval === 0 && this.player.stats.hp < this.player.stats.maxHp) {
        this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + relicRegenAmount);
        if (this.player.sprite) {
          this.showDamagePopup(this.player.sprite.x, this.player.sprite.y, 0, 1, `+${relicRegenAmount} Relic`);
        }
      }
    }

    // ── Blessing: Nature's Grace — regen HP every N turns ──
    const bRegenAmt = getBlessingEffect(this.activeBlessings, "regenAmount");
    const bRegenInt = getBlessingEffect(this.activeBlessings, "regenInterval") || 5;
    if (bRegenAmt > 0 && this.player.alive && this.floorTurns > 0 && this.floorTurns % bRegenInt === 0 && this.player.stats.hp < this.player.stats.maxHp) {
      this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + bRegenAmt);
      if (this.player.sprite) {
        this.showDamagePopup(this.player.sprite.x, this.player.sprite.y, 0, 1, `+${bRegenAmt} Grace`);
      }
    }

    // ── Floor Mutation: CursedFloor — lose 1 HP every N turns ──
    if (hasMutation(this.floorMutations, MutationType.CursedFloor) && this.player.alive) {
      const interval = getMutationEffect(MutationType.CursedFloor, "curseInterval") || 10;
      const amount = getMutationEffect(MutationType.CursedFloor, "curseDamage") || 1;
      if (this.floorTurns > 0 && this.floorTurns % interval === 0) {
        this.player.stats.hp = Math.max(1, this.player.stats.hp - amount);
        if (this.player.sprite) {
          this.showDamagePopup(this.player.sprite.x, this.player.sprite.y, amount, 0.5, "Curse");
        }
        this.showLog("The curse saps your strength!");
        this.checkPlayerDeath();
      }
    }

    // Check mid-floor weather transition every 10 turns
    if (this.floorTurns % 10 === 0 && this.currentWeather !== WeatherType.None) {
      this.checkWeatherTransition();
    }

    if (this.currentWeather === WeatherType.None || this.currentWeather === WeatherType.Rain) return;
    const BASE_WEATHER_DMG = 5;
    const intensityMult = INTENSITY_MULTIPLIER[this.currentWeatherIntensity];
    const WEATHER_DMG = Math.max(1, Math.floor(BASE_WEATHER_DMG * intensityMult));

    // Apply chip damage to all entities not immune
    for (const entity of this.allEntities) {
      if (!entity.alive) continue;
      if (isWeatherImmune(this.currentWeather, entity.types)) continue;

      entity.stats.hp = Math.max(0, entity.stats.hp - WEATHER_DMG);
      if (entity.sprite) {
        this.showDamagePopup(entity.sprite.x, entity.sprite.y, WEATHER_DMG, 0.5);
      }
      if (entity === this.player) {
        this.checkPlayerDeath();
      } else if (entity.stats.hp <= 0) {
        this.checkDeath(entity);
      }
    }
  }

  /** Check and perform a mid-floor weather transition */
  private checkWeatherTransition() {
    if (!shouldWeatherTransition(this.currentFloor)) return;
    const newWeather = rollFloorWeather(this.dungeonDef.id, this.currentFloor);
    if (newWeather === this.currentWeather) return; // no change

    this.currentWeather = newWeather;
    this.showLog("The weather changed!");

    // Update weather text HUD
    if (this.currentWeather !== WeatherType.None) {
      const wd = WEATHERS[this.currentWeather];
      const intLabel = this.currentWeatherIntensity;
      this.weatherText.setText(`${wd.symbol} ${wd.name} (${intLabel}): ${wd.description}`);
      this.weatherText.setColor(INTENSITY_COLOR[this.currentWeatherIntensity]);
      sfxWeatherChange();
      this.showLog(`The weather is now ${wd.name} (${intLabel})!`);
      // Run log: weather changed mid-floor
      this.runLog.add(RunLogEvent.WeatherChanged, wd.name, this.currentFloor, this.turnManager.turn);
    } else {
      this.weatherText.setText("");
    }

    // Update the compact HUD indicator
    if (this.weatherIntensityHudText) {
      this.weatherIntensityHudText.destroy();
      this.weatherIntensityHudText = null;
    }
    if (this.currentWeather !== WeatherType.None) {
      const weatherNames: Record<string, string> = {
        [WeatherType.Rain]: "Rain",
        [WeatherType.Sandstorm]: "Sandstorm",
        [WeatherType.Hail]: "Hail",
      };
      const intLabel = this.currentWeatherIntensity;
      this.weatherIntensityHudText = this.add.text(GAME_WIDTH - 10, 55,
        `${weatherNames[this.currentWeather]} (${intLabel})`, {
        fontSize: "8px", color: INTENSITY_COLOR[this.currentWeatherIntensity], fontFamily: "monospace",
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

      // Flash effect on weather change
      this.weatherIntensityHudText.setAlpha(0);
      this.tweens.add({
        targets: this.weatherIntensityHudText,
        alpha: { from: 0, to: 1 },
        duration: 300,
        yoyo: true,
        repeat: 2,
        onComplete: () => { if (this.weatherIntensityHudText) this.weatherIntensityHudText.setAlpha(1); },
      });
    }

    // Rebuild weather visuals
    this.setupWeatherVisuals();
  }

  private checkPlayerDeath() {
    if (this.player.stats.hp <= 0 && this.player.alive) {
      if (this.tryRevive()) return;
      this.player.alive = false;
      this.showGameOver();
    }
  }

  // ── Weather Visuals ──

  private clearWeatherVisuals() {
    if (this.weatherOverlay) { this.weatherOverlay.destroy(); this.weatherOverlay = null; }
    if (this.weatherParticles) { this.weatherParticles.destroy(); this.weatherParticles = null; }
    if (this.weatherTimer) { this.weatherTimer.destroy(); this.weatherTimer = null; }
  }

  private setupWeatherVisuals() {
    this.clearWeatherVisuals();
    if (this.currentWeather === WeatherType.None) return;

    switch (this.currentWeather) {
      case WeatherType.Rain: {
        // Blue-tinted overlay
        this.weatherOverlay = this.add.rectangle(
          GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT,
          0x3b82f6, 0.06
        ).setScrollFactor(0).setDepth(150);

        // Rain particle effect
        const gfx = this.add.graphics().setScrollFactor(0).setDepth(150);
        this.weatherParticles = gfx;
        this.weatherTimer = this.time.addEvent({
          delay: 80,
          loop: true,
          callback: () => {
            gfx.clear();
            gfx.lineStyle(1, 0x6390f0, 0.3);
            for (let i = 0; i < 40; i++) {
              const x = Math.random() * GAME_WIDTH;
              const y = Math.random() * GAME_HEIGHT;
              gfx.lineBetween(x, y, x - 3, y + 12);
            }
          },
        });
        break;
      }
      case WeatherType.Sandstorm: {
        // Brown/sepia overlay
        this.weatherOverlay = this.add.rectangle(
          GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT,
          0xd4a574, 0.08
        ).setScrollFactor(0).setDepth(150);

        // Sand particles blowing horizontally
        const gfx = this.add.graphics().setScrollFactor(0).setDepth(150);
        this.weatherParticles = gfx;
        this.weatherTimer = this.time.addEvent({
          delay: 100,
          loop: true,
          callback: () => {
            gfx.clear();
            gfx.fillStyle(0xd4a843, 0.15);
            for (let i = 0; i < 30; i++) {
              const x = Math.random() * GAME_WIDTH;
              const y = Math.random() * GAME_HEIGHT;
              gfx.fillCircle(x, y, 1 + Math.random() * 2);
            }
          },
        });
        break;
      }
      case WeatherType.Hail: {
        // White/light blue overlay
        this.weatherOverlay = this.add.rectangle(
          GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT,
          0x93c5fd, 0.06
        ).setScrollFactor(0).setDepth(150);

        // Hail particles (small white dots)
        const gfx = this.add.graphics().setScrollFactor(0).setDepth(150);
        this.weatherParticles = gfx;
        this.weatherTimer = this.time.addEvent({
          delay: 120,
          loop: true,
          callback: () => {
            gfx.clear();
            gfx.fillStyle(0xffffff, 0.25);
            for (let i = 0; i < 25; i++) {
              const x = Math.random() * GAME_WIDTH;
              const y = Math.random() * GAME_HEIGHT;
              gfx.fillCircle(x, y, 1 + Math.random());
            }
          },
        });
        break;
      }
    }
  }

  // ── Stairs ──

  private checkStairs() {
    const { stairsPos } = this.dungeon;
    if (this.player.tileX === stairsPos.x && this.player.tileY === stairsPos.y) {
      // Block stairs if boss is alive (but allow flee from legendary encounters)
      if (this.bossEntity && this.bossEntity.alive) {
        this.showLog("The stairs are sealed! Defeat the boss first!");
        return;
      }
      // Block stairs during gauntlet
      if (this.gauntletStairsLocked) {
        this.showLog("The stairs are sealed! Clear the gauntlet first!");
        return;
      }
      // Legendary encounter: player can flee (use stairs) with no reward
      if (this.legendaryEntity && this.legendaryEntity.alive) {
        this.showLog("The legendary Pokemon disappeared...");
        // Clean up legendary entity visuals
        if (this.legendaryEntity.sprite) this.legendaryEntity.sprite.destroy();
        this.legendaryEntity.alive = false;
        this.legendaryEntity = null;
        this.legendaryEncounter = null;
        if (this.legendaryHpBg) { this.legendaryHpBg.setVisible(false); }
        if (this.legendaryHpBar) { this.legendaryHpBar.setVisible(false); }
        if (this.legendaryNameText) { this.legendaryNameText.setVisible(false); }
        if (this.legendaryParticleTimer) { this.legendaryParticleTimer.destroy(); this.legendaryParticleTimer = null; }
        if (this.legendaryParticleGraphics) { this.legendaryParticleGraphics.destroy(); this.legendaryParticleGraphics = null; }
      }
      this.advanceFloor();
    }
  }

  private checkShop() {
    if (!this.shopRoom || this.shopOpen || this.shopClosed) return;
    const r = this.shopRoom;
    const px = this.player.tileX;
    const py = this.player.tileY;
    const inShop = px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;

    if (inShop && !this.playerInShopRoom) {
      // Player just entered the shop room
      this.playerInShopRoom = true;
      if (!this.shopWelcomeShown) {
        this.shopWelcomeShown = true;
        this.showLog("Welcome to the Shop!");
        // Run log: shop visited
        this.runLog.add(RunLogEvent.ShopVisited, "Kecleon Shop", this.currentFloor, this.turnManager.turn);
        sfxShop();
      }
      if (this.shopItems.length > 0) {
        this.showLog(`Gold: ${this.gold}G. Step on items to buy!`);
      }
      // Show gold HUD
      this.showShopGoldHud();
    } else if (!inShop && this.playerInShopRoom) {
      // Player just left the shop room — check for theft
      this.playerInShopRoom = false;
      this.hideShopGoldHud();
      this.checkShopTheft();
    }

    // Step-on-item buy prompt
    if (inShop) {
      const shopTile = this.shopTiles.find(st => st.x === px && st.y === py);
      if (shopTile) {
        const si = this.shopItems[shopTile.shopIdx];
        if (si) {
          const itemDef = ITEM_DB[si.itemId];
          if (itemDef) {
            this.showShopBuyPrompt(shopTile.shopIdx);
          }
        }
      }
      // Update gold HUD
      this.updateShopGoldHud();
    }
  }

  /** Show prominent gold balance when in shop room */
  private showShopGoldHud() {
    this.hideShopGoldHud();
    this.shopGoldHud = this.add.text(GAME_WIDTH / 2, 50, `Gold: ${this.gold}G`, {
      fontSize: "12px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
      backgroundColor: "#1a1a2ecc", padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(105);
  }

  private updateShopGoldHud() {
    if (this.shopGoldHud) {
      this.shopGoldHud.setText(`Gold: ${this.gold}G`);
    }
  }

  private hideShopGoldHud() {
    if (this.shopGoldHud) {
      this.shopGoldHud.destroy();
      this.shopGoldHud = null;
    }
  }

  /** Check if the player took items from the shop without paying (anti-theft) */
  private checkShopTheft() {
    if (this.shopTheftTriggered || this.shopClosed) return;
    // not implemented as walking-out-with-item since items use the buy prompt system
    // Theft only triggers if player picked up a shop item using the floor pickup action
    // (This is checked in pickupItem)
  }

  /** Spawn anti-theft security enemies at shop room exits */
  private triggerShopTheft() {
    if (this.shopTheftTriggered) return;
    this.shopTheftTriggered = true;
    this.shopClosed = true;

    // Big warning text
    this.showLog("Stop, thief!");
    this.cameras.main.shake(300, 0.015);
    this.cameras.main.flash(200, 255, 0, 0);

    const warningText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "Stop, thief!", {
      fontSize: "22px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300);
    this.tweens.add({
      targets: warningText,
      y: GAME_HEIGHT / 2 - 80,
      alpha: { from: 1, to: 0 },
      scaleX: { from: 1, to: 1.3 },
      scaleY: { from: 1, to: 1.3 },
      duration: 2000,
      ease: "Quad.easeOut",
      onComplete: () => warningText.destroy(),
    });

    // Spawn 2-3 powerful security enemies at room exits
    const r = this.shopRoom!;
    const terrain = this.dungeon.terrain;
    const width = this.dungeon.width;
    const height = this.dungeon.height;
    const securityLevel = this.player.stats.level + 5;
    const securityCount = 2 + Math.floor(Math.random() * 2); // 2-3
    const exitTiles: { x: number; y: number }[] = [];

    // Find exit tiles: ground tiles just outside the room borders
    for (let x = r.x; x < r.x + r.w; x++) {
      // Top edge exit
      if (r.y - 1 >= 0 && terrain[r.y - 1][x] === TerrainType.GROUND) exitTiles.push({ x, y: r.y - 1 });
      // Bottom edge exit
      if (r.y + r.h < height && terrain[r.y + r.h][x] === TerrainType.GROUND) exitTiles.push({ x, y: r.y + r.h });
    }
    for (let y = r.y; y < r.y + r.h; y++) {
      // Left edge exit
      if (r.x - 1 >= 0 && terrain[y][r.x - 1] === TerrainType.GROUND) exitTiles.push({ x: r.x - 1, y });
      // Right edge exit
      if (r.x + r.w < width && terrain[y][r.x + r.w] === TerrainType.GROUND) exitTiles.push({ x: r.x + r.w, y });
    }

    // Deduplicate and filter occupied tiles
    const uniqueExits = exitTiles.filter((t, i, arr) =>
      arr.findIndex(e => e.x === t.x && e.y === t.y) === i &&
      !this.allEntities.some(e => e.alive && e.tileX === t.x && e.tileY === t.y)
    );

    // Spawn enemies at up to securityCount exits
    const floorSpeciesIds = getDungeonFloorEnemies(this.dungeonDef, this.currentFloor);
    const floorSpecies = floorSpeciesIds.map(id => SPECIES[id]).filter(Boolean);
    const securitySpecies = floorSpecies.length > 0 ? floorSpecies[0] : SPECIES.zubat;

    for (let i = 0; i < Math.min(securityCount, uniqueExits.length); i++) {
      const pos = uniqueExits[i];
      const secStats = {
        hp: Math.floor(securitySpecies.baseStats.hp * 3),
        maxHp: Math.floor(securitySpecies.baseStats.hp * 3),
        atk: Math.floor(securitySpecies.baseStats.atk * 2.5),
        def: Math.floor(securitySpecies.baseStats.def * 2),
        level: securityLevel,
      };

      const enemy: Entity = {
        tileX: pos.x, tileY: pos.y,
        facing: Direction.Down,
        stats: secStats,
        alive: true,
        spriteKey: securitySpecies.spriteKey,
        name: `Security ${securitySpecies.name}`,
        types: securitySpecies.types,
        attackType: securitySpecies.attackType,
        skills: createSpeciesSkills(securitySpecies),
        statusEffects: [],
        speciesId: securitySpecies.spriteKey,
        ability: SPECIES_ABILITIES[securitySpecies.spriteKey],
      };
      const eTex = `${securitySpecies.spriteKey}-idle`;
      if (this.textures.exists(eTex)) {
        enemy.sprite = this.add.sprite(
          this.tileToPixelX(pos.x), this.tileToPixelY(pos.y), eTex
        );
        enemy.sprite.setScale(TILE_SCALE).setDepth(9);
        // Red tint for security
        enemy.sprite.setTint(0xff4444);
        const eAnim = `${securitySpecies.spriteKey}-idle-${Direction.Down}`;
        if (this.anims.exists(eAnim)) enemy.sprite.play(eAnim);
      }
      this.enemies.push(enemy);
      this.allEntities.push(enemy);
    }

    // Remove shop visuals (carpet, item sprites, price tags)
    this.clearShopVisuals();
    this.hideShopGoldHud();
  }

  /** Remove all shop visual elements */
  private clearShopVisuals() {
    for (const st of this.shopTiles) {
      st.sprite.destroy();
      st.priceTag.destroy();
    }
    this.shopTiles = [];
    if (this.shopCarpet) {
      this.shopCarpet.destroy();
      this.shopCarpet = null;
    }
  }

  /** Show buy prompt overlay when player steps on a shop item */
  private showShopBuyPrompt(shopIdx: number) {
    if (this.shopOpen || this.shopClosed) return;
    const si = this.shopItems[shopIdx];
    if (!si) return;
    const itemDef = ITEM_DB[si.itemId];
    if (!itemDef) return;

    sfxShop();
    this.shopOpen = true;

    // Semi-transparent dark background
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(200).setInteractive();
    this.shopUI.push(overlay);

    // Prompt box
    const boxW = 260;
    const boxH = 120;
    const boxX = (GAME_WIDTH - boxW) / 2;
    const boxY = (GAME_HEIGHT - boxH) / 2;
    const box = this.add.graphics().setScrollFactor(0).setDepth(201);
    box.fillStyle(0x1a1a2e, 0.95);
    box.fillRoundedRect(boxX, boxY, boxW, boxH, 8);
    box.lineStyle(2, 0xfbbf24, 1);
    box.strokeRoundedRect(boxX, boxY, boxW, boxH, 8);
    this.shopUI.push(box);

    // Item name and price
    const nameText = this.add.text(GAME_WIDTH / 2, boxY + 18, `${itemDef.name} - ${si.price}G`, {
      fontSize: "13px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    this.shopUI.push(nameText);

    // Description
    const descText = this.add.text(GAME_WIDTH / 2, boxY + 38, itemDef.description, {
      fontSize: "9px", color: "#aaaaaa", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    this.shopUI.push(descText);

    // "Buy?" label
    const buyLabel = this.add.text(GAME_WIDTH / 2, boxY + 58, "Buy?", {
      fontSize: "11px", color: "#e0e0e0", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    this.shopUI.push(buyLabel);

    const canBuy = this.gold >= si.price;

    // Yes button
    const yesBtn = this.add.text(GAME_WIDTH / 2 - 50, boxY + 80, "[Yes]", {
      fontSize: "13px", color: canBuy ? "#4ade80" : "#666666", fontFamily: "monospace",
      backgroundColor: "#2a2a4e", padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202).setInteractive();
    this.shopUI.push(yesBtn);

    if (canBuy) {
      yesBtn.on("pointerdown", () => {
        this.buyShopItemNew(shopIdx);
        this.closeShopUI();
      });
    } else {
      yesBtn.on("pointerdown", () => {
        this.showLog("Not enough gold!");
        this.closeShopUI();
      });
    }

    // No button
    const noBtn = this.add.text(GAME_WIDTH / 2 + 50, boxY + 80, "[No]", {
      fontSize: "13px", color: "#ef4444", fontFamily: "monospace",
      backgroundColor: "#2a2a4e", padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202).setInteractive();
    this.shopUI.push(noBtn);
    noBtn.on("pointerdown", () => this.closeShopUI());
  }

  /** Buy an item from the step-on shop system */
  private buyShopItemNew(shopIdx: number) {
    const si = this.shopItems[shopIdx];
    if (!si || this.gold < si.price) return;
    const itemDef = ITEM_DB[si.itemId];
    if (!itemDef) return;

    // Check inventory space
    if (this.inventory.length >= MAX_INVENTORY) {
      const existing = this.inventory.find(s => s.item.id === si.itemId && itemDef.stackable);
      if (!existing) {
        this.showLog("Bag is full! Can't buy.");
        return;
      }
    }

    // Deduct gold
    this.gold -= si.price;

    // Add to inventory
    const existing = this.inventory.find(s => s.item.id === si.itemId && itemDef.stackable);
    if (existing) {
      existing.count++;
    } else {
      this.inventory.push({ item: itemDef, count: 1 });
    }
    this.showLog(`Bought ${itemDef.name} for ${si.price}G!`);

    // Decrease stock
    si.stock--;
    if (si.stock <= 0) {
      // Remove from shop — find and destroy the tile sprite
      const tileIdx = this.shopTiles.findIndex(st => st.shopIdx === shopIdx);
      if (tileIdx >= 0) {
        this.shopTiles[tileIdx].sprite.destroy();
        this.shopTiles[tileIdx].priceTag.destroy();
        this.shopTiles.splice(tileIdx, 1);
      }
      // Mark item as empty (set price to 0 to indicate sold out)
      this.shopItems[shopIdx] = { itemId: "", price: 0, stock: 0 };
    }

    this.updateHUD();
    this.updateShopGoldHud();
  }

  private checkMonsterHouse() {
    if (!this.monsterHouseRoom || this.monsterHouseTriggered) return;
    const r = this.monsterHouseRoom;
    const px = this.player.tileX;
    const py = this.player.tileY;
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) {
      this.monsterHouseTriggered = true;

      // Type-specific warning colors and messages
      const typeConfig: Record<MonsterHouseType, { color: string, hexColor: number, label: string, flashR: number, flashG: number, flashB: number }> = {
        [MonsterHouseType.Standard]: { color: "#ff4444", hexColor: 0xff4444, label: "Monster House!", flashR: 255, flashG: 0, flashB: 0 },
        [MonsterHouseType.Treasure]: { color: "#ffd700", hexColor: 0xffd700, label: "Treasure House!", flashR: 255, flashG: 215, flashB: 0 },
        [MonsterHouseType.Ambush]: { color: "#bb44ff", hexColor: 0xbb44ff, label: "Ambush House!", flashR: 187, flashG: 68, flashB: 255 },
      };
      const cfg = typeConfig[this.monsterHouseType];

      // Camera shake (stronger for Ambush)
      const shakeIntensity = this.monsterHouseType === MonsterHouseType.Ambush ? 0.02 : 0.01;
      this.cameras.main.shake(400, shakeIntensity);
      this.cameras.main.flash(250, cfg.flashR, cfg.flashG, cfg.flashB);

      // Big warning text popup (centered, fades out)
      const warningText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, cfg.label, {
        fontSize: "24px", color: cfg.color, fontFamily: "monospace", fontStyle: "bold",
        stroke: "#000000", strokeThickness: 4,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(300);
      this.tweens.add({
        targets: warningText,
        y: GAME_HEIGHT / 2 - 80,
        alpha: { from: 1, to: 0 },
        scaleX: { from: 1, to: 1.3 },
        scaleY: { from: 1, to: 1.3 },
        duration: 2000,
        ease: "Quad.easeOut",
        onComplete: () => warningText.destroy(),
      });

      this.showLog(`It's a ${cfg.label}`);

      // Determine enemy count based on type + dungeon difficulty scaling
      const diffScale = 1 + (this.currentFloor - 3) * 0.15; // extra enemies on deeper floors
      let baseMin: number, baseMax: number;
      switch (this.monsterHouseType) {
        case MonsterHouseType.Standard:  baseMin = 3; baseMax = 5; break;
        case MonsterHouseType.Treasure:  baseMin = 5; baseMax = 8; break;
        case MonsterHouseType.Ambush:    baseMin = 4; baseMax = 6; break;
      }
      const scaledMin = Math.floor(baseMin * diffScale);
      const scaledMax = Math.floor(baseMax * diffScale);
      const count = scaledMin + Math.floor(Math.random() * (scaledMax - scaledMin + 1));

      const floorSpeciesIds = (this.dungeonDef.id === "endlessDungeon" || this.dungeonDef.id === "dailyDungeon")
        ? this.getEndlessEnemies(this.currentFloor)
        : getDungeonFloorEnemies(this.dungeonDef, this.currentFloor);
      const floorSpecies = floorSpeciesIds.map(id => SPECIES[id]).filter(Boolean);
      if (floorSpecies.length === 0) return;

      // Difficulty multiplier for monster house enemies
      const diffMult = this.monsterHouseType === MonsterHouseType.Ambush ? 1.3 : 1.2;

      this.monsterHouseEnemies = [];

      for (let i = 0; i < count; i++) {
        const ex = r.x + 1 + Math.floor(Math.random() * Math.max(1, r.w - 2));
        const ey = r.y + 1 + Math.floor(Math.random() * Math.max(1, r.h - 2));
        if (this.dungeon.terrain[ey]?.[ex] !== TerrainType.GROUND) continue;
        if (this.allEntities.some(e => e.alive && e.tileX === ex && e.tileY === ey)) continue;

        const sp = floorSpecies[Math.floor(Math.random() * floorSpecies.length)];
        const enemyStats = getEnemyStats(this.currentFloor, this.dungeonDef.difficulty * diffMult, sp, this.ngPlusLevel);

        // Apply difficulty setting modifiers to monster house enemies
        if (this.difficultyMods.enemyHpMult !== 1) {
          enemyStats.hp = Math.floor(enemyStats.hp * this.difficultyMods.enemyHpMult);
          enemyStats.maxHp = Math.floor(enemyStats.maxHp * this.difficultyMods.enemyHpMult);
        }
        if (this.difficultyMods.enemyAtkMult !== 1) {
          enemyStats.atk = Math.floor(enemyStats.atk * this.difficultyMods.enemyAtkMult);
        }

        const enemy: Entity = {
          tileX: ex, tileY: ey,
          facing: Direction.Down,
          stats: { ...enemyStats },
          alive: true,
          spriteKey: sp.spriteKey,
          name: sp.name,
          types: sp.types,
          attackType: sp.attackType,
          skills: createSpeciesSkills(sp),
          statusEffects: [],
          speciesId: sp.spriteKey,
          ability: SPECIES_ABILITIES[sp.spriteKey],
        };
        const eTex = `${sp.spriteKey}-idle`;
        if (this.textures.exists(eTex)) {
          enemy.sprite = this.add.sprite(
            this.tileToPixelX(ex), this.tileToPixelY(ey), eTex
          );
          enemy.sprite.setScale(TILE_SCALE).setDepth(9);
          const eAnim = `${sp.spriteKey}-idle-${Direction.Down}`;
          if (this.anims.exists(eAnim)) enemy.sprite.play(eAnim);

          // Ambush type: enemies start invisible (alpha 0), then fade in on trigger
          if (this.monsterHouseType === MonsterHouseType.Ambush) {
            enemy.sprite.setAlpha(0);
            this.tweens.add({
              targets: enemy.sprite,
              alpha: 1,
              duration: 600,
              delay: 200 + i * 100,
              ease: "Power2",
            });
          }
        }
        this.enemies.push(enemy);
        this.allEntities.push(enemy);
        this.monsterHouseEnemies.push(enemy);
        this.seenSpecies.add(sp.id); // Pokedex tracking
      }

      // Also track any enemies already in the room before trigger as monster house enemies
      for (const e of this.enemies) {
        if (e.alive && !this.monsterHouseEnemies.includes(e) &&
            e.tileX >= r.x && e.tileX < r.x + r.w &&
            e.tileY >= r.y && e.tileY < r.y + r.h) {
          this.monsterHouseEnemies.push(e);
        }
      }
    }
  }

  /** Check if all monster house enemies are defeated, then reward */
  private checkMonsterHouseCleared() {
    if (!this.monsterHouseRoom || !this.monsterHouseTriggered || this.monsterHouseCleared) return;
    if (this.monsterHouseEnemies.length === 0) return;

    // Check if all monster house enemies are dead
    const allDefeated = this.monsterHouseEnemies.every(e => !e.alive);
    if (!allDefeated) return;

    this.monsterHouseCleared = true;

    // "Monster House Cleared!" popup
    const clearColor = this.monsterHouseType === MonsterHouseType.Treasure ? "#ffd700"
      : this.monsterHouseType === MonsterHouseType.Ambush ? "#bb44ff" : "#4ade80";
    const clearText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "Monster House Cleared!", {
      fontSize: "20px", color: clearColor, fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300);
    this.tweens.add({
      targets: clearText,
      y: GAME_HEIGHT / 2 - 80,
      alpha: { from: 1, to: 0 },
      scaleX: { from: 1, to: 1.2 },
      scaleY: { from: 1, to: 1.2 },
      duration: 2500,
      ease: "Quad.easeOut",
      onComplete: () => clearText.destroy(),
    });

    // Rewards based on type
    const r = this.monsterHouseRoom;
    switch (this.monsterHouseType) {
      case MonsterHouseType.Standard: {
        // 1 random item drop
        this.spawnMonsterHouseRewardItems(r, 1);
        this.showLog("Monster House cleared! A reward appeared!");
        break;
      }
      case MonsterHouseType.Treasure: {
        // 3-5 item drops + bonus gold (2x gold bonus)
        const itemCount = 3 + Math.floor(Math.random() * 3);
        this.spawnMonsterHouseRewardItems(r, itemCount);
        const mutGoldMult = hasMutation(this.floorMutations, MutationType.GoldenAge) ? getMutationEffect(MutationType.GoldenAge, "goldMult") : 1;
        const bonusGold = Math.floor((20 + this.currentFloor * 10) * 2 * mutGoldMult);
        this.gold += bonusGold;
        const meta = loadMeta();
        meta.gold = this.gold;
        saveMeta(meta);
        this.showLog(`Treasure House cleared! +${bonusGold}G and items!`);
        break;
      }
      case MonsterHouseType.Ambush: {
        // 2 item drops + EXP bonus
        this.spawnMonsterHouseRewardItems(r, 2);
        const heldExpMult = 1 + (this.heldItemEffect.expBonus ?? 0) / 100;
        const ngExpMultAmb = 1 + this.ngPlusBonuses.expPercent / 100;
        const expBonus = Math.floor((15 + this.currentFloor * 8) * this.modifierEffects.expMult * heldExpMult * ngExpMultAmb);
        this.totalExp += expBonus;
        // Process potential level ups from bonus EXP
        const levelResult = processLevelUp(this.player.stats, 0, this.totalExp);
        this.totalExp = levelResult.totalExp;
        this.showLog(`Ambush House survived! +${expBonus} EXP bonus!`);
        break;
      }
    }

    sfxVictory();
    this.cameras.main.flash(300, 200, 255, 200);

    // Score chain: monster house clear
    {
      const mhBonus = addChainAction(this.scoreChain, "monsterHouseClear");
      this.chainActionThisTurn = true;
      if (mhBonus > 0) this.showLog(`Monster House chain bonus! +${mhBonus} pts!`);
      this.updateChainHUD();
    }

    this.updateHUD();
  }

  /** Spawn reward items on the floor inside a monster house room */
  private spawnMonsterHouseRewardItems(room: { x: number; y: number; w: number; h: number }, count: number) {
    for (let i = 0; i < count; i++) {
      const ix = room.x + 1 + Math.floor(Math.random() * Math.max(1, room.w - 2));
      const iy = room.y + 1 + Math.floor(Math.random() * Math.max(1, room.h - 2));
      if (this.dungeon.terrain[iy]?.[ix] !== TerrainType.GROUND) continue;

      const item = rollFloorItem();
      const icon = item.category === "berry" ? "●" : item.category === "seed" ? "◆" : item.category === "gem" ? "◇" : "★";
      const color = item.category === "berry" ? "#ff6b9d" : item.category === "seed" ? "#4ade80" : item.category === "gem" ? "#ddaaff" : "#60a5fa";
      const sprite = this.add.text(
        ix * TILE_DISPLAY + TILE_DISPLAY / 2,
        iy * TILE_DISPLAY + TILE_DISPLAY / 2,
        icon, { fontSize: "16px", color, fontFamily: "monospace" }
      ).setOrigin(0.5).setDepth(6);

      // Reward items spawn with a pop-in animation
      sprite.setScale(0);
      this.tweens.add({
        targets: sprite,
        scaleX: 1, scaleY: 1,
        duration: 400,
        delay: i * 150,
        ease: "Back.easeOut",
      });

      this.floorItems.push({ x: ix, y: iy, item, sprite });
    }
  }

  private openShopUI() {
    if (this.shopOpen || this.shopClosed) return;
    // Filter out sold-out items (price=0 means sold out)
    const availableItems = this.shopItems.filter(si => si.price > 0);
    if (availableItems.length === 0) {
      this.showLog("Shop is empty!");
      return;
    }
    sfxShop();
    this.shopOpen = true;

    // Dim overlay
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
      .setScrollFactor(0).setDepth(200).setInteractive();
    this.shopUI.push(overlay);

    // Title
    const title = this.add.text(GAME_WIDTH / 2, 40, `Kecleon Shop  Gold: ${this.gold}G`, {
      fontSize: "12px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.shopUI.push(title);

    // Item list
    const startY = 70;
    let row = 0;
    for (let i = 0; i < this.shopItems.length; i++) {
      const si = this.shopItems[i];
      if (si.price <= 0) continue; // sold out
      const itemDef = ITEM_DB[si.itemId];
      if (!itemDef) continue;
      const y = startY + row * 32;
      const canBuy = this.gold >= si.price;
      const stockStr = si.stock > 1 ? ` x${si.stock}` : "";
      const label = `${itemDef.name}${stockStr} - ${si.price}G`;
      const color = canBuy ? "#e0e0e0" : "#666666";

      const itemBtn = this.add.text(GAME_WIDTH / 2 - 80, y, label, {
        fontSize: "11px", color, fontFamily: "monospace",
        backgroundColor: "#1a1a2eee", padding: { x: 6, y: 4 },
      }).setScrollFactor(0).setDepth(201).setInteractive();
      this.shopUI.push(itemBtn);

      if (canBuy) {
        const buyBtn = this.add.text(GAME_WIDTH / 2 + 80, y, "[Buy]", {
          fontSize: "11px", color: "#fbbf24", fontFamily: "monospace",
          backgroundColor: "#333344ee", padding: { x: 4, y: 4 },
        }).setScrollFactor(0).setDepth(201).setInteractive();
        this.shopUI.push(buyBtn);

        const idx = i;
        buyBtn.on("pointerdown", () => this.buyShopItem(idx));
      }

      // Description
      const desc = this.add.text(GAME_WIDTH / 2 - 80, y + 15, itemDef.description, {
        fontSize: "8px", color: "#888888", fontFamily: "monospace",
      }).setScrollFactor(0).setDepth(201);
      this.shopUI.push(desc);
      row++;
    }

    // Close button
    const closeBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 60, "[Close Shop]", {
      fontSize: "12px", color: "#ef4444", fontFamily: "monospace",
      backgroundColor: "#1a1a2eee", padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setInteractive();
    this.shopUI.push(closeBtn);

    closeBtn.on("pointerdown", () => this.closeShopUI());
  }

  private buyShopItem(index: number) {
    const si = this.shopItems[index];
    if (!si || si.price <= 0 || this.gold < si.price) return;
    const itemDef = ITEM_DB[si.itemId];
    if (!itemDef) return;

    // Check inventory space
    if (this.inventory.length >= MAX_INVENTORY) {
      const existing = this.inventory.find(s => s.item.id === si.itemId && itemDef.stackable);
      if (!existing) {
        this.showLog("Bag is full! Can't buy.");
        return;
      }
    }

    // Deduct gold
    this.gold -= si.price;

    // Add to inventory
    const existing = this.inventory.find(s => s.item.id === si.itemId && itemDef.stackable);
    if (existing) existing.count++;
    else this.inventory.push({ item: itemDef, count: 1 });
    this.showLog(`Bought ${itemDef.name} for ${si.price}G!`);

    // Decrease stock
    si.stock--;
    if (si.stock <= 0) {
      // Remove tile visual
      const tileIdx = this.shopTiles.findIndex(st => st.shopIdx === index);
      if (tileIdx >= 0) {
        this.shopTiles[tileIdx].sprite.destroy();
        this.shopTiles[tileIdx].priceTag.destroy();
        this.shopTiles.splice(tileIdx, 1);
      }
      this.shopItems[index] = { itemId: "", price: 0, stock: 0 };
    }

    // Refresh UI
    this.closeShopUI();
    if (this.shopItems.some(si2 => si2.price > 0)) {
      this.openShopUI();
    }
    this.updateHUD();
    this.updateShopGoldHud();
  }

  /** Show sell prompt for an item when in shop room */
  private showSellPrompt(inventoryIndex: number) {
    if (this.shopOpen || !this.playerInShopRoom || this.shopClosed) return;
    const stack = this.inventory[inventoryIndex];
    if (!stack) return;
    const sellPrice = getItemSellPrice(stack.item.id, this.currentFloor);

    sfxShop();
    this.shopOpen = true;

    // Semi-transparent dark background
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(200).setInteractive();
    this.shopUI.push(overlay);

    // Prompt box
    const boxW = 260;
    const boxH = 100;
    const boxX = (GAME_WIDTH - boxW) / 2;
    const boxY = (GAME_HEIGHT - boxH) / 2;
    const box = this.add.graphics().setScrollFactor(0).setDepth(201);
    box.fillStyle(0x1a1a2e, 0.95);
    box.fillRoundedRect(boxX, boxY, boxW, boxH, 8);
    box.lineStyle(2, 0x4ade80, 1);
    box.strokeRoundedRect(boxX, boxY, boxW, boxH, 8);
    this.shopUI.push(box);

    // Sell text
    const sellText = this.add.text(GAME_WIDTH / 2, boxY + 20, `Sell ${stack.item.name} for ${sellPrice}G?`, {
      fontSize: "11px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    this.shopUI.push(sellText);

    // Yes button
    const yesBtn = this.add.text(GAME_WIDTH / 2 - 50, boxY + 60, "[Yes]", {
      fontSize: "13px", color: "#4ade80", fontFamily: "monospace",
      backgroundColor: "#2a2a4e", padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202).setInteractive();
    this.shopUI.push(yesBtn);

    yesBtn.on("pointerdown", () => {
      this.sellItem(inventoryIndex, sellPrice);
      this.closeShopUI();
    });

    // No button
    const noBtn = this.add.text(GAME_WIDTH / 2 + 50, boxY + 60, "[No]", {
      fontSize: "13px", color: "#ef4444", fontFamily: "monospace",
      backgroundColor: "#2a2a4e", padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202).setInteractive();
    this.shopUI.push(noBtn);
    noBtn.on("pointerdown", () => this.closeShopUI());
  }

  /** Execute selling an item */
  private sellItem(inventoryIndex: number, sellPrice: number) {
    const stack = this.inventory[inventoryIndex];
    if (!stack) return;

    this.gold += sellPrice;
    this.showLog(`Sold ${stack.item.name} for ${sellPrice}G!`);

    stack.count--;
    if (stack.count <= 0) {
      this.inventory.splice(inventoryIndex, 1);
    }

    this.updateHUD();
    this.updateShopGoldHud();
  }

  private closeShopUI() {
    for (const obj of this.shopUI) obj.destroy();
    this.shopUI = [];
    this.shopOpen = false;
  }

  // ── Shrine System ──

  /** Draw the shrine visual on the dungeon floor */
  private drawShrine() {
    if (this.shrineTileX < 0 || !this.floorShrine) return;
    const shrine = this.floorShrine;

    // Diamond glow graphic at the shrine tile
    this.shrineGraphic = this.add.graphics().setDepth(5);
    const cx = this.shrineTileX * TILE_DISPLAY + TILE_DISPLAY / 2;
    const cy = this.shrineTileY * TILE_DISPLAY + TILE_DISPLAY / 2;
    // Glow circle
    this.shrineGraphic.fillStyle(shrine.color, 0.25);
    this.shrineGraphic.fillCircle(cx, cy, TILE_DISPLAY * 0.6);
    // Inner diamond shape
    this.shrineGraphic.fillStyle(shrine.color, 0.5);
    this.shrineGraphic.fillPoints([
      new Phaser.Geom.Point(cx, cy - 14),
      new Phaser.Geom.Point(cx + 10, cy),
      new Phaser.Geom.Point(cx, cy + 14),
      new Phaser.Geom.Point(cx - 10, cy),
    ], true);
    // Border
    this.shrineGraphic.lineStyle(1, shrine.color, 0.8);
    this.shrineGraphic.strokePoints([
      new Phaser.Geom.Point(cx, cy - 14),
      new Phaser.Geom.Point(cx + 10, cy),
      new Phaser.Geom.Point(cx, cy + 14),
      new Phaser.Geom.Point(cx - 10, cy),
    ], true);

    // Shrine marker icon with pulse animation
    this.shrineMarker = this.add.text(cx, cy - 12, shrine.icon, {
      fontSize: "16px", fontFamily: "monospace",
      stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5).setDepth(8);

    this.tweens.add({
      targets: this.shrineMarker,
      scaleX: { from: 1, to: 1.3 },
      scaleY: { from: 1, to: 1.3 },
      alpha: { from: 1, to: 0.6 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /** Check if player stepped on the shrine tile */
  private checkShrine() {
    if (!this.floorShrine || this.shrineUsed || this.shrineOpen) return;
    if (this.player.tileX === this.shrineTileX && this.player.tileY === this.shrineTileY) {
      this.openShrineUI();
    }
  }

  /** Open the shrine choice overlay */
  private openShrineUI() {
    if (this.shrineOpen || !this.floorShrine || this.shrineUsed) return;
    sfxMenuOpen();
    this.shrineOpen = true;
    if (this.domHud) setDomHudInteractive(this.domHud, false);
    this.stopAutoExplore();

    const shrine = this.floorShrine;

    // Dim overlay
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75)
      .setScrollFactor(0).setDepth(200).setInteractive();
    this.shrineUI.push(overlay);

    // Shrine title
    const clrHex = `#${shrine.color.toString(16).padStart(6, "0")}`;
    const titleText = this.add.text(GAME_WIDTH / 2, 55, `${shrine.icon} ${shrine.name}`, {
      fontSize: "16px", color: clrHex, fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.shrineUI.push(titleText);

    // Decorative line
    const line = this.add.graphics().setScrollFactor(0).setDepth(201);
    line.lineStyle(1, shrine.color, 0.5);
    line.lineBetween(GAME_WIDTH / 2 - 120, 77, GAME_WIDTH / 2 + 120, 77);
    this.shrineUI.push(line);

    // Description
    const descText = this.add.text(GAME_WIDTH / 2, 100, shrine.description, {
      fontSize: "10px", color: "#c0c8e0", fontFamily: "monospace",
      wordWrap: { width: 280 }, align: "center", lineSpacing: 4,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(201);
    this.shrineUI.push(descText);

    // Choice buttons
    const choiceStartY = 210;
    for (let i = 0; i < shrine.choices.length; i++) {
      const choice = shrine.choices[i];
      const cy = choiceStartY + i * 80;

      // Button background
      const btnColor = Phaser.Display.Color.HexStringToColor(choice.color).color;
      const btnBg = this.add.rectangle(GAME_WIDTH / 2, cy, 280, 60, 0x1a1a2e, 0.95)
        .setScrollFactor(0).setDepth(201).setInteractive()
        .setStrokeStyle(1, btnColor, 0.6);
      this.shrineUI.push(btnBg);

      // Choice label
      const labelText = this.add.text(GAME_WIDTH / 2, cy - 12, choice.label, {
        fontSize: "12px", color: choice.color, fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
      this.shrineUI.push(labelText);

      // Choice description
      const choiceDesc = this.add.text(GAME_WIDTH / 2, cy + 8, choice.description, {
        fontSize: "9px", color: "#888ea8", fontFamily: "monospace",
        wordWrap: { width: 250 }, align: "center",
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(202);
      this.shrineUI.push(choiceDesc);

      // Hover effects
      btnBg.on("pointerover", () => {
        btnBg.setStrokeStyle(2, 0xfbbf24, 1);
        labelText.setColor("#ffffff");
      });
      btnBg.on("pointerout", () => {
        btnBg.setStrokeStyle(1, btnColor, 0.6);
        labelText.setColor(choice.color);
      });

      // Click handler
      btnBg.on("pointerdown", () => {
        this.applyShrineEffect(choice);
      });
    }
  }

  /** Close shrine overlay */
  private closeShrineUI() {
    for (const obj of this.shrineUI) obj.destroy();
    this.shrineUI = [];
    this.shrineOpen = false;
    if (this.domHud) setDomHudInteractive(this.domHud, true);
  }

  /** Show a brief result message after shrine use */
  private showShrineResult(message: string, color = "#4ade80") {
    this.closeShrineUI();
    this.shrineUsed = true;

    // Remove shrine visuals
    if (this.shrineGraphic) {
      this.shrineGraphic.destroy();
      this.shrineGraphic = null;
    }
    if (this.shrineMarker) {
      this.shrineMarker.destroy();
      this.shrineMarker = null;
    }

    // Brief result overlay
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(200).setInteractive();

    const resultText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, message, {
      fontSize: "12px", color, fontFamily: "monospace", fontStyle: "bold",
      wordWrap: { width: 280 }, align: "center",
      stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    // Auto-dismiss after 1.5 seconds
    this.time.delayedCall(1500, () => {
      overlay.destroy();
      resultText.destroy();
      this.updateHUD();
      this.updateMinimap();
    });
  }

  /** Apply the chosen shrine effect */
  private applyShrineEffect(choice: ShrineChoice) {
    const eff = choice.effect;

    switch (eff.type) {
      case "heal": {
        if (eff.value === 0) {
          // "Leave" / "Walk Away" — no effect
          this.closeShrineUI();
          this.shrineUsed = true;
          // Remove shrine visuals
          if (this.shrineGraphic) { this.shrineGraphic.destroy(); this.shrineGraphic = null; }
          if (this.shrineMarker) { this.shrineMarker.destroy(); this.shrineMarker = null; }
          this.showLog("You left the shrine.");
          return;
        }
        if (eff.value === -1) {
          // Full heal
          this.player.stats.hp = this.player.stats.maxHp;
          sfxHeal();
          this.showShrineResult("The shrine's light washes over you.\nHP fully restored!", "#22c55e");
          this.showLog("The shrine fully healed your HP!");
        } else if (eff.value && eff.value > 0) {
          // Percentage heal
          const healAmt = Math.floor(this.player.stats.maxHp * (eff.value / 100));
          this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + healAmt);
          sfxHeal();
          this.showShrineResult(`Restored ${healAmt} HP!`, "#22c55e");
          this.showLog(`The shrine restored ${healAmt} HP!`);
        }
        break;
      }

      case "hpSacrifice": {
        const sacrificeAmt = Math.floor(this.player.stats.maxHp * ((eff.value ?? 25) / 100));
        if (this.player.stats.hp <= sacrificeAmt) {
          this.showLog("Not enough HP to sacrifice!");
          return; // Don't close — let player pick another option
        }
        this.player.stats.hp -= sacrificeAmt;
        if (eff.blessing) {
          this.grantBlessing(eff.blessing);
        }
        this.showShrineResult(`Sacrificed ${sacrificeAmt} HP.\nBlessing granted!`, "#f97316");
        this.showLog(`You sacrificed ${sacrificeAmt} HP at the shrine!`);
        break;
      }

      case "bellySacrifice": {
        const bellyCost = eff.value ?? 30;
        if (this.belly < bellyCost) {
          this.showLog("Not enough belly to sacrifice!");
          return; // Don't close
        }
        this.belly -= bellyCost;
        // Give gold (look at the shrine's second choice label for gold amount)
        const goldAmt = this.floorShrine?.type === ShrineType.Sacrifice
          ? Math.floor(100 + this.currentFloor * 15 + this.dungeonDef.difficulty * 20)
          : 150;
        this.gold += goldAmt;
        this.showShrineResult(`Sacrificed ${bellyCost} belly.\nGained ${goldAmt}G!`, "#fbbf24");
        this.showLog(`Sacrificed belly at the shrine. Gained ${goldAmt}G!`);
        break;
      }

      case "gold": {
        const goldAmt = eff.value ?? 100;
        this.gold += goldAmt;
        this.showShrineResult(`Found ${goldAmt} gold!`, "#fbbf24");
        this.showLog(`The shrine granted ${goldAmt} gold!`);
        break;
      }

      case "blessing": {
        if (eff.blessing) {
          this.grantBlessing(eff.blessing);
          this.showShrineResult(`Blessed!\n${eff.blessing.name}`, "#4ade80");
        } else {
          const b = getRandomBlessing();
          this.grantBlessing(b);
          this.showShrineResult(`Blessed!\n${b.name}`, "#4ade80");
        }
        break;
      }

      case "curse": {
        if (eff.blessing) {
          this.grantBlessing(eff.blessing);
          this.showShrineResult(`Cursed!\n${eff.blessing.name}`, "#ef4444");
        } else {
          const c = getRandomCurse();
          this.grantBlessing(c);
          this.showShrineResult(`Cursed!\n${c.name}`, "#ef4444");
        }
        break;
      }

      case "random": {
        // 50/50 blessing or curse (gamble)
        const rolled = eff.blessing ?? rollBlessingOrCurse();
        this.grantBlessing(rolled);
        if (rolled.isCurse) {
          this.showShrineResult(`Bad luck!\n${rolled.name}`, "#ef4444");
          this.showLog(`The gamble shrine cursed you: ${rolled.name}`);
        } else {
          this.showShrineResult(`Lucky!\n${rolled.name}`, "#4ade80");
          this.showLog(`The gamble shrine blessed you: ${rolled.name}`);
        }
        break;
      }

      case "restorePP": {
        for (const sk of this.player.skills) {
          sk.currentPp = sk.pp;
        }
        sfxHeal();
        this.showShrineResult("All skill PP restored!", "#38bdf8");
        this.showLog("The shrine restored all your PP!");
        break;
      }

      case "exp": {
        const expAmt = eff.value ?? 50;
        this.totalExp += expAmt;
        const lvlResult = processLevelUp(this.player.stats, expAmt, this.totalExp);
        this.totalExp = lvlResult.totalExp;
        this.showShrineResult(`Gained ${expAmt} EXP!`, "#c084fc");
        this.showLog(`The shrine granted ${expAmt} EXP!`);
        break;
      }

      case "learnSkill": {
        // For now, just grant EXP as a placeholder
        const expAmtSk = eff.value ?? 50;
        this.totalExp += expAmtSk;
        const lvlResultSk = processLevelUp(this.player.stats, expAmtSk, this.totalExp);
        this.totalExp = lvlResultSk.totalExp;
        this.showShrineResult(`Gained ${expAmtSk} EXP from ancient knowledge!`, "#38bdf8");
        this.showLog(`The shrine imparted ancient knowledge: ${expAmtSk} EXP!`);
        break;
      }

      case "item": {
        // Reserved for future use
        this.showShrineResult("Nothing happened.", "#888888");
        break;
      }

      default: {
        this.closeShrineUI();
        this.shrineUsed = true;
        break;
      }
    }
  }

  // ── Event Room System ──

  private checkEventRoom() {
    if (!this.eventRoom || this.eventTriggered || this.eventOpen) return;
    const r = this.eventRoom;
    const px = this.player.tileX;
    const py = this.player.tileY;
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) {
      this.eventTriggered = true;
      // Remove the "!" marker
      if (this.eventMarker) {
        this.eventMarker.destroy();
        this.eventMarker = null;
      }
      // Open the event overlay
      this.openEventUI();
    }
  }

  private openEventUI() {
    if (this.eventOpen || !this.currentEvent) return;
    sfxMenuOpen();
    this.eventOpen = true;
    this.stopAutoExplore();

    const event = this.currentEvent;

    // Dim overlay
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75)
      .setScrollFactor(0).setDepth(200).setInteractive();
    this.eventUI.push(overlay);

    // Event name (title)
    const titleText = this.add.text(GAME_WIDTH / 2, 60, event.name, {
      fontSize: "16px", color: "#22d3ee", fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.eventUI.push(titleText);

    // Decorative line
    const line = this.add.graphics().setScrollFactor(0).setDepth(201);
    line.lineStyle(1, 0x22d3ee, 0.5);
    line.lineBetween(GAME_WIDTH / 2 - 120, 82, GAME_WIDTH / 2 + 120, 82);
    this.eventUI.push(line);

    // Description text (word-wrapped)
    const descText = this.add.text(GAME_WIDTH / 2, 105, event.description, {
      fontSize: "10px", color: "#c0c8e0", fontFamily: "monospace",
      wordWrap: { width: 280 }, align: "center", lineSpacing: 4,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(201);
    this.eventUI.push(descText);

    // Choice buttons
    const choiceStartY = 220;
    for (let i = 0; i < event.choices.length; i++) {
      const choice = event.choices[i];
      const cy = choiceStartY + i * 80;

      // Choice button background
      const btnBg = this.add.rectangle(GAME_WIDTH / 2, cy, 280, 60, 0x1a1a2e, 0.95)
        .setScrollFactor(0).setDepth(201).setInteractive()
        .setStrokeStyle(1, 0x22d3ee, 0.6);
      this.eventUI.push(btnBg);

      // Choice label
      const labelText = this.add.text(GAME_WIDTH / 2, cy - 12, choice.label, {
        fontSize: "12px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
      this.eventUI.push(labelText);

      // Choice description
      const choiceDesc = this.add.text(GAME_WIDTH / 2, cy + 8, choice.description, {
        fontSize: "9px", color: "#888ea8", fontFamily: "monospace",
        wordWrap: { width: 250 }, align: "center",
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(202);
      this.eventUI.push(choiceDesc);

      // Hover effects
      btnBg.on("pointerover", () => {
        btnBg.setStrokeStyle(2, 0xfbbf24, 1);
        labelText.setColor("#ffffff");
      });
      btnBg.on("pointerout", () => {
        btnBg.setStrokeStyle(1, 0x22d3ee, 0.6);
        labelText.setColor("#fbbf24");
      });

      // Click handler
      btnBg.on("pointerdown", () => {
        this.applyEventEffect(choice);
      });
    }
  }

  private closeEventUI() {
    for (const obj of this.eventUI) obj.destroy();
    this.eventUI = [];
    this.eventOpen = false;
  }

  private showEventResult(message: string, color = "#4ade80") {
    this.closeEventUI();

    // Brief result overlay
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(200).setInteractive();

    const resultText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, message, {
      fontSize: "12px", color, fontFamily: "monospace", fontStyle: "bold",
      wordWrap: { width: 280 }, align: "center",
      stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    // Auto-dismiss after 1.5 seconds
    this.time.delayedCall(1500, () => {
      overlay.destroy();
      resultText.destroy();
      this.updateHUD();
      this.updateMinimap();
    });
  }

  private applyEventEffect(choice: EventChoice) {
    const effectId = choice.effectId;
    const value = choice.effectValue ?? 0;

    switch (effectId) {
      case "nothing": {
        this.closeEventUI();
        this.showLog("You decided to move on.");
        break;
      }

      case "wishingWell_toss": {
        // Requires 50G
        if (this.gold < value) {
          this.showLog(`Not enough gold! Need ${value}G.`);
          return; // Don't close UI, let player pick another choice
        }
        this.gold -= value;
        const roll = Math.random();
        if (roll < 0.33) {
          this.player.stats.atk += 3;
          this.showEventResult("The well grants power!\nATK +3!", "#ff6b6b");
        } else if (roll < 0.66) {
          this.player.stats.def += 3;
          this.showEventResult("The well grants resilience!\nDEF +3!", "#60a5fa");
        } else {
          this.player.stats.maxHp += 20;
          this.player.stats.hp = Math.min(this.player.stats.hp + 20, this.player.stats.maxHp);
          this.showEventResult("The well grants vitality!\nMax HP +20!", "#4ade80");
        }
        sfxBuff();
        this.showLog("Your wish was granted!");
        break;
      }

      case "stash_open": {
        this.closeEventUI();
        if (Math.random() < 0.5) {
          // Good outcome: 2-3 items
          const itemCount = 2 + Math.floor(Math.random() * 2);
          let addedCount = 0;
          for (let i = 0; i < itemCount; i++) {
            if (this.inventory.length >= MAX_INVENTORY) break;
            const item = rollFloorItem();
            const existing = this.inventory.find(s => s.item.id === item.id && item.stackable);
            if (existing) existing.count++;
            else this.inventory.push({ item, count: 1 });
            addedCount++;
          }
          sfxItemPickup();
          this.showEventResult(`Found ${addedCount} items in the stash!`, "#4ade80");
          this.showLog(`Found ${addedCount} items!`);
        } else {
          // Bad outcome: spawn 2-3 enemies
          this.showLog("It was a trap! Enemies appear!");
          this.spawnEventEnemies(2 + Math.floor(Math.random() * 2));
          this.showEventResult("Enemies burst out of the stash!", "#ef4444");
        }
        break;
      }

      case "statue_pray": {
        this.player.stats.hp = this.player.stats.maxHp;
        sfxHeal();
        this.showEventResult("The statue's warmth heals you fully!\nHP fully restored!", "#4ade80");
        this.showLog("HP fully restored!");
        break;
      }

      case "statue_smash": {
        // Take damage
        this.player.stats.hp = Math.max(1, this.player.stats.hp - value);
        // Give 3 random items
        let addedCount = 0;
        for (let i = 0; i < 3; i++) {
          if (this.inventory.length >= MAX_INVENTORY) break;
          const item = rollFloorItem();
          const existing = this.inventory.find(s => s.item.id === item.id && item.stackable);
          if (existing) existing.count++;
          else this.inventory.push({ item, count: 1 });
          addedCount++;
        }
        sfxHit();
        this.showEventResult(`Smashed! Took ${value} damage.\nFound ${addedCount} items!`, "#fbbf24");
        this.showLog(`Took ${value} damage but found ${addedCount} items!`);
        break;
      }

      case "traveler_feed": {
        // Check if player has an Apple
        const appleIdx = this.inventory.findIndex(s => s.item.id === "apple" || s.item.id === "bigApple" || s.item.id === "goldenApple");
        if (appleIdx === -1) {
          this.showLog("You don't have any Apples!");
          return; // Don't close UI
        }
        // Consume the apple
        const stack = this.inventory[appleIdx];
        stack.count--;
        if (stack.count <= 0) this.inventory.splice(appleIdx, 1);

        // Recruit a random ally
        this.spawnEventAlly();
        sfxRecruit();
        this.showEventResult("The traveler is grateful!\nThey join your team!", "#ff6b9d");
        this.showLog("A grateful traveler joins you!");
        break;
      }

      case "chest_open": {
        // Give a powerful item (orb or rare seed)
        const powerfulItems = ["allPowerOrb", "reviveSeed", "luminousOrb", "maxElixir", "sitrusBerry"];
        const itemId = powerfulItems[Math.floor(Math.random() * powerfulItems.length)];
        const item = ITEM_DB[itemId];
        if (this.inventory.length < MAX_INVENTORY && item) {
          const existing = this.inventory.find(s => s.item.id === item.id && item.stackable);
          if (existing) existing.count++;
          else this.inventory.push({ item, count: 1 });
        }
        // Apply Burn status
        this.player.statusEffects.push({ type: SkillEffect.Burn, turnsLeft: 5 });
        sfxItemPickup();
        this.showEventResult(`Got ${item?.name ?? "an item"}!\nBut you were cursed with Burn!`, "#bb44ff");
        this.showLog(`Got ${item?.name ?? "an item"}, but burned!`);
        break;
      }

      case "train_do": {
        // Grant EXP but lose 30% belly
        const bellyLoss = Math.floor(this.maxBelly * 0.3);
        this.belly = Math.max(0, this.belly - bellyLoss);
        // Process level ups
        const prevLevel = this.player.stats.level;
        const levelResult = processLevelUp(this.player.stats, value, this.totalExp);
        this.totalExp = levelResult.totalExp;
        for (const r of levelResult.results) {
          sfxLevelUp();
          this.showLog(`Level up! Lv.${r.newLevel}! HP+${r.hpGain} ATK+${r.atkGain} DEF+${r.defGain}`);
        }
        sfxBuff();
        this.showEventResult(`Intense training!\n+${value} EXP, Belly -${bellyLoss}`, "#fbbf24");
        this.showLog(`Gained ${value} EXP! Belly -${bellyLoss}.`);
        break;
      }

      case "fortune_pay": {
        if (this.gold < value) {
          this.showLog(`Not enough gold! Need ${value}G.`);
          return; // Don't close UI
        }
        this.gold -= value;
        // Reveal entire floor
        const { width, height } = this.dungeon;
        for (let fy = 0; fy < height; fy++) {
          for (let fx = 0; fx < width; fx++) {
            this.visited[fy][fx] = true;
            this.currentlyVisible[fy][fx] = true;
          }
        }
        // Reveal all traps too
        for (const trap of this.floorTraps) {
          trap.revealed = true;
        }
        this.updateMinimap();
        this.checkExplorationRewards();
        sfxBuff();
        this.showEventResult("The orb reveals all secrets!\nFloor map fully revealed!", "#22d3ee");
        this.showLog("Floor layout fully revealed!");
        break;
      }

      case "rest_do": {
        this.player.stats.hp = this.player.stats.maxHp;
        this.belly = Math.min(this.maxBelly, this.belly + value);
        this.resetBellyWarnings();
        sfxHeal();
        this.showEventResult(`You rest peacefully...\nHP fully restored! Belly +${value}`, "#4ade80");
        this.showLog(`Rested! HP restored, Belly +${value}.`);
        break;
      }

      default: {
        this.closeEventUI();
        this.showLog("Nothing happened.");
        break;
      }
    }
  }

  /** Spawn enemies in the event room (for Abandoned Stash trap) */
  private spawnEventEnemies(count: number) {
    if (!this.eventRoom) return;
    const r = this.eventRoom;
    const floorSpeciesIds = (this.dungeonDef.id === "endlessDungeon" || this.dungeonDef.id === "dailyDungeon")
      ? this.getEndlessEnemies(this.currentFloor)
      : getDungeonFloorEnemies(this.dungeonDef, this.currentFloor);
    const floorSpecies = floorSpeciesIds.map(id => SPECIES[id]).filter(Boolean);
    if (floorSpecies.length === 0) return;

    for (let i = 0; i < count; i++) {
      const ex = r.x + 1 + Math.floor(Math.random() * Math.max(1, r.w - 2));
      const ey = r.y + 1 + Math.floor(Math.random() * Math.max(1, r.h - 2));
      if (this.dungeon.terrain[ey]?.[ex] !== TerrainType.GROUND) continue;
      if (this.allEntities.some(e => e.alive && e.tileX === ex && e.tileY === ey)) continue;

      const sp = floorSpecies[Math.floor(Math.random() * floorSpecies.length)];
      const enemyStats = getEnemyStats(this.currentFloor, this.dungeonDef.difficulty, sp, this.ngPlusLevel);

      if (this.difficultyMods.enemyHpMult !== 1) {
        enemyStats.hp = Math.floor(enemyStats.hp * this.difficultyMods.enemyHpMult);
        enemyStats.maxHp = Math.floor(enemyStats.maxHp * this.difficultyMods.enemyHpMult);
      }
      if (this.difficultyMods.enemyAtkMult !== 1) {
        enemyStats.atk = Math.floor(enemyStats.atk * this.difficultyMods.enemyAtkMult);
      }

      const enemy: Entity = {
        tileX: ex, tileY: ey,
        facing: Direction.Down,
        stats: { ...enemyStats },
        alive: true,
        spriteKey: sp.spriteKey,
        name: sp.name,
        types: sp.types,
        attackType: sp.attackType,
        skills: createSpeciesSkills(sp),
        statusEffects: [],
        speciesId: sp.spriteKey,
        ability: SPECIES_ABILITIES[sp.spriteKey],
      };
      const eTex = `${sp.spriteKey}-idle`;
      if (this.textures.exists(eTex)) {
        enemy.sprite = this.add.sprite(
          this.tileToPixelX(ex), this.tileToPixelY(ey), eTex
        );
        enemy.sprite.setScale(TILE_SCALE).setDepth(9);
        const eAnim = `${sp.spriteKey}-idle-${Direction.Down}`;
        if (this.anims.exists(eAnim)) enemy.sprite.play(eAnim);
      }
      this.enemies.push(enemy);
      this.allEntities.push(enemy);
      this.seenSpecies.add(sp.spriteKey);
    }
  }

  /** Spawn a temporary ally from the Lost Traveler event */
  private spawnEventAlly() {
    if (!this.eventRoom || this.allies.length >= MAX_ALLIES) return;
    const r = this.eventRoom;

    // Pick a random species from the current floor's enemy pool
    const floorSpeciesIds = (this.dungeonDef.id === "endlessDungeon" || this.dungeonDef.id === "dailyDungeon")
      ? this.getEndlessEnemies(this.currentFloor)
      : getDungeonFloorEnemies(this.dungeonDef, this.currentFloor);
    const floorSpecies = floorSpeciesIds.map(id => SPECIES[id]).filter(Boolean);
    if (floorSpecies.length === 0) return;

    const sp = floorSpecies[Math.floor(Math.random() * floorSpecies.length)];
    const allyStats = getEnemyStats(this.currentFloor, this.dungeonDef.difficulty * 0.9, sp, this.ngPlusLevel);

    // Place ally near event room center
    const ax = Math.floor(r.x + r.w / 2);
    const ay = Math.floor(r.y + r.h / 2);

    const ally: Entity = {
      tileX: ax, tileY: ay,
      facing: Direction.Down,
      stats: { ...allyStats },
      alive: true,
      spriteKey: sp.spriteKey,
      name: sp.name,
      types: sp.types,
      attackType: sp.attackType,
      skills: createSpeciesSkills(sp),
      statusEffects: [],
      isAlly: true,
      speciesId: sp.spriteKey,
      ability: SPECIES_ABILITIES[sp.spriteKey],
      allyTactic: AllyTactic.FollowMe,
    };

    const recruitTex = `${sp.spriteKey}-idle`;
    if (this.textures.exists(recruitTex)) {
      ally.sprite = this.add.sprite(
        this.tileToPixelX(ax), this.tileToPixelY(ay), recruitTex
      ).setScale(TILE_SCALE).setDepth(10);
      const recruitAnim = `${sp.spriteKey}-idle-${Direction.Down}`;
      if (this.anims.exists(recruitAnim)) ally.sprite.play(recruitAnim);
    }

    // Pink tint flash for recruitment
    if (ally.sprite) ally.sprite.setTint(0xff88cc);
    this.time.delayedCall(400, () => { if (ally.sprite) ally.sprite.clearTint(); });

    const heart = this.add.text(
      this.tileToPixelX(ax), this.tileToPixelY(ay) - 20,
      "♥", { fontSize: "18px", color: "#ff6b9d", fontFamily: "monospace" }
    ).setOrigin(0.5).setDepth(50);
    this.tweens.add({
      targets: heart, y: heart.y - 30, alpha: { from: 1, to: 0 },
      duration: 1000, ease: "Quad.easeOut",
      onComplete: () => heart.destroy(),
    });

    this.allies.push(ally);
    this.allEntities.push(ally);
    this.seenSpecies.add(sp.spriteKey);
  }

  // Puzzle Room System is now in systems/puzzle-system.ts (PuzzleSystem class)


  /** Get random enemy species for endless dungeon based on current floor */
  private getEndlessEnemies(floor: number): string[] {
    const allSpecies = Object.keys(SPECIES);
    // Pick 4-8 random species, more variety at deeper floors
    const count = Math.min(8, 4 + Math.floor(floor / 10));
    const enemies: string[] = [];
    for (let i = 0; i < count; i++) {
      enemies.push(allSpecies[Math.floor(Math.random() * allSpecies.length)]);
    }
    return enemies;
  }

  /** Get quest tracking data for passing to HubScene */
  private getQuestTrackingData(): Record<string, unknown> {
    const bestChainTier = getChainTier(this.scoreChain.maxChainReached);
    const bossDefeated = this.isBossRush ? this.bossesDefeated > 0 : !!this.dungeonDef.boss;
    const legendaryDefeated = this.legendaryEncountered && this.legendaryEntity === null && this.legendaryEncounter === null;
    return {
      questItemsCollected: this.questItemsCollected,
      questItemsUsed: this.questItemsUsed,
      questBestChainTier: bestChainTier,
      questBossDefeated: bossDefeated,
      questLegendaryDefeated: legendaryDefeated,
    };
  }

  private advanceFloor() {
    this.stopAutoExplore();
    // Endless dungeon never shows clear screen — always advance
    // Daily dungeon and other dungeons show clear when floors are completed
    if (this.dungeonDef.id !== "endlessDungeon" && this.currentFloor >= this.dungeonDef.floors) {
      this.showDungeonClear();
      return;
    }

    // Apply healOnFloor modifier before advancing
    if (this.modifierEffects.healOnFloor) {
      this.player.stats.hp = this.player.stats.maxHp;
    }

    // Held item: heal per floor
    const healPerFloor = this.heldItemEffect.healPerFloor ?? 0;
    if (healPerFloor > 0 && this.player.stats.hp < this.player.stats.maxHp) {
      this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + healPerFloor);
      this.showLog(`Held item healed ${healPerFloor} HP!`);
    }

    // Score chain: quick floor bonus if cleared in under 20 turns
    if (this.floorTurns < 20) {
      const bonus = addChainAction(this.scoreChain, "quickFloor");
      if (bonus > 0) this.showLog(`Quick clear! Chain +${bonus} pts!`);
      this.updateChainHUD();
    }

    // Auto-save before advancing floor
    this.autoSave();

    this.gameOver = true;
    sfxStairs();
    this.showLog(`Went to B${this.currentFloor + 1}F!`);

    // Run log: floor advance
    this.runLog.add(RunLogEvent.FloorAdvanced, `Advanced to B${this.currentFloor + 1}F`, this.currentFloor, this.turnManager.turn);

    // Tick blessing/curse durations on floor advance
    const prevBlessingCount = this.activeBlessings.length;
    this.activeBlessings = tickBlessingDurations(this.activeBlessings);
    if (this.activeBlessings.length < prevBlessingCount) {
      this.showLog("Some blessings/curses have expired.");
    }

    // Pass modifier IDs through floor transitions
    const modifierIds = this.activeModifiers.length > 0 ? this.activeModifiers.map(m => m.id) : undefined;

    if (this.domHud) setDomHudInteractive(this.domHud, false);

    let restarted = false;
    const doRestart = () => {
      if (restarted) return;
      restarted = true;
      // Clean up DOM HUD before restart
      if (this.domHudElement) {
        this.domHudElement.destroy();
        this.domHudElement = null as unknown as Phaser.GameObjects.DOMElement;
        this.domHud = null as unknown as DomHudElements;
      }
      this.scene.restart({
        floor: this.currentFloor + 1,
        hp: this.player.stats.hp,
        maxHp: this.player.stats.maxHp,
        skills: this.player.skills,
        inventory: this.inventory,
        level: this.player.stats.level,
        atk: this.player.stats.atk,
        def: this.player.stats.def,
        exp: this.totalExp,
        dungeonId: this.dungeonDef.id,
        allies: this.serializeAllies(),
        belly: this.belly,
        starter: this.starterId,
        challengeMode: this.challengeMode ?? undefined,
        modifiers: modifierIds,
        runElapsedTime: this.runElapsedSeconds,
        scoreChain: this.scoreChain,
        legendaryEncountered: this.legendaryEncountered,
        questItemsCollected: this.questItemsCollected,
        questItemsUsed: this.questItemsUsed,
        relics: this.activeRelics,
        runLogEntries: this.runLog.serialize(),
        blessings: serializeBlessings(this.activeBlessings),
      });
    };

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", doRestart);
    // Safety fallback using native setTimeout (Phaser timers may stall with the scene)
    setTimeout(doRestart, 1200);
  }

  private showDungeonClear() {
    this.gameOver = true;
    stopBgm();
    sfxVictory();
    clearDungeonSave();
    // Run log: dungeon cleared
    this.runLog.add(RunLogEvent.DungeonCleared, `${this.dungeonDef.name} cleared!`, this.currentFloor, this.turnManager.turn);

    // Boss bonus: +50% gold if dungeon has a boss; Boss Rush always counts as boss dungeon
    const baseGold = goldFromRun(this.currentFloor, this.enemiesDefeated, true);
    const ngGoldBonus = 1 + this.ngPlusBonuses.goldPercent / 100; // NG+ gold bonus
    const challengeGoldMultiplier = this.challengeMode === "speedrun" ? 2 : 1; // Speed Run = 2x gold
    const modGoldMult = this.modifierEffects.goldMult; // Dungeon modifier gold multiplier
    const clearHeldGoldMult = 1 + (this.heldItemEffect.goldBonus ?? 0) / 100;
    const clearEnchGoldMult = this.enchantment?.id === "abundance" ? 1.15 : 1.0;
    const hasBoss = this.dungeonDef.boss || this.isBossRush;
    const clearMutGoldMult = hasMutation(this.floorMutations, MutationType.GoldenAge) ? getMutationEffect(MutationType.GoldenAge, "goldMult") : 1;
    const clearTalentGoldMult = 1 + (this.talentEffects.goldPercent ?? 0) / 100;
    const clearRelicGoldMult = 1 + (this.relicEffects.goldMult ?? 0);
    const clearBlessingGoldMult = 1 + getBlessingEffect(this.activeBlessings, "goldMult");
    const gold = Math.floor((hasBoss ? baseGold * 1.5 : baseGold) * ngGoldBonus * challengeGoldMultiplier * modGoldMult * clearHeldGoldMult * this.difficultyMods.goldMult * clearEnchGoldMult * clearMutGoldMult * clearTalentGoldMult * clearRelicGoldMult * clearBlessingGoldMult);

    this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.85
    ).setScrollFactor(0).setDepth(200);

    // Use top-down layout to avoid overlap
    let clearY = 60;

    const titleText = this.add.text(GAME_WIDTH / 2, clearY, "DUNGEON CLEAR!", {
      fontSize: "20px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    clearY += 30;

    // Challenge mode info on clear screen
    if (this.challengeMode) {
      const chDef = CHALLENGE_MODES.find(c => c.id === this.challengeMode);
      if (chDef) {
        this.add.text(GAME_WIDTH / 2, clearY, `Challenge: ${chDef.name}`, {
          fontSize: "10px", color: chDef.color, fontFamily: "monospace", fontStyle: "bold",
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
        clearY += 18;
      }
    }

    this.add.text(GAME_WIDTH / 2, clearY, `${this.dungeonDef.name} B${this.dungeonDef.floors}F cleared!`, {
      fontSize: "12px", color: "#e0e0e0", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    clearY += 24;

    this.add.text(GAME_WIDTH / 2, clearY, `Earned ${gold} Gold!`, {
      fontSize: "13px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    clearY += 22;

    // Daily dungeon: calculate and save score
    let dailyScoreValue = 0;
    if (this.dungeonDef.id === "dailyDungeon") {
      const dailyConfig = getDailyConfig();
      dailyScoreValue = calculateDailyScore(
        this.currentFloor, this.enemiesDefeated, this.turnManager.turn, true
      );
      saveDailyScore({
        date: dailyConfig.date,
        floorsReached: this.currentFloor,
        enemiesDefeated: this.enemiesDefeated,
        turnsUsed: this.turnManager.turn,
        score: dailyScoreValue,
        cleared: true,
        starter: this.starterId,
      });
    }

    // Leaderboard: calculate and save run score (with chain bonus added)
    const clearBaseScore = calculateScore({
      dungeonId: this.dungeonDef.id,
      starter: this.starterId,
      floorsCleared: this.dungeonDef.floors,
      enemiesDefeated: this.enemiesDefeated,
      turns: this.turnManager.turn,
      goldEarned: gold,
      cleared: true,
      totalFloors: this.dungeonDef.floors,
      challengeMode: this.challengeMode ?? undefined,
    });
    const clearChainBonus = this.scoreChain.totalBonusScore;
    const clearRunScore = clearBaseScore + clearChainBonus;
    saveRunScore({
      dungeonId: this.dungeonDef.id,
      starter: this.starterId,
      score: clearRunScore,
      floorsCleared: this.dungeonDef.floors,
      enemiesDefeated: this.enemiesDefeated,
      turns: this.turnManager.turn,
      goldEarned: gold,
      cleared: true,
      date: new Date().toISOString(),
      challengeMode: this.challengeMode ?? undefined,
      difficulty: isNonNormalDifficulty(this.difficultyLevel) ? this.difficultyLevel : undefined,
    });

    // Journal: record dungeon clear with species encountered
    {
      const clearJournal = loadJournal();
      recordDungeonClear(clearJournal, this.dungeonDef.id, this.dungeonDef.floors, this.runElapsedSeconds, this.enemiesDefeated, gold);
      for (const sid of this.seenSpecies) {
        recordSpeciesEncountered(clearJournal, this.dungeonDef.id, sid);
      }
    }

    // Run counter for this dungeon
    const clearMeta = loadMeta();
    const clearDungeonRunCount = (clearMeta.dungeonRunCounts ?? {})[this.dungeonDef.id] ?? 0;

    // Speed run timer: check and save best time
    const runTime = this.runElapsedSeconds;
    if (!clearMeta.bestTimes) clearMeta.bestTimes = {};
    const prevBest = clearMeta.bestTimes[this.dungeonDef.id];
    const isNewBest = prevBest === undefined || runTime < prevBest;
    if (isNewBest) {
      clearMeta.bestTimes[this.dungeonDef.id] = runTime;
      saveMeta(clearMeta);
    }

    // Time display on clear screen
    const timeStr = `Time: ${this.formatTime(runTime)}`;
    const bestStr = isNewBest
      ? `Best: ${this.formatTime(runTime)}`
      : `Best: ${this.formatTime(prevBest!)}`;
    this.add.text(GAME_WIDTH / 2, clearY, `${timeStr}    ${bestStr}`, {
      fontSize: "10px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    clearY += 16;

    // "New Best Time!" banner
    if (isNewBest) {
      this.add.text(GAME_WIDTH / 2, clearY, "New Best Time!", {
        fontSize: "10px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
      clearY += 16;
    }

    // Chain bonus display
    const clearMaxTier = getChainTier(this.scoreChain.maxChainReached);
    const clearChainStr = clearMaxTier
      ? `Best Chain: ${clearMaxTier} (x${this.scoreChain.maxChainReached.toFixed(1)})  +${clearChainBonus} pts`
      : "";

    // Stats summary
    const clearStats = [
      `Run #${clearDungeonRunCount}`,
      `Lv.${this.player.stats.level}  Defeated: ${this.enemiesDefeated}  Turns: ${this.turnManager.turn}`,
      this.allies.length > 0 ? `Team: ${this.allies.filter(a => a.alive).map(a => a.name).join(", ")}` : "",
      this.ngPlusLevel > 0 ? `NG+${this.ngPlusLevel}` : "",
      this.challengeMode === "speedrun" ? "Speed Run Bonus: 2x Gold!" : "",
      this.dungeonDef.id === "dailyDungeon" ? `Daily Score: ${dailyScoreValue}` : "",
      this.isBossRush ? `Bosses Defeated: ${this.bossesDefeated}/10` : "",
      this.gauntletTotalWavesCleared > 0 ? `Gauntlet Waves: ${this.gauntletTotalWavesCleared}` : "",
      clearChainStr,
      `Score: ${clearRunScore}`,
    ].filter(Boolean).join("\n");
    clearY += 4;
    const statsText = this.add.text(GAME_WIDTH / 2, clearY, clearStats, {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace", align: "center",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(201);
    clearY += statsText.height + 10;

    // Performance grade
    const clearGrade = calculatePerformanceGrade(this.runLog.getSummaryStats(), true, this.dungeonDef.floors, this.turnManager.turn);
    this.add.text(GAME_WIDTH / 2, clearY, `Grade: ${clearGrade}`, {
      fontSize: "13px", color: gradeColor(clearGrade), fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    clearY += 24;

    // Buttons at bottom — use fixed positions from bottom
    const btnY1 = Math.max(clearY, GAME_HEIGHT - 120);
    const btnW = 200;
    const btnH = 32;

    const townBtnBg = this.add.rectangle(GAME_WIDTH / 2, btnY1, btnW, btnH, 0x1e40af, 0.9)
      .setStrokeStyle(1, 0x60a5fa).setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });
    const townBtnText = this.add.text(GAME_WIDTH / 2, btnY1, "Return to Town", {
      fontSize: "13px", color: "#ffffff", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    townBtnBg.on("pointerover", () => townBtnBg.setFillStyle(0x2563eb, 1));
    townBtnBg.on("pointerout", () => townBtnBg.setFillStyle(0x1e40af, 0.9));
    townBtnBg.on("pointerdown", () => {
      this.scene.start("HubScene", {
        gold,
        cleared: true,
        bestFloor: this.dungeonDef.floors,
        enemiesDefeated: this.enemiesDefeated,
        turns: this.turnManager.turn,
        dungeonId: this.dungeonDef.id,
        starter: this.starterId,
        challengeMode: this.challengeMode ?? undefined,
        pokemonSeen: Array.from(this.seenSpecies),
        inventory: serializeInventory(this.inventory),
        ...this.getQuestTrackingData(),
      });
    });

    const btnY2 = btnY1 + btnH + 6;
    const retryBtnBg = this.add.rectangle(GAME_WIDTH / 2, btnY2, btnW, btnH, 0x92400e, 0.9)
      .setStrokeStyle(1, 0xf59e0b).setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH / 2, btnY2, "Run Again", {
      fontSize: "13px", color: "#ffffff", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    retryBtnBg.on("pointerover", () => retryBtnBg.setFillStyle(0xb45309, 1));
    retryBtnBg.on("pointerout", () => retryBtnBg.setFillStyle(0x92400e, 0.9));
    retryBtnBg.on("pointerdown", () => {
      this.quickRetry(gold, true);
    });

    const btnY3 = btnY2 + btnH + 6;
    const summaryBtnBg = this.add.rectangle(GAME_WIDTH / 2, btnY3, btnW * 0.8, 26, 0x2a2a4e, 0.9)
      .setStrokeStyle(1, 0xa855f7).setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH / 2, btnY3, "Run Summary", {
      fontSize: "11px", color: "#a855f7", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    summaryBtnBg.on("pointerdown", () => {
      this.showRunSummary(true, this.dungeonDef.floors);
    });

    // Gentle gold glow on title
    this.tweens.add({
      targets: titleText,
      alpha: { from: 1, to: 0.7 },
      duration: 1200, yoyo: true, repeat: -1,
    });
  }

  private showGameOver() {
    this.stopAutoExplore();

    // Check if rescue is available before committing to game over
    const meta = loadMeta();
    const rescueGold = meta.gold + this.gold; // meta (saved) gold + run gold
    const options = getRescueOptions(this.currentFloor, this.dungeonDef.difficulty, rescueGold);
    if (this.rescueCount < MAX_RESCUES_PER_RUN && options.length > 0) {
      // Pause the game but don't finalize game over yet
      stopBgm();
      this.showRescuePrompt(options, rescueGold);
      return;
    }

    // No rescue available — proceed to final game over
    this.showGameOverScreen();
  }

  /**
   * Rescue prompt overlay — shown when the player faints but can afford a rescue.
   * Displays rescue options as buttons and a "Give up" fallback.
   */
  private showRescuePrompt(options: RescueOption[], availableGold: number) {
    const rescueUI: Phaser.GameObjects.GameObject[] = [];
    // Disable DOM HUD buttons while rescue prompt is open
    if (this.domHud) setDomHudInteractive(this.domHud, false);

    // Dark overlay
    const bg = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.8
    ).setScrollFactor(0).setDepth(200).setInteractive();
    rescueUI.push(bg);

    // Title
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 90, "You've been knocked out!", {
      fontSize: "16px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    rescueUI.push(title);

    // Subtitle with remaining rescues
    const remaining = MAX_RESCUES_PER_RUN - this.rescueCount;
    const subtitle = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 68, `Rescue available! (${remaining} left this run)`, {
      fontSize: "10px", color: "#fbbf24", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    rescueUI.push(subtitle);

    // Gold display
    const goldInfo = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 52, `Your Gold: ${availableGold}G`, {
      fontSize: "10px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    rescueUI.push(goldInfo);

    // Rescue option buttons
    let yOffset = GAME_HEIGHT / 2 - 28;
    for (const option of options) {
      // Option button background
      const btnBg = this.add.rectangle(
        GAME_WIDTH / 2, yOffset + 12, 280, 44,
        0x1e293b, 0.9
      ).setScrollFactor(0).setDepth(201).setInteractive();
      rescueUI.push(btnBg);

      // Option label
      const labelColor = option.hpPercent >= 100 ? "#34d399" : "#60a5fa";
      const labelText = this.add.text(GAME_WIDTH / 2, yOffset + 4, option.label, {
        fontSize: "13px", color: labelColor, fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
      rescueUI.push(labelText);

      // Option description
      const descText = this.add.text(GAME_WIDTH / 2, yOffset + 20, option.description, {
        fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
      rescueUI.push(descText);

      // Border highlight on hover
      btnBg.on("pointerover", () => btnBg.setStrokeStyle(1, 0x60a5fa));
      btnBg.on("pointerout", () => btnBg.setStrokeStyle(0));

      // Handle rescue selection
      const selectedOption = option;
      btnBg.on("pointerdown", () => {
        for (const el of rescueUI) el.destroy();
        this.executeRescue(selectedOption);
      });

      yOffset += 52;
    }

    // "Give up" button (styled rectangle)
    const giveUpY = yOffset + 16;
    const giveUpBg = this.add.rectangle(GAME_WIDTH / 2, giveUpY, 140, 32, 0x1a1a2e, 0.9)
      .setStrokeStyle(1, 0x6b7280).setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });
    rescueUI.push(giveUpBg);
    const giveUpLabel = this.add.text(GAME_WIDTH / 2, giveUpY, "Give Up", {
      fontSize: "13px", color: "#6b7280", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    rescueUI.push(giveUpLabel);

    giveUpBg.on("pointerover", () => { giveUpBg.setStrokeStyle(1, 0xef4444); giveUpLabel.setColor("#ef4444"); });
    giveUpBg.on("pointerout", () => { giveUpBg.setStrokeStyle(1, 0x6b7280); giveUpLabel.setColor("#6b7280"); });
    giveUpBg.on("pointerdown", () => {
      for (const el of rescueUI) el.destroy();
      this.showGameOverScreen();
    });
  }

  /**
   * Execute a rescue: deduct gold, restore HP, optionally remove items, clear enemies, resume play.
   */
  private executeRescue(option: RescueOption) {
    const meta = loadMeta();
    let costRemaining = option.goldCost;

    // First deduct from run gold, then from meta gold
    if (this.gold >= costRemaining) {
      this.gold -= costRemaining;
      costRemaining = 0;
    } else {
      costRemaining -= this.gold;
      this.gold = 0;
      meta.gold = Math.max(0, meta.gold - costRemaining);
      saveMeta(meta);
    }

    // Increment rescue count
    this.rescueCount++;

    // Restore HP and alive state
    this.player.stats.hp = Math.floor(this.player.stats.maxHp * option.hpPercent / 100);
    this.player.alive = true;

    // Stop any ongoing tweens on the player sprite (e.g. death fade-out)
    if (this.player.sprite) {
      this.tweens.killTweensOf(this.player.sprite);
      this.player.sprite.setAlpha(1);
    } else {
      // Sprite was already destroyed by death tween — recreate it
      const sp = SPECIES[this.starterId];
      if (sp) {
        const texKey = `${sp.spriteKey}-idle`;
        if (this.textures.exists(texKey)) {
          this.player.sprite = this.add.sprite(
            this.tileToPixelX(this.player.tileX),
            this.tileToPixelY(this.player.tileY),
            texKey
          ).setScale(TILE_SCALE).setDepth(10);
          const animKey = `${sp.spriteKey}-idle-${this.player.facing}`;
          if (this.anims.exists(animKey)) this.player.sprite.play(animKey);
        }
      }
    }

    // If basic rescue, remove half the inventory items randomly
    if (!option.keepItems && this.inventory.length > 0) {
      const removeCount = Math.floor(this.inventory.length / 2);
      for (let i = 0; i < removeCount; i++) {
        const idx = Math.floor(Math.random() * this.inventory.length);
        this.inventory.splice(idx, 1);
      }
    }

    // Revive fainted allies and restore their sprites
    for (const ally of this.allies) {
      if (!ally.alive) {
        ally.alive = true;
        ally.stats.hp = Math.floor(ally.stats.maxHp * 0.5);
      }
      // Stop any death fade tween and ensure sprite is visible
      if (ally.sprite) {
        this.tweens.killTweensOf(ally.sprite);
        ally.sprite.setAlpha(1);
      } else {
        // Recreate destroyed sprite
        const allySp = ally.speciesId ? SPECIES[ally.speciesId] : undefined;
        if (allySp) {
          const allyTex = `${allySp.spriteKey}-idle`;
          if (this.textures.exists(allyTex)) {
            ally.sprite = this.add.sprite(
              this.tileToPixelX(ally.tileX), this.tileToPixelY(ally.tileY), allyTex
            ).setScale(TILE_SCALE).setDepth(10);
          }
        }
        // Re-add to allEntities if missing
        if (!this.allEntities.includes(ally)) {
          this.allEntities.push(ally);
        }
      }
    }

    // Reset turn manager busy state to unblock input after rescue
    this.turnManager.forceIdle();

    // Ensure gameOver stays false (was not set since we intercepted before showGameOverScreen)
    this.gameOver = false;

    // Re-enable DOM HUD buttons (rescue overlay may have blocked them)
    if (this.domHud) setDomHudInteractive(this.domHud, true);

    // Visual feedback: rescue flash
    this.cameras.main.flash(600, 100, 200, 255);
    if (this.player.sprite) {
      this.player.sprite.setTint(0x64b5f6);
      this.time.delayedCall(800, () => {
        if (this.player.sprite) this.player.sprite.clearTint();
      });
    }

    // Show rescue success message
    this.showLog(`Rescue successful! Restored to ${option.hpPercent}% HP. (${MAX_RESCUES_PER_RUN - this.rescueCount} rescues left)`);

    // Run log entry
    this.runLog.add(RunLogEvent.PlayerDied, `Rescued on B${this.currentFloor}F (${option.label})`, this.currentFloor, this.turnManager.turn);

    // Resume BGM
    startBgm(this.dungeonDef.id);

    // Update HUD to reflect HP/inventory changes
    this.updateHUD();
  }

  /**
   * Final game over screen — shown when rescue is declined or unavailable.
   * Contains all the original game over logic (gold salvage, scoring, stats, buttons).
   */
  private showGameOverScreen() {
    this.gameOver = true;
    stopBgm();
    sfxGameOver();
    clearDungeonSave();
    // Run log: player died
    this.runLog.add(RunLogEvent.PlayerDied, `Fainted on B${this.currentFloor}F`, this.currentFloor, this.turnManager.turn);

    const goHeldGoldMult = 1 + (this.heldItemEffect.goldBonus ?? 0) / 100;
    const ngGoGoldMult = 1 + this.ngPlusBonuses.goldPercent / 100;
    const goEnchGoldMult = this.enchantment?.id === "abundance" ? 1.15 : 1.0;
    const goMutGoldMult = hasMutation(this.floorMutations, MutationType.GoldenAge) ? getMutationEffect(MutationType.GoldenAge, "goldMult") : 1;
    const goTalentGoldMult = 1 + (this.talentEffects.goldPercent ?? 0) / 100;
    const goRelicGoldMult = 1 + (this.relicEffects.goldMult ?? 0);
    const gold = Math.floor(goldFromRun(this.currentFloor, this.enemiesDefeated, false) * this.modifierEffects.goldMult * goHeldGoldMult * this.difficultyMods.goldMult * ngGoGoldMult * goEnchGoldMult * goMutGoldMult * goTalentGoldMult * goRelicGoldMult);

    // Journal: record dungeon defeat with species encountered
    {
      const defeatJournal = loadJournal();
      recordDungeonDefeat(defeatJournal, this.dungeonDef.id, this.currentFloor, this.enemiesDefeated, gold);
      for (const sid of this.seenSpecies) {
        recordSpeciesEncountered(defeatJournal, this.dungeonDef.id, sid);
      }
    }

    // Hide DOM HUD and D-pad behind game over overlay
    if (this.domHud) setDomHudInteractive(this.domHud, false);
    for (const obj of this.dpadUI) { if ("setVisible" in obj && typeof (obj as Phaser.GameObjects.GameObject & {setVisible:(v:boolean)=>void}).setVisible === "function") (obj as Phaser.GameObjects.GameObject & {setVisible:(v:boolean)=>void}).setVisible(false); }

    // Full-screen opaque overlay
    this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x0a0a1a, 0.95
    ).setScrollFactor(0).setDepth(200);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, "GAME OVER", {
      fontSize: "24px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, `Fainted on B${this.currentFloor}F`, {
      fontSize: "12px", color: "#e0e0e0", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 12, `Salvaged ${gold} Gold`, {
      fontSize: "11px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 2, `Time: ${this.formatTime(this.runElapsedSeconds)}`, {
      fontSize: "10px", color: "#6b7280", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    // Daily dungeon: calculate and save score on game over
    let dailyScoreValue = 0;
    if (this.dungeonDef.id === "dailyDungeon") {
      const dailyConfig = getDailyConfig();
      dailyScoreValue = calculateDailyScore(
        this.currentFloor, this.enemiesDefeated, this.turnManager.turn, false
      );
      saveDailyScore({
        date: dailyConfig.date,
        floorsReached: this.currentFloor,
        enemiesDefeated: this.enemiesDefeated,
        turnsUsed: this.turnManager.turn,
        score: dailyScoreValue,
        cleared: false,
        starter: this.starterId,
      });
    }

    // Leaderboard: calculate and save run score on game over (with chain bonus)
    const goBaseScore = calculateScore({
      dungeonId: this.dungeonDef.id,
      starter: this.starterId,
      floorsCleared: this.currentFloor,
      enemiesDefeated: this.enemiesDefeated,
      turns: this.turnManager.turn,
      goldEarned: gold,
      cleared: false,
      totalFloors: this.dungeonDef.floors,
      challengeMode: this.challengeMode ?? undefined,
    });
    const goChainBonus = this.scoreChain.totalBonusScore;
    const goRunScore = goBaseScore + goChainBonus;
    saveRunScore({
      dungeonId: this.dungeonDef.id,
      starter: this.starterId,
      score: goRunScore,
      floorsCleared: this.currentFloor,
      enemiesDefeated: this.enemiesDefeated,
      turns: this.turnManager.turn,
      goldEarned: gold,
      cleared: false,
      date: new Date().toISOString(),
      challengeMode: this.challengeMode ?? undefined,
      difficulty: isNonNormalDifficulty(this.difficultyLevel) ? this.difficultyLevel : undefined,
    });

    // Run counter for this dungeon
    const goMeta = loadMeta();
    const goDungeonRunCount = (goMeta.dungeonRunCounts ?? {})[this.dungeonDef.id] ?? 0;

    // Chain bonus display
    const goMaxTier = getChainTier(this.scoreChain.maxChainReached);
    const goChainStr = goMaxTier
      ? `Best Chain: ${goMaxTier} (x${this.scoreChain.maxChainReached.toFixed(1)})  +${goChainBonus} pts`
      : "";

    // Stats summary
    const goStats = [
      `Run #${goDungeonRunCount}`,
      `Lv.${this.player.stats.level}  Defeated: ${this.enemiesDefeated}  Turns: ${this.turnManager.turn}`,
      this.dungeonDef.id === "dailyDungeon" ? `Daily Score: ${dailyScoreValue}` : "",
      this.isBossRush ? `Bosses Defeated: ${this.bossesDefeated}/10` : "",
      this.gauntletTotalWavesCleared > 0 ? `Gauntlet Waves: ${this.gauntletTotalWavesCleared}` : "",
      goChainStr,
      `Score: ${goRunScore}`,
    ].filter(Boolean).join("\n");
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 22, goStats, {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace", align: "center",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(201);

    // Performance grade
    const goGrade = calculatePerformanceGrade(this.runLog.getSummaryStats(), false, this.dungeonDef.floors, this.turnManager.turn);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 80, `Grade: ${goGrade}`, {
      fontSize: "14px", color: gradeColor(goGrade), fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    // ── Styled buttons ──
    const btnW = 240;
    const btnH = 36;
    const btnBaseY = GAME_HEIGHT / 2 + 108;
    const btnGap = 44;

    // Return to Town
    const rtBg = this.add.rectangle(GAME_WIDTH / 2, btnBaseY, btnW, btnH, 0x1e3a5f, 0.95)
      .setStrokeStyle(1, 0x3b82f6).setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH / 2, btnBaseY, "Return to Town", {
      fontSize: "13px", color: "#60a5fa", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    rtBg.on("pointerover", () => rtBg.setFillStyle(0x2a4a6f, 1));
    rtBg.on("pointerout", () => rtBg.setFillStyle(0x1e3a5f, 0.95));
    rtBg.on("pointerdown", () => {
      this.scene.start("HubScene", {
        gold,
        cleared: false,
        bestFloor: this.currentFloor,
        enemiesDefeated: this.enemiesDefeated,
        turns: this.turnManager.turn,
        dungeonId: this.dungeonDef.id,
        starter: this.starterId,
        challengeMode: this.challengeMode ?? undefined,
        pokemonSeen: Array.from(this.seenSpecies),
        inventory: serializeInventory(this.inventory),
        ...this.getQuestTrackingData(),
      });
    });

    // Quick Retry
    const qrBg = this.add.rectangle(GAME_WIDTH / 2, btnBaseY + btnGap, btnW, btnH, 0x3a2a1a, 0.95)
      .setStrokeStyle(1, 0xf59e0b).setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH / 2, btnBaseY + btnGap, "Quick Retry", {
      fontSize: "13px", color: "#f59e0b", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    qrBg.on("pointerover", () => qrBg.setFillStyle(0x4a3a2a, 1));
    qrBg.on("pointerout", () => qrBg.setFillStyle(0x3a2a1a, 0.95));
    qrBg.on("pointerdown", () => {
      this.quickRetry(gold, false);
    });

    // Run Summary
    const rsBg = this.add.rectangle(GAME_WIDTH / 2, btnBaseY + btnGap * 2, btnW, btnH, 0x1a0a2a, 0.95)
      .setStrokeStyle(1, 0xa855f7).setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH / 2, btnBaseY + btnGap * 2, "Run Summary", {
      fontSize: "13px", color: "#a855f7", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    rsBg.on("pointerover", () => rsBg.setFillStyle(0x2a1a3a, 1));
    rsBg.on("pointerout", () => rsBg.setFillStyle(0x1a0a2a, 0.95));
    rsBg.on("pointerdown", () => {
      this.showRunSummary(false, this.dungeonDef.floors);
    });
  }

  /**
   * Run Summary overlay — shows detailed stats, notable events, timeline, and performance grade.
   */
  private showRunSummary(cleared: boolean, totalFloors: number) {
    const stats = this.runLog.getSummaryStats();
    const grade = calculatePerformanceGrade(stats, cleared, totalFloors, this.turnManager.turn);
    const notable = this.runLog.getNotableEvents();
    const timeline = this.runLog.getTimeline();

    // Full-screen overlay
    const bg = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x0a0a1a, 0.95
    ).setScrollFactor(0).setDepth(300).setInteractive();

    const uiElements: Phaser.GameObjects.GameObject[] = [bg];

    // Title + grade
    const gradeStr = `Grade: ${grade}`;
    const titleEl = this.add.text(GAME_WIDTH / 2, 30, "RUN SUMMARY", {
      fontSize: "16px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
    uiElements.push(titleEl);

    const gradeEl = this.add.text(GAME_WIDTH / 2, 50, gradeStr, {
      fontSize: "22px", color: gradeColor(grade), fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
    uiElements.push(gradeEl);

    // Grade pulse animation
    this.tweens.add({
      targets: gradeEl,
      scaleX: 1.15, scaleY: 1.15,
      duration: 600, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
    });

    // Key stats section
    const statsLines = [
      `Enemies Defeated: ${stats.totalEnemiesDefeated}`,
      `Damage Dealt: ${stats.totalDamageDealt}`,
      `Damage Taken: ${stats.totalDamageTaken}`,
      `Items Used: ${stats.totalItemsUsed}  Picked Up: ${stats.totalItemsPickedUp}`,
      `Skills Used: ${stats.totalSkillsUsed}  Unique: ${stats.uniqueSkillsUsed}`,
      `Level Ups: ${stats.levelUps}`,
      `Floors: ${stats.floorsExplored}`,
      stats.bestChainTier ? `Best Chain: ${stats.bestChainTier}` : "",
    ].filter(Boolean).join("\n");

    const statsEl = this.add.text(GAME_WIDTH / 2, 75, statsLines, {
      fontSize: "9px", color: "#cbd5e1", fontFamily: "monospace", align: "center",
      lineSpacing: 2,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(301);
    uiElements.push(statsEl);

    // Notable events section
    let notableY = 160;
    if (stats.bossesDefeated > 0 || stats.legendariesDefeated > 0 || stats.secretRoomsFound > 0 ||
        stats.puzzlesSolved > 0 || stats.gauntletsCleared > 0 || stats.shopsVisited > 0) {
      const notableHeader = this.add.text(GAME_WIDTH / 2, notableY, "NOTABLE EVENTS", {
        fontSize: "10px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
      uiElements.push(notableHeader);
      notableY += 15;

      const notableLines: string[] = [];
      if (stats.bossesDefeated > 0) notableLines.push(`Bosses Defeated: ${stats.bossesDefeated}`);
      if (stats.legendariesDefeated > 0) notableLines.push(`Legendaries Defeated: ${stats.legendariesDefeated}`);
      if (stats.secretRoomsFound > 0) notableLines.push(`Secret Rooms: ${stats.secretRoomsFound}`);
      if (stats.puzzlesSolved > 0) notableLines.push(`Puzzles Solved: ${stats.puzzlesSolved}`);
      if (stats.gauntletsCleared > 0) notableLines.push(`Gauntlets Cleared: ${stats.gauntletsCleared}`);
      if (stats.shopsVisited > 0) notableLines.push(`Shops Visited: ${stats.shopsVisited}`);
      if (stats.weatherChanges > 0) notableLines.push(`Weather Changes: ${stats.weatherChanges}`);
      if (stats.mutationsEncountered > 0) notableLines.push(`Mutations: ${stats.mutationsEncountered}`);

      const notableEl = this.add.text(GAME_WIDTH / 2, notableY, notableLines.join("\n"), {
        fontSize: "9px", color: "#94a3b8", fontFamily: "monospace", align: "center",
        lineSpacing: 2,
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(301);
      uiElements.push(notableEl);
      notableY += notableLines.length * 12 + 10;
    }

    // Timeline section (scrollable)
    if (timeline.length > 0) {
      const timelineHeader = this.add.text(GAME_WIDTH / 2, notableY, "TIMELINE", {
        fontSize: "10px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
      uiElements.push(timelineHeader);
      notableY += 16;

      // Build timeline text lines
      const timelineLines: string[] = [];
      for (const entry of timeline) {
        timelineLines.push(`--- B${entry.floor}F ---`);
        for (const ev of entry.events) {
          timelineLines.push(`  ${ev}`);
        }
      }

      // Clamp viewable area: show timeline in a scrollable mask area
      const timelineAreaHeight = GAME_HEIGHT - notableY - 50;
      const maxVisibleLines = Math.floor(timelineAreaHeight / 11);
      let scrollOffset = 0;
      const totalLines = timelineLines.length;

      const renderTimeline = () => {
        // Remove previous timeline text elements
        const toRemove = uiElements.filter(el => (el as any).__isTimelineLine);
        for (const el of toRemove) {
          el.destroy();
          uiElements.splice(uiElements.indexOf(el), 1);
        }

        const visibleLines = timelineLines.slice(scrollOffset, scrollOffset + maxVisibleLines);
        for (let i = 0; i < visibleLines.length; i++) {
          const line = visibleLines[i];
          const isFloorHeader = line.startsWith("---");
          const lineEl = this.add.text(20, notableY + i * 11, line, {
            fontSize: "8px",
            color: isFloorHeader ? "#fbbf24" : "#94a3b8",
            fontFamily: "monospace",
            fontStyle: isFloorHeader ? "bold" : "normal",
          }).setScrollFactor(0).setDepth(301);
          (lineEl as any).__isTimelineLine = true;
          uiElements.push(lineEl);
        }

        // Scroll indicator
        if (totalLines > maxVisibleLines) {
          const pct = Math.round((scrollOffset / Math.max(1, totalLines - maxVisibleLines)) * 100);
          const scrollIndicator = this.add.text(GAME_WIDTH - 15, notableY, `${pct}%`, {
            fontSize: "8px", color: "#6b7280", fontFamily: "monospace",
          }).setOrigin(1, 0).setScrollFactor(0).setDepth(301);
          (scrollIndicator as any).__isTimelineLine = true;
          uiElements.push(scrollIndicator);
        }
      };

      renderTimeline();

      // Scroll buttons (if needed)
      if (totalLines > maxVisibleLines) {
        const scrollUpBtn = this.add.text(GAME_WIDTH - 20, notableY + 12, "[^]", {
          fontSize: "10px", color: "#60a5fa", fontFamily: "monospace",
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(302).setInteractive();
        scrollUpBtn.on("pointerdown", () => {
          scrollOffset = Math.max(0, scrollOffset - 5);
          renderTimeline();
        });
        uiElements.push(scrollUpBtn);

        const scrollDownBtn = this.add.text(GAME_WIDTH - 20, GAME_HEIGHT - 55, "[v]", {
          fontSize: "10px", color: "#60a5fa", fontFamily: "monospace",
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(302).setInteractive();
        scrollDownBtn.on("pointerdown", () => {
          scrollOffset = Math.min(totalLines - maxVisibleLines, scrollOffset + 5);
          renderTimeline();
        });
        uiElements.push(scrollDownBtn);
      }
    }

    // Close button
    const closeBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, "[Close]", {
      fontSize: "14px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(302).setInteractive();
    closeBtn.on("pointerdown", () => {
      for (const el of uiElements) el.destroy();
    });
    uiElements.push(closeBtn);
  }

  /**
   * Quick Retry / Run Again — saves run results and immediately re-enters the same dungeon.
   * Mirrors the gold/stats saving logic from HubScene.init + DungeonPreviewScene.launchDungeon.
   */
  private quickRetry(gold: number, cleared: boolean) {
    const meta = loadMeta();

    // 1. Save run results (same as HubScene.init)
    meta.gold += gold;
    meta.totalGold += gold;
    meta.totalRuns++;
    if (cleared) meta.totalClears++;
    const bestFloor = cleared ? this.dungeonDef.floors : this.currentFloor;
    if (bestFloor > meta.bestFloor) meta.bestFloor = bestFloor;
    meta.totalEnemiesDefeated += this.enemiesDefeated;
    meta.totalTurns += this.turnManager.turn;
    if (this.dungeonDef.id === "endlessDungeon" && bestFloor > meta.endlessBestFloor) {
      meta.endlessBestFloor = bestFloor;
    }
    if (cleared && this.challengeMode) {
      meta.challengeClears++;
    }
    if (this.starterId && !meta.startersUsed.includes(this.starterId)) {
      meta.startersUsed.push(this.starterId);
    }
    // Pokedex: merge seen Pokemon from this run
    const seenSet = new Set(meta.pokemonSeen);
    for (const id of this.seenSpecies) {
      seenSet.add(id);
    }
    meta.pokemonSeen = Array.from(seenSet);
    if (this.starterId && !meta.pokemonUsed.includes(this.starterId)) {
      meta.pokemonUsed.push(this.starterId);
    }
    // Auto-store inventory items from dungeon run
    const invData = serializeInventory(this.inventory);
    for (const stack of invData) {
      addToStorage(meta.storage, stack.itemId, stack.count);
    }

    // Track cleared dungeons
    if (cleared) {
      if (!meta.clearedDungeons) meta.clearedDungeons = [];
      if (!meta.clearedDungeons.includes(this.dungeonDef.id)) {
        meta.clearedDungeons.push(this.dungeonDef.id);
      }
    }

    // Journal: record quick-retry run results
    {
      const qrJournal = loadJournal();
      if (cleared) {
        recordDungeonClear(qrJournal, this.dungeonDef.id, this.dungeonDef.floors, this.runElapsedSeconds, this.enemiesDefeated, gold);
      } else {
        recordDungeonDefeat(qrJournal, this.dungeonDef.id, this.currentFloor, this.enemiesDefeated, gold);
      }
      for (const sid of this.seenSpecies) {
        recordSpeciesEncountered(qrJournal, this.dungeonDef.id, sid);
      }
    }

    // 2. Save last dungeon info
    meta.lastDungeonId = this.dungeonDef.id;
    meta.lastChallenge = this.challengeMode ?? undefined;

    // 3. Increment per-dungeon run count for the NEW run
    if (!meta.dungeonRunCounts) meta.dungeonRunCounts = {};
    meta.dungeonRunCounts[this.dungeonDef.id] = (meta.dungeonRunCounts[this.dungeonDef.id] ?? 0) + 1;

    // 4. Increment totalRuns for the new run (DungeonPreviewScene does this)
    meta.totalRuns++;

    // 4b. Update quest progress for this run
    const today = getTodayDateString();
    if (meta.questLastDate !== today) {
      meta.activeQuests = generateDailyQuests(new Date(), meta);
      meta.questLastDate = today;
    }
    if (!meta.challengeQuests || meta.challengeQuests.length === 0) {
      meta.challengeQuests = getChallengeQuests(meta);
    }
    const bestChainTier = getChainTier(this.scoreChain.maxChainReached);
    const qrBossDefeated = this.isBossRush ? this.bossesDefeated > 0 : !!this.dungeonDef.boss;
    const qrLegendaryDefeated = this.legendaryEncountered && this.legendaryEntity === null && this.legendaryEncounter === null;
    const runQuestData: RunQuestData = {
      enemiesDefeated: this.enemiesDefeated,
      cleared,
      dungeonId: this.dungeonDef.id,
      itemsCollected: this.questItemsCollected,
      floorReached: bestFloor,
      bestChainTier,
      bossDefeated: qrBossDefeated,
      legendaryDefeated: qrLegendaryDefeated,
      noItemsUsed: !this.questItemsUsed,
      turnsUsed: this.turnManager.turn,
    };
    if (meta.activeQuests && meta.activeQuests.length > 0) {
      updateQuestProgress(meta.activeQuests, runQuestData);
    }
    if (meta.challengeQuests && meta.challengeQuests.length > 0) {
      updateQuestProgress(meta.challengeQuests, runQuestData);
    }

    saveMeta(meta);
    clearDungeonSave();

    // 5. Start new dungeon (same as DungeonPreviewScene.launchDungeon)
    stopBgm();
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(450, () => {
      const launchData: Record<string, unknown> = {
        floor: 1,
        fromHub: true,
        dungeonId: this.dungeonDef.id,
        starter: this.starterId,
      };
      if (this.challengeMode) {
        launchData.challengeMode = this.challengeMode;
      }
      this.scene.start("DungeonScene", launchData);
    });
  }

  // ── Turn System ──

  private async handlePlayerAction(dir: Direction) {
    this.player.facing = dir;

    // Check Frozen — cannot act
    if (isFrozen(this.player)) {
      this.showLog(`${this.player.name} is frozen solid and can't move!`);
      await this.turnManager.executeTurn(
        () => Promise.resolve(),
        [...this.getAllyActions(), ...this.getEnemyActions()]
      );
      this.tickEntityStatus(this.player);
      this.updateHUD();
      return;
    }

    // Check Flinch — skip one turn
    if (isFlinched(this.player)) {
      this.showLog(`${this.player.name} flinched and couldn't move!`);
      await this.turnManager.executeTurn(
        () => Promise.resolve(),
        [...this.getAllyActions(), ...this.getEnemyActions()]
      );
      this.tickEntityStatus(this.player);
      this.updateHUD();
      return;
    }

    // Check Drowsy — 30% chance to fall asleep (skip turn)
    if (isDrowsySleep(this.player)) {
      this.showLog(`${this.player.name} is drowsy and fell asleep!`);
      await this.turnManager.executeTurn(
        () => Promise.resolve(),
        [...this.getAllyActions(), ...this.getEnemyActions()]
      );
      this.tickEntityStatus(this.player);
      this.updateHUD();
      return;
    }

    // Check if there's an enemy in the target direction → basic attack
    const targetX = this.player.tileX + DIR_DX[dir];
    const targetY = this.player.tileY + DIR_DY[dir];
    const targetEnemy = this.enemies.find(
      (e) => e.alive && e.tileX === targetX && e.tileY === targetY
    );

    if (targetEnemy) {
      await this.turnManager.executeTurn(
        () => this.performBasicAttack(this.player, targetEnemy),
        [...this.getAllyActions(), ...this.getEnemyActions()]
      );
    } else {
      // Check if ally is at target → swap positions
      const allyAtTarget = this.allies.find(
        a => a.alive && a.tileX === targetX && a.tileY === targetY
      );
      if (allyAtTarget) {
        await this.turnManager.executeTurn(
          () => this.swapWithAlly(this.player, allyAtTarget, dir),
          [...this.getAllyActions(), ...this.getEnemyActions()]
        );
      } else {
        const canMove = this.canEntityMove(this.player, dir);
        if (!canMove) {
          // Check for secret wall before giving up
          if (this.tryOpenSecretWall(targetX, targetY)) {
            // Secret wall was opened — move player into the revealed tile
            await this.turnManager.executeTurn(
              () => this.moveEntity(this.player, dir),
              [...this.getAllyActions(), ...this.getEnemyActions()]
            );
          } else {
            this.player.sprite!.play(`${this.player.spriteKey}-idle-${dir}`);
            return;
          }
        } else {
          await this.turnManager.executeTurn(
            () => this.moveEntity(this.player, dir),
            [...this.getAllyActions(), ...this.getEnemyActions()]
          );
        }
      }

      // PP recovery: 1 PP for a random depleted skill on movement
      this.recoverPP(this.player);

      // Check for items on ground
      const itemHere = this.floorItems.find(
        fi => fi.x === this.player.tileX && fi.y === this.player.tileY
      );
      if (itemHere) {
        this.showLog(`There's a ${itemHere.item.name} here. [줍기] to pick up.`);
      }

      this.checkTraps();
      this.checkPlayerHazard();
      this.revealNearbyTraps();
      this.checkStairs();
      this.checkShop();
      this.checkMonsterHouse();
      this.checkEventRoom();
      this.puzzleSys.checkPuzzleRoom();
      this.checkSecretRoom();
      this.checkShrine();
    }

    // Belly drain per turn (movement or attack)
    this.tickBelly();
    this.tickWeather();

    // Tick status effects (burn damage + wear-off messages)
    this.tickEntityStatus(this.player);
    this.tickShadowDance();
    this.updateHUD();

    // Check exploration reward tiers after each action
    this.checkExplorationRewards();

    if (!this.player.alive && !this.gameOver) {
      this.showGameOver();
    }
  }

  private async handleSkillUse(skillIndex: number, dir: Direction) {
    const skill = this.player.skills[skillIndex];
    if (!skill || skill.currentPp <= 0) return;

    this.player.facing = dir;
    const extraPpCost = getBlessingEffect(this.activeBlessings, "extraPpCost");
    skill.currentPp = Math.max(0, skill.currentPp - 1 - extraPpCost);

    await this.turnManager.executeTurn(
      () => this.performSkill(this.player, skill, dir),
      this.getEnemyActions()
    );

    // ── Skill Combo tracking ──
    this.recentSkillIds.push(skill.id);
    if (this.recentSkillIds.length > 3) this.recentSkillIds.shift();
    const combo = checkCombo(this.recentSkillIds);
    if (combo) {
      this.triggerSkillCombo(combo);
      this.recentSkillIds = []; // reset to prevent infinite chaining
    }

    // If combo gave speed boost, grant an extra action
    if (this.comboSpeedBoost) {
      this.comboSpeedBoost = false;
      // Don't tick belly/weather/status for the bonus turn — just allow another action
      this.updateHUD();
      return;
    }

    // Haste enchantment: 15% chance to act twice (extra turn without enemies moving)
    if (this.enchantment?.id === "haste" && Math.random() < 0.15) {
      this.showLog("Haste! Extra action!");
      this.updateHUD();
      return;
    }

    // Relic: Swift Feather — extra turn chance
    if ((this.relicEffects.extraTurnChance ?? 0) > 0 && Math.random() < this.relicEffects.extraTurnChance) {
      this.showLog("Swift Feather! Extra action!");
      this.updateHUD();
      return;
    }

    this.tickBelly();
    this.tickWeather();
    this.tickEntityStatus(this.player);
    this.tickShadowDance();
    this.updateHUD();

    if (!this.player.alive && !this.gameOver) {
      this.showGameOver();
    }
  }

  /** Decrement Shadow Dance dodge turns and notify when expired */
  private tickShadowDance() {
    if (this.comboShadowDanceTurns > 0) {
      this.comboShadowDanceTurns--;
      if (this.comboShadowDanceTurns <= 0) {
        this.showLog("Shadow Dance wore off!");
        if (this.player.sprite) this.player.sprite.setAlpha(1.0);
      }
    }
  }

  /** Trigger a skill combo effect: popup, camera shake, SFX, and apply effect */
  private triggerSkillCombo(combo: SkillCombo) {
    // SFX
    sfxCombo();

    // Camera shake
    this.cameras.main.shake(200, 0.01);

    // Gold "COMBO: {name}!" popup at player position
    const px = this.player.sprite ? this.player.sprite.x : this.tileToPixelX(this.player.tileX);
    const py = this.player.sprite ? this.player.sprite.y : this.tileToPixelY(this.player.tileY);
    const comboText = this.add.text(px, py - 30, `COMBO: ${combo.name}!`, {
      fontSize: "14px",
      color: "#ffd700",
      fontFamily: "monospace",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(310);

    this.tweens.add({
      targets: comboText,
      y: py - 70,
      alpha: { from: 1, to: 0 },
      scaleX: { from: 1.2, to: 0.8 },
      scaleY: { from: 1.2, to: 0.8 },
      duration: 1200,
      ease: "Quad.easeOut",
      onComplete: () => comboText.destroy(),
    });

    // Log message
    this.showLog(`COMBO: ${combo.name}! ${combo.description}`);

    // Apply combo effect
    switch (combo.effect) {
      case ComboEffect.DoubleDamage:
        this.comboDoubleDamage = true;
        this.showLog("Next skill will deal 2x damage!");
        break;

      case ComboEffect.AreaBlast: {
        // Deal damage to all enemies in the current room (or radius 3)
        const blastDmg = Math.max(1, Math.floor(getEffectiveAtk(this.player) * 0.6));
        let hitCount = 0;
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue;
          const dist = chebyshevDist(this.player.tileX, this.player.tileY, enemy.tileX, enemy.tileY);
          if (dist <= 5) { // room-ish radius
            enemy.stats.hp = Math.max(0, enemy.stats.hp - blastDmg);
            hitCount++;
            if (enemy.sprite) {
              this.showDamagePopup(enemy.sprite.x, enemy.sprite.y, blastDmg, 1.0);
              this.showEnemyHpBar(enemy);
              this.flashEntity(enemy, 1.5);
            }
            this.checkDeath(enemy);
          }
        }
        if (hitCount > 0) {
          this.showLog(`Area blast hit ${hitCount} enemies for ${blastDmg} damage each!`);
        }
        break;
      }

      case ComboEffect.HealBurst: {
        const healAmt = Math.floor(this.player.stats.maxHp * 0.3);
        this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + healAmt);
        this.showLog(`Heal burst restored ${healAmt} HP!`);
        if (this.player.sprite) {
          this.player.sprite.setTint(0x44ff44);
          this.showHealPopup(this.player.sprite.x, this.player.sprite.y, healAmt);
          this.time.delayedCall(300, () => {
            if (this.player.sprite) this.player.sprite.clearTint();
          });
        }
        break;
      }

      case ComboEffect.SpeedBoost:
        this.comboSpeedBoost = true;
        this.showLog("Speed Boost! You can act again this turn!");
        break;

      case ComboEffect.CritGuarantee:
        this.comboCritGuarantee = true;
        this.showLog("Next attack is a guaranteed critical hit!");
        break;

      case ComboEffect.ElementalStorm: {
        // AoE 200% ATK damage to all visible enemies
        const stormDmg = Math.max(1, Math.floor(getEffectiveAtk(this.player) * 2.0));
        let stormHits = 0;
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue;
          const dist = chebyshevDist(this.player.tileX, this.player.tileY, enemy.tileX, enemy.tileY);
          if (dist <= 6) {
            enemy.stats.hp = Math.max(0, enemy.stats.hp - stormDmg);
            stormHits++;
            if (enemy.sprite) {
              this.showDamagePopup(enemy.sprite.x, enemy.sprite.y, stormDmg, 2.0);
              this.showEnemyHpBar(enemy);
              this.flashEntity(enemy, 2.0);
            }
            this.checkDeath(enemy);
          }
        }
        if (stormHits > 0) {
          this.showLog(`Elemental Storm hit ${stormHits} enemies for ${stormDmg} damage each!`);
        }
        break;
      }

      case ComboEffect.NaturesWrath: {
        // Heal 30% max HP + ATK boost for 3 turns
        const wrathHeal = Math.floor(this.player.stats.maxHp * 0.3);
        this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + wrathHeal);
        if (this.player.sprite) {
          this.showHealPopup(this.player.sprite.x, this.player.sprite.y, wrathHeal);
          this.player.sprite.setTint(0x44ff44);
          this.time.delayedCall(300, () => { if (this.player.sprite) this.player.sprite.clearTint(); });
        }
        // Add ATK boost for 3 turns (uses existing AtkUp status effect)
        this.player.statusEffects = this.player.statusEffects.filter(s => s.type !== SkillEffect.AtkUp);
        this.player.statusEffects.push({ type: SkillEffect.AtkUp, turnsLeft: 3 });
        this.showLog(`Nature's Wrath restored ${wrathHeal} HP and boosted ATK for 3 turns!`);
        break;
      }

      case ComboEffect.ShadowDance:
        // 100% dodge for next 2 turns
        this.comboShadowDanceTurns = 2;
        this.showLog("Shadow Dance! You will dodge all attacks for 2 turns!");
        if (this.player.sprite) {
          this.player.sprite.setAlpha(0.5);
          this.time.delayedCall(400, () => { if (this.player.sprite) this.player.sprite.setAlpha(1.0); });
        }
        break;

      case ComboEffect.IronWallCombo: {
        // DEF +50% for 5 turns (uses existing DefUp status effect)
        this.player.statusEffects = this.player.statusEffects.filter(s => s.type !== SkillEffect.DefUp);
        this.player.statusEffects.push({ type: SkillEffect.DefUp, turnsLeft: 5 });
        this.showLog("Iron Wall! DEF +50% for 5 turns!");
        break;
      }

      case ComboEffect.FairyRing: {
        // Remove all negative status effects + heal 20% HP
        const negativeEffects = [
          SkillEffect.Burn, SkillEffect.Paralyze, SkillEffect.Frozen,
          SkillEffect.BadlyPoisoned, SkillEffect.Flinch, SkillEffect.Drowsy, SkillEffect.Cursed,
        ];
        const removedCount = this.player.statusEffects.filter(s => negativeEffects.includes(s.type)).length;
        this.player.statusEffects = this.player.statusEffects.filter(s => !negativeEffects.includes(s.type));
        const fairyHeal = Math.floor(this.player.stats.maxHp * 0.2);
        this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + fairyHeal);
        if (this.player.sprite) {
          this.showHealPopup(this.player.sprite.x, this.player.sprite.y, fairyHeal);
          this.player.sprite.setTint(0xffaaff);
          this.time.delayedCall(300, () => { if (this.player.sprite) this.player.sprite.clearTint(); });
        }
        this.updateStatusTint(this.player);
        let fairyMsg = `Fairy Ring healed ${fairyHeal} HP`;
        if (removedCount > 0) fairyMsg += ` and removed ${removedCount} ailment${removedCount > 1 ? "s" : ""}`;
        fairyMsg += "!";
        this.showLog(fairyMsg);
        break;
      }

      case ComboEffect.DragonsRage:
        // Next attack deals 3x damage
        this.comboDragonsRage = true;
        this.showLog("Dragon's Rage! Next attack deals 3x damage!");
        break;

      case ComboEffect.BlizzardRush: {
        // Freeze all adjacent enemies (Chebyshev dist <= 1)
        let frozenCount = 0;
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue;
          const dist = chebyshevDist(this.player.tileX, this.player.tileY, enemy.tileX, enemy.tileY);
          if (dist <= 1) {
            if (!enemy.statusEffects.some(s => s.type === SkillEffect.Frozen)) {
              const frozenTurns = 2 + Math.floor(Math.random() * 2); // 2-3 turns
              enemy.statusEffects.push({ type: SkillEffect.Frozen, turnsLeft: frozenTurns });
              frozenCount++;
              if (enemy.sprite) {
                enemy.sprite.setTint(0x88ccff);
                this.time.delayedCall(300, () => { if (enemy.sprite) this.updateStatusTint(enemy); });
              }
            }
          }
        }
        if (frozenCount > 0) {
          this.showLog(`Blizzard Rush froze ${frozenCount} adjacent enem${frozenCount > 1 ? "ies" : "y"}!`);
        } else {
          this.showLog("Blizzard Rush! No adjacent enemies to freeze.");
        }
        break;
      }

      case ComboEffect.ToxicChain: {
        // Apply Badly Poisoned to all enemies in room
        let poisonedCount = 0;
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue;
          const dist = chebyshevDist(this.player.tileX, this.player.tileY, enemy.tileX, enemy.tileY);
          if (dist <= 5) { // room-ish radius
            if (!enemy.statusEffects.some(s => s.type === SkillEffect.BadlyPoisoned)) {
              enemy.statusEffects.push({ type: SkillEffect.BadlyPoisoned, turnsLeft: 8, poisonCounter: 0 });
              poisonedCount++;
              if (enemy.sprite) {
                enemy.sprite.setTint(0x9944cc);
                this.time.delayedCall(300, () => { if (enemy.sprite) this.updateStatusTint(enemy); });
              }
            }
          }
        }
        if (poisonedCount > 0) {
          this.showLog(`Toxic Chain badly poisoned ${poisonedCount} enem${poisonedCount > 1 ? "ies" : "y"} in the room!`);
        } else {
          this.showLog("Toxic Chain! No enemies to poison nearby.");
        }
        break;
      }
    }

    this.updateHUD();
  }

  private canEntityMove(entity: Entity, dir: Direction): boolean {
    const nx = entity.tileX + DIR_DX[dir];
    const ny = entity.tileY + DIR_DY[dir];
    if (!canMoveTo(nx, ny, this.dungeon.terrain, this.dungeon.width, this.dungeon.height, this.allEntities, entity)) {
      return false;
    }
    return canMoveDiagonal(entity.tileX, entity.tileY, dir, this.dungeon.terrain, this.dungeon.width, this.dungeon.height);
  }

  private moveEntity(entity: Entity, dir: Direction): Promise<void> {
    return new Promise((resolve) => {
      entity.facing = dir;
      entity.tileX += DIR_DX[dir];
      entity.tileY += DIR_DY[dir];
      entity.sprite!.play(`${entity.spriteKey}-walk-${dir}`);

      this.tweens.add({
        targets: entity.sprite,
        x: this.tileToPixelX(entity.tileX),
        y: this.tileToPixelY(entity.tileY),
        duration: MOVE_DURATION,
        ease: "Linear",
        onComplete: () => {
          entity.sprite!.play(`${entity.spriteKey}-idle-${dir}`);
          resolve();
        },
      });
    });
  }

  /** Swap positions with an ally (player walks into ally's tile) */
  private swapWithAlly(player: Entity, ally: Entity, dir: Direction): Promise<void> {
    return new Promise((resolve) => {
      const oldPx = player.tileX, oldPy = player.tileY;
      const oldAx = ally.tileX, oldAy = ally.tileY;

      player.facing = dir;
      player.tileX = oldAx;
      player.tileY = oldAy;
      ally.tileX = oldPx;
      ally.tileY = oldPy;

      player.sprite!.play(`${player.spriteKey}-walk-${dir}`);

      let done = 0;
      const checkDone = () => { if (++done >= 2) resolve(); };

      this.tweens.add({
        targets: player.sprite,
        x: this.tileToPixelX(player.tileX),
        y: this.tileToPixelY(player.tileY),
        duration: MOVE_DURATION, ease: "Linear",
        onComplete: () => {
          player.sprite!.play(`${player.spriteKey}-idle-${dir}`);
          checkDone();
        },
      });

      this.tweens.add({
        targets: ally.sprite,
        x: this.tileToPixelX(ally.tileX),
        y: this.tileToPixelY(ally.tileY),
        duration: MOVE_DURATION, ease: "Linear",
        onComplete: () => {
          if (ally.sprite) ally.sprite.play(`${ally.spriteKey}-idle-${ally.facing}`);
          checkDone();
        },
      });
    });
  }

  /** PP recovery: on move, recover 1 PP on a random depleted skill */
  private recoverPP(entity: Entity) {
    const depleted = entity.skills.filter(s => s.currentPp < s.pp);
    if (depleted.length > 0) {
      const pick = depleted[Math.floor(Math.random() * depleted.length)];
      pick.currentPp = Math.min(pick.pp, pick.currentPp + 1);
    }
  }

  // ── Combat ──

  /** Basic (non-skill) attack — front 1 tile, uses entity's attackType */
  private performBasicAttack(attacker: Entity, defender: Entity): Promise<void> {
    return new Promise((resolve) => {
      const dir = attacker === this.player
        ? attacker.facing
        : directionToPlayer(attacker, this.player);
      attacker.facing = dir;
      attacker.sprite!.play(`${attacker.spriteKey}-idle-${dir}`);

      // Shadow Dance combo: 100% dodge for player
      if (defender === this.player && this.comboShadowDanceTurns > 0) {
        sfxDodge();
        this.showLog(`${defender.name} dodged with Shadow Dance!`);
        if (defender.sprite) {
          this.showDamagePopup(defender.sprite.x, defender.sprite.y, 0, 1, "Shadow Dance!");
        }
        this.updateHUD();
        this.time.delayedCall(250, resolve);
        return;
      }

      // Held item + ability dodge chance (defender is player)
      let dodgeChance = this.heldItemEffect.dodgeChance ?? 0;
      // Ability: Run Away / Levitate dodge bonus at higher levels
      if (defender.ability === AbilityId.RunAway) dodgeChance += getRunAwayDodgeBonus(defender.abilityLevel ?? 1) * 100;
      if (defender.ability === AbilityId.Levitate) dodgeChance += getLevitateDodgeBonus(defender.abilityLevel ?? 1) * 100;
      // Blessing: Swift Step dodge chance bonus
      if (defender === this.player) dodgeChance += getBlessingEffect(this.activeBlessings, "dodgeChance") * 100;
      if (defender === this.player && dodgeChance > 0 && Math.random() * 100 < dodgeChance) {
        sfxDodge();
        this.showLog(`${defender.name} dodged ${attacker.name}'s attack!`);
        if (defender.sprite) {
          this.showDamagePopup(defender.sprite.x, defender.sprite.y, 0, 1, "Dodged!");
        }
        this.updateHUD();
        this.time.delayedCall(250, resolve);
        return;
      }

      let effectiveness = getEffectiveness(attacker.attackType, defender.types);
      // InverseFloor: reverse type effectiveness
      if (this.floorEvent?.type === FloorEventType.InverseFloor) {
        effectiveness = invertEffectiveness(effectiveness);
      }
      const effText = effectivenessText(effectiveness);

      let atk = getEffectiveAtk(attacker);
      let def = getEffectiveDef(defender);
      // Relic: ATK/DEF multipliers (player only)
      if (attacker === this.player) atk = Math.floor(atk * (1 + (this.relicEffects.atkMult ?? 0)));
      if (defender === this.player) def = Math.floor(def * (1 + (this.relicEffects.defMult ?? 0)));
      // Blessing: ATK/DEF multipliers (player only)
      if (attacker === this.player) atk = Math.floor(atk * (1 + getBlessingEffect(this.activeBlessings, "atkMult")));
      if (defender === this.player) def = Math.floor(def * (1 + getBlessingEffect(this.activeBlessings, "defMult")));
      const baseDmg = Math.max(1, atk - Math.floor(def / 2));
      // Ability: Torrent — scaled by ability level
      let abilityMult = 1.0;
      if (attacker.ability === AbilityId.Torrent &&
          attacker.attackType === PokemonType.Water) {
        const torrent = getTorrentValues(attacker.abilityLevel ?? 1);
        if (attacker.stats.hp < attacker.stats.maxHp * torrent.threshold) {
          abilityMult = torrent.multiplier;
        }
      }
      const wMult = weatherDamageMultiplier(this.currentWeather, attacker.attackType);
      // Weather intensity scales the weather multiplier deviation from 1.0
      const intensityMult = INTENSITY_MULTIPLIER[this.currentWeatherIntensity];
      const scaledWMult = wMult === 1.0 ? 1.0 : 1.0 + (wMult - 1.0) * intensityMult;
      // Weather synergy bonus for matching pokemon type
      const synergyBonus = (attacker === this.player)
        ? 1.0 + getWeatherSynergyBonus(this.currentWeather, attacker.attackType)
        : 1.0;
      // Held item + Relic: crit chance (attacker is player)
      const critChance = (this.heldItemEffect.critChance ?? 0) + (attacker === this.player ? (this.relicEffects.critBonus ?? 0) : 0);
      const isCrit = attacker === this.player && critChance > 0 && Math.random() * 100 < critChance;
      const critMult = isCrit ? 1.5 : 1.0;
      // Relic: Wide Glass — type advantage bonus (player attacking with super effective)
      const relicTypeAdvMult = (attacker === this.player && effectiveness >= 2.0 && (this.relicEffects.typeAdvantageBonus ?? 0) > 0) ? (1 + this.relicEffects.typeAdvantageBonus) : 1.0;
      // Apply difficulty playerDamageMult when defender is the player
      const diffDmgMult = defender === this.player ? this.difficultyMods.playerDamageMult : 1.0;
      // Type Gem boost: +50% if player has active gem matching attack type
      const basicGemBoost = (attacker === this.player && this.activeTypeGems.has(attacker.attackType))
        ? 1 + (this.activeTypeGems.get(attacker.attackType)! / 100) : 1.0;
      const dmg = Math.max(1, Math.floor(baseDmg * effectiveness * abilityMult * scaledWMult * synergyBonus * critMult * relicTypeAdvMult * diffDmgMult * basicGemBoost));
      defender.stats.hp = Math.max(0, defender.stats.hp - dmg);

      // Fire-type attacks thaw frozen targets
      if (attacker.attackType === PokemonType.Fire && thawEntity(defender)) {
        this.showLog(`${defender.name} was thawed by the fire attack!`);
        this.updateStatusTint(defender);
      }

      // Sound effects based on effectiveness
      if (isCrit) sfxCritical();
      else if (effectiveness >= 2) sfxSuperEffective();
      else if (effectiveness <= 0.5 && effectiveness > 0) sfxNotEffective();
      else sfxHit();

      this.flashEntity(defender, effectiveness);
      if (isCrit) this.showCritFlash(defender);
      if (defender.sprite) {
        this.showDamagePopup(defender.sprite.x, defender.sprite.y, dmg, effectiveness, undefined, isCrit, attacker.attackType);
        if (defender !== this.player) this.showEnemyHpBar(defender);
      }

      let logMsg = `${attacker.name} attacks ${defender.name}! ${dmg} dmg!`;
      if (isCrit) logMsg += " Critical hit!";
      if (effText) logMsg += ` ${effText}`;
      if (abilityMult > 1) logMsg += " (Torrent!)";
      if (scaledWMult !== 1.0) logMsg += ` (${WEATHERS[this.currentWeather].name}!)`;
      if (synergyBonus > 1.0) logMsg += " (Weather Synergy!)";
      if (basicGemBoost > 1.0) logMsg += ` (${attacker.attackType} Gem!)`;
      this.showLog(logMsg);

      // Run log: damage dealt/taken (basic attack)
      if (attacker === this.player) {
        this.runLog.add(RunLogEvent.DamageDealt, `${dmg}`, this.currentFloor, this.turnManager.turn);
      } else if (defender === this.player) {
        this.runLog.add(RunLogEvent.DamageTaken, `${dmg}`, this.currentFloor, this.turnManager.turn);
      }

      // Relic: Shell Bell — heal % of damage dealt (player attacking)
      if (attacker === this.player && dmg > 0 && (this.relicEffects.lifeStealPercent ?? 0) > 0) {
        const shellHeal = Math.max(1, Math.floor(dmg * this.relicEffects.lifeStealPercent / 100));
        if (this.player.stats.hp < this.player.stats.maxHp) {
          this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + shellHeal);
          if (this.player.sprite) this.showHealPopup(this.player.sprite.x, this.player.sprite.y, shellHeal);
        }
      }

      // Score chain: type-effective basic attack by player
      if (attacker === this.player && effectiveness >= 2.0) {
        addChainAction(this.scoreChain, "effective");
        this.chainActionThisTurn = true;
        this.updateChainHUD();
      }
      // Score chain: player took damage from basic attack → reset chain
      if (defender === this.player && dmg > 0) {
        if (this.scoreChain.currentMultiplier > 1.0) {
          resetChain(this.scoreChain);
          this.showLog("Chain broken!");
          this.updateChainHUD();
        }
      }

      // Ability: Static — paralyze chance scaled by ability level
      if (defender.ability === AbilityId.Static && Math.random() < getStaticChance(defender.abilityLevel ?? 1)) {
        if (!attacker.statusEffects.some(s => s.type === SkillEffect.Paralyze)) {
          attacker.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 2 });
          this.showLog(`${defender.name}'s Static paralyzed ${attacker.name}!`);
        }
      }

      // Ability: Flame Body — burn chance scaled by ability level
      if (defender.ability === AbilityId.FlameBody && Math.random() < getFlameBodyChance(defender.abilityLevel ?? 1)) {
        if (!attacker.statusEffects.some(s => s.type === SkillEffect.Burn)) {
          attacker.statusEffects.push({ type: SkillEffect.Burn, turnsLeft: 3 });
          this.showLog(`${defender.name}'s Flame Body burned ${attacker.name}!`);
        }
      }

      // Thorns enchantment: reflect 10% damage back to attacker when player is hit
      if (this.enchantment?.id === "thorns" && defender === this.player && attacker.alive && dmg > 0) {
        const thornsDmg = Math.max(1, Math.floor(dmg * 0.1));
        attacker.stats.hp = Math.max(0, attacker.stats.hp - thornsDmg);
        if (attacker.sprite) {
          this.showDamagePopup(attacker.sprite.x, attacker.sprite.y, thornsDmg, 1.0, `${thornsDmg} Thorns`);
        }
        this.showLog(`Thorns reflected ${thornsDmg} damage!`);
        this.checkDeath(attacker);
      }

      // WindyFloor: knockback defender 1 tile away from attacker
      if (this.floorEvent?.type === FloorEventType.WindyFloor && defender.alive && defender.sprite) {
        this.applyWindyKnockback(attacker, defender);
      }

      this.updateHUD();
      this.checkDeath(defender);
      this.time.delayedCall(250, resolve);
    });
  }

  /** Skill-based attack — variable range, typed damage, effects */
  private performSkill(user: Entity, skill: Skill, dir: Direction): Promise<void> {
    return new Promise((resolve) => {
      user.facing = dir;
      user.sprite!.play(`${user.spriteKey}-idle-${dir}`);

      sfxSkill();

      // Run log: skill used (only player skills)
      if (user === this.player) {
        this.runLog.add(RunLogEvent.SkillUsed, skill.name, this.currentFloor, this.turnManager.turn);
      }

      // Self-targeting (buff/heal)
      if (skill.range === SkillRange.Self) {
        this.applySkillEffect(user, user, skill);
        this.showLog(`${user.name} used ${skill.name}!`);
        this.time.delayedCall(250, resolve);
        return;
      }

      // Get target tiles
      const tiles = getSkillTargetTiles(
        skill.range, user.tileX, user.tileY, dir,
        this.dungeon.terrain, this.dungeon.width, this.dungeon.height
      );

      // Show visual effect on target tiles
      this.showSkillEffect(tiles, skill);

      // Find entities on those tiles (friendly fire prevention)
      const isUserFriendly = user === this.player || user.isAlly;
      const targets = this.allEntities.filter(e => {
        if (!e.alive || e === user) return false;
        if (!tiles.some(t => t.x === e.tileX && t.y === e.tileY)) return false;
        // Friendly = player or ally; don't hit same team
        const isTargetFriendly = e === this.player || e.isAlly;
        return isUserFriendly !== isTargetFriendly;
      });

      if (targets.length === 0) {
        this.showLog(`${user.name} used ${skill.name}! But it missed!`);
        this.time.delayedCall(200, resolve);
        return;
      }

      // Apply damage to each target
      let totalHits = 0;
      for (const target of targets) {
        // Accuracy check (NoGuard: always hit)
        const noGuard = user.ability === AbilityId.NoGuard || target.ability === AbilityId.NoGuard;
        if (!noGuard && Math.random() * 100 > skill.accuracy) {
          this.showLog(`${user.name}'s ${skill.name} missed ${target.name}!`);
          continue;
        }

        if (skill.power > 0) {
          // Shadow Dance combo: 100% dodge for player against enemy skills
          if (target === this.player && this.comboShadowDanceTurns > 0) {
            sfxDodge();
            this.showLog(`${target.name} dodged ${user.name}'s ${skill.name} with Shadow Dance!`);
            if (target.sprite) {
              this.showDamagePopup(target.sprite.x, target.sprite.y, 0, 1, "Shadow Dance!");
            }
            continue;
          }
          // Held item + ability dodge chance (target is player, attacker is enemy)
          let skillDodge = this.heldItemEffect.dodgeChance ?? 0;
          if (target.ability === AbilityId.RunAway) skillDodge += getRunAwayDodgeBonus(target.abilityLevel ?? 1) * 100;
          if (target.ability === AbilityId.Levitate) skillDodge += getLevitateDodgeBonus(target.abilityLevel ?? 1) * 100;
          if (target === this.player && !user.isAlly && user !== this.player && skillDodge > 0 && Math.random() * 100 < skillDodge) {
            sfxDodge();
            this.showLog(`${target.name} dodged ${user.name}'s ${skill.name}!`);
            if (target.sprite) {
              this.showDamagePopup(target.sprite.x, target.sprite.y, 0, 1, "Dodged!");
            }
            continue;
          }

          let effectiveness = getEffectiveness(skill.type, target.types);
          // InverseFloor: reverse type effectiveness
          if (this.floorEvent?.type === FloorEventType.InverseFloor) {
            effectiveness = invertEffectiveness(effectiveness);
          }
          const effText = effectivenessText(effectiveness);
          let skillAtk = getEffectiveAtk(user);
          let skillDef = getEffectiveDef(target);
          // Relic: ATK/DEF multipliers (player only)
          if (user === this.player) skillAtk = Math.floor(skillAtk * (1 + (this.relicEffects.atkMult ?? 0)));
          if (target === this.player) skillDef = Math.floor(skillDef * (1 + (this.relicEffects.defMult ?? 0)));
          const baseDmg = Math.max(1, Math.floor(skill.power * skillAtk / 10) - Math.floor(skillDef / 2));
          const wMult = weatherDamageMultiplier(this.currentWeather, skill.type);
          // Weather intensity scales the weather multiplier deviation from 1.0
          const skillIntensityMult = INTENSITY_MULTIPLIER[this.currentWeatherIntensity];
          const skillScaledWMult = wMult === 1.0 ? 1.0 : 1.0 + (wMult - 1.0) * skillIntensityMult;
          // Weather synergy bonus for matching pokemon type (player only)
          const skillSynergyBonus = (user === this.player)
            ? 1.0 + getWeatherSynergyBonus(this.currentWeather, user.attackType)
            : 1.0;
          // Held item + Relic: crit chance (user is player)
          const skillCritChance = (this.heldItemEffect.critChance ?? 0) + (user === this.player ? (this.relicEffects.critBonus ?? 0) : 0);
          const skillIsCrit = user === this.player && (this.comboCritGuarantee || (skillCritChance > 0 && Math.random() * 100 < skillCritChance));
          const skillCritMult = skillIsCrit ? 1.5 : 1.0;
          // Skill Combo: damage multiplier (Dragon's Rage 3x > DoubleDamage 2x)
          const comboMult = (user === this.player && this.comboDragonsRage) ? 3.0
            : (user === this.player && this.comboDoubleDamage) ? 2.0 : 1.0;
          // Relic: Wide Glass — type advantage bonus
          const skillRelicTypeAdvMult = (user === this.player && effectiveness >= 2.0 && (this.relicEffects.typeAdvantageBonus ?? 0) > 0) ? (1 + this.relicEffects.typeAdvantageBonus) : 1.0;
          // Apply difficulty playerDamageMult when target is the player
          const skillDiffDmgMult = target === this.player ? this.difficultyMods.playerDamageMult : 1.0;
          // Type Gem boost: +50% if player has active gem matching skill type
          const typeGemBoost = (user === this.player && this.activeTypeGems.has(skill.type))
            ? 1 + (this.activeTypeGems.get(skill.type)! / 100) : 1.0;
          const dmg = Math.max(1, Math.floor(baseDmg * effectiveness * skillScaledWMult * skillSynergyBonus * skillCritMult * comboMult * skillRelicTypeAdvMult * skillDiffDmgMult * typeGemBoost));
          target.stats.hp = Math.max(0, target.stats.hp - dmg);

          // Fire-type skills thaw frozen targets
          if (skill.type === PokemonType.Fire && thawEntity(target)) {
            this.showLog(`${target.name} was thawed by the fire attack!`);
            this.updateStatusTint(target);
          }

          this.flashEntity(target, effectiveness);
          if (skillIsCrit) this.showCritFlash(target);
          if (target.sprite) {
            this.showDamagePopup(target.sprite.x, target.sprite.y, dmg, effectiveness, undefined, skillIsCrit, skill.type);
            if (target !== this.player) this.showEnemyHpBar(target);
          }

          if (skillIsCrit) sfxCritical();

          let logMsg = `${user.name}'s ${skill.name} hit ${target.name}! ${dmg} dmg!`;
          if (skillIsCrit) logMsg += " Critical hit!";
          if (effText) logMsg += ` ${effText}`;
          if (skillScaledWMult !== 1.0) logMsg += ` (${WEATHERS[this.currentWeather].name}!)`;
          if (skillSynergyBonus > 1.0) logMsg += " (Weather Synergy!)";
          if (typeGemBoost > 1.0) logMsg += ` (${skill.type} Gem!)`;
          this.showLog(logMsg);

          // Run log: damage dealt/taken (skill attack)
          if (user === this.player) {
            this.runLog.add(RunLogEvent.DamageDealt, `${dmg}`, this.currentFloor, this.turnManager.turn);
          } else if (target === this.player) {
            this.runLog.add(RunLogEvent.DamageTaken, `${dmg}`, this.currentFloor, this.turnManager.turn);
          }

          // Relic: Shell Bell — heal % of damage dealt (player using skill)
          if (user === this.player && dmg > 0 && (this.relicEffects.lifeStealPercent ?? 0) > 0) {
            const skillShellHeal = Math.max(1, Math.floor(dmg * this.relicEffects.lifeStealPercent / 100));
            if (this.player.stats.hp < this.player.stats.maxHp) {
              this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + skillShellHeal);
              if (this.player.sprite) this.showHealPopup(this.player.sprite.x, this.player.sprite.y, skillShellHeal);
            }
          }

          // Score chain: type-effective hit by player
          if (user === this.player && effectiveness >= 2.0) {
            addChainAction(this.scoreChain, "effective");
            this.chainActionThisTurn = true;
            this.updateChainHUD();
          }
          // Score chain: player took damage → reset chain
          if (target === this.player && dmg > 0) {
            if (this.scoreChain.currentMultiplier > 1.0) {
              resetChain(this.scoreChain);
              this.showLog("Chain broken!");
              this.updateChainHUD();
            }
          }

          // Thorns enchantment: reflect 10% damage back when player is hit by skill
          if (this.enchantment?.id === "thorns" && target === this.player && user.alive && dmg > 0) {
            const skillThornsDmg = Math.max(1, Math.floor(dmg * 0.1));
            user.stats.hp = Math.max(0, user.stats.hp - skillThornsDmg);
            if (user.sprite) {
              this.showDamagePopup(user.sprite.x, user.sprite.y, skillThornsDmg, 1.0, `${skillThornsDmg} Thorns`);
            }
            this.showLog(`Thorns reflected ${skillThornsDmg} damage!`);
            this.checkDeath(user);
          }

          totalHits++;
        }

        // Apply effect
        this.applySkillEffect(user, target, skill);
        this.updateHUD();
        this.checkDeath(target);
      }

      // Consume combo flags after applying them
      if (user === this.player) {
        if (this.comboDoubleDamage) this.comboDoubleDamage = false;
        if (this.comboCritGuarantee) this.comboCritGuarantee = false;
        if (this.comboDragonsRage) this.comboDragonsRage = false;
      }

      if (totalHits === 0 && skill.power > 0) {
        this.showLog(`${user.name} used ${skill.name}!`);
      }

      // ── Team Combo Attack ──
      // Only triggers on player attacks with power, when allies exist
      if (user === this.player && skill.power > 0 && totalHits > 0 && this.allies.length > 0) {
        for (const target of targets) {
          if (!target.alive) continue;
          // Find allies adjacent to this target (Chebyshev distance = 1)
          const adjacentAllies = this.allies.filter(ally => {
            if (!ally.alive) return false;
            const dx = Math.abs(ally.tileX - target.tileX);
            const dy = Math.abs(ally.tileY - target.tileY);
            return dx <= 1 && dy <= 1 && (dx + dy > 0);
          });

          if (adjacentAllies.length > 0 && Math.random() < 0.25) {
            const comboAlly = adjacentAllies[Math.floor(Math.random() * adjacentAllies.length)];
            const comboAtk = getEffectiveAtk(comboAlly);
            const comboDmg = Math.max(1, Math.floor(comboAtk * 0.5));
            target.stats.hp = Math.max(0, target.stats.hp - comboDmg);

            // Log
            this.showLog(`COMBO! ${comboAlly.name} follows up for ${comboDmg} damage!`);
            sfxCombo();

            // Camera shake
            this.cameras.main.shake(100, 0.005);

            // Flash the ally sprite
            if (comboAlly.sprite) {
              this.tweens.add({
                targets: comboAlly.sprite,
                alpha: { from: 1, to: 0.3 },
                duration: 100,
                yoyo: true,
                repeat: 1,
              });
            }

            // Damage popup on target
            if (target.sprite) {
              this.showDamagePopup(target.sprite.x, target.sprite.y, comboDmg, 1.0);
              this.showEnemyHpBar(target);
            }

            // "COMBO!" floating text at target position
            const comboTextX = target.tileX * TILE_DISPLAY + TILE_DISPLAY / 2;
            const comboTextY = target.tileY * TILE_DISPLAY - 20;
            const comboText = this.add.text(comboTextX, comboTextY, "COMBO!", {
              fontSize: "12px",
              color: "#fbbf24",
              fontFamily: "monospace",
              fontStyle: "bold",
              stroke: "#000000",
              strokeThickness: 3,
            }).setOrigin(0.5).setDepth(300);

            this.tweens.add({
              targets: comboText,
              y: comboTextY - 30,
              alpha: 0,
              duration: 800,
              onComplete: () => comboText.destroy(),
            });

            // Check if enemy defeated by combo
            this.updateHUD();
            this.checkDeath(target);
          }
        }
      }

      this.updateHUD();
      this.time.delayedCall(300, resolve);
    });
  }

  private applySkillEffect(user: Entity, target: Entity, skill: Skill) {
    if (!skill.effect || skill.effect === SkillEffect.None) return;
    const chance = skill.effectChance ?? 100;
    if (Math.random() * 100 > chance) return;

    // ShieldDust: immune to harmful secondary effects from enemy skills
    const harmfulEffects = [
      SkillEffect.Paralyze, SkillEffect.Burn, SkillEffect.Frozen,
      SkillEffect.BadlyPoisoned, SkillEffect.Flinch, SkillEffect.Drowsy, SkillEffect.Cursed,
    ];
    if (target.ability === AbilityId.ShieldDust && user !== target &&
        harmfulEffects.includes(skill.effect)) {
      this.showLog(`${target.name}'s Shield Dust blocked the effect!`);
      return;
    }

    switch (skill.effect) {
      case SkillEffect.AtkUp:
        target.statusEffects.push({ type: SkillEffect.AtkUp, turnsLeft: 10 });
        sfxBuff();
        this.showLog(`${target.name}'s ATK rose! (10 turns)`);
        if (target.sprite) target.sprite.setTint(0xff8844);
        this.time.delayedCall(300, () => { if (target.sprite) target.sprite.clearTint(); });
        break;

      case SkillEffect.DefUp:
        target.statusEffects.push({ type: SkillEffect.DefUp, turnsLeft: 10 });
        sfxBuff();
        this.showLog(`${target.name}'s DEF rose! (10 turns)`);
        break;

      case SkillEffect.Heal: {
        const healAmt = Math.floor(target.stats.maxHp * 0.3);
        target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + healAmt);
        this.showLog(`${target.name} recovered ${healAmt} HP!`);
        if (target.sprite) {
          target.sprite.setTint(0x44ff44);
          this.showHealPopup(target.sprite.x, target.sprite.y, healAmt);
        }
        this.time.delayedCall(300, () => { if (target.sprite) target.sprite.clearTint(); });
        break;
      }

      case SkillEffect.Paralyze:
        if (!target.statusEffects.some(s => s.type === SkillEffect.Paralyze)) {
          target.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 3 });
          this.showLog(`${target.name} was paralyzed! (3 turns)`);
          if (target.sprite) target.sprite.setTint(0xffff00);
          this.time.delayedCall(300, () => { if (target.sprite) target.sprite.clearTint(); });
        }
        break;

      case SkillEffect.Burn:
        if (!target.statusEffects.some(s => s.type === SkillEffect.Burn)) {
          target.statusEffects.push({ type: SkillEffect.Burn, turnsLeft: 5 });
          this.showLog(`${target.name} was burned! (5 turns)`);
        }
        break;

      case SkillEffect.Frozen: {
        if (!target.statusEffects.some(s => s.type === SkillEffect.Frozen)) {
          const frozenTurns = 2 + Math.floor(Math.random() * 2); // 2-3 turns
          target.statusEffects.push({ type: SkillEffect.Frozen, turnsLeft: frozenTurns });
          this.showLog(`${target.name} was frozen solid! (${frozenTurns} turns)`);
          if (target.sprite) target.sprite.setTint(0x88ccff);
          this.time.delayedCall(300, () => { if (target.sprite) this.updateStatusTint(target); });
        }
        break;
      }

      case SkillEffect.BadlyPoisoned:
        if (!target.statusEffects.some(s => s.type === SkillEffect.BadlyPoisoned)) {
          target.statusEffects.push({ type: SkillEffect.BadlyPoisoned, turnsLeft: 8, poisonCounter: 0 });
          this.showLog(`${target.name} was badly poisoned! (8 turns)`);
          if (target.sprite) target.sprite.setTint(0x9944cc);
          this.time.delayedCall(300, () => { if (target.sprite) this.updateStatusTint(target); });
        }
        break;

      case SkillEffect.Flinch:
        if (!target.statusEffects.some(s => s.type === SkillEffect.Flinch)) {
          target.statusEffects.push({ type: SkillEffect.Flinch, turnsLeft: 1 });
          this.showLog(`${target.name} flinched!`);
        }
        break;

      case SkillEffect.Drowsy:
        if (!target.statusEffects.some(s => s.type === SkillEffect.Drowsy)) {
          target.statusEffects.push({ type: SkillEffect.Drowsy, turnsLeft: 3 });
          this.showLog(`${target.name} became drowsy! (3 turns)`);
          if (target.sprite) target.sprite.setTint(0xccaadd);
          this.time.delayedCall(300, () => { if (target.sprite) this.updateStatusTint(target); });
        }
        break;

      case SkillEffect.Cursed:
        if (!target.statusEffects.some(s => s.type === SkillEffect.Cursed)) {
          target.statusEffects.push({ type: SkillEffect.Cursed, turnsLeft: 8, curseTick: 0 });
          this.showLog(`${target.name} was cursed! (8 turns)`);
          if (target.sprite) target.sprite.setTint(0x553366);
          this.time.delayedCall(300, () => { if (target.sprite) this.updateStatusTint(target); });
        }
        break;
    }
  }

  private flashEntity(entity: Entity, effectiveness: number) {
    if (!entity.sprite) return;
    const tintColor = effectiveness >= 2.0 ? 0xff2222 : effectiveness < 1.0 ? 0x8888ff : 0xff4444;
    entity.sprite.setTint(tintColor);
    this.time.delayedCall(200, () => {
      if (entity.sprite) entity.sprite.clearTint();
    });

    // Screen shake for super effective
    if (effectiveness >= 2.0) {
      this.cameras.main.shake(200, 0.008);
    }
  }

  /** Show visual effect on skill target tiles */
  private showSkillEffect(tiles: { x: number; y: number }[], skill: Skill) {
    const typeColors: Record<string, { color: number; symbol: string }> = {
      Water: { color: 0x3b82f6, symbol: "~" },
      Fire: { color: 0xef4444, symbol: "*" },
      Electric: { color: 0xfbbf24, symbol: "⚡" },
      Grass: { color: 0x22c55e, symbol: "♣" },
      Flying: { color: 0xa78bfa, symbol: ">" },
      Poison: { color: 0xa855f7, symbol: "☠" },
      Rock: { color: 0x92400e, symbol: "◆" },
      Ground: { color: 0xd97706, symbol: "▲" },
      Bug: { color: 0x84cc16, symbol: "●" },
      Fighting: { color: 0xdc2626, symbol: "✊" },
      Steel: { color: 0x94a3b8, symbol: "⬡" },
      Ghost: { color: 0x7c3aed, symbol: "👻" },
      Psychic: { color: 0xec4899, symbol: "🔮" },
      Ice: { color: 0x67e8f9, symbol: "❄" },
      Dark: { color: 0x6b21a8, symbol: "🌑" },
      Fairy: { color: 0xf9a8d4, symbol: "✿" },
      Dragon: { color: 0x7c3aed, symbol: "🐉" },
      Normal: { color: 0xd1d5db, symbol: "✦" },
    };
    const tc = typeColors[skill.type] ?? typeColors.Normal;

    for (const t of tiles) {
      const px = t.x * TILE_DISPLAY + TILE_DISPLAY / 2;
      const py = t.y * TILE_DISPLAY + TILE_DISPLAY / 2;

      // Colored tile overlay
      const gfx = this.add.graphics().setDepth(15);
      gfx.fillStyle(tc.color, 0.4);
      gfx.fillRect(t.x * TILE_DISPLAY, t.y * TILE_DISPLAY, TILE_DISPLAY, TILE_DISPLAY);

      // Symbol
      const sym = this.add.text(px, py, tc.symbol, {
        fontSize: "16px", color: "#ffffff", fontFamily: "monospace",
        stroke: "#000000", strokeThickness: 2,
      }).setOrigin(0.5).setDepth(16);

      // Fade out
      this.tweens.add({
        targets: [gfx, sym],
        alpha: { from: 1, to: 0 },
        duration: 400,
        ease: "Quad.easeOut",
        onComplete: () => { gfx.destroy(); sym.destroy(); },
      });
    }
  }

  /** Floating damage number popup — color-coded by effectiveness, size-scaled by damage */
  private showDamagePopup(
    x: number, y: number, dmg: number, effectiveness: number,
    overrideText?: string, isCrit?: boolean, attackType?: PokemonType
  ) {
    // Determine color by effectiveness
    let color: string;
    if (effectiveness === 0) color = "#999999";       // Immune — gray
    else if (effectiveness >= 2.0) color = "#ff3333";  // Super effective — red
    else if (effectiveness < 1.0) color = "#999999";   // Not very effective — gray
    else color = "#ffffff";                             // Normal — white

    // Critical hit overrides to gold
    if (isCrit) color = "#ffd700";

    // Build display text
    let displayText: string;
    if (overrideText) {
      displayText = overrideText;
    } else if (effectiveness === 0) {
      displayText = "Immune";
    } else if (isCrit) {
      displayText = `CRIT ${dmg}`;
    } else if (effectiveness >= 2.0) {
      displayText = `${dmg}!`;
    } else {
      displayText = `${dmg}`;
    }

    // Size scaling by damage amount
    let fontSize: number;
    if (effectiveness === 0) {
      fontSize = 10;
    } else if (effectiveness < 1.0) {
      fontSize = 10; // Not very effective — small
    } else if (dmg >= 31) {
      fontSize = 16;
    } else if (dmg >= 16) {
      fontSize = 14;
    } else if (dmg >= 6) {
      fontSize = 12;
    } else {
      fontSize = 10;
    }

    // Super effective always at least 14px
    if (effectiveness >= 2.0 && fontSize < 14) fontSize = 14;
    // Crit always at least 14px
    if (isCrit && fontSize < 14) fontSize = 14;

    // Random horizontal offset for visual variety
    const xOffset = (Math.random() - 0.5) * 16;

    const popup = this.add.text(x + xOffset, y - 10, displayText, {
      fontSize: `${fontSize}px`, color, fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);

    // Scale bounce: start at 1.5x, settle to 1.0x
    popup.setScale(1.5);
    this.tweens.add({
      targets: popup,
      scaleX: 1.0,
      scaleY: 1.0,
      duration: 200,
      ease: "Back.easeOut",
    });

    // Float upward and fade
    this.tweens.add({
      targets: popup,
      y: y - 45,
      alpha: { from: 1, to: 0 },
      duration: 900,
      ease: "Quad.easeOut",
      onComplete: () => popup.destroy(),
    });

    // Massive damage (31+) bounce effect — extra vertical wobble
    if (dmg >= 31 && effectiveness > 0) {
      this.tweens.add({
        targets: popup,
        scaleX: { from: 1.3, to: 1.0 },
        scaleY: { from: 0.8, to: 1.0 },
        duration: 150,
        delay: 200,
        ease: "Bounce.easeOut",
      });
    }

    // Hit spark effect at impact point
    if (effectiveness > 0 && !overrideText) {
      this.showHitSpark(x, y, attackType);
    }
  }

  /** Hit spark effect — brief colored circle at impact point */
  private showHitSpark(x: number, y: number, attackType?: PokemonType) {
    // Type-based spark colors
    const sparkColors: Partial<Record<PokemonType, number>> = {
      [PokemonType.Fire]: 0xff8c00,     // orange
      [PokemonType.Water]: 0x3b82f6,    // blue
      [PokemonType.Electric]: 0xfbbf24, // yellow
      [PokemonType.Grass]: 0x22c55e,    // green
      [PokemonType.Ice]: 0x67e8f9,      // cyan
      [PokemonType.Poison]: 0xa855f7,   // purple
      [PokemonType.Fighting]: 0xdc2626, // red
      [PokemonType.Ghost]: 0x7c3aed,    // violet
      [PokemonType.Psychic]: 0xec4899,  // pink
      [PokemonType.Dark]: 0x6b21a8,     // dark purple
    };
    const sparkColor = (attackType && sparkColors[attackType]) ? sparkColors[attackType]! : 0xffffff;

    const spark = this.add.graphics().setDepth(49);
    spark.fillStyle(sparkColor, 0.9);
    spark.fillCircle(x, y, 8);
    // Outer glow ring
    spark.fillStyle(sparkColor, 0.4);
    spark.fillCircle(x, y, 14);

    this.tweens.add({
      targets: spark,
      alpha: { from: 1, to: 0 },
      scaleX: { from: 1.0, to: 1.8 },
      scaleY: { from: 1.0, to: 1.8 },
      duration: 150,
      ease: "Quad.easeOut",
      onComplete: () => spark.destroy(),
    });
  }

  /** Brief flash effect on target for critical hits */
  private showCritFlash(entity: Entity) {
    if (!entity.sprite) return;
    // Bright gold flash
    entity.sprite.setTint(0xffd700);
    this.time.delayedCall(100, () => {
      if (entity.sprite) entity.sprite.setTint(0xffffff);
      this.time.delayedCall(80, () => {
        if (entity.sprite) entity.sprite.setTint(0xffd700);
        this.time.delayedCall(100, () => {
          if (entity.sprite) entity.sprite.clearTint();
        });
      });
    });
  }

  /** Show temporary HP bar above an entity */
  private showEnemyHpBar(entity: { sprite?: Phaser.GameObjects.Sprite; stats: { hp: number; maxHp: number } }) {
    if (!entity.sprite || entity.stats.hp <= 0) return;
    const x = entity.sprite.x;
    const y = entity.sprite.y - 18;
    const barW = 24;
    const barH = 3;
    const ratio = Math.max(0, entity.stats.hp / entity.stats.maxHp);

    const bar = this.add.graphics().setDepth(51);
    bar.fillStyle(0x000000, 0.7);
    bar.fillRect(x - barW / 2 - 1, y - 1, barW + 2, barH + 2);
    const barColor = ratio > 0.5 ? 0x22cc44 : ratio > 0.25 ? 0xcccc22 : 0xcc2222;
    bar.fillStyle(barColor, 1);
    bar.fillRect(x - barW / 2, y, barW * ratio, barH);

    this.tweens.add({
      targets: bar,
      alpha: { from: 1, to: 0 },
      delay: 1200,
      duration: 600,
      onComplete: () => bar.destroy(),
    });
  }

  /** Heal number popup (green, floats upward with bounce) */
  private showHealPopup(x: number, y: number, amount: number) {
    const xOffset = (Math.random() - 0.5) * 12;
    const popup = this.add.text(x + xOffset, y - 10, `+${amount}`, {
      fontSize: "12px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);

    // Scale bounce on appearance
    popup.setScale(1.5);
    this.tweens.add({
      targets: popup,
      scaleX: 1.0,
      scaleY: 1.0,
      duration: 200,
      ease: "Back.easeOut",
    });

    // Float upward and fade
    this.tweens.add({
      targets: popup,
      y: y - 45,
      alpha: { from: 1, to: 0 },
      duration: 900,
      ease: "Quad.easeOut",
      onComplete: () => popup.destroy(),
    });
  }

  /** Floating stat gain popup for level-ups */
  private showStatPopup(x: number, y: number, text: string, color: string, delay: number) {
    this.time.delayedCall(delay, () => {
      const popup = this.add.text(x, y, text, {
        fontSize: "8px", color, fontFamily: "monospace", fontStyle: "bold",
        stroke: "#000000", strokeThickness: 2,
      }).setOrigin(0.5).setDepth(52);
      this.tweens.add({
        targets: popup,
        y: y - 30,
        alpha: { from: 1, to: 0 },
        duration: 1200,
        ease: "Quad.easeOut",
        onComplete: () => popup.destroy(),
      });
    });
  }

  private checkDeath(entity: Entity) {
    if (entity.stats.hp > 0 || !entity.alive) return;

    // Ability: Sturdy — survive one lethal hit per floor, HP scaled by level
    if (entity.ability === AbilityId.Sturdy && !entity.sturdyUsed) {
      entity.stats.hp = getSturdyHp(entity.abilityLevel ?? 1);
      entity.sturdyUsed = true;
      this.showLog(`${entity.name}'s Sturdy held on!`);
      if (entity.sprite) {
        entity.sprite.setTint(0xffff44);
        this.time.delayedCall(400, () => { if (entity.sprite) entity.sprite.clearTint(); });
      }
      return;
    }

    // Relic: Focus Sash — survive lethal hit once per run at 1 HP (player only)
    if (entity === this.player && !this.focusSashUsed && hasRelicEffect(this.activeRelics, "focusSash")) {
      entity.stats.hp = 1;
      this.focusSashUsed = true;
      this.showLog("Focus Sash held on! Survived at 1 HP!");
      if (entity.sprite) {
        entity.sprite.setTint(0xa855f7);
        this.cameras.main.shake(300, 0.01);
        this.time.delayedCall(500, () => { if (entity.sprite) entity.sprite.clearTint(); });
      }
      return;
    }

    // Player: check revive seed
    if (entity === this.player) {
      if (this.tryRevive()) return;
    }

    entity.alive = false;
    if (entity.sprite) {
      this.tweens.add({
        targets: entity.sprite,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          entity.sprite?.destroy();
          entity.sprite = undefined;
        },
      });
    }
    if (entity === this.player) {
      sfxDeath();
      this.showLog(`${this.player.name} fainted!`);
    } else if (entity.isAlly) {
      // Ally fainted
      this.showLog(`${entity.name} fainted!`);
      this.allies = this.allies.filter(a => a !== entity);
    } else {
      // Enemy defeated — track for gold
      this.enemiesDefeated++;
      // TreasureFloor: bonus gold per enemy defeated
      if (this.floorEvent?.type === FloorEventType.TreasureFloor) {
        const treasureGold = Math.floor(5 + this.currentFloor * 3);
        this.gold += treasureGold;
        this.showLog(`Treasure bonus! +${treasureGold}G`);
      }
      // Run log: enemy defeated
      this.runLog.add(RunLogEvent.EnemyDefeated, entity.name, this.currentFloor, this.turnManager.turn);

      // Score chain: enemy kill
      {
        const chainBonus = addChainAction(this.scoreChain, "kill");
        this.chainActionThisTurn = true;
        if (chainBonus > 0) this.showLog(`Chain x${this.scoreChain.currentMultiplier.toFixed(1)}! +${chainBonus} bonus`);
        this.updateChainHUD();
      }

      // Vampiric enchantment: heal 1 HP per enemy defeated
      if (this.enchantment?.id === "vampiric" && this.player.alive && this.player.stats.hp < this.player.stats.maxHp) {
        this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + 1);
        this.showLog("Vampiric: Drained 1 HP!");
      }

      const isBossKill = entity.isBoss;
      const isMiniBossKill = this.miniBossEntity === entity && entity.isMiniBoss === true;
      // Grant EXP (boss gives 5x, mini-boss gives 3x, apply modifier expMult)
      const baseExp = expFromEnemy(entity.stats.level, this.currentFloor);
      const heldExpMult = 1 + (this.heldItemEffect.expBonus ?? 0) / 100;
      const ngExpMult = 1 + this.ngPlusBonuses.expPercent / 100;
      const talentExpMult = 1 + (this.talentEffects.expPercent ?? 0) / 100;
      const expMultForType = isBossKill ? 5 : isMiniBossKill ? 3 : 1;
      const expGain = Math.floor((baseExp * expMultForType) * this.modifierEffects.expMult * heldExpMult * this.difficultyMods.expMult * ngExpMult * talentExpMult);
      this.totalExp += expGain;

      // Check if this is a legendary encounter defeat
      const isLegendaryKill = this.legendaryEntity === entity && this.legendaryEncounter !== null;

      if (isLegendaryKill && this.legendaryEncounter) {
        // Legendary defeat: golden celebration + rewards
        sfxBossDefeat();
        this.cameras.main.shake(600, 0.02);
        this.cameras.main.flash(500, 255, 215, 0); // golden flash
        this.showLog(`★ You defeated ${entity.name}! ★`);
        // Run log: legendary defeated
        this.runLog.add(RunLogEvent.LegendaryDefeated, entity.name, this.currentFloor, this.turnManager.turn);

        // Award legendary gold reward (GoldenAge mutation multiplier)
        const legMutGoldMult = hasMutation(this.floorMutations, MutationType.GoldenAge) ? getMutationEffect(MutationType.GoldenAge, "goldMult") : 1;
        const legendaryGold = Math.floor(this.legendaryEncounter.reward.gold * legMutGoldMult);
        this.gold += legendaryGold;
        this.time.delayedCall(800, () => {
          this.showLog(`Received ${legendaryGold}G!`);
        });

        // Award legendary bonus EXP
        const legendaryBonusExp = this.legendaryEncounter.reward.exp;
        this.totalExp += legendaryBonusExp;
        this.time.delayedCall(1200, () => {
          this.showLog(`Bonus EXP: +${legendaryBonusExp}!`);
        });

        // Skill reward: add to player's skill set
        if (this.legendaryEncounter.reward.skillId) {
          const rewardSkillId = this.legendaryEncounter.reward.skillId;
          const rewardTemplate = SKILL_DB[rewardSkillId];
          if (rewardTemplate && !this.player.skills.some(s => s.id === rewardSkillId)) {
            this.time.delayedCall(1800, () => {
              if (this.player.skills.length < 4) {
                this.player.skills.push(createSkill(rewardTemplate));
              } else {
                // Replace weakest skill
                const weakest = this.player.skills.reduce((min, s, i) =>
                  s.power < this.player.skills[min].power ? i : min, 0);
                this.player.skills[weakest] = createSkill(rewardTemplate);
              }
              this.showLog(`Learned ${rewardTemplate.name}!`);
              this.createSkillButtons();
            });
          }
        }

        // Item reward (stored in meta storage)
        if (this.legendaryEncounter.reward.uniqueItem) {
          const rewardItemId = this.legendaryEncounter.reward.uniqueItem;
          const itemDef = ITEM_DB[rewardItemId];
          if (itemDef) {
            this.time.delayedCall(2200, () => {
              this.showLog(`Obtained ${itemDef.name}!`);
              const existing = this.inventory.find(s => s.item.id === rewardItemId && itemDef.stackable);
              if (existing) existing.count++;
              else if (this.inventory.length < MAX_INVENTORY) this.inventory.push({ item: itemDef, count: 1 });
            });
          }
        }

        // Clean up legendary state
        this.legendaryEntity = null;
        this.legendaryEncounter = null;
        // Stop particle effects
        if (this.legendaryParticleTimer) { this.legendaryParticleTimer.destroy(); this.legendaryParticleTimer = null; }
        if (this.legendaryParticleGraphics) { this.legendaryParticleGraphics.destroy(); this.legendaryParticleGraphics = null; }
        // Relic drop: legendary defeat (highest chance)
        this.tryRelicDrop("legendary");
      } else if (isMiniBossKill && this.miniBossData) {
        // Mini-boss defeat: moderate celebration + guaranteed reward
        sfxBossDefeat();
        this.cameras.main.shake(300, 0.01);
        this.cameras.main.flash(200, 255, 140, 0); // orange flash
        this.showLog(`◆ ${entity.name} defeated! +${expGain} EXP ◆`);
        // Run log: mini-boss defeated (use EnemyDefeated since there is no dedicated MiniBoss event)
        this.runLog.add(RunLogEvent.EnemyDefeated, `Mini-Boss: ${entity.name}`, this.currentFloor, this.turnManager.turn);

        // Grant mini-boss reward
        const mbReward = getMiniBossReward(this.miniBossData);
        if (mbReward.type === "gold") {
          const mutGoldMult = hasMutation(this.floorMutations, MutationType.GoldenAge) ? getMutationEffect(MutationType.GoldenAge, "goldMult") : 1;
          const mbGold = Math.floor(mbReward.value * mutGoldMult);
          this.gold += mbGold;
          this.time.delayedCall(600, () => {
            this.showLog(`Mini-Boss reward: ${mbGold}G!`);
          });
        } else if (mbReward.type === "blessing") {
          this.time.delayedCall(600, () => {
            const blessing = getRandomBlessing();
            this.grantBlessing(blessing);
            this.showLog(`Mini-Boss reward: ${blessing.name}!`);
          });
        } else if (mbReward.type === "relic") {
          this.time.delayedCall(600, () => {
            this.tryRelicDrop("boss"); // use boss-level relic drop chance
          });
        } else if (mbReward.type === "item") {
          if (this.inventory.length < MAX_INVENTORY) {
            const rewardItem = rollFloorItem();
            const existing = this.inventory.find(s => s.item.id === rewardItem.id && rewardItem.stackable);
            if (existing) existing.count++;
            else this.inventory.push({ item: rewardItem, count: 1 });
            this.time.delayedCall(600, () => {
              this.showLog(`Mini-Boss reward: ${rewardItem.name}!`);
              sfxItemPickup();
            });
          }
        }

        // Clean up mini-boss state
        this.miniBossEntity = null;
        this.miniBossData = null;
      } else if (isBossKill) {
        // Boss defeat: big screen shake + special message
        sfxBossDefeat();
        this.cameras.main.shake(500, 0.015);
        this.showLog(`★ BOSS DEFEATED! ${entity.name} fell! +${expGain} EXP ★`);
        // Run log: boss defeated
        this.runLog.add(RunLogEvent.BossDefeated, entity.name, this.currentFloor, this.turnManager.turn);
        this.bossEntity = null;
        this.cameras.main.flash(300, 255, 255, 200);
        // Track bosses defeated for Boss Rush
        if (this.isBossRush) this.bossesDefeated++;
        // Relic drop: boss defeat
        this.tryRelicDrop("boss");
      } else {
        this.showLog(`${entity.name} fainted! +${expGain} EXP`);
      }

      // Check level up
      const levelResult = processLevelUp(
        this.player.stats, expGain, this.totalExp
      );
      this.totalExp = levelResult.totalExp;
      const results = levelResult.results;

      for (const r of results) {
        this.time.delayedCall(500, () => {
          sfxLevelUp();
          this.showLog(`Level up! Lv.${r.newLevel}! HP+${r.hpGain} ATK+${r.atkGain} DEF+${r.defGain}`);
          // Run log: level up
          this.runLog.add(RunLogEvent.LevelUp, `Lv.${r.newLevel}`, this.currentFloor, this.turnManager.turn);
          if (this.player.sprite) {
            this.player.sprite.setTint(0xffff44);
            // Scale bounce animation
            this.tweens.add({
              targets: this.player.sprite,
              scaleX: TILE_SCALE * 1.3, scaleY: TILE_SCALE * 1.3,
              duration: 200, yoyo: true, ease: "Quad.easeOut",
            });
            this.time.delayedCall(600, () => {
              if (this.player.sprite) this.player.sprite.clearTint();
            });
            // Floating stat popups
            const px = this.player.sprite.x;
            const py = this.player.sprite.y;
            this.showStatPopup(px - 16, py - 20, `HP+${r.hpGain}`, "#4ade80", 0);
            this.showStatPopup(px, py - 20, `ATK+${r.atkGain}`, "#f87171", 200);
            this.showStatPopup(px + 16, py - 20, `DEF+${r.defGain}`, "#60a5fa", 400);
          }
          this.updateHUD();

          // ── Level-up skill learning ──
          const newSkillId = getLearnableSkill(this.player.speciesId ?? this.starterId, r.newLevel);
          if (newSkillId && SKILL_DB[newSkillId] && !this.player.skills.some(s => s.id === newSkillId)) {
            if (this.player.skills.length < 4) {
              this.player.skills.push(createSkill(SKILL_DB[newSkillId]));
              this.showLog(`Learned ${SKILL_DB[newSkillId].name}!`);
            } else {
              // Replace weakest skill (lowest power)
              const weakest = this.player.skills.reduce((min, s, i) =>
                s.power < this.player.skills[min].power ? i : min, 0
              );
              const old = this.player.skills[weakest];
              this.player.skills[weakest] = createSkill(SKILL_DB[newSkillId]);
              this.showLog(`Learned ${SKILL_DB[newSkillId].name}! (Forgot ${old.name})`);
            }
            this.createSkillButtons();
          }

          // ── Evolution check ──
          const evo = getEvolution(this.player.speciesId ?? this.starterId, r.newLevel);
          if (evo) {
            this.time.delayedCall(800, () => {
              this.player.name = evo.newName;
              this.player.stats.maxHp += evo.hpBonus;
              this.player.stats.hp += evo.hpBonus;
              this.player.stats.atk += evo.atkBonus;
              this.player.stats.def += evo.defBonus;
              this.player.speciesId = evo.to;
              if (evo.newSkillId && SKILL_DB[evo.newSkillId] && this.player.skills.length < 4) {
                this.player.skills.push(createSkill(SKILL_DB[evo.newSkillId]));
              }
              sfxEvolution();
              this.cameras.main.flash(800, 255, 255, 255);
              this.cameras.main.shake(400, 0.01);
              if (this.player.sprite) {
                this.tweens.add({
                  targets: this.player.sprite,
                  scaleX: TILE_SCALE * 1.5, scaleY: TILE_SCALE * 1.5,
                  duration: 400, yoyo: true, ease: "Quad.easeInOut",
                });
              }
              this.showLog(`Congratulations! ${evo.from} evolved into ${evo.newName}!`);
              this.updateHUD();
            });
          }
        });
      }

      // ── Ally EXP sharing + level up + evolution ──
      if (this.allies.length > 0) {
        const allyResults = distributeAllyExp(this.allies, expGain);
        for (const ar of allyResults) {
          const ally = ar.ally;
          // Show level-up effects for each level gained
          for (const lvl of ar.levelUps) {
            this.time.delayedCall(600, () => {
              sfxLevelUp();
              this.showLog(`${ally.name} leveled up! Lv.${lvl.newLevel}! HP+${lvl.hpGain} ATK+${lvl.atkGain} DEF+${lvl.defGain}`);
              if (ally.sprite) {
                ally.sprite.setTint(0xffff44);
                this.tweens.add({
                  targets: ally.sprite,
                  scaleX: TILE_SCALE * 1.3, scaleY: TILE_SCALE * 1.3,
                  duration: 200, yoyo: true, ease: "Quad.easeOut",
                });
                this.time.delayedCall(600, () => { if (ally.sprite) ally.sprite.clearTint(); });
                this.showStatPopup(ally.sprite.x - 16, ally.sprite.y - 20, `HP+${lvl.hpGain}`, "#4ade80", 0);
                this.showStatPopup(ally.sprite.x, ally.sprite.y - 20, `ATK+${lvl.atkGain}`, "#f87171", 200);
                this.showStatPopup(ally.sprite.x + 16, ally.sprite.y - 20, `DEF+${lvl.defGain}`, "#60a5fa", 400);
              }
              this.updateHUD();
            });
          }
          // Show evolution animation if evolved
          if (ar.evolution) {
            const evo = ar.evolution;
            this.time.delayedCall(1400, () => {
              sfxEvolution();
              this.cameras.main.flash(600, 255, 255, 255);
              this.showLog(`${evo.oldName} evolved into ${evo.newName}!`);
              if (evo.newSkill) {
                this.showLog(`${evo.newName} learned ${evo.newSkill}!`);
              }
              // Update sprite to new species
              const newSp = SPECIES[evo.newSpeciesId];
              if (ally.sprite && newSp) {
                const newIdleTex = `${newSp.spriteKey}-idle`;
                if (this.textures.exists(newIdleTex)) {
                  ally.sprite.setTexture(newIdleTex);
                  const newIdleAnim = `${newSp.spriteKey}-idle-${ally.facing}`;
                  if (this.anims.exists(newIdleAnim)) ally.sprite.play(newIdleAnim);
                }
                // Evolution scale bounce
                this.tweens.add({
                  targets: ally.sprite,
                  scaleX: TILE_SCALE * 1.5, scaleY: TILE_SCALE * 1.5,
                  duration: 400, yoyo: true, ease: "Quad.easeInOut",
                });
              }
              this.updateHUD();
            });
          }
        }
      }

      // ── LuckyFloor: every enemy drops an item ──
      if (this.floorEvent?.type === FloorEventType.LuckyFloor && this.challengeMode !== "noItems") {
        if (this.inventory.length < MAX_INVENTORY) {
          const luckyDrop = rollFloorItem();
          const luckyExisting = this.inventory.find(s => s.item.id === luckyDrop.id && luckyDrop.stackable);
          if (luckyExisting) luckyExisting.count++;
          else this.inventory.push({ item: luckyDrop, count: 1 });
          this.showLog(`Lucky! ${entity.name} dropped a ${luckyDrop.name}!`);
          sfxItemPickup();
        }
      }

      // ── Ability: Pickup — chance scaled by ability level (disabled in No Items challenge) ──
      if (this.challengeMode !== "noItems" && this.player.ability === AbilityId.Pickup && Math.random() < getPickupChance(this.player.abilityLevel ?? 1)) {
        if (this.inventory.length < MAX_INVENTORY) {
          const found = rollFloorItem();
          const existing = this.inventory.find(s => s.item.id === found.id && found.stackable);
          if (existing) existing.count++;
          else this.inventory.push({ item: found, count: 1 });
          this.showLog(`Pickup found a ${found.name}!`);
        }
      }

      // ── Recruitment check (bosses/mini-bosses can't be recruited, solo/noRecruits blocks recruitment) ──
      const recruitBonus = getUpgradeBonus(loadMeta(), "recruitRate") * 5;
      if (this.challengeMode !== "solo" && !this.modifierEffects.noRecruits && !isBossKill && !isMiniBossKill && entity.speciesId && this.allies.length < MAX_ALLIES && tryRecruit(this.player.stats.level, entity.stats.level, recruitBonus)) {
        this.time.delayedCall(800, () => {
          this.recruitEnemy(entity);
        });
      }

      // ── Monster House clear check ──
      this.time.delayedCall(300, () => {
        this.checkMonsterHouseCleared();
      });

      // ── Gauntlet wave clear check ──
      if (this.gauntletActive) {
        this.time.delayedCall(400, () => {
          this.checkGauntletWaveCleared();
        });
      }

      // ── Puzzle EnemyRush clear check ──
      if (this.puzzleSys.puzzleActive && this.puzzleSys.puzzleData?.type === PuzzleType.EnemyRush) {
        this.time.delayedCall(350, () => {
          this.puzzleSys.handleEnemyRushTurn();
        });
      }
    }
  }

  // ── Boss Gauntlet Methods ──

  /** Start the gauntlet: show announcement, create HUD, spawn first wave */
  private startGauntlet() {
    if (!this.gauntletConfig) return;

    // Screen shake on gauntlet start
    this.cameras.main.shake(500, 0.02);
    this.cameras.main.flash(400, 255, 50, 50);

    // Big red "BOSS GAUNTLET!" announcement text
    const gauntletTitle = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "BOSS GAUNTLET!", {
      fontSize: "22px", color: "#ff2222", fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300);
    this.tweens.add({
      targets: gauntletTitle,
      y: GAME_HEIGHT / 2 - 80,
      alpha: { from: 1, to: 0 },
      scaleX: { from: 1, to: 1.5 },
      scaleY: { from: 1, to: 1.5 },
      duration: 2500,
      ease: "Quad.easeOut",
      onComplete: () => gauntletTitle.destroy(),
    });

    this.showLog("A Boss Gauntlet begins! Defeat all waves!");

    // Create gauntlet wave HUD text (top center, red)
    this.gauntletWaveText = this.add.text(
      GAME_WIDTH / 2, 86, `Wave 1/${this.gauntletConfig.waves.length}`,
      { fontSize: "11px", color: "#ff4444", fontFamily: "monospace", fontStyle: "bold",
        stroke: "#000000", strokeThickness: 2 }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(103);

    // Pulsing red vignette border
    this.gauntletVignette = this.add.graphics().setScrollFactor(0).setDepth(99);
    this.drawGauntletVignette(0.3);
    // Pulsing tween for the vignette
    const vignetteObj = { alpha: 0.3 };
    this.gauntletVignetteTween = this.tweens.add({
      targets: vignetteObj,
      alpha: { from: 0.15, to: 0.4 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        this.drawGauntletVignette(vignetteObj.alpha);
      },
    });

    // Switch to boss theme for dramatic effect
    switchToBossTheme();

    // Spawn the first wave after a brief delay
    this.time.delayedCall(800, () => {
      this.spawnGauntletWave(0);
    });
  }

  /** Draw red vignette border overlay */
  private drawGauntletVignette(alpha: number) {
    if (!this.gauntletVignette) return;
    this.gauntletVignette.clear();
    // Draw red gradient border (4 edge rectangles)
    const borderW = 12;
    this.gauntletVignette.fillStyle(0xff0000, alpha);
    // top
    this.gauntletVignette.fillRect(0, 0, GAME_WIDTH, borderW);
    // bottom
    this.gauntletVignette.fillRect(0, GAME_HEIGHT - borderW, GAME_WIDTH, borderW);
    // left
    this.gauntletVignette.fillRect(0, 0, borderW, GAME_HEIGHT);
    // right
    this.gauntletVignette.fillRect(GAME_WIDTH - borderW, 0, borderW, GAME_HEIGHT);
  }

  /** Spawn a specific gauntlet wave's bosses */
  private spawnGauntletWave(waveIndex: number) {
    if (!this.gauntletConfig) return;
    if (waveIndex >= this.gauntletConfig.waves.length) return;

    this.gauntletCurrentWave = waveIndex;
    this.gauntletEnemies = [];
    const wave = this.gauntletConfig.waves[waveIndex];
    const bossCount = wave.count ?? 1;
    const rooms = this.dungeon.rooms;

    // Pick the largest room (excluding the player's room) for boss placement
    const bossRoom = rooms.length > 1
      ? rooms.slice(1).reduce((best, r) => (r.w * r.h > best.w * best.h) ? r : best, rooms[1])
      : rooms[0];

    for (let i = 0; i < bossCount; i++) {
      const speciesId = i === 0 ? wave.bossSpecies : this.gauntletConfig.waves[waveIndex].bossSpecies;
      const sp = SPECIES[speciesId];
      if (!sp) continue;

      // Offset placement for multiple bosses
      const offsetX = i === 0 ? 0 : (i % 2 === 0 ? 1 : -1);
      const offsetY = i > 1 ? 1 : 0;
      let bx = bossRoom.x + Math.floor(bossRoom.w / 2) + offsetX;
      let by = bossRoom.y + Math.floor(bossRoom.h / 2) + offsetY;

      // Clamp to room bounds
      bx = Math.max(bossRoom.x + 1, Math.min(bossRoom.x + bossRoom.w - 2, bx));
      by = Math.max(bossRoom.y + 1, Math.min(bossRoom.y + bossRoom.h - 2, by));

      // Make sure tile is ground and not occupied
      if (this.dungeon.terrain[by]?.[bx] !== TerrainType.GROUND) continue;
      if (this.allEntities.some(e => e.alive && e.tileX === bx && e.tileY === by)) {
        // Try adjacent tile
        bx = Math.min(bossRoom.x + bossRoom.w - 2, bx + 1);
      }

      const baseStats = getEnemyStats(this.currentFloor, this.dungeonDef.difficulty, sp, this.ngPlusLevel);
      const bossStats = {
        hp: Math.floor(baseStats.hp * wave.hpMultiplier * this.difficultyMods.enemyHpMult),
        maxHp: Math.floor(baseStats.hp * wave.hpMultiplier * this.difficultyMods.enemyHpMult),
        atk: Math.floor(baseStats.atk * wave.hpMultiplier * this.difficultyMods.enemyAtkMult),
        def: Math.floor(baseStats.def * wave.hpMultiplier),
        level: wave.level,
      };

      const bossName = waveIndex === (this.gauntletConfig.waves.length - 1) && this.gauntletConfig.waves.length >= 3
        ? `Elite ${sp.name}` : `Gauntlet ${sp.name}`;

      const boss: Entity = {
        tileX: bx, tileY: by,
        facing: Direction.Down,
        stats: bossStats,
        alive: true,
        spriteKey: sp.spriteKey,
        name: bossName,
        types: sp.types,
        attackType: sp.attackType,
        skills: createSpeciesSkills(sp),
        statusEffects: [],
        speciesId: sp.spriteKey,
        isBoss: true,
        ability: SPECIES_ABILITIES[sp.spriteKey],
      };

      // Create sprite with boss entrance animation (fade-in + size bounce)
      const bossTex = `${sp.spriteKey}-idle`;
      if (this.textures.exists(bossTex)) {
        boss.sprite = this.add.sprite(
          this.tileToPixelX(bx), this.tileToPixelY(by), bossTex
        );
        boss.sprite.setScale(0).setDepth(11).setAlpha(0);
        const bossAnim = `${sp.spriteKey}-idle-${Direction.Down}`;
        if (this.anims.exists(bossAnim)) boss.sprite.play(bossAnim);

        // Boss entrance animation: fade-in + size bounce
        this.tweens.add({
          targets: boss.sprite,
          scaleX: TILE_SCALE * 1.5,
          scaleY: TILE_SCALE * 1.5,
          alpha: 1,
          duration: 500,
          ease: "Back.easeOut",
          onComplete: () => {
            // Settle to normal boss scale
            if (boss.sprite) {
              this.tweens.add({
                targets: boss.sprite,
                scaleX: TILE_SCALE * 1.4,
                scaleY: TILE_SCALE * 1.4,
                duration: 200,
                ease: "Quad.easeOut",
              });
            }
          },
        });
      }

      // Orange-red tint aura for gauntlet bosses
      if (boss.sprite) boss.sprite.setTint(0xff8833);
      this.time.delayedCall(800, () => { if (boss.sprite) boss.sprite.clearTint(); });

      // Track as the main boss entity for HP bar display (first boss of wave)
      if (i === 0) {
        this.bossEntity = boss;
      }

      this.gauntletEnemies.push(boss);
      this.enemies.push(boss);
      this.allEntities.push(boss);
      this.seenSpecies.add(sp.id);
    }

    // Create/update boss HP bar for the first boss of this wave
    this.createGauntletBossHpBar();

    // Update wave HUD text
    if (this.gauntletWaveText) {
      this.gauntletWaveText.setText(`Wave ${waveIndex + 1}/${this.gauntletConfig.waves.length}`);
    }

    this.updateHUD();
  }

  /** Create/refresh the boss HP bar for the gauntlet's current primary boss */
  private createGauntletBossHpBar() {
    // Clean up existing boss HP bar
    if (this.bossHpBg) this.bossHpBg.destroy();
    if (this.bossHpBar) this.bossHpBar.destroy();
    if (this.bossNameText) this.bossNameText.destroy();

    if (!this.bossEntity) return;

    const barW = 200;
    const barX = (GAME_WIDTH - barW) / 2;
    const barY = 56;

    this.bossHpBg = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.bossHpBg.fillStyle(0x1a1a2e, 0.95);
    this.bossHpBg.fillRoundedRect(barX - 4, barY - 4, barW + 8, 24, 4);
    this.bossHpBg.lineStyle(2, 0xff4444);
    this.bossHpBg.strokeRoundedRect(barX - 4, barY - 4, barW + 8, 24, 4);

    this.bossHpBar = this.add.graphics().setScrollFactor(0).setDepth(101);

    this.bossNameText = this.add.text(GAME_WIDTH / 2, barY - 2, `★ ${this.bossEntity.name} ★`, {
      fontSize: "10px", color: "#ff6666", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(102);
  }

  /** Check if all gauntlet enemies in the current wave are defeated */
  private checkGauntletWaveCleared() {
    if (!this.gauntletActive || !this.gauntletConfig) return;

    // Check if all gauntlet enemies in the current wave are dead
    const allDead = this.gauntletEnemies.every(e => !e.alive);
    if (!allDead) return;

    this.gauntletTotalWavesCleared++;
    const totalWaves = this.gauntletConfig.waves.length;
    const currentWaveDisplay = this.gauntletCurrentWave + 1;

    if (currentWaveDisplay < totalWaves) {
      // More waves remain — show "Wave X/Y Cleared!" and prepare next wave
      const waveMsg = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20,
        `Wave ${currentWaveDisplay}/${totalWaves} Cleared!`,
        { fontSize: "18px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
          stroke: "#000000", strokeThickness: 4 }
      ).setOrigin(0.5).setScrollFactor(0).setDepth(300);
      this.tweens.add({
        targets: waveMsg,
        y: GAME_HEIGHT / 2 - 50,
        alpha: { from: 1, to: 0 },
        duration: 2000,
        ease: "Quad.easeOut",
        onComplete: () => waveMsg.destroy(),
      });

      // Flash between waves
      this.cameras.main.flash(300, 255, 200, 100);

      this.showLog(`Wave ${currentWaveDisplay}/${totalWaves} cleared!`);

      // Heal player 20% HP between waves if restBetweenWaves
      if (this.gauntletConfig.restBetweenWaves && this.player.alive) {
        const healAmount = Math.floor(this.player.stats.maxHp * 0.2);
        this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + healAmount);
        this.showLog(`Resting... Recovered ${healAmount} HP!`);
        this.updateHUD();
      }

      // Clean up current boss HP bar
      this.bossEntity = null;

      // Spawn next wave after a rest period (3 seconds)
      this.time.delayedCall(3000, () => {
        this.spawnGauntletWave(this.gauntletCurrentWave + 1);
      });
    } else {
      // All waves cleared — gauntlet complete!
      this.gauntletActive = false;
      this.gauntletStairsLocked = false;
      this.bossEntity = null;

      // Run log: gauntlet cleared
      this.runLog.add(RunLogEvent.GauntletCleared, `${this.gauntletTotalWavesCleared} waves`, this.currentFloor, this.turnManager.turn);

      // "GAUNTLET COMPLETE!" gold celebration text
      const completeText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30,
        "GAUNTLET COMPLETE!",
        { fontSize: "20px", color: "#ffd700", fontFamily: "monospace", fontStyle: "bold",
          stroke: "#000000", strokeThickness: 5 }
      ).setOrigin(0.5).setScrollFactor(0).setDepth(300);
      this.tweens.add({
        targets: completeText,
        y: GAME_HEIGHT / 2 - 70,
        alpha: { from: 1, to: 0 },
        scaleX: { from: 1, to: 1.4 },
        scaleY: { from: 1, to: 1.4 },
        duration: 3000,
        ease: "Quad.easeOut",
        onComplete: () => completeText.destroy(),
      });

      // Explosion particles on gauntlet completion
      this.spawnGauntletParticles();

      // Screen shake + gold flash
      this.cameras.main.shake(600, 0.02);
      this.cameras.main.flash(500, 255, 215, 0);

      // Award rewards (GoldenAge mutation multiplier)
      const reward = getGauntletReward(this.gauntletConfig, this.gauntletTotalWavesCleared);
      const gauntletMutGoldMult = hasMutation(this.floorMutations, MutationType.GoldenAge) ? getMutationEffect(MutationType.GoldenAge, "goldMult") : 1;
      this.gold += Math.floor(reward.gold * gauntletMutGoldMult);
      this.totalExp += reward.exp;
      this.showLog(`Gauntlet complete! +${reward.gold}G +${reward.exp} EXP`);

      if (reward.item) {
        const itemDef = ITEM_DB[reward.item];
        if (itemDef && this.inventory.length < MAX_INVENTORY) {
          const existing = this.inventory.find(s => s.item.id === itemDef.id && itemDef.stackable);
          if (existing) existing.count++;
          else this.inventory.push({ item: itemDef, count: 1 });
          this.showLog(`Bonus: Received ${itemDef.name}!`);
        }
      }

      // Remove vignette and wave HUD
      this.cleanupGauntletHUD();

      // Relic drop: gauntlet clear
      this.tryRelicDrop("gauntlet");

      this.updateHUD();
    }
  }

  /** Spawn explosion particles for gauntlet completion */
  private spawnGauntletParticles() {
    const colors = [0xffd700, 0xff6622, 0xff4444, 0xffaa00, 0xffffff];
    for (let i = 0; i < 20; i++) {
      const px = GAME_WIDTH / 2 + (Math.random() - 0.5) * 200;
      const py = GAME_HEIGHT / 2 + (Math.random() - 0.5) * 100;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 2 + Math.random() * 4;
      const particle = this.add.graphics().setScrollFactor(0).setDepth(301);
      particle.fillStyle(color, 1);
      particle.fillCircle(px, py, size);
      this.tweens.add({
        targets: particle,
        x: (Math.random() - 0.5) * 120,
        y: -40 - Math.random() * 80,
        alpha: { from: 1, to: 0 },
        scaleX: { from: 1, to: 0.2 },
        scaleY: { from: 1, to: 0.2 },
        duration: 800 + Math.random() * 600,
        ease: "Quad.easeOut",
        onComplete: () => particle.destroy(),
      });
    }
  }

  /** Clean up gauntlet HUD elements */
  private cleanupGauntletHUD() {
    if (this.gauntletWaveText) {
      this.gauntletWaveText.destroy();
      this.gauntletWaveText = null;
    }
    if (this.gauntletVignetteTween) {
      this.gauntletVignetteTween.stop();
      this.gauntletVignetteTween = null;
    }
    if (this.gauntletVignette) {
      this.gauntletVignette.destroy();
      this.gauntletVignette = null;
    }
    // Clean up boss HP bar
    if (this.bossHpBg) { this.bossHpBg.destroy(); this.bossHpBg = null; }
    if (this.bossHpBar) { this.bossHpBar.destroy(); this.bossHpBar = null; }
    if (this.bossNameText) { this.bossNameText.destroy(); this.bossNameText = null; }
    // Clean up legendary HP bar and particles
    if (this.legendaryHpBg) { this.legendaryHpBg.destroy(); this.legendaryHpBg = null; }
    if (this.legendaryHpBar) { this.legendaryHpBar.destroy(); this.legendaryHpBar = null; }
    if (this.legendaryNameText) { this.legendaryNameText.destroy(); this.legendaryNameText = null; }
    if (this.legendaryParticleTimer) { this.legendaryParticleTimer.destroy(); this.legendaryParticleTimer = null; }
    if (this.legendaryParticleGraphics) { this.legendaryParticleGraphics.destroy(); this.legendaryParticleGraphics = null; }
    // Clean up mini-boss HP bar
    if (this.miniBossHpBg) { this.miniBossHpBg.destroy(); this.miniBossHpBg = null; }
    if (this.miniBossHpBar) { this.miniBossHpBar.destroy(); this.miniBossHpBar = null; }
    if (this.miniBossNameText) { this.miniBossNameText.destroy(); this.miniBossNameText = null; }
  }

  /** Recruit a defeated enemy as ally */
  private recruitEnemy(entity: Entity) {
    const sp = entity.speciesId ? SPECIES[entity.speciesId] : null;
    if (!sp) return;

    // Create ally at the entity's last position
    const ally: Entity = {
      tileX: entity.tileX, tileY: entity.tileY,
      facing: Direction.Down,
      stats: {
        hp: Math.floor(entity.stats.maxHp * 0.5),
        maxHp: entity.stats.maxHp,
        atk: entity.stats.atk, def: entity.stats.def,
        level: entity.stats.level,
      },
      alive: true, spriteKey: sp.spriteKey, name: sp.name,
      types: sp.types, attackType: sp.attackType,
      skills: createSpeciesSkills(sp),
      statusEffects: [], isAlly: true, speciesId: entity.speciesId,
      ability: entity.ability,
      allyTactic: AllyTactic.FollowMe,
    };

    const recruitTex = `${sp.spriteKey}-idle`;
    if (this.textures.exists(recruitTex)) {
      ally.sprite = this.add.sprite(
        this.tileToPixelX(ally.tileX), this.tileToPixelY(ally.tileY), recruitTex
      ).setScale(TILE_SCALE).setDepth(10);
      const recruitAnim = `${sp.spriteKey}-idle-${Direction.Down}`;
      if (this.anims.exists(recruitAnim)) ally.sprite.play(recruitAnim);
    }

    // Recruitment animation — pink heart + flash
    if (ally.sprite) ally.sprite.setTint(0xff88cc);
    this.time.delayedCall(400, () => { if (ally.sprite) ally.sprite.clearTint(); });

    const heart = this.add.text(
      this.tileToPixelX(ally.tileX), this.tileToPixelY(ally.tileY) - 20,
      "♥", { fontSize: "18px", color: "#ff6b9d", fontFamily: "monospace" }
    ).setOrigin(0.5).setDepth(50);
    this.tweens.add({
      targets: heart, y: heart.y - 30, alpha: { from: 1, to: 0 },
      duration: 1000, ease: "Quad.easeOut",
      onComplete: () => heart.destroy(),
    });

    sfxRecruit();
    this.allies.push(ally);
    this.allEntities.push(ally);
    this.showLog(`${sp.name} joined your team!`);
    this.updateHUD();
  }

  // ── Enemy AI ──

  private getEnemyActions(): (() => Promise<void>)[] {
    return this.enemies
      .filter((e) => e.alive)
      .map((enemy) => {
        return async () => {
          if (!enemy.alive || !this.player.alive) return;

          // Check paralysis
          if (isParalyzed(enemy)) {
            this.showLog(`${enemy.name} is paralyzed and can't move!`);
            return;
          }

          // Check Frozen
          if (isFrozen(enemy)) {
            this.showLog(`${enemy.name} is frozen solid!`);
            this.tickEntityStatus(enemy);
            return;
          }

          // Check Flinch
          if (isFlinched(enemy)) {
            this.showLog(`${enemy.name} flinched!`);
            this.tickEntityStatus(enemy);
            return;
          }

          // Check Drowsy
          if (isDrowsySleep(enemy)) {
            this.showLog(`${enemy.name} is drowsy and fell asleep!`);
            this.tickEntityStatus(enemy);
            return;
          }

          // Tick enemy status effects
          this.tickEntityStatus(enemy);

          // Find closest adjacent target (player or ally)
          const adjacentTargets = [this.player, ...this.allies].filter(
            t => t.alive && chebyshevDist(enemy.tileX, enemy.tileY, t.tileX, t.tileY) === 1
          );
          if (adjacentTargets.length > 0) {
            // Prefer attacking player, otherwise random
            const target = adjacentTargets.find(t => t === this.player) ?? adjacentTargets[0];
            const dir = directionToPlayer(enemy, target);
            enemy.facing = dir;
            const usableSkills = enemy.skills.filter(s => s.currentPp > 0 && s.power > 0);
            if (usableSkills.length > 0 && Math.random() < 0.4) {
              const skill = usableSkills[Math.floor(Math.random() * usableSkills.length)];
              skill.currentPp--;
              await this.performSkill(enemy, skill, dir);
            } else {
              await this.performBasicAttack(enemy, target);
            }
            this.updateHUD();
            return;
          }

          const moveDir = getEnemyMoveDirection(
            enemy, this.player,
            this.dungeon.terrain, this.dungeon.width, this.dungeon.height,
            this.allEntities
          );

          if (moveDir !== null && this.canEntityMove(enemy, moveDir)) {
            await this.moveEntity(enemy, moveDir);
            // Check hazard tiles for enemies after movement
            this.checkEntityHazard(enemy, false);
          }

          // ── Floor Mutation: FastEnemies — 20% chance of a bonus move ──
          if (hasMutation(this.floorMutations, MutationType.FastEnemies) && enemy.alive && this.player.alive) {
            const chance = getMutationEffect(MutationType.FastEnemies, "doubleMoveChance");
            if (Math.random() < chance) {
              const bonusDir = getEnemyMoveDirection(
                enemy, this.player,
                this.dungeon.terrain, this.dungeon.width, this.dungeon.height,
                this.allEntities
              );
              if (bonusDir !== null && this.canEntityMove(enemy, bonusDir)) {
                await this.moveEntity(enemy, bonusDir);
                this.checkEntityHazard(enemy, false);
              }
            }
          }

          // ── WarpFloor: 10% chance enemy teleports to a random ground tile ──
          if (this.floorEvent?.type === FloorEventType.WarpFloor && enemy.alive && Math.random() < 0.10) {
            this.warpEntityRandom(enemy);
          }
        };
      });
  }

  // ── Floor Event Helpers ──

  /** WindyFloor: push defender 1 tile away from attacker (if ground tile is free). */
  private applyWindyKnockback(attacker: Entity, defender: Entity) {
    const dx = defender.tileX - attacker.tileX;
    const dy = defender.tileY - attacker.tileY;
    // Normalize to -1/0/1
    const pushX = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
    const pushY = dy === 0 ? 0 : (dy > 0 ? 1 : -1);
    if (pushX === 0 && pushY === 0) return;

    const nx = defender.tileX + pushX;
    const ny = defender.tileY + pushY;
    // Bounds + terrain check
    if (nx < 0 || ny < 0 || nx >= this.dungeon.width || ny >= this.dungeon.height) return;
    if (this.dungeon.terrain[ny][nx] !== TerrainType.GROUND) return;
    // Check if another entity occupies that tile
    if (this.allEntities.some(e => e.alive && e.tileX === nx && e.tileY === ny && e !== defender)) return;

    defender.tileX = nx;
    defender.tileY = ny;
    if (defender.sprite) {
      this.tweens.add({
        targets: defender.sprite,
        x: nx * TILE_DISPLAY + TILE_DISPLAY / 2,
        y: ny * TILE_DISPLAY + TILE_DISPLAY / 2,
        duration: 100,
        ease: "Quad.easeOut",
      });
    }
  }

  /** WarpFloor: teleport an entity to a random walkable ground tile. */
  private warpEntityRandom(entity: Entity) {
    const { width, height, terrain } = this.dungeon;
    // Collect candidate tiles
    const candidates: { x: number; y: number }[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (terrain[y][x] !== TerrainType.GROUND) continue;
        if (this.allEntities.some(e => e.alive && e.tileX === x && e.tileY === y)) continue;
        candidates.push({ x, y });
      }
    }
    if (candidates.length === 0) return;
    const dest = candidates[Math.floor(Math.random() * candidates.length)];

    // Flash before warp
    if (entity.sprite) {
      entity.sprite.setTint(0xc084fc);
      this.time.delayedCall(150, () => {
        if (entity.sprite) entity.sprite.clearTint();
      });
    }

    entity.tileX = dest.x;
    entity.tileY = dest.y;
    if (entity.sprite) {
      entity.sprite.setPosition(
        dest.x * TILE_DISPLAY + TILE_DISPLAY / 2,
        dest.y * TILE_DISPLAY + TILE_DISPLAY / 2
      );
    }
  }

  // ── Ally AI ──

  private getAllyActions(): (() => Promise<void>)[] {
    return this.allies
      .filter((a) => a.alive)
      .map((ally) => {
        return async () => {
          if (!ally.alive || !this.player.alive) return;
          if (isParalyzed(ally)) return;
          if (isFrozen(ally)) { this.tickEntityStatus(ally); return; }
          if (isFlinched(ally)) { this.tickEntityStatus(ally); return; }
          if (isDrowsySleep(ally)) { this.tickEntityStatus(ally); return; }
          this.tickEntityStatus(ally);

          // Party position determines follow distance (0 = closest, 3 = farthest)
          const partyPosition = this.allies.indexOf(ally);
          const { moveDir, attackTarget } = getAllyMoveDirection(
            ally, this.player, this.enemies,
            this.dungeon.terrain, this.dungeon.width, this.dungeon.height,
            this.allEntities,
            partyPosition >= 0 ? partyPosition : 0
          );

          // ── Smart skill selection ──
          // Check for self-targeting skills (heal/buff) even without an attack target
          const selectedSkill = selectAllySkill(ally, attackTarget, this.allies, this.player);

          if (selectedSkill && selectedSkill.range === SkillRange.Self) {
            // Self-targeting skill (heal/buff) — can use even without attack target
            selectedSkill.currentPp--;
            this.showAllySkillPopup(ally, selectedSkill);
            await this.performSkill(ally, selectedSkill, ally.facing);
            this.updateHUD();
          } else if (attackTarget) {
            const dir = directionTo(ally, attackTarget);
            ally.facing = dir;
            if (selectedSkill) {
              // Use the intelligently selected skill
              selectedSkill.currentPp--;
              this.showAllySkillPopup(ally, selectedSkill);
              await this.performSkill(ally, selectedSkill, dir);
            } else {
              await this.performBasicAttack(ally, attackTarget);
            }
            this.updateHUD();
          } else if (moveDir !== null && this.canEntityMove(ally, moveDir)) {
            await this.moveEntity(ally, moveDir);
            this.recoverPP(ally);
            // Check hazard tiles for allies after movement
            this.checkEntityHazard(ally, false);
          }
        };
      });
  }

  /** Show a brief skill name popup above an ally when they use a skill */
  private showAllySkillPopup(ally: Entity, skill: Skill) {
    if (!ally.sprite) return;
    const x = ally.sprite.x;
    const y = ally.sprite.y - 20;
    const popup = this.add.text(x, y, skill.name, {
      fontSize: "9px",
      color: "#a5f3fc",
      fontFamily: "monospace",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(300);

    this.tweens.add({
      targets: popup,
      y: y - 18,
      alpha: { from: 1, to: 0 },
      duration: 700,
      ease: "Quad.easeOut",
      onComplete: () => popup.destroy(),
    });
  }

  /** Serialize allies for floor transition / save */
  private serializeAllies(): AllyData[] {
    return this.allies.filter(a => a.alive).map(a => ({
      speciesId: a.speciesId!,
      hp: a.stats.hp,
      maxHp: a.stats.maxHp,
      atk: a.stats.atk,
      def: a.stats.def,
      level: a.stats.level,
      skills: serializeSkills(a.skills),
    }));
  }

  /** Format seconds into MM:SS display string */
  private formatTime(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // ══════════════════════════════════════════════════════════
  // ── Auto-Explore System ──
  // ══════════════════════════════════════════════════════════

  /**
   * BFS to find direction toward the nearest unexplored (not-yet-visited) floor tile.
   * Returns the Direction the player should take as the first step, or null if none reachable.
   */
  private autoExploreBFS(): Direction | null {
    const { width, height, terrain } = this.dungeon;
    const px = this.player.tileX;
    const py = this.player.tileY;

    // BFS from player position
    const dist: number[][] = Array.from({ length: height }, () => new Array(width).fill(-1));
    const parent: { dx: number; dy: number }[][] = Array.from(
      { length: height }, () => new Array(width).fill(null)
    );
    dist[py][px] = 0;

    // BFS queue: [x, y]
    const queue: [number, number][] = [[px, py]];
    let head = 0;

    // 8 directions: prefer cardinal first for more natural corridor movement
    const bfsDirs: { dx: number; dy: number }[] = [
      { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
      { dx: 1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 },
    ];

    while (head < queue.length) {
      const [cx, cy] = queue[head++];

      for (const d of bfsDirs) {
        const nx = cx + d.dx;
        const ny = cy + d.dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        if (dist[ny][nx] !== -1) continue;
        if (terrain[ny][nx] !== TerrainType.GROUND) continue;

        // For diagonal moves, check both adjacent cardinals are ground (wall-clip prevention)
        if (d.dx !== 0 && d.dy !== 0) {
          if (terrain[cy][cx + d.dx] !== TerrainType.GROUND) continue;
          if (terrain[cy + d.dy][cx] !== TerrainType.GROUND) continue;
        }

        dist[ny][nx] = dist[cy][cx] + 1;
        parent[ny][nx] = { dx: d.dx, dy: d.dy };

        // Found an unexplored tile — trace back to find first step
        if (!this.visited[ny][nx]) {
          return this.traceAutoExplorePath(px, py, nx, ny, parent);
        }

        // Don't BFS through tiles occupied by enemies (but still explore past them)
        const blocked = this.allEntities.some(
          e => e !== this.player && e.alive && e.tileX === nx && e.tileY === ny
        );
        if (!blocked) {
          queue.push([nx, ny]);
        }
      }
    }

    return null; // No reachable unexplored tiles
  }

  /** Trace the BFS parent chain back to get the direction for the first step from player */
  private traceAutoExplorePath(
    startX: number, startY: number,
    goalX: number, goalY: number,
    parentMap: { dx: number; dy: number }[][]
  ): Direction | null {
    let cx = goalX;
    let cy = goalY;

    // Walk backward from goal to start
    while (true) {
      const p = parentMap[cy][cx];
      if (!p) return null;
      const prevX = cx - p.dx;
      const prevY = cy - p.dy;
      if (prevX === startX && prevY === startY) {
        // p.dx, p.dy is the step from start → this is our direction
        return this.dxdyToDirection(p.dx, p.dy);
      }
      cx = prevX;
      cy = prevY;
    }
  }

  /** Convert dx,dy offset to Direction enum */
  private dxdyToDirection(dx: number, dy: number): Direction | null {
    for (let d = 0; d < 8; d++) {
      if (DIR_DX[d as Direction] === dx && DIR_DY[d as Direction] === dy) {
        return d as Direction;
      }
    }
    return null;
  }

  /** Check if auto-explore should stop (returns reason string or null if should continue) */
  private checkAutoExploreStop(): string | null {
    const px = this.player.tileX;
    const py = this.player.tileY;

    // Player died or game over
    if (!this.player.alive || this.gameOver) return "danger";

    // Enemy visible (within player's sight range = 4 tiles, same as revealArea radius)
    for (const e of this.enemies) {
      if (e.alive && this.visited[e.tileY]?.[e.tileX]) {
        const dist = chebyshevDist(px, py, e.tileX, e.tileY);
        if (dist <= 4) return `${e.name} spotted nearby!`;
      }
    }

    // Item found nearby (within 2 tiles)
    for (const fi of this.floorItems) {
      const dist = chebyshevDist(px, py, fi.x, fi.y);
      if (dist <= 2 && this.visited[fi.y]?.[fi.x]) return `Found ${fi.item.name} nearby!`;
    }

    // Stairs found nearby (within 3 tiles)
    const { stairsPos } = this.dungeon;
    if (this.visited[stairsPos.y]?.[stairsPos.x]) {
      const stairDist = chebyshevDist(px, py, stairsPos.x, stairsPos.y);
      if (stairDist <= 3) return "Stairs nearby!";
    }

    return null;
  }

  /** Start auto-explore mode */
  private startAutoExplore() {
    if (this.autoExploring) {
      this.stopAutoExplore("Cancelled.");
      return;
    }
    if (this.turnManager.isBusy || !this.player.alive || this.gameOver ||
        this.bagOpen || this.menuOpen || this.settingsOpen || this.shopOpen || this.teamPanelOpen || this.eventOpen || this.fullMapOpen || this.relicOverlayOpen) return;

    // Check stop conditions before even starting
    const preCheck = this.checkAutoExploreStop();
    if (preCheck) {
      this.showLog(preCheck);
      return;
    }

    this.autoExploring = true;
    this.showLog("Auto-exploring...");

    // Show pulsing AUTO indicator
    this.showAutoExploreIndicator();

    // Add global tap-to-cancel listener with a short delay so the current tap doesn't cancel immediately
    this.time.delayedCall(200, () => {
      if (this.autoExploring) {
        this.input.on("pointerdown", this.onAutoExploreInterrupt, this);
      }
    });

    // Start the auto-step loop
    this.autoExploreStep();
  }

  /** Perform one auto-explore step, then schedule the next */
  private async autoExploreStep() {
    if (!this.autoExploring) return;
    if (this.turnManager.isBusy) {
      // Wait and retry
      this.autoExploreTimer = this.time.delayedCall(50, () => this.autoExploreStep());
      return;
    }

    // Check stop conditions before moving
    const stopReason = this.checkAutoExploreStop();
    if (stopReason) {
      this.stopAutoExplore(stopReason);
      return;
    }

    // Find the next direction via BFS
    const dir = this.autoExploreBFS();
    if (dir === null) {
      this.stopAutoExplore("No more areas to explore.");
      return;
    }

    // Check if we can actually move there (entity collision etc.)
    if (!this.canEntityMove(this.player, dir)) {
      // Might be temporarily blocked by an entity; try again next tick
      this.autoExploreTimer = this.time.delayedCall(100, () => this.autoExploreStep());
      return;
    }

    // Record HP before the step to detect damage taken
    const hpBefore = this.player.stats.hp;

    // Perform the turn (same as handlePlayerAction for movement)
    this.player.facing = dir;

    await this.turnManager.executeTurn(
      () => this.moveEntity(this.player, dir),
      [...this.getAllyActions(), ...this.getEnemyActions()]
    );

    // PP recovery on movement
    this.recoverPP(this.player);

    // Check for items on ground (but don't stop for it — stop condition handles nearby items)
    const itemHere = this.floorItems.find(
      fi => fi.x === this.player.tileX && fi.y === this.player.tileY
    );
    if (itemHere) {
      this.stopAutoExplore(`Found ${itemHere.item.name}!`);
      this.tickBelly();
      this.tickWeather();
      this.tickEntityStatus(this.player);
      this.updateHUD();
      return;
    }

    // Traps, hazards, stairs, shop, monster house checks
    this.checkTraps();
    this.checkPlayerHazard();
    this.revealNearbyTraps();
    // Don't call checkStairs — that would auto-advance the floor. Let the stop condition handle it.
    this.checkShop();
    this.checkMonsterHouse();
    this.checkEventRoom();
    this.puzzleSys.checkPuzzleRoom();
    this.checkShrine();

    // Belly drain, weather, status
    this.tickBelly();
    this.tickWeather();
    this.tickEntityStatus(this.player);
    this.updateHUD();

    // Check exploration reward tiers during auto-explore
    this.checkExplorationRewards();

    // Check if player died from belly/status/traps
    if (!this.player.alive && !this.gameOver) {
      this.stopAutoExplore();
      this.showGameOver();
      return;
    }

    // Check if player took damage this step (trap, burn, hunger, etc.)
    if (this.player.stats.hp < hpBefore) {
      this.stopAutoExplore("Took damage!");
      return;
    }

    // Check stop conditions again after the move
    if (!this.autoExploring) return; // might have been stopped by monster house trigger etc.
    const postStopReason = this.checkAutoExploreStop();
    if (postStopReason) {
      this.stopAutoExplore(postStopReason);
      return;
    }

    // Schedule next step (150ms for faster-than-manual movement)
    this.autoExploreTimer = this.time.delayedCall(150, () => this.autoExploreStep());
  }

  /** Stop auto-explore and clean up */
  private stopAutoExplore(reason?: string) {
    if (!this.autoExploring) return;
    this.autoExploring = false;

    if (this.autoExploreTimer) {
      this.autoExploreTimer.destroy();
      this.autoExploreTimer = null;
    }

    // Remove the interrupt listener if still active
    this.input.off("pointerdown", this.onAutoExploreInterrupt, this);

    // Hide AUTO indicator
    this.hideAutoExploreIndicator();

    if (reason) {
      this.showLog(reason);
    }
  }

  /** Handler for user tap to interrupt auto-explore */
  private onAutoExploreInterrupt = () => {
    if (this.autoExploring) {
      this.stopAutoExplore("Stopped.");
    }
  };

  /** Show the pulsing AUTO indicator in top-right corner */
  private showAutoExploreIndicator() {
    if (this.autoExploreText) this.autoExploreText.destroy();
    if (this.autoExploreTween) this.autoExploreTween.destroy();

    this.autoExploreText = this.add.text(GAME_WIDTH - 8, 66, "AUTO", {
      fontSize: "11px",
      color: "#4ade80",
      fontFamily: "monospace",
      fontStyle: "bold",
      backgroundColor: "#00000088",
      padding: { x: 4, y: 2 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(105);

    this.autoExploreTween = this.tweens.add({
      targets: this.autoExploreText,
      alpha: { from: 1.0, to: 0.5 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /** Hide the AUTO indicator */
  private hideAutoExploreIndicator() {
    if (this.autoExploreTween) {
      this.autoExploreTween.destroy();
      this.autoExploreTween = null;
    }
    if (this.autoExploreText) {
      this.autoExploreText.destroy();
      this.autoExploreText = null;
    }
  }

  // ══════════════════════════════════════════════════════════
  // ── Secret Room System ─────────────────────────────────
  // ══════════════════════════════════════════════════════════

  /**
   * Find a suitable wall tile adjacent to a corridor that can host a secret entrance.
   * The wall must have enough space behind it (3x3 area that is currently all walls).
   * Returns the wall position and the direction into the wall (for carving the room).
   */
  private findSecretWallPosition(
    terrain: TerrainType[][],
    rooms: { x: number; y: number; w: number; h: number }[],
    mapW: number, mapH: number,
    playerStart: { x: number; y: number },
    stairsPos: { x: number; y: number },
  ): { wall: { x: number; y: number }; insideDir: { dx: number; dy: number } } | null {
    // Build a set of room interior tiles (to avoid placing inside existing rooms)
    const roomTileSet = new Set<string>();
    for (const r of rooms) {
      for (let ry = r.y; ry < r.y + r.h; ry++) {
        for (let rx = r.x; rx < r.x + r.w; rx++) {
          roomTileSet.add(`${rx},${ry}`);
        }
      }
    }

    // Candidate walls: wall tiles adjacent to at least one ground tile (corridor or room edge)
    const candidates: { wall: { x: number; y: number }; insideDir: { dx: number; dy: number } }[] = [];
    const dirs = [
      { dx: 0, dy: -1 }, // north
      { dx: 0, dy: 1 },  // south
      { dx: -1, dy: 0 }, // west
      { dx: 1, dy: 0 },  // east
    ];

    for (let y = 2; y < mapH - 5; y++) {
      for (let x = 2; x < mapW - 5; x++) {
        if (terrain[y][x] !== TerrainType.WALL) continue;
        // Skip if too close to player start or stairs
        const distPlayer = Math.abs(x - playerStart.x) + Math.abs(y - playerStart.y);
        const distStairs = Math.abs(x - stairsPos.x) + Math.abs(y - stairsPos.y);
        if (distPlayer < 4 || distStairs < 4) continue;

        for (const d of dirs) {
          const adjX = x + d.dx;
          const adjY = y + d.dy;
          if (adjX < 0 || adjX >= mapW || adjY < 0 || adjY >= mapH) continue;
          if (terrain[adjY][adjX] !== TerrainType.GROUND) continue;

          // The "inside" direction is opposite to the corridor side
          const insideDx = -d.dx;
          const insideDy = -d.dy;

          // Check if a 3x3 area behind this wall (in insideDir) is all walls
          const behindX = x + insideDx;
          const behindY = y + insideDy;
          let valid = true;

          // Check a 3x3 region centered on behindX,behindY
          for (let dy2 = -1; dy2 <= 1; dy2++) {
            for (let dx2 = -1; dx2 <= 1; dx2++) {
              const cx = behindX + dx2;
              const cy = behindY + dy2;
              if (cx < 1 || cx >= mapW - 1 || cy < 1 || cy >= mapH - 1) { valid = false; break; }
              if (terrain[cy][cx] !== TerrainType.WALL) { valid = false; break; }
              if (roomTileSet.has(`${cx},${cy}`)) { valid = false; break; }
            }
            if (!valid) break;
          }

          // Also check a 1-tile buffer around the 3x3 to avoid bleeding into corridors
          if (valid) {
            for (let dy2 = -2; dy2 <= 2; dy2++) {
              for (let dx2 = -2; dx2 <= 2; dx2++) {
                // Skip the inner 3x3, only check the border ring
                if (Math.abs(dy2) <= 1 && Math.abs(dx2) <= 1) continue;
                const cx = behindX + dx2;
                const cy = behindY + dy2;
                if (cx < 0 || cx >= mapW || cy < 0 || cy >= mapH) { valid = false; break; }
                // Buffer tiles should be walls (to prevent merging with other rooms)
                if (terrain[cy][cx] !== TerrainType.WALL) { valid = false; break; }
              }
              if (!valid) break;
            }
          }

          if (valid) {
            candidates.push({ wall: { x, y }, insideDir: { dx: insideDx, dy: insideDy } });
          }
        }
      }
    }

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * Carve a 3x3 secret room behind the secret wall tile.
   * Returns the list of ground tiles created (excluding the wall tile itself).
   */
  private carveSecretRoom(
    wallPos: { x: number; y: number },
    insideDir: { dx: number; dy: number },
    terrain: TerrainType[][],
    mapW: number, mapH: number,
  ): { x: number; y: number }[] {
    const tiles: { x: number; y: number }[] = [];
    const behindX = wallPos.x + insideDir.dx;
    const behindY = wallPos.y + insideDir.dy;

    // Carve a 3x3 room centered on (behindX, behindY)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = behindX + dx;
        const ty = behindY + dy;
        if (tx < 1 || tx >= mapW - 1 || ty < 1 || ty >= mapH - 1) continue;
        terrain[ty][tx] = TerrainType.GROUND;
        tiles.push({ x: tx, y: ty });
      }
    }

    return tiles;
  }

  /**
   * Start a subtle shimmer animation on the secret wall tile (hint for players).
   * Every 3 seconds, the wall flickers briefly.
   */
  private startSecretWallShimmer() {
    if (!this.secretWallPos) return;

    this.secretWallShimmerGfx = this.add.graphics().setDepth(3);

    this.secretWallShimmerTimer = this.time.addEvent({
      delay: 3000,
      loop: true,
      callback: () => {
        if (!this.secretWallPos || this.secretRoomDiscovered) {
          if (this.secretWallShimmerTimer) {
            this.secretWallShimmerTimer.destroy();
            this.secretWallShimmerTimer = null;
          }
          if (this.secretWallShimmerGfx) {
            this.secretWallShimmerGfx.destroy();
            this.secretWallShimmerGfx = null;
          }
          return;
        }

        // Only shimmer if tile is currently visible or visited
        const wx = this.secretWallPos.x;
        const wy = this.secretWallPos.y;
        if (!this.currentlyVisible[wy]?.[wx] && !this.visited[wy]?.[wx]) return;

        // Brief alpha twitch
        const gfx = this.secretWallShimmerGfx!;
        gfx.clear();
        gfx.fillStyle(0xfbbf24, 0.3);
        gfx.fillRect(
          wx * TILE_DISPLAY + 2, wy * TILE_DISPLAY + 2,
          TILE_DISPLAY - 4, TILE_DISPLAY - 4,
        );

        // Fade out after 200ms
        this.time.delayedCall(200, () => {
          if (gfx && gfx.scene) gfx.clear();
        });
      },
    });
  }

  /**
   * Check if the player is walking into a secret wall tile and open it.
   * Returns true if the wall was opened (so player can move there).
   */
  private tryOpenSecretWall(targetX: number, targetY: number): boolean {
    if (!this.secretWallPos || this.secretRoomDiscovered) return false;
    if (targetX !== this.secretWallPos.x || targetY !== this.secretWallPos.y) return false;

    // Open the secret wall — change it to ground
    this.dungeon.terrain[targetY][targetX] = TerrainType.GROUND;
    this.secretRoomDiscovered = true;
    // Run log: secret room found
    this.runLog.add(RunLogEvent.SecretRoomFound, this.secretRoomData?.type ?? "Secret Room", this.currentFloor, this.turnManager.turn);

    // Stop shimmer
    if (this.secretWallShimmerTimer) {
      this.secretWallShimmerTimer.destroy();
      this.secretWallShimmerTimer = null;
    }
    if (this.secretWallShimmerGfx) {
      this.secretWallShimmerGfx.destroy();
      this.secretWallShimmerGfx = null;
    }

    // Visual: update the theme overlay for newly carved tiles
    if (this.themeOverlay) {
      // Draw ground overlay on the wall tile + secret room tiles
      const allNewTiles = [{ x: targetX, y: targetY }, ...this.secretRoomTiles];
      for (const tile of allNewTiles) {
        this.themeOverlay.fillStyle(this.currentTheme.floorColor, 0.18);
        this.themeOverlay.fillRect(
          tile.x * TILE_DISPLAY, tile.y * TILE_DISPLAY,
          TILE_DISPLAY, TILE_DISPLAY,
        );
      }
    }

    // Camera shake for dramatic reveal
    this.cameras.main.shake(200, 0.005);

    // Sound effect
    sfxPickup();

    // Show announcement
    this.showSecretRoomAnnouncement();

    // Draw room effect tile graphics
    this.drawSecretRoomEffectTile();

    // Mark secret room data as discovered
    if (this.secretRoomData) {
      this.secretRoomData.discovered = true;
    }

    return true;
  }

  /**
   * Show a prominent "You found a Secret Room!" announcement with gold sparkle.
   */
  private showSecretRoomAnnouncement() {
    if (!this.secretRoomData) return;

    const typeLabel = this.secretRoomData.name;
    this.showLog(`You found a Secret Room! (${typeLabel})`);

    // Create a centered gold announcement text
    const announce = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40,
      `Secret Room Found!\n${typeLabel}`,
      {
        fontSize: "14px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
        stroke: "#000000", strokeThickness: 3, align: "center",
        backgroundColor: "#1a1a2ecc", padding: { x: 12, y: 8 },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(150);

    // Sparkle particles around announcement
    const sparkleGfx = this.add.graphics().setScrollFactor(0).setDepth(149);
    for (let i = 0; i < 8; i++) {
      const sx = GAME_WIDTH / 2 + (Math.random() - 0.5) * 120;
      const sy = GAME_HEIGHT / 2 - 40 + (Math.random() - 0.5) * 60;
      sparkleGfx.fillStyle(0xfbbf24, 0.8);
      sparkleGfx.fillCircle(sx, sy, 2 + Math.random() * 2);
    }

    // Fade out after 2 seconds
    this.tweens.add({
      targets: announce,
      alpha: 0,
      duration: 500,
      delay: 1800,
      onComplete: () => {
        announce.destroy();
        sparkleGfx.destroy();
      },
    });

    this.tweens.add({
      targets: sparkleGfx,
      alpha: 0,
      duration: 500,
      delay: 1800,
    });
  }

  /**
   * Draw the effect tile graphic in the center of the secret room based on type.
   */
  private drawSecretRoomEffectTile() {
    if (!this.secretEffectTile || !this.secretRoomData) return;

    const tx = this.secretEffectTile.x;
    const ty = this.secretEffectTile.y;
    const px = tx * TILE_DISPLAY;
    const py = ty * TILE_DISPLAY;

    const gfx = this.add.graphics().setDepth(4);

    switch (this.secretRoomData.type) {
      case SecretRoomType.TreasureVault: {
        // Gold carpet + item sprites placed as floor items
        gfx.fillStyle(0xfbbf24, 0.15);
        for (const tile of this.secretRoomTiles) {
          gfx.fillRect(tile.x * TILE_DISPLAY, tile.y * TILE_DISPLAY, TILE_DISPLAY, TILE_DISPLAY);
        }
        // Place items on the secret room tiles
        if (this.secretRoomData.reward.items) {
          const items = this.secretRoomData.reward.items;
          const placementTiles = this.secretRoomTiles.filter(
            t => !(t.x === this.secretEffectTile!.x && t.y === this.secretEffectTile!.y)
          );
          for (let i = 0; i < items.length && i < placementTiles.length; i++) {
            const itemId = items[i];
            const itemDef = ITEM_DB[itemId];
            if (!itemDef) continue;
            const pt = placementTiles[i];
            const sprite = this.add.text(
              pt.x * TILE_DISPLAY + TILE_DISPLAY / 2,
              pt.y * TILE_DISPLAY + TILE_DISPLAY / 2,
              "\u2605", { fontSize: "14px", color: "#fde047" }
            ).setOrigin(0.5).setDepth(6);
            this.floorItems.push({ x: pt.x, y: pt.y, item: itemDef, sprite });
          }
        }
        // Gold text at center
        if (this.secretRoomData.reward.gold) {
          const goldText = this.add.text(
            px + TILE_DISPLAY / 2, py + TILE_DISPLAY / 2,
            `${this.secretRoomData.reward.gold}G`,
            { fontSize: "10px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
              stroke: "#000000", strokeThickness: 2 }
          ).setOrigin(0.5).setDepth(7);
          this.secretRoomGraphics.push(goldText as unknown as Phaser.GameObjects.Graphics);
        }
        break;
      }

      case SecretRoomType.HealingSpring: {
        // Blue glowing center tile
        gfx.fillStyle(0x60a5fa, 0.35);
        gfx.fillRect(px + 4, py + 4, TILE_DISPLAY - 8, TILE_DISPLAY - 8);
        // Pulsing blue glow
        this.tweens.add({
          targets: gfx,
          alpha: { from: 1, to: 0.5 },
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
        // Label
        const healLabel = this.add.text(
          px + TILE_DISPLAY / 2, py - 6,
          "Spring", { fontSize: "7px", color: "#60a5fa", fontFamily: "monospace",
            stroke: "#000000", strokeThickness: 2 }
        ).setOrigin(0.5).setDepth(7);
        this.secretRoomGraphics.push(healLabel as unknown as Phaser.GameObjects.Graphics);
        break;
      }

      case SecretRoomType.SkillShrine: {
        // Purple glowing tile
        gfx.fillStyle(0xa855f7, 0.35);
        gfx.fillRect(px + 4, py + 4, TILE_DISPLAY - 8, TILE_DISPLAY - 8);
        this.tweens.add({
          targets: gfx,
          alpha: { from: 1, to: 0.5 },
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
        const shrineLabel = this.add.text(
          px + TILE_DISPLAY / 2, py - 6,
          "Shrine", { fontSize: "7px", color: "#a855f7", fontFamily: "monospace",
            stroke: "#000000", strokeThickness: 2 }
        ).setOrigin(0.5).setDepth(7);
        this.secretRoomGraphics.push(shrineLabel as unknown as Phaser.GameObjects.Graphics);
        break;
      }

      case SecretRoomType.TrainingRoom: {
        // Orange tile
        gfx.fillStyle(0xf59e0b, 0.35);
        gfx.fillRect(px + 4, py + 4, TILE_DISPLAY - 8, TILE_DISPLAY - 8);
        this.tweens.add({
          targets: gfx,
          alpha: { from: 1, to: 0.5 },
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
        const trainLabel = this.add.text(
          px + TILE_DISPLAY / 2, py - 6,
          "Training", { fontSize: "7px", color: "#f59e0b", fontFamily: "monospace",
            stroke: "#000000", strokeThickness: 2 }
        ).setOrigin(0.5).setDepth(7);
        this.secretRoomGraphics.push(trainLabel as unknown as Phaser.GameObjects.Graphics);
        break;
      }

      case SecretRoomType.WarpHub: {
        // Swirling portal (teal/cyan)
        gfx.fillStyle(0x22d3ee, 0.4);
        gfx.fillCircle(px + TILE_DISPLAY / 2, py + TILE_DISPLAY / 2, TILE_DISPLAY / 3);
        gfx.lineStyle(2, 0x22d3ee, 0.6);
        gfx.strokeCircle(px + TILE_DISPLAY / 2, py + TILE_DISPLAY / 2, TILE_DISPLAY / 3 + 4);
        this.tweens.add({
          targets: gfx,
          angle: { from: 0, to: 360 },
          duration: 3000,
          repeat: -1,
          ease: "Linear",
        });
        const warpLabel = this.add.text(
          px + TILE_DISPLAY / 2, py - 6,
          "Warp", { fontSize: "7px", color: "#22d3ee", fontFamily: "monospace",
            stroke: "#000000", strokeThickness: 2 }
        ).setOrigin(0.5).setDepth(7);
        this.secretRoomGraphics.push(warpLabel as unknown as Phaser.GameObjects.Graphics);
        break;
      }
    }

    this.secretRoomGraphics.push(gfx);
  }

  /**
   * Check if the player is standing on the secret room effect tile and apply the reward.
   */
  private checkSecretRoom() {
    if (!this.secretRoomData || !this.secretRoomDiscovered || this.secretRoomUsed) return;
    if (!this.secretEffectTile) return;
    if (this.secretWarpOpen) return; // warp overlay already open

    const px = this.player.tileX;
    const py = this.player.tileY;
    const ex = this.secretEffectTile.x;
    const ey = this.secretEffectTile.y;

    // For TreasureVault, collect gold when stepping on center tile
    if (this.secretRoomData.type === SecretRoomType.TreasureVault) {
      if (px === ex && py === ey) {
        this.applySecretRewardTreasure();
      }
      return;
    }

    // For other types, stepping on the effect tile triggers the reward
    if (px !== ex || py !== ey) return;

    switch (this.secretRoomData.type) {
      case SecretRoomType.HealingSpring:
        this.applySecretRewardHealing();
        break;
      case SecretRoomType.SkillShrine:
        this.applySecretRewardSkill();
        break;
      case SecretRoomType.TrainingRoom:
        this.applySecretRewardTraining();
        break;
      case SecretRoomType.WarpHub:
        this.showWarpHubOverlay();
        break;
    }
  }

  /** TreasureVault: collect gold from center tile */
  private applySecretRewardTreasure() {
    if (!this.secretRoomData?.reward.gold) return;
    this.secretRoomUsed = true;
    const goldAmount = this.secretRoomData.reward.gold;
    this.gold += goldAmount;
    sfxPickup();
    this.showLog(`Collected ${goldAmount} Gold from the Treasure Vault!`);

    // Flash gold text popup
    if (this.player.sprite) {
      this.showDamagePopup(
        this.player.sprite.x, this.player.sprite.y - 10,
        0, 1, `+${goldAmount}G`
      );
    }
    this.updateHUD();
  }

  /** HealingSpring: full HP/PP restore + AtkUp+DefUp buff for 10 turns */
  private applySecretRewardHealing() {
    this.secretRoomUsed = true;
    sfxHeal();

    // Full HP restore
    this.player.stats.hp = this.player.stats.maxHp;

    // Full PP restore for all skills
    for (const sk of this.player.skills) {
      sk.currentPp = sk.pp;
    }

    // Temporary AtkUp + DefUp buff
    const buffTurns = this.secretRoomData?.reward.buffTurns ?? 10;
    if (!this.player.statusEffects.some(s => s.type === SkillEffect.AtkUp)) {
      this.player.statusEffects.push({ type: SkillEffect.AtkUp, turnsLeft: buffTurns });
    }
    if (!this.player.statusEffects.some(s => s.type === SkillEffect.DefUp)) {
      this.player.statusEffects.push({ type: SkillEffect.DefUp, turnsLeft: buffTurns });
    }

    this.showLog("The Healing Spring fully restores your HP and PP!");
    this.showLog("ATK and DEF boosted for 10 turns!");

    // Heal allies too
    for (const ally of this.allies) {
      if (ally.alive) {
        ally.stats.hp = ally.stats.maxHp;
        for (const sk of ally.skills) {
          sk.currentPp = sk.pp;
        }
      }
    }

    this.updateHUD();
  }

  /** SkillShrine: learn a random rare skill (replace weakest skill if 4 skills already) */
  private applySecretRewardSkill() {
    this.secretRoomUsed = true;
    const skillId = this.secretRoomData?.reward.skillId;
    if (!skillId || !SKILL_DB[skillId]) {
      this.showLog("The shrine is empty...");
      return;
    }

    sfxSkill();
    const template = SKILL_DB[skillId];
    const newSkill = createSkill(template);

    if (this.player.skills.length < 4) {
      // Has room — just add
      this.player.skills.push(newSkill);
      this.showLog(`Learned ${newSkill.name} from the Skill Shrine!`);
    } else {
      // Replace the lowest-power skill
      let weakestIdx = 0;
      let weakestPower = Infinity;
      for (let i = 0; i < this.player.skills.length; i++) {
        if (this.player.skills[i].power < weakestPower) {
          weakestPower = this.player.skills[i].power;
          weakestIdx = i;
        }
      }
      const replaced = this.player.skills[weakestIdx];
      this.player.skills[weakestIdx] = newSkill;
      this.showLog(`Learned ${newSkill.name}! (Replaced ${replaced.name})`);
    }

    this.updateHUD();
  }

  /** TrainingRoom: grant 2 level-ups worth of EXP */
  private applySecretRewardTraining() {
    this.secretRoomUsed = true;
    const expGain = this.secretRoomData?.reward.exp ?? 100;
    sfxLevelUp();

    this.totalExp += expGain;
    this.showLog(`Gained ${expGain} EXP from the Training Room!`);

    // Process level ups
    const { results } = processLevelUp(this.player.stats, 0, this.totalExp);
    for (const r of results) {
      this.showLog(`Level Up! Lv${r.newLevel}! HP+${r.hpGain} ATK+${r.atkGain} DEF+${r.defGain}`);
    }

    if (this.player.sprite) {
      this.showDamagePopup(
        this.player.sprite.x, this.player.sprite.y - 10,
        0, 1, `+${expGain} EXP`
      );
    }

    this.updateHUD();
  }

  /**
   * Show WarpHub floor selection overlay.
   * Allows the player to choose any floor from 1 to currentFloor - 1.
   */
  private showWarpHubOverlay() {
    if (this.secretWarpOpen || this.currentFloor <= 1) {
      this.showLog("The portal flickers but has nowhere to send you...");
      this.secretRoomUsed = true;
      return;
    }

    this.secretWarpOpen = true;
    this.stopAutoExplore();

    // Dim overlay
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.75
    ).setScrollFactor(0).setDepth(200).setInteractive();
    this.secretRoomUI.push(overlay);

    // Title
    const title = this.add.text(GAME_WIDTH / 2, 60, "Warp Hub", {
      fontSize: "16px", color: "#22d3ee", fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.secretRoomUI.push(title);

    const subtitle = this.add.text(GAME_WIDTH / 2, 85, "Choose a floor to warp to:", {
      fontSize: "10px", color: "#aab0c8", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.secretRoomUI.push(subtitle);

    // Floor buttons (scrollable list of floors 1 to currentFloor - 1)
    const maxFloor = this.currentFloor - 1;
    const buttonsPerRow = 4;
    const btnW = 60;
    const btnH = 28;
    const gap = 6;
    const startY = 110;

    for (let f = 1; f <= maxFloor; f++) {
      const row = Math.floor((f - 1) / buttonsPerRow);
      const col = (f - 1) % buttonsPerRow;
      const bx = GAME_WIDTH / 2 - ((Math.min(maxFloor, buttonsPerRow) * (btnW + gap) - gap) / 2) + col * (btnW + gap) + btnW / 2;
      const by = startY + row * (btnH + gap);

      // Only show if it fits on screen
      if (by > GAME_HEIGHT - 100) continue;

      const btn = this.add.text(bx, by, `B${f}F`, {
        fontSize: "11px", color: "#e0e0e0", fontFamily: "monospace", fontStyle: "bold",
        backgroundColor: "#334466", padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });

      btn.on("pointerover", () => btn.setColor("#22d3ee"));
      btn.on("pointerout", () => btn.setColor("#e0e0e0"));
      btn.on("pointerdown", () => {
        this.executeWarp(f);
      });

      this.secretRoomUI.push(btn);
    }

    // Cancel button
    const cancelBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 60, "Cancel", {
      fontSize: "12px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
      backgroundColor: "#1a1a2ecc", padding: { x: 16, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setInteractive({ useHandCursor: true });

    cancelBtn.on("pointerover", () => cancelBtn.setColor("#ff7777"));
    cancelBtn.on("pointerout", () => cancelBtn.setColor("#ef4444"));
    cancelBtn.on("pointerdown", () => {
      this.closeWarpHubOverlay();
    });

    this.secretRoomUI.push(cancelBtn);
  }

  /**
   * Execute the warp to a chosen floor.
   */
  private executeWarp(targetFloor: number) {
    this.closeWarpHubOverlay();
    this.secretRoomUsed = true;

    sfxStairs();
    this.showLog(`Warped to B${targetFloor}F!`);

    this.gameOver = true;

    // Pass modifier IDs through floor transitions
    const modifierIds = this.activeModifiers.length > 0 ? this.activeModifiers.map(m => m.id) : undefined;

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(600, () => {
      this.scene.restart({
        floor: targetFloor,
        hp: this.player.stats.hp,
        maxHp: this.player.stats.maxHp,
        skills: this.player.skills,
        inventory: this.inventory,
        level: this.player.stats.level,
        atk: this.player.stats.atk,
        def: this.player.stats.def,
        exp: this.totalExp,
        dungeonId: this.dungeonDef.id,
        allies: this.serializeAllies(),
        belly: this.belly,
        starter: this.starterId,
        challengeMode: this.challengeMode ?? undefined,
        modifiers: modifierIds,
        runElapsedTime: this.runElapsedSeconds,
        scoreChain: this.scoreChain,
        legendaryEncountered: this.legendaryEncountered,
        questItemsCollected: this.questItemsCollected,
        questItemsUsed: this.questItemsUsed,
        relics: this.activeRelics,
        runLogEntries: this.runLog.serialize(),
      });
    });
  }

  /**
   * Close the WarpHub overlay.
   */
  private closeWarpHubOverlay() {
    this.secretWarpOpen = false;
    for (const obj of this.secretRoomUI) {
      if (obj && (obj as Phaser.GameObjects.GameObject).scene) {
        obj.destroy();
      }
    }
    this.secretRoomUI = [];
  }

  // ── Relic Artifact System ──
  private tryRelicDrop(dropType: "boss" | "gauntlet" | "legendary") {
    const relic = rollRelicDrop(this.currentFloor, this.dungeonDef.difficulty, dropType);
    if (!relic || this.gameOver) return;
    this.time.delayedCall(dropType === "legendary" ? 3000 : 1500, () => this.showRelicFoundOverlay(relic));
  }

  private showRelicFoundOverlay(relic: Relic) {
    if (this.gameOver) return;
    this.relicOverlayOpen = true;
    if (this.domHud) setDomHudInteractive(this.domHud, false);
    const ui: Phaser.GameObjects.GameObject[] = [];
    ui.push(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setScrollFactor(0).setDepth(400).setInteractive());
    const tc = getRelicRarityColor(relic.rarity);
    ui.push(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, "Relic Found!", { fontSize: "18px", color: tc, fontFamily: "monospace", fontStyle: "bold", stroke: "#000000", strokeThickness: 4 }).setOrigin(0.5).setScrollFactor(0).setDepth(401));
    const ib = this.add.graphics().setScrollFactor(0).setDepth(401);
    ib.fillStyle(relic.color, 0.3); ib.fillRoundedRect(GAME_WIDTH / 2 - 20, GAME_HEIGHT / 2 - 65, 40, 40, 8);
    ib.lineStyle(2, relic.color, 1); ib.strokeRoundedRect(GAME_WIDTH / 2 - 20, GAME_HEIGHT / 2 - 65, 40, 40, 8);
    ui.push(ib);
    ui.push(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 45, relic.icon, { fontSize: "20px", color: tc, fontFamily: "monospace", fontStyle: "bold" }).setOrigin(0.5).setScrollFactor(0).setDepth(402));
    ui.push(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 15, relic.name, { fontSize: "14px", color: "#ffffff", fontFamily: "monospace", fontStyle: "bold" }).setOrigin(0.5).setScrollFactor(0).setDepth(401));
    ui.push(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 2, relic.rarity, { fontSize: "10px", color: tc, fontFamily: "monospace" }).setOrigin(0.5).setScrollFactor(0).setDepth(401));
    ui.push(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, relic.description, { fontSize: "10px", color: "#d4d4d8", fontFamily: "monospace", wordWrap: { width: 260 }, align: "center" }).setOrigin(0.5).setScrollFactor(0).setDepth(401));
    if (this.activeRelics.length < MAX_RELICS) {
      const takeBtn = this.add.text(GAME_WIDTH / 2 - 60, GAME_HEIGHT / 2 + 55, "[Take]", { fontSize: "14px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold", backgroundColor: "#1a2e1acc", padding: { x: 10, y: 5 } }).setOrigin(0.5).setScrollFactor(0).setDepth(402).setInteractive();
      ui.push(takeBtn);
      const leaveBtn = this.add.text(GAME_WIDTH / 2 + 60, GAME_HEIGHT / 2 + 55, "[Leave]", { fontSize: "14px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold", backgroundColor: "#2e1a1acc", padding: { x: 10, y: 5 } }).setOrigin(0.5).setScrollFactor(0).setDepth(402).setInteractive();
      ui.push(leaveBtn);
      takeBtn.on("pointerdown", () => { this.addRelic(relic); this.closeRelicOverlay(); this.spawnRelicVFX(relic); });
      leaveBtn.on("pointerdown", () => { this.closeRelicOverlay(); this.showLog("Left the relic behind."); });
    } else {
      ui.push(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 45, "Inventory full! Swap a relic:", { fontSize: "9px", color: "#fbbf24", fontFamily: "monospace" }).setOrigin(0.5).setScrollFactor(0).setDepth(401));
      for (let ri = 0; ri < this.activeRelics.length; ri++) {
        const existing = this.activeRelics[ri];
        const ec = getRelicRarityColor(existing.rarity);
        const swapBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 65 + ri * 22, `${existing.icon} ${existing.name} (${existing.rarity})`, { fontSize: "10px", color: ec, fontFamily: "monospace", backgroundColor: "#1a1a2ecc", padding: { x: 6, y: 2 } }).setOrigin(0.5).setScrollFactor(0).setDepth(402).setInteractive();
        ui.push(swapBtn);
        const swapIdx = ri;
        swapBtn.on("pointerdown", () => {
          const old = this.activeRelics[swapIdx];
          this.activeRelics[swapIdx] = relic;
          this.relicEffects = getAggregatedRelicEffects(this.activeRelics);
          this.showLog(`Swapped ${old.name} for ${relic.name}!`);
          this.closeRelicOverlay(); this.spawnRelicVFX(relic); this.updateRelicHUD();
          if (old.effect.hpMult && old.effect.hpMult > 0) {
            const loss = Math.floor(this.player.stats.maxHp * old.effect.hpMult / (1 + old.effect.hpMult));
            this.player.stats.maxHp -= loss;
            this.player.stats.hp = Math.min(this.player.stats.hp, this.player.stats.maxHp);
          }
          if (relic.effect.hpMult && relic.effect.hpMult > 0) {
            const gain = Math.floor(this.player.stats.maxHp * relic.effect.hpMult);
            this.player.stats.maxHp += gain; this.player.stats.hp += gain;
          }
          if (relic.effect.focusSash) this.focusSashUsed = false;
          this.createSkillButtons(); this.updateHUD();
        });
      }
      const leaveBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 65 + this.activeRelics.length * 22 + 5, "[Leave]", { fontSize: "12px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold", backgroundColor: "#2e1a1acc", padding: { x: 10, y: 4 } }).setOrigin(0.5).setScrollFactor(0).setDepth(402).setInteractive();
      ui.push(leaveBtn);
      leaveBtn.on("pointerdown", () => { this.closeRelicOverlay(); this.showLog("Left the relic behind."); });
    }
    this.relicOverlayUI = ui;
  }

  private closeRelicOverlay() {
    this.relicOverlayOpen = false;
    if (this.domHud) setDomHudInteractive(this.domHud, true);
    for (const obj of this.relicOverlayUI) {
      if (obj && (obj as Phaser.GameObjects.GameObject).scene) obj.destroy();
    }
    this.relicOverlayUI = [];
  }

  private addRelic(relic: Relic) {
    this.activeRelics.push(relic);
    this.relicEffects = getAggregatedRelicEffects(this.activeRelics);
    this.showLog(`Obtained ${relic.name}! (${relic.rarity})`);
    if (relic.effect.hpMult && relic.effect.hpMult > 0) {
      const hpGain = Math.floor(this.player.stats.maxHp * relic.effect.hpMult);
      this.player.stats.maxHp += hpGain;
      this.player.stats.hp += hpGain;
      this.showLog(`Max HP increased by ${hpGain}!`);
    }
    if (relic.effect.focusSash) this.focusSashUsed = false;
    this.updateRelicHUD();
    this.createSkillButtons();
    this.updateHUD();
  }

  private updateRelicHUD() {
    for (const ic of this.relicHudIcons) { if (ic && ic.scene) ic.destroy(); }
    this.relicHudIcons = [];
    if (this.activeRelics.length === 0) return;
    for (let i = 0; i < this.activeRelics.length; i++) {
      const r = this.activeRelics[i];
      const clr = getRelicRarityColor(r.rarity);
      const ic = this.add.text(8 + i * 18, 64, r.icon, {
        fontSize: "12px", color: clr, fontFamily: "monospace", fontStyle: "bold",
        backgroundColor: "#0a0a0fcc", padding: { x: 2, y: 1 },
      }).setScrollFactor(0).setDepth(100).setInteractive();
      ic.on("pointerdown", () => this.showRelicInfoPopup(r));
      this.relicHudIcons.push(ic);
    }
  }

  private updateBlessingHUD() {
    for (const ic of this.blessingHudIcons) { if (ic && ic.scene) ic.destroy(); }
    this.blessingHudIcons = [];
    if (this.activeBlessings.length === 0) return;
    const startX = 8 + this.activeRelics.length * 18;
    for (let i = 0; i < this.activeBlessings.length; i++) {
      const ab = this.activeBlessings[i];
      const icon = ab.blessing.isCurse ? "▼" : "▲";
      const clr = `#${ab.blessing.color.toString(16).padStart(6, "0")}`;
      const ic = this.add.text(startX + i * 18, 64, icon, {
        fontSize: "12px", color: clr, fontFamily: "monospace", fontStyle: "bold",
        backgroundColor: "#0a0a0fcc", padding: { x: 2, y: 1 },
      }).setScrollFactor(0).setDepth(100).setInteractive();
      ic.on("pointerdown", () => this.showBlessingInfoPopup(ab));
      this.blessingHudIcons.push(ic);
    }
  }

  private updateTypeGemHUD() {
    for (const ic of this.typeGemHudIcons) { if (ic && ic.scene) ic.destroy(); }
    this.typeGemHudIcons = [];
    if (this.activeTypeGems.size === 0) return;
    // Position: row below relics/blessings
    const startX = 8 + (this.activeRelics.length + this.activeBlessings.length) * 18;
    let idx = 0;
    for (const [type, boost] of this.activeTypeGems) {
      const gemLabel = type.substring(0, 3).toUpperCase();
      const ic = this.add.text(startX + idx * 28, 64, `${gemLabel}+${boost}%`, {
        fontSize: "7px", color: "#ffffff", fontFamily: "monospace", fontStyle: "bold",
        backgroundColor: "#0a0a0fcc", padding: { x: 2, y: 1 },
      }).setScrollFactor(0).setDepth(100).setInteractive();
      ic.on("pointerdown", () => {
        const popup = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2,
          `${type} Gem Active\n+${boost}% ${type}-type damage\n(this floor only)`, {
          fontSize: "11px", color: "#ffffff", fontFamily: "monospace", fontStyle: "bold",
          backgroundColor: "#0a0a0fee", padding: { x: 12, y: 8 },
          wordWrap: { width: 250 }, align: "center",
        }).setOrigin(0.5).setScrollFactor(0).setDepth(500);
        popup.setInteractive();
        popup.on("pointerdown", () => popup.destroy());
        this.time.delayedCall(3000, () => { if (popup.scene) popup.destroy(); });
      });
      this.typeGemHudIcons.push(ic);
      idx++;
    }
  }

  private showBlessingInfoPopup(ab: ActiveBlessing) {
    const clr = `#${ab.blessing.color.toString(16).padStart(6, "0")}`;
    const label = ab.blessing.isCurse ? "CURSE" : "BLESSING";
    const popup = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2,
      `${ab.blessing.isCurse ? "▼" : "▲"} ${ab.blessing.name} [${label}]\n${ab.blessing.description}\n${ab.remainingFloors} floors remaining`, {
      fontSize: "11px", color: clr, fontFamily: "monospace", fontStyle: "bold",
      backgroundColor: "#0a0a0fee", padding: { x: 12, y: 8 },
      wordWrap: { width: 250 }, align: "center",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(500);
    popup.setInteractive();
    popup.on("pointerdown", () => popup.destroy());
    this.time.delayedCall(2500, () => { if (popup.scene) popup.destroy(); });
  }

  private grantBlessing(blessing: Blessing) {
    const ab = activateBlessing(blessing);
    this.activeBlessings.push(ab);
    const label = blessing.isCurse ? "CURSE" : "BLESSING";
    const clr = `#${blessing.color.toString(16).padStart(6, "0")}`;
    this.showLog(`${blessing.isCurse ? "▼" : "▲"} ${label}: ${blessing.name} — ${blessing.description}`);
    sfxBuff();
    const overlay = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40,
      `${blessing.isCurse ? "▼ Cursed!" : "▲ Blessed!"}\n${blessing.name}\n${blessing.description}`, {
      fontSize: "13px", color: clr, fontFamily: "monospace", fontStyle: "bold",
      backgroundColor: "#0a0a1aee", padding: { x: 16, y: 10 },
      wordWrap: { width: 260 }, align: "center",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(500).setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, y: GAME_HEIGHT / 2 - 50, duration: 300, ease: "Back.easeOut" });
    this.time.delayedCall(2000, () => {
      this.tweens.add({ targets: overlay, alpha: 0, duration: 300, onComplete: () => overlay.destroy() });
    });
    this.updateBlessingHUD();
    this.runLog.add(RunLogEvent.ItemPickedUp, `${label}: ${blessing.name}`, this.currentFloor, this.turnManager.turn);
  }

  private showRelicInfoPopup(relic: Relic) {
    const clr = getRelicRarityColor(relic.rarity);
    const popup = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2,
      `${relic.icon} ${relic.name}\n${relic.rarity}\n${relic.description}`, {
      fontSize: "11px", color: clr, fontFamily: "monospace", fontStyle: "bold",
      backgroundColor: "#0a0a0fee", padding: { x: 12, y: 8 },
      wordWrap: { width: 250 }, align: "center",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(500);
    popup.setInteractive();
    popup.on("pointerdown", () => popup.destroy());
    this.time.delayedCall(2000, () => { if (popup.scene) popup.destroy(); });
  }

  private spawnRelicVFX(relic: Relic) {
    const px = this.player.sprite?.x ?? GAME_WIDTH / 2;
    const py = this.player.sprite?.y ?? GAME_HEIGHT / 2;
    switch (relic.rarity) {
      case RelicRarity.Common:
        for (let i = 0; i < 8; i++) {
          const g = this.add.graphics().setDepth(300);
          g.fillStyle(0x4ade80, 0.9);
          g.fillCircle(px + (Math.random() - 0.5) * 30, py + (Math.random() - 0.5) * 20, 2 + Math.random() * 2);
          this.tweens.add({ targets: g, y: -30 - Math.random() * 40, alpha: { from: 1, to: 0 }, duration: 600 + Math.random() * 400, ease: "Quad.easeOut", onComplete: () => g.destroy() });
        }
        break;
      case RelicRarity.Rare:
        for (let i = 0; i < 12; i++) {
          const angle = (Math.PI * 2 / 12) * i;
          const g = this.add.graphics().setDepth(300);
          g.fillStyle(0x60a5fa, 1); g.fillCircle(px, py, 2);
          this.tweens.add({ targets: g, x: Math.cos(angle) * 40, y: Math.sin(angle) * 40, alpha: { from: 1, to: 0 }, scaleX: { from: 1, to: 0.3 }, scaleY: { from: 1, to: 0.3 }, duration: 500 + Math.random() * 300, ease: "Quad.easeOut", onComplete: () => g.destroy() });
        }
        break;
      case RelicRarity.Epic:
        for (let i = 0; i < 15; i++) {
          const g = this.add.graphics().setDepth(300);
          const angle = (Math.PI * 2 / 15) * i;
          const rd = 5 + Math.random() * 15;
          g.fillStyle(0xa855f7, 0.9);
          g.fillCircle(px + Math.cos(angle) * rd, py + Math.sin(angle) * rd, 2 + Math.random() * 2);
          this.tweens.add({ targets: g, x: Math.cos(angle + Math.PI) * 20, y: -50 - Math.random() * 30, alpha: { from: 1, to: 0 }, duration: 800 + Math.random() * 400, ease: "Cubic.easeOut", onComplete: () => g.destroy() });
        }
        this.cameras.main.flash(300, 168, 85, 247);
        break;
      case RelicRarity.Legendary:
        this.cameras.main.shake(400, 0.015);
        this.cameras.main.flash(500, 251, 191, 36);
        const vfxColors = [0xfbbf24, 0xfde68a, 0xffffff, 0xf59e0b];
        for (let i = 0; i < 25; i++) {
          const c = vfxColors[Math.floor(Math.random() * vfxColors.length)];
          const g = this.add.graphics().setDepth(300);
          g.fillStyle(c, 1); g.fillCircle(px, py, 2 + Math.random() * 3);
          const angle = Math.random() * Math.PI * 2;
          const dist = 30 + Math.random() * 60;
          this.tweens.add({ targets: g, x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - 20, alpha: { from: 1, to: 0 }, scaleX: { from: 1.2, to: 0.2 }, scaleY: { from: 1.2, to: 0.2 }, duration: 700 + Math.random() * 500, ease: "Quad.easeOut", onComplete: () => g.destroy() });
        }
        break;
    }
  }
}
