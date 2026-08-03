import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyLevelUp,
  createCharacter,
  computeLifeMax,
  rollAttributes,
  meetsArchetypeMins,
} from "./character.js";
import type { CharacterSheet } from "@embertrail/shared";

describe("character creation", () => {
  it("creates a valid steelguard", () => {
    const attrs = { cou: 12, cle: 10, int: 10, cha: 10, dex: 11, agi: 12, con: 13, str: 14 };
    assert.equal(meetsArchetypeMins(attrs, "steelguard"), true);
    const { character, errors } = createCharacter({
      id: "c1",
      accountId: "a1",
      name: "Hero",
      gender: "m",
      archetype: "steelguard",
      attributes: attrs,
      negatives: {
        superstition: 3,
        acrophobia: 3,
        claustrophobia: 3,
        avarice: 3,
        necrophobia: 3,
        curiosity: 3,
        violentTemper: 3,
      },
    });
    assert.equal(errors.length, 0);
    assert.equal(character.level, 1);
    assert.ok(character.lifeMax >= computeLifeMax(attrs, 1, 0));
    assert.ok(character.inventory.some((i) => i.itemId === "potion_heal"));
    assert.equal(character.position.townId, "rimeport");
  });

  it("rolls attributes in range", () => {
    const a = rollAttributes(42);
    for (const v of Object.values(a)) {
      assert.ok(v >= 8 && v <= 13);
    }
  });
});

describe("applyLevelUp", () => {
  function base(partial: Partial<CharacterSheet> = {}): CharacterSheet {
    const attrs = { cou: 12, cle: 12, int: 10, cha: 10, dex: 11, agi: 12, con: 12, str: 12 };
    return {
      id: "c1",
      accountId: "a1",
      name: "Hero",
      gender: "m",
      archetype: "steelguard",
      level: 1,
      exp: 0,
      expToNext: 100,
      attributes: attrs,
      negatives: {
        superstition: 3,
        acrophobia: 3,
        claustrophobia: 3,
        avarice: 3,
        necrophobia: 3,
        curiosity: 3,
        violentTemper: 3,
      },
      skills: {},
      spells: {},
      life: 5,
      lifeMax: 20,
      focus: 0,
      focusMax: 0,
      atBase: 10,
      paBase: 8,
      inventory: [],
      equipped: {},
      gold: 0,
      silver: 0,
      copper: 0,
      rations: 3,
      diseases: [],
      portraitId: "steelguard_m",
      position: { townId: "rimeport", x: 0, y: 1.6, z: 0, yaw: 0 },
      questFlags: {},
      journal: [],
      knownMapNodes: [],
      ...partial,
    };
  }

  it("no-ops when under threshold", () => {
    const s = applyLevelUp(base({ exp: 50, expToNext: 100 }));
    assert.equal(s.level, 1);
    assert.equal(s.exp, 50);
  });

  it("levels once and restores life/focus", () => {
    const s = applyLevelUp(base({ exp: 100, expToNext: 100, life: 3 }));
    assert.equal(s.level, 2);
    assert.equal(s.exp, 0);
    assert.equal(s.life, s.lifeMax);
  });

  it("handles multi-level from large exp grant", () => {
    // level 1 needs 100; level 2 needs 200; level 3 needs 250…
    const s = applyLevelUp(base({ exp: 500, expToNext: 100 }));
    assert.ok(s.level >= 3);
    assert.ok(s.exp < s.expToNext);
    assert.equal(s.life, s.lifeMax);
  });
});
