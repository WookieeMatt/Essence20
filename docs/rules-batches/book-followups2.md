# Book check - follow-ups, round 2 (2026-10-06)

Scope: every line of scratchpad book/followups2.md (points the previous follow-ups / durations passes left open). The
user ruled the BOOK is the source of truth; each printing was read in its own book. Where the book is silent the current
behaviour is kept and listed.

## Verdicts

| Item | Printing (book p.) | What the book says (paraphrase) | What changed |
|---|---|---|---|
| Growing Smolder | Finster's p.288 (PDF p.290) | Free action if you made no attacks this turn: cumulative ↑1 (max ↑3) and +1 **Fire** damage to your attacks on the following turn | The scaled untyped DamageModifier became a `HitRider` with `option: {damage: min(3, @mark.growingSmolder), damageType: fire}` (same `when`): each hit on the following turn gets its own "Growing Smolder - N Fire" Apply button next to the weapon's damage (the Solar Power / Acid Sacs pattern). The ↑ shifts are unchanged. Chat line and notes say Fire |
| Beast Morpher (Form) - Cheetah dog Hang-Up | Beneath the Helmet p.51 (PDF p.54) | DIF 10 d20 or Stunned until the end of your turn | `applyCondition ... until: endOfTurn` (new for applyCondition): ends as the holder's current turn ends, or its next turn when it isn't acting now (a dog met on someone else's turn); out of combat 1 round (6 s) |
| Electronic Countermeasures | Quartermaster's Guide p.59 (PDF p.61) | Once per encounter, a crew member's Move action: vehicle +5 Toughness and Evasion until the start of THEIR next turn | `setToggle ... until: nextTurn, untilOf: user` (was `rounds:1` on the vehicle): the toggle's stamp counts the turns of the crew member who used it - the seated crew member whose turn it is, else this user's own character aboard, else a crew member this (non-GM) user owns; none found, the vehicle as before. Chat line and notes |
| dice.mjs Blinding / Deafened riders | QGtG p.33 (PDF p.35) Blinding effect & trait; QGtG p.34-37 Irritant Disperser, Molecular Reducer/Enlarger, Strobe; Finster's p.244/302 Flames of Hate, Pollen Cloud, Stinger Spray; Intercontinental Adventures p.92 (PDF p.94) Crowd Dispersal Energy Cannon | Blinding: blind until the end of their next turn (Finster's three say the same). Crowd Dispersal: "Blinded 1, Deafened 1, or Impaired 1" (Condition trait, number not defined further) | `_applyTraitRiders` (Blinding trait) and `_applyBlindingBlast` now pass `turnBoundTiming('endOfNextTurn', target)`: the effect ends as the TARGET's next turn ends (v14 expiry); out of combat / not in the turn order, 1 round. A weapon with the Condition trait (Crowd Dispersal's "Blinded 1") keeps 1 round. `_applyDeafeningEffect` (only Crowd Dispersal's "Deafened 1"): book silent on the number's unit - kept 1 round (read as rounds, like the books' "Stunned 1d2 rounds" stat lines); comments fixed. Notes: Flames of Hate / Pollen Cloud / Stinger Spray alternates and Irritant Disperser Effect now say "until the end of its next turn"; the three Crowd Dispersal effects (incl. Impaired, already 1 round in target-riders.mjs) say "for 1 round" (they claimed end of next turn) |
| Deconstructionist | QGtG p.26 (PDF p.28) | Standard action: target a piece of enemy **Computerized** equipment within 100 ft; success: tests using it or made by it gain Snag for 1 turn | The item data carries it, so it is enforced: a vehicle is affected only with its Computerized Vehicle Trait (`target:data:system.traits.computerized`), otherwise a chat line says it has no effect; against a creature the pick offers only items with the Computerized trait (`filter: ["item:trait:computerized"]` - own traits or an attached upgrade's), and with none "nothing to pick" ends it. Zords carry no traits: still affected (book silent - kept). Notes |
| Snarl | Factions in Action V1 p.37 (PDF p.39) | Intimidation vs Willpower or Cleverness as a Standard action; success: Frightened of you for 1 turn | Read as the target's one turn: `applyCondition ... until: endOfNextTurn, untilOf: recipient` (was `rounds: 1`, which ended at the start of YOUR next turn); out of combat 1 round (6 s). Label and notes |

## Engine features added 2026-10-06 (book check, follow-ups 2)

- **`applyCondition {until: "endOfTurn"}`** (mechanics/combat/timed-status.mjs#turnBoundTiming + the steps.mjs validator):
  "until the end of your turn" - v14 expiry `turnEnd` on the holder's (or `untilOf`'s) combatant with value 0 when it is
  acting now or still to act this round, else 1 (next round's turn). Not in a running combat / not in the turn order:
  1 round, like the other turn-bound values.
- **`untilOf` registry** (steps.mjs `registerUntilOf(name, fn(ctx, recipient))`): more answers to "whose turns does this
  `until` count"; null falls back to the holder. The validator accepts registered names.
- **`untilOf: "user"`** (rules/plugins/book/followups2.mjs#usingCrewMember): on a vehicle / Zord's Use, the crew member
  using it - the seated crew member (system.actors) whose turn it is, else game.user.character when aboard, else (not as
  GM) the first crew member this user owns.
- **`setToggle` honours `untilOf`** (it always stamped the holder before).

## Behaviour differences worth a decision

- Growing Smolder: the Fire damage is a separate Apply button on the hit (not added into the weapon's own damage number),
  and it is not multiplied by Degrees of Success (the old untyped bonus was). This matches how other "+N typed damage"
  items work in the system.
- Snarl: "for 1 turn" read as the target's next turn (book doesn't say whose). The Standard action cost and the
  Willpower-or-Cleverness target are still the table's (the rule is a hit Trigger on any Intimidation success).
- Beast Morpher dog: "your turn" read as the current turn if it's yours, else your next one.
- Electronic Countermeasures: a GM clicking it for a crew whose member isn't acting and with no character assigned falls
  back to the vehicle's own turn (or the next round's start when the vehicle isn't in the order).
- Crowd Dispersal Energy Cannon "Blinded 1 / Deafened 1 / Impaired 1": book silent on the unit - kept 1 round.
- Deconstructionist: gear items have no traits field, so gear can never be picked; Zords are always affected.

## Shared-file edits

- `module/rules/steps.mjs` - `registerUntilOf` + `UNTIL_OF` map read first in `untilActor`; the untilOf validator accepts
  registered names; `setToggle` stamps through `untilActor`; applyCondition validator allows `endOfTurn`.
- `module/mechanics/combat/timed-status.mjs` - `turnBoundTiming` knows `endOfTurn` (+ doc comment).
- `module/dice.mjs` - imports `turnBoundTiming`; Blinding trait rider and `_applyBlindingBlast` use the target's
  endOfNextTurn timing (Condition-trait weapons keep 1 round); doc comments for `_applyBlindingBlast` /
  `_applyDeafeningEffect`.
- `module/util/config.mjs` - the `deafened` damage type comment (1 round).
- `module/rules/plugins/index.mjs` - the follow-ups 2 block at the end (imports `./book/followups2.mjs`, new file).
- Old tests updated: book-followups.test.js (Growing Smolder's scaled damage is now 0; Deconstructionist's rifle and truck
  are Computerized), book-effects.test.js and conv14-items1.test.js (Deconstructionist's vehicle is Computerized),
  conv10-slA10.test.js (comment only), dice.test.js (new in-combat Blinding / Deafened cases).

## Tests

`module/rules/book-followups2.test.js` (13 tests) + 3 new tests in `module/dice.test.js`. eslint clean on every touched
file; `node scripts/check-rules.mjs` 0 errors / 0 warnings (4169 rules); full jest suite 7861 passed (349 suites).

## Unused strings

None.
