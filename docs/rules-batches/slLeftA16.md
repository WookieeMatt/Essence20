# Round 16, part a (LeftA) - the items rounds 14 and 15 left as code

Scope: the 23 items of `survey/left-a.json` (code in dice.mjs, chat.mjs, documents/actor.mjs, weapon-upgrades.mjs and
power-infusion.mjs), plus the two items that had to move with them (Angry's Hang-Up's rule; Pack Attack's reader of Growl).
Tests: `module/rules/engine16-LeftA.test.js` (23 tests - the pieces), `module/rules/conv16-LeftA.test.js` (25 tests - the
items). Strings: none new (`E20.RulesExtLeftA16` is empty).

## Engine features added 2026-10-07 (round 16, part a)

All new plug-in files are imported in `rules/plugins/index.mjs`'s "Round 16 (part a)" block.

### Flat d20 boxes

- **Rule type `FlatD20`** (`rolls/flat-d20.mjs`) - "treat a d20 result as N without rolling it", as Roll Options Dialog
  boxes decided after the dialog, once the Edge / Snag is settled. dice.mjs builds the d20 operand from
  `ruleFlatD20(actor, options, roll)` (`_getd20Operand`'s flatD20Value / flatBothD20s).
  - A box: `{key, label, value, priority?, limit?, cost?: {resource, amount}, costLabel?, lateWhen?, both?: {label, uses? |
    cost?}}`. Offered while `when` holds, a use is left and the cost can be paid. `both` is a second box: with an Edge or a
    Snag (not both), both d20s count as the value, using `uses` of the limit or paying `cost` more.
  - A change from another item: `{of: <key>, addUses?, lateWhen?, upgrade?: {label, value, cost?, limit?}}`. `addUses`
    widens the limit; its `lateWhen` must hold too (a Hang-Up's "only with an Edge"); `upgrade` is one more box (its value
    instead, for `cost` more, while its own limit lasts).
  - `lateWhen` is asked after the dialog (`roll:edge`, `roll:snag`). A box that can't apply then, or can't be paid in full,
    does nothing and costs nothing, and the next ticked box (by `priority`) is tried. Cost and uses are spent only when a
    box applies. Never on an Initiative roll. Labels may be E20. keys; a cost adds "(N <costLabel>)", "+N" on the extra
    boxes.
  - Dependable, its Hang-Up, Old Reliable, Legendary Dependability.

### Dialog switches

- **DialogSwitch `action` (+ `actionKind`), `baseDamageMultiply`, `backfireOn`** (`dialog/switch-action-cost.mjs`). dice.mjs
  calls `applySwitchActions` where the old Surging / Analyze Target checkboxes spent their actions.
  - `action: free | move | standard`: ticked, the action is spent as the roll is made; when the action economy refuses
    it, the roll is cancelled. `actionKind` names it for the cost changers (`analyzeTarget` - Quick / Swift Study).
  - `baseDamageMultiply: N`: the attack's own damage value (not its damage bonus) is multiplied.
  - `backfireOn: N`: when any d20 of the roll shows N, the roller takes the roll's damage (dice.mjs, with the
    E20.SurgingBackfire line).
  - Analyze Target, Surging.

### Roll facts and hit Triggers

- **RollModifier `key`** (`rolls/once-per-roll.mjs`): whenever the modifier is listed on a roll (even switched off in the
  dialog, as the old "this bonus was on the roll" check read it), the roll carries the key, so hit / miss / afterRoll
  Triggers can ask `roll:switch:<key>`. adapter#ruleRollSources puts it on the source; dice.mjs merges the listed sources'
  keys into the roll's ruleKeys. Growl's ↑, read by Get The Horns.
- **RollModifier `consumeOwn`** (with `consumeMark`): the roll uses up only the copy of a perSetter mark that the
  modifier's holder set (consumer `rulesMarkOwn`, spent before the roll like the other rule marks).
- **Trigger `oncePerRoll: true`** (hit only): the Trigger runs for the first hit of a roll that meets its `when` and limit,
  not for every target hit. `fireTriggers` takes a `once` set; triggers.mjs's hit loop hands one in per roll.
- **hit / miss Triggers get `@var.row`**: the target's row on the card, 0 for the first (`var:row=0` - "the first row").
- **Trigger steps see the roll's rows** (`ctx.facts`), and afterRoll facts carry the check `entries`.
- **Step `targetRowsBeating {defense, required?}`** (`combat/rows-beating.mjs`): in an afterRoll Trigger, the run's targets
  become the creatures rolled against whose plain `defense` (getDefenseValue) the total also meets. A miss on a creature
  whose misses have no effect (MissImmunity) is left out. With none left, the run stops. Explosive Aftershock.

### Timed size changes

- **Step `sizeChange {key, steps? | set?, until? | rounds?, to?}`** (`effects/timed-size.mjs`): the stored size is written
  (the token follows it) and the size before is kept at `flags.essence20.ruleSizeChanges.<key>`.
  - One change per key: while one is live the step leaves it alone; one that ran out is put back first.
  - `until` takes any rule duration. `rounds: N` counts combat rounds (to the same point in the turn order) and ends with
    the combat; out of combat it lasts the encounter.
  - The active GM puts expired changes back when a combat's turn or round changes, when a combat ends and when a new scene
    starts (every world actor and every scene's unlinked token actors).
  - **Tags `self:sizeChanged:<key>` / `target:sizeChanged:<key>`**: the change is live (read-time, so rules stop at once).
  - Scarefying Appearance (`rounds: 10`), Massive Mug of Mammoth Measurements / Petite Pony's Shrink Drink (`set`, shared
    key, `until: scene`).
- **Tag `rule:choiceHas:<key>:<value>`** (`tags/rule-choice-has.mjs`): the rule item's pick under `key` (a list from
  pickMany / pickEach, or one value) holds the value. Scarefying Appearance's benefits.

