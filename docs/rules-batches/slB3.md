# Batch slB3: re-check of slB2 (`tf1`, `tf2`, `tf3`, `fix3-tf`, `other2`) against the 2026-10-05 engine pieces

**Scope:** every item `docs/rules-batches/slB2.md` left Skipped, plus the code half of every item it left Partial (95
items), re-checked against "Engine features added 2026-10-05 (after slice round 2)" in
`docs/RULES_CONVERSION_GUIDE.md`: the new durations (`endOfNextTurn`, `turnOrScene`, `roundOrScene`, `rounds:N`,
`untilOf: recipient`), watch Triggers, Reaction rules (`negateHit` / `lowerTotal` / `lateSnag` / `convertRows`),
button limits, dice in formulas / `@target` in step formulas / `{var.x}` in chat, `legacy` picks, `rule:granted` /
`item:granted`, and `createItem` children. Edited in place in the main checkout (no branch, no commit).

| Verdict (re-checked items) | tf1 + fix3-tf | tf2 | tf3 | other2 | Total |
|---|---|---|---|---|---|
| Convert (now fully rules) | 2 | 0 | 0 | 0 | **2** |
| Partial (more of it converted) | 0 | 0 | 2 | 0 | **2** |
| Still skip / still partial | 25 | 20 | 20 | 26 | **91** |
| Re-checked | 27 | 20 | 22 | 26 | **95** |

**6 rules were added to 4 pack items** (2 of them get their first `rules` array). After this part,
`scripts/check-rules.mjs` counts 1618 rules on 1092 items (other agents are adding rules at the same time), with 0
errors and 0 warnings.

## Converted

| Item | Rules | Why it is exact |
|---|---|---|
| Fearsome Voice (`dditems`) | (1) Use "Add the attack", `when: ["not:rule:granted"]`, one `createItem` step: a `weapon` named Fearsome Voice (`classification.size: sidearm`, `availability: standard`, `equipped: true`, `hardpoint.type: none`, flag `natural: true`) with one child `weaponEffect` (Intimidation, energy style, Stun 1, vs Willpower, 1 target, 0 hands, range 20/60). (2) Trigger `event: hit, outcome: double, when: ["item:granted"]` → `applyCondition {to: target, condition: frightened, rounds: 1}`. | The old Use made the same weapon + attack pair (same system data) and was hidden while any item with `grantedBy == perk.id` existed; `not:rule:granted` is that exact test, and `createItem` stamps `grantedBy` the same way. The old hit rider applied Frightened for 1 round (`applyTimedCondition`, relayed through the GM when needed) when the rolled attack was the Voice's and `multiplier >= 2 \|\| (isCrit && success)`. A `hit` Trigger only fires on a hit, and `outcome: double` matches `double` (Degrees of Success x2+) or `crit` - the same set. `applyCondition` makes the same relay / `applyTimedCondition(target, 'frightened', 1)` call. `item:granted` is true for the attack itself or through its weapon, so attacks made by the old Use (whose effect has no `grantedBy` but whose weapon does) keep their crit. Make An Example's roll has no item, so it gets nothing from this rule, as before (its own crit Frightened stays code). |
| Covering Fire (`tfcrbitems`) | (1) Trigger `event: miss, when: ["attack", "combat"]` → `bank {to: target, snag: true, appliesWhen: ["attack", "ownTurn"], uses: 99, until: endOfNextTurn, untilOf: recipient}`. (2) Trigger `event: miss, when: ["attack", "not:combat"]` → `bank {to: target, snag: true, appliesWhen: ["attack"], until: scene}` (one use). | The old post-roll hook ran on a weapon attack (`checkContext.isAttack` = the rolled item is a weaponEffect, the same fact `attack` reads) for each target it missed, and marked it. In combat the mark lasted to the end of the MARKED creature's next turn (`nextTurnWindow`: this round if its turn is still to come, else next round - exactly `endOfNextTurn` with `untilOf: recipient`) and gave a Snag on every attack it made on its own turn (`isOwnTurn` = `ownTurn` in a started combat); `uses: 99` stands for "not used up" (no creature makes 99 attacks in one turn). Out of combat the mark was `once` and carried the scene epoch: one Snag on the next attack, gone with the scene - `until: scene`, one use. The Snag reaches the target through the rules bank (an automatic roll source labelled with the Perk's name, as the old mark was), written through the GM relay when needed, as `writeMark` did. |

