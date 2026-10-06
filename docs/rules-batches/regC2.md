# Batch regC2: `dice.mjs` from `_getAutomaticCombatModifiers` to the end, second pass

**Scope:** every item `regC.md` left skipped (115), plus the code half of each of regC's two partials
(Seconds Between Click & Boom, Exterminator). Each was re-checked against the engine pieces added on
2026-10-03 after the regA/regB/regC round:

- Trigger outcomes `x2` / `anyFailed` / `allFailed` / `fumbled`;
- the `notActed`, `combat:aheadOfTarget`, `combat:highestInitiative` and `levelDiff` tags;
- DieSubstitution, RollDice, the Defense modes, `late` RollModifiers;
- ally auras / `stacks: false`, Cover auras;
- DialogSwitch `key` / `steps`, DamageType, scaled DamageModifier `limit` / `steps`;
- `loseHealth` and the new `check:` names.

| Verdict | Items |
|---|---|
| Convert | 15 |
| Partial | 0 |
| Still skip | 102 |

That is 117 items re-checked. 19 rules were added to 15 pack items. After this batch `scripts/check-rules.mjs`
counts 1273 rules on 924 items (base: 1254 on 912).

## Converted (15)

Each item's code in `dice.mjs` is gone, with its id constant (except `OORAH_ID` and `TWO_STEPS_TO_THE_RIGHT_ID`,
still used by other code) and its old `dice.test.js` describe. Their behaviour is tested in
`module/rules/conversions.test.js` (the `// regC2` block), loaded from the pack sources.

