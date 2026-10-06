# Batch slE9: re-check of slE8's skips (qualification, data, MLP, Night Vale and misc slices) against the round-9 engine pieces

Slices: `qualify1`, `qualify2`, `data1`, `data21`, `data22`, `mlp1`, `mlp2`, `wtnv`, `r2misc`, `rules`, `fix3-dice`.

**Scope:** every item `docs/rules-batches/slE8.md` left Still skip (65) or Partial (3: Nu, Pogodi!, Oorah!, Basic Shape-Shifting /
Ponymorph), re-checked against "Engine features added 2026-10-06 (round 9, after the local round-8 conversions)" in
`docs/RULES_CONVERSION_GUIDE.md` (`to: picked:<key>`, `rollVsEach`, `disarm`, `takeItem`, `spendAction`, `pick from: targetItem`,
pick skill `minShift` / `maxShift`, `pickGrant {record}` + `item:pickedSource:<key>`, tracked temporary Health, grant
`appendTraits`, `ladderMax` / `ladderMin`, `quiet`, `@sum.equippedTrait`, `removed` / `droppedToZero`, afterRoll `@var.skill`) and
the earlier sections once more. slE5-slE8's recorded behaviour differences were looked at again; no round-9 piece removes one (the
Fresh Mark / Natural Style memory move still needs a mark legacy pass). Edited in place in the shared checkout (no branch, no commit).

| Verdict (re-checked items) | Count |
|---|---|
| Convert (was skip) | **5** |
| Partial (was skip) | **1** |
| Partial (was partial - more of it converts now) | **1** |
| Partial, nothing more converts | **2** |
| Still skip | **59** |
| Re-checked | **68** |

