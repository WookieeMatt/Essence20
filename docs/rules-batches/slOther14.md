# Round 14, part Other (rest-other)

Scope: the 24 "convert" entries of the rest-other survey (`survey/result-rest-other.json`) - code in `module/mechanics/*`,
`module/sheet-handlers`, `module/documents` and `module/dice.mjs`. All 24 converted (25 pack files: Scuba Gear has two
printings), using only existing engine pieces. No engine features added, no plug-ins, no new strings. Tests:
`module/rules/conv14-other.test.js` (34 tests).

## Verdicts

| Item | Pack file | Verdict | Rule |
|---|---|---|---|
| Titanspark | eocitems/Titanspark_ldnUTXw5w21toLIy | converted | Size {steps: 1} |
| Dodgy x5 | mlpcrb / gijcrb / tfcrb / prcrb / wtnvcg Dodgy | converted | ActionCost {action: defend, to: free} |
| Light Armor (MLP) | mlpcrbitems/Light_Armor_4M1CnapdbRIBl3It | converted | RollModifier ↓1 |
| Heavy Armor (MLP) | mlpcrbitems/Heavy_Armor_B8RcQxof4JmlbEHE | converted | RollModifier ↓2 |
| Potent Poison | ccitems/Potent_Poison_CrxBz7IEuI92WfTB | converted | ItemModifier on the host's ongoingDuration |
| Reinforced Hardpoint | tfcrbitems/Reinforced_Hardpoint_YDOmBfuUnYFalIVY | converted | Hardpoints {reinforced, items: [item:isHost]} |
| Boarder | iafav2items/Boarder_BJpJWK7oDfw51Dxl | converted | RollModifier Edge |
| Reprogrammable | qgtgitems/Reprogrammable_EOG8PH8fIJAVpbGY | converted | ItemModifier +2 usesPer |
| Leadfoot | qgtgitems/Leadfoot_zdXJzzqekwPAnCtT | converted | RollModifier immune untrainedSnag |
| Environmentally Sealed | prcrbitems/Environmentally_Sealed_v5ZJXRVnMiRaI4AU | converted | HazardProtection |
| Environmental Aegis | jttitems/Environmental_Aegis_jw8ggFiT6xdr0uMc | converted | HazardProtection |
| Gas Mask | gijcrbitems/Gas_Mask_d089BSbVVaXWWTx6 | converted | HazardProtection |
| NBC Protection Suit | gijcrbitems/Nuclear_Biological_Chemical_Protection_Suit_teDcExlkzRTGTChr | converted | HazardProtection |
| Gasmask (KoC) | kocitems/Gasmask_m2LGzwoUL9LVbOp9 | converted | HazardProtection |
| Scuba Gear | gijcrbitems + mlpcrbitems Scuba_Gear_cZpeYK7VoLJKGKL6 | converted | HazardProtection |
| Read the Land | iafav2items/Read_the_Land_j8wVLLK4XvVEuP6F | converted | 2 Use rules (on / off) |
| Adaptation | gijcrbitems/Adaptation_PmY8jGTiemnSdsHi | converted | 2 Use rules (on / off) |
| Power Fist | qgtgitems/Power_Fist_7gT8dddccGA6gbGa | converted | Grant {skipIfOwned} |
| Team Perk: Zeo Crystal Wielder | ttsgitems/Team_Perk__Zeo_Crystal_Wielder__..._lNCrjjiiUhI6ROal | converted | ItemModifier -1 powerCost |
| Restraining Chains | ttsgitems/Restraining_Chains_AVXOwNhDWQJewKAl | converted | Trigger added + createItem with children |

## Converted

- **Titanspark** - `Size {steps: 1}` (full ladder, capped at titanic); `_prepareTitansparkSize` gone. It now runs in runDerived
  instead of just before `_prepareDefenses`; nothing in between reads `system.size` (checked the prepare chain and every
  registered derived hook), so the result is the same. The +1 Health stays the Active Effect.
- **Dodgy (all 5 printings)** - `ActionCost {action: "defend", to: "free"}`; `DODGY_IDS` and the override in
  `getNamedActionType` gone (the function stays, returning the printed type). The sheet's Defend button spends Standard and
  the cost options make it Free, as with Whisper Warrior / Shogun Upgrade. Combinations with Canny Combatant / Stealthy
  Misdirection's asked discounts come out the same (the asked offers are only offered when cheaper than Free).
- **MLP Light / Heavy Armor** - `RollModifier {downshift: 1 | 2}` on `{any: [skill:athletics, skill:acrobatics,
  skill:infiltration]}`, active while equipped. Light carries `not:self:wearingItem:item:id:B8RcQxof4JmlbEHE`, so with both
  worn only Heavy's ↓2 applies (the old `Math.max`); two copies of one armor count once (copy dedupe). `lightArmorPenalty` and
  the dice.mjs block gone; the "not Silent" exclusion for these two armors stays as data (`MLP_ARMOR` in weapon-traits.mjs).
