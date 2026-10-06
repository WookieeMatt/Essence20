# Batch slF11: group F's round-11 engine pieces and the five items group A left as code

**Scope:** slA10's "Still code (5)": Signature Finishing Move, Megaform Advanced Signature Finishing Move, Emotional
Strength, Mobile Headquarters (Megaform half) and Megaform Defender. Every piece is a plug-in (`module/rules/ext/f.mjs` +
`module/rules/ext/f/`) plus two small engine edits (a reactor-lookup registry in `rules/reactions.mjs`, a `before` option
on `registerHitRider`). All five items converted. Edited in place in the shared checkout (no branch, no commit).

## Engine features added 2026-10-06 (round 11, group F)

Everything below is registered on import of `module/rules/ext/f.mjs` (loaded by `module/rules/plugins/index.mjs` after e).
Strings are under `E20.RulesExtF.*`.

### Window counters shared by flag name (`ext/f/window.mjs`)

A rule `limit` keeps its own record (`ruleUses.<key>`); these name a Scene Clock flag outright - the `{epoch, window,
count}` records `mechanics/resources/scene-clock.mjs#markUsed` writes - so a count hand-written code (or another item) already keeps
carries on unchanged.

- **Tags** `self:windowUsed:<flag>:<window>[:<n>]`, `target:windowUsed:...`, `holder:windowUsed:...` - the actor's count
  under `flags.essence20.<flag>` in the current `scene` / `encounter` / `mission` is at least n (default 1). No other
  party: false.
- **Step `markWindow {flag, window, to?, clear?}`** - one more use on each recipient (a new window starts at 1);
  `clear: true` forgets the record.

### Events heard anywhere in the world (`ext/f/watch.mjs`)

A Trigger's `watch` reaches tokens in the viewed scene; these reach every world actor holding a Trigger for the event, and
the actor it happened to (token actor or not). Steps act as the holder; `target` is the actor it happened to
(`target:self` - the holder itself).

- **`rollSeen`** - a check was rolled (any actor, the extensions' postRoll on the roller's client): `@var.crit`,
  `@var.fumble` (1 / 0), `@var.failed` (it had rows and all failed), `@var.upshifted` (the dialog closed with a net ↑1+,
  rule switches included), `@var.assisted` (a Lend Assistance Edge / ↑ was waiting for the roll), `@var.total`. The two
  dialog facts are noted by an applyDialog hook and used up by the roll.
