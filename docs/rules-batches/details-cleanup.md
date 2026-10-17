# Item sheet Details-field cleanup (2026-10-07)

What was done with the audit in `details-audit.md` after the user approved it on 2026-10-07: 3 inputs
removed, and 4 fields moved into rules and then hidden. Every schema field stays in the data model,
marked `// Deprecated 2026-10-07: ... remove from the data model in 6.1.`

Nothing was committed and no packs were compiled. The pack source JSON was edited as text, and each
file kept its own line endings (78 CRLF, 1 LF: Calm Beast).

## Per field

### REMOVE 1: Perk `canActivate`
- **Sheet:** the checkbox is gone from `templates/item/details/perk.hbs`.
- **Schema:** `module/data/item/perk.mjs` keeps the field and has the deprecated comment. Power's
  `canActivate` is a separate field, still used, and was not touched.
- **Packs:** the key is gone from the 20 perks that set it to `true`.
- **Migration:** `migratePerkCanActivate` deletes a stored `true` from world items and embedded items.

### REMOVE 2-3: Alteration `bonus` / `cost` inputs (type `other`)
- **Sheet:** the two number boxes are gone from `templates/item/details/alteration.hbs`.
- **Schema:** both fields stay, because the essence-Alteration drop still writes the picked Skills
  into them. `alteration.mjs` has a comment saying so.
- **Packs and migration:** none needed. No pack item set them.

### HIDE 1: Perk / Power `reroll.*`
- **Rules:** each block became a `Reroll` rule built by `migration.mjs#legacyRerollRule`. The rule
  keeps the same settings and drops values that `normalizeRerollConfig` fills in anyway. The pack
  script and the world migration both use this one function. Coverage:
  - 49 perks plus Temporal Awareness.
  - Power Infusion, whose reroll came from its `advances.type == 'rerolls'` track. It now has a
    Reroll rule with `upTo: "@item.system.advances.currentValue"`, using its old cost and condition.
  - Lucky Charm and Future Vision. Their Trigger used to switch `system.reroll` on at run time. Now
    the Trigger sets a rule toggle (`setToggle luckyCharm`, or `updateItem` with
    `flags.essence20.rules.toggles.futureVision` plus `flags.essence20.futureVisionUses`), and the
    Reroll rule waits for that toggle (`when: self:toggle:...`). Future Vision's `maxUses` reads the
    uses flag.
  - The block is gone from all 53 pack items, plus one inert block that was switched off (Capable
    of Anything, WTNV).
- **Engine (`rules/types.mjs`):** the Reroll type now also takes `keepBetter` (bool) and `upTo`
  (formula). Before this, Backup Planner's `keepBetter` had no rule equivalent.
- **Engine (`rules/adapter.mjs#ruleRerollGrants`):**
  - An item's first Reroll rule counts its uses under `item:<uuid>`. That is the old key, and it is
    shared with Power Infusion's `rerollLimit` step. Any later Reroll rule on the same item keeps
    the `#ruleN` key.
  - `upTo` turns into `values` 1..N, with `[1]` when N is 0 or less. That is the old fallback.
  - A Skills-less rule on a `choiceType: 'skills'` Perk covers `system.choice` (Expertise, Trade
    Experience, Aptitude Augmenter), as the old loop did.
