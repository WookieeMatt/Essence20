# Book check - limits (2026-10-06)

Scope: the `limits` group of the book check (questions.md) - how often each item may be used, plus the effect questions
grouped with them - and the three extra items the costs agent passed on (Honorific Token, One For All, Shining Leader).
The book is the source of truth. Each printing was read in its own book (`system.source.book` / page).

Windows used (module/rules/limits.mjs): `turn` / `round` (combat-stamped), `scene` (the Scene Clock's scene),
`encounter` (advances with the scene and when a combat ends - the books' "once per combat" / "once per encounter"),
`mission`, `session` (the Story Points app's New Session), `rest` (until a Rest - the books' "once per day").

| Item | Printing (book p.) | What the book says (paraphrase) | What changed |
| --- | --- | --- | --- |
| Interdiction | Ferocious Fighters p.45 | once per combat scene | already matches (`encounter`) |
| Orange Ranger Prime | A Jump Through Time p.34 | regain 2d2 Personal Power once per scene | Use limit `encounter` -> `scene` |
| Relic Key | PR Core p.138 | Edge on one roll in the scene | Use limit `encounter` -> `scene` (label too) |
| One For All | PR Core p.34 | once per day (Standard, while Morphed - costs agent) | Use limit `encounter` -> `rest`; notes; status full |
| Shining Leader | PR Core p.63 | once per scene | Use limit `encounter` -> `scene`; notes |
| Honorific Token | A Jump Through Time p.67 | a Move action, once per day | Use limit `encounter` -> `rest`; notes; status full |
| Cache I | Decepticon Directive p.61 | once per game session (Cache II twice, Cache III three times); Private Barter once per session | Use limit `encounter` -> `session`; Private Barter's pick stamped with `@clock.session` instead of an encounter window; notes |
| Not Dead Yet | Intercontinental Adventures p.70 | +1 temp Health once per scene; the +2 version once per adventure | +2 window `encounter` -> `mission` (flag renamed `notDeadYetEnhancedUsedThisMission`); notes; status full |
| Weapon Implant | Decepticon Directive p.51 | once per mission, an activity: DIF 14 one-handed / 16 two-handed Standard, 18 Limited (Major Augments), 20 Restricted + Accurate (Extensive Enhancements); on yourself only with Self-Adjustment, with a Snag; lasts the mission | the three afterRoll Triggers (fired by any DIF 14/18/20 Technology roll) replaced by one Use, limit `mission`: target, Self-Adjustment gate, choose the implant, roll at its DIF (Snag with no target), pickGrant `until: mission` (+ `accurate` on the Restricted one); notes |
| Sneak Attack (Force Recon) | Ferocious Fighters p.45 | once per combat; Veiled Attacker (p.45) makes it twice | switch limit `{per: encounter, max: 1 + @owned.<Veiled Attacker>}`; notes |
| Crash Survivor | Cobra Codex p.70 | a free kit at the start of every mission | Use limit `mission`; notes |
| Hearty (Sea Division) | Cobra Codex p.76 | same, Driving (Sea) kit | Use limit `mission`; notes |
| Growing Smolder | Finster's Cookbook p.288 | a Free action once per turn, only on a turn you made no attacks | Use limit `turn` and `when: not:self:actionLog:flag:attack>=1` (attacks are now logged on the turn ledger); notes; status full |
| Jury Rig | Intercontinental Adventures p.71 | once per turn; the Standard version once per scene, lasting to the end of the scene | Use limit `turn`; Standard window `encounter` -> `scene`; the Standard benefit stores `scene: @clock.scene` and ends with that scene (jury-rig.mjs); notes; status full |
| The six "A Talent for ..." | MLP Core pp.73-92 | once per round (Free actions related to it free every time) | ActionCost limit `turn` -> `round` (action-perks.mjs now counts a `round` window) |
| Afterburners | QM Guide p.57 | once per encounter | already matches; notes said "combat" -> "encounter" |
| Electronic Countermeasures | QM Guide p.59 | once per encounter, Move action | already matches; notes said "combat" -> "encounter" |
| Smokescreen | QM Guide p.59 | once per combat | already matches |
| MLP Light / Heavy Armor | MLP Core p.152 | ↓1 / ↓2 on Athletics, Acrobatics, Infiltration and Initiative | `roll:initiative` added to each RollModifier (label too) |
| Shield Matrix | Across the Stars p.104 | Shielded (2), +2 per extra copy, up to 6 | value `max(2, advances)` (Features have no advances - always 2) -> `min(6, 2 * max(1, @copiesWith.type.feature))` |
| Aerodynamic(s) | GI JOE Core p.148, PR Core p.116, TF Core p.125 | prerequisite: a grenade or thrown weapon; doubles its range | both ItemModifiers now also need `item:weaponType:grenades` or `item:weaponType:thrown` (all three printings) |
| Tossable Vial | Cobra Codex p.97 | a 20/50 ft range and counts as a thrown weapon | new `WeaponTrait {traits: [thrown], items: [item:isHost]}`; notes |
| Penetrating Shot | PR Core p.49 | spend 1 more Personal Power on a Volley: one roll against one target for every shot, ↑1 per shot after the first | switch now costs 1 Personal Power, `upshift: @volleyShots - 1`, `damage: (@volleyShots - 1) * @rolled.system.damageValue` (every shot lands - was a free +1 per shot); notes |
| Heavy Water Coolant | Operation Cold Iron p.49 | explosion Brawn test DIF 10, Specialized if the vehicle has Brawn ranks | rule `specialize: true`; vehicle-defeat.mjs rolls the Specialized staircase (`d20 + {d2,...,die}kh`) when the vehicle has ranks |

Book points noticed but not in this group (left as they are): Interdiction only works on targets unaware of you (the
player's switch); Not Dead Yet is a Standard action and asks that the CSTO ally can see and hear you (the rule uses
30 ft); Growing Smolder's bonus is for the attacks of the following turn (the rule banks it for the next attack);
Thrown Blade (Aerodynamics) still leaves the upgrade's doubling to the table.

## Engine / code changes

- **Ref `@clock.<scene | encounter | mission | session>`** (`rules/plugins/resources/clock-ref.mjs`, imported at the end of
  `rules/plugins/index.mjs`): the window's current count (0 for anything else). Stored with `updateActor {set}` and compared
  with `calc:`, it marks a choice inside a run as used in that window (Private Barter), or stamps a benefit with the scene it
  ends with (Jury Rig).
- **ActionCost `limit.per: "round"`** (`rules/types.mjs` validator; `mechanics/actions/action-perks.mjs` usesOf /
  recordRuleUse): counted on the actor (`flags.essence20.actionPerkRoundUses.<rule id>` = {combatId, round, count});
  outside a started combat it never runs out.
- **Turn ledger `attack: true`** (`mechanics/actions/action-economy.mjs#consumeForItem`): every attack's log entry (the
  Attack action, a chained Extra Attack, a granted bonus attack) carries it, so `self:actionLog:flag:attack` counts the
  turn's attacks.
- **VehicleDefeat `specialize: true`** (`rules/plugins/zords/vehicle-defeat-dif.mjs#ruleVehicleDefeatSpecialized`, read by
  `mechanics/vehicles/vehicle-defeat.mjs`): the explosion Brawn test rolls Specialized when the vehicle has Brawn ranks.
- **DialogSwitch `damage` sees `@rolled.*`** (`rules/adapter.mjs#applyRuleSwitches`): the attack's own item.
- **Jury Rig's benefit `scene`** (`items/vehicles/jury-rig.mjs#isJuryRigBenefitActive`): a stored scene (> 0) other than
  the current one ends the benefit.

## Shared-file edits

- `module/rules/plugins/index.mjs` - one commented block at the end (imports clock-ref.mjs).
- `module/rules/types.mjs` - ActionCost validator accepts `round`.
- `module/mechanics/actions/action-perks.mjs` - `round` window in usesOf / recordRuleUse (+ the limit doc line).
- `module/mechanics/actions/action-economy.mjs` - `attack: true` on attack log entries (three spots in consumeForItem).
- `module/rules/adapter.mjs` - `rolled: ctx.item` in the switch damage formula's scope.
- `module/rules/plugins/zords/vehicle-defeat-dif.mjs` - `specialize` param + `ruleVehicleDefeatSpecialized`.
- `module/mechanics/vehicles/vehicle-defeat.mjs` - Specialized staircase in rollSkillTest.
- `module/items/vehicles/jury-rig.mjs` - scene check.

## Tests

- New: `module/rules/book-limits.test.js` (20 tests: validation, every limit's window, scene / day / mission / session
  behaviour, Cache I + Private Barter, Sneak Attack with Veiled Attacker, Weapon Implant, Growing Smolder, Jury Rig, the
  Talents per round, MLP armor on Initiative, Shield Matrix copies, Aerodynamic, Tossable Vial, Penetrating Shot, Heavy
  Water Coolant, `@clock`).
- Updated old tests for these items: `conv14-items1.test.js` (old Weapon Implant Trigger test removed - pointer comment),
  `conv14-other.test.js` (MLP armor now reaches Initiative), `conv14-systems.test.js` (Aerodynamics on a thrown weapon;
  Shield Matrix per copy), `conv15-banked.test.js` (Jury Rig once per turn, scene window, scene stamp),
  `actions.test.js` (validator message), `mechanics/vehicles/vehicle-defeat.test.js` (Specialized formula).
- Full suite: every suite touching these items passes. The last full run (after the other book agents' edits landed) had
  failures only in other agents' items (Catch Off Guard, Might Makes Right, Menacing Glare, Growl, Acting!, Avalanche Stomp,
  Constrictor, Shaped Charges, slD9 validation, Beast Mode, Ground and Pound, New Herd / Favorite Command, book-costs).
  `node scripts/check-rules.mjs`: 0 errors, 0 warnings.

## Unused strings

None (no strings added or removed; the new rule texts are plain labels / require messages in the packs).
