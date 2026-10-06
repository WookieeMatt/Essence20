# Round 18, convA - the last hand-written halves of seven items

Scope: Gallantry, Fighting Style's Trigger Happy, Brutal Might, Impenetrable Armor, Stand Behind Me!, Concentrated Fire
and Dominate. Each earlier write-up named the engine piece it was waiting for (slSplit117, slSplit217, slDice15,
slSystems15, slLeftB16); this round builds them, moves the items onto rules and checks each against the book.

## Engine features added 2026-10-07 (round 18, convA)

All new plug-in files are imported in `rules/plugins/index.mjs`'s "Round 18 (convA)" block. New string:
`E20.RulesExtConvA18.TauntBlocked`.

### Condition durations

- **Rule type `ConditionHalving {conditions: [status ids]}`** (`plugins/effects/condition-halving.mjs`): a listed
  Condition that an `applyCondition` step puts on the holder lasts half as long.
  - `rounds: N` becomes half of N, rounded up, and never less than 1.
  - "Until the end of your next turn", when it counts the holder's own turns (`until: endOfNextTurn` with
    `untilOf: recipient`), ends as that turn starts instead (`nextTurn`). The `...OrScene` spelling works the same way.
  - A duration that counts someone else's turns is left alone.
  - `when` is asked with self = the holder and target = the actor whose step applies the Condition.
  - Gallantry: `{type: ConditionHalving, conditions: ["frightened"]}`.
- **`steps.mjs#registerConditionDuration(fn)`**: `fn(recipient, condition, {until, rounds, untilActor}, ctx)` returns
  `{until?, rounds?}`. The `applyCondition` step asks it for each recipient before it works out the timing, so the GM
  relay gets the changed duration too. This is the hook `ConditionHalving` uses.

### The attack's Skill

- **SkillSubstitution `stage: "attack"`** (`plugins/rolls/attack-skill-substitution.mjs`): the Skill is swapped where
  `documents/item.mjs` builds a weapon attack's roll, before the Skill's shift, ↑ / ↓ and Specialization are read from
  the actor. `rules/adapter.mjs#applySkillSubstitution`, the later preRoll swap, skips these rules.
  - `from` is the attack's own Skill (its classification Skill, or the weapon's or dataset's override).
  - `mode: bestOf` swaps only when the `to` die is better.
  - `when` sees the attack (`item:`, `weapon:`, `attack:melee`) and the first target.
  - `ruleAttackSkill(actor, item, skill)` returns the Skill to roll.
  - Brutal Might: `{stage: attack, from: might, to: brawn, mode: bestOf}`.

### Damage landing on your own vehicle

- **Trigger `{event: applyingDamage, redirectTo: <recipient>}`** (`plugins/combat/self-redirect.mjs`): a rule on the one
  being hit. As a check card's Apply Damage is pressed, the hit may land on that recipient instead.
  - `chat.mjs#onApplyDamage` asks it FIRST, with the usual damage-redirect question. While one is offered, the ally
    protectors (`redirect: true`) aren't asked.
  - `when`: self = the one hit, target = the attacker. A `limit` counts each confirmed redirect. `steps` (they can be
    empty) run when the redirect is taken, with the attacker as target.
  - `ruleSelfRedirect(target, attacker)` returns `{protector, ...}` or null; `takeSelfRedirect(redirect)` runs the steps
    and counts the limit.
  - The plain applyingDamage pass skips these rules.
  - Impenetrable Armor: `{redirectTo: drivenVehicle, steps: []}`.

### A mark that refuses rolls

- **BeforeRoll `scope: "marked"` + `mark: "<key>"`** (`plugins/rolls/marked-before-roll.mjs`): the rule sits on the
  setter's item. It is asked before the dialog of every roll made by a creature carrying the setter's `<key>` mark.
  - `when` sees self = the roller, holder = the setter, target = the roller's first target, the rolled item and Skill,
    and how many targets there are (`roll:targets=0`, `roll:anyTarget:<tags>`).
  - `steps` run as the roller. `cancel: true` refuses the roll with `message`, which is an `E20.` key or text; `{name}`
    is the roller and `{holder}` the setter.
  - Stand Behind Me!: `{scope: marked, mark: standBehindMeForced, cancel: true, when: ["item:type:weaponEffect",
    "self:markedByHolder:standBehindMe", {any: ["roll:targets=0", "roll:anyTarget:not:target:ruleHolder"]}]}`.

