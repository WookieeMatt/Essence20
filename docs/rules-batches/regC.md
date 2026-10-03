# Batch regC - dice.mjs, `_getAutomaticCombatModifiers` to the end of the file

Scope: every compendium-id-keyed Perk / Hang-Up / Power / Zord Feature / spell check in `module/dice.mjs` from
`_getAutomaticCombatModifiers(` to the end of the file (`_rollSkillHelper`'s post-roll processing and the
private helpers). rollSkill (regA / regB) was not touched; items whose behaviour needs a change there are skipped.

## Counts

| Verdict | Items |
|---|---|
| convert | 5 |
| partial | 2 |
| skip | 115 |

(122 items: the 125 id constants with live code in the region, less `EMPATHY_MLP_ID`, `SHOTGUN_ID` and
`SUBMACHINE_GUN_ID`, which are lookups that other checks gate on.)

## Converted

| Item | Pack file | Rule | Code removed |
|---|---|---|---|
| Big And Scary | `iafav2items/_source/Big_And_Scary_FZww5MX65plu6kZ8.json` | RollModifier `upshift: "@size + 1 - @target.size"`, `when: [skill:intimidation, target:sizeDiff<=0]` | block + `BIG_AND_SCARY_ID` |
| Bend A Knee Or Stand Tall | `tfcrbitems/_source/Bend_A_Knee_Or_Stand_Tall_JjCRN28P9CDBibVg.json` | RollModifier `upshift: "abs(@size - @target.size)"`, `when: [{any: [skill:intimidation, skill:persuasion]}, target:data:system.size]` | block + `BEND_A_KNEE_OR_STAND_TALL_ID` |
| Big Preds Are My Specialty | `tsitems/_source/Big_Preds_Are_My_Specialty_igkuus7jkoqYV5Fr.json` | RollModifier `upshift: "@target.size - @size"`, `when: [skill:infiltration, target:sizeDiff>=1]` | block + `BIG_PREDS_ARE_MY_SPECIALTY_ID` |
| The Bigger The Heart | `mlpcrbitems/_source/The_Bigger_The_Heart_fiyZcC8KRK5TebTk.json` | RollModifier `upshift: "@target.size - @size"`, `when: [skill:choiceOf:<Empathy uuid>, target:sizeDiff>=1]` | block + `BIGGER_THE_HEART_ID` (`EMPATHY_MLP_ID` stays, used elsewhere) |
| Contingency Shot (cover half) | `prcrbitems/_source/Contingency_Shot_DAqOZsEq03rJWWQo.json` | Cover `mode: ignore`, `when: [attack:ranged, combat, not:ownTurn]` - next to its existing Edge rule, which uses the same reading | `_isContingencyShotAttack` + `CONTINGENCY_SHOT_ID` |

## Partial

| Item | Converted | Stays code, and why |
|---|---|---|
| Seconds Between Click & Boom | The Snag on attacks against the holder's Evasion: incoming RollModifier `snag`, `when: [attack, defense:evasion]` (`SECONDS_BETWEEN_CLICK_AND_BOOM_ID` removed from dice.mjs) | The "a miss has no effect" half is in `helpers/extensions/gij3/dice-hooks.mjs` (outside this region), unchanged. |
| Exterminator | The ↑1: RollModifier `upshift: 1`, `when: [attack, {any: [target:data:system.size=common, target:data:system.size=small]}, target:sizeDiff<=-1]` | The `exterminatorEligible` flag (read by rollSkill as `rollContext.smallerTarget` for the Reroll condition) - removing it needs a rollSkill edit and a "this roll matched rule X" hand-off. |

## Behaviour differences

- **All seven:** the shifts now come from the item-rule sources (inside `finish()`'s `rollRiderSources`), so in the
  Roll Options Dialog they are listed with a `ext-rule-<item>-<n>` id rather than `bigAndScary` etc.; the label is
  still the item's name. Because they are now added in `finish()`, the `pendingShiftDown` handed to the riders (the
  `roll:downshifted` tag) no longer counts these upshifts. Move Like a Song still sees the Seconds Between Click &
  Boom Snag (it runs after the rider sources) - covered by the edited dice.test.js tests.
- **The Bigger The Heart:** on a targeted roll that carries no rolled Skill, against a larger target,
  `skill:choiceOf` answers "unknown", so the rule is offered as an unticked switch (before: nothing). Every Skill
  roll through rollSkill carries a Skill, so this should not come up.
- **Contingency Shot:** the old check was "a `game.combat.combatant` exists and is someone else"; the rule reads
  `combat` (a started combat) and `not:ownTurn`. They differ only for a Combat that has a current combatant but has
  not been started (in Foundry v14 an unstarted Combat has `turn: null`, so no combatant). The Edge half was
  already converted with exactly these tags, so both halves now agree.
