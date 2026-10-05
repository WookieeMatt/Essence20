# Batch slC2: re-check of slC (`gij1`, `gij2`, `gij3`, `fix3-gij`, `situational1`, `situational2`) against the 2026-10-04 engine pieces

**Scope:** every item `docs/rules-batches/slC.md` marked Skipped, plus the code half of every item it marked Partial,
re-checked against the engine sections "Engine features added 2026-10-04 (after the slice round)" and "(the bigger
pieces)". The batch was done in five parts (`rules/slC2-gij1` for gij1 + fix3-gij, `rules/slC2-gij2`,
`rules/slC2-gij3`, `rules/slC2-sit1`, `rules/slC2-sit2`), all from `rules/slB2` at 7aae53e4, and merged into
`rules/slC2`. Each part's full write-up follows below.

| Verdict (re-checked items) | gij1 + fix3-gij | gij2 | gij3 | situational1 | situational2 | Total |
|---|---|---|---|---|---|---|
| Convert (now fully rules) | 1 | 1 | 1 | 1 | 0 | **4** |
| Already converted upstream | 0 | 0 | 0 | 1 | 0 | **1** |
| Partial, nothing more converts | 0 | 0 | 0 | 4 | 1 | **5** |
| Still skip | 20 | 14 | 17 | 19 | 21 | **91** |
| Re-checked | 21 | 15 | 18 | 25 | 22 | **101** |

5 rules were added to 4 pack items. After the merge, `scripts/check-rules.mjs` counts 1551 rules on 1062 items (slB2
left 1546 on 1060), with 0 errors and 0 warnings. ESLint is clean and jest passes (503 suites; 9632 passed, 2
skipped). The only merge conflicts were the parts' test blocks appended at the end of `conversions.test.js` and
`conversions-uses.test.js`; all are kept. No slice file became empty.

**What moved:**
- **Adjustable Faceplate (gij1):** its open / closed Use is a rule (`choose` + `updateItem` writing the same
  `gij1Faceplate` flag the Defense rules read) - with slC's Defense half the item is now all rules.
- **Machinesmith (gij2):** the ↑6 on EMP / Electromagnetic attacks against non-computerized targets, using
  `target:check:computerizedGear`.
- **Stalk (gij3):** the Infiltration Edge and the Surprised immunity, using `check:outsideEnvironmentOfExpertise`; its
  entry in `condition-immunity.mjs` is removed.
- **Diver (situational1):** its once-per-mission Use (`createItem` kit + grant Scuba Gear) - with slC's Alertness rule
  the item is now all rules.
- **City Slicker (situational1):** already converted by the engine commit that added `defaultWhen`.

