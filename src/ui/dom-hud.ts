/**
 * DOM-based HUD overlay for DungeonScene.
 * Renders text as HTML so it's always crisp at any DPI/scale.
 * Positioned via Phaser's DOMElement system (auto-scales with canvas).
 *
 * Layout (360×640):
 *   Top band (0-70):   floor label, HP bar, turn info, belly, timer
 *   Middle (70-410):   game viewport (tilemap + sprites)
 *   Log area (~410):   combat log (above action bar)
 *   Action bar (~450):  pickup / quickslot / team buttons (1 row)
 *   Skill bar (~480):   4 skill buttons (1 row, full width)
 *   D-pad (~530-640):   8-directional pad (bottom)
 */

import { GAME_WIDTH, GAME_HEIGHT } from "../config";

const FONT = `'Courier New', Courier, monospace`;

/** Y constants — derived from GAME_HEIGHT=640 */
const DPAD_CENTER_Y = GAME_HEIGHT - 70;   // 570
const DPAD_RADIUS = 50;
const SKILL_ROW_Y = DPAD_CENTER_Y - DPAD_RADIUS - 42;   // 478
const ACTION_ROW_Y = SKILL_ROW_Y - 34;                   // 444
const LOG_BOTTOM = GAME_HEIGHT - ACTION_ROW_Y + 6;       // positions log above actions

export interface DomHudElements {
  container: HTMLDivElement;
  floorLabel: HTMLSpanElement;
  hpLabel: HTMLSpanElement;
  turnLabel: HTMLSpanElement;
  timerLabel: HTMLSpanElement;
  bellyLabel: HTMLSpanElement;
  logBox: HTMLDivElement;
  chainLabel: HTMLSpanElement;
  skillBtns: HTMLButtonElement[];
  pickupBtn: HTMLButtonElement;
  quickSlotBtn: HTMLButtonElement;
  teamBtn: HTMLButtonElement;
  skillDescBox: HTMLDivElement;
}

export function createDomHud(): DomHudElements {
  const c = document.createElement("div");
  c.id = "dom-hud";
  c.style.cssText = `
    position: relative;
    width: ${GAME_WIDTH}px;
    height: ${GAME_HEIGHT}px;
    pointer-events: none;
    font-family: ${FONT};
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
  `;

  // ── Floor / Level label (top-left) ──
  const floorLabel = el("span", {
    left: "8px", top: "28px",
    fontSize: "11px", color: "#fbbf24", fontWeight: "bold",
    textShadow: "1px 1px 2px #000",
  });
  c.appendChild(floorLabel);

  // ── HP text (on hp bar) ──
  const hpLabel = el("span", {
    left: "40px", top: "8px",
    fontSize: "8px", color: "#ffffff",
  });
  c.appendChild(hpLabel);

  // ── Turn / Level / Ability info ──
  const turnLabel = el("span", {
    left: "8px", top: "40px",
    fontSize: "10px", color: "#60a5fa",
    textShadow: "1px 1px 2px #000",
  });
  c.appendChild(turnLabel);

  // ── Timer ──
  const timerLabel = el("span", {
    left: "8px", top: "52px",
    fontSize: "8px", color: "#6b7280",
  });
  c.appendChild(timerLabel);

  // ── Belly text ──
  const bellyLabel = el("span", {
    left: "40px", top: "19px",
    fontSize: "5px", color: "#ffffff",
  });
  c.appendChild(bellyLabel);

  // ── Log box (above action buttons) ──
  const logBox = document.createElement("div");
  logBox.style.cssText = `
    position: absolute;
    left: 8px; bottom: ${LOG_BOTTOM}px;
    max-width: 340px;
    font-size: 10px;
    color: #fbbf24;
    font-family: ${FONT};
    background: rgba(0,0,0,0.8);
    padding: 4px 6px;
    border-radius: 3px;
    line-height: 1.4;
    white-space: pre-wrap;
    pointer-events: none;
    display: none;
  `;
  c.appendChild(logBox);

  // ── Chain HUD (above action row, right side) ──
  const chainLabel = el("span", {
    right: "10px", bottom: `${LOG_BOTTOM}px`,
    fontSize: "11px", color: "#999999", fontWeight: "bold",
    textAlign: "right",
    textShadow: "1px 1px 2px #000",
  });
  chainLabel.style.display = "none";
  c.appendChild(chainLabel);

  // ── Skill buttons (1 row of 4, full width) ──
  const skillBtns: HTMLButtonElement[] = [];
  const skillBtnW = 82;
  const skillGap = 4;
  const totalSkillW = skillBtnW * 4 + skillGap * 3;
  const skillStartX = Math.floor((GAME_WIDTH - totalSkillW) / 2);

  for (let i = 0; i < 4; i++) {
    const btn = document.createElement("button");
    btn.style.cssText = `
      position: absolute;
      width: ${skillBtnW}px; height: 26px;
      left: ${skillStartX + i * (skillBtnW + skillGap)}px;
      top: ${SKILL_ROW_Y}px;
      font-size: 9px;
      font-family: ${FONT};
      color: #c0c8e0;
      background: rgba(26,26,46,0.9);
      border: 1px solid #333355;
      border-radius: 4px;
      pointer-events: auto;
      cursor: pointer;
      padding: 0 2px;
      text-align: center;
      line-height: 26px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    `;
    skillBtns.push(btn);
    c.appendChild(btn);
  }

  // ── Action row: Pickup, Quick-slot, Team (centered, above skills) ──
  const pickupBtn = document.createElement("button");
  pickupBtn.textContent = "⬇";
  pickupBtn.style.cssText = actionBtnCss(ACTION_ROW_Y);
  c.appendChild(pickupBtn);

  const quickSlotBtn = document.createElement("button");
  quickSlotBtn.textContent = "—";
  quickSlotBtn.style.cssText = actionBtnCss(ACTION_ROW_Y);
  c.appendChild(quickSlotBtn);

  const teamBtn = document.createElement("button");
  teamBtn.textContent = "Team";
  teamBtn.style.cssText = `
    position: absolute;
    top: ${ACTION_ROW_Y}px;
    font-size: 10px;
    font-family: ${FONT};
    font-weight: bold;
    color: #60a5fa;
    background: rgba(26,26,46,0.9);
    border: 1px solid #333355;
    border-radius: 4px;
    padding: 3px 10px;
    pointer-events: auto;
    cursor: pointer;
  `;
  c.appendChild(teamBtn);

  // ── Skill description tooltip (top area, hidden by default) ──
  const skillDescBox = document.createElement("div");
  skillDescBox.style.cssText = `
    position: absolute;
    left: 10px; top: 68px;
    width: ${GAME_WIDTH - 20}px;
    font-size: 10px;
    font-family: ${FONT};
    color: #e0e0e0;
    background: rgba(10,10,30,0.95);
    border: 1px solid #667eea;
    border-radius: 4px;
    padding: 6px 8px;
    line-height: 1.4;
    pointer-events: none;
    display: none;
    z-index: 10;
  `;
  c.appendChild(skillDescBox);

  return {
    container: c,
    floorLabel, hpLabel, turnLabel, timerLabel, bellyLabel,
    logBox, chainLabel,
    skillBtns, pickupBtn, quickSlotBtn, teamBtn, skillDescBox,
  };
}

