import type { MagicSchool } from "@embertrail/shared";

export interface SpellDef {
  id: string;
  nameKey: string;
  school: MagicSchool;
  aspCost: number;
  combat: boolean;
  target: "self" | "ally" | "enemy" | "area" | "none";
  descKey: string;
}

export const SPELLS: SpellDef[] = [
  { id: "light", nameKey: "spell.light", school: "elemental", aspCost: 1, combat: false, target: "none", descKey: "spell.light.desc" },
  { id: "spark", nameKey: "spell.spark", school: "elemental", aspCost: 4, combat: true, target: "enemy", descKey: "spell.spark.desc" },
  { id: "frost_touch", nameKey: "spell.frost_touch", school: "elemental", aspCost: 5, combat: true, target: "enemy", descKey: "spell.frost_touch.desc" },
  { id: "balm", nameKey: "spell.balm", school: "healing", aspCost: 5, combat: true, target: "ally", descKey: "spell.balm.desc" },
  { id: "ward", nameKey: "spell.ward", school: "battle", aspCost: 4, combat: true, target: "ally", descKey: "spell.ward.desc" },
  { id: "haste", nameKey: "spell.haste", school: "battle", aspCost: 6, combat: true, target: "ally", descKey: "spell.haste.desc" },
  { id: "veil", nameKey: "spell.veil", school: "illusion", aspCost: 4, combat: false, target: "self", descKey: "spell.veil.desc" },
  { id: "silence", nameKey: "spell.silence", school: "illusion", aspCost: 5, combat: true, target: "enemy", descKey: "spell.silence.desc" },
  { id: "calm", nameKey: "spell.calm", school: "mind", aspCost: 3, combat: true, target: "enemy", descKey: "spell.calm.desc" },
  { id: "sleep", nameKey: "spell.sleep", school: "mind", aspCost: 6, combat: true, target: "enemy", descKey: "spell.sleep.desc" },
  { id: "sense_motive", nameKey: "spell.sense_motive", school: "mind", aspCost: 2, combat: false, target: "none", descKey: "spell.sense_motive.desc" },
  { id: "entangle", nameKey: "spell.entangle", school: "nature", aspCost: 5, combat: true, target: "enemy", descKey: "spell.entangle.desc" },
  { id: "beast_sense", nameKey: "spell.beast_sense", school: "nature", aspCost: 2, combat: false, target: "none", descKey: "spell.beast_sense.desc" },
  { id: "melt_ice", nameKey: "spell.melt_ice", school: "elemental", aspCost: 4, combat: false, target: "none", descKey: "spell.melt_ice.desc" },
  { id: "detect_danger", nameKey: "spell.detect_danger", school: "mind", aspCost: 3, combat: false, target: "none", descKey: "spell.detect_danger.desc" },
  { id: "camp_ward", nameKey: "spell.camp_ward", school: "battle", aspCost: 3, combat: false, target: "none", descKey: "spell.camp_ward.desc" },
  { id: "open_lock", nameKey: "spell.open_lock", school: "mind", aspCost: 4, combat: false, target: "none", descKey: "spell.open_lock.desc" },
  { id: "ember_bolt", nameKey: "spell.ember_bolt", school: "elemental", aspCost: 7, combat: true, target: "enemy", descKey: "spell.ember_bolt.desc" },
];

export const SPELL_BY_ID = Object.fromEntries(SPELLS.map((s) => [s.id, s]));
