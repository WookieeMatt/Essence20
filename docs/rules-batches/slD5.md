# Batch slD5: re-check of slD4 (`react`, `resource`, `other1`, `other3`) against the round-5 engine pieces

**Scope:** every item `docs/rules-batches/slD4.md` left Still skip (97 items, the code halves of earlier partials
included), re-checked against "Engine features added 2026-10-05 (round 5, after the local round-4 conversions)" in
`docs/RULES_CONVERSION_GUIDE.md` (`target:ally|enemy`, `var:` tags, `vehicle:` tags, `terrain:set`,
`environment:outside`, the new `check:` names, `@host`, text fills, unstarted-combat durations, `to: party|team`,
`updateActor`, `require` + `beforeCost`, `setTargets`, `writeInitiative`, `table`, the wielded item selector and
roll Skill, `overMax`, `bonusAttack {optional}`, `bank {replace}`, `pick {filter, auto}`, button vars, DerivedStat
`{choice}` paths, `consumeMark`, Movement `afterGravity`, the `equipped` / `unequipped` / `resourceSpent` /
`essenceChanged` events, `plainFailure` / `anySucceeded`) and the earlier sections.

| Verdict (re-checked items) | react | resource | other1 | other3 | Total |
|---|---|---|---|---|---|
| Convert (was skip) | 3 | 4 | 1 | 0 | **8** |
| Partial (was skip) | 0 | 1 | 0 | 1 | **2** |
| Still skip | 17 | 23 | 24 | 23 | **87** |
| Re-checked | 20 | 28 | 25 | 24 | **97** |

Two conversions need a one-line engine edit each (see "Edits outside my files"): Desperate Parry (the step validator
doesn't accept `item: "wielded"` yet) and Projectile Deflector (a Reaction's vars carry the row's damage but not its
damage type). The other eight need nothing outside my files.

