# Batch slB5: re-check of slB4 (`tf1`, `tf2`, `tf3`, `fix3-tf`, `other2`) against the round-5 engine pieces

**Scope:** every item `docs/rules-batches/slB4.md` left Skipped or Partial (81 skipped + 2 partial remainders, plus
Partnered and Rotor Blades' remainders counted with their slices = 83 re-checked), against "Engine features added
2026-10-05 (round 5, after the local round-4 conversions)" in `docs/RULES_CONVERSION_GUIDE.md` (target:ally|enemy,
var: tags, require + beforeCost, updateActor with `to`, table, {@formula} text, unstarted-combat endOfNextTurn,
consumeMark, Movement afterGravity, pick legacy paths...) and the earlier sections. Also re-checked: slB4's
Covering Fire difference (9), which the unstarted-combat `endOfNextTurn` now removes. Edited in place in the main
checkout (no branch, no commit).

| Verdict (re-checked items) | tf1 + fix3-tf | tf2 | tf3 | other2 | Total |
|---|---|---|---|---|---|
| Convert (no slice code left) | 2 | 4 | 1 | 1 | **8** |
| Partial (more of it converted) | 0 | 0 | 0 | 0 | **0** |
| Still skip | 16 | 16 | 18 | 25 | **75** |
| Re-checked | 18 | 20 | 19 | 26 | **83** |

