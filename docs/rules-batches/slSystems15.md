# slSystems15 - round 15, part "systems"

Scope: the 105 "piece" items of survey/result-systems.json, plus Hyperkinetic Support Harness (left over from
slSystems14). The engine pieces they needed were built, and every item those pieces unblock was moved onto item rules.
**96 items converted, 3 partial, 7 still code.** Tests: `module/rules/conv15-systems.test.js` (80 tests). The engine
pieces are tested in the same file, next to the items that use them.

## Engine features added 2026-10-07 (round 15, systems)

All plug-ins are imported at the end of `rules/plugins/index.mjs`, in the "Round 15 (systems)" block.

### Powers

- **Trigger event `powerUsed`** (`resources/power-used.mjs`). It fires when a Power is used:
  `mechanics/characters/power-use.mjs#onPowerUse` calls `firePowerUsed(actor, power, spent)` before its own
  hand-written branches run.
  - The roll's item is the Power, so `item:own` keeps a Trigger to its own Power.
  - `@var.spent` is the Personal Power spent.
  - The targets are the user's targets.
  - A Power held by nanomite gear (not owned by the actor) runs only its own `powerUsed` Triggers, for the holder.
- **Rule type `FreeUse {when}`** (same file). Switching off a Power that matches costs no daily use;
  `mechanics/resources/nanomite-uses.mjs` asks `ruleUseIsFree(actor, power)`. Used for Protection, Reactive and
  Augmented Combat while they are switched on.

### Rolls and damage

- **Step `rollCheck {skill, essence?, shiftUp?, shiftDown?, defense?, dif?, edge?, damage?, dataset?, onSuccess?, onFail?}`**
  (`combat/roll-card-damage.mjs`). It runs a Skill Test through the sheet's own roll (`actor._dice.rollSkill`).
  - `damage: {value, type}` puts Apply Damage buttons on the card, multiplied by Degrees of Success (dice.mjs reads
    `dataset.stepDamage`).
  - `dataset` holds plain flags for the roll.
  - Then `onSuccess` or `onFail` runs.
  - Used by Power Blast, Morphblast, Electric Discharge, Disintegrate, Lucky Charm and Regeneration's Skill Test.
- **Defense `mode: noArmor`** (`combat/no-armor-defense.mjs`; needs `outgoing: true`). The attacked Defense is worked out
  again without armor (Penetrating Strikes). dice.mjs asks `ruleNoArmor` where the old check was.
- **CriticalOption `defense: <defense>`** (`combat/crit-defense-option.mjs`). One damage to that Defense, offered among
  the crit options (Bewildering, Traumatic, Maiming, Surgical). `target-riders.mjs#critRiders` labels it.
- **Cover `mode: giveBack`** (`combat/cover-give-back.mjs`, plus a case in `adapter.mjs#ruleCover`). The weapon's scope
  gives back the Cover it took away (Smart / Thermal Scope).
- **Tags `damage:style:<style>` and `damage:elementOrEnergy`** (`tags/damage-source.mjs`). They describe the attack card
  the GM is applying damage from: its `attackStyle`, and whether its damage type or traits are Element / Energy. They are
  meant for DamageReduction and takesDamage rules (the vehicle armors).

### Items that change their weapon

- **ItemModifier `stage: item`** (`effects/item-modifier-stage.mjs`). The rule runs inside the changed item's own
  `prepareDerivedData` (`items/attacks/weapon-upgrades.mjs` calls `applyItemStage`), so derived fields such as hands,
  reach and range are right before anything reads them.
  - `slot` is `start`, `element` or `end`.
  - The ops are `set` (a number, formula, text, bool or object; `{choice.x}` reads a pick), `add`, `multiply`, `max`,
    `min`, and `step` with `ladder: weaponSize`. `step` moves the size and works the hands out again.
  - Copies of the same upgrade stack (each copy is its own rule). The actor-level ItemModifier pass skips stage-item
    rules.
- **Rule key `always: true`** (`types.mjs` COMMON, `rules/index.mjs#collectRules`). A switched-off item (a stowed weapon
  and its upgrades) keeps its `always` rules (Sling, Integrated Bipod). Every other upgrade rule on a stowed weapon is now
  off.
