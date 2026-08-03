# Embertrail / Glutpfad

**Solo offline browser CRPG** set in the original world of **Cinderreach**.

| | |
|---|---|
| **English** | Embertrail |
| **Deutsch** | Glutpfad |
| **Play** | [GitHub Pages](https://pinkysworld.github.io/Embertrail/) |
| **Mode** | Single-player only (offline / localStorage) |

First-person towns and dungeons, classic overland travel with rations and weather, and tactical turn-based combat — playable entirely in the browser with no server required.

---

## Play online

Open **https://pinkysworld.github.io/Embertrail/**

1. Choose **English** or **Deutsch** (title screen).
2. **New Adventure** for a quickstart hero, or **Create Hero** for full character creation.
3. **Continue** resumes your last local save.

Progress is stored in the browser (`localStorage`). Clearing site data deletes the save.

---

## Features

- **First-person 3D** towns, building interiors, wilderness camps, and dungeons (Three.js)
- **Overland travel** — road graph, one day per segment, weather, rations, gear wear, random events
- **Tactical combat** — move / attack / charge / defend / flee / potions / simple spells
- **Character creation** — attributes, negative traits, 12 archetypes, skills, magic schools
- **Dual quest spine** — *Pact Cinder* and *Foxbrand Axe*, plus side jobs (wolves, herbs, cult)
- **Town life** — NPCs, dialogue, shops, temple rest, quest board, alchemy at camp
- **Bilingual UI** (EN / DE)
- **Mobile** — virtual stick + look drag + interact button
- **Autosave** — position, inventory, quests, dungeon room

> Multiplayer / Colyseus hubs are **not** part of this release. The game always runs in solo offline mode on static hosts.

---

## Controls

| Input | Action |
|-------|--------|
| **WASD** | Move |
| **Mouse** | Look (click canvas to lock pointer) |
| **E** | Interact (doors, NPCs, loot, exits) |
| **Escape** | Close panels |
| **Mode bar** | Journal, Map, Travel, Camp, Inventory, Shop, Quests, Help |
| **Touch** | Left stick move · drag right half to look · **Interact** button |

---

## Local development

```bash
npm install
npm run dev -w @embertrail/client
```

Open **http://localhost:5173** — the client uses the offline rules engine (no API server needed for solo play).

### Optional full monorepo (legacy server)

```bash
npm install
npm run dev          # client :5173 + server :2567
npm run test         # rules unit tests
npm run build        # all packages + client
```

For a production-style client build matching GitHub Pages:

```bash
GITHUB_PAGES=true npm run build -w @embertrail/client
```

Output: `apps/client/dist/` (base path `/Embertrail/`).

---

## Monorepo layout

```
apps/client      Vite + TypeScript + Three.js (solo product)
apps/server      Express + Colyseus + SQLite (optional / not used on Pages)
packages/rules   Game math: combat, travel, character, items (tested)
packages/shared  Shared types
packages/content World data, shops, quests, i18n (EN/DE)
```

### How solo play works

1. `apps/client/src/offlineApi.ts` mirrors REST-style endpoints in the browser.
2. Rules from `@embertrail/rules` resolve travel, combat, shops, and quests.
3. The character sheet is saved under `localStorage` key `embertrail_offline_char`.
4. Static deploy (GitHub Pages) sets base `/Embertrail/` and never requires the Node server.

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for package boundaries and data flow.  
See **[PLAYGUIDE.md](./PLAYGUIDE.md)** for gameplay, quests, and tips.

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev -w @embertrail/client` | Solo client only (recommended) |
| `npm run dev` | Client + optional server |
| `npm run test` | Rules unit tests (combat, travel, character) |
| `npm run build` | Build shared → rules → content → server → client |
| `GITHUB_PAGES=true npm run build -w @embertrail/client` | Pages artifact |

CI deploys `main` via `.github/workflows/pages.yml`.

---

## Content & IP

- Original setting: **Cinderreach** (towns, quests, items, lore written for this project).
- Art: generated / procedural textures and UI assets under `apps/client/public/`.
- Public docs avoid third-party CRPG product names.

---

## License / contributing

Personal / portfolio project. Feel free to fork for learning; no warranty.

Bug reports and solo-play fixes welcome. Multiplayer is out of scope for the current release.
