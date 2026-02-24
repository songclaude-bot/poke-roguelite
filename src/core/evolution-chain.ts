/**
 * Evolution Chain Builder — given a species, finds its full evolution chain.
 * Handles linear chains (A -> B -> C) and branching (Eevee -> multiple).
 */

import { PokemonType } from "./type-chart";
import { SPECIES, PokemonSpecies } from "./pokemon-data";
import { EVOLUTIONS, EvolutionDef } from "./evolution";

export interface EvolutionNode {
  speciesId: string;
  name: string;
  types: PokemonType[];
  evolvesTo: EvolutionNode[];
  evolveLevel?: number;   // level required to reach THIS form (from parent)
  inSpecies: boolean;     // whether this species exists in SPECIES database
}

// ── Precomputed lookup maps (built once on first access) ──

let _fromMap: Map<string, EvolutionDef[]> | null = null;
let _toMap: Map<string, EvolutionDef> | null = null;

function getFromMap(): Map<string, EvolutionDef[]> {
  if (!_fromMap) {
    _fromMap = new Map();
    for (const evo of EVOLUTIONS) {
      const existing = _fromMap.get(evo.from);
      if (existing) {
        existing.push(evo);
      } else {
        _fromMap.set(evo.from, [evo]);
      }
    }
  }
  return _fromMap;
}

function getToMap(): Map<string, EvolutionDef> {
  if (!_toMap) {
    _toMap = new Map();
    for (const evo of EVOLUTIONS) {
      // If multiple point to same 'to', only store the first (rare edge case)
      if (!_toMap.has(evo.to)) {
        _toMap.set(evo.to, evo);
      }
    }
  }
  return _toMap;
}

/**
 * Find the base form of a species by walking back through the evolution chain.
 * e.g. "haunter" -> "gastly", "marshtomp" -> "mudkip"
 */
export function getBaseForm(speciesId: string): string {
  const toMap = getToMap();
  let current = speciesId;
  const visited = new Set<string>();

  while (true) {
    if (visited.has(current)) break; // prevent cycles
    visited.add(current);
    const parent = toMap.get(current);
    if (parent) {
      current = parent.from;
    } else {
      break;
    }
  }
  return current;
}

/**
 * Build the full evolution tree starting from a given species ID.
 * Automatically finds the base form first, then builds the tree downward.
 */
export function getEvolutionChain(speciesId: string): EvolutionNode {
  const baseId = getBaseForm(speciesId);
  return buildNodeRecursive(baseId, undefined);
}

function buildNodeRecursive(speciesId: string, evolveLevel: number | undefined): EvolutionNode {
  const fromMap = getFromMap();
  const sp = SPECIES[speciesId];

  // Get name and types from SPECIES if available, otherwise from EVOLUTIONS
  let name: string;
  let types: PokemonType[];
  let inSpecies: boolean;

  if (sp) {
    name = sp.name;
    types = sp.types;
    inSpecies = true;
  } else {
    // This species only exists as an evolution target — look it up in EVOLUTIONS
    const toMap = getToMap();
    const evoDef = toMap.get(speciesId);
    name = evoDef ? evoDef.newName : speciesId;
    // Try to inherit types from the pre-evolution
    const parentSp = evoDef ? SPECIES[evoDef.from] : null;
    types = parentSp ? parentSp.types : [];
    inSpecies = false;
  }

  const evolutions = fromMap.get(speciesId) ?? [];
  const children = evolutions.map(evo =>
    buildNodeRecursive(evo.to, evo.level)
  );

  return {
    speciesId,
    name,
    types,
    evolvesTo: children,
    evolveLevel,
    inSpecies,
  };
}

/**
 * Flatten an evolution tree into an ordered array of all species IDs in the chain.
 * Useful for quick checks: "is this species in the same evolution family?"
 */
export function flattenChain(node: EvolutionNode): string[] {
  const result: string[] = [node.speciesId];
  for (const child of node.evolvesTo) {
    result.push(...flattenChain(child));
  }
  return result;
}

/**
 * Check if a species has any evolution chain (either evolves from or to something).
 */
export function hasEvolutionChain(speciesId: string): boolean {
  const fromMap = getFromMap();
  const toMap = getToMap();
  return fromMap.has(speciesId) || toMap.has(speciesId);
}
