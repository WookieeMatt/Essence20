# Batch slA7: seventh pass over the `zord1`, `zord2`, `pr1`, `pr2`, `pr3` slices

**Scope:** every item `docs/rules-batches/slA6.md` left skipped (75) or partial (14), re-checked against the guide's
round-7 section ("Engine features added 2026-10-06 (round 7, after the local round-6 conversions)": `self:onCanvas`,
`itemCount`, `actionUsed`, `wearingItem`, `hasItem:name~`, `item:word`, `item:hasAttack`, `roll:targets` +
`@var.targets`, `host:` at roll time, `combat:enemy|ally:<tags>`, `dice(count, faces)`, `@count.items|equipped`,
`endOfNextTurnOrScene`, `turnOrUntilCombat`, `to: partyActor`, `choose` options with `when` + `auto`, `pick from: skill`
`essence` / `specializedOnly`, `pick from: team`, `pick auto`, `pickGrant fields|replace`, `difDefenseSelf`, `button
whisper|usedWhenDone`, clicker's selected token, `sessionStart`, `resourceSpent` ignoring loss/refund/rest writes,
the `worldTime` sweep) and against the earlier sections again; slA6's recorded behaviour differences looked at again.
Edited in place (no branch, no commit).

| Verdict | zord1 + zord2 | pr1 | pr2 + pr3 | Total |
|---|---|---|---|---|
| Convert (was skip) | 0 | 1 | 1 | **2** |
| Partial now fully converted | 1 | 0 | 0 | **1** |
| Skip now partial | 0 | 0 | 0 | **0** |
| Still partial, nothing more converts | 9 | 3 | 1 | **13** |
| Still skip | 44 | 12 | 17 | **73** |
| Re-checked (skip + partial) | 54 | 16 | 19 | **89** |

(Converted: Power Flux (pr1), Instructor (pr2). Fully converted: Additional Pair of Limbs (zord1) - its ↓1 needs the
one-line outside edit below to apply automatically; without it the ↓1 shows up as an unticked dialog switch.)

**Rules added:** 9 rules on 3 pack items. `scripts/check-rules.mjs`: 1881 rules on 1172 items, 0 errors, 0 warnings.
ESLint (`--ext .js,.mjs`) is clean on the five slice folders and the new test file. Jest passes on the five slice
folders plus `module/rules/conv7-slA7.test.js`, `conv6-slA6.test.js` and `conv5-slA5.test.js` (8 suites, 144 tests).

## Converted

- **Power Flux (Across the Stars, pr1)** - `packs/atsitems/_source/Power_Flux_zhfG2gH4IgIjMAzT.json`. One Trigger,
  `event: sceneStart`, `scope: crew` (it fires for each crew member of the Zord holding it), `when: ["holder:type:zord",
  "holder:onCanvas", "self:data:system.powers.personal.max>0", "self:data:system.powers.personal.value<$system.powers.personal.max"]`:
  a chat line "{name} regains N Personal Power" and `updateActor {add: {system.powers.personal.value: "min(6, max -
  value)"}}` read off `@recipient` - the old `powerFluxGains` (`max > 0`, `min(6, max - value)`, nothing when the gain is
  0) on the GM's new scene, only for a Zord with a token in the viewed scene (`getActiveTokens` = `onCanvas`). Removed
  from `pr1/ats.mjs`: `powerFluxGains`, its `registerSceneAdvanced` block, the now-unused `registerSceneAdvanced` /
  `crewOf` imports and its header note; `PR1.powerFlux` from `pr1/common.mjs`; the slice test.
- **Additional Pair of Limbs (Decepticon Directive, zord1)** - `packs/dditems/_source/Additional_Pair_of_Limbs_pedTP4vV1qwoBJvn.json`
  (its +10 Ground was converted in slA6). Added:
  - a RollModifier ↓1, `when: ["self:transformed", "rule:data:flags.essence20.zord1LimbsMode=multi", "attack",
    "attack:unarmed", "roll:targets>=2"]` - the old `bodiesRollSources` (Alt Mode, Multiple Targets picked, an
    unarmed attack, two or more user targets);
  - a Use "Stand up from Prone", `cost: {action: free}`, `when: ["not:self:transformed", "self:status:prone"]` (a static
    `when` hides the Use otherwise - the old row that only appeared in Bot Mode while Prone), `removeCondition prone`;
  - two Uses "Alt Mode: +10 feet Movement" / "Alt Mode: Multiple (2) Targets on unarmed attacks", each `updateItem` of
    the same `flags.essence20.zord1LimbsMode` (`move` / `multi`), so existing picks keep working, at no action cost.
    With several Uses the item's Use button asks which - the same two or three rows the old picker showed.
  A free action can't be paid from inside a `choose` option, hence separate Uses rather than one `choose` with an
  option `when`. Removed from `zord1/bodies.mjs`: `bodiesRollSources` and its registration, `runLimbs` and its
  `registerUse`, `BODY.limbs`, the `registerRollSources` / `dd` / `isUnarmed` imports; the slice registration test
  now asserts `zord1Limbs` is gone.
