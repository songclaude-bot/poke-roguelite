import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import {
  loadMeta, saveMeta, loadDungeon, clearDungeonSave,
  hasDungeonSave, deserializeSkills, deserializeInventory,
  MetaSaveData,
} from "../core/save-system";
import { getHeldItem } from "../core/held-items";
import { DUNGEONS, DungeonDef, getUnlockedDungeons, CHALLENGE_MODES } from "../core/dungeon-data";
import { initAudio, startBgm } from "../core/sound-manager";
import { getDailyConfig, hasDailyAttempt, loadDailyScores } from "../core/daily-dungeon";
import { getStorageItemCount, addToStorage } from "../core/crafting";
import { SPECIES_ABILITIES, ABILITIES } from "../core/ability";
import { getAbilityLevel } from "../core/ability-upgrade";
import { STARTER_LIST } from "../core/starter-data";
import { SPRITE_DEX } from "../core/sprite-map";
import { SPECIES } from "../core/pokemon-data";
import {
  getNGPlusLevel, canActivateNGPlus, activateNGPlus,
  getCurrentBonuses, getNextNGPlusRequirement,
} from "../core/new-game-plus";
import {
  calculatePassiveIncome, getIncomeRate, updateLastVisit,
} from "../core/passive-income";
import {
  generateDailyQuests, getChallengeQuests, hasClaimableQuests,
  getTodayDateString, updateQuestProgress, RunQuestData,
} from "../core/quests";
import { NPC_LIST, getNpcDialogue, NPC } from "../core/npc-dialogue";
import { getTotalTalentPoints } from "../core/talent-tree";
import { getForgeLevel, getForgeBonus, MAX_FORGE_LEVEL } from "../core/forge";
import {
  PartyPreset, MAX_PRESETS,
  createPreset, savePresets, loadPresets, deletePreset, applyPreset,
} from "../core/party-presets";

// ── Constants ──
const NAV_H = 52;
const CONTENT_TOP = 0;
const CONTENT_BOTTOM = GAME_HEIGHT - NAV_H;
const CONTENT_H = CONTENT_BOTTOM - CONTENT_TOP;
const BTN_W = GAME_WIDTH - 32;

type TabId = "home" | "dungeon" | "prep" | "info";

/**
 * HubScene — the town between dungeon runs.
 * Tabbed layout with bottom navigation bar.
 */
