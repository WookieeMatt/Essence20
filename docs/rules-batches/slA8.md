# Batch slA8: eighth pass over the `zord1`, `zord2`, `pr1`, `pr2`, `pr3` slices

**Scope:** every item `docs/rules-batches/slA7.md` left skipped (73) or partial (13), re-checked against the guide's
round-8 section ("Engine features added 2026-10-06 (round 8, after the local round-7 conversions)": marks per setter +
`@target.myMark`, `@sum.items|equipped`, `@count.named`, `atLeast()`, `until: mission`, `self:combatant`,
`scene:token:<tags>`, `pick from: actors` + `actorType`, `setVar`, the `updateActor` ladder, the `itemAdded` /
`movedOnTurn` events, WeaponTrait rules seeing the weapon id, button limits counting finished runs, Rest not counting as
`resourceSpent`) and against the earlier sections again; slA7's recorded behaviour differences looked at again.
Edited in place (no branch, no commit).

| Verdict | zord1 + zord2 | pr1 | pr2 + pr3 | Total |
|---|---|---|---|---|
| Convert (was skip) | 0 | 0 | 2 | **2** |
| Partial now fully converted | 0 | 0 | 0 | **0** |
| Skip now partial | 0 | 0 | 0 | **0** |
| Still partial, nothing more converts | 9 | 3 | 1 | **13** |
| Still skip | 44 | 12 | 15 | **71** |
| Re-checked (skip + partial) | 53 | 15 | 18 | **86** |

(Converted: Incineration Blast (pr2, on its weapon effect) and Zord Mount (pr3).)

**Rules added:** 4 rules on 2 pack items. `scripts/check-rules.mjs`: 1907 rules on 1183 items, 0 errors, 0 warnings.
ESLint (`--ext .js,.mjs`) is clean on `pr2/`, `pr3/` and the new test file. Jest passes on the five slice folders plus
`module/rules/conv8-slA8.test.js` and `conv7-slA7.test.js` (7 suites, 110 tests).

## Converted