| Item | Rule | Why it is exact |
|---|---|---|
| Cruel Warlord (the Fumble half) | Trigger `afterRoll`, `outcome: fumbled`, `self:data:system.powers.personal.max>0` → `gainResource` 2 on `system.powers.personal.value` | `fumbled` reads `isFumble` itself (a crit that also Fumbled counts), the same `isFumble` the old check read (Time Traveler's widening included). gainResource stops at `.max`. The Psychic-damage half is still in `mechanics/combat/combat.mjs` (outside this region). |
| Cost of Sorcery | Two Triggers `afterRoll`, `outcome: fumbled` → `loseHealth` 1: one for `item:type:power` + `item:data:system.type=sorcerous`, one for `weapon:trait:sorcerous` | The same two clauses as the old `isSorcerousAttempt`. `loseHealth` is the same direct `max(0, value - 1)` write. `isSorcerousAttempt` and its checkContext entry are gone. |
| Barreling Beam (the Prone half) | Trigger `hit`, `outcome: x2`, `item:own` → `applyCondition prone` to the target | The `hit` facts are that target's own result: `success && multiplier >= 2`, the old test. The push half stays in `target-riders.mjs`. |
| Mistrustful | Trigger `afterRoll`, `outcome: allFailed`, `skill:alertness` → `bank` Snag, `appliesWhen: not:roll:initiative`, `until: encounter` | `allFailed` is "every result failed", as before. Its consumer was in `_getAutomaticCombatModifiers`, where rules banks are read too. `helpers/mistrustful.mjs` and its test are removed (nothing else used them). |
| Percussive Maintenance | Trigger `afterRoll`, `outcome: x2`, `skill:technology` → `bank` Edge, `appliesWhen: skill:technology, not:roll:initiative`, `until: encounter` | `x2` matches the old `results.some(multiplier >= 2)` (a multiplier of 2+ is always a success). Two banked Edges are both used up by the next Technology roll, as one Edge, so stacking changes nothing. Its rollSkill consumer (four lines) is removed. |
| BRRRRRRRRRRRRRRT | Trigger `afterRoll`, `check:multipleTargetsWeapon`, `limit: {per: encounter}` → `bank` ↑1 to `allies:100000`, `appliesWhen: not:roll:initiative`, `until: encounter` | Any outcome, as before. The check is the same `isMultipleTargetsWeapon`. The limit is the Scene Clock encounter window, as `hasUsedThisEncounter` was, and it is spent even with no ally in reach. `allies:` counts allies through `getNearbyAllyTokens`. The consumer in `_getAutomaticCombatModifiers` is removed. |
| First Strike | RollModifier Edge, `target:notActed` | The same turn-index comparison, on any roll with a target, in any combat. No target or no combat gives `false` (no switch). |
| Hierarchy Rank | RollModifier ↑1 `target:levelDiff<0`; RollModifier ↓1 `target:levelDiff>0` | `levelDiff` uses Level, else Threat Level, as `getEffectiveLevel` does. It applies to any roll with a target. |
| Grid Soldier (the level half) | RollModifier ↑1, `target:levelDiff<=-3` | The same comparison. The Power-spend half stays in `banked-buffs.mjs`. |
| Just The Facts (both halves) | Incoming RollModifier Snag, `skill:deception` + `self:levelDiff<0`; Defense `any`, `mode: fail`, `skill:deception` + `self:levelDiff>=0` | The Snag is on the first target, as before. The Immune half was an `Infinity` difficulty per target; `fail` gives `Infinity` at the rules' step (see the differences). regB2 left this half for regC2. |
| Impenetrable Shield (the Snag half) | Incoming RollModifier Snag, `attack` + `not:item:damageType:emp` + `check:personalShield` | `check:personalShield` is `isPersonalShieldActive`. The Snag still reaches Move Like a Song, which runs after the rule sources. The EMP-immunity half stays in `mechanics/combat/combat.mjs`. |
| Goin' Heels | RollModifier ↑1 and scaled DamageModifier +1, both on `attack` + the parent weapon's Targeting / Sidearm / one hand (`weapon:data:`). The ↑1 needs `combat:aheadOfTarget`; the damage needs `target:data:system` (a target) + `combat:highestInitiative` | Both tags are the old comparisons: both Initiatives rolled and mine higher; nobody higher, ties count. The scaled rule joins `damageBonusValue` like the removed `goinHeelsDamageBonus` term, under the item's name. |
| Oorah! (the +1 damage) | Scaled DamageModifier +1, `attack` + `target:notActed` | The same "Surprised" proxy, and the same `damageBonusValue` slot and label. The Catch Off Guard / Rumble in the Jungle checks keep their own copy of the proxy. |
| Two Steps to the Right (the Cover half) | Cover `reduce` 1, `scope: aura`, `radius: 60`, `affects: allies`, `stacks: false`, `attack:ranged` | The ally aura counts allies through `getNearbyAllyTokens(attacker, 60)`, the old lookup. The biggest reduction wins, as the old `max(twoSteps, rules.reduce)` did. regA2 converted the Edge half. |
| Bulwark (the Cover half) | Cover `grant`, `against: true`, `scope: aura`, `radius: 5`, `affects: all`, `holder:data:flags.essence20.bulwarkActive` | Any token within 5 ft, any side (the old scan ignored disposition), planted (the flag `isBulwarkActive` reads). Never the holder itself. `_hasNearbyBulwarkCover` and the `isBulwarkActive` import are removed from `dice.mjs`. |

### Engine tweak

`rules/adapter.mjs#ruleCover` now passes `holder` (the actor whose item it is) into the tag context, so an aura
Cover rule can ask about its holder (Bulwark's planted stance). For a holder's own Cover rules the holder is
`self`, as before. No Cover rule used `holder:` until now. regB2 made the same tweak to `ruleDefenseAdjust`.

## Behaviour differences

1. **Dialog sources.** Eight items' sources are now listed with an `ext-rule-<item>-<n>` (or `rulebank-…`) id
   instead of `firstStrike`, `hierarchyRank`, `gridSoldier`, `goinHeels`, `justTheFacts`, `impenetrableShield`,
   `mistrustfulSnag` or `brrrrrrrrrrrrrrt`. Labels are the rules' own.
   - Because rule sources are added in `finish()`, the `pendingShiftDown` behind `roll:downshifted` no longer
     counts the Hierarchy Rank / Grid Soldier / Goin' Heels shifts. Its only pack user is In the Rain (WTNV), so
     this is cross-line. regC accepted the same.
2. **An unstarted combat.** `notActed` compares with `combat.turn ?? -1`. If a combat has its turn order but
   has not started (`turn: null`), the combatant first in that order now counts as not having acted. The old
   `index > null` read it as index 0, so the first combatant did not count. This affects First Strike and Oorah!.
   Catch Off Guard and Rumble in the Jungle keep the old reading.
   **Fixed after merging (2026-10-04):** `notActed` now reads an unstarted combat's turn as 0, like the old code, so
   this difference is gone.
3. **Just The Facts' Immune half moved in the Defense block.** It used to set `Infinity` early, before the
   recomputes. Two of those recomputes could replace it with a finite Defense: Exploit Weakness's mark (Power
   Rangers) and Over the Candlestick's Agile Reflexes (GI Joe, Toughness only). The rule's `fail` now comes at
   the rules' step, after them, so the Deception roll still can't succeed. Both are cross-line (Just The Facts
   is Transformers). regB2 accepted the same for Trustworthy.
4. **Goin' Heels' and Oorah!'s damage needs a roll against someone.** Scaled rules are decided only when the
   roll has `checkEntries` (a target and a Defense other than `none`). The old terms were also summed into the
   damage bonus of a targeted roll whose Defense was set to `none`. That roll has no check card, so the bonus was
   never applied.
5. **Trigger timing.** The six Triggers run when `applyRollRiders` finishes (`runPostRoll`), not at their old
   places part-way through `_rollSkillHelper`:
   - Cruel Warlord's and Cost of Sorcery's old updates came right after the dice;
   - Barreling Beam's Prone and the banks came mid-way.

   Nothing in between reads Personal Power, Health or the target's Prone. Barreling Beam's Prone now lands
   after its push instead of before.
6. **Trigger side effects.**
   - **Cruel Warlord** never lowers a Personal Power that is already above its maximum (the old `Math.min` did).
   - **Cost of Sorcery** posts a "lost 1 Health" line.
   - **Barreling Beam** posts the Condition line. For a target the user can't modify, the Prone is relayed to the
     GM; the old direct toggle failed there.
   - **Mistrustful, Percussive Maintenance and BRRRT** post a "Banked" line.
7. **Banks are rules banks.**
   - **Expiry.** They end at the Scene Clock's encounter boundary (`until: encounter`): a new scene, or a combat
     ending. The old flags lapsed when the combat they were banked in ended or changed. They never lapsed when
     banked outside combat.
   - **Two BRRRT holders.** Two holders firing in the same encounter now give an ally ↑2. The old single flag
     gave ↑1.
   - **Percussive Maintenance's Edge.** It is now an automatic-modifier Edge, listed in the dialog. It used to be
     set silently on `skillDataset.edge` later in rollSkill. Readers between the two points now see it: Expert in
     Your Field, Dependable and Old Reliable (all GI Joe) and `roll:edge` rules (Energy Connection is attack-only).
     Percussive Maintenance is Transformers, so this is cross-line. It is also used up when the roll is made; the
     old consumer cleared it before the dialog, even if the dialog was then cancelled.
   - **Old flags.** A bonus banked under the old flags (`pendingMistrustfulSnag`, `pendingPercussiveMaintenance`,
     `pendingBrrrrrrrrrrrrrrt`) before the update is no longer read.
   - **Matured.** Mistrustful is a Hang-Up, so the rules engine leaves it inactive when Matured ignores it (GI Joe).
     The old `actorHasHangUp` check banked anyway.
   - **Range.** BRRRT reaches allies within 100000 ft (`allies:` needs a number) instead of `Infinity`.
8. **Bulwark's distance** is measured between the holder's and the target's first active tokens. The old scan
   measured every Bulwark token to the targeted token. This only differs for an actor with several tokens on the
   scene.

No other differences found for Hierarchy Rank, Grid Soldier, Impenetrable Shield or Two Steps to the Right's
Cover. For an NPC with no `system.level`, `levelDiff` uses its Threat Level, as `getEffectiveLevel` did.

## Still skipped (102), and what each still needs

### Trigger outcomes: the outcome now matches, something else doesn't

| Item | Why it still can't convert |
|---|---|
| You Can Do It, Too! | `x2` plus a `bank` to `allies:` would match, but rules banks stack. Two x2 rolls by the holder before an ally rolls would give ↑2; the old single flag gave ↑1. Needs a bank that replaces the same source's entry. |
| Try, Try Again | The bank's `appliesWhen` can't name the Skill that just failed. Needs roll-fact interpolation in bank steps, like `skill:{roll.skill}`. Its consumer is also in rollSkill. |
| Arashikage Graduate | `allFailed` with a `per: scene` limit would match. But its ↓1 is consumed in rollSkill as a silent pre-dialog dataset shift, and a bank would move it into the automatic modifiers instead, which Straight Shooter, Fanatic and `roll:downshifted` read. Needs a bank consumed at the dataset-shift stage. |
| Bad Temper, Something To Prove | `fumbled` exists. They still need a ↓1 that starts in the following round (a delayed-start mark or bank). |

### Turn order

| Item | Why |
|---|---|
| Catch Off Guard | A `hit` Trigger with `target:notActed` and a `damage` step would match the condition. But the `damage` step only damages a target the user owns; otherwise it posts a GM note, so a player's attack on an NPC would lose the Stun. The Stun would also land after Ice Machine's same-line "already Stunned" check. Needs a relaying damage step. |
| Rumble in the Jungle | The bonus Intimidation die is folded into `_getFormula` by rollSkill. No rule adds a bonus Skill Die. |

### Level

| Item | Why |
|---|---|
| Knock Down Drag Out | `levelDiff` covers the gate, but it is nested in Stunning Surprise's post-hit block: the Stun is applied, then the Unconscious. Stunning Surprise is still code (regB's list); it needs to become a `hit` Trigger first. |

