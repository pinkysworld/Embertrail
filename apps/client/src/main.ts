import * as THREE from "three";
import { Client } from "colyseus.js";
import type { CharacterSheet, CombatState, Locale } from "@embertrail/shared";
import { ARCHETYPES, SKILLS, NODE_BY_ID, TRAVEL_GRAPH, hitChancePercent } from "@embertrail/rules";
import { DUNGEONS, TOWNS } from "@embertrail/content";
import { t, getLocale, setLocale, toggleLocale } from "./i18n";
import { WorldScene } from "./game/world";
import { CombatScene } from "./game/combatScene";
import { PlayerController } from "./game/player";
import { isOfflineMode, offlineApi } from "./offlineApi";
import { SHOPS } from "@embertrail/content";
import { ALCHEMY_RECIPES } from "@embertrail/rules";

const API = "";
const WS_URL = `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:2567`;
const OFFLINE = isOfflineMode();

let token = localStorage.getItem("embertrail_token") ?? "";
let character: CharacterSheet | null = null;
let combat: CombatState | null = null;
let mode: "title" | "create" | "explore" | "travel" | "combat" | "dialogue" | "dungeon" = "title";
let dialogue: { npcId: string; textKey: string; topics: string[] } | null = null;
let travelDay = 1;
let dungeonId: string | null = null;
let roomId: string | null = null;
let roomClient: Awaited<ReturnType<Client["joinOrCreate"]>> | null = null;

const app = document.getElementById("app")!;
app.innerHTML = `
  <canvas id="game-canvas"></canvas>
  <div class="crosshair" id="crosshair"></div>
  <div class="interact-prompt hidden" id="interact-prompt"></div>
  <div id="hud" class="hidden">
    <div class="panel bars">
      <div id="hud-name"></div>
      <div class="bar life"><i id="life-bar" style="width:100%"></i></div>
      <div class="bar focus"><i id="focus-bar" style="width:100%"></i></div>
      <div id="hud-meta" style="font-size:0.8rem;margin-top:4px;color:#b8a88a"></div>
    </div>
    <div class="panel" id="hud-right" style="font-size:0.85rem"></div>
  </div>
  <div id="chat-box" class="panel hidden">
    <div id="chat-log"></div>
    <input id="chat-input" maxlength="200" placeholder="..." />
  </div>
  <div id="mode-bar" class="hidden"></div>
  <div id="notify-stack"></div>
  <div id="title-screen">
    <button class="btn lang-toggle" id="lang-btn">EN / DE</button>
    <h1 id="title-h1"></h1>
    <p id="title-sub"></p>
    <div class="title-actions">
      <button class="btn primary" id="btn-guest"></button>
      <button class="btn" id="btn-create"></button>
    </div>
  </div>
  <div id="create-screen" class="panel center-panel hidden" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,94vw);max-height:90vh;overflow:auto;z-index:16"></div>
  <div id="center-panel" class="panel hidden"></div>
  <div id="combat-ui" class="panel hidden" style="position:absolute;right:12px;top:80px;width:min(320px,40vw);z-index:12"></div>
`;

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const world = new WorldScene();
const combatScene = new CombatScene(true);
const player = new PlayerController(canvas);
const otherPlayers = new Map<string, THREE.Mesh>();

function resize(): void {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  world.setSize(w, h);
  combatScene.mount(w, h);
}
addEventListener("resize", resize);
resize();
combatScene.attachOrbit(canvas);

// Title art background
const titleScreen = document.getElementById("title-screen")!;
titleScreen.style.backgroundImage = `linear-gradient(rgba(10,8,6,0.55), rgba(10,8,6,0.85)), url(${import.meta.env.BASE_URL}ui/title_bg.jpg)`;
titleScreen.style.backgroundSize = "cover";
titleScreen.style.backgroundPosition = "center";

