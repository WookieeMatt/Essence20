# Batch slD3: re-check of slD2 (`react`, `resource`, `other1`, `other3`) against the 2026-10-05 engine pieces

**Scope:** every item `docs/rules-batches/slD2.md` left Skipped, plus the code half of every item it left Partial (110
items), re-checked against "Engine features added 2026-10-05 (after slice round 2)" in
`docs/RULES_CONVERSION_GUIDE.md`: the durations (`endOfNextTurn`, `turnOrScene`, `roundOrScene`, `rounds:N`,
`untilOf`), watch Triggers, Reaction rules and their card steps (`negateHit`, `lowerTotal`, `lateSnag`,
`convertRows`), button limits, dice in formulas, `@target` in step formulas, `{var.x}` in chat text, `legacy` picks,
`rule:granted` / `item:granted` and `createItem` children. The Reaction rule was built for this slice, so each
hand-written `registerReaction` in `react/reactions.mjs` was compared with what `rules/reactions.mjs` does: who is
offered the button, when, the limit and when it is spent, the cost, and what the card shows.

| Verdict (re-checked items) | react | resource | other1 | other3 | Total |
|---|---|---|---|---|---|
| Convert (was skip) | 7 | 0 | 0 | 0 | **7** |
| Partial, unchanged | 1 | 2 | 0 | 0 | **3** |
| Still skip | 23 | 27 | 25 | 25 | **100** |
| Re-checked | 31 | 29 | 25 | 25 | **110** |

Of the 7 conversions, 4 are exact only once the small engine edits under "Edits outside my files" are applied. Those
4 are Legendary Cruelty, Soldier On, Not On My Watch (TF) and Sidestep, and Not Perfect / That's Right lean on them
too. Energon Manipulator needs no edit.

**8 rules were added to 7 pack items**, and Body of Energy's existing rule had one chat line changed. After the
change, `scripts/check-rules.mjs` reports 1618 rules on 1092 items, with 0 errors and 0 warnings. Other agents were
adding rules at the same time, so that total is not this batch's alone. ESLint is clean on the files I touched.
Jest passes: 129 tests across the four slice folders, `conv3-slD3.test.js` and `engine3.test.js`.

## Converted

All are new `system.rules` arrays (CRLF, inserted as text).

- **Legendary Cruelty** (`packs/ccitems/_source/Legendary_Cruelty_Lcs6Pz0I0I7QJday.json`). One Reaction:
  - who: `target`, outcome: `miss`, `attackOnly`, limit once per `turn`.
  - `when: ["target:data:system.defenses"]` requires a known attacker.
  - Step: `roll` Intimidation against `max(@target.system.defenses.willpower.total, @target.system.defenses.cleverness.total)`.
  - `onSuccess`: a `button {who: gm}` whose step is `damage` 1 Psychic to the target (the attacker).

  This matches the old `reactors` filter (`isAttack`, row missed, a holder rolled against). It also matches
  `bestDefense(attacker, ['willpower','cleverness'])`, `markUsedThisTurn` after an uncancelled roll (outside combat
  it is never used up, both ways), and `damageButton(..., 1, 'psychic')`, the GM-only apply.
