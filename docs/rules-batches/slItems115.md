# Batch slItems115: round 15, part "items1" - the "piece" items under module/items/ (attacks ... healing)

**Scope:** the 72 items with verdict "piece" in the survey's `result-items1.json` - per-item code under `module/items/attacks`,
`defenses`, `forms`, `gear` and `healing`, and its hooks in `dice.mjs`, `chat.mjs`, `documents/item.mjs`, `documents/actor.mjs`,
`mechanics/combat/combat.mjs`, `banked-buffs.mjs` and the sheets. Also the 4 items round 14 left as code (Shield Upgrade, Imperial
Machine Mantle, Defibrillator, Patch Up - `slItems114.md`). Edited in place in the shared checkout: no branch, no commit, no pack
compile.

**Result:** all **76 items converted**. **118 rules on 72 pack items.** Swift Defender, Continuous Stance, Counterstrike and
Complete System Failure have no rules of their own: the other items' rules read them with `@owned.<id>`. The old per-item code,
constants, dialogs and tests are removed (60 `items/` files - code and tests - deleted).

Tests:
- `module/rules/conv15-items1.test.js` (71 tests) checks each item from its pack source.
- `module/rules/engine15-items1.test.js` (28 tests) checks the engine pieces' options and edges.

`scripts/check-rules.mjs`: 0 errors from this part (see "Checks").

## Engine features added 2026-10-07 (round 15, items1)

All new plug-in files are imported in `rules/plugins/index.mjs`'s "Round 15 (items1)" block.

### Rule types

- **`FanningShots {extraShots, firstShotUpshift}`** (`combat/fanning-shots.mjs`) - adds Fanning shots and ↑ on the first fanned shot.
  It is read by `items/attacks/fanning.mjs` (`getFanningMaxShots`, `getFanningFirstShotUpshift`). Storm of Lead.
- **`TraitIgnore {traits: [mounted], items?}`** (`combat/trait-ignore.mjs`) - a weapon trait's drawback doesn't apply. `items` is
  a list of item tags for the weapon. `ruleIgnoresTrait(actor, weapon, trait)` is read by `mounted-weapons.mjs`. Ordnance Expert.
- **`SuccessToCrit {when, steps?}`** (`rolls/success-to-crit.mjs`) - a plain success against a target that meets `when` becomes a
  Critical Success. This happens at dice.mjs's Unconscious bump. `steps` run once afterwards. No Factor.
- **`PoisonCoating {cost: move | free, keepVialOnFumble}`** (`resources/poison-coating-rule.mjs`) - Poisonous, Intoxicate, Poison
  Tipped.
- **`HealBonus {amount, steps?}`** (`resources/heal-bonus.mjs`) - extra Health when the holder heals the way the Heal action does
  (`heal-action.mjs#restoreHealth`). `when` sees `target:` as the one healed. I've Got You, Up And At 'Em.
- **`TargetedDefense {defense}`** (`combat/targeted-defense.mjs`) - attacks against the holder use that Defense. Scramble.
- **RollModifier `scope: "incomingAura"` + `radius`** (same file) - applies to rolls made against an ally near the holder. Shield
  Modulation with Shield Upgrade.
- **`ShapeOption {kind: skill | size, key?, label}`** (`effects/shape-change.mjs`) - a pick the shared Change Shape dialog offers.
  - `skill`: a Skill kept in the shape under `key`.
  - `size`: one size step per rule. Use `stacks: true` so each Perk copy counts.
- **`AttackChoice {title, prompt, none, options: [{label, shiftUp | damage | armorPiercing | radiusMultiplier}]}`**
  (`combat/attack-choice.mjs`) - one pick, asked as an attack is used, before its area template is placed (`documents/item.mjs`).
  The pick reaches the template radius and dice.mjs's `attackChoiceShiftUp` / `attackChoiceDamage` / `attackChoiceArmorPiercing`.
  `when` sees the rolled attack. Bring It All Down.
