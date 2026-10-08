# Batch regB2: `dice.mjs` `rollSkill` after the Roll Options Dialog, second pass

**Scope:** every item `regB.md` left skipped (150, counted as regB counted them: one per id constant or table
entry), re-checked against the engine pieces added on 2026-10-03 after the regA/regB/regC round
(DieSubstitution, RollDice, Defense modes `best` / `halve` / `fail`, `outgoing` and `limit`, `late`
RollModifiers, ally auras and `stacks: false`, Cover auras, DialogSwitch `key` / `steps` with
`roll:switch:<key>`, DamageType, scaled DamageModifier `limit` / `steps`, `loseHealth`, the new tags and
`check:` names).

| Verdict | Items |
|---|---|
| Convert | 14 |
| Partial | 0 |
| Still skip | 136 |

15 rules were added to 13 pack items (Fleeting Energy needs none of its own). After this batch
`scripts/check-rules.mjs` counts 1269 rules on 921 items (base: 1254 on 912).

## Converted (14)

Each item's check in `rollSkill` is gone, with its id constant and its old `dice.test.js` describe. Their
behaviour is tested in `module/rules/conversions.test.js` (the `// regB2` block), loaded from the pack sources.
`dice.test.js` gained one describe proving RollDice rules reach the roll formula (min10, 3d20kh, the step up).
The Energy Affinity and Tooth And Claw damage-type describes were kept and now give the Perk its rule.