**12 rules were added to 8 pack items** (6 get their first `rules` array), and 3 existing rule lines were changed
(Partnered's ActionCost `when`, Covering Fire's two `when`s). After this part `scripts/check-rules.mjs` counts 1807
rules on 1146 items with 2 errors, both on `qgtgitems/Desperate_Parry` (another part's item), none on mine.

## Converted

| Item | Rules | Why it is exact |
|---|---|---|
| Feedback Field (`dditems`) | Use, `cost: {action: move, resource: system.energon.normal.value, amount: 1}`, `when: ["not:self:marked:feedbackField"]`: `mark feedbackField until: scene` + a chat line with `{@actor.system.defenses.willpower.total}`. | The old Use paid a Move action then 1 Energon, turned on the `tf1FeedbackField` scene window (= a mark with `until: scene`, as Comms Probe in slB4) and posted the holder's Willpower total; it was offered while the window was off. |
| Partnered (`dditems`, the partner pick) | Use (no cost): `target {min: 0, max: 1}`, then `pick partner from: target, auto` when something is targeted, else `pick partner from: ally` - both with `legacy: "flags.essence20.partner.uuid"`. The ActionCost `when` now reads `{any: [rule:data:flags.essence20.rules.choices.partner, rule:data:flags.essence20.partner]}`. | The old Use took the first target, else a picker over every ally on the scene (`getNearbyAllyTokens(actor, Infinity)`, the same list `from: ally` gives), no action. The Free-action Lend Assistance only ever tested "a partner is set" - it still does, for a new pick or an old flag (the linking pass moves the old uuid into the pick). |
| Broad Understanding (`tfcrbitems`) | RollModifier `specialize`, `when: [skill:science, self:specializedIn:science, {any: [not:combat:exists, self:marked:appliedScience]}]`; RollModifier `specialize`, `consumeMark: appliedScience`, `when: [..., combat:exists, self:marked:appliedScience, not:roll:initiative]`; RollModifier `downshift: 2`, the first `when` plus `not:roll:specialized`, `not:roll:initiative`. | `tf2Specializes` (registerSpecializes - the hook `ruleSpecializes` answers) made Science Specialized with a Science Specialization when no combat existed (`!game.combat` = `not:combat:exists`) or the Applied Science flag was set; the ↓2 came off a Specialization roll only (`!isSpecialized && !specializationKey` - what `roll:specialized` reads from the same dataset, before dice.mjs marks the roll Specialized); a Science roll in a combat used the flag up whether Specialized or not (the specialize-only rule's `consumeMark`; consumes are pushed even when a rule adds no shift). Roll sources never reached Initiative. |
| Applied Science (`tfcrbitems`) | Two Uses (no cost) like Overcharge Engines': `not:self:hasItem:<Multiplication>` with `limit {per: scene, max: 1, key: appliedScience}`, and `self:hasItem:<Multiplication>` with `max: 2` on the same key; each `mark appliedScience` (no `until`) + a chat line. | The old Use counted `getUses(..., 'scene') < (Multiplication ? 2 : 1)` on the scene clock (the engine's scene limit is the same clock) and set a flag that stayed until a Science roll in combat used it. |
| Determine Probability (`tfcrbitems`) | Use, `cost: {action: free}`, `limit: {per: turn, max: 1}`: `pick skill from: skill` (`beforeCost`), then `roll {skill: "{choice.skill}", open: true}`. | The old Use asked the Skill first (backing out cost nothing), paid a Free action, was once per turn in combat (`hasUsedThisTurn`) and unlimited out of it, and made an ordinary `rollSkill` of that Skill with its own Essence. |
| Energon Bank (`tfcrbitems`) | Use, `cost: {resource: system.energon.normal.value, amount: 1}`: `target`, `require` (`when: not:target:within:30`, check `target:within:30`), `require target:data:system.energon.normal` (all `beforeCost`), `updateActor {to: target, add: {system.energon.normal.value: 1}}`, chat. | Needs a target; a known distance over 30 ft stops it (off the canvas there is none to check, as before); a target with no Energon stops it silently; only then 1 Energon is taken and the target gains 1 with no maximum (the old `value + 1` through the GM relay - `updateActor` writes the same way). No action. |
| Grant His Hunger (`dditems`) | Use, `cost: {action: standard}`: `target` + touch `require` (5 ft, same shape as above, `beforeCost`), `roll culture dif: "@target.system.defenses.cleverness.total"`; on a failure a chat line; on a success `table 1d2` whose rows drain 1 / 2: `updateActor` on the target (Energon down, `min: 0`) when `{any: [target:canTransform, target:data:system.energon.normal.max>0]}`, else `table 1d4` → `essenceDamage` of that amount to Strength / Speed / Smarts / Social. | The old Use checked target and touch, paid Standard, rolled Culture against the target's Cleverness total, rolled 1d2, and drained Energon (never below 0) from a creature with Energon (`hasEnergon`: canTransform or Energon max > 0), else did that much damage to a uniformly random Essence through `applyEssenceDamage` (what `essenceDamage` calls for an owned target). |
| Rotor Blades (`tfcrbitems`, the rest - now fully rules) | Movement `aerial`, `op: max`, `value: floor(@actor.system.movement.ground.total / 2)`, `stage: afterGravity`, `when: [self:canTransform, self:transformed]`; DamageModifier `dealt` +1 (the unscaled hit note), `when: [item:granted, not:target:canTransform, not:target:tag:robot / mechanical / vehicle / structure / object / cybertronian / drone / zord]`. | `tf3Derived` raised Aerial to half the Ground total in Alt Mode, after gravity (derived data ran after `_applyGravityMovement`); `rotorHit` added a `damageBonusNote` of 1 on each hit made with the weapon the gear granted (`gearOfWeapon` = `grantedBy`, what `item:granted` reads) against a target with none of those creature tags that can't transform (`isOrganic`, the same `creatureTagsOf`). |

Re-checked converted item: **Covering Fire** (`tfcrbitems`) - its two `miss` Triggers now split on `combat:exists` /
`not:combat:exists` instead of `combat` / `not:combat`. A miss in a combat that is set up but not started now banks the
in-combat Snag, counted from the first round (the round-5 `endOfNextTurn` stamp), as the old mark did - slB3 difference 4
/ slB4 difference 9 is gone.

Removed: `tf1/support.mjs` - the Feedback Field and Partnered Uses and the `getNearbyAllyTokens`, scene-clock
(`activateForWindow`, `isActiveForWindow`), `safe` and `spendEnergon` imports; `tf1/common.mjs` - `TF1.feedbackField`,
`TF1.partnered`; `tf2/rolls.mjs` - `APPLIED_SCIENCE_FLAG`, `hasScienceSpecialization`, `broadUnderstandingApplies`,
`tf2Specializes` and its registration, the Broad Understanding source / consume, the `lastRoll` map the pre-roll hook kept
for it, the `tf2AppliedScience` consumer, the `registerSpecializes` import; `tf2/uses.mjs` - the Determine Probability,
Energon Bank and Applied Science Uses, the `perks.mjs` import, `say`, `writeActor` and `APPLIED_SCIENCE_FLAG` imports;
`tf2/common.mjs` - `TF2.appliedScience`, `multiplication`, `broadUnderstanding`, `determineProbability`, `energonBank`;
`tf3/rolls.mjs` - the Rotor Blades Aerial block, `gearOfWeaponUuid`, `NOT_ORGANIC`, `isOrganic`, `rotorHit` and its
`registerHitRider`, the `gearOfWeapon` import; `tf3/common.mjs` - `gearOfWeapon`, `TF3.rotorBlades`, `TF3.towCable`;
`other2/decepticon.mjs` - the Grant His Hunger Use, `hasEnergon`, `O2_DD.grantHisHunger`, the Stasis Cuffs veto's
`o2AllowCuffed` escape (only Grant His Hunger passed it) and the `feetBetween` import. Old tests changed: `tf2.test.js`
(the Broad Understanding and Applied Science tests become a "these are rules now" check), `tf3.test.js` (the derived test
keeps Ladder / Water Cannon, Rotor Blades' Aerial now stays 0 there), `other2.test.js` (the Rites test keeps In His Image
and checks Grant His Hunger is gone), `tf1.test.js` (Feedback Field / Partnered Uses gone).

New tests: `module/rules/conv5-slB5.test.js` (18 tests) - Feedback Field (Move + Energon, Willpower DIF in chat, hidden
for the scene, unaffordable), Partnered (first target taken without asking, ally picker without a target, the
ActionCost following the pick, legacy flag moved), Broad Understanding / Applied Science (out of combat, Specialization
rolls, other Skills, no Specialization, unstarted combat, used up by the next Science roll even Specialized, never by
Initiative, kept out of combat, once / twice per scene), Determine Probability (cancel costs nothing, Free action, open
roll, once per turn in combat only), Energon Bank (past the maximum, off-canvas, out of range / no target / no Energon
spend nothing), Grant His Hunger (Cleverness DIF, 1d2 drain never below 0, random Essence, failure, out of reach before
paying), Rotor Blades (Aerial by stage and mode, never lowering; +1 only with its own blades against organic targets, every
non-organic tag), Covering Fire (unstarted combat banks the in-combat Snag; no combat banks the scene one).

## Behaviour differences worth a decision

All Transformers / Decepticon Directive.
1. **Grant His Hunger vs Stasis Cuffs.** The old drain wrote with `{o2AllowCuffed: true}` to step past the cuffs' "can't
   spend Energon" veto; `updateActor` passes no options, so a cuffed target's Energon can't be drained now (the rite still
   rolls). Needs an engine option (see the list) if this pairing matters.
