# slSystems14 - round 14, part "systems"

Scope: the 36 "convert" items of survey/result-systems.json - weapon upgrades (items/attacks/weapon-upgrades.mjs), action
Perks (mechanics/actions/action-perks.mjs), summons / team items (mechanics/companions/summons.mjs,
mechanics/actions/team-actions.mjs), vehicle upgrades (mechanics/vehicles/vehicle-upgrades.mjs) and the perk-handler Perks
(sheet-handlers/perk-handler.mjs, items/senses/blend-in.mjs, items/gear/silent-running.mjs). 35 converted, 1 left as code.
Tests: `module/rules/conv14-systems.test.js` (37 tests).

## Engine features added 2026-10-06 (round 14, systems)

- **Pick source `ownedActors {actorType?}`** (`rules/plugins/picks/owned-actors.mjs`, imported last by
  `rules/plugins/index.mjs`): every world actor this user may act for (its owner, or the GM), of that actor type; the
  value is its uuid, so `to: picked:<key>` reaches it. Organic Zord's "your or another Ranger's Zord" (the old list was
  the world Zords the user owns - `pick from: actors` lists everyone's).

## Verdicts

| Item | Pack file(s) | Verdict |
|---|---|---|
| Scope (x3) | gij / pr / tf crb | converted |
| Aerodynamics (x3) | gij / pr / tf crb | converted |
| Eruptive (x3) | gij / pr / tf crb | converted |
| Deadly (x2) | gij / tf crb | converted |
| Lingering (x2) | gij / tf crb | converted |
| Swift (x3) | gij / pr / tf crb | converted |
| Tossable Vial | ccitems | converted |
| Chrono-Trigger | jttitems | converted |
| Hyperkinetic Support Harness | fffav1items | **not converted** - see below |
| Mobility | gijcrbitems | converted |
| Mobilize | gijcrbitems | converted |
| Motivate | gijcrbitems | converted |
| Momentum | gijcrbitems | converted |
| Shoot, You Fools! | ccitems | converted |
| Balance Your Enthusiasm | mlpcrbitems | converted |
| Bullet Barrage | tfcrbitems | converted |
| Spirit's Host | ttsgitems | converted |
| Hard Target | ccitems | converted |
| Organic Zord | bthitems | converted (+ the ownedActors pick source) |
| Afterburners | qgtgitems | converted |
| Double-Barrel | qgtgitems | converted |
| Electronic Countermeasures | qgtgitems | converted |
| Energized Plating | qgtgitems | converted |
| Energy Resistant | qgtgitems | converted |
| Enhanced Radar Jamming | qgtgitems | converted |
| Evasive Handling | qgtgitems | converted |
| Flight Conversion | qgtgitems | converted, bug fixed (user-approved) |
| Nitrogen-Enhanced Rocket Fuel | qgtgitems | converted |
| Radar Jammer | qgtgitems | converted |
| Smokescreen | qgtgitems | converted |
| Spiked | qgtgitems | converted |
| Targeting System | qgtgitems | converted |
| Shield Matrix | atsitems | converted |
| Combiner Specialization | eocitems | converted (+ item data: hasChoice off, its Perk entries removed) |
| Blend In | fffav1items | converted |
| Silent Running | fffav1items | converted |

**Hyperkinetic Support Harness - not converted.** The sketch's `ItemModifier {path: system.derivedHands, op: set, value: 1}`
lands in the actor's derived pass, AFTER `documents/actor.mjs#_prepareLoadout` has counted hands - the Load Out tally
would count a two-handed weapon as 2 hands again (handsUsed / handsOver change). It needs the survey's "ItemModifier effect
stage" piece (run inside the weapon's own prepareDerivedData). Still code in weapon-upgrades.mjs#applyToWeapon.

## Converted

