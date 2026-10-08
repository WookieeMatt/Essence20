# Batch slB8: re-check of slB7 (`tf1`, `tf2`, `tf3`, `fix3-tf`, `other2`) against the round-8 engine pieces

**Scope:** every item `docs/rules-batches/slB7.md` left Skipped (67), against "Engine features added 2026-10-06 (round 8,
after the local round-7 conversions)" in `docs/RULES_CONVERSION_GUIDE.md` (marks per setter, `@target.myMark`, `@sum`,
`@count.named`, `atLeast()`, `until: mission`, `self:combatant`, `scene:token:`, pick from actors, `setVar`, the
`updateActor` ladder, `itemAdded` / `movedOnTurn`, the button / Rest / WeaponTrait fixes) and the earlier sections. Also
re-checked: slB7's behaviour differences - the two "shared mark" ones (Steady Firepower, Duke It Out) are fixed with
`perSetter`. Edited in place in the main checkout (no branch, no commit).

| Verdict (re-checked items) | tf1 + fix3-tf | tf2 | tf3 | other2 | Total |
|---|---|---|---|---|---|
| Convert (no slice code left) | 0 | 2 | 0 | 0 | **2** |
| Partial (more of it converted) | 0 | 0 | 0 | 0 | **0** |
| Still skip | 12 | 13 | 16 | 24 | **65** |
| Re-checked | 12 | 15 | 16 | 24 | **67** |
| Earlier conversions fixed (behaviour difference removed) | 1 | 1 | 0 | 0 | **2** |

