# Book check - durations (2026-10-06)

Scope: the `durations` group of the book check (the user ruled the BOOK is the source of truth). Each item was read in
its own printing; when code, notes and book disagreed the rules now do what the book says. Plus two items the costs agent
passed on (Natural Movement, Stand Firm) and the general "rounds out of combat" behaviour.

## Verdicts

| Item | Printing (book p.) | What the book says (paraphrase) | What changed |
|---|---|---|---|
| Loyal Minions | Decepticon Directive p.50 | Free action DIF 10 test; Mini-Cons get ↑1 until the start of your next turn | Toggle `until: endOfRound` -> `nextTurnOrScene`; chat line and notes |
| Remote Operations | Factions in Action V1 p.45 | Standard action DIF 10 Alertness; Lend Assistance for the rest of this turn | Use costs a Standard action; mark `until: combat` -> `turnOrScene`; notes |
| Rallying Cry (GI Joe) | GI Joe CRB p.99 | Free action; Edge on attacks until the end of your next turn or until you are Defeated | Mark `endOfNextRound` -> `endOfNextTurn` (your turns); the Edge stops while the setter is Defeated (`not:holder:status:defeated`); Use costs a Free action; notes |
| Bio-Energy Conversion | Beneath the Helmet p.72 (pack said "Across the Stars" - fixed `system.source.book`) | Standard action; on your next turn ↑2 and +2 damage on attacks | Marks: `bioEnergyWait` until `nextTurnOrScene` + `bioEnergyNext` until `endOfNextTurnOrScene` (was this round off / whole next round on); Use costs a Standard action |
| Box Shot | Quartermaster's Guide p.28 | Once per combat, one Attack action against two targets | New afterRoll Trigger switches it off after the attack (was on until switched off); notes |
| Phantom | GI Joe CRB p.74 | Free action; Invisible until the start of your next turn; ends early on a non-Takedown attack or damage | New turnStart Trigger ends it (removes Invisible); Use costs a Free action; notes |
| Resilience (duration half) | PR CRB p.53 (both printings) | Reduce all incoming attacks by the Athletics roll until the start of your next turn | Bank `persist: true, until: nextTurnOrScene` (was used up by the first attack, `until: combat`); notes. The Morphed gate was already added by the costs agent |
| Rise Again | Through the Shattered Grid p.115 | Once per scene, Free action: +5 to a Defense until the start of your next turn | Banks `persist: true, until: nextTurnOrScene` (was next attack only); Use limit `encounter` -> `scene`, Free action cost, label/prompt, notes |
| Fly In The Future | GI Joe CRB p.62 | Evasive flying lasts until the beginning of its next turn | Toggle Use split: "until your next turn" (`setToggle value true, until nextTurnOrScene`) + "Stop evasive maneuvers"; notes (the pilot's turn stands in for the vehicle's) |
| Consult Memories | Field Guide p.68 | 10 minutes: ↑2 and Specialization in a Skill for one scene | Mark `until: encounter` -> `scene`, limit `encounter` -> `scene`. Extra scenes for Personal Power: still left to the table |
| I Can Do That / I Can Still Do That | A Jump Through Time p.33 / 34 | Copy until the end of your next turn (Still: the same copy again) | already matches (`endOfNextTurnOrScene`) |
| Deadstick | Quartermaster's Guide p.26 | Stunned for 1 round | `applyCondition ... rounds: 1` (both branches) |
| Absolute Menace | Beneath the Helmet p.40 | Frightened until the end of YOUR next turn | `applyCondition ... until: endOfNextTurn` (new) |
| A Logical Explanation | WTNV Citizens' Guide p.37 | Stunned until the end of THEIR next turn | `until: endOfNextTurn, untilOf: recipient` (new) |
| Elemental Storm | Beneath the Helmet p.42 | Once per scene; Blinded / Deafened / Prone until the end of their next turn | `until: endOfNextTurn, untilOf: recipient` on all three; limit `encounter` -> `scene` |
| Soothe | Hawk's Personnel Files p.174 | Mesmerized until the beginning of your next turn | `until: nextTurn` (new) |
| Voice of Primus | Enigma of Combination p.41 | Frightened for 2d2 rounds | `rounds: "2d2"` (both Skill branches) |
| Extended Attack | Transformers CRB p.90 | Move action; double a Melee weapon's Reach until the beginning of your next turn | Use costs a Move action, `setToggle value true, until nextTurnOrScene`, offered only while off; notes |
| Hard Corps | Sgt Slaughter Sourcebook p.8 | Ignore one attack until the end of the scene (example: of combat); Defeated if Health is then below it | New sceneStart Trigger settles any debt left (an unstarted combat, or none); the combatEnd Trigger stays; notes |
| Technical Mastery | Quartermaster's Guide p.22 | d2 crits on Technology also for allies benefiting from Trade School (which lasts a scene) | New CritOnD2 on the `tradeSchool` mark (the coached scene); the first-roll one stays |
| Natural Movement (from costs) | GI Joe CRB p.93 | Standard action; Climb / Swim until the end of your next turn | Toggle `until: endOfNextTurnOrScene`; notes |
| Stand Firm (from costs) | Transformers CRB p.91 | Move action; double Stalwart Defense until the beginning of your next turn | already matches (scaleBank keeps the Stalwart banks' `nextTurn`); notes say so |
| Rounds out of combat (general) | PR CRB p.179 (Time) | A round is 6 seconds; 10 rounds make a minute | `rounds:N` out of combat now lasts N x 6 s of game time, also ending with the scene (was: the scene) - see below |

## Engine features added 2026-10-06 (book check, durations)

- **`rounds:N` out of combat** (rules/expiry.mjs): a round is 6 seconds (Core Rulebook, Time). Stamped out of combat it is
  `{oocRounds, time, sceneEpoch}`: it runs out after N x 6 seconds of game time or when the scene ends, whichever is first.
  If a combat starts meanwhile (this system moves no game time per round), the rounds not used up out of combat last from
  its round 1. In a running combat nothing changed. `roundsThrough:N` (action-cost-any.mjs) still lasts the scene out of
  combat.
- **`applyCondition {until: nextTurn | endOfNextTurn, untilOf?}`** (steps.mjs + mechanics/combat/timed-status.mjs
  `turnBoundTiming`): the Condition ends as the holder's (or, `untilOf: recipient`, the recipient's) next turn starts /
  ends - "until the start of your next turn", "until the end of their next turn". Its next turn is this round's if it hasn't
  acted yet, else the next round's. Done with v14's own effect expiry (`duration.expiry` turnStart / turnEnd matched
  against `start.combatant`). Not in the turn order: 1 round; out of combat: no duration (as `rounds` already was). Goes
  through the GM relay too (`gmDo` status op carries `timing`). Only these two (and their `...OrScene` spellings) are
  accepted on applyCondition.