**Behaviour differences worth a decision** (every difference is in its part's section):
- **Diver keeps an old bug on purpose:** the old code meant to mark Scuba Gear as granted by Diver but the mark never
  landed, so removing Diver left the gear behind. The rule reproduces that with `flags: {grantedBy: null}`; delete the
  override if the gear should go with Diver.
- **Machinesmith (same-line, arguably a fix):** a crew member firing a vehicle's Electromagnetic-trait weapon now gets
  the ↑6 (the old code looked for the weapon among the crew member's own items and never found it).
- **Adjustable Faceplate:** can no longer be set while its host armor is unequipped (rule Uses show only on active
  items; the +1 never applied then anyway).
- **Uses forgotten once:** Diver's mission count moves to a new key, so it can be used once more this mission.
- **Stalk:** its dialog source has a new label and id, so a source a player had switched off isn't remembered.
- **Wording:** Faceplate's and Diver's chat text is now the rules engine's (5 `lang/en.json` keys removed).

**Still there, not changed:** Bookworm's double ↓1 on Initiative in a library scene (slC) - it needs Bookworm's
Initiative half to convert, which needs a "hostile combatant matches" tag.

**Engine pieces the remaining skips need** (most useful first; each part's list has the detail):
- **Moving old-flag choices into `pick`'s store,** plus a multi-choice pick: Weatherproof would convert today without it
  wiping the saved environment on existing copies; Weather Gear, Environmental Enforcer / Camouflage, Energy Resistant,
  Mentor, Expert Knowledge also wait on it (slA2 and slB2 hit the same gap).
- **Position and terrain tags:** a "terrain is set" tag (or one that answers false when unset - `defaultWhen` doesn't
  cover Tracking Outfit), token swimming, aboard an aquatic vessel, scene darkness, `environment:` without the vessel
  interior, re-preparing actors when their token's Regions change.
- **Steps on a target's items:** disarm with a hand count, take an item, `pick` over a target's items, a roll whose DIF
  comes from the picked item (Pillage, Takedown Expert, the Disruptor Perks, Improvise Bomb, Scavenger, Extract Poison).
- **Timing:** "this turn, else the rest of the scene" for marks / toggles / limits, item marks with expiry,
  `until: endOfNextTurn`, a mark the using roll removes, marks from several setters under one key.
- **Buttons:** one button per Party member with per-presser limits (Early Adopter, Field Trials); `runAs: clicker`
  preferring the presser's controlled token (Caltrops).
- **Roll pieces:** a natural-20 hook, "ignore miss effects", a Takedown-failed event, a "success but not double" outcome,
  a confirmable Skill + Essence swap, a select-style switch, a flat (non-shift) roll bonus.
- **Other:** hazard-protection and Rough-Terrain-imposing rule types, an Essence-damage step, temporary Health that
  also raises current Health, Role Points toggles that veto / expire / switch off, `ruleConditionImmune` passing the
  holder (Danger Sense), a "can't be sneak-attacked" rule, a derived stage where the old hooks run (Sea Legs).

---

## Batch slC2 (part): re-check of the `gij1` and `fix3-gij` slices

**Scope:** every item `docs/rules-batches/slC.md` marked Skipped in its `gij1` + `fix3-gij` part, plus the code half
of its one Partial (Adjustable Faceplate), re-checked against the engine sections "Engine features added 2026-10-04
(after the slice round)" and "(the bigger pieces)". The pieces checked were SkillSubstitution `scope: item`,
DialogSwitch `defaultWhen`, the new `check:` names, the `targeted` / `dealtDamage` / `defeatedEnemy` Triggers (and
`takesDamage`'s target), the item steps (`createItem`, `deleteItem`, `updateItem`, `spendQuantity`), `pick` with
`{choice.<key>}` and the `picked` tags, and `button`. Branch `rules/slC2-gij1`, from `rules/slB2` at 7aae53e4.

| Verdict (re-checked items) | Items |
|---|---|
| Convert (now fully rules) | 1 (Adjustable Faceplate, was Partial) |
| Partial | 0 |
| Still skip | 20 |
| Re-checked | 21 |

Pack Attack's ↑1 (fix3-gij, not in the `ID` table) was looked at again too. It is still a skip and is not counted.

This part added 1 rule to 1 pack item. After it, `scripts/check-rules.mjs` counts 1547 rules on 1060 items (slB2
left 1546 on 1060), with 0 errors and 0 warnings. ESLint is clean and jest passes (503 suites; 9636 passed, 2
skipped). No slice file became empty.

### Converted (1)

| Item | Rule | Why it is exact |
|---|---|---|
| Adjustable Faceplate (the Use half; slC already made its Defense half rules) | A Use labelled "Set the faceplate" with no cost and no limit. It runs a `choose` with two options. "Closed (+1 Toughness)" runs `updateItem {item: self, set: {"flags.essence20.gij1Faceplate": "closed"}}` and then a `chat` line. "Open (+1 Evasion)" does the same with `"open"`. | The old Use asked `chooseButtons` (closed / open) and wrote `flags.essence20.gij1Faceplate` on the upgrade itself, with no cost, limit or `canUse`. `updateItem` with `item: self` writes the same flag on the same item. A string that doesn't start with a digit, `@` or `(` is stored as it is. So the existing Defense rules (`rule:data:flags.essence20.gij1Faceplate=open`) read it unchanged, and copies set under the old code keep their setting. A cancelled dialog makes `choose` stop the run with nothing in chat, so no card is posted and nothing changes, as before. Removed: the `gij1Faceplate` `registerUse`, `FACEPLATE_FLAG`, `G1.adjustableFaceplate`, and the four `G1Faceplate*` strings in `lang/en.json`. The old Use had no slice test. The new test is in `conversions-uses.test.js`. |

### Behaviour differences

1. **Adjustable Faceplate on unequipped armor (same-line).** Rule Use buttons are offered only while their item is
   active (`rules/index.mjs#isItemActive`: an upgrade that is loose or on an equipped host). The old button also
   showed while the host armor was unequipped, so the faceplate could be preset then. The +1 never applied while the
   armor was unequipped, so only that preset is lost. slB2 accepted the same thing for the tf3 gear Triggers.
2. **Adjustable Faceplate wording (same-line).** The prompt, button labels and chat line are now the rule's own
   unlocalized text: "Set the faceplate:", "Closed (+1 Toughness)" / "Open (+1 Evasion)", "{name} closes / opens the
   faceplate." The card's title line is now "Adjustable Faceplate: Set the faceplate". Before, the card read
   "{name} sets their faceplate: {setting}."

### Still skipped (20)

#### gij1: gear (`gear.mjs`)

- **Anonymous.** Still needs a tag that reads the attacker's per-target records keyed by the wearer's uuid
  (`outwittedTargets[<uuid>]`, `analyzeTargetCounts[<uuid>]`). `target:data:` paths can't include the other party's
  uuid, and `picked` / `{choice}` only read the rule item's own picks.
- **Ceremonial.** Still needs a bonus that lasts the turn in combat without being used up, but is used up by the next
  Persuasion test out of combat and ends with the scene. No new piece adds that timing. `setToggle` / `mark` with
  `until: endOfTurn` has no expiry out of combat, and nothing is used up by a roll.
- **Uniform.** Still needs a switch offered from the target's worn items, with a count of the target's allies who wear
  the same upgrade. `pick {from: target}` and the `picked` tags don't count items on other actors.
- **Recoil Brace.** The item steps can now write to an item, but `item` can't name the upgrade's host weapon (no
  `host` selector). `updateItem` can't write a combat-turn stamp. And nothing caps `derivedHands` while that stamp
  holds. *Still needs:* a `host` item selector, an item mark with expiry (`until: endOfTurn`, or the scene out of
  combat), and an ItemModifier `min` that is live only while that mark holds.

#### gij1: Perks (`perks.mjs`)

- **Cybernetic Part, Enhanced Part, Optimized Part, Engrafted Mutation, Evolving Mutation, Outright Mutation (6).**
  `createItem` / `pickGrant` still don't go through `alteration-handler.mjs#onAlterationDrop`. They can't leave out
  owned Alterations or Beast Mode copies, and can't set the `cyberneticAlteration` / `geneticAlteration` flag on the
  pick. *Still needs:* Alteration-aware granting with a "not already owned" filter.
- **Metier.** `pick {from: list}` could store the five-way choice, and `updateItem {item: self}` could set a name. But
  `set` takes a literal or a formula, so it can't build "<name> (<choice>)". And there's still no boolean DerivedStat
  write and no "undo the Assassin Origin's poison-training step". Old picks live in `flags.essence20.gij1Choice`,
  which `pick` doesn't read. *Still needs:* a rename with interpolation, boolean derived writes, an effect-step undo,
  and moving old picks into `rules.choices`.
- **Extract Poison.** Still needs a roll whose DIF comes from the picked compendium entry's Availability, and boolean
  DerivedStat writes for "Qualified (and Trained) in all poisons".
- **Sea Legs.** Still needs a Movement / DerivedStat stage where the old hook runs: after gravity, before the other
  slices' derived hooks.
- **Improvise Bomb.** Still needs a compendium pick with a code filter (bomb / grenade), a roll against the picked
  entry's Availability DIF, a second copy on a crit, and a cost that depends on another Perk.
- **Demolition Artist.** Only lowers Improvise Bomb's cost, so it goes with it.
- **Primal Fear.** `choose` → `roll {difDefense}` and `target` could now cover the Use. But the mark's expiry is still
  wrong. The old mark lasts the current turn in combat, or until the scene changes out of combat (and stops counting
  once a combat exists). `until: endOfTurn` has no expiry out of combat. The "once per turn" limit out of combat
  (`hasUsedThisTurn`) has no rule equivalent either. *Still needs:* "this turn, else the scene" expiry for marks and
  limits.
- **Feed On Fear.** Only changes Primal Fear's success (heal 1 instead of the mark), so it goes with it.
- **Let It Rip.** `pick {from: ownedItem, itemType: weapon}` can't be narrowed to the four Signature Weapons. And the
  item mark with expiry and the `derivedHands` cap are missing, as for Recoil Brace. *Still needs:* those, plus a
  `pick` filter on the owned item's book source.
- **Scavenger.** Still needs a pick of the type and then a compendium entry, a Requisition roll one Availability step
  harder than the picked entry, and a grant override that appends Temperamental to the picked copy's traits.

#### fix3-gij (`gij-fixes.mjs`)

- **Angry (Hang-Up).** Still needs a tag comparing the rolled Skill with a value on the actor
  (`flags.essence20.angryHangUpSnag.skill`, a scene-window record from `helpers/angry.mjs`). `skill:{choice.<key>}`
  reads only the rule item's own picks.
- **Pack Attack (not in the id table).** Its records are written by `helpers/pack-attack.mjs` from the Growl bank, not
  by a rule. The expiry is "until the start of the user's next turn, else the scene". `mark {until: nextTurn}` has no
  expiry out of combat, and the ally's attacks would have to read a mark set by someone else against a named target.
  Still a skip.

### Engine pieces the remaining skips need

- **"This turn, else the scene" expiry** for marks, toggles and limits, plus a bank used up only out of combat:
  Ceremonial, Primal Fear (+ Feed On Fear), Pack Attack.
- **Item marks with expiry plus a `host` item selector**, read by an ItemModifier `min` on `derivedHands`: Recoil Brace,
  Let It Rip (which also needs a `pick` filter by book source).
- **Rolls with a DIF from a picked compendium entry** (Availability, stepped, crit copies): Improvise Bomb + Demolition
  Artist, Extract Poison, Scavenger.
- **Alteration-aware granting** through `onAlterationDrop`, leaving out owned ones: the six Alteration Perks.
- **A derived stage at the hand-written hooks' place:** Sea Legs.
- **Tags over the other party's per-target records** and over actor-stored Skills: Anonymous, Angry.
- **Item counts on the target and its allies**, in a switch: Uniform.
- **Boolean DerivedStat writes, a renaming `updateItem`, effect-step undo:** Metier, Extract Poison.

### Files touched outside the slices

- `packs/ccitems/_source/Adjustable_Faceplate_kEJP9jn7Q0LLufmG.json`: one Use rule line added to the existing `rules`
  array (text insertion, LF kept).
- `lang/en.json`: `G1FaceplatePrompt`, `G1FaceplateClosed`, `G1FaceplateOpen` and `G1FaceplateSet` removed (four lines,
  LF kept).
- `module/rules/conversions-uses.test.js`: one `// slC2 gij1` block appended at the end. The import line is unchanged.

---

## Batch slC2 (part gij2): re-check of the `gij2` slice skips against the 2026-10-04 engine pieces

**Scope:** every item `docs/rules-batches/slC.md` marked Skipped for the `gij2` slice
(`module/helpers/extensions/gij2/`). slC had no gij2 Partials. Each one was re-checked against the guide's sections
"Engine features added 2026-10-04 (after the slice round)" and "(the bigger pieces)": SkillSubstitution `scope: item`,
DialogSwitch `defaultWhen`, the new `check:` names, the `targeted` / `dealtDamage` / `defeatedEnemy` Triggers (and the
damage dealer as `takesDamage`'s target), the item steps (`createItem` / `deleteItem` / `updateItem` /
`spendQuantity`), `pick` with `{choice.<key>}` / `picked:` tags, and the `button` step. The four reference-only
entries (Impenetrable Shield, Inspiration, Aegis, The Beat Goes On) still stay with the code that reads them.
Branch `rules/slC2-gij2`, from `rules/slB2` at 7aae53e4.

| Verdict (re-checked items) | Items |
|---|---|
| Convert (now fully rules) | 1 (Machinesmith) |
| Partial (was a skip) | 0 |
| Still skip | 14 |
| Re-checked | 15 |

This part added 1 rule to 1 pack item. After it, `scripts/check-rules.mjs` counts 1547 rules on 1061 items (the base
was 1546 on 1060), with 0 errors and 0 warnings. No slice file became empty.

#### Converted (1)

| Item | Rule | Why it is exact |
|---|---|---|
| Machinesmith | RollModifier `upshift: 6`, `when: ["item:type:weaponEffect", {"any": ["item:damageType:emp", "weapon:trait:electromagnetic"]}, "target:data:system", "not:target:data:system.traits.computerized", "not:target:check:computerizedGear"]` (no label, so the source reads "Machinesmith" as before) | The old `machinesmithSources` was an extension roll source (`extRollSources`, run from `target-riders.mjs#rollRiderSources`). `ruleRollSources` is registered the same way, so it gets the same actor, target and roll context, and the ↑6 lands in the same pass. The conditions match one for one. The rolled item is a weapon effect. The effect's `system.damageType` is `emp` (`item:damageType` falls back to the item's damage type, and `rollRiderSources` passes no `damageType`), or its weapon's traits list `electromagnetic` (`weapon:trait:`). There is a target (`target:data:system`, the same "has a target" tag Goin' Heels uses). The target's `system.traits.computerized` is falsy. `check:computerizedGear` is `other1/cobra-gear.mjs#hasComputerizedGear`, the same helper the old code called, asked of the target. Every tag answers true or false, never unknown, so the rule is never offered as a switch. `G2.machinesmith`, `machinesmithSources` with its `registerRollSources` call, the now-unused `registerRollSources` and `hasComputerizedGear` imports in `perks.mjs`, and its `gij2.test.js` test are removed. |

#### Behaviour differences

1. **Machinesmith on a vehicle's weapon (same-line, edge case).** The old code looked the weapon up among the
   roller's own items. So when a crew member fired a vehicle's or Zord's weapon effect, it never found the weapon,
   and only an `emp` damage type counted. `weapon:` reads the weapon from the effect's own parent (the vehicle). A
   Tinkerer firing a vehicle weapon with the Electromagnetic trait but a non-`emp` effect now gets the ↑6 too. Own
   weapons behave the same as before.
2. **Source id (cosmetic).** The dialog's source id is now the rule's id instead of `ext-gij2Machinesmith`. The label
   and the numbers are unchanged.

#### Still skipped (14)

- **Artillery Support.** `button` now gives the "Bring it in" card a button, but nothing else changed. *Still
  needs:* a canvas-point / area recipient, the stored call fired at the caller's next turn start (delayed steps), one
  Targeting roll per token in the radius against each one's own Defense, and per-token damage packets (hit / defended,
  HEAT's splash).
- **Castling.** *Still needs:* a temporary-Health heal that also raises `system.health.value` uncapped (`heal
  {temporary}` raises only `health.bonus`). The move note on the `banked-buffs.mjs` card goes with that Use.
- **Energy Resistant.** `pick {from: list}` could store the Element, and a `legacy-choices.mjs` entry could move
  `gij2Element`. *Still needs:* a DerivedStat / Resistance rule whose path takes `{choice.x}` and sets a boolean (the
  old code sets `system.resistances.<element> = true` while the host armor is worn). Paths are not interpolated, and
  `writeNumber` writes numbers.
- **Expert Knowledge.** `pick {from: list}` of Smarts Skills plus `skill:{choice.skill}` would select the rolls.
  *Still needs:* a Trigger outcome "success but not double/crit" (or a count placeholder in `chat`), because
  `success` also matches `double` and `crit`. `x2` / `anyFailed` / `allFailed` / `fumbled` don't help. Also, a
  Fumble whose results include a success gives outcome `fumble` (the old code posted 1). It also needs the pick to
  run when the item is added (an `added` Trigger could do this) and a legacy-choice entry for `gij2ExpertSkill`.
- **Fearsome Presence.** *Still needs:* a post-roll per-target cap (the first three successes, within 20 ft) that
  removes the Frightened `dice.mjs` already applied, and a mark that removes a Condition from the marked actors at
  the holder's next turn start. The pre-roll warning also needs a pre-roll notice step.
- **Martial Artist.** *Still needs:* a chat step with comparison placeholders (Threat Level, Toughness, Evasion:
  superior / equal / inferior) and whisper recipients (the user and the GMs).
- **Mentor.** *Still needs:* a DerivedStat path with `{choice.x}` that sets a boolean
  (`system.skills.<skill>.essences.<essence>`), an Essence pick that leaves out the picked Skill's own Essence (`pick`
  has no dependent options), and a legacy-choice entry for `gij2Mentor`.
- **Nose For Trouble.** *Still needs:* a confirmable swap that changes the rolled Skill and its Essence and clears
  `isSpecialized`. A DialogSwitch `useSkill` only adds the shift difference and keeps rolling Alertness. Its
  `when` can't say "Streetwise is the better die" either.
- **Peerless Pilot (disembark).** *Still needs:* a rule type read by `vehicle-defeat.mjs#autoPassesDisembark`
  ("passes the emergency disembark automatically"), with `vehicle:driving`.
- **Personal Shield.** *Still needs:* a pre-toggle veto on a Role Points toggle, a 10-round expiry, a step that
  switches a Role Points item off, and an EMP short-out that is aware of Impenetrable Shield. `button` could carry
  the Technology repair (DIF 12 + half level), but the rest blocks it.
- **Plan of Action.** `button` can post the Split card. *Still needs:* a step that moves part of one ally's pending
  ↑N (`pendingPlanOfAction`) to another ally (an edit of another actor's banked bonus), and a hidden-when check
  (Inspiration) for the button.
- **Queen's Gambit.** `button` can make the offer. *Still needs:* a Trigger when any same-disposition combatant takes
  damage. `takesDamage` fires only on the damaged actor's own rules, and the linked scopes count Party / aura
  allies rather than combat disposition. It also needs an initiative-reorder step (just after the current turn,
  relayed to the GM).
- **Reckless Abandon.** *Still needs:* a pre-use veto for kits (`kits.mjs#runKitUse`), a 10-round expiry on a Role
  Points toggle, a "no enemy token on the scene" tag, and a Role Points switch-off step on Defeat (not with Aegis or
  The Beat Goes On).
- **Roll Cage.** *Still needs:* a vehicle-defeat crew-damage hook, such as a `crew`-scoped `taken` DamageModifier
  with "the vehicle is crashing / exploding" tags.

#### Engine pieces the remaining skips need

- **Role Points toggle lifecycle:** pre-toggle / pre-use vetoes, round-count expiry, a switch-off step (Personal
  Shield, Reckless Abandon).
- **Choice plumbing:** DerivedStat paths with `{choice.x}` that can set booleans, dependent `pick` options, and
  legacy-choice entries for `gij2ExpertSkill` / `gij2Mentor` / `gij2Element` (Expert Knowledge, Mentor, Energy
  Resistant).
- **Trigger outcome "success, not double"** or a count placeholder (Expert Knowledge).
- **Trigger on an ally's damage by disposition** and an **initiative-reorder step** (Queen's Gambit).
- **Steps:** temporary Health that also raises the value (Castling), editing another actor's banked bonus (Plan of
  Action), a comparison chat with whisper (Martial Artist), a canvas-point / area recipient with delayed steps
  (Artillery Support).
