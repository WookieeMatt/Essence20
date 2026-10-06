# Batch slD: reactions, resources and cross-line extension slices (`react`, `resource`, `other1`, `other3`)

**Scope:** every item in the id tables of `module/helpers/extensions/react/`, `resource/`, `other1/` and `other3/`,
plus every other place in `module/` that uses those ids. Code not keyed by an item id (reaction-card plumbing,
resource ledgers, the Hide toggle and so on) is out of scope; each part lists those files. The batch was done in four
parts on separate branches (`rules/slD-react`, `rules/slD-resource`, `rules/slD-other1`, `rules/slD-other3`), all
from `rules/slC` at a1291212, and merged into `rules/slD`. Each part's full write-up follows below, in the same layout
as the reg*.md files.

| Verdict | react | resource | other1 | other3 | Total |
|---|---|---|---|---|---|
| Convert | 0 | 0 | 1 | 0 | **1** |
| Partial | 1 | 1 | 0 | 0 | **2** |
| Skip | 30 | 28 | 27 | 25 | **110** |
| Items | 31 | 29 | 28 | 25 | **113** |

5 rules were added to 3 pack items (Inspirational Leader, History Buff, Evacuation Vents). Five id-table keys that
nothing read were removed (resource: Got To Get Tough, Desperate, Profit Director, Void Warrior; other3: Hidden In
Plain Sight). After the merge, `scripts/check-rules.mjs` counts 1368 rules on 975 items (slC left 1363 rules on 972
items), with 0 errors and 0 warnings. ESLint is clean and jest passes (502 suites; 9610 passed, 2 skipped).

No slice file became empty, so `extensions/index.mjs` is unchanged. The only merge conflict was the parts' test blocks
appended at the end of `module/rules/conversions.test.js`; all are kept.

**Behaviour differences** (all same-line; none cross-line; detail in each part):

- **Inspirational Leader (react):** a combat that reached round 1+ and then lost all its combatants exists but isn't
  "started"; the old code blocked the any-rank Lend Assistance there, the rule allows it.
- **History Buff (resource):** a roll carrying only a `specializationKey` now looks up that Specialization's name, so
  a History Specialization stored under an id-style key starts ticked (the old code searched the key text). New
  switch label; two copies of the Perk offer two switches.
- **Evacuation Vents (other1):** the chat card is fixed English rule text instead of the localized string (its
  `lang/en.json` key is removed); the button isn't offered while a combat exists but hasn't started (the old flag had
  no effect there); an old `o1Evacuating` flag is ignored (it only lasted one turn).

**Most common engine pieces the skips need, across all four parts** (each part's list has the detail):

- **A "reaction" rule:** a Use offered on another actor's posted check card, with steps that change it (negate a hit,
  lower the total, add a late Snag, turn a miss into a hit) - 14 of react's 30 skips.
- **Defender-side and other-actor events:** "an attack against me hit / missed / Fumbled" (with the margin), other
  actors' rolls and Defeats, and a `resourceSpent` event with `@spent` (Inner Conservation, Power Efficiency, Dino
  Charged, Fuel Efficient).
- **Chat-card buttons other players press,** and group tests.
- **Story Points and stress:** personal Story Points that expire and can be shared, `storyPointSpent` carrying the spend
  kind, Essence-damage healing and a Health-or-Essence choice step.
