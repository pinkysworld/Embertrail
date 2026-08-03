import * as THREE from "three";
import { Client } from "colyseus.js";
import type { CharacterSheet, CombatState, Locale } from "@embertrail/shared";
import { ARCHETYPES, SKILLS, NODE_BY_ID, TRAVEL_GRAPH, hitChancePercent } from "@embertrail/rules";
import { DUNGEONS, TOWNS } from "@embertrail/content";
import { t, getLocale, setLocale, toggleLocale } from "./i18n";
import { WorldScene } from "./game/world";
import { CombatScene } from "./game/combatScene";
import { PlayerController } from "./game/player";
import { isOfflineMode, offlineApi, getOfflineCharacter, saveOfflineCharacter } from "./offlineApi";
import { SHOPS, QUESTS } from "@embertrail/content";
import { ALCHEMY_RECIPES, ITEMS } from "@embertrail/rules";
import {
  unlockAudio,
  playSfx,
  startAmbient,
  setMuted,
  isMuted,
} from "./audio";
import { createPartyAvatar } from "./game/characterMesh";
import type { PartyState } from "@embertrail/shared";

const API = "";
const WS_URL = `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:2567`;
/** Single-player focus: always use local offline rules on static hosts; never require multiplayer */
const OFFLINE = isOfflineMode() || true; // force solo for this release
const SOLO_ONLY = true;
const BASE = import.meta.env.BASE_URL;

/** Wire public UI chrome into CSS vars (respects GitHub Pages base path). */
(function applyUiChrome(): void {
  const root = document.documentElement.style;
  const u = (name: string) => `url(${BASE}ui/${name})`;
  root.setProperty("--ui-panel-parchment", u("panel_parchment.png"));
  root.setProperty("--ui-button-trim", u("button_metal_trim.png"));
  root.setProperty("--ui-hp-fill", u("hp_bar_fill.png"));
  root.setProperty("--ui-focus-fill", u("focus_bar_fill.png"));
  root.setProperty("--ui-crosshair", u("crosshair.png"));
  root.setProperty("--ui-slot-frame", u("slot_frame.png"));
})();

let token = localStorage.getItem("embertrail_token") ?? "";
let character: CharacterSheet | null = null;
let combat: CombatState | null = null;
let mode: "title" | "create" | "explore" | "travel" | "combat" | "dialogue" | "dungeon" = "title";
let dialogue: { npcId: string; textKey: string; topics: string[] } | null = null;
let travelDay = 1;
let dungeonId: string | null = null;
let roomId: string | null = null;
let roomClient: Awaited<ReturnType<Client["joinOrCreate"]>> | null = null;
let dungeonRoom: Awaited<ReturnType<Client["joinOrCreate"]>> | null = null;
let colyseusClient: Client | null = null;
let party: PartyState | null = null;

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
      <button class="btn primary hidden" id="btn-continue"></button>
      <button class="btn" id="btn-create"></button>
    </div>
  </div>
  <div id="create-screen" class="panel center-panel hidden" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,94vw);max-height:90vh;overflow:auto;z-index:16"></div>
  <div id="center-panel" class="panel hidden"></div>
  <div id="combat-ui" class="panel hidden" style="position:absolute;right:12px;top:80px;width:min(320px,40vw);z-index:12"></div>
  <div id="mobile-controls" class="hidden" aria-hidden="true">
    <div class="stick-zone" id="stick-zone">
      <div class="stick-base"></div>
      <div class="stick-knob" id="stick-knob"></div>
    </div>
    <div class="look-hint" id="look-hint">Drag right side<br/>to look</div>
    <button type="button" id="btn-interact" class="btn">Use</button>
  </div>