### Late hit riders

- **HitRider `stage: "late"` + `replace: true`** (`plugins/combat/late-hit-rider.mjs`): read at the end of a weapon
  hit, in `target-riders.mjs#attackRiders` (`ruleLateHitRiders`).
  - It comes after every other hit rider, Targetmaster and All Out Attack, and before the poison coating, the on-hit
    Conditions and the Critical Success riders. `@var.damage` is the hit's damage by then.
  - Only `option` is read at this stage. `replace: true` makes that option the hit's only Apply button: its own damage
    goes, and so do the rules' Critical options.
  - The usual HitRider pass skips stage-late rules.
  - Concentrated Fire: `{stage: late, replace: true, when: ["roll:dataset:concentratedFire", "item:damageType:fire",
    "target:data:system.immunities.fire"], option: {damage: "@var.damage", damageType: fire, key: concentratedFire,
    ignoreImmunity: true}}`.

### Uses a Rest can't give back

- **Rule type `HeldUse {count?}`** (`plugins/resources/held-uses.mjs`): on a Power with daily uses. While `when` holds,
  a Rest gives back all of the spent uses except `count` (a formula, default 1), and never holds more than were spent.
  - `when` is asked of the Power's actor.
  - Read by `mechanics/resources/nanomite-uses.mjs#resetDailyPowerUses` (`ruleHeldUses(actor, power)`).
  - Dominate: `{when: ["self:marking:dominated"]}`. Remote Control's "until you relinquish control" has the same shape.

Tests: `module/rules/engine18-convA.test.js` (8 tests); the items in `module/rules/conv18-convA.test.js` (17 tests).

## Verdicts

| Item | Pack file | Verdict |
|---|---|---|
| Fighting Style (Trigger Happy) | `gijcrbitems/_source/Fighting_Style_2LtDCHxgg9bMvWQK.json` | converted (+1 rule: afterRoll Trigger, targetRowsBeating willpower, applyCondition frightened until endOfNextTurn) - every option of the Perk is a rule now |
| Gallantry | `gijcrbitems/_source/Gallantry_UIMocxFcGeJUm3D4.json` | converted (+2 rules: incoming Snag on a Trigger Happy attack, ConditionHalving) |
| Brutal Might | `eocitems/_source/Brutal_Might_l0STCEYBuPMYfzSt.json` | converted (+1 rule: SkillSubstitution stage attack) |
| Impenetrable Armor | `gijcrbitems/_source/Impenetrable_Armor_vanN7kRYUhgHew7q.json` | converted (+1 rule: applyingDamage redirectTo drivenVehicle) |
| Stand Behind Me! | `atsitems/_source/Stand_Behind_Me__PcezfGdjUtNUZHYH.json` | converted (Use rewritten to mark; +2 rules: marked turnStart Trigger with the Alertness button, marked BeforeRoll block) |
| Concentrated Fire | `ccitems/_source/Concentrated_Fire_2UPKeLtWRXIoDlux.json` | converted (+3 rules: RollModifier Snag, CritOnD2, HitRider stage late) |
| Dominate | `qgtgitems/_source/Dominate_HwREY90wo09Hkdt1.json` | already rules since round 16 (powerUsed Trigger, Command / Recall CardButtons, per-setter mark, the use refunded when no-one is infected) - the brief's list was out of date; +1 rule this round: HeldUse (book) |

Nothing is left as code. Rules added: 11 (one existing Use replaced).

## Converted

