# Batch slB9: re-check of slB8 (`tf1`, `tf2`, `tf3`, `fix3-tf`, `other2`) against the round-9 engine pieces

**Scope:** every item `docs/rules-batches/slB8.md` left Skipped (65), against "Engine features added 2026-10-06 (round 9,
after the local round-8 conversions)" in `docs/RULES_CONVERSION_GUIDE.md` (`to: picked:<key>`, `rollVsEach`, `disarm`,
`takeItem`, `spendAction`, `pick from: targetItem`, pick `minShift` / `maxShift`, `pickGrant {record}` +
`item:pickedSource:`, tracked temporary Health, `grant appendTraits`, `ladderMax` / `ladderMin`, `quiet`,
`@sum.equippedTrait`, `removed` / `droppedToZero`, afterRoll `@var.skill`) and every earlier section (`setTargets` with a
`filter`, `alliesOfTarget`, hit Triggers by outcome, ActionCost, pick `legacy`, `{choice.x}` in tags). Also re-checked: the
behaviour differences slB6 / slB7 / slB8 recorded - none of them is removed by a round-9 piece. Edited in place in the main
checkout (no branch, no commit).

| Verdict (re-checked items) | tf1 + fix3-tf | tf2 | tf3 | other2 | Total |
|---|---|---|---|---|---|
| Convert (no slice code left) | 3 | 0 | 1 | 0 | **4** |
| Partial (more of it converted) | 1 | 0 | 0 | 0 | **1** |
| Still skip | 8 | 13 | 15 | 24 | **60** |
| Re-checked | 12 | 13 | 16 | 24 | **65** |