- **Potent Poison** - `ItemModifier {items: ["item:isHost"], path: system.ongoingDuration, add 1, stacks: true}`: the weapon
  it is attached to has one more Ongoing round in derived data, which documents/item.mjs already reads. `TRAIT_UPGRADE.potentPoison` gone.
- **Reinforced Hardpoint** - `Hardpoints {reinforced: true, items: ["item:isHost"], stacks: true}` (read by
  `ruleFiresAsReinforced`); `REINFORCED_HARDPOINT_UPGRADE` gone. `stacks: true` so a copy on each of two weapons works (the
  copy dedupe would otherwise drop the second).
- **Boarder** - `RollModifier {edge: true}` on Athletics / Acrobatics; `hasBoarder`, `BOARDER` and the dice.mjs block gone.
- **Reprogrammable** - `ItemModifier` +2 on `system.usesPer` of every per-day nanomite power with uses (`stacks: true`, one
  per copy); `getDailyUsesMax` now just reads the (derived) usesPer. Nanoflage's Mimic still returns 1 first.
- **Leadfoot** - `RollModifier {immune: ["untrainedSnag"], when: [skill:alertness, vehicle:driving]}` (read by
  ruleNoUntrainedSnag, which _isUntrainedSnag already asks); `LEADFOOT_ID` and its branch gone.
- **Environmentally Sealed / Environmental Aegis** - `HazardProtection {categories: [breathing] | [breathing, temperature],
  when: [self:morphed]}`; labelled with the item name as before.
- **Gas Mask, NBC Protection Suit, Gasmask (KoC)** - `HazardProtection {environments: [toxicAtmosphere]}` (gear: active
  while equipped). **Scuba Gear (both printings)** - `HazardProtection {environments: [thickAtmosphere, thinAtmosphere]}`.
  `GAS_MASK_IDS`, `SCUBA_GEAR_ITEM_ID`, the two exported ids, `_isFrom`, `_hasEquippedGear` and the four checks gone.
- **Read the Land** - two Use rules on the `flags.essence20.environmentalExpertiseActive` flag: "Switch on" (`when` not set,
  cost 1 Story Point, sets it, chat line) and "Switch off" (`when` set, free, clears it). Only one is ever available, so the
  button never asks which. Same gate as `canUsePerk` (on: a Story Point can be spent; off: always). banked-buffs.mjs's
  canUsePerk / onPerkUse branches gone (the rules Use takes the button first anyway).
- **Adaptation** - the same pair with cost `{rolePoints: true}` (the base Role Points item, as `_getBaseRolePoints`); no
  action cost (see rulings). `ADAPTATION_ID` gone; `READ_THE_LAND_ID` stays (hasActiveEnvironmentalExpertise reads it).
- **Power Fist** - `Grant {uuid: Close Combat Heavy Bludgeoning, skipIfOwned: true}`; the alteration-handler branch and its
  constants gone (`grantIntegratedWeapon` is still used by other callers).
- **Zeo Crystal Wielder** - `ItemModifier {items: [item:id:NiEaLWcx8N48fvvN, item:data:system.powerCost>0], path:
  system.powerCost, add -1}`; `fixedPowerCost` now just parses the (derived) powerCost. The `>0` keeps the old `max(0, ...)`.
- **Restraining Chains** - `Trigger {event: added}` with `createItem {data: weapon "Restraining Chains", children:
  [weaponEffect "Restraining Chains Effect": targeting / projectile, grapple, damage 0, vs Toughness, 30 / 65 ft]}`; the drop
  branch, `RESTRAINING_CHAINS_ID` and `onRestrainingChainsDrop` gone.

## Code vs notes - needs a ruling

- **MLP Light / Heavy Armor - Initiative.** The notes (and the old helper's doc comment) say the ↓1 / ↓2 also applies to
  Initiative tests. The code never applied it there: `lightArmorPenalty` accepted `'initiative'` but was only called from
  `_getAutomaticCombatModifiers`, and Initiative rolls through `prepareInitiativeRoll`, which never asked it. Converted to the
  code (Athletics, Acrobatics, Infiltration only). To follow the notes, add `"roll:initiative"` to each rule's `any` list
  (Initiative reads RollModifiers since round 14 of the guide).
- **Adaptation - the Free action.** The notes say "Use button (Free action)" and the item has `actionType: free`, but the
  Perk Use button never spends an item's actionType, and the old branch spent nothing - so no action was charged. Converted
  with no action cost. To follow the notes, add `"action": "free"` to the "Switch on" rule's `cost` (the old code would
  never have charged for switching off).
- **Read the Land - which environment.** The notes leave the chosen environment and the scene-end switch-off to the table,
  as the code did (one flag for any terrain, never cleared). Unchanged.

## Smaller differences the engine brings (no ruling needed unless you disagree)