- **Rule type `BraceUntilMoved {when}`** (`combat/brace-until-moved.mjs`). Brace lasts until the actor moves
  (Integrated Bipod). `named-actions.mjs` asks `ruleBraceUntilMoved`.

### Action costs

- **ActionCost `action: any` / `to: downgrade` / `limit.freeIsUnlimited` / scope `marked` + `mark`**
  (`resources/action-cost-any.mjs`, plus `rules/actions.mjs#costRuleFor`).
  - `downgrade` makes the action one step cheaper (standard to move, move to free).
  - `freeIsUnlimited` takes the cap off its Free half (the Talents).
  - A `marked` rule reaches whoever carries the setter's mark.
  - Action kinds `personalShield`, `rouse`, `analyzeTarget` and `vehicleRepair` are added through
    `registerActionKind`.
  - New duration `roundsThrough:<1-10>`. Out of combat it lasts the scene.
- **grantNextTurn `block: [kinds]` / `prespend: {free: n}`** (edit to `combat/defense-modes.mjs`). The recipient's next
  turn can't take those actions, or starts with some already spent.
- **Tag `self:actionLog:<named key | flag:key>[:standard|move|free]<op><n>` and ref `@ledger.<path>`**
  (`tags/action-ledger.mjs`). They read the turn's action ledger (Here To Help, Desperate Times, Snap Shots, New Plan).
- **Ref `@rangedWeapons`** (`combat/ranged-weapons-ref.mjs`). The number of ranged weapons the actor wields (Barrage
  Attack).
- **Assist `effect: nextTurnGrant {free?, move?, standard?}`** (`rolls/assist-next-turn.mjs`). Lend Assistance offers
  these next-turn grants (Here, Let Me; No, I Insist). `lend-assistance.mjs` asks `ruleAssistGrantModes`.

### Picks, steps and tags

- **Step `askValue {var, prompt?}`** (`dialog/ask-value-step.mjs`). Asks for any number, decimals included.
- **Tags `target:sameDisposition` and `self:roleName:<text>`** (`tags/same-disposition.mjs`).
- **Step `healShared {formula, to, filter}`** (`resources/heal-shared-step.mjs`). One roll is shared evenly among the
  recipients, at least 1 each; it sets `@var.healed` (Repair Zord).
- **pickGrant `from.notOwned` / `from.selectionLimit`** (edit to `rules/steps.mjs`). These leave out entries the first
  recipient already holds, or holds `selectionLimit` copies of (the Nano Infusions, Torozord Feature).
- **bonusAttack `only: <filter key>`** (edit to `rules/steps.mjs`).
- **Steps `morph {free?}` and `refreshMorphedToughness`** (`zords/morph-step.mjs`).
  - `morph` runs the sheet's own Morph flow and stops when already Morphed (Rapid Morph).
  - `refreshMorphedToughness` re-prepares the actor and works its Morphed Toughness bonus out again from the Armor
    Training it has now (the Armor Shells, on `added` and `removed`).
- **deleteItem `keepGrants: true`** (edit to `rules/steps.mjs`). What the removed items granted stays, unlinked first.
- **grantPerk `runPicker: true`** (edit to `plugins/picks/entry-grants.mjs`). A newly granted Perk's own drop-time
  picker (`setPerkValues`) runs (Metamorphosis).
- **Rule types `UniqueChoice {}` and `AnyGeneralPerkChoice {}`** (`picks/unique-choice.mjs`). Both are read from the Perk
  being set up.
  - `UniqueChoice`: copies can't pick a Skill another copy already has (Expertise).
  - `AnyGeneralPerkChoice`: its picker offers any General Perk from every enabled book (Nobody Like Me).
- **Rule type `ChoiceCount {items, add}`** (`picks/choice-count.mjs`). The listed Perks' drop-time pickers offer more
  picks (Grid Tap).
- **Check `check:vehicleInRoughTerrain`** (`tags/vehicle-checks.mjs`). The token of the vehicle the actor crews (or is)
  stands in Rough Terrain.
