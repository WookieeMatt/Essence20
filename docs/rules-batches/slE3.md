# Batch slE3: re-check of slE2's skips (qualification, data, MLP, Night Vale and misc slices) against the 2026-10-05 engine pieces

Slices: `qualify1`, `qualify2`, `data1`, `data21`, `data22`, `mlp1`, `mlp2`, `wtnv`, `r2misc`, `rules`, `fix3-dice`.

**Scope:** every item `docs/rules-batches/slE2.md` left Still skip (91) or Partial (8, the code half), re-checked against
"Engine features added 2026-10-05 (after slice round 2)" in `docs/RULES_CONVERSION_GUIDE.md`: the new durations
(`endOfNextTurn`, `turnOrScene`, `roundOrScene`, `rounds:N`, `untilOf`), watch Triggers, Reaction rules and their card
steps, button limits, dice / `@target` in step formulas and `{var.x}` in chat, `legacy` pick paths, `rule:granted` /
`item:granted`, and `createItem` `children`. Edited in place in the shared checkout (no branch).

| Verdict (re-checked items) | Count |
|---|---|
| Convert (was skip) | **6** |
| Convert (was partial) | **1** |
| Partial, nothing more converts | **7** |
| Still skip | **85** |
| Re-checked | **99** |

16 rules were added to 7 pack items (and the 3 existing Wheel Excited switches were re-pointed). After this batch
`scripts/check-rules.mjs` reports 1601 rules on 1089 items (with the other agents' work), 0 errors, 0 warnings. ESLint is
clean on every file touched; jest passes on all eleven slice folders and `module/rules/conv3-slE3.test.js` (17 suites,
128 tests).

## Converted (7)

| Item | Pack file | Rules | Removed |
|---|---|---|---|
| Delicate Stomach, Pincers, Quills, Serrated Tail (wtnv) | `wtnvcgitems/_source/<Name>_<id>.json` | Each: Trigger `{event: added, when: ["self:type:companion", "not:rule:granted:type:weapon"], steps: [createItem]}` and Use `{same when, steps: [same createItem]}`. The `createItem` builds the old weapon (sidearm, standard, equipped, no hardpoint, `traits` [] or ["trip"], `flags.essence20.natural`) with one `children` weaponEffect: Hairball 1 Acid Targeting/projectile 30/60 ft; Pincers 1 Blunt Might/melee reach 1; Quills 1 Sharp Targeting/projectile 30/60 ft; Serrated Tail 1 Sharp Might/melee reach 1 (Trip on the weapon); all `numTargets` 1, `numHands` "0". | `wtnv.mjs`: the four `WTNV` keys, `naturalAttack`, `PET_ATTACKS`, `grantPetAttack`, the `wtnvPetAttack` Use and the `createItem` hook. No old test covered them. |
| Screech (mlp2) | `sotsitems/_source/Screech_0OA0R7F3JejAQpkf.json` | Use `{when: ["not:rule:granted:type:weapon"], steps: [createItem]}`: weapon "Screech" (sidearm, standard, equipped, no hardpoint, natural) with a child weaponEffect, 1 Blunt, Targeting / energy, 30/60 ft, one target, `numHands` "0". Any actor, as before. | `mlp2.mjs`: `MLP2.screech` and the `mlp2Screech` Use. |
| Psycho Morpher (data21) | `fmmcitems/_source/Psycho_Morpher_EkBMS8Ih24UYBQ4R.json` | Six Uses, one per weapon list, each `when: ["not:rule:granted:type:weapon", <Path test>]` and steps `pick {key: weapon, from: list, options: [[uuid, name]...], prompt}` + `grant {uuid: "{choice.weapon}"}`. Path tests: `self:hasItem:<Path of Flame/Frost/Stone/Thorns/Venom uuid>`; the sixth ("Cruelty or no Path", all ten weapons) has `not:self:hasItem:` for all five. Lists and order are the old `KIT_WEAPONS` (Flame: Scythe, Sword, Trident; Frost: Axe, Blade; Stone: Axe, Blade, Bow, Staff; Thorns: Blaster, Bow, Slinger; Venom: Bow, Scythe, Staff, Slinger, Sword, Trident). | `psycho.mjs`: the Psycho Kit section (`HEAVY` ... `KIT_WEAPONS`, `ALL_PSYCHO_WEAPONS`, `kitWeaponsFor`, `usePsychoKit`, its `registerUse`) and the `registerUse` import; `common.mjs`: `psychoMorpher`, the six `path*` and ten `psycho*` keys; `data21.test.js`: "Psycho Kit weapons follow the Path" and its import. |
| Wheel Excited (mlp2, was partial) | `mlpcrbitems/_source/Wheel_Excited_nJP3Jv15O5MFTNcA.json` | New Use `{steps: [pick {key: vehicleType, from: list, options: land/sea/air with the `E20.Mlp2Vehicle.*` labels, prompt, legacy: "flags.essence20.vehicleType"}]}`; the three existing DialogSwitches now read `rule:data:flags.essence20.rules.choices.vehicleType=<type>`. | `mlp2.mjs`: `MLP2.wheelExcited` and the `mlp2Wheel` Use. |

Why they are exact:

- **The "only while missing" gate.** The old `canUse` (and the pets' hook) asked "does any item on this actor carry
  `grantedBy` = this Perk's id". Only the weapon ever carried it. `rule:granted:type:weapon` asks the same of the
  weapon, so an orphaned attack left behind doesn't hide the button, and weapons the OLD code made (same `grantedBy`
  flag, set by `grantPetAttack` / `mlp2Screech` / `grantCopy({grantedBy: item})`) count, so existing characters don't
  get a second copy. Both families are static (`rule:` / `self:`), so `useAvailable` tests them.
- **Pets: only on a companion.** The old Use `matches` and hook both required `item.parent.type == 'companion'`;
  `self:type:companion` is `actor.type == 'companion'`. The `added` Trigger runs from `rules/lifecycle.mjs#onCreateItem`
  for the creating user only - the same user check the old `createItem` hook made.
- **Psycho Morpher's Path.** `kitWeaponsFor` took the first `role` item whose source is a Path, else all ten.
  `self:hasItem:<uuid>` is the same source match; Cruelty's list is all ten, so it shares the "no Path" Use. With
  one Path exactly one Use is available, so `runUse` doesn't ask which. The `pick` step calls the same
  `grants.mjs#chooseSelect` with the item name as title, the same prompt and the weapon names; the `grant` step makes
  the copy with `grantedBy`, and brings the weapon's attached effects the same way `grantCopy` did.
- **Wheel Excited.** The picker offers the same three values with the same localized labels; re-pickable as before.
  Existing picks move from `flags.essence20.vehicleType` into `rules.choices.vehicleType` on the GM's linking pass
  (`legacy`), and `pick` reads the old flag too.

Tests: `module/rules/conv3-slE3.test.js` loads each pack item and checks the created weapon + attack data, the
once-only gate (adding again, the Use hidden, back once the weapon is gone), nothing on a non-companion, the Screech
data, each Path's offered weapons in order, the grant and its gate (old-style `grantedBy` weapons too), the Wheel
Excited pick, its switches, a cancelled pick and the legacy move. The attachment handler is mocked
(`jest.unstable_mockModule`) to record child attachment.

## Behaviour differences worth a decision

1. **Pets and Screech: the attack is now attached to its weapon (same line).** `createItem` `children` enter the
   attack in the weapon's `system.items` (with `collectionId`) and give it the Perk's `grantedBy`. So deleting the
   weapon from the sheet also deletes its attack, and removing the Perk removes both. Before, the attack was a loose
   item: it stayed behind as an orphan in both cases.
2. **Pets: a chat card on adding (same line).** Adding the Perk to a pet now posts "Granted" (the Trigger's chat);
   before it was silent. The Use cards read "<Perk>: Add the pet's X attack / Granted ..." instead of
   `E20.GrantGained`.
3. **Pets on a non-companion (same line, cosmetic).** The rule Use matches every holder; on a PC it is never
   available (`self:type:companion` false), so the action-perks Use button may show unavailable where there was none.
4. **Screech / pets: fixed weapon names (same line).** Screech's weapon was named after the Perk item (possibly
   renamed); it is now always "Screech". The pet attack names were already fixed.
5. **Psycho Morpher (same line).** The Use needs the gear equipped (rules on gear are inactive when `equipped` is
   false; gear defaults to equipped). An actor holding two Path roles now gets a "which Use" choice instead of the
   first Path's list. The pick is remembered on the item (`rules.choices.weapon`, harmless). The copy carries
   `_stats.compendiumSource` instead of `flags.core.sourceId` (every source lookup reads both). Chat text: the `pick` /
   `grant` lines instead of `E20.D21PsychoKitGranted`.
6. **Wheel Excited (same line).** Until the GM's linking pass has run, an old pick shows no switch; unlinked token
   actors (not in `game.actors`) lose an old pick once. Chat text is the `pick` step's line. Same as Obsessive in slE2.

## Still skipped (85), and what each still needs

### qualify1 (21)
- **Danger Sense** - an Initiative-formula reroll (`r<=2` in `system.initiative.formula`).
- **Ignite** - a per-target burning counter (stacking "fought" ↓), a turn-end roll for the marker against the marked
  creature's Evasion (watch Triggers act as the holder but no step rolls the holder's Skill against a recipient's
  Defense with a counter), and two buttons with their own action costs on one card.
