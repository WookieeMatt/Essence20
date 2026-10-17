# Book check - follow-ups (2026-10-06)

Scope: the items the other book-check groups found outside their own lists (scratchpad book/followups.md), the "until
your / their next turn" duration sweep, and one live-test finding from the coordinator (round-limited Conditions out of
combat). The user ruled the BOOK is the source of truth. Each printing was read in its own book; where the book is
silent the current behaviour is kept and listed.

## Verdicts

| Item | Printing (book p.) | What the book says (paraphrase) | What changed |
|---|---|---|---|
| Interdiction | Factions in Action V1 p.45 | Once per combat, Defeat a hit target of lower Threat Level instead of damage; only a target not aware of you | Awareness can't be detected (Hidden / Surprised don't cover it), so the switch now carries `ask:The target is not aware of you` and its label says so: ticking it is the player's statement. Limit, level gate and Defeat kept. Notes |
| Not Dead Yet | Factions in Action V2 p.70 | Once per scene, Standard action: 1 temporary Health; once per adventure 2 instead if another CSTO Personnel character can see and hear you; it lasts until lost or the scene's end | Use costs a Standard action; the 30 ft ally scan became a question ("can a CSTO Personnel character see and hear you?") offered while a CSTO ally is anywhere on the scene (`scene:token:target:ally&target:hasType:origin:CSTO Personnel`) and the mission window is unused; the grant is now `tempResource` (taken back at the scene's end - it was a permanent `system.health.bonus`). Notes |
| Growing Smolder | Finster's p.288 | If you made no attacks this turn, Free action once per turn: cumulative ↑1 (max ↑3) and +1 Fire damage to your attacks on the following turn | The bank for the next attack became turn marks: `growingSmolder` (count, `add`, until endOfNextTurnOrScene) + `growingSmolderWait` (until nextTurnOrScene); a RollModifier ↑min(3, count) and a scaled DamageModifier +min(3, count) apply to every attack while the wait is over and the mark runs; used again on that turn instead of attacking stacks; an afterRoll Trigger takes it away if you attack on the turn you used it. Use costs a Free action. The damage stays untyped (book: Fire) - listed below. Notes |
| Thrown Blade (Aerodynamics) | GI JOE CRB p.142 (QGtG Martial Artists kit) | Aerodynamic: double the range of a grenade or thrown weapon (GI JOE CRB p.149) | Already automated: the weapon brings its Aerodynamics upgrade attached, whose ItemModifier doubles 20/30 to 40/60 (the name makes it a thrown weapon). Notes fixed, status partial -> full |
| Extended Attack | Transformers CRB p.90 | Move action: double the Reach of a Melee weapon until the beginning of your next turn | The Use now picks one owned weapon (`pick from: ownedItem`, before the cost); the ItemModifier also needs `item:picked:extended`, so only that weapon's Melee attacks double. Notes |
| Deadstick | QGtG p.28 | Standard action, a robot within 100 ft, Technology vs Willpower or Cleverness, Stunned for 1 round | already matches (effects agent: robot + 100 ft `require`; durations agent: `rounds: 1`) |
| Beast Mode (+ Engrafted / Evolving / Outright Mutation) | Cobra Codex p.59, 80-81 | The Mutation's benefit (its Alteration) for one scene | When a rule removes an Alteration - its scene-long expiry (`sweepExpired`) or deleting the item that granted it (lifecycle's grant clean-up, e.g. "End Beast Mode") - `onAlterationDelete` runs first, so the Essence / Skill / Movement changes its drop wrote are taken back. Beast Mode notes |
| Better You Than Me | Finster's p.291 | 1 Void damage to the touched ally that can't be reduced in any way | A target this user doesn't own now gets a GM button card (`who: gm`) whose steps are the same `unreducibleDamage` step, instead of a "for the GM" text line the GM would apply as a normal hit. Notes |
| Deconstructionist | QGtG p.28 | Success: Skill Tests using the equipment, or that the equipment makes, gain Snag for 1 turn | Against a vehicle or Zord (the equipment itself): every test it makes, as before. Against a creature (an operator): you pick which of its items you disrupted (`pick from: targetItem`), and the bank applies only to rolls with that item (new tag `item:usesItem:{var.picked}` - the item, an attack of it, or a test naming it). Notes |

### The "until your / their next turn" sweep

