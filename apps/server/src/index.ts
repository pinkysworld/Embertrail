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
} from "@embertrail/rules";
import { DUNGEONS } from "@embertrail/content";
import { getLive, patchLive, setLive, combats } from "./gameState.js";

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
