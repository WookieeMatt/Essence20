# Batch slD6: re-check of slD5 (`react`, `resource`, `other1`, `other3`) against the round-6 engine pieces

**Scope:** every item `docs/rules-batches/slD5.md` left Still skip (87 items, plus the code halves of Repair Progress
and Solarix Shard), re-checked against "Engine features added 2026-10-06 (round 6, after the local round-5
conversions)" in `docs/RULES_CONVERSION_GUIDE.md` (`target:self`, `status:<id>:timed`, compound `wielding:a&b`,
upgrade-aware `item:trait:`, `item:hasUpgrade:`, `rule:hostEquipped`, `combat:enemyStatus|allyStatus`,
`roll:fumble` and the damage type in Reactions, `@recipient`, `nextTurnOrScene`, `worldTime:N`, `combatAllies`,
`alliesOfTarget|enemiesOfTarget:N`, `mark {exclusive}`, GM-relayed `applyCondition` keeping its rounds, i18n
table rows, the `team` scope, Movement `afterDerived` + `round`, afterRoll `@var.dif`, open rolls reaching
outcome `any` afterRoll Triggers, `notDouble`) and the earlier sections.

| Verdict (re-checked items) | react | resource | other1 | other3 | Total |
|---|---|---|---|---|---|
| Convert (was skip) | 3 | 0 | 0 | 1 | **4** |
| Partial (was skip) | 0 | 0 | 0 | 0 | **0** |
| Still skip | 14 | 23 (+1 code half) | 24 | 22 (+1 code half) | **83** (+2) |
| Re-checked | 17 | 23 (+1) | 24 | 23 (+1) | **87** (+2) |

No conversion needs anything outside my files. Both outside edits slD5 asked for (the Reaction `damageType` var and
the `item: "wielded"` validator) are in, so slD5's difference 3 (Projectile Deflector's GM button falling back to
Blunt) is gone with no rule change.

**6 rules were added to 4 pack items.** With them, `scripts/check-rules.mjs` reports 0 errors and 0 warnings. ESLint
is clean on `react/`, `other3/` and the new test file. Jest: see "Checks" below.

## Converted

All are inserted as text (these four pack files are CRLF). Shoot Out and Cruel Conflagration get new `system.rules`
arrays. Steady Footing and Gravity Optional each get rules appended to their existing array.

