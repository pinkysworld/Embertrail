# Nordland DNA Research Brief

> **INTERNAL RESEARCH ONLY — NOT SHIPPABLE / NOT PLAYER-FACING.**  
> This file may discuss third-party game history for design comparison.  
> **Do not copy names from this document into `apps/` or `packages/`.**  
> Shippable names are listed in `LEGAL.md` and `tools/banned-ip-terms.json` (`allowedOriginals`).

**Project:** Embertrail / Glutpfad  
**Purpose:** Distill *genre* design DNA from classic 1990s party CRPGs for an original successor.  
**Scope:** Systems, presentation modes, quest patterns, failure modes, multiplayer notes, IP hygiene.  
**Rule:** Historical analysis may name third-party places/gods/artifacts. **All Embertrail shippable content uses original stand-ins only** (see §10 and LEGAL.md).

---

## Executive summary

The Nordland trilogy’s identity is not “isometric combat + 3D towns.” It is a **simulation-first party adventure** where:

1. **Exploration** (first-person towns/dungeons), **travel** (overland map as a survival layer), and **combat** (isometric tactical grid) are three equal modes with different tempos.
2. Characters are **deep and fallible**: attributes, *negative* attributes, many skills (some situational), magic as costly tools—not fireball spam.
3. Quests reward **investigation, preparation, and notes**, not quest markers.
4. Friction that creates atmosphere (food, weather, gear wear, disease) must stay; friction that creates **silent softlocks, silent item loss, or opaque math** must go.

*Sternenschweif* is the design north star for Embertrail: dual patrons, denser fewer dungeons, keyword dialogue, strong travel sim, better automap. *Schicksalsklinge* defines the open odyssey and map-piece structure. *Schatten über Riva* shows how to drop travel and go dense-urban / investigation / atmosphere.

---

## 1. Three presentation modes (and how each game evolved them)

### 1.1 Mode triangle

| Mode | View | Primary verbs | Tempo |
|------|------|---------------|--------|
| **Towns & dungeons** | First-person (pseudo-3D → true free-look 3D) | Walk, talk, search, open, camp, split party | Medium–slow; attention and inventory |
| **Map travel** | 2D overland routes / nodes | Choose path, camp, hunt, manage supplies, weather | Real-time pressure + resource drain |
| **Combat** | Isometric grid, turn-based | Move, AT/PA stance, shoot, cast, auto-combat | Discrete tactical rounds |

Switching modes is the trilogy’s grammar: you **prepare in town**, **suffer and discover on the road**, **resolve risk on the grid**, return to town to heal/repair/sell.

### 1.2 Evolution by title

#### *Die Schicksalsklinge* (1992) — foundations, rough edges

- **Towns/dungeons:** Grid-step first-person. Buildings look nearly identical; type is mostly via color-coded automap. Temples get unique facades. Dungeons are Wizardry-like: darkness without light, traps, text-box events, party split for some puzzles. Many settlements (~50) but a large share are shallow filler.
- **Travel:** Fixed routes between waypoints (CD later eases mid-route direction changes). Foot + boat. Nightly rest, food/water, watches, seasons (mountain passes closed in winter), random/fixed encounters. Simulation is present but can feel mechanical once patterns are learned.
- **Combat:** Isometric tactical grid (Gold Box kinship). Cautious / standard / fierce strikes trade AT vs PA. Ranged and spells **only in straight orthogonal lines**—no diagonal LoS. Computer auto-combat exists but is dumb. Low-level melee hit rates are notoriously poor.

#### *Sternenschweif* (1994) — peak of the formula

- **Towns/dungeons:** Real-time 3D (still often tile-snapped). Distinct building textures per business type; freer movement; look up/down. **Fewer full settlements** (~six meaningful hubs); minor villages reduced to 2–3 buildings (inn/temple). Dungeons: **fewer, multi-level, hand-crafted**, unique tilesets (sometimes per level), denser puzzles/traps/encounters; less combat-spam overall.
- **Travel:** Simulation **heightened**—shoes wear, weather planning matters more, disease from bad prep, real risk of running out of food. Routes branch; hidden paths and dangers. More engaging than *Schicksalsklinge*’s “rail between nodes.”
- **Combat:** **True line-of-fire** for bows and spells (not restricted to cardinal alignment)—ranged finally usable when enemies are surrounded. Per-hero auto-combat; optional “calc only / status bars” speed mode. Still no diagonal **melee**. Big enemies exist but often immobile.

