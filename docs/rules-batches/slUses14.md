# Batch slUses14: round 14, part "uses" - grant / rider / companion Use buttons and kits

**Scope:** the 49 items with verdict "convert" in the survey's `result-uses.json` - the Use buttons and riders in
`mechanics/resources/grants.mjs` (+ `grant-uses.mjs`), `mechanics/combat/target-riders.mjs` (+ `rider-uses.mjs`),
`mechanics/companions/companions.mjs` (+ `companion-uses.mjs`) and `mechanics/resources/kits.mjs`. Edited in place in the
shared checkout (no branch, no commit, no pack compile).

**Result:** **48 converted, 1 not converted** (Gyro-Gun Alternate Effect). **67 rules** added on 48 items. Four small
generic engine edits (below). `scripts/check-rules.mjs`: 0 errors, 0 warnings. `module/rules/conv14-uses.test.js`: 45
tests, all passing. Full suite: 6 failing suites, none in this part's files (see "Checks").

## Engine features added 2026-10-06 (round 14, uses)

- **`KitPrerequisite {mode: waive, all: true}`** (`rules/plugins/resources/kit-prerequisite.mjs`, new export
  `ruleWaivesAllKitPrerequisites(actor, info)`): every kit's prerequisite is waived, a Skill Kit's "No Ranks" too -
  `kits.mjs#meetsKitPrerequisite` asks it before anything else (where the hand-written Kitbasher check sat). Plain
  `waive` still only drops the Skill die through the `essence20.kitPrerequisite` hook. `tiers` / `skipEssenceKits` narrow
  it as before.
- **`pickEntry {kitTier: true}`** (`rules/plugins/picks/pick-and-loop-steps.mjs`): a compendium entry with no Availability
  (gear) takes its tier from its name - "Limited Burglary Kit" is Limited (`grants.mjs#kitAvailability`) - for
  `@var.pickedDif` / `pickedAvailability`. Opt-in: other `pickEntry` steps (Scavenger's gear) are unchanged.
- **`grant {name}`** fills `{var.<key>}` and `{@formula}` too (it used `{choice.<key>}` only) - `"{var.pickedName}
  (Energon)"` after a `pickEntry`.
- **Item steps' `item: "choice:<key>"`** reads a list as well (a `pickMany`'s): every item in it, with `all: true`.

## Verdicts