- **`conditionSeen`** - an Active Effect with status ids landed on an actor (this user's change): `@var.statuses`
  (comma-joined - `var:includes:statuses:<id>`), `@var.condition` (1 when one is a listed Condition).
- **`rollMessage`** - this user posted a chat message whose first roll has a d20: on the speaker's world actor only,
  `@var.total`.
- **Tags** `target:sideAlly` / `target:sideEnemy` - same / opposite non-neutral side by disposition (the active token's,
  else the prototype token's), never itself; works off the canvas. `self:emotion[:<option>]` - that Emotional Mastery
  option is active for the actor (its own, or one Team Spirit lent while the lender still has it; bare: any).
- **Pick source** `activeEmotions` - the actor's active options, labelled `E20.EmotionalMastery<Option>`.

### Hit multipliers and the finishing-move pieces (`ext/f/finisher.mjs`)

- **`HitMultiplier {multiply, damageType?, choiceFrom?}`** (scopes `self`, `megaform`) - a landed weapon hit deals
  `multiply` times its damage (a note "+N (label)", N = damage × (multiply - 1)) and, with `damageType` (a type or
  `{choice.<key>}`), that type instead. `choiceFrom: <16-char id>` - a `{choice.*}` the rule's item hasn't made is read
  from its holder's copy of that book item. `when` sees the hit like a HitRider (`roll:switch:<key>`, `item:`,
  `attack:melee`, `target:`; self = the one who hit, holder = the rule's holder). One book item counts once per hit.
  Registered with `registerHitRider(fn, {before: ruleDamageDealt})`: after the slices' own riders, ahead of the rules'
  flat bonuses (so a +1 DamageModifier isn't multiplied - where the hand-written finisher sat).
- **Tags** `item:styleChoice:<key>[:<id>]` - the rolled attack's style (melee, anything else counts as ranged) is the
  one picked under `<key>` on the rule's item, else on its holder's copy of book item `<id>`; no pick - any.
  `target:resistsChoice:<key>[:<id>]` - the other party has Resistance to the type picked (same lookup), else to the
  rolled attack's own type; no other party - false.
- **Step `rollEach {to, skills, dif, prompt?, onAllSucceeded?, onAnyFailed?}`** - each recipient picks one of the Skills
  (a cancelled pick fails) and rolls it against the DIF (grants.mjs#rollTest); then one branch. `@var.failures`,
  `{var.failedNames}`. `prompt` may be an `E20.` key (formatted with `{name}`, the roller).
- **Recipient `participantPilots`** - the first target's (a Megaform's) Zord participants: each one's driver, else the
  Zord.

### Standing Skill dice (`ext/f/skill-die.mjs`)

- **`SkillDie {skill, edge?, bestOf?: "participants"}`** (scopes `self`, `megaform`) - derived data among the extensions'
  derived hooks: `edge` sets the Skill's own standing Edge (`system.skills.<skill>.edge`, not an untickable roll source);
  `bestOf: participants` (scope megaform) raises the Megaform's Skill die to the best its Zord participants have in their
  own such Skill. `skill: "initiative"` = the Skill the actor rolls Initiative with (`system.initiative.skill`).

### Reaction answerers found by lookup (`rules/reactions.mjs`, `ext/f/reactors.mjs`)

- **`registerReactorLookup(who, find)`** (rules/reactions.mjs) - a `who` whose answerers aren't canvas tokens holding the
  rule. `find(info, row)` (row null for a card-wide rule) returns `[{actor, item, rule, index, holder?}]`; those offers go
  through the same outcome / margin / `when` / limit / cost checks (no side check), `holder:` tags read the holder, and
  canvas actors' own rules with that `who` are skipped. The name joins `REACTION_WHO`.
- **`who: "megaformPilot"`** - on a Megaform participant's item: when the row's target is a Megaform it is part of, the
  Player Characters listing that participant on their sheet answer (one button each). A Megaform Trait with no rules of
  its own (homebrew) answers with the book Trait of the same `system.type` (`TRAIT_TWINS`: defender). The plug-in loads
  rules/reactions.mjs lazily (`lookupReady`), so tests that mock the react slice's core still load ext/index.

### Helper hooks

- `mechanics/item-hooks.mjs#registerHitRider(fn, {before})` - insert ahead of an already-registered rider.

Tests: `module/rules/engine11-f.test.js` (18 tests).

## Verdicts

| Item | Verdict |
|---|---|
| Signature Finishing Move | Converted |
| Megaform Advanced Signature Finishing Move | Converted |
| Emotional Strength (all twelve options, Anger included) | Converted |
| Mobile Headquarters (Megaform half, and the holder's own Initiative Edge) | Converted (the allied-scene Initiative Edge stays code) |
| Megaform Defender | Converted |

## Converted

`module/rules/conv11-slF11.test.js` (22 tests) loads each from its pack and checks what the removed code did.

- **Signature Finishing Move:** an `added` Trigger and a Use pick `style` (melee / ranged) and `damageType` (`ifUnset`,
  old `flags.essence20.zord1Finisher.*` as `legacy`); a DialogSwitch (scope megaform, `stacks: false`, key
  `signatureFinish`, `forget`) on the Megaform's attack of that style while `not:self:windowUsed:zord1SfmUsed:scene`, its
  step marking `zord1SfmUsed` on the Megaform; a HitMultiplier ×4 of `{choice.damageType}` (not with the advanced switch
  ticked); an afterRoll Trigger posting the Reach / Range line.
- **Advanced Signature Finishing Move:** Use "Initiate" - require `megaform:in`, focus the Megaform, require
  `not:target:windowUsed:zord1AdvSfmUsed:mission`, mark it, `rollEach` over `participantPilots` (the ten Strength / Speed
  Skills, DIF 15, prompt `E20.Zord1AdvSfmSkill`): all succeed - mark `zord1AdvSfmReady` (scene) and say so; any fails -
  the fizzle line with the names. Two DialogSwitches (default on, `self:windowUsed:zord1AdvSfmReady:scene`, the SFM
  sibling's style), one with Edge when the target resists the finisher's type (`target:resistsChoice:damageType:<SFM>`);
  ticking clears the ready flag. HitMultiplier ×5 with `choiceFrom` the SFM; the Reach line.
- **Emotional Strength:** one Trigger per option, each gated on `self:emotion:<option>` and
  `not:self:windowUsed:emotionalStrengthUsedThisEncounter:encounter`, steps markWindow + gainResource 1d2 Personal Power +
  a line: Anger (`takesDamage`), Contempt / Joy / Disgust / Distress / Shame / Shyness (`rollSeen`: crit by an enemy /
  ally, Fumble by an ally / self, failed self roll with ↑1+ / Lend Assistance), Surprise (`rollMessage` 2 or 25+), Fear /
  Sadness (`conditionSeen`: self gains Frightened or Impaired / an ally gains a Condition), Guilt (`groupTestResult`
  success 0); Use "Claim a trigger" (Interest) - pick from `activeEmotions` (auto when one), then the same steps.
- **Mobile Headquarters:** `SkillDie {skill: initiative, edge}` (the Zord's own Edge) and `SkillDie {scope: megaform,
  skill: initiative, bestOf: participants, edge}`; its crew ↑1 RollModifier was already a rule.
- **Megaform Defender:** Reaction `who: megaformPilot`, `attackOnly`, `outcome: hit`, cost 1 Personal Power (path),
  step `lateSnag`, label "Defender: Snag the attack (1 Personal Power)".

Removed code: `helpers/extensions/zord1/megaform.mjs` and `zord1/emotions.mjs` (deleted; imports dropped from
`zord1/zord1.mjs` and `items/index.mjs`); `items/resources/emotional-mastery.mjs#checkEmotionalStrengthAngerTrigger`
with `EMOTIONAL_STRENGTH_ID`, `EMOTIONAL_STRENGTH_ENCOUNTER_FLAG` and the perks.mjs imports only it used; its two calls
and import in `mechanics/combat/combat.mjs`; `pr1/jtt.mjs#mobileHqDerived` (+ its `registerDerived`, `SHIFTS`, the `componentsOf`
import); `react/reactions.mjs`'s `REACT`, `megaformDefenderPilots`, the Megaform Defender `registerReaction`, `lowered`,
`_test` and the imports only they used. Old tests removed: zord1.test.js (Emotional Mastery, Megaforms), pr1.test.js
(Megaform initiative + the derived half of the allied test), react.test.js (two Megaform Defender tests),
combat.test.js (Anger trigger, 3), emotional-mastery.test.js (`checkEmotionalStrengthAngerTrigger`, 5).

## Behaviour differences worth a decision

- The finishers' scene / day / ready counts keep their old Megaform flags, so existing state carries over - but they're
  marked on every Megaform the holding Zord is in (`to: megaform`), not only the one rolling (a Zord in two Megaforms at
  once).
- `stacks: false`: with two participants holding the same finisher, the first in the roster decides (the old code took
  the first whose style matched the attack).
- Ticking both finishers still deals only ×5, but now also spends the plain finisher's scene use.
- Finisher picks post the engine's "Picked" lines instead of "{style} finishing move noted"; the Advanced Use's "not part
  of a Megaform" / "used today" are chat lines on its card, not warning toasts.
- Emotional Strength: Anger now posts a chat line like the others (dice + "{name} regains N Personal Power"), under an
  "Emotional Strength (Option)" heading; the old one-line format is gone. The Interest Use is unavailable (not a warning)
  with no option active or the use spent, and its pick is kept on the item as `claimed`.
- Shame's ↑1 fact is read after the rules' dialog switches are applied (the plug-in loads after the adapter), so a ticked
  rule switch's ↑ now counts.
- Mobile Headquarters' own Edge applies to any actor type holding it (the code checked zord / vehicle; it's a Zord
  Feature).
- Megaform Defender's result lines are the engine's lateSnag lines (CardLateSnag + CardNowMisses / CardStillHits) instead
  of ReactLoweredMiss / ReactLoweredHit; the cost is paid through changeResource (relayed) and a button on a card posted
  before the update may be offered again (the claim key changed).

## Still code (0)

None of the five. Mobile Headquarters' Edge for the other allied vehicles and Zords in the scene stays code
(`pr1/jtt.mjs#mobileHqInitiative`, at Initiative): it reads other tokens' actors, which can't be done in derived data
(synthetic actors loop on world load) - permanent unless an Initiative-time rule hook is built.

## Shared-file edits

- `module/rules/reactions.mjs`: `REACTOR_LOOKUPS`, `registerReactorLookup`, `lookedUpEntries`; `reactionOffers` walks the
  canvas actors' rules (skipping looked-up `who`s) then the looked-up entries, `holder` in the `when` context.
- `module/rules/plugins/index.mjs`: `import "./f.mjs";` (after e, before g).
- `module/mechanics/item-hooks.mjs`: `registerHitRider(fn, {before})`.
- `module/items/index.mjs`: zord1 `emotions.mjs` / `megaform.mjs` imports removed.
- `module/helpers/extensions/zord1/zord1.mjs` (rewritten whole - 10 lines, imports + header), `megaform.mjs` and
  `emotions.mjs` deleted, `zord1.test.js`.
- `module/items/resources/emotional-mastery.mjs` / `.test.js`, `module/mechanics/combat/combat.mjs` / `.test.js`.
- `module/items/rolls/time-displaced.mjs` / `pr1.test.js` (Mobile Headquarters only - Warhead Magazines untouched).
- `module/items/defenses/attack-card-reactions.mjs` / `react.test.js`.
- Pack sources (text inserts, CRLF kept): the five items above (Mobile Headquarters appended to its rules array).
- `zord1/common.mjs`'s `isAllyOf` / `isEnemyOf` are now unused exports (left in place).

## Unused strings

Now unreferenced in `lang/en.json` (checked over module/, templates/, tours/ and packs/): E20.Zord1EmotionalStrength,
E20.Zord1EmotionalStrengthPrompt, E20.Zord1EmotionalStrengthUsed, E20.Zord1SfmStylePrompt, E20.Zord1SfmDamagePrompt,
E20.Zord1SfmSet, E20.Zord1ToggleSfm, E20.Zord1ToggleAdvSfm, E20.Zord1SfmReach, E20.Zord1SfmNotCombined,
E20.Zord1AdvSfmUsed, E20.Zord1AdvSfmFailed, E20.Zord1AdvSfmReady, E20.ReactMegaformDefender, E20.ReactLoweredMiss,
E20.ReactLoweredHit. Still used: Zord1SfmMelee / Zord1SfmRanged / Zord1AdvSfmSkill (pack rules), ReactNoPower (core).
New strings: `<scratchpad>/r11/lang-f.json` (`RulesExtF.RollEachPrompt`).

## Rule count

25 rules added to 5 pack items. `scripts/check-rules.mjs`: 2375 rules on 1373 items, 0 errors, 0 warnings. ESLint
(`--ext .js,.mjs`, linebreak-style off) clean on every touched file. Jest: `engine11-f.test.js` (18) and
`conv11-slF11.test.js` (22) pass, as do the touched slices / helpers and every engine10 / conv10 suite; full suite below.
