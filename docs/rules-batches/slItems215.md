# slItems215 - round 15, part items2

Scope: the 63 "piece" items of the items2 survey (`survey/result-items2.json`), plus the four items that had to move
together with Environmental Expertise (Environmental Expertise itself, Read the Land, In Their Element, Guidance).

- 60 of the 63 are converted. Additional Marks needed nothing of its own, and The Beat Goes On is read by Reckless
  Abandon's rules. 3 stay code, with reasons.
- 151 rules were added on 62 pack items.
- Tests: `module/rules/conv15-items2.test.js` (109 tests, the converted items) and `module/rules/engine15-items2.test.js`
  (30 tests, the engine pieces).

## Engine features added 2026-10-07 (round 15, items2)

Each entry below says what it does, where it lives and the item that needed it. The new plug-in files are imported at
the end of `rules/plugins/index.mjs`, inside the "Round 15 (items2)" block.

### Events

- **`storyPointsPaid`** (`plugins/resources/story-points-paid-event.mjs`). Fired on the spending actor once the shared
  pool has really gone down (story-points.mjs `spend()`). It sets `@var.amount` and `@var.pool`. Used by Battle Hardened.
- **`rolePointsActivated` / `rolePointsDeactivated`** (`plugins/resources/role-points-events.mjs`). Fired when a Role
  Points item's `system.isActive` turns on or off. The same file adds the tag `self:enemiesStanding` and a
  `wouldBeDefeated` stage `aegis` (before `last`). Used by Reckless Abandon and Aegis.
- **`skillTestPosted`** (`plugins/rolls/recent-rolls.mjs`). Fired on the active GM for every posted Skill Test card.
  The card joins the recent-roll memory after its Triggers have run. Used by Competitive.
- **`converted`** (`plugins/zords/converted-event-and-seen.mjs`). The actor now stands in an Alt Mode: it Converted, or
  it changed Alt Mode while converted. It sets `@var.altMode`. Used by Unexpected Alternative.
- **`hit`, `afterRoll` and `targeted` Triggers now see `roll:edge`**: whether the roll had Edge (dice.mjs
  `checkContext.wasEdge`). Used by Terror.

### Durations

- **`registerUntil(name, {stamp, expired})`** (`expiry.mjs`). Plug-in durations for marks, banks and grants. Its first
  use is `until: "calendarDay"` (`plugins/effects/calendar-day-duration.mjs`), which ends when the real-world date
  changes. Used by Preventative Measures.
- **`until: "endOfNextRoundOrScene"`** (`plugins/picks/cross-item-picks.mjs`). Used by Leave It To Me.
- **Mark / bank `untilOf: "target"`**. The duration counts the target's turns, not the holder's.

### Rule types

- **NaturalTwenty** (`plugins/rolls/natural-twenty.mjs`). A kept natural 20 succeeds, and a success becomes a
  Critical Success. dice.mjs reads it. Used by Better than the Best.
- **NoFumbleStoryPoint** (`plugins/rolls/no-fumble-story-point.mjs`). A Fumble in that Skill gives no Story Point.
  Used by Agency's Hang-Up.
- **EnvironmentalExpertise {shareEnvironments?, scope: self | companion | driven}**
  (`plugins/effects/environmental-expertise-rule.mjs`). "Has Environmental Expertise" is now this rule. dice.mjs,
  environmental-expertise.mjs, rerolls and environment-gated effects all read it. The same file adds the tags
  `self:inExpertiseTerrain` and `self:onHolderExpertiseTerrain`.
- **DriverlessEssence {essence}** (`plugins/zords/driverless-essence.mjs`). A Zord or vehicle with no driver counts this
  Essence for its driver-borrowed Defenses (combat.mjs `getDefenseValue`). Used by Relic Key.
- **EvasiveManeuvers {}**, scope `vehicle` (`plugins/combat/evasive-maneuvers-rule.mjs`). An Aerial vehicle halves its
  Aerial speed, and Toughness attacks against it target Evasion. documents/actor.mjs and dice.mjs read it. The vehicle's
  old `evasiveManeuversActive` flag (Evasive Handling) still counts. The same file adds the tag `self:crewsAerial`.
  Used by Fly In The Future.
- **MovementAction `countSinceTypeChange: true`** (`plugins/combat/since-type-change.mjs`). Only the distance moved since
  the last change of movement type counts against the speed. It listens on `essence20.movementUsed`. Used by Third
  Dimension.