function notify(text: string, kind = "info"): void {
  const el = document.createElement("div");
  el.className = "notify";
  el.textContent = text;
  if (kind === "warn") el.style.borderColor = "#8b2e2e";
  if (kind === "quest") el.style.borderColor = "#b8860b";
  document.getElementById("notify-stack")!.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

function refreshI18nChrome(): void {
  (document.getElementById("title-h1") as HTMLElement).textContent = t("app.title");
  (document.getElementById("title-sub") as HTMLElement).textContent = t("app.subtitle");
  (document.getElementById("btn-guest") as HTMLElement).textContent = t("ui.play");
  (document.getElementById("btn-create") as HTMLElement).textContent = t("ui.create");
  (document.getElementById("lang-btn") as HTMLElement).textContent =
    getLocale() === "en" ? "Deutsch" : "English";
  (document.getElementById("chat-input") as HTMLInputElement).placeholder = t("ui.chat");
}

document.getElementById("lang-btn")!.onclick = () => {
  toggleLocale();
  refreshI18nChrome();
  if (mode === "create") renderCreate();
  updateHud();
  renderModeBar();
};

async function api(path: string, opts: RequestInit = {}): Promise<any> {
  if (OFFLINE) {
    return offlineApi(path, opts);
  }
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(opts.headers as Record<string, string>),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API}${path}`, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  } catch (e) {
    // Fall back to offline solo if server unreachable (e.g. static GitHub Pages)
    console.warn("API failed, using offline mode", e);
    return offlineApi(path, opts);
  }
}

// ——— Character creation ———
let createState = {
  name: "",
  gender: "m" as "m" | "f",
  archetype: "steelguard" as string,
  attributes: null as CharacterSheet["attributes"] | null,
  negatives: null as CharacterSheet["negatives"] | null,
  skillSpends: {} as Record<string, number>,
  seed: Date.now(),
};

async function rollCreate(): Promise<void> {
  const data = await api("/api/character/roll", {
    method: "POST",
    body: JSON.stringify({ seed: Date.now() }),
  });
  createState.attributes = data.attributes;
  createState.negatives = data.negatives;
  createState.seed = data.seed;
  renderCreate();
}

function pointsUsed(): number {
  return Object.values(createState.skillSpends).reduce((a, b) => a + b, 0);
}

function renderCreate(): void {
  const el = document.getElementById("create-screen")!;
  el.classList.remove("hidden");
  const arch = ARCHETYPES.find((a) => a.id === createState.archetype)!;
  const attrs = createState.attributes;
  const portraitUrl = `${import.meta.env.BASE_URL}portraits/${createState.archetype}_${createState.gender}.png`;
  el.innerHTML = `
    <h2>${t("ui.create")}</h2>
    <div class="grid-form">
      <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:8px">
        <img src="${portraitUrl}" alt="" width="96" height="96" style="border:2px solid var(--border);border-radius:4px;object-fit:cover;background:#1a1510" onerror="this.style.display='none'" />
        <div style="flex:1">
      <label>${t("create.name")}</label>
      <input id="cr-name" value="${createState.name}" maxlength="24" />
      <label>${t("create.gender")}</label>
      <select id="cr-gender">
        <option value="m" ${createState.gender === "m" ? "selected" : ""}>${t("create.gender.m")}</option>
        <option value="f" ${createState.gender === "f" ? "selected" : ""}>${t("create.gender.f")}</option>
      </select>
      <label>${t("create.archetype")}</label>
      <select id="cr-arch">
        ${ARCHETYPES.map(
          (a) =>
            `<option value="${a.id}" ${a.id === createState.archetype ? "selected" : ""}>${t(a.nameKey)}</option>`
        ).join("")}
      </select>
        </div>
      </div>
      <p style="font-size:0.85rem;color:#b8a88a">${t(arch.descKey)}</p>
      <h3>${t("create.attrs")}</h3>
      <div class="attr-grid" id="cr-attrs"></div>
      <button class="btn" id="cr-roll">${t("create.roll")}</button>
      <h3>${t("create.negatives")}</h3>
      <div class="attr-grid" id="cr-negs"></div>
      <h3>${t("create.skills")} <span id="cr-pts"></span></h3>
      <div class="skill-list" id="cr-skills"></div>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn" id="cr-back">${t("ui.back")}</button>
        <button class="btn primary" id="cr-start">${t("create.start")}</button>
      </div>
    </div>
  `;
  if (attrs) {
    document.getElementById("cr-attrs")!.innerHTML = Object.entries(attrs)
      .map(([k, v]) => `<div><div>${t(`attr.${k}`)}</div><strong>${v}</strong></div>`)
      .join("");
  }
  if (createState.negatives) {
    document.getElementById("cr-negs")!.innerHTML = Object.entries(createState.negatives)
      .map(([k, v]) => `<div><div>${k}</div><strong>${v}</strong></div>`)
      .join("");
  }
  const bias = new Set(arch.skillBias);
  document.getElementById("cr-skills")!.innerHTML = SKILLS.filter(
    (s) => bias.has(s.id) || createState.skillSpends[s.id]
  )
    .concat(SKILLS.filter((s) => !bias.has(s.id)).slice(0, 8))
    .filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i)
    .map((s) => {
      const v = createState.skillSpends[s.id] ?? 0;
      return `<div class="skill-row"><span>${t(s.nameKey)}</span>
        <span>
          <button data-sk="${s.id}" data-d="-1" class="btn sk-btn">−</button>
          ${v}
          <button data-sk="${s.id}" data-d="1" class="btn sk-btn">+</button>
        </span></div>`;
    })
    .join("");
  document.getElementById("cr-pts")!.textContent = `(${t("create.points_left")}: ${20 - pointsUsed()})`;

  (document.getElementById("cr-name") as HTMLInputElement).oninput = (e) => {
    createState.name = (e.target as HTMLInputElement).value;
  };
  (document.getElementById("cr-gender") as HTMLSelectElement).onchange = (e) => {
    createState.gender = (e.target as HTMLSelectElement).value as "m" | "f";
  };
  (document.getElementById("cr-arch") as HTMLSelectElement).onchange = (e) => {
    createState.archetype = (e.target as HTMLSelectElement).value;
    renderCreate();
  };
  document.getElementById("cr-roll")!.onclick = () => rollCreate();
  document.getElementById("cr-back")!.onclick = () => {
    el.classList.add("hidden");
    mode = "title";
    document.getElementById("title-screen")!.classList.remove("hidden");
  };
  el.querySelectorAll(".sk-btn").forEach((btn) => {
    (btn as HTMLButtonElement).onclick = () => {
      const id = (btn as HTMLElement).dataset.sk!;
      const d = Number((btn as HTMLElement).dataset.d);
      const cur = createState.skillSpends[id] ?? 0;
      const next = Math.max(0, Math.min(3, cur + d));
      const used = pointsUsed() - cur + next;
      if (used > 20) return;
      createState.skillSpends[id] = next;
      renderCreate();
    };
  });
  document.getElementById("cr-start")!.onclick = async () => {
    if (!createState.attributes || !createState.negatives) await rollCreate();
    try {
      if (!token) {
        const g = await api("/api/auth/guest", { method: "POST" });
        token = g.token;
        localStorage.setItem("embertrail_token", token);
      }
      const data = await api("/api/character/create", {
        method: "POST",
        body: JSON.stringify({
          name: createState.name || "Hero",
          gender: createState.gender,
          archetype: createState.archetype,
          attributes: createState.attributes,
          negatives: createState.negatives,
          skillSpends: createState.skillSpends,
        }),
      });
      character = data.character;
      el.classList.add("hidden");
      await enterGame();
    } catch (e: any) {
      notify(String(e.message || e), "warn");
    }
  };
}

async function ensureGuestAndQuickStart(): Promise<void> {
  try {
    const g = await api("/api/auth/guest", { method: "POST" });
    token = g.token;
    localStorage.setItem("embertrail_token", token);
    const roll = await api("/api/character/roll", { method: "POST", body: "{}" });
    // Pick first valid archetype that matches rolls by rerolling if needed
    let attributes = roll.attributes;
    let negatives = roll.negatives;
    let archetype = "steelguard";
    for (let i = 0; i < 30; i++) {
      const r = await api("/api/character/roll", { method: "POST", body: JSON.stringify({ seed: Date.now() + i }) });
      attributes = r.attributes;
      negatives = r.negatives;
      for (const a of ARCHETYPES) {
        const ok = Object.entries(a.minAttrs).every(
          ([k, v]) => attributes[k as keyof typeof attributes] >= (v as number)
        );
        if (ok) {
          archetype = a.id;
          break;
        }
      }
      if (archetype) break;
    }
    // Force high attrs for quickstart if still failing mins
    attributes = { cou: 13, cle: 13, int: 13, cha: 12, dex: 13, agi: 12, con: 13, str: 13 };
    const data = await api("/api/character/create", {
      method: "POST",
      body: JSON.stringify({
        name: g.name?.replace("Wanderer", "Hero") ?? "Hero",
        gender: "m",
        archetype: "steelguard",
        attributes,
        negatives,
        skillSpends: { swords: 3, shields: 2, endurance: 2, perception: 2, survival: 2 },
      }),
    });
    character = data.character;
    await enterGame();
  } catch (e: any) {
    notify(String(e.message || e), "warn");
  }
}

async function enterGame(): Promise<void> {
  if (!character) return;
  mode = "explore";
  document.getElementById("title-screen")!.classList.add("hidden");
  document.getElementById("hud")!.classList.remove("hidden");
  document.getElementById("chat-box")!.classList.remove("hidden");
  document.getElementById("mode-bar")!.classList.remove("hidden");
  document.getElementById("crosshair")!.classList.remove("hidden");

  const townId = character.position.townId || "rimeport";
  world.loadTown(townId);
  player.position.set(character.position.x, 1.6, character.position.z);
  player.yaw = character.position.yaw;
  player.enabled = true;
  updateHud();
  renderModeBar();

  try {
    const client = new Client(WS_URL);
    roomClient = await client.joinOrCreate("hub", { townId, character });
    roomClient.onMessage("chat", (msg: any) => {
      const log = document.getElementById("chat-log")!;
      const line = document.createElement("div");
      line.textContent = `[${msg.message.channel}] ${msg.message.from}: ${msg.message.text}`;
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    });
    roomClient.onMessage("player_joined", (msg: any) => {
      if (msg.player.id === character!.id) return;
      addOther(msg.player);
    });
    roomClient.onMessage("player_left", (msg: any) => {
      const m = otherPlayers.get(msg.id);
      if (m) {
        world.scene.remove(m);
        otherPlayers.delete(msg.id);
      }
    });
    roomClient.onMessage("player_moved", (msg: any) => {
      let m = otherPlayers.get(msg.id);
      if (!m) {
        addOther({ id: msg.id, name: "?", archetype: "steelguard", x: msg.x, y: msg.y, z: msg.z, yaw: msg.yaw });
        m = otherPlayers.get(msg.id);
      }
      if (m) {
        m.position.set(msg.x, 1.1, msg.z);
        m.rotation.y = msg.yaw;
      }
    });
    roomClient.onMessage("hub_state", (msg: any) => {
      for (const p of msg.players) {
        if (p.id !== character!.id) addOther(p);
      }
    });
    roomClient.onMessage("dialogue", (msg: any) => {
      dialogue = msg;
      showDialogue();
    });
    roomClient.onMessage("notification", (msg: any) => {
      notify(t(msg.textKey, msg.args), msg.kind);
    });
    roomClient.onMessage("character_update", (msg: any) => {
      if (msg.character) {
        character = { ...character!, ...msg.character };
        updateHud();
      }
    });
    roomClient.onMessage("welcome", (msg: any) => {
      character = msg.character;
      updateHud();
    });
  } catch (e) {
    console.warn("Multiplayer unavailable, solo mode", e);
    notify("Solo mode (server WS optional)", "info");
  }

  player.onInteract = () => tryInteract();
  notify(t("journal.arrival.body").slice(0, 80) + "…", "quest");
}

function addOther(p: { id: string; name?: string; archetype?: string; x: number; y: number; z: number; yaw: number }): void {
  if (otherPlayers.has(p.id)) return;
  const m = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x4a6fa5 })
  );
  m.position.set(p.x, 1.1, p.z);
  world.scene.add(m);
  otherPlayers.set(p.id, m);
}

function updateHud(): void {
  if (!character) return;
  (document.getElementById("hud-name") as HTMLElement).textContent =
    `${character.name} · ${t("ui.level")} ${character.level} · ${t(`arch.${character.archetype}`)}`;
  (document.getElementById("life-bar") as HTMLElement).style.width =
    `${(100 * character.life) / character.lifeMax}%`;
  (document.getElementById("focus-bar") as HTMLElement).style.width = character.focusMax
    ? `${(100 * character.focus) / character.focusMax}%`
    : "0%";
  (document.getElementById("hud-meta") as HTMLElement).textContent =
    `${t("ui.life")} ${character.life}/${character.lifeMax} · ${t("ui.focus")} ${character.focus}/${character.focusMax} · ${t("ui.rations")} ${character.rations} · ${t("ui.gold")} ${character.gold}g ${character.silver}s`;
  (document.getElementById("hud-right") as HTMLElement).textContent =
    character.position.dungeonId
      ? `${t("mode.explore")} · ${character.position.dungeonId}`
      : `${t("mode.explore")} · ${t(`place.${character.position.townId || "rimeport"}`)}`;
}

function renderModeBar(): void {
  const bar = document.getElementById("mode-bar")!;
  const buttons: Array<[string, string, () => void]> = [
    ["journal", t("ui.journal"), showJournal],
    ["map", t("ui.map"), showMap],
    ["travel", t("ui.travel"), showTravel],
    ["camp", t("ui.camp"), () => void doCamp()],
    ["inventory", t("ui.inventory"), showInventory],
    ["shop", t("ui.shop") || "Shop", () => void showShop()],
    ["quest", t("ui.quests") || "Quests", showQuestPanel],
  ];
  bar.innerHTML = buttons.map(([, label]) => `<button class="btn">${label}</button>`).join("");
  bar.querySelectorAll("button").forEach((b, i) => {
    (b as HTMLButtonElement).onclick = () => buttons[i][2]();
  });
}

function showPanel(html: string): void {
  const p = document.getElementById("center-panel")!;
  p.classList.remove("hidden");
  p.innerHTML = html + `<div style="margin-top:10px"><button class="btn" id="panel-close">${t("ui.close")}</button></div>`;
  document.getElementById("panel-close")!.onclick = () => p.classList.add("hidden");
}

function showJournal(): void {
  if (!character) return;
  showPanel(
    `<h2>${t("ui.journal")}</h2>` +
      character.journal
        .map(
          (j) =>
            `<div style="margin:8px 0;border-bottom:1px solid #6b5a45;padding-bottom:6px">
          <strong>${t(j.titleKey)}</strong>
          <div style="font-size:0.9rem;color:#c4b49a">${t(j.bodyKey)}</div>
        </div>`
        )
        .join("")
  );
}

function showMap(): void {
  if (!character) return;
  const nodes = TRAVEL_GRAPH.filter((n) => character!.knownMapNodes.includes(n.id) || n.kind === "town");
  showPanel(
    `<h2>${t("ui.map")}</h2>
    <div style="font-size:0.9rem">${nodes.map((n) => `• ${t(n.nameKey)} (${n.kind})`).join("<br>")}</div>
    <p style="color:#b8a88a;font-size:0.85rem;margin-top:8px">${t("ui.travel")}: ${character.knownMapNodes.join(", ")}</p>`
  );
}

function showInventory(): void {
  if (!character) return;
  showPanel(
    `<h2>${t("ui.inventory")}</h2>
    <div style="font-size:0.9rem">${character.inventory
      .map((i) => `• ${t(`item.${i.itemId}`) || i.itemId} ×${i.qty}${i.durability != null ? ` (${i.durability}%)` : ""}`)
      .join("<br>")}</div>
    <h3 style="margin-top:12px">${t("ui.skills")}</h3>
    <div class="skill-list">${Object.entries(character.skills)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `<div class="skill-row"><span>${t(`skill.${k}`)}</span><span>${v}</span></div>`)
      .join("")}</div>`
  );
}

async function doCamp(): Promise<void> {
  if (!character) return;
  const recipes = ALCHEMY_RECIPES.map(
    (r) =>
      `<button class="btn" data-recipe="${r.id}">${t(r.nameKey) || r.id}</button>`
  ).join(" ");
  showPanel(
    `<h2>${t("ui.camp")}</h2>
    <p>${t("ui.rations")}: ${character.rations}</p>
    <button class="btn primary" id="camp-rest">${t("ui.camp")} / Rest</button>
    <h3 style="margin-top:12px">${t("skill.alchemy")}</h3>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${recipes}</div>`
  );
  document.getElementById("camp-rest")!.onclick = async () => {
    try {
      const data = await api("/api/camp", {
        method: "POST",
        body: JSON.stringify({ characterId: character!.id }),
      });
      character = data.character;
      updateHud();
      notify(t("ui.camp") + " — +" + t("ui.life"));
      document.getElementById("center-panel")!.classList.add("hidden");
    } catch {
      notify(t("travel.starving"), "warn");
    }
  };
  document.querySelectorAll("[data-recipe]").forEach((btn) => {
    (btn as HTMLButtonElement).onclick = async () => {
      try {
        const data = await api("/api/alchemy/brew", {
          method: "POST",
          body: JSON.stringify({
            characterId: character!.id,
            recipeId: (btn as HTMLElement).dataset.recipe,
          }),
        });
        character = data.character;
        updateHud();
        notify(t("notify.item_gained", { item: data.gained?.itemId || "potion" }), "quest");
      } catch (e: any) {
        notify(String(e.message || e), "warn");
      }
    };
  });
}

async function showShop(): Promise<void> {
  if (!character) return;
  const townId = character.position.townId || "rimeport";
  let shops = SHOPS[townId] || [];
  try {
    const data = await api(`/api/shops/${townId}`);
    if (data.shops) shops = data.shops;
  } catch {
    /* use local SHOPS */
  }
  if (!shops.length) {
    notify(t("shop.none") || "No shops here.", "warn");
    return;
  }
  let html = `<h2>${t("ui.shop") || "Shop"} — ${t(`place.${townId}`)}</h2>`;
  for (const shop of shops) {
    html += `<h3>${t(shop.nameKey) || shop.id}</h3><div style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px">`;
    for (const stock of shop.stock || []) {
      html += `<button class="btn" data-buy="${shop.id}" data-item="${stock.itemId}">${t(`item.${stock.itemId}`) || stock.itemId} (${stock.priceCopper ?? "?"}c)</button>`;
    }
    for (const svc of shop.services || []) {
      html += `<button class="btn" data-buy="${shop.id}" data-item="${svc.id}">${t(svc.nameKey) || svc.id} (${svc.priceCopper}c)</button>`;
    }
    html += `</div>`;
  }
  html += `<h3>${t("ui.sell") || "Sell"}</h3><div style="display:flex;flex-direction:column;gap:4px">`;
  for (const inv of character.inventory.filter((i) => !["pactcinder", "foxbrand_axe", "mine_key", "cult_sigil", "fake_pactcinder"].includes(i.itemId))) {
    html += `<button class="btn" data-sell="${inv.itemId}">${t(`item.${inv.itemId}`) || inv.itemId} ×${inv.qty}</button>`;
  }
  html += `</div>`;
  showPanel(html);
  document.querySelectorAll("[data-buy]").forEach((btn) => {
    (btn as HTMLButtonElement).onclick = async () => {
      try {
        const data = await api("/api/shop/buy", {
          method: "POST",
          body: JSON.stringify({
            characterId: character!.id,
            townId,
            shopId: (btn as HTMLElement).dataset.buy,
            itemId: (btn as HTMLElement).dataset.item,
            qty: 1,
          }),
        });
        character = data.character;
        updateHud();
        notify(t("notify.item_gained", { item: data.itemId || data.service || "ok" }), "quest");
        void showShop();
      } catch (e: any) {
        notify(String(e.message || e), "warn");
      }
    };
  });
  document.querySelectorAll("[data-sell]").forEach((btn) => {
    (btn as HTMLButtonElement).onclick = async () => {
      try {
        const data = await api("/api/shop/sell", {
          method: "POST",
          body: JSON.stringify({
            characterId: character!.id,
            itemId: (btn as HTMLElement).dataset.sell,
            qty: 1,
          }),
        });
        character = data.character;
        updateHud();
        notify(t("notify.item_lost", { item: data.lost?.itemId || "?" }));
        void showShop();
      } catch (e: any) {
        notify(String(e.message || e), "warn");
      }
    };
  });
}