`;

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const world = new WorldScene();
const combatScene = new CombatScene(true);
const player = new PlayerController(canvas);
const otherPlayers = new Map<string, THREE.Object3D>();

// ——— Mobile virtual joystick ———
function setupMobileControls(): void {
  if (!player.touchMode) return;
  document.body.classList.add("touch-mode");
  const mc = document.getElementById("mobile-controls")!;
  const zone = document.getElementById("stick-zone")!;
  const knob = document.getElementById("stick-knob")!;
  const btnInteract = document.getElementById("btn-interact")!;
  const lookHint = document.getElementById("look-hint")!;

  const maxR = 48;
  let activeId: number | null = null;

  const setKnob = (dx: number, dy: number) => {
    const len = Math.hypot(dx, dy);
    const s = len > maxR ? maxR / len : 1;
    const kx = dx * s;
    const ky = dy * s;
    knob.style.transform = `translate(${kx}px, ${ky}px)`;
    // stickY: screen up = forward = negative clientY delta → positive stickY
    player.setStick(kx / maxR, -ky / maxR);
  };

  const resetKnob = () => {
    activeId = null;
    knob.style.transform = "translate(0,0)";
    player.clearStick();
  };

  zone.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const t = e.changedTouches[0];
      activeId = t.identifier;
      const rect = zone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      setKnob(t.clientX - cx, t.clientY - cy);
    },
    { passive: false }
  );
  zone.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier !== activeId) continue;
        const rect = zone.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        setKnob(t.clientX - cx, t.clientY - cy);
      }
    },
    { passive: false }
  );
  const endStick = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeId) resetKnob();
    }
  };
  zone.addEventListener("touchend", endStick);
  zone.addEventListener("touchcancel", endStick);

  btnInteract.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    playSfx("ui_click");
    player.onInteract?.();
  });
  btnInteract.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      playSfx("ui_click");
      player.onInteract?.();
    },
    { passive: false }
  );

  // Show/hide with game mode
  let lookHintShownAt = 0;
  const syncMobileUi = () => {
    const playing = mode === "explore" || mode === "dungeon";
    mc.classList.toggle("hidden", !playing);
    mc.classList.toggle("show-controls", playing);
    mc.setAttribute("aria-hidden", playing ? "false" : "true");
    if (playing && !lookHintShownAt) lookHintShownAt = Date.now();
    // Hide look hint after 12s so it doesn't clutter combat return
    const showHint = playing && Date.now() - lookHintShownAt < 12000;
    lookHint.style.display = showHint ? "block" : "none";
  };
  // poll lightly via existing loop by exporting
  (window as any).__embertrailSyncMobile = syncMobileUi;

  // iOS: prevent pull-to-refresh / bounce while playing
  document.addEventListener(
    "touchmove",
    (e) => {
      if (mode === "explore" || mode === "dungeon" || mode === "combat") {
        // allow scrolling inside panels
        const target = e.target as HTMLElement;
        if (target.closest(".panel, #combat-ui, #center-panel, #create-screen, #chat-box, input, textarea")) {
          return;
        }
        e.preventDefault();
      }
    },
    { passive: false }
  );
}

setupMobileControls();

function resize(): void {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  world.setSize(w, h);
  combatScene.mount(w, h);
}
addEventListener("resize", resize);
resize();
// Orbit only while in combat (see combat start/end)

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
  if (kind === "quest") {
    el.style.borderColor = "#b8860b";
    playSfx("quest");
  } else if (kind === "loot") {
    el.style.borderColor = "#52b788";
    playSfx("buy");
  } else if (kind === "warn") playSfx("miss");
  else playSfx("notify");
  document.getElementById("notify-stack")!.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

/** Translate combat log keys like combat.hit:A:B:5 */
function formatCombatLog(entry: string): string {
  const [key, ...rest] = entry.split(":");
  const translated = t(key);
  if (translated !== key) {
    if (rest.length === 0) return translated;
    if (key === "combat.hit" && rest.length >= 3) {
      return `${rest[0]} → ${rest[1]}  ${rest[2]} dmg`;
    }
    if (key === "combat.miss" && rest.length >= 2) {
      return `${rest[0]} misses ${rest[1]}`;
    }
    if (key === "combat.heal" && rest.length >= 3) {
      return `${rest[0]} heals ${rest[2]}`;
    }
    if (key === "combat.move") return `${rest[0]} moves`;
    if (key === "combat.defend") return `${rest[0]} defends`;
    return `${translated} ${rest.join(" ")}`.trim();
  }
  if (key === "combat.hit" && rest.length >= 3) return `${rest[0]} hits ${rest[1]} for ${rest[2]}!`;
  if (key === "combat.miss" && rest.length >= 2) return `${rest[0]} misses ${rest[1]}`;
  if (key === "combat.heal" && rest.length >= 3) return `Healed ${rest[2]} life`;
  if (key === "combat.spark" && rest.length >= 3) return `Spark hits ${rest[1]} for ${rest[2]}`;
  if (key === "combat.move") return `${rest[0] || "Hero"} moves`;
  if (key === "combat.defend") return `${rest[0] || "Hero"} braces`;
  if (key === "combat.start") return t("combat.start") || "Fight!";
  if (key === "combat.fled") return t("combat.fled") || "Fled";
  if (key === "combat.flee_fail") return "Could not flee!";
  return entry.replace(/combat\./g, "").replace(/:/g, " ");
}

function showCoach(steps: string[]): void {
  if (!steps.length) return;
  let i = 0;
  const show = () => {
    if (i >= steps.length) return;
    showPanel(
      `<h2>${t("ui.help") || "How to play"}</h2>
      <p style="line-height:1.45">${steps[i]}</p>
      <button class="btn primary" id="coach-next">${i < steps.length - 1 ? t("ui.continue") || "Next" : t("ui.close")}</button>`
    );
    document.getElementById("coach-next")!.onclick = () => {
      i++;
      if (i >= steps.length) {
        document.getElementById("center-panel")!.classList.add("hidden");
        player.enabled = true;
        localStorage.setItem("embertrail_coach_done", "1");
      } else show();
    };
  };
  player.enabled = false;
  document.exitPointerLock?.();
  show();
}

function refreshI18nChrome(): void {
  (document.getElementById("title-h1") as HTMLElement).textContent = t("app.title");
  (document.getElementById("title-sub") as HTMLElement).textContent = t("app.subtitle");
  (document.getElementById("btn-guest") as HTMLElement).textContent = t("ui.play");
  (document.getElementById("btn-create") as HTMLElement).textContent = t("ui.create");
  const cont = document.getElementById("btn-continue");
  if (cont) cont.textContent = t("ui.continue") || "Continue";
  (document.getElementById("lang-btn") as HTMLElement).textContent =
    getLocale() === "en" ? "Deutsch" : "English";
  (document.getElementById("chat-input") as HTMLInputElement).placeholder = t("ui.chat");
  // Continue whenever a local save exists (Pages + explicit offline)
  const saved = getOfflineCharacter();
  if (cont) cont.classList.toggle("hidden", !saved);
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

function wireRoomMessages(room: Awaited<ReturnType<Client["joinOrCreate"]>>, kind: "hub" | "dungeon"): void {
  room.onMessage("chat", (msg: any) => {
    const log = document.getElementById("chat-log")!;
    const line = document.createElement("div");
    line.textContent = `[${msg.message.channel}] ${msg.message.from}: ${msg.message.text}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  });
  room.onMessage("player_joined", (msg: any) => {
    const p = msg.player || msg;
    if (p.id === character!.id) return;
    addOther(p);
  });
  room.onMessage("player_left", (msg: any) => {
    const m = otherPlayers.get(msg.id);
    if (m) {
      world.scene.remove(m);
      otherPlayers.delete(msg.id);
    }
  });
  room.onMessage("player_moved", (msg: any) => {
    let m = otherPlayers.get(msg.id);
    if (!m) {
      addOther({ id: msg.id, name: "?", archetype: "steelguard", x: msg.x, y: msg.y, z: msg.z, yaw: msg.yaw });
      m = otherPlayers.get(msg.id);
    }
    if (m) {
      m.position.set(msg.x, 0, msg.z);
      m.rotation.y = msg.yaw;
    }
  });
  room.onMessage("hub_state", (msg: any) => {
    for (const p of msg.players || []) {
      if (p.id !== character!.id) addOther(p);
    }
  });
  room.onMessage("dungeon_state", (msg: any) => {
    if (msg.roomId && msg.dungeonId) {
      dungeonId = msg.dungeonId;
      roomId = msg.roomId;
      world.loadDungeonRoom(msg.dungeonId, msg.roomId);
      for (const p of msg.members || []) {
        if (p.id !== character!.id) addOther(p);
      }
    }
  });
  room.onMessage("dialogue", (msg: any) => {
    dialogue = msg;
    showDialogue();
  });
  room.onMessage("notification", (msg: any) => {
    notify(t(msg.textKey, msg.args), msg.kind);
  });
  room.onMessage("character_update", (msg: any) => {
    if (msg.character) {
      character = { ...character!, ...msg.character };
      updateHud();
    }
  });
  room.onMessage("welcome", (msg: any) => {
    if (msg.character) character = msg.character;
    updateHud();
  });
  room.onMessage("party_update", (msg: any) => {
    party = msg.party;
    notify(party ? `Party: ${party.memberIds.length}` : "Left party");
  });
  room.onMessage("combat_start", (msg: any) => {
    combat = msg.state;
    mode = "combat";
    player.enabled = false;
    document.exitPointerLock();
    combatScene.mount(innerWidth, innerHeight);
    combatScene.setState(combat!);
    combatScene.attachOrbit(canvas);
    renderCombat();
    startAmbient("combat");
    playSfx("ui_open");
    notify(t("combat.start"));
  });
  room.onMessage("combat_update", (msg: any) => {
    combat = msg.state;
    if (combat) combatScene.setState(combat);
    renderCombat();
  });
  room.onMessage("combat_end", (msg: any) => {
    document.getElementById("combat-ui")!.classList.add("hidden");
    combat = null;
    combatScene.setSelected(null);
    combatScene.detachOrbit();
    mode = dungeonId ? "dungeon" : "explore";
    player.enabled = true;
    if (msg.result === "victory") {
      playSfx("victory");
      notify(t("combat.victory"), "quest");
      if (msg.exp) notify(t("notify.exp", { n: msg.exp }));
    } else if (msg.result === "defeat") {
      playSfx("defeat");
      notify(t("combat.defeat"), "warn");
    } else notify(t("combat.fled"));
    startAmbient(dungeonId ? "dungeon" : "town");
    updateHud();
  });
  room.onMessage("combat_end_shared", () => {
    /* individual combat_end carries loot */
  });
  void kind;
}

async function enterGame(): Promise<void> {
  if (!character) return;
  unlockAudio();
  document.getElementById("title-screen")!.classList.add("hidden");
  document.getElementById("hud")!.classList.remove("hidden");
  // Chat is noisy on mobile; keep available on desktop only
  if (!player.touchMode) {
    document.getElementById("chat-box")!.classList.remove("hidden");
  }
  document.getElementById("mode-bar")!.classList.remove("hidden");
  document.getElementById("crosshair")!.classList.toggle("hidden", player.touchMode);

  const townId = character.position.townId || "rimeport";
  const savedDungeon = character.position.dungeonId;

  if (savedDungeon && DUNGEONS[savedDungeon]) {
    dungeonId = savedDungeon;
    roomId = DUNGEONS[savedDungeon].rooms[0]?.id ?? null;
    mode = "dungeon";
    if (roomId) world.loadDungeonRoom(savedDungeon, roomId);
    startAmbient("dungeon");
  } else {
    mode = "explore";
    dungeonId = null;
    roomId = null;
    world.loadTown(townId);
    startAmbient("town");
  }

  player.position.set(
    character.position.x ?? TOWNS[townId]?.spawn.x ?? 0,
    character.position.y ?? 1.6,
    character.position.z ?? TOWNS[townId]?.spawn.z ?? 10
  );
  player.yaw = character.position.yaw ?? 0;
  player.enabled = true;
  updateHud();
  renderModeBar();
  (window as any).__embertrailSyncMobile?.();

  // Multiplayer intentionally disabled for single-player release
  if (!SOLO_ONLY && !savedDungeon) {
    try {
      colyseusClient = new Client(WS_URL);
      roomClient = await colyseusClient.joinOrCreate("hub", { townId, character });
      wireRoomMessages(roomClient, "hub");
    } catch (e) {
      console.warn("Multiplayer unavailable, solo mode", e);
    }
  }

  player.onInteract = () => tryInteract();
  notify(t("journal.arrival.body").slice(0, 80) + "…", "quest");
  if (OFFLINE) {
    try {
      saveOfflineCharacter(character);
    } catch {
      /* ok */
    }
  }

  // First-run coach (once per browser)
  if (!localStorage.getItem("embertrail_coach_done")) {
    setTimeout(() => {
      showCoach([
        getLocale() === "de"
          ? "Willkommen in Rimeport. <b>WASD</b> bewegen, Maus umsehen, <b>E</b> interagieren. Auf dem Handy: linker Stick + rechte Seite zum Umschauen."
          : "Welcome to Rimeport. <b>WASD</b> move, mouse look, <b>E</b> to interact. On phone: left stick + drag right side to look.",
        getLocale() === "de"
          ? "Gelbe <b>Quest-Marken</b> zeigen wichtige NPCs und Dungeons. Sprich mit dem <b>Gesandten</b> (Paktglut) oder lies das <b>Questbrett</b> (Wölfe)."
          : "Yellow <b>quest pins</b> mark key NPCs and dungeons. Talk to the <b>Envoy</b> (Pact Cinder) or the <b>quest board</b> (wolves).",
        getLocale() === "de"
          ? "Im Kampf: zuerst <b>Bewegen</b> (bis 3 Felder), dann angreifen. Trefferchance steht auf den Buttons. Tränke im Inventar heilen dich."
          : "In combat: <b>Move</b> first (up to 3 tiles), then Attack. Hit chance is on the buttons. Use potions from Inventory to heal.",
      ]);
    }, 600);
  }
}