- **CardOffer** (`plugins/cards/card-offer.mjs`):
  - `when` sees the card's Skill (`skill:`), and its steps get `@var.skill` / `{var.skill}`.
  - `addDie {skillDie: true}` rolls the holder's own Skill Die for the card's Skill. It is offered only when the holder
    has one.
  - `once: true` lets each holder answer a card once.
  - Used by One-Upping, Not Like That Like This! and Secret Helper.
- **Assist `effect: pay`** (`plugins/picks/cross-item-picks.mjs`). Used by BFF.
  - It has `cost`, `prompt` and `message`, and `payForAssist` spends the cost (Story Points quietly).
  - A refusing Assist rule's `message` reaches `ruleAssist` (adapter.mjs), and Lend Assistance leaves that ally out of
    its list. Used by Fun Exhaustion.
- **Veto `on: "kitUse"`** (`plugins/effects/veto.mjs`, kits.mjs `kitUseVetoed`). Used by Reckless Abandon.

### Steps

- **`listNames {to, filter, var, none}`** and **`whisper {text, to: user | owners}`**
  (`plugins/cards/names-and-whisper.mjs`). Also in that file:
  - the ref `@versus.<level|toughness|evasion|willpower|cleverness>`;
  - the text refs `{markSkill.<key>}` and `{actor.<path>}`.
- **`damageShield {amount, damageTypes, to, until}`** (`plugins/combat/damage-shield.mjs`). combat.mjs uses it up on
  the next matching damage. Used by Elemental Shield.
- **`spendPooled {to, path, amount, message}`** (`plugins/resources/spend-pooled.mjs`). One cost drawn from several
  creatures in turn. It sets `@var.contributors`. Used by Zord Mega-Weapon System.
- **`refundUse {to, prompt, message}`** (`plugins/resources/refund-use.mjs`). Gives back one of the recipient's spent
  uses. That can be a Scene Clock count, a turn stamp or a rule limit. Used by Delegate.
- **`recordSeen {flag, entry}`** (`plugins/zords/converted-event-and-seen.mjs`). A per-creature memory with
  `@var.seenCount`, `seenNew` and `seenSwitched`.
- **`undoEffect {flag, to, linkedItem, prompt}`** (`plugins/effects/flagged-effects.mjs`). Removes one flagged Active
  Effect and its linked item. The same file adds the tags `self:hasEffectFlag:<flag>` and `target:hasEffectFlag:<flag>`.
  Used by They Called It A Glitch!.
- **`pickChassis {mode: origin | mimicry, flag}`** (`plugins/picks/chassis-picks.mjs`). Picks a Transformers chassis
  by its Origin. The same file adds the text ref `{ruleItem.<path>}`. Used by Alt Mode Mimicry and Drone.
- **`bestItem {type, where, by, keep, message}`** (`plugins/picks/best-item.mjs`). Copies values from the actor's
  strongest matching item. The same file adds the tag `roll:crit`. Used by Elemental Fury.
- **`groupTest {skill, dif, cost}`** and **`groupTally`** (`plugins/rolls/group-test-steps.mjs`). Group-tests.mjs uses a
  test's `cost` for each participant other than the leader. The same file adds the recipient `varActor:<var>`. Used by
  Guardian Blast.
- **`windowCount {flag, window, var}`** (`plugins/resources/vehicle-budget-pieces.mjs`). The same file adds:
  - the pick source `ownedVehicles`;
  - the tag `item:upgradeCostAtMost:<formula>`.
  Used by Motor Pool Connections.

### Recipients, pick sources and tags

- **Recipients**:
  - `aroundSelf:<formula>` (`plugins/picks/around-self-recipient.mjs`);
  - `crew` (`plugins/zords/crew-recipient.mjs`);
  - `varActor:<var>` (in group-test-steps.mjs).
- **Pick source `recipients {of}`** (`plugins/picks/recipient-pick-source.mjs`). Used by Queen's Gambit.
- **Tags**:
  - Turn order: `combat:lowestInitiative`, `combat:currentRolled`.
  - Cross-item picks: `picked:<id>:<key>`, `target:pickedBy:<id>:<key>`, `target:skillDieAtLeast:<die>`,
    `self:costRuleUsed:<id>`.
  - Recent rolls: `recent:sideHigher:<min>`, `recent:selfLower:<min>`, `recent:hostile:<skill>`, and the ref
    `@recent.lowestHostile.<skill>`.
  - Terrain and choices: `terrain:picked:<key>`, `holder:choiceOf:<uuid>`.
  - Sides: `self:sameSideAsHolder`, `target:sameSideAsHolder`.
  - Position: `self:pointWithin:<ft>`, `zone:self:<key>`, `zone:target:<key>` (zones are a roll-time family, so a
    Defense rule reading them is worked out per attack).
  - Other parties: `target:keyedOnMe:<path><op><n>`, `target:immune:<condition>`, `self:immune:<condition>`,
    `self:ownerSpectrum:<colour | none>`.