function showQuestPanel(): void {
  if (!character) return;
  const hasPact = character.inventory.some((i) => i.itemId === "pactcinder");
  const hasFox = character.inventory.some((i) => i.itemId === "foxbrand_axe");
  const town = character.position.townId || "";
  showPanel(
    `<h2>${t("ui.quests") || "Quests"}</h2>
    <div style="font-size:0.9rem;margin-bottom:10px">
      <p><strong>${t("quest.pactcinder.name")}</strong>: ${character.questFlags.pactcinder ?? 0}
      ${hasPact ? " — " + (t("quest.pactcinder.ready") || "You carry the Pact Cinder.") : ""}</p>
      <p><strong>${t("quest.foxbrand.name")}</strong>: ${character.questFlags.foxbrand ?? 0}
      ${hasFox ? " — " + (t("quest.foxbrand.ready") || "You hold the Foxbrand Axe.") : ""}</p>
    </div>
    ${
      hasPact && town === "irondeep"
        ? `<button class="btn primary" id="q-alliance">${t("quest.pactcinder.alliance") || "Deliver to alliance (Irondeep)"}</button>`
        : ""
    }
    ${
      hasPact && town === "mirehold"
        ? `<button class="btn danger" id="q-sell">${t("quest.pactcinder.sell") || "Sell to merchant (Mirehold)"}</button>`
        : ""
    }
    ${
      hasFox
        ? `<button class="btn primary" id="q-fox">${t("quest.foxbrand.turnin") || "Complete Foxbrand quest"}</button>`
        : ""
    }
    ${
      !hasPact && !hasFox
        ? `<p style="color:#b8a88a">${t("quest.hint") || "Speak to envoys, taverns, and clear dungeons."}</p>`
        : ""
    }`
  );
  const alliance = document.getElementById("q-alliance");
  if (alliance)
    alliance.onclick = () => void turnInQuest("pactcinder", "alliance");
  const sell = document.getElementById("q-sell");
  if (sell) sell.onclick = () => void turnInQuest("pactcinder", "sell");
  const fox = document.getElementById("q-fox");
  if (fox) fox.onclick = () => void turnInQuest("foxbrand");
}

