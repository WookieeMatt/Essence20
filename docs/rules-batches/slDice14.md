# Batch slDice14: round 14, part "dice" - module/dice.mjs's compendium-id code moved onto item rules

**Scope:** the 89 "convert" items of the dice survey (`survey/result-dice.json`: uuid constants in `module/dice.mjs`
lines ~17-2300, and everything that used them in dice.mjs, `mechanics/resources/banked-buffs.mjs`, the roll dialog and
the item helper files). Edited in place in the shared checkout (no commit).

**Result:** **78 converted** (the hand-written code and its id constant gone), **11 not converted** (explained below).
**100 rules** added on 79 pack files (Terrifying has two printings). 5 small engine pieces. `scripts/check-rules.mjs`:
2996 rules on 1749 items, 0 errors. `module/rules/conv14-dice.test.js`: 56 tests. Full jest suite: 469 suites / 9118
tests, all passing (after the last fix in `documents/actor.test.js`).

## Engine features added 2026-10-06 (round 14, dice)

- **DialogSwitch `noDamage: true`** (`rules/types.mjs`, `rules/adapter.mjs#applyRuleSwitches` -> `options.ruleNoDamage`):
  ticked, the attack forgoes its damage - dice.mjs's `ruleForgoDamage` zeroes `checkContext.damageValue` and drops the
  secondary damage, so the card has no damage, no Critical damage options (the old "forgo damage to ..." checkboxes:
  Guardian Strikes, Stick In The Spokes, Interdiction). A switch with only `noDamage` is valid.
- **A spending switch's `steps` see `@spent`** (`adapter.mjs#applyRuleSwitches` puts the amount in the steps' vars) -
  Caution To The Wind banks `0 - @spent` on its Defenses.
- **Post-roll Trigger facts** (`rules/triggers.mjs` registerPostRoll): the roll context of afterRoll / hit / miss /
  targeted Triggers now carries `defenseType` (checkContext.defenseType - the Defense the roll was compared against, the
  first target's resolved one; `defense:` tags read it) and `rollDamageType` (checkContext.damageType - the card's damage
  type after every override, a spell's or synthetic test's too).
  **Tag `roll:damageType:<type>`** (`rules/plugins/tags/roll-damage-type-tag.mjs`) reads it; null outside a posted roll.
  (No existing rule used `defense:` in those events, so nothing else changed.)
- **Tag `roll:autoDownshift`** (`rules/plugins/tags/roll-auto-downshift-tag.mjs`): the system's automatic modifiers put a
  ↓ on this roll - dice.mjs hands `autoShiftDown: combatModifiers.shiftDown` to `extDialogToggles` and `runApplyDialog`
  (so a switch gated on it is both offered and applied). Null where nobody said.
