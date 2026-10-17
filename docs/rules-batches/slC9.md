# Batch slC9: re-check of slC8's skips (`gij1`, `gij2`, `gij3`, `fix3-gij`, `situational1`, `situational2`) against the round-9 engine pieces

**Scope:** every item `docs/rules-batches/slC8.md` left **Still skip** (59) or **Partial** (7: Extract Poison, Danger Sense,
Every Trick in the Book, Earth Defense Command Benefits, Plow, Seafarer (Hang-Up), Shark's Fin) in the six slC slices,
re-checked against the guide's section "Engine features added 2026-10-06 (round 9, after the local round-8 conversions)":
`to: picked:<key>`, `rollVsEach`, `disarm`, `takeItem`, `spendAction`, `pick from: targetItem`, `pick from: skill`
`minShift`/`maxShift`, `pickGrant {record}` + `item:pickedSource:`, tracked temporary Health, `grant {appendTraits}`,
`ladderMax`/`ladderMin`, `quiet`, `@sum.equippedTrait`, the `removed` / `droppedToZero` events and afterRoll `@var.skill`.
The earlier sections were read again too (`choose` options with `when`, `scene:token:`, `self:actionUsed:`, button
limits, `item:id:`, `roll:switch:`), and so were the behaviour differences slC3-slC8 recorded - none of them is removed by
a round-9 piece. Edited in place in the shared checkout (no branch, no commit).

| Verdict (re-checked items) | gij1 + fix3-gij | gij2 | gij3 | situational1 | situational2 | Total |
|---|---|---|---|---|---|---|
| Convert (now fully rules) | 0 | 0 | 2 | 0 | 0 | **2** |
| Partial, nothing more converts | 1 | 0 | 0 | 3 | 3 | **7** |
| Still skip | 13 | 11 | 13 | 11 | 9 | **57** |
| Re-checked | 14 | 11 | 15 | 14 | 12 | **66** |

After this part, `scripts/check-rules.mjs` reports 0 errors and 0 warnings (1954 rules on 1197 items in the shared
checkout). ESLint is clean on the files touched (`gij3/`, `module/rules/conv9-slC9.test.js`). Jest passes on the six slice
folders and all of `module/rules/` (53 suites, 1765 tests), including `conv9-slC9.test.js` (9 tests). No slice file became
empty, so `extensions/index.mjs` is unchanged.

## Converted

| Item | Rules | Why it is exact |
|---|---|---|
| **Pillage** (gij3, `packs/qgtgitems/_source/Pillage_G7bEjhamqov7tb9w.json`, on the Perk) | A DialogSwitch `downshift: 1`, `key: pillageTwoHanded`, `forget: true`, `when: [{any: [item:id:Gij3PillageFin01, item:id:Gij3PillageMgt01]}]`. Two Triggers `event: hit`, same `when` plus `not:roll:switch:pillageTwoHanded` / `roll:switch:pillageTwoHanded`: `disarm {maxHands: 1 \| 2, required: true}`, then `choose` "Take it" (`pick {key: pillaged, from: targetItem, itemType: weapon, filter: [item:data:flags.essence20.disarmed, not:item:data:system.equipped], auto: true}`, `takeItem {item: choice:pillaged}`) or "Let it fall nearby" (a chat line). | The old switch (offered to the Perk's holder on the two Pillage attacks only, always unticked) added ↓1 and let the hit take a two-handed weapon; the old hit rider ran `target-riders.mjs#disarm` with `maxHands` 1 or 2 - the same helper the `disarm` step calls - and stopped when nothing was dropped, then asked take / drop and, on take, moved the item (unequipped) to the attacker. The weapon `disarm` just dropped is the target's unequipped, disarmed-flagged weapon the `pick` takes without asking. |
| **Dreadnok Recruit** (gij3, `packs/iafav2items/_source/Dreadnok_Recruit_QIoKmEIelV7it5xE.json`) | A Trigger `event: turnStart`, `when: [{any: [scene:token:not:target:type:playerCharacter&target:name~dreadnok, self:marked:dreadnokPresent]}]`: a chat line, then `spendAction {action: free}`. A Use `when: [not:self:marked:dreadnokPresent]`: `mark {to: self, key: dreadnokPresent, until: scene}` and a chat line. | The old turn-start hook spent a Free action through `action-economy.mjs#spend` (the function `spendAction` calls) and posted a line - whether or not the spend went through, hence the chat step first - when another non-player actor named "Dreadnok" had a token on the viewed scene, or the Hang-Up's Use had marked one present for the scene (offered only while not marked). |

### Removed code

- **gij3/gij3.mjs:** the `SWITCHES` table (Pillage's two-handed switch was its only entry) and its loops in `gij3Toggles` /
  `gij3ApplyDialog`, `pillageTwoHanded`, `isPillageEffect`, `gij3HitRider` + its `registerHitRider`; `dreadnokInScene`,
  `gij3TurnStart` + its `registerTurnStart`, the `gij3DreadnokRecruit` Use; `G3.pillage` / `pillageFinesse` /
  `pillageMight` / `dreadnokRecruit`, `FLAG.dreadnokPresent`, the `registerHitRider` / `registerTurnStart` /
  `isActiveForWindow` / `activateForWindow` imports.
- **gij3/gij3.test.js:** the Dreadnok Recruit test and the Pillage half of "Pillage effects are recognised; silenced status
  added once" (now "silenced status added once"); the registry test also checks the Dreadnok Use is gone.

The new tests are in `module/rules/conv9-slC9.test.js` (9 tests). They cover what the old ones asserted (a Dreadnok on the
scene costs a Free action and posts a line; the Pillage attacks are recognised), plus: Pillage - the switch only on the two
Pillage attacks and only for the holder, ↓1 when ticked, one-handed only without it and two-handed with it, take moves the
item to the attacker unequipped, let-fall leaves it with the target unequipped, nothing for another attack, no take/drop
question when nothing is held; Dreadnok Recruit - not for a player character named Dreadnok or another creature, the line
still posted when the action can't be paid, the Use's mark lasting the scene and the Use offered only while unmarked.

## Behaviour differences worth a decision

All same-line.

**Pillage**
1. **The taken item keeps its `disarmed` flag** (the old code cleared it on the copy). It arrives unequipped either way;
   until its new owner equips it, rolling its attacks warns that it was disarmed, and - as with any disarmed weapon its owner
   picked back up - unequipping it later warns again.
2. **Which item is taken:** the target's unequipped, disarmed-flagged weapon. If an earlier disarm left another such weapon
   on the target (never picked back up), the attacker is asked which one; the old code took the one just dropped.
3. **Taking from a creature the user doesn't own** now goes through the GM (`takeItem` relays); the old code left the item
   and posted "GM, move it".
4. **Closing the take / drop question** takes nothing and posts nothing; the old code then posted the "it falls" line.
5. **The Pillage attack used without the Perk** (only possible by copying the attack by hand) no longer disarms - the rules
   sit on the Perk.
6. **Wording:** the engine's "disarmed" / "takes" lines replace the Perk's own chat lines; the switch reads "Going after a
   two-handed item (Pillage: ↓1)".

**Dreadnok Recruit**
7. **A Hang-Up flagged matured-ignored** no longer costs the action (rules skip such Hang-Ups); the old code didn't check.
8. **Which tokens count:** the viewed canvas's placed tokens (`scene:token:`); with no canvas the answer is unknown and nothing
   is spent (the old code fell back to the viewed scene's token list).
9. **Old marks:** a scene mark made by the old Use (`gij3DreadnokPresent`) is ignored - transient, it ends with the scene.
10. **Wording:** the lines read "{name} spends a Free action looking over their shoulder." / "A Dreadnok is watching {name}
    this scene." under the rule's label.

Not changed: the automation notes (written only via apply.cjs). The converted items' notes still describe them.

## Still skipped (57), and what each still needs

"Permanent" = effectively permanent code (bespoke UI or a whole subsystem); otherwise the engine piece is named with its size.

### gij1 (12) + fix3-gij (1), plus 1 partial

- **Anonymous:** permanent - tags reading the attacker's own per-target records (`outwittedTargets`, `analyzeTargetCounts`) kept by dice.mjs.
- **Uniform:** needs a count formula over allies' worn items (`@count.allies.<ft>` with a `target:wearingItem:` filter). Small.
- **Cybernetic Part, Enhanced Part, Optimized Part, Engrafted Mutation, Evolving Mutation, Outright Mutation (6):** permanent - Alteration-aware granting through `onAlterationDrop` with a "not already owned" filter.
- **Metier:** needs renaming the rule's own item with a pick and a derived stage before `_preparePoisonTraining` (the Assassin effect's poison step taken back). Small-medium.
- **Improvise Bomb, Demolition Artist (2):** `pickGrant {record}` keeps the pick, but no roll can take its DIF from the picked entry's Availability, the crit's second copy needs a grant of the recorded pick, and the cost depends on another Perk. Needs a picked-entry formula ref plus `grant {uuid: picked}`. Small-medium.
- **Scavenger:** the same, plus the Availability one step harder and the Requisition Skill of the picked entry; `appendTraits` exists on `grant` but not on `pickGrant`. Medium.
- **Angry (fix3-gij):** a tag comparing the rolled Skill with the value `items/rolls/angry-influence.mjs` stores (`skill:data:<path>` or a `check:` name). Small.
- **Extract Poison (Use; partial, unchanged):** a roll whose DIF is the picked compendium entry's Availability, then the grant. Small-medium (same piece as Improvise Bomb).

### gij2 (11)

- **Artillery Support:** permanent - an area strike delayed to the caller's next turn, a Targeting roll per token.
- **Castling:** permanent here - only a chat note on castling.mjs's own Use card (outside the slice).
- **Fearsome Presence:** needs a post-roll per-target cap (the first three within 20 ft) undoing dice.mjs's Frightened, and the Frightened lifted at the setter's next turn start. Small-medium.
- **Martial Artist:** permanent - whispered comparison words from `getDefenseValue`.
- **Nose For Trouble:** permanent - a confirmable Skill + Essence swap that clears the Specialization.
- **Peerless Pilot:** an auto-pass-disembark rule type read by `vehicle-defeat.mjs`. Small.
- **Personal Shield:** permanent - a pre-toggle veto, a Role Points switch-off, an Impenetrable-Shield-aware EMP short-out.
- **Plan of Action:** permanent - a step editing another ally's pending ↑N.
- **Queen's Gambit:** permanent - an Initiative reorder relayed to the GM.
- **Reckless Abandon:** permanent - switching off another item's Role Points with the Aegis defeat check, a kit-use veto, the Defeat switch-off.
- **Roll Cage:** a vehicle-defeat crew-damage hook. Small.

### gij3 (13)

- **Second Skin:** an asked SkillSubstitution (a chooser before the dialog on a Requisition roll). Small-medium.
- **Subtle Snake:** a three-way DialogSwitch select (none / ↓1 / Snag) - `stack` can't compare a ↓ with a Snag. Small.
- **The Sound of Angels:** permanent-ish - `pickAlly` + `spendAction` per ally now exist, but the Lend-Assistance Edge is an object flag (`pendingLendAssistanceEdge` with the target's id and the combat round) no step can write. Needs a "bank Lend Assistance against this target" step. Small-medium.
- **Touch Move:** permanent - a GM-side announcement listing every un-surprised ally by name.
- **Early Adopter, Field Trials (2):** a `button {who: anyone, runAs: clicker, limit: {per: mission}}` card covers the per-member pick, but nothing keeps the presser to the holder's Party roster (and the holder out, for Early Adopter), and `pickGrant` has no `appendTraits` (Field Trials' Temperamental). Needs `self:inPartyOf:holder` (or a `party` button `who`) and `pickGrant {appendTraits}`. Small.
- **Peak Performance:** a step granting the base Role's top-level Perks outright (no pick). Small-medium.
- **Technical Glitch, Some Assembly Required, Complete System Failure (3):** permanent - `pick from: targetItem` now picks the item, but the disruption is its own subsystem (the `gij3Disrupted` state, a Reboot button for the owner, a Repair button only the disruptor can press, a lingering Snag + ↓2 on the item's rolls) and the DIF is the picked item's Availability.
- **Better than the Best:** permanent - a natural-20 outcome bump inside dice.mjs's results.
- **Seconds Between Click & Boom (code half):** an "ignore miss effects" rule type. Small.
- **Takedown Expert (code half):** the `disarm` step and `applyCondition` (immobilized / silenced) can do the choice now, but hit / miss Triggers don't see the roll's dataset, so a failed Takedown can't be told apart; and dice.mjs calls the hook directly. Needs `roll:dataset:` (or a `roll:takedown` tag) in hit / miss Triggers, then removing the dice.mjs call. Small.

### situational1 (11 skip, 3 partials unchanged)

- **Layered Armor:** a flat (non-shift) roll bonus. Small-medium.
- **Environmental Warrior:** a tag matching Survival Specialization names against terrain / environment keywords. Small.
- **Urban Adaptation:** permanent - a level-table pool with per-scene chosen abilities.
- **Adapted Vehicles:** permanent-ish - a `driven`-scope check of the driver's expertise against the terrain under the vehicle.
- **Environmental Enforcer:** permanent-ish - a multi-pick sized by Survival ranks.
- **Weather Gear, Acclimating (2):** a hazard-protection rule type (`ENVIRONMENT_PROTECTORS`). Small.
- **Fast Tracking:** a "looks like a Contingency" tag for the pre-tick. Small.
- **Misguide:** a rough-terrain-imposing rule type and the marked creature's current-or-next-turn window. Small-medium.
- **Contort:** the cost picker is expressible now (`choose` between `spendAction move` and two `spendAction free`), but the doubled Reach isn't: an ItemModifier `multiply` on `totalReach` would stack past one doubling (the old code takes the max with a single doubling of the size Reach). Needs a Reach rule (or ItemModifier `op: max` with a size-Reach formula ref). Small.
- **Izuna Drop:** permanent - a roll on the better of two Skills, the GM damage button for unowned targets, overflow back onto the faller.
- **Partials, unchanged:** Danger Sense (`ruleConditionImmune` passing `holder`), Every Trick in the Book (a "can't be sneak-attacked" rule type), Earth Defense Command Benefits' Space Kit (permanent - `makeKit`).

### situational2 (9 skip, 3 partials unchanged)

- **Arctic Expedition Clothes, Desert Expedition Clothes, Desert Gear (3):** the "not against a creature's attack" -2 at attack time applied after best / halve and grouped like the sheet's +2. Small-medium.
- **Business:** a creature-tag prefix test (`strex*`), and the same Defense ordering. Small-medium.
- **Competitive:** permanent - comparing an ally's total with this actor's own last roll of the same Skill (chat history).
- **Take in a Scene:** permanent - a DIF from chat history.
- **Misplaced Confidence:** permanent - Take in a Scene with it, and a Condition held to a set round.
- **Cartography Suite, Lay of the Land (Rough Terrain half) (2):** a "surveyed this canvas scene" tag and an ally-aura Move-action count. Small each.
- **Partials, unchanged:** Seafarer (Hang-Up) (a poison-save tag), Shark's Fin (an "Initiative is being rolled" event fired before the formula), Plow's Multiple Targets half (a Multiple Targets grant rule type).

## Edits outside my files

None.

## Unused strings

Keys in `lang/en.json` no code uses any more (the removed Pillage and Dreadnok Recruit code was their only reader):
`E20.Gij3PillageTwoHandedToggle`, `E20.Gij3PillageKeepPrompt`, `E20.Gij3PillageTake`, `E20.Gij3PillageDrop`,
`E20.Gij3PillageTaken`, `E20.Gij3PillageTakenGm`, `E20.Gij3PillageDropped`, `E20.Gij3DreadnokRecruitChat`,
`E20.Gij3DreadnokMarked`.

## Rules added

5 rules in 2 pack files (both CRLF; inserted as text as the first key of `system`, each file's line endings kept):
- Pillage: 1 DialogSwitch, 2 Triggers (`hit`).
- Dreadnok Recruit: 1 Trigger (`turnStart`), 1 Use.

## Engine pieces the remaining skips need (most useful first)

1. **A picked compendium entry in formulas, and granting it later:** a formula ref to the entry a `pickGrant {record}` (or a
   pick-only pickGrant) chose - its Availability DIF, one step harder - so a `roll` can use it as its DIF, then `grant`
   (or `pickGrant {grant: picked}`) of that entry, twice on a crit; `appendTraits` on `pickGrant`. Unblocks Extract Poison's
   Use, Improvise Bomb + Demolition Artist, Scavenger (4, and finishes 1 partial). **Small-medium.**
2. **A Party-roster tag for a button's presser** (`self:inPartyOf:holder`, or `who: party` on `button`), with the holder
   left out on request, plus `pickGrant {appendTraits}` (from 1). Unblocks Early Adopter, Field Trials (2). **Small.**
3. **Hit / miss Triggers seeing the roll's dataset** (`roll:dataset:isTakedown`) - with the `disarm` / `applyCondition` steps
   already there - and removing dice.mjs's direct call. Unblocks Takedown Expert (1). **Small.**
4. **Roll-time Defense additions after best / halve, grouped by `stack`,** plus a creature-tag prefix tag. Unblocks the three
   exposure clothes and Business (4). **Small-medium.**
5. **Small tags and events:** an "Initiative is being rolled" event before the formula (Shark's Fin); a poison-save tag
   (Seafarer Hang-Up); `ruleConditionImmune` passing `holder` (Danger Sense); rolled Skill vs a stored value (Angry); "looks
   like a Contingency" (Fast Tracking); a Survival-Specialization keyword match (Environmental Warrior); "surveyed this canvas
   scene" plus an ally-aura Move-action count (Cartography Suite, Lay of the Land); `@count.allies` with a worn-item filter
   (Uniform). Would finish 2 partials and up to 7 skips. **Small each.**
6. **Rule types read by hand-written registries:** hazard protection (Weather Gear, Acclimating), rough-terrain imposers
   (Misguide), Multiple Targets grants (Plow's other half), auto-pass disembark (Peerless Pilot), "can't be sneak-attacked"
   (Every Trick in the Book), "ignore miss effects" (Seconds Between Click & Boom), vehicle-defeat crew damage (Roll Cage),
   a Reach rule that doesn't stack past one doubling (Contort). **Small each.**
7. **A post-roll per-target cap on a Condition the roll applied** (keep it on the first N targets within X ft, lift the rest),
   with the Condition lifted at the setter's next turn start. Unblocks Fearsome Presence (1). **Small-medium.**
8. **Dialog selects and asked substitutions:** a three-way DialogSwitch select (Subtle Snake) and an asked SkillSubstitution
   before the dialog (Second Skin). **Small-medium.**
9. **Grants without a pick:** a step granting the base Role's top-level Perks outright (Peak Performance); a step banking Lend
   Assistance's Edge against the current target on picked allies (The Sound of Angels). **Small-medium each.**
10. **Renaming the rule's own item with a pick, and a derived stage before `_preparePoisonTraining`.** Unblocks Metier.
    **Small-medium.**
11. **A flat (non-shift) roll bonus.** Unblocks Layered Armor. **Small-medium.**
12. **Effectively permanent code** (bespoke UI or whole subsystems): Artillery Support (area strikes), the six Alteration parts
    (Alteration drop flow), the three Disruptor Perks (the disruption state with owner / disruptor buttons), Urban Adaptation
    (level-table pool with per-scene abilities), Queen's Gambit (Initiative reorder via the GM), Personal Shield / Reckless
    Abandon (Role Points activation with vetoes and the Aegis defeat check), Plan of Action's split, Nose For Trouble's
    confirm-swap, Martial Artist's whispered comparison, Take in a Scene / Misplaced Confidence / Competitive (chat-history
    reads), Izuna Drop, Touch Move's announcement, Anonymous (dice.mjs's per-target records), Better than the Best (dice.mjs
    multiplier), Environmental Enforcer, Adapted Vehicles, Earth Defense Command Benefits' Space Kit, Castling (its Use lives
    in castling.mjs).
