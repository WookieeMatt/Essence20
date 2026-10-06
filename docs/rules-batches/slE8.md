# Batch slE8: re-check of slE7's skips (qualification, data, MLP, Night Vale and misc slices) against the round-8 engine pieces

Slices: `qualify1`, `qualify2`, `data1`, `data21`, `data22`, `mlp1`, `mlp2`, `wtnv`, `r2misc`, `rules`, `fix3-dice`.

**Scope:** every item `docs/rules-batches/slE7.md` left Still skip (67) or Partial (4: Nu, Pogodi!, Oorah!, Prize Honey, Basic
Shape-Shifting / Ponymorph), re-checked against "Engine features added 2026-10-06 (round 8, after the local round-7
conversions)" in `docs/RULES_CONVERSION_GUIDE.md` (perSetter marks + `markedByMe` / `@target.myMark`, `@sum.items|equipped`,
`@count.named`, `atLeast()`, `until: mission`, `self:combatant`, `scene:token:<tags>`, `pick from: actors` + `actorType`,
`setVar` and Trigger chains, `updateActor ladder`, `itemAdded` / `movedOnTurn`, WeaponTrait seeing the weapon id, button limits
counting finished runs, Rest not counting as `resourceSpent`, `sessionStart` on one GM) and the earlier sections once more.
slE5-slE7's recorded behaviour differences were looked at again: the round-8 `sessionStart` fix (one GM's client,
`isActiveGM`) removes slE7's difference 6 (Everything is Inspiration / Nobility doubling with two GMs) - the edit slE7 asked for
is in. No other one is removed. Edited in place in the shared checkout (no branch, no commit).

| Verdict (re-checked items) | Count |
|---|---|
| Convert (was skip) | **2** |
| Convert (was partial - the code half is gone now) | **1** |
| Partial, nothing more converts | **3** |
| Still skip | **65** |
| Re-checked | **71** |

9 rules were added to 3 pack items. After this batch `scripts/check-rules.mjs` reports 1907 rules on 1183 items (with the other
agents' work), 0 errors, 0 warnings. ESLint (`--ext .js,.mjs`) is clean on every file touched; jest passes on all eleven slice
folders (17 suites, 100 tests) including the new `module/rules/conv8-slE8.test.js` (9 tests). In `module/rules` as a whole the
only failure is `conv8-slA8.test.js` (3 tests) - another agent's file, not touched here.

## Converted (3)

| Item | Pack file | Rules | Removed |
|---|---|---|---|
| Fresh Mark (data22) | `mlpcrbitems/_source/Fresh_Mark_LWCNfr3eEU2y9MyP.json` | RollModifier `edge`, `when: [skill:deception, not:roll:initiative, target:data:uuid, not:markedByMe:freshMarkDeceived]`; Triggers `hit` and `miss`, `when: [skill:deception]`: `mark {to: target, key: freshMarkDeceived, perSetter: true}` (no end). | `data22/mlp.mjs`: the Fresh Mark / Natural Style section (`mlpRollSources`, `mlpPostRoll`, both registrations, `DECEIVED_FLAG`, `MET_FLAG`, `isSocial`), `MLP22.freshMark` / `.naturalStyle`, the `registerPostRoll` / `registerRollSources` / `getSceneEpoch` / `creatureKey` / `has` / `findSourced` imports; `data22/shared.mjs`: `creatureKey` (now unused); `mlp.test.js`: the Fresh Mark, Natural Style and "perks not held" tests (+ imports, the now-unused `creature` / `scene` helpers). |
| Natural Style (data22) | `mlpcrbitems/_source/Natural_Style_IgjtNiGBXQinE1GO.json` | RollModifier `upshift: 1`, `when: [not:roll:initiative, target:data:uuid, {any: [essence:social, skill:animalHandling / deception / performance / persuasion / streetwise]}, {any: [not:markedByMe:naturalStyleMet, markedByMe:naturalStyleMetHere]}]`; Triggers `hit` and `miss`, `when: [{any: the five social Skills}]`: `mark naturalStyleMetHere {perSetter, until: scene}` then `mark naturalStyleMet {perSetter}`, both with `filter: [not:markedByMe:naturalStyleMet]`. | (with Fresh Mark, above) |
| Mrs. Doubleshoe's Prize Honey - its Use (mlp1, was partial) | `dsoeitems/_source/Mrs__Doubleshoe_s_Prize_Honey_tbBjkVhSSc3Zj9zp.json` | Use (appended to its DialogSwitch), `when: [not:rule:data:flags.essence20.usesLeft<=0]`: `updateActor {to: targetOrSelf, filter: [target:data:system.health], add: {system.health.value: 3}, max: "@recipient.system.health.max"}`; a chat line naming the target (or the user with nothing targeted); `setVar fresh 1` when the item has no `usesLeft` yet; `updateItem self` sets `usesLeft` 2 when fresh, else adds -1. The item has no slice code left. | `mlp1/mlp1.mjs`: the `mlp1Honey` `USES` entry, `MLP1.prizeHoney`, the header mention. No old test covered it. |

Why they are exact:

- **Fresh Mark.** Old: a roll source (Edge) on a Deception roll with a target, unless that creature's key (its token id for an
  unlinked token, else the actor id) was in the holder's `d22Deceived` list; after the roll every creature rolled against (hit or
  miss - `hits` holds every result with a target) was added. Now the memory is a mark on the creature, one per setter
  (`perSetter`), with no end: `markedByMe` reads only this holder's copy, so two Fresh Mark holders keep separate memories as
  before. The `hit` / `miss` Triggers fire from the same post-roll pass, once per target rolled against, with the rolled Skill.
  `target:data:uuid` keeps a roll with no target from answering "unknown" (the old code gave nothing without a target);
  `not:roll:initiative` keeps it off Initiative, which the old roll source never reached.
