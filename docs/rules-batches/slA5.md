# Batch slA5: fifth pass over the `zord1`, `zord2`, `pr1`, `pr2`, `pr3` slices

**Scope:** every item `docs/rules-batches/slA4.md` left skipped (86) or partial (13), and the three it re-checked as
converted earlier, re-checked against the guide's round-5 section ("Engine features added 2026-10-05 (round 5, after
the local round-4 conversions)": `target:ally|enemy`, `var:` tags, `vehicle:data|name~`, `terrain:set`,
`environment:outside`, the position `check:`s, `@host`, `{var}` / `{choice}` / `{@formula}` in text, unstarted-combat
`endOfNextTurn`, `to: party|team`, `updateActor`, `require` + `beforeCost`, `setTargets`, `writeInitiative`, `table`,
wielded item selector + roll skill, `overMax`, `bonusAttack` optional, bank `replace`, pick `filter` / `auto`, button
vars, DerivedStat `{choice}` paths + booleans, `consumeMark`, Movement `afterGravity`, the `equipped` / `unequipped` /
`resourceSpent` / `essenceChanged` events, `plainFailure` / `anySucceeded`) and against the earlier sections again.
Edited in place (no branch, no commit).

| Verdict | zord1 + zord2 | pr1 | pr2 + pr3 | Total |
|---|---|---|---|---|
| Convert (was skip) | 0 | 1 | 4 | **5** |
| Partial now fully converted | 0 | 0 | 1 | **1** |
| Partial, more converted | 0 | 2 | 0 | **2** |
| Skip now partial | 1 | 0 | 0 | **1** |
| Still partial, nothing more converts | 10 | 0 | 0 | **10** |
| Still skip | 45 | 14 | 21 | **80** |
| Re-checked (skip + partial) | 56 | 17 | 26 | **99** |
| Converted earlier, re-checked, unchanged | 0 | 1 | 2 | **3** |

(The re-checked row is slA4's 99 - 86 skips and 13 partials. Converted: Survivor, Unique Weapon (Green Ranger),
Power Wing (rest), Dino Gem Integration, Energem Infusion. Fully converted: Unique Weapon (Ranged). More converted:
Lightspeed Boost, Advanced Dino Gem Integration. Skip to partial: Shinobi of the 63rd Hexagram. Earlier conversions:
Profiteer, Overload, Grid Relic Weapon.)

