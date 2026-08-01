import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { HubRoom } from "./rooms/HubRoom.js";
import {
  createGuest,
  listCharacters,
  loadCharacter,
  loginAccount,
  registerAccount,
  saveCharacter,
  sessionAccount,
} from "./db.js";
import { createCharacter, rollAttributes, rollNegatives, ARCHETYPES } from "@embertrail/rules";
import type { ArchetypeId, CharacterSheet } from "@embertrail/shared";
import { randomUUID } from "node:crypto";
import {
  startCombat,
  combatantFromCharacter,
  makeEnemy,
  applyCombatAction,
  enemyAiAction,
  applyTravelToCharacter,
  resolveTravelLeg,
  NODE_BY_ID,
  applyLevelUp,
  ITEMS,
  ALCHEMY_RECIPES,
} from "@embertrail/rules";
import type { ItemStack } from "@embertrail/shared";
import { DUNGEONS, SHOPS, getShop } from "@embertrail/content";
import { getLive, patchLive, setLive, combats } from "./gameState.js";

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

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, name: "embertrail" }));

app.post("/api/auth/guest", (_req, res) => {
  const g = createGuest();
  res.json(g);
});

app.post("/api/auth/register", (req, res) => {
  const { name, password } = req.body ?? {};
  if (!name || !password) return res.status(400).json({ error: "missing" });
  const r = registerAccount(String(name), String(password));
  if (!r.ok) return res.status(400).json({ error: r.error });
  const login = loginAccount(String(name), String(password));
  res.json(login);
});

app.post("/api/auth/login", (req, res) => {
  const { name, password } = req.body ?? {};
  const login = loginAccount(String(name ?? ""), String(password ?? ""));
  if (!login) return res.status(401).json({ error: "invalid" });
  res.json(login);
});

app.get("/api/archetypes", (_req, res) => {
  res.json(ARCHETYPES.map((a) => ({ id: a.id, nameKey: a.nameKey, descKey: a.descKey })));
});

app.post("/api/character/roll", (req, res) => {
  const seed = Number(req.body?.seed ?? Date.now());
  res.json({ attributes: rollAttributes(seed), negatives: rollNegatives(seed), seed });
});

app.post("/api/character/create", (req, res) => {
  const token = String(req.headers.authorization?.replace("Bearer ", "") ?? "");
  const accountId = sessionAccount(token);
  if (!accountId) return res.status(401).json({ error: "auth" });

  const body = req.body ?? {};
  const { character, errors } = createCharacter({
    id: randomUUID(),
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
    return res.status(400).json({ error: "invalid", errors });
  }
  saveCharacter(character);
  setLive(character);
  res.json({ character, errors });
});

app.get("/api/character/list", (req, res) => {
  const token = String(req.headers.authorization?.replace("Bearer ", "") ?? "");
  const accountId = sessionAccount(token);
  if (!accountId) return res.status(401).json({ error: "auth" });
  res.json({ characters: listCharacters(accountId) });
});

app.get("/api/character/:id", (req, res) => {
  const token = String(req.headers.authorization?.replace("Bearer ", "") ?? "");
  const accountId = sessionAccount(token);
  if (!accountId) return res.status(401).json({ error: "auth" });
  const sheet = loadCharacter(req.params.id);
  if (!sheet || sheet.accountId !== accountId) return res.status(404).json({ error: "not_found" });
  setLive(sheet);
  res.json({ character: sheet });
});

app.post("/api/travel", (req, res) => {
  const token = String(req.headers.authorization?.replace("Bearer ", "") ?? "");
  const accountId = sessionAccount(token);
  if (!accountId) return res.status(401).json({ error: "auth" });
  const { characterId, from, to, day } = req.body ?? {};
  const sheet = getLive(characterId) ?? loadCharacter(characterId);
  if (!sheet || sheet.accountId !== accountId) return res.status(404).json({ error: "not_found" });
  const fromNode = NODE_BY_ID[from];
  if (!fromNode?.links.includes(to)) return res.status(400).json({ error: "no_link" });

  const leg = resolveTravelLeg({
    from,
    to,
    day: Number(day ?? 1),
    seed: sheet.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0),
    party: [sheet],
  });
  const { sheet: after, notifications } = applyTravelToCharacter(sheet, leg);
  after.knownMapNodes = [...new Set([...after.knownMapNodes, to, from])];
  after.position = { ...after.position, townId: NODE_BY_ID[to]?.kind === "town" ? to : after.position.townId };
  setLive(after);

  res.json({ character: after, leg, notifications });
});

