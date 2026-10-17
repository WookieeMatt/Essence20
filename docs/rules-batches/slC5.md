# Batch slC5: re-check of slC4's skips (`gij1`, `gij2`, `gij3`, `fix3-gij`, `situational1`, `situational2`) against the round-5 engine pieces

**Scope:** every item `docs/rules-batches/slC4.md` left **Still skip** (83) or **Partial** (5) in the six slC slices,
re-checked against the guide's section "Engine features added 2026-10-05 (round 5, after the local round-4
conversions)": `target:ally|enemy`, `var:` tags, `vehicle:data|name~`, `terrain:set`, `environment:outside:`, the
position checks (`check:inWater|onLand|seaOrWetlands|aboardAquaticVessel|completeDarkness`, backed by
`situational2/common.mjs`), `@host`, text interpolation, `to: party|team`, `updateActor`, `require`/`beforeCost`,
`setTargets`, `writeInitiative`, `table`, wielded selectors, `overMax`, optional `bonusAttack`, `bank replace`,
`pick filter|auto`, DerivedStat `{choice}` paths and booleans, `consumeMark`, Movement `afterGravity`, the new
Trigger events and `plainFailure` / `anySucceeded`. The earlier sections were checked again too, and the two
already-converted items slC4 named (Energy Resistant, Expert Knowledge) were revisited. Edited in place in the shared
checkout (no branch, no commit).

| Verdict (re-checked items) | gij1 + fix3-gij | gij2 | gij3 | situational1 | situational2 | Total |
|---|---|---|---|---|---|---|
| Convert (now fully rules) | 1 | 1 | 0 | 2 | 6 | **10** |
| Partial (a part converted this round) | 1 | 0 | 0 | 1 | 3 | **5** |
| Partial, nothing more converts | 0 | 0 | 0 | 3 | 0 | **3** |
| Still skip | 15 | 11 | 17 | 14 | 13 | **70** |
| Re-checked | 17 | 12 | 17 | 20 | 22 | **88** |

Also re-checked and improved (converted in slC4): **Energy Resistant** (7 DerivedStats became 1) and **Expert
Knowledge** (one of its two edge cases is now exact).

