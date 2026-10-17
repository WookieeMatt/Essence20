# Batch slE6: re-check of slE5's skips (qualification, data, MLP, Night Vale and misc slices) against the round-6 engine pieces

Slices: `qualify1`, `qualify2`, `data1`, `data21`, `data22`, `mlp1`, `mlp2`, `wtnv`, `r2misc`, `rules`, `fix3-dice`.

**Scope:** every item `docs/rules-batches/slE5.md` left Still skip (74) or Partial (6: Nu, Pogodi!, The Glory of Cobra-La,
Whisper Warrior, Oorah!, Prize Honey, Basic Shape-Shifting / Ponymorph), re-checked against "Engine features added 2026-10-06
(round 6, after the local round-5 conversions)" in `docs/RULES_CONVERSION_GUIDE.md` (`target:self`, `status:<id>:timed`,
`wielding:a&b`, upgrade-aware `item:trait`, `item:hasUpgrade`, `rule:hostEquipped`, `combat:enemyStatus|allyStatus`,
`roll:fumble` + damage type in Reactions, `@recipient`, `nextTurnOrScene`, `worldTime:N`, `combatAllies`,
`alliesOfTarget|enemiesOfTarget`, `mark exclusive`, GM-relayed `applyCondition` rounds, i18n `table` rows, `team` scope,
Movement `afterDerived` + `round`, afterRoll `@var.dif`, open rolls reaching outcome `any`, `notDouble`) and the earlier
sections once more. Edited in place in the shared checkout (no branch, no commit).

| Verdict (re-checked items) | Count |
|---|---|
| Convert (was skip) | **3** |
| Convert (was partial - the code half is gone now) | **1** |
| Partial, more converted (still partial) | **1** |
| Partial, nothing more converts | **4** |
| Still skip | **71** |
| Re-checked | **80** |

