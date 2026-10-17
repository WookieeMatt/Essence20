# Batch slC3: re-check of slC2's skips (`gij1`, `gij2`, `gij3`, `fix3-gij`, `situational1`, `situational2`) against the 2026-10-05 engine pieces

**Scope:** every item `docs/rules-batches/slC2.md` left **Still skip** (91) or **Partial** (5) in the six slC slices,
re-checked against the guide's section "Engine features added 2026-10-05 (after slice round 2)": the new durations
(`endOfNextTurn`, `turnOrScene`, `roundOrScene`, `rounds:N`, `untilOf`), watch Triggers, Reaction rules
(`negateHit` / `lowerTotal` / `lateSnag` / `convertRows`), `button` limits, dice and `@target` in step formulas and
`{var.x}` in chat, `legacy` on `pick`, `rule:granted` / `item:granted` and `createItem` `children`. Pack Attack
(fix3-gij, not in the slice's id table) was looked at again too and is not counted. Edited in place in the shared
checkout (no branch, no commit).

| Verdict (re-checked items) | gij1 + fix3-gij | gij2 | gij3 | situational1 | situational2 | Total |
|---|---|---|---|---|---|---|
| Convert (now fully rules) | 3 | 0 | 0 | 1 | 0 | **4** |
| Partial, nothing more converts | 0 | 0 | 0 | 4 | 1 | **5** |
| Still skip | 17 | 14 | 17 | 18 | 21 | **87** |
| Re-checked | 20 | 14 | 17 | 23 | 22 | **96** |

17 rules were added to 4 pack files (3 book items; Weatherproof is printed in two packs). After this part,
`scripts/check-rules.mjs` reports 0 errors and 0 warnings (1618 rules on 1092 items in the shared checkout, other
agents' work included). ESLint is clean on every file touched, and jest passes on the six slice folders,
`module/rules/conv3-slC3.test.js`, `module/rules/legacy-choices.test.js` and `module/helpers/skill-effects.test.js`
(9 suites, 119 tests). No slice file became empty, so `extensions/index.mjs` is unchanged.

## Converted (4)

| Item | Rules | Why it is exact |
|---|---|---|
| **Ceremonial** (gij1, `packs/ccitems/_source/Ceremonial_vf9rJxOwuxDzrPKp.json`) | One Use, "↑1 on Persuasion until the end of your turn", `cost: {action: free}`, `when: ["not:rule:banked"]`, two `bank` steps: with step `when: ["combat"]` a ↑1 on `skill:persuasion` with `uses: 99`, `until: turnOrScene`; with `when: ["not:combat"]` the same ↑1 with one use, `until: turnOrScene`. Both banks are labelled "Ceremonial". | The old Use paid a Free action and stamped `gij1Ceremonial` with the turn (in combat) or the scene epoch (out of combat). A roll source gave ↑1 on Persuasion while the stamp held, and was used up by the roll only out of combat. `turnOrScene` is "this turn in a running combat, else the scene". In combat the bank isn't spent in a turn (99 uses) and expires when the turn changes. Out of combat it is spent by the next Persuasion test or ends with the scene. `not:rule:banked` hides the button while the bonus is live, like the old `!isStampActive(...)`. Rule Use buttons only show while their upgrade is loose or on equipped armor, the same as the old `wornUpgrade` check. The pre-fitted Momentum / Tactical Armor (Ceremonial) attach the same book upgrade, so the rule reaches them through `rules/inherit.mjs`. |
| **Primal Fear** (gij1, `packs/ccitems/_source/Primal_Fear_xoD8fbVVqymTidNJ.json`; its Intimidation switch was already a rule) | A Use, "Unnerve a creature (Survival)": `cost: {action: free}`, `when: ["check:environmentalExpertise"]`, `limit: {per: turn, max: 1}`. Steps: `target {max: 1}`, then `choose` Willpower / Cleverness, each a `roll {skill: survival, difDefense: <it>}`. `onFail` posts "{name} fails to unnerve {target}.". `onSuccess`: see Feed On Fear. A RollModifier `upshift: 1`, `when: ["target:data:system", "markedByMe:primalFear"]` (no label, so the source reads "Primal Fear" as before). | `check:environmentalExpertise` is `hasActiveEnvironmentalExpertise`, the function the old `canUse` called. A `per: turn` limit counts nothing outside a started combat, and the old `hasUsedThisTurn` was always false out of combat. The limit is recorded when the run finishes, on success or failure, as the old `markUsedThisTurn` before the roll was. The roll is the same `grants.mjs#rollTest(actor, 'survival', <Defense total>)`. On a success the mark goes on the target (`mark {to: target, until: turnOrScene}`), and `markedByMe:primalFear` gives ↑1 on any roll against that creature while the mark lasts: this turn in combat, the rest of the scene out of combat (the old `turnStamp` / `isStampActive`). `target:data:system` makes the tag answer "no" rather than "unknown" with nothing targeted, so it never becomes a switch. |
| **Feed On Fear** (gij1; its behaviour lives in Primal Fear's success branch, so no rules were added to its own pack item) | In Primal Fear's `onSuccess`: a `choose` with step `when: ["self:hasItem:Compendium.essence20.cobra_codex.Item.dZkRZSH5X88PrSyK"]`. "↑1 against the target" sets the mark and posts the line. "Heal 1 Health (Feed On Fear)" runs `heal {amount: 1}`. Without Feed On Fear, the same `mark` and `chat` run with `when: ["not:self:hasItem:..."]`. | The old code asked "shift or heal" only when the actor owned Feed On Fear (the same book uuid, exact match). Heal added 1, capped at the maximum, and set no mark. The `heal` step caps the same way. |
| **Weatherproof** (situational1, `packs/gijcrbitems/_source/Weatherproof_Vo0m83m6fHo4BHOY.json` and the PR CRB reprint `packs/prcrbitems/_source/Weatherproof_Vo0m83m6fHo4BHOY.json`, identical rules) | A Use, "Choose the environment": `pick {key: environment, from: list, options: underwater / lowGravity / zeroGravity / vacuum / normal, legacy: "flags.essence20.s1Environment"}`. Then six RollModifiers, each `scope: host`, `stacks: true`, `when` starting `["attack", "item:type:weaponEffect", "rule:data:flags.essence20.rules.choices.environment=<env>", "environment:<env>"]`. **Low Gravity:** Edge, ranged (`not:item:data:system.classification.style=melee`), `not:weapon:trait:inertial`, `weapon:trait:ballistic`. **Zero Gravity:** Edge, ranged, not inertial, `not:weapon:trait:energy`, `not:item:damageType:laser`. **Vacuum:** Edge, ranged, not inertial. **Underwater:** Edge, not amphibious, not aquatic, `{any: [ranged, "not:self:data:system.movement.swim.total>0"]}`. **Underwater:** ↑2, `item:damageType:fire`. **On land:** ↑3, `environment:normal`, `weapon:trait:aquatic`, not amphibious. Labels are "Weatherproof (Low Gravity)" and so on. | The old `weatherproofSources` checked the same conditions one for one: the weapon is the rolled effect's parent, the chosen environment equals `getEnvironment(actor)` (the `environment:` tag reads the same function with the same default options), and the same weapon traits, style, damage type and swim total. Each old source is one rule, with the same Edge / ↑ amounts. `scope: host` keeps each rule to the weapon the upgrade is attached to (`hostMatches`), as the old `parentId` lookup did. `stacks: true` keeps two weapons that each carry a Weatherproof for the same environment from collapsing into one (the copy key includes the choice). The old Use always asked (`chooseOne`), and `pick` without `ifUnset` always asks too. The old choice lived in `flags.essence20.s1Environment`, and `legacy` moves it into `rules.choices.environment` on the GM's linking pass, so existing copies keep their environment. |

Removed:
- **Ceremonial:** in `gij1/gear.mjs`, its Use, `CEREMONIAL_FLAG`, `ceremonialSource`, its roll source and its consumer, plus the now-unused `registerConsumer` and `actorFromUuid` imports. `G1.ceremonial` is gone from `gij1/shared.mjs`. Its test is gone from `gij1/gij1.test.js`.
- **Primal Fear / Feed On Fear:** in `gij1/perks.mjs`, `PRIMAL_FEAR_FLAG`, `gij1Sources` and its `registerRollSources`, the Use, `PRIMAL_FEAR_TURN`, the `ready` hook caching `hasActiveEnvironmentalExpertise`, `setEnvironmentCheck`, `canPrimalFear` and `healOne`, plus the now-unused `registerRollSources`, `hasUsedThisTurn` / `markUsedThisTurn`, `firstTarget` and `isStampActive` imports. `G1.primalFear` and `G1.feedOnFear` are gone from `gij1/shared.mjs`. Three tests are gone from `gij1/gij1.test.js`.
- **Weatherproof:** in `situational1/situational1.mjs`, `S1.weatherproof`, `upgradesOn` (Weatherproof was its only user), `WEATHERPROOF_ENVIRONMENTS`, `weatherproofSources` and its call in `situationalRollSources`, and the `s1-weatherproof` Use. Its test is gone from `situational1/situational1.test.js`.

The new tests are in `module/rules/conv3-slC3.test.js`. They load the pack items and cover what the old tests asserted,
plus the rest of the old code paths:
- **Ceremonial:** the ↑1 is on Persuasion only. Out of combat one test uses it up and a new scene ends it. In combat it lasts every test this turn and is gone next turn. The button is hidden while the bonus is live, and missing on unworn armor.
- **Primal Fear:** it needs Environmental Expertise. The DIF is the chosen Defense. The ↑1 is against the marked creature only, and never a switch with nothing targeted. It is once per turn in combat, with no limit out of combat, and the mark lasts the scene out of combat. A failure still uses the turn. Nothing targeted means no roll.
- **Feed On Fear:** it heals 1 capped at the maximum, or marks. Without Feed On Fear there is no second question.
- **Weatherproof:** the pick and the legacy move, every environment's conditions, host-only, and two weapons each keeping their own.

## Behaviour differences worth a decision

All are same-line (the converted items themselves). None is cross-line.

**Primal Fear / Feed On Fear**
1. **The Free action is paid before the target check and the Defense question.** A Use rule pays its cost before
   `target` / `choose` run (only `pickAlly` comes first). With nothing targeted, or a cancelled question, the Free
   action is now spent, though the once-per-turn use is not. Before, both checks came before paying. Electro-Disruptor
   and the other `choose`-then-`roll` Uses already work this way.
2. **Out of combat, the ↑1 now lasts the whole scene, even into a combat started in that scene.** The old out-of-combat
   stamp stopped counting as soon as any combat existed. A combat that exists but hasn't started now counts as
   "out of combat" (the old stamp used `game.combat` existing).
3. **The mark sits on the creature.** Out of combat, unnerving a second creature no longer clears the first, so both
   give ↑1. If two Primal Fear holders mark the same creature, the later mark replaces the earlier one (`mark` keeps
   one setter). In combat neither case can arise within one turn.
4. **Cancelling Feed On Fear's question** now ends the run with nothing set. Before, a cancelled question fell through
   to the ↑1.
5. **Wording:** the chat lines are the rules' own (and "Healed 0" at full Health instead of "already at full"). The
   Roll Options Dialog source keeps the label "Primal Fear", but its id changes. A target with no stored Defense
   total is rolled against DIF 10 (the `roll` step's fallback) instead of 0.

**Ceremonial**
6. **A combat that exists but hasn't started** now counts as out of combat (one Persuasion test). Before, it counted
   as combat (the turn stamp, not used up). An unspent out-of-combat bonus also still counts for one Persuasion test
   if a combat starts in the same scene. Before, the old scene stamp stopped counting once a combat existed.
7. **Wording:** the chat card is the engine's "Banked ↑1" under "Ceremonial: ↑1 on Persuasion until the end of your
   turn", instead of `G1CeremonialUsed`.

**Weatherproof**
8. **On an unequipped weapon** the upgrade's rules are off (`rules/index.mjs#isItemActive`): no Edge / ↑ and no
   Use button. The old code applied whether or not the weapon was equipped. slC2 accepted the same for Adjustable
   Faceplate.
9. **Two Weatherproof upgrades on one weapon:** the old code read only the first. Now each applies, so two set to
   the same environment would give the fire ↑2 / aquatic ↑3 twice. This is unusual, and the alternative (no `stacks`)
   would drop a second weapon's Weatherproof instead.
10. **Existing copies** read their old environment once the GM's linking pass (`rules/inherit.mjs#linkExistingCopies`,
    run when the system version changes) has moved it. Until then an old copy has no environment. Pressing its
    Use sets one.
11. **Wording:** the source labels are "Weatherproof (Underwater)", "(Low Gravity)", "(Zero Gravity)", "(Vacuum)" and
    "(On land)", instead of "<upgrade name> (<localized environment>)". Source ids change. The pick posts the engine's
    "Picked" line.

Not changed: the automation notes. Weatherproof's GI Joe copy still says "the scene's terrain" where it means the
environment. That wording was there before, and notes are written only via apply.cjs.

## Still skipped (87), and what each still needs

Where a new 2026-10-05 piece now covers part of an item, that is said. Otherwise slC2's reason stands.

### gij1 (16) + fix3-gij (1)

- **Anonymous:** tags over the attacker's per-target records keyed by the wearer's uuid (`outwittedTargets`, `analyzeTargetCounts`).
- **Uniform:** a switch from the target's worn items with a count of its allies wearing the same upgrade.
- **Recoil Brace:** a `host` item selector, an item mark with a duration (`turnOrScene` exists but only for actor marks / banks / toggles), and an ItemModifier `min` on `derivedHands` while it holds.
- **Cybernetic Part, Enhanced Part, Optimized Part, Engrafted Mutation, Evolving Mutation, Outright Mutation (6):** Alteration-aware granting through `onAlterationDrop` with a "not already owned" filter and the cybernetic / genetic flag.
- **Metier:** a rename with interpolation (`{choice}` now works in `createItem` names, not in `updateItem` set), boolean DerivedStat writes, undoing the Assassin's poison step. `legacy` could now move `gij1Choice`.
- **Extract Poison:** a roll whose DIF is the picked compendium entry's Availability, and boolean "Qualified in all poisons" writes.
- **Sea Legs:** a derived stage at the old hook's place (after gravity).
- **Improvise Bomb:** a compendium pick with a code filter, an Availability-DIF roll, a second copy on a crit, a cost that depends on another Perk.
- **Demolition Artist:** goes with Improvise Bomb.
- **Let It Rip:** as Recoil Brace, plus a `pick` filter by book source (the four Signature Weapons).
- **Scavenger:** a two-stage pick (type, then entry), a Requisition roll one Availability step harder than the picked entry, appending Temperamental to the copy's traits.
- **Angry (fix3-gij):** a tag comparing the rolled Skill with a value on the actor (`angryHangUpSnag.skill`, written by `items/rolls/angry-influence.mjs`).
- *(Pack Attack, uncounted:)* its records are written by `items/attacks/pack-attack.mjs` from the Growl bank (outside the slice). The expiry is "start of the user's next turn, else the scene", and `nextTurn` has no scene fallback.

### gij2 (14)

- **Artillery Support:** a canvas-point / area recipient, steps delayed to the caller's next turn start, one Targeting roll per token in the radius against its own Defense, per-token damage.
- **Castling:** temporary Health that also raises `system.health.value` uncapped.
- **Energy Resistant:** `legacy` now covers `gij2Element`. Still needs a Resistance / boolean DerivedStat whose path takes `{choice.x}`.
- **Expert Knowledge:** `legacy` now covers `gij2ExpertSkill`. Still needs a Trigger outcome "success but not a crit / x2" (or a count placeholder in chat). `success` also matches `double` / `crit`.
- **Fearsome Presence:** a post-roll per-target cap (first three successes within 20 ft) that removes the Frightened `dice.mjs` applied, and a Condition-lifting mark.
- **Martial Artist:** a chat step with comparison placeholders (superior / equal / inferior) and whisper recipients.
- **Mentor:** `legacy` now covers `gij2Mentor`. Still needs a boolean DerivedStat with a `{choice}` path and a dependent Essence pick.
- **Nose For Trouble:** a confirmable Skill + Essence swap that clears the Specialization.
- **Peerless Pilot:** an auto-pass-disembark rule type read by `vehicle-defeat.mjs`.
- **Personal Shield:** `rounds:10` now exists. Still needs a pre-toggle veto, a Role Points switch-off step and an Impenetrable-Shield-aware EMP short-out.
- **Plan of Action:** a step editing another ally's pending ↑N, and a hidden-when check for the button.
- **Queen's Gambit:** a watch `takesDamage` Trigger now fires for allies, but "ally" is canvas allegiance, not combat disposition. Still needs an initiative-reorder step relayed to the GM.
- **Reckless Abandon:** `rounds:10` now exists. Still needs a pre-use veto for kits, a "no enemy token on the scene" tag, and a Role Points switch-off on Defeat (not with Aegis / The Beat Goes On).
- **Roll Cage:** a vehicle-defeat crew-damage hook.

### gij3 (17)

- **Second Skin:** an asked SkillSubstitution (a chooser before the dialog).
- **Subtle Snake:** a DialogSwitch select (none / ↓1 / Snag).
- **Pillage:** a `disarm` step with `maxHands` and a step moving a target's item to the actor.
- **Junker:** a `party` recipient for `gainResource` (`system.requisition.attempts`).
- **Targeting Eye:** `endOfNextTurn` exists, but its timing differs from the old mark (always next round at the holder's place, and the scene out of combat, where `endOfNextTurn` has no stamp). Also still needs an ItemModifier that doubles projectile ranges, skipping Scoped weapons and recording `upgradeTouched`.
- **The Sound of Angels:** a per-recipient Free-action cost, a Lend-Assistance-against-this-target grant, a weapon tag for its weapons.
- **Dreadnok Recruit:** a scene-token name tag and a turn-start Free-action spend.
- **Touch Move:** a GM-side announcement to every un-surprised ally when Initiative is rolled.
- **Early Adopter:** button limits per presser exist now, but the card needs one button per Party member, pressable only by that member's owner and acting for that member. `runAs: clicker` acts as the presser's `user.character`, and any presser with a character could take it.
- **Field Trials:** the same per-member buttons, plus "add to a list" on `updateItem` / `pickGrant` (Temperamental).
- **Peak Performance:** a step granting the base Role's top Perks outright.
- **Technical Glitch, Some Assembly Required, Complete System Failure (3):** `pick` over a target's items, a roll with a DIF from the picked item, a stored open-ended roll total, a button only the disruptor can press acting on another actor's item.
- **Better than the Best:** a natural-20 outcome bump.
- **Seconds Between Click & Boom (code half):** an "ignore miss effects" rule type. Reaction `negateHit` covers hits, not miss effects.
- **Takedown Expert (code half):** a Takedown-failed event, the level gate on it, a `disarm` step.

### situational1 (18 skip, 4 partial)

- **Layered Armor:** a flat (non-shift) roll bonus.
- **Environmental Warrior:** a tag matching Survival Specialization names against terrain / environment keywords.
- **Jungle Fighter:** a "terrain is set" tag (or a terrain tag falling back to a toggle), and a summed-armor formula.
- **Urban Jungle:** the "terrain is set" tag.
- **Urban Adaptation:** a pool sized by a level table, and per-scene chosen abilities read by Edge / Specialized / Rough Terrain.
- **Earth Defense Command Benefits:** `vehicle:moves` on the total, and pick options from the actor's own Specializations. `{choice}` now works in `createItem` names, but not in `system` data.
- **Adapted Vehicles:** a `driven`-scope check of the driver's expertise against the terrain under the vehicle.
- **Environmental Enforcer:** a multi-pick sized by Survival ranks. `legacy` reads the old array as is, but `pick` stores one value.
- **Environmental Camouflage:** `legacy` could move its environment. Still needs the host armor's bonuses in Defense formulas (no `@host`), and its "in it now" toggle has no legacy path.
- **Weather Gear, Acclimating (2):** `legacy` could move Weather Gear's pick. Still needs a hazard-protection rule type (`ENVIRONMENT_PROTECTORS`).
- **Fast Tracking:** a "looks like a Contingency" tag for the pre-tick.
- **Misguide:** a rough-terrain-imposing rule type (`ROUGH_TERRAIN_IMPOSERS`) and the marked creature's current-or-next-turn window.
- **Ambush Master:** an "an enemy combatant has status X" tag.
- **Ghost:** `legacy` moves picks, not toggles. The hiding state is an actor flag (`s1GhostHiding`) that Arashikage Shozoku reads, and `setToggle` stores on the item, so an actor hiding today would flip the wrong way.
- **Arashikage Shozoku:** a Condition `until: nextTurn` that ends on damage unless Ghost is hiding.
- **Contort:** a Reach rule (or `totalReach` ItemModifier with `until`) and a picker between two costs.
- **Izuna Drop:** dice and `@target` in step formulas now help. Still needs a roll on the better of two Skills, the GM damage button for unowned targets, and overflow from the target's remaining Health back onto the faller.
- **Partials, unchanged:** Spacewalker (the environment without the vessel interior), Out of the Jungle (a formula summing over items), Danger Sense (`ruleConditionImmune` passing `holder`), Every Trick in the Book (a "can't be sneak-attacked" rule).

### situational2 (21 skip, 1 partial)

- **Arctic Expedition Clothes, Desert Expedition Clothes, Desert Gear (3):** an `environment:` tag without the vessel interior, actor refresh on token Region change, per-attack additive Defense after best / halve.
- **Business:** a creature-tag prefix test, and the Defense-ordering piece.
- **Tracking Outfit (Initiative half):** a terrain tag that answers false when unset.
- **Caltrops:** button limits exist now. Still needs an Essence-damage step and the presser's controlled token before `user.character`.
- **Tritium Sights / Rifle (Tritium Sight) (2):** a scene-darkness tag and a "the rolled weapon has upgrade X attached" tag.
- **Seafarer (Swimming half), Seafarer (Hang-Up), Amphibious Assault (Initiative half), Shark's Fin, Ship Shape (5):** swimming / "aboard an aquatic vessel" / interior-free environment tags, a save-rider spec tag (Hang-Up), a derived stage after gravity, a `driven` Movement multiply.
- **Competitive:** a watch `afterRoll` Trigger now fires on an ally's roll. Still needs a comparison of their total with this actor's own last roll of the same Skill in the scene's recent window (both ways).
- **Forgiving:** a mark the using roll removes and marks from several setters under one key. Neither watch Triggers nor Reactions add these.
- **Take in a Scene:** a DIF from chat history (the lowest opposing Infiltration total, +1).
- **Misplaced Confidence:** Take in a Scene with it, and a Condition held to a set round. `rounds:N` applies to marks / banks, not Conditions.
- **Cartography Suite, Lay of the Land (Rough Terrain half) (2):** a "surveyed this scene" tag, and an ally-aura Move-action count.
- **Plow:** a Multiple Targets grant rule type (also for a driven vehicle) and a this-turn mark read by MovementAction.
- **Bookworm (Initiative half):** a "a hostile combatant matches target: tags" tag.
- **Partial, unchanged:** Feet Wet (the "aboard an aquatic vessel" tag).

## Engine pieces the remaining skips need (most useful first)

1. **Position tags:** "terrain is set", interior-free `environment:`, swimming, aboard an aquatic vessel, scene darkness, plus a Region-change refresh (situational1 / situational2, about 15 items).
2. **Target-item steps:** `pick` over a target's items, a roll with a DIF from a picked item (or compendium entry), `disarm` with `maxHands`, taking a target's item (Pillage, Takedown Expert, the 3 Disruptor Perks, Extract Poison, Improvise Bomb, Scavenger).
3. **Per-member buttons:** one button per Party member, pressable by that member's owner and acting for them (Early Adopter, Field Trials).
4. **Item marks with a duration plus a `host` selector,** read by an ItemModifier `min` on `derivedHands` (Recoil Brace, Let It Rip).
5. **Boolean DerivedStat writes with `{choice}` paths** (Mentor, Energy Resistant, Metier, Extract Poison). Their legacy picks are now covered.
6. **A Trigger outcome "success, not crit / x2"** (Expert Knowledge).
7. **Rule types read by hand-written registries:** hazard protection, rough-terrain imposers, Multiple Targets grants, auto-pass disembark, "can't be sneak-attacked", "ignore miss effects".
8. **Toggle legacy** (an old actor / item flag moved into `rules.toggles`): Ghost, Environmental Camouflage's "in it now".

## Edits outside my files

None. The only files touched are in my slice folders, my 4 pack files, `module/rules/conv3-slC3.test.js` and this
write-up.

## Unused strings

These `lang/en.json` keys are no longer used anywhere in `module/`, `templates/` or `tours/`:
- Ceremonial: `E20.G1CeremonialUsed`
- Primal Fear / Feed On Fear: `E20.G1NeedTarget`, `E20.G1PrimalFearDefense`, `E20.G1PrimalFearFailed`, `E20.G1PrimalFearHit`, `E20.G1FeedOnFearPrompt`, `E20.G1FeedOnFearShift`, `E20.G1FeedOnFearHeal`, `E20.G1FeedOnFearHealed`, `E20.G1FeedOnFearFull`
- Weatherproof: `E20.S1EnvUnderwater`, `E20.S1EnvLowGravity`, `E20.S1EnvZeroGravity`, `E20.S1EnvVacuum`, `E20.S1EnvNormal` (Weather Gear still uses `S1EnvExtremeCold` / `S1EnvExtremeHeat`, and `S1ChooseEnvironment` / `S1EnvironmentsChosen` are still used)

## Rules added

17 rules in 4 pack files:
- Primal Fear: 2 (one Use, one RollModifier), appended after its existing DialogSwitch so earlier indices don't move.
- Ceremonial: 1 (a new `rules` array).
- Weatherproof: 7 in each of the GI Joe CRB and PR CRB copies (a new `rules` array).

All were inserted as text with LF kept.
