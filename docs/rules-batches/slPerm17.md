# Round 17 - perm (2026-10-07)

Scope: Trade School (still code after round 16 - docs/rules-batches/slLeftB16.md) and a re-check of the 121 items the legacy
survey called "permanent" (r17-permanent.json) against the engine as it stands after rounds 14-16. Converted: Trade School
(+ Technical Mastery's reach to the coached ally), Chrono-File Access, Betrayal. The other 119 stay code - one line each below.

## Engine features added 2026-10-07 (round 17, perm)

All new plug-in files are imported in `rules/plugins/index.mjs`'s "Round 17 (perm)" block. No new strings
(`E20.RulesExtPerm17` is empty).

### Marks that carry a die and a d2 crit (`plugins/marks/carried-die-and-crit.mjs`)

- **`DieSubstitution` and `CritOnD2` take `scope: "marked"` + `mark: "<key>"`** - the rule sits on the setter's item and
  reaches every creature carrying the setter's `<key>` mark (`rule-marks.mjs#carriedRules`), like the other marked rule
  types. Both are asked before the Roll Options Dialog (dice.mjs initialShift / canCritD2), so a RollModifier
  `consumeMark` on the same mark - spent once the roll is made - is still there when they are asked: "checked before the
  pending mark is used up" needs nothing more.
- **`DieSubstitution` `dieOf: "holder"`** - the Skill dice in `skills` are read off the rule's holder (for a marked rule,
  the setter) instead of the roller: "an ally can use your Technology die" is `{mode: best, skills: ["technology"], dieOf:
  holder, scope: marked, mark: ...}`. On the actor's own rule it is the actor's own dice. (`rules/adapter.mjs#ruleDieSubstitution`.)

### Marks set on the holder's behalf, beforeRoll through a mark

- **`mark {by: "holder"}`** (rules/steps.mjs) - the mark names the rule item's holder as its setter, not the actor the run
  acts as. In a Trigger a mark carries onto someone (`scope: marked`), the run acts as the carrier; `by: holder` lets that
  Trigger set a mark *for the setter* - which then carries the setter's other rules (Trade School's scene-long coaching,
  set at the coached ally's first Technology roll).
- **`beforeRoll` reaches mark-carried Triggers** (`plugins/rolls/before-roll-and-group-test-events.mjs`): the preRoll gate
  also looks at `linkedEntries(actor, 'Trigger')`, so a `beforeRoll` Trigger a mark (or any link) carries onto the roller
  fires. No existing beforeRoll Trigger had a linked scope, so nothing else changes.

### Reports (`plugins/shared/report-facts.mjs`, `plugins/combat/defense-facts.mjs`)

- **Step `attackFacts {of?: target | self}`** - the first target's (or the actor's) most damaging attack: of its weapon
  effects, the biggest printed `system.damageValue` (the first on a tie). `{var.attackName}` (or "none known" -
  `E20.ChronoFileAccessNoAttacks`), `@var.attackDamage` (0 with none). No target: stops with a "needs a target" line.
- **`defenseFacts`** now also keeps **`{var.highestDefenseName}`** ("Toughness"...) and **`@var.highestDefenseValue`**.
- **Text `{lang.<Key>}`** (a `registerTextRef`) - `E20.<Key>` localized and formatted with the run's vars plus `{name}`
  (the actor the run acts as) and `{target}` (the first target). A whole localized report or card text from one string:
  `chat {text: "{lang.ChronoFileAccessResult}"}`, `button {label: "{lang.O3BetrayalHeal}", intro: "{lang.O3BetrayalLine}"}`.
  Name the vars the string wants first (`setVar`, `listNames {var}`).

### rollSeen `@var.firstFailed` (`plugins/tags/world-watch.mjs`)

- `1` when the seen roll's first row failed, whatever the other rows did (`@var.failed` is "every row failed") - the
  hand-written `results[0].success === false` test (Betrayal).

Tests: `module/rules/engine17-perm.test.js` (7 tests); the items in `module/rules/conv17-perm.test.js` (13 tests).

## Verdicts

### Trade School (job 1)

