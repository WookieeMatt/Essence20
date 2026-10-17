# Round 17, split3 - finishing the partial conversions (2026-10-07)

Scope: the 47 entries of `r17/r17-split-3.json` - items that already carried rules but still had hand-written code for
part of their behaviour. All 47 are converted fully: the remaining code moved into their rules and was removed. None is
left as reader or permanent code (the flags the toggles write are still read by code - those readers stay, but read state,
not compendium ids). Tests: `module/rules/engine17-split3.test.js` (8) and `module/rules/conv17-split3.test.js` (46).

## Engine features added 2026-10-07 (round 17, split3)

All new plug-in files are imported in `rules/plugins/index.mjs`'s "Round 17 (split3)" block. No new strings
(`E20.RulesExtSplit317` is empty).

### Bonded partners (`plugins/picks/bonded-ally.mjs`)

- **Recipient `bondedAlly`** - the other side of the actor's bond (mechanics/companions/bonded-partners.mjs#bondedAlly),
  linked or not; nobody when it has none.
- **Tag `self:bonded`** - the actor has a bonded ally (either side, linked or not). Synaptic Linkage's Use:
  `pick from: conditions {all, exclude}`, `removeCondition`, `applyCondition {to: bondedAlly}`.

### Conditions (edit to `rules/steps.mjs`)

- **`applyCondition` fills `{choice.x}` / `{var.x}`** in `condition`, as `removeCondition` already did. A condition that
  fills to nothing applies nothing.

### Vehicle Movement stages (`plugins/effects/vehicle-movement-stages.mjs`)

