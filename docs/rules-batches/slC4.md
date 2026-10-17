# Batch slC4: re-check of slC3's skips (`gij1`, `gij2`, `gij3`, `fix3-gij`, `situational1`, `situational2`) against the round-4 engine pieces

**Scope:** every item `docs/rules-batches/slC3.md` left **Still skip** (87) or **Partial** (5) in the six slC slices,
re-checked against the guide's section "Engine features added 2026-10-05 (round 4, after the local round-3
conversions)": wielding tags, `combat:exists`, `until: combat`, mark counters / `@mark`, `essenceDamage` /
`healEssence` / `extendCondition`, `rerollCard`, `roll` `snag` / `open`, `grant` `name` / `integrated` /
`systemFormulas`, step `filter`, outcome lists + `plainSuccess`, afterRoll `@var.total`, Toggle `legacy` and granted
attachments carrying `grantedBy`. The earlier sections were checked again too. Edited in place in the shared
checkout (no branch, no commit).

| Verdict (re-checked items) | gij1 + fix3-gij | gij2 | gij3 | situational1 | situational2 | Total |
|---|---|---|---|---|---|---|
| Convert (now fully rules) | 0 | 2 | 0 | 2 | 0 | **4** |
| Partial, nothing more converts | 0 | 0 | 0 | 4 | 1 | **5** |
| Still skip | 17 | 12 | 17 | 16 | 21 | **83** |
| Re-checked | 17 | 14 | 17 | 22 | 22 | **92** |