- **Ref `@initiative.afterCurrent`** (rolls/initiative.mjs).

### New options on existing steps

- **`roll`**: `@var.multiplier`, and `sheetShifts: true`.
- **`rollSeen`**: `@var.skill`.
- **`markText`**: `$skill`.
- **`moveTo`**: `snap: true`.
- **`askNumber`**: `value`, a formula for the starting number.
- **`grant`**:
  - `flags` text is filled;
  - it sets `@var.grantedId`.
- **`addEffect`**: `flags` text is filled.
- **`damage`**:
  - `asCastHit: true` (through `cast-hit-damage.mjs`);
  - it sets `@var.damage`.
- **`damageCard`**: `to`, for one card with a button per recipient.
- **`blast`**:
  - `packets` and `missPackets`;
  - `at: targets`;
  - `excludeTargets`.
- **`scheduleCard`**: `turnStarts`.
- **`placeZone`**:
  - `halfFeet`;
  - `replace`;
  - a zone with no modifier no longer adds an empty roll source.
- **`markWindow`**:
  - `count`;
  - a filled flag (`windowFlag`).
- **`setEffects`**: `items: <selector>`.
- **`recordScene`**: `quiet`.
- **`lendAssistance`**: `skillOnly` and `radius`.
- **`spendAction`**: now allows `fullAction`.

## Verdict table

