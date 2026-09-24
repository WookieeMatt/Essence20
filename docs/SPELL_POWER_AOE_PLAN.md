# Spell & Power Area of Effect

Area of Effect for spells and Powers, on the same footing weapon effects already had — plus areas
that stay on the map when the duration is longer than *Instant*.

**Targets Foundry v14 only.** Everything below uses v14 API that does not exist in v13
(`canvas.regions.placeRegion`, `USER_PERMISSIONS.REGION_CREATE`, the core `applyActiveEffect`
region behavior, `Combat#_onEndRound`). `system.json` already declares `compatibility.minimum: 14`.

## Why v14 changed the shape of this

Written against v13 this would have been a much bigger piece of work. Six things core now does for
us, all verified against the v14 source tree rather than release notes:

| v14 | What it replaced |
| --- | --- |
| `canvas.regions.placeRegion(data, {create})` | ~120 lines of hand-rolled pointer loop and PIXI preview. `create: false` vs `true` *is* the instantaneous/lingering switch. |
| `USER_PERMISSIONS.REGION_CREATE`, default role PLAYER | A GM socket relay, which is not needed at all. |
| Core `applyActiveEffect` region behavior | A custom `RegionBehaviorType` for the ordinary "you have this while inside" case. |
| ActiveEffect `duration.expiry` + `ActiveEffect.registry` | Hand-rolled effect expiry on the `combatTurn`/`combatRound` hooks. |
| Ten region shape types with `gridBased` | A two-value `burst`/`cone` enum. |
| `TokenDocument#testInsideRegion` | A centre-point approximation that missed large tokens clipping an edge. |

