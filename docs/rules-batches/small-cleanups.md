# Small optional cleanups (2026-10-07)

The "smaller findings" from `details-audit.md` (Summary, "Worth knowing") and the leftovers named in
`details-cleanup.md` ("Left / to do"). Nothing was committed and no packs were compiled. Pack source JSON
was edited as text only: each property's exact span was found by a position-tracking parser (no JSON
round-trip), every file kept its own line endings, and each file was re-read right before it was
written. Scripts are in the session scratchpad `smallclean/` (`scan.mjs`, `detail.mjs`, `fix.mjs`).

## 1. Unused weapon aim bonus (`system.items.<id>.aimShiftBonus`)

- **Migration:** `migrateWeaponEntryAimBonus(item, {update})` in `module/migration.mjs`, called from
  `migrateDetailsFields` (so from `migrateItemData`, for world, embedded and compendium items).
  - Weapons only. Every attachment entry that still has an `aimShiftBonus` key loses it, whatever its value
    (the snapshot was unread at any value). Entries without the key aren't touched, so a re-run does nothing.
  - **ForcedDeletion works here.** `system.items` is a `parentItem()` `ObjectField`, and the key is inside one of
    its entries, not a schema field. v14's `ObjectField#_updateDiff` merges the change with
    `mergeObject(..., {applyOperators: true})`, which deletes a nested key paired with a `ForcedDeletion`
    (the same operator `attachment-handler.mjs` already uses to delete whole `system.items.<key>` entries).
    So this uses `unset` with no item. The path isn't in `RESET_TO` and has no schema field, so `unset`
    gives a real `ForcedDeletion`, not the reset-to-default it uses for the deprecated Details fields.
- **Packs:** none to change. No pack weapon entry carries the key; the 11 pack upgrades with
  `system.aimShiftBonus: 0` hold the deprecated *upgrade* field, which the data model still has until 6.1.
- **Tests (`module/migration.test.js`):** the key is force-deleted from every entry that has it (1 and 0),
  other entries stay as they are, a second run and a `migrateDetailsFields` re-run both return `{}`, and
  non-weapons, a weapon with no entries and a null entry are left alone.

## 2. Book fields nothing read

What each one is, from the books and from git (`git log -S` found no code that ever read any of them; they
came in with the item templates and the pack builds):

### Focus `skills` (84 focuses)
- **Book:** the skills a Focus's own Essence increase must go into. GI Joe CRB p.81 (Artillery), for
  example: the Focus raises Smarts by 1 at 1st and again at 10th level, and that skill point goes into one of
  the listed skills. The other lines print the same thing.
- **Existing mechanic:** none to wire it into. `onFocusDrop` / `_setFocusValues` only raise the Essence (and
  ask which one, when the Focus offers more than one). No flow places a skill rank for it. The extra Essence
  just raises the Skill Picker's spend budget, and the Skill Picker doesn't know where a rank came from.
- **Done:** shown read-only. The actor sheet's Focus row (`templates/actor/parts/items/focus.hbs`) has a chip
  "Focus increase skills: Alertness, Science" (new `E20.FocusIncreaseSkills`), so the player knows where to
  put that rank in the Skill Picker.
- **Needs a decision (not built):** granting the rank automatically, the way `setOriginValues` does for an
  Origin. A prompt from `focus.system.skills` filtered to the Focus Essence would run at the drop and at each
  `essenceLevels` level (1st and 10th). The choices would be stored per level, so `onFocusDelete` and a level
  drop can take them back off, and the Mechanized Infantry / Medic "or a Specialization for that skill"
  option needs handling too. Doing that changes how a Focus rank is counted against the Skill Picker's
  budget (auto-placed vs. hand-placed), which is a design call.

