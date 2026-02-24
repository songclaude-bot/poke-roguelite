import Phaser from "phaser";
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  TILE_SIZE,
  TILE_SCALE,
  TILE_DISPLAY,
} from "../config";
import { generateDungeon, DungeonData, TerrainType } from "../core/dungeon-generator";
import { getTileIndex } from "../core/autotiler";
import { Direction, DIR_DX, DIR_DY, angleToDirection } from "../core/direction";
import { TurnManager } from "../core/turn-manager";
import {
  Entity, canMoveTo, canMoveDiagonal, chebyshevDist,
  getEffectiveAtk, getEffectiveDef, tickStatusEffects, isParalyzed, StatusEffect,
} from "../core/entity";
import { getEnemyMoveDirection, isAdjacentToPlayer, directionToPlayer } from "../core/enemy-ai";
import { getAllyMoveDirection, tryRecruit, directionTo } from "../core/ally-ai";
import { PokemonType, getEffectiveness, effectivenessText } from "../core/type-chart";
import { Skill, SkillRange, SkillEffect, SKILL_DB, createSkill } from "../core/skill";
import { getSkillTargetTiles } from "../core/skill-targeting";
import { getEvolution } from "../core/evolution";
import { ItemDef, ItemStack, rollFloorItem, MAX_INVENTORY, ITEM_DB } from "../core/item";
import { SPECIES, PokemonSpecies, createSpeciesSkills, getLearnableSkill } from "../core/pokemon-data";
import { DungeonDef, BossDef, getDungeon, getDungeonFloorEnemies } from "../core/dungeon-data";
import { expFromEnemy, processLevelUp } from "../core/leveling";
import {
  saveDungeon, clearDungeonSave, serializeSkills, serializeInventory,
  deserializeSkills as deserializeSkillsFn,
  goldFromRun, loadMeta, saveMeta,
} from "../core/save-system";
import { TrapDef, TrapType, rollTrap, trapsPerFloor } from "../core/trap";
import { AbilityId, SPECIES_ABILITIES, ABILITIES } from "../core/ability";
import { WeatherType, WEATHERS, weatherDamageMultiplier, isWeatherImmune, rollFloorWeather } from "../core/weather";
import { ShopItem, generateShopItems, shouldSpawnShop } from "../core/shop";
import { getUpgradeBonus } from "../scenes/UpgradeScene";
import {
  initAudio, startBgm, stopBgm,
  sfxHit, sfxSuperEffective, sfxNotEffective, sfxMove, sfxPickup,
  sfxLevelUp, sfxRecruit, sfxStairs, sfxDeath, sfxBossDefeat,
  sfxHeal, sfxSkill, sfxMenuOpen, sfxMenuClose,
  sfxEvolution, sfxTrap, sfxVictory, sfxGameOver, sfxShop,
} from "../core/sound-manager";

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
  private skillButtons: Phaser.GameObjects.Text[] = [];

  // Minimap + Fog of War
  private minimapGfx!: Phaser.GameObjects.Graphics;
  private minimapBg!: Phaser.GameObjects.Graphics;
  private minimapVisible = true;
  private visited!: boolean[][];
  private readonly MINIMAP_TILE = 3; // px per tile
  private readonly MINIMAP_X = GAME_WIDTH - 80; // top-right
  private readonly MINIMAP_Y = 4;

  // HP Bar graphics
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpBarFill!: Phaser.GameObjects.Graphics;
  private portraitSprite!: Phaser.GameObjects.Sprite;

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

  // Trap state
  private floorTraps: { x: number; y: number; trap: TrapDef; sprite: Phaser.GameObjects.Text; revealed: boolean }[] = [];

  // Belly (hunger) state
  private belly = 100;
  private maxBelly = 100;
  private persistentBelly: number | null = null;

  // Shop state
  private shopItems: ShopItem[] = [];
  private shopRoom: { x: number; y: number; w: number; h: number } | null = null;
  private shopUI: Phaser.GameObjects.GameObject[] = [];
  private shopOpen = false;
  private gold = 0;
  private shopTiles: { x: number; y: number; shopIdx: number; sprite: Phaser.GameObjects.Text }[] = [];

  // Starter species
  private starterId = "mudkip";

  // Monster House
  private monsterHouseRoom: { x: number; y: number; w: number; h: number } | null = null;
  private monsterHouseTriggered = false;

  // NG+ difficulty scaling
  private ngPlusLevel = 0;

  // Weather
  private currentWeather = WeatherType.None;
  private weatherText!: Phaser.GameObjects.Text;

  // Boss state
  private bossEntity: Entity | null = null;
  private bossHpBar: Phaser.GameObjects.Graphics | null = null;
  private bossHpBg: Phaser.GameObjects.Graphics | null = null;
  private bossNameText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: "DungeonScene" });
  }

  private persistentAllies: AllyData[] | null = null;

  init(data?: { floor?: number; hp?: number; maxHp?: number; skills?: Skill[]; inventory?: ItemStack[]; level?: number; atk?: number; def?: number; exp?: number; fromHub?: boolean; dungeonId?: string; allies?: AllyData[] | null; belly?: number; starter?: string }) {
    // Apply upgrade bonuses on fresh run start (floor 1 from hub)
    const meta = loadMeta();
    const hpBonus = getUpgradeBonus(meta, "maxHp") * 5;
    const atkBonus = getUpgradeBonus(meta, "atk");
    const defBonus = getUpgradeBonus(meta, "def");

    this.dungeonDef = getDungeon(data?.dungeonId ?? "beachCave");
    const isNewRun = (data?.floor ?? 1) === 1 && !data?.hp;
    this.currentFloor = data?.floor ?? 1;
    this.persistentHp = data?.hp ?? (50 + hpBonus);
    this.persistentMaxHp = data?.maxHp ?? (50 + hpBonus);
    this.persistentSkills = data?.skills ?? null;
    this.persistentInventory = data?.inventory ?? null;
    this.persistentLevel = data?.level ?? 5;
    this.persistentAtk = data?.atk ?? (12 + atkBonus);
    this.persistentDef = data?.def ?? (6 + defBonus);
    this.totalExp = data?.exp ?? 0;
    this.enemies = [];
    this.allies = [];
    this.allEntities = [];
    this.floorItems = [];
    this.gameOver = false;
    this.bossEntity = null;
    this.bossHpBar = null;
    this.bossHpBg = null;
    this.bossNameText = null;
    this.activeSkillIndex = -1;
    this.skillButtons = [];
    this.bagOpen = false;
    this.bagUI = [];
    this.enemiesDefeated = 0;
    this.turnManager = new TurnManager();
    this.persistentAllies = data?.allies ?? null;
    this.floorTraps = [];
    const bellyBonus = getUpgradeBonus(meta, "bellyMax") * 20;
    this.maxBelly = 100 + bellyBonus;
    this.belly = data?.belly ?? this.maxBelly;
    this.starterId = data?.starter ?? "mudkip";
    this.shopItems = [];
    this.shopRoom = null;
    this.shopUI = [];
    this.shopOpen = false;
    this.shopTiles = [];
    this.monsterHouseRoom = null;
    this.monsterHouseTriggered = false;
    this.ngPlusLevel = Math.min(10, meta.totalClears); // Cap at NG+10
    this.gold = meta.gold;

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

    // Sprite dex map for all pokemon
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
    const tileset = map.addTilesetImage(this.dungeonDef.tilesetKey)!;
    map.createLayer(0, tileset, 0, 0)!.setScale(TILE_SCALE);

    // Stairs marker
    const stairsGfx = this.add.graphics();
    const sx = stairsPos.x * TILE_DISPLAY + TILE_DISPLAY / 2;
    const sy = stairsPos.y * TILE_DISPLAY + TILE_DISPLAY / 2;
    stairsGfx.fillStyle(0xfbbf24, 0.9);
    stairsGfx.fillTriangle(sx, sy - 14, sx + 10, sy, sx - 10, sy);
    stairsGfx.fillTriangle(sx, sy + 14, sx + 10, sy, sx - 10, sy);
    stairsGfx.setDepth(5);

    // ── Create animations for needed species ──
    const neededKeys = new Set<string>([this.starterId, ...this.dungeonDef.enemySpeciesIds]);
    for (const key of neededKeys) {
      const sp = SPECIES[key];
      if (!sp || this.anims.exists(`${key}-walk-0`)) continue;
      this.createAnimations(sp.spriteKey, sp.walkFrames, sp.idleFrames);
    }

    // ── Player entity ──
    const playerSp = SPECIES[this.starterId] ?? SPECIES.mudkip;
    const playerSkills = this.persistentSkills ?? createSpeciesSkills(playerSp);
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
      speciesId: this.starterId,
    };
    this.player.sprite = this.add.sprite(
      this.tileToPixelX(this.player.tileX),
      this.tileToPixelY(this.player.tileY),
      `${playerSp.spriteKey}-idle`
    );
    this.player.sprite.setScale(TILE_SCALE).setDepth(10);
    this.player.sprite.play(`${playerSp.spriteKey}-idle-${Direction.Down}`);
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
        };
        ally.sprite = this.add.sprite(
          this.tileToPixelX(ally.tileX), this.tileToPixelY(ally.tileY), `${sp.spriteKey}-idle`
        ).setScale(TILE_SCALE).setDepth(10);
        ally.sprite.play(`${sp.spriteKey}-idle-${Direction.Down}`);
        this.allies.push(ally);
        this.allEntities.push(ally);
      }
    }

    // ── Spawn enemies (dungeon + floor specific) ──
    const rooms = this.dungeon.rooms;
    const floorSpeciesIds = getDungeonFloorEnemies(this.dungeonDef, this.currentFloor);
    const floorSpecies = floorSpeciesIds.map(id => SPECIES[id]).filter(Boolean);
    if (floorSpecies.length === 0) floorSpecies.push(SPECIES.zubat);

    for (let i = 1; i < rooms.length; i++) {
      const room = rooms[i];
      for (let e = 0; e < enemiesPerRoom(this.currentFloor); e++) {
        const ex = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
        const ey = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
        if (terrain[ey][ex] !== TerrainType.GROUND) continue;
        if (ex === stairsPos.x && ey === stairsPos.y) continue;

        // Pick random species from floor pool
        const sp = floorSpecies[Math.floor(Math.random() * floorSpecies.length)];
        const enemyStats = getEnemyStats(this.currentFloor, this.dungeonDef.difficulty, sp, this.ngPlusLevel);

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
          speciesId: sp.spriteKey, // for recruitment
          ability: SPECIES_ABILITIES[sp.spriteKey],
        };
        enemy.sprite = this.add.sprite(
          this.tileToPixelX(ex), this.tileToPixelY(ey), `${sp.spriteKey}-idle`
        );
        enemy.sprite.setScale(TILE_SCALE).setDepth(9);
        enemy.sprite.play(`${sp.spriteKey}-idle-${Direction.Down}`);
        this.enemies.push(enemy);
        this.allEntities.push(enemy);
      }
    }

    // ── Monster House (15% chance, not on floor 1 or boss floors) ──
    const isLastFloor = this.dungeonDef.boss && this.currentFloor === this.dungeonDef.floors;
    if (!isLastFloor && this.currentFloor > 1 && Math.random() < 0.15 && rooms.length > 2) {
      const mhCandidates = rooms.filter((r, idx) =>
        idx > 0 && // Not player's room
        !(stairsPos.x >= r.x && stairsPos.x < r.x + r.w &&
          stairsPos.y >= r.y && stairsPos.y < r.y + r.h) &&
        (!this.shopRoom || !(r.x === this.shopRoom.x && r.y === this.shopRoom.y))
      );
      if (mhCandidates.length > 0) {
        this.monsterHouseRoom = mhCandidates[Math.floor(Math.random() * mhCandidates.length)];
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
          hp: Math.floor(baseStats.hp * bossDef.statMultiplier),
          maxHp: Math.floor(baseStats.hp * bossDef.statMultiplier),
          atk: Math.floor(baseStats.atk * bossDef.statMultiplier),
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
        boss.sprite = this.add.sprite(
          this.tileToPixelX(bx), this.tileToPixelY(by), `${sp.spriteKey}-idle`
        );
        boss.sprite.setScale(TILE_SCALE * 1.5).setDepth(11);
        boss.sprite.play(`${sp.spriteKey}-idle-${Direction.Down}`);
        // Red tint aura for boss
        boss.sprite.setTint(0xff6666);
        this.time.delayedCall(800, () => { if (boss.sprite) boss.sprite.clearTint(); });

        this.bossEntity = boss;
        this.enemies.push(boss);
        this.allEntities.push(boss);
      }
    }

    // ── Spawn floor items ──
    this.inventory = this.persistentInventory ?? [];
    for (let i = 0; i < this.dungeonDef.itemsPerFloor; i++) {
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      const ix = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
      const iy = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
      if (terrain[iy][ix] !== TerrainType.GROUND) continue;
      if (ix === stairsPos.x && iy === stairsPos.y) continue;
      if (ix === playerStart.x && iy === playerStart.y) continue;

      const item = rollFloorItem();
      const icon = item.category === "berry" ? "●" : item.category === "seed" ? "◆" : "★";
      const color = item.category === "berry" ? "#ff6b9d" : item.category === "seed" ? "#4ade80" : "#60a5fa";
      const sprite = this.add.text(
        ix * TILE_DISPLAY + TILE_DISPLAY / 2,
        iy * TILE_DISPLAY + TILE_DISPLAY / 2,
        icon, { fontSize: "16px", color, fontFamily: "monospace" }
      ).setOrigin(0.5).setDepth(6);

      this.floorItems.push({ x: ix, y: iy, item, sprite });
    }

    // ── Spawn floor traps (hidden) ──
    const trapCount = trapsPerFloor(this.currentFloor);
    for (let i = 0; i < trapCount; i++) {
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      const tx = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
      const ty = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
      if (terrain[ty][tx] !== TerrainType.GROUND) continue;
      if (tx === stairsPos.x && ty === stairsPos.y) continue;
      if (tx === playerStart.x && ty === playerStart.y) continue;
      // Don't overlap with items
      if (this.floorItems.some(fi => fi.x === tx && fi.y === ty)) continue;

      const trap = rollTrap();
      const sprite = this.add.text(
        tx * TILE_DISPLAY + TILE_DISPLAY / 2,
        ty * TILE_DISPLAY + TILE_DISPLAY / 2,
        trap.symbol, { fontSize: "14px", color: trap.color, fontFamily: "monospace" }
      ).setOrigin(0.5).setDepth(5).setAlpha(0); // hidden initially

      this.floorTraps.push({ x: tx, y: ty, trap, sprite, revealed: false });
    }

    // ── Kecleon Shop (20% chance, not on boss floors) ──
    const isBossFloor = this.dungeonDef.boss && this.currentFloor === this.dungeonDef.floors;
    if (!isBossFloor && shouldSpawnShop() && rooms.length > 2) {
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
        this.shopItems = generateShopItems(this.currentFloor);

        // Place shop items on the floor in the room
        for (let si = 0; si < this.shopItems.length; si++) {
          const sx = shopRm.x + 1 + (si % Math.max(1, shopRm.w - 2));
          const sy = shopRm.y + 1 + Math.floor(si / Math.max(1, shopRm.w - 2));
          if (sy >= shopRm.y + shopRm.h - 1) break;
          if (terrain[sy][sx] !== TerrainType.GROUND) continue;

          const shopItem = this.shopItems[si];
          const sprite = this.add.text(
            sx * TILE_DISPLAY + TILE_DISPLAY / 2,
            sy * TILE_DISPLAY + TILE_DISPLAY / 2,
            "💰", { fontSize: "14px", fontFamily: "monospace" }
          ).setOrigin(0.5).setDepth(7);
          this.shopTiles.push({ x: sx, y: sy, shopIdx: si, sprite });

          // Price tag
          this.add.text(
            sx * TILE_DISPLAY + TILE_DISPLAY / 2,
            sy * TILE_DISPLAY + TILE_DISPLAY + 2,
            `${shopItem.price}G`, { fontSize: "7px", color: "#fbbf24", fontFamily: "monospace" }
          ).setOrigin(0.5).setDepth(7);
        }

        // Kecleon shopkeeper sign
        const kcX = shopRm.x * TILE_DISPLAY + (shopRm.w * TILE_DISPLAY) / 2;
        const kcY = shopRm.y * TILE_DISPLAY + 4;
        this.add.text(kcX, kcY, "🦎 Kecleon Shop", {
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
      }
    }

    // ── Fog of War ──
    this.visited = Array.from({ length: height }, () => new Array(width).fill(false));
    this.revealArea(playerStart.x, playerStart.y, 4);

    // ── Camera ──
    const mapPixelW = width * TILE_DISPLAY;
    const mapPixelH = height * TILE_DISPLAY;
    this.cameras.main.setBounds(0, 0, mapPixelW, mapPixelH);
    this.cameras.main.startFollow(this.player.sprite!, true, 0.15, 0.15);

    // Input is handled by D-Pad and skill buttons below

    // ── HUD ──
    // Portrait sprite (small idle frame)
    this.portraitSprite = this.add.sprite(20, 20, `${this.starterId}-idle`)
      .setScrollFactor(0).setDepth(101).setScale(1.2);
    if (this.anims.exists(`${this.starterId}-idle-0`)) {
      this.portraitSprite.play(`${this.starterId}-idle-0`);
    }

    // HP Bar background
    this.hpBarBg = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.hpBarBg.fillStyle(0x1a1a2e, 0.9);
    this.hpBarBg.fillRoundedRect(38, 8, 100, 10, 3);
    this.hpBarBg.lineStyle(1, 0x333355);
    this.hpBarBg.strokeRoundedRect(38, 8, 100, 10, 3);

    // HP Bar fill
    this.hpBarFill = this.add.graphics().setScrollFactor(0).setDepth(101);

    this.floorText = this.add
      .text(8, 6, "", { fontSize: "11px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold" })
      .setScrollFactor(0).setDepth(100);
    this.hpText = this.add
      .text(40, 9, "", { fontSize: "8px", color: "#ffffff", fontFamily: "monospace" })
      .setScrollFactor(0).setDepth(102);
    this.turnText = this.add
      .text(8, 40, "", { fontSize: "10px", color: "#60a5fa", fontFamily: "monospace" })
      .setScrollFactor(0).setDepth(100);
    this.logText = this.add
      .text(8, GAME_HEIGHT - 200, "", {
        fontSize: "10px", color: "#fbbf24", fontFamily: "monospace",
        wordWrap: { width: 340 },
        backgroundColor: "#000000cc",
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0).setDepth(100);

    // ── Weather ──
    this.currentWeather = rollFloorWeather(this.dungeonDef.id, this.currentFloor);
    this.weatherText = this.add.text(GAME_WIDTH / 2, 24, "", {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);

    if (this.currentWeather !== WeatherType.None) {
      const wd = WEATHERS[this.currentWeather];
      this.weatherText.setText(`${wd.symbol} ${wd.name}: ${wd.description}`);
      this.weatherText.setColor(wd.color);
      this.showLog(`The weather is ${wd.name}!`);
    }

    // ── Minimap ──
    this.minimapBg = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.minimapGfx = this.add.graphics().setScrollFactor(0).setDepth(101);
    this.createMinimap();

    // Minimap toggle
    const mmToggle = this.add.text(this.MINIMAP_X - 2, this.MINIMAP_Y + height * this.MINIMAP_TILE + 4, "[Map]", {
      fontSize: "8px", color: "#666680", fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(101).setInteractive();
    mmToggle.on("pointerdown", () => {
      this.minimapVisible = !this.minimapVisible;
      this.minimapBg.setVisible(this.minimapVisible);
      this.minimapGfx.setVisible(this.minimapVisible);
    });

    // ── Skill Buttons ──
    // ── Virtual D-Pad (bottom-left) ──
    this.createDPad();

    // ── Skill Buttons (bottom-right, 2x2 grid) ──
    this.createSkillButtons();

    // ── Action buttons (center-bottom): Pickup + Wait only ──
    const menuCX = GAME_WIDTH / 2;
    const menuCY = GAME_HEIGHT - 55;
    const iconStyle = { fontSize: "18px", color: "#aab0c8", fontFamily: "monospace", backgroundColor: "#1a1a2ecc", padding: { x: 6, y: 4 } };

    this.add.text(menuCX - 22, menuCY - 5, "⬇", iconStyle)
      .setOrigin(0.5).setScrollFactor(0).setDepth(110).setInteractive()
      .on("pointerdown", () => this.pickupItem());

    this.add.text(menuCX + 22, menuCY - 5, "⏳", iconStyle)
      .setOrigin(0.5).setScrollFactor(0).setDepth(110).setInteractive()
      .on("pointerdown", () => {
        if (this.turnManager.isBusy || !this.player.alive || this.gameOver) return;
        this.turnManager.executeTurn(
          () => Promise.resolve(),
          [...this.getAllyActions(), ...this.getEnemyActions()]
        ).then(() => {
          this.recoverPP(this.player);
          this.tickBelly();
          this.tickWeather();
          tickStatusEffects(this.player);
          this.updateHUD();
        });
      });

    // ── Hamburger menu button (under minimap, top-right) ──
    const hamX = this.MINIMAP_X + 30;
    const hamY = this.MINIMAP_Y + 70;
    this.add.text(hamX, hamY, "☰", {
      fontSize: "20px", color: "#aab0c8", fontFamily: "monospace",
      backgroundColor: "#1a1a2ecc", padding: { x: 6, y: 2 },
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

    this.updateHUD();

    // Boss floor entrance message
    if (this.bossEntity) {
      this.showLog(`⚠ BOSS FLOOR! ${this.bossEntity.name} awaits!`);
    } else {
      this.showLog(`${this.dungeonDef.name} B${this.currentFloor}F`);
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

  // ── Virtual D-Pad (bottom-left) ──

  private createDPad() {
    const cx = 70;
    const cy = GAME_HEIGHT - 70;
    const r = 50;
    const btnR = 18;

    const bg = this.add.graphics().setScrollFactor(0).setDepth(108);
    bg.fillStyle(0x000000, 0.4);
    bg.fillCircle(cx, cy, r + 5);
    bg.lineStyle(2, 0x334155, 0.6);
    bg.strokeCircle(cx, cy, r + 5);

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
        if (this.turnManager.isBusy || !this.player.alive || this.gameOver || this.bagOpen) return;
        txt.setColor("#fbbf24");
        this.time.delayedCall(150, () => txt.setColor("#8899bb"));
        this.handlePlayerAction(d.dir);
      });
    }

    // Wait button (center of D-Pad) — skip turn
    const waitBtn = this.add.circle(cx, cy, 14, 0x334155, 0.8)
      .setScrollFactor(0).setDepth(109).setInteractive();
    const waitTxt = this.add.text(cx, cy, "⏳", {
      fontSize: "10px", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(110);

    waitBtn.on("pointerdown", () => {
      if (this.turnManager.isBusy || !this.player.alive || this.gameOver || this.bagOpen) return;
      waitTxt.setAlpha(0.5);
      this.time.delayedCall(150, () => waitTxt.setAlpha(1));
      this.turnManager.executeTurn(
        () => Promise.resolve(),
        [...this.getAllyActions(), ...this.getEnemyActions()]
      ).then(() => {
        this.recoverPP(this.player);
        this.tickBelly();
        this.tickWeather();
        tickStatusEffects(this.player);
        this.updateHUD();
      });
    });
  }

  // ── Skill Buttons (bottom-right, 2x2 grid) ──

  private createSkillButtons() {
    const baseX = GAME_WIDTH - 120;
    const baseY = GAME_HEIGHT - 95;
    const cellW = 58;
    const cellH = 38;
    const skills = this.player.skills;
    const positions = [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 },
    ];

    for (let i = 0; i < 4; i++) {
      const skill = skills[i];
      const pos = positions[i];
      const px = baseX + pos.col * cellW;
      const py = baseY + pos.row * cellH;
      const label = skill ? `${skill.name}\n${skill.currentPp}/${skill.pp}` : "---";
      const color = skill && skill.currentPp > 0 ? "#667eea" : "#444460";

      const btn = this.add.text(px, py, label, {
        fontSize: "9px", color, fontFamily: "monospace",
        fixedWidth: cellW - 4, align: "center",
        backgroundColor: "#1a1a2e",
        padding: { x: 2, y: 3 },
      }).setScrollFactor(0).setDepth(110).setInteractive();

      btn.on("pointerdown", () => {
        if (this.turnManager.isBusy || !this.player.alive || this.gameOver) return;
        if (!skill || skill.currentPp <= 0) {
          this.showLog("No PP left!");
          return;
        }
        this.showSkillPreview(i);
      });

      this.skillButtons.push(btn);
    }
  }

  // Skill preview state
  private skillPreviewUI: Phaser.GameObjects.GameObject[] = [];
  private skillPreviewActive = false;

  private showSkillPreview(skillIndex: number) {
    this.clearSkillPreview();
    const skill = this.player.skills[skillIndex];
    if (!skill) return;
    this.skillPreviewActive = true;

    const dir = this.player.facing;
    const tiles = getSkillTargetTiles(
      skill.range, this.player.tileX, this.player.tileY, dir,
      this.dungeon.terrain, this.dungeon.width, this.dungeon.height
    );

    // Highlight target tiles
    for (const t of tiles) {
      const px = t.x * TILE_DISPLAY + TILE_DISPLAY / 2;
      const py = t.y * TILE_DISPLAY + TILE_DISPLAY / 2;
      const highlight = this.add.rectangle(px, py, TILE_DISPLAY - 2, TILE_DISPLAY - 2, 0xfbbf24, 0.35)
        .setDepth(8);
      this.skillPreviewUI.push(highlight);
      this.tweens.add({
        targets: highlight, alpha: { from: 0.35, to: 0.15 },
        duration: 500, yoyo: true, repeat: -1,
      });
    }

    // Show info text
    const infoText = this.add.text(GAME_WIDTH / 2, 42, `${skill.name} (${skill.type}) Pow:${skill.power} PP:${skill.currentPp}/${skill.pp}`, {
      fontSize: "10px", color: "#fbbf24", fontFamily: "monospace", backgroundColor: "#000000cc",
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
    this.skillPreviewUI.push(infoText);

    // Replace skill buttons with Confirm/Cancel
    const baseX = GAME_WIDTH - 120;
    const baseY = GAME_HEIGHT - 95;

    // Hide existing skill buttons
    for (const btn of this.skillButtons) btn.setVisible(false);

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
    for (const btn of this.skillButtons) btn.setVisible(true);
  }

  private updateSkillButtons() {
    const skills = this.player.skills;
    for (let i = 0; i < this.skillButtons.length; i++) {
      const skill = skills[i];
      if (!skill) continue;
      const haspp = skill.currentPp > 0;
      const color = haspp ? "#667eea" : "#444460";
      this.skillButtons[i].setText(`${skill.name}\n${skill.currentPp}/${skill.pp}`);
      this.skillButtons[i].setColor(color);
      this.skillButtons[i].setBackgroundColor("#1a1a2e");
    }
  }
  /** Reveal tiles around a point (Chebyshev distance) */
  private revealArea(cx: number, cy: number, radius: number) {
    const { width, height } = this.dungeon;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          this.visited[ny][nx] = true;
        }
      }
    }
  }

  private createMinimap() {
    const { width, height, terrain } = this.dungeon;
    const t = this.MINIMAP_TILE;
    const mx = this.MINIMAP_X;
    const my = this.MINIMAP_Y;

    // Background
    this.minimapBg.clear();
    this.minimapBg.fillStyle(0x000000, 0.7);
    this.minimapBg.fillRoundedRect(mx - 2, my - 2, width * t + 4, height * t + 4, 2);

    // Terrain
    this.minimapGfx.clear();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (terrain[y][x] === TerrainType.GROUND) {
          this.minimapGfx.fillStyle(0x334455, 1);
          this.minimapGfx.fillRect(mx + x * t, my + y * t, t, t);
        }
      }
    }

    // Stairs
    const { stairsPos } = this.dungeon;
    this.minimapGfx.fillStyle(0xfbbf24, 1);
    this.minimapGfx.fillRect(mx + stairsPos.x * t, my + stairsPos.y * t, t, t);
  }

  private updateMinimap() {
    if (!this.minimapVisible) return;
    const t = this.MINIMAP_TILE;
    const mx = this.MINIMAP_X;
    const my = this.MINIMAP_Y;
    const { width, height, terrain } = this.dungeon;

    // Reveal area around player each update
    this.revealArea(this.player.tileX, this.player.tileY, 4);

    this.minimapGfx.clear();

    // Terrain (only visited tiles fully visible, unvisited = dark)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (terrain[y][x] === TerrainType.GROUND) {
          if (this.visited[y][x]) {
            this.minimapGfx.fillStyle(0x334455, 1);
          } else {
            this.minimapGfx.fillStyle(0x1a1a2e, 0.5);
          }
          this.minimapGfx.fillRect(mx + x * t, my + y * t, t, t);
        }
      }
    }

    // Stairs (only if visited)
    const { stairsPos } = this.dungeon;
    if (this.visited[stairsPos.y]?.[stairsPos.x]) {
      this.minimapGfx.fillStyle(0xfbbf24, 1);
      this.minimapGfx.fillRect(mx + stairsPos.x * t, my + stairsPos.y * t, t, t);
    }

    // Floor items (pink dots)
    this.minimapGfx.fillStyle(0xff6b9d, 1);
    for (const fi of this.floorItems) {
      this.minimapGfx.fillRect(mx + fi.x * t, my + fi.y * t, t, t);
    }

    // Revealed traps (purple dots)
    this.minimapGfx.fillStyle(0xa855f7, 1);
    for (const tr of this.floorTraps) {
      if (tr.revealed) {
        this.minimapGfx.fillRect(mx + tr.x * t, my + tr.y * t, t, t);
      }
    }

    // Enemies (red dots, boss = larger)
    for (const e of this.enemies) {
      if (e.alive) {
        if (e.isBoss) {
          this.minimapGfx.fillStyle(0xff2222, 1);
          this.minimapGfx.fillRect(mx + e.tileX * t - 1, my + e.tileY * t - 1, t + 2, t + 2);
        } else {
          this.minimapGfx.fillStyle(0xef4444, 1);
          this.minimapGfx.fillRect(mx + e.tileX * t, my + e.tileY * t, t, t);
        }
      }
    }

    // Allies (blue dots)
    this.minimapGfx.fillStyle(0x60a5fa, 1);
    for (const a of this.allies) {
      if (a.alive) {
        this.minimapGfx.fillRect(mx + a.tileX * t, my + a.tileY * t, t, t);
      }
    }

    // Player (green dot, slightly larger)
    this.minimapGfx.fillStyle(0x4ade80, 1);
    this.minimapGfx.fillRect(
      mx + this.player.tileX * t - 1,
      my + this.player.tileY * t - 1,
      t + 2, t + 2
    );
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

    const ngStr = this.ngPlusLevel > 0 ? ` NG+${this.ngPlusLevel}` : "";
    this.floorText.setText(`${this.dungeonDef.name}  B${this.currentFloor}F${ngStr}`);
    this.floorText.setPosition(40, 22);
    this.hpText.setText(`${p.hp}/${p.maxHp}`);

    // Show active buffs
    const buffs = this.player.statusEffects.map(s => `${s.type}(${s.turnsLeft})`).join(" ");
    const buffStr = buffs ? `  ${buffs}` : "";
    const bellyColor = this.belly > 30 ? "" : this.belly > 0 ? " ⚠" : " ☠";
    const abilityName = this.player.ability ? ABILITIES[this.player.ability]?.name ?? "" : "";
    const abilityStr = abilityName ? ` [${abilityName}]` : "";
    const goldStr = this.gold > 0 ? ` ${this.gold}G` : "";
    this.turnText.setText(`Lv.${p.level} Belly:${this.belly}${bellyColor}${goldStr} T${this.turnManager.turn}${abilityStr}${buffStr}`);

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

    this.updateSkillButtons();
    this.updateMinimap();
  }

  private openHamburgerMenu() {
    // Toggle bag/menu — reuse existing bag open/close
    if (this.bagOpen) {
      this.closeBag();
    } else {
      this.openBag();
    }
  }

  private showLog(msg: string) {
    this.logText.setText(msg);
    this.time.delayedCall(2500, () => {
      if (this.logText.text === msg) this.logText.setText("");
    });
  }

  // ── Items ──

  private pickupItem() {
    if (this.turnManager.isBusy || !this.player.alive || this.gameOver) return;

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

    sfxPickup();
    fi.sprite.destroy();
    this.floorItems.splice(idx, 1);
    this.showLog(`Picked up ${fi.item.name}!`);
  }

  private toggleBag() {
    if (this.bagOpen) {
      this.closeBag();
    } else {
      this.openBag();
    }
  }

  private openBag() {
    if (this.turnManager.isBusy || this.gameOver) return;
    sfxMenuOpen();
    this.bagOpen = true;

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

    if (this.inventory.length === 0) {
      const empty = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "Empty", {
        fontSize: "12px", color: "#666680", fontFamily: "monospace",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(151);
      this.bagUI.push(empty);
    } else {
      this.inventory.forEach((stack, i) => {
        const y = 60 + i * 32;
        const icon = stack.item.category === "berry" ? "●" : stack.item.category === "seed" ? "◆" : "★";
        const countStr = stack.count > 1 ? ` ×${stack.count}` : "";
        const btn = this.add.text(20, y, `${icon} ${stack.item.name}${countStr}`, {
          fontSize: "11px", color: "#e0e0e0", fontFamily: "monospace",
          backgroundColor: "#1a1a3e", padding: { x: 4, y: 4 },
          fixedWidth: 200,
        }).setScrollFactor(0).setDepth(151).setInteractive();

        const useBtn = this.add.text(230, y, "[Use]", {
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
    this.bagUI.forEach(obj => obj.destroy());
    this.bagUI = [];
  }

  private useItem(index: number) {
    const stack = this.inventory[index];
    if (!stack) return;

    const item = stack.item;
    sfxHeal();

    switch (item.id) {
      case "oranBerry": {
        const heal = Math.min(30, this.player.stats.maxHp - this.player.stats.hp);
        this.player.stats.hp += heal;
        this.showLog(`Used Oran Berry! Restored ${heal} HP.`);
        if (this.player.sprite) this.showHealPopup(this.player.sprite.x, this.player.sprite.y, heal);
        break;
      }
      case "sitrusBerry": {
        const heal = Math.floor(this.player.stats.maxHp * 0.5);
        const actual = Math.min(heal, this.player.stats.maxHp - this.player.stats.hp);
        this.player.stats.hp += actual;
        this.showLog(`Used Sitrus Berry! Restored ${actual} HP.`);
        if (this.player.sprite) this.showHealPopup(this.player.sprite.x, this.player.sprite.y, actual);
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
        const dx = DIR_DX[this.player.facing];
        const dy = DIR_DY[this.player.facing];
        const tx = this.player.tileX + dx;
        const ty = this.player.tileY + dy;
        const target = this.enemies.find(e => e.alive && e.tileX === tx && e.tileY === ty);
        if (target) {
          target.stats.hp = Math.max(0, target.stats.hp - 40);
          this.flashEntity(target, 2.0);
          this.showLog(`Blast Seed hit ${target.name}! 40 dmg!`);
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
        const escGold = goldFromRun(this.currentFloor, this.enemiesDefeated, false);
        this.cameras.main.fadeOut(500);
        this.time.delayedCall(600, () => {
          this.scene.start("HubScene", { gold: escGold, cleared: false, bestFloor: this.currentFloor });
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
        this.showLog("Used All-Power Orb! ATK & DEF boosted!");
        break;
      }
      case "apple": {
        const restore = Math.min(50, this.maxBelly - this.belly);
        this.belly += restore;
        this.showLog(`Ate an Apple! Belly +${restore}. (${this.belly}/${this.maxBelly})`);
        break;
      }
      case "bigApple": {
        this.belly = this.maxBelly;
        this.showLog(`Ate a Big Apple! Belly fully restored!`);
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
        const heal = Math.min(20, this.player.stats.maxHp - this.player.stats.hp);
        this.player.stats.hp += heal;
        this.showLog(`Used Heal Seed! Status cleared, restored ${heal} HP.`);
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
        this.showLog("Used All-Power Orb! ATK and DEF boosted for 10 turns!");
        break;
      }
      case "escapeOrb": {
        this.showLog("Used Escape Orb! Escaping the dungeon...");
        this.time.delayedCall(800, () => {
          this.scene.start("HubScene");
        });
        break;
      }
      default: {
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

  /** Check for revive seed on death */
  private tryRevive(): boolean {
    const idx = this.inventory.findIndex(s => s.item.id === "reviveSeed");
    if (idx === -1) return false;

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
      skills: serializeSkills(this.player.skills),
      inventory: serializeInventory(this.inventory),
      starter: this.starterId,
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
      skills: serializeSkills(this.player.skills),
      inventory: serializeInventory(this.inventory),
      starter: this.starterId,
    });
  }

  /** Apply persistent status effect tint to entity sprite */
  private updateStatusTint(entity: { sprite?: Phaser.GameObjects.Sprite; statusEffects: StatusEffect[] }) {
    if (!entity.sprite) return;
    const hasBurn = entity.statusEffects.some(s => s.type === SkillEffect.Burn);
    const hasPara = entity.statusEffects.some(s => s.type === SkillEffect.Paralyze);
    const hasAtkUp = entity.statusEffects.some(s => s.type === SkillEffect.AtkUp);
    const hasDefUp = entity.statusEffects.some(s => s.type === SkillEffect.DefUp);

    if (hasBurn) {
      entity.sprite.setTint(0xff8844); // Orange-red for burn
    } else if (hasPara) {
      entity.sprite.setTint(0xffff44); // Yellow for paralysis
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

  // ── Stairs ──

  // ── Traps ──

  private checkTraps() {
    const idx = this.floorTraps.findIndex(
      t => t.x === this.player.tileX && t.y === this.player.tileY
    );
    if (idx === -1) return;

    const ft = this.floorTraps[idx];
    sfxTrap();
    // Reveal the trap
    if (!ft.revealed) {
      ft.revealed = true;
      ft.sprite.setAlpha(1);
    }

    // Ability: Rock Head — immune to trap damage
    if (this.player.ability === AbilityId.RockHead) {
      this.showLog(`Stepped on a ${ft.trap.name}! Rock Head negated it!`);
      ft.sprite.destroy();
      this.floorTraps.splice(idx, 1);
      return;
    }

    // Ability: Levitate — immune to ground-based traps (Spike, Warp, Hunger)
    if (this.player.ability === AbilityId.Levitate &&
        (ft.trap.type === TrapType.Spike || ft.trap.type === TrapType.Warp || ft.trap.type === TrapType.Hunger)) {
      this.showLog(`Stepped on a ${ft.trap.name}! Levitate avoided it!`);
      ft.sprite.destroy();
      this.floorTraps.splice(idx, 1);
      return;
    }

    this.showLog(`Stepped on a ${ft.trap.name}! ${ft.trap.description}`);

    switch (ft.trap.type) {
      case TrapType.Spike: {
        const dmg = 15;
        this.player.stats.hp = Math.max(0, this.player.stats.hp - dmg);
        if (this.player.sprite) this.showDamagePopup(this.player.sprite.x, this.player.sprite.y, dmg, 1.0);
        this.cameras.main.shake(150, 0.005);
        this.checkPlayerDeath();
        break;
      }
      case TrapType.Poison:
        if (!this.player.statusEffects.some(s => s.type === SkillEffect.Burn)) {
          this.player.statusEffects.push({ type: SkillEffect.Burn, turnsLeft: 5 });
        }
        if (this.player.sprite) this.player.sprite.setTint(0xa855f7);
        this.time.delayedCall(300, () => { if (this.player.sprite) this.player.sprite.clearTint(); });
        break;
      case TrapType.Slow:
        if (!this.player.statusEffects.some(s => s.type === SkillEffect.Paralyze)) {
          this.player.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 3 });
        }
        if (this.player.sprite) this.player.sprite.setTint(0xfbbf24);
        this.time.delayedCall(300, () => { if (this.player.sprite) this.player.sprite.clearTint(); });
        break;
      case TrapType.Warp: {
        const { terrain, width, height, stairsPos } = this.dungeon;
        let wx: number, wy: number;
        let tries = 0;

        // Ability: RunAway — warp near stairs instead of random
        if (this.player.ability === AbilityId.RunAway) {
          // Find open tile near stairs
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
          // Normal: teleport to random ground tile
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
      case TrapType.Spin:
        // Confusion: treated as paralyze for simplicity
        if (!this.player.statusEffects.some(s => s.type === SkillEffect.Paralyze)) {
          this.player.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 3 });
        }
        this.cameras.main.shake(200, 0.01);
        break;
      case TrapType.Sticky:
        if (this.inventory.length > 0) {
          const lostIdx = Math.floor(Math.random() * this.inventory.length);
          const lost = this.inventory[lostIdx];
          this.showLog(`Lost ${lost.item.name}!`);
          lost.count--;
          if (lost.count <= 0) this.inventory.splice(lostIdx, 1);
        }
        break;
      case TrapType.Hunger:
        this.belly = Math.max(0, this.belly - 20);
        this.showLog(`Belly drained to ${this.belly}!`);
        break;
    }

    // Remove trap after triggering
    ft.sprite.destroy();
    this.floorTraps.splice(idx, 1);
    this.updateHUD();
  }

  // ── Belly (Hunger) ──

  private tickBelly() {
    if (this.belly > 0) {
      this.belly = Math.max(0, this.belly - 1);
      if (this.belly === 0) {
        this.showLog("You're starving! HP will drain each turn.");
      } else if (this.belly === 20) {
        this.showLog("Getting hungry...");
      }
    } else {
      // Starving: lose HP each turn
      this.player.stats.hp = Math.max(0, this.player.stats.hp - 2);
      if (this.player.sprite) this.showDamagePopup(this.player.sprite.x, this.player.sprite.y, 2, 0.5);
      this.checkPlayerDeath();
    }
  }

  // ── Weather Tick ──

  private tickWeather() {
    if (this.currentWeather === WeatherType.None || this.currentWeather === WeatherType.Rain) return;
    const WEATHER_DMG = 5;

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

  private checkPlayerDeath() {
    if (this.player.stats.hp <= 0 && this.player.alive) {
      if (this.tryRevive()) return;
      this.player.alive = false;
      this.showGameOver();
    }
  }

  // ── Stairs ──

  private checkStairs() {
    const { stairsPos } = this.dungeon;
    if (this.player.tileX === stairsPos.x && this.player.tileY === stairsPos.y) {
      // Block stairs if boss is alive
      if (this.bossEntity && this.bossEntity.alive) {
        this.showLog("The stairs are sealed! Defeat the boss first!");
        return;
      }
      this.advanceFloor();
    }
  }

  private checkShop() {
    if (!this.shopRoom || this.shopOpen) return;
    const r = this.shopRoom;
    const px = this.player.tileX;
    const py = this.player.tileY;
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) {
      if (this.shopItems.length > 0) {
        this.showLog(`Kecleon Shop! Gold: ${this.gold}G. Tap [Shop] to browse.`);
      }
    }
  }

  private checkMonsterHouse() {
    if (!this.monsterHouseRoom || this.monsterHouseTriggered) return;
    const r = this.monsterHouseRoom;
    const px = this.player.tileX;
    const py = this.player.tileY;
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) {
      this.monsterHouseTriggered = true;
      this.cameras.main.shake(300, 0.01);
      this.cameras.main.flash(200, 255, 0, 0);
      this.showLog("It's a Monster House!");

      // Spawn 4-6 extra enemies in this room
      const count = 4 + Math.floor(Math.random() * 3);
      const floorSpeciesIds = getDungeonFloorEnemies(this.dungeonDef, this.currentFloor);
      const floorSpecies = floorSpeciesIds.map(id => SPECIES[id]).filter(Boolean);
      if (floorSpecies.length === 0) return;

      for (let i = 0; i < count; i++) {
        const ex = r.x + 1 + Math.floor(Math.random() * Math.max(1, r.w - 2));
        const ey = r.y + 1 + Math.floor(Math.random() * Math.max(1, r.h - 2));
        if (this.dungeon.terrain[ey]?.[ex] !== TerrainType.GROUND) continue;
        if (this.allEntities.some(e => e.alive && e.tileX === ex && e.tileY === ey)) continue;

        const sp = floorSpecies[Math.floor(Math.random() * floorSpecies.length)];
        const enemyStats = getEnemyStats(this.currentFloor, this.dungeonDef.difficulty * 1.2, sp, this.ngPlusLevel);

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
        enemy.sprite = this.add.sprite(
          this.tileToPixelX(ex), this.tileToPixelY(ey), `${sp.spriteKey}-idle`
        );
        enemy.sprite.setScale(TILE_SCALE).setDepth(9);
        enemy.sprite.play(`${sp.spriteKey}-idle-${Direction.Down}`);
        this.enemies.push(enemy);
        this.allEntities.push(enemy);
      }
    }
  }

  private openShopUI() {
    if (this.shopOpen || this.shopItems.length === 0) return;
    sfxShop();
    this.shopOpen = true;

    // Dim overlay
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
      .setScrollFactor(0).setDepth(200).setInteractive();
    this.shopUI.push(overlay);

    // Title
    const title = this.add.text(GAME_WIDTH / 2, 40, `🦎 Kecleon Shop  Gold: ${this.gold}G`, {
      fontSize: "12px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.shopUI.push(title);

    // Item list
    const startY = 70;
    for (let i = 0; i < this.shopItems.length; i++) {
      const si = this.shopItems[i];
      const y = startY + i * 32;
      const canBuy = this.gold >= si.price;
      const label = `${si.item.name} — ${si.price}G`;
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

        buyBtn.on("pointerdown", () => this.buyShopItem(i));
      }

      // Description
      const desc = this.add.text(GAME_WIDTH / 2 - 80, y + 15, si.item.description, {
        fontSize: "8px", color: "#888888", fontFamily: "monospace",
      }).setScrollFactor(0).setDepth(201);
      this.shopUI.push(desc);
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
    if (!si || this.gold < si.price) return;

    // Deduct gold
    this.gold -= si.price;

    // Add to inventory
    if (this.inventory.length < MAX_INVENTORY) {
      const existing = this.inventory.find(s => s.item.id === si.item.id && si.item.stackable);
      if (existing) existing.count++;
      else this.inventory.push({ item: si.item, count: 1 });
      this.showLog(`Bought ${si.item.name} for ${si.price}G!`);
    } else {
      this.showLog("Bag is full! Can't buy.");
      this.gold += si.price; // refund
      return;
    }

    // Remove from shop
    this.shopItems.splice(index, 1);

    // Refresh UI
    this.closeShopUI();
    if (this.shopItems.length > 0) {
      this.openShopUI();
    }
    this.updateHUD();
  }

  private closeShopUI() {
    for (const obj of this.shopUI) obj.destroy();
    this.shopUI = [];
    this.shopOpen = false;
  }

  private advanceFloor() {
    if (this.currentFloor >= this.dungeonDef.floors) {
      this.showDungeonClear();
      return;
    }

    // Auto-save before advancing floor
    this.autoSave();

    this.gameOver = true;
    sfxStairs();
    this.showLog(`Went to B${this.currentFloor + 1}F!`);

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(600, () => {
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
      });
    });
  }

  private showDungeonClear() {
    this.gameOver = true;
    stopBgm();
    sfxVictory();
    clearDungeonSave();

    // Boss bonus: +50% gold if dungeon has a boss
    const baseGold = goldFromRun(this.currentFloor, this.enemiesDefeated, true);
    const ngGoldBonus = 1 + this.ngPlusLevel * 0.15; // +15% gold per NG+ level
    const gold = Math.floor((this.dungeonDef.boss ? baseGold * 1.5 : baseGold) * ngGoldBonus);

    this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.7
    ).setScrollFactor(0).setDepth(200);

    const titleText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, "DUNGEON CLEAR!", {
      fontSize: "20px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 15, `${this.dungeonDef.name} B${this.dungeonDef.floors}F cleared!`, {
      fontSize: "12px", color: "#e0e0e0", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, `Earned ${gold} Gold!`, {
      fontSize: "13px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    // Stats summary
    const clearStats = [
      `Lv.${this.player.stats.level}  Defeated: ${this.enemiesDefeated}  Turns: ${this.turnManager.turn}`,
      this.allies.length > 0 ? `Team: ${this.allies.filter(a => a.alive).map(a => a.name).join(", ")}` : "",
      this.ngPlusLevel > 0 ? `NG+${this.ngPlusLevel}` : "",
    ].filter(Boolean).join("\n");
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 38, clearStats, {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace", align: "center",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    const restartText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 75, "[Return to Town]", {
      fontSize: "14px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setInteractive();

    restartText.on("pointerdown", () => {
      this.scene.start("HubScene", { gold, cleared: true, bestFloor: this.dungeonDef.floors });
    });

    this.tweens.add({
      targets: titleText,
      alpha: { from: 1, to: 0.6 },
      duration: 800, yoyo: true, repeat: -1,
    });
  }

  private showGameOver() {
    this.gameOver = true;
    stopBgm();
    sfxGameOver();
    clearDungeonSave();

    const gold = goldFromRun(this.currentFloor, this.enemiesDefeated, false);

    this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.7
    ).setScrollFactor(0).setDepth(200);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "GAME OVER", {
      fontSize: "22px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 5, `Fainted on B${this.currentFloor}F`, {
      fontSize: "12px", color: "#e0e0e0", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 18, `Salvaged ${gold} Gold`, {
      fontSize: "11px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    // Stats summary
    const goStats = `Lv.${this.player.stats.level}  Defeated: ${this.enemiesDefeated}  Turns: ${this.turnManager.turn}`;
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 38, goStats, {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace", align: "center",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    const restartText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60, "[Return to Town]", {
      fontSize: "14px", color: "#60a5fa", fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setInteractive();

    restartText.on("pointerdown", () => {
      this.scene.start("HubScene", { gold, cleared: false, bestFloor: this.currentFloor });
    });
  }

  // ── Turn System ──

  private async handlePlayerAction(dir: Direction) {
    this.player.facing = dir;

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
          this.player.sprite!.play(`${this.player.spriteKey}-idle-${dir}`);
          return;
        }
        await this.turnManager.executeTurn(
          () => this.moveEntity(this.player, dir),
          [...this.getAllyActions(), ...this.getEnemyActions()]
        );
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
      this.checkStairs();
      this.checkShop();
      this.checkMonsterHouse();
    }

    // Belly drain per turn (movement or attack)
    this.tickBelly();
    this.tickWeather();

    // Tick status effects
    tickStatusEffects(this.player);
    this.updateHUD();

    if (!this.player.alive && !this.gameOver) {
      this.showGameOver();
    }
  }

  private async handleSkillUse(skillIndex: number, dir: Direction) {
    const skill = this.player.skills[skillIndex];
    if (!skill || skill.currentPp <= 0) return;

    this.player.facing = dir;
    skill.currentPp--;

    await this.turnManager.executeTurn(
      () => this.performSkill(this.player, skill, dir),
      this.getEnemyActions()
    );

    this.tickBelly();
    this.tickWeather();
    tickStatusEffects(this.player);
    this.updateHUD();

    if (!this.player.alive && !this.gameOver) {
      this.showGameOver();
    }
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

      const effectiveness = getEffectiveness(attacker.attackType, defender.types);
      const effText = effectivenessText(effectiveness);

      const atk = getEffectiveAtk(attacker);
      const def = getEffectiveDef(defender);
      const baseDmg = Math.max(1, atk - Math.floor(def / 2));
      // Ability: Torrent — +50% Water damage when HP < 33%
      let abilityMult = 1.0;
      if (attacker.ability === AbilityId.Torrent &&
          attacker.attackType === PokemonType.Water &&
          attacker.stats.hp < attacker.stats.maxHp / 3) {
        abilityMult = 1.5;
      }
      const wMult = weatherDamageMultiplier(this.currentWeather, attacker.attackType);
      const dmg = Math.max(1, Math.floor(baseDmg * effectiveness * abilityMult * wMult));
      defender.stats.hp = Math.max(0, defender.stats.hp - dmg);

      // Sound effects based on effectiveness
      if (effectiveness >= 2) sfxSuperEffective();
      else if (effectiveness <= 0.5 && effectiveness > 0) sfxNotEffective();
      else sfxHit();

      this.flashEntity(defender, effectiveness);
      if (defender.sprite) {
        this.showDamagePopup(defender.sprite.x, defender.sprite.y, dmg, effectiveness);
        if (defender !== this.player) this.showEnemyHpBar(defender);
      }

      let logMsg = `${attacker.name} attacks ${defender.name}! ${dmg} dmg!`;
      if (effText) logMsg += `\n${effText}`;
      if (abilityMult > 1) logMsg += " (Torrent!)";
      if (wMult !== 1.0) logMsg += ` (${WEATHERS[this.currentWeather].name}!)`;
      this.showLog(logMsg);

      // Ability: Static — 30% chance to paralyze attacker on contact
      if (defender.ability === AbilityId.Static && Math.random() < 0.3) {
        if (!attacker.statusEffects.some(s => s.type === SkillEffect.Paralyze)) {
          attacker.statusEffects.push({ type: SkillEffect.Paralyze, turnsLeft: 2 });
          this.showLog(`${defender.name}'s Static paralyzed ${attacker.name}!`);
        }
      }

      // Ability: Flame Body — 30% chance to burn attacker on contact
      if (defender.ability === AbilityId.FlameBody && Math.random() < 0.3) {
        if (!attacker.statusEffects.some(s => s.type === SkillEffect.Burn)) {
          attacker.statusEffects.push({ type: SkillEffect.Burn, turnsLeft: 3 });
          this.showLog(`${defender.name}'s Flame Body burned ${attacker.name}!`);
        }
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
          const effectiveness = getEffectiveness(skill.type, target.types);
          const effText = effectivenessText(effectiveness);
          const atk = getEffectiveAtk(user);
          const def = getEffectiveDef(target);
          const baseDmg = Math.max(1, Math.floor(skill.power * atk / 10) - Math.floor(def / 2));
          const wMult = weatherDamageMultiplier(this.currentWeather, skill.type);
          const dmg = Math.max(1, Math.floor(baseDmg * effectiveness * wMult));
          target.stats.hp = Math.max(0, target.stats.hp - dmg);

          this.flashEntity(target, effectiveness);
          if (target.sprite) {
            this.showDamagePopup(target.sprite.x, target.sprite.y, dmg, effectiveness);
            if (target !== this.player) this.showEnemyHpBar(target);
          }

          let logMsg = `${user.name}'s ${skill.name} hit ${target.name}! ${dmg} dmg!`;
          if (effText) logMsg += ` ${effText}`;
          if (wMult !== 1.0) logMsg += ` (${WEATHERS[this.currentWeather].name}!)`;
          this.showLog(logMsg);
          totalHits++;
        }

        // Apply effect
        this.applySkillEffect(user, target, skill);
        this.updateHUD();
        this.checkDeath(target);
      }

      if (totalHits === 0 && skill.power > 0) {
        this.showLog(`${user.name} used ${skill.name}!`);
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
    if (target.ability === AbilityId.ShieldDust && user !== target &&
        (skill.effect === SkillEffect.Paralyze || skill.effect === SkillEffect.Burn)) {
      this.showLog(`${target.name}'s Shield Dust blocked the effect!`);
      return;
    }

    switch (skill.effect) {
      case SkillEffect.AtkUp:
        target.statusEffects.push({ type: SkillEffect.AtkUp, turnsLeft: 5 });
        this.showLog(`${target.name}'s ATK rose!`);
        if (target.sprite) target.sprite.setTint(0xff8844);
        this.time.delayedCall(300, () => { if (target.sprite) target.sprite.clearTint(); });
        break;

      case SkillEffect.DefUp:
        target.statusEffects.push({ type: SkillEffect.DefUp, turnsLeft: 5 });
        this.showLog(`${target.name}'s DEF rose!`);
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
          this.showLog(`${target.name} was paralyzed!`);
          if (target.sprite) target.sprite.setTint(0xffff00);
          this.time.delayedCall(300, () => { if (target.sprite) target.sprite.clearTint(); });
        }
        break;

      case SkillEffect.Burn:
        if (!target.statusEffects.some(s => s.type === SkillEffect.Burn)) {
          target.statusEffects.push({ type: SkillEffect.Burn, turnsLeft: 3 });
          this.showLog(`${target.name} was burned!`);
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

  /** Floating damage number popup */
  private showDamagePopup(x: number, y: number, dmg: number, effectiveness: number) {
    const color = effectiveness >= 2.0 ? "#ff4444" : effectiveness < 1.0 ? "#8888ff" : "#ffffff";
    const size = effectiveness >= 2.0 ? "14px" : "11px";
    const popup = this.add.text(x, y - 10, `${dmg}`, {
      fontSize: size, color, fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);

    this.tweens.add({
      targets: popup,
      y: y - 40,
      alpha: { from: 1, to: 0 },
      duration: 800,
      ease: "Quad.easeOut",
      onComplete: () => popup.destroy(),
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

  /** Heal number popup (green) */
  private showHealPopup(x: number, y: number, amount: number) {
    const popup = this.add.text(x, y - 10, `+${amount}`, {
      fontSize: "11px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);

    this.tweens.add({
      targets: popup,
      y: y - 40,
      alpha: { from: 1, to: 0 },
      duration: 800,
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

    // Ability: Sturdy — survive one lethal hit per floor
    if (entity.ability === AbilityId.Sturdy && !entity.sturdyUsed) {
      entity.stats.hp = 1;
      entity.sturdyUsed = true;
      this.showLog(`${entity.name}'s Sturdy held on!`);
      if (entity.sprite) {
        entity.sprite.setTint(0xffff44);
        this.time.delayedCall(400, () => { if (entity.sprite) entity.sprite.clearTint(); });
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
      const isBossKill = entity.isBoss;
      // Grant EXP (boss gives 5x)
      const baseExp = expFromEnemy(entity.stats.level, this.currentFloor);
      const expGain = isBossKill ? baseExp * 5 : baseExp;
      this.totalExp += expGain;

      if (isBossKill) {
        // Boss defeat: big screen shake + special message
        sfxBossDefeat();
        this.cameras.main.shake(500, 0.015);
        this.showLog(`★ BOSS DEFEATED! ${entity.name} fell! +${expGain} EXP ★`);
        this.bossEntity = null;
        this.cameras.main.flash(300, 255, 255, 200);
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

      // ── Ability: Pickup — 10% chance to find item ──
      if (this.player.ability === AbilityId.Pickup && Math.random() < 0.1) {
        if (this.inventory.length < MAX_INVENTORY) {
          const found = rollFloorItem();
          const existing = this.inventory.find(s => s.item.id === found.id && found.stackable);
          if (existing) existing.count++;
          else this.inventory.push({ item: found, count: 1 });
          this.showLog(`Pickup found a ${found.name}!`);
        }
      }

      // ── Recruitment check (bosses can't be recruited) ──
      const recruitBonus = getUpgradeBonus(loadMeta(), "recruitRate") * 5;
      if (!isBossKill && entity.speciesId && this.allies.length < MAX_ALLIES && tryRecruit(this.player.stats.level, entity.stats.level, recruitBonus)) {
        this.time.delayedCall(800, () => {
          this.recruitEnemy(entity);
        });
      }
    }
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
    };

    ally.sprite = this.add.sprite(
      this.tileToPixelX(ally.tileX), this.tileToPixelY(ally.tileY),
      `${sp.spriteKey}-idle`
    ).setScale(TILE_SCALE).setDepth(10);
    ally.sprite.play(`${sp.spriteKey}-idle-${Direction.Down}`);

    // Recruitment animation — pink heart + flash
    ally.sprite.setTint(0xff88cc);
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

          // Tick enemy status effects
          tickStatusEffects(enemy);

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
          }
        };
      });
  }

  // ── Ally AI ──

  private getAllyActions(): (() => Promise<void>)[] {
    return this.allies
      .filter((a) => a.alive)
      .map((ally) => {
        return async () => {
          if (!ally.alive || !this.player.alive) return;
          if (isParalyzed(ally)) return;
          tickStatusEffects(ally);

          const { moveDir, attackTarget } = getAllyMoveDirection(
            ally, this.player, this.enemies,
            this.dungeon.terrain, this.dungeon.width, this.dungeon.height,
            this.allEntities
          );

          if (attackTarget) {
            const dir = directionTo(ally, attackTarget);
            ally.facing = dir;
            // Use skill sometimes
            const usableSkills = ally.skills.filter(s => s.currentPp > 0 && s.power > 0);
            if (usableSkills.length > 0 && Math.random() < 0.35) {
              const skill = usableSkills[Math.floor(Math.random() * usableSkills.length)];
              skill.currentPp--;
              await this.performSkill(ally, skill, dir);
            } else {
              await this.performBasicAttack(ally, attackTarget);
            }
            this.updateHUD();
          } else if (moveDir !== null && this.canEntityMove(ally, moveDir)) {
            await this.moveEntity(ally, moveDir);
            this.recoverPP(ally);
          }
        };
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
}