- **Recipient `personalVehicle:<key>` and tag `self:personalVehicle:<key>`** (`picks/personal-vehicle.mjs`). The actor's
  personal vehicle of that kind (Crashing From The Skies' Jet Pack).

### Vehicles and Zords

- **RollModifier scope `crewIncoming` and DieSubstitution scope `crew`** (`combat/crew-incoming.mjs`).
  - `crewIncoming` is a vehicle's rule on rolls made against someone aboard it (Tinted Canopy).
  - `crew` on a DieSubstitution reaches the rolls of the vehicle's crew (Kill Counter).
- **Rule type `SummonOption {rounds, power?, action?}`** (`zords/summon-option.mjs`). A faster Zord arrival, offered in
  `zord-summon.mjs#rollSummonTimer` instead of the 3d2 and paid when picked. It can sit on the summoner's item or on the
  Zord's.
- **Rule type `ExplosionStep {steps}`** (`zords/explosion-step.mjs`). A Defeated vehicle's explosion die is that many steps
  bigger. With several rules, the biggest wins.
- **Step `reduceTimer {by}`** (`zords/reduce-timer.mjs`). The actor picks a running Zord-summon or Megaform-combine timer,
  and it comes `by` rounds sooner, never before the current round. With nothing running, it warns and the Use's limit is
  not spent.

## Verdicts

| Item | Pack file(s) | Verdict |
|---|---|---|
| Speed Boost, Power Shield, Faster Regeneration, Boost Initiative | prcrbitems | converted (powerUsed) |
| Augment Power Weapon, Penetrating Strikes, Illuminate, Power Blast, Relentless Blows, Repair Zord | prcrbitems | converted (powerUsed) |
| Void Warrior | atsitems | converted (powerUsed + Veto on regaining Power, for the scene) |
| Morphblast, Future Vision, Rapid Morph, Q-Rex Portal, Assisted Summoning | jttitems | converted |
| Mobile Mode, Torozord Feature, Barrage Attack, Manifested Zord | ttsgitems | converted |
| Protection, Reactive, Augmented Combat, Swiftness, Repair Machine, Electric Discharge, Disintegrate, Regeneration | qgtgitems | converted (powerUsed) |
| Codename Jolt: Augmented Combat Nanomite Infusion | osbitems | converted |
| Bolster Defense, Lucky Charm, Chronomantic Pulse | fmmcitems | converted |
| Power Heal | prcrbitems | **partial** - the heal is a rule; removing a Condition stays the ext Use in `items/healing/power-heal-condition.mjs` |
| Refined Grip, Reinforced Grip, Balanced Grip, Automated, Extended, Smart Scope | gij / pr / tf crb | converted (ItemModifier stage item) |
| Bewildering, Traumatic, Maiming, Surgical | gij / (pr) / tf crb | converted (CriticalOption defense) |
| Microtech Weapon, Thermal Scope | gij / tf crb | converted |
| Biomechanical Weapon, Hyperkinetic Support Harness | fffav1items | converted |
| Chemical Sprayer, Pill Form, Salve Form, Mist Form, Crashing From The Skies | ccitems | converted |
| Power Weapon Element Damage Assignment | prcrbitems | converted |
| Bullpup | iafav2items | **partial** - the size step is a rule; its reload stays in reload-trait (`UPGRADE.bullpup` kept) |
| Robust Ram, Slashing Wings, Hydraulic Bounce, Integrated Bipod | qgtgitems | converted |
| Active Protection System, Slat Armor, Reactive Armor | qgtgitems | converted (DamageReduction + damage-source tags) |
| Kill Counter, Nameplate, Tinted Canopy | qgtgitems | converted |
| Anti-Matter Reactor | qgtgitems | **partial** - the explosion step is an ExplosionStep rule; tripling Movement stays code (see below) |
| Sling, Quick Shield, Rousing Presence, Snap Shots, Expertise | gijcrbitems | converted |
| A Talent For (x6), Talented, Harmony Unleashed, Laughtracting, Distraughter, Desperate Times, Here, Let Me, No, I Insist | mlpcrbitems | converted |
| Quick Study, Swift Study, New Plan | tfcrbitems | converted |
| Quick Fix, Here To Help | iafav2items | converted |
| Ground and Pound | ghpfitems | converted |
| Basal / Intricate / Profound Nano Infusion | qgtgitems | converted (+ item data: hasChoice off, choiceType none, items {}) |
| Heavy / Medium / Ultra-Heavy Armor Shell | prcrbitems | converted (refreshMorphedToughness) |
| Grid Tap | bthitems | converted (ChoiceCount) |
| Metamorphosis | dsoeitems | converted |
| Nobody Like Me | prcrbitems | converted (AnyGeneralPerkChoice; the picker and its chaining stay the generic perk-handler flow) |
| Accelerate Conversion | fgtaaitems | converted (2 Uses + ActionCost conversion, reduceTimer) |
| Dominate | - | **still code** - powerUsed is built, but the Command / Recall buttons, the per-setter mark and the daily-use refund on cancel need a card-button flow with no rule form yet |
| Metallic Armor Power Up | - | **still code** - spread over five files: the turn-start upkeep, MultipleTargets, the minion damage cut, the ending Triggers and a movement forbid (`MovementAction forbid: [blink]` is not built) |
| Surging | - | **still code** - needs a DialogSwitch whose Free-action cost cancels the roll when it can't be paid, and a `roll:d20:<n>` afterRoll tag (any d20 showing 1, not Fumble) |
| Stealth Helper, Subtle Helper | - | **still code** - grantNextTurn block / prespend are built, but `chat.mjs`'s Secret Helper claim reads `getSecretHelperPenalty`; converting needs Secret Helper itself as a rule first |
| Rig Upgrade | - | **still code** - its due-tier ladder by level (6 standard; 10 + limited; 17 + restricted) and the rig-companion recipient need a table / choose per level band |
| Self-Destruct | - | **still code** - `queueTurnStart` runs no steps, and the old timing (the first turn start a round after arming at turn index >= the armed one) has no rule form |
| Bullpup's reload, Power Heal's Condition removal, Anti-Matter Reactor's Movement | - | partial halves, above |

**Anti-Matter Reactor's Movement stays code.** `vehicle-upgrades.mjs#applyToVehicle` triples Movement in the middle of
its pass: after Shallow Draft and Submarine Mode, before Biotech's +20 / +10 and Optimized Seating's -10. No Movement rule
stage sits at that point, so a rule would give (base + 20) x 3 instead of base x 3 + 20.

## Bugs found and fixed

- **Relentless Blows** only granted its two attacks from `item.roll` (with no Power spent), never when the Power was
  used. It now fires on `powerUsed`.
- **Protection / Reactive** boosts never expired. They now last until the scene ends.
- **Snap Shots**: `action-perks.mjs#describeAttack` read the nonexistent `system.size`, so pistols were never
  recognised. It now reads `parent?.system?.classification?.size`.
- **Armor Shell deletion** never lowered Morphed Toughness, because `onPerkDelete` worked it out before the Shell was
  gone. The `removed` Trigger now re-prepares the actor first.
- **Manifested Zord / Q-Rex Portal / Assisted Summoning** were never offered. `summons.mjs#fastSummonOptions` had no
  caller, although the items' automation notes say summoning offers them. The SummonOption rules are now offered by
  `rollSummonTimer`. This is new behaviour - see the question in questions.md.

## Code vs notes - needs a ruling

- **Ground and Pound**: the notes say the downshift is "against them" (the grappled target); the code applied it to any
  unarmed attack. The code was kept.
- **The Talents**: the notes say once per round; the code allowed once per turn. Per turn was kept.
- **Hydraulic Bounce**: the notes say the driver gets the Edge; the code gave it to any crew member (and to the vehicle).
  The code was kept.
- **Augmented Combat / Codename Jolt**: the notes need rewording. The bonus is now a listed source in the Roll Options
  Dialog, not a silent change.
- **Accelerate Conversion**: the notes say the timers "offer a once-per-scene option". The code (old and new) is a Use
  button on the Perk, now two Uses.
- **Nameplate**: the notes say a Rest makes it available again. A crew member's Rest now clears the vehicle's
  once-per-rest rule uses, the same as the old `resetDailyVehicleUses`.

## Behaviour differences (small, accepted)

- `rounds:10` durations out of combat last the scene, not the encounter.
- Void Warrior's DamageType is now last in the damage-type chain.
- **Nanomite gear** holding a lasting Power (Protection, Augmented Combat, Reactive, Swiftness...) no longer applies it
  from the gear. The rules live on the Power, and a gear-held Power only runs its own `powerUsed` Triggers. See
  questions.md.
- Bonus Edges and shifts are now listed sources in the Roll Options Dialog.
- Bolster Defense on yourself uses self rules (`self:markedByHolder`), because a marked rule doesn't reach its setter.
- Two copies of Biomechanical Weapon stack their downshift. Two copies of Pink Power Weapon Element give x4.
- The Harness only counts while its armor is worn.
- Upgrade rules switch off on a stowed weapon, except the `always` ones.
- Torozord Feature and the Nano Infusions pick from visible packs only, with the pickOne dialog.
- Laughtracting's roll and hit go through a hit Trigger.
- Harmony Unleashed's label is now the item name.
- New Plan's button shows and is gated by `require` (its calc tag isn't static).
- Barrage Attack is hidden when unaffordable.
- The vehicle armors now cut damage inside `applyDamage`, after Immunity, with one chat line per rule. Before, one
  combined "VehicleDamageReduced" line came out ahead of the other reductions.
  - With Slat Armor listed before Active Protection System, Slat's use is spent first.
  - A second damage component of the same hit can take a still-unused cut.