Removed: the `tf1FearsomeVoice` Use (`tf1/combat.mjs#COMBAT_USES`), its crit branch in `tf1CombatHitRider`, the
`fearsomeVoice` id in `tf1/common.mjs`, the Covering Fire mark write in `fix3-tf/tf-fixes.mjs#tfFixPostRoll`, its roll
source in `tfFixRollSources` (and the unused `isAttack` local), `FIX3_TF.coveringFire` and `KIND.coveringFire`, and the
two Covering Fire tests in `fix3-tf/tf-fixes.test.js`. `tf1/tf1.test.js`'s Use-matching test now checks Make An Example
(and that Fearsome Voice no longer has a code Use). The old Fearsome Voice Use had no test of its own.

## Partial (more converted)

| Item | Converted now | Rule | Still code |
|---|---|---|---|
| Rotor Blades (`tfcrbitems`) | The Bot Mode ↑1 | RollModifier `upshift: 1`, `when: ["attack", {any: [skill:finesse, skill:might]}, "item:granted", {any: ["self:trained:weapons.closeCombatHeavyBlade", "self:data:system.qualified.weapons.closeCombatHeavyBlade"]}]`, appended as rule 2 | The +1 damage against organic targets (`rotorHit`), the Alt Mode Aerial (`tf3Derived`), the shared weapon Use |
| Tow Cable & Hook (`tfcrbitems`) | The Bot Mode ↑1 switch | DialogSwitch `upshift: 1, forget: true`, `when: ["item:type:weaponEffect", "item:granted", {any: [skill:finesse, skill:might]}]`, appended as rule 3 | The shared weapon Use |

Why it is exact:
- **Rotor Blades.** The old automatic source needed `isAttack`, a Finesse or Might roll, a rolled attack whose weapon
  was granted by the Rotor Blades gear (`gearKind`: the weapon's `grantedBy` is the gear's id and the gear's source is
  Rotor Blades), and `trainedWith(actor, 'closeCombatHeavyBlade')` = Trained OR Qualified. The rule sits on the gear, so
  `item:granted` (the rolled attack's weapon has `grantedBy` == the rule's item) is the same test; the two `self:` tags
  are the two halves of `trainedWith`. Every tag answers true/false (never "unknown"), so it never becomes a switch.
- **Tow Cable & Hook.** The old checkbox was offered while holding the gear, on a Finesse / Might roll with an attack whose
  weapon the gear granted (no Training check - the player declares it), always started unticked and was not remembered,
  and added `shiftUp += 1`. `item:type:weaponEffect` makes a roll with no item answer false (so no switch on a plain
  Skill Test), `item:granted` is `gearKind == towCable`, `forget` keeps it unticked, and the rule switch adds `upshift: 1`
  to the same total.

Removed: the Rotor Blades source in `tf3/rolls.mjs#tf3RollSources`, the Tow Cable toggle in `tf3Toggles` and its
`tf3TowTrained` apply, the now-unused `gearKind` and `trainedWith` helpers and the `parentWeapon` import, the header
comment's list, and the Rotor Blades test in `tf3/tf3.test.js`. `gearOfWeaponUuid` stays for `rotorHit`.

New tests: `module/rules/conv3-slB3.test.js` (7 tests) - Rotor Blades (skills, own weapon only, Trained / Qualified,
never a switch), Tow Cable (offered / not offered, unticked, ↑1), Fearsome Voice (the Use's two items and data, hidden
afterwards; crit / double Frightened, not an ordinary hit or another weapon), Covering Fire (in combat: only on its own
next turn, every attack, gone after it; out of combat: once, gone with the scene; a hit or a non-attack marks nothing).

## Behaviour differences worth a decision

All same-line (Transformers) unless said.
1. **Fearsome Voice, names.** The weapon and attack are always named "Fearsome Voice"; the old Use used the Perk's own
   name, so a renamed copy of the Perk made a differently named attack. `createItem` names take `{choice.x}`, not the
   item's name.