app.post("/api/combat/start", (req, res) => {
  const token = String(req.headers.authorization?.replace("Bearer ", "") ?? "");
  const accountId = sessionAccount(token);
  if (!accountId) return res.status(401).json({ error: "auth" });
  const { characterId, enemyType, count } = req.body ?? {};
  const sheet = getLive(characterId) ?? loadCharacter(characterId);
  if (!sheet || sheet.accountId !== accountId) return res.status(404).json({ error: "not_found" });

  const party = [combatantFromCharacter(sheet, 1, 3)];
  const n = Math.min(4, Math.max(1, Number(count ?? 2)));
  const enemies = Array.from({ length: n }, (_, i) =>
    makeEnemy(`e_${i}`, String(enemyType ?? "wolf"), `${enemyType ?? "wolf"} ${i + 1}`, 6 + (i % 2), 2 + i, sheet.level)
  );
  const state = startCombat({ id: randomUUID(), party, enemies });
  combats.set(state.id, state);
  res.json({ state });
});

app.post("/api/combat/action", (req, res) => {
  const token = String(req.headers.authorization?.replace("Bearer ", "") ?? "");
  const accountId = sessionAccount(token);
  if (!accountId) return res.status(401).json({ error: "auth" });
  const { combatId, characterId, action } = req.body ?? {};
  let state = combats.get(combatId);
  if (!state) return res.status(404).json({ error: "no_combat" });
  const sheet = getLive(characterId) ?? loadCharacter(characterId);
  if (!sheet || sheet.accountId !== accountId) return res.status(404).json({ error: "not_found" });

  const seed = Date.now() ^ combatId.length * 1000;
  let result = applyCombatAction(state, characterId, action, seed, {
    [characterId]: sheet.equipped.mainHand,
  });
  state = result.state;

  // Run enemy AI until player turn or end
  let guard = 0;
  while (!result.ended && guard++ < 20) {
    const active = state.combatants.find((c) => c.id === state!.activeId);
    if (!active || active.side === "party") break;
    const ai = enemyAiAction(state, active.id, seed + guard * 17);
    result = applyCombatAction(state, active.id, ai, seed + guard * 31);
    state = result.state;
  }

  combats.set(state.id, state);

  if (result.ended === "victory") {
    let next = { ...sheet };
    const partySize = 1;
    const exp = result.exp ?? 0;
    next.exp += exp;
    next = applyLevelUp(next);
    for (const loot of result.loot ?? []) {
      const existing = next.inventory.find((i) => i.itemId === loot.itemId);
      if (existing) existing.qty += loot.qty;
      else next.inventory = [...next.inventory, loot];
    }
    // Sync life from combat
    const me = state.combatants.find((c) => c.id === characterId);
    if (me) {
      next.life = me.life;
      next.focus = me.focus;
    }
    setLive(next);
    combats.delete(state.id);
    return res.json({
      state,
      ended: result.ended,
      character: next,
      loot: result.loot,
      exp,
      notifications: result.notifications,
    });
  }

  if (result.ended === "defeat" || result.ended === "fled") {
    let next = { ...sheet };
    if (result.ended === "defeat") {
      next.life = Math.max(1, Math.floor(next.lifeMax * 0.3));
      next.position = { townId: "rimeport", x: -8, y: 1.6, z: -4, yaw: 0 };
    } else {
      const me = state.combatants.find((c) => c.id === characterId);
      if (me) next.life = me.life;
    }
    setLive(next);
    combats.delete(state.id);
    return res.json({ state, ended: result.ended, character: next, notifications: result.notifications });
  }

  // Update sheet vitals mid-combat
  const me = state.combatants.find((c) => c.id === characterId);
  if (me) patchLive(characterId, { life: me.life, focus: me.focus });

  res.json({ state, notifications: result.notifications });
});

app.post("/api/dungeon/enter", (req, res) => {
  const token = String(req.headers.authorization?.replace("Bearer ", "") ?? "");
  const accountId = sessionAccount(token);
  if (!accountId) return res.status(401).json({ error: "auth" });
  const { characterId, dungeonId, roomId } = req.body ?? {};
  const dungeon = DUNGEONS[dungeonId];
  if (!dungeon) return res.status(404).json({ error: "no_dungeon" });
  const sheet = getLive(characterId) ?? loadCharacter(characterId);
  if (!sheet || sheet.accountId !== accountId) return res.status(404).json({ error: "not_found" });
  const room = dungeon.rooms.find((r) => r.id === (roomId || dungeon.rooms[0].id)) ?? dungeon.rooms[0];
  patchLive(characterId, {
    position: { dungeonId, x: 0, y: 1.6, z: 8, yaw: Math.PI, townId: undefined },
    knownMapNodes: [...new Set([...sheet.knownMapNodes, dungeonId])],
  });
  res.json({ dungeon, room, character: getLive(characterId) });
});

