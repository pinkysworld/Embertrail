import type { AttributeId, SkillDef } from "@embertrail/shared";

export const SKILLS: SkillDef[] = [
  // Combat
  { id: "swords", category: "combat", attribute: "str", nameKey: "skill.swords" },
  { id: "axes", category: "combat", attribute: "str", nameKey: "skill.axes" },
  { id: "polearms", category: "combat", attribute: "str", nameKey: "skill.polearms" },
  { id: "blunt", category: "combat", attribute: "str", nameKey: "skill.blunt" },
  { id: "bows", category: "combat", attribute: "dex", nameKey: "skill.bows" },
  { id: "throwing", category: "combat", attribute: "dex", nameKey: "skill.throwing" },
  { id: "unarmed", category: "combat", attribute: "agi", nameKey: "skill.unarmed" },
  { id: "shields", category: "combat", attribute: "str", nameKey: "skill.shields" },
  { id: "tactics", category: "combat", attribute: "cle", nameKey: "skill.tactics" },
  // Body
  { id: "climb", category: "body", attribute: "agi", nameKey: "skill.climb" },
  { id: "swim", category: "body", attribute: "con", nameKey: "skill.swim" },
  { id: "selfControl", category: "body", attribute: "cou", nameKey: "skill.selfControl" },
  { id: "bodyControl", category: "body", attribute: "agi", nameKey: "skill.bodyControl" },
  { id: "carouse", category: "body", attribute: "con", nameKey: "skill.carouse" },
  { id: "dance", category: "body", attribute: "cha", nameKey: "skill.dance" },
  { id: "endurance", category: "body", attribute: "con", nameKey: "skill.endurance" },
  // Social
  { id: "haggle", category: "social", attribute: "cha", nameKey: "skill.haggle" },
  { id: "persuade", category: "social", attribute: "cha", nameKey: "skill.persuade" },
  { id: "lie", category: "social", attribute: "cha", nameKey: "skill.lie" },
  { id: "streetwise", category: "social", attribute: "int", nameKey: "skill.streetwise" },
  { id: "etiquette", category: "social", attribute: "cha", nameKey: "skill.etiquette" },
  { id: "intimidate", category: "social", attribute: "cou", nameKey: "skill.intimidate" },
  { id: "humanNature", category: "social", attribute: "int", nameKey: "skill.humanNature" },
  // Lore
  { id: "history", category: "lore", attribute: "cle", nameKey: "skill.history" },
  { id: "geography", category: "lore", attribute: "cle", nameKey: "skill.geography" },
  { id: "arcaneLore", category: "lore", attribute: "cle", nameKey: "skill.arcaneLore" },
  { id: "religion", category: "lore", attribute: "cle", nameKey: "skill.religion" },
  { id: "languages", category: "lore", attribute: "cle", nameKey: "skill.languages" },
  { id: "law", category: "lore", attribute: "cle", nameKey: "skill.law" },
  // Craft
  { id: "locks", category: "craft", attribute: "dex", nameKey: "skill.locks" },
  { id: "pickpocket", category: "craft", attribute: "dex", nameKey: "skill.pickpocket" },
  { id: "alchemy", category: "craft", attribute: "cle", nameKey: "skill.alchemy" },
  { id: "treatWounds", category: "craft", attribute: "dex", nameKey: "skill.treatWounds" },
  { id: "repair", category: "craft", attribute: "dex", nameKey: "skill.repair" },
  { id: "music", category: "craft", attribute: "cha", nameKey: "skill.music" },
  // Nature
  { id: "track", category: "nature", attribute: "int", nameKey: "skill.track" },
  { id: "survival", category: "nature", attribute: "int", nameKey: "skill.survival" },
  { id: "herbLore", category: "nature", attribute: "cle", nameKey: "skill.herbLore" },
  { id: "animalLore", category: "nature", attribute: "cle", nameKey: "skill.animalLore" },
  { id: "orient", category: "nature", attribute: "int", nameKey: "skill.orient" },
  { id: "weatherSense", category: "nature", attribute: "int", nameKey: "skill.weatherSense" },
  // Perception
  { id: "perception", category: "perception", attribute: "int", nameKey: "skill.perception" },
  { id: "dangerSense", category: "perception", attribute: "int", nameKey: "skill.dangerSense" },
  { id: "hide", category: "perception", attribute: "agi", nameKey: "skill.hide" },
  { id: "sneak", category: "perception", attribute: "agi", nameKey: "skill.sneak" },
];

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<
  string,
  SkillDef
>;

export function skillAttribute(skillId: string): AttributeId {
  return SKILL_BY_ID[skillId]?.attribute ?? "cle";
}
