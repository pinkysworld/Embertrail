import type { CharacterSheet, TravelEvent, WeatherId } from "@embertrail/shared";
import { createRng, rollRange } from "./rng.js";
import { skillCheck } from "./checks.js";

export interface TravelNode {
  id: string;
  nameKey: string;
  kind: "town" | "crossroads" | "wild" | "dungeon_entrance";
  links: string[];
  danger: number;
}

export const TRAVEL_GRAPH: TravelNode[] = [
  {
    id: "rimeport",
    nameKey: "place.rimeport",
    kind: "town",
    links: ["road_south", "road_east", "road_west"],
    danger: 0,
  },
  {
    id: "road_south",
    nameKey: "place.road_south",
    kind: "wild",
    links: ["rimeport", "mine_ash_entrance", "crossroads_ash"],
    danger: 2,
  },
  {
    id: "mine_ash_entrance",
    nameKey: "place.mine_ash",
    kind: "dungeon_entrance",
    links: ["road_south"],
    danger: 1,
  },
  {
    id: "crossroads_ash",
    nameKey: "place.crossroads_ash",
    kind: "crossroads",
    links: ["road_south", "oakspire", "mirehold_road", "irondeep_pass"],
    danger: 2,
  },
  {
    id: "oakspire",
    nameKey: "place.oakspire",
    kind: "town",
    links: ["crossroads_ash"],
    danger: 0,
  },
  {
    id: "mirehold_road",
    nameKey: "place.mirehold_road",
    kind: "wild",
    links: ["crossroads_ash", "mirehold"],
    danger: 3,
  },
  {
    id: "mirehold",
    nameKey: "place.mirehold",
    kind: "town",
    links: ["mirehold_road", "cult_cellars_entrance"],
    danger: 1,
  },
  {
    id: "cult_cellars_entrance",
    nameKey: "place.cult_cellars",
    kind: "dungeon_entrance",
    links: ["mirehold"],
    danger: 2,
  },
  {
    id: "irondeep_pass",
    nameKey: "place.irondeep_pass",
    kind: "wild",
    links: ["crossroads_ash", "irondeep"],
    danger: 3,
  },
  {
    id: "irondeep",
    nameKey: "place.irondeep",
    kind: "town",
    links: ["irondeep_pass", "ice_crypt_entrance"],
    danger: 0,
  },
  {
    id: "ice_crypt_entrance",
    nameKey: "place.ice_crypt",
    kind: "dungeon_entrance",
    links: ["irondeep"],
    danger: 2,
  },
];

export const NODE_BY_ID = Object.fromEntries(TRAVEL_GRAPH.map((n) => [n.id, n]));

export function weatherForDay(seed: number, day: number): WeatherId {
  const rng = createRng(seed + day * 997);
  const roll = rng();
  if (roll < 0.35) return "clear";
  if (roll < 0.55) return "clouds";
  if (roll < 0.7) return "rain";
  if (roll < 0.82) return "fog";
  if (roll < 0.94) return "snow";
  return "blizzard";
}

export interface TravelLegResult {
  rationsUsed: number;
  shoeWear: number;
  weaponWear: number;
  weather: WeatherId;
  fatigue: number;
  disease?: string;
  event?: TravelEvent;
  notifications: string[];
  /** Always list material losses explicitly */
  losses: string[];
}

export function resolveTravelLeg(opts: {
  from: string;
  to: string;
  day: number;
  seed: number;
  party: CharacterSheet[];
}): TravelLegResult {
  const rng = createRng(opts.seed + opts.day);
  const weather = weatherForDay(opts.seed, opts.day);
  const node = NODE_BY_ID[opts.to];
  const danger = node?.danger ?? 1;

  let rationsUsed = 1;
  if (weather === "blizzard" || weather === "snow") rationsUsed = 2;

  const notifications: string[] = [`travel.weather.${weather}`];
  const losses: string[] = [];

  // Shoe wear
  let shoeWear = 5 + danger * 2;
  if (weather === "rain" || weather === "fog") shoeWear += 3;
  if (weather === "blizzard") shoeWear += 5;

  // Disease risk
  let disease: string | undefined;
  if (weather === "rain" || weather === "blizzard") {
    const scout = opts.party[0];
    if (scout) {
      const check = skillCheck(scout, "survival", weather === "blizzard" ? -4 : -2, rng);
      notifications.push(check.feedbackKey);
      if (!check.success && rng() < 0.35) {
        disease = "cold";
        notifications.push("travel.disease.cold");
      }
    }
  }

  // Random event
  let event: TravelEvent | undefined;
  const eventRoll = rng();
  if (eventRoll < 0.12 + danger * 0.08) {
    if (rng() < 0.55) {
      event = {
        id: "wolves",
        kind: "combat",
        textKey: "event.wolves",
      };
    } else if (rng() < 0.5) {
      event = {
        id: "merchant",
        kind: "story",
        textKey: "event.merchant",
        choices: [
          { id: "trade", labelKey: "event.merchant.trade" },
          { id: "ignore", labelKey: "event.merchant.ignore" },
        ],
      };
    } else {
      event = {
        id: "hidden_path",
        kind: "discovery",
        textKey: "event.hidden_path",
        choices: [
          { id: "explore", labelKey: "event.hidden_path.explore", skillId: "orient" },
          { id: "skip", labelKey: "event.hidden_path.skip" },
        ],
      };
    }
  }

  // Explicit gear wear feedback
  if (shoeWear >= 10) {
    notifications.push("travel.shoes_wearing");
  }

  return {
    rationsUsed,
    shoeWear,
    weaponWear: rollRange(rng, 0, 2 + danger),
    weather,
    fatigue: danger + (weather === "blizzard" ? 2 : 0),
    disease,
    event,
    notifications,
    losses,
  };
}

export function applyTravelToCharacter(
  sheet: CharacterSheet,
  leg: TravelLegResult
): { sheet: CharacterSheet; notifications: string[] } {
  const next = {
    ...sheet,
    inventory: sheet.inventory.map((i) => ({ ...i })),
    diseases: [...sheet.diseases],
  };
  const notes = [...leg.notifications];

  next.rations = Math.max(0, next.rations - leg.rationsUsed);
  if (next.rations === 0) {
    next.life = Math.max(1, next.life - 2);
    notes.push("travel.starving");
    notes.push("travel.starving.damage");
  }

  // Boot durability
  const boots = next.inventory.find((i) => i.itemId === "boots");
  if (boots) {
    boots.durability = Math.max(0, (boots.durability ?? 100) - leg.shoeWear);
    if (boots.durability === 0) {
      notes.push("travel.boots_ruined");
      // Explicit loss
      next.inventory = next.inventory.filter((i) => i !== boots);
      next.equipped = { ...next.equipped, boots: undefined };
    }
  }

  if (leg.disease && !next.diseases.includes(leg.disease)) {
    next.diseases.push(leg.disease);
  }

  return { sheet: next, notifications: notes };
}

export function campRest(sheet: CharacterSheet, hasWatch: boolean, seed: number): CharacterSheet {
  const rng = createRng(seed);
  const next = { ...sheet };
  let heal = 4 + Math.floor(next.attributes.con / 4);
  if (next.diseases.includes("cold")) heal = Math.floor(heal / 2);
  if (!hasWatch && rng() < 0.2) {
    // Ambush risk handled by caller
  }
  next.life = Math.min(next.lifeMax, next.life + heal);
  next.focus = Math.min(next.focusMax, next.focus + 3 + Math.floor(next.attributes.cle / 5));
  return next;
}
