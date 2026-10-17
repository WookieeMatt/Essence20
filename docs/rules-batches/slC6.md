# Batch slC6: re-check of slC5's skips (`gij1`, `gij2`, `gij3`, `fix3-gij`, `situational1`, `situational2`) against the round-6 engine pieces

**Scope:** every item `docs/rules-batches/slC5.md` left **Still skip** (70) or **Partial** (8: the 5 with a part
converted plus the 3 unchanged) in the six slC slices, re-checked against the guide's section "Engine features added
2026-10-06 (round 6, after the local round-5 conversions)": `target:self`, `status:<id>:timed`, compound `wielding:a&b`,
upgrade-aware `item:trait`, `item:hasUpgrade`, `rule:hostEquipped`, `combat:enemyStatus|allyStatus`, `roll:fumble` and
damage type in Reactions, `@recipient`, `nextTurnOrScene`, `worldTime:N`, `combatAllies`, `alliesOfTarget|enemiesOfTarget`,
`mark exclusive`, GM-relayed `applyCondition` rounds, i18n `table` rows, the `team` scope, Movement `afterDerived` +
`round`, afterRoll `@var.dif`, open rolls reaching `outcome: "any"`, and `notDouble`. The earlier sections were checked
again too. Two already-converted items were revisited (Expert Knowledge, and Shark's Fin / Sea Legs' ordering), and so
were slC5's recorded behaviour differences. Edited in place in the shared checkout (no branch, no commit).

| Verdict (re-checked items) | gij1 + fix3-gij | gij2 | gij3 | situational1 | situational2 | Total |
|---|---|---|---|---|---|---|
| Convert (now fully rules) | 0 | 0 | 0 | 2 | 1 | **3** |
| Partial (improved this round) | 0 | 0 | 0 | 0 | 1 | **1** |
| Partial, nothing more converts | 1 | 0 | 0 | 4 | 1 | **6** |
| Still skip | 15 | 11 | 17 | 12 | 13 | **68** |
| Re-checked | 16 | 11 | 17 | 18 | 16 | **78** |

Also re-checked and improved (converted earlier): **Expert Knowledge** (its last edge case is now exact, slC4's
difference 1 is gone) and **Ship Shape's Feet Wet half** (no longer reaches a Zord, which the old code never did).

After this part, `scripts/check-rules.mjs` reports no errors or warnings (1826 rules on 1151 items in the shared
checkout). ESLint is clean on every file touched. Jest passes on the six slice folders, `module/rules/conv6-slC6.test.js`,
`conv5-slC5.test.js`, `conv4-slC4.test.js`, `conversions.test.js`, `helpers/rough-terrain.test.js` and
`helpers/condition-immunity.test.js` (941 tests). No slice file became empty, so `extensions/index.mjs` is unchanged.

## Converted

### Fully rules now (3)

