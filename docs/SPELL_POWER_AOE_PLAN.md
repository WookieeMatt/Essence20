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
- **Two rules calls**: does entering a lingering area trigger a fresh roll (currently no — the
  effect is simply applied), and does a spell's AoE respect disposition? Weapon AoE catches
  everything in the shape; several spell helpers instead filter to enemies via
  `getNearbyEnemyTokens`.
- ~~`magicBauble` still has a free-text `duration`~~ — **done 2026-09-19.** It now uses
  `durationSchema()` like spell and power, builds the same `durationLabel`, and its sheet uses the
  shared duration fields. The migration guard was widened to cover it, and all 7 compendium
  baubles parsed cleanly (1 day, 2 instant, 2 scenes, 2 rounds) with no fallback to `special`.
- **Explosive Beam has no authored `defenseType`**, so the player still picks the Defense in the
  roll dialog, exactly as before.


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