Every rule with a round-based duration on applyCondition / mark / bank / setToggle / grant was listed (46 items) and the
ones whose step says less than a minute were read in their books.

Changed:

| Item | Printing (book p.) | Book | Was | Now |
|---|---|---|---|---|
| Brutal Display | Decepticon Directive p.58 | Frightened until the end of their next turn (Critical: a minute) | rounds: 1 | `until: endOfNextTurn, untilOf: recipient` (the minute stays rounds: 10) |
| Comms Assault | Decepticon Directive p.40 | Stunned until the end of their next turn | rounds: 1 | endOfNextTurn, recipient |
| Dirty Blows | Decepticon Directive p.57 | Impaired until end of their next turn | rounds: 1 | endOfNextTurn, recipient |
| Fearsome Voice | Decepticon Directive p.44 | Critical: Frightened until the end of their next turn | rounds: 1 | endOfNextTurn, recipient |
| Make An Example | Decepticon Directive p.44 | (a Fearsome Voice attack) | rounds: 1 | endOfNextTurn, recipient |
| Painmonger | Decepticon Directive p.41 | Impaired until the end of the target's next turn | rounds: 1 | endOfNextTurn, recipient |
| Bump & Run | Enigma of Combination p.38 | Critical: target Stunned until the end of their next turn; you Impaired until the end of your next turn | no duration / rounds: 1 | endOfNextTurn, recipient / endOfNextTurn (yours) |
| Manipulate | Field Guide p.65 | Grappled until the beginning of your next turn | rounds: 1 | `until: nextTurn` |
| Cruel Conflagration | Finster's p.284 | Impaired until the end of your next turn | rounds: 1 (both buttons) | endOfNextTurn (yours) |
| Ice Flechettes Effect / Alternate Effect | Finster's p.291 / p.302 | Critical: no armor bonuses until the end of their next turn | rounds: 1 | endOfNextTurn, recipient |
| Path of Frost (Monster Form freeze) | Finster's p.290 | Immobilized until the end of your next turn | rounds: 1 | endOfNextTurn (yours) |
| Elemental Fury (Air / Lightning / Water) | Through the Shattered Grid p.33 | Impaired / Stunned / Immobilized until the end of their next turn | rounds: 1 | endOfNextTurn, recipient (Earth's Prone unchanged) |
| Replacement Teeth | WTNV Citizens' Guide p.74 | Immobilized until the end of their next turn | rounds: 1 | endOfNextTurn, recipient |
| Nano-Med Mastery | GI JOE CRB p.82 | Edge until the end of your next turn | mark endOfNextRound | mark endOfNextTurn |
| Iron Bravado | A Jump Through Time p.45 | Immune to Frightened until the beginning of your next turn | mark endOfNextRound | mark nextTurn (out of combat unchanged: turnOrUntilCombat) |
| Your Safety's On | QGtG p.31 | Critical: Snag on its attacks until the end of your next turn | mark endOfNextRound | mark endOfNextTurn |

Checked and kept (book matches, or the book is silent on whose turn):

- Deadstick (1 round), Knock Down, Drag Out (Unconscious for 1 round), Smoke Screen (Blinded for 1 round), Smokescreen
  (Cover from a smoke canister), Snarl (Frightened "for 1 turn" - book silent on whose turn: kept 1 round), Shining Leader
  (this round and the following: endOfNextRound matches), Diversion (until the end of the next round: matches), Voice of
  Primus (2d2), Telltale Sign / Flashy (round counts), Tox-En / Chronicler / Brutal Display's Critical (a minute = 10),
  Summon Shield (2 rounds), Smoke Beam / Sparkle Blast / The Stare / Super Sticky Celebration String (spell rounds),
  Flight Conversion (three turns), Ninja Storm element (3 rounds), the 10-round toggles.
- Beast Morpher (Form) hang-up: Stunned until the end of THIS turn (BTH p.54) - applyCondition has no endOfTurn; kept
  rounds: 1.
- Electronic Countermeasures: "until the start of their [the crew member's] next turn" - the Use runs on the vehicle,
  which isn't in the turn order; kept rounds: 1 (the same point next round).

Not swept (hand-written code, not item rules): dice.mjs's Blinding Blast / blinding / deafening riders still call
`applyTimedCondition(..., 1)` for "until the end of their next turn".

## Engine features added 2026-10-06 (book check, follow-ups) - `module/rules/plugins/book/followups.mjs`

- **Tag `item:usesItem:<uuid or id>`** - the roll is made with that item: the rolled item is it, belongs to it (a weapon's
  attack), or the roll's `dataset.markedItemUuid` names it. Bank it with `appliesWhen: ["item:usesItem:{var.picked}"]`
  after a `pick from: targetItem` ("tests using the equipment" - Deconstructionist).
- **Alterations undone when a rule removes them** (`undoAlterations(actor, ids)`): rules/triggers.mjs#sweepExpired (timed
  items running out) and rules/lifecycle.mjs (items deleted with the item that granted them) run
  sheet-handlers/alteration-handler.mjs#onAlterationDelete for each Alteration first - the same undo the sheet's delete
  button does. A Beast Mode Mutation's scene-long Alteration, an Engrafted Mutation deleted from the sheet.