async function turnInQuest(questId: string, choice?: string): Promise<void> {
  if (!character) return;
  try {
    const data = await api("/api/quest/turnin", {
      method: "POST",
      body: JSON.stringify({ characterId: character.id, questId, choice }),
    });
    character = data.character;
    updateHud();
    notify(t("notify.quest_update"), "quest");
    if (data.notifications) {
      for (const n of data.notifications) {
        try {
          notify(t(n));
        } catch {
          notify(n);
        }
      }
    }
    document.getElementById("center-panel")!.classList.add("hidden");
  } catch (e: any) {
    notify(String(e.message || e), "warn");
  }
}

function showTravel(): void {
  if (!character) return;
  const here =
    character.position.dungeonId
      ? null
      : NODE_BY_ID[character.position.townId || "rimeport"] || NODE_BY_ID.rimeport;
  // Also allow from known wilderness nodes - use last town
  const fromId = character.position.townId || "rimeport";
  const node = NODE_BY_ID[fromId];
  if (!node) return;
  const links = node.links
    .map((id) => NODE_BY_ID[id])
    .filter(Boolean);
  showPanel(
    `<h2>${t("ui.travel")}</h2>
    <p>${t(node.nameKey)} · ${t("ui.day")} ${travelDay} · ${t("ui.rations")} ${character.rations}</p>
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
      ${links
        .map(
          (n) =>
            `<button class="btn" data-to="${n!.id}">→ ${t(n!.nameKey)}</button>`
        )
        .join("")}
    </div>
    <div style="margin-top:10px">
      <button class="btn" data-to="mine_ash_entrance">→ ${t("place.mine_ash")}</button>
    </div>`
  );
  document.querySelectorAll("#center-panel [data-to]").forEach((btn) => {
    (btn as HTMLButtonElement).onclick = async () => {
      const to = (btn as HTMLElement).dataset.to!;
      await doTravel(fromId, to);
    };
  });
}