### Defenses and resistance

- **Defense `{mode: noArmor, outgoing: true, scope: markedTarget, mark}`** (`combat/marked-no-armor.mjs`): on the setter's
  item. An attack on a creature carrying the setter's mark meets its Defense without armor. `when` is asked with self =
  the attacker, holder = the setter, target = the marked creature (`self:sameSideAsHolder` - "you and your teammates").
  dice.mjs asks `ruleMarkedNoArmor` where Exploit Weakness's recompute was. no-armor-defense.mjs leaves markedTarget rules
  out of the attacker's own reading.
- **Tag `card:flag:<key>`** (a CardOffer's card carries that flag) and **recipient `cardTarget`** (in a CardOffer's steps,
  the card's `flags.essence20.targetUuid`). Exploit Weakness.
- **Rule type `AttackResistance {damageTypes}`** (`combat/attack-resistance.mjs`): counts as Resistance for the attacker's
  Resistance Snag only (and `roll:dataset:targetResists`), not as a `system.resistances` entry. Dispersion, with
  `rule:data:system.active`.

### Rerolls, counters, actions

- **Steps `bankReroll {to?, upTo? | values?}` and `rerollLimit {reset?, max?, spend?}`** (`rolls/reroll-bank.mjs`):
  - `bankReroll` writes the banked reroll charge dice.mjs reads (`flags.essence20.bankedReroll`: the next attack rerolls
    those Skill dice faces; used up when an attack succeeds).
  - `rerollLimit` checks, or with `spend` counts, the rule item's own reroll grant's use count (`item:<the item's uuid>`
    in mechanics/rolls/reroll.mjs). So a Use and the item's reactive reroll button share "once per scene".
  - Power Infusion.
- **Step `keyedCount {flag, to?}`** (`resources/keyed-count.mjs`): one more on `flags.essence20.<flag>.<recipient uuid,
  dots as dashes>` on the actor, the counter `@targetKeyed` / `target:keyedOnMe:` read. Analyze Target.
- **`spendActions {atomic: true}`** (edit to `combat/spend-actions-and-turn-queue.mjs`): all or nothing - the actions
  already spent are refunded when one is blocked. Get A Grip.
- **`pick from: skills` `essences: [..]`** (edit to `tags/actor-state-tags.mjs#skillsFor`): Skills of any of those
  Essences. Angry.

### Combat end, Megaforms

- **combatEnd Triggers get `@var.combatId`**, **markText `$var.<key>`** (edit to `marks/mark-value.mjs`) and **text
  `{combat.id}`** (`shared/combat-id-text.mjs`): a mark that keeps the combat it was set in, settled when that combat
  ends (`self:markText:<key>=$var.combatId`). Hard Corps.
- **Megaform contributions** (`zords/megaform-contributions.mjs`), read by documents/actor.mjs and dice.mjs:
  - `MegaformArmor {toughness?, evasion?, form?: megazord | combiner, replacesTrait?}`: a participant adds to the ARMOR
    part of its Megaform's Defenses. `replacesTrait` stops a Megaform Trait's own type from adding anything by itself.
    Formulas read the rule's item. Hardened Chassis, Armored Defense.
  - `MegaformHold {}`: a Combiner form doesn't fall apart while the holder has Health. Keep IT Together!.
  - `MegaformSpecializations {}`: the holder's Specializations merge into the Combiner form's Skills. Better As One.
  - `EnergonDonor {}`: the holder pays the dialog's Energon ↑1 when the form has none (`energonDonor` /
    `payEnergonDonor`). Better As One.

