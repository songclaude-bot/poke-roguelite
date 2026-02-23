/**
 * Evolution system — certain Pokemon can evolve at specific levels.
 * Evolution grants stat bonuses and may add new skills.
 */

export interface EvolutionDef {
  from: string;       // species ID
  to: string;         // evolved species ID (reuses from or new key)
  level: number;      // minimum level to evolve
  newName: string;    // display name after evolution
  hpBonus: number;    // bonus HP on evolution
  atkBonus: number;   // bonus ATK
  defBonus: number;   // bonus DEF
  newSkillId?: string; // optional new skill learned
}

export const EVOLUTIONS: EvolutionDef[] = [
  { from: "mudkip", to: "marshtomp", level: 16, newName: "Marshtomp", hpBonus: 15, atkBonus: 4, defBonus: 3, newSkillId: "surf" },
  { from: "pikachu", to: "raichu", level: 16, newName: "Raichu", hpBonus: 10, atkBonus: 5, defBonus: 2, newSkillId: "thunderShock" },
  { from: "machop", to: "machoke", level: 16, newName: "Machoke", hpBonus: 15, atkBonus: 5, defBonus: 3, newSkillId: "focusPunch" },
  { from: "geodude", to: "graveler", level: 16, newName: "Graveler", hpBonus: 12, atkBonus: 3, defBonus: 5, newSkillId: "rockThrow" },
  { from: "gastly", to: "haunter", level: 16, newName: "Haunter", hpBonus: 8, atkBonus: 6, defBonus: 2, newSkillId: "shadowBall" },
  { from: "caterpie", to: "butterfree", level: 10, newName: "Butterfree", hpBonus: 12, atkBonus: 4, defBonus: 3, newSkillId: "gust" },
  { from: "pidgey", to: "pidgeotto", level: 14, newName: "Pidgeotto", hpBonus: 10, atkBonus: 4, defBonus: 3, newSkillId: "wingAttack" },
  { from: "aron", to: "lairon", level: 16, newName: "Lairon", hpBonus: 15, atkBonus: 4, defBonus: 6, newSkillId: "ironDefense" },
  { from: "drowzee", to: "hypno", level: 16, newName: "Hypno", hpBonus: 12, atkBonus: 5, defBonus: 4, newSkillId: "psybeam" },
];

/** Check if a species can evolve at a given level */
export function getEvolution(speciesId: string, level: number): EvolutionDef | null {
  return EVOLUTIONS.find(e => e.from === speciesId && level >= e.level) ?? null;
}
