import type { Attributes, CharacterSheet } from "@embertrail/shared";
import { skillAttribute, SKILL_BY_ID } from "./skills.js";
import { d20 } from "./rng.js";

export interface CheckResult {
  success: boolean;
  roll: number;
  target: number;
  margin: number;
  skillId: string;
  critical: boolean;
  fumble: boolean;
  /** Always surface this to UI — no silent failures */
  feedbackKey: string;
}

export function skillTarget(
  attrs: Attributes,
  skills: Record<string, number>,
  skillId: string,
  modifier = 0
): number {
  const attr = skillAttribute(skillId);
  const skill = skills[skillId] ?? 0;
  return attrs[attr] + skill + modifier;
}

export function skillCheck(
  sheet: Pick<CharacterSheet, "attributes" | "skills" | "negatives">,
  skillId: string,
  modifier: number,
  rng: () => number
): CheckResult {
  if (!SKILL_BY_ID[skillId]) {
    return {
      success: false,
      roll: 0,
      target: 0,
      margin: 0,
      skillId,
      critical: false,
      fumble: false,
      feedbackKey: "check.unknown_skill",
    };
  }

  let mod = modifier;
  // Negative traits as friction
  if (skillId === "climb" || skillId === "bodyControl") {
    mod -= Math.floor(sheet.negatives.acrophobia / 4);
  }
  if (skillId === "sneak" || skillId === "hide") {
    // curiosity may cause noise
    if (sheet.negatives.curiosity >= 6 && rng() < 0.15) mod -= 2;
  }
  if (skillId === "selfControl") {
    mod -= Math.floor(sheet.negatives.violentTemper / 4);
  }

  const target = skillTarget(sheet.attributes, sheet.skills, skillId, mod);
  const roll = d20(rng);
  const success = roll <= target;
  const critical = roll === 1;
  const fumble = roll === 20;

  return {
    success: fumble ? false : critical ? true : success,
    roll,
    target,
    margin: target - roll,
    skillId,
    critical,
    fumble,
    feedbackKey: fumble
      ? "check.fumble"
      : critical
        ? "check.critical"
        : success
          ? "check.success"
          : "check.fail",
  };
}
