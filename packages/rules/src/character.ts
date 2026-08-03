import type {
  ArchetypeId,
  Attributes,
  CharacterSheet,
  NegativeTraits,
} from "@embertrail/shared";
import { ARCHETYPE_BY_ID } from "./archetypes.js";
import { SKILLS } from "./skills.js";
import { createRng, rollRange } from "./rng.js";

const ATTR_KEYS: (keyof Attributes)[] = ["cou", "cle", "int", "cha", "dex", "agi", "con", "str"];
const NEG_KEYS: (keyof NegativeTraits)[] = [
  "superstition",
  "acrophobia",
  "claustrophobia",
  "avarice",
  "necrophobia",
  "curiosity",
  "violentTemper",
];

export function rollAttributes(seed: number): Attributes {
  const rng = createRng(seed);
  const a = {} as Attributes;
  for (const k of ATTR_KEYS) a[k] = rollRange(rng, 8, 13);
  return a;
}

export function rollNegatives(seed: number): NegativeTraits {
  const rng = createRng(seed ^ 0x9e3779b9);
  const n = {} as NegativeTraits;
  for (const k of NEG_KEYS) n[k] = rollRange(rng, 2, 8);
  return n;
}

export function meetsArchetypeMins(attrs: Attributes, archetype: ArchetypeId): boolean {
  const def = ARCHETYPE_BY_ID[archetype];
  for (const [k, v] of Object.entries(def.minAttrs)) {
    if (attrs[k as keyof Attributes] < (v as number)) return false;
  }
  return true;
}

export function baseSkills(archetype: ArchetypeId): Record<string, number> {
  const skills: Record<string, number> = {};
  for (const s of SKILLS) skills[s.id] = 0;
  const def = ARCHETYPE_BY_ID[archetype];
  for (const id of def.skillBias) {
    skills[id] = (skills[id] ?? 0) + 3;
  }
  skills[def.combatSkill] = Math.max(skills[def.combatSkill] ?? 0, 4);
  return skills;
}

export function allocateSkillPoints(
  base: Record<string, number>,
  spends: Record<string, number>,
  budget = 20
): { skills: Record<string, number>; remaining: number; errors: string[] } {
  const skills = { ...base };
  let spent = 0;
  const errors: string[] = [];
  for (const [id, pts] of Object.entries(spends)) {
    if (pts < 0 || pts > 3) {
      errors.push(`skill.${id}.invalid_spend`);
      continue;
    }
    spent += pts;
    skills[id] = (skills[id] ?? 0) + pts;
  }
  if (spent > budget) errors.push("creation.over_budget");
  return { skills, remaining: budget - spent, errors };
}

export function computeLifeMax(attrs: Attributes, level: number, lifeMod: number): number {
  return 10 + attrs.con + lifeMod + (level - 1) * 2;
}

export function computeFocusMax(attrs: Attributes, level: number, focusMod: number): number {
  if (focusMod <= 0) return 0;
  return focusMod + Math.floor(attrs.cle / 2) + (level - 1);
}

export function computeAtPa(
  attrs: Attributes,
  combatSkill: number,
  atBias = 0
): { at: number; pa: number } {
  // AT/PA pool from combat skill + agility/strength; split with optional bias
  const pool = 8 + Math.floor((attrs.agi + attrs.str) / 4) + combatSkill;
  const at = Math.max(1, Math.floor(pool / 2) + atBias);
  const pa = Math.max(1, pool - at);
  return { at, pa };
}

