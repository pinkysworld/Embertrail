import type {
  CharacterSheet,
  CombatAction,
  CombatState,
  Combatant,
  ItemStack,
} from "@embertrail/shared";
import { createRng, d20, dice } from "./rng.js";
import { ARCHETYPE_BY_ID } from "./archetypes.js";
import { WEAPON_STATS } from "./items.js";

export interface AttackPreview {
  hitChance: number;
  at: number;
  pa: number;
  damageDice: string;
}

export function hitChancePercent(at: number, pa: number): number {
  // Classic-inspired: each point of AT over PA helps; clamp 5–95
  const raw = 50 + (at - pa) * 5;
  return Math.max(5, Math.min(95, raw));
}

export function previewAttack(attacker: Combatant, defender: Combatant, weaponId?: string): AttackPreview {
  const w = WEAPON_STATS[weaponId ?? "unarmed"] ?? WEAPON_STATS.unarmed;
  return {
    hitChance: hitChancePercent(attacker.at, defender.pa),
    at: attacker.at,
    pa: defender.pa,
    damageDice: `${w.dice}d${w.sides}+${w.bonus}`,
  };
}

function neighbors(x: number, y: number, diagonal: boolean): Array<{ x: number; y: number }> {
  const dirs = diagonal
    ? [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]
    : [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
  return dirs.map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
}

export function isAdjacent(a: Combatant, b: Combatant, diagonal = true): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  if (diagonal) return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

export function hasLineOfSight(
  state: CombatState,
  from: Combatant,
  to: Combatant
): boolean {
  // Bresenham through blocked tiles
  let x0 = from.x;
  let y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  const blocked = new Set(state.blocked.map((b) => `${b.x},${b.y}`));

  while (!(x0 === x1 && y0 === y1)) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
    if (x0 === x1 && y0 === y1) break;
    if (blocked.has(`${x0},${y0}`)) return false;
    // Occupied by other combatants blocks LoS for projectiles
    if (
      state.combatants.some(
        (c) => c.id !== from.id && c.id !== to.id && c.life > 0 && c.x === x0 && c.y === y0
      )
    ) {
      return false;
    }
  }
  return true;
}

export function flankingBonus(state: CombatState, attacker: Combatant, defender: Combatant): number {
  const allies = state.combatants.filter(
    (c) => c.side === attacker.side && c.id !== attacker.id && c.life > 0 && isAdjacent(c, defender)
  );
  return allies.length > 0 ? 2 : 0;
}

export function combatantFromCharacter(sheet: CharacterSheet, x: number, y: number): Combatant {
  const def = ARCHETYPE_BY_ID[sheet.archetype];
  const weaponId = sheet.equipped.mainHand;
  const w = WEAPON_STATS[weaponId ?? "unarmed"] ?? WEAPON_STATS.unarmed;
  return {
    id: sheet.id,
    name: sheet.name,
    side: "party",
    x,
    y,
    life: sheet.life,
    lifeMax: sheet.lifeMax,
    focus: sheet.focus,
    focusMax: sheet.focusMax,
    at: sheet.atBase + (w.atMod ?? 0),
    pa: sheet.paBase + (sheet.equipped.offHand === "wooden_shield" ? 2 : 0),
    initiative: sheet.attributes.agi + (sheet.skills[def.combatSkill] ?? 0),
    portraitId: sheet.portraitId,
    status: [],
    isPlayer: true,
    characterId: sheet.id,
  };
}

export function makeEnemy(
  id: string,
  type: string,
  name: string,
  x: number,
  y: number,
  level = 1
): Combatant {
  const stats = ENEMY_TEMPLATES[type] ?? ENEMY_TEMPLATES.wolf;
  return {
    id,
    name,
    side: "enemy",
    x,
    y,
    life: stats.life + level * 2,
    lifeMax: stats.life + level * 2,
    focus: stats.focus,
    focusMax: stats.focus,
    at: stats.at + Math.floor(level / 2),
    pa: stats.pa + Math.floor(level / 3),
    initiative: stats.ini + level,
    enemyType: type,
    status: [],
  };
}