| Item | Rules | Why it is exact |
|---|---|---|
| **Ambush Master** (situational1, `packs/gijcrbitems/_source/Ambush_Master_UYaPTaAQH5SDXxnz.json`) | A Use "Extra attack while an enemy is Surprised", `when: [combat:exists, combat:enemyStatus:surprised, {any: [self:hasItem:<Shotgun>, self:hasItem:<Submachine Gun>]}]`, `limit: {per: encounter}`, steps `bonusAttack {cost: none, optional: true}` and a chat line. Appended to its existing ConditionImmunity rule. | The old Use showed while `game.combat` existed (started or not: `combat:exists`), it hadn't been used this encounter (`hasUsedThisEncounter`, the window `per: encounter` counts), an opposing combatant was Surprised, and the actor owned a GI Joe CRB Shotgun or Submachine Gun. It granted `grantBonusAttack(actor, {source, cost: 'none'})` with no filter, marked the encounter used and posted the line whether or not the grant landed. `optional: true` keeps the run (and so the chat line and the used-up limit) going when the holder isn't a combatant. |
| **Urban Jungle** (situational1 write-up, code in `module/dice.mjs`; `packs/ccitems/_source/Urban_Jungle_wIesQd7U5W2azAWY.json`) | Two RollModifiers added to its existing rules: Edge `when: [not:attack, not:roll:initiative, terrain:set, terrain:urban]`, and `specialize` `when: [attack, terrain:set, terrain:urban]`. | dice.mjs's `rollSkill` gave Edge to every roll that wasn't a weaponEffect (the rules' `attack` is the same `item.type == 'weaponEffect'` test) and made weaponEffect rolls Specialized, when `getTerrain(actor) == 'urban'`. `terrain:set` makes an untagged scene answer "no", not "ask", as the old code stayed off there. Rule sources join `combatModifiers` before the dialog and its `edge` lands in `skillDataset.edge` (dice.mjs, the `edge:` line of the skill dataset); `specialize` is read by `extSpecializes` into `dataset.isSpecialized`, which `updatedShiftDataset` copies. Initiative never ran this code (`prepareInitiativeRoll` is separate), hence `not:roll:initiative`. The removal is under "Edits outside my files". |
| **Ship Shape** (situational2, was partial; `packs/qgtgitems/_source/Ship_Shape_MejI6WIShcA0GdoW.json`) | A Movement rule, `scope: driven`, `movement: all`, `stage: afterDerived`, `op: multiply`, `value: 1.5`, `round: floor`, `when: [self:type:vehicle, {any: [self:data:system.movement.swim.base>0, self:data:system.movement.swim.total>0]}]`. The three existing driven Feet Wet rules also gained `self:type:vehicle`. | The old derived hook ran for a `vehicle` with Aquatic Movement (`isAquaticVehicle`: swim base or total above 0) whose driver held Ship Shape, and set every Movement total to `floor(total * 1.5)`. `driven` reaches the vehicle from its driver's Perk, `self:` is the vehicle, and `round: floor` is the old rounding. The hand-written derived hooks registered after situational2 (TF's My Allies Are My Shield, the Zord form / body / gear hooks) never touch a vehicle, so running after every derived hook is the same point for a vehicle. `driven` also reaches Zords (`links.mjs` CREWED), which the old code never did, hence `self:type:vehicle`. |

### Partial (improved this round)

| Item | Converted | Stays code, and why |
|---|---|---|
| **Shark's Fin** (situational2) | Its two Movement rules moved from stage `afterGravity` to `afterDerived` (slC5's difference 8 - see below). | The Initiative half (lift Surprise, post the move line): still needs an "Initiative is being rolled" event fired from the roll itself, before its formula. |

### Re-checked conversions

- **Expert Knowledge** (`packs/gijcrbitems/_source/Expert_Knowledge_9H78lRwXzJW6tj9e.json`): a fourth afterRoll Trigger,
  "Expert Knowledge (1 extra benefit, Fumble)", `outcome: ["fumble", "anySucceeded", "notDouble"]`, posting the 1-benefit
  line. The old hook said "1" for any success not at double the DIF and not a crit, a Fumble included. `fumble` is the
  summary outcome (never a crit), `anySucceeded` some row beat its DIF, `notDouble` no row doubled it. The existing
  `["fumble", "x2"]` Trigger covers the doubled Fumble, so one roll still posts at most one card.
