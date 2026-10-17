# Batch slD4: re-check of slD3 (`react`, `resource`, `other1`, `other3`) against the round-4 engine pieces

**Scope:** every item `docs/rules-batches/slD3.md` left Still skip, plus the code half of each item it left Partial
(103 items), re-checked against "Engine features added 2026-10-05 (round 4, after the local round-3 conversions)" in
`docs/RULES_CONVERSION_GUIDE.md` (wielding tags, `combat:exists`, `until: combat`, mark counters / `@mark`,
`essenceDamage` / `healEssence` / `extendCondition`, `rerollCard`, roll `snag` / `open`, grant `name` / `integrated` /
`systemFormulas`, step `filter`, outcome lists + `plainSuccess`, afterRoll `@var.total`, Toggle `legacy`, granted
attachments) and the earlier sections.

| Verdict (re-checked items) | react | resource | other1 | other3 | Total |
|---|---|---|---|---|---|
| Convert (was skip) | 4 | 1 | 0 | 1 | **6** |
| Still skip (incl. the code half of a partial) | 20 | 28 | 25 | 24 | **97** |
| Re-checked | 24 | 29 | 25 | 25 | **103** |

Overcharge Engines is exact only with the small `steps.mjs` edit under "Edits outside my files" (an `open` roll
with nothing to compare against reads its total as 0 today). The other five need no outside edit.

**17 rules were added to 6 pack items** (Their Loss, My Gain's second rule sits on its Loss And Gain Role Points
item). After the change `scripts/check-rules.mjs` reports 1685 rules on 1113 items, 0 errors, 0 warnings (other
agents were adding rules too, so the total isn't this batch's alone). ESLint is clean on my slice folders and the new
test file. Jest passes: 140 tests across the four slice folders, `conv4-slD4.test.js` (19 tests), `conv3-slD3.test.js`
and `engine4.test.js`.

## Converted

All are new `system.rules` arrays (inserted as text, CRLF like their files).

- **Point-Defense Reflexes** (`packs/qgtgitems/_source/Point_Defense_Reflexes_QmOeCUODYACCKiWG.json`), 4 rules:
  - a **Use** "Set the Contingency": cost a Free action, limit once per `turn`, `setToggle armed` with
    `until: combat`, and a chat line. It replaces the hand-written `react-arm-pointDefense` Use (`hasUsedThisTurn` /
    `markUsedThisTurn`, the same turn stamp).
  - a **turnStart Trigger** (`when: self:toggle:armed`) switching it off. That is `registerTurnStart(disarm)`.
  - two identical **Reactions**, `who: enemyOfAttacker` and `who: allyOfAttacker`, both `per: card`, `attackOnly`.
    Together they are the old "every holder but the attacker". `when` is three tags:
    - `{any: [not:combat:exists, self:toggle:armed]}`, which is `isArmed` (no combat means always armed);
    - `{any: [item:data:system.classification.style=explosive, weapon:trait:thrown]}`, which is
      `info.style == 'explosive' || info.traits.includes('thrown')`. `attackTraits` is the parent weapon's own
      traits, which is what `weapon:trait:` asks;
    - `self:wielding:item:data:system.classification.skill=targeting`, which is `wieldedEffect(...targeting)`.
      Both treat a weapon with no `equipped` value as equipped.

    Steps: holding Advanced Anti-Air Training (`self:hasItem:<uuid>`, the old `actorHasPerk`), switch the toggle
    off and roll Targeting against `@var.total`. Without it, a `choose` ("within your weapon's normal range?") whose
    options each switch the toggle off and roll, the "No" option with `snag: true`. `onSuccess` is
    `negateHit {rows: all}` plus a chat line. The order matches the old code: ask, disarm, roll. A cancelled
    question changes nothing. A cancelled roll leaves the Contingency spent and the button unclaimed, as before.
- **Advanced Anti-Air Training** (no pack change): its only code was the `actorHasPerk(REACT.advancedAntiAir)` check
  inside Point-Defense Reflexes. That check is now the `self:hasItem:` tag above. Its own RollModifier is unchanged.