export const ENEMY_TEMPLATES: Record<
  string,
  { life: number; at: number; pa: number; ini: number; focus: number; damage: [number, number, number]; exp: number }
> = {
  // Tutorial wolves: readable fight, not a wall
  wolf: { life: 10, at: 9, pa: 5, ini: 11, focus: 0, damage: [1, 5, 0], exp: 18 },
  orc_raider: { life: 18, at: 12, pa: 8, ini: 9, focus: 0, damage: [1, 8, 2], exp: 25 },
  cultist: { life: 14, at: 9, pa: 7, ini: 10, focus: 8, damage: [1, 6, 0], exp: 20 },
  cave_beast: { life: 22, at: 11, pa: 7, ini: 8, focus: 0, damage: [2, 6, 0], exp: 30 },
  undead: { life: 16, at: 10, pa: 5, ini: 6, focus: 0, damage: [1, 8, 0], exp: 22 },
  frost_wight: { life: 28, at: 13, pa: 9, ini: 11, focus: 12, damage: [1, 10, 2], exp: 45 },
  ash_guardian: { life: 40, at: 14, pa: 10, ini: 8, focus: 0, damage: [2, 8, 2], exp: 80 },
};

export function startCombat(opts: {
  id: string;
  party: Combatant[];
  enemies: Combatant[];
  width?: number;
  height?: number;
  blocked?: Array<{ x: number; y: number }>;
}): CombatState {
  const combatants = [...opts.party, ...opts.enemies];
  const turnOrder = [...combatants]
    .sort((a, b) => b.initiative - a.initiative || a.name.localeCompare(b.name))
    .map((c) => c.id);
  return {
    id: opts.id,
    width: opts.width ?? 10,
    height: opts.height ?? 8,
    blocked: opts.blocked ?? [],
    combatants,
    turnOrder,
    activeId: turnOrder[0],
    round: 1,
    log: ["combat.start"],
  };
}

export interface CombatStepResult {
  state: CombatState;
  notifications: string[];
  ended?: "victory" | "defeat" | "fled";
  loot?: ItemStack[];
  exp?: number;
}