**3 rules were added to 2 pack items** (Lingering Side Effects and Dust Up get their first `rules` array), and **4
existing rules were edited** (Steady Firepower's three, Duke It Out's Use). After this part `scripts/check-rules.mjs`
counts 1907 rules on 1183 items, 0 errors (the totals include the other parts' work this round).

## Converted

| Item | Rules | Why it is exact |
|---|---|---|
| Lingering Side Effects (`tsitems`, Hang-Up) | Trigger `itemAdded` `when: [item:type:altMode, self:itemCount:altMode>2]`: chat "{name} has Lingering Side Effects: a Mutant Beast can't acquire a third Alt Mode." | The old `createItem` hook (the creating user's client, an Actor parent) warned when the arriving item was an Alt Mode and the actor now had more than two. `itemAdded` is the same hook, with the new item as `item:`; `self:itemCount:altMode` counts the actor's items including the new one, as `itemsOf` did. |
| Dust Up (`tfcrbitems`) | Trigger `movedOnTurn` `when: [not:self:marked:dustUp]`: `mark dustUpCover {to: self, when: [not:self:status:cover]}`, `applyCondition cover {to: self, when: [self:marked:dustUpCover]}`, `mark dustUp {to: self}`. Trigger `turnStart` `when: [self:marked:dustUp]`: `removeCondition cover {when: [self:marked:dustUpCover]}`, `unmark dustUpCover`, `unmark dustUp`. | The old `updateToken` hook: the mover's client, x / y changed, a started combat, the actor's own turn (`movedOnTurn` checks all of these), and no `tf2DustUp` flag yet - it added Cover unless already there and set the flag with `applied`. At the actor's next turn start it took Cover off only if it had added it (and it is still on), then cleared the flag. The two marks are that flag (no `until`: like the flag, they last until a turn start of the actor clears them) and its `applied` field. |

**Fixed with `perSetter` (slB7's behaviour differences 1 and 2):**

| Item | Change | Effect |
|---|---|---|
| Steady Firepower (`dditems`) | Both `mark` steps take `perSetter: true`; the Defense amount reads `0 - @target.myMark.steadyFire`. | Each holder keeps its own count on a creature, as the old per-holder record did (two holders on one creature no longer share or take over one count). `markedByMe:steadyFire` reads the holder's own mark. |
| Duke It Out (`tfcrbitems`) | The refusal `mark` takes `perSetter: true`. | Two challengers refused by the same creature each keep their own Edge (the old per-challenger rider marks), instead of the last one winning. |

Removed: `tf2/modes.mjs` - the Dust Up and Lingering Side Effects doc lines, `DUST_UP_FLAG`, the Dust Up block in the
`registerTurnStart` handler, the `createItem` hook (it only held the Lingering Side Effects warning) and the Dust Up
`updateToken` hook, the `isOwnTurn` import; `tf2/common.mjs` - `TF2.lingeringSideEffects`, `TF2.dustUp`. Neither item had
an old test.

New tests: `module/rules/conv8-slB8.test.js` (7 tests) - Lingering Side Effects (third Alt Mode warns through the real
`createItem` hook; first / second / another item type / no Hang-Up do not), Dust Up (through the real `updateToken` hook:
Cover once per turn, off at the next turn start, again the turn after; Cover already held is left alone; not on another's
turn, not in an unstarted combat, not without the Perk), Steady Firepower (two holders, separate counts and resets, scene
length), Duke It Out (two refused challengers both keep Edge).

## Behaviour differences worth a decision

1. **Lingering Side Effects - no toast.** The warning is the chat card only; the old code also raised a warning
   notification. A Hang-Up the player has matured past (`maturedIgnored`) no longer warns (its rules are inactive) - the
   old code warned anyway.
2. **Dust Up - chat line.** Adding Cover posts a small "Dust Up" card with the Condition line; the old code was silent. A
   `tf2DustUp` flag left from before the update is ignored (transitional - until that actor's next turn start).
3. **Steady Firepower / Duke It Out - old shared marks.** A mark written before this update under the plain key is still
   read by its setter (`markedByMe` / `myMark` fall back to it) until it runs out (the scene / next turn).
4. slB7's differences 3-5 (Gunport traits and label, Fearsome Additions' word breaks, Unassuming's null hands) and slB6's
   (Watchful Eyes, Martyr, My Allies Are My Shield, Rotor Blades) stand; nothing in round 8 touches them.

## Still skipped (65), and what each still needs

### tf1: combat (`combat.mjs`)
- **Brutal Display.** A roll step against every recipient's Defense (one card, a row each, hit Triggers per row).
- **Make An Example.** The same multi-target roll vs Willpower, plus Stun 1 damage buttons per hit.
- **Comms Assault.** The same multi-target roll vs Toughness with an "ignore armor" mode.
- **Focused Blast.** An unscaled per-hit damage note from a switch, exclusive with the ↑1 (the old select).
- **Target-Rich Environment.** A step rolling a picked owned weapon effect against every enemy in its range.
- **Show Respect.** The pending → active per-turn hand-off and the pre-roll warning. Effectively permanent code.

### tf1: support (`support.mjs`)
- **They Called It A Glitch!** Granting a picked Perk to another actor with an Active Effect, a max-Health gate, an undo. Effectively permanent code.
- **Flexible Switch.** A two-item distinct multi-pick and a tag comparing `system.altModeId` with the picks.
- **Alt Mode Mimicry.** An Origin-aware chassis picker. Effectively permanent code.
- **Drone (Origin).** That picker plus writing base Movement / size from the picked entry. Effectively permanent code.
- **Tox-En.** A per-recipient flat roll (`1d20 + 1d8`, keep-highest on touch) against each one's Toughness.
- **Solid-State Energon.** A two-number prompt with a remembered default and radius damage buttons. Effectively permanent code.

### tf2 (`rolls.mjs`, `uses.mjs`, `modes.mjs`)
- **Cage (rolls and Use).** A rule on the captor reaching the marked prisoner's own rolls, a mark used up by one roll, a Crew-rating capacity check.
- **Deconstruct (Snag and Use).** A rule for anyone rolling a marked item, a pick over a target's items, a DIF from the picked item.
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
- **Irrefutable Order.** A text-prompt step and spending another actor's Move action at its next turn start.
- **Ladder.** A "same side anywhere in the world" scope with a holder-vs-roller size tag; an `actorReach` formula for the Bot Mode Reach.
- **Last Stand.** An act-while-Defeated step (the Story Point stamp + `grantActions` a full turn).
- **No Escape.** A watch event for another token's move ending inside the holder's melee Reach (`movedOnTurn` is the actor's own move, and only on its turn), and a melee-Reach value.
- **Roll With It.** A push step (`pushActor` away from the damage source) on a once-per-turn button.
- **Stoic.** A Defense "use Evasion instead of Toughness" mode, and a next-turn Free-action grant for the `combatAllies`.
- **Synch Up.** An attack-range value for the Reaction's `within` (measured to the row's target).
- **Target Breakdown.** `@` refs for Analyze Target counts per target, a repeated action cost, a bank naming one target.
- **Third Dimension.** A MovementAction option for movement after a change of type. Effectively permanent code.
- **Unexpected Alternative.** Per-enemy memory of the Alt Modes they have seen. Effectively permanent code.
- **Whisper Campaign.** A contested-roll step.
- **Deceptive Warfare.** An Initiative re-roll step keeping the higher. Effectively permanent code.
- **One Bot Over Another.** A compendium-filtered multi-pick and a Qualification reading the picks.
- **Training Through Familiarity (Kit waiver).** A Kit-prerequisite rule type.
- **Water Cannon (the rest).** A Hardpoints option lowering one weapon's slot use.

### other2
- **Pit Plate (Sharp half), Junkplate (Sharp half) (2 items).** A hit-time Blunt → Sharp override on the hit card.
- **Rust Derivatives.** A heal veto and a hit flag with that state.
- **Stasis Cuffs.** Pre-update vetoes and a tether with its own Health.
- **In His Image.** Picking and removing the target's Hang-Ups, a repeated compendium pick onto the target, a DIF of Toughness minus armor.
- **Hearty Meal.** A rule adding Skills to a named action's skill list (the once-per-mission part is `limit: {per: mission}`).
- **Stim Dart.** The use limit is expressible now (`limit: {per: mission, max: "@count.named.stim_dart"}` - the Perk itself is the "1", every carried Stim Dart item adds one; the old count left out other Perks only), and the range branch is `target:within:5`; still missing: a `heal` that goes through I've Got You / Up And At 'Em and the Heal-test result (`restoreHealth`) for a Defeated target.
- **Defibrillator.** A delayed step (finish after six rounds). Effectively permanent code.
- **Support, Tech Support (2 items).** Granting a copy of a picked owned item to the target, on a weapon the ally picks. Effectively permanent code.
- **Extended Support.** Changes Support's own cost and duration (Support stays code). Effectively permanent code while Support is.
- **Laser Designator.** A RollModifier reaching every roller, any side and any actor type, against an actor the holder marked (a `team` scope leaves out NPCs and companions, which the old source reached).
- **Yo Joe!** `self:combatant` and `self:actionUsed:standard` cover the test now; still missing: re-preparing the holder's derived data when the round or the action ledger changes (the slice resets the actor on `updateCombat` / `updateCombatant`), and the +10 landing before Shark's Fin's `afterDerived` doubling (an `afterDerived` add runs after the multiply - 70 instead of 80).
- **Bio-Tech Armor.** An equip-veto rule.
- **Big Rigger, Bigger Rigger (2 items).** Incoming roll modifiers through the `driven` link, and the size-matrix shift as a formula.
- **Delegate.** A step refunding a picked use record on another actor. Effectively permanent code.
- **Explosive Engineer.** A rule clearing another dialog option's flag.
- **Frequency Interference.** Acting on a target's item state, a contested roll, a roll-cancel rule, a Defense removal.
- **Thorn Warlord.** A Defense "use instead" mode.
- **More Bang for your Buck.** A flat post-roll spell damage add (not scaled).
- **Temper Tempest.** A persistent state with a turn-start card, and a button reading the presser's targets. Effectively permanent code.
- **Sorcery (Build a Sorcerous Power).** A builder dialog. Effectively permanent code.
- **Proper Protection (crit note).** Part of the Heal action's own text; no rule hook there. Effectively permanent code while the Heal action is.

## Edits outside my files

None.

## Unused strings
`E20.Tf2LingeringWarn` (the warning text now lives in the rule's chat step).

## Files touched
- Packs (rules inserted / edited as text, LF kept): `tsitems/_source/Lingering_Side_Effects_jDRfmpsy1ElT2Kkn.json`,
  `tfcrbitems/_source/Dust_Up_7aKjiqEZ3LYuvwmu.json`, `tfcrbitems/_source/Duke_It_Out_jkuNDvRt4D9jyDsn.json`,
  `dditems/_source/Steady_Firepower_svqVyP2tyYzSUtn6.json`.
- Slices: `tf2/modes.mjs`, `tf2/common.mjs`.
- New: `module/rules/conv8-slB8.test.js`, this file.

Verification: ESLint clean on `tf2/` and the new test; `check-rules` 1907 rules / 1183 items, 0 errors; jest on the five
slice folders + `conv3-slB3` .. `conv8-slB8`: 11 suites, 140 tests pass. `module/rules` + `module/helpers/extensions` as a
whole: 82 of 83 suites pass - the failing one is `extensions/data22/mlp.test.js` (another part's slice; it fails to load,
0 of its tests run).

**Rules added: 3 (plus 4 edited).**

## Engine pieces the remaining skips need (most useful first)
1. **A roll step against every recipient's Defense** (`roll {skill, defense, to: <recipients>}`, one card with a row per
   creature so hit Triggers / `double` / `plainSuccess` apply per row; `ignoreArmor`; a flat formula / picked attack
   variant) - Brutal Display, Make An Example, Comms Assault, Target-Rich Environment, Tox-En. Medium.
2. **A RollModifier reaching a marked actor's own rolls / rolls against it by anyone** (a `marked:<key>` scope, any side,
   any actor type) - Cage, Laser Designator, Diversion (with a "went for the diverter" mark), Deconstruct (with item marks).
   Medium.
3. **Derived refresh on combat changes + a Movement add before `afterDerived` multiplies** (re-prepare actors whose
   Movement / DerivedStat rules read `combat:` / `self:actionUsed` when the round, turn or ledger moves; a stage or an
   `order` that lands with the hand-written derived adjustments) - Yo Joe!. Small.
4. **`heal {throughHealer: true}`** (heal as the Heal action does: I've Got You / Up And At 'Em bonuses, the Heal-test
   result on a Defeated target) - Stim Dart (everything else it needs exists). Small.
5. **Defense "use instead" mode and a next-turn action grant** (`mode: use, from: evasion`; `grantActions {nextTurn: true}`)
   - Stoic, Thorn Warlord. Small to medium.
6. **Contested-roll step** - Whisper Campaign, Frequency Interference. Medium.
7. **Range / Reach refs and other-token movement** (`@self.attackRange`, `@self.meleeReach`, `actorReach` by size, a
   Reaction `within` measured to the row's target, a watchable "moved into my Reach" event) - Synch Up, No Escape, Ladder.
   Small to medium.
8. **Multi-pick** (`pick {count, distinct}`, compendium-filtered picks, a pick-dependent Qualification, a team multi-pick)
   - Flexible Switch, One Bot Over Another, Mutant Beast, We Are One!. Medium.
9. **Vetoes and hit-time overrides** (heal / equip / pre-update vetoes, a hit-card damage-type override) - Pit Plate,
   Junkplate, Rust Derivatives, Bio-Tech Armor, Stasis Cuffs. Medium.
10. **Push and act-while-Defeated steps** (`pushActor` away from the damage source; the Defeated-acting stamp + full-turn
    grant) - Roll With It, Last Stand. Small.
11. **A per-action skill-list rule and a dialog-option clear** - Hearty Meal, Explosive Engineer. Small.
12. **Smaller one-offs:** a Patch Up event with its amount (Intensive); a megaform-component scope (Roller Drum); a
    Combiner-component recipient (Scramble Modulator); a number switch writing the rider stance (All Out Attack / Evasive
    Fighting TF); a roll-cancel rule (Arrogant); `setForm` into a picked Alt Mode on `initiativeRolled` (Roll Out); a
    follow-up re-attack step with a roll tag (Sustained Beam); a text-prompt step + spending another actor's action
    (Irrefutable Order); per-target Analyze counts (Target Breakdown); a Kit-prerequisite rule (Training Through
    Familiarity); a Hardpoints slot-use option (Water Cannon); a hit-time size-shift formula via `driven` (Big / Bigger
    Rigger); an unscaled per-hit damage note from a switch (Focused Blast, More Bang for your Buck); Hang-Up pick-and-remove
    on a target (In His Image). Small each, In His Image medium.
13. **Effectively permanent code** (bespoke UI or whole subsystems): Sorcery's builder, Alt Mode Mimicry / Drone Origin
    pickers, Not Like That Like This!, Solid-State Energon, Temper Tempest, Support / Tech Support / Extended Support,
    Delegate, Defibrillator, Deceptive Warfare (Initiative re-roll), Third Dimension (movement API), Unexpected
    Alternative (per-enemy memory), Show Respect, They Called It A Glitch!, Proper Protection's crit note (part of the
    Heal action).
