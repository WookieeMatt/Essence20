# Batch slC: G.I. Joe & situational extension slices (`gij1`, `gij2`, `gij3`, `fix3-gij`, `situational1`, `situational2`)

**Scope:** every item in the id tables of `module/helpers/extensions/gij1/`, `gij2/`, `gij3/`, `fix3-gij/`,
`situational1/` and `situational2/`, plus every other place in `module/` that uses those ids. The batch was done in
five parts on separate branches (`rules/slC-gij1` for gij1 + fix3-gij, `rules/slC-gij2`, `rules/slC-gij3`,
`rules/slC-sit1`, `rules/slC-sit2`), all from `rules/slB` at 0d39fc0e, and merged into `rules/slC`. Each part's full
write-up follows below, in the same layout as the reg*.md files.

| Verdict | gij1 + fix3-gij | gij2 | gij3 | situational1 | situational2 | Total |
|---|---|---|---|---|---|---|
| Convert | 1 | 3 | 1 | 0 | 0 | **5** |
| Partial | 1 | 0 | 0 | 4 | 1 | **6** |
| Skip | 20 | 15 | 18 | 21 | 21 | **95** |
| Items | 22 | 18 | 19 | 25 | 22 | **106** |

15 rules were added to 11 pack items. After the merge, `scripts/check-rules.mjs` counts 1363 rules on 972 items (slB
left 1348 rules on 964 items), with 0 errors and 0 warnings. ESLint is clean and jest passes (502 suites; 9607
passed, 2 skipped).

One slice file became empty: `gij2/senses.mjs` (Robot / Empathetic) is deleted, with its import line in
`extensions/index.mjs` and its test file. The only merge conflicts were the parts' test blocks appended at the end of
`module/rules/conversions.test.js` and `conversions-uses.test.js`; all are kept.

