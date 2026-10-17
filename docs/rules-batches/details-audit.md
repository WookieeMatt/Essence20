# Item sheet Details-field audit (2026-10-06)

Read-only audit of every field on the item sheet's **Details** tab (and the editable bits of the **Description** tab),
asking whether the rules engine (`system.rules`) has made any of them redundant.

Method:
- Fields come from `templates/item/details/<type>.hbs` (plus the shared `parts/activation-fields.hbs`, `aoe-fields.hbs`,
  `duration-fields.hbs`, `id-drop.hbs`, `role-perk-drop.hbs`, `sub-perk-drop.hbs`) and `templates/item/tabs/description.hbs`.
- Readers: `module/` grepped for each path (tests and `module/data/item/*` schema files left out), plus actor-sheet templates
  (`templates/actor/parts/items/**`) for display.
- Pack usage: every item in `packs/*/_source/*.json` (5,600 items, Active Effect `base` entries left out; scan scripts in the session scratchpad `detailsaudit/`).
  "set" = a non-default value. Also checked: whether those items carry rules, and whether any pack rule reads the field
  through `@item.system.x`, `rule:data:system.x`, `item:data:system.x`, `@host.system.x`, `@rolled.system.x`.

Shown-where key: **D** = Details tab, **Desc** = Description tab, **(cond)** = only shown under a condition.

Verdicts: **REMOVE** (dead, or replaced and unused), **HIDE** (still read, but should stop being authored here; migration
named), **KEEP** (live data / book stat / read by rules), **UNSURE**.

---

## Shared parts

| Field | Shown where | Readers | Rule coverage / pack usage | Verdict |
|---|---|---|---|---|
| `actionType` | D, every usable type (activation-fields) | `mechanics/actions/action-economy.mjs`, `named-actions.mjs`, stat-block import, migration | ActionCost rules (77) change the cost but read the item's own `actionType` as the base; 837/838 weapon effects, 283 perks, 65 powers, all spells set it | KEEP |
| `contingencyTrigger` | D (cond: actionType = contingency) | action-economy.mjs | None (no rule type for it); not set in any pack item | KEEP (user text for a Contingency) |
| `shape`, `radius` | D: weaponEffect, spell, power (cond: canActivate) | `documents/item.mjs`, AoE placement, `planted-bombs.mjs`, stat-block import | Book AoE stats; 119 weapon effects, 3 spells, 8 powers; pack rules read `system.radius`/`shape` (25 refs) | KEEP |
| `duration.value/units/text` | D: spell, power, magicBauble | `duration-schema.mjs#formatDuration` (durationLabel, chat/sheet), expiry | Book stat; 79 spells, 30 powers, 13 baubles | KEEP |
| `source.book/page` | Desc | display, importers, compendium browser | Book reference | KEEP |
| `automation.status/notes` | Desc | header badge, `prepareAutomationContext` | Per-item automation notes (written by apply.cjs) | KEEP |

## perk (2,212 pack items)