- **Defender (PR CRB)** (`packs/prcrbitems/_source/Defender_4kt5qBpgTEgY8cGF.json`), 1 Reaction:
  - `who: allyOfTarget`, `within: 5`, `outcome: hit`.
  - `when` has four tags: `attack:melee`;
    `{any: [self:specializedIn:finesse, self:data:system.skills.finesse.isSpecialized]}` (`finesseSpecialized`);
    `self:wielding:item:data:system.classification.skill=finesse`; `self:skill:finesse>=d2`.
  - Steps: eight `lowerTotal` steps, each gated on `self:skill:finesse=<die>`, amounts `1d2` … `3d6`. This is
    `rollSkillDie` plus `lowered()`, the same shape as Sidestep.
- **Their Loss, My Gain** (`packs/fmmcitems/_source/Their_Loss__My_Gain_mgTerJX1jxtVMQMJ.json`) and **Loss And Gain**
  (`packs/fmmcitems/_source/Loss_And_Gain_kyqh747vyQnwSWu2.json`): one rule on each, both a watch Trigger:
  - `{event: afterRoll, watch: any, within: 60, outcome: [fumbled, allFailed]}`. That is the old `info.isFumble` and
    `rollFailed` (every row failed) on anyone else's check card within 60 ft.
  - Steps: a chat line ("{name} feeds on {target}'s Fumble.") and a `heal`.
  - On the Perk, `when: not:self:hasItem:<Loss And Gain>`, with amount
    `1 + min(3, floor((max(1, @level) - 1) / 5))`. That is `lossAndGain()`'s level fallback.
  - On the Loss And Gain item, `when: [self:hasItem:<Their Loss>, self:hasItem:<Loss And Gain>]`, with amount
    `max(0, S) + (1 - min(1, max(0, S))) * <level value>`, where `S = @item.system.bonus.value`. That is
    `stored > 0 ? stored : level value`.
  - Exactly one of the two fires for any holder.
- **Musical Interlude** (`packs/kocitems/_source/Musical_Interlude_0PVrQ1RsRNP023MO.json`), 1 Trigger:
  - `turnStart`, `when: [combat, not:self:marked:musicalInterlude]`.
  - Steps: `mark musicalInterlude {until: combat}`, which is the old per-combat "asked" flag, then a
    `button {who: owner, once: false}` "Didn't sing: suffer 1 Stress".
  - The button's steps are a `choose`: "1 Health" is `loseHealth 1` (the old direct −1 with a floor of 0), and
    "1 Essence damage" is `essenceDamage {essence: choose, amount: 1}`.
- **Overcharge Engines** (`packs/tfcrbitems/_source/Overcharge_Engines_BPHwAfGvLPZuJ1m1.json`), 9 rules:
  - two **Uses** (cost a Free action, `when: combat`), one for "not holding Multiplication" with limit 1 per turn and
    one for "holding Multiplication" (`self:hasItem:<uuid>`) with limit 2. They share `limit.key: overchargeEngines`.
    This is `overchargeUsesLeft`.
  - Their steps: an `open` Technology roll, then an `askNumber` with min = max = `ceil(max(0, @var.rollTotal) / 5) * 5`.
    That is `overchargeFeet`, and it opens no dialog when min equals max. Then `mark overcharge {count: @var.feet,
    add: true, until: endOfTurn}` (the feet accumulate within the turn, the old `earlier + feet`), and a chat line.
  - five **Movement** rules, one per type, `add @mark.overcharge` at stage `final`, each `when:
    [self:marked:overcharge, self:data:system.movement.<type>.total>0]`. This is the old derived pass's "every
    Movement with a total above 0".
  - a **MovementAction** `ignoreRoughTerrain` while marked. This is the old `ROUGH_TERRAIN_IGNORERS` entry.
  - a **turnEnd Trigger** that `unmark`s the mark. Its `when` reads the raw flag, because the mark has already
    expired once the turn moves on. This is `registerTurnEnd(unsetFlag)`, and the update re-prepares the actor so
    its Movement drops back, as before.

Removed with these:
- **`react/reactions.mjs`:**
  - the Point-Defense Reflexes `registerReaction` and its arming entry. The arming loop is now a single
    Desperate Parry `registerUse` with the same id.
  - the Defender `registerReaction` and `finesseSpecialized`.
  - `REACT.pointDefense`, `REACT.advancedAntiAir` and `REACT.defender`.
  - the imports `actorHasPerk`, `areAllies`, `distanceBetween`, `holdersOf` and `rollSkillDie`.
  - `_test` no longer carries `finesseSpecialized`.
  - The `registerApplyDialog` hook now reads `ctx.dataset.snag === true` instead of `reactSnag`. Nothing else
    passed `reactSnag`. This is what makes the rules `roll {snag: true}` work: dice.mjs never reads `dataset.snag`
    (see "Edits outside my files").
