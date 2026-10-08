# Batch slE4: re-check of slE3's skips (qualification, data, MLP, Night Vale and misc slices) against the round-4 engine pieces

Slices: `qualify1`, `qualify2`, `data1`, `data21`, `data22`, `mlp1`, `mlp2`, `wtnv`, `r2misc`, `rules`, `fix3-dice`.

**Scope:** every item `docs/rules-batches/slE3.md` left Still skip (85 by its table; its lists name 84 - qualify1 holds 20, not 21) or Partial (7, the code half), re-checked against
"Engine features added 2026-10-05 (round 4, after the local round-3 conversions)" in `docs/RULES_CONVERSION_GUIDE.md`
(wielding tags, `combat:exists`, `until: combat`, mark counters / `@mark`, `essenceDamage` / `healEssence` /
`extendCondition`, `rerollCard`, roll `snag` / `open`, grant `name` / `integrated` / `systemFormulas`, step `filter`,
outcome lists + `plainSuccess`, afterRoll `@var.total`, Toggle `legacy`, granted attachments carrying `grantedBy`) and
the earlier sections once more. Edited in place in the shared checkout (no branch, no commit).

| Verdict (re-checked items) | Count |
|---|---|
| Convert (was skip) | **2** |
| Partial, nothing more converts | **7** |
| Still skip | **82** |
| Re-checked | **91** |