| Item | Pack file | Verdict |
|---|---|---|
| Custom Gear | `gijcrbitems/_source/Custom_Gear_15b9YumuRnzL16XW.json` | converted |
| Kitbasher | `gijcrbitems/_source/Kitbasher_az09yEPydnE1tBTj.json` | converted |
| Integrated Offense | `gijcrbitems/_source/Integrated_Offense_H1ITRVeP9229PlfU.json` | converted |
| Kitbash Equipment | `gijcrbitems/_source/Kitbash_Equipment_4F6GJqqpHSZYFNqA.json` | converted |
| Standard Weaponization | `ccitems/_source/Standard_Weaponization_zNN9bu7QMXzpUgHB.json` | converted |
| Limited Weaponization | `ccitems/_source/Limited_Weaponization_nzX5e7PPoHU3nLM3.json` | converted |
| Martial Weaponization | `ccitems/_source/Martial_Weaponization_IOum6G4uZdTDh4J9.json` | converted |
| Armed | `ccitems/_source/Armed_tH6Osix0iQGxowNz.json` | converted |
| Quick Draw | `ccitems/_source/Quick_Draw_YGr6vNEv9MKoVlyS.json` | converted |
| Branch Leader | `ccitems/_source/Branch_Leader_EwIMxCkVn5mj9ArG.json` | converted |
| Thick Skulls | `iafav2items/_source/Thick_Skulls_03a1UE6KBI1LIHOq.json` | converted |
| Construct | `tfcrbitems/_source/Construct_RoA7zBnU4Ke517k6.json` | converted |
| Manifest Melee Weapon | `tfcrbitems/_source/Manifest_Melee_Weapon_MSCVNucCT6yMtptv.json` | converted |
| Minor Tweak | `dditems/_source/Minor_Tweak_p07kuAT0RhfjudPo.json` | converted |
| Monstrous Attack | `dditems/_source/Monstrous_Attack_nDEA1W86XvYR2ab4.json` | converted |
| Never Unarmed | `dditems/_source/Never_Unarmed_zNRAyM9Y8y13eLhU.json` | converted |
| Riot Gear | `wtnvcgitems/_source/Riot_Gear_SivYuju5Qcwu3npg.json` | converted |
| Poison Chemistry | `ccitems/_source/Poison_Chemistry_MOOrbfVEyGTDExfv.json` | converted |
| Hacker | `ccitems/_source/Hacker_s56rG7h3is1WNpz2.json` | converted |
| Secondary Quarry (Secondary Mark) | `dditems/_source/Secondary_Quarry_GS8YX7V6rYJLnkfQ.json` | converted (the readers keep its id) |
| All Out Attack (GI JOE) | `gijcrbitems/_source/All_Out_Attack_Rhz1k6gTl2XTs8Nk.json` | converted |
| Evasive Fighting (GI JOE) | `gijcrbitems/_source/Evasive_Fighting_tBXpROuVSuAxGZpR.json` | converted |
| Artillery Lobber Effect | `gijcrbitems/_source/Artillery_Lobber_Effect_6SNB0WmDWMUkpr2X.json` | converted |
| Jammer | `gijcrbitems/_source/Jammer_gFTHcdhnTZojAqPM.json` | converted |
| White Noise Generator | `gijcrbitems/_source/White_Noise_Generator_F80nn3atqFJWhRWQ.json` | converted |
| Genetic Decoding | `ccitems/_source/Genetic_Decoding_3I9h6aspI3Cg0Fd0.json` | converted |
| Energic Shields | `prcrbitems/_source/Energic_Shields_Lxmp3gfs8TmtUOI5.json` | converted |
| Enhanced Impact Points | `jttitems/_source/Enhanced_Impact_Points_FLV4BgCGfPPDxoAY.json` | converted |
| Gremlins' Mischief | `jttitems/_source/Gremlins__Mischief_tOaR4ftVJadvAgbC.json` | converted |
| Energy Resistor | `tfcrbitems/_source/Energy_Resistor_lKnjgN4TdHHNktpF.json` | converted |
| Vine Bombs Effect | `tsitems/_source/Vine_Bombs_Effect_WGWGdiX8drI5SFi6.json` | converted |
| Ablative Matrix (Heavy / Light / Medium) | `eocitems/_source/Ablative_Matrix__*__*.json` (3) | converted |
| Gyro-Gun Alternate Effect | `eocitems/_source/Gyro_Gun_Alternate_Effect_pkAJxZG4ujXfdBem.json` | **not converted** |
| Headache | `wtnvcgitems/_source/Headache_Y9vCqznF8qHKHyO9.json` | converted |
| Intervene | `fgtaaitems/_source/Intervene_b1Ev6biHOHxXXQo4.json` | converted |
| Shots Fired | `fgtaaitems/_source/Shots_Fired_lcUcWMZxVUdLkycD.json` | converted |
| Tough Together | `gijcrbitems/_source/Tough_Together_aGD2qvPmkdeL6ObV.json` | converted |
| Favorite Command (GI JOE, MLP) | `gijcrbitems/.../Favorite_Command_ymF7fHkBglQ7pQRE.json`, `mlpcrbitems/.../Favorite_Command_rPnaWCU06W8c0Zua.json` | converted (the readers keep their ids) |
| Backup Master / Extra Friend | `gijcrbitems/.../Backup_Master_VV2qGG2gqmjKYcPl.json`, `mlpcrbitems/.../Extra_Friend_Hg3B2BkTNnqTzRmr.json` | converted (canCommand keeps the ids) |
| Artificial Intelligence | `gijcrbitems/_source/Artificial_Intelligence_OBjcj6ordJi60Cdd.json` | converted |
| Loyal Minions | `dditems/_source/Loyal_Minions_MIghwIOKR1AqeQiY.json` | converted |
| Crash Survivor | `ccitems/_source/Crash_Survivor_5SKezm0w5KQbdSJ4.json` | converted |
| Hearty | `ccitems/_source/Hearty_3Jh0J7IxLr6eF1uA.json` | converted |
| False Face | `qgtgitems/_source/False_Face_OGIfZabiFlcjwCaz.json` | converted |
| Personnel Munitions Pack | `eocitems/_source/Personnel_Munitions_Pack_CXenUI5l8c3WZNSw.json` | converted |