- **Durations:** `until: endOfNextTurn` (the target's turn), `until: {rounds: N}`.
- **Stored picks other rules compare against** (a chosen weapon or PC), marks that remember who set them, formula refs
  to the rolled item and the roll total, dice in formulas.
- **Steps:** delete a target's item, move / hide a token, retry the last roll, change Skill ranks or Essence maxima with
  an undo, repeat an attack, write Initiative, a confirmable pre-roll Skill swap.
- **Hit-card rider options from steps,** and Alteration lends / cost waivers in `alteration-handler.mjs`.
- **Smaller:** `check:computerizedGear` (also wanted by slC's Machinesmith), an equipped-items count tag, an incoming
  DialogSwitch, a "forbids" rule that refuses an item in every prerequisite mode, a flat result bonus on a roll.

---

## Batch slD (part): the `react` extension slice

**Scope:** every item in the id tables of `module/helpers/extensions/react/`, plus every other place in `module/`
that uses those ids. The tables are `REACT` (`reactions.mjs`, 15 keys), `TRIG` (`triggers.mjs`, 11 keys), `FORM`
(`forms.mjs`, 4 keys), `PATH` (`forms.mjs`, the 6 Psycho Path Roles Monster Morph reads) and `AURA` (`auras.mjs`, 3
entries). That is 39 entries: 33 items judged on their own, plus the 6 Path Roles, which only say which Monster Morph
rider applies. Branch `rules/slD-react`, from `rules/slC` at a1291212.

| Verdict | Items |
|---|---|
| Convert | 0 |
| Partial | 1 |
| Skip | 30 |
| Reference only | 2 items + 6 Path Roles |

This part added 1 rule to 1 pack item. After it, `scripts/check-rules.mjs` counts 1364 rules on 973 items (the base
was 1363 rules on 972 items), with 0 errors and 0 warnings.

Most of this slice is **shared reaction plumbing, not item behaviour**. These parts hold nothing keyed by an id and
are out of scope:

- `core.mjs`, all of it: card reading (`cardInfo`), the reaction-button registry and its chat decorator, claims,
  Contingency arming, `negateHit`, GM-carried operations (`gmDo` / `runOp`), the GM "Apply N damage" button,
  `lateSnag`, `rollVs` / `rollVsMany`, `convertRows` and `lastApplyContext`.
- `index.mjs` (imports only).
- In `reactions.mjs`: the `reactSnag` apply-dialog hook and the banked counter-attack (`bankCounter`, the
  `reactCounter` roll source and its consumer). Counterstrike and Steady Footing use them.
- In `triggers.mjs`: the `preUpdateActor` / `updateActor` drop-to-0 detection, the `reactBroken` chat hook, and the
  Secret Helper chat decorator, which reads the `secretHelperAssist` flag set by `chat.mjs`, not an id.
- In `forms.mjs`: registering the `calm` / `confused` statuses, Calm's ↑2 on Social Skill Tests against a Calm
  target, and Calm ending on damage. All of these are keyed by status id, not item id.

Nothing was removed from the id tables. Inspirational Leader keeps its `TRIG` key, because its in-combat half still
reads it. No slice file became empty, so `extensions/index.mjs` and the slice's test file stay.

### Converted (0)

None.

### Partial (1)

| Item | Converted | Rule | Still code |
|---|---|---|---|
| Inspirational Leader | Lend Assistance at any Skill rank outside combat: `hooks-in.mjs#inspirationalLeaderAssist`, which was pushed into `lend-assistance.mjs`'s `ASSIST_RANK_BYPASSES` at setup | Assist `{side: "give", effect: "anyRank", when: ["not:combat", "not:combat:round:0"]}` | The in-combat half (`triggers.mjs`): a successful roll stores `inspiringSkill`, and allies get a ↑1 roll source on that Skill for the rest of the round. |

Why the rule is exact: the old bypass returned `!game.combat && actorHasPerk(actor, IL)`, with no check on the ally
or the Skill. `canAssistWithSkill` reads `ruleAssist(...).anyRank` on the same line as the rank comparison, after the
refusal check, exactly where every bypass used to sit after that check. Every bypass returns `true`, so moving this
one ahead of Voice of Primus / Remote Operations / Command & Control changes nothing. Voice of Primus is used up
later, in `bankSkillAssistBonus`, whichever bypass let the assist through. Both tags read `game.combat`. `combat`
means `game.combat?.started` and `combat:round:0` means `round == 0`. With no combat both are false, so both
`not:` tags hold. A combat that exists but hasn't started has round 0, and a started combat has `started`, so in
both cases the rule doesn't apply, just as `!game.combat` was false.

Removed: `inspirationalLeaderAssist` and its install block in `hooks-in.mjs`, plus the now-unused `actorHasPerk` and
`TRIG` imports. `hooks-in.mjs` now installs only Agency's Fumble hook. Also removed: the two
`inspirationalLeaderAssist` assertions in `react.test.js`. The test now resets `game.combat` to `null` at its end,
which the removed assertions used to do. The replacement test is in `module/rules/conversions.test.js`
(`// slD react`).

### Behaviour differences

1. **Inspirational Leader: a degenerate combat (same item, same line).** Foundry's `started` is
   `turns.length > 0 && round > 0`. Take a combat that reached round 1 or later and then lost every combatant. It
   exists, so the old bypass was off. But it isn't `started` and its round isn't 0, so the rule now lifts the rank
   gate. No other state differs.
2. **Inspirational Leader: other printings / copies.** The old check was `actorHasPerk` on one uuid. The rule is on
   the item, so a copy with these rules counts whatever its uuid is. There is one Inspirational Leader in the packs.
   An inactive item (a matured-ignored Hang-Up) wouldn't count, but this is a Perk, so that never applies.

There are no cross-line differences.

### Skipped (30)

#### Card reactions (`reactions.mjs`): a button on someone else's posted check card

All of these need the same missing piece: **a reaction rule.** That is a Use offered on another actor's check card
(per target row or per card), seen by the reactor's owners, and claimed once. Its context needs the card's total, rows,
damage and crit, and its steps need to change that card's result (negate a hit, lower the total, a late Snag, convert
a miss into a hit with a damage button). The `hit` / `miss` Triggers fire only for the roller, never for whoever was
attacked.

- **Desperate Parry.** A once-per-turn Free Use arms a Contingency until the next turn starts. On a melee hit against
  the holder, a choice of Acrobatics or Finesse is rolled against the attack's total. On a success the hit is negated
  and the wielded weapon breaks. *Needs:* a reaction rule, a "break the wielded weapon" step, and the arming Use, which
  only works together with the reaction that reads it.
- **Point-Defense Reflexes.** Card-scope, offered to every armed holder world-wide on an explosive or thrown attack.
  Holders need a wielded Targeting weapon. It rolls Targeting against the attack's total, with a Snag if fired inside
  normal range (asked), and a success negates every row. *Needs:* a reaction rule, plus a "Snag on the reaction's own
  roll" option.
- **Advanced Anti-Air Training.** Its Edge half is already a rule. What's left is removing Point-Defense's
  close-range question, which lives inside that reaction and goes with it.
- **Legendary Cruelty.** Once per turn, when an attack against the holder misses, it rolls Intimidation against the
  attacker's better of Willpower and Cleverness, and a success gives a GM button for 1 Psychic damage. *Needs:* a
  defender-side "attack missed me" event, a `roll` step DIF of "best of these Defenses", and a GM damage button step.
- **Projectile Deflector.** The first projectile hit by a Threat per encounter. It rolls Finesse against the total.
  A success negates the hit, and a crit sends the damage back as a GM button. *Needs:* a reaction rule (negate) and a
  "crit" branch with a damage button.
- **Steady Footing (counter half).** When a Maneuver or Grapple attack against the holder Fumbles, the holder gets a
  free attack against that attacker with ↑1. *Needs:* a defender-side event on the attacker's Fumble, and a bank tied
  to one target. The ↓1 half is already a rule.
- **Not Perfect, But Better / That's Right, Perfect.** Once per scene, when an ally fails (or makes) a roll, spend a
  Story Point to turn it into a success / crit, with damage buttons for an attack. *Needs:* a reaction rule on an
  ally's card, and a "convert rows" step.
- **Sidestep.** On an area attack against Evasion that hits, pay 1 Personal Power and lower the total by the
  Acrobatics die. *Needs:* a reaction rule, a "roll a Skill Die" amount, and a "lower the card's total" step.
- **Defender (PR General Perk).** Offered to a holder within 5 ft of an ally hit in melee. The holder needs a wielded
  Finesse weapon and a Finesse Specialization. It lowers the total by the Finesse die. *Needs:* the same as Sidestep,
  plus reactor discovery over allies within 5 ft.
- **Defender (Megaform Trait).** The piloting Ranger of a Combiner participant with the Trait pays 1 Power for a late
  Snag. The id table is also matched by `system.type == 'defender'`. *Needs:* a reaction rule with a late Snag, and
  reactor discovery through Megaform membership.
- **Not On My Watch (TF).** Once per combat, after an enemy succeeds without an Edge, a social roll against the
  matching Defense forces a late Snag. *Needs:* a reaction rule on an enemy's card, and a late-Snag step.
- **Shoot Out.** Once per turn, against a ranged attack, a contested roll with a wielded ballistic weapon's Skill. A
  win negates the hit, and losing turns a miss into a hit. *Needs:* a reaction rule, plus a contested-roll step.
- **Soldier On.** Once per encounter, on a crit hit, Brawn against 10 + the damage negates it. *Needs:* a reaction
  rule, plus the card's damage in formulas.
- **Counterstrike (DD).** Once per round, when a melee attack against the holder misses by 5 or more, the holder gets
  a free melee attack against that attacker at ↓1. *Needs:* a defender-side miss event with the margin, and a bank tied
  to one target. `bonusAttack` covers the free attack.

#### Other actors' events (`triggers.mjs`)

- **Junker (Hang-Up).** In combat, the holder takes a Snag on their next roll after any gear breaks or a
  vehicle/Zord drops to 0. *Needs:* a world-wide "equipment broke" event. A `bank` step with a Snag could then do the
  rest.
- **Not On My Watch (IA, movement half).** When an ally drops to 0 Health, the holder gets a whispered button for an
  extra Move action. *Needs:* a Trigger on another actor's `defeated` (an ally-scope event, not an aura over the
  holder's own), a chat button, and a "grant actions this turn" step. The +1 Defense half is already a rule.
- **All For One.** Once until rest, on dropping to 0 Health or 0 Personal Power, buttons let each teammate give 1
  Health or 1d2 Power. *Needs:* a drop-to-0 Power event, chat buttons pressed by other players, and dice in formulas.
- **Agency (Hang-Up).** No Story Point for a Fumble in the agency's Skill (`suppressesFumbleStoryPoint`, through
  `dice.mjs` `FUMBLE_STORY_POINT_SUPPRESSORS`). *Needs:* a rule type, or a `RollModifier` option, read by that
  Fumble grant.
- **Their Loss, My Gain.** Heals by the Loss and Gain amount when a character within 60 ft Fumbles. *Needs:* a Trigger
  on other actors' rolls within N ft.
- **Cruel Conflagration.** A character within 15 ft fails or Fumbles, and the holder gets whispered buttons to spend
  Power for Impaired and/or 2 Psychic. *Needs:* a Trigger on other actors' rolls, plus chat buttons with costs.
