# Round 17, split2 - the partial conversions (2026-10-07)

Scope: the 47 entries of `r17/r17-split-2.json` - items that already carried `system.rules` but kept hand-written code for
part of their behaviour. 37 now have that part in their rules (the code is gone), 3 are partial, 5 stay code, 1 is
permanent, and Technical Mastery's part went with the perm part's Trade School conversion. Tests: `module/rules/engine17-split2.test.js` (13) and `module/rules/conv17-split2.test.js` (57).
Strings: `E20.RulesExtSplit217.*` (`r17/lang-split2.json`).

## Engine features added 2026-10-07 (round 17, split2)

All new plug-in files are imported in `rules/plugins/index.mjs`'s "Round 17 (split2)" block.

### Rule types read by hand-written code

- **`DamageImmunity {damageTypes?: [..], choiceOf?: <uuid>}`** (`plugins/combat/damage-immunity.mjs`) - while `when` holds,
  damage of those types (or of the type chosen - `system.choice` - on the actor's first copy of that item) does nothing.
  `ruleDamageImmune(actor, type)` is read where `mechanics/combat/combat.mjs#applyDamage` reads `system.immunities` (so a hit
  carrying `ignoreImmunity` - Concentrated Fire's - still lands) and by the Personal Shield's EMP drop
  (`items/defenses/personal-shield-uses.mjs`). Not a sheet Immunity. Impenetrable Shield
  (`{damageTypes: ["emp"], when: ["check:personalShield"]}`), Energy Mastery (`choiceOf: <Energy Affinity>`).
- **`CardResistance {}`** (`plugins/combat/card-resistance.mjs`) - Resistance to the damage of a check card being applied
  to the holder: chat.mjs's Apply Damage halves the card's damage and its second damage (rounded up), after the
  applyingDamage stages, on whoever the damage lands on. `when` sees the card: tag **`card:flagEquals:<key>=<value>`** (the
  card's `flags.essence20.<key>`; `true` / `false` are booleans, an unset flag equals nothing). Tough Enough:
  `["card:flagEquals:isAttack=false", "card:flagEquals:defenseType=toughness"]`.
- In `plugins/combat/subsystem-readers.mjs`, each a "the holder has this" fact with `when`:
  - **`AddictionSnag {}`** - Dark Energon's addiction attacks against the holder suffer Snag
    (`items/resources/dark-energon-addiction-attack.mjs`). Word of Unicron.
  - **`CarryCapacity {multiply}`** - `mechanics/resources/kits.mjs#carryPercent` is multiplied (several multiply
    together). Growth Boost's x2 `when: ["self:morphed"]`.
  - **`ForcedMovementChoice {}`** - `mechanics/combat/forced-movement.mjs#resistsForcedMovement` asks whoever moves the
    holder, staying put the default. Immovable Object.
  - **`SkillImmunityOverride {cost: {storyPoints: N}}`** - a hit with a Skill the target is immune to may still affect it
    if the roller pays (asked per target in `mechanics/combat/target-riders.mjs`). Fear Is Universal.
  - **`CureNote {text}`** - a line added to the Heal action's card when the holder cures an ally's poison or disease
    (`mechanics/actions/heal-action.mjs`; an `E20.` key or text). Proper Protection.
  - **`BonusEnergon {}`** - the item gives one Energon Point above the maximum that, once spent, can't come back: it counts
    toward the cap and rides on top through Rests until the item is marked spent
    (`items/resources/repair-progress-bonus-energon.mjs` keeps the cap / Rest / spend hooks). Repair Progress: Bonus Energon
    Point.
- Use the existing common `priority` (lower first) to order DamageType rules: Blazing Strikes' Fire is `priority: -10`,
  ahead of Cryogenic Touch (-3), Ninja Power (-2), Tooth and Claw (-1), Bear Hug and Energy Affinity, as dice.mjs had it.

### Steps

- **`shapeSet {set: {key: text}}`** (`plugins/effects/shape-set-step.mjs`) - merge keys into this scene's MLP shape
  (`flags.essence20.mlpShape` via `items/forms/pony-shape-shifting.mjs#setShape` - an earlier scene's shape is dropped first).
  Basic Shape-Shifting / Ponymorph: `{type: Trigger, event: afterRoll, outcome: anySucceeded, when: ["item:own"], steps:
  [{do: shapeSet, set: {spell: "<the spell's uuid>"}}]}`.
- **`makeKit {tier, skills, prompt?, none?}`** (`plugins/resources/make-kit-step.mjs`) - pick one of the actor's
  Specializations in those Skills; a kit of that tier for it (`kits.mjs#makeKit`, granted by the rule's item);
  `{var.kit}`. No such Specialization: the `none` warning and a stop. Earth Defense Command's Space Kit.
- **`clearRoughTerrain {}`** (`plugins/combat/clear-rough-terrain.mjs`) - the one-square Rough Terrain Region under the
  actor's token goes (a GM's client at once; anyone else posts the GM a button - chat button `clearRoughTerrain`). Dozer
  Blade.
- **`rollInitiative {keepHigher: true}`** (edit in `plugins/rolls/initiative.mjs`) - a new result that isn't higher puts the
  old one back. Deceptive Warfare's reset.

### Tags, picks, options

- **`target:keptAt:<path>`** - the other party is the actor whose uuid this actor keeps at that path (Nemesis:
  `flags.essence20.nemesisUuid`, written by its Use with `rememberTarget` + `updateActor`).
- **`self:elevation:<op>N`** - the actor's token elevation (false with no token). Lightspeed Boost's in flight / submerged.
- **SkillSubstitution `clearSpecialized: true`** (mode ask - edit in `plugins/dialog/dialog-select.mjs`) - the picked Skill
  is rolled without the rolled one's Specialization. Nose For Trouble.
- **`pick from: config` `exceptAt: <actor path>`** (edit in `plugins/tags/role-points-and-flag-lists.mjs`) - keys the actor
  already has set at that path are left out (`system.qualified.weapons` - Armchair General).

## Verdicts

| Item | Verdict | Now |
| --- | --- | --- |
| Grow! | converted | Use (keepValue / updateActor / restoreValue: Towering and back, only in Monster Form) + roll-time Defense rules (+2 Toughness / Evasion) |
| Basic Shape-Shifting | converted | afterRoll Trigger, shapeSet spell |
| Ponymorph | converted | afterRoll Trigger, shapeSet spell |
| Personal Heirloom | converted | Use: pick from ownedItem (no Power Weapons, legacy old flag); RollModifier ↑1 `item:picked:heirloom`; the switch reads the pick |
| Growth Boost | converted | morph / unmorph Triggers (+2 temporary Health); CarryCapacity x2 while Morphed |
| Phantom Focus | converted | Boosted Vigor morph / unmorph Triggers (+3); Healing Light Use (pickAlly, 1 Health + 1 Power, 2d2 up to the maximum) |
| Expanded Mysticism | converted | three Use rules (Fortify / Heal / Quicken, each once a scene), Fortify Defense rules on a scene mark, Quicken turnEnd Trigger |
| Sorcery | partial (permanent rest) | added / removed Triggers set `levelTaken`; the Sorcery builder Use stays (bespoke UI) and D21.sorcery is mystic-non-mystical.mjs's reader |
| Word of Unicron | converted | AddictionSnag |
| Unlucky (For You) | converted | the hit Trigger also marks `unluckyWatch` (until the Ranger's next turn); watch afterRoll Triggers: all failed and not Frightened-immune, holding Terror - 1 Terror; any roll ends the watch |
| Nemesis (Specific Threat) | converted | Use (target, rememberTarget, updateActor); RollModifier ↑2 `target:keptAt` |
| Reckless Abandon | converted | RollModifier ↑2 on Strength tests (light or no armor, not Racer Abandon driving without Rigged Rider, not Initiative) |
| Technical Mastery | (perm part) | its Trade School d2 crit rides on Trade School's conversion - rules/conv17-perm.test.js |
| Nose For Trouble | converted | SkillSubstitution ask (no item, Streetwise the better die, clearSpecialized) |
| Impenetrable Shield | converted | DamageImmunity EMP while the shield is up (applyDamage and the shield's own EMP drop) |
| Power Heal | converted | Use: heal = activatePower; a Condition = pickAlly 5 ft + pick from conditions + 1 Power + removeCondition |
| Time Displaced | converted | Use: blindRoll one die larger per risk |
| Lightspeed Boost | converted | added Trigger + Use (the pick, HAZMAT's two different types), Defense rules for flight / submerged (`self:elevation`) |
| Stand Behind Me! | still code | the enemies' turn-start taunt card for the GM, the Alertness test pressed from it and the attack refusal - needs a watch turnStart Trigger offering a GM button that rolls for its subject, and a BeforeRoll cancel reading the mark |
| Repair Progress: Bonus Energon Point | converted | BonusEnergon (the cap / Rest / spend hooks key on the rule type now) |
| Body of Energy | still code | the shared Health / Power pool in the damage pipeline (any client) and the un-Morph split written with essence20Loss / Refund write options - damageLanding is GM-only and updateActor can't pass write options |
| We Improvise | permanent | the forfeit is a Combat-level ledger of every Story Point the pool loses during the combat, settled at its deletion - a Story Point subsystem |
| Earth Defense Command Benefits | converted | Use (limit per mission): makeKit |
| Deceptive Warfare | converted | Use: require combatant / round 2+, two Free actions or a Move, rollInitiative keepHigher |
| Psychological Sway | converted | Use: target + bank ↓1 |
| Shinobi of the 63rd Hexagram | converted | added Trigger + Use: two choices, setEffects |
| Dozer Blade | converted | Use (Alt Mode, Free action): clearRoughTerrain |
| High Gear | converted | Use rules on the Feature (on: once a scene, the pilot pays 1 Personal Power; off) + Movement x2 stage adjust; the sidebar button is gone |
| Megafauna | partial | Use (Standard action), added Trigger, pilot SkillSubstitution (Animal Handling), DerivedStats (Smarts / Social 3), megaformCombined warning; arriving in form on summon stays code (no rule event at the summon timer's write) |
| Proper Protection | converted | CureNote |
| Armchair General | converted | Use: pick from config weaponTypes exceptAt, updateActor |
| Renegade Commander | still code | the ally's Reckless Abandon is an Active Effect lasting the scene (addEffect has no duration; endSceneTeamEffects sweeps it) |
| Zeo Crystal Boost | still code | the once-per-scene gate on the Power's own activation button (canUsePower) and its Zord-attack / Megaform team readers in dice.mjs |
| Blazing Strikes | converted | powerUsed Trigger, DamageType fire (priority -10), sceneStart end |
| Zord Sentience | converted | DriverlessEssence 2 |
| Life Supporting | converted | Use: DIF 20 Technology clears the spent flag |
| Energy Mastery | converted | DamageImmunity choiceOf Energy Affinity |
| Tough Enough | converted | CardResistance |
| Cruel Warlord | converted | takesDamage Trigger (Psychic: 2 Personal Power) |
| Supreme Guardian | converted | Use (Morphed): rollVsEach Technology vs Toughness of nearbyEnemies:20, Blinded on a hit; takesDamage Trigger (Energy: d20, 10+ regains 1 Eltarian Tech) |
| Dig In | converted | Use toggle + ConditionImmunity Prone |
| Bulwark | converted | Use toggle + ConditionImmunity Frightened (check:bulwark's reader stays for its Movement rule) |
| Immovable Object | converted | ForcedMovementChoice |
| Charge Into Battle | converted | MultipleTargets (melee Power Weapon) |
| Perfect Disguise | partial | Use rules (on once per encounter / off), RollModifier Edge on attacks, afterRoll Trigger ends it; the sneak-attack eligibility stays in sneak-attack.mjs (reader) |
| Concentrated Fire | still code | target-riders.mjs turns the fire-immune hit into an ignore-Immunity rider option before the Critical Success options are built; HitRider runs at a later point |
| Fear Is Universal | converted | SkillImmunityOverride |

## Bugs found and fixed

- **Expanded Mysticism's Fortify never ended** ("for the rest of the scene" - its flag was never cleared, so the +1 lasted
  until the next Fortify). Its Defense rules now need a scene mark set by the Use.
- **Blazing Strikes never ended** ("until the end of the scene" - its flag was never cleared, and re-activating was a
  no-op). A sceneStart Trigger clears it.
- **Growth Boost / Boosted Vigor followed only the sheet's Morph button** (`onMorph`); a Morph from another path (a
  setForm step, a free Morph) added nothing, and leaving Morph through the button afterwards took 2 / 3 away that was never
  given. They are morph / unmorph Triggers now, on every `system.isMorphed` change.

## Code vs notes - needs a ruling

- None new; three questions in `questions.md` (Bulwark's forced-movement immunity, Perfect Disguise's once per mission,
  Expanded Mysticism's three buttons and the two scene-end fixes).

## Behaviour differences worth a note

- Personal Heirloom's ↑1, Reckless Abandon's ↑2 and Nemesis' ↑2 are labelled Roll Options sources now (switch-off-able),
  not pre-filled dataset shifts - the convention for every converted Perk.
- Power Heal's Condition target goes through pickAlly: a targeted creature within 5 ft is taken without asking.
- Personal Heirloom's Use shows with only Power Weapons owned (the pick then has nothing to offer).
- Messages that were notifications are chat lines now (Expanded Mysticism at full Health, Deceptive Warfare out of combat /
  in the first round, Dozer Blade with no token), except the warn steps.
- Unlucky (For You)'s watch is a watch Trigger: the Ranger's and the target's tokens must be on the viewed scene.
- Supreme Guardian's Blind with no enemy within 20 ft rolls nothing (it rolled an untargeted test).
- Megafauna's Combiner warning is one per Zord in form (it listed them together).
- High Gear's doubling sits at Movement stage adjust (a multiply, before that stage's adds - none on a Zord).
- Lightspeed Boost's HAZMAT types are stored as `{0, 1}` (the rules read the same `types.0` / `types.1` paths).
- Life Supporting's recharge sets its spent flag to null (it unset it).

## Shared-file edits

module/mechanics/resources/banked-buffs.mjs (+ .test.js - the ten items' canUsePerk / onPerkUse branches, imports,
constants; `onImmediateAllyPerkUse` and its config comment went with Healing Light, its last user, and imports left unused
by split3's removals in the same file: isMonsterFormActive, THROUGH_THE_SHATTERED_GRID, GI_JOE_CRB, hasUsedThisEncounter,
markUsedThisEncounter, getNearbyAllyTokens, findRolePointsItem), module/dice.mjs (+ dice.test.js), module/essence20.mjs,
module/chat.mjs (+ chat.test.js), module/mechanics/combat/combat.mjs (+ .test.js), module/mechanics/combat/target-riders.mjs,
module/mechanics/combat/rider-uses.mjs, module/mechanics/combat/condition-immunity.mjs (+ .test.js),
module/mechanics/combat/multiple-targets.mjs (+ .test.js), module/mechanics/combat/forced-movement.mjs,
module/mechanics/resources/kits.mjs (+ .test.js), module/mechanics/actions/heal-action.mjs,
module/mechanics/actions/lend-assistance.mjs (+ .test.js), module/mechanics/actions/action-economy.test.js,
module/mechanics/characters/power-use.mjs (+ .test.js), module/sheet-handlers/power-ranger-handler.mjs,
module/sheet-handlers/perk-handler.mjs (+ .test.js), module/sheets/base-actor-sheet.mjs, templates/actor/sidebars/zord.hbs,
module/documents/actor.mjs (+ .test.js), module/rules/plugins/index.mjs, module/rules/plugins/rolls/initiative.mjs,
module/rules/plugins/dialog/dialog-select.mjs, module/rules/plugins/tags/role-points-and-flag-lists.mjs,
module/rules/conversions.test.js, module/rules/conv9-slB9.test.js; item files: items/forms/monster-morph.mjs,
pony-shape-shifting.mjs, items/healing/phantom-focus.mjs, items/defenses/bulwark.mjs, personal-shield-uses.mjs,
items/social/perfect-disguise.mjs, items/rolls/reckless-abandon.mjs, items/resources/dark-energon-addiction-attack.mjs,
repair-progress-bonus-energon.mjs, we-improvise-continuum-anomalies.mjs, items/zords/high-gear.mjs, megafauna.mjs,
combiner-roster-helpers.mjs, items/shared/{gij-crb-item-lookups, pr-crb-ttsg-item-ids, pr-jtt-ats-item-ids,
terrain-perk-ids-and-readers, tf-crb-tf-one-item-ids, resource-team-lookups}.mjs, items/index.mjs, and the item tests that
named them. Deleted: items/rolls/{nemesis, nose-for-trouble, time-displaced, deceptive-warfare}.mjs,
items/gear/{personal-heirloom, earth-defense-command-space-kit, dozer-blade}.mjs, items/social/psychological-sway.mjs,
items/defenses/{dig-in, shinobi-of-the-63rd-hexagram}.mjs, items/attacks/{supreme-guardian, blazing-strikes}.mjs,
items/magic/expanded-mysticism.mjs, items/healing/{growth-boost, power-heal-condition}.mjs,
items/resources/unlucky-for-you-terror.mjs, items/zords/lightspeed-boost.mjs (and their tests).

## Unused strings

E20.GrowActivated, E20.GrowDeactivated, E20.MonsterFormRequired, E20.PersonalHeirloomPickTitle, E20.NemesisNoTarget,
E20.PsychologicalSwayActivated, E20.PsychologicalSwayNoTarget, E20.DigInActivated, E20.DigInDeactivated (with split3's
Cannoneer Dig In), E20.BulwarkActivated, E20.BulwarkDeactivated, E20.PerkUseNoEncounterUsesLeft,
E20.ExpandedMysticismHealPickAmountTitle, E20.ExpandedMysticismFortifyPickDefenseTitle,
E20.ExpandedMysticismQuickenPickMovementTitle, E20.ExpandedMysticismPickBenefitTitle, E20.ExpandedMysticismPickBenefitLabel,
E20.ExpandedMysticismBenefitFortify, E20.ExpandedMysticismBenefitHeal, E20.ExpandedMysticismBenefitQuicken,
E20.O1EmulatorNotRecharged, E20.O1EmulatorRecharged, E20.Zord2DozerAskGm, E20.Zord2DozerClearButton, E20.Zord2DozerCleared,
E20.Zord2DozerClearedGm, E20.Zord2DozerNothing, E20.Zord2NoToken, E20.HighGearTooltip, E20.HighGearButtonActivate,
E20.HighGearButtonDeactivate, E20.HighGearAlreadyUsed, E20.HighGearCannotAfford, E20.Tf3ResetKept, E20.Tf3ResetMoved,
E20.S1SpaceKit, E20.Zord2ShinobiChosen, E20.Pr3PowerHealNothing, E20.Pr3PowerHealWho, E20.Pr3PowerHealRemoved,
E20.Pr1LightspeedChosen, E20.Zord1MegafaunaNoCombine, E20.Pr3GrantedItem (Armchair General was its last user).

## Rule count

74 rules added and 2 existing rules changed (Personal Heirloom's switch reads the pick; Unlucky (For You)'s hit Trigger
also marks the watch), on 40 pack items.