#### *Schatten über Riva* (1996) — urban density, travel removed

- **Towns/dungeons:** Continuous free 3D (strafe, optional fullscreen UI). **One city + immediate hinterland**—no overland map mode. Atmosphere over population (empty streets, portraits in dialogue). Day/night affects guards and NPC presence (proto life-sim for infiltration). Exotic set pieces (underwater, shrunk insect hive with gear stripped). Late game shifts toward dungeon rush.
- **Travel:** **Removed.** Nature/travel skills largely orphaned; designers try to re-hook skills into story events (often “pick one PC for a vignette”).
- **Combat:** Same grid DNA; **richer auto-combat policies** (per-hero magic/ranged rules, auto-swap weapon when boxed in). Boss fights sometimes force manual control—yet some bosses are easy. Item distribution UI and containers are major QoL wins.

### 1.3 Embertrail implication

**Default product shape = *Sternenschweif* triangle:** keep all three modes. Use *Riva* as a **campaign chapter type** (hub siege / investigation arc with travel paused), not as the whole game. Use *Schicksalsklinge* for **wide map + many optional sites**, but do not pad with empty towns.

---

## 2. Character system DNA

Source spirit: early DSA 3.x rules adapted for computer—**granular, dicey, imperfectly mapped** to game content.

### 2.1 Positive attributes (7)

Classic set (German / functional English):

| Code | Name (DE) | Role |
|------|-----------|------|
| MU | Mut | Courage, fear checks, melee initiative DNA |
| KL | Klugheit | Intellect, lore, some magic/ranged math in NLT |
| IN | Intuition | Sense, PA base, “gut” checks |
| CH | Charisma | Social, bargain, some magic |
| FF | Fingerfertigkeit | Fine motor: lockpick, craft, some weapons |
| GE | Gewandtheit | Agility: AT/PA base, dodge-adjacent |
| KK | Körperkraft | Strength: damage, encumbrance, AT base |

**Derived combat baselines (classic NLT formulas):**

- Base **AT** ≈ `(MU + GE + KK) / 5` (proper rounding)
- Base **PA** ≈ `(IN + GE + KK) / 5`
- Ranged checks historically used `(KL + GE + KK)/4 + skill` (PnP DSA3 differs—NLT is its own table)

**Carry weight:** roughly `KK × 50` (ounces/unit of the era)—inventory pressure is intentional.

### 2.2 Negative attributes (7) — keep the *idea*

NLT “bad properties” (low is better for resistance to the flaw):

1. **Aberglaube** — superstition (magic vulnerability, odd event checks)
2. **Höhenangst** — acrophobia (bridges, cliffs, towers)
3. **Raumangst** — claustrophobia (tight dungeons, caves)
4. **Goldgier** — greed (theft/bargain/temptation events)
5. **Neugier** — curiosity (touching things you shouldn’t)
6. **Totenangst** — fear of the dead (undead morale/flee)
7. **Jähzorn** — temper (social blow-ups, combat provocation)

**Design value:** characters fail in *characterful* ways, not only “low skill.” Class entry often requires **caps** on certain negatives (e.g. warrior needs low temper).

**Embertrail stand-in naming (examples):** Superstition, Vertigo, Enclosure Dread, Avarice, Curiosity, Gravefear, Hot Blood—**do not ship German DSA proper nouns as brand**.

### 2.3 Classes / archetypes

Race and class are **fused** for non-humans (one “dwarf” archetype, three elf cultural lines). Humans cover the rest. Typical NLT set (~12):

