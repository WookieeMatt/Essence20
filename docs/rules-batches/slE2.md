# Batch slE2: re-check of slE (qualification, data, MLP, Night Vale and misc slices) against the 2026-10-04 engine pieces

Slices: `qualify1`, `qualify2`, `data1`, `data21`, `data22`, `mlp1`, `mlp2`, `wtnv`, `r2misc`, `rules`, `fix3-dice`.

**Scope:** every item `docs/rules-batches/slE.md` marked Skipped, plus the code half of every item it marked Partial,
re-checked against the engine sections "Engine features added 2026-10-04 (after the slice round)" and "(the bigger
pieces)". The batch was done in five parts (`rules/slE2-q1`, `rules/slE2-q2`, `rules/slE2-data` for data1 + data21,
`rules/slE2-dmlp` for data22 + mlp1 + mlp2, `rules/slE2-misc` for wtnv + r2misc + rules + fix3-dice), all from
`rules/slD2` at 0ff6445b, and merged into `rules/slE2`. Each part's full write-up follows below.

| Verdict (re-checked items) | qualify1 | qualify2 | data1 + data21 | data22 + mlp1 + mlp2 | wtnv + r2misc + rules + fix3-dice | Total |
|---|---|---|---|---|---|---|
| Convert (was skip) | 0 | 0 | 1 | 1 | 1 | **3** |
| Already converted by the engine commit | 0 | 0 | 6 | 0 | 0 | **6** |
| Partial (was skip) | 0 | 0 | 0 | 2 | 0 | **2** |
| Partial, nothing more converts | 2 | 2 | 0 | 2 | 0 | **6** |
| Still skip | 21 | 16 | 14 | 30 | 10 | **91** |
| Re-checked | 23 | 18 | 21 | 35 | 11 | **108** |

8 rules were added to 6 pack items. After the merge, `scripts/check-rules.mjs` counts 1563 rules on 1070 items (slD2
left 1555 on 1065), with 0 errors and 0 warnings. ESLint is clean and jest passes (503 suites; 9645 passed, 2
skipped). The only merge conflict was two parts' test blocks appended at the end of `conversions.test.js`; both are
kept. No slice file became empty.

**What moved:**
- **Mystic (data21):** ↑1 on attacks against non-Mystical targets (`target:check:nonMystical`) and two outgoing Defense
  rules that take the target's Toughness armor (or Morphed bonus) away.
- **Identity Crisis (mlp1):** an Edge DialogSwitch offered while shape-shifted or disguised (`check:shapeShifted` /
  `check:disguised`).
- **Basic Shape-Shifting and Ponymorph (mlp1), partial:** the Deception / Infiltration Edge while shape-shifted is a
  rule on each spell. Recording which spell made the shape stays code.
- **Obsessive (wtnv):** a `pick` Use for the obsession Skill (the same 22 Skills, same order and labels) and a ↓1 on
  every other Skill. A new entry in `module/rules/legacy-choices.mjs` moves existing picks from the old
  `flags.essence20.obsession` into `rules.choices` on the GM's linking pass.
- **Already done by the engine commit:** the six "Finesse or Might" entries (Hobnailed Boot, Iron Claw, BtH Melee Weapon,
  Psycho Blade, Psycho Staff and the 52-effect group) - all 66 effects carry SkillSubstitution `scope: item`.