**Rules added:** 34 rules on 9 pack items. `scripts/check-rules.mjs`: 1807 rules on 1146 items, 0 errors on my items
(2 errors on `qgtgitems/Desperate_Parry_ljlMd2MmeF9LEBbz.json`, another agent's). ESLint is clean on the five slice
folders and the new test file; jest passes on the five slice folders plus `module/rules/conv5-slA5.test.js`,
`conv4-slA4.test.js` and `conv3-slA3.test.js` (8 suites, 140 tests).

## Converted

- **Survivor (PR CRB, pr3)** - `packs/prcrbitems/_source/Survivor_YmSnQxVytktWfZTZ.json`. A Trigger on
  `essenceChanged` with `when: ["var:essence=smarts", "self:data:system.essences.smarts.value<=0"]`: a `table` on
  `1d20` - 10-20 posts "Smarts stays at 1." and `updateActor` sets `system.essences.smarts.value` to 1; 1-9 posts
  "Smarts drops to 0.". Same as the old `updateActor` hook (the updating user's client, only when the update itself
  takes Smarts to 0 or below). Removed from `pr3/pr-crb.mjs`: `smartsDroppedToZero`, `survivorCheck`, the hook;
  `IDS.survivor` from `pr3/common.mjs`; its two slice tests.
- **Unique Weapon (Green Ranger) (PR CRB, pr3)** - `packs/prcrbitems/_source/Unique_Weapon_TG2rarEjGgDeOsc5.json`. A Use
  (`when: ["not:rule:data:flags.essence20.pr3Granted"]`) with one `choose`: Ranged / Small Melee / Versatile /
  Two-Handed Melee each `grant` that compendium weapon; Roll runs a `table` on `1d4` (1 Ranged ... 4 Two-Handed, the
  old `index = total - 1`). Then `updateItem` sets `flags.essence20.pr3Granted: true` on the Perk, only
  `when: ["rule:granted"]` (the old code set it only once the copy was made). The grant carries `grantedBy` the Perk,
  as `grantCopy` did. Old copies (flag = the weapon id) keep the button hidden. Removed: the `pr3UniqueWeapon` Use,
  `UNIQUE_WEAPONS`, `IDS.uniqueWeapon` / `uwRanged` / `uwVersatile`, the slice test of `UNIQUE_WEAPONS`.
- **Unique Weapon (Ranged) - store / draw (pr3)** - `packs/prcrbitems/_source/Unique_Weapon_Ranged__Pr3UniqWpnRanged.json`
  (its natural-1 Trigger was converted in slA3). Two Uses: "Store 1 Personal Power"
  (`when: ["not:rule:data:flags.essence20.pr3StoredPower>=3"]`, `cost: {resource: {path:
  "system.powers.personal.value"}, amount: 1}` - offered only when affordable, like the old `personalPower >= 1`;
  `updateItem` adds 1 to the same `flags.essence20.pr3StoredPower`) and "Draw 1 Personal Power"
  (`when: [".. pr3StoredPower>0"]`; `updateItem` -1, `gainResource` 1 with `overMax: true` - the old draw ignored the
  maximum too). Each posts "Personal Power stored: {@item.flags.essence20.pr3StoredPower}". Removed: the
  `pr3UniqueStore` Use, `STORED_FLAG`, `storedPower`.
- **Power Wing (rest) (Across the Stars, pr1)** - `packs/atsitems/_source/Power_Wing_aCPFmjY80u9671Hl.json`. Two Triggers,
  `equipped` (`updateActor` adds 2 to `system.powers.personal.value`) and `unequipped` (adds -2, `min: 0`), both
  `when: ["item:own", "self:data:system.powers.personal"]` - `item:own` keeps them to Power Wing's own equip switch
  (the event also reaches the actor's other items' rules), the data tag is the old "no Personal Power, do nothing".
  Removed: the `updateItem` hook in `pr1/ats.mjs`, `PR1.powerWing`.
- **Dino Gem Integration and Energem Infusion (Beneath the Helmet, pr2)** -
  `packs/bthitems/_source/Dino_Gem_Integration_q9lciavy0Nfh0rR8.json`, `Energem_Infusion_ZLQCeC2gGWHnYEBQ.json`. An `added`
  Trigger each, `when: ["not:rule:data:flags.essence20.pr2GemBoost", "not:rule:data:flags.essence20.rules.choices.colour"]`
  (a copy set up the old way, or already picked, is never changed again - the old `!flag` guard):
  `pick {key: attack, from: ownedItem, itemType: weaponEffect, filter: [not melee, damage type in the Energy family],
  auto: true}` (a lone attack is taken without asking, as before), `pick {key: colour, from: list}` (the old
  `E20.Pr2GemColour.*` labels; Energem's list starts with "none"), then `updateItem` on `choice:attack` per colour
  (`when: ["var:picked=<colour>"]`): black Cold, blue +50 range / long range, green +1 damage, pink Electric, red Fire,
  yellow Sonic; Energem also +1 damage always. The attack gets `flags.essence20.pr2GemBoost.dinoGem` / `.energem`. Dino
  Gem's ↑1 is a RollModifier `when: ["attack", "item:data:flags.essence20.pr2GemBoost.dinoGem"]` (the old
  `dinoGemSources`). Removed from `pr2/zords.mjs`: `GEM_COLOURS`, `GEM_FLAG`, `gemUpdate`, `rangedEnergyAttacks`,
  `pickGemAttack`, `applyDinoGem`, `applyEnergem`, `dinoGemSources`, the `createItem` hook and its now-unused imports;
  `PR2.dinoGemIntegration` (Energem is still read by Amplified Dino Strength); the two slice tests.
- **Lightspeed Boost - more converted (pr1)** - `packs/atsitems/_source/Lightspeed_Boost_sap5gMPDrWvjLCCu.json`, reading
  the old pick object (`flags.essence20.pr1LightspeedBoost.option / how / types.0 / types.1`), all `self:type:zord`:
  Aeronautic Movement aerial `max 40`, Aquatic swim `max 40`, Medical `add 10` per Movement type `when` that type's
  total is above 0 (five rules) - all at stage `afterGravity`; HAZMAT as ten boolean DerivedStats
  (`system.resistances.<type>` / `system.immunities.<type>` = true for each of the five types, by `how`); Pyrotechnic
  `system.immunities.fire` = true and a Use "Extinguish a 20 x 20 ft area" (`cost: {action: standard}`, chat).
  Removed: `lightspeedDerived` and its `registerDerived` call; the `pr1-lightspeed-boost` Use now only `matches` an
  unpicked copy (the picker) - a picked Pyrotechnic copy gets the rule's Use. Slice test cut to the Evasion half, plus
  a check of the narrowed `matches`.
- **Advanced Dino Gem Integration - more converted (pr1)** - Enhanced Stealth's +10 ft: five Movement rules (`add 10`,
  stage `afterGravity`, `when` that type's total is above 0, the same `{any: [choices.gem=stealth, pr1DinoGem=stealth]}`
  the item's other rules use). Removed: `dinoDerived` and its `registerDerived` (plus the `registerDerived` import)
  from `pr1/misc.mjs`; its slice-test lines.
- **Shinobi of the 63rd Hexagram - Driving half (zord2, was skip)** -
  `packs/iafav2items/_source/Shinobi_of_the_63rd_Hexagram_JFfMXY6aMxhDbKa6.json`. A RollModifier
  `{immune: ["untrainedSnag"], when: ["skill:driving", "vehicle:driving", {any: ["vehicle:name~cycle", "vehicle:name~bike",
  "vehicle:name~chopper"]}]}` - the old `/(cycle|motorbike|bike|chopper)/i` (motorbike contains bike). Removed: the
  Shinobi branch, `MOTORCYCLE` and the `holds` import from `zord2/snag.mjs` (`zord2NoUntrainedSnag` keeps Steady Hands);
  the slice test now asserts the helper no longer answers for Shinobi.

New tests: `module/rules/conv5-slA5.test.js` (27 tests, each item loaded from its pack source).

## Behaviour differences worth a decision

1. **Dino Gem Integration / Energem Infusion, no energy attack:** the old picker fell back to EVERY ranged attack when
   the Zord had no ranged attack of an Energy type; the rule's pick offers only ranged Energy attacks (what the Feature
   says), so such a Zord gets "nothing to pick" and the Feature changes nothing. The pick lists attack names (the old
   one prefixed the weapon name); the flag on the attack is `true` instead of the colour (only its presence was ever
   read); the chat is the rules card (two "Picked" lines).
