# Batch slA6: sixth pass over the `zord1`, `zord2`, `pr1`, `pr2`, `pr3` slices

**Scope:** every item `docs/rules-batches/slA5.md` left skipped (80) or partial (13), re-checked against the guide's
round-6 section ("Engine features added 2026-10-06 (round 6, after the local round-5 conversions)": `target:self`,
`status:<id>:timed`, compound `wielding:a&b`, upgrade-aware `item:trait`, `item:hasUpgrade`, `rule:hostEquipped`,
`combat:enemyStatus|allyStatus`, `roll:fumble` + damage type in Reactions, `@recipient`, `nextTurnOrScene`,
`worldTime:N`, `combatAllies`, `alliesOfTarget|enemiesOfTarget:N`, `mark {exclusive}`, GM-relayed `applyCondition` rounds,
i18n table rows, the `team` scope, Movement `afterDerived` + `round`, afterRoll `@var.dif`, open rolls reaching
`outcome: "any"`, `notDouble`) and against the earlier sections again; slA5's recorded behaviour differences looked at
again. Edited in place (no branch, no commit).

| Verdict | zord1 + zord2 | pr1 | pr2 + pr3 | Total |
|---|---|---|---|---|
| Convert (was skip) | 0 | 0 | 2 | **2** |
| Partial now fully converted | 2 | 0 | 0 | **2** |
| Skip now partial | 1 | 1 | 1 | **3** |
| Still partial, nothing more converts | 9 | 2 | 0 | **11** |
| Still skip | 44 | 13 | 18 | **75** |
| Re-checked (skip + partial) | 56 | 16 | 21 | **93** |

(Converted: Primal Rage, Morphin Navigator. Fully converted: Carapaced (Common), Carapaced (Large). Skip to partial:
Additional Pair of Limbs (zord1), S.W.A.T. Upgrade (pr1), Bend Physics (pr2). Lightspeed Boost and Advanced Dino Gem
Integration are the two unchanged pr1 partials; the nine zord partials are the rest of slA5's partial table.)

**Rules added:** 13 rules on 7 pack items. `scripts/check-rules.mjs`: 1848 rules on 1157 items, 0 errors, 0 warnings.
ESLint (`--ext .js,.mjs`) is clean on the five slice folders and the new test file. Jest passes on the five slice
folders plus `module/rules/conv6-slA6.test.js`, `conv5-slA5.test.js`, `conv4-slA4.test.js`, `conv3-slA3.test.js`,
`conversions.test.js` and `engine6.test.js` (11 suites, 879 tests).

**Depends on one outside edit** (below): `team` is missing from `rules/index.mjs`'s `LINKED` list, so no `team` rule
reaches anyone yet. Primal Rage's and Bend Physics' holder copies work without it; their teammates' copies need it.

## Converted

- **Primal Rage (Beneath the Helmet, pr2)** - `packs/bthitems/_source/Primal_Rage_4gkRa5plNeMNXSmL.json`. Two RollModifiers
  labelled "Primal Rage", ↑1, `when: ["self:type:playerCharacter", "attack", "item:type:weaponEffect", {any:
  ["attack:unarmed", "item:name~unarmed", "weapon:name~unarmed"]}]` (the old `isUnarmedAttack`: no parent weapon, or
  the Unarmed Combat weapon / an attack named so) - one plain (the holder), one `scope: "team"` (every other Player
  Character). Both carry `stack: "primalRage"`, so a teammate who holds it too still gets one ↑1 (the old `teamHolds`
  counted once). The old code gave nothing to a non-PC even holding it - hence `self:type:playerCharacter`. Removed from
  `pr2/team.mjs`: `isUnarmedAttack`, `primalRageSources` and its registration (and the `parentOf` import);
  `PR2.primalRage` from `pr2/common.mjs`; the slice test.
- **Morphin Navigator (Through the Shattered Grid, pr3)** - `packs/ttsgitems/_source/Morphin_Navigator_nDx2XD6gD9lM37Bl.json`
  (its Grid-navigation Edge switch was already a rule). A Use "Grid Power Bloom", `cost: {action: standard}`, `limit:
  {per: mission, max: 1}`: a chat line, then `updateActor {to: party, filter: ["target:data:system.powers.personal.max>0"],
  add: {system.powers.personal.value: "1d2"}, max: "@recipient.system.powers.personal.max"}` - each member rolls their
  own 1d2 and stops at their own maximum (the old `gridPowerBloomResults`, `min(max, value + roll)`, members without a
  Personal Power maximum skipped). Removed from `pr3/ttsg.mjs`: the `pr3Navigator` Use, `NAVIGATOR_USES`, the now-unused
  `writeActor` import; `IDS.navigator` from `pr3/common.mjs`; the registration test now asserts it is gone.
- **Carapaced (Common) and Carapaced (Large) (Technorganic Secrets, zord2)** -
  `packs/tsitems/_source/Carapaced__Common__aTevGfLML1dlbErs.json`, `Carapaced__Large__2mSP6mVx0axvOlXf.json` (their
  Underground DerivedStat was converted earlier). A Movement rule, Ground `add 20` at stage `afterDerived`, `when:
  ["rule:altMode", "not:rule:data:flags.essence20.zord2CarapacedChoice=burrow"]` (in that Alt Mode, unless Underground
  was picked - never picked counts as Ground, as before); and a Use "Ground or Underground (Carapaced)" whose `choose`
  writes the same `flags.essence20.zord2CarapacedChoice` (`ground` / `burrow`) with `updateItem`, so existing picks keep
  working. `afterDerived` puts the +20 after zord1's Rotor Blades reads Ground (slA5's blocker); every hand-written
  Movement hook that ran after zord2's gear-modes hook is additive or doesn't apply in Alt Mode, so the sum is unchanged.
  Removed from `zord2/gear-modes.mjs`: `gearDerived` and its registration, `CARAPACED_FLAG`, `pickCarapaced`, the
  Carapaced rows of the `zord2-gear-modes` Use (it keeps Shinobi and Dozer Blade), the `registerDerived` / `itemsOf`
  imports; `ZORD2.carapacedCommon` / `carapacedLarge` from `zord2/common.mjs`; the slice test.