2. **Targeting yourself.** Energon Bank and Grant His Hunger used to refuse a self-target; there is no "target is me"
   tag, so Energon Bank moves the point to yourself (no change, a card) and Grant His Hunger rolls against your own
   Cleverness. Partnered with yourself targeted picks you instead of opening the ally list.
3. **Rotor Blades' Aerial moved earlier.** It is set at the `afterGravity` stage, before the extensions' derived pass; with
   My Allies Are My Shield's Movement trade active (tf1, +10 per trade to every speed above 0) the trade now also lands on
   the new Aerial, and doesn't feed the half-Ground. Only that pairing. The rules (and the +1 damage) now need the gear
   equipped, as the gear's other rules already did (accepted in slB2-slB4).
4. **Determine Probability's limit.** In a combat set up but not started it is unlimited (the engine's turn limit needs a
   started combat; the old stamp blocked a second use until the turn changed), and a cancelled roll doesn't use the turn.
   The `open` roll now passes the Skill's own sheet shifts (the round-5 engine change; the old call passed 0/0).
5. **Feedback Field / Energon Bank without Energon.** The Use button hides instead of warning; Energon Bank with nothing
   targeted posts a small "needs a target" card as well as the warning.
6. **Partnered with several targets** takes the first, as before; the old `{uuid, name}` flag is moved into the pick by
   the GM's linking pass, and the ActionCost also still accepts the old flag until then.
