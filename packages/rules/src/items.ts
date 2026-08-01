export interface WeaponStats {
  dice: number;
  sides: number;
  bonus: number;
  ranged: boolean;
  skill: string;
  atMod?: number;
  twoHanded?: boolean;
}

export const WEAPON_STATS: Record<string, WeaponStats> = {
  unarmed: { dice: 1, sides: 4, bonus: 0, ranged: false, skill: "unarmed" },
  longsword: { dice: 1, sides: 8, bonus: 1, ranged: false, skill: "swords" },
  shortsword: { dice: 1, sides: 6, bonus: 1, ranged: false, skill: "swords" },
  battle_axe: { dice: 1, sides: 10, bonus: 0, ranged: false, skill: "axes" },
  warhammer: { dice: 1, sides: 8, bonus: 1, ranged: false, skill: "blunt" },
  staff: { dice: 1, sides: 6, bonus: 0, ranged: false, skill: "blunt" },
  shortbow: { dice: 1, sides: 6, bonus: 1, ranged: true, skill: "bows" },
  throwing_knives: { dice: 1, sides: 4, bonus: 1, ranged: true, skill: "throwing" },
};

export interface ItemDef {
  id: string;
  nameKey: string;
  kind: "weapon" | "armor" | "shield" | "consumable" | "quest" | "misc" | "ammo" | "tool";
  valueCopper: number;
  stackable?: boolean;
  heal?: number;
  rations?: number;
}

export const ITEMS: Record<string, ItemDef> = {
  longsword: { id: "longsword", nameKey: "item.longsword", kind: "weapon", valueCopper: 400 },
  shortsword: { id: "shortsword", nameKey: "item.shortsword", kind: "weapon", valueCopper: 250 },
  battle_axe: { id: "battle_axe", nameKey: "item.battle_axe", kind: "weapon", valueCopper: 350 },
  warhammer: { id: "warhammer", nameKey: "item.warhammer", kind: "weapon", valueCopper: 320 },
  staff: { id: "staff", nameKey: "item.staff", kind: "weapon", valueCopper: 80 },
  shortbow: { id: "shortbow", nameKey: "item.shortbow", kind: "weapon", valueCopper: 280 },
  throwing_knives: { id: "throwing_knives", nameKey: "item.throwing_knives", kind: "weapon", valueCopper: 120 },
  wooden_shield: { id: "wooden_shield", nameKey: "item.wooden_shield", kind: "shield", valueCopper: 150 },
  leather_armor: { id: "leather_armor", nameKey: "item.leather_armor", kind: "armor", valueCopper: 300 },
  cloth_armor: { id: "cloth_armor", nameKey: "item.cloth_armor", kind: "armor", valueCopper: 80 },
  boots: { id: "boots", nameKey: "item.boots", kind: "armor", valueCopper: 60 },
  arrows: { id: "arrows", nameKey: "item.arrows", kind: "ammo", valueCopper: 2, stackable: true },
  lockpicks: { id: "lockpicks", nameKey: "item.lockpicks", kind: "tool", valueCopper: 50 },
  lute: { id: "lute", nameKey: "item.lute", kind: "tool", valueCopper: 100 },
  herb_pouch: { id: "herb_pouch", nameKey: "item.herb_pouch", kind: "misc", valueCopper: 20 },
  spellbook: { id: "spellbook", nameKey: "item.spellbook", kind: "misc", valueCopper: 200 },
  rations_pack: { id: "rations_pack", nameKey: "item.rations_pack", kind: "consumable", valueCopper: 30, rations: 7 },
  ration: { id: "ration", nameKey: "item.ration", kind: "consumable", valueCopper: 5, stackable: true, rations: 1 },
  potion_heal: { id: "potion_heal", nameKey: "item.potion_heal", kind: "consumable", valueCopper: 80, heal: 12, stackable: true },
  potion_focus: { id: "potion_focus", nameKey: "item.potion_focus", kind: "consumable", valueCopper: 90, stackable: true },
  herb_woundwort: { id: "herb_woundwort", nameKey: "item.herb_woundwort", kind: "misc", valueCopper: 15, stackable: true },
  herb_frostleaf: { id: "herb_frostleaf", nameKey: "item.herb_frostleaf", kind: "misc", valueCopper: 20, stackable: true },
  herb_emberroot: { id: "herb_emberroot", nameKey: "item.herb_emberroot", kind: "misc", valueCopper: 25, stackable: true },
  copper_coins: { id: "copper_coins", nameKey: "item.copper_coins", kind: "misc", valueCopper: 1, stackable: true },
  pactcinder: { id: "pactcinder", nameKey: "item.pactcinder", kind: "quest", valueCopper: 0 },
  foxbrand_axe: { id: "foxbrand_axe", nameKey: "item.foxbrand_axe", kind: "quest", valueCopper: 0 },
  fake_pactcinder: { id: "fake_pactcinder", nameKey: "item.fake_pactcinder", kind: "quest", valueCopper: 0 },
  mine_key: { id: "mine_key", nameKey: "item.mine_key", kind: "quest", valueCopper: 0 },
  cult_sigil: { id: "cult_sigil", nameKey: "item.cult_sigil", kind: "quest", valueCopper: 0 },
};

export const ALCHEMY_RECIPES = [
  {
    id: "brew_heal",
    nameKey: "alchemy.brew_heal",
    ingredients: [
      { itemId: "herb_woundwort", qty: 2 },
      { itemId: "herb_frostleaf", qty: 1 },
    ],
    result: { itemId: "potion_heal", qty: 1 },
    skillMin: 2,
  },
  {
    id: "brew_asp",
    nameKey: "alchemy.brew_asp",
    ingredients: [
      { itemId: "herb_emberroot", qty: 2 },
      { itemId: "herb_frostleaf", qty: 1 },
    ],
    result: { itemId: "potion_focus", qty: 1 },
    skillMin: 3,
  },
];