- **Energon Manipulator.** Heals 1d2 when the holder's attack Defeats a Cybertronian (found through
  `lastApplyContext`), plus a Use for the "destroyed Energon" case. *Needs:* dice in formulas (`1d2`), which also
  blocks the Use half on its own, and an attacker-side "I defeated someone" event.
- **Revengeful.** A Story Point when the ↑1 attack Defeats its target. *Needs:* an attacker-side "defeated a target"
  event that reads `dice.mjs`'s `pendingRevengeful`. The ↑1 window (`dice.mjs` `REVENGEFUL_ID`) is core code tied to
  that flag.

#### Forms and states (`forms.mjs`)

- **Monster Morph.** The riders depend on which Psycho Path Role is held (`PATH`), and apply while
  `monsterFormActive` is set. Cruelty / Frost: after 2+ damage from an attack, a single roll against every creature
  within 10 ft (`rollVsMany`). Flame / Thorns / Venom: on a melee hit, a whispered follow-up roll against the target's
  better of Toughness and Evasion. *Needs:* a roll step against many targets' Defense at once, a "best of Defenses"
  DIF, and chat buttons. (`check:monsterForm` exists, so the gate could be expressed.)
  `items/forms/monster-morph.mjs#MONSTER_MORPH_ID` is core code (form toggling) and stays.
- **Iron Bravado (share half).** Pay 1 Power to give allies within 30 ft the holder's current Condition immunities
  until the holder's next turn. *Needs:* a step that copies a computed immunity list onto other actors with an expiry.
  The `dice.mjs` `IRON_BRAVADO_ID` stamp stays core code.
- **Cyborg.** The GM is asked whether damage goes to Essence instead, and Health can't be healed while there is
  Essence damage. *Needs:* a damage-redirect rule with a prompt, and a heal lock.
- **Mind Beam.** The first effect cast becomes the default, and other effects cost ↓1. A success applies that status
  for 3 rounds. *Needs:* a rule reading the spell's pre-roll effect choice (`documents/item.mjs` / `dice.mjs`
  `MIND_BEAM_ID`, which stay core code), and an item flag remembered on first use.

#### Offensive-defense armor Upgrades (`auras.mjs`)

- **Energized, Spiked, Energy Field.** When a melee attack at plain Reach targets the wearer, the ATTACKER's dialog
  gets a select: take ↓2 (↓1 for Spiked), or let the wearer strike back (a whispered button: Might or Finesse against
  the better of Toughness and Evasion, 1 damage of the chosen element). *Needs:* an incoming DialogSwitch (DialogSwitch
  has no `incoming` scope), a "plain Reach" attack tag, a strike-back chat button, and an element chosen once and kept.

### Reference only

- **Agency (Perk).** Read for its chosen Skill by the Agency Hang-Up. Its own behaviour is already rules.
- **Loss and Gain.** Gives the heal amount for Their Loss, My Gain.
- **The 6 Psycho Path Roles (`PATH`).** Pick the Monster Morph rider.

### Engine pieces the skips need

1. **A reaction rule.** That is a Use offered on another actor's posted check card (per row or per card), with the
   card's facts as context and steps that act on the card: negate a hit, lower the total, a late Snag, or convert
   rows. This covers 14 of the 30 skips.
2. **Defender-side events:** "an attack against me hit / missed / Fumbled", with the margin.
3. **Triggers on other actors' rolls and Defeats** within N ft or among allies. Examples: Their Loss, Cruel
   Conflagration, Not On My Watch, Junker's "gear broke", and an attacker-side "I defeated someone".
4. **Dice in formulas** (`1d2`): Energon Manipulator, All For One.
5. **Roll steps:** a DIF from the best of several Defenses, and one roll against many targets.
6. **Chat buttons** pressed by the holder later or by other players, including GM damage buttons.
7. Smaller pieces: a Fumble-Story-Point suppressor rule, an incoming DialogSwitch, sharing Condition immunity with an
   expiry, damage redirected to Essence, and a heal lock.

### Files touched outside the slice

- `packs/atsitems/_source/Inspirational_Leader_JH6xyTYUHCxAKkTP.json`: the Assist rule (text insertion, LF kept).
- `module/rules/conversions.test.js`: the `// slD react` block, appended at the end. The import line is unchanged.
- `module/mechanics/actions/lend-assistance.mjs`: **not changed.** `ASSIST_RANK_BYPASSES` and its loop now have no entries.
  They're left as an extension point, so other parts don't conflict.

---

## Batch slD (part): the `resource` extension slice

**Scope:** every item in the id table of `module/helpers/extensions/resource/` (`IDS` in `common.mjs`, 36 keys), plus
the one compendium uuid written inline in `energon.mjs` (Word of Unicron, in the Dark Energon addiction roll). Each
item was checked against the slice's code and every other use of its id in `module/`. Those other uses are
`items/healing/got-to-get-tough.mjs` (Got To Get Tough), `mechanics/characters/power-use.mjs` (Void Warrior), `mechanics/characters/perks.mjs` (This,
I Command's Upshift half), `mechanics/resources/banked-buffs.mjs` and `items/forms/beast-mode.mjs` (Beast Mode), `dice.mjs` (We
Improvise's Story Point grant), `items/attacks/retrogen.mjs`, `other1/alterations.mjs` and `gij1/perks.mjs` (the three
Mutation Perks), and `other1/more.mjs` / `qualify1/common.mjs` (Addicted (Dark Energon)). Branch `rules/slD-resource`,
from `rules/slC` at a1291212.

| Verdict | Items |
|---|---|
| Convert | 0 |
| Partial | 1 |
| Skip | 28 |

That is 29 items with behaviour in this slice. The table also holds:

- **Reference only (4):** Engrafted Mutation, Evolving Mutation and Outright Mutation are the uuids Beast Mode's
  packages grant. Addicted (Dark Energon) is the Hang-Up the addiction attack grants, and its presence stops further
  attacks. They stay with the code that reads them.
- **Unused keys (4), removed:** `gotToGetTough`, `desperate`, `profitDirector` and `voidWarrior`. No code in the slice
  read them. Got To Get Tough's grant is `items/healing/got-to-get-tough.mjs`, which keys on its own constant and calls this
  slice's `recordTempHealth`. Desperate and Profit Director are Active Effects on the pack items
  (`system.skills.wealth.shiftDown` / `shiftUp`). Void Warrior is activated by `mechanics/characters/power-use.mjs`. The
  regain block and scene-end clear in `power-spend.mjs` read the actor flag `voidWarriorActive`, not the id.

**Files with no item-specific behaviour:** `common.mjs` (the id table and Foundry wrappers) and `index.mjs` (imports).
Some code in other files is not keyed by an id either, so it is out of scope:

- `temp-resources.mjs`: the temporary Health/Energon ledger and its damage, Defeat and scene-end revokes.
- `energon.mjs`: the Energon spend choke point; the Dark / Red / Primal / Synth-En strain effects, which read
  `system.energon.<strain>.value` and actor flags; the Dark Energon reroll and the addiction ladder.
- `power-spend.mjs`: the Personal Power choke point and Void Warrior's flag-based regain block.
- `story-spend.mjs`: the We Improvise ledger's pool-spend counter.
- `mlp.mjs`: the Stress healing helpers, the Rest reset of daily uses, the jam's roll sources (they read actor flags)
  and the Circle spell sweep.