- **`DefenseAura {defenses, radius, bonus: rolePoints | amount}`** (`combat/defense-aura.mjs`) - a bonus the holder lends to allies
  in range. It goes inside every per-attack Defense value dice.mjs computes: the compared Defense, Over the Candlestick's swap,
  and the early Defense rules' `valueOf`.
  - `bonus: rolePoints`: the holder's base Role Points defense bonus for that Defense.
  - With several holders in range, the best one counts.
  - Shield Upgrade, with `check:personalShield`.

### Trigger events

- **`defeatedEnemyStun`** (`combat/stun-defeat-event.mjs`) - a Stun hit auto-Defeated someone. CBRN Defender.
- **`allyTargeted` / `allyDefended`** (`combat/ally-reactions.mjs`):
  - `allyTargeted` asks the target's allies before the roll. Trigger `promptText`; step `boostDefense {amount}`.
  - `allyDefended` fires afterwards with `@var.outcome` set to hit / turned / missed. The attacker is its target.
  - Defender Step, Retribution.
- **`transforming`** (`@var.mode`) and **`rolePointsActivating`** (a stopped run cancels the activation)
  (`effects/state-changes.mjs`) - Mode Attachment, Shield Modulation.
- **`applyingDamage`** (`combat/applying-damage.mjs`) - damage about to land, in `chat.mjs#onApplyDamage`:
  - `redirect: true, within, priority, limit` - an ally holding it may take the hit. Only the first by priority is asked.
  - Plain Triggers on whoever it lands on can `setVar damage`, with `prompt` / `promptText` (`{name}`, `{amount}`, `{@formula}`).
  - The `stage` Triggers on this event are rest-other's `applying-damage-stages.mjs`.
  - Interpose, Body Shield, Heroic Sacrifice, Golden Guardian, Stand By Me, Fe-BURN!.
- **`damageLanding`** (same file) - fires on the GM's client, as a damage modifier. Cyborg.
- **`criticallyHit`** (`combat/critically-hit-event.mjs`) - a Critical Success's damage lands on the holder. It fires after the
  reductions, whatever damage is left; the attacker is the target. Imperial Machine Mantle.

### Steps

- **`targetCircle {radius}`**, **`setDataset {key, data}`** (`rolls/before-roll-rolled-item.mjs`) - for BeforeRoll rules. BeforeRoll
  steps also see the rolled item as `{rolled.<path>}`, `@rolled...` and `@var.rolledItem`.
- **`mutateWeapon {onto: choice:<key>, set, toggle}`** and **`grantAttacks {uuid, until}`**, plus until **`untilUsed`**
  (`combat/weapon-mutation.mjs`) - Explosive Ammo, Firestorm, Utility Loaders, Backblast, Airburst, Knuckle Up.
- **`lendItem {item, to, onto, lasts}`** (`picks/lend-item.mjs`) - Support, Tech Support.
- **`pickGeneralPerk`** (`picks/general-perk-step.mjs`) - Why Do I Know That?.
- **`fireEvent {event}`**, **`grantResistance {damageType?, morphedOnly}`**, **`hideTokens {hidden}`** (`effects/state-changes.mjs`).
- **`takeAsEssence {prompt}`**, **`unmorph`** (`combat/applying-damage.mjs`) - Cyborg, Fe-BURN!.
- **`linkToHost {name?, warn?}`** (`effects/linked-host.mjs`) - the item a pickGrant just gave is linked to the rule item's host
  weapon (`flags.essence20.linkedHost`).
  - It is equipped exactly while the host is.
  - An active shield going down is lowered and its Defense bonus cleared.
  - It is deleted with the host.
  - `warn` is shown before the host is rolled while the linked item is active.
  - Deflecting Weapons.
- **`changeShape {title?, prompt?}`** (`effects/shape-change.mjs`) - if shaped this scene, it changes back (and restores the
  size). Otherwise it opens one dialog over every ShapeOption the actor has. The state stays `flags.essence20.mlpShape`, which
  `check:shapeShifted` and the shape spells read.

### Tags, refs and selectors