- **`react/triggers.mjs`:** `TRIG.lossAndGain`, `TRIG.theirLoss`, `lossAndGain()` and the Their Loss block of
  `onCheckCard`. Cruel Conflagration stays.
- **`react/react.test.js`:** the two Loss and Gain / Their Loss tests. Added: a test that the snag hook honours
  `dataset.snag`, and a Cruel Conflagration `onCheckCard` test, to keep that function covered.
- **`resource/mlp.mjs`:** the Musical Interlude `registerTurnStart` / `resMusicalInterlude` chat button, and the
  `registerChatButton` / `registerTurnStart` imports. **`resource/common.mjs`:** `IDS.musicalInterlude`.
- **`other3/tf.mjs`:** the Overcharge block: `overchargeUsesLeft`, `overchargeFeet`, `overchargeBonus`, the Use, the
  derived pass, the turnEnd hook and the rough-terrain registration. **`other3/shared.mjs`:** `O3.overchargeEngines`
  and `O3.multiplication`. **`other3/other3.test.js`:** the two Overcharge tests and `o3Overcharge` in the
  registered-Uses list.
- `react/core.mjs` is unchanged. Every export stays.

New tests (`module/rules/conv4-slD4.test.js`, 19) assert what the old ones did, and more:
- the level table 1/1/2/3/4/4 and Loss And Gain's stored value;
- the Use plus turnStart arming and disarming;
- offered or not by side, attack kind and Targeting weapon;
- the Snag only when out of range, and none with Advanced Anti-Air Training;
- Defender's gates and its lowered total;
- the per-combat Interlude card;
- Overcharge's once / twice per turn, the rounding, the Movement it adds, and turn-end clearing.

## Behaviour differences worth a decision

Same-line unless marked.

1. **Holders off the canvas (Point-Defense Reflexes, Defender, Their Loss, My Gain).** The old code searched every
   world actor holding the item. Reaction and watch rules only see actors with a token on the current scene (slD3
   difference 1 again). In practice all three needed a token already, because of the distance checks or the fight.
2. **Point-Defense Reflexes arming across combats.** The old Contingency counted only in the combat it was set in. The
   toggle uses `until: combat`, which does the same, except for one case. One set *outside* any combat (where it does
   nothing, since everyone is always armed there) carries into a combat created before the holder's first turn
   starts.
3. **Point-Defense Reflexes on an attack card with no target.** The old button needed a row with a target. The rule
   doesn't check for one. On such a card, a success negates nothing and only posts the line.
4. **Point-Defense Reflexes chat.** One line now covers both cases: "shoots the incoming weapon down ... (an
   explosive's blast is measured from where it was destroyed)". It replaces `ReactShotDown` / `ReactShotDownBlast`,
   because a step's `when` can't read the card's item. The button reads "Actor: Point-Defense Reflexes".
5. **Defender against your own attack.** `who: allyOfTarget` excludes the target but not the attacker. If the holder
   makes a melee attack against an adjacent ally (friendly fire), they are offered Defender against their own attack.
   The old code excluded that. There's no "the other party is me" tag.