| Item | Pack file | Verdict |
|---|---|---|
| Trade School | `qgtgitems/_source/Trade_School_yR5QrBHWNUnbuiG7.json` | converted (5 rules) |
| Technical Mastery | `qgtgitems/_source/Technical_Mastery_QKlXoVgNMq7Kv58L.json` | its Trade School half converted (1 rule added) |

What the rules do (matching the removed `items/rolls/trade-school.mjs`, `items/gear/qualification-perks.mjs`'s Trade School
section, banked-buffs.mjs's Use branch and dice.mjs's `consumeTradeSchool` block):
- **Use** (once per encounter - the old `tradeSchoolUsedThisEncounter` encounter window): `pickAlly` (any range, the same
  `pickAllyTargets` picker and "no ally" warning), then mark `tradeSchoolPending` on the ally (the old `pendingTradeSchool`
  bank; it waits across scenes until a Technology roll, and a second grant replaces the first).
- **Trigger `beforeRoll`, carried by the pending mark** - on the ally's Technology roll, unless a coaching record is live
  this scene: mark `tradeSchool` on the ally **by the coach** until the scene ends (the old `q2TradeSchool` {granterId,
  scene} record, never overwritten while live).
- **DieSubstitution carried by `tradeSchool`** - the better of the roll's die and the coach's Technology die (`dieOf: holder`).
- **RollModifier carried by `tradeSchool`** - Specialized while the coach's Technology is Specialized (`isSpecialized`, or a
  Specialization - `{any: [...]}`).
- **RollModifier carried by the pending mark** - Specialized on that first roll, and the roll uses the pending mark up
  (`consumeMark`, `consumeFrom: roller`).
