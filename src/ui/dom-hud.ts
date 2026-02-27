/**
 * DOM-based HUD overlay for DungeonScene.
 * Renders text as HTML so it's always crisp at any DPI/scale.
 * Positioned via Phaser's DOMElement system (auto-scales with canvas).
 *
 * Layout (360×640):
 *   Top band (0-70):   floor label, HP bar, turn info, belly, timer
 *   Middle (70-400):   game viewport (tilemap + sprites)
 *   Log area (~400):   combat log
 *   Action row (~495):  pickup / quickslot / team — above D-pad with 20px gap
 *   Skill grid (~545):  2x2 skill buttons — opposite side of D-pad
 *   D-pad (~515-625):   8-directional pad (bottom)
 */

import { GAME_WIDTH, GAME_HEIGHT } from "../config";

const FONT = `'Courier New', Courier, monospace`;

/** Y constants — derived from GAME_HEIGHT=640 */
const DPAD_CENTER_Y = GAME_HEIGHT - 70;   // 570
const DPAD_RADIUS = 50;
const DPAD_BG_R = DPAD_RADIUS + 5;        // 55 — actual visual circle radius
const DPAD_TOP = DPAD_CENTER_Y - DPAD_BG_R; // 515 — top edge of D-pad background

/** Action button dimensions */
const ACTION_BTN_W = 40;
const ACTION_BTN_H = 28;
const ACTION_GAP = 4;
/** Action row Y: 20px above D-pad top edge, minus button height */
const ACTION_ROW_Y = DPAD_TOP - 20 - ACTION_BTN_H; // 515-20-28 = 467

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

  // ── Log box (above action row) ──
  const logBox = document.createElement("div");
  logBox.style.cssText = `
    position: absolute;
    left: 8px; bottom: ${GAME_HEIGHT - ACTION_ROW_Y + 10}px;
    max-width: 340px;
    font-size: 10px;
    color: #fbbf24;
    font-family: ${FONT};
    background: rgba(0,0,0,0.45);
    padding: 4px 6px;
    border-radius: 3px;
    line-height: 1.4;
    white-space: pre-wrap;
    pointer-events: none;
    display: none;
  `;
  c.appendChild(logBox);

  // ── Chain HUD (above controls, right side) ──
  const chainLabel = el("span", {
    right: "10px", bottom: `${GAME_HEIGHT - ACTION_ROW_Y + 10}px`,
    fontSize: "11px", color: "#999999", fontWeight: "bold",
    textAlign: "right",
    textShadow: "1px 1px 2px #000",
  });
  chainLabel.style.display = "none";
  c.appendChild(chainLabel);

  // ── Skill buttons (2x2 grid — positioned by layoutHudButtons) ──
  const skillBtns: HTMLButtonElement[] = [];
  for (let i = 0; i < 4; i++) {
    const btn = document.createElement("button");
    btn.style.cssText = `
      position: absolute;
      width: 82px; height: 28px;
      font-size: 10px;
      font-family: ${FONT};
      color: #c0c8e0;
      background: rgba(26,26,46,0.85);
      border: 1px solid #333355;
      border-radius: 4px;
      pointer-events: auto;
      cursor: pointer;
      padding: 0 4px;
      text-align: center;
      line-height: 28px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    `;
    skillBtns.push(btn);
    c.appendChild(btn);
  }

  // ── Pickup button (fixed size) ──
  const pickupBtn = document.createElement("button");
  pickupBtn.textContent = "⬇";
  pickupBtn.style.cssText = actionBtnCss();
  c.appendChild(pickupBtn);

  // ── Quick-slot button (fixed size) ──
  const quickSlotBtn = document.createElement("button");
  quickSlotBtn.textContent = "—";
  quickSlotBtn.style.cssText = actionBtnCss();
  c.appendChild(quickSlotBtn);

  // ── Team button (fixed size) ──
  const teamBtn = document.createElement("button");
  teamBtn.textContent = "Team";
  teamBtn.style.cssText = actionBtnCss();
  teamBtn.style.color = "#60a5fa";
  teamBtn.style.fontWeight = "bold";
  teamBtn.style.fontSize = "10px";
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

/** Shared CSS for action buttons — fixed width/height, no text-dependent sizing */
function actionBtnCss(): string {
  return `
    position: absolute;
    width: ${ACTION_BTN_W}px;
    height: ${ACTION_BTN_H}px;
    top: ${ACTION_ROW_Y}px;
    font-size: 14px;
    font-family: ${FONT};
    color: #aab0c8;
    background: rgba(26,26,46,0.85);
    border: 1px solid #333355;
    border-radius: 4px;
    padding: 0;
    text-align: center;
    line-height: ${ACTION_BTN_H}px;
    pointer-events: auto;
    cursor: pointer;
    box-sizing: border-box;
    overflow: hidden;
    white-space: nowrap;
  `;
}

/**
 * Position skill buttons (2x2 opposite of D-pad) and
 * action buttons (pickup/quickslot/team above D-pad).
 *
 * Action buttons are centered above the D-pad as a group,
 * clamped so they never overflow the screen edges.
 */
export function layoutHudButtons(
  hud: DomHudElements,
  dpadSide: "left" | "right",
  gameWidth: number,
  gameHeight: number,
): void {
  const dpadCX = dpadSide === "right" ? gameWidth - 70 : 70;

  // ── Skill buttons: 2x2 grid on the OPPOSITE side of D-pad ──
  const skillBaseX = dpadSide === "right" ? 8 : gameWidth - 172;
  const skillBaseY = gameHeight - 95;
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const btn = hud.skillBtns[i];
    btn.style.left = `${skillBaseX + col * 84}px`;
    btn.style.top = `${skillBaseY + row * 30}px`;
  }

  // ── Action buttons: centered as a group above D-pad ──
  const totalW = ACTION_BTN_W * 3 + ACTION_GAP * 2; // 3 buttons + 2 gaps
  // Start from D-pad center, but clamp to screen
  let groupLeft = dpadCX - totalW / 2;
  if (groupLeft < 4) groupLeft = 4;
  if (groupLeft + totalW > gameWidth - 4) groupLeft = gameWidth - 4 - totalW;

  hud.pickupBtn.style.left = `${groupLeft}px`;
  hud.pickupBtn.style.top = `${ACTION_ROW_Y}px`;
  hud.quickSlotBtn.style.left = `${groupLeft + ACTION_BTN_W + ACTION_GAP}px`;
  hud.quickSlotBtn.style.top = `${ACTION_ROW_Y}px`;
  hud.teamBtn.style.left = `${groupLeft + (ACTION_BTN_W + ACTION_GAP) * 2}px`;
  hud.teamBtn.style.top = `${ACTION_ROW_Y}px`;
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

/** Hide/show DOM skill buttons (used when Phaser OK/Cancel confirmation appears). */
export function setDomSkillsVisible(hud: DomHudElements, visible: boolean): void {
  const display = visible ? "block" : "none";
  for (const btn of hud.skillBtns) {
    btn.style.display = display;
  }
}
