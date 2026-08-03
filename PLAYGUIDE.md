# Embertrail / Glutpfad — Play Guide

Single-player offline browser CRPG. English UI: **Embertrail**. German UI: **Glutpfad**. Setting: **Cinderreach**.

---

## Getting started

1. Open the game (GitHub Pages or local Vite).
2. Pick language (**EN / DE** on the title screen).
3. **New Adventure** — pre-rolled hero, start in **Rimeport**.
4. **Create Hero** — name, gender, archetype, attribute roll, skill spends.
5. **Continue** — load the last autosave from this browser.

### Save system

- Autosave every few seconds while exploring or in a dungeon (position, life, inventory, flags).
- Also saves on tab close (`beforeunload`).
- Data lives in **localStorage** only — not synced across devices or browsers.

---

## Exploration (towns)

- Walk first-person through towns: **Rimeport**, **Irondeep**, **Mirehold**, **Oakspire**, and others on the map.
- **Doors / buildings** — open a menu: enter interior (3D), talk, shop, or rest (inn / temple).
- **NPCs** — topics unlock quest hooks (envoy, tavern, smith, priestess).
- **Quest board** — side contracts (e.g. wolves).
- **Mode bar** buttons work anywhere in explore mode (Inventory, Shop, Quests, Help, …).

### Building interiors

- **Enter (walk inside)** loads a small interior scene.
- Interact with the **door** to leave; walk to the **back** for talk / shop / rest.
- Interiors resume after reload if you saved while inside.

---

## Overland travel

Travel is day-based on a road graph (not free-roam overworld).

1. Open **Travel** (mode bar or road sign).
2. **Next leg** — one adjacent node, **1 day**.
3. **Journey to a city** — plans a multi-day path; each day is a separate march with rest/camp prompts.

### Each day may cost or inflict

| Effect | Notes |
|--------|--------|
| Rations | Used per leg; starvation damages life |
| Weather | Clear, rain, fog, blizzard flavor + modifiers |
| Boot / weapon wear | Durability drops; gear can break |
| Events | Merchants, hidden paths, wolf combat |
| Disease | Occasional cold / trail illness |

**Camp** spends rations (when required by rules) and restores life/focus. Alchemy recipes need herbs.

Wilderness nodes show a camp interactable. Dungeon approaches offer enter / camp / map.

---

## Dungeons

Three main sites (among others on the graph):

| Id | Role |
|----|------|
| **Mine of Ash** | Pact Cinder spine |
| **Cult Cellars** | Foxbrand / cult |
| **Ice Crypt** | Side / frost threats |

- Interact with dungeon doors or overland entrances.
- **Doors** move between rooms; **exit** returns to the last town hub.
- Features (chests, keys, one-shots) are claimed once (saved in quest flags).
- Encounters clear per room after victory.

---

## Combat

Turn-based grid when wolves, cultists, or bosses engage.

1. **Move** up to **3** tiles (button or click tile).
2. **Attack** only when **adjacent** (or use **Charge** to step then strike).
3. **Defend**, **Flee**, **potions**, and (casters) **Spark** / **Balm**.

Hit chance uses AT vs PA (shown on attack buttons). Defeat wakes you in Rimeport, battered but alive.

---

## Inventory & economy

- **Use** consumables (heal / focus potions, coin stacks).
- **Equip / unequip** weapons, shields, armor, boots.
- **Shops** buy and sell by copper (gold/silver convert automatically).
- Quest items (Pact Cinder, Foxbrand Axe, keys, sigils) are not freely sold when flagged.

Currency: **1 gold = 100 copper**, **1 silver = 10 copper**.

---

## Quests (solo backlog covered)

### Main spines

1. **Pact Cinder**  
   - Hear the envoy in Rimeport → explore the **Mine of Ash** → recover the cinder → deliver to **Irondeep** (alliance) or sell in **Mirehold**.

2. **Foxbrand Axe**  
   - Tavern rumors → smith / moon-iron → **Cult Cellars** (and related) → claim the axe → turn in when ready.

### Side content

- **Wolves** — quest board in Rimeport; clear pack encounters; report back.
- **Herbs** — gather woundwort / frostleaf / emberroot; deliver in **Oakspire**.
- **Cult sigil** — dungeon loot; turn in in Rimeport when held.

Track steps under **Quests** and **Journal**.

---

## Tips

- Stock **rations** and **potions** before long marches.
- **Temple / inn rest** is safer than starving on the road.
- Keep a spare weapon if trail wear is high.
- Use **Help** in the mode bar for a short in-game reminder.
- **Mute** is on the title screen and top-right while playing.
- **Escape** always closes the center panel and re-enables movement.

---

## Accessibility / mobile

- Touch controls appear on touch devices.
- Panels are scrollable; shop and inventory use large buttons.
- Language can be switched any time from the title screen language control (reload title or use DE/EN if exposed).

---

## What is *not* in this release

- Multiplayer hubs, party sync, shared dungeon instances, live chat
- Account servers / cloud saves
- Full magic school tree beyond starter combat casts

Solo systems above are implemented for offline play.
