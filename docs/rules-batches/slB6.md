# Batch slB6: re-check of slB5 (`tf1`, `tf2`, `tf3`, `fix3-tf`, `other2`) against the round-6 engine pieces

**Scope:** every item `docs/rules-batches/slB5.md` left Skipped (75), against "Engine features added 2026-10-06 (round 6,
after the local round-5 conversions)" in `docs/RULES_CONVERSION_GUIDE.md` (target:self, status:<id>:timed, wielding
compounds, upgrade-aware item:trait, item:hasUpgrade, rule:hostEquipped, combat:enemyStatus|allyStatus, @recipient,
nextTurnOrScene, worldTime:N, combatAllies, alliesOfTarget / enemiesOfTarget, mark exclusive, Movement afterDerived,
afterRoll @var.dif, open rolls reaching outcome "any", notDouble...) and the earlier sections. Also re-checked: slB5's
behaviour differences 2 (targeting yourself - Energon Bank, Grant His Hunger, Partnered) and 3 (Rotor Blades' Aerial
moved earlier), both now removed. Edited in place in the main checkout (no branch, no commit).

| Verdict (re-checked items) | tf1 + fix3-tf | tf2 | tf3 | other2 | Total |
|---|---|---|---|---|---|
| Convert (no slice code left) | 2 | 0 | 1 | 0 | **3** |
| Partial (more of it converted) | 0 | 0 | 0 | 0 | **0** |
| Still skip | 14 | 16 | 17 | 25 | **72** |
| Re-checked | 16 | 16 | 18 | 25 | **75** |
| Converted items fixed (slB5 differences) | 1 (Partnered) | 1 (Energon Bank) | 1 (Rotor Blades) | 1 (Grant His Hunger) | **4** |