- **Scope / Aerodynamics** - two ItemModifiers (`stacks: true`, `item:onHost`): range.value and range.long x2 when the
  attack has a range now AND in its stored data (`item:data:_source.system.range.value>0` - so a Tossable Vial's range,
  which the old code added after the doubling, isn't doubled); long only when it has one.
- **Eruptive** - ItemModifier set `2 x radius` minus what Explosive Ammo / Firestorm / Airburst (the weapon's `mutation`
  flag, read with `@host.flags.essence20.mutation.*`) added after the old doubling - the same number the old code gave in
  every combination; only for a blast the attack has in its stored data.
- **Deadly** - GI Joe printing: +1 damageValue on Sharp attacks; Transformers printing: +1 on any attack whose stored
  damage type isn't one of the 16 non-damage types (the old `damaging` was read before the element / mutation changes).
- **Lingering** - +1 damageValue on Stun and on Cover attacks.
- **Swift** - numTargets set to `max(numTargets, 1) + 1` per copy (= 1 + count / n + count).
- **Tossable Vial** - long range 50, then range 20, on attacks with no range.
- **Chrono-Trigger** - RollModifier `scope: host` ↓2 on its weapon's attacks (a switch-off-able source, as the old
  dice.mjs source was) + AttackCount 3 while the rolled weapon `weapon:hasUpgrade:` the Chrono-Trigger (the chained
  attacks must be with such a weapon too, as the old `chronoTrigger` filter).
- **Mobility** - ActionCost sprint -> free and hide -> free, `limit {per: turn, max: 1, key: mobility}` (one shared
  counter, the old rule's id).
- **Mobilize / Motivate / Momentum** - Use (`combat:exists`, cost move / standard / standard): target one token
  (beforeCost), warn and stop (no cost) when it's the user or not in the combat, `grantActions` to the target (Momentum:
  its own standard / move / free max - fullTurnFor).
- **Shoot, You Fools!** - Use (`combat:exists`, standard): count `combatAllies` first (none: warn, nothing paid), then
  `bonusAttack {cost: none, psychicOnMiss: 1, to: combatAllies}`.
- **Balance Your Enthusiasm** - ActionCost item -> move when `item:name~curb your enthusiasm`.
- **Bullet Barrage** - AttackCount `max(1, @sum.equippedTrait.ballistic.weapon.system.equipped)` with ballistic weapons.
- **Spirit's Host** - Use: stop with "Already taken." when the old `flags.essence20.granted` is set, else Smarts 3 /
  Social 1 and set it; Trigger turnStart `scope: zordOwner`: the pilot rolls DIF 10 Persuasion, on a failure a 1d4 table
  of `E20.SpiritsHostAction.N`.
- **Hard Target** - Defense toughness +2 and DerivedStat health.max +2 while
  `vehicle:data:flags.essence20.personalVehicle=jetPack`.
- **Organic Zord** - Use: `pick from: ownedActors, actorType: zord`, then `pickGrant {from: {type: feature}, to:
  picked:zord}`.
- **Afterburners** - Use (vehicle, once per encounter): choose among the Movement types it has (auto when one); in a
  running combat set toggle `burn<Type>` until endOfTurn; Movement x2 at stage afterGravity while it's on.
- **Nitrogen-Enhanced Rocket Fuel** - Movement x2 for ground / aerial / swim at stage afterGravity.
- **Evasive Handling** - Use (free): toggle `evasive` and write `flags.essence20.evasiveManeuversActive` to match; Movement
  x0.5 rounded down at stage afterDerived.
- **Electronic Countermeasures** - Use (move, once per encounter): in a running combat toggle `ecm` for `rounds:1`;
  Defense toughness / evasion +5 while on.
- **Smokescreen** - Use (standard, once per encounter): Cover for 1 round to `all:30` and to the vehicle itself (on the canvas).
- **Flight Conversion** - Use (once per scene): toggle `fly` for `rounds:3`; Movement aerial max(ground, aquatic) at stage
  derived and DerivedStat traits.vtol true while on.
- **Radar Jammer / Enhanced Radar Jamming** - Use (free / no cost) toggles `jam`; RollModifier snag on Technology tests in
  an `aura` of 50 ft / 5280 ft (`affects: all`) and on the vehicle's own (on the canvas).