- **Incineration Blast (Finster's Monster-Matic Cookbook, pr2)** -
  `packs/fmmcitems/_source/Incineration_Blast_Effect_q415Hdvrl2rrCu9y.json` (the weapon effect the Incineration Blast
  weapon `vhEMHZasM90vmoJN` carries as its attack, so both of the old matches - the effect, or an effect hanging off that
  weapon - are this item). Two rules:
  - a `hit` Trigger, `outcome: crit`, `when: ["item:own"]`: `mark {to: target, key: pr2IncinerationSmolder, until:
    endOfNextTurn, untilOf: recipient}` and a chat line - the old `incinerationRider` (Critical Success only, its
    `untilEndOfNextTurn(target)` mark);
  - a `movedOnTurn` Trigger with `watch: any`, `when: ["markedByMe:pr2IncinerationSmolder"]`: `unmark` the mover, then
    `damage {to: target, amount: 1, damageType: fire}` - the old `updateToken` hook (the marked actor's token moving on
    its own turn: the mark comes off, 1 Fire through `applyDamage`). `endOfNextTurn` counted on the marked creature's
    turns replaces the old `registerTurnEnd` clean-up (the mark is gone once its next turn has ended). The key is shared
    (not per setter), so a second crit from another holder takes the mark over and the creature still burns once.
  Removed from `pr2/finster.mjs`: `SMOLDER_KIND`, `isIncinerationBlast`, `incinerationRider` and its `registerHitRider`,
  `writeMark`, `onTokenMoved` and its `updateToken` hook, the `registerTurnEnd` block, the now-unused `registerHitRider` /
  `registerTurnEnd` imports (header comment updated); `PR2.incinerationBlastWeapon` / `incinerationBlastEffect` from
  `pr2/common.mjs`; the "recognised by effect or weapon" slice test.
- **Zord Mount (Through the Shattered Grid, pr3)** - `packs/ttsgitems/_source/Zord_Mount_5IKuaL41Ebd4ll8i.json`. Two
  rules:
  - a Use "Zord Mount: name the rider": `choose` between "Pick the rider Zord" (`pick {key: rider, from: actors,
    actorType: zord, notSelf: true, legacy: "flags.essence20.pr3MountRider"}` - every other Zord in the world, the old
    `worldActors().filter(type == 'zord')` list; existing riders move over through the GM's linking pass) and "No rider"
    (`updateItem` blanking both the pick and the old flag, so the linking pass can't bring the old rider back);
  - an `afterRoll` Trigger "Zord Mount: rider follow-up", `when: ["attack:melee", "roll:targets>=1",
    "rule:data:flags.essence20.rules.choices.rider"]`, `limit: {per: turn, max: 1}`: `target {min: 0}` then a chat line
    `@UUID[{choice.rider}] may also make a melee Attack against {target}.` (chat content is enriched, so the uuid shows
    as the rider's name). This is the old `registerPostRoll` note: a melee attack with at least one target, hit or miss
    (the old code read `hits`, which lists every target), once per turn in a running combat and every time outside one
    (a `turn` limit counts nothing without a started combat, as the old turn stamp did).
  Removed from `pr3/ttsg.mjs`: the whole Zord Mount section (`RIDER_FLAG`, `MOUNT_TURN_FLAG`, the `pr3ZordMount` Use, the
  `registerPostRoll` note) and the now-unused `isThisTurn` / `turnStamp` imports; `isThisTurn` (no other user) and
  `IDS.zordMount` from `pr3/common.mjs`; the registration test now asserts `pr3ZordMount` is gone.

New tests: `module/rules/conv8-slA8.test.js` (12 tests, each item loaded from its pack source).

## Behaviour differences worth a decision

1. **Incineration Blast** - the burn is a watch Trigger, so it needs the attacker's token on the viewed canvas when the
   target moves (the old GM-side hook burned whatever the attacker's whereabouts), and it runs on the moving user's
   client rather than the GM's (the mover owns the token, so the damage still applies directly). The crit note is a rules
   chat line instead of text appended to the hit card's rider note. Marks set by the old code (`riderMarks`) on a live
   world are ignored after the update - they last one turn at most.
2. **Zord Mount** - the Use asks "pick a rider / no rider" first and then the Zord (the old one select had "Nobody" at the
   top); the follow-up line names the rider through a content link and still posts if the rider Zord was deleted (the old
   code skipped it then); an old pick that the linking pass hasn't moved yet posts nothing until it has (the pass runs on
   the GM's load); the follow-up names the user's first target at the time of the roll (the old note read the roll's
   first target row - the same token in practice).

### slA7's recorded differences, looked at again

- #1 Additional Pair of Limbs' ↓1: the `rollRules` edit slA7 asked for is in (`module/rules/adapter.mjs` line 83 passes
  `game.user.targets.size` as `targetCount`), so the ↓1 is now an automatic source - difference resolved, no rule change
  needed.
- #2 (Limbs' picker), #3 (Power Flux chat / crew reach), #4 (Instructor) - nothing in round 8 changes them. Instructor's
  legacy-student reader stays: `perSetter` marks don't help carry the old flag's `students` list.

## Still partial (13)

| Item | What stays code, and why |
|---|---|
| Mercurial Nature | Unlimited Mass Shift reads `ZORD2.mercurialNature` inside the daily Mass Shift pool (code state). |
| Ranger Operator [Form] | Form lifecycle (un-equip by class, restore on de-Morph). |
| Beast Morpher [Form] | Every row sits in the Form Use (an extension Use hides a rule Use). |
| Ninja Storm Wind Ranger [Form] | Form Use rows, Duplication after `ruleDerived`, an incoming DialogSwitch. |
| Time Force [Form] | Form lifecycle; its rows are Form Use rows. |
| Supersonic [Form] | Hit-time damage-type changes and the Form lifecycle. |
| Megafauna | Smarts/Social after Terrorzord's code; `holder:` context in SkillSubstitution; flag set by hooks. |
| Hybridization | Daily Mass Shift pool scaling with level, size class as text, patched core checks. |
| Lightspeed Boost | The picker (an object pick; HAZMAT's two distinct types) and the in-flight / submerged Evasion (token elevation). |
| Advanced Dino Gem Integration | Primordial Power's post-hit +2 note; Genetic Resonance (`zord-summon` timing). |
| Shinobi of the 63rd Hexagram | The Defense picks live only as Active-Effect enabled states on existing copies. |
| S.W.A.T. Upgrade | Incapacitation Ammo: the alternate-fire switch as a hit-card rider option. |
| Bend Physics | The Movement doubling: no stage sits where pr2's hook does (see Unique Weapon (Two-Handed Melee)). |

## Still skipped (71), and what each still needs

**zord1 / zord2 (44)**
- Lightspeed Response, Turbo - the Form lifecycle (Morph-time choice, un-equip / restore).
- Solar Power - a hit-time damage-type override and a per-hit rider option.
- Dino Thunder - per-copy timed powers with canvas point picks.
- Emotional Range - a ChoiceSet that grows with a Role Points value, read by `emotional-mastery.mjs`.
- Emotional Strength - the active Emotional Mastery options are code state (no `check:`), the once-per-scene flag is shared with `emotional-mastery.mjs`, a Group Test result event is missing.
- Rex Feature, Additional Zord - `pick from: actors` finds the Zord now, but no step can grant onto / act on the picked actor (a `to: picked` recipient); Additional Zord also a pre-update veto.
- Terrorzord Nature - an owned-Zord link scope and a `spend` switch paid by the pilot.
- Anti-Armor - an armor-shred CriticalOption (capped at the target's armor share, scene-long); the trait write is permanent.
- Phantom Focus: Ship Integration - a timed driver-to-vehicle link `driven` rules can read.
- Multi-Megaform, Signature Finishing Move, Advanced Signature Finishing Move, Power Master, Target Master, Accurate Combiner, Assault Weapon - Megaform roster reading.
- Enlarged, Shrunk - a size-class (text) step / DerivedStat and an equip veto.
- Revolutionary Shape-Shifting - a text prompt, a size step and a scene state a switch can read.
- Gestalt Combiner, Matched Combiner, Universal Component, Efficient Combination, Invigorating Connection, Macro-Magnetic Linkage, Safe Release, Core Body (EoC), Titan Hardpoint, Enhanced Attack (EoC), Universal Receptors - Megaform roster reading in the merge / break-apart code.
- Gestalt Hunter - a rule that changes another switch's effect.
- Enhanced Melee Attack, Enhanced Ranged Attack - generated on the Megaform and regenerated as its roster changes.
- Warrior Mode (size), Mesh Zord - a size-class DerivedStat (text); Mesh Zord also flag-list picks and a Megaform-membership test.
- Power Matrix - a reserve scaling with copies (`@count.named` could count them), drawn by the driver, refilled on the pilot's rest.
- Versatile Combiner - a Trait from the owner's spectrum colour (Role name).
- Adaptable Future Tech - a combine-eligibility check.
- Zord Feature (slot) - the owned-Zord recipient.
- Zord Ultra Mode - turning other Features' Active Effects on / off, ending on Defeat.
- Defender Torozord - creates a Megaform actor.
- Dozer Blade (Alt Mode) - a Region-clearing step.

**pr1 (12)**
- Mobile Headquarters (rest) - derived Initiative Edge (not a switch-off-able source), a scene-wide actor-type aura, Megaform link.
- Overdrive - a crew member paying the cost, per-turn "options taken" memory, an energy-only post-hit note.
- Prospector Toolkit - a bonus-die bank (More Heads), returned when another roll comes first.
- Spectrum Shifted - what an old Role keeps on a Role change (role-handler hooks).
- Time Displaced (Use half) - a step rolling a chosen die one size up to a blind card with the anomaly band.
- Warhead Magazines - three picks per copy excluding taken types, a select switch with an action cost, a rider option.
- Be an Example - `skill:` against `system.originSkillsIncrease` (a data path, not a pick) or `appliesWhen` filled at bank time.
- Destiny (Hang-Up) - a GM-side card button (Reaction `who` has no GM), a GM Story Point resource, a Fumble conversion.
- Nemesis (the reroll) - a whole-formula reroll that leaves the choice to the player, on cards without target rows.
- Stand Behind Me! - blocking the roll before it is made and per-enemy turn-start tests.
- Tactical Size Shift - text size DerivedStat; the Skill half could use the `ladder` now, but the old step stops at d12 (`ladder` goes on to 2d8 / 3d6) and is undone when the Feature goes (no `removed` event).
- Warzord (rest) - Titanic after Tactical Size Shift, a Megaform-combines event.

**pr2 / pr3 (15)**
- Aim Apparatus - `pick from: team` + the `updateActor` ladder on the picked actor almost do it, but: no recipient for the picked actor (`to: picked`), the ladder has no d12 cap (the old step never passes d12), and there is no `removed` Trigger event to step it back down.
- Dino Drive Mode - the reduction applies to any Energy hit, an Active Effect on a chosen movement type, a Zord-within-30-ft-holding-X tag (`scene:token:` has no range).
- Aura of Decay - a before-roll event (charged before the dialog, even if cancelled).
- Flames of Hate - an "ignore armor" Defense mode after best / halve.
- Megaform Expeditor - the join time is rolled inside `combiner-timer.mjs` (no rule hook).
- Ninja Power - its Use shares the button with the code-side Power-upkeep state.
- Peerless Pilot (PR) - a rule hook in the emergency disembark.
- Power Heal - a step running `powerCost`, a pick over a creature's current negative Conditions.
- Unique Weapon (Small Melee) - a rule hook in `zord-summon.mjs`.
- Unique Weapon (Two-Handed Melee) - the -10 ft sits in pr3's derived hook, between Bend Physics' x2 (pr2) and the rules' DerivedStats; no Movement stage matches (see slA7).
- Elemental Fury - the attack's damage / range / classification come from the strongest ranged attack, and it is deleted once rolled.
- Power Construct - `takesDamage` doesn't know melee / the targeted Defense; the alternate rider option.
- Restraining Gear - an opposed-roll step, Power paid by the pilot, Megaform participants.
- Emissary's Gift - a pack filter on `pickPerk` (`pickGrant from.fields` doesn't reach `pickPerk`).
- Protector of Safehaven - `until: mission` and the `limit per: mission` cover the boon's lifetime now, but its "1 Temporary Health" goes through `temp-resources.mjs#grantTemp` (+1 bonus AND +1 Health, recorded and taken back at the scene's end); `heal {temporary: true}` only raises `system.health.bonus` and is never taken back. Needs a temp-resource step (or `heal temporary` routed through `grantTemp`).

## Edits outside my files

None needed. (Carried from slA6 / slA7, still optional: the `links.mjs` `team` + `stacks: false` edit for Bend Physics
with two holders; the `roll-dialog.mjs` comment tidies for Shinobi and Instructor.)

## Unused strings

`E20.Pr2IncinerationNote`, `E20.Pr2IncinerationBurn`, `E20.Pr3MountPrompt`, `E20.Pr3MountNobody`, `E20.Pr3MountSet`,
`E20.Pr3MountCleared`, `E20.Pr3MountFollowUp`.

## Files touched

- `module/items/defenses/nemesis-drain-expiry.mjs`, `pr2/common.mjs`, `pr2/pr2.test.js`
- `module/items/zords/elemental-fury.mjs`, `pr3/common.mjs`, `pr3/pr3.test.js`
- `packs/fmmcitems/_source/Incineration_Blast_Effect_q415Hdvrl2rrCu9y.json`,
  `packs/ttsgitems/_source/Zord_Mount_5IKuaL41Ebd4ll8i.json` (both CRLF, kept)
- `module/rules/conv8-slA8.test.js` (new, CRLF), `docs/rules-batches/slA8.md` (this file)

**Rule count added: 4** (Incineration Blast Effect 2, Zord Mount 2).

## Which remaining items are permanent code, which still need a piece

**Effectively permanent code** (bespoke UI, whole subsystems, or state that lives in code): the TF Combiner merge /
break-apart items (Gestalt / Matched Combiner, Universal Component, Efficient Combination, Invigorating Connection,
Macro-Magnetic Linkage, Safe Release, Core Body, Titan Hardpoint, Enhanced Attack, Universal Receptors), Enhanced Melee /
Ranged Attack (generated items), Spectrum Shifted, Stand Behind Me!, Defender Torozord, Zord Ultra Mode, Dozer Blade, Time
Displaced, Power Heal, Shinobi's Defense picks, Mobile Headquarters, Dino Thunder, Megafauna, Mercurial Nature /
Hybridization (the Mass Shift pool), Ninja Power, Be an Example, Adaptable Future Tech, Versatile Combiner, Gestalt
Hunter, Elemental Fury, Lightspeed Boost's picker and elevation Evasion, Instructor's legacy-student reader.

**Still need an engine piece** (named in the list below): the Form items, the Megaform-roster items, the owned-Zord /
picked-actor items, the size-class items, the hit-time damage-type items, Aim Apparatus, Tactical Size Shift (Skill
half), Protector of Safehaven, Aura of Decay, Emotional Strength, Warzord, Nemesis, Destiny, Prospector Toolkit,
Anti-Armor, Flames of Hate, Bend Physics / Unique Weapon (Two-Handed Melee), and the helper-hook items.

## Engine pieces the remaining skips need (most useful first)

1. **Megaform roster reading** (a `megaform:` tag family / scope: "the Megaform this Zord is part of", "a participant
   holding X", per-participant rows) - Multi-Megaform, Signature Finishing Move x2, Power Master, Target Master,
   Accurate Combiner, Assault Weapon, Mesh Zord, Warzord (rest), Restraining Gear (Megaform half), Mobile Headquarters
   (Megaform half). **Large design.** The TF Combiner merge / break-apart items and Enhanced Melee / Ranged Attack stay
   **permanent code** whatever is built.
2. **Form lifecycle** (steps that un-equip by class and restore on de-Morph, and a Form Use a rule Use can replace) -
   Lightspeed Response, Turbo, Ranger Operator, Time Force, Beast Morpher, Ninja Storm Wind Ranger, Supersonic.
   **Large design.**
3. **A picked-actor recipient** (`to: picked` - the actor a `pick from: actors | team` chose) **plus owned-Zord / crew
   recipients and a pilot-paid cost** - Rex Feature, Zord Feature (slot), Additional Zord, Aim Apparatus, Terrorzord
   Nature, Overdrive, Power Matrix, Restraining Gear (payer), Phantom Focus. **Small** for `to: picked`; **medium** for
   the pilot-paid cost.
4. **A `removed` Trigger event + a die cap on the `ladder`** (`ladder` with `max: "d12"`, and the item's own rules firing
   as it is deleted, with what it picked still readable) - Aim Apparatus, Tactical Size Shift (Skill half).
   **Small.**
5. **A temp-resource step** (`heal {temporary: true}` routed through `temp-resources.mjs#grantTemp`: raise bonus and
   value, record it, take it back at the scene's end) - Protector of Safehaven. **Small.**
6. **Movement rules at a hand-written hook's place** - Bend Physics (doubling), Unique Weapon (Two-Handed Melee).
   **Medium.**
7. **Size class as data** (a Size step / DerivedStat on the size ladder with min / max, and an equip veto) - Enlarged,
   Shrunk, Tactical Size Shift, Warzord (size), Warrior Mode (size), Mesh Zord (size), Revolutionary Shape-Shifting,
   Hybridization (Change Size). **Medium.**
8. **Hit-time damage-type override + rider options from rules** (an "Apply as X" option on the hit card) - Solar Power,
   Warhead Magazines, S.W.A.T. Incapacitation Ammo, Power Construct (alternate), Supersonic. **Medium.**
9. **More Trigger events:** before-roll (Aura of Decay), Group Test result (Emotional Strength), Megaform combines
   (Warzord). **Small each.**
10. **A "choose" reroll** (the player keeps either result, any card) - Nemesis. **Small.**
11. **GM-side Reaction** (`who: gm`) + a GM Story Point resource + a "make it a Fumble" card step - Destiny. **Small.**
12. **Bonus-die bank** - Prospector Toolkit. **Small.**
13. **Armor-shred CriticalOption** and an **"ignore armor" Defense mode** - Anti-Armor, Flames of Hate. **Small-medium.**
14. **A ranged `scene:token:` / `ally:within:` with item tags** (a Zord within 30 ft holding X) - Dino Drive Mode (one of
    its three gaps). **Small.**
15. Rule hooks in specific helpers: `combiner-timer.mjs` (Megaform Expeditor), `zord-summon.mjs` (Unique Weapon (Small
    Melee), Genetic Resonance), emergency disembark (Peerless Pilot), `emotional-mastery.mjs` (Emotional Range), and a
    `pickPerk` pack filter (Emissary's Gift). **Small each.**
16. **Effectively permanent code:** the items listed under "Which remaining items are permanent code" above.