- **Instructor (Beneath the Helmet, pr2)** - `packs/bthitems/_source/Instructor_zitiiHIQ4miPU5pa.json`. Four rules:
  - an `added` Trigger: `pick {key: skill, from: skill, essence: smarts, specializedOnly: true, ifUnset: true, legacy:
    "flags.essence20.pr2Instructor.skill"}` - the old drop-time picker (Smarts Skills the holder has a Specialization in,
    else every Smarts Skill), and existing copies keep their Skill through the GM's linking pass;
  - a RollModifier "Instructor" ↑1, `when: ["skill:{choice.skill}"]`, `stack: "pr2Instructor"` (once, however many
    copies teach it);
  - a `team`-scoped RollModifier `immune: ["untrainedSnag"]`, `when: ["skill:{choice.skill}",
    "self:marked:instructor-{choice.skill}"]` - every other Player Character marked as taught that Skill skips its
    untrained Snag (read by `ruleNoUntrainedSnag`);
  - a Use "Teach a teammate (Instructor)": the same Skill pick (`ifUnset`, so it only asks when the drop-time pick was
    skipped), `pick {key: student, from: team, notSelf: true}`, then five `mark` steps to `team+others` filtered by
    `target:picked:student` and `rule:data:flags.essence20.rules.choices.skill=<skill>` (one per Smarts Skill: mark keys
    aren't filled from picks, and the key must carry the Skill so a student of a Science teacher isn't lifted on another
    teacher's Technology), and a chat line. Students accumulate: each teach marks one more.
  Removed from `pr2/team.mjs`: `instructorOf`, `instructorSources` and its registration, `smartsSkills`,
  `chooseInstructorSkill`, the `pr2Instructor` Use, the Instructor branch of `onTeamItemCreated`, the `registerRollSources` /
  `registerUse` imports. **Kept as a legacy reader:** `pr2NoUntrainedSnag` + `INSTRUCTOR_FLAG` - students taught before
  the rules version sit in the old flag's `students` list, which no pick or mark can carry over, so they keep their lift
  through it (and `helpers/roll-dialog.mjs` still imports it). The slice test now covers only that reader.

New tests: `module/rules/conv7-slA7.test.js` (13 tests, each item loaded from its pack source; the Power Flux one
repeats the old `[6, 2]` case).

## Behaviour differences worth a decision

1. **Additional Pair of Limbs' ↓1 needs the outside edit** (below): `roll:targets` is only known to hit / afterRoll
   Triggers today, not to roll modifiers. Until the edit lands the ↓1 is an unticked switch in the Roll Options Dialog
   (offered only when the mode is Multiple Targets and the attack is unarmed) instead of an automatic source.
2. **Additional Pair of Limbs, the picker:** the Use button's own "which Use" dialog instead of the old prompt (same
   rows); the mode Uses post a rules chat card. An attack whose `parentId` points at a deleted weapon no longer counts as
   unarmed (as with Primal Rage in slA6).
3. **Power Flux:** the chat is a rules card per crew member without the Zord's name; crew entries with no
   `vehicleRole` count as passengers (the old `crewOf` skipped them); an actor listed on two Zords' crews is reached
   by the first one only (`crewedBy`); two Power Flux copies on one Zord top up twice (each up to 6, never past the
   maximum) where the old check gave one top-up.
