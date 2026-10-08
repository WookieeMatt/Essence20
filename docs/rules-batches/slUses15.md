# Batch slUses15: round 15, part "uses" - companion recipients, item selectors, drop-handler grants and the rest

**Scope:** the 86 items with verdict "piece" in the survey's `result-uses.json` (the Use buttons and riders in
`mechanics/resources/grants.mjs` + `grant-uses.mjs`, `mechanics/combat/target-riders.mjs` + `rider-uses.mjs`,
`mechanics/companions/companions.mjs` + `companion-uses.mjs` and `mechanics/resources/kits.mjs`), plus Gyro-Gun Alternate
Effect, which round 14 left unconverted (`slUses14.md`). Edited in place in the shared checkout (no branch, no commit, no
pack compile).

**Result:** **84 items converted** (83 of the 86, plus Gyro-Gun Alternate Effect), **114 rules** added. 1 item
was converted by another part (In Their Element - items2), 2 stay code (A Hint of Independence, WTNV Medicine Kit). The
hand-written code, tables, constants, dialogs and old tests each converted item had are removed; `module/rules/conv15-uses.test.js`
(77 tests) checks each item from its pack source, `module/rules/engine15-uses.test.js` (22 tests) the engine pieces.
`scripts/check-rules.mjs`: 0 errors from this part (see "Checks").

## Engine features added 2026-10-07 (round 15, uses)

All in their own plug-in files, imported in `rules/plugins/index.mjs`'s "Round 15 (uses)" block.

### Steps

- **`tokenLight {bright, dim, angle}`** (`effects/token-light.mjs`) - switches the carrier's token light on and off. The item
  keeps `lit` and the light it replaced (`previousLight`), so turning it off restores that. Chat: `E20.LightOn` / `E20.LightOff`.
- **`moveTo {to?, maxRange?, forced?, animate?, snap?}`** (`combat/move-to.mjs`) - each recipient's token goes to the point a
  `pickPoint` step kept.
  - `forced` (the default): through `forced-movement.mjs#placeActorAt` (Immovable Object, the GM relay).
  - `forced: false`: the actor moves itself.
  - `maxRange` (ft): a farther point is refused with a warning.
  - `animate: false`: the token jumps.
  - `snap` was added by items2.
- **`refreshMorphedToughness`**, **`itemEffects {item, disabled}`** (`resources/uses-grant-pieces.mjs`) - re-work the Morphed
  Toughness bonus; switch an item's Active Effects off or on (Multifaceted's set-aside Perk).
- **`kitBoost {essence|skill, spec?, mode, kind, rounds?, times?}`** (`resources/uses-kit-pieces.mjs`) - the lasting roll bonus a
  used-up kit leaves (`kits.mjs#addKitBoost`, now exported).
- **`lendAssist {skill?, shiftUp?}`** - with `skill`: a banked Lend Assistance upshift for that Skill on each recipient. Without
  `skill`: the usual Lend Assistance dialog.
- **`recordTurnWeapon {flag}`** (`combat/turn-weapons.mjs`) - remembers this turn's weapons (Flurry of Attacks).
- **`pickChildEntry`, `grantPerk {uuid, link}`, `grantEntries {of, childType, notOwned, until, to}`, `factionDrop`**
  (`picks/entry-grants.mjs`) - grant compendium entries the way the sheet's drop handlers do (Perk / Origin / Faction drops).
  `grantEntries` runs the grant with each recipient as the actor.
- **`sprint`, `shove {bowlOver?}`, `slow {feet, to}`** (`combat/sprint-shove-slow.mjs`) - start a Sprint; the Maneuver shove
  (Bowl-Over: push and Prone both); slow the recipients' next turn.