| Item | Verdict | How |
|---|---|---|
| Preventative Measures | converted | Use: choose Skill, mark per target until calendarDay |
| Stand Together | converted | Use: Persuasion DIF 15, allies heal per degree |
| Tough It Out | converted | Use: askNumber, Brawn roll, heal (per encounter) |
| Friendship Is Mystical | converted | Use (Fit In / Fortify / Heal) + marked RollModifier |
| Help Yourself | converted | afterRoll Trigger (recordScene) + Use (lendAssistance skillOnly 15 ft, per round) |
| Temper Tempest | converted | afterRoll + 2 turnStart Triggers, 3 CardButtons |
| Timeslide | converted | Use: pickPoint, self:pointWithin:200, moveTo snap |
| Touch Move | converted | Trigger: listNames of the combat allies |
| Battle Hardened (GI JOE) | converted | storyPointsPaid Trigger |
| Battle-Hardened (D&D crossover) | converted | storyPointsPaid Trigger |
| The Beat Goes On | converted | no rule of its own - Reckless Abandon's rules read it |
| Apex Dark Ranger | converted | no rule of its own - Terror's hit Trigger reads it |
| Better than the Best | converted | NaturalTwenty |
| Additional Marks | nothing to do | Mark Target's Use (banked part) keeps `1 + 4 x` marks |
| One-Upping | converted | CardOffer once, bank ↑1 |
| Power Infusion | **code** | see "Left as code" |
| Reckless Abandon | converted | rolePoints Triggers, kitUse Veto, end Triggers |
| Aegis | converted | wouldBeDefeated stage aegis + rolePointsDeactivated Trigger |
| Time To Think | converted | rule on its item |
| Anonymous | converted | 2 incoming RollModifiers (Snag) |
| Alt Mode Mimicry | converted | Use: pickChassis mimicry + grant |
| Drone | converted | Use: pickChassis origin + grant + Movements / size |
| Solid-State Energon | converted | Use: choose damaged / refine, damageCard aroundSelf |
| They Called It A Glitch! | converted | Use: operate (pickEntry, roll, grant, addEffect) / reverse (undoEffect) |
| Artillery Support | converted | Use: choose strike, scheduleCard turnStarts, blast packets |
| Martial Artist | converted | Use: @versus refs + whisper |
| Queen's Gambit | converted | takesDamage Triggers -> button -> writeInitiative afterCurrent |
| Self Improvement | converted | Use: marks per Essence; DerivedStat / Defense / RollModifier carried by the mark |
| Better Together (Influence) | converted | Use pick + Triggers + RollModifiers |
| Guardian Blast | converted | Use: groupTest + Resolve button (groupTally, damage) |
| Scramble Field Generator | converted | Use + marks + 3 RollModifiers |
| Perfect Placement | converted | Use: placeZone; Defense / RollModifiers on zone tags |
| Elemental Fury | converted | Use: bestItem + createItem; crit Triggers + HitRider |
| Be An Example | converted | Use: bank ↑1 on an Origin Skill |
| Motor Pool Connections | converted | Use: windowCount budget, pickEntry, roll, giveCopy |
| Competitive | converted | skillTestPosted Triggers + RollModifier |
| Misplaced Confidence | converted | roundStart Trigger |
| Take in a Scene | converted | initiativeRolling Trigger |
| Adapted Vehicle (Environmental) | converted | EnvironmentalExpertise scope driven |
| Environmental Enforcer | converted | Use pickMany + RollModifier + DialogSwitch |
| Third Dimension | converted | MovementAction countSinceTypeChange |
| Unexpected Alternative | converted | converted Trigger (recordSeen, mark) + RollModifier |
| Not Like That, Like This! | converted | CardOffer + mark + Triggers |
| Agency | converted | NoFumbleStoryPoint |
| BFF | converted | Use pickMany + ActionCost + Assist pay |
| About Twenty-Percent Cooler | converted | DialogSwitch, 3 per rest |
| Leave It To Me | converted | rollSeen Trigger -> bank Edge |
| That's What Best Friends Are For | converted | lendAssistance Trigger |
| Better Together (Hang-Up) | converted | RollModifier |
| Think Tank | **code** | see "Left as code" |
| Delegate | converted | Use: refundUse + Moxie |
| Fun Exhaustion | converted | 2 Assist refuse rules |
| Influential | converted | aura RollModifier (holder:choiceOf) |
| Secret Helper | converted | CardOffer addDie skillDie + grantNextTurn |
| Elemental Shield | converted | Use: damageShield |
| Fly In The Future | converted | Toggle + Use + EvasiveManeuvers |
| Danger Close | **code** | see "Left as code" |
| Zord Feature | converted | 2 added Triggers: pickGrant onto the Zord or self |
| Zord Ultra Mode | converted | Use convert + Use add + 4 sync Triggers (setEffects items) |
| Versatile Combiner | converted | added Trigger: grant by self:ownerSpectrum, else choose |
| Rapid Rescue Response | converted | roundStart Trigger: forEach crew, 1d2, heal |
| Relic Key | converted | Use (bank Edge, per encounter) + DriverlessEssence |
| Zord Mega-Weapon System | converted | Use (spendPooled) + afterRoll counter Trigger |
| Environmental Expertise (extra) | converted | EnvironmentalExpertise + 2 Use switches |
| Read the Land (extra) | converted | EnvironmentalExpertise rule appended |
| In Their Element (extra) | converted | EnvironmentalExpertise scope companion, shareEnvironments |
| Guidance (extra) | converted | Use + 2 marked RollModifiers |

### Left as code

- **Power Infusion.**
  - Its charge ("reroll these faces on the next successful attack") is read and cleared in dice.mjs
    (`flags.essence20.bankedReroll`). A `bank` step has no kind like that yet.
  - Its once-per-scene count is shared with the item's reactive reroll button (`mechanics/rolls/reroll.mjs`, usage key
    `item:<id>`). A rule limit would count on its own, so both could be used.
  - It needs a bank reroll kind first, and a way for the reroll engine to read rule limits.
- **Danger Close.** It is a branch of Ground Suppression's code (`items/vehicles/ground-suppression.mjs`), which isn't in
  this part. It converts with Ground Suppression.
- **Think Tank.** It is a branch of Data Bridge's picker (`items/social/data-bridge.mjs`), which isn't in this part. It
  converts with Data Bridge.

## Differences from the old code (engine idioms)

These are kept on purpose. Most come from how the rules engine does things.

- **Chat lines.** They are now the Use / Trigger / button card lines. The old PerkUsed cards and ext-button cards are
  gone.
- **Offers and buttons.** They go to the holder's owners and the GM. The old code only offered them to the user whose
  assigned character held the item (One-Upping, Not Like That, Secret Helper).
- **Writes on other actors.** They go through the GM relay. Damage on a creature the presser can't write posts the
  engine's "for the GM" line. The old code wrote directly, and that failed for players.
- **Availability.** It's the Use's own `when` / limit / cost. The old code warned on press. This applies to Zord Ultra
  Mode, Mega-Weapon, Fly In The Future and Relic Key.
