# Batch slJ13: round 13, group J - unlinked tokens in the world sweeps, and Spellcialize

**Scope:** (1) the Dino Drive Mode clean-up regression from slH12 (its `sceneStart` Trigger never reached unlinked token
Zords; the old hand-written sweep did) - fixed in the engine, for every world-sweep event; (2) Mystical Understanding's
Spellcialize (still in `module/dice.mjs`, keyed on `MYSTICAL_UNDERSTANDING_ID` - slI12's "noticed" item) moved onto a
DialogSwitch rule on the Perk. Edited in place in the shared checkout (no branch, no commit).

**Result:** 1 engine fix + 1 tag, **2 items finished** (Dino Drive Mode back to the old reach, Mystical Understanding has
no item code left), **0 still code**. **1 rule added** (Mystical Understanding). `scripts/check-rules.mjs`: 2419 rules on
1376 items, 0 errors, 0 warnings. Full jest suite: 559 suites / 10469 tests, all passing.

## Engine features added 2026-10-06 (round 13, group J)

- **World sweeps reach unlinked tokens' actors** (`rules/triggers.mjs#sweepActors`, exported). Every world-wide sweep now
  walks the world's actors **plus the synthetic actors of unlinked tokens on the viewed scene (`canvas.scene`, and the
  canvas placeables) and the active scene (`game.scenes.active`)** - each actor once (deduplicated by object and by uuid;
  a linked token's actor is its world actor, so it never counts twice; a token with no actor is skipped). It is used by:
  - the `sceneStart`, `missionStart` and `sessionStart` Triggers (`worldActors()` in triggers.mjs);
  - the timed-item sweep (`sweepWorld` - items a step gave `until` a time, run at turn start, scene start and world-time
    changes);
  - the scene / mission **Pool** resets (`rules/adapter.mjs#resetAllPools`, a lazy import of triggers.mjs).
  All of these already run on the active GM only (the `essence20.sceneAdvanced` / `missionAdvanced` hooks call the
  extensions on `game.users.activeGM?.isSelf`; the session hook and world-time sweep check `isActiveGM`), so each fires
  once per actor per event. `turnStart` / `turnEnd` / `roundStart` were already per combatant - `combatant.actor`, which
  for an unlinked token IS its synthetic actor - and are unchanged.
- **Tag `roll:skillSpecialized`** (`rules/ext/j.mjs`) - the rolled Skill is itself Specialized on the roller
  (`system.skills.<skill>.isSpecialized`, the Skill's own flag - not a Specialization being rolled, which is
  `roll:specialized`). Unknown (null) with no roller or no rolled Skill.

Tests: `module/rules/engine13-j.test.js` (10 tests).

## Verdicts

| Item | Pack file | Verdict |
|---|---|---|
| Dino Drive Mode | `bthitems/_source/Dino_Drive_Mode_fpfH5KgJ3BdWAFtM.json` | fixed - unlinked token Zords cleaned up again (no pack change) |
| Mystical Understanding | `mlpcrbitems/_source/Mystical_Understanding_23NeoRDRxlo0LpyQ.json` | converted (Spellcialize) - no item code left |

## Converted

`module/rules/conv13-slJ13.test.js` (9 tests) loads each item from its pack and checks what the old code did.

- **Dino Drive Mode** - its `sceneStart` Trigger (`removeEffects pr2DinoDriveEffect`) now reaches unlinked token Zords
  on the viewed / active scene through the engine fix above, as the old `registerSceneAdvanced` sweep (world actors +
  `canvas.tokens.placeables`' actors) did; a linked Zord is cleared once. Its `turnStart` Trigger already reached a token
  Zord's own synthetic actor (the combatant's).
- **Mystical Understanding - Spellcialize** - a DialogSwitch `{label: "Spend 1 Mystical Point (Spellcialize:
  Specialized)", when: [not:roll:untrained, not:roll:skillSpecialized, not:roll:initiative], specialize: true, cost:
  {resource: {rolePoints: true}, amount: 1}}`, appended after the Perk's four rules (their indexes unchanged). Like the old
  checkbox: offered only on a trained (not d20) Skill whose own `isSpecialized` is off, while the base Role Points item
  has a point; starts unticked; ticked, the roll is Specialized and one point is taken from `actor._getBaseRolePoints()`;
  no action is spent. Never on Initiative (the old checkbox lived in `rollSkill` only, which Initiative doesn't use).
  Removed: dice.mjs's comment block, `spellcializeAvailable` and the `applySpellcialize` spend (and the now-unused
  `ideaPoints` read and `MYSTICAL_UNDERSTANDING_ID` import), the `applySpellcialize` / `spellcializeAvailable` plumbing in
  `apps/roll-options-dialog.mjs` and `helpers/roll-dialog.mjs`, the template's checkbox, `MYSTICAL_UNDERSTANDING_ID` in
  `helpers/magically-fit-in.mjs` (nothing else read it), and dice.test.js's Spellcialize describe block (3 tests) and its
  five `spellcializeAvailable: false` dataset expectations.

## Behaviour differences worth a decision

1. **The engine fix is general:** every `sceneStart` / `missionStart` / `sessionStart` Trigger, scene / mission Pool reset
   and timed-item expiry now also reaches unlinked tokens' actors on the viewed and active scenes - not only Dino Drive
   Mode's. Before, an unlinked NPC token's scene Pools never refilled and its timed items never ran out. Tokens on other
   (neither viewed nor active) scenes are still not swept (the old Dino Drive sweep didn't reach them either).
2. **Dino Drive Mode (unchanged from slH12):** the clean-up still only touches actors holding the Feature (the old hooks
   removed flagged effects from any actor - the same thing in practice, since only the Feature makes them).
3. **Spellcialize (small):** the switch is a rule switch (its label is the pack's short English line, listed with the
   other rule switches, a labelled source) instead of the fixed `E20.RollDialogSpellcialize` checkbox. With no base Role
   Points item (`_getBaseRolePoints()` empty) the engine falls back to the actor's first top-level Role Points item, where
   the old check offered nothing - in practice the same item. The spend can't push the points above their max (it never
   could by subtracting).

## Still code (0)

None.

## Shared-file edits

- `module/rules/triggers.mjs` - new exported `sweepActors()`; `worldActors()` and `sweepWorld()` walk it.
- `module/rules/adapter.mjs` - `resetAllPools` walks `sweepActors()` (lazy import of triggers.mjs).
- `module/rules/ext/index.mjs` - `import "./j.mjs";`.
- `module/dice.mjs` - Spellcialize's comment, availability and spend removed (the `MYSTICAL_UNDERSTANDING_ID` import with
  them); a one-line comment points to the rule.
- `module/dice.test.js` - the Spellcialize describe block and five `spellcializeAvailable: false` lines removed.
- `module/apps/roll-options-dialog.mjs`, `module/helpers/roll-dialog.mjs` - the `applySpellcialize` /
  `spellcializeAvailable` lines removed.
- `templates/dialog/roll-dialog.hbs` - the Spellcialize checkbox removed.
- `module/helpers/magically-fit-in.mjs` - `MYSTICAL_UNDERSTANDING_ID` removed, a comment updated.
- Pack source (text insert, file's EOL kept): Mystical Understanding (one rule appended).

## Unused strings

`E20.RollDialogSpellcialize`. No new strings (`<scratchpad>/r13/lang-j.json` is `{"RulesExtJ": {}}`).

## Rule count

1 rule added (Mystical Understanding's Spellcialize DialogSwitch). Tests: `engine13-j.test.js` (10) and
`conv13-slJ13.test.js` (9); dice.test.js lost 3.