### Range, elevation and position (unchanged from regC)

- **Ballistics Precision, Trajectory, Nowhere to Run:** need a range-band tag and a range modifier.
- **Vantage Point, As Above, So Below:** need an elevation tag.
- **Menace, CQB Training:** need an immunity for the inside-reach downshift.
- **Tactical Triangulation:** needs a Data Bridge count.

### Vehicles and Zords (unchanged)

- **Dogfighter:** the crewed vehicle's size.
- **Heavy Ordnance, Evolved Instincts:** a size compare against the driver, not the rolling vehicle.
- **Ninja Powered: Deep Wisdom:** "the target resists the rolled damage type".
- **Ninja Powered: Balance of Justice:** its round mark is reported back to rollSkill.
- **Power Filter:** a defender-side "was attacked" Trigger that reaches the pilot.
- **Demolition Driver:** its availability is read by rollSkill.

### Post-roll result changes (unchanged)

- **Precision, Devastating Strike:** they change the multiplier.
- **Flame Warlord, Plate Piercing, Raze and Ruin, Smash!, Nowhere Is Safe:** they need a per-target damage
  modifier applied after Degrees of Success.
- **Immovable Object, Protector's Shield:** a crit-immunity rule.
- **Empty the Mag:** a rollSkill checkbox.
- **Time Traveler:** a Fumble-range rule.
- **Silver Medal Syndrome / Consistent:** the prompt to give up a Critical Success.
- **Academic Studies, It's Right There:** a hook on the Fumble Story Point grant.

