/**
 * Client-side offline API for GitHub Pages solo play.
 * Uses packages/rules + localStorage — no Node server required.
 */
import type { ArchetypeId, CharacterSheet, CombatState } from "@embertrail/shared";
import {
  createCharacter,
  rollAttributes,
  rollNegatives,
  ARCHETYPES,
  startCombat,
  combatantFromCharacter,
  makeEnemy,
  applyCombatAction,
  enemyAiAction,
  resolveTravelLeg,
  applyTravelToCharacter,
  NODE_BY_ID,
  applyLevelUp,
  campRest,
} from "@embertrail/rules";
import { DUNGEONS } from "@embertrail/content";

const STORAGE_KEY = "embertrail_offline_char";
const COMBAT_KEY = "embertrail_offline_combat";

function uid(): string {
  return crypto.randomUUID();
}

function loadChar(): CharacterSheet | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CharacterSheet) : null;
  } catch {
    return null;
  }
}

function saveChar(sheet: CharacterSheet): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sheet));
}

function loadCombat(): CombatState | null {
  try {
    const raw = localStorage.getItem(COMBAT_KEY);
    return raw ? (JSON.parse(raw) as CombatState) : null;
  } catch {
    return null;
  }
}

function saveCombat(state: CombatState | null): void {
  if (!state) localStorage.removeItem(COMBAT_KEY);
  else localStorage.setItem(COMBAT_KEY, JSON.stringify(state));
}

export function isOfflineMode(): boolean {
  // GitHub Pages or explicit flag
  if (location.hostname.endsWith("github.io")) return true;
  if (localStorage.getItem("embertrail_offline") === "1") return true;
  return false;
}