2. **Unique Weapon (Ranged), equipped only:** rules on a weapon work while it's equipped, so store / draw need the
   weapon equipped (the old button ignored equip state). With neither possible the button is hidden (the old one
   said so in a notification).
3. **Movement at `afterGravity` (Lightspeed Boost, Enhanced Stealth):** the +10 / 40 ft now land before every
   hand-written `registerDerived` hook instead of in pr1's. For a Zord that only differs under GI Joe's halve-Movement
   rider (`data21/weapons.mjs`, which runs before pr1): old `ceil(x/2) + 10`, now `ceil((x + 10)/2)`. Two Lightspeed
   copies, Aeronautic and Medical, on a Zord with no Aerial: old 50 when the Aeronautic copy came first, now 40.
4. **Survivor / Unique Weapon (Green Ranger) chat:** the d20 / d4 is a "rolled" line on the rules card instead of a
   dice-roll message; the choice dialog's buttons are plain names. Unique Weapon's flag is `true` instead of the weapon
   id (nothing reads it as an id).
5. **Shinobi:** the crewed vehicle is the first one the actor sits in (`vehicle:` tags) rather than the one they drive
   - different only for someone seated in two vehicles at once (as Phantom Ship / Take the Wheel already accept).
6. **Pyrotechnic:** fixed English chat text on the rules card.

