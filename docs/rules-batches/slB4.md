# Batch slB4: re-check of slB3 (`tf1`, `tf2`, `tf3`, `fix3-tf`, `other2`) against the round-4 engine pieces

**Scope:** every item `docs/rules-batches/slB3.md` left Skipped or Partial (93 items counted one per book item - slB3 counted 91), re-checked against "Engine
features added 2026-10-05 (round 4, after the local round-3 conversions)" in `docs/RULES_CONVERSION_GUIDE.md`
(wielding tags, `combat:exists`, `until: combat`, mark counters / `@mark`, `essenceDamage` / `healEssence` /
`extendCondition`, `rerollCard`, `roll` `snag` / `open`, `grant` `name` / `integrated` / `systemFormulas`, step
`filter`, outcome lists + `plainSuccess`, afterRoll `@var.total`, Toggle `legacy`, granted attachments carrying
`grantedBy`) and the earlier sections. Edited in place in the main checkout (no branch, no commit).

| Verdict (re-checked items) | tf1 + fix3-tf | tf2 | tf3 | other2 | Total |
|---|---|---|---|---|---|
| Convert (no slice code left) | 7 | 0 | 3 | 0 | **10** |
| Partial (more of it converted) | 0 | 0 | 2 | 0 | **2** |
| Still skip | 18 | 20 | 17 | 26 | **81** |
| Re-checked | 25 | 20 | 22 | 26 | **93** |

**24 rules were added to 13 pack items** (8 of them get their first `rules` array). After this part,
`scripts/check-rules.mjs` counts 1668 rules on 1107 items (other agents are adding rules at the same time), with 0
errors and 0 warnings.

## Converted

