# Round 18, convB - the last hand-written code on six items (2026-10-07)

Scope: Body of Energy, Renegade Commander, Zeo Crystal Boost, We Improvise, Megafauna (the arriving-in-form half) and the
Sorcery builder (its Use). Each was still code, fully or partly, waiting for an engine piece. All six are converted; the
Sorcery builder's dialog stays code because it is a bespoke form (see the verdict table). Tests:
`module/rules/engine18-convB.test.js` (14) and `module/rules/conv18-convB.test.js` (14). Strings: `E20.RulesExtConvB18.*`
(`r18/lang-convB.json`).

## Engine features added 2026-10-07 (round 18, convB)

All new plug-in files are imported in `rules/plugins/index.mjs`'s "Round 18 (convB)" block.

### Damage and resources

- **Rule type `HealthOverflow {into, keep?}`** (`plugins/combat/health-overflow.mjs`) - Health and another stored number act
  as one pool for damage. Damage that would take the holder's Health to 0 or below comes out of the resource at `into`
  (a `system.` path) first. Health stays at `keep` (default 1) until the pool is gone, and then both are emptied. Damage
  smaller than the Health left lands as usual. The resource is written with `{essence20Loss: true}` (a loss, not a spend).
  - It is a damage modifier registered after the rules' reductions (DamageReduction, damageLanding...), so it shares out
    what is left of the hit. It runs on whichever client applies the damage.
  - `when` sees the holder and the damage (`damage:<type>`, `damage>=N`). The first rule whose `when` holds is used.
  - Body of Energy: `{into: "system.powers.personal.value", when: ["self:morphed", "not:damage:stun"]}`.
- **`updateActor {notSpent: true}`** (edit in `rules/steps.mjs`) - the write carries `{essence20Loss: true,
  essence20Refund: true}`, so resourceSpent Triggers and the resource code's spend hooks skip it. Body of Energy's split on
  leaving Morph uses it.
- **Ref `@rolePointsBonus`** (`plugins/resources/role-points-bonus-ref.mjs`) - the bonus the actor's base Role Points item
  grants: `system.bonus.value`, or `system.bonus.level20Value` at 20th level. `@rolePointsBonus.<name>` reads the Role Points
  item of that name (`_` for a space). 0 with none. Renegade Commander hands its Bonus Health to the ally:
  `{key: "system.health.bonus", value: "@rolePointsBonus"}`.

### Timed Active Effects

- **`addEffect {until}`** (edit in `plugins/effects/rule-effects.mjs`) - with `on: actor`, the effect is stamped with
  `flags.essence20.rulesExpiry` (any rule duration, like a timed grant). The validator refuses `until` without `on: actor`.
- **The timed-item sweep takes Active Effects too** (edit in `rules/triggers.mjs#sweepExpired`) - an actor's effects whose
  `rulesExpiry` ran out are deleted at the same points timed items are (turn starts, scene changes, world-time changes; the
  active GM). Renegade Commander's scene-long grant: `{do: addEffect, on: actor, to: target, until: scene, ...}`.