- **Additional Pair of Limbs - the +10 Ground (Decepticon Directive, zord1, was skip)** -
  `packs/dditems/_source/Additional_Pair_of_Limbs_pedTP4vV1qwoBJvn.json`. A Movement rule, Ground `add 10` at
  `afterDerived`, `when: ["self:transformed", "rule:data:flags.essence20.zord1LimbsMode=move"]` - the flag the slice's
  Use still sets. Removed: `bodiesDerived` and its registration (and the `registerDerived` import) from
  `zord1/bodies.mjs`; its slice test. Stays code: the mode picker Use and the ↓1 on a two-target unarmed attack.
- **S.W.A.T. Upgrade - Incarceration Protocols (Across the Stars, pr1, was skip)** -
  `packs/atsitems/_source/S_W_A_T__Upgrade_Ce5f5pQTNTSY6xgF.json`. Three Triggers: `hit` (`when: ["self:type:zord",
  "attack"]`) puts an exclusive mark `swatLastHit` on the target - the mark comes off whoever the Zord hit before (the
  old `pr1SwatLastTarget` flag); a `watch: enemy` `defeated` Trigger (`when: ["self:type:zord",
  "markedByMe:swatLastHit"]`, `limit: {per: scene, max: 6}`) counts a scene-long `swatDetained` mark up and posts
  "{target} is digitally detained (N containment cards left)" (`{@mark.swatDetained * -1 + 6}`); a second one takes
  the mark off the Defeated (the old `unsetFlag`, which happened even with no card left). Removed from `pr1/ats.mjs`:
  `SWAT_CARDS`, `SWAT_LAST`, `swatCards`, the `registerAfterDamage` block (and its import), the "remember who the Zord
  just hit" lines of the hit rider. Stays code: Incapacitation Ammo (the alternate-fire switch and its rider option).