- **Natural Style.** Old: ↑1 on a test whose Skill or rolled Essence is Social, against a creature never met (no stamp) or met in
  the current scene (stamp = scene counter); a social Skill roll stamped every creature rolled against that had no stamp yet, so
  a later scene never restamped. Now: the first social Skill roll against a creature marks it `naturalStyleMet` (forever) and
  `naturalStyleMetHere` (until the scene counter moves); both steps skip a creature already `naturalStyleMet`, so a later scene's
  roll doesn't re-open the window. The ↑1 holds while not met, or met-here is still running - the same two cases. The
  roll-side test reads Essence or Skill (`isSocial(skill, essence)`), the memory side Skill only (`isSocial(skill)`), as before.
- **Prize Honey.** Old: `canUse` while `usesLeft ?? 3` > 0; heal the first targeted actor (else the user) to
  `min(max, value + 3)` - lowering Health that sat above the maximum - when it has Health; then `usesLeft = (usesLeft ?? 3) - 1`.
  Now: the Use's `when` is the same idiom the item's DialogSwitch already uses (a missing count compares false, so it's
  usable); `updateActor add` clamps to `max` read per recipient, which is `min(max, value + 3)`; the count is set to 2 the first
  time (no flag yet) and lowered by 1 after - `setVar` decides once before either write, so the two `updateItem` steps can't both
  run. No action cost, no limit, as before.

Tests (`module/rules/conv8-slE8.test.js`, loading each pack item): Fresh Mark (Edge on the first Deception against a creature, not
after a hit or a miss on it, still against a new one, none without a target, none for another Skill, the memory survives a scene
change, a second holder keeps its own memory, none on Initiative, nothing without the Perk); Natural Style (↑1 on a social Skill
or a Social-Essence roll, none for Might or with no target, still ↑1 in the meeting scene, none in a later scene, a later roll
doesn't restamp, a new acquaintance in the later scene still counts, a non-social Skill doesn't meet them, a miss does, none on
Initiative); Prize Honey (heals the user with nothing targeted, three uses then the Use is unavailable, a stored count counts
down, the targeted creature is healed and Health above the maximum comes down to it, a target with no Health is left alone and
the use still counts).

## Behaviour differences worth a decision

1. **Fresh Mark / Natural Style - existing memories (same line, one-off).** The old lists (`flags.essence20.d22Deceived` /
   `d22Met` on the holder) aren't read any more, so a character who already deceived / met someone gets Edge / ↑1 against them
   once more (after that the new marks take over). `legacy` covers pick and toggle flags only; a one-off GM migration turning each
   listed key into a mark on that token / actor would close it (none written - it would live outside my files). The old lists
   are now dead flags.