## Re-checked, unchanged (converted in earlier rounds)

- **Overload** - its `until: endOfTurn` mark still carries no stamp in an unstarted combat (round 5 only fixed
  `endOfNextTurn` / `nextTurn`), so its `combat` tag stays.
- **Profiteer, Grid Relic Weapon** - nothing in round 5 changes their recorded differences.

## Still partial (13)

| Item | What stays code, and why |
|---|---|
| Mercurial Nature | Unlimited Mass Shift reads `ZORD2.mercurialNature` inside the daily Mass Shift pool (code state). |
| Ranger Operator [Form] | Form lifecycle (un-equip by class, restore on de-Morph). |
| Beast Morpher [Form] | Every row sits in the Form Use (an extension Use hides a rule Use). |
| Ninja Storm Wind Ranger [Form] | Form Use rows, Duplication after `ruleDerived`, an incoming DialogSwitch. |
| Time Force [Form] | Form lifecycle; its rows are Form Use rows. |
| Supersonic [Form] | `@count.items`, hit-time damage-type changes, Form lifecycle. |
| Megafauna | Smarts/Social after Terrorzord's code; `holder:` context in SkillSubstitution; flag set by hooks. |
| Hybridization | Daily Mass Shift pool scaling with level, size class as text, patched core checks. |
| Carapaced (Common) / (Large) | Its +20 Ground must land after zord1's Rotor Blades reads Ground; `afterGravity` is before every derived hook. |
| Lightspeed Boost | The picker (an object pick; HAZMAT's two distinct types) and the in-flight / submerged Evasion (token elevation). |
| Advanced Dino Gem Integration | Primordial Power's post-hit +2 note (a plain dealt DamageModifier can't see a switch key); Genetic Resonance (`zord-summon` timing). |
| Shinobi of the 63rd Hexagram | The Defense picks live only as Active-Effect enabled states on existing copies (no pick flag a `legacy` path could move). |

(Carapaced counts as two items.)

## Still skipped (80), and what each still needs