After this part, `scripts/check-rules.mjs` reports no errors or warnings on my items (1807 rules on 1146 items in the
shared checkout; its only 2 errors are on Desperate Parry, another agent's item). ESLint is clean on every file touched.
Jest passes on the six slice folders, `module/rules/conv5-slC5.test.js`, `conv4-slC4.test.js`,
`legacy-choices.test.js` and `engine5.test.js` (127 tests). No slice file became empty, so `extensions/index.mjs` is
unchanged.

## Converted

### Fully rules now (10)

| Item | Rules | Why it is exact |
|---|---|---|
| **Seafarer** (Perk, situational2, `packs/qgtgitems/_source/Seafarer_vZjp9ncpzhgLIzSm.json`) | Added to its Driving rule: a RollModifier Edge `when: [skill:athletics, check:inWater, not:roll:initiative]`, and a DialogSwitch Edge `when: [skill:athletics, not:check:inWater]`, `forget: true`. | The old roll source gave Edge on Athletics when `isInWater` held; otherwise the dialog offered an unticked checkbox that set `edge`. `check:inWater` is that same function. Slice roll sources never ran at Initiative (dice.mjs calls only the rules' sources there), hence `not:roll:initiative`; slice checkboxes did, and so does the DialogSwitch. `forget` keeps the box starting unticked. |
| **Tritium Sights** (situational2, `Tritium_Sights_dyNyzaagojOboB3y.json`) | A host-scoped DialogSwitch ↑1, `when: [attack, check:completeDarkness]`, `defaultWhen: [check:completeDarkness]`, `forget: true`. | `isCompleteDarkness` answers true (full scene darkness) or null (can't tell), never false. Before, true gave an automatic ↑1 source and null an unticked checkbox. Now true pre-ticks the switch and null leaves it unticked (the City Slicker pattern). The host scope reaches the attacks of the weapon it is attached to, as `weaponHasUpgradeId` did. |
| **Rifle (Tritium Sight)** (situational2) | None of its own. | Its compendium entry brings its own attached Tritium Sights upgrade (`system.items.a040`), whose rule now does the work the rifle-id branch of `hasTritium` did. |
| **Amphibious Assault** (situational2, Initiative half) | A RollModifier ↑1 `when: [roll:initiative, check:inWater]`, added to its two Movement rules. | `situationalInitiative` added ↑1 when `isInWater` held. Initiative reads RollModifiers with `roll:initiative`. |
| **Tracking Outfit** (situational2, Initiative half) | A RollModifier ↑1 `when: [roll:initiative, terrain:set, terrain:wild]`. | The old check was worn gear (rules switch off for unequipped gear) and `isWild === true` (a terrain is set and isn't urban). `terrain:set` makes an untagged scene answer "no" instead of asking. |
| **Feet Wet** (situational2, was partial) | Added to its at-sea MovementAction: Edge on non-attack rolls and Specialized attacks, each twice: once `[terrain:set, terrain:sea]`, once `[check:aboardAquaticVessel, {any: [not:terrain:set, not:terrain:sea]}]` (so the two never both apply), plus a MovementAction for aboard an aquatic vessel. Edge rules carry `not:roll:initiative`. | `isFeetWetActive` was "at sea, or aboard an aquatic vessel, or in wetlands with Ship Shape". The wetlands case is on Ship Shape (below). The Edge source, `situational2Specializes` and the `ROUGH_TERRAIN_IGNORERS` entry are all gone. |
| **Spacewalker** (situational1, was partial) | A Defense `evasion`, `amount: 5`, `when: [{any: [environment:outside:lowGravity, environment:outside:zeroGravity]}]`, no label (so the sheet string still reads "+ 5 (Spacewalker)"). | The old derived block read the environment without a vessel interior, which is what `environment:outside:` reads. Static Defense rules are added on the sheet. |
| **Environmental Camouflage** (situational1, `packs/fffav1items/_source/Environmental_Camouflage_SyHx2pheoELFpvTF.json`) | A Toggle `inEnvironment` (`legacy: "flags.essence20.s1InEnvironmentNow"`). A Use "Choose the environment": `pick environment` over the eight terrains (`legacy: "flags.essence20.s1Environment"`). A Use "In or out of the chosen environment", only on a scene with no terrain set and with a pick made: flips the toggle and posts a line. Four Defenses: Evasion gets `@host.system.totalBonusToughness * (1 - @host.system.isPowerArmor)`, Toughness gets the same with `totalBonusEvasion`, each once with `[terrain:set, terrain:{choice.environment}]` and once with `[not:terrain:set, rule:data:...choices.environment, self:toggle:inEnvironment]`, all also `[self:type:playerCharacter, not:self:morphed]`. | The old derived block applied to player characters not Morphed, for the upgrade on worn armor (rules switch off with the armor; a loose upgrade has no host, so `@host` is 0 and nothing is added), with an environment chosen, in that terrain or (untagged scene) with the flag on, and never for Power Armor (the `(1 - isPowerArmor)` factor). The string label is the item name, as before. |
| **Sea Legs** (gij1, `packs/ccitems/_source/Sea_Legs_mKsSa2HBOimHqS7i.json`) | Two Movement rules on `swim` at stage `afterGravity`, both `op: set`: `@actor.system.movement.swim.total + 15` when `self:data:system.movement.swim.total>0`, and `30` when it isn't. | The old derived hook ran after gravity and set 30 or +15 on the finished total. Both conditions read the stored total before the stage writes, so exactly one applies (two copies of the Perk still give one bonus, as `hasSourced` did). Using `set` rather than `add` keeps the old order against Shark's Fin's doubling (set runs before multiply in a stage; gij1's hook ran before situational2's). |
| **Mentor** (gij2, `packs/gijcrbitems/_source/Mentor_jUZrNJbPzSd1zVLa.json`) | An `added` Trigger and a Use with the same steps: `pick skill` (`from: skill`, `legacy: ...gij2Mentor.skill`), then one of five `pick essence` steps (`from: list`, `legacy: ...gij2Mentor.essence`), each with `when: [{any: [var:picked=<skill>...]}]` for the Skills of one Essence and offering the other three (all four for Spellcasting / Weird). A DerivedStat `system.skills.{choice.skill}.essences.{choice.essence}` = `true`. | The old chooser asked the Skill, then every Essence but that Skill's own (`CONFIG.E20.skillToEssence`), on `createItem` for the adding user and on the Use, and the derived hook set the flag to `true`. The `added` Trigger fires for the adding user, after the item's state is set up. With no pick (or only the Skill) the DerivedStat path doesn't fill, so nothing changes, as before. |

### Partial (5)

| Item | Converted | Stays code, and why |
|---|---|---|
| **Seafarer (Hang-Up)** (situational2) | An incoming RollModifier Edge `when: [check:onLand, {any: [item:data:system.damageType=poison, weapon:data:system.isPoison, item:name~<word>, weapon:name~<word> for poison/venom/toxi/disease/illness/sick/plague/infect]}]`: the old `isPoisonous` test word for word. | The Snag on its own resisting rolls needs to know a roll is a save against a poison (`isPoisonSave` parses the save rider's spec). Its checkbox stays with it, since that box is offered only when the roll is not such a save. |
| **Ship Shape** (situational2) | Feet Wet in wetlands: Edge / Specialized / no Rough Terrain `when: [self:hasItem:<Feet Wet uuid>, terrain:set, terrain:wetlands]` (the two roll rules also `not:check:aboardAquaticVessel`, so Feet Wet's own aboard rule isn't doubled). The vehicle half: the same three with `scope: driven`, `when` the vehicle has Aquatic Movement (`swim.base > 0` or `swim.total > 0`, as `isAquaticVehicle`). | The vehicle's Movement x1.5 rounded down. A Movement multiply rounds to nearest (25 x 1.5 gives 38, the old code 37), and a `set` formula can't read the value being changed on another actor (in a `driven` rule `@actor` is the driver). |
| **Shark's Fin** (situational2) | Movement `ground` and `swim` x2 at stage `afterGravity`, `when: [check:seaOrWetlands]`. | The Initiative half (lift Surprise, post the move line). The `initiativeRolled` Trigger fires on any Initiative change (a GM edit, Queen's Gambit's reorder), not only when the roll is made, and after the roll rather than before its formula. |
| **Jungle Fighter** (situational1) | A Toggle `inJungle` (`legacy: "actor.flags.essence20.s1InJungle"`) and a Use that flips it, only on a scene with no terrain set. Edge on non-attack rolls, Specialized attacks and no Rough Terrain, each `[terrain:set, terrain:woodlands]` and `[not:terrain:set, self:toggle:inJungle]`. | Light armor counting as Silent (the summed armor bonus as ↑ on Infiltration) needs a formula summing over items, the same gap as Out of the Jungle. `isInJungle` now reads the Perk's toggle. |
| **Extract Poison** (gij1) | Six boolean DerivedStats: `system.qualified.poisons.{all,standard,limited}` when `self:data:system.qualified.poisons`, and `system.trained.poisons.*` when both exist. | The Use (a Science roll at the DIF of a picked compendium poison's Availability). The rules adapter's derived pass runs after gij1's, so Metier's poison-step recompute still comes first, as in the old single function. |

### Re-checked conversions (slC4)

- **Energy Resistant:** the seven per-Element DerivedStats are now one, `system.resistances.{choice.element}` = `true`.
  This also removes slC4's difference 4 (the value is `true` again, not `1`).
- **Expert Knowledge:** the "2 benefits" Trigger's outcome is now `["double", "anySucceeded"]`, so a Critical Success
  that missed the DIF posts nothing again (slC4's difference 2). Difference 1 (a Fumble that beats the DIF but not by
  double used to post "1 benefit") stays: it needs an outcome for "not double" to pair with `fumble` and `anySucceeded`.

### Removed code

- **situational2.mjs:** the Seafarer swim source, checkbox and apply; the Hang-Up's incoming poison source with
  `isPoisonous`; Tritium's source, checkbox, apply and `hasTritium`; Feet Wet's source, `isFeetWetActive`,
  `situational2Specializes` (with its `registerSpecializes`) and its part of `ignoresRoughTerrainS2`; Shark's Fin's
  derived doubling. The `updateToken` refresh no longer lists Shark's Fin. Instead it refreshes any actor whose item
  rules (Defense / DerivedStat / Movement) read a terrain, an environment or a position check (`hasPositionRules`), so
  Spacewalker, Environmental Camouflage and Shark's Fin keep following the token into and out of Regions.
- **initiative.mjs:** the Amphibious Assault and Tracking Outfit blocks.
- **common.mjs:** the ids `amphibiousAssault`, `rifleTritium`, `seafarer`, `feetWet`, `tritiumSights`, `trackingOutfit`,
  and `isWild`, `parentWeapon`, `weaponHasUpgradeId`. Kept: `isInWater`, `isOnLand`, `isSeaOrWetlands`,
  `isAboardAquaticVessel`, `isCompleteDarkness` (module/essence20.mjs registers the checks on them).
- **situational1.mjs:** `S1.spacewalker`, `S1.environmentalCamouflage`, `FLAG.inJungle`, `FLAG.inEnvironment`, the
  Spacewalker and Camouflage derived blocks with `addDefense`, the `s1-environmentalCamouflage` and `s1-jungleFighter`
  Uses, Jungle Fighter's Edge source and its parts of `situationalSpecializes` / `ignoresRoughTerrainS1`, and the
  `updateToken` hook (`TERRAIN_ITEMS`).
- **gij1:** `applySeaLegs` with its `registerDerived`, Extract Poison's block in `applyTraining`, `G1.seaLegs`.
- **gij2:** Mentor's chooser, `CHOOSERS`, the `createItem` hook, `perkDerived` with its `registerDerived`,
  `MENTOR_FLAG`, `skillLabel` / `essenceLabel`, `G2.mentor`, and the unused `registerDerived` / `itemsOf` imports.
- **Tests:** the slice tests for Seafarer swimming, the Hang-Up's poison Edge, Tritium, Feet Wet, Shark's Fin's Movement,
  the Amphibious / Tracking Initiative ↑1, Spacewalker, Environmental Camouflage, Sea Legs, Extract Poison and Mentor
  are gone or trimmed to what stays code (the Hang-Up's Snag and checkbox, Bookworm's Initiative ↓1, Jungle Fighter's
  noise via the toggle, Metier's poison step). New slice tests cover `hasPositionRules` and Contort's derived Reach
  (situationalDerived's only remaining block).

The new tests are in `module/rules/conv5-slC5.test.js` (29 tests). They load the pack items and register the position
checks on situational2's own readings, as `essence20.mjs` does. They cover what the old tests asserted, plus:
Seafarer's switch (unticked even when remembered on, not offered in the water, not at Initiative); every poison test
of the Hang-Up, and no Edge at sea, in the water, aboard an aquatic vessel or while Matured-ignored; Tritium's
pre-ticked / unticked switch, its weapon only, and the rifle's own upgrade; Feet Wet at sea, aboard (once), nothing
and nothing asked on an untagged scene; Ship Shape's wetlands (Feet Wet holders only) and its driven aquatic vehicle
(not a land vehicle, not a gunner's); Shark's Fin's doubling and its combination with Sea Legs; the Initiative ↑1s;
Spacewalker's string and the vessel interior; every Camouflage gate, its Uses and its legacy pick and toggle; Jungle
Fighter's terrain / toggle / Use / legacy; Extract Poison's two levels; Mentor's DerivedStat, its options per Essence
and its legacy pick; the Energy Resistant and Expert Knowledge changes.

## Behaviour differences worth a decision

Same-line unless marked cross-line.

**Tritium Sights**
1. **In complete darkness the ↑1 is a pre-ticked switch, not an automatic source.** The roll is the same unless the
   player unticks it (the old automatic source could also be switched off in the dialog).
2. **A Rifle (Tritium Sight) whose own Tritium Sights upgrade was removed** no longer gets the ↑1 (the old code also
   matched the rifle's id).
3. **Attacking with an unequipped weapon:** the upgrade's rule is off with its weapon. Before, it applied regardless.
4. **Wording:** the switch is the rule's own label instead of `S2TritiumLabel` / `S2TritiumToggle`.

**Seafarer / Seafarer (Hang-Up)**
5. **Wording:** the rules' labels instead of the item names and `S2SeafarerSwimToggle`.

**Feet Wet / Ship Shape**
6. **Edge on "non-combat" rolls** is now any non-attack roll. The old code also needed a rolled Skill, which every roll
   through the dialog has.
7. **Wording:** each case has its own label (at sea / aboard / wetlands / the vehicle you drive) instead of the item name.

**Shark's Fin / Sea Legs**
8. **Cross-line:** the doubling (and Sea Legs) now happen right after gravity, before every hand-written derived hook
   rather than among them. Hooks that change Ground or Aquatic Movement later (Power Rangers ATS's Aquatic floor of 40,
   the data22 Alt-mode gear, Zord body / feature bonuses) now apply after the doubling instead of before it. Shark's Fin
   with Sea Legs keeps the old order.

**Amphibious Assault / Tracking Outfit**
9. **The Initiative ↑1 is now listed in the Initiative dialog** as a source the player can switch off. Before, it was
   added silently after the dialog closed.

**Environmental Camouflage**
10. **The "in it now" state shows as a Toggle in the Rules tab.** Flipping it there is the same as the Use.
11. **Two Use buttons instead of one asking "toggle or choose"** on an untagged scene. The toggle button only shows on
    a scene with no terrain set and with an environment chosen. The chat lines are the rules' own.

**Jungle Fighter**
12. **The "in the jungle" state is a Toggle on the Perk** (moved from the old actor flag by `legacy` on the GM's
    linking pass). Until that pass runs, the old flag is not read.
13. **Wording:** the Use's chat lines are the rule's own instead of `S1JungleOn` / `S1JungleOff`.

**Mentor**
14. **Cancelling the Essence after picking the Skill keeps the Skill pick.** Nothing applies until both are picked,
    as before.
15. **Wording:** English prompts, and the engine's "Picked" lines are posted, including on add (the old add-time
    chooser posted nothing).

**All position-dependent rules**
16. **The Region refresh is now generic:** any actor with a Defense, DerivedStat or Movement rule that reads a terrain,
    an environment or a position check is re-prepared when its token enters or leaves a Region. This includes other
    slices' rules of that kind, which before only caught up on the actor's next update.

Not changed: the automation notes (written only via apply.cjs). The converted items' notes still describe them.

## Still skipped (70), and what each still needs

Where a round-5 piece now covers part of an item, that is said. Otherwise slC4's reason stands.

### gij1 (14) + fix3-gij (1)

- **Anonymous:** tags over the attacker's per-target records keyed by the wearer's uuid.
- **Uniform:** a switch from the target's worn items with a count of its allies wearing the same upgrade.
- **Recoil Brace:** an item mark with a duration and a `host` selector, read by an ItemModifier `min` on `derivedHands`. `@host` covers reading the host, not marking it.
- **Cybernetic Part, Enhanced Part, Optimized Part, Engrafted Mutation, Evolving Mutation, Outright Mutation (6):** Alteration-aware granting through `onAlterationDrop` with a "not already owned" filter.
- **Metier:** boolean DerivedStats with a `{choice}` path now cover the trained-weapon half, and a `grant` step could give Weapon Training. Still needs renaming the Perk itself with the pick, and undoing the Assassin's poison step before `_preparePoisonTraining` recomputes (derived rules run after it).
- **Extract Poison (Use, partial above):** a roll whose DIF is a picked compendium entry's Availability.
- **Improvise Bomb:** a compendium pick with a code filter, an Availability-DIF roll, a second copy on a crit, a cost that depends on another Perk.
- **Demolition Artist:** goes with Improvise Bomb.
- **Let It Rip:** as Recoil Brace, plus a `pick` filter by book source.
- **Scavenger:** a two-stage pick (type, then entry), a Requisition roll one Availability step harder, appending Temperamental.
- **Angry (fix3-gij):** a tag comparing the rolled Skill with a value on the actor. `var:` tags compare run values only.

### gij2 (11)

- **Artillery Support:** an area recipient, steps delayed to the caller's next turn start, a Targeting roll per token against its own Defense.
- **Castling:** temporary Health that also raises `system.health.value` uncapped. (`updateActor` could add it, but the Temporary Health half is castling.mjs's own.)
- **Fearsome Presence:** a post-roll per-target cap (first three within 20 ft) undoing dice.mjs's Frightened, and marks from several setters.
- **Martial Artist:** whispered comparison words (superior / equal / inferior). `{@formula}` in text gives numbers, not comparisons.
- **Nose For Trouble:** a confirmable Skill + Essence swap that clears the Specialization.
- **Peerless Pilot:** an auto-pass-disembark rule type read by `vehicle-defeat.mjs`.
- **Personal Shield:** a pre-toggle veto, a Role Points switch-off, an Impenetrable-Shield-aware EMP short-out.
- **Plan of Action:** a step editing another ally's pending ↑N.
- **Queen's Gambit:** an initiative reorder relayed to the GM. `writeInitiative` sets a value but can't place an actor "right after" the current turn by combat disposition.
- **Reckless Abandon:** a pre-use veto for kits, a "no enemy token on the scene" tag, a Role Points switch-off on Defeat.
- **Roll Cage:** a vehicle-defeat crew-damage hook.

### gij3 (17)

- **Second Skin:** an asked SkillSubstitution (a chooser before the dialog).
- **Subtle Snake:** a DialogSwitch select (none / ↓1 / Snag).
- **Pillage:** a `disarm` step with `maxHands` and moving a target's item to the actor.
- **Junker:** `to: party` reaches the roster's members, not the Party actor whose `system.requisition.attempts` it raises; and its banked Edge is read by the requisition roll's dataset.
- **Targeting Eye:** its mark timing (next round at the holder's place, else the scene) and an ItemModifier doubling projectile ranges except Scoped.
- **The Sound of Angels:** a per-recipient Free-action cost, a Lend-Assistance grant against this target, a weapon tag.
- **Dreadnok Recruit:** a scene-token name tag and a turn-start Free-action spend.
- **Touch Move:** a GM-side announcement to every un-surprised ally when Initiative is rolled.
- **Early Adopter:** one button per Party member, pressable only by that member's owner and acting for them. `to: party` lists them but `button` posts one card.
- **Field Trials:** the same, plus appending Temperamental to a granted upgrade's traits.
- **Peak Performance:** a step granting the base Role's top Perks outright.
- **Technical Glitch, Some Assembly Required, Complete System Failure (3):** `pick` over a target's items, a DIF from the picked item, a button only the disruptor can press acting on another actor's item.
- **Better than the Best:** a natural-20 outcome bump inside dice.mjs's results.
- **Seconds Between Click & Boom (code half):** an "ignore miss effects" rule type.
- **Takedown Expert (code half):** a Takedown-failed event, the level gate, a `disarm` step.

### situational1 (14 skip, 3 partial unchanged, plus Jungle Fighter's partial above)

- **Layered Armor:** a flat (non-shift) roll bonus.
- **Environmental Warrior:** a tag matching Survival Specialization names against terrain / environment keywords.
- **Urban Jungle:** convertible now (`[terrain:set, terrain:urban]` Edge on non-attacks, Specialized attacks), but its code is in `module/dice.mjs`, not my files. Left for whoever owns dice.mjs.
- **Urban Adaptation:** a pool sized by a level table, and per-scene chosen abilities.
- **Earth Defense Command Benefits:** `vehicle:moves` on the total (`vehicle:data:system.movement.aerial.total>0` could now do it), but its Space Kit Use picks from the actor's own Specializations and makes a kit (`makeKit`), and the Driving ↑2 must also work for a vehicle rolling itself.
- **Adapted Vehicles:** a `driven`-scope check of the driver's expertise against the terrain under the vehicle.
- **Environmental Enforcer:** a multi-pick sized by Survival ranks.
- **Weather Gear, Acclimating (2):** a hazard-protection rule type (`ENVIRONMENT_PROTECTORS`).
- **Fast Tracking:** a "looks like a Contingency" tag for the pre-tick.
- **Misguide:** a rough-terrain-imposing rule type and the marked creature's current-or-next-turn window.
- **Ambush Master:** an "an enemy combatant has status X" tag.
- **Contort:** a Reach rule (or `totalReach` ItemModifier with `until`) and a picker between two costs.
- **Izuna Drop:** a roll on the better of two Skills, the GM damage button for unowned targets, overflow back onto the faller.
- **Partials, unchanged:** Out of the Jungle (a formula summing over items), Danger Sense (`ruleConditionImmune` passing `holder`), Every Trick in the Book (a "can't be sneak-attacked" rule).

### situational2 (13 skip, plus 3 partials above)

- **Arctic Expedition Clothes, Desert Expedition Clothes, Desert Gear (3):** the tags exist now (`environment:outside:extremeCold`, `terrain:arctic`...), and the Region refresh is generic. Still needs the "not against a creature's attack" -2 at attack time to apply after best / halve and to group like the sheet's +2 (`stack`): roll-time Defense additions are summed before best / halve and never grouped, so two worn clothes would take -4.
- **Business:** a creature-tag prefix test (`strex*`), and the same Defense ordering.
- **Caltrops:** the presser's controlled token before `user.character` in `runAs: clicker`.
- **Competitive:** comparing an ally's total with this actor's own last roll of the same Skill in the scene's recent window.
- **Forgiving:** `consumeMark` covers using up the mark, but the aggressor mark needs one per Forgiving holder (one key holds one setter).
- **Take in a Scene:** a DIF from chat history.
- **Misplaced Confidence:** Take in a Scene with it, and a Condition held to a set round.
- **Cartography Suite, Lay of the Land (Rough Terrain half) (2):** a "surveyed this scene" tag, and an ally-aura Move-action count.
- **Plow:** a Multiple Targets grant rule type (also for a driven vehicle) and a this-turn mark read by MovementAction.
- **Bookworm (Initiative half):** a "a hostile combatant matches target: tags" tag.

## Edits outside my files

None. The only files touched are my slice folders (`situational1/situational1.mjs` + test, `situational2/common.mjs`,
`initiative.mjs`, `situational2.mjs` + test, `gij1/perks.mjs`, `gij1/shared.mjs`, `gij1/gij1.test.js`,
`gij2/perks.mjs`, `gij2/shared.mjs`, `gij2/gij2.test.js`), my 16 pack files, `module/rules/conv5-slC5.test.js` and
this write-up.

## Unused strings

These `lang/en.json` keys are no longer used anywhere in `module/`, `templates/` or `tours/`:
- Seafarer: `E20.S2SeafarerSwimToggle`
- Tritium Sights: `E20.S2TritiumLabel`, `E20.S2TritiumToggle`
- Feet Wet: `E20.S2FeetWetLabel`
- Environmental Camouflage: `E20.S1CamouflagePrompt`, `E20.S1CamouflageToggle`, `E20.S1CamouflageOn`, `E20.S1CamouflageOff`
- Jungle Fighter: `E20.S1JungleOn`, `E20.S1JungleOff`
- Mentor: `E20.Gij2MentorSkillPrompt`, `E20.Gij2MentorEssencePrompt`, `E20.Gij2ChoiceSet`

## Rules added

47 rules added in 16 pack files (net +40: Energy Resistant went from 9 rules to 3), inserted as text with CRLF kept:
- Seafarer 2, Seafarer (Hang-Up) 1, Tritium Sights 1, Feet Wet 5, Ship Shape 6, Shark's Fin 2, Amphibious Assault 1,
  Tracking Outfit 1 (situational2: 19).
- Spacewalker 1, Environmental Camouflage 7, Jungle Fighter 8 (situational1: 16).
- Sea Legs 2, Extract Poison 6 (gij1: 8). Mentor 3 (gij2).
- Energy Resistant: 7 DerivedStats replaced by 1. Expert Knowledge: one Trigger's outcome changed.

## Engine pieces the remaining skips need (most useful first)

1. **Target-item steps:** `pick` over a target's items or a compendium entry, a roll whose DIF is the picked entry's
   Availability, `disarm` with `maxHands`, moving a target's item to the actor. Unblocks Pillage, Takedown Expert, the 3
   Disruptor Perks, Extract Poison's Use, Improvise Bomb + Demolition Artist, Scavenger (about 9). **Medium-large.**
2. **Roll-time Defense additions after best / halve, grouped by `stack`,** plus a creature-tag prefix tag. Unblocks
   the three exposure clothes and Business (4). **Small-medium.**
3. **Per-member buttons and the Party actor as a recipient:** one button per roster member, pressable by that member's
   owner and acting for them; `to: partyActor` for the Party document itself; `runAs: clicker` preferring the
   controlled token. Unblocks Early Adopter, Field Trials, Junker, Caltrops (4). **Small-medium.**
4. **Small tags, outcomes and options:** a poison-save tag (the save rider's spec) for the Seafarer Hang-Up's Snag; a
   Movement rounding option (`round: floor`) for Ship Shape's vehicle; an "Initiative is being rolled" event (only
   from the roll, before its formula) for Shark's Fin's Initiative half; "an enemy combatant has status X" (Ambush
   Master); "a hostile combatant matches target: tags" (Bookworm's Initiative half); rolled Skill vs an actor value
   (Angry); "looks like a Contingency" (Fast Tracking); a formula summing over items (Out of the Jungle, Jungle
   Fighter's light-armor noise); a Survival-Specialization keyword match (Environmental Warrior); a "not x2" outcome
   (Expert Knowledge's last edge case). Would finish 3 partials and 6 skips. **Small each.**
5. **Item marks with a duration plus a `host` selector,** read by an ItemModifier `min` on `derivedHands`. Unblocks
   Recoil Brace, Let It Rip. **Medium.**
6. **Rule types read by hand-written registries:** hazard protection (Weather Gear, Acclimating), rough-terrain imposers
   (Misguide), Multiple Targets grants (Plow), auto-pass disembark (Peerless Pilot), "can't be sneak-attacked" (Every
   Trick in the Book), "ignore miss effects" (Seconds Between Click & Boom), vehicle-defeat crew damage (Roll Cage).
   **Small each.**
7. **Marks with several setters under one key** (keyed per setter, read by `markedByMe:` / `consumeMark`). Unblocks
   Forgiving, and part of Fearsome Presence. **Small-medium.**
8. **Renaming the rule's own item with a pick, and a derived stage before `_preparePoisonTraining`.** Unblocks Metier.
   **Small-medium.**
9. **Effectively permanent code** (bespoke UI or whole subsystems): Artillery Support (area strikes), the six
   Alteration parts (Alteration drop flow), Urban Adaptation (level-table pool with per-scene abilities), Queen's Gambit
   (initiative reorder via the GM), Personal Shield / Reckless Abandon (Role Points activation with vetoes), Plan of
   Action's split, Nose For Trouble's confirm-swap, Martial Artist's whispered comparison, Take in a Scene / Misplaced
   Confidence / Competitive (chat-history reads), Izuna Drop, Touch Move / Dreadnok Recruit announcements, Anonymous /
   Uniform (per-target records), Second Skin / Subtle Snake (dialog selects), Better than the Best (dice.mjs
   multiplier), Peak Performance, The Sound of Angels, Targeting Eye, Contort, Environmental Enforcer, Earth Defense
   Command Benefits, Adapted Vehicles, Cartography Suite / Lay of the Land.
