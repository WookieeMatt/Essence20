# Batch slB7: re-check of slB6 (`tf1`, `tf2`, `tf3`, `fix3-tf`, `other2`) against the round-7 engine pieces

**Scope:** every item `docs/rules-batches/slB6.md` left Skipped (72), against "Engine features added 2026-10-06 (round 7,
after the local round-6 conversions)" in `docs/RULES_CONVERSION_GUIDE.md` (roll:targets / @var.targets, host: at roll
time, self:actionUsed, item:word, item:hasAttack, @count.items, combatant tags, pick / choose additions, button whisper...)
and the earlier sections. Also re-checked: slB6's five behaviour differences (none of them can be removed with the new
pieces - see the end of "Behaviour differences"). Edited in place in the main checkout (no branch, no commit).

| Verdict (re-checked items) | tf1 + fix3-tf | tf2 | tf3 | other2 | Total |
|---|---|---|---|---|---|
| Convert (no slice code left) | 2 | 1 | 1 | 1 | **5** |
| Partial (more of it converted) | 0 | 0 | 0 | 0 | **0** |
| Still skip | 12 | 15 | 16 | 24 | **67** |
| Re-checked | 14 | 16 | 17 | 25 | **72** |

**8 rules were added to 5 pack items** (Steady Firepower, Duke It Out, Gunport and Unassuming get their first `rules`
array; Fearsome Additions gets a second rule). After this part `scripts/check-rules.mjs` counts 1893 rules on 1177 items,
0 errors (the totals include the other parts' work this round).

## Converted

| Item | Rules | Why it is exact |
|---|---|---|
| Steady Firepower (`dditems`) | Defense `any`, `outgoing: true`, `amount: 0 - @target.mark.steadyFire`, `when: [markedByMe:steadyFire, check:favoriteWeaponRolled]`; Trigger `afterRoll` `when: [attack, not:attack:unarmed, check:favoriteWeaponRolled, roll:targets=1]`: `target {min: 0}`, `mark steadyFire {to: target, count: 1, add: true, exclusive: true, until: scene}`; Trigger `afterRoll` `when: [attack, not:attack:unarmed, {any: [not:check:favoriteWeaponRolled, not:roll:targets=1]}]`: `mark steadyFire {to: self, exclusive: true, filter: [not:target:self]}` (marks nobody, so the exclusive pass just takes the holder's mark off whoever had it). | `tf1DefenseAdjust` lowered any Defense of the one creature on the holder's record by its count, for an attack with an effect of the Favorite Weapon (`weaponOfEffect` = what `check:favoriteWeaponRolled` asks), in the same scene. `tf1CombatPostRoll` ran after every roll whose rider had a `weaponId` (an attack with a weapon - `not:attack:unarmed`): the favorite weapon at exactly one target (`hits` = `@var.targets` / `roll:targets`) raised the count when it was the same target this scene, else started at 1 on the new one; any other weapon, or 0 / 2+ targets, cleared it. No-target rolls never reached it (no results), and they don't reach a Trigger without `outcome: any` either. |
| Fearsome Additions, Alt Mode half (`dditems`) | RollModifier ↑1 `when: [self:transformed, item:type:weaponEffect, {any: [item:data:system.isRam, item:data:system.isFlyby, item:word:ram, item:word:slam, item:word:flyby]}]` (beside the existing Bot Mode Intimidation rule). | `tf1CombatSources` gave the same ↑1 source, labelled with the item's name, in Alt Mode to a weapon effect with `isRam` / `isFlyby` or the whole word ram / slam / flyby in its name (`/\b(ram\|slam\|flyby)\b/i` - `item:word:` is the same whole-word, case-insensitive test). The item is now fully rules. |
| Duke It Out (`tfcrbitems`) | Use (Free, `limit: {per: encounter}`), all gates `beforeCost`: `target`; two `table` steps setting `@var.rolled` = `min(1, theirs) * (my level - theirs)` (theirs = `@target.system.level`, for a vehicle `@target.system.threatLevel`, with `when: [not:target:type:vehicle]` / `[target:type:vehicle]`) whose 1..1000 row says "Target a creature of your level or higher." and stops the run; `require [{any: [not:combat:exists, not:self:actionUsed:standard]}]`; `pick duel from list` (Accept / Refuse - the old button labels); then `mark dukeRefused {to: target, until: nextTurnOrScene, when: [var:picked=refuse]}` and a chat line per answer. RollModifier `edge: true` `when: [markedByMe:dukeRefused]`, label "Duke It Out". | The old Use: no target - stop; `theirs = Number(level ?? threatLevel) \|\| 0`, refused when `theirs && theirs < my level` (an NPC's `system.level`, as before - not its Threat Level; a vehicle has no level so its Threat Level; no level at all is allowed: that is the `min(1, theirs)` factor); with a combat set up, refused once the ledger shows a Standard action (`getLedger` = `self:actionUsed`); then the accept / refuse question, the Free action, the once-per-encounter mark (`scene-clock` `encounter` = `limit.per: encounter`); a refusal marked the target until the start of the holder's next turn (scene out of combat - `nextTurnOrScene`), and the holder's rolls with that creature targeted got an Edge labelled with the Perk's name. A cancelled question paid nothing and used nothing. |
| Unassuming, Qualification half (`tfcrbitems`) | Qualification `access: qualified`, `items: [item:type:weapon, item:data:system.availability=limited, item:hasAttack:item:type:weaponEffect, not:item:hasAttack:item:data:system.numHands>=0&item:data:system.numHands!=1]`. | `tf3Access` answered `qualified` for a weapon whose own `system.availability` is `limited` (not the effective tier - hence `item:data:`, not `item:availability=`) with at least one attack and every attack's `numHands` `'1'`, a missing one counting as `'1'` (the `>=0` half is false for a missing value, so only a listed, non-1 hand count fails it); owned attacks first, else the stored entries - exactly `item:hasAttack`'s reading. Same `essence20.requisitionAccess` hook, keeps the widest answer. The Perk's ↑1 Active Effect is untouched. |
| Gunport (`iafav2items`) | RollModifier ↓1, `stack: gunport`, `when: [attack:ranged, weapon:data:system.classification.size=sidearm, rule:hostEquipped, {any: [host:type:shield, host:trait:shield]}, {any: [not:host:type:shield, host:data:system.active]}]`. | `firingThroughGunport` + the `o2Gunport` source: a ranged attack (`ctx.isAttack && !ctx.isMelee`) with a sidearm weapon while some Gunport sits on an equipped host that is either a shield switched active, or a non-shield with the Shield trait - the two `any` lists are that (shield → active; not a shield → trait). Several Gunports gave one ↓1 (`some`); the stack group keeps one. The upgrade's rules are off while its host is unequipped, as the old `equipped` test. |

Removed: `tf1/combat.mjs` - `tf1CombatSources`, `isRamLike` and the `registerRollSources` registration, the Steady Firepower
section (`STEADY_FLAG`, `tf1DefenseAdjust` and its registration), the Steady Firepower block in `tf1CombatPostRoll`, the
`getSceneEpoch`, `itemOf`, `weaponOfEffect` and `registerRollSources` imports; `tf1/common.mjs` - `TF1.fearsomeAdditions`,
`TF1.steadyFirepower`, `weaponOfEffect`; `tf2/uses.mjs` - the `tf2DukeItOut` Use, its doc lines, the `getUses` / `markUsed`
and `untilStartOfNextTurn` imports; `tf2/rolls.mjs` - `MARK.dukeRefused`, `untilStartOfNextTurn`, the Duke It Out source;
`tf2/common.mjs` - `TF2.dukeItOut`; `tf3/reactions.mjs` - `weaponEffectsOf`, `isOneHanded` and the Unassuming branch of
`tf3Access`; `tf3/common.mjs` - `TF3.unassuming`; `other2/gij.mjs` - the Gunport source, `firingThroughGunport`,
`O2_GIJ.gunport`. Old tests changed: `tf1.test.js` (the Fearsome Additions and Steady Firepower tests become "rules now";
the My Allies Are My Shield test no longer calls the removed `tf1DefenseAdjust`), `tf2.test.js` (new "Duke It Out is rules
now"), `tf3.test.js` (the Unassuming test becomes "nothing from this slice"), `other2.test.js` (the Gunport test becomes
"rule on the upgrade now").

New tests: `module/rules/conv7-slB7.test.js` (14 tests) - Fearsome Additions (Ram / Flyby flags, whole words, not
"Slammer", Bot Mode half unchanged), Steady Firepower (count per further attack, every Defense, other target / weapon /
attacker; reset by another weapon, 0 or 2 targets, not by an unarmed attack; moving target; scene-long), Gunport (active
shield only, melee / non-sidearm / unequipped host, two Gunports, Shield-trait battledress), Duke It Out (refuse → Edge
for the challenger only, once per encounter, scene / next-turn duration, accept, level gates incl. NPC Level and vehicle
Threat Level, Standard action spent, cancel / no target cost nothing), Unassuming (stored and owned attacks, missing
hands, 0 / 2 hands, mixed, other tiers).

## Behaviour differences worth a decision

1. **Steady Firepower - one count per creature.** The mark lives on the attacked creature under one key: two Steady
   Firepower holders working on the same creature share it (the second one's `add` builds on the first one's count and
   takes the mark over). The old record was per holder. A count written before the update (`tf1SteadyFire` flag) is
   ignored (transitional - one scene). The target is read from the user's targets when the Trigger runs, which is the
   roll's target in practice.
2. **Duke It Out - cards and picker.** "Too low", "Standard action spent" and "no target" now post a small card (and the
   target step's warning) instead of only a warning; the accept / refuse question is a select rather than two buttons,
   the card notes the pick, and the answer is remembered on the item (unused - it asks every time). Two Duke It Out holders
   refused by the same creature share one mark (the last one wins). Refusal marks set before the update (`riderMarks`
   `tf2DukeRefused`) are ignored (transitional - until the next turn / scene).
3. **Gunport - traits and label.** `host:trait:shield` also sees a Shield trait that another upgrade on the host adds (the
   old test read the host's own trait list only). The source is labelled "Gunport" (the rule label) rather than the
   upgrade's own name - the same unless renamed.
4. **Fearsome Additions - word boundaries.** `item:word:` treats any non-letter/digit as a break, so an underscore now
   separates words (`/\b/` did not). The slB round's same-line notes still hold (only while the gear is equipped).
5. **Unassuming - null hands.** A `numHands` of `null` now counts as not one-handed (the old `?? '1'` read it as one);
   the data model never stores null and no pack entry has it.
6. slB6's differences (Watchful Eyes reading `@var.dif` and the PC-or-not side test, Martyr's combat allies fixed when it
   falls, My Allies Are My Shield's card, Rotor Blades naming `shieldTrade`) all stand: afterRoll Triggers still get no
   roll dataset (Watchful Eyes would need `roll:dataset:dif=10` there), and nothing new reads a live combat roster.

## Still skipped (67), and what each still needs

### tf1: combat (`combat.mjs`)
- **Brutal Display.** A roll step against every recipient's Defense (one card, a row each, hit Triggers per row).
- **Make An Example.** The same multi-target roll vs Willpower, plus Stun 1 damage buttons per hit.
- **Comms Assault.** The same multi-target roll vs Toughness with an "ignore armor" mode.
- **Focused Blast.** An unscaled per-hit damage note from a switch, exclusive with the ↑1 (the old select).
- **Target-Rich Environment.** A step rolling a picked owned weapon effect against every enemy in its range.
- **Show Respect.** The pending → active per-turn hand-off and the pre-roll warning.

### tf1: support (`support.mjs`)
- **They Called It A Glitch!** Granting a picked Perk to another actor with an Active Effect, a max-Health gate, an undo. Effectively permanent code.
- **Flexible Switch.** A two-item distinct multi-pick and a tag comparing `system.altModeId` with the picks.
- **Alt Mode Mimicry.** An Origin-aware chassis picker. Effectively permanent code.
- **Drone (Origin).** That picker plus writing base Movement / size from the picked entry. Effectively permanent code.
- **Tox-En.** A per-recipient flat roll (`1d20 + 1d8`, keep-highest on touch) against each one's Toughness.
- **Solid-State Energon.** A two-number prompt with a remembered default and radius damage buttons. Effectively permanent code.

### tf2 (`rolls.mjs`, `uses.mjs`, `modes.mjs`)
- **Cage (rolls and Use).** A rule on the captor reaching the marked prisoner's own rolls, a mark used up by one roll, a Crew-rating capacity check.
- **Deconstruct (Snag and Use).** A rule for anyone rolling a marked item, a pick over a target's items, a DIF from the picked item.
- **Diversion.** The allies' Edge reaches "same disposition anywhere" and stops once the diverted creature went for the diverter.
- **Sustained Beam.** A re-attack with the same weapon at the same target with Edge, and a "this is the follow-up" roll tag.
- **All Out Attack / Evasive Fighting (TF printings, 2 items).** A number switch writing the rider stance.
- **Arrogant.** A roll-cancel rule over every target's Threat Level and area attacks.
- **We Are One!** A team multi-pick (up to ⌈Social/2⌉; `pick from: team` takes one) with a linked Reroll grant for two picked Skills.
- **Mutant Beast.** A pick over compendium Origins, then over that Origin's child Alt Modes.
- **Roller Drum.** A megaform-component scope for DerivedStat.
- **Dust Up.** A Trigger event for moving on one's own turn.
- **For The Allspark! (Roll Out).** `setForm` into a picked Alt Mode, Surprised / Mode Lock exception tags on `initiativeRolled`.
- **Not Like That, Like This!** Decorates a teammate's Skill Test card, rerolls all dice, "owed" turns. Effectively permanent code.
- **Scramble Modulator.** Recipients "the hit Combiner's healthiest component(s)" and a Combiner-form tag.
- **Lingering Side Effects.** A Trigger for another item (an Alt Mode) being added.

### tf3 (`rolls.mjs`, `uses.mjs`, `reactions.mjs`)
- **Intensive.** A Patch Up event with its amount.
- **Irrefutable Order.** A text-prompt step and spending another actor's Move action at its next turn start.
- **Ladder.** A "same side anywhere in the world" scope with a holder-vs-roller size tag; an `actorReach` formula for the Bot Mode Reach.
- **Last Stand.** An act-while-Defeated step (the Story Point stamp + `grantActions` a full turn); the whispered button exists now.
- **No Escape.** A Trigger event for other tokens' movement, and a melee-Reach value.
- **Roll With It.** A push step (`pushActor` away from the damage source) on a once-per-turn button.
- **Stoic.** A Defense "use Evasion instead of Toughness" mode, and a next-turn Free-action grant for the `combatAllies`.
- **Synch Up.** An attack-range value for the Reaction's `within` (measured to the row's target).
- **Target Breakdown.** `@` refs for Analyze Target counts per target, a repeated action cost, a bank naming one target.
- **Third Dimension.** A MovementAction option for movement after a change of type. Effectively permanent code.
- **Unexpected Alternative.** Per-enemy memory of the Alt Modes they have seen. Effectively permanent code.
- **Whisper Campaign.** A contested-roll step.
- **Deceptive Warfare.** An Initiative re-roll step keeping the higher. Effectively permanent code.
- **One Bot Over Another.** A compendium-filtered multi-pick and a Qualification reading the picks.
- **Training Through Familiarity (Kit waiver).** A Kit-prerequisite rule type.
- **Water Cannon (the rest).** A Hardpoints option lowering one weapon's slot use.

### other2
- **Pit Plate (Sharp half), Junkplate (Sharp half) (2 items).** A hit-time Blunt → Sharp override on the hit card.
- **Rust Derivatives.** A heal veto and a hit flag with that state.
- **Stasis Cuffs.** Pre-update vetoes and a tether with its own Health.
- **In His Image.** Picking and removing the target's Hang-Ups, a repeated compendium pick onto the target, a DIF of Toughness minus armor.
- **Hearty Meal.** A rule adding Skills to a named action's skill list.
- **Stim Dart.** A use limit counted by carried items of a NAME (`@count.items` counts a type), a range branch (roll only beyond 5 ft), a Defeated branch healing through I've Got You.
- **Defibrillator.** A delayed step (finish after six rounds). Effectively permanent code.
- **Support, Tech Support (2 items).** Granting a copy of a picked owned item to the target, on a weapon the ally picks. Effectively permanent code.
- **Extended Support.** Changes Support's own cost and duration (Support stays code).
- **Laser Designator.** A roll modifier for every roller (any side) against an actor the holder marked.
- **Yo Joe!** `self:actionUsed:standard` exists now, but there is no "is a combatant" tag (a non-combatant would get the +10 in round 1); the +10 must land before Shark's Fin's afterDerived doubling (`afterDerived` add runs after multiply - 70 instead of 80); and derived data must be redone when the ledger / round changes (the slice resets the actor on `updateCombat` / `updateCombatant`).
- **Bio-Tech Armor.** An equip-veto rule.
- **Big Rigger, Bigger Rigger (2 items).** Incoming roll modifiers through the `driven` link, and the size-matrix shift as a formula.
- **Delegate.** A step refunding a picked use record on another actor. Effectively permanent code.
- **Explosive Engineer.** A rule clearing another dialog option's flag.
- **Frequency Interference.** Acting on a target's item state, a contested roll, a roll-cancel rule, a Defense removal.
- **Thorn Warlord.** A Defense "use instead" mode.
- **More Bang for your Buck.** A flat post-roll spell damage add (not scaled).
- **Temper Tempest.** A persistent state with a turn-start card, and a button reading the presser's targets. Effectively permanent code.
- **Sorcery (Build a Sorcerous Power).** A builder dialog. Effectively permanent code.
- **Proper Protection (crit note).** Part of the Heal action's own text; no rule hook there.

## Edits outside my files

None.

## Unused strings
`E20.Tf2DukeTooLow`, `E20.Tf2DukeStandardUsed`, `E20.Tf2DukePrompt`, `E20.Tf2DukeRefused`, `E20.Tf2DukeAccepted`
(`E20.Tf2DukeAccept` / `E20.Tf2DukeRefuse` are now the pick's option labels).

## Files touched
- Packs (rules inserted as text, CRLF kept): `dditems/_source/` Steady_Firepower, Fearsome_Additions; `tfcrbitems/_source/`
  Duke_It_Out, Unassuming; `iafav2items/_source/` Gunport.
- Slices: `tf1/combat.mjs`, `tf1/common.mjs`, `tf1/tf1.test.js`, `tf2/uses.mjs`, `tf2/rolls.mjs`, `tf2/common.mjs`,
  `tf2/tf2.test.js`, `tf3/reactions.mjs`, `tf3/common.mjs`, `tf3/tf3.test.js`, `other2/gij.mjs`, `other2/other2.test.js`.
- New: `module/rules/conv7-slB7.test.js`, this file.

Verification: ESLint clean on the five slice folders and the new test; `check-rules` 1893 rules / 1177 items, 0 errors;
jest on the five slice folders + `conv3-slB3` .. `conv7-slB7`: 10 suites, 133 tests pass. `module/rules` +
`module/helpers/extensions` as a whole: 79 of 80 suites pass - the one failure is `conversions.test.js`'s Bookworm test
(an Initiative rule on Bookworm, another part's item).

**Rules added: 8.**

## Engine pieces the remaining skips need (most useful first)
1. **A roll step against every recipient's Defense** (`roll {skill, defense, to: <recipients>}`, one card with a row per
   creature so hit Triggers / `double` / `plainSuccess` apply per row; `ignoreArmor`; a flat formula / picked attack
   variant) - Brutal Display, Make An Example, Comms Assault, Target-Rich Environment, Tox-En. Medium.
2. **A RollModifier reaching a marked actor's own rolls / rolls against it by anyone** (a `marked:<key>` scope) - Cage,
   Laser Designator, Diversion (with a "went for the diverter" mark), Deconstruct (with item marks). Medium.
3. **Defense "use instead" mode and a next-turn action grant** (`mode: use, from: evasion`; `grantActions {nextTurn: true}`)
   - Stoic, Thorn Warlord. Small to medium.
4. **Contested-roll step** - Whisper Campaign, Frequency Interference (and Duke It Out's accepted duel, which was never
   automated). Medium.
5. **Range / Reach refs and other-token movement** (`@self.attackRange`, `@self.meleeReach`, `actorReach` by size, a
   Reaction `within` measured to the row's target, a `tokenMoved` watch event) - Synch Up, No Escape, Ladder. Small to medium.
6. **A combatant tag + derived refresh on combat changes** (`self:combatant`, re-preparing holders when the round or the
   ledger moves, and a Movement stage before the hand-written derived doublings) - Yo Joe!. Small.
7. **Multi-pick** (`pick {count, distinct}`, compendium-filtered picks, a pick-dependent Qualification, a team multi-pick)
   - Flexible Switch, One Bot Over Another, Mutant Beast, We Are One!. Medium.
8. **Vetoes and hit-time overrides** (heal / equip / pre-update vetoes, a hit-card damage-type override) - Pit Plate,
   Junkplate, Rust Derivatives, Bio-Tech Armor, Stasis Cuffs. Medium.
9. **Push and act-while-Defeated steps** (`pushActor` away from the damage source; the Defeated-acting stamp + full-turn
   grant) - Roll With It, Last Stand. Small.
10. **Name-counted formula refs and heal-through-helpers** (`@count.named.<text>`, a `heal` that runs I've Got You / Up And
    At 'Em) - Stim Dart (with a `target:within:5` step branch, which exists). Small.
11. **A per-action skill-list rule and a dialog-option clear** - Hearty Meal, Explosive Engineer. Small.
12. **Events: own-turn movement, item added (other item), Patch Up amount** - Dust Up, Lingering Side Effects, Intensive. Small each.
13. Effectively permanent code (bespoke UI or whole subsystems): Sorcery's builder, Alt Mode Mimicry / Drone Origin
    pickers, Not Like That Like This!, Solid-State Energon, Temper Tempest, Support / Tech Support / Extended Support /
    Delegate, Defibrillator, Deceptive Warfare (Initiative re-roll), Third Dimension (movement API), Unexpected
    Alternative (per-enemy memory), Show Respect, They Called It A Glitch!.
