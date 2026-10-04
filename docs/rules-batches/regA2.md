# Batch regA2: `dice.mjs` `rollSkill` before the Roll Options Dialog, second pass

**Scope:** every item `regA.md` left skipped, and the "what stays code" half of each regA partial, re-checked against
the engine pieces added on 2026-10-03 after the regA/regB/regC round (DieSubstitution, RollDice, Defense modes,
`late` RollModifiers, ally auras / `stacks`, DialogSwitch `key` / `steps` + `roll:switch:`, DamageType, scaled
DamageModifier limit/steps, `loseHealth`, the new `check:` names and tags).

**Counts** (93 items re-checked: regA's 89 skips, counted as regA counted them, plus the code halves of its other 4
partials; Metallikato's ignore-armor checkbox is in regA's skip list already):

| Verdict | Items |
|---|---|
| Convert | 11 |
| Partial | 2 |
| Still skip | 80 |

15 rules were added to 13 pack items. After this batch `scripts/check-rules.mjs` counts 1269 rules on 924 items.

## Converted (11)

Each item's code in `rollSkill` is gone, with its id constant, its old `dice.test.js` tests and (where it had one)
its dialog checkbox. Their behaviour is tested in `module/rules/conversions.test.js` (the `// regA2` block).

| Item | Rule |
|---|---|
| Aerial Acrobat | DieSubstitution `best` of Acrobatics / Driving, `attack` |
| Circuit Breaker | DieSubstitution `best` of Technology, `attack` with `item:damageType:electric` or `weapon:trait:electric` |
| Cultural Connection | Two DieSubstitution `best` of Culture rules on Deception / Persuasion, gated on the rolled Skill being trained (`not:roll:dataset:shift=d20`, and `not:roll:untrained` when the roll carries no die); the first adds `specialize` at level 10 (`self:level>=10`, or `self:data:system.threatLevel>=10` like `getEffectiveLevel`) |
| Brutal Verbalities | DieSubstitution `best` of Intimidation on `skill:persuasion` + `roll:dataset:isRouseAttempt` |
| Agency (Wealth half) | DieSubstitution `best` of `skills: ["choice"]` on `skill:wealth` (its Edge half was a rule already) |
| "A" for Effort! | DieSubstitution `floor` d2 with `clearSnag`, `roll:dataset:shift=d20`, `limit: {per: session}` |
| Charge Into Battle | RollModifier ↑1, `attack` + `check:multipleTargetsWeapon` |
| Down the Barrel | RollModifier Edge on Intimidation / Persuasion, `check:favoriteWeaponEquipped`, `not:roll:dataset:isInitiative` |
| Martial Zord | RollModifier ↑1, `self:type:zord` + `attack:melee` + `check:zordHasDriver` |
| Zero-G | RollModifier ↑1, `self:type:zord` + `attack:ranged` + `check:zordHasDriver` |
| Zord Sentience | RollModifier ↑1, `self:type:zord` + `skill:driving` + `not:check:zordHasDriver`, `not:roll:dataset:isInitiative` |