### Reactions on the defender (unchanged)

Revengeful, Now I'm Angry, Splinter Defense, The Tough Get Going, Move Like a Song and Don't Underestimate Me.
They need a defender-side "an attack against me hit / missed" Trigger. Move Like a Song and Don't Underestimate
Me also report their marks back to rollSkill.

### Code-held state, pickers and helpers

| Item | Why |
|---|---|
| Gallantry | `check:multipleTargetsWeapon` exists now, asked of the attacker as `target:check:`. Still missing: a tag for the other party's Fighting Style choice, which lives on another item's `system.choice`. |
| Dispersion | One term of the Resistance OR chain, which Maximize Flaws inverts. It also needs "an equipped, active shield of this source". |
| Painmonger | Still reads `checkContext.damageType` (the overridden type). `applyCondition` relays an unowned target's toggle without the 1-round timer. |
| Thorn Warlord, Ice Machine | They read the target's Conditions before the per-hit riders and Triggers apply theirs. A `hit` Trigger would run after Cryogenic Touch's (same line) Impaired Trigger and see it. Ice Machine reads the overridden damage type. Thorn Warlord also has the gainResource clamp difference. |
| Sadistic | A comparison of the target's Condition count with every enemy's. |
| Worst Nightmare | Needs a "Condition caused by the other party" tag. |
| When Push Comes To Shove, Jacket Wrestler | No way to change or lift the grapple size shift. |
| Informed Accuracy, Inundation | Per-target counters keyed by the target's uuid. |
| Team Focus, Gang Up / Let's Go Psycho! | Role Points, and "a holder within 5 ft of the target". |
| Unlucky (For You) | Once per target per combat. |
| Misled | Reads the assister's Hang-Up. |
| Brazen Strike, Stylish Strike | Powers with their own helpers. |
| Fighting Style, Alpha Strike, Penetrating Rounds (armor half), Robot | Shared lookups, or read by rollSkill. |

