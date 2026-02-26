/**
 * DOM-based HUD overlay for DungeonScene.
 * Renders text as HTML so it's always crisp at any DPI/scale.
 * Positioned via Phaser's DOMElement system (auto-scales with canvas).
 *
 * Layout (360×640):
 *   Top band (0-70):   floor label, HP bar, turn info, belly, timer
 *   Middle (70-400):   game viewport (tilemap + sprites)
 *   Log area (~400):   combat log
 *   Pickup row (~505):  pickup / quickslot — aligned above D-pad
 *   Skill grid (~510):  2x2 skill buttons — opposite side of D-pad
 *   D-pad (~510-640):   8-directional pad (bottom)
 */

import { GAME_WIDTH, GAME_HEIGHT } from "../config";

const FONT = `'Courier New', Courier, monospace`;

/** Y constants — derived from GAME_HEIGHT=640 */
const DPAD_CENTER_Y = GAME_HEIGHT - 70;   // 570
const DPAD_RADIUS = 50;
// Pickup/quickslot row sits just above the D-pad circle
const ACTION_ROW_Y = DPAD_CENTER_Y - DPAD_RADIUS - 18; // 502

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

  // ── Log box (above controls area) ──
  const logBox = document.createElement("div");
  logBox.style.cssText = `
    position: absolute;
    left: 8px; bottom: ${GAME_HEIGHT - ACTION_ROW_Y + 10}px;
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

  // ── Pickup button ──
  const pickupBtn = document.createElement("button");
  pickupBtn.textContent = "⬇";
  pickupBtn.style.cssText = actionBtnCss(ACTION_ROW_Y);
  c.appendChild(pickupBtn);

  // ── Quick-slot button ──
  const quickSlotBtn = document.createElement("button");
  quickSlotBtn.textContent = "—";
  quickSlotBtn.style.cssText = actionBtnCss(ACTION_ROW_Y);
  c.appendChild(quickSlotBtn);

  // ── Team button ──
  const teamBtn = document.createElement("button");
  teamBtn.textContent = "Team";
  teamBtn.style.cssText = `
    position: absolute;
    top: ${ACTION_ROW_Y}px;
    font-size: 10px;
    font-family: ${FONT};
    font-weight: bold;
    color: #60a5fa;
    background: rgba(26,26,46,0.85);
    border: 1px solid #333355;
    border-radius: 4px;
    padding: 3px 8px;
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
    background: rgba(26,26,46,0.85);
    border: 1px solid #333355;
    border-radius: 4px;
    padding: 3px 8px;
    pointer-events: auto;
    cursor: pointer;
  `;
}

/**
 * Position skill buttons (2x2 opposite of D-pad) and
 * action buttons (pickup/quickslot/team above D-pad).
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

  // ── Action buttons: above D-pad, aligned with D-pad center ──
  hud.pickupBtn.style.left = `${dpadCX - 32}px`;
  hud.quickSlotBtn.style.left = `${dpadCX + 4}px`;
  hud.teamBtn.style.left = `${dpadCX + 36}px`;
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
