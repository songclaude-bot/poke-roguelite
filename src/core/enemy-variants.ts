/**
 * Enemy Variant System — special enemy types that provide strategic combat encounters.
 * Variants apply stat multipliers, visual tints, name prefixes, and special rewards on defeat.
 */

export enum EnemyVariant {
  Normal = "normal",
  Elite = "elite",
  Shiny = "shiny",
  Shadow = "shadow",
  Ancient = "ancient",
}

export interface VariantConfig {
  variant: EnemyVariant;
  hpMult: number;
  atkMult: number;
  defMult: number;
  expMult: number;
  goldMult: number;
  tint: number;
  namePrefix: string;
  dropChance: number;      // bonus drop chance (percentage, e.g. 5 = 5%)
  spriteScale: number;     // scale multiplier (1.0 = normal, 1.2 = 20% larger)
}

/** Variant configuration definitions */
const VARIANT_CONFIGS: Record<EnemyVariant, VariantConfig> = {
  [EnemyVariant.Normal]: {
    variant: EnemyVariant.Normal,
    hpMult: 1.0,
    atkMult: 1.0,
    defMult: 1.0,
    expMult: 1.0,
    goldMult: 1.0,
    tint: 0xffffff,
    namePrefix: "",
    dropChance: 0,
    spriteScale: 1.0,
  },
  [EnemyVariant.Elite]: {
    variant: EnemyVariant.Elite,
    hpMult: 1.5,
    atkMult: 1.3,
    defMult: 1.3,
    expMult: 2.0,
    goldMult: 2.0,
    tint: 0xff4444,
    namePrefix: "Elite",
    dropChance: 5,
    spriteScale: 1.2,
  },
  [EnemyVariant.Shiny]: {
    variant: EnemyVariant.Shiny,
    hpMult: 1.0,
    atkMult: 1.0,
    defMult: 1.0,
    expMult: 1.0,
    goldMult: 3.0,
    tint: 0xffd700,
    namePrefix: "Shiny",
    dropChance: 10,
    spriteScale: 1.0,
  },
  [EnemyVariant.Shadow]: {
    variant: EnemyVariant.Shadow,
    hpMult: 2.0,
    atkMult: 1.5,
    defMult: 1.0,
    expMult: 2.5,
    goldMult: 1.0,
    tint: 0x8844aa,
    namePrefix: "Shadow",
    dropChance: 0,     // guaranteed skill drop handled separately
    spriteScale: 1.1,
  },
  [EnemyVariant.Ancient]: {
    variant: EnemyVariant.Ancient,
    hpMult: 2.5,
    atkMult: 2.0,
    defMult: 1.5,
    expMult: 3.0,
    goldMult: 3.0,
    tint: 0x44dddd,
    namePrefix: "Ancient",
    dropChance: 40,    // high chance relic drop
    spriteScale: 1.2,
  },
};

/**
 * Roll an enemy variant based on floor depth and dungeon difficulty.
 * Returns the variant type for a newly spawned enemy.
 */
export function rollEnemyVariant(floor: number, difficulty: number): EnemyVariant {
  const r = Math.random() * 100;

  // Ancient: 2% base, only on floor 10+
  const ancientChance = floor >= 10 ? 2 : 0;
  // Shadow: 3% base, +0.5% per 5 floors
  const shadowChance = 3 + Math.floor(floor / 5) * 0.5;
  // Shiny: 5% base (flat)
  const shinyChance = 5;
  // Elite: 10% base, +1% per 3 floors
  const eliteChance = 10 + Math.floor(floor / 3);

  // Higher difficulty slightly raises all variant chances
  const diffBonus = Math.max(0, (difficulty - 1) * 2);

  let threshold = 0;

  // Ancient
  threshold += ancientChance + (ancientChance > 0 ? diffBonus * 0.5 : 0);
  if (r < threshold) return EnemyVariant.Ancient;

  // Shadow
  threshold += shadowChance + diffBonus * 0.3;
  if (r < threshold) return EnemyVariant.Shadow;

  // Shiny
  threshold += shinyChance;
  if (r < threshold) return EnemyVariant.Shiny;

  // Elite
  threshold += eliteChance + diffBonus;
  if (r < threshold) return EnemyVariant.Elite;

  return EnemyVariant.Normal;
}

/** Get the full configuration for a variant */
export function getVariantConfig(variant: EnemyVariant): VariantConfig {
  return VARIANT_CONFIGS[variant];
}

/** Get the tint color for a variant */
export function getVariantColor(variant: EnemyVariant): number {
  return VARIANT_CONFIGS[variant].tint;
}

/** Get the CSS hex color string for a variant (for text rendering) */
export function getVariantHexColor(variant: EnemyVariant): string {
  const c = VARIANT_CONFIGS[variant].tint;
  return `#${c.toString(16).padStart(6, "0")}`;
}

/** Build the display name for a variant enemy */
export function getVariantName(baseName: string, variant: EnemyVariant): string {
  const prefix = VARIANT_CONFIGS[variant].namePrefix;
  return prefix ? `${prefix} ${baseName}` : baseName;
}

/** Check if a variant is non-normal (special) */
export function isSpecialVariant(variant: EnemyVariant): boolean {
  return variant !== EnemyVariant.Normal;
}