function addOther(p: { id: string; name?: string; archetype?: string; x: number; y: number; z: number; yaw: number }): void {
  if (otherPlayers.has(p.id)) return;
  const m = createPartyAvatar(p.archetype || "steelguard", "m");
  m.position.set(p.x, 0, p.z);
  m.rotation.y = p.yaw || 0;
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
  (document.getElementById("hud-meta") as HTMLElement).innerHTML =
    `${t("ui.life")} ${character.life}/${character.lifeMax} · ${t("ui.focus")} ${character.focus}/${character.focusMax} · ${t("ui.rations")} ${character.rations} · ` +
    `<span class="gold-chip"><img src="${BASE}ui/coin_pile.png" alt="" />${character.gold}g ${character.silver}s</span>`;
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
      `<img class="journal-cover" src="${BASE}ui/journal_cover.png" alt="" />` +
      character.journal
        .map(
          (j) =>
            `<div style="margin:8px 0;border-bottom:1px solid #6b5a45;padding-bottom:6px">
          <strong>${t(j.titleKey)}</strong>
          <div style="font-size:0.9rem;color:#c4b49a">${t(j.bodyKey)}</div>
        </div>`
        )
        .join("") +
      `<div style="clear:both"></div>`
  );
}

function showMap(): void {
  if (!character) return;
  const nodes = TRAVEL_GRAPH.filter((n) => character!.knownMapNodes.includes(n.id) || n.kind === "town");
  const pin = `<img class="quest-pin" src="${BASE}ui/quest_marker.png" alt="" />`;
  showPanel(
    `<h2>${t("ui.map")}</h2>
    <img class="map-compass" src="${BASE}ui/compass_rose.png" alt="" />
    <div style="font-size:0.9rem">${nodes
      .map((n) => `${n.kind === "dungeon" || n.kind === "town" ? pin : "• "}${t(n.nameKey)} (${n.kind})`)
      .join("<br>")}</div>
    <p style="color:#b8a88a;font-size:0.85rem;margin-top:8px;clear:both">${t("ui.travel")}: ${character.knownMapNodes.join(", ")}</p>`
  );
}

function itemIconHtml(itemId: string, size = 28): string {
  const src = `${BASE}icons/${itemId}.png`;
  return `<img src="${src}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:3px;border:1px solid var(--border);background:#1a1510;flex-shrink:0" onerror="this.style.display='none'" />`;
}

function isEquippable(itemId: string): boolean {
  const def = ITEMS[itemId];
  if (!def) return itemId === "foxbrand_axe";
  return def.kind === "weapon" || def.kind === "armor" || def.kind === "shield" || itemId === "foxbrand_axe";
}

function isUsable(itemId: string): boolean {
  const def = ITEMS[itemId];
  if (itemId === "copper_coins") return true;
  if (!def) return false;
  return def.kind === "consumable" || !!def.heal || itemId === "potion_focus";
}

function equippedLabel(itemId: string): string {
  if (!character) return "";
  const eq = character.equipped;
  const slots: string[] = [];
  if (eq.mainHand === itemId) slots.push("hand");
  if (eq.offHand === itemId) slots.push("off");
  if (eq.armor === itemId) slots.push("armor");
  if (eq.boots === itemId) slots.push("boots");
  return slots.length ? ` [${slots.join(",")}]` : "";
}