2. **Fresh Mark / Natural Style - where the memory lives (same line, edge).** The memory is a flag on the creature, written by
   the holder (through the GM when the player doesn't own it - the usual mark write), rather than a list on the holder. A
   creature that is deleted and re-made counts as new (as before, a new token / actor id did too). A holder that is an unlinked
   NPC token now shares its memory with other tokens of the same actor (`perSetter` keys on the actor id; the old list sat on
   that token's own synthetic actor) - no NPC carries these Perks in the packs.
3. **Fresh Mark / Natural Style labels (presentation).** The Roll Options Dialog sources read "First Deception against this creature (Fresh
   Mark: Edge)" / "Social test with a new acquaintance (Natural Style: ↑1)" instead of the item names.
4. **Prize Honey (same line, small).** (a) Gear that is explicitly unequipped has no Use any more (rules on gear switch off while
   unequipped - the same as its DialogSwitch since slE); new copies are equipped by default. (b) The chat line is the rule's
   ("X eats the Prize Honey (heals up to 3 Health).") under the rule label, not `E20.Mlp1HoneyHeals`. (c) Healing a target the
   player doesn't own now goes through the GM relay (the old direct `target.update` failed for a player).

## Still skipped (65), and what each still needs

Round-8 pieces looked at and why they don't reach these: `pick from: actors` + `actorType` picks a Zord but nothing records
"this Ranger's own Zord" for Sky Morpher's roll test; `until: mission` fits Training Evolution's pick, but the pick is over
another actor's weapons / vehicles and must be read as a Qualification; `scene:token` / `self:combatant` don't give Smoke
Screen / Smoke Bomb a point on the canvas; `setVar` + Trigger chains don't make a pick into a Qualification; `@sum` / `@count.named`
don't express Larger Than Life's per-weapon "at least Large reach"; `itemAdded` / `movedOnTurn` match none of these items.

### qualify1 (13)
- **Danger Sense** - an Initiative-formula reroll.
- **Ignite**, **Fireball** - the turn-end attack at the burning creature's turn, hit-card note, two action-costed buttons.
- **Addicted (Dark Energon)** - a resource-cost multiplier while craving, a d20 + recorded-die attack, a day counter.
- **Best-Laid Plans**, **One Last Chance** - reroll offers on any roll card, pressed by the roller, pooled per Party.
- **Service, Trade Goods, For The Syndicate, Good To Go, Ninpõ JOEs** - a recorded compendium pick read by a Qualification
  (Good To Go also its kit-prerequisite hook).
- **Nothing Personal** - attach a compendium upgrade to a picked weapon.
- **Tenacity** - `roll:save` and a turn-start "end what expires this turn" step.
- (Partial unchanged: **Nu, Pogodi!**'s weapon pick and seat swap.)

### qualify2 (11)
- **Upgrade Training** - a recording compendium picker read by a Qualification.
- **Weapon Enthusiast (Perk / Hang-Up)** - a weapon-type tag (flag / trait / one-handed / name words, filled from a pick) and
  the Hang-Up's set-aside of banked Lend Assistance.
- **Training Evolution** - a pick over another actor's weapons / vehicles (mission-long - `until: mission` now exists), read as
  a Qualification.
- **Destructive Overcharge, Cascading Failure** - delayed button cards and a blast test around a point.
- **Sensitive, Detail Oriented** - a cost on another item's daily counter and a round-scoped ignore of the banked Snag.
- **Do Or Die** - add a die to a posted check; a Moxie cost that rises on a second use.
- **Wild Idea** - a DialogSwitch bonus pool die.
- **Timeline Anomaly** - a swap-Initiative step (`writeInitiative` can't read the other combatant's Initiative).
- (Partial unchanged: **Oorah!** - its shared vehicle ↑1 is in `dice.mjs`.)

### data1 + data21 (12)
- **Reinforced Shell** - static `rule:host:` tags and a dealt note with no damage value.
- **Over Brawn, The Heavy, Pack Mule** - an equipment-requirement Brawn rule.
- **Dino Thunder ×4** - picks read across items / actors, a single-use pool with fallback, a custom-hook step.
- **Stinger Spray (attacks)** - a preRoll per-attack cost that warns instead of refusing.
- **Larger Than Life** - `@other.<path>` in ItemModifier and "leave a missing value alone".
- **Sky Morpher** - a "driving your own Zord" tag (listed on the Ranger's sheet or linked as its owner).
- **Alternate Officer** - a recorded compendium pick (a Limited melee weapon) read as Qualified.

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

None. (slE7's requested `isGM` -> `isActiveGM` edit in `module/rules/triggers.mjs`'s `sessionStart` hook is already in.)

## Unused strings

`lang/en.json` keys no longer used by any code: `E20.Mlp1HoneyHeals`.

## Rule count

9 rules added: 3 on Fresh Mark (RollModifier, hit and miss Triggers); 3 on Natural Style (RollModifier, hit and miss Triggers);
1 Use on Mrs. Doubleshoe's Prize Honey.

## Engine pieces the remaining skips need (most useful first)

1. **Recorded compendium pick read by a Qualification** - a `pickGrant`-style browser with a `record` (no grant) mode that keeps
   the uuid and name under a key (several per key, filters per slot, one slot's pick narrowing the next), and a Qualification
   `items` tag `item:pickedSource:<key>` matching any printing or the name. Unblocks Service, Trade Goods, For The Syndicate, Good
   To Go, Ninpõ JOEs, Upgrade Training, Alternate Officer, Nu, Pogodi!'s weapon pick; with a source over another actor's weapons
   / vehicles (the `until: mission` half exists now), Training Evolution. Medium.
2. **Weapon-type tag** `item:weaponType:<type>` (the flag a pick tagged the weapon with, the same-named trait, one-handed, the
   name words) with `{choice.<key>}`, plus a RollModifier `immune: ["lendAssistance"]` that sets banked Lend Assistance aside for
   that roll. Unblocks Weapon Enthusiast (Perk and Hang-Up). Small-medium.
3. **Reroll offers on any roll card, pressed by the roller** (any roll message, a pool sized by a formula and shared by a Party,
   posting a fresh card). Unblocks Best-Laid Plans, One Last Chance, Sorcerous Support (and Do Or Die with an "add a die" mode).
   Medium.
4. **SpellCost rule** (cast-dialog checkboxes: set / add / multiply the cost, plus a "re-cast free" step). Unblocks Brilliant
   Sight, Illusion Casting, Reach Out, Extra Effective Spell, Long Lasting Spell, Sharpcaster, part of Mystical Understanding.
   Medium.
5. **Incoming DialogSwitch** (on the roller's dialog, from the target's item) with a conditional default. Unblocks Something Is
   Off, Shadow. Medium.
6. **Marks that carry rules** (the marked creature gets rules from the setter's item while marked) + a roll step against a
   recipient's Defense with a formula downshift. Unblocks Waterrunning, Demolecularization Gun, Softenblows (with outgoing
   negate-damage), Ignite + Fireball. Medium-large.
7. **Initiative steps** (re-roll / swap with another combatant / formula reroll). Unblocks Danger Sense, Reactionary, Timeline
   Anomaly. Medium.
8. **Canvas-point step + recipients around a point + delayed button cards.** Unblocks Smoke Screen, Smoke Bomb, Destructive
   Overcharge, Cascading Failure. Medium.
9. **Equipment requirement rule** (Brawn offset / ignore). Unblocks Over Brawn, The Heavy, Pack Mule. Small.
10. **`roll:save` tag + "end an effect expiring this turn" step.** Unblocks Tenacity. Small.
11. **Hit-card note for a watcher before damage lands** (holder anywhere in the world). Unblocks Staggering Sway. Medium.
12. **Companion tags:** `companion:commanded` (this round) and `vehicle:ownZord` (driving a Zord listed on / linked to the
    driver). Unblocks Data-Link (with a turn-end mark), Sky Morpher. Small.
13. **Smaller one-offs:** `@other.` in ItemModifier (Larger Than Life); `ignoreDownshift` / per-Skill `specialize` on a
    DialogSwitch (Third Eye, Dog Person); a preRoll cost that warns (Stinger Spray attacks); an Active-Effect toggle step (Thick
    Skin); a cost on another item's daily counter (Sensitive, Detail Oriented); a DialogSwitch bonus pool die (Wild Idea). Small
    each.
14. **A legacy pass for marks** (a one-off move of a holder-side list of creature keys into perSetter marks) - would close
    difference 1 above for Fresh Mark / Natural Style. Small.
15. **Effectively permanent code** (bespoke UI or whole subsystems - no engine piece planned): Shape-Shift / Face-Shift / Master
    Morph / Size-Shift and Basic Shape-Shifting / Ponymorph's shape half, Dino Thunder ×4, Dominate, Addicted (Dark Energon),
    Primeon Blade, Assault Claw (`rules/grappled.mjs`), Reinforced Shell, Friendship Is Mystical, Nothing Personal, Nu, Pogodi!'s
    seat swap, Oorah!'s half (in `dice.mjs`), Do Or Die's rising Moxie cost.