- **Other:** a confirmable Skill swap that clears the Specialization (Nose For Trouble), an auto-pass disembark rule
  (Peerless Pilot), vehicle-defeat crew damage (Roll Cage), and a post-roll per-target cap plus a Condition-lifting
  mark (Fearsome Presence).

#### Files touched outside the slice

- `packs/gijcrbitems/_source/Machinesmith_101HiYiWfoxoO1hL.json`: new `rules` (LF, inserted as text).
- `module/rules/conversions.test.js`: one `describe('slC2 gij2')` block appended at the end, under a `// slC2 gij2`
  header. It registers `check:computerizedGear` with the real `hasComputerizedGear` in its own `beforeAll`. The import
  line is unchanged.

In the slice: `shared.mjs` lost `machinesmith`. `perks.mjs` lost the Machinesmith roll source and the
`registerRollSources` / `hasComputerizedGear` imports. `gij2.test.js` lost the Machinesmith test. No `lang/en.json`
strings were used by Machinesmith, so none were removed.

---

## Batch slC2, slice gij3: re-check of `module/helpers/extensions/gij3/` against the 2026-10-04 engine pieces

**Scope:** every gij3 item `docs/rules-batches/slC.md` marked Skipped (18; gij3 had no Partial items), re-checked
against the engine sections "Engine features added 2026-10-04 (after the slice round)" and "(the bigger pieces)":
SkillSubstitution `scope: item`, DialogSwitch `defaultWhen`, the new `check:` names, the `targeted` / `dealtDamage` /
`defeatedEnemy` Triggers (and `takesDamage`'s target), the item steps (`createItem` / `deleteItem` / `updateItem` /
`spendQuantity`), `pick` with `{choice.<key>}` / `item:picked` / `self|target:picked`, and `button`. For the three
items whose other half was already a rule from an earlier round (Second Skin, Seconds Between Click & Boom, Takedown
Expert), the code half was re-checked. Branch `rules/slC2-gij3`, from `rules/slB2` at 7aae53e4.