async function doTravel(from: string, to: string): Promise<void> {
  if (!character) return;
  // Special: dungeon entrances
  if (to === "mine_ash_entrance" || to.endsWith("_entrance")) {
    document.getElementById("center-panel")!.classList.add("hidden");
    // travel leg first if needed
    try {
      if (from !== to && NODE_BY_ID[from]?.links.includes(to)) {
        const data = await api("/api/travel", {
          method: "POST",
          body: JSON.stringify({ characterId: character.id, from, to, day: travelDay }),
        });
        character = data.character;
        travelDay++;
        for (const n of data.notifications ?? []) notify(t(n));
        if (data.leg?.event?.kind === "combat") {
          await startCombat("wolf", 2);
          return;
        }
      }
    } catch {
      /* direct enter */
    }
    const dungeonKey =
      to === "mine_ash_entrance"
        ? "mine_ash"
        : to === "cult_cellars_entrance"
          ? "cult_cellars"
          : to === "ice_crypt_entrance"
            ? "ice_crypt"
            : "mine_ash";
    await enterDungeon(dungeonKey);
    return;
  }

  try {
    // If link missing but both towns, route via crossroads
    let pathFrom = from;
    if (!NODE_BY_ID[from]?.links.includes(to)) {
      // try multi-hop simple
      if (NODE_BY_ID[from]?.links.includes("road_south") && to === "crossroads_ash") {
        pathFrom = from;
      }
    }
    const data = await api("/api/travel", {
      method: "POST",
      body: JSON.stringify({ characterId: character.id, from: pathFrom, to, day: travelDay }),
    });
    character = data.character;
    travelDay++;
    for (const n of data.notifications ?? []) {
      try {
        notify(t(n));
      } catch {
        notify(n);
      }
    }
    if (data.leg?.event?.kind === "combat") {
      document.getElementById("center-panel")!.classList.add("hidden");
      await startCombat("wolf", 2);
      return;
    }
    const dest = NODE_BY_ID[to];
    if (dest?.kind === "town" && character) {
      character.position.townId = to;
      character.position.dungeonId = undefined;
      world.loadTown(to);
      player.position.set(TOWNS[to].spawn.x, 1.6, TOWNS[to].spawn.z);
      mode = "explore";
      // rejoin hub
      try {
        roomClient?.leave();
        const client = new Client(WS_URL);
        roomClient = await client.joinOrCreate("hub", { townId: to, character });
      } catch {
        /* solo */
      }
    } else if (dest?.kind === "dungeon_entrance") {
      const map: Record<string, string> = {
        mine_ash_entrance: "mine_ash",
        cult_cellars_entrance: "cult_cellars",
        ice_crypt_entrance: "ice_crypt",
      };
      await enterDungeon(map[to] || "mine_ash");
      return;
    }
    document.getElementById("center-panel")!.classList.add("hidden");
    updateHud();
    notify(`${t("ui.travel")}: ${t(dest?.nameKey || "place.rimeport")}`);
  } catch (e: any) {
    notify(String(e.message || e), "warn");
  }
}