**Behaviour differences worth a decision** (every difference is in its part's section):
- **Identity Crisis:** a Disguise from an earlier scene no longer counts (`check:disguised` ends with the scene; the old
  code read the raw flag). With Face-Shift also ticked on a roll that already has a Snag, the roll now gets Edge where
  it used to come out plain.
- **Obsessive:** ignored through Matured it now gives no ↓1 and no Use (the old slice code was the one Hang-Up check
  that didn't respect Matured). An unlinked token actor's old pick is lost once (the legacy move runs over world
  actors only).
- **Mystic, cross-line, no current case:** the armor removal now sits inside the Defense rules' additions, so a `best` /
  `halve` Defense rule on the same attack would see the Defense with the armor already gone. No pack item has one today.
- **Wording:** Identity Crisis's, the shape-shift Edges' and Obsessive's labels / chat are now fixed English
  (3 `lang/en.json` keys removed); dialog source ids change, so a switch-off saved under the old id doesn't carry over.

**Note for the earlier re-checks:** `module/rules/legacy-choices.mjs` already moves old pick flags into
`rules.choices` (Obsessive now uses it). Several slA2-slD2 skips gave "no way to migrate old-flag picks into `pick`" as
their blocker - Weatherproof, Wheel Excited, the Dino Gem and Lightspeed Boost pickers, Better Together, Solarix Shard,
Same Principle, Energy Resistant, Mentor, Partnered - and may be convertible with a legacy entry each, as long as their
other gaps (item-tag filters on `pick`, compendium picks) don't also apply.

**Engine pieces the remaining skips need** (most useful first; each part's list has the detail):
- **Compendium picks:** `pick` over compendium entries with filters (Availability, hands, melee / ranged, traits, a
  filter depending on an earlier pick), several picks per key, `item:picked:` matching by compendium source or name, and
  a Qualification that reads them - Service, Trade Goods, For The Syndicate, Good To Go, Ninpõ JOEs, Nu Pogodi!'s
  weapon, Upgrade Training, Alternate Officer.
- **Item / vehicle tags:** traits added by attached upgrades (`itemAndUpgradeTraits`), two-handed and weapon-type tags,
  "has an attached upgrade with id X", melee / Reach weapon, crewed-vehicle size / data / name, an automatic "any Snag"
  lift, "the item this rule granted still exists", `rule:host:` as a static tag, `skill:data:<path>`.
- **A SpellCost rule:** Illusion Casting, Reach Out, Brilliant Sight, Extra Effective Spell, Long Lasting Spell,
  Mystical Understanding.
- **Buttons and card steps:** buttons on other actors' cards (rerolls for Best-Laid Plans, One Last Chance, Sharpcaster,
  Sorcerous Support), several buttons per card, adding to an already-posted check (Do Or Die), delayed buttons
  (Destructive Overcharge, Cascading Failure).
- **`createItem` with linked children** (a weapon plus its weaponEffect: Delicate Stomach, Pincers, Quills, Serrated
  Tail, Screech), removing a granted weapon's attached effects with the grant (Stinger Spray).
- **Marks:** marks that carry their own rule, per-creature memory on the holder, a turn-end Trigger on a marked creature
  that rolls for whoever marked it (Ignite, Fireball).
- **Steps:** heal Skill Test, extend a Condition's rounds or the Stun count, swap Initiative, attach an upgrade to a
  picked weapon, write actor Skill shifts / Essence maxima with a Rest undo.
- **Other:** a Brawn-requirement rule type, a `sessionStart` Trigger, a target check before the cost is paid,
  `ignoreDownshift` on a DialogSwitch at a fixed point (Third Eye), an incoming DialogSwitch with a conditional default
  (Shadow, Something Is Off), a stack group shared with hand-written roll sources (Oorah!'s vehicle ↑1), canvas-point
  and area recipients, `@other.<path>` in ItemModifier.

---

## Batch slE2 (part q1): re-check of the `qualify1` slice skips

**Scope:** every item `docs/rules-batches/slE.md` marked Skipped (21) in the `qualify1` part, plus the code half of its
two Partials (Nu, Pogodi! and Mega Training Regimen), 23 items in all. Each was re-checked against the engine sections
"Engine features added 2026-10-04 (after the slice round)" and "(the bigger pieces)" in
`docs/RULES_CONVERSION_GUIDE.md`, and against the code those two commits added (`module/rules/buttons.mjs`, `steps.mjs`
`pick` / `button` / `createItem` / `deleteItem` / `updateItem` / `spendQuantity`, `triggers.mjs` `targeted` /
`dealtDamage` / `defeatedEnemy`, `predicate.mjs` `picked:` tags and the new `check:` names, `adapter.mjs` `defaultWhen`
and SkillSubstitution `scope: item`). Branch `rules/slE2-q1`, from `rules/slD2` at 0ff6445b.

| Verdict (re-checked items) | Count |
|---|---|
| Convert (was skip) | 0 |
| Partial (was skip) | 0 |
| Partial, nothing more converts | 2 |
| Still skip | 21 |
| Re-checked | 23 |

No rules were added and no code changed. `scripts/check-rules.mjs` still counts 1555 rules on 1065 items, with 0 errors
and 0 warnings. No slice file became empty.

#### How the new pieces fit this slice, and why they still fall short

- **`pick`** stores one value per key, and only from the actor's skills, Essences, damage types, owned items, allies,
  enemies, targets, or a fixed list. The chosen-item Qualifications (Service, Trade Goods, For The Syndicate, Good To
  Go, Ninpõ JOEs, Nu, Pogodi!'s weapon) pick **compendium entries the actor doesn't own yet**, filtered by type and
  Availability. Some add more filters: two hands, melee or ranged, or a Martial Arts trait that depends on the first pick.
  A `list` would freeze the catalogue when the rule is written and lose those filters. `item:picked:<key>` compares
  the stored value with the item's `id`, `uuid` or `parentId`. The old code matches the compendium source, the uuid or
  the name, and it can store two picks under one Perk. Converting would also drop every pick already stored in
  `flags.essence20.q1Chosen`.
- **`button`** posts its own card with one button. It can't add a button to someone else's roll card or reroll that
  card's dice. Best-Laid Plans and One Last Chance need both. It also can't put two buttons on one card (Ignite's
  fight-the-fire / drop-prone card).
- **`dealtDamage`** fires once damage has landed (`dealt > 0`). Ignite sets its target alight from the hit rider of
  a Fire-damage hit (`damageValue != null`), before damage is applied, even when reductions take the damage to 0. The
  turn-end roll is still the blocker anyway (see Ignite).
- **Item steps** can create an item from inline data or update fields, but none attaches an upgrade to a chosen weapon
  (the weapon's `system.items` entry plus `parentId`, done by `setEntryAndAddItem`). Nothing Personal needs that.
- **`targeted` / `defeatedEnemy`, `defaultWhen`, `scope: item`, and the new `check:` names** don't touch any item
  in this slice.

#### Converted (0)

#### Partial (2, nothing more converts)

| Item | Already rules (slE) | Still code, re-checked |
|---|---|---|
| Nu, Pogodi! | Standard weapons Qualification; Acclimating upgrade Qualification | The chosen two-handed Limited weapon: needs a compendium pick with filters, stored as a Qualification tag (see above). The seat swap: no step changes a vehicle's crew roles (`system.actors.<key>.vehicleRole`, through the GM relay). The Use menu is shared with `helpers/nu-pogodi.mjs`' Condition removal, which is outside this slice. |
| Mega Training Regimen | ↑1 on vehicle-system and Integrated-hardpoint weapon attacks | The driving Qualification (Huge and larger land vehicles). Vehicle tags still stop at `vehicle:crew` / `driving` / `type:` / `moves:`. There is no `vehicle:size>=`. |

#### Behaviour differences

None. Nothing changed.

#### Still skipped (21)

- **Danger Sense.** It rerolls 1s and 2s on Initiative by writing `r<=2` into `system.initiative.formula` in a derived
  hook. *Still missing:* an Initiative-formula reroll. `Reroll` is self-scoped and works on chat roll cards.
- **Ignite.** *Still missing:* a per-target burning state with a counter (the "fought" ↓ stacks), a turn-end Trigger
  that fires on the **marked** creature and rolls the marker's Science against its Evasion, and several target-side
  buttons on one card, each with its own action cost. `dealtDamage` also fires later than the hit rider, and not for
  0 damage.
- **Fireball.** It only gives Edge to Ignite's fire roll, so it goes with Ignite.
- **Addicted (Dark Energon).** A `choose` step could branch the Use. *Still missing:* standard Energon spending doubled
  while craving (`preUpdateActor`; no resource-cost multiplier), a d20 + recorded-die attack against Willpower, and a
  day counter. `other1` and `resource` also read the id.
- **Best-Laid Plans.** *Still missing:* a scene-scoped reroll pool shared with the Party, sized from the roll total,
  and offered as a reroll button on members' roll cards (`button` can't decorate or reroll another card).
- **One Last Chance.** *Still missing:* an event or decorator on an ally's failed Skill Test card, a reroll granted to
  another actor (`Reroll` is `self` only), an on-scene check for the holder, and the holder's scene limit spent on press.
- **Nobility.** *Still missing:* a Story Point New Session reset modifier (`storyPointSpent` is a different event).
- **Service.** *Still missing:* a compendium pick stored as a Qualification (`trained`) tag that matches source, uuid
  or name (see "pick" above).
- **Trade Goods.** *Still missing:* the same, with Limited or Restricted weapons.
- **For The Syndicate.** *Still missing:* the same, plus a plan choice that shapes one or two picks.
- **Good To Go.** *Still missing:* the same, plus a Kit-prerequisite rule (`essence20.kitPrerequisite`).
- **Ninpõ JOEs.** *Still missing:* the same, with two picks (melee and projectile) where the second depends on the
  first pick's trait.
- **Nothing Personal.** `pick from: ownedItem` could choose a weapon, but not the old pistol-name filter (all weapons
  as the fallback). *Still missing:* a step that attaches a compendium upgrade (with its source) to the picked weapon,
  and a once-ever flag.
- **Spared No Expense.** *Still missing:* `vehicle:size` / `vehicle:data:` tags. Also the "any Snag" lift: the old code
  sets `options.snag = false`, which isn't `immune: untrainedSnag`, and a `clearSnag` switch isn't automatic.
- **Surgical Operators.** *Still missing:* `vehicle:data:system.crew.numPassengers>0`, and the same Snag lift.
- **Ultra-Secret Strike Force.** *Still missing:* `vehicle:data:system.traits.pythonPaint` and a vehicle name tag, and
  the same Snag lift.
- **The Glory of Cobra-La.** *Still missing:* a tag for "the weapon has an attached upgrade with id X". The name and
  trait halves could use `weapon:name~` / `weapon:trait:`, but the upgrade half has no tag. It also needs a "wearing
  armor that doesn't match X" tag (name, or an attached Organic Armor upgrade), and the vehicle tags above.
- **Roaming the Land.** *Still missing:* an item tag for "this weapon has a melee or Reach effect" (it reads owned
  weaponEffects or `system.items` entries) to use in a Qualification's `items`.
- **Tenacity.** *Still missing:* a `roll:save` tag. `roll:dataset:riderSpec=` compares the whole JSON string. It also
  needs a turn-start step that lists, and offers to end, marks and Conditions running out this turn.
- **Dome Generator.** *Still missing:* `@host.<path>` formula refs for a Defense rule (the host armor's
  `totalBonusToughness` / `totalBonusEvasion`), and a scene limit pooled across the copies on the same armor (rule
  limits count per copy).

#### Engine pieces the remaining skips need

1. **A compendium pick stored as a Qualification:** like `pickGrant`'s `from` (type, availabilities, tags), but it
   stores the pick instead of granting a copy. It should allow several picks per key, with filters that can depend on
   an earlier pick. Add a Qualification tag that matches the stored entries by source, uuid or name. That covers Service,
   Trade Goods, For The Syndicate, Good To Go, Ninpõ JOEs, and Nu, Pogodi!'s weapon.
2. **Vehicle tags:** `vehicle:size>=`, `vehicle:data:<path>`, and `vehicle:name~`, plus an automatic "any Snag" lift.
   That covers the driving Qualifications of Mega Training Regimen, Spared No Expense, Surgical Operators, Ultra-Secret
   Strike Force and The Glory of Cobra-La.
3. **Item tags:** an attached upgrade by id (weapon and worn armor) for The Glory of Cobra-La, and a melee-effect weapon
   tag for Roaming the Land.
4. **Rerolls for other actors:** a reroll button on another actor's roll card, a shared pool, and `Reroll` beyond
   `self` (Best-Laid Plans, One Last Chance). Also an Initiative-formula reroll (Danger Sense).
5. **A turn-end Trigger on a marked creature that acts for the marker,** with a counter on the mark and several buttons
   per card (Ignite, Fireball).
6. **Other:** `roll:save` and an expiring-effects step (Tenacity), `@host.` refs and pooled per-copy limits (Dome
   Generator), an attach-upgrade step (Nothing Personal), a vehicle crew-role step (Nu, Pogodi!'s swap), a
   resource-cost multiplier (Addicted), a Story Point session modifier (Nobility), and a Kit-prerequisite rule (Good To
   Go).

#### Files touched outside the slice

- `docs/rules-batches/slE2-q1.md` (this file). There were no pack, code, test or `lang/en.json` changes.

---

## Batch slE2 (part q2): re-check of slE's `qualify2` items against the 2026-10-04 engine pieces

**Scope:** every item `docs/rules-batches/slE.md` ("Batch slE (part): the `qualify2` extension slice") marked Skipped
(16), plus the code half of each item it marked Partial (Whisper Warrior, Oorah!), re-checked against the engine
sections "Engine features added 2026-10-04 (after the slice round)" and "(the bigger pieces)" of
`docs/RULES_CONVERSION_GUIDE.md`: SkillSubstitution `scope: item`, DialogSwitch `defaultWhen`, the new `check:` names,
the `targeted` / `dealtDamage` / `defeatedEnemy` Trigger events (and `takesDamage`'s target), the item steps
(`createItem` / `deleteItem` / `updateItem` / `spendQuantity`), the `pick` step with `{choice.<key>}` /
`item:picked:` / `self|target:picked:`, and the `button` step. Branch `rules/slE2-q2`, from `rules/slD2` at 0ff6445b.

Not re-checked: slE's converted items (Real Angels, Morale Booster), its two dead table entries (Trade School,
Technical Mastery - their code is outside the slice) and the non-item code it listed as staying (the id table and
lookups, the session counter, the `qualified`-flag access branch, the Trade School scene coach, the upgrade-stacking
helpers).

| Verdict (re-checked items) | Count |
|---|---|
| Convert (was skip) | **0** |
| Partial (was skip) | **0** |
| Partial, nothing more converts | **2** |
| Still skip | **16** |
| Re-checked | **18** |

No rules were added and no code changed. `scripts/check-rules.mjs` still counts 1555 rules on 1065 items, 0 errors,
0 warnings. ESLint is clean and jest passes (503 suites; 9638 passed, 2 skipped). No slice file became empty.

##### Converted (0)

None. Every remaining qualify2 behaviour needs something the new pieces don't give: an equipment tag the predicate
doesn't have (two-handed, upgrade-added traits, a weapon "type", an equipped weapon with given traits), a write to
something that isn't an Item (an Active Effect's duration, a combatant's Initiative, an actor flag counter, a posted
check card's total), a timer / delayed chat card, a blast around a point, or a new Trigger event.

##### Partial (2, unchanged)

| Item | Still code | Why the new pieces don't cover it |
|---|---|---|
| Whisper Warrior (IA) | Requisition access to Silent Martial Arts weapons (`perkAccess`) and Defend as a Free action while wielding one (`WHISPER_WARRIOR_RULE`) | `item:trait:` (predicate `itemTraits`) still reads only the stored `system.traits` (plus the parent weapon's), not `itemAndUpgradeTraits`, so a Qualification would miss traits an attached upgrade adds. The Free Defend needs an actor tag "has an equipped weapon with traits X and Y" for an ActionCost `when`; `pick from: ownedItem {equipped}` asks the player instead of testing, and no `check:` name covers it (`favoriteWeaponEquipped` / `equippedFireWeapon` are other tests). |
| Oorah! (SSS) | The Land-vehicle Driving ↑1 in `dice.mjs` (`VEHICLE_QUALIFICATION_PERKS_BY_MOVEMENT_TYPE`) | Unchanged: one shared non-stacking ↑1 with the hand-written vehicle Qualifications, so a RollModifier would add a second ↑1 when combined. Not slice code either. |

##### Behaviour differences

None (nothing converted).

##### Still skipped (16)

###### Qualification and training (`qualifications.mjs`)

- **Upgrade Training** - `pick` stores one value per key from a fixed list / the actor's own items / actors; it can't
  offer compendium upgrades, and `pickGrant` (which can) records nothing. Three picks from one tier chosen first, no
  repeats, kept for the Qualification. *Still needs:* a recording compendium picker (several picks) and a Qualification
  `upgrades` tag reading the recorded uuids (`item:picked:` compares owned item ids, not the probed compendium uuid).
- **Hardware Training** - *Still needs:* an item tag for two-handed weapons (any weaponEffect with `numHands` 2) and a
  trait tag reading `itemAndUpgradeTraits`. Its take-one Use (`pickGrant` with `availabilities` up to restricted) can't
  filter by two-handedness either.
- **Weapon Enthusiast (Perk)** - `pick from: list` could store the chosen weapon type, and `updateItem {item:
  "choice:<key>"}` could flag a picked owned weapon, but `updateItem`'s `set` values aren't interpolated (no
  `{choice.type}`), and nothing tests "this weapon is of type X" (the same-name trait, one-handedness, the name-word
  heuristics, or the manual tag flag). *Still needs:* a weapon-type tag and choice-filled `set` values; a `pickGrant`
  filtered by that tag for the take half.
- **Weapon Enthusiast (Hang-Up)** - *Still needs:* the weapon-type tag above and an Assist `refuse` that also sets aside
  an already-banked Lend Assistance (the pre-roll hold / post-roll restore).
- **Training Evolution** - `pick from: ally` lists nearby tokens (`sideActorsWithin`), while the old picker lists every
  world player character; then a second pick over THAT ally's weapons and crewed vehicles (`ownedItem` lists only the
  actor's own items); the pick expires with the mission; and Trained / Specialized must read it (`item:picked:` matches
  the actor's own item id, not the ally's weapon's source). *Still needs:* a mission-scoped picker over another actor's
  items / crewed vehicles and Qualification / specialize tags matching the picked source.
- **Mentor** - `pick from: skill` then `pick from: essence` would ask both (though `essence` offers all four, including
  the Skill's own, which the old picker leaves out). *Still needs:* a DerivedStat whose `path` takes `{choice.<key>}`
  and that can set a boolean (`writeNumber` skips the non-number `skills.<skill>.essences.<essence>` flag).

###### Field ops (`field-ops.mjs`)

- **At Ease, Disease** - *Still needs:* a heal-Skill-Test step (the amount picker, DIF 5 + 5 per Health,
  `applyHealSkillTestResult`) and a "living target" condition.
- **Destructive Overcharge** - `button` can post an Explode button and `pick from: ownedItem` can choose the rig, but
  the button must appear at the end of the rigger's NEXT turn (a turn-count timer), the rig can be the targeted
  creature's held item, and the blast is the rigger's Technology test against everyone within 20 ft of a point, then a
  damage button per success (the `save` step is the reverse: they roll). *Still needs:* delayed / turn-timed button
  cards, a blast Skill Test around a point, and a holder-damage button.
- **Cascading Failure** - the same rig / blast pieces plus a round timer, a size choice, the vehicle explosion
  (`explodeVehicle`) and a shared-roll Table 9-4 blast with a DIF 14 flat save for half. *Still needs:* those pieces.
- **Opportunist** - a `hit` Trigger with a `target:` status test would find the moment, but no step extends an Active
  Effect's `duration.rounds` or the actor's `system.stun.value` (`updateItem` writes Items only). *Still needs:* an
  extend-Condition / Stun step.
- **Sensitive** - Detail Oriented's daily count is the actor flag `actionPerkDailyUses.detailOriented` counted up to 3
  (not an item quantity, so `spendQuantity` / `updateItem` don't reach it; a `cost.resource.path` spend would count
  the wrong way), and the round-scoped ignore is read by this slice's `updateActor` hook against combat.mjs's banked
  Snag. *Still needs:* a cost on another item's daily counter and a round-scoped "ignore" mark the Snag bank reads.
- **Detail Oriented** - only read here for Sensitive's count; goes with Sensitive.

###### Old Hand (`old-hand.mjs`)

- **Do Or Die** - `button` posts a new card with its own steps; it can't add a die to an already posted check card's
  total and rescore every target. *Still needs:* a card reaction Use on a posted check (plus the Moxie cost that rises
  to 2 for a second use in a scene).
- **Wild Idea** - *Still needs:* a DialogSwitch bonus pool die (`extBonusPoolDie`) with the level-scaled Do Or Die die.

###### Sessions (`session.mjs`)

- **Timeline Anomaly** - *Still needs:* a swap-Initiative step (combatants, not Items). Its session carry stays.
- **Everything is Inspiration** - *Still needs:* a `sessionStart` Trigger event (not in `TRIGGER_EVENTS`). Its
  `dice.mjs` once-per-scene half is outside this slice.

##### Engine pieces the remaining skips need

- **Equipment tags:** `itemAndUpgradeTraits`-aware trait tag; two-handed / one-handed weapon tags; a weapon-type tag
  (Weapon Enthusiast); an actor tag "has an equipped weapon with traits X and Y" (Whisper Warrior).
- **Recorded picks beyond `pick`:** a compendium picker that records several picks (Upgrade Training), a picker over
  another actor's items / crewed vehicles that expires with the mission (Training Evolution), Qualification /
  specialize tags matching a recorded source uuid, `{choice.<key>}` in `updateItem.set` values and DerivedStat paths,
  and boolean DerivedStat writes (Mentor).
- **Delayed effects:** turn- / round-timed button cards and a blast Skill Test around a point (Destructive Overcharge,
  Cascading Failure).
- **Steps on non-Items:** heal Skill Test (At Ease, Disease), extend a Condition / Stun (Opportunist), swap Initiative
  (Timeline Anomaly), a cost on another item's daily counter (Sensitive).
- **A card reaction Use** on a posted check (Do Or Die) and a **DialogSwitch bonus pool die** (Wild Idea).
- **A `sessionStart` Trigger event** (Everything is Inspiration).
- **A shared stack group with hand-written roll sources** (Oorah!'s vehicle ↑1).

##### Files touched outside the slice

- `docs/rules-batches/slE2-q2.md` (this file). Nothing else.

---

## Batch slE2 (part): re-check of the `data1` and `data21` slice skips

**Scope:** every item marked Skipped or Partial for `data1` and `data21` in `docs/rules-batches/slE.md` (21 Skipped,
0 Partial), re-checked against the 2026-10-04 engine pieces in `docs/RULES_CONVERSION_GUIDE.md` (targeted /
dealtDamage / defeatedEnemy Triggers, the item steps, `pick`, `button`, SkillSubstitution `scope: item`, `defaultWhen`,
the new `check:` names). Branch `rules/slE2-data`, from `rules/slD2` at 0ff6445b.

The counting is the same as slE's: the 52 core-book / Night Vale / Transformers "Finesse or Might" effects are one entry,
and Hobnailed Boot, Iron Claw, BtH Melee Weapon, Psycho Blade and Psycho Staff are one entry each. Over Brawn, The Heavy
and Pack Mule count as three items (Pack Mule's two printings are one).

| Verdict (re-checked items) | data1 | data21 | Total |
|---|---|---|---|
| Convert (this batch) | 0 | 1 | **1** |
| Already converted by the engine commit | 0 | 6 | **6** |
| Partial | 0 | 0 | **0** |
| Still skip | 8 | 6 | **14** |

3 rules were added to 1 pack item. After this part, `scripts/check-rules.mjs` counts 1558 rules on 1066 items (the
base was 1555 rules on 1065 items), with 0 errors and 0 warnings.

#### Already converted by the engine commit (6)

The engine commit after slE (8001924e, "Phase 2 Engine additions") added SkillSubstitution `scope: "item"` and put
`{type: SkillSubstitution, scope: item, from: finesse, to: might, mode: bestOf}` and its reverse on all 66 "Finesse or
Might" weapon effects. It also removed `data21/weapons.mjs#finesseOrMight` (the pre-roll swap) and its id lists; no
`D21` key for these effects is left. This batch only checked that it is done: all 66 pack effects have the rules, and no
data1 / data21 code still reads them. The entries are Hobnailed Boot, Iron Claw, BtH Melee Weapon, Psycho Blade,
Psycho Staff (all their attack effects) and the 52 core-book / Night Vale / Transformers effects.

#### Converted (1)

| Item | Pack file | Rules | Replaces |
|---|---|---|---|
| Mystic | `packs/fmmcitems/_source/Mystic_SBlOGEnend5WYwgd.json` | RollModifier `{label: "Mystic", upshift: 1, when: ["attack", "target:check:nonMystical"]}`; Defense `{defense: toughness, amount: "-@target.system.defenses.toughness.armor", outgoing: true, when: ["not:target:morphed", "not:target:status:armorStripped"]}`; Defense `{defense: toughness, amount: "-@target.system.defenses.toughness.morphed", outgoing: true, when: ["target:morphed", "not:target:status:armorStripped"]}` | `data21/threats.mjs#mysticSources` (registerRollSources) and `#mysticDefense` (registerDefenseAdjust) |

Why it is exact:

- **↑1.** The old source applied when the roller held Mystic, `isAttack` was set, there was a target and
  `isNonMystical(target)` was true. That source came from `extRollSources`, which `target-riders.mjs#rollRiderSources`
  calls with `isAttack` set explicitly from `dice.mjs`. `ruleRollSources` is registered in that same `extRollSources`
  list. The `attack` tag reads that same `ctx.isAttack`. `target:check:nonMystical` runs
  `threats.mjs#isNonMystical` on the target, and with no target the check is unknown, so the rule does not apply. The
  source label stays "Mystic" (it was the item's name).
- **Ignore Toughness armor.** The old adjust applied whenever the attacker held Mystic and the Defense was Toughness,
  whether or not the target was Mystical. It returned minus the target's `defenses.toughness.morphed` when the target
  was Morphed and minus `defenses.toughness.armor` otherwise, and 0 when the target had `armorStripped`. An outgoing
  Defense rule is read in `ruleDefenseAdjust` with `other` set to the defender. `@target.<path>` reads the defender's
  value (`Number(...) || 0`, as before). `target:morphed` is `!!system.isMorphed`, and `target:status:armorStripped`
  is `statuses.has('armorStripped')`. `ruleDefenseAdjust` is itself a registered `defenseAdjust` hook, called from the
  same `extDefenseAdjust` in `riderDefenseAdjust`, so it reaches the same rolls: every roll against a targeted Defense.

Removed: `mysticSources`, `mysticDefense`, their `registerRollSources` / `registerDefenseAdjust` calls and the now-unused
imports of those two functions in `data21/threats.mjs`; the Mystic source / defense assertions in
`data21/data21.test.js` (the test is now "Larger Than Life reach and who is Non-Mystical"). `isMystical` /
`isNonMystical` and `D21.mystic` / `D21.sorcery` stay: `essence20.mjs` registers `check:nonMystical` from them. The
replacement tests are in `module/rules/conversions.test.js` (`// slE2 data`).

#### Partial (0)

None.

#### Behaviour differences

1. **Mystic: the order against reshaping Defense rules (cross-line, no current case).** The armor removal used to be
   added outside `ruleDefenseAdjust`. Now it is one of that function's own additions, so a `best` / `halve` Defense
   rule on the same attack would act on the Defense with the armor already removed. Before, the armor was removed
   after the halving or best-of. No pack item has a `best` or `halve` Defense rule today. `fail` gives Infinity either
   way. The hand-written halvings in `dice.mjs` (Unseen Strike, Augmented) run after `riderDefenseAdjust`, as before.
2. **Mystic: active copies only (same line).** The old code matched any copy of the compendium uuid. The rules follow
   the item and need it active. A Perk is always active, and there is one printing.
3. **Mystic: the source id (same line, cosmetic).** The dialog source id is the rule id instead of `d21Mystic`, so a
   switch-off a player saved under the old id is not carried over.

#### Still skipped (14)

##### data1

- **Reinforced Shell** (`armor-rules.mjs`: `countedShell` / `applyShellMode` derived, `shellStunBonus` hit rider).
  Nothing new covers the "counted" test (a loose upgrade only with `canTransform` / `alterationWorn`, an attached one
  only on worn armor) or a dealt note that needs neither an active item nor a damage value. `dealtDamage` fires after
  the damage has landed, so it can't add to the hit's damage note. *Still needs:* a static `rule:host:` tag (the host
  exists, is armor, is worn) and an unscaled dealt DamageModifier that needs no damage value.
- **Over Brawn, The Heavy, Pack Mule** (`brawnRequirementBonus`, read by `brawnShortfall`). *Still needs:* an
  equipment-requirement Brawn rule type (ignore, or +N die sizes) that `brawnShortfall` and the weapon-requirement code
  both read.
- **Dino Thunder [Form], Dino Thunder Boost, Extra Dino Thunder Form Power, White Ranger Extra Dino Thunder**
  (`dino-thunder.mjs`). `pick` stores a choice on the rule's own item, and `{choice.<key>}` reads it back only there.
  The Form power is stored on the Form Perk and read from the Extra / Boost / White Ranger items, from teammates
  (`worldActors`) and by `zord1/forms.mjs`. *Still needs:* reading a pick stored on another item (and on other actors'
  items) as list options, a resource pool usable only for one Use that falls back to Personal Power, a step that calls
  a custom hook (`essence20.dinoThunderActivated`), and clearing an actor flag on Morph.

##### data21

- **Stinger Spray (Perk)** (`psycho.mjs#grantStingerSpray` / `dropStingerSpray`). A Grant rule now brings the weapon's
  attack effects, but removing the Perk still deletes only the granted weapon (`lifecycle.mjs#onDeleteItem` /
  `grantedBy`), not its attached effects. Item steps need a Trigger, and there is no "removed" event. *Still needs:*
  Grant removal that also removes the granted items' attached children (or a Trigger event when the item is removed).
- **Stinger Spray (attack, 3 effects)** (`stingerSprayCost`, preRoll). It pays 1 Personal Power as the attack is
  rolled, before the dialog, with a warning (not a block) outside Monster Form or out of Power. An afterRoll Trigger
  with `spend` would pay later, would skip rolls that are cancelled, and can't give those warnings. *Still needs:* a
  per-attack cost on a weapon effect, paid at preRoll, that warns instead of refusing.
- **Psycho Morpher** (`usePsychoKit`). Options per Path Role could be seven Uses gated by `self:hasItem:<role>`, but the
  Use must be offered again only once that particular granted weapon is gone (`d21PsychoKitWeapon`). No tag answers
  "an item this rule's item granted still exists". *Still needs:* a `rule:granted` style tag, or a `pick` / `pickGrant`
  over a fixed uuid list whose availability follows the granted copy.
- **Larger Than Life** (`largerThanLifeReach`). ItemModifier is unchanged: its formulas resolve against the rule's
  item, not the modified effect, and it would write a reach where there was none. *Still needs:* `@other.<path>` in
  ItemModifier formulas, and an ItemModifier that leaves a missing value alone.
- **Sky Morpher** (`skyMorpherSources`). *Still needs:* a "driving own Zord" tag (listed on the sheet or
  `companionOf`, seen from the Ranger or from the Zord through its driver), and a way to count unequipped gear.
- **Alternate Officer Equipment Training** (`officer.mjs`). `updateItem` writes items, not the actor's
  `system.trained.*`. The Limited melee weapon is picked from the compendium (`pickGrant` doesn't store its pick), and
  Requisition matches it by uuid or by name. *Still needs:* a step that writes actor fields once, and a stored
  compendium pick that a Qualification can read.

#### Engine pieces the remaining skips need

- **Static host tags** (`rule:host:` exists / armor / equipped) and a dealt note without a damage value - Reinforced Shell.
- **An equipment-requirement Brawn rule** - Over Brawn, The Heavy, Pack Mule.
- **Cross-item / cross-actor picks** as options, a single-use pool with fallback, a custom-hook step, and a Morph
  flag clear - Dino Thunder x4.
- **Grant removal that takes attached children** (or an item-removed Trigger event) - Stinger Spray (Perk).
- **A preRoll per-attack cost that warns instead of refusing** - Stinger Spray's attacks.
- **A granted-item-still-exists tag** - Psycho Morpher.
- **`@other.<path>` in ItemModifier** plus "leave a missing value alone" - Larger Than Life.
- **A "driving own Zord" tag** and counting unequipped gear - Sky Morpher.
- **An actor-field write step** and a Qualification for a stored compendium pick - Alternate Officer.

#### Files touched outside the slices

- `packs/fmmcitems/_source/Mystic_SBlOGEnend5WYwgd.json` (rules inserted as text, LF kept).
- `module/rules/conversions.test.js` (one `describe('slE2 data')` block appended at the end under `// slE2 data`;
  import line unchanged).

---

## Batch slE2 (part dmlp): re-check of the `data22`, `mlp1` and `mlp2` slice skips

**Scope:** every item that `docs/rules-batches/slE.md` (part "data22, mlp1 and mlp2") marked **Skipped** (33) or
**Partial** (2), re-checked against the 2026-10-04 engine pieces: `targeted` / `dealtDamage` / `defeatedEnemy`
Triggers and `takesDamage`'s target, the item steps (`createItem`, `deleteItem`, `updateItem`, `spendQuantity`), `pick`
with `{choice.<key>}` / `item:picked:` / `self|target:picked:`, `button`, SkillSubstitution `scope: item`, DialogSwitch
`defaultWhen`, and the new `check:` names (`shapeShifted` and `disguised` among them). For the partials, the half that
stayed code was re-checked. Branch `rules/slE2-dmlp`, from `rules/slD2` at 0ff6445b.

| Verdict (over the 35 re-checked items) | data22 | mlp1 | mlp2 | Total |
|---|---|---|---|---|
| Convert | 0 | 1 | 0 | **1** |
| Partial (new) | 0 | 2 | 0 | **2** |
| Partial (unchanged, code half still code) | 0 | 1 | 1 | **2** |
| Still skip | 8 | 13 | 9 | **30** |
| Re-checked | 8 | 17 | 10 | **35** |

3 rules were added to 3 pack items. `scripts/check-rules.mjs`: 1558 rules on 1068 items, 0 errors, 0 warnings.
ESLint is clean; jest passes (503 suites; 9639 passed, 2 skipped). No slice file became empty, so
`extensions/index.mjs` is unchanged.

### Converted (1)

- **Identity Crisis** (`packs/dsoeitems/_source/Identity_Crisis_R6XROOkbI2dKmn5R.json`)
  - DialogSwitch `{edge: true, forget: true, when: [{any: ["check:shapeShifted", "check:disguised"]}]}`, labelled
    "They believe you're someone else (Identity Crisis: Edge)".
  - `check:shapeShifted` is `shapeOf(actor)` (the `mlpShape` flag stamped this scene) - exactly the old `shapeOf` half.
    `check:disguised` is `isDsoeDisguiseActive` (see the behaviour differences).
  - Offered on every roll, Initiative included (both read `extDialogToggles` / DialogSwitches there), unticked each time,
    as before.
  - Removed from `mlp1/mlp1.mjs`: the `identityCrisis` id-table key, the `shaped` variable, the toggle and the
    `|| ext.identityCrisis` half of the apply line (now `if (ext.faceShiftPass)`). Removed from `lang/en.json`:
    `Mlp1ToggleBelieved`. No old test covered it.

### Partial (2 new)

- **Basic Shape-Shifting** (`packs/dsoeitems/_source/Basic_Shape_Shifting_u2fdkjPJZmeLgalz.json`) and
  **Ponymorph** (`packs/mlpcrbitems/_source/Ponymorph_3Tm9SWc060Z62e4Q.json`) - the Edge half.
  - Each spell carries a RollModifier `{edge: true}` with `when`: Deception or Infiltration, `not:roll:initiative`,
    `check:shapeShifted`, `self:data:flags.essence20.mlpShape.spell`, and the label split - Basic Shape-Shifting's rule
    has `spell!=<Ponymorph uuid>`, Ponymorph's has `spell=<Ponymorph uuid>`. So exactly one Edge source shows, labelled by
    the spell that set the shape, and a legacy `spell: true` shape counts as Basic Shape-Shifting, as before.
  - `not:roll:initiative`: the old roll source was an extension roll source, which Initiative never read.
  - Removed: the Basic Shape-Shifting block of `mlp1RollSources`, and the two slice tests for it (one `expect` in "a
    changed shape gives Face-Shift and Master Morph their Skills", and the whole "a Ponymorph shape labels its Edge
    Ponymorph" test) plus the now-unused `MLP1` import in `mlp1.test.js`.
  - **Stays code:** the `mlp1PostRoll` branch that writes `mlpShape.spell` after a successful cast, so the
    `basicShapeShifting` and `ponymorph` keys stay. It joins the shared `mlpShape` flag that the Shape-Shift Use and
    Face-Shift / Master Morph still read and write (merge into the current shape, scene stamp, size undo on change back).
    A `mark` or `pick` would store it elsewhere.

### Partial (unchanged)

- **Mrs. Doubleshoe's Prize Honey** - the `mlp1Honey` Use still stays. `updateItem` could count the uses down, but
  `add` on a missing `flags.essence20.usesLeft` starts from 0, not the old default 3 (no formula coalesce), and the heal
  is on the actor (the `heal` step never lowers Health above the maximum; the old `Math.min(max, value + 3)` did).
- **Wheel Excited** - the `mlp2Wheel` Use still stays. A `pick {from: list}` stores under
  `flags.essence20.rules.choices`, while every existing copy holds its pick in `flags.essence20.vehicleType`, which the
  three switches read; `updateItem` can't copy the pick there (`set` values aren't interpolated). Same verdict as the
  legacy-flag picks in slA2 (Advanced Dino Gem Integration, Beast Morpher).

### Behaviour differences

- **Identity Crisis, same-line:** the old toggle read the raw `dsoeDisguiseActive` flag (any value, so a Disguise
  cast in an earlier scene still counted); `check:disguised` reads `isDsoeDisguiseActive`, which ends with the scene,
  as the Disguise spell itself does.
- **Identity Crisis + Face-Shift (same slice, cross-item):** the old code made ONE `edge()` call when either "pass as"
  or "believed" was ticked, and `edge()` clears a Snag instead of adding an Edge. With a Snag already on the roll and
  both ticked, the old result was a plain roll; now Face-Shift's `edge()` clears the Snag in the slice hook and the
  rule's Edge (applied after every slice's apply hook) stands, so the roll gets Edge. With only one of them, or no Snag,
  the result is the same (Edge + Snag cancel at roll time).
- **Identity Crisis, cross-line ordering:** its Edge is now set after every slice's apply-dialog hook instead of inside
  mlp1's. For hooks that cancel an Edge with a Snag ("if edge clear it, else snag") the end result is the same either
  way (Snag + Edge cancel at roll time).
- **All three, same-line:** fixed English rule labels instead of localized strings / the (possibly renamed) item name.
  Basic Shape-Shifting and Ponymorph: the Edge now needs the spell on the actor (it always is: only a cast of the
  actor's own spell sets the shape). A legacy `spell: true` shape on an actor holding only Ponymorph no longer gets the
  Edge (such shapes only last the scene they were made in).

### Still skipped (30)

**data22**

| Item | What is still missing |
|---|---|
| Data-Link | A tag for "a companion drone carrying this item was not commanded this round" (the `petCommand` stamp); the turn-end / turn-start flag pair could be `turnEnd` Trigger + `bank` defense, but nothing can ask the drones. |
| Transmetal | A Movement stage after `_applyGravityMovement`, a movement type taken from `system.choice`, and comparisons in formulas. |
| Fresh Mark | Per-creature memory on the holder ("first Deception test against each creature"). `pick {from: target}` stores one value per key; marks hold one setter. |
| Natural Style | The same per-creature memory, stamped with the scene of first meeting. |
| Smoke Screen | `spendQuantity` now covers the quantity, but a canvas-point step and "every token within 20 ft of that point" recipients are still missing. |
| Assault Claw | Unchanged: the `d22AssaultClawGrapple` flag is read by `extensions/rules/grappled.mjs` (another slice); it can move only with it. |
| Demolecularization Gun (+ its Effect) | A mark that carries its own rule (Edge for anyone's Sharp attacks against the marked target) and a secondary-damage-type tag. |
| Primeon Blade | `button` exists, but its steps can only reach the current targets (the Combiner), not one button per megaform component member: needs a megaform-participant recipient / per-member buttons. The damage type `element` also has to match `applyDamage(member, 1, 'element')`. |

**mlp1**

| Item | What is still missing |
|---|---|
| Shape-Shift (Origin), Face-Shift, Master Morph, Size-Shift (the Use) | `pick` stores one value per key on the rule's item; the Use needs a single dialog of optional picks (Face / Morph Skill only with those Perks, a size range by Size-Shift copies), a size write with an undo, a scene stamp, and "change back" when already shaped. |
| Face-Shift (sources), Master Morph (sources) | A tag comparing the rolled Skill with an actor-data value (`skill:data:<path>`) - the picks live in `mlpShape.faceSkill` / `morphSkill`. |
| Brilliant Sight | The fog option needs a SpellCost rule. The darkvision half could be `createItem` (gear with `visionGrant`, `until: scene`) on `targetOrSelf`, but it would relay to the GM where the old code skipped targets the user can't write, use `rulesExpiry` instead of `temporary('scene')`, and post a "Granted" line; kept with the fog half. |
| Far-Sighted | A tag / check for "an equipped weapon with a non-melee effect". |
| Illusion Casting, Reach Out | A SpellCost rule (spell-cost dialog options). |
| Pinkie Sense | A dice-roll / table chat step. |
| Softenblows | `until: endOfNextTurn` of the target, and outgoing-damage negation for a marked attacker. |
| Sharpcaster | `button` can post the offer, but no step re-rolls the spell at no cost (`sharpcasterFree`), and no outcome means "every targeted result missed". |
| Smoke Bomb | A canvas-point step and a positional area roll source. |
| Sorcerous Support | A button on *another actor's* fumbled chat card and a step that re-rolls that card's formula; `button` only posts its own card. |

**mlp2**

| Item | What is still missing |
|---|---|
| Waterrunning | A mark that carries its own rule. `createItem` (an item with its own DialogSwitch, `until: scene`) comes close but adds a sheet item, stacks on re-cast where the old flag was idempotent, relays and posts chat. |
| Extra Effective Spell, Long Lasting Spell | A SpellCost rule. |
| Mystical Understanding | A SpellCost rule, a Skill-shift write step (Refocus), Essence-maximum writes with a Rest undo (Essential Research); `updateItem` changes items, not the actor. |
| Friendship Is Mystical | Writes to the friend's helper flags and a heal capped by both missing Health and the holder's points. |
| Reactionary | An Initiative re-roll step and a per-round limit. |
| Thick Skin | An Active-Effect toggle step (`updateItem` can't reach embedded effects). |
| Screech | `createItem` makes one item; Screech needs a weapon plus its weaponEffect linked by `parentId` (or `createItem` with children), and the "not already granted" gate. |
| Something Is Off | An incoming DialogSwitch (the roller's switch read by the defender's Defense rule). |

### Engine pieces the remaining skips need

- **A SpellCost rule:** Illusion Casting, Reach Out, Brilliant Sight (fog), Extra Effective Spell, Long Lasting Spell,
  Mystical Understanding.
- **Marks that carry a rule:** Demolecularization Gun, Waterrunning. **Per-creature memory** on the holder: Fresh Mark,
  Natural Style.
- **Canvas / area:** a picked point, recipients within a radius, positional roll sources (Smoke Screen, Smoke Bomb).
- **Buttons on other actors' cards** and a "re-roll this roll / cast again free" step: Sharpcaster, Sorcerous Support.
  A megaform-member recipient for `button`: Primeon Blade.
- **`skill:data:<path>`** (rolled Skill equals an actor-data value): Face-Shift / Master Morph sources. A multi-pick
  dialog with a size write and undo: the Shape-Shift Use.
- **Actor writes:** Skill shift, Essence maximum with a Rest undo, Initiative re-roll, Active-Effect toggles
  (Mystical Understanding, Reactionary, Thick Skin). `createItem` with linked children (Screech).
- **Tags:** equipped ranged weapon (Far-Sighted), secondary damage type (Demolecularization Gun), companion drones not
  commanded this round (Data-Link).
- **A post-gravity Movement stage** and formula comparisons (Transmetal); **`until: endOfNextTurn` of the target**
  (Softenblows); **an incoming DialogSwitch** (Something Is Off); a **legacy-flag migration path** for `pick` (Wheel
  Excited); a **formula coalesce / default** for `updateItem` and an actor-side heal that can lower Health (Prize Honey).

### Files touched outside the slices

- `packs/dsoeitems/_source/Identity_Crisis_R6XROOkbI2dKmn5R.json`,
  `packs/dsoeitems/_source/Basic_Shape_Shifting_u2fdkjPJZmeLgalz.json`,
  `packs/mlpcrbitems/_source/Ponymorph_3Tm9SWc060Z62e4Q.json`: rules inserted as text (LF kept).
- `lang/en.json`: removed `Mlp1ToggleBelieved` (one line deleted).
- `module/rules/conversions.test.js`: `describe('slE2 dmlp', ...)` appended at the end under `// slE2 dmlp`. The import
  line is unchanged. The block registers the real `shapeShifted` / `disguised` checks (`mlp1.mjs#shapeOf`,
  `dsoe-disguise.mjs#isDsoeDisguiseActive`) in its `beforeAll`.

---

## Batch slE2 (part): re-check of the `wtnv`, `r2misc`, `rules` and `fix3-dice` slices

**Scope:** every item that `docs/rules-batches/slE.md` (part "wtnv, r2misc, rules and fix3-dice") marked Skipped or
Partial, re-checked against the 2026-10-04 engine pieces: SkillSubstitution `scope: item`, DialogSwitch `defaultWhen`,
the new `check:` names, the `targeted` / `dealtDamage` / `defeatedEnemy` Triggers (and the dealer as `takesDamage`'s
target), the item steps (`createItem`, `deleteItem`, `updateItem`, `spendQuantity`), `pick` with `{choice.<key>}` /
`item:picked:` / `self|target:picked:`, and `button`. That part had 11 skips and no partials. `r2misc/commander.mjs`
(keyed by item type) and `rules/grappled.mjs` (keyed by status) are still out of scope. Branch `rules/slE2-misc`, from
`rules/slD2` at 0ff6445b.

| Verdict | wtnv | r2misc | rules | fix3-dice | Total |
|---|---|---|---|---|---|
| Convert | 1 | 0 | 0 | 0 | **1** |
| Partial | 0 | 0 | 0 | 0 | **0** |
| Still skip | 8 | 1 | 0 | 1 | **10** |
| Re-checked | 9 | 1 | 0 | 1 | **11** |

This part added 2 rules to 1 pack item. After it, `scripts/check-rules.mjs` counts 1557 rules on 1066 items (the base
had 1555 rules on 1065 items), with 0 errors and 0 warnings. No slice file became empty, so `extensions/index.mjs`
and every slice test file stay.

#### Converted (1)

| Item | Pack file | Rules | Removed |
|---|---|---|---|
| Obsessive (Hang-Up) | `wtnvcgitems/_source/Obsessive_eOgtG24LKGR6OE0v.json` | Use `{label: "Pick the obsession", steps: [{do: pick, key: obsession, from: list, options: [the 22 CONFIG.E20.skills entries as [key, "E20.Skill…"]], prompt}]}`; RollModifier `{downshift: 1, when: ["roll:dataset:skill", "not:roll:initiative", "not:skill:{choice.obsession}"]}` | `WTNV.obsessive`, the Obsessive block in `wtnvRollSources` (and its now-unused `rolledSkill` parameter), `chooseSkill`, the `wtnvObsessive` Use, its test in `wtnv.test.js`, `E20.WtnvObsessionPrompt` and `E20.WtnvObsessionSet` |

Why the rules are exact:

- **The picker.** The old Use called `grants.mjs#chooseSelect(item.name, prompt, CONFIG.E20.skills entries)`. The
  `pick` step calls the same `chooseSelect` with the item name as the title. `from: skill` would list the actor's
  `system.skills` keys (alphabetical, plus `roleSkillDie` and `wealth`), so the rule uses `from: list` with the same 22
  Skills, in the same order, with the same `E20.Skill…` keys localized, and the same prompt text. No action cost, as
  before. A cancelled pick returns `false` with no chat line, so no card is posted (the old Use returned `null`).
  The Use stays available, so the obsession can be changed any time, as before.
- **The ↓1.** The old source was offered through `extRollSources` (called from `rollRiderSources` inside
  `_getAutomaticCombatModifiers#finish`) when the obsession was set, `rolledSkill` was truthy and differed from it.
  `ruleRollSources` is a registered roll source on the same channel, so the rule's ↓1 is a listed source the player can
  untick, labelled with the item name, the same as the old one. `not:skill:{choice.obsession}` is `false` while
  nothing is picked (`interpolate` returns null, and `evaluateTag` answers `false` for the whole tag), which matches
  "no obsession, no ↓1". `roll:dataset:skill` is "rolledSkill is truthy": `rolledSkill` is `dataset.skill` and the
  `dataset` handed to the rider sources is that same dataset. Initiative calls `ruleRollSources` directly but never
  called the wtnv source, so `not:roll:initiative` keeps it out.
- **Existing picks are kept.** `rules/legacy-choices.mjs` gets an entry for Obsessive's `_id` that moves the old
  `flags.essence20.obsession` into `flags.essence20.rules.choices.obsession` during the GM's linking pass
  (`inherit.mjs#linkExistingCopies`). A choice already made under the rules is never overwritten.

The replacement tests are the `describe('slE2 misc')` block at the end of `module/rules/conversions-uses.test.js`:
the picker (same list, same order, no action, re-pickable), a cancelled pick, the ↓1 (none before a pick, none on the
obsession Skill, none without a Skill, none on Initiative), an ignored Matured Hang-Up, and the legacy-choice move.

#### Partial (0)

None.

#### Behaviour differences

All are same-line (Obsessive on its own); none is cross-line.

1. **Chat text (same-line).** The card is now "**Obsessive: Pick the obsession**" plus the `pick` step's
   "Obsessive: Science." line, instead of the localized "{name} is obsessed with {skill}: other Skill Tests take ↓1."
2. **Matured (same-line).** A Hang-Up flagged `maturedIgnored` (the one Matured lets the player ignore) is inactive for
   rules, so an ignored Obsessive no longer gives its ↓1 or its Use. The old slice code didn't check the flag, unlike
   every other Hang-Up check (`perks.mjs#findHangUp`).
3. **Picks on unlinked token actors (same-line, one-off).** The legacy-choice move runs over `game.actors` only. An
   unlinked token actor whose Obsessive was picked under the old flag loses the pick (no ↓1) until it is picked again.
4. **Source id and list order (cosmetic).** The dialog source's id is now the rule id instead of `ext-obsessive`,
   and it sits among the rules' sources rather than the wtnv sources in the list.

#### Still skipped (10)

- **Dog Person (wtnv).** Nothing new reads creature tags or a word-boundary match: `target:name~` is still a plain
  "contains" test, and `target:data:` has no "contains" or regex operator. The dialog-switch half still needs a
  DialogSwitch whose `specialize` holds only for one Skill (Animal Handling). *Still needs:* a creature-kind / regex
  target tag and a per-Skill `specialize` on a DialogSwitch.
- **Third Eye (wtnv).** None of the new pieces touch the apply-dialog order. *Still needs:* `ignoreDownshift` on a
  DialogSwitch, applied at the wtnv apply-dialog position (before the zord hooks and the rules' own DialogSwitch
  downshifts), as for regA2's Inventor.
- **Delicate Stomach, Pincers, Quills, Serrated Tail (wtnv).** `createItem` can now build an item from inline data,
  but the old code builds a weapon AND its weaponEffect, the effect linked through `flags.essence20.parentId` to the
  weapon's id (made with `keepId`). `createItem` makes one item per step, and its data is cloned as written, so a
  second step can't put the first item's new id into `parentId`. The `createItem` hook (on a companion, for the
  dropping user) could be an `added` Trigger, and the Use's "only while the attack is missing" `canUse` has no rule
  form either (a Use limit counts uses, not granted items). *Still needs:* `createItem` making a linked weapon +
  effect pair (or `{var.granted.id}` in its data), and a Use gate on "an item this rule granted exists".
- **Replacement Teeth (wtnv).** `runUse` still runs only `pickAlly` before the cost (`PICK_FIRST`); a `target` step
  or `pick {from: target}` runs after the Standard action is paid. *Still needs:* a target check before a Use's cost
  (also slD's Lance of Light).
- **Staggering Sway (wtnv).** `dealtDamage` fires after the damage lands and sees only the dealer's own rules; the old
  code adds a +1 Stun note on the hit card (`damageBonusNote`) for anyone sharing a token disposition with a holder
  anywhere in the world. *Still needs:* a world-wide same-disposition scope for a dealt DamageModifier (note mode).
- **Dominate (r2misc).** `button` could post the Command / Recall buttons, but activation still runs through
  `power-use.mjs#onPowerUse` (infect on a Targeting test vs Evasion, refund the daily use with no target or a victim
  already held), and the victim is stored state read by those buttons. *Still needs:* power-activation hooks, stored
  victim state with a per-command cumulative ↓1, and range gates.
- **Shadow (fix3-dice).** `check:infiltrating` now exists, but the switch belongs on the ROLLER's dialog when the
  roller's target holds Shadow; DialogSwitch has no `incoming` scope (`defaultWhen` only evaluates the holder's own
  switches). The Infiltrating toggle Use in `banked-buffs.mjs` is shared with Silent Strider. *Still needs:* an
  incoming DialogSwitch (one on the target's item shown to the attacker), with `defaultWhen` for "non-attack Alertness".

#### Engine pieces the remaining skips need

- An incoming DialogSwitch with a conditional default (Shadow).
- `ignoreDownshift` on a DialogSwitch at a fixed point (Third Eye; also regA2's Inventor).
- A target check before a Use's cost (Replacement Teeth; also slD's Lance of Light).
- A creature-kind / regex target tag and a per-Skill `specialize` on a DialogSwitch (Dog Person).
- `createItem` building a linked weapon + weaponEffect pair, and a Use gate on "this rule's granted item exists" (the
  four pet attack Perks).
- A world-wide same-disposition scope for dealt damage notes (Staggering Sway).
- Power-activation hooks and stored victim state (Dominate).

#### Files touched outside the slices

- `packs/wtnvcgitems/_source/Obsessive_eOgtG24LKGR6OE0v.json` (2 rules inserted as text, LF kept).
- `module/rules/legacy-choices.mjs` (one `LEGACY` entry for Obsessive, appended at the end of the table).
- `lang/en.json` (two lines removed: `WtnvObsessionPrompt`, `WtnvObsessionSet`).
- `module/rules/conversions-uses.test.js` (one `describe('slE2 misc')` block appended at the end; the import line is
  unchanged - the legacy-choices helper is imported inside the test).