- **Energy Resistant** - added Trigger: pick the Element (`legacy: flags.essence20.elementChoice`, ifUnset); DerivedStat
  resistances.{choice.element} true.
- **Energized Plating** - added Trigger pick as Energy Resistant; incoming DialogSelect on attacks from within 5 ft: ↓2, or
  1 damage of the picked Element (Electric while unpicked) to the attacker when the dialog closes.
- **Spiked** - incoming DialogSelect on Might / Finesse melee attacks (the attack's own Skill, as before): ↓1, or 1 Sharp
  to the attacker.
- **Double-Barrel / Targeting System** - added Trigger: pick the weapon (`legacy: flags.essence20.weaponId`); WeaponTrait
  linked / targetingSystem on `item:picked:weapon`.
- **Shield Matrix** - DerivedStat shieldedRating `max(2, advances)` unless the vehicle has a rating or the Shielded trait
  of its own (the old "native rating wins").
- **Combiner Specialization** - added Trigger: choose Gestalt / Matched Combiner (grant) while neither is owned, else +1
  health.bonus; pack data: hasChoice false, choiceType none, items {} (with hasChoice off, grantPerkEquipmentMap would have
  granted both entries outright).
- **Blend In / Silent Running** - added Trigger: pick the equipped armor / weapon (auto with one), then `fitUpgrade`
  Silent + Stealth / Silencer + Suppressor onto it, each skipped when that upgrade is already attached.

Automation notes reworded: Spiked and Energized Plating (a choice in the dialog now, not an untick).

## Bugs fixed (user-approved)

- **Flight Conversion** stayed on forever outside the combat it was used in (`isFlightConverted`: true with no combat, or
  in any other combat). Now its notes' "for 3 rounds": toggle `until: rounds:3` - in a running combat until the same point
  in the turn order 3 rounds on (the old in-combat window ended at the START of that round, a few turns earlier); out of
  combat, the scene.

## Code vs notes - needs a ruling

- **Aerodynamics** (code and now rules): any weapon with a range; notes / book: grenades and thrown weapons only.
- **Tossable Vial**: "counts as a thrown weapon" is not implemented (code never did it).
- **Shield Matrix**: code (kept) Shielded = max(2, the Feature's advances); notes "+2 per extra copy up to 6".
- **Evasive Handling**: the code sets both its own halving and the Fly In The Future flag, which `_prepareMovement` also
  halves - Aerial ends up quartered. Kept (the rule writes the same flag and halves at afterDerived).
- **Mobilize / Motivate / Momentum**: "within line of sight" is not checked (code never did).
- **Silent Running**: always one Silencer + one Suppressor (book: two of either, or one of each); "battledress you
  requisition gains Silent" not built - unchanged.
- **Blend In / Silent Running**: notes say the free upgrades don't change Availability; the attached entry carries the
  upgrade's availability as any attachment does (old and new alike).
- **Afterburners / ECM / Smokescreen** notes say "once per combat"; code (kept) is once per encounter.

## Behaviour differences (accepted, small)

- Upgrade rules switch off while their weapon is unequipped (stowed) - the old code changed a stowed weapon's numbers too.
- Order: the upgrade rules now apply after the code still in applyToEffect. Exact except odd numbers: Smart Scope or
  Backblast with Scope / Aerodynamics on an odd range (up to 1 ft), Eruptive with Chemical Sprayer on an attack with no
  printed blast, a Tossable Vial with a bomb / Extended / Explosive Ammo's blastSet on the same weapon.
- Two copies of Deadly or Lingering on ONE weapon now add 2 (old: 1). Two Chrono-Triggers on one weapon ↓4.
- Chrono-Trigger's AttackCount is on the upgrade: only while that weapon is equipped; matched by the jump_through_time uuid.
- Vehicle Movement: Rocket Fuel / Afterburners now double before Shallow Draft / Submarine Mode (differs only with an
  Afterburner on Ground when Aquatic is higher, or on Aquatic made by Submarine Mode, or an odd Aerial halved for
  Submarine Mode); Flight Conversion's max now comes after Afterburners and the Biotech boost (an Aerial burn the same turn,
  or Biotech on, differ).
- Messages: the old notification texts are now warn steps (RulesExtSystems strings) or chat lines on the Use card; a
  missing target posts the engine's "needs a target" card.
- Spiked / Energized Plating: a select (↓ or damage) instead of an untickable source; the damage is the `damage` step's
  chat line; Plating's "adjacent" is `target:within:5` with both tokens on the canvas.
- Jammers: labelled with the upgrade's name (old: the vehicle's); an old `flags.essence20.jamming` left on a vehicle is
  ignored (v6 unreleased - no migration).
