# Batch slD2: re-check of slD (`react`, `resource`, `other1`, `other3`) against the 2026-10-04 engine pieces

**Scope:** every item `docs/rules-batches/slD.md` marked Skipped, plus the code half of every item it marked Partial,
re-checked against the engine sections "Engine features added 2026-10-04 (after the slice round)" and "(the bigger
pieces)". The batch was done in four parts (`rules/slD2-react`, `rules/slD2-resource`, `rules/slD2-other1`,
`rules/slD2-other3`), all from `rules/slC2` at 10154aa8, and merged into `rules/slD2`. Each part's full write-up
follows below.

| Verdict (re-checked items) | react | resource | other1 | other3 | Total |
|---|---|---|---|---|---|
| Convert (was skip) | 0 | 0 | 2 | 0 | **2** |
| Partial (was skip) | 0 | 1 | 0 | 0 | **1** |
| Partial, nothing more converts | 1 | 1 | 0 | 0 | **2** |
| Still skip | 30 | 27 | 25 | 25 | **107** |
| Re-checked | 31 | 29 | 27 | 25 | **112** |

4 rules were added to 3 pack items. After the merge, `scripts/check-rules.mjs` counts 1555 rules on 1065 items (slC2
left 1551 on 1062), with 0 errors and 0 warnings. ESLint is clean and jest passes (503 suites; 9638 passed, 2
skipped). The parts merged without conflicts; no slice file became empty.

**What moved:**
- **Dielectric and Insulator (other1):** each item's own cut to the Electromagnetic ↑3 against computerized targets is
  now an `incoming` RollModifier (Dielectric ↓2 in total, Insulator ↓1, both worn still ↓2, via a shared `emComputerized`
  stack group plus Dielectric's extra ↓1), using `check:computerizedGear`. The general "computerized gear" ↑3 stays in
  the cobra-gear roll source (which now always gives the full +3). Net shifts match the old code in both old paths;
  two `when` entries keep the old vehicle-weapon lookup so a crew member's EMP-less vehicle shot isn't cut.
- **Body of Energy (resource), partial:** the "Health into Power" Use (`askNumber`, `spend` Health, `gainResource`
  Power, offered while Morphed with Health > 1 and room in Power). The damage overflow into Power and the unmorph split
  stay code.

**Behaviour differences worth a decision** (every difference is in its part's section):
- **Dielectric / Insulator:** the dialog now lists "vs computerized equipment ↑3" plus the items' ↓1 lines (Dielectric
  shows two) instead of one smaller ↑; unticking only some of them can give a different total than before. A vehicle
  firing another vehicle's Electromagnetic-trait weapon now counts it, and an upgrade whose host item is missing counts
  as worn.
- **Body of Energy:** with Power already full the button is unavailable (the old one stayed pressable and warned); the
  amount is a number box (1 point moves without asking); the chat card no longer shows the amount moved (a chat step
  can't print `@var`).
- **Wording:** 4 `lang/en.json` keys removed with the converted code.

**Why the 14 "reaction" Perks still don't convert** (react - the new `targeted` Trigger and `button` step were checked
against each):
1. `targeted` fires after the card is posted; no step cancels a hit, lowers the total, adds a late Snag or turns a miss
   into a hit (11 items: Desperate Parry, Point-Defense Reflexes, Projectile Deflector, Soldier On, Shoot Out, Sidestep,
   both Defenders, Not On My Watch (TF), Not Perfect, That's Right).
2. It fires only on the creature rolled against, not for attacks on allies or other actors' rolls.
3. A Trigger spends its limit when it posts the button card, so an ignored offer still costs the use; the old
   reactions spend it only when pressed.
4. The `roll` step doesn't clear the user's targets first, and its formulas can't read the other creature.
5. No tag reads `@var.margin` (Counterstrike's "misses by 5 or more").

**Engine pieces the remaining skips need** (most useful first; each part's list has the detail):
- **Card-changing steps** (cancel a hit, lower the total, late Snag, turn rows into success / crit) plus the attack's
  total and damage as `targeted` vars - 11 react items.
- **Events on other actors' rolls and attacks,** an ally being Defeated, a `resourceSpent` event (Inner Conservation,
  Power Efficiency, Dino Charged, Fuel Efficient), an ally's Initiative, the assisted roll's result.
- **Buttons:** a limit recorded when the button is pressed, several buttons on one card, button steps that read the
  poster's values.
- **Roll step / vars:** clear targets first, read the other creature, a best-of-Defenses DIF, a tag that reads a var,
  the roll total in `@var` for afterRoll, `@var` in chat text, dice in formulas.
- **Picks:** migrating old pick flags into `rules.choices`, item-tag filters on `ownedItem`, a world-PC pick,
  `ruleWeaponTraits` passing the weapon's id so `item:picked:` matches.
- **Steps:** set the user's targets, write Initiative, repeat an attack, heal / damage Essence, a Health-or-Essence
  choice, update actor data with a floor, move / hide a token, retry the last roll, a confirmable pre-roll Skill swap.
- **Other:** personal Story Points, `until: endOfNextTurn` and `{rounds: N}`, marks with an owner and a mode, gates
  before the cost is paid, Alteration lends and cost waivers, hit rider-option rules, a `taken` DamageModifier that
  sees the attacker.

---

## Batch slD2 (part): re-check of the `react` slice skips

**Scope:** every item that `docs/rules-batches/slD.md` (part `react`) marked **Skipped** (30) or **Partial** (1),
re-checked against the engine pieces added on 2026-10-04 (the two newest sections of
`docs/RULES_CONVERSION_GUIDE.md`). For the partial (Inspirational Leader), only the half that stayed code was
re-checked. The new pieces are: SkillSubstitution `scope: item`, DialogSwitch `defaultWhen`, the new `check:` names,
the `targeted` / `dealtDamage` / `defeatedEnemy` Triggers and `takesDamage`'s target, the item steps (`createItem`,
`deleteItem`, `updateItem`, `spendQuantity`), `pick` with `{choice.<key>}` / `item:picked:` / `self|target:picked:`,
and `button`. Each item was checked against the slice code (`module/helpers/extensions/react/`) and against the new
code in `module/rules/` (`triggers.mjs`, `steps.mjs`, `buttons.mjs`, `predicate.mjs`, `formula.mjs`, `limits.mjs`).
Branch `rules/slD2-react`, from `rules/slC2` at 10154aa8.

| Verdict (re-checked items) | Items |
|---|---|
| Convert | 0 |
| Partial | 0 (Inspirational Leader stays partial, unchanged) |
| Still skip | 30 |
| Re-checked | 31 |

No rules were added and no slice code was removed. `scripts/check-rules.mjs` still counts 1551 rules on 1062 items,
with 0 errors and 0 warnings.

### How the new pieces fit this slice, and why they still fall short

slD found that 14 of the 30 skips need a **reaction rule**: a Use offered on another actor's posted check card. The
`targeted` Trigger and the `button` step were checked against each of them. Together they cover part of that idea,
but none of the 14 exactly, for these reasons:

1. **`targeted` fires after the card exists and can't change it.** It runs in `registerPostRoll`, on the attacker's
   client, once per row. No step negates a hit (`core.mjs#negateHit`: mark the row's Apply Damage keys as applied),
   lowers the card's total, adds a late Snag (`lateSnag`), or converts rows (`convertRows`). Eleven of them do one of
   these things: Desperate Parry, Point-Defense Reflexes, Projectile Deflector, Soldier On, Shoot Out, Sidestep, both
   Defenders, Not On My Watch (TF), and Not Perfect / That's Right.
2. **`targeted` only fires on the creature rolled against.** Defender (PR) reacts to an *ally* being hit. Not On My
   Watch (TF) reacts to *any enemy's* successful roll. Not Perfect / That's Right react to an *ally's* roll.
   Point-Defense Reflexes reacts to an attack on *anyone*, and so does Megaform Defender, which reacts to an attack
   on the Megaform its pilot belongs to. None of these is the defender's own event.
3. **A `button` can't hold the limit.** The old reactions are opt-in. The per-turn, per-round or per-encounter use is
   recorded only when the player presses the button and the roll isn't cancelled (`markUsedThisTurn`, `markUsed`
   after `rollVs`). A Trigger records its limit when its steps finish, which means when the button card is *posted*.
   `buttons.mjs#pressRuleButton` runs its steps in a `stepContext` with no rule, so nothing can record a limit when
   the button is pressed. An offer the player ignores would use up the turn. Without a Trigger limit, every offer
   could be taken.
4. **Roll steps.** The `roll` step goes through `grants.mjs#rollTest`, which doesn't clear the user's targets.
   `core.mjs#rollVs` clears them first, because `dice.mjs` compares against targets before a flat DIF. A button
   pressed while something is targeted would roll against that target's Defense. Step formulas (`amountOf`) also get
   no `other`, so `@target.<path>` is 0 in a step's `dif`. That means "the better of the attacker's Willpower and
   Cleverness" or "the target's better of Toughness and Evasion" (`bestDefense`) can't be written.
5. **`@var.margin` can't gate anything.** `targeted` puts the margin in `@var.margin`, but `vars` are assigned after
   the Trigger's `when` is evaluated, and no tag (in `when` or a step's `when`) reads a var. "Misses by 5 or more"
   (Counterstrike) has no condition to sit in.

### Converted (0)

None.

### Partial (0 new)

**Inspirational Leader** stays as slD left it: the Assist rule covers the out-of-combat half. The in-combat half
(`triggers.mjs`) works like this. A successful roll in combat stores `inspiringSkill` `{skill, combatId, round}` on
the holder, and allies (`areAllies`) then get a ↑1 roll source on that Skill until the round changes. An `afterRoll`
Trigger with `outcome: success` and `combat` could notice the roll. But no step stores the *rolled* Skill: `pick`
asks the player, and `updateItem` can't interpolate the roll's Skill. An allies aura can't compare a roll against a
value the holder stored either, and there is no "until end of round" on such a value.

### Behaviour differences

None (nothing changed).

### Still skipped (30)

#### Card reactions (`reactions.mjs`)

- **Desperate Parry.** *Still needs:* a negate-hit step, a "break the wielded weapon" step (equipped false + `broken`
  flag + the Junker announcement), and the arming Use that the reaction reads. `targeted` with `outcome: success`
  and `attack:melee` would find the moment, but the parry roll is against the attack's *total* (no var for the
  total, only the margin) and must undo the hit.
