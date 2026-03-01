import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { loadMeta, saveMeta, MetaSaveData } from "../core/save-system";
import {
  Quest, QuestReward, QuestType,
  generateDailyQuests, getChallengeQuests,
  claimQuestReward, hasClaimableQuests, getTodayDateString,
} from "../core/quests";

type TabId = "daily" | "challenges";

/**
 * QuestBoardScene — Quest / Mission Board UI.
 * Two tabs: Daily Quests (3 per day) and Challenges (persistent).
 */
export class QuestBoardScene extends Phaser.Scene {
  private meta!: MetaSaveData;
  private activeTab: TabId = "daily";

  // Tab containers
  private dailyContainer!: Phaser.GameObjects.Container;
  private challengeContainer!: Phaser.GameObjects.Container;

  // Tab buttons
  private tabDailyBtn!: Phaser.GameObjects.Text;
  private tabChallengeBtn!: Phaser.GameObjects.Text;
  private tabDailyUnderline!: Phaser.GameObjects.Rectangle;
  private tabChallengeUnderline!: Phaser.GameObjects.Rectangle;

  // Badge elements
  private dailyBadge: Phaser.GameObjects.GameObject[] = [];
  private challengeBadge: Phaser.GameObjects.GameObject[] = [];

  // Scroll state
  private scrollOffset = 0;
  private maxScroll = 0;
  private isDragging = false;
  private dragStartY = 0;

  private readonly SCROLL_TOP = 90;
  private readonly SCROLL_BOTTOM = GAME_HEIGHT - 40;

  constructor() {
    super({ key: "QuestBoardScene" });
  }

  create() {
    this.meta = loadMeta();
    this.refreshQuests();

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1a);