2 rules were added to 2 pack items. After this batch `scripts/check-rules.mjs` reports 1620 rules on 1094 items (with the
other agents' work), 0 errors, 0 warnings. ESLint is clean on every file touched; jest passes on all eleven slice folders
and `module/rules/conv4-slE4.test.js` (17 suites, 115 tests).

## Converted (2)

| Item | Pack file | Rules | Removed |
|---|---|---|---|
| Far-Sighted (mlp1, Hang-Up) | `kocitems/_source/Far_Sighted_Sm7INWZQAIXlu5HC.json` | DialogSwitch `{snag: true, default: true, forget: true, when: ["skill:alertness", "self:wielding:not:item:data:system.classification.style=melee"]}`, label "Within 10 feet with a ranged weapon (Far-Sighted: Snag)". | `mlp1.mjs`: `MLP1.farSighted`, `hasRangedWeapon`, the `farSighted` toggle in `mlp1Toggles` (and its now-unused `rolledSkill` parameter), the `snag()` helper and the `ext.farSighted` branch in `mlp1ApplyDialog`. No old test covered it. |
| Stinger Spray (Perk) (data21) | `fmmcitems/_source/Stinger_Spray_90rddMq7sK1SrhBi.json` | Grant `{uuid: <Stinger Spray weapon iOq7mriMr4BCBl78>, skipIfOwned: true}`, label "Stinger Spray attack". | `psycho.mjs`: `grantStingerSpray`, `dropStingerSpray` and their two `Hooks.on` lines, the `findSourced` / `itemsOf` imports; `common.mjs`: `stingerSprayPerk`, `stingerSprayWeapon`; `data21.test.js`: "the Stinger Spray Perk grants its weapon once". The per-attack Personal Power cost (`stingerSprayCost`) stays code. |

Why they are exact:

- **Far-Sighted.** The old toggle was offered when the rolled Skill was Alertness and some equipped `weapon` had an
  attached weaponEffect whose style wasn't `melee`; it started ticked every time (`value: true`, not remembered) and
  ticked it did "Edge? clear it : Snag", which is the same as a Snag (they cancel at roll time). `self:wielding:<tag>`
  asks the tag of each attack whose parent weapon is equipped (`equipped !== false`; weapons default to `true`), and
  `not:item:data:system.classification.style=melee` is true for any other style, a missing style included (tested).
  `forget: true` + `default: true` gives the always-ticked start.
- **Stinger Spray (Perk).** The old `createItem` hook granted the compendium weapon with `grantedBy` unless the actor
  already had an item from that source, on the creating user's client only; `lifecycle.mjs#onCreateItem` does the same
  for a Grant rule (`skipIfOwned` tests the same source set; the user check is the same). The copy's attacks are
  attached the same way (`attachGrantedChildren`) and now carry `grantedBy` themselves, so `onDeleteItem` removes weapon
  and attacks together - what `dropStingerSpray` did. Both are silent, as before.

Tests (`module/rules/conv4-slE4.test.js`, loading each pack item): Far-Sighted's switch on Alertness with a ranged
attack (ticked, Snag), none on other Skills, none with only melee attacks / an unequipped weapon / a loose attack, a
style-less attack counting as ranged, and the switch starting ticked even after it was left unticked. Stinger Spray:
the granted data (source, `grantedBy`), nothing when the weapon is already owned, and the attached attacks listed by
`grantedBy(actor, perk)` (the attachment handler is mocked to create the children).

## Behaviour differences worth a decision

1. **Stinger Spray: characters granted the weapon BEFORE this change (same line).** Their copy's three attacks were made
   without `grantedBy` (the old `grantCopy` didn't stamp children). Removing the Perk now removes the weapon (it carries
   `grantedBy`) but leaves those three attacks behind; the old `dropStingerSpray` also removed children by `parentId`.
   New grants are unaffected. Remedy if wanted: delete the orphans by hand, or have `lifecycle.mjs#onDeleteItem` also
   take items whose `parentId` is a removed granted item (outside my files - not done).
2. **Stinger Spray: the copy's source field (same line, invisible).** `_stats.compendiumSource` instead of
   `flags.core.sourceId`; every source lookup (`stingerSprayCost` included) reads both.
3. **Far-Sighted: shields (same line, edge case).** `wielding` counts any equipped item's attached attacks, so an
   equipped shield with a non-melee attack would now offer the switch; the old code looked at `weapon` items only.
   No shipped shield has a non-melee attack.
4. **Far-Sighted: a matured, ignored Hang-Up (same line).** Rules on a Hang-Up flagged `maturedIgnored` are inactive, so
   the switch is no longer offered for one; the old code didn't check the flag.

## Still skipped (82), and what each still needs

The round-4 "likely wins" named for this slice, re-checked:

- **Best-Laid Plans** - `rerollCard` only runs from a Reaction, and Reactions decorate only check cards (cards with
  `checkResults`) and are pressed by the Reaction holder's owner. The old button sits on ANY d20 roll card of the
  planner or a Party member, is pressed by the roller, draws on one pool shared by the whole Party for the scene,
  sized `1 + floor((total - 10) / 5)` from the planning roll, and posts a fresh check card instead of changing the
  original's rows.
- **One Last Chance** - same Reaction mismatch: the failing ally presses the old button (a Reaction is pressed by its
  holder), the holder only has to be on the scene (no range), sides are by PC/NPC type, and it rerolls ALL dice into a
  new card that can't itself be offered again.
- **Sorcerous Support** - no Reaction outcome for "this card's d20 shows a 1" (a Fumble), cards without `checkResults`
  aren't decorated, and the old flow is "ready it with a Use, then a mission-limited reroll of the whole formula as a
  new plain roll".
- **Sharpcaster** - a free re-CAST (`item.roll` with the spell cost zeroed), not a reroll: needs a SpellCost rule and a
  "roll this item again" step.
- **Stinger Spray (attacks)** - still a preRoll per-attack cost that warns instead of refusing.

### qualify1 (20)
- **Danger Sense** - an Initiative-formula reroll (`r<=2` in `system.initiative.formula`).
- **Ignite** - mark counters can now carry the "fought" ↓ count, but the turn-end attack is the IGNITER's Science
  against the burning creature's Evasion at the end of THAT creature's turn (a watch turnEnd Trigger would need the
  holder on the canvas and a downshift formula on the `roll` step), the hit-card note, "only if not already burning"
  on a fire hit, and the two buttons with their own action costs for the burning creature.
- **Fireball** - goes with Ignite.
- **Addicted (Dark Energon)** - a resource-cost multiplier while craving, a d20 + recorded-die attack, a day counter.
- **Best-Laid Plans**, **One Last Chance** - see above.
- **Nobility** - a Story Point New Session modifier.
- **Service, Trade Goods, For The Syndicate, Good To Go, Ninpõ JOEs** - a recorded compendium pick (with filters,
  several per key) read by a Qualification.
- **Nothing Personal** - an attach-a-compendium-upgrade-to-a-picked-weapon step.
- **Spared No Expense, Surgical Operators, Ultra-Secret Strike Force** - `vehicle:size` / `vehicle:data:` /
  `vehicle:name~` tags and an automatic "any Snag" lift.
- **The Glory of Cobra-La** - an attached-upgrade-by-id tag (weapon and worn armor) and the vehicle tags.
- **Roaming the Land** - a weapon tag "has a melee / Reach attack" usable in a Qualification's `items` (`wielding` is
  an actor tag, not a test of the weapon being requisitioned).