Also still skipped, unchanged from regC:

- **Label-only lookups:** Debilitating Strike, Growl, Combat Stance, CBRN Defender, Instill Weakness, Maximize
  Flaws, Shield Modulation, Shock and Awe.
- **`checkContext.*Attempt` handlers:** Takedown Expert, Get The Horns, Bleed 'Em Dry, Support Yourself.
- **Spells and Baubles with their own helpers:** Panacea, Help Yourself, Disguise (DSoE), Pack Mule, Hot To Trot,
  Glow, Greased Lightning, Sparkle Blast, Mystery Sense, Glittermane, Ookie Spookies, Foolscarrot, Scarefying
  Appearance, Massive Mug, Petite Pony's Shrink Drink, Block Magic, Fluttery Wings, Lightning Speed, Summon Armor /
  Summon Shield, Don't-Notice-Me-Field, Mind Beam.

### regC's partials: the code halves

| Item | Still code because |
|---|---|
| Seconds Between Click & Boom | The "a miss has no effect" half is in `items/rolls/better-than-the-best-miss-immunity.mjs`, outside this region. |
| Exterminator | The `exterminatorEligible` flag that rollSkill reads for the Reroll condition. A rule can't hand "this roll matched rule X" to the reroll. |

## What would unblock the most

1. **A bank that replaces its own source's entry**, and roll-fact interpolation in bank steps. This would
   unblock You Can Do It, Too! and Try, Try Again.
2. **A `damage` step that relays to the GM for an unowned target.** This would unblock Catch Off Guard. It would
   also take Painmonger, Thorn Warlord and Ice Machine a step closer, if hit Triggers could run before the other
   per-hit riders.
3. **A defender-side hit / miss Trigger.** This would unblock the six reactions.
4. **A delayed-start bank or mark.** This would unblock Bad Temper and Something To Prove.

## Overlap with regA2 / regB2 (not yet merged)

Checked with `git merge-tree --write-tree` against each branch.

- **regA2:** 3 conflicting files, all trivial.
  - `module/dice.mjs`: one hunk. regA2 deleted the Down the Barrel constant and this batch deleted the
    Percussive Maintenance constants right next to it; drop both.
  - `module/rules/conversions.test.js`: both append a block at the end; keep both.
  - `packs/eocitems/_source/Two_Steps_to_the_Right_…json`: both added a one-line `rules` array (regA2 the Edge
    aura, this batch the Cover aura); keep both lines.
  - **After merging, delete `TWO_STEPS_TO_THE_RIGHT_ID`** (and its comment) from `dice.mjs`. regA2 removed its
    rollSkill use and this batch removed its Cover use, so lint fails with `no-unused-vars` until it goes.
- **regB2:** 2 conflicting files.
  - `module/dice.mjs`: one hunk. regB2 deleted `KILL_SHOT_ID` and this batch deleted `FIRST_STRIKE_ID` on the
    next line; drop both.
  - `module/rules/conversions.test.js`: the end-of-file blocks; keep both.
  - `module/rules/adapter.mjs` auto-merges (the two `holder` tweaks are in different functions).
- **Trial merge.** A three-way merge of this branch with both, using these resolutions, passes all three checks:
  ESLint is clean; `check-rules` counts 1303 rules on 944 items with 0 errors; jest passes 502 suites, with 9572
  tests passing and 2 skipped.
- **Just The Facts.** regB2 left its Immune half (in its region) to this batch, and it is converted here.

## Verification

- `node node_modules/eslint/bin/eslint.js module/ --ext .js,.mjs --rule 'linebreak-style: off'`: clean.
- `node scripts/check-rules.mjs`: 1273 rules on 924 items and 536 prerequisite lists, 0 errors, 0 warnings.
- `node --experimental-vm-modules ./node_modules/jest/bin/jest.js --rootDir .`: 502 suites passed; 9603 tests,
  9601 passed and 2 skipped.
