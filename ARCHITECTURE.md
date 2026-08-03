# Embertrail architecture

Document for contributors and future maintainers. Describes the **solo offline product** shipped on GitHub Pages.

---

## Goals

| Goal | Approach |
|------|----------|
| Playable without a backend | Client-side rules + `localStorage` |
| Share rules with optional server | `packages/rules` pure functions |
| Static deploy | Vite base `/Embertrail/` when `GITHUB_PAGES=true` |
| Bilingual | `packages/content` i18n maps EN/DE |
| No multiplayer in release | `SOLO_ONLY = true`, chat hidden, Colyseus joins skipped |

---

## Package graph

```
@embertrail/shared   types (CharacterSheet, CombatState, …)
        ↑
@embertrail/rules    combat, travel, character, items, spells, checks
        ↑
@embertrail/content  TOWNS, DUNGEONS, SHOPS, QUESTS, i18n
        ↑
@embertrail/client   Three.js scenes + offlineApi + UI (main.ts)
        ↑ (optional)
@embertrail/server   Express REST + Colyseus rooms (not used on Pages)
```

Vite aliases point at **package `src/`** during development so the client does not depend on stale `dist/` builds.

---

## Client runtime (`apps/client`)

| Module | Role |
|--------|------|
| `src/main.ts` | Modes (title / create / explore / travel / combat / dungeon), UI panels, input, autosave |
| `src/offlineApi.ts` | In-browser implementation of `/api/*` used by the solo client |
| `src/game/world.ts` | Town / wilderness / dungeon / interior meshes, interactables |
| `src/game/combatScene.ts` | Grid combat board + orbit camera |
| `src/game/player.ts` | First-person controller + touch stick |
| `src/audio.ts` | Procedural Web Audio SFX + ambient |
| `src/i18n.ts` | Locale + `t(key)` over content maps |
| `public/` | Textures, icons, portraits, UI chrome |

### Modes

```
title → create | guest/continue
     → explore (town | interior | wilderness)
     → travel (panel-driven marches)
     → dungeon (room graph)
     → combat (grid overlay)
```

### Persistence keys

| Key | Contents |
|-----|----------|
| `embertrail_offline_char` | Full `CharacterSheet` JSON |
| `embertrail_offline_combat` | Active combat state (if mid-fight) |
| `embertrail_mute` / `embertrail_vol` | Audio prefs |
| `embertrail_locale` | `en` \| `de` (via i18n helper) |

### Solo flags

```ts
const OFFLINE = isOfflineMode() || true; // force offline rules
const SOLO_ONLY = true;                  // skip Colyseus
```

`isOfflineMode()` also detects `github.io`, `file:`, empty port static hosts, and `embertrail_offline=1`.

---

## Offline API surface

`offlineApi(path, opts)` handles the same paths the server historically exposed, including:

- Auth/guest + character create/list (local only)
- `/api/travel` — `resolveTravelLeg` + `applyTravelToCharacter`
- `/api/combat/start`, `/api/combat/action` — consume potions **after** successful apply
- `/api/dungeon/enter`, room transitions via character `position.roomId`
- `/api/item/use`, `/api/item/equip`
- `/api/shop/buy|sell`, `/api/camp`, `/api/alchemy/brew`
- `/api/quest/progress`, `/api/quest/turnin`

Quest flags use free-form keys, e.g. `mine_ash:room1:enc_clear`, `mine_ash:feature:chest_1`, `__interior`.

---

## Rules package

Pure TypeScript, tested with Node’s test runner + `tsx`:

| File | Responsibility |
|------|----------------|
| `character.ts` | Creation, life/focus, **multi-level** `applyLevelUp` |
| `combat.ts` | Grid combat, AT/PA, LoS, AI helpers |
| `travel.ts` | Graph, BFS path, leg resolution, wear, camp rest |
| `items.ts` | Item defs, alchemy recipes |
| `checks.ts` / `rng.ts` | Skill checks, seeded RNG |

Run: `npm run test -w @embertrail/rules`.

---

## Content package

- **Towns** — spawn, buildings, NPCs (greeting + topic replies)
- **Dungeons** — rooms, doors, features, intro keys
- **Shops** — stock and services by town
- **Quests** — steps with requirements and rewards
- **i18n** — flat string tables (`en.ts`, `de.ts`)

Adding a town requires: travel graph node links, `TOWNS` entry, place/npc/item strings in both locales, optional shop.

---

## Optional server

`apps/server` still builds for local multiplayer experiments. It is **not** deployed with Pages and is **out of product scope**. Do not re-enable hubs without a full security/review pass (auth, validation, state sync).

---

## Deploy

`.github/workflows/pages.yml`:

1. `npm ci`
2. `GITHUB_PAGES=true npm run build -w @embertrail/client`
3. Upload `apps/client/dist` to GitHub Pages

---

## Coding conventions (solo)

- Prefer `closePanel()` over manually hiding `#center-panel` so movement re-enables.
- Guard double-taps with `actionBusy` / `withBusy` and interact debounce.
- Escape-HTML any dynamic combat/log names.
- User-facing strings: content i18n keys only (no third-party product names).
- Dispose Three.js materials via helpers in `materials.ts` when rebuilding scenes.

---

## Testing checklist (manual)

1. New Adventure → walk Rimeport → enter temple → rest.
2. Talk to envoy → Travel south → mine entrance → dungeon → fight → loot.
3. Inventory equip / use potion in combat.
4. Multi-day city march with camp continue.
5. Reload page → **Continue** restores position (town, wild, dungeon, or interior).
6. Language switch EN↔DE on title.
7. Mobile: stick, look, interact, combat buttons.