- **Shoot Out** (`packs/tfcrbitems/_source/Shoot_Out_GiTU07xFJACmUYt2.json`), 1 Reaction:
  - `who: target`, `attackOnly`, `limit` once per `turn` (the old `hasUsedThisTurn` / `markUsedThisTurn`, marked
    only after a roll that wasn't cancelled).
  - `when`: `attack:ranged`, `target:data:id` (there is an attacker), and
    `self:wielding:item:trait:ballistic&item:data:system.classification.style!=melee`. That is the old
    `ballisticEffect`: an equipped weapon's attack that isn't melee, on a weapon whose traits (or the traits its
    upgrades add) include Ballistic. `attack:melee` can't be used inside the `wielding:` narrowing, because it reads
    the card's attack, not the wielded one, so the style is read as data.
  - Steps: `roll` with skill `wielded:<the same tags>` (the first such attack's own Skill, as before) against
    `@var.total + 1` (a tie goes to the attacker).
    - `onSuccess`: `negateHit` (it only acts on a row that hit) and a line, gated on `var:margin>=0`.
    - `onFail`: `convertRows` (it only acts on a row that missed) and a line, gated on `var:margin<0`.
- **Steady Footing** (`packs/iafav2items/_source/Steady_Footing_U4bVJU5BpT3BTfSx.json`), 1 Reaction added beside its
  incoming RollModifier (the ↓1 half, converted earlier):
  - `who: target`, `attackOnly`. `when`: `roll:fumble`, `item:damageType:maneuver` or `item:damageType:grapple`
    (the card's attack; on a Fumbled row with no damage button that is the attack's own damage type, the old
    `riderContext.damageType`), and `target:data:id`.
  - Steps, built like Counterstrike's: `mark steadyFooting` on the attacker; `bank {replace: true, upshift: 1,
    appliesWhen: [attack, markedByMe:steadyFooting, item:damageType:maneuver]}` (the old `reactCounter` flag with
    `maneuver: true`, one slot); `setTargets` the attacker (the old `targetActor`); `bonusAttack {cost: free,
    optional: true}` (the old `grantBonusAttack` when there is a combat); a line.
- **Cruel Conflagration** (`packs/fmmcitems/_source/Cruel_Conflagration_c22iQeKZY1TmPzFe.json`), 2 watch Triggers
  (`event: afterRoll`, `watch: any`, `within: 15`), replacing the `createChatMessage` card reader:
  - `outcome: plainFailure` (all results failed, not a Fumble - the old `rollFailed && !isFumble`): a `button`
    "Impaired (1 Personal Power)" for the holder's owners. Pressed: `spend` 1 Personal Power, then
    `applyCondition impaired, rounds: 1` on the roller (the button carries the roller as its target). A player
    pressing it on an enemy goes through the GM with the round kept, exactly the old `gmDo({kind: 'status',
    rounds: 1})`.
  - `outcome: [fumbled, allFailed]` (the old `rollFailed && isFumble`): a `button` whose steps are a `choose` between
    "2 Psychic damage (1 Personal Power)" and "2 Psychic damage and Impaired (2 Personal Power)". Each spends the
    Power, the second also applies Impaired for 1 round, and both post a `button {who: gm}` dealing 2 Psychic damage
    to the roller (the old GM-only `damageButton`).
- **Gravity Optional (jump)** (`packs/wtnvcgitems/_source/Gravity_Optional_F5mrzupd6TG2kj3x.json`), 2 rules added
  beside its Movement rule (the float half):
  - a **DialogSwitch** "Jump (triple the result)" on `skill:athletics`, `forget: true` (the old checkbox always
    started unticked). Ticked, its steps `setToggle jump` on (`until: turnOrScene`, so a roll that never happens
    can't leave it on for long). This replaces the old `pendingJump`.
  - an **afterRoll Trigger** with `outcome: any` (so a roll with nothing to compare against reaches it, as the old
    chat-card reader did) and `when: [skill:athletics, self:toggle:jump]`. It switches the toggle off and posts
    "{name}'s jump result {var.total} is tripled to {@var.total * 3}." (the old `jumpLine`).

Removed with these:
- **`react/reactions.mjs`:** `REACT.steadyFooting` and `REACT.shootOut`; the Steady Footing and Shoot Out
  `registerReaction`s; `bankCounter`, its `registerRollSources` (`reactCounter`) and `registerConsumer`;
  `ballisticEffect`, `wieldedEffect`, `parentOf`, `weaponEffects`, `selfHolder` and `nameOf`; the imports
  `registerConsumer`, `registerRollSources`, `hasUsedThisTurn`, `markUsedThisTurn`, `esc`, `holds`, `convertRows`,
  `rollVs`, `SCOPE` and `targetActor`. `_test` no longer carries `bankCounter`. Megaform Defender and the dataset
  Snag stay.
- **`react/triggers.mjs`:** `TRIG.cruelConflagration`; the `createChatMessage` hook and `onCheckCard` (Cruel
  Conflagration was the only thing left in it); the `reactCruelConf` chat button; the imports `damageButton` and
  `distanceBetween`.
- **`react/core.mjs`:** unchanged; every export stays (`damageButton`, `rollVs`, `convertRows`, `targetActor`... still
  have other callers or stay exported for other slices).
- **`react/react.test.js`:** the Shoot Out offer test (replaced by a Megaform Defender offer test, so `reactionsFor`
  stays covered), the banked counter-attack test and the Cruel Conflagration test; `onCheckCard` from the import.
- **`other3/wtnv.mjs`:** the Gravity Optional block (`pendingJump`, its `registerDialogToggles` /
  `registerApplyDialog`, `jumpLine`, the `createChatMessage` hook) and the imports `registerApplyDialog`,
  `registerDialogToggles` and `say`. Gluten-Tolerant's Weird block stays.
- **`other3/shared.mjs`:** `O3.gravityOptional`.

New tests (`module/rules/conv6-slD6.test.js`, 16) assert what the old ones did, and more:
- every rule on the four items validates;
- Shoot Out: the offer gates (ranged, on the holder, a wielded Ballistic non-melee attack, equipped), an upgrade's
  Ballistic trait counting, the Skill of the ranged attack (not a Ballistic melee one) against total + 1, winning a
  hit negates it, losing a miss shows the hit, the other two cases do nothing, a cancelled roll uses nothing, once
  per turn;
- Steady Footing: the Fumble and Maneuver / Grapple gates, the mark, the ↑1 bank applying only to Maneuver attacks on
  that attacker, one slot;
- Cruel Conflagration: the failure / Fumble buttons, the 15 ft range, no button on a success or on a Fumble that
  still succeeded, the Impaired press (1 Power, 1 round), a player's press relayed through the GM with
  `rounds: 1`, the Fumble choice (1 or 2 Power, the GM damage button), not enough Power;
- Gravity Optional: the switch on Athletics only, starting unticked; the tripled total on a roll with nothing to
  compare against and on one against a DIF; once per tick; nothing when unticked.

## Behaviour differences worth a decision

Same-line unless marked.

1. **Shoot Out**
   - The chat lines are rules cards ("wins / loses the shoot-out"); losing a missed shot also shows the engine's
     "now succeeds" line.
   - The turn limit only counts in a started combat (the old turn stamp also counted in a set-up one), as for every
     other converted per-turn Reaction.
   - The Ballistic test also reads the attack's own traits (and the weapon's), not only the weapon's. An attack
     carrying Ballistic itself on a non-Ballistic weapon now qualifies; I found none in the packs.
2. **Steady Footing**
   - The counter-maneuver bank is its own (`replace`, one per item). The old code shared one `reactCounter` slot with
     Counterstrike; since slD5 they were already separate.
   - As with Counterstrike, marks from earlier Fumbles stay on those attackers, so the one banked ↑1 can be spent on
     a Maneuver attack at an *older* Steady Footing target if the holder attacks them first.
   - Old `reactCounter` flags already on actors are no longer read (a counter banked just before the update is
     lost once).
3. **Cruel Conflagration**
   - The offer cards are ordinary chat cards that everyone sees (only the holder's owners and the GM can press). The
     old cards were whispered to the holder's owners. The engine's `button` step has no whisper option.
   - A rules button is marked used as it's pressed. Pressing it without enough Personal Power, or backing out of the
     Fumble card's question, uses the card up. Before, the button stayed live until a payment went through.
   - The Fumble case is one button with a question, not two buttons on one card.
   - The cards are posted by the roller's client (watch Triggers run where the roll is made); before, the holder's
     own client posted them. Holders must have a token on the canvas (they did, for the 15 ft range).
   - A roll that is a natural crit and still fails every row no longer offers Impaired (`plainFailure` excludes
     crits). Before, any all-failed non-Fumble did.
   - The Perk's `system.automation.notes` still says "a private button" - worth updating through apply.cjs.
4. **Gravity Optional**
   - The jump is remembered on the item until the next Athletics roll (or the end of the turn / scene), not for 30
     seconds. A roll that never reaches the dice keeps it a little longer.
   - The tripled line is a rules card headed "Gravity Optional: jump".

## Still skipped (83), and what each still needs

### react (14)
- **Defender (Megaform Trait)**: Reaction `who` for the pilots of a Megaform's members (permanent code: pilot lookup).
- **Junker**: an "equipment broke" event, and a drop-to-0 event for vehicles.
- **Not On My Watch (IA)**: `defeated` watch Triggers only fire inside `applyDamage`; the old code reads any drop to 0
  Health. Also whispered cards.
- **All For One**: a drop-to-0 Health / Power event, and a card with two answers paid by the presser
  (`runAs: clicker` exists, but the 1d2 / 1 Health gift is restored on the caller through the GM).
- **Agency**: a rule read by dice.mjs's Fumble Story Point grant (permanent code until dice.mjs reads a rule).
- **Revengeful**: a tag comparing the stored `pendingRevengeful` attacker (set by dice.mjs) with the Defeated
  target. `mark {exclusive}` would fit if dice.mjs's ↑1 half also became a rule.
- **Inspirational Leader (combat half)**: an aura keyed on the leader's last successful Skill until the end of the
  round (a stored-Skill var on a bank / aura).
- **Monster Morph**: a roll against every creature within 10 ft at once, and a per-Path rule home.
- **Iron Bravado (share half)**: copying Condition immunities to picked allies for a while.
- **Cyborg**: an Essence damage redirect and a heal lock.
- **Mind Beam**: a rule reading the spell's pre-roll effect choice.
- **Energized**, **Spiked**, **Energy Field**: an incoming DialogSwitch and a "plain Reach" attack tag.

### resource (23, plus the code half of Repair Progress)
- **Play Favorites**, **Play Favorites Against Each Other**, **This, I Command**, **Ruthless Efficiency**: a personal
  Story Point pool resource.
- **Money Talks**, **Capable Freelancer**: a confirmable pre-roll Skill swap that rewrites the dataset.
- **Motor Pool Connections**: a vehicle picker, per-vehicle budgets, a grant onto another actor (permanent code).
- **Fuel Efficient**: a dice count from a var (`@var.spent`d4 - dice counts are literal), and `resourceSpent`
  skipping the Rest update.
- **Repair Progress (code half)**: the Rest carry-over and the "spent" mark (an Energon cap rule).
- **Body of Energy (damage / unmorph halves)**: a pooled-resource damage modifier, and an unmorph Trigger with the
  pre-update values.
- **Dark Energon**, **Primal Energon**, **Red Energon**, **Synth-En**, **Word of Unicron**: the addiction subsystem
  (permanent code).
- **Together We Stand**: a "two or more team members" combat-start gate and ledger-recorded temporary Health taken
  back at scene end.
- **Think Fast!**: `storyPointSpent` with the spend kind.
- **We Improvise**: a per-combat ledger.
- **Beast Mode**: an event on its flag and level-gated packages (permanent code).
- **Camper**: a per-recipient `choose` (Health or 2 Essence asked per member).
- **Zap Apple Jam**: options gated on counters on the item, the scene / one-turn Edge windows, the shelf-life sweep.
- **Circle of Magical Friends**: Circle recipients and copying items (permanent code).
- **Extensive Research**: `worldTime:604800` exists, but (a) timed items are only swept at turn start and scene
  change, not on `updateWorldTime`, so the spell outlives its week until then; (b) `pickGrant` can't filter by
  `system.tier` (the compendium index it searches doesn't load that field); (c) "one at a time" needs the old copy
  removed only once a new pick is made (a `pickGrant {replace: true}`), since a `deleteItem` before the pick loses
  the old spell on a cancel and one after it removes the new one too.
- **History Buff (Use half)**: a blind one-die-smaller roll.

### other1 (24)
- **Interspatial Pause**, **Timeslide**: hiding / moving tokens (permanent code).
- **Quantum Trigger**: retrying the last Skill Test with a cumulative ↓n.
- **Time Strike**, **Onslaught**: hit-card rider options from sibling effects.
- **Special Program**: compendium-Perk picks with prerequisite labels.
- **Savant Skill**: a reroll-result Trigger.
- **Good with Both**: an "equipped weapons >= 2" tag (`self:count:weapon` counts unequipped ones too).
- **Unlucky (For You)**: the Snag half is dice.mjs's, armed on the target's next Skill Test, with a per-target limit.
- **Altered**, **Additional Alteration**: an Alteration cost waiver.
- **Overload**, **Genetic Support**, **Advanced Alteration Emulator**: a lent Alteration benefit.
- **Thick Hide**: a kept-equipped shield, and an Alterations-count Defense.
- **Standard Deflecting Weapon**, **Limited Deflecting Weapon**: a linked shield granted per upgrade, equipped with its
  host weapon, and an attack refusal while raised (`rule:hostEquipped` reads the state, but nothing keeps a granted
  item's `equipped` in step with the host).
- **Shield Fighter**: an Element offered as a rider option on the attack card, paid from Personal Shield's pool.
- **Disenfranchised**: `runAs: clicker` resolving the controlled token (a GM rolling for an NPC helper).
- **Armor Matrix (Light / Medium / Heavy)**: a create veto, and a best-of Defense.
- **Eat the Weak**: a "target has an item whose name starts with" tag, a self fallback for `difDefense`, and the
  second compendium copy.
- **Multimorph**: an origin-perk picker.

### other3 (22, plus the code half of Solarix Shard)
- **Betrayal**: the assisted roll's result for the assister, and a "split from the party" state.
- **Dabbler**: a die-ladder step for `updateActor` and a Skill pick filtered by Essence.
- **Self Improvement**: per-target per-scene stored Essence picks.
- **Follow Me!**: a count of "actors carrying my mark", a per-follower d4, and those followers as recipients.
- **Better Together (+ Hang-Up)**: a world-PC pick, a pair read from either actor (permanent code).
- **Guardian Blast**: a group test with a tally (permanent code).
- **Mega Defender**: a stored form with DerivedStat `set`, and shared action economy (permanent code).
- **Metallic Armor Power Up!**: the end is shared with the crit / Defeat paths and power-handler's switch-on, and the
  minion damage cut needs a `taken` modifier that sees the attacker and an "is a minion" tag.
- **Solarix Shard (code half)**: the Power Weapon pick and its hit-card rider option.
- **Void Touched**: a step that writes Essence maxima from picks, with an undo on delete.
- **Holographic Sights**: `@rolled.<path>`.
- **Scramble Field Generator**: marks with a mode read by the marker's side.
- **Again and Again and Again**: a repeat-attack step.
- **Balance and Compensation**: a die-ladder ItemModifier op.
- **Bump & Run**: a "moved N ft since" tag.
- **EM Protective Lining**: a per-attack Defense / shift from an upgrade on the defender's equipped host, against an
  Electromagnetic attack on a computerized target (`item:hasUpgrade` is the attacker's item, not the defender's).
- **Perfect Placement**: placed zones (permanent code).
- **Precise Chronometrics**: a distribute-points step (Initiative bonuses to several combatants, capped at Smarts).
- **Now You Don't (+5)**: a flat result bonus, and the Hide state as data.
- **Pop Out**, **Telltale Sign**: a roll against several targets' best Defense, and the Hidden state.
- **Same Principle**: `ruleWeaponTraits` copies the weapon without its `id`, so `item:picked:` can't match it; the old
  code also adds to `itemAndUpgradeTraits`.
- **Gluten-Tolerant**: a "forbids" rule (create veto).

## Edits outside my files

None.

## Unused strings

These `lang/en.json` keys (under `E20`) have no code use left:
- react: `ReactCounterReady`, `ReactShotDeflected`, `ReactShootOutLost`, `ReactCruelPrompt`, `ReactCruelImpaired`,
  `ReactCruelDamage`, `ReactCruelBoth`, `ReactCruelImpairedDone`, `ReactCruelDamageDone`;
- other3: `O3GravityJumpLine`, `O3GravityJumpToggle`.

Still used: `ReactApplyDamage` (core's `damageButton`, called by auras, forms, convertRows and pr3), `ReactPickSkill`
(auras, forms), `ReactLoweredMiss` / `ReactLoweredHit` / `ReactMegaformDefender` (Megaform Defender).

## Files touched

- Packs (rules inserted as text, CRLF like these files):
  - `packs/tfcrbitems/_source/Shoot_Out_GiTU07xFJACmUYt2.json` (1 rule)
  - `packs/iafav2items/_source/Steady_Footing_U4bVJU5BpT3BTfSx.json` (+1)
  - `packs/fmmcitems/_source/Cruel_Conflagration_c22iQeKZY1TmPzFe.json` (2)
  - `packs/wtnvcgitems/_source/Gravity_Optional_F5mrzupd6TG2kj3x.json` (+2)
- Slice (CRLF kept): `react/reactions.mjs`, `react/triggers.mjs`, `react/react.test.js`, `other3/wtnv.mjs`,
  `other3/shared.mjs`.
- New: `module/rules/conv6-slD6.test.js` (16 tests) and this file.

**Rules added: 6** (on 4 items).

## Checks

- ESLint (`--ext .js,.mjs`, linebreak-style off) on `react/`, `other3/` and `conv6-slD6.test.js`: clean.
- `node scripts/check-rules.mjs`: 1840 rules on 1154 items, 0 errors, 0 warnings (the totals include other agents' work).
- Jest: the four slice folders, `conv6-slD6.test.js`, `conv5-slD5.test.js` and `engine6.test.js` - 7 suites, 140 tests, all pass.

## Engine pieces the remaining skips need (most useful first)

1. **A drop-to-0 event from any Health / Power write, and an "equipment broke" event** (small to medium). Unblocks
   Not On My Watch (IA), Junker (both halves) and, with a two-answer card whose payment is the presser's, All For
   One.
2. **Hit-card rider option step** (medium): an alternate damage button on the attack card's own row. Unblocks Shield
   Fighter, Solarix Shard's Fire half, Time Strike and Onslaught.
3. **Personal Story Point pool resource** (medium). Unblocks Play Favorites, Play Favorites Against Each Other, This
   I Command and Ruthless Efficiency.
4. **Button / card refinements** (small each): a `whisper: owners` option on `button` (removes Cruel Conflagration's
   difference 3a, and helps Not On My Watch), and a button that is marked used only when its steps finish (3b).
5. **Per-recipient `choose`** (small to medium). Unblocks Camper; with item counters and the Edge windows (medium),
   Zap Apple Jam.
6. **Extensive Research trio** (small each): sweep timed items on `updateWorldTime`; `pickGrant` `from.fields` (or
   `system.tier` in the default index fields); `pickGrant {replace: true}` (drop this rule's earlier grant only once a
   new pick is made).
7. **`resourceSpent` refinements** (small): skip writes flagged `essence20Loss` and Rest updates, let a refund
   Trigger lower `@var.spent` for later ones, and allow a dice count from a var. Removes slD5's differences 5a / 5b
   and unblocks Fuel Efficient.
8. **Initiative helpers** (medium): recipients "actors carrying my mark", a count of them, and a distribute-points
   step. Unblocks Follow Me! and Precise Chronometrics.
9. **Small one-offs** (small each):
   - an equipped-items count tag (`self:count:weapon:equipped>=2`): Good with Both;
   - a die-ladder op for `updateActor` / ItemModifier, plus a Skill pick filtered by Essence: Dabbler, Balance and
     Compensation;
   - `ruleWeaponTraits` passing the weapon's `id`: Same Principle;
   - `storyPointSpent` with the spend kind: Think Fast!;
   - a "picked / stored uuid = target" tag: Revengeful;
   - a "target has an item named ~" tag and a self fallback for `difDefense`: Eat the Weak;
   - `runAs: clicker` using the controlled token: Disenfranchised;
   - a stored-Skill aura until end of round: Inspirational Leader.
10. **A retry-the-last-test step with a cumulative ↓** (medium). Unblocks Quantum Trigger, and Savant Skill with a
    reroll-result event.
11. **A lent Alteration benefit** (large design). Unblocks Overload, Genetic Support and Advanced Alteration Emulator.
12. **Effectively permanent code** (bespoke UI or whole subsystems):
    - Motor Pool Connections; Circle of Magical Friends.
    - Interspatial Pause and Timeslide (tokens); Perfect Placement (zones).
    - Beast Mode packages; the Energon strains and Word of Unicron (addiction).
    - Monster Morph; Mega Defender; Guardian Blast.
    - Better Together (world-PC pairing).
    - Armor Matrix and Gluten-Tolerant (create vetoes); Special Program / Multimorph pickers.
    - Money Talks / Capable Freelancer (dataset rewrite); Agency (dice.mjs's Fumble grant).
    - Megaform Defender (pilot lookup); Cyborg; Iron Bravado's share; Metallic Armor's on/off shared with
      power-handler; the Deflecting Weapons' linked shield.