- **Fireball** - goes with Ignite.
- **Addicted (Dark Energon)** - a resource-cost multiplier while craving, a d20 + recorded-die attack, a day counter.
- **Best-Laid Plans** - a Party reroll pool sized from a total, offered on members' cards (Reactions have no reroll step).
- **One Last Chance** - a reroll granted on an ally's failed card (Reaction `lateSnag` keeps the lower, not a reroll).
- **Nobility** - a Story Point New Session modifier.
- **Service, Trade Goods, For The Syndicate, Good To Go, Ninpõ JOEs** - a recorded compendium pick (with filters,
  several per key) read by a Qualification.
- **Nothing Personal** - an attach-a-compendium-upgrade-to-a-picked-weapon step.
- **Spared No Expense, Surgical Operators, Ultra-Secret Strike Force** - `vehicle:size` / `vehicle:data:` /
  `vehicle:name~` tags and an automatic "any Snag" lift.
- **The Glory of Cobra-La** - an attached-upgrade-by-id tag (weapon and worn armor) and the vehicle tags.
- **Roaming the Land** - a "has a melee / Reach effect" weapon tag for a Qualification.
- **Tenacity** - `roll:save` and a turn-start "end an expiring effect" step.
- **Dome Generator** - `@host.<path>` in a Defense rule and a limit pooled across copies.
- (Partials unchanged: **Nu, Pogodi!**'s weapon pick and seat swap; **Mega Training Regimen**'s driving Qualification.)

