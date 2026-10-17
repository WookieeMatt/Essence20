# Book check - part "costs" (2026-10-06)

Scope: action costs the notes named but the rules never charged, and "only while Morphed" gates the rules lacked, plus
Charge It Up! (paid its Power before refusing) and Psycho Assault (code gated, notes said "left to the table"). Each item
was read in its own printing; the book wins. All items have a single printing in the packs.

How costs are charged: `cost.action` on the Use (spent through the action economy in combat; free outside combat).
A Morphed gate is a leading `require {check: [self:morphed], beforeCost: true}` step, so an un-Morphed press posts
"X requires being Morphed." and spends nothing. Where a Use can stop or ask before doing anything (a target check, a
pick, a number), those leading steps are marked `beforeCost: true` so a refused or cancelled press spends no action.

| Item | Printing (book p.) | What the book says (paraphrase) | What changed |
| --- | --- | --- | --- |
| Castling | GI Joe CRB p.87 | Standard action: two allies get 1 Temp Health and may move | `cost.action: standard` |
| Knight's Jump | GI Joe CRB p.87 | Once per turn, Move action: two allies swap Initiative | `cost.action: move`; the target / count / warn steps run before the cost |
| Natural Movement | GI Joe CRB p.93 | Standard action: Climb or Swim at half Ground until end of next turn | `cost.action: standard` on switching on (off is free); the environment check and the pick run before the cost |
| Fast Learner | GI Joe CRB p.105 | Standard action: move one Skill rank to another | `cost.action: standard`; both picks run before the cost |
| Honorific Token | A Jump Through Time p.67 | Move action, once per day: regain a Story Point | `cost.action: move` (limit left alone - see below) |
| Squad Guardian | Hawk's Personnel Files | Moxie Point + Standard action: Defeated ally back to 1 Health | `cost.action: standard` beside the Moxie cost |
| Deadstick | Quartermaster's Guide p.26 | Standard action: Technology vs a robot's Willpower or Cleverness, Stunned 1 round | `cost.action: standard`; the target step runs before the cost |
| Takedown | GI Joe CRB p.73 | Standard action special attack | `cost.action: standard` |
| Stand Firm | Transformers CRB p.91 | Move action: double the Stalwart Defense bonus | `cost.action: move`; notes say Move action |
| Mysterious Aura | A Jump Through Time p.45 | Move action, while Morphed, 1 Personal Power: pick an aura | `cost.action: move` + Morphed gate; notes updated |
| Adaptation | GI Joe CRB p.91 | Free action: spend an Adaptation Point | `cost.action: free` on switching on (off is free) |
| Growl | Cobra Codex p.69 | Free action: Intimidation vs Willpower, once per target per turn | `cost.action: free`; the target / combat / once-per-target checks run before the cost; notes say Free action |
| Tough It Out | Transformers CRB p.89 | Once per combat, Standard action: Brawn to Repair | `cost.action: standard`; the amount prompt runs before the cost |
| Nano-Med Mastery | GI Joe CRB p.82 | Once per encounter, Standard action: allies within 60 ft heal 2 and get Edge | `cost.action: standard` |
| Resilience | Power Rangers CRB p.53 | While Morphed, when targeted: 1 Personal Power, Athletics die off incoming attacks | Morphed gate (no action named - none charged) |
| Stand Behind Me! | Across the Stars p.53 | Start of a round while Morphed, 1 Personal Power: enemies within 60 ft must target you or pass DIF 14 Alertness | Morphed gate (no action named - none charged) |
| One For All | Power Rangers CRB p.34 | Once per day, Standard action while Morphed, 3 Personal Power: all teammates regain 1d2 | `cost.action: standard` + Morphed gate; every teammate regains (the old Morphed-teammates-only filter is gone); label and notes updated |
| Shining Leader | Power Rangers CRB p.63 | Once per scene, 1 Personal Power + Standard action while Morphed: all allies get Edge on attacks this round and next | `cost.action: standard` + Morphed gate; every ally gets the Edge (Morphed-only filter gone); notes updated |
| Charge It Up! | A Jump Through Time p.57 | Standard action + 1 Personal Power while Morphed: next melee Power Weapon attack ignores armor (and Resistances etc.) | `cost.action: standard`; the Morphed `require` now runs before the cost, so an un-Morphed press spends nothing; notes updated |
| Psycho Assault | Finster's Monster-Matic Cookbook p.284 | Free action, 1 Personal Power, only Morphed and not in Monster Form: attacks ↑1 and +1 damage this turn | Already gated as the book says; added `cost.action: free`; removed the wrong "left to the table" note, status partial -> full |

## Book differences outside this part (not changed - for the limits / durations parts or a later pass)
- Honorific Token: book once per day; rule is once per encounter.
- One For All: book once per day; rule once per encounter (notes say scene).
- Shining Leader: book once per scene; rule once per encounter.
- Natural Movement: book lasts until the end of your next turn; still switched off by hand.
- Stand Firm: book lasts until the start of your next turn (rides the Stalwart Defense bank).
- Growl: book gives ↑1 on all your attacks against that target this turn; rule gives it to the next attack, kept until combat ends.
- Resilience: duration (until the start of your next turn) - the durations part has it.
- Deadstick: robots only, within 100 ft - still left to the table.

## Shared-file edits
None in module code. Old tests updated for the new behaviour:
- `module/rules/conv14-items1.test.js` - Charge It Up!: an un-Morphed press now keeps its Power.
- `module/rules/conv14-items2.test.js` - One For All / Shining Leader: the leader is Morphed; un-Morphed teammates now get the benefit too.
- `module/rules/conv14-other.test.js` - Adaptation: switching on pays a Free action.
- `module/rules/conv15-banked.test.js` - Resilience, Stand Behind Me!, Mysterious Aura: the test actors are Morphed.

## Tests
`module/rules/book-costs.test.js` (13 tests): every rule validates; each Use's `cost.action` matches the book; the six
Morphed gates refuse un-Morphed presses with nothing paid and work when Morphed (paying the right action); One For All /
Shining Leader have no Morphed-teammate filter; Psycho Assault stays gated; Knight's Jump and Growl stop before paying;
the before-cost steps are where expected.

Checks: eslint clean on touched tests; `node scripts/check-rules.mjs` 0 errors / 0 warnings; full jest suite
344 suites / 7756 tests passing.

## Unused strings
None.