- Tinted Canopy reads the attack's traits through `item:trait` (the effect's, its weapon's and its upgrades'). Before,
  only the weapon's own traits counted.
- Crashing From The Skies' guns are attached as entries of the new weapon. Its "no Jet Pack" and "already done" lines go
  to the Use card instead of a notification.
- Metamorphosis runs on the Perk's `added` Trigger, instead of in `setPerkValues` before the Perk is created.
- Many chat lines changed wording.

## Shared-file edits

- `module/rules/plugins/index.mjs` - the "Round 15 (systems)" import block.
- `module/rules/steps.mjs`:
  - `bonusAttack only`
  - `pickGrant from.notOwned / from.selectionLimit`
  - `deleteItem keepGrants`
- `module/rules/plugins/picks/entry-grants.mjs` - `grantPerk runPicker`.
- `module/rules/adapter.mjs`:
  - the ItemModifier actor pass skips `stage: item`
  - `ruleCriticalOptions` passes `defense`
  - `ruleCover` has a `case 'giveBack'`
- `module/rules/actions.mjs`:
  - `actionMatches` handles `any`
  - new `costRuleFor` (downgrade, freeIsUnlimited)
  - `costRulesFor` is self-scope only
- `module/rules/types.mjs` - COMMON gains `always`.
- `module/rules/index.mjs` - `collectRules` keeps an inactive item's `always: true` rules.
- `module/rules/plugins/combat/defense-modes.mjs` - `grantNextTurn block / prespend`.
- `module/rules/engine10-c.test.js` - grantNextTurn's error text (now "needs free, move, standard, block or prespend").
- `module/mechanics/characters/power-use.mjs` - fires `firePowerUsed`; the converted branches, imports and constants
  were removed.