14 rules were added to 7 pack items. After this batch `scripts/check-rules.mjs` reports 1964 rules on 1202 items (with the other
agents' work), 0 errors, 0 warnings. ESLint (`--ext .js,.mjs`) is clean on every file touched; jest passes on all eleven slice
folders (16 suites, 87 tests). `module/rules/conv9-slE9.test.js` has 14 tests: 12 pass now; the 2 in its last block ("needs the
engine edits listed in slE9.md") fail until the three edits under "Edits outside my files" are applied. With those edits applied
in a scratch copy of `module/` (packs linked read-only), all 14 pass and the whole `module/rules` folder passes (55 suites, 1791 tests).

## Converted (5) and partials (2)

Every one of them is the round-9 recording pick: a Use with `pickGrant {record: true, key, max?}` keeps the compendium uuid and
name on the Perk (`flags.essence20.rules.choices.<key>`, a list), and a Qualification with `item:pickedSource:<key>` gives the
access at Requisition (`rules/adapter.mjs#ruleRequisitionAccess`, the same `essence20.requisitionAccess` hook the slice used,
widening only). `item:pickedSource` matches the book source or the item's uuid, or the same name for another printing - exactly
the slices' `matchesChosen`. Each first pick step carries `legacy` (the old flag), so existing picks move over once the engine
edit below is in.

| Item | Pack file | Rules | Removed |
|---|---|---|---|
| Service (qualify1) | `fgtaaitems/_source/Service_T7oYyl70KYmFT1lt.json` | Use: `pickGrant {record, key: chosen, max: 1, legacy: flags.essence20.q1Chosen, from: {type: weapon, availabilities: [limited]}}`; Qualification `access: trained`, `items: [{any: [item:type:weapon, item:type:armor]}, item:pickedSource:chosen]`. | `qualify1/qualification.mjs`: `CHOSEN_TRAINED`, its `perkAccess` loop, the Service / Trade Goods / Nu, Pogodi! / For The Syndicate / Good To Go cases of `planFor` (now Ninpō JOEs only, no longer async), `twoHanded`, the trained chat line; `qualify1/common.mjs`: `Q1.service`, `Q1.tradeGoods`, `Q1.forTheSyndicate`. `qualify1.test.js`: the Service half of "chosen item qualifies" (that test and "requisition access only widens" now use Ninpō JOEs, still code). |
| Trade Goods (qualify1) | `fffav1items/_source/Trade_Goods_DZGQX1B8UwJEBrwg.json` | Use: the same pick, `max: 1`, Limited or Restricted weapons; Qualification `qualified`. | (with Service) |
| For The Syndicate (qualify1) | `iafav2items/_source/For_The_Syndicate_opygNwRWgeIyU1mE.json` | Use: `choose` of three plans - a Limited weapon (`max: 1`) then a Limited battledress (`max: 2`), a Restricted weapon (`max: 1`), or a Restricted battledress (`max: 1`), all into `chosen`; Qualification `qualified`. | (with Service) |
| Good To Go (qualify1) - **partial** | `iafav2items/_source/Good_To_Go_Yt3muowN1aALcqOj.json` | The same two rules as For The Syndicate. **Stays code:** `onKitPrerequisite` (Kit prerequisites one Rank lower - the `essence20.kitPrerequisite` hook has no rule type). | (with Service) |
| Nu, Pogodi! (qualify1) - **partial, more of it** | `iafav2items/_source/Nu__Pogodi__sItc8nD7ockbQ1mn.json` | Use: the pick, `max: 1`, Limited weapons with `tags: [item:hasAttack:item:data:system.numHands=2]`; Qualification `qualified`. **Stays code:** the seat swap and the once-per-mission Condition removal (the slice Use, now offering only those). | The `weapon` choice of the Nu, Pogodi! menu in `QUALIFY_USE` (+ `E20.Q1ChooseWeapon`); `QUALIFY_USE.matches` lists Ninpō JOEs, Nothing Personal and Nu, Pogodi! by name now. |
| Upgrade Training (qualify2) | `iafav2items/_source/Upgrade_Training_zhwJbYTopQB2RuuM.json` | Use (`when: [not:rule:data:flags.essence20.rules.choices.chosen]` - once): `choose` "Three Limited weapon upgrades" (three times: `pickGrant {record, key: chosen, from: {type: upgrade, availabilities: [limited], tags: [item:data:system.type=weapon, not:item:pickedSource:chosen]}}` then `grant {uuid: "{var.picked}", flags: {qualified: true}}`) or "One Restricted weapon upgrade" (once). Qualification `upgrades: [item:pickedSource:chosen]`. | `qualify2/qualifications.mjs`: `upgradeTrainingUse`, its `USES` entry, `CHOSEN_FLAG`, `chosenOn`; `isQualifiedUpgrade` is now just `ruleQualifiedUpgrade`; `qualify2/common.mjs`: `Q2.upgradeTraining`. `qualify2.test.js`: "qualified upgrades drop out of the Availability stacking" (+ its three imports) - re-asserted in the new test through the rule. |
| Alternate Officer Equipment Training (data21) | `sssitems/_source/Alternate_Officer_Equipment_Training_5iH3ztH4sjqboZK5.json` | Use (`when: any of [not applied, no weapon picked]`): `updateActor` (the training rewrite: Light armor only; Blunt / heavy blade / explosives / Finesse / Might melee, no ballistic) and `updateItem self` `d21OfficerApplied: true`, both only when not applied yet; `pickGrant {record, key: officerWeapon, max: 1, legacy: flags.essence20.d21OfficerWeapon}` over Limited weapons with a melee or reach attack; `grant {uuid: "{var.picked}", flags: {qualified: true}}`. Qualification `items: [item:type:weapon, item:pickedSource:officerWeapon]`. | `data21/officer.mjs` emptied (all of it: `OFFICER_WEAPON_FLAG`, `isMeleeWeaponEntry`, `isOfficerWeapon`, `onOfficerRequisitionAccess`, `chooseOfficerWeapon`, `OFFICER_TRAINING`, `officerTrainingUpdate`, `useAlternateOfficer`, the Use and the hook) - the file stays as an empty module because the generated `helpers/extensions/index.mjs` imports it; its import in `data21/data21.mjs`; `D21.alternateOfficer`; the three Alternate Officer tests in `data21.test.js` (+ their import). |

Why they are exact:

- **Who, what and when.** The old Uses had no cost, no limit and no condition (Upgrade Training: refused once something was
  picked; Alternate Officer: offered while the training or the weapon is missing); the rule Uses are the same (Upgrade Training's
  and Alternate Officer's `when` are those two tests). Access was only for a weapon or armor (`perkAccess`) - the `item:type`
  tags; Service gives `trained`, the rest `qualified`, as `CHOSEN_TRAINED` / `CHOSEN_QUALIFIED` did.
- **The lists.** `findItems({type, availabilities, matches})` is the same call `pickGrant` makes; the old `matches` are now tags
  asked of each compendium entry: Nu, Pogodi!'s `twoHanded` (some stored attack's `numHands` is 2) is `item:hasAttack:...numHands=2`
  (data `=` compares numbers as numbers, so "2" and 2 both match); the officer's `isMeleeWeaponEntry` (some attack melee, or reach
  > 0) is `any` of the two `hasAttack` tags (a missing reach compares false); Upgrade Training's `system.type == 'weapon'` is
  `item:data:system.type=weapon`, and its "not one already chosen" filter is `not:item:pickedSource:chosen` (the record is written
  before the next pick).
- **Replacing a pick.** The old Uses overwrote the whole flag. One-pick plans record with `max: 1` (only the new one is kept); the
  two-pick plan writes its first pick with `max: 1` and its second with `max: 2`, so a finished run holds exactly the new pair. A
  cancelled first pick (or a closed plan choice) changes nothing, as before.
- **Upgrade Training's partial run.** The old loop stopped at a cancelled pick and kept what was picked so far (granted and
  recorded); a stopped rule run keeps the earlier steps' records and grants - the same.
