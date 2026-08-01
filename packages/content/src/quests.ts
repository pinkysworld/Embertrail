/** Structured quest definitions for Embertrail */

export interface QuestStep {
  id: string;
  titleKey: string;
  bodyKey: string;
  /** Quest flags that must already match before this step can progress */
  requires?: Record<string, number | boolean | string>;
  /** Town or dungeon id hint for the player */
  locationHint?: string;
}

export interface QuestDef {
  id: string;
  nameKey: string;
  steps: QuestStep[];
  finalChoices?: { id: string; labelKey: string; townId?: string }[];
}

export const QUESTS: Record<string, QuestDef> = {
  pactcinder: {
    id: "pactcinder",
    nameKey: "quest.pactcinder.name",
    steps: [
      {
        id: "hear_envoy",
        titleKey: "quest.pactcinder.step.hear_envoy.title",
        bodyKey: "quest.pactcinder.step.hear_envoy.body",
        locationHint: "rimeport",
      },
      {
        id: "find_mine",
        titleKey: "quest.pactcinder.step.find_mine.title",
        bodyKey: "quest.pactcinder.step.find_mine.body",
        requires: { pactcinder: 1 },
        locationHint: "mine_ash",
      },
      {
        id: "greed_choice",
        titleKey: "quest.pactcinder.step.greed_choice.title",
        bodyKey: "quest.pactcinder.step.greed_choice.body",
        requires: { pactcinder: 1 },
        locationHint: "mine_ash",
      },
      {
        id: "defeat_guardian",
        titleKey: "quest.pactcinder.step.defeat_guardian.title",
        bodyKey: "quest.pactcinder.step.defeat_guardian.body",
        requires: { pactcinder: 1 },
        locationHint: "mine_ash",
      },
      {
        id: "decide_fate",
        titleKey: "quest.pactcinder.step.decide_fate.title",
        bodyKey: "quest.pactcinder.step.decide_fate.body",
        requires: { pactcinder: 2 },
        locationHint: "irondeep",
      },
    ],
    finalChoices: [
      { id: "alliance", labelKey: "quest.pactcinder.alliance", townId: "irondeep" },
      { id: "sell", labelKey: "quest.pactcinder.sell", townId: "mirehold" },
    ],
  },

  foxbrand: {
    id: "foxbrand",
    nameKey: "quest.foxbrand.name",
    steps: [
      {
        id: "tavern_rumor",
        titleKey: "quest.foxbrand.step.tavern_rumor.title",
        bodyKey: "quest.foxbrand.step.tavern_rumor.body",
        locationHint: "rimeport",
      },
      {
        id: "smith_mooniron",
        titleKey: "quest.foxbrand.step.smith_mooniron.title",
        bodyKey: "quest.foxbrand.step.smith_mooniron.body",
        requires: { foxbrand: 1 },
        locationHint: "rimeport",
      },
      {
        id: "cult_cellars",
        titleKey: "quest.foxbrand.step.cult_cellars.title",
        bodyKey: "quest.foxbrand.step.cult_cellars.body",
        requires: { foxbrand: 1 },
        locationHint: "cult_cellars",
      },
      {
        id: "ice_crypt",
        titleKey: "quest.foxbrand.step.ice_crypt.title",
        bodyKey: "quest.foxbrand.step.ice_crypt.body",
        requires: { foxbrand: 1 },
        locationHint: "ice_crypt",
      },
      {
        id: "claim_axe",
        titleKey: "quest.foxbrand.step.claim_axe.title",
        bodyKey: "quest.foxbrand.step.claim_axe.body",
        requires: { foxbrand: 2 },
        locationHint: "ice_crypt",
      },
    ],
  },

  wolves: {
    id: "wolves",
    nameKey: "quest.wolves.name",
    steps: [
      {
        id: "board_notice",
        titleKey: "quest.wolves.step.board_notice.title",
        bodyKey: "quest.wolves.step.board_notice.body",
        locationHint: "rimeport",
      },
      {
        id: "road_south",
        titleKey: "quest.wolves.step.road_south.title",
        bodyKey: "quest.wolves.step.road_south.body",
        requires: { wolves: 1 },
        locationHint: "road_south",
      },
      {
        id: "clear_pack",
        titleKey: "quest.wolves.step.clear_pack.title",
        bodyKey: "quest.wolves.step.clear_pack.body",
        requires: { wolves: 1 },
        locationHint: "road_south",
      },
      {
        id: "report_innkeep",
        titleKey: "quest.wolves.step.report_innkeep.title",
        bodyKey: "quest.wolves.step.report_innkeep.body",
        requires: { wolves: 2 },
        locationHint: "rimeport",
      },
    ],
  },

  herbs: {
    id: "herbs",
    nameKey: "quest.herbs.name",
    steps: [
      {
        id: "herbalist_plea",
        titleKey: "quest.herbs.step.herbalist_plea.title",
        bodyKey: "quest.herbs.step.herbalist_plea.body",
        locationHint: "oakspire",
      },
      {
        id: "gather_woundwort",
        titleKey: "quest.herbs.step.gather_woundwort.title",
        bodyKey: "quest.herbs.step.gather_woundwort.body",
        requires: { herbs: 1 },
        locationHint: "oakspire",
      },
      {
        id: "gather_frostleaf",
        titleKey: "quest.herbs.step.gather_frostleaf.title",
        bodyKey: "quest.herbs.step.gather_frostleaf.body",
        requires: { herbs: 1 },
        locationHint: "rimeport",
      },
      {
        id: "gather_emberroot",
        titleKey: "quest.herbs.step.gather_emberroot.title",
        bodyKey: "quest.herbs.step.gather_emberroot.body",
        requires: { herbs: 1 },
        locationHint: "crossroads_ash",
      },
      {
        id: "deliver_bundle",
        titleKey: "quest.herbs.step.deliver_bundle.title",
        bodyKey: "quest.herbs.step.deliver_bundle.body",
        requires: { herbs: 1 },
        locationHint: "oakspire",
      },
    ],
  },

  cult_sigil: {
    id: "cult_sigil",
    nameKey: "quest.cult_sigil.name",
    steps: [
      {
        id: "temple_whisper",
        titleKey: "quest.cult_sigil.step.temple_whisper.title",
        bodyKey: "quest.cult_sigil.step.temple_whisper.body",
        locationHint: "rimeport",
      },
      {
        id: "enter_cellars",
        titleKey: "quest.cult_sigil.step.enter_cellars.title",
        bodyKey: "quest.cult_sigil.step.enter_cellars.body",
        requires: { cult_sigil: 1 },
        locationHint: "cult_cellars",
      },
      {
        id: "recover_sigil",
        titleKey: "quest.cult_sigil.step.recover_sigil.title",
        bodyKey: "quest.cult_sigil.step.recover_sigil.body",
        requires: { cult_sigil: 1 },
        locationHint: "cult_cellars",
      },
      {
        id: "blessing",
        titleKey: "quest.cult_sigil.step.blessing.title",
        bodyKey: "quest.cult_sigil.step.blessing.body",
        requires: { cult_sigil: 2 },
        locationHint: "rimeport",
      },
    ],
  },
};

/** Step index (1-based) for a quest step id, or 0 if unknown */
export function questStepIndex(questId: string, stepId: string): number {
  const q = QUESTS[questId];
  if (!q) return 0;
  const i = q.steps.findIndex((s) => s.id === stepId);
  return i < 0 ? 0 : i + 1;
}

export function getQuestStep(questId: string, stepId: string): QuestStep | undefined {
  return QUESTS[questId]?.steps.find((s) => s.id === stepId);
}
