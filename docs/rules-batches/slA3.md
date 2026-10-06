# Batch slA3: third pass over the `zord1`, `zord2`, `pr1`, `pr2`, `pr3` slices

**Scope:** every item `docs/rules-batches/slA2.md` left skipped or partial (105 items: zord 58, pr1 19, pr2 + pr3 28),
re-checked against the guide's "Engine features added 2026-10-05 (after slice round 2)": the new durations
(`endOfNextTurn`, `turnOrScene`, `roundOrScene`, `rounds:N`, `untilOf`), watch Triggers, Reaction rules and their card
steps, button limits, dice in formulas / `@target` in step formulas / `{var.x}` in chat, `legacy` pick paths,
`rule:granted` / `item:granted`, and `createItem` children. Edited in place (no branch, no commit).

| Verdict | zord1 + zord2 | pr1 | pr2 + pr3 | Total |
|---|---|---|---|---|
| Convert (was skip) | 0 | 1 | 2 | **3** |
| Partial (was skip) | 0 | 0 | 1 | **1** |
| Partial, more converted | 0 | 1 | 0 | **1** |
| Still partial, nothing more converts | 10 | 1 | 0 | **11** |
| Still skip | 48 | 16 | 25 | **89** |
| Re-checked | 58 | 19 | 28 | **105** |

**Rules added:** 8 rules on 5 pack items (and 5 existing Advanced Dino Gem rules re-pointed). `scripts/check-rules.mjs`
now reports 1618 rules on 1092 items, 0 errors, 0 warnings (other agents' work is in that count too). ESLint is clean on
every file I touched; jest passes on the five slice folders plus `module/rules/conv3-slA3.test.js` (6 suites, 112 tests).

## Converted

- **Profiteer (Hang-Up, pr1)** - `packs/jttitems/_source/Profiteer_FDf9ZhuajJb3U5un.json`.
  - DialogSwitch "Questioned about your wealth or gear (Profiteer: ↓1 for a minute)": `downshift: 1`, `forget: true`,
    `when: ["essence:social", "not:self:marked:profiteer"]`, `steps: [{do: mark, to: self, key: profiteer, until: "rounds:10"}]`.
  - RollModifier "Profiteer": `downshift: 1`, `when: ["essence:social", "self:marked:profiteer"]`.
  - Same as the old toggle + `profiteerLive` / `profiteerSources`: offered (unticked) on Social tests while not live;
    ticked gives ↓1 on that roll and starts the minute; inside it every Social test takes ↓1 automatically and the
    switch is not offered. In combat it lasts 10 rounds, out of combat the rest of the scene; a combat ending ends it.
  - Removed from `pr1/jtt.mjs`: the Profiteer section, its roll-source and apply-dialog branches, `socialSkill`,
    the `getSceneEpoch` import; `PR1.profiteerHangUp` from `pr1/common.mjs`; the slice test "Profiteer lasts ten
    rounds of the scene" (re-asserted in the new test file).
- **Overload (TtSG Zord Feature, pr3)** - `packs/ttsgitems/_source/Overload_GNT0qv91JUTXfS0n.json`.
  - Use: `when: ["combat", "not:self:marked:overload"]`, `cost: {action: free}`,
    `steps: [{do: loseHealth, amount: "1d2"}, {do: mark, to: self, key: overload, until: endOfTurn}]`.
  - RollModifier "Overload": `edge: true`, `when: ["attack", "self:marked:overload"]`.
  - Same as the old Use + roll source: only in combat, once a turn, Free action paid first, 1d2 Health lost outright
    (no Defeat chain, never below 0), Edge on the Zord's attacks until the turn changes.
  - Removed from `pr3/ttsg.mjs`: the Overload section and the `registerRollSources` import; `IDS.overload` from
    `pr3/common.mjs`; `pr3Overload` from the slice registration test and the slice test "Overload gives Edge on
    attacks this turn" (re-asserted).
- **Grid Relic Weapon (White Ranger Perk, pr2)** - `packs/prcrbitems/_source/Grid_Relic_Weapon_82Ld65NsKwfMZaSC.json`.
  - Trigger `added`, `when: ["self:type:playerCharacter", "not:self:has:Grid Relic"]`: a `choose` (Might / Finesse),
    each option a `createItem` of the "Grid Relic" weapon (equipped, traits energy + powerWeapon, size medium,
    `flags.essence20.pr2GridRelic: true`) with one child, "Grid Relic Strike" (roleSkillDie, melee, 2 Element vs
    Toughness, `flags.essence20.pr2GridRelic: <style>`) - the old `relicData` exactly.
  - Removed: everything in `pr2/perks.mjs` (`relicData`, `grantGridRelic`, `onPerkCreated`, its `createItem` hook);
    the file is left as an empty module because `extensions/index.mjs` imports it (see "Edits outside my files").
    `PR2.gridRelicWeapon` removed from `pr2/common.mjs`; the slice test "Grid Relic weapon rolls the Role skill die"
    re-asserted in the new file.
- **Unique Weapon (Ranged), partial (pr3)** - `packs/prcrbitems/_source/Unique_Weapon_Ranged__Pr3UniqWpnRanged.json`.
  - Trigger `afterRoll`, `outcome: fumbled`, `when: ["item:own"]`: `spend` Personal Power
    `min(1d4, @actor.system.powers.personal.value)`, then chat "{name} loses {var.spent} Personal Power.".
  - Same as the old post-roll hook: a natural 1 on an attack with this weapon costs 1d4, never below 0.
  - Stays code: the store / draw Use (`pr3UniqueStore`). Drawing isn't capped at the maximum (`gainResource` is), and
    the stored count lives in an old flag with no migration path for numbers.
  - Removed from `pr3/pr-crb.mjs`: the Fumble post-roll hook and the `registerPostRoll` / `postLine` imports; the
    slice test "Ranged fumbles cost 1d4 Personal Power" (re-asserted).
- **Advanced Dino Gem Integration, more converted (pr1)** -
  `packs/bthitems/_source/Advanced_Dino_Gem_Integration_K4CUMFhAjXRFzGbA.json`.
  - The picker is rules now: a Use "Choose the Dino Gem power" (`when` both the new choice and the old flag are unset)
    and an `added` Trigger (`when: ["self:type:zord"]`), each a `pick {key: gem, from: list, ifUnset: true,
    legacy: "flags.essence20.pr1DinoGem"}` over the five options (labels are the existing `E20.Pr1Dino.*` keys).
  - The five existing rules now read `{"any": ["rule:data:flags.essence20.rules.choices.gem=<x>",
    "rule:data:flags.essence20.pr1DinoGem=<x>"]}`, and `pr1/misc.mjs#dinoOf` reads `rules.choices.gem` first, then the
    old flag - so copies picked before this keep working before and after the GM's linking pass moves the flag.
  - Removed from `pr1/misc.mjs`: `pickDino`, the `pr1-advanced-dino-gem` Use, the `createItem` hook, `DINO_OPTIONS`,
    the `registerUse` / `isItem` imports. The slice registration test now expects that Use to be gone; the Dino Gem
    slice test gained a case for a pick stored the new way.
  - Stays code: Enhanced Stealth's +10 ft (after gravity), Primordial Power, Genetic Resonance (unchanged reasons).

## Behaviour differences worth a decision

1. **Profiteer, end of the minute (small):** the old minute ended as round start+10 began; `rounds:10` ends at the same
   point in the turn order 10 rounds on. The holder's own Social tests in round start+10 (normally on the turn the
   switch was ticked) are unaffected; only out-of-turn rolls before that point in round start+10 still take the ↓1.
   A scene change in the middle of a combat no longer ends it early (the combat does).
