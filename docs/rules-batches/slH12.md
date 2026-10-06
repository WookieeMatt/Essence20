# Batch slH12: group H's round-12 engine pieces and the last code of eight partial items

**Scope:** the parts still in code of Tactical Size Shift, Hybridization, Advanced Dino Gem Integration, Dino Drive Mode,
Ninja Storm Wind Ranger (slA10), Solar Power (slB10), Mobile Headquarters (slF11) and This, I Command (slD10). Every piece
is a plug-in (`module/rules/ext/h.mjs` + `module/rules/ext/h/`); the shared files only lost item code or gained a one-line
hook into a plug-in. All eight items converted - none has item-specific code left. Edited in place in the shared
checkout (no branch, no commit).

## Engine features added 2026-10-06 (round 12, group H)

Everything below is registered on import of `module/rules/ext/h.mjs` (loaded by `module/rules/ext/index.mjs` after g).
Strings are under `E20.RulesExtH.*`.

### Copies and formula comparisons (`ext/h/copies.mjs`)

- **Tags** `rule:copy:data:<path>[<op><value>]` - some copy of the rule's item on the actor (matched by book source, itself
  included) has that data ("any of my Hybridizations is Hold That Shape"); `rule:otherCopy:data:...` - another copy, not
  itself ("an earlier pick locks the direction"). The data test reads like the core `data:` tags (`=`, `!=`, `>=`, `<=`, `>`,
  `<`, or bare = set). No rule item - false.
- **Tag** `calc:<formula><op><number>` - a formula (any rule formula: `@level`, `@actor.<path>`, refs, min / max...) compared
  with a number, asked with self = the actor and item = the rule's item (`calc:@level - @actor.flags.essence20.used > 0`).
- **Refs** `@copiesWith.<path>.<value>` - how many copies of the rule's item (itself included) hold `<value>` at `<path>`
  (`@copiesWith.flags.essence20.zord2Hybrid.extraShift`); `@most.items.<type>.<path>` - the biggest number at `<path>` on the
  actor's items of that type (0 when none - "the best Alt Mode Movement").

### Active Effects and kept values (`ext/h/effects.mjs`)

- **Step `addEffect {changes: [{key, value, mode?}], name?, img?, on?: item | actor, to?, flags?}`** - an Active Effect with
  those changes, on the rule's own item (`on: item`, the default - it transfers to the actor and goes with the item) or on each
  recipient (`on: actor`). `value` is a formula stored as its number (`0 - @var.penalty`); `mode` defaults to 2 (add). A key
  holding `{movement}` is repeated for every Movement type the actor has a base speed in; keys and the name fill
  `{choice.x}` / `{var.x}`, and the name may be an `E20.` key. `flags` go under `flags.essence20` on the effect.
- **Step `removeEffects {flag, to?}`** - the recipients' Active Effects carrying `flags.essence20.<flag>` are deleted (an
  older version's effects too, when they carry the same flag).
- **Step `keepValue {path, at}`** - the actor's value at `path` (`{choice.x}`, `{var.x}`, `{item.<path>}` filled) copied onto
  the rule's item at `at` (a `flags.` path) - the Skill die before a step moves it. A path left with a hole (no pick) stops.
- **Step `restoreValue {path, from}`** - the value the rule's item keeps at `from` written back to the actor's `path` (same
  filling); skipped when the item keeps none or the actor has nothing at the path's parent. Works in a `removed` Trigger.

### Rule types read by hand-written hooks, and an event (`ext/h/drawback.mjs`, `ext/h/types.mjs`)

- **`IgnoreDrawback {drawbacks: [limitedArticulation]}`** - while `when` holds the holder ignores those drawbacks:
  `limitedArticulation` - its Alt Mode's Limited Articulation no longer refuses those Skill Tests (dice.mjs asks
  `ruleIgnoresDrawback`; the file is import-light, dice.mjs loads it directly).