7. **Broad Understanding.** "Has a Science Specialization" is `self:specializedIn:science` (a named Specialization, or a
   not-yet-migrated Specialization item) rather than "the specializations object has a key". An Applied Science flag set
   before the update (`tf2AppliedScience`) is ignored (transitional - use it again). The ↓2 is labelled by the rule.
8. **Chat.** All the converted Uses post the engine's Use card ("<item>: <label>" plus step lines) instead of their
   `E20.Tf1...` / `E20.Tf2...` / `E20.O2...` lines; the dice the Grant His Hunger tables roll are told in the card.
9. **Feedback Field's window.** A field raised before the update (`tf1FeedbackField` scene flag) isn't seen (one scene).

## Still skipped (75), and what each still needs

### tf1: combat (`combat.mjs`)
- **Brutal Display.** Recipients "the Defeated target's allies within 100 ft" (measured from the target, its side), a crit-scaled per-target Condition duration.
- **Make An Example.** Recipients "foes within 30 ft of the Defeated target", the per-hit crit Frightened.
- **Comms Assault.** A per-roll "ignore armor" Toughness mode, and a roll step against every enemy within 100 ft.
- **Focused Blast.** An unscaled per-hit damage note from a switch, exclusive with the ↑1.
- **Steady Firepower.** Per-holder marks reset when the favorite weapon hits another target (or any other weapon attacks), and an outgoing Defense amount read from the count.
- **Target-Rich Environment.** A step rolling a picked owned weapon effect against every enemy in its range.
- **My Allies Are My Shield.** A per-attack Defense from `@count.allies.30` minus a trade counter, a Use gate comparing them, Movement +10 per trade only on speeds above 0.
- **Show Respect.** The pending → active per-turn hand-off and the pre-roll warning.

### tf1: support (`support.mjs`)
- **They Called It A Glitch!** Granting a picked Perk to another actor with an Active Effect, a "max Health would drop to 1" gate, an undo removing both. Effectively permanent code.
- **Flexible Switch.** A two-item distinct multi-pick and a tag comparing `system.altModeId` with the picks.
- **Alt Mode Mimicry.** An Origin-aware chassis picker. Effectively permanent code.
- **Drone (Origin).** That picker plus writing base Movement / size from the picked entry. Effectively permanent code.
- **Tox-En.** A per-victim flat roll (`1d20 + 1d8`, `2d20kh` on touch) against each one's Toughness; `extendCondition` by 10 in a combat, else apply for 10.
- **Solid-State Energon.** A two-number prompt with a remembered default and radius damage buttons. Effectively permanent code.

### tf1 / fix3-tf remainders
- **Fearsome Additions (Alt Mode ↑1).** A whole-word name match (`/\b(ram|slam|flyby)\b/i`); `item:name~` is a substring match.
- **Watchful Eyes.** The attempt is "Alertness against a flat DIF 10": afterRoll Triggers see neither the dataset nor the DIF (`roll:dataset:dif=10` answers unknown there). The target-side half (`target:enemy` filter, a bank with `appliesWhen: [ownTurn]`, `until: endOfNextTurn`, `untilOf: recipient`) is expressible now.

