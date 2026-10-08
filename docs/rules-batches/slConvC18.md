# slConvC18 - round 18, part "convC"

Scope: the last partial conversions of this part - the Perfect Disguise reader, Nu, Pogodi!, the Ninja Power chooser,
Power Heal's Condition removal, Bullpup's reload and the Hyperkinetic Support Harness - each checked against its book.
**3 converted (all code gone), 3 were already whole rules (book-checked, no change).** Tests:
`module/rules/engine18-convC.test.js` (5) and `module/rules/conv18-convC.test.js` (13).

## Engine features added 2026-10-07 (round 18, convC)

Imported in `rules/plugins/index.mjs`'s "Round 18 (convC)" block. One new string: `E20.RulesExtConvC18.NuPogodiWhichCondition`.

- **SneakAttackGrant `bypass: true` (+ `reason`)** (edit in `plugins/combat/sneak-attack-grant.mjs`, read by
  `mechanics/combat/sneak-attack.mjs#checkSneakAttackEligibility` through `bypassGrant(actor, weaponEffect)`): while the
  rule's `when` / `items` hold, the attack is a sneak attack whatever its weapon (Silent or not), range, Edge or allies.
  It is still once a round and never against a target that takes no sneak attack damage (SneakAttackImmunity), and it
  costs nothing. `reason` is the Roll Options line it shows (an `E20.` key or text; default "Conditions met"). Asked after
  an `anyCircumstance` grant (Sudden Strike), before the ordinary checks; a bypass rule never widens the weapon / range
  (sneakAttackWeaponGrants leaves it out). Perfect Disguise: `{type: SneakAttackGrant, bypass: true, reason:
  "E20.SneakAttackReasonDisguise", when: ["self:data:flags.essence20.perfectDisguiseActive"]}`.
- **Pick source `seatmates`** (`plugins/picks/seat-swap.mjs`): everyone else seated as a driver or passenger (with a
  uuid) in the vehicle or Zord the actor rides in (`links.mjs#crewedBy`), by seat key, labelled "<name> (<role>)". Not
  aboard, or alone: nothing to pick (the pick stops the run). `seatOf(actor)` - the vehicle, seat key and entry.
- **Step `swapSeats {seat?: <pick key>}`** (same file): the actor and the rider in that seat trade `vehicleRole`s - the
  seat is the pick stored under `seat` on the rule's item, else the run's `@var.picked`. Written through the GM relay
  (`relayed-writes.mjs#updateRelayed`) when this user can't write the vehicle. Sets `{var.other}` (the other rider's
  name). Not aboard / no such seat: stops the run. Nu, Pogodi!: `pick {from: seatmates, beforeCost: true}`, then
  `roll {skill: driving, dif: 10, onSuccess: [swapSeats {seat}, chat "{lang.Q1Swapped}"], onFail: [...]}` with `cost:
  {action: free}` and `when: ["vehicle:crew"]`.
- No piece needed for the rest: the on / off pattern plus `morph` / `unmorph` Triggers (`prompt: true` for "spend 1
  Power to activate it?"), a `mark {until: endOfRound, when: ["combat"]}` step and an incoming RollModifier reading
  `self:marked:<key>` replace a hand-written "attacks against me this round" roll source.

## Verdicts

| Item | Pack | Verdict |
| --- | --- | --- |
| Perfect Disguise | gijcrbitems | **converted** - SneakAttackGrant bypass; `items/social/perfect-disguise.mjs` and its test removed |
| Nu, Pogodi! | iafav2items | **converted** - two Use rules (Condition removal, seat swap); `items/healing/nu-pogodi.mjs`, `items/vehicles/nu-pogodi-seat-swap.mjs`, banked-buffs' branches and the now-dead `items/healing/eltarian-mettle.mjs` removed |
| Ninja Power | prcrbitems | **converted** - morph / unmorph Triggers, jump and switch-off Uses, an incoming RollModifier; `items/attacks/ninja-power.mjs`, `items/movement/ninja-power-jump.mjs`, `items/shared/pr-crb-ttsg-item-ids.mjs` removed |
| Power Heal (Power) | prcrbitems | already rules (round 17 split2) - matches the book; nothing to do |
| Bullpup | iafav2items | already rules (round 17 split1 / round 15) - matches the book; nothing to do |
| Hyperkinetic Support Harness | fffav1items | already rules (round 15 systems) - matches the book; nothing to do |

## Converted

- **Perfect Disguise** - the sneak-attack eligibility the code read off the flag is a SneakAttackGrant bypass rule: same
  checks (once a round, not vs an immune target), same reason line. Its other rules stay; see Book changes.
- **Nu, Pogodi!** - "Remove a Condition (Free, once per mission)": `pick from: conditions {exclude: [defeated]}` (the
  system's listed Conditions you have, as Eltarian Mettle's picker offered), `removeCondition`, chat. "Swap seats (Free,
  Driving DIF 10)": shown only while riding (`vehicle:crew`); the seatmate pick comes before the Free action is paid (a
  cancelled pick costs nothing), then the DIF 10 Driving test; success swaps the two roles, failure posts the old
  "fails to swap" line. Both share the item's Use button with the weapon pick, through the ordinary several-Uses picker.