2. **Fearsome Voice, the attack is attached like a compendium weapon's.** The child attack now also carries `grantedBy`
   and is registered in the weapon's `system.items` (`collectionId`), so it shows under its weapon, and deleting the Perk
   removes both items (before, the attack could be left behind). It no longer carries the unused `tf1FearsomeVoice` flag.
3. **Fearsome Voice, chat.** The Use card is the engine's ("Fearsome Voice: Add the attack" / "Granted") instead of
   `E20.Tf1Granted`; the crit Frightened now posts a small Trigger card where the old hit rider was silent, and it runs
   in the post-roll Triggers rather than among the hit riders (same targets, same result).
4. **Covering Fire, a combat that exists but hasn't started.** The engine's `combat` tag needs a started combat. A miss
   in an unstarted combat now banks the out-of-combat Snag (the target's next attack, any time); before, it waited for the
   target's turn once the combat started. This is the same missing "combat exists" tag listed below.
5. **Covering Fire, scene change mid-combat.** The in-combat Snag no longer also ends when the GM advances the scene
   (the old mark carried the scene epoch); the turn window still ends it.
6. **Covering Fire, chat and repeats.** Each miss posts a Trigger card ("Banked: Snag"), where the old mark was silent.
   Several misses bank several entries instead of replacing one mark per attacker; Snags don't stack, so the roll is the
   same.
7. **Gear rules need the gear active** (Rotor Blades, Tow Cable): as accepted in slB2 for the same items' Triggers, a
   stowed (unequipped) gear item gives no ↑1. Rules apply per copy of the gear and match the gear's own id rather than its
   compendium source, and the labels are fixed text ("Trained with a Heavy Blade (Rotor Blades: ↑1)", "Trained with a
   Grappler (Tow Cable & Hook: ↑1)") instead of the item's localized name. The Tow Cable switch is named `rule-<item>-3`
   and is listed after the hand-written toggles.

## Still skipped (91), and what each still needs

### tf1: combat (`combat.mjs`)
- **Brutal Display.** Recipients "the Defeated target's allies within 100 ft" (by its disposition), a Defeated-target gate on a Use, and a crit-scaled per-target Condition duration.
- **Make An Example.** Recipients "foes within 30 ft of the Defeated target", the Defeated-target gate, and the per-hit crit for its Frightened.
- **Comms Assault.** A per-roll "ignore armor" Toughness mode (`commsArmorAdjust`) and enemies-within-100-ft targeting for a roll step.
- **Focused Blast.** A switch-gated, unscaled per-hit damage note, kept exclusive with the ↑1 (none / ↑1 / +1 damage select).
- **Steady Firepower.** Per-target, per-scene counters on marks, and an outgoing Defense amount read from them.
- **Target-Rich Environment.** A step that rolls a picked owned weapon effect of the favorite weapon against every enemy in its range.
- **My Allies Are My Shield.** A per-attack Defense from `@count.allies.30` minus a tradeable counter that also feeds Movement.
- **Show Respect.** A watch `afterRoll` Trigger (enemy crit) could record the foe, but the pending → active per-turn hand-off and the pre-roll warning have no rule form.
- **Easy In, Easy Out.** `conditionGained` + `setToggle` + a `turnStart` `removeCondition` would do it in a started combat; still needs a "combat exists" tag (the old stamp needs only `game.combat`).

### tf1: support (`support.mjs`)
- **Loaded Questions.** Per-target counters on marks, and a shift formula reading them.
- **Comms Probe.** Tied to False Data: its scene flag is read by False Data's Use.
- **False Data.** An open-ended `roll` step (a plain Skill Test with no DIF through the normal dialog).
- **Feedback Field.** `{var.x}` now works in chat, but no step puts the holder's Willpower total into a var (only `askNumber` sets one).
- **Mine!** The open-ended `roll` step, and a `choose` that runs before the cost.
- **Picking Up the Trail.** The open-ended `roll` step.
- **They Called It A Glitch!** Granting a picked Perk to another actor with an Active Effect (-2 maximum Health), a "would drop maximum Health to 1 or lower" gate, and an undo that removes both.
- **Flexible Switch.** A two-item multi-pick (the second excluding the first), a "combat exists" tag, and a tag comparing `system.altModeId` with the picks.
- **Alt Mode Mimicry.** An Origin-aware chassis picker (size class, different Origins, count raised by Alt Mode Mastery).
- **Drone (Origin).** That picker, plus steps that write actor data (base Movement, size) from the picked entry.
- **Tox-En.** Dice in formulas now cover `1d20 + 1d8`, but it still needs a per-victim roll against each one's Toughness (with `2d20kh` Edge), an Essence-damage step, and an extend-Condition step.
- **Solid-State Energon.** Dice now cover `1d2 + damage`; still needs a two-number prompt whose stored-points default persists on the item, a branch on the comparison, and damage buttons in a radius computed from the points.

### tf1 partial remainders, fix3-tf
- **Fearsome Additions (Alt Mode ↑1).** A whole-word item name match (`/\b(ram|slam|flyby)\b/i`); `item:name~` is a substring match.
- **Partnered (the partner pick).** `legacy` can move an old flag, but the old value is an object `{uuid, name}` that the ActionCost rule reads at `flags.essence20.partner`; still needs `pick` writing that flag path (or the ActionCost rule reading the pick) and a "use the target if there is one" option (the old picker lists every ally anywhere, `pick {from: ally}` asks over `sideActorsWithin`).
- **Predacon (the Frightened end).** A mark with `endOfNextTurn` + `untilOf: recipient` has run out by the time the turn-end hook fires, and a watch `turnEnd` Trigger needs both tokens on the canvas. With a non-expiring mark it is close, but the old Frightened still ends in a combat that existed unstarted when it was applied; without a "combat exists" tag the rules version would leave it on. Needs that tag (or a Condition duration "until the end of the target's next turn").
- **Watchful Eyes.** `afterRoll` + `roll:dataset:dif=10` + `skill:alertness` finds the attempt, but the bank has to reach every targeted ENEMY only: `to: targets` takes every targeted token and a step's `when` sees only the first target. Needs a per-recipient filter on steps (or `to: "targetedEnemies"`).

### tf2 (`rolls.mjs`, `uses.mjs`, `modes.mjs`)
- **Broad Understanding.** A "combat exists" tag, a one-roll lift Applied Science banks and both of its rules read, and a `limit.max` that depends on holding Multiplication.
- **Applied Science.** Goes with Broad Understanding.
- **Cage (rolls and Use).** A rule on the captor applying to the marked prisoner's own rolls, a mark used up by one roll, and a Crew-rating capacity check on the mark step.
- **Deconstruct (Snag and Use).** A rule for anyone rolling a marked item, `pick` over a target's items, a DIF from the picked item's Requisition Difficulty, and a "Kit" name test.
- **Diversion (Snag, allies' Edge, Use).** A "same disposition anywhere on the scene" scope and a mark that changes (`attackedHolder`) instead of going away.
- **Duke It Out (Edge and Use).** A "Standard action not used this turn" tag, a Use that pays after a `choose`, and a level gate that lets an unrated target through.
- **Sustained Beam.** A re-attack with the same weapon at the same target with Edge, and a "this is the follow-up" roll tag.
- **All Out Attack / Evasive Fighting (TF printings, 2 items).** A switch that writes the rider stance and `allOutAttackShifts`, and telling the G.I. JOE printing apart (same name).
- **Arrogant.** A roll-cancel rule with tags over every target's Threat Level and area attacks.
- **Determine Probability.** A roll step through the full Roll Options Dialog with a picked Skill.
- **Energon Bank.** `gainResource` with `to` and no `.max` cap.
- **We Are One!** A team pick (up to ⌈Social/2⌉) with a linked Reroll grant for two picked Skills.
- **Mutant Beast.** A `pickGrant` over a picked Origin's child Alt Modes, and a "fewer than two Alt Modes" gate.
- **Roller Drum.** A megaform-component scope for DerivedStat.
- **Dust Up.** A Trigger event for moving on one's own turn.
- **For The Allspark! (Roll Out).** `setForm` transforming into a picked Alt Mode, and Surprised / Mode Lock exception tags.
- **Not Like That, Like This!** Reaction rules can now decorate a teammate's card, but no card step rerolls a finished roll keeping the better result (`lateSnag` keeps the lower), and the "owed" test with its turn-start / turn-end handling is still missing.
- **Scramble Modulator.** Recipients "the hit Combiner's healthiest component(s)" and a "target is a Combiner form" tag.
- **Lingering Side Effects.** A Trigger for another item being added.

### tf3 (`rolls.mjs`, `uses.mjs`, `reactions.mjs`)
- **Holographic Doubles.** A scene-expiring counter read as the ↓ count on an incoming modifier, and a weapon-attack narrowing of `targeted`.
- **Intensive.** A Patch Up event with its amount, and a rule hook for patch-up.mjs's once-per-turn lift.
- **Irrefutable Order.** A text-prompt step, spending another actor's Move action at its next turn start, and a `target:levelDiff` gate on a Use.
- **Ladder.** A "same side anywhere in the world" scope, and an actor-Reach formula for the Bot Mode unarmed Reach x2.
- **Last Stand.** The attacker as `defeated`'s target, an act-while-Defeated step, and a whispered button card.
- **Martyr.** A watch `defeated` could fire for allies, but the Edge lasts "the rest of this combat": needs a combat-scoped duration (`until: encounter` is the scene clock).
- **No Escape.** A Trigger event for other tokens' movement, and a melee-Reach value.
- **Roll With It.** Button limits now give "once per turn", but it still needs a push / forced-movement step (`pushActor`), and the old attacker comes from `lastApplyContext`.
- **Stoic.** A Use storing a picked number for a Defense formula, a Toughness → Evasion Defense swap, and a next-turn action grant for allies.
- **Synch Up.** A Reaction `who: allyOfAttacker, outcome: miss, attackOnly` with a per-turn limit and `bonusAttack {cost: none}` fits, but the old range is holder-to-defender within the holder's longest equipped weapon range (`attackRange`); Reaction `within` measures to the attacker and is a fixed number. Needs an attack-range value (or `within` measured to the row's target with a formula).
- **Target Breakdown.** `@` refs for Analyze Target counts, a repeated action cost, and a bank `appliesWhen` naming one target.
- **The Right Of All Sentient Beings.** A combat-scoped duration and a "combat exists" tag.
- **Third Dimension.** A MovementAction option for counting movement after a change of movement type.
- **Unassuming.** A tag for "every weapon effect is one-handed".
- **Unexpected Alternative.** Per-enemy memory of the Alt Modes they have seen.
- **Whisper Campaign.** A contested-roll step.
- **Deceptive Warfare.** An Initiative-reset step.
- **One Bot Over Another.** `legacy` could move `tf3Chosen`, but it holds a list of `{uuid, name}`; still needs a compendium-filtered pick (Limited melee / projectile, or Restricted) and a Qualification reading the picks (the old match also accepts the name).
- **Rotor Blades (the rest).** An organic-creature tag for the +1 damage, a late derived stage for the Alt Mode Aerial, and for the weapon Use (below).
- **Tow Cable & Hook (the rest) / the shared gear weapon Use.** `grant` + `not:rule:granted:type:weapon` would hide it correctly, but `grant` can't rename the copy to the gear's name, add the Integrated trait, or set `equipped` from the current mode (`!isTransformed`); `createItem` would need the compendium weapon's whole data inline. Needs `name` / `integrated` options on `grant` and a formula / tag-driven `system` override.
- **Water Cannon (the rest).** A Hardpoints option that lowers one weapon's slot use, plus the weapon Use above.
- **Training Through Familiarity (Kit waiver).** A Kit-prerequisite rule type (or a rules hook in the Kit prerequisite code).

### other2
- **Pit Plate (Sharp half), Junkplate (Sharp half).** A hit-time Blunt → Sharp override on the hit card.
- **Rust Derivatives.** A heal veto ("can't regain Health") and a hit flag with that state.
- **Stasis Cuffs.** Pre-update vetoes (no converting / Energon spend while cuffed) and a tether with its own Health.
- **Grant His Hunger.** Dice in formulas now cover `1d2`; still needs an Energon-vs-Essence branch on the target and an Essence-damage step on a random Essence.
- **In His Image.** Picking and removing the target's Hang-Ups, a repeated compendium pick onto the target, a once-per-target flag, and a DIF of Toughness minus armor.
- **Hearty Meal.** A rule adding Skills to a named action's skill list, once per mission.
- **Stim Dart.** A Use limit counted by carried items, a range-dependent roll, and a branch on the target's Defeated state.
- **Defibrillator.** A delayed step (finish after six rounds, cancelled when combat changes).
- **Support, Tech Support (2 items).** Granting a copy of a picked owned item to the target, attached to a weapon the ally picks, with the turn / scene expiry.
- **Extended Support.** Changes Support's own cost and duration (Support stays code).
- **Laser Designator.** A mark carrying a roll modifier for every roller against the marked actor.
- **Yo Joe!** Round-number and action-ledger tags in derived data.
- **Bio-Tech Armor.** An equip-veto rule.
- **Big Rigger, Bigger Rigger (2 items).** Incoming roll modifiers through the `driven` link, and the size-matrix shift as a formula.
- **Gunport.** `host:` tags at roll time.
- **Delegate.** A step that refunds a picked use record on another actor.
- **Explosive Engineer.** A rule that clears another dialog option's flag.
- **Frequency Interference.** Acting on a target's item state, a contested roll, a roll-cancel rule and a Defense removal.
- **Thorn Warlord.** A Defense "use instead" mode.
- **More Bang for your Buck.** A flat post-roll spell damage add.
- **Temper Tempest.** A persistent state with a turn-start card, and a button reading the presser's current targets.
- **Sorcery (Build a Sorcerous Power).** A builder dialog computing the Power's data and cost.
- **Proper Protection (crit note).** Part of the Heal action's own text (`healAction`); no rule hook there.

## Engine pieces the remaining skips need (most useful first)
1. **A "combat exists" tag** (started or not) and a **combat-scoped duration**: Easy In Easy Out, Predacon, Flexible Switch,
   Broad Understanding / Applied Science, Martyr, The Right Of All Sentient Beings (and it would remove Covering Fire's
   difference 4).
2. **`grant` with `name` / `integrated` and computed `system` overrides**: the shared Rotor Blades / Tow Cable / Water Cannon
   weapon Use.
3. **A per-recipient filter on steps** (`to: targets` with `filter: [target: tags]`): Watchful Eyes.
4. **An attack-range value** (formula ref or Reaction `within` to the row's target): Synch Up; a melee-Reach one for No Escape.
5. **Open-ended `roll` step** (no DIF, normal dialog): False Data, Mine!, Picking Up the Trail, Comms Probe.
6. **Counters on marks** read by shifts / Defense: Loaded Questions, Steady Firepower, My Allies Are My Shield, Holographic Doubles.
7. **Essence-damage and extend-Condition steps**: Tox-En, Grant His Hunger.
8. Everything else as listed per item (pre-update vetoes, hit-time damage type, delayed steps, contested rolls, pushes,
   Initiative reset, item / Origin pickers, other-actor item steps).

## Edits outside my files
None.

## Unused strings
- `E20.Tf1Granted` (Fearsome Voice's old Use card)
- `E20.Tf3ToggleTowTrained` (Tow Cable's old checkbox)

## Files touched
- Packs (rules inserted as text, CRLF kept): `packs/dditems/_source/Fearsome_Voice_ZQl2qzyBNHUYYHS5.json` (new array, 2
  rules), `packs/tfcrbitems/_source/Covering_Fire_cAm087BkiExKIJrY.json` (new array, 2 rules),
  `packs/tfcrbitems/_source/Rotor_Blades_jkZQIpL661klm5sP.json` (1 rule appended),
  `packs/tfcrbitems/_source/Tow_Cable___Hook_EVywnYUDjBfMcoWT.json` (1 rule appended).
- Slices: `tf1/combat.mjs`, `tf1/common.mjs`, `tf1/tf1.test.js`, `tf3/rolls.mjs`, `tf3/tf3.test.js`,
  `fix3-tf/tf-fixes.mjs`, `fix3-tf/tf-fixes.test.js`. No slice file became empty.
- New: `module/rules/conv3-slB3.test.js`, this file.

Verification: ESLint clean on the touched files; `check-rules` 0 errors / 0 warnings; jest on the five slice folders +
`conv3-slB3.test.js`: 6 suites, 82 tests passed. `module/rules` as a whole: one failure in `conversions.test.js`
("slE dmlp › Wheel Excited"), another agent's item.

**Rules added: 6.**
