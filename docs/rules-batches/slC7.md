# Batch slC7: re-check of slC6's skips (`gij1`, `gij2`, `gij3`, `fix3-gij`, `situational1`, `situational2`) against the round-7 engine pieces

**Scope:** every item `docs/rules-batches/slC6.md` left **Still skip** (68) or **Partial** (7: Extract Poison, Jungle Fighter,
Out of the Jungle, Danger Sense, Every Trick in the Book, Seafarer (Hang-Up), Shark's Fin) in the six slC slices, re-checked
against the guide's section "Engine features added 2026-10-06 (round 7, after the local round-6 conversions)": `onCanvas`,
`itemCount`, `actionUsed`, `wearingItem`, `hasItem:name~`, `item:word`, `item:hasAttack`, `roll:targets` + `@var.targets`,
`host:` at roll time, `combat:enemy|ally:<tags>`, `dice(count, faces)`, `@count.items|equipped`, `endOfNextTurnOrScene`,
`turnOrUntilCombat`, `to: partyActor`, `choose` option `when` + `auto`, `pick` skill `essence` / `specializedOnly` / `team` /
`auto`, `pickGrant` `fields` / `replace`, `difDefenseSelf`, `button` `whisper` / `usedWhenDone`, a clicker's button acting for
the selected token, `sessionStart`, the `resourceSpent` filter and the `worldTime` sweep. The earlier sections were checked
again too, and so were slC6's recorded behaviour differences (none of them is removed by a round-7 piece). Edited in place in
the shared checkout (no branch, no commit).

| Verdict (re-checked items) | gij1 + fix3-gij | gij2 | gij3 | situational1 | situational2 | Total |
|---|---|---|---|---|---|---|
| Convert (now fully rules) | 2 | 0 | 2 | 0 | 2 | **6** |
| Partial, nothing more converts | 1 | 0 | 0 | 4 | 2 | **7** |
| Still skip | 13 | 11 | 15 | 12 | 11 | **62** |
| Re-checked | 16 | 11 | 17 | 16 | 15 | **75** |

After this part, `scripts/check-rules.mjs` reports no errors or warnings (1893 rules on 1177 items in the shared checkout).
ESLint is clean on the six slice folders and `module/rules/conv7-slC7.test.js`. Jest passes on the six slice folders,
`conv7-slC7.test.js` (16 tests), `conv6-slC6.test.js`, `conv5-slC5.test.js` and `conv4-slC4.test.js`. In
`module/rules/conversions.test.js` one test fails until the edit under "Edits outside my files" is applied (it asserted that
Bookworm's rule gives nothing at Initiative, which this batch changes on purpose). No slice file became empty, so
`extensions/index.mjs` is unchanged.

## Converted

| Item | Rules | Why it is exact |
|---|---|---|
| **Targeting Eye** (gij3, `packs/qgtgitems/_source/Targeting_Eye_k8OE8GB2ux24SkQo.json`) | A Use "Switch on the Targeting Eye" (`cost: {action: free}`, `when: [not:self:marked:gij3TargetingEye]`) marking the holder `until: endOfNextTurnOrScene` and posting the old line; a RollModifier ↓1 `when: [attack:melee, self:marked:...]`; the same ↑1 with `scope: incoming`; two ItemModifiers multiplying `system.range.value` and `system.range.long` by 2 on `item:type:weaponEffect` + `style=projectile` + `range.value>0` + a `parentId` + `not:item:hasUpgrade:<Scope>` (both printings), the long one also `range.long>0`. | The old Use was free, offered while the mark wasn't live, and stamped "through the holder's turn next round, in that combat, in this scene" (out of combat: the scene) - what `endOfNextTurnOrScene` stamps for a holder acting on its own turn. The old roll sources were ↓1 on the holder's melee attacks and ↑1 on melee attacks against a marked actor (only the holder gets the mark). The old derived hook doubled `range.value` (and `range.long` when set) of every projectile attack attached to a weapon with no Scope, and listed them in `upgradeTouched` - ItemModifier records the path the same way. |
| **Junker** (gij3, `packs/qgtgitems/_source/Junker_VpQqwE8GNeqFAHbg.json`) | A Use, `limit: {per: mission}`: `updateActor {to: partyActor, add: {system.requisition.attempts: 1}}`, `bank {label: Junker, edge: true, appliesWhen: [roll:dataset:requisitionItemName]}`, a chat line. | Once per mission (the old `getUses(..., 'mission')`), +1 attempt on the Party's Requisition pool, and a pending Edge read only by a roll whose dataset carries `requisitionItemName` (the old roll source's test), used up by that roll. The bank is offered in the same roll-source pass the old hook used. |
| **Recoil Brace** (gij1, `packs/ccitems/_source/Recoil_Brace_2gURwr6VrgTuIRFQ.json`) | A Use, `limit: {per: scene}`, `when: [rule:data:flags.essence20.parentId]`: `setToggle {key: oneHanded, until: turnOrUntilCombat}` + chat; an ItemModifier `items: [item:isHost]`, `system.derivedHands` `min 1`, `when: [self:toggle:oneHanded]`. | The old Use (once per scene per brace, only while attached) stamped the weapon for the current turn in combat; the derived hook set `derivedHands = min(1, derivedHands)`. `turnOrUntilCombat` is the current turn in a running combat. Both run in the same derived pass, after the Load Out tally. |
| **Let It Rip** (gij1, `packs/ccitems/_source/Let_It_Rip_dtB9EUFE45oZNAOR.json`) | A Use, `cost: {action: free}`, `when: [{any: [self:hasItem:<each of the 4 Signature Weapons>]}]`: `pick {key: weapon, from: ownedItem, itemType: weapon, filter: [{any: [item:source:<4 uuids>]}], auto: true, beforeCost: true}`, `setToggle {key: oneHanded, until: turnOrUntilCombat}`, chat; an ItemModifier `items: [item:type:weapon, item:picked:weapon]`, `derivedHands min 1`, `when: [self:toggle:oneHanded]`. | The old Use was offered with any of the four Signature Weapons (exact source uuids), asked which only when there were two or more, paid the Free action after the pick (a cancelled pick cost nothing - `beforeCost`), and set the same one-turn stamp as Recoil Brace on that weapon. |
| **Caltrops** (situational2, `packs/prcrbitems/_source/Caltrops_LN0w8SB1fHhidIVp.json`) | A Use posting a `button` "Cross the caltrops" (`who: anyone`, `runAs: clicker`, `once: false`) whose steps roll Acrobatics DIF 15: a pass posts a line; a failure posts the stop line and `essenceDamage {essence: speed, amount: 1, to: self}`. | The old card's button was pressable by anyone any number of times and acted for the presser's first controlled token, else their character - the round-7 clicker order. It rolled `rollTest(actor, 'acrobatics', 15)` (the `roll` step's call) and on a failure applied `applyEssenceDamage(actor, ['speed'])` (the step's call for an owned actor). |
| **Bookworm** (situational2, Initiative half - the item is now fully rules; `packs/wtnvcgitems/_source/Bookworm_p2Qk0B5PWp10ZaqN.json`) | A second RollModifier ↓1 `when: [roll:initiative, {any: [scene:name~librar, combat:enemy:target:tag:librarian, combat:enemy:target:name~librarian]}]`. | The old Initiative hook added ↓1 when the scene's name held "librar" or a combatant (started combat or not) on the other side was a Librarian by creature tag or name. Initiative reads item RollModifiers (round 14); `combat:enemy:` asks each combatant of the set-up combat. The existing rule keeps `not:roll:initiative`, so nothing doubles. |

### Removed code

- **gij3/gij3.mjs:** Junker's and Targeting Eye's roll sources, Uses and consumer (`gij3Junker`), `untilEndOfNextTurn`,
  `isTargetingEyeLive`, `gij3Derived` and its registration, `SCOPE_UPGRADE_ID`, `G3.junker`, `G3.targetingEye`,
  `FLAG.targetingEye` / `junkerEdge` / `junkerUsed`, `writeActor`, `isAttackItem`, and the now-unused imports
  (`registerConsumer`, `registerDerived`, `getSceneEpoch`, `bankPendingBonus` / `clearPendingBonus` / `getPendingBonus`).
- **gij1/gear.mjs:** the Recoil Brace section (`ONE_HANDED_FLAG`, `isOneHandedNow`, the derived hook, `braceKey`,
  `bracedWeapon`, the Use) and its imports (`registerDerived`, `registerUse`, `getUses` / `markUsed`, `isFrom`,
  `isStampActive`, `itemsOf`, `turnStamp`). **gij1/perks.mjs:** the Let It Rip section (`signatureWeapons`, the Use) and the
  `ONE_HANDED_FLAG` / `SIGNATURE_WEAPONS` / `turnStamp` imports. **gij1/shared.mjs:** `G1.recoilBrace`, `G1.letItRip`,
  `SIGNATURE_WEAPONS`, `turnStamp`, `isStampActive`, the `getSceneEpoch` import.
- **situational2/situational2.mjs:** `crossCaltrops`, the `s2-caltrops` Use, `buttonActor`, the `s2Caltrops` chat button.
  **situational2/initiative.mjs:** `bookwormAtInitiative` and its block in `situationalInitiative` (whose `options` argument is
  now `_options`; it is still called with it). **situational2/common.mjs:** `S2.caltrops`, `S2.bookworm`, `S2_UUID`,
  `isLibrarian`, `isLibrarySituation`, the `uuid` helper.
- **Tests:** gij3.test.js's two Junker tests and two Targeting Eye tests (and the `gij3Junker` consumer expectation, now an
  assertion that neither Use is registered); situational2.test.js's Caltrops test (now: no Use matches Caltrops), its Bookworm
  Initiative test (now: `situationalInitiative` adds nothing), and the `S2.caltrops` id check (now `S2.sharksFin`).

