# Essence20 Active Effect Wizard — Implementation Plan

Goal: give anyone who **doesn't** know the key vocabulary a guided way to build an effect —
"Skills · Infiltration · Shift · +1" off dropdowns — while anyone who **does** know it keeps
editing effects exactly the way they do today. The wizard is an opt-in tool you launch, not a
replacement for the effect sheet.

> **Target: Foundry VTT v14** (local install `foundryvttV14`, version **14.364.0**, launched by
> `FoundryV14.bat` against the same `./foundrydata` Data path v13 uses — so this is the same
> system checkout, only the core version differs). Every core API fact below was read out of that
> install: `client/applications/api/application.mjs`,
> `client/applications/sheets/active-effect-config.mjs`, `client/documents/active-effect.mjs`,
> `common/documents/active-effect.mjs`, `common/data/active-effect.mjs`.
>
> **v14 reshaped Active Effects** — see §3. Anything written against v13 will be wrong in three
> specific ways, and the wizard has to write the v14 shape. `system.json` now declares
> `compatibility: {minimum: "14", verified: "14"}`, so v13 is no longer a target.

---

## 0. Status

Built on branch `Effect-Wizard` (worktree `worktrees/e20-effect-wizard`, its own Foundry v14
instance on port 30004 via `FoundryV14-effect-wizard.bat`). **All five phases below are done**
and live-verified in v14.

**Change from the plan below, at the user's direction.** The wizard is not reached from a header
control alone. Clicking **Add** on an Effects tab now asks how you want to build the effect -
Guided Wizard or Blank Effect - so both audiences are served by the one button they already use.
A client setting (`effectAddBehavior`: Ask each time / Always open the Wizard / Always create a
blank effect) lets anyone who knows the key vocabulary turn the prompt off for good. The header
control on an existing effect's sheet remains, for adding a change to an effect later. This
settles §11.1 and §11.2; the rest of §11 still stands.

**Phase 4 notes.** The "did you mean" chip attaches to core's own effect sheet through its
render hook and spans the full change row; the suggestion is click-to-apply (the author's
action, never automatic) and survives core's own submit. A second, quieter chip flags a key
that resolves but targets a computed field. Specializations are the one group whose second
target cannot be enumerated - keys are slugs of names that only exist once an actor has them -
so `parseKey` resolves them by pattern (generated from the same key templates the wizard builds
from, so the two cannot drift), the wizard takes the name as free text with the owning actor's
existing Specializations offered as suggestions, and a slug is turned back into words for
display rather than showing "deepSeaBiology" in a sentence. Granting one writes two changes
(`.name` and `.granted`) from a single text box, which is why the catalog grew `buildChanges()`
alongside `buildChange()`.
**Phase 5 notes.** The drift audit (`helpers/effect-catalog-audit.mjs`) checks both directions
against the real actor DataModels: every catalog key resolves to a live schema field, and every
numeric/boolean schema field is either offered, ignored as bookkeeping, or listed as a
deliberate omission. It is developer tooling - `game.essence20.auditEffectCatalog()`, or
`CONFIG.debug.essence20Catalog = true` to run it on load - and takes its schemas as an argument
so it is testable without a client. First real run: **571 keys, 0 missing**, and it found a
genuine gap (vehicle Traits and Energon maximum, now catalog groups) plus 25 uncovered fields
(see §12). `skill-effects.mjs` no longer keeps its own `SKILL_FIELDS` / `ESSENCE_SHIFT_FIELDS`
sets; roll relevance is a `rollScoped` flag on the catalog property, resolved by
`resolveRollScopedChange`, so adding a roll-relevant property is one edit instead of two files.
The Roll Options Dialog now shows what each toggleable effect will do to *this* roll
("Infiltration is shifted up by 2; Infiltration rolls have Edge") rather than its name alone,
listing only the changes that apply to the roll in front of you.
**Validator results.** 21 broken keys found across the packs, **all 21 now fixed**, and the check
is wired into CI (`.github/workflows/github-actions-unit-tests.yml`). The last one needed a schema
change at the user's explicit direction: Burrower targeted `system.movement.underground.base`,
which did not exist, so **Burrow is now a real movement type** - added to `E20.movementTypes`, to
the common and Zord movement schemas, and to `_prepareMovement`'s own type list, with Burrower
repointed at `system.movement.burrow.base`. Unlike climb/swim it has no half-Ground default,
since an actor only has Burrow Movement because something granted it. This is the one place this
branch touches movement math - noted because it overlaps the user's own pending defenses/health/
movement migration.