| Field | Shown where | Readers | Rule coverage / pack usage | Verdict |
|---|---|---|---|---|
| `type` | D | perk-handler, grants, compendium browser, prerequisites, many tags | 56 pack rules read `system.type`; set on every perk | KEEP |
| `allegianceCost` | D (cond: type contact) | `mechanics/companions/contacts.mjs` (spend button), stat-block import, actor-sheet chip | No pack item sets it (Contacts are made in play / imported); ContactAllegiance rule is separate | KEEP |
| `version` | D (cond: type faction) | `item-sheet.mjs#_getVersionRoles` (fills the sub-perk Role dropdown) | Set on 373 perks | KEEP |
| `isRoleVariant` | D (cond: faction) | `perk-handler.mjs#setRoleVatiantPerks`, `role-handler.mjs#addFactionPerks` | 5 perks (Be A Hero, Be Ruthless, Bogatyr, Cybertronian Perk x2), none with rules; 1 rule reads it | KEEP (the live per-Role grant mechanism; no Grant-rule equivalent built) |
| `hasMorphedToughnessBonus` | D (cond: faction + powerRangers) | `perk-handler.mjs#setPerkValues` -> `setMorphedToughnessBonus` at drop | 4 perks (It's Morphin Time!, Quantum Morph, A Guardian of Eltar!, Magna Power!). It's Morphin Time! already has a `roleDropped` Trigger with the `refreshMorphedToughness` step - the rule engine can already do this job | HIDE - give all 4 an `added` Trigger running `refreshMorphedToughness` (check it also sets `system.canSetToughnessBonus`), then drop the perk-handler branch |
| `items` (sub-perks, with per-entry `role`) | D (cond: isRoleVariant) | perk-handler, role-handler | Grant data | KEEP |
| `selectionLimit` | D (not faction) | perk-handler (times-taken check), `rules/steps.mjs` (pick `notOwned`), `perks.mjs`, attachment-handler | 79 perks set it (book "may be taken N times") | KEEP |
| `prerequisite` (text) | D (not faction) | `documents/item.mjs` chat card, `rules/sheet.mjs` (Rules-tab prereq display), `item:mentions` tag, book-description importer | 355 perks; 536 of 537 pack items with text also carry structured `system.prerequisites`. `rules/prerequisites.mjs` says the printed text "stays for display". 2 pack rules read it | KEEP |
| `canActivate` | D (not faction) | **None for perks** - the only `canActivate` reader is `mechanics/characters/power-use.mjs`, which returns early unless `item.type == 'power'`; no actor-sheet template checks it for a Perk | 20 perks set it; 15 of them carry rules (mostly Use) (the Use rule is what gives a Perk a button now); the other 5 (Chronomantics, Focused Strike, Quantum Morph, Fully Hybrid, Hardcore) get nothing from it either way | REMOVE (from the perk Details tab; the schema field can go too - no migration, nothing reads it) |
| `advances.canAdvance/baseValue/increaseValue/type` | D (`advances.*` cond: canAdvance) | perk-handler (re-take = advance, renaming), attachment-handler, `mechanics/rolls/reroll.mjs` (`type: rerolls`) | 22-24 perks; all 22 with `canAdvance` have rules, and 36 pack rule formulas read `@item.system.advances.currentValue` | KEEP (the rules depend on it) |
| `hasChoice` / `choiceType` | D | perk-handler (the whole drop-time picker: ~30 `choiceType` cases), multi-choice-selector, reroll.mjs, energy-affinity, power-adaptation, environmental-expertise, compendium-item-picker | 115 perks. Only 17 pack items use ChoiceSet and **none** of them has `hasChoice`, so there is no overlap/duplication. 94 pack rule references (22 items) read the pick back as `system.choice` / `{item.choice}` | KEEP (live; a ChoiceSet migration would be a big separate project) |
| `value` | D (cond: choiceType movement) | perk-handler: adds it to `actor.system.movement.<pick>.bonus` (movement) or `skills.<pick>.shiftUp` (skills) at drop, subtracts on delete (line ~1318) | 5 perks set it. Live for 3: Fast (MLP, PR; +10 movement) and Expertise (GI Joe; up 2). Transmetal's 40 is ignored (`altModeMovement` doesn't read it; its 9 Movement rules hardcode 40). MLP "Attack" value 1 has no reader | HIDE - move Fast to Movement rules keyed on `rule:data:system.choice=<type>` (as Transmetal does) and Expertise GIJ to a RollModifier up 2 on `skill:{item.choice}`; actors who already own them have the bonus baked into their actor data and need it subtracted |
| `numChoices` | D (cond: choiceType perks) | multi-choice-selector, perk-handler, `rules/plugins/picks/choice-count.mjs` (ChoiceCount adds to it) | 16 perks (Grid Science/Tech I-IV, Modified Shell, etc.) | KEEP |
| `items` (perk choices) | D (cond: choiceType perks) | perk-handler picker | 46 perks | KEEP |
| `reroll.enabled/mode/target/reset/maxUses/minDieFaces/recursive/condition/cost.resourcePath/cost.amount/cost.worldStoryPoints/cost.rolePointsName/grantsCanCritD2/skills/essence` | D (all but `enabled` cond: reroll.enabled) | `mechanics/rolls/reroll.mjs#getRerollConfigs` loops every owned item's `system.reroll` | 49 perks (+1 power, Temporal Awareness, whose sheet doesn't even show the block). The **Reroll** rule type (`rules/types.mjs`) was built to take exactly these settings ("existing reroll data moves into a rule unchanged"), read by `adapter.mjs#ruleRerollGrants`; yet only 1 pack rule is a Reroll rule, and none of the 49 carries one | HIDE - move each `system.reroll` block into a `{type: "Reroll", ...}` rule, then delete the item loop in `getRerollConfigs` (keep the `advances.type == 'rerolls'` Power Infusion path or turn it into a rule as well; keep the effect loop for Active Effects) |

