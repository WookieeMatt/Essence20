# Essence20 Guided Tours — Implementation Plan

Goal: ship a suite of in-app **Foundry Tours** for the Essence20 system that walk a new user
through as much of the system as is practically demonstrable — sheets, rolls, gear, perks,
roles, powers, transformations, vehicles/Zords/Megaforms, the Compendium Browser, Story
Points, Active Effects and GM tooling — and make them discoverable from inside the UI.

**Target: Foundry VTT v14** (local install is 14.364). Every API fact below has been
re-verified against the v14 client source — see §9.

`system.json` now declares `compatibility: { minimum: "14", verified: "14" }` (bumped on the
`Tours` branch, 2026-09-16, at the user's direction). v13 is no longer a supported target, so
this plan assumes v14 APIs unconditionally and no longer guards them.

---

## 1. What core actually gives us

Source of truth (v14 build 364): `client/nue/tour.mjs`, `client/nue/tours-collection.mjs`,
`client/nue/tours/{sidebar,canvas,setup}-tour.mjs`,
`client/applications/sidebar/apps/tours-management.mjs`, `templates/apps/tour-step.html`, and
the JSON examples in `public/tours/`.

**`TourConfig`**: `namespace`, `id`, `title`, `description`, `steps[]`, plus optional
`localization` (merged into `game.i18n._fallback` at construction), `restricted` (GM-only),
`display` (**must be `true`** or the tour is invisible in Manage Tours), `canBeResumed`, and
`suggestedNextTours[]` (offers the first uncompleted tour in the list via a `DialogV2` when
this one finishes — this is how we chain a curriculum).

**`TourStep`**: `id`, `title`, `content`, optional `selector`, `tooltipDirection`,
`restricted`. `SidebarTour` adds `sidebarTab`; `CanvasTour` adds `layer`/`tool`.

Useful facts we get for free:

- Step `content` is run through `_loc()` (v14's `game.i18n.localize` alias), split on `\n`, and each line is
  emitted with a **triple-stash** (`{{{this}}}`) into `<p class="content">` — so raw HTML
  (`<strong>`, `<code>`, `<i class="fas …">`) works in tour copy.
- A step with **no** `selector` renders as a centered `aside.tour-center-step` — ideal for
  intros, chapter breaks and outros.
- Progress is stored per-user in the core client setting `core.tourProgress`, keyed
  `[namespace][id]`. Resume/completed state and the Manage Tours UI come free; no system
  setting is needed to track progress.
- `ToursCollection#register(namespace, id, tour)` throws on duplicate keys and calls
  `tour._reloadProgress()`.
- `tours-management.mjs#_sortCategories` gives `game.system.id` its own category, so our tours
  appear under a dedicated **"Essence20"** heading, right after core's.
- `canStart` (getter, default `true`) gates the Play button — override it for tours that need
  a canvas, an actor, or GM rights.
- Only one tour may be active at a time; `Tour.activeTour` is a static singleton.

Limitations that drive the architecture in §2:

1. **`_getTargetElement()` is a single synchronous `document.querySelector`.** Anything
   rendered asynchronously (an ApplicationV2 sheet, the Skill Picker, the Roll Options Dialog,
   a re-rendered PART after a tab switch) will not be found, and the step degrades to a
   `target element ... was not found` console warning plus a broken tooltip.
2. **No way to open anything.** Steps are purely declarative. Opening a sheet, switching a
   sheet tab, expanding an accordion, or popping a sub-app has to happen in `_preStep()`.
3. **Highlight geometry is computed once**, from `getBoundingClientRect()` at render time. If
   the target moves or resizes after the step renders, the cut-out drifts.
4. **`.tour-overlay` blocks input**, so the user cannot interact during a step. These tours are
   *demonstrations*, not interactive exercises — write the copy accordingly.

---

## 2. Architecture

New directory `module/tours/`, deliberately **outside** `jest.config.js`'s
`collectCoverageFrom` globs, so DOM-bound tour plumbing doesn't drag the coverage floor (see
§8 for what does get tested).

```
module/tours/
  index.mjs            # registerEssence20Tours() — called from Hooks.once("setup")
  essence20-tour.mjs   # Essence20Tour base class (the extended step grammar)
  demo-content.mjs     # demo actor provisioning + teardown
  actions.mjs          # the whitelisted step "action" implementations
tours/                 # JSON tour definitions, served as static system files
  welcome.json
  character-sheet.json
  ...
```

### 2.1 Registration

`game.tours` is constructed in the `Game` constructor, but `foundry.nue.registerTours()` runs
*after* `i18n.initialize()` and *before* the `setup` hook. Register in **`setup`**:
`game.tours` exists, i18n is live (needed, because the `Tour` constructor touches
`game.i18n._fallback`), and it is early enough that Manage Tours is populated on first open.

```js
// module/essence20.mjs
import { registerEssence20Tours } from "./tours/index.mjs";
Hooks.once("setup", registerEssence20Tours);
```

```js
// module/tours/index.mjs
export async function registerEssence20Tours() {
  const tours = [
    ["welcome", "welcome", Essence20Tour],
    ["character-sheet", "characterSheet", Essence20SheetTour],
    /* … */
  ];
  for (const [file, id, cls] of tours) {
    try {
      game.tours.register("essence20", id,
        await cls.fromJSON(`systems/essence20/tours/${file}.json`));
    } catch (err) {
      console.error(`Essence20 | Failed to register tour "${file}"`, err);
    }
  }
}
```

`Tour.fromJSON` resolves through `foundry.utils.getRoute(...)`, so a plain
`systems/essence20/tours/x.json` path works, honours `ROUTE_PREFIX`, and needs no `system.json`
change. Wrap each registration individually so one malformed JSON file can't kill the suite.

### 2.2 `Essence20Tour` — the extended step grammar

One base class carries every capability; individual tours then mostly differ only in JSON.
Custom step properties, all optional:

| Property | Effect |
|---|---|
| `sidebarTab` | `ui[tab].activate()` before the step, as core's `SidebarTour` does. Not async in v14. |
| `layer` / `tool` | `ui.controls.activate({control, tool})` (as core's `CanvasTour`). |
| `app` | Logical key (`"character"`, `"npc"`, `"vehicle"`, `"zord"`, `"megaform"`, `"item"`, `"skillPicker"`, `"rollDialog"`, `"compendiumBrowser"`, `"storyPoints"`). Ensures that app is open **and scopes `selector` to its root element**, so `.tab[data-tab='gear']` can't match a different open sheet. |
| `tab` | Activates a sheet tab via `app.changeTab(tab, "primary")`, then awaits the re-render. |
| `action` | Name from the `actions.mjs` whitelist (§2.4) — a side effect performed before the step. |
| `expand` | Selector of a `.collapsible-item-container` / `.accordion-wrapper` to open first, so the step can point at item details. |
| `waitFor` | Selector to poll for instead of `selector` (e.g. wait for a chat card, then highlight a button inside it). |
| `timeout` | Poll budget in ms, default 3000. |
| `optional` | If the target never appears, skip the step instead of showing a broken tooltip. Essential for conditional UI (`{{#if system.canTransform}}`, `{{#if system.canMorph}}`, MLP-only blocks, and so on). |

Implementation shape:

```js
export class Essence20Tour extends Tour {
  #app = null;                       // the ApplicationV2 the current step is scoped to

  get canStart() { return game.ready; }

  async start() {
    game.togglePause(false);
    await super.start();
  }

  async _preStep() {
    await super._preStep();
    const step = this.currentStep;
    if (step.sidebarTab) ui[step.sidebarTab]?.activate();  // sync in v14
    if (step.layer && canvas.scene) await ui.controls.activate({control: step.layer, tool: step.tool});
    if (step.app) this.#app = await this._ensureApp(step.app);
    if (step.tab && this.#app) {
      this.#app.changeTab(step.tab, "primary");
      await this._waitForRender(this.#app);
    }
    if (step.action) await ACTIONS[step.action]?.(this);
    if (step.expand) {
      const el = await this._await(step.expand);
      el?.querySelector("[data-action='toggleAccordionHeader']")?.click();
    }
    if (step.waitFor) await this._await(step.waitFor, step.timeout);
  }

  /** @override — scope to the step's app, and look inside detached windows (v14). */
  _getTargetElement(selector) {
    if (this.#app) return this.#app.element?.querySelector(selector) ?? null;
    return document.querySelector(selector)
      ?? this._queryDetachedWindows(selector);
  }

  /** v14: any ApplicationV2 may live in a separate browser window. See §2.5. */
  _queryDetachedWindows(selector) {
    for (const {window: win} of foundry.applications.detached.windows.values()) {
      const el = win.document?.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  /** Poll for an element with a MutationObserver plus a timeout budget. */
  async _await(selector, timeout = 3000) { /* … */ }
}
```

`progress()` calls `_preStep()` **before** `_getTargetElement()`, so awaiting inside
`_preStep` is sufficient: by the time core queries the DOM, the element is there. Where a step
is `optional` and its target never materialises, override `progress()` to advance past it
rather than let core warn and render a detached tooltip.

**Highlight drift (limitation 3):** after `_renderStep()`, re-measure on the next animation
frame and on `resize`, then drop and rebuild the fade element. A small
`_repositionHighlight()` at the tail of `_renderStep()` covers the common case — a sheet PART
that finishes painting one frame late:

```js
_repositionHighlight() {
  this.fadeElement?.remove();
  this.fadeElement = Tour.highlightElement(this.targetElement, {
    padding: this.currentStep.selector ? Tour.HIGHLIGHT_PADDING : 0,
  });
}
```

`Tour.highlightElement()` is the v14 static that `_renderStep` itself uses, and it appends to
`element.ownerDocument.body` rather than `document.body` — which is precisely what makes it
correct when the target lives in a detached window (§2.5). Reuse it rather than hand-rolling
the geometry the way v13 did inline.

### 2.3 Demo content

Most of what we want to show only exists on a *populated* character: a Role at a given level,
perks with use-buttons, a weapon carrying weapon effects and upgrades, armor, a
morph/transform-capable actor, a Zord, a Megaform.

**Approach: built at runtime from compact definitions in `demo-content.mjs`** (decided
2026-09-16, replacing this plan's original "ship them as an Actor compendium" recommendation —
see the note below for why).

- `DEMO_ACTORS` in `module/tours/demo-content.mjs` holds one object per demo actor: its `system`
  fields, its `items`, and an `attach` list for weapon effects and upgrades. The data models fill
  in everything else, so each definition stays at the handful of fields a tour actually shows.
- Contents: one Power Rangers PC (Role + Origin + Influence + Perk + a weapon with a weapon
  effect and an upgrade + armor + shield + gear, `canMorph`) and one NPC/Threat, both built.
  A Transformers PC (`canTransform`, Alt Mode, Energon), Zord, Vehicle and Megaform come with the
  Phase 3 tours that need them.
  **No rulebook text in any description field** — every line is original, tour-specific copy, and
  a test asserts each one identifies itself as demonstration material.
- `ensureDemoActor(key)` creates on demand into a folder named `Essence20 Tours`, flagged
  `flags.essence20.tourDemo = true`, and reuses an existing one rather than duplicating.
- `cleanupDemoActors()` deletes everything carrying that flag, called from overridden `exit()` and
  `complete()` — plus once on `ready` via `sweepTourDemoContent()` as a crash-recovery sweep, so a
  hard refresh mid-tour doesn't leave litter behind.

**Why not a compendium pack.** Two things surfaced while building the first actor. An exported
demo actor is ~37KB of mostly schema defaults, none of it meaningful to review or hand-edit. And
an attached item's entry in its parent's `system.items` carries a `uuid` of the form
`Actor.<actorId>.Item.<itemId>`; imported from a pack the actor gets a *new* id, so every one of
those uuids goes stale and the delete-sync in `attachment-handler.mjs` stops matching. Built at
runtime they are correct by construction. (A third, smaller point: Foundry refuses
`FilePicker.upload` into `systems/`, so there is no clean way to write pack source from a running
client — the JSON would have to be moved out by hand.) A pack remains easy to add later if demo
content ever needs to be editable without touching JS.

**Attachments need both halves.** The system models an attachment twice over and the sheet needs
both: the child is a normal embedded item flagged with `parentId` and a short `collectionId`, *and*
the parent carries a snapshot of it under `system.items[collectionId]`. The flags alone produce a
child that exists but renders as a loose top-level row. Snapshot with `child.system.toObject()`,
not `deepClone` — only the plain-object form survives the round trip through the parent's
`ObjectField`. Build attachments one at a time, after their parents exist: each re-reads its
parent's `system.items`, so running them in parallel has them overwrite each other.

**Field vocabularies that fail silently.** A data model rejects an invalid *document*, not just
the bad field — Foundry logs a validation error and the item simply never appears on the actor,
with nothing thrown for the caller to catch. Two cost real debugging time: Role `essenceLevels`
and `perkLevels` want `"level2"`, not `"2"` or `2`; and a weapon effect's `classification.style`
is one of `melee`/`energy`/`explosive`/`projectile`, so `"ranged"` rejects the whole update
*including its valid siblings*. `demo-content.test.js` pins both.

**Permission fallback.** Only users with actor-create rights can provision demos. For everyone
else, `demo-content.mjs` falls back to the first actor of the required type the user owns.
`canStart` then becomes:

```js
get canStart() {
  return game.ready && (Actor.canUserCreate(game.user) || !!this._findFallbackActor());
}
```

…and a leading centered step states plainly what the tour is about to create, so nothing
appears in the user's world unannounced.

*Alternative considered and rejected:* rendering a `temporary: true` Actor's sheet. It avoids
touching the world, but form submission and every `actor.update()`-driven action (morph,
transform, perk use, rest) throw on an unsaved document, which kills most of the steps we
actually want to demonstrate.

### 2.4 Step actions (`actions.mjs`)

A small whitelist, each an `async (tour) => void`. These are the "show me how" moments a purely
declarative tour cannot reach:

`openSkillPicker`, `closeSkillPicker`, `rollSkill` (fires the sheet's `rollable` action for a
named skill, then awaits the Roll Options Dialog), `submitRoll` (awaits the resulting chat
card), `openCompendiumBrowser`, `openStoryPoints`, `openSheetOptions`, `morph`, `transform`,
`usePerk`, `createDemoItem`, `openItemSheet`, `toggleLock`, `rest`.

Each is a thin wrapper over the existing sheet action or handler, e.g.
`sheet.element.querySelector("[data-action='skillPicker']").click()` — deliberately driving the
same code path a user would, so a tour breaking is a genuine signal that the UI changed.

### 2.5 Detached windows — the v14 change that actually affects this feature

v14 lets **any** `ApplicationV2` be popped out into a separate browser window:
`app.detachWindow()` / `app.attachWindow()`, tracked in the
`foundry.applications.detached.windows` map (`Map<string, {window, applications}>`). A user who
has torn their character sheet off into its own window is a completely ordinary v14 user, and
every assumption a v13-era tour makes about `document` stops holding for them.

Core clearly anticipated tours here, and met us **half** way:

| Piece | Cross-document in v14? |
|---|---|
| `Tour.highlightElement()` | **Yes** — builds and appends via `element.ownerDocument` |
| `TooltipManager#activate()` | **Yes** — containment is checked against `element.ownerDocument.body`, and the tooltip node is moved across with `foundry.applications.detached.adoptNodes(element.ownerDocument.body, this.tooltip)` |
| `Tour#_getTargetElement()` | **No** — still a bare `document.querySelector` |
| `.tour-overlay` (input blocking) | **No** — `_renderStep` appends it to the main `document.body` |
| Centered step (`aside.tour-center-step`) | **No** — also appended to the main `document.body` |

So on v14 the tooltip and the highlight follow the target into a detached window, while the
input-blocking overlay stays behind in the main one. The step looks right and is not actually
modal.

**Our policy, in order:**

1. `_ensureApp()` calls `app.attachWindow()` on a detached target before the step runs. Pulling
   the sheet back into the main workspace is a visible, explicable thing to do at the start of
   a tour, and it restores every core assumption at once. The opening centered step says so.
2. If it is still elsewhere — a popped-out sidebar tab, a window we do not own —
   `_getTargetElement` falls back to scanning the detached documents (§2.2), so the step
   degrades to "correct but not modal" instead of "target not found".
3. Sub-apps get parented with `sheet.renderChild(app)` (also new in v14) so the Skill Picker
   and the Roll Options Dialog travel with their sheet instead of stranding a step across two
   windows.

Popped-out **sidebar** tabs need the same care and cannot be fixed the same way: on a popout,
`AbstractSidebarTab#activate()` only calls `bringToFront()` — it does not return the tab to the
sidebar. A `sidebarTab` step therefore has to tolerate the tab simply not being in the sidebar,
which is one more reason those steps are the ones worth marking `optional`.

---

## 3. The tour catalogue

Phased so each phase is independently shippable. `suggestedNextTours` chains them in order.

### Phase 1 — Orientation (no demo content needed)

1. **`welcome`** — `SidebarTour`-style. What Essence20 is, the sidebar, the Items/Compendium
   tabs, the system's Compendium Browser footer button (`.essence20-open-compendium-browser`,
   added by `addCompendiumBrowserFooterButton` in `essence20.mjs`), the Story Points toggle in
   the token scene controls, and where Manage Tours lives. `display: true`, unrestricted.
2. **`system-settings`** — `restricted: true`. Settings tab → Configure Settings → the
   Essence20 section: the Story Points settings (`sptShow` / `sptAccess` / `sptPointsName` / …)
   and the **Enabled Sourcebooks** menu (`enabledSourcebooksMenu`), explaining that it drives
   real pack ownership via `syncSourcebookOwnership()`.
3. **`compendium-browser`** — open `Essence20CompendiumBrowser`
   (`#essence20-compendium-browser`), walk the tab strip, the filter panel
   (`[data-application-part='filters']`), the results list, the Sources sub-app, and dragging a
   result onto a sheet.

### Phase 2 — The character sheet (the core of the suite)

4. **`character-sheet`** — the anatomy tour. Header (`.sheet-header`): portrait, name, size,
   Faction, **Level**, Role, Focus, Origin, colour picker. The titlebar lock toggle and the
   `sheetOptions` gear. Sidebar (`.essence20-sidebar`): the Resources panel
   (`.essence20-sidebar-resources` — health, stun, Energon / Personal Power, Role Points,
   Rest/Recharge), the Special panel (`.essence20-sidebar-special` — initiative with its skill
   select, Transform, Morph, the "any"-essence skills, the Wealth Die), Speeds, Defenses,
   Immunities/Resistances. Then the tab strip itself.
5. **`skills-and-essences`** — Skills tab. The four essence columns (`.essence-column`),
   essence value/max, the skill-rank allocation readout and its paired defense, Conditioning, a
   skill row and what the shift dropdown means. Then `action: openSkillPicker` → the Skill
   Picker app (`.skill-picker`): ranks, Essence spend tracking, specializations, and the PC vs
   NPC differences.
6. **`making-a-roll`** — `action: rollSkill` → the **Roll Options Dialog** (`#roll-options`).
   This is the showcase step: edge/snag, difficulty, and the automatic-modifier **sources**
   list, where each shift/edge/snag is labelled with the Perk or effect that granted it (the
   `addSource(...)` mechanism). Then `submitRoll` → the chat card
   (`templates/chat/check-card.hbs`): critical success/failure highlighting, the difficulty
   line hidden from non-GMs, and the reroll / Spite / Suffer / Exploit Weakness buttons the
   system injects.
7. **`gear-and-weapons`** — Gear tab. The Training block, then the collapsible containers:
   create a weapon (`[data-action='itemCreate'][data-type='weapon']`), expand it, add a **Weapon
   Effect** and an **Upgrade** via the extra-controls icons, roll the weapon effect, then armor,
   shields (equip plus activation toggles), gear, alterations and magic baubles.
8. **`perks-and-roles`** — Perks tab. Dropping a Role, the Level field driving `onLevelChange`,
   granted-level badges (`.leveled-item-badge`), Role Points and spending them, perk `perkUse`
   buttons, banked buffs, and Origin/Influence perks over in Background.

### Phase 3 — Signature subsystems

9. **`powers-and-morphing`** — Powers tab, Personal/Sorcerous Power pools, the Power Cost
   Selector, `morph`/`unmorph`, Power Infusion, Grid Power. Steps that depend on
   `system.canMorph` are marked `optional`.
10. **`transformers`** — the `canTransform` demo actor: Alt Mode tab, the mode selector on gear
    rows (`mode-selector.hbs`), `transform`, the Energon tracks, Recharge.
11. **`vehicles-zords-megaforms`** — Vehicle sheet (Crew tab, the Vehicle Role Selector,
    crew-driven stats), Zord sheet (Zord Features, Mega Weapon, Warrior Mode), Megaform sheet
    (Combiners tab, participants, Megaform damage).
12. **`active-effects`** — the Effects tab on both an actor and an item: create / edit / toggle
    / delete, the Conditions ActiveEffect pack, and how effects feed the defense, health and
    movement math. **Write this one against the v14 model, not v13's**: changes live on
    `effect.system.changes`, the numeric `change.mode` is now a string `change.type`
    (`add` / `subtract` / `upgrade` / `downgrade` / `custom`), and effects apply in two phases
    (`initial` / `final`). `effect.changes` and `CONST.ACTIVE_EFFECT_MODES` still work but are
    shimmed and deprecated (`since: 14, until: 16`), so tour copy that teaches them teaches
    something scheduled for removal. This tour should not ship before the system's own Active
    Effects v14 migration lands — see `docs/ACTIVE_EFFECTS_UI_PLAN.md`.
13. **`npcs-and-combat`** — NPC sheet versus PC sheet, Contacts, rolling initiative from the
    sidebar, the Combat Tracker, applying conditions/statuses, and the system's turn-start and
    turn-end automation (stun healing, regeneration, expiring activations).

### Phase 4 — GM and authoring

14. **`story-points`** — unrestricted but GM-focused: the tracker app (`#story-points`), GM
    versus player pools, granting and spending, and the `SETTINGS_MODIFY`-permission model that
    lets non-GM players modify points.
15. **`item-authoring`** — the Item sheet: Description / Details / Effects tabs, the item types,
    and how granted items and attachments (weapon effects, upgrades) are modelled.
16. **`enrichers-and-macros`** — the `@Check[...]` enricher in journals and chat, click-to-roll
    and send-to-chat, and dragging an item to the hotbar to build a macro (`rollItemMacro`).

---

## 4. Discoverability

> **Built 2026-09-16.** Three notes from doing it. (1) In v14 a `window.controls` entry is *not*
> a visible titlebar button — it lands in the `⋮` context menu beside Sheet Options, rendered as
> `menu.context-items` **outside** the sheet's own element and wired by callback rather than
> `data-action`. That is fine for a "find it again" affordance, but it means the chat card and the
> README are doing the real discovery work, not the control. (2) The control's `visible` callback
> is keyed on `TOUR_BY_ACTOR_TYPE`, so it hides itself on npc/vehicle/zord/megaform sheets until
> those tours exist, rather than promising a walkthrough that is not there — verified false on all
> four. (3) No control was added to `Essence20ItemSheet` yet: there is no item tour to point it at
> until PR 7's `item-authoring`, and a permanently-hidden control is dead code.
>
> One bug worth remembering: Foundry styles headings and buttons inside a chat message for a light
> ground (`#222`, `#111`), but a message carries its own `theme-dark`/`theme-light` class. The
> offer card's heading and button therefore rendered dark-on-dark and were effectively invisible.
> Both now take `color: inherit` from the message. **Anything the system injects into a chat
> message needs checking against both themes.**

Tours nobody finds are wasted. Three cheap hooks:

1. **Sheet header button.** Add a `window.controls` entry to
   `Essence20BaseActorSheet.DEFAULT_OPTIONS`, beside the existing `sheetOptions` gear:
   `{ icon: "fas fa-circle-question", label: "E20.TourSheetHelp", action: "startTour" }`, whose
   handler starts the tour matching `this.actor.type`. Same on `Essence20ItemSheet`.
2. **First-run prompt.** In `Hooks.once("ready")`, if `essence20.welcome` is `UNSTARTED` and a
   new world setting `tourWelcomeOffered` is false, post a self-dismissing chat card (the
   pattern core's `NewUserExperienceManager` uses) offering to start it, then set the flag.
   Never auto-start — a tour that hijacks the screen on login is hostile.
3. **A "Tours" section in `README.md`** listing the suite and pointing at Settings → Manage
   Tours.

---

## 5. Localization

Every `title` / `content` / `description` is an i18n key, never literal text — consistent with
the rest of the system. Add a `Tours` block under the existing `E20` namespace in
`lang/en.json`:

```json
"E20": {
  "Tours": {
    "CharacterSheet": {
      "Title": "The Character Sheet",
      "Description": "A guided tour of the Essence20 character sheet.",
      "Header": { "Title": "…", "Content": "…" }
    }
  }
}
```

Referenced from the tour JSON as `E20.Tours.CharacterSheet.Header.Title`. Multi-paragraph copy
uses literal `\n` in the JSON string, since core splits on it. Do **not** use the per-tour
`localization` config field — it writes into `game.i18n._fallback`, which bypasses the normal
translation workflow and cannot be overridden by a translation module.

Core resolves these keys through v14's `_loc()` global. Now that the floor is v14 we *may* use
it too, but the rest of the system is written against `game.i18n.localize` / `game.i18n.format`,
which are not deprecated — so tour code matches its neighbours rather than introducing a second
idiom for the same job. See §10.2.

---

## 6. Styling

**Build the CSS expanded, not compressed.** `css/essence20.css` is tracked, and the committed
copy is sass's *expanded* output. `npm run sass` passes `-s compressed`, which collapses the file
to a single line and produces a 4687-deletion diff on a generated file — the cross-branch
conflict hazard noted in the worktree setup. Running the standalone binary without `-s compressed`
(`sass ./sass/essence20.scss ./css/essence20.css`) reproduces the committed format, so adding the
tour partial shows up as a clean 120-line addition and nothing else. Worth reconciling the
`package.json` script with the committed format separately; until then, don't use it on a branch.


Core ships `.tour`, `.tour-center-step`, `.tour-fadeout` and `.tour-overlay`, and applies
`themed theme-dark` to the tooltip unconditionally. Add `sass/components/_tours.scss` (`@use`d
from the components index) to give tour tooltips the system's own `--theme-*` variables and
sliced-border treatment, so they read as Essence20 rather than core. Leave the `.tour-overlay`
z-index alone. Rebuild with the standalone `sass` binary via `npm run sass`.

---

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Selectors rot as templates change | Every selector lives in JSON, not code; §8's smoke test fails loudly on a missing target. Prefer `data-action` / `data-tab` / `name` attributes over presentational classes. |
| Async renders miss the target | `_preStep()` awaits; `waitFor` + `timeout` + `optional`. |
| Conditional UI absent on the demo actor | Purpose-built demo actors guarantee `canMorph` / `canTransform` / Role Points exist; anything still conditional is marked `optional`. |
| Demo actors left behind after a crash | Flag-based sweep on `ready`, plus cleanup in `exit()` / `complete()`. |
| A tour litters a live game world | Never auto-start; demos go in one clearly named folder; an explicit first step says what will be created. |
| A sheet is in a detached window (v14) | `_ensureApp()` re-attaches it first; failing that, `_getTargetElement` scans detached documents so the step still resolves (§2.5). |
| v14 Active Effects reshape | Tour 12 is written against `system.changes` / `change.type` / two-phase application, and is gated behind the system's own AE migration. |
| Foundry v15+ | The Tour API was stable across the whole v13→v14 transition, so the risk is low. The exposure that does exist is the deprecated Active Effects shapes (removed in v16) that tour 12 must avoid teaching, and core's still-moving Manage Tours markup — both already handled. |

---

## 7a. What the first playtest actually broke (2026-09-16)

PR 1's `welcome` tour was run end to end on v14 build 364. All ten steps now resolve with zero
`target element ... was not found` warnings and the highlight exactly on target. Getting there
turned up three defects, two of which were not in the risk table:

1. **Highlight drift is not theoretical — it is the default.** Step 3 activates the Actors
   sidebar tab, which *expands* the sidebar and slides the tab strip ~300px left. Core measures
   the cut-out once, during `_renderStep`, so the highlight landed at x=971 for a target at
   x=676: a bright rectangle over empty space, 300px from the thing it was describing. Fixed by
   `_settle()` (wait until the target's box stops changing before core measures) plus
   `_repositionHighlight()` as the safety net. **Any step that changes layout — a tab switch, a
   sheet opening, an accordion expanding — has this problem**, so `_settle()` matters far more
   for the sheet tours in Phases 2-3 than it did here.
2. **`querySelector` happily returns an invisible element.** The system renders the Compendium
   Browser button into *both* the Items and Compendium directory footers. Document order put the
   Items copy first, and because an inactive sidebar tab keeps its markup at zero size, core
   highlighted a 0x0 box in the top-left corner. Fixed by `_pickVisible()`, which prefers a
   laid-out match. This will recur constantly on sheets, where every inactive tab's markup stays
   in the DOM — prefer a scoped selector *and* rely on `_pickVisible` as the backstop.
3. **`requestAnimationFrame` does not fire in a hidden tab**, so the first `_settle()` hung the
   tour permanently when the window was backgrounded. Fixed by racing each frame against a 50ms
   timer. Worth remembering for anything else in the tour path that waits on a frame.

Two smaller corrections: tour copy must use the labels v14 actually shows (the button is
**Tour Management**, not "Manage Tours"), and a step that introduces the sidebar should expand it
first — collapsed, it is a 40px icon strip, and later steps expand it anyway, so the tour would
otherwise visibly jump open one step after introducing it.

### PR 3's playtest (the sheet tours)

All 33 steps across the three tours resolve with zero warnings and zero drift, and a completed
`making-a-roll` leaves the world byte-identical: same actor count, same message count, no folder.
Four things worth carrying into the later tours:

1. **`_ensureApp` runs before `action`, which constrains step design.** A step cannot both open
   something via an action *and* scope its selector to it, because `app` is resolved first. Apps
   that only exist once something has been clicked therefore need their own opener —
   `_ensureSkillPicker()` and `_ensureRollDialog()` — rather than an action. Anything that must
   happen *before* an app opens (applying a condition so the roll dialog has a modifier to show)
   goes on the preceding step.
2. **Some apps are instantiated per document.** The Skill Picker's id is
   `essence20-skill-picker-<actorId>`, so it cannot be looked up from a static key.
3. **Demo data has to be internally coherent, not merely valid.** The first demo character was
   massively over its skill-rank budget (Speed 12/4), so the Skill Picker sat there flagging
   `.skill-rank-over-budget` through the entire tour explaining budgets. Ranks now total exactly
   each Essence's value.
4. **A tour that rolls leaves chat messages behind.** The demo actor is deleted, so without
   cleanup the log keeps cards attributed to a character that no longer exists. `submitRoll` flags
   its message and teardown deletes it.

One correction to this plan's own §3: a plain skill roll's chat card has **no** critical
highlighting and **no** reroll buttons — those belong to check cards (attacks with a difficulty).
Tour 6's copy describes what the card actually shows and names the extras as things attack rolls
add, rather than promising them.

### PR 4's playtest (gear and perks)

All 22 steps across both tours resolve with zero warnings and zero drift, and the
`suggestedNextTours` chain was confirmed working in practice (finishing `gear-and-weapons` offers
`perks-and-roles`). Three things worth carrying forward:

1. **`:has()` is the way to target these containers.** The Gear and Perks tabs are built from a
   shared `collapsible-item-container` partial with no per-section identifier, so "the Weapons
   section" or "the Role section" has no direct hook. Rather than `nth-of-type`, which would break
   the moment a section is reordered or hidden, each step selects on something semantically true
   of that section: `:has([data-action="itemCreate"][data-type="weapon"])` for Weapons, and
   `:has(.leveled-item-badge)` for the Role perks section, which is the only one whose entries
   carry a level. Verified that each resolves to exactly the intended element, not merely to *an*
   element.
2. **The demo character needed enriching before these tours were worth taking.** The Perks tab's
   Influence, Origin and Role sections were all empty and no level badge existed, because the demo
   Role granted nothing. Perks now attach to the Role, Origin and Influence that grant them —
   which is the same attachment mechanism weapon effects use, with a `level` added to the parent's
   snapshot to produce the badge — and a `rolePoints` item gives the sidebar a Role Points pool.
### PR 6's playtest (subsystem tours)

All ten tours now walk end to end with zero warnings and a world left byte-identical. Two real
bugs surfaced, both of which had been latent since PR 1 and neither of which any earlier playtest
could have caught:

1. **`optional` did not actually work.** Core's `_renderStep` throws
   `The expected targetElement ... does not exist` whenever a step's selector resolved to nothing,
   and `progress()` turns that into exit-and-rethrow — *before* the skip logic in the `progress()`
   override ever runs. So an optional step whose target was genuinely absent killed the tour
   outright, which is precisely the case `optional` exists to handle. Every optional step in PRs
   1–5 happened to have a target, so it never fired. `_renderStep` now returns early for an
   optional step with no target, leaving it un-rendered so `progress()` can advance past it.
   Verified by pointing an optional step at a selector that cannot match: the tour skips step 6,
   goes 5 → 7, and completes.
2. **Teardown raced the next tour.** `exit()` is synchronous in core, so `#teardown()` runs
   fire-and-forget — and it deleted the demo actor that the *next* tour had already created. This
   is exactly what `suggestedNextTours` chaining does, so it would have hit real users the moment
   they accepted a "continue to the next tour?" prompt. Teardown now yields a tick and bails if a
   tour is in progress; the incoming tour cleans up when it finishes, and the `ready` sweep is the
   backstop.

Smaller notes: the Alt Mode tab's class is `.tab.altmodes` (plural) while its data attribute is
`data-tab="altmode"` — another reason these tours target `section[data-tab="..."]` rather than
classes. Note the `section` prefix matters: a bare `[data-tab="powers"]` also matches that tab's
nav *button*.

### The machines tour, and the race it finally forced out (2026-09-16)

`vehicles-zords-megaforms` needed three new demo actors, and building them turned up two things
worth keeping.

**Actor-to-actor links needed a new mechanism.** A vehicle's crew and a Megaform's constituent
Zords both live in `system.actors`, keyed by a short id, each entry holding the participant's
*uuid*. That makes them a runtime link — the participants must exist first — so a static
definition cannot express one. `DEMO_ACTORS` entries now take a `participants` array of other
demo keys, and `linkParticipants()` resolves each (recursively, with a cycle guard) after the
actor is created. This matters most for the Megaform, which derives its Essences, defences,
movement and combined-health breakdown from its participants and renders as an empty shell
without them. Two other specifics: non-PC types take their Health maximum from the flat
`system.health.origin` field, since `health.max` is derived and setting it does nothing; and the
combining rules are genuinely not sums — Strength and Speed take the *highest* participant,
movement the *slowest*, and Health stays per-Zord with a combined total displayed alongside.

**The teardown race was never actually fixed, only narrowed.** PR 6's fix made `#teardown()` yield
a tick and bail if a tour was in progress, which covered `suggestedNextTours` chaining. It did not
cover the gap *between* tours, where no tour is active and the outgoing cleanup is free to delete
what the incoming one has just created. Running all fourteen tours back to back surfaced it, and
it moved to a different tour on each run depending on how long provisioning took — the signature
of a race, not a broken selector. The real fix is in `demo-content.mjs`: every provisioning and
every cleanup now goes through a single promise queue, so the two can never interleave regardless
of what schedules them. `tour-lint` also awaits a cleanup of its own between tours rather than
sleeping a fixed 250ms, which joins that queue behind the outgoing teardown and makes the
ordering total.

**One bug that had been visible in every screenshot since PR 2**: every demo actor's `img` pointed
at `assets/icons/actors/`, a directory that does not exist, and three item icons named files that
exist under a different name (`power.svg` → `powers.svg`, `alt_mode.svg` → `altmode.svg`, no
`weapon.svg` at all). Nothing throws for a missing image — Foundry just renders a broken-image
glyph — so it survived six playtests until a Megaform participant card happened to show the icon
at a readable size. `demo-content.test.js` now walks the definitions and asserts every
`systems/essence20/...` path exists on disk.

---

3. **Perk "use" buttons cannot be demonstrated with original content.** `canUsePerk()` matches on
   a known set of compendium Perk ids (`flags.core.sourceId` / `_stats.compendiumSource`), with no
   generic `canActivate` branch, so no hand-authored demo Perk will ever render one. The tour
   describes the button in prose on the General Perks step instead of pointing at one that is not
   there. Tying the demo actor to a real sourcebook Perk was rejected: those packs can be disabled
   per-world by the Enabled Sourcebooks setting, so the step would break for exactly the GMs who
   had trimmed their pack list.

---

## 8. Testing

- **Jest (`module/tours/*.test.js`)** — `module/tours/` is outside `collectCoverageFrom`, so
  these are for confidence, not the coverage gate. Worth testing the pure logic: the
  step-grammar resolver, `optional`-step skipping, the selector-scoping rule, and
  `demo-content`'s fallback-actor selection. Run directly on Windows:
  `node --experimental-vm-modules ./node_modules/.bin/jest module/tours`.
- **JSON validation** — extend the CI JSON check proposed in `QA_PLAN.md` §1 to `tours/*.json`:
  valid JSON, every `title` / `content` / `description` resolves to a real key in
  `lang/en.json`, every step has a unique `id`, and `display` is present.
- **Manual smoke pass (per release)** — add to `RELEASE_CHECKLIST.md`: run every tour end to end
  on **v14**, in a fresh world, once as GM and once as a player, with the browser console open.
  The pass condition is **zero `Tour [...] target element "..." was not found` warnings** and
  zero `logCompatibilityWarning` output from anything the tour drove.
- **Detached-window pass** — one run with the character sheet detached (`app.detachWindow()`, or
  the window-control the user would use) before starting `character-sheet`. Expected: the sheet
  is pulled back into the main workspace and the tour proceeds normally. This is the v14 case
  most likely to regress silently, because a v13-era selector assumption fails only for the
  subset of users who pop their sheets out.
- **`tour-lint` — built.** `module/tours/tour-lint.mjs` walks every registered tour in a live
  client and reports steps whose selector resolves to nothing, steps never reached, and any error
  that aborted a tour. It snapshots and restores `core.tourProgress` so running it does not wipe
  the user's place, and cleans up demo content afterwards. Run it from the console:

  ```js
  const { lintTours } = await import("/systems/essence20/module/tours/tour-lint.mjs");
  await lintTours();
  ```

  Full pass, 2026-09-16: **14 tours, 125 steps, zero unresolved, zero skipped, zero errors**, world
  identical before and after.
  It takes a couple of minutes — each tour provisions and tears down its own demo content — so it
  belongs in the release checklist rather than in a watch loop.

  Note what it cannot tell you: that the copy reads well, that a tooltip sits somewhere sensible,
  or that a step points at the *right* element rather than merely a matching one. Two real bugs in
  this suite were of that last kind — a step matching a hidden duplicate, and one matching another
  user's chat message. Keep the one hand-played tour in the checklist alongside it.

---

## 9. Suggested delivery order

| PR | Contents |
|---|---|
| 1 | `Essence20Tour` base class, `index.mjs`, `setup` registration, `welcome.json`, the lang block and `_tours.scss`. One working tour proves the whole pipeline. |
| 2 | **Built.** `demo-content.mjs` (runtime-built demo actors), `canStart` gating, teardown on exit/complete, `sweepTourDemoContent()` on ready, and `demo-content.test.js`. |
| 3 | **Built.** `character-sheet` (13 steps), `skills-and-essences` (11), `making-a-roll` (9); `rollDialog` / `skillPicker` app resolution, `applyDemoImpaired` / `submitRoll` actions, and chat-message teardown. |
| 4 | **Built.** `gear-and-weapons` (12 steps), `perks-and-roles` (10); demo character enriched with Role Points and Role/Origin/Influence-granted Perks. |
| 5 | **Built.** Titlebar help control (`TOUR_BY_ACTOR_TYPE`, hidden where no tour exists), the once-per-world `offerWelcomeTour()` chat card, and a Guided Tours section in the README. |
| 6 | **Partly built.** `powers-and-morphing` (6), `transformers` (7), `active-effects` (9), `npcs-and-combat` (7), plus a `transformer` demo actor and demo ActiveEffect/Power. `vehicles-zords-megaforms` (12 steps) followed, with Vehicle, Zord and Megaform demo actors and a `participants` mechanism for actor-to-actor links. |
| 7 | **Built.** `story-points` (7), `item-authoring` (7), `enrichers-and-macros` (5); `tour-lint.mjs`; a Guided Tours section in `RELEASE_CHECKLIST.md`; and the item-sheet help control PR 5 deferred. |

Each PR is independently useful: an incomplete suite is still a working suite, because Manage
Tours only lists what is actually registered.

---

## 10. Foundry v14 verification pass

Re-read against the local **v14 build 364** source. Everything §1 claims still holds:

| Fact this plan relies on | v14 status |
|---|---|
| `TourConfig`: `namespace`, `localization`, `restricted`, `display`, `canBeResumed`, `suggestedNextTours` | all present, `client/nue/tour.mjs` lines 24-38 |
| `localization` merged into `game.i18n._fallback` at construction | unchanged (`tour.mjs:56`) |
| Step `content` split on `\n` and emitted triple-stashed, so raw HTML works | unchanged (`tour.mjs:466-467`; `templates/apps/tour-step.html:8` is `{{{this}}}`) |
| Progress stored per-user in the core setting `core.tourProgress` | unchanged (`tour.mjs:545-558`) |
| `_preStep()` override point | unchanged (`tour.mjs:438`) |
| `SidebarTour` / `CanvasTour` / `SetupTour` subclasses | all present under `client/nue/tours/` |
| `ToursCollection#register(namespace, id, tour)` | unchanged |

**No v14 blockers in the Tour API itself.** A full `diff` of v13's and v14's
`client/nue/tour.mjs` returns only three things: `game.i18n.localize`/`format` calls swapped
for the new `_loc` global, the inline fade-element geometry extracted into
`Tour.highlightElement()`, and nothing else. `tours-collection.mjs`, `sidebar-tour.mjs`,
`canvas-tour.mjs` and `templates/apps/tour-step.html` are byte-identical between the two.

### 10.1 v14 APIs this plan deliberately uses

- **`Tour.highlightElement(element, {padding, preventInteraction})`** (`tour.mjs:586`) — the
  public static `_renderStep` itself calls. §2.2's `_repositionHighlight()` reuses it instead
  of re-deriving the geometry, which also gets us `ownerDocument` correctness for free.
- **`foundry.applications.detached`** — the window registry behind §2.5.
- **`ApplicationV2#attachWindow()` / `#detachWindow()` / `#renderChild()`** — re-attaching a
  popped-out sheet, and parenting sub-apps to it.

### 10.2 v14 APIs this plan deliberately passes on

- **`_loc()`** — v14's new global alias for `game.i18n.localize`, which also absorbs
  `game.i18n.format`'s data argument. Available to us now that the floor is v14, and it is what
  core uses internally everywhere. We still don't use it: the other ~50 files in `module/` all
  call `game.i18n.localize` / `game.i18n.format`, neither is deprecated, and a lone file using a
  different idiom for the same job costs more in consistency than it saves in characters. Worth
  revisiting as a whole-system sweep, not one feature at a time.

### 10.3 Selector cautions

v14 added a batch of sidebar tabs that did not exist in v13 — `ambient-light-tab`,
`ambient-sound-tab`, `drawing-tab`, `note-tab`, `placeable-directory`, `placeable-tab`,
`region-tab`, `tile-tab`, `token-tab`, `wall-tab`. Sidebar structure is the part of the UI most
likely to differ from any v13-era selector, so §8's smoke test matters most for the
sidebar-anchored steps.

The Manage Tours window's own title key also moved (`SIDEBAR.SETTINGS.ACTIONS.Tours` →
`TOURS.Title`). Nothing we depend on, but a reminder that this corner of core is still moving,
and a reason to anchor steps on `data-*` attributes rather than on core's markup.