---
## 1. Why this is worth building

Measured against the current `packs/*/_source/*.json` (the whole compendium corpus):

- **700 change rows** using **166 distinct keys**, but the distribution is extremely top-heavy.
  Five shapes cover most of it: `system.skills.<skill>.shiftUp` (103), `.edge` (64),
  `system.health.bonus` (46), `system.defenses.<defense>.bonus` (122 across the four),
  `system.skills.<skill>.shiftDown` (27). A wizard doesn't have to be exhaustive to cover the
  cases a new author actually hits.
- **Silent typos are a recurring, real bug class.** Each of these is inert — the effect looks
  fine on the sheet and simply never applies:
  - `packs/atsitems/_source/Titan_War_Rig_mvhjFDP17V6Z3Rwn.json` → `systen.skills.might.shiftUp`
  - `packs/gijcrbitems/_source/Presence_EdP0LqcYh2tkMygI.json` → `system.skills.intimidation.essence.social` (should be `essences`)
  - `packs/mlpcrbitems/_source/Fearsome_H3aqGKmP4k53gqnR.json` → same `essence.social` typo
  - plus two rows with an **empty** key (v14 skips those explicitly — `Actor#applyActiveEffects`
    does `if ( (change.key === "") …) continue`)

  On top of the already-fixed `shfitUp` and `infilitration` typos from the 2026-08-28 sweep. A key
  that came out of a dropdown can't be misspelled, and §7's CI check catches the ones already on
  disk.
- The vocabulary is **not discoverable**. Nothing tells an author that `.bonus` is the writable
  defense field while `.total` is computed, that Essence-wide bonuses live under
  `system.essenceShifts.<essence>` rather than on each skill, or that "downshift" is its own
  positive-valued field rather than a negative `shiftUp`.

## 2. Design principles

1. **The existing editor is untouched.** No custom `ActiveEffectConfig` subclass, no
   `registerSheet`, no override of core's change rows. Someone who knows the keys sees exactly
   what they see today. This also means no "should we replace the core sheet?" decision, and no
   risk of the sheet breaking on a core update.
2. **The wizard is a producer of ordinary changes.** It writes plain rows — a key path, a core
   change type, a value. No system-specific change type is invented, so the output is
   indistinguishable from a hand-written effect and any module can read it.
3. **Launch it from where you already are** — a header control on the effect sheet, and a control
   beside the `+` on an item/actor's Effects tab. Never modal, never in the way.
4. **One vocabulary, four consumers.** The same catalog feeds the wizard, the effect-list summary
   lines (§6), the CI validator (§7) and — later — the Roll Options Dialog's source labels, which
   today hand-build their own strings.
5. **Do not touch derived-data prep.** Pure authoring layer; `_prepareHealth` / `_prepareDefenses`
   stay off-limits pending the separate defense/health/movement migration.

## 3. What v14 changed (and what it hands us for free)

Three structural changes, confirmed in the local 14.364.0 source:

**(a) Changes moved into system data.** `ActiveEffectTypeDataModel`
(`common/data/active-effect.mjs`) now defines the `changes` ArrayField, so rows live at
`effect.system.changes`. This system's `RerollEffectData` already does
`...super.defineSchema()`, so it inherits the field correctly and needs no edit.
`BaseActiveEffect.shimData` adds a non-enumerable `changes` getter forwarding to
`system.changes`, so `helpers/skill-effects.mjs`'s `effect.changes ?? []` keeps working —
**deprecated, removed in v16**.

**(b) `mode` (number) became `type` (string).** Core types: `custom`, `multiply`, `add`,
`downgrade`, `upgrade`, `override` (`CONST.ACTIVE_EFFECT_CHANGE_TYPES`, whose values are now
default *priorities*). `CONST.ACTIVE_EFFECT_MODES` is a Proxy that logs a deprecation warning on
access; per-change `change.mode` is shimmed with a getter/setter until v16. The system reads no
`change.mode` anywhere — verified — so nothing breaks.

**(c) Pack data migrates itself.** `BaseActiveEffect.migrateData` moves top-level `changes` →
`system.changes`, maps numeric modes → type strings (unknown numbers → `custom.<n>`), and moves
`duration.startRound/startTurn/startTime/combat` into the new `start` block. **All 700 pack rows
are still v13-shaped on disk** (`"mode": 5`, `"value": "true"`) and load fine under v14 without
re-authoring.