The new tests are in `module/rules/conv7-slC7.test.js` (16 tests). They cover what the old ones asserted, plus: Targeting
Eye's Free cost, its window turn by turn in a combat, its scene end in and out of combat, no range change with a Scope or
without the mark, the long band left alone when unset; Junker's mission limit, the Party write, the Edge only on a
Requisition Test, and the Edge with no Party; Recoil Brace's scene limit, attached-only offer, one turn in combat, "until a
combat starts" out of it, and no other weapon touched; Let It Rip's offer, the unasked lone pick, the picker offering only
Signature Weapons, one turn only; Caltrops' card flags, a failed and a passed crossing, the selected token before the
character; Bookworm's ↓1 at Initiative by scene name, a hostile Librarian by name or tag in an unstarted combat, nothing for a
friendly one or none, and no dialog switch at Initiative.

## Behaviour differences worth a decision

All same-line.

**Targeting Eye**
1. **Used outside the holder's own turn** (before its turn comes up this round) it now ends at the end of that turn this round;
   the old stamp always ran to the holder's turn next round. Used on its own turn (the normal case for a Free action) it's the
   same.
2. **A holder not in the turn order** now loses it after the first turn of the next round; the old stamp ran to the same turn
   index next round.
3. **Switched on in a combat that's set up but not started** it now lasts the scene (and on into that combat); the old stamp
   ran through the holder's turn in round 1.
