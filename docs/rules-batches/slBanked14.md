# Batch slBanked14: round 14, part banked - the Perk Use buttons in banked-buffs.mjs

**Scope:** the 104 items the survey (`survey/result-banked.json`) marked "convert": mostly the Perk Use buttons in
`module/mechanics/resources/banked-buffs.mjs`, plus the halves of them that lived in `dice.mjs` (pre-roll reads, dialog switches,
post-roll riders), per-item files under `module/items/`, `documents/actor.mjs` (Movement), `mechanics/combat/combat.mjs`,
`multiple-targets.mjs`, `named-actions.mjs`, `requisition.mjs` and the roll dialog. Castling was converted together with its
chat decorator (`castling-move-note.mjs` and the `castling` key in `items/shared/gij-crb-item-lookups.mjs` are gone; the move
note is now a plain `chat` step). Plan of Action stays as it was (not in this part's list). Edited in place in the shared
checkout (no branch, no commit, packs not compiled).

**Result:** **91 converted**, **13 not converted** (below). **152 rules added on 91 items.** `scripts/check-rules.mjs`:
0 errors, 0 warnings (whole system). 63 per-item modules deleted, each with its test where it had one (118 files; includes castling-move-note,
beast-mode / beast-mode-tiers and nemesis-drain-expiry). Tests: `module/rules/conv14-banked.test.js`
(13 tests: every rule validates, plus the Uses and the four fixes); old tests removed from `banked-buffs.test.js`,
`dice.test.js` and the trimmed item tests. Full jest suite: 9135 passed, 1 failed - not in this part's code (see the end).

## Engine features added 2026-10-06 (round 14, banked)

- **`rollVsEach` / `roll` `essence`** (`rules/steps.mjs`): roll the Skill with that Essence instead of its own (the old Uses
  rolled Intimidation as Social). `mechanics/combat/reaction-engine.mjs#rollVsMany` takes an optional 5th `essenceOverride`;
  the argument is only passed when the step sets it, so existing callers and their tests are unchanged.
- **`writeInitiative` `exact: true`**: writes the formula's value as-is (no rounding), evaluated per recipient.
- **`setForm` `silent: true`**: updates with `{essence20: {silentState: true}}` (no morph chat line / badge), the way It's Time
  did. The options object is only passed when `silent` is set.
- **Recipient `nearbyEnemies:<ft>`** (`rules/plugins/combat/nearby-enemies-recipient.mjs`, imported last by
  `rules/plugins/index.mjs`): every token in range whose disposition differs from the actor's, NEUTRAL ones included - the
  `getNearbyEnemyTokens` set the old area Perks used. `enemies:<ft>` leaves neutral tokens out. Each actor once; the range may
  be a formula.
- **`pick` from `skills` with `notShift: [...]`** (`rules/plugins/tags/actor-state-tags.mjs`): leaves out Skills at those
  shifts (Fast Learner's decrease can't pick a d2 Skill).

## Verdicts

| Item | Pack file | Verdict |
|---|---|---|
| Combat Stance | `ttsgitems/_source/Combat_Stance_R2C760BXAI1XKVtm.json` | converted |
| Like Water | `iafav2items/_source/Like_Water_HSjShnVmoDdzEDT1.json` | converted |
| Meat Shield | `sssitems/_source/Meat_Shield_hYwFDsC7azfYB5fO.json` | converted |
| Inner Magic | `mlpcrbitems/_source/Inner_Magic_E6GWRHzP9tOAxQP6.json` | converted |
| Through the Arches | `atsitems/_source/Through_the_Arches_f372LpDqqiO2XoEi.json` | converted |
| Trigger Reaction | `ghpfitems/_source/Trigger_Reaction_PItQuRGhxq4lMT3P.json` | converted |
| Phantom Suite | `atsitems/_source/Phantom_Suite_fQgxo5c7tNOD2Q5K.json` | converted |
| Castling | `gijcrbitems/_source/Castling_eB7jbgbevLVPxW4e.json` | converted (with its chat decorator) |
| Stand Behind Me! | `atsitems/_source/Stand_Behind_Me__PcezfGdjUtNUZHYH.json` | not converted |
| Beast Mode | `ccitems/_source/Beast_Mode_o4lqILvsxyU3LhBS.json` | converted |
| Box Shot | `qgtgitems/_source/Box_Shot_N8E3QTLUKX6DOoEc.json` | converted |
| Protected Target | `gijcrbitems/_source/Protected_Target_llnU5dWqYlfgLA5V.json` | converted |
| Mark Target | `tfcrbitems/_source/Mark_Target_T2mm6VmvcUxagsjc.json` | not converted |
| Primary Quarry | `dditems/_source/Primary_Quarry_myYcCOZdN1ViBeQH.json` | converted |
| Known Accomplices | `dditems/_source/Known_Accomplices_LxpkFOriqLvRT7sn.json` | converted |
| Mark Everybot | `tfcrbitems/_source/Mark_Everybot_KxmnKUYmQ56D02Jg.json` | converted |
| Extra Rough Training | `sssitems/_source/Extra_Rough_Training_pqrUN5jaAbWJmgLf.json` | converted - bug fixed (once per mission) |
| Hup! Hup! Hup! Hup! Hup! | `sssitems/_source/Hup__Hup__Hup__Hup__Hup__xsIHUoZaFoadsmma.json` | not converted |
| Timely Teammate | `fffav1items/_source/Timely_Teammate_yrhhCOXpS8Mx1R0C.json` | converted |
| Roar! | `fffav1items/_source/Roar__AaI58jYka8MfhIbc.json` | converted |
| Nemesis Drain | `fmmcitems/_source/Nemesis_Drain_WQYSawSpefEKLaG0.json` | converted - bug fixed (scene expiry) |
| Right Behind You | `fmmcitems/_source/Right_Behind_You_7jwgzzygZymRkndW.json` | converted |
| Better You Than Me | `fmmcitems/_source/Better_You_Than_Me_u0vF75YLcwdyY8pv.json` | converted |
| Power Bleed | `fmmcitems/_source/Power_Bleed_2nI6ckZdiIKwtRqr.json` | converted |
| Toxic Terror | `fmmcitems/_source/Toxic_Terror_kh7Wk5zalucm9I7p.json` | converted |
| Rousing Comeback | `gijcrbitems/_source/Rousing_Comeback_I8yAnOEoaut76wlf.json` | converted |
| Knight's Jump | `gijcrbitems/_source/Knight_s_Jump_CG0aeZtKsPVmvUF5.json` | converted |
| Dirty Trick (Environmental) | `gijcrbitems/_source/Dirty_Trick__Environmental__e5nMmMPpV3WU9P92.json` | converted |
| Honorific Token | `jttitems/_source/Honorific_Token_z9NkwgoIx2JRrPBA.json` | converted |
| Party Power | `mlpcrbitems/_source/Party_Power_GKez5xeu5ZllzGOI.json` | converted |
| Concentrate Fire | `gijcrbitems/_source/Concentrate_Fire_LccKe9ZdDPvS5YbD.json` | converted |
| Stay In Formation | `qgtgitems/_source/Stay_In_Formation_pU3dKGNWYAhgRY6B.json` | converted |
| Humanitarian | `prcrbitems/_source/Humanitarian_hxWJxlMLbkBbx73w.json` | converted |
| "I Know A Guy" | `prcrbitems/_source/_I_Know_A_Guy__anfEVX8bI2eQh40E.json` | converted |
| Phantom | `gijcrbitems/_source/Phantom_Z92UggPHdmt47A7Q.json` | converted |
| Suggestion | `gijcrbitems/_source/Suggestion_q2YLQLdssomYU4Za.json` | converted |
| Talk Them Down | `gijcrbitems/_source/Talk_Them_Down_Y8PlCnqD5txZKJWh.json` | converted |
| Tech Specs | `qgtgitems/_source/Tech_Specs_Ii4gXQePcG8xg0hB.json` | not converted |
| Deadstick | `qgtgitems/_source/Deadstick_SDwpvAzQX0pYSHyc.json` | converted |
| Ground Suppression | `qgtgitems/_source/Ground_Suppression_nCjrhYaUuN4omhDm.json` | not converted |
| Superb Soloist | `kocitems/_source/Superb_Soloist_S3t5zNlhPp7evXbh.json` | converted |
| Harass | `ccitems/_source/Harass_91TqKfAnyL1VijZH.json` | converted |
| Antagonistic | `ccitems/_source/Antagonistic_04lrt1b9aCN4ts2N.json` | converted |
| Flying Nuisance | `ccitems/_source/Flying_Nuisance_6PsZqPUijt60ISlq.json` | converted |
| Versatile Protection | `ccitems/_source/Versatile_Protection_FZQlUV1KkyQxUi7s.json` | converted |
| Animal Gait | `ccitems/_source/Animal_Gait_gWjcSPeqNe1h8rwZ.json` | converted |
| Two Heads Are Better Than One | `tsitems/_source/Two_Heads_Are_Better_Than_One_2SGJ4ezuiZgb7JqX.json` | converted |
| Invisibility | `tsitems/_source/Invisibility_Ec3PMcI8WsCu2ivp.json` | converted |
| I Still Function | `dditems/_source/I_Still_Function_o4HgDxoKWVtieWZJ.json` | converted |
| Self-Revive | `gijcrbitems/_source/Self_Revive_ulES8RippJVrGbhj.json` | converted |
| Outwit | `gijcrbitems/_source/Outwit_DVBrtxa9iiXXhDoS.json` | not converted |
| Shoulder To Shoulder | `gijcrbitems/_source/Shoulder_To_Shoulder_vZNQBGwiv1hREbyr.json` | converted |
| Natural Movement | `gijcrbitems/_source/Natural_Movement_TLI74oM0tbDtQ298.json` | converted |
| Pointy | `dsoeitems/_source/Pointy_kwkUWzNVdSKDx0jt.json` | converted |
| Dig Deep | `wtnvcgitems/_source/Dig_Deep_A2Xay6rHrBK9l8eo.json` | not converted |
| Dig Deep | `tfcrbitems/_source/Dig_Deep_uPxkVrCLuBdx9kty.json` | not converted |
| Dig Deep | `gijcrbitems/_source/Dig_Deep_QJkcVXT7K4yNWFoT.json` | not converted |
| Dig Deep | `mlpcrbitems/_source/Dig_Deep_geBN3DkixaCXvnSO.json` | not converted |
| After You | `mlpcrbitems/_source/After_You_CjNQHWxMjTQfcLTZ.json` | converted |
| Quick Study | `wtnvcgitems/_source/Quick_Study_adJm4dpjD04TICkd.json` | converted |
| Grid Surge | `atsitems/_source/Grid_Surge_PEDHPJkoGvvJed5u.json` | not converted |
| Power Adaptation | `atsitems/_source/Power_Adaptation_S7Qs6bJOVkVFxlFu.json` | converted |
| Spot Weld | `dditems/_source/Spot_Weld_4GYOdopDcXS8lgGI.json` | converted |
| Martial Leadership | `eocitems/_source/Martial_Leadership_6dRdxCRjWqjrt8Wc.json` | converted |
| Voice of Primus | `eocitems/_source/Voice_of_Primus_m8oHzT4BUB79NiVw.json` | converted |
| Words Can Hurt! | `eocitems/_source/Words_Can_Hurt__SBoujesTRdI7IpmM.json` | converted - bug fixed (scene immunity) |
| Calming Words | `eocitems/_source/Calming_Words_r3slLsGwSfXUiD94.json` | converted |
| Archkey | `jttitems/_source/Archkey_EEZUFQIGfeLhT2qX.json` | converted |
| Engine Cells | `jttitems/_source/Engine_Cells_Q8TO2TJNncmy6Q6R.json` | converted |
| Energon Cube | `dditems/_source/Energon_Cube_5p3lMU4vT7kUodp5.json` | converted |
| Energon Snack | `dditems/_source/Energon_Snack_y72ZEiWUa3AYxcXl.json` | converted |
| Impossible Expectations | `ccitems/_source/Impossible_Expectations_98rFJyzaoCWrLdbF.json` | converted |
| Absolute Menace | `bthitems/_source/Absolute_Menace_YsoS30FKigTm19CH.json` | converted |
| Frightening Display | `eocitems/_source/Frightening_Display_8NJtMXvcK3YDnwY4.json` | converted |
| Fight Me! | `bthitems/_source/Fight_Me__7ovAtv0r6UaAsmHE.json` | converted |
| A Logical Explanation | `wtnvcgitems/_source/A_Logical_Explanation_CiDQxCxgnnosvBDo.json` | converted |
| Duty Of The Graphite | `bthitems/_source/Duty_Of_The_Graphite_Rr7ucZahtHI9yXwA.json` | converted |
| Uninterrupted Break | `qgtgitems/_source/Uninterrupted_Break_1vrQxY1nzjMjeU7D.json` | converted |
| Elemental Storm | `bthitems/_source/Elemental_Storm_6IoMpj8pWmP8IpH4.json` | converted |
| Comic Flair | `jttitems/_source/Comic_Flair_Ux2eueBLxKgzD2Kd.json` | converted |
| Powered Plating | `jttitems/_source/Powered_Plating_45WHjwO125zTvuGR.json` | converted |
| Paradox | `jttitems/_source/Paradox_TYebczV8RvTTbWnL.json` | converted |
| At All Cost | `ttsgitems/_source/At_All_Cost_TGnqQAWWi1hBGqeh.json` | converted |
| Quick Study | `gijcrbitems/_source/Quick_Study_IoOFcSJK3sHLAbgR.json` | converted |
| Fast Learner | `gijcrbitems/_source/Fast_Learner_u3KK0V30GXDdRPAY.json` | converted |
| Mysterious Aura | `prcrbitems/_source/Mysterious_Aura_hSu10Kgj9g1LSmyv.json` | not converted |
| Electromagnetic Disruption | `tsitems/_source/Electromagnetic_Disruption_EmJaaHzoEYtWhchj.json` | converted |
| At All Costs | `prcrbitems/_source/At_All_Costs_UFwnD2CsWCWXlUyf.json` | converted |
| It's Time | `fgtaaitems/_source/It_s_Time_HT4iCNp5WIWXR5bJ.json` | converted |
| Soothe | `ghpfitems/_source/Soothe_vzTeGdjO3v2oeR19.json` | converted |
| Manipulate | `fgtaaitems/_source/Manipulate_5IfrvMnLOMqfNWko.json` | converted |
| Talk Them Down | `fgtaaitems/_source/Talk_Them_Down_Ht8KDCTIQXLo1YI3.json` | converted |
| Whirlwind Strike | `prcrbitems/_source/Whirlwind_Strike_SV8nqua9koRB3lvm.json` | converted |
| Whatever We Need | `prcrbitems/_source/Whatever_We_Need_1DphEJt2hPswKDzI.json` | converted - bug fixed (Edge consumed) |
| Force Field | `tfcrbitems/_source/Force_Field_j3qkiawQATkksdaC.json` | converted |
| Stalwart Defense | `tfcrbitems/_source/Stalwart_Defense_uhp3JOTYZJfHrz7q.json` | not converted |
| Squad Guardian | `ghpfitems/_source/Squad_Guardian_Li2y6KqFu2OGRkrX.json` | converted |
| Volley | `prcrbitems/_source/Volley_Xi2sHKmBi21c3wbu.json` | converted |
| Group Strike | `prcrbitems/_source/Group_Strike_coGMtK50t3Ojeklx.json` | converted |
| More Heads are Better than One | `wtnvcgitems/_source/More_Heads_are_Better_than_One_jsaByB9ui8k1VUfG.json` | converted |
| Horse Around | `mlpcrbitems/_source/Horse_Around_6uhfHYeuUkFuGEEN.json` | converted |
| Crack-Up The 4th Wall | `mlpcrbitems/_source/Crack_Up_The_4th_Wall_km6HV50h6XWKTIm1.json` | converted |
| Inspiration | `prcrbitems/_source/Inspiration_FJSNzVRulj20M0B1.json` | converted |
| Benefits of Command | `gijcrbitems/_source/Benefits_of_Command_jSmMtJ0YFCEJcXYU.json` | converted |

### Not converted (13)

- **Stand Behind Me!** - the taunt (`stand-behind-me-taunt.mjs`) keeps a combat id + round on the flag and cancels rolls
  against others; there is no formula ref for the combat id, so an exact rule form needs a new step. Left as code.
- **Mark Target** - Additional Marks keeps the newest 5 marks; `mark` has no "keep the newest N". Left as code (its reader stays).
- **Hup! Hup! Hup! Hup! Hup!** - the Movement bonus is a count read from a mark another actor set, lasting through the next
  combat round; no Movement source reads that.
- **Tech Specs** - the old roll is compared against the highest Defense through the full dice pipeline (target-side banked
  Defense bonuses count); a rule roll compares raw totals. Technical Mastery also reads its `techSpecsMarked` flag by name.
- **Ground Suppression** - Danger Close excludes the first N allies (Smarts-based) from the area; no "first N" recipient filter.
- **Outwit** - Deceptive Warfare and Inundation read `dataset.isOutwit` on the roll; moving the Use would break them.
- **Dig Deep x4** (PR/TF/GIJ/MLP) - the consume-once damage reduction is shared with Dig Deep (PR CRB) code in the damage path;
  all four have to move together with a damage-reduction-bank rule type.
- **Grid Surge** - Toughness Boost stacks up to +3 on one pending bank; `bank` replaces or adds a new bank, it can't stack one.
- **Mysterious Aura** - a roll modifier for creatures inside an aura, plus ending on de-Morph; no aura-scoped RollModifier.
- **Stalwart Defense** - Stand Firm reads and doubles its bank in code.

## Converted

- **Combat Stance** (`R2C760BXAI1XKVtm`) - Use, RollModifier, DialogSwitch (Uses: Choose your Combat Stance foe)
- **Like Water** (`HSjShnVmoDdzEDT1`) - Use, Defense x2 (Uses: +2 Toughness or +2 Evasion this Combat)
- **Meat Shield** (`hYwFDsC7azfYB5fO`) - Use x2, Defense x4 (Uses: Switch Meat Shield on / Switch Meat Shield off)
- **Inner Magic** (`E6GWRHzP9tOAxQP6`) - Use, Defense (Uses: ↑1 on your next Spellcasting test)
- **Through the Arches** (`f372LpDqqiO2XoEi`) - Use (Uses: Through the Arches)
- **Trigger Reaction** (`PItQuRGhxq4lMT3P`) - Use (Uses: Science or Survival (DIF 5))
- **Phantom Suite** (`fQgxo5c7tNOD2Q5K`) - Use x2 (Uses: Switch Phantom Suite on / Switch Phantom Suite off)
- **Castling** (`eB7jbgbevLVPxW4e`) - Use (Uses: Castling)
- **Beast Mode** (`o4lqILvsxyU3LhBS`) - Use x2 (Uses: Enter Beast Mode / End Beast Mode)
- **Box Shot** (`N8E3QTLUKX6DOoEc`) - Use x2, MultipleTargets (Uses: Switch Box Shot on / Switch Box Shot off)
- **Protected Target** (`llnU5dWqYlfgLA5V`) - Use (Uses: Name your Protected Target)
- **Primary Quarry** (`myYcCOZdN1ViBeQH`) - Use (Uses: Choose your Primary Quarry)
- **Known Accomplices** (`LxpkFOriqLvRT7sn`) - Use, RollModifier (Uses: Mark a Known Accomplice)
- **Mark Everybot** (`KxmnKUYmQ56D02Jg`) - Use (Uses: Mark every creature this scene)
- **Extra Rough Training** (`pqrUN5jaAbWJmgLf`) - Use (Uses: Train a teammate)
- **Timely Teammate** (`yrhhCOXpS8Mx1R0C`) - Use (Uses: Trade Initiative with an ally)
- **Roar!** (`AaI58jYka8MfhIbc`) - Use, Defense x4 (Uses: +1 to a Defense for this combat)
- **Nemesis Drain** (`WQYSawSpefEKLaG0`) - Use, Defense x2 (Uses: Nemesis Drain)
- **Right Behind You** (`7jwgzzygZymRkndW`) - Use (Uses: Move your Initiative to just after an ally)
- **Better You Than Me** (`u0vF75YLcwdyY8pv`) - Use (Uses: Better You Than Me)
- **Power Bleed** (`2nI6ckZdiIKwtRqr`) - Use, Trigger (Uses: Power Bleed this turn)
- **Toxic Terror** (`kh7Wk5zalucm9I7p`) - Use x2, Trigger (Uses: Switch Toxic Terror on / Switch Toxic Terror off)
- **Rousing Comeback** (`I8yAnOEoaut76wlf`) - Use (Uses: Rousing Comeback (DIF 20 Brawn))
- **Knight's Jump** (`CG0aeZtKsPVmvUF5`) - Use (Uses: Swap two targets' Initiative)
- **Dirty Trick (Environmental)** (`e5nMmMPpV3WU9P92`) - Use (Uses: Dirty Trick)
- **Honorific Token** (`z9NkwgoIx2JRrPBA`) - Use (Uses: Regain a Story Point)
- **Party Power** (`GKez5xeu5ZllzGOI`) - Use (Uses: Gain a Friendship Point)
- **Concentrate Fire** (`LccKe9ZdDPvS5YbD`) - Use, RollModifier (Uses: Concentrate Fire)
- **Stay In Formation** (`pU3dKGNWYAhgRY6B`) - Use (Uses: Set your allies' Initiative behind yours)
- **Humanitarian** (`hxWJxlMLbkBbx73w`) - Use (Uses: Heal 1 Health (DIF 12 Survival))
- **"I Know A Guy"** (`anfEVX8bI2eQh40E`) - Use (Uses: Reach your contact (DIF 12 Persuasion))
- **Phantom** (`Z92UggPHdmt47A7Q`) - Use, Trigger x2 (Uses: Phantom)
- **Suggestion** (`q2YLQLdssomYU4Za`) - Use (Uses: Suggestion (Persuasion vs Willpower))
- **Talk Them Down** (`Y8PlCnqD5txZKJWh`) - Use (Uses: Talk Them Down)
- **Deadstick** (`SDwpvAzQX0pYSHyc`) - Use (Uses: Deadstick)
- **Superb Soloist** (`S3t5zNlhPp7evXbh`) - Use (Uses: Edge for every ally)
- **Harass** (`91TqKfAnyL1VijZH`) - Use, RollModifier (Uses: Harass)
- **Antagonistic** (`04lrt1b9aCN4ts2N`) - Use, RollModifier (Uses: Antagonistic)
- **Flying Nuisance** (`6PsZqPUijt60ISlq`) - Use (Uses: Flying Nuisance)
- **Versatile Protection** (`FZQlUV1KkyQxUi7s`) - Use x2 (Uses: Choose a Resistance or Immunity / Switch it off)
- **Animal Gait** (`gWjcSPeqNe1h8rwZ`) - Use x2, Movement x3 (Uses: Switch Animal Gait on / Switch Animal Gait off)
- **Two Heads Are Better Than One** (`2SGJ4ezuiZgb7JqX`) - Use, RollModifier (Uses: Mark a target)
- **Invisibility** (`Ec3PMcI8WsCu2ivp`) - Use x2, Trigger x2 (Uses: Turn Invisible / End Invisibility)
- **I Still Function** (`o4HgDxoKWVtieWZJ`) - Use (Uses: I Still Function)
- **Self-Revive** (`ulES8RippJVrGbhj`) - Use (Uses: Self-Revive)
- **Shoulder To Shoulder** (`vZNQBGwiv1hREbyr`) - Use (Uses: ↑1 on a Skill for an ally)
- **Natural Movement** (`TLI74oM0tbDtQ298`) - Use x2, Movement x2 (Uses: Switch Natural Movement on / Switch Natural Movement off)
- **Pointy** (`kwkUWzNVdSKDx0jt`) - Use x2, RollModifier, DamageType (Uses: Manifest claws or teeth / Put them away)
- **After You** (`CjNQHWxMjTQfcLTZ`) - Use (Uses: Swap Initiative with a friend who rolled lower)
- **Quick Study** (`adJm4dpjD04TICkd`) - Use (Uses: Learn the target's Defenses)
- **Power Adaptation** (`S7Qs6bJOVkVFxlFu`) - Use x10 (Uses: Switch it on / Switch it off)
- **Spot Weld** (`4GYOdopDcXS8lgGI`) - Use (Uses: Spot Weld)
- **Martial Leadership** (`6dRdxCRjWqjrt8Wc`) - Use (Uses: Martial Leadership)
- **Voice of Primus** (`m8oHzT4BUB79NiVw`) - Use (Uses: Voice of Primus)
- **Words Can Hurt!** (`SBoujesTRdI7IpmM`) - Use (Uses: Words Can Hurt!)
- **Calming Words** (`r3slLsGwSfXUiD94`) - Use (Uses: Calming Words)
- **Archkey** (`EEZUFQIGfeLhT2qX`) - Use (Uses: Open an archway (DIF 10 Technology))
- **Engine Cells** (`Q8TO2TJNncmy6Q6R`) - Use (Uses: Drain a cell)
- **Energon Cube** (`5p3lMU4vT7kUodp5`) - Use (Uses: Take its Energon)
- **Energon Snack** (`y72ZEiWUa3AYxcXl`) - Use (Uses: Take its Energon)
- **Impossible Expectations** (`98rFJyzaoCWrLdbF`) - Use (Uses: Give a Defeated ally 1 Health)
- **Absolute Menace** (`YsoS30FKigTm19CH`) - Use (Uses: Absolute Menace)
- **Frightening Display** (`8NJtMXvcK3YDnwY4`) - Use (Uses: Frightening Display)
- **Fight Me!** (`7ovAtv0r6UaAsmHE`) - Use, RollModifier (Uses: Mark a Threat)
- **A Logical Explanation** (`CiDQxCxgnnosvBDo`) - Use (Uses: A Logical Explanation)
- **Duty Of The Graphite** (`Rr7ucZahtHI9yXwA`) - Use (Uses: Duty Of The Graphite)
- **Uninterrupted Break** (`1vrQxY1nzjMjeU7D`) - Use (Uses: Uninterrupted Break)
- **Elemental Storm** (`6IoMpj8pWmP8IpH4`) - Use (Uses: Elemental Storm)
- **Comic Flair** (`Ux2eueBLxKgzD2Kd`) - Use (Uses: Comic Flair)
- **Powered Plating** (`45WHjwO125zTvuGR`) - Use (Uses: Powered Plating)
- **Paradox** (`TYebczV8RvTTbWnL`) - Use (Uses: ↑1 on your next test with a Skill)
- **At All Cost** (`TGnqQAWWi1hBGqeh`) - Use x2 (Uses: Switch it on / Switch it off)
- **Quick Study** (`IoOFcSJK3sHLAbgR`) - Use (Uses: Learn the target's Defenses)
- **Fast Learner** (`u3KK0V30GXDdRPAY`) - Use, RollModifier x2 (Uses: Move a rank between two Skills)
- **Electromagnetic Disruption** (`EmJaaHzoEYtWhchj`) - Use (Uses: Electromagnetic pulse)
- **At All Costs** (`UFwnD2CsWCWXlUyf`) - Use x2 (Uses: Switch it on / Switch it off)
- **It's Time** (`HT4iCNp5WIWXR5bJ`) - Use x2 (Uses: Morph / Unmorph)
- **Soothe** (`vzTeGdjO3v2oeR19`) - Use (Uses: Soothe)
- **Manipulate** (`5IfrvMnLOMqfNWko`) - Use (Uses: Manipulate)
- **Talk Them Down** (`Ht8KDCTIQXLo1YI3`) - Use (Uses: Talk Them Down)
- **Whirlwind Strike** (`SV8nqua9koRB3lvm`) - Use (Uses: Target every adjacent enemy)
- **Whatever We Need** (`1DphEJt2hPswKDzI`) - Use, RollModifier (Uses: Whatever We Need)
- **Force Field** (`j3qkiawQATkksdaC`) - Use (Uses: +2 Toughness and Evasion against the next attack)
- **Squad Guardian** (`Li2y6KqFu2OGRkrX`) - Use (Uses: Bring a Defeated ally back)
- **Volley** (`Xi2sHKmBi21c3wbu`) - Use x2 (Uses: Switch Volley on / Switch Volley off)
- **Group Strike** (`coGMtK50t3Ojeklx`) - Use (Uses: Target every enemy in the area)
- **More Heads are Better than One** (`jsaByB9ui8k1VUfG`) - Use (Uses: 2d2 on your next Skill Test)
- **Horse Around** (`6uhfHYeuUkFuGEEN`) - Use (Uses: Horse Around)
- **Crack-Up The 4th Wall** (`km6HV50h6XWKTIm1`) - Use (Uses: Regain a Cheer Point)
- **Inspiration** (`FJSNzVRulj20M0B1`) - Use (Uses: A bonus die for an ally)
- **Benefits of Command** (`jSmMtJ0YFCEJcXYU`) - Use (Uses: Edge on a unit member's next Requisition)

## Code vs notes - needs a ruling

These were converted to match the CODE; the automation notes (or book) say something else.

- **Meat Shield** - notes: ally sharing from 5th, Resistance/immunity at 13th/18th, "until your next turn". Code: only the
  holder's own bonus (max of permanent and switched-on), no expiry. Rules do the code.
- **Inner Magic** - notes say the Willpower -1 per use is left to the table, but the old `actor.mjs#_prepareInnerMagicWillpowerReduction`
  applied it (stacking, scene-long). The rule keeps applying it; the notes are stale.
- **Phantom Suite / Natural Movement / Mysterious Aura / Stand Behind Me!** - notes say "while Morphed"; no Morphed gate in code.
- **Castling, Knight's Jump, Natural Movement, Fast Learner, Honorific Token, Squad Guardian, Deadstick** - notes name an action
  cost (Standard / Move); the code spent none, so the rules don't either.
- **Box Shot** - notes: "your next attack". Code: stays on until switched off.
- **Phantom** - notes: until the start of your next turn. Code: never ends on its own (only on attack / damage), and the
  Invisible status stays. Matched.
- **Deadstick, Absolute Menace, A Logical Explanation, Elemental Storm, Soothe, Voice of Primus** - the Condition they give has
  no duration in code (notes give 1 round / next turn / 2d2 rounds). `applyCondition` without `rounds`, as in code.
- **Animal Gait** - notes: switches on Aerial, Climb AND Swim. Code: you pick one type. Matched (one pick).
- **Better You Than Me** - notes: "Void damage". Code: plain unreducible Health loss. `loseHealth`, as in code.
- **Martial Leadership** - notes: ↓1 or Edge. The survey said the code banked a Snag; it actually applied ↓1 (`downshift 1`),
  which matches the notes.

## Bugs fixed (user-approved)

- **Nemesis Drain** - the penalty mark is `until: scene`. Note: the old `nemesis-drain-expiry.mjs` already cleared the flag when
  the scene advanced, so in practice nothing changed; the expiry now lives on the mark (that file is deleted).
- **Whatever We Need** - the Edge is used up by the roll it applies to (RollModifier `consumeMark` / `consumeFrom: target`).
  The old flag was read on every matching roll and never cleared.
- **Extra Rough Training** - once per mission per teammate: `markWindow` on the teammate with `window: mission`, and a teammate
  already trained this mission is refused. The old "used" flag was never cleared.
- **Words Can Hurt!** - the target's immunity mark is `until: scene` (old flag never expired).

## Other behaviour differences (small, from the engine)

- Rule banks don't go stale when a combat ends on their own; banks that did are `until: combat`. Banks add `not:roll:initiative`
  because Initiative consumes rule banks.
- Turn / round limits only count inside a started combat (old: any combat). Affects Absolute Menace, Knight's Jump and Harass;
  Power Bleed only toggles in a started combat.
- Area rolls (`rollVsEach`) with no one in range stop without using the limit or the cost.
- Gear / upgrade Uses (Archkey, Engine Cells, Energon Cube/Snack) need the item equipped or on its host.
- Pointy's Sharp damage type is applied after the hand-written overrides, so it now wins over Void / Blazing / Cryogenic.
- Animal Gait's Movement is at stage `final`; its order against Fluttery Wings / Mobile Mode can differ.
- Inspiration and More Heads banked on the same actor: only one bonus die moves per roll (one `bankDie` slot).
- Quick Study shows the `.total` Defenses, not `getDefenseValue` (a vehicle's driver substitution is not shown).
- Talk Them Down (GIJ): the "no target" toast is a `warn`; the enemy count leaves neutrals out.
- Invisibility: the Lend Assistance clear is a Trigger, so it also fires on Perk-button assists.
- Fast Learner: a cancelled second pick keeps the first; both RollModifiers need both picks.
- Beast Mode: a cancelled package costs nothing; grants already in progress from the old code aren't migrated (in-progress state).
- Story Point grants with no GM online warn and stop.
- Superb Soloist with no allies doesn't use its limit.
- Fun Exhaustion is matched by uuid (`self:hasItem`), so it ignores `maturedIgnored`.
- The converted rolls no longer change the pre-roll dialog; banks show as labelled sources in the Roll Options Dialog instead.

## Shared-file edits

- `module/rules/steps.mjs` - `rollVsEach` / `roll` `essence`, `writeInitiative` `exact`, `setForm` `silent`.
- `module/mechanics/combat/reaction-engine.mjs` - `rollVsMany(..., essenceOverride = null)`.
- `module/rules/plugins/index.mjs` - import of `combat/nearby-enemies-recipient.mjs` appended at the end.
- `module/rules/plugins/tags/actor-state-tags.mjs` - `notShift` on the skills pick source.
- `module/mechanics/resources/banked-buffs.mjs` - the converted Uses, their constants and imports; the IMMEDIATE_ALLY_PERKS table
  and its dispatch; dead BANKABLE fields (`onceMissionFlag`, `worldStoryPointCost`, `fixedBonusDie`, `isInspirationPR`,
  `defenseAmounts`); the `FORCE_FIELD_DEFENSE_FLAG` export. Mixed conditions trimmed (DIG_IN || SCRAMBLE, TALK_THEM_UP).
- `module/dice.mjs` - ~120 cut blocks: pre-roll reads, checkContext fields, pending-bonus reads, target modifiers, Defense
  additions, post-roll riders, the Combat Stance switch/damage, Pointy, the invisibility/phantom clear on attack (Shyness kept),
  `twoHeadsAssistanceConsumed`, the Inspiration read (the `pendingMoreHeads` read stays - it is the `bankDie` slot).
- `templates/dialog/roll-dialog.hbs`, `module/apps/roll-options-dialog.mjs`, `module/mechanics/rolls/roll-dialog.mjs` - the
  Combat Stance switch (`combatStanceAvailable` / `applyCombatStance`).
- `module/documents/actor.mjs` - Natural Movement and Animal Gait Movement lines, `_prepareInnerMagicWillpowerReduction`.
- `module/mechanics/combat/combat.mjs` - `deactivatePhantomOnDamage`.
- `module/mechanics/combat/multiple-targets.mjs` - Box Shot.
- `module/mechanics/actions/named-actions.mjs` - the Lend Assistance invisibility clear.
- `module/mechanics/resources/requisition.mjs` - the Benefits of Command pending Edge.
- `module/items/index.mjs` - castling-move-note, beast-mode-tiers (x2) and nemesis-drain-expiry imports.
- `module/items/shared/gij-crb-item-lookups.mjs` - the `castling` key.
- `module/items/forms/pony-shape-shifting.mjs` - the Pointy deleteCombat hook (+ its now-unused import).
- Trimmed to their readers (other code still reads them): mark-target, primary-quarry, combat-stance (`getCombatStanceNumber`),
  phantom-suite, protected-target, toxic-terror, fun-exhaustion, power-adaptation, voice-of-primus, calming-words,
  powered-plating, at-all-cost, volley.
- Tests: `banked-buffs.test.js` (81 describes + Benefits/Inspiration tests; the Inner Magic fixture now uses Terrifying),
  `dice.test.js` (the converted items' describes/tests, the `combatStanceAvailable` dataset default, the
  `twoHeadsAssistanceConsumed` default), `actor.test.js`, `multiple-targets.test.js`, `requisition.test.js`,
  `named-actions.test.js`, `instructor-nemesis-drain.test.js`, `resources-energon-wealth.test.js`, and the trimmed item tests.

## Watch out

- **`target:markedByMe:<key>` returns null** (the tag is `markedByMe:<key>`, bare). Rules from other parts use the broken form:
  **Spite, Tear Down, Show Respect, Shots Fired** - those conditions never hold. Not fixed here (not this part's items).
- `rule:toggle:<key>` is not a tag; the toggle tag is `self:toggle:<key>` (the survey sketches used the wrong form).

## Unused strings

No new strings (`lang-banked.json` is `{"RulesExtBanked": {}}`). These `lang/en.json` keys are no longer used anywhere in
module/, templates/, tours/ or packs/ after this part's removals:

- `E20.AdaptationPointOverSpent`
- `E20.AfterYouMustRollLower`
- `E20.AnimalGaitActivated`
- `E20.AnimalGaitDeactivated`
- `E20.AnimalGaitPickTypeLabel`
- `E20.AnimalGaitPickTypeTitle`
- `E20.AntagonisticNoTarget`
- `E20.AntagonisticPickEffectLabel`
- `E20.AntagonisticPickEffectTitle`
- `E20.AntagonisticShiftDown`
- `E20.AntagonisticSnag`
- `E20.BeastModeActivated`
- `E20.BeastModeDeactivated`
- `E20.BoxShotActivated`
- `E20.BoxShotDeactivated`
- `E20.CalmingWordsNoTarget`
- `E20.CombatStanceNoTarget`
- `E20.ComicFlairNoValidTarget`
- `E20.ConcentrateFireNoTarget`
- `E20.DeadstickNoTarget`
- `E20.DeadstickPickLabel`
- `E20.DeadstickPickTitle`
- `E20.DirtyTrickPickConditionLabel`
- `E20.DirtyTrickPickConditionTitle`
- `E20.ElementalStormPickConditionLabel`
- `E20.ElementalStormPickConditionTitle`
- `E20.ExtraRoughTrainingPickSkillLabel`
- `E20.ExtraRoughTrainingPickSkillTitle`
- `E20.FastLearnerDecreaseLabel`
- `E20.FastLearnerIncreaseLabel`
- `E20.FastLearnerPickSkillsTitle`
- `E20.FlyingNuisanceNoTarget`
- `E20.FlyingNuisancePickSkillLabel`
- `E20.FlyingNuisancePickSkillTitle`
- `E20.Gij2CastlingMove`
- `E20.InvisibilityActivated`
- `E20.InvisibilityDeactivated`
- `E20.ItsTimeActivated`
- `E20.ItsTimeDeactivated`
- `E20.KnownAccomplicesNoTarget`
- `E20.LikeWaterEvasion`
- `E20.LikeWaterPickOptionLabel`
- `E20.LikeWaterPickOptionTitle`
- `E20.LikeWaterToughness`
- `E20.MartialLeadershipEdge`
- `E20.MartialLeadershipPickEffectLabel`
- `E20.MartialLeadershipPickEffectTitle`
- `E20.MartialLeadershipSnag`
- `E20.MeatShieldActivated`
- `E20.MeatShieldDeactivated`
- `E20.NaturalMovementActivated`
- `E20.NaturalMovementDeactivated`
- `E20.NaturalMovementPickTypeLabel`
- `E20.NaturalMovementPickTypeTitle`
- `E20.ParadoxAlreadyUsed`
- `E20.ParadoxPickSkillLabel`
- `E20.ParadoxPickSkillTitle`
- `E20.PointyActivated`
- `E20.PointyDeactivated`
- `E20.QuickStudyNoTarget`
- `E20.QuickStudyResult`
- `E20.RoarPickDefenseLabel`
- `E20.RoarPickDefenseTitle`
- `E20.RollDialogCombatStance`
- `E20.ShoulderToShoulderNoTarget`
- `E20.ShoulderToShoulderPickSkillLabel`
- `E20.ShoulderToShoulderPickSkillTitle`
- `E20.StayInFormationNoCombat`
- `E20.StayInFormationNotSeated`
- `E20.TalkThemDownNoTarget`
- `E20.TimelineAnomalyNoCombat`
- `E20.TimelineAnomalyNoTarget`
- `E20.TimelyTeammateNoTarget`
- `E20.TimelyTeammateNotInCombat`
- `E20.ToxicTerrorActivated`
- `E20.ToxicTerrorDeactivated`
- `E20.TriggerReactionPickTitle`
- `E20.TriggerReactionSkillLabel`
- `E20.UninterruptedBreakEssenceOption`
- `E20.UninterruptedBreakHealOption`
- `E20.UninterruptedBreakPickLabel`
- `E20.UninterruptedBreakPickTitle`
- `E20.UninterruptedBreakStoryPointOption`
- `E20.VersatileProtectionDamageTypeLabel`
- `E20.VersatileProtectionDeactivated`
- `E20.VersatileProtectionPickTitle`
- `E20.VersatileProtectionTierLabel`
- `E20.VoiceOfPrimusNoTarget`
- `E20.WordsCanHurtDamage`
- `E20.WordsCanHurtNoTarget`
- `E20.WordsCanHurtPickDefenseLabel`
- `E20.WordsCanHurtPickEffectLabel`
- `E20.WordsCanHurtPickEffectTitle`
- `E20.WordsCanHurtPickOptionsTitle`
- `E20.WordsCanHurtPickSkillLabel`

## Rule count

**152 rules on 91 items.**

## Test failures not in this part

- `actor.test.js` - The Tough Get Going: another part's change.