**10 rules were added to 5 pack items** (Brutal Display 3, Make An Example 2, Comms Assault 1, Flexible Switch 2, One Bot
Over Another 2 - all first `rules` arrays). After this part `scripts/check-rules.mjs` counts 1964 rules on 1202 items,
0 errors (the totals include the other parts' work this round).

## Converted

| Item | Rules | Why it is exact |
|---|---|---|
| Brutal Display (`dditems`) | Use, cost 1 Energon (`system.energon.normal.value`); `beforeCost` steps: `require` the target is Defeated (`status:defeated`, or Health <= 0 with a max > 0 - two `any` lists), `setTargets alliesOfTarget:100000` filtered `[not:target:self, target:within:100, not Defeated]`, `require target:data:uuid` (someone is left); then `mark tf1BrutalDisplayRoll {to: self, until: turnOrScene}`, `rollVsEach {skill: intimidation, defense: willpower}`, `unmark`. Triggers `hit` `when: [self:marked:tf1BrutalDisplayRoll]`: `outcome: plainSuccess` - Frightened 1 round on the target; `outcome: double` - Frightened 10 rounds. | The old Use: the first target had to be Defeated (`isDefeated` = the same two tests), its allies (same disposition) within 100 ft of the holder (`target:within:100` measures from the holder), not Defeated, at least one - else nothing was spent; then 1 Energon and one Intimidation roll against all of them vs Willpower. Its post-roll gave each hit row Frightened for 1 round, 10 on a "crit result" (`multiplier >= 2`, or a Critical Success that hit) - exactly the hit Trigger's `double` vs `plainSuccess` per row. The mark only lives for the roll, so the Triggers answer this roll alone. |
| Make An Example (`dditems`) | Use, cost a Free action; `beforeCost`: the same Defeated `require`, `setTargets alliesOfTarget:30` filtered `[not:target:self, not:target:ally, not Defeated]`, `require target:data:uuid`; then a roll mark, `rollVsEach {intimidation, willpower, onHit: [button "Apply 1 Stun to {target}" {who: targets, steps: [damage 1 stun to target]}]}`, `unmark`. Trigger `hit` `outcome: double` on the mark: Frightened 1 round. | The old Use: Defeated first target, foes (not the holder's disposition, not Defeated) within 30 ft of it, none - no Free action spent; one Intimidation vs Willpower roll; each hit got a Stun 1 damage button that only the target's owner (the GM) could apply, and a crit result (the same `double`) Frightened for 1 round. `who: targets` is that owner-or-GM test. |
| Flexible Switch (`dditems`) | Use `when: [not:combat:exists, self:itemCount:altMode>=2]`: `pick switchA from ownedItem altMode` (`legacy: flags.essence20.switchModes.0`), `pick switchB ... filter: [not:item:picked:switchA]` (`legacy: ...switchModes.1`). ActionCost `conversion -> free`, `ask: E20.Tf1AskFlexibleSwitch`, label "Flexible Switch", `when: [self:transformed, self:itemCount:altMode>=2, {any: [not:rule:data:flags.essence20.rules.choices.switchA, self:data:system.altModeId={choice.switchA}, self:data:system.altModeId={choice.switchB}]}]`. | The old Use (no combat at all, two or more Alt Modes) picked two different owned Alt Modes; the old cost rule (same label, same question) made a conversion Free while transformed with two or more Alt Modes, either with no pair picked yet or when the current `altModeId` is one of the pair. The old `switchModes` pair moves into the two picks through the GM's linking pass. |
| One Bot Over Another (`tf1sitems`) | Use: `choose` - "A Limited melee weapon and a Limited projectile weapon": `pickGrant {record, key: chosen, max: 1, legacy: flags.essence20.tf3Chosen}` from Limited weapons with `item:hasAttack:` a melee style or a reach multiplier, then `pickGrant {record, key: chosen, max: 2}` from Limited weapons with an attack whose style is set and not melee; "A Restricted weapon": `pickGrant {record, key: chosen, max: 1}` from Restricted weapons. Qualification `qualified`, `items: [item:type:weapon, item:pickedSource:chosen]`. | The old Use asked the same two plans, filtered the compendium the same way (`isMeleeEntry` / `isRangedEntry` read the stored attack entries - `item:hasAttack:` reads the same ones off an index row) and kept `[{uuid, name}]` on the Perk; the first pick's `max: 1` starts the list over, so a new plan replaces the old one. `tf3Access` answered `qualified` for a weapon whose source or name matched - `item:pickedSource:` is that test. The old list is the same shape, so `legacy` moves it as it is. |

**Partial:**

| Item | Rules | What stays code |
|---|---|---|
| Comms Assault (`dditems`) | Use, cost a Standard action + 1 Energon; `beforeCost`: `setTargets all:100` filtered `[not:target:ally, not Defeated]`, `require target:data:uuid`; then `mark tf1CommsAssault {to: self, until: turnOrScene}`, `rollVsEach {skill: technology, defense: toughness, onHit: [applyCondition stunned 1 round, button "Apply 1 EMP to {target}" {who: targets, steps: [damage 1 emp]}]}`, `unmark`. | `commsArmorAdjust` (`tf1/combat.mjs`) - the "ignoring armor" part: while the roller carries the rule's `tf1CommsAssault` mark, a Toughness Defense loses `armorOf` (the target's `toughness.armor` plus its equipped armor's `totalBonusToughness`). An outgoing Defense rule can't read the target's equipped-armor sum (`@sum` is the holder's own items). The old `getNearbyEnemyTokens` (any disposition but the holder's, neutral included) is `all:100` + `not:target:ally`. |

Removed: `tf1/combat.mjs` - the Make An Example, Brutal Display and Comms Assault Uses, `defeatedTarget`, `MINUTE_ROUNDS`,
`isCritResult`, the `tf1Brutal` / `tf1Voice` / `tf1Comms` blocks of `tf1CombatPostRoll`, the `ignoringArmor` set (replaced
by the mark test, `COMMS_MARK`), the `applyCondition` / `damageButton` / `rollAgainst` / `spendEnergon` / `tokensNear`
imports; `tf1/common.mjs` - `rollAgainst`, `spendEnergon` (no users left); `tf1/support.mjs` - the Flexible Switch Use,
`FLEXIBLE_SWITCH_RULE` and its `registerCostRule`, the `registerCostRule` / `itemOf` imports; `tf3/uses.mjs` -
`useOneBotOverAnother`, its USES entry, `CHOSEN_FLAG`, `effectsOfEntry` / `isMeleeEntry` / `isRangedEntry`; `tf3/reactions.mjs`
- `tf3Access`, `onRequisitionAccess` and its `essence20.requisitionAccess` hook, `ACCESS_ORDER`, the `CHOSEN_FLAG` / `held`
imports. Old tests changed: `tf1.test.js` (registration test no longer expects the cost rule; the Use test checks the five
Uses are gone; the Comms test now drives the mark; the Flexible Switch test moved to the new file), `tf3.test.js` (the
One Bot Over Another and Unassuming requisition tests moved / dropped with `onRequisitionAccess`).

New tests: `module/rules/conv9-slB9.test.js` (10 tests) - Brutal Display (no Defeated target: nothing spent or rolled;
allies of the fallen within 100 ft of the holder, standing only; Frightened 1 / 10 rounds by row; the roll mark is gone;
nobody in range costs nothing), Make An Example (Free action, foes within 30 ft of the fallen, Stun buttons per hit and
pressing one deals Stun 1, Frightened on a double; no foes - no action spent), Comms Assault (Standard + Energon,
non-allies within 100 ft with neutrals, Toughness minus armor only during the roll, Stunned + EMP button), Flexible Switch
(two distinct picks, the Free conversion only between them, any conversion before a pick, not when untransformed, not in a
combat / with one Alt Mode, the old pair carries over), One Bot Over Another (the melee / projectile / Restricted filters,
plan replacement, Requisition access, the old list carries over).

## Behaviour differences worth a decision

1. **Brutal Display / Make An Example / Comms Assault - cards.** "No Defeated target" and "nobody in range" post a small
   card instead of a warning toast. Each hit's damage button is its own small card ("Apply 1 Stun to <name>") rather than
   one card listing every button; the Use card lists the Conditions applied. A Condition through the GM keeps its rounds
   now (the old relay toggled it on without them).
2. **Brutal Display / Make An Example - who counts as the fallen's ally.** `alliesOfTarget` asks the system's ally test
   (Frenemy / Betrayal / Ally Awareness included) of the fallen creature; for ordinary NPC foes this is the old same-disposition
   test. Make An Example's old foe test was "not the holder's disposition" around the fallen, so a neutral token beside a
   hostile fallen foe was rolled against before and isn't now. A holder with no token on the canvas finds nobody for Brutal
   Display (the old code then measured from the fallen).
3. **Flexible Switch / One Bot Over Another - a cancelled second pick.** The first pick is kept when the second is
   cancelled (the old Use kept the previous pair / list untouched). The picks are labelled by the rule's prompts, not the
   old i18n strings.
4. **Old picks** move over only when the GM's linking pass runs (`legacy`); until then Flexible Switch applies to any
   conversion and One Bot Over Another qualifies nothing.
5. slB8's differences 1-3, slB7's 3-5 and slB6's stand; nothing in round 9 touches them.

## Still skipped (60), and what each still needs

### tf1: combat (`combat.mjs`)
- **Focused Blast.** An unscaled per-hit damage note from a switch, exclusive with the ↑1 (the old select).
- **Target-Rich Environment.** A step that makes a full attack with a picked owned weapon effect (damage, traits, its own card) against every enemy in that effect's range - `rollVsEach` is a bare Skill Test.
- **Show Respect.** The pending → active per-turn hand-off and the pre-roll warning. Effectively permanent code.

### tf1: support (`support.mjs`)
- **They Called It A Glitch!** Granting a picked Perk to another actor with an Active Effect, a max-Health gate, an undo. Effectively permanent code.
- **Alt Mode Mimicry.** An Origin-aware chassis picker. Effectively permanent code.
- **Drone (Origin).** That picker plus writing base Movement / size from the picked entry. Effectively permanent code.
- **Tox-En.** A per-recipient flat-dice attack (`1d20 + 1d8`, keep-highest on touch) against each one's Toughness - `rollVsEach` rolls the actor's Skill.
- **Solid-State Energon.** A two-number prompt with a remembered default and radius damage buttons. Effectively permanent code.

### tf2 (`rolls.mjs`, `uses.mjs`, `modes.mjs`)
- **Cage (rolls and Use).** A rule on the captor reaching the marked prisoner's own rolls, a mark used up by one roll, a Crew-rating capacity check.
- **Deconstruct (Snag and Use).** `pick from: targetItem` covers the pick now; still missing: a flag written on the picked item, a Snag for whoever attacks with a flagged weapon, a Repair Use on the damaged item itself, a DIF from the picked item's Availability.
- **Diversion.** The allies' Edge reaches "same disposition anywhere" and stops once the diverted creature went for the diverter.
- **Sustained Beam.** A re-attack with the same weapon at the same target with Edge, and a "this is the follow-up" roll tag.
- **All Out Attack / Evasive Fighting (TF printings, 2 items).** A number switch writing the rider stance.
- **Arrogant.** A roll-cancel rule over every target's Threat Level and area attacks.
- **We Are One!** A team multi-pick (up to ⌈Social/2⌉; `pick from: team` takes one) with a linked Reroll grant for two picked Skills.
- **Mutant Beast.** A pick over compendium Origins, then over that Origin's child Alt Modes.
- **Roller Drum.** A megaform-component scope for DerivedStat.
- **For The Allspark! (Roll Out).** `setForm` into a picked Alt Mode, Surprised / Mode Lock exception tags on `initiativeRolled`.
- **Not Like That, Like This!** Decorates a teammate's Skill Test card, rerolls all dice, "owed" turns. Effectively permanent code.
- **Scramble Modulator.** Recipients "the hit Combiner's healthiest component(s)" and a Combiner-form tag.

### tf3 (`rolls.mjs`, `uses.mjs`, `reactions.mjs`)
- **Intensive.** A Patch Up event with its amount.
- **Irrefutable Order.** A text-prompt step and spending ANOTHER actor's Move action at its next turn start (`spendAction` is the actor's own, now).
- **Ladder.** A "same side anywhere in the world" scope with a holder-vs-roller size tag; an `actorReach` formula for the Bot Mode Reach.
- **Last Stand.** An act-while-Defeated step (the Story Point stamp + `grantActions` a full turn); `droppedToZero` fires after the fact, not before the Defeat.
- **No Escape.** A watch event for another token's move ending inside the holder's melee Reach, and a melee-Reach value.
- **Roll With It.** A push step (`pushActor` away from the damage source) on a once-per-turn button.
- **Stoic.** A Defense "use Evasion instead of Toughness" mode, and a next-turn Free-action grant for the `combatAllies`.
- **Synch Up.** An attack-range value for the Reaction's `within` (measured to the row's target).
- **Target Breakdown.** `@` refs for Analyze Target counts per target, a repeated action cost, a bank naming one target.
- **Third Dimension.** A MovementAction option for movement after a change of type. Effectively permanent code.
- **Unexpected Alternative.** Per-enemy memory of the Alt Modes they have seen. Effectively permanent code.
- **Whisper Campaign.** A contested-roll step.
- **Deceptive Warfare.** An Initiative re-roll step keeping the higher. Effectively permanent code.
- **Training Through Familiarity (Kit waiver).** A Kit-prerequisite rule type.
- **Water Cannon (the rest).** A Hardpoints option lowering one weapon's slot use.