## power (103)

| Field | Shown where | Readers | Rule coverage / pack usage | Verdict |
|---|---|---|---|---|
| `type` | D | compendium browser, power-handler, nanomite uses, many tags | grid 68 / nanomite 19 / sorcerous 16 | KEEP |
| `availability` | D | Requisition, compendium browser | 17 (G.I. Joe nanomite) | KEEP |
| `selectionLimit` | D | power-handler, steps.mjs `notOwned` | 4 set (Reprogrammable etc.) | KEEP |
| `canActivate` | D | `power-use.mjs` (Use button gate), sorcery builder | 76 powers; 1 pack rule reads it | KEEP |
| `powerCost` / `hasVariableCost` / `maxPowerCost` | D (cond: canActivate / hasVariableCost) | power-handler, power-cost-selector, `rules/plugins/resources/power-used.mjs`, nanomite uses | 62 / 11 / 7 powers; Trigger rules fire *after* the cost is paid, they don't replace it | KEEP |
| `usesPer` / `usesInterval` | D (cond: canActivate) | nanomite-uses.mjs, threat-rules, stat-block import/export | 49 / 36; 3 pack rules read them | KEEP |
| `attackSkill`, `defenseType`, `damageValue`, `damageType` | D (cond: canActivate) | `mechanics/characters/attack-powers.mjs`, `documents/item.mjs` | 8 Sorcerous attack powers | KEEP |

## weaponEffect (838)