- `module/mechanics/resources/nanomite-uses.mjs` - the FreeUse check.
- `module/dice.mjs`:
  - Removed the Speed Boost / Augment Power Weapon / Augmented Combat / Regeneration / Bolster / Chronomantic /
    Lucky Charm / Penetrating Strikes / Protection / Reactive / Void Warrior / Illuminate / Electric / Disintegrate /
    Power Blast / Morphblast / Repair Machine / crit-table / Laughtracting / Ground and Pound / Kill Counter branches.
  - `ruleNoArmor`.
  - `coverRules.giveBack`.
  - Their imports.
- `module/documents/actor.mjs` - Swiftness, Mobile Mode.
- `module/documents/item.mjs` - the onPowerUsed call.
- `module/items/index.mjs` - the void-warrior-regain-block imports.
- `module/mechanics/resources/personal-power-spend.mjs` - a comment.
- `module/items/attacks/weapon-upgrades.mjs` - `applyItemStage` calls. Removed: PWE, Sprayer, Extended, grips,
  Biomech, Smart Scope ranges, the crit tables, `getCritEssenceOptions`, `RANGER_COLOR_DAMAGE`, `SIZE_STEPS`, the
  Harness, and many UPGRADE ids.
- `module/mechanics/vehicles/vehicle-upgrades.mjs`:
  - Removed: Robust Ram, Slashing Wings, Hydraulic Bounce, `reduceVehicleDamage`, Kill Counter
    (`canUseDrivingForIntimidation`), Nameplate, Tinted Canopy.
  - `resetDailyVehicleUses` now clears rest limits.
  - `defenderSources`' context argument is `_context`.
