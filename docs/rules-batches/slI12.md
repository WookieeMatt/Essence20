# Batch slI12: round 12, group I - the code halves of eight partial items

**Scope:** More Bang for your Buck (slB10 - Temper Tempest's storm +1), Ladder (slC10 - its Use and the allies' switch),
Weapon Enthusiast Perk (slC10 - its Use), Mystical Understanding (slD10 - Refocus, Essential Research, Magically Fit In),
Brilliant Sight (slD10 - its darkvision), We Are One! (slE10 - the team's reroll), Early Adopter (slE10 - its Requisition
DIF -5) and Detail Oriented (slE10 - its Finesse Move action). Built as plug-ins in `module/rules/ext/i.mjs` +
`module/rules/ext/i/` (common, values, scopes, requisition, cast) plus five small engine edits, in the shared checkout (no
branch, no commit).

**Result:** 8 pieces built (+5 engine edits), **8 items converted**, **0 still code**. **11 rules added on 7 pack items**
(and We Are One!'s Use edited). `scripts/check-rules.mjs`: 2418 rules on 1376 items, 0 errors, 0 warnings (the other
group's work included). Full jest suite: 557 suites, all passing.

## Engine features added 2026-10-06 (round 12, group I)

Everything below is registered on import of `module/rules/ext/i.mjs` (loaded last by `module/rules/ext/index.mjs`). No new
strings (`E20.RulesExtI` is empty).

- **Refs** (`ext/i/values.mjs`): `@rolePoints` - what the actor's base Role Points item holds (Mystical Points, Cheer...);
  `@rolePoints.<name>` the Role Points item of that name (`_` for a space); 0 with none. `@flagList.<flag>` - how many
  entries the list at `flags.essence20.<flag>` on the actor holds; `@flagList.<flag>.<value>` - how many equal that value.
- **Step `flagList {flag, add? | clear?, to?}`** - append a text (`{choice.x}` / `{var.x}` filled) to that actor flag list on
  each recipient, or empty it (no write when it's already empty). For state an older version of an item kept in a flag
  list, so old characters carry on (Essential Research's `essentialResearch`).
- **Pick source `config {path}`** - the entries of `CONFIG.E20.<path>` (`weaponTypes`, `damageTypes`...), labelled by their
  localised names.
- **Tag `holder:asOther:<self tag>`** - a `self:` tag asked of the rule's holder, with the actor the rule reached (the one
  rolling) as the other party: `holder:asOther:sizeDiff>=0` - the holder is no smaller than them.
- **DialogSwitch `scope: "alliesAnywhere"`** (`ext/i/scopes.mjs`) - group E's scope (every other actor on the holder's side,
  anywhere: token dispositions, else Player Character or not) on dialog switches too: the switch is offered on those
  allies' rolls. **`{holder}`** in a switch label is the holder's name (rules/adapter.mjs#ruleDialogSwitches). One switch
  per holder - give them a `stack` group so two ticked count once.
- **Reroll `scope: "picked"` + `picked: <key>`** - the reroll reaches every actor whose uuid is in the list a pick
  (`pickMany`, `pickEach`) stored on the rule's item under that key (an unlinked token's actor counts as its world actor);
  `includeHolder: true` adds the holder. `skills` may hold `{choice.<key>}`; while the list or a skill pick is missing,
  nobody gets it. Read through `registerRerollGrant` (helpers/reroll.mjs#getRerollConfigs), so it is offered like any
  item reroll. **`legacyEffects: "<flag>"`** - Active Effects an older version handed out for the grant (flagged
  `flags.essence20.<flag>` = the holder's uuid) are deleted once at start-up by the active GM.
- **Rule `RequisitionDif {amount, items?, min?}`** (`ext/i/requisition.mjs`) - the holder's Requisition Test DIF changes by
  `amount` (a formula) for items matching `items` (item tags; `item:availability` reads the tier the DIF comes from - after
  the Qualified-upgrade listeners), never below `min` (default 0). Read by helpers/requisition.mjs#requisitionDif; several
  rules apply in turn, each floored. `when` sees the actor.
- **`castHitDamage(caster, spell, damage, damageType)`** (`ext/i/cast.mjs`) - a spell's later damage (a storm's strike)
  counted as one of its cast hits: the caster's `on: "cast"` HitRider rules whose `when` holds for that spell change it the
  way they change a successful cast row. For hand-written spell code (other2/magic.mjs's Temper Tempest).
- **Engine edits:**
  - `updateActor`'s `set` / `add` paths fill `{choice.x}` (`system.essences.{choice.essence}.max`); no pick - left alone.
  - `pickGrant`'s text `flags` fill `{choice.x}` / `{var.x}` (`flags: {q2WeaponType: "{choice.type}"}`).
  - `ActionCost` takes `limit.per: "day"` (counted on the actor until a Rest - action-perks.mjs's daily counter) and
    **`limit.key`** - the counter's name (`actionPerkDailyUses.<key>` for a day; shared with whatever else reads it).
  - HitRider's cast reader (`ext/b/hit-rider.mjs#hitRiderOnCast`) takes the spell itself as `rider.item`.

Tests: `module/rules/engine12-i.test.js` (12 tests).

## Verdicts

| Item | Pack file | Verdict |
|---|---|---|
| More Bang for your Buck | `kocitems/_source/More_Bang_for_your_Buck_mfS0v8KAhBcLCC9e.json` | converted (no pack change: its cast HitRider is read for the storm) |
| Ladder | `tfcrbitems/_source/Ladder_CjJGz1LLzFoveqZK.json` | converted |
| Weapon Enthusiast (Perk) | `qgtgitems/_source/Weapon_Enthusiast_pwpCtdsf8l7T6Sii.json` | converted |
| Mystical Understanding | `mlpcrbitems/_source/Mystical_Understanding_23NeoRDRxlo0LpyQ.json` | converted (Refocus, Essential Research, Magically Fit In) |
| Brilliant Sight | `kocitems/_source/Brilliant_Sight_Oc8NpQa5ylK2Ix0B.json` | converted |
| We Are One! | `eocitems/_source/We_Are_One__1MtovibPOMw9O2hP.json` | converted |
| Early Adopter | `qgtgitems/_source/Early_Adopter_WrRChund2zAcHYfe.json` | converted |
| Detail Oriented | `mlpcrbitems/_source/Detail_Oriented_FBIg9BWG2CyjqgBP.json` | converted |

## Converted

- **More Bang for your Buck** - Temper Tempest's storm (other2/magic.mjs, the spell's own permanent code) strikes for
  `castHitDamage(caster, <their Temper Tempest>, 3, 'element')`: More Bang's existing cast HitRider (`note: 1`, `when` naming
  Temper Tempest) adds the +1. `O2_MAGIC.moreBang` is gone; `tempestDamage` is async.
- **Ladder** - a Use: a `warn` + stop when not out and not in Alt Mode, `spendAction free` (only when extending),
  `setToggle out` (toggled; `until: scene` when switched on), a chat line each way. A DialogSwitch `scope: alliesAnywhere`,
  "Using {holder}'s ladder: ↑2", `upshift 2`, `forget`, `stack: tf3Ladder`, `when: [skill athletics | acrobatics,
  holder:transformed, holder:toggle:out, holder:asOther:sizeDiff>=0]`. (The Bot Mode Reach was already a rule.)
- **Weapon Enthusiast (Perk)** - a Use with one `choose` (`auto`): no type yet - "Choose your weapon type" (`pick type from
  config weaponTypes`, then `updateItem` writes `flags.essence20.q2WeaponType` on the Perk and on the Hang-Up, `source:` its
  uuid). With a type: take (`pick type ifUnset legacy: flags.essence20.q2WeaponType`, written into the pick, then `pickGrant`
  Standard / Limited weapons tagged `item:weaponType:{choice.type}`, flags `{qualified: true, q2WeaponType: "{choice.type}"}`),
  tag (`pick` an owned weapon, `updateItem` its flag) or change the type. A Qualification: weapons with no Availability or
  automatic / standard / limited **base** Availability (the old `system.availability` check), of the type on the Perk or the
  Hang-Up (`item:weaponType:flagOf:<_id>`). The qualify2 slice's `weaponIsType` copy, `perkAccess`'s Enthusiast branch, the
  Use and `QUALIFY2_USE` are gone (the generic "a granted qualified copy is qualified" check stays).
- **Mystical Understanding** - one Use: `setVar points @rolePoints`, `setVar researched @flagList.essentialResearch`, a
  `choose`:
  - Refocus: `warn` + stop below 2 points, `spendAction standard`, `spend` 2 Role Points, `updateActor
    system.skills.spellcasting.shiftDown = 0`.
  - Essential Research: `warn` + stop at 3 this day (`E20.Mlp2ResearchDone`), `pick` the Essence, `warn` + stop with no
    point, `spend` 1, `updateActor add` +1 to `system.essences.{choice.researchEssence}.max` and `.value`, `flagList add`
    the Essence to `essentialResearch` (the old flag - old characters' research is undone the same way).
  - Magically Fit In: `warn` + stop with no point, `askNumber` 1..`@rolePoints`, `pick` the Skill, `spend` that many,
    `mark magicallyFitIn` on self with that `count`, `until: scene` (a new use replaces it). A RollModifier `upshift:
    @mark.magicallyFitIn` while `self:marked:magicallyFitIn`, on `skill:{choice.fitInSkill}`, not Initiative.
  - A `rest` Trigger: per Essence, `setVar lost @flagList.essentialResearch.<e>`, then (when lost >= 1) `updateActor add max
    -lost` and `set value` to itself with `max: max - lost`; then `flagList clear`.
  The mlp2 Use, its Essential Research rest handler, magically-fit-in.mjs's own picker (`canUseMagicallyFitIn`,
  `activateMagicallyFitIn`) and banked-buffs' dispatch to it are gone. `magicallyFitInValue` / `getMagicallyFitInBonus` stay:
  Friendship Is Mystical writes that flag on a friend and dice.mjs reads it (not this item's code).
- **Brilliant Sight** - an `afterRoll` Trigger, `outcome: anySucceeded`, `item:own`: `target {min: 0}`, then `createItem` on
  `targetOrSelf` - gear "Brilliant Sight", equipped, `visionGrant {darkvision, 120}`, `until: scene`.
- **We Are One!** - a Reroll rule `scope: picked, picked: team, includeHolder: true`, mode ones, target skillDice, reset none,
  maxUses 0, skills `[{choice.skillA}, {choice.skillB}]`, not recursive, `legacyEffects: tf2WeAreOneBy` (the effects the old
  sync made are swept at start-up). The Use's pickMany / picks carry `legacy` paths into the older `tf2WeAreOne` holder flag
  (`record: true` on the pickMany so the linking pass sees it); its `tf2WeAreOneSync` bump is gone. tf2/modes.mjs's sync
  (`weAreOneTeam`, `weAreOneEffect`, `syncWeAreOne`, the update hooks, the flag constants) and `TF2.weAreOne` are gone.
- **Early Adopter** - `RequisitionDif {amount: -5, items: [item:availability = prototype | theoretical]}`; requisition.mjs's
  `EARLY_ADOPTER_ID` check is gone.
- **Detail Oriented** - `ActionCost {action: useASkill, to: move, ask: E20.ActionPerkAskFinesse, limit: {per: day, max: 3,
  key: detailOriented}}` - the same counter (`actionPerkDailyUses.detailOriented`) Sensitive's rule spends and a Rest clears.
  The COST_RULES entry and `ACTION_PERK_IDS.detailOriented` are gone.

## Behaviour differences worth a decision

1. **Ladder (transient + edges).** A ladder extended before the update counts as stowed (the old `tf3LadderOut` flag isn't
   moved). An unequipped Ladder does nothing (rules skip unequipped gear; the old code didn't look). With two allies'
   ladders out the climber sees two switches (one per holder, `stack` - ticking both is still ↑2). The Alt Mode warning is an
   English line from the pack, and the out / stowed line goes on the Use's card.
2. **Weapon Enthusiast (edge).** A re-added Perk whose type is only on the Hang-Up asks for the type again on its first press
   (the old Use reused the Hang-Up's); the Qualification still reads the Hang-Up's type meanwhile. Prompts and chat lines are
   the rules' generic ones; the three choices are choose buttons. The type is also kept as the pick `type`.
3. **Mystical Understanding (small).** Refocus checks the points before spending the Standard action (the old one spent the
   action, then warned). Magically Fit In asks the amount, then the Skill (two dialogs; the actor's own Skills); its ranks are
   a labelled, switch-off-able roll source (Initiative left out, as before). A Magically Fit In made before the update keeps
   working this scene through the old flag (Friendship Is Mystical's read), so a new use in that same scene adds alongside it
   rather than replacing it. Essential Research's Rest undo needs the Perk still on the actor.
4. **Brilliant Sight (small).** The darkvision item now also lands on a target this user doesn't own (through the GM relay;
   the old code skipped it) and posts the usual "Granted" line. The old "no result rows and not failed" success case isn't
   matched (a cast with a check card always has rows).
5. **We Are One! (presentation).** The team's reroll is worked out, not an Active Effect on each member's sheet (nothing in
   their Effects tab); the reroll's name is the Perk's. Old effects are removed once by the GM at start-up.
6. **More Bang for your Buck (edge).** The storm's +1 needs the caster to still hold Temper Tempest (it always does while
   casting it; deleting the spell mid-storm now drops the +1).

## Still code (0)

None of the eight has item-specific code left. Not on this list but noticed: Mystical Understanding's **Spellcialize**
(dice.mjs `spellcializeAvailable` / `applySpellcialize`, keyed on `MYSTICAL_UNDERSTANDING_ID`) is still hand-written - a
DialogSwitch `{cost: {resource: {rolePoints: true}, amount: 1}, specialize: true, when: [trained, not Specialized]}` looks
like it would do it. Temper Tempest's storm (other2/magic.mjs) is that spell's own permanent code.

## Shared-file edits

- `module/rules/ext/index.mjs`: `import "./i.mjs";`.
- `module/rules/ext/b/hit-rider.mjs`: `hitRiderOnCast` takes `rider.item`.
- `module/rules/adapter.mjs`: `ruleDialogSwitches` fills `{holder}` in checkbox labels.
- `module/rules/steps.mjs`: `updateActor` set / add paths fill `{choice.x}`; `pickGrant` text flags fill `{choice.x}` / `{var.x}`.
- `module/rules/types.mjs`: ActionCost `limit.per` may be `day`. `module/rules/actions.mjs`: the cost rule's id is
  `limit.key` when given. `module/rules/actions.test.js`: the new validation message.
- `module/helpers/requisition.mjs` (+ `requisition.test.js`): `requisitionDif` asks `ruleRequisitionDif`; Early Adopter's
  constant and check gone.
- `module/helpers/extensions/other2/magic.mjs` (+ `other2.test.js`): `tempestDamage` through `castHitDamage`.
- `module/helpers/extensions/tf3/rolls.mjs`, `uses.mjs`, `common.mjs` (+ `tf3.test.js`): Ladder's toggle, apply-dialog, Use,
  flag and constant gone.
- `module/helpers/extensions/tf2/modes.mjs`, `common.mjs`, `uses.mjs` (+ `tf2.test.js`): We Are One!'s sync gone.
- `module/helpers/extensions/qualify2/qualifications.mjs`, `common.mjs` (+ `qualify2.test.js`): Weapon Enthusiast gone.
- `module/helpers/extensions/mlp1/mlp1.mjs`: Brilliant Sight's darkvision and its constant gone.
- `module/helpers/extensions/mlp2/mlp2.mjs`: the Mystical Understanding Use, its rest handler and constant gone;
  `mlp2-mystical.test.js` deleted (all of it was that Use).
- `module/helpers/magically-fit-in.mjs` (+ `magically-fit-in.test.js`, rewritten to the flag half): the picker gone.
- `module/helpers/banked-buffs.mjs`: the Magically Fit In dispatch and import gone.
- `module/helpers/action-perks.mjs` (+ `action-perks.test.js`): Detail Oriented's cost rule gone (the "normal cost keeps the
  discount" test now uses Talented).
- `module/dice.mjs`: a comment only (the Magically Fit In flag read is Friendship Is Mystical's now).
- `module/rules/conv10-slE10.test.js`: We Are One!'s test no longer expects the sync bump.

## Unused strings

`E20.Q2EnthusiastType`, `E20.Q2EnthusiastTypeChosen`, `E20.Q2EnthusiastWhich`, `E20.Q2TakeQualified`, `E20.Q2EnthusiastTag`,
`E20.Q2EnthusiastChange`, `E20.Q2EnthusiastTagPrompt`, `E20.Q2EnthusiastTagged`, `E20.Q2TookQualified`,
`E20.Mlp2MysticalPrompt`, `E20.Mlp2Refocus`, `E20.Mlp2Research`, `E20.Mlp2Refocused`, `E20.Mlp2Researched`,
`E20.Mlp2PickEssence`, `E20.MagicallyFitInPickTitle`, `E20.MagicallyFitInPickSkillLabel`, `E20.MagicallyFitInPickAmountLabel`,
`E20.Mlp1BrilliantSightName`, `E20.Tf3AltModeOnly`, `E20.Tf3LadderOut`, `E20.Tf3LadderStowed`, `E20.Tf3ToggleLadder`.
(`E20.Mlp2ResearchDone`, `E20.Mlp2NoMystical` and `E20.ActionPerkAskFinesse` are still used - by the pack rules.)

## Rules added

11 rules on 7 items: Ladder 2, Weapon Enthusiast (Perk) 2, Mystical Understanding 3, Brilliant Sight 1, We Are One! 1 (and
its Use edited), Early Adopter 1, Detail Oriented 1. Tests: `module/rules/conv12-slI12.test.js` (24 tests).