export class HubScene extends Phaser.Scene {
  private meta!: MetaSaveData;
  private activeTab: TabId = "home";
  private tabContent: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: "HubScene" });
  }

  init(data?: {
    gold?: number;
    cleared?: boolean;
    bestFloor?: number;
    enemiesDefeated?: number;
    turns?: number;
    dungeonId?: string;
    starter?: string;
    challengeMode?: string;
    pokemonSeen?: string[];
    inventory?: { itemId: string; count: number }[];
    questItemsCollected?: number;
    questItemsUsed?: boolean;
    questBestChainTier?: string;
    questBossDefeated?: boolean;
    questLegendaryDefeated?: boolean;
  }) {
    this.meta = loadMeta();

    if (data?.gold !== undefined) {
      this.meta.gold += data.gold;
      this.meta.totalGold += data.gold;
      this.meta.totalRuns++;
      if (data.cleared) this.meta.totalClears++;
      if (data.bestFloor && data.bestFloor > this.meta.bestFloor) {
        this.meta.bestFloor = data.bestFloor;
      }
      this.meta.totalEnemiesDefeated += data.enemiesDefeated ?? 0;
      this.meta.totalTurns += data.turns ?? 0;
      if (data.dungeonId === "endlessDungeon" && data.bestFloor) {
        if (data.bestFloor > this.meta.endlessBestFloor) {
          this.meta.endlessBestFloor = data.bestFloor;
        }
      }
      if (data.cleared && data.challengeMode) {
        this.meta.challengeClears++;
      }
      if (data.starter && !this.meta.startersUsed.includes(data.starter)) {
        this.meta.startersUsed.push(data.starter);
      }
      if (data.pokemonSeen && data.pokemonSeen.length > 0) {
        const seenSet = new Set(this.meta.pokemonSeen);
        for (const id of data.pokemonSeen) seenSet.add(id);
        this.meta.pokemonSeen = Array.from(seenSet);
      }
      if (data.starter && !this.meta.pokemonUsed.includes(data.starter)) {
        this.meta.pokemonUsed.push(data.starter);
      }
      if (data.inventory && data.inventory.length > 0) {
        for (const stack of data.inventory) {
          addToStorage(this.meta.storage, stack.itemId, stack.count);
        }
      }
      if (data.cleared && data.dungeonId) {
        if (!this.meta.clearedDungeons) this.meta.clearedDungeons = [];
        if (!this.meta.clearedDungeons.includes(data.dungeonId)) {
          this.meta.clearedDungeons.push(data.dungeonId);
        }
      }
      if (data.dungeonId) {
        this.meta.lastDungeonId = data.dungeonId;
        this.meta.lastChallenge = data.challengeMode ?? undefined;
      }

      if (data.dungeonId) {
        const today = getTodayDateString();
        if (this.meta.questLastDate !== today) {
          this.meta.activeQuests = generateDailyQuests(new Date(), this.meta);
          this.meta.questLastDate = today;
        }
        if (!this.meta.challengeQuests || this.meta.challengeQuests.length === 0) {
          this.meta.challengeQuests = getChallengeQuests(this.meta);
        }
        const runData: RunQuestData = {
          enemiesDefeated: data.enemiesDefeated ?? 0,
          cleared: data.cleared ?? false,
          dungeonId: data.dungeonId,
          itemsCollected: data.questItemsCollected ?? 0,
          floorReached: data.bestFloor ?? 0,
          bestChainTier: data.questBestChainTier ?? "",
          bossDefeated: data.questBossDefeated ?? false,
          legendaryDefeated: data.questLegendaryDefeated ?? false,
          noItemsUsed: data.questItemsUsed === false || data.questItemsUsed === undefined,
          turnsUsed: data.turns ?? 9999,
        };
        if (this.meta.activeQuests && this.meta.activeQuests.length > 0) {
          updateQuestProgress(this.meta.activeQuests, runData);
        }
        if (this.meta.challengeQuests && this.meta.challengeQuests.length > 0) {
          updateQuestProgress(this.meta.challengeQuests, runData);
        }
      }
      saveMeta(this.meta);
    }
  }

  create() {
    initAudio();
    startBgm("hub");

    // Refresh quests
    const today = getTodayDateString();
    if (this.meta.questLastDate !== today) {
      this.meta.activeQuests = generateDailyQuests(new Date(), this.meta);
      this.meta.questLastDate = today;
    }
    if (!this.meta.challengeQuests || this.meta.challengeQuests.length === 0) {
      this.meta.challengeQuests = getChallengeQuests(this.meta);
    }
    saveMeta(this.meta);

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0f1628);

    // Bottom navigation bar
    this.createNavBar();

    // Show default tab
    this.switchTab("home");

    // Passive Income popup
    const passiveResult = calculatePassiveIncome(this.meta);
    if (passiveResult.gold > 0) {
      this.showPassiveIncomePopup(passiveResult.gold, passiveResult.hours, getIncomeRate(this.meta));
    }
    updateLastVisit(this.meta);
  }

  // ═══════════════════════════════════════
  // ── Navigation Bar ──
  // ═══════════════════════════════════════

  private navBgs: Phaser.GameObjects.Rectangle[] = [];
  private navTexts: Phaser.GameObjects.Text[] = [];
  private navIcons: Phaser.GameObjects.Text[] = [];

  private createNavBar() {
    const navY = GAME_HEIGHT - NAV_H / 2;
    // Nav background
    this.add.rectangle(GAME_WIDTH / 2, navY, GAME_WIDTH, NAV_H, 0x111827).setDepth(100);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - NAV_H, GAME_WIDTH, 1, 0x334155, 0.5).setDepth(100);

    const tabs: { id: TabId; icon: string; label: string }[] = [
      { id: "home", icon: "\u2302", label: "Home" },
      { id: "dungeon", icon: "\u2694", label: "Dungeon" },
      { id: "prep", icon: "\u2692", label: "Prepare" },
      { id: "info", icon: "\u2139", label: "Info" },
    ];

    const tabW = GAME_WIDTH / tabs.length;
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      const tx = tabW * i + tabW / 2;

      const bg = this.add.rectangle(tx, navY, tabW - 4, NAV_H - 4, 0x111827, 0)
        .setDepth(101).setInteractive({ useHandCursor: true });
      this.navBgs.push(bg);

      const icon = this.add.text(tx, navY - 10, tab.icon, {
        fontSize: "18px", color: "#64748b", fontFamily: "monospace",
      }).setOrigin(0.5).setDepth(102);
      this.navIcons.push(icon);

      const label = this.add.text(tx, navY + 12, tab.label, {
        fontSize: "8px", color: "#64748b", fontFamily: "monospace",
      }).setOrigin(0.5).setDepth(102);
      this.navTexts.push(label);

      const tabId = tab.id;
      bg.on("pointerdown", () => this.switchTab(tabId));
    }
  }

  private switchTab(tabId: TabId) {
    // Destroy old tab content
    this.tabContent.forEach(o => o.destroy());
    this.tabContent = [];
    this.activeTab = tabId;

    // Update nav bar highlight
    const tabIds: TabId[] = ["home", "dungeon", "prep", "info"];
    for (let i = 0; i < tabIds.length; i++) {
      const active = tabIds[i] === tabId;
      this.navIcons[i].setColor(active ? "#60a5fa" : "#64748b");
      this.navTexts[i].setColor(active ? "#60a5fa" : "#64748b");
    }

    // Render new tab
    switch (tabId) {
      case "home": this.renderHomeTab(); break;
      case "dungeon": this.renderDungeonTab(); break;
      case "prep": this.renderPrepTab(); break;
      case "info": this.renderInfoTab(); break;
    }
  }

  // ═══════════════════════════════════════
  // ── Styled Button Helper ──
  // ═══════════════════════════════════════

  private addBtn(x: number, y: number, w: number, h: number,
    label: string, desc: string, bgColor: number, strokeColor: number,
    textColor: string, callback?: () => void, depth = 10): Phaser.GameObjects.Rectangle {
    const bg = this.add.rectangle(x, y, w, h, bgColor, 0.9)
      .setStrokeStyle(1, strokeColor).setDepth(depth);
    this.tabContent.push(bg);

    if (callback) {
      bg.setInteractive({ useHandCursor: true });
      const hoverColor = Phaser.Display.Color.ValueToColor(bgColor);
      const lighter = Phaser.Display.Color.GetColor(
        Math.min(255, hoverColor.red + 30),
        Math.min(255, hoverColor.green + 30),
        Math.min(255, hoverColor.blue + 30)
      );
      bg.on("pointerover", () => bg.setFillStyle(lighter, 1));
      bg.on("pointerout", () => bg.setFillStyle(bgColor, 0.9));
      bg.on("pointerdown", callback);
    }

    const titleT = this.add.text(x, desc ? y - 6 : y, label, {
      fontSize: "12px", color: textColor, fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(depth + 1);
    this.tabContent.push(titleT);

    if (desc) {
      const descT = this.add.text(x, y + 8, desc, {
        fontSize: "8px", color: "#8899aa", fontFamily: "monospace",
      }).setOrigin(0.5).setDepth(depth + 1);
      this.tabContent.push(descT);
    }
    return bg;
  }

  // ═══════════════════════════════════════
  // ── Home Tab ──
  // ═══════════════════════════════════════

  private renderHomeTab() {
    const currentStarter = this.meta.starter ?? "mudkip";
    const starterName = currentStarter.charAt(0).toUpperCase() + currentStarter.slice(1);
    const sp = SPECIES[currentStarter];

    // Title
    const title = this.add.text(GAME_WIDTH / 2, 18, "Pokemon Square", {
      fontSize: "18px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);
    this.tabContent.push(title);

    // Stars background
    for (let i = 0; i < 15; i++) {
      const sx = Math.random() * GAME_WIDTH;
      const sy = Math.random() * 100 + 30;
      const star = this.add.circle(sx, sy, Math.random() * 1.5 + 0.5, 0xffffff, Math.random() * 0.4 + 0.2);
      this.tabContent.push(star);
      this.tweens.add({
        targets: star,
        alpha: { from: star.alpha, to: star.alpha * 0.2 },
        duration: 1500 + Math.random() * 2000,
        yoyo: true, repeat: -1,
      });
    }

    // Gold display
    const goldBg = this.add.rectangle(GAME_WIDTH / 2, 48, 180, 28, 0x1a1a2e, 0.9)
      .setStrokeStyle(1, 0x334155);
    this.tabContent.push(goldBg);
    const goldT = this.add.text(GAME_WIDTH / 2, 48, `${this.meta.gold} G`, {
      fontSize: "14px", color: "#fde68a", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);
    this.tabContent.push(goldT);

    const incomeRate = getIncomeRate(this.meta);
    const incT = this.add.text(GAME_WIDTH / 2 + 95, 48, `+${incomeRate}/hr`, {
      fontSize: "8px", color: "#a08620", fontFamily: "monospace",
    }).setOrigin(0, 0.5);
    this.tabContent.push(incT);

    // Stats row
    const statsT = this.add.text(GAME_WIDTH / 2, 72, `Runs: ${this.meta.totalRuns}  |  Clears: ${this.meta.totalClears}  |  Best: B${this.meta.bestFloor}F`, {
      fontSize: "9px", color: "#64748b", fontFamily: "monospace",
    }).setOrigin(0.5);
    this.tabContent.push(statsT);

    // NG+ indicator
    const currentNGLevel = getNGPlusLevel(this.meta);
    if (currentNGLevel > 0 || canActivateNGPlus(this.meta)) {
      const ngLabel = canActivateNGPlus(this.meta) ? "NG+ Ready!" : `NG+${currentNGLevel}`;
      const ngColor = canActivateNGPlus(this.meta) ? "#fbbf24" : "#a855f7";
      const ngT = this.add.text(GAME_WIDTH / 2, 86, ngLabel, {
        fontSize: "9px", color: ngColor, fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      this.tabContent.push(ngT);
      ngT.on("pointerdown", () => this.showNGPlusPanel());
    }

    // ── Starter Card ──
    const cardY = 150;
    const cardH = 90;
    const cardBg = this.add.rectangle(GAME_WIDTH / 2, cardY, BTN_W, cardH, 0x151d30, 0.95)
      .setStrokeStyle(1, 0x334155);
    this.tabContent.push(cardBg);

    // Load and show starter sprite with idle animation
    const dexNum = SPRITE_DEX[currentStarter];
    if (dexNum && sp) {
      const textureKey = `${currentStarter}-idle`;
      const animKey = `${currentStarter}-hub-idle`;
      const addStarterSprite = () => {
        if (!this.textures.exists(textureKey) || this.activeTab !== "home") return;
        const spr = this.add.sprite(50, cardY, textureKey, 0).setScale(2.5);
        this.tabContent.push(spr);
        // Create and play idle animation
        if (!this.anims.exists(animKey)) {
          const frameCount = this.textures.get(textureKey).frameTotal - 1;
          if (frameCount > 1) {
            this.anims.create({
              key: animKey,
              frames: this.anims.generateFrameNumbers(textureKey, { start: 0, end: frameCount - 1 }),
              frameRate: 6,
              repeat: -1,
            });
          }
        }
        if (this.anims.exists(animKey)) spr.play(animKey);
      };

      if (this.textures.exists(textureKey)) {
        addStarterSprite();
      } else {
        this.load.spritesheet(textureKey, `sprites/${dexNum}/Idle-Anim.png`, {
          frameWidth: sp.idleFrameWidth, frameHeight: sp.idleFrameHeight,
        });
        this.load.once("complete", addStarterSprite);
        this.load.start();
      }
    }

    const nameT2 = this.add.text(110, cardY - 30, starterName, {
      fontSize: "16px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    });
    this.tabContent.push(nameT2);

    if (sp) {
      const typeStr = sp.types.join(" / ");
      const typeT = this.add.text(110, cardY - 12, typeStr, {
        fontSize: "10px", color: "#60a5fa", fontFamily: "monospace",
      });
      this.tabContent.push(typeT);

      const statStr = `HP ${sp.baseStats.hp}  ATK ${sp.baseStats.atk}  DEF ${sp.baseStats.def}`;
      const statT = this.add.text(110, cardY + 4, statStr, {
        fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
      });
      this.tabContent.push(statT);
    }

    // Change starter button
    const changeBtn = this.add.rectangle(200, cardY + 26, 80, 24, 0x1e3a5f, 0.9)
      .setStrokeStyle(1, 0x60a5fa).setInteractive({ useHandCursor: true });
    this.tabContent.push(changeBtn);
    const changeBtnT = this.add.text(200, cardY + 26, "Change", {
      fontSize: "10px", color: "#60a5fa", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);
    this.tabContent.push(changeBtnT);
    changeBtn.on("pointerover", () => changeBtn.setFillStyle(0x2a4a6f, 1));
    changeBtn.on("pointerout", () => changeBtn.setFillStyle(0x1e3a5f, 0.9));
    changeBtn.on("pointerdown", () => this.showStarterSelect());

    // Presets button
    const presetBtn = this.add.rectangle(290, cardY + 26, 80, 24, 0x2a1a3a, 0.9)
      .setStrokeStyle(1, 0xa855f7).setInteractive({ useHandCursor: true });
    this.tabContent.push(presetBtn);
    const presetBtnT = this.add.text(290, cardY + 26, "Presets", {
      fontSize: "10px", color: "#a855f7", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);
    this.tabContent.push(presetBtnT);
    presetBtn.on("pointerover", () => presetBtn.setFillStyle(0x3a2a4a, 1));
    presetBtn.on("pointerout", () => presetBtn.setFillStyle(0x2a1a3a, 0.9));
    presetBtn.on("pointerdown", () => this.showPresetsPanel());

    // ── NPC Row ──
    const npcY = cardY + cardH / 2 + 28;
    const npcLabel = this.add.text(16, npcY - 6, "Town NPCs", {
      fontSize: "9px", color: "#64748b", fontFamily: "monospace",
    });
    this.tabContent.push(npcLabel);

    const npcs = NPC_LIST;
    const npcRowY = npcY + 24;
    const npcSpacing = (GAME_WIDTH - 32) / npcs.length;
    const npcStartX = 16 + npcSpacing / 2;

    for (let i = 0; i < npcs.length; i++) {
      const npc = npcs[i];
      const cx = npcStartX + i * npcSpacing;

      // Try to load NPC sprite
      const npcDex = SPRITE_DEX[npc.species];
      const npcSp = SPECIES[npc.species];
      let npcSpriteLoaded = false;

      if (npcDex && npcSp) {
        const textureKey = `${npc.species}-idle`;
        const npcAnimKey = `${npc.species}-hub-idle`;
        const addNpcSprite = (ref: typeof npc) => {
          if (!this.textures.exists(textureKey) || this.activeTab !== "home") return;
          const spr = this.add.sprite(cx, npcRowY - 2, textureKey, 0).setScale(1.2).setInteractive({ useHandCursor: true });
          spr.on("pointerdown", () => this.showNpcDialogue(ref));
          this.tabContent.push(spr);
          // Play idle animation
          if (!this.anims.exists(npcAnimKey)) {
            const frameCount = this.textures.get(textureKey).frameTotal - 1;
            if (frameCount > 1) {
              this.anims.create({
                key: npcAnimKey,
                frames: this.anims.generateFrameNumbers(textureKey, { start: 0, end: frameCount - 1 }),
                frameRate: 6,
                repeat: -1,
              });
            }
          }
          if (this.anims.exists(npcAnimKey)) spr.play(npcAnimKey);
          return true;
        };

        if (this.textures.exists(textureKey)) {
          npcSpriteLoaded = !!addNpcSprite(npc);
        } else {
          this.load.spritesheet(textureKey, `sprites/${npcDex}/Idle-Anim.png`, {
            frameWidth: npcSp.idleFrameWidth, frameHeight: npcSp.idleFrameHeight,
          });
          const npcRef = npc;
          this.load.once("complete", () => addNpcSprite(npcRef));
          this.load.start();
        }
      }

      if (!npcSpriteLoaded) {
        // Fallback: colored circle
        const color = parseInt(npc.color.replace("#", ""), 16);
        const circle = this.add.circle(cx, npcRowY - 2, 14, color, 0.85)
          .setStrokeStyle(1, 0xffffff, 0.3).setInteractive({ useHandCursor: true });
        circle.on("pointerdown", () => this.showNpcDialogue(npc));
        this.tabContent.push(circle);

        const initial = this.add.text(cx, npcRowY - 3, npc.name.charAt(0), {
          fontSize: "12px", color: "#ffffff", fontFamily: "monospace", fontStyle: "bold",
        }).setOrigin(0.5);
        this.tabContent.push(initial);
      }

      const nameLabel = this.add.text(cx, npcRowY + 18, npc.name, {
        fontSize: "7px", color: "#64748b", fontFamily: "monospace",
      }).setOrigin(0.5);
      this.tabContent.push(nameLabel);
    }

    // ── Quick Actions ──
    // Collect action buttons to distribute them evenly
    const actionItems: { label: string; desc: string; bg: number; stroke: number; color: string; fn: () => void }[] = [];

    // Continue saved run
    const hasSave = hasDungeonSave();
    if (hasSave) {
      const save = loadDungeon();
      const saveName = save ? (DUNGEONS[save.dungeonId]?.name ?? save.dungeonId) : "Unknown";
      actionItems.push({
        label: `Continue: ${saveName} B${save?.floor ?? "?"}F`, desc: "Resume your saved run",
        bg: 0x1a3a2e, stroke: 0x4ade80, color: "#4ade80", fn: () => this.continueSave(),
      });
    }

    // Last dungeon quick access
    if (this.meta.lastDungeonId && !hasSave) {
      const lastDungeon = DUNGEONS[this.meta.lastDungeonId];
      if (lastDungeon) {
        actionItems.push({
          label: `Quick Re-enter: ${lastDungeon.name}`, desc: "Same dungeon, new run",
          bg: 0x3a2a1a, stroke: 0xf59e0b, color: "#f59e0b",
          fn: () => {
            if (this.meta.lastChallenge) {
              this.enterDungeonWithChallenge(this.meta.lastDungeonId!, this.meta.lastChallenge);
            } else {
              this.enterDungeon(this.meta.lastDungeonId!);
            }
          },
        });
      }
    }

    // Go to dungeon selection (always present)
    actionItems.push({
      label: "Enter Dungeon", desc: "Choose your next adventure",
      bg: 0x1e3a5f, stroke: 0x3b82f6, color: "#ffffff",
      fn: () => this.switchTab("dungeon"),
    });

    // Distribute action buttons evenly between NPC row bottom and settings area
    const actionsTopY = npcRowY + 50;
    const settingsAreaY = CONTENT_BOTTOM - 40;
    const actionBtnH = 48;
    const actionSpacing = actionItems.length > 1
      ? Math.min(60, (settingsAreaY - actionsTopY - actionBtnH) / (actionItems.length - 1))
      : 0;
    // Center the group vertically in the available space
    const totalActionH = actionBtnH + actionSpacing * (actionItems.length - 1);
    const actionStartY = actionsTopY + (settingsAreaY - actionsTopY - totalActionH) / 2;

    for (let ai = 0; ai < actionItems.length; ai++) {
      const a = actionItems[ai];
      const ay = actionStartY + ai * actionSpacing + actionBtnH / 2;
      this.addBtn(GAME_WIDTH / 2, ay, BTN_W, actionBtnH,
        a.label, a.desc, a.bg, a.stroke, a.color, a.fn);
    }

    // Settings row near bottom
    const settingsY = CONTENT_BOTTOM - 20;
    const settingsBtn = this.add.rectangle(GAME_WIDTH / 2 - 55, settingsY, 90, 24, 0x1a1a2e, 0.9)
      .setStrokeStyle(1, 0x334155).setInteractive({ useHandCursor: true });
    this.tabContent.push(settingsBtn);
    const settingsT = this.add.text(GAME_WIDTH / 2 - 55, settingsY, "Settings", {
      fontSize: "10px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5);
    this.tabContent.push(settingsT);
    settingsBtn.on("pointerdown", () => this.scene.start("SettingsScene"));

    const helpBtn = this.add.rectangle(GAME_WIDTH / 2 + 55, settingsY, 90, 24, 0x1a1a2e, 0.9)
      .setStrokeStyle(1, 0x334155).setInteractive({ useHandCursor: true });
    this.tabContent.push(helpBtn);
    const helpT = this.add.text(GAME_WIDTH / 2 + 55, settingsY, "Help", {
      fontSize: "10px", color: "#667eea", fontFamily: "monospace",
    }).setOrigin(0.5);
    this.tabContent.push(helpT);
    helpBtn.on("pointerdown", () => this.scene.start("HelpScene"));

    const verT = this.add.text(GAME_WIDTH / 2, settingsY + 16, "v5.4.0", {
      fontSize: "7px", color: "#334155", fontFamily: "monospace",
    }).setOrigin(0.5);
    this.tabContent.push(verT);
  }

  // ═══════════════════════════════════════
  // ── Dungeon Tab ──
  // ═══════════════════════════════════════

  private renderDungeonTab() {
    const clearedSet = new Set(this.meta.clearedDungeons ?? []);
    const allDungeonsList = Object.values(DUNGEONS);
    const totalDungeons = allDungeonsList.filter(d => d.id !== "endlessDungeon" && d.id !== "dailyDungeon" && d.id !== "bossRush").length;
    const totalCleared = allDungeonsList.filter(d => d.id !== "endlessDungeon" && d.id !== "dailyDungeon" && d.id !== "bossRush" && clearedSet.has(d.id)).length;

    // Title
    const title = this.add.text(GAME_WIDTH / 2, 16, "Dungeons", {
      fontSize: "16px", color: "#3b82f6", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);
    this.tabContent.push(title);

    // Progress
    const progressT = this.add.text(GAME_WIDTH / 2, 36, `${totalCleared} / ${totalDungeons} Cleared`, {
      fontSize: "9px", color: "#64748b", fontFamily: "monospace",
    }).setOrigin(0.5);
    this.tabContent.push(progressT);

    // Progress bar
    const barW = 240;
    const barBg = this.add.rectangle(GAME_WIDTH / 2, 50, barW, 5, 0x1e293b);
    this.tabContent.push(barBg);
    const fillRatio = totalDungeons > 0 ? totalCleared / totalDungeons : 0;
    if (fillRatio > 0) {
      const fillW = Math.max(2, barW * fillRatio);
      const barFill = this.add.rectangle(GAME_WIDTH / 2 - barW / 2 + fillW / 2, 50, fillW, 5, 0x4ade80);
      this.tabContent.push(barFill);
    }

    // ── Special dungeons at top ──
    let y = 68;

    // Daily
    if (this.meta.totalClears >= 5) {
      const dailyConfig = getDailyConfig();
      const attempted = hasDailyAttempt(dailyConfig.date);
      this.addBtn(GAME_WIDTH / 2, y, BTN_W, 34,
        attempted ? "Daily Done" : "Daily Dungeon",
        attempted ? "Come back tomorrow" : `${dailyConfig.floors}F  Diff ${dailyConfig.difficulty.toFixed(1)}`,
        attempted ? 0x1a1a2e : 0x0d3320, attempted ? 0x334155 : 0x10b981,
        attempted ? "#555566" : "#10b981",
        attempted ? undefined : () => this.enterDungeon("dailyDungeon"));
      y += 40;
    }

    // Endless
    if (this.meta.totalClears >= 10) {
      this.addBtn(GAME_WIDTH / 2, y, BTN_W, 34,
        "Endless Abyss", `Best: B${this.meta.endlessBestFloor}F`,
        0x3a1a1a, 0xef4444, "#ef4444",
        () => this.enterDungeon("endlessDungeon"));
      y += 40;
    }

    // Boss Rush
    if (this.meta.totalClears >= 30) {
      this.addBtn(GAME_WIDTH / 2, y, BTN_W, 34,
        "Boss Rush", "10 boss fights!",
        0x3a0a0a, 0xdc2626, "#dc2626",
        () => this.enterDungeon("bossRush"));
      y += 40;
    }

    // Challenge modes
    const challengeIcons: Record<string, string> = { speedrun: "\u26A1", noItems: "\u2715", solo: "\u2694" };
    for (const ch of CHALLENGE_MODES) {
      if (this.meta.totalClears >= ch.unlockClears) {
        this.addBtn(GAME_WIDTH / 2, y, BTN_W, 34,
          `${challengeIcons[ch.id] ?? ""} ${ch.name}`, ch.description,
          0x1a1a2e, parseInt(ch.color.replace("#", ""), 16), ch.color,
          () => this.enterChallengeMode(ch.id));
        y += 40;
      }
    }

    // ── Tier list (scrollable) ──
    const TIER_DEFS = [
      { id: "t1",  name: "Beginner",     label: "T1",  minDiff: 0,   maxDiff: 1.09,  color: 0x334455, textColor: "#7a8a9a" },
      { id: "t2",  name: "Novice",        label: "T2",  minDiff: 1.1, maxDiff: 1.69,  color: 0x2a4a3a, textColor: "#88b899" },
      { id: "t3",  name: "Intermediate",  label: "T3",  minDiff: 1.7, maxDiff: 2.09,  color: 0x3a4a2a, textColor: "#a8c888" },
      { id: "t4",  name: "Advanced",      label: "T4",  minDiff: 2.1, maxDiff: 3.09,  color: 0x4a4a2a, textColor: "#c8c888" },
      { id: "t5",  name: "Expert",        label: "T5",  minDiff: 3.1, maxDiff: 4.09,  color: 0x5a3a2a, textColor: "#d8a878" },
      { id: "t6",  name: "Master",        label: "T6",  minDiff: 4.1, maxDiff: 4.59,  color: 0x5a2a3a, textColor: "#d888a8" },
      { id: "t7",  name: "Champion",      label: "T7",  minDiff: 4.6, maxDiff: 5.09,  color: 0x4a2a5a, textColor: "#b888d8" },
      { id: "t8",  name: "Elite",         label: "T8",  minDiff: 5.1, maxDiff: 5.59,  color: 0x3a2a5a, textColor: "#9888d8" },
      { id: "t9",  name: "Legendary",     label: "T9",  minDiff: 5.6, maxDiff: 6.09,  color: 0x2a3a6a, textColor: "#88a8e8" },
      { id: "t10", name: "Mythical",      label: "T10", minDiff: 6.1, maxDiff: 6.59,  color: 0x2a4a6a, textColor: "#88c8e8" },
      { id: "t11", name: "Godlike",       label: "T11", minDiff: 6.6, maxDiff: 7.99,  color: 0x5a2a5a, textColor: "#e888e8" },
      { id: "t12", name: "FINAL",         label: "T12", minDiff: 8.0, maxDiff: 9.99,  color: 0x6a1a1a, textColor: "#f85858" },
      { id: "sp",  name: "Destiny Tower", label: "SP",  minDiff: -1,  maxDiff: -1,    color: 0x6a5a1a, textColor: "#ffd700" },
    ];

    const tierGroups: { tier: typeof TIER_DEFS[0]; dungeons: DungeonDef[] }[] = TIER_DEFS.map(t => ({ tier: t, dungeons: [] }));
    for (const dg of allDungeonsList) {
      if (dg.id === "endlessDungeon" || dg.id === "dailyDungeon" || dg.id === "bossRush") continue;
      if (dg.id === "destinyTower") { tierGroups[tierGroups.length - 1].dungeons.push(dg); continue; }
      for (const tg of tierGroups) {
        if (tg.tier.id === "sp") continue;
        if (dg.difficulty >= tg.tier.minDiff && dg.difficulty <= tg.tier.maxDiff) { tg.dungeons.push(dg); break; }
      }
    }
    const activeTiers = tierGroups.filter(tg => tg.dungeons.length > 0);

    const expandedState: Record<string, boolean> = {};
    let highestUnlockedTierId: string | null = null;
    for (const tg of activeTiers) {
      const hasUnlocked = tg.dungeons.some(d => d.unlockClears <= this.meta.totalClears);
      expandedState[tg.tier.id] = false;
      if (hasUnlocked) highestUnlockedTierId = tg.tier.id;
    }
    if (highestUnlockedTierId) expandedState[highestUnlockedTierId] = true;

    // Scrollable container
    const scrollTop = y + 6;
    const scrollBottom = CONTENT_BOTTOM - 4;
    const scrollH = scrollBottom - scrollTop;

    const container = this.add.container(0, 0).setDepth(10);
    this.tabContent.push(container);

    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillRect(0, scrollTop, GAME_WIDTH, scrollH);
    const geoMask = maskShape.createGeometryMask();
    container.setMask(geoMask);
    this.tabContent.push(maskShape as unknown as Phaser.GameObjects.GameObject);

    let scrollOffset = 0;
    let maxScroll = 0;
    let contentH = 0;
    let highestUnlockedTierY = 0;

    const indicator = this.add.rectangle(GAME_WIDTH - 4, scrollTop, 3, 20, 0x667eea, 0.5)
      .setOrigin(0.5, 0).setDepth(11).setVisible(false);
    this.tabContent.push(indicator);

    const renderList = () => {
      container.removeAll(true);
      let cy = scrollTop;

      for (const tg of activeTiers) {
        const { tier, dungeons } = tg;
        const isExpanded = expandedState[tier.id];
        const unlockedCount = dungeons.filter(d => d.unlockClears <= this.meta.totalClears).length;
        const allLocked = unlockedCount === 0;
        const arrow = isExpanded ? "\u25BC" : "\u25B6";
        const tierClearedCount = dungeons.filter(d => clearedSet.has(d.id)).length;
        const tierComplete = tierClearedCount >= dungeons.length && dungeons.length > 0;

        if (tier.id === highestUnlockedTierId) highestUnlockedTierY = cy - scrollTop;

        const hdrColor = tierComplete ? 0x3a3a1a : tier.color;
        const hdrBg = this.add.rectangle(GAME_WIDTH / 2, cy + 14, BTN_W, 28, hdrColor, 0.85)
          .setStrokeStyle(1, tierComplete ? 0xffd700 : (allLocked ? 0x222233 : 0x445566));
        container.add(hdrBg);

        const hdrText = this.add.text(20, cy + 6, `${arrow} ${tier.label}: ${tier.name} (${dungeons.length})`, {
          fontSize: "10px", color: allLocked ? "#444455" : tier.textColor,
          fontFamily: "monospace", fontStyle: "bold",
        });
        container.add(hdrText);

        const infoStr = tierComplete ? "COMPLETE" : `${tierClearedCount}/${dungeons.length}`;
        const infoT = this.add.text(GAME_WIDTH - 20, cy + 7, infoStr, {
          fontSize: "8px", color: tierComplete ? "#ffd700" : "#556677",
          fontFamily: "monospace", fontStyle: tierComplete ? "bold" : "normal",
        }).setOrigin(1, 0);
        container.add(infoT);

        hdrBg.setInteractive({ useHandCursor: true });
        const tierId = tier.id;
        hdrBg.on("pointerup", (ptr: Phaser.Input.Pointer) => {
          if (ptr.getDistance() > 10) return;
          expandedState[tierId] = !expandedState[tierId];
          const prevScroll = scrollOffset;
          renderList();
          scrollOffset = Math.max(-maxScroll, Math.min(0, prevScroll));
          container.y = scrollOffset;
          updateIndicator();
        });

        cy += 32;

        if (isExpanded) {
          for (const dg of dungeons) {
            const isUnlocked = dg.unlockClears <= this.meta.totalClears;
            const isCleared = clearedSet.has(dg.id);

            const bg = this.add.rectangle(GAME_WIDTH / 2, cy + 16, BTN_W - 12, 34, 0x131b2e, 0.95)
              .setStrokeStyle(1, isCleared ? 0x2a5a2a : (isUnlocked ? 0x1e293b : 0x151520));
            container.add(bg);

            if (isUnlocked) {
              const dgId = dg.id;
              bg.setInteractive({ useHandCursor: true });
              bg.on("pointerover", () => bg.setFillStyle(0x1e293b, 1));
              bg.on("pointerout", () => bg.setFillStyle(0x131b2e, 0.95));
              bg.on("pointerup", (ptr: Phaser.Input.Pointer) => {
                if (ptr.getDistance() > 10) return;
                this.enterDungeon(dgId);
              });
            }

            const nameColor = isUnlocked ? "#e0e0e0" : "#333344";
            const t1 = this.add.text(28, cy + 8, dg.name, {
              fontSize: "11px", color: nameColor, fontFamily: "monospace", fontStyle: "bold",
            });
            container.add(t1);

            if (isCleared) {
              const checkT = this.add.text(GAME_WIDTH - 28, cy + 9, "\u2713", {
                fontSize: "12px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
              }).setOrigin(1, 0);
              container.add(checkT);
            }

            const desc = isUnlocked ? dg.description : `Unlock: ${dg.unlockClears} clears`;
            const t2 = this.add.text(28, cy + 22, desc, {
              fontSize: "8px", color: "#556677", fontFamily: "monospace",
            });
            container.add(t2);
            cy += 38;
          }
        }
      }

      contentH = cy - scrollTop + 20;
      maxScroll = Math.max(0, contentH - scrollH);
      if (maxScroll > 0) {
        const indicatorH = Math.max(20, (scrollH / contentH) * scrollH);
        indicator.setVisible(true).setSize(3, indicatorH);
      } else {
        indicator.setVisible(false);
      }
    };

    const updateIndicator = () => {
      if (maxScroll <= 0) return;
      const ratio = -scrollOffset / maxScroll;
      indicator.y = scrollTop + ratio * (scrollH - indicator.height);
    };

    renderList();

    // Auto-scroll to highest unlocked
    if (highestUnlockedTierY > scrollH / 2 && maxScroll > 0) {
      scrollOffset = -Math.min(maxScroll, Math.max(0, highestUnlockedTierY - 10));
      container.y = scrollOffset;
      updateIndicator();
    }

    let dragStartY = 0;
    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (this.activeTab !== "dungeon") return;
      if (ptr.y >= scrollTop && ptr.y <= scrollBottom) dragStartY = ptr.y;
    });
    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      if (this.activeTab !== "dungeon") return;
      if (!ptr.isDown || ptr.y < scrollTop || ptr.y > scrollBottom) return;
      const dy = ptr.y - dragStartY;
      dragStartY = ptr.y;
      scrollOffset = Math.max(-maxScroll, Math.min(0, scrollOffset + dy));
      container.y = scrollOffset;
      updateIndicator();
    });
  }

  // ═══════════════════════════════════════
  // ── Prep Tab ──
  // ═══════════════════════════════════════

  private renderPrepTab() {
    const currentStarter = this.meta.starter ?? "mudkip";
    const equippedHeldItem = this.meta.equippedHeldItem ? getHeldItem(this.meta.equippedHeldItem) : undefined;
    const starterAbility = SPECIES_ABILITIES[currentStarter] ?? SPECIES_ABILITIES["mudkip"];
    const abilityDef = ABILITIES[starterAbility];
    const abilityLv = getAbilityLevel(this.meta.abilityLevels, starterAbility);
    const storedItemCount = getStorageItemCount(this.meta.storage);
    const talentPoints = getTotalTalentPoints(this.meta.talentLevels ?? {});

    const title = this.add.text(GAME_WIDTH / 2, 16, "Prepare", {
      fontSize: "16px", color: "#f59e0b", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);
    this.tabContent.push(title);

    const goldT = this.add.text(GAME_WIDTH / 2, 36, `Gold: ${this.meta.gold}`, {
      fontSize: "11px", color: "#fde68a", fontFamily: "monospace",
    }).setOrigin(0.5);
    this.tabContent.push(goldT);

    const forgeLv = getForgeLevel(this.meta);
    const forgeLabel = forgeLv > 0
      ? `Equip Forge +${forgeLv}${forgeLv >= MAX_FORGE_LEVEL ? " MAX" : ""}`
      : "Equip Forge";

    const items: { label: string; desc: string; color: string; bgColor: number; scene: string }[] = [
      { label: "Upgrade Shop", desc: "Buy permanent stat upgrades", color: "#fbbf24", bgColor: 0x2a2a1a, scene: "UpgradeScene" },
      { label: equippedHeldItem ? `Held: ${equippedHeldItem.name}` : "Held Items", desc: "Equip passive items", color: "#f59e0b", bgColor: 0x2a1a0a, scene: "HeldItemScene" },
      { label: forgeLabel, desc: "Upgrade held item stats with gold", color: "#e8a735", bgColor: 0x2a2008, scene: "ForgeScene" },
      { label: "Move Tutor", desc: "Customize your moveset", color: "#a855f7", bgColor: 0x1a0a2a, scene: "MoveTutorScene" },
      { label: abilityDef ? `${abilityDef.name} Lv${abilityLv}` : "Ability", desc: "Upgrade your innate ability", color: "#667eea", bgColor: 0x0a1a2a, scene: "AbilityUpgradeScene" },
      { label: `Item Forge (${storedItemCount} items)`, desc: "Craft & synthesize items", color: "#ff8c42", bgColor: 0x2a1a0a, scene: "CraftingScene" },
      { label: talentPoints > 0 ? `Talents (${talentPoints} pts)` : "Talent Tree", desc: "Invest gold in permanent talents", color: "#fbbf24", bgColor: 0x2a2a1a, scene: "TalentTreeScene" },
    ];

    const btnH = 42;
    const gap = 12;
    let iy = 60;
    for (const item of items) {
      const bgColor = item.bgColor;
      const strokeColor = parseInt(item.color.replace("#", ""), 16);
      this.addBtn(GAME_WIDTH / 2, iy, BTN_W, btnH,
        item.label, item.desc,
        bgColor, strokeColor, item.color,
        () => this.scene.start(item.scene));
      iy += btnH + gap;
    }
  }

  // ═══════════════════════════════════════
  // ── Info Tab ──
  // ═══════════════════════════════════════

  private renderInfoTab() {
    const seenCount = (this.meta.pokemonSeen ?? []).length;
    const allQuests = [...(this.meta.activeQuests ?? []), ...(this.meta.challengeQuests ?? [])];
    const claimableCount = allQuests.filter(q => q.completed && !q.claimed).length;

    const title = this.add.text(GAME_WIDTH / 2, 16, "Info", {
      fontSize: "16px", color: "#e879f9", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);
    this.tabContent.push(title);

    const items: { label: string; desc: string; color: string; bgColor: number; scene: string; badge?: number }[] = [
      { label: `Pokedex (${seenCount} seen)`, desc: "All Pokemon you've encountered", color: "#e879f9", bgColor: 0x1a0a2a, scene: "PokedexScene" },
      { label: "Records & Achievements", desc: "Stats, achievements, milestones", color: "#60a5fa", bgColor: 0x0a1a2a, scene: "AchievementScene" },
      { label: "Quest Board", desc: "Daily & challenge quests", color: "#10b981", bgColor: 0x0a2a1a, scene: "QuestBoardScene", badge: claimableCount },
      { label: "Hall of Fame", desc: "Best run scores & times", color: "#fbbf24", bgColor: 0x2a2a1a, scene: "LeaderboardScene" },
      { label: "Dungeon Journal", desc: "Exploration history & bestiary", color: "#f97316", bgColor: 0x2a1a0a, scene: "JournalScene" },
    ];

    const infoBtnH = 48;
    const infoGap = 12;
    let iy = 50;
    for (const item of items) {
      const bgColor = item.bgColor;
      const strokeColor = parseInt(item.color.replace("#", ""), 16);
      this.addBtn(GAME_WIDTH / 2, iy, BTN_W, infoBtnH,
        item.label, item.desc,
        bgColor, strokeColor, item.color,
        () => this.scene.start(item.scene));

      // Badge
      if (item.badge && item.badge > 0) {
        const badgeX = GAME_WIDTH / 2 + BTN_W / 2 - 16;
        const badgeY = iy - 16;
        const badge = this.add.circle(badgeX, badgeY, 8, 0xef4444).setDepth(12);
        this.tabContent.push(badge);
        const badgeT = this.add.text(badgeX, badgeY, String(item.badge), {
          fontSize: "9px", color: "#ffffff", fontFamily: "monospace", fontStyle: "bold",
        }).setOrigin(0.5).setDepth(13);
        this.tabContent.push(badgeT);
      }

      iy += infoBtnH + infoGap;
    }
  }

  // ═══════════════════════════════════════
  // ── Navigation Methods ──
  // ═══════════════════════════════════════

  private enterDungeon(dungeonId: string) {
    this.scene.start("DungeonPreviewScene", { dungeonId, meta: this.meta });
  }

  private enterChallengeMode(challengeId: string) {
    const unlocked = getUnlockedDungeons(this.meta.totalClears)
      .filter(d => d.id !== "endlessDungeon" && d.id !== "destinyTower" && d.id !== "dailyDungeon" && d.id !== "bossRush");
    if (unlocked.length === 0) return;
    const pick = unlocked[Math.floor(Math.random() * unlocked.length)];
    this.enterDungeonWithChallenge(pick.id, challengeId);
  }

  private enterDungeonWithChallenge(dungeonId: string, challengeMode: string) {
    this.scene.start("DungeonPreviewScene", { dungeonId, meta: this.meta, challengeMode });
  }

  private continueSave() {
    const save = loadDungeon();
    if (!save) { clearDungeonSave(); return; }
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(450, () => {
      this.scene.start("DungeonScene", {
        floor: save.floor,
        hp: save.hp, maxHp: save.maxHp,
        level: save.level, atk: save.atk, def: save.def,
        exp: save.totalExp,
        belly: save.belly,
        skills: deserializeSkills(save.skills),
        inventory: deserializeInventory(save.inventory),
        allies: save.allies ?? null,
        fromHub: true,
        dungeonId: save.dungeonId,
        starter: save.starter ?? this.meta.starter ?? "mudkip",
        challengeMode: save.challengeMode,
        modifiers: save.modifiers,
      });
    });
  }

  // ═══════════════════════════════════════
  // ── Popups & Overlays ──
  // ═══════════════════════════════════════

  private showPassiveIncomePopup(gold: number, hours: number, rate: number) {
    const uiItems: Phaser.GameObjects.GameObject[] = [];

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setDepth(300).setInteractive();
    uiItems.push(overlay);

    const panelW = 260;
    const panelH = 140;
    const panelX = GAME_WIDTH / 2;
    const panelY = GAME_HEIGHT / 2 - 40;
    const panel = this.add.rectangle(panelX, panelY, panelW, panelH, 0x151d30, 0.98)
      .setStrokeStyle(2, 0xfbbf24).setDepth(301);
    uiItems.push(panel);

    uiItems.push(this.add.text(panelX, panelY - 50, "Welcome back!", {
      fontSize: "14px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(302));

    uiItems.push(this.add.text(panelX, panelY - 28,
      `Away for ${hours} hour${hours !== 1 ? "s" : ""}`, {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(302));

    const goldDisplay = this.add.text(panelX, panelY, "0 Gold", {
      fontSize: "16px", color: "#fde68a", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(302);
    uiItems.push(goldDisplay);

    this.tweens.addCounter({
      from: 0, to: gold,
      duration: Math.max(300, Math.min(1500, gold * 20)),
      ease: "Cubic.easeOut",
      onUpdate: (tween) => goldDisplay.setText(`+${Math.floor(tween.getValue() ?? 0)} Gold`),
      onComplete: () => goldDisplay.setText(`+${gold} Gold`),
    });

    uiItems.push(this.add.text(panelX, panelY + 25, `Income rate: ${rate}G/hr`, {
      fontSize: "9px", color: "#c9a833", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(302));

    const collectBg = this.add.rectangle(panelX, panelY + 52, 120, 28, 0x1a3a2e, 0.9)
      .setStrokeStyle(1, 0x4ade80).setDepth(302).setInteractive({ useHandCursor: true });
    uiItems.push(collectBg);
    uiItems.push(this.add.text(panelX, panelY + 52, "Collect", {
      fontSize: "12px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(303));

    let collected = false;
    const collect = () => {
      if (collected) return;
      collected = true;
      this.meta.gold += gold;
      this.meta.totalGold += gold;
      saveMeta(this.meta);
      uiItems.forEach(o => o.destroy());
    };
    collectBg.on("pointerdown", collect);
    overlay.on("pointerdown", collect);
    this.time.delayedCall(5000, () => { if (!collected) collect(); });
  }

  private showNGPlusPanel() {
    const uiItems: Phaser.GameObjects.GameObject[] = [];
    const currentLevel = getNGPlusLevel(this.meta);
    const ngCanActivate = canActivateNGPlus(this.meta);

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85)
      .setDepth(200).setInteractive();
    uiItems.push(overlay);

    uiItems.push(this.add.text(GAME_WIDTH / 2, 30, "New Game Plus", {
      fontSize: "14px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(201));

    uiItems.push(this.add.text(GAME_WIDTH / 2, 52, currentLevel > 0 ? `Current: NG+${currentLevel}` : "Not yet activated", {
      fontSize: "11px", color: "#e0e0e0", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(201));

    let cy = 75;
    if (currentLevel > 0) {
      uiItems.push(this.add.text(GAME_WIDTH / 2, cy, "Active Bonuses:", {
        fontSize: "10px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setDepth(201));
      cy += 16;
      for (const b of getCurrentBonuses(currentLevel)) {
        uiItems.push(this.add.text(GAME_WIDTH / 2, cy, b.description, {
          fontSize: "8px", color: "#a5f3a3", fontFamily: "monospace",
        }).setOrigin(0.5).setDepth(201));
        cy += 13;
      }
      cy += 8;
    }

    const nextReq = getNextNGPlusRequirement(currentLevel);
    if (nextReq) {
      uiItems.push(this.add.text(GAME_WIDTH / 2, cy, `Next: NG+${currentLevel + 1} (${nextReq.clears} clears)`, {
        fontSize: "10px", color: "#fde68a", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setDepth(201));
      cy += 16;
      uiItems.push(this.add.text(GAME_WIDTH / 2, cy, `Progress: ${this.meta.totalClears}/${nextReq.clears}`, {
        fontSize: "9px", color: this.meta.totalClears >= nextReq.clears ? "#4ade80" : "#94a3b8",
        fontFamily: "monospace",
      }).setOrigin(0.5).setDepth(201));
      cy += 26;
    }

    const cleanup = () => { uiItems.forEach(o => o.destroy()); };

    if (ngCanActivate) {
      const actBg = this.add.rectangle(GAME_WIDTH / 2 - 60, cy, 100, 28, 0x2a2a1a, 0.9)
        .setStrokeStyle(1, 0xfbbf24).setDepth(201).setInteractive({ useHandCursor: true });
      uiItems.push(actBg);
      uiItems.push(this.add.text(GAME_WIDTH / 2 - 60, cy, "Activate", {
        fontSize: "11px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setDepth(202));
      actBg.on("pointerdown", () => { activateNGPlus(this.meta); cleanup(); this.scene.restart(); });

      const laterBg = this.add.rectangle(GAME_WIDTH / 2 + 60, cy, 80, 28, 0x1a1a2e, 0.9)
        .setStrokeStyle(1, 0x334155).setDepth(201).setInteractive({ useHandCursor: true });
      uiItems.push(laterBg);
      uiItems.push(this.add.text(GAME_WIDTH / 2 + 60, cy, "Later", {
        fontSize: "11px", color: "#60a5fa", fontFamily: "monospace",
      }).setOrigin(0.5).setDepth(202));
      laterBg.on("pointerdown", cleanup);
    } else {
      const closeBg = this.add.rectangle(GAME_WIDTH / 2, cy, 80, 28, 0x1a1a2e, 0.9)
        .setStrokeStyle(1, 0x334155).setDepth(201).setInteractive({ useHandCursor: true });
      uiItems.push(closeBg);
      uiItems.push(this.add.text(GAME_WIDTH / 2, cy, "Close", {
        fontSize: "11px", color: "#60a5fa", fontFamily: "monospace",
      }).setOrigin(0.5).setDepth(202));
      closeBg.on("pointerdown", cleanup);
    }
  }

  // ═══════════════════════════════════════
  // ── Party Presets Overlay ──
  // ═══════════════════════════════════════

  private showPresetsPanel() {
    const uiItems: Phaser.GameObjects.GameObject[] = [];
    let presets = loadPresets();

    // Dark overlay
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85)
      .setDepth(200).setInteractive();
    uiItems.push(overlay);

    // Title
    uiItems.push(this.add.text(GAME_WIDTH / 2, 20, "Party Presets", {
      fontSize: "14px", color: "#a855f7", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(201));

    // Close button
    const closeBtn = this.add.rectangle(GAME_WIDTH - 24, 20, 30, 24, 0x3a1a1a, 0.9)
      .setStrokeStyle(1, 0xef4444).setDepth(210).setInteractive({ useHandCursor: true });
    uiItems.push(closeBtn);
    uiItems.push(this.add.text(GAME_WIDTH - 24, 20, "\u2715", {
      fontSize: "14px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(211));

    const cleanup = () => { uiItems.forEach(o => o.destroy()); };
    closeBtn.on("pointerdown", cleanup);

    // Scrollable preset list container
    const listItems: Phaser.GameObjects.GameObject[] = [];

    const renderPresetList = () => {
      // Clear previous list items
      listItems.forEach(o => o.destroy());
      listItems.length = 0;

      const currentStarter = this.meta.starter ?? "mudkip";
      const equippedItem = this.meta.equippedHeldItem;

      let py = 50;

      // Current setup info
      const currentName = currentStarter.charAt(0).toUpperCase() + currentStarter.slice(1);
      const itemName = equippedItem ? (getHeldItem(equippedItem)?.name ?? "None") : "None";
      const infoT = this.add.text(GAME_WIDTH / 2, py, `Current: ${currentName} | Item: ${itemName}`, {
        fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
      }).setOrigin(0.5).setDepth(201);
      uiItems.push(infoT);
      listItems.push(infoT);
      py += 22;

      // "Save Current" button (if under max)
      if (presets.length < MAX_PRESETS) {
        const saveBg = this.add.rectangle(GAME_WIDTH / 2, py, BTN_W, 32, 0x1a3a2e, 0.9)
          .setStrokeStyle(1, 0x4ade80).setDepth(201).setInteractive({ useHandCursor: true });
        uiItems.push(saveBg);
        listItems.push(saveBg);
        const saveT = this.add.text(GAME_WIDTH / 2, py, "+ Save Current Setup", {
          fontSize: "11px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
        }).setOrigin(0.5).setDepth(202);
        uiItems.push(saveT);
        listItems.push(saveT);
        saveBg.on("pointerover", () => saveBg.setFillStyle(0x2a4a3e, 1));
        saveBg.on("pointerout", () => saveBg.setFillStyle(0x1a3a2e, 0.9));
        saveBg.on("pointerdown", () => this.showPresetNameInput((name: string) => {
          const preset = createPreset(name, currentStarter, {}, equippedItem);
          presets.push(preset);
          savePresets(presets);
          renderPresetList();
        }));
        py += 40;
      } else {
        const fullT = this.add.text(GAME_WIDTH / 2, py, `${MAX_PRESETS}/${MAX_PRESETS} presets (delete to add more)`, {
          fontSize: "9px", color: "#64748b", fontFamily: "monospace",
        }).setOrigin(0.5).setDepth(201);
        uiItems.push(fullT);
        listItems.push(fullT);
        py += 26;
      }

      // Separator
      const sep = this.add.rectangle(GAME_WIDTH / 2, py, BTN_W, 1, 0x334155, 0.5).setDepth(201);
      uiItems.push(sep);
      listItems.push(sep);
      py += 12;

      if (presets.length === 0) {
        const emptyT = this.add.text(GAME_WIDTH / 2, py + 20, "No saved presets.\nSave your current setup above!", {
          fontSize: "10px", color: "#555570", fontFamily: "monospace", align: "center",
        }).setOrigin(0.5).setDepth(201);
        uiItems.push(emptyT);
        listItems.push(emptyT);
        return;
      }

      // Render each preset
      for (const preset of presets) {
        const CARD_H = 60;
        const cardBg = this.add.rectangle(GAME_WIDTH / 2, py + CARD_H / 2, BTN_W, CARD_H, 0x151d30, 0.95)
          .setStrokeStyle(1, 0x334155).setDepth(201);
        uiItems.push(cardBg);
        listItems.push(cardBg);

        // Preset name
        const nameT = this.add.text(20, py + 8, preset.name, {
          fontSize: "12px", color: "#e0e0e0", fontFamily: "monospace", fontStyle: "bold",
        }).setDepth(202);
        uiItems.push(nameT);
        listItems.push(nameT);

        // Preset details
        const starterDisplayName = preset.starterId.charAt(0).toUpperCase() + preset.starterId.slice(1);
        const heldItemName = preset.equippedHeldItem ? (getHeldItem(preset.equippedHeldItem)?.name ?? "None") : "None";
        const detailT = this.add.text(20, py + 24, `Starter: ${starterDisplayName} | Item: ${heldItemName}`, {
          fontSize: "8px", color: "#94a3b8", fontFamily: "monospace",
        }).setDepth(202);
        uiItems.push(detailT);
        listItems.push(detailT);

        // Is this the current active config?
        const isActive = preset.starterId === currentStarter &&
          (preset.equippedHeldItem ?? undefined) === (equippedItem ?? undefined);

        // Load button
        if (!isActive) {
          const loadBg = this.add.rectangle(GAME_WIDTH / 2 - 40, py + 46, 80, 22, 0x1e3a5f, 0.9)
            .setStrokeStyle(1, 0x60a5fa).setDepth(202).setInteractive({ useHandCursor: true });
          uiItems.push(loadBg);
          listItems.push(loadBg);
          const loadT = this.add.text(GAME_WIDTH / 2 - 40, py + 46, "Load", {
            fontSize: "10px", color: "#60a5fa", fontFamily: "monospace", fontStyle: "bold",
          }).setOrigin(0.5).setDepth(203);
          uiItems.push(loadT);
          listItems.push(loadT);
          loadBg.on("pointerover", () => loadBg.setFillStyle(0x2a4a6f, 1));
          loadBg.on("pointerout", () => loadBg.setFillStyle(0x1e3a5f, 0.9));
          loadBg.on("pointerdown", () => {
            applyPreset(preset, this.meta);
            saveMeta(this.meta);
            renderPresetList();
            // Refresh home tab behind overlay
          });
        } else {
          const activeT = this.add.text(GAME_WIDTH / 2 - 40, py + 46, "Active", {
            fontSize: "10px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
          }).setOrigin(0.5).setDepth(203);
          uiItems.push(activeT);
          listItems.push(activeT);
        }

        // Delete button
        const delBg = this.add.rectangle(GAME_WIDTH / 2 + 40, py + 46, 80, 22, 0x3a1a1a, 0.9)
          .setStrokeStyle(1, 0xef4444).setDepth(202).setInteractive({ useHandCursor: true });
        uiItems.push(delBg);
        listItems.push(delBg);
        const delT = this.add.text(GAME_WIDTH / 2 + 40, py + 46, "Delete", {
          fontSize: "10px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
        }).setOrigin(0.5).setDepth(203);
        uiItems.push(delT);
        listItems.push(delT);
        const presetId = preset.id;
        delBg.on("pointerover", () => delBg.setFillStyle(0x4a2a2a, 1));
        delBg.on("pointerout", () => delBg.setFillStyle(0x3a1a1a, 0.9));
        delBg.on("pointerdown", () => {
          presets = deletePreset(presets, presetId);
          renderPresetList();
        });

        py += CARD_H + 8;
      }
    };

    renderPresetList();
  }

  private showPresetNameInput(onConfirm: (name: string) => void) {
    const uiItems: Phaser.GameObjects.GameObject[] = [];

    // Sub-overlay
    const subOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setDepth(300).setInteractive();
    uiItems.push(subOverlay);

    const panelW = 260;
    const panelH = 130;
    const panelX = GAME_WIDTH / 2;
    const panelY = GAME_HEIGHT / 2 - 40;
    const panel = this.add.rectangle(panelX, panelY, panelW, panelH, 0x151d30, 0.98)
      .setStrokeStyle(2, 0xa855f7).setDepth(301);
    uiItems.push(panel);

    uiItems.push(this.add.text(panelX, panelY - 45, "Name Your Preset", {
      fontSize: "12px", color: "#a855f7", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(302));

    // Preset name suggestions
    const currentStarter = this.meta.starter ?? "mudkip";
    const starterCap = currentStarter.charAt(0).toUpperCase() + currentStarter.slice(1);
    const suggestions = [
      `${starterCap} Team`,
      `Setup ${loadPresets().length + 1}`,
      `${starterCap} Build`,
    ];

    let selectedName = suggestions[0];

    // Display area for name
    const nameBg = this.add.rectangle(panelX, panelY - 16, 220, 26, 0x0a0a1e, 0.95)
      .setStrokeStyle(1, 0x667eea).setDepth(302);
    uiItems.push(nameBg);
    const nameDisplay = this.add.text(panelX, panelY - 16, selectedName, {
      fontSize: "12px", color: "#e0e0e0", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(303);
    uiItems.push(nameDisplay);

    // Suggestion buttons
    let sx = panelX - 100;
    for (const suggestion of suggestions) {
      const sw = 75;
      const sBg = this.add.rectangle(sx + sw / 2, panelY + 14, sw, 20, 0x1a1a2e, 0.9)
        .setStrokeStyle(1, 0x334155).setDepth(302).setInteractive({ useHandCursor: true });
      uiItems.push(sBg);
      const sT = this.add.text(sx + sw / 2, panelY + 14, suggestion.length > 10 ? suggestion.slice(0, 9) + ".." : suggestion, {
        fontSize: "8px", color: "#94a3b8", fontFamily: "monospace",
      }).setOrigin(0.5).setDepth(303);
      uiItems.push(sT);
      const sName = suggestion;
      sBg.on("pointerdown", () => {
        selectedName = sName;
        nameDisplay.setText(sName);
      });
      sx += sw + 6;
    }

    const cleanup = () => { uiItems.forEach(o => o.destroy()); };

    // Confirm button
    const confirmBg = this.add.rectangle(panelX - 50, panelY + 42, 90, 26, 0x1a3a2e, 0.9)
      .setStrokeStyle(1, 0x4ade80).setDepth(302).setInteractive({ useHandCursor: true });
    uiItems.push(confirmBg);
    uiItems.push(this.add.text(panelX - 50, panelY + 42, "Save", {
      fontSize: "11px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(303));
    confirmBg.on("pointerdown", () => {
      cleanup();
      onConfirm(selectedName);
    });

    // Cancel button
    const cancelBg = this.add.rectangle(panelX + 50, panelY + 42, 90, 26, 0x1a1a2e, 0.9)
      .setStrokeStyle(1, 0x334155).setDepth(302).setInteractive({ useHandCursor: true });
    uiItems.push(cancelBg);
    uiItems.push(this.add.text(panelX + 50, panelY + 42, "Cancel", {
      fontSize: "11px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(303));
    cancelBg.on("pointerdown", cleanup);
  }

  // ═══════════════════════════════════════
  // ── Starter Selection ──
  // ═══════════════════════════════════════

  private showStarterSelect() {
    const uiItems: Phaser.GameObjects.GameObject[] = [];
    let starterSelectActive = true;

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.92)
      .setDepth(200).setInteractive();
    uiItems.push(overlay);

    uiItems.push(this.add.text(GAME_WIDTH / 2, 16, "Choose Starter", {
      fontSize: "14px", color: "#f472b6", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(201));

    const closeBtn = this.add.rectangle(GAME_WIDTH - 24, 16, 30, 24, 0x3a1a1a, 0.9)
      .setStrokeStyle(1, 0xef4444).setDepth(210).setInteractive({ useHandCursor: true });
    uiItems.push(closeBtn);
    uiItems.push(this.add.text(GAME_WIDTH - 24, 16, "\u2715", {
      fontSize: "14px", color: "#ef4444", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(211));

    const starters = this.getStarterList();

    // Preview panel
    const PREVIEW_H = 80;
    const PREVIEW_TOP = 30;
    const previewBg = this.add.rectangle(GAME_WIDTH / 2, PREVIEW_TOP + PREVIEW_H / 2, GAME_WIDTH - 16, PREVIEW_H, 0x111827, 0.95)
      .setStrokeStyle(1, 0x334155).setDepth(201);
    uiItems.push(previewBg);

    const previewName = this.add.text(GAME_WIDTH / 2 + 10, PREVIEW_TOP + 12, "", {
      fontSize: "14px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(202);
    uiItems.push(previewName);

    const previewInfo = this.add.text(GAME_WIDTH / 2 + 10, PREVIEW_TOP + 32, "", {
      fontSize: "9px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(202);
    uiItems.push(previewInfo);

    const confirmBtn = this.add.rectangle(GAME_WIDTH / 2 + 10, PREVIEW_TOP + 58, 80, 24, 0x1a3a2e, 0.9)
      .setStrokeStyle(1, 0x4ade80).setDepth(202).setVisible(false).setInteractive({ useHandCursor: true });
    uiItems.push(confirmBtn);
    const confirmT = this.add.text(GAME_WIDTH / 2 + 10, PREVIEW_TOP + 58, "Select", {
      fontSize: "11px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(203).setVisible(false);
    uiItems.push(confirmT);

    let previewSprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Text | null = null;
    const SPRITE_X = 40;
    const SPRITE_Y = PREVIEW_TOP + PREVIEW_H / 2;
    let pendingStarter: string | null = null;

    const showPreview = (starterId: string) => {
      const s = starters.find(st => st.id === starterId);
      if (!s) return;
      const sp = SPECIES[starterId];
      const isCurrent = starterId === (this.meta.starter ?? "mudkip");

      previewName.setText(s.name);
      const typeStr = sp ? sp.types.join("/") : "";
      const statStr = sp ? `HP:${sp.baseStats.hp} ATK:${sp.baseStats.atk} DEF:${sp.baseStats.def}` : "";
      previewInfo.setText(`${typeStr}  ${statStr}`);

      if (isCurrent) {
        confirmBtn.setVisible(false);
        confirmT.setVisible(false);
        pendingStarter = null;
      } else {
        confirmBtn.setVisible(true);
        confirmT.setVisible(true);
        pendingStarter = starterId;
      }

      if (previewSprite) { previewSprite.destroy(); previewSprite = null; }
      const textureKey = `${starterId}-idle`;
      if (this.textures.exists(textureKey)) {
        previewSprite = this.add.sprite(SPRITE_X, SPRITE_Y, textureKey, 0).setScale(2).setDepth(203);
        uiItems.push(previewSprite);
      } else {
        const dexNum = SPRITE_DEX[starterId];
        if (dexNum && sp) {
          this.load.spritesheet(textureKey, `sprites/${dexNum}/Idle-Anim.png`, {
            frameWidth: sp.idleFrameWidth, frameHeight: sp.idleFrameHeight,
          });
          this.load.once("complete", () => {
            if (!starterSelectActive) return;
            if (previewSprite) previewSprite.destroy();
            if (this.textures.exists(textureKey)) {
              previewSprite = this.add.sprite(SPRITE_X, SPRITE_Y, textureKey, 0).setScale(2).setDepth(203);
              uiItems.push(previewSprite);
            }
          });
          this.load.start();
        }
        previewSprite = this.add.text(SPRITE_X, SPRITE_Y, "?", {
          fontSize: "28px", color: "#555570", fontFamily: "monospace",
        }).setOrigin(0.5).setDepth(203);
        uiItems.push(previewSprite);
      }
    };

    showPreview(this.meta.starter ?? "mudkip");

    confirmBtn.on("pointerdown", () => {
      if (!pendingStarter) return;
      this.meta.starter = pendingStarter;
      saveMeta(this.meta);
      confirmBtn.setVisible(false);
      confirmT.setVisible(false);
      pendingStarter = null;
      renderVisible();
      showPreview(this.meta.starter!);
    });

    // Grid
    const COLS = 4;
    const CELL_W = 82;
    const CELL_H = 30;
    const GAP_X = 4;
    const GAP_Y = 3;
    const ROW_H = CELL_H + GAP_Y;
    const GRID_LEFT = (GAME_WIDTH - COLS * (CELL_W + GAP_X) + GAP_X) / 2;
    const VISIBLE_TOP = PREVIEW_TOP + PREVIEW_H + 6;
    const VISIBLE_BOTTOM = GAME_HEIGHT - 10;
    const VISIBLE_H = VISIBLE_BOTTOM - VISIBLE_TOP;
    const TOTAL_ROWS = Math.ceil(starters.length / COLS);
    const TOTAL_H = TOTAL_ROWS * ROW_H;
    const MAX_SCROLL = Math.max(0, TOTAL_H - VISIBLE_H);
    const POOL_ROWS = Math.ceil(VISIBLE_H / ROW_H) + 2;

    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillRect(0, VISIBLE_TOP, GAME_WIDTH, VISIBLE_H);
    uiItems.push(maskShape as unknown as Phaser.GameObjects.GameObject);
    const mask = maskShape.createGeometryMask();

    type PoolCell = { bg: Phaser.GameObjects.Rectangle; nameT: Phaser.GameObjects.Text };
    const pool: PoolCell[][] = [];
    const poolContainer = this.add.container(0, 0).setDepth(202).setMask(mask);
    uiItems.push(poolContainer);

    for (let pr = 0; pr < POOL_ROWS; pr++) {
      const row: PoolCell[] = [];
      for (let c = 0; c < COLS; c++) {
        const bg = this.add.rectangle(0, 0, CELL_W, CELL_H, 0x131b2e, 0.95)
          .setStrokeStyle(1, 0x1e293b).setInteractive({ useHandCursor: true });
        const nameT = this.add.text(0, 0, "", {
          fontSize: "9px", color: "#d0d0e0", fontFamily: "monospace",
        }).setOrigin(0.5);
        poolContainer.add([bg, nameT]);
        row.push({ bg, nameT });
      }
      pool.push(row);
    }

    const bindPoolRow = (poolRow: number, dataRow: number, yPos: number) => {
      const cells = pool[poolRow];
      for (let c = 0; c < COLS; c++) {
        const cell = cells[c];
        const dataIdx = dataRow * COLS + c;
        const cx = GRID_LEFT + c * (CELL_W + GAP_X) + CELL_W / 2;
        cell.bg.setPosition(cx, yPos);
        cell.nameT.setPosition(cx, yPos);

        if (dataIdx >= starters.length) {
          cell.bg.setVisible(false); cell.nameT.setVisible(false); cell.bg.disableInteractive(); continue;
        }

        const s = starters[dataIdx];
        const isUnlocked = this.meta.totalClears >= s.unlock;
        const isCurrent = s.id === (this.meta.starter ?? "mudkip");

        cell.bg.setVisible(true)
          .setFillStyle(isCurrent ? 0x2a2a1a : isUnlocked ? 0x131b2e : 0x0a0a10, 0.95)
          .setStrokeStyle(1, isCurrent ? 0xfbbf24 : isUnlocked ? 0x1e293b : 0x111118);
        cell.nameT.setVisible(true)
          .setText(isUnlocked ? s.name : `${s.name.slice(0, 5)}..${s.unlock}`)
          .setColor(isCurrent ? "#fbbf24" : isUnlocked ? "#d0d0e0" : "#333344")
          .setFontStyle(isCurrent ? "bold" : "normal");

        cell.bg.removeAllListeners("pointerup");
        if (isUnlocked) {
          cell.bg.setInteractive({ useHandCursor: true });
          cell.bg.on("pointerup", (ptr: Phaser.Input.Pointer) => {
            if (ptr.getDistance() > 10) return;
            showPreview(s.id);
          });
        } else { cell.bg.disableInteractive(); }
      }
    };

    const renderVisible = () => {
      const topOffset = -scrollOffset;
      const firstRow = Math.max(0, Math.floor(topOffset / ROW_H));
      for (let i = 0; i < POOL_ROWS; i++) {
        const dataRow = firstRow + i;
        const yPos = VISIBLE_TOP + 2 + dataRow * ROW_H + CELL_H / 2 + scrollOffset;
        bindPoolRow(i, dataRow, yPos);
      }
    };

    let scrollOffset = 0;
    const currentIdx = starters.findIndex(s => s.id === (this.meta.starter ?? "mudkip"));
    if (currentIdx >= 0) {
      const currentRow = Math.floor(currentIdx / COLS);
      scrollOffset = -Math.min(MAX_SCROLL, Math.max(0, currentRow * ROW_H - VISIBLE_H / 3));
    }
    renderVisible();

    const scrollInd = this.add.rectangle(GAME_WIDTH - 3, VISIBLE_TOP, 3,
      Math.max(20, (VISIBLE_H / TOTAL_H) * VISIBLE_H), 0x667eea, 0.5)
      .setOrigin(0.5, 0).setDepth(203).setVisible(MAX_SCROLL > 0);
    uiItems.push(scrollInd);

    const updateInd = () => {
      if (MAX_SCROLL <= 0) return;
      scrollInd.y = VISIBLE_TOP + (-scrollOffset / MAX_SCROLL) * (VISIBLE_H - scrollInd.height);
    };
    updateInd();

    let dragStartY = 0;
    let isDragging = false;
    const onDown = (ptr: Phaser.Input.Pointer) => { if (!starterSelectActive) return; dragStartY = ptr.y; isDragging = true; };
    const scrollHandler = (ptr: Phaser.Input.Pointer) => {
      if (!starterSelectActive || !ptr.isDown || !isDragging) return;
      const dy = ptr.y - dragStartY; dragStartY = ptr.y;
      scrollOffset = Math.max(-MAX_SCROLL, Math.min(0, scrollOffset + dy));
      renderVisible(); updateInd();
    };
    const onUp = () => { isDragging = false; };

    this.input.on("pointerdown", onDown);
    this.input.on("pointermove", scrollHandler);
    this.input.on("pointerup", onUp);

    const cleanup = () => {
      if (!starterSelectActive) return;
      starterSelectActive = false;
      this.input.off("pointerdown", onDown);
      this.input.off("pointermove", scrollHandler);
      this.input.off("pointerup", onUp);
      uiItems.forEach(o => o.destroy());
      // Refresh home tab to show new starter
      if (this.activeTab === "home") this.switchTab("home");
    };

    closeBtn.on("pointerdown", cleanup);
  }

  private getStarterList(): { id: string; name: string; unlock: number }[] {
    return [...STARTER_LIST].sort((a, b) => {
      const dexA = parseInt(SPRITE_DEX[a.id] ?? "9999", 10);
      const dexB = parseInt(SPRITE_DEX[b.id] ?? "9999", 10);
      return dexA - dexB;
    });
  }

  // ═══════════════════════════════════════
  // ── NPC Dialogue ──
  // ═══════════════════════════════════════

  private showNpcDialogue(npc: NPC): void {
    const lines = getNpcDialogue(npc, this.meta);
    let lineIndex = 0;
    let typewriterTimer: Phaser.Time.TimerEvent | null = null;
    let isTyping = false;
    let currentFullText = "";
    const uiItems: Phaser.GameObjects.GameObject[] = [];

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
      .setDepth(400).setInteractive();
    uiItems.push(overlay);

    const panelH = 160;
    const panelY = GAME_HEIGHT - panelH / 2 - 20;
    const panel = this.add.rectangle(GAME_WIDTH / 2, panelY, GAME_WIDTH - 24, panelH, 0x111827, 0.98)
      .setStrokeStyle(2, parseInt(npc.color.replace("#", ""), 16)).setDepth(401);
    uiItems.push(panel);

    // Try NPC sprite portrait
    const npcDex = SPRITE_DEX[npc.species];
    const npcSp = SPECIES[npc.species];
    const portraitX = 40;
    const portraitY = panelY - panelH / 2 + 30;

    if (npcDex && npcSp) {
      const textureKey = `${npc.species}-idle`;
      if (this.textures.exists(textureKey)) {
        const spr = this.add.sprite(portraitX, portraitY, textureKey, 0).setScale(1.5).setDepth(402);
        uiItems.push(spr);
      } else {
        // Fallback: initial
        const color = parseInt(npc.color.replace("#", ""), 16);
        uiItems.push(this.add.circle(portraitX, portraitY, 18, color, 0.9).setStrokeStyle(2, 0xffffff, 0.4).setDepth(402));
        uiItems.push(this.add.text(portraitX, portraitY - 1, npc.name.charAt(0), {
          fontSize: "16px", color: "#ffffff", fontFamily: "monospace", fontStyle: "bold",
        }).setOrigin(0.5).setDepth(403));
      }
    } else {
      const color = parseInt(npc.color.replace("#", ""), 16);
      uiItems.push(this.add.circle(portraitX, portraitY, 18, color, 0.9).setStrokeStyle(2, 0xffffff, 0.4).setDepth(402));
      uiItems.push(this.add.text(portraitX, portraitY - 1, npc.name.charAt(0), {
        fontSize: "16px", color: "#ffffff", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setDepth(403));
    }

    uiItems.push(this.add.text(portraitX + 28, portraitY - 10, npc.name, {
      fontSize: "12px", color: npc.color, fontFamily: "monospace", fontStyle: "bold",
    }).setDepth(402));
    uiItems.push(this.add.text(portraitX + 28, portraitY + 4, npc.role, {
      fontSize: "8px", color: "#94a3b8", fontFamily: "monospace",
    }).setDepth(402));

    const textX = 28;
    const textY = portraitY + 30;
    const dialogueText = this.add.text(textX, textY, "", {
      fontSize: "11px", color: "#e0e0e0", fontFamily: "monospace",
      wordWrap: { width: GAME_WIDTH - 60 }, lineSpacing: 4,
    }).setDepth(402);
    uiItems.push(dialogueText);

    const btnBg = this.add.rectangle(GAME_WIDTH - 50, panelY + panelH / 2 - 20, 60, 22, 0x1e3a5f, 0.9)
      .setStrokeStyle(1, 0x60a5fa).setDepth(403).setInteractive({ useHandCursor: true });
    uiItems.push(btnBg);
    const btnLabel = this.add.text(GAME_WIDTH - 50, panelY + panelH / 2 - 20, "", {
      fontSize: "10px", color: "#60a5fa", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(404);
    uiItems.push(btnLabel);

    const lineIndicator = this.add.text(GAME_WIDTH / 2, panelY + panelH / 2 - 20, "", {
      fontSize: "8px", color: "#555570", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(402);
    uiItems.push(lineIndicator);

    const cleanup = () => { if (typewriterTimer) typewriterTimer.destroy(); uiItems.forEach(o => o.destroy()); };

    const updateBtnLabel = () => {
      btnLabel.setText(lineIndex < lines.length - 1 ? "Next" : "Close");
      lineIndicator.setText(`${lineIndex + 1}/${lines.length}`);
    };

    const showFullText = () => {
      if (typewriterTimer) { typewriterTimer.destroy(); typewriterTimer = null; }
      isTyping = false;
      dialogueText.setText(currentFullText);
    };

    const startTypewriter = (text: string) => {
      currentFullText = text; isTyping = true; dialogueText.setText("");
      let charIndex = 0;
      if (typewriterTimer) typewriterTimer.destroy();
      typewriterTimer = this.time.addEvent({
        delay: 30, repeat: text.length - 1,
        callback: () => { charIndex++; dialogueText.setText(text.substring(0, charIndex)); if (charIndex >= text.length) isTyping = false; },
      });
    };

    const advance = () => {
      if (isTyping) { showFullText(); return; }
      lineIndex++;
      if (lineIndex >= lines.length) { cleanup(); return; }
      updateBtnLabel();
      startTypewriter(lines[lineIndex]);
    };

    btnBg.on("pointerdown", advance);
    overlay.on("pointerdown", advance);
    panel.setInteractive();
    panel.on("pointerdown", advance);

    updateBtnLabel();
    startTypewriter(lines[0]);
  }
}
