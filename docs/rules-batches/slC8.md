# Batch slC8: re-check of slC7's skips (`gij1`, `gij2`, `gij3`, `fix3-gij`, `situational1`, `situational2`) against the round-8 engine pieces

**Scope:** every item `docs/rules-batches/slC7.md` left **Still skip** (62) or **Partial** (7: Extract Poison, Jungle Fighter,
Out of the Jungle, Danger Sense, Every Trick in the Book, Seafarer (Hang-Up), Shark's Fin) in the six slC slices, re-checked
against the guide's section "Engine features added 2026-10-06 (round 8, after the local round-7 conversions)": marks per
setter (`perSetter`, `markedByMe:`, `@target.myMark`), `@sum.items|equipped`, `@count.named`, `atLeast()`, `until: mission`,
`self:combatant`, `scene:token:<tags>`, `pick from: actors` + `actorType`, `setVar`, the `updateActor` ladder, the `itemAdded` /
`movedOnTurn` events, WeaponTrait rules seeing the weapon id, button limits counting only finished runs and Rest not counting
as `resourceSpent`. The earlier sections were checked again too (`targeted` Triggers, `beforeCost`, `vehicle:` tags, `driven`
Triggers, `turnOrUntilCombat` marks), and so were the behaviour differences slC3-slC7 recorded: two of slC3's Primal Fear
differences are removed by `perSetter` and `beforeCost` (below). Edited in place in the shared checkout (no branch, no commit).

| Verdict (re-checked items) | gij1 + fix3-gij | gij2 | gij3 | situational1 | situational2 | Total |
|---|---|---|---|---|---|---|
| Convert (now fully rules) | 0 | 0 | 0 | 2 | 1 | **3** |
| Partial (newly, part converted) | 0 | 0 | 0 | 1 | 1 | **2** |
| Partial, nothing more converts | 1 | 0 | 0 | 2 | 2 | **5** |
| Still skip | 13 | 11 | 15 | 11 | 9 | **59** |
| Re-checked | 14 | 11 | 15 | 16 | 13 | **69** |

Plus one already-converted item fixed: **Primal Fear** (gij1, slC3), whose rules now remove two recorded differences.

After this part, `scripts/check-rules.mjs` reports no errors or warnings (1926 rules on 1188 items in the shared checkout).
ESLint is clean on the files touched (`situational1/`, `situational2/`, `module/rules/conv8-slC8.test.js`). Jest passes on the
six slice folders and all of `module/rules/` (1803 tests), including `conv8-slC8.test.js` (18 tests) and `conv3-slC3.test.js`
(Primal Fear's original tests, unchanged). No slice file became empty, so `extensions/index.mjs` is unchanged.

## Converted

| Item | Rules | Why it is exact |
|---|---|---|
| **Jungle Fighter** (situational1, light-armor half - the item is now fully rules; `packs/sssitems/_source/Jungle_Fighter_RWgIeFdT0c1vIcS1.json`) | Two RollModifiers (appended), `stack: jungleFighterSilent`, `upshift: "@sum.equipped.armor.system.totalBonusToughness + @sum.equipped.armor.system.totalBonusEvasion"`, `when: [skill:infiltration, <in the jungle>, not:self:wearingItem:item:type:armor&not:item:data:system.classification=light, not:self:wearingItem:item:type:armor&item:data:system.isPowerArmor, not:self:wearingItem:item:type:armor&item:trait:silent]`; "in the jungle" is `[terrain:set, terrain:woodlands]` on one and `[not:terrain:set, self:toggle:inJungle]` on the other (the Perk's existing split). | The old source added, on Infiltration, ↑ equal to the summed Toughness + Evasion bonus of every worn light, non-power, non-Silent armor, when `isInJungle` (woodlands, or the toggle where no terrain is set) or with Out of the Jungle. With every worn armor of that kind (one armor - the normal case), `@sum.equipped.armor` is that same sum; a zero sum lists nothing, as before. |
| **Out of the Jungle** (situational1, now fully rules; `.../Out_of_the_Jungle_5jc5fjieruLuWQm1.json`) | The same RollModifier with no terrain condition, same `stack`. | Anywhere, as the old `has(actor, outOfTheJungle)` branch. The shared `stack` keeps a holder of both Perks to one ↑, as the old single source. |
| **Forgiving** (situational2, `packs/mlpcrbitems/_source/Forgiving_985JSL4ANRcKb1EX.json`) | A Trigger `event: targeted`, `when: [{any: [attack, skill:intimidation]}, not:target:self]`: `mark {to: target, key: forgivingAggressor, perSetter: true}`. A RollModifier `edge: true`, `when: [skill:choiceOf:<Empathy (MLP) uuid>, markedByMe:forgivingAggressor]`. Two Triggers, `event: hit` and `event: miss`, same `when`: `unmark {to: target, key: forgivingAggressor, perSetter: true}`. | The old post-roll hook logged the roller on every targeted row (hit or not) of an attack (a weapon effect) or an Intimidation test, on any Forgiving holder but the roller - `targeted` fires on each row's target, the attacker as its `target`. The old source gave Edge on the holder's Empathy choice (`getEmpathyChoice` - the same item's `system.choice` that `skill:choiceOf:` reads) against a logged target, and its consumer removed that one entry. The mark is kept per holder, so another Forgiving holder's record of the same aggressor stays, as with the old per-holder lists; the hit / miss Triggers take off only this holder's. |

### Partial

| Item | Converted part | What stays code |
|---|---|---|
| **Earth Defense Command Benefits** (situational1, `packs/fgtaaitems/_source/Earth_Defense_Command_Benefits_uQQbRbwADVtVwsym.json`) | Two RollModifiers ↑2 (appended): `when: [skill:driving, not:self:type:vehicle, vehicle:driving, vehicle:type:vehicle, vehicle:data:system.movement.aerial.total>0]`, and `when: [skill:driving, self:type:vehicle, self:data:system.movement.aerial.total>0]`. The old source: on Driving, the vehicle the holder drives (role driver) - or the holder itself when it is a vehicle - with Aerial Movement. | The Space Kit Use (`makeKit` from the actor's own Specializations). |
| **Plow** (situational2, `packs/tfcrbitems/_source/Plow_y7VBydpKD8O63C3b.json`) | A Trigger `event: afterRoll`, `outcome: any`, `when: [attack:ram]`: `mark {to: self, key: plowRam, until: turnOrUntilCombat}`; the same with `scope: driven` and `self:type:vehicle` (the vehicle the holder drives, rolling its own Ram); a MovementAction `ignoreRoughTerrain`, `when: [self:marked:plowRam]`, and its `scope: driven` twin with `self:type:vehicle`. The old pre-roll stamp marked the Ram's roller (holder, or a vehicle with a Plow driver) for the current combat turn (out of combat, until a combat), read by `ROUGH_TERRAIN_IGNORERS`. | The Multiple Targets (3) grant (`MULTIPLE_TARGETS_GRANTS`, `plowMultipleTargets`). |

### Primal Fear (gij1, converted in slC3) - two recorded differences removed

`packs/ccitems/_source/Primal_Fear_xoD8fbVVqymTidNJ.json`: the Use's `target` step gains `beforeCost: true`, and its four
`mark` steps gain `perSetter: true` (its RollModifier already reads `markedByMe:primalFear`, which finds a per-setter mark).
- slC3 difference 1, first half: with nothing targeted the Free action is no longer paid - as the old code. (A cancelled
  Defense question still pays it: running the `choose` before the cost would also run the roll before paying.)
- slC3 difference 3, second half: two Primal Fear holders unnerving the same creature now both keep their ↑1 - the later
  mark no longer replaces the earlier.

### Removed code

- **situational1/situational1.mjs:** `isInJungle`, `lightArmorNoise`, the Jungle Fighter block and the Earth Defense Command
  Driving block of `situationalRollSources` (its `rolledSkill` destructuring went with them), `crewedVehicleOf`,
  `S1.jungleFighter`, `S1.outOfTheJungle`, the `toggleOf` import (`S1.earthDefenseCommand` stays for the Space Kit Use).
- **situational2/situational2.mjs:** Forgiving's roll-source block, `situational2PostRoll` + its `registerPostRoll`, the
  `s2Forgiving` consumer, `isPlowRamActive`, `situational2PreRoll` + its `registerPreRoll`, Plow's branch of
  `ignoresRoughTerrainS2`, the `getEmpathyChoice` import, the `registerPostRoll` / `registerPreRoll` imports; the roll-source
  function's `target` argument is now `_target`. **situational2/common.mjs:** `S2.forgiving`, `FLAG.forgiving`, `FLAG.plowRam`.
- **Tests:** situational1.test.js's two Jungle Fighter tests (now one: the slice adds nothing for either Perk) and its Earth
  Defense test (now: no Driving source); situational2.test.js's Forgiving test (now: no source, no post-roll hook) and the
  Plow test's stamp half (now: no pre-roll hook, `ignoresRoughTerrainS2` false; the Multiple Targets half stays).

The new tests are in `module/rules/conv8-slC8.test.js` (18 tests). They cover what the old ones asserted, plus: Jungle
Fighter / Out of the Jungle - the summed ↑ (Toughness 1 + Evasion 2 = ↑3), Infiltration only, nothing for heavy / Silent /
power / unworn / bonus-less armor, the woodlands / toggle / desert cases, one ↑ for both Perks; Earth Defense - driver only,
not a passenger, no Aerial Movement, a Zord or on foot, a vehicle holding it; Forgiving - a missed attack and an Intimidation
test both count, another Skill Test doesn't, Edge only against that aggressor and only on the Empathy Skill, forgiven by the
holder's Empathy roll (hit or miss) and remembered again after, two holders' records independent, nothing when rolling
against oneself; Plow - the Ram's turn only, not another attack, out of combat until a combat starts, the driven vehicle's
own Ram (and not a vehicle the holder only rides in); Primal Fear - no Free action paid with nothing targeted, two hunters
both keep ↑1.

## Behaviour differences worth a decision

All same-line.

**Jungle Fighter / Out of the Jungle**
1. **Several armors worn at once:** the ↑ now needs every worn armor to be light, non-power and non-Silent, and is then their
   total. A light armor worn with a heavier / power / Silent one now gives nothing; the old code still handed back the light
   one's share. One worn armor (the normal case) is the same.
2. **An armor made Silent by an attached upgrade** (a trait in `itemAndUpgradeTraits` but not `system.traits`) now gets no ↑;
   the old code read `system.traits` only (as `noisyArmorPenalty` does, so that armor's penalty is now not handed back).
3. **Wording / source:** the source reads "Jungle Fighter (light armor counts as Silent)" or "Out of the Jungle (...)" instead
   of the Perk's name; a holder of both sees whichever item comes first.

**Earth Defense Command Benefits**
4. **Which vehicle:** the rules' crew lookup (vehicles and Zords, first found) - a character on a Zord's crew roster listed
   before the vehicle it drives gets nothing. Aerial Movement is read from `total` only (derived data always sets it; the old
   code fell back to `base`).

**Forgiving**
5. **The record sits on the aggressor** (a per-holder mark) instead of a list on the holder. Aggressors already in the old
   list (`s2ForgivingAggressors`) are forgotten.
6. **Forgiving happens after the Empathy roll** (its hit / miss Trigger), on every target row of it this holder had marked; the
   old consumer took only the first target's entry, when the roll was made.
7. **Wording:** the Edge's source reads "Forgiving (Empathy against an aggressor)".

**Plow**
8. **The mark is set after the Ram's roll,** not before it: a Ram cancelled in the Roll Options Dialog no longer counts.
9. **Out of combat** it lasts until a combat starts (survives a scene change and a set-up, unstarted combat); the old stamp
   ended as soon as any combat was set up. Old stamps (`s2PlowRam`) are ignored - transient.

Not changed: the automation notes (written only via apply.cjs). The converted items' notes still describe them.

## Still skipped (59), and what each still needs

"Permanent" = effectively permanent code (bespoke UI or a whole subsystem); otherwise the engine piece is named.

### gij1 (12) + fix3-gij (1), plus 1 partial

- **Anonymous:** permanent-ish - tags reading the attacker's own per-target records (`outwittedTargets`, `analyzeTargetCounts`, keyed by the wearer's uuid) kept by dice.mjs; needs those records moved onto marks.
- **Uniform:** a count formula over allies' worn items (`@count.allies.<ft>` filtered by `target:wearingItem:...`).
- **Cybernetic Part, Enhanced Part, Optimized Part, Engrafted Mutation, Evolving Mutation, Outright Mutation (6):** permanent - Alteration-aware granting through `onAlterationDrop` with a "not already owned" filter.
- **Metier:** renaming the rule's own item with a pick, and a derived stage before `_preparePoisonTraining`.
- **Improvise Bomb, Demolition Artist (2):** a compendium pick with a code filter, an Availability-DIF roll, a second copy on a crit, a cost depending on another Perk.
- **Scavenger:** a two-stage pick (type, then entry), a Requisition roll one Availability step harder, appending Temperamental.
- **Angry (fix3-gij):** a tag comparing the rolled Skill with a value on the actor (`skill:data:<path>`).
- **Extract Poison (Use; partial, unchanged):** a roll whose DIF is a picked compendium entry's Availability.

### gij2 (11)

- **Artillery Support:** permanent - an area strike delayed to the caller's next turn, a Targeting roll per token.
- **Castling:** permanent here - only a chat note on castling.mjs's own Use card (outside the slice).
- **Fearsome Presence:** marks per setter exist now; still needs a post-roll per-target cap (first three within 20 ft) undoing dice.mjs's Frightened, and the Frightened lifted at the setter's next turn start.
- **Martial Artist:** permanent - whispered comparison words from `getDefenseValue`.
- **Nose For Trouble:** permanent - a confirmable Skill + Essence swap that clears the Specialization.
- **Peerless Pilot:** an auto-pass-disembark rule type read by `vehicle-defeat.mjs`.
- **Personal Shield:** permanent - a pre-toggle veto, a Role Points switch-off, an Impenetrable-Shield-aware EMP short-out.
- **Plan of Action:** permanent - a step editing another ally's pending ↑N.
- **Queen's Gambit:** permanent - an Initiative reorder relayed to the GM.
- **Reckless Abandon:** `scene:token:` now answers "an enemy token is left" (but not the token's own `hidden` flag); still needs a step switching off another item's Role Points `isActive` (with the Aegis defeat check), a kit-use veto, and the Defeat switch-off. Effectively permanent.
- **Roll Cage:** a vehicle-defeat crew-damage hook.

### gij3 (15)

- **Second Skin:** an asked SkillSubstitution (a chooser before the dialog).
- **Subtle Snake:** a DialogSwitch select (none / ↓1 / Snag).
- **Pillage:** a `disarm` step with `maxHands`, and moving a target's item to the actor.
- **The Sound of Angels:** permanent-ish - a per-recipient Free-action cost and a Lend-Assistance grant against this target.
- **Dreadnok Recruit:** `scene:token:not:target:type:playerCharacter&target:name~dreadnok` now finds the Dreadnok; still needs a `spendAction` step (a turnStart Trigger spending a Free action through action-economy's `spend`).
- **Touch Move:** permanent - a GM-side announcement listing every un-surprised ally by name.
- **Early Adopter, Field Trials (2):** the button limit now counts only finished runs; still needs a roster tag for the presser (`self:inPartyOf:holder`, and keeping the holder out for Early Adopter) and `pickGrant` `appendTraits` (Field Trials' Temperamental on the granted upgrade).
- **Peak Performance:** a step granting the base Role's top Perks outright.
- **Technical Glitch, Some Assembly Required, Complete System Failure (3):** `pick` over a target's items, a DIF from the picked item, a button only the disruptor can press acting on another actor's item.
- **Better than the Best:** permanent - a natural-20 outcome bump inside dice.mjs's results.
- **Seconds Between Click & Boom (code half):** an "ignore miss effects" rule type.
- **Takedown Expert (code half):** a Takedown-failed event, the level gate, a `disarm` step.

### situational1 (11 skip, 2 partials unchanged)

- **Layered Armor:** a flat (non-shift) roll bonus.
- **Environmental Warrior:** a tag matching Survival Specialization names against terrain / environment keywords.
- **Urban Adaptation:** permanent - a level-table pool with per-scene chosen abilities.
- **Adapted Vehicles:** a `driven`-scope check of the driver's expertise against the terrain under the vehicle.
- **Environmental Enforcer:** permanent-ish - a multi-pick sized by Survival ranks.
- **Weather Gear, Acclimating (2):** a hazard-protection rule type (`ENVIRONMENT_PROTECTORS`).
- **Fast Tracking:** a "looks like a Contingency" tag for the pre-tick.
- **Misguide:** a rough-terrain-imposing rule type and the marked creature's current-or-next-turn window.
- **Contort:** a Reach rule (or `totalReach` ItemModifier with `until`) and a picker between two costs.
- **Izuna Drop:** permanent - a roll on the better of two Skills, the GM damage button for unowned targets, overflow back onto the faller.
- **Partials, unchanged:** Danger Sense (`ruleConditionImmune` passing `holder`), Every Trick in the Book (a "can't be sneak-attacked" rule type). Earth Defense Command Benefits' Space Kit half is permanent (`makeKit`).

### situational2 (9 skip, 2 partials unchanged)

- **Arctic Expedition Clothes, Desert Expedition Clothes, Desert Gear (3):** the "not against a creature's attack" -2 at attack time applied after best / halve and grouped like the sheet's +2.
- **Business:** a creature-tag prefix test (`strex*`), and the same Defense ordering.
- **Competitive:** permanent - comparing an ally's total with this actor's own last roll of the same Skill (chat history).
- **Take in a Scene:** permanent - a DIF from chat history.
- **Misplaced Confidence:** permanent - Take in a Scene with it, and a Condition held to a set round.
- **Cartography Suite, Lay of the Land (Rough Terrain half) (2):** a "surveyed this canvas scene" tag (tied to the canvas scene's id, not the Scene Clock), and an ally-aura Move-action count.
- **Partials, unchanged:** Seafarer (Hang-Up) (a poison-save tag), Shark's Fin (an "Initiative is being rolled" event fired before the formula). Plow's Multiple Targets half needs a Multiple Targets grant rule type.

## Edits outside my files

None.

## Unused strings

None - the removed code used no `lang/en.json` keys (its sources were labelled with the items' own names).

## Rules added

13 rules in 5 pack files (all LF; inserted as text, each file's line endings kept), plus an edit to one more:
- Jungle Fighter: +2 RollModifiers (appended). Out of the Jungle: +1 RollModifier (appended). Earth Defense Command Benefits:
  +2 RollModifiers (appended). Forgiving: 1 RollModifier, 3 Triggers. Plow: 2 Triggers, 2 MovementActions.
- Primal Fear: no new rules; `beforeCost: true` on its `target` step and `perSetter: true` on its four `mark` steps.

## Engine pieces the remaining skips need (most useful first)

1. **Target-item steps:** `pick` over a target's items or a compendium entry, a roll whose DIF is the picked entry's
   Availability, `disarm` with `maxHands`, moving a target's item to the actor. Unblocks Pillage, Takedown Expert, the 3
   Disruptor Perks, Extract Poison's Use, Improvise Bomb + Demolition Artist, Scavenger (about 9). **Medium-large.**
2. **Per-member picks off one card:** a roster tag for a clicker run (`self:inPartyOf:holder`, and a way to keep the holder
   out) plus `grant` / `pickGrant` `appendTraits`. Unblocks Early Adopter, Field Trials (2). **Small.**
3. **Roll-time Defense additions after best / halve, grouped by `stack`,** plus a creature-tag prefix tag. Unblocks the three
   exposure clothes and Business (4). **Small-medium.**
4. **A `spendAction` step** (spend a Free / Move / Standard action through action-economy's `spend`, for a Trigger). With
   `scene:token:` it unblocks Dreadnok Recruit (1). **Small.**
5. **Small tags and events:** an "Initiative is being rolled" event before the formula (Shark's Fin); a poison-save tag
   (Seafarer Hang-Up); `ruleConditionImmune` passing `holder` (Danger Sense); rolled Skill vs an actor value (Angry); "looks
   like a Contingency" (Fast Tracking); a Survival-Specialization keyword match (Environmental Warrior); "surveyed this canvas
   scene" plus an ally-aura Move-action count (Cartography Suite, Lay of the Land). Would finish 2 partials and up to 6 skips.
   **Small each.**
6. **Rule types read by hand-written registries:** hazard protection (Weather Gear, Acclimating), rough-terrain imposers
   (Misguide), Multiple Targets grants (Plow's other half), auto-pass disembark (Peerless Pilot), "can't be sneak-attacked"
   (Every Trick in the Book), "ignore miss effects" (Seconds Between Click & Boom), vehicle-defeat crew damage (Roll Cage).
   **Small each.**
7. **A post-roll per-target cap on a Condition the roll applied** (keep it on the first N targets within X ft, lift the rest),
   with the Condition lifted at the setter's next turn start. Unblocks Fearsome Presence (1). **Small-medium.**
8. **Renaming the rule's own item with a pick, and a derived stage before `_preparePoisonTraining`.** Unblocks Metier.
   **Small-medium.**
9. **A count formula over allies' worn items** (`@count.allies.<ft>` with a `target:wearingItem:` filter). Unblocks Uniform.
   **Small.**
10. **Effectively permanent code** (bespoke UI or whole subsystems): Artillery Support (area strikes), the six Alteration parts
    (Alteration drop flow), Urban Adaptation (level-table pool with per-scene abilities), Queen's Gambit (Initiative reorder
    via the GM), Personal Shield / Reckless Abandon (Role Points activation with vetoes and the Aegis defeat check), Plan of
    Action's split, Nose For Trouble's confirm-swap, Martial Artist's whispered comparison, Take in a Scene / Misplaced
    Confidence / Competitive (chat-history reads), Izuna Drop, Touch Move's announcement, Anonymous (dice.mjs's per-target
    records), Second Skin / Subtle Snake (dialog selects), Better than the Best (dice.mjs multiplier), Peak Performance, The
    Sound of Angels, Contort, Environmental Enforcer, Earth Defense Command Benefits' Space Kit, Adapted Vehicles, Castling
    (its Use lives in castling.mjs).
