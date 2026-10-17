# Cleanup 18 - shared item lookups, and no book text in comments

Two jobs, done while four other agents were converting items in the same checkout. Nothing was committed; the
changed paths are staged. Several of these files (dice.mjs, predicate.mjs, steps.mjs, target-riders.mjs,
rider-uses.mjs, team-actions.mjs, nanomite-uses.mjs, item-modifier-stage.mjs) also hold other agents' edits from
the same session, so staging them stages those too.

## 1. Local `sourceOf` / `itemsOf` copies replaced by `items/shared/item-lookups.mjs`

How the copies were matched to the shared helpers:

- `sourceOf` ending `?? null` became `sourceOf`.
- `sourceOf` with no `?? null` became `sourceOfOrUndefined as sourceOf`. That keeps `undefined`, which matters
  for `BY_SOURCE[sourceOf(item)]` lookups and `==` against possibly-undefined ids.
- `itemsOf` copies of the shared shape became `itemsOf`. The shared shape is: no items gives `[]`, an array
  `contents` is returned, any other iterable is spread, anything else gives `[]`.
- Copies of the form `items?.contents ?? (items ? [...items] : [])` also became `itemsOf`. They give the same
  result for every real input: a Foundry Collection, an array, a Map, or a null actor or items. The one
  difference is a malformed non-iterable `items`, where the old copy threw and the shared one returns `[]`.

Exported copies are now re-exports (`export { sourceOf }` and so on), so files that import them from the old
module, and tests that mock those modules, still work. No `jest.unstable_mockModule` path needed changing,
because nothing mocks `item-lookups.mjs`.

Files changed:

- mechanics/actions: commands.mjs (its inline items list in `has` is now `itemsOf`), action-perks.mjs (also
  `isCommandUse`), team-actions.mjs
- mechanics/companions: summons.mjs, contacts.mjs, companions.mjs, companion-uses.mjs, companion-link.mjs,
  bonded-partners.mjs
- mechanics/resources: kits.mjs, grants.mjs, grant-uses.mjs, nanomite-uses.mjs (`sourceIdOf`)
- mechanics/rolls/group-tests.mjs (also its inline items list)
- mechanics/combat: rider-uses.mjs; target-riders.mjs (`sourceOf` is re-exported); reaction-engine.mjs
  (`sourceOf`, `itemsOf` and `findSourced` are re-exported)
- items: attacks/weapon-upgrades.mjs (`sourceOf`, plus `idOf`, which is re-exported);
  forms/dino-thunder-grid-powers.mjs (`findSourced` is re-exported; it only `.find`s, so handing back the
  plain array instead of copying makes no difference); defenses/armor-brawn-reinforced-shell.mjs (`itemsOf`,
  read-only use); zords/combiner-roster-helpers.mjs (`sourceOf` only)
- rules: predicate.mjs, lifecycle.mjs, index.mjs (`itemsOf`), steps.mjs (`sourceOfItem` is now an alias)
- rules/plugins: book/effects.mjs, book/followups.mjs, tags/barehanded-tags.mjs, tags/item-pack-tag.mjs,
  tags/tokens-holding-ref.mjs, shared/target-facts-step.mjs, shared/report-facts.mjs, shared/left-b-text.mjs,
  shared/zord-crew-lookups.mjs, shared/side-and-copy-helpers.mjs, shared/hit-rider-lookups.mjs (both helpers
  re-exported), shared/team-and-availability-helpers.mjs, shared/card-text-helpers.mjs,
  shared/copy-and-data-helpers.mjs, shared/lazy-helpers-and-targets.mjs (`sourceOf` only),
  resources/uses-grant-pieces.mjs, picks/canvas-items.mjs, picks/entry-grants.mjs, picks/owned-item-steps.mjs,
  effects/item-modifier-stage.mjs, combat/attack-resistance.mjs, combat/card-hit-multiplier.mjs,
  combat/damage-immunity.mjs

### Copies kept on purpose