- `module/mechanics/vehicles/vehicle-defeat.mjs` - ExplosionStep instead of the Anti-Matter Reactor id.
- `module/mechanics/vehicles/zord-summon.mjs` - `pickSummonOption` before the 3d2.
- `module/mechanics/companions/summons.mjs` - removed `fastSummonOptions`, `accelerate`, the Accelerate Conversion and
  Crashing From The Skies handlers, and their SUMMON ids.
- `module/chat.mjs` - the vehicle-armor call and its import.
- `module/mechanics/combat/target-riders.mjs` - `critRiders` labels a `defense` option.
- `module/mechanics/actions/action-perks.mjs`:
  - Removed: the Talents, Harmony, the Quick* entries, Laughtracting, `onPowerUsed`, Relentless Blows, Here To Help,
    Desperate Times, Snap Shots, Ground and Pound, New Plan, Barrage, Lend Assistance grant modes, Sling, Accelerate
    Conversion's COST_RULES entry, and the dead `choice` / `switchOn` Use machinery (`pickChoice`).
  - `describeAttack` fix.
- `module/mechanics/actions/lend-assistance.mjs` - `ruleAssistGrantModes`.
- `module/mechanics/actions/named-actions.mjs` - `ruleBraceUntilMoved`.
- `module/sheet-handlers/perk-handler.mjs`:
  - Removed: the Torozord Feature branch, Nano Infusion, Armor Shells, Grid Tap ids (`ruleChoiceCountBonus`),
    `grantMetamorphosis`, and `EXPERTISE_GIJ_ID`.
  - `hasUniqueChoice`.
  - `grantsAnyGeneralPerk` reads AnyGeneralPerkChoice.
- `module/items/zords/torozord-feature.mjs`, `module/items/zords/zord-feature-picks.mjs` - the grant and the Megaform
  repair were removed.
- Tests edited for the removed code:
  - `power-use.test.js`, `nanomite-uses.test.js`, `items/gear/nanomite-gear.test.js`, `dice.test.js`
  - `documents/actor.test.js`, `weapon-upgrades.test.js`, `vehicle-upgrades.test.js`, `action-perks.test.js`
  - `perk-handler.test.js`, `power-handler.test.js`, `torozord-feature.test.js`, `companions.test.js`
- Deleted with `git rm`: the per-item files (and their tests) for the converted Powers, plus power-heal.mjs and
  repair-zord.mjs.

## Unused strings

No new strings went into `lang/en.json`. The new ones are in `<scratchpad>/r15/lang-systems.json` under
`RulesExtSystems` (DamageZeroed, SummonOptionTitle, SummonOptionPrompt, SummonRollNormally) and need merging as
`E20.RulesExtSystems.*`.

Now unused:

- E20.PowerHealNotification
- E20.MobileModePickTypeTitle, E20.MobileModePickTypeLabel
- E20.SwiftnessPickTypeTitle, E20.SwiftnessPickTypeLabel, E20.SwiftnessGround, E20.SwiftnessAerial
- E20.RegenerationPickModeTitle, E20.RegenerationPickModeLabel, E20.RegenerationModeAutomatic,
  E20.RegenerationModeSkillTest
- E20.BolsterDefensePickOptionTitle, E20.BolsterDefensePickOptionLabel, E20.BolsterDefenseSingle, E20.BolsterDefenseAll,
  E20.BolsterDefenseSingleTypeLabel
- E20.ChronomanticPulsePickInitiativeTitle, E20.ChronomanticPulsePickInitiativeLabel
- E20.SelectNanomitePower
- E20.TorozordFeatureNoZord, E20.SelectTorozordFeature, E20.TorozordFeatureSelectTitle
- E20.UpgradeChooseSkill
- E20.ActionPerkSwitchedOn.harmonyUnleashed, E20.ActionPerkSwitchedOn.groundAndPound
- E20.ActionPerkChoice.move, E20.ActionPerkChoice.twoFree, E20.ActionPerkChoicePrompt
- E20.VehicleDamageReduced, E20.VehicleUseNameplate
- E20.ZordManifested, E20.ZordQRexPortal, E20.ZordAssisted
- E20.AcceleratePrompt, E20.AccelerateConvert, E20.AccelerateWait, E20.AccelerateConvertReady
- E20.JetPackNone

## Rule count

179 rules added on 118 pack documents (counted from the specs inserted into the packs).
