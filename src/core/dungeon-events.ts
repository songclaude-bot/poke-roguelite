/**
 * Dungeon Event Rooms — special encounters that offer choices in event rooms.
 * Phase 249: 8 unique events with ID-based effect system.
 */

export interface EventChoice {
  label: string;
  description: string;
  effectId: string;       // identifier for the effect handler
  effectValue?: number;   // optional numeric parameter
}

export interface DungeonEvent {
  id: string;
  name: string;
  description: string;      // flavor text when entering the room
  choices: EventChoice[];
  minFloor: number;         // minimum floor to appear
  rarity: number;           // 1.0 = common, 0.5 = uncommon, 0.2 = rare
}

// ── Event Database ──

export const DUNGEON_EVENTS: DungeonEvent[] = [
  {
    id: "wishingWell",
    name: "Wishing Well",
    description: "A mysterious well glimmers with starlight. Ancient coins rest at the bottom, radiating faint energy...",
    choices: [
      {
        label: "Toss 50G",
        description: "Make a wish. Random buff: ATK+3, DEF+3, or HP+20",
        effectId: "wishingWell_toss",
        effectValue: 50,
      },
      {
        label: "Walk Away",
        description: "Leave the well undisturbed.",
        effectId: "nothing",
      },
    ],
    minFloor: 2,
    rarity: 1.0,
  },
  {
    id: "abandonedStash",
    name: "Abandoned Stash",
    description: "An old supply cache lies half-buried in rubble. Something rattles inside when you nudge it...",
    choices: [
      {
        label: "Open It",
        description: "50% chance of good items, 50% chance enemies spawn!",
        effectId: "stash_open",
      },
      {
        label: "Leave It",
        description: "Better safe than sorry.",
        effectId: "nothing",
      },
    ],
    minFloor: 2,
    rarity: 1.0,
  },
  {
    id: "mysteriousStatue",
    name: "Mysterious Statue",
    description: "A glowing statue of a legendary Pokemon stands in the center. Its eyes pulse with a warm light...",
    choices: [
      {
        label: "Pray",
        description: "Receive a full HP heal.",
        effectId: "statue_pray",
      },
      {
        label: "Smash",
        description: "Gain 3 random items but take 20 damage.",
        effectId: "statue_smash",
        effectValue: 20,
      },
    ],
    minFloor: 3,
    rarity: 0.5,
  },
  {
    id: "lostTraveler",
    name: "Lost Traveler",
    description: "A wandering Pokemon shivers in the corner, looking lost and hungry. It gazes at you with hopeful eyes...",
    choices: [
      {
        label: "Give Food",
        description: "Lose 1 Apple. Gain an ally for this floor.",
        effectId: "traveler_feed",
      },
      {
        label: "Ignore",
        description: "You don't have food to spare.",
        effectId: "nothing",
      },
    ],
    minFloor: 3,
    rarity: 0.5,
  },
  {
    id: "cursedChest",
    name: "Cursed Chest",
    description: "A dark chest pulses with ominous energy. Purple mist seeps from its edges...",
    choices: [
      {
        label: "Open",
        description: "Get a powerful item, but receive Burn status.",
        effectId: "chest_open",
      },
      {
        label: "Leave",
        description: "The curse isn't worth the risk.",
        effectId: "nothing",
      },
    ],
    minFloor: 4,
    rarity: 0.5,
  },
  {
    id: "trainingGround",
    name: "Training Ground",
    description: "A marked training area with worn battle scratches. The air hums with residual fighting spirit...",
    choices: [
      {
        label: "Train",
        description: "Gain 500 EXP but lose 30% belly.",
        effectId: "train_do",
        effectValue: 500,
      },
      {
        label: "Skip",
        description: "Save your energy for the journey.",
        effectId: "nothing",
      },
    ],
    minFloor: 3,
    rarity: 0.5,
  },
  {
    id: "fortuneTeller",
    name: "Fortune Teller",
    description: "A mystic orb floats above a velvet cloth, swirling with visions of the dungeon's secrets...",
    choices: [
      {
        label: "Pay 100G",
        description: "Reveal all items and stairs on the minimap.",
        effectId: "fortune_pay",
        effectValue: 100,
      },
      {
        label: "Pass",
        description: "You'll find the way yourself.",
        effectId: "nothing",
      },
    ],
    minFloor: 2,
    rarity: 0.2,
  },
  {
    id: "restSpot",
    name: "Rest Spot",
    description: "A calm clearing bathed in soft light. The gentle breeze and warm glow invite you to rest...",
    choices: [
      {
        label: "Rest",
        description: "Full HP heal and Belly +30, but skip your turn.",
        effectId: "rest_do",
        effectValue: 30,
      },
    ],
    minFloor: 2,
    rarity: 1.0,
  },
];

/**
 * Roll a random event for a given floor.
 * Filters by minFloor and applies rarity weighting.
 */
export function rollDungeonEvent(floor: number): DungeonEvent | null {
  const candidates = DUNGEON_EVENTS.filter(e => floor >= e.minFloor);
  if (candidates.length === 0) return null;

  // Weighted random selection using rarity
  const totalWeight = candidates.reduce((sum, e) => sum + e.rarity, 0);
  let roll = Math.random() * totalWeight;
  for (const event of candidates) {
    roll -= event.rarity;
    if (roll <= 0) return event;
  }
  return candidates[candidates.length - 1]; // fallback
}