- **Old flags.** Old per-item flags aren't migrated, because v6 is unreleased. Examples: Elemental Fury `pr3Element`,
  Motor Pool `motorPoolBudget.<id>`, Drone `copiedOrigin` (kept, now written by the rule), the Temper Tempest flag.
- **Per item:**
  - **Friendship Is Mystical**: refuses yourself as the target.
  - **Help Yourself**: with no scene, there is no clone.
  - **Guardian Blast**: it is the system's Group Skill Test card, so the group Perks apply. At least one ally must join.
  - **Self Improvement**:
    - The Defense raised is the Essence's usual one.
    - The Skill point is a roll source, not a sheet shiftUp.
    - The Skill list isn't filtered by Skills already improved.
  - **Secret Helper**: the help is the re-scored card (the CardOffer addDie). There is no separate "resolve" button.
  - **Relic Key**: the bank is not read on Initiative rolls.
  - **Anonymous**: an expired Outwit mark no longer counts.
  - **Artillery Support**:
    - A strike called on another scene finds no one.
    - The landing card is a rule button.
  - **Delegate**: it now offers rule limits too (see Bugs).
  - **Fly In The Future**: the state is the pilot's toggle, so it ends when the pilot leaves the vehicle.
- Each batch's full notes: `<scratchpad>/r15/items2/progress.md`.

## Bugs found and fixed

- **Delegate.** It could never refund a Perk that had become rules. It only looked at loose Scene Clock / turn-stamp
  flags, never `flags.essence20.ruleUses`. `refundUse` now offers rule limits too.
- **Anonymous.** It counted an Outwit mark that had already expired. `markedBy` checks expiry.
- **`placeZone`.** A zone with no modifier still added an empty, zero-shift roll source to every roll inside it. Those
  zones are now skipped.
- **The step validator.** It refused `spendAction {action: fullAction}`, though the economy spends it.
- **Tests.**
  - `conversions.test.js#misc7Holder` never re-indexed its extra items, so their rules didn't count. It now calls
    `rebuildIndex`.
  - The four Environmental Expertise readers' mocks get the Perk's real rules.

## Code vs notes - needs a ruling

Each of these is parked in `questions.md`.

- **Tough It Out.** The notes say it takes a Standard action; the code spent none. The rule spends none.
- **Terror.** The notes promise Terror when Menacing Glare / Absolute Menace Frighten a target. No code has done that
  since those Perks became rules. Only the damaging-hit half is built.
- **Solid-State Energon.** The notes say "either way the crystal is used up". The code only uses it up on an explosion
  or a successful refine. The code's behaviour is kept.
- **Relic Key.** The notes say once per scene; the code is once per encounter. Once per encounter is kept.
- **Fly In The Future.** The notes say it lasts "until its next turn". The code is a toggle with no time limit. The
  toggle is kept.
- **Zord Mega-Weapon System.** The notes said "a button in the Zord's sidebar". They are reworded to "Use button on the
  Feature". The lang string `E20.MegaWeaponCreated` still mentions the sidebar.

## Shared-file edits

All of these are surgical. Removed code is listed with what replaced it.

### Engine (module/rules/)

- **steps.mjs**:
  - `roll`: `@var.multiplier`, `sheetShifts`.
  - `untilOf: target`.
  - `damage`: `asCastHit`.
  - `askNumber`: `value`.
  - `grant`: flags filled, `@var.grantedId`.
  - The validator allows `spendAction fullAction`.
- **expiry.mjs**: `registerUntil`.
- **adapter.mjs**:
  - `ruleAssist`: the refusal message.
  - `ruleMovement`: `countSinceTypeChange`.
- **types.mjs**: the MovementAction param.
- **triggers.mjs**: `roll.edge` on post-roll Triggers.
- **Plug-ins**:
  - `plugins/cards/card-offer.mjs`: `once`, `skillDie`, the card's Skill.
  - `plugins/rolls/initiative.mjs`: `afterCurrent`.
  - `plugins/effects/veto.mjs`: `kitUse`.
  - `plugins/tags/world-watch.mjs`: `@var.skill`.
  - `plugins/marks/mark-value.mjs`: `$skill`.
  - `plugins/combat/move-to.mjs`: `snap`.
  - `plugins/combat/canvas-points.mjs`: `placeZone` `halfFeet` / `replace`, no empty zone sources.
  - `plugins/combat/rigs-and-blasts.mjs`: `scheduleCard turnStarts`, `blast` packets / `at` / `excludeTargets`,
    `damageCard to`.
  - `plugins/effects/rule-effects.mjs`: `addEffect` flags filled.
  - `plugins/picks/pick-and-loop-steps.mjs`: `setEffects items` (its body moved into `setEffectsOn`), `recordScene quiet`.
  - `plugins/resources/scene-window-counters.mjs`: `markWindow` `count` and filled flag.
  - `plugins/rolls/lend-assistance-step.mjs`: `skillOnly` / `radius`.