- **Bend Physics - the +2 Evasion (Beneath the Helmet, pr2, was skip)** -
  `packs/bthitems/_source/Bend_Physics_EITAjh6GBuc2SVSY.json`. Two Defense rules, Evasion +2: the holder's (`when:
  ["self:type:playerCharacter", "self:morphed", "attack:ranged"]`) and a `team` copy (`when: ["self:morphed",
  "attack:ranged", "not:self:hasItem:<Bend Physics>"]`, so a teammate holding it too gets +2 once). `attack:` tags make
  them roll-time Defense rules (decided per attack, added to the Defense the card checks - as the old
  `registerDefenseAdjust` was). Removed: `bendPhysicsDefense` and its registration, `registerDefenseAdjust` /
  `isRangedAttack` imports, `isRangedAttack` from `pr2/common.mjs`; the slice test. Stays code: the Movement doubling
  (see the skip list) and its `ready` re-prepare.

New tests: `module/rules/conv6-slA6.test.js` (18 tests, each item loaded from its pack source). The `team` tests note
the holder in `LINK_HOLDERS` by hand, as `rules/index.mjs` will once `team` is on its list.

## Behaviour differences worth a decision

1. **`team` rules need the index edit** (below). Until it lands, Primal Rage's ↑1 and Bend Physics' +2 Evasion reach
   only their holder, not the rest of the team.
2. **Bend Physics, two holders:** a PC holding no copy while two other PCs hold Bend Physics gets +4 Evasion (one
   `team` copy from each) unless the optional `links.mjs` edit below lands. (Primal Rage is safe either way - its
   `stack` group keeps one ↑1.)
3. **S.W.A.T. Incarceration:** watch Triggers only see the canvas, so the Zord and the Defeated enemy must both have
   tokens (the old hook also worked off the canvas, checking sides only when both were on it); a neutral Zord treats
   hostile tokens as enemies (the old check needed both sides non-neutral); a hit that dealt no damage also marks
   (the old rider only ran for damaging hits); with two S.W.A.T. Zords hitting the same creature the later hitter
   gets the credit (the old code took the first Zord in the world list). The chat is a rules card on the Zord. Old
   `pr1SwatLastTarget` / `pr1SwatCards` flags are ignored: a creature hit before the update isn't detained, and this
   scene's count restarts at 6.
4. **Morphin Navigator:** the team is the actor's Party (the primary Party first, else the first roster holding it) -
   the old code took every Party roster the actor is on together; the chat shows each 1d2 as a "rolled" line without
   the member's name; the once-per-mission count is the item's (two Navigators on one actor: two Blooms) and an old
   copy's used-this-mission flag isn't carried over (one extra Bloom at most); the Use needs the gear equipped (gear is
   equipped by default).
5. **Primal Rage:** an attack whose `parentId` points at a weapon that no longer exists no longer counts as unarmed
   (the old `!weapon` did); a roll whose dialog context leaves `isAttack` unset but rolls a weapon effect now counts.
6. **Movement at `afterDerived` (Carapaced, Additional Pair of Limbs):** both now land after every hand-written derived
   hook. Only cross-line multipliers notice: Shark's Fin's Ground x2 (GI Joe, also `afterDerived`, multiply before add)
   gives 2x + 20 instead of (x + 20) x 2 on a Carapaced; Dino Thunder's Shield Propulsion x2 (zord1 forms, after
   zord1 bodies) gives 2x + 10 instead of (x + 10) x 2 with Additional Pair of Limbs.
7. **Carapaced's pick:** plain button labels and a rules chat card (it was an i18n'd dialog).

### slA5's recorded differences, looked at again

- #3 (Lightspeed Boost / Enhanced Stealth at `afterGravity`): `afterDerived` doesn't remove it - it would put Aeronautic's
  `max 40` after Overdrive's +20 (pr1/jtt) and zord-features2's +10, so `max(x, 40) + 20` would become `max(x + 20, 40)`.
  Left as is.
- #1, #2, #4, #5, #6 - nothing in round 6 changes them. Overload's `endOfTurn` stamp in an unstarted combat is still
  unchanged (round 6 added `nextTurnOrScene`, not a fix for `endOfTurn`).

## Still partial (14)

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
| Lightspeed Boost | The picker (an object pick; HAZMAT's two distinct types) and the in-flight / submerged Evasion (token elevation). |
| Advanced Dino Gem Integration | Primordial Power's post-hit +2 note; Genetic Resonance (`zord-summon` timing). |
| Shinobi of the 63rd Hexagram | The Defense picks live only as Active-Effect enabled states on existing copies. |
| Additional Pair of Limbs | The ↓1 needs a "two or more targets" roll tag; the picker's Stand-up row (Bot Mode + Prone only, a Free action) needs `choose` options with their own `when`. |
| S.W.A.T. Upgrade | Incapacitation Ammo: the alternate-fire switch as a hit-card rider option. |
| Bend Physics | The Movement doubling: no stage sits where pr2's hook does (see the skip list's Unique Weapon (Two-Handed Melee) line). |

(Eleven unchanged from slA5 - the "still partial" row - plus the three "skip now partial" items.)

## Still skipped (75), and what each still needs

**zord1 / zord2 (44)**
- Lightspeed Response, Turbo - the Form lifecycle (Morph-time choice, un-equip / restore).
- Solar Power - a hit-time damage-type override and a per-hit rider option.
- Dino Thunder - per-copy timed powers with canvas point picks.
- Emotional Range - a ChoiceSet that grows with a Role Points value, read by `emotional-mastery.mjs`.
- Emotional Strength - the active Emotional Mastery options are code state (no `check:`), the once-per-scene flag is shared with `emotional-mastery.mjs`, a Group Test result event is missing.
- Rex Feature, Additional Zord - an owned-Zord `pickGrant` recipient; Additional Zord also a pre-update veto.
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

**pr1 (13)**
- Mobile Headquarters (rest) - derived Initiative Edge (not a switch-off-able source), a scene-wide actor-type aura, Megaform link.
- Overdrive - a crew member paying the cost, per-turn "options taken" memory, an energy-only post-hit note.
- Power Flux - now only a "the holder has a token on the canvas" tag: a `crew`-scoped `sceneStart` Trigger with `updateActor {add: "min(6, @recipient.system.powers.personal.max - @recipient.system.powers.personal.value)"}` and a `max > 0` filter would do the rest.
- Prospector Toolkit - a bonus-die bank (More Heads), returned when another roll comes first.
- Spectrum Shifted - what an old Role keeps on a Role change (role-handler hooks).
- Time Displaced (Use half) - a step rolling a chosen die one size up to a blind card with the anomaly band.
- Warhead Magazines - three picks per copy excluding taken types, a select switch with an action cost, a rider option.
- Be an Example - `skill:` against `system.originSkillsIncrease` (a data path, not a pick) or `appliesWhen` filled at bank time.
- Destiny (Hang-Up) - a GM-side card button (Reaction `who` has no GM), a GM Story Point resource, a Fumble conversion.
- Nemesis (the reroll) - a whole-formula reroll that leaves the choice to the player, on cards without target rows.
- Stand Behind Me! - blocking the roll before it is made and per-enemy turn-start tests.
- Tactical Size Shift - text size DerivedStat and an actor Skill-die step with undo.
- Warzord (rest) - Titanic after Tactical Size Shift, a Megaform-combines event.

**pr2 / pr3 (18)**
- Instructor - the `team` scope now covers the students' Snag lift, but the pick is a Smarts Skill the holder is Specialized in (else any Smarts Skill) - `pick from: skill` has no filter - and the students are picked from every PC in the world and kept per Skill (no world-PC picker, no student list).
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
- Unique Weapon (Two-Handed Melee) - the -10 ft sits in pr3's derived hook, between Bend Physics' x2 (pr2) and the rules' DerivedStats; neither stage matches: `afterGravity` gives 2(x - 10) with Bend Physics (old 2x - 10), `afterDerived` gives 2x - 10 with Ninja Storm Wind Ranger's Ground x2 DerivedStat (old 2(x - 10)) and lowers Cloud Hatchet's 30 ft Aerial floor to 20.
- Elemental Fury - the attack's damage / range / classification come from the strongest ranged attack, and it is deleted once rolled.
- Power Construct - `takesDamage` doesn't know melee / the targeted Defense; the alternate rider option.
- Restraining Gear - an opposed-roll step, Power paid by the pilot, Megaform participants.
- Zord Mount - a pick over every Zord in the world; a once-per-turn first-melee note on hit or miss.
- Emissary's Gift - a pack filter on `pickPerk`.
- Protector of Safehaven - `until: mission` for choices, a temp-resource step.

## Edits outside my files

1. **Required for the `team` copies (Primal Rage, Bend Physics):** `module/rules/index.mjs` line 138 - the list of
   scopes that make an actor a link holder leaves out `team`, so `rules/links.mjs#linkedEntries` never sees a `team`
   holder (`LINK_HOLDERS` stays empty for it). Replace
   `const LINKED = ['crew', 'pilot', 'vehicle', 'driven', 'companion', 'owner', 'party', 'aura'];`
   with
   `const LINKED = ['crew', 'pilot', 'vehicle', 'driven', 'companion', 'owner', 'party', 'team', 'aura'];`
   (`engine6.test.js` only validates a `team` rule; nothing tests that one reaches a teammate.)