2. **Profiteer, which rolls are Social:** the old check was "rolled Essence is Social OR the Skill's usual Essence is
   Social"; the rule reads the settled rolled Essence only. Differs only when a Social Skill is rolled through another
   Essence. Also, as for every rule, a Hang-Up the Matured Perk lets you ignore is now inactive (the old code applied
   it anyway). A minute already running when this lands (old flag `pr1ProfiteerQuestioned`) is dropped.
3. **Overload in an unstarted combat:** the old Use only needed a combat to exist; the `combat` tag needs it started.
   Chat is the rules card (rolled dice + "lost N Health") instead of the old one-line text.
4. **Grid Relic Weapon:** the "already has one" guard is by name ("Grid Relic"), not by the old flag - differs only for
   a renamed copy. The attack is now also entered in the weapon's `system.items` (the sheet lists it under the weapon,
   as for a compendium weapon) and carries `grantedBy`. The prompt and item names are fixed English text (the old
   ones went through i18n; `lang/en.json` is the only language). Chat: "Granted" line instead of the old sentence.
5. **Unique Weapon (Ranged):** the rule needs the weapon to be equipped (rules on unequipped weapons are inactive);
   the old hook only checked the attack's weapon source. Chat: dice line + "loses N Personal Power".
6. **Advanced Dino Gem Integration:** the pick prompt is fixed English; chat is the rules "Picked" line. As usual, a
   world copy made before this change has no rules, so it no longer asks on drop (copies already on Zords keep
   their pick).

## Still partial (11), nothing more converts