**zord1 / zord2 (45)**
- Lightspeed Response, Turbo - the Form lifecycle (Morph-time choice, un-equip / restore).
- Solar Power - a hit-time damage-type override and a per-hit rider option.
- Dino Thunder - per-copy timed powers with canvas point picks.
- Emotional Range - a ChoiceSet that grows with a Role Points value, read by `emotional-mastery.mjs`.
- Emotional Strength - the active Emotional Mastery options are code state (no `check:`), the once-per-scene flag is shared with `emotional-mastery.mjs`, Group Test and status-landing events are missing.
- Rex Feature, Additional Zord - an owned-Zord `pickGrant` recipient; Additional Zord also a pre-update veto.
- Terrorzord Nature - an owned-Zord link scope and a `spend` switch paid by the pilot.
- Anti-Armor - an armor-shred CriticalOption (capped at the target's armor share, scene-long); the trait write is permanent.
- Phantom Focus: Ship Integration - a timed driver-to-vehicle link `driven` rules can read.
- Multi-Megaform, Signature Finishing Move, Advanced Signature Finishing Move, Power Master, Target Master, Accurate Combiner, Assault Weapon - Megaform roster reading.
- Enlarged, Shrunk - a size-class (text) step / DerivedStat and an equip veto.
- Revolutionary Shape-Shifting - a text prompt, a size step and a scene state a switch can read.
- Additional Pair of Limbs - a Movement stage after the derived hooks, `roll:targets>=N`, a mode-picker row.
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

**pr1 (14)**
- Mobile Headquarters (rest) - derived Initiative Edge (not a switch-off-able source), a scene-wide actor-type aura, Megaform link.
- Overdrive - a crew member paying the cost, per-turn "options taken" memory, an energy-only post-hit note.
- Prospector Toolkit - a bonus-die bank (More Heads), returned when another roll comes first.
- Spectrum Shifted - what an old Role keeps on a Role change (role-handler hooks).
- Time Displaced (Use half) - a step rolling a chosen die one size up to a blind card with the anomaly band.
- Warhead Magazines - three picks per copy excluding taken types, a select switch with an action cost, a rider option.
- Be an Example - `skill:` against `system.originSkillsIncrease` (a data path, not a pick) or `appliesWhen` filled at bank time.
- Destiny (Hang-Up) - a GM-side card button (Reaction `who` has no GM), a GM Story Point resource, a Fumble conversion.
- Nemesis (the reroll) - a whole-formula reroll that leaves the choice to the player, on cards without target rows.
- Power Flux - a `crew` recipient, an "on the canvas" tag at scene start, a gain capped per recipient.
- S.W.A.T. Upgrade (rest) - Incapacitation Ammo: the alternate-fire switch as a rider option; Incarceration Protocols: "last hit by this actor" credit (only the Zord's LAST target counts; `defeatedEnemy` is the killing blow, marks would keep every hit target). Its count readout now exists (`{@mark.x}`).
- Stand Behind Me! - blocking the roll before it is made and per-enemy turn-start tests.
- Tactical Size Shift - text size DerivedStat and an actor Skill-die step with undo.
- Warzord (rest) - Titanic after Tactical Size Shift, a Megaform-combines event.

**pr2 / pr3 (21)**
- Bend Physics, Primal Rage - a `team` rule scope (every PC; `to: team` is only a step recipient). Bend Physics' doubling would also need a Movement stage after the derived hooks.
- Instructor - Smarts-Skill-filtered pick, a student list, an untrained-Snag lift on others.
- Aim Apparatus - a world-PC picker, a cross-actor Skill-shift step, a removed event.
- Dino Drive Mode - the reduction applies to any Energy hit, an Active Effect on a chosen movement type, a Zord-within-30-ft-holding-X tag.
- Aura of Decay - a before-roll event (charged before the dialog, even if cancelled).
- Flames of Hate - an "ignore armor" Defense mode after best / halve.
- Incineration Blast - a "moved on its own turn" event.
- Megaform Expeditor - the join time is rolled inside `combiner-timer.mjs` (no rule hook).
- Ninja Power - its Use shares the button with the code-side Power-upkeep state.
- Peerless Pilot (PR) - a rule hook in the emergency disembark.
- Power Heal - a step running `powerCost`, a pick over a creature's current negative Conditions.
- Unique Weapon (Small Melee) - a rule hook in `zord-summon.mjs`.
- Unique Weapon (Two-Handed Melee) - `afterGravity` would put its -10 ft before Bend Physics' team doubling (pr2's derived hook): old `2x - 10`, new `2(x - 10)`; needs a stage after the derived hooks.
- Elemental Fury - the attack's damage / range / classification come from the strongest ranged attack (`systemFormulas` can't take a max over items), and it is deleted once rolled.
- Power Construct - `takesDamage` doesn't know melee / the targeted Defense; the alternate rider option.
- Restraining Gear - an opposed-roll step, Power paid by the pilot, Megaform participants.
- Zord Mount - a pick over every Zord in the world; a once-per-turn first-melee note on hit or miss.
- Emissary's Gift - a pack filter on `pickPerk`.
- Morphin Navigator - `to: party` exists, but each member's 1d2 stops at THEIR own maximum (`updateActor` `max` is one fixed number and formulas can't read the recipient), only members with a Personal Power maximum count, and the old team is every Party roster the actor is on.
- Protector of Safehaven - `until: mission` for choices, a temp-resource step.

## Edits outside my files