What this plan uses:

- **`getHeaderControlsActiveEffectConfig`** — `Application#_headerControlButtons` dispatches a
  `getHeaderControls{ClassName}` hook up the whole inheritance chain, and each entry may carry its
  own `onClick`. That's a supported way to add "Build a change with the wizard" to the effect
  sheet's header menu **without subclassing or replacing the sheet**.
- **`renderActiveEffectConfig`** — same mechanism for the `render` event, if the wizard button
  reads better inline in the Changes tab than in the header menu (§11.1), and for the optional
  "did you mean…?" chip in §7.
- **`value` is an `AnyField` with JSON serialization** — `_processChangeSubmission` runs
  `JSON.parse` on submit, so the wizard can write a real boolean/number instead of `"true"`.
- **Two application phases**, `initial` and `final` (`change.phase`; `Actor#applyActiveEffects`
  runs once per phase, `final` *after* `prepareDerivedData`). New in v14 and relevant: a
  `final`-phase change can target a computed total an `initial` one would have had clobbered. The
  wizard writes `initial` and doesn't expose phase — see §4's note on computed fields.

## 4. The key catalog — `module/helpers/effect-catalog.mjs`

The wizard's content, and the part that outlives it. A declarative table, **not** a live
DataModel schema walk: it has to run in plain Node for the Jest tests and the CI script
(`scripts/check-pack-content.mjs`'s own doc comment explains why `foundry.data.fields` isn't
available there), and a hand-authored table is where the game-facing labels, the hidden computed
fields and the synthesized properties live. An optional in-client dev check (Phase 5) compares it
against the real schemas to catch drift.

### Entry shape

```js
{
  id: "skill.shift",                 // stable id, used by tests and the wizard's presets
  group: "skills",
  label: "E20.EffectPropShift",      // the *property* label ("Shift")
  targets: () => E20.skills,         // key -> i18n label for the target step
  widget: "signedInt",
  up:   "system.skills.{target}.shiftUp",
  down: "system.skills.{target}.shiftDown",
  type: "add",                       // v14 string change type, not a numeric mode
  summary: "E20.EffectSummarySkillShift", // "{target} is shifted {sign} by {value}"
  keywords: ["upshift", "downshift", "bonus", "die"],  // for the wizard's search step
  appliesTo: ["playerCharacter", "npc", "companion", "megaform", "zord", "vehicle"],
}
```

Target lists come from the existing, already-`preLocalize`d config tables (`E20.skills`,
`E20.essences`, `E20.defenses`, `E20.weaponTypes`, `E20.armorTypes`, `E20.damageTypes`,
`E20.skillShifts`) — so the dropdown reads "Infiltration", not `infiltration`, for free.

### Groups

| Group | Targets | Properties |
|---|---|---|
| Skills | `E20.skills` | Shift (signed), Edge/Snag, Flat modifier, Specialized, Can crit on d2, Set skill die, Also uses Essence |
| All skills of an Essence | Strength / Speed / Smarts / Social / **Any** | Shift (signed), Edge/Snag, Untrained bonus, Morphed shift |
| Essence scores | `E20.essences` | Value, Max |
| Defenses | `E20.defenses` | Bonus, Morphed bonus, Armor, Shield |
| Health | — | Bonus, Max, Origin |
| Movement | Ground / Aerial / Swim / Climb | Bonus, Base, Morphed, Alt-mode |
| Training & Qualification | weapon types, armor types, poisons/toxins | Trained, Qualified |
| Resistance & Immunity | `E20.damageTypes` | Resistant, Immune |
| Powers | Personal / Grid / … | Max, Value |
| Specializations | live list off the parent actor + free text | Shift, Edge/Snag, Specialized, Grant |
| Other | — | Size, Poison training, and the long tail |

Deliberately **not** offered by the wizard (writable in principle, clobbered in practice by
derived-data prep): `system.defenses.*.total|base|string|name|essence`, `system.movement.*.total`,
`system.skills.*.shift` where the actor computes it. Marked `readOnly: true` so §7's validator can
flag an existing effect that targets one. Anyone who genuinely wants one still types it in the
normal editor — that's the point of the split. *(v14 caveat: a `final`-phase change to those would
actually stick. Real new capability, but it overlaps the pending defenses/health migration, so the
wizard stays out of it.)*

