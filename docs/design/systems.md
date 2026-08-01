# Embertrail / Glutpfad — Core Systems Design

**Version:** 0.1.1 (MVP design)  
**Status:** Design notes; **shippable source** under `apps/` + `packages/` is authoritative  
**IP note:** Original world only. See `LEGAL.md`. No licensed third-party franchise names in player content.

**World frame (short):** The **Embertrail** (*Glutpfad*) is the old coastal-to-high-north route that bound the free ports of **Rimeport**, the timber citadel **Oakspire**, the marsh markets of **Mirehold**, and the under-city **Irondeep**. A year ago the **Covenant of the Shared Flame** fractured when the **Pact Cinder** — a sealed fragment of the First Beacon — was stolen from Oakspire’s vault. Ash-cult cells and ice-crypt raiders now hunt the same relic. The party walks the trail to recover it before winter closes the passes.

---

## Table of contents

1. [Character creation](#1-character-creation)
2. [Skills](#2-skills)
3. [Archetypes](#3-archetypes)
4. [Combat](#4-combat)
5. [Magic](#5-magic)
6. [Travel](#6-travel)
7. [Alchemy](#7-alchemy)
8. [Quest spine](#8-quest-spine)
9. [Content list (MVP map)](#9-content-list-mvp-map)
10. [Data schemas (JSON)](#10-data-schemas-json)

---

## 1. Character creation

### 1.1 Party model

- Party size: **1–6** (MVP recommends 4).
- One character is **leader** (travel decisions, primary dialogue face when no specific skill is required).
- All characters share inventory capacity rules individually; party pool for gold.

### 1.2 Attributes

Seven primary attributes, range **1–21** after creation; soft cap **18** at start; hard cap **21** via permanent effects later.

| Key | Name | Short | Used for |
|-----|------|-------|----------|
| `MU` | Courage | Courage | Initiative, fear, melee press |
| `KL` | Cleverness | Clever | Lore, magic theory, puzzle checks |
| `IN` | Intuition | Intuit | Perception, social reads, wild magic |
| `CH` | Charisma | Charisma | Trade, persuade, leadership |
| `FF` | Dexterity | Dex | Ranged, lockpick, craft precision |
| `GE` | Agility | Agility | Dodge, climb, flee, footwork PA |
| `KK` | Strength | Strength | Melee damage, carry, force checks |
| `KO` | Constitution | Constit | HP, disease resist, encumbrance tolerance |

**Derived at creation / level-up:**

```
HP_max     = 20 + KO + floor(KO/2) + archetype.hpBonus + sum(levelHpGains)
Focus_max    = 0  if non-caster else (KL + IN + archetype.aspBonus + sum(levelAspGains))
MR         = floor((MU + KL + KO) / 5) + archetype.mrBonus   // Magic Resistance
AT_base    = floor((MU + GE + KK) / 5)                       // before weapon skill
PA_base    = floor((IN + GE + KK) / 5)
INI_base   = floor((MU + IN + GE) / 5)
Carry_max  = KO * 2 + KK                                     // weight units
```

### 1.3 Roll method (default: classic 8d6-drop)

**Step A — Attribute pool**

1. Roll **8 × 1d6** for each of the 8 attributes (MU…KO).
2. Reroll any die showing **1** once (keep second result).
3. Sum the three highest of the 8 dice → raw attribute (expected ~12–13).
4. Clamp each raw to **[8, 14]** for fairness, then apply archetype biases (see §3).
5. Player may **swap two attributes once** after archetype selection.
6. Optional “heroic” mode: +1 to two attributes of choice (total ≤ 16 each).

**Step B — Negative traits (mandatory load)**

Every character must take **exactly 2 negative traits** from the table below (or 1 severe).  
Each grants **bonus skill points** and/or gold and may impose permanent checks.

| id | Name | Severity | Bonus SP | Effect (rules) |
|----|------|----------|----------|----------------|
| `neg.one_eye` | One-Eyed | normal | +8 | −2 Perception (sight); −1 ranged AT |
| `neg.bad_back` | Bad Back | normal | +6 | −4 Carry_max; +1 exhaustion from forced march |
| `neg.hot_blood` | Hot-Blooded | normal | +6 | On first hit taken in combat: must pass MU check or attack nearest foe (no defend) |
| `neg.superstitious` | Superstitious | normal | +5 | −2 Lore when facing “cursed” tags; refuses some camp actions near ruins |
| `neg.fragile` | Fragile Frame | normal | +8 | −3 HP_max; critical hits deal +2 damage to you |
| `neg.debtor` | Debt-Bound | normal | +0 + 40g | Party starts −40g (or this char owes a town contact quest) |
| `neg.night_blind` | Night-Blind | normal | +6 | −4 Perception in dark/dungeon without light |
| `neg.oathbound` | Oathbound | severe | +12 | Cannot flee combat vs marked enemy type; −2 CH when lying |
| `neg.cursed_luck` | Cursed Luck | severe | +14 | Once per day: GM/system forces a failed skill check (not combat AT) |
| `neg.ash_taint` | Ash-Taint | severe | +10 | −2 MR vs Ash school; animals/hostile nature checks −2 |

**Step C — Archetype**

Pick one of 12 archetypes (§3). Applies:

- Attribute **biases** (fixed ± modifiers after roll clamp)
- **Skill package**: free ranks in listed skills
- Starting **AT/PA weapon split** recommendation
- Starting gear package
- Optional magic school unlock flags

**Step D — Skill points**

```
SP_total = 80 + sum(negativeTrait.bonusSP) + archetype.bonusSP
```

Spend rules:

- Skill ranks start at **0**.
- Cost to raise skill from rank `r` → `r+1`:
  - `r < 5`: **1 SP**
  - `5 ≤ r < 10`: **2 SP**
  - `r ≥ 10`: **3 SP**
- Max rank at creation: **10** (or archetype package rank if higher, then max 12 only if package grants it).
- At least **4** different skills must receive points (anti-dump).
- Combat weapon skills: max **2** skills ≥ 7 at creation unless archetype is combat-primary.

**Step E — AT / PA split (weapon combat pool)**

Each weapon skill has a **Combat Pool** derived from skill + attributes:

```
CombatPool(skill) = skillRank + floor((MU + GE + KK) / 5)   // melee weapons
CombatPool(skill) = skillRank + floor((IN + FF + GE) / 5)   // ranged weapons
```

Player assigns for each equipped/known weapon skill:

```
AT_skill + PA_skill = CombatPool(skill)
AT_skill ≥ 0, PA_skill ≥ 0
```

Default suggestion: `AT = ceil(pool * 0.55)`, `PA = floor(pool * 0.45)`.  
Can be rebalanced at camp (cost: 1 hour rest, no combat) or on level-up free.

**Unarmed:** skill `combat.brawl` uses same split.

**Step F — Starting resources**

```
Gold = 20 + 2d6 + archetype.goldBonus − debt penalties
Rations = 7 per character (shared pack optional)
```

**Step G — Starting gear**

Apply archetype package (§3). Player may sell back at 50% value and buy from starter shop (limited list).

### 1.4 Creation flow (UI order)

1. Name, gender presentation, portrait, voice tag  
2. Roll attributes (lock or reroll once for whole set — optional paid with −10 starting gold)  
3. Choose archetype  
4. Apply biases; optional swap two attributes  
5. Choose 2 negative traits  
6. Allocate skill points (highlight archetype biases)  
7. Split AT/PA for each weapon skill with rank ≥ 1  
8. Review starting gear; minor shop  
9. Confirm character → add to party  
10. When party ≥ 1, start prologue at Rimeport docks

### 1.5 Advancement (post-creation, for completeness)

- After quest milestones / dungeon clears: **AP** (adventure points).  
- Level = function of total AP thresholds: `300, 700, 1200, 1800, 2500…`  
- Each level: +`1d6 + floor(KO/10)` HP (casters may convert half to Focus), **15 SP**, optional +1 attribute every odd level (max +1 per attribute until 18).

---

## 2. Skills

### 2.1 Skill check formula (universal)

```
Target = skillRank + floor(governingAttr / 2) + situationalMods
Roll   = 1d20
Success if Roll ≤ Target
Quality = Target - Roll          // ≥0 success margin; used for degrees
Critical success: natural 1 (or Roll ≤ 1 + floor(skill/10))
Critical failure: natural 20 (or Roll ≥ 20 - floor((20-skill)/10) when skill < 5)
```

Opposed checks: both roll; higher Quality wins; ties favor defender.

### 2.2 Skill catalog (~45)

Governing attribute is primary; secondary listed only if used in advanced checks.

#### Combat (8)

| id | Name | Attr | Notes |
|----|------|------|-------|
| `combat.swords` | Swords | MU | One-hand blades, AT/PA pool |
| `combat.axes` | Axes | KK | Axes & hatchets |
| `combat.maces` | Maces & Hammers | KK | Blunt |
| `combat.polearms` | Polearms | GE | Spears, glaives; reach/flanking bonus |
| `combat.staves` | Staves | GE | Quarterstaff; doubles as mage weapon |
| `combat.bows` | Bows | FF | Ranged; needs LoS |
| `combat.crossbows` | Crossbows | FF | Reload 1 action unless light |
| `combat.brawl` | Brawl | GE | Unarmed / improvised |

#### Body (7)

| id | Name | Attr | Notes |
|----|------|------|-------|
| `body.athletics` | Athletics | KK | Climb, jump, swim force |
| `body.acrobatics` | Acrobatics | GE | Balance, vault, soft landing |
| `body.stealth` | Stealth | GE | Ambush, sneak |
| `body.sleight` | Sleight of Hand | FF | Pickpocket, plant item |
| `body.endurance` | Endurance | KO | Forced march, hold breath |
| `body.swim` | Swim | KO | Rivers, ship wreck events |
| `body.selfctrl` | Self-Control | MU | Fear, pain, addiction |

#### Social (6)

| id | Name | Attr | Notes |
|----|------|------|-------|
| `social.persuade` | Persuade | CH | Honest bargain, appeal |
| `social.deceive` | Deceive | CH | Lie, disguise story |
| `social.intimidate` | Intimidate | MU | Threats; fail → hostility |
| `social.streetwise` | Streetwise | IN | City rumors, black market |
| `social.etiquette` | Etiquette | CH | Courts, guild halls |
| `social.leadership` | Leadership | CH | Rally, camp morale, hirelings |

#### Lore (6)

| id | Name | Attr | Notes |
|----|------|------|-------|
| `lore.history` | History | KL | Regions, wars, covenants |
| `lore.arcana` | Arcana | KL | Magic theory, Focus rituals |
| `lore.religion` | Cosmology | KL | Beacons, cults, rites (not real-world) |
| `lore.law` | Law & Custom | KL | Contracts, bounties |
| `lore.engineering` | Engineering | KL | Traps, mines, fortifications |
| `lore.medicine` | Medicine | KL | Treat wounds, disease diagnosis |

#### Craft (6)

| id | Name | Attr | Notes |
|----|------|------|-------|
| `craft.alchemy` | Alchemy | KL | Brew potions (see §7) |
| `craft.smithing` | Smithing | KK | Repair metal, craft crude |
| `craft.woodwork` | Woodwork | FF | Bows, shields, camp gear |
| `craft.tailoring` | Tailoring | FF | Cloth, leather patch |
| `craft.cooking` | Cooking | IN | Better rations, morale food |
| `craft.trapsmith` | Trapsmith | FF | Set/disarm mechanical traps |

#### Nature (6)

| id | Name | Attr | Notes |
|----|------|------|-------|
| `nature.survival` | Survival | IN | Camp site quality, forage |
| `nature.tracking` | Tracking | IN | Follow trails, avoid ambush |
| `nature.animal` | Animal Lore | CH | Calm, ride, pack beasts |
| `nature.plant` | Plant Lore | KL | Herbs for alchemy |
| `nature.weather` | Weather-Reading | IN | Forecast, route risk |
| `nature.mining` | Mining | KK | Irondeep, ore, cave-ins |

#### Perception (6)

| id | Name | Attr | Notes |
|----|------|------|-------|
| `perc.awareness` | Awareness | IN | Ambush, LoS secrets |
| `perc.search` | Search | KL | Containers, hidden doors |
| `perc.listen` | Listen | IN | Through doors, night watch |
| `perc.empathy` | Empathy | IN | Motive read in dialogue |
| `perc.orient` | Orientation | KL | Map nodes, not getting lost |
| `perc.sense_magic` | Sense Magic | IN | Detect active spells / Pact Cinder residue |

**Total skills: 45.**

### 2.3 Encumbrance & skill penalties

```
LoadRatio = carriedWeight / Carry_max
if LoadRatio > 1.0: cannot run; AT/PA −2; Body skills −4
if LoadRatio > 0.75: GE skills −2; INI −1
if LoadRatio > 0.5: GE skills −1
```

---

## 3. Archetypes

Attribute bias is applied after roll clamp. Skill package ranks are free (do not cost SP). `bonusSP` is extra spendable points.  
**Roles:** Combat / Scout / Social / Caster hybrid as noted.

### 3.1 Steelguard

- **Theme:** Shield-wall veteran of Rimeport free companies  
- **Attr bias:** MU +2, KO +2, CH −1, FF −1  
- **bonusSP:** 0 · **hpBonus:** +4 · **aspBonus:** 0 · **mrBonus:** +1 · **goldBonus:** +5  
- **Skill package:** swords 6, maces 3, body.endurance 4, social.intimidate 3, lore.law 2, perc.awareness 3  
- **AT/PA hint:** Swords AT-heavy (60/40)  
- **Gear:** mail hauberk, arming sword, heater shield, 3 bandages, waterskin  
- **Flags:** `canBlock=true`

### 3.2 Seafarer

- **Theme:** Coastal navigator and ship-raider turned trail guide  
- **Attr bias:** GE +2, KO +1, KK +1, KL −1  
- **bonusSP:** +4 · **hpBonus:** +2 · **goldBonus:** +10  
- **Skill package:** combat.axes 4, body.swim 6, body.athletics 4, nature.weather 4, social.streetwise 3, perc.orient 3  
- **Gear:** boarding axe, leather coat, rope 20m, fishhooks, 5 rations (smoked)  
- **Flags:** `seaEventsBonus=true`

### 3.3 Stonekin

- **Theme:** Irondeep tunnel-born miner and cave fighter  
- **Attr bias:** KK +2, KO +2, CH −2  
- **bonusSP:** 0 · **hpBonus:** +3 · **mrBonus:** +1  
- **Skill package:** combat.maces 5, combat.axes 3, nature.mining 6, lore.engineering 4, body.endurance 3, perc.listen 3  
- **Gear:** war hammer, heavy leather, miner’s lamp (6h oil), pick, 2 torches  
- **Flags:** `darkVisionPartial=true` (−50% night-blind penalties in caves)

### 3.4 Shadowhand

- **Theme:** Quiet blade from Mirehold’s canal underworld  
- **Attr bias:** GE +2, FF +2, MU −1, KK −1  
- **bonusSP:** +6 · **hpBonus:** 0  
- **Skill package:** combat.swords 4 (short), body.stealth 6, body.sleight 5, craft.trapsmith 3, social.deceive 3, perc.awareness 3  
- **Gear:** short sword, shadow cloak (stealth +1), lockpicks, smoke vial  
- **Flags:** `sneakAttack=true` (see combat)

### 3.5 Trickster

- **Theme:** Gambler, forger, face for hire  
- **Attr bias:** CH +2, FF +1, IN +1, KO −1  
- **bonusSP:** +8 · **hpBonus:** 0 · **goldBonus:** +25  
- **Skill package:** social.deceive 6, social.persuade 4, social.streetwise 4, body.sleight 4, lore.law 2, perc.empathy 3  
- **Gear:** dagger, fine clothes, loaded dice, forgery kit (basic), perfume  
- **Flags:** `barterBonus=+2`

### 3.6 Hexweaver

- **Theme:** Ash-touched hedge mage (Ash + Veil schools)  
- **Attr bias:** IN +2, KL +1, MU +1, KK −2  
- **bonusSP:** +2 · **hpBonus:** −2 · **aspBonus:** +8 · **mrBonus:** 0  
- **Skill package:** lore.arcana 5, perc.sense_magic 4, combat.staves 3, craft.alchemy 3, social.intimidate 2, body.selfctrl 3  
- **Schools unlocked:** `ash`, `veil`  
- **Spells start:** Cinder Spark, Ash Veil, Whisper Fear  
- **Gear:** ash staff, robes, spell focus (ember bead), 2 Focus potions (minor)

### 3.7 Wildcaller

- **Theme:** Beast-speaker of the high woods  
- **Attr bias:** IN +2, CH +1, GE +1, KL −1  
- **bonusSP:** +2 · **hpBonus:** +1 · **aspBonus:** +4  
- **Skill package:** nature.animal 6, nature.survival 5, nature.tracking 4, combat.polearms 3, perc.awareness 3  
- **Schools unlocked:** `wild`  
- **Spells start:** Beast Sense, Bramble Snare  
- **Gear:** hunting spear, hide armor, snare kit, dried meat ×5

### 3.8 Magister

- **Theme:** Beacon-schooled theoretician from Oakspire archives  
- **Attr bias:** KL +3, IN +1, KK −2, GE −1  
- **bonusSP:** 0 · **hpBonus:** −3 · **aspBonus:** +12 · **mrBonus:** +2  
- **Skill package:** lore.arcana 7, lore.history 4, lore.religion 3, combat.staves 2, craft.alchemy 2, perc.sense_magic 4  
- **Schools unlocked:** `beacon`, `frost`, `ash` (theory access; frost & ash at rank-limited)  
- **Spells start:** Light Sigil, Force Push, Frost Needle  
- **Gear:** scholar staff, archive robes, grimoire, ink & chalk, 3 Focus potions (minor)

### 3.9 Pathfinder

- **Theme:** Embertrail guide; maps, weather, and hard miles  
- **Attr bias:** IN +2, KO +1, GE +1, CH −1  
- **bonusSP:** +4 · **hpBonus:** +2  
- **Skill package:** nature.survival 6, nature.tracking 5, nature.weather 4, perc.orient 5, body.endurance 3, combat.bows 3  
- **Gear:** short bow + 20 arrows, trail leathers, map case, 10 rations, snowshoes  
- **Flags:** `travelEventReroll=1/day`

### 3.10 Leafborn

- **Theme:** Canopy hunter from Oakspire’s green wards  
- **Attr bias:** FF +2, GE +2, KK −1, KO −1  
- **bonusSP:** +4 · **hpBonus:** 0  
- **Skill package:** combat.bows 6, body.stealth 4, nature.plant 4, nature.tracking 3, craft.woodwork 3, perc.awareness 3  
- **Gear:** longbow + 30 arrows, leafcloak, climbing spikes, herbal satchel  
- **Flags:** `forestMoveBonus=true`

### 3.11 Grovekin

- **Theme:** Healer-warden of the living groves  
- **Attr bias:** IN +1, CH +1, KO +1, MU −1  
- **bonusSP:** +2 · **hpBonus:** +1 · **aspBonus:** +6  
- **Skill package:** lore.medicine 6, nature.plant 5, craft.alchemy 4, social.persuade 3, combat.staves 2, body.selfctrl 2  
- **Schools unlocked:** `wild`, `beacon`  
- **Spells start:** Mending Glow, Purge Taint  
- **Gear:** healer’s staff, grove robes, bandage ×5, antitoxin ×1, mortar

### 3.12 Frostborn

- **Theme:** High-north hunter tempered by ice winds  
- **Attr bias:** KO +2, MU +1, KK +1, CH −1  
- **bonusSP:** +2 · **hpBonus:** +3 · **aspBonus:** +3 · **mrBonus:** +1  
- **Skill package:** combat.axes 5, body.endurance 5, nature.survival 4, nature.weather 3, combat.bows 2, body.selfctrl 3  
- **Schools unlocked:** `frost` (minor)  
- **Spells start:** Chill Skin  
- **Gear:** greataxe *or* hand axe + shield, fur armor, frostcloak (+cold resist), 8 rations  
- **Flags:** `coldResist=+2`, `snowTravelBonus=true`

### 3.13 Archetype summary table

| Archetype | Primary role | Magic | Signature skills |
|-----------|--------------|-------|------------------|
| Steelguard | Frontline | — | swords, endurance |
| Seafarer | Hybrid travel | — | swim, weather |
| Stonekin | Dungeon tank | — | mining, maces |
| Shadowhand | Striker/scout | — | stealth, sleight |
| Trickster | Face | — | deceive, streetwise |
| Hexweaver | Blaster/control | ash, veil | arcana, sense magic |
| Wildcaller | Summon/control | wild | animal, survival |
| Magister | Full caster | beacon/frost/ash | arcana, history |
| Pathfinder | Travel lead | — | survival, orient |
| Leafborn | Ranged scout | — | bows, plant |
| Grovekin | Healer | wild, beacon | medicine, plant |
| Frostborn | Frontline/cold | frost minor | axes, endurance |

---

## 4. Combat

### 4.1 Grid & time

- **Grid:** square tiles, 1 tile ≈ 1.5 m. MVP maps 12×12 to 24×16.  
- **Turn:** phased initiative; each unit gets **1 Move + 1 Action** or **Full Defense** or **Sprint** (2× move, no action) or **Cast** / **Use item**.  
- **Round:** all units act once in INI order.

### 4.2 Initiative

```
INI_roll = INI_base + weapon.iniMod + armor.iniMod + statusMods + 1d6
```

Higher acts first. Ties: higher MU, then player party first.

On surprise (failed Awareness vs enemy Stealth): surprised side skips first action; INI −2 that fight.

### 4.3 Line of sight (LoS)

- Ranged attacks and most targeted spells need **unblocked LoS**.  
- Blocking: solid walls, closed doors, large pillars.  
- **Partial cover:** if line crosses cover edge: AT −2 / spell TN −2; target gains +1 PA vs ranged.  
- Darkness: without light, ranged AT −4; Sense Magic / Listen may still work.  
- Height: +1 AT if attacker is ≥2 elevation above target (ranged/melee reach).

### 4.4 Hit chance (AT vs PA)

**Melee attack**

```
AT_eff = AT_skill + weapon.AT + situationalAT + flankBonus + heightBonus − injuryMods − encumbrance
PA_eff = PA_skill + weapon.PA + shield.PA + situationalPA − injuryMods
// If defender chose Full Defense: PA_eff += 4 and no attack that turn

HitDiff = AT_eff - PA_eff
Roll = 1d20

// Convert to target number on d20 (attacker wants high):
TN = 10 + HitDiff          // clamp TN to [3, 18] for non-crit bands
Success if Roll ≤ TN       // (implementation: lower-or-equal success)

// Critical hit: natural 1 on d20 (or Roll ≤ 1 while TN≥16) → max damage die + special
// Fumble: natural 20 → drop weapon / self-glancing 1d3 / grant free interrupt (table)
```

**Alternative equivalent presentation (classic feel):**

```
Attacker rolls 1d20 ≤ AT_eff − mods
If hit, defender may Parry: 1d20 ≤ PA_eff
If parry succeeds, attack negated (except criticals may still graze: half damage)
```

**MVP implements the two-roll classic mode** (attack then optional parry) for readability.

**Ranged:** defender uses `PA_ranged = floor(GE/2) + coverBonus` (no weapon PA unless tower shield).  
Reload: crossbows consume Action to reload unless `weapon.reload = 0`.

**Shadowhand sneak attack:** if attacker is stealthed or flanking and target is unaware: +2 AT, +1d6 damage once.

### 4.5 Flanking & positioning

- **Flank:** attacker is adjacent and on opposite half of target from an allied adjacent unit → `flankBonus = +2 AT`, target PA −1 vs that attack.  
- **Rear:** only one adjacent enemy and attacker is behind facing → +3 AT, no parry allowed (dodge only at PA −4).  
- **Reach weapons** (`polearms`): can attack from 2 tiles; get +1 AT when ally is adjacent to same target (supporting).

### 4.6 Damage

```
if hit and not fully parried:
  raw = weapon.damageDice + weapon.damageFlat + floor(KK / 5)   // melee
  raw = weapon.damageDice + weapon.damageFlat + floor(FF / 10)  // ranged
  armorReduce = target.armor.protection  // vs damage type
  // piercing ignores 1 armor; blunt vs plate −1 dmg; etc. (tags)
  dmg = max(1, raw - armorReduce + critBonus)
  target.HP -= dmg
```

**Typical weapon profiles (MVP):**

| Weapon | Skill | Damage | AT/PA mod | Notes |
|--------|-------|--------|-----------|-------|
| Dagger | swords | 1d6 | +0/+0 | throwable, stealth |
| Short sword | swords | 1d6+1 | +0/+1 | |
| Arming sword | swords | 1d6+2 | +1/+0 | |
| Hand axe | axes | 1d6+2 | +1/−1 | |
| Greataxe | axes | 2d6+1 | +1/−2 | two-hand, no shield |
| War hammer | maces | 1d6+3 | +0/−1 | +1 vs plate |
| Spear | polearms | 1d6+2 | +1/+0 | reach 2 |
| Quarterstaff | staves | 1d6 | +0/+2 | |
| Short bow | bows | 1d6+1 | — | range 8 |
| Longbow | bows | 1d6+3 | — | range 12 |
| Light crossbow | crossbows | 1d6+2 | — | reload 1 |

**Armor protection (MVP):** cloth 0, leather 1, hide 2, mail 3, plate 4; shields add PA not soak (heater +2 PA, buckler +1 PA).

### 4.7 Wound & death ladder

```
if HP > 0: conscious
if HP ≤ 0 and HP > -KO: Downed (bleeding)
if HP ≤ -KO: Dead (MVP: perma-death on Hard; Incapacitated until town on Story)
```

**Downed (0 to −KO+1 HP):**

- Each round: `bleed 1d3` unless stabilized.  
- Stabilize: Action + Medicine check TN 8 + severity, or bandage item auto-success once.  
- On stabilize: HP set to 1, status `wounded`.

**Wound levels (when HP ≤ 50% / 25% / first downed in fight):**

| Status | Effect |
|--------|--------|
| `bruised` | flavor only |
| `wounded` | −1 all checks; −1 AT/PA |
| `bloodied` | −2 checks; Move −1; must Self-Control to cast |
| `critical` | −4 checks; can only Crawl/Defend; Medicine required |

Wounds persist until treated (Medicine + bandage / rest days). Camp long rest clears `wounded`; `bloodied` needs 2 long rests or temple.

### 4.8 Flee

```
Flee check (per character attempting):
  TN = 8 + body.acrobatics/2 + GE/4 − enemy free attacks threat
  Enemies adjacent get one free interrupt attack (PA does not apply; armor does)
  Success: unit removed to map edge; if all flee, combat ends → travel node with "routed" flag
  Party flee: average of attempts; any failure leaves that char behind 1 round
```

`Oathbound` trait: cannot choose flee vs marked foe types.

### 4.9 Status effects (combat-relevant)

| id | Effect |
|----|--------|
| `prone` | −4 PA, +2 to be hit; stand = Move |
| `stunned` | skip next Action |
| `blinded` | AT −4, ranged impossible |
| `rooted` | cannot Move |
| `burning` | 1d3 end of turn; GE check to snuff |
| `chilled` | Move −1, INI −2 |
| `afraid` | must Self-Control to approach enemy |
| `blessed` | +1 AT/PA for duration |
| `ash_marked` | −2 MR vs Ash; enemies with ash-sense detect you |

### 4.10 Battle flow (engine)

1. Place party & enemies; roll INI  
2. Process round: for each unit in order → choose action → resolve  
3. Check victory (all enemies dead/fled) / defeat (all party downed) / flee  
4. Loot table + wound carry-over → return to exploration

---

## 5. Magic

### 5.1 Focus (Arcane Spark Points)

```
Focus_max = KL + IN + archetype.aspBonus + levelAspGains   // casters only
// Non-casters: Focus_max = 0 unless item grants
```

- Spells cost **Focus** on successful cast; on fail, half cost (rounded up) still spent.  
- Fumble cast: full cost + backlash table (1d3 HP or 1 round stunned).  
- Rest: short camp rest restores `floor(Focus_max * 0.25)`; long rest full.  
- Potions restore fixed Focus (§7).

### 5.2 Casting check

```
SpellTN = spell.baseTN + floor(lore.arcana / 2) + schoolSkillBonus + focusMods − armorCastPenalty − bloodiedMods
// schoolSkillBonus: +1 if lore.arcana ≥ 5 and school unlocked; +2 if ≥ 10
Roll 1d20 ≤ SpellTN
MR of target (hostile): opposed — caster Quality vs target MR + 1d6
```

Armor cast penalty: mail −1, plate −3, unless spell tag `gesture_free`.

### 5.3 Six schools

| id | Name | Theme | Opposed by |
|----|------|-------|------------|
| `beacon` | Beacon | Light, order, mending, force of the First Flame | ash |
| `ash` | Ash | Ruin, embers, decay, cult fire | beacon |
| `frost` | Frost | Ice, stilling, north wind | wild (growth) |
| `wild` | Wild | Growth, beasts, thorns, blood of the grove | frost |
| `veil` | Veil | Shadow, fear, misdirection | beacon (reveal) |
| `stone` | Stone | Earth, weight, mine-deep silence | — (neutral) |

MVP casters unlock schools via archetype; further schools via quest tomes.

### 5.4 MVP spell list (~18)

| id | Name | School | Focus | TN | Range | Summary |
|----|------|--------|-----|----|-------|---------|
| `sp.cinder_spark` | Cinder Spark | ash | 4 | 9 | 6 | 1d6+1 fire damage; on 5+ Quality: apply `burning` |
| `sp.ash_veil` | Ash Veil | ash | 5 | 10 | self | +2 Stealth, 3 rounds; leave ash trail (trackable) |
| `sp.whisper_fear` | Whisper Fear | veil | 6 | 11 | 5 | Target tests Self-Control vs Quality or gain `afraid` 2 rounds |
| `sp.shadow_step` | Shadow Step | veil | 7 | 12 | 4 | Teleport to tile in LoS in dim light; break engagement |
| `sp.light_sigil` | Light Sigil | beacon | 3 | 8 | 8 | Illuminate radius 4; cancel darkness penalties; reveal invisible if Quality ≥ 4 |
| `sp.force_push` | Force Push | beacon | 5 | 10 | 4 | Push target 2 tiles; KK contest or `prone` |
| `sp.mending_glow` | Mending Glow | beacon | 6 | 11 | touch | Heal 1d6+2 HP; clear `bruised`; Quality ≥ 5 clears `wounded` |
| `sp.purge_taint` | Purge Taint | beacon | 8 | 12 | touch | Cure one disease stage or remove `ash_marked`; costs target 1 FP exhaustion |
| `sp.frost_needle` | Frost Needle | frost | 4 | 9 | 7 | 1d6 cold; Quality ≥ 3 → `chilled` |
| `sp.chill_skin` | Chill Skin | frost | 5 | 10 | self | +2 armor vs physical for 3 rounds; Move −1 |
| `sp.ice_sheet` | Ice Sheet | frost | 7 | 12 | 5 | 3-tile line becomes difficult terrain; GE or `prone` |
| `sp.beast_sense` | Beast Sense | wild | 3 | 8 | self | +3 Animal Lore / Tracking 1 hour; speak roughly with beasts |
| `sp.bramble_snare` | Bramble Snare | wild | 6 | 11 | 6 | Root target 2 rounds; STR check each turn to break |
| `sp.vital_surge` | Vital Surge | wild | 7 | 12 | touch | Heal 1d6; grant +1 Move next turn |
| `sp.stone_grip` | Stone Grip | stone | 5 | 10 | 5 | Bind feet (`rooted` 1 round); +2 TN underground |
| `sp.earth_spike` | Earth Spike | stone | 8 | 13 | 5 | 1d6+3 piercing from ground; half if MR check |
| `sp.ember_ward` | Ember Ward | ash | 9 | 13 | self aura2 | Allies +1 MR; enemies starting turn in aura take 1 fire |
| `sp.beacon_lance` | Beacon Lance | beacon | 10 | 14 | 8 | 2d6 force light damage; +2 vs undead/ash-spawn |

**Learning:** known at start from archetype or found as scroll → Arcana check + 1 day study → add to known list.

---

## 6. Travel

### 6.1 Node graph

Overworld is a directed **node graph** (not free roam for MVP).

```json
{
  "id": "node.frosthaven_gate",
  "kind": "town|wild|dungeon_entrance|landmark|camp_site",
  "pos": { "x": 120, "y": 40 },
  "links": [
    { "to": "node.lowfen_ferry", "hours": 8, "terrain": "coast", "risk": 2 },
    { "to": "node.oakspire_road", "hours": 12, "terrain": "forest", "risk": 3 }
  ]
}
```

Travel action: pick adjacent link → spend hours → roll weather + event → arrive or divert.

### 6.2 Time & pace

| Pace | Hours multiplier | Ration mult | Fatigue | Ambush risk |
|------|------------------|-------------|---------|-------------|
| Cautious | ×1.25 | ×1.0 | low | −2 risk |
| Normal | ×1.0 | ×1.0 | normal | 0 |
| Forced | ×0.75 | ×1.25 | high | +2 risk |

Daily clock: 24h; night travel risk +3; need 6h sleep or Endurance checks.

### 6.3 Weather table (1d12 each morning or on link enter)

| d12 | Weather | Effects |
|-----|---------|---------|
| 1–2 | Clear | — |
| 3–4 | Overcast | Sense Magic −1 |
| 5–6 | Rain / sleet | Travel hours +10%; bow AT −1 outdoors; disease risk +1 |
| 7 | Fog | Ambush risk +2; ranged LoS −2 tiles |
| 8 | Hard wind | Ranged AT −2; cold exposure if north |
| 9 | Snow | Hours +20%; shoe wear +1; Frostborn ignore |
| 10 | Storm | Must camp mid-link or Weather-Reading TN 12 to push; lightning flavor events |
| 11 | Bitter cold | KO check or 1d3 nonlethal; rations +0.5 if no fire |
| 12 | Emberwind (ash) | Ash school +1 TN cast; Beacon −1; chance of ash-cult omen event |

### 6.4 Rations

```
Each character consumes 1.0 ration per 24h at normal pace
Forced march: 1.25; rest day: 0.75
Cooking success: 4 raw ingredients → 5 quality rations (+1 morale next day)
Forage (Survival check): +0–3 rations depending on terrain & Quality
If rations < party_size for the day:
  -1 day starvation: −1 all checks
  -2 days: −2, KO check or 1d3 HP
  -3 days: bloodied, cannot forced march
```

### 6.5 Shoe wear (trail hardness)

Each character has `footwear.condition` 0–100.

```
On link complete:
  wear = link.hours * terrain.wearRate * paceMod
  // road 0.5, forest 1.0, marsh 1.5, mountain 1.8, snow 1.4
  if footwear.condition ≤ 0: Move −1 permanently until repaired; random wound chance 5%/day
```

Repair: cobbler in town, or Woodwork/Tailoring camp action + materials.

### 6.6 Disease

Disease risk accumulates from: marsh travel, wounds untreated, rotten food, dungeon filth, weather.

**Check:** `1d20 ≤ KO/2 + medicineCare − riskStack` each night when riskStack > 0.

| id | Name | Stages | Effects |
|----|------|--------|---------|
| `dis.marsh_fever` | Marsh Fever | 3 | −1 GE/stage; stage 3: unconscious 1d3 days |
| `dis.ash_cough` | Ash Cough | 3 | −1 KO/stage; casting +1 Focus cost stage 2+ |
| `dis.frostbite` | Frostbite | 2 | −2 FF; stage 2: lose finger (permanent −1 FF) if untreated |
| `dis.wound_rot` | Wound Rot | 3 | from dirty downed; −1 HP_max/stage until cured |

Treat: Medicine + herbs / Purge Taint / temple service in towns.

### 6.7 Random travel events (by terrain weight)

On each link, roll `1d20 + risk` vs threshold 12:

- **None** (common)  
- **Ambush** → combat encounter  
- **Merchant** → trade  
- **Lost** → Orientation check or +hours  
- **Herbs** → Plant Lore forage  
- **Ruins omen** → lore hook / minor loot / trap  
- **Weather shift** → re-roll weather  
- **Story beat** → quest flag gated  

Pathfinder flag: once/day reroll event result.

### 6.8 Camp actions

When party camps at node or forced mid-link:

**Time slots:** evening (2 actions total party-shared pick list) + sleep.

| Action | Skill / cost | Effect |
|--------|--------------|--------|
| Guard watch | Awareness | Reduce night ambush |
| Treat wounds | Medicine + bandage | Clear wounded / stabilize disease |
| Forage | Survival / Plant | Rations or herbs |
| Hunt | Tracking + bow | Rations |
| Repair gear | Smithing / Woodwork | Armor/weapon/shoes |
| Brew | Alchemy | Craft potion if ingredients |
| Study spell | Arcana + scroll | Learn spell |
| Train AT/PA | — (1h) | Respec one weapon split |
| Cook | Cooking | Improve rations |
| Scout ahead | Stealth + Orient | Reveal next node event type |
| Rest only | — | +Focus/HP recovery mult |

Morale: if 2+ party `afraid`/`bloodied` and no Leadership success, night event chance +.

---

## 7. Alchemy

### 7.1 Basics

- Skill: `craft.alchemy` + kit (mortar)  
- Ingredients: `herb.*`, `mineral.*`, `monster.*` with tags  
- Station: camp (basic) or lab in Oakspire/Irondeep (advanced +2 TN)  
- Time: 1 camp action per recipe (advanced: 2)

```
BrewTN = recipe.tn + floor(craft.alchemy / 2) + stationBonus
Success → 1 dose (Quality ≥ 5 → 2 doses)
Fail → ingredients lost 50%; fumble → explosion 1d6 party splash
```

### 7.2 MVP recipes (8)

| id | Name | TN | Ingredients | Effect |
|----|------|----|-------------|--------|
| `rec.salve_minor` | Minor Healing Salve | 8 | herb.woundleaf ×2, oil | Heal 1d6 HP |
| `rec.salve_major` | Major Healing Salve | 12 | herb.woundleaf ×3, mineral.resin, oil | Heal 2d6 HP; clear wounded |
| `rec.asp_vial` | Spark Vial | 10 | herb.glowcap ×2, mineral.embergrit | Restore 1d6+2 Focus |
| `rec.antitoxin` | Antitoxin | 11 | herb.bitterroot ×2, herb.woundleaf | −1 disease stage; +4 next disease check |
| `rec.stoneskin_paste` | Stoneskin Paste | 13 | mineral.clay ×2, mineral.iron_dust | +2 armor 10 min (3 combat rounds) |
| `rec.frost_balm` | Frost Balm | 10 | herb.icefern ×2, fat | Cold resist +3 for 4h; cure frostbite stage 1 |
| `rec.smoke_bomb` | Smoke Bomb | 9 | mineral.embergrit, herb.gloomoss, oil | Combat item: 3-tile smoke, LoS block 1 round |
| `rec.ashbane_oil` | Ashbane Oil | 14 | herb.beacon_bloom, mineral.salt, oil | Weapon oil: +1d3 vs ash-spawn for 1 fight; remove ash_marked on hit |

Ingredient nodes: Mirehold marshes (woundleaf, bitterroot), Oakspire woods (glowcap, beacon_bloom), Irondeep (iron_dust, embergrit), northern path (icefern).

---

## 8. Quest spine

### 8.1 Main quest: **Covenant Pact Cinder**

**Premise:** The Pact Cinder was stolen from Oakspire’s Beacon Vault. Without it, the Covenant’s shared wards fail before winter. Factions: Oakspire Wardens, Rimeport Free Council, Ash-Covenant splinter cult, Irondeep Deep-Syndicate.

**Act structure (MVP):**

| Stage | id | Title | Location | Goals |
|-------|-----|-------|----------|-------|
| 0 | `q.ember.prologue` | Cold Welcome | Rimeport | Form party; dock brawl tutorial; meet patron **Rook Hale** |
| 1 | `q.ember.ash_trace` | Ash on the Wind | Rimeport → Mirehold | Investigate ash-cult cell; find map scrap to Mine of Ash |
| 2 | `q.ember.mine` | Embers Below | Mine of Ash | Retrieve false shard lead; learn Pact Cinder split into **three keys** |
| 3 | `q.ember.cellars` | Under the Spire | Oakspire Cult Cellars | Key 1: **Cinder Seal**; confront cult deacon |
| 4 | `q.ember.crypt` | Night of Still Stars | Ice Crypt | Key 2: **Rime Seal**; Frostborn lore |
| 5 | `q.ember.iron` | Bargains in the Dark | Irondeep | Key 3: **Stone Seal** via syndicate deal or heist |
| 6 | `q.ember.reforge` | Shared Flame | Oakspire Beacon Vault | Reassemble Pact Cinder; choose ending: restore Covenant / claim power / shatter |

**Win flags:** `seals.cinder`, `seals.rime`, `seals.stone` → unlock reforge scene.  
**Fail states:** winter_timer reaches 0 (optional hard mode); party wipe; sell seals to cult (bad end).

**Key NPCs (original):** Rook Hale (patron), Warden-Captain Seris Vale, Deacon Morn Ashvein (antagonist), Syndicate broker Keth Undermint.

### 8.2 Side quest: **Foxbrand Axe**

**Premise:** A legendary frost-steel axe, **Foxbrand**, was lost when a Seafarer captain wrecked north of Rimeport. Claimed by a barrow-wight in the Ice Crypt periphery and coveted by a Rimeport free company.

| Stage | id | Title | Goals |
|-------|-----|-------|-------|
| 1 | `q.starwake.rumor` | Tide Stories | Rimeport tavern: Streetwise/Seafarer dialogue → map mark |
| 2 | `q.starwake.wreck` | Salt and Bone | Coastal node event: swim/athletics; partial journal |
| 3 | `q.starwake.barrow` | Barrow Claim | Optional wing of Ice Crypt or linked barrow fight |
| 4 | `q.starwake.choice` | Who Wields the Wake | Return to free company (gold+rep), keep axe (unique weapon), or gift Frostborn smith (enchant upgrade path) |

**Reward item:** `item.starwake_axe` — greataxe 2d6+2, +1 AT vs chilled enemies, cold resist +1 while equipped.

### 8.3 Quest state machine (engine)

```
Quest {
  id, stageIndex, stages[], flags{},
  status: inactive|active|completed|failed
}
Advance when stage.objectives all complete.
```

---

## 9. Content list (MVP map)

### 9.1 Towns / hubs

| id | Name | Role | Services | Hooks |
|----|------|------|----------|-------|
| `town.frosthaven` | **Rimeport** | Coastal free port; start hub | Inn, smith, temple minor, ship chandler, tavern rumors | Prologue, Foxbrand rumor, Seafarer contacts |
| `town.oakspire` | **Oakspire** | Timber citadel & Beacon archives | Temple major, library, alchemist lab, warden barracks | Main vault, Cult Cellars entrance, Magister/Grovekin |
| `town.lowfen` | **Mirehold** | Marsh market on stilts | Herbalist, black market, ferry, disease healer | Ash-cult leads, Shadowhand/Trickster jobs |
| `town.irondeep` | **Irondeep** | Under-mountain trade city | Deep smith, syndicate hall, mine supply, gambling | Stone Seal bargain, Stonekin home, Stone school tome |

Each town: 4–8 named NPCs, 1 shop inventory table, 1 temple/heal price list, 2–3 local bounties (optional).

### 9.2 Dungeons

#### Mine of Ash (`dun.mine_ash`)

- **Theme:** Abandoned ember-ore mine claimed by ash-cult  
- **Size MVP:** 12–16 rooms  
- **Hazards:** bad air (Endurance), cave-ins (Engineering), burning vents  
- **Boss:** Overseer with Ember Ward support  
- **Loot:** embergrit, false-shard puzzle, map to cellars  
- **Skills gated:** mining, engineering, sense magic  

#### Cult Cellars (`dun.cult_cellars`)

- **Theme:** Beneath Oakspire’s merchant ward — ritual basements  
- **Size MVP:** 10–14 rooms  
- **Hazards:** alarms (Stealth), fear sigils (Self-Control), locked rites (Arcana)  
- **Boss:** Deacon Morn Ashvein  
- **Loot:** Cinder Seal, cult documents, Focus reagents  

#### Ice Crypt (`dun.ice_crypt`)

- **Theme:** Pre-Covenant burial halls in the frozen north  
- **Size MVP:** 12–18 rooms + optional Foxbrand barrow wing  
- **Hazards:** cold (KO), ice sheet floors, undead that ignore fear  
- **Boss:** Crypt Thanelord (frost + stone mix)  
- **Loot:** Rime Seal, frost balm ingredients, Foxbrand path  

### 9.3 Overworld nodes (minimum set)

```
Rimeport — coast trail — Mirehold
Rimeport — north road — Ice Crypt approach — (side wreck)
Mirehold — marsh boardwalk — Oakspire
Oakspire — highland pass — Mine of Ash
Oakspire — deep road — Irondeep
Irondeep — underpassage (unlock) — Mine of Ash rear
```

### 9.4 Enemy archetypes (for encounter tables)

Ash-cultist, ash-spawn hound, free company bandit, marsh ghoul, ice wight, crypt archer, syndicate enforcer, cave crawler, warden deserter, barrow thrall.

---

## 10. Data schemas (JSON)

Canonical TypeScript-friendly shapes. IDs are stable strings. Content packs live under `packages/content/**`.

### 10.1 Character

```json
{
  "id": "char.uuid",
  "name": "Iri Vale",
  "portraitId": "por.iri_01",
  "archetypeId": "arch.pathfinder",
  "level": 1,
  "ap": 0,
  "attributes": {
    "MU": 13, "KL": 11, "IN": 14, "CH": 10,
    "FF": 12, "GE": 13, "KK": 11, "KO": 14
  },
  "derived": {
    "hp": 34, "hpMax": 34,
    "asp": 0, "aspMax": 0,
    "mr": 7,
    "iniBase": 8,
    "carryMax": 39
  },
  "skills": {
    "nature.survival": 6,
    "nature.tracking": 5,
    "combat.bows": 3
  },
  "combatPools": {
    "combat.bows": { "at": 8, "pa": 4 },
    "combat.swords": { "at": 5, "pa": 5 }
  },
  "knownSpells": [],
  "schools": [],
  "traitsNegative": ["neg.bad_back", "neg.superstitious"],
  "flags": ["travelEventReroll"],
  "status": [],
  "wounds": [],
  "diseases": [],
  "equipment": {
    "mainHand": "item.short_bow",
    "offHand": null,
    "armor": "item.trail_leathers",
    "accessory": "item.map_case",
    "footwear": { "itemId": "item.boots_travel", "condition": 100 }
  },
  "inventory": [
    { "itemId": "item.arrow", "qty": 20 },
    { "itemId": "item.ration", "qty": 10 }
  ]
}
```

### 10.2 Item

```json
{
  "id": "item.arming_sword",
  "nameKey": "items.arming_sword.name",
  "kind": "weapon",
  "tags": ["melee", "blade"],
  "weight": 3,
  "value": 40,
  "stack": 1,
  "weapon": {
    "skillId": "combat.swords",
    "damageDice": "1d6",
    "damageFlat": 2,
    "atMod": 1,
    "paMod": 0,
    "iniMod": 0,
    "hands": 1,
    "reach": 1,
    "range": null,
    "reload": 0
  },
  "armor": null,
  "consumable": null,
  "effects": []
}
```

```json
{
  "id": "item.mail_hauberk",
  "nameKey": "items.mail_hauberk.name",
  "kind": "armor",
  "tags": ["mail"],
  "weight": 12,
  "value": 90,
  "armor": {
    "protection": 3,
    "iniMod": -1,
    "castPenalty": 1,
    "slot": "body"
  }
}
```

```json
{
  "id": "item.salve_minor",
  "nameKey": "items.salve_minor.name",
  "kind": "consumable",
  "tags": ["alchemy", "heal"],
  "weight": 0.2,
  "value": 15,
  "stack": 10,
  "consumable": {
    "actionCost": 1,
    "effect": { "healDice": "1d6", "healFlat": 0 },
    "charges": 1
  }
}
```

### 10.3 Spell

```json
{
  "id": "sp.frost_needle",
  "nameKey": "spells.frost_needle.name",
  "school": "frost",
  "aspCost": 4,
  "baseTN": 9,
  "range": 7,
  "target": "enemy",
  "losRequired": true,
  "castTime": "action",
  "tags": ["damage", "cold"],
  "effect": {
    "damageDice": "1d6",
    "damageFlat": 0,
    "damageType": "cold",
    "applyStatus": { "id": "chilled", "minQuality": 3, "durationRounds": 2 }
  },
  "mrApplicable": true
}
```

### 10.4 Quest

```json
{
  "id": "q.ember.main",
  "nameKey": "quests.embershard.title",
  "type": "main",
  "statusDefault": "inactive",
  "stages": [
    {
      "id": "q.ember.prologue",
      "nameKey": "quests.embershard.prologue",
      "objectives": [
        { "type": "talk", "npcId": "npc.rook_hale", "flag": "met_rook" },
        { "type": "combat", "encounterId": "enc.dock_brawl", "flag": "prologue_fight_done" }
      ],
      "onComplete": { "next": "q.ember.ash_trace", "giveAP": 50, "flags": ["main_started"] }
    },
    {
      "id": "q.ember.ash_trace",
      "objectives": [
        { "type": "visit", "nodeId": "town.lowfen" },
        { "type": "flag", "flag": "cult_map_scrap" }
      ],
      "onComplete": { "next": "q.ember.mine", "giveAP": 100 }
    }
  ],
  "flags": {
    "seals.cinder": false,
    "seals.rime": false,
    "seals.stone": false
  },
  "endings": ["restore_covenant", "claim_shard", "shatter_shard"]
}
```

### 10.5 Town

```json
{
  "id": "town.frosthaven",
  "nameKey": "towns.frosthaven.name",
  "nodeId": "node.frosthaven",
  "services": ["inn", "smith", "tavern", "chandler", "temple_minor"],
  "danger": 1,
  "npcs": [
    {
      "id": "npc.rook_hale",
      "nameKey": "npcs.rook_hale.name",
      "role": "patron",
      "dialogueTreeId": "dlg.rook_hale",
      "schedule": ["tavern_day", "dock_evening"]
    }
  ],
  "shops": [
    {
      "id": "shop.frost_smith",
      "restockDays": 7,
      "inventory": [
        { "itemId": "item.arming_sword", "qty": 2, "priceMult": 1.0 },
        { "itemId": "item.mail_hauberk", "qty": 1, "priceMult": 1.1 }
      ]
    }
  ],
  "rumors": [
    { "id": "rumor.starwake", "questId": "q.starwake.rumor", "skillGate": "social.streetwise", "tn": 8 }
  ],
  "healPrice": { "wounded": 15, "diseaseStage": 25, "resurrectStoryMode": 200 }
}
```

### 10.6 DungeonRoom

```json
{
  "id": "room.mine_ash.07",
  "dungeonId": "dun.mine_ash",
  "nameKey": "dungeons.mine_ash.room07",
  "shape": { "w": 10, "h": 8 },
  "tiles": "....####..\n.##..c..##\n...",
  "spawnPoints": {
    "playerEntry": { "x": 1, "y": 4 },
    "enemies": [
      { "x": 7, "y": 3, "templateId": "enemy.ash_cultist" },
      { "x": 8, "y": 5, "templateId": "enemy.ash_hound" }
    ]
  },
  "exits": [
    { "dir": "N", "toRoomId": "room.mine_ash.04", "door": { "locked": true, "tn": 10, "keyId": null } },
    { "dir": "E", "toRoomId": "room.mine_ash.08" }
  ],
  "features": [
    {
      "type": "container",
      "id": "chest.mine_07",
      "pos": { "x": 5, "y": 2 },
      "locked": true,
      "lootTableId": "loot.mine_common",
      "trapId": "trap.needle"
    },
    {
      "type": "hazard",
      "id": "vent.ash",
      "pos": { "x": 6, "y": 6 },
      "effect": { "status": "burning", "saveSkill": "body.acrobatics", "tn": 10 }
    },
    {
      "type": "interact",
      "id": "altar.false_shard",
      "skillChecks": [
        { "skillId": "perc.sense_magic", "tn": 11, "flagOnSuccess": "false_shard_read" }
      ]
    }
  ],
  "scripts": {
    "onEnter": ["maybe_ambush_if_loud"],
    "onClear": ["set_flag:mine_ash.07_cleared"]
  },
  "light": "dim",
  "tags": ["underground", "ash"]
}
```

### 10.7 Supporting schemas (minimal)

**Travel node**

```json
{
  "id": "node.lowfen_ferry",
  "kind": "wild",
  "pos": { "x": 80, "y": 90 },
  "links": [
    { "to": "town.lowfen", "hours": 3, "terrain": "marsh", "risk": 3, "wearRate": 1.5 }
  ],
  "campAllowed": true,
  "eventTableId": "events.marsh"
}
```

**Enemy template**

```json
{
  "id": "enemy.ash_cultist",
  "nameKey": "enemies.ash_cultist",
  "hp": 18,
  "attributes": { "MU": 12, "GE": 11, "KK": 10, "KO": 11, "IN": 10, "KL": 9, "CH": 8, "FF": 10 },
  "at": 11,
  "pa": 7,
  "armor": 1,
  "damage": "1d6+1",
  "mr": 4,
  "skills": { "body.stealth": 4 },
  "spells": ["sp.cinder_spark"],
  "asp": 8,
  "lootTableId": "loot.cultist",
  "tags": ["human", "ash_cult"]
}
```

**Alchemy recipe**

```json
{
  "id": "rec.salve_minor",
  "nameKey": "alchemy.salve_minor",
  "tn": 8,
  "station": "camp",
  "ingredients": [
    { "itemId": "herb.woundleaf", "qty": 2 },
    { "itemId": "item.oil", "qty": 1 }
  ],
  "output": { "itemId": "item.salve_minor", "qty": 1 },
  "qualityBonusQty": 2
}
```

### 10.8 Network message shapes (client ↔ server)

Party-authoritative simulation on server; client sends intents.

```json
{
  "type": "intent.move_party",
  "partyId": "party.uuid",
  "fromNodeId": "node.frosthaven_gate",
  "toNodeId": "node.lowfen_ferry",
  "pace": "normal"
}
```

```json
{
  "type": "intent.combat_action",
  "encounterId": "enc.uuid",
  "actorCharId": "char.uuid",
  "action": "melee_attack",
  "payload": { "targetId": "enemy.1", "weaponSkill": "combat.swords" }
}
```

```json
{
  "type": "state.snapshot",
  "party": { },
  "location": { "mode": "town|travel|dungeon|combat", "refId": "town.frosthaven" },
  "quests": [],
  "time": { "day": 12, "hour": 16, "winterTimer": 40 },
  "rngSeed": "hex"
}
```

Server validates skill rolls with shared `packages/rules` pure functions so client prediction matches.

---

## Appendix A — Implementation priority (MVP)

1. Character create + 4-archetype subset (Steelguard, Pathfinder, Hexweaver, Leafborn)  
2. Skill checks + combat AT/PA two-roll  
3. One town (Rimeport) + travel graph stub + rations  
4. Mine of Ash full clear  
5. Magic: 6 spells across ash/beacon/frost  
6. Expand remaining archetypes, towns, Ice Crypt, Cult Cellars  
7. Foxbrand side + alchemy lab  

## Appendix B — Banned naming checklist

Do **not** use: Aventurien, Thorwal, Salamander, Grimring, Phex, Praios, Efferd, Rondra, Boron, Tsa, Phex, Peraine, Ingerimm, Hesinde, Firun, Ifirn, Swafnir, Orkland, Hjalding, Hetman, Novadi, Middenrealm, or other real DSA marks.  
Use only Embertrail / Glutpfad original names defined in this doc and future lore files.

## Appendix C — Formula cheat sheet

```
HP_max     = 20 + KO + floor(KO/2) + hpBonus
Focus_max    = KL + IN + aspBonus          (casters)
MR         = floor((MU+KL+KO)/5) + mrBonus
INI_base   = floor((MU+IN+GE)/5)
CombatPool = skill + floor((MU+GE+KK)/5) // melee
AT + PA    = CombatPool
Skill check: 1d20 ≤ skill + floor(attr/2) + mods
Melee: attack 1d20 ≤ AT_eff; parry 1d20 ≤ PA_eff
Damage     = max(1, dice + flat + floor(KK/5) - armor)
Cast: 1d20 ≤ baseTN + floor(arcana/2) + mods; cost Focus
```

---

*End of systems design v0.1.0 — implement against this document; diverge only via design revision notes.*