- **Trigger Happy** - on an attack with a Multiple Targets weapon (`check:multipleTargetsWeapon`) with the style picked,
  `targetRowsBeating {defense: willpower}` keeps each creature whose plain Willpower the roll's total also reaches. It
  counts hits and misses alike, and leaves out a miss on a creature with MissImmunity, as the old
  `!missHasNoEffect` did. Each one gets Frightened until the end of its next turn.
- **Gallantry** - an incoming RollModifier: Snag (stack `gallantry`) when the attacker holds a Fighting Style set to
  Trigger Happy (`target:holdsItem:item:id:2LtDCHxgg9bMvWQK&item:data:system.choice=triggerHappy`) and rolls a Multiple
  Targets weapon (`target:check:multipleTargetsWeapon`). Its Frightened halving is ConditionHalving.
- **Brutal Might** - the Brawn swap is a stage-attack SkillSubstitution with `bestOf`, so the attack's dataset (shift,
  ↑, Specialized) is Brawn's. Its Edge RollModifier is unchanged.
- **Impenetrable Armor** - the redirect to the vehicle the holder drives is its own applyingDamage rule. The Defense +2
  (scope driven) was already a rule.
- **Stand Behind Me!** - the Use (Morphed, 1 Personal Power) marks every enemy within 60 ft (`mark {key: standBehindMe,
  perSetter, to: enemies:60, until: combatThroughNextRound}`; the window is the old `tauntLive`'s: same combat, this
  round and the next).
  - The mark carries a turnStart Trigger. While the carrier hasn't been tested (`not:self:markedByHolder:
    standBehindMeTested`), it posts a button whispered to the carrier's owners. Pressed, it marks the carrier as tested
    (on the setter's behalf, `by: holder`) and rolls DIF 14 Alertness. A failure adds `standBehindMeForced`, which
    carries the BeforeRoll block.
  - The block refuses an attack (a weaponEffect roll) with no target, or with any target who isn't the setter, while
    the taunt mark from that setter is still live. These are the old `tauntBlocks` conditions.
- **Concentrated Fire** - all three halves run off the `concentratedFire` dataset key that its BeforeArea rule sets.
  - The Snag against a Fire-immune first target is a RollModifier.
  - The d2 Critical Success is CritOnD2. Before, `riderDialogFlags` did it, and that function is gone now.
  - The ignore-Immunity Apply button that replaces the hit's damage is a late HitRider, read at the same point the code
    sat.
- **Dominate** - see Verdicts. HeldUse keeps the use spent through a Rest while a victim still carries the nanomites.

## Book check

| Item | Book | What changed |
|---|---|---|
| Trigger Happy | GI Joe CRB p.80 / p.109 | Frightened "until the end of their next turn": the old code put Frightened on with no duration at all |
| Gallantry | GI Joe CRB p.80 | "lasts half as long; until the end of your next turn ends at the beginning of your turn" - built (ConditionHalving); the notes no longer leave it to the table |
| Brutal Might | Enigma of Combination p.40 | "can use your Brawn Skill instead" - now the better of the two dice (bestOf), not always Brawn |
| Stand Behind Me! | Across the Stars p.55 | "at the beginning of any round ... all enemies within 60 feet" - the enemies in range when the Use is made, not those in range at each enemy's turn start. The Alertness button goes to the enemy's owners and the GM instead of the GM alone (the enemy makes the test) |
| Concentrated Fire | Cobra Codex p.58 | matches (Fire Immunity as Fire Resistance = the Snag, damage through; d2 Critical Success) |
| Impenetrable Armor | GI Joe CRB p.82 | matches |
| Dominate | Quartermaster's Guide to Gear p.93 | "until you recall them, you cannot regain the spent power use" - a Rest no longer restores it while a victim is infected (HeldUse) |

Automation notes were updated, as short paraphrases, on Fighting Style, Gallantry, Brutal Might, Stand Behind Me! and
Dominate.

## Bugs found and fixed

- Trigger Happy's Frightened never ran out (`toggleStatusEffect` with no duration). It now ends at the end of the
  target's next turn (see Book check).

## Behaviour differences worth a decision

- Gallantry's Snag and Trigger Happy read every Fighting Style copy's own choice. The old code read only the first
  copy (`findPerk`). This is the same question as the existing `[split1]` entry in questions.md.
- Impenetrable Armor finds the vehicle through `zord-crew-lookups#crewing`, which takes the first vehicle that lists the
  actor and then checks for the driver seat. The old `_getPilotedVehicle(actor, 'driver')` took the first vehicle where
  the actor drives. These differ only for someone who is a passenger in one vehicle and the driver of another.