export async function offlineApi(path: string, opts: RequestInit = {}): Promise<any> {
  const method = (opts.method || "GET").toUpperCase();
  let body: any = {};
  if (opts.body) {
    try {
      body = JSON.parse(String(opts.body));
    } catch {
      body = {};
    }
  }

  if (path === "/api/health") return { ok: true, name: "embertrail", mode: "offline" };

  if (path === "/api/auth/guest" && method === "POST") {
    const name = `Wanderer_${Math.floor(Math.random() * 9000 + 1000)}`;
    const token = uid();
    localStorage.setItem("embertrail_offline_token", token);
    localStorage.setItem("embertrail_offline_account", name);
    return { token, accountId: token, name };
  }

  if (path === "/api/auth/register" && method === "POST") {
    const token = uid();
    localStorage.setItem("embertrail_offline_token", token);
    return { token, accountId: token };
  }

  if (path === "/api/auth/login" && method === "POST") {
    const token = localStorage.getItem("embertrail_offline_token") || uid();
    return { token, accountId: token };
  }

  if (path === "/api/archetypes") {
    return ARCHETYPES.map((a) => ({ id: a.id, nameKey: a.nameKey, descKey: a.descKey }));
  }

  if (path === "/api/character/roll" && method === "POST") {
    const seed = Number(body.seed ?? Date.now());
    return { attributes: rollAttributes(seed), negatives: rollNegatives(seed), seed };
  }

  if (path === "/api/character/create" && method === "POST") {
    const accountId = localStorage.getItem("embertrail_offline_token") || uid();
    const { character, errors } = createCharacter({
      id: uid(),
      accountId,
      name: String(body.name || "Hero"),
      gender: body.gender === "f" ? "f" : "m",
      archetype: body.archetype as ArchetypeId,
      attributes: body.attributes,
      negatives: body.negatives,
      skillSpends: body.skillSpends ?? {},
      atBias: Number(body.atBias ?? 0),
    });
    if (errors.includes("creation.mins_not_met") || errors.includes("creation.over_budget")) {
      throw new Error("invalid");
    }
    saveChar(character);
    return { character, errors };
  }

  if (path.startsWith("/api/character/") && method === "GET") {
    const id = path.split("/").pop();
    const sheet = loadChar();
    if (!sheet || (id && id !== "list" && sheet.id !== id)) throw new Error("not_found");
    if (id === "list") return { characters: sheet ? [{ id: sheet.id, name: sheet.name }] : [] };
    return { character: sheet };
  }

  if (path === "/api/travel" && method === "POST") {
    const sheet = loadChar();
    if (!sheet || sheet.id !== body.characterId) throw new Error("not_found");
    const from = body.from;
    const to = body.to;
    const fromNode = NODE_BY_ID[from];
    if (!fromNode?.links.includes(to)) throw new Error("no_link");
    const leg = resolveTravelLeg({
      from,
      to,
      day: Number(body.day ?? 1),
      seed: sheet.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0),
      party: [sheet],
    });
    const { sheet: after, notifications } = applyTravelToCharacter(sheet, leg);
    after.knownMapNodes = [...new Set([...after.knownMapNodes, to, from])];
    if (NODE_BY_ID[to]?.kind === "town") {
      after.position = { ...after.position, townId: to, dungeonId: undefined };
    }
    saveChar(after);
    return { character: after, leg, notifications };
  }

  if (path === "/api/combat/start" && method === "POST") {
    const sheet = loadChar();
    if (!sheet || sheet.id !== body.characterId) throw new Error("not_found");
    const party = [combatantFromCharacter(sheet, 1, 3)];
    const n = Math.min(4, Math.max(1, Number(body.count ?? 2)));
    const enemyType = String(body.enemyType ?? "wolf");
    const enemies = Array.from({ length: n }, (_, i) =>
      makeEnemy(`e_${i}`, enemyType, `${enemyType} ${i + 1}`, 6 + (i % 2), 2 + i, sheet.level)
    );
    const state = startCombat({ id: uid(), party, enemies });
    saveCombat(state);
    return { state };
  }

  if (path === "/api/combat/action" && method === "POST") {
    let state = loadCombat();
    if (!state || state.id !== body.combatId) throw new Error("no_combat");
    const sheet = loadChar();
    if (!sheet || sheet.id !== body.characterId) throw new Error("not_found");
    const seed = Date.now() ^ body.combatId.length * 1000;
    let result = applyCombatAction(state, body.characterId, body.action, seed, {
      [body.characterId]: sheet.equipped.mainHand,
    });
    state = result.state;
    let guard = 0;
    while (!result.ended && guard++ < 20) {
      const active = state.combatants.find((c) => c.id === state!.activeId);
      if (!active || active.side === "party") break;
      const ai = enemyAiAction(state, active.id, seed + guard * 17);
      result = applyCombatAction(state, active.id, ai, seed + guard * 31);
      state = result.state;
    }
    saveCombat(state);

    if (result.ended === "victory") {
      let next = { ...sheet };
      next.exp += result.exp ?? 0;
      next = applyLevelUp(next);
      for (const loot of result.loot ?? []) {
        const existing = next.inventory.find((i) => i.itemId === loot.itemId);
        if (existing) existing.qty += loot.qty;
        else next.inventory = [...next.inventory, loot];
      }
      const me = state.combatants.find((c) => c.id === body.characterId);
      if (me) {
        next.life = me.life;
        next.focus = me.focus;
      }
      saveChar(next);
      saveCombat(null);
      return {
        state,
        ended: result.ended,
        character: next,
        loot: result.loot,
        exp: result.exp,
        notifications: result.notifications,
      };
    }

    if (result.ended === "defeat" || result.ended === "fled") {
      let next = { ...sheet };
      if (result.ended === "defeat") {
        next.life = Math.max(1, Math.floor(next.lifeMax * 0.3));
        next.position = { townId: "rimeport", x: -8, y: 1.6, z: -4, yaw: 0 };
      } else {
        const me = state.combatants.find((c) => c.id === body.characterId);
        if (me) next.life = me.life;
      }
      saveChar(next);
      saveCombat(null);
      return { state, ended: result.ended, character: next, notifications: result.notifications };
    }

    const me = state.combatants.find((c) => c.id === body.characterId);
    if (me) {
      const next = { ...sheet, life: me.life, focus: me.focus };
      saveChar(next);
    }
    return { state, notifications: result.notifications };
  }

  if (path === "/api/dungeon/enter" && method === "POST") {
    const dungeon = DUNGEONS[body.dungeonId];
    if (!dungeon) throw new Error("no_dungeon");
    const sheet = loadChar();
    if (!sheet || sheet.id !== body.characterId) throw new Error("not_found");
    const room = dungeon.rooms.find((r) => r.id === (body.roomId || dungeon.rooms[0].id)) ?? dungeon.rooms[0];
    const next = {
      ...sheet,
      position: {
        dungeonId: body.dungeonId,
        x: 0,
        y: 1.6,
        z: 8,
        yaw: Math.PI,
        townId: undefined,
      },
      knownMapNodes: [...new Set([...sheet.knownMapNodes, body.dungeonId])],
    };
    saveChar(next);
    return { dungeon, room, character: next };
  }

  if (path === "/api/dungeon/feature" && method === "POST") {
    const dungeon = DUNGEONS[body.dungeonId];
    const room = dungeon?.rooms.find((r) => r.id === body.roomId);
    const feature = room?.features.find((f) => f.id === body.featureId);
    const sheet = loadChar();
    if (!feature || !sheet || sheet.id !== body.characterId) throw new Error("not_found");
    let next: CharacterSheet = {
      ...sheet,
      inventory: [...sheet.inventory],
      questFlags: { ...sheet.questFlags },
    };
    const notifications: string[] = [];
    if (feature.kind === "greed") {
      if (body.choice === "take_all") {
        next.inventory.push({ itemId: "copper_coins", qty: 50 });
        next.life = Math.max(1, next.life - 5);
        next.questFlags.mine_greed = "all";
      } else {
        next.inventory.push({ itemId: "copper_coins", qty: 10 });
        next.questFlags.mine_greed = "need";
      }
      notifications.push("notify.item_gained");
    }
    if (feature.kind === "boss" || feature.kind === "chest") {
      const loot = String(feature.data?.loot ?? "");
      if (loot && !next.inventory.some((i) => i.itemId === loot)) {
        next.inventory.push({ itemId: loot, qty: 1 });
        notifications.push("notify.item_gained");
        if (loot === "pactcinder") {
          next.questFlags.pactcinder = 2;
          next.journal = [
            ...next.journal,
            {
              id: "j_shard_found",
              questId: "pactcinder",
              titleKey: "journal.pactcinder.title",
              bodyKey: "journal.pactcinder.body",
              timestamp: Date.now(),
              clue: true,
            },
          ];
        }
        if (loot === "foxbrand_axe") next.questFlags.foxbrand = 2;
      }
    }
    saveChar(next);
    return { character: next, notifications, feature };
  }

  if (path === "/api/camp" && method === "POST") {
    const sheet = loadChar();
    if (!sheet || sheet.id !== body.characterId) throw new Error("not_found");
    if (sheet.rations < 1) {
      const err: any = new Error("no_rations");
      err.character = sheet;
      throw err;
    }
    const rested = campRest(sheet, true, Date.now());
    const next = { ...rested, rations: sheet.rations - 1 };
    saveChar(next);
    return { character: next };
  }

  if (path === "/api/archetypes") {
    return ARCHETYPES.map((a) => ({ id: a.id, nameKey: a.nameKey, descKey: a.descKey }));
  }

  throw new Error(`offline: unknown path ${path}`);
}