`MeasuredTemplate` is deprecated outright in v14 ("merged into the functionality of the Region
document"), so Region was and remains the right base.

## What was built

### Data

- **`module/data/aoe-schema.mjs`** — `shape` + `radius`, spread into weaponEffect, spell and power.
  `shape` stores Foundry's *own* region type names (`circle` / `cone` / `emanation`) so the value
  passes straight to `placeRegion` with no translation table. `radius` is fractional-capable
  (`makeNum`, not `makeInt`) because Explosive Beam's "15ft diameter circle" is a 7.5ft radius.
- **`module/data/duration-schema.mjs`** — `duration: {units, value, text}` on spell and power
  (power had no duration field at all before). `parseDurationString` migrates the old free text.
  `text` preserves the author's wording whenever the parse can't account for the whole string, so
  restructuring is lossless — `"4 rounds or until disrupted"` keeps its second half on the sheet.
  Anything unrecognised becomes `special` with the text preserved rather than a guess.
- **Spell attack fields** — `damageValue` / `damageType` / `defenseType`. Before these, every
  damaging spell had to be hardcoded in `dice.mjs` by compendium id, so a homebrew attack spell
  could never deal damage at all.

### Behaviour

- **`module/helpers/aoe-targeting.mjs`** — placement. A circle is positioned freely at the cursor;
  a cone keeps its apex on the caster and only *turns* to follow the cursor (`onMove` returns
  `false` to suppress core's default translate, which still leaves core to commit and redraw); an
  emanation is anchored to the caster and needs no gesture at all.
- **`module/helpers/aoe-expiry.mjs`** — the one thing core doesn't do. The effect registry expires
  the *effect*; nothing expires the *region*. Wired into `Combat#_onEndRound` (rounds),
  `updateWorldTime` (minutes/hours/days), `deleteCombat` (scenes) and `ready` (reconcile).
  The `_onEndRound` half judges by **`context.round`**, the round that just ended — the hook runs
  post-commit, so `this.round` is already the round about to start.

## Decisions worth knowing

- **Round counting is inclusive.** A "3 rounds" area placed during round 3 covers rounds 3, 4 and 5
  and dies at the end of round 5.
- **Rounds and world time are independent.** `CONFIG.time.roundTime` is 0 in this system, so
  advancing a round does not advance `game.time.worldTime`. Neither can be expressed via the other.
- **A `special` duration never auto-expires.** Guessing a length for a duration nobody could parse
  is worse than leaving it for the GM to delete.
- **Expiry runs on one client.** Every entry point is gated on `game.users.activeGM?.isSelf`, core's
  own idiom, so connected clients can't race to delete the same region.
- **A cancelled placement still rolls.** `placeAoeTemplate` can't distinguish "cancelled" from
  "placed, caught nobody", and an area that legitimately catches nobody must still resolve. This
  matches the existing weaponEffect behaviour.
- **Explosive Beam lost its bespoke helper.** Its "15ft diameter circle" is a real shape now, so
  `helpers/explosive-beam.mjs` is gone. Beam Volley's "3 targets in range" is Multiple Targets, not
  an area, so it stays a bespoke auto-targeter.

## Still open

- **Powers now roll as attacks** when they declare a Defense and an attack Skill (see the audit
  below). Grid Powers that only affect their own user are untouched.
- **`CONFIG.ActiveEffect.expiryAction` is left at its default** (`"update"` — mark expired rather
  than delete). It governs *every* effect in the system, not just AoE ones, so it wasn't changed
  as a side effect of this work.
- ~~Two rules calls~~ — **settled 2026-09-19, both as "current behaviour stands"**. See "Rules
  calls settled" below.
- ~~`magicBauble` still has a free-text `duration`~~ — **done 2026-09-19.** It now uses
  `durationSchema()` like spell and power, builds the same `durationLabel`, and its sheet uses the
  shared duration fields. The migration guard was widened to cover it, and all 7 compendium
  baubles parsed cleanly (1 day, 2 instant, 2 scenes, 2 rounds) with no fallback to `special`.
- ~~Explosive Beam has no authored `defenseType`~~ — **correct as-is, confirmed 2026-09-19.** MLP
  CRB p.139 says only *"Make a Spellcasting Attack Test against each target in a 15ft diameter
  circle"*; no Defense is printed, so leaving the field unset and letting the player pick in the
  dialog is what the book describes.


## Content audit (2026-09-19)

Every spell and Power in the compendium was cross-referenced against the printed books, extracted
with Foundry's own bundled pdf.js. 94/103 powers and 78/79 spells matched their book entry by name;
the nine unmatched powers were chased individually.

**Powers use areas in two distinct ways**, and that is what decided how they are handled:

- *Self-centred emanations* — Power Quake ("radiating from you"), Illuminate ("emanate ... in a 30
  foot radius for 1 minute"), Aura of Decay ("20ft in all directions"), Sorcerous Tremors (which
  recreates Power Quake). No placement gesture; the caster is the origin.
- *Ranged blasts* — Arcane Blast, Fireball, Volcanic Eruption ("Blast [Nft radius]") and Icy Breath
  ("Range 20ft cone"), each written as "Targeting (Sorcery) attack" with a damage value and type.
  These are weaponEffects in a Power's clothing, so they route down the roll path that already
  exists (`helpers/power-attack.mjs`, dispatched from `onPowerUse`) rather than getting one of
  their own.

Note that `item.roll()` is **never reached for a Power** — `listener-misc-handler.mjs` returns
early into `powerCost`. `onPowerUse` is the single dispatch every activation path funnels through,
which is why the attack hook lives there.

### What the audit changed

- **`line` added to `E20.aoeShapes`.** The books print ~116 `Blast: Nft radius`, 8 `Blast: Nft
  cone`, and one `Blast: 60ft line` (PR CRB). Width is never stated in print, so
  `DEFAULT_LINE_WIDTH_FEET` is one grid square.
- **All 104 radius-bearing weaponEffects given a `shape`** (7 cone, 97 circle). **Only 45 were
  confirmed against the books**, by anchoring the match on an agreeing radius. Generic names
  ("Shotgun Effect", "Machine Gun Alternate Effect 2") appear in several books with different stats
  and the matching passes disagreed on them, so the remainder default to circle on the printed base
  rate (~87% of Blasts are a radius). Those are worth review.
- **8 area Powers and 2 area spells authored.** Glow and Pollution Solution look like placed areas
  in their `range` field but are **self-centred** in the text ("light for about 20ft all around",
  "20 feet around the caster"), so both are emanations.
- **20 Powers given their printed duration.** "Indefinitely" (Environmentally Sealed) and "for the
  rest of the day" (Lucky Charm) become `special` with the wording preserved, rather than a
  fabricated count.
- **Fixed:** `Wiilful Strength` → Willful Strength, `Chronomatic Pulse` → Chronomantic Pulse, and
  Fireball / Volcanic Eruption retyped `grid` → `sorcerous`.

### Validated clean

All 14 Finster's Powers match their printed `Cost: N points`. All 79 spell durations parsed without
falling back to `special`. "Usable once per scene" (Faster Regeneration) is a *uses* limit, not a
duration, and its `usesPer`/`usesInterval` are already correct.

### Known data issues deliberately NOT changed

These want a ruling rather than a fix:

- **Power Quake is `actionType: free`**, but the book says "you can take **an action** to punch the
  ground" — that reads as Standard.
- **Reactive's "+2 total for 1 scene" is its *activated* half**, but `canActivate` is false, so that
  half is not modelled. Its duration was left `instant` rather than authoring an inert one.
- **`defenseType` on the Sorcerous attack Powers is `toughness`** — the books state no Defense for
  them, so this follows the system's own schema default instead of inventing one.
- **~20 weaponEffects have a radius that disagrees** with a printed Blast of the same weapon name.
  Not auto-corrected, because the name collisions above make those matches unreliable.
- **Several compendium names drop punctuation the books use** ("Rev Your Engines" vs "REV YOUR
  ENGINES!"). Cosmetic, but this codebase already has name-matching bugs on record.

## Verified live

Tested in the `dev-v14` world against Foundry 14.364, not just under Jest:

- Circle: preview tracks the cursor with grid-coverage highlighting, catches and targets tokens,
  leaves **no** region behind when the duration is Instant.
- Cone: apex pinned to the caster, rotation tracks the cursor (aimed at +400/+250 → 32.15°, and
  `atan2(250,400)` is 32.0°), caster excluded from its own apex.
- Lingering: region persists with full provenance flags; survives rounds 1 and 2 and is deleted at
  the end of round 3; `deleteCombat` sweeps a "1 scene" area; a 10-minute area survives 5 minutes
  of world time and is gone at 10; the reconcile sweep correctly spares a rounds-based area placed
  outside combat.
- Effects: `applyActiveEffect` applied on entry and removed on exit.

The placement gesture, canvas geometry and region writes have no unit coverage by design,
consistent with the rest of this codebase's canvas layer — they need live verification. The pure
parts (`parseDurationString`, `isAoeExpired`, `durationToSeconds`, `buildAoeShapeData`,
`buildAoeRegionData`, `buildAoeBehaviors`, `feetToPixels`, `angleBetweenPoints`) are unit tested.

## Fixed on live verification (2026-09-19)

Three paths reached Foundry for the first time here, and each needed a fix. All three were the
kind only running the thing finds — the pure parts were already unit-tested and green.

- **A `line` caught its own caster.** `placeAoeTemplate` excluded the attacker for a cone but not
  for a line, though a line's near end sits on the attacker exactly as a cone's apex does — and
  the same function's `isAnchored` and `onMove` already grouped the two together. Aiming a 60ft
  line east returned `[caster, Target East]`; it now returns `[Target East]`.
- **`Combat#_onEndRound` was never actually wired.** This document claimed it was, but no such
  override existed in `module/documents/combat.mjs`, in the working tree or in HEAD. Nothing else
  could cover it: `CONFIG.time.roundTime` is 0, so advancing a round moves no world time and the
  `updateWorldTime` sweep never fires, while `expireAoeRegions` with no round in context treats a
  round-based area as "can't tell yet". A "3 rounds" area therefore sat on the map until the
  encounter ended. Now overridden.
- **The first version of that hook expired everything a round early**, because it read
  `this.round`. Measured in v14.364: ending round 2 arrives with `context.round` 2 and
  `this.round` 3. Now reads the context.

Verified live afterwards, in `dev-v14` against Foundry 14.364:

- **Line** — preview renders anchored at the caster and rotates with the cursor; aimed east it
  catches the east target only, aimed north the north one only; the caster is excluded; an Instant
  line leaves no region behind.
- **Power attack** — Fireball ran the whole chain: AoE placement, target capture, Defense choice,
  then a `2d20kl + 1d8` Targeting roll against DIF 15 (Toughness) resolving to "Success, Apply 2
  Fire" — its authored `damageValue` and `damageType`.
- **Lingering emanation** — created with no placement gesture, anchored by `attachment.token`,
  carrying full provenance flags, caster excluded. It travels with its caster (caster moved 400px,
  region bounds moved 400px), and placed on round 1 for 3 rounds it survives rounds 1, 2 and 3 and
  is gone once round 4 begins.

Still not verified: nothing in the compendium uses the `line` shape, so it was exercised with a
hand-made stand-in for PR CRB's printed "Blast: 60ft line". The shape works; no authored item
reaches it.

## Action cost for spells and baubles (2026-09-19)

Folding this work together with the action economy exposed a gap neither half could see alone:
the economy's backfill covered weaponEffects (676/676), Powers (103/103) and Perks, but **never
spells** — so casting cost nothing at all. Baubles were in the same position.

The MLP CRB settles it outright (p.143, "Using Magic Baubles"): *"Like casting a spell, using a
Magic Bauble is a Standard action."* That one sentence authorises both. It is corroborated by
three Perks — Celestia's Light Magic Talent, Luna's and Nightmare Moon's Dark Magic Talent — which
each grant the ability to "cast spells as a Free action", which only means something if the
default is more expensive.

So **79 spells and 7 magicBaubles are now `actionType: standard`**. Verified live: a spell's cost
resolves to `{standard: 1}` ("Standard"), and casting one in combat takes the caster's Standard
action from 1 to 0. Spells and baubles reach the economy through `Item#roll()` like everything
else — only `rollType == 'power'` short-circuits that funnel, which is why Powers need their own
hook in `onPowerUse`.

### Rebuilding the packs — the actual rule

`gulp compile` fails while a **world is loaded**, not merely while Foundry is running. A Foundry
server sitting on the setup screen holds no pack locks and compiles fine; launching a world takes
a LOCK on every `packs/*` LevelDB. The failure surfaces as a misleading
`Iterator is not open: cannot call all() after close()` from the CLI — opening the database
directly reports the real cause, `IO error: LockFile packs/<pack>/LOCK`. Returning to setup
(`game.shutDown()`) is enough; the whole app does not need closing.

### A bauble's Spellcasting shift was backwards (fixed 2026-09-19)

Two different things are called a spell's "cost" and they are independent: `system.cost` is the
**Spellcasting downshift** (MLP CRB p.132/p.191), already implemented in `item.mjs` along with the
Perks that reduce or defer it; `system.actionType` is the **action economy**. Adding the latter
changed nothing about the former.

Checking how baubles fed the roll turned up a real bug next door. MLP CRB p.143: *"you use your
own Spellcasting Skill, or the Spellcasting Skill noted on the Magic Bauble (whichever is
higher)"*. The `magicBauble` branch took the bauble's shift **unconditionally**, so a trained
spellcaster drinking a d2 potion was downgraded to the potion's rank. A bauble is a floor under an
untrained pony, never a ceiling on a skilled one.

Now uses `betterShift()` (`helpers/utils.mjs`), which compares by index in
`CONFIG.E20.skillShiftList` — ordered best-first, so the better shift is the LOWER index, the same
convention `dice.mjs#_getFinalShift` uses. An unrecognised shift loses to a recognised one rather
than winning on `indexOf`'s -1. Verified live: caster d8 + bauble d2 rolls d8; caster d20 + bauble
d6 rolls d6. Any lingering casting downshift still applies on top either way.

**Single use, also from p.143** — *"once any magic bauble is used, it is done... it can only ever
be used once"*. A bauble now carries a `quantity` (the same field `gear` declares, on the item and
so on each holder's own copy — an actor's inventory IS its embedded Items). Using one spends one:
the count decrements, and the item is deleted only when the last is gone, each with its own
notification so nothing vanishes off the sheet unannounced. Three guards, all load-bearing:

- **Only once the roll resolves.** A cancelled roll already refunds the action economy; consuming
  the potion there would destroy an item for a dialog the player backed out of, which they cannot
  recover from the sheet.
- **Only when `isEmbedded`.** Rolling a bauble straight from a compendium or the world Items
  directory consumes nothing - otherwise one click would delete the master copy every actor's is
  made from.
- **A missing quantity counts as 1, not 0**, so a bauble authored before the field existed still
  behaves like a single potion rather than being deleted on sight.

Note that `gear`'s own `quantity` is a purely manual count — nothing decrements it. A bauble's is
the first in the system that spends itself, so the two fields look alike and behave differently.
That is deliberate (a potion is consumed by a rule, a rope is not), but it is worth knowing.

Fixed alongside it: the bauble's chip on the actor sheet printed `item.system.duration` raw, which
became `[object Object]` the moment duration stopped being a string. It now uses `durationLabel`,
as the spell chip already did.

`Item#roll()` has no unit coverage (item.test.js covers data preparation only), so this was
verified live in `dev-v14`: a stack of 3 went 3 -> 2 -> 1 -> deleted with the right notification
each time; a cancelled roll left a stack of 3 untouched; a compendium item reports
`isEmbedded: false` and is skipped. Both sheets render the new field ("Quantity: 3" on the actor
chip, a number input on the item sheet) with no `[object Object]`.

## Pushing Yourself variants (2026-09-19)

The three printed things that change how Pushing works now apply, through
`getPushRules(actor)` in `helpers/token-movement.mjs`. It returns
`{feetPerFreeAction, capMultiplier, canPush}` and `planPush` takes it, so the drag ruler and the
movement charge agree by construction rather than by each re-deriving the rules.

- **Sewer Tunneler** (Hawk's Personnel Files p.177) — 10 ft a Free action instead of 5, still
  capped. Unconditional: the Perk's "In an urban environment, you ignore Rough Terrain" is a
  separate sentence with its own condition, and is terrain handling rather than Pushing.
- **Earlier is Better Than Later** (TF CRB p.108; the same text covers Technorganic Secrets'
  Cycle Drones, p.136) — 10 ft a Free action **and** no doubling cap, but only **while in Alt
  Mode**. `capMultiplier: Infinity`, so `beyondCap` is never true for them.
- **A driven vehicle** (Field Guide) — "vehicles with a driver can't use Standard actions to
  Sprint or Free actions to Push themselves". `canPush: false` makes every Push unaffordable at
  any price, reported with its own message and its own red `noPush` state on the ruler rather
  than being mislabelled as "short of Free actions" or "past the cap".

Scoped to the `vehicle` type deliberately: the rule names driven vehicles, and extending it to
piloted `zord` actors would be this system's invention rather than the book's.

**A fourth variant on the backlog turned out not to exist.** It was recorded as an "Improve
Aerodynamics vehicle upgrade giving 10 ft per Free action". `Aerodynamics` is a thrown-weapon
upgrade (GI Joe CRB p.148 — double the weapon's range), and `Aerodynamic Body` (TF One p.16)
raises an Alt Mode's Movement *rating* by trading Crew capacity. Neither touches Pushing.

Verified live in `dev-v14`: Sewer Tunneler took a 20 ft overrun from 4 Free actions to 2;
Earlier is Better Than Later did nothing in Bot Mode and gave 10 ft + no cap in Alt Mode (500 ft
still `beyondCap: false`); a vehicle refused to Push past its rating with 99 Free actions spare,
and pushed normally again once the driver's seat was empty.

**Trap worth knowing for any Perk-gated rule:** `item.toObject()` + `createEmbeddedDocuments`
carries neither `flags.core.sourceId` nor `_stats.compendiumSource`, so `actorHasPerk` never
matches and a correctly wired rule looks dead. Set `_stats.compendiumSource` to the source uuid
to reproduce what a real drag from a compendium records.

## Rules calls settled (2026-09-19)

Three questions that had been deferred for a decision. All three are now closed; only one
required a change.

### Power Quake is a Standard action (changed)

It shipped as `actionType: free`. PR CRB p.100: *"While Morphed, you can take **an action** to
punch the ground and spend 1 to 3 Power..."* — unqualified, and this line of books says "as a
Free action" explicitly whenever it means Free (Celestia's Light Magic Talent, the Cycle Drones,
Vigilance's Contingency clause). An unqualified "an action" is a Standard action, so it now is
one.

### Entering a lingering area does NOT trigger a fresh roll (no change)

The area's attack resolved when it was placed; walking into it afterwards applies the effect via
core's `applyActiveEffect` region behavior and nothing more. This matches how weapon AoE already
behaves — an area attack is rolled once, against whoever it caught — and it is what the existing
code does. A per-entry re-roll would need a custom `RegionBehaviorType`, which the "What was
built" section above notes is exactly the case core's stock behavior cannot express. Deliberately
not built: nothing printed asks for it.

### A spell's AoE catches everyone in the shape (no change)

The generic placement path targets every token inside the region, friend or foe — the shape is
the shape. Several individual spell helpers instead filter to enemies via `getNearbyEnemyTokens`,
and those stay: they were authored per spell, against that spell's own printed wording, and are
not the generic path guessing at disposition. The apparent inconsistency is therefore real but
correct — a spell that says it spares allies has a helper saying so, and one that does not, does
not.

## Weapon-effect data review (2026-09-19)

The 104 radius-bearing weaponEffects were re-checked against the books. The earlier pass matched
effect names across every book at once and could not trust the result; this one matches **within
one book**, chosen from the item's own `system.source.book` or, failing that, from its parent
weapon's. Parent weapons reference their effects by uuid, and that reverse index lifted the
items with both a book and a page from 56 to 91 of 104.

### The extraction problem, and what it took

Weapon stats print in two layouts. A stat block (`Name (Skill): +dN, Range X (2 Fire damage;
Blast: 10ft radius)`) reads fine as linear text. A weapons **table does not**: it is set across a
two-page spread, names and classification on the left page, range/effects/traits on the right, so
linear extraction leaves a weapon's name hundreds of characters from its own Blast. Worse, within
a single row the columns interleave, which splits `Blast:` from its own `10ft radius`.

Three steps fixed it, using the per-item x/y coordinates pdf.js exposes:

1. **Rows** — group text items by y coordinate to rebuild what a reader sees on one line.
2. **The spread** — find the name column on the left page (the leftmost x shared by several items,
   not the smallest x, which is the folio), then take the right page’s text within that row’s
   vertical span. Names that wrap (“Quasar Launcher” / “(Cannon Mode)”) merge into one row.
3. **Cells** — split each row by column, so `3 Energy damage—Blast: 10ft radius` stays intact and
   separate from the ALTERNATE EFFECTS cell beside it. This also tells base from alternate, which
   is what `X Effect` vs `X Alternate Effect` needs.

### What it found

**Geometry is not always printed as a Blast.** Much of it reads `Multiple (3) Targets (30 ft
cone)` instead, and every previous pass looked only for the word Blast. That omission hid the one
real class of error here.

**Eight shapes were wrong, now corrected** — all of them a printed **cone** stored as a circle.
Radii were already right in every case, so only the shape changed. The first four came out of the
Blast/Multiple-Targets scan; the second four needed the extra layouts described below:

| item | book | was | now |
| --- | --- | --- | --- |
| Heavy Machine Gun Alternate Effect 2 | GI Joe CRB p.145 | circle 30ft | cone 30ft |
| Machine Gun Alternate Effect 2 | GI Joe CRB | circle 30ft | cone 30ft |
| Submachine Gun Alternate Effect 2 | GI Joe CRB | circle 15ft | cone 15ft |
| Heavy Machine Gun Alternate Effect 2 | TF CRB p.127 | circle 15ft | cone 15ft |
| Shotgun Effect | GI Joe CRB p.286 | circle 15ft | cone 15ft |
| Shotgun Effect | TF CRB p.246 | circle 15ft | cone 15ft |
| Machine Gun Alternate Effect 2 | TF CRB p.260 | circle 30ft | cone 30ft |
| Deerskin Suitcase Effect | WTNV Citizens’ Guide p.68 | circle 10ft | cone 10ft |

**The "~20 radius disagreements" do not exist.** Only **one** effect name carries different values
in two packs — Heavy Machine Gun Alternate Effect 2, 30ft in the GI Joe CRB and 15ft in the TF
CRB — and both are correct, because the two books genuinely print different numbers for the same
weapon name. The earlier figure came from matching names across all books at once, which is
exactly the collision this per-book method avoids. 19 effects are now independently confirmed
against their own book, and no radius disagreed with print.

**Two misspellings fixed**, verified against Across the Stars, where every other member of the
family is spelled correctly: `Quaser Lancher (Cannon Mode) Alternate Effect` and `Quaser Launcher
(Cannon Mode) Effect` are both **Quasar Launcher**. Their filenames still carry the old spelling;
only the `name` field was changed, because the id is what references resolve through and renaming
files would churn the diff for no gain.

### What is still unverified, and why

**40 of the 104 remain unconfirmed** — not wrong, unverified. 64 are confirmed against their own
book and nothing that could be located disagrees with print.

Getting from 19 confirmations to 64 took three more layouts, each of which the previous passes
read as nothing at all:

- **The labelled equipment entry** — `Hi-Ex Grenade ... Effects: 2 Sharp damage Blast (5ft
  radius) ... Traits:` — handled by a window after the name, cut at `Alternate Effects:` so base
  and alternate keep their own geometry, and stopped at `Traits:` so it cannot bleed into the next
  weapon. (It bled anyway on Deerskin Suitcase, inheriting the previous entry’s radius; reading the
  page settled it as a cone.)
- **Wrapped vs. adjacent names** — whether two lines in the name column are one wrapped name
  (“Quasar” + “Launcher (Staff)”) or two weapons (“Cannonade” then “Fire Cart”) is undecidable by
  geometry: in a dense table both sit one line height apart. Both readings are indexed and the
  known compendium name picks the right one.
- **The name is not always the first column** — A Jump Through Time leads with AVAILABILITY, whose
  cells span several rows, so the leftmost column yields “LIMITED” and “STANDARD” as weapon names.
  Each of the first few columns is tried as the name column.

What is left resists for reasons no parser fixes: a weapon printed only inside a vehicle or NPC
stat block under a different name, an effect whose parent weapon is not named in the book the item
cites, or a generic name appearing several times in one book with different stats. 16 of the 40
are in A Jump Through Time, 7 each in Finster’s and the Quartermaster’s Guide. Closing them means
reading entries one at a time — the machinery narrows each to a page, but the judgement is human.

## Perk action costs (2026-09-20)

The backlog said ~1,963 Perks were missing an action cost. That framing was wrong: `none` is the
schema’s documented "nobody has said yet", and the overwhelming majority of Perks are passive and
correctly carry it. The real question is narrower — **which Perks does a book actually give an
action cost to?** — and it is answerable, because these books name the type explicitly whenever
one applies.

Perks with an authored action cost went from **190 to 313** (147 free, 119 standard, 45 move, 2
standardAndMove). 1,840 remain `none`, which is correct for them.

### The 12 flagged as activatable with no cost

Only **three** actually name an action in print:

| Perk | printed | now |
| --- | --- | --- |
| Timeslide | A Jump Through Time p.47 — "as a Move action" | `move` |
| Iron Bravado | A Jump Through Time p.48 — "As a Free action" | `free` |
| You Got This! | PR CRB p.35 — "As a Free action" | `free` |

Seven are **correctly `none`**, and this is the useful part: their activation cost is a resource,
not an action. Stand Behind Me! and Focused Strike spend Personal Power, Do Or Die a Moxie Point,
Hardcore an Energon Point; All For One triggers at 0 Power or Health; Whatever We Need expends a
Quip; Calm Beast is a flat passive shift. `canActivate` means "the player does something", which
is not the same as "it costs an action" — the two fields are independent and both are right here.

Two — **Chronomantics** and **Quantum Morph** — have no findable description in A Jump Through
Time; only table rows and a sidebar. Left alone.

### Scanning every Perk

All 2,149 Perks with a book were checked against their own book for a printed action phrase. The
attribution took three attempts, and the two failures are worth recording because both produced
confident-looking nonsense:

1. **"The name appears near the phrase"** — 351 hits, badly wrong. Level tables and
   cross-references drop other Perks’ names into the lead-in, so GROWL’s Free action was credited
   to Beatdown, and POISONOUS’s Move action to Chemist, Intoxicate and Poison Chemistry alike.
2. **"The nearest name wins"** — 307 hits, wrong differently: it dropped Menacing Laugh and Growl,
   which were right, while keeping other noise.
3. **Segment each page into entries at their ALL-CAPS headings, and take the FIRST action phrase
   inside each** — 123 hits, and every one belongs to the entry it is attributed to. The heading
   is what actually delimits an entry, and the first phrase is the activation cost; a later one is
   a secondary use.

That last distinction is not academic. **Holographic Doubles** reads "At 10th level, *as a Standard
action*, you can create a Holographic copy... Once activated, you can *spend a Free action*" — the
authored `standard` was right all along, and the first two methods would have overwritten it.

**120 `none` → free/standard/move were applied, then reverted.** A six-item spot check looked
clean, so a wider sample of 15 was drawn across the whole set — and **6 of the 15 were wrong**, an
error rate near 40%. They are back to `none`; only the three hand-read Perks above carry a new
cost.

The four failure modes, none of which the heading-and-first-phrase method can see:

- **Bulleted sub-features.** A Perk’s entry often contains its own bullets, each with an action:
  Phantom Focus took "As a Standard action" from its "• Multiversal Pocket" bullet, and Circle of
  Magical Friends took one from "• Spellcosting". The action belongs to the bullet, not the Perk.
- **Negation.** Heroic Sacrifice reads "you may immediately Sprint... **without using** a Move
  action" — matched as though it costs one.
- **Conversion clauses.** A Talent For Honesty reads "treat a Standard action related to Honesty as
  a Move action" — that is a Perk about changing costs, not a Perk that costs a Move action.
- **Entry boundaries.** Beatdown and Burn Rubber were credited with phrases from adjacent text.

A sound version needs to skip bullets inside an entry, reject negated and comparative phrasings
("without", "instead of", "treat ... as"), and take only a phrase that governs the Perk’s own
sentence. That is real work, and until it exists `none` is the honest value — which is what the
schema says it is for.

**What the exercise did establish:** Quantum Morph is `standard` (A Jump Through Time p.45, "saying
the words “Quantum Power!” as a Standard action"), one of the two entries that could not be found
earlier. It is left unapplied with the rest pending a trustworthy pass.

### Three deliberately NOT applied

Each would overwrite a cost somebody authored on purpose, and the scan is not more trustworthy
than a human choice:

- **Jury Rig** (`standard`, scan says free) — a false positive. The book says the benefits last
  longer *if* you make the Skill Test as a Free action; that is a conditional bonus, not the base
  cost. `helpers/jury-rig.mjs` implements it.
- **Animal Gait** (`free`, scan says standard) — Cobra Codex p.61 does print "as a Standard
  action", but `helpers/animal-gait.mjs` exists, so the `free` looks deliberate. Wants a ruling.
- **Favorite Command** (`free`, scan says move) — GI Joe CRB p.167 and the WTNV Citizens’ Guide
  both print "as a Move action instead of a Standard action". This one is probably a genuine fix,
  but it changes an authored value, so it is left for review.

**One to double-check:** Beatdown (Cobra Codex p.71) was given `free`, but its entry text reads
like a weapon-upgrade Perk rather than the melee Perk the name suggests. It is the one applied
change I would verify by eye.

### Second pass, with the failure modes filtered (2026-09-20)

The four failure modes above are all **sentence-level**, so the filter had to be too - a fixed
character window misses "Once per round, treat a Standard action related to Honesty as a Move
action", which disqualifies itself 75 characters before the phrase that matched. The scan now:

- cuts an entry at its first bullet, so a sub-feature’s cost cannot be read as the Perk’s;
- rejects any phrase whose sentence contains *without*, *instead of*, *rather than*, *no longer*,
  *as if*, or *treat*;
- rejects a sentence opening with *if / when / while / unless / whenever*, which describes when
  something still works rather than what it costs;
- requires the phrase within the first 400 characters, where an activation cost is stated.

**Conversion Perks are passive and now excluded on purpose.** "You can kitbash equipment as a Free
action instead of a Standard action" (Quickbash) does not cost a Free action to use - it changes
what kitbashing costs. Quick Draw, Favorite Command and Play Favorites Against Each Other are the
same shape. `none` is right for all of them.

8 of the 9 known-bad cases are now excluded, and a fresh 15-item sample read **15/15 correct**
(against 9/15 before). **79 Perks were given a cost**, taking the total from 193 to 272.

Two held back deliberately: **Beatdown**, whose BEATDOWN heading matches inside a level table so
its Free action belongs to a neighbour; and **Animal Gait**, where the book prints "as a Standard
action" but the authored `free` has its own helper and so looks deliberate.

### Book-name inconsistencies in the compendium (2026-09-20)

Measuring scan coverage per book turned up a data problem rather than a parser one: several books
are recorded under names that match nothing, so **their items were never checked against any book
at all**. All five are unambiguous, and 93 items across 7 types (perk, focus, origin, hangUp,
faction, role, altMode) were normalised to the title each book actually carries:

| recorded as | items | corrected to |
| --- | --- | --- |
| `Field Guide to Action & Adventure` | 37 | `Field Guide to Action and Adventure` |
| `Sgt Slaugter Sourcebook` | 24 | `Sgt Slaughter Sourcebook` |
| `Field Guide to Action and Adventure` | 19 | (already correct, but the book was unmapped) |
| `Power Ranger Core Rulebook` | 2 | `Power Rangers Core Rulebook` |
| `Across the Stars ` / ` My Little Pony Core Rulebook` | 2 | whitespace trimmed |

Four items carry an empty `source.book` and were left alone - that is missing data, not wrong data.

With those books mapped, the scan found three more Perks whose entry names an action, all read and
applied: **Hup! Hup! Hup! Hup! Hup!** (standard), **This Is For Me** (move), **Knuckle Up** (free).
Perks with an action cost: **275**.

**Coverage is now the limit, not correctness.** Per book, the share of Perks whose heading can be
located at all varies widely - the Cobra Codex and GI Joe CRB are nearly complete, while the Power
Rangers CRB yields exactly **one** ALL-CAPS heading against 130 Perks, so its entries are found
only by the weaker "Name:" pattern. That book sets its Perk names in a style neither pattern
catches, and it is the largest remaining gap.

### A method that did not work, and the signal that should (2026-09-20)

The books that set Perk names in title case have no detectable heading, so the next attempt used a
different principle: an entry runs until the **next Perk name** appears. That is wrong, and badly -
a 15-item sample came back **12 wrong**, roughly an 80% error rate, against 0/15 for the ALL-CAPS
method.

The reason is worth keeping: entries are delimited by plenty of things that are not Perk names. The
scan attributed a weapon trait ("Mounted: Requires a mount... that takes a Standard action to set
up") to Martial Artist; a Cybertronian feature ("Mode Conversion: ... spend a Standard Action to
convert between Bot Mode and Alt-Mode") to both Headmaster Body and Earlier is Better Than Later; a
monster ability ("Aerial Mine: ... As a standard action") to Plate Piercing; and the neighbouring
entries BRACING and Bowl-Over to Empty The Mag and Wealth. All 69 were discarded.

**The signal that actually distinguishes a heading is the font.** pdf.js reports `fontName` and
`height` per text item, and on Power Rangers CRB p.95 the body runs in `g_d0_f3`/`g_d0_f4` at
height 10.5 while every Perk heading - "Acute (Sense)", "Always Alert", "Athlete’s Grace" - is
`g_d0_f6` at height 16. That is a clean separator, it does not care about case, and it should reach
the title-case books the text patterns cannot: the Power Rangers CRB (132 Perks), the Transformers
CRB and the Decepticon Directive. Worth building next.

Perks with an action cost stands at **275**; nothing was applied this pass.

### Finding headings by font (2026-09-20)

The font signal works, and it is what the earlier text patterns should have been all along. For
each page the scan groups text items by `fontName` + `height`, and a group counts as the heading
face only when something set in it spells a Perk name the compendium already knows - the face is
never assumed. A face used by more than 40% of the page is prose and is rejected even if it
happens to match. Entries then run from one heading to the next.

Coverage against the previous best, by book:

| book | Perks | headings found |
| --- | --- | --- |
| GI Joe Core Rulebook | 310 | 424 |
| Transformers Core Rulebook | 235 | 256 |
| Decepticon Directive | 168 | 180 |
| My Little Pony Core Rulebook | 170 | 172 |
| Cobra Codex | 162 | 161 |
| **Power Rangers Core Rulebook** | **132** | **135** (was 1) |

Counts above 100% are Perk names that head more than one entry across the book, which is fine -
consistency across all of a Perk’s appearances is required before anything is applied.

Two more failure modes showed up in the first sample and were filtered:

- **"instead" without "of"** - Talented reads "use a Standard action related to your Talents as a
  Move action **instead**", another re-costing Perk.
- **A subordinate when/if clause before the phrase** - Nowhere to Run reads "at 9th level, **when
  you take a Free action to aim**, you can forgo the bonus". The Free action is the aiming, which
  the Perk modifies. Rejecting these loses a few genuinely triggered costs as well; a Perk left at
  `none` is the honest default, a wrong action type is not.

After filtering, a fresh 12-item sample read **11 correct**. **31 Perks were given a cost**,
taking the total to **306**. Among them the first entries ever read out of the Power Rangers CRB
and the Decepticon Directive: It’s Morphin Time! and Let’s Bring ‘Em Together! (standard), Power
Burst (standard), Empty Gesture (move), Mine! and Loyal Minions (free).

Three are held back by hand: **Beatdown** (heading matches inside a level table), **Knock Down,
Drag Out** ("you can use Try Me and This is for Me as Free actions" re-costs *other* Perks, so
this one is passive), and **Animal Gait** (overwrites an authored value that has its own helper).

### A bug in the filter, and what it cost (2026-09-20)

Verifying the applied batch turned up four more wrong - all the same shape, a Perk that makes some
OTHER action cheaper. "You can **Defend** as a Free action" (Dodgy, in two books), "set up
**Contingency actions** as Free actions" (Leader in Crisis), and Multiplication, whose phrase sits
inside a "For example" sentence about a different Perk.

Filtering those exposed a real bug. The re-costing and subordinate-clause tests both examined
`lead`, the text between the sentence start and the phrase - but `lead` was sliced from a
**trimmed** copy of the sentence while the offsets came from the untrimmed body, so every
character of leading whitespace shifted it. The filter matched correctly when tested in isolation
and silently did nothing in place. It was also comparing lower-case patterns against text that
still had its capitals.

That mattered because **every earlier batch was filtered with the broken test**. So rather than
trust them, each of the 112 Perks changed from HEAD was re-checked against the corrected scan, and
the 24 it no longer endorses went back to `none`. Two were kept: Iron Bravado and This Is For Me
were read off the printed page by hand rather than produced by a scan, so the scan not endorsing
them says nothing about whether they are right.

Perks with an action cost: **280**. The remaining disagreements are two known-bad cases held by
hand (Beatdown, Knock Down Drag Out), so the scan is now exhausted for the books it can read.

**The lesson for the next pass:** a filter that rejects nothing looks exactly like a filter with
nothing to reject. Both of this method’s worst errors - the 40% batch and this one - were found by
sampling applied results rather than by reading the code.

### Where the Perk pass finished (2026-09-20)

Perks carrying an action cost: **190 -> 280**. 1,873 remain `none`.

The question that decided when to stop was whether the Perks the scan never reaches are passive or
merely missed. Ten of them were drawn across eight books and looked up by hand. Entry text could be
located for six, and **all six are correctly `none`**:

- Money Talks - "you can make Wealth Tests in place of Requisition Skill Tests"
- Shots Fired - "you gain an Edge on Deception, Intimidation, and Persuasion"
- Kung Fu Grip - "grants you an Edge on Grappling Skill Tests"
- Ninpõ JOEs - "+1 to Willpower", weapon qualifications
- Generosity is Magic - "you gain a Friendship point"
- Shots Fired / Reveal Weakness - passive Edges

The other four have only level-table rows in the text layer. So the unreached remainder is
overwhelmingly passive, which is what `none` is for, and more scanning would buy very little.

Two further things the pass established:

- **The pre-existing 190 hold up.** The corrected scan disagrees with the authored data in exactly
  two places, both of which are its own known-bad cases (Beatdown, Knock Down Drag Out), not
  errors in the compendium.
- **Every applied value is one a corrected scan endorses**, or was read off the page by hand
  (Timeslide, Iron Bravado, You Got This!, Hup! Hup! Hup! Hup! Hup!, This Is For Me, Knuckle Up).

Held by hand and not applied: **Beatdown** (heading matches inside a level table), **Knock Down,
Drag Out** and **Dodgy** (re-cost other actions), **Animal Gait** (would overwrite an authored
value that has its own helper), **Quantum Morph** was applied, and **Chronomantics** has no
findable entry.

### Rulings on the held-back Perks (2026-09-20)

- **Animal Gait is `standard`** (was `free`). Cobra Codex p.61 prints "as a Standard action", and
  `helpers/animal-gait.mjs` quotes that same line in its own doc comment - the helper agreed with
  the book all along and only the compendium disagreed. Note the helper’s aside that "Standard
  actions aren’t budgeted" predates the action economy and is no longer true.
- **Favorite Command is `none`** (was `free`). It re-costs the *Command* action from Standard to
  Move for one chosen Skill; the Perk itself is never activated, so it has no cost of its own.
  Same shape as Quickbash and Tight Bond.
- **Beatdown stays `none`.** The Perk is not activated by an action; its 6th/7th-level clause adds
  a Standard Weapon Upgrade, and a sub-clause’s cost is not the Perk’s cost - the same rule that
  keeps Phantom Focus off its "Multiversal Pocket" bullet.

### The Command action is not modelled

GI Joe CRB p.164: *"Unless you have a Perk that says otherwise, Commanding an animal pet requires a
Handle Animal Skill Test **as a Standard action**"*, with Favorite Command lowering it to a Move
and Tight Bond (p.93) to a Free action a limited number of times per turn.

Nothing in the system represents Commanding a pet, so there is no item for those Perks to modify
and the economy cannot charge for it. That is **consistent, not an oversight**: none of the game’s
own Standard actions - Attack, Defend, Hide, Sprint, Lend Assistance, Search the Area, Use a Skill,
Contingency - exists as an item either. They are things a player declares, and the sheet’s action
pips are spent by hand for them.

Modelling Command would mean modelling that whole set, which is a design decision rather than a
data fix. If it is ever wanted, the pieces already exist: `activation.mjs` supplies the fields and
the pips already support manual spending.

## The rules’ own actions (2026-09-20)

> **Superseded** by "The Actions tab" below: the picker described in this section was removed.

An Item charges itself when it is clicked, through `Item#roll` -> `consumeForItem`. "I Defend" has
no Item to click, so a player had to work out the cost and decrement a pip by hand, with nothing
recording what it went on. The generic actions are now first-class:

- **`E20.namedActions`** (config.mjs) lists them - Attack, Contingency, Defend, Hide, Lend
  Assistance, Search the Area, Use a Skill, Sprint, Command a Pet, Move, Free action. Each carries
  only a label and a `type` that is a key of `actionTypeCosts`, so the cost lives in exactly one
  place: a Contingency is a Standard action here because it is one there. No rule text is stored.
- **A picker on the sheet** spends one, through `spend()` with the action’s own name as the
  source. It is a `<select>`, so it reports a change rather than a click and is bound in
  `_activateCrewListeners` - the same manual binding the crew controls already needed, since
  AppV2’s `[data-action]` delegation is click-only.
- **The turn’s spends read back** in the box’s tooltip: "Spent this turn: Move, Defend", newest
  first. `spend()` has recorded a `source` since it was written; nothing ever displayed it.

Verified live: Defend takes the Standard pip and Move the Move pip, the ledger records
`source: "Defend"` / `"Move"`, Contingency costs a Standard rather than inventing a fourth
category, the picker resets after each use, and all five boxes in the header row stayed at 48px -
the system’s own select styling carries a min-height that first rendered the picker at 22px and
pushed the box to 55, so every dimension is pinned in the SCSS.

The blocked path was not exercised live: `isBlocking()` returns false for a GM by design, and the
browser session is one. It is the same `spend()` contract every other caller uses, and is unit
tested.

**This also gives the re-costing Perks something to point at.** Favorite Command, Tight Bond and
Quickbash change what an action costs; until now the actions they change did not exist. A
per-actor override in the shape of `getPushRules(actor)` would make them live, and is the obvious
next step if wanted.

## The Actions tab

The picker above was the wrong home for this. It sat in the header's bottom row beside Role/Focus/
Origin, where there was room for a control and nothing else - no cost, no grouping, no sense of
what was still affordable - and being a `<select>` it was actively bad at the one thing the rules
ask for most: taking the same action twice. "You can choose to ignore one of the target's Armor
Upgrades **for each Free action you spend Aiming**" (TF CRB) means repeats have to be one click,
not reselect-the-same-option. The picker is gone; the SCSS that pinned it to 14px is gone with it,
and the header box is back to pips and their controls.

In its place, **an Actions tab** on the character sheet, first in the row:

- **`getActionsTabContext(actor)`** (action-economy.mjs) returns three groups, one per tracked
  category, each carrying what is left of that budget and two lists.
- **The rules' own actions** come from `E20.namedActions` as before, now grouped by cost and
  rendered as buttons. Each spends through `spend()` with its own name as the source, which is
  what the turn log reads back.
- **The actor's own costed items** - a weapon, a Power, an activatable Perk - sit in the same
  groups, sorted by name. These already charge themselves when rolled (`consumeForItem`), so the
  buttons here are the ordinary roll/use controls: the tab adds no new spending path, it just puts
  everything that costs something in one place, sorted by what it costs. A Contingency's trigger
  is shown under its name, since a readied action whose trigger nobody can see is useless.
- **Filing a cost that spans two categories.** A Full Action spends a Standard *and* a Move, so it
  can only be filed once. `primaryCategory()` picks the heaviest part and the row's own label
  spells the rest out. `tenMinutes`/`oneHour` cost nothing tracked and are left off entirely.
- **Items with no authored cost are omitted.** Roughly 2,600 Perks and 1,100 weapon effects carry
  none; listing them would bury the handful that do.
- **The tab is hidden, not empty, when the economy isn't running.** `getActionsTabContext` returns
  null out of combat and with the world setting Off, exactly as `getSheetContext` does, and
  `_applyConditionalTabs` follows that rather than restating the conditions.

### Aim

Added to `E20.namedActions` as a **Free action**, on two independent sources:

- GI Joe CRB: "when you **Aim as a Free action**, you can spend your Move action as well to gain
  an Edge on the attack instead of the normal benefits of Aim."
- TF CRB: "instead of +1 shift on your shot, you can choose to ignore one of the target's Armor
  Upgrades **for each Free action you spend Aiming**."

The second is also why the tab uses buttons rather than a select.

### Verified live

On *GI Joe Test*, in an active encounter, as a non-GM user: all 12 named actions render under the
right heading with their cost; **Aim clicked twice spent two Free actions**, both logged as "Aim";
Defend took the Standard; the Standard and Free groups dimmed to 0/1 and 0/2 while Move stayed
bright. Three costed Perks borrowed from the GI Joe CRB pack (Kitbash Equipment / Inspiring Words
/ Bulwark - standard / move / free) each landed in the right group, and clicking Kitbash
Equipment's roll button posted it to chat *and* charged the Standard, logged under the item's own
name - the existing `consumeForItem` path, untouched. Out of combat the nav link is hidden and the
sheet falls back to Skills. The borrowed Perks were removed and the turn reset afterwards.

Two things worth knowing, neither introduced here:

- **No actor in the dev world has a costed item.** Embedded items are snapshots taken when they
  were dragged on, so the ~280 Perks that gained an action cost in the compendium pass do not
  reach characters built before it. New drags pick it up; existing sheets need the item re-added.
- ~~**Weapons default to `actionType: 'none'`**, so a weapon does not appear in the item list.~~
  *(Addressed below - the cost went on the weapon effect, which is what rolls.)*
  Attacking with one is the Attack action, which the tab does offer - but if weapons should carry
  their own cost, that is a data-model default change with its own consequences in strict mode,
  and it is deliberately not made here.

### Attacking costs a Standard action

The cost sits on **`weaponEffect`**, not on `weapon`, because the weapon effect is what rolls: a
weapon has no roll button anywhere in the sheet (the d20 is on the effect rows in
`templates/actor/parts/items/weapon/container.hbs`), so a cost on the weapon itself would never be
charged by anything. One effect is one attack, so a weapon with three effects still costs one
Standard per attack.

What this did and did not change:

- **The 676 compendium weapon effects already stored `standard`** - that was done in an earlier
  pass. No pack rebuild was needed and none was done.
- **The schema default was still `none`**, so an effect a GM created by hand on an actor was born
  costing nothing, however many times it was fired. That is what `activation('standard')` on
  `weapon-effect.mjs` fixes.
- **Copies already embedded that way have `none` baked into their `_source`** and a schema default
  never reaches them, so `migration.mjs` moves `weaponEffect` from `none` to `standard`. Matched on
  the old value rather than overwritten wholesale, which makes it a no-op on the second run and
  leaves an effect that already carries a cost alone. Deliberately not version-gated, for the
  reason already documented on the Zord defenses migration: this repo ships an unsubstituted
  `version` string, so worlds exist whose recorded migration version a gate would skip forever.
- **`weapon` itself is left at `none`.** Giving it a cost would put every weapon on the Actions tab
  twice - once as the weapon, once as each of its effects - and charge nothing extra, since nothing
  rolls it.

On the tab, an effect is listed under its parent weapon: "Long Range Automatic Rifle: Frag Grenade
Effect". Its own name is either redundant ("Auto Blaster Effect", under Auto Blaster) or useless
("New WeaponEffect", the hand-made default), so the weapon is named alongside it only when the
effect's name does not already contain it.

### One Aim per shot

Aim is a Free action, and a character can have several Free actions, so this is **not** a budget
rule - `canSpend` will happily allow a second Aim. The limit is that a single shot can only be
aimed once; two Aims with no shot between them would read as a stacking bonus, which no printed
Aim rule grants.

- `aimed` on the ledger, beside the other per-turn state. `isAiming(actor)` / `setAiming(actor,
  aiming)`, the latter a no-op when the value is unchanged so an ordinary roll does not write to the
  combatant for nothing.
- The Actions tab reports it as `alreadyAimed`, separately from `affordable`, so the row can say
  which of the two is stopping it: the Aim row dims and reads "Already Aiming" *while Free still
  shows 2/2*.
- The aim is set only once the Free action has actually gone through, so a refused aim does not
  leave the actor holding one it never paid for.
- **Cleared by the shot**, in `item.mjs#roll` when a `weaponEffect` resolves - which is what makes
  it once per *roll* rather than once per turn. Cleared after the spend rather than after the roll
  resolves, so a blocked or cancelled attack keeps the aim. `resetTurn` clears it too.

The Transformers CRB has its own exception - "you can choose to ignore one of the target's Armor
Upgrades **for each Free action you spend Aiming**" - which spends repeatedly against a single
shot. That is a TF-specific trade rather than the general Aim rule, and if it is ever wanted it
needs its own option rather than the removal of this gate. The comment on `isAiming` says so.

### Verified live

On *GI Joe Test*, with a Long Range Automatic Rifle and a weapon effect parented to it: a brand new
weapon effect is born `standard`; the effect appears on the tab under the rifle's name at a
Standard cost; **Aim, then Aim again is refused** ("GI Joe Test is already Aiming - take the shot
before Aiming again") and spends nothing; taking the shot charges the Standard *and* clears the
aim; Aim is then available again. The turn log read `Aim -> free`, `Frag Grenade Effect ->
standard`, `Aim -> free`. Test items removed and the turn reset afterwards.

## Making the actions do something

Spending was all that happened: taking Defend charged a Standard action and then left the player to
remember, unaided, that everything attacking them this round is Snagged. `helpers/named-actions.mjs`
is the other half, and it is deliberately the only place that knows what an action *does*, so the
sheet stays wiring. The Actions tab marks the wired ones with a filled icon, so a player can tell at
a glance which the system will run for them.

Four are wired, each straight from the printed rule.

### Defend (GI Joe CRB p.196)

> "After announcing a Defend action, all attacks against you from adversaries and effects you can
> see suffer a Snag on their Attack Skill Test. This benefit lasts until the beginning of your next
> turn."

A **Condition**, `defending`, rather than a flag: it shows on the token, so a GM can see who is
defending without opening five sheets, and the attacker reads it off their *target*, which
`actor.statuses` makes a one-liner. It borrows the shield art from `assets/icons/items` rather than
adding a new status icon, and its `changes` array is empty on purpose - the Snag lands on the
attacker's roll, not on any field of the defender, so there is nothing for an Active Effect to
change.

- Applied by `named-actions.mjs`, read by `dice.mjs#_getAutomaticCombatModifiers` inside the
  resolved-target block, cleared by `combat.mjs#_onStartTurn` - which is exactly what "until the
  beginning of your next turn" means, and is why it is *not* an end-of-round sweep.
- Gated on `isAttack`: RAW says "attacks against you", not any Skill Test, so a Persuasion test
  aimed at someone Defending is unaffected.
- The clear sits **outside** the `isTracking()` guard in `_onStartTurn`. Defend is a rules effect
  that works whether or not the world is counting actions, and a Condition that could be applied
  but never cleared would be worse than not applying it at all.
- **"you can see" is deliberately not enforced.** This system has no model of which adversaries an
  actor is aware of, and deriving one from token vision would be wrong about darkness, cover and
  every Perk that grants awareness. The Snag annotates the Roll Options Dialog with its own name,
  so a GM ruling the defender never saw this one coming just puts the radio back to Normal.

### Aim (GI Joe CRB p.193)

The printed rule turned out to be narrower than the two references found earlier:

> "A **Ranged weapon-specific** Free action is Aiming, which grants a up-1 shift on a **single**
> ranged attack test as long as you **don't use Movement** between your Aim and your attack."

So the flag added last round now does something, under all three constraints, each enforced where
the information actually is:

- **the shift** - `dice.mjs`, `isAttack && !isMelee`. Melee is one of four weapon styles and the
  other three (energy, explosive, projectile) are all ranged, so the existing `isMelee` is exactly
  the right inverse.
- **single** - the shot spends it (`item.mjs#roll`), and the tab refuses a second aim.
- **no Movement** - `documents/token.mjs` clears it in `_preUpdateMovement`, after the economy has
  accepted the move. A movement that was *refused* never happened and must not cost the aim.

### Hide and Search the Area

Both are a single Skill Test in the rules - Infiltration (p.196) and Alertness (p.197) - and both
now roll it, through `actor.rollSkill` with the same dataset the Skills tab builds. Reading the
shifts off the actor rather than restating them is what keeps these identical to a hand-clicked
roll as the skill schema grows, including the Roll Options Dialog and every Perk that feeds it.

Hide deliberately does **not** store its result as a live Difficulty. The same page makes ending it
a judgement call - "your Hide benefit ends if you attack, make sufficient noise, move out of
cover... or move more than half of your Movement" - and a stored number that silently outlives the
cover it was rolled behind is worse than a number on a chat card.

### The ones left as cost-only, and why

Listed in `named-actions.mjs` beside the code, with a test asserting every named action is in
exactly one of the two lists - an action in neither is one nobody decided about, and a player
reading the tab cannot tell "not automated" from "forgotten".

| Action | Why not |
|---|---|
| Attack | Already covered - the weapon effects on the tab *are* the Attack action, and they roll and charge themselves. |
| Contingency | The trigger is free narrative text and resolution is out of turn. `contingencyTrigger` exists on items; a generic Contingency has nowhere to put one yet. |
| ~~Lend Assistance~~ | **Built** - see below. |
| Use a Skill | Rolling a skill is what the Skills tab does. Its one addition - down-1 per adjacent enemy - needs a token on a scene and a reach calculation. |
| ~~Sprint~~ | **Built** - see below. |
| Command a Pet | A Handle Animal test against a Difficulty the GM sets per command; rolling it blind invites the wrong comparison. |
| Move / Free action | Nothing to do - moving the token is the action, and Free action is the catch-all for interactions the system does not model. |

### Verified live

On *GI Joe Test*, in an encounter: Defend applied the Condition and announced it; a Cobra Trooper's
ranged attack against that target came back `snag: true` with a labelled **"Defending"** source,
while the same attacker's non-attack Skill Test against them came back clean. Aim gave **+1 on the
ranged effect and nothing on the melee one**. Search the Area opened a *"d20 Alertness Skill Roll"*
and rolled it; Hide opened a *"d2 Infiltration Skill Roll"*. Advancing to the defender's next turn
cleared the Condition. The tab marked exactly Defend / Hide / Search the Area / Aim as wired.

One gap in the live pass, covered by unit tests instead: **token movement could not be driven from
the console in this session** - `move()` and `update()` both left the token in place, with or
without these changes (the pre-change `_preUpdateMovement` behaves identically, so this is not a
regression). `_preUpdateMovement` *did* fire and return true, and the aim cleared on that path. The
case that matters and could not be reached live - a movement the economy **refuses** must leave the
aim alone - is asserted in `token-movement.test.js` against the real `consumeForMovement` rather
than a mock, since the whole question is the boundary between the two.

## Sprint and Lend Assistance

### Sprint (GI Joe CRB p.197)

> "The Sprint action is nothing more than a way to cross more ground quickly during your turn. By
> taking a Standard action to Sprint, you may move up to double your full Movement."

A per-turn flag on the ledger (`sprinting`, beside `aimed`), read by `getMovementAllowance`. That
one function is what both the drag ruler and the movement enforcement measure against, so doubling
it there is what makes the two agree - a sprinting token draws green all the way to twice its
rating and is charged accordingly, with no second implementation to drift.

**The Push cap had to move with it.** "A character cannot spend Free actions on buying additional
Movement that would double one of their Movement Types" (p.193) is a ceiling on the **base** rating,
but `planPush` applies `capMultiplier` to the **allowance**, which Sprint has just doubled. Left
alone, sprinting would have quietly raised the ceiling from 2x to 4x base. `getPushRules` divides
the multiplier by the same factor, keeping the ceiling at the same absolute distance either way.

In practice that means **a sprinting character cannot Push at all** - they are already at double,
and buying more would take them past it. That reads like a restriction but is just the two rules
meeting. Dividing rather than assigning 1 is deliberate: Earlier Is Better's uncapped `Infinity`
has to stay uncapped while sprinting, and Infinity / 2 is Infinity.

### Lend Assistance (GI Joe CRB p.197)

> "...you can Lend Assistance to an ally for a specific target within 50 ft. Until the beginning of
> your next turn, the first attack against the specific target gains an Edge. Alternatively, if a
> character has at least as many levels in a given skill as their ally, they may Lend Assistance to
> that ally to give them an automatic up-1 shift to their use of that given skill."

Two grants, so **two flags** rather than one with a mode field - an ally can plausibly be assisted
both ways in a round, and a single flag would have the second quietly overwrite the first. Both are
banked on the **ally** and consumed by their own roll, the shape `shoulder-to-shoulder.mjs` already
established; `dice.mjs` reads the Edge in the resolved-target block beside Menacing Glare and the
shift beside Shoulder To Shoulder itself.

One dialog asks both questions at once - who, and how - because the ally is needed either way. The
attack option is only offered when there is a target in range, and it names it, so the mode list
reads "Their first attack against TEST Enemy gains an Edge".

What is enforced and what is not:

- **50 ft** is measured from the assister to the target. Past it, the attack option is simply not
  offered and the skill half still is, rather than the whole action being refused. A distance that
  cannot be measured at all - no scene, theatre of the mind - is not treated as out of range.
  ("an ally for a specific target within 50 ft" could also be read as the ALLY being within 50 ft;
  the target reading is taken because the target is what the sentence goes on to talk about.)
- **The skill-levels prerequisite is enforced** - the one hard numeric test in the action, so
  leaving it to the table would waste it. `getSkillRanks` counts shifts above untrained plus a
  Specialization, and equal is enough ("at least as many").
- **"Until the beginning of your next turn"** is not, matching every other banked bonus here (see
  `perks.mjs#bankPendingBonus`, which stamps a combat id so nothing survives into a new encounter
  but deliberately does not expire on a turn boundary). "The first attack" is the clause that
  decides it in practice, and that one *is* enforced - the Edge is consumed whether it hits or
  misses, which is what "first" means.

**The action can be cancelled, which is new.** It is the only one that asks a question, and an
action that helped nobody was never taken - so the sheet hands the Standard back. The refund keys
off a `cancelled` flag in the handler's return rather than off the action name, so the next action
that asks a question gets it for free. Writing the tests also turned up that choosing attack mode
with no target in range threw; it now cancels, since the player can untarget while the dialog is
open.

### Verified live

The world had been shut down between sessions, so it was relaunched first (nothing was building -
checked, since a pack compile needs no world loaded).

**Sprint**: allowance went 35 -> 70 on the click, the Push cap stayed at **70 in both cases**, the
Standard was spent and the chat notice posted. **Lend Assistance**: the dialog listed only the
friendly token as an ally and named the targeted enemy in the attack option; confirming banked
`{targetId, edge: true}` on the ally; the ally's attack against **that** enemy came back with a
labelled **"Lend Assistance [edge]"** source and against a **different** enemy did not. The skill
half banked `{skill: 'alertness', shiftUp: 1}`, and a real Alertness roll by the ally showed
**Shift Up 1** in the dialog, rolled `1d20 + 1d2` (the die shifted), and **cleared the flag**.
Cancelling the dialog handed the Standard action back. All test tokens, the borrowed weapon effect
and the banked flags were removed afterwards.

## Restructuring the Actions tab

### Weapon effects under Attack

A weapon effect **is** the Attack action - it is the thing that rolls, since a weapon has no roll
button anywhere in the sheet. Listing effects as siblings of Attack made them read as a list of
unrelated options with Attack sitting uselessly among them, so they now nest under it, indented.

They nest **whatever their own cost says**. An effect somebody has set to Free is still a way of
taking the Attack action, and filing it away into the Free group would hide it from the action it
belongs to; the row still shows Free, so nothing is concealed. Attack itself keeps its place in
Standard.

The indent is on the row rather than a wrapper, so the list stays flat for a screen reader and the
hover and dim states keep applying unchanged.

### Activatable Perks

Two different reasons an item belongs on this tab, and they do not overlap:

1. **It costs something** - a weapon effect, a Power, a Perk with an authored action cost. Filed
   under what it costs.
2. **It can be activated** - a Perk with a Use button. Most of these carry no action cost at all
   (the ~2,600 unauthored Perks), so rule 1 missed exactly the ones a player most wants to find on
   their turn.

The predicate is `canUsePerk`, the same one the Perks tab's own Use button renders on, so the two
agree by construction: a Perk that has spent its once-per-turn drops off this tab exactly as its
bolt icon disappears over there. That is a deliberate choice rather than an accident - the tab
answers "what can I do **now**" - and it is worth knowing, because a row vanishing between renders
is otherwise easy to read as a bug.

An item can satisfy both, and is then filed once under its cost with the Use button its activation
earns it - not listed twice.

Perks with no tracked cost go in a **"Perks You Can Use"** section below the three budget groups,
with no x/y readout. They cannot claim a budget they do not spend, and filing them under one at
random would be the system inventing a cost - the same reasoning that keeps the activation
template's default at `none`.

The row markup is now a single inline partial used in all three places (cost group, nested under
Attack, untimed), so the three cannot drift apart.

### Verified live

On *GI Joe Test*, with an Assault Rifle and its two effects: the tab rendered

    Standard 1/1
      Attack                              STANDARD
        >> Assault Rifle Alternate Effect STANDARD
        >> Assault Rifle Effect           STANDARD
      Contingency ... Command a Pet
    Move 1/1 / Free 2/2
    Perks You Can Use
      Mark Target
      Takedown

**Takedown was already on the actor** - the section found a real activatable Perk on its own, not
just the one added for the test. Clicking a nested effect's d20 rolled it and charged the Standard,
logged as "Assault Rifle Effect -> standard", exactly as before the move. Clicking Mark Target's
bolt ran the real Perk handler, which answered "No target selected to Mark." - the same path the
Perks tab's own button takes.

One thing worth recording from the setup: creating a compendium Perk with `toObject()` +
`createEmbeddedDocuments` leaves `_stats.compendiumSource` unset, so `canUsePerk` did not recognise
it until that field was written by hand. A real drag sets it. This is the same
`flags.core.sourceId` vs `_stats.compendiumSource` pattern already noted elsewhere in this project -
worth remembering whenever a Perk that should be activatable silently is not.

## Takedown, and the stale-snapshot bug it exposed

**Takedown was already built.** `helpers/takedown.mjs` has the Might-or-Finesse picker and fires a
real roll against the target's Toughness; `dice.mjs`'s post-hit processing carries the whole
outcome matrix from GI Joe CRB p.74, Takedown Expert's Edge and its Immobilized included:

| | threat <= your level | threat > your level |
|---|---|---|
| **Hit** | no damage; Restrained + Unconscious | Grapple |
| **Miss** | Grapple | no effect |

And the compendium item has said `actionType: standard` for as long as the action-cost pass has
existed. Confirmed live end to end: the picker offered Might/Finesse, the roll went vs **Toughness
DIF 11**, came up Failure against a Threat Level 0 target at attacker level 15, and the target came
out **Grappled** - the miss/low-threat corner of the matrix, exactly as printed.

Three clauses are deliberately unenforced and documented in the helper: "surprised or not in
combat, and unaware of your presence" (no Surprised status or awareness tracking exists anywhere),
"using both hands", and "unarmed" (Takedown deals no damage, so the usual no-parent-weapon proxy
buys nothing). "1d4 minutes" of Unconscious is granted, not auto-revoked - no such hook exists.

### The actual bug: embedded items are snapshots

Takedown showed up under "Perks You Can Use" instead of Standard because the **copy on the
character** still said `none`. Whatever the compendium said the day an item was dropped onto a
character is what that copy still says, forever. When a pass gave ~280 Perks an action cost, every
character built before it kept a copy costing nothing.

Measured in the dev world before building anything: of **149** embedded compendium items, **18** had
drifted - and **every single one was `none` -> something**. Not one was a GM disagreeing with the
book. That is what makes the fix safe to automate.

`migration.mjs#migrateItemData` now adopts the compendium's cost when, and only when, the embedded
one is `none`:

- **Only `none` -> something.** A value already set is either one this migration applied or one a GM
  chose deliberately, and there is no telling those apart - whereas `none` is this system's own word
  for "nobody has said yet" (data/item/templates/activation.mjs), which is exactly what a stale
  snapshot is.
- **Value-matched, not version-gated**, same as its neighbours and for the same reason: this repo
  ships an unsubstituted `version` string, so worlds exist whose recorded migration version a gate
  would skip forever. Once corrected, the value no longer matches, so it can only fire once.
- **Every item type**, not just Perks - the same drift hit Spells and Powers in the dev world.
- The **weaponEffect rule added earlier is now explicitly the fallback**, for an effect with no
  compendium original at all, which is the case it was written for. Where the pack has an answer,
  the pack wins.

Pack indexes are cached for the length of a run - a party of six would otherwise re-read the same
index a hundred times - and `resetMigrationCaches()` clears them at the start of `migrateWorld`, so
a GM who edits a compendium and migrates again in the same session gets what they just wrote.
(Writing the tests is what caught that: the cache was module-lifetime, and one test's fixture was
visible through another's lookup. The comment had already claimed "for the length of a migration
run"; now it is true.)

### Verified

Run read-only against the dev world, the migration proposes exactly those 18 items and nothing
else - matching an independent scan. **Nothing in the world was changed**: the migration fires on
its own at the next version bump.

## Trait filtering, and upgrades that remove traits

### Compendium Browser: a Traits filter

Weapons and armor share the Equipment tab, whose one secondary-filter slot already holds its Type
filter, so traits needed a filter group of their own rather than a replacement.

**It works the opposite way round from every other group in that sidebar, deliberately.** The Type
and Books filters EXCLUDE: everything starts checked and you uncheck what you do not want. That is
wrong for traits twice over - an item has many traits, not one, and the question a player actually
has is "which weapons are Silent?", which under exclusion semantics means unchecking forty other
traits to ask. So the trait filter REQUIRES: nothing checked means no filtering, and checking narrows
to items that have what you checked. The group carries a one-line hint saying so rather than leaving
it to be discovered.

- **All of the chosen traits, not any.** Picking Silent and Sniper means "a silenced sniper", which
  is the question worth asking; OR is already available by picking one at a time.
- **The list is narrowed to traits actually present** on whatever the other filters have left. The
  raw weapon enum alone is over forty entries, most matching nothing in the books a given table has
  enabled. A trait that is currently required stays listed even when nothing matches it any more -
  otherwise picking two traits with no overlap would empty the results, which would empty the trait
  list, which would leave no way to un-pick the second one.
- **Types on the tab with no traits drop out** as soon as a trait is required, which is correct:
  a coil of rope cannot satisfy "Silent".

Traits are indexed only for the types that can be filtered on, so an index of several thousand rows
does not carry a trait array each for the types nobody filters by.

### Upgrades that remove traits

Rare but real, and the books have two: **Ammo Feeder** (GI Joe CRB p.151) is "Weapon with the Reload
trait / The weapon loses the Reload trait", and Factions in Action Vol. 2 p.96 has a weapon upgrade
that drops Mounted. (A scan of every book turned up five other "loses the X" phrasings; all five are
Conditions, which is a different system.)

`removedTraits` on the upgrade schema, with the same choices as `traits` - anything grantable is
removable - plus its own field on the upgrade sheet, struck through rather than coloured so it reads
the same in both themes. `attachment-handler.mjs` carries it into the snapshot a drop writes onto the
weapon or armor, in the two upgrade branches only; the other two `traits` lines there belong to
weaponEffect drops, which have no such field. Without that the feature would have silently done
nothing in the real UI.

Removal is applied **last**, so an upgrade that takes a trait away beats one that grants it. That is
what the fiction implies - the modification is physical - and it makes the result independent of the
order upgrades happen to be attached.

**Two things about `_prepareTraits` worth knowing.**

First, the result is written over `system.traits` as well as `system.itemAndUpgradeTraits`, and that
is deliberate rather than sloppy. Roughly twenty-five checks across dice.mjs and the helpers ask a
weapon `system.traits.includes(...)` directly, and they have always been answered with the combined
list, because the previous implementation assigned `this.system.traits` to a local and pushed onto
it - mutating the derived array in place. Keeping both names on one computed list preserves every
one of those answers and gives them trait removal for free, instead of rewriting twenty-five call
sites and re-verifying each.

Second, that shared array must never reach an editor, and it used to. `apps/trait-selector.mjs` read
the field back off the derived document, so opening the trait picker on an upgraded weapon
pre-checked the upgrade's traits and saved them onto the weapon itself - a quiet data-corruption bug
that predates this work. With removal in play it would have been worse: it would also have deleted a
removed trait from the base item permanently. The selector reads `_source` now. Every field it edits
is authored; `system.traits` on a weapon or armor was the only one that is also computed over.

### A crash found on the way

A null slot in `system.items` - left behind when a write fails schema validation - made
`_prepareTraits` throw on `attached.type`. Because it runs inside `prepareDerivedData`, that took the
item's **whole** preparation with it: no derived traits, no availability, no aim shift.
`_prepareTotalAvailability` had the same exposure. Both skip a bad slot now. Pre-existing, but hit
for real while testing, so fixed rather than noted.

### Verified live

**The filter**, against all 1,908 equipment items: no filter 1908, Silent 121 (weapons and armor
both), Silent + Sniper **6** - so it really is AND, not OR - and Deflective 52. The sidebar showed
Type (8), Traits (67 present) and Books (25) together.

**Removal**, on a weapon authored `[ballistic, reload]` with an Ammo Feeder-shaped upgrade granting
Accurate and removing Reload: attached gave `[ballistic, accurate]`, `system.traits` agreed with
`itemAndUpgradeTraits`, the authored source stayed `[ballistic, reload]` throughout, and detaching
put it back to `[ballistic, reload]`. Removal is entirely derived; nothing is destroyed. The drop
path's own snapshot builder was checked separately and does carry `removedTraits`.

### Shields and gear

Shields carry **armor** traits (data/item/shield.mjs), so they join the traits facet directly.

Gear has **no traits at all** - checked against the schema and all 256 pack entries, not one has
the field. What it has is `gearType`, a single category (Tools, Kits, Medical...). So gear gets a
facet of its own rather than a trait filter that could never match anything.

That made the one trait filter worth generalising into **FACETS**, where each facet declares which
item types it covers, how to read an entry's value(s), and how several checked values combine:

- **`all`** for a multi-valued field. Picking Silent and Sniper means "a silenced sniper", which is
  the question worth asking; OR is already available by picking one at a time.
- **`any`** for a single-valued one. No gear is both Tools and Kits, so AND there would always
  return nothing - checking two can only sensibly mean "either".

Facets combine with AND, so requiring a weapon trait and a gear category matches nothing. That is
honest: nothing is both.

### A broken control found on the way

**Clicking an actor's portrait to change the image did nothing.** `DocumentSheetV2` dispatches the
file picker from its own `editImage` ACTION - the image needs `data-action="editImage"`, with
`data-edit="img"` only telling that handler which field to write. Every actor template carried the
latter without the former, so the click silently went nowhere.

The item sheet header already had both, which is what confirmed the diagnosis: item sheets worked,
actor sheets did not, and that attribute was the only difference. Fixed on all seven actor
templates (the shared header plus all six sidebars). A comment on
base-actor-sheet.mjs#_activateImageContextMenu claimed the left-click was "handled by
DocumentSheetV2 itself, untouched by this" - true of an older ApplicationV2, not of v14 - and has
been corrected.

Verified on all six actor types: the Image Browser opens from every portrait, and the GM-only
right-click "Show Players" menu still works - it binds `contextmenu`, which the action dispatch
never touched.

### The Actions tab is always shown

It used to be hidden outside an encounter, on the grounds that there is no ledger and so nothing
to display. In practice that meant nine of ten player characters had no Actions tab at all and no
indication why, which is more confusing than a tab that is simply quieter out of combat.

`getActionsTabContext` now always builds a context and reports **`live`** - true only when the
world is counting actions, the actor takes part, AND there is a Combatant to hold the ledger.
Out of combat the tab is a reference:

- **no budget numbers** - "remaining" would only restate the maximum
- **no buttons on the rules' own actions.** This is the part that matters: taking one would spend
  from a ledger that does not exist, and Defend in particular applies a Condition that
  `combat.mjs#_onStartTurn` clears at the start of the defender's next turn - out of combat that
  turn never comes, so it would stick to the actor forever. They render as dimmed, inert icons.
- **items keep their buttons** - rolling a weapon or using a Perk works perfectly well outside an
  encounter and always has.
- a line saying the economy is only tracked during an encounter, so the missing numbers read as
  deliberate.

Nothing is marked unaffordable when there is no budget to fall short of.

`getActionsTabContext` returns null only for an actor with no action economy at all.

Verified live side by side: the in-combat sheet shows budgets and 12 spend buttons; the
out-of-combat one shows the same 12 actions with costs, 12 inert icons, no budget numbers, its
item buttons intact, and the notice. Both have the tab in the nav.

### The Actions tab on the NPC sheet

An NPC has exactly the same action economy as a player character - both actor types build from
`data/actor/templates/common.mjs` - so it needed no variant of its own. The template moved from
`parts/main/character-actions.hbs` to **`templates/actor/tabs/actions.hbs`**, which is where this
project already keeps the tabs several sheets share (`effects.hbs`, `notes.hbs` live there), and
both sheets point at the one file.

On the NPC sheet it sits second, right after the stat block - the same position it holds after
Skills on a character - and is always shown, reference-mode out of combat like the other.

Verified live on *Cobra Trooper (Out of Uniform)*:

- **Out of combat**: nav reads npc / **actions** / contact (hidden) / altmode (hidden) / effects /
  notes; all 12 named actions listed with costs, 12 inert icons, the notice, and the trooper's two
  weapons nested under Attack as "Fang Handgun: New WeaponEffect" and "Combat Knife: New
  WeaponEffect" - the parent-weapon naming earning its keep, since both effects carry the useless
  default name.
- **In combat** (temporary token and combatant, both removed afterwards): budgets shown, 12 spend
  buttons, no inert icons, and Defend applied the Condition and posted its chat notice.

One thing that looked wrong and was not: taking Defend dropped Move to 0 as well as Standard. The
trooper is Speed 1, so `shared` is true and spending either consumes the other - "Move OR Standard
action... then ends their turn" (CRB p.193). The sheet says so itself, in the notice it already
shows for that case.

### The Actions tab on vehicles and Zords

Same shared `templates/actor/tabs/actions.hbs`, second in the nav after the main panel, on both.
Neither sheet had a `_prepareContext` of its own, so each gained one whose only job is to supply
`actionsTab`. Neither has a conditional-tab map, so the tab is simply always in the nav.

Verified live: *Modified All Terrain Bike* and *Zord* both render nav `main / actions / passengers
/ effects / notes`, with 13 rows and the out-of-combat notice.

Companion and Megaform are the two actor types still without it. They build from the same
`common.mjs` and would take the same three lines each.

### The Wealth Die on the NPC sheet

An NPC has always had `canShowWealthDie` - it comes from `data/actor/templates/character.mjs`,
which `npc.mjs` uses - and the sheet options have always offered the checkbox. **Nothing on the
NPC sheet ever rendered it**, so ticking the box did nothing at all. Three NPCs in the dev world
already had it switched on.

It renders in the **sidebar**, under Initiative in the Special panel - the same place a character
keeps it, and the same rollable-name-plus-shift-select row that sheet uses, so the two behave and
read identically. (A first attempt put it in the main tab's skills panel; wrong place, and an
icon-plus-label-plus-select row truncated the label to "Wealt..." in a column that narrow.)

Unlike Initiative just above it, the shift IS editable here: Wealth is absent from the Skill Picker
that edits every other NPC skill, so this select is the only way to set it.

**The option is now only offered where a Wealth Die can appear** - player characters and NPCs. It
used to be on every actor type, so ticking it on a Companion did nothing, and on a vehicle, Zord or
Megaform it was writing a field those types do not even have (`canShowWealthDie` comes from
`data/actor/templates/character.mjs`, which only companion, npc and player-character use).

**A pre-existing bug this exposed.** Rolling the Wealth Die - on the character sheet too, long
before this - opened a dialog titled "<actor> d20 **undefined** Skill Roll". The title reads its
label from `E20.originSkills`, which is conditioning plus `E20.skills`, and Wealth is deliberately
in neither: it is a real `system.skills.wealth` field that the sheets present separately as the
Wealth Die. A Role's own skill die had the same gap, being named by the Role rather than an enum.
`helpers/roll-dialog.mjs` now falls back through both. (The label has to be localized at the point
of use - `preLocalize` has already turned those tables into real strings, so passing the key
through would have printed `E20.Wealth` verbatim.)

Verified live: enabling the option makes the sidebar row appear; the shift saves (`d8`); the roll opens
"Cobra Trooper (Out of Uniform) **d8 Wealth** Skill Roll" and rolls `1d20 + 1d8`. An NPC that
already had the option on shows the row without any change to its data. The option itself was
checked on all six actor types: offered on player characters and NPCs, absent from Companions,
vehicles, Zords and Megaforms.

### The Actions tab on Companions and Megaforms

The last two actor types, wired the same way as the rest. Every actor sheet now has it.
Verified: Companion renders `main / actions / effects / notes` with 15 rows, Megaform
`main / actions / combiners / effects / notes` with 12.

### NPC Specializations

The NPC skill panel showed a flat run of pills - "Alertness +d2" - and nothing else. It never
showed Specializations, although NPCs could already HAVE them (the Skill Picker has managed them
all along) and four actors in the dev world did: Knives on Might, Handguns on Targeting, and so on.
Nor could anything mark a skill as wholly specialized, even though `stat-block-parser.mjs` has
always READ that star out of printed stat blocks.

Both now match the printed form, `Alertness (Perception) +d4*`:

- A skill pill carries its Specializations in parentheses after it, each with its own shift:
  **`Might +d2 (Knives* +d2)`**.
- **The skill name and each Specialization name are separate roll links.** They roll different
  things, at shifts that can differ on an NPC - the character sheet already notes that "NPCs can
  have unspecialized specializations, but PCs are always specialized".
- An asterisk follows the name of anything specialized, skill or Specialization.
- The **Skill Picker** gained a per-skill "Specialized" checkbox, which is what sets the star. It
  is offered on every non-PC sheet, beside the shift select - PCs are excluded for the same reason
  they get no isChosen box.

The Specializations are flattened into an array in `_prepareChosenNpcSkills` rather than walked
as an object in the template: Handlebars treats `{}` as truthy, so an `{{#if}}` on the raw object
drew a bare pair of parentheses for every skill that had none. The array also gives a `.length`
to test and a stable order.

Because the pill is now a `<span>` holding several links rather than being one link itself, the
two rules that were scoped to the anchor - the hover colour and the font-size reset that undoes
`.rollable`'s global 1.25em bump - moved inward to the links.

**The same `../` mistake as the compendium browser facets, caught the same way.** The
Specialization links sat inside a nested `{{#each}}` and referred to `{{../entry.skill}}`; `entry`
is a block parameter already in scope, so `../` walked up to a frame with no `entry` property and
rendered `data-skill=""`. Reading the rendered dataset rather than the visible text is what found
it - the pills looked perfect while every Specialization link was rolling nothing.

### Verified live

On *Cobra Trooper (Out of Uniform)*, which already had two Specializations: the panel reads
`Conditioning 0 | Alertness +d2 | Might +d2 (Knives* +d2) | Streetwise +d2 | Targeting +d2
(Handguns* +d2)`. Clicking **Knives** opens "d2 Might Skill Roll" with the Specialization in its
dataset; clicking **Might** beside it opens the same roll without one. Ticking Specialized on
Alertness in the Skill Picker turns the pill into `Alertness*`, and unticking it restores it.

### Skill Picker columns

Adding a second checkbox to each row broke the alignment: the row was a flex line where the name
label grew to fill whatever the controls left, so nothing sat under anything. And repeating the
word "Specialized" on all twenty-two rows was noise.

Each section now carries one header - **Show | Name | Shift | Specialized** - and the rows are a
four-column grid beneath it. The per-row word is gone; the checkbox keeps an `aria-label` so it is
still named for a screen reader.

The interesting part is the name cell. Show and Name are two columns, but the checkbox and the
text have to stay inside one `<label>` or clicking the name stops toggling the box. So the label
is `display: contents` - it lays out no box of its own, and its two children become grid cells
directly. The text needed wrapping in a `<span>` for that (a bare text node inside
`display: contents` does not reliably become a grid item), and the PC branch emits an empty first
`<span>` so its names land in the same Name column as everyone else.

A skill's Specializations and Essence attribution are `grid-column: 1 / -1`, so they stay full
width rows beneath their skill rather than being dropped into the next free cell - which matters
for Spellcasting and Weird, where both sit inside the row element itself.

PCs get no header, because they have neither column: no Show box (their skills are all shown) and
no Specialized box (their Specializations are specialized by definition).

Verified live on both: the NPC picker shows the header over aligned columns, clicking a skill NAME
still toggles its Show box and saves, and the PC picker renders unchanged with no header.

#### The Any section, and two things the header broke

The Any section is not a table. It puts Spellcasting and Weird **side by side**, each a little
panel with its own Essence-attribution boxes beneath, so one header could never line up with both
columns - and as a child of that two-column grid it simply took a cell of its own and shoved the
skills around it. The header is gone from there; those two rows keep the word "Specialized" beside
their own checkbox instead, since nothing else names it. That label needs two classes to
out-specify the name label's `display: contents`, or it would have been torn in half the same way.

**And `display: contents` was reaching too far.** The rule was `.skill-picker-row label`, but
Spellcasting and Weird carry their attribution boxes INSIDE the row element, and each of those is
a `<label>` wrapping its own text and number input. Every one of them was being pulled apart, so
"Social" wrapped onto one line and its input onto the next. Scoping the rule - and the sibling
`select` / `input[type=number]` rules, which had the same reach - to direct children fixes it.

Checked afterwards that the narrowing cost nothing: Conditioning's input is still 60px, the shift
selects still 90px, and each attribution label still holds its own box.

## One sliced-corner look for every app and dialog

### What the review found

| | |
|---|---|
| App templates using the sliced look | **1 of 24** (story-points) |
| Distinct root containers across those 24 | **22** |
| App templates with `<fieldset>` groups | 3 |
| Inline `DialogV2` call sites | **478**, across 137 files |

The dialogs are the number that decides the approach: they build their content as HTML strings in
helpers, so there is no shared markup to edit. What every window of ours DOES share is its class
list, so the whole job is done in CSS.

### The mechanism

`sliced-panel` is now a mixin in `components/_sliced_border.scss`, so any container can take the
look through a class it already has. `.sliced-border` is that mixin plus its own label and
modifier rules, so the two cannot drift - verified by diffing the compiled CSS, where the only
change was the ORDER of one `position: relative`.

### Window level, and the mistake that took two goes

The first attempt keyed the rule off `.essence20.application`, the second off
`.application.theme-wrapper`. **Both reached core Foundry windows and broke the layout** - the
sidebar and its directories were pushed out of place, and sheets rendered where they couldn't be
seen.

The cause is one line in `essence20.mjs`:

```js
Hooks.on("renderDialogV2", (dialog, html) => {
  html.classList.add("essence20", "theme-wrapper", "window-app");
```

That stamps all three classes onto **every** DialogV2, Foundry's own included - deliberately, so
core dialogs pick up the themed colours. It means none of those three classes means "a window this
system owns", and anything keyed to them reaches core.

What made this worse than a simple slip: the check that should have caught it - "does any core
window carry theme-wrapper?" - was run **in a session with no core dialogs open**, so it returned a
clean answer that was worthless. The lesson is not about CSS; it is that a negative check needs the
case it is meant to exclude to actually be present.

**`e20-window` is an explicit opt-in.** It is added by the twenty-five apps and sheets in their own
`DEFAULT_OPTIONS.classes`, and by the 79 inline dialog call sites that already passed a `classes`
array. A dialog raised by Foundry itself never carries it, whatever the hook adds - verified by
opening one of each and checking: the core dialog keeps its theme classes and gets no sliced frame,
ours gets both.

The 399 inline dialogs that pass no `classes` at all are left alone on purpose: the hook cannot
tell ours from core's, and this class must never reach a core window.

`:not(.sliced-border)` still keeps Story Points as it was - it already puts that class on its own
window root, and applying the treatment twice grew it to 822px tall.

### Panel level

The bordered cards inside the apps - the ones already drawing themselves as a 1px rounded box -
now use the same sliced panel: the Skill Picker's four Essence groups, and the Compendium
Browser's filter and sources groups. Story Points already had it. An audit of the other app
stylesheets found nothing else that qualifies: what looks like a candidate is either a layout
container with no border of its own, a small badge, or a round button.

### Verified live

Sliced frame confirmed on sheet-options, the Skill Picker, the Compendium Browser, an inline
DialogV2, an actor sheet and an item sheet - none of them overflowing their window content. Only
our own windows match the rule; core UI is untouched - the Actors directory has no `e20-window`
and stays `position: static`. One thing that looked like a regression was not: an embedded item sheet renders
200x822, measured identical with the rule disabled.