function showInventory(): void {
  if (!character) return;
  const eq = character.equipped;
  showPanel(
    `<h2>${t("ui.inventory")}</h2>
    <div style="font-size:0.85rem;color:#b8a88a;margin-bottom:8px">
      ${t("ui.equipped") || "Equipped"}:
      ${eq.mainHand ? itemIconHtml(eq.mainHand, 22) + " " + (t(`item.${eq.mainHand}`) || eq.mainHand) : "—"}
      · ${eq.offHand ? t(`item.${eq.offHand}`) || eq.offHand : "—"}
      · ${eq.armor ? t(`item.${eq.armor}`) || eq.armor : "—"}
      · ${eq.boots ? t(`item.${eq.boots}`) || eq.boots : "—"}
    </div>
    <div class="inv-grid" style="display:flex;flex-direction:column;gap:6px;font-size:0.9rem">${
      character.inventory.length
        ? character.inventory
            .map((i) => {
              const canUse = isUsable(i.itemId);
              const canEquip = isEquippable(i.itemId);
              const worn = !!equippedLabel(i.itemId);
              return `<div class="inv-slot">${itemIconHtml(i.itemId, 36)}
          <span style="flex:1">${t(`item.${i.itemId}`) || i.itemId} ×${i.qty}${equippedLabel(i.itemId)}</span>
          <span style="display:flex;gap:4px;flex-wrap:wrap">
          ${canUse ? `<button class="btn" data-use="${i.itemId}">${t("ui.use") || "Use"}</button>` : ""}
          ${canEquip && !worn ? `<button class="btn primary" data-equip="${i.itemId}">${t("ui.equip") || "Equip"}</button>` : ""}
          ${canEquip && worn ? `<button class="btn" data-unequip="${i.itemId}">${t("ui.unequip") || "Unequip"}</button>` : ""}
          </span>
        </div>`;
            })
            .join("")
        : `<p style="color:#b8a88a">${t("ui.empty") || "Empty pack."}</p>`
    }</div>
    <h3 style="margin-top:12px">${t("ui.skills")}</h3>
    <div class="skill-list">${Object.entries(character.skills)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `<div class="skill-row"><span>${t(`skill.${k}`)}</span><span>${v}</span></div>`)
      .join("")}</div>`
  );
  document.querySelectorAll("#center-panel [data-use]").forEach((btn) => {
    (btn as HTMLButtonElement).onclick = async () => {
      try {
        const data = await api("/api/item/use", {
          method: "POST",
          body: JSON.stringify({
            characterId: character!.id,
            itemId: (btn as HTMLElement).dataset.use,
          }),
        });
        character = data.character;
        updateHud();
        playSfx("cast");
        notify(t(data.notification || "notify.healed") || "Used item", "loot");
        showInventory();
      } catch (e: any) {
        notify(String(e.message || e), "warn");
      }
    };
  });
  document.querySelectorAll("#center-panel [data-equip]").forEach((btn) => {
    (btn as HTMLButtonElement).onclick = async () => {
      try {
        const data = await api("/api/item/equip", {
          method: "POST",
          body: JSON.stringify({
            characterId: character!.id,
            itemId: (btn as HTMLElement).dataset.equip,
          }),
        });
        character = data.character;
        updateHud();
        playSfx("ui_click");
        notify(t("notify.equipped") || "Equipped.", "loot");
        showInventory();
      } catch (e: any) {
        notify(String(e.message || e), "warn");
      }
    };
  });
  document.querySelectorAll("#center-panel [data-unequip]").forEach((btn) => {
    (btn as HTMLButtonElement).onclick = async () => {
      try {
        const data = await api("/api/item/equip", {
          method: "POST",
          body: JSON.stringify({
            characterId: character!.id,
            itemId: (btn as HTMLElement).dataset.unequip,
            unequip: true,
          }),
        });
        character = data.character;
        updateHud();
        playSfx("ui_click");
        notify(t("notify.unequipped") || "Unequipped.", "info");
        showInventory();
      } catch (e: any) {
        notify(String(e.message || e), "warn");
      }
    };
  });
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
  let html = `<h2>${t("ui.shop") || "Shop"} — ${t(`place.${townId}`)}</h2>
    <div class="gold-chip" style="margin-bottom:8px"><img src="${BASE}ui/coin_pile.png" alt="" />${character.gold}g ${character.silver}s · ${character.copper ?? 0}c</div>`;
  for (const shop of shops) {
    html += `<h3>${t(shop.nameKey) || shop.id}</h3><div style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px">`;
    for (const stock of shop.stock || []) {
      html += `<button class="btn" data-buy="${shop.id}" data-item="${stock.itemId}" style="display:flex;align-items:center;gap:8px;text-align:left">${itemIconHtml(stock.itemId, 24)}<span>${t(`item.${stock.itemId}`) || stock.itemId} (${stock.priceCopper ?? "?"}c)</span></button>`;
    }
    for (const svc of shop.services || []) {
      html += `<button class="btn" data-buy="${shop.id}" data-item="${svc.id}">${t(svc.nameKey) || svc.id} (${svc.priceCopper}c)</button>`;
    }
    html += `</div>`;
  }
  html += `<h3>${t("ui.sell") || "Sell"}</h3><div style="display:flex;flex-direction:column;gap:4px">`;
  for (const inv of character.inventory.filter((i) => !["pactcinder", "foxbrand_axe", "mine_key", "cult_sigil", "fake_pactcinder"].includes(i.itemId))) {
    html += `<button class="btn" data-sell="${inv.itemId}" style="display:flex;align-items:center;gap:8px;text-align:left">${itemIconHtml(inv.itemId, 24)}<span>${t(`item.${inv.itemId}`) || inv.itemId} ×${inv.qty}</span></button>`;
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
  const hasSigil = character.inventory.some((i) => i.itemId === "cult_sigil");
  const hasHerbs =
    character.inventory.some((i) => i.itemId === "herb_woundwort" && i.qty >= 1) &&
    character.inventory.some((i) => i.itemId === "herb_frostleaf" && i.qty >= 1) &&
    character.inventory.some((i) => i.itemId === "herb_emberroot" && i.qty >= 1);
  const wolvesReady =
    Number(character.questFlags.wolves ?? 0) >= 2 &&
    character.questFlags.wolves !== "complete" &&
    character.questFlags.wolves !== 3;
  const town = character.position.townId || "";
  const anyAction =
    (hasPact && (town === "irondeep" || town === "mirehold")) ||
    hasFox ||
    (wolvesReady && town === "rimeport") ||
    (hasHerbs && town === "oakspire" && character.questFlags.herbs !== "complete") ||
    (hasSigil && town === "rimeport" && character.questFlags.cult_sigil !== "complete");
  const pin = `<img class="quest-pin" src="${BASE}ui/quest_marker.png" alt="" />`;
  const questHtml = Object.values(QUESTS)
    .map((q) => {
      const flag = character!.questFlags[q.id];
      const complete = flag === "complete" || flag === 3 || flag === "done";
      // Pick first step whose requires are met or first step if not started
      let step = q.steps[0];
      for (const s of q.steps) {
        if (!s.requires) {
          step = s;
          if (!flag) break;
          continue;
        }
        const ok = Object.entries(s.requires).every(([k, v]) => character!.questFlags[k] === v || Number(character!.questFlags[k]) >= Number(v));
        if (ok) step = s;
      }
      const place = step.locationHint ? t(`place.${step.locationHint}`) || step.locationHint : "";
      return `<div style="margin:10px 0;padding-bottom:8px;border-bottom:1px solid rgba(107,90,69,0.4)">
        <div>${pin}<strong>${t(q.nameKey)}</strong> ${complete ? "✓" : ""}</div>
        ${
          complete
            ? `<div style="font-size:0.85rem;color:#8a9a7a">${t("quest.complete") || "Complete"}</div>`
            : `<div style="font-size:0.9rem;margin-top:4px"><em>${t(step.titleKey)}</em></div>
               <div style="font-size:0.85rem;color:#c4b49a">${t(step.bodyKey)}</div>
               ${place ? `<div style="font-size:0.8rem;color:#b8860b;margin-top:4px">→ ${place}</div>` : ""}`
        }
        ${q.id === "pactcinder" && hasPact ? `<div style="color:#52b788;font-size:0.85rem">${t("quest.pactcinder.ready") || "You carry the Pact Cinder."}</div>` : ""}
        ${q.id === "foxbrand" && hasFox ? `<div style="color:#52b788;font-size:0.85rem">${t("quest.foxbrand.ready") || "You hold the Foxbrand Axe."}</div>` : ""}
        ${q.id === "wolves" && wolvesReady ? `<div style="color:#52b788;font-size:0.85rem">${t("quest.wolves.ready") || "Return to Rimeport."}</div>` : ""}
        ${q.id === "herbs" && hasHerbs ? `<div style="color:#52b788;font-size:0.85rem">${t("quest.herbs.ready") || "Deliver herbs."}</div>` : ""}
        ${q.id === "cult_sigil" && hasSigil ? `<div style="color:#52b788;font-size:0.85rem">${t("quest.cult_sigil.ready") || "Report the sigil."}</div>` : ""}
      </div>`;
    })
    .join("");
  showPanel(
    `<h2>${pin}${t("ui.quests") || "Quests"}</h2>
    <div style="font-size:0.9rem;margin-bottom:10px">${questHtml}</div>
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
      wolvesReady && town === "rimeport"
        ? `<button class="btn primary" id="q-wolves">${t("quest.wolves.turnin")}</button>`
        : ""
    }
    ${
      hasHerbs && town === "oakspire" && character.questFlags.herbs !== "complete"
        ? `<button class="btn primary" id="q-herbs">${t("quest.herbs.turnin")}</button>`
        : ""
    }
    ${
      hasSigil && town === "rimeport" && character.questFlags.cult_sigil !== "complete"
        ? `<button class="btn primary" id="q-sigil">${t("quest.cult_sigil.turnin")}</button>`
        : ""
    }
    ${
      !anyAction
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
  const wolves = document.getElementById("q-wolves");
  if (wolves) wolves.onclick = () => void turnInQuest("wolves");
  const herbs = document.getElementById("q-herbs");
  if (herbs) herbs.onclick = () => void turnInQuest("herbs");
  const sigil = document.getElementById("q-sigil");
  if (sigil) sigil.onclick = () => void turnInQuest("cult_sigil");
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

async function progressQuest(questId: string, stepId: string): Promise<void> {
  if (!character) return;
  try {
    const data = await api("/api/quest/progress", {
      method: "POST",
      body: JSON.stringify({ characterId: character.id, questId, stepId }),
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
  } catch (e: any) {
    notify(String(e.message || e), "warn");
  }
}

async function openQuestBoard(): Promise<void> {
  if (!character) return;
  const wolvesDone = character.questFlags.wolves === "complete" || character.questFlags.wolves === 3;
  const wolvesStarted = Boolean(character.questFlags.wolves);
  showPanel(
    `<h2>${t("place.quest_board")}</h2>
    <p style="font-size:0.9rem;color:#b8a88a;margin-bottom:10px">${t("quest.wolves.step.board_notice.body")}</p>
    ${
      !wolvesDone && !wolvesStarted
        ? `<button class="btn primary" id="qb-wolves">${t("quest.wolves.name")}</button>`
        : `<p style="color:#8a9a7a">${t("quest.wolves.name")}: ${character.questFlags.wolves ?? "—"}</p>`
    }
    <button class="btn" id="qb-close" style="margin-top:8px">${t("ui.close")}</button>`
  );
  const take = document.getElementById("qb-wolves");
  if (take) {
    take.onclick = async () => {
      await progressQuest("wolves", "board_notice");
      document.getElementById("center-panel")!.classList.add("hidden");
    };
  }
  const close = document.getElementById("qb-close");
  if (close) close.onclick = () => document.getElementById("center-panel")!.classList.add("hidden");
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
    const dest = NODE_BY_ID[to];
    if (dest?.kind === "town" && character) {
      character.position.townId = to;
      character.position.dungeonId = undefined;
      world.loadTown(to);
      player.position.set(TOWNS[to].spawn.x, 1.6, TOWNS[to].spawn.z);
      mode = "explore";
      if (!SOLO_ONLY) {
        try {
          roomClient?.leave();
          const client = new Client(WS_URL);
          roomClient = await client.joinOrCreate("hub", { townId: to, character });
        } catch {
          /* solo */
        }
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

    // Fun travel encounters
    const ev = data.leg?.event as
      | {
          kind?: string;
          enemyType?: string;
          count?: number;
          textKey?: string;
          choices?: Array<{ id: string; labelKey: string }>;
        }
      | undefined;
    if (ev?.kind === "combat") {
      await startCombat(ev.enemyType || "wolf", ev.count || 2);
      return;
    }
    if (ev?.kind === "story" || ev?.kind === "discovery" || (ev?.choices && ev.choices.length)) {
      const choices = ev.choices?.length
        ? ev.choices
        : [{ id: "press_on", labelKey: "ui.continue" }];
      showPanel(
        `<h2>${t("ui.travel")}</h2>
        <p>${t(ev.textKey || "journal.arrival.body")}</p>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
          ${choices.map((c) => `<button class="btn" data-tev="${c.id}">${t(c.labelKey) || c.id}</button>`).join("")}
        </div>`
      );
      document.querySelectorAll("#center-panel [data-tev]").forEach((b) => {
        (b as HTMLButtonElement).onclick = async () => {
          const id = (b as HTMLElement).dataset.tev!;
          document.getElementById("center-panel")!.classList.add("hidden");
          if (id === "explore" || id === "fight" || id === "ambush") {
            await startCombat("wolf", 1);
          } else if (id === "trade") {
            notify(getLocale() === "de" ? "Du tauschst ein paar Münzen und Kräuter." : "You trade a few coins and herbs.", "loot");
            if (character) {
              character.copper = (character.copper || 0) + 12;
              character.inventory = [...character.inventory, { itemId: "herb_woundwort", qty: 1 }];
              // merge if exists
              const stacks = new Map<string, number>();
              for (const it of character.inventory) {
                stacks.set(it.itemId, (stacks.get(it.itemId) || 0) + it.qty);
              }
              character.inventory = [...stacks.entries()].map(([itemId, qty]) => ({ itemId, qty }));
              updateHud();
            }
          } else {
            notify(getLocale() === "de" ? "Ihr zieht weiter." : "You press on.", "info");
          }
          player.enabled = true;
        };
      });
      return;
    }
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
  // clear hub others
  for (const [, m] of otherPlayers) world.scene.remove(m);
  otherPlayers.clear();
  world.loadDungeonRoom(id, roomId!);
  player.position.set(0, 1.6, 8);
  player.yaw = Math.PI;
  document.getElementById("center-panel")!.classList.add("hidden");
  notify(t(data.room.introKey));
  playSfx("door");
  startAmbient("dungeon");
  updateHud();

  // Single-player: no multiplayer dungeon room
  if (!SOLO_ONLY) {
    try {
      if (roomClient) {
        await roomClient.leave();
        roomClient = null;
      }
      if (!colyseusClient) colyseusClient = new Client(WS_URL);
      const partyId = party?.id || character.id;
      dungeonRoom = await colyseusClient.joinOrCreate("dungeon", {
        dungeonId: id,
        partyId,
        roomId: roomId,
        character,
      });
      wireRoomMessages(dungeonRoom, "dungeon");
    } catch (e) {
      console.warn("Dungeon multiplayer unavailable", e);
    }
  }
}

async function leaveDungeonToHub(): Promise<void> {
  if (dungeonRoom) {
    try {
      dungeonRoom.send("leave_dungeon");
      await dungeonRoom.leave();
    } catch {
      /* ok */
    }
    dungeonRoom = null;
  }
  dungeonId = null;
  roomId = null;
  for (const [, m] of otherPlayers) world.scene.remove(m);
  otherPlayers.clear();
  const town = character?.position.townId || "rimeport";
  world.loadTown(town);
  player.position.set(0, 1.6, 10);
  mode = "explore";
  startAmbient("town");
  playSfx("door");
  if (character) {
    character.position.dungeonId = undefined;
    character.position.townId = town;
  }
  if (!SOLO_ONLY) {
    try {
      if (!colyseusClient) colyseusClient = new Client(WS_URL);
      roomClient = await colyseusClient.joinOrCreate("hub", { townId: town, character });
      wireRoomMessages(roomClient, "hub");
    } catch {
      /* solo */
    }
  }
  updateHud();
}

async function startCombat(enemyType: string, count: number): Promise<void> {
  if (!character) return;
  // Prefer shared multiplayer combat inside dungeon instance
  if (dungeonRoom) {
    dungeonRoom.send("start_combat", { enemyType, count });
    return;
  }
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
  combatScene.attachOrbit(canvas);
  renderCombat();
  startAmbient("combat");
  playSfx("ui_open");
  notify(t("combat.start"));
}

function combatLegalMoves(me: { x: number; y: number }): Array<{ x: number; y: number }> {
  if (!combat) return [];
  const blocked = new Set(combat.blocked.map((b) => `${b.x},${b.y}`));
  const occ = new Set(
    combat.combatants.filter((c) => c.life > 0).map((c) => `${c.x},${c.y}`)
  );
  const out: Array<{ x: number; y: number }> = [];
  for (let x = 0; x < combat.width; x++) {
    for (let y = 0; y < combat.height; y++) {
      const dist = Math.abs(x - me.x) + Math.abs(y - me.y);
      if (dist < 1 || dist > 3) continue;
      const k = `${x},${y}`;
      if (blocked.has(k) || occ.has(k)) continue;
      out.push({ x, y });
    }
  }
  return out;
}

/** Best move tile that reduces distance to target (Manhattan, max step 3). */
function stepToward(
  me: { x: number; y: number },
  target: { x: number; y: number }
): { x: number; y: number } | null {
  const moves = combatLegalMoves(me);
  if (!moves.length) return null;
  let best = moves[0];
  let bestD = 999;
  for (const m of moves) {
    const d = Math.abs(m.x - target.x) + Math.abs(m.y - target.y);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
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
  const potions = character.inventory.filter((i) => i.itemId === "potion_heal" || i.itemId === "potion_focus");
  ui.innerHTML = `
    <h2>${t("mode.combat")} · R${combat.round}</h2>
    <div style="font-size:0.85rem;margin-bottom:8px">
      ${combat.combatants
        .map(
          (c) =>
            `<div style="color:${c.id === combat!.activeId ? "#b8860b" : c.life <= 0 ? "#666" : "#c4b49a"}">${c.name}: ${c.life}/${c.lifeMax} LE · AT${c.at}/PA${c.pa}${c.life <= 0 ? " ✕" : ""}</div>`
        )
        .join("")}
    </div>
    ${
      active && me
        ? `<div style="display:flex;flex-direction:column;gap:6px">
        <p style="font-size:0.8rem;color:#b8a88a;margin:0">${
          player.touchMode
            ? "Tap Move, then Attack. Or use Charge to close in."
            : "Move (button or click tile, max 3), then Attack."
        }</p>
        ${enemies
          .map((e) => {
            const toward = stepToward(me, e);
            const adj =
              Math.abs(me.x - e.x) <= 1 && Math.abs(me.y - e.y) <= 1 && !(me.x === e.x && me.y === e.y);
            const chance = hitChancePercent(me.at, e.pa);
            return `<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:6px">
              ${
                toward && !adj
                  ? `<button class="btn" data-movex="${toward.x}" data-movey="${toward.y}">${t("ui.move") || "Move"} → ${e.name}</button>
                     <button class="btn primary" data-charge="${e.id}" data-cx="${toward.x}" data-cy="${toward.y}">Charge → ${e.name}</button>`
                  : ""
              }
              <button class="btn danger" data-atk="${e.id}">
                ${t("ui.attack")} ${e.name} (${chance}%)${adj ? "" : " · close first"}
              </button>
            </div>`;
          })
          .join("")}
        <button class="btn" id="c-def">${t("ui.defend")}</button>
        <button class="btn" id="c-flee">${t("ui.flee")}</button>
        ${potions
          .map(
            (p) =>
              `<button class="btn" data-item="${p.itemId}">${t("ui.use") || "Use"} ${t(`item.${p.itemId}`) || p.itemId} (×${p.qty})</button>`
          )
          .join("")}
        ${
          character.focusMax > 0
            ? `<button class="btn" id="c-spark">${t("ui.cast")}: Spark</button>
               <button class="btn" id="c-balm">${t("ui.cast")}: Balm</button>`
            : ""
        }
      </div>`
        : `<p>${t("combat.not_your_turn") || "Enemy turn…"}</p>`
    }
    <div class="combat-grid-hint">${combat.log.slice(-5).map(formatCombatLog).join(" · ")}</div>
  `;
  ui.querySelectorAll("[data-atk]").forEach((b) => {
    (b as HTMLButtonElement).onclick = () =>
      combatAction({ kind: "attack", targetId: (b as HTMLElement).dataset.atk! });
  });
  ui.querySelectorAll("[data-movex]").forEach((b) => {
    (b as HTMLButtonElement).onclick = () =>
      combatAction({
        kind: "move",
        x: Number((b as HTMLElement).dataset.movex),
        y: Number((b as HTMLElement).dataset.movey),
      });
  });
  ui.querySelectorAll("[data-charge]").forEach((b) => {
    (b as HTMLButtonElement).onclick = async () => {
      const el = b as HTMLElement;
      await combatAction({
        kind: "move",
        x: Number(el.dataset.cx),
        y: Number(el.dataset.cy),
      });
      // After move, if still our turn and adjacent, strike
      if (combat && character && combat.activeId === character.id) {
        const me2 = combat.combatants.find((c) => c.id === character!.id);
        const foe = combat.combatants.find((c) => c.id === el.dataset.charge && c.life > 0);
        if (
          me2 &&
          foe &&
          Math.abs(me2.x - foe.x) <= 1 &&
          Math.abs(me2.y - foe.y) <= 1 &&
          !(me2.x === foe.x && me2.y === foe.y)
        ) {
          await combatAction({ kind: "attack", targetId: foe.id });
        }
      }
    };
  });
  ui.querySelectorAll("[data-item]").forEach((b) => {
    (b as HTMLButtonElement).onclick = () =>
      combatAction({ kind: "item", itemId: (b as HTMLElement).dataset.item! });
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

  // Board click-to-move when it's your turn
  if (active && me) {
    combatScene.attachOrbit(canvas);
    canvas.onclick = (ev) => {
      if (mode !== "combat" || !combat) return;
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
      const tile = combatScene.pickTile(ndcX, ndcY);
      if (!tile) return;
      const legal = combatLegalMoves(me).some((m) => m.x === tile.x && m.y === tile.y);
      if (legal) void combatAction({ kind: "move", x: tile.x, y: tile.y });
    };
  }
}

async function combatAction(action: object): Promise<void> {
  if (!character || !combat) return;
  // Shared dungeon combat
  if (dungeonRoom) {
    const a = action as { kind?: string };
    playSfx(a.kind === "cast" || a.kind === "item" ? "cast" : "ui_click");
    dungeonRoom.send("combat_action", { action });
    return;
  }
  try {
    const prevLogLen = combat.log.length;
    const data = await api("/api/combat/action", {
      method: "POST",
      body: JSON.stringify({ combatId: combat.id, characterId: character.id, action }),
    });
    // Surface errors that didn't advance combat
    if (data.notifications?.length && data.state?.activeId === character.id && data.state?.round === combat.round) {
      const notes = data.notifications as string[];
      if (notes.some((n) => n.includes("out_of_melee") || n.includes("invalid") || n.includes("occupied") || n.includes("too_far") || n.includes("not_your") || n.includes("no_item") || n.includes("bad"))) {
        for (const n of notes) {
          if (n === "combat.out_of_melee") notify(t("combat.out_of_melee") || "Too far — Move adjacent first!", "warn");
          else if (n === "combat.move_too_far") notify("Too far to move (max 3 tiles)", "warn");
          else if (n === "miss" || n === "combat.miss") {
            /* handled below */
          } else if (!n.startsWith("hit:") && !n.startsWith("heal:")) notify(t(n) || n, "warn");
        }
        if (notes.includes("combat.out_of_melee") || notes.includes("combat.move_too_far") || notes.includes("combat.occupied") || notes.includes("combat.invalid_tile") || notes.includes("combat.blocked") || notes.includes("combat.not_your_turn") || notes.includes("combat.no_item") || notes.includes("combat.bad_item")) {
          playSfx("miss");
          if (data.state) {
            combat = data.state;
            combatScene.setState(combat);
          }
          renderCombat();
          return;
        }
      }
    }
    combat = data.state;
    if (data.character) character = data.character;
    if (combat) combatScene.setState(combat);
    const a = action as { kind?: string };
    // SFX from log outcome
    const newLogs: string[] = combat?.log.slice(prevLogLen) ?? [];
    if (newLogs.some((l) => l.startsWith("combat.hit") || l.startsWith("combat.spark"))) playSfx("hit");
    else if (newLogs.some((l) => l.startsWith("combat.miss"))) playSfx("miss");
    else if (a.kind === "cast" || a.kind === "item") playSfx("cast");
    else if (a.kind === "move") playSfx("ui_click");
    if (data.notifications?.some((n: string) => String(n).startsWith("hit:"))) {
      const h = data.notifications.find((n: string) => String(n).startsWith("hit:"));
      if (h) notify(`Hit for ${String(h).split(":")[1]}!`, "loot");
    }
    if (data.ended) {
      document.getElementById("combat-ui")!.classList.add("hidden");
      canvas.onclick = null;
      combat = null;
      combatScene.setSelected(null);
      combatScene.detachOrbit();
      mode = dungeonId ? "dungeon" : "explore";
      player.enabled = true;
      if (data.ended === "victory") {
        playSfx("victory");
        notify(t("combat.victory"), "quest");
        if (data.exp) notify(t("notify.exp", { n: data.exp }) || `+${data.exp} EXP`);
        if (data.loot?.length) {
          for (const L of data.loot as Array<{ itemId: string; qty: number }>) {
            notify(
              `+ ${L.qty}× ${t(`item.${L.itemId}`) || L.itemId}`,
              "loot"
            );
          }
        }
        const prevLevel = character?.level ?? 1;
        if (data.character) character = data.character;
        if (character && character.level > prevLevel) {
          playSfx("levelup");
          notify(t("notify.levelup") || "Level up!", "quest");
        }
        startAmbient(dungeonId ? "dungeon" : "town");
      } else if (data.ended === "defeat") {
        playSfx("defeat");
        if (data.character) character = data.character;
        dungeonId = null;
        roomId = null;
        world.loadTown("rimeport");
        player.position.set(-8, 1.6, -4);
        showPanel(
          `<h2>${t("combat.defeat") || "Defeated"}</h2>
          <p>${getLocale() === "de" ? "Du wachst in Rimeport auf — angeschlagen, aber am Leben. Heile im Tempel, am Lager, oder mit Tränken." : "You wake in Rimeport — battered but alive. Heal at the temple, camp, or use potions."}</p>
          <button class="btn primary" id="defeat-ok">${t("ui.continue") || "Continue"}</button>`
        );
        document.getElementById("defeat-ok")!.onclick = () => {
          document.getElementById("center-panel")!.classList.add("hidden");
          player.enabled = true;
        };
        notify(t("combat.defeat"), "warn");
        mode = "explore";
        startAmbient("town");
      } else {
        notify(t("combat.fled"));
        startAmbient(dungeonId ? "dungeon" : "town");
      }
      updateHud();
      return;
    }
    renderCombat();
    updateHud();
  } catch (e: any) {
    notify(String(e.message || e), "warn");
  }
}

function npcPortraitUrl(npcId: string): string {
  // Prefer exact id, then fall back to role-style files we ship
  const candidates = [
    npcId,
    npcId.replace(/^npc_/, ""),
  ];
  // Content uses npc_leaf_elder etc.; files are portraits/npc_*.png
  return `${BASE}portraits/${npcId}.png`;
}

function showDialogue(): void {
  if (!dialogue) return;
  player.enabled = false;
  document.exitPointerLock();
  const portrait = npcPortraitUrl(dialogue.npcId);
  showPanel(
    `<h2>${t("ui.talk")}</h2>
    <img class="npc-portrait" src="${portrait}" alt="" onerror="this.style.display='none'" />
    <p>${t(dialogue.textKey)}</p>
    <div class="topic-list" style="clear:both">
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
          void progressQuest("pactcinder", "hear_envoy").then(() => {
            if (character) {
              character.knownMapNodes = [...new Set([...character.knownMapNodes, "mine_ash_entrance", "road_south"])];
            }
          });
        }
        if (topic === "rumors" && character && !character.questFlags.foxbrand) {
          void progressQuest("foxbrand", "tavern_rumor");
        }
        if (topic === "foxbrand" && character && character.questFlags.foxbrand) {
          void progressQuest("foxbrand", "smith_mooniron");
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

const DUNGEON_FROM_INTERACT: Record<string, string> = {
  dungeon_cult: "cult_cellars",
  dungeon_crypt: "ice_crypt",
  dungeon_mine: "mine_ash",
  cult_cellars: "cult_cellars",
  ice_crypt: "ice_crypt",
  mine_ash: "mine_ash",
};

function openNpcDialogue(npcId: string): void {
  if (!character) return;
  if (roomClient) {
    roomClient.send("interact", { targetId: npcId });
    return;
  }
  const town = TOWNS[character.position.townId || "rimeport"];
  const npc = town?.npcs.find((n) => n.id === npcId);
  if (npc) {
    dialogue = { npcId: npc.id, textKey: npc.greetingKey, topics: npc.topics };
    showDialogue();
  } else {
    // Building tagged with npc id but no NPC record — still open a simple greeting
    dialogue = {
      npcId,
      textKey: "npc.merchant.greeting",
      topics: ["farewell"],
    };
    showDialogue();
  }
}

function interiorKindForBuilding(buildingId: string, interact?: string): import("./game/world").InteriorKind {
  const id = `${buildingId} ${interact || ""}`.toLowerCase();
  if (id.includes("tavern") || id.includes("inn")) return "tavern";
  if (id.includes("temple") || id.includes("priest")) return "temple";
  if (id.includes("smith") || id.includes("forge")) return "smithy";
  if (id.includes("market") || id.includes("merchant") || id.includes("buyer")) return "market";
  if (id.includes("grove") || id.includes("hall") || id.includes("bark")) return "hall";
  return "generic";
}

/** Building door: enter walkable interior or quick actions */
function openBuilding(interactId: string): void {
  if (!character) return;
  const townId = character.position.townId || "rimeport";
  const town = TOWNS[townId];
  const building = town?.buildings.find(
    (b) => b.id === interactId || b.interact === interactId
  );
  const npcId = building?.interact?.startsWith("npc")
    ? building.interact
    : interactId.startsWith("npc")
      ? interactId
      : null;
  const npc = npcId ? town?.npcs.find((n) => n.id === npcId) : undefined;
  const title = building
    ? t(building.labelKey) || building.id
    : t(`place.${townId}`);
  const canShop =
    !!npc &&
    (npc.kind === "merchant" || npc.kind === "smith" || npc.kind === "innkeep");
  const canRest = !!npc && (npc.kind === "innkeep" || npc.kind === "priest");
  const kind = interiorKindForBuilding(building?.id || interactId, building?.interact);
  playSfx("door");
  showPanel(
    `<h2><img src="${BASE}ui/door_icon.png" alt="" width="28" height="28" style="vertical-align:middle;margin-right:6px;border-radius:4px" />${title}</h2>
    <p style="font-size:0.9rem;color:#c4b49a">${
      getLocale() === "de"
        ? "Tür offen. Tritt ein und sieh dich um — oder sprich gleich mit dem Personal."
        : "The door is open. Step inside to look around, or deal with the staff."
    }</p>
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
      <button class="btn primary" id="b-enter">${getLocale() === "de" ? "Eintreten (3D)" : "Enter (walk inside)"}</button>
      ${npc ? `<button class="btn" id="b-talk">${t("ui.talk")}</button>` : ""}
      ${canShop ? `<button class="btn" id="b-shop">${t("ui.shop") || "Shop"}</button>` : ""}
      ${canRest ? `<button class="btn" id="b-rest">${t("ui.camp") || "Rest"}</button>` : ""}
      <button class="btn" id="b-leave">${t("ui.close") || "Close"}</button>
    </div>`
  );
  document.getElementById("b-enter")!.onclick = () => {
    document.getElementById("center-panel")!.classList.add("hidden");
    world.interiorReturnTownId = townId;
    world.loadInterior(kind, building?.id || interactId);
    mode = "explore"; // still first-person explore controls
    // Tag mode for exit handling via world interior_exit
    (mode as string);
    player.position.set(0, 1.6, 5);
    player.yaw = Math.PI;
    player.enabled = true;
    character!.position = {
      ...character!.position,
      townId,
      dungeonId: undefined,
      x: 0,
      y: 1.6,
      z: 5,
      yaw: Math.PI,
    };
    // Stash interior flag
    character!.questFlags.__interior = building?.id || interactId;
    character!.questFlags.__interior_npc = npcId || "";
    startAmbient("town");
    playSfx("door");
    notify(
      getLocale() === "de"
        ? "Drinnen. Gehe zur Tür zum Verlassen, nach hinten für Dienste."
        : "Inside. Door to leave; walk to the back for services.",
      "info"
    );
    updateHud();
    (window as any).__embertrailSyncMobile?.();
  };
  const talk = document.getElementById("b-talk");
  if (talk && npcId)
    talk.onclick = () => {
      document.getElementById("center-panel")!.classList.add("hidden");
      openNpcDialogue(npcId);
    };
  const shop = document.getElementById("b-shop");
  if (shop)
    shop.onclick = () => {
      document.getElementById("center-panel")!.classList.add("hidden");
      void showShop();
    };
  const rest = document.getElementById("b-rest");
  if (rest)
    rest.onclick = async () => {
      try {
        const data = await api("/api/camp", {
          method: "POST",
          body: JSON.stringify({ characterId: character!.id }),
        });
        character = data.character;
        updateHud();
        playSfx("cast");
        notify(
          getLocale() === "de"
            ? "Du ruhst dich aus und heilst."
            : "You rest and recover.",
          "loot"
        );
        document.getElementById("center-panel")!.classList.add("hidden");
      } catch {
        notify(t("travel.starving") || "Need rations to rest.", "warn");
      }
    };
  document.getElementById("b-leave")!.onclick = () => {
    document.getElementById("center-panel")!.classList.add("hidden");
    player.enabled = true;
  };
}

async function tryInteract(): Promise<void> {
  if (!character || mode === "combat") return;
  const near = world.nearestInteractable(player.position);
  if (!near) {
    notify(
      getLocale() === "de"
        ? "Nichts in Reichweite. Geh näher an Türen, NPCs oder Schatz."
        : "Nothing in range. Move closer to doors, people, or loot.",
      "info"
    );
    return;
  }

  playSfx("ui_click");

  // Leave walkable building interior
  if (near.kind === "interior_exit") {
    const townId =
      world.interiorReturnTownId ||
      character.position.townId ||
      "rimeport";
    delete character.questFlags.__interior;
    delete character.questFlags.__interior_npc;
    world.interiorReturnTownId = null;
    world.loadTown(townId);
    const spawn = TOWNS[townId]?.spawn;
    player.position.set(spawn?.x ?? 0, 1.6, spawn?.z ?? 10);
    player.yaw = spawn?.yaw ?? 0;
    character.position = {
      townId,
      x: player.position.x,
      y: 1.6,
      z: player.position.z,
      yaw: player.yaw,
    };
    mode = "explore";
    playSfx("door");
    startAmbient("town");
    notify(getLocale() === "de" ? "Zurück auf die Straße." : "Back on the street.", "info");
    updateHud();
    return;
  }
  if (near.kind === "interior_service") {
    const npcId = String(character.questFlags.__interior_npc || "");
    const town = TOWNS[character.position.townId || "rimeport"];
    const npc = npcId ? town?.npcs.find((n) => n.id === npcId) : undefined;
    const canShop =
      !!npc &&
      (npc.kind === "merchant" || npc.kind === "smith" || npc.kind === "innkeep");
    const canRest = !!npc && (npc.kind === "innkeep" || npc.kind === "priest");
    showPanel(
      `<h2>${getLocale() === "de" ? "Service" : "Service"}</h2>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${npcId ? `<button class="btn primary" id="is-talk">${t("ui.talk")}</button>` : ""}
        ${canShop ? `<button class="btn" id="is-shop">${t("ui.shop")}</button>` : ""}
        ${canRest ? `<button class="btn" id="is-rest">${t("ui.camp")}</button>` : ""}
        <button class="btn" id="is-close">${t("ui.close")}</button>
      </div>`
    );
    if (npcId)
      document.getElementById("is-talk")!.onclick = () => {
        document.getElementById("center-panel")!.classList.add("hidden");
        openNpcDialogue(npcId);
      };
    const shopBtn = document.getElementById("is-shop");
    if (shopBtn)
      shopBtn.onclick = () => {
        document.getElementById("center-panel")!.classList.add("hidden");
        void showShop();
      };
    const restBtn = document.getElementById("is-rest");
    if (restBtn)
      restBtn.onclick = async () => {
        try {
          const data = await api("/api/camp", {
            method: "POST",
            body: JSON.stringify({ characterId: character!.id }),
          });
          character = data.character;
          updateHud();
          playSfx("cast");
          notify(getLocale() === "de" ? "Ausgeruht." : "Rested.", "loot");
          document.getElementById("center-panel")!.classList.add("hidden");
        } catch {
          notify(t("travel.starving") || "Need rations.", "warn");
        }
      };
    document.getElementById("is-close")!.onclick = () => {
      document.getElementById("center-panel")!.classList.add("hidden");
      player.enabled = true;
    };
    return;
  }

  // Dungeon entrances on buildings (cult cellars, ice crypt)
  if (near.kind === "dungeon" || near.id.startsWith("dungeon_")) {
    const key = DUNGEON_FROM_INTERACT[near.id] || near.id.replace(/^dungeon_/, "");
    const dungeonKey =
      key === "cult" ? "cult_cellars" : key === "crypt" ? "ice_crypt" : key;
    await enterDungeon(DUNGEON_FROM_INTERACT[near.id] || dungeonKey);
    return;
  }

  if (near.kind === "npc") {
    // Prefer building menu when this is a building door (npc id on building)
    const town = TOWNS[character.position.townId || "rimeport"];
    const asBuilding = town?.buildings.some((b) => b.interact === near.id);
    if (asBuilding && mode === "explore") {
      openBuilding(near.id);
    } else {
      openNpcDialogue(near.id);
    }
    return;
  }

  if (near.kind === "building") {
    openBuilding(near.id);
    return;
  }

  if (near.kind === "travel") {
    showTravel();
    return;
  }
  if (near.kind === "quest_board") {
    await openQuestBoard();
    return;
  }
  if (near.kind === "encounter") {
    const type = near.id.replace("encounter_", "");
    await startCombat(type, type === "ash_guardian" || type === "frost_wight" ? 1 : 2);
    return;
  }
  if (near.kind === "exit") {
    await leaveDungeonToHub();
    notify(t("ui.leave") || "You leave.");
    return;
  }
  if (near.kind === "door" && dungeonId && roomId) {
    const dungeon = DUNGEONS[dungeonId];
    const room = dungeon.rooms.find((r) => r.id === roomId);
    const feature = room?.features.find((f) => f.id === near.id);
    const to = feature?.data?.to as string | undefined;
    if (to) {
      roomId = to;
      if (character.position) character.position.dungeonId = dungeonId;
      world.loadDungeonRoom(dungeonId, to);
      player.position.set(0, 1.6, 6);
      if (dungeonRoom) dungeonRoom.send("change_room", { roomId: to });
      playSfx("door");
      const nr = dungeon.rooms.find((r) => r.id === to);
      if (nr) notify(t(nr.introKey));
      updateHud();
      if (OFFLINE) {
        try {
          saveOfflineCharacter({
            ...character,
            position: { ...character.position, dungeonId, x: 0, y: 1.6, z: 6, yaw: Math.PI },
          });
        } catch {
          /* ok */
        }
      }
    } else {
      notify("Door won't open.", "warn");
    }
    return;
  }
  if (
    (near.kind === "greed" ||
      near.kind === "boss" ||
      near.kind === "chest" ||
      near.kind === "puzzle") &&
    dungeonId &&
    roomId
  ) {
    if (near.kind === "greed") {
      showPanel(
        `<h2>${t("dungeon.mine.greed")}</h2>
        <button class="btn danger" id="g-all">${t("dungeon.mine.greed.take_all")}</button>
        <button class="btn primary" id="g-need">${t("dungeon.mine.greed.take_need")}</button>`
      );
      document.getElementById("g-all")!.onclick = () => void useFeature(near.id, "take_all");
      document.getElementById("g-need")!.onclick = () => void useFeature(near.id, "take_need");
      return;
    }
    await useFeature(near.id);
    if (near.kind === "boss") {
      await startCombat(dungeonId === "mine_ash" ? "ash_guardian" : "frost_wight", 1);
    }
    return;
  }

  notify(
    getLocale() === "de" ? `Unbekannt: ${near.kind}` : `Unhandled: ${near.kind}`,
    "warn"
  );
}

async function useFeature(featureId: string, choice?: string): Promise<void> {
  if (!character || !dungeonId || !roomId) return;
  try {
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
    playSfx("buy");
    const notes = (data.notifications as string[] | undefined) ?? [];
    if (notes.includes("notify.item_gained")) {
      notify(t("notify.item_gained", { item: "loot" }) || "You found something!", "loot");
    } else if (notes.includes("notify.puzzle_ok")) {
      notify(
        getLocale() === "de" ? "Rätsel gelöst!" : "Puzzle solved!",
        "quest"
      );
    } else {
      notify(t("notify.quest_update") || "Progress updated.", "quest");
    }
    // Show last inventory items briefly
    const last = character.inventory[character.inventory.length - 1];
    if (last && notes.includes("notify.item_gained")) {
      notify(`+ ${last.qty}× ${t(`item.${last.itemId}`) || last.itemId}`, "loot");
    }
    updateHud();
    if (OFFLINE) {
      try {
        saveOfflineCharacter(character);
      } catch {
        /* ok */
      }
    }
  } catch (e: any) {
    notify(String(e.message || e), "warn");
  }
}

// Chat
document.getElementById("chat-input")!.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const input = e.target as HTMLInputElement;
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  if (dungeonRoom) dungeonRoom.send("chat", { text });
  else if (roomClient) roomClient.send("chat", { channel: "local", text });
  else {
    const log = document.getElementById("chat-log")!;
    const line = document.createElement("div");
    line.textContent = `[local] you: ${text}`;
    log.appendChild(line);
  }
});

// Title buttons
document.getElementById("btn-guest")!.onclick = () => {
  unlockAudio();
  void ensureGuestAndQuickStart();
};
document.getElementById("btn-continue")!.onclick = async () => {
  unlockAudio();
  const saved = getOfflineCharacter();
  if (!saved) {
    notify("No save found — start a new game.", "warn");
    return;
  }
  character = saved;
  token = localStorage.getItem("embertrail_token") || "offline";
  await enterGame();
  notify(getLocale() === "de" ? `Willkommen zurück, ${saved.name}.` : `Welcome back, ${saved.name}.`, "quest");
};
document.getElementById("btn-create")!.onclick = async () => {
  unlockAudio();
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

// Mute toggle
const muteBtn = document.createElement("button");
muteBtn.className = "btn lang-toggle";
muteBtn.style.top = "48px";
muteBtn.id = "mute-btn";
muteBtn.textContent = isMuted() ? "Unmute" : "Mute";
document.getElementById("title-screen")!.appendChild(muteBtn);
muteBtn.onclick = () => {
  setMuted(!isMuted());
  muteBtn.textContent = isMuted() ? "Unmute" : "Mute";
  playSfx("ui_click");
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
    if (moveAcc > 0.1 && character) {
      moveAcc = 0;
      const payload = {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        yaw: player.yaw,
      };
      character.position = {
        ...character.position,
        x: payload.x,
        y: payload.y,
        z: payload.z,
        yaw: payload.yaw,
      };
      if (dungeonRoom) dungeonRoom.send("move", payload);
      else if (roomClient) roomClient.send("move", payload);
    }
    const near = world.nearestInteractable(player.position);
    const prompt = document.getElementById("interact-prompt")!;
    const btnInteract = document.getElementById("btn-interact");
    if (near) {
      prompt.classList.remove("hidden");
      const labelMap: Record<string, string> = {
        npc: t("ui.talk"),
        building: getLocale() === "de" ? "Eintreten" : "Enter",
        dungeon: t("ui.enter_dungeon") || "Enter",
        travel: t("ui.travel"),
        quest_board: t("place.quest_board") || "Board",
        encounter: t("ui.attack") || "Fight",
        exit: t("ui.leave") || "Leave",
        interior_exit: t("ui.leave") || "Leave",
        interior_service: getLocale() === "de" ? "Service" : "Service",
        door: t("ui.enter_dungeon") || "Door",
        chest: "Loot",
        boss: "Boss",
        greed: "Treasure",
        puzzle: "Puzzle",
      };
      const label = labelMap[near.kind] || near.kind;
      // Prefer localized enter for buildings
      const short =
        near.kind === "building"
          ? getLocale() === "de"
            ? "Eintreten"
            : "Enter"
          : label;
      prompt.textContent = player.touchMode ? short : `[E] ${short}`;
      btnInteract?.classList.add("show-interact");
      if (btnInteract) btnInteract.textContent = short;
    } else {
      prompt.classList.add("hidden");
      btnInteract?.classList.remove("show-interact");
    }
    renderer.render(world.scene, world.camera);
  } else {
    // title / create: still show world backdrop
    document.getElementById("btn-interact")?.classList.remove("show-interact");
    renderer.render(world.scene, world.camera);
  }
  // keep mobile chrome in sync
  (window as any).__embertrailSyncMobile?.();
}

// Day/night cycle (full loop ~2 minutes)
setInterval(() => {
  if (mode === "explore") {
    const t = (Date.now() / 120000) % 1;
    world.setTimeOfDay(t);
  }
}, 1000);

// Solo autosave every 4s while playing
setInterval(() => {
  if (!OFFLINE || !character) return;
  if (mode !== "explore" && mode !== "dungeon") return;
  character.position = {
    ...character.position,
    x: player.position.x,
    y: player.position.y,
    z: player.position.z,
    yaw: player.yaw,
    townId: character.position.townId,
    dungeonId: character.position.dungeonId,
  };
  try {
    saveOfflineCharacter(character);
  } catch {
    /* quota */
  }
}, 4000);

refreshI18nChrome();
document.getElementById("crosshair")!.classList.add("hidden");
// Load empty town bg on title
world.loadTown("rimeport");
player.enabled = false;
requestAnimationFrame(loop);

console.info("Embertrail / Glutpfad client ready");
