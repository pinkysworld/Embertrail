# Embertrail / Glutpfad

Browser MMO-lite party CRPG: first-person towns and dungeons, travel survival, and tactical grid combat.

**EN:** Embertrail · **DE:** Glutpfad  
**Setting:** Cinderreach

## Features

- First-person 3D towns & dungeons (Three.js)
- Overworld travel with weather, rations, disease, gear wear
- Tactical turn-based combat (attack/parry, hit %, line of sight)
- Deep character creation: attributes, negative traits, 12 archetypes, skills, magic
- Shared multiplayer hubs, chat, parties
- Dual quest spine: **Pact Cinder** + **Foxbrand Axe**
- Bilingual UI (English / Deutsch)

## Quick start

```bash
npm install
npm run dev
```

- Client: http://localhost:5173  
- Server / API: http://localhost:2567  
- Health: http://localhost:2567/api/health  

**Play:** open the client → **Enter Cinderreach** (quickstart) or **Create Hero**.

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Look (click canvas to lock pointer) |
| E | Interact / talk |
| UI buttons | Journal, map, travel, camp, combat |

## Monorepo

```
apps/client   Vite + Three.js
apps/server   Express + Colyseus + SQLite
packages/rules    Shared game math (tested)
packages/shared   Types & protocol
packages/content  World data + i18n
```

## Scripts

- `npm run dev` — client + server
- `npm run test` — rules unit tests