### other2
- **Pit Plate (Sharp half), Junkplate (Sharp half) (2 items).** A hit-time Blunt → Sharp override on the hit card.
- **Rust Derivatives.** A heal veto and a hit flag with that state.
- **Stasis Cuffs.** Pre-update vetoes and a tether with its own Health.
- **In His Image.** `pick from: targetItem` picks one Hang-Up; still missing: a repeat-until-done loop, deleting the picked item from the target (`takeItem` copies it to the holder), a compendium pick granted onto the target, a DIF of Toughness minus armor, a once-per-target stamp on the target.
- **Hearty Meal.** A rule adding Skills to a named action's skill list.
- **Stim Dart.** A `heal` that goes through I've Got You / Up And At 'Em and the Heal-test result for a Defeated target (the limit and range parts are expressible).
- **Defibrillator.** A delayed step (finish after six rounds). Effectively permanent code.
- **Support, Tech Support (2 items).** Granting a copy of a picked owned item to the target, on a weapon the ally picks. Effectively permanent code.
- **Extended Support.** Changes Support's own cost and duration. Effectively permanent code while Support is.
- **Laser Designator.** A RollModifier reaching every roller, any side and any actor type, against an actor the holder marked.
- **Yo Joe!** Re-preparing the holder's derived data when the round / action ledger changes, and the +10 landing before Shark's Fin's `afterDerived` doubling.
- **Bio-Tech Armor.** An equip-veto rule.
- **Big Rigger, Bigger Rigger (2 items).** Incoming roll modifiers through the `driven` link, and the size-matrix shift as a formula.
- **Delegate.** A step refunding a picked use record on another actor. Effectively permanent code.
- **Explosive Engineer.** A rule clearing another dialog option's flag.
- **Frequency Interference.** Acting on a target's item state, a contested roll, a roll-cancel rule, a Defense removal.
- **Thorn Warlord.** A Defense "use instead" mode.
- **More Bang for your Buck.** A flat post-roll spell damage add (not scaled).
- **Temper Tempest.** A persistent state with a turn-start card, and a button reading the presser's targets. Effectively permanent code.
- **Sorcery (Build a Sorcerous Power).** A builder dialog. Effectively permanent code.
- **Proper Protection (crit note).** Part of the Heal action's own text. Effectively permanent code while the Heal action is.