### tf2 (`rolls.mjs`, `uses.mjs`, `modes.mjs`)
- **Cage (rolls and Use).** A rule on the captor applying to the marked prisoner's own rolls, a mark flag used up by one roll, a Crew-rating capacity check.
- **Deconstruct (Snag and Use).** A rule for anyone rolling a marked item, `pick` over a target's items, a DIF from the picked item, a "Kit" name test.
- **Diversion.** The allies' Edge reaches "same disposition anywhere on the scene" and stops once the diverted creature went for the diverter; `endOfNextRound` has no out-of-combat (scene) form.
- **Duke It Out.** A "Standard action not used this turn" tag, a Use that pays after a `choose`, a level gate letting an unrated target through, the accepted duel's contested roll.
- **Sustained Beam.** A re-attack with the same weapon at the same target with Edge, and a "this is the follow-up" roll tag.
- **All Out Attack / Evasive Fighting (TF printings, 2 items).** A number switch writing the rider stance, and telling the G.I. JOE printing apart.
- **Arrogant.** A roll-cancel rule over every target's Threat Level and area attacks.
- **We Are One!** A team multi-pick (up to ⌈Social/2⌉) with a linked Reroll grant for two picked Skills.
- **Mutant Beast.** A pick over compendium Origins, then over that Origin's child Alt Modes; a "fewer than two Alt Modes" gate.
- **Roller Drum.** A megaform-component scope for DerivedStat.
- **Dust Up.** A Trigger event for moving on one's own turn.
- **For The Allspark! (Roll Out).** `setForm` into a picked Alt Mode, and Surprised / Mode Lock exception tags on `initiativeRolled`.
- **Not Like That, Like This!** Decorates any teammate's Skill Test card, rerolls all dice without keeping the better, "owed" turn handling. Effectively permanent code.
- **Scramble Modulator.** Recipients "the hit Combiner's healthiest component(s)" and a Combiner-form tag.
- **Lingering Side Effects.** A Trigger for another item (an Alt Mode) being added.