| Archetype | Niche |
|-----------|--------|
| Warrior | Best heavy armor/weapons; party tank spine; codex vs poison use |
| “Coastal fighter” / regional barbarian type | Fighter-lite; cultural flavor; often magic-vulnerable |
| Rogue | Medium armor, theft/cheat income, solid secondary combat |
| Hunter | Food, tracking, bows (partially eclipsed by elves) |
| Jester / performer | Body + social skills; weak combat (often cut in remakes) |
| Dwarf | Tough fighter + “honest” craft/rogue tools |
| Magician | Widest spell list; school specialty; personal staff (light/utility upgrades) |
| Witch / Warlock | Weak early combat; herbs/heal; odd signature magic |
| Druid | Nature/control; **no metal** gear constraint |
| Green / Silvan / Ice elf lines | Hybrid archery + magic + nature; armor access nerfed across sequels |

**Embertrail:** keep fused culture-archetypes *or* split race/class carefully without diluting identity. Prefer **archetype packages** with visible playstyle contracts (metal ban, poison ban, staff bond) over generic “fighter + subclass.”

### 2.4 Skill categories

Skills group into roughly seven families (all classes can raise most; combat skills also feed AT/PA):

1. **Combat** — weapon groups; raising skill raises AT/PA; player can bias AT vs PA on level-up
2. **Body** — climb, swim, stealth, acrobatics, heal wounds, etc.
3. **Social** — human nature, seduce, haggle, streetwise, performance
4. **Nature** — tracking, survival, animal lore, orientation, herb lore
5. **Lore** — history, magic lore, religion, languages, alchemy knowledge
6. **Craft** — treat poison/disease, pick locks, disarm traps, repair, treat wounds (professionals still better)
7. **Intuition / perception** — danger sense, hide/search adjacent checks

**Hard lesson:** PnP-complete lists produce **dead skills**. Trilogy is full of talents that almost never fire. *Riva* tries to script more checks but many become one-off vignettes.

**Embertrail rule:** every skill on the sheet needs a **documented content hook** (travel event, dungeon trap family, town activity, dialogue gate, or combat option)—or it does not ship.

### 2.5 Magic

- **Resource:** Astral Energy (AE); regenerates mainly via rest (slow).
- **Schools (arcane lores):** combat damage, domination/fear, transformation/buffs, illusion, clairvoyance, healing, elemental, demonology/summons, etc. Names are flavorful and **non-obvious**—originals needed manuals; remakes improved in-game descriptions.
- **Casters:** Magicians (broad + school), elves (natural suite), witches, druids—different spell access and gear rules.
- **Not D&D:** few true AoE nukes; summons can **backfire** and attack the party; utility spells (light, unlock, teleport/traverse) are expedition tools.
- **Staff / focus items:** bonded gear with upgrades (replace torch/rope, etc.).

**Embertrail:** keep costly AE, situational utility, school identity, and failure consequences. Always show **spell effect text in UI**. Prefer fewer, multi-use spells over a bloated dead list.

### 2.6 Level-up DNA

- Steep curve; campaigns stay mid-level (roughly 1→6–7 in first game).
- Skill/spell raises: dice-based success (easy early, harder past ~9–10); caps around +18.
- LE (life) and AE gains differ by archetype (fighters roll LE; mages split LE/AE; elves hybrid).
- Advanced mode: player allocates attempts; novice automates more.
- Temple saves / EXP penalties for wilderness saves in early games—**feel** of “safe haven vs risk.”

---

## 3. Combat: AT/PA, grid, ranged LoS, auto-combat

### 3.1 Core loop

1. Enter encounter → isometric battle map, party + enemies placed.
2. Turn order from speed/awareness-type factors.
3. On a melee turn choose **stance bias**: cautious / normal / aggressive (AT↑ PA↓ or reverse).
4. Attack roll vs defense (AT vs PA paradigm)—misses, parries, and fumbles are common and **thematic**.
5. Ranged/spells spend actions and respect **line of fire** (cardinal-only in game 1; free LoS from game 2).
6. Wounds, poison, broken weapons, morale flight; XP only for participants who stay in the fight (classic).
7. Optional computer control for trivial fights.

### 3.2 Grid tactics that matter

