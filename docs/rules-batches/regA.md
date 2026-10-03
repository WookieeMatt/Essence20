# Batch regA: `dice.mjs` `rollSkill`, before the Roll Options Dialog

**Scope:** the id-keyed Perk, Hang-Up, Power and Zord Feature checks in `module/dice.mjs#rollSkill`. It runs from the
start of `rollSkill` up to the line `const skillRollOptions = await this._rollDialog.getSkillRollOptions(...)`.

**Counts** (counted per item; EMT Crash Course's two printings count as two):

| Verdict | Items |
|---|---|
| Convert | 25 |
| Partial | 5 |
| Skip | 89 |

**Totals:** 37 rules were added to 30 pack items. After this batch `scripts/check-rules.mjs` counts
1242 rules on 903 items.

## Converted (25)

Each item's code in this part of `rollSkill` is gone. So are its id constant, its test in `dice.test.js`, and, for a
dialog checkbox, the checkbox itself and the code that ran after the dialog. Each one's behaviour is now tested in
`module/rules/conversions.test.js` (the `// regA` section).

### Automatic modifiers (RollModifier rules)

| Item | Rule | Note |
|---|---|---|
| Calm Beast | ↑1 on Animal Handling with a Specialization named "Calming" | |
| Chivalrous | ↑2 on Persuasion with "Diplomacy" | Its existing Use rule is kept. |
| Puzzle Solver | ↑1 on Alertness with "Investigation" | Its existing Use rule is kept. |
| Psych 101 | ↑2 on Culture while holding any Science Specialization | Reads `self:specializedIn:science`. |
| Tourniquet Line Chef | Edge on Science with "Medicine" | Its Use rule is kept. |
| EMT Crash Course ×2 (GI Joe, PR) | Edge on Science with "Medicine" | Their heal halves stay in `banked-buffs.mjs`. |
| Astro-Sense (Power) | Two rules: Edge on Survival with "Space"; Edge on Technology with "Astro-Nav" | |
| Broadcaster (Perk) | Edge on Technology with "Communications", `not:combat` | Its Social DialogSwitch is kept. |
| Spoiled (Hang-Up) | Snag on a Requisition test (`roll:dataset:requisitionItemName`), `limit: {per: scene}` | |
| Tracker (Environmental) | ↑2 on Survival, `check:environmentalExpertise` | |
| Peerless Pilot (GI Joe) | ↑2 on Driving with `vehicle:driving` and `self:specializedIn:driving` | Its Initiative rule is kept. |

### Dialog checkboxes (DialogSwitch rules)

| Item | Rule |
|---|---|
| Eureka! (Blue Ranger) | On Smarts tests: Edge and `clearSnag`, costing 1 base Role Point (`cost.resource.rolePoints: true`) |
| Eltarian Tech | The same, on Technology |
| Always Ready | Six switches, one per function (`rule:data:system.choice=...`), on that function's two Skills: Edge and `clearSnag`. They share the limit `{per: scene, key: alwaysReady}`. |
| Dependable Tanker | On Driving or Technology: Edge and `clearSnag`, costing 1 Story Point |
| Hacking Algorithms | The same, on Technology |
| Strike Bonus | On melee attacks: upshift `@item.system.advances.currentValue`, costing 1 Personal Power, limit 1 per round. Offered only when that value is above 0. |
| Heavy Force | While Morphed, on a melee attack or a shove (`roll:shove`): ↑2, costing 1 Personal Power, limit 1 per turn |
| Isolated | ↑1, limit 1 per encounter |
| Gutter Champion | ↑1, limit 1 per turn |
| Thrillseeker (Hang-Up) | On Strength or Speed tests: Snag, limit 3 per scene |
| "I remember reading about…." | On Smarts tests: Specialized, limit 1 per encounter |
| Military Formality | A 0–3 number box (`spend: {max: 3}`), upshift `@spent`, on Deception, Intimidation and Persuasion |
| Two-Handed Assault | Two switches, one per handedness choice. Each needs a melee attack with a Silent Martial Arts weapon, plus a light weapon for `dualWieldLight` or a two-handed effect for `twoHanded`. ↑1, `forget`. |

Every rule whose Skill could be the actor's Initiative Skill also carries `not:roll:dataset:isInitiative`. The old code
ran only in `rollSkill`, so it never applied to Initiative. That covers Psych 101, Honest Assessment, Perfect Disguise,
Tracker, Peerless Pilot, Eltarian Tech, Always Ready, Dependable Tanker, Hacking Algorithms, Isolated, Gutter Champion
and Military Formality.

## Partial (5)

| Item | What converted | What stays code, and where |
|---|---|---|
| Honest Assessment | The ↑2 on the chosen Skill while active (`skill:{item.choice}`, `self:data:flags.essence20.honestAssessmentActive`) | The ↓2 on Deception and Persuasion stays in `dice.mjs`. It sits after Expertise's "ignore the first ↓", and Expertise is an MLP Perk too, so moving it into the rule sources would let Expertise cancel one of the two. |
| Takedown Expert | The Edge on Takedown attempts (`roll:dataset:isTakedown`) | Its post-hit Condition. That code is in regC (`dice.mjs` about line 13900) and `gij3/dice-hooks.mjs`. |
| Metallikato | The ↓1 while Multiple Targets is on, on Bot Mode melee attacks | Its ignore-armor checkbox (still in this region) and its post-hit use in regB |
| Ninja Power | The Edge on Speed tests while Morphed and active | Its element damage type, in regB (`overriddenDamageType`) |
| Perfect Disguise | The Edge on Deception, Persuasion, Intimidation and Streetwise while disguised | Its toggle (`banked-buffs.mjs`) and its sneak-attack eligibility (`sneak-attack.mjs`). Nothing for it is left in `dice.mjs`. |

## Behaviour differences

1. **Automatic shifts are now listed.** Calm Beast, Chivalrous, Puzzle Solver, Psych 101, Honest Assessment's ↑2,
   Peerless Pilot's ↑2 and Metallikato's ↓1 were silently added to the shift totals. They now show by name in the Roll
   Options Dialog, like every converted source, and the player can untick them.
2. **Edges arrive earlier.** Tourniquet Line Chef and EMT Crash Course, Astro-Sense, Broadcaster, Takedown Expert,
   Ninja Power and Perfect Disguise now give their Edge through the automatic modifiers. The old code set
   `skillDataset.edge` afterwards. Two later checks now see this Edge:
   - Expert in Your Field turns its own Edge into ↑3 when an Edge already exists;
   - `roll:edge` CritOnD2 rules.

   Before, neither saw these Edges. Only these combinations change.
3. **Spoiled's Snag comes earlier.** It is now an automatic source, so it lands before "A" for Effort! and Basic
   Intelligence clear a Snag on untrained rolls. It is a cross-line combination: an untrained Requisition test by a
   holder of Spoiled who also has one of those two.
4. **Specialization names are matched by containing, not by equality.** `roll:specialization~X` matches any
   Specialization name that contains X. The old check needed the name to equal X, ignoring case. For example,
   "Aerospace" now matches Space.
5. **Specializations are counted by name.** Psych 101 and Peerless Pilot use `self:specializedIn:`. It counts
   Specializations that have a name, plus unmigrated Specialization items. The old check counted the keys in
   `specializations`. Peerless Pilot's Initiative rule from an earlier batch already reads it this way.
6. **Broadcaster's combat check.** `not:combat` means no *started* combat. The old check was `!game.combat`, so a
   combat that has been created but not started now still gives the Edge. This is the same accepted difference as the
   other `combat` tag conversions.
7. **Tracker's label is shorter.** It is now always "Tracker (Environmental)". It used to add the scene's terrain
   when that was what made the expertise active.
8. **Turn and round limits need a started combat.** This affects Strike Bonus, Heavy Force and Gutter Champion. The
   old `hasUsedThisTurn` and `hasUsedThisRound` counted against any `game.combat`. Uses recorded under the old flags
   (`strikeBonusUsedThisRound` and the like) aren't read, so a use already taken in the window where the update lands
   can be taken once more.
9. **Some Snags now land after the Snag is cleared.** The `clearSnag` switches (Eureka!, Eltarian Tech, Always Ready,
   Dependable Tanker, Hacking Algorithms) clear the Snag when the switches are applied (`runApplyDialog`). The old
   checkboxes cleared it later in the post-dialog code. Two Snags added in between are therefore no longer cleared:
   - the Ranger Prime reciprocal-Defense Snag;
   - Thrillseeker's self-imposed Snag, depending on the order of the items.
10. **Story Points come from the actor's own pool.** Dependable Tanker and Hacking Algorithms now pay through the
    rules engine's Story Point cost: `canSpendForActor` and `spendForActor`. For a player character this is the same
    pool and the same check as before. It also uses Ruthless Points first and fires `storyPointSpent` Triggers. For an
    NPC holder, it now uses the GM pool.
11. **Labels are fixed.** Strike Bonus's label no longer shows its ↑N, though the amount applied is unchanged. All the
    switches use rule labels instead of the old `E20.RollDialog*` strings.
12. **Always Ready's limit is shared.** It is now six switches, one per function, sharing one scene limit. Only the
    chosen function's switch can ever show.

## Changes outside regA, to reconcile with the regB merge

regB runs from the `getSkillRollOptions` line to the end of `rollSkill`. I removed the post-dialog consequence blocks
for:

- `applyGutterChampion`, `applyThrillseeker`, `twoHandedAssault`, `applyStrikeBonus`, `applyHeavyForce`;
- `applyIsolated`, `applyIRememberReadingAbout`;
- the `spentMilitaryFormality` block;
- `spendIdeaPoint`, `spendEltarianTech`, `applyAlwaysReady`, `applyDependableTanker`, `applyHackingAlgorithms`.

One comment was also touched: Spellcialize's "same shape as spendIdeaPoint/spendEltarianTech above". Nothing else in
regB changed, and regC is untouched.

Other files:
- **`helpers/roll-dialog.mjs`:** removed the 13 matching `xxxAvailable` context lines.
- **`apps/roll-options-dialog.mjs`:** removed the 13 matching form reads.
- **`templates/dialog/roll-dialog.hbs`:** removed the 13 checkbox blocks.
- **Constants and imports at the top of `dice.mjs`:**
  - Removed every id constant, its flag constant and its comment block that became unused: `ALWAYS_READY_*`,
    `BROADCASTER_ID`, `CALM_BEAST_ID`, `CHIVALROUS_ID`, `PUZZLE_SOLVER_ID`, `PSYCH_101_ID`, `EMT_CRASH_COURSE_IDS`,
    `TOURNIQUET_LINE_CHEF_ID`, `ASTRO_SENSE_ID`, `SPOILED_*`, `HONEST_ASSESSMENT_ID`, `TRACKER_ENVIRONMENTAL_ID`,
    `PEERLESS_PILOT_GIJ_ID`, `PERFECT_DISGUISE_*`, `EUREKA_PR_ID`, `ELTARIAN_TECH_ID`, `DEPENDABLE_TANKER_ID`,
    `HACKING_ALGORITHMS_ID`, `STRIKE_BONUS_*`, `HEAVY_FORCE_*`, `ISOLATED_*`, `GUTTER_CHAMPION_ID`, `THRILLSEEKER_*`,
    `I_REMEMBER_READING_ABOUT_*`, `MILITARY_FORMALITY_ID`, `TWO_HANDED_ASSAULT_ID`.
  - Removed the imports of `isPerfectDisguiseActive` and `isMetallikatoMultipleTargetsActive`.
- **Tests:**
  - `dice.test.js`: deleted the tests for the converted code. The five identical expected-dataset literals each lose
    10 `xxxAvailable` lines, and the input `dataset` fixture loses `ideaPointAvailable`, `strikeBonusAvailable` and
    `twoHandedAssaultAvailable`.
  - `conversions.test.js`: Broadcaster's old test now passes a `dataset`, which a real roll always carries.

**Unused language strings** (left in `lang/en.json` so it isn't edited, for the merge): `E20.RollDialogStrikeBonus`,
`RollDialogHeavyForce`, `RollDialogEureka`, `RollDialogEltarianTech`, `RollDialogAlwaysReady`,
`RollDialogDependableTanker`, `RollDialogHackingAlgorithms`, `RollDialogIsolated`, `RollDialogGutterChampion`,
`RollDialogThrillseeker`, `RollDialogIRememberReadingAbout`, `RollDialogSpendMilitaryFormality`,
`RollDialogTwoHandedAssault`.

## Skipped (89), with the missing engine piece

### No rule piece changes the die or the Essence the roll uses

- **Academic Studies:** the chosen Skill counts as Smarts-based. It needs a rule that overrides the rolled Essence.
- **Rolling another Skill's die automatically, keeping the rolled Skill:** Jacket Wrestler, Aerial Acrobat (best of
  three), Circuit Breaker, Cultural Connection (also Specialized at level 10), Brutal Verbalities, and Agency (a floor
  on Wealth). `SkillSubstitution` changes the Skill itself, and `useSkill` is only an optional switch. They need an
  automatic `useSkill`, best-of or floor RollModifier.
- **"A" for Effort! and Basic Intelligence:** they set an untrained die to d2 and clear any Snag. They need a die-floor
  rule plus a Snag clear after the dialog.
- **Savant Skill:** it fixes the final die at d4 and clears Edge and Snag. It needs a final-die override.
- **Jack of All Trades:** ↑1 but no crit. It needs a switch that suppresses the crit.
- **Programmable:** a spend switch would fit, but its d12 cap (`programmableCapD12`) needs a final-die cap.
- **Cunning Plan:** it rolls the Role Skill Die (`roleSkillDie`, not in `system.skills`, so `useSkill` refuses it) and
  costs Power.
- **Kind, But Firm:** `useSkill` would have to come from another item's choice (Empathy).
- **Worth A Shot / Worth Another Shot:**
  - its windows depend on combat (1 or 2 per scene outside combat, 1 per encounter in combat);
  - it uses the Targeting die and forces Specialized;
  - it needs a ballistic weapon owned.

### "Ignore the first downshift" has to apply before the dialog

- **Eltarian Training and Low Tech Priorities:** they cancel one point of the downshift total *before the dialog*,
  only when there is one, and Low Tech Priorities once per turn on its chosen Skills. `ignoreDownshift` applies after
  the dialog, to the final total, and its limit isn't spent conditionally. They need a pre-dialog `ignoreDownshift`.
- **Inventor:** Edge plus "ignore 1 downshift" after the dialog. They need `ignoreDownshift` on a DialogSwitch.
- **Ambitious:** it zeroes the Snag and every downshift after all the other post-dialog code. It needs `immune` on a
  DialogSwitch, applied late.

### Facts no tag or check answers yet

| Item | What it needs |
|---|---|
| Nemesis (Perk and Hang-Up) | Checks for `isDecepticonNemesis(target)` and `isNemesisInScene` |
| Charge Into Battle | A check for `isMultipleTargetsWeapon` |
| Show of Hands | A "no equipped weapon" tag, and the unarmed-attack scene flag through the Scene Clock |
| Down the Barrel, Ricochet | Tags for the Favourite Weapon: equipped, or the weapon rolled |
| Genius | Membership of the base Role's skill list |
| Peerless Pilot (PR) | The shift of each Driving Specialization (d6 or better) |
| Different Perspective | A formula reference to the rolled Skill's rank, to compare with Culture |
| Ranger Operator | A check for the active Form (`form-state.mjs`) |
| Friendly Fire | Its flag compared with the current combat's id |
| Pseudo-Science | A mission-window activation flag read through `isActiveForWindow`; there is no window-aware data tag |
| Empty Hands | "Wielding no weapon except the printed unarmed ones" |
| Violent | Reads the weapon's other effects |
| Martial Zord, Zero-G, Zord Sentience | Whether the Zord has a driver seated (`_getVehicleDriver`), for a rule on the Zord itself |
| Straight Shooter (TF) | Whether an automatic downshift is already present when the dialog opens; `roll:downshifted` isn't given to switches |
| Spellcialize (Mystical Understanding) | Whether the rolled Skill is already Specialized; there is no rolled-Skill data tag |
| Sabotage | The upshift equals the base Role Points' sneak-attack bonus; there is no formula reference to that item's `bonus.value` |
| Two Steps to the Right | The ally holder found the `getNearbyAllyTokens` way (known issue) |

### Ordering and combinations would change

- **Pressure Cooker (the Moxie Edge half):**
  - Its old Edge is set after Dependable and Old Reliable read `skillRollOptions.edge`. Those are Moxie Perks of the
    same Role, from the same book.
  - A switch's Edge would come first and change their "both d20s" and Hang-Up gates.
- **Burly / Rolling Thunder:**
  - Holding both gives one shared bonus, and Rolling Thunder adds the size difference with the vehicle.
  - Separate rules would stack.
- **Beloved:** one select with two exclusive options, ↑1 or remove the Snag, sharing a once-per-turn use. Its Snag is
  removed late. Two switches would let both be ticked.
- **Urban Jungle:** with no terrain set, the `terrain:` tag is unknown, so the rule would become an "ask" switch. The
  old code simply did nothing.
- **Environmental Expertise (with Guidance):**
  - its label depends on the terrain;
  - it consumes a Guidance bank from another actor;
  - it makes attacks Specialized but non-attacks Edge.
- **Good To Go:** a choice-scoped vehicle qualification that must not stack with the fixed qualification table.

### Side effects a switch or modifier can't run

These run code beyond the shift, during or after the roll. A DialogSwitch can't run steps, and an automatic modifier
can't mark the attack.

- **Iron Bravado:** it marks every attack.
- **Angry:** it also triggers its Hang-Up.
- **Caution To The Wind:** it banks a Defense penalty.
- **Double Agent:** its Defense-penalty half.
- **Saber-Toothed:** it changes the damage type.
- **Disarming Shot:** the post-hit disarm reads `applyDisarmingShot`.
- **Post-hit Conditions or effects:** Hobble, Crippling Blow, Dirty Blows, Get A Grip, Cryogenic Touch, Guardian
  Strikes, Stick In The Spokes, Interdiction, Bump and Run.
- **Post-roll results:** Analyze Target (it also charges an action), Psychoanalyst, Coax Surrender, Grinder, Menacing
  Glare, Instill Weakness, Deconstructionist, No Factor, Deceptive Warfare, Withering Fire.
- **Rolls auto-detected by their DIF, with post-roll effects:** Watchful Eyes, Rallying Cry (WTNV).
- **Per-target Defense or armor changes:** Quantum Cut, Penetrating Aim, Metallikato's ignore-armor checkbox.
- **Solo Shot:** a switch that only clears the Snag fails validation ("changes nothing"), and its close-range half isn't
  a roll shift.
- **Penetrating Shot:** its shift depends on the Volley count.
- **Size Matters:** it trades shifts for damage.
- **Dependable, Old Reliable, Legendary Dependability:** they set the d20 result to a fixed value.
- **Quiet as the Grave, Force Recon Sneak Attack:** the sneak-attack damage slot.
- **Driving Strike:** a select of a reroll or ignoring armor.
- **Fast Draw:** it is consumed in the action economy.
- **Field / Expert in Your Field:** it gives an Edge, or ↑3 when an Edge already exists. That needs an "Edge, or
  shifts if already Edge" piece.
- **Animal (the Wild Animal Kit's target check):** it is part of the kit's own select.

## Engine features that would unblock the most skips

1. An automatic die substitution (`useSkill` / best-of / floor on a RollModifier), and a final-die override or cap. This
   unblocks 10 items.
2. A pre-dialog `ignoreDownshift`, and `ignoreDownshift` / `immune` on a DialogSwitch. This unblocks 4.
3. Steps or marks on a DialogSwitch (run when it is ticked and the roll is made). This unblocks Angry and Caution To The
   Wind, and with post-hit effects, the intent checkboxes.
4. New `check:` names: `decepticonNemesis`, `nemesisInScene`, `multipleTargetsWeapon`, `activeForm:<uuid>`,
   `zordHasDriver`, `favoriteWeaponEquipped`.
5. A data tag on the rolled Skill (`roll:skillData:isSpecialized`) and a formula reference to the rolled Skill's rank.
6. An "Edge, or N shifts if the roll already has an Edge" switch or modifier, for Expert in Your Field.

## Verification

All three checks pass:

- `node node_modules/eslint/bin/eslint.js module/ --ext .js,.mjs --rule 'linebreak-style: off'`: clean.
- `node scripts/check-rules.mjs`: 1242 rules on 903 items, 0 errors, 0 warnings.
- `node --experimental-vm-modules ./node_modules/jest/bin/jest.js`: 503 suites passed; 9649 tests passed and 2 skipped.
