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
import { AbilityId, SPECIES_ABILITIES, ABILITIES } from "../core/ability";
import {
  getAbilityLevel, getTorrentValues, getSturdyHp,
  getStaticChance, getFlameBodyChance, getPickupChance,
  getRunAwayDodgeBonus, getLevitateDodgeBonus,
} from "../core/ability-upgrade";
import { WeatherType, WEATHERS, weatherDamageMultiplier, isWeatherImmune, rollFloorWeather, WeatherIntensity, INTENSITY_MULTIPLIER, INTENSITY_COLOR, getWeatherIntensity, shouldWeatherTransition, getWeatherSynergyBonus } from "../core/weather";
// dungeon-shop imports moved to ShopSystem
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
  sfxLevelUp, sfxRecruit, sfxDeath, sfxBossDefeat,
  sfxHeal, sfxSkill, sfxMenuOpen, sfxMenuClose,
  sfxEvolution, sfxVictory, sfxGameOver,
  sfxCombo, sfxCritical, sfxDodge, sfxItemPickup, sfxBuff, sfxWeatherChange,
  getBgmVolume, getSfxVolume, setBgmVolume, setSfxVolume,
} from "../core/sound-manager";
import {
  FloorEvent, FloorEventType, rollFloorEvent, invertEffectiveness, floorEventColorHex,
} from "../core/floor-events";
import { FloorTheme, getDepthAdjustedTheme } from "../core/floor-themes";
import { addToStorage } from "../core/crafting";
import {
  ScoreChain, ChainAction, createScoreChain, addChainAction, resetChain,
  tickChainIdle, getChainTier, getChainColor, getChainHexColor,
} from "../core/score-chain";
import {
  shouldTriggerGauntlet, generateGauntlet,
} from "../core/boss-gauntlet";
import { GauntletSystem } from "../systems/gauntlet-system";
import {
  PuzzleType, shouldSpawnPuzzle, generatePuzzle,
} from "../core/puzzle-rooms";
import { PuzzleSystem } from "../systems/puzzle-system";
import { SecretRoomSystem } from "../systems/secret-room-system";
import { AutoExploreSystem } from "../systems/auto-explore-system";
import { MinimapSystem } from "../systems/minimap-system";
import { TrapHazardSystem } from "../systems/trap-hazard-system";
import { ItemSystem, FloorItem } from "../systems/item-system";
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
  ActiveBlessing, Blessing, getBlessingEffect,
  activateBlessing, rollBlessingOrCurse, getRandomBlessing, getRandomCurse,
  deserializeBlessings,
} from "../core/blessings";
import { ShrineSystem } from "../systems/shrine-system";
import { CombatSystem } from "../systems/combat-system";
import { StairsSystem } from "../systems/stairs-system";
import { DeathRescueSystem } from "../systems/death-rescue-system";
import { WeatherBellySystem } from "../systems/weather-belly-system";
import { EventRoomSystem } from "../systems/event-room-system";
import { MonsterHouseSystem } from "../systems/monster-house-system";
import { ShopSystem } from "../systems/shop-system";
import {
  RescueOption, MAX_RESCUES_PER_RUN,
  getRescueOptions,
} from "../core/rescue-system";
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


  // Minimap + Fog of War (delegated to MinimapSystem)
  private minimapSys!: MinimapSystem;

  // ── Forwarding getters/setters for visited/currentlyVisible/fullMapOpen ──
  // These are needed because AutoExploreHost and SecretRoomHost access them via `host.visited` etc.
  get visited(): boolean[][] { return this.minimapSys.visited; }
  set visited(v: boolean[][]) { this.minimapSys.visited = v; }
  get currentlyVisible(): boolean[][] { return this.minimapSys.currentlyVisible; }
  set currentlyVisible(v: boolean[][]) { this.minimapSys.currentlyVisible = v; }
  get fullMapOpen(): boolean { return this.minimapSys.fullMapOpen; }
  set fullMapOpen(v: boolean) { this.minimapSys.fullMapOpen = v; }

  // HP Bar graphics
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpBarFill!: Phaser.GameObjects.Graphics;
  private portraitSprite!: Phaser.GameObjects.Sprite;

  // Status icons HUD (next to HP bar)
  private statusHudTexts: Phaser.GameObjects.Text[] = [];

  // Status flash animation timers
  private statusFlashTimers: Phaser.Time.TimerEvent[] = [];

  // Weather & Belly system (extracted)
  private weatherBellySys!: WeatherBellySystem;

  // Skill state
  private activeSkillIndex = -1; // -1 = no skill selected

  // Item state
  private inventory: ItemStack[] = [];
  private persistentInventory: ItemStack[] | null = null;

  // Item System (floor items, bag UI, item usage — delegated)
  private itemSys!: ItemSystem;

  // Game state — Death/rescue/clear delegated to DeathRescueSystem
  private deathRescueSys!: DeathRescueSystem;
  /** Public getter: gameOver flag (lives in DeathRescueSystem) */
  get gameOver() { return this.deathRescueSys?.gameOver ?? false; }
  set gameOver(v: boolean) { if (this.deathRescueSys) this.deathRescueSys.gameOver = v; }
  private enemiesDefeated = 0;
  // Quest tracking
  private questItemsCollected = 0;
  private questItemsUsed = false;

  // Trap & hazard system
  private trapHazardSys!: TrapHazardSystem;

  // Belly state forwarding (actual state lives in weatherBellySys)
  get belly() { return this.weatherBellySys.belly; }
  set belly(v: number) { this.weatherBellySys.belly = v; }
  get maxBelly() { return this.weatherBellySys.maxBelly; }
  set maxBelly(v: number) { this.weatherBellySys.maxBelly = v; }
  private persistentBelly: number | null = null;

  // Shop (delegated to ShopSystem)
  private shopSys!: ShopSystem;
  /** Expose shop state for other system host interfaces (MonsterHouse, Item, Minimap, etc.) */
  get shopRoom() { return this.shopSys?.shopRoom ?? null; }
  get shopOpen() { return this.shopSys?.shopOpen ?? false; }
  get shopClosed() { return this.shopSys?.shopClosed ?? false; }
  get playerInShopRoom() { return this.shopSys?.isPlayerInShopRoom ?? false; }
  get shopItems() { return this.shopSys?.shopItems ?? []; }
  get shopTiles() { return this.shopSys?.shopTiles ?? []; }
  private gold = 0;

  // Starter species
  private starterId = "mudkip";

  // Monster House (delegated to MonsterHouseSystem)
  private monsterHouseSys!: MonsterHouseSystem;

  // Event Room (delegated to EventRoomSystem)
  private eventRoomSys!: EventRoomSystem;

  // Floor Event (floor-wide global effect)
  private floorEvent: FloorEvent | null = null;
  private floorEventBadge: Phaser.GameObjects.Text | null = null;

  // Puzzle Room (delegated to PuzzleSystem)
  private puzzleSys!: PuzzleSystem;

  // NG+ prestige system
  private ngPlusLevel = 0;
  private ngPlusBonuses: NGPlusBonusEffects = getNGPlusBonusEffects(0);
  private ngPlusBadgeText: Phaser.GameObjects.Text | null = null;

  // Weather & floorTurns forwarding (actual state lives in weatherBellySys)
  get currentWeather() { return this.weatherBellySys.currentWeather; }
  set currentWeather(v) { this.weatherBellySys.currentWeather = v; }
  get currentWeatherIntensity() { return this.weatherBellySys.currentWeatherIntensity; }
  set currentWeatherIntensity(v) { this.weatherBellySys.currentWeatherIntensity = v; }
  get floorTurns() { return this.weatherBellySys.floorTurns; }
  set floorTurns(v: number) { this.weatherBellySys.floorTurns = v; }
  // Turn count forwarding (for StairsSystem host)
  get turnCount() { return this.turnManager.turn; }

  // Boss state
  private bossEntity: Entity | null = null;
  private bossHpBar: Phaser.GameObjects.Graphics | null = null;
  private bossHpBg: Phaser.GameObjects.Graphics | null = null;
  private bossNameText: Phaser.GameObjects.Text | null = null;

  // Boss Gauntlet system
  private gauntletSys!: GauntletSystem;
  // Gauntlet stairs locked forwarding (for StairsSystem host)
  get gauntletStairsLocked() { return this.gauntletSys.gauntletStairsLocked; }

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

  // Auto-Explore (delegated to AutoExploreSystem)
  private autoExploreSys!: AutoExploreSystem;

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

  // Secret Room state (delegated to SecretRoomSystem)
  private secretRoomSys!: SecretRoomSystem;

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

  // Shrine system (per-floor, extracted)
  private shrineSys!: ShrineSystem;
  // Combat system (extracted)
  private combatSys!: CombatSystem;
  // Stairs system (extracted)
  private stairsSys!: StairsSystem;

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
    this.enemyVariantMap = new Map();
    this.variantAuraGraphics = new Map();
    // Construct deathRescueSys early so gameOver getter/setter works
    this.deathRescueSys = new DeathRescueSystem(this as any);
    this.deathRescueSys.reset();
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
    this.activeSkillIndex = -1;
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
    // Reset shrine system
    this.shrineSys = new ShrineSystem(this as any);
    this.shrineSys.reset();
    // Reset combat system
    this.combatSys = new CombatSystem(this as any);
    // Reset stairs system
    this.stairsSys = new StairsSystem(this as any);
    // Reset gauntlet system
    this.gauntletSys = new GauntletSystem(this as any);
    this.gauntletSys.reset();
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
    // trapHazardSys reset is handled in create() after system construction
    // Construct weatherBellySys early so belly/maxBelly getters work
    this.weatherBellySys = new WeatherBellySystem(this as any);
    const bellyBonus = getUpgradeBonus(meta, "bellyMax") * 20;
    this.weatherBellySys.initBelly(100 + bellyBonus, data?.belly);
    this.starterId = data?.starter ?? "mudkip";
    this.seenSpecies = new Set<string>();
    this.seenSpecies.add(this.starterId); // starter is always "seen"
    // Reset shop state (delegated to ShopSystem)
    this.shopSys = new ShopSystem(this as any);
    this.shopSys.reset();
    // Reset monster house state (delegated to MonsterHouseSystem)
    this.monsterHouseSys = new MonsterHouseSystem(this as any);
    this.monsterHouseSys.reset();
    // Reset event room state (delegated to EventRoomSystem)
    this.eventRoomSys = new EventRoomSystem(this as any);
    this.eventRoomSys.reset();
    // Reset puzzle room state (delegated to PuzzleSystem)
    this.puzzleSys = new PuzzleSystem(this as any);
    this.puzzleSys.reset();
    // Reset secret room state (delegated to SecretRoomSystem)
    this.secretRoomSys = new SecretRoomSystem(this as any);
    this.secretRoomSys.reset();
    // Reset trap & hazard state (delegated to TrapHazardSystem)
    this.trapHazardSys = new TrapHazardSystem(this as any);
    this.trapHazardSys.reset();
    // Reset item state (delegated to ItemSystem)
    this.itemSys = new ItemSystem(this as any);
    this.itemSys.reset();
    // Reset auto-explore state (delegated to AutoExploreSystem)
    this.autoExploreSys = new AutoExploreSystem(this as any);
    this.autoExploreSys.reset();
    // Reset minimap state (delegated to MinimapSystem)
    this.minimapSys = new MinimapSystem(this as any);
    this.minimapSys.resetExplorationState();
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

    // Stairs marker (drawn by StairsSystem)
    this.stairsSys.drawStairsMarker();

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
      const gauntletCfg = generateGauntlet(this.currentFloor, this.dungeonDef.id, this.dungeonDef.difficulty);
      this.gauntletSys.activate(gauntletCfg);
    }

    // ── Spawn floor items (delegated to ItemSystem) ──
    this.itemSys.initInventory();
    this.itemSys.spawnFloorItems(rooms, terrain, playerStart, stairsPos);

    // ── Spawn floor traps and hazard tiles (delegated to TrapHazardSystem) ──
    const occupiedPositions = this.itemSys.getOccupiedPositions();
    for (const e of this.enemies) occupiedPositions.add(`${e.tileX},${e.tileY}`);
    for (const a of this.allies) occupiedPositions.add(`${a.tileX},${a.tileY}`);
    const hazardOccupied = this.trapHazardSys.spawnTraps(occupiedPositions);
    this.trapHazardSys.spawnHazards(hazardOccupied);

    // ── Kecleon Shop (delegated to ShopSystem) ──
    const isBossFloor = (this.dungeonDef.boss && this.currentFloor === this.dungeonDef.floors) || this.isBossRush;

    // Switch to boss BGM theme on boss floors for dramatic atmosphere
    if (isBossFloor) {
      switchToBossTheme();
    }

    this.shopSys.trySpawnShop(rooms, playerStart, stairsPos, isBossFloor, terrain);

    // ── Monster House (delegated to MonsterHouseSystem) ──
    this.monsterHouseSys.trySpawnMonsterHouse(rooms, playerStart, terrain, stairsPos, isBossFloor);

    // ── Event Room (delegated to EventRoomSystem) ──
    this.eventRoomSys.trySpawnEventRoom(
      rooms, playerStart, stairsPos, isBossFloor,
      [this.shopSys.shopRoom, this.monsterHouseSys.monsterHouseRoom],
    );

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
        r !== this.shopSys.shopRoom &&
        r !== this.monsterHouseSys.monsterHouseRoom &&
        r !== this.eventRoomSys.eventRoom &&
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
      const secretEntrance = this.secretRoomSys.findSecretWallPosition(terrain, rooms, width, height, playerStart, stairsPos);
      if (secretEntrance) {
        this.secretRoomSys.secretWallPos = secretEntrance.wall;
        this.secretRoomSys.secretRoomData = generateSecretRoom(this.currentFloor, this.dungeonDef.difficulty);

        const roomTiles = this.secretRoomSys.carveSecretRoom(
          secretEntrance.wall, secretEntrance.insideDir,
          terrain, width, height
        );
        if (roomTiles.length > 0) {
          this.secretRoomSys.secretEffectTile = roomTiles[Math.floor(roomTiles.length / 2)];
          this.secretRoomSys.startSecretWallShimmer();
        } else {
          this.secretRoomSys.secretRoomData = null;
          this.secretRoomSys.secretWallPos = null;
        }
      }
    }

    // ── Shrine (delegated to ShrineSystem) ──
    this.shrineSys.trySpawnShrine(
      rooms, terrain, playerStart, stairsPos, isBossFloor,
      [this.shopSys.shopRoom, this.monsterHouseSys.monsterHouseRoom, this.eventRoomSys.eventRoom, this.puzzleSys.puzzleRoom],
    );

    // ── Fog of War (delegated to MinimapSystem) ──
    this.minimapSys.initFogOfWar(width, height);
    const talentSightBonus = this.talentEffects.sightRangeBonus ?? 0;
    const sightRadius = (hasMutation(this.floorMutations, MutationType.DarkFloor)
      ? getMutationEffect(MutationType.DarkFloor, "sightRadius")
      : 4) + talentSightBonus;
    this.minimapSys.revealArea(playerStart.x, playerStart.y, sightRadius);

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

    // Belly Bar (delegated to weatherBellySys)
    this.weatherBellySys.initBellyHUD();

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
        if (this.itemSys.bagOpen || this.menuOpen || this.settingsOpen || this.shopSys.shopOpen || this.eventRoomSys.eventOpen || this.teamPanelOpen || this.minimapSys.fullMapOpen || this.relicOverlayOpen || this.shrineSys.shrineOpen) return;
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

    // ── Weather (delegated to weatherBellySys) ──
    this.weatherBellySys.initWeatherHUD();
    this.setupStatusFlashAnimations();

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
      this.itemSys.spawnTreasureItems(rooms, terrain, stairsPos, extraCount);
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
        this.itemSys.clearFloorItems();
      }

      // Apply TreasureFloor: spawn extra items (doubling)
      if (fe.type === FloorEventType.TreasureFloor) {
        const extraCount = Math.max(1, Math.floor(this.dungeonDef.itemsPerFloor));
        this.itemSys.spawnTreasureItems(rooms, terrain, stairsPos, extraCount);
      }
    }

    // ── Minimap (delegated to MinimapSystem) ──
    this.minimapSys.createMinimapUI();

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
    } else if (this.gauntletSys.gauntletActive) {
      // Gauntlet announcement (deferred to give scene time to render)
      this.showLog(`${this.dungeonDef.name} B${this.currentFloor}F`);
      this.time.delayedCall(300, () => this.gauntletSys.start());
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
        if (this.autoExploreSys.autoExploring) { this.autoExploreSys.stopAutoExplore("Stopped."); return; }
        if (this.turnManager.isBusy || !this.player.alive || this.gameOver || this.itemSys.bagOpen || this.menuOpen || this.settingsOpen || this.teamPanelOpen || this.eventRoomSys.eventOpen || this.minimapSys.fullMapOpen || this.relicOverlayOpen || this.shrineSys.shrineOpen) return;
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
      if (this.autoExploreSys.autoExploring) { this.autoExploreSys.stopAutoExplore("Stopped."); return; }
      if (this.turnManager.isBusy || !this.player.alive || this.gameOver || this.itemSys.bagOpen || this.menuOpen || this.settingsOpen || this.teamPanelOpen || this.eventRoomSys.eventOpen || this.minimapSys.fullMapOpen || this.relicOverlayOpen || this.shrineSys.shrineOpen) return;
      waitTxt.setAlpha(0.5);
      this.time.delayedCall(150, () => waitTxt.setAlpha(1));
      this.turnManager.executeTurn(
        () => Promise.resolve(),
        [...this.getAllyActions(), ...this.getEnemyActions()]
      ).then(() => {
        this.combatSys.recoverPP(this.player);
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

  /** Forwarding method for AutoExploreHost.checkExplorationRewards() */
  private checkExplorationRewards() {
    this.minimapSys.checkExplorationRewards();
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

    // Update Belly bar graphics (delegated to weatherBellySys)
    this.weatherBellySys.updateBellyHUD();

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
    this.minimapSys.updateMinimap();

    // Sync DOM HUD overlay
    this.syncDomHud();
  }

  private openHamburgerMenu() {
    if (this.menuOpen) {
      this.closeMenu();
      return;
    }
    if (this.itemSys.bagOpen || this.settingsOpen || this.shopSys.shopOpen || this.teamPanelOpen || this.eventRoomSys.eventOpen || this.minimapSys.fullMapOpen || this.relicOverlayOpen || this.shrineSys.shrineOpen) return;

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
    if (this.shopSys.isPlayerInShopRoom && !this.shopSys.shopClosed && this.shopSys.hasAvailableItems) {
      items.splice(1, 0, { label: "Shop", icon: "💰", action: () => { this.closeMenu(); this.shopSys.openShopUI(); } });
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
    if (this.itemSys.bagOpen || this.menuOpen || this.settingsOpen || this.shopSys.shopOpen || this.eventRoomSys.eventOpen || this.gameOver || this.minimapSys.fullMapOpen || this.relicOverlayOpen || this.shrineSys.shrineOpen) return;

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
        if (this.turnManager.isBusy || !this.player.alive || this.gameOver || this.minimapSys.fullMapOpen || this.relicOverlayOpen) return;
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
    this.weatherBellySys.bellyText.setAlpha(0);
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
    hud.bellyLabel.textContent = this.weatherBellySys.bellyText.text;

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

    // Quick-slot button sync (delegated to ItemSystem)
    this.itemSys.syncQuickSlotHud();
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

  // ── Items (delegated to ItemSystem) ──

  private pickupItem() { this.itemSys.pickupItem(); }
  private toggleBag() { this.itemSys.toggleBag(); }
  private openBag() { this.itemSys.openBag(); }
  private closeBag() { this.itemSys.closeBag(); }
  private useQuickSlot() { this.itemSys.useQuickSlot(); }
  private updateQuickSlotLabel() { this.itemSys.updateQuickSlotLabel(); }

  private useItem(index: number) { this.itemSys.useItem(index); }

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

  private saveGame() { this.deathRescueSys.saveGame(); }

  /** Silent auto-save (no log message) */
  private autoSave() { this.deathRescueSys.autoSave(); }

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
        this.combatSys.showDamagePopup(entity.sprite.x, entity.sprite.y, burnDmg, 1.0);
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
        this.combatSys.showDamagePopup(entity.sprite.x, entity.sprite.y, bpDmg, 1.0);
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
        this.combatSys.showDamagePopup(entity.sprite.x, entity.sprite.y, curseDmg, 1.0);
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

  // ── Summon Trap Enemy Spawn (callback for TrapHazardSystem) ──

  private spawnSummonTrapEnemies(trapX: number, trapY: number) {
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
  }

  // ── Belly & Weather (delegated to weatherBellySys) ──

  private tickBelly() {
    this.weatherBellySys.tickBelly();
  }

  private resetBellyWarnings() {
    this.weatherBellySys.resetBellyWarnings();
  }

  // ── Per-Turn Tick (chain scoring, mutations, regen, then weather) ──

  private tickWeather() {
    // Weather system increments floorTurns and handles weather transitions + damage
    this.weatherBellySys.tickWeather();

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
          this.combatSys.showDamagePopup(this.player.sprite.x, this.player.sprite.y, 0, 1, `+${amount} Regen`);
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
          this.combatSys.showDamagePopup(this.player.sprite.x, this.player.sprite.y, 0, 1, `+${relicRegenAmount} Relic`);
        }
      }
    }

    // ── Blessing: Nature's Grace — regen HP every N turns ──
    const bRegenAmt = getBlessingEffect(this.activeBlessings, "regenAmount");
    const bRegenInt = getBlessingEffect(this.activeBlessings, "regenInterval") || 5;
    if (bRegenAmt > 0 && this.player.alive && this.floorTurns > 0 && this.floorTurns % bRegenInt === 0 && this.player.stats.hp < this.player.stats.maxHp) {
      this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + bRegenAmt);
      if (this.player.sprite) {
        this.combatSys.showDamagePopup(this.player.sprite.x, this.player.sprite.y, 0, 1, `+${bRegenAmt} Grace`);
      }
    }

    // ── Floor Mutation: CursedFloor — lose 1 HP every N turns ──
    if (hasMutation(this.floorMutations, MutationType.CursedFloor) && this.player.alive) {
      const interval = getMutationEffect(MutationType.CursedFloor, "curseInterval") || 10;
      const amount = getMutationEffect(MutationType.CursedFloor, "curseDamage") || 1;
      if (this.floorTurns > 0 && this.floorTurns % interval === 0) {
        this.player.stats.hp = Math.max(1, this.player.stats.hp - amount);
        if (this.player.sprite) {
          this.combatSys.showDamagePopup(this.player.sprite.x, this.player.sprite.y, amount, 0.5, "Curse");
        }
        this.showLog("The curse saps your strength!");
        this.checkPlayerDeath();
      }
    }
  }

  private checkPlayerDeath() {
    if (this.player.stats.hp <= 0 && this.player.alive) {
      if (this.tryRevive()) return;
      this.player.alive = false;
      this.showGameOver();
    }
  }


  // ── Shop delegates (exposed for ItemSystem host interface) ──
  private showSellPrompt(inventoryIndex: number) { this.shopSys.showSellPrompt(inventoryIndex); }
  private triggerShopTheft() { this.shopSys.triggerShopTheft(); }

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

  private showDungeonClear() { this.deathRescueSys.showDungeonClear(); }

  private showGameOver() { this.deathRescueSys.showGameOver(); }

  private showRunSummary(cleared: boolean, totalFloors: number) { this.deathRescueSys.showRunSummary(cleared, totalFloors); }

  private quickRetry(gold: number, cleared: boolean) { this.deathRescueSys.quickRetry(gold, cleared); }

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
        () => this.combatSys.performBasicAttack(this.player, targetEnemy),
        [...this.getAllyActions(), ...this.getEnemyActions()]
      );
    } else {
      // Check if ally is at target → swap positions
      const allyAtTarget = this.allies.find(
        a => a.alive && a.tileX === targetX && a.tileY === targetY
      );
      if (allyAtTarget) {
        await this.turnManager.executeTurn(
          () => this.combatSys.swapWithAlly(this.player, allyAtTarget, dir),
          [...this.getAllyActions(), ...this.getEnemyActions()]
        );
      } else {
        const canMove = this.combatSys.canEntityMove(this.player, dir);
        if (!canMove) {
          // Check for secret wall before giving up
          if (this.secretRoomSys.tryOpenSecretWall(targetX, targetY)) {
            // Secret wall was opened — move player into the revealed tile
            await this.turnManager.executeTurn(
              () => this.combatSys.moveEntity(this.player, dir),
              [...this.getAllyActions(), ...this.getEnemyActions()]
            );
          } else {
            this.player.sprite!.play(`${this.player.spriteKey}-idle-${dir}`);
            return;
          }
        } else {
          await this.turnManager.executeTurn(
            () => this.combatSys.moveEntity(this.player, dir),
            [...this.getAllyActions(), ...this.getEnemyActions()]
          );
        }
      }

      // PP recovery: 1 PP for a random depleted skill on movement
      this.combatSys.recoverPP(this.player);

      // Check for items on ground
      this.itemSys.checkFloorItem();

      this.trapHazardSys.checkTraps();
      this.trapHazardSys.checkPlayerHazard();
      this.trapHazardSys.revealNearbyTraps();
      this.stairsSys.checkStairs();
      this.shopSys.checkShop();
      this.monsterHouseSys.checkMonsterHouse();
      this.eventRoomSys.checkEventRoom();
      this.puzzleSys.checkPuzzleRoom();
      this.secretRoomSys.checkSecretRoom();
      this.shrineSys.checkShrine();
    }

    // Belly drain per turn (movement or attack)
    this.tickBelly();
    this.tickWeather();

    // Tick status effects (burn damage + wear-off messages)
    this.tickEntityStatus(this.player);
    this.tickShadowDance();
    this.updateHUD();

    // Check exploration reward tiers after each action
    this.minimapSys.checkExplorationRewards();

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
      () => this.combatSys.performSkill(this.player, skill, dir),
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
              this.combatSys.showDamagePopup(enemy.sprite.x, enemy.sprite.y, blastDmg, 1.0);
              this.combatSys.showEnemyHpBar(enemy);
              this.combatSys.flashEntity(enemy, 1.5);
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
          this.combatSys.showHealPopup(this.player.sprite.x, this.player.sprite.y, healAmt);
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
              this.combatSys.showDamagePopup(enemy.sprite.x, enemy.sprite.y, stormDmg, 2.0);
              this.combatSys.showEnemyHpBar(enemy);
              this.combatSys.flashEntity(enemy, 2.0);
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
          this.combatSys.showHealPopup(this.player.sprite.x, this.player.sprite.y, wrathHeal);
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
          this.combatSys.showHealPopup(this.player.sprite.x, this.player.sprite.y, fairyHeal);
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

  // ── Combat forwarding (for other systems' host interfaces) ──

  /** @see CombatSystem.canEntityMove */
  canEntityMove(entity: Entity, dir: Direction): boolean {
    return this.combatSys.canEntityMove(entity, dir);
  }
  /** @see CombatSystem.moveEntity */
  moveEntity(entity: Entity, dir: Direction): Promise<void> {
    return this.combatSys.moveEntity(entity, dir);
  }
  /** @see CombatSystem.recoverPP */
  recoverPP(entity: Entity): void {
    this.combatSys.recoverPP(entity);
  }
  /** @see CombatSystem.showDamagePopup */
  showDamagePopup(x: number, y: number, dmg: number, alpha: number, label?: string): void {
    this.combatSys.showDamagePopup(x, y, dmg, alpha, label);
  }
  /** @see CombatSystem.showHealPopup */
  showHealPopup(x: number, y: number, amount: number): void {
    this.combatSys.showHealPopup(x, y, amount);
  }
  /** @see CombatSystem.flashEntity */
  flashEntity(entity: Entity, effectiveness: number): void {
    this.combatSys.flashEntity(entity, effectiveness);
  }
  /** @see CombatSystem.showStatPopup */
  showStatPopup(x: number, y: number, text: string, color: string, delay: number): void {
    this.combatSys.showStatPopup(x, y, text, color, delay);
  }
  /** @see CombatSystem.showEnemyHpBar */
  showEnemyHpBar(entity: { sprite?: Phaser.GameObjects.Sprite; stats: { hp: number; maxHp: number } }): void {
    this.combatSys.showEnemyHpBar(entity);
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
            this.combatSys.showStatPopup(px - 16, py - 20, `HP+${r.hpGain}`, "#4ade80", 0);
            this.combatSys.showStatPopup(px, py - 20, `ATK+${r.atkGain}`, "#f87171", 200);
            this.combatSys.showStatPopup(px + 16, py - 20, `DEF+${r.defGain}`, "#60a5fa", 400);
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
                this.combatSys.showStatPopup(ally.sprite.x - 16, ally.sprite.y - 20, `HP+${lvl.hpGain}`, "#4ade80", 0);
                this.combatSys.showStatPopup(ally.sprite.x, ally.sprite.y - 20, `ATK+${lvl.atkGain}`, "#f87171", 200);
                this.combatSys.showStatPopup(ally.sprite.x + 16, ally.sprite.y - 20, `DEF+${lvl.defGain}`, "#60a5fa", 400);
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
        this.monsterHouseSys.checkMonsterHouseCleared();
      });

      // ── Gauntlet wave clear check ──
      if (this.gauntletSys.gauntletActive) {
        this.time.delayedCall(400, () => {
          this.gauntletSys.checkGauntletWaveCleared();
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


  /** Clean up legendary/mini-boss HP bars (called by GauntletSystem after gauntlet completion) */
  private cleanupExtraHpBars() {
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
              await this.combatSys.performSkill(enemy, skill, dir);
            } else {
              await this.combatSys.performBasicAttack(enemy, target);
            }
            this.updateHUD();
            return;
          }

          const moveDir = getEnemyMoveDirection(
            enemy, this.player,
            this.dungeon.terrain, this.dungeon.width, this.dungeon.height,
            this.allEntities
          );

          if (moveDir !== null && this.combatSys.canEntityMove(enemy, moveDir)) {
            await this.combatSys.moveEntity(enemy, moveDir);
            // Check hazard tiles for enemies after movement
            this.trapHazardSys.checkEntityHazard(enemy, false);
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
              if (bonusDir !== null && this.combatSys.canEntityMove(enemy, bonusDir)) {
                await this.combatSys.moveEntity(enemy, bonusDir);
                this.trapHazardSys.checkEntityHazard(enemy, false);
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
            await this.combatSys.performSkill(ally, selectedSkill, ally.facing);
            this.updateHUD();
          } else if (attackTarget) {
            const dir = directionTo(ally, attackTarget);
            ally.facing = dir;
            if (selectedSkill) {
              // Use the intelligently selected skill
              selectedSkill.currentPp--;
              this.showAllySkillPopup(ally, selectedSkill);
              await this.combatSys.performSkill(ally, selectedSkill, dir);
            } else {
              await this.combatSys.performBasicAttack(ally, attackTarget);
            }
            this.updateHUD();
          } else if (moveDir !== null && this.combatSys.canEntityMove(ally, moveDir)) {
            await this.combatSys.moveEntity(ally, moveDir);
            this.combatSys.recoverPP(ally);
            // Check hazard tiles for allies after movement
            this.trapHazardSys.checkEntityHazard(ally, false);
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

  // ── Auto-Explore (delegated to AutoExploreSystem) ──

  /** Forward for PuzzleHost / SecretRoomHost interface compatibility */
  private stopAutoExplore(reason?: string) { this.autoExploreSys.stopAutoExplore(reason); }
  private startAutoExplore() { this.autoExploreSys.startAutoExplore(); }

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