export function createCharacter(opts: {
  id: string;
  accountId: string;
  name: string;
  gender: "m" | "f";
  archetype: ArchetypeId;
  attributes: Attributes;
  negatives: NegativeTraits;
  skillSpends?: Record<string, number>;
  atBias?: number;
  seed?: number;
}): { character: CharacterSheet; errors: string[] } {
  const def = ARCHETYPE_BY_ID[opts.archetype];
  const errors: string[] = [];
  if (!meetsArchetypeMins(opts.attributes, opts.archetype)) {
    errors.push("creation.mins_not_met");
  }
  const { skills, errors: skillErrs } = allocateSkillPoints(
    baseSkills(opts.archetype),
    opts.skillSpends ?? {},
    20
  );
  errors.push(...skillErrs);

  const level = 1;
  const lifeMax = computeLifeMax(opts.attributes, level, def.lifeMod);
  const focusMax = computeFocusMax(opts.attributes, level, def.focusMod);
  const combatSkill = skills[def.combatSkill] ?? 0;
  const { at, pa } = computeAtPa(opts.attributes, combatSkill, opts.atBias ?? 0);

  const spells: Record<string, number> = {};
  if (def.isCaster) {
    // Start with school spells at -2, focus school at 0
    const starter = starterSpells(def.schoolFocus);
    for (const s of starter) spells[s] = def.schoolFocus ? 0 : -2;
  }

  const inventory = def.startingGear.map((itemId) => ({
    itemId,
    qty: itemId === "arrows" ? 20 : itemId === "rations_pack" ? 1 : 1,
    durability: 100,
  }));
  // Always start with a healing potion so combat isn't a dead end
  if (!inventory.some((i) => i.itemId === "potion_heal")) {
    inventory.push({ itemId: "potion_heal", qty: 2, durability: 100 });
  }
  // Expand rations pack
  const rations = 7;

  const character: CharacterSheet = {
    id: opts.id,
    accountId: opts.accountId,
    name: opts.name.slice(0, 24),
    gender: opts.gender,
    archetype: opts.archetype,
    level,
    exp: 0,
    expToNext: 100,
    attributes: opts.attributes,
    negatives: opts.negatives,
    skills,
    spells,
    schoolFocus: def.schoolFocus,
    life: lifeMax,
    lifeMax,
    focus: focusMax,
    focusMax,
    atBase: at,
    paBase: pa,
    inventory,
    equipped: {
      mainHand: def.startingGear.find((g) =>
        ["longsword", "battle_axe", "warhammer", "shortsword", "staff", "shortbow", "throwing_knives"].includes(g)
      ),
      offHand: def.startingGear.includes("wooden_shield") ? "wooden_shield" : undefined,
      armor: def.startingGear.find((g) => g.includes("armor")),
      boots: "boots",
    },
    gold: 2,
    silver: 15,
    copper: 40,
    rations,
    diseases: [],
    portraitId: `${def.portraitBase}_${opts.gender}`,
    position: { townId: "rimeport", mapNodeId: "rimeport", x: 0, y: 1.6, z: 8, yaw: 0 },
    travelDay: 1,
    questFlags: { intro: 0 },
    journal: [
      {
        id: "j_arrival",
        titleKey: "journal.arrival.title",
        bodyKey: "journal.arrival.body",
        timestamp: Date.now(),
      },
    ],
    knownMapNodes: ["rimeport", "road_south", "road_east", "road_west"],
  };

  return { character, errors };
}

function starterSpells(school?: string): string[] {
  switch (school) {
    case "elemental":
      return ["spark", "light", "frost_touch"];
    case "healing":
      return ["balm", "light", "ward"];
    case "illusion":
      return ["veil", "light", "silence"];
    case "mind":
      return ["calm", "sense_motive", "sleep"];
    case "nature":
      return ["balm", "entangle", "beast_sense"];
    case "battle":
      return ["spark", "ward", "haste"];
    default:
      return ["light"];
  }
}

export function expForKill(enemyLevel: number, partySize: number): number {
  return Math.max(1, Math.floor((10 + enemyLevel * 5) / Math.max(1, partySize)));
}

export function applyLevelUp(sheet: CharacterSheet): CharacterSheet {
  if (sheet.exp < sheet.expToNext) return sheet;
  const next = { ...sheet };
  const def = ARCHETYPE_BY_ID[next.archetype];
  // Support multi-level from large EXP grants
  let guard = 0;
  while (next.exp >= next.expToNext && guard++ < 50) {
    next.level += 1;
    next.exp -= next.expToNext;
    next.expToNext = 100 + next.level * 50;
    next.lifeMax = computeLifeMax(next.attributes, next.level, def.lifeMod);
    next.focusMax = computeFocusMax(next.attributes, next.level, def.focusMod);
  }
  next.life = next.lifeMax;
  next.focus = next.focusMax;
  return next;
}