- **Round-limited Conditions out of combat** (mechanics/combat/timed-status.mjs + `sweepTimedConditions`): a round is 6
  seconds (PR CRB p.179). `applyTimedCondition(actor, status, N)` with no running combat stamps the effect with
  `flags.essence20.oocConditionExpiry = {until: "rounds:N", stamp}` (expiry.mjs's own out-of-combat rounds stamp); the
  sweep (turn starts, scene changes, world-time changes - the active GM's client) deletes the effect once N x 6 seconds of
  game time have passed or the scene has ended; a combat started meanwhile counts the rounds still left. This covers the
  `applyCondition` step (`rounds: N`, and `until: nextTurn | endOfNextTurn` out of combat = 1 round) and every other
  caller of applyTimedCondition (save cards, spell riders, cover blasts...). A combat set up but not started counts as out
  of combat now (it used to get the legacy duration.rounds from round 0).
- **`unreducibleDamage` on someone else's character** (plugins/book/effects.mjs): posts a GM button (`who: gm`) running the
  same step on that target, so the GM's apply is still unreducible.

## Behaviour differences worth a decision

- Interdiction: the switch is offered on every attack against a lower-Threat target; "not aware of you" is the player's
  call when ticking it (the system has no awareness state - Hidden and Surprised only cover some cases).
- Not Dead Yet: the 2-Health option is offered only while a CSTO Personnel ally is on the viewed scene (no distance - "can
  see and hear you" is the player's answer). The temporary Health now goes at the scene's end (book); before it stayed.
- Growing Smolder: the +1 damage per stack is untyped (book: Fire) - the engine adds a scaled bonus to the attack's own
  damage, as the old bank did. The book's "cumulative" is read as consecutive uses (↑2 after two turns of biding).
  Damage is cumulative too (book ambiguous - the old code's reading kept).
- Extended Attack: the pick offers every owned weapon (only Melee attacks are doubled).
- Deconstructionist: against a creature you pick any of its weapons / armor / gear / shields - "Computerized" is still the
  table's call (few pack items carry the trait).
- Out-of-combat timed Conditions now go after N x 6 s of game time - a GM who never advances time sees them last until the
  scene ends (they lasted forever before).

## Shared-file edits

- `module/mechanics/combat/timed-status.mjs` - out-of-combat rounds stamp (and the header comment).
- `module/rules/triggers.mjs` - `sweepExpired` calls `undoAlterations` before deleting.
- `module/rules/lifecycle.mjs` - the grant clean-up calls `undoAlterations` before deleting.
- `module/rules/plugins/book/effects.mjs` - `unreducibleDamage` GM button for a target this user doesn't own (+ runSteps import).
- `module/rules/plugins/index.mjs` - the follow-ups block at the end.
- Old tests updated: mechanics/combat/timed-status.test.js (running combat needs `started`; out of combat stamps),
  conversions-uses.test.js (spell Conditions: started combat; Smoke Beam out of combat), book-durations.test.js (applyCondition
  out of combat; Extended Attack's steps), conv14-items1.test.js (Extended Attack, Deconstructionist on a vehicle, Not Dead
  Yet's temporary Health), conv14-dice.test.js (old Growing Smolder bank test removed), conv15-banked.test.js (Your Safety's
  On mark).

## Tests

`module/rules/book-followups.test.js` (20 tests). eslint clean on every touched file; `node scripts/check-rules.mjs` 0
errors / 0 warnings; full jest suite 7844 passed (348 suites).

## Unused strings

None.