### tf3 (`rolls.mjs`, `uses.mjs`, `reactions.mjs`)
- **Intensive.** A Patch Up event with its amount.
- **Irrefutable Order.** A text-prompt step, spending another actor's Move action at its next turn start, a `target:levelDiff` gate before the cost.
- **Ladder.** A "same side anywhere in the world" scope; a Reach formula (`actorReach` by size) for the Bot Mode Reach.
- **Last Stand.** An act-while-Defeated step and a whispered button card (the attacker is now `takesDamage`'s target).
- **Martyr.** An "allied combatants" recipient / scope (the combat's allied combatants, live; `team` is every PC, combat or not).
- **No Escape.** A Trigger event for other tokens' movement, and a melee-Reach value.
- **Roll With It.** A push step (`pushActor` away from the damage source), with a once-per-turn button.
- **Stoic.** A Defense "use Evasion instead of Toughness" mode, a next-turn Free-action grant for allied combatants.
- **Synch Up.** An attack-range value for the Reaction's `within` (measured to the row's target).
- **Target Breakdown.** `@` refs for Analyze Target counts per target, a repeated action cost, a bank naming one target.
- **Third Dimension.** A MovementAction option for movement after a change of type. Effectively permanent code.
- **Unassuming.** A tag for "every weapon effect is one-handed" in a Qualification.
- **Unexpected Alternative.** Per-enemy memory of the Alt Modes they have seen. Effectively permanent code.
- **Whisper Campaign.** A contested-roll step.
- **Deceptive Warfare.** An Initiative re-roll step keeping the higher (`writeInitiative` sets a value; it can't roll). Effectively permanent code.
- **One Bot Over Another.** A compendium-filtered multi-pick and a Qualification reading the picks.
- **Training Through Familiarity (Kit waiver).** A Kit-prerequisite rule type.
- **Water Cannon (the rest).** A Hardpoints option lowering one weapon's slot use.

### other2
- **Pit Plate (Sharp half), Junkplate (Sharp half) (2 items).** A hit-time Blunt → Sharp override on the hit card (crit repeat included).
- **Rust Derivatives.** A heal veto and a hit flag with that state.
- **Stasis Cuffs.** Pre-update vetoes and a tether with its own Health.
- **In His Image.** Picking and removing the target's Hang-Ups, a repeated compendium pick onto the target, a once-per-target flag, a DIF of Toughness minus armor.
- **Hearty Meal.** A rule adding Skills to a named action's skill list.
- **Stim Dart.** A Use limit counted by carried items, a range-dependent roll, a branch on the target's Defeated state.
- **Defibrillator.** A delayed step (finish after six rounds, cancelled when combat changes). Effectively permanent code.
- **Support, Tech Support (2 items).** Granting a copy of a picked owned item to the target, attached to a weapon the ally picks. Effectively permanent code.
- **Extended Support.** Changes Support's own cost and duration (Support stays code).
- **Laser Designator.** A mark carrying a roll modifier for every roller against the marked actor.
- **Yo Joe!** Round-number and action-ledger tags in derived data.
- **Bio-Tech Armor.** An equip-veto rule.
- **Big Rigger, Bigger Rigger (2 items).** Incoming roll modifiers through the `driven` link, and the size-matrix shift as a formula.
- **Gunport.** The rolled sidearm isn't the Gunport's host (it sits on a shield), so `host:` / `item:onHost` don't reach it.
- **Delegate.** A step refunding a picked use record on another actor. Effectively permanent code.
- **Explosive Engineer.** A rule clearing another dialog option's flag.
- **Frequency Interference.** Acting on a target's item state, a contested roll, a roll-cancel rule, a Defense removal.
- **Thorn Warlord.** A Defense "use instead" mode.
- **More Bang for your Buck.** A flat post-roll spell damage add (not scaled).
- **Temper Tempest.** A persistent state with a turn-start card, and a button reading the presser's current targets (button cards carry the poster's). Effectively permanent code.
- **Sorcery (Build a Sorcerous Power).** A builder dialog. Effectively permanent code.
- **Proper Protection (crit note).** Part of the Heal action's own text; no rule hook there.

## Edits outside my files
None needed. (Optional, for whoever owns `module/rules/triggers.mjs` + `module/dice.mjs`: handing afterRoll Triggers the
roll's DIF - `vars: { total, dif: results[0].difficulty }` in the `registerPostRoll` handler - would let Watchful Eyes
become rules and dice.mjs's `isWatchfulEyesAttempt` go; not done here.)

## Unused strings
`E20.Tf1FeedbackOn`, `E20.Tf1PickPartner`, `E20.Tf1PartnerSet`, `E20.Tf2DetermineProbabilitySkill`,
`E20.Tf2DetermineProbabilityRolling`, `E20.Tf2DetermineProbabilityDone`, `E20.Tf2EnergonBankGave`, `E20.Tf2OutOfRange`,
`E20.Tf2AppliedScience`, `E20.O2HungerEnergon`, `E20.O2HungerEssence`.

## Files touched
- Packs (rules inserted as text, CRLF kept): `dditems/_source/` Feedback_Field, Grant_His_Hunger (new arrays), Partnered
  (Use appended, ActionCost `when` changed); `tfcrbitems/_source/` Broad_Understanding, Applied_Science, Energon_Bank,
  Determine_Probability (new arrays), Rotor_Blades (appended), Covering_Fire (`when`s changed).
- Slices: `tf1/support.mjs`, `tf1/common.mjs`, `tf1/tf1.test.js`, `tf2/rolls.mjs`, `tf2/uses.mjs`, `tf2/common.mjs`,
  `tf2/tf2.test.js`, `tf3/rolls.mjs`, `tf3/common.mjs`, `tf3/tf3.test.js`, `other2/decepticon.mjs`, `other2/other2.test.js`.
- New: `module/rules/conv5-slB5.test.js`, this file.

Verification: ESLint clean on the five slice folders and the new test; `check-rules` 0 errors on my items (2 on another
part's Desperate Parry); jest on the five slice folders + `conv3-slB3` / `conv4-slB4` / `conv5-slB5`: 8 suites, 110 tests
passed. `module/rules` + `module/helpers/extensions` as a whole: 67 of 68 suites (1894 tests) pass - the failing one
is `conv5-slD5.test.js` (Desperate Parry validation, Projectile Deflector), another part's items. (The old Partnered
ActionCost test in `conversions.test.js` still passes: the ActionCost accepts the old flag too.)

**Rules added: 12** (plus 3 existing rule lines changed).

## Engine pieces the remaining skips need (most useful first)
1. **The roll's DIF / dataset in afterRoll Triggers** (`var:dif`, or `roll:dataset:` answering there) - Watchful Eyes
   (and lets dice.mjs's `isWatchfulEyesAttempt` go). Small.
2. **A RollModifier reaching a marked actor's own rolls** (a `marked:<key>` scope: the rule on the marker applies to rolls
   by - or against - whoever carries its mark) - Cage, Laser Designator, Diversion (with a second "went for the diverter"
   mark), Deconstruct (with item marks). Medium.
3. **Recipients measured from the target** (`alliesOfTarget:<ft>` / `enemiesNearTarget:<ft>`) and condition rounds from
   the hit's outcome - Brutal Display, Make An Example. Small to medium.
4. **An "allied combatants" recipient / scope** (the current combat's combatants on the holder's side, live) - Martyr,
   Stoic's ally Free actions. Small to medium.
5. **A per-recipient roll step** (`rollEach {formula | skill, vs: <Defense>, ignoreArmor?, onHit}`) - Tox-En, Comms
   Assault, Target-Rich Environment (with a picked attack). Medium.
6. **Per-holder mark bookkeeping and an outgoing Defense amount** (`unmark {to: allMarkedByMe, except: target}`, Defense
   `outgoing` with a formula) - Steady Firepower, My Allies Are My Shield. Medium.
7. **Range / Reach refs** (`@self.attackRange`, `@self.meleeReach`, an `actorReach` by size) and a Reaction `within`
   measured to the row's target - Synch Up, No Escape, Ladder. Small to medium.
8. **Action-ledger tags** (`self:actionUsed:standard`, `combat:round:1` exists) and spending another actor's action at
   its next turn - Duke It Out, Yo Joe!, Irrefutable Order. Small.
9. **Multi-pick** (`pick {count: 2, distinct}`, compendium-filtered picks) and a `self:altMode:picked:<key>` tag -
   Flexible Switch, One Bot Over Another, Mutant Beast, We Are One!. Medium.
10. **Vetoes and hit-time overrides** (heal / equip / pre-update vetoes, a hit-card damage-type override, an `updateActor`
   option a veto lets through) - Pit Plate, Junkplate, Rust Derivatives, Bio-Tech Armor, Stasis Cuffs, and Grant His
   Hunger's difference 1. Medium.
11. **Contested-roll step** - Whisper Campaign, Frequency Interference, Duke It Out's duel. Medium.
12. **Push step** (`pushActor` away from the damage source, which `takesDamage` now names) - Roll With It; an
   act-while-Defeated step for Last Stand. Small.
13. **Item-count formula refs** (`@count.items.<tag>`) for limits - Stim Dart (plus a range-dependent roll). Small.
14. **A Movement stage after the extensions' derived pass** - removes Rotor Blades' difference 3. Small.
15. Effectively permanent code (bespoke UI or whole subsystems): Sorcery's builder, Alt Mode Mimicry / Drone Origin
    pickers, Not Like That Like This!, Solid-State Energon, Temper Tempest, Support / Tech Support / Extended Support /
    Delegate, Defibrillator, Deceptive Warfare (Initiative re-roll), Third Dimension (movement API), Unexpected
    Alternative (per-enemy memory), Show Respect, They Called It A Glitch!.