**Behaviour differences worth a decision** (every difference is listed in its part's section):

- **Robot (gij2), cross-line but result-changing:** `isImmuneToCondition` now reports the drone's frightened /
  mesmerized immunity, so a Power Rangers Dark Ranger's Terror no longer accrues from a Robot drone without Empathetic.
  Older copies get the immunity only after the GM's linking pass.
- **Danger Sense / Every Trick in the Book (sit1), cross-line:** Surprised now appears in `isImmuneToCondition`, so
  Iron Bravado's share (Power Rangers) would pass Surprised immunity on to allies when its holder also has one of them.
- **Adjustable Faceplate (gij1), cross-line:** with Mega Defender (Power Rangers) the +1 is now added on top of the
  fixed Defense instead of being overwritten.
- **Chat text no longer localized (same-line):** Person of Culture (gij3), En Passant and Brrrrrrrrrrrrrrt's Sprint
  line (gij2) and Shielded (gij1) now post rule `chat` text with a title line; their `lang/en.json` strings are removed.
- **Person of Culture (gij3):** a use already spent this scene under the old flag is forgotten once.
- **Out of the Jungle + Jungle Fighter (sit1):** two Edge sources are listed instead of one (still one Edge).

**Existing bug found, not changed:** Bookworm takes ↓2 on Initiative in a library scene. Its pack RollModifier gives
↓1 now that Initiative reads item rules, and `initiative.mjs#situationalInitiative` adds another ↓1 after the dialog.
The same happens with its ask switch against a hostile Librarian. Fix it when Bookworm's Initiative half converts.
City Slicker likewise has an unconditional streetwise switch from an earlier batch next to its code toggle, so ticking
both doubles the swap.

**Most common engine pieces the skips need, across all five parts** (each part's list has the detail):

- **Terrain and position tags:** a "terrain is set" tag (or a switch default that follows its condition) - blocks
  Jungle Fighter, Urban Jungle, City Slicker, Fast Tracking; a multi-pick terrain ChoiceSet; "token is swimming",
  "aboard an aquatic vessel", scene darkness, `environment:` without the vessel interior; re-preparing actors when
  their token's Regions change.
- **Timing:** "this turn, else until used or the scene ends" banks and marks; marks on allies until the start of the
  user's next turn; `until: endOfNextTurn`; Conditions that also end on damage.
- **Chat-card buttons** (including ones other players press): Artillery Support, Personal Shield, Plan of Action,
  Queen's Gambit, Caltrops, Early Adopter, Field Trials.
- **Steps on items:** act on a target's item (disarm, take, disrupt), mark an item with an expiry, pick with a DIF from
  the picked entry, grant through the Alteration drop handler, kit-making.
- **New `check:` names that would convert an item outright:** `computerizedGear` (Machinesmith),
  "known outside the environment of expertise" (Stalk).
- **Other:** a pick-one-of switch (Subtle Snake), a pre-roll Skill + Essence swap (Second Skin), a "success but not
  double" outcome, a temporary-Health heal that also raises current Health, a natural-20 hook, Role Points toggles that
  veto or expire, DerivedStat paths with `{choice.x}`, a late derived stage (Sea Legs), Triggers on other actors' rolls
  and on being attacked.

---

## Batch slC (part): the `gij1` and `fix3-gij` extension slices

**Scope:** every item in the id tables of `module/helpers/extensions/gij1/` (`G1` in `shared.mjs`, the five sibling
Alteration Perks written inline in `perks.mjs#ALTERATION_PERKS`, and `SIGNATURE_WEAPONS`) and
`module/helpers/extensions/fix3-gij/` (`ID` in `gij-fixes.mjs`), plus every other place in `module/` that uses those ids
(`helpers/skill-effects.mjs` holds Ceremonial, `dice.mjs` and `helpers/angry.mjs` hold Angry, and `other1/` holds the
Alteration Perks for its own Alteration handling). Branch `rules/slC-gij1`, from `rules/slB` at 0d39fc0e.

| Verdict | Items |
|---|---|
| Convert | 1 |
| Partial | 1 |
| Skip | 20 |

That is 22 items with behaviour of their own: 21 in `gij1` and 1 in `fix3-gij`. Some table entries are only
references:

- Assassin (Origin): Metier reads its poison-training effect.
- Weapon Training: Metier grants it.
- Inundation and Informed Accuracy: Anonymous reads them on the attacker.
- The four Signature Weapons: Let It Rip's weapon list.

The Asleep / Defeated Condition code in `gij1/conditions.mjs` is keyed by status ids, not items, so it is out of
scope. So is Pack Attack's ↑1 in `fix3-gij`: it is read from a flag that `helpers/pack-attack.mjs` writes on the
allies, and is not in the `ID` table. It is a skip all the same (see below).

This part added 4 rules to 2 pack items. After it, `scripts/check-rules.mjs` counts 1352 rules on 966 items (the base
was 1348 rules on 964 items), with 0 errors and 0 warnings.

### Converted (1)

| Item | Rule | Why it is exact |
|---|---|---|
| Shielded | A Use and an `added` Trigger, both with the steps `pickGrant` `{type: shield, availabilities: [standard]}` then `setToggle granted`, gated by `not:self:toggle:granted` and `not:rule:data:flags.essence20.granted` | The old setup ran `grants.mjs#pickAndGrant` (that is `findItems({type: 'shield', availabilities: ['standard']})`, `pickOne(item.name, rows)`, `grantCopy(actor, uuid, {grantedBy: item})`). It ran from a `createItem` hook for the user who added the Perk, and from a Use button that stayed until the pick was made. `pickGrant` makes the same three calls with the same arguments. It adds `integrated: false` and empty `flags` / `system`, which change nothing. The `added` Trigger fires from `rules/lifecycle.mjs` on `createItem`, for the same user. A cancelled pick stops the run, so nothing is recorded and the button stays, as before. A copy already granted under the old code (`flags.essence20.granted`) keeps its button hidden and isn't asked again. Removed: `G1.shielded`, `grantShield`, its `SETUPS` entry, and `E20.G1ShieldGranted`. |

### Partial (1)

| Item | Converted | Rule | Still code |
|---|---|---|---|
| Adjustable Faceplate | The +1 Toughness (closed) / +1 Evasion (open) | Two Defense rules, `amount: 1`. Both have `self:type:playerCharacter` and `not:self:morphed`. Toughness also has `not:rule:data:flags.essence20.gij1Faceplate=open` and Evasion has `rule:data:flags.essence20.gij1Faceplate=open`. Neither has a label, so the breakdown shows the item's name, as before. | The Use button that sets `flags.essence20.gij1Faceplate` (open / closed). It stays code so the stored setting keeps its place, and the rules read that same flag. |

Why the Faceplate rules are exact: the old `wornUpgrade` check is the upgrade on the actor, either loose or on a host
that isn't unequipped. That is `rules/index.mjs#isItemActive` for an upgrade. The rule doesn't stack, so a second copy
adds nothing. Each rule index keeps the first active copy (copies are deduplicated by source and rule index), which is
the copy the old `find` read, so both rules read that copy's setting. The old code checked the actor type and
`isMorphed` itself. The rule writes `+ 1 (<item name>)` into the breakdown the same way the old `addToDefense` did.
Removed: `faceplateSetting`, `faceplateBonus`, the faceplate `registerDerived` hook, `gij1/shared.mjs#addToDefense`
(nothing else in gij1 used it), and the old faceplate test in `gij1.test.js`.

### Behaviour differences

1. **Adjustable Faceplate: place in the derived pass (same-line, cosmetic).** The old hook ran early, in the gij1
   slice. `ruleDerived` registers later, when `qualify1` imports `rules/adapter.mjs`. Between the two, these other
   derived hooks only add to Toughness / Evasion, so totals are unchanged:
   - `other1`: Armor Matrix, the Alteration adjustments and Thick Hide;
   - `other2`: a jammed armor;
   - `other3`: Self Improvement.

   Only the breakdown changes: `+ 1 (Adjustable Faceplate)` now comes after their entries instead of before.
2. **Adjustable Faceplate with Mega Defender (cross-line).** `other3/pr.mjs#applyMegaDefender` (Power Rangers, Ranger
   and Torozord) sets Toughness and Evasion to fixed values in that same range of hooks. Before, it overwrote the
   Faceplate's +1. Now the +1 is added on top of the fixed value. This needs a Cobra Codex armor upgrade worn by an
   un-Morphed Power Ranger who is using Mega Defender.
3. **Shielded's chat card (same-line).** The card now reads "**Pick a Standard shield**" over the engine's "Granted"
   line. Before, it was the localized "{name} gains a {shield} as personal gear." The Use button's label is now "Pick a
   Standard shield". The done state is stored as the rule toggle `flags.essence20.rules.toggles.granted`. The old flag
   is still read, so nothing granted before is asked again.

### Skipped (20)

#### gij1: gear (`gear.mjs`)

- **Anonymous.** A Snag on the attacker when the attacker holds Inundation and has already Outwitted this wearer
  (`flags.essence20.outwittedTargets[<uuid with dots replaced>]`). The same applies when the attacker holds Informed
  Accuracy and has Analyzed this wearer twice or more (`analyzeTargetCounts`). *Needs:* a tag that reads the other
  party's per-target records keyed by this actor's uuid. An `incoming` RollModifier could carry it.
- **Ceremonial.** A Free-action Use stamps the turn. The ↑1 then applies to every Persuasion test that turn without
  being used up. Out of combat, the next Persuasion test uses it up, and it ends when the scene changes.
  `helpers/skill-effects.mjs` also hides its old disabled effect. *Needs:* a `bank` that isn't used up in combat but
  is used up out of combat (or a mark read by a RollModifier that a roll can clear), with "until end of turn, else
  the scene" timing.
- **Uniform.** An off-by-default switch whenever the user's first target wears a Uniform: ↓1, plus ↓1 for each ally
  of the target who also wears one. *Needs:* an `incoming` DialogSwitch (or a switch reading the target's items),
  and a formula counting the target's allies that hold a given item.
- **Recoil Brace.** Once per scene, stamps the host weapon as one-handed until the end of the turn. A derived hook
  caps `derivedHands` while the stamp holds. *Needs:* a step that marks an item (the rule's host) with an expiry,
  and an ItemModifier `min` that is live only while that mark holds.

#### gij1: Perks (`perks.mjs`)

- **Cybernetic Part, Enhanced Part, Optimized Part, Engrafted Mutation, Evolving Mutation, Outright Mutation (6).**
  An Alteration picker at the Perk's tier that leaves out Alterations the actor already has. The pick goes through
  `alteration-handler.mjs#onAlterationDrop`, so the Alteration's benefit and cost are applied, with a
  `cyberneticAlteration` / `geneticAlteration` flag. Beast Mode's scene-long copies are left out, and `other1` reads
  the ids too. *Needs:* a `pickGrant` that goes through the Alteration drop handler, plus a "not already owned"
  filter.
- **Metier.** A five-way pick that renames the Perk and stores the choice. Weapon Training grants the General Perk.
  A derived hook removes the Assassin Origin's poison-training step for a non-poison pick and sets
  `trained.weapons.<trait>`. *Needs:* a ChoiceSet that renames, boolean derived writes, and an "undo another item's
  Active Effect step" write.
- **Extract Poison.** The Use (out of combat: a poison picker, a Science test against the poison's Availability DIF,
  then the poison is granted). The derived "Qualified (and Trained) in all poisons" sets booleans. *Needs:* a
  `pickGrant` / roll step with a DIF taken from the picked entry, and a DerivedStat that sets `true` (it writes
  numbers, `1`, today).
- **Sea Legs.** Swim becomes 30, or +15 when the character already has Swim. The old hook ran in the gij1 slice's
  derived hook, after gravity and before the `other1` Alteration movement adjustments and the PR movement hooks
  (+20 / +10 to speeds above 0, ×2). A Movement rule runs before gravity, and `ruleDerived` (DerivedStat) runs after
  those hooks. Either one changes the result with Low / Zero Gravity, with a waived Alteration movement cost, or with
  the PR hooks. *Needs:* a Movement / DerivedStat stage that runs where the old hook did, after gravity and before
  the other slices' derived hooks.
- **Improvise Bomb.** Picks a bomb or grenade (a code test over traits, effects and the name) and pays Standard, or
  Free with Demolition Artist. A Technology test runs against the picked item's Availability DIF, and a Critical
  Success makes two copies. *Needs:* a `pickGrant` with the DIF taken from the picked entry, a crit-scaled quantity,
  and a cost that depends on another Perk.
- **Demolition Artist.** Only lowers Improvise Bomb's cost (above).
- **Primal Fear.** It is used through a Free-action Use (a `check:environmentalExpertise` gate, once per turn, the user
  picks Willpower or Cleverness as the DIF, then a Survival test). A success marks the target until the end of the
  turn (out of combat, until the scene changes), and the actor gets ↑1 on Skill Tests targeting it. *Needs:* a
  `roll` step whose `difDefense` comes from a `choose`, and a mark whose out-of-combat expiry is the scene.
- **Feed On Fear.** Only changes Primal Fear's success (heal 1 instead of the mark), so it goes with it.
- **Let It Rip.** A Free action stamps a chosen Signature Weapon as one-handed until the end of the turn. *Needs:*
  the same item-mark step as Recoil Brace, with a picker over the actor's weapons.
- **Scavenger.** Out of combat, once per encounter: pick a type and an item, then a Requisition test one
  Availability step harder. On a success, a copy with Temperamental added. *Needs:* a pick-type step, a Requisition
  roll step with a stepped Availability DIF, and a `grant` override that appends a trait.

#### fix3-gij (`gij-fixes.mjs`)

- **Angry (Hang-Up).** A Snag on the Skill chosen when Angry Influence is used, for the rest of the scene. The record
  is a scene-window flag written by `helpers/angry.mjs`. *Needs:* a tag comparing the rolled Skill with a value stored
  on the actor (`skill:` against `self:data:flags.essence20.angryHangUpSnag.skill`), and a scene-window check on that
  record.
- **Pack Attack (not in the id table).** Its ↑1 lives in a record on each ally within 60 ft, naming the Growled target.
  It holds until the start of the user's next turn. *Needs:* a mark that a Use puts on allies, read by their own
  attacks against a named target, with "until the start of the user's next turn" expiry.

### Engine pieces the skips need

- **Item marks with expiry** (a step that stamps an item, read by ItemModifier): Recoil Brace, Let It Rip.
- **Picks that set a DIF from the picked entry** (`pickGrant` + roll against its Availability DIF, crit copies):
  Improvise Bomb, Extract Poison, Scavenger.
- **Alteration-aware granting** (through `onAlterationDrop`, leaving out owned ones): the six Alteration Perks.
- **A derived stage at the hand-written hooks' place** (after gravity, before the other slices): Sea Legs.
- **Tags comparing the rolled Skill with stored data**, and reading the other party's per-target records: Angry,
  Anonymous.
- **Bank / mark timing**: "this turn, else until used or the scene ends" (Ceremonial, Primal Fear), and marks on
  allies until the start of the user's next turn (Pack Attack).
- **`incoming` DialogSwitch** and counting the target's allies holding an item: Uniform.
- **Boolean DerivedStat writes**, a renaming ChoiceSet, and undoing another item's effect: Metier, Extract Poison.

### Files touched outside the slices

- `packs/ccitems/_source/Adjustable_Faceplate_kEJP9jn7Q0LLufmG.json`, `packs/ccitems/_source/Shielded_GiVoFUU6sd9A9V5X.json`
  (rules inserted as text, LF kept).
- `lang/en.json`: `G1ShieldGranted` removed (one line, LF kept).
- `module/rules/conversions.test.js`, `module/rules/conversions-uses.test.js`: one `// slC gij1` block appended to
  each. The import lines are unchanged.

---

## Batch slC (part): the `gij2` extension slice

**Scope:** every item in the `G2` id table of `module/helpers/extensions/gij2/shared.mjs`, plus The Beat Goes On
(its id is written inline in `reckless.mjs`), plus every other place in `module/` that uses those ids
(`helpers/kits.mjs`, `sheets/base-actor-sheet.mjs` and `helpers/vehicle-defeat.mjs` call into the slice;
`banked-buffs.mjs` holds the Castling / Plan of Action / Fearsome Presence Use buttons; `combat.mjs`,
`reckless-abandon.mjs` and `personal-shield.mjs` hold Aegis / Reckless Abandon / Personal Shield code of their own).
Branch `rules/slC-gij2`, from `rules/slB` at 0d39fc0e.

| Verdict | Items |
|---|---|
| Convert | 3 (Robot + Empathetic, En Passant, Brrrrrrrrrrrrrrt) |
| Partial | 0 |
| Skip | 15 |
| Reference only (stays with the code that reads it) | 4 (Impenetrable Shield, Inspiration, Aegis, The Beat Goes On) |
| Dead table entry, removed | 2 (Acute Sense, Nose For Trouble (TF CRB)) |

That covers the table's 24 keys plus The Beat Goes On. Robot and Empathetic are two keys but one behaviour. Acute
Sense and the TF CRB Nose For Trouble were converted in earlier rounds. Nothing in the slice read their keys any
more, so the keys were removed.

This part added 2 rules to 2 pack items and one step to an existing rule. After it, `scripts/check-rules.mjs`
counts 1350 rules on 966 items (the base was 1348 rules on 964 items), with 0 errors and 0 warnings.

### Converted (3)

| Item | Rule | Why it is exact |
|---|---|---|
| Robot (drone Perk) + Empathetic (drone upgrade) | On Robot: ConditionImmunity `["frightened","mesmerized"]`, `when: ["not:self:hasItem:Compendium.essence20.gi_joe_crb.Item.SQgxzDgyhIjuOMaa"]` | The old `senses.mjs` `preCreateActiveEffect` hook refused those two statuses for an actor holding an item sourced from Robot and none sourced from Empathetic. It warned with `E20.ConditionImmuneWarning`. ConditionImmunity is read by `condition-immunity.mjs#isImmuneToCondition`, inside `essence20.mjs`'s own `preCreateActiveEffect`, which refuses the effect with the same warning. `self:hasItem:` compares the same source chain (`flags.core.sourceId` / `_stats.compendiumSource` / `rulesSource`) as the old `hasItem`, and it does not care where the upgrade is attached, same as before. A Perk is always active for rules. `senses.mjs` held nothing else, so it, its import in `extensions/index.mjs` and its test are gone, together with `G2.robot` / `G2.empathetic`. |
| En Passant | Use (no cost, no limit): `roll` Alertness DIF 15. `onSuccess`: chat line + `bonusAttack {cost: "none"}`; `onFail`: chat line | The `roll` step calls the same `grants.mjs#rollTest(actor, 'alertness', 15)`. `bonusAttack` calls the same `action-economy.mjs#grantBonusAttack(actor, {source: item name, cost: 'none'})` (filter null, no psychic). Neither version pays an action. `G2.enPassant`, the `gij2EnPassant` Use and `E20.Gij2EnPassantFail` / `Hit` are removed. |
| Brrrrrrrrrrrrrrt | Its existing Multiple Targets Trigger gets a last step: `chat` "{name}'s allies may immediately take a Sprint action." | The old Sprint card was posted from an `updateActor` hook when `flags.essence20.brrrrrrrrrrrrrrtUsedThisEncounter` was written. Nothing has written that flag since the ↑1 became this Trigger (the only reference left in `module/` was the hook), so the card never appeared. The line now rides the Trigger's own card, under the per-ally "banks ↑1" lines. The dead hook, `G2.brrrt`, `E20.Gij2BrrrtSprint` and `E20.Gij2Allies` are removed. |

### Behaviour differences

1. **Robot through `isImmuneToCondition` (cross-line).** The drone's immunity is now visible to every caller of
   `isImmuneToCondition`, not only to Condition creation. So a PR Dark Ranger's Terror (`terror.mjs`,
   `other1/jtt.mjs`) no longer accrues from a Robot drone without Empathetic. Before, Terror accrued, then the
   Frightened was refused. Iron Bravado's list (`react/forms.mjs`) reads the user's own immunities, and a drone
   doesn't hold Iron Bravado.
2. **Robot on unlinked copies (same-line).** The immunity now rides the Robot item's rules. A Robot copy made
   before the pack rebuild gets it from the GM's linking pass (`rules/inherit.mjs`), like every other conversion.
3. **En Passant's chat card (same-line).** The card has a title line ("En Passant: Interrupt (DIF 15 Alertness)")
   above the result sentence, and the sentence is no longer localized and no longer names the Perk. With no
   combat, `grantBonusAttack` gives nothing. The old card still said "make one attack now"; the new card says that
   too and adds the engine's "needs a combat to give its extra attacks" line. The roll also carries the item's uuid,
   which nothing reads for this item.
4. **Brrrrrrrrrrrrrrt's Sprint line (same-line).** The line appears again; it had been dead (see above). It isn't
   localized, and it doesn't list the allies by name. The bank lines on the same card name each ally that got the
   ↑1, and that is the same set (allies within 100000 ft).

### Skipped (15)

- **Artillery Support** (gear). Its Use picks one of five strikes and a canvas point (or the targeted vehicle), pays
  a Full Action and stores the call. At the caller's next turn start it posts a "Bring it in" card. That card rolls
  Targeting against every token in the radius, each against its own Defense, then posts per-token damage buttons
  (hit / defended packets, HEAT's splash). *Needs:* a canvas-point / area recipient, delayed state fired at the next
  turn start, and chat-card damage buttons.
- **Castling.** The slice only adds a "may move" note to the `banked-buffs.mjs` use card. The Use itself picks 2
  allies and raises both `system.health.bonus` and `system.health.value` by 1, uncapped. The `heal {temporary}`
  step raises only `health.bonus`, and a plain heal is capped at max. *Needs:* a temporary-Health heal that also
  raises the current value.
- **Energy Resistant** (armor upgrade). It picks one of seven Elements (flag `gij2Element`), then in derived data
  sets `system.resistances.<element> = true` while the host armor is equipped. *Needs:* a DerivedStat (or
  Resistance rule) whose path takes `{choice.x}`, and a `legacy-choices.mjs` entry for the old flag.
- **Expert Knowledge.** It picks a Smarts Skill (flag `gij2ExpertSkill`). A success in that Skill posts "1 extra
  benefit", or 2 on a crit or Degrees of Success x2. Two `afterRoll` Triggers can't reproduce this, because
  `success` also matches `double` / `crit`. *Needs:* an outcome "success but not double / crit" (or a count placeholder
  in chat text), and a legacy-choice entry. Also, a summary outcome of `fumble` with a success in the results
  posted 1 under the old code.
- **Fearsome Presence.** It warns before the roll when there are more than 3 targets or any is past 20 ft. After
  the roll it removes Frightened again from the 4th+ / far targets, stamps the rest, and lifts their Frightened at
  the start of the Renegade's next turn (the Use is in `banked-buffs.mjs`). *Needs:* a post-roll per-target cap
  (count and range), and a mark that removes a Condition from other actors at the holder's turn start.
- **Machinesmith.** ↑6 on an Electromagnetic attack (weapon effect damage type `emp` or weapon trait
  `electromagnetic`) against a target that isn't Computerized and has no computerized gear. `{any: [...]}` and
  `target:data:system.traits.computerized` exist. *Needs:* `target:check:computerizedGear`
  (`other1/cobra-gear.mjs#hasComputerizedGear`) - with it, this is one RollModifier.
- **Martial Artist.** A Use that whispers to the user and the GMs how the target compares to the user: Threat
  Level, Toughness, Evasion (superior / equal / inferior). *Needs:* a chat step with comparison placeholders and
  whisper recipients.
- **Mentor.** It picks a Skill, then an Essence other than that Skill's own (flag `gij2Mentor`), and sets
  `system.skills.<skill>.essences.<essence> = true` in derived data. *Needs:* DerivedStat paths with `{choice.x}`, a
  ChoiceSet whose options depend on another pick, and a legacy-choice entry.
- **Nose For Trouble** (GI Joe CRB, Streetwise for Alertness). It is offered only on a plain Alertness test with
  no item, when Streetwise is the better die. It asks a confirm dialog, then rolls Streetwise with
  `isSpecialized = false`. SkillSubstitution `bestOf` would swap without asking: `ask:` tags are never true in the
  pre-roll pass. It also leaves `isSpecialized` alone. *Needs:* a confirmable SkillSubstitution that clears the
  Specialization.
- **Peerless Pilot** (emergency disembark). `vehicle-defeat.mjs` asks `autoPassesDisembark`: the user holds the
  Perk and is the vehicle's driver. *Needs:* a rule type read by the disembark roll ("passes this test
  automatically"), with `vehicle:driving`.
- **Personal Shield** (Role Points). Vetoes the sheet's Activate toggle when broken, once per encounter, or with
  no uses left. Spends a use on activation, ends after 10 rounds, shorts out on EMP damage (not with Impenetrable
  Shield or EMP immunity), and offers a Technology repair button at DIF 12 + half level. *Needs:* a pre-toggle
  veto, a round-count expiry on a Role Points toggle, a step that switches a Role Points item off, and chat-card
  buttons.
- **Plan of Action.** A "Split" button on the `banked-buffs.mjs` use card moves part of one ally's pending ↑N to a
  second ally. It is hidden when the Officer holds Inspiration. *Needs:* chat-card buttons and a step that edits
  another actor's banked bonus.
- **Queen's Gambit.** After any damage to an ally of a holder in a started combat, it whispers an offer card. Its
  button picks an ally and moves their initiative to just after the current turn (relayed to the GM if needed),
  once per encounter. *Needs:* a Trigger on another actor's `takesDamage`, chat-card buttons, and an
  initiative-reorder step.
- **Reckless Abandon** (Role Points). Vetoes kit use (`kits.mjs#runKitUse`). Ends after 10 rounds, at turn start
  with no enemy token left, and on being Defeated (not with Aegis or The Beat Goes On), each with its own chat
  line. *Needs:* a pre-use veto for kits, a round-count expiry on a Role Points toggle, a "no enemies on the scene"
  tag, and a Role Points switch-off step.
- **Roll Cage.** While a vehicle whose driver holds it resolves its defeat, crew damage is cut to 0 on a crash or
  1 Fire on an explosion. This is a time window keyed off `createActiveEffect` / `updateActor` / the closing chat
  line. *Needs:* a vehicle-defeat damage hook for crew (a `crew`-scoped `taken` DamageModifier with "the vehicle is
  crashing / exploding" tags).

### Reference only (4)

- **Impenetrable Shield:** read by Personal Shield's EMP check (it has its own rules and `combat.mjs` code).
- **Inspiration:** hides Plan of Action's Split button.
- **Aegis** and **The Beat Goes On:** read by Reckless Abandon's Defeated / no-enemies ends.

All four stay with the code that reads them.

### Engine pieces the skips need

- **Chat-card buttons** run by rules (Artillery Support, Personal Shield, Plan of Action, Queen's Gambit).
- **Choice plumbing:** DerivedStat / Resistance paths with `{choice.x}`, a dependent ChoiceSet, and legacy-choice
  entries for `gij2ExpertSkill` / `gij2Mentor` / `gij2Element` (Expert Knowledge, Mentor, Energy Resistant).
- **Role Points toggle lifecycle:** pre-toggle and pre-use vetoes, round-count expiry, a switch-off step (Personal
  Shield, Reckless Abandon).
- **New `check:` names:** `computerizedGear` (Machinesmith).
- **Trigger outcomes / events:** "success, not double" (Expert Knowledge), damage to another actor (Queen's Gambit).
- **Steps:** temporary Health that also raises the value (Castling), an initiative reorder (Queen's Gambit), a
  comparison chat with whisper (Martial Artist), a canvas-point / area recipient (Artillery Support).
- **Other:** a confirmable SkillSubstitution (Nose For Trouble), an auto-pass disembark rule (Peerless Pilot),
  vehicle-defeat crew damage (Roll Cage), and a post-roll per-target cap plus a Condition-lifting mark (Fearsome
  Presence).

### Files touched outside the slice

- `packs/gijcrbitems/_source/Robot_xV4nnjMxlb4dmyxo.json`, `En_Passant_eVRb1Fp43QMdxV1N.json` (new `rules`),
  `Brrrrrrrrrrrrrrt_U3NTi35bk2qI8oB6.json` (one step added). All LF, inserted as text.
- `module/helpers/extensions/index.mjs`: the `./gij2/senses.mjs` import line removed (only that line).
- `lang/en.json`: `E20.Gij2Allies`, `E20.Gij2BrrrtSprint`, `E20.Gij2EnPassantFail`, `E20.Gij2EnPassantHit` removed
  (edited as text).
- `module/rules/conversions.test.js`, `module/rules/conversions-uses.test.js`: one `describe('slC gij2')` block
  appended to each, under a `// slC gij2` header. The import lines are unchanged.

In the slice: `senses.mjs` deleted. `shared.mjs` lost six keys (`acuteSense`, `empathetic`, `robot`, `brrrt`,
`enPassant`, `noseForTroubleTf`). `perks.mjs` lost the En Passant Use and the Brrrrrrrrrrrrrrt hook. `gij2.test.js`
lost the Empathetic test and its `senses` import.

---

## Batch slC, slice gij3: `module/helpers/extensions/gij3/`

**Scope:** every item in the gij3 id tables: `G3` in `gij3.mjs`, the three ids in `dice-hooks.mjs`
(`SECONDS_BETWEEN_CLICK_AND_BOOM_ID`, `BETTER_THAN_THE_BEST_ID`, `TAKEDOWN_EXPERT_ID`) and the three in `disrupt.mjs`
(`TECHNICAL_GLITCH_ID`, `SOME_ASSEMBLY_REQUIRED_ID`, `COMPLETE_SYSTEM_FAILURE_ID`). Each item was checked against the
slice's code and every other use of its id in `module/`. Those other uses are `dice.mjs` (Better than the Best, Seconds
Between Click & Boom, Takedown Expert), `helpers/rough-terrain.mjs` (Seconds Between Click & Boom),
`helpers/requisition.mjs` (Early Adopter's DIF −5) and `helpers/condition-immunity.mjs` (Stalk's Surprised immunity).
`G3.oldHand` is only a reference: Peak Performance uses it to skip the Old Hand Role, so it is not counted. Pillage's two
weapon effects (`pillageFinesse`, `pillageMight`) are counted under Pillage. Branch `rules/slC-gij3`, from `rules/slB`
at 0d39fc0e.

| Verdict | Items |
|---|---|
| Convert | 1 |
| Partial | 0 |
| Skip | 18 |

That is 19 items. Second Skin's Edge switch, Takedown Expert's Edge and Seconds Between Click & Boom's Snag were
already rules from earlier rounds. Their remaining code halves are judged below. This slice added 1 rule to 1 pack
item. After it, `scripts/check-rules.mjs` counts 1349 rules on 965 items (`rules/slB` had 1348 on 964), with 0 errors
and 0 warnings.

### Converted (1)

| Item | Rule | Why it is exact |
|---|---|---|
| Person of Culture | Use, `limit: {per: scene, onlyOnSuccess: true}`: `roll` Culture DIF 15. `onSuccess` posts a chat line. `onFail` runs `spend` 1 `{storyPoints: true}`, then a chat line | The old Use button called `grants.mjs#rollTest(actor, 'culture', 15)` with no action cost. On a success it marked the button used for the scene and spent nothing. On a failure it spent one Story Point through `story-points.mjs` `canSpendForActor` / `spendForActor` (or said there was none to spend), and the button stayed free. The rule's `roll` step calls the same `rollTest`. Its Story Point spend uses the same two helpers (handed in by `essence20.mjs#setStoryPointHelpers`), with the same check before the spend. The `scene` limit uses the same Scene Clock window (`getUses(..., 'scene')`). `onlyOnSuccess` leaves the limit unspent after a failed roll, as the old code did. The `USES` entry, `G3.personOfCulture`, `FLAG.personOfCulture` and the strings `E20.Gij3PersonOfCultureFree` / `NoPoint` / `Paid` are removed. |

### Partial (0)

None.

### Behaviour differences

1. **Person of Culture's chat card** (same-line: the item itself). The card now has a bold title line, "Person of
   Culture: Hint without a Story Point (DIF 15 Culture)", followed by the result line. The result line is fixed English
   in the rule, not a localized string. When no Story Point is left, the engine's generic "not enough" line replaces
   the old "no Story Point to spend" sentence.
2. **Person of Culture's roll carries the Perk's uuid** (cross-line). The `roll` step stamps `itemUuid` on the
   roll, so an `afterRoll` Trigger with `item:own` on this Perk could see it. No such Trigger exists.
3. **The used-this-scene marker moves.** The old flag was `gij3PersonOfCulture`; the rule keeps its own limit key. A
   use already spent this scene before the update is forgotten once. Two copies of the Perk now each get their own Use
   (the usual rule-per-copy difference).

The gij3 tests had no Person of Culture test (only the registry check, which doesn't name it). The new test is the
`slC gij3` block at the end of `module/rules/conversions-uses.test.js`.

### Skipped (18)

- **Second Skin** (the rest). Before a Requisition Test on Athletics or Acrobatics, a button picker swaps the rolled
  Skill **and its Essence** to Technology or Science (`registerPreRoll`). A `useSkill` DialogSwitch only adds the
  shift delta and keeps the rolled Skill/Essence. *Needs:* a pre-roll Skill-swap step or rule type, for example
  `SkillSubstitution {from, to: [...], when}` that rewrites `dataset.skill` / `essence`.
- **Stalk** (Infiltration Edge). The old check is off only when `isKnownOutsideEnvironmentOfExpertise`. The existing
  `check:environmentalExpertise` is `hasActiveEnvironmentalExpertise`: it needs the Environmental Expertise / Read The
  Land Perk and a positive match, so it would switch the Edge off on untagged scenes. *Needs:* a check name for
  `environmental-expertise.mjs#isKnownOutsideEnvironmentOfExpertise`, for example `outsideEnvironmentOfExpertise`
  (used as `not:check:...`). The same check would convert Stalk's Surprised immunity in `condition-immunity.mjs` to a
  ConditionImmunity rule.
- **Subtle Snake.** A three-way select on Social tests (none / ↓1 / Snag). Two DialogSwitches could both be ticked,
  and `stack` can't rank a ↓1 against a Snag. *Needs:* a DialogSwitch select / mutually-exclusive group of unlike
  effects.
- **Pillage.** The two-handed ↓1 switch also sets per-roller state that the hit rider reads (`maxHands: 2`). The hit
  rider disarms, then asks take-or-drop and moves the item between actors. *Needs:* a disarm step (`maxHands` from
  a switch key) and a step that moves a target's item to the actor.
- **Junker.** A once-per-mission Use that adds a requisition attempt on the Party actor (GM relay) and banks an Edge
  for the next Requisition Test. The bank half alone fits a `bank` step, but splitting one button between code and
  a rule would make two buttons. *Needs:* a step that writes to the Party actor (`gainResource` on the party's
  `system.requisition.attempts`).
- **Targeting Eye.** A Free-action Use that sets an "until the end of your next turn" mark. While it lasts the holder
  has ↓1 on melee attacks, melee attacks against the holder get ↑1, and derived data doubles the range of projectile
  effects on weapons without a Scope (also writing `upgradeTouched`). *Needs:* `until: "endOfNextTurn"`, and an
  ItemModifier that can double ranges, skip weapons with a given upgrade and record `upgradeTouched`.
- **The Sound of Angels.** After a qualifying attack (explosive, an aerial vehicle's weapon, or a two-handed
  ballistic weapon), a checkbox picker over allies within 50 ft. Each picked ally costs a Free action and gets
  Lend Assistance's `pendingLendAssistanceEdge` flag against the attack's target. *Needs:* a weapon tag for "two-handed
  ballistic or aerial vehicle", a per-ally action cost, and a step that sets that flag with the hit target.
- **Dreadnok Recruit.** At turn start, a Free action is spent if a non-PC actor named "Dreadnok" is on the scene or the
  Hang-Up's Use marked one present. *Needs:* a scene-token name tag (any token on the scene, not within a range), and
  a step that spends the holder's own action at turn start.
- **Touch Move.** The active GM posts which un-surprised same-disposition combatants may move when the holder's
  Initiative is set (`updateCombatant`). *Needs:* an `initiativeRolled` recipient for "every un-surprised ally in the
  combat", GM-side.
- **Early Adopter.** A once-per-mission Use posts per-ally chat buttons; each ally's own player picks a Standard weapon
  upgrade, armor upgrade or Kit. `requisition.mjs` also lowers Prototype/Theoretical DIFs by 5. *Needs:* chat-card
  action buttons for other players, `pickGrant` filters on `gearType` / upgrade `type`, and a Requisition DIF rule.
- **Field Trials.** The same per-ally card. The picked Limited weapon upgrade gets the Temperamental trait. *Needs:*
  the same chat buttons, plus a `pickGrant` that adds a trait to the granted copy (`system` overrides can't merge a
  list).
- **Peak Performance.** Grants every top-level Role Perk of the base Role (not Old Hand), skipping Plan of Action. It
  is gated by a flag on the item. *Needs:* a step that grants a Role's highest-level Perks outright (`pickPerk` always
  asks).
- **Technical Glitch / Some Assembly Required / Complete System Failure** (`disrupt.mjs`). Pick a Computerized item (or
  any equipment) on the target, roll against its availability DIF (or an open-ended Technology roll whose total is
  saved), and unequip and flag the item. The chat card has Reboot / Repair buttons, and later rolls with the item get
  a Snag and ↓2. *Needs:* steps that act on a target's item, an open-ended roll step, chat buttons, and an item-flag
  roll tag.
- **Better than the Best.** A natural 20 on the kept d20 turns a miss into a success and a success into a Critical,
  inside `dice.mjs`'s multiplier. *Needs:* a RollDice/outcome option that raises the multiplier on a natural 20.
- **Seconds Between Click & Boom** (the rest). Miss effects (Trigger Happy, Explosive Aftershock, Wrecker Rough
  Terrain) are skipped for the holder on Evasion attacks (`dice.mjs`, `rough-terrain.mjs`). *Needs:* an "ignore miss
  effects" rule type read by those call sites.
- **Takedown Expert** (the rest). On a failed Takedown against a target of the holder's level or lower, a choice of
  Disarmed (through `disarm`), Immobilized or Silenced. *Needs:* a Takedown-failed Trigger event and a disarm step
  (`choose` + `applyCondition` would cover the other two options).

### Engine pieces the skips need

1. **A `check:` name for `isKnownOutsideEnvironmentOfExpertise`** (Stalk's Edge and its Surprised immunity). This is the
   smallest gap.
2. **A pre-roll Skill swap** that changes the rolled Skill and Essence (Second Skin).
3. **Party and cross-player steps:** a write to the Party actor (Junker), chat-card buttons for other players to pick
   (Early Adopter, Field Trials), `pickGrant` filters on gear/upgrade subtype, and adding a trait to a granted copy.
4. **Item-level steps on a target:** disarm with `maxHands`, take a target's item, disrupt/unequip with a flag
   (Pillage, Takedown Expert, Technical Glitch, Some Assembly Required).
5. **`until: "endOfNextTurn"` and a range-doubling ItemModifier** (Targeting Eye).
6. **Roll-outcome hooks:** natural-20 success/crit (Better than the Best), ignore miss effects (Seconds Between Click &
   Boom), a Takedown-failed Trigger event.
7. **Others:** a mutually-exclusive select switch (Subtle Snake), a scene-token name tag and a turn-start action spend
   (Dreadnok Recruit), a GM-side Initiative announcement to allies (Touch Move), a grant of a Role's top Perks (Peak
   Performance), a Requisition DIF rule (Early Adopter).

### Files touched outside the slice

- `module/rules/conversions-uses.test.js`: the `// slC gij3` block, appended at the end. No import change.
- `lang/en.json`: `E20.Gij3PersonOfCultureFree`, `E20.Gij3PersonOfCultureNoPoint` and `E20.Gij3PersonOfCulturePaid`
  removed.
- Pack source: `packs/ghpfitems/_source/Person_of_Culture_UASxRYtsWV1CnE8y.json`.
- `extensions/index.mjs` is unchanged: no gij3 file became empty.

---

## Batch slC, slice situational1: `module/helpers/extensions/situational1/`

**Scope:** every item in the `S1` id table of `module/helpers/extensions/situational1/situational1.mjs`, plus every
other place in `module/` that uses those ids (`helpers/sneak-attack.mjs` for Every Trick in the Book,
`helpers/banked-buffs.mjs` for Danger Sense, `dice.mjs` for Urban Jungle, Shotgun and Submachine Gun,
`helpers/environment-hazards.mjs` for Scuba Gear, `helpers/environmental-expertise.mjs` / `rough-terrain.mjs` for
Environmental Expertise, `qualify1/common.mjs` for Acclimating). Branch `rules/slC-sit1`, from `rules/slB` at
0d39fc0e.

| Verdict | Items |
|---|---|
| Convert | 0 |
| Partial | 4 |
| Skip | 21 |

That is 25 items with behaviour of their own. Four more table entries are only references: Environmental Expertise
(Adapted Vehicles checks the driver owns it), Shotgun and Submachine Gun (Ambush Master checks for one) and Scuba
Gear (Diver grants it). Urban Jungle's entry in `S1` is read by nothing in the slice; its own code lives in
`dice.mjs` (see the skips).

This part added 7 rules to 4 pack items. After it, `scripts/check-rules.mjs` counts 1355 rules on 966 items (the
base was 1348 rules on 964 items), with 0 errors and 0 warnings.

### Converted (0)

None in full. Every item with a rule here keeps some code (below).

### Partial (4)

| Item | Converted | Rule | Still code |
|---|---|---|---|
| Spacewalker | The roll bonuses: Edge on Athletics / Acrobatics in low or zero gravity, ↑1 on every other roll in zero gravity, not while crewing a vehicle | Two RollModifiers: Edge with `{any: [skill:athletics, skill:acrobatics]}`, `{any: [environment:lowGravity, environment:zeroGravity]}`; ↑1 with `environment:zeroGravity`, `not:skill:athletics`, `not:skill:acrobatics`. Both carry `not:vehicle:type:vehicle` and `not:roll:initiative` | The +5 Evasion (derived data). The old code reads the environment there with `includeInterior: false`; the `environment:` tag reads it with the vessel interior, which differs aboard a Decompressed / Leaking vessel, so a static Defense rule would not be exact. `S1.spacewalker` stays for it and for the `updateToken` refresh. |
| Out of the Jungle | Edge on non-attack tests, attacks Specialized, ignores Rough Terrain | RollModifier Edge (`not:attack`, `not:roll:initiative`); RollModifier `specialize` (`attack`); MovementAction `ignoreRoughTerrain` | Light Armor counting as Silent on Infiltration (the summed armor bonus of every equipped Light battledress without Silent as a ↑; no formula sums over items). `isInJungle` no longer counts Out of the Jungle; the noise source asks `isInJungle(actor) \|\| has(actor, S1.outOfTheJungle)` instead, with the same label as before. |
| Danger Sense | The holder can't be Surprised | ConditionImmunity `["surprised"]`, appended after the item's existing Initiative switch | The Protected Target's immunity within 10 ft (`surpriseImmunitySource`). An aura ConditionImmunity with `holder:protects` would reach the same actors (aura allies use `getNearbyAllyTokens` from the Protected Target's side, as the old code does), but `ruleConditionImmune` does not pass `holder` to the condition, so `holder:protects` reads the Protected Target's own flag. The Protected-Target Initiative sync in `banked-buffs.mjs` is out of the slice and unchanged. |
| Every Trick in the Book | Can't be Surprised | ConditionImmunity `["surprised"]`, appended after the item's existing incoming Snag rule | The sneak-attack immunity in `helpers/sneak-attack.mjs` (no rule type answers "not a valid sneak attack target"). `S1.everyTrick` is removed from the slice. |

Why the converted parts are exact:

- **Spacewalker:** the old roll source and the rules come through the same `extRollSources` call (the rules adapter is
  registered there too), with the same `ctx`. The `environment:` tag reads `getEnvironment(actor)` with its default
  options, which is what `environmentOf(actor)` read for rolls. "Not crewing" was `crewedVehicleOf` (the first world
  vehicle listing the actor in `system.actors`); `vehicle:type:vehicle` asks `links.mjs#crewedBy`, the same search over
  vehicles and Zords, and is true when what it found is a vehicle. Initiative reads rule sources but never read
  extension roll sources, hence `not:roll:initiative` (Initiative's rule context carries `dataset.isInitiative`).
  The old `else if` meant Athletics / Acrobatics never got the ↑1; the ↑1 rule says so with its two `not:skill:` tags.
  A roll with no Skill (an Essence roll) got the ↑1 before and still does.
- **Out of the Jungle:** `isInJungle` returned true for it unconditionally, so all three effects were unconditional
  for the holder. `not:attack` is `!isAttack` with `isAttack = ctx.isAttack ?? item is a weaponEffect`, the old test.
  `ruleSpecializes` is registered into the same `extSpecializes` list as `situationalSpecializes` and derives
  `isAttack` from the item type, as the old `isAttackItem` did. `ruleMovement(actor).ignoreRoughTerrain` is the first
  entry of `rough-terrain.mjs`'s `ROUGH_TERRAIN_IGNORERS`, the same list `ignoresRoughTerrainS1` sat in.
- **Danger Sense / Every Trick:** the holder's own Surprised was refused in `preCreateActiveEffect`.
  `essence20.mjs`'s own `preCreateActiveEffect` hook refuses every status `isImmuneToCondition` names, and that asks
  `ruleConditionImmune` - so the Condition is still never created, from any source (`toggleStatusEffect`, the token
  HUD, the surprise helpers).

### Behaviour differences

1. **Dialog sources and labels.** The converted roll sources carry rule ids (`rule-<item>-<n>`) where they had
   `s1-spacewalker` / `s1-jungleFighter`, and the rule labels ("Spacewalker (zero gravity)", "Out of the Jungle
   (non-attack tests)") instead of the item's own name, so a renamed copy no longer shows its own name.
2. **Out of the Jungle plus Jungle Fighter in the jungle (same-line).** The old code listed one Edge source (labelled
   Jungle Fighter). Now Jungle Fighter's code source and Out of the Jungle's rule source are both listed; the roll
   still has one Edge. Out of the Jungle requires Jungle Fighter, so this is the ordinary case in the jungle.
3. **Surprised warning text (same-line).** Refusing Surprised for a Danger Sense / Every Trick holder now shows the
   generic "{actor} is immune to Surprised and can't be affected by it." (`E20.ConditionImmuneWarning`) instead of
   "{actor} can't be Surprised (Danger Sense)." (`E20.S1SurpriseImmune`, still used for the Protected Target).
4. **Immunity lists (cross-line).** Surprised now shows up wherever the system lists an actor's immunities through
   `isImmuneToCondition`: Iron Bravado's share (`react/forms.mjs`, a Power Rangers Perk) would pass Surprised on to
   allies if its holder also had Danger Sense or Every Trick in the Book.
5. **Spacewalker crewing a Zord (same-line, edge case).** `crewedBy` returns the first vehicle or Zord listing the
   actor; if an actor is listed on a Zord earlier in the world's actors and also on a vehicle, the rule sees the Zord
   and gives the bonus where the old code (vehicles only) did not.
6. **Duplicate copies.** A rule applies once per copy of its item; the old code read the first copy. None of these
   Perks is taken twice.

### Skipped (21)

#### Environment and terrain (rolls, derived data)

- **Layered Armor.** +1 `skillEffectModifierBonus` on Persuasion (Leadership) while worn. *Needs:* a flat roll bonus
  (not a shift) on a RollModifier / DialogSwitch.
- **Environmental Warrior.** ↑1 on attacks where a Survival Specialization's free-text name matches keywords for the
  terrain / environment; a dialog switch on a scene with neither. *Needs:* a tag matching Specialization names
  against the current terrain's / environment's keyword lists.
- **Jungle Fighter.** Edge / Specialized / Rough Terrain / Silent light armor in the `woodlands` terrain, else
  (terrain unset) a Use-button flag. `terrain:woodlands` is unknown on an untagged scene (the rule would become a
  switch, and MovementAction would never apply), and an `{any: [terrain, flag]}` would read the flag on a scene that
  IS tagged. *Needs:* a "terrain is set" tag (or a terrain tag that falls back to a toggle), and a summed-armor
  formula for the Silent part.
- **Urban Jungle** (code in `dice.mjs`). Edge on non-attack tests / Specialized attacks only when the terrain is
  urban, nothing when no terrain is set. `terrain:urban` would turn into a dialog switch on an untagged scene. *Needs:*
  the same "terrain is set" tag. (Its table entry in this slice is unused and stays as it was.)
- **Urban Adaptation.** A role-point-like pool (Ranger table by half level), a Free-action pick of one Urban Jungle
  ability for the rest of the scene outside a city, reset on rest. *Needs:* a Pool whose max is a level table,
  scene-scoped chosen abilities read by Edge / Specialized / Rough Terrain.
- **Earth Defense Command Benefits** (driving ↑2 and Space Kit). The driving ↑2 reads the aerial Movement `total ??
  base` of the vehicle driven (or the vehicle itself); `vehicle:moves:aerial` reads `base` only. The Space Kit Use
  makes a Limited Kit from a picked Specialization, once per mission. *Needs:* `vehicle:moves` on the total, and a
  kit-making step.
- **Adapted Vehicles.** The vehicle gets Edge / Specialized / no Rough Terrain when its driver holds this and
  Environmental Expertise and the terrain under the VEHICLE is one of the driver's environments of expertise (or the
  driver's toggle on an untagged scene). *Needs:* a `driven`-scope check of the driver's expertise against the
  vehicle's terrain.
- **Environmental Enforcer.** A Use choosing up to (Survival ranks) terrains, stored on the item; Edge on Maneuver /
  Shove attacks in a chosen terrain, a dialog switch on an untagged scene. *Needs:* a multi-pick ChoiceSet sized by a
  formula and a "terrain is one of the choices" tag.
- **Environmental Camouflage.** The worn battledress's Toughness bonus added to Evasion and its Evasion bonus to
  Toughness in a chosen terrain (or a manual "in it" toggle). *Needs:* host-armor values in Defense formulas and a
  "terrain is the chosen one" tag.
- **Weatherproof.** Cancels each of the chosen environment's weapon penalties (dice.mjs's Environment block) with a
  matching Edge / ↑, per trait and damage type. *Needs:* a list ChoiceSet of environments and per-penalty sources (or
  an immunity to "environment penalties").
- **Weather Gear / Acclimating.** `ENVIRONMENT_PROTECTORS` entries: ignore temperature-hazard penalties (in the chosen
  environment / any) while the battledress is worn. *Needs:* a rule type read by `environment-hazards.mjs`.
- **City Slicker** (its code toggle; the item already carries an unconditional "Roll Streetwise instead" switch on
  Infiltration from an earlier batch). The code toggle is offered only when the terrain is urban or unset, ticked when
  urban. A DialogSwitch with `terrain:urban` would be offered in the same cases but can't start ticked only when the
  answer is known. *Needs:* a switch default that follows its condition (ticked when known true), or a "terrain is
  set" tag. Note: the two switches can both be ticked today, which doubles the swap; not changed here.

#### Dialog toggles and Uses

- **Fast Tracking.** Edge switch on favorite-weapon attacks, pre-ticked when it looks like a Contingency (in combat,
  not your turn, a contingency in your action ledger). *Needs:* a "contingency set this round" tag (and a
  condition-following default).
- **Misguide.** Story Point on another creature's turn in an environment of expertise: Rough Terrain for that
  creature's turn (or its next one), via `ROUGH_TERRAIN_IMPOSERS`. *Needs:* a mark read by rough terrain that lasts
  for the marked creature's (next) turn.
- **Ambush Master** (its Use; the item's ConditionImmunity is an earlier batch's). A free bonus attack once per
  combat while an enemy combatant is Surprised and the holder owns a Shotgun or Submachine Gun. *Needs:* an "an enemy
  combatant has status X" tag (the `bonusAttack` step and `self:hasItem:` would cover the rest).
- **Ghost.** A Use toggling "hiding" (a flag Arashikage Shozoku reads) and the Invisible Condition on or off.
  *Needs:* a toggle step that also applies / removes a Condition by the new state (a conditional step).
- **Arashikage Shozoku.** Free action, DIF 20 Infiltration, on success Invisible until the start of the next turn,
  ended early by taking damage; only while the battledress is worn. *Needs:* a Condition with `until: nextTurn` that
  also ends on damage, and a worn-host gate on a Use.
- **Contort.** Move action or 2 Free actions (picked), doubled melee Reach until the end of the turn. *Needs:* a
  Reach rule / `totalReach` ItemModifier with `until`, and an alternative-cost picker.
- **Izuna Drop.** Asks fall distance, Grapple roll (better of Athletics / Acrobatics) against Toughness, fall damage to
  the target with overflow to the faller, Prone, a GM damage button. *Needs:* chat damage buttons and damage split /
  overflow steps.
- **Diver** (its Use; its Alertness ↑1 underwater is an earlier batch's rule). A Limited Athletics (Swimming) kit and
  Scuba Gear once per mission. *Needs:* a kit-making step (the `grant` step and a mission limit cover the gear).

### Engine pieces the skips need

- **A "terrain is set" tag** (or terrain tags that answer false instead of unknown, per rule): Jungle Fighter, Urban
  Jungle, City Slicker; with **a switch default that follows its condition**, City Slicker and Fast Tracking.
- **Terrain choices:** a multi-pick ChoiceSet sized by a formula and a "terrain is one of the choices" tag
  (Environmental Enforcer, Environmental Camouflage, Weatherproof, Weather Gear).
- **A kit-making step:** Diver, Earth Defense Command's Space Kit.
- **`ruleConditionImmune` passing `holder`** to the condition: Danger Sense's Protected Target half.
- **A flat (non-shift) roll bonus:** Layered Armor.
- **Formulas summing over items** (equipped Light armor bonuses): Jungle Fighter / Out of the Jungle's Silent armor.
- **A Defense rule reading the environment without the vessel interior:** Spacewalker's +5 Evasion.
- **Rule types for hazards and rough-terrain imposers:** Weather Gear, Acclimating, Misguide.
- **Conditions with `until` and end-on-damage, conditional steps, Reach rules, damage-split steps, chat damage
  buttons:** Arashikage Shozoku, Ghost, Contort, Izuna Drop.
- **Tags:** an enemy combatant with a status (Ambush Master), "contingency this round" (Fast Tracking),
  `vehicle:moves` on the total (Earth Defense Command), Specialization names against terrain keywords
  (Environmental Warrior), a driver's expertise against the vehicle's terrain (Adapted Vehicles).

### Files touched outside the slices

- `packs/atsitems/_source/Spacewalker_OasmncqkxGO3QCXv.json`, `packs/sssitems/_source/Out_of_the_Jungle_5jc5fjieruLuWQm1.json`
  (new `rules` arrays, first key of `system`), `packs/gijcrbitems/_source/Danger_Sense_2hwFRZ67xIGt1XTm.json` and
  `packs/gijcrbitems/_source/Every_Trick_in_the_Book_HKv38GCtVdSV2qMH.json` (one rule appended after the existing
  ones, so earlier rule indices don't move). Rules inserted as text, LF kept.
- `module/rules/conversions.test.js`: one `describe('slC sit1')` block appended at the end (`ruleConditionImmune` is
  imported dynamically inside the test, so the import line is unchanged).
- No `lang/en.json` strings became unused.

No slice file became empty, so `extensions/index.mjs` is unchanged. Inside the slice: `situational1.mjs` (the
`everyTrick` key, the Spacewalker roll source, Out of the Jungle in `isInJungle` and the jungle roll block, the
holder's own Surprised check in `surpriseImmunitySource`) and `situational1.test.js` (the Spacewalker, Jungle Fighter
and Danger Sense tests reworked; the Danger Sense test now covers the Protected Target path).

---

## Batch slC (part): the `situational2` extension slice

**Scope:** every item in the id table of `module/helpers/extensions/situational2/` (`S2` in `common.mjs`, used by
`situational2.mjs` and `initiative.mjs`), plus every other place in `module/` that uses those ids. The only other
code user is `helpers/rough-terrain.mjs`, which reads Feet Wet. Bookworm, Tracking Outfit, Seafarer, Amphibious
Assault and Lay of the Land already have pack rules from earlier rounds. Their remaining code is the part judged
here. Branch `rules/slC-sit2`, from `rules/slB` at 0d39fc0e.

| Verdict | Items |
|---|---|
| Convert | 0 |
| Partial | 1 |
| Skip | 21 |

That is 22 id-table entries. Rifle (Tritium Sight) is a ready-made weapon that carries the Tritium Sights
behaviour, so Tritium Sights and the rifle are judged together below but counted as two entries.

This part added 1 rule to 1 pack item. After it, `scripts/check-rules.mjs` counts 1349 rules on 965 items (the base
was 1348 rules on 964 items), with 0 errors and 0 warnings.

Nothing was removed from the slice, so the `S2` table, `extensions/index.mjs` and the slice's test file are
unchanged. Almost everything here depends on where a token is (terrain, water, darkness, aboard a vessel), on
chat history, or on flags that slice code writes. The existing tags either can't answer those questions, or answer
"unknown" where the old code answered "no".

### Converted (0)

None.

### Partial (1)

| Item | Converted | Rule | Still code |
|---|---|---|---|
| Feet Wet | Ignoring Rough Terrain on sea terrain: the `FEET_WET_ID` entry in `helpers/rough-terrain.mjs`'s `ROUGH_TERRAIN_IGNORERS` | MovementAction `ignoreRoughTerrain`, `when: ["terrain:sea"]` | The whole slice side (`isFeetWetActive`): sea, aboard an aquatic vessel, and wetlands with Ship Shape, for Rough Terrain, the non-combat Edge and the Specialized attacks. That code already covered the sea case, so the old `rough-terrain.mjs` entry was a subset of it. |

Why the rule is exact: `ruleMovement` is the first entry of `ROUGH_TERRAIN_IGNORERS`, and the list is an OR, so
the rule sits where the old entry sat. `terrain:sea` reads the same `environment.mjs#getTerrain(actor)` that the old
`isActive` read. When no terrain is set, the tag is unknown, and `ruleMovement` only applies a rule whose condition
is `true`, so it does nothing, just as `null == 'sea'` was false. Removed: `FEET_WET_ID`, its table entry, the
now-unused `getTerrain` import in `rough-terrain.mjs`, and the Feet Wet test in `rough-terrain.test.js`. That test
now lives in `module/rules/conversions.test.js` (`// slC sit2`).

### Behaviour differences

1. **Feet Wet: duplicate copies.** The rule applies once per copy of the Perk, and the old entry checked whether the
   Perk was owned at all. This is an ignore flag, so the result is the same.
2. **Feet Wet: other printings.** The old entry matched only the Quartermaster's Guide uuid (`actorHasPerk`). The rule
   is on the item itself, so a Feet Wet copied from a different uuid with the same rules would count too. There is
   only one Feet Wet in the packs.

There are no same-line differences.

### Pre-existing issue found (not changed)

- **Bookworm on Initiative counts twice in a library scene.** Initiative now reads item rules
  (`dice.mjs#prepareInitiativeRoll`). Bookworm's existing RollModifier (`scene:name~librar` or `ask:`) therefore
  gives ↓1 as a rule source on Initiative. `initiative.mjs#situationalInitiative` then adds its own ↓1 after the
  dialog, so a library scene gives ↓2. With a hostile Librarian in the fight, the extension's ↓1 is automatic and the
  rule also offers an "ask" switch, so ticking it gives ↓2 too. The fix belongs with Bookworm's conversion. Removing
  the extension half alone would stop the automatic ↓1 for a Librarian combatant (see the skips).

### Skipped (21)

#### Clothing and gear

- **Arctic Expedition Clothes, Desert Expedition Clothes, Desert Gear.** +2 Toughness on the sheet in the matching
  environment or terrain, taken back off when a creature attacks. *Needs:* (a) an `environment:` tag that skips the
  vessel-interior lookup (the old code reads `getEnvironment(actor, {includeInterior: false})`; the tag includes it,
  so a crew member aboard a Decompressed or Leaking vessel would differ); (b) a way to refresh derived data when a
  token's Regions change for actors whose static rules use `terrain:` or `environment:` (the slice's `updateToken`
  hook does this by item id); (c) per-attack additive Defense applied outside `ruleDefenseAdjust`'s best/halve
  reshaping (the old −2 was another extension adjust, so Unseen Strike's halving acted before it, not after).
- **Business.** +2 Cleverness against StrexCorp agents. *Needs:* a creature-tag prefix test (the old code matches
  any tag *starting* with `strex`, while `target:tag:` is an exact match). It also has the same best/halve ordering
  issue as (c) above.
- **Tracking Outfit (Initiative half).** ↑1 on Initiative in the wild. `["roll:initiative","terrain:wild"]` would
  match, but with no terrain set the tag is unknown, so the rule would become an unticked Initiative switch where
  the old code gave nothing. regA skipped Urban Jungle for the same reason. *Needs:* a terrain tag that answers
  false when no terrain is set. Its roll halves were already rules.
- **Caltrops.** A Use posts a card with a "cross" button. Whoever presses it rolls DIF 15 Acrobatics and on a
  failure takes 1 Speed Essence damage. *Needs:* chat-card action buttons for any actor, and an Essence-damage
  outcome on a roll or `save` step.
- **Tritium Sights / Rifle (Tritium Sight).** ↑1 on attacks in complete darkness: automatic when the scene's
  darkness level is at least 0.95, otherwise a checkbox. *Needs:* a darkness tag (true / unknown) and a "weapon
  has this upgrade attached, or is this weapon" tag at roll time (`weapon:` can test the weapon's own id but not its
  attached upgrades).

#### Water and the sea (Quartermaster's Guide)

- **Seafarer (Swimming half).** Edge on Athletics in the water, otherwise a checkbox. "In the water" means an
  underwater environment *or* a token moving by swimming. *Needs:* a tag for the token's movement action (`swim`),
  plus the interior-free `environment:` tag. Its Driving half was already a rule.
- **Seafarer (Hang-Up).** On land, poison and illness attacks gain Edge against the holder, and the holder gets a
  Snag on saves against them (or a checkbox on Conditioning/Athletics/Brawn). *Needs:* the swim and "aboard an
  aquatic vessel" tags (for "on land"), and a tag that reads a save rider's spec (`dataset.riderSpec` JSON:
  poison damage, the `poisoned` status, the title).
- **Amphibious Assault (Initiative half).** ↑1 on Initiative in the water. *Needs:* the same swim and
  environment tags. Its Movement rules were already rules.
- **Shark's Fin.** Doubles Ground and Aquatic Movement at sea, in the wetlands or aboard an aquatic vessel, and on
  Initiative lifts Surprise and posts a move note. *Needs:* an "aboard an aquatic vessel" tag that matches the old
  lookup (`vehicle:moves:swim` reads only `swim.base` and also counts Zords, while the old code reads base *or* total
  and only `vehicle` actors), a derived stage after gravity (the old doubling runs in `registerDerived`), the
  Region refresh above, and a "remove a Condition" step on `initiativeRolled`.
- **Ship Shape.** Spreads Feet Wet to wetlands, and to aquatic vehicles its holder drives (Edge, Specialized, Rough
  Terrain, Movement ×1.5 rounded down). *Needs:* the "aboard an aquatic vessel" tag above and a `driven`-scope
  Movement multiply that matches the old derived-time position.
- **Feet Wet (the rest).** See Partial.

#### Situations from chat, flags and Surprise (MLP CRB)

- **Competitive.** Watches every Skill Test card, banks a Snag when a same-side ally out-rolls you on the same
  Skill within five minutes in this scene, and spends it on the next test. *Needs:* a Trigger on other actors' rolls
  with a comparison against this actor's last result.
- **Forgiving.** Logs everyone who attacks or Intimidates the holder, then gives Edge on Empathy against a logged
  aggressor and clears the entry. *Needs:* an "I was attacked by X" Trigger (a mark set by the attacker on the
  defender's side, read as `markedBy:`), and Empathy's chosen Skill (`tender.mjs#getEmpathyChoice`) as a tag.
- **Take in a Scene.** When Surprised on Initiative, rolls Alertness against the lowest hostile Infiltration in
  recent chat, or asks the GM by button. *Needs:* a DIF from chat history and GM-ruling chat buttons.
- **Misplaced Confidence.** Extends a failed Take in a Scene's Surprise through round 2. *Needs:* Take in a Scene
  converted with it, and a timed Condition hold.

#### Other

- **Cartography Suite.** A Use records the surveyed scene, and holders and allies within 60 ft then get Move
  actions while Surprised there. *Needs:* a "flag set on this scene" tag (a mark tied to a scene) and an ally
  aura for a derived action count (SurpriseExemption `move` also allows Skill Tests, which the old code doesn't
  touch).
- **Lay of the Land (Rough Terrain half).** Ignores Rough Terrain on the surveyed scene. *Needs:* the same
  scene-survey tag. Its Cover half was already a rule.
- **Plow.** A Ram gains Multiple Targets (3), also for a vehicle it drives, and stamps the turn so movement ignores
  Rough Terrain. *Needs:* a Multiple Targets grant rule type and a turn-scoped mark read by MovementAction
  (`until` the end of this turn, set by a preRoll).
- **Bookworm (Initiative half).** ↓1 when the scene is a library (by the token's own scene) or a hostile Librarian
  is in the combat. Removing it would turn the Librarian-combatant case from automatic into a switch. *Needs:* a
  "hostile combatant matches target: tags" tag. See the pre-existing double count above.

### Engine pieces the skips need

- **Where the token is:** a "token is swimming" tag (movement action), an `environment:` variant without the vessel
  interior, a scene-darkness tag, an "aboard an aquatic vessel" tag that matches `common.mjs#isAboardAquaticVessel`,
  and a terrain tag that answers false (not unknown) when no terrain is set.
- **Refresh:** re-prepare actors whose static rules read `terrain:` / `environment:` when their token's Regions change.
- **Defense ordering:** per-attack additive Defense applied after best/halve, the way other extension adjusts land.
- **Tags:** creature-tag prefix; save-rider spec (poison / illness); a "weapon has upgrade X attached" test; "a
  hostile combatant matches"; a scene-survey flag.
- **Triggers / steps:** other actors' rolls (Competitive), being attacked (Forgiving), Condition removal and holds on
  Initiative (Shark's Fin, Take in a Scene, Misplaced Confidence), chat buttons usable by any actor (Caltrops, Take in
  a Scene), Essence damage on a failed roll, a Multiple Targets grant (Plow).

### Files touched outside the slice

- `packs/qgtgitems/_source/Feet_Wet_7u3xCPPjxJlI7c61.json`: the rule, inserted as text (LF, like the file).
- `module/helpers/rough-terrain.mjs`: removed `FEET_WET_ID` and its `ROUGH_TERRAIN_IGNORERS` entry, dropped the
  now-unused `getTerrain` import, and added Feet Wet to the comment listing the MovementAction-rule items.
- `module/helpers/rough-terrain.test.js`: removed the Feet Wet test and its id constant.
- `module/rules/conversions.test.js`: appended the `describe('slC sit2', ...)` block. The import line is unchanged
  (`ruleMovement` was already imported).