| Verdict (re-checked items) | Items |
|---|---|
| Convert (now fully rules) | 1 |
| Partial (was a skip) | 0 |
| Still skip | 17 |
| Re-checked | **18** |

This part added 2 rules to 1 pack item. After it, `scripts/check-rules.mjs` counts 1548 rules on 1061 items
(`rules/slB2` had 1546 on 1060), with 0 errors and 0 warnings. ESLint is clean and jest passes (503 suites; 9629
passed, 2 skipped). No gij3 file became empty.

#### Converted (1)

| Item | Rules | Why it is exact |
|---|---|---|
| Stalk (`packs/gijcrbitems/_source/Stalk_BOuJREcROMkMjbM1.json`) | RollModifier `edge: true`, `when: ["skill:infiltration", "not:check:outsideEnvironmentOfExpertise", "not:roll:initiative"]`; ConditionImmunity `conditions: ["surprised"]`, `when: ["not:check:outsideEnvironmentOfExpertise"]` | slC's skip named exactly this missing piece, and `check:outsideEnvironmentOfExpertise` (essence20.mjs) now calls `environmental-expertise.mjs#isKnownOutsideEnvironmentOfExpertise`, the same function both old halves called. It always returns a boolean, so `not:` never turns unknown. **Edge:** the old `gij3RollSources` entry added an Edge source when the rolled Skill was Infiltration and the actor was not known to be outside its environment of expertise. `ruleRollSources` is itself registered as an extension roll source, so the rule's source reaches exactly the same rolls through the same `extRollSources` call in `target-riders.mjs`. `skill:` reads the same `ctx.rolledSkill`. The one path where the two differ is Initiative: `dice.mjs#prepareInitiativeRoll` calls `ruleRollSources` directly but never calls extension roll sources. `not:roll:initiative` keeps the old "never on Initiative" (that tag is always a boolean, unlike `roll:dataset:isInitiative`, which is unknown when the ctx has no dataset). **Surprised immunity:** the old `condition-immunity.mjs` table entry was `actorHasPerk(Stalk) && !isKnownOutsideEnvironmentOfExpertise(actor)`. `isImmuneToCondition` asks `ruleConditionImmune` right after the table, with the same `self`. |

Removed: `G3.stalk`, the Stalk block in `gij3RollSources` (and its now-unused `rolledSkill` destructure), the
`deps` object and `loadDeps()` (Stalk was their only user) with its `setup`-hook call, the Stalk test in
`gij3.test.js` (and its `deps` lines), the Stalk entry in `condition-immunity.mjs`'s `CONDITION_IMMUNITY_PERKS` plus
its now-unused `isKnownOutsideEnvironmentOfExpertise` import, and the Stalk `describe` in
`condition-immunity.test.js`. The new tests are the `slC2 gij3` block at the end of `module/rules/conversions.test.js`.
They load the pack item and use the real `isKnownOutsideEnvironmentOfExpertise` on the old test's terrain set-up
(untagged, in, out, out but covered by the Adaptation flag), plus Initiative and other Skills.

#### Partial (0)

None.

#### Behaviour differences

All of these are same-line (Stalk itself):