| Where | Why it differs |
|---|---|
| `itemsOf` in items/zords/combiner-roster-helpers.mjs and in rules/plugins/shared/lazy-helpers-and-targets.mjs, team-and-availability-helpers.mjs (via its `listOf`), card-text-helpers.mjs and copy-and-data-helpers.mjs | A plain array of items is handed back as is; the shared `itemsOf` copies it, and `itemsOfAny` also unwraps Map entries. These are exported with many callers, so this pass didn't audit whether any caller mutates the result. Each one now has a comment saying so. |
| mechanics/combat/weapon-traits.mjs `sourceOf` | Ends `?? ''`. `'' == undefined` is false, unlike `null == undefined`, so `actorHas(actor, undefined)` behaves differently. |
| rules/plugins/resources/party-requisition.mjs, combat/crew-incoming.mjs, combat/targeted-defense.mjs `sourceOf` | Fall back to `item.name` / `item.id`. |
| rules/legacy-choices.mjs `sourceId` | Reads `rulesSource` first and returns the id segment. |
| rules/inherit.mjs `sourceUuidOf` | Leaves out `rulesSource` on purpose; `rulesSourceOf` adds it on top. |
| rules/adapter.mjs (a closure inside one function) and the one-off inline `flags.core.sourceId ?? ...` expressions in documents/, sheet-handlers/ and elsewhere | Not helper definitions. role-handler.mjs:302 and migration.mjs:543 also read `compendiumSource` first. Left alone. |
| `listOf` / `worldList` in rules/plugins | Generic collection helpers, not item lookups. Out of scope. |

## 2. Book text in comments

Comments that quoted Essence 20 rulebook sentences now give a short paraphrase plus the page reference. All of
module/dice.mjs was covered: no quoted passage of 10 or more words is left, and the 8-9 word quotes that were
whole book sentences were rewritten too. The same pass covered every quote of 10 or more words in these files:
util/config.mjs, documents/actor.mjs, mechanics/companions (companions, summons, contacts, bonded-partners),
mechanics/actions (commands, team-actions, lend-assistance, action-perks), mechanics/rolls/group-tests.mjs,
mechanics/resources (kits, nanomite-uses), mechanics/combat/target-riders.mjs, items/zords/combiner-merge.mjs,
items/attacks/weapon-upgrades.mjs, items/forms/dino-thunder-grid-powers.mjs and
items/defenses/armor-brawn-reinforced-shell.mjs.

**Not finished.** About 330 quoted passages of 12 or more words are still in comments, spread thinly across
roughly 150 other module/ files. The biggest are mechanics/combat/combat.mjs and items/forms/ranger-form-perks.mjs
(8 each), then vessel-conditions.mjs, named-actions.mjs and megaform-attacks.mjs (7 each). This scan lists them:
for each comment block in a file, print every "..." span of 12 or more words. The script used for this batch
(`quotes.cjs`, run as `MIN=12 node quotes.cjs <files>`) lives in the session scratchpad and can be rebuilt in a
few lines.

## Checks