    // Title
    this.add.text(GAME_WIDTH / 2, 18, "Quest Board", {
      fontSize: "15px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    // Tab buttons
    this.createTabs();

    // Containers
    this.dailyContainer = this.add.container(0, 0);
    this.challengeContainer = this.add.container(0, 0);

    this.buildDailyTab();
    this.buildChallengeTab();

    // Mask for scrollable area
    const scrollH = this.SCROLL_BOTTOM - this.SCROLL_TOP;
    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillRect(0, this.SCROLL_TOP, GAME_WIDTH, scrollH);
    const mask = maskShape.createGeometryMask();
    this.dailyContainer.setMask(mask);
    this.challengeContainer.setMask(mask);

    // Show active tab
    this.switchTab(this.activeTab);

    // Scroll input
    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (ptr.y >= this.SCROLL_TOP && ptr.y <= this.SCROLL_BOTTOM) {
        this.isDragging = true;
        this.dragStartY = ptr.y;
      }
    });
    this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
      if (!ptr.isDown || !this.isDragging) return;
      const dy = ptr.y - this.dragStartY;
      this.dragStartY = ptr.y;
      this.scrollOffset = Math.max(-this.maxScroll, Math.min(0, this.scrollOffset + dy));
      this.getActiveContainer().y = this.scrollOffset;
    });
    this.input.on("pointerup", () => { this.isDragging = false; });

    // Back button
    const backBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 30, 180, 34, 0x1a1a2e, 0.95)
      .setStrokeStyle(1, 0x334155).setInteractive({ useHandCursor: true });
    backBg.on("pointerover", () => backBg.setFillStyle(0x2a2a4e, 1));
    backBg.on("pointerout", () => backBg.setFillStyle(0x1a1a2e, 0.95));
    backBg.on("pointerdown", () => this.scene.start("HubScene"));
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, "Back to Town", {
      fontSize: "13px", color: "#60a5fa", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);
  }

  // ── Quest Refresh Logic ──

  private refreshQuests() {
    const today = getTodayDateString();

    // Refresh daily quests if date changed
    if (this.meta.questLastDate !== today) {
      this.meta.activeQuests = generateDailyQuests(new Date(), this.meta);
      this.meta.questLastDate = today;
    }

    // Ensure challenge quests exist and are up-to-date
    this.meta.challengeQuests = getChallengeQuests(this.meta);

    saveMeta(this.meta);
  }

  // ── Tab Management ──

  private createTabs() {
    const tabY = 44;

    this.tabDailyBtn = this.add.text(GAME_WIDTH * 0.25, tabY, "Daily Quests", {
      fontSize: "11px", color: "#fbbf24", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.tabDailyUnderline = this.add.rectangle(GAME_WIDTH * 0.25, tabY + 12, 100, 2, 0xfbbf24);

    this.tabChallengeBtn = this.add.text(GAME_WIDTH * 0.75, tabY, "Challenges", {
      fontSize: "11px", color: "#94a3b8", fontFamily: "monospace",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.tabChallengeUnderline = this.add.rectangle(GAME_WIDTH * 0.75, tabY + 12, 100, 2, 0xfbbf24)
      .setVisible(false);

    this.tabDailyBtn.on("pointerdown", () => this.switchTab("daily"));
    this.tabChallengeBtn.on("pointerdown", () => this.switchTab("challenges"));

    // Daily quest badge counts
    this.updateBadges(tabY);

    // Timer for daily quests
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msLeft = tomorrow.getTime() - now.getTime();
    const hoursLeft = Math.floor(msLeft / 3600000);
    const minsLeft = Math.floor((msLeft % 3600000) / 60000);

    this.add.text(GAME_WIDTH / 2, 68, `Resets in ${hoursLeft}h ${minsLeft}m`, {
      fontSize: "8px", color: "#666680", fontFamily: "monospace",
    }).setOrigin(0.5);
  }

  private switchTab(tab: TabId) {
    this.activeTab = tab;
    this.scrollOffset = 0;

    // Update tab styling
    const isDaily = tab === "daily";
    this.tabDailyBtn.setColor(isDaily ? "#fbbf24" : "#94a3b8");
    this.tabDailyBtn.setFontStyle(isDaily ? "bold" : "normal");
    this.tabDailyUnderline.setVisible(isDaily);

    this.tabChallengeBtn.setColor(!isDaily ? "#fbbf24" : "#94a3b8");
    this.tabChallengeBtn.setFontStyle(!isDaily ? "bold" : "normal");
    this.tabChallengeUnderline.setVisible(!isDaily);

    // Toggle containers
    this.dailyContainer.setVisible(isDaily);
    this.challengeContainer.setVisible(!isDaily);

    // Reset scroll
    this.dailyContainer.y = 0;
    this.challengeContainer.y = 0;

    // Compute maxScroll for active tab
    this.recalcMaxScroll();
  }

  private getActiveContainer(): Phaser.GameObjects.Container {
    return this.activeTab === "daily" ? this.dailyContainer : this.challengeContainer;
  }

  private recalcMaxScroll() {
    const quests = this.activeTab === "daily"
      ? (this.meta.activeQuests ?? [])
      : (this.meta.challengeQuests ?? []);
    const cardH = 80;
    const totalH = quests.length * cardH + 20;
    const scrollH = this.SCROLL_BOTTOM - this.SCROLL_TOP;
    this.maxScroll = Math.max(0, totalH - scrollH);
  }

  // ── Build Tab Contents ──

  private buildDailyTab() {
    this.killContainerTweens(this.dailyContainer);
    this.dailyContainer.removeAll(true);
    const quests = this.meta.activeQuests ?? [];
    this.renderQuestList(this.dailyContainer, quests, true);
  }

  private buildChallengeTab() {
    this.killContainerTweens(this.challengeContainer);
    this.challengeContainer.removeAll(true);
    const quests = this.meta.challengeQuests ?? [];
    this.renderQuestList(this.challengeContainer, quests, false);
  }

  /** Stop all tweens targeting children of a container before destroying them */
  private killContainerTweens(container: Phaser.GameObjects.Container) {
    for (const child of container.list) {
      this.tweens.killTweensOf(child);
    }
  }

  private renderQuestList(container: Phaser.GameObjects.Container, quests: Quest[], isDaily: boolean) {
    const cardW = 320;
    const cardH = 74;
    const startY = this.SCROLL_TOP + 10;

    if (quests.length === 0) {
      const noQuests = this.add.text(GAME_WIDTH / 2, startY + 40,
        isDaily ? "No daily quests yet.\nCome back later!" : "No challenges available.",
        { fontSize: "11px", color: "#94a3b8", fontFamily: "monospace", align: "center" }
      ).setOrigin(0.5);
      container.add(noQuests);
      return;
    }

    for (let i = 0; i < quests.length; i++) {
      const quest = quests[i];
      const cy = startY + i * (cardH + 6) + cardH / 2;

      // Card background
      const bgColor = quest.claimed ? 0x1a2a1a : quest.completed ? 0x1a2a2a : 0x1a1a2e;
      const strokeColor = quest.claimed ? 0x2a4a2a : quest.completed ? 0x4ade80 : 0x334155;
      const bg = this.add.rectangle(GAME_WIDTH / 2, cy, cardW, cardH, bgColor, 0.95)
        .setStrokeStyle(1, strokeColor);
      container.add(bg);

      // Glow animation for completed (claimable) quests
      if (quest.completed && !quest.claimed) {
        this.tweens.add({
          targets: bg,
          alpha: { from: 0.95, to: 0.7 },
          duration: 800,
          yoyo: true,
          repeat: -1,
        });
      }

      // Quest name
      const nameColor = quest.claimed ? "#4a6a4a" : quest.completed ? "#4ade80" : "#e0e0e0";
      const nameT = this.add.text(GAME_WIDTH / 2 - cardW / 2 + 12, cy - 26, quest.name, {
        fontSize: "11px", color: nameColor, fontFamily: "monospace", fontStyle: "bold",
      });
      container.add(nameT);

      // Quest description
      const descColor = quest.claimed ? "#3a5a3a" : "#94a3b8";
      const descT = this.add.text(GAME_WIDTH / 2 - cardW / 2 + 12, cy - 10, quest.description, {
        fontSize: "8px", color: descColor, fontFamily: "monospace",
      });
      container.add(descT);

      // Progress bar background
      const barX = GAME_WIDTH / 2 - cardW / 2 + 12;
      const barW = cardW - 100;
      const barH = 8;
      const barY = cy + 8;
      const barBg = this.add.rectangle(barX + barW / 2, barY, barW, barH, 0x222233, 0.9)
        .setStrokeStyle(1, 0x334155);
      container.add(barBg);

      // Progress bar fill
      const ratio = quest.target > 0 ? Math.min(1, quest.progress / quest.target) : 0;
      if (ratio > 0) {
        const fillW = Math.max(2, barW * ratio);
        const fillColor = quest.completed ? 0x4ade80 : 0x60a5fa;
        const barFill = this.add.rectangle(barX + fillW / 2, barY, fillW, barH - 2, fillColor, 0.9);
        container.add(barFill);
      }

      // Progress text
      const progressStr = `${quest.progress}/${quest.target}`;
      const progressT = this.add.text(barX + barW + 6, barY, progressStr, {
        fontSize: "8px", color: quest.completed ? "#4ade80" : "#94a3b8", fontFamily: "monospace",
      }).setOrigin(0, 0.5);
      container.add(progressT);

      // Reward display
      const rewardStr = this.formatReward(quest.reward);
      const rewardT = this.add.text(GAME_WIDTH / 2 + cardW / 2 - 12, cy - 26, rewardStr, {
        fontSize: "9px", color: "#fde68a", fontFamily: "monospace",
      }).setOrigin(1, 0);
      container.add(rewardT);

      // Claim button or checkmark
      if (quest.completed && !quest.claimed) {
        const claimBtnBg = this.add.rectangle(GAME_WIDTH / 2 + cardW / 2 - 45, cy + 20, 80, 24, 0x1a3a2e, 0.9)
          .setStrokeStyle(1, 0x4ade80).setInteractive({ useHandCursor: true });
        container.add(claimBtnBg);
        const claimBtnText = this.add.text(GAME_WIDTH / 2 + cardW / 2 - 45, cy + 20, "Claim", {
          fontSize: "11px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
        }).setOrigin(0.5);
        container.add(claimBtnText);
        claimBtnBg.on("pointerover", () => claimBtnBg.setFillStyle(0x2a5a3e, 1));
        claimBtnBg.on("pointerout", () => claimBtnBg.setFillStyle(0x1a3a2e, 0.9));
        claimBtnBg.on("pointerdown", () => {
          this.claimQuest(quest);
        });
      } else if (quest.claimed) {
        const checkT = this.add.text(GAME_WIDTH / 2 + cardW / 2 - 12, cy + 20, "Claimed", {
          fontSize: "9px", color: "#4a6a4a", fontFamily: "monospace",
        }).setOrigin(1, 0.5);
        container.add(checkT);
      }
    }
  }

  private formatReward(reward: QuestReward): string {
    const parts: string[] = [];
    if (reward.gold > 0) parts.push(`${reward.gold}G`);
    if (reward.exp && reward.exp > 0) parts.push(`${reward.exp} EXP`);
    if (reward.itemId) parts.push(`x${reward.itemCount ?? 1} item`);
    return parts.join(" + ");
  }

  private updateBadges(tabY?: number) {
    // Destroy old badges
    for (const obj of this.dailyBadge) obj.destroy();
    for (const obj of this.challengeBadge) obj.destroy();
    this.dailyBadge = [];
    this.challengeBadge = [];

    const y = tabY ?? 44; // default tabY from createTabs
    const dailyClaimable = (this.meta.activeQuests ?? []).filter(q => q.completed && !q.claimed).length;
    const challengeClaimable = (this.meta.challengeQuests ?? []).filter(q => q.completed && !q.claimed).length;

    if (dailyClaimable > 0) {
      const c = this.add.circle(GAME_WIDTH * 0.25 + 50, y - 6, 5, 0xef4444).setDepth(5);
      const t = this.add.text(GAME_WIDTH * 0.25 + 50, y - 6, String(dailyClaimable), {
        fontSize: "7px", color: "#ffffff", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setDepth(6);
      this.dailyBadge.push(c, t);
    }
    if (challengeClaimable > 0) {
      const c = this.add.circle(GAME_WIDTH * 0.75 + 45, y - 6, 5, 0xef4444).setDepth(5);
      const t = this.add.text(GAME_WIDTH * 0.75 + 45, y - 6, String(challengeClaimable), {
        fontSize: "7px", color: "#ffffff", fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setDepth(6);
      this.challengeBadge.push(c, t);
    }
  }

  private claimQuest(quest: Quest) {
    const reward = claimQuestReward(quest);
    if (!reward) return;

    // Apply reward
    this.meta.gold += reward.gold;
    this.meta.totalGold += reward.gold;

    saveMeta(this.meta);

    // Show claim popup
    this.showClaimPopup(quest.name, reward);

    // Rebuild tabs and badges to reflect updated state
    this.buildDailyTab();
    this.buildChallengeTab();
    this.getActiveContainer().y = this.scrollOffset;
    this.updateBadges();
  }

  private showClaimPopup(questName: string, reward: QuestReward) {
    const uiItems: Phaser.GameObjects.GameObject[] = [];

    const overlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6
    ).setDepth(200).setInteractive();
    uiItems.push(overlay);

    const panelW = 220;
    const panelH = 100;
    const panel = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, panelW, panelH, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0x4ade80).setDepth(201);
    uiItems.push(panel);

    const titleT = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, "Quest Complete!", {
      fontSize: "13px", color: "#4ade80", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(202);
    uiItems.push(titleT);

    const rewardStr = this.formatReward(reward);
    const rewardT = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `+${rewardStr}`, {
      fontSize: "12px", color: "#fde68a", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(202);
    uiItems.push(rewardT);

    const closeBtnBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 32, 80, 28, 0x1e3a5f, 0.9)
      .setStrokeStyle(1, 0x3b82f6).setDepth(202).setInteractive({ useHandCursor: true });
    uiItems.push(closeBtnBg);
    const closeBtnText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 32, "OK", {
      fontSize: "11px", color: "#3b82f6", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(203);
    uiItems.push(closeBtnText);
    closeBtnBg.on("pointerover", () => closeBtnBg.setFillStyle(0x2e5a8f, 1));
    closeBtnBg.on("pointerout", () => closeBtnBg.setFillStyle(0x1e3a5f, 0.9));

    const cleanup = () => { uiItems.forEach(o => o.destroy()); };
    closeBtnBg.on("pointerdown", cleanup);
    overlay.on("pointerdown", cleanup);

    // Auto-dismiss after 3s
    this.time.delayedCall(3000, () => {
      if (titleT.active) cleanup();
    });
  }
}