## Edits outside my files

1. **`module/rules/steps.mjs`, the `button` step** - fill the button's label and intro like a `chat` line, so a button made
   per recipient names its creature (Make An Example's "Apply 1 Stun to {target}", Comms Assault's "Apply 1 EMP to
   {target}"). Without it those labels show the braces literally. Replace

   ```js
       const label = step.label || ctx.item?.name || '';
       const intro = step.intro ? `<p>${escape(step.intro)}</p>` : '';
   ```

   with

   ```js
       const fill = text => fillText(String(text), ctx).replace(/\{name\}/g, ctx.actor?.name ?? '').replace(/\{target\}/g, ctx.targets[0]?.name ?? '');
       const label = step.label ? fill(step.label) : ctx.item?.name || '';
       const intro = step.intro ? `<p>${escape(fill(step.intro))}</p>` : '';
   ```

2. `module/rules/legacy-choices.mjs` reading `legacy` on a recording `pickGrant` (One Bot Over Another's `tf3Chosen`) - already
   in the file (`step?.do == 'pickGrant' && step.record`); nothing to do.

## Unused strings

`E20.Tf1TargetDefeated`, `E20.Tf1VoiceHits`, `E20.Tf1CommsHits`, `E20.Tf1MadeExample`, `E20.Tf1BrutalDone`,
`E20.Tf1CommsDone`, `E20.Tf1NoEnergon`, `E20.Tf1SwitchFirst`, `E20.Tf1SwitchSecond`, `E20.Tf1SwitchSet`,
`E20.Tf3QualPlanPrompt`, `E20.Tf3QualPlanPair`, `E20.Tf3QualPlanRestricted`, `E20.Tf3QualPickMelee`,
`E20.Tf3QualPickRanged`, `E20.Tf3QualPickRestricted`, `E20.Tf3QualChosen`. (`E20.Tf1AskFlexibleSwitch` stays - the
ActionCost rule asks it.)

## Files touched
- Packs (rules inserted as text, CRLF kept): `dditems/_source/Brutal_Display_11Q2KXJ7qxlddusg.json`,
  `dditems/_source/Make_An_Example_mroTcYJKFpAAiqP5.json`, `dditems/_source/Comms_Assault_pKArYQ259zpdsR7o.json`,
  `dditems/_source/Flexible_Switch_pTHenJt0kG3umsUk.json`, `tf1sitems/_source/One_Bot_Over_Another_n5dNCOPVTsqLAapp.json`.
- Slices: `tf1/combat.mjs`, `tf1/common.mjs`, `tf1/support.mjs`, `tf1/tf1.test.js`, `tf3/uses.mjs`, `tf3/reactions.mjs`,
  `tf3/tf3.test.js`.
- New: `module/rules/conv9-slB9.test.js`, this file.

Verification: ESLint clean on `tf1/`, `tf3/` and the new test; `check-rules` 1964 rules / 1202 items, 0 errors; jest on the
five slice folders + every `module/rules/conv*` suite: 42 suites, all pass.

**Rules added: 10 (on 5 items).**

## Engine pieces the remaining skips need (most useful first)

1. **A RollModifier reaching a marked actor's own rolls / rolls against it by anyone** (a `marked:<key>` scope, any side,
   any actor type, a mark used up by one roll) - Cage, Laser Designator, Diversion (with a "went for the diverter" mark),
   Deconstruct (with item marks: a flag on the picked item, a Snag for its attacks, a Repair Use on it, a DIF from its
   Availability). Medium.
2. **Derived refresh on combat changes + a Movement add before `afterDerived` multiplies** - Yo Joe!. Small.
3. **`heal {throughHealer: true}`** (I've Got You / Up And At 'Em, the Heal-test result on a Defeated target) - Stim Dart. Small.
4. **Defense "use instead" mode and a next-turn action grant** - Stoic, Thorn Warlord. Small to medium.
5. **Contested-roll step** - Whisper Campaign, Frequency Interference (with item-state marks and a roll-cancel rule). Medium.
6. **Range / Reach refs and other-token movement** (`@self.meleeReach`, `actorReach` by size, a Reaction `within` measured
   to the row's target, a watchable "moved into my Reach" event) - Synch Up, No Escape, Ladder. Small to medium.
7. **A full-attack-against-each step** (`attackEach {item: choice:<key> | wielded, to}` - the weapon effect's own roll and
   card, against every recipient in its range) and **a flat-dice `rollVsEach`** (`formula: "1d20 + 1d8"` in place of a
   Skill) - Target-Rich Environment, Tox-En. Medium / small.
8. **Multi-pick** (`pick {count, distinct}` over compendium children, a team multi-pick) - Mutant Beast, We Are One!. Medium.
9. **Vetoes and hit-time overrides** (heal / equip / pre-update vetoes, a hit-card damage-type override) - Pit Plate,
   Junkplate, Rust Derivatives, Bio-Tech Armor, Stasis Cuffs. Medium.
10. **Push and act-while-Defeated steps** (`pushActor` away from the damage source; a `wouldBeDefeated` branch that grants a
    full turn first) - Roll With It, Last Stand. Small.
11. **A per-action skill-list rule and a dialog-option clear** - Hearty Meal, Explosive Engineer. Small.
12. **Target-item steps** (`deleteItem {item: choice:<key>}` on the target, a `repeat` wrapper, `grant {to: target}` from a
    compendium pick) - In His Image. Medium.
13. **Smaller one-offs:** a Patch Up event with its amount (Intensive); a megaform-component scope (Roller Drum); a
    Combiner-component recipient (Scramble Modulator); a number switch writing the rider stance (All Out Attack / Evasive
    Fighting TF); a roll-cancel rule (Arrogant); `setForm` into a picked Alt Mode on `initiativeRolled` (Roll Out); a
    follow-up re-attack step with a roll tag (Sustained Beam); a text-prompt step + `spendAction {to: target, atTurnStart}`
    (Irrefutable Order); per-target Analyze counts (Target Breakdown); a Kit-prerequisite rule (Training Through
    Familiarity); a Hardpoints slot-use option (Water Cannon); a hit-time size-shift formula via `driven` (Big / Bigger
    Rigger); an unscaled per-hit damage note from a switch (Focused Blast, More Bang for your Buck); a target-armor sum ref
    (`@target.sum.equipped.armor...`) for an outgoing Defense rule - the rest of Comms Assault. Small each.
14. **Effectively permanent code** (bespoke UI or whole subsystems): Sorcery's builder, Alt Mode Mimicry / Drone Origin
    pickers, Not Like That Like This!, Solid-State Energon, Temper Tempest, Support / Tech Support / Extended Support,
    Delegate, Defibrillator, Deceptive Warfare (Initiative re-roll), Third Dimension (movement API), Unexpected
    Alternative (per-enemy memory), Show Respect, They Called It A Glitch!, Proper Protection's crit note (part of the
    Heal action).