- **Tenacity** - `roll:save` (the old test parses `riderSpec.kind == 'save'`) and a turn-start "end an expiring effect"
  step.
- **Dome Generator** - `@host.<path>` in a Defense rule and a limit pooled across copies.
- (Partials unchanged: **Nu, Pogodi!**'s weapon pick and seat swap; **Mega Training Regimen**'s driving Qualification.)

### qualify2 (16)
- **Upgrade Training** - a recording compendium picker (three picks, one tier) and a Qualification reading it.
- **Hardware Training** - two-handed and upgrade-trait tags.
- **Weapon Enthusiast (Perk / Hang-Up)** - a weapon-type tag; choice-filled `updateItem.set`; an Assist refuse that
  sets aside a banked Lend Assistance.
- **Training Evolution** - a mission-scoped pick over another actor's weapons / vehicles, read as a Qualification.
- **Mentor** - DerivedStat paths with `{choice.<key>}` and boolean writes.
- **At Ease, Disease** - now expressible as askNumber + `roll` (DIF `5 + 5 * @var.amount`) + heal + removeCondition
  defeated with `combat:exists`, but the old code refuses a vehicle / Zord / megaform target and asks the amount BEFORE
  paying the Standard action; a Use pays first (only `pickAlly` runs before the cost), so a cancelled amount would
  still spend the action.