6. **Defender with no Finesse die.** The button is hidden instead of warning (`self:skill:finesse>=d2`). The die is
   rolled by the formula engine and shown as a "rolled" line, not a Dice So Nice roll (as Sidestep, slD3 #2 and #4).
7. **Musical Interlude's card.**
   - One button, "Didn't sing: suffer 1 Stress", replaces the three. Pressing it asks Health or Essence, and an
     Essence pick asks which. "Sang a song" did nothing before and is now simply not pressing.
   - Only the pony's owners and the GM can press it. Before, anyone could.
   - It can be pressed again (`once: false`), as the old buttons could.
   - Essence damage now goes through `applyEssenceDamage`, so Immortal Rebel Soul (WTNV) would apply. That's
     cross-line.
   - Unlinked tokens of one base actor are each asked. The old flag was keyed by the base actor's id.
8. **Overcharge Engines.**
   - The Use needs a *started* combat (`when: combat`). The old one also showed in a combat that was set up but not
     started. There, a turn mark would never expire.
   - The feet are added at the Movement `final` stage, just before `_applyGravityMovement`. The old derived pass ran
     after everything. Low Gravity's +10 commutes with this. In a **Zero-G** scene, Zero-G now sets the speeds after
     Overcharge (aerial 20, the rest 0). Before, Overcharge's feet were added on top. That's cross-environment.
   - The chat card is a rules card ("Overcharge Engines" title, then the line).
9. **Limits restart once.** The old flags (`reactArmed.pointDefense`, `react-arm-pointDefense`, `o3Overcharge`, the
   combat's `musicalInterludeAsked`) aren't read any more. A Contingency or Overcharge set just before the update is
   forgotten that one time, and a pony already asked this combat is asked again.

## Still skipped (97), and what each still needs

### react (20)
- **Desperate Parry**: wielding tags now cover the offer, and `updateItem` would break the weapon. It still needs an
  item selector for "the weapon being wielded". `type:weapon` takes the first weapon, equipped or not.
- **Projectile Deflector**: the crit's GM damage button needs the row's damage *and damage type* at press time. A
  `button`'s steps can't read the poster's `@var.damage`, and `damageType` is fixed text.
- **Shoot Out**: `self:wielding:` takes one narrowing tag. This needs "ballistic weapon AND non-melee attack" on the
  same attack, plus a roll with that attack's own Skill (Rail Pistol rolls Technology).
- **Defender (Megaform Trait)**: offers to the pilots of a Megaform's members (Reaction `who` has no such side).
- **Counterstrike (DD)**, **Steady Footing (counter half)**: these need three things:
  - a step that sets the user's targets;
  - a `bonusAttack` that doesn't stop the run outside combat (its `when` is the attack filter and can't gate it, and
    a `filter` leaving no one still fails the step);
  - a one-slot bank tied to the attacker. `appliesWhen: markedByMe:<key>` would do, but the bank stacks instead of
    overwriting.
- **Junker**: an "equipment broke" event.
- **Not On My Watch (IA)**: a drop-to-0 event outside `applyDamage`, whispered cards, and holders off the canvas.
- **All For One**: a drop-to-0 Power event and a card with two answers paid by the presser.
- **Agency**: a rule read by dice.mjs's Fumble Story Point grant.
- **Cruel Conflagration**: a "failed but not Fumbled" outcome (no outcome excludes `fumbled`), and a whispered card
  with two paid answers.
- **Revengeful**: a tag comparing a stored uuid with the Defeated target.
- **Inspirational Leader (combat half)**: storing the rolled Skill for an allies aura until the end of the round.
- **Monster Morph**: a roll against every creature within 10 ft at once, and a per-Path rule home.
- **Iron Bravado (share half)**: copying Condition immunities to allies.
- **Cyborg**: an Essence damage redirect and a heal lock.
- **Mind Beam**: a rule reading the spell's pre-roll effect choice.
- **Energized**, **Spiked**, **Energy Field**: an incoming DialogSwitch and a "plain Reach" attack tag.

### resource (28)
- **Play Favorites**, **Play Favorites Against Each Other**, **This, I Command**: a personal Story Point resource.
- **Ruthless Efficiency**: the same personal points (watch `turnEnd` fits the event).
- **Money Talks**, **Capable Freelancer**: a confirmable pre-roll Skill swap that rewrites the dataset.
- **Motor Pool Connections**: a vehicle picker, per-vehicle budgets, a grant onto another actor (permanent code).
- **Inner Conservation**, **Power Efficiency**, **Dino Charged**, **Fuel Efficient**: a `resourceSpent` event.
- **Repair Progress**: a gain past `.max`.
- **Body of Energy (damage / unmorph halves)**: a pooled-resource damage modifier, and an unmorph Trigger with the
  pre-update values.
- **Dark Energon**, **Primal Energon**, **Red Energon**, **Synth-En**, **Word of Unicron**: conditional `choose`
  options, an actor-flag stamp step and the addiction subsystem (effectively permanent code).
- **Together We Stand**: a "two or more team members" combat-start gate, per-recipient de-duplication, and
  ledger-recorded temporary Health.
- **Think Fast!**: `storyPointSpent` with the spend kind.
- **We Improvise**: a per-combat ledger.
- **Beast Mode**: an event on its flag and level-gated packages (permanent code).
- **Honest Compassion**: `healEssence` and a formula `rest` limit (`1 + 2 * min(1, floor(@level / 11))`) now fit.
  The "who is hurt, and which kind" check (and the Health-or-Essence question) runs *before* the Standard action is
  paid. A Use's steps only run after its cost (except `pickAlly`), and a target-dependent `when` isn't checked
  before paying.
- **Musical Interlude**: converted (above).
- **Camper**: a per-member "heal 1 Health or 2 Essence" with the question only when both are damaged (`choose` has
  no per-option `when`), plus a scene-window team aura gated on the camper's own Health.
- **Zap Apple Jam**: `healEssence` fits, but the choices depend on cups / pastries left (`choose` options can't be
  gated). It also needs per-item counters shown in the prompt and a shelf-life sweep.
- **Circle of Magical Friends**: Circle recipients and copying items (permanent code).
- **Extensive Research**: a world-time (one week) expiry.
- **History Buff (Use half)**: a blind one-die-smaller roll.

### other1 (25)
- **Interspatial Pause**: hiding tokens (permanent code), and a no-damage mark.
- **Quantum Trigger**: retrying the last Skill Test with a cumulative ↓n. `rerollCard` rerolls dice and doesn't
  re-make the test.
- **Timeslide**: moving a token (permanent code).
- **Time Strike**, **Onslaught**: hit rider options from sibling effects.
- **Special Program**: compendium-Perk picks with prerequisite labels.
- **Lance of Light**: a target / range gate before the cost.
- **Savant Skill**: a reroll-result Trigger, and "add a d4".
- **Good with Both**: an equipped-items count.
- **Unlucky (For You)**: the Snag half is dice.mjs's, and its watch on the target's next Skill Test is armed there.
  It also needs a per-target limit.
- **Altered**, **Additional Alteration**: an Alteration cost waiver.
- **Overload**, **Genetic Support**, **Advanced Alteration Emulator**: a lent Alteration benefit (the durations exist).
- **Thick Hide**: a kept-equipped shield, and an Alterations-count Defense.
- **Standard Deflecting Weapon**, **Limited Deflecting Weapon**: linked-item grants kept with their host.
- **Shield Fighter**: a hit rider option with the stored damage type.
- **Disenfranchised**: three buttons on one card, and button steps that read the poster's values.
- **Armor Matrix (Light / Medium / Heavy)**: a create veto, and a best-of Defense.
- **Eat the Weak**: a "target has item X" gate before the roll, a self fallback for `difDefense`, and a starts-with
  name match.
- **Multimorph**: an origin-perk picker.

### other3 (24)
- **Betrayal**: the assisted roll's result for the assister, and a "split from the party" state.
- **Dabbler**: a Skill-rank step, and a filtered Skill pick.
- **Self Improvement**: per-target per-scene stored Essence picks.
- **Follow Me!**: a write-Initiative step, and an "ally rolled Initiative" event.
- **Better Together (+ Hang-Up)**: a world-PC pick, a pair read from either actor, and an "actor has a token on the
  scene" tag.
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
- **Perfect Placement**: placed zones (permanent code).
- **Precise Chronometrics**: distribute-points and write-Initiative steps.
- **Now You Don't (+5)**: a flat result bonus, and the Hide state as data.
- **Pop Out**, **Telltale Sign**: a roll against several targets' best Defense, and the Hidden state.
- **Same Principle**: a filtered `ownedItem` pick, and `ruleWeaponTraits` passing the weapon id.
- **Gluten-Tolerant**: a "forbids" rule.
- **Gravity Optional (jump)**: a keyed DialogSwitch plus an afterRoll Trigger (`roll:switch:`, `@var.total`, an
  `askNumber` with min = max for the tripled number) would do it. But dice.mjs posts a roll with nothing to compare
  against (no target, no DIF, the usual jump) through `_rollSkillHelper`'s early return, which never calls
  `runPostRoll`. So no afterRoll fires for those rolls, and the old code read every Athletics card.

## Edits outside my files

**1. `module/rules/steps.mjs`, `roll` handler, the `open` branch: read the total of a roll with nothing to compare
against, and pass the Skill's sheet shifts.** Overcharge Engines needs this. Today, for an untargeted roll with no
DIF, `outcomes[0].results` is empty (dice.mjs `_rollSkillHelper` returns `{results: [], roll}`), so `@var.rollTotal`
is 0. The sheet values are what other3's `rollSkillTotal` (the removed code's roll) and a sheet roll pass. Without
them, a standing ↑/↓ on the Skill (`system.skills.<skill>.shiftUp/shiftDown`) is dropped. Replace