1. **Source label and id.** The Roll Options Dialog source was labelled with the item's name ("Stalk"). It now reads
   "Environment of expertise (Stalk: Edge)" (the item's automation notes still say "labelled Stalk"). Its source id
   changes from `ext-gij3Stalk` to the rule's id, so a source the player had switched off isn't remembered as off.
2. **Rule per copy.** An actor with two copies of Stalk lists two Edge sources (still one Edge) and has two immunity
   rules (still one immunity).
3. **Old copies.** Copies made before the conversion read the rules from the pack item through `rules/inherit.mjs`
   (by `flags.core.sourceId` / `rulesSource`), the same way every earlier conversion relies on.

No cross-line difference. Stalk's Surprised immunity already showed up in `isImmuneToCondition`, so Iron Bravado's
share (Power Rangers) sees the same answer as before.

#### Still skipped (17)

- **Second Skin** (the code half: the pre-roll Skill picker). Before a Requisition Test on Athletics or Acrobatics,
  the player picks between the rolled Skill, Technology or Science, and the Skill **and** Essence change.
  SkillSubstitution can now change the Skill and Essence before the roll, but only automatically (`replace` or
  `bestOf`), never by asking. A `pick` step lives in Uses/Triggers, not in a pre-roll rule, and a remembered
  `{choice.<key>}` would stop it asking on every roll. *Still missing:* an asked SkillSubstitution, e.g. `mode: "ask"`
  with `to: [...]`, offered as a chooser before the dialog.
- **Subtle Snake.** A three-way select (none / ↓1 / Snag). Nothing new covers it. *Still missing:* a DialogSwitch
  select, or a mutually-exclusive group of unlike effects.
- **Pillage.** The two-handed switch could now be a DialogSwitch with a `key` read by a `hit` Trigger
  (`roll:switch:<key>`). But the hit half calls `target-riders.mjs#disarm` (a held, non-integrated weapon, `maxHands`
  1 or 2, the disarmed flag), then asks take-or-drop and moves the item to the attacker. `pick from: ownedItem` and
  the item steps' `item` selectors only see the actor's own items or name/type/source matches, not "the weapon this
  target holds". *Still missing:* a `disarm` step (with `maxHands`) and a step that moves a target's item to the actor
  (copy unequipped, delete the original).
- **Junker.** It adds a requisition attempt on the Party actor (through the GM relay) and banks an Edge, once per
  mission. The Edge alone fits a `bank` step and the `mission` limit exists, but `updateItem` acts on items and no
  step recipient reaches the Party actor (splitting the one button between code and a rule would make two buttons).
  *Still missing:* a `party` recipient for `gainResource` (`system.requisition.attempts`).
- **Targeting Eye.** No new piece touches it. *Still missing:* `until: "endOfNextTurn"` on a mark (only `nextTurn`
  and `endOfNextRound` exist), and an ItemModifier that doubles weapon-effect ranges, skips weapons with a Scope
  upgrade and records `upgradeTouched`.
- **The Sound of Angels.** A `button` card or `pickAlly {within: 50}` could pick the allies. But each picked ally costs
  the attacker one Free action (stopping when blocked), and each gets Lend Assistance's `pendingLendAssistanceEdge`
  flag aimed at the attack's target. The weapon test (explosive, an aerial vehicle's weapon, or a two-handed ballistic
  weapon) has no tag either. *Still missing:* a per-recipient action cost, a step that grants Lend Assistance's
  benefit against the hit target, and a weapon tag for those weapons.
- **Dreadnok Recruit.** *Still missing:* a scene-token name tag (any non-PC token on the scene named "Dreadnok", not
  within a range), and a turn-start step that spends the holder's own Free action.
- **Touch Move.** On `updateCombatant` the active GM posts which un-surprised same-disposition combatants may move.
  *Still missing:* an `initiativeRolled` recipient (or chat token) for "every un-surprised ally in the combat",
  posted GM-side once per combatant.
- **Early Adopter.** The new `button` step posts **one** button, works once (or for anyone, with `once: false`), and
  runs as `user.character` with `runAs: clicker`. The old card has one button per Party member (or player-owned PC),
  only that ally's owner may press it, and each ally gets one pick per mission. The pick is a weapon / armor upgrade /
  Kit choice followed by a filtered `pickAndGrant`; `pickGrant` `tags` could filter on `item:data:system.type=weapon`
  or `item:data:system.gearType=kits`. `requisition.mjs`'s Prototype/Theoretical DIF −5 stays code either way.
  *Still missing:* per-recipient buttons (one per Party member, pressable by that member's owner), a per-presser
  `mission` limit, and a Requisition DIF rule.
- **Field Trials.** The same per-ally card. The granted Limited weapon upgrade also gets the Temperamental trait added
  to its trait list. `updateItem set` replaces a value and can't add to a list. *Still missing:* the same
  per-recipient buttons, and an "add to a list" option on `updateItem` (or `pickGrant`'s `system` overrides).
- **Peak Performance.** *Still missing:* a step that grants the base Role's highest-level Role Perks outright (not
  Old Hand, not Plan of Action). `pickPerk` always asks.
- **Technical Glitch, Some Assembly Required, Complete System Failure** (`disrupt.mjs`). The new pieces cover some of
  the parts: a `button` for the Reboot / Repair card, `updateItem` to unequip and flag, and a roll tag
  `item:data:flags.essence20.gij3Disrupted.csf` for the ↓2 and Snag. But the pick is over a **target's** Computerized
  items (or any equipment), the DIF is that item's availability DIF, Some Assembly Required saves an open-ended roll's
  total as the reboot DIF, and the Repair button is pressable only by the disruptor. *Still missing:* `pick` over a
  target's items, a roll step with a DIF read from the picked item, an open-ended roll whose total is stored, and a
  button `who` of "the rule's actor only" acting on another actor's item.
- **Better than the Best.** *Still missing:* a RollDice / outcome option that raises the multiplier on a natural 20
  on the kept d20 (miss → success, success → crit).
- **Seconds Between Click & Boom** (the code half: no miss effects on Evasion attacks). `targeted` with
  `outcome: failure` fires on the defender, but it can't stop the other miss effects (Trigger Happy, Explosive
  Aftershock, Wrecker Rough Terrain) that `dice.mjs` and `rough-terrain.mjs` apply. *Still missing:* an "ignore miss
  effects" rule type read by those call sites.
- **Takedown Expert** (the code half: the choice on a failed Takedown). `choose` + `applyCondition` would cover
  Immobilized / Silenced. *Still missing:* a Takedown-failed Trigger event (or a `roll:takedown` tag on `afterRoll`
  with the grappled target), the level gate against the target's Threat Level (`target:levelDiff` exists, but there's
  no event to hang it on), and a `disarm` step.

#### Engine pieces the remaining skips need

1. **Target-item steps:** a `disarm` step with `maxHands`, moving a target's item to the actor, and `pick` over a
   target's items (Pillage, Takedown Expert, the three Disruptor Perks).
2. **Per-recipient buttons:** one button per Party member, pressable by that member's owner, with a per-presser
   limit (Early Adopter, Field Trials). Also an "add to a list" option on `updateItem` (Field Trials) and a `party`
   recipient for `gainResource` (Junker).