function el(tag: string, styles: Record<string, string>): HTMLSpanElement {
  const e = document.createElement(tag) as HTMLSpanElement;
  e.style.position = "absolute";
  e.style.fontFamily = FONT;
  e.style.pointerEvents = "none";
  for (const [k, v] of Object.entries(styles)) {
    (e.style as unknown as Record<string, string>)[k] = v;
  }
  return e;
}

function actionBtnCss(topY: number): string {
  return `
    position: absolute;
    top: ${topY}px;
    font-size: 16px;
    font-family: ${FONT};
    color: #aab0c8;
    background: rgba(26,26,46,0.9);
    border: 1px solid #333355;
    border-radius: 4px;
    padding: 3px 10px;
    pointer-events: auto;
    cursor: pointer;
  `;
}

/** Position action buttons based on D-pad side (skill buttons are pre-positioned) */
export function layoutHudButtons(
  hud: DomHudElements,
  _dpadSide: "left" | "right",
  gameWidth: number,
  _gameHeight: number,
): void {
  // Action row: pickup, quickslot, team — centered horizontally
  const cx = gameWidth / 2;
  hud.pickupBtn.style.left = `${cx - 70}px`;
  hud.quickSlotBtn.style.left = `${cx - 20}px`;
  hud.teamBtn.style.left = `${cx + 24}px`;
}

/**
 * Enable or disable all interactive DOM buttons.
 * Call setDomHudInteractive(hud, false) when opening overlays (bag, settings, etc.)
 * and setDomHudInteractive(hud, true) when closing them.
 */
export function setDomHudInteractive(hud: DomHudElements, enabled: boolean): void {
  const pe = enabled ? "auto" : "none";
  const opacity = enabled ? "1" : "0.3";
  for (const btn of hud.skillBtns) {
    btn.style.pointerEvents = pe;
    btn.style.opacity = opacity;
  }
  hud.pickupBtn.style.pointerEvents = pe;
  hud.pickupBtn.style.opacity = opacity;
  hud.quickSlotBtn.style.pointerEvents = pe;
  hud.quickSlotBtn.style.opacity = opacity;
  hud.teamBtn.style.pointerEvents = pe;
  hud.teamBtn.style.opacity = opacity;
}