- **`createCompanion {name, system?}`** + recipient **`created`** (`picks/create-companion.mjs`) - a new companion made by
  `companions.mjs#createCompanion`: the owner's ownership, linked, through the GM. Later steps grant onto it with
  `to: created` (Primary / Secondary Tech's drone).
- **`addToSceneList {flag, entry}`** (`picks/canvas-items.mjs`) - keeps a pick on the actor for this scene, labelled as it
  was offered (I Can Do That's `copiedAbilities`).

### Recipients, selectors, pick sources and text

- **Companion recipients** (`picks/companions.mjs`): `companions[:<type>]`, `firstCompanion:<type>`,
  `selfOrCompanion:<type>`, `companionOwner`, `flagActor:<flag>`.
- **Item selectors** - a new `steps.mjs#registerItemSelector(prefix, fn)` registry (the validator accepts registered
  prefixes). In `picks/item-where.mjs`:
  - `where:<tags&...>`
  - `withAttached:<tags>`, `firstWithAttached:<tags>`
  - `justGranted`
  - `host`
  - ref `@flagged.<flag>`
- **Pick sources:**
  - `specializations {skill}` (`uses-kit-pieces.mjs`)
  - `canvasItems {filter?, anyOf?, self?}` - other tokens' items, one per book source, labelled "<actor>: <item>"
  - `sceneList {flag}` (`canvas-items.mjs`)
- **Text placeholders** - a new `steps.mjs#registerTextRef(head, fn)` registry, used by `fillText`.
  `{sourced.<id>.<path>|default}` (`uses-grant-pieces.mjs`) reads a value on the actor's copy of a book item. It works
  together with items1's no-default `{sourced...}` in `predicate.mjs#interpolate`.
- **Refs:** `@takeMine` (`kits.mjs#takeMineMultiplier`), `@turnWeapons.<flag>`.

### Tags

- **`link:` family** (family "roll", in `picks/companions.mjs`):
  - `hasCompanion`, `pair`, `ownCompanion`
  - `rolledAgainst:partner|owner[:attack]`
  - `deployedThisRound[:<type>]`, `holderDeployed`
  - `targetAdjacentToHolder`, `selfAdjacentToHolder`
- **Item tags:**
  - `item:heldBySelf`, `item:entryOfOwned:<type>`
  - `item:firstAttack:<tags&>`, `item:primaryAttack`
  - `item:line:<line>`, `item:folderName:<name>`, `item:nameOfOwned:<type>`, `item:isVar:<key>`
- **Actor and roll tags:**
  - `check:markTarget`
  - `self:` / `target:status:any[:except=a|b]`
  - `roll:entry:<key>` - in a `targeted` Trigger, the defender's check entry. `triggers.mjs` now hands it over.
  - `self:specializationNamed:<skill>:<text>`, `self:sprinting`
  - `self:` / `target:hasArmorUpgrade:<defense>`
  - `self:sourced:<id>:<path>=<value>` / `!=<value>` - a missing value makes `=` false and `!=` true, unlike a
    `{sourced}` in the tag text.

### Rule types

| Rule type | What it does | Read by |
|---|---|---|
| `EssenceRedirect {from, to, roleName}` | Sends a Role's Essence increase to another Essence (Cordial, Rough and Takes No Guff) | `grants.mjs#essenceRedirect` |
| `CarryExemption {items, max}` | Hands of gear carried outside the hands | `kits.mjs#extraCarriedHands` |
| `KitModifier {scroungeDif, upgradeRoll, keepRoll, respecialize}` | Changes kit scrounging and use | `kits.mjs` (scroungeDif, consumeKit, useKit) |
| `AllyRangeMultiplier {multiply}` | Multiplies ally range | `nearby-allies.mjs` |
| `ShiftCap {maxDown}` | Caps the net downshift (Fanatic) | `dice.mjs` |
| `PetCommand {difTier}` | Pet command difficulty tier | `companions.mjs#commandDif` |
| `PartyRequisition {perMember}` | Requisition per party member | `actor.mjs` (Base Tech) |
| `ArmorUpgradePenalty {mark, amount}` | Lowers the Armor Upgrades of a creature with the holder's mark: Toughness first, never below +0 (Make an Opening) | Plug-in's own `registerDefenseAdjust` |
| `ManeuverOption {option: disarm \| dismantle}` | `disarm` adds Disarm to the Maneuver choice; `dismantle` lets a disarmed weapon matching `when` be pulled apart | `dice.mjs`; `target-riders.mjs#disarm` |
| `ConditionDuration {condition, rounds}` | An attack's own on-hit Condition length; dice are rolled each hit | `target-riders.mjs#conditionRiders` |
| `BeforeArea {options?, dataset?, exclude?}` | Before the template: bigger / smaller / shape / single (single sets a dataset key). After it: untick up to `exclude` (`skillDie` or a formula) caught tokens | `documents/item.mjs` |
| `SwapShrug {from, to}` | A hit resisted with `to` instead of `from` drops its secondary damage and Conditions (Unstoppable Force) | `target-riders.mjs#attackRiders` |

### Parameters on existing types and scopes

- `DialogSwitch`: `clearSnagCost` (`dialog/clear-snag-cost.mjs`, via `registerApplyDialog`) and `ignoreArmorUpgrades`
  (with `spend: {max}`, Pinpoint).
- `HitRider`: scope `companion` and scope `markedTarget` + `mark` (`marks/marked-target-hits.mjs`). `Assist`: scope
  `companion`. `hit-rider.mjs` gained `HIT_RIDER_SOURCES` and `hitRiderEntries(attacker, target)`, and its own entries
  are now limited to the self / host scopes.

### Engine edits to existing steps

- `grant`: `removeTraits`, and `unlinked` (no `grantedBy` - the copy outlives the granting item: Poison Prodigy).
- `pickGrant`: `optional` (a cancelled pick skips only that grant: Primary Tech's "can choose" upgrades).
- `disarm`: `payFree` (a Free action per hand, paid as it's used).
- `fitUpgrade` (`pick-and-loop-steps.mjs`): `onto: granted`, `uuid` with `{var.x}`, and `until`
  (endOfTurn / endOfNextTurn / scene / untilUsed / rounds:N, mapped to `attachTemporaryUpgrade`'s kinds). Plus a validator.
- `BrawnRequirement`: `carryingOnly`.
- `DamageReduction`: `minDamage`, `counter {path, max}`, `quiet`.
- New `mechanics/resources/game-lines.mjs#lineOf(uuid)`, moved out of `grants.mjs`, which imports it.

## Verdicts

| Item | Pack file | Verdict |
|---|---|---|
| Shaped Charges | `gijcrbitems/_source/Shaped_Charges_xFMzM5pycDmmw4u3.json` | converted (2 rules) |
| Poison Prodigy | `ccitems/_source/Poison_Prodigy_qkvDR7I1tBwOyStY.json` | converted (1 rule) |
| Command & Control | `dditems/_source/Command___Control_oPtLbnCPYyCSZIVU.json` | converted (2 rules) |
| Ally Awareness | `tfcrbitems/_source/Ally_Awareness_WzccenAOAQxiARf7.json` | converted (2 rules) |
| Checkmate | `gijcrbitems/_source/Checkmate_BcFM3JhWdk5XHIZL.json` | converted (1 rule) |
| Unstoppable Force | `gijcrbitems/_source/Unstoppable_Force_DwnPEw2POcj3f0Za.json` | converted (1 rule) |
| Wrecking Ball | `gijcrbitems/_source/Wrecking_Ball_t8OnOh6dQ0FoWBsG.json` | converted (3 rules) |
| Muzzle Punch | `qgtgitems/_source/Muzzle_Punch_uwr8mZd2KXIZt61D.json` | converted (1 rule) |
| Scapegoat | `ccitems/_source/Scapegoat_T2NO8rvrvvVYOuAP.json` | converted (1 rule) |
| Concentrated Explosion | `ccitems/_source/Concentrated_Explosion_1Dsom5S1ByB6Egbk.json` | converted (1 rule) |
| Concentrated Fire | `ccitems/_source/Concentrated_Fire_2UPKeLtWRXIoDlux.json` | converted (1 rule) |
| Snatch | `fffav1items/_source/Snatch_a5DNgno8XV7pVBzO.json` | converted (2 rules) |
| Dismantle Firearm | `iafav2items/_source/Dismantle_Firearm_6XYgRBQGPm7gF41b.json` | converted (1 rule) |
| Bowl-Over | `prcrbitems/_source/Bowl_Over_3oeSWdRfUpOq6b9y.json` | converted (1 rule) |
| Pinpoint | `tfcrbitems/_source/Pinpoint_r810HCughuqpIhaZ.json` | converted (1 rule) |
| Disarming Shot | `dditems/_source/Disarming_Shot_K2uvTIYYzCixgBD7.json` | converted (1 rule) |
| Fanatic | `dditems/_source/Fanatic_QhiG6aB3Z2GM1Get.json` | converted (1 rule) |
| Make An Opening | `dditems/_source/Make_An_Opening_DezsS1cuMwU8Qiwb.json` | converted (3 rules) |
| On My Mark! | `dditems/_source/On_My_Mark__rkAvOCaF0RxnawZe.json` | converted (1 rule) |
| Co-Dependent | `eocitems/_source/Co_Dependent_2tPC2AgganNw2GgO.json` | converted (2 rules) |
| Teleporting Beam | `mlpcrbitems/_source/Teleporting_Beam_RhSRS4n3dG9TQ92L.json` | converted (1 rule) |
| Reveal Weakness | `fgtaaitems/_source/Reveal_Weakness_r2VrdENpcDTo0WGO.json` | converted (2 rules) |
| Salvaged | `fffav1items/_source/Salvaged_sA8GbXKPcRuPHzNt.json` | converted (1 rule) |
| Augur | `eocitems/_source/Augur_yk2MnBePZ5gxOEOj.json` | converted (3 rules) |
| In Their Element | `gijcrbitems/_source/In_Their_Element_UkAgppAPli6yrImr.json` | converted by part items2 (EnvironmentalExpertise {scope: companion, shareEnvironments}) - not touched here |
| Pack Attack | `gijcrbitems/_source/Pack_Attack_7k9DzU918tm8OK9V.json` | converted (2 rules) |
| Assistant | `gijcrbitems/_source/Assistant_l6nLJeg8ev4mhNwE.json` | converted (1 rule) |
| Assistant | `mlpcrbitems/_source/Assistant_ueOByvZQdpmGc3Ds.json` | converted (1 rule) |
| Agreeable | `gijcrbitems/_source/Agreeable_2b51OQSju1kswWLj.json` | converted (1 rule) |
| Constrictor | `ccitems/_source/Constrictor_S63cNsFogI1Ahh2C.json` | converted (1 rule) |
| Acid Sacs | `wtnvcgitems/_source/Acid_Sacs_8sUOMdsOyxfF0o1s.json` | converted (2 rules) |
| Telemetry Data | `qgtgitems/_source/Telemetry_Data_U4Ug6iUQC4Ehzs5l.json` | converted (1 rule) |
| Terminal Guidance | `qgtgitems/_source/Terminal_Guidance_kqqN3i3ZR8qYHQaN.json` | converted (1 rule) |
| Automatic Harmonics | `qgtgitems/_source/Automatic_Harmonics_Foow2rilePmztBFk.json` | converted (1 rule) |
| Buzz The Tower | `qgtgitems/_source/Buzz_The_Tower_q0LPjcOQ0bnTSZTy.json` | converted (2 rules) |
| Ambush Deployment | `tfcrbitems/_source/Ambush_Deployment_NMVCdrUBejXHGBOa.json` | converted (2 rules) |
| Enhanced Sensors | `tfcrbitems/_source/Enhanced_Sensors_Qqw4h2kmK8HsE3zC.json` | converted (1 rule) |
| Shield Companion | `tfcrbitems/_source/Shield_Companion_K46iTCabKbKdBQKA.json` | converted (2 rules) |
| Environmental Weapon (Environmental) | `gijcrbitems/_source/Environmental_Weapon__Environmental__K6taaZgeGFxX4lA3.json` | converted (1 rule) |
| Forage | `gijcrbitems/_source/Forage_QXpG3NuwaFgbdc0x.json` | converted (1 rule) |
| Primary Tech | `gijcrbitems/_source/Primary_Tech_5eOqntPaqp1g4M7k.json` | converted (1 rule) |
| Secondary Tech | `gijcrbitems/_source/Secondary_Tech_p301AoQlteHsA4pH.json` | converted (1 rule) |
| Ghillie Suit Sniping | `gijcrbitems/_source/Ghillie_Suit_Sniping_O3w2NL8H2gCtkWzN.json` | converted (2 rules) |
| Quickbash | `gijcrbitems/_source/Quickbash_YlihpNSSspqwfMv6.json` | converted (1 rule) |
| Integrated Specialized Weapon | `gijcrbitems/_source/Integrated_Specialized_Weapon_ddLUrsn3t96NpUqL.json` | converted (1 rule) |
| Animalize | `ccitems/_source/Animalize_362Yyjs1INvYufPN.json` | converted (1 rule) |
| Highly Effective | `ccitems/_source/Highly_Effective_KEDIY0wDCLbOIXuR.json` | converted (1 rule) |
| Steady Hand | `ccitems/_source/Steady_Hand_1zreGdgegCeRjJPT.json` | converted (2 rules) |
| Flurry of Attacks | `ccitems/_source/Flurry_of_Attacks_Fv2fYJxjgGyqAbq6.json` | converted (2 rules) |
| Base Technological Advancement | `ccitems/_source/Base_Technological_Advancement_3ZW6OOOli170AwsW.json` | converted (1 rule) |
| Multifaceted | `fffav1items/_source/Multifaceted_05INUNEBfKDL6GmJ.json` | converted (1 rule) |
| Multifaceted | `fffav1items/_source/Multifaceted_g6bxWMq3UDSstUfp.json` | converted (1 rule) |
| Cordial | `fffav1items/_source/Cordial_I4tkodAyDsVPSXCU.json` | converted (2 rules) |
| Faction Reservist | `fffav1items/_source/Faction_Reservist_w6fjujYpg8DrnuMX.json` | converted (1 rule) |
| Field Promotion | `fffav1items/_source/Field_Promotion_aeXmsn13l790Jxqr.json` | converted (1 rule) |
| On-The-Job Training | `iafav2items/_source/On_The_Job_Training_uSPdZBM1S7VZ0lyy.json` | converted (1 rule) |
| Rough and Takes No Guff | `sssitems/_source/Rough_and_Takes_No_Guff_2SHHZs1qVMFBB2kW.json` | converted (3 rules) |
| Brainstorm | `prcrbitems/_source/Brainstorm_iVpoqL7ZY4SK4iLc.json` | converted (1 rule) |
| I Can Do That | `jttitems/_source/I_Can_Do_That_e26WbtPYfNCm12LO.json` | converted (1 rule) |
| I Can Still Do That | `jttitems/_source/I_Can_Still_Do_That_JgHOsyaD5WR5lgMk.json` | converted (1 rule) |
| Inventive Application 1 | `jttitems/_source/Inventive_Application_1_ubR7N8PYKDMSxmkM.json` | converted (1 rule) |
| Inventive Application 2 | `jttitems/_source/Inventive_Application_2_As1eUnG5W54GwotE.json` | converted (1 rule) |
| Manifest Enhancement | `tfcrbitems/_source/Manifest_Enhancement_syJ8looy53vONS0X.json` | converted (1 rule) |
| A Hint of Independence | `dditems/_source/A_Hint_of_Independence_TkzfZUNiGvv5iWDh.json` | **not converted** - see "Not converted" |
| Volatile Delivery | `dditems/_source/Volatile_Delivery_HJd2dd41bj3oY899.json` | converted (1 rule) |
| Candle | `mlpcrbitems/_source/Candle_s0uI9etsaZdaP3xN.json` | converted (1 rule) |
| Torch | `mlpcrbitems/_source/Torch_oVB4sfY5HHIEGTA3.json` | converted (1 rule) |
| Headlamp | `kocitems/_source/Headlamp_m2hiT236MOKHKyvJ.json` | converted (1 rule) |
| Candlesprite Lantern | `kocitems/_source/Candlesprite_Lantern_MhKwWyukMEdzsfRC.json` | converted (1 rule) |
| Cybertronian Military | `fgtaaitems/_source/Cybertronian_Military_j1EQkzPX3k5HgVMQ.json` | converted (1 rule) |
| Cybertronian with Attitude | `fgtaaitems/_source/Cybertronian_with_Attitude_me3jAybxn8Smb83w.json` | converted (1 rule) |
| Cybertronian Perk | `fgtaaitems/_source/Cybertronian_Perk_VoYFiyFRGgMQ7ob0.json` | converted (1 rule) |
| Factions | `fgtaaitems/_source/Factions_Y9FmJITVz3nXJQCc.json` | converted (1 rule) |
| Weapon Forage | `fffav1items/_source/Weapon_Forage_OWVl8HRXBI7mwJ0j.json` | converted (1 rule) |
| Handy Scrounger | `qgtgitems/_source/Handy_Scrounger_uXV4DoOaLhrZmIkz.json` | converted (1 rule) |
| Stretching Resources | `qgtgitems/_source/Stretching_Resources_CJTtjWkUl7BhiaN4.json` | converted (1 rule) |
| Bomber | `ccitems/_source/Bomber_WW5PNoq6d3CBU3FC.json` | converted (1 rule) |
| Medicine Cabinet | `ccitems/_source/Medicine_Cabinet_d5xmwJqcoXyhVIVK.json` | converted (1 rule) |
| Kitted Out | `ccitems/_source/Kitted_Out_f0GAXS72eKNLB6x1.json` | converted (2 rules) |
| Med Kit | `prcrbitems/_source/Med_Kit_UgggFXZqiyKxwMuA.json` | converted (2 rules) |
| Wrist Communicator | `prcrbitems/_source/Wrist_Communicator_W7nXP8pOQaDJmZbT.json` | converted (1 rule) |
| Loader | `tfcrbitems/_source/Loader_OVTDUJRI81VCrFZg.json` | converted (5 rules) |
| Protomatter Injection Layer | `eocitems/_source/Protomatter_Injection_Layer_LjibCLhbxNxaQnrU.json` | converted (2 rules) |
| Automated Repair Kit | `tfadvitems/_source/Automated_Repair_Kit_2P2i605rHgNhm2FJ.json` | converted (1 rule) |
| Imaginary Corn | `wtnvcgitems/_source/Imaginary_Corn_2i8jWYZH14Cu30LO.json` | converted (1 rule) |
| Medicine Kit | `wtnvcgitems/_source/Medicine_Kit_3mgHGQRzVaKtwnWb.json` | **not converted** - see "Not converted" |
| Gyro-Gun Alternate Effect (round 14 leftover) | `eocitems/_source/Gyro_Gun_Alternate_Effect_pkAJxZG4ujXfdBem.json` | converted (1 rule) |

## Not converted (2)

- **A Hint of Independence** - two things are missing:
  - **Labels:** the choose step's option labels aren't localized, so a rule would put the eight Imperfection names into the
    pack (a question is parked).
  - **Readers:** the imperfection is read in six hand-written places (`grants.mjs#imperfectionOf`). Those would stay code
    either way.

  Still code: `GRANT.hintOfIndependence` / `HANDLERS.hintOfIndependence`.
- **Medicine Kit (WTNV)** - a kit item's own kit Use button comes before rules Uses
  (`action-perks.mjs#useFor`), so a rules Use on a kit is never reached. Still code in `kits.mjs`.

## Behaviour differences

These are deliberate, and covered by the tests.

**Companions**
- **Automatic Harmonics, Buzz The Tower:** their once-per limit is now counted on the owner, not on the drone.
- **Shield Companion:** two deployed Mini-Cons now stack to +2.

**Damage, Conditions and areas**
- **Terminal Guidance, Wrecking Ball, Constrictor:** damage to a creature the user doesn't own goes through the damage step,
  which posts it for the GM instead of writing it directly.
- **Gyro-Gun Alternate Effect:** the generic Impaired rider still applies, and reads the attack's own ConditionDuration
  (1d2). Any other Impaired attack is unchanged (1 round).
- **Shaped Charges:** the double damage is a HitMultiplier. It now runs before the flat hit bonuses, so they aren't doubled
  any more (question parked).
- **Concentrated Fire:** "a fire weapon" reads the item's traits. Those include traits added by upgrades.
- **Dismantle Firearm:** "Ballistic or Reload" also reads traits added by upgrades.
- **Unstoppable Force:** "heavy armor" is `self:wearing>=heavy`, on any armor not marked unequipped. The old `superHeavy`
  class it also checked doesn't exist.

**Pinpoint, Make an Opening, Snatch, Scapegoat**
- **Pinpoint:** a 0-3 number box (a DialogSwitch spend).
- **Make an Opening:** a switch on unarmed attacks.
- **Snatch:** labelled roll sources.
- **Scapegoat:** its chat line is the essenceDamage step's.

**Items and gear**
- **Gear Uses** (Candle, Torch, Headlamp, Lantern, Wrist Communicator, Med Kit and the rest) need the item equipped, as
  every rules item does.
- **Field Promotion:** uses the faction the actor owns.
- **Multifaceted:** leaves out every faction the actor owns.
- **Origin Benefit pickers** (On-The-Job Training, Cybertronian Military / with Attitude): one flat list.
- **Kitted Out:** the old "Any" Specialization (which acted as a cancel) isn't offered.

**Copying and creating**
- **I Can Do That / I Can Still Do That:**
  - The Personal Power is paid after the pick, so a cancelled pick costs nothing.
  - The copy lasts to the end of the next turn, or the scene out of combat (question parked).
- **Primary / Secondary Tech:** a cancelled upgrade pick skips just that pick, as before.

**Chat**
- The wording comes from the steps' own messages.

## Bugs found and fixed

- **Muzzle Punch** - "the better of Finesse or Might" compared die faces, so an untrained Finesse (d20) beat a trained
  Might. The rule compares `@skill.<x>.rank`. Test: conv15-uses "Muzzle Punch" (Finesse d20 vs Might d6 rolls Might).
- **Primary / Secondary Tech (drone)** - the drone was made with a bare `Actor.create`. That fails for a player without
  actor-create permission, and the drone was never linked to its Technician (no `companionOf`, so the companion
  recipients and tags didn't see it). It is now made by `companions.mjs#createCompanion`: linked, and through the GM.
  Test: conv15-uses "Primary Tech: a drone".
- **A Perk lost on a cancelled pick** - not fixed here (A Hint of Independence stays code). The note is kept for whoever
  converts it.

## Code vs notes - needs a ruling

These are parked in `questions.md`:
- **Constrictor:** the `grappling` flag is never written.
- **I Can Do That:** the copy's duration out of combat.
- **A Hint of Independence:** labels.
- **Shaped Charges:** doubling order.
- **Kitted Out:** `pickSpecialization` turns '' into null.

## Shared-file edits

Each was a surgical edit, re-read before editing.

**Engine**
- `rules/steps.mjs`:
  - `registerItemSelector` (and the item validator)
  - `registerTextRef` / `fillTextRefs` in `fillText`
  - `grant` `removeTraits` / `unlinked`
  - `pickGrant` `optional`
  - `disarm` `payFree`
- `rules/triggers.mjs`: a targeted Trigger's roll carries the defender's check `entry`.
- `rules/plugins/combat/hit-rider.mjs`: `HIT_RIDER_SOURCES`, the own-scope filter, `hitRiderEntries`.
- `rules/plugins/picks/pick-and-loop-steps.mjs`: `fitUpgrade` `onto: granted`, `{var.x}` uuid, `until`, validator.
- `rules/plugins/effects/brawn-requirement.mjs`: `carryingOnly`.
- `rules/plugins/combat/damage-reduction.mjs`: `minDamage`, `counter`, `quiet`.
- `rules/plugins/index.mjs`: the "Round 15 (uses)" block only.

**Hand-written code** (the converted items' code, constants and imports removed)
- `mechanics/resources/`:
  - `grants.mjs`
  - `grant-uses.mjs`: GRANT is now hintOfIndependence, glow and personalPowerSupply.
  - `kits.mjs`
- `mechanics/combat/`:
  - `target-riders.mjs`
  - `rider-uses.mjs`
  - `combat.mjs`
  - `nearby-allies.mjs`
  - `weapon-traits.mjs`
- `mechanics/companions/`:
  - `companions.mjs`
  - `companion-uses.mjs`
- Elsewhere in `mechanics/`:
  - `actions/lend-assistance.mjs`
  - `world/rough-terrain.mjs`
  - `rolls/roll-dialog.mjs`
- `items/`:
  - `social/social-rolls.mjs`
  - `gear/poison-coating.mjs` (`poisonProdigy` removed)
- `documents/`:
  - `actor.mjs`
  - `item.mjs` (BeforeArea readers in place of `pickConcentratedArea` / `applyShapedCharges`)
- `dice.mjs`: ShiftCap and ManeuverOption readers; Pinpoint, Make an Opening, Augur and Snatch code removed;
  `applyDialogRiders` removed.
- `apps/roll-options-dialog.mjs`
- `templates/dialog/roll-dialog.hbs`: the Pinpoint, Make an Opening and Steady Hand blocks.

**Deleted:** `items/attacks/shaped-charges.mjs` and its test.

**Tests updated**
- `companions.test.js`
- `lend-assistance.test.js`
- `kits.test.js`
- `grants.test.js`
- `target-riders.test.js`
- `vehicle-upgrades.test.js`

## Unused strings

These `lang/en.json` keys are no longer read anywhere in `module/`, the templates or the packs:

- **Companions:**
  - `E20.AmbushDeployment`, `E20.AutomaticHarmonics`, `E20.BuzzFailed`, `E20.BuzzHit`
  - `E20.ConstrictorSqueeze`, `E20.PetAssisted`, `E20.PetNeedsFavorite`, `E20.TerminalGuidance`
- **Kits:**
  - `E20.ImaginaryCornEaten`, `E20.KitAlreadyGranted`, `E20.KitLoader`, `E20.LoaderCarry`, `E20.LoaderShield`
  - `E20.MedKitRestocked`, `E20.ProtomatterFailed`, `E20.ProtomatterNoEnergon`, `E20.ProtomatterRefilled`
  - `E20.WristCommunicatorEmpty`, `E20.WristCommunicatorPick`, `E20.WristCommunicatorUsed`
- **Grants:**
  - `E20.GhillieSuitPick`, `E20.GhillieSuitDone`
  - `E20.GrantQuickbashPrompt`, `E20.GrantEquipment`, `E20.GrantUpgrade`, `E20.GrantNeedsAlly`, `E20.GrantPickEssence`
  - `E20.GrantWeapon`, `E20.GrantGear`, `E20.GrantPickOriginBenefit`
  - `E20.FactionBorrowed`, `E20.EssenceRedirectSet`, `E20.EssenceRedirectOff`, `E20.BrainstormLimit`, `E20.AugurHasBlade`
  - `E20.MultifacetedDrop`, `E20.MultifacetedGain`, `E20.MultifacetedDone`
  - `E20.InventivePrompt`, `E20.InventiveSidearm`, `E20.InventivePowerWeapon`, `E20.InventiveArmor`,
    `E20.InventiveUpgrade`, `E20.InventiveArmorDone`
- **Tech and copying:**
  - `E20.TechPrompt`, `E20.TechArmor`, `E20.TechGear`, `E20.TechWeapon`, `E20.TechEnhance`
  - `E20.ICanDoThatPrompt`
- **Riders:**
  - `E20.RollDialogSteadyHand`, `E20.RollDialogPinpoint`, `E20.RollDialogMakeAnOpening`, `E20.SnatchTwoHanded`
  - `E20.TeleportingBeamPick`, `E20.TeleportingBeamOutOfRange`, `E20.CheckmatePick`
  - `E20.WreckingBallOn`, `E20.MuzzlePunchNoWeapon`, `E20.BowlOverNotSprinting`
  - `E20.RevealWeaknessDone`, `E20.RiderChoiceSet`, `E20.AllyAwarenessDone`, `E20.WeaponSalvagedDestroyed`
- **Poison Prodigy:**
  - `E20.PoisonProdigyTitle`, `E20.PoisonProdigyPrompt`, `E20.PoisonProdigyChangeType`, `E20.PoisonProdigyAddUpgrade`
  - `E20.PoisonProdigyUpgradeReady`, `E20.PoisonProdigyPickNew`, `E20.PoisonProdigyChanged`

New strings are in `r15/lang-uses.json` (`E20.RulesExtUses.AssistBanked`, `.Moved`, `.OutOfRange`). Still used and kept:
- `E20.TechDroneName` (createCompanion)
- `E20.LightOn` / `E20.LightOff`
- `E20.Concentrated*`, `E20.ShapedChargesPick*`
- `E20.Dismantle*`, `E20.UnstoppableForceNote`

## Rule count

**114 rules on 84 items** (all of them inserted as text into `packs/*/_source/*.json`, each file's EOL kept).

## Checks

The results of eslint, `scripts/check-rules.mjs` and jest are in the hand-off report.