| Item | Rule | Why it is exact |
|---|---|---|
| Silver Tongue | RollDice `d20Floor: 10`, `essence:social` | `floorD20At10` was `rolledEssence == 'social' && hasPerk`. It is now `diceRules.d20Floor >= 10`, read at the same line. |
| Kill Shot | RollDice `thirdD20`, `attack:ranged` + `roll:edge` + `weapon:trait:sniper` | `attack:ranged` is "a weapon effect not in the melee style", `roll:edge` is the settled `skillRollOptions.edge` and `weapon:trait:` reads the parent weapon's `system.traits`. That is the old expression, at the same line. |
| Precision is Perfection | RollDice `thirdD20`, `attack:melee` + `roll:edge` + `weapon:trait:silent` + `weapon:trait:martialArts` | The same, for the melee clause. `RIDER.precisionIsPerfection` is removed. |
| Super Specialized | RollDice `stepUp: 1`, `roll:dataset:isSpecialized` + `skill:{item.choice}` | The rule's step sits where the old one did (after the auto-success conversion). `roll:dataset:isSpecialized` reads the same `dataset.isSpecialized \|\| skillRollOptions.isSpecialized` value. Later Fanning shots now take `superSpecialized: diceRules.stepUp > 0`. |
| Force | Scaled DamageModifier +1, `attack:unarmed` + `skill:might`, `limit: {per: encounter}`. Its `steps` bank the Fleeting Energy ↓1 (`appliesWhen: essence:strength`, `until: encounter`) when the actor holds that Hang-Up (`self:hasItem:`) | The scaled bonus joins `damageBonusValue` on the same rolls (only with `checkEntries`). The limit uses the same Scene Clock encounter window as `hasUsedThisEncounter`. The label is the Perk's name. |
| Fleeting Energy (Hang-Up) | The ↓1 bank above (no rule on the Hang-Up itself) | Its consumer (`pendingFleetingEnergy`, pre-dialog) is gone. The banked ↓1 is used up by the next Strength roll. |
| Shatter Resolve | Defense `any` -2, `outgoing`, Willpower / Cleverness against Deception / Persuasion | See the ordering note below. |
| Trustworthy (the roller's half) | Defense `any`, `mode: fail`, `outgoing`, `skill:deception` | Infinity absorbs every later term, so moving the Infinity from mid-block to the rules' step changes nothing. The target's +4 Cleverness rule was already there. |
| Pay It Forward | Defense `any` +1, `scope: aura`, `radius: 10`, `affects: allies`, `stacks: false`, `holder:morphed` | The aura counts allies through `getNearbyAllyTokens` (the old lookup) and counts the book item once. A `defense:` tag keeps it off the sheet. |
| Not On My Watch | Defense `any` +1, Toughness / Evasion, `check:defeatedAllyInReach` | The old line came after Roll With the Punches' doubling. Only additive terms sit between it and the rules' step. `getNotOnMyWatchDefenseBonus` (now unused) and its tests are removed. `hasDefeatedAllyInReach` stays. |
| Bear Hug (damage-type half) | DamageType `blunt`, `attack` + `item:damageType:grapple` | Its +1 was already a rule. The only hand-written overrides now ahead of it that used to come after are Illuminate (PR) and Energy Affinity (TF), both other lines. |
| Energy Affinity | DamageType `choice`, `priority: 1`, `check:energyAffinityAttack` | The check is "the chosen Element natively, or the activated style". Natively, the override is the attack's own type, so nothing changes. `priority: 1` keeps it behind Bear Hug, as in the old chain. |
| Tooth And Claw (Technorganic Secrets) | Two DamageType rules, `priority: -1`: `choice`, then `sharp`. Both need `self:transformed` and unarmed: `attack:unarmed` or `weapon:source:` one of the three printed Unarmed Combat weapons (`UNARMED_WEAPON_IDS`) | "The choice, else Sharp" is the second rule catching what the first leaves. `priority: -1` keeps it ahead of Bear Hug and Energy Affinity, as in the old chain. |
| Tooth And Claw (Decepticon Directive) | The same two rules | As above. |

### Engine tweak

`rules/adapter.mjs#ruleDefenseAdjust` now passes `holder` into the tag context, so a `holder:` tag on an aura or
party Defense rule asks the actor whose item it is (Pay It Forward's `holder:morphed`). For the defender's own
rules and the attacker's outgoing ones, the holder is `self`, as before. No pack Defense rule used `holder:` until
now.

## Behaviour differences

1. **Shatter Resolve moved in the Defense block.** Its -2 used to come early, before:
   - the better-of swaps (Psychological Warfare, Scapegoat, Evasive);
   - the recomputes (Drilling Shot, Quantum Cut, Charge It Up!, Omega Electro Mode, Penetrating Strikes, Exploit
     Weakness);
   - Roll With the Punches' doubling.

   It now lands at the rules' step. So the -2 comes after a better-of, it survives a recompute, and a doubled
   Defense is `2W - 2` instead of `2(W - 2)`. Each of those is a GI Joe or Power Rangers item, and Shatter
   Resolve is Transformers, so every case crosses lines. Clever Mind's delta is unaffected.
2. **Fleeting Energy's ↓1 is a rules bank now.**
   - It shows by name as a source in the Roll Options Dialog, and the player can untick it (it is still used
     up). Before, it was added silently.
   - It ends at the Scene Clock's encounter boundary (`until: encounter`): a new scene, or a combat ending. The
     old flag ended when its combat ended or changed, and never ended when banked outside combat.
   - It is read through `self:hasItem:`. A Fleeting Energy that Matured (GI Joe) ignores still banks; that is
     cross-line.
3. **"Unarmed" reads the item's `parentId`.** Force, and Tooth And Claw's no-weapon branch, use
   `attack:unarmed`. A weapon effect whose parent weapon is missing no longer counts as unarmed. regA2 accepted
   the same difference.
4. **Super Specialized at the top of the scale.** On a 3d6 roll it no longer steps onto `autoSuccess`, which
   isn't a rollable die. The old code put that shift into the formula. It also now comes after a RollDice
   `maxDie` cap (no pack item has one), and Programmable's d12 cap stays before both, as before.
5. **Pay It Forward comes after Roll With the Punches.** The +1 now lands after the doubling (`2D + 1`, was
   `2(D + 1)`). Roll With the Punches is GI Joe and Pay It Forward is Power Rangers, so this crosses lines. regB
   accepted the same for Heroic Intervention.
6. **Damage types now come after Illuminate.** Bear Hug, Energy Affinity and Tooth And Claw now lose to
   Illuminate (Power Rangers), where they used to win. That is cross-line for all three (GI Joe, Transformers,
   Transformers).
   - Energy Affinity with no Element chosen used to stop the chain with no override, which also blocked
     Illuminate. It now doesn't match.
   - Holding both Tooth And Claw printings: the first item's choice wins. The old code preferred the
     Decepticon Directive copy.
7. **Labels** are the rules' own (in the damage-bonus sources, Force keeps its item name).

Silver Tongue, Kill Shot, Precision is Perfection, Trustworthy and Not On My Watch: no differences found.

## Still skipped (136), and what each needs

### Out of this batch's hands (region or batch ownership)

These are unchanged from regB.

- **Checkbox Perks whose offering code is in regA's region** (57 entries in regB's list, Always Ready through
  Worth A Shot). Out of scope by the batch rules. regA2 re-checked them.
- **Attempt flags whose effect lives in `_rollSkillHelper` (regC's region):**
  - Stunning Surprise, Undo Engine, Leech Siphons, Ice Flechettes, Avalanche Stomp;
  - Stay Humble, Snarl, Might Makes Right, Predacon;
  - Supportive / Extra / Super Supportive Friend;
  - Everything Is Inspiration, Outfoxed, Shoots and Scores, Vibrating Palm, 'Til All Are One, But I Should Know
    That, Instinctual Caster;
  - Sucker Punch, Flashy, Explosive Aftershock, Brute Force Works Best, Roaming the Land (Stun half),
    Debilitating Strike, Shock and Awe, No Fighting?!.

  The new outcomes (`x2`, `anyFailed`, `fumbled`) and `roll:switch:` keys could express several of them as
  Triggers. Converting means deleting the regC-region consumers, so they are left for a regC pass. Debilitating
  Strike and Shock and Awe are also on regC's skip list.
- **Damage-bonus label lookups** (Now I'm Angry, Demolition Driver, Combat Stance, Retribution, Psycho Assault,
  Growing Smolder, Oorah!, Goin' Heels, Tear Down, Emotional Mastery, Ricochet, Size Matters, Penetrating Shot,
  Quiet as the Grave). Each label goes when its bonus converts. Oorah! and Goin' Heels are on regC's list.
- **Just the Facts.** `fail` + `self:levelDiff>=0` would express the Immune half, but the item is on regC's skip
  list (its incoming-Snag half), so it is left whole.
- **The Dependable Hang-Up.** It only gates regA's checkbox.
- **Saber-Toothed.** Convertible in principle: a DialogSwitch with a ↓1 and `key: saberToothed`, plus DamageType
  `sharp` on `roll:switch:saberToothed` with `priority` below Bear Hug's. Its only shift-reducer in between,
  Inventor, is Transformers.
  - The switch's ↓1 would land in `runApplyDialog`, before Inventor (Transformers) and before the WTNV-only
    downshift immunities. Both are cross-line.
  - Illuminate needs a parent Martial Arts weapon, and the switch is only offered with no parent weapon, so the
    two never meet.
  - Deferred anyway: its checkbox is offered from regA's region, and regA2 rewrote those exact lines (the
    `saberToothedAvailable` comment in `dice.mjs`). Deleting them would conflict with regA2, and it would also
    edit `roll-dialog.mjs`, `roll-options-dialog.mjs`, `roll-dialog.hbs` and `lang/en.json`, which regA2 edits
    elsewhere. Do it once regA2 has merged.

### Defense-block ordering (the new modes land at the rules' step, too late)

A per-attack Defense rule is decided inside `riderDefenseAdjust`. That is after every recompute, after Roll With
the Punches' doubling, and after every banked or live bonus. `best` and `halve` act on the difficulty passed in,
plus the rules' own additions. They don't see the other rider and extension adjustments made in the same call.

| Item | Why it still can't convert |
|---|---|
| Psychological Warfare, Scapegoat, Evasive (IAF2), Split-Second Reaction | The old better-of ran early. It came before Roll With the Punches' doubling (same line for the three GI Joe Perks: `max(2W, E)` vs `2·max(W, E)`) and before every later addition (Hard Target, Grid Surge and Resilience for the Power Rangers Perk). It also compared `getDefenseValue(...) + getShieldUpgradeBonus(...)` (driver, Relic Key and ally-shield substitutions), not the sheet total `best` reads. Needs a "best" phase at the old position that reads `getDefenseValue`. |
| Tactical Gymnastics | The same, plus its Acrobatics-ranks Evasion bonus inside the comparison and the Bulked Up Frame ordering. |
| Over the Candlestick (Agile Reflexes) | A replacement (Evasion even when lower), not a better-of, once per encounter. Needs a `use` Defense mode at the old position. |
| Bulked Up Frame | Still needs a Defense phase before the recomputes. |
| Unseen Strike | Halves after every rider adjustment; a rule's `halve` misses them. It is marked used on any attack while Phantom Suite is up, not only when it halves. No `check:` for Phantom Suite. |
| Augmented (Hang-Up) | Halves the final difficulty, rider adjustments included (Energic Shields, same line). The rule's `halve` leaves those out. |
| Penetrating Aim, Metallikato | Need an ignore-armor-points piece (and both are regA checkboxes). |
| Drilling Shot, Weak Point | Unchanged: Defense-bonus stripping, and Armor Piercing on unarmed attacks. |

### Post-dialog roll stages

| Item | Why |
|---|---|
| Silver / Graphite / Orange Ranger Prime | A `late` RollModifier is applied in `runApplyDialog`. That is before Solo Shot's and Observer's Snag clears (Solo Shot is A Jump Through Time, the same book as Orange Ranger Prime). It is also inside the same `applyRuleImmunity` pass whose `immune: ["snag"]` then clears it (Daredevil at 1 Health and the Torozord are Power Rangers). The old Snag came after all three and survived them. Needs a late stage after the hand-written post-dialog code, or `late` Snags exempt from that pass's immunity. |
| Emergency Care Equipment, Vehicle Repair Equipment | Zero the downshifts after the post-dialog die-substitution deltas (Intimidating, Transformers too). `immune` runs earlier. |
| Advantageous Fighter | Caps the total downshift at ↓2 with an Edge. RollDice `maxDie` caps the die, not the downshift. Needs a shift cap. |
| Storm of Lead | Fanning's first-shot ↑1, inside `items/attacks/fanning.mjs`. |

### Damage types

| Item | Why |
|---|---|
| Cryogenic Touch (Cold half) | As regA2 found: it would lose to Ninja Power (same line) and to Pointy / Saber-Toothed. |
| Ninja Power | No `check:` for Ninja Power being active (`isNinjaPowerActive`). It would also lose to Saber-Toothed (cross-line). |

### Other engine gaps (unchanged from regB)

- **Imaginative Engineering, Energon Efficiency:** tags for the core Energon box; an Energon refund.
- **Hard Hitter:** a tag for the ticked damage Role Points item.
- **Ultimate Magna Defender:** no scope reaches a Megaform from the Ranger who formed it.
- **Titan Body:** a damage floor, not a bonus.
- **Sudden Strike:** Sneak Attack eligibility.
- **Without a Word:** a tag for "an enemy anywhere has one of these statuses".
- **Show Of Hands:** a "no equipped weapon" tag and the scene flag (as regA2 found).
- **Spell damage tables** (Energy Beam, Lancing Beam, Explosive Beam, Beam Volley, Fireball (KoC)): data on the
  spells, not rules.

## Overlap with regA2 (`origin/rules/regA2`, not yet merged)

- **No shared pack files.** regA2 touched Agency, Zord Sentience, Aerial Acrobat, Down the Barrel, Two Steps to
  the Right, Cultural Connection, Cryogenic Touch, Martial Zord, Zero-G, Brutal Verbalities, Circuit Breaker,
  Charge Into Battle and "A" for Effort!. None of these are among this batch's 14 files.
- **Shared code and test files:** `module/dice.mjs`, `module/dice.test.js` and `module/rules/conversions.test.js`.
  - In `dice.mjs` and `dice.test.js`, every hunk here is in a different place from regA2's.
  - Both batches append a block to the end of `conversions.test.js`; keep both when merging.
  - The two kept damage-type describes in `dice.test.js` were edited a few lines below their headers, not on
    the header line regA2's hunk ends on.
  - This batch does not touch the `conversions.test.js` import line (it uses dynamic imports).
- **Not touched:** `lang/en.json`, the roll dialog files and every file regA2 edits apart from these three.
  Saber-Toothed was deferred to keep it that way.
