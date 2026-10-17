# Batch slE5: re-check of slE4's skips (qualification, data, MLP, Night Vale and misc slices) against the round-5 engine pieces

Slices: `qualify1`, `qualify2`, `data1`, `data21`, `data22`, `mlp1`, `mlp2`, `wtnv`, `r2misc`, `rules`, `fix3-dice`.

**Scope:** every item `docs/rules-batches/slE4.md` left Still skip (82) or Partial (7, the code half), re-checked against
"Engine features added 2026-10-05 (round 5, after the local round-4 conversions)" in `docs/RULES_CONVERSION_GUIDE.md`
(`target:ally|enemy`, `var:` tags, `vehicle:data:` / `vehicle:name~`, `terrain:set`, `environment:outside`, the new
`check:` names, `@host`, `{var}` / `{choice}` / `{@formula}` in text, unstarted-combat `endOfNextTurn`, `to: party|team`,
`updateActor`, `require` + `beforeCost`, `setTargets`, `writeInitiative`, `table`, wielded item / roll Skill, `overMax`,
optional `bonusAttack`, `bank replace`, pick `filter` / `auto`, button vars, DerivedStat `{choice}` paths + booleans,
`consumeMark`, Movement `afterGravity`, the new Trigger events and outcomes) and the earlier sections once more.
Edited in place in the shared checkout (no branch, no commit).

| Verdict (re-checked items) | Count |
|---|---|
| Convert (was skip) | **7** |
| Convert (was partial - the code half is gone now) | **1** |
| Partial (was skip - part converted) | **1** |
| Partial, nothing more converts | **6** |
| Still skip | **74** |
| Re-checked | **89** |

24 rules were added to 9 pack items. After this batch `scripts/check-rules.mjs` reports 1767 rules on 1137 items (with the
other agents' work), 0 errors on my items (2 errors elsewhere: `qgtgitems/Desperate_Parry`, another slice's Reaction). ESLint
is clean on every file touched; jest passes on all eleven slice folders and `module/rules/conv5-slE5.test.js` (17 suites,
122 tests). `module/rules/conversions.test.js` has one failure that isn't mine ("slB tf1 - Partnered", tf1's slice).

## Converted (9)