3. **Roll-outcome hooks:** natural-20 success/crit (Better than the Best), "ignore miss effects" (Seconds Between Click
   & Boom), a Takedown-failed event (Takedown Expert).
4. **An asked SkillSubstitution** (Second Skin) and a DialogSwitch select (Subtle Snake).
5. **Others:** `until: "endOfNextTurn"` and a range-doubling ItemModifier (Targeting Eye); a scene-token name tag and
   a turn-start action spend (Dreadnok Recruit); a GM-side Initiative announcement to allies (Touch Move); a grant of a
   Role's top Perks (Peak Performance); a per-ally action cost and a Lend Assistance grant step (The Sound of Angels);
   an open-ended stored roll and an item-DIF roll (Disruptor Perks).

#### Files touched outside the slice

- `module/helpers/condition-immunity.mjs`: the Stalk table entry and the `isKnownOutsideEnvironmentOfExpertise`
  import removed; Stalk added to the comment listing the converted immunities.
- `module/helpers/condition-immunity.test.js`: the Stalk `describe` removed (it is replaced in conversions.test.js).
- `module/rules/conversions.test.js`: the `// slC2 gij3` block, appended at the end. No import change.
- Pack source: `packs/gijcrbitems/_source/Stalk_BOuJREcROMkMjbM1.json`.
- `lang/en.json`: unchanged (Stalk used no strings).

---

## Batch slC2, part sit1: re-check of the `situational1` slice

**Scope:** every item `docs/rules-batches/slC.md` (part sit1) left **Skipped** (21) or **Partial** (4) in
`module/helpers/extensions/situational1/`, re-checked against the 2026-10-04 engine pieces (SkillSubstitution
`scope: item`, DialogSwitch `defaultWhen`, the new `check:` names, Trigger events `targeted` / `dealtDamage` /
`defeatedEnemy`, `takesDamage`'s target, the item steps `createItem` / `deleteItem` / `updateItem` /
`spendQuantity`, `pick` with `{choice.<key>}` / `picked:` tags, and `button`). For a partial, only the half
that stayed code was re-checked. Branch `rules/slC2-sit1`, from `rules/slB2` at 7aae53e4.

| Verdict | Items |
|---|---|
| Convert | 1 (Diver) |
| Already converted upstream | 1 (City Slicker) |
| Partial (unchanged) | 4 |
| Still skip | 19 |
| Re-checked | **25** |

One rule was added to one pack item. After it, `scripts/check-rules.mjs` counts 1547 rules on 1060 items, with
0 errors and 0 warnings.

### Converted (1)

| Item | Rule | Removed |
|---|---|---|
| Diver (its Use; the Alertness ↑1 underwater was already a rule) | Use `limit: {per: mission, max: 1}`, steps `createItem` (the kit, from inline data) then `grant` Scuba Gear with `flags: {grantedBy: null}` | `S1.diver`, `S1.scubaGear`, `FLAG.diverKit`, the `s1-diver` Use entry, `E20.S1DiverKit` in `lang/en.json` |

Why it is exact:

- **The kit.** `kits.mjs#makeKit(actor, item, 'limited', 'athletics', 'Swimming')` creates one item: name
  "Limited Athletics (Swimming) Kit", type `gear`, `system: {gearType: 'kits', quantity: 1}`, flags
  `essence20.grantedBy = item.id` and `essence20.kit = {tier: limited, skill: athletics, spec: Swimming,
  essence: null}`. `createItem` writes the same data, and it sets `grantedBy` to the rule item's id itself.
- **Scuba Gear.** The old call was `grantCopy(actor, S1.scubaGear, {grantedBy: item.id})`. `grantCopy` reads
  `grantedBy.id`, and that is undefined on a string, so the old copy carried **no** `grantedBy`. The `grant` step
  would set it, so the rule overrides it with `flags: {grantedBy: null}`. Removing Diver still leaves the gear
  behind, as it did before. If that is an old bug rather than intent, delete the `flags` override.
  `grantCopy` stamps `flags.core.sourceId`, the `grant` step stamps `_stats.compendiumSource`, and both hold the
  same uuid. Every Scuba Gear reader (`environment-hazards.mjs#_isFrom`, `sourceOf`) checks both. Scuba Gear is
  `gear`, so neither path attaches any children.
- **Order and limit.** The kit is made first, then the gear, then the use is counted. That matches the old
  makeKit → grantCopy → markUsed order. The old `getUses(..., 'mission') < 1` / `markUsed({window: 'mission'})`
  and the rule limit both ride the Scene Clock's mission window. Neither costs an action.

### Already converted upstream (1)

- **City Slicker** (code toggle). The engine commit that added `defaultWhen` converted it as
  `when: ["skill:infiltration", "terrain:urban"], defaultWhen: ["terrain:urban"]`. Its slice toggle is gone (only a
  comment in `situationalToggles` remains). Nothing to do here.

### Partial (4, unchanged)

| Item | Still code | Why it still can't convert |
|---|---|---|
| Spacewalker | +5 Evasion in low or zero gravity | It still reads the environment with `includeInterior: false`. No tag or Defense rule reads the environment without the vessel interior. |
| Out of the Jungle | Light Armor counts as Silent (↑ equal to the summed bonuses of equipped non-Silent Light armor) on Infiltration | There is still no formula that sums over items. |
| Danger Sense | The Protected Target's Surprised immunity within 10 ft | `ruleConditionImmune` still builds its context without `holder`, so an aura ConditionImmunity with `holder:protects` reads the wrong actor. |
| Every Trick in the Book | Not a valid sneak-attack target (`sneak-attack.mjs`) | There is still no rule type for "can't be sneak-attacked". |

### Behaviour differences