- **Movement `stage: "vehicleBase"` and `stage: "vehicle"`** - applied by `mechanics/vehicles/vehicle-upgrades.mjs#applyToVehicle`
  (documents/actor.mjs#_prepareVehicleData, after the driver-count halving, before Superstructure), in that order. Neither
  runs for a crashed vehicle or one whose engine is stopped (that function returns before).
  - `vehicleBase`: one Movement type taken from another - Shallow Draft (`op: max` ground with the Aquatic total),
    Submarine Mode (`op: set` swim, gated `not:movement:has`).
  - `vehicle`: the changes on top, in op order (multiply, then add): Anti-Matter Reactor x3, Biotech Performance Enhancer
    +20 / +10 (`movement:has` - only speeds the vehicle has), Optimized Seating and Camo Netting -10. The total never
    goes below 0.
  - Give each Movement type its own rule (ground, aerial, swim) - `movement: all` would reach climb and burrow too.

### Pets, Contacts, kits

- **PetCommand `upshift`** (edit to `plugins/picks/pet-command.mjs`): ↑ on the Command a Pet roll for this pet, the biggest
  counting (`rulePetCommandUpshift(pet)`, read by companions.mjs#commandPet). `difTier` is no longer required (one of the
  two is). Agreeable (MLP).
- **`ContactAllegiance {amount}`** (`plugins/resources/contact-allegiance.mjs`) - a Contact the holder summons arrives with
  `amount` more Allegiance Points (contacts.mjs#summonContact asks `ruleContactAllegiance(summoner, contact)`); `when` sees
  the Contact as `target:`. Gridlock Authority: `target:data:flags.essence20.government`.
- **`KitUses {uses, tiers?}`** (`plugins/resources/kit-uses.mjs`) - a kit of those tiers is spent only after `uses` uses (the
  most wins, at least 1; kits.mjs#consumeKit asks `ruleKitUses(actor, tier)`). Reinforced Basics: `{uses: 3, tiers:
  ["standard"]}`.

### Roles (`plugins/effects/role-dropped-event.mjs`)

- **Trigger event `roleDropped`** - fired at the end of sheet-handlers/role-handler.mjs#onRoleDrop, once the Role's
  training is applied (`fireRoleDropped(actor)`). It's Morphin Time!: `{event: roleDropped, steps: [{do:
  refreshMorphedToughness}]}`.

### Picks and refs (`plugins/picks/damaged-essences.mjs`)

- **Pick source `damagedEssences {of?: target | self}`** - the Essences below their maximum on the run's first target
  (default) or the actor; then `healEssence {essence: "{choice.<key>}"}`. None damaged: the pick stops the run. EMT Crash
  Course.
- **Ref `@countSubtype.<item type>.<subtype>`** - the actor's items of that type whose `system.type` is that value
  (`@countSubtype.power.grid`). Personal Power Supply: `when: ["calc:@actor.system.powers.personal.max -
  @countSubtype.power.grid > 0"]`.

### The on / off pattern (no new piece)

A hand-written toggle whose state other code reads converts to two Use rules writing the same actor flag, so every reader
keeps working: "X on" `{when: ["not:self:data:flags.essence20.<flag>", ...gates], cost?, limit?, steps: [updateActor set
true, chat]}` and "X off" `{when: ["self:data:flags.essence20.<flag>"], steps: [updateActor set false, chat]}`. The Use is
hidden exactly when the old canUsePerk said no (`self:` / `rule:` / `check:` gates are static). "Until the end of the
turn" is a turnEnd Trigger clearing the flag. Distraction, Unmovable, Dig In (Cannoneer), Power Boost, Brute Force, Lance
of Light, Shadow, Silent Strider, Gravity Optional, Observer, Skier, Honest Assessment, Wisdom of the Elders (two per
option, gated `rule:data:system.choice=<option>`), Frictionless Movement, Sprinter, Rush the Line.

## Verdicts

| Item | Pack file | Verdict |
|---|---|---|
| Barreling Beam | `mlpcrbitems/_source/Barreling_Beam_FpQsQ0FCBFGHThQV.json` | converted (+1: hit Trigger, push 15 ft) |
| In My Sights | `gijcrbitems/_source/In_My_Sights_MD54SjlTYiCTvmBB.json` | converted (+1 SneakAttackGrant range weapon) |
| Ballistic Advantage | `gijcrbitems/_source/Ballistic_Advantage_civSjmz83aDYPwvo.json` | converted (+1 SneakAttackGrant range unlimited) |
| Weapon Customizer | `iafav2items/_source/Weapon_Customizer_UWEU7hfmtRxlkWJB.json` | converted (+1 WeaponTrait) |
| Synaptic Linkage | `eocitems/_source/Synaptic_Linkage_3JCZlRjXovAMXmko.json` | converted (+1 Use) |
| Favorite Command (WTNV) | `wtnvcgitems/_source/Favorite_Command_GeHPKfuWe24HpYcQ.json` | converted (+1 Use, as the GI JOE / MLP printings) |
| Agreeable (MLP) | `mlpcrbitems/_source/Agreeable_YMG6nH32Y8yaYqZ9.json` | converted (+1 PetCommand upshift) |
| Gridlock Authority | `fgtaaitems/_source/Gridlock_Authority_EiS24nGsgSsroa16.json` | converted (+1 ContactAllegiance) |
| Distraction | `fmmcitems/_source/Distraction_mJu5IxoVrPjp8dVU.json` | converted (+2 Uses) |
| Venom Warlord | `fmmcitems/_source/Venom_Warlord_9tU5tDmpOhChLfdv.json` | converted (+1 Use, Eltarian Mettle's shape) |
| Unmovable | `fmmcitems/_source/Unmovable_1aVrzJLiNkghFT4p.json` | converted (+2 Uses) |
| Dig In (Cannoneer) | `eocitems/_source/Dig_In_RQjNiRZxDFwTPHN8.json` | converted (+2 Uses) |
| Frictionless Movement | `tsitems/_source/Frictionless_Movement_9fOrSAd3brtSBk9C.json` | converted (+Use, +turnEnd Trigger) |
| Sprinter | `tsitems/_source/Sprinter_L5P54Ismw81Lhrbe.json` | converted (+Use, +turnEnd Trigger) |
| Wrestler | `prcrbitems/_source/Wrestler_7QMuaLPZJWNPJHTz.json` | converted (+1 Use) |
| Power Boost | `atsitems/_source/Power_Boost_m3Kh8PqGf3O1oMmc.json` | converted (+2 Uses) |
| Brute Force | `bthitems/_source/Brute_Force_3XP5RgmeyQwE5HH9.json` | converted (+2 Uses, same flag) |
| Lance of Light | `jttitems/_source/Lance_of_Light_HUdL1MryICmRmWnP.json` | converted (+2 Uses) - see bugs |
| Rush the Line | `iafav2items/_source/Rush_the_Line_va1HF5CudO4WsguB.json` | converted (+Use with a rule bank, +turnEnd Trigger) |
| Shadow / Silent Strider | `gijcrbitems/_source/Shadow_PDiRwnTcNCtzJbDn.json`, `Silent_Strider_C3KxTD37krYavSgw.json` | converted (+2 Uses each, shared flag) |
| Gravity Optional | `wtnvcgitems/_source/Gravity_Optional_F5mrzupd6TG2kj3x.json` | converted (+2 Uses) |
| Grid Soldier | `jttitems/_source/Grid_Soldier_y9F6PkCIw7g6tiqL.json` | converted (+1 Use) |
| Wisdom of the Eldars | `ttsgitems/_source/Wisdom_of_the_Eldars_SB6FAYA0qIqV9F3G.json` | converted (+11 Uses) |
| Observer | `ttsgitems/_source/Observer_PTkqeQ8D4x9cstlZ.json` | converted (+2 Uses) |
| Skier | `ghpfitems/_source/Skier_dvmY7UiuKejOPY4N.json` | converted (+2 Uses) |
| Heroic Intervention | `prcrbitems/_source/Heroic_Intervention_T95n2lwh3F5OHjnB.json` | converted (+2 Uses, the second after the first's limit) |
| Honest Assessment | `mlpcrbitems/_source/Honest_Assessment_eIDYxShici5rRpg3.json` | converted (+2 Uses) |
| EMT Crash Course x2 | `gijcrbitems/_source/EMT_Crash_Course_jDAu1zaZpv1IylJ8.json`, `prcrbitems/_source/EMT_Crash_Course_cBezxXDBMpsRwYbP.json` | converted (+2 Uses each) |
| Personal Power Supply | `fgtaaitems/_source/Personal_Power_Supply_Uy3t5KLbeGHv08ho.json` | converted (+1 Use, pickGrant) |
| Reinforced Basics | `qgtgitems/_source/Reinforced_Basics_4HD4ibkT5hTdwlAW.json` | converted (+1 KitUses) |
| Take the Wheel | `ccitems/_source/Take_the_Wheel_EQK0bAGpmYkGPcRi.json` | converted (+1 Use: deleteItem granted, createItem) |
| Competitive Strength | `jttitems/_source/Competitive_Strength_J0ljd1QnU9AgoWj6.json` | converted (+1 BrawnRequirement carryingOnly) |
| Caretaker / Pay It Forward | `prcrbitems/_source/Caretaker_4q2SPRzdbGosL62k.json`, `Pay_It_Forward_M3pQgNMsU5hU5dMN.json` | converted (+1 GroupTestBonus each) |
| Anti-Matter Reactor | `qgtgitems/_source/Anti_Matter_Reactor_kOsm7efSfPh531Hm.json` | converted (+3 Movement, stage vehicle) |
| Camo Netting / Optimized Seating | `qgtgitems/_source/Camo_Netting_S3qPHlomgES5iUNi.json`, `Optimized_Seating_5LrQ4TGjgWKsomL7.json` | converted (+3 Movement each) |
| Shallow Draft / Submarine Mode | `qgtgitems/_source/Shallow_Draft_Ftm5iA7PG6J3M4aN.json`, `Submarine_Mode_ErSK3LwBT1Wg8rKF.json` | converted (+1 / +2 Movement, stage vehicleBase) |
| Treads | `qgtgitems/_source/Treads_dXx85BLf1RKjn8xg.json` | converted (+2 RollModifiers, crew and self, `check:vehicleInRoughTerrain`) |
| Biotech Performance Enhancer | `jttitems/_source/Biotech_Performance_Enhancer_wDMGtOqx1jpltxG9.json` | converted (+3 Movement, +1 ItemModifier stage item) |
| Aerial Interface | `qgtgitems/_source/Aerial_Interface_Etogut0TJjvuKC9J.json` | converted (+2 Defense, scope driven) |
| Duty of the Silver | `atsitems/_source/Duty_of_the_Silver_KhV5GeGIMJNWlWhr.json` | converted (+1 added Trigger) |
| It's Morphin Time! | `prcrbitems/_source/It_s_Morphin_Time__UFMTHB90lA9ZEvso.json` | converted (+1 roleDropped Trigger) |
| Zord Mega-Weapon System | `prcrbitems/_source/Zord_Mega_Weapon_System_Wc1FJ5YDeTQS6XoE.json` | converted (+1 added Trigger, removeOnStop - Additional Attack Type's shape) |

Still code: none. Permanent: none. The code that stays only reads state: the flag readers (`isLanceOfLightActive`,
`isObserverDisguiseActive`, `isHonestAssessmentActive`, `isWisdomOfTheEldersActive` in dice.mjs / actor.mjs / combat.mjs /
action-perks.mjs; the `check:` helpers in essence20.mjs), `companions.mjs#favoriteSkill`, and the Instrument Array in
`crewSources`.

## Bugs found and fixed

- **Lance of Light could never be switched on.** Its rule Use (the Strike) made the item an "ext" Use
  (action-perks.mjs#useFor), so canUsePerk / onPerkUse never reached the hand-written toggle - and the Strike needs the
  Lance active. The on / off are Use rules now. (Test: conv17-split3 "Lance of Light: its Strike is offered only while ...")
- **It's Morphin Time!'s Role-drop refresh missed copies identified by `flags.core.sourceId`** (role-handler.mjs checked
  `_stats.compendiumSource` / `rulesSource` only, unlike the rest of the system). The roleDropped Trigger rides on the item
  itself. (Test: conv17-split3 "It's Morphin Time!".)

## Behaviour differences worth knowing (no ruling needed)

- Toggle Uses post a rule card ("Item: X on" with a short line) instead of the old localized chat card. Wrestler's pin and
  Grid Soldier's Use show their button always (the old buttons hid until a valid target was set) and say why in chat when
  the target is wrong; nothing is spent then.
- Synaptic Linkage, Wrestler and Grid Soldier's gates refuse with a chat line rather than a toast.
  Synaptic Linkage's button is hidden while there is no bonded ally or the scene's use is spent.
- EMT Crash Course's heal is the engine's heal step: healing a Defeated ally above 0 also clears Defeated (the round-14
  approved heal fix). Each printing counts its own once per scene (the old flag was shared by both printings).
- Heroic Intervention's Story Point with no GM connected stops quietly (the grantStoryPoint step) instead of a warning.
- Rush the Line's Edge is a rule bank on the next melee attack (listed as "Rush the Line"); an old pending
  `pendingRushTheLineEdge` flag is no longer read (v6 unreleased).
- Frictionless Movement / Sprinter / Rush the Line are cleared by a turnEnd Trigger (combat.mjs#_onEndTurn, once on the GM)
  instead of the combatTurn hook on every client, and only while the actor still holds the item.
- Barreling Beam's push runs as a hit Trigger, after the x2 Prone Trigger on the same hit.
- In My Sights / Ballistic Advantage read `weapon:trait:sniper`, which also counts a Sniper trait an attached upgrade adds.
- Aerial Interface: with two drivers holding the Perk, both shields count (the old code took the first).
- Duty of the Silver trains on any arrival of the Perk (a grant included), after it is on the sheet, rather than inside
  setPerkValues. The Mega-Weapon's weapon is built after the Feature is added (a cancel takes the Feature off again); its
  attack is attached under the weapon like a compendium weapon's.
- Take the Wheel's message is the createItem "Granted" line (and the removed kit's line).
- Personal Power Supply's grant line is pickGrant's "Granted".
- Favorite Command (WTNV) is the same Use the GI JOE and MLP printings carry; the questions.md item about its ActionCost
  rule still stands (both kept).
- The questions.md item "[systems] Anti-Matter Reactor ... Add a stage, or accept?" is answered by the vehicle stages: the
  x3 now runs exactly where it did, before the Biotech / Seating / Camo adds.

## Code vs notes - needs a ruling

None new.

## Shared-file edits

module/rules/steps.mjs (applyCondition fill), module/rules/plugins/index.mjs (block), module/rules/plugins/picks/pet-command.mjs,
module/dice.mjs (Rush the Line pending Edge, crewSources call, isInRoughTerrain import), module/dice.test.js, module/essence20.mjs
(turn-end clears), module/items/attacks/weapon-upgrades.mjs (Biotech call), module/mechanics/resources/banked-buffs.mjs (+ test),
module/mechanics/resources/{kits,grant-uses,grants}.mjs (+ kits.test.js, grants.test.js), module/mechanics/companions/{companions,
companion-uses,bonded-partners,contacts}.mjs (+ companions.test.js), module/mechanics/rolls/group-tests.mjs,
module/mechanics/combat/{weapon-traits,sneak-attack,target-riders,rider-uses}.mjs (+ sneak-attack.test.js),
module/mechanics/vehicles/vehicle-upgrades.mjs (+ test), module/sheet-handlers/{perk-handler,role-handler,zord-feature-handler}.mjs
(+ perk-handler.test.js, zord-feature-handler.test.js), module/items/healing/eltarian-mettle.mjs (+ test),
module/rules/bugfix-1006.test.js, module/rules/conv5-slD5.test.js.

Reduced to their readers (with their tests): items/defenses/{cannoneer-dig-in,lance-of-light}.mjs,
items/movement/{frictionless-movement,sprinter-boost,rush-the-line,gravity-optional,skier}.mjs,
items/senses/{infiltrating,observer}.mjs, items/rolls/honest-assessment.mjs, items/forms/wisdom-of-the-elders.mjs.

Removed files: items/defenses/{distraction,unmovable}.mjs, items/attacks/{wrestler-pin,power-boost}.mjs,
items/healing/{grid-soldier,emt-crash-course}.mjs, and their tests.

## Unused strings

E20.DistractionActivated, E20.DistractionDeactivated, E20.DistractionRequiresMorphed, E20.UnmovableActivated,
E20.UnmovableDeactivated, E20.SkierActivated, E20.SkierDeactivated, E20.HonestAssessmentActivated,
E20.HonestAssessmentDeactivated, E20.PowerBoostActivated, E20.PowerBoostDeactivated, E20.LanceOfLightActivated,
E20.LanceOfLightDeactivated, E20.GravityOptionalActivated, E20.GravityOptionalDeactivated, E20.WrestlerPinNoTarget,
E20.GridSoldierNoValidTarget, E20.EmtCrashCourseHealOption, E20.EmtCrashCourseRestoreEssenceOption,
E20.EmtCrashCoursePickActionTitle, E20.EmtCrashCoursePickActionLabel, E20.EmtCrashCoursePickEssenceTitle,
E20.EmtCrashCoursePickEssenceLabel, E20.EmtCrashCourseNoDamagedEssence, E20.SptNoGmConnected, E20.StoryPointUnavailable,
E20.SynapticLinkage, E20.SynapticPassPrompt, E20.SynapticPassed, E20.BondNone, E20.G1ChoiceMade, E20.KitsGranted,
E20.MegaWeaponTitle, E20.Caretaker, E20.PayItForward. Also E20.DigInActivated / E20.DigInDeactivated, shared with Dig In
(Decepticon Directive) - unused once that one's code goes (no reference is left now).

E20.MegaWeaponPickStyle, E20.ZordFeatureEnhancePickDamageType, E20.MegaWeaponName and E20.MegaWeaponCreated are used by the
Mega-Weapon's pack rule now.

## Rule count

87 rules on 47 pack items.