## Converted

Once-only grants keep the old `flags.essence20.granted` flag (`when: not:rule:data:flags.essence20.granted`, an
`updateItem` sets it), so characters that already used them keep a spent button. Window-limited Uses keep the old Scene
Clock counters (`self:windowUsed:<flag>:<window>` + `markWindow`), so a count already made carries on. Picks that
replaced `flags.essence20.riderChoice` carry `legacy` for the GM's linking pass.

- **Custom Gear** - three `pickGrant`s (light / medium armor; a Limited armor upgrade; a Limited weapon upgrade), each in a
  `forEach {to: self}` so a skipped pick carries on to the next, as the old code did; `granted` set when anything was
  granted (`rule:granted`).
- **Kitbasher** - `KitPrerequisite {mode: waive, all: true}` (new): every kit, a Skill Kit too, as the early return did.
- **Integrated Offense** - Use while `floor(@level / 2) - grantedCount > 0`; Microtech Weapon or Battledress granted;
  `grantedCount` +1 (the old flag).
- **Kitbash Equipment** - Weapon (no attack over two hands) or gear picked (`pickEntry`, before the cost; kits' DIF from
  their name), then a Standard action, Technology vs the Availability DIF: granted `until: rounds:10`, `rounds:20` on a
  Critical Success.
- **Standard / Limited / Martial Weaponization** - `pickGrant {integrated: true}` with the old filters as tags (melee or
  Reach attack; Martial: a ranged attack, Medium or Sidearm, no attack with 0 or more than 1 hands - a missing hand count
  is one hand, as before); once.
