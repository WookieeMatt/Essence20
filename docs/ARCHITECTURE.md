# Essence20 Architecture Reference

A systematic tour of the system, layer by layer.

This is the **reference** companion to [`DEVELOPER_BIBLE.md`](DEVELOPER_BIBLE.md). The bible is
narrative — read it first, in order, to get productive. This document is for looking things up:
what lives where, what each file is responsible for, and where the extension points are.

| | |
| --- | --- |
| [1. Directory map](#1-directory-map) | Everything, at a glance |
| [2. Boot sequence](#2-boot-sequence) | What happens between page load and a usable world |
| [3. Document layer](#3-document-layer) | `module/documents/` |
| [4. Data layer](#4-data-layer) | `module/data/`, `template.json`, migrations |
| [5. Presentation layer](#5-presentation-layer) | Sheets, templates, styles |
| [6. Orchestration layer](#6-orchestration-layer) | `module/sheet-handlers/` |
| [7. Application layer](#7-application-layer) | `module/apps/` |
| [8. Rules layer](#8-rules-layer) | `module/helpers/` |
| [9. Cross-cutting subsystems](#9-cross-cutting-subsystems) | The named features |
| [10. Content and build](#10-content-and-build) | `packs/`, gulp, CI |
| [11. Hooks reference](#11-hooks-reference) | All 24, and why each exists |
| [12. Settings reference](#12-settings-reference) | By settings-page group |
| [13. Extension points](#13-extension-points) | Cheat sheet |

---

## 1. Directory map

```
essence20/
├── system.json              manifest: document types, packs, compatibility, pack folders
├── template.json            legacy data template (still live, alongside DataModels)
├── gulpfile.mjs             pack compile / extract
├── jest.config.js           test globs and the coverage floor
├── .eslintrc.cjs
│
├── module/
│   ├── essence20.mjs        entry point — registers everything, owns every hook
│   ├── settings.js          every setting, plus settings-page grouping
│   ├── dice.mjs             the roll pipeline
│   ├── chat.mjs             chat cards and their buttons
│   ├── migration.mjs        world data migration
│   ├── jest.setup.js        the Foundry mock used by every test
│   │
│   ├── documents/           Actor, Item, Combat, Combatant, Token, Actors collection
│   ├── data/                DataModel schemas
│   │   ├── actor/           one per actor type + templates/ of shared mixins
│   │   ├── item/            one per item type
│   │   └── *-schema.mjs     shared schema pieces (aoe, duration, reroll, attack)
│   ├── sheets/              one class per actor type + base-actor-sheet + item-sheet
│   ├── sheet-handlers/      drag-drop and multi-step orchestration
│   ├── apps/                ApplicationV2 windows
│   ├── rules/               the item-rules engine (system.rules): types, predicate, steps, triggers, adapter ...
│   │   └── plugins/         engine pieces added through the register* functions, by topic (zords, combat, rolls,
│   │                        dialog, cards, resources, picks, marks, effects, tags, shared); plugins/index.mjs
│   │                        imports them in registration order
│   ├── mechanics/           shared systems, not tied to one item
│   │   ├── item-hooks.mjs   the registry item code registers with (roll sources, hit riders, Uses, dialog toggles ...)
│   │   └── actions/ combat/ rolls/ resources/ characters/ vehicles/ companions/ world/
│   ├── items/               item-specific code that is still code, grouped by mechanic
│   │   ├── index.mjs        imports every item file that registers on load
│   │   ├── attacks/ defenses/ movement/ rolls/ resources/ healing/ social/ magic/ forms/
│   │   ├── zords/ vehicles/ gear/ senses/
│   │   ├── shared/          lookups and helpers several item files share
│   │   └── tests/           tests covering several item files at once
│   ├── importers/           book / PDF / journal / map / stat-block importers
│   ├── util/                small generic utilities (utils, localize, templates, config, enrichers)
│   ├── canvas/              token ruler
│   └── tours/               guided tour registration
│
├── templates/
│   ├── actor/               headers/ sidebars/ tabs/ parts/{main,misc,items}
│   ├── item/                one per item type
│   ├── app/  dialog/  chat/  hud/  sidebar/
│
├── sass/                    style source        css/essence20.css  build artifact
├── lang/en.json             every user-visible string
├── packs/<pack>/_source/    compendium content as JSON
├── scripts/                 content and manifest checkers, test wrappers
├── macros/                  in-client smoke tests
├── tours/                   tour definitions (JSON)
└── docs/                    design plans, the bible, this file
```

---

## 2. Boot sequence

Foundry fires these in order. Everything the system registers is hung off them, and all of it is
wired in `module/essence20.mjs`.

| Hook | What this system does |
| --- | --- |
| `init` | Populates `game.essence20`; sets `CONFIG.E20`; sets the initiative formula; swaps in every document class (`Actor`, `Actors`, `Combat`, `Combatant`, `Token`, `Item`), the Actor directory, the combat tracker and the token ruler; replaces `CONFIG.statusEffects` with the Essence20 conditions; registers the `@Check` text enricher; registers the DataModels; calls `registerSystemSettings()`; unregisters the core sheets and registers this system's. |
| `i18nInit` | `performPreLocalization(CONFIG.E20)` — resolves the i18n keys held in the config tables now that translations exist. |
| `setup` | Post-registration wiring. |
| `ready` | World-level work that needs documents to exist: primary-Party creation, the welcome-tour offer, optional effect-catalog auditing when `CONFIG.debug.essence20Catalog` is set. |

**Why the document classes matter:** swapping `CONFIG.Actor.documentClass` is what makes
`prepareDerivedData` and `_onUpdate` in `documents/actor.mjs` run for every actor in the world.
Nothing else opts in.

---

## 3. Document layer

`module/documents/` — Foundry document subclasses. This is where derived data and update side
effects live.

| File | Lines | Responsibility |
| --- | --- | --- |
| `actor.mjs` | ~2,150 | Derived data for all seven actor types; update/delete side effects |
| `item.mjs` | ~980 | Derived data for items; create/update hooks; roll data |
| `combat.mjs` | ~127 | Initiative rolling, turn and round boundaries |
| `combatant.mjs` | ~8 | The initiative formula |
| `token.mjs` | ~43 | Charges token movement against the action economy |
| `actors.mjs` | ~17 | The world Actor collection, extended with a `party` accessor |

### `actor.mjs` — the prepare chain

`prepareDerivedData()` dispatches to a long list of private preparers. The ones you are most
likely to need:

| Method | Computes |
| --- | --- |
| `_prepareActions` | Standard / Move / Free budgets (`system.actions.<cat>.max`) |
| `_prepareDefenses` | Toughness, Evasion, Willpower, Cleverness |
| `_prepareMovement` | Ground, aerial, swim, climb, burrow |
| `_prepareEnergon` / `_preparePersonalPowerSupply` | Resource pools |
| `_prepareVision` / `_prepareFireproofResistance` / `_prepareResource` | Misc derived state |
| `_prepareNpcData` / `_prepareVehicleData` / `_preparePartyData` | Per-type extras |
| `_prepareMegaformData` / `_prepareMegaformZordData` / `_prepareMegaformCombinerData` | Combined forms |
| `_prepareLoadout` | Hardpoints and the six-hand limit |
| `_prepareSorcerousPower` / `_preparePoisonTraining` | Line-specific systems |

> **Action budgets live on the actor on purpose.** An Active Effect needs somewhere to target, so
> "you gain an extra Move action" is a one-line effect change on `system.actions.move.bonus`
> rather than another bespoke helper.

### Side effects

| Extension point | Used for |
| --- | --- |
| `Actor#_onUpdate` | Morph / Alt Mode signals — status effect, chat line, token image |
| `Actor#_onUpdateDescendantDocuments` | Reacting to owned-item changes |
| `Actor#_preDelete` | Party protection: the last Party cannot be deleted; only a GM may delete the primary |
| `Actor.create` (static) | New-actor defaults |
| `Item#_preCreate` / `_onCreate` / `_preUpdate` / `_onUpdate` | Item lifecycle |
| `Combat#_onStartTurn` / `_onEndRound` | Action-budget reset, AoE expiry, per-turn flags |
| `TokenDocument#_preUpdateMovement` | Movement charging — **v14 fires this only on the moving client**, which is why movement enforcement is advisory and opt-in |

The codebase prefers **subclass overrides over hooks** where both exist: an override is a
first-class extension point, while a hook is a shared bus every module also writes to.

---

## 4. Data layer

### DataModels

`module/data/` holds one model per type.

```
data/
├── index.mjs                 registers everything
├── actor/
│   ├── index.mjs
│   ├── player-character.mjs  npc.mjs  companion.mjs
│   ├── vehicle.mjs  zord.mjs  megaform.mjs  party.mjs
│   └── templates/            common · creature · character · machine · zord-base
│                             stat-migration
├── item/                     one per item type (25)
├── generic-makers.mjs        makeBool · makeInt · makeNum · makeStr · makeStrArray ·
│                             makeStrWithChoices · makeStrArrayWithChoices
├── aoe-schema.mjs            area shape and size
├── duration-schema.mjs       effect durations
├── reroll-schema.mjs         the reroll engine's config
├── attack-schema.mjs
└── effect.mjs                the ActiveEffect model
```

Use the `templates/` mixins rather than redeclaring shared fields, and `generic-makers` rather
than hand-writing field definitions.

### The types

**Actors (7):** `playerCharacter` · `npc` · `companion` · `vehicle` · `zord` · `megaform` ·
`party`

**Items (25):** `alteration` · `altMode` · `armor` · `bond` · `equipmentPackage` · `faction` ·
`feature` · `focus` · `gear` · `hangUp` · `influence` · `magicBauble` · `megaformTrait` ·
`origin` · `perk` · `power` · `role` · `rolePoints` · `shield` · `specialization` · `spell` ·
`trait` · `upgrade` · `weapon` · `weaponEffect`

### `template.json`

Still live alongside the DataModels, and still lists every type. Adding a type means touching
both, plus `system.json`'s `documentTypes` and `lang/en.json`'s `ACTOR.Type*` / `ITEM.Type*`.

### Migration

`module/migration.mjs`. Worlds below `needsMigrationVersion` (in `system.json`) run it on load.
It carries compendium search and item-data migration helpers, with caches that
`resetMigrationCaches()` clears.

`data/actor/templates/stat-migration.mjs` handles stat-shape changes specifically.

---

## 5. Presentation layer

### Sheets

```
sheets/
├── base-actor-sheet.mjs    ~1,180 lines — shared behaviour for every actor sheet
├── character-sheet.mjs     npc-sheet.mjs  companion-sheet.mjs
├── vehicle-sheet.mjs       zord-sheet.mjs  megaform-sheet.mjs  party-sheet.mjs
└── item-sheet.mjs
```

`base-actor-sheet.mjs` owns:

- the shared `actions` map (item create/edit/delete, rolls, accordions, effect CRUD, Perk use,
  the Skill Picker, Mega Weapon summoning, attached-actor open/delete);
- `_prepareContext` / `_preparePartContext` and the item-sorting in `_prepareItems`;
- `_onRender` wiring: macro drag-drop, crew listeners, inline edit, Role Points, the image
  context menu, and the locked-state / titlebar lock toggle;
- `_onDropItem` / `_onDropActor`, which delegate to `sheet-handlers/`.

Tabs per type:

| Sheet | Tabs |
| --- | --- |
| Player Character | skills · actions · gear · spells · powers · perks · altmode · zords · contacts · background · effects |
| NPC | npc · actions · contact · altmode · effects · notes |
| Vehicle / Zord | main · actions · passengers · effects · notes |
| Megaform | main · actions · combiners · effects · notes |
| Companion | main · actions · effects · notes |
| Party | roster · requisition · missionCritical · effects · notes |
| Item | description · details · effects |

Tabs that do not apply to a given actor are hidden rather than removed, so they return if the
condition changes (the Party sheet's Requisition tab keys off the world's Game Line).

### Templates

```
templates/actor/
├── headers/     per type — plus common.hbs (name, size, morph/alt-mode badges)
├── sidebars/    per type — defences, health, movement, initiative, resources, action buttons
├── tabs/        actions.hbs  effects.hbs  notes.hbs   (shared across types)
└── parts/
    ├── main/    the body of each tab
    ├── misc/    shared fragments: defenses, health, movement, initiative, action-economy,
    │            energon, power-points, training, collapsible containers, skill-picker parts
    └── items/<type>/{container,details}.hbs
```

> **Every partial must be registered in `module/util/templates.mjs`.** An unregistered `.hbs`
> silently fails to load.

Item rows on actor sheets use the `container.hbs` / `details.hbs` pair — collapsed row with chips,
and expanded body. The wiki's
[Item Containers and Chips](https://github.com/WookieeMatt/Essence20/wiki/Item-Containers-and-Chips)
page records what each type displays.

### Styles

`sass/` compiles to `css/essence20.css`. All CSS is scoped to `.essence20` and uses an `e20-`
prefix. The **theme** is a frame treatment (Sci-fi or Pony) combined with Foundry's own light/dark
colour scheme, selected by the per-client `sheetTheme` setting; apps call `applyThemeClass`.

---

## 6. Orchestration layer

`module/sheet-handlers/` — what happens when documents meet each other. Mostly `actor.update()`
sequencing, intentionally light on unit tests (see `QA_PLAN.md`).

| Handler | Responsibility |
| --- | --- |
| `drop-handler` | Dispatcher for an Item dropped on an Actor |
| `attachment-handler` | Items that attach to Items — upgrades, weapon effects |
| `background-handler` | Origins and Influences, including their choices |
| `role-handler` | Role assignment, levelling, and Spectrum Shift (retroactive Role swap) |
| `perk-handler` | Perks, including choice-bearing ones |
| `power-handler` | Powers |
| `alteration-handler` | Alterations |
| `faction-handler` | Factions |
| `specialization-handler` | Specializations, driven from the Skill Picker |
| `vehicle-handler` | `system.actors` — the type-agnostic attachment collection reused for vehicle crew, Zord and Megaform participants; sets `context.actors` |
| `zord-feature-handler` | Zord Features that configure rather than add a flat bonus |
| `transformer-handler` | Alt Modes, including deletion |
| `power-ranger-handler` | Morphing, and granted-Perk activation |
| `listener-item-handler` | Item creation from a dataset |
| `listener-misc-handler` | Click-to-roll and assorted listeners |

---

## 7. Application layer

`module/apps/` — ApplicationV2 windows.

### Player-facing

| App | |
| --- | --- |
| `skill-picker` | Every skill's shift in one place, with a live per-Essence spend tally, split spending for the two any-Essence skills, inline Specializations, and rank attribution |
| `roll-options-dialog` | The roll popup: shift up/down, Edge/Snag, Specialization, crit-on-d2, and the labelled Automatic Modifiers list |
| `story-points` | The shared points tracker, its spends, and the Scene Clock |
| `stat-editor` | Bulk editor for the sidebar Health / Defences / Speeds panels |
| `power-cost-selector`, `defense-modification`, `transform-option-selector`, `vehicle-role-selector`, `trait-selector`, `roller-selector`, `choices-selector`, `multi-choice-selector`, `essence-progression-selector`, `alteration-essence-selector`, `alteration-movement-selector`, `multi-essence-selector` | Focused pickers raised when a rule needs a choice |
| `sheet-options` | Per-actor switches (can morph, can transform, token images) |

### GM-facing

| App | |
| --- | --- |
| `compendium-browser` | Searches all packs at once; one tab per item type with equipment merged into one; per-type sub-filters |
| `compendium-browser-sources` | Which sourcebooks this world uses |
| `effect-wizard` | Builds Active Effect changes from game vocabulary instead of schema paths |
| `stat-block-importer` | Paste a stat block, see it parsed live, create the Actor |
| `book-description-importer` | Fill compendium descriptions from a rulebook PDF the GM owns |
| `adventure-importer` | Turn an adventure PDF into Journals, Scenes, Threats and Roll Tables |
| `monster-grow-dialog` | Build and link a Threat's Grown form |
| `combat-tracker` | The tracker, showing conditions and remaining actions |
| `essence20-actor-directory` | The Actors sidebar, with Party actors as expandable folders |

### Infrastructure

`serialize-form-submits` — fixes a real gap in `ApplicationV2#_onChangeForm`. Apps that submit on
change (the Skill Picker, the Stat Block Importer) wrap themselves in it.

---

## 8. Rules layer

`module/helpers/` — two distinct populations.

### Infrastructure

| File | |
| --- | --- |
| `config.mjs` | `CONFIG.E20` — every enum: skills, shifts, sizes, availabilities, status effects, named actions, game versions, point names |
| `effect-catalog.mjs` | The Active Effect vocabulary; source of truth for the wizard, the summaries, the validator and the wiki reference |
| `templates.mjs` | Handlebars partial registration |
| `localize.mjs` | `preLocalize` for config tables |
| `utils.mjs` | Shared helpers, including specialization slugification |
| `perks.mjs` | `findPerk` / `actorHasPerk` / Hang-Up lookups, usage windows, banked bonuses |
| `dice`-adjacent: `roll-dialog.mjs` | Builds the roll dialog's fields, including `buildCombatModifierSourceFields` |
| `action-economy.mjs` | Budget, ledger and spending |
| `scene-clock.mjs` | Scene and Encounter counters |
| `story-points.mjs`, `party.mjs`, `friendship-circle.mjs` | The shared pool and the Party actor |
| `reroll.mjs` | The reroll grant engine |
| `aoe-targeting.mjs`, `aoe-expiry.mjs` | Area placement and expiry |
| `enrichers.mjs` | The `@Check[...]` text enricher |
| `effects.mjs`, `effect-key-warnings.mjs`, `effect-catalog-audit.mjs` | Effect CRUD and validation |
| `compendium-browser.mjs` | Pack grouping and visibility |
| `morph-state.mjs` | Morph / Alt Mode signals |
| `token-movement.mjs` | What movement costs |
| `named-actions.mjs` | What the rules' named combat actions actually do |
| `book-*.mjs`, `pdf-reader.mjs`, `stat-block-*.mjs` | The importers |
| `combat.mjs`, `actor.mjs`, `application.mjs`, `traits.mjs`, `powers.mjs`, `skill-effects.mjs` | Assorted shared logic |

### Abilities

Everything else — several hundred files, one per automated Perk, Power, Focus feature or Role
ability, each named after it, each with a `.test.js` beside it. See
[`DEVELOPER_BIBLE.md` §9](DEVELOPER_BIBLE.md#9-automating-an-ability).

---

## 9. Cross-cutting subsystems

Features that span layers. Each has a wiki page for the user-facing view.

| Subsystem | Lives in | Notes |
| --- | --- | --- |
| **Roll pipeline** | `dice.mjs` + `mechanics/rolls/roll-dialog.mjs` + `apps/roll-options-dialog.mjs` | Three phases; `addSource` contract |
| **Action economy** | `mechanics/actions/action-economy.mjs`, `documents/combat.mjs`, `documents/token.mjs`, `apps/combat-tracker.mjs` | Budget on the actor, ledger on the combatant, four enforcement modes |
| **Scene Clock** | `mechanics/resources/scene-clock.mjs`, surfaced in `apps/story-points.mjs` | Scene and Encounter counters, GM-advanced; replaces `game.combat.id` stamping |
| **Story Points** | `mechanics/resources/story-points.mjs`, `mechanics/resources/party.mjs`, `apps/story-points.mjs` | Pool lives on the primary Party actor so it can be permissioned |
| **Party / Squad** | `data/actor/party.mjs`, `sheets/party-sheet.mjs`, `apps/essence20-actor-directory.mjs`, `mechanics/resources/party.mjs`, `mechanics/resources/requisition.mjs` | Foundry core has no party concept; all custom |
| **Active Effects** | `mechanics/characters/effect-catalog.mjs`, `apps/effect-wizard.mjs`, `scripts/check-effect-keys.mjs` | One vocabulary, four consumers |
| **Areas of effect** | `mechanics/combat/aoe-targeting.mjs`, `mechanics/combat/aoe-expiry.mjs`, `data/aoe-schema.mjs` | Built on v14 Region placement, not `MeasuredTemplate` |
| **Rerolls** | `mechanics/rolls/reroll.mjs`, `data/reroll-schema.mjs`, `chat.mjs` | Config-driven; never hand-roll |
| **Morph / Alt Mode** | `mechanics/characters/morph-state.mjs`, driven from `Actor#_onUpdate` | Status effect + header badge + chat line + token image |
| **Importers** | `apps/{stat-block,book-description,adventure}-importer.mjs`, `helpers/book-*.mjs`, `importers/pdf-reader.mjs` | PDFs are read in the browser and never uploaded |
| **Compendium Browser** | `apps/compendium-browser*.mjs`, `util/compendium-browser.mjs` | Launched from the Compendium and Item directory footers |
| **Tours** | `tours/*.json`, `module/tours/` | Sheet tours build a throwaway demo actor |
| **Enrichers** | `util/enrichers.mjs` | `@Check[skill=… dif=… defense=… spec=…]{label}`; DIF is GM-only |

---

## 10. Content and build

### Packs

Content is JSON in `packs/<pack>/_source/`, compiled to LevelDB by `gulpfile.mjs`:

```bash
npm run build:db      # JSON  -> LevelDB
npm run build:json    # LevelDB -> JSON
```

Foundry must be closed for both. 32 packs, grouped by game line in `system.json`'s `packFolders`.
Two are ActiveEffect packs (`conditions`, `pr_crb_effects`); the rest are Items.

### Checkers

| Script | Catches |
| --- | --- |
| `check-effect-keys.mjs` | Unknown, empty, or read-only-targeting effect keys |
| `check-pack-content.mjs` | Content sanity |
| `check-pack-cross-references.mjs` | Cross-pack links that no longer resolve |
| `check-manifest-sync.mjs` | `system.json` and `packs/` disagreeing |

### CI

| Workflow | Trigger | Steps |
| --- | --- | --- |
| Lint | push | `npm run lint` |
| Unit Tests | push | `npm run lint`, `npm test` |
| Release | published Release | version the manifest, `gulp compile`, zip, attach |

The release zip contains `system.json`, `template.json`, `assets/`, `lang/`, `module/`, `packs/`,
`css/` and `templates/` — note `sass/`, `docs/` and `scripts/` are **not** shipped.

---

## 11. Hooks reference

All registered in `module/essence20.mjs`.

| Hook | Purpose |
| --- | --- |
| `init` | The main registration pass — see §2 |
| `i18nInit` | Pre-localize `CONFIG.E20` |
| `setup` | Post-registration wiring |
| `ready` | Primary Party, welcome tour, optional catalog audit |
| `createActor` / `deleteActor` | Party bookkeeping and defaults |
| `updateActor` | Cross-document reactions |
| `combatStart` / `combatTurnChange` / `deleteCombat` | Action budgets, scene-clock advance, per-turn flags |
| `hotbarDrop` | Item-to-macro creation |
| `renderChatMessageHTML` | Chat card buttons — rerolls, damage application |
| `renderActorDirectory` | The Party-aware sidebar |
| `renderCompendiumDirectory` / `renderItemDirectory` | The Compendium Browser button |
| `renderSettingsConfig` | Insert the settings-page group headings |
| `renderTokenHUD` | Token HUD additions |
| `renderDialogV2` (×2) | Dialog theming and behaviour |
| `renderActiveEffectConfig` / `getHeaderControlsActiveEffectConfig` | Effect Wizard entry points |
| `preCreateActiveEffect` | Effect creation behaviour (Ask / Wizard / Blank) |
| `getSceneControlButtons` | Scene controls |
| `updateWorldTime` | Time-based expiry |
| `clientSettingChanged` | React to a setting changing without a reload |
| `dragRuler.ready` | Drag Ruler module integration |

### Hooks for modules

Hooks the system *calls* for other modules (sounds and animations, HUDs...), through `announce()` in
`module/mechanics/world/public-hooks.mjs`. Each is `Hooks.callAll`, on the client that made the thing happen (so a
listener that broadcasts — Sequencer — plays it once for the table), never awaited, and read-only: don't write to the
payload. A stable API, like `game.essence20`.

| Hook | When | Payload |
| --- | --- | --- |
| `essence20.event` | Every Trigger event (`TRIGGER_EVENTS` plus every `registerEvent` one): morph, transform, takesDamage, defeated, conditionGained, storyPointSpent, turnStart, megaformCombined… — whether or not any rule listens. `conditionGained` carries `vars.statuses` (the Condition ids) | `{ actor, event, roll, outcome, facts, damage, targets, vars }` |
| `essence20.rollResolved` | A roll's results are in (after its `afterRoll` event) | `{ actor, item, skill, isAttack, isMelee, damageType, style, isCrit, isFumble, outcome, total, targets: [{ actor, hit, damage }] }` — `style` is the weapon's (`E20.weaponStyles`) |
| `essence20.areaPlaced` | An area attack's shape is placed (before its roll); `shapeData` is in canvas pixels — a circle's `x`/`y`/`radius`, a cone's or line's apex `x`/`y` and `rotation` | `{ actor, item, shape, shapeData, origin, region, tokens, lingering }` |
| `essence20.requisitionGranted` | A Requisition (GI Joe) puts the item on the member's sheet | `{ member, item }` |
| `essence20.zordSummoned` | A Ranger calls their Zord | `{ zord, ranger }` |
| `essence20.zordArrived` | Its arrival card is posted | `{ zord, ranger }` |
| `essence20.zordPlaced` | Its token is put on the map at the edge | `{ zord, token }` |
| `essence20.zordBoarded` | A Ranger takes the driver's seat (before their token leaves) | `{ zord, ranger, rangerToken, zordToken }` |
| `essence20.zordDisembarked` | A Ranger gets out (their token is back) | `{ zord, ranger, zordToken }` |
| `essence20.zordRecalled` | Recall for Repairs (before its token leaves) | `{ zord, zordToken }` |
| `essence20.zordRepaired` | Back from repairs on a later summon | `{ zord }` |
| `essence20.combinerMerged` | Combiner members finish merging | `{ form, members }` |
| `essence20.megaformFormed` | A Megazord or Combiner joins on the map: its members' tokens become its token (announced before theirs go) | `{ form, token, members, from }` (`from`: each member token's centre) |
| `essence20.megaformSplit` | A Combiner or Megazord breaks apart (Defeated), or separates on the map | `{ form, components, isCombiner, voluntary?, tokens?, at?, to? }` (separating: `voluntary`, the members' `tokens`, where the Megaform stood `at` {x, y, w}, each member's centre `to`) |
| `essence20.altModeBoarded` | Someone climbs into a Transformer's Alt Mode (or is put in its Cage) - mechanics/vehicles/alt-mode-crew.mjs | `{ carrier, passenger, role }` (`role`: driver, passenger or prisoner) |
| `essence20.altModeDisembarked` | Someone gets out of a Transformer (or escapes its Cage, or is put out by a Mode change or a crash) | `{ carrier, passenger, role, escaped }` |
| `essence20.altModeCrashed` | A Transformer crashes in Alt Mode | `{ carrier, feet }` |
| `essence20.mounted` | Someone gets on a creature that can be ridden - mechanics/companions/mounts.mjs | `{ mount, rider }` |
| `essence20.dismounted` | Someone gets off a mount (or is put off it) | `{ mount, rider }` |
| `essence20.storyPointNarrative` | A Story Point spent for a narrative effect | (see the Story Point tracker) |

One hook is the exception, called so a listener *can* change something:

| Hook | When | Payload |
| --- | --- | --- |
| `essence20.preRollOptions` | Just before the Roll Options Dialog opens for a Skill roll, an attack or Initiative (`mechanics/rolls/pre-roll-hook.mjs`) | `{ actor, item, skill, isInitiative, dataset, skillDataset, sources, addSource }` — change `dataset.shiftUp` / `shiftDown` and `skillDataset.edge` / `snag`, or call `addSource({ label, shiftUp, shiftDown, edge, snag })`, which applies a modifier and lists it in the dialog (switchable there, like an item rule's). Synchronous listeners only |

### Extending the rules engine

`game.essence20.rules` is the stable way for a module to add to the rules engine, instead of importing the system's
files:

- `registerRuleType(name, definition)`, `registerStep(name, handler, options)`, `registerTag(name, fn, meta)`,
  `registerRollSources(fn)`, `registerRuleHelper(...)` — new rule types, steps, `when` tags (give a tag a `phrase`
  so `rules/describe-when.mjs` can say it in words) and roll sources.
- `registerHouseRule({ id, label, hint?, module?, rules?, default? })` — a **house rule**
  (`module/rules/house-rules.mjs`). The GM switches it on under Configure Settings → House Rules
  (`apps/house-rules-config.mjs`, world setting `houseRules`). While it's on, every actor (world and unlinked tokens)
  runs its `rules` as if it held an item carrying them: `rules/index.mjs#collectRules` adds them on a stand-in item named
  after the house rule, so rolls list the house rule as the source. A house rule with no `rules` is a switch the
  module's own code reads with `houseRuleEnabled(id)` (for instance from an `essence20.preRollOptions` listener).
  Register from your module's `init` hook; a later registration refreshes every actor. Rules read through the rule
  index (RollModifier, DamageModifier, DefenseModifier, DialogSwitch...) work; a Use rule has no item sheet to put its
  button on, and the stand-in item's flags are kept in memory only.
- `houseRules()` — every registered house rule.

A GM can also make house rules in Foundry, with no module: House Rules → **New House Rule** (`apps/house-rule-editor.mjs`).
Each rule in one is edited with the item sheet's guided Rules editor (`apps/rule-editor.mjs`, handed a stand-in "item"
whose `update` writes back to the draft), or copied in by dropping an Item. They are kept in the world setting
`worldHouseRules` (`[{id, label, hint, rules}]`) and loaded by `syncWorldHouseRules()` when settings register, before
any actor prepares; they show under "This World" with edit and delete.

---

## 12. Settings reference

`module/settings.js`, 27 registrations. `SETTING_GROUPS` maps each settings-page heading to **the
first key in that group** — reordering settings without updating it misplaces the headings.

| Group | Settings |
| --- | --- |
| Compendium Browser | `enabledSourcebooks` (+ its config menu) |
| Book Descriptions | `bookDescriptions` (+ menu) |
| Adventures | adventure importer menu |
| House Rules | `houseRules` · `worldHouseRules` (+ menu) — rules/house-rules.mjs |
| Game Line | `gameLine` |
| Story Point Tracker | `sptAccess` · `sptGmPointsArePublic` · `sptShow` · `sptMessage` · `sptPointsName` |
| Combat | `actionEconomyMode` · `actionEconomyMovement` · `sceneClockAdvanceOnCombatEnd` |
| Sheets | `sheetTheme` · `effectAddBehavior` |
| Threats | `monsterGrowHealthMode` |

Hidden (`config: false`) state: `sceneClockScene` · `sceneClockEncounter` · `sceneClockLabel` ·
`sptToggleState` · `sptGmPoints` · `sptStoryPoints` · `primaryParty` · `partyFolderState` ·
`tourWelcomeOffered` · the legacy theme key.

Read settings through the `setting(key)` helper.

---

## 13. Extension points

| I want to... | Touch |
| --- | --- |
| React to a Foundry event | `essence20.mjs` — keep all hooks there |
| Change a computed stat | `documents/actor.mjs` `_prepare*` |
| React to an actor changing | `Actor#_onUpdate` |
| React to turn / round boundaries | `Combat#_onStartTurn` / `_onEndRound` |
| Charge or block token movement | `TokenDocument#_preUpdateMovement` + `mechanics/combat/token-movement.mjs` |
| Add a field | `data/**` + `template.json` (+ `effect-catalog.mjs` if targetable) |
| Add a sheet control | the sheet's `actions` map |
| Change drop behaviour | `sheet-handlers/` |
| Add a roll modifier | `dice.mjs#_getAutomaticCombatModifiers` + **`addSource`** |
| Add a chat card button | `chat.mjs` + `renderChatMessageHTML` |
| Add an enum | `util/config.mjs` |
| Add a string | `lang/en.json` |
| Add a partial | `templates/` + **register in `util/templates.mjs`** |
| Automate an ability | a new `helpers/<ability>.mjs` + `.test.js` |
