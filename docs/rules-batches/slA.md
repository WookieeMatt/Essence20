# Batch slA: Power Rangers & Zord extension slices (`zord1`, `zord2`, `pr1`, `pr2`, `pr3`)

**Scope:** every item in the id tables of `module/helpers/extensions/zord1/`, `zord2/`, `pr1/`, `pr2/` and `pr3/`,
plus every other place in `module/` that uses those ids. The batch was done in three parts on separate branches
(`rules/slA-zord`, `rules/slA-pr1`, `rules/slA-pr23`, all from `Rules-Engine-Phase-1` at f8a93809) and merged
into `rules/slA`. Each part's full write-up follows below, in the same layout as the reg*.md files.

| Verdict | zord1 + zord2 | pr1 | pr2 + pr3 | Total |
|---|---|---|---|---|
| Convert | 2 | 1 | 4 | **7** |
| Partial | 9 | 2 | 0 | **11** |
| Skip | 49 | 17 | 29 | **95** |
| Items | 60 | 20 | 33 | **113** |

31 rules were added to 19 pack items. After the merge, `scripts/check-rules.mjs` counts 1334 rules on 956 items
(the base was 1303 rules on 944 items), with 0 errors and 0 warnings. ESLint is clean and jest passes
(502 suites; 9587 passed, 2 skipped).

No slice file became empty, so `extensions/index.mjs` is unchanged. The merge needed only one kind of fix: each part
appended a block at the end of `module/rules/conversions.test.js`, and all three blocks are kept.