| Item | What stays code, and why the new pieces don't reach it |
|---|---|
| Mercurial Nature | Unlimited Mass Shift reads `ZORD2.mercurialNature` inside the daily Mass Shift pool (code state). |
| Ranger Operator [Form] | Form lifecycle (un-equip by class, restore on de-Morph); no step runs at Morph time. |
| Beast Morpher [Form] | `legacy` could move `zord1Beast`, and the berserk's 1d4 rounds is now a dice formula, but every row sits in the Form Use (an extension Use still hides a rule Use). |
| Ninja Storm Wind Ranger [Form] | Form Use rows (Use precedence), Duplication after `ruleDerived`, an incoming DialogSwitch. |
| Time Force [Form] | Form lifecycle; its rows are Form Use rows. |
| Supersonic [Form] | `@count.items`, hit-time damage-type changes, Form lifecycle. |
| Megafauna | Smarts/Social after Terrorzord's code; `holder:` context in SkillSubstitution; flag set by hooks. |
| Hybridization | Daily Mass Shift pool scaling with level, size class as text, patched core checks. |
| Carapaced (Common) / (Large) | A DerivedStat/Movement stage after the hand-written derived hooks (Rotor Blades reads Ground in between). |
| Lightspeed Boost | `legacy` moves one flat value; the old pick is an object `{option, how, types}`, and HAZMAT needs two types without repeats (pick options are fixed). Movement after gravity, elevation, boolean Resistances / Immunities. |

## Still skipped (89), and what each still needs

**zord1 / zord2 (48)**
- Lightspeed Response, Turbo - the Form lifecycle (Morph-time choice, un-equip / restore).
- Solar Power - a hit-time damage-type override and a per-hit rider option.
- Dino Thunder - per-copy timed powers with canvas point picks; a `createItem` per power still needs a branch on the old per-copy pick.
- Emotional Range - a ChoiceSet that grows with a Role Points value, read by `emotional-mastery.mjs`.
- Emotional Strength - watch Triggers and 1d2 now exist, but the active Emotional Mastery options are code state (no `check:`), the once-per-scene flag is shared with `emotional-mastery.mjs`, and Group Test / roll-total events are missing.
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
- Enhanced Melee Attack, Enhanced Ranged Attack - `createItem` children could make them, but they must be regenerated on the Megaform as its roster changes.
- Warrior Mode (size), Mesh Zord - a size-class DerivedStat (text); Mesh Zord also flag-list picks and a Megaform-membership test.
- Power Matrix - a reserve scaling with copies, drawn by the driver, refilled on the pilot's rest.
- Versatile Combiner - a Trait from the owner's spectrum colour (Role name).
- Adaptable Future Tech - a combine-eligibility check.
- Zord Feature (slot) - the owned-Zord recipient.
- Zord Ultra Mode - turning other Features' Active Effects on / off, ending on Defeat.
- Defender Torozord - creates a Megaform actor.
- Shinobi of the 63rd Hexagram - Active-Effect picks on existing copies, `vehicle:name~`.
- Rotary Blade (weapon), Rotary Blade (shield) - one extension Use shared with Carapaced / Shinobi; the shield-mode flag is read by code.
- Dozer Blade (Alt Mode) - a Region-clearing step.

**pr1 (16)**
- Mobile Headquarters (rest) - derived Initiative Edge (not a switch-off-able source), a scene-wide actor-type aura, Megaform link.
- Overdrive - a crew member paying the cost, per-turn "options taken" memory, per-turn derived / hit effects.
- Prospector Toolkit - a bonus-die bank (More Heads), returned when another roll comes first.
- Spectrum Shifted - what an old Role keeps on a Role change (role-handler hooks).
- Time Displaced (Use half) - dice formulas now exist, but no step rolls a chosen die one size up to a blind card.
- Warhead Magazines - three picks per copy excluding taken types, a select switch with an action cost, a rider option.
- Be an Example - `skill:data:<path>` (the rolled Skill equals `system.originSkillsIncrease`) or `appliesWhen` filled at bank time.
- Destiny (Hang-Up) - a GM-side card button (Reaction `who` has no GM), a GM Story Point resource, a Fumble conversion.
- Lightspeed Boost (rest) - see the partial table.
- Nemesis (the reroll) - a reroll step for a finished roll.
- Power Flux - a `crew` recipient and an "on the canvas" tag at scene start.
- Power Wing (rest) - equip / unequip Trigger events.
- S.W.A.T. Upgrade (rest) - Incapacitation Ammo: a Reaction can see `@var.damage`, but not the dialog's alternate-fire switch, and it would apply damage rather than post an Apply option; Incarceration Protocols: "last hit by this actor" credit and a counter readout.
- Stand Behind Me! - blocking the roll before it is made (`negateHit` cancels after the fact) and per-enemy turn-start tests.
- Tactical Size Shift - text size DerivedStat and an actor Skill-die step with undo.
- Warzord (rest) - Titanic after Tactical Size Shift, a Megaform-combines event.