### Weapon `requirements.custom` (106 weapons)
- **Book:** the free-text part of a weapon's printed Requirements column. The values are a mix: Skill ranks
  ("Science d4", "Targeting d4, Technology d4"), sizes ("Towering", "Huge"), Origins or Perks ("Dragon
  Origin, Fire Breath Perk", "Freebooter Focus, Pillage Perk"), team or Path restrictions ("Psycho Rangers
  only", "Path of Venom"), notes ("See combined weapon rules, pg. 115 CRB", "Nil"), and one penalty spelled
  out in full.
- **Existing mechanic:** none that fits all of these. The structured `requirements.skill/shift` (Brawn) is only
  displayed too. Nothing applies a weapon's Brawn shortfall.
- **Done:** shown read-only. The actor-sheet weapon details have a "Requirements: <text>" chip
  (`templates/actor/parts/items/weapon/details.hbs`), next to the existing Brawn chip.
- **Needs a decision (not built):** turning the text into structured `prerequisites` tags (origin/perk/size)
  or skill-shortfall ↓ penalties, item by item. The "Nil" entries should probably just be cleared.

### Shield `requirements` (3 shields with a value)
- **Book:** a Brawn requirement. Through the Shattered Grid Table 2-6/2-7 prints "Brawn +d4" and "Brawn +d6".
  Power Rangers CRB p.81: every rank of Brawn below an equipment's requirement gives ↓1 to its use.
- **Existing mechanic:** `items/defenses/armor-brawn-reinforced-shell.mjs` already applies exactly that to
  worn armor (`flags.essence20.brawnRequirement`, ↓1 per die short on Strength / Speed tests and attacks,
  bent by BrawnRequirement rules).
- **Done:** wired in.
  - The new `shieldBrawnRequirement(shield)` reads the Brawn die out of the text ("Brawn d4", "Brawn +d6").
  - `brawnShortfall` uses it for shields, and `brawnRequirementSources` now includes equipped shields, with
    their own Roll Options Dialog line.
  - Shields with empty or non-Brawn text change nothing.
  - The actor-sheet shield details also show a "Requirements: <text>" chip.
- **Tests:** `module/items/tests/armor-gear-data-rules.test.js` (parse, shortfall, source label, unequipped,
  no requirement). The chips are in `module/data/item/book-fields-display.test.js`.

## 3. Specialization Details tab

- `templates/item/details/specialization.hbs` was a broken `<div><div>`. It now has:
  - **Skill:** a select over `config.skills`.
  - **Shift:** a select over `config.skillShifts`. This is the skill shift list as a `{value: label}` object;
    `skillShiftList` itself is a bare array, which `selectOptions` would turn into index values.
  - **Specialized?:** a checkbox for `isSpecialized`.
  - It uses the same `sheet-field.hbs` style as the other item types and has CRLF line endings.
- **Strings:** new `E20.SpecializationSkill`, `E20.SpecializationShift` and `E20.SpecializationIsSpecialized`.
- **Tests:** `module/data/item/specialization-details.test.js` checks the three inputs, that the shift options
  equal the schema's `skillShiftList` choices, that the lang keys exist, and the CRLF line endings. This
  follows the template-text pattern of `perk-choice-details.test.js`.

## 4. Stray pack keys

- **Scan:** `scan.mjs` compares each item's `system` keys (top-level items and actors' embedded items)
  against its data model's `defineSchema()`, nested `SchemaField`s included.
- **Found:** the audit's list, plus three it didn't name: gear `type` (218), influence `bond` (137) and
  rolePoints `level20Value` (14).
- **Data checks before removing:** every removed value is either a default or already lives in the real
  field:
  - gear `type` always equals `gearType` or is blank.
  - Personal Shield's `level20Value: 15` duplicates its `bonus.level20Value`.
  - Mauler's `alternateEffects` text is already its CriticalOption rule.
  - Foundry drops all of these on load anyway.
- **Removed (outside prcrbitems):**

  | Type | Keys (items) |
  |---|---|
  | altMode | `crew` 37, `firepoints` 37, `movement` 37, `size` 27 |
  | weapon | `classFeatureId` 280, `alternateEffects` 280, `isToxin` 32 |
  | power | `classFeatureId` 66 |
  | origin | `bonusSkillLevels` 30, `groundMovement` 30, `benefit` 30 |
  | gear | `type` 202 |
  | influence | `bond` 127 |
  | rolePoints | `level20Value` 11 |

- **Numbers:**
  - weaponEffect `numHands` "0"/"1"/"2"/"5"/"6"/"10" became numbers (485 items).
  - Origin `baseAerialMovement` / `baseAquaticMovement` / `baseGroundMovement` became numbers (15 Origins each).