- **`InitiativeEdge {}`** - Edge on an Initiative roll, after the dialog (dice.mjs `INITIATIVE_EXTENSIONS`). Scope `self`: the
  holder's own; scope `sceneAllies`: every OTHER actor on the holder's side (same disposition - the active token's, else the
  prototype's) while the holder has a token on the viewed scene. `when` sees self = the roller, holder = the rule's holder.
  Read only at roll time - never in derived data (other tokens' actors aren't touched while one prepares).
- **`GrantDouble {grants: [upshift | actions], prompt?, damage?: {amount, type}}`** - when the holder grants another actor
  upshifts on a banked bonus (`helpers/perks.mjs#bankPendingBonus`) or extra actions this turn
  (`helpers/action-economy.mjs#grantActionsThisTurn`), the holder is asked (a confirm titled with the item's name; `prompt`, an
  `E20.` key or text, fills `{granter}`, `{ally}`, `{what}`); yes doubles the grant and deals `damage` to the one receiving it.
  `when`: self = the granter, target = the ally. Never for a grant to oneself. `perks.mjs#offerGrantDouble` is the hook.
- **`DamageReduction {amount, damageTypes?, limit?, message?}`** - damage about to land on the holder (an extensions damage
  modifier) of one of those types is lowered by `amount` (a formula - `1d2` rolls), never below 0; `limit` {per: turn | round
  | scene | encounter | mission} counts uses (a round / turn limit never runs out outside a combat, as the combat-stamped
  helpers read it); `message` (an `E20.` key or text with `{name}`, `{n}`) is posted. `when` sees the holder.
- **Trigger event `massShiftUsed`** - the Mass Shift Role Perk was used (`helpers/mass-shift.mjs#activateMassShift`, right after
  it marks its scene use).

Tests: `module/rules/engine12-h.test.js` (13 tests).

## Verdicts

| Item | Pack | Verdict |
|---|---|---|
| Tactical Size Shift | atsitems | converted (the direction / Skill picker, its Active Effect, the Skill die put back on removal) |
| Hybridization | tfcrbitems | converted (the picker, the daily Mass Shift pool, every H Hybridization, Steady Hands, Helping Hand, Half Track, Evasive Conversion) |
| Advanced Dino Gem Integration | bthitems | converted (Primordial Power) |
| Dino Drive Mode | bthitems | converted (engaging, its effects and their clean-up, Reflective Armor) |
| Ninja Storm Wind Ranger | bthitems | converted (the incoming mind-control Snag) |
| Solar Power (Form) | atsitems | converted (its Form spec and Unlock / End buttons) |
| Mobile Headquarters | jttitems | converted (the scene allies' Initiative Edge) |
| This, I Command | ccitems | converted (the upshift / extra-action doubling) |

## Converted

`module/rules/conv12-slH12.test.js` (21 tests) loads each item from its pack and checks what the removed code did.

- **Tactical Size Shift** - an `added` Trigger and a Use (both on a Zord, while unpicked): a `choose` of Larger / Smaller, each
  option offered only while no other copy holds the other direction (`rule:otherCopy`), `auto` - so a later copy is locked
  without a question. The option's steps: `pick` a Skill of Strength (larger) / Speed (smaller), `keepValue` its die,
  `updateActor ladder +1, ladderMax d12`, `addEffect` on the item (Essence +1 and Health +2, or Essence +1 and +10 ft on each
  Movement with a base speed - the old effect exactly), then the old flag `pr1SizeShift {direction, skill, previous}` - so the
  Size rules, older copies and the `removed` Trigger (`restoreValue` of the Skill die) read one record.
- **Hybridization** - an `added` Trigger and a Use (while unpicked): a `choose` of the eleven, each but Extra Shift offered only
  while no other copy holds it; it writes the old `zord2Hybrid` flag and renames the copy. One Use per H Hybridization, gated
  on its copy's pick and on the daily pool (`self:hasItem:<Mercurial Nature>`, or `calc:` Table 5-10 by level + Extra Shift
  copies - `@actor.flags.essence20.zord2MassShiftDay` > 0); each pays a Move action (Free while any copy is Fast Shift - two
  `spendAction` steps) except Evasive Conversion, and ends adding one to the old day count. Change Size: a `choose` of the
  direction into the old `zord2HybridSizeDir` and `markWindow zord2HybridSize` for the scene (the mission while any copy is
  Hold That Shape) - the existing Size rules read both. Half Track: `markWindow zord2HalfTrack` (scene / mission) and three
  Movement rules (stage derived, `op: max`, `@most.items.altMode.system.altModeMovement.<ground | aerial | aquatic>`) while it's
  live in Bot Mode. Steady Hands: `markWindow zord2SteadyHands` (scene) and a RollModifier `immune: [untrainedSnag]`.
  Evasive Conversion: a scene mark `zord2Evasive` and an incoming RollModifier Snag on attacks that uses the mark up.
  Replacement Part: `heal 1`. Reinforce Shell / Weaponize: `pickGrant` of an armor upgrade / a weapon (External hardpoint)
  until the scene ends. Helping Hand: `IgnoreDrawback limitedArticulation`. A `rest` Trigger zeroes the day count and a
  `massShiftUsed` Trigger counts the Role Perk's own uses (both `stacks: false` - once per actor).
- **Advanced Dino Gem Integration** - Primordial Power: a DialogSwitch (`key: pr1DinoPrimordial`, Snag, `forget`) on the Zord's
  melee attacks while the pick (new or old flag) is Primordial, and a HitRider `note: 2` while it's ticked.
- **Dino Drive Mode** - a Use (Standard action, while not engaged): a `choose` (before the cost) of a Movement type with a base
  speed (Ground when none has one); then `removeEffects`, the penalty `max(0, min(3, Speed - 1))`, an actor `addEffect` of +1
  plating and +10 ft to the picked type and (when the penalty is above 0) one of -penalty Speed - the old effects with their old
  flags - and `markWindow pr2DinoDrive` for the scene (the Amplified Dino Strength rule reads it). A `turnStart` Trigger
  removes the Speed effect, a `sceneStart` Trigger the rest. Reflective Armor: `DamageReduction 1d2` on the Energy types, once a
  round, while engaged.
- **Ninja Storm Wind Ranger** - an incoming DialogSwitch Snag ("Trying to control {holder}'s mind") while the holder is Morphed
  with the Form active, never on its own roll.
- **Solar Power (Form)** - a `Form` rule (1 Personal Power, `element: true`, no swaps) and Unlock / End Use rules like the other
  Forms' (on a Player Character). zord1/forms.mjs's Morph prompt and activation already read Form rules; its HitRiders keep
  reading `flags.essence20.zord1Form` (`{uuid, element}`), which activation still writes.
- **Mobile Headquarters** - `InitiativeEdge` (scope sceneAllies) on Zord holders, for Zord / vehicle rollers not holding it.
- **This, I Command** - `GrantDouble {grants: [upshift, actions], prompt: E20.ThisICommandPrompt, damage: 1 Psychic}`.

Removed code (with now-unused constants, imports and tests): `pr1/ats.mjs` (Tactical Size Shift's picker, Use, delete hook and
createItem branch), `pr1/misc.mjs` (deleted - Primordial; with pr1/common.mjs's per-roll pending state, `giveSnag`,
`isMeleeEffect` and jtt.mjs's preRoll clean-up), `pr1/jtt.mjs` (`mobileHqInitiative` and its init hook), `pr1/common.mjs`
(`PR1.mobileHeadquarters`, `tacticalSizeShift`, `advancedDinoGem`), `pr2/zords.mjs` (deleted - Dino Drive Mode; with
`PR2.dinoDriveMode`), `zord1/forms.mjs` (Solar Power's spec, `MORPH_FORMS`, the `zord1Form` Use, the Ninja mind toggle and
apply, `FORM.solar` / `FORM.ninjaStorm`), `zord2/hybridization.mjs` and `zord2/snag.mjs` (deleted; with
`ZORD2.hybridization` / `mercurialNature`), `helpers/perks.mjs` (`THIS_I_COMMAND_ID`, `offerThisICommand`),
`helpers/this-i-command.test.js` (deleted - moved into conv12-slH12).

## Behaviour differences worth a decision

1. **Pickers are buttons** (Foundry localises the labels): Hybridization's eleven choices and Dino Drive Mode's Movement
   types were selects. The pick / done chat lines are short English lines from the pack (not the old i18n lines).
2. **Tactical Size Shift** at a 3d6 Skill now drops it to d12 (the ladder's cap); the old code left 3d6 alone (2d8 already
   went to d12 in both). A cancelled Skill pick leaves the `pick` value on the item (unused).
3. **Hybridization:** a renamed copy is "<its name> (<choice>)" (the old code rebuilt "Hybridization (<choice>)"). Reinforce
   Shell / Weaponize copies end with the scene through the rules' expiry instead of grants.temporary('scene'). Replacement
   Part never lowers Health that's above its maximum. An Evasive Conversion readied before the update (the old
   `zord2EvasiveConversion` flag, scene-long) isn't honoured - it's a mark now. The rest reset only touches actors holding
   the Perk.
4. **Dino Drive Mode:** the Speed / scene clean-up runs for the Zord holding the Feature (its `turnStart` / `sceneStart`
   Triggers - sceneStart reaches world actors, not unlinked token Zords) where the old hooks swept any actor's flagged effects;
   Reflective Armor's d2 is rolled by the formula engine (no Dice So Nice) and its line is escaped.
5. **Ninja Storm:** one switch per targeted Ranger with the Form (the old code offered one for the first found).
6. **Solar Power:** its Use is hidden while not Morphed (the old one warned), and Unlock / End are two buttons, as for every
   other Form. In the Morph prompt the Forms are listed in item order (Solar came first before).

## Still code (0)

None.

## Shared-file edits

- `module/rules/ext/index.mjs` - `import "./h.mjs";`.
- `module/helpers/extensions/index.mjs` - the pr1/misc, pr2/zords, zord2/hybridization and zord2/snag imports removed.
- Slices: `pr1/ats.mjs`, `pr1/jtt.mjs`, `pr1/common.mjs`, `pr1/misc.mjs` (deleted), `pr1/pr1.test.js`; `pr2/zords.mjs` (deleted),
  `pr2/common.mjs`, `pr2/pr2.test.js`; `zord1/forms.mjs`, `zord1/zord1.test.js`; `zord2/hybridization.mjs` and `zord2/snag.mjs`
  (deleted), `zord2/index.mjs`, `zord2/common.mjs`, `zord2/zord2.test.js`.
- `module/dice.mjs` - imports `ruleIgnoresDrawback` (rules/ext/h/drawback.mjs) for the Limited Articulation check (was
  zord2/snag.mjs).
- `module/helpers/roll-dialog.mjs` - the Steady Hands check and its import removed (it's a rule's `immune: untrainedSnag`).
- `module/helpers/mass-shift.mjs` - `activateMassShift` fires `massShiftUsed` (a guarded dynamic import of rules/ext/h/types.mjs).
- `module/helpers/perks.mjs` - `offerThisICommand` / `THIS_I_COMMAND_ID` replaced by `offerGrantDouble(granter, ally, kind, what)`
  (a dynamic import of rules/ext/h/types.mjs); `bankPendingBonus` calls it with `upshift` and `E20.RulesExtH.Upshift`.
- `module/helpers/action-economy.mjs` - `grantActionsThisTurn` calls `offerGrantDouble(..., 'actions', ...)`;
  `action-economy.test.js` - the This, I Command test's officer item carries the GrantDouble rule.
- `module/helpers/this-i-command.test.js` - deleted (its checks are in conv12-slH12.test.js).
- `module/rules/conversions.test.js` - the Mercurial Nature test checks the granted copy through `rule:copy` instead of
  zord2/snag.mjs#hybridsOf.
- Pack sources (text inserts, CRLF kept): the eight items above (rules appended to their arrays).

## Unused strings

Now unreferenced in module/, templates/ and tours/ (and not read by pack data):

E20.Pr1SizeShiftChosen, E20.Pr1SizeShiftPick, E20.Pr1SizeShiftSkill, E20.Pr1DinoPrimordialToggle,
E20.Pr2DinoDrivePickMovement, E20.Pr2DinoDriveEngaged, E20.Zord1ToggleNinjaMind, E20.Zord1FormNeedsMorph, E20.Zord1FormEnded,
E20.ThisICommandTitle, E20.ThisICommandUpshift, E20.Zord2HybridPick, E20.Zord2HybridizationName, E20.Zord2HybridChosen,
E20.Zord2NoMassShiftLeft, E20.Zord2HybridSizePrompt, E20.Zord2HybridSizeDone, E20.Zord2HybridEvasiveDone,
E20.Zord2HybridHalfTrackDone, E20.Zord2HybridSteadyDone, E20.Zord2HybridRepairDone, E20.Zord2HybridGranted.

Still used, now from pack data only (keep): E20.Pr1SizeShiftLarger / Smaller, E20.Pr2Movement.*, E20.Pr2DinoDriveSlowName,
E20.Pr2DinoDriveReflect, E20.ThisICommandPrompt, E20.Zord2HybridSizeUp / Down, E20.Zord2Hybrid.*.

New strings: `<scratchpad>/r12/lang-h.json` (`RulesExtH`: Upshift, DoublePrompt, Reduced).

## Rule count

32 rules added to 8 pack items (Tactical Size Shift 3, Hybridization 17, Advanced Dino Gem Integration 2, Dino Drive Mode 4,
Ninja Storm Wind Ranger 1, Solar Power 3, Mobile Headquarters 1, This, I Command 1). `scripts/check-rules.mjs`: 2418 rules on
1376 items, 0 errors, 0 warnings. ESLint (`--ext .js,.mjs`, linebreak-style off) is clean on every file I touched. Jest:
`engine12-h.test.js` (13) and `conv12-slH12.test.js` (21) pass, and the full suite ran at 557 suites / 10453 tests, all passing.