- **Sidestep** (`packs/prcrbitems/_source/Sidestep_YhdTm7qhaPCoiDab.json`). One Reaction:
  - who: `target`, outcome: `hit`, cost 1 of `system.powers.personal.value`.
  - `when` has three entries: an area item (`{any: ["item:data:system.shape", "item:data:system.radius>0"]}`, the same
    test as target-riders' `isArea`), `defense:evasion`, and `self:skill:acrobatics>=d2`.
  - Steps: eight `lowerTotal` steps, each gated on `self:skill:acrobatics=<die>`, with amount `1d2` … `1d12`, `2d8`,
    `3d6`. Only the actor's own die fires, which is the old `rollSkillDie`.

  `lowerTotal` negates rows that drop below their DIF and reports the rest as still hit. That is the old `lowered()`.
- **Soldier On** (`packs/tfcrbitems/_source/Soldier_On_0fal8jy083wWSy7W.json`). One Reaction:
  - who: `target`, outcome: `hit`, `attackOnly`, `when: ["damage:crit"]`, limit once per `encounter`.
  - Step: `roll` Brawn against `10 + @var.damage` (the row's base damage), `onSuccess: negateHit`.

  The old code was `row.success && row.isCrit`, then `getUses(...,'encounter')` marked after an uncancelled roll.
- **Not On My Watch (TF)** (`packs/tfcrbitems/_source/Not_On_My_Watch_cvgYI2FTjeIrUcLK.json`). One Reaction:
  - who: `enemyOfAttacker`, per: `card`, outcome: `hit`, `when: ["not:roll:edge"]`, limit once per `encounter`.
  - Step: `choose` Deception / Intimidation / Persuasion. Each option is a `roll` with `difDefense` set to the
    attacker's Cleverness / Willpower / Willpower, and `onSuccess: lateSnag`.

  The card-wide `lateSnag` keeps the lower d20 and negates every row that now falls short. That is the old
  `lateSnag` + `negateHit` loop.
- **Not Perfect, But Better** (`packs/sssitems/_source/Not_Perfect__But_Better_VtsUIbJm3HfFn12M.json`). One
  Reaction:
  - who: `allyOfAttacker`, per: `card`, outcome: `miss`.
  - cost 1 Story Point (`{storyPoints: true}`, the same `canSpendForActor` / `spendForActor` pair), limit once per
    `scene`.
  - Step: `convertRows`, which is `core.convertRows`: the reason line, plus each newly hit row's damage as a GM Apply
    button.
- **That's Right, Perfect** (`packs/sssitems/_source/That_s_Right__Perfect_dAoJG7ZwVEhOQZY0.json`). The same, with
  no outcome filter and `convertRows {crit: true}`. That gives the base damage on hit rows and twice it on missed rows,
  as before. It has its own scene limit, so it can be used after Not Perfect.
- **Energon Manipulator** (`packs/dditems/_source/Energon_Manipulator_cOVq7EH6HPrXmhBC.json`). Two rules, both
  `heal 1d2` (capped at max, the same as `energonHeal`):
  - a Trigger `defeatedEnemy` with `when: [{any: ["target:canTransform", "target:tag:cybertronian", "target:tag:robot"]}]`
    (the same `creatureTagsOf` test);
  - a Use for the "destroyed an Energon object" half.

**Body of Energy** (partial, unchanged in scope): slD2's difference "the chat card no longer shows the amount" is
fixed. The rule's chat step now reads `{name} turns {var.moved} Health into Personal Power.`

Removed with these:
- **`react/reactions.mjs`:** the six `registerReaction` blocks, `allyHolders`, `storyPointConvert` and
  `SOCIAL_DEFENSE`. Also their `REACT` keys (`legendaryCruelty`, `notPerfect`, `thatsRight`, `sidestep`,
  `tfNotOnMyWatch`, `soldierOn`) and the now-unused imports `getUsesThisScene`, `markUsedThisScene`, `bestDefense` and
  `defenseOf`.
- **`react/triggers.mjs`:** `TRIG.energonManipulator`, `energonHeal`, the Energon Manipulator `registerUse`, its branch
  in the `registerAfterDamage` hook (which Revengeful still uses) and the `registerUse` import.
- **`react/react.test.js`:** the Legendary Cruelty and That's Right offer tests. Their assertions are in
  `module/rules/conv3-slD3.test.js`: offered on a miss and not on a hit, offered to the roller's ally, and Not Perfect
  not offered on a success.
- **`react/core.mjs`:** unchanged. Every export stays.

## Behaviour differences worth a decision

Same-line unless marked.

1. **Who can be offered a card-wide reaction (TF Not On My Watch, Not Perfect, That's Right).** The old code
   searched every world actor holding the item (`holdersOf`). `rules/reactions.mjs` looks only at actors with a token
   on the current canvas. A holder whose token is not in the scene no longer gets the button.
2. **Buttons hidden instead of warning.** The old Sidestep / Not Perfect / That's Right buttons showed even without an
   Acrobatics die, Power, or a spendable Story Point, and warned when pressed. The rules don't offer them then.
3. **Not Perfect, multi-target rolls.** The old offer needed every row to fail (`rollFailed`). The Reaction's `miss`
   needs one failed row, and `convertRows` then converts only the failed rows. Single-target and flat-DIF tests are
   unchanged.
4. **Sidestep's die.** It is rolled by the formula engine and shown as a "rolled" line in the reaction's card. The old
   code posted a Foundry roll message, so there is no Dice So Nice animation now. The lowered total also carries to any
   later reaction on the same rendered card (`info.total` is updated), where the old `lowered()` left it alone.
5. **Card text.** The button reads "Actor: Item" (rules/reactions.mjs), not just the item name. Results are one rules
   card per press: "CardNowMisses", "CardStillHits", "CardLateSnag", "CardNegated". These replace the separate
   React* lines. The Legendary Cruelty GM button is a rule button labelled "Apply 1 Psychic damage (Legendary
   Cruelty)".
6. **Energon Manipulator attribution.** The heal now goes to the Apply-Damage card's speaker, as a world actor
   (`chat.mjs` `source`). The old code credited the attacker of the last card the GM clicked within 2 minutes. Damage
   applied through another button no longer credits a stale card's attacker, and an unlinked token attacker is read
   as its base actor. The Use now posts a rules card ("rolled 1d2", "Healed") instead of one line.
7. **Limits restart once.** The old flags (`reactLegendaryCruelty`, `reactSoldierOn`, `reactTfNotOnMyWatch`,
   `react-<uuid>`) aren't read any more. A use spent just before the update is forgotten that one time.
8. **Without the outside edits below:**
   - Not On My Watch (TF) is never offered (`roll:edge` unknown), and neither is Soldier On (`damage:crit` unknown).
   - Sidestep's Evasion test falls back to the item's own `defenseType`.
   - Reaction rolls would go against the user's targeted token instead of the flat DIF.
   - A cancelled roll or Skill choice would still claim the button. A cancelled roll would also spend the limit.
   - Not Perfect / That's Right on a plain Skill Test (no target row) would spend the Story Point and post nothing.

## Still skipped (100), and what each still needs

### react (23)
- **Desperate Parry**: a "wielding a weapon" tag, a break-the-wielded-weapon step (+ Junker announcement), and the
  out-of-combat "always armed" reading of the Contingency.
- **Point-Defense Reflexes**: a wielded-Targeting-weapon tag, a Snag option on a `roll` step, and the arming.
- **Advanced Anti-Air Training**: goes with Point-Defense Reflexes.
- **Projectile Deflector**: the crit's GM damage button needs the row's damage and type, but a `button`'s steps can't
  read the poster's vars.
- **Shoot Out**: a wielded-ballistic-weapon tag and a roll with that weapon's Skill.
- **Defender (PR)**: a wielded-Finesse-weapon tag, and exclusion of the attacker from `allyOfTarget`.
- **Defender (Megaform Trait)**: offers to the pilots of a Megaform's members (Reaction `who` has no such side).
- **Counterstrike (DD)**, **Steady Footing (counter half)**: a step that sets the user's targets, a one-slot bank
  tied to the attacker, and a bonus attack that doesn't stop the run outside combat. `maxMargin: -5` and the round
  limit now fit.
- **Junker**: an "equipment broke" event.
- **Not On My Watch (IA)**: the watch `defeated` Trigger fires only from `applyDamage`, while the old code reacts to
  any update to 0 Health. It also needs whispered cards, and holders off the canvas.
- **All For One**: a drop-to-0 Power event and a card with two answers (Health / Power). Per-presser button limits
  now exist.
- **Agency**: a rule read by dice.mjs's Fumble Story Point grant.
- **Their Loss, My Gain**: the watch `afterRoll` within 60 ft fits, but the old test is "Fumble AND every row failed".
  `fumbled` and `allFailed` can't be combined, and a Fumble can succeed (dice.mjs checks both). The heal also reads
  the Loss and Gain item's stored bonus, which no formula can reach.
- **Cruel Conflagration**: a whispered card with two answers on a Fumble (damage / both).
- **Revengeful**: a tag comparing a stored uuid with the Defeated target.
- **Inspirational Leader (combat half)**: storing the rolled Skill for an allies aura until the end of the round.
- **Monster Morph**: a roll against every creature within 10 ft at once, and a per-Path rule home.
- **Iron Bravado (share half)**: copying Condition immunities to allies.
- **Cyborg**: an Essence damage redirect and a heal lock.
- **Mind Beam**: a rule reading the spell's pre-roll effect choice.
- **Energized**, **Spiked**, **Energy Field**: an incoming DialogSwitch and a "plain Reach" attack tag.

### resource (27)
- **Play Favorites**, **Play Favorites Against Each Other**, **This, I Command**: a personal Story Point resource.
- **Ruthless Efficiency**: watch `turnEnd` now fits the event, but it also needs those personal points.
- **Money Talks**, **Capable Freelancer**: a confirmable pre-roll Skill swap that rewrites the dataset.
- **Motor Pool Connections**: a vehicle picker, per-vehicle budgets, and a grant onto another actor.
- **Inner Conservation**, **Power Efficiency**, **Dino Charged**, **Fuel Efficient**: a `resourceSpent` event.
- **Repair Progress**: a gain past `.max`.
- **Body of Energy (damage / unmorph halves)**: a pooled-resource damage modifier, and an unmorph Trigger with the
  pre-update values.
- **Dark Energon**, **Primal Energon**, **Red Energon**, **Synth-En**: conditional `choose` options, an actor-flag
  stamp step, and the addiction attack.
- **Word of Unicron**: the addiction roll as a rule roll.
- **Together We Stand**: dice in `heal` amounts now work. It still needs a "two or more team members" combat-start
  gate, per-recipient de-duplication, and ledger-recorded temporary Health.
- **Think Fast!**: `storyPointSpent` with the spend kind.
- **We Improvise**: a per-combat ledger.
- **Beast Mode**: an event on its flag and level-gated packages.
- **Honest Compassion**: heal Essence damage, plus a formula Rest limit.
- **Musical Interlude**: a card with three answers and an Essence-damage step.
- **Camper**: a scene-window state for an aura, and a Stress heal.
- **Zap Apple Jam**: conditional `choose` options and an Essence heal.
- **Circle of Magical Friends**: Circle recipients and copying items.
- **Extensive Research**: a world-time (one week) expiry.
- **History Buff (Use half)**: a blind one-die-smaller roll.

### other1 (25)
- **Interspatial Pause**: hiding tokens, and a no-damage mark.
- **Quantum Trigger**: re-rolling the last roll.
- **Timeslide**: moving a token.
- **Time Strike**, **Onslaught**: hit rider options from sibling effects.
- **Special Program**: compendium-Perk picks with prerequisite labels.
- **Lance of Light**: a target / range gate before the cost.
- **Savant Skill**: a reroll-result Trigger, and "add a d4".
- **Good with Both**: an equipped-items count.
- **Unlucky (For You)**: watching the hit target's next Skill Test, and a per-target limit.
- **Altered**, **Additional Alteration**: an Alteration cost waiver.
- **Overload**: the target's `endOfNextTurn` now exists (`untilOf: recipient`), but it still needs a lent Alteration
  benefit.
- **Genetic Support**: the same lend piece.
- **Advanced Alteration Emulator**: `rounds:10` exists, but it still needs the lend piece.
- **Thick Hide**: a kept-equipped shield, and an Alterations-count Defense.
- **Standard Deflecting Weapon**, **Limited Deflecting Weapon**: linked-item grants kept with their host.
- **Shield Fighter**: `rounds:10` exists, but it still needs a hit rider option with the stored damage type.
- **Disenfranchised**: three buttons on one card, and button steps that read the poster's values.
- **Armor Matrix (Light / Medium / Heavy)**: a create veto, and a best-of Defense.
- **Eat the Weak**: a "target has item X" gate before the roll, a self fallback for `difDefense`, and a starts-with
  name match.
- **Multimorph**: an origin-perk picker.

### other3 (25)
- **Betrayal**: the assisted roll's result for the assister, and a "split from the party" state.
- **Dabbler**: a Skill-rank step, and a filtered Skill pick.
- **Self Improvement**: per-target per-scene stored Essence picks.
- **Follow Me!**: a write-Initiative step, and an "ally rolled Initiative" event.
- **Better Together (+ Hang-Up)**: `endOfNextTurn` and `legacy` now exist. It still needs a world-PC pick (`pick from:
  ally` is same-side tokens in range), a pair read from either actor, and an "actor has a token on the scene" tag.
- **Guardian Blast**: a group test with a tally.
- **Mega Defender**: a stored form with DerivedStat `set`, and shared action economy.
- **Metallic Armor Power Up!**: an actor-update step with a floor, a `taken` modifier that sees the attacker, and an
  "is a minion" tag.
- **Solarix Shard**: a filtered `ownedItem` pick, a hit rider option, and a resource-spent refund.
- **Void Touched**: a step that writes Essence maxima, with an undo.
- **Holographic Sights**: `@rolled.<path>`.
- **Scramble Field Generator**: marks with a mode read by the marker's side.
- **Again and Again and Again**: a repeat-attack step.
- **Balance and Compensation**: a die-ladder ItemModifier op.
- **Bump & Run**: a "moved N ft since" tag.
- **EM Protective Lining**: a per-attack Defense from another item.
- **Perfect Placement**: placed zones.
- **Precise Chronometrics**: distribute-points and write-Initiative steps.
- **Now You Don't (+5)**: a flat result bonus, and the Hide state as data.
- **Overcharge Engines**: a roll total into `@var`, and a Movement rule fed by it.
- **Pop Out**, **Telltale Sign**: a roll against several targets' best Defense, and the Hidden state.
- **Same Principle**: a filtered `ownedItem` pick, and `ruleWeaponTraits` passing the weapon id.
- **Gluten-Tolerant**: a "forbids" rule.
- **Gravity Optional (jump)**: the afterRoll total as a var. `{var.x}` in chat now works, but afterRoll hands its
  steps no total.

## Edits outside my files

Four small engine edits. The conversions above assume they are applied. Each is needed for the old behaviour, and
none changes an existing rule (no Reaction rule existed before this batch).

**1. `module/rules/reactions.mjs`, `reactionOffers`: hand the card's facts to the Reaction's `when`.** Replace

```js
        const ctx = contextFor({
          self: actor, holder: actor, ruleItem: item, other, item: lookup(info.itemUuid), rolledSkill: info.skill,
          isAttack: info.isAttack, isMelee: info.isMelee,
        });
```
with
```js
        const ctx = contextFor({
          self: actor, holder: actor, ruleItem: item, other, item: lookup(info.itemUuid), rolledSkill: info.skill,
          isAttack: info.isAttack, isMelee: info.isMelee,
          // The card's own facts: the Defense the dialog settled on (defense:), the roll's Edge (roll:edge), and the
          // row's hit (damage>=N, damage:crit).
          defenseType: info.defenseType ?? undefined, edge: info.hadEdge,
          ...(row ? { damageAmount: row.damage, damageCrit: row.isCrit } : {}),
        });
```
This one is needed by TF Not On My Watch (`not:roll:edge`), Soldier On (`damage:crit`) and Sidestep
(`defense:evasion`).

**2. `module/rules/steps.mjs`, `roll` handler: a roll inside a Reaction clears the user's targets and stops on a
cancel.** This is `react/core.mjs#rollVs`, which the hand-written reactions used. Replace

```js
    const result = await rollTest(ctx.actor, step.skill, dif, { ...(edge ? { edge: true } : {}), ...(ctx.item?.uuid ? { itemUuid: ctx.item.uuid } : {}) });
```
with
```js
    // In a Reaction (ctx.card) the DIF is flat: react/core.mjs#rollVs clears the user's targets first (dice.mjs compares
    // against targets before a flat DIF), and a cancelled roll stops the run, so nothing is spent or claimed.
    const extra = { ...(edge ? { edge: true } : {}), ...(ctx.item?.uuid ? { itemUuid: ctx.item.uuid } : {}) };
    const result = ctx.card
      ? await (await import("../helpers/extensions/react/core.mjs")).rollVs(ctx.actor, step.skill, dif, extra)
      : await rollTest(ctx.actor, step.skill, dif, extra);
    if (ctx.card && result.cancelled) {
      return false;
    }
```
`rollVs` returns `{success, crit, cancelled}`, so `ctx.vars.lastRoll` and the branches work unchanged.

**3. `module/rules/reactions.mjs`, `pressReaction`: a stopped run leaves the button unclaimed.** The old reactions
returned `false` on a cancelled choice or roll, which re-enabled the button. Replace

```js
  const finished = await runSteps(rule.steps ?? [], ctx);
  if (finished !== false) {
    await recordUse(actor, rule, item, index);
  }

  await claim(actor, offer.key);
```
with
```js
  const finished = await runSteps(rule.steps ?? [], ctx);
  // A run that stopped (a cancelled choice or roll) is left unclaimed, so the button can be pressed again.
  if (finished === false) {
    return false;
  }

  await recordUse(actor, rule, item, index);
  await claim(actor, offer.key);
```

**4. `module/rules/steps.mjs`, `convertRows` handler: keep rows with no target.** A plain Skill Test against a flat
DIF has a row with no `targetUuid`. `core.convertRows` handles it: it posts the "now a success" line and no damage
button. Replace

```js
    const rows = cardRows(step, ctx, r => !!step.crit || !r.success);
```
with
```js
    // Rows with no target too: a plain Skill Test against a flat DIF still says it now succeeds (core.convertRows).
    const { info, row } = ctx.card;
    const rows = (row && step.rows != 'all' ? [row] : info.rows).filter(r => !!step.crit || !r.success);
```

`module/rules/conv3-slD3.test.js` passes with or without these edits. Soldier On's and TF Not On My Watch's offer
gates are asserted on the `when` with the context edit 1 supplies, and their presses use a hand-built offer. Once
edit 1 lands, those two can also be checked through `reactionOffers`.

## Unused strings

These `lang/en.json` keys (under `E20`) have no code use left: `ReactCruelty`, `ReactIgnored`, `ReactLateSnag`,
`ReactNowMisses`, `ReactNoStoryPoint`, `ReactNowCrit`, `ReactNowSuccess`, `ReactEnergonHeal`. `ReactPickSkill`,
`ReactNoSkillDie`, `ReactLoweredMiss` / `ReactLoweredHit` and `ReactConvertedDamage` are still used.

## Files touched

- Packs (rules inserted as text, CRLF):
  - `packs/ccitems/_source/Legendary_Cruelty_Lcs6Pz0I0I7QJday.json`
  - `packs/prcrbitems/_source/Sidestep_YhdTm7qhaPCoiDab.json`
  - `packs/tfcrbitems/_source/Soldier_On_0fal8jy083wWSy7W.json`
  - `packs/tfcrbitems/_source/Not_On_My_Watch_cvgYI2FTjeIrUcLK.json`
  - `packs/sssitems/_source/Not_Perfect__But_Better_VtsUIbJm3HfFn12M.json`
  - `packs/sssitems/_source/That_s_Right__Perfect_dAoJG7ZwVEhOQZY0.json`
  - `packs/dditems/_source/Energon_Manipulator_cOVq7EH6HPrXmhBC.json`
  - `packs/atsitems/_source/Body_of_Energy_L2X2rIz2frulSajQ.json` (the chat text only)
- Slice: `module/helpers/extensions/react/reactions.mjs`, `react/triggers.mjs`, `react/react.test.js`.
- New: `module/rules/conv3-slD3.test.js` (19 tests) and this file.

**Rules added: 8** (on 7 items), plus 1 existing rule's chat text changed.