### qualify2 (16)
- **Upgrade Training** - a recording compendium picker (three picks, one tier) and a Qualification reading it.
- **Hardware Training** - two-handed and upgrade-trait tags.
- **Weapon Enthusiast (Perk / Hang-Up)** - a weapon-type tag; choice-filled `updateItem.set`; an Assist refuse that
  sets aside a banked Lend Assistance.
- **Training Evolution** - a mission-scoped pick over another actor's weapons / vehicles, read as a Qualification.
- **Mentor** - DerivedStat paths with `{choice.<key>}` and boolean writes.
- **At Ease, Disease** - a heal Skill Test step.
- **Destructive Overcharge, Cascading Failure** - delayed (turn-timed) button cards and a blast test around a point;
  the new durations time marks / banks / grants, not a card.
- **Opportunist** - an extend-Condition / Stun step.
- **Sensitive, Detail Oriented** - a cost on another item's daily counter and a round-scoped ignore the Snag bank reads.
- **Do Or Die** - adding a die to a posted check: `lowerTotal` only acts on rows that hit, and `convertRows` flips
  failures without rescoring against the new total; plus the Moxie cost that rises for a second use.
- **Wild Idea** - a DialogSwitch bonus pool die.
- **Timeline Anomaly** - a swap-Initiative step.
- **Everything is Inspiration** - a `sessionStart` Trigger.
- (Partials unchanged: **Whisper Warrior**'s upgrade-trait Qualification and Free Defend; **Oorah!**'s shared vehicle ↑1.)