None needed. Optional comment tidy: `module/mechanics/rolls/roll-dialog.mjs` line 99 reads
`// Shinobi of the 63rd Hexagram / Steady Hands - helpers/extensions/zord2/snag.mjs.` - could become
`// Steady Hands - helpers/extensions/zord2/snag.mjs (Shinobi's motorcycle Driving is its own item rule).`

## Unused strings

`E20.Pr3SurvivorSaved`, `E20.Pr3SurvivorFailed`, `E20.Pr3UniquePrompt`, `E20.Pr3UniqueRanged`, `E20.Pr3UniqueSmall`,
`E20.Pr3UniqueVersatile`, `E20.Pr3UniqueTwoHanded`, `E20.Pr3UniqueRoll`, `E20.Pr3UniqueStore`, `E20.Pr3UniqueDraw`,
`E20.Pr3UniqueStoreNothing`, `E20.Pr3UniqueStorePrompt`, `E20.Pr3UniqueStored`, `E20.Pr1PyrotechnicLine`,
`E20.Pr2GemNoAttack`, `E20.Pr2GemPickAttack`, `E20.Pr2GemPickColour`. (`E20.Pr2GemColour.*` is still used - by the two
gem items' pick lists. `E20.Pr3GrantedItem` is still used by Emissary's Gift.)

## Files touched

- `module/items/healing/power-heal-ninja-standard-issue.mjs`, `pr3/common.mjs`, `pr3/pr3.test.js`
- `module/items/zords/lightspeed-swat-features.mjs`, `pr1/misc.mjs`, `pr1/common.mjs`, `pr1/pr1.test.js`
- `module/helpers/extensions/pr2/zords.mjs`, `pr2/common.mjs`, `pr2/pr2.test.js`
- `module/helpers/extensions/zord2/snag.mjs`, `zord2/zord2.test.js`
- `packs/prcrbitems/_source/Survivor_YmSnQxVytktWfZTZ.json`, `Unique_Weapon_TG2rarEjGgDeOsc5.json`,
  `Unique_Weapon_Ranged__Pr3UniqWpnRanged.json`; `packs/atsitems/_source/Power_Wing_aCPFmjY80u9671Hl.json`,
  `Lightspeed_Boost_sap5gMPDrWvjLCCu.json`; `packs/bthitems/_source/Dino_Gem_Integration_q9lciavy0Nfh0rR8.json`,
  `Energem_Infusion_ZLQCeC2gGWHnYEBQ.json`, `Advanced_Dino_Gem_Integration_K4CUMFhAjXRFzGbA.json`;
  `packs/iafav2items/_source/Shinobi_of_the_63rd_Hexagram_JFfMXY6aMxhDbKa6.json` (all CRLF, kept)
- `module/rules/conv5-slA5.test.js` (new, CRLF), `docs/rules-batches/slA5.md` (this file)

**Rule count added: 34** (Survivor 1, Unique Weapon 1, Unique Weapon (Ranged) 2, Power Wing 2, Dino Gem Integration 2,
Energem Infusion 1, Lightspeed Boost 19, Advanced Dino Gem Integration 5, Shinobi 1).

## Engine pieces the remaining skips need (most useful first)