- **Grants.** The officer's weapon and Upgrade Training's upgrades are granted as before, `grantedBy` the Perk and flagged
  `qualified`; the copy carries `_stats.compendiumSource` (the grant step) instead of `flags.core.sourceId` (grantCopy) - both are
  what `sourceOf` reads. The grant step brings a weapon's attacks the same way (`attachGrantedChildren` = `createItemCopies`).
- **Requisition Availability.** qualify1 / qualify2's `effectiveAvailability` ask `isQualifiedUpgrade`, which asks the
  Qualification rules' `upgrades` - Upgrade Training's picks are now one of them.

Tests (`module/rules/conv9-slE9.test.js`, each loading the pack item, with the compendium browser mocked over a small catalog):
Service (Trained in the pick, another printing too, not in another weapon, nothing granted, a new pick replaces it, a cancelled
pick keeps it); Trade Goods (the Limited / Restricted list, Qualified, nothing else); For The Syndicate and Good To Go (each plan's
lists, the pair is Qualified, a new plan replaces the old picks, a closed choice changes nothing); Nu, Pogodi! (only two-handed
Limited weapons offered, Qualified, its Standard Qualification untouched; the slice Use no longer matches Service and offers only
the seat swap); Upgrade Training (three picks, none offered twice, Qualified upgrades, `isQualifiedUpgrade` / `effectiveAvailability`
leave the qualified upgrade out of the stacking - the old qualify2 assertion, once only, the Restricted plan, a cancelled second
pick keeps the first); Alternate Officer (the training write, the applied flag, melee and reach weapons only, Qualified, not
another weapon, then unavailable; a cancelled pick leaves the Use for the pick alone without redoing the training). After the
engine edits: the granted upgrades / weapon are there with `qualified` and `grantedBy`; old `q1Chosen` / `q2Chosen` /
`d21OfficerWeapon` picks move into the rule choices and still give their access (and the moves don't repeat).

## Behaviour differences worth a decision

1. **Two buttons for Nu, Pogodi! (presentation).** Its weapon pick is its own Use ("Pick your two-handed Limited weapon"); the slice
   Use offers the seat swap (and the Condition removal when it's available) - one menu became two buttons.
2. **Re-picking a pair and cancelling halfway (edge, For The Syndicate / Good To Go).** Cancelling the battledress pick of a
   "Limited pair" re-pick leaves only the new weapon (the old code kept the whole old pair). Finishing, or cancelling at the plan
   choice / the first pick, is as before.
3. **Upgrade Training once picked (presentation).** The Use is unavailable instead of warning "already chosen".
4. **Chat (presentation).** One "Picked: X" line per pick (and "Granted" lines for Upgrade Training / Alternate Officer) under the
   rule label, instead of `E20.Q1QualifiedChosen` / `Q1TrainedChosen` / `Q2TookQualified` / `D21OfficerApplied(Weapon)`; the
   officer's "press Use again" hint is gone (the Use simply stays available). Picker titles are plain English.
5. **Existing picks need the edits (same line, until applied).** Until the `legacy` edit lands, a character who picked with the old
   Uses has no access from those picks (the old flags are no longer read); with it, the GM's linking pass moves them over.

## Still skipped (59), and what each still needs

Round-9 pieces looked at and why they don't reach these: `pickGrant {record}` can't make Ninpō JOEs' second list depend on the
first pick's traits, nor attach Nothing Personal's Silencer to a picked weapon, nor pick over another actor's items (Training
Evolution); `pick from: targetItem` / `to: picked:` reach another actor's item, but a Qualification can only read a compendium pick
(`pickedSource`), not an owned item's source, and Training Evolution also needs Specialization and vehicles; `rollVsEach` needs
recipients, not a point on the canvas (Smoke Screen, Destructive Overcharge); `removed` / `droppedToZero`, `disarm`, `takeItem`,
`spendAction`, tracked temporary Health, `appendTraits`, `ladderMax`, `@sum.equippedTrait` match none of these items.

### qualify1 (9)
- **Danger Sense** - an Initiative-formula reroll.
- **Ignite**, **Fireball** - the turn-end attack at the burning creature's turn, hit-card note, two action-costed buttons.
- **Addicted (Dark Energon)** - a resource-cost multiplier while craving, a d20 + recorded-die attack, a day counter.
- **Best-Laid Plans**, **One Last Chance** - reroll offers on any roll card, pressed by the roller, pooled per Party.
- **Ninpō JOEs** - the second pick's list depends on the first pick's traits (Martial Arts on one of the two).
- **Nothing Personal** - attach a compendium upgrade to a picked owned weapon.
- **Tenacity** - `roll:save` and a turn-start "end what expires this turn" step.
- (Partial: **Good To Go**'s kit-prerequisite hook; **Nu, Pogodi!**'s seat swap and Condition removal.)

### qualify2 (10)
- **Weapon Enthusiast (Perk / Hang-Up)** - a weapon-type tag (flag / trait / one-handed / name words, filled from a pick) and
  the Hang-Up's set-aside of banked Lend Assistance.
- **Training Evolution** - a recorded pick over another actor's weapons / vehicles read as a Qualification and a Specialization.
- **Destructive Overcharge, Cascading Failure** - delayed button cards and a blast test around a point.
- **Sensitive, Detail Oriented** - a cost on another item's daily counter and a round-scoped ignore of the banked Snag.
- **Do Or Die** - add a die to a posted check; a Moxie cost that rises on a second use.
- **Wild Idea** - a DialogSwitch bonus pool die.
- **Timeline Anomaly** - a swap-Initiative step (`writeInitiative` can't read the other combatant's Initiative).
- (Partial unchanged: **Oorah!** - its shared vehicle ↑1 is in `dice.mjs`.)

### data1 + data21 (11)
- **Reinforced Shell** - static `rule:host:` tags and a dealt note with no damage value.
- **Over Brawn, The Heavy, Pack Mule** - an equipment-requirement Brawn rule.
- **Dino Thunder ×4** - picks read across items / actors, a single-use pool with fallback, a custom-hook step.
- **Stinger Spray (attacks)** - a preRoll per-attack cost that warns instead of refusing.
- **Larger Than Life** - `@other.<path>` in ItemModifier and "leave a missing value alone".
- **Sky Morpher** - a "driving your own Zord" tag (listed on the Ranger's sheet or linked as its owner).

### data22 + mlp1 + mlp2 (24)
- **Data-Link** - a "companion drone not Commanded this round" tag.
- **Smoke Screen, Smoke Bomb** - a canvas-point step, recipients around it, positional roll sources.
- **Assault Claw** - moves only with `rules/grappled.mjs`.
- **Demolecularization Gun, Waterrunning** - marks that carry their own rule onto the marked creature's rolls.
- **Primeon Blade** - per-megaform-member buttons.
- **Shape-Shift / Face-Shift / Master Morph / Size-Shift (Use), Face-Shift and Master Morph (sources)** - a multi-pick shape
  dialog with a size write and undo.
- **Brilliant Sight, Illusion Casting, Reach Out, Extra Effective Spell, Long Lasting Spell, Mystical Understanding** - a
  SpellCost rule (Mystical Understanding also runs Magically Fit In's picker and a per-day Essence counter).
- **Softenblows** - automatic outgoing-damage negation on a marked attacker's hits.
- **Sharpcaster, Sorcerous Support** - a free re-cast step; reroll offers on another actor's Fumble card.
- **Friendship Is Mystical** - its Magically Fit In branch needs `magicallyFitInValue`, and a heal capped by the Mystical
  Points held.
- **Reactionary** - an Initiative re-roll step.
- **Thick Skin** - an Active-Effect enable / disable step.
- **Something Is Off** - an incoming DialogSwitch.
- (Partial unchanged: **Basic Shape-Shifting / Ponymorph** - the shape write stays with the shared `mlpShape` flag.)

### wtnv + r2misc + fix3-dice (5)
- **Dog Person** - a creature-kind / regex target tag and a per-Skill `specialize` on a DialogSwitch.
- **Third Eye** - `ignoreDownshift` on a DialogSwitch.
- **Staggering Sway** - a watcher's note on the hit card before damage lands, holder anywhere in the world.
- **Dominate** - power-activation hooks and stored victim state.
- **Shadow** - an incoming DialogSwitch with a conditional default.

## Edits outside my files

Three small engine edits, all in `module/rules/` (checked in a scratch copy: with them the whole `module/rules` suite passes):

1. `module/rules/legacy-choices.mjs`, `legacyPaths` - let a recording `pickGrant` carry `legacy` (old picks move into its list):
   ```
   -      if (step?.do == 'pick' && step.key && step.legacy) {
   +      if ((step?.do == 'pick' || (step?.do == 'pickGrant' && step.record)) && step.key && step.legacy) {
   ```
2. `module/rules/predicate.mjs`, the `pickedSource` branch - a lone `{uuid, name}` (Alternate Officer's old single pick, moved in
   by `legacy`) counts as a list of one:
   ```
       if (key == 'pickedSource') {
   -      const stored = ctx.ruleItem?.flags?.essence20?.rules?.choices?.[arg];
   +      const kept = ctx.ruleItem?.flags?.essence20?.rules?.choices?.[arg];
   +      // A lone {uuid, name} (an old single pick moved in by `legacy`) counts as a list of one.
   +      const stored = kept && typeof kept == 'object' && !Array.isArray(kept) ? [kept] : kept;
   ```
3. `module/rules/steps.mjs`, the `grant` step - fill `{var.<key>}` in the uuid, so a recorded pick can be granted
   (`"uuid": "{var.picked}"`):
   ```
   -    const uuid = interpolate(String(step.uuid ?? ''), ctx.item);
   +    const uuid = interpolate(String(step.uuid ?? ''), ctx.item)?.replace(/\{var\.([\w-]+)\}/g, (match, key) => String(ctx.vars?.[key] ?? ''));
   ```

Optional clean-up: `module/helpers/extensions/index.mjs` line `import "./data21/officer.mjs";` can go together with the now-empty
`module/helpers/extensions/data21/officer.mjs` (left in place so the generated import doesn't break).

## Unused strings

`lang/en.json` keys no longer used by any code: `E20.Q1PickLimitedWeapon`, `E20.Q1PickLimitedRestrictedWeapon`,
`E20.Q1PickTwoHandedWeapon`, `E20.Q1PickPlanPrompt`, `E20.Q1PlanLimitedPair`, `E20.Q1PlanRestrictedWeapon`,
`E20.Q1PlanRestrictedArmor`, `E20.Q1PickLimitedArmor`, `E20.Q1PickRestrictedWeapon`, `E20.Q1PickRestrictedArmor`,
`E20.Q1TrainedChosen`, `E20.Q1ChooseWeapon`, `E20.Q2AlreadyChosen`, `E20.Q2UpgradeTrainingPrompt`, `E20.Q2ThreeLimited`,
`E20.Q2OneRestricted`, `E20.D21OfficerApplied`, `E20.D21OfficerAppliedWeapon`.

## Rule count

14 rules added: a Use and a Qualification on each of Service, Trade Goods, For The Syndicate, Good To Go, Nu, Pogodi!, Upgrade
Training and Alternate Officer Equipment Training.

## Engine pieces the remaining skips need (most useful first)

This is likely the last round, so plainly: items marked **permanent** are bespoke UI or whole subsystems and should stay code; the
rest each need the named piece.

1. **Reroll offers on any roll card, pressed by the roller** (any roll message, a pool sized by a formula and shared by a Party,
   posting a fresh card; an "add a die" mode). Unblocks Best-Laid Plans, One Last Chance, Sorcerous Support, Do Or Die's die.
   Medium.
2. **SpellCost rule** (cast-dialog checkboxes: set / add / multiply the cost, plus a "re-cast free" step). Unblocks Brilliant
   Sight, Illusion Casting, Reach Out, Extra Effective Spell, Long Lasting Spell, Sharpcaster, part of Mystical Understanding.
   Medium.
3. **Weapon-type tag** `item:weaponType:<type>` (the flag a pick tagged the weapon with, the same-named trait, one-handed, the name
   words) with `{choice.<key>}`, plus a RollModifier `immune: ["lendAssistance"]` that sets banked Lend Assistance aside for that
   roll. Unblocks Weapon Enthusiast (Perk and Hang-Up). Small-medium.
4. **Incoming DialogSwitch** (on the roller's dialog, from the target's item) with a conditional default. Unblocks Something Is
   Off, Shadow. Medium.
5. **Marks that carry rules** (the marked creature gets rules from the setter's item while marked) + a roll step against a
   recipient's Defense with a formula downshift + outgoing negate-damage. Unblocks Waterrunning, Demolecularization Gun,
   Softenblows, Ignite + Fireball. Medium-large.
6. **Initiative steps** (re-roll / swap with another combatant / formula reroll). Unblocks Danger Sense, Reactionary, Timeline
   Anomaly. Medium.
7. **A pick's traits in later steps** - e.g. `pickGrant` storing the picked entry's traits in `@var` / a tag
   `var:pickedTrait:<trait>` usable in the next pick's `tags`. Unblocks Ninpō JOEs. Small.
8. **Grant onto a host** - `grant {attachTo: choice:<key>}` (fit a compendium upgrade to a picked owned weapon, the way
   `setEntryAndAddItem` does). Unblocks Nothing Personal. Small.
9. **A recorded pick over another actor's items read as a Qualification / Specialization** (`pickedSource` reading an owned
   item's book source, `specialize` on `item:pickedSource`, plus vehicles crewed by that actor). Unblocks Training Evolution.
   Small-medium.
10. **Canvas-point step + recipients around a point + delayed button cards.** Unblocks Smoke Screen, Smoke Bomb, Destructive
    Overcharge, Cascading Failure. Medium.
11. **Equipment requirement rule** (Brawn offset / ignore). Unblocks Over Brawn, The Heavy, Pack Mule. Small.
12. **`roll:save` tag + "end an effect expiring this turn" step.** Unblocks Tenacity. Small.
13. **Hit-card note for a watcher before damage lands** (holder anywhere in the world). Unblocks Staggering Sway. Medium.
14. **Companion tags:** `companion:commanded` (this round) and `vehicle:ownZord` (driving a Zord listed on / linked to the
    driver). Unblocks Data-Link (with a turn-end mark), Sky Morpher. Small.
15. **Smaller one-offs:** `@other.` in ItemModifier (Larger Than Life); `ignoreDownshift` / per-Skill `specialize` on a
    DialogSwitch (Third Eye, Dog Person); a preRoll cost that warns (Stinger Spray attacks); an Active-Effect toggle step (Thick
    Skin); a cost on another item's daily counter + a round-scoped Snag ignore (Sensitive, Detail Oriented); a DialogSwitch bonus
    pool die (Wild Idea); a Kit-prerequisite rule (Good To Go's other half). Small each.
16. **A legacy pass for marks** (a one-off move of a holder-side list of creature keys into perSetter marks) - would close
    slE8's difference 1 for Fresh Mark / Natural Style. Small.
17. **Effectively permanent code** (bespoke UI or whole subsystems - no engine piece planned): Shape-Shift / Face-Shift / Master
    Morph / Size-Shift and Basic Shape-Shifting / Ponymorph's shape half, Dino Thunder ×4, Dominate, Addicted (Dark Energon),
    Primeon Blade, Assault Claw (`rules/grappled.mjs`), Reinforced Shell, Friendship Is Mystical, Nu, Pogodi!'s seat swap and
    Condition removal, Oorah!'s half (in `dice.mjs`), Do Or Die's rising Moxie cost.
