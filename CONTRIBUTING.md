# Contributing to Embertrail / Glutpfad

Thanks for interest in the solo offline CRPG.

## Scope

- **In scope:** single-player bugs, content, UI, rules, accessibility, docs.
- **Out of scope:** multiplayer / Colyseus hubs, live chat, cloud accounts (for this release).

## Setup

```bash
npm install
npm run dev          # client only (offline solo)
npm test             # rules unit tests
```

Optional server for experiments: `npm run dev:full`.

## Guidelines

1. Keep gameplay offline-first (`offlineApi.ts` + `@embertrail/rules`).
2. Add EN **and** DE strings in `packages/content/src/i18n/`.
3. Prefer `closePanel()` when dismissing UI so the player is not soft-locked.
4. Do not introduce third-party CRPG product names in public UI or README.
5. Run `npm test` and a client build before opening a PR.

## Docs

| File | Audience |
|------|----------|
| [README.md](./README.md) | Players & clone setup |
| [PLAYGUIDE.md](./PLAYGUIDE.md) | How to play |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Package layout & solo design |

## Pull requests

- Small, focused commits.
- Describe player-facing impact.
- No secrets or local design/legal dumps (`docs/`, `LEGAL.md` are intentionally private).
