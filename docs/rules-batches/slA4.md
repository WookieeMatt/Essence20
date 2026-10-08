# Batch slA4: fourth pass over the `zord1`, `zord2`, `pr1`, `pr2`, `pr3` slices

**Scope:** every item `docs/rules-batches/slA3.md` left skipped or partial (89 skipped - 88 items, Lightspeed Boost being listed twice - and 13 partial: the 11 in its
"Still partial" table plus Unique Weapon (Ranged) and Advanced Dino Gem Integration), and the items slA3 converted,
re-checked against the guide's round-4 section ("Engine features added 2026-10-05 (round 4, after the local round-3
conversions)": wielding tags, `combat:exists`, `until: combat`, mark counters / `@mark`, `essenceDamage` /
`healEssence` / `extendCondition`, `rerollCard`, roll `snag` / `open`, grant `name` / `integrated` / `systemFormulas`,
step `filter`, outcome lists + `plainSuccess`, afterRoll `@var.total`, Toggle `legacy`, granted attachments carrying
`grantedBy`) and against the earlier sections again. Edited in place (no branch, no commit).

| Verdict | zord1 + zord2 | pr1 | pr2 + pr3 | Total |
|---|---|---|---|---|
| Convert (was skip) | 2 | 0 | 0 | **2** |
| Partial, more converted | 0 | 0 | 0 | **0** |
| Still partial, nothing more converts | 10 | 2 | 1 | **13** |
| Still skip | 46 | 15 | 25 | **86** |
| Re-checked (skip + partial) | 58 | 17 | 26 | **101** |
| Converted earlier, re-checked, unchanged | 0 | 1 | 2 | **3** |