| Field | Shown where | Readers | Rule coverage / pack usage | Verdict |
|---|---|---|---|---|
| `classification.skill`, `classification.style` | D | dice.mjs, every attack tag | All set; read by 145+ pack rule references | KEEP |
| `damageValue`, `damageType` | D | dice.mjs, chat damage | Book stat; 85+ rule references | KEEP |
| `secondaryDamage.value/type` | D | dice.mjs, combat.mjs, damage-display, target-riders | 15 effects; 6 rules read it | KEEP |
| `defenseType` | D | dice.mjs | 37 set | KEEP |
| `numTargets` | D | dice.mjs, target-riders, team actions | 105 set | KEEP |
| `shiftDown` | D | dice.mjs (+ 70 other files) | 201 effects (Inaccurate etc.); rules read it 15x | KEEP |
| `numHands` | D | dice.mjs, Load Out, threat rules, importers | Set on most; note the packs mix strings ("1" x311) and numbers (1 x113) | KEEP |
| `range.reachMultiplier/value/long/min` | D | dice.mjs, actor.mjs reach, rule-attacks, importers | Book stats; 80+ rule references | KEEP |
| `isSpecialized` | D | `dice.mjs:738` (an effect's own flag makes its attack Specialized), stat-block parser/import/export (a `+d8*` attack line) | 0 pack items true. RollModifier `specialize: true` can do it for authored items, but the threat importers write this flag on NPC attacks | KEEP (needed for imported threat attacks) |
| `isRam`, `isFlyby` | D | dice.mjs, actor.mjs, drive-by, megaform-attacks | 6 / 5 effects; 12 rule references | KEEP |

## weapon (476)

| Field | Shown where | Readers | Rule coverage / pack usage | Verdict |
|---|---|---|---|---|
| `availability` (+ derived `totalAvailability` shown read-only) | D | Requisition, prereqs, compendium browser | Book stat; 17 rule refs | KEEP |
| `elementChoice` | D (cond: deals Element damage) | weapon-upgrades.mjs, vehicle-upgrades, predicate | A pick made in play (0 pack items) | KEEP |
| `isPoison`, `poisonType`, `poisonApplication.*` | D (`poisonType`/application cond: isPoison) | poison-coating, rider-uses, target-riders, predicate; `poisonType` display-only (actor weapon/effect details) | 15 weapons; 17 rules read isPoison/application | KEEP |
| `classification.size` | D (cond: not poison) | Load Out hands default, Hardpoints, many | Book stat | KEEP |
| `hands` | D | `documents/item.mjs` (`derivedHands` override of the size default) | Override; 0 pack items set | KEEP |
| `traits` | D (chips show `itemAndUpgradeTraits`) | weapon-traits.mjs, dice.mjs, many tags | Book stat; set on all | KEEP |
| `usesPerScene` | D | `summons.mjs` (Battlizer 1/scene), actor-sheet chip | 2 weapons | KEEP |
| `requirements.skill/shift` | D | `documents/item.mjs` (`effectiveBrawnReq`), actor-sheet display, stat-block import fallback | 415 set; 1 rule reads `requirements.shift` | KEEP |
| `requirements.custom` | D | **Display on this tab only** (no module reader, not on the actor sheet) | 106 weapons ("Psycho Rangers only", "Towering", ...) | KEEP (book data; could later become structured `prerequisites` / BrawnRequirement) |
| `items` (effects, upgrades) | D | attachment-handler, weapon-upgrades | Structure | KEEP |

## armor (103)

| Field | Shown where | Readers | Rule coverage / pack usage | Verdict |
|---|---|---|---|---|
| `availability`, `classification`, `traits` | D | defenses, training, Requisition, traits | Book stats | KEEP |
| `bonusToughness`, `bonusEvasion` | D | `documents/item.mjs` (totals), dice.mjs, actor defenses | 75 / 18 armors; rules read the derived totals (`@host.system.totalBonusToughness` etc.) | KEEP |
| `bulwarkHealthBonus` | D (cond: Bulwark trait) | `documents/actor.mjs#_prepareHealth`, modular-armor | 3 armors | KEEP |
| `modularAllowance`, `modularWeaponIds` | D (cond: Modular trait) | `items/defenses/modular-armor.mjs` | 4 armors; weapon ids are per-copy state | KEEP |
| `items` (upgrades) | D | attachment-handler | Structure | KEEP |

## shield (18)

| Field | Shown where | Readers | Rule coverage / pack usage | Verdict |
|---|---|---|---|---|
| `availability`, `classification`, `traits` | D | as armor | Book stats | KEEP |
| `requirements` (text) | D | Display on this tab only | 3 shields ("Brawn d4") | KEEP (book data) |
| `passiveEffect.*`, `activeEffect.*` (type, option1/2 value+defense, other) | D | `sheet-handlers/listener-item-handler.mjs` (shield toggle writes `system.defenses.<d>.shield`, Cover status) | All 18; only 3 have rules, and those are extra effects, not the Defense bonus | KEEP |
| `items` (weapon effects) | D | attachment-handler | Structure | KEEP |

## upgrade (432)

| Field | Shown where | Readers | Rule coverage / pack usage | Verdict |
|---|---|---|---|---|
| `type`, `availability`, `traits`, `removedTraits` | D | `documents/item.mjs` trait merge, attachment-handler, Requisition | Book data (removedTraits 7) | KEEP |
| `prerequisite` (text) | D | chat card, attachment-handler entry, migration, `item:mentions` | 182 set; structured `prerequisites` carry the check | KEEP |
| `benefit` (text) | D | actor-sheet upgrade details, attachment-handler entry | 109 set (short book summary) | KEEP (display) |
| `armorBonus.value/defense` | D (cond: type armor) | `documents/actor.mjs`, `documents/item.mjs`, `rules/plugins/combat/armor-upgrades.mjs`, only-best-defense | 28 set; 12 of them have rules that read `@item.system.armorBonus.value` | KEEP |
| `aimShiftBonus` | D (cond: type weapon) | `documents/item.mjs` sums it into the weapon's `totalAimShiftBonus`, read by `dice.mjs:4483` | 2 items, both Laser Sight (GI Joe CRB, TF CRB), no rules. The AimBonus rule type (`extra`, scope host) can say the same thing | HIDE - give both Laser Sights an `AimBonus {scope: host, extra: 1}` rule, then drop the field and the `totalAimShiftBonus` sum |

## alteration (33)

| Field | Shown where | Readers | Rule coverage / pack usage | Verdict |
|---|---|---|---|---|
| `availability` | D | Requisition | Book stat | KEEP |
| `type` | D | alteration-handler, alteration-adjustments | other 18 / essence 12 / movement 3 | KEEP |
| `essenceBonus`, `essenceCost` | D (cond: essence) | alteration-handler (drop dialogs), alteration-adjustments, lent-alterations | 12 / 12 set; no rules | KEEP |
| `bonusMovement(+Type)`, `costMovement(+Type)` | D (cond: movement) | alteration-adjustments, alteration-handler | 3 / 4 set; no rules | KEEP |
| `bonus` | D (cond: type **other**), as a number box | The code treats `bonus` as the **Skill name picked at drop** for *essence* Alterations (`alteration-handler.mjs:309`, `alteration-adjustments.mjs#benefitOf`). Nothing reads it for type `other` | 0 pack items set | REMOVE (the Details input; keep the schema field as drop-time storage) |
| `cost` | D (cond: type other), number box | Same: the drop-time picked cost Skill (`alteration-handler.mjs:310`, `costOf`) | 0 pack items | REMOVE (the Details input) |

## origin (115)

| Field | Shown where | Readers | Rule coverage / pack usage | Verdict |
|---|---|---|---|---|
| `startingHealth` | D | `documents/actor.mjs`, background-handler | 103 set | KEEP |
| `essences`, `skills` | D | background-handler (drop picks) | All set | KEEP |
| `baseAerial/Aquatic/GroundMovement` | D | background-handler, origin-chassis-index, chassis-picks, migration | All set (many stored as strings, "30" x15) | KEEP |
| `languages` | D | Actor-sheet origin details display only (`templates/actor/parts/items/origin/details.hbs`) | **No pack item sets it**; nothing copies it to the actor | UNSURE - no book Origin in the packs has languages; REMOVE if the books never print them (check the PDFs first) |
| `items` (Origin Perk, Alt Mode) | D | background-handler | Grant data | KEEP |

## focus (102)

| Field | Shown where | Readers | Rule coverage / pack usage | Verdict |
|---|---|---|---|---|
| `items` (Role, Role Perks with level/choiceGroup) | D | role-handler (role match, level grants) | Grant data | KEEP |
| `essences`, `essenceLevels` | D | role-handler (`_showEssenceDialog`, `roleValueChange`) | 89 / 101 default | KEEP |
| `skills` | D | **No module reader found** (role-handler never reads `focus.system.skills`) | 84 focuses set it (book Role Skills) | KEEP (book data; looks like an unapplied-grant gap - worth a look) |

## influence (181)

| Field | Shown where | Readers | Rule coverage / pack usage | Verdict |
|---|---|---|---|---|
| `skills` | D | background-handler | 31 set | KEEP |
| `items` (Influence Perk, Hang-Ups) | D | background-handler | Grant data | KEEP |
| `mandatoryHangUp` | D | background-handler | 12 set | KEEP |

## role (52)

| Field | Shown where | Readers | Rule coverage / pack usage | Verdict |
|---|---|---|---|---|
| `version` | D | role-handler, sheet sections, 35 files | All | KEEP |
| `items` (default Faction, Role Points, Role Perks) | D | role-handler, attachment-handler | Grant data | KEEP |
| `isAdditive` | D | actor.mjs, item.mjs, role/perk handlers, sheet-options | 1 (Old Hand) | KEEP |
| `isAdvanced`, `hasSpectrumShifted` | D (cond: powerRangers) | grants.mjs, zord-link-scopes / role-handler | 6 / 1 | KEEP |
| `armors.trained/qualified`, `weapons.trained/qualified`, `upgrades.armors.trained` | D (per game line) | `role-handler.mjs#_trainingUpdate` | 31 / 4 / 15 / 4 / 7 set | KEEP |
| `powers.personal.starting/increase/regeneration/levels` | D (cond: powerRangers) | role-handler, effect catalog | 24 roles | KEEP |
| `hasSpecialAdvancement`, `essenceLevels.*` | D (essenceLevels cond: no special advancement) | role-handler | 1 / 44 | KEEP |
| `skills` | D | `skill:roleSkill` tag (`rules/plugins/tags/dice-target-tags.mjs`); no grant code reads it | 32 set | KEEP (book data, read by rules) |
| `skillDie.isUsed/name/levels/specializedLevels` | D | role-handler, dice.mjs, skill-die-ref, rolePoints sidebar | 3 roles | KEEP |
| `gridPowerLevels` | D (cond: powerRangers) | **None** (only the schema default) | 51 roles carry the default `[6,11,16]`, 1 empty | UNSURE - book progression nobody reads; either wire it into level-up reminders or hide it; not authored per role anyway |
| `perkLevels.general` | D | **None** (only `tours/demo-content.mjs`) | 52 set, 16 differ from the default (book data) | UNSURE - book data nothing reads; same choice as above |
| `adjustments.health` | D (cond: myLittlePony) | actor.mjs, role-handler | 6 (MLP Spirits) | KEEP |

## rolePoints (24)

| Field | Shown where | Readers | Rule coverage / pack usage | Verdict |
|---|---|---|---|---|
| `isActivatable`, `powerCost` | D | dice.mjs, actor.mjs, reckless-abandon, role-points-damage, rolePoints container | 7 / 5 | KEEP |
| `bonus.type`, `bonus.defenseBonus.*`, `bonus.startingValue/increase/increaseLevels/level20Value` | D (cond: bonus.type) | actor.mjs, item.mjs, volley, splinter-defense, sneak-attack, spectrum-shifted, `role-points-bonus-ref.mjs` | 14 set; 3 pack rules read `@item.system.bonus.value` | KEEP |
| `resource.startingMax/increase/increaseLevels/level20Value/level20ValueIsUnlimited` | D | actor.mjs, item.mjs, spectrum-shifted | 12 set | KEEP |

## megaformTrait (27)

| Field | Shown where | Readers | Rule coverage / pack usage | Verdict |
|---|---|---|---|---|
| `type`, `essence`, `movementType`, `skill`, `damageType`, `value` | D (each by type) | `documents/actor.mjs` Megaform/Combiner prep (~lines 1500-1900) | All 27; 1 rule reads `@item.system.value` | KEEP |
| `attackType` | D (cond: accurateCombiner) | Accurate Combiner's own RollModifier rules (`rule:data:system.attackType=ranged`) | 1 | KEEP |

## altMode (77)

| Field | Shown where | Readers | Rule coverage / pack usage | Verdict |
|---|---|---|---|---|
| `altModeMovement.*`, `altModesize` | D | transformer-handler, chassis-picks, character template | All | KEEP |
| `botModeSize` | D | chassis index/picks, background-handler | 7 set | KEEP |
| `altModeCrew`, `altModeFirepoints` | D | Actor-sheet alt-mode details display; 1 pack rule (Cage) reads `system.altModeCrew` | 21 / 19 set (book stats) | KEEP |
| `tokenImage` | D | morph-state.mjs, transformer-handler | Per-world art | KEEP |

## gear (352)

| Field | Shown where | Readers | Rule coverage / pack usage | Verdict |
|---|---|---|---|---|
| `gearType` | D | compendium browser, kits, grants, companions | 323 set; 9 rules read it | KEEP |
| `quantity` | D | kits, consumables; 7 rules read it | Stack count | KEEP |
| `nanomite.uses/spent` (+ dropped Power link) | D (cond: Power linked) | nanomite-gear.mjs, nanomite-uses, held-uses, power-used | Play state | KEEP |

## spell (79)

| Field | Shown where | Readers | Rule coverage / pack usage | Verdict |
|---|---|---|---|---|
| `tier`, `circle`, `cost`, `range` | D | dice.mjs, item.mjs, Efficient/Master Spellcaster rules (read `system.cost`/`tier`), circle perks | All 79 | KEEP |
| `defenseType`, `damageValue`, `damageType` | D | dice.mjs | Few attack spells | KEEP |

## magicBauble (13)

| Field | Shown where | Readers | Rule coverage / pack usage | Verdict |
|---|---|---|---|---|
| `spellcastingShift`, `quantity`, `range` | D | `documents/item.mjs`, actor-sheet chip | All 13 | KEEP |

## equipmentPackage (49)

| Field | Shown where | Readers | Rule coverage / pack usage | Verdict |
|---|---|---|---|---|
| `items` (armor, shields, weapons, gear) | D | attachment-handler | Package contents | KEEP |
| `packageType` | Desc | power-ranger-standard-issue, compendium browser, migration | 4 set | KEEP |
| `alternateAccess` | Desc | Display only | 22 set (book "Alternate access") | KEEP (book data) |

## faction (33), feature (106), bond, hangUp, specialization, trait

| Type | Details content | Verdict |
|---|---|---|
| faction | `items` (Faction Perks) - read by the faction drop handler | KEEP |
| feature | Activation fields only | KEEP |
| bond, hangUp, specialization, trait | Empty Details tab (the template is a bare `<div>`) | - |

---

## Summary

### REMOVE (3)
- **perk `canActivate`** - nothing reads it for a Perk; Use rules are what give Perks a button now. Field and checkbox can
  both go; no migration (20 pack perks carry `true` with no effect).
- **alteration `bonus` / `cost` Details inputs** (type `other`) - number boxes editing two string fields the code uses only
  as the drop-time picked Skill of an *essence* Alteration. 0 pack items set them. Remove the inputs; keep the schema fields.

### HIDE (4) - with what to migrate first
- **perk `reroll.*`** (whole block, 15 inputs) - move the 49 perks + 1 power (Temporal Awareness) into `Reroll` rules
  (same parameters), then drop the `system.reroll` item loop in `mechanics/rolls/reroll.mjs#getRerollConfigs`.
  Embedded world copies need the same move (a migration that writes a Reroll rule from `system.reroll`).
- **perk `hasMorphedToughnessBonus`** - add an `added` Trigger with `refreshMorphedToughness` to the 4 perks (It's
  Morphin Time! already has the `roleDropped` one); confirm the step also sets `canSetToughnessBonus`; then drop the
  perk-handler branch.
- **perk `value`** - live for only 3 items (Fast MLP/PR, Expertise GIJ). Move them to Movement / RollModifier rules keyed on
  the pick; existing actors have the bonus written straight into actor data at drop, so the migration has to subtract it.
  Transmetal's `value: 40` and MLP Attack's `value: 1` are already unread.
- **upgrade `aimShiftBonus`** - 2 Laser Sights; replace with `AimBonus {scope: host, extra: 1}`, then remove the
  `totalAimShiftBonus` sum.

### UNSURE (3)
- **origin `languages`** - display-only, empty in every pack Origin; remove unless a book prints Origin languages.
- **role `gridPowerLevels`** - nothing reads it; every Role holds only the schema default.
- **role `perkLevels.general`** - nothing reads it, but it is book progression data (16 Roles differ from the default).
  Both role fields: wire them into level-up reminders, or hide them.

### Worth knowing (outside the verdicts)
- The big legacy mechanisms are **still live and not replaced**: `hasChoice`/`choiceType`/`numChoices` (115 perks; ChoiceSet
  covers 17 other items with no overlap, and 94 pack rule references read the old `system.choice`), `advances.*` (36 rule
  formulas read `advances.currentValue`), `isRoleVariant` (5), shield passive/active effects, Role/Focus/Origin/Influence
  grant fields, and megaformTrait stats. These are KEEP today. A ChoiceSet migration is what would eventually retire
  `hasChoice`/`choiceType`.
- **`focus.skills`** (84 focuses) and **`weapon.requirements.custom`** / **`shield.requirements`** are book data that no code
  reads or shows outside the item's own Details tab. They might be unfinished grant/prereq wiring.
- **`classFeature`** has a data model (`module/data/item/class-feature.mjs`) but is not registered in `system.json` and has
  no Details template.
- **specialization** items have `skill` / `shift` / `isSpecialized` in the schema, but an empty Details tab, so none of them
  can be edited on the sheet.
- Pack hygiene: stale keys that aren't in the schema (Foundry drops them on load) are still in the source JSON: weapon
  `classFeatureId`/`alternateEffects`/`isToxin`, origin `bonusSkillLevels`/`groundMovement`/`benefit`, altMode
  `crew`/`firepoints`/`movement`/`size` (37 items), power `isVariable`/`timesSelected`/`castable`/`powerIncrease`/`isActive`/
  `usesPerScene`. `weaponEffect.numHands` and the origin base movements are stored as strings and numbers both.