1. **Megaform roster reading** (a `megaform:` tag family / scope: "the Megaform this Zord is part of", "a participant
   holding X", per-participant rows) - Multi-Megaform, Signature Finishing Move x2, Power Master, Target Master,
   Accurate Combiner, Assault Weapon, Mesh Zord, Warzord (rest), Restraining Gear (Megaform half), Mobile
   Headquarters (Megaform half). **Large design.** The TF Combiner merge / break-apart items (Gestalt / Matched
   Combiner, Universal Component, Efficient Combination, Invigorating Connection, Macro-Magnetic Linkage, Safe Release,
   Core Body, Titan Hardpoint, Enhanced Attack, Universal Receptors) and Enhanced Melee / Ranged Attack (generated
   items) are **effectively permanent code** - a whole subsystem.
2. **Form lifecycle events** (a Trigger on Morph / de-Morph with steps that can un-equip by class and restore) - Lightspeed
   Response, Turbo, Ranger Operator, Time Force, Beast Morpher, Ninja Storm Wind Ranger, Supersonic. **Large design**;
   the Form Use precedence ("an extension Use hides a rule Use") goes with it.
3. **Owned-Zord / crew recipients** (`to: ownZord`, `to: crew`, a pilot-paid cost) - Rex Feature, Zord Feature (slot),
   Additional Zord, Terrorzord Nature, Power Flux, Overdrive, Power Matrix, Restraining Gear (payer), Phantom Focus.
   **Medium.**
4. **A `team` rule scope** (every PC, like `to: team` but for RollModifier / Defense / Movement / DerivedStat) - Bend
   Physics, Primal Rage, Instructor (others' Snag lift). **Small-medium.**
5. **A Movement stage after the hand-written derived hooks** (`afterDerived`, run at the end of `runDerived`) - Unique
   Weapon (Two-Handed Melee), Carapaced x2, Bend Physics (with 4), Additional Pair of Limbs. **Small.**
6. **Size class as data** (a Size step / DerivedStat on the size ladder with min / max, and an equip veto) - Enlarged,
   Shrunk, Tactical Size Shift, Warzord (size), Warrior Mode (size), Mesh Zord (size), Revolutionary Shape-Shifting,
   Hybridization (Change Size). **Medium.**
7. **Per-recipient formulas in `updateActor`** (an `@recipient.<path>` ref, or a `max` that is a formula read on each
   recipient) - Morphin Navigator, Power Flux (with 3). **Small.**
8. **Hit-time damage-type override + rider options from rules** (an "Apply as X" option on the hit card) - Solar Power,
   Warhead Magazines, S.W.A.T. Incapacitation Ammo, Power Construct (alternate), Supersonic. **Medium.**
9. **More Trigger events:** before-roll (Aura of Decay), token moved on own turn (Incineration Blast), status landing /
   Group Test result (Emotional Strength), Megaform combines (Warzord). **Small each.**
10. **"Last hit by" credit** (a mark that moves: `mark {exclusive: true}` clearing the same key the actor set on anyone
    else) - S.W.A.T. Incarceration Protocols (its count readout is now possible). **Small.**
11. **A "choose" reroll** (the player keeps either result, any card) - Nemesis. **Small.**
12. **GM-side Reaction** (`who: gm`) + a GM Story Point resource + a "make it a Fumble" card step - Destiny. **Small.**
13. **Bonus-die bank** (a banked die added to the next matching roll) - Prospector Toolkit. **Small.**
14. **Armor-shred CriticalOption** (lower the target's armor share for the scene, stacking) - Anti-Armor. **Small-medium.**
15. Rule hooks in specific helpers: `combiner-timer.mjs` (Megaform Expeditor), `zord-summon.mjs` (Unique Weapon (Small
    Melee), Genetic Resonance), emergency disembark (Peerless Pilot), `emotional-mastery.mjs` (Emotional Range).
    **Small each.**
16. **Effectively permanent code:** Spectrum Shifted (Role-change handling), Stand Behind Me! (blocking a roll before
    it is made, per-enemy turn-start tests), Defender Torozord (creates a Megaform actor), Zord Ultra Mode (switching
    other items' Active Effects), Dozer Blade (Region clearing), Time Displaced (blind anomaly roll), Power Heal
    (`powerCost` + Condition picker), Shinobi's Defense picks (Active-Effect states on existing copies), Mobile
    Headquarters (derived Initiative Edge + scene-wide aura), Dino Thunder, Zord Mount, Emissary's Gift, Protector of
    Safehaven, Megafauna, Mercurial Nature / Hybridization (the Mass Shift pool), Ninja Power (Power upkeep), Be an
    Example, Aim Apparatus, Adaptable Future Tech / Versatile Combiner (combine eligibility), Gestalt Hunter, Lightspeed
    Boost's picker (HAZMAT's two distinct types) and elevation Evasion.