2. **Optional (Bend Physics with two holders, difference #2):** in `module/rules/links.mjs#linkedEntries`, let
   `stacks: false` count one book item's `team` rule once, as it already does for auras. Replace the block
   ```js
     // team: a holder's rule reaches every other Player Character in the world.
     if (actor.type == 'playerCharacter') {
       for (const id of LINK_HOLDERS.keys?.() ?? LINK_HOLDERS) {
         const holder = globalThis.game?.actors?.get?.(id);
         if (holder?.type == 'playerCharacter') {
           add(holder, 'team');
         }
       }
     }
   ```
   with
   ```js
     // team: a holder's rule reaches every other Player Character in the world; stacks: false counts one
     // book item's rule once, however many teammates hold it.
     if (actor.type == 'playerCharacter') {
       const teamOnce = new Set();
       for (const id of LINK_HOLDERS.keys?.() ?? LINK_HOLDERS) {
         const holder = globalThis.game?.actors?.get?.(id);
         if (holder?.type != 'playerCharacter' || holder === actor) {
           continue;
         }

         for (const entry of rulesOfType(holder, type, 'team')) {
           const key = entry.rule.stacks === false ? sourceKey(entry.item, entry.index) : null;
           if (key && teamOnce.has(key)) {
             continue;
           }

           if (key) {
             teamOnce.add(key);
           }

           out.push({ ...entry, holder });
         }
       }
     }
   ```
   (Both `team` rules added here already carry `stacks: false`.)
3. Optional comment tidy, carried from slA5: `module/mechanics/rolls/roll-dialog.mjs` line 99
   `// Shinobi of the 63rd Hexagram / Steady Hands - helpers/extensions/zord2/snag.mjs.` could become
   `// Steady Hands - helpers/extensions/zord2/snag.mjs (Shinobi's motorcycle Driving is its own item rule).`

## Unused strings

`E20.Pr2PrimalRage`, `E20.Pr3NavigatorBloom`, `E20.Pr1SwatDetained`, `E20.Zord2CarapacedPrompt`,
`E20.Zord2CarapacedGround`, `E20.Zord2CarapacedBurrow`. (`E20.Zord1Limbs*` are still used by the Limbs Use;
`E20.Pr1SwatStunApply` / `E20.Pr1SwatStunToggle` by Incapacitation Ammo.)

## Files touched

- `module/items/social/instructor-legacy-students.mjs`, `pr2/common.mjs`, `pr2/pr2.test.js`
- `module/items/zords/elemental-fury.mjs`, `pr3/common.mjs`, `pr3/pr3.test.js`
- `module/items/zords/lightspeed-swat-features.mjs`
- `module/helpers/extensions/zord1/bodies.mjs`, `zord1/zord1.test.js`
- `module/items/gear/dozer-blade-shinobi.mjs`, `zord2/common.mjs` (both LF, kept), `zord2/zord2.test.js`
- `packs/bthitems/_source/Primal_Rage_4gkRa5plNeMNXSmL.json`, `Bend_Physics_EITAjh6GBuc2SVSY.json`;
  `packs/atsitems/_source/S_W_A_T__Upgrade_Ce5f5pQTNTSY6xgF.json`; `packs/ttsgitems/_source/Morphin_Navigator_nDx2XD6gD9lM37Bl.json`;
  `packs/tsitems/_source/Carapaced__Common__aTevGfLML1dlbErs.json`, `Carapaced__Large__2mSP6mVx0axvOlXf.json`;
  `packs/dditems/_source/Additional_Pair_of_Limbs_pedTP4vV1qwoBJvn.json` (all CRLF, kept)
- `module/rules/conv6-slA6.test.js` (new, CRLF), `docs/rules-batches/slA6.md` (this file)

**Rule count added: 13** (Primal Rage 2, Bend Physics 2, S.W.A.T. Upgrade 3, Morphin Navigator 1, Carapaced (Common) 2,
Carapaced (Large) 2, Additional Pair of Limbs 1).

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
3. **Owned-Zord / crew recipients and a pilot-paid cost** (`to: ownZord`, `to: crew`) - Rex Feature, Zord Feature
   (slot), Additional Zord, Terrorzord Nature, Overdrive, Power Matrix, Restraining Gear (payer), Phantom Focus.
   **Medium.**
4. **Movement rules at a hand-written hook's place** - either a stage per remaining hand-written Movement hook (or
   moving those hooks - Mega Defender's set, the GI Joe halve rider, Bend Physics' x2, Unique Weapon's -10, the rules'
   own DerivedStats on `system.movement` - onto explicit stages), so every Movement change has a known order - Bend
   Physics (doubling), Unique Weapon (Two-Handed Melee). **Medium.**
