import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  findTravelPath,
  travelDays,
  reachableTowns,
  applyTravelToCharacter,
  NODE_BY_ID,
  type TravelLegResult,
} from "./travel.js";
import type { CharacterSheet } from "@embertrail/shared";

function stubSheet(partial: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    id: "h1",
    accountId: "a1",
    name: "Test",
    gender: "m",
    archetype: "steelguard",
    level: 1,
    exp: 0,
    expToNext: 100,
    attributes: { cou: 12, cle: 10, int: 10, cha: 10, dex: 11, agi: 11, con: 12, str: 13 },
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
    life: 20,
    lifeMax: 20,
    focus: 0,
    focusMax: 0,
    atBase: 10,
    paBase: 8,
    inventory: [
      { itemId: "longsword", qty: 1, durability: 5 },
      { itemId: "boots", qty: 1, durability: 20 },
    ],
    equipped: { mainHand: "longsword", boots: "boots" },
    gold: 1,
    silver: 0,
    copper: 0,
    rations: 5,
    diseases: [],
    portraitId: "steelguard_m",
    position: { townId: "rimeport", mapNodeId: "rimeport", x: 0, y: 1.6, z: 0, yaw: 0 },
    travelDay: 1,
    questFlags: {},
    journal: [],
    knownMapNodes: ["rimeport"],
    ...partial,
  };
}

describe("travel graph", () => {
  it("finds a path from rimeport to irondeep", () => {
    const path = findTravelPath("rimeport", "irondeep");
    assert.ok(path);
    assert.equal(path![0], "rimeport");
    assert.equal(path![path!.length - 1], "irondeep");
    assert.ok(travelDays(path!) >= 1);
  });

  it("returns null for unknown nodes", () => {
    assert.equal(findTravelPath("rimeport", "nope"), null);
  });

  it("lists reachable towns", () => {
    const towns = reachableTowns("rimeport");
    assert.ok(towns.includes("irondeep") || towns.length > 0);
    for (const id of towns) {
      assert.equal(NODE_BY_ID[id]?.kind, "town");
    }
  });
});

describe("applyTravelToCharacter", () => {
  it("spends rations and wears weapon", () => {
    const sheet = stubSheet();
    const leg: TravelLegResult = {
      rationsUsed: 1,
      shoeWear: 2,
      weaponWear: 3,
      weather: "clear",
      fatigue: 0,
      notifications: [],
      losses: [],
    };
    const { sheet: next, notifications } = applyTravelToCharacter(sheet, leg);
    assert.equal(next.rations, 4);
    const weapon = next.inventory.find((i) => i.itemId === "longsword");
    assert.ok(weapon);
    assert.equal(weapon!.durability, 2);
    assert.ok(notifications.includes("travel.weapon_wear"));
  });

  it("ruins weapon at zero durability", () => {
    const sheet = stubSheet({
      inventory: [{ itemId: "longsword", qty: 1, durability: 2 }],
      equipped: { mainHand: "longsword" },
    });
    const leg: TravelLegResult = {
      rationsUsed: 0,
      shoeWear: 0,
      weaponWear: 5,
      weather: "clear",
      fatigue: 0,
      notifications: [],
      losses: [],
    };
    const { sheet: next, notifications } = applyTravelToCharacter(sheet, leg);
    assert.equal(next.equipped.mainHand, undefined);
    assert.ok(!next.inventory.some((i) => i.itemId === "longsword"));
    assert.ok(notifications.includes("travel.weapon_ruined"));
  });

  it("starves when out of rations", () => {
    const sheet = stubSheet({ rations: 0, life: 10 });
    const leg: TravelLegResult = {
      rationsUsed: 1,
      shoeWear: 0,
      weaponWear: 0,
      weather: "clear",
      fatigue: 0,
      notifications: [],
      losses: [],
    };
    const { sheet: next, notifications } = applyTravelToCharacter(sheet, leg);
    assert.equal(next.rations, 0);
    assert.equal(next.life, 8);
    assert.ok(notifications.includes("travel.starving"));
  });
});