```js
      const essence = globalThis.CONFIG?.E20?.skillToEssence?.[step.skill] ?? 'smarts';
      const result = await ctx.actor?._dice?.rollSkill?.({ skill: step.skill, essence, shiftUp: 0, shiftDown: 0, ...extra }, ctx.actor);
      if (!result || result.cancelled) {
        return false;
      }

      ctx.vars.lastRoll = { success: !!result.success, total: Number(result.total ?? result.outcomes?.[0]?.results?.[0]?.total) || 0 };
```
with
```js
      const essence = globalThis.CONFIG?.E20?.skillToEssence?.[step.skill] ?? 'smarts';
      // The Skill's own standing shifts and Specialized flag, as a sheet roll passes them.
      const fields = ctx.actor?.system?.skills?.[step.skill] ?? {};
      const result = await ctx.actor?._dice?.rollSkill?.({
        rollType: 'skill', skill: step.skill, essence, shift: fields.shift, shiftUp: fields.shiftUp ?? 0, shiftDown: fields.shiftDown ?? 0,
        isSpecialized: fields.isSpecialized, ...extra,
      }, ctx.actor);
      if (!result || result.cancelled) {
        return false;
      }

      // A roll with nothing to compare against has no results - its total is the outcome's roll (dice.mjs#_rollSkillHelper).
      const outcome = result.outcomes?.[0];
      ctx.vars.lastRoll = { success: !!result.success, total: Number(result.total ?? outcome?.roll?.total ?? outcome?.results?.[0]?.total) || 0 };
```
No pack used `open: true` before this batch. `engine4.test.js`'s open-roll test still passes, because it uses
`toMatchObject`. `conv4-slD4.test.js` passes with or without this edit: its mocked roll carries the total in both
places.

