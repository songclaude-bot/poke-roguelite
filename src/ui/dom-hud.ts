/**
 * DOM-based HUD overlay for DungeonScene.
 * Renders text as HTML so it's always crisp at any DPI/scale.
 * Positioned via Phaser's DOMElement system (auto-scales with canvas).
 */

import { GAME_WIDTH, GAME_HEIGHT } from "../config";

const FONT = `'Courier New', Courier, monospace`;

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

  // ── Floor / Level label (top-left, below portrait) ──
  const floorLabel = el("span", {
    left: "8px", top: "28px",
    fontSize: "11px", color: "#fbbf24", fontWeight: "bold",
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

  // ── Log box (bottom area) ──
  const logBox = document.createElement("div");
  logBox.style.cssText = `
    position: absolute;
    left: 8px; bottom: 200px;
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

  // ── Chain HUD (bottom-right) ──
  const chainLabel = el("span", {
    right: "10px", bottom: "210px",
    fontSize: "11px", color: "#999999", fontWeight: "bold",
    textAlign: "right",
    textShadow: "1px 1px 2px #000",
  });
  chainLabel.style.display = "none";
  c.appendChild(chainLabel);

  // ── Skill buttons (2x2 grid) ──
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
  pickupBtn.style.cssText = actionBtnCss();
  c.appendChild(pickupBtn);

  // ── Quick-slot button ──
  const quickSlotBtn = document.createElement("button");
  quickSlotBtn.textContent = "—";
  quickSlotBtn.style.cssText = actionBtnCss();
  c.appendChild(quickSlotBtn);

  // ── Team button ──
  const teamBtn = document.createElement("button");
  teamBtn.textContent = "Team";
  teamBtn.style.cssText = `
    position: absolute;
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

  return {
    container: c,
    floorLabel, hpLabel, turnLabel, timerLabel, bellyLabel,
    logBox, chainLabel,
    skillBtns, pickupBtn, quickSlotBtn, teamBtn,
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

function actionBtnCss(): string {
  return `
    position: absolute;
    font-size: 18px;
    font-family: ${FONT};
    color: #aab0c8;
    background: rgba(26,26,46,0.85);
    border: 1px solid #333355;
    border-radius: 4px;
    padding: 4px 6px;
    pointer-events: auto;
    cursor: pointer;
  `;
}

/** Position skill buttons and action buttons based on D-pad side */
export function layoutHudButtons(
  hud: DomHudElements,
  dpadSide: "left" | "right",
  gameWidth: number,
  gameHeight: number,
): void {
  // Skill buttons: opposite side of D-pad, 2x2 grid
  const skillSide = dpadSide === "right" ? "left" : "right";
  const skillBaseX = skillSide === "left" ? 8 : gameWidth - 172;
  const skillBaseY = gameHeight - 70;

  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const btn = hud.skillBtns[i];
    btn.style.left = `${skillBaseX + col * 84}px`;
    btn.style.top = `${skillBaseY + row * 30}px`;
  }

  // Action buttons (center): pickup + quickslot
  const cx = gameWidth / 2;
  const cy = gameHeight - 55;
  hud.pickupBtn.style.left = `${cx - 36}px`;
  hud.pickupBtn.style.top = `${cy - 15}px`;
  hud.quickSlotBtn.style.left = `${cx + 8}px`;
  hud.quickSlotBtn.style.top = `${cy - 15}px`;

  // Team button
  hud.teamBtn.style.left = `${cx - 20}px`;
  hud.teamBtn.style.top = `${cy + 12}px`;
}