4. **A Scope is recognised by its two compendium uuids** (`gi_joe_crb` and `pr_crb`, the only ones any pack uses); the old test
   was "source ends with the Scope's _id", which also caught a world copy (`Item.cBiD2lBLRwnxu8Rx`).
5. **Wording:** the attacker's source reads "Targeting Eye in use (melee attacks against it: ↑1)" instead of "<name>'s
   Targeting Eye"; the holder's reads "Targeting Eye in use (melee attacks: ↓1)" instead of "Targeting Eye (in use)".
6. **An eye switched on before this lands** (the old `gij3TargetingEye` flag) is off. Transient.

**Junker**
7. **Which Party:** the Party the holder is on (the primary first), not always the primary Party - a holder on no roster
   (or only a secondary one) adds nothing to the primary's pool.
8. **Wording:** one chat line; the no-Party variant's "add it by hand" hint is gone.
9. **Old state isn't carried over:** someone who used it this mission (`gij3JunkerUsed`) can use it once more; an unspent
   banked Edge (`gij3JunkerEdge`) is lost.

**Recoil Brace / Let It Rip**
10. **Out of combat** the one-handed state now lasts until a combat starts - it survives a scene change, and a combat that's
    set up but not started. The old stamp ended with the scene, or as soon as any combat was set up.
11. **Recoil Brace on an unequipped weapon:** upgrade rules switch off while their weapon is unequipped, so the Use isn't
    offered and nothing applies there. Hands only matter for a wielded weapon.