- **Shark's Fin / Sea Legs ordering (slC5 difference 8):** the old Shark's Fin doubling ran in situational2's derived
  hook - after every hook registered before it (data21's halving rider, Yo Joe!'s +10 Ground in other2, the Alteration
  Movement adjustments, PR's JTT / Team / CRB changes, data22's gear) and after Sea Legs (gij1). `afterDerived` puts it
  after all of those again. Sea Legs stays at `afterGravity` (gij1's hook ran before every other Movement-changing hook
  except data21's halving rider, which `afterGravity` already matched), so Sea Legs still lands before the doubling.

### Removed code

- **situational1.mjs:** the `s1-ambushMaster` Use, `enemySurprised`, `S1.ambushMaster`, `S1.shotgun`,
  `S1.submachineGun`, `FLAG.ambushMaster`, and the now-unused `hasUsedThisEncounter` / `markUsedThisEncounter` import.
- **situational2.mjs:** Ship Shape's block in `situational2Derived` and the unused `isAquaticVehicle` import
  (`drivenBy` stays for Plow). **common.mjs:** `S2.shipShape` (`isAquaticVehicle` stays: `isAboardAquaticVessel` uses it).
- **Tests:** the Ship Shape test in `situational2/situational2.test.js`. In `module/rules/conv5-slC5.test.js` (the
  slice's own round-5 test file, see "Edits outside my files") the Shark's Fin `afterGravity` test and Sea Legs' Shark's
  Fin combination moved to the new file. Ambush Master had no slice test.

The new tests are in `module/rules/conv6-slC6.test.js` (13 tests). They load the pack items and register the
position checks on situational2's own readings, as `essence20.mjs` does. They cover what the old tests asserted, plus:
Expert Knowledge's Fumble cases (through, doubled, failed, other Skill); Shark's Fin at `afterDerived` only, every
place it applies, with Sea Legs before it and a hand-written +10 before it; Ship Shape's x1.5 floor on every Movement,
the swim base-or-total test, and nothing for a gunner, a Zord, the driver or a vehicle without the Perk, and its Feet
Wet no longer reaching a Zord; Ambush Master's availability (both guns, no gun, another gun, no Surprised enemy, a
Surprised ally, no combat), its limit, the bonus attack at no cost and the line posted off the turn order; Urban
Jungle's Edge, Specialized attacks, nothing at Initiative, elsewhere or on an untagged scene, and no switch asked.

## Behaviour differences worth a decision

Same-line unless marked cross-line.

**Ambush Master**
1. **Who counts as an enemy** is the rules' `sameSide` (the two actors' active tokens' dispositions, else PC vs not)
   instead of the combatants' token dispositions. A holder whose combatant had no token used to count every other
   Surprised combatant, an ally included.
2. **The old "used this encounter" flag (`s1AmbushMasterUsed`) isn't carried over.** A holder who used it in a combat
   still running when this lands could use it once more in that combat.
3. **Wording:** the Use button is the rule's label, and the chat line is the rule's own (same words as
   `S1AmbushMasterUsed`).

**Ship Shape**
4. **Two Ship Shape rules reaching one vehicle** (two drivers with the Perk, or one driver with two copies) multiply
   twice (x2.25). The old hook applied x1.5 once. This needs two drivers or a duplicate Perk.
5. **Other `afterDerived` Movement rules on the same vehicle** now combine in the stage's set / multiply / add order,
   and the stage's rounding is the last applied rule's. None exist today.

**Shark's Fin**
6. **Cross-line:** the doubling now comes after the hooks registered after situational2 as well: Transformers' My
   Allies Are My Shield (+10 per traded bonus) and the Zord form / body / gear hooks now apply before the doubling,
   where they used to apply after it. This replaces slC5's difference 8, which covered every later hook (PR ATS,
   data22's Alt-mode gear, Zord bonuses, Yo Joe!...); only the TF / Zord ones remain.

**Urban Jungle**
7. **Wording:** the source reads "Urban Jungle (non-attack tests in the city)" instead of "Urban Jungle (Urban)".
8. **Until the dice.mjs removal is applied** both the old code and the rules give the Edge (listed twice, still one
   Edge) and the Specialized flag (set twice). Nothing else changes.

Not changed: the automation notes (written only via apply.cjs). The converted items' notes still describe them.

## Still skipped (68), and what each still needs

Where a round-6 piece now covers part of an item, that is said. Otherwise slC5's reason stands.

### gij1 (14) + fix3-gij (1)

- **Anonymous:** tags over the attacker's per-target records keyed by the wearer's uuid.
- **Uniform:** a switch from the target's worn items with a count of its allies wearing the same upgrade.
- **Recoil Brace:** a duration that ends when a combat starts or the turn ends ("this turn, else until combat"); `setToggle` with `until: turnOrScene` plus an ItemModifier `min 1` on `derivedHands` (`items: [item:isHost]`) nearly does it, but a brace set out of combat would survive into the combat.
- **Cybernetic Part, Enhanced Part, Optimized Part, Engrafted Mutation, Evolving Mutation, Outright Mutation (6):** Alteration-aware granting through `onAlterationDrop` with a "not already owned" filter.
- **Metier:** renaming the Perk itself with the pick, and undoing the Assassin's poison step before `_preparePoisonTraining`.
- **Improvise Bomb:** a compendium pick with a code filter, an Availability-DIF roll, a second copy on a crit, a cost that depends on another Perk.
- **Demolition Artist:** goes with Improvise Bomb.
- **Let It Rip:** as Recoil Brace, plus marking a picked weapon (not the rule's host) for the turn.
- **Scavenger:** a two-stage pick (type, then entry), a Requisition roll one Availability step harder, appending Temperamental.
- **Angry (fix3-gij):** a tag comparing the rolled Skill with a value on the actor.
- **Extract Poison (Use; partial, unchanged):** a roll whose DIF is a picked compendium entry's Availability.

### gij2 (11)

- **Artillery Support:** an area recipient, steps delayed to the caller's next turn start, a Targeting roll per token against its own Defense.
- **Castling:** only a chat note on castling.mjs's own Use card (the Use is outside the slice).
- **Fearsome Presence:** a post-roll per-target cap undoing dice.mjs's Frightened, and marks from several setters.
- **Martial Artist:** whispered comparison words from `getDefenseValue` (situational Defenses included).
- **Nose For Trouble:** a confirmable Skill + Essence swap that clears the Specialization.
- **Peerless Pilot:** an auto-pass-disembark rule type read by `vehicle-defeat.mjs`.
- **Personal Shield:** a pre-toggle veto, a Role Points switch-off, an Impenetrable-Shield-aware EMP short-out.
- **Plan of Action:** a step editing another ally's pending ↑N.
- **Queen's Gambit:** an Initiative reorder relayed to the GM, placing an actor right after the current turn.
- **Reckless Abandon:** a pre-use veto for kits, a "no enemy token on the scene" tag, a Role Points switch-off on Defeat.
- **Roll Cage:** a vehicle-defeat crew-damage hook.

### gij3 (17)

- **Second Skin:** an asked SkillSubstitution (a chooser before the dialog).
- **Subtle Snake:** a DialogSwitch select (none / ↓1 / Snag).
- **Pillage:** a `disarm` step with `maxHands` and moving a target's item to the actor.
- **Junker:** the Party actor itself as a recipient, and a banked Edge read by the requisition roll's dataset.
- **Targeting Eye:** the range doubling now fits an ItemModifier (`item:hasUpgrade` covers "not Scoped", and ItemModifier records `upgradeTouched` as the old code did). The mark timing still doesn't: the old mark lasts through the holder's turn next round and ends with the scene, and out of combat lasts the scene. `endOfNextTurn` has no scene end and no out-of-combat fallback; `rounds:1` ends as that turn starts.
- **The Sound of Angels:** a per-recipient Free-action cost, a Lend-Assistance grant against this target, a weapon tag.
- **Dreadnok Recruit:** a scene-token name tag and a turn-start Free-action spend.
- **Touch Move:** a GM-side announcement to every un-surprised ally when Initiative is rolled.
- **Early Adopter:** one button per Party member, pressable only by that member's owner and acting for them.
- **Field Trials:** the same, plus appending Temperamental to a granted upgrade's traits.
- **Peak Performance:** a step granting the base Role's top Perks outright.
- **Technical Glitch, Some Assembly Required, Complete System Failure (3):** `pick` over a target's items, a DIF from the picked item, a button only the disruptor can press acting on another actor's item.
- **Better than the Best:** a natural-20 outcome bump inside dice.mjs's results.
- **Seconds Between Click & Boom (code half):** an "ignore miss effects" rule type.
- **Takedown Expert (code half):** a Takedown-failed event, the level gate, a `disarm` step.

### situational1 (12 skip, 4 partials unchanged)

- **Layered Armor:** a flat (non-shift) roll bonus.
- **Environmental Warrior:** a tag matching Survival Specialization names against terrain / environment keywords.
- **Urban Adaptation:** a pool sized by a level table, and per-scene chosen abilities.
- **Earth Defense Command Benefits:** its Space Kit Use picks from the actor's own Specializations and makes a kit (`makeKit`), and the Driving ↑2 must also work for a vehicle rolling itself.
- **Adapted Vehicles:** a `driven`-scope check of the driver's expertise against the terrain under the vehicle.
- **Environmental Enforcer:** a multi-pick sized by Survival ranks.
- **Weather Gear, Acclimating (2):** a hazard-protection rule type (`ENVIRONMENT_PROTECTORS`).
- **Fast Tracking:** a "looks like a Contingency" tag for the pre-tick.
- **Misguide:** a rough-terrain-imposing rule type and the marked creature's current-or-next-turn window.
- **Contort:** a Reach rule (or `totalReach` ItemModifier with `until`) and a picker between two costs.
- **Izuna Drop:** a roll on the better of two Skills, the GM damage button for unowned targets, overflow back onto the faller.
- **Partials, unchanged:** Jungle Fighter and Out of the Jungle (a formula summing over items, for the light-armor noise), Danger Sense (`ruleConditionImmune` still doesn't pass `holder`), Every Trick in the Book (a "can't be sneak-attacked" rule).

### situational2 (13 skip, 2 partials)

- **Arctic Expedition Clothes, Desert Expedition Clothes, Desert Gear (3):** the "not against a creature's attack" -2 at attack time applied after best / halve and grouped like the sheet's +2.
- **Business:** a creature-tag prefix test (`strex*`), and the same Defense ordering.
- **Caltrops:** the presser's controlled token before `user.character` in `runAs: clicker`.
- **Competitive:** comparing an ally's total with this actor's own last roll of the same Skill in the scene's recent window.
- **Forgiving:** one aggressor mark per Forgiving holder (`mark exclusive` moves one setter's mark; it doesn't key a mark per setter).
- **Take in a Scene:** a DIF from chat history.
- **Misplaced Confidence:** Take in a Scene with it, and a Condition held to a set round.
- **Cartography Suite, Lay of the Land (Rough Terrain half) (2):** a "surveyed this scene" tag, and an ally-aura Move-action count.
- **Plow:** a Multiple Targets grant rule type (also for a driven vehicle) and a this-turn mark read by MovementAction.
- **Bookworm (Initiative half):** "a hostile combatant matches these tags" (`combat:enemyStatus` reads Conditions only; Bookworm needs a Librarian).
- **Partials:** Seafarer (Hang-Up) (a poison-save tag), Shark's Fin (above).

## Edits outside my files

1. **`module/dice.mjs` - Urban Jungle** (the pack rules above replace it). Three edits:
   - Line 25, replace
     `import { getEnvironment, getTerrain, hasEquippedEnviroSealedArmor, isEnviroSealedEdgeActive } from "./helpers/environment.mjs";`
     with
     `import { getEnvironment, hasEquippedEnviroSealedArmor, isEnviroSealedEdgeActive } from "./helpers/environment.mjs";`
     (`getTerrain` has no other use in dice.mjs).
   - Delete the comment block starting `// Urban Jungle (Cobra Codex, Vanguard Citystriker Focus, 3rd level, p.68) - the skill-substitution`
     through `const URBAN_JUNGLE_ID = \`${COBRA_CODEX}wIesQd7U5W2azAWY\`;` and the blank line after it (about lines 1810-1818).
   - In `rollSkill`, delete the block starting `    // Urban Jungle (see URBAN_JUNGLE_ID's own comment above): "when in urban environments... You`
     through its closing `    }` (the `if (actorHasPerk(actor, URBAN_JUNGLE_ID) && getTerrain(actor) == 'urban') { ... }`, about lines
     3478-3493) and the blank line after it.
2. **`module/dice.test.js`:** delete the test `test("Urban Jungle: Edge (labelled Urban) on urban terrain only", async () => {`
   through its closing `      });` and the blank line after it (about lines 17700-17722). `makeActorOnTerrain` stays (other tests use it).
   Its assertions are in `conv6-slC6.test.js`.
3. **Already applied:** `module/rules/conv5-slC5.test.js` (this slice's own round-5 test file). The Shark's Fin test
   asserted stage `afterGravity`, so it and Sea Legs' Shark's Fin combination were moved into `conv6-slC6.test.js` (as
   `afterDerived`); Sea Legs' own assertions stay. No other line changed.

## Unused strings

These `lang/en.json` keys are no longer used anywhere in `module/`, `templates/` or `tours/`:
- Ambush Master: `E20.S1AmbushMasterUsed`

(Urban Jungle's source label used `E20.environments.urban`, which stays in use.)

## Rules added

5 rules added in 4 pack files, inserted as text with the files' own CRLF line endings kept; 5 rules changed in place:
- Ship Shape: +1 Movement; `self:type:vehicle` added to its 3 driven Feet Wet rules.
- Expert Knowledge: +1 Trigger. Ambush Master: +1 Use. Urban Jungle: +2 RollModifiers.
- Shark's Fin: its 2 Movement rules' stage changed to `afterDerived`.

## Engine pieces the remaining skips need (most useful first)

1. **Target-item steps:** `pick` over a target's items or a compendium entry, a roll whose DIF is the picked entry's
   Availability, `disarm` with `maxHands`, moving a target's item to the actor. Unblocks Pillage, Takedown Expert, the 3
   Disruptor Perks, Extract Poison's Use, Improvise Bomb + Demolition Artist, Scavenger (about 9). **Medium-large.**
2. **Roll-time Defense additions after best / halve, grouped by `stack`,** plus a creature-tag prefix tag. Unblocks
   the three exposure clothes and Business (4). **Small-medium.**
3. **Per-member buttons and the Party actor as a recipient:** one button per roster member, pressable by that member's
   owner and acting for them; `to: partyActor`; `runAs: clicker` preferring the controlled token. Unblocks Early
   Adopter, Field Trials, Junker, Caltrops (4). **Small-medium.**
4. **Two durations:** `endOfNextTurnOrScene` (endOfNextTurn in combat, also ending with the scene; the scene out of
   combat) for Targeting Eye, and "this turn, else until a combat starts" for Recoil Brace. With those, Targeting Eye
   converts with existing pieces (Use + mark, two RollModifiers, an ItemModifier with `item:hasUpgrade`), and Recoil
   Brace with a toggle and an ItemModifier on its host. **Small.**
5. **Small tags and events:** an "Initiative is being rolled" event (from the roll, before its formula) for Shark's
   Fin's Initiative half; `combat:enemy:<target tags>` ("a hostile combatant matches") for Bookworm's Initiative half;
   a poison-save tag (the save rider's spec) for the Seafarer Hang-Up's Snag; `ruleConditionImmune` passing `holder`
   (Danger Sense); rolled Skill vs an actor value (Angry); "looks like a Contingency" (Fast Tracking); a formula summing
   over items (Out of the Jungle, Jungle Fighter's light-armor noise); a Survival-Specialization keyword match
   (Environmental Warrior). Would finish 5 partials and 3 skips. **Small each.**
6. **Item marks on a picked item** (a weapon other than the rule's host) with a duration, read by an ItemModifier.
   Unblocks Let It Rip. **Medium.**
7. **Rule types read by hand-written registries:** hazard protection (Weather Gear, Acclimating), rough-terrain imposers
   (Misguide), Multiple Targets grants (Plow), auto-pass disembark (Peerless Pilot), "can't be sneak-attacked" (Every
   Trick in the Book), "ignore miss effects" (Seconds Between Click & Boom), vehicle-defeat crew damage (Roll Cage).
   **Small each.**
8. **Marks keyed per setter** (one key, one entry per setter, read by `markedByMe:` / `consumeMark`). Unblocks
   Forgiving, and part of Fearsome Presence. **Small-medium.**
9. **Renaming the rule's own item with a pick, and a derived stage before `_preparePoisonTraining`.** Unblocks Metier.
   **Small-medium.**
10. **Effectively permanent code** (bespoke UI or whole subsystems): Artillery Support (area strikes), the six
    Alteration parts (Alteration drop flow), Urban Adaptation (level-table pool with per-scene abilities), Queen's
    Gambit (Initiative reorder via the GM), Personal Shield / Reckless Abandon (Role Points activation with vetoes),
    Plan of Action's split, Nose For Trouble's confirm-swap, Martial Artist's whispered comparison, Take in a Scene /
    Misplaced Confidence / Competitive (chat-history reads), Izuna Drop, Touch Move / Dreadnok Recruit announcements,
    Anonymous / Uniform (per-target records), Second Skin / Subtle Snake (dialog selects), Better than the Best (dice.mjs
    multiplier), Peak Performance, The Sound of Angels, Contort, Environmental Enforcer, Earth Defense Command
    Benefits, Adapted Vehicles, Cartography Suite / Lay of the Land, Castling (its Use lives in castling.mjs).