- **Positioning:** protect casters; choke points; surround melee.
- **Action economy:** swapping weapons/items costs AP—pre-buff loadouts matter.
- **Poisons & oils:** force multipliers for weak combatants (subject to archetype codes).
- **Fumbles:** self-damage, free enemy attack, **weapon break**—simulation flavor; rates must be tuned (HD remake overdid breaks).
- **Friendly fire:** possible; originals often lacked clear warning.
- **Flee:** wounded can leave; remaining fighters carry the XP rules.

### 3.3 Evolution notes

| Feature | Game 1 | Game 2 | Game 3 |
|---------|--------|--------|--------|
| Ranged LoS | Orthogonal only | True LoS rays | True LoS |
| Diagonal melee | No | No | No |
| Auto-combat | Party-wide, dumb | Per-hero; silent calc mode | Per-hero policies (magic/ranged/swap) |
| Enemy variety | Limited, class-lookalike confusion | Better sprites/types | Further polish; immobile giants |
| Map design | Hand layouts | Hand layouts | Hand layouts |

### 3.4 Embertrail combat mandate

**KEEP**

- AT/PA stance choice as the core decision (not just move+attack).
- Turn-based grid with readable elevation/cover if used.
- Meaningful fumbles *with clear messaging* and fair rates.
- Ranged **true LoS** (post-*Sternenschweif*).
- Auto-combat as a **power tool** with per-character policies and easy cancel.

**FIX**

- Show **hit chance %** (or clear odds bands) before confirming attack/spell.
- Show fumble risk and weapon-break risk when relevant.
- Diagonal melee or intentional 8-dir rules—document the choice; don’t half-implement.
- Friendly-fire warnings; distinct friend/foe silhouettes.
- Never leave players in multi-minute miss theaters at level 1 without tutorial honesty about odds.
- Auto-combat must not suicide casters; default policies: casters stay back, heal thresholds, no summon if AE low.

---

## 4. Travel simulation

Travel is half the fantasy: the party is a **logistics unit**, not a combat score.

### 4.1 Systems present in the classics

- **Time & distance:** routes consume days; seasons gate mountain passes.
- **Food & water:** rations deplete; hunting/foraging skills matter; starvation is real.
- **Weather:** cold/wet without proper clothing → disease; planning route + gear for climate.
- **Camp routine:** sleep, heal, AE regen, **watch shifts**, ambush risk.
- **Gear wear:** shoes wear out (*Sternenschweif* signature); weapons dull/break; whetstones and repairs; clothing loss events (swamp steals pants → town consequences).
- **Disease & poison:** multiple conditions; herbs, heal skills, professional healers; self-heal limits (can’t fully treat self; fatigue after many attempts).
- **Random & scripted events:** merchants, ambushes, folklore oddities, moral choices, skill checks (acrophobia on bridges, etc.).
- **Transport modes:** foot default; ships with schedules/harbors (fidelity often stripped in remakes).

### 4.2 What made *Sternenschweif* travel better

- Branching ways, secrets, higher stakes for prep.
- Wear/disease/food shortages actually bite.
- Events that care about **who** is in the party and **what** they carry/wear.

### 4.3 Embertrail travel mandate

**KEEP** camp as a mini-game of roles (cook, watch, healer, hunter).  
**KEEP** weather × gear × season interactions.  
**KEEP** “forgot shoes / blankets / oil” as comedy-with-teeth.

**FIX**

- Always **log** resource changes (who ate, who got sick, what broke).
- Preview route risk (rough bands: cold, banditry, duration)—not a spoiler map of events.
- Soften only the *silent* failures; keep hard failures that were telegraphed.
- Multiplayer: shared camp UI, assign watches per player character, no desync on random seeds (server-authoritative encounters).

---

## 5. Town life

Towns are **service graphs + rumor engines**, not open-world theme parks.

### 5.1 Pillars