(slA3's pr1 skip list names "Lightspeed Boost (rest)", the same item as its partial row; counted once here, as partial. The "converted earlier" row is Profiteer, Overload and Grid Relic Weapon; Unique Weapon (Ranged) and Advanced Dino Gem Integration are in the partial row.)

**Rules added:** 5 rules on 2 pack items. `scripts/check-rules.mjs`: 1649 rules on 1103 items, 0 errors, 0 warnings
(other agents' work is in that count). ESLint is clean on every file I touched; jest passes on the five slice folders
plus `module/rules/conv4-slA4.test.js` and `module/rules/conv3-slA3.test.js` (7 suites, 118 tests).

## Converted

- **Rotary Blade (weapon) and Rotary Blade (shield) (Technorganic Secrets, zord2)** -
  `packs/tsitems/_source/Rotary_Blade_9OuJzchTaiJEMcff.json` (weapon), `packs/tsitems/_source/Rotary_Blade_ixzkIrq0X9k57754.json`
  (shield). The round-4 Toggle `legacy` is what unblocks it: the mode can now live in the rules' own toggle without
  losing copies already switched the old way.
  - Weapon: Toggle "Cyber Shield Mode" `{key: shieldMode, legacy: "flags.essence20.zord2ShieldMode"}`, and a Use "Switch
    to Cyber Shield Mode" (`cost: {action: move}`, `when: ["not:self:toggle:shieldMode",
    "not:rule:data:flags.essence20.zord2ShieldMode"]`): `setToggle shieldMode true`; `grant` the shield (only
    `when: ["not:self:hasItem:<shield uuid>"]`, so an existing one is re-used); `updateItem` the shield
    (`item: "source:<shield uuid>"`) to `system.equipped: true, system.active: true`; a chat line.
  - Shield: three Uses, one picker when more than one is offered (the old `chooseButtons`):
    "Switch to Cyber Shield Mode" (Move, `when: ["not:rule:data:system.active"]`: the blade's toggle on, itself
    equipped + active); "Controlled descent" (Standard, `when: ["rule:data:system.active"]`, chat only);
    "Switch to Slasher Mode" (Move, same `when`: the blade's toggle AND old flag off, itself inactive, still equipped).
  - Same as the old `zord2-gear-modes` Rotary branches (`rotaryShield`, `rotaryToShield`, `rotaryToSlasher`,
    `useRotaryShield`): the action is paid first (a refused action changes nothing), the shield is granted once with
    `grantedBy` the blade (removing the blade takes it along), `./unusable.mjs` refuses the blade's attacks in shield
    mode (it already read `rules.toggles.shieldMode ?? zord2ShieldMode`), the shield's own activeEffect gives the
    +1 Toughness / Evasion while `system.active`.
  - Removed from `zord2/gear-modes.mjs`: the four Rotary functions, `SHIELD_MODE`, the Rotary sources in the Use's
    `matches`, its `canUse`, the two `run` branches, the `sourced` import; `ZORD2.rotaryBladeShield` /
    `ZORD2.rotaryBladeWeapon` from `zord2/common.mjs`. Header comments of `gear-modes.mjs` and `unusable.mjs`
    updated. There were no slice tests for the Rotary branches; the existing `zord2WeaponUnusable` flag test stays
    (the old flag is still read). New tests in `module/rules/conv4-slA4.test.js`.

## Behaviour differences worth a decision

1. **Rotary Blade, equipped only:** rules on equipment work only while it's equipped, so the blade's switch needs the
   blade equipped (the default) and the shield's buttons need the shield equipped (the switch equips it and Slasher
   Mode leaves it equipped). The old buttons ignored equip state. If someone unequips the shield by hand while in
   shield mode, re-equipping it brings its buttons back.
2. **Rotary Blade, UI:** the shield's one button with a two-way prompt is now the rules' Use picker with labelled
   choices (and a separately labelled "Switch to Cyber Shield Mode" while the shield is inactive). The declared
   Toggle also shows as an on/off switch on the blade's Rules tab (a free switch there, like every Toggle). Chat is
   the rules card (title + line, plus a "Granted" line the first time) in fixed English text.
3. **Rotary Blade, old copies:** a blade switched before this keeps reading as in shield mode (both `unusable.mjs` and
   the Use's `when` read the old flag) until the GM's linking pass moves it into the toggle; "Switch to Slasher Mode"
   clears both.

## Re-checked, unchanged (converted in earlier rounds)

- **Overload** - its Use's `combat` tag needs a started combat (slA3 difference 3). `combat:exists` would match the old
  check, but the `until: endOfTurn` mark carries no stamp in an unstarted combat and would never end (the old turn
  stamp ended when the combat started), so the tag stays `combat`.
- **Profiteer, Grid Relic Weapon** (and the converted halves of Unique Weapon (Ranged) and Advanced Dino Gem Integration) - nothing
  in round 4 changes their recorded differences.

## Still partial (13), nothing more converts

| Item | What stays code, and why round 4 doesn't reach it |
|---|---|
| Mercurial Nature | Unlimited Mass Shift reads `ZORD2.mercurialNature` inside the daily Mass Shift pool (code state). |
| Ranger Operator [Form] | Form lifecycle (un-equip by class, restore on de-Morph); no step runs at Morph time. |
| Beast Morpher [Form] | Every row sits in the Form Use (an extension Use still hides a rule Use); Toggle legacy doesn't change that. |
| Ninja Storm Wind Ranger [Form] | Form Use rows, Duplication after `ruleDerived`, an incoming DialogSwitch. |
| Time Force [Form] | Form lifecycle; its rows are Form Use rows. |
| Supersonic [Form] | `@count.items`, hit-time damage-type changes, Form lifecycle. |
| Megafauna | Smarts/Social after Terrorzord's code; `holder:` context in SkillSubstitution; flag set by hooks. |
| Hybridization | Daily Mass Shift pool scaling with level, size class as text, patched core checks. |
| Carapaced (Common) / (Large) | A Movement stage after the hand-written derived hooks (Rotor Blades reads Ground in between); the shared Use is now Carapaced / Shinobi / Dozer only. |
| Lightspeed Boost | The old pick is an object `{option, how, types}`; HAZMAT needs two distinct types; Movement after gravity, elevation, boolean Resistances. |
| Advanced Dino Gem Integration | Enhanced Stealth's +10 ft after gravity; Primordial Power's post-hit +2 note (a plain dealt DamageModifier can't see a switch key); Genetic Resonance. |
| Unique Weapon (Ranged) | Store / draw: `updateItem` can keep the count in the old flag, but drawing above the Power maximum (old: allowed) can't be done (`gainResource` stops at max) and the chat can't show the stored count. |

## Still skipped (86), and what each still needs

**zord1 / zord2 (46)**
- Lightspeed Response, Turbo - the Form lifecycle (Morph-time choice, un-equip / restore).
- Solar Power - a hit-time damage-type override and a per-hit rider option.
- Dino Thunder - per-copy timed powers with canvas point picks.
- Emotional Range - a ChoiceSet that grows with a Role Points value, read by `emotional-mastery.mjs`.
- Emotional Strength - afterRoll `@var.total` and outcome lists now cover Surprise / Distress, but the active Emotional Mastery options are code state (no `check:`), the once-per-scene flag is shared with `emotional-mastery.mjs`, Group Test and status-landing events are missing.
- Rex Feature, Additional Zord - an owned-Zord `pickGrant` recipient; Additional Zord also a pre-update veto.
- Terrorzord Nature - an owned-Zord link scope and a `spend` switch paid by the pilot.
- Anti-Armor - an armor-shred CriticalOption; the trait write is permanent and auto-picks a lone weapon (`pick` always asks).
- Phantom Focus: Ship Integration - a timed driver-to-vehicle link `driven` rules can read.
- Multi-Megaform, Signature Finishing Move, Advanced Signature Finishing Move, Power Master, Target Master, Accurate Combiner, Assault Weapon - Megaform roster reading.
- Enlarged, Shrunk - a size-class (text) step / DerivedStat and an equip veto.
- Revolutionary Shape-Shifting - a text prompt, a size step and a scene state a switch can read.
- Additional Pair of Limbs - a late Movement stage, `roll:targets>=N`, a mode-picker row.
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
- Shinobi of the 63rd Hexagram - Active-Effect picks on existing copies, `vehicle:name~`.
- Dozer Blade (Alt Mode) - a Region-clearing step.

**pr1 (15)**
- Mobile Headquarters (rest) - derived Initiative Edge (not a switch-off-able source), a scene-wide actor-type aura, Megaform link.
- Overdrive - a crew member paying the cost, per-turn "options taken" memory, an energy-only post-hit note.
- Prospector Toolkit - a bonus-die bank (More Heads), returned when another roll comes first.
- Spectrum Shifted - what an old Role keeps on a Role change (role-handler hooks).
- Time Displaced (Use half) - a step rolling a chosen die one size up to a blind card with the anomaly band.
- Warhead Magazines - three picks per copy excluding taken types, a select switch with an action cost, a rider option.
- Be an Example - `skill:data:<path>` (the rolled Skill equals `system.originSkillsIncrease`) or `appliesWhen` filled at bank time.
- Destiny (Hang-Up) - a GM-side card button (Reaction `who` has no GM), a GM Story Point resource, a Fumble conversion.
- Nemesis (the reroll) - `rerollCard` exists, but it rerolls the d20 and applies the result to the card; the old button rerolls the whole formula and leaves the choice to the player, and works on cards without target rows.
- Power Flux - a `crew` recipient and an "on the canvas" tag at scene start.
- Power Wing (rest) - equip / unequip Trigger events.
- S.W.A.T. Upgrade (rest) - Incapacitation Ammo: the dialog's alternate-fire switch as a rider option; Incarceration Protocols: "last hit by this actor" credit (`defeatedEnemy` is the killing blow) and a count readout in chat (`@mark` isn't readable in chat text).
- Stand Behind Me! - blocking the roll before it is made and per-enemy turn-start tests.
- Tactical Size Shift - text size DerivedStat and an actor Skill-die step with undo.
- Warzord (rest) - Titanic after Tactical Size Shift, a Megaform-combines event.

**pr2 / pr3 (25)**
- Bend Physics, Primal Rage - a team scope (every PC); Bend Physics also a Movement stage after gravity.
- Instructor - Smarts-Skill-filtered pick, a student list, an untrained-Snag lift on others.
- Aim Apparatus - a world-PC picker, a cross-actor Skill-shift step, a removed event.
- Dino Gem Integration, Energem Infusion - `pick {from: ownedItem}` with item-tag filters and a lone-option auto-pick.
- Dino Drive Mode - the reduction applies to any Energy hit, an Active Effect on a chosen movement type, a Zord-within-30-ft-holding-X tag.
- Aura of Decay - a before-roll event (charged before the dialog, even if cancelled).
- Flames of Hate - an "ignore armor" Defense mode after best / halve.
- Incineration Blast - a "moved on its own turn" event.
- Megaform Expeditor - the join time is rolled inside `combiner-timer.mjs` (no rule hook).
- Ninja Power - its Use shares the button with the code-side Power-upkeep state.
- Peerless Pilot (PR) - a rule hook in the emergency disembark.
- Power Heal - a step running `powerCost`, a pick over a creature's current negative Conditions.
- Survivor - an Essence-changed event.
- Unique Weapon (Green Ranger) - dice don't branch: a random option on `choose` / `pick` (no tag reads `@var.rolled`).
- Unique Weapon (Small Melee) - a rule hook in `zord-summon.mjs`.
- Unique Weapon (Two-Handed Melee) - a Movement stage after `registerDerived` and gravity.
- Elemental Fury - the attack's damage / range / classification come from the strongest ranged attack (`systemFormulas` can't take a max over items), and it is deleted once rolled.
- Power Construct - `takesDamage` doesn't know melee / the targeted Defense; the alternate rider option.
- Restraining Gear - an opposed-roll step (roll `open` has no opposed DIF), Power paid by the pilot, Megaform participants.
- Zord Mount - a pick over every Zord in the world; a once-per-turn first-melee note on hit or miss.
- Emissary's Gift - a pack filter on `pickPerk`.
- Morphin Navigator - a Party-roster recipient (`allies:<ft>` is token range).
- Protector of Safehaven - `until: mission` for choices, a temp-resource step.

(Lightspeed Boost, in slA3's pr1 skip list as "(rest)", is counted once, under partial.)

## Edits outside my files

None.

## Unused strings

`E20.Zord2RotaryPrompt`, `E20.Zord2RotaryDescent`, `E20.Zord2RotaryToSlasher`, `E20.Zord2RotaryDescentDone`,
`E20.Zord2RotaryShield`, `E20.Zord2RotarySlasher`.

## Files touched

- `module/items/gear/dozer-blade-shinobi.mjs`, `zord2/common.mjs`, `zord2/unusable.mjs` (all LF, kept)
- `packs/tsitems/_source/Rotary_Blade_9OuJzchTaiJEMcff.json`, `packs/tsitems/_source/Rotary_Blade_ixzkIrq0X9k57754.json` (CRLF, kept)
- `module/rules/conv4-slA4.test.js` (new, CRLF), `docs/rules-batches/slA4.md` (this file)

**Rule count added: 5** (Rotary Blade weapon 2, shield 3).

## Engine pieces the remaining skips need (most useful first)

1. **Megaform roster reading** (a `megaform:` tag family / scope: "the Megaform this Zord is part of", "a participant
   holding X", per-participant rows) - Multi-Megaform, Signature Finishing Move x2, Power Master, Target Master,
   Accurate Combiner, Assault Weapon, Mesh Zord, Warzord (rest), Restraining Gear (Megaform half), Mobile
   Headquarters (Megaform half). **Large design.** The TF Combiner merge / break-apart items (Gestalt / Matched
   Combiner, Universal Component, Efficient Combination, Invigorating Connection, Macro-Magnetic Linkage, Safe Release,
   Core Body, Titan Hardpoint, Enhanced Attack, Universal Receptors) and Enhanced Melee / Ranged Attack (generated
   items) are **effectively permanent code** - a whole subsystem.
2. **Form lifecycle events** (a Trigger on Morph / de-Morph with steps that can un-equip by class and restore) - Lightspeed
   Response, Turbo, Ranger Operator, Time Force, Beast Morpher, Ninja Storm Wind Ranger, Supersonic (with item 6).
   **Large design**; the Form Use precedence ("an extension Use hides a rule Use") goes with it.
3. **Owned-Zord / crew recipients** (`to: ownZord`, `to: crew`, a pilot-paid cost) - Rex Feature, Zord Feature (slot),
   Additional Zord, Terrorzord Nature, Power Flux, Overdrive, Power Matrix, Restraining Gear (payer), Phantom Focus.
   **Medium.**
4. **Size class as data** (a Size step / DerivedStat on the size ladder with min / max, and an equip veto) - Enlarged,
   Shrunk, Tactical Size Shift, Warzord (size), Warrior Mode (size), Mesh Zord (size), Revolutionary Shape-Shifting,
   Hybridization (Change Size). **Medium.**
5. **Movement stage after gravity / after the hand-written derived hooks** - Bend Physics, Unique Weapon (Two-Handed
   Melee), Advanced Dino Gem (Enhanced Stealth), Lightspeed Boost, Carapaced, Additional Pair of Limbs. **Small.**
6. **Hit-time damage-type override + rider options from rules** (an "Apply as X" option on the hit card) - Solar Power,
   Warhead Magazines, S.W.A.T. Incapacitation Ammo, Power Construct (alternate), Supersonic. **Medium.**
7. **More Trigger events:** before-roll (Aura of Decay), Essence changed (Survivor), equip / unequip (Power Wing),
   token moved on own turn (Incineration Blast), status landing / Group Test result (Emotional Strength), Megaform
   combines (Warzord). **Small each.**
8. **Team / Party recipients and scope** (every PC, the Party roster) - Bend Physics, Primal Rage, Morphin Navigator,
   Instructor (others' Snag lift). **Small-medium.**
9. **A "choose" reroll** (the player keeps either result, any card) - Nemesis. **Small.**
10. **GM-side Reaction** (`who: gm`) + a GM Story Point resource + a "make it a Fumble" card step - Destiny. **Small.**
11. **Branch on a rolled number** (a tag reading `@var.rolled`, or random `choose`) - Unique Weapon (Green Ranger).
    **Small.**
12. **Bonus-die bank** (a banked die added to the next matching roll) - Prospector Toolkit. **Small.**
13. **`pick {from: ownedItem}` with item filters and auto-pick of a lone option** - Dino Gem Integration, Energem
    Infusion, Anti-Armor (with an armor-shred CriticalOption). **Small.**
14. **Chat text reading formulas** (`{@mark.x}`, `{@item.path}`) - S.W.A.T. Incarceration count, Unique Weapon (Ranged)
    store/draw readout (with an uncapped `gainResource` option). **Small.**
15. Rule hooks in specific helpers: `combiner-timer.mjs` (Megaform Expeditor), `zord-summon.mjs` (Unique Weapon (Small
    Melee), Genetic Resonance), emergency disembark (Peerless Pilot), `emotional-mastery.mjs` (Emotional Range).
    **Small each.**
16. **Effectively permanent code:** Spectrum Shifted (Role-change handling), Stand Behind Me! (blocking a roll before
    it is made, per-enemy turn-start tests), Defender Torozord (creates a Megaform actor), Zord Ultra Mode (switching
    other items' Active Effects), Dozer Blade (Region clearing), Time Displaced (blind anomaly roll), Power Heal
    (`powerCost` + Condition picker), Shinobi (Active-Effect picks), Mobile Headquarters (derived Initiative Edge +
    scene-wide aura), Dino Thunder, Zord Mount, Emissary's Gift, Protector of Safehaven, Megafauna, Mercurial Nature
    / Hybridization (the Mass Shift pool), Ninja Power (Power upkeep), Be an Example, Aim Apparatus, Adaptable Future
    Tech / Versatile Combiner (combine eligibility), Gestalt Hunter.