1. **Diver chat (same-line).** The old Use posted one line ("{actor} gains a Limited Athletics (Swimming) kit and
   scuba gear for this mission."). The rule posts the engine's two "Granted" lines instead.
2. **Diver kit name in other languages (same-line, cosmetic).** `makeKit` localized the Skill name. The inline
   data says "Athletics" in English. Nothing else reads the name: the kit is identified by `flags.essence20.kit`.
3. **Diver's mission counter (same-line, one-time).** The rule limit counts under its own key, not `s1DiverKit`.
   An actor that already used Diver this mission before the update can use it once more this mission.
4. **Duplicate copies.** A Use rule counts per copy. Diver can't be taken twice (selectionLimit 1).

### Still skipped (19)

Each entry names what is **still** missing after the 2026-10-04 pieces.

- **Layered Armor.** Still needs a flat (non-shift) roll bonus on a RollModifier or DialogSwitch
  (`skillEffectModifierBonus`).
- **Environmental Warrior.** Still needs a tag that matches Survival Specialization names against the terrain's or
  environment's keywords. The untagged-scene switch could use `defaultWhen`, but the match itself has no tag.
- **Jungle Fighter.** Still needs a "terrain is set" tag, or a terrain tag that falls back to a toggle. `defaultWhen`
  doesn't help: the in-the-jungle state also drives MovementAction and `specialize`, which are not switches.
  Also needs a summed-armor formula for the Silent part.
- **Urban Jungle** (code in `dice.mjs`). It applies only when the terrain is known to be urban and stays off on an
  untagged scene. `terrain:urban` is unknown there, so a RollModifier would turn into a switch. Still needs the
  "terrain is set" tag.
- **Urban Adaptation.** Still needs a pool whose max follows a level table, and per-scene chosen abilities that the
  Edge, Specialized and Rough Terrain code reads. `pick` stores one value per key and asks every time.
- **Earth Defense Command Benefits.** Driving ↑2: `vehicle:moves:` still reads `base`, where the old code reads
  `total ?? base`. Space Kit: `pick {from: list}` has fixed options, so it can't list the actor's own Driving,
  Culture, Science and Technology Specializations. `createItem` data can't take the picked Skill or
  Specialization either: no `{choice}` in data.
- **Adapted Vehicles.** Still needs a `driven`-scope check of the driver's Environmental Expertise against the
  terrain under the vehicle.
- **Environmental Enforcer.** Still needs a multi-pick sized by a formula (Survival ranks); `pick` takes one value.
  Old choices also sit in `flags.essence20.s1Environments`, and there is no path to move them to `pick`'s storage.
- **Environmental Camouflage.** Still needs the host armor's bonuses in Defense formulas. The chosen terrain and the
  manual "in it" toggle sit in old flags (`s1Environment` / `s1InEnvironmentNow`), with no way to move them.
- **Weatherproof.** The penalty cancels could be host-scope RollModifiers gated on
  `rule:data:flags.essence20.rules.choices.<key>=<env>`, plus a `pick {from: list}` Use. But every existing copy
  stores its environment in `flags.essence20.s1Environment`, and `pick` can't read or move that. Converting would
  silently drop the choice on every copy in existing worlds. Earlier slA2 re-checks treated this case the same way.
  Needs the old-flag pick migration.
- **Weather Gear / Acclimating.** Still need a rule type read by `environment-hazards.mjs` (`ENVIRONMENT_PROTECTORS`).
  Weather Gear's choice is also in an old flag.
- **Fast Tracking.** `check:favoriteWeaponRolled` and `defaultWhen` would cover the switch, but its pre-tick is
  "looks like a Contingency" (in combat, not your turn, a contingency in your action ledger). There is still no tag
  or `check:` for that.
- **Misguide.** Still needs a mark that rough terrain reads (`ROUGH_TERRAIN_IMPOSERS`) and that lasts for the
  marked creature's current or next turn.
- **Ambush Master** (its Use). Still needs an "an enemy combatant has status X" tag. `bonusAttack` and a combat
  limit cover the rest.
- **Ghost.** Step-level `when` now gives conditional steps (`setToggle` and then `applyCondition` /
  `removeCondition` by the new state). But the hiding state lives on the actor (`flags.essence20.s1GhostHiding`), and
  Arashikage Shozoku's code reads it. `setToggle` stores on the item, so an actor hiding today would flip the wrong
  way. Needs an old-flag migration, or a toggle step that writes an actor flag.
- **Arashikage Shozoku.** A `takesDamage` Trigger can now remove Invisible, but the end-on-damage must leave Ghost's
  Invisible in place (it checks Ghost's flag). Also still missing: a Condition that lasts `until: nextTurn` and a
  worn-host gate on the Use.
- **Contort.** Still needs a Reach rule (or a `totalReach` ItemModifier with `until`) and a picker between two costs
  (Move or 2 Free).
- **Izuna Drop.** `button` now covers the GM damage card. Still missing: fall damage from an asked number into a
  `damage` step (min(20, feet/10)), damage overflow from the target's remaining Health back onto the faller, and a
  `roll` step on the better of two Skills against Toughness.

### Engine pieces the remaining skips need

- **A "terrain is set" tag** (or terrain tags that answer false instead of unknown): Jungle Fighter, Urban Jungle.
- **An old-flag pick migration** (read or move `flags.essence20.<old>` into `rules.choices`) and **a multi-pick**
  sized by a formula: Weatherproof, Weather Gear, Environmental Enforcer, Environmental Camouflage, Ghost's hiding
  state.
- **A rule type for hazard protection** (`ENVIRONMENT_PROTECTORS`) and **for rough-terrain imposers**: Weather Gear,
  Acclimating, Misguide.
- **`ruleConditionImmune` passing `holder`:** Danger Sense.
- **Formulas that sum over items:** Out of the Jungle / Jungle Fighter's Silent armor.
- **A flat roll bonus:** Layered Armor.
- **A Defense rule (or tag) reading the environment without the vessel interior:** Spacewalker.
- **Tags:** an enemy combatant with a status (Ambush Master), "contingency this round" (Fast Tracking),
  `vehicle:moves` on the total (Earth Defense Command), Specialization names against terrain keywords
  (Environmental Warrior), a driver's expertise against the vehicle's terrain (Adapted Vehicles).
- **Pick options from the actor's Specializations, and `{choice}` in `createItem` data:** Earth Defense Command's
  Space Kit.
- **Reach rules, alternative-cost pickers, Conditions with `until` that end on damage, damage overflow:** Contort,
  Arashikage Shozoku, Izuna Drop.

### Files touched outside the slices

- `packs/ghpfitems/_source/Diver_erZl8Udy03P7vHTe.json`: one Use rule appended after the existing RollModifier, so
  earlier rule indices don't move. Inserted as text, LF kept.
- `lang/en.json`: the line `E20.S1DiverKit` deleted, as text.
- `module/rules/conversions-uses.test.js`: one `describe('slC2 sit1')` block appended at the end. The import line
  is unchanged.

Inside the slice: `situational1.mjs` loses `S1.diver`, `S1.scubaGear`, `FLAG.diverKit` and the `s1-diver` Use.
`situational1.test.js` had no Diver test and is unchanged. No slice file became empty, so `extensions/index.mjs` is
unchanged.

---

## Batch slC2 (part sit2): re-check of the `situational2` extension slice

**Scope:** every item `docs/rules-batches/slC.md` marked Skipped or Partial for the `situational2` slice
(`module/helpers/extensions/situational2/`), re-checked against the 2026-10-04 engine pieces: the `targeted` /
`dealtDamage` / `defeatedEnemy` Triggers (and `takesDamage`'s target), the item steps (`createItem`, `deleteItem`,
`updateItem`, `spendQuantity`), `pick` with `{choice.<key>}` / `item:picked:` / `self|target:picked:`, `button`,
SkillSubstitution `scope: item`, DialogSwitch `defaultWhen`, and the new `check:` names. Round 1 left 21 skips and
1 partial (Feet Wet) for situational2. Branch `rules/slC2-sit2`, from `rules/slB2` at 7aae53e4.

| Verdict (over the 22 re-checked items) | Items |
|---|---|
| Convert | 0 |
| Partial | 1 (Feet Wet, unchanged from round 1) |
| Still skip | 21 |

No rules were added and no code was removed. `scripts/check-rules.mjs` still counts 1546 rules on 1060 items, with
0 errors and 0 warnings. The `S2` table, `extensions/index.mjs`, the slice's test file and the conversion test files
are unchanged.

The new pieces cover chat buttons, Triggers on being attacked, and stored picks. That still isn't enough for
situational2. Almost every item here depends on where the token is: swimming, aboard an aquatic vessel, the
environment without the vessel interior, scene darkness, a surveyed scene, or terrain known to be unset. None of
those has a tag yet. The three items the new pieces get close to (Caltrops, Forgiving, Take in a Scene) each still
lack one piece. Those pieces are listed below.

#### Converted (0)

None.

#### Partial (1)

| Item | Converted (round 1) | Still code |
|---|---|---|
| Feet Wet | MovementAction `ignoreRoughTerrain`, `when: ["terrain:sea"]` (the old `rough-terrain.mjs` entry) | `isFeetWetActive`: sea, aboard an aquatic vessel, or wetlands with Ship Shape, for Rough Terrain, the non-combat Edge and the Specialized attacks. Still needs the "aboard an aquatic vessel" tag (see Ship Shape). |

#### Behaviour differences

None. Nothing changed in this part, so there are no new same-line or cross-line differences. Round 1's two Feet
Wet notes (duplicate copies, other printings) still apply.

**Pre-existing issue, still open:** Bookworm takes ↓2 on Initiative in a library scene. Its pack RollModifier gives
↓1, and `initiative.mjs#situationalInitiative` adds another ↓1. The Initiative half still can't convert (see below),
so this part leaves it as it is.

#### Still skipped (21)

##### Clothing and gear

- **Arctic Expedition Clothes, Desert Expedition Clothes, Desert Gear.** Nothing new reaches these. *Still needs:*
  (a) an `environment:` tag without the vessel-interior lookup (the tag still reads `getEnvironment(actor)` with the
  interior; the slice reads `{includeInterior: false}`); (b) re-preparing actors when their token's Regions change,
  for static rules that read `terrain:` / `environment:`; (c) per-attack additive Defense applied after the
  best/halve reshaping.
- **Business.** *Still needs:* a creature-tag prefix test (`target:tag:` is still an exact match, and the old code
  matches any tag *starting* with `strex`, or `strex` in the name). It also has the Defense-ordering issue (c).
- **Tracking Outfit (Initiative half).** `defaultWhen` only decides whether a switch starts ticked. With no terrain
  set, `terrain:wild` is still unknown, so a rule would offer an Initiative switch where the old code gives nothing.
  *Still needs:* a terrain tag that answers false when no terrain is set.
- **Caltrops.** `button {who: "anyone", runAs: "clicker", once: false}` could post the card, and a `roll` step can
  roll DIF 15 Acrobatics. *Still needs:* (a) an Essence-damage step for `onFail` (the old code calls
  `environment-hazards.mjs#applyEssenceDamage(actor, ["speed"])`, and no step reaches it); (b) the presser's
  actor resolved the old way. The old code takes the presser's controlled token's actor first, then
  `user.character`. `runAs: clicker` takes only `user.character`, or the holder for a GM without a character.
- **Tritium Sights / Rifle (Tritium Sight).** *Still needs:* a scene-darkness tag (true at darkness ≥ 0.95, else
  unknown) and a roll-time "the rolled weapon has upgrade X attached, or is this weapon" tag. `item:picked:` only
  matches a stored pick, not an attached upgrade.

##### Water and the sea

- **Seafarer (Swimming half).** *Still needs:* a "token is swimming" tag (`tokenDoc.movementAction == "swim"`) and
  the interior-free `environment:` tag, combined as an OR.
- **Seafarer (Hang-Up).** *Still needs:* the swim and "aboard an aquatic vessel" tags for "on land", and a tag that
  reads a save rider's spec (`dataset.riderSpec`: poison damage, the `poisoned` status, the title pattern).
- **Amphibious Assault (Initiative half).** *Still needs:* the same swim and environment tags.
- **Shark's Fin.** `initiativeRolled` + `removeCondition` could now lift Surprise, but the situation (sea or
  wetlands terrain, or aboard an aquatic vessel) has no tag. *Still needs:* an "aboard an aquatic vessel" tag that
  matches `common.mjs#isAboardAquaticVessel` (vehicle actors only, swim base or total), an OR across terrains, a
  derived stage after gravity, and the Region refresh.
- **Ship Shape.** *Still needs:* the "aboard an aquatic vessel" tag and a `driven`-scope Movement multiply at the
  old derived-time position.
- **Feet Wet (the rest).** See Partial.

##### Situations from chat, flags and Surprise

- **Competitive.** `targeted` fires only on the creature a roll was made against. *Still needs:* a Trigger on
  allies' Skill Tests, with a comparison against this actor's last result in the scene.
- **Forgiving.** A `targeted` Trigger could now mark the aggressor (`mark` to `target`), and `skill:choiceOf:` with
  Empathy's uuid would match the chosen Skill. *Still needs:* (a) a mark that the roll using it removes (the old
  code clears that aggressor's entry when the Edge is applied; a RollModifier has no steps, and afterRoll Triggers
  don't see the roll's target); (b) marks from several setters under one key (`mark` keeps one `by`, so two Forgiving
  holders attacked by the same creature would overwrite each other); (c) the old "aggressive" test (weapon attack,
  any `rider.style`, or Intimidation) as tags on `targeted`.
