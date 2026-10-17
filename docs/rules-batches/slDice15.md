# Batch slDice15: round 15, part "dice" - the dice survey's engine pieces, and the items they unblock

**Scope:** every "piece" entry of the dice survey (`survey/result-dice.json`, 102 items - hand-written Perk code in
`module/dice.mjs` and its helper files) plus the 11 items round 14 left unconverted (`slDice14.md`). Edited in place in
the shared checkout (no commit).

**Result:** of the 102 survey items **91 converted** (Unlucky (For You)'s Terror half is another slice's), **1 partial**
(Fighting Style), **10 still code** (reasons below). Of round 14's 11: **6 converted** (Drilling Shot, Ambitious, Energon
Efficiency, Pack Mule, Violent, plus Bleed 'Em Dry - already a rule of Crippling Blow's), **5 still code**. **130 rules**
added on 97 pack files (and the two Spoof switches got `key: "spoof"`). About 35 engine pieces. `scripts/check-rules.mjs`: 3825
rules on 2284 items, 0 errors. Tests: `module/rules/conv15-dice.test.js` 85, `module/rules/engine15-dice.test.js` 14.

## Engine features added 2026-10-07 (round 15, dice)

Story Points and Skills
- **Step `grantStoryPoint {count?, pool?, optional?}`** (`rules/plugins/resources/grant-story-point.mjs`): adds `count`
  (default 1) Story Points through `mechanics/resources/story-points.mjs#requestStoryPointGrant` (the owner writes, anyone
  else relays to the GM). `pool`: `story` (default, the team's), `gm`, or `actor` (the actor's own - the GM's for a
  Threat). With nobody able to write the pool the run stops quietly (so a limit isn't spent) unless `optional: true`.
- **Rule type `FumbleStoryPoints {amount}`** (same file): dice.mjs's core "a Fumble adds a Story Point" adds `amount`
  instead of 1 while `when` holds (the biggest amount wins).
- **Rule type `SkillEssence {essence}`** (`rules/plugins/rolls/skill-essence.mjs`): the rolled Skill counts as that
  Essence's for the roll (dice.mjs's rolledEssence).
- **Rule type `EdgeOrShift {upshift}`** (`rules/plugins/rolls/edge-or-shift.mjs`): an Edge - or, when the roll already has
  an Edge from elsewhere, `upshift` ↑ instead (Expert in Your Field).
- **Rule type `EnergonSpendBonus {upshift, limit?}`** (`rules/plugins/rolls/energon-spend-bonus.mjs`): the dialog's "spend
  1 Energon for ↑1" gives `upshift` more; the limit is spent only when it applies. **Trigger event `rollEnergonSpent`**
  (same file): after that spend is paid from the actor's own pool; `@var.before` is the pool before it.
- **`initiativeRolling` sees the Initiative roll's switches** (`rules/plugins/rolls/initiative.mjs`): the ticked switch
  keys reach `roll:switch:<key>` there ("Friendly" Fire after Spoof).

Attacks: bare hands, ranges, targets
- **Tags `attack:barehanded`, `self:holdingWeapon` / `target:holdingWeapon`, `roll:dealsDamage`**
  (`rules/plugins/tags/barehanded-tags.mjs`; `UNARMED_WEAPON_IDS` lives here now, dice.mjs imports it).