8 rules were added to 5 pack items. After this batch `scripts/check-rules.mjs` reports 1826 rules on 1151 items (with the
other agents' work), 0 errors, 0 warnings. ESLint (`--ext .js,.mjs`) is clean on every file touched; jest passes on all eleven
slice folders, `module/rules/conv5-slE5.test.js` and the new `module/rules/conv6-slE6.test.js` (15 tests); the whole of
`module/rules` (1541 tests) and `module/helpers` (5669 tests) pass too.

## Converted (5)

| Item | Pack file | Rules | Removed |
|---|---|---|---|
| Opportunist (qualify2) | `tfcrbitems/_source/Opportunist_8JpfjvHVDHWKjMc9.json` | Trigger `hit`, `when: [attack, {any: [target:status:stunned, target:data:system.stun.value>0]}]`: `extendCondition stunned +1 round` (a timed one only); `updateActor system.stun.value +1` when `not:target:status:stunned:timed` and Stun damage > 0; a chat line when it isn't timed. | `field-ops.mjs`: the Opportunist section (`isStunned`, `opportunistPostRoll`), its `registerPostRoll` and the import; `common.mjs`: `Q2.opportunist`; `qualify2.test.js`: "Opportunist extends Stun on a hit" (+ imports). |
| Whisper Warrior (qualify2, was partial) | `iafav2items/_source/Whisper_Warrior_T4p7oPq8Kk0SHVb3.json` | Qualification `qualified`, items `[item:type:weapon, item:trait:martialArts, item:trait:silent]`; ActionCost `defend -> free`, `when: [self:wielding:weapon:trait:martialArts&weapon:trait:silent]`. (Its Use was already a rule.) | `qualifications.mjs`: `isSilentMartialArts`, the Whisper branch of `perkAccess`, `wieldsSilentMartialArts`, `WHISPER_WARRIOR_RULE`, `registerCostRule(...)` and the import; `common.mjs`: `Q2.whisperWarrior`; `qualify2.test.js`: "Whisper Warrior needs both Martial Arts and Silent", the "Whisper Warrior Defend" describe; the registration test now asserts `q2WhisperWarrior` is gone. |
| The Glory of Cobra-La - weapon Snag (qualify1, still partial) | `fffav1items/_source/The_Glory_of_Cobra_La_VAhtHpKlv4gsR0OY.json` | RollModifier `snag`, `when: [attack, item:type:weaponEffect, not:attack:unarmed, not:weapon:trait:biomechanical, not:weapon:name~biomech, not:weapon:name~bio-mech, not:weapon:name~cobra-la, not:item:hasUpgrade:<Biomechanical Weapon uuid>]`. The battledress Snag stays code. | `qualification.mjs`: `isBiomechanicalWeapon` and the weapon block of `qualificationSources` (now `qualificationSources(actor)`); `common.mjs`: `Q1_UPGRADE.biomechanicalWeapon`; `qualify1.test.js`: "Cobra-La snag on non-biomechanical weapons". |
| Dome Generator (qualify1) | `gijcrbitems/_source/Dome_Generator_rrJ1kpQfk0627aJq.json` | Use, cost Free, `limit {per: scene, max: 1}`, `when: [rule:hostEquipped]`: `mark domeGenerator on self, until nextTurnOrScene` + a chat line; two Defense rules (Toughness / Evasion) `max(0, @host.system.totalBonusToughness / Evasion)`, `stack` per Defense, `when: [self:marked:domeGenerator, rule:hostEquipped, not:self:morphed]`. | `misc.mjs`: the Dome Generator section (`DOME_FLAG`, `DOME_USES`, `domeArmor`, `domeCopies`, `untilStartOfNextTurn`, `domeLive`, `domeDerived`, `DOME_USE`), their registrations, the `registerDerived` / scene-clock / `idOf` imports; `common.mjs`: `Q1.domeGenerator`; `index.mjs` header; `qualify1.test.js`: "Dome Generator doubles the armor bonus" (+ import) and `q1DomeGenerator` from the registration test. |
| Pinkie Sense (mlp1) | `kocitems/_source/Pinkie_Sense_hER4hs3jrIHM8gF3.json` | Trigger `afterRoll`, outcome `success`, `when: [item:own]`: `table 1d8`, rows 1-8 with text `E20.Mlp1Pinkie.1` ... `E20.Mlp1Pinkie.8` (the existing lang keys - no book text in the pack). | `mlp1.mjs`: `PINKIE_ROWS`, the Pinkie Sense block of `mlp1PostRoll`, `MLP1.pinkieSense`, header line. No old test covered it. |

Why they are exact:

- **Opportunist.** Old: a postRoll hook on an attack; for each hit target that is Stunned (the status, or Stun damage > 0):
  a Stunned effect with a round count gets +1 round, else Stun damage > 0 gets +1, then a chat line. The `hit` Trigger fires
  per hit target (`attack` = a weapon-effect roll, the same `isAttack` the other converted attack Triggers use);
  `extendCondition` only touches a timed Stunned; the Stun-damage step runs only when there is no timed Stunned
  (`status:stunned:timed`, new this round) - the old either/or.
- **Whisper Warrior.** The Qualification reads the weapon's traits plus what upgrades add (the old `itemAndUpgradeTraits ??
  traits`); the Defend rule is the old cost rule (`key == 'defend'`, to `free`) gated on an equipped weapon carrying both
  traits (compound `wielding`, new this round).
- **Cobra-La weapon Snag.** Old: on a weapon-effect attack whose weapon exists, Snag unless the weapon's name matches
  `/bio-?mech|cobra-la/i`, it has the Biomechanical trait, or the Biomechanical Weapon upgrade (`_id 7qniIaOGp8Mqwt6O`, printed
  only in Ferocious Fighters) is attached. `item:hasUpgrade` (new) checks attached upgrades on the effect's weapon; unarmed
  attacks are left out as before.
- **Dome Generator.** Old: per-upgrade Use, usable while the host armor is equipped and fewer uses this scene than Dome
  copies on that armor; Free action; then the armor's Toughness / Evasion bonus (if > 0) is added again until the start of the
  holder's next turn (out of combat: the scene), not while Morphed. Now each copy carries its own once-a-scene Use (N copies on
  the battledress = N uses a scene); `nextTurnOrScene` (new) is that duration; `rule:hostEquipped` (new) is the equipped test;
  `@host` reads the armor's bonus; one `stack` group per Defense keeps two active copies from doubling twice.
- **Pinkie Sense.** Old: a successful cast of the spell rolls 1d8 and posts the `E20.Mlp1Pinkie.<n>` row. The `table` step's
  row text may now be an i18n key (new), so the rows are the same lang keys.

Tests (`module/rules/conv6-slE6.test.js`, loading each pack item): Opportunist's Stun-damage +1, timed Stunned +1 round (Stun
damage left alone), untimed-only note, no change when not Stunned / not an attack / no Perk; Whisper Warrior's Qualification
(both traits, upgrade traits count, one trait not enough, no Perk), Free Defend only with an equipped Silent Martial Arts weapon;
Cobra-La's Snag with a plain weapon, none with the trait / each name form / the upgrade / unarmed / a non-attack; Dome
Generator's doubling, once per copy per scene, two copies doubling once, unequipped and Morphed, and the end at the holder's
next turn in combat; Pinkie Sense's row on a success, nothing on a failure or another spell.

## Behaviour differences worth a decision

1. **Opportunist (same line, presentation / edge).** The timed branch posts the rules' generic "Condition extended" line
   instead of the old one; every hit's lines come on one card titled by the rule. Writes to an enemy now go through the GM
   relay (the old code wrote directly, which a player can't). With two Stunned effects on one creature, the first one is the
   one extended (the old code looked for the first timed one) - both only when something stacks two Stunned effects.
2. **Whisper Warrior (same line, edge).** "Wielding" needs one of the weapon's attacks on the sheet (a weapon with no attack
   Items doesn't count). The Free Defend option's label is the rule's.
3. **Cobra-La weapon Snag (same line, small).** `weapon:trait:` also reads traits an attached upgrade adds, so an upgrade
   granting the Biomechanical trait now lifts the Snag (the old code read only the weapon's own `system.traits`). A weapon effect
   whose weapon is missing from the actor now takes the Snag (the old code treated it as natural). The Biomechanical Weapon
   upgrade is matched by its compendium uuid rather than its bare `_id` (it has one printing).
4. **Dome Generator (same line).** (a) Uses are counted per copy, not pooled: with copies spread over several battledress, the
   old pool (uses < copies on the armor used) differs - with all copies on the worn armor, as normal, it's the same. (b) Used
   before the holder's own turn in a round, it now ends when that turn starts; the old code always ran to the holder's turn in
   the next round (a Free action is normally taken on your own turn, where both agree). (c) In combat a scene change no longer
   ends it early. (d) It doubles the bonus of whichever worn armor carries a marked copy, rather than the armor it was pressed
   on (only one battledress is worn at a time). (e) Its button shows for an unequipped host only as unavailable, like any Use;
   the chat line is the rule's.
5. **Pinkie Sense (same line, presentation).** The d8 is shown in the rule card's chat line with the row, not as a Roll
   message (no dice animation / roll tooltip).
6. **slE5's Replacement Teeth difference is gone:** a player's pet clamping an enemy they don't own now keeps the 1-round
   duration through the GM (round 6's GM-relayed `applyCondition` keeps `rounds`) - no rule change needed. slE5's other
   recorded differences are unchanged (no new piece touches them).

## Still skipped (71), and what each still needs

The items the round-6 pieces were expected to unblock, re-checked:

- **Opportunist, Dome Generator, Pinkie Sense, Whisper Warrior** - converted (above). **Cobra-La's weapon Snag** - converted.
- **The Glory of Cobra-La's battledress Snag** - still code: no tag asks "an equipped armor matching these item tags" (Organic
  Armor attached via `item:hasUpgrade`, a Cobra-La name); `self:wearing:` reads only the armor class. Its label also names the
  armor.
- **Hardware Training** - `item:trait:ballistic` and the base-Availability test (`item:data:system.availability=...`) are
  there, but nothing asks "the weapon has a two-handed attack" (numHands lives on the weapon's attacks / entries).
- **Roaming the Land** - the energized traits are `item:trait:` tags now, but "the weapon has a melee or Reach attack" isn't.
- **Weapon Enthusiast (Perk / Hang-Up)** - a weapon-type tag (the old flag / trait / name matching), the choice-filled tag,
  and the Hang-Up's set-aside of banked Lend Assistance.

### qualify1 (15)
- **Danger Sense** - an Initiative-formula reroll.
- **Ignite**, **Fireball** - the turn-end attack at the burning creature's turn, hit-card note, two action-costed buttons.
- **Addicted (Dark Energon)** - a resource-cost multiplier while craving, a d20 + recorded-die attack, a day counter.
- **Best-Laid Plans**, **One Last Chance** - reroll offers on any roll card, pressed by the roller, pooled per Party.
- **Nobility** - a Story Point New Session modifier.
- **Service, Trade Goods, For The Syndicate, Good To Go, Ninpõ JOEs** - a recorded compendium pick read by a Qualification.
- **Nothing Personal** - attach a compendium upgrade to a picked weapon.
- **Roaming the Land** - see above.
- **Tenacity** - `roll:save` and a turn-start "end what expires this turn" step.
- (Partials: **Nu, Pogodi!**'s weapon pick and seat swap - unchanged; **The Glory of Cobra-La**'s battledress Snag - see above.)

### qualify2 (13)
- **Upgrade Training** - a recording compendium picker read by a Qualification.
- **Hardware Training** - see above.
- **Weapon Enthusiast (Perk / Hang-Up)** - see above.
- **Training Evolution** - a mission-scoped pick over another actor's weapons / vehicles, read as a Qualification.
- **Destructive Overcharge, Cascading Failure** - delayed button cards and a blast test around a point.
- **Sensitive, Detail Oriented** - a cost on another item's daily counter and a round-scoped ignore of the banked Snag.
- **Do Or Die** - add a die to a posted check; a Moxie cost that rises on a second use.
- **Wild Idea** - a DialogSwitch bonus pool die.
- **Timeline Anomaly** - a swap-Initiative step (the swap itself lives outside this slice; `writeInitiative` can't read the
  other combatant's Initiative).
- **Everything is Inspiration** - a `sessionStart` Trigger.
- (Partial unchanged: **Oorah!** - its shared vehicle ↑1 is in `dice.mjs`.)

### data1 + data21 (12)
- **Reinforced Shell** - static `rule:host:` tags and a dealt note with no damage value.
- **Over Brawn, The Heavy, Pack Mule** - an equipment-requirement Brawn rule.
- **Dino Thunder ×4** - picks read across items / actors, a single-use pool with fallback, a custom-hook step.
- **Stinger Spray (attacks)** - a preRoll per-attack cost that warns instead of refusing.
- **Larger Than Life** - `@other.<path>` in ItemModifier and "leave a missing value alone".
- **Sky Morpher** - a "driving your own Zord" tag and counting unequipped gear.
- **Alternate Officer** - a recorded compendium pick (a Limited melee weapon) read as Qualified.

### data22 + mlp1 + mlp2 (26)
- **Data-Link** - a "companion drone not commanded this round" tag.
- **Fresh Mark, Natural Style** - per-creature memory on the holder (a mark on each creature would be overwritten by a second
  holder's mark under the same key, and would write to every NPC).
- **Smoke Screen, Smoke Bomb** - a canvas-point step, recipients around it, positional roll sources.
- **Assault Claw** - moves only with `rules/grappled.mjs`.
- **Demolecularization Gun, Waterrunning** - marks that carry their own rule onto the marked creature's rolls.
- **Primeon Blade** - per-megaform-member buttons.
- **Shape-Shift / Face-Shift / Master Morph / Size-Shift (Use), Face-Shift and Master Morph (sources)** - a multi-pick shape
  dialog with a size write and undo.
- **Brilliant Sight, Illusion Casting, Reach Out, Extra Effective Spell, Long Lasting Spell, Mystical Understanding** - a
  SpellCost rule (Mystical Understanding also runs Magically Fit In's picker and a per-day Essence counter).
- **Softenblows** - automatic outgoing-damage negation on a marked attacker's hits.
- **Sharpcaster, Sorcerous Support** - a free re-cast step; reroll offers on another actor's Fumble card.
- **Friendship Is Mystical** - a three-way choice whose Magically Fit In branch needs `magicallyFitInValue`, and a heal capped
  by the Mystical Points held.
- **Reactionary** - an Initiative re-roll step.
- **Thick Skin** - an Active-Effect enable / disable step.
- **Something Is Off** - an incoming DialogSwitch.
- (Partials unchanged: **Prize Honey** - a formula default for `updateItem` on a missing flag and the old cap; **Basic
  Shape-Shifting / Ponymorph** - the shape write stays with the shared `mlpShape` flag.)

### wtnv + r2misc + fix3-dice (5)
- **Dog Person** - a creature-kind / regex target tag and a per-Skill `specialize` on a DialogSwitch.
- **Third Eye** - `ignoreDownshift` on a DialogSwitch.
- **Staggering Sway** - a watcher's note on the hit card before damage lands, holder anywhere in the world.
- **Dominate** - power-activation hooks and stored victim state.
- **Shadow** - an incoming DialogSwitch with a conditional default.

## Edits outside my files

None.

## Unused strings

`lang/en.json` keys no longer used by any code: `E20.Q2OpportunistExtended`, `E20.Q1DomeLabel`, `E20.Q1DomeUsed`,
`E20.Mlp1PinkieSense`. (`E20.Mlp1Pinkie.1` ... `.8` are still used - by Pinkie Sense's `table` rows.)

## Rule count

8 rules added: 1 Trigger on Opportunist; 2 on Whisper Warrior (Qualification, ActionCost); 1 RollModifier on The Glory of
Cobra-La; 3 on Dome Generator (Use + 2 Defense); 1 Trigger on Pinkie Sense.

## Engine pieces the remaining skips need (most useful first)

1. **Recorded compendium pick read by a Qualification** (a pickGrant-style browser that records the pick - several per key,
   with filters - and a Qualification `items` tag `item:pickedSource:<key>` matching any printing of it). Unblocks Service,
   Trade Goods, For The Syndicate, Good To Go, Ninpõ JOEs, Upgrade Training, Training Evolution, Alternate Officer. Medium.
2. **Weapon-shape item tag** `item:hasAttack:<tags>` (some attack of the weapon - owned weaponEffects or its stored entries -
   matches: `classification.style=melee`, `range.reachMultiplier>0`, `numHands=2`). Unblocks Hardware Training and Roaming the
   Land outright; with a weapon-type tag and a choice-filled tag, part of Weapon Enthusiast. Small.
3. **Equipped-item tag** `self:wearingItem:<item tags>` (an equipped armor matching item tags, `item:hasUpgrade` included) and
   `{wearing}` in labels. Unblocks The Glory of Cobra-La's battledress Snag (completing the item). Small.
4. **Reroll offers on any roll card, pressed by the roller** (any roll message, a pool sized by a formula and shared by a
   Party, posting a fresh card). Unblocks Best-Laid Plans, One Last Chance, Sorcerous Support (and Do Or Die with an "add a die"
   mode). Medium.
5. **SpellCost rule** (cast-dialog checkboxes: set / add / multiply the cost, plus a "re-cast free" step). Unblocks Brilliant
   Sight, Illusion Casting, Reach Out, Extra Effective Spell, Long Lasting Spell, Sharpcaster, part of Mystical Understanding.
   Medium.
6. **Incoming DialogSwitch** (on the roller's dialog, from the target's item) with a conditional default. Unblocks Something
   Is Off, Shadow. Medium.
7. **Marks that carry rules** (the marked creature gets rules from the setter's item while marked) + a roll step against a
   recipient's Defense with a formula downshift. Unblocks Waterrunning, Demolecularization Gun, Softenblows (with outgoing
   negate-damage), Ignite + Fireball. Medium-large.
8. **Initiative steps** (re-roll / swap with another combatant / formula reroll). Unblocks Danger Sense, Reactionary, Timeline
   Anomaly. Medium.
9. **Per-creature memory on the holder** (a keyed set of creatures, optionally scene-stamped, tags `target:remembered:<key>`).
   Unblocks Fresh Mark, Natural Style. Small.
10. **Canvas-point step + recipients around a point + delayed button cards.** Unblocks Smoke Screen, Smoke Bomb, Destructive
    Overcharge, Cascading Failure. Medium.
11. **Equipment requirement rule** (Brawn offset / ignore). Unblocks Over Brawn, The Heavy, Pack Mule. Small.
12. **`roll:save` tag + "end an effect expiring this turn" step.** Unblocks Tenacity. Small.
13. **Hit-card note for a watcher before damage lands** (holder anywhere in the world). Unblocks Staggering Sway. Medium.
14. **Smaller one-offs:** `@other.` in ItemModifier (Larger Than Life); `ignoreDownshift` / per-Skill `specialize` on a
    DialogSwitch (Third Eye, Dog Person); a preRoll cost that warns (Stinger Spray attacks); an Active-Effect toggle step
    (Thick Skin); `sessionStart` Trigger and a New Session modifier (Everything is Inspiration, Nobility); a cost on another
    item's daily counter (Sensitive, Detail Oriented); a DialogSwitch bonus pool die (Wild Idea); a weapon-type tag and the
    Hang-Up's Assist set-aside (Weapon Enthusiast). Small each.
15. **Effectively permanent code** (bespoke UI or whole subsystems): Shape-Shift / Face-Shift / Master Morph / Size-Shift and
    Basic Shape-Shifting / Ponymorph's shape half, Dino Thunder ×4, Dominate, Addicted (Dark Energon), Primeon Blade, Assault
    Claw (`rules/grappled.mjs`), Data-Link, Sky Morpher, Reinforced Shell, Friendship Is Mystical, Prize Honey's half, Nothing
    Personal, Nu, Pogodi!'s half, Oorah!'s half (in `dice.mjs`).