This slice added 2 rules to 1 pack item. After it, `scripts/check-rules.mjs` counts 1365 rules on 973 items
(`rules/slC` had 1363 on 972), with 0 errors and 0 warnings.

#### Converted (0)

None.

#### Partial (1)

| Item | Rules | Why it is exact | What stays code |
|---|---|---|---|
| History Buff | Two DialogSwitches, `upshift: 2`, `forget: true`, label "History test (History Buff: ↑2)". The first has `default: true` and `when: ["skill:culture", "roll:specialization~history"]`. The second starts unticked and has `when: ["skill:culture", "not:roll:specialization~history"]` | The old `registerDialogToggles` entry offered one checkbox on Culture rolls only (`rolledSkill == 'culture'`). It started ticked when the Specialization text contained "history" and was never remembered. `registerApplyDialog` added ↑2 when it was ticked. The two conditions exclude each other, so exactly one switch is offered on a Culture roll and none otherwise. It starts ticked in the same cases, `forget` means it is never remembered, and ticked it adds ↑2 to `shiftUp` in `applyRuleSwitches`. This is the same shape as Time Force's pre-ticked switch (slA). Removed: the toggle and apply-dialog registrations in `story-spend.mjs`, their two now-unused imports, and `E20.ResHistoryBuffToggle`. | The Use button that rolls the Continuum Anomaly risk die one size smaller. It is a GM-only roll from a select list with a result-band reading, and `pr1/jtt.mjs` shares its `RISK_DICE` / `anomalyBand` |

#### Behaviour differences

1. **History Buff's pre-tick with a key-only Specialization** (same-line: the item itself). The old check
   lower-cased `specializationName ?? specialization ?? specializationKey` and looked for "history" in it. When a
   roll carried only a `specializationKey`, it tested the **key** text. `roll:specialization~` looks up that key's
   Specialization **name** on the rolled Skill. A History Specialization stored under an id key (the usual case)
   now starts the switch ticked, where the old code left it unticked unless the key itself contained "history".
2. **Dialog name and label** (same-line). The switch is named by rule id (`ext-rule-<item>-<n>`), not `resHistoryBuff`.
   Its label is "History test (History Buff: ↑2)", not the old "History Buff: this is a History test (↑2)".
3. **Duplicate copies.** Two copies of the Perk now offer two switches (↑2 each). The old code offered one switch for
   any number of copies. Two copies of one Perk are not an ordinary build.

The old History Buff toggle had no test of its own. The kept test "History Buff rolls one die smaller" covers the Use
half, and the registration test still lists History Buff's Use. The new test is the `slD resource` block at the end of
`module/rules/conversions.test.js`.

#### Skipped (28)

##### Ruthless Points, Wealth Tests, Motor Pool

- **Play Favorites** and **Play Favorites Against Each Other.** A Use button assigns a personal Story Point record
  with a turn-end countdown. It can be shared between two allies and spent before the pool by `story-points.mjs`.
  The Against version changes the cost to a Move action and offers sharing. *Needs:* a personal Story Point resource
  (records with an expiry, shared ids, spent before the pool).
- **This, I Command** (the Ruthless Point half). It is a prompt inside Play Favorites that doubles the points for 1
  Psychic damage. It goes with Play Favorites. The Upshift half is `mechanics/characters/perks.mjs`, outside this slice.
- **Ruthless Efficiency.** Any same-type actor ending a turn with an unspent point gives every holder a point at the
  start of their next turn. *Needs:* a Trigger on another actor's turn end, plus the personal points above.
- **Money Talks** and **Capable Freelancer.** Before a Requisition roll, a button prompt can turn the roll into a
  Wealth Test. That rewrites `dataset.skill`, drops the Essence, folds in the Wealth skill's shifts and sets
  `requisitionSkill` / `isWealthRequisition`. *Needs:* a confirmable pre-roll Skill swap (SkillSubstitution
  `ask: true` with a `roll:requisition` tag) that also rewrites those dataset fields.
- **Motor Pool Connections.** A Use button picks a vehicle (crewed or owned), then an upgrade within a per-vehicle,
  per-mission budget, rolls Driving or Technology against the Availability DIF and installs the upgrade on the vehicle.
  *Needs:* a vehicle picker, a budget limit keyed per picked actor, `pickGrant` with a cost filter and a DIF from the
  picked entry, and a grant onto another actor.

##### Personal Power and Energon spends

- **Inner Conservation**, **Power Efficiency** and **Dino Charged.** These run on any decrease of
  `system.powers.personal.value` that isn't marked as a loss or a refund. Inner Conservation refunds half (once per
  scene, after a prompt), Power Efficiency refunds 1 on a d4 roll of 4, and Dino Charged takes the amount spent from a
  chosen Essence while Morphed. *Needs:* a `resourceSpent` Trigger event (path, amount as `@spent`, ignoring
  loss/refund writes), plus an Essence-damage step for Dino Charged.
- **Fuel Efficient.** One d4 per Energon point spent, refunding each 4. Rest updates don't count. *Needs:* the same
  `resourceSpent` event, plus a per-point roll loop.
- **Body of Energy.** It is a damage modifier that moves damage past the last point of Health into Power while
  Morphed, and a Use button that moves Health into Power (with a number pick). On unmorph, Health and Power each
  become half the pool. *Needs:* a pooled-resource damage modifier, an unmorph Trigger condition that reads the
  pre-update values, and a split step.
- **Repair Progress (Bonus Energon Point).** On creation it adds 1 Energon over the maximum. The point is marked spent
  the first time Energon drops from above the maximum, a Rest leaves an unspent point on top, and the temporary-Energon
  revoke allows for it. *Needs:* an `added` Trigger with a gain that can go past the maximum, a "spent from over the
  maximum" event and a Rest hook that adds to the capped value.

##### Energon strains