- **Take in a Scene.** `button {who: "gm"}` now covers the GM's ruling card. *Still needs:* a DIF from chat history
  (the lowest opposing Infiltration total in the last 30 minutes, +1) and the roll-then-branch on it.
- **Misplaced Confidence.** *Still needs:* Take in a Scene converted with it, and a Condition held through a set
  round.

##### Other

- **Cartography Suite.** `pick` stores a choice from a fixed set. It can't store "the current scene". *Still
  needs:* a scene-tied flag tag ("surveyed here") and an ally-aura derived Move-action count.
- **Lay of the Land (Rough Terrain half).** *Still needs:* the same scene-survey tag.
- **Plow.** *Still needs:* a Multiple Targets grant rule type (the slice pushes onto
  `multiple-targets.mjs#MULTIPLE_TARGETS_GRANTS`), also for a driven vehicle, and a this-turn mark read by
  MovementAction.
- **Bookworm (Initiative half).** *Still needs:* a "a hostile combatant matches target: tags" tag. Without it the
  Librarian-combatant case would turn from automatic into a switch.

#### Engine pieces the remaining skips need

1. **Where the token is:** a swimming tag, an `environment:` variant without the vessel interior, a scene-darkness
   tag, an "aboard an aquatic vessel" tag matching the slice's lookup, and a terrain tag that answers false when
   unset (Tracking Outfit, the clothes, Seafarer x2, Amphibious Assault, Shark's Fin, Ship Shape, Feet Wet, Tritium).
2. **Refresh** of actors with `terrain:` / `environment:` static rules when token Regions change.
3. **Defense ordering:** per-attack additive Defense after best/halve (the clothes, Business).
4. **Tags:** creature-tag prefix (Business), save-rider spec (Seafarer Hang-Up), "weapon has upgrade X attached"
   (Tritium), "hostile combatant matches" (Bookworm), scene survey (Cartography Suite, Lay of the Land).
5. **Steps / Triggers:** Essence damage (Caltrops), a mark removed by the roll that uses it plus multi-setter marks
   (Forgiving), Triggers on allies' rolls (Competitive), a DIF from chat history (Take in a Scene), a timed Condition
   hold (Misplaced Confidence), a Multiple Targets grant (Plow).
6. **Button `runAs`:** the presser's controlled token before `user.character` (Caltrops).

#### Files touched outside the slices

- `docs/rules-batches/slC2-sit2.md` (this file). Nothing else.