**Most common engine pieces the skips need, across all three parts** (each part's list has the detail):

- **DerivedStat for text / true-false values** (size class, Initiative Edge, Resistances): Warzord, Tactical Size
  Shift, Mobile HQ, Lightspeed, Warrior Mode, Mesh Zord, Enlarged/Shrunk.
- **A late derived stage** after the hand-written derived hooks and gravity: Additional Pair of Limbs, Carapaced's
  Ground, Unique Weapon (Two-Handed Melee).
- **Dice in formulas and steps:** Overload, Unique Weapon (Ranged), Megaform Expeditor, Dino Drive Mode, Survivor,
  Morphin Navigator.
- **Form lifecycle** (Morph-time Form choice, un-equip/restore gear): Lightspeed, Turbo and the gear halves of the
  partial Forms.
- **Steps that change items** (remove by source, edit an owned weapon effect, create an item from data).
- **Hit-card rider options and hit-time damage-type overrides:** S.W.A.T., Warhead Magazines, Solar Power, Supersonic,
  Signature Finishing Move.
- **New scopes:** a "team" scope (every player character), an owned-Zord link, a Megaform-component link.
- **New Trigger events:** equip/unequip, before a roll, moving on one's own turn, an Essence dropping to 0, other
  actors' rolls and Conditions.
- **Other:** chat-card buttons / reroll rules, roll-cancel / forced-target rules, an elevation tag, a `pickPerk` pack
  filter, an `incoming` DialogSwitch, `@count.items:<tags>`.


---

## Batch slA (part): the `zord1` and `zord2` extension slices

**Scope:** every item in the id tables of `module/helpers/extensions/zord1/` (`FORM`, `GEAR`, `EMOTION`, `ZS`, `MF`,
`BODY`) and `module/helpers/extensions/zord2/` (`ZORD2`), plus every other place in `module/` that uses those ids
(`dice.mjs` held one: Ranger Operator's ↑1). The `pr1`, `pr2` and `pr3` slices of batch slA are done separately.

| Verdict | Items |
|---|---|
| Convert | 2 |
| Partial | 9 |
| Skip | 49 |

That is 60 items with behaviour of their own. Another 30 table entries are references only: gear a Form hands
out (the 20 `GEAR` entries), Megaform Traits granted by Versatile Combiner or Defender Torozord, Terror, Phantom
Suite, Unseen Strike, Auxiliary Zord, the Combiner Feature, and Mass Shift. Nine `ZORD2` / `EMOTION` / `MF` keys were
already unused before this batch, because their code is keyed by Megaform Trait type and not by id (Safe Release,
Titan Hardpoint, Universal Receptors, both EoC Core Body / Enhanced Attack entries, Warrior Mode, PR Core Body,
Emotional Mastery, Accurate Combiner). They are left as they were.

This batch added 17 rules to 11 pack items. After it, `scripts/check-rules.mjs` counts 1320 rules on 949 items
(the base was 1303 rules on 944 items).

### Converted (2)

| Item | Rule | Why it is exact |
|---|---|---|
| Primate (Common), Primate (Large) | DerivedStat `system.movement.climb.total` `max` 30, `rule:altMode` | `rule:altMode` is the old test: Transformed, with `altModeId` set to this item. `max` is the old `Math.max(climb, 30)`. Both run in the derived pass (`ruleDerived` is a `registerDerived` hook), and nothing after it reads Climb. `ZORD2.primateCommon` / `primateLarge` have been removed. |

### Partial (9)

| Item | Converted | Rule | Still code |
|---|---|---|---|
| Ranger Operator [Form] | +2 Toughness in place of the Morphed armor bonus; ↑1 on Driving and Survival | Defense `toughness` `2 - @actor.system.defenses.toughness.morphed`; RollModifier ↑1 on `skill:driving` / `skill:survival`. Both use `self:morphed` + `self:data:flags.essence20.zord1Form.uuid=<id>`, the same gate as its existing Evasion rule (that gate is `isFormActive`) | The gear swap (Nitro Blaster / Rail Saber or Cloud Hatchet). The ↑1 came from `dice.mjs`. That block, `RANGER_OPERATOR_ID` with its comment, and the `isFormActive` import there have been removed, along with the `dice.test.js` describe |
| Beast Morpher [Form] | Cheetah: +20 Ground. Gorilla: ↑2 on Brawn, +2 Health. Jackrabbit: the jump switch (Edge, Specialized) | DerivedStat `system.movement.ground.total` +20; RollModifier ↑2 `skill:brawn`; DerivedStat `system.health.max` +2; DialogSwitch `edge` + `specialize`, `forget`, `skill:athletics`. Each uses the Form gate + `rule:data:flags.essence20.zord1Beast=<beast>` (the choice stored on the Perk) | The animal pick, Cheetah's vortex and dog check, Gorilla's berserk on a Fumble, and Jackrabbit's carrot Snag and its Use |
| Ninja Storm Wind Ranger [Form] | Ground ×2 | DerivedStat `system.movement.ground.total` `multiply` 2, Form gate | The element (3 rounds), Air/Water Blast, Duplication, and the mind-control Snag (see the skips). Its ↑1 on Infiltration was already a rule |
| Time Force [Form] | The time-travel Specialization Edge switch | Two DialogSwitches (Edge, `forget`, `not:item:type:weaponEffect`). The first has `default: true` and needs `roll:specialization~time` / `~chrono` / `~tempor`. The second is unticked and needs none of those | The gear swap and grants, plus the Electro Booster / Vector Weapon rows |
| Supersonic [Form] | Edge against the Xenotech weapon Snag | RollModifier Edge, `weapon:trait:xenotech` + `not:weapon:data:flags.essence20.xenotechCritted` | The Xenotech armor ↑ (one per worn piece), the unarmed Energy switch, the Blade Blaster Sonic damage, and the Gridwide Communicator |
| Megafauna (Zord Feature) | Melee ↑1, +3 Evasion | RollModifier ↑1 `attack:melee`; Defense `evasion` 3. Both use `self:type:zord` + `self:data:flags.essence20.zord1Megafauna` | Smarts/Social 3 (it has to land after Terrorzord's 5/4, which stays code), the summon-in-form flag, the Use, the Animal Handling swap, and the combine warning |
| Hybridization | Fast Shift | ActionCost `item` → `free`, `rule:data:flags.essence20.zord2Hybrid=fastShift` + `item:source:<Mass Shift>` | The pick, the daily Mass Shift pool, the H Uses, Steady Hands, Helping Hand, and Evasive Conversion. `registerCostRule('zord2FastShift')` and `ZORD2.massShift` have been removed |
| Carapaced (Common), Carapaced (Large) | Underground 25 ft when picked | DerivedStat `system.movement.burrow.total` `max` 25, `rule:altMode` + `rule:data:flags.essence20.zord2CarapacedChoice=burrow` | The pick (its Use), and the +20 Ground otherwise (see the skip reasons) |

Every partial is exact for the part it converts:

- **Form gate.** `isFormActive(actor, uuid)` is `system.isMorphed && flags.essence20.zord1Form.uuid == uuid`. The two tags read the same values.
- **Roll sources.** The old roll sources (`registerRollSources`) and the new rule sources reach the dialog through
  the same `rollRiderSources`. The old switches and the new rule switches come through the same `extDialogToggles`
  call, at the same sites, initiative included. Old ext toggles were never remembered, so the switches use `forget`.
  The old `giveEdge` cleared a Snag instead of adding the Edge. That is the same as Edge + Snag cancelling at roll
  time.
- **Megafauna gate.** The old checks were `actor.type == 'zord'`, `isAttack && isMelee`, and the flag on the Zord.
  `attack:melee` reads the same `isAttack` / `isMelee` the old hook was handed.
- **Fast Shift.** Mass Shift's cost reaches the cost rules only through `consumeForItem`, as `{kind: 'item', item}`.
  The old rule matched any context whose item was Mass Shift, so an `item` ActionCost on that source matches the
  same contexts. The H buttons' own "Free with Fast Shift" check is unchanged.
- **Ranger Operator Toughness.** The Defense rule adds `2 - morphed`, the old delta, to the total and its breakdown.
- **Derived pass.** The DerivedStat and Defense rules run in `ruleDerived`, a derived hook like the old code. See
  difference 4 for where it falls among the other hooks.

### Behaviour differences

1. **Dialog sources and labels.** The converted sources now carry rule ids (`ext-rule-<item>-<n>`) where they had
   `ext-zord1Gorilla`, `ext-zord1SupersonicXenotech` or `ext-zord1Megafauna`. Their labels are the rules' own labels,
   not the item name.
2. **Ranger Operator ↑1 is now a listed source.** `dice.mjs` used to add the ↑1 straight into the dataset's
   `shiftUp`: it was neither listed nor untickable. It is now a rule source in the Roll Options Dialog, which the
   player can switch off. Earlier `dice.mjs` conversions accepted the same change.
3. **Ranger Operator's Toughness breakdown text.** With a Morphed armor bonus of exactly 2, the delta is 0. The old
   code wrote `+ 0 (Ranger Operator)` into the breakdown; the rule writes nothing. A negative delta now reads
   `- 1 (label)` where it read `+ -1 (name)`. Totals are unchanged.
4. **Order in the derived pass.** The converted Defense and DerivedStat rules run in `ruleDerived`. That hook is
   registered after the data21, data22 and pr1–pr3 slices' derived hooks (as before: the zord1/zord2 hooks also came
   after them). It is registered before situational2, tf2, tf3 and the zord1/zord2 hooks. Only the hooks registered
   between the adapter and the old zord code can see a difference:
   - **Shark's Fin** (situational2, GI Joe Freebooter) doubles Ground at sea. With Cheetah, it now gives
     2 × (Ground + 20) where it gave 2 × Ground + 20. That needs both a GI Joe Role Perk and a Power Rangers Role
     Perk, so it is cross-line. Ninja Storm's ×2 commutes with it.
   - **Rotor Blades** (tf3) reads Ground. It is Transformers-only, as are Primate and Carapaced, and neither of
     those touches Ground.
   - Everything else in that range only adds to totals the converted rules don't multiply.

   The Dino Thunder Shield Propulsion doubling and the Earth Duplication −1 Health still run after the rules, as
   they did after the old code.
5. **Time Force pre-tick.** `roll:specialization~` also reads a Specialization named on the dataset
   (`specializationName`, as from an inline roll link). The old check read only `specializationKey`, so such a roll
   now starts with the switch ticked when that name is about time travel.
6. **Fast Shift label.** The "how do you pay?" choice showed the raw key `E20.Zord2Hybrid.fastShift` (the cost rule's
   `label` was passed through unlocalized). It now shows "Fast Shift (Mass Shift as a Free action)".
7. **Initiative.** Initiative reads rule sources but never read extension roll sources. A character whose
   Initiative Skill was Brawn would now get Gorilla's ↑2 on Initiative. The default Initiative Skill is never Brawn.
8. **Duplicate copies.** A rule applies once per copy of its item. The old code read the first copy. Two copies of
   one Form Perk, Alt Mode or Feature are not an ordinary build.

The two strings that became unused, `E20.Zord1ToggleTimeForce` and `E20.Zord1ToggleJump`, have been removed from
`lang/en.json`. The existing conversion test "Ranger Operator: +2 Evasion" asserted that Toughness was unchanged.
With no Morphed bonus it now gets +2, so that test expects 14.

### Skipped (50)

#### zord1: Forms

- **Lightspeed Response.** What is left is the Morph-time Form picker (1 Personal Power) and the weapon swap, which
  un-equips the Blaster/Power Weapon, grants the picked gear and puts both back on de-Morph. *Needs a Form
  lifecycle:* a Morph-time choice between Forms, plus a step that un-equips a class of weapons and restores them
  when a state ends.
- **Solar Power.** What is left:
  - The element picked at activation.
  - The Power Weapon's +1 damage note and its damage-type change on a hit.
  - The +1 Fire rider option on Blaster/Targeting hits.

  *Needs:* a hit-time damage-type override (a DamageType rule is decided when the roll is made and also feeds the
  Resistance Snag, so it is not the same thing), and a rule that adds a rider option to each hit.
- **Turbo.** Gear swaps, plus the Turbo Cart row inside the shared Form Use. *Needs:* the Form lifecycle above.
  A rule Use on a Form Perk would not show while the extension Use matches the item.
- **Dino Thunder.** Fourteen powers, one picked per copy. Each is a timed state (scene or "until your next turn")
  with its own action cost and Power cost, canvas point picks, a granted natural weapon, an aura Defense +5 within
  5 ft, damage negation, and invisibility that ends on an attack or on damage. *Needs:* a Use that branches on a
  per-copy choice, plus canvas point steps.
- **Ninja Storm Wind Ranger (the rest of the partial).**
  - The 3-round element, Air/Water Blast and the Duplication −1 Health.
  - The mind-control Snag: it is offered to whoever targets the Ranger, and needs an `incoming` DialogSwitch.
    DialogSwitch has no incoming scope.
- **Movement rules are not an option for Ground changes made in the derived pass.** A Movement rule (even at the
  `final` stage) runs before gravity (Low Gravity +10, Zero-G) and before Climb/Swim take half of Ground. That is why
  Cheetah and Ninja Storm use DerivedStat. Additional Pair of Limbs' +10 and Carapaced's +20 Ground can't use
  DerivedStat either: tf3's Rotor Blades reads Ground between `ruleDerived` and their old hooks, and a Transformer
  can hold both. *Needs:* a DerivedStat stage that runs after the hand-written derived hooks.

#### zord1: Purple Ranger

- **Emotional Range.** The list of known options on the actor, topped up by a picker that `emotional-mastery.mjs`
  asks. *Needs:* a list ChoiceSet that grows with a Role Points value, read by that helper.
- **Emotional Strength.** Eleven triggers:
  - an ally's or an enemy's Critical Success or Fumble;
  - an ally gaining any Condition;
  - a failed Group Test;
  - a roll total of exactly 2 or of 25+;
  - a failure on a roll that had ↑1 or was assisted.

  All of them share one per-scene flag with the Anger trigger in `emotional-mastery.mjs`, and Team Spirit lends
  options. *Needs:* Trigger events for other actors' rolls and Conditions, a Group Test event, and a roll-total
  outcome.

#### zord1: Zord-side Perks and Features

- **Rex Feature.** A Zord Feature picker onto the Ranger's own Zord (from `system.actors`), skipping held Features.
  *Needs:* a `pickGrant` recipient for "my owned Zord" and an "exclude held" filter.
- **Additional Zord.** Auxiliary Zord plus two picks onto a chosen Zord, and a veto on summoning a second Zord in the
  same scene. *Needs:* the owned-Zord recipient, plus a pre-update veto.
- **Terrorzord Nature.**
  - Smarts 5 / Social 4 on the owner's Zord, which is not a crewed link.
  - Terror spent from the pilot on the Zord's rolls.
  - Power lost on a Fumble while driving.
  - The turn-start control card.

  *Needs:* an `ownedZord` link scope, and a `spend` switch paid from the linked pilot.
- **Anti-Armor.** It writes traits onto a picked weapon, and its Critical Effect lowers the target's armor for the
  scene. *Needs:* an armor-shred CriticalOption effect.
- **Phantom Focus: Ship Integration.** A per-scene link stored on the ship, which lends the pilot's Phantom Suite
  (↑1 + Edge, the Evasion bonus) and Unseen Strike's halving. *Needs:* a timed link from the driver to the vehicle,
  read by `driven`-scope rules.

#### zord1: Megaforms

- **Multi-Megaform, Signature Finishing Move, Advanced Signature Finishing Move, Power Master, Target Master.** These
  read the Megaform's roster: they swap traits, multiply damage ×4/×5 on a hit, roll a check per participant, and
  mirror items. *Needs:* Megaform roster links. This is out of the engine's scope for now.
- **Accurate Combiner, Assault Weapon.** Keyed by Megaform Trait type and by which participant's attack is used.
  *Needs:* the same roster pieces.

#### zord1: Bodies

- **Enlarged, Shrunk.** The size class is written when the item is added and reverted when it is removed, and an
  armor-equip veto checks for the Accommodation Upgrade. *Needs:* a DerivedStat for the size class (it is text, not a
  number), plus an equip veto.
- **Revolutionary Shape-Shifting.** A typed creature, a size step and a scene-long ↑1 switch. *Needs:* a text prompt
  step and a size-step step.
- **Additional Pair of Limbs.**
  - The Alt Mode +10 Ground: see the ordering reason above. Rotor Blades (tf3) reads Ground between `ruleDerived` and the old hook.
  - The unarmed ↓1: needs the number of targeted tokens, and there is no `roll:targets>=2` tag.
  - The Bot Mode stand-up: a row in a mode picker.

#### zord2: Combiners (Enigma of Combination)

- **Gestalt Combiner, Matched Combiner, Universal Component.** The merge Use:
  - Energon cost by team size, Story Points per NPC component.
  - A pending merge on the Combiner form, resolved by Reach when the round ends.
- **Efficient Combination, Invigorating Connection, Macro-Magnetic Linkage.** Read by that merge code.
- **Gestalt Hunter.** It changes what the shared "focus a component" checkbox does (↓1 instead of its Snag).
  *Needs:* a rule that can change another switch's effect.
- **Safe Release, Core Body (EoC), Titan Hardpoint, Enhanced Attack (EoC), Universal Receptors.** These are Megaform
  Trait types read by the merge, break-apart and generated-attack code.

#### zord2: Power Rangers Zords

- **Enhanced Melee Attack, Enhanced Ranged Attack.** Generated weapons on the Megaform, used once per scene per copy.
- **Warrior Mode (size).** Sets the Zord to Towering, which is text. *Needs:* a size DerivedStat.
- **Mesh Zord.** Three picks stored in a flag list, Towering size, and a Core Body doubling that steps aside inside
  a Megaform.
- **Power Matrix.** A reserve that scales with the number of copies, drawn to the driver and refilled when the pilot
  rests.
- **Versatile Combiner.** A Trait granted by the owner's spectrum colour, taken from the Role's name.
- **Adaptable Future Tech.** A combine-eligibility check. Its Combiner grant is already a rule.
- **Zord Feature (slot).** A Torozord-style ChoicesSelector onto the Ranger's own Zord.
- **Zord Ultra Mode.** Features' Active Effects are switched on and off, used once per scene, and end when the
  character is Defeated.
- **Defender Torozord.** It creates a Megaform actor.

#### zord2: Gear and Transformers

- **Shinobi of the 63rd Hexagram.**
  - The Defense picks enable two of four Active Effects. A Defense rule's `defense` can't be a ChoiceSet pick.
  - The motorcycle untrained-Snag immunity tests the piloted vehicle's name. *Needs:* a `vehicle:name~` tag.
- **Rotary Blade (weapon), Rotary Blade (shield).** A mode swap that grants and equips the shield. The weapon can't
  attack while the shield is in use.
- **Dozer Blade (Alt Mode).** Deletes a single-square Rough Terrain Region, or asks the GM on the chat card.
- **Mercurial Nature.** When added, it grants a Hybridization unless one granted by this item is already there. A
  Grant rule's `skipIfOwned` would also skip one bought separately. Unlimited Mass Shift is read by the daily pool.

### Engine pieces the skips need

1. **A late derived stage**: DerivedStat applied after the hand-written derived hooks. This would let Additional
   Pair of Limbs' and Carapaced's Ground convert (Mesh Zord also needs its flag-list picks).
2. **The Form lifecycle**: a Morph-time choice between held Forms (with costs), plus un-equip / restore and
   grant-until-ended steps.
3. **Hit-time damage-type overrides and per-hit rider options** (Solar Power, Supersonic, Signature Finishing Move).
4. **An `incoming` DialogSwitch** (Ninja Storm), and a way for a rule to change another switch's effect (Gestalt
   Hunter).
5. **A `@count.items:<tags>` formula ref** (Supersonic's armor ↑).
6. **Trigger events on other actors' rolls and Conditions, a Group Test event, and a roll-total outcome** (Emotional
   Strength).
7. **An owned-Zord link scope and recipient** (Terrorzord, Rex Feature, Additional Zord, Zord Feature slot).
8. **Text-valued DerivedStat for the size class** (Warrior Mode, Mesh Zord, Enlarged/Shrunk, Change Size).
9. **Megaform roster reading** (participants' traits, generated attacks, merges). This is a larger design.
10. **The `vehicle:name~` and `roll:targets>=N` tags** (Shinobi, Additional Pair of Limbs).
11. **Use precedence**: a rule Use on an item that also has an extension Use is hidden. Turbo Cart, Time Force's
    gear rows and Hybridization's H buttons could become rule Uses once the extension Use is split.

### Files touched outside the slices

- `module/dice.mjs`: removed the Ranger Operator ↑1 block, `RANGER_OPERATOR_ID` with its comment, and the
  `isFormActive` import.
- `module/dice.test.js`: removed the Ranger Operator describe.
- `module/rules/conversions.test.js`: the `// slA zord` block, appended at the end. The Toughness expectation in the
  existing Ranger Operator Evasion test changed from 12 to 14.
- `lang/en.json`: two keys removed.
- Pack sources: Ranger Operator, Time Force (jttitems); Beast Morpher, Ninja Storm Wind Ranger (bthitems); Supersonic, Megafauna (atsitems);
  Hybridization (tfcrbitems); Primate ×2 and Carapaced ×2 (tsitems).
- `extensions/index.mjs` is unchanged: no slice file became empty.

---

## Batch slA, slice pr1: `module/helpers/extensions/pr1/`

**Scope:** every item in the pr1 id table (`PR1` in `extensions/pr1/common.mjs`): A Jump Through Time, Across the
Stars and Beneath the Helmet items. Each was checked against the slice's code and every other use of its id in
`module/`. `PR1.combiner` is not a pr1 item. It is the Combiner Feature's id, which Warzord's reminder reads (pr2 and
zord2 keep their own copies), so it is not counted.

**Counts** (20 items):

| Verdict | Items |
|---|---|
| Convert | 1 |
| Partial | 2 |
| Skip | 17 |

9 rules were added to 3 pack items. After this slice `scripts/check-rules.mjs` counts 1312 rules on 947 items.
No slice file became empty, so `extensions/index.mjs` is unchanged.

### Converted (1)

| Item | Rule |
|---|---|
| Chronicler (Hang-Up) | A DialogSwitch `key: chronicler`, `forget: true`, offered when `not:item:type:weaponEffect`. An `afterRoll` Trigger with `outcome: allFailed` and `roll:switch:chronicler` applies `impaired` for 10 rounds. |

Removed: the Chronicler dialog toggle, its apply-dialog hook and `chroniclerPostRoll` (`jtt.mjs`), the now-unused
`registerPostRoll` import, `PR1.chronicler`, and the strings `E20.Pr1ChroniclerToggle` and `E20.Pr1ChroniclerImpaired`.
The rule's switch label is the old toggle text.

**Why it's exact:** the old code required at least one result with none of them successful. `allFailed` checks the
same thing (`results.length > 0 && every !success`). Both the switch and the Trigger use the same hooks as the old
code (`extDialogToggles` / `runApplyDialog` / `runPostRoll`), Initiative included. The Condition still goes through
`applyTimedCondition(actor, 'impaired', 10)`.

### Partial (2)

| Item | Converted | Stays code |
|---|---|---|
| Advanced Dino Gem Integration | The pick stays in the existing flag `flags.essence20.pr1DinoGem`. Its picker and Use button stay code. The rules read the flag with `rule:data:flags.essence20.pr1DinoGem=<option>`. **Sense:** ↑2 on Alertness for the Zord (`self:type:zord`) and its driver (`scope: pilot`). **Stealth:** ↑2 on Infiltration, the same two ways. **Shield:** `scope: incoming`, a Snag on attacks with `item:type:weaponEffect`, `attack:ranged` and a set `classification.style` (the old `isRanged`) against a Zord. Each option has a `stack` group, so two copies with the same pick still give one bonus, as `dinoHas` did. Removed: `dinoSources`, `zordFor`, their roll-source registration, `E20.Pr1DinoStealthLabel`, and the `dinoSources` lines of its pr1 test. | Primordial Power: its +2 is a flat post-hit `damageBonusNote`. A DialogSwitch `damage` is scaled by Degrees of Success, and an unscaled dealt DamageModifier's `when` isn't handed the switch keys. Stealth's +10 ft Movement is added at the end of derived data, only to speeds above 0 and after gravity. Genetic Resonance's summon-round change. The picker. |
| Lightspeed Boost | Medical's ↑2 on Science / Technology. The pick stays in `flags.essence20.pr1LightspeedBoost.option` and is read with `rule:data:`. One rule covers the Zord itself (`self:type:zord`) and one covers everyone seated in it (`scope: crew`), sharing a `stack` group. Removed: that block of `atsSources`, the `seatsOf` import and `E20.Pr1LightspeedMedicalLabel`. | Everything else: Aeronautic / Aquatic speeds and their +2 Evasion by token elevation, Medical's +10 ft, Hazmat / Pyrotechnic Resistances and Immunities, the Pyrotechnic Use button, and the picker (see the skips below). |

### Behaviour differences

1. **Chronicler's chat line** is now the rules' own: the Trigger label "Failed a chronicled recall (Chronicler:
   Impaired)" plus the Condition line. It used to be the `Pr1ChroniclerImpaired` sentence.
2. **Chronicler's "pending" state is tied to the roll.** The old flag was set in the dialog and cleared at the next
   roll's pre-roll hook. A roll that skipped that hook but still ran the post-roll hook could pick it up and apply
   Impaired to the wrong roll. The ticked switch's key now travels with its own roll only.
3. **A Hang-Up the Matured Perk lets the holder ignore** (`maturedIgnored`) no longer offers Chronicler's switch.
   Rules skip such items, and the old `has()` check did not.
4. **Labels:** Stealth's source is "Moving quietly (Advanced Dino Gem Integration: ↑2)" and Medical's is "Medical
   (Lightspeed Boost: ↑2)". Sense and Shield keep the item name. Rule sources are listed after the hand-written
   extension sources, which changes only their order in the dialog.
5. **Who counts as seated** comes from `rules/links.mjs#crewedBy`: the first Zord or vehicle the actor appears in,
   and a seat without a `vehicleRole` counts as a passenger. The old `seatsOf` looked at every seat that had a role.
   The two differ only for an actor seated in two vehicles at once.
6. **The Dino Gem driver bonus no longer checks that the vehicle is a Zord.** The `pilot` scope can't see the
   holder's type, because `rollRules` passes no `holder`. The old code required a Zord. It only matters if this Zord
   Feature is put on a plain vehicle.

### Skipped (17), and what each needs

| Item | Why it can't convert (missing engine piece) |
|---|---|
| Mobile Headquarters (rest; its crew ↑1 was already a rule) | **The holder's own Initiative Edge** is derived data (`system.skills.<initiative skill>.edge = true`). DerivedStat only writes numbers. A RollModifier would instead add a listed source the player could untick. **The Megaform half** (best component Initiative, with Edge) needs a Megaform-to-component link. **Edge at Initiative for every allied Zord or vehicle in the scene** needs a scene-wide (not radius) aura that compares disposition and filters by actor type. |
| Overdrive | **The cost** is paid by a seated crew member (a picker over those with Personal Power max 4+), not by the Zord. **The choice** is up to three *different* options per turn. **The effects** are a +1 damage note for Energy damage types this turn, +20 ft Movement at the end of derived data this turn, Accurate used up by one ranged attack, and a pilot ↑2 switch until their next turn. Needs a Use paid by a linked actor, a per-turn "options already taken" memory, and per-turn derived/hit effects gated on it. |
| Profiteer (Hang-Up) | The ↓1 lasts 10 rounds of the combat it started in, or the rest of the scene when it started out of combat. No `until` covers that. Needs `until: {rounds: N}` (or "N rounds, else the scene") for marks and banks. |
| Prospector Toolkit | It banks a bonus *die* (1d4, or 1d8 after a DIF 16 Survival test) onto the next Wealth Test, through the More Heads bonus-die bank. A Wealth dialog that is then cancelled puts it back. Needs a `bank` step carrying a bonus die. |
| Spectrum Shifted | Role-change logic (`sheet-handlers/role-handler.mjs` asks `spectrumShiftedRetains` / `afterSpectrumShifted`). No rule type says what an old Role keeps. |
| Time Displaced (Use half; its ↓2 was already a rule) | A picker over the Continuum Anomaly risk dice, rolling the chosen die one size larger as a blind roll. Needs a step that rolls a formula (with a die-size step) to a blind chat card. |
| Warhead Magazines | Three damage types picked per copy, a dialog *select* on the Zord's Area attacks that costs a Free action, and an "apply as this type" button on the hit card. Needs a multi-pick ChoiceSet, a select switch with an action cost, and a rider-option step. |
| Be an Example | The ↑1 banks onto the actor's Origin Skill (`system.originSkillsIncrease`, with a Skill picker as fallback). A bank's `appliesWhen` can't name a Skill held in actor data. Needs a `skill:data:<path>` tag, or `appliesWhen` interpolated when it is banked. |
| Destiny (Hang-Up) | A GM-only button on a failed roll's card that spends a GM Story Point and turns the failure into a Fumble, once per scene. Needs a chat-card action rule and a Fumble conversion. |
| Lightspeed Boost (rest) | **Aerial / Swim at least 40 ft and Medical's +10 ft** run at the end of derived data, only on speeds above 0. A Movement rule's `final` stage comes before gravity. **+2 Evasion** depends on token elevation: needs an elevation tag. **Hazmat / Pyrotechnic** set boolean Resistances / Immunities, which DerivedStat can't. **The picks** include sub-choices (how, which types). **The Pyrotechnic button** shares the item with the picker's Use. |
| Nemesis (Specific Threat) (the reroll; its ↑2 is `items/rolls/nemesis.mjs`) | A once-per-scene chat-card reroll that shows the new total against every DIF. Needs a chat-card reroll rule. |
| Power Flux | It fires on a new scene, for Zords with a token on the canvas, and tops up each crew member's Personal Power by up to 6. Triggers only fire for actors that hold Trigger rules, and no step reaches a vehicle's crew. Needs `to: "crew"` (or `sceneStart` Triggers reaching linked actors) and an "on the canvas" tag. |
| Power Wing (rest; its +2 maximum was already a rule) | Current Personal Power ±2 when it is equipped or unequipped. Needs equip / unequip Trigger events. |
| S.W.A.T. Upgrade (rest; its Edge was already a rule) | **Incapacitation Ammo:** a switch whose hit offers Stun damage one higher. Needs a rider-option step. **Incarceration Protocols:** 6 per scene, counted on enemies defeated by the Zord's attacks. Needs a "defeated by this actor's attack" event and a counter. |
| Stand Behind Me! | Turn-start DIF 14 Alertness buttons for enemies within 60 ft. One that fails can't attack anyone else (its roll is cancelled). Needs a roll-cancelling / forced-target rule. |
| Tactical Size Shift | **The direction** is picked once and locked across copies. **Picking** creates an Active Effect and steps a chosen Skill up a die (undone on delete). **Size** shifts with clamps. Needs a text-valued DerivedStat for size and per-item persistent picks. |
| Warzord (rest; its damage and Active Effects were already rules) | **Titanic size** is text (DerivedStat writes numbers) and must land after Tactical Size Shift. **The Combiner Story Point reminder** needs a Megaform-combines event. |

---

## Batch slA, slices pr2 and pr3

**Scope:** every item in the id tables of `module/items/shared/ranger-leftover-item-ids.mjs` (`PR2`) and
`module/items/shared/pr-crb-ttsg-item-ids.mjs` (`IDS`). That covers all the code in those slices that uses each id, and
every other place in `module/` that calls into them (`combiner-timer.mjs`, `vehicle-defeat.mjs`, `zord-summon.mjs`).
Helper ids that only support another item are counted with that item: `combiner` and `carrier` with Dedicated
Carrier, the Flames of Hate weapon and its two effects as one item, and the Incineration Blast weapon and its effect as
one item. Power Ranger Standard Issue is matched by name, not by id, so it isn't counted. Nemesis Drain's scene clear
reads a flag, not an id, so it isn't counted either.

**Counts:**

| Verdict | Items |
|---|---|
| Convert | 4 |
| Partial | 0 |
| Skip | 29 |

**Totals:** 5 rules were added to 5 pack items. After this batch, `scripts/check-rules.mjs` counts 1308 rules on 948
items.

### Converted (4)

For each item, its code is gone from the slice, along with its id-table key (unless the code that stays still needs
it) and its slice test. The behaviour is now tested in `module/rules/conversions.test.js` and
`conversions-uses.test.js`, in the `// slA pr2/pr3` sections.

| Item | Rule | Note |
|---|---|---|
| Keen Eye (PR CRB) | RollModifier on the Perk: Edge on Alertness when `roll:specialization~perception` | Was the `applyDialog` hook in `pr2/perks.mjs`. The Perk's existing Use rule stays. `PR2.keenEye` is removed. |
| Megaform Trait (PR CRB, Zord Feature) | Use: `pickGrant {type: megaformTrait}`, then `setToggle granted` | Once ever, gated by `not:self:toggle:granted`. Also gated by `not:rule:data:flags.essence20.pr3Granted`, so Features already used under the old code keep the button hidden. `IDS.megaformTrait` is removed. |
| Unique Weapon (Versatile Melee) | RollModifier ↑2 on both of the weapon's effect items (Might, Finesse): `attack`, `weapon:source:<the weapon>`, `target:sizeDiff>=3`, `stack: uniqueWeaponVersatile` | The rules sit on the effects, not the weapon. Weapon rules turn off while the weapon is unequipped, and the old code didn't care about that. The stack group counts the two effects' rules once. `IDS.uwVersatile` stays because the Unique Weapon Use still grants this weapon. `sizeIndex` and the `parentWeaponOf` re-export are removed from `pr3/common.mjs`. |
| Jungle Fury Rhino Sentry Shield (TtSG) | RollModifier `scope: incoming`, ↓2: `attack:ranged`, `rule:data:system.equipped`, `rule:data:system.active`, `not:self:status:cover`, `not:self:status:totalCover` | `IDS.rhinoShield` and the lang key `E20.Pr3RhinoCover` are removed. |

### Behaviour differences

1. **Keen Eye's Edge arrives before the dialog.** The old Edge was set silently after the dialog. The rule's Edge is
   now a named automatic source in the Roll Options Dialog, and the player can untick it, the same as every
   converted source (regA, "Edges arrive earlier"). The old code turned an existing Snag into "no Snag, no Edge";
   now the Edge and the Snag cancel when the roll is made. One case differs: an `applyDialog` hook that runs later
   and adds a Snag (PR's `giveSnag`, Grappled). Before, that Snag survived. Now it cancels against Keen Eye's Edge.
   Post-dialog checks that read the Edge also see it earlier.
2. **Megaform Trait's chat line is now the rules card.** The card says "Granted ..." instead of the old
   "X gains Y from Z". One more change: if the picked compendium entry can't be created, the button is still used up.
   The old code left it available.
3. **Unique Weapon (Versatile Melee)**:
   - The source's label is the rule's label, not the weapon's name.
   - The ↑2 needs at least one of the weapon's own effects on the actor. They always come with the compendium
     weapon. A custom effect added to that weapon still gets the ↑2, through `weapon:source:`.
   - If the actor's or the target's size isn't in the size list, `sizeDiff` is unknown. The rule is then offered as
     an unticked switch. Before, nothing was offered.
4. **Rhino Sentry Shield:** only the label changes.

### Skipped (29)

#### Team-wide (pr2/team.mjs)

| Item | Why |
|---|---|
| Bend Physics | "Your team" means every Player Character in the world. No scope reaches that: `party` is a Party roster. The Movement doubling also runs in `registerDerived`, after `_applyGravityMovement` and after the Movement `final` stage. |
| Primal Rage | The same team reach. Its "unarmed" also counts a weapon or effect named "unarmed", which could be written as `{any: [attack:unarmed, weapon:name~unarmed, item:name~unarmed]}`. |
| Instructor | Needs a pick of a specialized Smarts Skill when the item is dropped, a student list that points at other world actors, and an untrained-Snag lift on those students (`roll-dialog.mjs`). |
| Aim Apparatus | Steps a Skill shift up on a picked self-or-teammate when the item is added, and back down when it is removed. No step does a persistent cross-actor Skill step. |

#### Zord Features (pr2/zords.mjs)

| Item | Why |
|---|---|
| Dedicated Carrier | Deletes the Zord's Combiner Features when it is dropped. There is no "remove items by source" step. The Carrier grant alone would be a Grant rule, but a Grant rule's lifetime isn't the same as the old one-off grant. |
| Dino Gem Integration, Energem Infusion | When dropped, they pick one of the Zord's ranged attacks and a spectrum colour, then edit that weaponEffect (type, damage, range) and flag it. No step picks and edits an owned weapon effect. |
| Dino Drive Mode | Needs Active Effects on a chosen movement type, a Speed penalty until the next turn starts, a scene-long state, a once-per-round 1d2 damage reduction against Energy damage, and an Edge near a Zord holding Energem Infusion. Formulas have no dice, and no tag matches "an ally within N ft holding item X". |

#### Finster's (pr2/finster.mjs) and Grid Relic (pr2/perks.mjs)

| Item | Why |
|---|---|
| Aura of Decay | Pays 1 Health before the Power's roll (`registerPreRoll`). There is no before-roll Trigger event. |
| Flames of Hate | Eight outgoing Defense rules could subtract `@target.system.defenses.<d>.armor` or `.morphed`. But `ruleDefenseAdjust` adds rule amounts before its `best` / `halve` reshaping, and the old adjustment landed after it, so the result differs against Evasive-style `best` Defenses. Needs an "ignore armor" Defense mode, or an add that lands after the reshaping. |
| Incineration Blast | A crit marks the target, which takes 1 Fire damage if its token moves on its own next turn. There is no "token moved" Trigger event. |
| Grid Relic Weapon | Builds a weapon that isn't in a compendium from data, after a Might/Finesse pick. There is no "create an item from data" step. |

#### PR CRB (pr3/pr-crb.mjs)

| Item | Why |
|---|---|
| Megaform Expeditor | A 1d4 off the Megaform join time, read by `combiner-timer.mjs`. There is no rule hook there, and formulas have no dice. |
| Ninja Power | Its Use shares a button with the on/off state in `ninja-power.mjs` (Power upkeep). The ↓1 after a jump could be a mark plus an incoming RollModifier, but the switch's state isn't rule data. |
| Peerless Pilot (PR) | The automatic pass on an emergency disembark is read by `vehicle-defeat.mjs`. No rule type covers it. |
| Power Heal | Its one button either runs `power-handler.mjs#powerCost` or removes a negative Condition picked from a list on a picked creature. There is no step for either. |
| Survivor | Reacts to Smarts dropping to 0, with a d20 roll. There is no event for an Essence change. |
| Unique Weapon (Green Ranger) | Offers "roll randomly" (1d4) alongside the four choices. A `choose` step has no random option. |
| Unique Weapon (Ranged) | Stores Power in a flag. Drawing it back isn't capped at the maximum, but `gainResource` is. A Fumble costs 1d4 Power, and formulas have no dice. |
| Unique Weapon (Small Melee) | Halves the Zord summon time in `zord-summon.mjs`. There is no rule hook there. |
| Unique Weapon (Two-Handed Melee) | The −10 to every Movement runs in `registerDerived`, after gravity and after Bend Physics doubles Movement. The Movement `final` stage comes before both: with Bend Physics, the old result is 2x−10 and the rule's would be 2x−20. Needs a Movement stage after the derived hooks. |

#### Through the Shattered Grid (pr3/ttsg.mjs)

| Item | Why |
|---|---|
| Elemental Fury | Builds a temporary weapon from the Zord's strongest ranged attack, removes it once rolled or at a new scene, and adds element crit riders. |
| Overload | A 1d2 Health cost (formulas have no dice), and an Edge on every attack for the rest of the turn. |
| Power Construct | Adds an alternate rider option on melee hits. It also retaliates by reading `react/core.mjs#lastApplyContext`, and posts a message at 0 Health. |
| Restraining Gear | A chat button for an opposed Brawn/Might roll. The Power is paid by the pilot, and it is shared through Megaform participants. |
| Zord Mount | Picks a rider Zord, and posts a note on the mount's first melee attack each turn. |
| Emissary's Gift | `pickPerk {from: role, line: pr}` offers every Power Rangers book's Roles. The old picker offers only the PR Core Rulebook's. Needs a pack filter on `pickPerk`. |
| Morphin Navigator | A Grid Power Bloom: 1d2 Personal Power for each team member (`story-points.mjs#gridPowerBloomResults`), once per mission. |
| Protector of Safehaven | Picks a boon once per mission. The upgrade and Social dialog ticks are offered only for this mission's boon, and the Temporary Health goes through `resource/temp-resources.mjs`. No `until: mission` exists for toggles, and there's no temp-resource step. |

### Engine pieces the skips need

1. **Dice in formulas, or a dice step** (`1d2`, `1d4`, a d20 check): Overload, Unique Weapon (Ranged), Megaform
   Expeditor, Dino Drive Mode's Reflective Armor, Survivor, Morphin Navigator, Unique Weapon's random pick.
2. **A "team" scope** (every Player Character in the world): Bend Physics, Primal Rage, Instructor, Aim Apparatus.
3. **A Movement stage after the derived hooks / gravity:** Unique Weapon (Two-Handed Melee), Bend Physics.
4. **Item-changing steps:** remove items by source (Dedicated Carrier), pick and edit an owned weapon effect (Dino Gem
   Integration, Energem Infusion), create an item from data (Grid Relic Weapon, Elemental Fury).
5. **New Trigger events:** before a roll (Aura of Decay), a token moving on its own turn (Incineration Blast), an
   Essence dropping to 0 (Survivor).
6. **A Defense "ignore armor" mode**, applied after `best` / `halve`: Flames of Hate.
7. **A pack filter on `pickPerk`:** Emissary's Gift.
8. **Hooks in other helpers:** the Megaform join time, emergency disembark, the Zord summon time.

### Files touched outside the two slices

- `module/rules/conversions.test.js`, `module/rules/conversions-uses.test.js`: new tests appended at the end.
- `lang/en.json`: `E20.Pr3RhinoCover` removed (one line, edited as text).
- Pack sources: `prcrbitems` Keen Eye, Megaform Trait, the two Unique Weapon (Versatile Melee) effects, and
  `ttsgitems` Jungle Fury Rhino Sentry Shield.
- `module/items/index.mjs` is unchanged: none of the slice files became empty.