- **Destructive Overcharge, Cascading Failure** - delayed (turn-timed) button cards and a blast test around a point.
- **Opportunist** - `extendCondition` covers the timed Stunned Condition, but the other branch (no timed Stunned: add 1
  to the target's `system.stun.value`) needs an actor-field write on a recipient, and the two are either/or.
- **Sensitive, Detail Oriented** - a cost on another item's daily counter and a round-scoped ignore the Snag bank reads.
- **Do Or Die** - adding a die to a posted check (`rerollCard` rerolls, it doesn't add a die), plus the Moxie cost that
  rises for a second use.
- **Wild Idea** - a DialogSwitch bonus pool die.
- **Timeline Anomaly** - a swap-Initiative step.
- **Everything is Inspiration** - a `sessionStart` Trigger.
- (Partials unchanged: **Whisper Warrior**'s upgrade-trait Qualification and Free Defend; **Oorah!**'s shared vehicle ↑1.)

### data1 + data21 (12)
- **Reinforced Shell** - static `rule:host:` tags and a dealt note with no damage value.
- **Over Brawn, The Heavy, Pack Mule** - an equipment-requirement Brawn rule.
- **Dino Thunder ×4** - picks read across items / actors, a single-use pool with fallback, a custom-hook step.
- **Stinger Spray (attacks)** - see above.
- **Larger Than Life** - `@other.<path>` in ItemModifier and "leave a missing value alone".
- **Sky Morpher** - a "driving own Zord" tag and counting unequipped gear.
- **Alternate Officer** - an actor-field write step and a recorded compendium pick for a Qualification.

### data22 + mlp1 + mlp2 (28)
- **Data-Link** - a "companion drone not commanded this round" tag.
- **Transmetal** - a post-gravity Movement stage, a movement type from `system.choice`, formula comparisons.
- **Fresh Mark, Natural Style** - per-creature memory on the holder: a mark keeps one setter per key on the target, so
  two holders deceiving the same creature would overwrite each other, and Fresh Mark's memory never expires.
- **Smoke Screen, Smoke Bomb** - a canvas-point step, recipients around it, positional roll sources.
- **Assault Claw** - moves only with `rules/grappled.mjs`.
- **Demolecularization Gun, Waterrunning** - marks that carry their own rule (Waterrunning's ↓1 switch belongs on the
  marked creature's rolls; the rule sits on the caster's spell).
- **Primeon Blade** - per-megaform-member buttons.
- **Shape-Shift / Face-Shift / Master Morph / Size-Shift (Use), Face-Shift and Master Morph (sources)** - a multi-pick
  dialog with a size write and undo; `skill:data:<path>`.
- **Brilliant Sight, Illusion Casting, Reach Out, Extra Effective Spell, Long Lasting Spell, Mystical Understanding** -
  a SpellCost rule (plus actor writes for Mystical Understanding).
- **Pinkie Sense** - a d8 step can roll, but nothing maps `@var.rolled` to a table row's text, and the old post is a
  real Roll message.
- **Softenblows** - no automatic outgoing-damage negation on a marked attacker's hits (a Reaction is a button press).
- **Sharpcaster, Sorcerous Support** - see above.
- **Friendship Is Mystical** - writes to the friend's helper flags and a heal capped by the points held.
- **Reactionary** - an Initiative re-roll step.
- **Thick Skin** - an Active-Effect enable/disable step.
- **Something Is Off** - an incoming DialogSwitch.
- (Partials unchanged: **Prize Honey** - a formula default for `updateItem` on a missing flag and the old cap;
  **Basic Shape-Shifting / Ponymorph** - the shape write stays with the shared `mlpShape` flag.)

### wtnv + r2misc + fix3-dice (6)
- **Dog Person** - a creature-kind / regex target tag and a per-Skill `specialize` on a DialogSwitch.
- **Third Eye** - `ignoreDownshift` on a DialogSwitch at the wtnv apply-dialog point.
- **Replacement Teeth** - a target check before the Use's cost (`PICK_FIRST` is still only `pickAlly`; step `filter`
  only narrows recipients after paying).
- **Staggering Sway** - a watch `dealtDamage` Trigger fires after the damage lands and needs the holder on the canvas;
  the old code adds a +1 Stun note to the hit card for any same-disposition holder in the world.
- **Dominate** - power-activation hooks and stored victim state.
- **Shadow** - an incoming DialogSwitch with a conditional default.

## Edits outside my files

None. (Optional, for difference 1: `module/rules/lifecycle.mjs#onDeleteItem` could also delete items whose
`flags.essence20.parentId` is one of the granted ids it removes - that would clean up pre-change Stinger Spray attacks
and any other old-style granted weapon's children.)

## Unused strings

`lang/en.json` keys no longer used by any code: `E20.Mlp1ToggleFarSighted` (the rule's label replaces it).

## Rule count

2 rules added (1 DialogSwitch on Far-Sighted, 1 Grant on Stinger Spray).

## Engine pieces the remaining skips need (most useful first)

1. **Reroll offers on any roll card, pressed by the roller** - a Reaction (or a sibling "Assist" rule) that decorates
   every roll message (not only check cards), lets the ROLLER press it on the holder's behalf, has a `fumble` / failed
   outcome, can draw from a pool sized by a formula and shared by a Party, and can post the reroll as a fresh card.
   Unblocks Best-Laid Plans, One Last Chance, Sorcerous Support (and Do Or Die with an "add a die" mode). Medium.
2. **Actor-field write step** (`updateActor {to, set, add}` on any recipient, booleans too). Unblocks Opportunist (with
   a `target:status:` test to pick the branch), Alternate Officer (with 4), Mentor, Friendship Is Mystical, Mystical
   Understanding's writes. Small.
3. **Pre-cost steps** - let `target` / `askNumber` / a `filter`-checked target run before the Use's cost. Unblocks
   Replacement Teeth, At Ease Disease. Small.
4. **SpellCost rule** (cost multipliers / offsets / set, chosen in the cast dialog, plus a "re-cast free" flag).
   Unblocks Brilliant Sight, Illusion Casting, Reach Out, Extra Effective Spell, Long Lasting Spell, Mystical
   Understanding (with 2), Sharpcaster (with a "roll this item again" step). Medium.
5. **Recorded compendium pick read by a Qualification** (pickGrant-style browser that only records, several per key,
   with filters). Unblocks Service, Trade Goods, For The Syndicate, Good To Go, Ninpõ JOEs, Upgrade Training, Training
   Evolution, Alternate Officer. Medium.
6. **Vehicle tags** (`vehicle:size`, `vehicle:data:`, `vehicle:name~`) + an "any Snag" lift and an attached-upgrade-by-id
   tag. Unblocks Spared No Expense, Surgical Operators, Ultra-Secret Strike Force, The Glory of Cobra-La. Small.
7. **Incoming DialogSwitch** (a switch on the roller's dialog that belongs to the target's item) with conditional
   default. Unblocks Something Is Off, Shadow. Medium.
8. **Marks that carry rules** (a mark grants the recipient rules from the setter's item while it lasts) + a step that
   rolls the holder's Skill against a recipient's Defense with a formula downshift. Unblocks Waterrunning,
   Demolecularization Gun, Softenblows (with an outgoing negate-damage effect), Ignite + Fireball. Medium-large.
9. **Initiative steps** (reroll / swap / formula reroll). Unblocks Danger Sense, Reactionary, Timeline Anomaly. Medium.
10. **Per-creature memory on the holder** (a keyed set of creatures, optionally scene-stamped). Unblocks Fresh Mark,
    Natural Style. Small.
11. **Canvas-point step + recipients around a point + delayed button cards.** Unblocks Smoke Screen, Smoke Bomb,
    Destructive Overcharge, Cascading Failure. Medium.
12. **Equipment requirement rule** (Brawn offset / ignore). Unblocks Over Brawn, The Heavy, Pack Mule. Small.
13. **`roll:save` tag + "end an effect expiring this turn" step.** Unblocks Tenacity. Small.
14. **Table lookup** (a step `when` on `@var.rolled`, or a `table` step posting row text). Unblocks Pinkie Sense. Small.
15. **Hit-card note for a watcher before damage lands** (a watch `hit` Trigger that may add to the hit's damage note,
    holder anywhere in the world). Unblocks Staggering Sway. Medium.
16. **Smaller one-offs:** weapon-type / two-handed / upgrade-trait / "has a melee or Reach attack" item tags (Hardware
    Training, Weapon Enthusiast, Roaming the Land); `@host.<path>` and pooled limits (Dome Generator); `@other.` in
    ItemModifier (Larger Than Life); a post-gravity Movement stage (Transmetal); `ignoreDownshift` / per-Skill
    `specialize` on a DialogSwitch (Third Eye, Dog Person); a preRoll cost that warns instead of refusing (Stinger
    Spray attacks); Active-Effect toggle step (Thick Skin); `sessionStart` Trigger and a New Session modifier
    (Everything is Inspiration, Nobility); a cost on another item's daily counter (Sensitive, Detail Oriented);
    DialogSwitch bonus pool die (Wild Idea). Small each.
17. **Effectively permanent code** (bespoke UI or whole subsystems): Shape-Shift / Face-Shift / Master Morph / Size-Shift
    (multi-pick shape dialog with size undo) and Basic Shape-Shifting / Ponymorph's shape half, Dino Thunder ×4,
    Dominate, Addicted (Dark Energon), Primeon Blade, Assault Claw (`rules/grappled.mjs`), Data-Link, Sky Morpher,
    Reinforced Shell, Prize Honey's half, Nothing Personal, Nu, Pogodi! / Mega Training Regimen / Whisper Warrior /
    Oorah! halves.