- **plugins/index.mjs**: the items2 block.

### System code

- **dice.mjs** had these readers removed or replaced:
  - removed: Time To Think, One-Upping, healing posts, Influential, Magically Fit In bonus, Help Yourself summon,
    Terror accrual, Relic Key (two places);
  - replaced: the Environmental Expertise / Guidance block (now `ruleEnvironmentalExpertise`), the NaturalTwenty
    multiplier, Fly In The Future (now `ruleEvasiveManeuvers`).
- **chat.mjs**: One-Upping and Secret Helper buttons gone.
- **essence20.mjs**: Time To Think hook, chat decorators and R.R.R.'s `combatRound` hook gone.
- **documents/actor.mjs**: evasive Aerial halving reads the rule.
- **documents/item.mjs**: Mega-Weapon consume gone.
- **combat.mjs**: Aegis stage, `consumeDamageShield`, `ruleDriverlessEssence`.
- **story-points.mjs**: Battle Hardened is now a hook call.
- **banked-buffs.mjs**:
  - Tough It Out / Stand Together / Preventative Measures / Environmental Expertise / BANKABLE_PERKS gone;
  - Help Yourself, Relic Key and Fly In The Future branches gone;
  - the `spell` type guard is gone.
- **action-perks.mjs**: BFF, Secret Helper penalty and ids gone.
- **lend-assistance.mjs**: Assist pay, refusal message.
- **kits.mjs**: `kitUseVetoed`.
- **group-tests.mjs**: a test's `cost`.
- **token-movement.mjs**: comment.
- **nearby-allies.mjs**: Self Improvement import gone.
- **environmental-expertise.mjs**: now reads the rule.
- **rough-terrain.mjs**: comments.
- **Situations**: situational-initiative-setup.mjs, situation-checks.mjs.
- **Sheets and dialogs**:
  - base-actor-sheet.mjs: Aegis; the Mega-Weapon sidebar context / action removed.
  - templates/actor/sidebars/zord.hbs: the Mega-Weapon button removed.
  - roll-dialog.hbs / roll-options-dialog.mjs / roll-dialog.mjs: the 20% Cooler box removed.
- **sheet-handlers**:
  - zord-feature-handler.mjs: Mega-Weapon constants now local.
  - listener-misc-handler.mjs.
