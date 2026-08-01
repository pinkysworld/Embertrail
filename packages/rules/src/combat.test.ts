import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  startCombat,
  applyCombatAction,
  makeEnemy,
  hitChancePercent,
  hasLineOfSight,
} from "./combat.js";
import type { Combatant } from "@embertrail/shared";

function hero(id: string, x: number, y: number): Combatant {
  return {
    id,
    name: id,
    side: "party",
    x,
    y,
    life: 20,
    lifeMax: 20,
    focus: 10,
    focusMax: 10,
    at: 12,
    pa: 8,
    initiative: 14,
    status: [],
    isPlayer: true,
  };
}

describe("combat", () => {
  it("computes hit chance in 5-95", () => {
    assert.equal(hitChancePercent(10, 10), 50);
    assert.ok(hitChancePercent(20, 5) <= 95);
    assert.ok(hitChancePercent(5, 20) >= 5);
  });

  it("resolves a fight to victory or ongoing", () => {
    const state = startCombat({
      id: "t1",
      party: [hero("h1", 1, 1)],
      enemies: [makeEnemy("e1", "wolf", "Wolf", 2, 1)],
      width: 6,
      height: 6,
    });
    assert.equal(state.activeId, state.turnOrder[0]);
    let s = state;
    for (let i = 0; i < 30; i++) {
      const actor = s.combatants.find((c) => c.id === s.activeId)!;
      if (actor.side === "party") {
        const foe = s.combatants.find((c) => c.side === "enemy" && c.life > 0)!;
        const r = applyCombatAction(s, actor.id, { kind: "attack", targetId: foe.id }, 42 + i, {
          [actor.id]: "longsword",
        });
        s = r.state;
        if (r.ended) {
          assert.ok(r.ended === "victory" || r.ended === "defeat");
          return;
        }
      } else {
        const foe = s.combatants.find((c) => c.side === "party" && c.life > 0)!;
        const r = applyCombatAction(s, actor.id, { kind: "attack", targetId: foe.id }, 99 + i);
        s = r.state;
        if (r.ended) return;
      }
    }
  });

  it("blocks LoS through walls", () => {
    const state = startCombat({
      id: "t2",
      party: [hero("h1", 0, 0)],
      enemies: [makeEnemy("e1", "wolf", "Wolf", 4, 0)],
      blocked: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
    });
    const a = state.combatants[0];
    const b = state.combatants[1];
    assert.equal(hasLineOfSight(state, a, b), false);
  });
});