**pr2 / pr3 (25)**
- Bend Physics, Primal Rage - a team scope (every PC); Bend Physics also a Movement stage after gravity.
- Instructor - Smarts-Skill-filtered pick, a student list, an untrained-Snag lift on others.
- Aim Apparatus - a world-PC picker, a cross-actor Skill-shift step, a removed event.
- Dino Gem Integration, Energem Infusion - `pick {from: ownedItem}` with item-tag filters and a lone-option auto-pick.
- Dino Drive Mode - Reflective Armor's 1d2 is now a formula, but the reduction applies to any Energy hit (not only defeat-level damage), plus an Active Effect on a chosen movement type and a Zord-within-30-ft-holding-X tag.
- Aura of Decay - a before-roll event.
- Flames of Hate - an "ignore armor" Defense mode after best / halve.
- Incineration Blast - a "moved on its own turn" event.
- Megaform Expeditor - 1d4 is a formula now, but the join time is rolled inside `combiner-timer.mjs` (no rule hook).
- Ninja Power - its Use shares the button with the code-side Power-upkeep state.
- Peerless Pilot (PR) - a rule hook in the emergency disembark.
- Power Heal - a step running `powerCost`, a pick over a creature's current negative Conditions.
- Survivor - the d20 is a formula now, but there is no Essence-changed event.
- Unique Weapon (Green Ranger) - dice don't branch: a random option on `choose` / `pick`.
- Unique Weapon (Small Melee) - a rule hook in `zord-summon.mjs`.
- Unique Weapon (Two-Handed Melee) - a Movement stage after `registerDerived` and gravity.
- Elemental Fury - `createItem` children now exist, but the attack's damage / range / classification are computed from the strongest ranged attack (createItem data is literal), and it is deleted once rolled.
- Power Construct - `takesDamage` doesn't know melee / the targeted Defense; the alternate rider option.
- Restraining Gear - an opposed-roll step, Power paid by the pilot, Megaform participants.
- Zord Mount - a pick over every Zord in the world; a once-per-turn first-melee note on hit or miss.
- Emissary's Gift - a pack filter on `pickPerk`.
- Morphin Navigator - 1d2 is a formula now, but there is no Party-roster recipient (`allies:<ft>` is token range).
- Protector of Safehaven - `until: mission` for choices, a temp-resource step.

## Edits outside my files

None required. Optional cleanup, now that `pr2/perks.mjs` is an empty module: remove the line
`import "./pr2/perks.mjs";` from `module/helpers/extensions/index.mjs`, delete `module/helpers/extensions/pr2/perks.mjs`,
and drop the `expect(Object.keys(await import('./perks.mjs'))).toEqual([]);` line (and its comment) from
`module/helpers/extensions/pr2/pr2.test.js`.

## Unused strings

`E20.Pr1ProfiteerToggle`, `E20.Pr1DinoChosen`, `E20.Pr1DinoPick`, `E20.Pr2GridRelicName`, `E20.Pr2GridRelicEffect`,
`E20.Pr2GridRelicPickStyle`, `E20.Pr2GridRelicMight`, `E20.Pr2GridRelicFinesse`, `E20.Pr2GridRelicGranted`,
`E20.Pr3OverloadOn`, `E20.Pr3UniqueFumble`. (`E20.Pr1Dino.*` stays: the Dino Gem pick rule uses those keys as labels.)

## Files touched

- `module/helpers/extensions/pr1/jtt.mjs`, `pr1/misc.mjs`, `pr1/common.mjs`, `pr1/pr1.test.js`
- `module/helpers/extensions/pr2/perks.mjs`, `pr2/common.mjs`, `pr2/pr2.test.js`
- `module/helpers/extensions/pr3/ttsg.mjs`, `pr3/pr-crb.mjs`, `pr3/common.mjs`, `pr3/pr3.test.js`
- `packs/jttitems/_source/Profiteer_FDf9ZhuajJb3U5un.json`, `packs/ttsgitems/_source/Overload_GNT0qv91JUTXfS0n.json`,
  `packs/prcrbitems/_source/Grid_Relic_Weapon_82Ld65NsKwfMZaSC.json`,
  `packs/prcrbitems/_source/Unique_Weapon_Ranged__Pr3UniqWpnRanged.json`,
  `packs/bthitems/_source/Advanced_Dino_Gem_Integration_K4CUMFhAjXRFzGbA.json` (all CRLF, kept)
- `module/rules/conv3-slA3.test.js` (new), `docs/rules-batches/slA3.md` (this file)

**Rule count added: 8** (Profiteer 2, Overload 2, Grid Relic Weapon 1, Unique Weapon (Ranged) 1, Advanced Dino Gem
Integration 2; plus 5 Dino Gem rules edited).