- No other differences found. Sizes always hold one of `E20.actorSizes`' keys (the data model's choices), so the
  "unknown size gives nothing" branches of the old code have no reachable rule-side difference.

## Skipped, and the engine piece each would need

### Trigger outcome model (afterRoll / hit)
`rollOutcome` reports `crit` before `fumble` and before Degrees of Success, but the old code reads
`result.multiplier`, `isFumble` or "every result failed" directly. A natural crit at x1, a crit that still fails, or a
roll that both crits and fumbles would behave differently. Missing: outcomes that read only the results'
Degrees of Success / success (and `isFumble` regardless of a crit).
- Cruel Warlord (Fumble: regain 2 Personal Power). Also, `gainResource` posts a chat line and never lowers a value
  already above max (the old `Math.min` did).
- You Can Do It, Too! (x2 success banks ↑1 on every ally until the granter's next turn).
- Barreling Beam (Prone on a x2 hit).
- Mistrustful (failed Alertness banks a Snag), Try, Try Again (failed test banks a skill-scoped bonus), Arashikage
  Graduate (failed test, once per scene).
- Percussive Maintenance (x2 Technology). The bank is also consumed in rollSkill.
- Cost of Sorcery (Fumble on a sorcerous Power loses 1 Health directly, not through applyDamage). It also needs a
  "lose Health" step.

### Turn order / Initiative tags
Missing: a "target hasn't acted yet this round" tag (turn index comparison) and an Initiative comparison tag.
- First Strike (Edge against an opponent who hasn't acted).
- Oorah! (+1 damage), Catch Off Guard (+1 Stun on hit), Rumble in the Jungle (bonus die). Their results are also
  folded in by rollSkill.
- Goin' Heels (↑1 against lower Initiative, +1 damage when highest). The damage half is folded in by rollSkill.

### Level comparison
Missing: a tag comparing `getEffectiveLevel` (Level, or Threat Level for NPCs) between the roller and the target.
`@target.level` only reads `system.level`.
- Hierarchy Rank (↑1 / ↓1), Grid Soldier (↑1 at 3+ levels above), Just the Facts (incoming Snag against a
  higher-level deceiver), Knock Down Drag Out (also inside Stunning Surprise's rollSkill-flagged rider).

### Range, elevation and position
- Ballistics Precision (↑1 within the weapon's normal range), Trajectory (+30 ft range), Nowhere to Run (Edge when
  the long-range Snag is already ignored). Missing: a range-band tag (normal / long) and a range modifier.
- Vantage Point, As Above (Edge from higher elevation), So Below (incoming ↓1). Missing: an elevation tag.
- Menace, CQB Training (no ↓1 for a ranged attack inside the enemy's reach). Missing: an immunity for that one
  automatic downshift, like `longRangeSnag`.
- Bulwark (planted Bulwark within 5 ft gives the target Cover). Missing: an aura/linked scope for Cover `grant`.
- Two Steps to the Right (allies within 60 ft share Lay of the Land's reduction). Already a known issue.
- Tactical Triangulation (↑ per Data Bridged ally). Missing: a Data Bridge count.

### Vehicles and Zords
- Dogfighter (Edge while driving an aerial vehicle of Extended II or smaller). Missing: a tag for the crewed
  vehicle's size.
- Heavy Ordnance (the vehicle's attacks against vehicles or targets at least the driver's size). `driven` scope
  exists, but there is no size compare against the holder (driver) rather than the rolling vehicle.
- Evolved Instincts (Zord or its driver; melee within 2 sizes of the Zord's size). Same gap.
- Ninja Powered: Deep Wisdom (Edge against a target resistant or immune to this attack's damage type). Missing: a
  "target resists the rolled damage type" tag.
- Ninja Powered: Balance of Justice (round mark reported back to rollSkill).
- Power Filter (energy attack vs Toughness on the Zord feeds the pilot's Personal Power). Missing: a defender-side
  "was attacked" Trigger that reaches the pilot.
- Demolition Driver (its availability is read by rollSkill).

### Post-roll result changes (no rule type for them)
- Precision, Devastating Strike (change the Degrees of Success multiplier).
- Flame Warlord (+1 on a x2 hit after the multiply), Plate Piercing (x2 vs vehicles), Raze and Ruin (x3 / x2 by
  size), Smash! (+size difference and Prone), Nowhere Is Safe (lowers the target's Cover status, +1 damage).
  Missing: a per-target "after Degrees of Success" damage modifier keyed on the hit.
- Immovable Object, Protector's Shield (immune to Critical Success effects). Missing: a crit-immunity rule.
- Empty the Mag (a rollSkill checkbox that doubles damage).
- Time Traveler (widens Fumble to a natural 2 on d2/d4). Missing: a Fumble-range rule.
- Silver Medal Syndrome / Consistent (prompts to give up a Critical Success).
- Academic Studies, It's Right There (2 Story Points on a Fumble). Missing: a hook on the Fumble Story Point grant.

### Reactions on the defender
Missing: a defender-side Trigger for "an attack against me hit / missed" (the `hit` / `miss` Triggers fire on the
attacker; `takesDamage` fires when damage is applied, not on the hit).
- Revengeful, Now I'm Angry, Splinter Defense (Initiative docking), The Tough Get Going, Move Like a Song (forced
  miss / Snag on the first attack each round, round mark reported to rollSkill), Don't Underestimate Me (incoming
  Snag; its once-per-scene mark is written by rollSkill).

### Code-held state, pickers and helpers
- Bad Temper, Something To Prove (a Fumble starts a ↓1 that only applies in the following round). Missing: a
  delayed-start mark, and see the outcome model above.
- Sadistic (compares the target's Condition count with every enemy's). Missing: a count-of-Conditions comparison.
- Worst Nightmare (↑1 unless the holder caused the Frightened). Missing: a "Condition caused by the other party"
  tag (`hasConditionFrom`).
- When Push Comes To Shove (counts as one size larger for the grapple size shift), Jacket Wrestler (no grapple size
  downshift). Missing: a way to change or lift those two automatic size shifts.
- Gallantry (incoming Snag on a Trigger Happy attack). Missing: a tag for the other party's Fighting Style choice;
  the multiple-targets test (`isMultipleTargetsWeapon`, incl. Charge Into Battle) also has no tag.
- Impenetrable Shield (Resistance-as-Snag while the Personal Shield is up). Missing: a `check:personalShieldActive`.
- Dispersion (an active shield's Energy Resistance). Same gap, and it is one term of the Resistance OR chain.
- Informed Accuracy, Inundation (per-target counters / marks keyed by the target's uuid).
- Team Focus, Gang Up / Let's Go Psycho! (Role Points and "a holder within 5 ft of the target").
- Unlucky (For You) (once per target per combat, banks a Snag on the target).
- Misled (reads the assisting actor's Hang-Up through `checkContext.lendAssistanceAssisterUuid`).
- Painmonger (Impaired on a Stun hit). It reads `checkContext.damageType`, and an `applyCondition` step adds a chat
  line and, for an unowned target, relays a toggle without the 1-round timer.
- Thorn Warlord, Ice Machine (per-hit checks of the target's Conditions). The old code reads them before the
  per-hit riders and Triggers apply theirs, and a hit Trigger would run after. Thorn Warlord also has the
  `gainResource` chat / clamp differences.
- BRRRRRRRRRRRRRRT (once per encounter, banks ↑1 on every ally on a multiple-targets attack). Missing: a
  multiple-targets tag.
- Brazen Strike, Stylish Strike (Powers that call their own helpers).
- Fighting Style (a shared choice lookup used by several options), Alpha Strike and Penetrating Rounds' armor half
  (both read by rollSkill), Robot (the target marker for Electromagnetic).
- Label-only lookups, where the behaviour is a flag kept by a helper: Debilitating Strike, Growl, Combat Stance,
  CBRN Defender, Instill Weakness, Maximize Flaws, Shield Modulation, Shock and Awe.
- Post-roll handlers gated on a `checkContext.*Attempt` flag that rollSkill sets: Takedown Expert, Get The Horns,
  Bleed 'Em Dry, Support Yourself.
- Spells and Baubles that call their own helpers on a successful cast: Panacea, Help Yourself, Disguise (DSoE),
  Pack Mule, Hot To Trot, Glow, Greased Lightning, Sparkle Blast, Mystery Sense, Glittermane, Ookie Spookies,
  Foolscarrot, Scarefying Appearance, Massive Mug, Petite Pony's Shrink Drink, Block Magic, Fluttery Wings,
  Lightning Speed, Summon Armor / Summon Shield, Don't-Notice-Me-Field, Mind Beam (the effect is picked before the
  roll).

## Tests

- New tests in `module/rules/conversions.test.js` (the `// regC` block): each item loaded from its pack source,
  asserting what the removed dice.test.js tests asserted (sizes, Skills, no target, no Perk, Defense type, ranged vs
  melee, turn).
- `module/dice.test.js`: removed the Big Preds, Big And Scary, Bend A Knee, The Bigger The Heart and Seconds Between
  Click & Boom describes and the two Contingency Shot Perk tests. The Exterminator test now expects the
  eligibility flag only. Both Move Like a Song forced-miss tests (`_getAutomaticCombatModifiers` and rollSkill) now
  give the target Seconds Between Click & Boom's incoming rule, so they still check that the rule's Snag forces the
  miss.