- eslint (`--ext .js,.mjs --rule 'linebreak-style: off'`) on all 53 touched files: clean.
- Full jest suite: 347 of 350 suites passed. The 3 failures belong to other agents' in-progress work:
  rules/editor.test.js, rules/phase2.test.js and rules/rules.test.js all expect the old rule-summary wording
  ("on might tests"), but the new, untracked rules/describe-when.mjs now writes "on Might tests". An earlier run
  also failed on that work: conv3-slD3 (the untracked HealthOverflow rule type), engine12-h (addEffect naming)
  and documents/item.test.js (Brutal Might's code was removed from item.mjs). Those three passed on the final run.
- Line endings: every touched file kept its own endings. 47 are CRLF; dice.mjs, reaction-engine.mjs,
  rider-uses.mjs, target-riders.mjs, card-hit-multiplier.mjs and barehanded-tags.mjs were already LF and stay LF.

## 3. Follow-up: the remaining book quotes

The note above, "Not finished", is now done. Every remaining quoted rule passage of 12 or more words in module/
comments is rewritten as a short paraphrase with its page reference. That includes the four files left partly done
(action-perks.mjs, nanomite-uses.mjs, dino-thunder-grid-powers.mjs, armor-brawn-reinforced-shell.mjs). A few quoted
phrases that were codebase idioms rather than book text (for example in power-adaptation.mjs, summon-armor.mjs,
power-use.mjs and banked-buffs.mjs, plus a GitHub issue title in aoe-targeting.mjs) were reworded too, so the scan
comes back clean.

158 files changed in this pass. By folder:

- **mechanics/**: actions (action-economy, action-perks, combined-weapons, heal-action, hidden-state,
  named-actions); characters (alteration-adjustments, creature-tags, perks, power-use, spectrum-shifted,
  starting-essences, threat-rules, vision-grant); combat (aoe-targeting, combat, defense-choice,
  effective-threat-level, essence-attack, essence-damage, forced-movement, implied-conditions, mlp-stress,
  nearby-allies, ongoing-effects, poisoned-hate-plague, reload-trait, save-riders, sneak-attack, token-movement,
  vehicular-trait, weapon-traits); resources (banked-buffs, requisition, story-points, temporary-resources);
  rolls/reroll; vehicles (combiner-timer, megaform-damage, vehicle-defeat, vehicle-upgrades, vessel-conditions,
  zord-summon); world (environment, environment-gated-effects, environment-hazards, environmental-expertise,
  rough-terrain).
- **items/**: attacks (cover-blasts, covering-fire, electromagnetic-vs-computerized, energy-affinity, fanning,
  high-density, mounted-weapons, mythically-modular, on-hit-status-drive-by, planted-bombs, psycho-weapon-riders,
  team-focus, volley, weapon-perk-uses); defenses (at-all-cost, bulwark, exo-frame, iron-bravado-shared-immunity,
  modular-armor, mysterious-aura, personal-shield-uses, powered-plating, protected-target, splinter-defense); forms
  (dino-thunder-grid-powers, mega-defender, mode-lock-energon-flush, monster-grow, power-adaptation,
  ranger-form-perks); gear (equipment-qualification, nanomite-gear, poison-coating, power-ranger-standard-issue,
  qualification-perks, support-upgrade-lending, why-do-i-know-that); healing/heal-skill-test; magic (block-magic,
  circle-of-magical-friends, disguise-spell, dont-notice-me-field, fluttery-wings, foolscarrot, glittermane,
  greased-lightning, hot-to-trot, lightning-speed, mind-beam, mind-beam-calm-confused, mystery-sense,
  mystic-non-mystical, ookie-spookies, summon-armor, temper-tempest-sorcery-builder); movement/field-aid; resources
  (addicted-dark-energon, consummate-performer, dark-energon-addiction-attack, emotional-mastery, energon-strains,
  repair-progress-bonus-energon); rolls (deconstruct-bestial-articulation, mark-target, old-hand-do-or-die,
  primary-quarry, quiet-one, reckless-abandon); senses (blindsight, phantom-suite); social (betrayal, calming-words,
  friendship-circle, voice-of-primus); vehicles/roll-cage; zords (commander-combiner-feature, megaform-attacks,
  warrior-mode, zord-feature-picks).
- **rules/plugins/**: combat (evasive-maneuvers-rule, incoming-hits-and-minions), dialog/clear-snag-cost, picks
  (best-item, flagged-companion-and-mentions), resources (action-cost-any, kit-options, refund-use), zords
  (converted-event-and-seen, driverless-essence, zords).
- **Other**: data (actor/vehicle, item/alt-mode, item/alteration, item/armor, item/hangUp, item/weapon,
  reroll-schema); sheet-handlers (drop-handler, listener-item-handler, listener-misc-handler, perk-handler,
  power-handler, transformer-handler, vehicle-handler); sheets/base-actor-sheet; apps/story-points;
  documents/item; importers/monster-grow-generator; chat; essence20.

**Scan result.** The scan finds no quotes of 12 or more words left in module/*.mjs, with one exception:
rules/describe-when.mjs, another agent's new, untracked file, which I didn't touch. It shows 2 hits, and both are
examples of that file's own generated summary text, not book text.

**Checks.**
- eslint (`--ext .js,.mjs --rule 'linebreak-style: off'`) on all 158 files: clean.
- Line endings: every file kept its own. 155 are CRLF and 3 were already LF.
- Full jest suite: 351 of 351 suites and 7907 of 7907 tests pass.
