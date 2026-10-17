# Batch slItems114: round 14, part items1 - the "convert" items under module/items/ (attacks ... healing)

**Scope:** the 50 items the survey (`survey/result-items1.json`) marked "convert": per-item code under `module/items/attacks`,
`defenses`, `forms`, `gear` and `healing`, plus the hooks into it in `dice.mjs`, `chat.mjs`, `banked-buffs.mjs`, `power-use.mjs`,
`perk-handler.mjs`, `documents/item.mjs`, `documents/combat.mjs` and `data/item/weapon-effect.mjs`. Edited in place in the shared
checkout (no branch, no commit, packs not compiled).

**Result:** **46 converted** (45 pack items carry new rules; Technologist's Science-or-Technology lives in Flashy's rule),
**4 not converted** (Shield Upgrade, Imperial Machine Mantle, Defibrillator, Patch Up). **88 rules added on 45 items.**
`scripts/check-rules.mjs`: 0 errors, 0 warnings. 58 per-item files (code + tests) deleted, plus the now-unused
`items/shared/team-member-picker.mjs` (+ test). One engine piece added (BeforeRoll `early`). Tests:
`module/rules/conv14-items1.test.js` (40 tests).

## Engine features added 2026-10-06 (round 14, items1)

- **BeforeRoll `early: true`** (`rules/plugins/rolls/early-before-roll.mjs`, imported last by `rules/plugins/index.mjs`): a
  `{cancel: true, early: true}` BeforeRoll is checked when the item is used - `documents/item.mjs#roll`, before its Area of Effect
  is placed or a pre-roll picker opens - and a refused use gets its action back (`refund` of the action-economy spend), with the
  rule's `message` as a warning. Without `early`, a cancel happens inside the roll (the extensions' preRoll), after the action is
  spent and the template placed, and nothing is refunded. The same rule is asked again there, so a roll that doesn't come through
  `item.roll` (an `attack` step) is still refused. `earlyRollRefusal(actor, item, dataset)` returns the refusal's message, or
  null. Used by the once-per-encounter weapon effects (the old `limited-weapon-effects.mjs` check sat at that same point).

Also used, from the round-14 dice part (in progress beside this batch): tag **`roll:damageType:<type>`** (the card's damage type
after every override - `rules/plugins/tags/roll-damage-type-tag.mjs`) for Painmonger, and the hit / targeted Triggers' `defense:`
fact (`checkContext.defenseType`, rules/triggers.mjs) for Clever Mind. **If that part's triggers.mjs change is dropped, Painmonger
and Clever Mind need it back.**

## Verdicts