| Facility | Functions |
|----------|-----------|
| **Temples** | Worship/donate for god-specific boons; resurrection paths (rare gods/places); **safe save** culture in early games; party storage/swap tricks in sequels |
| **Taverns / inns** | Rumors, main-quest breadcrumbs, recruitable NPCs (7th slot), gambling/music/acrobatics for coin, rest |
| **Shops** | Armory (grounded gear, rare magic hard to spot until identified), herbalist (herbs/poisons/potions), general store (torches, rope, blankets, oil—**expedition kit**) |
| **Smith / healer** | Multi-day repairs; expensive professional care; death often beyond healers |
| **Homes** | Keyword interrogation (*Sternenschweif*+); many empty shells in game 1 |

### 5.2 Dialogue & information

- **Game 1:** mostly multiple-choice / simple prompts; taverns are info hubs.
- **Game 2–3:** **keyword dialogue**—ask topics; NPCs tire after few questions → re-enter. Investigation = systematic combing + logic (weapon experts for a divine axe, etc.).
- **Journal:** automatic diary exists but was famously weak; player note-taking was mandatory. Remakes added quest logs—**good**.
- **Automap:**
  - Game 1: color tiles, poor labels.
  - Game 2: zoom levels, store names, **player annotations**, click-to-travel in friendly towns.
  - Game 3: dense unique city layout, still sparse street life.

### 5.3 Economy & inventory

- Haggling (fail → ejected in originals).
- Strict inventory slots + weight → sell after dungeons; magic rings/amulets clog bags until sequels add slots.
- Containers appear strongly in *Riva*; stash risk if areas lock forever.

### 5.4 Embertrail town mandate

**KEEP** temples as social/religious machines, not just respawn altars.  
**KEEP** expedition shopping lists as first-class design.  
**KEEP** keyword or topic dialogue for investigation arcs.  

**FIX**

- Buildings readable without opening a map every door (signs, silhouettes, audio).
- Journal: quest states, **rumor provenance**, map pins, “last told by X in Y.”
- Automap: annotations + fast-travel to known safe points (*Sternenschweif* gold standard).
- No silent inventory mutations when entering/leaving services.
- Multiplayer hubs: instance-stable vendors, shared stash with audit log.

---

## 6. Quest design patterns

### 6.1 *Schicksalsklinge* — open fetch odyssey

- Core: assemble **map fragments** to a legendary weapon before a soft time pressure (invasion clock—usually generous).
- Structure: hub grants contract → informants → optional dungeon favors → piece → next lead.
- Freedom: large map, many optional caves; easy to wander unproductively.
- Failure modes: obscure leads, meta-knowledge riddles, instant-death traps, unwinnable inventory states → **backup saves required**.

### 6.2 *Sternenschweif* — dual patrons + investigation (primary reference)

Signature pattern:

1. **Dual (or triple) patrons** with conflicting goals for the same MacGuffin (e.g. “restore alliance artifact to rightful diplomatic channel” vs “sell it to a third party” vs side divine recovery quest).
2. Player must **investigate** without quest GPS: keywords across shops, temples, homes.
3. **Besieged / constrained cities** with special exit methods (no hand-holding).
4. **Denser, fewer dungeons**—each is a set piece with puzzles, multi-level art, and story weight.
5. Temporary **party size constraints** (hostages, “leave two behind”) as narrative devices.
6. Higher rate of **instant death / dead-end** if wrong item/order—engine excellent, quest telemetry poor.

**Embertrail dual-patron template (original names only):**

- Patron A: envoy of the **Leafborn** courts wants **Covenant Embershard** returned to seal a frontier pact at **Irondeep**.
- Patron B: fence in **Lowfen** wants the shard sold to a war-profiteer cabal.
- Side thread: night visitor from the **Ashfox** cult asks recovery of the **Starwake** throwing-blade for temple politics.
- Player chooses delivery, partial lies, or third options—with **faction memory**, not binary alignment meters.

### 6.3 *Schatten über Riva* — urban mystery

- Single-city conspiracy: minority scapegoating, undead undercity, pirates, “trade master” horror.
- Adventure-RPG hybrid: talk to nearly everyone (unique portraits), time-gated plot advances, infiltration schedules.
- Risk: mid-game town content plateaus; endgame dungeon rush; “wait around” triggers without feedback.