- Questions parked in questions.md: Gallantry's rounding of an odd round count (rounded up), and how long Stand Behind
  Me!'s taunt lasts (kept this round and the next).

## Shared-file edits

- `module/rules/steps.mjs` - `registerConditionDuration` + its read in `applyCondition`.
- `module/rules/adapter.mjs` - `applySkillSubstitution` skips `stage: attack`.
- `module/rules/plugins/combat/hit-rider.mjs` - `applyEntry` skips `stage: late`.
- `module/rules/plugins/combat/applying-damage.mjs` - the plain pass skips `redirectTo`.
- `module/rules/plugins/tags/combat-stamps.mjs` - comment only.
- `module/rules/plugins/index.mjs` - the convA block.
- `module/documents/item.mjs` - Brutal Might's constant and `actorHasPerk` import gone; `ruleAttackSkill` call.
- `module/chat.mjs` - `ruleSelfRedirect` / `takeSelfRedirect` instead of `findEligibleProtector`.
- `module/dice.mjs` - Trigger Happy (`_hasFightingStyle`, `_isTriggerHappyAttack`, `willpowerDifficulty`,
  `triggerHappy`, `frightened`, the Frightened loop, the `ignoresMissEffects` import), Gallantry's Snag,
  `FIGHTING_STYLE_ID` / `GALLANTRY_ID`, the `riderDialogFlags` import and call, and `concentratedFire` in the rider
  context are all gone.
- `module/mechanics/combat/target-riders.mjs` - Concentrated Fire's Snag, `riderDialogFlags`, the `concentratedFire`
  rider fact and the ignore-Immunity block are gone; `ruleLateHitRiders` is called in their place.
- `module/mechanics/combat/rider-uses.mjs` - `RIDER.concentratedFire` gone.
- `module/mechanics/resources/nanomite-uses.mjs` - `resetDailyPowerUses` asks `ruleHeldUses`.
- `module/items/index.mjs`, `module/items/shared/pr-jtt-ats-item-ids.mjs` (`PR1.standBehindMe`).
- Tests: `module/dice.test.js` (Trigger Happy and Gallantry describes, two `willpowerDifficulty: null` literals),
  `module/documents/item.test.js` (Brutal Might now reads an inline stage-attack rule), `module/chat.test.js` (a
  comment), `module/items/tests/lightspeed-spectrum-time-displaced.test.js` (the taunt test and its now-unused helper),
  `module/rules/conv15-banked.test.js` (Stand Behind Me!'s stamp test).
- Removed: `module/items/attacks/stand-behind-me-taunt.mjs`, `module/items/defenses/interpose-attack.mjs` and its test.

## Unused strings

E20.Pr1TauntBlocked, E20.Pr1TauntButton, E20.Pr1TauntCard, E20.Pr1TauntForced, E20.Pr1TauntResisted.

New (r18/lang-convA.json): E20.RulesExtConvA18.TauntBlocked.

## Checks

- eslint (`--ext .js,.mjs --rule 'linebreak-style: off'`) on every touched file: clean.
- `node scripts/check-rules.mjs`: 4202 rules, 0 errors, 0 warnings.
- jest: engine18-convA and conv18-convA pass, as do the touched suites (dice, chat, documents/item, target-riders,
  lightspeed-spectrum, conv15-banked, conv15-uses, conv15-items1, conv16-b, conv16-LeftA, book-costs, and
  mechanics/resources). In the full suite (350 suites), the only failures (4 suites, 6 tests) are another part's
  in-progress rule summary wording (rules.test.js, phase2, editor) and its addEffect name (engine12-h).