- **Range facts** (`rules/plugins/tags/range-facts.mjs`): `roll:rangeBand:normal|long`, `roll:longRangeSnagIgnored`,
  `roll:elevationAbove:<op>N` (dice.mjs's ranged block puts them on the dataset); **rule type `WeaponRange {add}`**.
- **Checks `inAppraisedArea`, `attackedByAlly`** (`rules/plugins/tags/dice-checks.mjs`, helpers loaded at setup).
- **Target tags** (`rules/plugins/tags/dice-target-tags.mjs`): `target:statusFrom:<id>` (a Condition this actor applied),
  `target:resistsRolled`, `target:immuneRolled`, `target:nearby:<ft>:<tags&tags>`, `target:mostConditions`,
  `skill:roleSkill`, `holder:versusTarget:<self tag>`; **recipient `to: nearestEnemies:<n>`** - the n enemy tokens
  nearest the actor, any range, nearest first (Beam Volley's `PreCast` `setTargets`).
- **Refs** (`rules/plugins/tags/dice-refs.mjs`): `@sneakAttack`, `@hardenedArmor`, `@volleyShots`, `@vehicle.size` /
  `@vehicle.<path>` (the crewed vehicle); tags `roll:skillNoBetterThan:<skill>`, `self:uuidIsVar:<key>` (the run's
  `@var.<key>` is this actor's uuid). **rollSeen's `@var.assistedBy`** (`rules/plugins/tags/world-watch.mjs`): the uuid
  of the assister whose Lend Assistance ↑ the seen roll used (Misled).
- **Tags `item:healthDamage` / `weapon:primariesNoDamage`** (`rules/plugins/tags/violent-tags.mjs`, which holds
  `NON_DAMAGE_EFFECT_TYPES`): the rolled effect deals Health damage; its weapon's no-↓ effects deal none (Violent).
- **Rule type `SizeMatrix {attackerSteps}`** (`rules/plugins/combat/size-matrix-steps.mjs`): the attacker counts N steps
  bigger for the Size Class shift only. **Rule type `DataBridgeBonus {max}`** (`rules/plugins/combat/data-bridge-bonus.mjs`).

The Skill die
- **Die facts** (`rules/plugins/rolls/die-facts.mjs`): tags `roll:baseDie:<die>` and `roll:finalDie:<op><die>` (`<=d4`,
  `>=d8`, `=d6` - by quality); DialogSwitch `noCrit: true` and `capDie: "d12"`; rule types `FumbleRange {upTo}`,
  `DownshiftCap {max}`, `BonusPoolDie {skill}` (a Skill's die joins the kept-highest pool).
- **Rule type `DownshiftCancel {amount, stack?, limit?}`** (`rules/plugins/rolls/downshift-cancel.mjs`): ↓ off the stacked
  total before the dialog.
- **Rule type `Multiplier {doubleMargin | critMultiplier | promote, limit?}`** (`rules/plugins/rolls/degree-multiplier.mjs`):
  the rows' Degrees of Success.
- **Rule type `CritDowngrade {prompt, steps?}`** (`rules/plugins/rolls/crit-downgrade.mjs`): when the dice show a Critical
  Success the roller is asked `prompt`; yes, and the roll is a plain success (every row capped at x1), and `steps` run
  once the card is done (Consistent: bank ↑1).

Roll Options Dialog
- **DialogSwitch `syntheticDamage {value, type}`** (`rules/plugins/dialog/switch-synthetic-damage.mjs`): a Skill Test
  against a Defense carries that damage on its card.
- **DialogSwitch `sneakAttackMultiplier`** and tags `self:activeRolePoints:<tags&>`, `roll:rolePointsDamage[:own]`
  (`rules/plugins/rolls/role-points-damage.mjs`).
- **DialogSwitch `tradeUpshifts: N`** with `spend: {max}` (`rules/plugins/rolls/upshift-trade.mjs`): the ↑ entered are
  traded off the roll's settled ↑ total late in rollSkill (never more than it has) for 1 damage per N.
- **DialogSwitch `clearPenalties: true`** (`rules/plugins/dialog/switch-clear-penalties.mjs`): the roll ends with no Snag
  and no ↓, decided at the very end of the post-dialog chain (read by its ticked box).
- **Switch / DialogSelect option keys dice.mjs understands** - `ignoreArmor` (every per-attack Defense value without its
  armor bonus) and `rerollSkillDice` (the Skill dice rerolled once rolled). Driving Strike's DialogSelect uses them.

Defenses
- **Defense `early: true`** (+ `plus`, `key`) (`rules/plugins/combat/early-defense.mjs`): "use the better Defense" and early
  adds, against the other Defense's per-attack value; a limit is spent only when it changed the number.
- **Rule type `DefenseSwap {from, to}`** (`rules/plugins/combat/defense-swap.mjs`, on the attacker): a target that would use
  `from` (`any` for every Defense) uses `to` - after TargetedDefense, before Superstructure. Immunity kinds
  **`evasiveManeuvers`** (the target's Fly In The Future doesn't turn the attack onto Evasion) and **`voidArmorIgnore`**
  (scope incoming: the Void trait doesn't ignore this actor's armor).
- **Defense `ignoreArmor` + `points: N`** (`rules/plugins/combat/ignore-armor.mjs`): only N points of the armor share.
- **Rule type `CritImmune`** (`rules/plugins/combat/crit-immune.mjs`; scope self or `aura`): the target's rows lose their
  Critical options. **Tag `holder:check:<name>`**: a registered check asked of the holder.
- **Rule type `SnagOrMiss {limit?}`** (`rules/plugins/combat/snag-or-miss.mjs`, on a defender): a roll against the holder
  gets a Snag, or misses when it already has one; one use for both branches, spent once the roll goes ahead.
- **RollModifier immunity kinds** (`rules/plugins/rolls/immunity-kinds.mjs` + `registerImmunityKind`): `reachDownshift`,
  `grappleSizeDownshift`, `resistanceSnag`, `longRangeSnagForEdge`.

Damage
- **CardDamage {add}** (`rules/plugins/combat/card-hit-multiplier.mjs`): a flat add to the row right after the stage-card
  multipliers. **HitMultiplier `stage: "late"`** (same file): every damaging row multiplied at the end of the card (where
  Empty the Mag doubled); `megaform-finisher.mjs` skips stage late as it skips stage card.
- **DamageModifier `exceptTypes`** (`rules/plugins/combat/damage-except-types.mjs`).
- **Rule type `DamageFloor {floor}`** (`rules/plugins/combat/damage-floor.mjs`): the attack's own damageValue is at least
  `floor` (not a listed bonus - Titan Body).
- **Step `cureAll {to}`** (`rules/plugins/effects/cure-all.mjs`): full Health, every status off (Defeated too).
- **Duration `until: "throughRoundPlus2"`** (`rules/plugins/effects/round-window.mjs`): rounds r..r+2 of the combat it
  started in (a 3-round spell); never outside combat.

## Verdicts

| Item | Verdict |
|---|---|
| We Improvise, Stay Humble, Shoots and Scores, Vibrating Palm, Til All Are One, It's Right There, Academic Studies | converted |
| Show Of Hands, Empty Hands, Brazen Strike, Smash!, Flame Warlord | converted |
| Evasive, Psychological Warfare, Scapegoat, Tactical Gymnastics, Split-Second Reaction | converted |
| Psychoanalyst, Coax Surrender, Grinder, Deceptive Warfare | converted |
| Precision, Devastating Strike, Sucker Punch | converted |
| Expertise (x2), Low Tech Priorities | converted |
| Quiet As The Grave, Debilitating Strike, Hard Hitter | converted |
| Ballistics Precision, Nowhere to Run, Menace, CQB Training, Vantage Point, As Above, So Below, Trajectory, Tactical Triangulation | converted |
| Worst Nightmare, Gang Up, Team Focus, Withering Fire, Sadistic, Heavy Ordnance, Evolved Instincts | converted |
| When Push Comes To Shove, Jacket Wrestler, Genius, Ninja Powered (Deep Wisdom), Maximize Flaws | converted |
| Jack Of All Trades, Time Traveler (Hang-Up), Advantageous Fighter, Programmable | converted |
| Bad Temper, Something To Prove, Expert in Your Field, Sabotage, Different Perspective, Kind, But Firm | converted |
| Rolling Thunder, Rumble In The Jungle | converted |
| Imaginative Engineering, Worth A Shot, Worth Another Shot, "Friendly" Fire, Beloved | converted |
| Fast Draw, Anti-Air Combat Training, Size Matters, Disarming Shot, Double Agent, Quantum Cut, Penetrating Aim | converted |
| Glow, Panacea, Immovable Object, Protector's Shield, Titan Body, Unseen Strike, Penetrating Shot | converted |
| Splinter Defense, Beam Volley, Voidshield, Empty The Mag, Misled, Move Like a Song, Consistent, Driving Strike | converted |
| Unlucky (For You) | converted (its Snag half; the Terror half is items/resources/unlucky-for-you-terror.mjs, another slice) |
| Fighting Style | partial: Akimbo, Long Shot, Close Quarters Battle are rules; Careful / Defense stay in documents/actor.mjs (sheet totals), Trigger Happy stays code (the per-target Willpower compare of the same total) |
| Dependable (x2), Old Reliable, Legendary Dependability | still code: the flat-d20 substitution's scene uses and Moxie costs are charged only once Edge / Snag is known after the dialog (an ineligible box is free), with a Hang-Up gate checked then and combined 1 + both + upgrade Moxie costs - the switch engine pays at tick time |
| Explosive Aftershock | still code: a second per-target Toughness compare of the same total on the result rows, one shared choose-two picker for every failing target, and a banked penalty |
| Scarefying Appearance | still code: its stepped-up size, 10-round clock and active state are also read by target-riders' pick-two benefits and Frightened card |
| Massive Mug of Mammoth Measurements, Petite Pony's Shrink Drink | still code: a stored-size swap with scene-clock revert hooks (sizeChangeCandidates shared with Scarefying Appearance); a derived Size rule would change how the token size follows, untestable without Foundry |
| Get A Grip | still code: needs a once-per-roll hit Trigger (only the first legal hit target) and an all-or-nothing two-Free-action spend with refund |
| Get The Horns | still code: re-banks Growl's pending ↑ (Growl itself is still code) |
| Drilling Shot, Ambitious, Energon Efficiency, Pack Mule, Violent (round 14) | converted |
| Bleed 'Em Dry (round 14) | converted already - Crippling Blow's hit Trigger reads `@owned` of it (conv14-items1) |
| Undo Engine (round 14) | still code: the driver's dialog Driving Test (another actor's roll) whose failure stalls the vehicle with a restart card |
| Analyze Target (round 14) | still code: its box spends the Standard action through the action economy (Quick / Swift Study lower it) and cancels the roll when it can't be paid |
| Dispersion (round 14) | still code: its resistance feeds targetResists, the Resistance Snag and roll:dataset:targetResists together |
| Angry (round 14) | still code: its Hang-Up's picked Smarts / Social Skill is stored in the scene-window flag check:angrySnag reads - no step stores a picked value there |
| Growl (round 14) | still code: its activation (per-target-per-turn record, the isGrowl Intimidation roll, the pending ↑) is items/attacks/growl.mjs |

Behaviour notes (the code's behaviour kept; these are the edges that moved):
- Ordering: We Improvise grants after the Initiative dialog (old: before it, even when cancelled); Show Of Hands marks
  after the roll; Flame Warlord's +1 lands right after the stage-card multipliers; within the early Defense stage the
  order is best (no plus) -> adds -> best (with plus), unlimited before limited (Scapegoat is no longer spent when
  Evasive / Psychological Warfare already raised it higher); Split-Second Reaction now comes before Tactical Gymnastics'
  Ranks add; Beloved's remove-Snag applies at the dialog switches rather than after Ambitious; Double Agent's -1 lands
  with the other Defense rules (after banked bonuses) rather than before the early compare; Quantum Cut's / Drilling
  Shot's no-armor recompute is at the noArmor point (after Armor Piercing / Omega / Over the Candlestick).
- Sources: several automatic ↑ / ↓ / Edges are now labelled, switch-off-able Roll Options Dialog sources rather than the
  dialog's starting values (Empty Hands, Show Of Hands, Sabotage, Different Perspective, Rolling Thunder, Pack Mule,
  Violent, Vantage Point / As Above / So Below).
- Limits: Quiet As The Grave's round use is spent when ticked; Unseen Strike's turn use only when it halves an Evasion
  (and on a multi-target attack only the first target is halved); Low Tech Priorities' two copies both count
  (`stacks: true`).
- Small widenings: Ballistics Precision / Rumble in the Jungle read upgrade-added weapon traits; Tactical Gymnastics'
  Ranks are `@skill.rank` (shifts above d12 count 0); Worth A Shot isn't offered while rolling Targeting itself;
  Double Agent shows two boxes on a Smarts / Social attack; Size Matters' rate is fixed by the box filled; Misled's
  "failed" is every row failed; Energon Efficiency's refund is a second write (a resourceSpent Trigger sees the spend);
  Splinter Defense's Initiative write posts its chat line; Glow's lit state is the spell item's flag (recasting while
  lit does nothing; Put out only shows while lit); Maximize Flaws' Use is refused outside combat.

## Bugs found and fixed

- None in the item code. (A test-harness fix: `dice.test.js`'s Expert in Your Field actor spread `mockActor` and so copied
  whatever rules index another test had cached on it - it now strips the cached index.)

## Code vs notes - needs a ruling

- **Penetrating Shot**: the code adds (Volley Shots - 1) damage for free; the book / notes describe 1 extra Personal Power
  for ↑1 per extra shot on one combined attack. Converted as the code does it (DialogSwitch damage `@volleyShots - 1`).
- **Ambitious**: the code is once per encounter, the book once per scene (kept: limit per encounter).
- **Move Like a Song**: the book says "the first attack"; the code (kept) answers any roll made against the holder.
- **Quantum Cut** (questions.md): the attack now really targets Toughness, so Defense-specific code after it (Unseen
  Strike's Evasion halving, Over the Candlestick) sees Toughness; the old code only replaced the number.

## Shared-file edits

- `module/dice.mjs` - every converted item's code, consts and imports; new calls: ruleFumbleStoryPoints, ruleSkillEssence,
  earlyDefenseAdjust, ruleDownshiftCancel, ruleMultipliers, ruleImmunities (+ evasiveManeuvers / voidArmorIgnore),
  ruleWeaponRange, dataBridgeBonusOf, ruleSizeMatrixSteps, ruleBonusPoolDie / ruleDownshiftCap / ruleFumbleUpTo,
  ruleEdgeOrShift, ruleEnergonSpendBonus / fireRollEnergonSpent, ruleDefenseSwap, tradeRuleUpshifts, ruleClearsPenalties,
  ruleCritImmune (`_applyImmovableObjectImmunity` -> `_applyCritImmunity`), ruleDamageFloor, ruleSnagOrMiss /
  spendSnagOrMiss, askCritDowngrade / runCritDowngrade, applyLateHitMultipliers; riderDefenseAdjust and ruleNoArmor get
  the switch keys; `drivingStrike*` -> `keyIgnoresArmor` / `rerollSkillDice`.
- `module/dice.test.js` - the converted items' tests removed / adapted (and the unused `legacyPoolParty` import).
- `module/rules/adapter.mjs` (exceptTypes, early Defense, syntheticDamage, sneakAttackMultiplier, noCrit / capDie, the
  dialog in the late ctx, useSkill choiceOf), `module/rules/triggers.mjs` (fireOpenRoll item uuid),
  `module/rules/plugins/index.mjs` (the dice block), `module/rules/plugins/rolls/initiative.mjs`,
  `module/rules/plugins/combat/ignore-armor.mjs` (points), `module/rules/plugins/zords/megaform-finisher.mjs` (skips stage
  late), `module/rules/plugins/tags/world-watch.mjs` (@var.assistedBy).
- `templates/dialog/roll-dialog.hbs`, `module/mechanics/rolls/roll-dialog.mjs`, `module/apps/roll-options-dialog.mjs` -
  the converted checkboxes / selects / number boxes.
- `module/mechanics/combat/combat.mjs` (+test), `module/mechanics/resources/banked-buffs.mjs` (+test),
  `module/mechanics/combat/target-riders.mjs` (Worst Nightmare's Edge, askConsistent), `module/mechanics/combat/rider-uses.mjs`,
  `module/mechanics/combat/sneak-attack.mjs` (+test), `module/items/attacks/team-focus.mjs` (+test),
  `module/mechanics/resources/grants.mjs` / `grant-uses.mjs` (Glow's Use), `module/documents/item.mjs` (+test - Beam
  Volley), `module/items/defenses/splinter-defense.mjs` (+test).
- Deleted: `items/attacks/vibrating-palm.mjs`, `brazen-strike.mjs`, `maximize-flaws.mjs`, `unlucky-for-you.mjs`,
  `items/magic/glow.mjs`, `panacea.mjs`, `beam-volley.mjs`, `pack-mule.mjs` (each with its test). `unlucky-for-you.mjs`
  had a one-line doc-comment change from another part - removed with it.
- Pack data: `packs/qgtgitems/_source/Spoof_LBuVQrU8sDOVCQAQ.json` (`key: "spoof"` on both switches),
  `packs/mlpcrbitems/_source/Beam_Volley_UhkhFqFDYjub1a8k.json` (damageValue 2 / damageType element).

## Unused strings

`E20.VibratingPalmNoStoryPoint`, `E20.VibratingPalmNoTarget`, `E20.RollDialogPsychoanalyst`, `E20.RollDialogCoaxSurrender`,
`E20.RollDialogGrinder`, `E20.RollDialogDeceptiveWarfare`, `E20.RollDialogApplyDamageDouble`, `E20.MaximizeFlawsNoTarget`,
`E20.RollDialogWitheringFire`, `E20.RollDialogJackOfAllTrades`, `E20.RollDialogSpendProgrammable`, `E20.RollDialogKindButFirm`,
`E20.RollDialogWorthAShot`, `E20.RollDialogBeloved`, `E20.BelovedUpshift`, `E20.BelovedRemoveSnag`, `E20.RollDialogFastDraw`,
`E20.RollDialogSpendSizeMatters`, `E20.RollDialogDoubleAgent`, `E20.RollDialogDisarmingShot`, `E20.RollDialogQuantumCut`,
`E20.RollDialogPenetratingAim`, `E20.GlowCastFirst`, `E20.RollDialogAkimbo`, `E20.RollDialogPenetratingShot`,
`E20.RollDialogEmptyTheMag`, `E20.RollDialogAmbitious`, `E20.RollDialogDrivingStrike`, `E20.DrivingStrikeReroll`,
`E20.DrivingStrikeIgnoreArmor`. No new strings (`lang-dice.json` is empty).

## Rule count

130 rules on 97 items (plus the two Spoof switches keyed). check-rules: 3825 rules on 2284 items, 0 errors.