### 6.4 Patterns to steal

| Pattern | Why it works | Embertrail note |
|---------|--------------|-----------------|
| Fragmented map / multi-informant | Exploration driven | Track pieces in journal with *known/unknown* |
| Dual patrons | Moral/strategic choice | Telemetry: warn if path locks out XP/endings |
| Investigation without markers | Player skill | Hint economy + optional assist mode |
| Dense dungeon, sparse trash | Memorable sites | Quality > quantity |
| Party split / size locks | Tactical drama | Never strand irreplaceable unique items |
| Time pressure (soft) | Urgency without ironman cruelty | Visible calendar + consequences ladder |

### 6.5 Patterns to reject or heavily redesign

- Unsignaled one-way doors that delete key items.
- English-localization softlocks (classic trilogy shipping bugs).
- Riddles requiring out-of-game setting trivia.
- Empty towns as content padding.
- Silent failure on critical skill checks with no retry path.

---

## 7. KEEP vs FIX for a modern successor

### 7.1 KEEP (soul)

| Pillar | Detail |
|--------|--------|
| Mode triangle | FP explore + map travel + isometric TB combat |
| Fallible heroes | Negative attributes, fumbles, disease, fear checks |
| Expedition sim | Food, weather, camp watches, gear wear |
| Grounded loot | Few +3 flame swords; identification and rarity matter |
| Skills as adventure tools | Lock, climb, herb, haggle, track—not pure DPS stats |
| Costly magic | AE scarcity, utility excellence, risky summons |
| Investigation quests | Keywords, dual patrons, player note culture |
| Party of up to 6 (+ occasional NPC) | Role coverage fantasy |
| Hardcore *optional* | Novice vs expert, but honesty in both |

### 7.2 FIX (modern contract)

| Problem in classics | Modern requirement |
|---------------------|--------------------|
| **Silent item loss** | Every loss/gain is messaged + journaled; critical keys are sticky or duplicated with lore |
| **Hidden hit math** | Show hit% / spell success / break risk |
| **Softlocks** | Quest graph validation; no single missable without warning or alternate path |
| **Useless skills/spells** | Content coverage matrix; cut orphans |
| **Opaque spell names** | Full effect text, school tags, combat/explore tags |
| **Weak journal** | Structured quest log, rumor board, map pins, evidence inventory |
| **Save cruelty** | Unlimited named saves; optional ironman; no silent EXP tax without UI |
| **Building illegibility** | Visual language for shop types |
| **Dead-end inventory** | Containers + shared stash + weight UX; never delete gear on scripted “strip” without recovery path |
| **Instant total party kill traps** | Telegraphed danger, perception saves, or checkpoint mercy on pure gotchas |
| **Feedback voids** | Post-combat XP shown; skill check results narrated (success/fail degree) |
| **Localization landmines** | Single source strings; no language-only softlocks |

### 7.3 Difficulty philosophy

- **Honest hard:** low early hit rates OK if % visible and training paths exist.
- **Dishonest hard:** silent key deletion, buggy doors, unstated time gates—**banned**.
- Offer **Assist toggles**: travel illness severity, fumble severity, investigation hints—without removing systems entirely.

---

## 8. Anti-patterns from HD remakes

The 2010s remakes (*Schicksalsklinge HD*, later *Sternenschweif* remake) are a **negative checklist** for Embertrail shipping culture.

### 8.1 Process anti-patterns

1. **Ship unfinished as 1.0** — missing systems, broken quests, day-one unplayable state; “patches will fix it” as a business model.
2. **Budget studio + nostalgia cash-in optics** — marketing full price while content incomplete.
3. **Tiny team heroically patching for months** is not a plan; it is an apology.
4. **Remake without QA on critical path** — quest NPCs not opening doors after turn-ins (hard progress blocks).

### 8.2 Design anti-patterns observed