- **Ninja Power** - "Ninja jump (20 ft, Free)" (while Morphed with it on): pays the Free action, marks you until the end
  of the round (in a running combat only - out of combat the old flag never counted either); an incoming RollModifier
  gives attacks against a marked creature ↓1 ("Ninja Power jump (↓1)", a labelled source on the attacker's dialog).
  "Switch Ninja Power off" (while on). When on and Morphed the picker offers jump / off, as the old chooser did; off and
  un-Morphed it is the switch alone.

## Book changes (book is truth)

- **Perfect Disguise: once per Mission** (GI Joe CRB p.76) - the Use limit is `per: mission` (was encounter; settles
  the split2 question in questions.md).
- **Perfect Disguise: ends when seen attacking a supposed ally without good reason** - the afterRoll Trigger ended the
  disguise on every attack, which also contradicts "your attacks ... gain an Edge and are sneak attacks" (plural). It is
  `prompt: true` now: after an attack with a target the player is asked whether the disguise ends.
- **Nu, Pogodi!: once per mission, as a Free action** (FiA Vol 2 p.68) - was once per encounter and took no action.
- **Ninja Power: activated "in conjunction with" It's Morphin Time!** (PR CRB p.97; the 2nd printing reads the same) - it
  was a toggle you could pay for at any time and that outlived un-Morphing. Now a `morph` Trigger asks whether to spend
  1 Power to activate it (offered only with 1 Power left), and an `unmorph` Trigger ends it. No manual "switch on" Use.
- Book-checked, no change: Power Heal (PR CRB p.100: while Morphed, touching a creature, each Power heals 1 or removes
  one negative Condition - the heal half is the Power's own spend, the Condition half 1 Power each, 5 ft), Bullpup (FiA
  Vol 2 p.92: one size smaller, Free reload once a scene, prerequisite Medium+ ranged with Reload), Hyperkinetic Support
  Harness (FiA Vol 1 p.69: two-handed weapons in one hand - only while the battledress is worn, as an upgrade's rules are).
- Notes rewritten as short paraphrases on Perfect Disguise, Nu, Pogodi! and Ninja Power.

## Behaviour differences worth a note

- Nu, Pogodi!'s seat swap is hidden when you aren't aboard (it warned "You aren't riding in a vehicle"); the pick posts
  the usual "picked" line; with nobody to swap with the pick says "nothing to pick".
- Nu, Pogodi!'s Condition removal with nothing to remove says "nothing to pick" (it did nothing silently).
- Ninja Power's jump in a combat that is set up but not started no longer gives the ↓1 (the old stamp counted round 0).
- Ninja Power's activation needs 1 Power left to be offered; the old toggle warned "over-spent" instead.

## Bugs found and fixed

- None beyond the book changes above.

## Code vs notes - needs a ruling

- None. (Perfect Disguise's once-per-Mission question is settled by the book ruling.)

## Shared-file edits

- `module/rules/plugins/combat/sneak-attack-grant.mjs` - `bypass` / `reason` params, `bypassGrant`, bypass rules left
  out of `sneakAttackWeaponGrants`.
- `module/mechanics/combat/sneak-attack.mjs` - the Perfect Disguise branch reads `bypassGrant`; its import, constant and
  `actorHasPerk` import removed.
- `module/mechanics/combat/target-riders.mjs` - comment only.
- `module/mechanics/resources/banked-buffs.mjs` (+ `.test.js`) - Nu, Pogodi!'s canUsePerk / onPerkUse branches, import,
  id and test removed; comments.
- `module/items/index.mjs` - the ninja-power-jump, pr-crb-ttsg-item-ids and nu-pogodi-seat-swap imports removed.
- `module/items/gear/qualification-setup.mjs` - the seat-swap registration removed; `equipment-qualification.mjs` comment.
- `module/items/shared/qualification-gm-relay.mjs` - `Q1.nuPogodi` removed.
- `module/items/shared/turn-stamps.mjs` - `isThisRound` removed (its last user was ninja-power-jump).
- Tests: `items/tests/power-heal-elemental-fury.test.js` (the Ninja Power registration / jump tests and now-unused helpers
  removed), `items/tests/qualifications-addicted.test.js` (q1Qualify no longer registered; itemsFrom sample id),
  `rules/conv9-slE9.test.js` (the nu-pogodi mocks and slice-Use test removed; the weapon pick picked by label),
  `rules/conv17-split2.test.js` (Perfect Disguise: mission title, the prompted end).
- `module/rules/plugins/index.mjs` - the round 18 convC block at the end.

## Unused strings

- `E20.Pr3NinjaPrompt`, `E20.Pr3NinjaJump`, `E20.Pr3NinjaOff`, `E20.Pr3NinjaJumpSource`
- `E20.Q1RemoveCondition`, `E20.Q1SwapSeats`, `E20.Q1SwapNoVehicle`
- `E20.EltarianMettlePickConditionTitle`, `E20.EltarianMettlePickConditionLabel`

(`E20.Pr3NinjaJumped`, `Pr3NinjaOnLine`, `Pr3NinjaOffLine`, `Q1SwapPrompt`, `Q1Swapped`, `Q1SwapFailed` and
`SneakAttackReasonDisguise` are read by the pack rules now.)

## Rule count

8 rules added (Perfect Disguise 1, Nu, Pogodi! 2, Ninja Power 5) plus 2 changed (Perfect Disguise's Use limit and
end Trigger).