- **`mechanics/rolls/reroll.mjs#getRerollConfigs`:**
  - The item loop is gone, including the advances-type path.
  - Registered grants may now set their own `sourceType`.
  - `scopeToOriginSkill` is resolved for registered grants (It's A Gift).
  - Active Effects' `system.reroll` is still read.
- **Emotional Mastery (Guilt):** this used to switch the item's own `system.reroll` on and off. It
  is now a registered reroll grant, `guiltRerollGrants`, read from the holder's own active options:
  d20 ones, unlimited, recursive, same as before. `applyGuiltRerollToggle` is gone.
- **Removed code:** the `perk-handler` write of `system.reroll.skills` at drop (the rule reads
  `system.choice` instead), and the `item-sheet#_prepareSubmitData` splitting of the reroll-skills
  text box.
- **Sheet:** the whole reroll block (15 inputs) is gone from `perk.hbs`. The Power sheet never
  showed it.
- **Schema:** `perk.mjs` and `power.mjs` keep `...rerollSchema()` with the deprecated comment.
  `effect.mjs` still uses it for real.
- **Migration:** `migrateRerollFields`.

### HIDE 2: Perk `hasMorphedToughnessBonus`
- **Rules:** the 4 perks (It's Morphin Time!, Quantum Morph, A Guardian of Eltar!, Magna Power!) got
  two Trigger rules each:
  - `added`, running `refreshMorphedToughness`. That calls `setMorphedToughnessBonus`, which sets
    `canSetToughnessBonus: true` and the Morphed Toughness from Armor Training, as the drop did.
  - `removed`, running `updateActor` with `{canSetToughnessBonus: false, defenses.toughness.morphed: 0}`,
    which is exactly what `onPerkDelete` wrote.
- **Code:** both `perk-handler` branches are gone (`setPerkValues` and `onPerkDelete`).
  `setMorphedToughnessBonus` stays, because the step uses it.
- **Sheet:** the checkbox is gone.
- **Schema:** the field is kept and marked deprecated.
- **Migration:** `migrateMorphedToughness`.

### HIDE 3: Perk `value` (Fast MLP / PR, Expertise GI Joe)
- **Fast:** 5 `Movement` rules, one per Movement type, with `stage: 'bonus'`, `op: add`, value 10,
  and `when: rule:data:system.choice=<type>` plus `rule:data:flags.essence20.perkValueRule`.
- **Expertise (GI Joe):** a `DerivedStat` on `system.skills.{item.choice}.shiftUp`, add 2, also gated
  on `perkValueRule`.
- **Engine:** new Movement stage `bonus`. `documents/actor.mjs#_prepareMovement` applies it to every
  type's `bonus` before the main loop, so the Fast bonus sits exactly where the drop used to write
  it. Jury Rig and Lightfoil Wings read ground's `base + bonus`, and they still see it.
- **How double-counting is avoided:** copies are detected, and the rules apply only to copies
  flagged `perkValueRule`.
  - `onPerkDrop` no longer writes the bonus onto the actor. It stamps the flag, together with the
    pick, on any movement or skills pick.
  - An older copy that is not flagged keeps the bonus that was written into its actor, and the rule
    skips it. Totals stay the same even if the world migration never runs.
  - `migratePerkValue` takes the written-in value back off the actor's stored `movement.<pick>.bonus`
    or `skills.<pick>.shiftUp`, never below 0, flags the copy, and deletes `value`. After that the
    rule carries the bonus.
- **Delete handler:** it still takes a Movement value back off for an older, unflagged copy, now
  reading the stored bonus (`actor._source`), because the prepared bonus includes the rules'. A
  flagged copy writes nothing on delete, since its bonus goes away with its rule.
- **Not converted:** Transmetal's 40 and MLP Attack's 1. Nothing read them before, and they stay
  as they are.
- **Sheet:** the `value` input (shown for choiceType movement) is gone.
- **Schema:** the field is kept and marked deprecated. Its comment notes the delete handler still
  reads it for older copies.
- **Migration:** `migratePerkValue`. `migrateActorData` calls it with the actor's stored system and
  a running total. `migrateItemData` calls it for world and pack items, which have no actor to fix.

### HIDE 4: Upgrade `aimShiftBonus` (the 2 Laser Sights)
- **Rules:** `{type: AimBonus, label: "Laser Sight: Aim +1", scope: host, extra: 1}`. The engine's
  `ruleAimBonus` already took `extra` with scope host.
- **Removed code:**
  - `item.mjs#_prepareAimShiftBonus`, and with it the `totalAimShiftBonus` sum.
  - `dice.mjs#_getLaserSightBonus` and its term in `aimBonus`.
  - The `attachment-handler` snapshot of `aimShiftBonus` onto a weapon's entry.
  - The six actor-sheet chips that showed it (`templates/actor/parts/items/upgrade/details.hbs`).
- **Sheet:** the input is gone from `upgrade.hbs`.
- **Schema:** `upgrade.aimShiftBonus` and `weapon.totalAimShiftBonus` are both kept and marked
  deprecated.
- **Migration:** `migrateUpgradeAimBonus`.

## Migration functions (`module/migration.mjs`, end of file)

None of these is version-gated. Each one fires only while the old field still holds what the drop or
the sheet wrote, and it deletes that value as it goes. A rule is added only when the item's
effective rules don't already have one of its kind. Matching is by type plus settings (Reroll: any
self Reroll; Trigger: event plus step; Movement: stage bonus plus type; DerivedStat: path; AimBonus:
scope host), never by position. A re-run is therefore a no-op, and the tests check this.

| Function | What it does |
|---|---|
| `migratePerkCanActivate(item)` | Deletes a Perk's stored `canActivate: true`. |
| `migrateRerollFields(item, {inPack, update})` | Adds `legacyRerollRule(system)` and deletes `system.reroll`. Emotional Mastery, Lucky Charm and Future Vision carry their switched-on state over as toggle flags instead of becoming a rule. |
| `migrateMorphedToughness(item, ...)` | Adds the added and removed Triggers (`MORPHED_TOUGHNESS_RULES`) and deletes the flag. |
| `migrateUpgradeAimBonus(item, ...)` | Adds `AimBonus {scope: host, extra: N}` and deletes the field. |
| `migratePerkValue(item, {actorSystem, totals, rules, inPack})` | Adds `perkValueRules(choiceType, value)`, sets `flags.essence20.perkValueRule`, deletes `value`, and returns the actor-side subtraction. |
| `migrateDetailsFields(item, {inPack, perkValue})` | Runs all of the above, building on one pending `system.rules`. `migrateItemData` calls it at its end. |

Deletion and rule writes follow these rules:
- **Deletion:** a key is deleted with v14's `foundry.data.operators.ForcedDeletion`. The `-=key`
  form that was asked for is deprecated in v14 and no longer applied, as noted in
  `attachment-handler.mjs`. It is still the fallback when the operator is missing.
- **Inheriting copies (`rules/inherit.mjs`):**
  - A copy of a compendium item with no rules of its own runs its original's rules live. If the
    original already has the new rule, the copy is left alone.
  - Otherwise the copy gets the original's rules plus the new one as its own. This happens for a
    module or world pack's copy, or a system pack that hasn't been rebuilt yet. Adding only the new
    rule would cut off inheritance of all the others.
  - Items in a compendium never inherit (`inPack`; `migrateCompendium` passes it).
- **Pack index:** `compendiumEntryAt` shares the per-run pack-index cache with the existing
  action-type lookup. The index now also fetches `system.rules` and works for any
  `Compendium.<package>.<pack>` uuid.

## Tests

- **`module/migration.test.js`:** 28 new tests, covering each function's match and no-match cases,
  a re-run on the applied update (idempotence), inheritance with and without the rule, `inPack`,
  the run-time-state items, running totals and the clamp at 0, and pending rules being built on.
- **`module/mechanics/rolls/reroll.test.js`:**
  - The old item-loop tests are replaced. The item field is no longer read.
  - Parity tests feed the Reroll rule made from 7 representative old blocks, plus It's A Gift,
    Expertise and Power Infusion at advance 0, 1 and 2, through the real `getRerollConfigs`. Each
    one gives exactly the config the removed loop built, including `item:<uuid>`.
  - The Luck and Power Infusion pack rules are checked against the converter, and registered grants
    are checked for `sourceType` and `scopeToOriginSkill`.
- **`module/rules/rules.test.js`:** `ruleRerollGrants` (first-rule key, later-rule key, `upTo`, pick
  scoping, a toggle-gated rule), plus validation of `keepBetter`, `upTo` and Movement stage `bonus`.
- **`module/rules/details-cleanup.test.js`** (new):
  - The changed pack rules validate.
  - No pack still authors the old fields.
  - Fast through the real `Essence20Actor#_prepareMovement` gives the same totals and bonus as the
    old written-in +10, for ground, climb, swim and aerial. An unflagged copy adds nothing.
  - Expertise GI Joe gets its DerivedStat.
  - Both Laser Sights add Aim +1 on their own weapon only, and nothing while the weapon is unequipped.
  - The 4 Morphed Toughness perks behave on added and removed.
- **`module/rules/conv15-systems.test.js`:** Lucky Charm and Future Vision now check the reroll
  through `getRerollConfigs` (toggle, uses).
- **`module/items/resources/emotional-mastery.test.js`:** Guilt via `guiltRerollGrants`.
- **`module/sheet-handlers/perk-handler.test.js`:** the drop writes no bonus and stamps the flag. The
  delete takes an older copy's value off the stored bonus, and does nothing for a flagged copy or
  one with no pick.
- **`module/sheet-handlers/attachment-handler.test.js`:** no `aimShiftBonus` snapshot.

Checks run:
- eslint on every touched `.js` / `.mjs`: clean.
- `node scripts/check-rules.mjs`: 4276 rules, 0 errors and 0 warnings.
- `check-pack-content`: passed.
- Full jest suite: 356 suites and 8004 tests passed.

## Behaviour differences worth knowing

- **Laser Sight on an unequipped weapon:** it no longer adds its Aim +1. An upgrade's rules follow
  its host's equipped state (`isItemActive`). The old sum didn't check.
- **A second copy of a non-repeatable Perk** (`selectionLimit` 1) now gives one reroll grant, not
  one per copy. The rules engine de-duplicates copies.
- **Expertise (GI Joe) on delete:** deleting a flagged copy now takes its up 2 away with it. The old
  delete handler never removed the written-in `shiftUp`.
- **The world migration's actor subtraction** assumes a picked older copy really had its value
  written in. That is what the drop always did. A GM who had removed the bonus by hand would lose
  it a second time, but never below 0.

## Left / to do

- **Making the migration run:** `essence20.mjs#runMigrations` only calls `migrateWorld()` when
  `system.json`'s `flags.needsMigrationVersion` (currently `6.0.0`) is newer than the world's stored
  version. To run it for worlds already at 6.0.0, bump that at release. This was not changed here.
  Older Fast and Expertise copies stay correct without the migration, because they are detected.
  What does need the migration is hand-made items, or copies with their own edited rules, that still
  carry a `system.reroll`, `hasMorphedToughnessBonus` or `aimShiftBonus`: until it runs they lose
  that behaviour.
- **Compile the packs before the migration runs in a world**, which is the normal release order. If
  the migration runs against old compiled packs, inheriting copies get the original's rules
  snapshotted as their own (see above).
- **Rules editor (`editor-spec.mjs`):**
  - The Reroll form still only offers mode, target, reset, uses, skills and cost path / amount.
    Condition, recursive, minDieFaces, essence, Story Point and Role Point costs, `grantsCanCritD2`,
    `keepBetter`, `upTo`, bonus and shiftUp are edited in the rule JSON.
  - The Movement stage list has no `bonus` entry.
  - Adding either needs new `en.json` labels, which were left alone here.
- **Weapons:** existing world weapons still have `system.items.<id>.aimShiftBonus` in their entries.
  Nothing reads it any more.
- **6.1:** remove `perk.canActivate`, `perk.hasMorphedToughnessBonus`, `perk.value`, the reroll
  schema on perk / power, `upgrade.aimShiftBonus` and `weapon.totalAimShiftBonus`, along with the
  `perkValueRule` legacy branch in `onPerkDelete`.
- **Unused strings** (not removed from `lang/en.json`):
  - `E20.PerkCanActivate`, `E20.PerkMorphedToughnessBonus`, `E20.MovementIncreaseValue`,
    `E20.UpgradeAimShiftBonus`
  - `E20.RerollEnabled`, `E20.RerollMode`, `E20.RerollTarget`, `E20.RerollReset`,
    `E20.RerollMaxUses`, `E20.RerollMinDieFaces`, `E20.RerollRecursive`, `E20.RerollCondition`
  - `E20.RerollCostResourcePath`, `E20.RerollCostAmount`, `E20.RerollCostWorldStoryPoints`,
    `E20.RerollCostRolePointsName`, `E20.RerollGrantsCanCritD2`, `E20.RerollSkills`,
    `E20.RerollEssence`
- **Not tested:** the `migrateActorData` wiring (Foundry documents), meaning the call site, the
  running totals and the merge into the item update. `migratePerkValue` itself is unit-tested.

## Shared-file edits

- **Rules engine:**
  - `module/rules/types.mjs`: Reroll params; Movement stage `bonus`.
  - `module/rules/adapter.mjs`: `ruleRerollGrants`.
- **Rolls and documents:**
  - `module/mechanics/rolls/reroll.mjs`: `getRerollConfigs`.
  - `module/documents/actor.mjs`: the bonus stage in `_prepareMovement`.
  - `module/documents/item.mjs`: `_prepareAimShiftBonus` removed.
  - `module/dice.mjs`: Laser Sight term and helper removed.
- **Handlers and sheets:**
  - `module/sheet-handlers/perk-handler.mjs`: drop and delete.
  - `module/sheet-handlers/attachment-handler.mjs`: snapshot.
  - `module/sheets/item-sheet.mjs`: `_prepareSubmitData`.
- **Items:**
  - `module/items/resources/emotional-mastery.mjs`: Guilt.
  - `module/mechanics/combat/sneak-attack.mjs`: a comment.
- **Data and migration:**
  - `module/data/item/{perk,power,upgrade,weapon,alteration}.mjs`: comments only.
  - `module/migration.mjs`: an `options` parameter on `migrateItemData`, `compendiumEntryAt`, the
    `migratePerkValue` call in `migrateActorData`, `inPack` from `migrateCompendium`, and the new
    block at the end.
- **Templates:**
  - `templates/item/details/{perk,alteration,upgrade}.hbs`
  - `templates/actor/parts/items/upgrade/details.hbs`
- **Not edited:** `lang/en.json`.
- **Packs:** 79 source files (listed by `git status packs/`).

## Editor forms

This closes the "Rules editor" item under "Left / to do".

- **Reroll form** (`module/rules/editor-spec.mjs`): it now offers every Reroll setting.
  - New fields: `values`, `upTo`, `condition`, `essence`, `scopeToOriginSkill`, `minDieFaces`,
    `recursive`, `keepBetter`, `bonus`, `shiftUp`, `grantsCanCritD2`, `cost.worldStoryPoints` and
    `cost.rolePointsName`. Most of them are under the advanced toggle.
  - `condition` picks from `CONFIG.E20.rerollConditions`, through a new `rerollConditions` option list in
    `editor-render.mjs#optionList`.
  - `essence` offers "Any Essence" (`any`) and the Essences.
  - `recursive` uses the yes / no / blank field (the `stacks` kind). The setting is on unless it is
    `false`, and a checkbox can only write `true`.
- **Movement form:** the `bonus` stage is now in the stage list. The catalogue's `derived` stage is
  still not offered.
- **Labels:** `fieldLabel` only reads `E20.Rules.Field.*`, and `editor.test.js` checks every label
  there. So the labels are new `E20.Rules.Field.Reroll*` keys, plus `MovementStages.bonus`.
- **Strings removed from `lang/en.json`:** these old root `E20.Reroll*` field labels. Nothing in
  `module/`, `templates/` or `tours/` used them.
  - `RerollCondition`, `RerollCost`, `RerollCostAmount`, `RerollCostResourcePath`,
    `RerollCostRolePointsName`, `RerollCostWorldStoryPoints`
  - `RerollEnabled`, `RerollEssence`, `RerollGrantsCanCritD2`, `RerollMaxUses`, `RerollMinDieFaces`
  - `RerollMode`, `RerollRecursive`, `RerollReset`, `RerollSkills`, `RerollTarget`
  - The `RerollCondition*`, `RerollMode*`, `RerollReset*` and `RerollTarget*` option strings stay,
    because `CONFIG.E20` uses them.
- **Tests:** `module/rules/editor-reroll.test.js` checks four things.
  - The form covers every Reroll param and all four cost keys.
  - Every field renders.
  - A render and read back of a full rule gives the same rule, and that rule validates.
  - `recursive` takes true, false and blank, and Movement offers `bonus`.