19 rules were added to 4 pack files. After this part, `scripts/check-rules.mjs` reports 0 errors and 0 warnings
(1668 rules on 1107 items in the shared checkout, other agents' work included). ESLint is clean on every file touched.
Jest passes on the six slice folders, `module/rules/conv4-slC4.test.js`, `module/rules/conv3-slC3.test.js` and
`module/rules/legacy-choices.test.js` (9 suites, 106 tests). No slice file became empty, so `extensions/index.mjs` is
unchanged.

## Converted (4)

| Item | Rules | Why it is exact |
|---|---|---|
| **Expert Knowledge** (gij2, `packs/gijcrbitems/_source/Expert_Knowledge_9H78lRwXzJW6tj9e.json`) | A ChoiceSet `skill` (list: Alertness, Culture, Science, Survival, Technology, `legacy: "flags.essence20.gij2ExpertSkill"`). A Use, "Choose the area of study": `pick {key: skill, from: list}` over the same five Skills. Three afterRoll Triggers, each `when: ["skill:{choice.skill}"]`, each posting one chat line: `outcome: "plainSuccess"` (1 extra benefit), `outcome: "double"` (2), and `outcome: ["fumble", "x2"]` (2). | The old post-roll hook checked the rolled Skill (`riderContext.skill`, which the afterRoll Trigger reads as `skill:`) against the item's pick, needed some result to succeed, and said 2 when `isCrit` or a success had a multiplier of 2+, else 1. `double` matches a crit or a success at double the DIF. `plainSuccess` is a success that is neither. A Fumble whose roll still doubled the DIF is the third Trigger. The three never overlap, so one roll posts at most one card. The old hook asked on `createItem` and on the Use. The ChoiceSet asks when the item is added (rules/lifecycle.mjs), and the Use's `pick` (no `ifUnset`) asks again. `legacy` moves an existing pick. |
| **Energy Resistant** (gij2, `packs/gijcrbitems/_source/Energy_Resistant_lKnjgN4TdHHNktpF.json`) | A ChoiceSet `element` (list: Acid, Cold, Electric, EMP, Fire, Laser, Sonic, `legacy: "flags.essence20.gij2Element"`). A Use, "Choose the Element", with the same `pick`. Seven DerivedStats, one per Element: `path: system.resistances.<element>`, `op: set`, `value: 1`, `when: ["rule:data:flags.essence20.rules.choices.element=<element>"]`. | The old derived hook set `resistances[element] = true` while the upgrade was loose or its armor was equipped. An upgrade's rules are active under exactly those conditions (`rules/index.mjs#isItemActive`). Each DerivedStat writes only for its own Element. Every reader of `system.resistances` tests truthiness (dice.mjs's Resistance checks, combat.mjs, the sidebar's `formatBooleanList`, studious-measures), so `1` reads the same as `true`. The pick paths are as for Expert Knowledge. The Transformers "Energy Resistor" shares the `_id`, but the old code matched only the GI Joe uuid, so only the GI Joe file gets rules. |
| **Ghost** (situational1, `packs/gijcrbitems/_source/Ghost_MKK6kj54yVmCliPd.json`) | A Toggle `hiding` with `legacy: "actor.flags.essence20.s1GhostHiding"`. A Use, "Start or stop hiding": `setToggle {key: hiding, value: toggle}`, then with `self:toggle:hiding`: `mark ghostHiding`, `applyCondition invisible`, a chat line; with `not:self:toggle:hiding`: `unmark ghostHiding`, `removeCondition invisible`, a chat line. | The old Use flipped an actor flag and set Invisible to match. Now the Toggle holds the state, and the Toggle `legacy` added this round moves the old actor flag into it, so a character hiding today stays hiding. `applyCondition` with no rounds is `toggleStatusEffect(..., {active: true})` (mechanics/combat/timed-status.mjs). `removeCondition` removes it only when present, which is the same end state as the old unconditional switch-off. The `ghostHiding` mark mirrors the toggle so Arashikage Shozoku's rules can ask whether Ghost is hiding (a rule can't read another item's toggle). |
| **Arashikage Shozoku** (situational1, `packs/iafav2items/_source/Arashikage_Shozoku_TBpflYvZ0lWQ65Cp.json`) | A Use, "Vanish (DIF 20 Infiltration)": `cost: {action: free}`, `when: ["rule:data:flags.essence20.parentId"]`, `roll {skill: infiltration, dif: 20}`. `onSuccess`: `mark shozoku`, `applyCondition invisible`, a chat line. `onFail`: a chat line. Two Triggers, on `turnStart` and on `takesDamage`, each `when: ["self:marked:shozoku"]`: `unmark shozoku`, then `removeCondition invisible` with `when: ["not:self:marked:ghostHiding"]`. | The old Use paid the Free action, rolled the same `grants.mjs#rollTest(actor, 'infiltration', 20)`, and on a success stamped the actor and set Invisible. Its turn-start hook ended the effect at the actor's next turn start (the stamp was always from an earlier turn). Out of combat, the "manual" stamp also ended at the first turn start or on damage. The rule mark has no duration, and the `turnStart` Trigger ends it at the next turn start in either case. The damage hook ended it on any damage dealt (`dealt > 0`), which is when `takesDamage` fires. Both endings kept Invisible while Ghost was hiding, which the `ghostHiding` mark answers. The Use shows only while the upgrade is attached (`parentId`) and its armor worn, as the old `wornArmorUpgrades` check did. The Triggers post nothing, as the old endings were silent. |

Removed:
- **Expert Knowledge / Energy Resistant:** in `gij2/perks.mjs`, `EXPERT_FLAG`, `ELEMENT_FLAG`, `ELEMENTS`, `smartsSkills`, `chooseExpertSkill`, `chooseElement`, their two `CHOOSERS` entries, Energy Resistant's branch of `perkDerived`, and `expertKnowledgePostRoll` with its `registerPostRoll`. `G2.expertKnowledge` and `G2.energyResistant` are gone from `gij2/shared.mjs`. The Expert Knowledge test is gone from `gij2/gij2.test.js`, and the Mentor / Energy Resistant test now covers Mentor only. Mentor keeps its chooser, its `createItem` hook and `perkDerived`.
- **Ghost / Arashikage Shozoku:** in `situational1/situational1.mjs`, `S1.ghost`, `S1.arashikageShozoku`, `FLAG.hiding`, `FLAG.shozoku`, the `s1-ghost` and `s1-arashikage` Uses, the Shozoku half of `situationalTurnStart`, `endShozoku`, `situationalAfterDamage` with its `registerAfterDamage` and the now-unused import. Neither had a slice test.

The new tests are in `module/rules/conv4-slC4.test.js`. They load the pack items and cover what the old tests asserted,
plus the rest of the old code paths:
- **Expert Knowledge** (through `mechanics/item-hooks.mjs#runPostRoll`, as target-riders.mjs calls it): 1 benefit on a plain success in the area, none on another Skill or a failure, 2 on a crit, on double the DIF (any row), and on a Fumble that doubled. None before a pick. The ChoiceSet's options and its question on add, the Use's re-pick, and the legacy move.
- **Energy Resistant:** Resistant to the chosen Element only while worn, also when loose, nothing unpicked. The question on add, the re-pick, and the legacy move.
- **Ghost / Arashikage Shozoku:** hiding on and off. The old flag moves into the Toggle. Shozoku costs a Free action and rolls DIF 20 Infiltration. On a success it ends at the next turn start or on damage, silently. A failure sets nothing. Its ending leaves a hiding Ghost Invisible. The Use needs attached, worn armor.

## Behaviour differences worth a decision

All are same-line (the converted items themselves). None is cross-line.

**Expert Knowledge**
1. **A Fumble that still beats the DIF (but not by double)** used to post "1 benefit". Now it posts nothing. The
   engine's summary outcome for a Fumble is `fumble`, not `success`, and no outcome says "some result succeeded" to
   pair with `fumble`. It needs a natural 1 that still clears the DIF.
2. **A Critical Success that still misses the DIF** (a natural 20, or a CritOnD2 crit, against a very high DIF) used
   to post nothing. Now it posts "2 benefits", because `double` takes any crit. This is rare.
3. **Wording:** the cards are the rules' own chat lines under "Expert Knowledge (1 extra benefit)" and so on, instead
   of `Gij2ExpertKnowledgeCard`. The question on add is the ChoiceSet's ("Area of study (a Smarts Skill)"), with English
   Skill names (ChoiceSet list labels aren't localized). The Use's re-pick is localized.

**Energy Resistant**
4. **The derived value is `1`, not `true`** (a DerivedStat writes numbers). Every reader tests truthiness, so nothing
   changes on rolls, damage or the sheet.
5. **An upgrade whose `parentId` points at an item no longer on the actor** used to count as not worn. Now it counts
   as loose (active). This needs a broken attachment.
6. **Wording:** the question on add is the ChoiceSet's ("Element"), with English labels. The re-pick posts the engine's "Picked" line instead of `Gij2ChoiceSet`.

**Ghost / Arashikage Shozoku**
7. **The hiding state now shows as a Toggle in Ghost's Rules tab.** Flipping it there changes the state without
   adding or removing Invisible or the `ghostHiding` mark. Before, only the Use changed it.
8. **A character hiding under the old flag** gets the Toggle through `legacy`, but has no `ghostHiding` mark until
   they press Ghost again. If an Arashikage Shozoku ends in that window, Invisible is removed although Ghost is
   hiding. This needs both items and an old save mid-hide.
9. **Taking the Shozoku armor off while Invisible:** the upgrade's rules switch off with the armor, so its turn-start
   and damage endings don't run. Invisible stays until it is removed by hand, or the armor is worn again and the
   next turn start or damage ends it. Before, the endings ran regardless.
10. **An actor Invisible through the old Shozoku code at update time** (old flag `s1ShozokuInvisible`) has no mark,
    so nothing ends it automatically. This is a transient state.
11. **Use availability:** the old Use showed if any Arashikage Shozoku was on worn armor. Now each copy shows its
    own button only while it is attached to worn armor. This is the same with one copy.
12. **Wording:** the chat lines are the rules' own (plus the engine's "Condition" line from `applyCondition`), instead
    of `S1GhostHiding` / `S1GhostRevealed` / `S1ShozokuInvisible` / `S1ShozokuFailed`.

Not changed: the automation notes. Notes are written only via apply.cjs. The four items' notes still describe them correctly.

## Still skipped (83), and what each still needs

Where a round-4 piece now covers part of an item, that is said. Otherwise slC3's reason stands.

### gij1 (16) + fix3-gij (1)

- **Anonymous:** tags over the attacker's per-target records keyed by the wearer's uuid (`outwittedTargets`, `analyzeTargetCounts`).
- **Uniform:** a switch from the target's worn items with a count of its allies wearing the same upgrade. Step `filter` and `self:wielding:` don't reach a target's worn upgrades.
- **Recoil Brace:** a `host` item selector, an item mark with a duration, and an ItemModifier `min` on `derivedHands` while it holds.
- **Cybernetic Part, Enhanced Part, Optimized Part, Engrafted Mutation, Evolving Mutation, Outright Mutation (6):** Alteration-aware granting through `onAlterationDrop` with a "not already owned" filter and the cybernetic / genetic flag. `grant` `systemFormulas` can set flags, but not the Alteration drop flow or its filter.
- **Metier:** a rename with interpolation of the Perk itself (`grant` `name` names a granted copy, not an `updateItem` target), boolean DerivedStat writes, undoing the Assassin's poison step.
- **Extract Poison:** a roll whose DIF is the picked compendium entry's Availability, and boolean "Qualified in all poisons" writes.
- **Sea Legs:** a derived stage at the old hook's place (after gravity).
- **Improvise Bomb:** a compendium pick with a code filter, an Availability-DIF roll, a second copy on a crit, a cost that depends on another Perk.
- **Demolition Artist:** goes with Improvise Bomb.
- **Let It Rip:** as Recoil Brace, plus a `pick` filter by book source (the four Signature Weapons).
- **Scavenger:** a two-stage pick (type, then entry), a Requisition roll one Availability step harder than the picked entry, appending Temperamental to the copy's traits.
- **Angry (fix3-gij):** a tag comparing the rolled Skill with a value on the actor (`angryHangUpSnag.skill`, written by `items/rolls/angry-influence.mjs`).
- *(Pack Attack, uncounted:)* its records are written by `items/attacks/pack-attack.mjs` from the Growl bank. The expiry is "start of the user's next turn, else the scene", and neither `nextTurn` nor `turnOrScene` is that.

### gij2 (12)

- **Artillery Support:** a canvas-point / area recipient, steps delayed to the caller's next turn start, one Targeting roll per token in the radius against its own Defense, per-token damage.
- **Castling:** temporary Health that also raises `system.health.value` uncapped.
- **Fearsome Presence:** a post-roll per-target cap (the first three successes within 20 ft) that removes the Frightened `dice.mjs` applied, and a Condition-lifting mark. Step `filter` can't count "the first three".
- **Martial Artist:** a chat step with comparison placeholders (superior / equal / inferior) and whisper recipients.
- **Mentor:** `legacy` covers `gij2Mentor` (`flags.essence20.gij2Mentor.skill` / `.essence`). Still needs a DerivedStat path with `{choice.x}` (the Energy Resistant trick would take about 54 rules, one per Skill and Essence) and an Essence pick that leaves out the chosen Skill's own Essence.
- **Nose For Trouble:** a confirmable Skill + Essence swap that clears the Specialization.
- **Peerless Pilot:** an auto-pass-disembark rule type read by `vehicle-defeat.mjs`.
- **Personal Shield:** a pre-toggle veto, a Role Points switch-off step and an Impenetrable-Shield-aware EMP short-out.
- **Plan of Action:** a step editing another ally's pending ↑N, and a hidden-when check for the button.
- **Queen's Gambit:** an initiative-reorder step relayed to the GM. "Ally" is combat disposition, not canvas allegiance.
- **Reckless Abandon:** a pre-use veto for kits, a "no enemy token on the scene" tag, and a Role Points switch-off on Defeat (not with Aegis / The Beat Goes On). `until: combat` doesn't fit the minute (10 rounds) and the Defeat switch-off.
- **Roll Cage:** a vehicle-defeat crew-damage hook.

### gij3 (17)

- **Second Skin:** an asked SkillSubstitution (a chooser before the dialog).
- **Subtle Snake:** a DialogSwitch select (none / ↓1 / Snag). Two switches would not be mutually exclusive (a `stack` group compares one kind of bonus).
- **Pillage:** a `disarm` step with `maxHands` and a step moving a target's item to the actor.
- **Junker:** a `party` recipient for `gainResource` (`system.requisition.attempts`). Step `filter` narrows recipients but adds no Party recipient.
- **Targeting Eye:** its mark timing (always next round at the holder's place, the scene out of combat) matches no duration. It also needs an ItemModifier that doubles projectile ranges, skipping Scoped weapons and recording `upgradeTouched`.
- **The Sound of Angels:** a per-recipient Free-action cost, a Lend-Assistance-against-this-target grant, a weapon tag for its weapons.
- **Dreadnok Recruit:** a scene-token name tag and a turn-start Free-action spend.
- **Touch Move:** a GM-side announcement to every un-surprised ally when Initiative is rolled.
- **Early Adopter:** one button per Party member, pressable only by that member's owner and acting for that member.
- **Field Trials:** the same per-member buttons, plus "add to a list" on `updateItem` / `pickGrant` (Temperamental).
- **Peak Performance:** a step granting the base Role's top Perks outright.
- **Technical Glitch, Some Assembly Required, Complete System Failure (3):** `pick` over a target's items, a roll with a DIF from the picked item, a stored open-ended roll total (`roll {open}` now keeps `@var.rollTotal`, which covers that part), a button only the disruptor can press acting on another actor's item.
- **Better than the Best:** a natural-20 outcome bump (a multiplier change inside dice.mjs's results, not a card change).
- **Seconds Between Click & Boom (code half):** an "ignore miss effects" rule type. Reaction `negateHit` covers hits, not miss effects.
- **Takedown Expert (code half):** a Takedown-failed event, the level gate on it, a `disarm` step.

### situational1 (16 skip, 4 partial)

- **Layered Armor:** a flat (non-shift) roll bonus.
- **Environmental Warrior:** a tag matching Survival Specialization names against terrain / environment keywords.
- **Jungle Fighter:** a "terrain is set" tag (or a terrain tag falling back to a toggle), and a summed-armor formula. Toggle `legacy` could now move its `s1InJungle` actor flag.
- **Urban Jungle:** the "terrain is set" tag.
- **Urban Adaptation:** a pool sized by a level table, and per-scene chosen abilities read by Edge / Specialized / Rough Terrain.
- **Earth Defense Command Benefits:** `vehicle:moves` on the total, and pick options from the actor's own Specializations.
- **Adapted Vehicles:** a `driven`-scope check of the driver's expertise against the terrain under the vehicle.
- **Environmental Enforcer:** a multi-pick sized by Survival ranks (`pick` stores one value).
- **Environmental Camouflage:** Toggle `legacy` now covers its "in it now" flag, and `legacy` its environment. Still needs the host armor's bonuses in Defense formulas (no `@host`), with the "player character, not Morphed, not Power Armor" gate.
- **Weather Gear, Acclimating (2):** `legacy` could move Weather Gear's pick. Still needs a hazard-protection rule type (`ENVIRONMENT_PROTECTORS`).
- **Fast Tracking:** a "looks like a Contingency" tag for the pre-tick.
- **Misguide:** a rough-terrain-imposing rule type (`ROUGH_TERRAIN_IMPOSERS`) and the marked creature's current-or-next-turn window.
- **Ambush Master:** an "an enemy combatant has status X" tag (`combat:exists` is only the combat half).
- **Contort:** a Reach rule (or `totalReach` ItemModifier with `until`) and a picker between two costs.
- **Izuna Drop:** a roll on the better of two Skills, the GM damage button for unowned targets, and overflow from the target's remaining Health back onto the faller.
- **Partials, unchanged:** Spacewalker (the environment without the vessel interior), Out of the Jungle (a formula summing over items), Danger Sense (`ruleConditionImmune` passing `holder`), Every Trick in the Book (a "can't be sneak-attacked" rule).

### situational2 (21 skip, 1 partial)

- **Arctic Expedition Clothes, Desert Expedition Clothes, Desert Gear (3):** an `environment:` tag without the vessel interior, actor refresh on token Region change, per-attack additive Defense after best / halve.
- **Business:** a creature-tag prefix test, and the Defense-ordering piece.
- **Tracking Outfit (Initiative half):** a terrain tag that answers false when unset.
- **Caltrops:** `essenceDamage` now exists, and `button` with `once: false` and `runAs: clicker`. Still needs the presser's controlled token before `user.character` (the old button acts for the selected token first).
- **Tritium Sights / Rifle (Tritium Sight) (2):** a scene-darkness tag and a "the rolled weapon has upgrade X attached" tag (`self:wielding:` asks the attack, not its weapon's upgrades).
- **Seafarer (Swimming half), Seafarer (Hang-Up), Amphibious Assault (Initiative half), Shark's Fin, Ship Shape (5):** swimming / "aboard an aquatic vessel" / interior-free environment tags, a save-rider spec tag (Hang-Up), a derived stage after gravity, a `driven` Movement multiply.
- **Competitive:** a comparison of an ally's total (now `@var.total` on a watch afterRoll) with this actor's own last roll of the same Skill in the scene's recent window, both ways.
- **Forgiving:** a mark the using roll removes, and marks from several setters under one key. A `targeted` Trigger could mark the aggressor, but a RollModifier can't use the mark up.
- **Take in a Scene:** a DIF from chat history (the lowest opposing Infiltration total, +1).
- **Misplaced Confidence:** Take in a Scene with it, and a Condition held to a set round (`extendCondition` lengthens a timed one; it doesn't hold one to a round).
- **Cartography Suite, Lay of the Land (Rough Terrain half) (2):** a "surveyed this scene" tag, and an ally-aura Move-action count.
- **Plow:** a Multiple Targets grant rule type (also for a driven vehicle) and a this-turn mark read by MovementAction.
- **Bookworm (Initiative half):** a "a hostile combatant matches target: tags" tag.
- **Partial, unchanged:** Feet Wet (the "aboard an aquatic vessel" tag).

Already-converted items were not changed. `combat:exists` could narrow slC3's Ceremonial / Primal Fear differences
(an unstarted combat counting as "out of combat"), but their `turnOrScene` durations read a running combat, so a tag
alone would not make them match.

## Edits outside my files

None. The only files touched are in my slice folders (`gij2/perks.mjs`, `gij2/shared.mjs`, `gij2/gij2.test.js`,
`situational1/situational1.mjs`), my 4 pack files, `module/rules/conv4-slC4.test.js` and this write-up.

## Unused strings

These `lang/en.json` keys are no longer used anywhere in `module/`, `templates/` or `tours/`:
- Expert Knowledge: `E20.Gij2ExpertKnowledgeCard`, `E20.Gij2ExpertKnowledgePrompt`
- Energy Resistant: `E20.Gij2ElementPrompt`
- Ghost: `E20.S1GhostHiding`, `E20.S1GhostRevealed`
- Arashikage Shozoku: `E20.S1ShozokuFailed`, `E20.S1ShozokuInvisible`

(`E20.Gij2ChoiceSet` is still used by Mentor.)

## Rules added

19 rules in 4 pack files, each a new `rules` array inserted as text with CRLF kept:
- Expert Knowledge: 5 (ChoiceSet, Use, 3 Triggers).
- Energy Resistant (GI Joe CRB): 9 (ChoiceSet, Use, 7 DerivedStats).
- Ghost: 2 (Toggle, Use).
- Arashikage Shozoku: 3 (Use, 2 Triggers).

## Engine pieces the remaining skips need (most useful first)

1. **Position tags:** "terrain is set", interior-free `environment:`, swimming, aboard an aquatic vessel, scene
   darkness, plus a refresh on Region change. Unblocks Jungle Fighter, Urban Jungle, Tracking Outfit, the three
   Expedition / Desert clothes, Seafarer x2, Amphibious Assault, Shark's Fin, Ship Shape, Feet Wet, Spacewalker, Tritium
   Sights x2 (about 16 items). **Medium.**
2. **Target-item steps:** `pick` over a target's items, a roll with a DIF from a picked item (or compendium entry's
   Availability), `disarm` with `maxHands`, taking a target's item. Unblocks Pillage, Takedown Expert, the 3 Disruptor
   Perks, Extract Poison, Improvise Bomb + Demolition Artist, Scavenger (about 9). **Medium-large.**
3. **DerivedStat `{choice.x}` paths and boolean writes,** plus a pick whose options depend on an earlier pick.
   Unblocks Mentor, Metier, Extract Poison's "Qualified" half. It would also shrink Energy Resistant's 7 rules to 1. **Small.**
4. **`@host.<path>` in formulas** (the item an upgrade is attached to). Unblocks Environmental Camouflage, and helps
   Recoil Brace / Let It Rip. **Small.**
5. **Per-member buttons:** one button per Party member, pressable by that member's owner and acting for them; and a
   `runAs: clicker` that prefers the presser's controlled token. Unblocks Early Adopter, Field Trials, Caltrops. **Small-medium.**
6. **Item marks with a duration plus a `host` selector,** read by an ItemModifier `min` on `derivedHands`. Unblocks
   Recoil Brace, Let It Rip. **Medium.**
7. **Rule types read by hand-written registries:** hazard protection (Weather Gear, Acclimating), rough-terrain
   imposers (Misguide), Multiple Targets grants (Plow), auto-pass disembark (Peerless Pilot), "can't be sneak-attacked"
   (Every Trick in the Book), "ignore miss effects" (Seconds Between Click & Boom), vehicle-defeat crew damage (Roll
   Cage). **Small each.**
8. **An outcome "some result succeeded"** (to pair with `fumble` / `crit` in an outcome list). It would make Expert
   Knowledge's two edge cases exact. **Small.**
9. **A "use up a mark when the roll it boosts is made"** (`consumeMark` on a RollModifier) and multi-setter marks.
   Unblocks Forgiving, and part of Fearsome Presence. **Small-medium.**
10. **Tags:** "an enemy combatant has status X" (Ambush Master), "a hostile combatant matches target: tags" (Bookworm's
    Initiative half), a Survival-Specialization keyword match (Environmental Warrior), a rolled-Skill-vs-actor-value
    compare (Angry), a creature-tag prefix (Business), "looks like a Contingency" (Fast Tracking). **Small each.**
11. **Effectively permanent code** (bespoke UI or whole subsystems): Artillery Support (area strikes), the six
    Alteration parts (Alteration drop flow), Urban Adaptation (level-table pool with per-scene abilities), Queen's Gambit
    (initiative reorder via the GM), Personal Shield / Reckless Abandon (Role Points activation with vetoes), Plan of
    Action's split, Nose For Trouble's confirm-swap, Martial Artist's whispered comparison, Take in a Scene / Misplaced
    Confidence / Competitive (chat-history reads), Izuna Drop, Touch Move / Dreadnok Recruit
    announcements, Anonymous / Uniform (per-target records), Second Skin / Subtle Snake (dialog selects), Better than the
    Best (dice.mjs multiplier), Peak Performance, The Sound of Angels, Targeting Eye, Contort, Environmental Enforcer,
    Earth Defense Command Benefits, Adapted Vehicles, Cartography Suite / Lay of the Land, Sea Legs, Junker.