5. **Size class as data** (a Size step / DerivedStat on the size ladder with min / max, and an equip veto) - Enlarged,
   Shrunk, Tactical Size Shift, Warzord (size), Warrior Mode (size), Mesh Zord (size), Revolutionary Shape-Shifting,
   Hybridization (Change Size). **Medium.**
6. **Hit-time damage-type override + rider options from rules** (an "Apply as X" option on the hit card) - Solar
   Power, Warhead Magazines, S.W.A.T. Incapacitation Ammo, Power Construct (alternate), Supersonic. **Medium.**
7. **A token-present tag** (`self:onCanvas` / `holder:onCanvas`: the actor has an active token in the viewed scene) -
   Power Flux (the rest is there). **Small.**
8. **`roll:targets>=N` and conditional `choose` options** (an option's own `when`) - Additional Pair of Limbs (↓1 and
   the Stand-up row). **Small.**
9. **Pick improvements** - `pick from: skill` with an Essence filter and "Specialized only, else all" fallback, `pick
   from: team` (every world PC, not the canvas), and marks keyed by a pick (a student list per Skill) - Instructor;
   the world-PC picker also serves Aim Apparatus. **Small-medium.**
10. **More Trigger events:** before-roll (Aura of Decay), token moved on its own turn (Incineration Blast), Group Test
    result (Emotional Strength), Megaform combines (Warzord). **Small each.**
11. **A "choose" reroll** (the player keeps either result, any card) - Nemesis. **Small.**
12. **GM-side Reaction** (`who: gm`) + a GM Story Point resource + a "make it a Fumble" card step - Destiny. **Small.**
13. **Bonus-die bank** (a banked die added to the next matching roll) - Prospector Toolkit. **Small.**
14. **Armor-shred CriticalOption** (lower the target's armor share for the scene, stacking) - Anti-Armor.
    **Small-medium.**
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
