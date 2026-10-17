# Batch slB2: re-check of slB (`tf1`, `tf2`, `tf3`, `fix3-tf`, `other2`) against the 2026-10-04 engine pieces

**Scope:** every item `docs/rules-batches/slB.md` marked Skipped, plus the code half of every item it marked Partial,
re-checked against the engine sections "Engine features added 2026-10-04 (after the slice round)" and "(the bigger
pieces)". The batch was done in four parts (`rules/slB2-tf1` for tf1 + fix3-tf, `rules/slB2-tf2`, `rules/slB2-tf3`,
`rules/slB2-other2`), all from `rules/slA2` at bc4a15ee, and merged into `rules/slB2`. Each part's full write-up
follows below.

| Verdict (re-checked items) | tf1 + fix3-tf | tf2 | tf3 | other2 | Total |
|---|---|---|---|---|---|
| Convert (now fully rules) | 1 | 1 | 0 | 0 | **2** |
| Partial (was a skip) | 0 | 0 | 3 | 2 | **5** |
| Partial, nothing more converts | 3 | 0 | 1 | 0 | **4** |
| Still skip | 24 | 20 | 18 | 24 | **86** |
| Re-checked | 28 | 21 | 22 | 26 | **97** |

12 rules were added to 7 pack items. After the merge, `scripts/check-rules.mjs` counts 1546 rules on 1060 items (slA2
left 1534 on 1056), with 0 errors and 0 warnings. ESLint is clean and jest passes (503 suites; 9635 passed, 2
skipped). The only merge conflicts were the parts' test blocks appended at the end of `conversions.test.js` and
`conversions-uses.test.js`; all are kept. No slice file became empty.

**What moved:**
- **Experiment (fix3-tf):** its "breaking free of a grapple" ↑1 is a DialogSwitch using `check:grappleEscape` - with
  slB's Shove ↑1, Experiment is now all rules.