| Item | Pack file | Rules | Removed |
|---|---|---|---|
| Mega Training Regimen (qualify1, was partial) | `fffav1items/_source/Mega_Training_Regimen_nLT8HSCCGWEBiRlq.json` | 2 RollModifiers: ↑1 driving a Huge-or-larger land vehicle with Ranks (`stack: q1VehicleQualification`); `immune: ["snag"]` driving one untrained, unless Cobra-La blocks it. | see "qualify1 code" below |
| Spared No Expense (qualify1) | `fffav1items/_source/Spared_No_Expense_3ZrBd6FhV6Fep1zq.json` | the same pair for a Long-or-smaller land vehicle | " |
| Surgical Operators (qualify1) | `fffav1items/_source/Surgical_Operators_JtRCN6ppDatZVmav.json` | the same pair for a vehicle with `crew.numPassengers > 0` | " |
| Ultra-Secret Strike Force (qualify1) | `fffav1items/_source/Ultra_Secret_Strike_Force_4Gd5yet4c24yjWtY.json` | the same pair for a vehicle with `traits.pythonPaint` or "python" in its name | " |
| The Glory of Cobra-La (qualify1, partial) | `fffav1items/_source/The_Glory_of_Cobra_La_VAhtHpKlv4gsR0OY.json` | the same pair for a Biomechanical vehicle (`traits.biomechanical`, or "biomech" / "bio-mech" / "cobra-la" in its name), plus a Snag RollModifier driving any other vehicle. Its weapon and battledress Snags stay code. | " |
| Mentor (qualify2) | `tfcrbitems/_source/Mentor_aMrMtyNJUsSYyMId.json` | Use: `pick skill` (list of the 22 `CONFIG.E20.skills`, `legacy: flags.essence20.q2Mentor.skill`) then `pick essence` (the four, `legacy: ...q2Mentor.essence`); DerivedStat `system.skills.{choice.skill}.essences.{choice.essence} = true`. | `qualifications.mjs`: `MENTOR_FLAG`, `applyMentor`, `chooseMentor`, its `USES` entry, `registerDerived(applyMentor)` and the `registerDerived` import; `common.mjs`: `Q2.mentor`; test "Mentor adds an Essence to a Skill". |
| At Ease, Disease (qualify2) | `sssitems/_source/At_Ease_Disease_MHPffqgwDx7u3tlZ.json` | Use, cost Standard: `require combat:exists` and `require not:target:type:vehicle/zord/megaform` and `askNumber amount 1..6`, all `beforeCost`; `roll intimidation, dif 5 + 5 * @var.amount`; on success `heal targetOrSelf @var.amount` + `removeCondition defeated`. | `field-ops.mjs`: `atEaseDisease` and its `USES` entry; `common.mjs`: `Q2.atEaseDisease`. No old test covered it. |
| Replacement Teeth (wtnv) | `wtnvcgitems/_source/Replacement_Teeth_wuHnZ1qtGrd8il8a.json` | Use, cost Standard: `target` (`beforeCost`, max 1), then `applyCondition immobilized, rounds 1, to target`. | `wtnv.mjs`: the whole Use-buttons block (`USES`), `WTNV.replacementTeeth`, `USES.forEach(registerUse)` and the `registerUse` import. No old test covered it. |
| Transmetal (data22) | `tsitems/_source/Transmetal_MoXpVD8zILQ5h7T8.json` | 9 Movement rules (`stage: afterGravity`, `op: add`), three per pick (ground / aerial / swim, `rule:data:system.choice=<type>`, `self:transformed`): +40 when the chosen type has no Alt Mode speed; +`max(0, 40 - altMode)` when it is the only Alt Mode type; +20 when it has one and another type does too. | `data22/gear.mjs`: `GEAR22.transmetal`, `transmetalMovement`, its `registerDerived` (and the `registerDerived` / `findSourced` imports); `gear.test.js`: the Transmetal test. |

