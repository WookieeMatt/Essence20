# Essence20 QA Suite Plan

Scope: `module/` game logic, `packs/` compendium content, `templates/`+`sheets/` UI, and the
`system.json`/build pipeline, targeting Foundry VTT v13. Repo already has Jest configured with
two suites (`module/dice.test.js`, `module/chat.test.js`) and an ESLint config, but coverage stops
there — data models, documents, sheet-handlers, and all UI are currently untested. This plan fills
those gaps in layers, cheapest/fastest first.

## 1. Static analysis (foundation, low effort)

- **Lint gate**: `npm run lint` already exists but isn't enforced in CI (the workflow only runs
  `npm test`). Add a lint step to `.github/workflows/github-actions-unit-tests.yml` so bad
  formatting/undefined-var regressions fail PRs, not just local runs.
- **JSON validation**: every file under `packs/*/​_source/*.json` and `lang/*.json` should be
  checked for well-formed JSON and required fields (`type`, `name`, `_id`, `system` shape) as part
  of CI — a hand-edited compendium item is a common source of silent breakage. A small Node script
  using the existing data model classes (`module/data/item/*.mjs`) to `.validate()` each source
  file would catch schema drift automatically whenever a data model changes.

## 2. Unit tests (Jest) — the bulk of the regression net

Keep using the existing pattern in `dice.test.js`/`chat.test.js` (manual mocks for `game`, `ui`,
`ChatMessage`, `foundry.utils`, etc., no real Foundry client needed). Priority order:

1. **`module/documents/actor.mjs`** (443 lines) and **`module/documents/item.mjs`** (365 lines) —
   these hold derived-data computation, roll preparation, and item-usage logic used by every
   sheet. Currently zero coverage; highest regression risk when actor/item data models change.
2. **`module/data/actor/*.mjs`** and **`module/data/item/*.mjs`** — `prepareDerivedData()` /
   `migrateData()` for each of the 6 actor types and ~20 item types. Test each type's schema
   defaults and any derived-field math (e.g. essence shifts, health, armor totals).
3. **`module/helpers/*.mjs`** — pure-ish helpers (`utils.mjs`, `traits.mjs`, `effects.mjs`,
   `actor.mjs`) are the easiest wins: mostly pure functions, high reuse across sheets.
4. **`module/sheet-handlers/*.mjs`** — 12 handler files driving drag/drop, attachments,
   perks/powers/roles, transformer & vehicle logic. These aren't DOM-dependent at the core (they
   operate on actor/item data), so their business logic can be unit-tested by mocking the
   sheet/actor objects, same as `dice.test.js` already mocks `mockActor`.
5. **`module/documents/combat.mjs`, `combatant.mjs`** — initiative/turn-order logic.

Target: every `.mjs` under `module/` (excluding `sheets/*.mjs` and `apps/*.mjs`, which are UI
shells better covered by integration tests below) has a matching `*.test.js`. Add a coverage
threshold in `jest.config.js` (e.g. `coverageThreshold` at 60-70% to start) so the bar doesn't slip
back down once set.

## 3. In-client smoke test (`macros/smoke-test.js`)

Foundry's [Quench](https://github.com/Ethaks/FVTT-Quench) module is the standard way systems test
against a *real* running Foundry client + database — the right tool for anything Jest's mocked
environment can't reach (real `Actor.create`/`Item.create`, real ApplicationV2 rendering, real
chat messages). It was the original plan for this layer, but as of this writing Quench's last
release (v0.10.0, April 2025) requires Foundry v13+ and hasn't shipped a Foundry v14-verified
release since v14 shipped (April 2026) - installing it against this system's v14 target means
forcing a year-stale, unverified module, which isn't worth the risk it just doesn't load.