**2. (Recommended, not required) `module/dice.mjs`, honour `dataset.snag` itself.** The rules `roll {snag: true}`
reaches `rollSkill`'s dataset, but dice.mjs never reads it. For now, `react/reactions.mjs`'s `registerApplyDialog`
hook sets `options.snag` from `ctx.dataset.snag === true` (formerly `reactSnag`), so the step works. If the react
slice is ever retired, move that one check into dice.mjs next to `runApplyDialog(actor, skillRollOptions, { ...
dataset ... })`: `if (dataset.snag === true) { skillRollOptions.snag = true; }`.

## Unused strings

These `lang/en.json` keys (under `E20`) have no code use left:
- react: `ReactPointDefense`, `ReactPointDefenseRange`, `ReactYes`, `ReactNo`, `ReactShotDown`, `ReactShotDownBlast`,
  `ReactNoSkillDie`, `ReactTheirLoss`;
- resource: `ResMusicalInterlude`, `ResMusicalInterludePrompt`, `ResMusicalInterludeSang`, `ResMusicalInterludeStress`,
  `ResStressWhichEssence`;
- other3: `O3OverchargeLine`.

`ReactContingencySet` (Desperate Parry), `ReactLoweredMiss` / `ReactLoweredHit` (Megaform Defender) and
`ResStressHealth` / `ResStressEssence` (Honest Compassion, Camper) are still used.

## Files touched

- Packs (rules inserted as text, CRLF):
  - `packs/qgtgitems/_source/Point_Defense_Reflexes_QmOeCUODYACCKiWG.json` (4 rules)
  - `packs/prcrbitems/_source/Defender_4kt5qBpgTEgY8cGF.json` (1)
  - `packs/fmmcitems/_source/Their_Loss__My_Gain_mgTerJX1jxtVMQMJ.json` (1)
  - `packs/fmmcitems/_source/Loss_And_Gain_kyqh747vyQnwSWu2.json` (1)
  - `packs/kocitems/_source/Musical_Interlude_0PVrQ1RsRNP023MO.json` (1)
  - `packs/tfcrbitems/_source/Overcharge_Engines_BPHwAfGvLPZuJ1m1.json` (9)