- **Other system files**: social-rolls.mjs, target-riders.mjs.
- **items/**:
  - zords/zord-feature-picks.mjs: Zord Feature / Ultra Mode / Versatile trait code gone.
  - zords/lightspeed-boost.mjs.
  - magic/temper-tempest-sorcery-builder.mjs: the storm half gone.
  - shared/condition-damage-buttons.mjs: four ids, damage button and helpers gone.
  - Id tables: gij-crb-item-lookups, mlp-pr-tf-ids-and-skill-total, pr-crb-ttsg-item-ids, pr-jtt-ats-item-ids,
    tf-crb-tf-one-item-ids, tf-technorganic-enigma-item-ids, terrain-perk-ids-and-readers.
  - Comments: social/betrayal.mjs, forms/mega-defender.mjs, gear/support-upgrade-lending.mjs,
    resources/emotional-mastery.mjs, attacks/unlucky-for-you.mjs, mechanics/rolls/skill-effects.mjs,
    rolls/reckless-abandon.mjs.
  - index.mjs: the removed files' imports.

### Tests

- dice.test.js.
- conv12-slI12, conv14-dice, conv9-slB9, conversions, phase3b (unchanged: ruleMovement keeps its shape).
- combat, banked-buffs, story-points, action-perks, lend-assistance, companions, reroll, environmental-expertise,
  environment-gated-effects, rough-terrain.
- `items/tests/*`: gi-joe-crb-perks, hidden-state-mega-defender-zones, medic-support-temper-tempest,
  alt-mode-deceptive-warfare, alterations-timeslide-deflecting, anonymous-alterations-implied-conditions,
  combiners-megaforms, power-heal-elemental-fury, reactions, resources-energon-wealth, show-respect-mimicry-support,
  situational-perks, reckless-abandon, lightspeed-spectrum-time-displaced.

### Deleted

`git rm`, with their tests:

- Healing and support: tough-it-out, stand-together, preventative-measures, battle-hardened, team-buffs.
- Rolls: time-to-think, better-than-the-best, one-upping, agency (2 files), influential, fun-exhaustion, be-an-example,
  reckless-abandon-end, competitive, situational-initiative, unexpected-alternative.
- GI JOE: queens-gambit, martial-artist-compare, touch-move, artillery-support.
- Friends and social: best-friends-forever, better-together, friendship-is-mystical, magically-fit-in, help-yourself,
  delegate, secret-helper (2 files).
- Environment: adapted-vehicles, environmental-enforcer, tests/terrain-environment-perks.test.js.
- Transformers: not-like-that-like-this, scramble-field-generator, they-called-it-a-glitch, alt-mode-mimicry,
  drone-copied-origin, solid-state-energon, converting-third-dimension.
- Magic and movement: timeslide, temper-tempest (storm half only - the file stays for the Sorcery builder),
  self-improvement.
- Power Rangers: terror, guardian-blast, perfect-placement, elemental-fury, motor-pool-connections, evasive-maneuvers.
- Zords: rapid-rescue-response, relic-key, zord-mega-weapon, torozord-feature (its builder had no other user).
- Lookups: anonymous-upgrade, cobra-codex-item-lookups (only Anonymous used it).

## Unused strings

These lang/en.json keys have nothing left that reads them:

E20.BattleHardenedRefund, E20.OneUppingActivate, E20.Gij3TouchMoveChat, E20.Gij3Nobody, E20.Gij2MartialArtistResult,
E20.Gij2CompareEqual, E20.Gij2CompareInferior, E20.Gij2CompareSuperior, E20.Gij2NeedsTarget, E20.Gij2QueensGambitDone,
E20.Gij2QueensGambitGm, E20.Gij2QueensGambitOffer, E20.Gij2QueensGambitPick, E20.Gij2AlreadyUsed, E20.Gij2Apply,
E20.ToughItOutUnavailable, E20.StandTogetherUnavailable, E20.PreventativeMeasuresName, E20.PatchUpPickSkillTitle,
E20.PatchUpPickSkillLabel, E20.Gij2RecklessDefeated, E20.Gij2RecklessMinute, E20.Gij2RecklessNoEnemies, E20.BffChosen,
E20.BffPrompt, E20.BffTitle, E20.LeaveItToMe, E20.RollDialogTwentyPercentCooler, E20.O3BetterTogetherChosen,
E20.O3BetterTogetherLine, E20.O3BetterTogetherPick, E20.S2CompetitiveChat, E20.S2TakeInSceneNoticed,
E20.S2TakeInSceneMissed, E20.S2MisplacedConfidence, E20.S2TakeInSceneAsk, E20.S2TakeInSceneYes, E20.S2TakeInSceneNo,
E20.S2GmOnly, E20.S1EnvironmentalEnforcerToggle, E20.EnvironmentalExpertiseActivated,
E20.EnvironmentalExpertiseDeactivated, E20.Tf2NotLikeThatButton, E20.Tf2NotLikeThatFlavor, E20.Tf2NotLikeThatForfeit,
E20.Tf2NotLikeThatForfeitSource, E20.Tf2NotLikeThatForfeited, E20.Tf2NotLikeThatOwed, E20.Tf2AlreadyRerolled,
E20.Pr1BeAnExamplePick, E20.Pr1BeAnExampleLine, E20.O3ScrambleApplied_alertness, E20.O3ScrambleApplied_invisible,
E20.O3ScrambleApplied_illusion, E20.O3ScrambleMissed, E20.O3ScrambleMode, E20.O3ScrambleModeIllusion,
E20.O3ScrambleModeInvisible, E20.O3ScrambleModeSensors, E20.O3ScrambleRemoved, E20.O3ScrambleSkill, E20.O3NeedTarget,
E20.O1Timeslide, E20.O1TimeslidePick, E20.O1TimeslideTooFar, E20.Mlp2FriendPrompt, E20.Mlp2FitIn, E20.Mlp2Fortify,
E20.Mlp2Heal, E20.Mlp2PickSkill, E20.Mlp2PickDefense, E20.Mlp2FriendFitIn, E20.Mlp2FriendFortify, E20.Mlp2FriendHeal,
E20.O2TempestCalm, E20.O2TempestEnds, E20.O2TempestStress, E20.O2TempestStrike, E20.O2TempestStruck, E20.O2NeedTarget,
E20.G1AnonymousLabel, E20.Tf1CrystalDamage, E20.Tf1CrystalDamaged, E20.Tf1CrystalExplodes, E20.Tf1CrystalHolds,
E20.Tf1CrystalPoints, E20.Tf1CrystalPrompt, E20.Tf1CrystalRefine, E20.Tf1CrystalRefineFailed, E20.Tf1CrystalRefined,
E20.Tf1GlitchDone, E20.Tf1GlitchFailed, E20.Tf1GlitchOperate, E20.Tf1GlitchPickPerk, E20.Tf1GlitchPickReverse,
E20.Tf1GlitchPrompt, E20.Tf1GlitchReverse, E20.Tf1GlitchReversed, E20.Tf1GlitchTooFrail, E20.Tf1MimicryGained,
E20.Tf1DroneCopied, E20.Tf1ApplyDamage, E20.Gij2ArtilleryBringIn, E20.Gij2ArtilleryCalled,
E20.Gij2ArtilleryEffect_flare, E20.Gij2ArtilleryEffect_smoke, E20.Gij2ArtilleryHit, E20.Gij2ArtilleryLands,
E20.Gij2ArtilleryMiss, E20.Gij2ArtilleryOtherScene, E20.Gij2ArtilleryPick, E20.Gij2ArtilleryPoint,
E20.Gij2Artillery_flare, E20.Gij2Artillery_he, E20.Gij2Artillery_heat, E20.Gij2Artillery_shrapnel,
E20.Gij2Artillery_smoke, E20.Gij2GmApplies, E20.O3SelfImprovementEssence, E20.O3SelfImprovementLine,
E20.O3SelfImprovementSkill, E20.O3GuardianBlastCard, E20.O3GuardianBlastHit, E20.O3GuardianBlastMissed,
E20.O3GuardianBlastWho, E20.O3Hit, E20.O3Miss, E20.O3Roll, E20.O3Resolve, E20.O3ApplyDamage, E20.O3NotYours,
E20.O3PerfectPlacementPick, E20.O3PerfectPlacementSet, E20.Pr3FuryElementPrompt, E20.Pr3FuryElement.air,
E20.Pr3FuryElement.earth, E20.Pr3FuryElement.fire, E20.Pr3FuryElement.lightning, E20.Pr3FuryElement.water,
E20.Pr3FuryReady, E20.ResMotorPoolNoVehicle, E20.ResMotorPoolPickVehicle, E20.ResMotorPoolSpent,
E20.ResMotorPoolPickSkill, E20.ResMotorPoolDenied, E20.ResMotorPoolGranted, E20.Tf3UnexpectedEdge, E20.O2Delegated,
E20.SecretHelperActivate, E20.SecretHelperNoDie, E20.SecretHelperAssist, E20.ReactSecretHelperNow,
E20.ReactSecretHelperSuccess, E20.ReactResolveSuccess, E20.EvasiveManeuversNoVehicle, E20.EvasiveManeuversActivated,
E20.EvasiveManeuversDeactivated, E20.Zord2PickZordFeature, E20.Zord2ZordFeatureTitle, E20.Zord2NoZord,
E20.Zord2UltraPrompt, E20.Zord2UltraConvert, E20.Zord2UltraAddFeature, E20.Zord2UltraNeedsMorph,
E20.Zord2UltraActivated, E20.Zord2PickSpectrum, E20.Zord2Spectrum.black, E20.Zord2Spectrum.blue,
E20.Zord2Spectrum.green, E20.Zord2Spectrum.pink, E20.Zord2Spectrum.red, E20.Zord2Spectrum.yellow,
E20.Zord2OncePerScene, E20.Zord2NotEnoughPower, E20.MegaWeaponAlreadySummoned, E20.MegaWeaponAttacksLeft,
E20.MegaWeaponExpended, E20.MegaWeaponSummonButton, E20.MegaWeaponSummoned, E20.MegaWeaponTooltip.

New strings are in `<scratchpad>/r15/lang-items2.json` (`E20.RulesExtItems2.*`): BattleHardenedRefund, Nobody,
NotYourself, TimeslideTooFar, GlitchTooFrail, Defended, MotorPoolSpent.

## Rule count

151 rules on 62 pack items:

- Self Improvement has 33.
- Elemental Fury has 7.
- Reckless Abandon, Temper Tempest and Zord Ultra Mode have 6 each.
- Better Together (Influence) and Perfect Placement have 5 each.

`scripts/check-rules.mjs`: 3836 rules on 2288 items, 0 errors, 0 warnings.