4. **Instructor:** the student picker also offers teammates already taught (re-teaching is harmless); two Instructor
   copies with different Skills give ↑1 on both Skills (the old code took the first copy's); an NPC holding it teaches
   no one (the `team` scope only reaches from a Player Character); choosing the Skill on gain posts a "Picked" chat
   line; a copy whose old pick hasn't been moved by the GM's linking pass yet marks no student until it has (the pass
   runs on the GM's load).

### slA6's recorded differences, looked at again

- #1 / #2 (`team` reach): `team` is on `rules/index.mjs`'s `LINKED` list now, so Primal Rage's and Bend Physics' team
  copies reach teammates; #2 (two Bend Physics holders, +4) still depends on the optional `links.mjs` edit in slA6.
- #3 S.W.A.T. (canvas-only watch Triggers), #4 Morphin Navigator (`to: party`), #5 Primal Rage, #6 Movement at
  `afterDerived`, #7 Carapaced's pick - nothing in round 7 changes them (`to: partyActor` is the Party document, not its
  members).

## Still partial (13)

| Item | What stays code, and why |
|---|---|
| Mercurial Nature | Unlimited Mass Shift reads `ZORD2.mercurialNature` inside the daily Mass Shift pool (code state). |
| Ranger Operator [Form] | Form lifecycle (un-equip by class, restore on de-Morph). |
| Beast Morpher [Form] | Every row sits in the Form Use (an extension Use hides a rule Use). |
| Ninja Storm Wind Ranger [Form] | Form Use rows, Duplication after `ruleDerived`, an incoming DialogSwitch. |
| Time Force [Form] | Form lifecycle; its rows are Form Use rows. |
| Supersonic [Form] | Hit-time damage-type changes and the Form lifecycle (`@count.items` exists now). |
| Megafauna | Smarts/Social after Terrorzord's code; `holder:` context in SkillSubstitution; flag set by hooks. |
| Hybridization | Daily Mass Shift pool scaling with level, size class as text, patched core checks. |
| Lightspeed Boost | The picker (an object pick; HAZMAT's two distinct types) and the in-flight / submerged Evasion (token elevation). |
| Advanced Dino Gem Integration | Primordial Power's post-hit +2 note; Genetic Resonance (`zord-summon` timing). |
| Shinobi of the 63rd Hexagram | The Defense picks live only as Active-Effect enabled states on existing copies. |
| S.W.A.T. Upgrade | Incapacitation Ammo: the alternate-fire switch as a hit-card rider option. |
| Bend Physics | The Movement doubling: no stage sits where pr2's hook does (see Unique Weapon (Two-Handed Melee)). |

## Still skipped (73), and what each still needs

**zord1 / zord2 (44)**
- Lightspeed Response, Turbo - the Form lifecycle (Morph-time choice, un-equip / restore).
- Solar Power - a hit-time damage-type override and a per-hit rider option.
- Dino Thunder - per-copy timed powers with canvas point picks.
- Emotional Range - a ChoiceSet that grows with a Role Points value, read by `emotional-mastery.mjs`.
- Emotional Strength - the active Emotional Mastery options are code state (no `check:`), the once-per-scene flag is shared with `emotional-mastery.mjs`, a Group Test result event is missing.
- Rex Feature, Additional Zord - an owned-Zord `pickGrant` recipient (`pickGrant replace` now exists); Additional Zord also a pre-update veto.
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
- Power Matrix - a reserve scaling with copies, drawn by the driver, refilled on the pilot's rest.
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
- Time Displaced (Use half) - a step rolling a chosen die one size up to a blind card with the anomaly band (`button whisper: owners` hides a card, not a roll's result).
- Warhead Magazines - three picks per copy excluding taken types, a select switch with an action cost, a rider option.
- Be an Example - `skill:` against `system.originSkillsIncrease` (a data path, not a pick) or `appliesWhen` filled at bank time.
- Destiny (Hang-Up) - a GM-side card button (Reaction `who` has no GM), a GM Story Point resource, a Fumble conversion.
- Nemesis (the reroll) - a whole-formula reroll that leaves the choice to the player, on cards without target rows.
- Stand Behind Me! - blocking the roll before it is made and per-enemy turn-start tests.
- Tactical Size Shift - text size DerivedStat and an actor Skill-die step with undo.
- Warzord (rest) - Titanic after Tactical Size Shift, a Megaform-combines event.

**pr2 / pr3 (17)**
- Aim Apparatus - the picker exists now (`pick from: team`, the holder included); still a cross-actor Skill-shift step (one rank up, never past d12, on the picked actor's source data) and a `removed` event to step it back down.
- Dino Drive Mode - the reduction applies to any Energy hit, an Active Effect on a chosen movement type, a Zord-within-30-ft-holding-X tag (`combat:ally:` has no range).
- Aura of Decay - a before-roll event (charged before the dialog, even if cancelled).
- Flames of Hate - an "ignore armor" Defense mode after best / halve.
- Incineration Blast - a "token moved on its own turn" event (`actionUsed:move` counts Move actions, not token moves).
- Megaform Expeditor - the join time is rolled inside `combiner-timer.mjs` (no rule hook).
- Ninja Power - its Use shares the button with the code-side Power-upkeep state.
- Peerless Pilot (PR) - a rule hook in the emergency disembark.
- Power Heal - a step running `powerCost`, a pick over a creature's current negative Conditions.
- Unique Weapon (Small Melee) - a rule hook in `zord-summon.mjs`.
- Unique Weapon (Two-Handed Melee) - the -10 ft sits in pr3's derived hook, between Bend Physics' x2 (pr2) and the rules' DerivedStats; neither stage matches: `afterGravity` gives 2(x - 10) with Bend Physics (old 2x - 10), `afterDerived` gives 2x - 10 with Ninja Storm Wind Ranger's Ground x2 DerivedStat (old 2(x - 10)) and lowers Cloud Hatchet's 30 ft Aerial floor to 20.
- Elemental Fury - the attack's damage / range / classification come from the strongest ranged attack, and it is deleted once rolled.
- Power Construct - `takesDamage` doesn't know melee / the targeted Defense; the alternate rider option.
- Restraining Gear - an opposed-roll step, Power paid by the pilot, Megaform participants.
- Zord Mount - a pick over every Zord in the world (`pick from: team` is Player Characters only); a once-per-turn first-melee note on hit or miss.
- Emissary's Gift - a pack filter on `pickPerk` (`pickGrant from.fields` doesn't reach `pickPerk`).
- Protector of Safehaven - `until: mission` for choices, a temp-resource step.

## Edits outside my files

1. **Needed for Additional Pair of Limbs' ↓1 to apply automatically** (difference #1): `module/rules/adapter.mjs`, in
   `rollRules` (line 82, the first of two identical lines - the second, in `ruleCover`, stays), give roll modifiers the
   number of user targets the old code read (`game.user.targets.size`) when the caller didn't pass one. Replace
   ```js
   export function rollRules(actor, target, roll, types = ['RollModifier']) {
     const out = [];
     const facts = { ...roll, ...rollFacts(roll.item, roll) };
   ```
   with
   ```js
   export function rollRules(actor, target, roll, types = ['RollModifier']) {
     const out = [];
     // roll:targets - the user's targets for this roll, unless the caller says (hit / afterRoll pass their own).
     const facts = { targetCount: globalThis.game?.user?.targets?.size, ...roll, ...rollFacts(roll.item, roll) };
   ```
   (With no `game`, `targetCount` stays undefined and `roll:targets` answers "unknown", as now.)
2. Optional comment tidy: `module/helpers/roll-dialog.mjs` line 104
   `// Instructor's taught Skill - helpers/extensions/pr2/team.mjs.` could become
   `// Instructor students taught before the rules version - helpers/extensions/pr2/team.mjs (new ones are item rules).`
3. Carried from slA6, still optional: the `links.mjs` `team` + `stacks: false` edit (Bend Physics with two holders) and the
   `roll-dialog.mjs` line 99 Shinobi comment.

## Unused strings

`E20.Pr1PowerFluxLine`, `E20.Pr2Instructor`, `E20.Pr2InstructorPickSkill`, `E20.Pr2InstructorPickStudent`,
`E20.Pr2InstructorTaught`, `E20.Zord1LimbsPrompt`, `E20.Zord1LimbsMove`, `E20.Zord1LimbsMulti`, `E20.Zord1LimbsStand`,
`E20.Zord1LimbsStood`, `E20.Zord1LimbsSet`.

## Files touched

- `module/helpers/extensions/pr1/ats.mjs`, `pr1/common.mjs`, `pr1/pr1.test.js`
- `module/helpers/extensions/pr2/team.mjs`, `pr2/pr2.test.js`
- `module/helpers/extensions/zord1/bodies.mjs`, `zord1/zord1.test.js`
- `packs/atsitems/_source/Power_Flux_zhfG2gH4IgIjMAzT.json`, `packs/dditems/_source/Additional_Pair_of_Limbs_pedTP4vV1qwoBJvn.json`,
  `packs/bthitems/_source/Instructor_zitiiHIQ4miPU5pa.json` (all CRLF, kept)
- `module/rules/conv7-slA7.test.js` (new, CRLF), `docs/rules-batches/slA7.md` (this file)

**Rule count added: 9** (Power Flux 1, Additional Pair of Limbs 4, Instructor 4).

## Engine pieces the remaining skips need (most useful first)

1. **Megaform roster reading** (a `megaform:` tag family / scope: "the Megaform this Zord is part of", "a participant
   holding X", per-participant rows) - Multi-Megaform, Signature Finishing Move x2, Power Master, Target Master,
   Accurate Combiner, Assault Weapon, Mesh Zord, Warzord (rest), Restraining Gear (Megaform half), Mobile Headquarters
   (Megaform half). **Large design.** The TF Combiner merge / break-apart items (Gestalt / Matched Combiner, Universal
   Component, Efficient Combination, Invigorating Connection, Macro-Magnetic Linkage, Safe Release, Core Body, Titan
   Hardpoint, Enhanced Attack, Universal Receptors) and Enhanced Melee / Ranged Attack (generated items) are
   **effectively permanent code** - a whole subsystem.
2. **Form lifecycle** (the `morph` / `unmorph` events exist; still missing: steps that un-equip by class and restore
   on de-Morph, and a Form Use that a rule Use can replace) - Lightspeed Response, Turbo, Ranger Operator, Time Force,
   Beast Morpher, Ninja Storm Wind Ranger, Supersonic. **Large design.**
3. **Owned-Zord / crew recipients and a pilot-paid cost** (`to: ownZord`, `to: crew`, a cost paid by the driver) - Rex
   Feature, Zord Feature (slot), Additional Zord, Terrorzord Nature, Overdrive, Power Matrix, Restraining Gear (payer),
   Phantom Focus. **Medium.**
4. **Movement rules at a hand-written hook's place** - a stage per remaining hand-written Movement hook (or moving those
   hooks onto explicit stages) - Bend Physics (doubling), Unique Weapon (Two-Handed Melee). **Medium.**
5. **Size class as data** (a Size step / DerivedStat on the size ladder with min / max, and an equip veto) - Enlarged,
   Shrunk, Tactical Size Shift, Warzord (size), Warrior Mode (size), Mesh Zord (size), Revolutionary Shape-Shifting,
   Hybridization (Change Size). **Medium.**
6. **Hit-time damage-type override + rider options from rules** (an "Apply as X" option on the hit card) - Solar
   Power, Warhead Magazines, S.W.A.T. Incapacitation Ammo, Power Construct (alternate), Supersonic. **Medium.**
7. **A cross-actor Skill-shift step + a `removed` Trigger event** (step a Skill's die on the recipient's source data, undo
   when the item goes) - Aim Apparatus, Tactical Size Shift (Skill half). **Small-medium.**
8. **`roll:targets` for roll modifiers** - the adapter edit above (Additional Pair of Limbs' ↓1). **Small** (one line).
9. **More Trigger events:** before-roll (Aura of Decay), token moved on its own turn (Incineration Blast), Group Test
   result (Emotional Strength), Megaform combines (Warzord). **Small each.**
10. **A "choose" reroll** (the player keeps either result, any card) - Nemesis. **Small.**
11. **GM-side Reaction** (`who: gm`) + a GM Story Point resource + a "make it a Fumble" card step - Destiny. **Small.**
12. **Bonus-die bank** (a banked die added to the next matching roll) - Prospector Toolkit. **Small.**
13. **Armor-shred CriticalOption** (lower the target's armor share for the scene, stacking) - Anti-Armor.
    **Small-medium.**
14. **`pick from: actors` with a type filter** (every Zord in the world) - Zord Mount (pick half). **Small.**
15. Rule hooks in specific helpers: `combiner-timer.mjs` (Megaform Expeditor), `zord-summon.mjs` (Unique Weapon (Small
    Melee), Genetic Resonance), emergency disembark (Peerless Pilot), `emotional-mastery.mjs` (Emotional Range).
    **Small each.**
16. **Effectively permanent code:** Spectrum Shifted (Role-change handling), Stand Behind Me! (blocking a roll before
    it is made, per-enemy turn-start tests), Defender Torozord (creates a Megaform actor), Zord Ultra Mode (switching
    other items' Active Effects), Dozer Blade (Region clearing), Time Displaced (blind anomaly roll), Power Heal
    (`powerCost` + Condition picker), Shinobi's Defense picks (Active-Effect states on existing copies), Mobile
    Headquarters (derived Initiative Edge + scene-wide aura), Dino Thunder, Zord Mount (once-per-turn melee note),
    Emissary's Gift, Protector of Safehaven, Megafauna, Mercurial Nature / Hybridization (the Mass Shift pool), Ninja
    Power (Power upkeep), Be an Example, Adaptable Future Tech / Versatile Combiner (combine eligibility), Gestalt
    Hunter, Lightspeed Boost's picker (HAZMAT's two distinct types) and elevation Evasion, Instructor's legacy-student
    reader (until old worlds re-teach).