async function enterDungeon(id: string): Promise<void> {
  if (!character) return;
  const data = await api("/api/dungeon/enter", {
    method: "POST",
    body: JSON.stringify({ characterId: character.id, dungeonId: id }),
  });
  character = data.character;
  dungeonId = id;
  roomId = data.room.id;
  mode = "dungeon";
  world.loadDungeonRoom(id, roomId!);
  player.position.set(0, 1.6, 8);
  player.yaw = Math.PI;
  document.getElementById("center-panel")!.classList.add("hidden");
  notify(t(data.room.introKey));
  updateHud();
}

async function startCombat(enemyType: string, count: number): Promise<void> {
  if (!character) return;
  const data = await api("/api/combat/start", {
    method: "POST",
    body: JSON.stringify({ characterId: character.id, enemyType, count }),
  });
  combat = data.state;
  mode = "combat";
  player.enabled = false;
  document.exitPointerLock();
  combatScene.mount(innerWidth, innerHeight);
  combatScene.setState(combat);
  combatScene.setSelected(null);
  renderCombat();
  notify(t("combat.start"));
}

function renderCombat(): void {
  const ui = document.getElementById("combat-ui")!;
  if (!combat || !character) {
    ui.classList.add("hidden");
    return;
  }
  ui.classList.remove("hidden");
  const me = combat.combatants.find((c) => c.id === character!.id);
  const enemies = combat.combatants.filter((c) => c.side === "enemy" && c.life > 0);
  const active = combat.activeId === character.id;
  ui.innerHTML = `
    <h2>${t("mode.combat")} · R${combat.round}</h2>
    <div style="font-size:0.85rem;margin-bottom:8px">
      ${combat.combatants
        .map(
          (c) =>
            `<div style="color:${c.id === combat!.activeId ? "#b8860b" : "#c4b49a"}">${c.name}: ${c.life}/${c.lifeMax} LE · AT${c.at}/PA${c.pa}</div>`
        )
        .join("")}
    </div>
    ${
      active
        ? `<div style="display:flex;flex-direction:column;gap:6px">
        ${enemies
          .map((e) => {
            const chance = me ? hitChancePercent(me.at, e.pa) : 50;
            return `<button class="btn danger" data-atk="${e.id}">${t("ui.attack")} ${e.name} (${t("ui.hit_chance")} ${chance}%)</button>`;
          })
          .join("")}
        <button class="btn" id="c-def">${t("ui.defend")}</button>
        <button class="btn" id="c-flee">${t("ui.flee")}</button>
        ${
          character.focusMax > 0
            ? `<button class="btn" id="c-spark">${t("ui.cast")}: Spark</button>
               <button class="btn" id="c-balm">${t("ui.cast")}: Balm</button>`
            : ""
        }
      </div>`
        : `<p>${t("combat.not_your_turn")}</p>`
    }
    <div class="combat-grid-hint">${combat.log.slice(-4).join(" · ")}</div>
  `;
  ui.querySelectorAll("[data-atk]").forEach((b) => {
    (b as HTMLButtonElement).onclick = () =>
      combatAction({ kind: "attack", targetId: (b as HTMLElement).dataset.atk! });
  });
  const def = document.getElementById("c-def");
  if (def) def.onclick = () => combatAction({ kind: "defend" });
  const flee = document.getElementById("c-flee");
  if (flee) flee.onclick = () => combatAction({ kind: "flee" });
  const spark = document.getElementById("c-spark");
  if (spark)
    spark.onclick = () => {
      const e = enemies[0];
      if (e) combatAction({ kind: "cast", spellId: "spark", targetId: e.id });
    };
  const balm = document.getElementById("c-balm");
  if (balm) balm.onclick = () => combatAction({ kind: "cast", spellId: "balm", targetId: character!.id });
}

async function combatAction(action: object): Promise<void> {
  if (!character || !combat) return;
  try {
    const data = await api("/api/combat/action", {
      method: "POST",
      body: JSON.stringify({ combatId: combat.id, characterId: character.id, action }),
    });
    combat = data.state;
    if (data.character) character = data.character;
    if (combat) combatScene.setState(combat);
    if (data.ended) {
      document.getElementById("combat-ui")!.classList.add("hidden");
      combat = null;
      combatScene.setSelected(null);
      mode = dungeonId ? "dungeon" : "explore";
      player.enabled = true;
      if (data.ended === "victory") {
        notify(t("combat.victory"), "quest");
        if (data.exp) notify(t("notify.exp", { n: data.exp }));
      } else if (data.ended === "defeat") {
        notify(t("combat.defeat"), "warn");
        dungeonId = null;
        roomId = null;
        world.loadTown("rimeport");
        player.position.set(-8, 1.6, -4);
        mode = "explore";
      } else notify(t("combat.fled"));
      updateHud();
      return;
    }
    renderCombat();
    updateHud();
  } catch (e: any) {
    notify(String(e.message || e), "warn");
  }
}

function showDialogue(): void {
  if (!dialogue) return;
  player.enabled = false;
  document.exitPointerLock();
  showPanel(
    `<h2>${t("ui.talk")}</h2>
    <p>${t(dialogue.textKey)}</p>
    <div class="topic-list">
      ${dialogue.topics
        .map((tp) => `<button class="btn" data-topic="${tp}">${t(`topic.${tp}`)}</button>`)
        .join("")}
    </div>`
  );
  document.querySelectorAll("#center-panel [data-topic]").forEach((b) => {
    (b as HTMLButtonElement).onclick = () => {
      const topic = (b as HTMLElement).dataset.topic!;
      if (roomClient) {
        roomClient.send("dialogue_topic", { npcId: dialogue!.npcId, topic });
      } else {
        // offline dialogue fallback
        const town = TOWNS[character?.position.townId || "rimeport"];
        const npc = town?.npcs.find((n) => n.id === dialogue!.npcId);
        if (topic === "farewell") {
          document.getElementById("center-panel")!.classList.add("hidden");
          player.enabled = true;
          dialogue = null;
          return;
        }
        const key = npc?.replies[topic] ?? npc?.greetingKey ?? dialogue!.textKey;
        dialogue = { ...dialogue!, textKey: key };
        showDialogue();
        if (topic === "pactcinder" && character && !character.questFlags.pactcinder) {
          character.questFlags.pactcinder = 1;
          character.journal.push({
            id: "j_pactcinder",
            questId: "pactcinder",
            titleKey: "journal.pactcinder.title",
            bodyKey: "journal.pactcinder.body",
            timestamp: Date.now(),
            clue: true,
          });
          character.knownMapNodes = [...new Set([...character.knownMapNodes, "mine_ash_entrance", "road_south"])];
          notify(t("notify.quest_update"), "quest");
        }
      }
      if (topic === "farewell") {
        document.getElementById("center-panel")!.classList.add("hidden");
        player.enabled = true;
        dialogue = null;
      }
    };
  });
}

async function tryInteract(): Promise<void> {
  if (!character || mode === "combat") return;
  const near = world.nearestInteractable(player.position);
  if (!near) return;

  if (near.kind === "npc") {
    if (roomClient) roomClient.send("interact", { targetId: near.id });
    else {
      const town = TOWNS[character.position.townId || "rimeport"];
      const npc = town?.npcs.find((n) => n.id === near.id);
      if (npc) {
        dialogue = { npcId: npc.id, textKey: npc.greetingKey, topics: npc.topics };
        showDialogue();
      }
    }
    return;
  }
  if (near.kind === "travel") {
    showTravel();
    return;
  }
  if (near.kind === "encounter") {
    const type = near.id.replace("encounter_", "");
    await startCombat(type, type === "ash_guardian" ? 1 : 2);
    return;
  }
  if (near.kind === "exit") {
    dungeonId = null;
    roomId = null;
    const town = character.position.townId || "rimeport";
    world.loadTown(town);
    player.position.set(0, 1.6, 10);
    mode = "explore";
    character.position.dungeonId = undefined;
    character.position.townId = town;
    updateHud();
    notify(t("ui.leave"));
    return;
  }
  if (near.kind === "door" && dungeonId && roomId) {
    const dungeon = DUNGEONS[dungeonId];
    const room = dungeon.rooms.find((r) => r.id === roomId);
    const feature = room?.features.find((f) => f.id === near.id);
    const to = feature?.data?.to as string | undefined;
    if (to) {
      roomId = to;
      world.loadDungeonRoom(dungeonId, to);
      player.position.set(0, 1.6, 6);
      const nr = dungeon.rooms.find((r) => r.id === to);
      if (nr) notify(t(nr.introKey));
    }
    return;
  }
  if ((near.kind === "greed" || near.kind === "boss" || near.kind === "chest" || near.kind === "puzzle") && dungeonId && roomId) {
    if (near.kind === "greed") {
      showPanel(
        `<h2>${t("dungeon.mine.greed")}</h2>
        <button class="btn danger" id="g-all">${t("dungeon.mine.greed.take_all")}</button>
        <button class="btn primary" id="g-need">${t("dungeon.mine.greed.take_need")}</button>`
      );
      document.getElementById("g-all")!.onclick = () => useFeature(near.id, "take_all");
      document.getElementById("g-need")!.onclick = () => useFeature(near.id, "take_need");
      return;
    }
    await useFeature(near.id);
    if (near.kind === "boss") await startCombat(dungeonId === "mine_ash" ? "ash_guardian" : "frost_wight", 1);
  }
}

async function useFeature(featureId: string, choice?: string): Promise<void> {
  if (!character || !dungeonId || !roomId) return;
  const data = await api("/api/dungeon/feature", {
    method: "POST",
    body: JSON.stringify({
      characterId: character.id,
      dungeonId,
      roomId,
      featureId,
      choice,
    }),
  });
  character = data.character;
  document.getElementById("center-panel")!.classList.add("hidden");
  notify(t("notify.quest_update"), "quest");
  updateHud();
}

// Chat
document.getElementById("chat-input")!.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const input = e.target as HTMLInputElement;
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  if (roomClient) roomClient.send("chat", { channel: "local", text });
  else {
    const log = document.getElementById("chat-log")!;
    const line = document.createElement("div");
    line.textContent = `[local] you: ${text}`;
    log.appendChild(line);
  }
});

// Title buttons
document.getElementById("btn-guest")!.onclick = () => ensureGuestAndQuickStart();
document.getElementById("btn-create")!.onclick = async () => {
  document.getElementById("title-screen")!.classList.add("hidden");
  mode = "create";
  if (!token) {
    try {
      const g = await api("/api/auth/guest", { method: "POST" });
      token = g.token;
      localStorage.setItem("embertrail_token", token);
    } catch (e: any) {
      notify("Server offline? Start with npm run dev", "warn");
    }
  }
  await rollCreate();
  renderCreate();
};

// Move sync
let moveAcc = 0;
function loop(t: number): void {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - (loop as any).last) / 1000 || 0.016);
  (loop as any).last = t;
  if (mode === "combat" && combat) {
    combatScene.render(renderer);
  } else if (mode === "explore" || mode === "dungeon") {
    player.update(dt, (x, z) => Math.abs(x) > 20 || Math.abs(z) > 20);
    player.applyToCamera(world.camera);
    moveAcc += dt;
    if (moveAcc > 0.1 && roomClient && character) {
      moveAcc = 0;
      roomClient.send("move", {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        yaw: player.yaw,
      });
    }
    const near = world.nearestInteractable(player.position);
    const prompt = document.getElementById("interact-prompt")!;
    if (near) {
      prompt.classList.remove("hidden");
      prompt.textContent = `[E] ${near.kind === "npc" ? t("ui.talk") : near.kind}`;
    } else prompt.classList.add("hidden");
    renderer.render(world.scene, world.camera);
  } else {
    // title / create: still show world backdrop
    renderer.render(world.scene, world.camera);
  }
}

// Day/night cycle (full loop ~2 minutes)
setInterval(() => {
  if (mode === "explore") {
    const t = (Date.now() / 120000) % 1;
    world.setTimeOfDay(t);
  }
}, 1000);

refreshI18nChrome();
document.getElementById("crosshair")!.classList.add("hidden");
// Load empty town bg on title
world.loadTown("rimeport");
player.enabled = false;
requestAnimationFrame(loop);

console.info("Embertrail / Glutpfad client ready");