### Synthesized properties — the reason a wizard beats a key list

- **Signed Shift.** One "Shift" control with a `+`/`−` sign. `+2` writes `…shiftUp = 2`; `−2`
  writes `…shiftDown = 2`. The schema has two positive fields; the game concept is one signed
  number. This is what turns "give Infiltration more than 1 upshift" into a spinner.
- **Edge / Snag.** One three-state control (Edge · none · Snag) over the `edge` / `snag`
  booleans, `type: "override"`, value `true` (a real boolean now, per §3).
- **"Also uses Social"** for `system.skills.<skill>.essences.<essence>` — phrased as what it means
  (Intimidation may be rolled with Social) rather than a bare boolean path. Exactly the key the
  two `essence.social` typo bugs were reaching for.

### Value widgets

| widget | control | change type written |
|---|---|---|
| `signedInt` | number + sign toggle | `add` |
| `int` | number spinner | `add` |
| `bool` | checkbox | `override` |
| `triState` | Edge / — / Snag | `override` |
| `choice` | `<select>` from a config table (e.g. `E20.skillShifts`) | `override` |

The wizard never asks about type, phase or priority — the catalog's defaults are right for
essentially every row in the packs, and anyone who needs to tune them is already in the normal
editor.

## 5. The wizard — `module/apps/effect-wizard.mjs`

An `ApplicationV2` in the house style (`serializeFormSubmits(HandlebarsApplicationMixin(ApplicationV2))`,
`applyThemeClass(this.element)` in `_onRender`), matching `skill-picker.mjs` and
`defense-modification.mjs`.

**Flow** — one small window, four steps, all reversible:

```
  What should this effect do?   [ 🔍 type what you want…            ]
                                  ↳ "infiltration"  → Skills · Infiltration · Shift
                                                      Skills · Infiltration · Edge or Snag
  ── or browse ──
  [ Skills ▾ ]  [ Infiltration ▾ ]  [ Shift ▾ ]   [ − | 1 | + ]

  ✔  Infiltration is shifted up by 1.

  [ Add another change ]                      [ Cancel ]  [ Add to effect ]
```

- **Search first.** Free-text over catalog labels, target names and `keywords`, so "infiltration",
  "sneak", "upshift" or "toughness" all land somewhere useful. This is the step that answers "I
  don't know what the keys look like" — browsing the three dropdowns is the fallback, not the
  primary path.
- **Live sentence**, from the catalog's `summary` string. The author confirms the rule in English
  before anything is written.
- **Add another change** accumulates rows so a multi-part Perk is one pass.
- **Finish** writes the rows and closes. Two entry points, two behaviours:
  - launched from an **effect sheet** → appends to that effect's changes;
  - launched from an **Effects tab** → the effect does not exist yet. Nothing is written until
    **Add to Effect** is clicked, at which point it is created in one operation with its changes
    already on it; cancelling leaves the sheet exactly as it was rather than stranding an empty
    "New Effect" to notice and delete. It then opens in the normal editor, so the author sees
    the rows the wizard produced. (Earlier builds created the effect up front and the wizard
    filled it in - that left an orphan behind on every cancel.)
- **No sheet subclass.** Launch points are a `getHeaderControlsActiveEffectConfig` hook entry and
  a new `data-action="effectWizard"` control in `templates/{item,actor}/tabs/effects.hbs` beside
  the existing `createEffect` one, handled in `module/helpers/effects.mjs`.

**Writing changes** goes through one small helper pair in `effect-catalog.mjs` —
`readChanges(effect)` / `writeChanges(effect, rows)` — that targets `system.changes` on v14 and
falls back to top-level `changes` on v13 (`game.release.generation`). That keeps the wizard
working on both generations and gives the rest of the system one place to migrate when v16 drops
the shim.

## 6. Reading effects at a glance

`prepareActiveEffectCategories` (`module/helpers/effects.mjs`) gains a `summaries` array per
effect — the same catalog sentences, joined. `templates/item/tabs/effects.hbs` and
`templates/actor/tabs/effects.hbs` render them as a muted line under the effect name, so a Perk's
Effects tab reads "Infiltration is shifted up by 1" instead of showing only an icon and a name.
Small change, outsized payoff when reviewing a compendium item — and it's the other half of the
"I don't know what the keys look like" problem, since it makes existing effects legible without
opening them.