## Verdicts

| Item | Verdict | How |
|---|---|---|
| Dependable (Perk) | converted | FlatD20 box, scene limit, both box with 2 uses |
| Dependable (Hang-Up) | converted | FlatD20 `of: dependable, lateWhen: [roll:edge]` |
| Old Reliable | converted | FlatD20 box costing 1 Moxie, both for 1 more |
| Legendary Dependability | converted | FlatD20 `of` changes: addUses 1 on Dependable, the 15 upgrade on Old Reliable |
| Undo Engine | converted | hit Trigger x2 on a vehicle: actAs operator, roll Driving DIF 20, onFail updateActor + restart button |
| Explosive Aftershock | converted | afterRoll Trigger: targetRowsBeating toughness, one pick, push / prone / deafened / bank ↓1 |
| Analyze Target | converted | DialogSwitch action standard (kind analyzeTarget) + hit Trigger keyedCount |
| Scarefying Appearance | converted | afterRoll Trigger: sizeChange rounds 10, save, pickMany; RollModifiers + Defense addAfter |
| Massive Mug of Mammoth Measurements | converted | afterRoll Trigger: sizeChange set huge, scene |
| Petite Pony's Shrink Drink | converted | afterRoll Trigger: sizeChange set small, scene |
| Get A Grip | converted | DialogSwitch key + hit Trigger oncePerRoll, size gate, spendActions atomic, grappled |
| Dispersion | converted | AttackResistance (energy types) while raised |
| Angry | converted | DialogSwitch edge, once per encounter; steps: require the Hang-Up, pick, mark angrySnag |
| (Angry's Hang-Up) | rule replaced | RollModifier snag `self:markText:angrySnag=$skill` (was check:angrySnag) |
| Growl | converted | Use (target, combat, once per target per turn, open Intimidation roll); hit Trigger row 0 marks; RollModifier ↑1 key growl, consumeOwn |
| Get The Horns | converted | hit Trigger oncePerRoll, melee + roll:switch:growl, re-marks |
| Armored Defense | converted | MegaformArmor toughness = value, replacesTrait |
| Keep IT Together! | converted | MegaformHold |
| Better As One | converted | MegaformSpecializations + EnergonDonor |
| Hardened Chassis | converted | MegaformArmor toughness 1, form megazord |
| Surging | converted | DialogSwitch host: element attacks, action free, baseDamageMultiply 2, backfireOn 1 |
| Power Infusion | converted | Use: Morphed, rerollLimit, 1 Personal Power, bankReroll self + Morphed PCs within 60 ft |
| Hard Corps | converted | applyingDamage lateReductions (first) prompt, once per encounter, mark the debt; combatEnd Trigger |
| Exploit Weakness | converted | CardOffer on own melee cards with a target: DIF 14 Alertness, mark until scene; marked noArmor Defense |
| (Pack Attack) | still code (part b's) | its reader of Growl now looks for the Growler's `growl` mark (items/attacks/pack-attack.mjs#growledBy) |

None is permanent code.

## Bugs found and fixed

- **Scarefying Appearance**: the Frightened save card and the pick-two benefits ran only when the cast was rolled against a
  targeted creature and hit it (spellRiders' "success" was "some targeted row hit"). The spell's ordinary self cast (a DIF
  roll) stepped the size up but never offered the save or the benefits. Both now happen on the successful cast (its first
  row), with the size change. Tested in conv16-LeftA.
- **Power Infusion**: its "once per scene" was counted under `item:<compendium uuid>`, while the item's reactive reroll
  button counts `item:<the actor's item uuid>`, so the two never shared the count as the code meant to. The Use now counts
  under the item's own key (rerollLimit), shared with the button.

## Code vs notes - needs a ruling

- **Petite Pony's Shrink Drink**: its notes say restoring the size at the scene's end is left to the table; the code (and
  now the rule) restores it when the scene ends. Kept the code's behaviour.

## Differences from the old code (engine idioms)

- The dialog boxes are drawn in the generic extension block. DialogSwitch labels are plain text (the same English as
  the old E20.RollDialog* strings); FlatD20 labels still use their E20. keys.
- Legendary Dependability's "15" box is shown only beside Old Reliable's box (before, it showed alone but did nothing).
- The action-economy log names the item (Analyze Target, Surging) instead of E20.ActionAnalyzeTarget / the weapon.
- Explosive Aftershock, Angry, Get A Grip, Growl, Power Infusion post the engine's chat lines (Picked, Banked, Condition,
  Needs a target). Angry with no trained Smarts / Social Skill posts "nothing to pick". Growl outside a combat posts
  "Growl needs a combat." (before, the Use button was unavailable).
- Undo Engine's stall card speaks as the driver, and anyone may press Restart (as before). The button is used up only
  once its steps finish.
- Scarefying Appearance's +2 Intimidation is a listed (switch-off-able) roll source; the save leaves out creatures of
  unknown size; picking no benefit replaces the earlier picks.
- Hard Corps' prompt is titled with the item's name. Its debt is settled by a combatEnd Trigger, on the client that
  ended a started combat (before: the active GM, any combat).
- Power Infusion is used from the item's Use button (the Perk's "Activate" button is gone); with no Personal Power the Use
  isn't offered (before: a warning).
- Exploit Weakness' button is a CardOffer: each holder answers a card once.

## Shared-file edits

module/dice.mjs, module/dice.test.js, module/chat.mjs, module/chat.test.js, module/essence20.mjs, module/documents/actor.mjs,
module/documents/actor.test.js, module/mechanics/combat/target-riders.mjs, module/mechanics/combat/rider-uses.mjs,
module/mechanics/resources/banked-buffs.mjs (+ .test.js), module/items/attacks/pack-attack.mjs (+ .test.js),
module/items/attacks/weapon-upgrades.mjs (+ .test.js), module/sheet-handlers/power-ranger-handler.mjs,
module/sheets/base-actor-sheet.mjs, module/items/resources/consummate-performer.mjs, module/util/config.mjs (comment),
module/items/rolls/no-fighting.mjs (comment), module/apps/roll-options-dialog.mjs, module/mechanics/rolls/roll-dialog.mjs,
templates/dialog/roll-dialog.hbs, templates/actor/parts/items/perk/details.hbs; rules: triggers.mjs (once / @var.row /
ctx.facts / afterRoll entries / combatEnd @var.combatId), adapter.mjs (source key, consumeOwn), plugins/index.mjs,
plugins/combat/no-armor-defense.mjs, plugins/combat/spend-actions-and-turn-queue.mjs, plugins/tags/actor-state-tags.mjs,
plugins/marks/mark-value.mjs, plugins/tags/checks-and-refs.mjs + plugins/shared/lazy-helpers-and-targets.mjs (check:angrySnag
removed), conv10-slC10.test.js, engine10-c.test.js.

Deleted: items/defenses/hard-corps.mjs (+test), items/attacks/exploit-weakness.mjs (+test), items/attacks/growl.mjs (+test),
items/attacks/get-a-grip.mjs (+test), items/attacks/explosive-aftershock.mjs, items/vehicles/undo-engine.mjs (+test),
items/magic/scarefying-appearance.mjs (+test), items/forms/size-change-potions.mjs (+test), items/rolls/angry-influence.mjs
(+test), items/rolls/power-infusion.mjs (+test), items/zords/better-as-one.mjs.

## Unused strings

E20.RollDialogSurging, E20.RollDialogAnalyzeTarget, E20.ActionAnalyzeTarget, E20.RollDialogGetAGrip, E20.PerkGetAGrip,
E20.RollDialogAngry, E20.AngryHangUpPickSkillTitle, E20.AngryHangUpPickSkillLabel, E20.GrowlNoTarget, E20.GrowlUnavailable,
E20.UndoEngineStalled, E20.UndoEngineRestart, E20.ExplosiveAftershockPickTitle, E20.ExplosiveAftershockPickLabel,
E20.ScarefyingPickTwo, E20.ScarefyingPicked, E20.ScarefyingTitle, E20.HardCorpsConfirmTitle, E20.ExploitWeaknessActivate,
E20.PowerInfusionActivate, E20.PowerInfusionActivated, E20.PowerInfusionMissingPerk, E20.PowerInfusionNotMorphed.

## Rule count

36 rules on 24 items (one of them replaces the Angry Hang-Up's existing rule).