**qualify1 code removed for the five vehicle Qualifications:** `qualification.mjs`: `SIZES`, `isLand`, `vehicleQualifier`,
`drivenVehicle`, `skillRanked`, `isBiomechanicalVehicle`, the `rolledSkill == 'driving'` block of `qualificationSources`
(the ↑1 and Cobra-La's vehicle Snag), `qualificationApplyDialog` and its `registerApplyDialog` (import too); `common.mjs`:
`Q1.megaTrainingRegimen`, `Q1.sparedNoExpense`, `Q1.surgicalOperators`, `Q1.ultraSecretStrikeForce`; `qualify1.test.js`:
"vehicle qualifications by size, passengers and paint", "driving sources and untrained snag lift", "Biomechanical vehicles
are a Qualification" (and Mega Training Regimen dropped from the Cobra-La weapon test's actor).

Why they are exact:

- **Vehicle Qualifications.** The old ↑1 was one source, from the first qualifying Perk, when driving (`_getPilotedVehicle(actor,
  'driver')`) with Ranks in Driving; the rules give each Perk an ↑1 in one `stack` group, so one ↑1 however many qualify.
  `not:roll:untrained` / `roll:untrained` are the old `shift != 'd20'` test. The Snag lift ran after the dialog and cleared
  `options.snag` (any Snag) when untrained and qualified, never when the actor holds Cobra-La and the vehicle isn't
  Biomechanical; `immune: ["snag"]` clears any Snag after the dialog, and the non-Cobra-La Perks carry `{any: [not:self:
  hasItem:<Cobra-La uuid>, <Biomechanical tags>]}` for the exception. Sizes: the old index compare over the same SIZES list,
  written as `vehicle:data:system.size=<each size>` (every vehicle / Zord has a stored size). The Biomechanical name test
  `/bio-?mech|cobra-la/i` is the three `vehicle:name~` tags (case-insensitive contains).
- **Mentor.** The old Use asked the Skill (from `CONFIG.E20.skills`) then the Essence and stored `{skill, essence}`; derived
  data set `skills.<skill>.essences.<essence> = true` when that key exists (it always does: all four are in the schema). The
  DerivedStat does the same, nothing with no pick. Old picks move over through `legacy` (tested).
- **At Ease, Disease.** Old order: no combat -> stop; a vehicle / Zord / Megaform target -> stop; ask 1..6 (cancel -> stop);
  then pay the Standard action; `rollTest(actor, 'intimidation', 5 + 5 * amount)`; on success heal the target (or self) by the
  amount up to its max and clear Defeated. The three leading steps run before the cost (`beforeCost`), so a refusal or a
  cancelled amount costs nothing, as before.
- **Replacement Teeth.** No target -> warn, nothing paid; else pay Standard and `applyTimedCondition(target, 'immobilized', 1)`
  - the `applyCondition` step calls the same helper.
- **Transmetal.** The old function ran in the extensions' derived pass; `data22` registers before every other derived
  extension that touches Movement (tf3 Rotor Blades, situational2 Shark's Fin, pr1 / zord1 / zord2), and nothing between
  `_applyGravityMovement` and `runDerived` changes Movement, so `afterGravity` adds at the same point relative to everything
  else. The three cases split the old `types >= 2 && innate > 0 ? 20 : max(0, 40 - innate)` exactly (types counted over all
  five Movement entries' `altMode`).

Tests (`module/rules/conv5-slE5.test.js`, loading each pack item): every case of the removed vehicle tests (size / passengers /
Python paint or name / Biomechanical trait or name), passenger seat / other Skill / no vehicle, one ↑1 for several Perks, the
untrained lift and Cobra-La's block of other Perks' lift; Mentor's picks, the derived Essence, no pick no change, the legacy
carry-over; At Ease's three refusals (no cost, no prompt), the DIF, heal + Defeated cleared, self-heal capped, failure;
Replacement Teeth's target-first and the timed Immobilized; Transmetal's 40 / +20 / up-to-40 / not in Bot Mode / no pick.

## Behaviour differences worth a decision

1. **Vehicle Qualifications: which vehicle (same line, rare).** `vehicle:` tags read `rules/links.mjs#crewedBy` - the first
   vehicle or Zord listing the actor in any seat, then `vehicle:driving` requires that seat to be the driver's. The old code
   took the first vehicle where the actor is the driver. Differs only for an actor listed as crew on two vehicles at once.
2. **Vehicle Qualifications: the ↑1's label (cosmetic).** With several qualifying Perks the source shows the first one in item
   order (strongest-per-group keeps the first on a tie); the old code always showed them in the fixed order Mega Training
   Regimen, Spared No Expense, Surgical Operators, Ultra-Secret Strike Force, Cobra-La. Labels now say what they're for.
3. **Untrained Snag lift timing (cross-line, edge).** `immune: ["snag"]` runs in `applyRuleImmunity`, after late RollModifiers
   have added theirs, so it also clears a late Snag; the old hook's place among the applyDialog extensions decided that.
4. **Mentor (same line, small).** The Essence list includes the Skill's own Essence (a no-op pick; the old list left it out),
   and the two picks are saved one at a time: cancelling the Essence after choosing a new Skill keeps the new Skill with the
   old Essence (the old Use saved nothing). Chat shows the two "Picked" lines instead of one summary line.
5. **At Ease, Disease (same line, presentation).** Its refusals ("Only during combat.", "Only living creatures.") are chat
   lines on the Use card instead of toasts; the amount prompt is the rules' number box (1-6, starts at 1) instead of I've Got
   You's dialog; a failure says "No Health restored." The heal never lowers Health already above the maximum (the old one set
   it to the maximum).
6. **Replacement Teeth (same line).** A player whose pet clamps an enemy they don't own now has the Condition applied through
   the GM (the rules' `applyCondition` relay; untimed in that case) - the old code wrote to the enemy directly, which a player
   can't. The chat line is the generic "Condition" one.

## Still skipped (74), and what each still needs

The items the round-5 pieces were expected to unblock, re-checked:

- **Opportunist** - `updateActor` can add the Stun damage, but the two branches are either/or: "extend a TIMED Stunned
  Condition, else add 1 Stun damage". Nothing tells a step whether the Stunned Condition has a duration (`target:status:`
  is on/off; `extendCondition` leaves an untimed one alone and says nothing), so a timed Stunned with Stun damage would get both.
- **Alternate Officer** - `updateActor` can write the training, but the same Use must then pick a Limited melee weapon and
  Requisition must read that pick as Qualified (recorded compendium pick read by a Qualification).
- **Dome Generator** - `@host` gives the armor's bonus, but the effect lasts "until your next turn" or, out of combat, the
  scene (`nextTurn` out of combat never runs out), the bonus needs "host is equipped", and the uses are pooled across copies.
- **Pinkie Sense** - the `table` step's row text isn't localized, so rows would put the book's table into pack data (no
  rulebook text), and the old result is a real Roll message.
- **Spared No Expense / Surgical Operators / Ultra-Secret Strike Force / Cobra-La / Replacement Teeth / At Ease / Mentor /
  Transmetal** - converted (above).

### qualify1 (16)
- **Danger Sense** - an Initiative-formula reroll.
- **Ignite**, **Fireball** - the turn-end attack at the burning creature's turn, hit-card note, two action-costed buttons.
- **Addicted (Dark Energon)** - a resource-cost multiplier while craving, a d20 + recorded-die attack, a day counter.
- **Best-Laid Plans**, **One Last Chance** - reroll offers on any roll card, pressed by the roller, pooled per Party.
- **Nobility** - a Story Point New Session modifier.
- **Service, Trade Goods, For The Syndicate, Good To Go, Ninpõ JOEs** - a recorded compendium pick read by a Qualification.
- **Nothing Personal** - attach a compendium upgrade to a picked weapon.
- **Roaming the Land** - an item tag "has a melee / Reach attack" for a Qualification's `items`.
- **Tenacity** - `roll:save` and a turn-start "end what expires this turn" step.
- **Dome Generator** - see above.
- (Partials unchanged: **Nu, Pogodi!**'s weapon pick and seat swap; **The Glory of Cobra-La**'s weapon and battledress Snags -
  an attached-upgrade-by-id tag for the weapon and the worn armor.)

### qualify2 (14)
- **Upgrade Training** - a recording compendium picker read by a Qualification.
- **Hardware Training** - two-handed and upgrade-trait tags.
- **Weapon Enthusiast (Perk / Hang-Up)** - a weapon-type tag; choice-filled `updateItem.set`; an Assist refuse that sets aside a
  banked Lend Assistance.
- **Training Evolution** - a mission-scoped pick over another actor's weapons / vehicles, read as a Qualification.
- **Destructive Overcharge, Cascading Failure** - delayed button cards and a blast test around a point.
- **Opportunist** - see above.
- **Sensitive, Detail Oriented** - a cost on another item's daily counter and a round-scoped ignore of the banked Snag.
- **Do Or Die** - add a die to a posted check; a Moxie cost that rises on a second use.
- **Wild Idea** - a DialogSwitch bonus pool die.
- **Timeline Anomaly** - a swap-Initiative step.
- **Everything is Inspiration** - a `sessionStart` Trigger.
- (Partials unchanged: **Whisper Warrior** - its Qualification and Free Defend read upgrade traits (`itemAndUpgradeTraits`;
  `item:trait:` / `weapon:trait:` read `system.traits`); **Oorah!** - its shared vehicle ↑1 is in `dice.mjs`.)

### data1 + data21 (12)
- **Reinforced Shell** - static `rule:host:` tags and a dealt note with no damage value.
- **Over Brawn, The Heavy, Pack Mule** - an equipment-requirement Brawn rule.
- **Dino Thunder ×4** - picks read across items / actors, a single-use pool with fallback, a custom-hook step.
- **Stinger Spray (attacks)** - a preRoll per-attack cost that warns instead of refusing.
- **Larger Than Life** - `@other.<path>` in ItemModifier and "leave a missing value alone".
- **Sky Morpher** - a "driving your own Zord" tag (ownership, the Zord rolling with its driver's) and counting unequipped gear.
- **Alternate Officer** - see above.

### data22 + mlp1 + mlp2 (27)
- **Data-Link** - a "companion drone not commanded this round" tag.
- **Fresh Mark, Natural Style** - per-creature memory on the holder.
- **Smoke Screen, Smoke Bomb** - a canvas-point step, recipients around it, positional roll sources.
- **Assault Claw** - moves only with `rules/grappled.mjs`.
- **Demolecularization Gun, Waterrunning** - marks that carry their own rule onto the marked creature's rolls.
- **Primeon Blade** - per-megaform-member buttons.
- **Shape-Shift / Face-Shift / Master Morph / Size-Shift (Use), Face-Shift and Master Morph (sources)** - a multi-pick shape
  dialog with a size write and undo.
- **Brilliant Sight, Illusion Casting, Reach Out, Extra Effective Spell, Long Lasting Spell, Mystical Understanding** - a
  SpellCost rule (Mystical Understanding also runs Magically Fit In's own picker and a per-day Essence counter).
- **Pinkie Sense** - see above.
- **Softenblows** - automatic outgoing-damage negation on a marked attacker's hits.
- **Sharpcaster, Sorcerous Support** - a free re-cast step; reroll offers on another actor's Fumble card.
- **Friendship Is Mystical** - a three-way choice whose Magically Fit In branch needs `magicallyFitInValue`, and a heal
  capped by the Mystical Points held.
- **Reactionary** - an Initiative re-roll step.
- **Thick Skin** - an Active-Effect enable / disable step.
- **Something Is Off** - an incoming DialogSwitch.
- (Partials unchanged: **Prize Honey** - a formula default for `updateItem` on a missing flag and the old cap; **Basic
  Shape-Shifting / Ponymorph** - the shape write stays with the shared `mlpShape` flag.)

### wtnv + r2misc + fix3-dice (5)
- **Dog Person** - a creature-kind / regex target tag and a per-Skill `specialize` on a DialogSwitch.
- **Third Eye** - `ignoreDownshift` on a DialogSwitch.
- **Staggering Sway** - a watcher's note on the hit card before damage lands, holder anywhere in the world.
- **Dominate** - power-activation hooks and stored victim state.
- **Shadow** - an incoming DialogSwitch with a conditional default.

## Edits outside my files

None.

## Unused strings

`lang/en.json` keys no longer used by any code: `E20.Q2AtEaseCombatOnly`, `E20.Q2AtEaseLiving`, `E20.Q2AtEaseFailed`,
`E20.Q2AtEaseHealed`, `E20.Q2MentorSkill`, `E20.Q2MentorEssence`, `E20.Q2MentorChosen`, `E20.WtnvClamp`.

## Rule count

24 rules added: 2 each on Mega Training Regimen, Spared No Expense, Surgical Operators and Ultra-Secret Strike Force; 3 on The
Glory of Cobra-La; 2 on Mentor (Use + DerivedStat); 1 Use each on At Ease, Disease and Replacement Teeth; 9 Movement on Transmetal.

## Engine pieces the remaining skips need (most useful first)

1. **Recorded compendium pick read by a Qualification** (a pickGrant-style browser that records the pick - several per key,
   with filters - and a Qualification `items` tag `item:pickedSource:<key>` matching any printing of it). Unblocks Service,
   Trade Goods, For The Syndicate, Good To Go, Ninpõ JOEs, Upgrade Training, Training Evolution, Alternate Officer (with
   `updateActor`). Medium.
2. **Reroll offers on any roll card, pressed by the roller** (any roll message, a fumble / failed outcome, a pool sized by a
   formula and shared by a Party, posting a fresh card). Unblocks Best-Laid Plans, One Last Chance, Sorcerous Support (and Do
   Or Die with an "add a die" mode). Medium.
3. **SpellCost rule** (cast-dialog checkboxes: set / add / multiply the cost, plus a "re-cast free" step). Unblocks Brilliant
   Sight, Illusion Casting, Reach Out, Extra Effective Spell, Long Lasting Spell, Sharpcaster, part of Mystical Understanding.
   Medium.
4. **Timed-condition test / `extendCondition` reporting** - a tag `target:status:<id>:timed` (or `extendCondition` setting
   `@var.extended`). Unblocks Opportunist outright (with `updateActor` for the Stun-damage branch). Small.
5. **Upgrade-aware item tags**: `item:trait:` reading `itemAndUpgradeTraits`, an "attached upgrade with id X" tag, two-handed,
   weapon-type and "has a melee / Reach attack" tags. Unblocks Whisper Warrior's half, Cobra-La's weapon / battledress Snags,
   Hardware Training, Weapon Enthusiast (with more), Roaming the Land. Small each.
6. **Localized `table` rows + a real Roll message** (row text as an i18n key; the roll posted as a Roll). Unblocks Pinkie Sense.
   Small.
7. **Duration "nextTurnOrScene" + a "host equipped" tag + a limit pooled across copies.** Unblocks Dome Generator. Small.
8. **Incoming DialogSwitch** (on the roller's dialog, from the target's item) with a conditional default. Unblocks Something
   Is Off, Shadow. Medium.
9. **Marks that carry rules** (the marked creature gets rules from the setter's item while marked) + a roll step against a
   recipient's Defense with a formula downshift. Unblocks Waterrunning, Demolecularization Gun, Softenblows (with outgoing
   negate-damage), Ignite + Fireball. Medium-large.
10. **Initiative steps** (re-roll / swap / formula reroll). Unblocks Danger Sense, Reactionary, Timeline Anomaly. Medium.
11. **Per-creature memory on the holder** (a keyed set of creatures, optionally scene-stamped). Unblocks Fresh Mark, Natural
    Style. Small.
12. **Canvas-point step + recipients around a point + delayed button cards.** Unblocks Smoke Screen, Smoke Bomb, Destructive
    Overcharge, Cascading Failure. Medium.
13. **Equipment requirement rule** (Brawn offset / ignore). Unblocks Over Brawn, The Heavy, Pack Mule. Small.
14. **`roll:save` tag + "end an effect expiring this turn" step.** Unblocks Tenacity. Small.
15. **Hit-card note for a watcher before damage lands** (holder anywhere in the world). Unblocks Staggering Sway. Medium.
16. **Smaller one-offs:** `@other.` in ItemModifier (Larger Than Life); `ignoreDownshift` / per-Skill `specialize` on a
    DialogSwitch (Third Eye, Dog Person); a preRoll cost that warns (Stinger Spray attacks); an Active-Effect toggle step
    (Thick Skin); `sessionStart` Trigger and a New Session modifier (Everything is Inspiration, Nobility); a cost on another
    item's daily counter (Sensitive, Detail Oriented); a DialogSwitch bonus pool die (Wild Idea). Small each.
17. **Effectively permanent code** (bespoke UI or whole subsystems): Shape-Shift / Face-Shift / Master Morph / Size-Shift and
    Basic Shape-Shifting / Ponymorph's shape half, Dino Thunder ×4, Dominate, Addicted (Dark Energon), Primeon Blade, Assault
    Claw (`rules/grappled.mjs`), Data-Link, Sky Morpher, Reinforced Shell, Friendship Is Mystical, Prize Honey's half, Nothing
    Personal, Nu, Pogodi!'s half, Oorah!'s half (in `dice.mjs`).
