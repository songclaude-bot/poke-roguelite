/**
 * Held Items — passive equipment that provides stat bonuses or special effects.
 * The player can equip one held item at a time on their starter.
 */

export interface HeldItem {
  id: string;
  name: string;
  description: string;
  cost: number;        // gold to buy
  unlockClears: number;
  effect: HeldItemEffect;
}

export interface HeldItemEffect {
  atkBonus?: number;      // flat ATK bonus
  defBonus?: number;      // flat DEF bonus
  hpBonus?: number;       // flat HP bonus
  critChance?: number;    // % chance for 1.5x damage
  dodgeChance?: number;   // % chance to dodge attacks
  healPerFloor?: number;  // HP healed each floor
  goldBonus?: number;     // % more gold earned
  expBonus?: number;      // % more EXP earned
}

export const HELD_ITEMS: HeldItem[] = [
  // Basic items
  { id: "powerBand", name: "Power Band", description: "+5 ATK", cost: 200, unlockClears: 0,
    effect: { atkBonus: 5 } },
  { id: "defenseScarf", name: "Defense Scarf", description: "+5 DEF", cost: 200, unlockClears: 0,
    effect: { defBonus: 5 } },
  { id: "healthCharm", name: "Health Charm", description: "+15 HP", cost: 200, unlockClears: 0,
    effect: { hpBonus: 15 } },

  // Mid-tier items
  { id: "scopeLens", name: "Scope Lens", description: "10% critical hit chance", cost: 400, unlockClears: 5,
    effect: { critChance: 10 } },
  { id: "brightPowder", name: "Bright Powder", description: "8% dodge chance", cost: 400, unlockClears: 5,
    effect: { dodgeChance: 8 } },
  { id: "shellBell", name: "Shell Bell", description: "Heal 10 HP each floor", cost: 500, unlockClears: 10,
    effect: { healPerFloor: 10 } },
  { id: "amuletCoin", name: "Amulet Coin", description: "+25% gold earned", cost: 500, unlockClears: 10,
    effect: { goldBonus: 25 } },
  { id: "luckyEgg", name: "Lucky Egg", description: "+25% EXP earned", cost: 500, unlockClears: 10,
    effect: { expBonus: 25 } },

  // High-tier items
  { id: "choiceBand", name: "Choice Band", description: "+12 ATK", cost: 800, unlockClears: 20,
    effect: { atkBonus: 12 } },
  { id: "assaultVest", name: "Assault Vest", description: "+12 DEF", cost: 800, unlockClears: 20,
    effect: { defBonus: 12 } },
  { id: "lifeOrb", name: "Life Orb", description: "+8 ATK, 15% crit", cost: 1000, unlockClears: 30,
    effect: { atkBonus: 8, critChance: 15 } },
  { id: "focusSash", name: "Focus Sash", description: "+20 HP, 5% dodge", cost: 1000, unlockClears: 30,
    effect: { hpBonus: 20, dodgeChance: 5 } },
];

export function getHeldItem(id: string): HeldItem | undefined {
  return HELD_ITEMS.find(i => i.id === id);
}