app.post("/api/dungeon/feature", (req, res) => {
  const token = String(req.headers.authorization?.replace("Bearer ", "") ?? "");
  const accountId = sessionAccount(token);
  if (!accountId) return res.status(401).json({ error: "auth" });
  const { characterId, dungeonId, roomId, featureId, choice } = req.body ?? {};
  const dungeon = DUNGEONS[dungeonId];
  const room = dungeon?.rooms.find((r) => r.id === roomId);
  const feature = room?.features.find((f) => f.id === featureId);
  const sheet = getLive(characterId) ?? loadCharacter(characterId);
  if (!feature || !sheet || sheet.accountId !== accountId) return res.status(404).json({ error: "not_found" });

  let next: CharacterSheet = { ...sheet, inventory: [...sheet.inventory], questFlags: { ...sheet.questFlags } };
  const notifications: string[] = [];

  if (feature.kind === "greed") {
    if (choice === "take_all") {
      next.inventory.push({ itemId: "copper_coins", qty: 50 });
      next.life = Math.max(1, next.life - 5);
      notifications.push("notify.item_gained");
      // Greed summons extra danger — client should start combat
      next.questFlags.mine_greed = "all";
    } else {
      next.inventory.push({ itemId: "copper_coins", qty: 10 });
      next.questFlags.mine_greed = "need";
      notifications.push("notify.item_gained");
    }
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

  setLive(next);
  res.json({ character: next, notifications, feature });
});

app.post("/api/camp", (req, res) => {
  const token = String(req.headers.authorization?.replace("Bearer ", "") ?? "");
  const accountId = sessionAccount(token);
  if (!accountId) return res.status(401).json({ error: "auth" });
  const { characterId } = req.body ?? {};
  const sheet = getLive(characterId) ?? loadCharacter(characterId);
  if (!sheet || sheet.accountId !== accountId) return res.status(404).json({ error: "not_found" });
  if (sheet.rations < 1) return res.status(400).json({ error: "no_rations", character: sheet });
  const next = {
    ...sheet,
    rations: sheet.rations - 1,
    life: Math.min(sheet.lifeMax, sheet.life + 6),
    focus: Math.min(sheet.focusMax, sheet.focus + 4),
  };
  setLive(next);
  res.json({ character: next });
});

app.get("/api/shops/:townId", (req, res) => {
  const shops = SHOPS[req.params.townId];
  if (!shops) return res.status(404).json({ error: "no_town" });
  res.json({ townId: req.params.townId, shops });
});

app.post("/api/shop/buy", (req, res) => {
  const token = String(req.headers.authorization?.replace("Bearer ", "") ?? "");
  const accountId = sessionAccount(token);
  if (!accountId) return res.status(401).json({ error: "auth" });
  const { characterId, townId, shopId, itemId, qty: rawQty } = req.body ?? {};
  const sheet = getLive(characterId) ?? loadCharacter(characterId);
  if (!sheet || sheet.accountId !== accountId) return res.status(404).json({ error: "not_found" });

  const shop = getShop(String(townId), String(shopId));
  if (!shop) return res.status(404).json({ error: "no_shop" });

  const qty = Math.max(1, Math.min(99, Number(rawQty ?? 1)));
  const notifications: string[] = [];
  const next: CharacterSheet = {
    ...sheet,
    inventory: cloneInventory(sheet.inventory),
    equipped: { ...sheet.equipped },
  };

  // Service purchase (heal / weapon upgrade) — itemId is the service id
  const service = shop.services?.find((s) => s.id === String(itemId));
  if (service) {
    if (wealthCopper(next) < service.priceCopper) {
      return res.status(400).json({ error: "not_enough_coin", character: sheet, notifications: ["notify.not_enough_coin"] });
    }
    applyWealthCopper(next, wealthCopper(next) - service.priceCopper);
    if (service.kind === "heal") {
      next.life = next.lifeMax;
      next.focus = next.focusMax;
      next.diseases = [];
      notifications.push("notify.healed");
    } else if (service.kind === "upgrade") {
      const weaponId = next.equipped.mainHand;
      if (!weaponId) return res.status(400).json({ error: "no_weapon" });
      const stack = next.inventory.find((i) => i.itemId === weaponId);
      if (stack) {
        stack.quality = Math.min(5, (stack.quality ?? 0) + 1);
        stack.durability = 100;
      } else {
        // equipped but not stacked — track quality via inventory entry
        next.inventory = addItem(next.inventory, weaponId, 1);
        const s = next.inventory.find((i) => i.itemId === weaponId)!;
        s.quality = 1;
        s.durability = 100;
      }
      notifications.push("notify.weapon_upgraded");
    }
    setLive(next);
    return res.json({ character: next, notifications, service: service.id, priceCopper: service.priceCopper });
  }

  const stock = shop.stock?.find((s) => s.itemId === String(itemId));
  if (!stock) return res.status(404).json({ error: "no_item" });
  if (stock.qty !== -1 && stock.qty < qty) return res.status(400).json({ error: "out_of_stock" });

  const def = ITEMS[String(itemId)];
  if (!def) return res.status(404).json({ error: "unknown_item" });
  const unitPrice = stock.priceCopper ?? def.valueCopper;
  const total = unitPrice * qty;
  if (wealthCopper(next) < total) {
    return res.status(400).json({ error: "not_enough_coin", character: sheet, notifications: ["notify.not_enough_coin"] });
  }

  applyWealthCopper(next, wealthCopper(next) - total);
  next.inventory = addItem(next.inventory, String(itemId), qty);
  applyRationGain(next, String(itemId), qty);
  notifications.push("notify.item_gained");

  setLive(next);
  res.json({
    character: next,
    notifications,
    itemId: String(itemId),
    qty,
    priceCopper: total,
    gained: [{ itemId: String(itemId), qty }],
  });
});

app.post("/api/shop/sell", (req, res) => {
  const token = String(req.headers.authorization?.replace("Bearer ", "") ?? "");
  const accountId = sessionAccount(token);
  if (!accountId) return res.status(401).json({ error: "auth" });
  const { characterId, itemId, qty: rawQty } = req.body ?? {};
  const sheet = getLive(characterId) ?? loadCharacter(characterId);
  if (!sheet || sheet.accountId !== accountId) return res.status(404).json({ error: "not_found" });

  const qty = Math.max(1, Math.min(99, Number(rawQty ?? 1)));
  const def = ITEMS[String(itemId)];
  if (!def) return res.status(404).json({ error: "unknown_item" });
  if (def.kind === "quest" || def.valueCopper <= 0) {
    return res.status(400).json({ error: "unsellable" });
  }

  const removed = removeItem(sheet.inventory, String(itemId), qty);
  if (!removed) return res.status(400).json({ error: "not_enough_items" });

  const next: CharacterSheet = {
    ...sheet,
    inventory: removed,
    equipped: { ...sheet.equipped },
  };

  // Unequip if fully sold
  if (!next.inventory.some((i) => i.itemId === String(itemId))) {
    for (const slot of Object.keys(next.equipped) as (keyof typeof next.equipped)[]) {
      if (next.equipped[slot] === String(itemId)) next.equipped[slot] = undefined;
    }
  }

  const saleCopper = Math.floor(def.valueCopper * 0.5) * qty;
  applyWealthCopper(next, wealthCopper(next) + saleCopper);

  // Selling ration packs reduces tracked rations
  if (def.rations) {
    next.rations = Math.max(0, next.rations - def.rations * qty);
  }

  const notifications = ["notify.item_lost"];
  setLive(next);
  res.json({
    character: next,
    notifications,
    itemId: String(itemId),
    qty,
    priceCopper: saleCopper,
    lost: [{ itemId: String(itemId), qty }],
  });
});

app.post("/api/quest/turnin", (req, res) => {
  const token = String(req.headers.authorization?.replace("Bearer ", "") ?? "");
  const accountId = sessionAccount(token);
  if (!accountId) return res.status(401).json({ error: "auth" });
  const { characterId, questId, choice } = req.body ?? {};
  const sheet = getLive(characterId) ?? loadCharacter(characterId);
  if (!sheet || sheet.accountId !== accountId) return res.status(404).json({ error: "not_found" });

  const next: CharacterSheet = {
    ...sheet,
    inventory: cloneInventory(sheet.inventory),
    questFlags: { ...sheet.questFlags },
    journal: [...sheet.journal],
  };
  const notifications: string[] = [];
  const townId = next.position.townId;

  if (questId === "pactcinder") {
    if (next.questFlags.pactcinder === "alliance" || next.questFlags.pactcinder === "sold" || next.questFlags.pactcinder === 3) {
      return res.status(400).json({ error: "already_complete", character: sheet });
    }
    const hasShard = next.inventory.some((i) => i.itemId === "pactcinder" && i.qty >= 1);
    if (!hasShard) return res.status(400).json({ error: "missing_item", itemId: "pactcinder" });

    if (choice === "alliance") {
      if (townId !== "irondeep") return res.status(400).json({ error: "wrong_town", need: "irondeep" });
      const inv = removeItem(next.inventory, "pactcinder", 1);
      if (!inv) return res.status(400).json({ error: "missing_item", itemId: "pactcinder" });
      next.inventory = inv;
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
      if (townId !== "mirehold") return res.status(400).json({ error: "wrong_town", need: "mirehold" });
      const inv = removeItem(next.inventory, "pactcinder", 1);
      if (!inv) return res.status(400).json({ error: "missing_item", itemId: "pactcinder" });
      next.inventory = inv;
      next.questFlags.pactcinder = "sold";
      // Merchant pays a thousand silver → 100 gold at 10s = 1g, use 50 gold as MVP reward
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
      return res.status(400).json({ error: "bad_choice", choices: ["alliance", "sell"] });
    }
  } else if (questId === "foxbrand") {
    if (next.questFlags.foxbrand === "complete" || next.questFlags.foxbrand === 3) {
      return res.status(400).json({ error: "already_complete", character: sheet });
    }
    const hasAxe = next.inventory.some((i) => i.itemId === "foxbrand_axe" && i.qty >= 1);
    if (!hasAxe) return res.status(400).json({ error: "missing_item", itemId: "foxbrand_axe" });
    // Keep the axe as reward weapon; mark quest complete
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
  } else {
    return res.status(404).json({ error: "unknown_quest" });
  }

  const leveled = applyLevelUp(next);
  setLive(leveled);
  res.json({
    character: leveled,
    notifications,
    questId: String(questId),
    choice: choice ?? null,
    lost: questId === "pactcinder" ? [{ itemId: "pactcinder", qty: 1 }] : [],
  });
});

app.post("/api/alchemy/brew", (req, res) => {
  const token = String(req.headers.authorization?.replace("Bearer ", "") ?? "");
  const accountId = sessionAccount(token);
  if (!accountId) return res.status(401).json({ error: "auth" });
  const { characterId, recipeId } = req.body ?? {};
  const sheet = getLive(characterId) ?? loadCharacter(characterId);
  if (!sheet || sheet.accountId !== accountId) return res.status(404).json({ error: "not_found" });

  const recipe = ALCHEMY_RECIPES.find((r) => r.id === String(recipeId));
  if (!recipe) return res.status(404).json({ error: "unknown_recipe" });

  const skill = sheet.skills.alchemy ?? 0;
  if (skill < recipe.skillMin) {
    return res.status(400).json({ error: "need_skill", skillMin: recipe.skillMin, skill, notifications: ["alchemy.need_skill"] });
  }

  let inv = cloneInventory(sheet.inventory);
  const lost: ItemStack[] = [];
  for (const ing of recipe.ingredients) {
    const nextInv = removeItem(inv, ing.itemId, ing.qty);
    if (!nextInv) {
      return res.status(400).json({
        error: "missing_ingredients",
        missing: ing.itemId,
        notifications: ["alchemy.missing_ingredients"],
      });
    }
    inv = nextInv;
    lost.push({ itemId: ing.itemId, qty: ing.qty });
  }

  inv = addItem(inv, recipe.result.itemId, recipe.result.qty);
  const next: CharacterSheet = { ...sheet, inventory: inv };
  const notifications = ["notify.item_lost", "notify.item_gained", "alchemy.success"];
  setLive(next);
  res.json({
    character: next,
    notifications,
    recipeId: recipe.id,
    lost,
    gained: [{ itemId: recipe.result.itemId, qty: recipe.result.qty }],
  });
});

const httpServer = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("hub", HubRoom).filterBy(["townId"]);

const PORT = Number(process.env.PORT ?? 2567);
httpServer.listen(PORT, () => {
  console.log(`Embertrail server on http://localhost:${PORT}`);
  console.log(`API health: http://localhost:${PORT}/api/health`);
});