- **Recipient `crewedVehicle`** (`rules/plugins/zords/crewed-vehicle-recipient.mjs`): the vehicle / Zord the actor crews,
  any seat (zord-crew-lookups#crewing - the world scan `_getPilotedVehicle(actor)` made with no role).
- **HitMultiplier `stage: "card"`** (`rules/plugins/combat/card-hit-multiplier.mjs#applyCardHitMultipliers`, called by
  dice.mjs `_rollSkillHelper` right after `_applyImmovableObjectImmunity`): the row's damage is multiplied (no note) while
  the card is built - before the post-pass flat adds and every hit rider, where the hand-written "double / triple damage
  against X" Perks multiplied. `when` sees the roll's item, Skill, melee / ranged, switches and damage type, self = the
  roller, target = the row's target; one book item's rule once per row. `megaform-finisher.mjs#hitMultiplierOnAttack`
  skips `stage: card` rules.

Tests: in `module/rules/conv14-dice.test.js` (the tag, recipient, multiplier and switch tests).

## Verdicts

| Item | Verdict |
|---|---|
| Hobble, Guardian Strikes, Stick In The Spokes, Interdiction, Dirty Blows | converted |
| Leech Siphons, Ice Flechettes Effect, Ice Flechettes Alternate Effect, Avalanche Stomp Effect | converted |
| Stunning Surprise, Knock Down Drag Out, Catch Off Guard, Snarl, Might Makes Right, Ice Machine | converted |
| Brute Force Works Best, Shock and Awe, Nowhere is Safe, Inundation, Block Magic, Menacing Glare | converted |
| The Tough Get Going, Power Filter, Now I'm Angry | converted |
| Try Try Again, Arashikage Graduate (bug fixed), Supportive Friend x3, Support Yourself, Stylish Strike | converted |
| You Can Do It Too, But I Should Know That, Instinctual Caster | converted |
| Fluttery Wings, Lightning Speed, Summon Armor, Summon Shield, Don't-Notice-Me-Field, Disguise | converted |
| Hot to Trot, Greased Lightning, Mystery Sense, Glittermane, Ookie Spookies, Foolscarrot, Sparkle Blast | converted |
| Outfoxed, Growing Smolder, Cunning Plan, Solo Shot, Emergency Care Equipment, Vehicle Repair Equipment | converted |
| Informed Accuracy, Caution To The Wind, Don't Underestimate Me, Straight Shooter, Pythonized | converted |
| Combat Exoskeleton, Terrifying, Inventor, Burly, Saber-Toothed, "Pseudo"-Science, Ricochet | converted |
| Alpha Strike, Demolition Driver, Basic Intelligence, Orange Ranger Prime, Disrupter, Balance of Justice | converted |
| Without a Word, Bulked Up Frame, Roadside Assistant, Plate Piercing, Raze And Ruin, Augmented, Iron Bravado | converted |
| Undo Engine, Drilling Shot, Analyze Target, Bleed 'Em Dry, Ambitious, Energon Efficiency, Pack Mule | not converted |
| Dispersion, Angry, Growl, Violent | not converted |

## Converted

- **Hobble** - DialogSwitch (key `hobble`, ↓2, ranged attacks) + hit Trigger: choose Immobilized / Prone / Restrained
  (untimed).
- **Guardian Strikes** - DialogSwitch `noDamage` (two-handed melee) + hit Trigger: choose Impaired / Prone / Restrained.
- **Stick In The Spokes** - DialogSwitch `noDamage`, once per encounter (blade / bludgeon against a vehicle of no higher
  level); hit x2 -> Defeated, otherwise (not Defeated) the `stickInTheSpokesInoperable` flag.
- **Interdiction** - DialogSwitch `noDamage`, once per encounter, against a lower-level target; hit -> Defeated.
- **Dirty Blows** - DialogSwitch (melee) + hit -> Impaired 1 round.
- **Leech Siphons** - hit x2 with its own weapon (`item:onHost`): target -1 Energon if it has any, wielder +1 (uncapped).
- **Ice Flechettes Effect / Alternate Effect** - hit x2 with the effect itself -> Armor Stripped 1 round.
  **Avalanche Stomp Effect** - hit x2 -> Prone.
- **Stunning Surprise** - hit on an attack against a Surprised target or while Invisible -> Stun 1 (damage step).
  **Knock Down, Drag Out** - same, with Stunning Surprise held and 3+ levels down -> Unconscious 1 round.
- **Catch Off Guard** - hit on an attack against a target that hasn't acted (`target:notActed`) -> Stun 1.
- **Snarl** - hit on Intimidation -> Frightened 1 round. **Might Makes Right** - hit x2 on Persuasion -> Frightened.
- **Ice Machine** - hit with `roll:damageType:cold` on a Stunned target -> Immobilized.
- **Brute Force Works Best** - hit (blade / bludgeon on a vehicle) -> bank Snag + ↓1 on the target's next roll.
  **Shock and Awe** - hit with an explosive attack -> bank a Snag on the target's next roll.
- **Nowhere is Safe** - HitRider +1 (Multiple Targets weapon, target not in Total Cover) + hit Trigger stepping the
  target's cover down (Total Cover -> Cover, Cover -> none).
- **Inundation** - hit on an Outwit roll -> per-setter mark `outwitted`; RollModifier Edge on Deception / Intimidation
  against a target carrying it. `items/defenses/anonymous-upgrade.mjs` reads the mark (its test updated).
- **Block Magic** - hit with the spell -> the target's `blockMagicActive` scene flag (markWindow).
- **Menacing Glare** - DialogSwitch (Intimidation, 1 Personal Power) + hit Trigger: choose Snag (banked on them) / Edge
  (per-setter mark, used up by the holder's next roll against them) / Frightened.
- **The Tough Get Going** - targeted Trigger (a missed roll against its Toughness, once per round) -> mark
  `toughGetGoing` until the round ends; `items/movement/the-tough-get-going.mjs#isTheToughGetGoingActive` reads the mark
  (the actor.mjs Ground doubling and check:theToughGetGoing are unchanged).
- **Power Filter** - targeted Trigger (Toughness, Energy, hit or miss) -> the driver +1 Personal Power up to max.
- **Now I'm Angry** - targeted Trigger outcome crit on a damaging hit -> bank +1 damage for the next attack.
- **Try, Try Again** - afterRoll allFailed -> bank ↑1 on the next roll of that Skill. **Arashikage Graduate** - afterRoll
  allFailed, once per scene -> bank ↓1 on the next roll.
- **Supportive Friend / Extra / Super** - afterRoll (some row succeeded) on the Empathy-chosen Skill, the highest tier
  held: allies within 60 ft bank ↑1 / ↑2 (GrantDouble offered) / Edge. **Support Yourself** - the same three tiers banked
  on the holder.
- **Stylish Strike** - afterRoll x2 on a melee attack -> every ally loses Frightened / Impaired / Mesmerized.
- **You Can Do It, Too!** - afterRoll x2 -> every ally banks ↑1 until the holder's next turn.
- **But I Should Know That** - afterRoll anyFailed Spellcasting -> bank a Snag. **Instinctual Caster** - afterRoll
  anyFailed with a spell -> bank ↓1 on the next Spellcasting.
- **Buff spells** - the cast hook moved onto each spell (afterRoll success with `item:own`; Block Magic a hit Trigger),
  setting the same Scene Clock flag its reader asks (markWindow scene - the record activateForWindow wrote): Fluttery
  Wings, Lightning Speed, Disguise, Hot to Trot, Greased Lightning, Foolscarrot (the first target, else the caster);
  Mystery Sense, Glittermane, Ookie Spookies (the caster); Don't-Notice-Me-Field (Invisible + its flag). The readers
  (actor.mjs movement, dice.mjs shifts, condition immunity) are flag-named, no compendium id, and stay. Summon Armor
  (mark `summonArmor` for the scene) / Summon Shield (through the end of the next round in a started combat, else the
  scene) - `items/magic/summon-armor.mjs` reads the mark. Sparkle Blast - Blinded 3 rounds on the user's targets (never
  the caster), else the enemies within 30 ft. The `apply*` helpers are gone (sparkle-blast.mjs deleted).
- **Outfoxed** - miss on Infiltration -> per-setter mark `outfoxed` on the target; marked RollModifier Edge on that
  creature's next roll against the holder (uses the mark up).
- **Growing Smolder** - Use: a counter mark (1, or +1 up to 3 while its bank is pending) and one replaced bank of ↑N /
  +N damage for the next attack.
- **Cunning Plan** - DialogSwitch useSkill `roleSkillDie`, 1 Personal Power. **"Pseudo"-Science** - Use (not while
  active) -> `pseudoScienceActive` mission flag; DialogSwitch useSkill Science while it's on.
- **Solo Shot** - DialogSwitch clearSnag, 1 Personal Power, ranged with the Quantum Defender Blaster.
- **Emergency Care / Vehicle Repair Equipment** - RollModifier `immune: [downshift]` on Science (Medicine) / Technology
  (Repair) in Bot Mode.
- **Informed Accuracy** - RollModifier ↑`@targetKeyed.flags.essence20.analyzeTargetCounts` on attacks.
- **Caution To The Wind** - DialogSwitch spend 0-3: ↑ now, and a replaced bank of -N to every Defense for the next
  attack against the holder.
- **Don't Underestimate Me** - incoming RollModifier Snag, once per scene (counted on the holder), unless the holder is
  Surprised or the roller Invisible.
- **Straight Shooter** - DialogSwitch ↑1, once per turn, ballistic attack with an automatic ↓ (`roll:autoDownshift`).
- **Pythonized** - DialogSwitch Edge on Infiltration (only unattached). **Inventor** - DialogSwitch Edge + ignoreDownshift 1.
- **Combat Exoskeleton** - RollModifier ↑1 on Brawn and melee attacks. **Burly** - RollModifier ↑1 on Animal Handling /
  Intimidation / Persuasion, no armor above light, not crewing, not with Rolling Thunder (dice.mjs's shared block now
  handles Rolling Thunder only, Burly's ↑1 included).
- **Terrifying** - RollModifier ↑1 on Intimidation while fitted to equipped armor and its bank isn't pending; the GI Joe
  printing's Use banks ↑1 for the next Intimidation (BANKABLE_PERKS entry gone).
- **Saber-Toothed** - DialogSwitch ↓1 on an unarmed attack + DamageType Sharp while ticked.
- **Ricochet** - DialogSwitch ↓1 / +1 damage, once per turn, with the Favorite Weapon.
- **Alpha Strike** - DialogSwitch Edge (Might, or Targeting with the GI Joe shotgun / SMG), marking the holder for the
  round while a combat exists; incoming RollModifier Edge on attacks against it while marked.
- **Demolition Driver** - DialogSwitch (scope driven) spend 0-3: ↓N and +N damage on the vehicle's Ram.
- **Basic Intelligence** - DieSubstitution floor d2 + clearSnag on an untrained roll.
- **Orange Ranger Prime** - late incoming RollModifier Snag on attacks against Cleverness (out of PRIME_DEFENSE_SNAG_PERKS)
  + Use once per encounter: +2d2 Personal Power (uncapped, as before).
- **Disrupter** - RollModifier Edge on Initiative while an enemy combatant is higher level.
- **Ninja Powered: Balance of Justice** - beforeRoll Trigger (a Zord's weapon attack) marks the first target for the
  round (in a combat); markedTarget RollModifier Edge on attacks against it.
- **Without a Word** - Defense +1 (addAfter) in a combat while some enemy token is Frightened / Mesmerized / Surprised.
- **Bulked Up Frame** - Defense Toughness +Brawn Ranks (addAfter) with no armor equipped.
- **Roadside Assistant** - initiativeRolling Trigger, once per encounter, while crewing -> the vehicle +1 Bonus Health.
- **Plate Piercing** - HitMultiplier x2 (card stage) explosive vs a vehicle. **Raze And Ruin** - x3 vs a Huge+ vehicle,
  x2 vs a Huge+ Immobilized creature (not melee).
- **Augmented** (Hang-Up) - Defense halve when the rolled item deals the chosen damage type.
- **Iron Bravado** (self half) - beforeRoll Trigger on a weapon attack marks the holder (through the next round in a
  combat, until a combat starts out of one) + ConditionImmunity Frightened while marked. The shared-immunity Use stays code.

## Bugs fixed (user-approved)

- **Try, Try Again / Arashikage Graduate** banked on rolls with no DIF (the old `results.every(...)` was true for an
  empty result list). The rules use outcome `allFailed`, which needs at least one result.

## Code vs notes - needs a ruling

Behaviour converted is the code's in each case.
- **Interdiction**: notes / book "once per combat scene"; code used the encounter window.
- **Ice Flechettes Effect x2 / Avalanche Stomp Effect**: notes say the Critical rider is left to the table; the code
  applied it.
- **Catch Off Guard**: notes say "Surprised"; the code uses the turn-order proxy (hasn't acted yet).
- **Might Makes Right**: notes say the card "offers" Frightened; the code applied it.
- **Growing Smolder**: notes say once per turn; the code had no limit.
- **Orange Ranger Prime**: notes say once per scene; the code used the encounter window.

## Behaviour differences worth a decision

1. **Ordering at roll time**: rule effects apply at the dialog hooks / rules' Defense adjust, not exactly where the
   hand-written line sat:
   - Without a Word / Bulked Up Frame (addAfter) land after Roll With the Punches' doubling ((D+1)x2 became Dx2+1).
   - Augmented halves inside the rules' Defense adjust, before the addAfter rules (old halved them too).
   - Emergency Care / Vehicle Repair: ↓ added later in rollSkill (Observer's Snag->↓2, Worth A Shot / Kind But Firm
     deltas) now survive.
   - Orange Ranger Prime's late Snag is set before Observer's checkbox (Observer can now clear it).
   - Saber-Toothed's Sharp lands after Blazing Strikes / Void Warrior / Cryogenic Touch / Ninja Power (cross-line only).
   - Nowhere is Safe's +1 is a labelled note among the hit riders (old: unlabelled, end of the post-pass).
2. **Banks vs the old pending flags**: the old `pendingX` flags went stale when a new combat began; banks don't
   (Supportive Friend tiers, Caution To The Wind, You Can Do It Too...). Two different Supportive Friend granters' banks
   now both apply (old: one shared flag, overwritten). Now I'm Angry's bank is used by the next attack even without a
   target (old waited for an attack with a card).
3. **Marks vs one-slot flags**: Outfoxed, Menacing Glare's Edge keep one mark per target (old: one slot per actor).
4. **Equipment rules run while equipped / host equipped**: Leech Siphons (on an unequipped weapon), Emergency Care /
   Vehicle Repair gear (old: merely owned). Terrifying / Burly read any equipped armor (old: the first one).
5. **Weapon identity by `weapon:id:`** (Alpha Strike, Solo Shot): any printing with that _id (old: the exact uuid).
6. **Catch Off Guard** per hit target's own turn order (old: the first target decided for every hit).
7. **Basic Intelligence**: a floor keeps a die another substitution improved, and then keeps the Snag (old forced d2
   and cleared it).
8. **Duration edges**: The Tough Get Going / Summon Shield / Iron Bravado / Balance of Justice in a combat that exists
   but hasn't started; The Tough Get Going out of combat lasts the scene (old: until a combat began).
9. **Damage step on a target the user doesn't own** posts "for the GM" (old: applyDamage, which failed for a non-owner);
   conditions / flags on non-owned targets go through the GM relay now.
10. **Roadside Assistant** fires at the Initiative roll's extension point (initiativeRolling), Disrupter's sides fall
    back to PC-vs-not without tokens, Sparkle Blast with the caster as the first of several targets blinds the
    nearby enemies instead.
11. **Small edges**: Stick In The Spokes no longer flags a vehicle that is already Defeated; Straight Shooter's
    `weapon:trait` also counts upgrade-added traits; Shock and Awe and Debilitating Strike no longer share one flag
    (Snags don't stack, so the roll is the same).

## Not converted (11), and why

- **Undo Engine** - the driver's own dialog Driving Test (another actor's roll) whose failure stalls the *vehicle* with
  a restart card; `rollAs` makes the driver the target and loses the vehicle. Needs a piece.
- **Drilling Shot** - the code replaces the Difficulty mid-way with the bare Defense (dropping shield upgrade,
  deflective and Fighting Style terms); Defense ignoreArmor subtracts only the armor share from the final number.
- **Analyze Target** - its checkbox spends the Standard action through the action economy (Quick / Swift Study lower it)
  and cancels the roll when it can't be paid; a DialogSwitch can do neither. Its counter flag stays (Informed Accuracy's
  rule, anonymous-upgrade.mjs and @targetKeyed read it).
- **Bleed 'Em Dry** - rides inside Crippling Blow's still-code checkbox (no switch key to read).
- **Ambitious** - clears Snag / ↓ at the very end of rollSkill's post-dialog chain (after Observer and the Prime Snags);
  rule switches apply earlier.
- **Energon Efficiency** - only the Roll Options Dialog Energon spend; a resourceSpent Trigger would answer every spend.
- **Pack Mule** - its window is whole rounds r..r+2 (combat only); `rounds:3` ends at the same point in round r+3. Needs
  a "through the end of round +N" duration.
- **Dispersion** - a real `system.resistances` entry is also read by Ninja Powered: Deep Wisdom and the sheet (wider than
  the Resistance Snag).
- **Angry** - its Hang-Up's Skill pick writes the scene-window flag check:angrySnag reads; needs a step storing a picked
  value in a Scene Clock flag (or check:angrySnag reading a pick). Note: dice.mjs's `pendingAngrySnag` read is dead code.
- **Growl** - Get The Horns (still code) reads Growl's `growl` roll source and re-banks its flag; convert them together.
- **Violent** - "every no-↓ attack of the weapon deals no Health damage" (NON_DAMAGE_EFFECT_TYPES over the stored
  entries) has no tag; a small `weapon:` tag piece would make it exact.

Not in this part (data verdicts): the Beam spells' / KoC Fireball's damage fields are still dice.mjs synthetic damage.

## Shared-file edits

- `module/dice.mjs` - every removed constant / block above; `ruleForgoDamage`; `applyCardHitMultipliers` call (replacing
  `_applyPlatePiercingVehicleDamage` / `_applyRazeAndRuinDamage`, removed with `_applyNowhereIsSafe`,
  `_isAlphaStrikeAttack`, `_isDemolitionDriverAttack`, `_isUnawareOfAttacker`); `autoShiftDown` passed to
  extDialogToggles / runApplyDialog; Rolling Thunder-only block; unused imports / constants dropped.
- `module/dice.test.js` - the removed items' tests and expected-dataset lines; Quantum Cut / Ranger Prime / Rumble /
  Multiple Targets / Summon Armor shared tests edited.
- `module/mechanics/resources/banked-buffs.mjs` (+ test) - Growing Smolder, Terrifying, "Pseudo"-Science, Orange Ranger
  Prime, Hobble / Guardian Strikes pickers removed; canUsePerk tests use Hard Target.
- `module/apps/roll-options-dialog.mjs`, `module/mechanics/rolls/roll-dialog.mjs`, `templates/dialog/roll-dialog.hbs` -
  the removed checkboxes / number boxes.
- `module/rules/types.mjs` (DialogSwitch noDamage), `module/rules/adapter.mjs` (noDamage, @spent in switch steps),
  `module/rules/triggers.mjs` (defenseType / rollDamageType facts), `module/rules/plugins/index.mjs` (4 imports at the
  end), `module/rules/plugins/zords/megaform-finisher.mjs` (skip stage card).
- `module/mechanics/combat/condition-immunity.mjs` (+ test) - Iron Bravado's checkFn entry.
- `module/items/defenses/anonymous-upgrade.mjs`, `module/items/tests/anonymous-alterations-implied-conditions.test.js`
  - Inundation's mark.
- `module/items/movement/the-tough-get-going.mjs` (+ test, rewritten), `module/documents/actor.test.js` (its movement
  test uses the mark), `module/items/magic/*.mjs` (+ tests: apply helpers removed, summon-armor reads the mark).
- Deleted: `items/healing/stylish-strike.mjs`, `items/attacks/growing-smolder.mjs`, `items/attacks/brute-force-works-best.mjs`,
  `items/rolls/pseudo-science.mjs`, `items/social/menacing-glare.mjs`, `items/magic/sparkle-blast.mjs`,
  `items/defenses/iron-bravado.mjs` (and their tests).
- New: `rules/plugins/tags/roll-damage-type-tag.mjs`, `rules/plugins/tags/roll-auto-downshift-tag.mjs`,
  `rules/plugins/zords/crewed-vehicle-recipient.mjs`, `rules/plugins/combat/card-hit-multiplier.mjs`,
  `rules/conv14-dice.test.js`.

## Unused strings

E20.HobblePickConditionTitle, E20.HobblePickConditionLabel, E20.GuardianStrikesPickConditionTitle,
E20.GuardianStrikesPickConditionLabel, E20.RollDialogHobble, E20.RollDialogGuardianStrikes,
E20.RollDialogStickInTheSpokes, E20.RollDialogInterdiction, E20.RollDialogDirtyBlows, E20.GrowingSmolderActivated,
E20.RollDialogAlphaStrike, E20.RollDialogCunningPlan, E20.RollDialogSoloShot, E20.RollDialogSpendCautionToTheWind,
E20.RollDialogStraightShooter, E20.RollDialogPythonized, E20.RollDialogInventor, E20.RollDialogSaberToothed,
E20.RollDialogPseudoScience, E20.RollDialogRicochet, E20.RollDialogSpendDemolitionDriver,
E20.OrangeRangerPrimeUnavailable, E20.MenacingGlarePickEffectTitle, E20.MenacingGlarePickEffectLabel,
E20.MenacingGlareSnag, E20.MenacingGlareEdge, E20.MenacingGlareFrightened, E20.RollDialogMenacingGlare.

No new strings (`<scratchpad>/r14/lang-dice.json` is `{"RulesExtDice": {}}`).

## Rule count

100 rules added on 79 pack files (78 items).