- The 'added' picks run whenever the item is created (not only a sheet drop) and post a "Picked" line; two equipped armors /
  weapons ask which (old: the first).
- Change Its Stripes' upgrades now come from the Blend In its Grant rule gives (that Perk's added Trigger), not its own branch.
- Combiner Specialization's Perk is tied to it by `grantedBy` (old: an attachment entry) - both go when it is deleted.
- Momentum on an actor with no action budget grants 0 / 0 / 0 (old fallback 1 / 1 / 0).
- Spirit's Host's takeover line is posted as the pilot (old: the Zord).

## Shared-file edits

- `module/dice.mjs` - hasChronoTrigger import, the Chrono-Trigger source, the declinedDamage block in the dialog
  application, and the defenderSources call's melee / adjacent context and declinedDamage field.
- `module/documents/actor.mjs` - Hard Target terms in linkedHealth / linkedDefense; hardTargetBonus and getCrewedVehicle
  imports.
- `module/documents/item.mjs` - the vehicleWeaponTraits loop and import.
- `module/documents/combat.mjs` - onSpiritsHostTurn call and import.
- `module/sheet-handlers/drop-handler.mjs` - promptVehicleUpgradeChoice call and import.
- `module/sheet-handlers/perk-handler.mjs` (+ test) - Combiner Specialization special case, Blend In / Change Its Stripes /
  Silent Running branches, their constants and imports.
- `module/mechanics/combat/target-riders.mjs` (+ test) - the vehicle jamming lookup and import.
- `module/mechanics/actions/action-perks.mjs` (+ test), `module/mechanics/vehicles/vehicle-upgrades.mjs` (+ test),
  `module/items/attacks/weapon-upgrades.mjs` (+ test), `module/mechanics/companions/summons.mjs`,
  `module/mechanics/companions/companions.test.js`, `module/mechanics/actions/team-actions.mjs` - the converted items'
  code, constants, table entries and old tests.
- `module/rules/plugins/index.mjs` - one import line at the end.
- Deleted: `module/items/senses/blend-in.mjs` (+ test), `module/items/gear/silent-running.mjs` (+ test).

## Unused strings

E20.ActionPerkNeedsAlly, E20.ActionPerkNotInCombat, E20.ActionPerkNoAllies, E20.ActionPerkUsedAllies,
E20.UpgradeChronoTrigger, E20.VehicleUseAfterburners, E20.VehicleUseEcm, E20.VehicleUseSmokescreen,
E20.VehicleUseEvasiveOn, E20.VehicleUseEvasiveOff, E20.VehicleUseFlight, E20.VehicleUseJammingOn,
E20.VehicleUseJammingOff, E20.VehicleUsePickMovement, E20.VehicleDeclinedPenalty, E20.OrganicZordPick,
E20.SpiritsHostTakes, E20.SpiritsHostSet. (E20.SpiritsHostAction.1-4 are still used - by the pack's table.)

New strings: `<scratchpad>/r14/lang-systems.json` - E20.RulesExtSystems.NeedsAlly / AllyNotInCombat / NoAllies.

## Rule count

78 rules added on 47 pack files (35 items).
