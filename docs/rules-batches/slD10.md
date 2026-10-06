# slD10 - round 10, group D: cards, resources, Initiative, contested rolls, canvas

**Scope:** the group D list of `r10/groups.md` - reroll / add-a-die / GM offers on posted roll cards, Story Point pools,
spell-cost options, Initiative steps, contested rolls and item states, canvas points and delayed blasts, and the banks
and team grants (slA9 8-10; slB9 5, 13; slC9 9; slD9 4, 6, 8, 10, 12, 13, 14; slE9 1, 2, 6, 10). Every piece in the list
is built (module/rules/ext/d.mjs + module/rules/ext/d/*.mjs) and every item it unblocks is converted: **53 rules on 45
items**, no item left as code. `scripts/check-rules.mjs`: 0 errors, 0 warnings (2335 rules on 1363 items at the time of
the last run, the other groups' work included).

## Engine features added 2026-10-06 (round 10, group D)

- **CardOffer rules** (rules/plugins/cards/card-offer.mjs) - a button on posted roll cards, offered by an item to its holder or to
  others: `{type: CardOffer, label, whose: self | party | side | any, pressedBy: roller | holderOwner | gm, when?,
  pool?: {mark: key}, limit?, counter?: {per}, cost?: {resource, amount}, reroll?: {target: d20 | allDice | formula,
  keep: new | choose}, addDie?: {faces}, steps?}`.
  - `whose`: the holder's own cards; `party` - the holder's and the primary Party roster's; `side` - another actor of
    the holder's kind (player-like or not); `any`.
  - `pressedBy`: `roller` (the GM, the roller's owners, the card's author), `holderOwner` (the holder's owners and the GM),
    `gm`.
  - `when` sees `self:` = the holder, `target:` = the roller and the **`card:` tags**: `card:failed`, `card:fumble`,
    `card:d20:<n>` (the d20 shows n), `card:hasD20`, `card:checks` (compared with a DIF / Defense), `card:skill`,
    `card:rerolled` (it is itself a reroll), `card:marked:<key>` (a `markCard` step set it), `card:holderPresent` (the
    holder has a token on the viewed scene, or the scene has none), `card:involves:<path>` (the creature whose uuid the
    holder keeps at that path is a row's target, or on the canvas).
  - `pool: {mark}` - each press takes one from the holder's mark count (offered while some is left; label `{count}`).
    `limit` counts presses; `counter: {per}` only counts them (`@var.used` in the cost formula - a rising cost).
  - `cost` is paid by the holder; `{gmStoryPoints: true}` spends the GM's pool; Role Points honour
    `useUnlimitedResource`. Labels fill `{count}`, `{cost}`, `{die}`, `{holder}`.
  - `reroll`: `d20` / `allDice` post a fresh check card (mechanics/rolls/reroll.mjs, marked as a reroll); `formula` rolls the
    whole formula again (`keep: choose` lists both totals against every DIF for the player to choose). `addDie {faces}`
    rolls 1d<faces> onto the card's total and rescored rows, with damage buttons for targets now hit (or hit harder).
  - `steps` run after, as the holder, the roller as target, `@var.used`, `@var.total`. Card-only step
    **`markCard {key}`** marks the card (`card:marked:<key>`).
  - **Trigger event `rerolled`** - a Story Point reroll card this user posted (chat.mjs rerollMessage): `@var.source`
    (storyPoint...), `@var.total`, `@var.failed` (1 when the new total reaches none of the original DIFs), the original
    card's Skill as `skill:`.
- **Personal Story Points** (rules/plugins/resources/personal-story-points.mjs) - the Ruthless Point ledger is engine data now
  (`flags.essence20.personalPoints`; mechanics/resources/story-points.mjs spends them first). Step **`givePersonalPoints {to, count,
  shared?, max?, ownTurn?}`** (shared: one point every recipient shares; max: the first N recipients). Trigger events
  **`personalPointUnspent`** (an actor ended its turn holding points - fired on every actor listening, that actor as
  target, before they tick down) and **`storyPointNarrative`** (the tracker's narrative spend, `@var.kind`). Tag
  **`target:sameType`**.
- **SpellCost rules** (rules/plugins/resources/spell-cost.mjs) - `{type: SpellCost, label, op: set | add | multiply | spend, value?,
  spend?: {resource, max?}, note?, quiet?, steps?, when?}`: every SpellCost rule of the caster whose `when` holds
  (`item:` = the spell; `item:own` for a spell's own option) is a row in ONE dialog before the cast; ticked rows apply set,
  then add, then multiply, then spend (a number box, paid, taken off the Cost, never below 0), post their `note` and
  run their `steps`. Cancelling cancels the cast. Step **`recastFree {item}`** casts a spell again at no cost (dataset
  `freeCast`). afterRoll Triggers get **`@var.itemUuid`** (the rolled item).
- **Initiative** (rules/plugins/rolls/initiative.mjs) - rule type **`InitiativeReroll {atMost}`** (the Initiative formula rerolls
  Skill dice showing atMost or less, once); Trigger event **`initiativeRolling`** (from the roll itself, before the
  formula - dice.mjs INITIATIVE_EXTENSIONS); steps **`rollInitiative {to}`**, **`swapInitiative {requireLower?}`** (with
  the first target), **`distribute {to, total, prompt?, steps}`** (share up to `total` points among the recipients - each
  one's steps run with it as target and its share as `@var.share`); ref **`@initiative`** (`.target`, `.recipient`);
  tags **`self:initiative`** / **`target:initiative`** (rolled in the running combat); recipients **`protectedTarget`**
  and **`markers:<key>`** (actors who set that per-setter mark on this actor). `ruleConditionImmune` now passes
  `holder` (aura ConditionImmunity with `holder:protects`).
- **Contested rolls and item states** (rules/plugins/rolls/contest.mjs, items.mjs) - step **`contest {skill | skills, edge?,
  plain?, against: {skill | skills}, to?, onWin?, onLose?}`** (the actor's Skill against the recipient's own roll, a tie to
  the resisting side; `plain`: both roll their best listed Skill die as 1d20 + the die; when this user can't roll for the
  other side, its owner rolls from a card - `contestAnswer`). Steps **`markItem {item, key, effects: {blockRolls?,
  noArmorDefense?}, to?}`** / **`unmarkItem`** (a marked item can't be rolled, its attacks neither; marked armor adds no
  Toughness or Evasion), tag **`item:marked:<key>`**, recipient **`operator`** (a vehicle's / Zord's driver, else the
  target), step **`rollPlain {skill, to, var}`**, step **`spendActionFor {action, to}`**, ref
  **`@availabilityDif.<choiceKey>`**, tag **`target:withinOrUnknown:<ft>`**.
- **Canvas points, zones, delayed cards, blasts** (rules/plugins/combat/canvas-points.mjs, blast.mjs) - step **`pickPoint {prompt?,
  at?: targetOrSelf | actorOrKept, actor?}`** (`@var.pointX/pointY`, `{var.pointScene}`); recipient **`around:<ft>`**;
  step **`placeZone {key, label?, half?, until?, modifier: {when, upshift?, downshift?, edge?, snag?}}`** (anyone rolling
  from inside a live zone gets its modifier as a roll source); step **`scheduleCard {turnEnds? | rounds?, steps}`**
  (later in a combat - after this actor's turn ends N times, or when a round comes; now out of combat); steps **`rig`**
  / **`requireRig`** / **`endRig`** (a live rig two cards share); **`blast {radius, skill, defense, damage,
  damageType, title}`** (a Skill Test against everyone around the point, Apply Damage buttons x Degrees of Success;
  `defense: ask` or a number 1-4); **`explosion {radius, formula, saveSkills, saveDif, damageType, title}`** (damage
  rolled once, a plain save each for half); **`damageCard {actor, amount, damageType, title}`**; **`explodeVehicle
  {actor}`**.
- **Banks and team grants** (rules/plugins/tags/small-steps-and-refs.mjs, alteration.mjs) - step **`bankDie {die, appliesWhen}`** (a bonus die
  for the next matching roll, moved into the More Heads slot before the dialog and back if another roll comes first; tag
  **`rule:bankedDie`**); step **`tempResource {kind: health | energon, amount, to, untilDamage?}`** (tracked temporary
  Health / Energon - amount worked out per recipient); recipient / ref **`teamCombatants`** (teammates in the running
  combat); tag **`combat:roundIs:<n>`**; steps **`checkAllies {within, prompt}`** (tick allies in range - they become the
  targets) and **`lendAssistEdge {to, against, actionEach?}`** (Lend Assistance's Edge banked against a creature);
  step **`claimCard`** (a button's presser answers that card once - buttons.mjs hands the card to the steps); step
  **`askText {var, prompt, firstWord?}`**; step **`queueTurnStart {to, spendAction?, whisper?}`** (at each recipient's next
  turn start: spend that action, whisper its owners); steps **`spendActions {action, count}`**, **`spendFor {resource:
  {path}, amount, to}`**, **`captureRoll {var}`** / **`retryRoll {var, downEach}`** (retry the last Skill Test with a
  cumulative ↓), **`countTargets`**, **`countRecipients`**, **`targetRecipients`**, **`targetSelf`**, **`clearMarks`**,
  **`rememberTarget`**; tags **`target:uuid:<uuid>`**, **`allOf:<tag>&<tag>`**, **`attackHands:<n>`**; ref
  **`@targetKeyed.<path>`**; pick source **`sideActors`**; recipient **`driverOrSelf`**; rule types **`HardpointUse
  {items, slots}`** and **`StanceSwitch {stance: allOutAttack | evasiveFighting, max}`** (a number box in the dialog -
  that many ↓, the rider stance, All Out Attack's extra damage); steps **`pickAlteration {var, from: own | compendium,
  tier?, keep?}`** and **`lendAlteration {from, to, part, expire: lenderTurn | theirNextTurnEnd | scene | minute}`** over
  the other1 slice's Alteration lending ledger. The `bank` step fills `{var.x}` in `appliesWhen`; the `roll` step keeps
  `@var.rollTotal`.

## Verdicts

| Item | Pack | Verdict |
|---|---|---|
| Play Favorites | ccitems | converted |
| Play Favorites Against Each Other | ccitems | converted |
| This, I Command | ccitems | partial - its Ruthless Point doubling is in Play Favorites' rules; the ↑ / extra-action doubling stays in mechanics/characters/perks.mjs (not in this list) |
| Ruthless Efficiency | ccitems | converted |
| Think Fast! (A Jump Through Time) | jttitems | converted |
| Best Laid Plans | dditems | converted |
| One Last Chance | dditems | converted |
| Sorcerous Support | kocitems | converted |
| Do Or Die | ghpfitems | converted (the rising Moxie cost too) |
| Nemesis (Specific Threat) | atsitems | converted (the reroll; the Nemesis pick is items/rolls/nemesis.mjs) |
| Destiny (Hang-Up) | atsitems | converted |
| Quantum Trigger | jttitems | converted |
| Savant Skill | jttitems | converted (its Story Point refund; the d20+d4 half is dice.mjs's) |
| Prospector Toolkit | jttitems | converted |
| Danger Sense (Across the Stars) | atsitems | converted |
| Danger Sense (GI Joe) | gijcrbitems | converted (the Protected Target's immunity and the Initiative sync) |
| Illusion Casting, Reach Out | kocitems | converted |
| Brilliant Sight | kocitems | converted (its fog option; the darkvision grant stays in mlp1PostRoll, not in this list) |
| Extra Effective Spell, Long Lasting Spell | mlpcrbitems | converted |
| Mystical Understanding | mlpcrbitems | partial - Spellcosting converted; Refocus, Essential Research and Magically Fit In stay code (not in this list) |
| Sharpcaster | kocitems | converted |
| Reactionary | mlpcrbitems | converted |
| Timeline Anomaly | wtnvcgitems | converted |
| Shark's Fin | qgtgitems | converted (its Initiative half - the item is now all rules) |
| Follow Me! | prcrbitems | converted |
| Precise Chronometrics | eocitems | converted |
| Whisper Campaign | tfcrbitems | converted |
| Frequency Interference | ghpfitems | converted |
| Restraining Gear | ttsgitems | converted (its Megaform rule uses group A's `megaform` scope) |
| Smoke Screen | mlpcrbitems | converted |
| Smoke Bomb | kocitems | converted |
| Destructive Overcharge, Cascading Failure | qgtgitems | converted |
| Together We Stand | eocitems | converted |
| The Sound of Angels | qgtgitems | converted |
| Overload, Genetic Support, Advanced Alteration Emulator | ccitems | converted |
| All For One | prcrbitems | converted |
| Irrefutable Order, Target Breakdown | tfcrbitems | converted |
| Water Cannon | tfcrbitems | converted (the hardpoint - the item is now all rules) |
| All Out Attack, Evasive Fighting (Transformers) | tfcrbitems | converted |

## Converted

- **Play Favorites** - two Use rules: a Standard-action one (without Play Favorites Against Each Other) and a Move-action
  one (with it); each gives the first target (else yourself) a personal Story Point; This, I Command's question (1 Psychic
  to an ally for two points) is a `choose` gated on `self:has:This, I Command`, `target:data:uuid`, `not:target:self`.
  **Play Favorites Against Each Other** carries the Move-action Use too, with the "share one between the first two
  targets" choice (`givePersonalPoints {shared, max: 2}`).
- **Ruthless Efficiency** - a `personalPointUnspent` Trigger (the actor itself or one of its kind) marks the holder; a
  `turnStart` Trigger on the mark unmarks it and gives a point counted from the holder's own turn.
- **Think Fast!** - a `storyPointNarrative` Trigger for `var:kind=equipment`: a d6 table, 5-6 gives the Story Point back.
- **Best Laid Plans** - a Use (Alertness or Culture, DIF 10) marks the planner with a scene pool of `max(1, 1 + floor((total
  - 10) / 5))`; a CardOffer (`whose: party`, `card:hasD20`) rerolls the d20 from it. **One Last Chance** - a CardOffer
  (`whose: side`, failed Skill Tests that aren't rerolls, the holder on the scene, once a scene) rerolling every die.
  **Sorcerous Support** - a Use readies it (mark until the mission ends); a CardOffer for its owners on any card whose d20
  shows 1 re-rolls the formula and spends it for the mission. **Do Or Die** - a CardOffer on your own check cards:
  1d(2/4/6/8 by Old Hand level) added to the total, Moxie `1 + min(1, @var.used)` (counter per scene). **Nemesis** - a
  CardOffer (`card:involves:flags.essence20.nemesisUuid`, once a scene) rerolling the formula with both results shown.
  **Destiny** - a GM-only CardOffer on a plain failure: 1 GM Story Point, `markCard`, the team gains a Story Point.
- **Quantum Trigger** - an afterRoll Trigger (`allFailed`, Personal Power 1+) captures the roll and posts a button: 1 Power,
  `retryRoll` with ↓ = base + the retry chain. **Savant Skill** - a `rerolled` Trigger (`var:source=storyPoint`,
  `var:failed=1`, `skill:{item.choice}`) gives the Story Point back.
- **Prospector Toolkit** - a Use (once a mission, not while one is banked): 1d4, or a DIF 16 Survival Test for 1d8;
  `bankDie` for the next Wealth Test.
- **Danger Sense (Across the Stars)** - `InitiativeReroll {atMost: 2}`. **Danger Sense (GI Joe)** - an aura
  ConditionImmunity (10 ft, allies, `holder:protects`) and a Use writing `@initiative` onto `protectedTarget`.
- **Spell costs** - SpellCost rules: Illusion Casting (set 1), Reach Out (add 1), Brilliant Sight's fog (add 1 on that
  spell, quiet, sets the old `brilliantSightFog` flag), Extra Effective / Long Lasting Spell (multiply 2), Mystical
  Understanding (spend Mystical Points). **Sharpcaster** - an afterRoll Trigger (a spell, `allFailed`, a target) posts a
  `recastFree` button.
- **Reactionary** - a Use (Free action, once a round, in a started combat) refused when first in Initiative, then
  `rollInitiative`. **Timeline Anomaly** - a Use (once a session) swapping Initiative with the target. **Shark's Fin** -
  an `initiativeRolling` Trigger at sea or in wetlands: Surprise comes off, its best of Ground / Aquatic Movement told.
  **Follow Me!** - a Use (in a combat, before you roll) posts a Follow card for anyone's character (each marks the leader
  per setter); an `initiativeRolled` Trigger on the leader takes the unrolled followers, clears the marks, adds +1 each and
  writes `max(1, leader - 1d4)` for each follower. **Precise Chronometrics** - a Use (once an encounter) `distribute`s up
  to Smarts among the same side's rolled combatants as Initiative bonuses.
- **Whisper Campaign** - a Use: `contest` Deception with Edge against the target's Persuasion. **Frequency Interference** -
  a Use (Standard, a target within 100 ft): pick a Computerized item of theirs, the DIF is its Availability or the
  operator's plain Technology roll, a Technology Test jams it (`markItem` - no rolls, no armor Defense) and posts a reboot
  card (the target spends a Move action). **Restraining Gear** - hit Triggers (the Zord's own and, `scope: megaform`,
  each Megaform it is in) post a button: 1 Personal Power from the driver (or the Zord / Megaform itself), a plain
  Brawn-or-Might contest, Restrained on a win.
- **Smoke Screen** - a Use (Standard, while some are left): a point, Blinded for a round within 20 ft, one used up.
  **Smoke Bomb** - a Use (point first, then the Standard action): a scene zone giving Alertness rolls inside ↓1, one used
  up (gone at 0).
- **Destructive Overcharge** - a Use (Standard): what the target holds, else one of your Computerized / Element items,
  at the target's (or your) position; a `scheduleCard` after two of your turn ends (now out of combat) posts Explode:
  Toughness or Evasion, 3 Fire for the holder, a 20 ft Technology blast for 1 Fire. **Cascading Failure** - a Use: a
  targeted vehicle, or a device's size; a timer; a rig with Disable (Free) and Explode (Standard) cards - a vehicle
  explodes as itself, a small device like a grenade (10 ft, Technology vs Evasion, 1 Sharp), a large one 2d2/2d4/2d6 Fire
  in 15/30/45 ft with a DIF 14 save for half; the timer ends the rig.
- **Together We Stand** - a `roundStart` Trigger in round 1 with two or more teammates in the combat: 1d2 tracked
  temporary Health and Energon for each teammate not already given it this combat (`togetherWeStand` mark).
- **The Sound of Angels** - an afterRoll Trigger on an explosive, an aerial vehicle's or a two-handed ballistic weapon's
  attack: tick allies within 50 ft; each costs a Free action and gets Lend Assistance's Edge against the target.
- **Overload** - a Use: lend an own Alteration's benefit (Free action, until your next turn) or force its cost (a Skill, a
  Move action, a test against Evasion; until the end of their next turn). **Genetic Support** - a Use (Standard, level 3+):
  a tier the level allows, an Alteration of it lent to the target (or yourself) until your next turn, or the scene at 14+.
  **Advanced Alteration Emulator** - a Use (Standard) lending its kept Limited Alteration to yourself for a minute, and a
  recharge Use (DIF 20 Technology) once spent.
- **All For One** - a `droppedToZero` Trigger (once per Rest) posts a Health card and a Power card; each other player's
  character (an ally) may answer each once (`claimCard`): 1 Health, or 1d2 Personal Power, moved to the holder.
- **Irrefutable Order** - a Use (Standard; target level no higher): a one-word order, Persuasion against Willpower or
  Cleverness; on a success the target's next turn start spends its Move action and whispers the order.
  **Target Breakdown** - a Use: as many Free actions as Analyze Target uses on the target, banked as that many ↑ on a
  picked ally's attacks against that target. **Water Cannon** - `HardpointUse {items: [item:granted], slots: 1}`.
- **All Out Attack / Evasive Fighting (Transformers)** - StanceSwitch rules (Might, Finesse or Targeting attacks, your
  own turn or out of combat, not alongside the G.I. JOE printing).

## Behaviour differences worth a decision

1. **Spell costs** - the two option dialogs (Illusion / Reach / fog, then Extra Effective / Long Lasting / Spellcosting)
   are one dialog now; the arithmetic order is the same (set, add, multiply, spend).
2. **Usage records of the old code aren't read** - a Perk used this scene / mission / session under the old flags
   (`q1OneLastChance`, `sorcerousSupport`, `pr1NemesisReroll`, `pr1DestinyFumble`, `q2DoOrDieScene`, `pr1ProspectorWeek`,
   Timeline Anomaly's session record, `o3Chronometrics`) may be offered once more in that window. A banked Prospector die
   (`pr1ProspectorDie`) and a jammed list (`o2Jammed`) are read once; a pending Target Breakdown bank
   (`tf3TargetBreakdown`), a pending Irrefutable Order and pending Destructive Overcharge / Cascading Failure rigs from the
   old code are dropped.
3. **Best Laid Plans** reads the Party roster when a card is pressed (the old pool kept the roster from when it was
   rolled); a cancelled planning roll says the plans fall through instead of nothing.
4. **One Last Chance** - every holder in range offers its own button (the old code offered the first holder's only).
5. **Nemesis / Best Laid Plans / One Last Chance** may also be pressed by the card's author (the CardOffer `roller`
   presser), as well as the roller's owners and the GM.
6. **Reactionary / Danger Sense / Irrefutable Order / Target Breakdown** - a refusal (already first, no Protected Target,
   level too high, nothing analyzed) posts a card line instead of a notification.
7. **Gear rules need the gear equipped** (Smoke Bomb, Prospector Toolkit, Water Cannon's hardpoint, the Alteration
   Emulator's host armor) - gear is equipped by default.
8. **Follow Me!** - the follow is a per-setter mark on the leader (until the combat ends) rather than a combatant flag;
   the bonus is applied by whoever rolled the leader's Initiative (writes to others go through the GM).
9. **Precise Chronometrics / Timeline Anomaly** - limited per encounter / per session by the rule limits.
10. **Target Breakdown** - a second breakdown for the same ally against the same target adds a second bank (the old flag
    replaced it).
11. **Irrefutable Order** - the word and the Defense are asked in two dialogs.
12. **Whisper Campaign** - a cancelled roll dialog stops the contest (the old code counted it as 0).
13. **The Sound of Angels** - `weapon:trait:ballistic` also counts a ballistic trait an attached upgrade adds.
14. **All For One** - two cards (Health, Power) instead of two buttons on one; the GM can't answer (players' characters
    only, as before for practical purposes).
15. **Destructive Overcharge / Cascading Failure** - buttons on separate cards; the blast counts tokens on the scene the
    point was picked on; Cascading Failure's two cards and its timer share a rig (`requireRig`).
16. **Quantum Trigger** - retry chains use new dataset keys (`e20RetryChain` / `e20RetryBase`).
17. **Play Favorites** - This, I Command's 1 Psychic to an ally this user can't write to is posted for the GM (the damage
    step) instead of being attempted directly.

## Still code (0)

None of the group D items. Two items are partial because their other parts were never in this list: **This, I Command**
(its ↑ / extra-action doubling, mechanics/characters/perks.mjs#offerThisICommand) and **Mystical Understanding** (Refocus, Essential
Research, Magically Fit In); Brilliant Sight's darkvision grant also stays in mlp1PostRoll.

## Shared-file edits

- `module/rules/steps.mjs` - the `roll` step keeps `@var.rollTotal`; the `bank` step fills `{var.x}` in `appliesWhen`.
- `module/rules/triggers.mjs` - afterRoll vars gain `itemUuid`.
- `module/rules/adapter.mjs` - `ruleConditionImmune` passes `holder`.
- `module/rules/buttons.mjs` - `ctx.buttonMessage` (the pressed card) for steps.
- `module/mechanics/resources/grants.mjs` - `rollTest` returns the roll's `total` too.
- `module/mechanics/resources/story-points.mjs` - imports the personal-point ledger from `rules/plugins/resources/personal-story-points.mjs`.
- `module/mechanics/resources/banked-buffs.mjs` (+ `.test.js`) - the Danger Sense and Timeline Anomaly dispatch removed.
- `module/items/index.mjs` - four imports removed (below).
- Deleted: `helpers/danger-sense.mjs` (+ test), `helpers/extensions/resource/personal-points.mjs`,
  `helpers/extensions/qualify1/rerolls.mjs`, `helpers/extensions/data22/mlp.mjs` (+ test),
  `helpers/extensions/qualify2/field-ops.mjs`.
- Slice files (my items' code and tests only): resource (`index`, `common`, `story-spend`, `temp-resources`,
  `resource.test`), qualify1 (`index`, `common`, test), qualify2 (`old-hand`, `common`, `session`, test), mlp1 (+ test),
  mlp2, pr1 (`ats`, `jtt`, `common`, test), pr3 (`ttsg`, `common`, test), other1 (`jtt`, `alterations` - its lending
  helpers exported for rules/plugins/effects/lent-alterations.mjs, test), other2 (`gij`, test), other3 (`pr`, `tf`, `shared`, test),
  situational1 (+ test), situational2 (`initiative`, `common`, `situational2` doc line, test), tf2 (`rolls`, `common`,
  test), tf3 (`uses`, `reactions`, `rolls`, `common`, test), react (`triggers`, test), gij3 (+ test).

## Unused strings

E20.ResRuthlessSharePrompt, E20.ResRuthlessShare, E20.ResRuthlessSingle, E20.ResThisICommandPrompt,
E20.ResThisICommandDouble, E20.ResThisICommandNo, E20.ResRuthlessSharedLine, E20.ResRuthlessLine,
E20.ResRuthlessEfficiency, E20.ResThinkFast, E20.ResThinkFastLine, E20.ResTogetherWeStand, E20.Q1PlansPrompt,
E20.Q1PlansFailed, E20.Q1PlansReady, E20.Q1PlansButton, E20.Q1PlansEmpty, E20.Q1LastChanceButton, E20.Q1LastChanceUsed,
E20.Mlp1IllusionOption, E20.Mlp1ReachOption, E20.Mlp1FogOption, E20.Mlp1IllusionNote, E20.Mlp1ReachNote,
E20.Mlp1SharpcasterButton, E20.Mlp1SorcerousReady, E20.Mlp1SorcerousButton, E20.Mlp1SorcerousRerolled, E20.Mlp1SmokeBomb,
E20.Mlp1SmokeWhere, E20.Mlp1SmokeThrown, E20.Mlp2EffectiveOption, E20.Mlp2LastingOption, E20.Mlp2SpellcostingOption,
E20.Mlp2EffectiveNote, E20.Mlp2LastingNote, E20.Mlp2SpellcostingNote, E20.Mlp2AlreadyFirst, E20.Mlp2Rerolled,
E20.D22SmokeScreenPick, E20.D22SmokeScreenUsed, E20.Q2DoOrDieButton, E20.Q2DoOrDieUnavailable, E20.Q2DoOrDieRolled,
E20.Q2DoOrDieCheck, E20.Pr1DestinyNoPoints, E20.Pr1DestinyLine, E20.Pr1DestinyButton, E20.Pr1NemesisFlavor,
E20.Pr1NemesisButton, E20.Pr1Difficulty, E20.Pr1Success, E20.Pr1Failure, E20.Pr1ProspectorPrompt, E20.Pr1ProspectorPlain,
E20.Pr1ProspectorSurvival, E20.Pr1ProspectorLine, E20.O1QuantumTriggerOffer, E20.O1QuantumTriggerButton,
E20.O1SavantRefund, E20.DangerSenseNoCombat, E20.DangerSenseNoProtectedTarget, E20.DangerSenseNotSeated,
E20.S1SurpriseImmune, E20.S2SharksFinMove, E20.O3FollowMeAlreadyRolled, E20.O3FollowMeCall, E20.O3FollowMeFollow,
E20.O3FollowMeNoCombatant, E20.O3FollowMeTooLate, E20.O3FollowMeFollowing, E20.O3FollowMeResolved, E20.O3ChronoPrompt,
E20.O3ChronoTooMuch, E20.O3ChronoApplied, E20.O3ChronoGmApply, E20.O3GmOnly, E20.Tf3PickTarget, E20.Tf3OrderTooHigh,
E20.Tf3OrderWord, E20.Tf3OrderDefense, E20.Tf3OrderFailed, E20.Tf3OrderGiven, E20.Tf3OrderSource, E20.Tf3OrderObey,
E20.Tf3BreakdownNone, E20.Tf3BreakdownPickAlly, E20.Tf3BreakdownGiven, E20.Tf3BreakdownSource, E20.Tf3WhisperAsk,
E20.Tf3WhisperRoll, E20.Tf3WhisperWon, E20.Tf3WhisperLost, E20.Tf2AllOutAttackToggle, E20.Tf2EvasiveFightingToggle,
E20.O2OutOfRange, E20.O2JamPick, E20.O2JamContest, E20.O2JamFailed, E20.O2Jammed, E20.O2Reboot, E20.O2Rebooted,
E20.O2JammedNoRoll, E20.Pr3RestrainOffer, E20.Pr3RestrainButton, E20.Pr3RestrainWon, E20.Pr3RestrainLost,
E20.Gij3SoundOfAngelsPrompt, E20.Gij3SoundOfAngelsChat, E20.ReactAfoCall, E20.ReactPower, E20.ReactHealth,
E20.ReactAfoGiveHealth, E20.ReactAfoGivePower, E20.ReactAfoNoGiver, E20.ReactAlreadyUsed, E20.ReactAfoNoHealth,
E20.ReactAfoGave, E20.O1OverloadPrompt, E20.O1OverloadBenefit, E20.O1OverloadCost, E20.O1PickAlteration,
E20.O1OverloadLent, E20.O1OverloadSkill, E20.O1OverloadResisted, E20.O1OverloadForced, E20.O1GeneticPrompt,
E20.O1GeneticStandard, E20.O1GeneticLimited, E20.O1GeneticRestricted, E20.O1GeneticExtendedPrompt,
E20.O1GeneticUntilTurn, E20.O1GeneticScene, E20.O1GeneticGranted, E20.O1EmulatorUsed, E20.O1NeedTarget,
E20.Q2OverchargeHeldBy, E20.Q2OverchargePick, E20.Q2OverchargeNothing, E20.Q2OverchargeRigged, E20.Q2OverchargeDue,
E20.Q2Explode, E20.Q2RigGone, E20.Q2OverchargeDefense, E20.Q2OverchargeHolder, E20.Q2OverchargeBlast, E20.Q2BlastEmpty,
E20.Q2CascadeSize, E20.Q2CascadeSmall, E20.Q2CascadeLarge, E20.Q2CascadeTimer, E20.Q2CascadeDevice,
E20.Q2CascadeRigged, E20.Q2CascadeRiggedTimed, E20.Q2CascadeDisable, E20.Q2CascadeFailed, E20.Q2CascadingFailure,
E20.Q2CascadeDisabled, E20.Q2Half, E20.Q2CascadeBlast, E20.Q2CascadeExploded

(Checked with a search of module/ and templates/ after the removals; other groups' work could still free or reuse some.)
New strings: `<scratchpad>/r10/lang-d.json` (`E20.RulesExtD.*`).

## Rule count

53 rules added on 45 items. Tests: `module/rules/engine10-d.test.js` (26) and `module/rules/conv10-slD10.test.js` (48).
