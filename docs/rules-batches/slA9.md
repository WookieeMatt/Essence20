# Batch slA9: ninth pass over the `zord1`, `zord2`, `pr1`, `pr2`, `pr3` slices

**Scope:** every item `docs/rules-batches/slA8.md` left skipped (71) or partial (13), re-checked against the guide's
round-9 section ("Engine features added 2026-10-06 (round 9, after the local round-8 conversions)": `to: picked:<key>`,
`rollVsEach`, `disarm`, `takeItem`, `spendAction`, `pick from: targetItem`, pick skill `minShift` / `maxShift`,
`pickGrant record` + `item:pickedSource:`, tracked temporary Health, grant `appendTraits`, `ladderMax` / `ladderMin`,
`quiet`, `@sum.equippedTrait`, the `removed` / `droppedToZero` events, afterRoll `@var.skill`) and against the earlier
sections again; slA8's recorded behaviour differences looked at again. Edited in place (no branch, no commit).

| Verdict | zord1 + zord2 | pr1 | pr2 + pr3 | Total |
|---|---|---|---|---|
| Convert (was skip) | 0 | 0 | 2 | **2** |
| Partial now fully converted | 0 | 0 | 0 | **0** |
| Skip now partial | 0 | 0 | 0 | **0** |
| Still partial, nothing more converts | 9 | 3 | 1 | **13** |
| Still skip | 44 | 12 | 13 | **69** |
| Re-checked (skip + partial) | 53 | 15 | 15 | **84** |

(Converted: Aim Apparatus (pr2) and Protector of Safehaven (pr3).)

**Rules added:** 5 rules on 2 pack items. `scripts/check-rules.mjs`: 1950 rules on 1196 items, 0 errors, 0 warnings.
ESLint (`--ext .js,.mjs`) is clean on `pr2/`, `pr3/` and the new test file. Jest passes on the five slice folders plus
`module/rules/conv9-slA9.test.js` and `conv8-slA8.test.js` (7 suites, 107 tests).

## Converted