- **`roll:firstRow:success|failure`** - Terrifying Presence.
- **`self:` / `target:markText:<key>=<text|$item.path>`** and mark `text` (`marks/mark-value.mjs`) - Instill Weakness.
- **`damage:resisted`** - the damage type is one the holder already resists.
- **`shape:skill:<key>`** - the rolled Skill is the one the shape keeps under that key.
- **`itemVar:<key>:<item tag>`** and item selector **`var:<key>`** (`gear/item-disruption.mjs`) - the item whose uuid
  `@var.<key>` holds.
- **`item:pack:<pack>|<pack>`** (`tags/item-pack-tag.mjs`) - the entry's system pack. Multimorph's MLP Origins:
  `item:line:mlp` doesn't count Dark Skies over Equestria.
- **`{sourced.<16-char id>.<path>}`** in rule text and tags (`predicate.mjs#interpolate`) - a value on the actor's copy of that
  book item. Self-Preservation reads Energy Affinity's choice.
- **`@actor.system.defenses.<d>.armorShare`** - the armor / Morphed share `_prepareDefenses` just added. Imperial Machine Mantle.

### Mark effects on items

Item mark effects (`markItem effects`, read by `gear/item-disruption.mjs`):
- **`rollSnag`, `rollShiftDown`, `rollLabel`** - roll sources on rolls with the marked item (an attack's weapon counts) and on a
  roll whose dataset names it as `markedItemUuid`.
- **`inoperable`** - a warning before its attack is rolled.

Technical Glitch, Some Assembly Required, Complete System Failure.

### Core options

- `recipients()` **`first`** (a formula, applied after `filter`).
- **`fillData`**: createItem data and children, and `roll` step **`dataset`** values. A lone `{var.x}` / `{choice.x}` keeps its
  value, so a number stays a number.
- afterRoll Trigger **`@var.crit`**.
- `mark` **`text`**.
- DamageReduction **`consumeMark`**.
- pickEntry **`from.types`**.
- pickGrant **`viaDrop: true`** - through the type's drop handler, registered with `registerDropGrant(type, fn)`. The
  `alteration` handler is `picks/drop-grant.mjs`, which uses `onAlterationDrop`. If nothing is made, the run stops.
- pickGrant **`from.byOriginalId`** - an owned item's `system.originalId` counts as holding that entry.
- `pickChildEntry` keeps **`@var.<var>Parent`**, so a second pick can be made from another parent (`not:item:isVar:<var>Parent`).

## Verdicts

| Item | Pack file | Verdict |
|---|---|---|
| Primeon Blade | `eocitems/_source/Primeon_Blade_VuvBnBhXQTmr4Tro.json` | converted (one damage card per Megaform member) |
| Bring It All Down | `dditems/_source/Bring_It_All_Down_x4PS0cKR25og3lC0.json` | converted (AttackChoice) |
| CBRN Defender | `fffav1items/_source/CBRN_Defender_B6HYPvLAVgCtQk1n.json` | converted |
| Continuous Stance | `ttsgitems/_source/Continuous_Stance_yNtX8ky7O8v50C5l.json` | converted - no rules; read by Defender Step (@owned) |
| Cybernetic / Enhanced / Optimized Part | `ccitems/_source/{Cybernetic_Part_wCL3rJOEDZVHVg6g,Enhanced_Part_eT4g9EfrFtvjMqWu,Optimized_Part_zGsTAngJ2HRdKPkz}.json` | converted (pickGrant viaDrop) |
| Engrafted / Evolving / Outright Mutation | `ccitems/_source/{Engrafted_Mutation_zuR9YJ2Wy956VGGy,Evolving_Mutation_7cL4aUwJwqvbhYCz,Outright_Mutation_RcGUjeMpsNDFjwmL}.json` | converted (pickGrant viaDrop) |
| Storm of Lead | `jttitems/_source/Storm_of_Lead_Px86Wo4MyldPjl5X.json` | converted |
| Horseshoes and Handgrenades / Mighty Strikes / No Need To Aim | `gijcrbitems/_source/...` | converted (BeforeRoll) |
| Instill Weakness | `dditems/_source/Instill_Weakness_o00ALKAEGOlbWXzB.json` | converted |
| Ordnance Expert | `gijcrbitems/_source/Ordnance_Expert_bB7Fiuu6BjIUlAgt.json` | converted |
| No Factor | `qgtgitems/_source/No_Factor_FgiCtgLoTRxFXCeU.json` | converted |
| Retribution / Defender Step | `ttsgitems/_source/{Retribution_cZtUjIzieAFxTwH2,Defender_Step_X59RRGMww6UZQJ78}.json` | converted |
| Swift Defender | `ttsgitems/_source/Swift_Defender_MPAZdtX3Ob76h90Y.json` | converted - no rules; read by Defender Step |
| Rallying Cry (WTNV) | `wtnvcgitems/_source/Rallying_Cry_Qdb9Jj4UAAE0YbhE.json` | converted - see the ruling list |
| Terrifying Presence (GI Joe, TF) | `gijcrbitems/.../Uw1jdm5GzW7Nk5Wi`, `tfcrbitems/.../P4qrmsy7AVSuahwx` | converted |
| Unique Strike (Melee / Ranged), Enhance Strike | `jttitems/_source/...` | converted |
| Explosive Ammo, Firestorm, Utility Loaders, Backblast, Airburst | `dditems/_source/...` | converted (mutateWeapon) |
| Kitbash Upgrade, Armament Upgrade, Traps and Obstacles, Grid Connection | `gijcrbitems`, `iafav2items`, `eocitems`, `fgtaaitems` | converted |
| Knuckle Up | `sssitems/_source/Knuckle_Up_MViU1s9KdZ1A51Qe.json` | converted |
| Cyborg, Fe-BURN! | `bthitems/_source/{Cyborg_rqCybOrg7Bth48Pk,Fe_BURN__y3RPr4nJWVtCtdil}.json` | converted |
| Interpose (GI Joe, SotS), Body Shield, Heroic Sacrifice | `gijcrbitems/...`, `sotsitems/...` | converted (applyingDamage redirect) |
| Golden Guardian | `atsitems/_source/Golden_Guardian_dSMZ5wMdu0Xq0VzX.json` | converted |
| Counterstrike | `atsitems/_source/Counterstrike_8mRJPvxLFVcf0egf.json` | converted - no rules; read by Golden Guardian |
| Stand By Me | `mlpcrbitems/_source/Stand_By_Me_LrcbTJQdNJVyu23f.json` | converted |
| Limited / Standard Deflecting Weapon | `ccitems/_source/{Limited,Standard}_Deflecting_Weapon_*.json` | converted (linkToHost) |
| Dig Deep (PR CRB) | `prcrbitems/_source/Dig_Deep_eC0iByyLbSHQKY2G.json` | converted - see the ruling list |
| Elemental Adaptation (Grid Power) | `atsitems/_source/Elemental_Adaptation_5HNnSeIg4JKXiv2F.json` | converted |
| Interspatial Pause | `jttitems/_source/Interspatial_Pause_InterspatialPaus.json` | converted |
| Scramble | `tfcrbitems/_source/Scramble_Lo0GW0XGQ7caNb4P.json` | converted |
| Self-Preservation | `dditems/_source/Self_Preservation_fsy9G9z8cKe3kObg.json` | converted |
| Shield Modulation | `gijcrbitems/_source/Shield_Modulation_16ul4Ev6b9gO5CIN.json` | converted |
| Mass Shift, Mode Attachment | `tfcrbitems/_source/{Mass_Shift_0JiAkBjJzsuezfaI,Mode_Attachment_SgofEgBVvg4josSR}.json` | converted |
| Multimorph | `dsoeitems/_source/Multimorph_HGKHAbwZ43I564vd.json` | converted |
| Face-Shift, Master Morph, Size-Shift, Shape-Shift | `dsoeitems/_source/...` | converted (ShapeOption / changeShape) |
| Technical Glitch, Some Assembly Required | `qgtgitems/_source/...` | converted (item mark effects) |
| Complete System Failure | `qgtgitems/_source/Complete_System_Failure_eMliZALtmapa7zoo.json` | converted - no rules; read by the two above |
| Poisonous, Intoxicate, Poison Tipped | `ccitems/_source/...` | converted (PoisonCoating) |
| Support, Tech Support | `gijcrbitems/_source/...` | converted (lendItem) |
| Welds, Rivets, and Ideas | `dditems/_source/Welds__Rivets__and_Ideas_a7KiUNWgLZgtQz6S.json` | converted |
| Why Do I Know That? | `atsitems/_source/Why_Do_I_know_That__ugJU6pzzWNesCn4f.json` | converted |
| I've Got You, Up And At 'Em | `gijcrbitems/_source/...` | converted (HealBonus) |
| Shield Upgrade (round 14) | `gijcrbitems/_source/Shield_Upgrade_ep0OFsU1QIuRpHeR.json` | converted (DefenseAura) |
| Imperial Machine Mantle (round 14) | `pradvitems/_source/Imperial_Machine_Mantle_CjYzIg9gVstsE0wg.json` | converted (Defense over armorShare + criticallyHit) |
| Defibrillator (round 14) | `gijcrbitems/_source/Defibrillator_IP0hnNhERC4OCc0k.json` | converted (mark count + roundStart) |
| Patch Up (round 14) | `tfcrbitems/_source/Patch_Up_Jlfb8iPvT7JFvcxv.json` | converted (roll dataset) |

### Behaviour that moved (same effect, different surface)

- **Dialogs became the rules' own pickers.** This applies to Unique Strike, Terrifying Presence, Mass Shift, Dig Deep, Multimorph,
  Patch Up, Some Assembly Required and Technical Glitch.
  - Several one-form dialogs became a few dialogs in a row.
  - Picker labels are the rule's own.
  - Chat lines are the rule text, or the engine's Granted / Picked lines, instead of the old `T(...)` lines.
- **Rule costs.** An unaffordable Energon / Personal Power cost now hides the Use button. The old code warned after the action was
  paid.
- **Expiry.** Copies that run out for the scene now use `rulesExpiry` (`until: scene`) instead of `flags.essence20.temporary`:
  Multimorph, the Grid Connection upgrade and the lent upgrades.
- **Ownership.** Copies the rules make carry `grantedBy`, so they go with the Perk: Unique Strike's weapon, Welds' copy, Multimorph's
  Perks and the Deflecting shield.
- **Timing.**
  - H&H, Mighty Strikes and No Need To Aim run from the roll's preRoll instead of `item.roll`, so attack steps get them too.
  - The Grid Elemental Adaptation Stun branch now runs where `takesDamage` fires, before the Defeated toggle.
- **Dig Deep / Self-Preservation's damage cuts** are taken in the damage modifiers. Dig Deep's comes before Elemental Shield.
  Self-Preservation's comes after Protomatter, so a hit already at 0 no longer spends it.
- **Technical Glitch / Some Assembly Required.**
  - The disruption is the item mark `disrupted`, not `flags.essence20.gij3Disrupted`.
  - Reboot and Repair are two rule button cards instead of one card with two buttons. Reboot can be pressed by the target's
    owners; Repair by the disruptor's owners.
  - The pick lists an item's name without its owner's.
- **Imperial Machine Mantle.** "Breaks on a Critical Success" now fires after the reductions, not before them. It still fires on
  any crit, damage or not.

## Bugs found and fixed

- **Support / Tech Support** (`lendItem`): a non-weapon upgrade lent to an ally was attached onto the weapon that ally picked in an
  earlier lend, because the choice stays stored. Now only a weapon upgrade goes `onto` a weapon.
- **`banked-buffs.mjs#canUsePerk`** still read `SCRAMBLE_ID` after its import went. That was a ReferenceError for every Perk past
  that line. Fixed: the Dig In branch only.
- **Dead entries dropped.**
  - The `POISON_PERK` entries for poisonChemistry, poisonProdigy and hacker.
  - Welds' `weldsRivetsAndIdeasEpoch` flag (nothing read it).
  - The alteration Perks' `beastModeGrantedItemId` check (nothing writes it).

## Code vs notes - needs a ruling

These are kept exactly as the code did. The questions are in `questions.md`.

- **Rallying Cry (WTNV):** the condition now goes through `applyCondition` (the GM relay). `combat:roundIs:1` needs a started
  combat; the old check was a bare `round == 1`.
- **Dig Deep (PR CRB):** the Snag is banked on the next roll, one roll only, as the code did. The notes are looser.
- **Mass Shift:** the reach doubling is an ItemModifier on `totalReach` while marked, as before.
- **CBRN Defender out of combat:** the ↓1 lasts until a combat starts and doesn't come back after it. The old flag with a null
  combat reactivated.
- **Engrafted / Evolving / Outright Mutation:** Beast Mode's scene copies still give no Alteration.
- **Shield Upgrade:** the ignore-armor recomputes (Armor Piercing, noArmor, Exploit Weakness) still drop the lent bonus.
- **Defibrillator:** this now uses the core `heal` step. It un-Defeats only when Health ends above 0, and a quantity-0 copy is
  refused.
- **Multimorph:** `game-lines.mjs#lineOf` counts Dark Skies over Equestria, In a Jam and Story of the Seasons as 'other'.

## Shared-file edits

- `rules/steps.mjs`:
  - `registerDropGrant` and pickGrant `viaDrop` / `from.byOriginalId`.
  - `fillData` used for createItem / children / roll `dataset`.
  - fillText `{rolled.x}` and amountOf `rolled`.
  - mark `text` and `recipients()` `first`.
- `rules/predicate.mjs` - `{sourced.<id>.<path>}`.
- `rules/triggers.mjs` - afterRoll `@var.crit`.
- `rules/plugins/dialog/dialog-select.mjs` - BeforeRoll `rolled` / `dataset`.
- `rules/plugins/combat/damage-reduction.mjs` - `consumeMark`.
- `rules/plugins/picks/pick-and-loop-steps.mjs` - pickEntry `from.types`.
- `rules/plugins/picks/entry-grants.mjs` (uses) - pickChildEntry `@var.<var>Parent`.
- `rules/plugins/combat/combat-steps.mjs` - a comment.
- `rules/plugins/index.mjs` - the items1 block.
- `dice.mjs`:
  - Removed the CBRN, Storm of Lead, Instill Weakness, No Factor, Terrifying Presence, Defender Step / Retribution, I've Got You
    / Up And At 'Em, Welds, Dig Deep, Scramble, Mass Shift, Shield Modulation and Stand By Me blocks.
  - Hooked in SuccessToCrit, allyDefenseReactions and TargetedDefense.
  - `getShieldUpgradeBonus` became `ruleDefenseAura`.
  - The Bring It All Down reads became `attackChoice*`.
  - The unused `findHangUp` import was dropped.
- `dice.test.js` - removed describes and dataset lines; the Bring It All Down datasets are now the `attackChoice*` fields.
- `chat.mjs`:
  - The CBRN and Fe-BURN! blocks are gone.
  - The redirect block calls `applyingDamage`.
  - The Mantle break became `criticallyHit`.
- `chat.test.js` - the Interpose tests use a rule item. The CBRN, Fe-BURN!, Body Shield and Mantle tests are moved or rewritten,
  and their unused ids are gone.
- `documents/item.mjs`:
  - The H&H / Mighty / NNTA calls are gone.
  - `ruleAttackChoice` replaces `pickBringItAllDownEffect`.
- `documents/item.test.js` - the Bring It All Down describe uses an AttackChoice rule.
- `documents/actor.mjs`:
  - `_preparePersonalPowerSupply` and `_prepareSelfPreservationResistance` are gone.
  - `defense.armorShare` is new.
  - The Machine Mantle block is gone.
- `documents/actor.test.js` - the Mantle describe became armorShare tests.
- `mechanics/combat/combat.mjs` and its test:
  - The Stun branch calls `stunDefeated`.
  - The self-preservation and grid elemental-adaptation calls are gone.
- `mechanics/resources/banked-buffs.mjs` and its test - the converted Perks' branches, `PATCH_UP` and the `SCRAMBLE_ID` fix.
- `mechanics/actions/heal-action.mjs` - HealBonus.
- `mechanics/actions/action-perks.mjs`.
- `sheets/base-actor-sheet.mjs` - `rolePointsActivating`.
- `sheet-handlers/transformer-handler.mjs` - `fireTransforming`.
- `sheet-handlers/perk-handler.mjs`.
- `apps/roll-options-dialog.mjs`, `mechanics/rolls/roll-dialog.mjs` and `templates/dialog/roll-dialog.hbs` - the Instill Weakness,
  No Factor and Retribution checkboxes are gone.
- `data/item/weapon-effect.mjs`.
- `mechanics/combat/aoe-targeting.mjs` (and its test) and `multiple-targets.mjs` - comments.
- `items/index.mjs` - the removed imports.
- Items files edited, not deleted:
  - `attacks/fanning.mjs` and `attacks/mounted-weapons.mjs` (and their tests).
  - `attacks/weapon-perk-uses.mjs` (and its test).
  - `attacks/electromagnetic-vs-computerized.mjs` (a comment).
  - `gear/poison-coating.mjs`, `gear/support-upgrade-lending.mjs` and `gear/why-do-i-know-that.mjs`.
  - `defenses/interpose-attack.mjs` (Impenetrable Armor only, and its test).
  - `defenses/personal-shield.mjs` (and its test).
  - `forms/pony-shape-shifting.mjs` (now only the shape state and the spells, and its test).
  - The `items/tests/*` suites.
  - `mechanics/combat/target-riders.test.js`.

## Unused strings

These keys are now read by nothing in `module/`, `templates/` or the packs (125 keys):

E20.Gij3CsfChat, E20.Gij3CsfOnlyDisruptor, E20.Gij3CsfRepairButton, E20.Gij3CsfRepaired, E20.Gij3CsfSource, E20.Gij3DisassembledChat,
E20.Gij3DisruptFailed, E20.Gij3DisruptNoComputerized, E20.Gij3DisruptNoTarget, E20.Gij3DisruptPick, E20.Gij3DisruptedChat,
E20.Gij3NotInCombat, E20.Gij3NotYours, E20.Gij3NothingToReboot, E20.Gij3RebootButton, E20.Gij3Rebooted, E20.O2DefibDone,
E20.O2DefibStarted, E20.O2LendFree, E20.O2LendHow, E20.O2LendMove, E20.O2LendPick, E20.O2LendWeapon, E20.O2NeedDefeatedTarget,
E20.D22PrimeonPick, E20.D22PrimeonDealt, E20.G1CyberneticGranted, E20.ReactCyborgPick, E20.O1DeflectingGranted, E20.O1MultimorphEnd,
E20.O1MultimorphMode, E20.O1MultimorphOne, E20.O1MultimorphOneDone, E20.O1MultimorphPick, E20.O1MultimorphTwo,
E20.O1MultimorphTwoDone, E20.O1PauseEnds, E20.O1PauseStarts, E20.Mlp1TogglePassAs, E20.WeaponUseNoEnergon, E20.WeaponUseElement,
E20.WeaponUsePickAdjustment, E20.WeaponUsePickMeleeWeapon, E20.WeaponUseDamageType, E20.WeaponUseAddTrait, E20.WeaponUseStunInstead,
E20.WeaponUseMutated, E20.WeaponUseBackblastOn, E20.WeaponUseBackblastOff, E20.WeaponUseFailed, E20.WeaponUseHammerItOut,
E20.WeaponUseUntilTurnEnd, E20.WeaponUseUntilSceneEnd, E20.WeaponUseKnuckleUp, E20.DefenseMachineMantle, E20.UniqueStrikeMeleeTitle,
E20.UniqueStrikeRangedTitle, E20.UniqueStrikeName, E20.UniqueStrikeDefaultName, E20.UniqueStrikeSkill, E20.UniqueStrikeDamageType,
E20.UniqueStrikeRange, E20.UniqueStrikeRangeStandard, E20.UniqueStrikeRangeFlat, E20.UniqueStrikeRangeBurst,
E20.UniqueStrikeAlternateEffect, E20.UniqueStrikeAlternateEffectNone, E20.UniqueStrikeAlternateEffectAccurate,
E20.UniqueStrikeAlternateEffectArmorPiercing, E20.UniqueStrikeAlternateEffectManeuver, E20.UniqueStrikeAlternateEffectMultipleAttacks,
E20.UniqueStrikeAlternateEffectMultipleTargets, E20.UniqueStrikeAlternateEffectAreaOfEffect, E20.EnhanceStrikeNoUniqueStrike,
E20.EnhanceStrikeTitle, E20.EnhanceStrikePickLabel, E20.EnhanceStrikePickEnhancement, E20.EnhanceStrikePickElement,
E20.EnhanceStrikePickAlternateEffect, E20.EnhanceStrikeOptionDamage, E20.EnhanceStrikeOptionElementType, E20.EnhanceStrikeOptionRange,
E20.EnhanceStrikeOptionAlternateEffect, E20.SelfPreservationNoEnergon, E20.SelfPreservationActivated, E20.FeBurnConfirmTitle,
E20.FeBurnConfirmContent, E20.DefenderStepConfirmTitle, E20.WeldsRivetsAndIdeasNothingAvailable, E20.WeldsRivetsAndIdeasPickTitle,
E20.WeldsRivetsAndIdeasPickLabel, E20.ScrambleActivated, E20.ScrambleDeactivated, E20.ModeAttachmentPickModeTitle,
E20.ModeAttachmentPickModeLabel, E20.MassShiftPickBenefitTitle, E20.MassShiftPickBenefitLabel, E20.MassShiftBenefitDefense,
E20.MassShiftBenefitSkill, E20.MassShiftBenefitReach, E20.MassShiftBenefitTempHealth, E20.MassShiftDefenseLabel,
E20.MassShiftSkillLabel, E20.IveGotYouNoTarget, E20.PatchUpPickSkillTitle, E20.PatchUpPickSkillLabel, E20.PatchUpUnavailable,
E20.InstillWeaknessPickDamageTypeTitle, E20.InstillWeaknessPickDamageTypeLabel, E20.TerrifyingPresencePickTitle,
E20.TerrifyingPresencePickLabel, E20.TerrifyingPresenceOptionDamage, E20.TerrifyingPresenceOptionFrightened,
E20.TerrifyingPresenceOptionStun, E20.TerrifyingPresenceOptionStunDamage, E20.ShieldModulationPickTitle,
E20.ShieldModulationPickLabel, E20.DigDeepPickBenefitTitle, E20.DigDeepPickBenefitLabel, E20.DigDeepBenefitDamage,
E20.DigDeepBenefitHeal, E20.RollDialogRetributionDamage, E20.RollDialogRetributionEdge, E20.RollDialogInstillWeakness,
E20.RollDialogNoFactor

No new strings: `lang-items1.json` is `{"RulesExtItems1": {}}`.

Still used, kept:
- The Bring It All Down keys (its rule's labels).
- `E20.O1DeflectingName` / `O1DeflectingRaised` (linkToHost).
- `E20.Gij3StillInoperable`.
- The `E20.Mlp1Shape*` / `Mlp1FaceSkill` / `MorphSkill` / `Size` keys (changeShape, ShapeOption labels).
- `E20.DamageRedirectConfirm*`.
- `E20.O2NeedAlly` / `O2NeedAdjacent`.

## Rule count

**118 rules on 72 pack items.**

## Checks

- **eslint** on every touched file: clean, except for problems left by other parts:
  - `dice.mjs`: unused `actorHasZordFeature`.
  - `dice.test.js`: unused `legacyPoolParty`.
  - `steps.mjs:835`: a padding line in items2's `asCastHit`.
- **`scripts/check-rules.mjs`**: 2 errors, both on Crashing From The Skies, which is another part's in-progress work.
- **jest:**
  - This part's suites pass: conv15-items1 (71), engine15-items1 (28), and all of `module/items`, `module/documents`,
    `module/mechanics`, `chat.test.js` and conv14-items1.
  - The full suite's remaining failures are in other parts' in-progress work:
    - action-economy "Think On It" (Mark Target).
    - Eureka / Take Point / Terror accrual in `dice.test.js`.
    - The Environmental Expertise tests in conv15-items2 / conv15-systems / conversions.
- **Line endings:** `rules/plugins/index.mjs` is LF in the working tree; HEAD has it CRLF (another part rewrote it).