**9 rules were added to 3 pack items** (all three get their first `rules` array), and 4 existing rule lines were
changed (Energon Bank and Grant His Hunger: a `require` step; Partnered: the two picks' `when`; Rotor Blades: the
Movement rule's stage and value). After this part `scripts/check-rules.mjs` counts 1848 rules on 1157 items, 0 errors.

## Converted

| Item | Rules | Why it is exact |
|---|---|---|
| Watchful Eyes (`tfcrbitems`) | Trigger `afterRoll`, outcome `success`, `when: [skill:alertness, var:dif=10]`: `target {min: 0}`, then two `bank` steps to `targets` with `filter: [target:enemy]` and `snag: true`, `appliesWhen: [not:roll:initiative, {any: [not:combat:exists, ownTurn]}]` - in a combat (`when: combat:exists`) `until: endOfNextTurn, untilOf: recipient`, out of one (`not:combat:exists`) `until: scene`. | The old pass (dice.mjs `isWatchfulEyesAttempt` = Alertness vs a flat DIF 10 + `tfFixPostRoll`) marked, on a success, every targeted token whose disposition differs from the roller's, until the end of that creature's next turn (`nextTurnWindow`) or, with no combat, for the scene; the Snag came off its first Skill Test made while it is the combatant whose turn it is (always out of combat), and was used up by it. Initiative never read extension roll sources (the bank would, hence `not:roll:initiative`). The label is the Perk's name, as before. |
| Martyr (`tfcrbitems`) | Trigger `defeated`, `when: [combat:exists]`: `bank {to: combatAllies, edge: true, uses: 1000, until: combat, appliesWhen: [not:roll:initiative]}` + a chat line. | `tf3AfterDamage` flagged the holder when it was Defeated (the same `newValue <= 0 && !wasAlreadyDefeated` the `defeated` event fires on) with any combat set up; `tf3RollSources` then gave every combatant on its side (`areAllies`: disposition, else PC or not - what `combatAllies` uses) an Edge on every roll for that combat, never used up, never on Initiative. |
| My Allies Are My Shield (`dditems`) | Defense `any`, `amount: max(0, @count.allies.30 - @mark.shieldTrade)`, `when: [{any: [defense:toughness, ...evasion, ...willpower, ...cleverness]}]` (per attack, the Stronger Together idiom); Use (Free, `when: combat:exists`): `table` of `@count.allies.30 - @mark.shieldTrade` with a "no bonus left" row + `require var:rolled>=1` (both `beforeCost`), `mark shieldTrade {count: 1, add: true, until: nextTurn}`, chat; four Movement rules (ground, aerial, swim, climb), `stage: afterDerived`, `op: add`, `10 * @mark.shieldTrade * min(1, ceil(max(0, <that speed's total>)))`, `when: self:marked:shieldTrade`; Trigger `turnStart` `when: self:data:flags.essence20.ruleMarks.shieldTrade` → `unmark`. | `tf1DefenseAdjust` added `max(0, allies within 30 - traded)` to whichever Defense was attacked (`getNearbyAllyTokens`, what `@count.allies` counts); the Use was offered with a combat set up, refused (nothing paid) once the trades reached the allies, paid a Free action and raised the trade count for that combat; `tf1Derived` added 10 per trade to each of those four speeds above 0; the holder's turn start cleared it (`nextTurn` ends there; the `turnStart` Trigger clears the flag so derived data is redone, as the old `unsetFlag` did). |

Re-checked converted items (the slB5 differences these pieces remove):
- **Energon Bank** (`tfcrbitems`) and **Grant His Hunger** (`dditems`): a `require {check: [not:target:self], message:
  "Target someone else."}` right after the `target` step (`beforeCost`) - targeting yourself stops it before anything
  is paid, as the old Uses refused it (slB5 difference 2).
- **Partnered** (`dditems`): the target pick needs `not:target:self`, the ally pick runs on
  `{any: [not:target:data:uuid, target:self]}` - with only yourself targeted the ally list opens, as before.
- **Rotor Blades** (`tfcrbitems`): the Alt Mode Aerial rule is `stage: afterDerived` (after the extensions' derived pass,
  where `tf3Derived` ran it). Its value adds My Allies Are My Shield's traded Movement to the Ground it halves -
  `floor((ground + 10 * @mark.shieldTrade * min(1, ceil(max(0, ground)))) / 2)` - because Aerial is worked out before
  Ground within a stage, while the old `tf1Derived` (registered before tf3) had already raised Ground; the trade isn't
  added to the new Aerial (add runs before max, on Aerial's value before the blades). slB5 difference 3 is gone.

Removed: `fix3-tf/tf-fixes.mjs` - `FIX3_TF`, `KIND.watchfulEyes`, the Watchful Eyes roll source, `tfFixPostRoll` and its
registration, `isEnemyToken`, `writeMark`, `isOwnTurn`, the `registerPostRoll` import; `tf1/combat.mjs` - the My Allies
Are My Shield Defense block, `SHIELD_FLAG`, `shieldTraded`, `tf1Derived` and its registration, the `tf1ShieldTrade` Use,
the turn-start unset, the `getNearbyAllyTokens` and `registerDerived` imports; `tf1/common.mjs` - `TF1.myAlliesAreMyShield`;
`tf3/rolls.mjs` - `MARTYR_FLAG`, `martyrs()`, the Martyr roll source; `tf3/reactions.mjs` - the Martyr block in
`tf3AfterDamage` and the `MARTYR_FLAG` import; `tf3/common.mjs` - `TF3.martyr`. Old tests changed: `tf-fixes.test.js`
(the Watchful Eyes describe removed), `tf1.test.js` (the trade test becomes "rules now"), `tf3.test.js` (the Martyr
source test removed; the Defeat test checks nothing is written).

New tests: `module/rules/conv6-slB6.test.js` (12 tests) - Watchful Eyes (enemies only, label, scene-long out of combat;
failure / other DIF / other Skill; in combat only on the enemy's turn, until the end of its next turn, never
Initiative), Martyr (allied combatants only, every roll, not Initiative, gone with the combat; nothing out of combat),
My Allies Are My Shield (+allies on every Defense, range; Free trade only in combat, Movement on speeds above 0, refused
with no bonus left, ends at the holder's next turn, mark cleared; two trades with Rotor Blades), Rotor Blades at
afterDerived, Energon Bank / Grant His Hunger / Partnered with yourself targeted.

## Behaviour differences worth a decision

All Transformers / Decepticon Directive.
1. **Watchful Eyes' trigger.** It reads the roll's DIF (`@var.dif`, the first result's), not the dataset's flat DIF: an
   Alertness roll against a target's Defense of exactly 10 would count too (the old check wanted a typed DIF 10).
   Off the canvas the enemy test is PC-or-not (the old one counted every targeted token as an enemy when the roller had
   no token). In a combat set up but not started, the Snag waits for the creature's turn once it starts (the old code
   compared with whatever `combat.combatant` was).
2. **Watchful Eyes / Martyr cards.** The Snag / Edge is a banked bonus listed by the item's name; the chat says
   "Banked ..." per creature. Marks set before the update (`fix3WatchfulEyes` rider marks, the `tf3Martyred` flag) are
   ignored (transitional - one scene / one combat).
3. **Martyr.** The allies are the combat's allied combatants when the Martyr falls; a creature joining the combat later
   doesn't get the Edge (the old source was read live at each roll). The Martyr no longer has to stay in the combat.
4. **My Allies Are My Shield.** "No bonus left" posts a small card instead of a warning. A trade made before the update
   (`tf1ShieldTrade` flag) is ignored (one turn). Two holders' trades don't interact (the mark is per actor).
5. **Rotor Blades' value** names My Allies Are My Shield's mark key (`shieldTrade`) so the pairing stays exact; without
   that Perk the mark is never set and the formula is plain half-Ground.

## Still skipped (72), and what each still needs

### tf1: combat (`combat.mjs`)
- **Brutal Display.** A roll step against every recipient's Defense (a card with a row each - `alliesOfTarget` gives the recipients, `filter: [target:within:100]` the holder-measured range, hit Triggers `double` / `plainSuccess` the 10- / 1-round Frightened); the old roll measured from the holder, `alliesOfTarget` from the target.
- **Make An Example.** The same multi-target roll vs Willpower (`enemiesOfTarget:30` gives the foes), plus Stun 1 damage buttons per hit.
- **Comms Assault.** The same multi-target roll vs Toughness with an "ignore armor" mode.
- **Focused Blast.** An unscaled per-hit damage note from a switch, exclusive with the ↑1 (the old select).
- **Steady Firepower.** A target count in afterRoll Triggers (the old count resets when the favorite weapon attacks 0 or 2+ targets); the rest - outgoing Defense `-@target.mark.steadyFire` with `markedByMe`, `mark {count, add, exclusive, until: scene}`, a clearing Trigger for other weapons - is expressible now.
- **Target-Rich Environment.** A step rolling a picked owned weapon effect against every enemy in its range.
- **Show Respect.** The pending → active per-turn hand-off and the pre-roll warning.

### tf1: support (`support.mjs`)
- **They Called It A Glitch!** Granting a picked Perk to another actor with an Active Effect, a "max Health would drop to 1" gate, an undo removing both. Effectively permanent code.
- **Flexible Switch.** A two-item distinct multi-pick and a tag comparing `system.altModeId` with the picks.
- **Alt Mode Mimicry.** An Origin-aware chassis picker. Effectively permanent code.
- **Drone (Origin).** That picker plus writing base Movement / size from the picked entry. Effectively permanent code.
- **Tox-En.** A per-recipient flat roll (`1d20 + 1d8`, `2d20kh` on touch) against each one's Toughness (the formula dice can't keep-highest, and a step rolls once for the run).
- **Solid-State Energon.** A two-number prompt with a remembered default and radius damage buttons. Effectively permanent code.

### tf1 / fix3-tf remainders
- **Fearsome Additions (Alt Mode ↑1).** A whole-word name match (`/\b(ram|slam|flyby)\b/i`); `item:name~` is a substring match.

### tf2 (`rolls.mjs`, `uses.mjs`, `modes.mjs`)
- **Cage (rolls and Use).** A rule on the captor applying to the marked prisoner's own rolls, a mark flag used up by one roll, a Crew-rating capacity check.
- **Deconstruct (Snag and Use).** A rule for anyone rolling a marked item, `pick` over a target's items, a DIF from the picked item, a "Kit" name test.
- **Diversion.** The allies' Edge reaches "same disposition anywhere on the scene" and stops once the diverted creature went for the diverter; `endOfNextRound` has no out-of-combat (scene) form.
- **Duke It Out.** A "Standard action not used this turn" tag, a Use that pays after a `choose`, the accepted duel's contested roll.
- **Sustained Beam.** A re-attack with the same weapon at the same target with Edge, and a "this is the follow-up" roll tag.
- **All Out Attack / Evasive Fighting (TF printings, 2 items).** A number switch writing the rider stance, and telling the G.I. JOE printing apart.
- **Arrogant.** A roll-cancel rule over every target's Threat Level and area attacks.
- **We Are One!** A team multi-pick (up to ⌈Social/2⌉) with a linked Reroll grant for two picked Skills.
- **Mutant Beast.** A pick over compendium Origins, then over that Origin's child Alt Modes; a "fewer than two Alt Modes" gate.
- **Roller Drum.** A megaform-component scope for DerivedStat.
- **Dust Up.** A Trigger event for moving on one's own turn.
- **For The Allspark! (Roll Out).** `setForm` into a picked Alt Mode, and Surprised / Mode Lock exception tags on `initiativeRolled`.
- **Not Like That, Like This!** Decorates any teammate's Skill Test card, rerolls all dice without keeping the better, "owed" turn handling. Effectively permanent code.
- **Scramble Modulator.** Recipients "the hit Combiner's healthiest component(s)" and a Combiner-form tag.
- **Lingering Side Effects.** A Trigger for another item (an Alt Mode) being added.

### tf3 (`rolls.mjs`, `uses.mjs`, `reactions.mjs`)
- **Intensive.** A Patch Up event with its amount.
- **Irrefutable Order.** A text-prompt step, spending another actor's Move action at its next turn start, a `target:levelDiff` gate before the cost.
- **Ladder.** A "same side anywhere in the world" scope (`team` is PCs only) with a holder-vs-roller size tag; a Reach formula (`actorReach` by size) for the Bot Mode Reach.
- **Last Stand.** An act-while-Defeated step and a whispered button card.
- **No Escape.** A Trigger event for other tokens' movement, and a melee-Reach value.
- **Roll With It.** A push step (`pushActor` away from the damage source), with a once-per-turn button.
- **Stoic.** A Defense "use Evasion instead of Toughness" mode (`best` keeps the better), and a next-turn Free-action grant (`grantActions` is this turn) for the `combatAllies`.
- **Synch Up.** An attack-range value for the Reaction's `within` (measured to the row's target).
- **Target Breakdown.** `@` refs for Analyze Target counts per target, a repeated action cost, a bank naming one target.
- **Third Dimension.** A MovementAction option for movement after a change of type. Effectively permanent code.
- **Unassuming.** A tag for "every weapon effect is one-handed" in a Qualification.
- **Unexpected Alternative.** Per-enemy memory of the Alt Modes they have seen. Effectively permanent code.
- **Whisper Campaign.** A contested-roll step.
- **Deceptive Warfare.** An Initiative re-roll step keeping the higher. Effectively permanent code.
- **One Bot Over Another.** A compendium-filtered multi-pick and a Qualification reading the picks.
- **Training Through Familiarity (Kit waiver).** A Kit-prerequisite rule type.
- **Water Cannon (the rest).** A Hardpoints option lowering one weapon's slot use.

### other2
- **Pit Plate (Sharp half), Junkplate (Sharp half) (2 items).** A hit-time Blunt → Sharp override on the hit card (crit repeat included).
- **Rust Derivatives.** A heal veto and a hit flag with that state.
- **Stasis Cuffs.** Pre-update vetoes and a tether with its own Health.
- **In His Image.** Picking and removing the target's Hang-Ups, a repeated compendium pick onto the target, a once-per-target flag, a DIF of Toughness minus armor.
- **Hearty Meal.** A rule adding Skills to a named action's skill list.
- **Stim Dart.** A Use limit counted by carried items, a range-dependent roll, a branch on the target's Defeated state.
- **Defibrillator.** A delayed step (finish after six rounds, cancelled when combat changes). Effectively permanent code.
- **Support, Tech Support (2 items).** Granting a copy of a picked owned item to the target, attached to a weapon the ally picks. Effectively permanent code.
- **Extended Support.** Changes Support's own cost and duration (Support stays code).
- **Laser Designator.** A roll modifier for every roller (any side, NPCs too) against an actor the holder marked; `team` reaches PCs only.
- **Yo Joe!** An action-ledger tag ("no Standard action spent yet this turn") in derived data (`combat:round:1` exists).
- **Bio-Tech Armor.** An equip-veto rule.
- **Big Rigger, Bigger Rigger (2 items).** Incoming roll modifiers through the `driven` link, and the size-matrix shift as a formula.
- **Gunport.** `host:` tags at roll time (the rule item's host has the Shield trait); the shield-type half is `rule:hostEquipped` + `downshift: "@host.system.active"`, but a Shield-trait host can't be told apart.
- **Delegate.** A step refunding a picked use record on another actor. Effectively permanent code.
- **Explosive Engineer.** A rule clearing another dialog option's flag.
- **Frequency Interference.** Acting on a target's item state, a contested roll, a roll-cancel rule, a Defense removal.
- **Thorn Warlord.** A Defense "use instead" mode.
- **More Bang for your Buck.** A flat post-roll spell damage add (not scaled).
- **Temper Tempest.** A persistent state with a turn-start card, and a button reading the presser's current targets. Effectively permanent code.
- **Sorcery (Build a Sorcerous Power).** A builder dialog. Effectively permanent code.
- **Proper Protection (crit note).** Part of the Heal action's own text; no rule hook there.

## Edits outside my files

1. `module/dice.mjs` - Watchful Eyes is a rule now; nothing reads `isWatchfulEyesAttempt` any more. Remove the comment
   block starting `    // Watchful Eyes (Strategist Focus, 6th level, p.68): "make a DIF 10 Alertness Skill Test... On`
   through `      && actorHasPerk(actor, WATCHFUL_EYES_ID);` (plus one adjacent blank line), the line
   `        isWatchfulEyesAttempt,` in the `_rollSkillHelper` checkContext literal, and the constant line
   `const WATCHFUL_EYES_ID = \`${TF_CRB}RmHSzuVLnIoqeczy\`;`.
2. `module/dice.test.js` - in `describe("Stunning Surprise / Watchful Eyes - checkContext flags ...")`: delete the two
   tests `"Watchful Eyes flags isWatchfulEyesAttempt on an Alertness roll vs a flat DIF 10 with the Perk"` and
   `"Watchful Eyes doesn't flag without the Perk, a matching DIF, or an Alertness roll"`, and the line
   `      const WATCHFUL_EYES_ID = "Compendium.essence20.tf_crb.Item.RmHSzuVLnIoqeczy";`.
3. `module/rules/conv5-slB5.test.js` (slB5's own test, Rotor Blades' Aerial now at `afterDerived`) - in the test
   `'Alt Mode: Aerial Movement of half the Ground Movement (after gravity), never lowering it'` replace every
   `'afterGravity'` with `'afterDerived'` (4 lines) and the title's "(after gravity)" with "(after derived data)". Until
   then that one test fails; the same checks pass in `conv6-slB6.test.js`.

## Unused strings
`E20.Tf1ShieldNoBonus`, `E20.Tf1ShieldTraded`, `E20.Tf3MartyrFell`, `E20.Tf3MartyrSource`.

## Files touched
- Packs (rules inserted as text, CRLF kept): `tfcrbitems/_source/` Watchful_Eyes, Martyr (new arrays), Energon_Bank,
  Rotor_Blades (lines changed); `dditems/_source/` My_Allies_Are_My_Shield (new array), Grant_His_Hunger, Partnered
  (lines changed).
- Slices: `fix3-tf/tf-fixes.mjs`, `fix3-tf/tf-fixes.test.js`, `tf1/combat.mjs`, `tf1/common.mjs`, `tf1/tf1.test.js`,
  `tf3/rolls.mjs`, `tf3/reactions.mjs`, `tf3/common.mjs`, `tf3/tf3.test.js`.
- New: `module/rules/conv6-slB6.test.js`, this file.

Verification: ESLint clean on the five slice folders and the new test; `check-rules` 1848 rules / 1157 items, 0 errors;
jest on the five slice folders + `conv3-slB3` / `conv4-slB4` / `conv6-slB6` and `conversions` / `engine*`: all pass.
`module/rules` + `module/helpers/extensions` as a whole: 72 of 74 suites pass - `conv5-slB5.test.js` (the one Rotor Blades
stage test, edit 3 above) and `zord2/zord2.test.js` (another part's slice).

**Rules added: 9** (plus 4 existing rule lines changed).

## Engine pieces the remaining skips need (most useful first)
1. **A roll step against every recipient's Defense** (`roll {skill, defense: willpower, to: <recipients>}` posting one
   card with a row per creature, so hit Triggers / `double` / `plainSuccess` apply per row; `ignoreArmor` for Toughness) -
   Brutal Display, Make An Example, Comms Assault, Target-Rich Environment (with a picked attack), Tox-En (with a flat
   formula). Medium.
2. **A target count in afterRoll Triggers** (`@var.targets` from the `target` step, or `roll:targets=1`) - Steady
   Firepower (everything else it needs exists). Small.
3. **A RollModifier reaching a marked actor's own rolls / rolls against it by anyone** (a `marked:<key>` scope) -
   Cage, Laser Designator, Diversion (with a second "went for the diverter" mark), Deconstruct (with item marks). Medium.
4. **Defense "use instead" mode and a next-turn action grant** (`mode: use, from: evasion`; `grantActions {nextTurn: true}`)
   - Stoic, Thorn Warlord. Small to medium.
5. **`host:` tags at roll time** (the rule item's host, not only in prerequisites) - Gunport. Small.
6. **Range / Reach refs** (`@self.attackRange`, `@self.meleeReach`, an `actorReach` by size) and a Reaction `within`
   measured to the row's target - Synch Up, No Escape, Ladder. Small to medium.
7. **Action-ledger tags** (`self:actionUsed:standard`) and spending another actor's action at its next turn - Duke It
   Out, Yo Joe!, Irrefutable Order. Small.
8. **Multi-pick** (`pick {count: 2, distinct}`, compendium-filtered picks) and a `self:altMode:picked:<key>` tag -
   Flexible Switch, One Bot Over Another, Mutant Beast, We Are One!. Medium.
9. **Vetoes and hit-time overrides** (heal / equip / pre-update vetoes, a hit-card damage-type override, an `updateActor`
   option a veto lets through) - Pit Plate, Junkplate, Rust Derivatives, Bio-Tech Armor, Stasis Cuffs, Grant His Hunger's
   slB5 difference 1. Medium.
10. **Contested-roll step** - Whisper Campaign, Frequency Interference, Duke It Out's duel. Medium.
11. **Push step** (`pushActor` away from the damage source) - Roll With It; an act-while-Defeated step for Last Stand. Small.
12. **Item-count formula refs** (`@count.items.<tag>`) for limits - Stim Dart (plus a range-dependent roll). Small.
13. **A whole-word name tag** (`item:word:<text>`) - Fearsome Additions. Small.
14. Effectively permanent code (bespoke UI or whole subsystems): Sorcery's builder, Alt Mode Mimicry / Drone Origin
    pickers, Not Like That Like This!, Solid-State Energon, Temper Tempest, Support / Tech Support / Extended Support /
    Delegate, Defibrillator, Deceptive Warfare (Initiative re-roll), Third Dimension (movement API), Unexpected
    Alternative (per-enemy memory), Show Respect, They Called It A Glitch!.
