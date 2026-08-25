# Essence20 Manual Regression Checklist

Run this before tagging a release, per [QA_PLAN.md](QA_PLAN.md) §4. It exists because most of the
UI (ApplicationV2 sheets, drag-and-drop, dialogs) and the async orchestration in
`module/sheet-handlers/` isn't covered by the Jest unit suite — see QA_PLAN.md for why (that
layer is Quench/manual territory, not mocked-unit-test territory). Check off each row; if
something's broken, note the actor/item/version combo that triggered it before fixing.

**Setup**: load a scratch world on the version under test (don't use a real campaign world).
Enable each of the base game versions if the world doesn't already have them (GI Joe, My Little
Pony, Power Rangers, Transformers) — several checks below are version-specific.

## 1. Automated sheet smoke test

- ☐ Run [`macros/smoke-test.js`](../macros/smoke-test.js) (see its header comment for how) in a
  scratch world. It creates and opens one Actor of every type and one Item of every type, watches
  for render errors, and cleans up after itself. Confirm it reports 0 failures - read the detail
  column for any failure before assuming it's a real bug (e.g. a Zord failure in a world missing
  the `pr_crb` compendium is an environment issue, not a code regression).
- ☐ While the macro is running, spot-check that a couple of tabs on the Player Character and
  Vehicle sheets are actually clickable (the macro only confirms initial render, not that every
  tab's content is reachable).

## 2. Role assignment (Player Character)

The Role system drives essence/health/skill-die math (`module/sheet-handlers/role-handler.mjs`) —
high regression risk any time that file or `documents/actor.mjs`'s derived-data prep changes.

- ☐ Drag a Role from a compendium onto a fresh Player Character. Confirm: essence max/value
  increase per the Role's `essenceLevels`, health bonus updates if the Role grants one, and (if
  the Role uses a skill die) `roleSkillDie` gets set to a starting shift.
- ☐ Level the actor up by a few levels (change `system.level` directly or via the sheet). Confirm
  essence/health/skill values increase again, not double-counted and not skipped.
- ☐ Level the actor back down. Confirm the same values decrease back out cleanly (this exercises
  `roleValueChange`'s "leveling down" branch — the one most likely to drift out of sync with
  leveling up if someone edits one path without the other).
- ☐ Delete the Role from the actor. Confirm essence/health bonuses are removed and any
  Role-granted Perks/Points are cleaned up.
- ☐ Power Rangers version: assign a Power Rangers Role, confirm `canMorph` turns on and a Morph
  button appears.
- ☐ My Little Pony version: assign an MLP Role, confirm the essence-progression-rank dialog
  appears and `canSpellcast` turns on.
- ☐ GI Joe version: assign a GI Joe Role, confirm `canQualify` turns on.

## 3. Focus (Player Character)

- ☐ Drag a Focus with a single Essence onto an actor that has a matching Role — should apply
  immediately without a dialog.
- ☐ Drag a Focus with multiple Essence options — should prompt an Essence-selection dialog.
- ☐ Try dragging a second Focus onto an actor that already has one — should be blocked with an
  error notification ("Actors can only have one Focus").
- ☐ Try dragging a Focus whose parent Role doesn't match the actor's current Role — should be
  blocked with a role-mismatch error.
- ☐ Delete the Focus. Confirm the essence bonus it granted is removed (floored at 0, not negative).

## 4. Origin & background (Player Character)

- ☐ Drag an Origin onto a fresh actor. Confirm starting health updates, and (if the Origin offers
  a choice) the essence/skill selection prompt appears.
- ☐ Delete the Origin. Confirm health drops back to the pre-Origin baseline.

## 5. Alterations (Player Character)

- ☐ Drag an Alteration that costs movement. Confirm the movement-cost flow completes and the
  actor's stats update.
- ☐ Drag an Alteration that grants a bonus skill / costs a skill (the essence/skill-selection
  dialogs). Confirm both dialogs appear and resolve correctly.
- ☐ Delete an Alteration. Confirm its bonuses are removed.

## 6. Perks & Role Points

- ☐ Drag a stand-alone Perk onto an actor (not via a Role). Confirm it attaches with no `role`
  value set (regression check for the `perk + perk` branch of `createEntry`).
- ☐ Drag a Perk with "advances" (area/damage/die/number/rerolls/upshift type) and change its
  advance value. Confirm the Perk's displayed name updates with the formatted suffix (e.g.
  `Perk Name (+3 Damage)`).
- ☐ Find a Role Points item with a non-`none` bonus type (health/defense/attack-upshift/etc.) on
  an actor and confirm its bonus `value` actually computes to a nonzero number — this exercises
  the `_prepareRolePoints` bonus-type comparison fixed this cycle
  ([item.mjs](../module/documents/item.mjs)); a Role Points item with bonus type `none` should
  show *no* computed bonus value.

## 7. Combat & rolls

- ☐ Roll a skill from the sheet (with and without Edge/Snag, with a shift up/down). Confirm the
  roll dialog options apply and a chat message posts with the right formula.
- ☐ Roll a weapon attack (`weaponEffect` item). Confirm it posts to chat and, if the weapon is
  linked to a Class Feature with limited uses, the Class Feature's use count decrements.
- ☐ Roll initiative. Confirm the formula matches the actor's initiative skill/shift.
- ☐ Roll a Spell / Magic Bauble (essence-costing rolls). Confirm the essence cost is applied.

## 8. Transform / Morph (version-specific)

- ☐ Transformers actor with one Alt Mode: click Transform, confirm bot-mode ⇄ alt-mode toggles,
  the image/token swaps, and movement stats switch to the alt-mode values.
- ☐ Transformers actor with multiple Alt Modes: click Transform, confirm the alt-mode choice
  dialog appears instead of toggling directly.
- ☐ Delete the currently-active Alt Mode: confirm the actor reverts to bot-mode automatically.
- ☐ Power Rangers actor: click Morph, confirm the token image swaps and defenses switch to
  morphed values (armor bonus replaced by morphed bonus, per `_prepareDefenses`).

## 9. Vehicles

- ☐ Drag a Player Character onto a Vehicle and assign as driver. Confirm a second driver can't
  also be assigned while the driver seat is full (`verifyDropSelection`), but a passenger still
  can be if a passenger seat is open.
- ☐ Swap two occupants' roles (driver ⇄ passenger) via the crew UI. Confirm both entries flip
  correctly, not just one.
- ☐ Remove a crew member. Confirm their seat opens back up.

## 10. Attachment / upgrade system

`createEntry` (`module/sheet-handlers/attachment-handler.mjs`) has a large branch per
target-type/dropped-type combo — spot-check a few of the less common ones, since a broken branch
fails silently (item just doesn't attach) rather than throwing:

- ☐ Drag an armor Upgrade onto Armor — confirm the upgrade's armor-bonus/traits show up on the
  Armor's combined totals.
- ☐ Drag a weapon Upgrade onto a Weapon — same, for weapon traits.
- ☐ Drag a `weaponEffect` onto a Shield.
- ☐ Drag a Role Points item onto a Role.
- ☐ Build/drag an Equipment Package containing armor + gear + weapon items onto an actor, confirm
  all contained items come along.

## 11. Data migration spot check

If this release includes an actor-data migration (anything touching
`module/data/actor/templates/character.mjs` or similar `migrateData()` paths):

- ☐ Open an actor created on the *previous* released version (not a fresh one) and confirm
  essence max/value display correctly, not `NaN`/`undefined`/`0` after migration.

## Sign-off

| Reviewer | Foundry version | Date | Blocking issues found |
|---|---|---|---|
| | | | |
