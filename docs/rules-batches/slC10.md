# Batch slC10: group C's round-10 engine pieces (roll pipeline, dialog, Defenses, tags) and the items they unblock

**Scope:** section "## C" of the round-10 groups list - the skips that slB9 (1, 4: Stoic, Thorn Warlord; 6; 11; 13: Arrogant),
slC9 (4, 5: Angry, Fast Tracking, Environmental Warrior, Seafarer; 6: Contort; 8; 11), slD9 (11, 12: Holographic Sights, Bump &
Run, History Buff, Balance and Compensation) and slE9 (3, 4, 5, 11, 12, 15: mark-carried rules, Larger Than Life, Third Eye, Dog
Person, Stinger Spray, Wild Idea) traced to "Roll pipeline, dialog, Defenses, tags". Every piece was built as a plug-in
(`module/rules/ext/c.mjs` + `module/rules/ext/c/`) plus three small engine edits (links.mjs, adapter.mjs), and every item it
unblocks was converted. Edited in place in the shared checkout (no branch, no commit).

| Verdict | Count |
|---|---|
| Converted | **52** pack entries (49 items; the expedition clothes are in two packs each) |
| Partial | **2** (Ladder - its reach is a rule, its Use and ally toggle stay; Weapon Enthusiast Perk - see below) |
| Still code | **0** of the listed items (two halves stay code - see below) |
| Moved to another group | Softenblows (group B converted it; my two rules were taken back out) |

Rules added: **80** (against HEAD) on the 53 pack files below. `node scripts/check-rules.mjs`: 0 errors, 0 warnings.
Tests: `module/rules/engine10-c.test.js` (29, the pieces) and `module/rules/conv10-slC10.test.js` (65, the items).

## Engine features added 2026-10-06 (round 10, group C)

### Marks that carry rules (`ext/c/marks.mjs`)

- **`scope: "marked"` + `mark: "<key>"`** (RollModifier, DialogSwitch, Defense, DamageModifier, Trigger, Reaction,
  ItemModifier, ... - every type that already carries over a link): the rule doesn't act for its holder, it acts for every
  creature carrying the holder's mark `<key>` (any side, any actor type) while the mark lasts. The setter's item is read
  equipped or not (a Cage on the shelf still holds its prisoner). The setter never gets it from its own mark.
- **`scope: "markedTarget"` + `mark`** (RollModifier only): on rolls *against* the marked creature by anyone but the
  creature itself (Laser Designator). `consumeMark: "<key>"` uses the mark up on the roll; `consumeFrom: "roller"` uses
  up the roller's own mark (a `marked` rule).