| Anti-pattern | Symptom |
|--------------|---------|
| **Uglyification / tone deafness** | Grimdark filter over charming setting; bad narrator undercutting text |
| **Combat worse, not better** | Longer animations, HP bloat, copy-paste encounters, broken fumble/break rates, AI still suicidal |
| **LoS wish gone wrong** | Diagonal shots that make enemy archers unfair while player still miserable |
| **Dungeon streamlining into corridors** | Strip traps/puzzles, multiply trash fights |
| **Sim fidelity gutted unevenly** | Harbors lose schedules; shops open 2 days/month after 24/7 bug; immersion death |
| **Town 3D without navigation design** | Snag on props, vertical confusion, map bugs |
| **Rule incompleteness** | Spell schools cut, mage LE/AE conversion gone, classes removed without replacement fantasy |
| **Balancing whiplash** | Miss-for-days early game + weapon breaks every fight |
| **Charm removal** | Cut jokes, cut flavor map text, overfanfare music |

### 8.3 Embertrail shipping doctrine (derived)

- **Feature-complete vertical slice before marketing “release.”**
- Critical-path quests automated tests: give item → door opens → flag set → reward granted.
- Prefer **Early Access honesty** over fake 1.0.
- Remaster/remake only if simulation + investigation depth is preserved or intentionally redesigned—not flattened into hack-and-slash.
- Voice/narration must match tone; never read template placeholders aloud.

---

## 9. Multiplayer adaptation notes

Embertrail targets cooperative multiplayer while preserving Nordland DNA.

### 9.1 Constraints

| Classic | Multiplayer adaptation |
|---------|------------------------|
| 1 player, 6 characters | **1 character per player**, parties up to **6** |
| Single brain inventory tetris | Shared loot rules + personal packs |
| Pause-friendly classic UI | Host migration / server authority; pause votes in combat optional |
| Temple as save shrine | Shared **hub persistence** (cloud camp / town lodge) |

### 9.2 Session structure

1. **Shared hubs** (ports, frontier towns like stand-ins for big starts): form party, trade, temple services, rumor board, departure.
2. **Travel leg:** server rolls weather/events; each player owns their PC’s watch, food contribution, fear checks.
3. **Dungeon:** FP leader with follow camera *or* body-block co-op; split-party = split sessions with reconnect.
4. **Combat:** full 6 on one grid; each player controls own PC; optional AI take-over if disconnect; policies for AFK.
5. **Return to hub:** sell, repair, story turn-in; offline players’ characters can be **retained in lodge** (classic temple bench) under AI or locked.

### 9.3 Design rules unique to MP

- **No single-player-only softlock items** bound to one inventory without deposit.
- **Quest tokens** in party shared quest inventory with permissions.
- **Dual-patron choices:** majority vote, designated leader, or role-based (diplomat PC breaks ties)—must be explicit UI.
- **Negative attribute events** target individuals; party can help with social/medicine skills.
- **Auto-combat:** only for your own character unless you grant AI.
- **Scaling:** enemies scale by party size within bands; do not invalidate AT/PA fantasy with sponge HP.
- **Drop-in:** join mid-hub freely; mid-dungeon only at checkpoints.
- **Grief:** item theft off by default; optional hardcore permadeath campaign flag.

### 9.4 What not to do

- Do not turn travel into pure loading screens between fights.
- Do not MMO-ify temples into auction houses first.
- Do not give each player a full classic sextet (12–36 entities)—combat and UI die.

---

## 10. Explicit DSA / IP terms that must NOT appear

Embertrail / Glutpfad is a **spiritual successor**, not a licensed Dark Eye product. Content, marketing, and code strings must avoid proprietary setting identity.

### 10.1 Setting & product names

- Aventurien / Aventuria / Arkania / Dere (as DSA world)
- Das Schwarze Auge / The Dark Eye / DSA (as product identity in content)
- Nordlandtrilogie (as our product name)
- Die Schicksalsklinge / Sternenschweif / Schatten über Riva  
- Blade of Destiny / Star Trail / Shadows over Riva  
- Realms of Arkania  
- Drakensang, Blackguards (as our titles)  
- Attic Entertainment, Ulisses (as in-world credits/lore)

### 10.2 Places (non-exhaustive; treat all DSA gazetteer names as banned)