- Slice:
  - react: `react/reactions.mjs`, `react/triggers.mjs`, `react/react.test.js`;
  - resource: `resource/mlp.mjs`, `resource/common.mjs`;
  - other3: `other3/tf.mjs`, `other3/shared.mjs`, `other3/other3.test.js`.
- New: `module/rules/conv4-slD4.test.js` (19 tests) and this file.

**Rules added: 17** (on 6 items).

## Engine pieces the remaining skips need (most useful first)

1. **Steps that run before a Use's cost, and `choose` options with their own `when`** (medium). One example is a
   `require {when, to}` step (or `filter`ed steps) honoured before paying, like `pickAlly`. Unblocks Honest Compassion,
   Camper (per-recipient Health-or-Essence question), Zap Apple Jam (options by cups / pastries left), Lance of Light
   and Eat the Weak (gates before the cost).
2. **An item selector for the wielded weapon, and compound `wielding` narrowing** (small). `item: "wielded"` /
   `"wielded:<tag>"` on item steps; `self:wielding:{all: [...]}` or a list; `roll {skill: "wielded"}` (that attack's
   own Skill). Unblocks Desperate Parry (break the parrying weapon) and Shoot Out.
3. **afterRoll for rolls with nothing to compare against** (small). Call `runPostRoll` on `_rollSkillHelper`'s
   no-checkContext path with `@var.total` from the roll. Unblocks Gravity Optional (jump), and any "on any roll of
   Skill X" Trigger.
4. **Button cards that keep the poster's numbers** (small). Freeze `@var.*` into the card, plus `damageType` from a
   var or the card row. Unblocks Projectile Deflector, Disenfranchised (with item 9) and Shield Fighter's stored type.
5. **Counter-attack plumbing** (small to medium): a `setTargets` step, a `bonusAttack {optional: true}` that doesn't
   stop the run outside combat, and a one-slot bank (`replace: true`). Unblocks Counterstrike (DD) and Steady Footing.
6. **A `resourceSpent` event** (with the resource and amount as vars) (medium). Unblocks Inner Conservation, Power
   Efficiency, Dino Charged, Fuel Efficient and Solarix Shard's refund.
7. **A personal Story Point pool resource** (medium). Unblocks Play Favorites, Play Favorites Against Each Other,
   This I Command and Ruthless Efficiency.
8. **Outcome `plainFailure` (failed, not Fumbled), whispered button cards, and cards with several buttons** (small
   to medium). Unblocks Cruel Conflagration, All For One (with a drop-to-0 Power event), Disenfranchised and
   Not On My Watch (IA).
9. **Small one-offs** (small each):
   - `gainResource {overMax: true}`: Repair Progress.
   - `storyPointSpent` with the spend kind: Think Fast!.
   - `until: "worldTime:<seconds>"`: Extensive Research.
   - an "equipment broke" event: Junker.
   - a "picked uuid = target" tag: Revengeful.
   - a write-Initiative step: Follow Me!, Precise Chronometrics.
   - a Skill-rank step: Dabbler.
   - a die-ladder ItemModifier op: Balance and Compensation.
10. **A retry-the-last-test step with a cumulative ↓** (medium). Unblocks Quantum Trigger, and Savant Skill with a
    reroll-result event.
11. **A lent Alteration benefit** (large design). Unblocks Overload, Genetic Support and Advanced Alteration
    Emulator.
12. **Effectively permanent code** (bespoke UI or whole subsystems):
    - Motor Pool Connections; Circle of Magical Friends.
    - Interspatial Pause and Timeslide (tokens); Perfect Placement (zones).
    - Beast Mode packages; the Energon strains and Word of Unicron (addiction).
    - Monster Morph; Mega Defender; Guardian Blast.
    - Better Together (world-PC pairing).
    - Armor Matrix (create veto); Gluten-Tolerant (forbids); Special Program / Multimorph pickers.
    - Money Talks / Capable Freelancer (dataset rewrite); Agency (dice.mjs's Fumble grant).
    - Megaform Defender (pilot lookup); Cyborg; Iron Bravado's share.