- **Point-Defense Reflexes.** *Still needs:* a reaction on an attack against *anyone* (an event on other actors'
  attacks, filtered by explosive / thrown), a negate-every-row step, a Snag on the step's own roll, and the
  Contingency arming.
- **Advanced Anti-Air Training.** It only removes Point-Defense's close-range question, so it goes with that item.
- **Legendary Cruelty.** The closest fit: a `targeted` Trigger with `outcome: failure` and `when: ["attack"]` that
  posts a `button`. The button would run `roll` (Intimidation), then a `button {who: gm}` with a 1 Psychic `damage`
  step. *Still needs:* a limit recorded when the button is pressed (point 3; once per turn), a step DIF of "the
  better of the target's Willpower and Cleverness" (point 4), and a roll step that clears targets (point 4).
- **Projectile Deflector.** *Still needs:* a negate-hit step, a roll against the attack's total (a `@var.total` on
  `targeted`), the hit's damage and type as vars for the crit's GM damage button, and a press-time limit (once per
  encounter).
- **Steady Footing (counter half).** `targeted` with `outcome: fumbled` and `item:damageType:maneuver` /
  `item:damageType:grapple` now finds the moment. *Still needs:* a step that sets the user's targets to the attacker
  (`targetActor`). It must run on the defender's client, but `targeted` runs on the attacker's. It also needs a bank
  tied to that one attacker that overwrites rather than stacks: the old `reactCounter` flag is one slot. A
  mark-plus-`target:marked:` bank would stack, and the mark would outlive the bank. And the bonus attack has to
  work outside combat: `bonusAttack` stops the run outside combat, while the old code still banked the ↑1.
- **Not Perfect, But Better / That's Right, Perfect.** *Still needs:* an event on an *ally's* roll (point 2), a
  convert-rows step, and a press-time once-per-scene limit.
- **Sidestep.** *Still needs:* a "lower the card's total by a rolled Skill Die" step (point 1). The Area-attack and
  Evasion gate would fit `targeted`.
- **Defender (PR General Perk).** *Still needs:* what Sidestep needs, plus an event when an *ally within 5 ft* is hit
  in melee (point 2).