- Thorwal, Prem, Oberorken, Phexcaer, Felsteyn / Felsteyn-equivalents as DSA towns  
- Svellt / Svellttal / Svelltdale  
- Kvirasim, Lowangen, Riva (as DSA city)  
- Orclands as branded DSA region names  
- Mittelreich, Gareth, and other core-box geography  

### 10.3 Gods & cults

- The Twelvegods roster: Praios, Rondra, Efferd, Travia, Boron, Firun, Tsa, Phex, Peraine, Ingerimm, Rahja, Hesinde  
- Namenloser / Nameless God (DSA)  
- Any DSA-specific demigods, saints, or church titles used as proper IP  

### 10.4 Artifacts, plot objects, signature NPCs

- Grimring / Schicksalsklinge (the sword)  
- Salamanderstein / Salamander Stone  
- Sternenschweif (the axe) / Star Trail artifact  
- Ingramosch, Elsurion Starlight, Sudran Alatzer, Hetman Hyggelik / Tronde as DSA characters  
- Holberker (as DSA race name), Achaz, and other setting-specific peoples by DSA name  

### 10.5 Rules-text trademarks & flavor locks

- Do not present Embertrail as “DSA rules” or “official Dark Eye.”  
- Avoid copying unique DSA spell proper names wholesale (use original spell identities).  
- Avoid copying unique map art / Ina Kramer cartography likeness as brand.

### 10.6 Approved original stand-ins (project seed list)

Use and extend lists such as:

| Role | Stand-in |
|------|----------|
| World / region | Frostmark, Ashvale coast, Embertrail marches |
| Start hub | Frosthaven, Oakspire |
| Besieged trade city | Lowfen |
| Dwarf hold | Irondeep |
| Alliance artifact | Covenant Embershard |
| Legendary blade | (unnamed until designed)—never Grimring |
| Divine throwing weapon | Starwake |
| Thief-luck cult | Ashfox Creed |
| Nature courts | Leafborn / Grovekin |
| Northern folk | Deepkin, Frostborn |
| Antagonist cult | Ember Cult / Nameless Flame |

### 10.7 Engineering hygiene

- Maintain `tools/banned-ip-terms.json` and CI scan (`scan-banned-terms.mjs`) on content packs.  
- Research docs may discuss historical names; **shippable content packages** must pass the banlist.  
- When in doubt: rename.

---

## 11. Recommended Embertrail defaults (synthesis)

1. **Modes:** *Sternenschweif*-style triangle; optional *Riva*-like investigation chapter with travel paused.  
2. **Party:** up to 6 players × 1 PC; hub lodge for bench/NPC allies.  
3. **Characters:** 7 attributes + 7 flaws; archetype contracts; skill list only with content hooks.  
4. **Combat:** AT/PA stances, true LoS ranged, visible odds, fair fumbles, smart auto policies.  
5. **Travel:** full sim with transparent logs.  
6. **Towns:** readable services, keyword investigation, strong journal/automap.  
7. **Quests:** dual patrons, dense dungeons, no silent softlocks.  
8. **Ship culture:** complete critical path, ban HD-style unfinished launch.  
9. **IP:** zero DSA proper nouns in content; original myth only.

---

## 12. Source notes (research basis)

Secondary synthesis drawn from:

- Contemporary design write-ups of the Realms of Arkania trilogy (Hardcore Gaming 101 series on *Blade of Destiny*, *Star Trail*, *Shadows over Riva*, and the HD remake).  
- German Wikipedia overview of the Nordland-Trilogie (modes, plot spines, remake reception).  
- Fan rule compilations for NLT attribute/AT-PA formulas and chargen constraints (e.g. Kunar-type compendia).  
- Public reception of HD releases (press scores on unfinished launch; long-form critique of combat/travel regressions).  
- Project banlist seed: `tools/banned-ip-terms.json`.

This brief is a **design compass**, not a license to reproduce protected text, maps, or assets.

---

*Document target path: `docs/research/nordland-brief.md`*  
*Status: research synthesis for Embertrail / Glutpfad pre-production*