- **Aim Apparatus (PR CRB Grid Tech, pr2)** - `packs/prcrbitems/_source/Aim_Apparatus_8Kyl6XMzRCZGBzbW.json`. Two rules:
  - an `added` Trigger, `when: ["not:rule:data:flags.essence20.rules.choices.target",
    "not:rule:data:flags.essence20.pr2AimApparatusTarget"]` (the old "no flag yet" check - a copy that already carries a
    pick does nothing): `pick {key: target, from: team, legacy: "flags.essence20.pr2AimApparatusTarget"}` (every Player
    Character in the world, the holder too - the old self-or-teammate picker's list), then `updateActor {to:
    picked:target, ladder: {system.skills.targeting.shift: 1}, ladderMax: d12}` and the old chat line. The ladder with a
    d12 cap is the old `stepShift`: d12 stays d12, and a die already above d12 comes back to d12 (as the old clamp did).
    A cancelled pick changes nothing.
  - a `removed` Trigger: the same `updateActor` with `-1` - the old `deleteItem` hook stepping the picked actor's
    Targeting back down (never below d20; a die above d12 lands on d12, as before).
  Removed from `pr2/team.mjs`: the whole Aim Apparatus section (`AIM_FLAG`, `stepShift`, `stepTargeting`,
  `grantAimApparatus`, `onTeamItemCreated` / `onTeamItemDeleted` and their `createItem` / `deleteItem` hooks) and the
  now-unused `T`, `postLine`, `writeActor` imports (header comment updated); `PR2.aimApparatus` and the now-unused
  `prcrb` import from `pr2/common.mjs`; the `stepShift` slice test.
- **Protector of Safehaven (TtSG General Perk, pr3)** -
  `packs/ttsgitems/_source/Protector_of_Safehaven_YJRejmHoASYm67lQ.json`. Three rules:
  - a Use "Choose this story's gift", `limit: {per: mission, max: 1}` (the old `getUses(..., 'mission') < 1`; a
    cancelled choice or weapon pick doesn't spend it, as before), a `choose` of the five gifts: "A Limited weapon"
    (`pickGrant {from: {type: weapon, availabilities: [limited]}}` - the old `pickAndGrant`, granted by the Perk),
    "Edge on weapon upgrades" / "↑1 Social with residents" (`mark` on self `until: mission` - the old boon flag
    stamped with the mission epoch), "1 Temporary Health" (`heal {temporary: true, tracked: true}` - the old
    `grantTemp` call through the resource slice's ledger), "+11 Wealth Bonus" (announced only, as before). Each posts
    the old "welcomed in Safehaven" line.
  - a DialogSwitch "Safehaven: weapon upgrade attempt (Edge)", `edge`, `when: ["self:marked:pr3SafehavenUpgrade",
    "skill:technology"]` - the old toggle (Technology rolls, unticked) and `giveEdge`;
  - a DialogSwitch "Safehaven: with Safehaven residents (↑1)", `upshift: 1`, `when: ["self:marked:pr3SafehavenSocial",
    "essence:social"]` - the old toggle (Social-Essence rolls) and its `shiftUp + 1`.
  Removed from `pr3/ttsg.mjs`: the Protector of Safehaven section (`SAFEHAVEN_USES`, `SAFEHAVEN_BOON`,
  `SAFEHAVEN_CHOICES`, `safehavenBoon`, the `pr3Safehaven` Use), the dialog-toggle and apply-dialog blocks (Safehaven
  was their only user), and the now-unused `registerApplyDialog`, `registerDialogToggles`, `epochFor`, `giveEdge`
  imports; `IDS.safehaven` from `pr3/common.mjs`; the registration test now asserts `pr3Safehaven` is gone.

New tests: `module/rules/conv9-slA9.test.js` (11 tests, each item loaded from its pack source).

## Behaviour differences worth a decision

1. **Aim Apparatus** - the picker is the rules' `pick` (a select of names in world order; the old one put "Yourself"
   first); its list holds the holder only when the holder is a Player Character (the old one always offered
   "Yourself" - the Grid Tech is a PC's). A copy deleted before the GM's linking pass has moved its old flag into the
   rules choice gives nothing back (the pass runs on the GM's load, so only a copy deleted in that window). The
   added card also shows the rules' "picked" line.
2. **Protector of Safehaven** - on a live world, a gift already chosen this mission under the old code (its flag and
   scene-clock counter) isn't seen by the rules: the Use is offered once more this mission and an old upgrade / social
   boon's switch doesn't show until a gift is chosen again. Both last one mission at most. The temporary Health ledger
   entry names the Perk instead of the old `pr3Safehaven` source key.

### slA8's recorded differences, looked at again

- #1 Incineration Blast (the watch Trigger needs the attacker's token on the viewed canvas; runs on the mover's client)
  and #2 Zord Mount (the two-step picker, the content link) - nothing in round 9 changes them.
- slA7's #2 (Limbs' picker), #3 (Power Flux chat / crew reach), #4 (Instructor's legacy-student reader) - unchanged.

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

## Still skipped (69), and what each still needs

**zord1 / zord2 (44)**
- Lightspeed Response, Turbo - the Form lifecycle (Morph-time choice, un-equip / restore).
- Solar Power - a hit-time damage-type override and a per-hit rider option.
- Dino Thunder - per-copy timed powers with canvas point picks.
- Emotional Range - a ChoiceSet that grows with a Role Points value, read by `emotional-mastery.mjs`.
- Emotional Strength - the active Emotional Mastery options are code state (no `check:`), the once-per-scene flag is shared with `emotional-mastery.mjs`, a Group Test result event is missing.
- Rex Feature, Additional Zord - `to: picked:<key>` now reaches a picked actor, but the pick must be over the pilot's own Zords (`system.actors`, auto with one) - `pick from: actors` lists every Zord in the world - and the Zord Feature pickGrant must exclude what the picked Zord already holds (pickGrant tags are asked of the holder); Additional Zord also a pre-update summon veto.
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
- Zord Feature (slot) - the owned-Zord recipient and the Torozord Feature chooser (`ChoicesSelector`, bespoke UI).
- Zord Ultra Mode - turning other Features' Active Effects on / off, ending on Defeat (`droppedToZero` could end it, but the effect toggling stays code).
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
- Tactical Size Shift - `ladderMax` and `removed` now exist, but the Skill half sits inside the direction picker: the Skill list depends on the direction (Strength / Speed Skills), the direction is locked by the other copies' picks, it writes the Essence / Health / Movement Active Effect and the flag the size derived reads, and removal restores the recorded old die (not one step down). Splitting it would race two `createItem` dialogs. Needs size class as data plus a pick lock across copies.
- Warzord (rest) - Titanic after Tactical Size Shift, a Megaform-combines event.

**pr2 / pr3 (13)**
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
- Restraining Gear - an opposed-roll step (`rollVsEach` is against a Defense, not the target's own roll), Power paid by the pilot, Megaform participants.
- Emissary's Gift - a pack filter on `pickPerk` (`pickGrant from.fields` doesn't reach `pickPerk`).

## Edits outside my files

None needed. (Carried from slA6 / slA7, still optional: the `links.mjs` `team` + `stacks: false` edit for Bend Physics
with two holders; the `roll-dialog.mjs` comment tidies for Shinobi and Instructor.)

## Unused strings

`E20.Pr2AimApparatusGranted`, `E20.Pr3SafehavenPrompt`, `E20.Pr3Safehaven.weapon`, `E20.Pr3Safehaven.upgrade`,
`E20.Pr3Safehaven.health`, `E20.Pr3Safehaven.social`, `E20.Pr3Safehaven.wealth` (the whole `E20.Pr3Safehaven` object),
`E20.Pr3SafehavenChosen`, `E20.Pr3SafehavenUpgradeToggle`, `E20.Pr3SafehavenSocialToggle`.

## Files touched

- `module/items/social/instructor-legacy-students.mjs`, `pr2/common.mjs`, `pr2/pr2.test.js`
- `module/items/zords/elemental-fury.mjs`, `pr3/common.mjs`, `pr3/pr3.test.js`
- `packs/prcrbitems/_source/Aim_Apparatus_8Kyl6XMzRCZGBzbW.json`,
  `packs/ttsgitems/_source/Protector_of_Safehaven_YJRejmHoASYm67lQ.json` (both CRLF, kept)
- `module/rules/conv9-slA9.test.js` (new, CRLF), `docs/rules-batches/slA9.md` (this file)

**Rule count added: 5** (Aim Apparatus 2, Protector of Safehaven 3).

## Which remaining items are permanent code, which still need a piece

**Effectively permanent code** (bespoke UI, whole subsystems, or state that lives in code): the TF Combiner merge /
break-apart items (Gestalt / Matched Combiner, Universal Component, Efficient Combination, Invigorating Connection,
Macro-Magnetic Linkage, Safe Release, Core Body, Titan Hardpoint, Enhanced Attack, Universal Receptors), Enhanced Melee /
Ranged Attack (generated items), Spectrum Shifted, Stand Behind Me!, Defender Torozord, Zord Ultra Mode, Zord Feature
(slot) (the Torozord `ChoicesSelector`), Dozer Blade, Time Displaced, Power Heal, Shinobi's Defense picks, Mobile
Headquarters, Dino Thunder, Megafauna, Mercurial Nature / Hybridization (the Mass Shift pool), Ninja Power, Be an
Example, Adaptable Future Tech, Versatile Combiner, Gestalt Hunter, Elemental Fury, Lightspeed Boost's picker and
elevation Evasion, Instructor's legacy-student reader, Tactical Size Shift (its linked direction / Skill / size picker).

**Still need an engine piece** (named in the list below): the Form items, the Megaform-roster items, Rex Feature /
Additional Zord / Terrorzord Nature / Overdrive / Power Matrix / Phantom Focus (owned-Zord pick and pilot-paid cost),
the size-class items, the hit-time damage-type items, Aura of Decay, Emotional Strength, Warzord, Nemesis, Destiny,
Prospector Toolkit, Anti-Armor, Flames of Hate, Bend Physics / Unique Weapon (Two-Handed Melee), Restraining Gear, Dino
Drive Mode, and the helper-hook items.

## Engine pieces the remaining skips need (most useful first)

1. **Megaform roster reading** (a `megaform:` tag family / scope: "the Megaform this Zord is part of", "a participant
   holding X", per-participant rows) - Multi-Megaform, Signature Finishing Move x2, Power Master, Target Master,
   Accurate Combiner, Assault Weapon, Mesh Zord, Warzord (rest), Restraining Gear (Megaform half), Mobile Headquarters
   (Megaform half). **Large design.** The TF Combiner merge / break-apart items and Enhanced Melee / Ranged Attack stay
   **permanent code** whatever is built.
2. **Form lifecycle** (steps that un-equip by class and restore on de-Morph, and a Form Use a rule Use can replace) -
   Lightspeed Response, Turbo, Ranger Operator, Time Force, Beast Morpher, Ninja Storm Wind Ranger, Supersonic.
   **Large design.**
3. **Owned-Zord pick + pilot-paid cost** (`pick from: ownedZords` - the Zords in the actor's `system.actors`, `auto`
   with one - so `to: picked:<key>` reaches them; pickGrant `tags` asked of the recipient so "a Feature the Zord
   doesn't have" works; a `cost` / `spend` paid by the pilot or crew) - Rex Feature, Additional Zord (plus a summon
   veto), Terrorzord Nature, Overdrive, Power Matrix, Restraining Gear (payer), Phantom Focus. **Small** for the pick
   and recipient-side tags; **medium** for the pilot-paid cost.
4. **Movement rules at a hand-written hook's place** - Bend Physics (doubling), Unique Weapon (Two-Handed Melee).
   **Medium.**
5. **Size class as data** (a Size step / DerivedStat on the size ladder with min / max, an equip veto, and a pick lock
   shared across copies of one item) - Enlarged, Shrunk, Tactical Size Shift, Warzord (size), Warrior Mode (size), Mesh
   Zord (size), Revolutionary Shape-Shifting, Hybridization (Change Size). **Medium.**
6. **Hit-time damage-type override + rider options from rules** (an "Apply as X" option on the hit card) - Solar Power,
   Warhead Magazines, S.W.A.T. Incapacitation Ammo, Power Construct (alternate), Supersonic. **Medium.**
7. **More Trigger events:** before-roll (Aura of Decay), Group Test result (Emotional Strength), Megaform combines
   (Warzord). **Small each.**
8. **A "choose" reroll** (the player keeps either result, any card) - Nemesis. **Small.**
9. **GM-side Reaction** (`who: gm`) + a GM Story Point resource + a "make it a Fumble" card step - Destiny. **Small.**
10. **Bonus-die bank** - Prospector Toolkit. **Small.**
11. **Armor-shred CriticalOption** and an **"ignore armor" Defense mode** - Anti-Armor, Flames of Hate. **Small-medium.**
12. **An opposed-roll step** (the actor's Skill against the target's own Skill roll) - Restraining Gear (its other
    halves are #1 and #3). **Small.**
13. **A ranged `scene:token:` / `ally:within:` with item tags** (a Zord within 30 ft holding X) - Dino Drive Mode (one of
    its three gaps). **Small.**
14. Rule hooks in specific helpers: `combiner-timer.mjs` (Megaform Expeditor), `zord-summon.mjs` (Unique Weapon (Small
    Melee), Genetic Resonance), emergency disembark (Peerless Pilot), `emotional-mastery.mjs` (Emotional Range), and a
    `pickPerk` pack filter (Emissary's Gift). **Small each.**
15. **Effectively permanent code:** the items listed under "Which remaining items are permanent code" above.