- **Defender (Megaform Trait).** *Still needs:* a late-Snag step, and reactor discovery through Megaform membership
  (the pilots of the Megaform's members).
- **Not On My Watch (TF).** *Still needs:* an event on any enemy's successful roll without an Edge (point 2), a
  late-Snag step, and a press-time once-per-combat limit.
- **Shoot Out.** *Still needs:* a contested roll against the attack's total, a negate-hit step and a convert-rows
  step.
- **Soldier On.** *Still needs:* a negate-hit step, and the hit's damage as a var (10 + damage).
- **Counterstrike (DD).** `targeted` with `outcome: failure` and `attack:melee` finds the moment. *Still needs:* a
  condition on `@var.margin <= -5` (point 5), and the same attacker-targeting step and one-target bank as Steady
  Footing. The old offer is also opt-in with a press-time once-per-round limit (point 3).

#### Other actors' events (`triggers.mjs`)

- **Junker (Hang-Up).** *Still needs:* a world-wide "equipment broke" event (a weapon / armor / shield flagged
  `broken`, a `reactBroken` card, or a vehicle / Zord / Megaform dropping to 0 Health).
- **Not On My Watch (IA, movement half).** `defeatedEnemy` fires on the dealer and `defeated` on the fallen. An
  aura-scope `defeated` Trigger would run its steps as the *fallen ally*, and no recipient reaches the holder.
  *Still needs:* an event on an ally being Defeated that runs as the holder. It must also count any update that
  takes Health to 0, as the old `updateActor` hook does, not just `applyDamage`. It also needs a whispered button.
- **All For One.** *Still needs:* a drop-to-0 Personal Power event, dice in formulas (`1d2`), and buttons each
  teammate presses once for themselves, paid from the presser's own Health / Power. `button {runAs: clicker}` runs
  once (or unlimited with `once: false`), not once per presser.
- **Agency (Hang-Up).** *Still needs:* a rule type, or a RollModifier option, read by `dice.mjs`'s Fumble Story Point
  grant (`FUMBLE_STORY_POINT_SUPPRESSORS`).
- **Their Loss, My Gain.** *Still needs:* a Trigger on *other actors'* Fumbles within 60 ft. `targeted` sees only
  rolls against the holder.
- **Cruel Conflagration.** *Still needs:* a Trigger on other actors' failed rolls within 15 ft, and a whispered
  button card. `button` could carry the Power cost and the GM damage button.
- **Energon Manipulator.** `defeatedEnemy` now gives the attacker side, and `target:canTransform` /
  `target:tag:cybertronian` / `target:tag:robot` the victim test. *Still needs:* dice in formulas (`1d2` heal),
  which also blocks the Use half. Attribution also changes: the old code credits the attacker on the card the GM
  last clicked Apply Damage on (within 2 minutes), while `defeatedEnemy` credits the damage card's speaker.
- **Revengeful.** `defeatedEnemy` gives the moment. *Still needs:* a tag that compares a uuid stored on the holder
  (`dice.mjs`'s `pendingRevengeful.attackerUuid`) with the Defeated target. `self:data:` compares with literals or
  the same document's paths only.

#### Forms and states (`forms.mjs`)

- **Monster Morph.** `check:monsterForm` and `hit` / `takesDamage` + `button` could carry the offers. *Still needs:*
  one roll against every creature within 10 ft at once (`rollVsMany`), a step DIF of the target's better of
  Toughness and Evasion (point 4), a whispered button card, and a rule home for the per-Path choice (the 6 Path
  Roles).
- **Iron Bravado (share half).** *Still needs:* a step that copies the holder's current Condition immunities to
  allies within 30 ft until the holder's next turn.
- **Cyborg.** *Still needs:* a damage-to-Essence redirect with a GM prompt, and a heal lock.
- **Mind Beam.** *Still needs:* a rule reading the spell's pre-roll effect choice, and a default remembered on first
  use. `pick {ifUnset}` could store the first effect, but the effect choice and its ↓1 live in `documents/item.mjs` /
  `dice.mjs`.

#### Offensive-defense armor Upgrades (`auras.mjs`)

- **Energized, Spiked, Energy Field.** *Still needs:* an incoming DialogSwitch (on the attacker's dialog) and a
  "plain Reach" attack tag. `button` could carry the strike-back, but it needs the best-of-Defenses step DIF, and
  `pick` could hold the element.

### Engine pieces the remaining skips need

1. **Card-changing steps** for a `targeted` / reaction run: negate the hit on that row, lower the card's total, a late
   Snag, and convert rows to success / crit. Plus the attack's **total and damage as vars** on `targeted`. (11 items)
2. **Events on other actors' rolls and attacks** (ally hit, any enemy's success, an ally's roll, Fumbles / failures
   within N ft) and on an ally being Defeated, running as the holder. (9 items)
3. **A limit recorded when a `button` is pressed** (a rule reference carried in the button's data), so opt-in
   reactions keep "once per turn / round / encounter / scene". (Legendary Cruelty, Projectile Deflector,
   Counterstrike, Not Perfect, That's Right, TF Not On My Watch)
4. **Roll-step fixes:** clear targets before a flat-DIF roll, `other` in step formulas, or a `difDefense` list
   meaning "the best of these". (Legendary Cruelty, Monster Morph, the armor Upgrades)
5. **A var tag** (`var:margin<=-5`) or vars visible to `when`. (Counterstrike)
6. **Setting the user's targets** to a step's target, and a **one-slot bank tied to one creature**. (Counterstrike,
   Steady Footing)
7. **Dice in formulas** (`1d2`). (Energon Manipulator, All For One)
8. Smaller: an "equipment broke" event, a drop-to-0 Power event, per-presser buttons, whispered button cards, a
   Fumble Story Point suppressor rule, an incoming DialogSwitch, sharing Condition immunity, an Essence damage
   redirect, a uuid-comparing tag, and storing the rolled Skill.

### Files touched outside the slice

- `docs/rules-batches/slD2-react.md` (this file). No pack, code, test or `lang/en.json` changes.

---

## Batch slD2 (part): re-check of the `resource` extension slice

**Scope:** every item that `docs/rules-batches/slD.md` (part `resource`) marked **Skipped** (28) or **Partial** (1,
History Buff), re-checked against the engine pieces added on 2026-10-04 (`docs/RULES_CONVERSION_GUIDE.md`, the two
newest sections). Those pieces are `targeted` / `dealtDamage` / `defeatedEnemy` Triggers (and `takesDamage`'s
target), the item steps `createItem` / `deleteItem` / `updateItem` / `spendQuantity`, `pick` with `{choice.<key>}` /
`item:picked` / `self|target:picked`, the `button` step, SkillSubstitution `scope: item`, DialogSwitch `defaultWhen`
and the new `check:` names. Older pieces were checked again too. Only `module/helpers/extensions/resource/` was
touched in the slices. Branch `rules/slD2-resource`, from `rules/slC2` at 10154aa8.

| Verdict (over the 29 re-checked items) | Items |
|---|---|
| Convert | 0 |
| Partial | 2 (Body of Energy, new; History Buff, unchanged) |
| Still skip | 27 |

This part adds 1 rule to 1 pack item. `scripts/check-rules.mjs` now counts 1552 rules on 1063 items (`rules/slC2`
had 1551 on 1062), with 0 errors and 0 warnings.

### Converted (0)

None.

### Partial (2)

| Item | Rules | Why it is exact | What stays code |
|---|---|---|---|
| Body of Energy (new partial: the Use half) | One `Use`, label "Health into Power", no cost. `when: ["self:morphed", "self:data:system.health.value>1", "self:data:system.powers.personal.value<$system.powers.personal.max"]`. Steps: `askNumber {var: moved, min: 1, max: "min(@actor.system.health.value - 1, @actor.system.powers.personal.max - @actor.system.powers.personal.value)"}`, then `spend {path: system.health.value}` of `@var.moved`, then `gainResource {path: system.powers.personal.value}` of `@var.moved`, then a chat line | The old `registerUse` (`power-spend.mjs`) took no action and was usable while Morphed with more than 1 Health. It offered 1 up to `min(Health - 1, Power max - Power)` and moved that much Health into Power. The rule offers the same range and makes the same change. `gainResource` stops at `.max`, but the amount never goes past the room, so it never caps. Neither write is a Personal Power decrease, so the spend hooks (Inner Conservation, Power Efficiency, Dino Charged) never fire, as before. Void Warrior's regain block (in `preUpdateActor`) still blocks the Power gain the same way. Removed: the `registerUse` block, its now-unused `registerUse` / `isItem` imports, the three lang keys `ResBodyOfEnergyNothing` / `Prompt` / `Line`, and `IDS.bodyOfEnergy` from the registration test's Use list | The damage modifier (damage past the last point of Health comes out of Power while Morphed) and the unmorph split. They need a pooled-resource damage modifier and an unmorph Trigger that reads the pre-update values (see below). `IDS.bodyOfEnergy` stays: that code reads it |
| History Buff (unchanged: the Use half) | (the ↑2 DialogSwitches from slD) | - | The Continuum Anomaly risk-die Use. `pick {from: list}` could ask for the risk, but no step rolls a formula one die size smaller as a GM-only blind roll and reads the result band. `pr1/jtt.mjs` also shares `RISK_DICE` / `anomalyBand`. slA2 judged Time Displaced's matching Use the same way |

### Behaviour differences

All same-line (only Body of Energy itself); none cross-line.

1. **Body of Energy: no room in Power** (same-line). The old button stayed pressable while Morphed with Health above 1.
   With Power already full, it showed a "nothing can be moved" warning. The rule's Use is not offered in that case
   (its `when` holds the room check), so the button is unavailable instead of warning.
2. **Body of Energy: the amount box** (same-line). The old code asked with a select list of 1..N. The rule asks
   with a number box (`askNumber`, min 1, max N, clamped). With exactly 1 point possible it moves 1 without asking (the
   old list offered the single choice).
3. **Body of Energy: two writes and the card** (same-line). The old code made one actor update (Health and Power
   together, flagged `essence20Refund`). The rule writes Health, then Power. Nothing reads Health decreases from that
   flag, and the order makes no difference for the hooks in this slice. The chat card is the rules card ("Body of
   Energy: Health into Power" and "{name} turns Health into Personal Power."). It no longer shows the amount, because
   a chat step can't print `@var`.

### Still skipped (27)

The 2026-10-04 pieces don't reach these. What each one still needs:

#### Ruthless Points, Wealth Tests, Motor Pool

- **Play Favorites**, **Play Favorites Against Each Other**: personal Story Point records with a turn-end countdown,
  shareable between two allies and spent before the pool by `story-points.mjs`. `pick {from: ally}` could choose the
  recipient, but nothing holds the point itself. *Still needs:* a personal Story Point resource (expiry, shared ids,
  spent first).
- **This, I Command** (Ruthless Point half): a prompt inside Play Favorites. It goes with Play Favorites.
- **Ruthless Efficiency**: *still needs* a Trigger on another actor's turn end (the new other-actor events cover
  attacks, damage and Defeats only), plus the personal points.
- **Money Talks**, **Capable Freelancer**: *still need* a confirmable pre-roll Skill swap that rewrites the
  dataset (`requisitionSkill`, `isWealthRequisition`, the Wealth shifts, the dropped Essence). SkillSubstitution
  `scope: item` is a different thing.
- **Motor Pool Connections**: *still needs* a vehicle (actor) picker, since `pick from: ownedItem` picks items. It
  also needs a budget keyed per picked vehicle and per mission, `pickGrant` with a cost filter and a DIF from the
  picked entry, and a grant onto another actor.

#### Personal Power and Energon spends

- **Inner Conservation**, **Power Efficiency**, **Dino Charged**: *still need* a `resourceSpent` Trigger event (path,
  `@spent`, ignoring loss/refund writes). Dino Charged also needs an Essence-damage step with an Essence choice. No
  `pick` result can feed an actor-path update.
- **Fuel Efficient**: the same event, plus a per-point roll loop.
- **Body of Energy** (the damage and unmorph halves): see Partial.
- **Repair Progress (Bonus Energon Point)**: an `added` Trigger with `gainResource` can't add the point, because
  `system.energon.normal` has a `.max` and `gainResource` stops there. The point has to go past it. *Still needs:* a
  gain that may exceed the maximum, a "spent from over the maximum" event, and a Rest hook that adds to the capped value.

#### Energon strains

- **Dark Energon**, **Primal Energon**, **Red Energon**, **Synth-En**: `spendQuantity` now covers using up a dose.
  `gainResource` on `system.energon.<strain>.value` (no `.max` there) would add the points, uncapped as before.
  But the item's one button is a chooser whose options depend on state: Awaken only with Primal points, "this turn"
  only for Red or unstable Synth-En with points and a combat, Stabilize only while unstable. `choose` options have no
  per-option `when`, and several Use rules would be separate buttons with no "Consume" fallback order. Awaken and
  "this turn" write actor flags (`primalEnergonScene` via the scene clock, `redEnergonTurn`) that the strain roll
  sources read. No step writes actor flags, and a `mark`/`setToggle` would need those sources rewritten. A Dark dose
  runs the addiction attack, a raw `Roll`. Stabilize writes `synthEnStable`. *Still need:* conditional `choose`
  options, an actor-flag (or scene/turn stamp) step the strain sources read, and an addiction-attack step.
- **Word of Unicron**: the addiction roll is a raw `2d20kl` `Roll`, not a Skill roll. *Still needs:* the addiction
  attack as a rule-visible roll.

#### Temporary resources and Story Points

- **Together We Stand**: *still needs* a party-scoped round-1 / `combatStart` Trigger with a "two or more team
  members in combat" condition, per-recipient de-duplication, dice in `heal` amounts, and a ledger-recorded
  temporary heal that ends with the scene. `heal {temporary}` only raises `system.health.bonus`.
- **Think Fast!**: *still needs* `storyPointSpent` carrying the spend kind (`spend:equipment`) and a Story Point
  grant routed to the GM.
- **We Improvise**: *still needs* a per-combat ledger of grants and pool spends and a `combatEnd` step that takes back
  the unspent points.

#### Beast Mode

- **Beast Mode** (10th/20th-level packages, scene end): reacts to a flag set by `items/forms/beast-mode.mjs`. `deleteItem
  {item: granted}` and `grant` could swap items, but nothing fires on that flag. *Still needs:* a level-gated choice,
  "replace the tracked grant", and grants tied to the flag / scene.

#### My Little Pony

- **Honest Compassion**: *still needs* a heal-Essence-damage step and a Stress choice that asks only when both
  Health and Essence are damaged, plus a Rest limit whose `max` is a formula (1, or 3 at 11th level).
- **Musical Interlude**: the `button` step now posts a rule button, but the card has three answers (sang / Health /
  Essence) and a `button` step posts one button per card. The Essence answer reduces a chosen Essence score. *Still
  needs:* a multi-button card (or options on one card), an Essence-damage step with an Essence choice, and a
  once-per-combat first-turn Trigger.
- **Camper**: *still needs* a scene-window state that an aura/party RollModifier can read through `holder:`
  tags (with the holder still at half Health), and the Stress heal.
- **Zap Apple Jam**: `updateItem` can now count cups/pastries on the item, but the chooser's options depend on those
  counts (same `choose` gap). It also needs an Essence heal, a "next roll out of combat / this turn" Edge, and a
  mission-end spoil. *Still needs:* conditional choices, Essence heal, those Edge banks and the expiry.
- **Circle of Magical Friends**: *still needs* a Circle-members recipient and a "copy items from another actor until
  the Circle ends" step.
- **Extensive Research**: `deleteItem {item: granted, all: true}` could drop the previous spell, and `pickGrant`
  tags could filter tier against the Spellcasting die. *Still needs:* a world-time (one week) expiry on the grant.

### Engine pieces the remaining skips need

- **A `resourceSpent` Trigger event** (path, `@spent`, ignoring loss/refund writes): Inner Conservation, Power
  Efficiency, Dino Charged, Fuel Efficient, part of Repair Progress.
- **Stress / Essence steps:** heal Essence damage, damage a chosen Essence, a Health-or-Essence choice asked only
  when both are damaged: Honest Compassion, Camper, Zap Apple Jam, Musical Interlude, Dino Charged.
- **Conditional `choose` options** (a per-option `when`) and an actor-flag / turn-scene stamp step: the four Energon
  strains, Zap Apple Jam.
- **Multi-button cards** (several answers on one `button` card): Musical Interlude.
- **Personal Story Points** and a turn-end event for other actors: Play Favorites x2, This, I Command, Ruthless
  Efficiency.
- **`storyPointSpent` with the spend kind**: Think Fast!.
- **A confirmable pre-roll Skill swap** that rewrites the dataset: Money Talks, Capable Freelancer.
- **Body of Energy's other halves:** a pooled-resource damage modifier and an unmorph Trigger that reads the
  pre-update values.
- **Other:** ledger-recorded temporary resources (Together We Stand); per-combat ledgers (We Improvise); a
  rule-visible addiction roll (Word of Unicron, Dark Energon); level-gated packages tied to a flag (Beast Mode); an
  actor picker and per-target budgets (Motor Pool); Circle recipients and item copies (Circle of Magical Friends);
  world-time expiry (Extensive Research); a blind die-step roll (History Buff's Use).

### Files touched outside the slice

- `packs/atsitems/_source/Body_of_Energy_L2X2rIz2frulSajQ.json`: a new `rules` array as the first key of `system`
  (LF, inserted as text).
- `lang/en.json`: `E20.ResBodyOfEnergyNothing`, `E20.ResBodyOfEnergyPrompt`, `E20.ResBodyOfEnergyLine` removed (three
  lines, edited as text).
- `module/rules/conversions-uses.test.js`: one `describe('slD2 resource')` block appended at the end, under a
  `// slD2 resource` header. The import line is unchanged.

In the slice: `power-spend.mjs` lost the Body of Energy `registerUse` block and its two now-unused imports, and its
header comment now says the Use is the Perk's rule. `resource.test.js`'s registration test no longer expects a Use
for `IDS.bodyOfEnergy`. No slice file became empty, so `extensions/index.mjs` is unchanged.

---

## Batch slD2 (part): re-check of the `other1` slice skips

**Scope:** every item `docs/rules-batches/slD.md` marked Skipped or Partial for the `other1` extension slice
(`module/helpers/extensions/other1/`): 27 skips, no partials. Each one was checked again against the 2026-10-04
engine pieces: the `targeted` / `dealtDamage` / `defeatedEnemy` Triggers, the item steps (`createItem`, `deleteItem`,
`updateItem`, `spendQuantity`), `pick`, `button`, SkillSubstitution `scope: item`, `defaultWhen` and the new `check:`
names. Branch `rules/slD2-other1`, from `rules/slC2` at 10154aa8.

| Verdict | Items |
|---|---|
| Convert | 2 (Dielectric, Insulator) |
| Partial | 0 |
| Still skip | 25 |

3 rules were added to 2 pack items. `scripts/check-rules.mjs` now counts 1554 rules on 1064 items (slC2 left 1551 on
1062), with 0 errors and 0 warnings. ESLint is clean and jest passes (503 suites; 9635 passed, 2 skipped).

No slice file became empty, so `extensions/index.mjs` is unchanged.

### Converted

#### Dielectric and Insulator (`packs/ccitems/_source/Dielectric_A36q5SNroIR8xoyd.json`, `Insulator_AMIKCJX1DDz1sLVb.json`)

The old code was one roll source in `cobra-gear.mjs`. For an Electromagnetic attack on a target, it did two things:
- (a) A target with computerized gear but without the Computerized trait got +3 to undo dice.mjs's "all other
  targets" ↓3, plus `emUpshiftAgainst(target)`.
- (b) A target with the Computerized trait got ↓(3 - `emUpshiftAgainst`).

`emUpshiftAgainst` gave 1 when the target wore Dielectric, else 2 when it wore Insulator, else 3. "Worn" meant the
upgrade was loose on the actor or attached to an equipped item.

The kept code is (a) with a flat +3. That part is generic Electromagnetic handling keyed by the part Perks, not by
these two items. Each item's own cut moved to `incoming` RollModifiers on the upgrade. All of them use the same `when`:
- `item:type:weaponEffect`
- `{"any": ["item:damageType:emp", "weapon:trait:electromagnetic"]}`
- `{"any": ["item:damageType:emp", "item:data:parent.type!=vehicle", "target:data:type=vehicle"]}`
- `{"any": ["item:damageType:emp", "item:data:parent.type!=zord", "target:data:type=zord"]}`
- `{"any": ["self:data:system.traits.computerized", "self:check:computerizedGear"]}`

The rules themselves:
- **Dielectric:** `downshift: 1, stack: "emComputerized"`, plus a second `downshift: 1` with no stack group.
- **Insulator:** `downshift: 1, stack: "emComputerized"`.

Why it is exact:
- **Which targets.** The last `when` entry is the union of the old branches (a) and (b). `check:computerizedGear`
  is the same `hasComputerizedGear` helper the old code called, asked of the defender (`self` in an incoming rule).
  Both branches reduced the upshift by 3 - N in total: (a) through a smaller ↑, (b) through a ↓. So a ↓(3 - N) source
  gives the same net shift on both. That includes a robotic target without the trait, which gets dice.mjs's ↑3 and
  then the kept +3 +3.
- **Not stacking.** When both upgrades are worn, the old code took Dielectric (↑1). A stack group keeps its
  *strongest* shift, and for downshifts that is the smallest one, so the two can't simply share a group. Instead,
  the group holds one ↓1 from each item (only one survives), and Dielectric adds an ungrouped ↓1. That gives
  Dielectric ↓2, Insulator ↓1, and both ↓2.
- **Worn.** `rules/index.mjs#isItemActive` drops an upgrade whose host is unequipped, which is the old `isWorn`.
- **Electromagnetic test.** The old test was `item.type == 'weaponEffect'`, then `system.damageType == 'emp'` or the
  parent weapon's `traits` includes `electromagnetic`. The old code looked the weapon up among the *roller's* items.
  `weapon:` reads it from the effect's own parent. The two guard entries rebuild the old lookup: when the effect
  belongs to a vehicle or Zord that isn't the roller (a crew member firing it), only an `emp` damage type counts, as
  before. So a vehicle's Electromagnetic-trait weapon fired by its crew gets nothing, exactly as before. This is the
  difference slC2 accepted for Machinesmith, and here it would have left a ↓2 with no ↑ to cut.
- **Timing.** `ruleRollSources` is an extension roll source in the same `rollRiderSources` pass as the kept code,
  so the shifts land at the same point.

Removed:
- the `dielectric` and `insulator` id-table keys;
- `emUpshiftAgainst`, `wears` (nothing else used the cobra-gear copy), and the `o1EmCoating` branch;
- the `O1EmCoating` string in `lang/en.json`.

The `other1.test.js` tests of `emUpshiftAgainst` and `wears` became `hasComputerizedGear` / `isWorn` tests. The new
tests are in `module/rules/conversions.test.js` under `// slD2 other1`.

### Behaviour differences

- **Dielectric / Insulator, same-line (cosmetic):** the dialog lists the kept "vs computerized equipment ↑3" source
  plus the item's ↓1 source(s), where it used to show one smaller ↑ (or "Insulated against Electromagnetic ↓N"). The
  net shift is the same. Dielectric shows two ↓1 lines. If a player unticks only some of these sources, the totals
  can now differ from the old single source.
- **Dielectric / Insulator, same-line (edge cases):**
  - A vehicle or Zord firing *another* vehicle's Electromagnetic-trait weapon now counts it.
  - An upgrade whose host item is missing now counts. The old `isWorn` said not worn; `isItemActive` treats it as
    loose.

None are cross-line.

### Still skipped (25)

`jtt.mjs`:

| Item | What is still missing |
|---|---|
| Interspatial Pause | A token-hidden step and a "takes no damage" mark on others, released by the same Use, the holder's next turn or a scene change. None of the new pieces hide tokens or zero damage. |
| Quantum Trigger | `button` can offer the retry, but no step re-rolls the last roll's dataset with a cumulative ↓n chain. |
| Timeslide | A pick-a-canvas-point / move-token step. |
| Time Strike | The checkbox is a DialogSwitch with `cost` and `key`, but a hit still can't add rider options from the weapon's sibling effects or a base-damage note. |
| Special Program | `pick` lists fixed options, owned items, actors or Skills, not compendium Perks. `pickGrant` labels still show only the name (no `system.prerequisite`). The on-creation offer has no "until picked" gate. |
| Lance of Light (strike) | `button` with `who: gm` could carry the GM's damage, but the target and 10 ft range are still checked only after the Standard action is paid (`target` steps run after the cost, and a Use has no range gate). |
| Savant Skill | No Trigger on a Story Point reroll result. RollDice has no "add a d4" piece. |
| Good with Both | Still no equipped-items count (`self:count:weapon` counts unequipped weapons). |
| Unlucky (For You) | The new events are about attacks on you and damage you deal. Nothing watches the hit target's *next* Skill Test. There is also no per-target-per-combat limit. |

`alterations.mjs`:

| Item | What is still missing |
|---|---|
| Altered | An "Alteration cost waived" piece tied to `alteration-handler.mjs`, with a level budget. |
| Additional Alteration | The same waiver, plus level-tier grant choices. |
| Overload | Lent Alteration benefit/cost shapes on another actor; `until: endOfNextTurn` (the target's). |
| Genetic Support | The same lend piece, with a compendium Alteration pick. |
| Advanced Alteration Emulator | The lend piece; `until: {rounds: 10}`. |
| Thick Hide | Grants now take flags/system overrides, but nothing keeps the shield equipped, and no Defense formula counts Alterations to replace the raised shield's Evasion. |

`cobra-gear.mjs`:

| Item | What is still missing |
|---|---|
| Standard Deflecting Weapon | `pickGrant` can give the picked shield, but nothing links it to the weapon, keeps it equipped with it, deletes it with it, or warns when attacking while it is raised. |
| Limited Deflecting Weapon | Same. |
| Shield Fighter | `pick from: damageType` can store the Element and `spendQuantity` / `updateItem` can pay the Personal Shield use. A blade/bludgeon hit still can't offer a rider option with that damage type, and there is no `until: {rounds: 10}`. |
| Onslaught | A hit step that adds rider options from sibling weapon effects (or a Maneuver). |
| Disenfranchised | `button` gets close (`who: anyone`, `runAs: clicker`, `once: false`). But the DIF is the poster's Willpower when posted, and a button's steps can't read the poster's numbers. The presser is `user.character`, not the controlled token. And one card carries one button, not three. |

`more.mjs`:

| Item | What is still missing |
|---|---|
| Armor Matrix (Light) | A create-veto rule and a "best of the matching items" Defense. |
| Armor Matrix (Medium) | Same. |
| Armor Matrix (Heavy) | Same. |
| Eat the Weak | `deleteItem` can now remove the target's Hang-Up (through the GM relay). Three things are still missing. (1) A gate that the target *has* it before the roll; the old code warns and doesn't roll, while `deleteItem required` only checks by deleting. (2) A `roll` with `difDefense` that falls back to the user's own Willpower when nothing is targeted. (3) An item match for "the source, or a name starting with Addicted (Dark Energon)": `name~` is "contains". |
| Multimorph | `deleteItem item: granted` covers changing back. The origin-perk picker (two Perks from two different other MLP Origins) is still missing. |

### Engine pieces the remaining skips need

- **Hit rider options from steps:** sibling weapon effects (Time Strike, Onslaught) and a stored damage type (Shield
  Fighter).
- **Alteration lends and waivers** (Altered, Additional Alteration, Overload, Genetic Support, Emulator).
- **Timing:** `until: endOfNextTurn` (the target's) and `until: {rounds: N}`.
- **Gates before the cost:** a target/range check (Lance of Light) and "target has item X" (Eat the Weak), plus a
  self fallback for `difDefense`.
- **Watches on another actor's next roll** (Unlucky (For You)); a reroll-result Trigger (Savant Skill); a
  retry-the-last-roll step (Quantum Trigger).
- **Token steps:** move (Timeslide) and hide (Interspatial Pause).
- **Buttons:** several buttons on one card, and button steps that read the poster's numbers (Disenfranchised).
- **Pickers:** pickGrant labels with a field (Special Program) and an origin-perk picker (Multimorph).
- **Linked-item grants** kept in step with their host (Deflecting Weapons, Thick Hide). An equipped-items count tag
  (Good with Both). A create veto and a best-of Defense (Armor Matrix).

### Files touched outside the slice

- `packs/ccitems/_source/Dielectric_A36q5SNroIR8xoyd.json`, `packs/ccitems/_source/Insulator_AMIKCJX1DDz1sLVb.json` -
  the new `rules` (LF, inserted as text).
- `lang/en.json` - removed `O1EmCoating`.
- `module/rules/conversions.test.js` - the `// slD2 other1` block at the end. There is no import-line change: it
  registers `check:computerizedGear` with the real `hasComputerizedGear` in its own `beforeAll`.

In the slice: `cobra-gear.mjs` lost the two id-table keys, `emUpshiftAgainst`, `wears` and the coating branch.
`other1.test.js` now tests `hasComputerizedGear` / `isWorn` directly.

---

## Batch slD2 (part other3): re-check of the `other3` slice skips

**Scope:** every item `docs/rules-batches/slD.md` marked Skipped for the `other3` slice ("Batch slD (part): the
`other3` extension slice"), re-checked against the 2026-10-04 engine pieces in `docs/RULES_CONVERSION_GUIDE.md`. Those
pieces are SkillSubstitution `scope: item`, DialogSwitch `defaultWhen`, the new `check:` names, the `targeted` /
`dealtDamage` / `defeatedEnemy` Triggers, `takesDamage`'s target, the item steps (`createItem`, `deleteItem`,
`updateItem`, `spendQuantity`), `pick` with `{choice.<key>}` / `item:picked:` / `self|target:picked:`, and `button`.
slD marked nothing in this slice Partial, so there was no code half to re-check. Each item was checked against the
code in `module/helpers/extensions/other3/` and against the new pieces' code in `module/rules/` (`steps.mjs`,
`triggers.mjs`, `buttons.mjs`, `predicate.mjs`, `adapter.mjs`, `formula.mjs`). Branch `rules/slD2-other3`, from
`rules/slC2` at 10154aa8.

| Verdict (re-checked items) | Items |
|---|---|
| Convert | 0 |
| Partial | 0 |
| Still skip | 25 |
| Re-checked | 25 |

No rules were added. `scripts/check-rules.mjs` still counts 1551 rules on 1062 items, with 0 errors and 0 warnings
(the same as `rules/slC2`).

Two limits of the new pieces account for most of the near misses:

- **`pick` doesn't fit the old pickers.** It stores under `flags.essence20.rules.choices.<key>`, but Better Together
  (`o3Partner`), Solarix Shard (`o3SolarixWeapon`) and Same Principle (`o3SameWeapon`) keep existing picks in their own
  flags, and nothing migrates them. `pick {from: ownedItem}` filters only by item type and `equipped`, so it can't
  offer just Power Weapons (Solarix Shard) or just non-Ballistic weapons (Same Principle). `pick {from: ally}` lists
  same-side tokens in range (`sideActorsWithin`), not every player character in the world (Better Together).
- **`button` has nothing to run for these cards.** It can post the card and run steps as the holder or as the
  presser, but no step writes Initiative or combatant flags (Follow Me!, Precise Chronometrics). No step repeats an
  attack (Again and Again and Again). No roll step rolls against several targets' best Defense (Pop Out, Telltale
  Sign). And nothing tallies a group test (Guardian Blast).

#### Converted (0)

None.

#### Partial (0)

None.

#### Behaviour differences

None. No behaviour changed.

#### Still skipped (25)

##### My Little Pony (`mlp.mjs`)

- **Betrayal (Hang-Up).** `button {who: others, runAs: clicker}` with a Story Point `spend` could post the heal
  card. *Still needs:* a Trigger on the assisted actor's failed roll that fires for the assister's item (`assisted`
  fires as the help is given, not after the roll), a world-wide "split from the party" state that
  `allies.mjs#getNearbyAllyTokens` reads, and a scene-scoped record of who healed it.
- **Dabbler.** `pick {from: skill}` offers every Skill, with no filter by rank or by Essence (relative to the first
  pick), and no step changes a stored Skill rank. *Still needs:* a step-up / step-down Skill rank step, a filtered
  Skill pick, and a Rest Trigger step that undoes a recorded change.
- **Self Improvement (spell).** `pick {from: essence}` stores on the caster's item, not on the target, and can't leave
  out Essences already improved. *Still needs:* a per-target, per-scene stored list that DerivedStat / Defense rules
  on the target read, with paths taken from the picks.

##### Power Rangers (`pr.mjs`)

- **Follow Me!** `button {who: others, runAs: clicker}` matches the card, but no step writes a combatant flag. No
  Trigger fires on another combatant's Initiative, and no step writes Initiative values. *Still needs:* a
  write-Initiative step and an "ally rolled Initiative" event.
- **Better Together (and its Hang-Up).** `lendAssistance` / `assisted` Triggers with `target:picked:partner` would
  narrow to the partner, but the pick differs (see above), and the old Use stores in `o3Partner`. The pair's bonus
  lasts until the end of the assister's next turn and is read from either actor's record. `until: nextTurn` ends at
  the start of that turn. The Hang-Up's "partner has a token on this scene" has no tag. *Still needs:* a world-PC pick
  (or a migration of `o3Partner`), `until: endOfNextTurn`, a mark set on both actors, and an "actor has a token on the
  scene" tag.
- **Guardian Blast.** *Still needs:* a group Skill Test step: participant checklist, a per-participant roll button
  that pays their own Standard, and a half-or-more tally that deals the damage.
- **Mega Defender.** *Still needs:* DerivedStat `set` rules gated on a per-scene stored form, a "linked Zord on the
  scene" check, an end at 0 Health that restores a stored Health value, and shared action economy between two actors.
- **Metallic Armor Power Up! (the rest).** A `targeted` Trigger with `outcome: crit`, `when: ["attack",
  "self:data:flags.essence20.metallicArmorActive", ...]` and `target:tag:` tags for the non-minion test comes close
  for the crit end. But no step can set the actor flag and lower `system.health.bonus` by 3, floored at 0: `spend`
  stops when less than 3 is left, and `updateItem` only changes items. The 0-Health end runs on every hit that leaves
  Health at 0 or below, and the `defeated` event fires only on the first one. The minion -1 is a post-hit card note,
  and the `taken` DamageModifier still gets no attacker. *Still needs:* an actor-update step (set a flag, add with a
  floor), a `taken` DamageModifier that sees the attacker, applied as the card note, and an "is a minion" tag
  (`creature-tags.mjs#isPuttyOrTenga` plus the minion tags, PCs excluded).
- **Solarix Shard.** The pick differs (Power Weapons only, `o3SolarixWeapon`). The hit adds a rider option (an extra
  1 Fire damage button on the hit card), and no rule makes rider options. The refund needs a Trigger on Personal
  Power being spent. *Still needs:* a hit rider-option rule, a filtered `ownedItem` pick (or a migration), and a
  resource-spent event with a refund step.
- **Void Touched (Origin).** *Still needs:* a step that writes stored Essence maxima, run after the Origin drop's
  own update, with an undo on delete (no item steps reach actor data).

##### G.I. Joe gear and Transformers (`tf.mjs`)

- **Holographic Sights (upgrade).** Unchanged by this round. *Still needs:* a formula ref to the rolled item
  (`@rolled.<path>`), and per-host upgrade rules that ignore the host's `equipped`.
- **Scramble Field Generator.** `spendQuantity {item: self, deleteAtZero: true}` now covers the consume. The mark is
  the problem: it would have to carry the user and a mode, and be read by the user's allies' rolls. The Technology
  test's DIF depends on the mode chosen. *Still needs:* a mark carrying who set it and a mode (`markedBy:` with "same
  side as the marker"), and a choice-dependent DIF.
- **Again and Again and Again.** `button` could post the follow-up card. *Still needs:* a "repeat this attack" step
  (rerun the rolled item against the hit target with an extra downshift) and a per-turn counter.
- **Balance and Compensation.** *Still needs:* an ItemModifier op that steps a die-ladder string, and an item tag for
  "has a ranged weapon effect".
- **Bump & Run (the rest).** *Still needs:* a turn-end Trigger with a "moved at least N ft since the attack" tag.
- **EM Protective Lining (upgrade).** *Still needs:* a Defense rule that adds another item's stored bonus per attack,
  and the "lined" test (loose on a Transformer, or on equipped armor).
- **Perfect Placement.** *Still needs:* a placed-zone step and an "inside the zone" tag (self and target).
- **Precise Chronometrics.** *Still needs:* a distribute-points step and a write-Initiative step (a `button {who: gm}`
  could carry the GM half once those exist).
- **Now You Don't (the +5).** *Still needs:* a flat result bonus on a roll (`skillEffectModifierBonus`), and the Hide
  toggle as a rule switch key (it is still a code toggle in `hide.mjs`).
- **Overcharge Engines (with Multiplication).** *Still needs:* a step that stores a roll total in `@var`, a Movement
  rule fed by it until the end of the turn, and a per-turn limit that depends on another Perk.
- **Pop Out.** `button` could post the follow-up card. *Still needs:* the Hidden state as data, and a roll step against
  several targets' best Defense (`difDefense` reads the first target only).
- **Same Principle.** Besides the pick (see above), `item:picked:` can't work inside a WeaponTrait rule.
  `adapter.mjs#ruleWeaponTraits` hands the tags a shallow copy of the weapon (name, flags, parent, system), so the
  copy's `id` / `uuid` are missing. The old hook also writes `itemAndUpgradeTraits` and `upgradeTouched`. *Still
  needs:* a filtered `ownedItem` pick (or a migration of `o3SameWeapon`), and `ruleWeaponTraits` passing the weapon's
  id.
- **Telltale Sign.** *Still needs:* Pop Out first, then a repeatable button (`once: false`) with a per-target counter
  and a roll against the best of two Defenses.

##### Welcome to Night Vale (`wtnv.mjs`)

- **Gluten-Tolerant (the Weird refusal).** *Still needs:* a "forbids" rule that refuses an item whatever the
  prerequisite mode.
- **Gravity Optional (the jump).** An afterRoll Trigger on `roll:switch:<key>` can fire, but the `chat` step only fills
  in `{name}` / `{target}`, and afterRoll hands its steps no roll total. *Still needs:* the roll total as `@var` in
  afterRoll Triggers, and a chat step that prints a formula.

#### Engine pieces the remaining skips need

- **Picks:** `ownedItem` filters by item tag (Solarix Shard, Same Principle), a world-PC pick (Better Together), a
  migration of legacy pick flags into `rules.choices`, and `ruleWeaponTraits` passing the weapon's id so
  `item:picked:` matches (Same Principle).
- **Steps:** write Initiative and combatant flags (Follow Me!, Precise Chronometrics), repeat an attack (Again and Again
  and Again), roll against several targets' best Defense (Pop Out, Telltale Sign), a group test with a tally
  (Guardian Blast), update actor data with a floor (Metallic Armor, Void Touched, Dabbler), and store a roll total in
  `@var`, with chat formulas (Gravity Optional, Overcharge Engines).
- **Events:** the assisted roll's result for the assister (Betrayal), a resource spent (Solarix Shard), an ally's
  Initiative (Follow Me!).
- **State:** marks with an owner and a mode, read by the owner's side (Scramble Field), `until: endOfNextTurn` (Better
  Together), per-target per-scene lists read by DerivedStat / Defense (Self Improvement, Mega Defender), the Hidden
  state as data (Pop Out, Now You Don't), placed zones (Perfect Placement), "moved N ft since" (Bump & Run).
- **Other:** a hit rider-option rule (Solarix Shard), a `taken` DamageModifier that sees the attacker (Metallic
  Armor), a flat result bonus (Now You Don't), a "forbids" rule (Gluten-Tolerant), `@rolled.<path>` (Holographic
  Sights), a die-ladder ItemModifier op (Balance and Compensation).

#### Files touched outside the slice

- None. Only this file was added. No pack, slice, test or `lang/en.json` file changed.