| Item | Pack file | Verdict |
|---|---|---|
| Antlers | `dsoeitems/_source/Antlers_MIqTCcA1vXERwPYv.json` | converted |
| Extended Attack | `tfcrbitems/_source/Extended_Attack_bpTOPVRx3hKkq4Yr.json` | converted |
| Assault Claw | `eocitems/_source/Assault_Claw_VKaNv1Vf0O6ewkix.json` | converted (Primeon Blade stays code) |
| Charge It Up! | `jttitems/_source/Charge_It_Up__eDLYdEHBTU2S2qp0.json` | converted |
| Create Weapon | `qgtgitems/_source/Create_Weapon_Qb0LifFSyfOCFIVd.json` | converted |
| Crippling Blow (+ Bleed 'Em Dry's rider) | `dditems/_source/Crippling_Blow_SKHtIija5VRPcuBu.json` | converted |
| Deconstructionist | `qgtgitems/_source/Deconstructionist_2qb5dV11qvWsN4xJ.json` | converted |
| Favorite Weapon | `dditems/_source/Favorite_Weapon_emaXxo2XzoHMoNCe.json` | converted |
| Technologist | `tfcrbitems/_source/Technologist_tdFzQ0IOtoHQ0vmy.json` | converted (inside Flashy's rule, no rule of its own) |
| Flashy | `tfcrbitems/_source/Flashy_l79g3PoYo7nyln4X.json` | converted - see the ruling list (Blinded) |
| Sneak Attack (Force Recon) | `fffav1items/_source/Sneak_Attack_FWN6697ESy9ua6VI.json` | converted |
| Frenzied Attack | `dditems/_source/Frenzied_Attack_74X6WTVVP1cfnOpI.json` | converted |
| Turbo Thunder Cannon Energy Attack / Alternate Effect | `atsitems/.../Wl7L2wcydXAw9Xei`, `prcrbitems/.../GkobUXUpyU8l6gKw` | converted |
| Turbo Lightning Sword Energy Attack / Alternate Effect | `atsitems/.../3VBxXY5kXow9UGgX`, `prcrbitems/.../A2T4cCya4l1rlihY` | converted |
| Wing Missile Salvo Effect / Alternate Effect | `atsitems/.../Z6cpZMj1nKTquCLF`, `atsitems/.../FRue0q6oL8aRWswk` | converted |
| Painmonger | `dditems/_source/Painmonger_6lQNn6RY1Kclydw8.json` | converted |
| Primal Tools | `dditems/_source/Primal_Tools_xfi9WkEAJXYs86Bd.json` | converted |
| Psycho Assault | `fmmcitems/_source/Psycho_Assault_yZ3rXt8z1jlCHlu7.json` | converted |
| Side Splitter | `mlpcrbitems/_source/Side_Splitter_o6h9U6oeWfpXYOA4.json` | converted |
| Siphon | `tfcrbitems/_source/Siphon_Fc9DBgnZffr8VKDU.json` | converted |
| Spite | `bthitems/_source/Spite_Gadtv1eSeFgNotSw.json` | converted |
| Suffer! | `fmmcitems/_source/Suffer__4wCGBUae2VvEDVs9.json` | converted |
| Quick and Quiet | `kocitems/_source/Quick_and_Quiet_nMS83Zn6qgFpIpmE.json` | converted |
| Voice of Night Vale | `wtnvcgitems/_source/Voice_of_Night_Vale_wC7hyjoYTVRQo5LZ.json` | converted |
| Tear Down | `ccitems/_source/Tear_Down_ZrJG5EJVVZWcP8fo.json` | converted |
| HUD | `ccitems/_source/HUD_cx6cVaHALQlwBrnD.json` | converted |
| Weapon Customizer | `iafav2items/_source/Weapon_Customizer_UWEU7hfmtRxlkWJB.json` | converted (the Use; weapon-traits.mjs still reads the flag) |
| Elemental Adaptation (Aqua Ranger) | `bthitems/_source/Elemental_Adaptation_06JVZqlBDXIfPKw8.json` | converted (dice.mjs's flag reader stays) |
| Armor Upgrade Reinforced Shell | `tsitems/_source/Armor_Upgrade_Reinforced_Shell_GQt4IlyXGHCbLxNP.json` | converted |
| Clever Mind | `mlpcrbitems/_source/Clever_Mind_34WtMHugUN7Wp5bP.json` | converted |
| Defensive Flexibility | `prcrbitems/_source/Defensive_Flexibility_7kHQ53hZFgwhSFVi.json` | converted |
| Imperial Machine Mantle | `pradvitems/_source/Imperial_Machine_Mantle_CjYzIg9gVstsE0wg.json` | **not converted** |
| Iron Hide | `gijcrbitems/_source/Iron_Hide_hXtchClOmMDDeWB9.json` | converted |
| Numbness | `fmmcitems/_source/Numbness_HB7e3uW1ggYNJVql.json` | converted (Stone Warlord's extra type stays code) |
| Shield Upgrade | `gijcrbitems/_source/Shield_Upgrade_ep0OFsU1QIuRpHeR.json` | **not converted** |
| Rotten Tomatoes | `mlpcrbitems/_source/Rotten_Tomatoes_0DcWZaKg0GVFV3ei.json` | converted |
| Tough Crowd | `mlpcrbitems/_source/Tough_Crowd_jKdu6PowM9GQkKW8.json` | converted |
| Wind Whispers | `bthitems/_source/Wind_Whispers_JZgbPpDoFXctLBoH.json` | converted |
| Monster Morph | `fmmcitems/_source/Monster_Morph_iDbMl3SS6XnyADN2.json` | converted (Grow! and the flag readers stay) |
| Cache I | `dditems/_source/Cache_I_EEGQqqgqZEJkJDHB.json` | converted |
| Special Program | `jttitems/_source/Special_Program_wKGrImiofaMrni0m.json` | converted |
| Weapon Implant | `dditems/_source/Weapon_Implant_j9xrYUKHvLkxdd9e.json` | converted |
| Defibrillator | `gijcrbitems/_source/Defibrillator_IP0hnNhERC4OCc0k.json` | **not converted** |
| Got To Get Tough | `gijcrbitems/_source/Got_To_Get_Tough_bIoMrn9aP9x6QYVL.json` | converted |
| Mind Over Matter | `gijcrbitems/_source/Mind_Over_Matter_eLO9NJ7akWmoPHEK.json` | converted |
| Not Dead Yet | `iafav2items/_source/Not_Dead_Yet_mCsw25hT4y4q4ceG.json` | converted |
| Patch Up | `tfcrbitems/_source/Patch_Up_Jlfb8iPvT7JFvcxv.json` | **not converted** |

**Not converted, and why:**
- **Shield Upgrade** - the bonus is added inside seven of dice.mjs's per-attack Defense computations (`getShieldUpgradeBonus`,
  including the swapped-Defense paths: Over the Candlestick's Evasion, Tactical Gymnastics...), best-of across every shielded
  Vanguard within 10 ft; an aura `addAfter` Defense would land once at the end against the resolved Defense, not in the swapped
  ones. Needs: a Defense rule hook inside each swapped-Defense recompute, or those recomputes moved onto one function.
- **Imperial Machine Mantle** - its +50% reads `_prepareDefenses`' local Toughness armor share (stored armor + worn armor's
  Toughness bonus + loose alt-mode / alteration upgrades + the Grid shell), which no stored value holds, so no Defense formula can
  match it. Needs: `_prepareDefenses` to keep that share (e.g. `system.defenses.toughness.armorTotal`). (Converted, then put back
  - chat.mjs's crit break and actor.mjs are unchanged.)
- **Defibrillator** - a 6-round delayed heal that is dropped (item not used up) when its combat ends, re-checks Defeated when it
  lands and heals through `applyHealSkillTestResult` (no I've Got You); `scheduleCard` runs on regardless of the combat and the
  `healAction` step adds I've Got You. Needs: a `scheduleCard` tied to its combat, and a plain heal-skill-test restore step.
- **Patch Up** - its roll must stay the dataset-flagged Patch Up test (`isPatchUp`, `patchUpAmount`): `combat-steps.mjs#firePatchedUp`
  keys the `patchedUp` event (Intensive, Converting Third Dimension's rules) on it, and a rule `roll` step can't carry those flags.
  Needs: a `roll` step `dataset` option (or the Use firing `patchedUp` itself).

## Converted

`module/rules/conv14-items1.test.js` (40 tests) loads each item from its pack and checks what the old code and tests did.

- **Antlers** - ItemModifier `system.totalReach` max `@reach.size * 2` on the actor's unarmed (no `parentId`) melee weaponEffects -
  the Ladder shape; the same as the old `max(reachMultiplier, 2)` (a stored x3 stays x3).
- **Extended Attack** - a Use toggling `self:toggle:on` with the old two chat lines (no action, no expiry - as the code), and the
  same ItemModifier on every melee weaponEffect while on. (Mass Shift's reach stays in weapon-effect.mjs.)
- **Assault Claw** - a hit Trigger on the weapon (`item:own`, `item:damageType:grapple`) marks the target `assaultClawGrapple` for
  the scene; `grappled-snag.mjs#clawGrappled` reads that mark (`markOf`) to label the Grappled switch, as it read the old flag.
- **Charge It Up!** - a Use on the Power (1 Personal Power, then `require self:morphed` - refused after paying, as the activation
  did), marking `chargeItUp` until the combat ends; a Defense `ignoreArmor` (outgoing, any Defense) on melee Power Weapon attacks
  while marked; an afterRoll Trigger on such an attack takes the mark off.
- **Create Weapon** - a Use on the nanomite Power: one daily use spent first (`system.usesSpent`, shown only while some are left -
  as `spendDailyUse` gated the activation), then a choose of Short blade / Short bludgeon granting Close Combat Blade /
  Bludgeoning unless one is already owned (`calc:@owned.<id><1` - grantIntegratedItem's no-op).
- **Crippling Blow** - DialogSwitch `{key: cripplingBlow, downshift: 1, forget: true, when: [attack:melee]}`; a hit Trigger with
  `roll:switch:cripplingBlow` asks Blinded / Deafened / Prone (untimed) - or, with Bleed 'Em Dry owned, takes 1d2 Energon (never
  below 0, silent roll) from a target that has any, instead.
- **Deconstructionist** - DialogSwitch `{key, forget}` on Technology; a hit Trigger with it banks a Snag on the target's next roll
  (until the combat ends, one bank per item - the old pending flag).
- **Favorite Weapon** - a Use picking an owned weapon (not Integrated, with a two-handed Targeting attack without an AoE shape) and
  writing its id to the Perk's `system.choice` (where Ricochet, Down the Barrel and the checks read it); a RollModifier ↑1 on
  attacks with it (`check:favoriteWeaponRolled`) - now its own labelled source. `favoriteWeaponOf` is the one reader left.
- **Flashy (+ Technologist, Multiplication)** - a hit Trigger on attacks with an Electric weaponEffect posts a button
  (`Flashy (Science vs. Toughness)`, once) that rolls Science against the hit target's Toughness - Technology instead with
  Technologist when its die is better - and Blinds 2 rounds (4 with Multiplication).
- **Sneak Attack (Force Recon)** - DialogSwitch `{damage: <the Commando sneak attack table of @level>, forget}` on attacks (the
  formula equals `getPredatorSneakAttackDamage` for levels 1-20 - tested). No limit - see the ruling list.
- **Frenzied Attack** - a hit Trigger on a damaging unarmed attack while Energon is left posts a button: spend 1 Energon, a Free
  action this turn, the same attack again (`attack {item: rolled}`) - whose own hit can offer the next.
- **The six once-per-encounter weapon effects** - each carries a BeforeRoll `{scope: item, early, cancel, when:
  [self:windowUsed:<shared flag>:encounter]}` and an afterRoll Trigger `markWindow`, on the old shared flags
  (`turboThunderCannonEnergyAttackUsedThisEncounter`, `turboLightningSwordEnergyAttackUsedThisEncounter`,
  `wingMissileSalvoUsedThisEncounter`), so each pair still shares one use.
- **Painmonger** - a hit Trigger `{when: [roll:damaging, roll:damageType:stun]}` - Impaired 1 round on the target.
- **Primal Tools** - an `added` Trigger `createItem` (the integrated Primal Tools weapon, Stun 1 / Sharp 1 children, Might melee,
  2 targets, ↓1, flagged `isPrimalTools`) unless one is already wielded or granted.
- **Psycho Assault** - a Use `{when: [self:morphed, not:check:monsterForm], cost: 1 Personal Power}` marking `psychoAssault` to the
  end of the turn (only in a combat); RollModifier ↑1 on attacks and a scaled DamageModifier +1 while marked.
- **Side Splitter / Siphon** - Uses: a target, a choose of the Defense, `rollVsEach` with the Skill; Side Splitter's hit deals 1
  Blunt (applyDamage), Siphon's takes 1 Health outright (`loseHealth`) and gives 1 Energon past the maximum.
- **Spite** - a miss Trigger (attacks, 1+ Personal Power) posts a button: spend 1, mark the target (`spite`, per setter, exclusive,
  until the combat ends) and bank an Edge for the next attack against it (`markedByMe:spite`).
- **Suffer!** - a hit Trigger (damaging attacks, 1+ Personal Power) posts a button (used once done): spend 1..all Personal Power,
  Impaired (untimed) on the target.
- **Quick and Quiet / Voice of Night Vale** - Uses only in combat round 1: Surprise the first target / `rollVsEach` Intimidation vs
  Willpower on every enemy within 60 ft, Surprising each hit.
- **Tear Down** - a Use: Intimidation vs the target's Willpower (`rollVsEach`); a hit marks it (`tearDown`, per setter,
  exclusive); a scaled DamageModifier +1 on attacks against the marked creature, whose steps take the mark off.
- **HUD** - a Use `{when: [combat], cost: move, limit: turn}`: pick a Skill (before paying), mark `hud` to the end of the turn;
  RollModifier ↑1 on that Skill while marked.
- **Weapon Customizer** - a Use: pick a weapon, then (auto) set or clear its `flags.essence20.customized` with the old chat line.
  `weapon-traits.mjs#perkGrantedTraits` still reads that flag (another part added a Weapon Customizer ownership check there this
  round).
- **Elemental Adaptation** - an `added` Trigger: pick an element (`config elementDamageTypes`), pick yourself or a Player
  Character (`team`), `flagList aquaElementalAdaptations` on them; dice.mjs's Acid / Fire reader is unchanged.
- **Armor Upgrade Reinforced Shell** - Defense Toughness `0 - @item.system.armorBonus.value` out of Alt Mode and Morph, when attached
  or worn as an alt-mode / alteration upgrade; HitRider `note: 1` on an unarmed Stun hit out of Alt Mode.
- **Clever Mind** - a Use (1 Cheer Point) marking `cleverMind`; Defense `instead` Cleverness against any other Defense while marked;
  a `targeted` Trigger against a non-Cleverness Defense takes the mark off.
- **Defensive Flexibility** - per `system.choice`: Defense `addAfter` +2 to that Defense while Morphed (stacked per Defense), or
  DerivedStat `system.resistances.<element>` true.
- **Iron Hide** - a `wouldBeDefeated` Trigger (asks first; not Stun; a Story Point can be spent): spend 1 Story Point, Brawn DIF 15,
  on a success `negateDamage`.
- **Numbness** - DerivedStat `system.resistances.<type>` true: Stun, Psychic at 6th, Blunt at 12th, every Energy type (and
  `energy`) at 18th, by `max(@level, threatLevel)` (getEffectiveLevel). `numbness.mjs#hasNumbnessResistance` keeps only Stone
  Warlord's extra chosen type.
- **Rotten Tomatoes / Tough Crowd** - Uses: spend 1..all Cheer Points, `bank {defense: [toughness, evasion] / [willpower,
  cleverness], defenseBonus: @spent, persist, until: combat, replace}`.
- **Wind Whispers** - an `added` Trigger: pick yourself or a Player Character, +2 to their stored `system.defenses.evasion.bonus`.
- **Monster Morph** - a Use (shown while in Monster Form or with 3 Personal Power), choose (auto): on (a Psycho Path Role, 3
  Personal Power) - keep the Size, Large, -3 Personal Power, +2 Health bonus, `monsterFormActive`; off - Size back (common if none
  kept), -2 Health bonus, flags off (Grow!'s too).
- **Cache I** - a Use, `limit: {per: encounter, max: 1 / 2 with Cache II / 3 with Cache III}`; with Private Barter unused this
  encounter (its old shared flag), a Private Barter line and `markWindow`.
- **Special Program** - an `added` Trigger and a Use, both while nothing it granted is there and the old `o1Picked` flag is unset:
  `pickGrant` a General Perk.
- **Weapon Implant** - afterRoll Triggers (success, Technology, `var:dif=14 / 18 / 20`, 18 needing Major Augments, 20 Extensive
  Enhancements): the target (or self) `pickGrant`s a non-Consumable weapon of that Availability.
- **Got To Get Tough** - an `initiativeRolling` Trigger: tracked temporary Health 1 (until damage; the ledger drops it when the
  giver is Defeated) for allies within 30 ft (getNearbyAllyTokens).
- **Mind Over Matter** - a Use: a target, choose Intimidation / Persuasion, ask 1-6, roll at DIF 5 + 5n; success heals n (to the
  maximum) and removes Defeated.
- **Not Dead Yet** - a Use, once per scene: +1 Health bonus and value; +1 more once per encounter with an ally within 30 ft holding
  the CSTO Personnel Origin (`pickAlly {all, within: 30, filter: [target:hasType:origin:CSTO Personnel]}` inside a one-pass
  `repeat`, the old flag's `markWindow`).

## Code vs notes - needs a ruling

- **Flashy - Blinded never applied.** `activateFlashy` passed `isFlashyAttempt: true` but dice.mjs read `dataset.isFlashy`, so the
  follow-up roll never Blinded anyone (its own test only checked the dataset it passed). **Converted to the Blinded the code meant
  (and the notes and book say)** - the one place this batch does not reproduce the current behaviour. To match the old code
  exactly, drop the two `onSuccess` steps from Flashy's rule.
- **Sneak Attack (Force Recon)** - the code never enforced its once per combat (twice with Veiled Attacker) or the 30 ft: they only
  changed the switch's reason text. Converted with no limit. Ruling: add `limit: {per: "encounter", max: "1 + min(1,
  @owned.6OxGuWzQz0Fiivas)"}`. (Notes now say to tick it only within 30 ft with a use left.)
- **Charge It Up!** - the Power's activation spent its Personal Power even when not Morphed, then warned. Kept (cost, then the
  Morphed check). The book's "while Morphed" would be `beforeCost: true` on the `require`.
- **Psycho Assault** - the notes say Morphed / out of Monster Form is left to the table; the code enforced it. Converted to the
  code's (enforced). Out of combat the old code spent the Power and marked nothing; kept.
- **Weapon Implant** - no use limit at all in code (notes: once per scene / mission; `WEAPON_IMPLANT_ENCOUNTER_FLAG` was unused), and
  it's an auto-detected DIF 14 / 18 / 20 Technology roll, not the "Use button" the notes name. Kept as the code.
- **Deconstructionist** - marks any successfully-hit target, not only vehicles (the notes say vehicle). Kept.
- **Extended Attack** - no Move-action cost and no expiry at the next turn (the notes say both). Kept.
- **Create Weapon** - the notes leave "removing it at the end of the scene" to the table; the code granted it permanently. Kept (no
  `until`), but see "other differences": the granted weapon now goes when the Power is deleted.
- **Cache I** - resets each encounter (the notes want per session). Kept.
- **Not Dead Yet** - the +2 is once per encounter (the notes: once per adventure). Kept.

## Other differences worth a decision

- **Chat-card buttons are per target now** (Flashy, Frenzied Attack, Spite, Suffer!): the old buttons came once per card, keyed on
  the card's first target (Spite: when the whole card missed; Suffer! / Frenzied: when any row dealt damage). The hit / miss
  Triggers fire per target, so a multi-target card offers one button per qualifying target, each acting on its own target.
  Flashy's roll goes against the hit target (the button carries it), not whatever is targeted when it's pressed.
- **Buttons hide instead of greying out** when unaffordable (Spite, Suffer!: under 1 Personal Power; Frenzied: no Energon).
- **Grants now carry `grantedBy`** (Create Weapon, Primal Tools, Weapon Implant via pickGrant): the old grants stayed when the
  Power / Perk was deleted; these go with it. Weapon Implant's pickGrant doesn't skip a weapon the patient already has.
- **Once-per-encounter weapon effects** - the refusal now also comes from BeforeRoll inside the roll for rolls that skip
  `item.roll` (unchanged behaviour otherwise). The use is counted by an afterRoll Trigger: a roll cancelled in the dialog isn't
  counted (as before).
- **Charge It Up!** - armor is ignored by subtracting the attacked Defense's armor share (the Flames of Hate piece) instead of
  replacing the difficulty with `getDefenseValue(..., {ignoreArmor})`; combined with Armor Piercing on the same attack it now
  subtracts twice. The mark is used up after the roll (afterRoll), not as it starts.
- **Defensive Flexibility / Numbness** - Resistance is now written to `system.resistances`, so everything that reads it sees it:
  the sheet, Studious Measures' reveal, Grid Elemental Adaptation (no reactive Resistance when already resistant) and Ninja Powered:
  Deep Wisdom's Edge against the holder - before, only dice.mjs's Resistance-Snag check knew.
- **Crippling Blow / Deconstructionist / Sneak Attack** - their old template checkboxes are rule switches now (rule labels; Sneak
  Attack's damage no longer takes the shared Role-Points damage slot, so it is offered even when a Commando / Predator Sneak
  Attack would have claimed that slot - an unlikely mix).
- **Favorite Weapon / Psycho Assault / HUD** - their ↑1 is a labelled roll source the player can switch off instead of being folded into the
  starting total. HUD's rules count only while its armor is worn (an upgrade's rules follow its host); its Use was available
  regardless before.
- **Iron Hide** - fires inside `applyDamage` for every damage source (it was only the chat card's Apply Damage button), before the
  Defeat-save chain, and negates the damage rather than letting it land and restoring the Health after: Triggers and riders that
  key on damage taken (takesDamage, CBRN Defender, vehicle defeat) no longer see the negated hit.
- **Voice of Night Vale** - `enemies:60` leaves out neutral tokens (the old getNearbyEnemyTokens took any token not of the actor's
  disposition) and measures with the rules' distance helper; one card per target set as before (rollVsEach), without re-targeting
  the user's tokens.
- **Reinforced Shell** - its HitRider applies only while its armor is worn or it counts as an alt-mode upgrade; the old Stun rider
  counted any shell on the actor. With two shells only one is subtracted (stack), as before.
- **Monster Morph** - with no Psycho Path (or under 3 Personal Power) the "on" option simply isn't offered (no warning). The kept
  previous Size now lives on the Perk, not the actor (`monsterFormPreviousSize` - in-progress state, no migration). Grow!'s kept
  Size flag is left (Grow! rewrites it when switched on).
- **Special Program** - the picker lists names only (the old one appended each Perk's prerequisite text).
- **Mind Over Matter** - Skill and amount are two dialogs (were one).
- **Got To Get Tough** - fires from the Initiative roll itself (after its dialog), not from `Combat.rollInitiative` - a cancelled
  Initiative dialog grants nothing either way.

## Shared-file edits

- `module/dice.mjs` - removed (imports and blocks): Favorite Weapon's ↑1 (Ricochet now reads `favoriteWeaponOf`), Weapon Implant's
  tier detection / implant, Side Splitter's flags and damage, Charge It Up!'s consume and ignoreArmor recompute, Crippling Blow's
  `cripplingBlowAvailable` / `applyCripplingBlow` / `cripplingBlowAttempt` / picker and `BLEED_EM_DRY_ID`, Deconstructionist's
  availability / attempt / pending Snag / marking, Psycho Assault's ↑1 and damage term (an EDIT of the damageBonusValue sum),
  Tear Down's damage term / attempt / marking, Force Recon's damageRolePoints claim and use count, Defensive Flexibility's Defense and
  Resistance reads, Clever Mind's consume, Rotten Tomatoes / Tough Crowd's Defense adds, Voice of Night Vale's / Mind Over Matter's /
  Siphon's / Flashy's / Iron Hide's flags and post-roll blocks, the `isFlashyAttack` flag, HUD's ↑1, Painmonger's
  `painmongerImpaired`, Spite's Edge consumption. Numbness's comment now names Stone Warlord.
- `module/dice.test.js` - 21 describe / test blocks for those items, the Iron Hide restore describe, and the expected-dataset lines
  `isFlashyAttack: false, `, `    cripplingBlowAvailable: false,`, `      deconstructionistAvailable: false,` (all occurrences).
- `module/chat.mjs` - addSpiteButton, addSufferButton, addFrenziedAttackButton, addFlashyButton and the Iron Hide prompt; the
  now-unused `hasStoryPointsAvailable` / `requestStoryPointSpend` imports. (Machine Mantle's break restored unchanged.)
  `module/chat.test.js` - the Iron Hide describe and its id. `module/essence20.mjs` - the four buttons' import / decorator entries.
- `module/mechanics/resources/banked-buffs.mjs` - canUsePerk / onPerkUse branches and imports for Quick and Quiet, Voice of Night
  Vale, Psycho Assault, Extended Attack, Favorite Weapon, Side Splitter, Monster Morph, Clever Mind, Rotten Tomatoes, Tough Crowd,
  Siphon, Not Dead Yet, Cache I, Tear Down, Mind Over Matter. `banked-buffs.test.js` - the Monster Morph and Psycho Assault describes.
- `module/documents/item.mjs` - the limited-weapon-effects check became the `earlyRollRefusal` call (lazy import); the mark after
  the roll went. `item.test.js` - its limited-effects describe.
- `module/documents/combat.mjs` - Got To Get Tough's call. `module/data/item/weapon-effect.mjs` (+ test) - Extended Attack's and
  Antlers' reach code (Mass Shift's stays). `module/mechanics/characters/power-use.mjs` - Create Weapon / Charge It Up! branches.
  `module/sheet-handlers/perk-handler.mjs` - Wind Whispers, Elemental Adaptation and Primal Tools on drop.
- `module/apps/roll-options-dialog.mjs`, `module/mechanics/rolls/roll-dialog.mjs`, `templates/dialog/roll-dialog.hbs` - the Crippling
  Blow and Deconstructionist checkboxes.
- `module/mechanics/combat/grappled-snag.mjs` (+ test) - `clawGrappled` reads the rule mark. `module/mechanics/actions/action-perks.mjs`
  - HUD's entries in the weapon-use table. `module/items/shared/condition-damage-buttons.mjs` - `favoriteWeaponOf` also accepts a
  uuid. `module/rules/plugins/shared/lazy-helpers-and-targets.mjs` - `lazy.favoriteWeapon` from `favoriteWeaponOf`.
  `module/rules/plugins/index.mjs` - the import at the end. `module/items/index.mjs` - special-program-perk-pick's two imports.
  `module/items/tests/armor-gear-data-rules.test.js` - the Reinforced Shell test.
  `module/mechanics/combat/weapon-traits.mjs` - touched and restored (no net change; another part relies on
  `TRAIT_PERK.weaponCustomizer`).
- Item files kept and trimmed: `items/attacks/assault-claw-primeon-blade.mjs` (+ test), `items/attacks/weapon-perk-uses.mjs` (+ test),
  `items/attacks/surprise-perks.mjs` (+ test), `items/defenses/aqua-elemental-adaptation.mjs` (+ test),
  `items/defenses/armor-brawn-reinforced-shell.mjs`, `items/defenses/numbness.mjs` (+ test), `items/forms/monster-morph.mjs` (+ test).
- Deleted (git rm): `items/attacks/` antlers, extended-attack, charge-it-up, create-weapon, crippling-blow, deconstructionist,
  favorite-weapon, flashy, force-recon-sneak-attack, frenzied-attack, limited-weapon-effects, painmonger, primal-tools,
  psycho-assault, side-splitter, siphon, spite, suffer, tear-down; `items/defenses/` clever-mind, defensive-flexibility, iron-hide,
  rotten-tomatoes, tough-crowd, cheer-defense-boost, wind-whispers; `items/gear/` cache-perk, special-program-perk-pick,
  weapon-implant; `items/healing/` got-to-get-tough, mind-over-matter, not-dead-yet; `items/shared/team-member-picker` (no user left)
  - with their tests.
- Pack notes reworded (they named the old folded-in ↑ / reason text): Favorite Weapon, Psycho Assault, Sneak Attack (Force Recon).

## Unused strings

`E20.ExtendedAttackActivated`, `E20.ExtendedAttackDeactivated`, `E20.ChargeItUpNotMorphed`, `E20.CreateWeaponPickTitle`,
`E20.CreateWeaponPickLabel`, `E20.CreateWeaponFormBlade`, `E20.CreateWeaponFormBludgeon`, `E20.RollDialogCripplingBlow`,
`E20.CripplingBlowPickConditionTitle`, `E20.CripplingBlowPickConditionLabel`, `E20.RollDialogDeconstructionist`,
`E20.FavoriteWeaponNoneEligible`, `E20.FavoriteWeaponPickTitle`, `E20.FavoriteWeaponPickLabel`, `E20.FlashyNoTarget`,
`E20.FlashyActivate`, `E20.FrenziedAttackActivate`, `E20.SideSplitterNoTarget`, `E20.SideSplitterPickDefenseTitle`,
`E20.SideSplitterPickDefenseLabel`, `E20.SiphonNoTarget`, `E20.SiphonPickTitle`, `E20.SiphonPickLabel`, `E20.SpiteActivate`,
`E20.SufferActivate`, `E20.SufferPickAmountTitle`, `E20.SufferPickAmountLabel`, `E20.QuickAndQuietNoTarget`, `E20.TearDownNoTarget`,
`E20.WeaponUsePickSkill`, `E20.WeaponUseHud`, `E20.WeaponUseCustomized`, `E20.WeaponUseUncustomized`, `E20.UpgradeHud`,
`E20.SelectSelfOrTeamMember`, `E20.Yourself`, `E20.D1ShellBotMode`, `E20.CheerDefenseBoostPickAmountTitle`,
`E20.CheerDefenseBoostPickAmountLabel`, `E20.IronHideConfirmTitle`, `E20.IronHideConfirmContent`, `E20.MonsterMorphActivated`,
`E20.MonsterMorphDeactivated`, `E20.CachePrivateBarterUsedNotification`, `E20.O1SpecialProgramPrompt`,
`E20.O1SpecialProgramGranted`, `E20.WeaponImplantNothingAvailable`, `E20.WeaponImplantPickTitle`, `E20.WeaponImplantPickLabel`,
`E20.MindOverMatterPickTitle`, `E20.MindOverMatterSkillLabel`. (`E20.LimitedWeaponEffectAlreadyUsed` stays - the BeforeRoll
rules' message.) No new strings (`<scratchpad>/r14/lang-items1.json` is `{"RulesExtItems1": {}}`).

## Rule count

88 rules added on 45 items.

## Checks

- eslint (`--ext .js,.mjs --rule 'linebreak-style: off'`) on every touched file: clean. (`conv14-systems.test.js` /
  `conv14-uses.test.js` - other parts' - had lint errors at the time.)
- `node scripts/check-rules.mjs`: 0 errors, 0 warnings.
- jest on this batch's test and the touched suites (weapon-effect, grappled-snag, assault-claw-primeon-blade, surprise-perks,
  aqua-elemental-adaptation, numbness, monster-morph, weapon-perk-uses, chat, documents/item, documents/combat, power-use,
  armor-gear-data-rules, sheet-handlers/, mechanics/actions/, items/shared/, weapon-traits): 32 suites, 807 tests, all passing.
- Full suite at the end: 9 suites failing, all on other parts' in-progress work (deleted `nemesis-drain-expiry.mjs` /
  `beast-mode-tiers.mjs` still imported by tests, `twoHeadsAssistanceConsumed` dataset expectations, Box Shot, Benefits of
  Command, Mark Everybot / Primary Quarry / Deadstick perk-use tests, `rollVsMany`'s new argument in conv10-slB10, the
  `wouldBeDefeated` setForm write in conversions-uses, movement in actor.test.js) - none touches this batch's items.