- **Flexible Directives (tf2):** a once-per-scene Use running `pick {from: ownedItem, itemType: perk}`.
- **Rotor Blades, Tow Cable & Hook, Water Cannon (tf3), partial:** `transform` / `untransform` Triggers with
  `updateItem {item: granted}` stow and re-equip the weapon each gear grants (replacing `tf3/reactions.mjs`'s loop).
- **Proper Protection (other2), partial:** poison / disease immunity (DerivedStat) and Poisoned immunity
  (ConditionImmunity) behind `check:medicineKit`. The crit cure note stays code.
- **Junkplate (other2), partial:** a `targeted` / `fumbled` Trigger deals 1 Sharp to an unarmed attacker who Fumbles.
  The hit-time Blunt→Sharp stays code.

**Behaviour differences worth a decision** (every difference is in its part's section):
- **Flexible Directives:** the picker now also lists Flexible Directives itself (`pick` can't exclude the rule's own
  item), and an actor with no other Perks sees a one-entry picker where the old Use did nothing. Picking it only uses
  up the scene's use. A strict reading of the exactness rule could call this a skip.
- **Gear Triggers (tf3):** rules run only while their item is equipped, so an unequipped gear item no longer swaps its
  weapon on Convert (slB accepted the same for Fearsome Additions).
- **Junkplate:** each target wearing it now retaliates on a multi-target unarmed attack (before, only the first); an
  orphaned weapon effect no longer counts as unarmed; the retaliation runs after the other post-roll hooks.
- **Proper Protection, cross-line:** Iron Bravado (Power Rangers) shares every condition its user is immune to, so a
  holder with a medicine kit now shares Poisoned immunity with allies.
- **Wording:** Flexible Directives', Junkplate's and Proper Protection's messages are now the rules engine's, not the
  localized strings (5 `lang/en.json` keys removed).

**Engine pieces the remaining skips need** (most useful first; each part's list has the detail):
- **A `weapon:` tag for "granted by this rule's item"** (plus a rename option on `grant`): converts Rotor Blades' and
  Tow Cable's ↑1 and the shared gear weapon Use - still the smallest gap.
- **A "combat exists" tag** (started or not) and combat-scoped marks: Broad Understanding, Applied Science, Easy In
  Easy Out, Flexible Switch, Martyr, Right Of All Sentient Beings.
- **Mark durations and counters:** until the end of the marked creature's next turn, use-once marks, counters on marks,
  marks read by the marked actor's rolls or by every roller (Cage, Diversion, Covering Fire, Watchful Eyes, Loaded
  Questions, Steady Firepower, Laser Designator).
- **More Trigger events:** an ally's miss, any foe's roll, other tokens' movement, moving on one's own turn, another
  item being added, `targeted` limited to weapon attacks, the attacker on `defeated`.
- **Steps:** a roll with no DIF, push / forced movement, contested roll, Initiative reset, a full dialog roll with a
  picked Skill, re-attack the same target, transform into a picked Alt Mode, give a resource to another actor, act on
  another actor's items or records, delayed steps.
- **Picks:** `pick` excluding the rule's own item, over a target's items, over the compendium with filters, and moving
  old flags (`tf3Chosen`, `flags.essence20.partner`) into `rules.choices`.
- **Other:** pre-update vetoes (Rust Derivatives, Stasis Cuffs), a hit-time Blunt→Sharp override, incoming rules through
  the `driven` link, `host:` tags at roll time, a Defense "use instead" mode, dice in formulas, a late derived stage,
  `createItem` making a linked weapon + effect pair, a roll-cancel rule.

---

## Batch slB2 (part tf1): re-check of the `tf1` and `fix3-tf` slice skips

**Scope:** every item marked Skipped (24) or Partial (4) for the `tf1` and `fix3-tf` slices in
`docs/rules-batches/slB.md` ("Batch slB (part): the `tf1` and `fix3-tf` extension slices"), re-checked against the
2026-10-04 engine pieces in `docs/RULES_CONVERSION_GUIDE.md`. Those pieces are SkillSubstitution `scope: item`,
DialogSwitch `defaultWhen`, the new `check:` names, the `targeted` / `dealtDamage` / `defeatedEnemy` Triggers,
`takesDamage`'s target, the item steps (`createItem`, `deleteItem`, `updateItem`, `spendQuantity`), `pick` with
`{choice.<key>}` / `item:picked:` / `self|target:picked:`, and `button`. For the partials, only the half that
stayed code was re-checked. Branch `rules/slB2-tf1`, from `rules/slA2` at bc4a15ee.

| Verdict | Items |
|---|---|
| Convert | 1 |
| Partial | 0 |
| Still skip | 27 |
| Re-checked | 28 |

One rule was added to one pack item. After this part, `scripts/check-rules.mjs` counts 1535 rules on 1056 items
(the base was 1534 on 1056; Experiment already had rules), with 0 errors and 0 warnings.

#### Converted (1)

| Item | Rule | Why it is exact |
|---|---|---|
| Experiment (the rest of the partial: "breaking free of a grapple") | DialogSwitch ↑1, `default: true`, `forget: true`, `when: ["rule:data:system.choice=shove", "self:status:grappled", "not:item:type:weaponEffect", {any: [skill:acrobatics, athletics, brawn, finesse, might]}, "check:grappleEscape"]`. It is appended as rule 3, after the item's three existing rules, so their indices don't change. | The old toggle (`tfFixToggles`) needed a rolled Skill, Experiment's choice `shove`, the `grappled` status, a roll whose item isn't a `weaponEffect`, and the rolled Skill in `grappleEscapeSkills(actor)`. The new `check:grappleEscape` calls that same function (`essence20.mjs`). The `any` list is the union of every game line's escape Skills, so it never narrows `check:grappleEscape`. It is there so that a roll with no rolled Skill answers false, not "unknown", and gets no switch, as before. The old toggle always started on and was never remembered, hence `default` + `forget`. Old ext toggles and rule switches come through the same `extDialogToggles` / `runApplyDialog` calls, on skill rolls and Initiative alike. The old apply added `shiftUp += 1` and the rule switch adds `upshift: 1` to the same total, so ordering against the other hooks changes nothing. |

Removed: `FIX3_TF.experiment`, `tfFixToggles` / `tfFixApplyDialog` and their `registerDialogToggles` /
`registerApplyDialog` calls, the now-unused `label` helper and the `grappleEscapeSkills` import in
`fix3-tf/tf-fixes.mjs`, its header bullet, the two Experiment tests in `fix3-tf/tf-fixes.test.js`, and the lang key
`E20.Fix3TfExperimentEscape`. Experiment's Hardpoint option still reads its own id in `mechanics/combat/weapon-traits.mjs`,
which is outside this slice and unchanged. Experiment is now fully rules except that Hardpoint lookup.

#### Partial (0)

None.

#### Behaviour differences

1. **Switch name and label (same-line, Experiment alone).** The switch is named `rule-<item>-3` instead of
   `fix3ExperimentEscape`. Its label is the rule's fixed "Experiment: ↑1 (breaking free of the grapple)", where it
   used to be the localized "<item name>: ↑1 ...", so a renamed copy shows "Experiment". Rule switches are listed
   after the hand-written extension toggles, so its place in the dialog's list can move. Nothing else changes.
2. **Duplicate copies.** The rule applies once per copy; the old code read the first copy. Experiment has
   `selectionLimit: 1`.

No cross-line differences.

#### Still skipped (27)

##### tf1: combat (`combat.mjs`)

- **Brutal Display.** `defeatedEnemy` fires on the dealer of chat-card damage. The old Use is pressed by the player
  with a Defeated target, from any cause, and the Perk's own condition is about unarmed attacks. *Still needs:* a
  recipient "the target's allies within N ft" (by the Defeated token's disposition), a "target is Defeated" gate on
  a Use, and a per-target, crit-scaled Condition duration (1 round, or 10 on a Critical Success).
- **Make An Example.** `button` could post the per-hit Stun 1 damage buttons. *Still needs:* recipients "foes within
  30 ft of the Defeated target", the Defeated-target gate, and the hit's crit for its Frightened.
- **Fearsome Voice.** `createItem` makes ONE item from inline data. The old Use creates a weapon AND a weapon effect
  whose `flags.essence20.parentId` is that weapon's id (`keepId`), so the second item needs the first's id. The Use
  is also hidden while anything granted by the Perk exists. *Still needs:* a createItem that makes a linked
  weapon + effect pair (or a weapon with its effects from data), and a "something this item granted exists" gate. The
  crit Frightened hit rider stays with it.
- **Comms Assault.** `button` could post the EMP damage buttons. *Still needs:* a per-roll "ignore armor" Toughness
  Defense mode (`commsArmorAdjust`) and enemies-within-100-ft targeting for a roll step.
- **Focused Blast.** Unchanged gap. *Still needs:* a switch-gated, unscaled per-hit damage note
  (`damageBonusNote`), so the three-way none / ↑1 / +1 damage choice stays exclusive.
- **Steady Firepower.** *Still needs:* per-target, per-scene counters on marks, and an outgoing Defense amount read
  from them.
- **Target-Rich Environment.** *Still needs:* a step that rolls a picked owned weapon effect against computed
  targets (every enemy within its range). `pick {from: ownedItem}` picks only by item type and `equipped`, not "the
  favorite weapon's effects", and no step rolls an item.
- **My Allies Are My Shield.** *Still needs:* a per-attack additive Defense from `@count.allies`, and a tradeable
  counter feeding Movement.
- **Show Respect (Hang-Up).** `targeted` fires only on the creature attacked. The old code records ANY foe's Attack
  crit in combat for every holder on the other side. *Still needs:* a Trigger for other actors' rolls (not only those
  against me), and a pre-roll warning.
- **Easy In, Easy Out (invisibility half).** *Still needs:* a "combat exists" tag (the old stamp needs only
  `game.combat`, started or not; the `combat` tag needs a started one), and a timed Condition removal at the start of
  the next turn tied to `conditionGained`. A mark plus a `turnStart` `removeCondition` gets close, but it isn't exact
  for invisibility gained before the combat starts or on the holder's own turn.

##### tf1: support (`support.mjs`)

- **Loaded Questions.** *Still needs:* per-target counters on marks, and a shift formula reading them.
- **Comms Probe.** Still tied to False Data (below): the scene flag it sets is read by False Data's Use.
- **False Data.** *Still needs:* an open-ended `roll` step (a plain Skill Test with no DIF through the normal
  dialog). The `roll` step still always has a DIF.
- **Feedback Field.** *Still needs:* data / formula placeholders in `chat` text. `chat` still substitutes only
  `{name}` and `{target}`, and the card shows the holder's Willpower total.
- **Mine!** *Still needs:* the open-ended `roll` step, and a `choose` that runs before the cost.
- **Picking Up the Trail.** *Still needs:* the open-ended `roll` step.
- **They Called It A Glitch!** *Still needs:* granting a picked Perk to another actor together with an Active Effect
  (-2 maximum Health), a "would drop maximum Health to 1 or lower" gate, and an undo branch that removes both.
  `deleteItem` can remove items, but not the Active Effect.
- **Flexible Switch.** `pick {from: ownedItem, itemType: altMode}` twice could store the two modes. But the second
  pick can't leave out the first, and the Use is gated on no combat existing (`!game.combat`, the missing "combat
  exists" tag). The cost rule also reads the existing `flags.essence20.switchModes` on every copy that already has a
  pair. *Still needs:* a multi-pick (two different items), the "combat exists" tag, and a tag comparing
  `system.altModeId` with the picked items (the "no pair yet" case included).
- **Alt Mode Mimicry.** *Still needs:* an Origin-aware chassis picker (size class, different Origins, count raised by
  Alt Mode Mastery).
- **Drone (Origin).** *Still needs:* that picker, plus steps that write actor data (base Movement, size) from the
  picked entry.
- **Tox-En.** *Still needs:* dice in roll steps (`1d20 + 1d8`, Edge as `2d20kh`) and an extend-Condition step.
  `updateItem` changes items, not Active Effect durations.
- **Solid-State Energon.** `spendQuantity` covers "use one up", but the explosion check is `1d2 + damage`. *Still
  needs:* dice in formulas, a stored-points number kept on the item between uses (`askNumber` doesn't persist it),
  and radius damage buttons.

##### Partials' remaining halves

- **Fearsome Additions (Alt Mode ↑1).** *Still needs:* a whole-word item name match (`/\b(ram|slam|flyby)\b/i`).
  `item:name~` is a substring match.
- **Partnered (the partner pick).** `pick {from: ally}` would store the partner under `flags.essence20.rules.choices`.
  But every existing copy keeps its partner in `flags.essence20.partner`, which the ActionCost rule reads. The old Use
  also takes the targeted creature first and only then offers a picker over `getNearbyAllyTokens` (anywhere), where
  `pick` always asks over `sideActorsWithin`. *Still needs:* `pick` writing to a given flag path, or a migration, and
  a "use the target if there is one" option.
- **Predacon (the Frightened end).** *Still needs:* a Condition (or mark) lasting "until the end of the target's next
  turn" on a hit. `until: nextTurn` ends at the start of the rule actor's own next turn.

##### fix3-tf (`tf-fixes.mjs`)

- **Covering Fire.** A `miss` Trigger with a `mark` step is close. *Still needs:* a mark that lasts to the end of the
  MARKED creature's next turn and is used up once out of combat, and an own-turn tag that holds out of combat.
- **Watchful Eyes.** *Still needs:* the same mark expiry and own-turn tag, and a use-once mark consumed by the marked
  creature's next Skill Test. It is also fed by `dice.mjs`'s `isWatchfulEyesAttempt` flag.

#### Engine pieces the remaining skips need

- **Open-ended `roll` step** (no DIF, normal dialog): False Data, Mine!, Picking Up the Trail, and Comms Probe with them.
- **"Until the end of the marked creature's next turn"** for marks and Conditions, an own-turn tag that holds out of
  combat, and use-once marks: Covering Fire, Watchful Eyes, Predacon.
- **A "combat exists" tag** (started or not): Easy In, Easy Out, Flexible Switch.
- **Counters on marks** read by shifts / Defense: Loaded Questions, Steady Firepower, My Allies Are My Shield.
- **Recipients around a target** and a Defeated-target gate: Brutal Display, Make An Example.
- **Linked item creation** (a weapon with its effects from data) and a "granted item exists" gate: Fearsome Voice.
- **Origin / chassis pickers and actor-data writes:** Alt Mode Mimicry, Drone. **Granting to another actor with an
  Active Effect, and undo:** They Called It A Glitch!.
- **Dice in formulas / roll steps:** Tox-En, Solid-State Energon.
- **Switch-gated unscaled hit damage note:** Focused Blast. **Per-roll ignore-armor Defense:** Comms Assault.
- **Tags / picks:** whole-word name match (Fearsome Additions), multi-pick + `altModeId` compare (Flexible Switch),
  `pick` into an existing flag path with a target-first option (Partnered), chat placeholders (Feedback Field),
  Trigger events for any foe's roll (Show Respect), a roll step on a picked owned weapon effect (Target-Rich Environment).

#### Files touched outside the slices

- `packs/tfcrbitems/_source/Experiment_EcSOADOOb3PZMolz.json`: one rule line appended to its `rules` array (LF kept).
- `lang/en.json`: removed `E20.Fix3TfExperimentEscape`.
- `module/rules/conversions.test.js`: the `// slB2 tf1` describe block, appended at the end. The import line is
  unchanged; the `grappleEscape` check is registered inside the block with dynamic imports.

Inside the slices: `fix3-tf/tf-fixes.mjs` and `fix3-tf/tf-fixes.test.js`. No slice file became empty, so
`extensions/index.mjs` is unchanged. `tf1/` is unchanged.

Verification: ESLint clean; `check-rules`: 1535 rules on 1056 items, 0 errors, 0 warnings; jest (`--rootDir .`):
503 suites passed, 9629 tests passed, 2 skipped.

---

## Batch slB2, part tf2: re-check of the `tf2` slice skips

**Scope:** every item `docs/rules-batches/slB.md` marked Skipped or Partial for the `tf2` slice
(`module/helpers/extensions/tf2/`), re-checked against the 2026-10-04 engine pieces: the `targeted` /
`dealtDamage` / `defeatedEnemy` Triggers (and `takesDamage`'s target), the item steps (`createItem`, `deleteItem`,
`updateItem`, `spendQuantity`), `pick` with `{choice.<key>}` / `item:picked:` / `self|target:picked:`, `button`,
SkillSubstitution `scope: item`, DialogSwitch `defaultWhen`, and the new `check:` names. Round 1 left 21 skips and
no partials for tf2. Branch `rules/slB2-tf2`, from `rules/slA2` at bc4a15ee.

| Verdict (over the 21 re-checked items) | Items |
|---|---|
| Convert | 1 |
| Partial | 0 |
| Still skip | 20 |

1 rule was added to 1 pack item. After this part, `scripts/check-rules.mjs` counts 1535 rules on 1057 items (slA2
left 1534 on 1056), with 0 errors and 0 warnings. No slice file became empty, so `extensions/index.mjs` is unchanged.

### Converted (1)

| Item | Rule | Removed |
|---|---|---|
| Flexible Directives (`tfcrbitems`) | `{"type":"Use","label":"Adjust a Perk","limit":{"per":"scene","max":1},"steps":[{"do":"pick","key":"perk","from":"ownedItem","itemType":"perk","prompt":"Which Perk?"}]}` | The `tf2FlexibleDirectives` Use in `tf2/uses.mjs` (and its header comment), the `flexibleDirectives` key in `tf2/common.mjs`, and the strings `E20.Tf2FlexiblePick` / `E20.Tf2FlexibleUsed`. There were no old tests. |

Why it is exact:

- **The limit.** The old Use was hidden once `getUses(actor, 'tf2FlexibleDirectives', 'scene') >= 1`, and it marked the
  use (`markUsed`, scene window) only after a Perk was picked. `limit {per: scene}` uses the same Scene Clock window.
  A `pick` that is cancelled returns false, so the run doesn't finish, the limit isn't recorded and no card is
  posted. That matches the old `return null`.
- **Cost.** The old Use paid nothing (no `pay` call). The rule has no `cost`.
- **Effect.** The old Use only posted which Perk was picked. The rule's `pick` step posts the same thing.
- **Use precedence.** The extension Use is gone, so the rules Use is the only Use on the item.

### Partial (0)

None.

### Behaviour differences

All are same-line (only Flexible Directives changes):

- **The picker lists Flexible Directives itself.** The old list was the actor's other Perks
  (`other.id != item.id`). `pick {from: ownedItem}` filters by type and `equipped` only, so the item is offered
  too. Picking it uses up the scene's use, the same as picking any Perk. Nothing else follows from the choice.
- **Chat text.** The card is now the rule card: the bold "Flexible Directives: Adjust a Perk" title and the
  engine's "Flexible Directives: <Perk>." line (`E20.Rules.Step.Picked`). It replaces the old localized "{name}
  adapts {perk} by 1 ..." sentence. The picker prompt is now "Which Perk?" (fixed English).
- **The pick is stored** on the item (`flags.essence20.rules.choices.perk`). Nothing reads it, and every press asks
  again (no `ifUnset`).
- **A holder with no other Perk** now sees the picker (with just this item) where the old one had an empty list
  and did nothing.

### Still skipped (20)

The new pieces were checked against each one. What is still missing:

##### Roll hooks (tf2/rolls.mjs)

- **Broad Understanding (with Applied Science).** Nothing new reaches it. There is still no tag for a combat that
  exists but hasn't started (the old check is `!game.combat`). There is still no one-roll lift that Applied Science
  banks and both of Broad Understanding's rules read. A Use `limit.max` can't yet depend on holding Multiplication.
- **Cage.** Still needs a rule on the captor that applies to the marked prisoner's own rolls (`markedBy:` tags
  exist, but the prisoner doesn't hold Cage). It also needs a mark that one roll uses up (the focus), and a capacity
  check (Crew rating, +4 with Extra Crew Capacity) on the mark step.
- **Deconstruct (the weapon Snag).** The Snag goes to whoever attacks with the flagged weapon. `updateItem` could
  write a flag on an item, but no rule applies to anyone rolling a marked item. SkillSubstitution `scope: item` is
  the only item-scoped roll rule.
- **Diversion (the Snag and the allies' Edge).** `targeted` could now see the diverted creature attacking the
  diverter, and `markedByMe:` could give the Snag through an incoming rule. The allies' Edge still needs a
  "same token disposition anywhere on the scene" scope. `aura` needs a radius and counts allies through
  getNearbyAllyTokens (Frenemy, Betrayal), which isn't the old disposition compare. The mark also needs to change
  (`attackedHolder`) instead of being removed.
- **Duke It Out (the refused Edge).** It reads the mark the Use sets, so it moves with the Use (below).
- **Sustained Beam.** A `hit` Trigger plus `button` could post the offer. No step re-attacks with the same weapon
  at the same target with Edge (`item.roll` with the target set), and there is no "this is the follow-up" roll
  tag, so the offer would come back off the follow-up. The once-per-round check also happens again at press time.
- **All Out Attack / Evasive Fighting (TF printings).** `DialogSwitch {spend: {max: 5}, downshift: "@spent"}`
  still covers only the number box and the ↓. Still needs a switch step that writes target-riders' `riderStance`
  and `options.allOutAttackShifts`. It also needs an exclusion of the G.I. JOE printing by id: both printings share
  one name, so `self:has:` can't tell them apart.
- **Arrogant.** Still needs a rule that cancels the roll before it is made, with tags over every target's Threat
  Level and whether the attack is an area attack.

##### Use buttons (tf2/uses.mjs)

- **Diversion (the Use).** Nested `choose` steps plus `roll {difDefense}` could do it. It sets the mark only the
  roll hooks above read, so it moves with them.
- **Duke It Out.** Still needs a "Standard action not used this turn" tag and a Use that pays its cost after a
  `choose` step. Only `pickAlly` runs before the cost. Its level check lets an unrated (0) target through, which
  `target:levelDiff>=0` doesn't.
- **Deconstruct.** `pick {from: ownedItem}` lists only the rule actor's own items, not an adjacent target's. Also
  missing: a DIF from the picked item's Requisition Difficulty, and a "Kit" test on the item name. With those,
  `deleteItem` / `updateItem` with `item: choice:<key>`, `to: target` could do the rest.
- **Determine Probability.** Still needs a roll step that goes through the full Roll Options Dialog with a picked
  Skill (`actor._dice.rollSkill`). `pick {from: skill}` can now pick it, but the `roll` step is a plain DIF test.
- **Energon Bank.** Still needs `gainResource` with `to`. `gainResource` acts only on the actor, and on a `.value`
  path it stops at `.max`, which the old code doesn't. The item steps change items, not actor data.
- **Applied Science.** Goes with Broad Understanding.
- **We Are One!** Still needs a team pick (Party roster, else targets, up to ⌈Social/2⌉) and a linked Reroll
  grant to the picked members for two picked Skills. `pick` picks one value per key.
- **Cage (the Use).** Goes with Cage above.
- **Mutant Beast.** Still needs a `pickGrant` over a picked Origin's child Alt Modes (non-Fuzor). It also needs a
  "fewer than two Alt Modes" gate (`self:count:` has only `>=`; a `not:` of it would do once `pickGrant` can).

##### Reactions (tf2/modes.mjs)

- **Roller Drum (the Combiner Health).** Still needs a megaform-component scope for DerivedStat.
- **Dust Up.** Still needs a Trigger event for moving on your own turn.
- **For The Allspark! (Roll Out).** `pick {from: ownedItem, itemType: altMode}` could now pick the Alt Mode, but
  `setForm` only flips `isTransformed`. It can't `actor.transform(<that Alt Mode>)`. The Surprised / Mode Lock
  exceptions still need status tags or a `check:` name.
- **Not Like That, Like This!** `button` posts its own card from the holder's rule. It can't decorate a teammate's
  roll card, and no step rerolls a finished roll. The "owed" test with its turn-start / turn-end handling is
  still missing.
- **Scramble Modulator.** A `hit` Trigger with `button {who: gm}` and a `damage` step could post the GM button. No
  recipient means "the hit Combiner's component(s) with the most Health", and no tag means "the target is a
  Combiner form".
- **Lingering Side Effects.** Still needs a Trigger for another item being added. `added` fires only for the
  rule's own item.

### Engine pieces the remaining skips need

- **Marks read from the marker's side:** a rule on the marker that applies to the marked actor's own rolls, marks
  used up by one roll, and marks that change instead of going away (Cage, Diversion). A "same disposition anywhere
  on the scene" scope (Diversion's allies).
- **A tag for a combat existing, started or not**, a one-roll lift one item banks and another reads, and a
  `limit.max` that depends on another item (Broad Understanding / Applied Science / Multiplication).
- **Steps:** `gainResource` with `to` and no `.max` cap (Energon Bank). A `pick` over a target's items, and a DIF
  from an item's availability (Deconstruct). A dialog roll with a picked Skill (Determine Probability). A re-attack
  with the same weapon and target, plus a follow-up tag (Sustained Beam). A `pickGrant` of a picked item's children
  (Mutant Beast). A `setForm` that transforms into a picked Alt Mode (Roll Out). A team pick with a linked Reroll
  (We Are One!). A switch step that writes the rider stance (All Out Attack / Evasive Fighting).
- **Recipients and tags:** "the healthiest components of the hit Combiner" and "the target is a Combiner form"
  (Scramble Modulator). A "Standard action unused this turn" tag (Duke It Out).
- **Trigger events:** moving on your own turn (Dust Up), another item being added (Lingering Side Effects), and
  buttons on another actor's roll card with a reroll step (Not Like That, Like This!).
- **Other:** a roll-cancel rule (Arrogant), a megaform-component scope (Roller Drum), and a Use that pays its cost
  after a `choose` (Duke It Out).

### Files touched outside the slice

- `packs/tfcrbitems/_source/Flexible_Directives_YCLo0a3kpBeB67HW.json`: the rule (LF, as the file was).
- `lang/en.json`: `E20.Tf2FlexiblePick` and `E20.Tf2FlexibleUsed` removed (text deletion).
- `module/rules/conversions-uses.test.js`: the `// slB2 tf2` block appended at the end (2 tests). The import line
  is unchanged.
- This file.

---

## Batch slB2 (part): the `tf3` extension slice, second pass

**Scope:** every tf3 item that `docs/rules-batches/slB.md` marked Skipped (21), plus the code half of its one Partial
(Training Through Familiarity's Kit prerequisite waiver). Each was checked again against the engine pieces added on
2026-10-04: SkillSubstitution `scope: item`, DialogSwitch `defaultWhen`, the new `check:` names, the `targeted` /
`dealtDamage` / `defeatedEnemy` Triggers (and the dealer that `takesDamage` now gets as its target), the item steps
(`createItem` / `deleteItem` / `updateItem` / `spendQuantity`), `pick` with `{choice.<key>}` / `item:picked` /
`self|target:picked`, and `button`. Engine pieces from earlier rounds were looked at again too. Branch
`rules/slB2-tf3`, from `rules/slA2` at bc4a15ee.

| Verdict (re-checked items) | Items |
|---|---|
| Convert | 0 |
| Partial (was skip) | 3 |
| Still partial (nothing more converts) | 1 |
| Still skip | 18 |
| Re-checked | 22 |

6 rules were added to 3 pack items. After this part, `scripts/check-rules.mjs` counts 1540 rules on 1057 items (the base
had 1534 on 1056), with 0 errors and 0 warnings. No slice file became empty, so `extensions/index.mjs` is unchanged.

### Partial (3, were skips)

| Item | Converted | Rules | Still code |
|---|---|---|---|
| Rotor Blades | The equip / stow of the made weapon when converting | Two Triggers: `transform` → `updateItem {item: granted, set: {system.equipped: false}}`, `untransform` → the same with `true` | The weapon Use, the Bot Mode ↑1, the +1 damage against organic targets, and the Alt Mode Aerial (see below) |
| Tow Cable & Hook | The same equip / stow | The same two Triggers, after the existing Alt Mode Edge switch | The weapon Use and the Bot Mode ↑1 switch |
| Water Cannon | The same equip / stow | The same two Triggers, after the existing Alt Mode Edge switch | The weapon Use and the one-hardpoint change |

Why it is exact:

- **Same moment.** The old loop sat in tf3's `updateActor` hook (`onConverted`): it ran when `system.isTransformed` was
  in the change, only for the user who made the change. The rules engine fires `transform` / `untransform` from its
  own `updateActor` hook with the same test (`hasProperty(changed, 'system.isTransformed')`) and the same same-user
  check, and picks the direction from `actor.system.isTransformed`, as the old loop did. (Helical Spring used the
  same events in slB.)
- **Same item.** The old loop found the weapon as the first `weapon` with `flags.essence20.grantedBy` equal to the
  gear's id (`gearWeaponOf`). `updateItem`'s `item: "granted"` takes the first item with that same flag. Only the
  weapon carries it: the Use makes it with `grants.mjs#grantCopy`, and its attached weaponEffects are created by
  `createItemCopies`, which never sets `grantedBy`. None of the three gear grants anything else.
- **Same value.** Alt Mode leaves the weapon unequipped and Bot Mode equips it. `updateItem` keeps booleans as they are
  (only numbers and `@` / digit-led strings go through formulas). The old code skipped the write when the state already
  matched; the rule writes the same value, which Foundry drops as an empty diff.

Removed: the gear-weapon loop in `onConverted`, and the `GEAR_WEAPONS` / `gearWeaponOf` import in `reactions.mjs`
(`uses.mjs` still uses both for the weapon Use). There was no slice test of the loop.

### Still partial (1)

- **Training Through Familiarity (the Kit prerequisite waiver).** `onKitPrerequisite` answers
  `essence20.kitPrerequisite`. No rule type or `check:` feeds that hook. *Needs:* a Kit-prerequisite rule type (or a
  rules hook in the Kit prerequisite code).

### Behaviour differences

1. **Unequipped gear (same-line).** Gear rules work only while the gear is equipped (gear defaults to equipped). The
   old loop ignored the gear's own equipped state, so a stowed Rotor Blades / Tow Cable & Hook / Water Cannon no longer
   equips or stows its weapon when converting. slB accepted the same for Fearsome Additions.
2. **Hook order (cross-line within Transformers only).** The equip change now comes from the rules engine's
   `updateActor` handler instead of tf3's. When the same Convert also makes tf3 write Unexpected Alternative's flags,
   or the rules engine posts Helical Spring's card, the writes can come in a different order. Nothing reads that order.
3. **Item copies.** The rules apply once per copy of the gear and travel with its data. The old loop matched the
   compendium source id once. Two copies of one gear item are not an ordinary build. A gear item with the rules but no
   source id now works too.

### Still skipped (18)

- **Holographic Doubles.** `targeted` with `outcome: failure` now covers "an attack against me missed", but it fires
  for any roll against a Defense, and the old code counts only weapon attacks (`checkContext.isAttack`). The count of
  doubles still needs storing with a scene expiry and reading as the number of ↓ on an `incoming` RollModifier.
  *Needs:* a counter resource that expires with the scene and can be read in a formula, and an `attack` narrowing on
  `targeted`.
- **Intensive.** A `button` could post the group Repair offer, but no event carries a Patch Up's result and amount,
  and `patch-up.mjs` still reads the id to lift its once-per-turn limit. *Needs:* a Patch Up event with the amount, and
  a `check:` or rule hook for that limit.
- **Irrefutable Order.** *Needs:* a text-prompt step for the one-word order, a step that spends another actor's Move
  action at its next turn start, and a `target:levelDiff` gate on a Use.
- **Ladder.** *Needs:* a scope for "any allied actor in the world with this state" (the ↑2 has no range), and an
  actor-Reach formula ref for the Bot Mode unarmed Reach ×2. Its extend / stow Use alone would leave the rest reading
  its scene flag.
- **Last Stand.** `button` can post the offer and `grantActions` can give the actions, but `defeated` still has no
  attacker as its target, and no step sets the act-while-Defeated stamp. The old card is also whispered to the owners,
  and a `button` card is public. *Needs:* the attacker on `defeated`, an act-while-Defeated step, and a whispered
  button card.
- **Martyr.** *Needs:* a combat-scoped mark (keyed to the combat's id) that allies' rules can read after the holder's
  Defeat. `until: encounter` uses the scene clock.
- **No Escape.** *Needs:* a Trigger event for other tokens' movement, and a melee-Reach value.
- **Roll With It.** `takesDamage` now knows the dealer, and `button` can post the offer. *Needs:* a push /
  forced-movement step (`forced-movement.mjs#pushActor`) and a once-per-turn button limit. The old attacker came from
  `lastApplyContext`, which can differ from the damage source the event names.
- **Rotor Blades (the rest).** The ↑1 needs a `weapon:` tag for "this weapon was granted by the rule's item": its
  `grantedBy` is the gear's per-actor id. `item:picked` could match it only if the weapon Use stored a pick, and
  weapons made before would not have one. The organic-target +1 needs an organic-creature tag. The Alt Mode Aerial
  needs a late derived stage. The weapon Use: `grant` can't rename the copy, writes `_stats.compendiumSource` rather
  than `flags.core.sourceId`, and no tag hides the Use once the weapon exists. A rule Use is also hidden while the
  item keeps an extension Use.
- **Stoic.** *Needs:* a Use that stores a picked number for a Defense formula, a Defense mode that swaps Toughness for
  Evasion, and a next-turn action grant for allies.
- **Synch Up.** `targeted` fires on the defender, not on the attacker's allies. *Needs:* a Trigger event for an
  ally's miss, and an attack-range value.
- **Target Breakdown.** *Needs:* `@` refs for the Analyze Target count, a repeated action cost, and a bank
  `appliesWhen` that names a specific target.
- **The Right Of All Sentient Beings.** *Needs:* `until: "combat"` (the combat's id) and a tag for "a combat exists,
  started or not".
- **Third Dimension.** *Needs:* a MovementAction option for counting movement after a change of movement type.
- **Tow Cable & Hook (the rest).** The ↑1 switch needs the same "granted by this item" `weapon:` tag as Rotor Blades,
  and the weapon Use has the same gaps.
- **Unassuming.** *Needs:* a tag for "every weapon effect is one-handed".
- **Unexpected Alternative.** *Needs:* per-enemy memory of the Alt Modes they have seen.
- **Water Cannon (the rest).** *Needs:* a Hardpoints option that lowers one weapon's slot use. The weapon Use has the
  same gaps as Rotor Blades'.
- **Whisper Campaign.** `button {who: targets}` could let the target's owner roll, but nothing compares two totals.
  *Needs:* a contested-roll step.
- **Deceptive Warfare.** *Needs:* an Initiative-reset step.
- **One Bot Over Another.** `pick` offers only Skills, Essences, damage types, owned items, actors or a fixed list.
  The plan's weapons come from a filtered compendium search (Limited melee / projectile, or Restricted). The existing
  picks also live in the old `tf3Chosen` flag. *Needs:* a compendium-filtered `pick` (or a recording `pickGrant`), a
  move of the old flag's picks to `rules.choices`, and a Qualification that reads them (`item:picked:` matches id,
  uuid or parent, not the old name match).

(Rotor Blades, Tow Cable & Hook and Water Cannon are counted under Partial above. Their remaining code is listed here.
The 18 skips are the other items.)

### Engine pieces the remaining skips need

1. **A "granted by this rule's item" weapon tag** (Rotor Blades ↑1, Tow Cable ↑1). This is still the smallest gap.
   With a rename option on `grant` and a "has a granted item" tag, the shared weapon Use would convert too.
2. **Combat-scoped marks and a "combat exists" tag** (Martyr, The Right Of All Sentient Beings).
3. **More Trigger events:** an ally's miss (Synch Up), other tokens' movement (No Escape), a Patch Up result (Intensive),
   the attacker on `defeated` (Last Stand), and an attack-only narrowing of `targeted` (Holographic Doubles).
4. **Steps:** push / forced movement (Roll With It), contested roll (Whisper Campaign), Initiative reset (Deceptive
   Warfare), act-while-Defeated (Last Stand), a text prompt and spending another actor's action (Irrefutable Order).
5. **Picks:** a compendium-filtered `pick`, and moving old-flag picks into `rules.choices` (One Bot Over Another).
6. **Derived / Requisition:** a late derived stage (Rotor Blades' Aerial), Hardpoint use per weapon (Water Cannon), a
   one-handed tag (Unassuming), Kit prerequisite rules (Training Through Familiarity), actor-Reach formulas (Ladder).
7. **Counters:** a scene-expiring counter read in formulas (Holographic Doubles), Analyze Target counts (Target
   Breakdown), per-enemy seen-mode memory (Unexpected Alternative).

### Files touched outside the slice

- Pack sources (`packs/tfcrbitems/_source/`, LF kept, rules inserted as text): Rotor Blades (new `rules` array),
  Tow Cable & Hook and Water Cannon (two lines appended to each existing array).
- `module/rules/conversions.test.js`: the `// slB2 tf3` describe block, appended at the end. The import line is
  unchanged (`fireTriggers` is imported inside the tests).
- No lang strings became unused. `extensions/index.mjs` is unchanged.

Inside the slice: `tf3/reactions.mjs` (the gear-weapon loop in `onConverted`, its import, the header comment) and a
comment in `tf3/uses.mjs`.

---

## Batch slB2, part other2: re-check of the `other2` slice skips

**Scope:** every item `docs/rules-batches/slB.md` marked Skipped or Partial for the `other2` slice
(`module/helpers/extensions/other2/`). That is 26 Skipped items and no Partials. Each was checked again against the
2026-10-04 engine pieces: `targeted` / `dealtDamage` / `defeatedEnemy` Triggers (and `takesDamage`'s target), the item
steps (`createItem`, `deleteItem`, `updateItem`, `spendQuantity`), `pick` with `{choice.<key>}` and the `picked` tags, the
`button` step, SkillSubstitution `scope: item`, DialogSwitch `defaultWhen`, and the new `check:` names. Branch
`rules/slB2-other2`, from `rules/slA2` at bc4a15ee.

**Counts** (26 re-checked items):

| Verdict | Items |
|---|---|
| Convert | 0 |
| Partial | 2 |
| Still skip | 24 |

4 rules were added to 2 pack items. After this part, `scripts/check-rules.mjs` counts 1538 rules on 1058 items (the base
was 1534 rules on 1056 items), with 0 errors and 0 warnings. ESLint is clean. Jest passes: 503 suites, 9630 passed and
2 skipped. No slice file became empty, so `extensions/index.mjs` is unchanged.

### Partial (2)

| Item | Rules | What converted, and why it is exact | What stays code |
|---|---|---|---|
| Proper Protection (GI Joe CRB) | DerivedStat `system.immunities.poison` set 1, DerivedStat `system.immunities.disease` set 1, ConditionImmunity `["poisoned"]`. All three have `when: ["check:medicineKit"]` | `check:medicineKit` calls the same `hasMedicineKit` (`medic.mjs`) that the old `properProtectionActive` used, and the rule sits on the Perk, so holding the Perk is implicit. The old derived hook set both flags to `true`. The DerivedStat sets them to `1`, and every reader tests truthiness: `combat.mjs#applyDamage`, `essence-attack.mjs`, `studious-measures.mjs` and the sheet's `formatBooleanList`. The Poisoned veto now goes through `isImmuneToCondition` in `essence20.mjs`'s own `preCreateActiveEffect` hook, which also returns false. | The crit note on curing poison stays code, because it is part of the Heal action's own text (`healAction`). `O2_MED.properProtection` stays for that reason, and `hasMedicineKit` stays because the check calls it. |
| Junkplate (Decepticon Directive) | Trigger `event: targeted, outcome: fumbled, when: ["attack:unarmed"]`, steps `[{do: damage, to: target, amount: 1, damageType: sharp}]` | The old post-roll hook on the attacker needed `isFumble`, an unarmed attack (`rider.isUnarmed`) and a hit entry whose target wears Junkplate. It then ran `applyDamage(attacker, 1, 'sharp')`. Now, for each target of the roll, the rules' post-roll hook fires `targeted` on that target with the same `isFumble` (`fumbled` reads `facts.isFumble`) and the attacker as `to: target`. The damage step calls the same `applyDamage(actor, 1, 'sharp')`, and it runs on the roller's client, which owns the attacker. "While worn" is the rule index's `isItemActive`: active when the upgrade is loose or its host armor is equipped, which is the same as `wears`/`isWorn`. | The Sharp change on unarmed hits (hit-time Blunt → Sharp, crit repeat included) stays code. `hasSharpUnarmed`, `sharpenResult` and `O2_DD.junkplate` stay. |

Removed: the Proper Protection `registerDerived` block, its `preCreateActiveEffect` veto and `properProtectionActive` (and
the `registerDerived` and `onHook` imports in `medic.mjs`). Also removed: Junkplate's fumble `registerPostRoll` block (and
the `registerPostRoll` import in `decepticon.mjs`), plus the lang strings `E20.O2PoisonImmune` and `E20.O2JunkplateFumble`.
The `other2.test.js` Proper Protection test became a `hasMedicineKit` test, since the check still uses that function.

### Behaviour differences

1. **Proper Protection, veto message (same-line, cosmetic).** A blocked Poisoned now shows the generic warning
   `E20.ConditionImmuneWarning` ("<actor> is immune to Poisoned and can't be affected by it"). The old message was the info toast `E20.O2PoisonImmune`.
2. **Proper Protection, other `isImmuneToCondition` callers (cross-line).** Iron Bravado (`react/forms.mjs`, Power
   Rangers) shares "all the same conditions you are" immune to. A kitted Proper Protection holder now shares Poisoned as
   well. The Frightened-only callers (`terror.mjs`, `other1/jtt.mjs`) are unaffected.
3. **Proper Protection, flag value and order (same-line, no visible effect).** The immunity flags are `1` rather than
   `true`. They are written in the rules' derived pass, which comes after the slice derived hooks. No derived hook reads
   `immunities.poison` or `immunities.disease`.
4. **Junkplate, chat (same-line, cosmetic).** The card is now the Trigger's own: a bold label "Unarmed Fumble against you
   (Junkplate: 1 Sharp)" and the damage step's line. It still speaks as the wearer. The old card was the localized
   `E20.O2JunkplateFumble` sentence.
5. **Junkplate, several wearers on one roll (same-line edge case).** The old hook damaged the attacker once per roll, for
   the first target wearing Junkplate. The Trigger fires once for each target that wears it. Unarmed attacks have one
   target, so this only shows on a multi-target unarmed attack.
6. **Junkplate, ordering (same-line).** The retaliation now runs in the rules' post-roll hook, after the slice post-roll
   hooks and after the attacker's own `afterRoll` / `hit` / `miss` Triggers. Before, it ran among the slice hooks. Nothing
   else reads the attacker's Health at that point.
7. **Junkplate, edge cases (same-line).** The `attack:unarmed` tag tests that the weapon effect has no `parentId`.
   `rider.isUnarmed` tested that the parent weapon is not found. These differ only for an orphaned weapon effect whose
   weapon was deleted. The old hook also skipped a target that was the attacker itself.

### Still skipped (24)

| Item | What is still missing |
|---|---|
| Pit Plate (Sharp half) | A hit-time Blunt → Sharp damage-type override on the hit card. DamageType is decided at roll time and feeds the Resistance Snag. |
| Rust Derivatives | The `button` step could post the cure card. Still missing: a heal veto ("can't regain Health": a `preUpdateActor` Health-gain block), and a hit flag with that state. |
| Stasis Cuffs | Pre-update vetoes (no converting, no Energon spend while cuffed) and a tether with its own regenerating Health. Break / Release could be buttons, but the state they clear isn't a rule. |
| Grant His Hunger | Dice in formulas or steps (`1d2`), an Energon-vs-Essence branch on the target, and an Essence-damage step on a random Essence. |
| In His Image | Picking and removing **the target's** Hang-Ups: `pick from: ownedItem` lists the holder's own items, and `choice:<key>` resolves on the rule's item. Also needs a repeated compendium pick of replacement Hang-Ups (pickGrant takes one, onto the holder), a once-per-target flag, and a DIF of Toughness minus armor. |
| Hearty Meal | A rule that adds Skills to a named action's skill list (the Heal action dialog), once per mission. `banked-buffs.mjs` also keys on its id. |
| Stim Dart | A Use limit counted by carried items (one plus each carried dart), a range-dependent roll, and a step branch on the target's Defeated state (heal vs temporary Health). |
| Defibrillator | A delayed step (finish after six rounds, tracked across round starts, cancelled when combat changes). `spendQuantity` now covers using it up, but not the delay. |
| Support, Tech Support | `pick from: ownedItem` can choose the Upgrade. Still missing: a step that grants **a copy of a picked owned item** to the target, attached to a weapon the ally picks, with the turn/scene expiry. `createItem` takes inline data only, and `grant` takes a compendium uuid. |
| Extended Support | Changes Support's action cost and duration inside that Use (Support stays code). |
| Laser Designator | A mark that carries a roll modifier for **every** roller against the marked actor, not just the mark's holder. |
| Yo Joe! (Battle Cry) | A round-number tag and an action-ledger tag in derived data, plus a refresh on combat updates. |
| Bio-Tech Armor | An equip-veto (`preUpdateItem`) rule. |
| Big Rigger, Bigger Rigger | Incoming roll modifiers through the `driven` link (the attacker's roll, gated on the driver's Perk), and the size-matrix shift as a formula. |
| Gunport | `host:` tags at roll time (an equipped, active shield host). |
| Delegate | A step that refunds a picked use record on another actor. |
| Explosive Engineer (Hang-Up) | A rule that clears another dialog option's flag (`applyExplosiveEngineerScience` / `Technology`). |
| Frequency Interference | Acting on a target's item state (jam/reboot), a contested roll against the operator, a roll-cancel rule, and a Defense removal for jammed armor. The `button` step alone covers only the reboot card. |
| Thorn Warlord | A Defense "use instead" mode, or an add that lands after best/halve reshaping. |
| More Bang for your Buck | A flat post-roll damage add for spells (neither multiplied by Degrees of Success nor the post-hit note). Temper Tempest's strike reads it too. |
| Temper Tempest | A persistent state with a turn-start card (ends on Defeated/unconscious), and a button that reads the presser's **current** targets (up to 3) when pressed. The `button` step carries the targets from when the card was posted. |
| Sorcery (Build a Sorcerous Power) | A builder dialog that computes the Power's data and cost. `createItem` needs fixed inline data. |

### Engine pieces the remaining skips need

1. **Pre-update vetoes** (heal block, convert/Energon block, equip warning): Rust Derivatives, Stasis Cuffs, Bio-Tech Armor.
2. **Steps that act on another actor's items or records** (pick a target's item, copy a picked owned item to an ally,
   refund a use record, jam an item): In His Image, Support / Tech Support, Delegate, Frequency Interference.
3. **Hit-time damage-type override**: Pit Plate and Junkplate's Sharp half.
4. **Delayed steps / persistent turn-start state**: Defibrillator, Temper Tempest (with buttons that read targets at press time).
5. **Dice in formulas and an Essence-damage step**: Grant His Hunger.
6. **A mark with its own roll modifier for every roller**: Laser Designator.
7. **Incoming rules through the `driven` link**: Big Rigger, Bigger Rigger.
8. **`host:` tags at roll time**: Gunport.
9. **A Defense "use instead" mode**: Thorn Warlord.
10. **A flat post-roll spell damage add**: More Bang for your Buck.
11. **Round-number and action-ledger tags**: Yo Joe!.
12. **Named-action skill lists, item-count Use limits, state branches in steps, dialog-flag clearing, data builders**:
    Hearty Meal, Stim Dart, Explosive Engineer, Sorcery, Extended Support.

### Files touched outside the slice

- `packs/gijcrbitems/_source/Proper_Protection_CUV2gVVGb7U7yU5J.json`: a new `rules` array (3 rules).
- `packs/dditems/_source/Junkplate_qhxYoMHmnerakacO.json`: a new `rules` array (1 rule).
- `lang/en.json`: removed `E20.O2JunkplateFumble` and `E20.O2PoisonImmune`.
- `module/rules/conversions-uses.test.js`: the `// slB2 other2` describe block, appended at the end. The import line is unchanged; the block imports what it needs dynamically.