- **Things granted now leave with their item:** Power Fist's weapon goes when the Alteration is deleted, and Restraining
  Chains' attack when the Feature is (both carry `grantedBy`; the old copies stayed). The Restraining Chains weapon is also
  linked through its `system.items` map now (the old weaponEffect had only the parentId flag), and a chat card ("Granted")
  replaces the info toast.
- **Attached upgrades follow their host's equip state:** Potent Poison, Reinforced Hardpoint and an attached Boarder act only
  while the item they are attached to is equipped (the engine's rule for upgrades); the old checks looked at attachment /
  ownership only. Two Potent Poisons on the same weapon would now add 2 (`stacks: true`; one per weapon is the normal case).
- **Derived numbers show on the sheet:** Reprogrammable's powers list "4/day" and Zeo Crystal Boost shows cost 1 (before, the
  sheet showed the base value and the bonus was added when used). The item sheet still edits the stored value (upgradeTouched).
- **Labels:** Scuba Gear's protection line names the item ("Scuba Gear") instead of "breathing gear". The rule protectors run
  before the hand-written Enviro-Sealed armor / "not a living creature" checks, so with both the line names the item.
  Dodgy's Defend is logged "Defend (Dodgy)".
- **Read the Land's Story Point** goes through the engine's spend (canSpendForActor / spendForActor): a held Ruthless Point is
  spent first, a Threat uses the GM pool, and `storyPointSpent` Triggers fire - the old gate looked at the Party pool only.
- **Leadfoot's "driving"** is the `vehicle:driving` tag: the first vehicle / Zord the actor crews must have them as driver
  (the old check found any vehicle where they were the driver).

## Shared-file edits (all surgical)

- `module/dice.mjs` - weapon-traits import line (hasBoarder, lightArmorPenalty dropped); the Boarder and MLP armor blocks in
  `_getAutomaticCombatModifiers` (the Silent battledress block stays).
- `module/dice.test.js` - "MLP Light Armor takes no 'not Silent' penalty" (expects 0 now; the ↓1 is the rule).
- `module/documents/actor.mjs` - TITANSPARK_ID, the call, `_prepareTitansparkSize`. `module/documents/actor.test.js` - its describe.
- `module/documents/item.mjs` - Potent Poison's `+ 1` on roundsRemaining.
- `module/mechanics/actions/action-economy.mjs` - DODGY_IDS, the override, the `actorHasPerk` import. Test: the Dodgy tests and import.
- `module/sheets/base-actor-sheet.mjs` - a comment at the Defend spend.
- `module/mechanics/combat/weapon-traits.mjs` - MLP_ARMOR_PENALTY -> MLP_ARMOR, lightArmorPenalty, TRAIT_UPGRADE.potentPoison,
  REINFORCED_HARDPOINT_UPGRADE (+ its use), BOARDER / hasBoarder. `module/mechanics/vehicles/vehicle-upgrades.test.js` - the
  lightArmorPenalty import and asserts.
- `module/mechanics/resources/nanomite-uses.mjs` (+ test) - REPROGRAMMABLE_ID / _BONUS and the count.
- `module/mechanics/rolls/roll-dialog.mjs` - LEADFOOT_ID and its branch.
- `module/mechanics/world/environment-hazards.mjs` (+ test) - the four protections and their constants / helpers.
- `module/mechanics/world/environmental-expertise.mjs` - ADAPTATION_ID, READ_THE_LAND_ID's comment.
- `module/mechanics/resources/banked-buffs.mjs` - the Read the Land / Adaptation branches in canUsePerk and onPerkUse, three
  names from the environmental-expertise import. `banked-buffs.test.js` - the two describes.
- `module/sheet-handlers/alteration-handler.mjs` (test rewritten: an 'other' Alteration just stamps its originalId),
  `power-handler.mjs` (+ test), `zord-feature-handler.mjs` (+ test: the Restraining Chains drop makes nothing by hand).

## Unused strings

- `E20.UpgradeBoarder`
- `E20.ArmorLightPenalty`
- `E20.EnvironmentProtectionBreathingGear`
- `E20.RestrainingChainsAttackName`

(`E20.EnvironmentalExpertiseActivated` / `Deactivated`, `E20.ZordFeatureAttackEffectName` / `AttackTypeAdded` and
`E20.RolePointsOverSpent` are still used elsewhere.)

## Rule count

27 rules added on 25 pack files (Read the Land and Adaptation carry two each). `scripts/check-rules.mjs`: 0 errors.

Checks: eslint clean on every touched file; conv14-other.test.js and all touched suites pass. The full suite's failures at
the time (kits, vehicle-upgrades / actor - `jammingRadiusFeet` export missing, action-perks, weapon-upgrades, conv10-slB10 /
slD10, chat-action-buttons, conversions-uses It's Morphin' Time, dice.test.js Tough Get Going / Power Filter / Ice Machine)
are in other agents' in-progress files, none touching these items.
