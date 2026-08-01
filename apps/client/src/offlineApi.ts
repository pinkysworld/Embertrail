/**
 * Client-side offline API for GitHub Pages solo play.
 * Uses packages/rules + localStorage — no Node server required.
 */
import type { ArchetypeId, CharacterSheet, CombatState, ItemStack } from "@embertrail/shared";
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
  ITEMS,
  ALCHEMY_RECIPES,
} from "@embertrail/rules";
import { DUNGEONS, SHOPS, getShop, QUESTS, getQuestStep, questStepIndex } from "@embertrail/content";

/** Currency: 1 gold = 100 copper, 1 silver = 10 copper */
function wealthCopper(sheet: CharacterSheet): number {
  return sheet.gold * 100 + sheet.silver * 10 + sheet.copper;
}

function applyWealthCopper(sheet: CharacterSheet, total: number): void {
  const t = Math.max(0, Math.floor(total));
  sheet.gold = Math.floor(t / 100);
  sheet.silver = Math.floor((t % 100) / 10);
  sheet.copper = t % 10;
}

function cloneInventory(inv: ItemStack[]): ItemStack[] {
  return inv.map((i) => ({ ...i }));
}

function addItem(inv: ItemStack[], itemId: string, qty: number): ItemStack[] {
  const next = cloneInventory(inv);
  const existing = next.find((i) => i.itemId === itemId);
  if (existing) existing.qty += qty;
  else next.push({ itemId, qty });
  return next;
}

function removeItem(inv: ItemStack[], itemId: string, qty: number): ItemStack[] | null {
  const next = cloneInventory(inv);
  const idx = next.findIndex((i) => i.itemId === itemId);
  if (idx < 0 || next[idx].qty < qty) return null;
  next[idx].qty -= qty;
  if (next[idx].qty <= 0) next.splice(idx, 1);
  return next;
}