export function applyCombatAction(
  state: CombatState,
  actorId: string,
  action: CombatAction,
  seed: number,
  weaponByActor: Record<string, string | undefined> = {}
): CombatStepResult {
  if (state.activeId !== actorId) {
    return { state, notifications: ["combat.not_your_turn"] };
  }
  const rng = createRng(seed);
  const next: CombatState = {
    ...state,
    combatants: state.combatants.map((c) => ({ ...c, status: [...c.status] })),
    log: [...state.log],
  };
  const actor = next.combatants.find((c) => c.id === actorId);
  if (!actor || actor.life <= 0) return { state, notifications: ["combat.actor_dead"] };

  const notes: string[] = [];

  if (action.kind === "move") {
    if (action.x < 0 || action.y < 0 || action.x >= next.width || action.y >= next.height) {
      return { state, notifications: ["combat.invalid_tile"] };
    }
    if (next.blocked.some((b) => b.x === action.x && b.y === action.y)) {
      return { state, notifications: ["combat.blocked"] };
    }
    if (next.combatants.some((c) => c.life > 0 && c.x === action.x && c.y === action.y)) {
      return { state, notifications: ["combat.occupied"] };
    }
    const dist = Math.abs(action.x - actor.x) + Math.abs(action.y - actor.y);
    if (dist > 3) return { state, notifications: ["combat.move_too_far"] };
    actor.x = action.x;
    actor.y = action.y;
    next.log.push(`combat.move:${actor.name}`);
  } else if (action.kind === "attack") {
    const target = next.combatants.find((c) => c.id === action.targetId);
    if (!target || target.life <= 0 || target.side === actor.side) {
      return { state, notifications: ["combat.bad_target"] };
    }
    // Party weapons from map; enemies use their template damage dice
    const weaponId = weaponByActor[actor.id] ?? (actor.side === "party" ? "longsword" : "unarmed");
    const w = WEAPON_STATS[weaponId] ?? WEAPON_STATS.unarmed;
    const tpl = actor.enemyType ? ENEMY_TEMPLATES[actor.enemyType] : undefined;
    const ranged = w.ranged && !tpl;
    if (!ranged && !isAdjacent(actor, target, true)) {
      return { state, notifications: ["combat.out_of_melee"] };
    }
    if (ranged && !hasLineOfSight(next, actor, target)) {
      return { state, notifications: ["combat.no_los"] };
    }
    let at = actor.at + flankingBonus(next, actor, target);
    if (actor.status.includes("defend")) at -= 2;
    const pa = target.status.includes("defend") ? target.pa + 4 : target.pa;
    const chance = hitChancePercent(at, pa);
    const roll = 1 + Math.floor(rng() * 100);
    if (roll <= chance) {
      const dmg = tpl
        ? dice(rng, tpl.damage[0], tpl.damage[1]) + tpl.damage[2]
        : dice(rng, w.dice, w.sides) + w.bonus;
      target.life = Math.max(0, target.life - dmg);
      next.log.push(`combat.hit:${actor.name}:${target.name}:${dmg}`);
      notes.push(`hit:${dmg}`);
    } else {
      next.log.push(`combat.miss:${actor.name}:${target.name}`);
      notes.push("miss");
    }
  } else if (action.kind === "defend") {
    actor.status = actor.status.filter((s) => s !== "defend");
    actor.status.push("defend");
    next.log.push(`combat.defend:${actor.name}`);
  } else if (action.kind === "wait") {
    next.log.push(`combat.wait:${actor.name}`);
  } else if (action.kind === "flee") {
    const roll = d20(rng);
    if (roll <= actor.initiative / 2 + 5) {
      next.log.push(`combat.fled:${actor.name}`);
      return { state: next, notifications: notes, ended: "fled", loot: [], exp: 0 };
    }
    next.log.push(`combat.flee_fail:${actor.name}`);
    notes.push("combat.flee_fail");
  } else if (action.kind === "cast") {
    const cost = 4;
    if (actor.focus < cost) return { state, notifications: ["combat.no_focus"] };
    actor.focus -= cost;
    const target = action.targetId
      ? next.combatants.find((c) => c.id === action.targetId)
      : actor;
    if (action.spellId === "balm" && target) {
      const heal = dice(rng, 1, 8) + 2;
      target.life = Math.min(target.lifeMax, target.life + heal);
      next.log.push(`combat.heal:${actor.name}:${target.name}:${heal}`);
    } else if (action.spellId === "spark" && target && target.side !== actor.side) {
      if (!hasLineOfSight(next, actor, target)) return { state, notifications: ["combat.no_los"] };
      const dmg = dice(rng, 1, 6) + 2;
      target.life = Math.max(0, target.life - dmg);
      next.log.push(`combat.spark:${actor.name}:${target.name}:${dmg}`);
    } else if (action.spellId === "sleep" && target && target.side !== actor.side) {
      if (rng() < 0.45) {
        target.status.push("sleep");
        next.log.push(`combat.sleep:${target.name}`);
      } else {
        next.log.push(`combat.sleep_fail:${target.name}`);
      }
    } else {
      next.log.push(`combat.cast:${action.spellId}`);
    }
  } else if (action.kind === "item") {
    const itemId = action.itemId;
    if (itemId === "potion_heal") {
      const heal = 8 + dice(rng, 1, 8);
      actor.life = Math.min(actor.lifeMax, actor.life + heal);
      next.log.push(`combat.heal:${actor.name}:${actor.name}:${heal}`);
      notes.push(`heal:${heal}`);
    } else if (itemId === "potion_focus") {
      const gain = 6 + dice(rng, 1, 6);
      actor.focus = Math.min(actor.focusMax, actor.focus + gain);
      next.log.push(`combat.focus:${actor.name}:${gain}`);
      notes.push(`focus:${gain}`);
    } else if (itemId === "ration") {
      const heal = 4;
      actor.life = Math.min(actor.lifeMax, actor.life + heal);
      next.log.push(`combat.heal:${actor.name}:${actor.name}:${heal}`);
      notes.push(`heal:${heal}`);
    } else {
      return { state, notifications: ["combat.bad_item"] };
    }
  }

  // Clear defend on next turn start for others handled below
  actor.status = actor.status.filter((s) => s !== "defend" || action.kind === "defend");

  // Check end
  const partyAlive = next.combatants.some((c) => c.side === "party" && c.life > 0);
  const enemyAlive = next.combatants.some((c) => c.side === "enemy" && c.life > 0);
  if (!partyAlive) {
    return { state: next, notifications: notes, ended: "defeat", loot: [], exp: 0 };
  }
  if (!enemyAlive) {
    const exp = next.combatants
      .filter((c) => c.side === "enemy")
      .reduce((s, c) => s + (ENEMY_TEMPLATES[c.enemyType ?? "wolf"]?.exp ?? 10), 0);
    const loot: ItemStack[] = [{ itemId: "copper_coins", qty: 5 + Math.floor(rng() * 20) }];
    if (rng() < 0.3) loot.push({ itemId: "herb_woundwort", qty: 1 });
    return { state: next, notifications: notes, ended: "victory", loot, exp };
  }

  // Advance turn
  advanceTurn(next);
  return { state: next, notifications: notes };
}