- **Dark Energon**, **Primal Energon**, **Red Energon** and **Synth-En** (the items' Use buttons). The button consumes
  a dose (quantity −1, +1 or +2 points). It can also awaken Primal for the scene, spend Red or unstable Synth-En for
  this turn, or roll Science DIF 16 to stabilize Synth-En. A Dark dose also runs the addiction attack. *Needs:* a
  quantity-spend step, scene/turn stamps that the strain roll sources read (a `mark` with `until: turn` on self and a
  matching tag would cover Red), and an addiction-attack step. The strain sources, dialog toggles and reroll read the
  actor's Energon values, not the items, so they are out of scope.
- **Word of Unicron** (the addiction-attack Snag, inline uuid in `energon.mjs`). The addiction roll is a raw
  `Roll` in code (`2d20kl` instead of `1d20`), not a Skill roll, so no RollModifier reaches it. Its pack
  RollModifier (Persuasion / Deception ↓2) is from an earlier round. *Needs:* the addiction attack as a rule-visible
  roll.

##### Temporary resources and Story Points

- **Together We Stand.** At round 1 of a combat with two or more teammates (Party roster, combatants), every teammate
  gets 1d2 temporary Health and 1d2 temporary Energon. Both are recorded in the ledger and revoked at scene end, and
  each teammate gets only one grant however many holders there are. *Needs:* a party-scoped `combatStart` Trigger with
  a "two or more team members in combat" condition, per-recipient de-duplication, and a ledger-recording temporary
  heal (`heal {temporary}` neither raises the current value nor ends with the scene).
- **Think Fast!** The Story Points tracker's "equipment" spend fires `essence20.storyPointNarrative`. A 5+ on a d6
  regains the point. *Needs:* `storyPointSpent` to carry the spend kind (a `spend:equipment` tag), plus a
  `gainResource {storyPoints}` that asks the GM.
- **We Improvise.** The point is granted in `dice.mjs`. This slice keeps a per-combat ledger of grants and pool spends
  and, when the combat is deleted, takes back the unspent ones. *Needs:* a per-combat resource ledger and a
  `combatEnd` step that removes pool points up to the unspent count.

##### Beast Mode

- **Beast Mode** (the 10th/20th-level packages and scene end). When `items/forms/beast-mode.mjs` sets its grant flag,
  this offers a level-gated choice of packages. It can replace the first grant and grants the extra Mutation copies,
  then removes them when the flag clears or the scene ends. *Needs:* a choice with level-gated options, a "replace the
  tracked grant" step and an `until: scene` grant tied to a flag.

##### My Little Pony

- **Honest Compassion.** A Use (Standard action, 1 per Rest, 3 at 11th level) heals 1 Stress on the target or self:
  Health or Essence damage, asked only when both are damaged. *Needs:* a heal-Essence-damage step and a "Stress"
  choice that asks only when both kinds are damaged. A `rest` limit with `max` as a formula would cover the uses.
- **Musical Interlude.** On the pony's first turn of each combat it posts a chat card with "sang / Health / Essence"
  buttons. The buttons apply 1 Stress. *Needs:* chat-card buttons run by rules, plus a once-per-combat `turnStart`.
- **Camper** (the camp; its Survival Edge is already a rule). A Use (at half Health or more) sets a scene-long camp
  and heals each teammate 1 Health or 2 Essence damage (asked). While it lasts, every teammate (the holder included)
  gets ↑1 on every roll if the holder is still at half Health. *Needs:* a scene-window toggle that a party-scoped
  RollModifier can read with `holder:` tags, and the Stress heal above.
- **Zap Apple Jam.** A Use with cups/pastries counters on the item flags (eat / bake / barter / pastry). It heals
  Essence damage, sets a scene Edge or a this-turn Edge (the next Skill Test out of combat), and the item spoils after
  the following mission. *Needs:* item-flag counters, an Essence heal, a "next roll or this turn" Edge bank and a
  mission-end expiry.
- **Circle of Magical Friends.** While a Friendship Circle is live, a Use copies every member's spells to the members
  who lack them. The copies are swept when the Circle ends. *Needs:* a Circle-members recipient and a "copy items
  from another actor until X" step.
- **Extensive Research.** A Use picks a spell the Spellcasting die can research and grants it for a week of world
  time. It replaces the previous researched spell. *Needs:* `pickGrant` filtered against the actor's Skill die and a
  world-time expiry on the grant.

#### Engine pieces the skips need

- **A `resourceSpent` Trigger event** (path, amount as `@spent`, ignoring loss/refund writes): Inner Conservation,
  Power Efficiency, Dino Charged, Fuel Efficient, and part of Repair Progress.
- **Stress steps:** heal Essence damage, and a Health-or-Essence choice that asks only when both are damaged: Honest
  Compassion, Camper, Zap Apple Jam, Musical Interlude.
- **Personal Story Points** (records with expiry and sharing, spent before the pool): Play Favorites x2, This, I
  Command, Ruthless Efficiency.
- **`storyPointSpent` with the spend kind**: Think Fast!.
- **A confirmable pre-roll Skill swap** that rewrites the dataset: Money Talks, Capable Freelancer.
- **Ledger-recorded temporary resources** that end with the scene: Together We Stand.
- **Other:** a quantity-spend step and turn/scene stamps for the Energon strains; a rule-visible addiction roll (Word
  of Unicron); chat-card buttons (Musical Interlude); per-combat ledgers (We Improvise); level-gated choice packages
  (Beast Mode); a vehicle picker and a per-target budget (Motor Pool); Circle recipients, item copies and world-time
  expiry (Circle of Magical Friends, Extensive Research).

#### Files touched outside the slice

- `packs/jttitems/_source/History_Buff_b3O5i3HMtaIHl6PD.json`: a new `rules` array as the first key of `system` (LF,
  inserted as text).
- `lang/en.json`: `E20.ResHistoryBuffToggle` removed (one line, edited as text).
- `module/rules/conversions.test.js`: one `describe('slD resource')` block appended at the end, under a
  `// slD resource` header. The import line is unchanged.

In the slice: `common.mjs` lost the four unused keys. `story-spend.mjs` lost the History Buff toggle and apply-dialog
registrations and their imports (`registerApplyDialog`, `registerDialogToggles`). Its header comment now says the ↑2
is the Perk's rules. No slice file became empty, and `resource.test.js` is unchanged.

---

## Batch slD (part): the `other1` extension slice

**Scope:** every item in the id tables of `module/helpers/extensions/other1/`: `O1_JTT` (`jtt.mjs`), `O1_ALT`
(`alterations.mjs`), `O1_CC` (`cobra-gear.mjs`) and `O1_MORE` / `RITE_COPIES` (`more.mjs`). It also covers every other place
in `module/` that uses those ids: `mechanics/combat/token-movement.mjs` (Evacuation Vents), `dice.mjs` (Savant Skill's d20+d4 and
Unlucky (For You)'s Snag), `mechanics/resources/banked-buffs.mjs` and `items/defenses/lance-of-light.mjs` (Lance of Light's toggle), and
`gij2/perks.mjs` (it imports `hasComputerizedGear`). Branch `rules/slD-other1`, from `rules/slC` at a1291212.

| Verdict | Items |
|---|---|
| Convert | 1 |
| Partial | 0 |
| Skip | 27 |

That is 28 items with behaviour of their own: 10 in `jtt.mjs`, 6 in `alterations.mjs`, 7 in `cobra-gear.mjs`, and 5 in
`more.mjs` (the three Armor Matrix printings count separately). Some table entries are only references, not items with
behaviour of their own:
- the Riot Shield (Thick Hide's granted copy);
- the six Alteration Perks Cybernetic Part, Engrafted Mutation, Enhanced Part, Evolving Mutation, Optimized Part and
  Outright Mutation. They are Additional Alteration's tier grants. Cybernetic / Enhanced / Optimized Part also count as
  computerized gear in `hasComputerizedGear`, and their own behaviour belongs to gij1;
- Personal Shield, Close Combat Blade and Close Combat Bludgeon (Shield Fighter's pool and weapons);
- Addicted (Dark Energon) (Eat the Weak's target).

2 rules were added to 1 pack item. `scripts/check-rules.mjs` now counts 1365 rules on 973 items, with 0 errors and
0 warnings. ESLint is clean and jest passes (502 suites; 9608 passed, 2 skipped).

No slice file became empty.

### Converted

- **Evacuation Vents** (`packs/jttitems/_source/Evacuation_Vents_Tft06zzgFsVCx2B7.json`)
  - A Use rule (`when: ["combat", "self:morphed"]`, no cost) puts a `mark` `evacuationVents` on the actor with
    `until: "endOfTurn"` and posts its line.
  - A MovementAction `{pushUnlimited: true, when: ["self:marked:evacuationVents"]}` lifts the Push cap.
  - The `endOfTurn` stamp is {combatId, round, turn}. It runs out as soon as the combat's current turn changes, for
    anyone. That is exactly the old `${combat.id}.${combat.round}.${combat.turn}` key compare in `getPushRules`. The
    rule sets `capMultiplier` to Infinity in the same function, after Improve Aerodynamics and before the Sprint
    halving, as the removed block did.
  - Removed: the `o1EvacuationVents` Use and `evacuationKey()` in `jtt.mjs`, the `evacuationVents` id-table key, the
    flag-reading block in `token-movement.mjs#getPushRules`, and the `O1EvacuationVents` string. The old code had no
    tests. The new test is in `conversions-uses.test.js` under `// slD other1`.

### Behaviour differences

- **Evacuation Vents, same-line:** the button is no longer offered while a combat exists but has not started. The old
  button worked then, but it changed nothing: Push is only planned on the token's own turn (`game.combat.combatant`),
  and starting the combat changes the round/turn key. So the old flag could never take effect.
- **Evacuation Vents, same-line:** the chat card is now the rule's title line (`Evacuation Vents: Vent away from the
  enemy this turn`) plus unlocalized `chat` step text, in place of the localized `O1EvacuationVents` string.
- An `o1Evacuating` flag set before the update is ignored. It only lasted one turn anyway.

### Skipped

`jtt.mjs`:

| Item | Why |
|---|---|
| Interspatial Pause | Hides the tokens of the user and allies within 5 ft, zeroes all damage to them, and is released by the same button, the user's next turn or a scene change. Needs: a token-hidden step, a damage-immunity mark, and a toggle-style Use that undoes marks it set on others. |
| Quantum Trigger | After a failed test it offers a chat button that re-rolls the same dataset with a cumulative ↓n for 1 Personal Power. Needs: a "retry the last roll" step with a chain counter (a chat-card button). |
| Timeslide | Teleport by clicking a canvas point within 200 ft. Needs: a pick-a-point / move-token step. |
| Time Strike | Dialog checkbox (paid in Personal Power) on a Chrono Saber attack. A hit adds the effect's base damage as a note and offers each of the weapon's other effects as a rider. DialogSwitch `cost` + `key` covers the checkbox, but nothing adds hit-card rider options from sibling weapon effects. Needs: a hit step that adds rider options (sibling effects, a damage note). |
| Special Program | Picks any General Perk. The picker shows each option's free-text prerequisite, and the button is offered until a pick is made and on creation. `pickGrant` labels show only the name. Needs: pickGrant option labels with a field (system.prerequisite). |
| Lance of Light (strike) | Checks the target and the 10 ft range BEFORE paying the Standard action, and offers the GM an apply-damage button when it can't write the target. A `target` step runs after the cost, there's no range gate on a Use, and the `damage` step only posts a "for the GM" line. Its toggle is also banked-buffs code. Needs: a target/range check before the cost; a GM damage button. (The Dark Dimension ↓2 was already a rule.) |
| Savant Skill | Story Point refund on a failed reroll (a `createChatMessage` watch comparing with the previous check card), plus the d20+d4 option in dice.mjs. Needs: a reroll-result Trigger; RollDice has no "add a d4" piece. |
| Good with Both | Off-hand checkbox (↓1) on a one-handed weaponEffect only when 2+ weapons are equipped. `self:count:weapon>=2` counts unequipped weapons too. Needs: an equipped-items count tag (e.g. `self:count:weapon:equipped>=2`). |
| Unlucky (For You) | Watches each hit target's next Skill Test until the Ranger's next turn (once per target per combat) and gives Terror if it fails, unless the target is immune to Frightened. The Snag half is in dice.mjs. Needs: Triggers on another actor's roll (a watch mark consumed by that actor's next test) and a per-target-per-combat limit. |

`alterations.mjs`:

| Item | Why |
|---|---|
| Altered | Waives the cost of chosen Alterations (a per-Alteration flag undone in derived data and roll sources). Has a level-based budget and an offer when an Alteration's drop finishes. Needs: an "Alteration cost waived" engine piece tied to alteration-handler. |
| Additional Alteration | Same waiver (all but the Essence cost) plus level-tier grants of the part/mutation Perks. Needs: as Altered, and level-tier grant choices. |
| Overload | Lends an Alteration's benefit (Free) or forces its cost after a Might/Finesse/Science test against Evasion (Move). Durations: until the lender's next turn, or until the end of the target's next turn. Needs: lent Alteration shapes as temporary Essence/Defense/Movement/skill adjustments on another actor; `until: endOfNextTurn` (the target's). |
| Genetic Support | Gives an ally a picked compendium Alteration (benefit and cost, skill choices) until the user's next turn or the scene. Needs: the same lend piece, with pickGrant-like choice of an Alteration shape. |
| Advanced Alteration Emulator | A picked Limited Alteration for 1 minute (10 rounds, else the scene), kept on the upgrade, then a DIF 20 Technology recharge. Needs: the lend piece, and `until: {rounds: 10}`. |
| Thick Hide | Grants an always-equipped Riot Shield copy (re-equipped by a hook) whose raised Evasion becomes the Alteration count. Needs: a Grant with flags/system overrides, and a "keep equipped" piece; Defense `@count` of a type isn't a formula ref. |

`cobra-gear.mjs`:

| Item | Why |
|---|---|
| Dielectric | Electromagnetic attacks get only ↑1 against the wearer. It reads `hasComputerizedGear` (robot, part Perks, worn computerized traits) and undoes dice.mjs's ↓3. Needs: `check:computerizedGear` (also asked for by Machinesmith in slC). |
| Insulator | As Dielectric, ↑2. Same need. |
| Standard Deflecting Weapon | Grants a picked Standard shield linked to the weapon, kept equipped with it, deleted with it, and warns when attacking while it is raised. Needs: linked-item grants and sync hooks. |
| Limited Deflecting Weapon | As Standard, with a Limited shield. |
| Shield Fighter | Spends a Personal Shield use to give the shield an Element for 1 minute. The blade/bludgeon hits then offer that Element. Needs: a hit rider option with a stored damage type; `until: {rounds: 10}`. |
| Onslaught | A melee hit offers each of the weapon's other effects (or a Maneuver) as an extra rider. Needs: a hit step that adds rider options from sibling weapon effects. |
| Disenfranchised | Posts a gate with three Skill buttons that a helper presses to roll against this character's Willpower. Needs: chat-card buttons other players press. |

`more.mjs`:

| Item | Why |
|---|---|
| Armor Matrix (Light) | Refuses a second unattached matrix (preCreateItem), and only the best matrix's Toughness counts on a Transformer. Needs: a create-veto rule and a "best of the matching items" Defense. |
| Armor Matrix (Medium) | Same. |
| Armor Matrix (Heavy) | Same. |
| Eat the Weak | Culture against the target's Willpower removes the target's Addicted (Dark Energon) Hang-Up (with a GM button when it can't be written). Needs: a "delete an item on the target" step. |
| Multimorph | Grants one or two picked Origin Perks from other MLP Origins as scene-long copies, and removes them when pressed again. Needs: an origin-perk picker for pickGrant and a remove-granted step. |

### Engine pieces the skips need

- **Hit rider options from steps:** sibling weapon effects as extra rider buttons (Time Strike, Onslaught), and a stored
  damage type (Shield Fighter).
- **Alteration lends and waivers:** temporary Alteration benefit/cost shapes on any actor, plus cost waivers tied to
  `alteration-handler.mjs` (Altered, Additional Alteration, Overload, Genetic Support, Emulator).
- **Timing:** `until: endOfNextTurn` (the target's) and `until: {rounds: N}` (else the scene).
- **Tags/checks:** an equipped-items count (Good with Both) and `check:computerizedGear` (Dielectric, Insulator).
- **Steps:** remove an item on the target (Eat the Weak, Multimorph's revert), move or hide a token (Timeslide,
  Interspatial Pause), retry the last roll (Quantum Trigger), and a target/range check before the cost (Lance of Light).
- **Chat-card buttons** that other players or the GM press (Disenfranchised, Lance of Light's damage, Quantum Trigger).
- **pickGrant labels with a field** (Special Program's prerequisites); an origin-perk picker (Multimorph).
- **Linked-item grants** kept in step with their host (Deflecting Weapons, Thick Hide).

### Files touched outside the slice

- `packs/jttitems/_source/Evacuation_Vents_Tft06zzgFsVCx2B7.json` - the two rules (LF, inserted as text).
- `module/mechanics/combat/token-movement.mjs` - removed the `o1Evacuating` block in `getPushRules`; the comment listing the
  MovementAction Perks names Evacuation Vents.
- `lang/en.json` - removed `O1EvacuationVents`.
- `module/rules/conversions-uses.test.js` - the `// slD other1` block at the end (no import-line change; it imports
  `ruleMovement` dynamically).

---

## Batch slD (part): the `other3` extension slice

**Scope:** every item in the id table of `module/helpers/extensions/other3/` (`O3` in `shared.mjs`, plus the Better
Together Hang-Up written inline in `pr.mjs` as `BT_HANGUP`), and every other place in `module/` that uses those ids.
Branch `rules/slD-other3`, from `rules/slC` at a1291212.

| Verdict | Items |
|---|---|
| Convert | 0 |
| Partial | 0 |
| Skip | 25 |
| Dead table entry, removed | 1 (Hidden In Plain Sight) |

That is 25 items with behaviour of their own. Three table entries are only references, so they are not counted:

- Multiplication: Overcharge Engines reads it for its second use per turn (its own code lives in tf2, tf3,
  `flashy.mjs`, `skill-substitution-perks.mjs` and `augment-power.mjs`).
- Puissance: Again and Again and Again needs it on the actor.
- Weird: the Perk Gluten-Tolerant refuses.

Other uses of these ids outside the slice: Metallic Armor Power Up! (`mechanics/characters/power-use.mjs`, its activation and
upkeep) and Bump & Run (`dice.mjs`, its ↑1 and Stun) have halves that were converted or kept by earlier rounds; only
the halves in this slice were judged here. Gluten-Tolerant's ↓1, Now You Don't's Cover half and Gravity Optional's
float half are already rules (`conversions.test.js`).

Code in the slice that isn't keyed by an item id is out of scope: the Hide toggle and the Hidden state
(`hide.mjs`, keyed by the Infiltration Skill) and the Cover blast card (`tf.mjs`, keyed by `damageType: cover`).

No rules were added. `scripts/check-rules.mjs` still counts 1363 rules on 972 items, with 0 errors and 0 warnings.

### Converted (0)

None.

### Partial (0)

None.

### Dead table entry, removed (1)

- **Hidden In Plain Sight.** `O3.hiddenInPlainSight` was read by nothing. The Hide action never checks for cover, so
  the Perk has nothing to gate. The key is removed from `shared.mjs`. No behaviour changes.

### Behaviour differences

None. No behaviour changed.

### Skipped (25)

#### My Little Pony (`mlp.mjs`)

- **Betrayal (Hang-Up).** A post-roll hook on the assisted actor writes a scene-window record when an assisted test
  fails. `allies.mjs#getNearbyAllyTokens` reads it world-wide, and a chat button lets another PC spend a Friendship
  Point to heal it. *Needs:* a Trigger on the assisted actor's failed roll that fires for the assister's item, a
  world-wide "split from the party" state that the ally count reads, and a chat-card button another player presses.
- **Dabbler.** A Use with two chained pickers (lower one Skill, raise another of the same Essence or Spellcasting)
  edits the real Skill ranks, records the swap on the Perk, and undoes it one step each way on the next Rest or a
  second press. *Needs:* a step that changes a stored Skill rank (step up / down), a pick over Skills filtered by
  Essence and by rank, and a Rest Trigger that undoes a recorded change.
- **Self Improvement (spell).** A Use on the target (or the caster) picks an Essence not yet improved and a Skill of
  it. The target stores the picks for the scene; a derived hook raises the Essence, every Defense built on it (with
  a breakdown entry) and the Skill's shiftUp. *Needs:* a per-target, per-scene stored list that DerivedStat / Defense
  rules on the TARGET read (with paths taken from the picks), and an "Essences not yet picked" filter.

#### Power Rangers (`pr.mjs`)

- **Follow Me!** A card button stamps followers on their combatants; an `updateCombatant` hook on the active GM adds
  +1 per follower to the leader's Initiative and sets each follower to the leader's result minus 1d4 (minimum 1).
  *Needs:* a chat button others press, and a Trigger on another combatant's Initiative that writes Initiative values.
- **Better Together (and its Hang-Up, `BT_HANGUP`).** A Use picks a partner PC (stored on the Perk). When the pair
  Lend Assistance to each other (seen from the `pendingLendAssistance` flags), both get ↑1 and an Edge until the end
  of the assister's next turn, read world-wide. The Hang-Up gives ↓1 while the partner has no token on the scene.
  *Needs:* a ChoiceSet over world PCs, `lendAssistance` / `assisted` Triggers narrowed to that chosen actor, a mark on
  both with `until: endOfNextTurn` (of the assister), and an "actor X has a token on this scene" tag.
- **Guardian Blast.** A Use opens a checklist of allies, pays Standard and posts a group-test card; each participant
  rolls Targeting from it on their own client (paying their own Standard), and Resolve applies 5 Energy damage if half
  or more hit. *Needs:* a group Skill Test step with per-participant chat buttons and a tally.
- **Mega Defender.** A Use (3 Personal Power, Standard, a Zord on the sheet with a token on the scene) stores the
  form for the scene. A derived hook SETS Strength, Speed, Health max, Toughness, Evasion and every movement. The form
  ends at 0 Health (restoring the old Health) or at scene end. The Ranger and Torozord share actions and Free actions.
  *Needs:* DerivedStat `set` rules gated on a per-scene stored form, a "linked Zord on the scene" check, an end on
  0 Health that restores a stored value, and shared action economy between two actors.
- **Metallic Armor Power Up! (the rest).** -1 damage on hits by minion attackers (a card note), and it ends on a
  non-minion crit or at 0 Health. *Needs:* a `taken` DamageModifier whose `when` sees the attacker (it gets no
  `other` today) and lands as the card note, not at `applyDamage`; a Trigger on being critically hit; an "end at
  0 Health" step that also removes the +3 temporary Health.
- **Solarix Shard.** A Use picks a Power Weapon (stored on the item); hits with it offer a 1 Fire damage rider; once
  per scene the first Personal Power spend is refunded 1. *Needs:* a CriticalOption-like hit rider keyed to a weapon
  chosen on the item (a ChoiceSet over the actor's weapons, and a `weapon:` tag that compares with it), and a Trigger
  on a resource being spent with a refund step.
- **Void Touched (Origin).** Asked when the Origin lands (and from a Use until done): -1 Strength or Social max,
  +1 Smarts or Speed max (on top of the Origin drop's own +1), undone when the Origin is deleted. *Needs:* a pair of
  choices that write stored Essence maxima, run after the Origin drop's own update, with an undo on delete (or an
  Origin-drop hook that takes the trade).

#### G.I. Joe gear and Transformers (`tf.mjs`)

- **Holographic Sights (upgrade).** ↑ equal to the rolled multi-target Targeting effect's own `shiftDown`, when the
  sights are attached to that effect's weapon (any printing). A RollModifier on the upgrade with `item:onHost` gets
  close, but: formula `@item.<path>` reads the RULE's item, not the rolled one, so the ↑ can't follow the effect's
  `shiftDown`; the upgrade's rules are off while its weapon is unequipped (the old code didn't care); and a
  non-stacking rule keeps only the first copy, so sights on a second weapon would be lost (`stacks: true` would double
  two sights on one weapon). *Needs:* a formula ref to the rolled item (`@rolled.<path>`), and per-host upgrade rules.
- **Scramble Field Generator.** A Use (adhering roll against Evasion, then a mode with a DIF 16 / 20 Technology test)
  stores the field on the target for the scene; the target's Alertness takes ↓2, and in invisible mode its attacks on
  the user's side are Snagged and that side's attacks on it get Edge. A second Use removes it; a miss or a removal
  uses the device up. *Needs:* a mark carrying the user and a mode, read by the marked actor's own rolls and by the
  user's allies' rolls (`markedBy:` with "same side as the marker"), a choice-dependent DIF, and a consume step.
- **Again and Again and Again.** After a hit with an unarmed (Puissance) attack, a chat button repeats the same attack
  against the same target at ↓1, then ↓3; at most two per turn. *Needs:* a "repeat this attack" step (rerun the rolled
  item against the hit target with an extra downshift), and a per-turn counter.
- **Balance and Compensation.** In derived data, lowers `effectiveBrawnReq` by two die sizes (minimum d2) on external
  hardpoint weapons that have a ranged effect. *Needs:* an ItemModifier op that steps a die-ladder string, and an item
  tag for "has a ranged weapon effect".
- **Bump & Run (the rest).** Notes the token's spot at the attack; at turn end, a token within 10 ft of it is Impaired
  for 1 round. *Needs:* a turn-end Trigger with a "moved at least N ft since the attack" tag.
- **EM Protective Lining (upgrade).** An incoming ↓6 on Electromagnetic attacks against a Computerized lined target,
  and the computerized armor's Evasion added back. "Lined" means loose on a Transformer, or attached to armor that is
  equipped (`equipped` truthy; the engine treats unset as on). *Needs:* a Defense rule that adds another item's
  stored bonus per attack, an OR tag group for "emp damage or electromagnetic weapon trait", and the lined test.
- **Perfect Placement.** A Use places a 25 ft square on the canvas for the scene. Wholly inside it: ↑1 on the first
  Skill Test each round, ↑2 to ignore a target's Cover in the same square, ↓2 on ranged attacks against the holder
  (unless already in Cover), +2 Evasion. *Needs:* a placed-zone step and an "inside the zone" tag (for self and
  target).
- **Precise Chronometrics.** Once per combat, a dialog splits up to Smarts in bonuses over same-side combatants'
  Initiative, written directly (or by a GM card button). *Needs:* a distribute-points step and a write-Initiative
  step.
- **Now You Don't (the +5).** +5 to the Skill Test result when the Hide toggle (`o3Hide`, a code toggle) is ticked
  while in Alt Mode. *Needs:* a flat result bonus on a roll (`skillEffectModifierBonus`) and a tag that reads a code
  dialog toggle (or the Hide toggle as a rule DialogSwitch key).
- **Overcharge Engines (with Multiplication).** A Free-action Use, once per turn (twice with Multiplication): roll
  Technology, then every movement above 0 gets + the total rounded up to 5 until the end of the turn, ignoring Rough
  Terrain. *Needs:* a Movement rule whose value comes from a stored roll result (a step that stores `@var` from a roll
  total and a mark that carries it until end of turn), and a Use limit that depends on another Perk.
- **Pop Out.** After an attack while Hidden, a chat button rolls Infiltration against the best of Willpower /
  Cleverness of every creature hit, restoring Hidden on a success. *Needs:* the Hidden state as data, and a roll step
  against several targets' best Defense.
- **Same Principle.** A Use picks a non-Ballistic weapon; derived data adds `ballistic` to its traits (and
  `itemAndUpgradeTraits`, `upgradeTouched`), so every Ballistic check sees it. *Needs:* a ChoiceSet over the actor's
  weapons and a WeaponTrait rule matched to that pick that writes the stored traits the way this hook does.
- **Telltale Sign.** On a successful Pop Out, per-creature buttons (Free action each, up to three per creature) roll
  Infiltration against Willpower / Cleverness and apply Frightened for 1 round per success. *Needs:* Pop Out first,
  then a repeatable chat button with a per-target counter.

#### Welcome to Night Vale (`wtnv.mjs`)

- **Gluten-Tolerant (the Weird refusal).** A `preCreateItem` hook always refuses Weird on its holder, in every
  prerequisite mode. A prerequisite on Weird (`not:self:has:...`) would follow `essence20.prerequisiteMode`
  (warn by default), so it isn't the same. *Needs:* a "forbids" rule that refuses an item whatever the mode.
- **Gravity Optional (the jump).** An Athletics switch; the roll's chat card is read back and a line posts the
  tripled total. *Needs:* a chat step with the roll's total in a formula (`@rollTotal`), fired by an afterRoll
  Trigger on a switch key.

### Engine pieces the skips need

- **Stored picks that other rules read:** a ChoiceSet over the actor's weapons or world PCs, with `weapon:` /
  target tags that compare with the pick (Solarix Shard, Same Principle, Better Together).
- **Per-target state with an owner:** marks that carry who set them and a mode, read by the marker's allies
  (Scramble Field), and per-scene stored lists that DerivedStat / Defense rules read (Self Improvement, Mega Defender).
- **Formula refs to the roll:** the rolled item's stored values (`@rolled.<path>`, Holographic Sights) and the roll's
  total (Gravity Optional, Overcharge Engines).
- **Chat-card buttons others press** and group tests (Follow Me!, Guardian Blast, Pop Out, Telltale Sign, Betrayal,
  Precise Chronometrics).
- **Zones and positions:** a placed canvas zone with an "inside" tag (Perfect Placement), and "moved N ft since"
  (Bump & Run).
- **Other:** a flat result bonus on a roll (Now You Don't), a "forbids" rule (Gluten-Tolerant), a `taken`
  DamageModifier that sees the attacker (Metallic Armor), a step that changes stored Skill ranks or Essence maxima
  with an undo (Dabbler, Void Touched), a repeat-attack step (Again and Again and Again), a die-ladder ItemModifier op
  (Balance and Compensation), writing Initiative (Follow Me!, Precise Chronometrics).

### Files touched outside the slice

- None. Only `module/items/shared/turn-stamps-and-sides.mjs` changed (the dead key), plus this file.
- No tests were added or removed (nothing converted, and the dead key had no test). No `lang/en.json` strings became
  unused. `extensions/index.mjs` is unchanged.