- **Totals:** 1270 pack files.
- **Skipped: `packs/prcrbitems`** (the Power Rangers 2nd-printing audit was editing it). Left there:
  - weapon `classFeatureId` / `alternateEffects` (57 each)
  - power `classFeatureId` (22), `usesPerScene` (4), `isVariable` (3), `timesSelected` (2), `castable` /
    `isActive` / `powerIncrease` (1 each)
  - gear `type` (16)
  - hangUp `img` (10)
  - influence `bond` (10)
  - origin `benefit` / `bonusSkillLevels` / `groundMovement` (10 each)
  - rolePoints `level20Value` (3)
  - string `numHands` (123)
  - string Origin base movements (10 each)

  Running `fix.mjs` again with `prcrbitems` taken out of `SKIP_PACKS` cleans them once that audit is done.
- **Not touched:**
  - `numHands: "0"` strings inside weapons' `system.items` entries (ObjectField content, not the schema field).
  - The few module generators that write `numHands: '0'` (companions, summons, team actions, ranger form
    perks). Foundry casts those.
  - The dead `system.classFeatureId` read in `documents/item.mjs` (no model has the field).
- **Test:** `module/data/item/pack-schema-keys.test.js` checks two things:
  - No pack item has a `system` key outside its model.
  - The number fields above are never numeric strings.

  It also checks that the key walker descends into nested SchemaFields and leaves open ObjectFields alone.
  Its explicit allowlist is the prcrbitems leftovers above, by `type.key`; take an entry out once the pack is
  cleaned.

## 5. Redundant clauses

- **Primal Rage** (`packs/bthitems/.../Primal_Rage_4gkRa5plNeMNXSmL.json`): both rules' `{any: [attack:unarmed,
  item:name~unarmed, weapon:name~unarmed]}` are now plain `attack:unarmed`. `items/shared/unarmed-attacks.mjs`
  matches the printed unarmed weapons by compendium source, so the name clauses only added homemade weapons
  that happen to be called "Unarmed...". That is a small behaviour change.
  - `module/rules/conv6-slA6.test.js`: its "Unarmed Combat" test weapon now carries the PR CRB compendium
    source, and a new check shows a weapon merely named "Unarmed Spikes" doesn't count.
- **`module/dice.mjs` comment:** the Beastly note no longer points at the removed
  `UNARMED_COMBAT_ALTERNATE_EFFECT_1_IDS`. It now says that Beastly's own ItemModifier rule sets the Blunt
  alternate's `shiftDown` to 0 (`rules/adapter.mjs#ruleDerived`), and that `documents/item.mjs` reads the
  result.

## Checks

- **eslint** (`--ext .js,.mjs --rule 'linebreak-style: off'`) on every touched `.js` / `.mjs`: clean.
- **`node scripts/check-rules.mjs`:** 4425 rules on 2445 items, 0 errors and 0 warnings.
- **`check-pack-content` and `check-pack-cross-references`:** passed.
- **Full jest suite:** 370 suites and 8558 tests passed.

## Files

- **Code:**
  - `module/migration.mjs`
  - `module/dice.mjs` (comment only)
  - `module/items/defenses/armor-brawn-reinforced-shell.mjs`
- **Templates:**
  - `templates/item/details/specialization.hbs`
  - `templates/actor/parts/items/focus.hbs`
  - `templates/actor/parts/items/weapon/details.hbs`
  - `templates/actor/parts/items/shield/details.hbs`
- **Strings:** `lang/en.json`, 4 keys added as text edits.
- **Tests:**
  - `module/migration.test.js`
  - `module/rules/conv6-slA6.test.js`
  - `module/items/tests/armor-gear-data-rules.test.js`
  - New: `module/data/item/pack-schema-keys.test.js`, `module/data/item/specialization-details.test.js`,
    `module/data/item/book-fields-display.test.js`
- **Packs:** 1270 source files from the key cleanup, plus Primal Rage. None are in `packs/prcrbitems`.
  - **Not staged:** 17 of them, because another agent changed the same files while this ran ("Bludgeoning" ->
    "Bludgeon" renames, and SkillSubstitution rules on the TF Unarmed Combat effects). These are the GI Joe and
    TF Close Combat / Long Bludgeoning weapons and effects, and TF `Unarmed_Combat_*Effect*`. My edits there
    (`numHands` numbers, the weapon keys) are in the working tree and left for that agent to stage with its own.
  - **Shared files:** the staged `lang/en.json` and `module/dice.mjs` also hold other agents' edits. An agent
    added `migrateMovedItemSources` to `module/migration.mjs` after this was staged, and that is unstaged.