- **Technical Mastery: CritOnD2 carried by the pending mark** - the coached ally may crit on the d2 on that first roll, read
  before the mark is used up (the old `canCritD2` from the original granter's Technical Mastery).

### The 121 "permanent" items (job 2)

| Item | Type | Verdict |
|---|---|---|
| Mind Beam | spell | permanent - a bespoke spell flow: a pre-roll Condition picker in documents/item.mjs and two custom statuses (Calm / Confused) with their own hooks (items/magic/mind-beam-calm-confused.mjs) |
| Time Bomb | upgrade | permanent - the planted-bomb subsystem (items/attacks/planted-bombs.mjs: plant, arm, Detonate button, proximity trigger); the id is the bomb kind |
| Proximity Bomb | upgrade | permanent - the planted-bomb subsystem (items/attacks/planted-bombs.mjs: plant, arm, Detonate button, proximity trigger); the id is the bomb kind |
| Detonator Bomb | upgrade | permanent - the planted-bomb subsystem (items/attacks/planted-bombs.mjs: plant, arm, Detonate button, proximity trigger); the id is the bomb kind |
| Elemental Projector | upgrade | permanent - the weapon Element subsystem: chosenElement() feeds derived damageType and generated Laser / Cold / Sonic alternates |
| Modular Standard Weapon | upgrade | permanent - Modular generated-alternates sync (copies another compendium weapon's effects through promptUpgradeChoice) |
| Modular Limited Weapon | upgrade | permanent - Modular generated-alternates sync (copies another compendium weapon's effects through promptUpgradeChoice) |
| Modular Restricted Weapon | upgrade | permanent - Modular generated-alternates sync (copies another compendium weapon's effects through promptUpgradeChoice) |
| Personal Shield | rolePoints | permanent - the Personal Shield Role Points subsystem (activate, 10-round timer, EMP shut-off, recharge test); the id is its identity check |
| Dino Thunder (Form) | perk | permanent - the Dino Thunder [Form] power subsystem (14 powers across roll / Defense / damage / derived hooks and canvas moves) |
| Dino Thunder Boost | power | permanent - the Dino Thunder [Form] power subsystem (14 powers across roll / Defense / damage / derived hooks and canvas moves) |
| Extra Dino Thunder Form Power | power | permanent - the Dino Thunder [Form] power subsystem (14 powers across roll / Defense / damage / derived hooks and canvas moves) |
| White Ranger Extra Dino Thunder | power | permanent - the Dino Thunder [Form] power subsystem (14 powers across roll / Defense / damage / derived hooks and canvas moves) |
| Emotional Mastery | perk | permanent - Emotional Mastery subsystem (user-listed: active-option state read across dice / combat / actor) |
| Team Spirit | perk | permanent - Emotional Mastery subsystem (user-listed: active-option state read across dice / combat / actor) |
| Heart's Calling | perk | permanent - Emotional Mastery subsystem (user-listed: active-option state read across dice / combat / actor) |
| Adaption 1 | perk | permanent - Emotional Mastery subsystem (user-listed: active-option state read across dice / combat / actor) |
| Adaption 2 | perk | permanent - Emotional Mastery subsystem (user-listed: active-option state read across dice / combat / actor) |
| Betrayal | hangUp | converted - rollSeen Trigger (new @var.firstFailed) marks the assister `betrayal` for the scene and posts the mend button; betrayal.mjs keeps only the ally-test reader |
| Mega Defender | perk | permanent - the Mega Defender form: derived overrides, actions shared with the Torozord through essence20.actionSpent, prior-Health restore |
| Spectrum Shifted | perk | permanent - a Role change (role-handler performSpectrumShift + spectrum-shifted.mjs Table 2-16) |
| Addicted (Dark Energon) | hangUp | permanent - the Dark Energon addiction subsystem (craving state, New Day / Consumed / Treatment, doubled spends, Essence damage) |
| Dark Energon | gear | permanent - the Energon strains subsystem: effects keyed on the actor's strain pools (energon-strains.mjs), not on holding the item |
| Primal Energon | gear | permanent - the Energon strains subsystem: effects keyed on the actor's strain pools (energon-strains.mjs), not on holding the item |
| Red Energon | gear | permanent - the Energon strains subsystem: effects keyed on the actor's strain pools (energon-strains.mjs), not on holding the item |
| Synth-En | gear | permanent - the Energon strains subsystem: effects keyed on the actor's strain pools (energon-strains.mjs), not on holding the item |
| Circle of Magical Friends | perk | permanent - the Friendship Circle subsystem (Party-actor flag, shared pools, tracker UI, turn-end expiry, Mastered-spell copies) |
| Friendship Circle | perk | permanent - the Friendship Circle subsystem (Party-actor flag, shared pools, tracker UI, turn-end expiry, Mastered-spell copies) |
| Best Friendship Circle | perk | permanent - the Friendship Circle subsystem (Party-actor flag, shared pools, tracker UI, turn-end expiry, Mastered-spell copies) |
| Gestalt Combiner | perk | permanent - the Combiner merge subsystem (user-listed: combiner-merge.mjs merge Use, costs, Reach, heal, focus checkbox) |
| Matched Combiner | perk | permanent - the Combiner merge subsystem (user-listed: combiner-merge.mjs merge Use, costs, Reach, heal, focus checkbox) |
| Universal Component | perk | permanent - the Combiner merge subsystem (user-listed: combiner-merge.mjs merge Use, costs, Reach, heal, focus checkbox) |
| Efficient Combination | perk | permanent - the Combiner merge subsystem (user-listed: combiner-merge.mjs merge Use, costs, Reach, heal, focus checkbox) |
| Invigorating Connection | perk | permanent - the Combiner merge subsystem (user-listed: combiner-merge.mjs merge Use, costs, Reach, heal, focus checkbox) |
| Macro-Magnetic Linkage | upgrade | permanent - the Combiner merge subsystem (user-listed: combiner-merge.mjs merge Use, costs, Reach, heal, focus checkbox) |
| Gestalt Hunter | perk | permanent - the Combiner merge subsystem (user-listed: combiner-merge.mjs merge Use, costs, Reach, heal, focus checkbox) |
| Defender Torozord | perk | permanent - Megaform actor creation and linking (GM actor creation with Defender / Core Body traits) |
| Issue Command | perk | permanent - the Issue Command subsystem (user-listed: commands.mjs dialog with presets, per-ally boosts, card buttons) |
| Complex Command | perk | permanent - the Issue Command subsystem (user-listed: commands.mjs dialog with presets, per-ally boosts, card buttons) |
| Follow My Lead | perk | permanent - the Issue Command subsystem (user-listed: commands.mjs dialog with presets, per-ally boosts, card buttons) |
| Minimize Casualties | perk | permanent - the Issue Command subsystem (user-listed: commands.mjs dialog with presets, per-ally boosts, card buttons) |
| The First Rule of Soldiering | perk | permanent - the Issue Command subsystem (user-listed: commands.mjs dialog with presets, per-ally boosts, card buttons) |
| Dubious Tactics | perk | permanent - the Issue Command subsystem (user-listed: commands.mjs dialog with presets, per-ally boosts, card buttons) |
| Lead From the Rear | perk | permanent - the Issue Command subsystem (user-listed: commands.mjs dialog with presets, per-ally boosts, card buttons) |
| No Excuses | perk | permanent - the Issue Command subsystem (user-listed: commands.mjs dialog with presets, per-ally boosts, card buttons) |
| On My Mark | perk | permanent - the Issue Command subsystem (user-listed: commands.mjs dialog with presets, per-ally boosts, card buttons) |
| Carrier | feature | permanent (reader) - carried Zords are system.actors entries read by combat.mjs#isCarried and the drop handler's capacity |
| Morphin Pet | perk | permanent - the companion builder (user-listed: companions.mjs grantPet / grantPerson / raiseDrone stat tables) |
| Altered | perk | permanent - the Alteration adjustment subsystem (cost-waiver ledger and lends in alteration-adjustments.mjs) |
| Additional Alteration | perk | permanent - the Alteration adjustment subsystem (cost-waiver ledger and lends in alteration-adjustments.mjs) |
| Chrono-File Access | power | converted - powerUsed Trigger: notify (no target) + defenseFacts + new attackFacts + {lang.ChronoFileAccessResult} |
| Monster... Grow! | power | permanent - the Grown-form token swap (monster-grow-swap.mjs) with a size-toggle fallback |
| Suppressing Fire | perk | permanent - the suppressive-fire zone subsystem (Region zones, -5 inside, entry / turn-start attack prompts) |
| Sneak Attack Damage | rolePoints | permanent - the Sneak Attack subsystem (eligibility, Role Points damage box, Predator table); the id is its identity check |
| Headmaster Body | perk | permanent - the bonded-partner subsystem (partner naming / creation, link toggle, bond flag) |
| Headmaster Head | perk | permanent - the bonded-partner subsystem (partner naming / creation, link toggle, bond flag) |
| Powermaster | perk | permanent - the bonded-partner subsystem (partner naming / creation, link toggle, bond flag) |
| Targetmaster | perk | permanent - the bonded-partner subsystem (partner naming / creation, link toggle, bond flag) |
| Animal Pet | perk | permanent - the companion builder (user-listed: companions.mjs grantPet / grantPerson / raiseDrone stat tables) |
| Robot Pet | perk | permanent - the companion builder (user-listed: companions.mjs grantPet / grantPerson / raiseDrone stat tables) |
| Animal Pet | perk | permanent - the companion builder (user-listed: companions.mjs grantPet / grantPerson / raiseDrone stat tables) |
| Night Vale Community Adoption Center | perk | permanent - the companion builder (user-listed: companions.mjs grantPet / grantPerson / raiseDrone stat tables) |
| Faithful Companion | perk | permanent - the companion builder (user-listed: companions.mjs grantPet / grantPerson / raiseDrone stat tables) |
| Robotic Animal Pet | perk | permanent - the companion builder (user-listed: companions.mjs grantPet / grantPerson / raiseDrone stat tables) |
| Direct Control | perk | permanent - the companion builder (user-listed: companions.mjs grantPet / grantPerson / raiseDrone stat tables) |
| Master Control Program | perk | permanent - the companion builder (user-listed: companions.mjs grantPet / grantPerson / raiseDrone stat tables) |
| Robotic Interactive Canine (R.I.C) | gear | permanent - the companion builder (user-listed: companions.mjs grantPet / grantPerson / raiseDrone stat tables) |
| Mini-Con Ally | perk | permanent - the Mini-Con subsystem (user-listed: grant, dock / deploy, shared Health / Defenses) |
| Multi-Purpose | perk | permanent - the Mini-Con subsystem (user-listed: grant, dock / deploy, shared Health / Defenses) |
| Reinforced Bond | perk | permanent - the Mini-Con subsystem (user-listed: grant, dock / deploy, shared Health / Defenses) |
| Emergency Deployment and Docking | perk | permanent - the Mini-Con subsystem (user-listed: grant, dock / deploy, shared Health / Defenses) |
| Additional Mini-Con | perk | permanent - the Mini-Con subsystem (user-listed: grant, dock / deploy, shared Health / Defenses) |
| Mini-Con Affinity | perk | permanent - the Mini-Con subsystem (user-listed: grant, dock / deploy, shared Health / Defenses) |
| Mini-Con Hub | perk | permanent - the Mini-Con subsystem (user-listed: grant, dock / deploy, shared Health / Defenses) |
| Mini-Con Master | perk | permanent - the Mini-Con subsystem (user-listed: grant, dock / deploy, shared Health / Defenses) |
| Reinforced Bond | perk | permanent - the Mini-Con subsystem (user-listed: grant, dock / deploy, shared Health / Defenses) |
| Human Companion | perk | permanent - the companion builder (user-listed: companions.mjs grantPet / grantPerson / raiseDrone stat tables) |
| Alien Companion | perk | permanent - the companion builder (user-listed: companions.mjs grantPet / grantPerson / raiseDrone stat tables) |
| Networker | perk | permanent - the Contacts subsystem (user-listed: contacts.mjs) |
| Networker | hangUp | permanent - the Contacts subsystem (user-listed: contacts.mjs) |
| Devious Alliance | perk | permanent - the Contacts subsystem (user-listed: contacts.mjs) |
| Emissary | perk | permanent - the Contacts subsystem (user-listed: contacts.mjs) |
| Fortified Bond | perk | permanent - the Contacts subsystem (user-listed: contacts.mjs) |
| Lasting Alliance | perk | permanent - the Contacts subsystem (user-listed: contacts.mjs) |
| Worthy Contact | perk | permanent - the Contacts subsystem (user-listed: contacts.mjs) |
| International Network | perk | permanent - the Contacts subsystem (user-listed: contacts.mjs) |
| Learned from the Best | perk | permanent - the Contacts subsystem (user-listed: contacts.mjs) |
| Contact: Combiner Team | perk | permanent - the Contacts subsystem (user-listed: contacts.mjs) |
| Contact: Nebulan Technician | perk | permanent - the Contacts subsystem (user-listed: contacts.mjs) |
| Hometown Hero | perk | permanent - the Contacts subsystem (user-listed: contacts.mjs) |
| Contact Connection | perk | permanent - the Contacts subsystem (user-listed: contacts.mjs) |
| Trusted Contact | perk | permanent - the Contacts subsystem (user-listed: contacts.mjs) |
| Sharkcycle Rider | power | permanent - the personal-vehicle summon subsystem (summons.mjs stat blocks, summon / place, arrival rounds, scene dismissal) |
| Galaxy Glider | power | permanent - the personal-vehicle summon subsystem (summons.mjs stat blocks, summon / place, arrival rounds, scene dismissal) |
| Jet Jammer | power | permanent - the personal-vehicle summon subsystem (summons.mjs stat blocks, summon / place, arrival rounds, scene dismissal) |
| Dino Raptor | power | permanent - the personal-vehicle summon subsystem (summons.mjs stat blocks, summon / place, arrival rounds, scene dismissal) |
| Time Jet | power | permanent - the personal-vehicle summon subsystem (summons.mjs stat blocks, summon / place, arrival rounds, scene dismissal) |
| Vector/Strata Cycle | power | permanent - the personal-vehicle summon subsystem (summons.mjs stat blocks, summon / place, arrival rounds, scene dismissal) |
| Summon Cycle | power | permanent - the personal-vehicle summon subsystem (summons.mjs stat blocks, summon / place, arrival rounds, scene dismissal) |
| Hitch A Ride | spell | permanent - the personal-vehicle summon subsystem (summons.mjs stat blocks, summon / place, arrival rounds, scene dismissal) |
| Riding Rig | perk | permanent - the personal-vehicle summon subsystem (summons.mjs stat blocks, summon / place, arrival rounds, scene dismissal) |
| Biker | perk | permanent - the personal-vehicle summon subsystem (summons.mjs stat blocks, summon / place, arrival rounds, scene dismissal) |
| Racer Abandon | perk | permanent (reader) - a switch the Renegade Perks' hand-written code reads (renegadeHolderFor, racerRecklessShifts, the renegadeVehicle scope) |
| Rigged Rider | perk | permanent (reader) - a switch the Renegade Perks' hand-written code reads (renegadeHolderFor, racerRecklessShifts, the renegadeVehicle scope) |
| Skybound | perk | permanent - the Jet Pack summon (personal-vehicle subsystem) + documents/actor.mjs loadout hands (vehicleHands) |
| Necroscientist | perk | permanent - summoned NPC actors (GM-relay actor creation, budgeted world-NPC picker, scene clean-up) |
| Allies From Below | power | permanent - summoned NPC actors (GM-relay actor creation, budgeted world-NPC picker, scene clean-up) |
| Battle Warrior | armor | permanent - the Battlizer summon subsystem (user-listed: equip, generated attacks, 1/scene attacks, movement AE, dismissal) |
| S.P.D. Battlizer | armor | permanent - the Battlizer summon subsystem (user-listed: equip, generated attacks, 1/scene attacks, movement AE, dismissal) |
| Red Fury Mode | armor | permanent - the Battlizer summon subsystem (user-listed: equip, generated attacks, 1/scene attacks, movement AE, dismissal) |
| Triassic Battlizer | armor | permanent - the Battlizer summon subsystem (user-listed: equip, generated attacks, 1/scene attacks, movement AE, dismissal) |
| Quantum Mega Battle Armor (Battlizer) | armor | permanent - the Battlizer summon subsystem (user-listed: equip, generated attacks, 1/scene attacks, movement AE, dismissal) |
| Rally Guardians | perk | permanent - companion Zord actor creation (createViaGm + setEntryAndAddActor) |
| Efficacy Adjustment | alteration | permanent - the kit subsystem (virtual kits spent until rest; the Mini-Con dock for Kitted Purpose) |
| Utility Adjustment | alteration | permanent - the kit subsystem (virtual kits spent until rest; the Mini-Con dock for Kitted Purpose) |
| Kitted Purpose | perk | permanent - the kit subsystem (virtual kits spent until rest; the Mini-Con dock for Kitted Purpose) |
| Take Mine | perk | permanent (reader) - the hand-over stamp is written by the createItem hook with the giving actor and read by every consumable's effect (kits.mjs#takeMineMultiplier) |
| Community Spirit | perk | permanent - Group Test card buttons (group-tests.mjs: per-test flags read by groupBonuses / tally) |
| Prior Experience | power | permanent - Group Test card buttons (group-tests.mjs: per-test flags read by groupBonuses / tally) |
| Create Chaos | perk | permanent - Group Test card buttons (group-tests.mjs: per-test flags read by groupBonuses / tally) |
| Spectrum Shift | perk | permanent - the Spectrum Shift dialog (Ranger level / colour swap) in perk-handler |

Converted in job 2:
- **Chrono-File Access** (`jttitems/_source/Chrono_File_Access_PDOUlIOgO7YoPVvm.json`, 1 rule) - a `powerUsed` Trigger
  (`item:own`): no target - the old warning toast `E20.ChronoFileAccessNoTarget`, nothing posted; else `defenseFacts`,
  `attackFacts`, `setVar hangUps`, and the old `E20.ChronoFileAccessResult` text through `{lang.}`. The Power cost is still
  paid by power-handler.mjs#powerCost before `onPowerUse`, as before. Removed: `items/senses/chrono-file-access.mjs` (+ test)
  and power-use.mjs's branch / id.
- **Betrayal** (`mlpcrbitems/_source/Betrayal_fhne6x3suULZL040.json`, 1 rule) - a `rollSeen` Trigger on the Hang-Up's
  holder: when the seen roll used its Lend Assistance (`self:uuidIsVar:assistedBy`) and its first row failed
  (`var:firstFailed=1`), mark `betrayal` on the holder until the scene ends and post the old card (`E20.O3BetrayalLine`,
  button `E20.O3BetrayalHeal`, speaker the betrayer). The button (anyone, as the presser's own character, pressable
  again): the betrayer not marked - info `E20.O3BetrayalNothing`; the presser is the betrayer - warn
  `E20.O3BetrayalNeedPc`; no Friendship Point - warn `E20.O3NoFriendshipPoint`; else spend 1, take the mark off, post
  `E20.O3BetrayalHealed`. `items/social/betrayal.mjs` keeps only the reader (`isBetrayed` reads the live mark;
  `betrayalSplits` unchanged for nearby-allies.mjs); its post-roll hook, chat button and the `O3.betrayal` id are gone.

Why the rest stays: 117 of the 119 sit inside a subsystem (its own state, dialogs, cards, actor creation, timers) whose
items are identity checks into it - the user-listed ones (Issue Command, Contacts, companion builder, Mini-Con, Battlizers,
Combiner merge, Emotional Mastery) and the same shape elsewhere (Dino Thunder, Energon strains, Friendship Circle, planted
bombs, personal vehicles, kits, Group Test cards...). Three are readers other code asks (Carrier, Racer Abandon / Rigged
Rider, Take Mine). Turning those id checks into one-off reader rule types would move the id, not the behaviour.

## Bugs found and fixed

None.

## Code vs notes - needs a ruling

- **Technical Mastery's reach** - the code gave the coached ally the d2 crit only on the roll that used up the pending
  grant (its first Technology roll), not for the rest of the coached scene; kept (questions.md).
- **Small behaviour shifts that came with the conversions:**
  - Trade School's pending grant is now used up when the roll is made; before, it went as the dialog opened, so a cancelled
    roll lost it. (The scene-long coaching still starts at that first roll, cancelled or not, as before.)
  - Betrayal's mark is written on the betrayer (through the GM relay when the roller's user doesn't own it); before, the
    record went on the roller's own actor, which also worked with no GM connected.
  - A Betrayal Hang-Up a Matured Perk ignores (`maturedIgnored`) no longer acts - the rules index skips it; the old `has()`
    counted it.
  - A player with no character and no selected token pressing the mend button gets no warning now (the press does
    nothing); before, `E20.O3BetrayalNeedPc`.
  - Chrono-File Access's report is the Trigger's card (headed by the rule's label), not postPerkUseChatCard's.

## Shared-file edits

- `module/rules/adapter.mjs` - ruleDieSubstitution reads `dieOf: holder` (one line + comment).
- `module/rules/steps.mjs` - `mark {by: holder}` (one line + comment).
- `module/rules/plugins/rolls/before-roll-and-group-test-events.mjs` - the preRoll gate also asks `linkedEntries` (+ import).
- `module/rules/plugins/combat/defense-facts.mjs` - `highestDefenseName` / `highestDefenseValue`.
- `module/rules/plugins/tags/world-watch.mjs` - rollSeen `firstFailed` (+ doc line).
- `module/rules/plugins/index.mjs` - the "Round 17 (perm)" block at the end.
- `module/dice.mjs` - the Trade School block and its import removed; `module/dice.test.js` - its describe removed.
- `module/mechanics/resources/banked-buffs.mjs` - Trade School id, import, canUse and Use branches removed;
  `banked-buffs.test.js` - its describe removed.
- `module/items/gear/qualification-perks.mjs` - the Trade School section, `TRADE_SCHOOL_FLAG`, its registrations and three
  imports removed; `module/items/tests/qualification-perks-old-hand.test.js` - its test and imports removed.
- `module/items/rolls/primary-quarry.mjs` - a comment pointing at the deleted file.
- `module/mechanics/characters/power-use.mjs` / `power-use.test.js` - Chrono-File Access branch, id, import, test.
- `module/items/shared/mlp-pr-tf-ids-and-skill-total.mjs` - `O3.betrayal` removed.
- `module/items/social/betrayal.mjs` - now the reader only; `module/items/tests/hidden-state-mega-defender-zones.test.js` -
  its Betrayal test reads the mark.
- Deleted (git rm): `module/items/rolls/trade-school.mjs` + `.test.js`, `module/items/senses/chrono-file-access.mjs` + `.test.js`.

## Unused strings

None (every Chrono-File Access and Betrayal string is used by the rules or the plug-ins).

## Rule count

8 rules added: Trade School 5, Technical Mastery 1, Chrono-File Access 1, Betrayal 1.