### data1 + data21 (13)
- **Reinforced Shell** - static `rule:host:` tags and a dealt note with no damage value.
- **Over Brawn, The Heavy, Pack Mule** - an equipment-requirement Brawn rule.
- **Dino Thunder ×4** - picks read across items / actors, a single-use pool with fallback, a custom-hook step.
- **Stinger Spray (Perk)** - removing a granted weapon's attached effects with it (a Grant's children don't carry
  `grantedBy`; only `createItem` children do), or an item-removed Trigger.
- **Stinger Spray (attacks)** - a preRoll per-attack cost that warns instead of refusing.
- **Larger Than Life** - `@other.<path>` in ItemModifier and "leave a missing value alone".
- **Sky Morpher** - a "driving own Zord" tag and counting unequipped gear.
- **Alternate Officer** - an actor-field write step and a recorded compendium pick for a Qualification.

### data22 + mlp1 + mlp2 (29)
- **Data-Link** - a "companion drone not commanded this round" tag.
- **Transmetal** - a post-gravity Movement stage, a movement type from `system.choice`, formula comparisons.
- **Fresh Mark, Natural Style** - per-creature memory on the holder (a mark keeps one setter per key, and these never expire).
- **Smoke Screen, Smoke Bomb** - a canvas-point step, recipients around it, positional roll sources.
- **Assault Claw** - moves only with `rules/grappled.mjs`.
- **Demolecularization Gun, Waterrunning** - marks that carry their own rule.
- **Primeon Blade** - per-megaform-member buttons.
- **Shape-Shift / Face-Shift / Master Morph / Size-Shift (Use), Face-Shift and Master Morph (sources)** - a multi-pick
  dialog with a size write and undo; `skill:data:<path>`.
- **Brilliant Sight, Illusion Casting, Reach Out, Extra Effective Spell, Long Lasting Spell, Mystical Understanding** -
  a SpellCost rule (plus actor writes for Mystical Understanding).
- **Far-Sighted** - an equipped non-melee weapon tag.
- **Pinkie Sense** - a d8 step could roll, but nothing maps the result to a table row's text (no var test in step
  `when`), and the old post is a real Roll message.
- **Softenblows** - `untilOf: recipient` now covers the duration, but the effect is "the marked creature's hits deal
  nothing" for any hit it makes: no automatic outgoing-damage negation on a marked attacker (a Reaction is a button
  press, and `negateHit` also spends crit and rider buttons).
- **Sharpcaster, Sorcerous Support** - a free re-cast / re-roll of a card (Reactions have no reroll).
- **Friendship Is Mystical** - writes to the friend's helper flags and a capped heal.
- **Reactionary** - an Initiative re-roll step.
- **Thick Skin** - an Active-Effect toggle step.
- **Something Is Off** - an incoming DialogSwitch.
- (Partials unchanged: **Prize Honey** - a formula default for `updateItem` on a missing flag and a heal capped the
  old way; **Basic Shape-Shifting / Ponymorph** - the shape write stays with the shared `mlpShape` flag.)

### wtnv + r2misc + fix3-dice (6)
- **Dog Person** - a creature-kind / regex target tag and a per-Skill `specialize` on a DialogSwitch.
- **Third Eye** - `ignoreDownshift` on a DialogSwitch at the wtnv apply-dialog point.
- **Replacement Teeth** - a target check before the Use's cost (`PICK_FIRST` is still only `pickAlly`).
- **Staggering Sway** - a watch `dealtDamage` Trigger fires after the damage lands and needs the holder on the canvas;
  the old code adds a +1 Stun note to the hit card for any same-disposition holder in the world.
- **Dominate** - power-activation hooks and stored victim state.
- **Shadow** - an incoming DialogSwitch with a conditional default.

## Edits outside my files

None.

## Unused strings

`lang/en.json` keys no longer used by any code: `E20.D21PsychoKitGranted`, `E20.D21PsychoKitPrompt`,
`E20.Mlp2PickVehicle`, `E20.Mlp2WheelSet`. (`E20.Mlp2Vehicle.land/sea/air` stay: the Wheel Excited pick's option labels.)

## Rule count

16 rules added (8 on the four pet Perks, 1 on Screech, 6 on Psycho Morpher, 1 on Wheel Excited); 3 existing Wheel
Excited rules changed.