- **Armed** - grants Weapon Training (unless already owned), `pickMany` up to 3 non-Adept weapons and flags them
  `adeptArmament` (the readers' flag); once. **Quick Draw** - `ActionCost {action: drawWeapon, to: free, ask:
  E20.ActionPerkAskAdeptDraw}` (the COST_RULES entry it replaces) + the one-weapon Adept pick; once.
- **Branch Leader** - a `choose` over the eight G.I. JOE Role items (Commando, Infantry, Officer, Old Hand, Ranger, Renegade,
  Technician, Vanguard), the one held left out; writes `flags.essence20.exemplarBranch` (read by `pickPerk from: branch`);
  once.
- **Thick Skulls** - `askNumber` 0..Smarts max into the old `toToughness` flag; two Defense rules move it from Willpower to
  Toughness, the same " + N (Thick Skulls)" / " - N (Thick Skulls)" breakdown.
- **Construct** - Weapon / Armor Upgrade / Kit picked and the Energon gate checked before the Standard action; on a success
  1 Energon spent (none with Perpetual Power Source) and the item granted; a failure spends nothing.
- **Manifest Melee Weapon** - while a combat exists and the `manifestMeleeWeapon` encounter count is unused; Standard,
  +Limited with Expanded Arsenal, +Restricted with Instruments of Destruction (a `choose {auto: true}` with option `when`s);
  Free action; granted Integrated, `until: combat`, named "<weapon> (Energon)".
- **Minor Tweak** - tiers DIF 14 / 18 (Major Augments) / 20 (Extensive Enhancements) as `choose {auto}` options; on a success
  the ranks are picked (Strength / Speed Skills for one rank, any Skill otherwise), the target's (or own) old `minorTweak`
  effects removed and one effect added with a `shiftUp` change per rank (a Skill picked twice gets +2).
- **Monstrous Attack** - Blunt or Sharp: the same weaponEffect data (Might, melee, 2 damage, Reach ×2); once.
- **Never Unarmed** - Might / Finesse and Blunt / Sharp asked before the Move action; a Silent Sidearm "Makeshift Weapon"
  (equipped, `endsOnFumble`) with its one attack, `until: scene`.
- **Riot Gear** - while a combat exists and the `riotGear` mission count is unused; the weapon chosen before the Standard
  action; granted `until: combat` (Blow Gun / Throwing Stars with 5).
- **Poison Chemistry** - poison and state picked before the Standard action; the three `poisonApplication` flags set
  exclusively. **Hacker** - a poison picked; `hackerPoison` flipped (a `choose {auto}` on its current value).
- **Secondary Mark** - the (first) target's uuid written to `flags.essence20.secondaryQuarryUuid`; the readers
  (`checkPrimaryQuarry`, `isVsPrimaryQuarry`) are unchanged.
- **All Out Attack / Evasive Fighting (GI JOE)** - the TF items' `StanceSwitch` rule without the "not the GI JOE copy"
  guard (the TF copies keep theirs, so one box shows); the GI JOE dialog fields are gone.
- **Artillery Lobber Effect** - `hit` Trigger on the effect itself: the target Prone. **Vine Bombs Effect** - the same: the
  target Grappled and the same escape card (Might / Athletics vs 16, removes Grappled on success).
- **Jammer / White Noise Generator** - `Toggle {key: on, legacy: flags.essence20.deviceOn}` switched by a Use; an aura
  RollModifier (30 ft, everyone) and a self copy (the holder, on the canvas) - a Snag on Technology / Alertness while on.
- **Genetic Decoding** - an Essence pick (legacy `riderChoice`); four `CriticalOption {essence, damageValue: 1}` rules, each
  offered while nothing is picked or its Essence is.
- **Energic Shields** - damage type pick (legacy `riderChoice`, the old 11 types); `Defense {toughness, mode: addAfter, 3}`
  on attacks of that type while Morphed (added after best / halve, where the hand-written +3 sat).
- **Enhanced Impact Points** - `RollModifier {upshift: @rolled.system.shiftDown}` on an unarmed Blunt / Sharp attack with a ↓,
  while Morphed.
- **Gremlins' Mischief** - Use: a mechanical / robotic / computerized target (`target:tag:` over the same creature tags),
  1 Personal Power, `setToggle gremlins until turnOrUntilCombat`; `DamageType {to: emp}` on unarmed attacks while on.
- **Energy Resistor** - energy type pick (legacy `riderChoice`); `DerivedStat system.immunities.{choice.type} = true` (worn
  armor's upgrade or a loose one, as before - an upgrade on unequipped armor is inactive).
- **Ablative Matrix ×3** - `targeted` Trigger, outcome `crit`, on attacks: `ablativeLoss` +1 while below the source armor
  bonus. `target-riders.mjs#ablativeLossOf` now reads the flag on any upgrade (only these set it).
- **Headache** - `HitRider` option "Headache": Psychic damage = the actor's Essence damage, on unarmed hits, when above 0.
- **Intervene** - a `watch: ally` `afterRoll` Trigger on Stun / Maneuver attacks with targets marks the ally (`until:
  combat`); a `markedTarget` RollModifier gives the next Blunt / Sharp attack against them a Snag and uses the mark up.
- **Shots Fired** - `dealtDamage` Trigger marks the damaged creature (`perSetter`, `until: endOfNextTurn`); Edge on
  Deception / Intimidation / Persuasion against a creature carrying your mark (`markedByMe:shotsFired`).
- **Tough Together** - `DerivedStat {scope: companion, system.health.max +1}`.
- **Favorite Command (GI JOE, MLP)** - Skill pick written to the old `flags.essence20.favoriteSkill` (read by
  `favoriteSkill()` / `commandIsMove`). **Backup Master / Extra Friend** - a Player Character picked into the old
  `flags.essence20.designee` (read by `canCommand`).