- **Tags** `target:ruleHolder` (the other party holds this rule's item), `self:allyOfHolder` (same token side as the
  rule's holder, not the holder), `self:marking:<key>` (this actor has set `<key>` on someone), `self:movedSince:<key><op><ft>`
  (feet from where `markHere` stored the token: `self:movedSince:spot>=10`). **Ref** `@marking.<key>` (how many creatures
  carry this actor's mark).
- **Steps** `pickMarked {key, prompt}` (pick one creature carrying your mark; it becomes the step's targets) and
  `markHere {key, until}` (stores the token's position for `movedSince`).
- **DamageModifier `negate: true`** (dealt only): the hit's damage is taken back to 0 (built for Softenblows, now unused).
- **Step `holderRoll {skill, dif, downshift, edgeWhen, onSuccess, onFail}`** (`ext/c/holder.mjs`): in a carried rule, the
  setter rolls (Ignite: the igniter rolls Science against the burning creature's Evasion). `spendActionOf {action, to}`:
  the recipients pay the action (in a combat only).

### Dialog pieces (`ext/c/dialog.mjs`)

- **`DialogSwitch scope: "incoming"`**: shown on the *roller's* dialog when they target a creature holding the rule, once
  per targeted holder, never remembered; `{holder}` in the label is the holder's name, `defaultWhen` works as usual. A
  `key` reaches the holder's own rules as tag `roll:incoming:<key>` (a Defense that only counts while the switch is on).
- **`DialogSelect {options: [{label, upshift, downshift, edge, snag, key, steps}], default}`** (scopes self / incoming): a
  select of alternatives; the chosen option applies. Option labels are localised when they're `E20.` keys.
- **DialogSwitch extras**: `ignoreDownshift: n` (takes back up to n of the roll's downshifts), `specializeWhen: [tags]`
  (the roll counts as Specialized while on), `bonusDie: "d4"` or `{dice: [...], index: formula}` (a bonus pool die).
- **RollModifier extras**: `bonus: n` (a flat, non-shift bonus to the total) and `forget: true` (a switch built from it is
  never remembered).
- **`SkillSubstitution mode: "ask"` + `options` + `prompt`**: before the dialog, the roller picks the rolled Skill or one of
  the options.
- **`BeforeRoll {steps, cancel, message}`** (scopes self / item): steps before the dialog (a cost, a warning), or
  `cancel: true` refuses the roll with the message. Steps **`warn {text, stop}`** and **`clearTargets`**; tag
  **`roll:plainReach`** (a melee attack at the roller's plain size Reach, no Reach multiplier).

### Defenses (`ext/c/defense.mjs`)

- **Defense `mode: "addAfter"`**: a roll-time addition after the best-of / halving is worked out; rules sharing a `stack`
  count once (the biggest). **`mode: "instead"` + `from: [<defense>]`**: use the other Defense's total instead. Both work
  with `outgoing: true` and `limit`, and never touch the sheet.
- **Step `grantNextTurn {free, move, standard, to}`**: extra actions on the recipients' next turn.

### Tags, checks and refs (`ext/c/tags.mjs`, `ext/c/picked.mjs`)

- Checks `check:angrySnag` (the rolled Skill is the stored Angry Skill), `check:contingencyLikely` (the actor's last
  logged action this round was a Contingency, or it's rolling off its turn), `check:survivalSpecialization` (a Survival
  Specialization's keywords match the scene's terrain / environment; null when there's neither).
- Tags `roll:save`, `roll:poisonSave`, `skill:of:<essence>`, `roll:anyTarget:<tags joined by &>`,
  `target:creature:<word|word>`, `target:tagStarts:<prefix>`, `target:threatVsLevel:<op><n>` (Threat Level minus this
  actor's level), `item:weaponType:<type>` / `item:weaponType:flagOf:<_id>` (the type stored on the owned item with that
  source id), `rule:pickedItem:<key>:<tags>`.
- Refs `@rolled.<path>` (the rolled item), `@other.<path>` (the item an ItemModifier is changing, per item),
  `@reach.size | melee | attack | <size>`, `@altMode.<path>` (the current Alt Mode item, 0 when not transformed),
  `@owned.<_id>` (1 when an item with that source id is owned), `@availDif.<key>` (Requisition DIF of the picked item).

### Equipment, actions, steps, events

- **`ItemLadder {items, path, by, from, floor}`** (`ext/c/equipment.mjs`): moves an item value along the weapon
  requirement ladder (none, d2 ... 3d6), with a floor.
- **`BrawnRequirement {amount, ignore, carrying, stack}`** (`ext/c/brawn.mjs`): Brawn offset for equipment requirements
  (and for carrying when `carrying: true`); `ignore` beats every amount.
- **`ActionSkills {action: "heal", skills, limit}`** (`ext/c/actions.mjs`): more Skills for the heal action while `when`
  holds and the limit lasts.
- **RollModifier `immune: ["lendAssistance"]`** (`ext/c/assist.mjs`): banked Lend Assistance is set aside for the roll and
  put back after.
- **Steps `blindRoll {formula, flavor, rows: [{min, text}]}`** (a GM-only roll with the band its total reaches; `@rolled`
  afterwards) and **`endExpiring {offer, to}`** (`ext/c/steps.mjs`: ends whatever runs out at the end of this turn, or
  offers it on a chat button).
- **Event `enemyEnteredReach`** (`ext/c/reach.mjs`): fires for a holder when an enemy's move ends inside its melee Reach.
  Tag **`target:inRange:<attack|melee>`**.

## Verdicts

| Item | Pack file | Verdict |
|---|---|---|
| Angry (Hang-Up) | `ccitems/_source/Angry_wGMyGbySdNSgPs8B.json` | converted |
| Fast Tracking | `dditems/_source/Fast_Tracking_9DMDz10v4IJ75MZQ.json` | converted |
| Environmental Warrior | `bthitems/_source/Environmental_Warrior_bxnYVraaRNaXRy9Y.json` | converted |
| Layered Armor | `jttitems/_source/Layered_Armor_GUppwd5R2bSVaKVO.json` | converted |
| Seafarer (Hang-Up) | `qgtgitems/_source/Seafarer_ahWxUG3w6KkfgUDw.json` | converted |
| Arctic Expedition Clothes | `gijcrbitems/_source/Arctic_Expedition_Clothes_pWRpmsOcWIv9trHP.json` | converted |
| Arctic Expedition Clothes | `mlpcrbitems/_source/Arctic_Expedition_Clothes_pWRpmsOcWIv9trHP.json` | converted |
| Desert Expedition Clothes | `gijcrbitems/_source/Desert_Expedition_Clothes_SQzr6PhXZQ338BBh.json` | converted |
| Desert Expedition Clothes | `mlpcrbitems/_source/Desert_Expedition_Clothes_SQzr6PhXZQ338BBh.json` | converted |
| Desert Gear | `wtnvcgitems/_source/Desert_Gear_tv0pOgALa608pw8i.json` | converted |
| Business | `wtnvcgitems/_source/Business_6Vke4qKEaYjjRWQt.json` | converted |
| Holographic Sights | `qgtgitems/_source/Holographic_Sights_aapIJuPKyMaGjb4U.json` | converted |
| Larger Than Life | `fmmcitems/_source/Larger_Than_Life_Gwhns0NfDQYhCVPK.json` | converted |
| Contort | `ghpfitems/_source/Contort_PPMvpsNSpvUMFwMs.json` | converted |
| Balance and Compensation | `eocitems/_source/Balance_and_Compensation_T0TFdu4HRK8Eh0u0.json` | converted |
| Over Brawn | `gijcrbitems/_source/Over_Brawn_ToNsubTwuej5GAV0.json` | converted |
| The Heavy | `gijcrbitems/_source/The_Heavy_rlD6YJSr2fgROKHo.json` | converted |
| Pack Mule | `gijcrbitems/_source/Pack_Mule_x8SbuymJTLYn1TdC.json` | converted |
| Pack Mule | `tfcrbitems/_source/Pack_Mule_b4zeeYax1vrzVGZx.json` | converted |
| Dog Person | `wtnvcgitems/_source/Dog_Person_U5arLtyo8eEgl2Ck.json` | converted |
| Third Eye | `wtnvcgitems/_source/Third_Eye_XolO5C6pgFt8WQJZ.json` | converted |
| Tenacity | `gijcrbitems/_source/Tenacity_dyjdCTOs83bLiCxC.json` | converted |
| History Buff (the Anomaly check Use) | `jttitems/_source/History_Buff_b3O5i3HMtaIHl6PD.json` | converted |
| Subtle Snake (Hang-Up) | `fffav1items/_source/Subtle_Snake_ZCgcPAQzeMYTti7g.json` | converted |
| Shadow (the targeted-hider switch) | `gijcrbitems/_source/Shadow_PDiRwnTcNCtzJbDn.json` | converted (its banked-buffs Infiltrating part was already separate and is untouched) |
| Something Is Off | `sotsitems/_source/Something_Is_Off_1tLnQT580DafhUV4.json` | converted |
| Explosive Engineer (Hang-Up) | `ghpfitems/_source/Explosive_Engineer_rT04k3umqXPAlsA3.json` | converted (through the Perk's rules - see below) |
| Explosive Engineer (Perk) | `ghpfitems/_source/Explosive_Engineer_1MCKcleeXZZf5PQF.json` | fixed (not on the list) |
| Second Skin | `gijcrbitems/_source/Second_Skin_Txn7a7v4gQOCYPhC.json` | converted |
| Wild Idea | `ghpfitems/_source/Wild_Idea_CVl4P0zoArmY5mp1.json` | converted |
| Stinger Spray Effect | `fmmcitems/_source/Stinger_Spray_Effect_b2cIwfYeGzvifR7l.json` | converted |
| Stinger Spray Alternate Effect (2 Poison Damage) | `fmmcitems/_source/Stinger_Spray_Alternate_Effect__2_Poison_Damage__GZRKwL2vRwXUIjtf.json` | converted |
| Stinger Spray Alternate Effect (Blinded) | `fmmcitems/_source/Stinger_Spray_Alternate_Effect__Blinded__Bx7lTyG4lBTi66Si.json` | converted |
| Arrogant (Hang-Up) | `eocitems/_source/Arrogant_duMjTyfREHYmDFJs.json` | converted |
| Waterrunning | `kocitems/_source/Waterrunning_F6mPryRgK7wLM0Yu.json` | converted |
| Laser Designator | `gijcrbitems/_source/Laser_Designator_AcNaNxZnyOfXv0f6.json` | converted |
| Demolecularization Gun | `eocitems/_source/Demolecularization_Gun_HjkeUVUUTQiXi0MO.json` | converted |
| Cage | `tfcrbitems/_source/Cage_w1E74WXrvwQJlS1Q.json` | converted |
| Diversion | `tfcrbitems/_source/Diversion_LDi9BUkXFtaCSoTe.json` | converted |
| Stoic | `tfcrbitems/_source/Stoic_p9Obyw2krF0pks8D.json` | converted |
| Thorn Warlord | `fmmcitems/_source/Thorn_Warlord_GKNjCEwhgEbBiKQn.json` | converted |
| Ladder | `tfcrbitems/_source/Ladder_CjJGz1LLzFoveqZK.json` | partial (Bot-Mode reach is a rule; its Use and the ally ↑2 toggle stay in tf3) |
| Bump & Run | `eocitems/_source/Bump___Run_4eA2ktw0cfdYV6Fs.json` | converted |
| Synch Up | `tfcrbitems/_source/Synch_Up_gaDAXIEkSt0B25RZ.json` | converted |
| No Escape | `tfcrbitems/_source/No_Escape_xxMeliFHeWYxtGVI.json` | converted |
| Energized | `gijcrbitems/_source/Energized_yoOIFTh1E2pVlSln.json` | converted |
| Spiked | `gijcrbitems/_source/Spiked_pRipbWx12tOzfdqD.json` | converted |
| Energy Field | `tfcrbitems/_source/Energy_Field_p2ntDbJb38jpGNFO.json` | converted |
| Hearty Meal | `ghpfitems/_source/Hearty_Meal_NULhQcWctFcXXdDH.json` | converted |
| Weapon Enthusiast (Hang-Up) | `qgtgitems/_source/Weapon_Enthusiast_GcMPz5MICXwTzKOq.json` | converted |
| Weapon Enthusiast (Perk) | - | partial / still code (see below) |
| Ignite (+ Cobra Fireball's Edge) | `ccitems/_source/Ignite_zherN6ArBKv6wyGc.json` | converted |
| Deconstruct (the Use) | `tfcrbitems/_source/Deconstruct_7tc7EWwKSFQ76tly.json` | converted (the sabotaged item's Snag and Repair button stay generic code, keyed on the flag) |
| Softenblows | - | taken by group B |

## Converted

All of the above marked "converted" now run from their pack rules; the old code paths were deleted (files
`helpers/extensions/qualify1/ignite.mjs`, `react/auras.mjs`, `data21/psycho.mjs`, `fix3-dice/shadow.mjs` (+ test),
`helpers/hearty-meal.mjs` (+ test)) or cut out of their slice (fix3-gij, situational1/2, other2/3, data1, data21/22,
qualify1/2, resource, gij3, mlp2, tf2, tf3, react, kits, banked-buffs, dice.mjs, the roll dialog's Bump & Run row).

## Behaviour differences worth a decision

- **Marks in flight are lost** on update: Laser Designator designations, Demolecularization Gun hits, Cage prisoners,
  Diversion, Stoic, burning (Ignite) were old flags; the rules use `ruleMarks`. Anything mid-scene when the update lands
  has to be set again.
- **Diversion out of combat** now lasts until removed (the old one lasted the scene).
- **Third Eye** now applies after the rules' downshifts are counted (it used to see only the dialog's own).
- **Explosive Engineer (Perk)**: its two DialogSwitches had `when`s that could never be true for a grenade (dead code); they
  now hold for grenade-named weapons while the Hang-Up isn't owned. This also delivers the Hang-Up's half.
- **Incoming switches** (Shadow, Something Is Off, Energized, Spiked, Energy Field) show once per *targeted* holder; with
  two targeted holders there are two switches. Shadow used to look at every hidden token.
- **Weapon Enthusiast and Subtle Snake** now respect a Matured Hang-Up (rules skip a matured item; the code didn't).
- **Deconstruct**: a destroyed Kit is deleted through the GM relay; its chat lines are the generic step lines, not the
  old custom ones.
- **Carried rules** (Cage, Laser Designator, Ignite) still work when the setter's item is unequipped.
- **Wild Idea** on actors with unlimited resources: the bonus die no longer checks a resource pool.
- **History Buff** asks with choose buttons instead of a dropdown.
- **Ladder's ally switch** stays code: it needs a "same side, anywhere on the scene" scope that doesn't exist yet.
- My `combat:round` tag was removed (it shadowed the core `combat:round:<n>` tag - group E's merge note); nothing else of
  mine shadows a core sub-tag.

## Still code (2 halves), and why

- **Weapon Enthusiast (Perk)**: its Use's take / tag step writes the chosen weapon type onto the item as a flag, and
  pickGrant flags don't take `{choice}` yet. The Hang-Up half reads that flag (`item:weaponType:flagOf:<_id>`) and is a
  rule.
- **Ladder**: the Use (deploy) and the ally ↑2 toggle (needs a same-side-anywhere scope).

## Shared-file edits

- `module/rules/links.mjs`: `export const LINK_SOURCES = []`; `linkedEntries` adds their entries before the holder index
  (another agent also added `registerLinkScope` here).
- `module/rules/adapter.mjs`: `shiftsOf` takes a 6th parameter `rolled` (`scope.rolled`); `ruleRollSources` passes
  `ctx.item`; `consumeFrom: "roller"` uses up the roller's mark; ItemModifier values resolve per item with `otherItem`.
- `module/helpers/extensions/index.mjs`: removed the imports of `qualify1/ignite.mjs`, `react/auras.mjs`;
  `fix3-dice/shadow.mjs` import removed earlier.
- Slices edited to cut the converted code (and their tests): fix3-gij, situational1, situational2, other2 (gij, magic,
  medic), other3 (tf, shared), data1/armor-rules, data21 (threats, common, data21, weapons test), data22/weapons, qualify1
  (misc, common, index), qualify2 (old-hand, common, qualifications), resource (story-spend, common), gij3, mlp2, tf2 (rolls,
  uses, modes, common), tf3 (rolls, uses, reactions, common), react (index, test), wtnv test.
- `module/helpers/kits.mjs` (+ test), `module/helpers/banked-buffs.mjs` (+ test), `module/dice.mjs` (Thorn Warlord regen,
  Bump & Run, Hearty Meal), `module/dice.test.js` (removed those describes), `module/helpers/roll-dialog.mjs`,
  `module/apps/roll-options-dialog.mjs`, `templates/dialog/roll-dialog.hbs` (the Bump & Run row).
- Pack file not on the list: `ghpfitems/_source/Explosive_Engineer_1MCKcleeXZZf5PQF.json` (the `when` fix above).

## Unused strings

No longer referenced anywhere (safe to drop from `lang/en.json` at merge):

`E20.Fix3ShadowToggle`, `E20.S1FastTrackingToggle`, `E20.S1EnvironmentalWarriorToggle`, `E20.S1ContortEnded`,
`E20.S1ContortFree`, `E20.S1ContortMove`, `E20.S1ContortPrompt`, `E20.S1ContortUsed`, `E20.S2SeafarerResistToggle`,
`E20.WtnvToggleDogs`, `E20.WtnvToggleVision`, `E20.Gij3SubtleSnakeToggle`, `E20.Q2WildIdeaToggle`,
`E20.Q2EnthusiastNoAssist`, `E20.D21StingerSprayPaid`, `E20.D22Demolecularized`, `E20.D22DemolecularizedHit`,
`E20.O2Designated`, `E20.O2DesignatorSource`, `E20.O2GrenadeNoEngineer`, `E20.O3BumpRunImpaired`,
`E20.RollDialogBumpAndRun`, `E20.Mlp2ToggleWaterrunning`, `E20.Mlp2ToggleConning`, `E20.ResAnomalyLine`,
`E20.ResAnomalyRisk.trivial`, `E20.ResAnomalyRisk.small`, `E20.ResAnomalyRisk.modest`, `E20.ResAnomalyRisk.average`,
`E20.ResAnomalyRisk.high`, `E20.ResAnomalyRisk.serious`, `E20.ResAnomalyRisk.catastrophic`, `E20.Tf2CageEscape`,
`E20.Tf2CageFocus`, `E20.Tf2CageFocused`, `E20.Tf2CageFull`, `E20.Tf2CageImprison`, `E20.Tf2CageImprisoned`,
`E20.Tf2CagePickPrisoner`, `E20.Tf2CagePrompt`, `E20.Tf2CageRelease`, `E20.Tf2CageReleased`, `E20.Tf2DeconstructFailed`,
`E20.Tf2DeconstructGear`, `E20.Tf2DeconstructKit`, `E20.Tf2DeconstructPick`, `E20.Tf2DeconstructWeapon`,
`E20.Tf2DiversionEdge`, `E20.Tf2DiversionFailed`, `E20.Tf2DiversionSet`, `E20.Tf2DiversionSkill`, `E20.Tf2DiversionSnag`,
`E20.Tf2NotAdjacent`, `E20.Tf2WhichDefense`, `E20.Tf3NoEscapePrompt`, `E20.Tf3NoEscapeUsed`, `E20.Tf3StoicPrompt`,
`E20.Tf3StoicUsed`, `E20.Tf3SynchUpUsed`, `E20.ReactPickSkill`, `E20.ReactAuraPenalty`, `E20.ReactAuraStrike`,
`E20.ReactAuraPrompt`, `E20.ReactAuraElement`, `E20.ReactAuraHit`, `E20.Q1IgniteCaught`, `E20.Q1IgniteFight`,
`E20.Q1IgniteDrop`, `E20.Q1IgniteFought`, `E20.Q1IgniteOut`, `E20.Q1IgniteNotBurning`, `E20.HeartyMealPickSkillTitle`,
`E20.HeartyMealPickSkillLabel`.

New strings: `E20.RulesExtC.LendAssistanceSetAside`, `E20.RulesExtC.PickMarked` (in the scratchpad's `r10/lang-c.json`,
to merge under `E20`).