12. **Recoil Brace's Use** is offered whenever the brace is attached (has a parent id), even if that parent item is gone.
13. **Let It Rip twice in one turn on two different Signature Weapons:** the one-handed state moves to the second (one pick is
    remembered); the old stamps left both one-handed.
14. **Wording:** the chat lines don't name the weapon. Old stamps (`gij1OneHanded`) are ignored - transient.

**Caltrops**
15. **A GM who presses with no token selected** (and no character) crosses as the scatterer; the old button warned "select the
    token first".
16. **Unequipped Caltrops** (gear switched to unequipped) offer no Use.
17. **Wording:** the card's intro doesn't name the scatterer; results post under "Cross the caltrops", the failure's damage line
    is the engine's "takes 1 Speed Essence damage", and nothing is said about damage when the Speed Essence is already 0.

**Bookworm**
18. **The Initiative ↓1 is now a listed, switch-off-able source** in the Initiative dialog; it was added silently after it.
19. **The library scene** is the active scene (the existing rule's reading), not the token's own scene; **sides** are the rules'
    (token dispositions, else PC vs not) rather than situational2's (else both PCs) - only two non-PCs without tokens differ.
    A Hang-Up marked matured-ignored now gives no Initiative ↓1, like its other rule.

Not changed: the automation notes (written only via apply.cjs). The converted items' notes still describe them.

## Still skipped (62), and what each still needs

Where a round-7 piece now covers part of an item, that is said. Otherwise slC6's reason stands.

### gij1 (12) + fix3-gij (1), plus 1 partial

- **Anonymous:** tags over the attacker's per-target records keyed by the wearer's uuid.
- **Uniform:** `target:wearingItem:item:hasUpgrade:<uuid>` now says the target wears one, but the ↓ is 1 + the number of its allies wearing one - a count formula over allies' worn items.
- **Cybernetic Part, Enhanced Part, Optimized Part, Engrafted Mutation, Evolving Mutation, Outright Mutation (6):** Alteration-aware granting through `onAlterationDrop` with a "not already owned" filter.
- **Metier:** renaming the Perk itself with the pick, and undoing the Assassin's poison step before `_preparePoisonTraining`.
- **Improvise Bomb, Demolition Artist (2):** a compendium pick with a code filter, an Availability-DIF roll, a second copy on a crit, a cost that depends on another Perk.
- **Scavenger:** a two-stage pick (type, then entry), a Requisition roll one Availability step harder, appending Temperamental.
- **Angry (fix3-gij):** a tag comparing the rolled Skill with a value on the actor.
- **Extract Poison (Use; partial, unchanged):** a roll whose DIF is a picked compendium entry's Availability.

### gij2 (11)

- **Artillery Support:** an area recipient, steps delayed to the caller's next turn start, a Targeting roll per token against its own Defense.
- **Castling:** only a chat note on castling.mjs's own Use card (the Use is outside the slice).
- **Fearsome Presence:** a post-roll per-target cap undoing dice.mjs's Frightened, and marks from several setters.
- **Martial Artist:** whispered comparison words from `getDefenseValue` (situational Defenses included) - `button whisper` only hides a card.
- **Nose For Trouble:** a confirmable Skill + Essence swap that clears the Specialization.
- **Peerless Pilot:** an auto-pass-disembark rule type read by `vehicle-defeat.mjs`.
- **Personal Shield:** a pre-toggle veto, a Role Points switch-off, an Impenetrable-Shield-aware EMP short-out.
- **Plan of Action:** a step editing another ally's pending ↑N.
- **Queen's Gambit:** an Initiative reorder relayed to the GM, placing an actor right after the current turn.
- **Reckless Abandon:** a pre-use veto for kits, a "no enemy token on the scene" tag (`onCanvas` is the actor's own token only), a Role Points switch-off on Defeat.
- **Roll Cage:** a vehicle-defeat crew-damage hook.

### gij3 (15)

- **Second Skin:** an asked SkillSubstitution (a chooser before the dialog).
- **Subtle Snake:** a DialogSwitch select (none / ↓1 / Snag).
- **Pillage:** a `disarm` step with `maxHands` and moving a target's item to the actor.
- **The Sound of Angels:** a per-recipient Free-action cost and a Lend-Assistance grant against this target (`item:hasAttack` / `roll:targets` don't help).
- **Dreadnok Recruit:** a "some non-PC token on the scene is named ~x" tag (`combat:enemy:` covers combatants only) and a turn-start Free-action spend step.
- **Touch Move:** a GM-side announcement, once per combatant, listing every un-surprised ally by name (an `initiativeRolled` Trigger can't list names).
- **Early Adopter, Field Trials (2):** close now - a `button` with `who: anyone`, `runAs: clicker` and `limit: {per: mission}` gives each member their own pick - but the button limit is spent even when the pick is cancelled (the old card only counted a grant), nothing restricts the presser to the holder's Party roster (or keeps the holder out, for Early Adopter), and Field Trials must add Temperamental to the granted upgrade's own traits (`pickGrant`'s `system` override replaces them).
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
- **Partials, unchanged:** Jungle Fighter and Out of the Jungle (the light-armor noise is the SUM of the worn light armors' Toughness + Evasion bonuses - `@count.items` only counts), Danger Sense (`ruleConditionImmune` still doesn't pass `holder`), Every Trick in the Book (a "can't be sneak-attacked" rule).

### situational2 (11 skip, 2 partials)

- **Arctic Expedition Clothes, Desert Expedition Clothes, Desert Gear (3):** the "not against a creature's attack" -2 at attack time applied after best / halve and grouped like the sheet's +2.
- **Business:** a creature-tag prefix test (`strex*`), and the same Defense ordering.
- **Competitive:** comparing an ally's total with this actor's own last roll of the same Skill in the scene's recent window.
- **Forgiving:** one aggressor mark per Forgiving holder (marks keyed per setter).
- **Take in a Scene:** a DIF from chat history.
- **Misplaced Confidence:** Take in a Scene with it, and a Condition held to a set round.
- **Cartography Suite, Lay of the Land (Rough Terrain half) (2):** a "surveyed this canvas scene" tag (a `mark` until `scene` ends with the Scene Clock, but the survey is tied to the canvas scene's id and lasts as long as the party is there), and an ally-aura Move-action count.
- **Plow:** a Multiple Targets grant rule type (also for a driven vehicle) and a this-turn mark read by MovementAction.
- **Partials:** Seafarer (Hang-Up) (a poison-save tag), Shark's Fin (its Initiative half needs an "Initiative is being rolled" event fired before the formula - `initiativeRolled` comes after).

## Edits outside my files

1. **`module/rules/conversions.test.js`** - the Bookworm test asserted that the item's rules give nothing at Initiative
   ("its slice adds that one"); the slice's Initiative ↓1 is now Bookworm's second rule. Two lines:
   - Line 8186, replace
     `test('Bookworm: ↓1 in a library scene, but not on Initiative (its slice adds that one)', () => {`
     with
     `test('Bookworm: ↓1 in a library scene, Initiative included (its second rule - conv7-slC7.test.js)', () => {`
   - Line 8191, replace
     `    expect(ruleRollSources(actor, null, { rolledSkill: 'initiative', dataset: { isInitiative: true } }).sources).toEqual([]);`
     with
     `    expect(ruleRollSources(actor, null, { rolledSkill: 'initiative', dataset: { isInitiative: true } }).sources.map(s => s.shiftDown)).toEqual([1]);`
   (Line 8192's `ruleDialogSwitches(...)).toEqual([])` stays true: neither rule asks at Initiative.) Optionally, line 8167's
   comment "(situational2/initiative.mjs handles it there)" can become "(its second rule handles it there)".

## Unused strings

These `lang/en.json` keys are no longer used anywhere in `module/`, `templates/` or `tours/`:
- Targeting Eye: `E20.Gij3TargetingEyeCost`, `E20.Gij3TargetingEyeTarget`, `E20.Gij3TargetingEyeUsed`
- Junker: `E20.Gij3JunkerUsed`, `E20.Gij3JunkerUsedNoParty`
- Recoil Brace / Let It Rip: `E20.G1OneHanded`, `E20.G1PickWeapon`
- Caltrops: `E20.S2CaltropsNoActor`, `E20.S2CaltropsScattered`, `E20.S2CaltropsCross`, `E20.S2CaltropsPass`, `E20.S2CaltropsFail`

## Rules added

12 rules in 6 pack files (all LF; inserted as text, each file's line endings kept):
- Targeting Eye: 1 Use, 2 RollModifiers, 2 ItemModifiers. Junker: 1 Use. Recoil Brace: 1 Use, 1 ItemModifier.
- Let It Rip: 1 Use, 1 ItemModifier. Caltrops: 1 Use. Bookworm: +1 RollModifier (appended to its existing rule).

## Engine pieces the remaining skips need (most useful first)

1. **Target-item steps:** `pick` over a target's items or a compendium entry, a roll whose DIF is the picked entry's
   Availability, `disarm` with `maxHands`, moving a target's item to the actor. Unblocks Pillage, Takedown Expert, the 3
   Disruptor Perks, Extract Poison's Use, Improvise Bomb + Demolition Artist, Scavenger (about 9). **Medium-large.**
2. **Button follow-ups for per-member picks:** a button `limit` spent only when its steps finish (like `usedWhenDone`), a
   roster tag for the presser (`self:inPartyOf:holder` / `holder:` readable in a clicker run, to keep the holder out), and
   `grant` / `pickGrant` `appendTraits` (add to the granted item's own traits). Unblocks Early Adopter, Field Trials (2).
   **Small.**
3. **Roll-time Defense additions after best / halve, grouped by `stack`,** plus a creature-tag prefix tag. Unblocks the three
   exposure clothes and Business (4). **Small-medium.**
4. **A formula summing a path over items** (`@sum.equipped.armor.system.totalBonusToughness` with item tags), finishing the
   Jungle Fighter and Out of the Jungle partials (2). **Small.**
5. **Small tags and events:** an "Initiative is being rolled" event fired before the formula (Shark's Fin's Initiative half);
   a scene-token tag (`scene:token:<tags>` - Dreadnok Recruit with a turn-start Free-action `spendAction` step, Reckless
   Abandon's "no enemy token"); a poison-save tag (Seafarer Hang-Up); `ruleConditionImmune` passing `holder` (Danger Sense);
   rolled Skill vs an actor value (Angry); "looks like a Contingency" (Fast Tracking); a Survival-Specialization keyword match
   (Environmental Warrior); "surveyed this canvas scene" (Cartography Suite, Lay of the Land's Rough Terrain half, with an
   ally-aura Move-action count). Would finish 2 partials and up to 7 skips. **Small each.**
6. **Rule types read by hand-written registries:** hazard protection (Weather Gear, Acclimating), rough-terrain imposers
   (Misguide), Multiple Targets grants (Plow), auto-pass disembark (Peerless Pilot), "can't be sneak-attacked" (Every Trick in
   the Book), "ignore miss effects" (Seconds Between Click & Boom), vehicle-defeat crew damage (Roll Cage). **Small each.**
7. **Marks keyed per setter** (one key, one entry per setter, read by `markedByMe:` / `consumeMark`). Unblocks Forgiving, and
   part of Fearsome Presence. **Small-medium.**
8. **Renaming the rule's own item with a pick, and a derived stage before `_preparePoisonTraining`.** Unblocks Metier.
   **Small-medium.**
9. **A count formula over allies' worn items** (`@count.allies.<ft>` filtered by `target:wearingItem:...`). Unblocks Uniform
   (with Anonymous still needing per-target records). **Small.**
10. **Effectively permanent code** (bespoke UI or whole subsystems): Artillery Support (area strikes), the six Alteration parts
    (Alteration drop flow), Urban Adaptation (level-table pool with per-scene abilities), Queen's Gambit (Initiative reorder
    via the GM), Personal Shield / Reckless Abandon (Role Points activation with vetoes), Plan of Action's split, Nose For
    Trouble's confirm-swap, Martial Artist's whispered comparison, Take in a Scene / Misplaced Confidence / Competitive
    (chat-history reads), Izuna Drop, Touch Move's announcement, Anonymous (per-target records), Second Skin / Subtle Snake
    (dialog selects), Better than the Best (dice.mjs multiplier), Peak Performance, The Sound of Angels, Contort,
    Environmental Enforcer, Earth Defense Command Benefits, Adapted Vehicles, Castling (its Use lives in castling.mjs).