- **Artificial Intelligence** - `turnStart` Trigger on a companion holding a Command that wasn't given this round: a chat
  line.
- **Loyal Minions** - Intimidation or Persuasion asked, a Free action, DIF 10; on a success `setToggle orders until
  endOfRound`; a companion-scope RollModifier ↑1 for the holder's Mini-Cons while it's on.
- **Crash Survivor / Hearty** - the old kits deleted, a fresh "Limited Driving (Air / Sea) Kit" made with the same
  `flags.essence20.kit` and `ignorePrerequisite`.
- **False Face** - old kits deleted; ceil(level / 2) points spent in a `repeat`: Standard (1), Limited (2, 3rd+), Restricted
  (4, 6th+); a lone choice is taken unasked, a cancel keeps what was made.
- **Personnel Munitions Pack** - a weapon needing a reload picked (the target's, else your own) before the Free action; its
  `needsReload` counted down by one (true → 0, a Reload ×2's 2 → 1); a 1 on 1d20 uses the pack up.

## Not converted (1)

- **Gyro-Gun Alternate Effect** - its 1d2 rounds sit inside `conditionRiders`' generic "damage type Impaired" rider (1 round,
  and the card row's "Impaired for N rounds" note). A rule of its own would stack with that generic rider, and no step writes
  the row note; converting it needs the generic Impaired rider to become a rule (or to skip items whose rule applies the
  Condition). Still code: `RIDER.gyroGunAlternate` in target-riders.mjs.

## Code vs notes - needs a ruling

1. **Loyal Minions** - the code (and now the rule) lasts the combat round (`endOfRound`); the item text and notes say "until
   the beginning of your next turn". Converted to the round.
2. **Crash Survivor / Hearty** - the notes say a fresh kit "each mission"; the code has no per-mission limit (press it any
   time; the new kit replaces the old). Converted with no limit.
3. **Minor Tweak** - "the benefit lasts for 1 day": the code's effect lasts until the next tweak replaces it (notes: left to
   the table). Unchanged.
4. **Personnel Munitions Pack** - the notes say "reloads a targeted ally's weapon"; the code also reloads your own when
   nothing is targeted. Converted with the fallback.
5. **Branch Leader** - "Choose another Role": the code offers G.I. JOE Roles only. Kept (now the eight Role items by
   uuid, see below).

## Behaviour differences worth a decision

1. **Kitbash Equipment** out of combat: the old `{kind: rounds}` stamp never expired outside a combat; `rounds:10` / `20`
   last the scene out of combat.
2. **Branch Leader**: the Roles are a fixed list of the eight G.I. JOE Role items (the old code read every visible pack's
   index, so a hidden sourcebook's Role was left out and a new G.I. JOE Role would appear by itself); your own Role is left
   out by its book source, not by name. Options are buttons instead of a select.
3. **Armed**: Weapon Training is granted with `grantedBy` (deleting Armed now removes it); the old `grantPerkOutright`
   left it. It is still skipped when already owned.
4. **Minor Tweak**: cancelling a later rank's pick stops the run (the old code kept the ranks picked so far); the ranks go
   on one effect, as before.
5. **Jammer / White Noise Generator**: an unequipped device's rules are inactive (the old scan read every item, equipped or
   not); the Use button likewise needs it equipped. The aura measures from token to token like the old code.
6. **Energy Resistor / Ablative Matrix / Personnel Munitions Pack**: rules on an upgrade on unequipped armor (or an
   unequipped pack) are inactive - no Use button, and an Ablative Matrix on unequipped armor no longer wears down (it
   counted nothing then anyway).
7. **Artillery Lobber / Vine Bombs**: the Condition now lands through the `applyCondition` step (relayed to the GM for a
   target you don't own) even when Unstoppable Force shrugs the hit's riders (the old `conditionRiders` skipped them then).
8. **Gremlins' Mischief**: `DamageType` rules apply after the hand-written overrides, so with Void Warrior or Blazing Strikes
   also active the EMP now wins (it lost before). The Use button is hidden without a Personal Power (it used to warn).
9. **Intervene**: the watch Trigger needs both tokens on the canvas (the old code accepted an attacker with no token);
   two Intervene holders still give one Snag.
10. **Shots Fired**: fired by `dealtDamage` (any `applyDamage` with a source - the secondary damage too, not only the card's
    primary button); off-turn damage lasts through the end of your next turn by the engine's reading (the old stamp ran to
    round + 1 at your place in the order).
11. **Artificial Intelligence**: the chat line no longer names the repeated Command; "this round" is now read with the combat
    id (a Command from an older combat with the same round number no longer counts).
12. **Loyal Minions**: given out of combat, the orders now last until something ends them rather than until a combat starts.
13. **Backup Master / Extra Friend**: the pet's owner is offered in the list too.
14. **Genetic Decoding / Energic Shields / Energy Resistor**: until the GM's linking pass moves an old `riderChoice`, an old
    character's pick isn't seen (Genetic Decoding offers all four Essences, the other two do nothing); the pick dialogs no
    longer preselect the current choice.
15. **Never Unarmed**: the makeshift weapon's attack is entered in the weapon's `system.items` (createItem `children`), like a
    compendium weapon's.
16. Chat wording of every converted Use changes (the rule's own lines).

## Shared-file edits

- `module/rules/steps.mjs` - `grant` name via `fillText`; `itemsFor` `choice:` reads a list.
- `module/rules/plugins/picks/pick-and-loop-steps.mjs` - `pickEntry {kitTier}`.
- `module/rules/plugins/resources/kit-prerequisite.mjs` - `all` param, `ruleWaivesAllKitPrerequisites`.
- `module/mechanics/resources/kits.mjs` - Kitbasher check -> the rule (import added, `KITBASHER` gone); Crash Survivor,
  Hearty, False Face and Personnel Munitions Pack handlers and their `KIT` entries removed (`KIT.personnelMunitionsPack` stays
  for `NOT_KITS`); `FREE_DRIVING_KIT` keeps Take the Wheel.
- `module/mechanics/resources/grants.mjs` - 16 handlers removed (Custom Gear, Integrated Offense, Kitbash Equipment, Branch
  Leader, the three Weaponizations, Armed, Quick Draw, Thick Skulls, Construct, Manifest Melee Weapon, Minor Tweak, Monstrous
  Attack, Never Unarmed, Riot Gear), `integratedWeapon`, `isRangedEntry`, `oneHanded`, `thickSkullsShift`, the `actorHasPerk`
  import.
- `module/mechanics/resources/grant-uses.mjs` - those GRANT entries (and weaponTraining, perpetualPowerSource, majorAugments,
  extensiveEnhancements, kitbasher), their ONCE / USE_KINDS names and canUseGrant cases.
- `module/mechanics/actions/action-perks.mjs` - the `adeptQuickDraw` COST_RULES entry.
- `module/mechanics/combat/target-riders.mjs` - Jammer / White Noise scan (`activeDevicesNear`, `DEVICE_*`), Enhanced Impact
  Points, Intervene (both halves), Shots Fired (source and `onDamageDealt`), Energic Shields, the GI JOE stance dialog
  flags and `applyDialogRiders`' stance half (`setStance`), Headache, Ablative Matrix (`ABLATIVE`, `degradeAblative`;
  `ablativeLossOf` reads the flag), Artillery Lobber, Vine Bombs, Genetic Decoding, and the Use cases (Poison Chemistry,
  Hacker, devices, Energic Shields, Energy Resistor, Genetic Decoding, Secondary Mark, Gremlins' Mischief,
  `isGremlinsMischiefActive`); unused imports.
- `module/mechanics/combat/rider-uses.mjs` - those RIDER entries and riderUseFor kinds (allOutAttack, evasiveFighting and
  secondaryQuarry stay: labels / readers).
- `module/items/gear/poison-coating.mjs` - `changePoisonState`, `toggleHackerPoison`.
- `module/mechanics/companions/companions.mjs` - Backup Master / Extra Friend (`designateCommander`), Favorite Command GI JOE /
  MLP handlers (the WTNV one stays), Artificial Intelligence in `onCompanionTurnStart` (its `combat` arg is now `_combat`),
  Tough Together in `linkedBonuses`, Loyal Minions (handler and roll source).
- `module/mechanics/companions/companion-uses.mjs` - toughTogether / artificialIntelligence / loyalMinions entries and the
  USE_KINDS names.
- `module/documents/actor.mjs` - the Energy Resistor immunity loop and the Thick Skulls Defense lines; imports.
- `module/dice.mjs` - the Gremlins' Mischief damage-type branch and import.
- `module/chat.mjs` - the `onDamageDealt` call and import.
- `module/apps/roll-options-dialog.mjs`, `module/mechanics/rolls/roll-dialog.mjs`, `templates/dialog/roll-dialog.hbs` - the GI
  JOE All Out Attack / Evasive Fighting number boxes.
- Tests: `grants.test.js`, `kits.test.js`, `target-riders.test.js`, `companions.test.js` - the converted items' tests moved to
  `module/rules/conv14-uses.test.js` (shared tests reworded to items that stay code: Ghillie Suit Sniping, Primary Tech, Take
  the Wheel, Muzzle Punch, Wrecking Ball).

## Unused strings

`E20.GrantMicrotechPrompt`, `E20.GrantMicrotechWeapon`, `E20.GrantMicrotechBattledress`, `E20.GrantPickBranch`,
`E20.GrantBranchSet`, `E20.ThickSkullsPrompt`, `E20.ThickSkullsSet`, `E20.ConstructPrompt`, `E20.ConstructNoEnergon`,
`E20.GrantArmorUpgrade`, `E20.GrantKit`, `E20.MinorTweakPrompt`, `E20.MinorTweakTier`, `E20.MinorTweakPickSkill`,
`E20.MinorTweakDone`, `E20.MonstrousAttackPrompt`, `E20.NeverUnarmedSkill`, `E20.NeverUnarmedWeapon`, `E20.RiotGearPrompt`,
`E20.PoisonChemistryTitle`, `E20.PoisonChemistryPickState`, `E20.PoisonChemistryDone`, `E20.HackerPoisonTitle`,
`E20.HackerPoisonMarked`, `E20.HackerPoisonOn`, `E20.HackerPoisonOff`, `E20.VineBombsEscape`, `E20.DeviceOn`,
`E20.DeviceOff`, `E20.SecondaryQuarryDone`, `E20.GremlinsNeedsMachine`, `E20.GremlinsOn`, `E20.RollDialogAllOutAttack`,
`E20.RollDialogEvasiveFighting`, `E20.DroneSelfCommand`, `E20.LoyalMinions`, `E20.LoyalMinionsGiven`,
`E20.LoyalMinionsPrompt`, `E20.FalseFacePrompt`, `E20.MunitionsPackPick`, `E20.MunitionsPackEmptied`,
`E20.MunitionsPackReloaded`. No new strings (`E20.RulesExtUses` is empty; rule labels and chat lines are short English).

## Rule count

67 rules on 48 items.

## Checks

- eslint (`--ext .js,.mjs --rule 'linebreak-style: off'`) on every touched file: clean.
- `node scripts/check-rules.mjs`: 0 errors, 0 warnings.
- jest: `conv14-uses.test.js` (45), `grants.test.js`, `kits.test.js`, `target-riders.test.js`, `companions.test.js`,
  `items/gear`, `chat.test.js`: passing. Full suite at the time: 6 failing suites, all in other agents' in-progress work -
  `mechanics/resources/banked-buffs.test.js` and `dice.test.js` (a missing `items/healing/mind-over-matter.mjs` / banked-buff
  changes), `documents/actor.test.js` (The Tough Get Going movement), `items/attacks/weapon-perk-uses.test.js` (Grid shell),
  `rules/conv10-slB10.test.js` (Monster Morph / Fearsome Presence `rollVsMany` arguments) and
  `rules/conversions-uses.test.js` (It's Morphin Time `setForm`).