Same commit moves the system's own reads onto `readChanges()` (`helpers/skill-effects.mjs`,
`helpers/effects.mjs`) — v14 shims `effect.changes`, v16 removes it.

## 7. Validation

**In CI**: `scripts/check-effect-keys.mjs`, following the existing `check-pack-content.mjs` /
`check-pack-cross-references.mjs` pattern (plain Node, reads `packs/*/_source/*.json`, exit 1 on
failure), added as a step in `.github/workflows/github-actions-unit-tests.yml`. It must accept
**both shapes** — v13-era `changes[]` with numeric `mode` (what's on disk today) and v14
`system.changes[]` with string `type` — since core migrates at load and the packs aren't being
rewritten. Reports: unknown keys, empty keys, `readOnly` (computed-field) targets, values that
can't parse for their type. Against today's packs it flags exactly the five rows in §1.

**In the sheet (optional, Phase 4)**: a `renderActiveEffectConfig` hook that appends a warning
chip to any row whose key the catalog can't resolve, with a Levenshtein "did you mean…?"
(`systen.` → `system.`, `infilitration` → `infiltration`, `essence.social` → `essences.social`).
Read-only decoration — it never rewrites the author's key, and it leaves the row editable exactly
as core rendered it.

## 8. Files

New:

- `module/helpers/effect-catalog.mjs` — catalog + `parseKey()` / `buildKey()` / `summarize()` /
  `suggestKey()` / `readChanges()` / `writeChanges()`.
- `module/helpers/effect-catalog.test.js` — Jest.
- `module/apps/effect-wizard.mjs` — the wizard.
- `templates/app/effect-wizard.hbs`.
- `sass/views/_effect-wizard.scss` (registered in the neighbouring `_index.scss`).
- `scripts/check-effect-keys.mjs`.
- `docs/ACTIVE_EFFECTS_UI_PLAN.md` (this file).

Modified:

- `module/essence20.mjs` — the `getHeaderControlsActiveEffectConfig` hook.
- `module/helpers/effects.mjs` — wizard launch handler, summaries, `readChanges()`.
- `module/helpers/skill-effects.mjs` — `readChanges()` instead of the shimmed `effect.changes`.
- `templates/item/tabs/effects.hbs`, `templates/actor/tabs/effects.hbs` — wizard control + summary line.
- `lang/en.json` — `E20.EffectGroup*`, `E20.EffectProp*`, `E20.EffectSummary*`, `E20.EffectWizard*`.
- `.github/workflows/github-actions-unit-tests.yml` — the new check step.
- The three pack `_source` files in §1.

Not modified, deliberately: `ActiveEffectConfig` and everything it renders.

## 9. Testing, build, and house rules

- **Run it on v14.** `FoundryV14.bat` (port 30000, `--dataPath=./foundrydata`); log in as the
  "Claude" user (no password), not Gamemaster. v13 and v14 share that Data path, so only one can
  run at a time — check the port before launching.
- **Jest.** `effect-catalog.mjs` lands under `module/helpers/**`, inside `jest.config.js`'s
  `collectCoverageFrom` globs — a new uncovered file there drags the global floor down, so its
  tests ship in the same commit. Cover: `parseKey` round-trips every distinct key currently in the
  packs; signed-shift mapping both directions; unknown key → `null`, not a throw; `suggestKey` on
  the four known real typos; `summarize` output; `readChanges`/`writeChanges` against both the
  v13 and v14 row shapes. On Windows run `node --experimental-vm-modules ./node_modules/.bin/jest`
  directly.
- **SCSS** compiles with the standalone `sass` binary (`npm run sass`); `npm install` is broken in
  this checkout, but `npm run <script>` works.
- Changes are left staged for the user — no `git commit` / `git push` from here — and nothing
  targets `Beta-v6.0`.

## 10. Phasing

| Phase | Content | Ships on its own? |
|---|---|---|
| **1** | Catalog + Jest tests + `check-effect-keys.mjs` + CI step + fix the five bad rows | Yes — pure win, no UI at all |
| **2** | The wizard + both launch points + SCSS + i18n | Yes — the headline feature |
| **3** | Summary lines on the Effects tabs + move system reads onto `readChanges()` | Yes |
| **4** | "Did you mean…?" chip in the core sheet; Specializations group (live target list off the parent actor) | Yes |
| **5** | *Optional.* Dev-mode schema-drift check (walk `CONFIG.Actor.dataModels` at `init`; warn on catalog entries with no matching field, and on numeric fields the catalog never offers); retire `skill-effects.mjs`'s hand-maintained `SKILL_FIELDS` / `ESSENCE_SHIFT_FIELDS` sets and the Roll Options Dialog's hand-built source labels in favour of the catalog | Yes |

Phase 1 is worth doing whether or not the wizard gets built — it finds live bugs today.

## 11. Decisions needed

1. **Where does the wizard button live on the effect sheet?** The header control menu (zero markup,
   pure hook) or injected into the Changes tab next to core's `+` (more discoverable, but it means
   poking at core's DOM in a `renderActiveEffectConfig` hook). Recommend the header control for
   Phase 2 and revisit if nobody finds it.
2. **Does finishing the wizard open the new effect in the normal editor?** Recommended yes — it
   turns the wizard into a teaching tool rather than a black box. Costs one extra window.
3. ~~**v13 support.**~~ **Settled: `system.json` now declares `compatibility: {minimum: "14",
   verified: "14"}`.** The Spark of the Ancients conversion (§13) forced the issue — a final-phase
   effect cannot be expressed in the v13 change shape at all. `changesPath()` is unconditional as
   a result; `readChanges()` still accepts both shapes, but only because the packs are v13-shaped
   JSON on disk and the CI validator reads them with no Foundry to migrate them.
4. **Normalize the packs to v14 shape?** Still open, and now purely a question of churn rather
   than compatibility: nearly all rows are `{mode: 5, value: "true"}` on disk and migrate at load,
   and a rewrite to `{type: "override", value: true}` is a huge mechanical diff across every pack.
   Recommend **no**, with one standing exception — an effect whose behaviour depends on its
   `phase` has to be authored in v14 shape, because the migration leaves `phase` at its default
   (see §13). One row is already in that position.
5. **NPC/machine gaps.** `CompanionActorData` and machine actors use the flat `{value}` defense
   shape, so a `system.defenses.toughness.bonus` effect silently no-ops on them. The wizard can
   *say so* inline ("no effect on NPC-type actors") without touching the schema — the real fix is
   the pending defense/health/movement migration. Confirm that's the right scope.
6. **Specializations** (`system.skills.<skill>.specializations.<slug>.*`) have dynamic keys, so the
   target step can only list what exists on the parent actor plus free text. Fine for Phase 4 — or
   drop the group if the specialization redesign is still in flux.
7. **Phase 1 commit shape.** Should the three typo fixes be their own commit, separate from the
   tooling? Only `_source` JSON changes; the compiled `.ldb` files can't be committed.

## 12. What the catalog audit surfaced

From the first full run against the real schemas. None of these are bugs; they are fields an
Active Effect *could* target that the catalog does not offer, for a human to rule on.

- **Built as a result:** `system.traits.*` (vehicle Traits) - an enumerable boolean per
  `E20.vehicleTraits`, now the "Vehicle Traits" group.
- **Also built:** `system.energon.normal.max`, now the "Energon" group - the direct parallel of
  the Powers maximum the catalog already offered. **It is the catalog's only `final`-phase
  property, and it has to be:** `_prepareEnergon()` assigns that field outright (`=`, from the
  actor's lowest Essence) during `prepareDerivedData`, so an ordinary initial-phase change is
  computed and then overwritten. Core v14 runs `applyActiveEffects("final")` after
  `prepareDerivedData` (`client/documents/actor.mjs#prepareData`), so a final-phase add lands on
  top. Measured on a transforming actor: baseline max 3, **final phase 5, initial phase 3**.
  Only `energon.normal` has a maximum at all; the other four pools are value-only.
  **Spark of the Ancients (p.41) has since been converted**: its +2 is now a final-phase Active
  Effect on the compendium Perk itself, and the hardcoded branch is gone from `_prepareEnergon`.
  Measured against the behaviour the deleted unit tests asserted: Battery only 5, Spark only 4
  (lowest Essence 2, +2), Spark + Battery 7 (highest Essence 5, +2) - identical. Two caveats in
  §13.
- **Worth considering:** `system.stun.max`, `system.initiative.modifier`, and the Hardpoints
  fields (`externalHardpoints`, `internalHarpoints`, `firepoints.value`). Note that anything
  recomputed in `prepareDerivedData` needs `phase: "final"` the way Energon does, or it will
  silently do nothing.
- **Probably not:** state flags that something else owns - `isDefeated`, `crashed`,
  `isCombiner`, `isNPC`, `isContact`, `hasEnhancedAttack`, `combinedHealth*`,
  `energonSpentToMerge`, `canSetToughnessBonus`, `allegiancePoints`, `threatLevel`,
  `biography.age`.
- **Unrelated find:** the schema spells one field `internalHarpoints` (missing the "d").
  Renaming it is a migration, so it is flagged rather than touched.

Anything ruled out should go in the audit's own `DELIBERATE_OMISSIONS` map with its reason, so
the next run stays this short.

## 13. Spark of the Ancients: code to effect

The first Perk moved off hardcoded derived data and onto its own Active Effect
(`packs/eocitems/_source/Spark_Of_the_Ancients_*.json`). Worth reading before converting a
second one.

- **The effect is stored in v14 shape** (`system.changes`, string `type`, explicit `phase`),
  unlike every other effect in the packs, which is still v13-shaped and relies on core's
  `migrateData`. That migration maps a numeric mode to a type but leaves `phase` at its
  `initial` default - and an initial-phase change to `energon.normal.max` is overwritten by
  `_prepareEnergon` before anything reads it. So the v13 shape cannot express this effect.
  This made the Perk v14-only, which is exactly what forced the compatibility decision:
  `system.json` now declares `minimum: "14"`, so it is the baseline rather than a caveat.
- **One real behaviour change, in an edge case.** The old `+= 2` sat *inside* `_prepareEnergon`,
  after its `canTransform || Organic Energon` early return, so an actor with the Perk and
  neither of those got no pool at all (0). The effect is not gated that way: the same actor now
  ends up with a 2-point pool. Measured: 0 before, 2 after. Arguably closer to RAW ("your
  maximum Energon Pool is increased by 2", with no stated prerequisite), but it is a change, and
  a pure Active Effect cannot reproduce the old gating - if the old behaviour is wanted, the
  Perk has to stay code.
- Embedded effects in these packs carry their own 16-character `_id` **and** a LevelDB `_key` of
  the form `!items.effects!<itemId>.<effectId>`; `gulp compile` fails with "Key cannot be null
  or undefined" without the latter.

## 14. Fields derived data throws away

Prompted by the right question: *should `max` ever be offered, when it is a generated value?*
Answer, per field, measured rather than reasoned — a field that derived data **assigns**
(`system.x = ...`) discards any initial-phase change, so the effect reads correctly on the sheet
and does nothing. Exactly the silent failure a misspelled key produces.

`game.essence20.probeClobberedKeys()` (`helpers/effect-catalog-audit.mjs`) applies every numeric
key the catalog offers to a throwaway actor, in both phases, and reports what does not stick. No
static check can see this — it is runtime behaviour, not schema. It is manual tooling because it
creates and deletes an Actor.

First run found **five** clobbered keys, of which **two were live bugs in what the wizard
offered**:

| Key | Was | Now | Why |
|---|---|---|---|
| `health.max` | offered | **readOnly** | `_prepareHealth` computes it from Origin + Conditioning + Role Points + `health.bonus`. `bonus` is the supported input, and all 46 Health rows in the packs already use it. A final-phase add does **not** work here either — measured — so readOnly is the only honest answer. |
| `powers.sorcerous.max` | offered | **final phase** | `_prepareSorcerousPower` assigns it from level, with no bonus field to feed. A final-phase add lands on top. |
| `energon.normal.max` | final phase | unchanged | Same shape; already handled (§12). |
| `defenses.*.total` | readOnly | unchanged | Correct already. |
| `movement.*.total` | readOnly | unchanged | Correct already. `.bonus`/`.base` are the inputs. |

**The Powers group had to split.** `powers.{target}.max` was one property spanning two targets
whose prep methods differ — `_preparePersonalPowerSupply` **adds** to personal.max (an
initial-phase change survives), `_prepareSorcerousPower` **assigns** sorcerous.max (it does not).
A per-property `phase` cannot express "final for one target, initial for the other", so they are
now two properties: Maximum Personal Power (initial) and Maximum Sorcerous Power (final).

**Rule for anything added to the catalog later:** if derived data assigns the field, either point
authors at the input field that feeds it (`readOnly`), or give the property `phase: "final"`.
Run the probe to find out which — do not guess from reading the code, since `_prepareHealth`
looked final-phase-fixable and is not.