**12 rules were added to 10 pack items.** With the change `scripts/check-rules.mjs` reports 1807 rules on 1146
items, 2 errors (both Desperate Parry's `item: "wielded"`, gone once edit 2 is applied), 0 warnings. ESLint is clean
on my four slice folders and the new test file. Jest: the four slice folders pass (90 tests), and
`conv4-slD4.test.js`, `conv3-slD3.test.js`, `engine5.test.js` still pass. `conv5-slD5.test.js` has 25 tests: 23
pass now, and the other two (rule validation, the deflected damage's type) pass once the two outside edits are in.
I checked that in a scratch copy of the repo with both edits applied: all 25 pass.

## Converted

All are new `system.rules` arrays (inserted as text, LF like these pack files), except Lance of Light, whose existing
array got a second rule.

- **Desperate Parry** (`packs/qgtgitems/_source/Desperate_Parry_ljlMd2MmeF9LEBbz.json`), 3 rules, built the same way as
  Point-Defense Reflexes:
  - a **Use** "Set the Contingency": a Free action, `limit` once per `turn`, `setToggle armed` with `until: combat`,
    and a chat line. It replaces the hand-written `react-arm-desperateParry` Use.
  - a **turnStart Trigger** that switches the toggle off. It replaces `registerTurnStart(disarm)`.
  - a **Reaction** (`who: target`, `outcome: hit`). `when` is `attack:melee`,
    `{any: [not:combat:exists, self:toggle:armed]}` (the old `isArmed`) and `self:wielding` (the old
    `wieldedEffect(actor, () => true)`). Steps: a `choose` between Acrobatics and Finesse. Each option switches the
    toggle off and rolls that Skill against `@var.total`. On a success it runs `negateHit`, a chat line, and
    `updateItem {item: "wielded", set: {system.equipped: false, flags.essence20.broken: true}}`. The order matches
    the old code: ask, disarm, roll. A cancelled question changes nothing. A cancelled roll leaves the Contingency
    spent and the button unclaimed, as before. The broken flag still wakes Junker, through the `updateItem` hook in
    `react/triggers.mjs`.
- **Counterstrike (DD)** (`packs/dditems/_source/Counterstrike_PdmiiOmBYzNfXTeh.json`), 1 Reaction:
  - `who: target`, `outcome: miss`, `maxMargin: -5` (the old `row.difficulty - info.total >= 5`), `limit` once per
    `round`. `when` is `attack:melee` and `target:data:id` (there is an attacker).
  - Steps:
    - `mark counterstrike` on the attacker;
    - `bank {replace: true, downshift: 1, appliesWhen: [attack:melee, markedByMe:counterstrike]}`, the old
      `reactCounter` flag, one slot;
    - `setTargets` to the attacker, the old `targetActor`;
    - `bonusAttack {cost: free, optional: true}`, the old `grantBonusAttack` when there is a combat;
    - a chat line.
- **Projectile Deflector** (`packs/iafav2items/_source/Projectile_Deflector_2eWBm6hbiifmySvX.json`), 1 Reaction:
  - `who: target`, `outcome: hit`, `attackOnly`, `limit` once per `encounter` (the old `getUses(..., 'encounter')`,
    marked after a roll that wasn't cancelled). `when` is `item:data:system.classification.style=projectile` and
    `not:target:type:playerCharacter`.
  - Steps: roll Finesse against `@var.total`.
    - `onSuccess`: `negateHit` and a line.
    - `onCrit`: `negateHit`, a line, and a `button {who: gm}` (only when `var:damage>0`) whose step is
      `damage {to: target, amount: @var.damage, damageType: {var.damageType}}`. That is the old GM-only
      `damageButton` with the row's damage and type. It needs edit 1.
- **Honest Compassion** (`packs/mlpcrbitems/_source/Honest_Compassion_Dfjo9U9cAgigD9oA.json`), 1 Use:
  - a Standard action, `limit` per `rest` with max `1 + 2 * min(1, floor(@level / 11))`. That is `honestCompassionMax`
    plus the Rest reset of the old daily flag.
  - Five steps run before the cost (`beforeCost`):
    - `target {min: 0, max: 1}`;
    - one `require` for the targeted friend and one for the pony itself, each gated on `target:data:id` or
      `not:target:data:id`. This is `targetedActor() ?? actor`. Each needs Health below max or any Essence below
      its max, the old `pickStressKind` "nothing to heal" check;
    - one `pick` (list Health / Essence) for each side, gated on both kinds being hurt. That is the old question,
      asked only when both are damaged. Backing out stops the run before anything is paid.
  - Then `healEssence` (most-damaged Essence first, the old `healEssenceDamage`) and `heal` 1, one of each per side.
    Each is gated on `var:picked`, or, when nothing was picked, on that kind being the hurt one.
  - The `when` language has no "all" inside an "any", so each side has its own steps.
- **Inner Conservation** (`packs/ttsgitems/_source/Inner_Conservation_NkHKAb5TFc7n7C8k.json`), 1 Trigger:
  `resourceSpent`, `when: [var:resource=power, var:spent>=2]`, `prompt: true` (the old yes/no), `limit` once per
  `scene` (a "no" doesn't use it). Steps: `gainResource` of `@var.spent - ceil(@var.spent / 2)` with `overMax`
  (the old refund was not capped), and a line.
- **Power Efficiency** (`packs/ttsgitems/_source/Power_Efficiency_3fa8lKE6TpQ6lr0P.json`), 1 Trigger:
  `resourceSpent` on Power. A `table` rolls 1d4 (the roll goes in the chat, like the old Roll card), and a 4 gives
  `gainResource 1 {overMax}` and a line.
- **Dino Charged** (`packs/bthitems/_source/Dino_Charged_n9ME10p6mfOJnUdE.json`), 1 Trigger: `resourceSpent` on Power
  while `self:morphed`. A `choose` offers "None" (the old skip) or one of the four Essences. Each Essence option is
  `essenceDamage {amount: @var.spent}`.
- **Lance of Light** (`packs/jttitems/_source/Lance_of_Light_HUdL1MryICmRmWnP.json`), 1 Use added beside its
  RollModifier:
  - a Standard action, `when: self:data:flags.essence20.lanceOfLightActive` (the old `canUse`).
  - Before the cost: `target {max: 1}` and `require target:within:10`.
  - Then a line and a `button {who: targets}` whose step is `damage 1 element` to the target. That is
    `damageOrOffer`'s button, which the target's owner (or the GM) presses.

**Partial:**
- **Repair Progress (Bonus Energon Point)** (`packs/ccfitems/_source/Repair_Progress__Bonus_Energon_Point_rPbEnrg7Qx2Lm9Vd.json`),
  1 Trigger: `added` gives `gainResource 1` on `system.energon.normal.value` with `overMax`, and a line. That is the
  old `createItem` hook. **Stays code:** the bonus point riding over a Rest, the "spent" mark when Energon drops from
  above the maximum, and the `ENERGON_CAP_EXTRAS` entry (`resource/energon.mjs`, `resource/temp-resources.mjs`).
- **Solarix Shard** (`packs/ttsgitems/_source/Solarix_Shard_jPqr2DuJMSQgiILp.json`), 1 Trigger: `resourceSpent` on
  Power, `limit` once per `scene`. It gives `gainResource 1 {overMax}` (the old `next + 1`) and a line. That is the
  old `o3SolarixScene` refund. **Stays code:** the Power Weapon pick (Use) and the +1 Fire hit-rider option
  (`other3/pr.mjs`).

Removed with these:
- **`react/reactions.mjs`:**
  - the Desperate Parry `registerUse`, `registerTurnStart(disarm)` and `registerReaction`;
  - the Counterstrike and Projectile Deflector `registerReaction`s;
  - `REACT.desperateParry`, `REACT.projectileDeflector` and `REACT.ddCounterstrike`;
  - the imports `registerTurnStart`, `registerUse`, `hasUsedThisRound`, `markUsedThisRound`, `getUses`, `markUsed`,
    `arm`, `choose`, `damageButton`, `disarm`, `isArmed`, `skillLabel` and `announceBroken`;
  - `_test` no longer carries `disarm`.

  Steady Footing still uses `bankCounter` and its roll source / consumer.
- **`react/triggers.mjs`:** `announceBroken` (its only caller was Desperate Parry) and the `createChatMessage` hook
  reading its `reactBroken` flag. The `updateItem` hook that reads the broken flag stays.
- **`react/core.mjs`:** unchanged. Every export stays, including `arm`, `isArmed`, `disarm` and `damageButton`.
- **`react/react.test.js`:** the Desperate Parry test is replaced by two tests. One covers the Contingency helpers
  (still exported); the other covers a Shoot Out offer, so `reactionsFor` stays covered.
- **`resource/mlp.mjs`:** the Honest Compassion block (`DAILY_FLAG`, `dailyUses`, `honestCompassionMax`,
  `markDaily`, its `registerRest`, the Use) and the imports `registerRest` and `targetedActor`.
- **`resource/common.mjs`:** `IDS.honestCompassion`, `IDS.innerConservation`, `IDS.powerEfficiency`,
  `IDS.dinoCharged`, and `targetedActor()` (no caller left).
- **`resource/power-spend.mjs`:** `onSpend`, `refund`, `innerConservationRefund`, `INNER_CONSERVATION_KEY`, the
  spend branch of the `updateActor` hook, and the scene-clock import. Void Warrior and Body of Energy stay.
- **`resource/energon.mjs`:** the Repair Progress `createItem` hook.
- **`resource/resource.test.js`:** the Inner Conservation refund test, the `honestCompassionMax` assertions, and
  `IDS.honestCompassion` in the registered-Uses list.
- **`other1/jtt.mjs`:** the Lance of Light Use, `lanceActive`, `O1_JTT.lanceOfLight`, and the `damageOrOffer` /
  `firstTarget` imports. **`other1/shared.mjs`:** `damageOrOffer` (no caller left). The `o1ApplyDamage` button
  handler stays, because r2misc and zord1 still post it.
- **`other3/pr.mjs`:** the Solarix refund's `preUpdateActor` / `updateActor` hooks, `POWER_PATH`, `powerChange`,
  `SOLARIX_KEY`, and `getUses` / `markUsed` from the scene-clock import.

New tests (`module/rules/conv5-slD5.test.js`, 25) assert what the old ones did, and more:
- every rule validates;
- Desperate Parry: arming, disarming at turn start, the offer gates (melee, hit, armed or no combat, wielding), the
  Skill question, the negated hit, the weapon broken and unequipped, and a cancel;
- Counterstrike: the margin and melee gates, the bank applying only to melee attacks on that attacker, one slot, and
  the per-round limit;
- Projectile Deflector: the Threat, style and hit gates, the success, cancel / failure accounting, the per-encounter
  limit, and the crit's GM button with damage and type;
- Honest Compassion: self versus target, the question only when both kinds are hurt and before the cost, nothing to
  heal, and 1 or 3 uses per Rest;
- the four `resourceSpent` Perks: amounts, the scene limits, the prompt, and Morphed-only;
- Repair Progress over the maximum;
- Lance of Light: summoned-only, the range gate before the cost, and the button.

## Behaviour differences worth a decision

Same-line unless marked.

1. **Desperate Parry**
   - "The weapon being wielded" is now the first wielded weapon in the actor's item order. The old code took the
     weapon of the first wielded *attack*. These differ only when the item order of two equipped weapons doesn't
     match the order of their attacks.
   - The break line no longer names the weapon (chat text can't read an item name).
   - The Use limit only counts in a started combat (the old turn stamp also counted in a set-up one), as for
     Point-Defense Reflexes.
   - Old `reactArmed.desperateParry` flags are no longer read. A Contingency set just before the update is
     forgotten once.
2. **Counterstrike.**
   - The old single flag held one attacker. Now the attacker is marked, and marks from earlier Counterstrikes stay
     on those attackers. The one banked ↓1 (`replace`) can therefore be spent on a melee attack at an *older*
     Counterstrike target, if the holder attacks them before the newest one.
   - A holder who also has Steady Footing keeps two separate banks. The old code had one shared slot.
   - The round limit only counts in a started combat.
3. **Projectile Deflector.** The GM button is a rules card ("Apply the deflected damage") instead of the react
   "Apply N type to X" button. Until edit 1 lands, the damage type falls back to Blunt.
4. **Honest Compassion.**
   - "Nothing to heal" is a chat card instead of a warning toast.
   - The Health / Essence question is a select dialog (a `pick`), not two buttons. The pick is remembered on the
     item as `rules.choices.stress`, but it is asked fresh every time.
   - Old `resDailyUses` counts are not read. Anyone mid-day gets their uses back once.
5. **The `resourceSpent` Perks (Inner Conservation, Power Efficiency, Dino Charged, Solarix Shard).**
   - The event fires on every decrease of `system.powers.personal.value` by this user. The old code skipped writes
     flagged `essence20Loss` (Body of Energy's damage split). A Phantom Ranger holding one of these Perks would now
     have them fire when damage spills into Power. That is cross-line (ATS + TTSG / BtH).
   - Each Perk sees the full `@var.spent`. In the old chain, an Inner Conservation refund lowered what Dino Charged
     charged in Essence. Holding both, a halved spend of 4 now costs 4 Essence damage instead of 2. That is
     cross-book (TTSG + BtH).
   - Inner Conservation's question is the generic "Use Inner Conservation: Pay half the Personal Power?". It no
     longer shows the numbers.
   - Dino Charged's Essence damage goes through `applyEssenceDamage`, so Immortal Rebel Soul (WTNV) would apply.
     That is cross-line.
   - Old per-scene flags (`innerConservationScene`, `o3SolarixScene`) are not read. A use spent this scene comes
     back once.
6. **Lance of Light.**
   - The 1 Energy damage is always a button, which the target's owner or the GM presses. Before, a user who owned
     the target (usually the GM) had it applied at once.
   - With no token of its own on the scene, the holder can't use it any more, because the range is unknown. The
     old check let it through.
   - "No target" is the engine's "needs a target" card and toast, not just a toast.
7. **Repair Progress.** The gain line is a rules card.

## Still skipped (87), and what each still needs

### react (17)
- **Shoot Out**: `self:wielding:` and `wielded:` take one narrowing tag. This needs "ballistic AND non-melee" on the
  same attack (and `item:trait:` doesn't read `itemAndUpgradeTraits`). A single tag would roll a ballistic weapon's
  melee attack's Skill.
- **Steady Footing**: a Reaction can't see the card's Fumble or its damage type (the rider's `maneuver` / `grapple`).
- **Defender (Megaform Trait)**: offers to the pilots of a Megaform's members (Reaction `who` has no such side).
- **Cruel Conflagration**: `plainFailure` / `fumbled` fit the offers. But `applyCondition` relayed through the GM drops
  the rounds (Impaired would never end) and needs the roller targeted. The old card was also whispered.
- **Junker**: an "equipment broke" event.
- **Not On My Watch (IA)**: `defeated` only fires inside `applyDamage`, while the old code read any drop to 0. Also
  whispered cards, and holders off the canvas.
- **All For One**: a drop-to-0 Power event, and a card with two answers paid by the presser.
- **Agency**: a rule read by dice.mjs's Fumble Story Point grant.
- **Revengeful**: a tag comparing a stored uuid (the `pendingRevengeful` attacker) with the Defeated target.
- **Inspirational Leader (combat half)**: storing the rolled Skill for an allies aura until the end of the round.
- **Monster Morph**: a roll against every creature within 10 ft at once, and a per-Path rule home.
- **Iron Bravado (share half)**: copying Condition immunities to allies.
- **Cyborg**: an Essence damage redirect and a heal lock.
- **Mind Beam**: a rule reading the spell's pre-roll effect choice.
- **Energized**, **Spiked**, **Energy Field**: an incoming DialogSwitch and a "plain Reach" attack tag.

### resource (23, plus the code half of Repair Progress)
- **Play Favorites**, **Play Favorites Against Each Other**, **This, I Command**, **Ruthless Efficiency**: a personal
  Story Point pool resource.
- **Money Talks**, **Capable Freelancer**: a confirmable pre-roll Skill swap that rewrites the dataset.
- **Motor Pool Connections**: a vehicle picker, per-vehicle budgets, a grant onto another actor (permanent code).
- **Fuel Efficient**: one d4 *per point spent* (a dice count from `@var.spent`, or a repeat step), and skipping the
  Rest update (resourceSpent fires on it).
- **Repair Progress (code half)**: the Rest carry-over and the "spent" mark (an Energon cap rule).
- **Body of Energy (damage / unmorph halves)**: a pooled-resource damage modifier, and an unmorph Trigger with the
  pre-update values.
- **Dark Energon**, **Primal Energon**, **Red Energon**, **Synth-En**, **Word of Unicron**: the addiction subsystem
  (effectively permanent code).
- **Together We Stand**: `to: party` now exists, but it still needs a "two or more team members" combat-start gate
  and ledger-recorded temporary Health that is taken back at scene end.
- **Think Fast!**: `storyPointSpent` with the spend kind.
- **We Improvise**: a per-combat ledger.
- **Beast Mode**: an event on its flag and level-gated packages (permanent code).
- **Camper**: `self:hp<half` covers the gate and `to: party` the team. But the Health-or-2-Essence question is asked
  *per member*, and `choose` asks once per run, not per recipient. The ↑1 is a scene-window team aura.
- **Zap Apple Jam**: the options depend on cups / pastries left (counters on the item), the scene / one-turn Edge
  windows, and the shelf-life sweep.
- **Circle of Magical Friends**: Circle recipients and copying items (permanent code).
- **Extensive Research**: a world-time (one week) expiry.
- **History Buff (Use half)**: a blind one-die-smaller roll.

### other1 (24)
- **Interspatial Pause**, **Timeslide**: hiding / moving tokens (permanent code).
- **Quantum Trigger**: retrying the last Skill Test with a cumulative ↓n.
- **Time Strike**, **Onslaught**: hit-card rider options from sibling effects.
- **Special Program**: compendium-Perk picks with prerequisite labels.
- **Savant Skill**: a reroll-result Trigger.
- **Good with Both**: an equipped-weapons count.
- **Unlucky (For You)**: the Snag half is dice.mjs's, armed on the target's next Skill Test, with a per-target limit.
- **Altered**, **Additional Alteration**: an Alteration cost waiver.
- **Overload**, **Genetic Support**, **Advanced Alteration Emulator**: a lent Alteration benefit.
- **Thick Hide**: a kept-equipped shield, and an Alterations-count Defense.
- **Standard Deflecting Weapon**, **Limited Deflecting Weapon**: linked-item grants kept with their host.
- **Shield Fighter**: the Element is offered as a rider option *on the attack card* (instead of the normal damage). A
  rules button would be a second damage. The use also comes out of another item's pool (Personal Shield).
- **Disenfranchised**: a `button {runAs: clicker}` with a `choose` and `@var` DIF would nearly do it, but `clicker`
  is the user's character. The old helper was the controlled token first, so a GM couldn't roll for an NPC helper.
- **Armor Matrix (Light / Medium / Heavy)**: a create veto, and a best-of Defense.
- **Eat the Weak**: a "target has an item whose name starts with" tag, a self fallback for the DIF (`difDefense`
  needs a target), and the second (deleted) compendium copy.
- **Multimorph**: an origin-perk picker.

### other3 (23, plus the code half of Solarix Shard)
- **Betrayal**: the assisted roll's result for the assister, and a "split from the party" state.
- **Dabbler**: a Skill-rank (die-ladder) step and a Skill pick filtered by Essence. `updateActor` only does numbers
  and text.
- **Self Improvement**: per-target per-scene stored Essence picks.
- **Follow Me!**: `writeInitiative` exists. But the leader's +1 per follower needs a count of "actors carrying my
  mark", a per-follower d4, and a recipient list of followers.
- **Better Together (+ Hang-Up)**: a world-PC pick, a pair read from either actor (permanent code).
- **Guardian Blast**: a group test with a tally.
- **Mega Defender**: a stored form with DerivedStat `set`, and shared action economy.
- **Metallic Armor Power Up!**: `updateActor` (with `min`) fits the end. But the end is shared with the crit and
  Defeat paths, the Use also switches it on (power-handler), and the minion damage cut needs a `taken` modifier that
  sees the attacker and an "is a minion" tag.
- **Solarix Shard (code half)**: the Power Weapon pick and its hit-card rider option.
- **Void Touched**: a step that writes Essence maxima from picks, with an undo on delete.
- **Holographic Sights**: `@rolled.<path>`.
- **Scramble Field Generator**: marks with a mode read by the marker's side.
- **Again and Again and Again**: a repeat-attack step.
- **Balance and Compensation**: a die-ladder ItemModifier op.
- **Bump & Run**: a "moved N ft since" tag.
- **EM Protective Lining**: a per-attack Defense from another item.
- **Perfect Placement**: placed zones (permanent code).
- **Precise Chronometrics**: `writeInitiative` exists, but it needs a distribute-points step (bonuses to several
  combatants, capped at Smarts).
- **Now You Don't (+5)**: a flat result bonus, and the Hide state as data.
- **Pop Out**, **Telltale Sign**: a roll against several targets' best Defense, and the Hidden state.
- **Same Principle**: `pick {from: ownedItem, filter}` exists, but `ruleWeaponTraits` copies the weapon without its
  `id`, so `item:picked:` can't match it. The old code also adds to `itemAndUpgradeTraits`.
- **Gluten-Tolerant**: a "forbids" rule.
- **Gravity Optional (jump)**: afterRoll still doesn't fire for a roll with nothing to compare against.

## Edits outside my files

**1. `module/rules/reactions.mjs`, `varsFor`: carry the row's damage type.** Projectile Deflector needs it. Its GM
button deals `@var.damage` of type `{var.damageType}`, and button cards already carry string vars. Replace

```js
  return { total: info.total, dif, margin: info.total - dif, damage: Number(first?.damage) || 0 };
```
with
```js
  return { total: info.total, dif, margin: info.total - dif, damage: Number(first?.damage) || 0, damageType: first?.damageType ?? '' };
```
The guide's Reaction line ("Steps see `@var.total`, `@var.dif`, `@var.margin`, `@var.damage`") could add
`{var.damageType}`. `@var.damageType` resolves as 0 in a formula (it's text), and nothing reads it as a number.

**2. `module/rules/steps.mjs`, `stepErrors`: accept `item: "wielded[:<tag>]"`.** `itemsFor` handles it (round 5),
but the validator still rejects it. Desperate Parry needs this. Replace

```js
      && !/^(self|granted|(source|type|choice):.+|name~.+)$/.test(String(step.item))) {
      errors.push(`${where}: item must be self, granted, source:<uuid>, name~<text>, type:<type> or choice:<key>`);
```
with
```js
      && !/^(self|granted|wielded(:.+)?|(source|type|choice):.+|name~.+)$/.test(String(step.item))) {
      errors.push(`${where}: item must be self, granted, wielded[:<tag>], source:<uuid>, name~<text>, type:<type> or choice:<key>`);
```

Both are verified: with them applied in a scratch copy, `conv5-slD5.test.js` passes 25/25 and `engine5.test.js` /
`engine4.test.js` still pass.

## Unused strings

These `lang/en.json` keys (under `E20`) have no code use left:
- react: `ReactContingencySet`, `ReactDesperateParry`, `ReactParried`, `ReactGearBroken`, `ReactDeflected`,
  `ReactDeflectBack`;
- resource: `ResHonestCompassionLine`, `ResStressNone`, `ResInnerConservation`, `ResInnerConservationPrompt`,
  `ResInnerConservationLine`, `ResYes`, `ResNo`, `ResPowerEfficiency`, `ResPowerEfficiencyLine`, `ResDinoCharged`,
  `ResDinoChargedSkip`, `ResDinoChargedPrompt`, `ResDinoChargedLine`, `ResRepairBonusGained`;
- other1: `O1TooFar`, `O1DamageDealt`, `O1DamageOffered`;
- other3: `O3SolarixRefund`.

These are still used:
- `ReactPickSkill`, `ReactApplyDamage` (core's `damageButton`, Cruel Conflagration) and `ReactCounterReady` (Steady
  Footing);
- `ResStressHealth` / `ResStressEssence` / `ResStressPrompt` (Camper);
- `O1NeedTarget` (alterations) and `O1ApplyDamageButton` (r2misc, zord1).

## Files touched

- Packs (rules inserted as text, LF like these files):
  - `packs/qgtgitems/_source/Desperate_Parry_ljlMd2MmeF9LEBbz.json` (3 rules)
  - `packs/dditems/_source/Counterstrike_PdmiiOmBYzNfXTeh.json` (1)
  - `packs/iafav2items/_source/Projectile_Deflector_2eWBm6hbiifmySvX.json` (1)
  - `packs/mlpcrbitems/_source/Honest_Compassion_Dfjo9U9cAgigD9oA.json` (1)
  - `packs/ttsgitems/_source/Inner_Conservation_NkHKAb5TFc7n7C8k.json` (1)
  - `packs/ttsgitems/_source/Power_Efficiency_3fa8lKE6TpQ6lr0P.json` (1)
  - `packs/bthitems/_source/Dino_Charged_n9ME10p6mfOJnUdE.json` (1)
  - `packs/ccfitems/_source/Repair_Progress__Bonus_Energon_Point_rPbEnrg7Qx2Lm9Vd.json` (1)
  - `packs/jttitems/_source/Lance_of_Light_HUdL1MryICmRmWnP.json` (+1)
  - `packs/ttsgitems/_source/Solarix_Shard_jPqr2DuJMSQgiILp.json` (1)
- Slice (all CRLF kept):
  - react: `react/reactions.mjs`, `react/triggers.mjs`, `react/react.test.js`;
  - resource: `resource/mlp.mjs`, `resource/common.mjs`, `resource/power-spend.mjs`, `resource/energon.mjs`,
    `resource/resource.test.js`;
  - other1: `other1/jtt.mjs`, `other1/shared.mjs`;
  - other3: `other3/pr.mjs`.
- New: `module/rules/conv5-slD5.test.js` (25 tests) and this file.

**Rules added: 12** (on 10 items).

## Engine pieces the remaining skips need (most useful first)

1. **Hit-card rider option step** (medium): add an alternate damage button to the attack card's own row (damage
   value / type from the rule, a pick or a var), instead of a separate card. Unblocks Shield Fighter, Solarix
   Shard's Fire half, Time Strike and Onslaught.
2. **Personal Story Point pool resource** (medium). Unblocks Play Favorites, Play Favorites Against Each Other, This
   I Command and Ruthless Efficiency.
3. **Per-recipient `choose`** (small to medium): a `choose` (or a step flag) that asks once for each recipient and
   acts on that one. Unblocks Camper, and gives Zap Apple Jam its per-option gating (which also needs item counters
   and the Edge windows, medium).
4. **Compound narrowing and card facts** (small each):
   - `self:wielding:` / `wielded:` taking a tag list asked of the same attack, plus `item:trait:` reading
     `itemAndUpgradeTraits`: Shoot Out.
   - Reaction context tags for the card's Fumble (`roll:fumble`) and its damage type: Steady Footing.
   - An `all:` group inside `any` in `when` (would have halved Honest Compassion's steps).
5. **GM-relayed conditions that keep their rounds**, and whispered button cards (small). Unblocks Cruel
   Conflagration, and helps Not On My Watch (IA).
6. **A drop-to-0 event from any Health / Power write** (small to medium). Unblocks Not On My Watch (IA), All For One
   (with a two-answer card paid by the presser) and Junker's vehicle half. An "equipment broke" event finishes
   Junker.
7. **`resourceSpent` refinements** (small): skip writes flagged `essence20Loss` / Rest updates, and let a refund
   Trigger lower `@var.spent` for later ones. Removes differences 5a and 5b above, and with a dice count from a var
   (`@var.spent`d4, or a `repeat` step) unblocks Fuel Efficient.
8. **Initiative helpers** (medium): recipients "actors carrying my mark", a count of them, and a distribute-points
   step. Unblocks Follow Me! and Precise Chronometrics.
9. **Small one-offs** (small each):
   - a die-ladder op for `updateActor` / ItemModifier, plus a Skill pick filtered by Essence: Dabbler, Balance and
     Compensation;
   - `ruleWeaponTraits` passing the weapon's `id`: Same Principle;
   - afterRoll on rolls with nothing to compare against: Gravity Optional (jump);
   - `storyPointSpent` with the spend kind: Think Fast!;
   - `until: "worldTime:<seconds>"`: Extensive Research;
   - a "picked uuid = target" tag: Revengeful;
   - a "target has an item named ~" tag and a self fallback for `difDefense`: Eat the Weak;
   - `runAs: clicker` using the controlled token: Disenfranchised.
10. **A retry-the-last-test step with a cumulative ↓** (medium). Unblocks Quantum Trigger, and Savant Skill with a
    reroll-result event.
11. **A lent Alteration benefit** (large design). Unblocks Overload, Genetic Support and Advanced Alteration Emulator.
12. **Effectively permanent code** (bespoke UI or whole subsystems):
    - Motor Pool Connections; Circle of Magical Friends.
    - Interspatial Pause and Timeslide (tokens); Perfect Placement (zones).
    - Beast Mode packages; the Energon strains and Word of Unicron (addiction).
    - Monster Morph; Mega Defender; Guardian Blast.
    - Better Together (world-PC pairing).
    - Armor Matrix (create veto); Gluten-Tolerant (forbids); Special Program / Multimorph pickers.
    - Money Talks / Capable Freelancer (dataset rewrite); Agency (dice.mjs's Fumble grant).
    - Megaform Defender (pilot lookup); Cyborg; Iron Bravado's share; Metallic Armor's on/off shared with
      power-handler.