function advanceTurn(state: CombatState): void {
  const alive = new Set(state.combatants.filter((c) => c.life > 0 && !c.status.includes("sleep")).map((c) => c.id));
  // Wake sleepers occasionally handled simply: skip sleepers
  let idx = state.turnOrder.indexOf(state.activeId);
  for (let i = 0; i < state.turnOrder.length; i++) {
    idx = (idx + 1) % state.turnOrder.length;
    if (idx === 0) state.round += 1;
    const id = state.turnOrder[idx];
    if (alive.has(id)) {
      state.activeId = id;
      const c = state.combatants.find((x) => x.id === id);
      if (c) c.status = c.status.filter((s) => s !== "defend");
      return;
    }
    // sleeping: 50% wake each full cycle — simple: remove sleep if skipped twice via round
    const sleeper = state.combatants.find((x) => x.id === id && x.status.includes("sleep"));
    if (sleeper && state.round % 2 === 0) {
      sleeper.status = sleeper.status.filter((s) => s !== "sleep");
    }
  }
}

export function enemyAiAction(state: CombatState, enemyId: string, seed: number): CombatAction {
  const rng = createRng(seed);
  const enemy = state.combatants.find((c) => c.id === enemyId);
  if (!enemy) return { kind: "wait" };
  const foes = state.combatants.filter((c) => c.side === "party" && c.life > 0);
  if (!foes.length) return { kind: "wait" };
  foes.sort((a, b) => {
    const da = Math.abs(a.x - enemy.x) + Math.abs(a.y - enemy.y);
    const db = Math.abs(b.x - enemy.x) + Math.abs(b.y - enemy.y);
    return da - db;
  });
  const target = foes[0];
  if (isAdjacent(enemy, target, true)) {
    return rng() < 0.15 ? { kind: "defend" } : { kind: "attack", targetId: target.id };
  }
  // Move closer
  const opts = neighbors(enemy.x, enemy.y, false).filter(
    (p) =>
      p.x >= 0 &&
      p.y >= 0 &&
      p.x < state.width &&
      p.y < state.height &&
      !state.blocked.some((b) => b.x === p.x && b.y === p.y) &&
      !state.combatants.some((c) => c.life > 0 && c.x === p.x && c.y === p.y)
  );
  opts.sort(
    (a, b) =>
      Math.abs(a.x - target.x) +
      Math.abs(a.y - target.y) -
      (Math.abs(b.x - target.x) + Math.abs(b.y - target.y))
  );
  if (opts[0]) return { kind: "move", x: opts[0].x, y: opts[0].y };
  return { kind: "wait" };
}