## Behaviour differences worth a decision

- Plain `applyCondition rounds: N` (all the older items, Deadstick now too) writes the legacy `duration.rounds` keys; in v14
  that ends the Condition when the round count runs out, at the next round's start, not at the applier's turn. Items whose
  book says "until the start of your next turn" should move to `until: nextTurn` (only Soothe did here).
- Extended Attack doubles the Reach of every Melee weapon; the book says one. Left as it was (now in the notes).
- Fly In The Future counts the pilot's turns, not the vehicle's.
- Rallying Cry still needs a combat (book silent out of combat - kept).
- Rise Again and Elemental Storm: limits moved to once per scene with the book (were once per encounter).

## Shared-file edits

- `module/rules/expiry.mjs` - `ROUND_SECONDS`; out-of-combat `rounds:N` stamp in `stampFor`; its check in `isExpired`;
  header comments.
- `module/rules/steps.mjs` - `applyCondition` reads `until` / `untilOf` (turnBoundTiming); `stepErrors` limits
  applyCondition's `until`.
- `module/mechanics/combat/timed-status.mjs` - `applyTimedCondition(..., timing)`; new `turnBoundTiming`.
- `module/mechanics/combat/reaction-engine.mjs` - the `status` op passes `op.timing`.
- Old tests updated: engine3 (rounds:N out of combat), conv14-items1 (Extended Attack), conv14-items2 (Remote Operations),
  conv15-banked (Resilience), conv15-items2 (Fly In The Future), conv17-perm (Technical Mastery).

## Tests

`module/rules/book-durations.test.js` (32 tests). Full suite: 7782 passed; 1 failure in `actions.test.js` (another
agent's ActionCost `limit.per` message now lists `round`) - not mine.

## Unused strings

None.