function applyRationGain(sheet: CharacterSheet, itemId: string, qty: number): void {
  const def = ITEMS[itemId];
  if (def?.rations) sheet.rations += def.rations * qty;
}

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
      let next: CharacterSheet = {
        ...sheet,
        inventory: cloneInventory(sheet.inventory),
        questFlags: { ...sheet.questFlags },
        journal: [...sheet.journal],
      };
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
      const foughtWolves = state.combatants.some((c) => c.side === "enemy" && c.enemyType === "wolf");
      if (
        foughtWolves &&
        next.questFlags.wolves &&
        next.questFlags.wolves !== "complete" &&
        next.questFlags.wolves !== 3 &&
        Number(next.questFlags.wolves) < 2
      ) {
        next.questFlags.wolves = 2;
        next.questFlags["wolves:clear_pack"] = true;
        next.questFlags.wolves_step = "clear_pack";
        next.journal.push({
          id: `j_wolves_clear_${Date.now()}`,
          questId: "wolves",
          titleKey: "quest.wolves.step.clear_pack.title",
          bodyKey: "quest.wolves.step.clear_pack.body",
          timestamp: Date.now(),
          clue: true,
        });
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
        if (loot === "cult_sigil") {
          if (!next.questFlags.cult_sigil) next.questFlags.cult_sigil = 1;
          next.questFlags.cult_sigil = 2;
        }
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

  if (path.startsWith("/api/shops/") && method === "GET") {
    const townId = path.split("/").pop()!;
    const shops = SHOPS[townId];
    if (!shops) throw new Error("no_town");
    return { townId, shops };
  }

  if (path === "/api/shop/buy" && method === "POST") {
    const sheet = loadChar();
    if (!sheet || sheet.id !== body.characterId) throw new Error("not_found");
    const shop = getShop(String(body.townId), String(body.shopId));
    if (!shop) throw new Error("no_shop");
    const qty = Math.max(1, Math.min(99, Number(body.qty ?? 1)));
    const notifications: string[] = [];
    const next: CharacterSheet = {
      ...sheet,
      inventory: cloneInventory(sheet.inventory),
      equipped: { ...sheet.equipped },
    };

    const service = shop.services?.find((s) => s.id === String(body.itemId));
    if (service) {
      if (wealthCopper(next) < service.priceCopper) {
        const err: any = new Error("not_enough_coin");
        err.character = sheet;
        err.notifications = ["notify.not_enough_coin"];
        throw err;
      }
      applyWealthCopper(next, wealthCopper(next) - service.priceCopper);
      if (service.kind === "heal") {
        next.life = next.lifeMax;
        next.focus = next.focusMax;
        next.diseases = [];
        notifications.push("notify.healed");
      } else if (service.kind === "upgrade") {
        const weaponId = next.equipped.mainHand;
        if (!weaponId) throw new Error("no_weapon");
        const stack = next.inventory.find((i) => i.itemId === weaponId);
        if (stack) {
          stack.quality = Math.min(5, (stack.quality ?? 0) + 1);
          stack.durability = 100;
        } else {
          next.inventory = addItem(next.inventory, weaponId, 1);
          const s = next.inventory.find((i) => i.itemId === weaponId)!;
          s.quality = 1;
          s.durability = 100;
        }
        notifications.push("notify.weapon_upgraded");
      }
      saveChar(next);
      return { character: next, notifications, service: service.id, priceCopper: service.priceCopper };
    }

    const stock = shop.stock?.find((s) => s.itemId === String(body.itemId));
    if (!stock) throw new Error("no_item");
    if (stock.qty !== -1 && stock.qty < qty) throw new Error("out_of_stock");
    const def = ITEMS[String(body.itemId)];
    if (!def) throw new Error("unknown_item");
    const unitPrice = stock.priceCopper ?? def.valueCopper;
    const total = unitPrice * qty;
    if (wealthCopper(next) < total) {
      const err: any = new Error("not_enough_coin");
      err.character = sheet;
      err.notifications = ["notify.not_enough_coin"];
      throw err;
    }
    applyWealthCopper(next, wealthCopper(next) - total);
    next.inventory = addItem(next.inventory, String(body.itemId), qty);
    applyRationGain(next, String(body.itemId), qty);
    notifications.push("notify.item_gained");
    saveChar(next);
    return {
      character: next,
      notifications,
      itemId: String(body.itemId),
      qty,
      priceCopper: total,
      gained: [{ itemId: String(body.itemId), qty }],
    };
  }

  if (path === "/api/shop/sell" && method === "POST") {
    const sheet = loadChar();
    if (!sheet || sheet.id !== body.characterId) throw new Error("not_found");
    const qty = Math.max(1, Math.min(99, Number(body.qty ?? 1)));
    const def = ITEMS[String(body.itemId)];
    if (!def) throw new Error("unknown_item");
    if (def.kind === "quest" || def.valueCopper <= 0) throw new Error("unsellable");
    const removed = removeItem(sheet.inventory, String(body.itemId), qty);
    if (!removed) throw new Error("not_enough_items");
    const next: CharacterSheet = {
      ...sheet,
      inventory: removed,
      equipped: { ...sheet.equipped },
    };
    if (!next.inventory.some((i) => i.itemId === String(body.itemId))) {
      for (const slot of Object.keys(next.equipped) as (keyof typeof next.equipped)[]) {
        if (next.equipped[slot] === String(body.itemId)) next.equipped[slot] = undefined;
      }
    }
    const saleCopper = Math.floor(def.valueCopper * 0.5) * qty;
    applyWealthCopper(next, wealthCopper(next) + saleCopper);
    if (def.rations) next.rations = Math.max(0, next.rations - def.rations * qty);
    saveChar(next);
    return {
      character: next,
      notifications: ["notify.item_lost"],
      itemId: String(body.itemId),
      qty,
      priceCopper: saleCopper,
      lost: [{ itemId: String(body.itemId), qty }],
    };
  }

  if (path === "/api/quest/progress" && method === "POST") {
    const sheet = loadChar();
    if (!sheet || sheet.id !== body.characterId) throw new Error("not_found");
    const qid = String(body.questId ?? "");
    const sid = String(body.stepId ?? "");
    const quest = QUESTS[qid];
    const step = getQuestStep(qid, sid);
    if (!quest || !step) throw new Error("unknown_step");

    const flag = sheet.questFlags[qid];
    if (flag === "complete" || flag === "alliance" || flag === "sold" || flag === 3) {
      throw new Error("already_complete");
    }
    if (step.requires) {
      for (const [k, v] of Object.entries(step.requires)) {
        const cur = sheet.questFlags[k];
        if (typeof v === "number" && typeof cur === "number") {
          if (cur < v) throw new Error("requires_not_met");
        } else if (cur !== v) {
          throw new Error("requires_not_met");
        }
      }
    }

    const next: CharacterSheet = {
      ...sheet,
      inventory: cloneInventory(sheet.inventory),
      questFlags: { ...sheet.questFlags },
      journal: [...sheet.journal],
    };
    const notifications = ["notify.quest_update"];
    const stepIdx = questStepIndex(qid, sid);
    const cur = next.questFlags[qid];
    const curNum = typeof cur === "number" ? cur : 0;

    next.questFlags[`${qid}:${sid}`] = true;
    next.questFlags[`${qid}_step`] = sid;
    if (!cur || cur === 0) next.questFlags[qid] = 1;
    else if (typeof cur === "number" && stepIdx > curNum) next.questFlags[qid] = stepIdx;

    if (qid === "wolves" && sid === "clear_pack") next.questFlags.wolves = 2;
    if (qid === "pactcinder" && sid === "hear_envoy") {
      if (!next.questFlags.pactcinder) next.questFlags.pactcinder = 1;
      next.knownMapNodes = [...new Set([...next.knownMapNodes, "mine_ash_entrance", "road_south"])];
    }
    if (qid === "foxbrand" && sid === "tavern_rumor" && !next.questFlags.foxbrand) next.questFlags.foxbrand = 1;
    if (qid === "foxbrand" && sid === "smith_mooniron") next.questFlags.foxbrand_smith = true;
    if (qid === "herbs" && sid === "herbalist_plea" && !next.questFlags.herbs) next.questFlags.herbs = 1;
    if (qid === "cult_sigil" && sid === "temple_whisper" && !next.questFlags.cult_sigil) next.questFlags.cult_sigil = 1;
    if (qid === "cult_sigil" && sid === "recover_sigil") {
      if (!next.inventory.some((i) => i.itemId === "cult_sigil" && i.qty >= 1)) throw new Error("missing_item");
      next.questFlags.cult_sigil = 2;
    }
    if (qid === "pactcinder" && sid === "defeat_guardian") {
      if (next.inventory.some((i) => i.itemId === "pactcinder" && i.qty >= 1)) next.questFlags.pactcinder = 2;
    }
    if (qid === "foxbrand" && sid === "claim_axe") {
      if (next.inventory.some((i) => i.itemId === "foxbrand_axe" && i.qty >= 1)) next.questFlags.foxbrand = 2;
    }

    next.journal.push({
      id: `j_${qid}_${sid}_${Date.now()}`,
      questId: qid,
      titleKey: step.titleKey,
      bodyKey: step.bodyKey,
      timestamp: Date.now(),
      clue: true,
    });

    saveChar(next);
    return {
      character: next,
      notifications,
      questId: qid,
      stepId: sid,
      stepIndex: stepIdx,
    };
  }

  if (path === "/api/quest/turnin" && method === "POST") {
    const sheet = loadChar();
    if (!sheet || sheet.id !== body.characterId) throw new Error("not_found");
    const questId = body.questId;
    const choice = body.choice;
    const next: CharacterSheet = {
      ...sheet,
      inventory: cloneInventory(sheet.inventory),
      questFlags: { ...sheet.questFlags },
      journal: [...sheet.journal],
      equipped: { ...sheet.equipped },
    };
    const notifications: string[] = [];
    const townId = next.position.townId;
    const lost: ItemStack[] = [];

    const terminal = (f: number | boolean | string | undefined) =>
      f === "complete" || f === "alliance" || f === "sold" || f === 3;

    if (questId === "pactcinder") {
      if (terminal(next.questFlags.pactcinder)) throw new Error("already_complete");
      const hasShard = next.inventory.some((i) => i.itemId === "pactcinder" && i.qty >= 1);
      if (!hasShard) throw new Error("missing_item");
      if (choice === "alliance") {
        if (townId !== "irondeep") throw new Error("wrong_town");
        const inv = removeItem(next.inventory, "pactcinder", 1);
        if (!inv) throw new Error("missing_item");
        next.inventory = inv;
        lost.push({ itemId: "pactcinder", qty: 1 });
        next.questFlags.pactcinder = "alliance";
        next.exp += 100;
        next.gold += 5;
        notifications.push("notify.item_lost", "notify.quest_complete", "notify.exp");
        next.journal.push({
          id: `j_pactcinder_alliance_${Date.now()}`,
          questId: "pactcinder",
          titleKey: "quest.pactcinder.ending.alliance.title",
          bodyKey: "quest.pactcinder.ending.alliance",
          timestamp: Date.now(),
          clue: true,
        });
      } else if (choice === "sell") {
        if (townId !== "mirehold") throw new Error("wrong_town");
        const inv = removeItem(next.inventory, "pactcinder", 1);
        if (!inv) throw new Error("missing_item");
        next.inventory = inv;
        lost.push({ itemId: "pactcinder", qty: 1 });
        next.questFlags.pactcinder = "sold";
        next.gold += 50;
        next.exp += 40;
        notifications.push("notify.item_lost", "notify.quest_complete", "notify.exp");
        next.journal.push({
          id: `j_pactcinder_sell_${Date.now()}`,
          questId: "pactcinder",
          titleKey: "quest.pactcinder.ending.sell.title",
          bodyKey: "quest.pactcinder.ending.sell",
          timestamp: Date.now(),
          clue: true,
        });
      } else {
        throw new Error("bad_choice");
      }
    } else if (questId === "foxbrand") {
      if (terminal(next.questFlags.foxbrand)) throw new Error("already_complete");
      const hasAxe = next.inventory.some((i) => i.itemId === "foxbrand_axe" && i.qty >= 1);
      if (!hasAxe) throw new Error("missing_item");
      next.questFlags.foxbrand = "complete";
      next.exp += 80;
      next.gold += 10;
      if (!next.equipped.mainHand) next.equipped = { ...next.equipped, mainHand: "foxbrand_axe" };
      notifications.push("notify.quest_complete", "notify.exp");
      next.journal.push({
        id: `j_foxbrand_done_${Date.now()}`,
        questId: "foxbrand",
        titleKey: "quest.foxbrand.ending.title",
        bodyKey: "quest.foxbrand.ending",
        timestamp: Date.now(),
        clue: true,
      });
    } else if (questId === "wolves") {
      if (terminal(next.questFlags.wolves)) throw new Error("already_complete");
      if (Number(next.questFlags.wolves ?? 0) < 2) throw new Error("need_progress");
      if (townId !== "rimeport") throw new Error("wrong_town");
      next.questFlags.wolves = "complete";
      next.gold += 8;
      next.exp += 30;
      notifications.push("notify.quest_complete", "notify.exp");
      next.journal.push({
        id: `j_wolves_done_${Date.now()}`,
        questId: "wolves",
        titleKey: "quest.wolves.ending.title",
        bodyKey: "quest.wolves.ending",
        timestamp: Date.now(),
        clue: true,
      });
    } else if (questId === "herbs") {
      if (terminal(next.questFlags.herbs)) throw new Error("already_complete");
      if (townId !== "oakspire") throw new Error("wrong_town");
      const needed = ["herb_woundwort", "herb_frostleaf", "herb_emberroot"] as const;
      for (const herb of needed) {
        if (!next.inventory.some((i) => i.itemId === herb && i.qty >= 1)) throw new Error("missing_item");
      }
      let inv = next.inventory;
      for (const herb of needed) {
        const removed = removeItem(inv, herb, 1);
        if (!removed) throw new Error("missing_item");
        inv = removed;
        lost.push({ itemId: herb, qty: 1 });
      }
      next.inventory = inv;
      next.questFlags.herbs = "complete";
      next.gold += 12;
      next.exp += 40;
      notifications.push("notify.item_lost", "notify.quest_complete", "notify.exp");
      next.journal.push({
        id: `j_herbs_done_${Date.now()}`,
        questId: "herbs",
        titleKey: "quest.herbs.ending.title",
        bodyKey: "quest.herbs.ending",
        timestamp: Date.now(),
        clue: true,
      });
    } else if (questId === "cult_sigil") {
      if (terminal(next.questFlags.cult_sigil)) throw new Error("already_complete");
      if (townId !== "rimeport") throw new Error("wrong_town");
      const inv = removeItem(next.inventory, "cult_sigil", 1);
      if (!inv) throw new Error("missing_item");
      next.inventory = inv;
      lost.push({ itemId: "cult_sigil", qty: 1 });
      next.questFlags.cult_sigil = "complete";
      next.life = next.lifeMax;
      next.focus = next.focusMax;
      next.exp += 50;
      notifications.push("notify.item_lost", "notify.healed", "notify.quest_complete", "notify.exp");
      next.journal.push({
        id: `j_cult_sigil_done_${Date.now()}`,
        questId: "cult_sigil",
        titleKey: "quest.cult_sigil.ending.title",
        bodyKey: "quest.cult_sigil.ending",
        timestamp: Date.now(),
        clue: true,
      });
    } else {
      throw new Error("unknown_quest");
    }

    const leveled = applyLevelUp(next);
    saveChar(leveled);
    return {
      character: leveled,
      notifications,
      questId: String(questId),
      choice: choice ?? null,
      lost,
    };
  }

  if (path === "/api/alchemy/brew" && method === "POST") {
    const sheet = loadChar();
    if (!sheet || sheet.id !== body.characterId) throw new Error("not_found");
    const recipe = ALCHEMY_RECIPES.find((r) => r.id === String(body.recipeId));
    if (!recipe) throw new Error("unknown_recipe");
    const skill = sheet.skills.alchemy ?? 0;
    if (skill < recipe.skillMin) throw new Error("need_skill");
    let inv = cloneInventory(sheet.inventory);
    const lost: ItemStack[] = [];
    for (const ing of recipe.ingredients) {
      const nextInv = removeItem(inv, ing.itemId, ing.qty);
      if (!nextInv) throw new Error("missing_ingredients");
      inv = nextInv;
      lost.push({ itemId: ing.itemId, qty: ing.qty });
    }
    inv = addItem(inv, recipe.result.itemId, recipe.result.qty);
    const next: CharacterSheet = { ...sheet, inventory: inv };
    saveChar(next);
    return {
      character: next,
      notifications: ["notify.item_lost", "notify.item_gained", "alchemy.success"],
      recipeId: recipe.id,
      lost,
      gained: [{ itemId: recipe.result.itemId, qty: recipe.result.qty }],
    };
  }

  if (path === "/api/archetypes") {
    return ARCHETYPES.map((a) => ({ id: a.id, nameKey: a.nameKey, descKey: a.descKey }));
  }

  throw new Error(`offline: unknown path ${path}`);
}