Until Quench (or a successor) is verified for the Foundry version this system targets,
[`macros/smoke-test.js`](../macros/smoke-test.js) covers the highest-value slice of what Quench
would have: it creates one Actor of every actor type and one Item of every item type through the
real `Actor.create`/`Item.create` pipeline, opens each one's real sheet, and watches for thrown
errors or anything logged via `console.error`/`ui.notifications.error` during render - exactly
the class of bug the ApplicationV2 sheet migration is prone to introducing. Every document it
creates is cleaned up afterward. It does not attempt end-to-end roll flows or drag-and-drop item
transfers between actors/items - those still need the manual checklist below (or, if Quench
catches up to v14 later, are good candidates to move into a real Quench suite instead of staying
manual forever).

Run it as a GM in a scratch world (see `macros/smoke-test.js`'s header comment for exact steps);
it can't run headlessly in GitHub Actions, so treat it as a **pre-release manual/CI-optional
gate**, not part of every PR.

**Layout regressions** are a separate category neither Jest nor `smoke-test.js` can catch -
Jest never renders real CSS, and `smoke-test.js` only checks "did it render without throwing,"
not "does it look right." Several sheet bugs have shipped that rendered cleanly but visually
broke (a header field wrapping to its own row, a sidebar row squeezed unreadably small by an
unrelated rule leaking in from elsewhere).
[`macros/layout-regression-test.js`](../macros/layout-regression-test.js) encodes those specific
bugs as repeatable `getBoundingClientRect()`/computed-style assertions, run the same way as
`smoke-test.js` (GM, scratch world, Script Macro or console).

## 4. Regression checklist (manual, pre-release)

`macros/smoke-test.js` catches "does the sheet render at all," but not "does the Role/Focus/
Alteration/Transform/Morph/Vehicle-crew business logic still behave correctly." Maintain a manual
checklist run before each release tag, covering the actor-type × action matrix:

| Actor type | Create | Open sheet | Edit derived stat | Add/remove item | Roll (skill/attack) | Drag item from compendium |
|---|---|---|---|---|---|---|
| Player Character | | | | | | |
| NPC | | | | | | |
| Companion | | | | | | |
| Vehicle | | | | | | |
| Zord | | | | | | |
| Megaform | | | | | | |

Plus item-family spot checks (weapon, armor, power, spell, alteration, role, focus, perk) since
each has its own sheet partial and derived math. Store this as a literal checklist (e.g.
`docs/RELEASE_CHECKLIST.md`) that gets checked off per release — turns "did we break the vehicle
sheet again" into a five-minute pass instead of tribal knowledge.

## 5. Compendium/content regression

- **Pack compile round-trip**: `npm run build:db` (gulp compile) converts `_source/*.json` into
  the LevelDB packs Foundry actually loads. Add a CI check that runs the compile and fails on
  error — this catches malformed source JSON before it reaches a release.
- **Pack content structure**: [`scripts/check-pack-content.mjs`](../scripts/check-pack-content.mjs),
  wired into CI. Checks every `_source/*.json` file (5,180 of them) is well-formed JSON with the
  required top-level fields, that its `type` is one of this system's actually-registered
  Actor/Item types, and that `_key` is internally consistent with `_id` - catches hand-edit
  mistakes (a renamed type, a corrupted id) before they reach a release. This is a *structural*
  check, not full DataModel schema validation against each type's real field definitions in
  `module/data/item/*.mjs` - that would need a working `foundry.data.fields` implementation
  (SchemaField/StringField/etc. with real `clean()`/`validate()`), which neither
  `@foundryvtt/foundryvtt-cli` (only exposes `compilePack`/`extractPack`) nor a plain Node script
  can provide without hand-rolling a large chunk of Foundry's own DataModel system - not
  attempted here as too large an undertaking for the value versus this lighter check.
- **Cross-reference check**: script to confirm every `system.grantedItems`/UUID reference embedded
  in pack items (e.g. a Role granting a Perk) still resolves to an existing item — these silently
  rot when items get renamed or IDs regenerated. (Not yet done.)

## 6. Build/packaging verification

- `npm run build` and `npm run sass` should both be run in CI, so a broken build isn't discovered
  only when someone tries to load the system in Foundry. (Note: `npm run build` used to also shell
  out to a nonexistent `scripts/esbuild.mjs` - that was dead/broken since a 2022 refactor and has
  been removed; this system ships raw `.mjs` ES modules per `system.json`'s `esmodules` list, with
  no bundling step, so `build` is just `sass` now.)
- Verify `system.json` manifest fields (`esmodules`, `styles`, `languages`, `packs` list) stay in
  sync with what's actually on disk —
  [`scripts/check-manifest-sync.mjs`](../scripts/check-manifest-sync.mjs), wired into CI. It
  already caught a real gap: `gi_joe_crb_threats` (`packs/gijcrbactors`) and `tf_crb_threats`
  (`packs/tfcrbactors`) are both listed in `system.json` but have no committed `_source/*.json`
  content at all - needs either real content authored or the manifest entries removed.

## 7. CI pipeline (`github-actions-unit-tests.yml`)

Current steps: `npm ci` → `npm run lint` → `npm test -- --coverage` → `npm run build` →
`npm run build:db` → manifest sync check. This turns what used to be "did the existing 2 test
files pass" into an actual regression net: lint, full unit suite with a coverage floor, build
integrity, content integrity, and manifest sync, all on every push/PR. Not yet added: a pack
schema-validation script (§1/§5) checking `_source/*.json` against the real data models.

## Status / suggested phasing

1. ✅ **Done**: lint + build + pack-compile wired into CI (§1, §6, §7).
2. ✅ **Done**: unit tests for `documents/actor.mjs` and `documents/item.mjs` (§2.1).
3. ✅ **Done**: unit tests for data models and helpers (§2.2-2.3); coverage threshold added
   (scoped to `documents/`, `helpers/`, `data/`, `sheet-handlers/`, `dice.mjs`, `chat.mjs` - see
   `jest.config.js` for why it's a low floor rather than a high bar).
4. ✅ **Started**: sheet-handler unit tests (§2.4) for the pure/synchronous exports
   (`roleValueChange`, `createEntry`, `verifyDropSelection`, `_powerCountUpdate`,
   `_flipDriverAndPassenger`, `prepareSystemActors`, `setPerkAdvancesName`). The remaining
   ~50 exports in that directory are `async` orchestration wrapping `actor.update()`/dialogs/
   compendium lookups - keep unit-testing opportunistically as those files get touched, but treat
   heavy multi-side-effect flows (`onRoleDrop`, `onFocusDrop`, etc.) as smoke-test/checklist
   territory instead of forcing them into Jest.
5. ✅ **Done**: manual regression checklist (`docs/RELEASE_CHECKLIST.md`) and the
   `macros/smoke-test.js` in-client smoke test (§3, in place of Quench - see §3 for why).
6. ✅ **Done**: `system.json` manifest-sync check (§6), wired into CI - see §6 for the real content
   gap it already found and still needs addressing.
7. ✅ **Done**: layout/CSS regression coverage (§3) - `macros/layout-regression-test.js`, plus
   unit tests filling the gap that opened up between this QA branch and the game-logic work that
   landed on it in parallel (`listener-misc-handler.test.js` for Rest/Recharge,
   `helpers/enrichers.test.js`, `helpers/combat.test.js`).
8. ✅ **Done**: pack content structure check (§1/§5) - `scripts/check-pack-content.mjs`, wired
   into CI, validated clean against all 5,180 current source files. Full DataModel schema
   validation (checking each item's `system` block against its real field definitions, not just
   structural shape) remains out of reach without a working `foundry.data.fields`
   implementation - see §5 for why that's not attempted here.
9. **Not yet done**: cross-reference check for `grantedItems`/UUID references (§5), revisiting
   Quench if/when it (or a successor) is verified for this system's target Foundry version, and
   authoring real content (or removing the manifest entries) for the two empty packs §6's check
   flagged.