| Item | Rules | Why it is exact |
|---|---|---|
| Comms Probe (`dditems`) | Use, `cost: {action: free}`: `roll` Technology DIF 12; on a success `mark` self `commsProbe` `until: scene` (+ a chat line), on a failure a chat line. | The old Use paid a Free action, rolled `rollTest(actor, 'technology', 12)` (the same helper the `roll` step calls) and on a success turned on the `tf1CommsProbe` scene window (`activateForWindow(..., 'scene')` = the scene epoch the mark's `until: scene` stamps). |
| False Data (`dditems`) | Use, `when: ["self:marked:commsProbe"]`: `roll {skill: deception, open: true}`. | The old Use was offered only while the Comms Probe scene window was on, cost nothing and called `actor._dice.rollSkill({skill: 'deception', essence: 'social', shiftUp: 0, shiftDown: 0})` - what an `open` roll step calls (`social` from `skillToEssence`). `self:marked:` is static, so the button hides the same way. |
| Mine! (`dditems`) | Two Uses, each `cost: {action: free}`: "Grab it openly" (a chat line) and "Grab it unnoticed (Infiltration)" (`roll {skill: infiltration, open: true}`). | The old Use asked open / unnoticed first and only then paid the Free action, so backing out cost nothing. With two Use rules the engine asks which one BEFORE paying (`runUse`'s picker), so a cancelled choice still costs nothing; the sneak roll is the same `rollSkill` call (`infiltration` / `speed`). |
| Picking Up the Trail (`dditems`) | Two Uses, no cost: "Alertness" / "Survival", each an `open` roll of that Skill. | The old Use asked Alertness or Survival and rolled it through `rollSkill` with `smarts` (both Skills' own Essence), no action. |
| Easy In, Easy Out (`dditems`, appended) | (1) Trigger `conditionGained`, `when: ["self:status:invisible", "combat:exists", "self:hasItem:<Disappear>"]` → `setToggle easyInvisible true`. (2) Trigger `turnStart`, `when: ["self:toggle:easyInvisible"]` → chat (only while invisible), `removeCondition invisible`, `setToggle easyInvisible false`. | The old `createActiveEffect` hook (same client, same hook the `conditionGained` Trigger uses) stamped the holder when an invisible effect arrived while holding the Perk and Disappear and while `game.combat` existed (started or not = `combat:exists`); the next turn start (`registerTurnStart`, which the `turnStart` Trigger is) cleared the stamp and took Invisible off if still there, with a chat line. |
| Loaded Questions (`dditems`) | Triggers `hit` and `miss`, `when: [{any: [skill:deception, skill:persuasion]}]` → `mark {to: target, key: loadedQuestions, count: 1, add: true, until: scene}`; RollModifier `upshift: "@target.mark.loadedQuestions"`, same `when`. | The old post-roll hook counted +1 per Deception / Persuasion roll for every target it was made against (`hits`, the same list the hit / miss Triggers fire for), reset with the scene, and the roll source added that count as ↑ on a Deception / Persuasion roll at the same target. A zero count gives no source, as before. |
| Holographic Doubles (`tfcrbitems`) | Use "Create a Holographic double" (`cost: standard`, while no double is up) and Use "Create another" (`cost: free`, 1 to 7 up), each `mark {key: holoDoubles, count: 1, add: true, until: scene}`; RollModifier `scope: incoming`, `downshift: "@mark.holoDoubles"`, `when: ["attack"]`; Trigger `afterRoll` and Trigger `targeted` (`outcome: failure`, `attack`), each taking one away while any are up. | The old Use paid Standard for the first and Free for each more, up to 8, the count lasting the scene; attacks (weapon effects) against the holder took ↓ per double; one went on each of the holder's rolls and on each attack against them that missed (the attacker's post-roll, the same hook the `targeted` Trigger fires from), never below none. The `self:data:...count` gates read the same stored count the old flag held. |
| The Right Of All Sentient Beings (`tfcrbitems`) | Use, `when: ["combat:exists", "not:self:marked:rightOfAllFallen"]` → `mark rightOfAllFallen until: combat`; RollModifier `edge`, `when: ["self:marked:rightOfAllFallen", "not:roll:initiative"]`; DialogSwitch `edge`, `forget`, `when: ["combat:exists", "not:self:marked:rightOfAllFallen"]`. | The old Use needed a combat (started or not) and was hidden once used in it; the Edge source applied to every roll in that combat (roll sources never reached Initiative, hence `not:roll:initiative`); the "protecting a non-combatant" checkbox (Edge, or clear the Snag - the same thing at roll time) was offered while in a combat and not yet fallen, unticked each roll. |
| Tow Cable & Hook (`tfcrbitems`, the rest) | Use "Bot Mode weapon", `when: ["not:rule:granted:type:weapon"]`: `grant` the Grappler with `name`, `integrated: true`, `system` requirements cleared, `systemFormulas: {equipped: ["not:self:transformed"]}`. | The old shared gear Use (`grantCopy(..., {grantedBy, integrated: true, name: item.name, system: {requirements..., equipped: !isTransformed}})`) made it once; `rule:granted:type:weapon` is the old `gearWeaponOf` test. The gear's ↑1 switch and Triggers were already rules. |
| Predacon (`tsitems`, the slice half) | Trigger `hit`, `when: ["skill:intimidation", "combat:exists"]` → `mark {to: target, key: predaconFright}`; Trigger `turnEnd`, `watch: any`, `when: ["markedByMe:predaconFright"]` → `removeCondition frightened` and `unmark` on that creature. | The old post-roll hook marked each target an Intimidation test beat while `game.combat` existed (dice.mjs's `isPredaconAttempt`; dice.mjs still applies the Frightened itself), and the turn-end hook (same `registerTurnEnd`) took Frightened off at the end of the target's next turn. Since E20 has no reactions, the mark is always made on another creature's turn, so "its next turn end" is its first turn end after the mark - what the watch Trigger answers. A mark without `until` survives into another combat, as the old `combatId != combat.id` branch did. |

| Partial | Converted now | Still code |
|---|---|---|
| Rotor Blades (`tfcrbitems`) | The Bot Mode weapon Use (as Tow Cable's, Close Combat Heavy Blade) | The +1 damage against organic targets (`rotorHit`), the Alt Mode Aerial (`tf3Derived`) |
| Water Cannon (`tfcrbitems`) | The Bot Mode weapon Use (as Tow Cable's, Directed Element Rifle with `elementChoice: cold`) | The one-hardpoint discount (`tf3Derived`) |

Removed: `tf1/support.mjs` - the Loaded Questions roll source and post-roll hook (`tf1SupportSources`, `tf1SupportPostRoll`,
`LOADED_FLAG`, `loadedCount`, their registrations and the `getSceneEpoch` / `nameOf` / `registerPostRoll` /
`registerRollSources` imports) and the Comms Probe, False Data, Mine! and Picking Up the Trail Uses; `tf1/combat.mjs` -
Easy In, Easy Out (`EASY_FLAG`, `easyOnEffect`, `easyTurnStart`, its `createActiveEffect` hook and turn-start call, the
`combatStamp` import); `tf1/common.mjs` - the six `TF1` ids, `TF1.disappear` and `combatStamp`; `fix3-tf/tf-fixes.mjs` -
`FIX3_TF.predacon`, `KIND.predaconFright`, the Predacon post-roll branch, `tfFixTurnEnd` and its registration;
`tf3/rolls.mjs` - `HOLO_FLAG`, `holoDoubles`, `RIGHT_OF_ALL_FLAG`, their two roll sources, the `tf3Protect` toggle and its
apply; `tf3/reactions.mjs` - `loseDouble` and the Holographic Doubles half of `tf3PostRoll`; `tf3/uses.mjs` -
`useHoloDoubles`, `MAX_DOUBLES`, `GEAR_WEAPONS`, `gearWeaponOf`, `useGearWeapon`, `useRightOfAll` and their `USES`
entries; `tf3/common.mjs` - `TF3.holographicDoubles`, `TF3.rightOfAll`, `TF3_WEAPON`. Old tests removed: Loaded Questions
(`tf1.test.js`), both Predacon tests (`tf-fixes.test.js`), the Holographic Doubles source / pop / Use tests and the Right
Of All Use test (`tf3.test.js`; the Martyr test keeps its Martyr half). `tf1.test.js` and `tf3.test.js` now also check the
removed Uses are gone.

New tests: `module/rules/conv4-slB4.test.js` (16 tests) - Comms Probe / False Data (Free action, DIF 12, failure gives
nothing, False Data's open Deception roll, gone next scene), Mine! (cancel costs nothing, open / Infiltration), Picking
Up the Trail, Easy In Easy Out (unstarted combat, once, not out of combat / without Disappear), Loaded Questions (counts,
Skills, targets, scene reset), Predacon (other turn ends do nothing, the target's removes it; Intimidation in a combat
only), Holographic Doubles (Standard then Free, cap 8, scene; ↓ per double on attacks only; popping on rolls and missed
attacks, never below 0), The Right Of All (needs a combat, switch until used, Edge for that combat, not Initiative, ends
with the combat), the three gear weapons (data, Integrated, requirements, equipped by mode, hidden afterwards).

## Behaviour differences worth a decision

All same-line (Transformers) unless said.
1. **Easy In, Easy Out, any Condition.** `conditionGained` doesn't say which Condition arrived, so the Trigger asks
   "invisible now?". An invisibility that began before any combat existed is put on the clock when the holder gains some
   other Condition during a combat (the old hook only stamped on the invisible effect itself). Rare.
2. **Loaded Questions, one count per target.** The count lives on the questioned creature, so two holders questioning
   the same creature in one scene add to one count (before, each holder kept their own). A target this user doesn't
   own gets its count through the GM relay.
3. **Predacon, on the canvas.** The watch `turnEnd` Trigger needs both tokens on the GM's current canvas (the old hook
   read the target's own flag). Frightened applied before this update keeps its old rider mark, which nothing reads
   now (transitional).
4. **Holographic Doubles.** At eight doubles the Use button hides instead of warning; the source label is fixed text.
   Doubles made before the update (the `tf3HoloDoubles` flag) are ignored - they would have gone with the scene anyway.
5. **The Right Of All Sentient Beings, which combat.** `until: combat` ends when that combat is deleted; before, the
   Edge stopped as soon as another combat became the active one. An old `tf3RightOfAllFallen` flag is ignored
   (transitional).
6. **Gear weapons.** The weapon is named with fixed text ("Rotor Blades", "Tow Cable & Hook", "Water Cannon"), not the
   gear item's own (possibly renamed / translated) name; its attached attacks now carry `grantedBy` too, so they go with
   the gear; the Use hides while the gear is unequipped (gear rules need the gear active, as accepted in slB2 / slB3);
   the copy records its source in `_stats.compendiumSource` rather than `flags.core.sourceId` (`sourceOf` reads both).
7. **Chat.** Comms Probe, Mine!, Picking Up the Trail, Holographic Doubles and The Right Of All post the engine's Use card
   ("<item>: <label>" plus step lines) instead of their `E20.Tf1...` / `E20.Tf3...` lines; Mine!'s question is the
   engine's Use picker (rule labels as buttons, no prompt text); a cancelled False Data / Mine! / Trail roll posts no
   card. The `open` rolls carry the Perk's uuid (`itemUuid`), as every rule roll does.
8. **Comms Probe's window.** A probe made before the update (`tf1CommsProbe` scene flag) doesn't unlock False Data
   (transitional, one scene).
9. **Covering Fire, unstarted combat (re-checked, unchanged).** `combat:exists` alone doesn't fix slB3's difference 4:
   `endOfNextTurn` stamped in an unstarted combat gets no stamp and would never run out, so the split stays on `combat` /
   `not:combat`. Needs `endOfNextTurn` to stamp against the combat's start (see the engine list).

## Still skipped (81), plus the 2 partial remainders, and what each still needs

### tf1: combat (`combat.mjs`)
- **Brutal Display.** Recipients "the Defeated target's allies within 100 ft", a Defeated-target gate on a Use, a crit-scaled per-target Condition duration.
- **Make An Example.** Recipients "foes within 30 ft of the Defeated target", the Defeated-target gate, the per-hit crit Frightened.
- **Comms Assault.** A per-roll "ignore armor" Toughness mode, and enemies-within-100-ft targeting for a roll step.
- **Focused Blast.** An unscaled per-hit damage note from a switch, exclusive with the ↑1 (a DialogSwitch `damage` is scaled by Degrees of Success).
- **Steady Firepower.** Mark counters exist now, but the count must reset when the favorite weapon hits another target (unmark "everyone I marked" / a per-holder mark), and an outgoing Defense amount read from it.
- **Target-Rich Environment.** A step that rolls a picked owned weapon effect against every enemy in its range.
- **My Allies Are My Shield.** A per-attack Defense from `@count.allies.30` minus a mark counter, a Use gate comparing the two, and Movement +10 per trade only on speeds above 0.
- **Show Respect.** The pending → active per-turn hand-off and the pre-roll warning.

### tf1: support (`support.mjs`)
- **Feedback Field.** The chat line shows the holder's Willpower total; no step puts it into a var.
- **They Called It A Glitch!** Granting a picked Perk to another actor with an Active Effect, a "would drop maximum Health to 1 or lower" gate, and an undo removing both.
- **Flexible Switch.** `combat:exists` covers the gate now; still a two-item multi-pick and a tag comparing `system.altModeId` with the picks (ActionCost reads the pick).
- **Alt Mode Mimicry.** An Origin-aware chassis picker (size class, different Origins, count raised by Alt Mode Mastery). Effectively permanent code.
- **Drone (Origin).** That picker, plus steps writing actor data (base Movement, size) from the picked entry. Effectively permanent code.
- **Tox-En.** `essenceDamage` and `extendCondition` exist now; still a per-victim flat roll (`1d20 + 1d8`, `2d20kh` on touch) against each one's Toughness, and "extend by 10 in a combat, else apply for 10".
- **Solid-State Energon.** A two-number prompt with a remembered default, a branch on the comparison, and radius damage buttons. Effectively permanent code.

### tf1 partial remainders, fix3-tf
- **Fearsome Additions (Alt Mode ↑1).** A whole-word name match (`/\b(ram|slam|flyby)\b/i`); `item:name~` is a substring match.
- **Partnered (the partner pick).** `pick` writing `flags.essence20.partner` as `{uuid, name}` (or the ActionCost rule reading the pick) and "use the target if there is one".
- **Watchful Eyes.** Step `filter` exists now, but there is no target-side side tag (`target:enemy` - token disposition differs) to filter the targeted tokens with.

### tf2 (`rolls.mjs`, `uses.mjs`, `modes.mjs`)
- **Broad Understanding / Applied Science (2 items).** `combat:exists` covers "outside of combat"; still a one-roll lift consumed by any Science roll in combat (specialized or not) that both the specialize and the ↓2 read, and a limit max of 2 with Multiplication.
- **Cage (rolls and Use).** A rule on the captor applying to the marked prisoner's own rolls, a mark used up by one roll, and a Crew-rating capacity check.
- **Deconstruct (Snag and Use).** A rule for anyone rolling a marked item, `pick` over a target's items, a DIF from the picked item, a "Kit" name test.
- **Diversion.** A "same disposition anywhere on the scene" scope and a mark that changes (`attackedHolder`) instead of going away.
- **Duke It Out.** A "Standard action not used this turn" tag, a Use that pays after a `choose`, a level gate letting an unrated target through.
- **Sustained Beam.** A re-attack with the same weapon at the same target with Edge, and a "this is the follow-up" roll tag.
- **All Out Attack / Evasive Fighting (TF printings, 2 items).** A switch writing the rider stance, and telling the G.I. JOE printing apart.
- **Arrogant.** A roll-cancel rule over every target's Threat Level and area attacks.
- **Determine Probability.** A roll step through the full dialog with a picked Skill.
- **Energon Bank.** `gainResource` with `to` and no `.max` cap.
- **We Are One!** A team pick (up to ⌈Social/2⌉) with a linked Reroll grant for two picked Skills.
- **Mutant Beast.** A `pickGrant` over a picked Origin's child Alt Modes, and a "fewer than two Alt Modes" gate.
- **Roller Drum.** A megaform-component scope for DerivedStat.
- **Dust Up.** A Trigger event for moving on one's own turn.
- **For The Allspark! (Roll Out).** `setForm` into a picked Alt Mode, and Surprised / Mode Lock exception tags.
- **Not Like That, Like This!** `rerollCard` is Reaction-only and Reactions sit on check cards; this decorates any teammate's Skill Test card, rerolls all dice without keeping the better, and has the "owed" turn handling. Effectively permanent code.
- **Scramble Modulator.** Recipients "the hit Combiner's healthiest component(s)" and a Combiner-form tag.
- **Lingering Side Effects.** A Trigger for another item being added.

### tf3 (`rolls.mjs`, `uses.mjs`, `reactions.mjs`)
- **Intensive.** A Patch Up event with its amount.
- **Irrefutable Order.** A text-prompt step, spending another actor's Move action at its next turn start, a `target:levelDiff` gate on a Use.
- **Ladder.** A "same side anywhere in the world" scope, and an actor-Reach formula.
- **Last Stand.** The attacker as `defeated`'s target, an act-while-Defeated step, a whispered button card.
- **Martyr.** `combat:exists` + `until: combat` exist now, but "allies" are the combat's allied combatants (disposition, PC / non-PC off the canvas), recomputed live; a bank to `allies:<ft>` reaches canvas allies (with Frenemy / Betrayal) and misses later joiners. Needs an "allied combatants" recipient or scope.
- **No Escape.** A Trigger event for other tokens' movement, and a melee-Reach value.
- **Roll With It.** A push step (`pushActor`), and the attacker from `lastApplyContext`.
- **Stoic.** A Use storing a picked number for a Defense formula, a Toughness → Evasion swap, a next-turn action grant for allies.
- **Synch Up.** An attack-range value for the Reaction's `within` (measured to the row's target).
- **Target Breakdown.** `@` refs for Analyze Target counts, a repeated action cost, a bank naming one target.
- **Third Dimension.** A MovementAction option for movement after a change of type. Effectively permanent code.
- **Unassuming.** A tag for "every weapon effect is one-handed".
- **Unexpected Alternative.** Per-enemy memory of the Alt Modes they have seen. Effectively permanent code.
- **Whisper Campaign.** A contested-roll step.
- **Deceptive Warfare.** An Initiative-reset step.
- **One Bot Over Another.** A compendium-filtered multi-pick and a Qualification reading the picks.
- **Training Through Familiarity (Kit waiver).** A Kit-prerequisite rule type.
- **Rotor Blades (the rest).** An organic-creature tag for the +1 damage, a late derived stage for the Alt Mode Aerial.
- **Water Cannon (the rest).** A Hardpoints option lowering one weapon's slot use.

### other2
- **Pit Plate (Sharp half), Junkplate (Sharp half) (2 items).** A hit-time Blunt → Sharp override on the hit card.
- **Rust Derivatives.** A heal veto and a hit flag with that state.
- **Stasis Cuffs.** Pre-update vetoes and a tether with its own Health.
- **Grant His Hunger.** `essenceDamage` exists now, but needs a random Essence (it has `choose`, not random) and a step taking Energon from the target (resource steps act on the holder).
- **In His Image.** Picking and removing the target's Hang-Ups, a repeated compendium pick onto the target, a once-per-target flag, a DIF of Toughness minus armor.
- **Hearty Meal.** A rule adding Skills to a named action's skill list.
- **Stim Dart.** A Use limit counted by carried items, a range-dependent roll, a branch on the target's Defeated state.
- **Defibrillator.** A delayed step (finish after six rounds, cancelled when combat changes).
- **Support, Tech Support (2 items).** Granting a copy of a picked owned item to the target, attached to a weapon the ally picks.
- **Extended Support.** Changes Support's own cost and duration (Support stays code).
- **Laser Designator.** A mark carrying a roll modifier for every roller against the marked actor.
- **Yo Joe!** Round-number and action-ledger tags in derived data.
- **Bio-Tech Armor.** An equip-veto rule.
- **Big Rigger, Bigger Rigger (2 items).** Incoming roll modifiers through the `driven` link, and the size-matrix shift as a formula.
- **Gunport.** `host:` tags at roll time.
- **Delegate.** A step refunding a picked use record on another actor.
- **Explosive Engineer.** A rule clearing another dialog option's flag.
- **Frequency Interference.** Acting on a target's item state, a contested roll, a roll-cancel rule, a Defense removal.
- **Thorn Warlord.** A Defense "use instead" mode.
- **More Bang for your Buck.** A flat post-roll spell damage add.
- **Temper Tempest.** A persistent state with a turn-start card, and a button reading the presser's current targets.
- **Sorcery (Build a Sorcerous Power).** A builder dialog. Effectively permanent code.
- **Proper Protection (crit note).** Part of the Heal action's own text; no rule hook there.

## Edits outside my files
None needed. (Optional follow-up for whoever owns `module/dice.mjs`: Predacon's Frightened itself - dice.mjs's
`isPredaconAttempt` block - could become an `applyCondition` step in the new `hit` Trigger; not done here.)

## Unused strings
`E20.Tf1ProbeYes`, `E20.Tf1ProbeNo`, `E20.Tf1FalseData`, `E20.Tf1MinePrompt`, `E20.Tf1MineOpen`, `E20.Tf1MineSneak`,
`E20.Tf1MineSneaked`, `E20.Tf1MineGrabbed`, `E20.Tf1TrailPrompt`, `E20.Tf1TrailRolled`, `E20.Tf1EasyInEnds`,
`E20.Tf3HoloFull`, `E20.Tf3HoloMade`, `E20.Tf3GearWeaponMade`, `E20.Tf3RightOfAllFallen`, `E20.Tf3ToggleProtect`.

## Files touched
- Packs (rules inserted as text, CRLF kept): `dditems/_source/` Comms_Probe, False_Data, Mine_, Picking_Up_The_Trail,
  Loaded_Questions (new arrays), Easy_In__Easy_Out (appended); `tsitems/_source/Predacon` (appended);
  `tfcrbitems/_source/` Holographic_Doubles, The_Right_Of_All_Sentient_Beings (new arrays), Rotor_Blades,
  Tow_Cable___Hook, Water_Cannon (appended).
- Slices: `tf1/support.mjs`, `tf1/combat.mjs`, `tf1/common.mjs`, `tf1/tf1.test.js`, `fix3-tf/tf-fixes.mjs`,
  `fix3-tf/tf-fixes.test.js`, `tf3/rolls.mjs`, `tf3/reactions.mjs`, `tf3/uses.mjs`, `tf3/common.mjs`, `tf3/tf3.test.js`.
- New: `module/rules/conv4-slB4.test.js`, this file.

Verification: ESLint clean on the touched slices and the new test; `check-rules` 0 errors / 0 warnings; jest on the five
slice folders + `conv3-slB3.test.js` + `conv4-slB4.test.js`: 7 suites, 93 tests passed; `module/rules` as a whole: 25
suites, 1350 tests passed.

**Rules added: 24.**

## Engine pieces the remaining skips need (most useful first)
1. **Target-side side tags** (`target:enemy` / `target:ally`, by token disposition) for step `filter` - Watchful Eyes. Small.
2. **An "allied combatants" recipient / scope** (every combatant of the current combat on the holder's side, live) -
   Martyr; also helps Stoic's ally action grant. Small to medium.
3. **`endOfNextTurn` (and `nextTurn`) stamped in an unstarted combat** so they count from the combat's start - fixes
   Covering Fire's unstarted-combat difference. Small.
4. **A per-recipient flat roll step** (`rollEach {formula, vs: <Defense>}` with dice, `onHit` steps per recipient) plus
   `essenceDamage {essence: random}` and a target-side resource loss - Tox-En, Grant His Hunger, Comms Assault (with an
   ignore-armor option). Medium.
5. **Per-holder marks** (`perHolder: true`, or `unmark {to: "allMarkedByMe", except: target}`) and an **outgoing Defense
   amount formula** - Steady Firepower, My Allies Are My Shield (with a mark-counter gate), and Loaded Questions'
   multi-holder difference. Medium.
6. **A mark / bank consumed by the roll that reads it** (`consumeMark` on a RollModifier, specialize included) - Broad
   Understanding / Applied Science, Cage. Medium.
7. **Range / Reach formula refs** (`@self.attackRange`, `@self.meleeReach`, Reaction `within` to the row's target) -
   Synch Up, No Escape, Ladder's Reach x2. Small to medium.
8. **Multi-pick of owned / compendium items** (`pick {count: 2, distinct}`) and a `self:altMode:picked` tag - Flexible
   Switch, One Bot Over Another, Partnered (writing its flag path). Medium.
9. **Vetoes and hit-time overrides** (heal veto, equip veto, pre-update veto, hit card damage-type override) - Pit Plate,
   Junkplate, Rust Derivatives, Bio-Tech Armor, Stasis Cuffs. Medium.
10. **Contested-roll step** - Whisper Campaign, Frequency Interference, Mine!'s onlookers (still left to the table). Medium.
11. **Push step** (`pushActor`) and "the attacker" for damage Triggers - Roll With It, Last Stand. Small.
12. Effectively permanent code (bespoke UI or whole subsystems): Sorcery's builder, Alt Mode Mimicry / Drone Origin
    pickers, Not Like That Like This! (card decorator + owed turns), Solid-State Energon, Temper Tempest, Support / Tech
    Support / Extended Support / Delegate, Defibrillator, Deceptive Warfare (Initiative reset), Third Dimension (movement
    API), Unexpected Alternative (per-enemy memory), Show Respect, They Called It A Glitch!.
