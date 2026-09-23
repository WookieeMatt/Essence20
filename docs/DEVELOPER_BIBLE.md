# The Essence20 Developer's Bible

Everything a new developer needs to become productive on this system, in the order you need it.

If you read one section before touching code, make it
[§10 Conventions](#10-conventions-how-this-codebase-is-written). It is what makes this codebase
coherent, and it is not what most Foundry systems do.

| | |
| --- | --- |
| [1. What this is](#1-what-this-is) | The system, its scale, what it targets |
| [2. Day one](#2-day-one) | Clone, build, run, test |
| [3. The mental model](#3-the-mental-model) | The Foundry concepts you cannot avoid |
| [4. Architecture](#4-architecture) | The layers, and which one your change belongs in |
| [5. The six common changes](#5-the-six-common-changes) | Worked routes |
| [6. The roll pipeline](#6-the-roll-pipeline) | `dice.mjs`, and how to add to it |
| [7. Active Effects](#7-active-effects) | The catalog, the wizard, the silent-failure trap |
| [8. Compendium content](#8-compendium-content) | JSON source, packing, the copyright rule |
| [9. Automating an ability](#9-automating-an-ability) | The one-file-per-Perk pattern |
| [10. Conventions](#10-conventions-how-this-codebase-is-written) | **Read this one** |
| [11. Traps](#11-traps) | Bugs this codebase has actually shipped |
| [12. Shipping](#12-shipping) | Tests, CI, PRs, releases |

---

## 1. What this is

A Foundry Virtual Tabletop system for Renegade Game Studios' **Essence20 Roleplaying System** —
one engine running five game lines: Power Rangers, G.I. Joe, Transformers, My Little Pony and
Welcome to Night Vale.

It is a fan project. Essence20 is the property of Hasbro and Renegade Game Studios.

### Scale

Know this before you go looking for "the small file that does X":

| | |
| --- | --- |
| JavaScript in `module/` | ~76,000 lines |
| Test files | ~299 |
| `module/dice.mjs` | ~13,800 lines — the roll pipeline, one class |
| `module/documents/actor.mjs` | ~2,150 lines — derived data |
| Compendium packs | 32 |
| Actor types | 7 · Item types 25 |

Most of that volume is **game-rule automation**: several hundred files in `module/helpers/`, one
per automated Perk, Power or Role feature. That is deliberate — see §9.

### What it targets

Foundry **v14**. Check `compatibility` in `system.json` for the branch you are on; the release
line and the v6 line differ. Do not assume v13 APIs exist — v14 reshaped Active Effects,
deprecated `MeasuredTemplate` in favour of Regions, and changed sheet applications.

### User-facing documentation

The [wiki](https://github.com/WookieeMatt/Essence20/wiki) documents the system for players and
GMs. When you change behaviour, its *Contributing → Keeping this wiki honest* table says which
page you just invalidated.

---

## 2. Day one

### Get it running

Clone **into your Foundry data directory** so Foundry loads your working copy:

```
<FoundryData>/Data/systems/essence20
```

```bash
git clone https://github.com/WookieeMatt/Essence20.git essence20
cd essence20
npm install
npm run build          # compiles sass/ -> css/essence20.css
```

Then launch Foundry and create a world using the Essence20 system.

### The commands you will actually use

| Command | |
| --- | --- |
| `npm run build` | SCSS to `css/essence20.css` |
| `npm run build:watch` | the same, watching |
| `npm run lint` / `npm run lint-fix` | ESLint over `module/` |
| `npm test` | the Jest suite |
| `npm run build:db` | `packs/*/_source/*.json` to LevelDB packs |
| `npm run build:json` | LevelDB packs back to JSON source |

**`css/essence20.css` is a build artifact.** Edit `sass/`, never the CSS. If your styles do not
appear, you did not run the build.

**Foundry must be closed** for `build:db` / `build:json` — the LevelDB files are locked while a
world is open.

### The edit loop

1. Edit `module/`, `templates/`, or `sass/`.
2. `npm run build` if you touched SCSS.
3. Reload Foundry (F5).
4. `npm run lint && npm test` before pushing.

Changes to `system.json`, `template.json` or `lang/en.json` need a **full Foundry restart**, not
just a reload.

### If `npm test` will not run

On some Windows setups the Foundry-bundled npm is broken. The repo carries wrappers that run Jest
through a self-contained portable Node in `.dev-node/`:

```bash
./scripts/test.sh          # bash
```

```powershell
.\scripts\test.ps1         # PowerShell
```

Both accept Jest arguments. One-time `.dev-node/` setup is documented in `scripts/test.ps1`'s
header comment. Failing that, call Jest directly:

```bash
node --experimental-vm-modules ./node_modules/jest/bin/jest.js
```

### Debugging

- F12 for the console; the system logs its own errors there.
- `game.essence20` holds the document classes plus two developer tools:
  - `auditEffectCatalog()` — cross-checks the Active Effect catalog against the actor DataModels,
    in both directions.
  - `probeClobberedKeys()` — applies each numeric effect key to a throwaway actor to find fields
    that derived data silently overwrites. **Creates and deletes an Actor — use a scratch world.**
- `macros/smoke-test.js` opens every sheet type and reports errors.
- `macros/layout-regression-test.js` checks sheet layouts.

---

## 3. The mental model

Five Foundry concepts carry almost all the weight here. If these are unfamiliar, read this section
twice; §4 onward assumes them.

### Documents

Actors, Items, ActiveEffects, Combats, Scenes — persistent, synchronised to every client by the
server. This system subclasses several; see `module/documents/`.

Embedded documents matter a lot here: an Actor owns Items, and an Item owns ActiveEffects.
Dropping a Perk onto a character creates a **copy** of that compendium Item on the Actor, its
effects included. The copy remembers where it came from, which is how §9's lookups work.

### DataModels and `template.json`

Foundry v11+ defines document schemas as **DataModel** classes. This system has them in
`module/data/`, one per actor and item type, with shared pieces in `module/data/actor/templates/`
(`common`, `creature`, `character`, `machine`, `zord-base`) and small field builders in
`module/data/generic-makers.mjs` (`makeBool`, `makeInt`, `makeStrWithChoices`, ...).

`template.json` **also still exists** and still lists the types. Both are live. When you add a
type you touch both — see §5.

### Derived data

The single most important lifecycle in the system. Whenever a document changes, Foundry runs:

```
prepareData()
  |- prepareBaseData()      raw values, before anything else
  |- (Active Effects apply here)
  \- prepareDerivedData()   everything computed
```

`module/documents/actor.mjs` implements a long `prepareDerivedData()` that dispatches to
`_prepareActions`, `_prepareDefenses`, `_prepareMovement`, `_prepareEnergon`,
`_preparePersonalPowerSupply`, `_prepareMegaformData` and many more.

**Internalise this consequence:** anything computed in `prepareDerivedData()` is rebuilt from
scratch on every update. Writing to such a field — from an Active Effect, or from code — is
pointless; it is overwritten on the next prepare. Target the `bonus` **input** instead of the
computed total. `probeClobberedKeys()` exists to find exactly this mistake.

### ApplicationV2 sheets

Sheets are `ApplicationV2` + `HandlebarsApplicationMixin`. The shape you will meet everywhere:

- `static DEFAULT_OPTIONS` — including an `actions` map wiring `data-action="foo"` in a template
  to a static handler on the class.
- `static PARTS` — the template fragments making up the sheet.
- `static TABS` — the tab strip.
- `_prepareContext()` / `_preparePartContext()` — build the render context.
- `_onRender()` — attach anything the `actions` map cannot express (drag/drop, context menus,
  inline edit listeners).

`module/sheets/base-actor-sheet.mjs` holds the shared behaviour; each actor type subclasses it.

### Hooks

Foundry's event bus. **Every hook in this system is registered in `module/essence20.mjs`** — all
24 of them, including `init`, `ready`, `createActor`, `deleteActor`, `combatStart`,
`combatTurnChange`, `renderChatMessageHTML`, `renderActorDirectory` and `hotbarDrop`.

That single wiring point is deliberate. If you want to know what this system does in response to
a Foundry event, there is exactly one file to read.

---

## 4. Architecture

```
module/
  essence20.mjs      entry point: registers everything, owns every hook
  settings.js        every world/client setting, and the settings-page grouping
  dice.mjs           the roll pipeline                                    (section 6)
  chat.mjs           chat cards and the buttons on them
  migration.mjs      world data migrations

  documents/         Foundry document subclasses: derived data, update side effects
  data/              DataModel schemas (actor/, item/, shared schema pieces)
  sheets/            one class per actor type, plus base-actor-sheet and item-sheet
  sheet-handlers/    drag-drop and multi-step orchestration
  apps/              ApplicationV2 windows: pickers, browsers, wizards, importers
  helpers/           infrastructure, plus one file per automated ability  (section 9)
  canvas/            token ruler
  tours/             guided tour registration

templates/           Handlebars
sass/                styles (source)        css/   styles (build artifact - never edit)
lang/en.json         every user-visible string
packs/               compendium content                                   (section 8)
scripts/             content and manifest checkers
docs/                design plans, and this bible
```

### Which layer does my change belong in?

| If you are changing... | Go to |
| --- | --- |
| A computed stat (defence, movement, health, action budget) | `documents/actor.mjs`, the matching `_prepare*` |
| A field's shape or default | `data/actor/*` or `data/item/*`, plus `template.json` |
| What a sheet displays | `templates/`, and the sheet's `_prepareContext` |
| What a button does | the sheet's `actions` map, then a handler |
| What happens when you drop an item on a sheet | `sheet-handlers/` |
| A roll's modifiers or outcome | `dice.mjs` (section 6) |
| A chat card | `chat.mjs` |
| One Perk's behaviour | its own file in `helpers/` (section 9) |
| A constant, enum or list | `helpers/config.mjs` (`CONFIG.E20`) |
| A user-visible string | `lang/en.json` — **never hardcode English** |

### The two kinds of file in `helpers/`

The folder looks chaotic at several hundred files. It is two things:

1. **Infrastructure** — `config.mjs` (every enum in the system), `effect-catalog.mjs`,
   `action-economy.mjs`, `scene-clock.mjs`, `story-points.mjs`, `party.mjs`, `reroll.mjs`,
   `aoe-targeting.mjs`, `enrichers.mjs`, `perks.mjs`, `utils.mjs`, `templates.mjs`.
2. **One file per automated ability**, named after it, each with a `.test.js` beside it.

If you are looking for infrastructure it is in that first list. Everything else is a game rule.

### Where the layers meet

A single user action usually crosses several layers. Clicking a weapon's roll button:

```
template (data-action="roll")
  -> sheet actions map -> base-actor-sheet #onRoll
    -> dice.mjs rollSkill()
      -> _getAutomaticCombatModifiers()   reads Perks, effects, conditions, targets
      -> RollOptionsDialog                player confirms/adjusts
      -> _rollSkillHelper()               builds the formula, evaluates, resolves targets
        -> chat.mjs                       renders the card and its buttons
```

Keep that path in mind when deciding where a change goes. A modifier belongs in
`_getAutomaticCombatModifiers`; a new button on the resulting card belongs in `chat.mjs`.

---

## 5. The six common changes

### 5.1 Change a computed stat

Find the matching `_prepare*` in `module/documents/actor.mjs` — `_prepareDefenses`,
`_prepareMovement`, `_prepareActions`, `_prepareEnergon`, `_preparePersonalPowerSupply`. Change
the computation there.

Two rules:

- Compute from inputs that an Active Effect can target. If designers will ever want "+1 Toughness
  from a Perk", there must be a `bonus` field feeding your total.
- Never write a derived value back to the document. It is recomputed next prepare.

### 5.2 Add a field to an existing type

1. `module/data/<actor|item>/<type>.mjs` — add it to the schema, using the builders in
   `data/generic-makers.mjs`.
2. `template.json` — add it under the same type.
3. If it should be Active-Effect-targetable, add it to `helpers/effect-catalog.mjs` (§7).
4. If it needs migrating on existing worlds, add a step in `module/migration.mjs` and bump
   `needsMigrationVersion` in `system.json`.
5. Surface it: the relevant `templates/` partial, plus a label in `lang/en.json`.

### 5.3 Add a new actor or item type

The full checklists are on the wiki — [Adding an Actor Type][wa] and [Adding an Item Type][wi].
The short version, and the two steps people forget:

- Declare it in **both** `system.json` (`documentTypes`) and `template.json`.
- `lang/en.json` needs `ACTOR.TypeMyactor` / `ITEM.TypeMyitem` with **exactly** that
  capitalisation, or the type will not appear in the Create dialog.
- **Every new `.hbs` partial must be registered in `module/helpers/templates.mjs`.** An
  unregistered partial simply does not load, with no error that points at the cause.

[wa]: https://github.com/WookieeMatt/Essence20/wiki/Adding-an-Actor-Type
[wi]: https://github.com/WookieeMatt/Essence20/wiki/Adding-an-Item-Type

### 5.4 Add a setting

All settings live in `module/settings.js`.

- Register it with `game.settings.register(systemName, key, {...})`.
- `scope: "world"` for table-wide, `"client"` for per-user.
- Name and hint come from `lang/en.json`, never inline strings.
- Foundry's settings page has no grouping of its own, so this system inserts its own headings.
  `SETTING_GROUPS` at the top of the file maps each group to **the first key in it** — if you add
  a setting at the start of a group, or reorder them, update that table or the headings land in
  the wrong place.
- Read settings through the `setting(key)` helper rather than `game.settings.get` directly.

### 5.5 Add a button to a sheet

1. In the template, `<a data-action="myThing">`.
2. In the sheet class's `DEFAULT_OPTIONS.actions`, map `myThing` to a static handler.
3. Implement the handler; delegate any real work to a `helpers/` or `sheet-handlers/` function so
   the sheet stays wiring.

If the button costs a combat action, declare the cost so the action economy can spend it —
handlers run **after** the cost is paid, so a refused or unaffordable action never reaches yours.

### 5.6 Change what dropping an item does

`module/sheet-handlers/`. `drop-handler.mjs` is the dispatcher; the rest are per-kind:

| Handler | Handles |
| --- | --- |
| `drop-handler` | Dispatch: an Item dropped on an Actor |
| `attachment-handler` | Items that attach to other Items (upgrades, weapon effects) |
| `background-handler` | Origins, Influences and their choices |
| `role-handler` | Roles, levelling, and Spectrum Shift (retroactive Role swap) |
| `perk-handler` | Perks, including the ones that prompt for a choice |
| `power-handler` | Powers |
| `alteration-handler` | Alterations |
| `faction-handler` | Factions |
| `specialization-handler` | Specializations (driven from the Skill Picker) |
| `vehicle-handler` | The `system.actors` attachment collection — vehicle crew, Zord and Megaform participants |
| `zord-feature-handler` | Zord Features that configure rather than add a flat bonus |
| `transformer-handler` | Alt Modes, including deletion |
| `power-ranger-handler` | Morphing, and granted-Perk activation buttons |
| `listener-item-handler` / `listener-misc-handler` | Item creation from dataset, and click-to-roll |

This layer is mostly `actor.update()` sequencing and is intentionally light on unit tests — see
§12 and `docs/QA_PLAN.md`.

---

## 6. The roll pipeline

`module/dice.mjs` is one class of ~13,800 lines. It is the largest and most intimidating file in
the system, and you will end up in it. Here is the map.

### The three phases

Approximate line landmarks — they drift, so search for the method name rather than trusting a
number:

| Phase | Method | Roughly |
| --- | --- | --- |
| 1. Gather | `rollSkill(rawDataset, actor, item)` | ~3,370 |
| 2. Modify | `_getAutomaticCombatModifiers(actor, item, essence, skill)` | ~8,680 |
| 3. Execute | `_rollSkillHelper(formula, actor, flavor, ...)` | ~11,570 |

**Phase 1 — `rollSkill`** normalises the dataset from the DOM (everything arrives as strings),
resolves which skill and Essence are being rolled, applies anything that changes that choice, and
handles pre-roll interactions such as spending a Story Point to act while Defeated.

**Phase 2 — `_getAutomaticCombatModifiers`** is the big one. It walks conditions, statuses, Perks,
Hang-Ups, gear, the target, and the situation, accumulating `shiftUp` / `shiftDown` / `edge` /
`snag`. Below it sit dozens of small predicates (`_isSideswipeAttack`, `_isAlphaStrikeAttack`,
`_hasNearbyBulwarkCover`, ...) and damage appliers (`_applySmashDamage`,
`_applyFlameWarlordCritDamage`, ...).

Between phases 2 and 3 the **Roll Options dialog** (`apps/roll-options-dialog.mjs`, built through
`helpers/roll-dialog.mjs`) shows the player what was computed and lets them adjust it.

**Phase 3 — `_rollSkillHelper`** builds the formula, evaluates it, and either posts a plain roll
message or resolves the result against targets.

### The two context objects

```js
checkContext = { defenseType, targets, damageValue, damageType }
```

Present when the roll is an attack or a roll against a Difficulty. Its presence is what switches
phase 3 from "post a dice message" to "compare against each target's Defence". An area attack
rolls **once** and compares that single result against every target, which is what the rules
require.

```js
rollContext = { skill, essence, snag, isPowerWeaponAttack }
```

Describes what was rolled, for the chat card. On the `checkContext` path a `rollFailed` flag is
added once the outcome is known.

### `addSource` — the contract you must honour

Anything that changes a roll must also record **where it came from**:

```js
addSource('informedAccuracy',
  findPerk(actor, INFORMED_ACCURACY_ID)?.name ?? 'Informed Accuracy',
  { shiftUp: 1 });
```

The shape is `{ id, label, shiftUp, shiftDown, edge, snag }`.

`addSource` never changes the totals — it runs **alongside** them. What it does is put your
contribution, by name, in the Roll Options dialog's **Automatic Modifiers** list, where the player
can see why their shift number is what it is and, for shift sources, switch it off for a roll it
should not apply to (`rollSkill` subtracts a disabled source back out after the dialog resolves).

Edge and Snag sources are recorded the same way but are informational: they annotate the existing
Edge/Snag radio rather than adding a second, overlapping control.

> **A modifier without an `addSource` call is a bug.** It silently folds into an opaque total, and
> the player has no way to find out why their dice changed.

### Adding to the pipeline

| Your ability... | Hook it |
| --- | --- |
| always modifies a qualifying roll | a block in `_getAutomaticCombatModifiers` + `addSource` |
| offers the player a choice at roll time | a control in `templates/dialog/roll-dialog.hbs` |
| fires on a hit, a crit or a failure | the post-hit processing in `_rollSkillHelper` |
| grants a reroll | a `system.reroll` config on the item — do not hand-roll it (§9) |
| is a flat passive number | an **Active Effect**, no JavaScript at all (§7) |

Keep the rule logic in its own `helpers/` file and call into it from `dice.mjs`. The pipeline
should read as a list of "does this apply? then ask its module", not as the rules themselves.

---

## 7. Active Effects

An Active Effect changes a character's numbers. Most passive abilities in this system are effects,
not code, and that is the preference: **if the ability is "+1 Toughness" or "upshift Infiltration",
write an effect and no JavaScript.**

### The catalog

`module/helpers/effect-catalog.mjs` is the single source of truth for what an effect can target,
expressed in game vocabulary rather than schema paths. It is a hand-authored table, deliberately
not a walk of the DataModel schemas, because it must run under plain Node for the tests and the CI
script where `foundry.data.fields` does not exist.

It has four consumers:

1. the **Effect Wizard** (`apps/effect-wizard.mjs`) — builds effects from dropdowns and search;
2. the **plain-English summaries** on every Effects tab;
3. the **pack key validator**, `scripts/check-effect-keys.mjs`;
4. the wiki's generated
   [Active Effect Key Reference](https://github.com/WookieeMatt/Essence20/wiki/Active-Effect-Key-Reference).

Add a field to the catalog whenever you add an Active-Effect-targetable field. If you do not, the
wizard cannot offer it and the validator will call it unknown.

### The silent-failure trap

**Foundry resolves an unknown effect key to nothing and moves on.** An effect with a typo'd key
looks completely normal on the sheet and simply never applies. This system has shipped that bug
more than once. Before you commit pack content:

```bash
node scripts/check-effect-keys.mjs --verbose
```

It reports unknown keys, empty keys, and keys targeting read-only derived fields.

### Read-only fields

Writing to a computed total is legal and almost never what you meant — derived data overwrites it.
The catalog marks these. `game.essence20.probeClobberedKeys()` finds them empirically by applying
each key to a throwaway actor.

---

## 8. Compendium content

Content lives in `packs/<pack>/_source/*.json` — one JSON file per document — and is **compiled**
into Foundry's LevelDB format. The JSON is what you edit and what gets reviewed; the databases are
build output.

```bash
npm run build:db      # JSON source -> packs Foundry can load
npm run build:json    # packs -> JSON source (after editing in the Foundry UI)
```

**Close Foundry first.** The LevelDB files are locked while a world is open.

For a small, surgical change — a page reference, an Active Effect — editing the `_source` JSON by
hand and running `build:db` is faster and produces a far cleaner diff than a round trip through
the UI.

### The copyright rule

**Never paste rulebook text into a description field.** The compendiums ship with descriptions
empty on purpose; this project does not redistribute Renegade's prose. Record the **source book
name and page number** instead. GMs who own the book can fill descriptions in for their own world
with the Book Description Importer, which reads their own PDF and writes only to their own world.

Citing the rule in a **code comment** is different, and is expected — see §10.

### Before committing pack changes

```bash
node scripts/check-effect-keys.mjs
node scripts/check-pack-content.mjs
node scripts/check-pack-cross-references.mjs
node scripts/check-manifest-sync.mjs
```

---

## 9. Automating an ability

Several hundred Perks, Powers, Focus features and Role abilities are automated, and they all have
the same shape.

**One file per ability**, named after it, in `module/helpers/`, with a `.test.js` beside it.
Nothing else in the codebase knows how that ability works.

```
module/helpers/lucky-charm.mjs
module/helpers/lucky-charm.test.js
```

### Finding the ability on an actor

Abilities are identified by **compendium UUID**, never by name:

```js
import { findPerk, actorHasPerk } from "./perks.mjs";

const LUCKY_CHARM_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.xxxxxxxx";

if (actorHasPerk(actor, LUCKY_CHARM_ID)) { /* ... */ }
```

Use `findPerk` when you need the item's own data (a choice, a level), `actorHasPerk` when you only
need to know it is present.

> **Never write your own lookup.** A dropped item records its origin as either
> `flags.core.sourceId` **or** `_stats.compendiumSource`, depending on when and how it was
> created. `findPerk` checks both. A lookup that checks one silently fails for half the items in
> the world — see §11.

### Once per scene, once per encounter

Use the scene clock, never `game.combat`:

```js
import { hasUsedThisEncounter } from "./perks.mjs";
```

The counters work identically in and out of combat. An older pattern stamped uses with
`game.combat.id`, which read as "never used" outside combat and made once-per-scene abilities
unlimited during roleplay. That was a correctness bug, and it is why `helpers/scene-clock.mjs`
exists.

### Rerolls

Do not write reroll bookkeeping. `module/helpers/reroll.mjs` handles usage tracking, reset windows,
resource costs and preconditions, reading its config off whichever item carries it (schema in
`module/data/reroll-schema.mjs`). Put the config on the compendium item; the engine does the rest.

### Banked bonuses

"Bank a bonus now, spend it on a later roll" is an established pattern:
`bankPendingBonus` / `getPendingBonus` / `clearPendingBonus` in `perks.mjs`, consumed in
`_getAutomaticCombatModifiers`. See `helpers/banked-buffs.mjs`.

### Rules you cannot enforce

Some rules have no mechanism behind them — "the vehicle's Movement is reduced to 0 until the driver
restarts the engines", when nothing anywhere restarts an engine. The idiom is a **plain, visible
marker flag** that the GM manages by hand, documented as such in the header comment, rather than a
half-enforcement that surprises people. See `helpers/undo-engine.mjs`.

This is a judgement call you will face often. The rule of thumb: **an ability that does the wrong
thing is worse than one that does nothing**, because the player stops checking.

---

## 10. Conventions: how this codebase is written

This is the section that matters most, because matching it is the single most useful thing a new
contributor can do, and because it is not how most Foundry systems are written.

### The header comment is the point

Every rule-implementing file opens with a doc comment that does four things:

1. **Names the ability, and cites its source book and page.**
2. **Quotes the printed rule.**
3. **Says how it is built**, and which existing pattern it follows.
4. **Says what was deliberately *not* built, and why.**

A real one, from `helpers/lucky-charm.mjs`:

```js
/**
 * Lucky Charm (Finster's Monster-Matic Cookbook, Sorcerous Power, p.276): "DIF 12 Performance
 * (Rituals) Skill Test in a 1-hour ritual to recreate the effects of the Luck General Perk for
 * the rest of the day."
 *
 * The Luck General Perk (PR CRB p.97) is already a real, working `system.reroll` config, so
 * "recreate its effects" writes to this item's own `system.reroll.enabled` rather than inventing
 * a second, parallel reroll mechanism. The reroll engine reads its config straight off whichever
 * item carries it, so once enabled, Lucky Charm functions identically to holding Luck itself.
 *
 * "For the rest of the day" has no active turn-off hook - no day-boundary event exists anywhere
 * in this codebase - so it is left enabled until a GM manually disables it again, the same
 * "approximate an unenforceable duration" idiom this project uses everywhere else.
 */
```

Point 4 is the one people skip and the one that pays. Six months later, the question is never
"what does this do" — it is "why doesn't it do the other half?" A header that answers that saves
the next person from re-deriving your reasoning, or worse, "fixing" a deliberate omission.

Quoting the rule in a code comment is fine and expected. Pasting it into a **compendium
description** is not — see §8.

### Localise everything

Every user-visible string goes in `lang/en.json` and is read with `game.i18n.localize` /
`game.i18n.format`. No exceptions, including error messages and chat lines.

### Keep the pure part pure

The convention throughout `helpers/` is to separate the decision from the orchestration:

- pure functions that take data and return a decision — these are what the tests exercise;
- a thin layer around them doing `actor.update()` and other Foundry I/O.

This is why `helpers/` has ~299 test files and `sheet-handlers/` has almost none: the former is
mostly decisions, the latter is mostly `await actor.update(...)` sequencing.

### Sheets stay wiring

A sheet class should route a click to a function somewhere else. If a handler in
`base-actor-sheet.mjs` is growing rules, the rules belong in `helpers/`.

### One file per ability, named after it

Not grouped by book, not grouped by type. `helpers/whirlwind-strike.mjs`. This is why the folder
has hundreds of files, and it is the reason you can find any ability in one search.

### Prefer content over code

In order of preference for implementing an ability:

1. An **Active Effect** on the compendium item — no JavaScript.
2. A **config** the engine already reads (`system.reroll`, an action cost, an AoE shape).
3. A **new `helpers/` file** hooked into the pipeline.

Reach for 3 only when 1 and 2 genuinely cannot express it.

### ESLint is authoritative

`npm run lint`. Do not argue with it; `npm run lint-fix` handles most of it.

---

## 11. Traps

Every one of these has actually bitten this codebase.

**An unknown Active Effect key fails silently.** Foundry resolves it to nothing and moves on. The
effect looks perfectly normal on the sheet and never applies. Run
`node scripts/check-effect-keys.mjs`.

**Writing to a derived field does nothing.** `prepareDerivedData()` rebuilds it on the next update.
Target the `bonus` input, not the total. Find offenders with
`game.essence20.probeClobberedKeys()`.

**A dropped item's origin lives in one of two places.** `flags.core.sourceId` *or*
`_stats.compendiumSource`, depending on when and how it was created. Always use `findPerk` /
`actorHasPerk` from `helpers/perks.mjs`, which check both. A hand-rolled lookup checking one will
work in your test world and fail in someone else's.

**An unregistered Handlebars partial does not load.** Every `.hbs` must be listed in
`module/helpers/templates.mjs`. The failure gives you no clue where to look.

**`context.actor` is not set on actor sheets.** `@root.actor` in a template is undefined — use
`@root.document` or `@root.system`. (`@root.actors`, plural, is a different thing and *is* set,
by `sheet-handlers/vehicle-handler.mjs`, for attachment collections.)

**A modifier without `addSource` is invisible.** It folds into an opaque total and the player
cannot find out why their dice changed. See §6.

**`game.combat` is not a scene.** Once-per-scene abilities stamped with a combat id read as
"never used" outside combat, making them unlimited in roleplay. Use `helpers/scene-clock.mjs`.

**`css/essence20.css` is generated.** Edit `sass/`. If your styles are not showing, you did not
run `npm run build`.

**The Jest coverage floor can fail CI when every test passes.** `jest.config.js` collects coverage
from `module/documents/`, `module/helpers/`, `module/data/`, `module/sheet-handlers/`, `dice.mjs`
and `chat.mjs`. Adding an uncovered file under those globs drags the aggregate below the floor.
**Ship a test file with every new helper.**

**A lone CR makes git treat a file as binary.** `text=auto` normalisation is then skipped and CRLF
reaches CI. Check with:

```bash
git ls-files --eol | grep 'i/-text'
```

**`beta` is an ambiguous refname in this repo.** There is a local branch, a remote branch **and a
tag** all called `beta`, so git warns and may resolve to the tag. Say `origin/beta` explicitly.

**The checkout may be shared.** Branches move and get deleted without warning. Re-check
`git branch --show-current` and `git status` at the start of any session — and be aware that
**uncommitted changes to tracked files can be lost when someone switches branches**. New untracked
files survive; modified tracked files may not.

---

## 12. Shipping

### Tests

```bash
npm test
npm test -- --coverage
```

Tests sit beside the code: `module/helpers/foo.mjs` to `module/helpers/foo.test.js`. Foundry is
mocked in `module/jest.setup.js`, which stubs just enough of the client — `Actor`, `Item`,
`foundry.utils`, the `String.prototype.capitalize` and `Math.toDegrees`/`toRadians` extensions
Foundry adds — for the module graph to load under plain Node. Anything render-, DOM- or
database-heavy is out of scope by design.

### Content checks

Whenever you touch `packs/`:

```bash
node scripts/check-effect-keys.mjs --verbose
node scripts/check-pack-content.mjs
node scripts/check-pack-cross-references.mjs
node scripts/check-manifest-sync.mjs
```

### In-client smoke tests

`macros/smoke-test.js` and `macros/layout-regression-test.js`, run inside a world.

### CI

Three workflows in `.github/workflows/`:

| Workflow | Runs on | Does |
| --- | --- | --- |
| Lint | every push | `npm run lint` |
| Unit Tests | every push | `npm run lint`, then `npm test` |
| Release | a published GitHub Release | versions the manifest, compiles packs, zips, attaches |

Run the first two locally before pushing:

```bash
npm run lint && npm test
```

### Pull requests

Fill in all three sections of the template:

```
Closes [issue URL]

##### In this PR
-

##### Testing
-
```

**Testing** is the section people skip and the one reviewers need. Say what you did in Foundry, on
which actor type, and what you saw.

### Branches

| Branch | |
| --- | --- |
| `main` | Released. Holds the compiled compendium databases. |
| `beta` | Integration for the next release |
| `Beta-v6.0` | The v6.0 line |

`main` carries compiled databases while the working branches carry JSON source, so moving changes
between them is not a plain merge — see the wiki's
[Compendium Workflow](https://github.com/WookieeMatt/Essence20/wiki/Compendium-Workflow).

Ask before targeting a release-line branch directly.

### Releases

Publishing a GitHub Release triggers the Release workflow, which substitutes the versioned
`version` / `url` / `manifest` / `download` fields into `system.json` — **do not hand-edit
those** — compiles the packs, and attaches `system.json` and `Essence20.zip`.

Before tagging, work through `docs/RELEASE_CHECKLIST.md`. It exists because most of the UI and the
async orchestration in `sheet-handlers/` is not unit-tested, by design.

---

## Where to go next

| | |
| --- | --- |
| `docs/QA_PLAN.md` | The testing strategy, and why each layer is tested the way it is |
| `docs/RELEASE_CHECKLIST.md` | The manual pre-release regression pass |
| `docs/ACTIVE_EFFECTS_UI_PLAN.md` | The Effect Wizard's design |
| `docs/TOURS_PLAN.md` | The guided tours |
| `docs/STAT_BLOCK_IMPORTER_PLAN.md` | The importer's design |
| `docs/SPELL_POWER_AOE_PLAN.md` | Areas of effect |
| [The wiki](https://github.com/WookieeMatt/Essence20/wiki) | User-facing docs, and the contributor track |

The design plans in `docs/` were written **before** their features and kept afterwards. Read the
relevant one before changing a feature it covers — it will usually tell you why something is the
way it is, and what was considered and rejected.