- **An `addEffect` name with a placeholder is formatted** - an `E20.` name whose text holds `{...}` is formatted with
  `{name}` (the run's actor) and the run's vars. A name without one is only localised, as before.

### Powers

- **Rule type `PowerGate {when}`** (`plugins/resources/power-gate.mjs`) - on a Power: its activation button (the sheet's
  `canUsePower` helper, `mechanics/characters/power-use.mjs`) shows only while `when` holds (self = the Power's holder).
  A Power whose own powerUsed Trigger has a limit gates on it with `self:limitUsed:<limit.key>:<per>`. Zeo Crystal Boost:
  `{type: PowerGate, when: ["not:self:limitUsed:zeoCrystalBoost:encounter"]}` beside a powerUsed Trigger with
  `limit: {per: encounter, key: zeoCrystalBoost}`.

### Zords and Megaforms

- **Link scope `drivenMegaform`** (`plugins/zords/driven-megaform.mjs`) - a rule on a character's item reaches every
  Megazord (subtype megaformZord) that the Zord it drives is part of. Every rule type that takes `vehicle` takes it.
  `stacks: false` counts one book item once, however many drivers hold it.
- **Tag `megaform:everyDriver:<tags joined by &>`** (same file) - this actor is a Megazord with at least one Zord
  participant, and every participant has a driver for whom the tags hold (asked as `self:`). Zeo Crystal Boost's team
  clause: `megaform:everyDriver:self:data:flags.essence20.zeoCrystalBoostOption=megaformTeam`.
- **Rule type `SummonArrival {set: {path: value}}`** (`plugins/zords/summon-arrival.mjs`) - on a Zord's item: whenever the
  summon timer is written (`flags.essence20.zordSummonReadyRound`, by zord-summon.mjs or reduceTimer), these values ride on
  that same write (preUpdateActor), so the Zord arrives in that state. `when` sees the Zord. Megafauna:
  `{set: {"flags.essence20.zord1Megafauna": true}}`.

### Story Points

- **Step `storyPointsExpire {count?, message?}`** (`plugins/resources/expiring-story-points.mjs`) - after a
  `grantStoryPoint`: those `count` points (a formula, default 1) belong to the running combat. Outside a combat it does
  nothing.
  - The step marks the actor (`flags.essence20.expiringStoryPointsGrant`, through the GM relay when needed). The active GM
    books the mark on the Combat's ledger (`flags.essence20.expiringStoryPoints`: granted, spent, message).
  - While the combat runs, every Story Point the team's pool loses counts as spent (spends count against these points
    first, since they are the ones about to expire).
  - When the combat is deleted, the points granted and not spent are taken off the pool (never more than it holds), and
    `message` (an `E20.` key with `{count}`) is posted.
  - We Improvise: `[{do: grantStoryPoint}, {do: storyPointsExpire, message: "E20.ResWeImproviseLost"}, ...]`.

### Builders

- **Step `buildSorcerousPower {}`** (`plugins/picks/sorcery-builder-step.mjs`) - opens the Sorcerous Power builder
  (`items/magic/temper-tempest-sorcery-builder.mjs#buildSorcerousPower`, loaded lazily). The Power it describes is created
  on the actor, with a warning when it goes over the Sorcerous budget, and the builder's line goes to the run's chat. A
  cancelled dialog stops the run. The Sorcery Perk: `{type: Use, steps: [{do: buildSorcerousPower}]}`.

## Verdicts

| Item | Verdict | What the rules do now |
|---|---|---|
| Body of Energy | converted | HealthOverflow into Personal Power while Morphed (not Stun); unmorph Trigger: Health and Personal Power each half the pool (within max) when Health is above 0, written notSpent, chat line. The Health-to-Power Use was already a rule |
| Renegade Commander | converted | Use (Standard action, 1 Role Point): pickAlly (yourself too from 9th level; not an ally in Medium armor or heavier), addEffect on the ally until the scene ends (↑2 Strength, Bonus Health = @rolePointsBonus), chat. The Defeat half was already a rule |
| Zeo Crystal Boost | converted | PowerGate (once per scene); powerUsed Trigger (choose the option, limit per encounter, key zeoCrystalBoost); sceneStart clears it; Morpher ↑1 unarmed (RollModifier) + Defense any +1; Zord Driving ↑1 (RollModifier); Zord +2 (scaled DamageModifier, scope driven) used by the first hit (hit Trigger, oncePerRoll); team Megazord +1 (scaled DamageModifier, scope drivenMegaform, stacks false, megaform:everyDriver). The Power Weapon +1 was already a rule |
| We Improvise | converted (was "permanent") | its initiativeRolling Trigger also runs storyPointsExpire; the combat ledger and the forfeit at combat end are the engine's |
| Megafauna | converted | SummonArrival sets the form flag on the summon-timer write |
| Sorcery | converted (the builder dialog stays code) | Use rule: buildSorcerousPower. The dialog is a bespoke form over the cost table (`items/magic/temper-tempest-sorcery-builder.mjs` - cost, Power data, form, now with no Use registration and no compendium id). `D21.sorcery` in `items/magic/mystic-non-mystical.mjs` is a reader other code relies on (Mystic's non-mystical test) and stays |

## Bugs found and fixed

- **Body of Energy shared out the hit before the damage reductions** - its damage modifier was registered ahead of the
  rules' DamageReduction / damageLanding modifiers, so the pool was drained (and written) for damage a reduction then took
  off. HealthOverflow runs after them.
- **Body of Energy drained Personal Power on Stun damage** - Stun doesn't take Health ("spend or lose Health or Power"), so
  `not:damage:stun`.
- **Zeo Crystal Boost never ended** - "until the end of the scene", but the chosen option stayed until the next activation.
  A sceneStart Trigger clears it.
- **Renegade Commander refused an ally the user couldn't write** ("ask their player") - addEffect goes through the GM
  relay. Armor classed `non` (no armor) also counted as "more than Light"; it doesn't now.
- **We Improvise counted spends made before its grant** against the granted point. Only spends after a grant count now
  ("unspent Story Points gained from this Perk").

## Book changes (the book is the source of truth)

- **Zeo Crystal Boost, Zord option**: "increase damage on a single successful Zord Attack by 2" - the +2 is now used up by
  the first attack that hits (it was used up by the first attack rolled, hit or miss).
- **Zeo Crystal Boost, Morpher option**: "+1 to all Defenses" is a Defense rule on the sheet (it was only added to attacks
  rolled against the Ranger), so every reader of the Defenses sees it.
- **Sorcery (Table 4-1, p.272-273)**: "The point cost for any Power cannot be modified lower than 1" - the builder's floor
  is 1 (was 0; Lucky Charm prints 1 point). The basic attacks deal Energy damage, so Energy is the unchanged type and any
  other type (Element included) is the +1 change with +1 damage (Element was the base before, and Energy cost +1).
- Automation notes updated (short paraphrase): Body of Energy, Renegade Commander, Zeo Crystal Boost, Sorcery.

## Behaviour differences worth a note

- Zeo Crystal Boost's ↑1s (unarmed, Driving) are labelled Roll Options sources now, not pre-filled dataset shifts - the
  convention for every converted Perk.
- Renegade Commander's pick goes through pickAlly: a targeted ally is taken without asking; the candidates are the system's
  allies (getNearbyAllyTokens), any range. An ally in heavier armor isn't offered (no warning toast). Without a Role Point
  the Use is refused by its cost (the "no uses left" toast is gone).
- Body of Energy's "not Defeated" check reads Health after the un-Morph write (the code also refused when Health was 0
  before it - the same unless one write both un-Morphs and raises Health from 0).
- Not automated (book): "when you spend ... Power", a Power cost bigger than the Personal Power left doesn't draw on
  Health by itself - the existing Use moves Health into Power first (as before).

## Code vs notes - needs a ruling

- None.

## Shared-file edits

module/rules/steps.mjs (updateActor notSpent), module/rules/triggers.mjs (sweepExpired / holdsTimedItems take Active
Effects), module/rules/plugins/effects/rule-effects.mjs (addEffect until, formatted name), module/rules/plugins/index.mjs
(the convB block), module/dice.mjs (+ dice.test.js - Zeo Crystal Boost's five readers, the import, the damage-sum terms and
their test block), module/mechanics/characters/power-use.mjs (+ .test.js - canUsePower asks PowerGate; the Zeo branch and
id gone), module/mechanics/actions/team-actions.mjs (renegadeCommander, endSceneTeamEffects, allyTokens, pickToken, the
TEAM / USE_KINDS / HANDLERS entries), module/essence20.mjs (the endSceneTeamEffects import and loop),
module/items/index.mjs (four imports), module/items/shared/resource-team-lookups.mjs (IDS.bodyOfEnergy, IDS.weImprovise),
module/items/magic/temper-tempest-sorcery-builder.mjs (registerUse / O2_MAGIC gone, buildSorcerousPower exported, the
book fixes), module/items/tests/resources-energon-wealth.test.js, ranger-forms-megafauna.test.js,
medic-support-temper-tempest.test.js, module/rules/conv3-slD3.test.js (loads the plug-ins). Deleted:
module/items/resources/body-of-energy.mjs, module/mechanics/resources/personal-power-spend.mjs (its two registries had no
other user), module/items/attacks/zeo-crystal-boost.mjs (+ .test.js), module/items/resources/we-improvise-continuum-anomalies.mjs,
module/items/zords/megafauna.mjs.

## Unused strings

E20.ZeoCrystalBoostPickOptionTitle, E20.RenegadeCommanderArmor, E20.RenegadeCommanderGiven,
E20.RenegadeCommanderNeedsOwner, E20.RenegadeCommanderNoUses, E20.RenegadeCommanderPick.

## Rule count

14 rules added (Body of Energy 2, Renegade Commander 1, Zeo Crystal Boost 9, Megafauna 1, Sorcery 1) and 1 existing rule
changed (We Improvise's Trigger gains the storyPointsExpire step), on 6 pack items.