Why the substitutions are exact: DieSubstitution runs right after the hand-written block, so these five best-of Perks
move behind Kill Counter (best-of) and ahead of Basic Intelligence (still code, still right after the rules). A
best-of commutes with any other best-of, so the starting die is unchanged. Jacket Wrestler's outright swap stays
code, so it still comes first. "A" for Effort! is a WTNV Origin; no WTNV item substitutes the die, so within its line
the floor applies exactly when the old code did (`dataset.shift` is d20; an Essence's untrained-bonus d2 still counts).
Its snag clear and use now happen at the same two spots (`dieRules.clearSnag` / `dieRules.spend()`).

Also removed for "A" for Effort!: its entry in the qualify2 session gate (`SESSION_GATED.aForEffortUsedThisEncounter`
and `Q2.aForEffort`, `helpers/extensions/qualify2/`). The rules limit `per: session` reads the same
`essence20.q2SessionEpoch` counter that gate carried.

## Partial (2)

| Item | Converted | Stays code |
|---|---|---|
| Two Steps to the Right | The Edge on Infiltration / Survival for an ally within 60 ft: an aura RollModifier (`radius: 60`, `affects: allies`, `stacks: false`), which counts allies through `getNearbyAllyTokens` like the old check | Its Cover reduction in `_getAutomaticCombatModifiers` (regC's region; `TWO_STEPS_TO_THE_RIGHT_ID` stays for it). An aura Cover `reduce` rule could replace it, but that is regC's item. |
| Cryogenic Touch (Power) | The "spend 1 Power: Impaired on a hit" checkbox: a DialogSwitch (`key: cryogenicTouch`, cost 1 Personal Power, `attack:unarmed`) plus a `hit` Trigger (`roll:switch:cryogenicTouch` → `applyCondition impaired` to the target). Removed: the availability line, the Power spend, `checkContext.cryogenicTouchAttempt` and its post-hit loop, the dialog context / form read / template block, and the `E20.RollDialogCryogenicTouch` string | Its Cold damage type (the `overriddenDamageType` chain, regB's region). A DamageType rule runs after every hand-written override, so Ninja Power and Illuminate (same line) would win over it. |

## Behaviour differences

1. **Shifts and Edges are listed.** Charge Into Battle, Martial Zord, Zero-G and Zord Sentience's ↑1 and Down the
   Barrel / Two Steps to the Right's Edge are now named sources in the Roll Options Dialog, and the player can untick
   them. Before, the shifts were summed silently and the Edges set on `skillDataset.edge`.
2. **The two Edges arrive earlier.** They now come from the automatic modifiers, so Expert in Your Field (G.I. JOE)
   and `roll:edge` CritOnD2 rules see them. These are cross-line combinations (Down the Barrel and Two Steps are
   Transformers). The one same-line `roll:edge` rule, Energy Connection, is attack-only, and these Edges are not.
3. **"A" for Effort!'s use is a rules limit now.** A use recorded under the old `aForEffortUsedThisEncounter` flag
   isn't read, so it can be taken once more in the session the update lands. Cross-line only: if another line's
   substitution has already improved an untrained die, the floor no longer applies. The old code forced d2 over it,
   cleared the Snag and spent the use.
4. **Cultural Connection's "trained" gate reads the roll's own die.** That means `dataset.shift`, or the actor's
   Skill when the roll carries none. It used to read the die as it stood at that point. Two consequences:
   - With an Essence's untrained bonus (a Power Rangers or Night Vale grant, so cross-line), an untrained
     Deception/Persuasion roll no longer switches to Culture. The old code made it d2 first.
   - A Deception/Persuasion *weapon attack* whose die an earlier substitution had improved is now judged on its own
     die.
5. **Cryogenic Touch's Impaired goes through the rules step.** That adds a chat line for the Condition. It uses
   `applyTimedCondition`, and relays to the GM when the user can't modify the target; the old code toggled the status
   directly. `attack:unarmed` means "no `parentId`". The old check also treated a weapon effect whose parent weapon
   was missing as unarmed. The Power is paid through `changeResource`, which never goes below 0.
6. **Two Steps to the Right's aura needs its holder's token on the canvas.** The old `getNearbyAllyTokens` lookup did
   too. Several holders in reach still give one Edge.
7. **Labels** are the rules' own, so the Cryogenic Touch switch is no longer `E20.RollDialogCryogenicTouch`.

## Still skipped (80), and what each still needs

### Die substitution and the dice

| Item | Why it still can't convert |
|---|---|
| Jacket Wrestler | `use` must run before Aerial Acrobat's best-of (both G.I. JOE; a Might grapple attack with both is best-of Finesse/Acrobatics/Driving). DieSubstitution rules run in item order, so it would give Finesse alone whenever Aerial Acrobat's item comes first. Needs an ordering (priority) for DieSubstitution. |
| Basic Intelligence | It forces d2 whenever `dataset.shift` is d20, even over a die Aerial Acrobat / Brutal Verbalities / Cultural Connection / Jacket Wrestler (same line) just improved, and clears the Snag. A floor only applies at or below d2. Needs a "set the die" mode keyed on the raw die. |
| Academic Studies | Nothing overrides the rolled Essence. |
| Savant Skill | A checkbox that fixes the final die at d4 and clears Edge and Snag. RollDice `maxDie` is a cap, not a fixed die, and has no switch. |
| Programmable | The d12 cap applies only when the spend was used: RollDice `when` isn't handed switch keys. It also lands after Super Specialized's step and the auto-success conversion, where the old cap came before both. |
| Jack of All Trades | Needs a switch that suppresses the crit. |
| Cunning Plan | The Role Skill Die isn't in `system.skills` (`useSkill` refuses it), plus a Power cost. |
| Kind, But Firm | `useSkill` from another item's choice (Empathy). |
| Worth A Shot / Worth Another Shot | Windows that depend on combat, the Targeting die plus forced Specialized, and "owns a ballistic weapon". |

### "Ignore the first downshift" before the dialog

| Item | Why |
|---|---|
| Eltarian Training, Low Tech Priorities | Still need a pre-dialog `ignoreDownshift` (and Low Tech's limit spent only when there was a downshift). |
| Inventor | Needs `ignoreDownshift` on a DialogSwitch, applied after the other switches' downshifts. |
| Ambitious | Needs `immune` on a DialogSwitch, applied after the post-dialog code. |

### Facts and stages

| Item | Why |
|---|---|
| Nemesis (Perk) | `check:decepticonNemesis` covers the fact. A rule's ↑1 joins the automatic-modifier total, which Fanatic (same book) caps afterwards; the old ↑1 came after Fanatic. A `late` modifier misses the dialog's starting total and every hook that reads it. Needs a stage after Fanatic but before the dialog. |
| Nemesis (Hang-Up) | The same, for its ↓1. Straight Shooter (TF) also reads the automatic downshift total, which the old ↓1 never joined. |
| Show of Hands | No "no equipped weapon" tag, and its scene flag is read through the Scene Clock. |
| Ricochet | `check:favoriteWeaponRolled` covers the gate. Its switch's ↓1 lands in `runApplyDialog`, before Inventor's "ignore 1 downshift" (same line); the old ↓1 came after it. Needs switch downshifts applied late. |
| Genius | The base Role's Skill list. |
| Peerless Pilot (PR) | The shift of each Driving Specialization. |
| Different Perspective | A formula reference to the rolled Skill's rank. |
| Ranger Operator | A check for the active Form. |
| Friendly Fire | Its flag compared with the current combat's id. |
| Pseudo-Science | A mission-window activation flag. |
| Empty Hands | "No weapon except the printed unarmed ones". |
| Violent | The weapon's other effects. |
| Straight Shooter (TF) | Whether an automatic downshift exists when the dialog opens. |
| Spellcialize | Whether the rolled Skill is already Specialized. |
| Sabotage | The base Role Points' bonus value as a formula. |

### Ordering and combinations

| Item | Why |
|---|---|
| Pressure Cooker | Its Edge must come after Dependable / Old Reliable read the Edge. |
| Burly, Rolling Thunder | A `stack` group would give the shared bonus, but Rolling Thunder adds the size difference using the bigger of the actor and the piloted vehicle; no formula reads the vehicle's size. |
| Beloved | Its "remove Snag" half comes after the Ranger Prime Snag; a `clearSnag` switch clears it earlier. |
| Urban Jungle | With no terrain set, `terrain:` is unknown, so the rule would become a switch. |
| Environmental Expertise | Label by terrain, Guidance consumed from another actor, Specialized vs Edge. |
| Good To Go | Must not stack with the qualification table. |

### Side effects

| Item | Why |
|---|---|
| Iron Bravado | Its attack mark is a helper flag, not a rules mark. |
| Angry | `steps` can now run, but its Hang-Up half is a picker over trained Smarts/Social Skills banking a scene-long Snag that `gij-fixes.mjs` reads, gated on holding the Hang-Up. No step does that. |
| Caution To The Wind | Switch `steps` don't get `@spent`, and the old Defense penalty is a pending bonus read in regB's region. |
| Double Agent | Its Defense half: Defense rules' `when` isn't handed the ticked switch keys (`riderDefenseAdjust` ctx has no `ruleKeys`). |
| Saber-Toothed | A DamageType rule runs after Bear Hug's override (same line), so a ticked Saber-Toothed Bear Hug grapple would deal Blunt instead of Sharp. |
| Hobble, Crippling Blow, Disarming Shot | Their switch downshifts would land before Inventor / Ambitious (same line) instead of after them, and Hobble / Crippling Blow use a Condition picker on the hit. |
| Dirty Blows, Guardian Strikes, Stick In The Spokes, Interdiction | Forgoing the attack's damage has no rule piece; Guardian Strikes also picks a Condition. |
| Get A Grip | The size gate and the 2-Free-action spend on the first legal hit target. |
| Bump and Run | The ↑1 switch with `key` and a `hit` Trigger (`outcome: x2`, Stunned) would match. But `helpers/extensions/other3/tf.mjs` also reads `checkContext.bumpAndRunAttempt` for its "move after the attack or be Impaired" check, so that hook would have to read `riderContext.switches` first. |
| Grinder | Its checkbox also feeds a synthetic 2 Blunt damage into the plain Skill Test's damage pipeline. No rule piece does that. |
| Analyze Target, Psychoanalyst, Coax Surrender, Menacing Glare, Instill Weakness, Deconstructionist, No Factor, Deceptive Warfare, Withering Fire | Post-roll results through their own helpers: an action charge, the synthetic Stun damage, prompts, Story Point requests. |
| Watchful Eyes, Rallying Cry (WTNV) | Detected by their DIF, with post-roll effects. |
| Quantum Cut, Penetrating Aim, Metallikato's ignore-armor | Per-target armor changes. Defense `mode` has no "ignore armor" or "force Toughness". |
| Solo Shot | A `clearSnag` switch is valid now, but it clears the Snag inside the rules hook. Other `applyDialog` hooks that add Snags (PR's `giveSnag`, Grappled) may run after it; the old clear came after all of them. |
| Penetrating Shot | Shift from the Volley count. |
| Size Matters | Trades shifts for damage. |
| Dependable, Old Reliable, Legendary Dependability | Set the d20 result. RollDice has only the 10 floor. |
| Quiet as the Grave, Force Recon Sneak Attack | The sneak-attack damage slot. |
| Driving Strike | A select of a reroll or ignoring armor. |
| Fast Draw | Consumed in the action economy. |
| Field / Expert in Your Field | "Edge, or ↑3 if already Edge". |
| Animal | Part of the Wild Animal Kit's own select. |

### regA's other partials: the code halves

| Item | Still code because |
|---|---|
| Honest Assessment's ↓2 | It must come after Expertise's "ignore the first ↓". Expertise is a same-line MLP Perk, and every rule stage (automatic or `late`) would change that order. |
| Takedown Expert's post-hit Condition | It's inside the Takedown flow's own picker (regC region, `gij3/dice-hooks.mjs`). |
| Ninja Power's element damage type | DamageType runs after Illuminate's override (same line); regB region. |
| Perfect Disguise | Nothing left in `dice.mjs`. Its toggle and sneak-attack eligibility live in helpers. |

## What would unblock the most

1. **A stage for rule modifiers after Fanatic but before the dialog.** It would unblock both Nemesis items.
2. **Switch downshifts applied after the post-dialog checkboxes**, a "late" switch. It would unblock Ricochet,
   Hobble, Crippling Blow, Disarming Shot and Saber-Toothed's ↓1. Saber-Toothed also needs DamageType to take
   precedence over Bear Hug, or a priority on it.
3. **An order for DieSubstitution rules, plus a "set the die" mode keyed on the raw die.** It would unblock Jacket
   Wrestler and Basic Intelligence.
4. **Switch keys handed to Defense and RollDice `when`.** It would unblock Double Agent's Defense half and
   Programmable's cap (Programmable also needs the cap moved before Super Specialized).
5. **Steps that can read `@spent` and pick a Skill.** It would unblock Caution To The Wind and Angry.

## Merge notes

- Two Steps to the Right and Cryogenic Touch now have a `rules` array. A later regC/regB pass that converts their
  other halves (Cover reduction, Cold damage type) will add rules to the same files.
- The `qualify2` session gate lost its "A" for Effort! entry.

## Verification

- `node node_modules/eslint/bin/eslint.js module/ --ext .js,.mjs --rule 'linebreak-style: off'`: clean.
- `node scripts/check-rules.mjs`: 1269 rules on 924 items, 0 errors, 0 warnings.
- `node --experimental-vm-modules ./node_modules/jest/bin/jest.js`: 503 suites passed; 9625 tests, 9623 passed and
  2 skipped.
