# Batch slE7: re-check of slE6's skips (qualification, data, MLP, Night Vale and misc slices) against the round-7 engine pieces

Slices: `qualify1`, `qualify2`, `data1`, `data21`, `data22`, `mlp1`, `mlp2`, `wtnv`, `r2misc`, `rules`, `fix3-dice`.

**Scope:** every item `docs/rules-batches/slE6.md` left Still skip (71) or Partial (5: Nu, Pogodi!, The Glory of Cobra-La,
Oorah!, Prize Honey, Basic Shape-Shifting / Ponymorph), re-checked against "Engine features added 2026-10-06 (round 7, after
the local round-6 conversions)" in `docs/RULES_CONVERSION_GUIDE.md` (`self:onCanvas`, `self:itemCount`, `self:actionUsed`,
`self:wearingItem`, `hasItem:name~`, `item:word`, `item:hasAttack`, `roll:targets` / `@var.targets`, `host:` at roll time,
`combat:enemy|ally:<tags>`, `dice(count, faces)`, `@count.items|equipped`, `endOfNextTurnOrScene`, `turnOrUntilCombat`,
`to: partyActor`, `choose` option `when` + `auto`, `pick` skill `essence` / `specializedOnly`, `pick from: team`, `pick auto`,
`pickGrant fields|replace`, `difDefenseSelf`, `button whisper|usedWhenDone`, the clicker's selected token, `sessionStart`,
`resourceSpent` filtering, the `worldTime` sweep) and the earlier sections once more. slE5's and slE6's recorded behaviour
differences were looked at again: no round-7 piece removes one. Edited in place in the shared checkout (no branch, no commit).

| Verdict (re-checked items) | Count |
|---|---|
| Convert (was skip) | **4** |
| Convert (was partial - the code half is gone now) | **1** |
| Partial, nothing more converts | **4** |
| Still skip | **67** |
| Re-checked | **76** |

6 rules were added to 5 pack items. After this batch `scripts/check-rules.mjs` reports 1871 rules on 1166 items (with the
other agents' work), 0 errors, 0 warnings. ESLint (`--ext .js,.mjs`) is clean on every file touched; jest passes on all eleven
slice folders and the whole of `module/rules` (57 suites, 1713 tests), including the new `module/rules/conv7-slE7.test.js`
(11 tests).

## Converted (5)

| Item | Pack file | Rules | Removed |
|---|---|---|---|
| Hardware Training (qualify2) | `eocitems/_source/Hardware_Training_6Ov5odRU8tGhQJzu.json` | Qualification `qualified`, items `[item:type:weapon, item:trait:ballistic, item:hasAttack:item:data:system.numHands=2, {any: [no base availability, or base availability automatic / standard / limited / restricted]}]`; Use: `pickGrant` from weapons of Standard / Limited / Restricted Availability with tags `[item:trait:ballistic, item:hasAttack:item:data:system.numHands=2]`, `flags: {qualified: true}`. | `qualifications.mjs`: `isTwoHanded`, `isHardwareWeapon`, the Hardware branch of `perkAccess`, its `USES` entry, `takeQualified` (now unused); `common.mjs`: `Q2.hardwareTraining`; `qualify2.test.js`: "Hardware Training: Restricted two-handed ballistic" (+ import). |
| Roaming the Land - its Training (qualify1) | `fffav1items/_source/Roaming_the_Land_jdQFjlYUHaRze6as.json` | Qualification `trained`, items `[item:type:weapon, {any: [item:hasAttack:...classification.style=melee, item:hasAttack:...range.reachMultiplier>0]}, {any: [item:trait:energy / electric / laser / fire / ice / plasma / element / sonic / radiant]}]` (appended to its two existing rules). | `qualification.mjs`: `traitsOf`, `ENERGIZED_TRAITS`, `isMeleeWeapon`, the weapon block of `perkAccess`; `common.mjs`: `Q1.roamingTheLand`. No old test covered it. (Its "larger creatures" Stun half lives in `dice.mjs`, outside these slices.) |
| The Glory of Cobra-La - battledress Snag (qualify1, was partial) | `fffav1items/_source/The_Glory_of_Cobra_La_VAhtHpKlv4gsR0OY.json` | RollModifier `snag`, `when: [not:roll:initiative, self:wearingItem:item:type:armor&not:item:name~biomech&not:item:name~bio-mech&not:item:name~cobra-la&not:item:hasUpgrade:<Organic Armor uuid>&not:item:hasUpgrade:name~organic armor]`. The item has no slice code left. | `qualification.mjs`: `BIOMECHANICAL_NAME`, `isBiomechanicalArmor`, `nonBiomechanicalArmorWorn`, `qualificationSources`, `registerRollSources(qualificationSources)`, the `registerRollSources` / `idOf` / `itemFrom` / `Q1_UPGRADE` imports; `common.mjs`: `Q1.gloryOfCobraLa`, `Q1_UPGRADE.organicArmor`; `qualify1.test.js`: the "The Glory of Cobra-La" describe (+ imports; the `itemsFrom` test now uses the Silencer id). |
| Everything is Inspiration - session half (qualify2) | `wtnvcgitems/_source/Everything_is_Inspiration_c1gIi1A6MKHkOwdy.json` | Trigger `sessionStart`, `when: [self:type:playerCharacter]`: `gainResource {storyPoints: true} 1` + a chat line. (Its once-per-encounter fail grant lives in `dice.mjs`, outside these slices.) | `session.mjs`: the holder loop, the `requestStoryPointGrant` calls and the summary chat line in `startNewSession`, its doc comment, the `escape` / `has` / `T` imports; `common.mjs`: `Q2.everythingIsInspiration`; `qualify2.test.js`: the session test no longer expects the grant (it used the Perk only as a holder). |
| Nobility (qualify1) | `fgtaaitems/_source/Nobility_gdWzwO7FpX9QOFQF.json` | Trigger `sessionStart`: `updateActor {to: partyActor, add: {system.storyPoints: -1}, min: 0}` + a chat line. | `misc.mjs`: the Nobility section (`nobilityPenalty`, `onPartyPreUpdate`) and its call in the `preUpdateActor` hook; `common.mjs`: `Q1.nobility`; `index.mjs` header; `qualify1.test.js`: "Nobility trims the session reset" (+ imports). |

Why they are exact:

- **Hardware Training.** Old: a weapon whose traits (`itemAndUpgradeTraits ?? traits`) include Ballistic, with some attack
  (owned weaponEffects, else the stored entries) at `numHands` 2, and a base `system.availability` of Restricted or lower (a
  missing one read as Standard) is Qualified. `item:hasAttack` (new) reads the attacks the same way (owned first, else stored);
  `numHands=2` matches the number or the string; the base-tier list is `atMost(..., 'restricted')`. The Use is the old
  `takeQualified`: the same `findItems` filter (type, availabilities, the same two tests on each index entry), `pickOne`
  titled by the Perk, `grantCopy` with `grantedBy` the Perk and `flags.qualified` - no action cost, no limit, as before.
- **Roaming the Land.** Old: Trained in a weapon with some attack that is melee or has a Reach multiplier, and an energized
  trait from the list. Same attacks (`item:hasAttack`), same trait list.
- **Cobra-La battledress.** Old: a roll source on every roll that reaches the rider sources while the holder has an equipped
  `armor` that isn't Biomechanical - its name matching `/bio-?mech|cobra-la/i`, or an attached upgrade from Organic Armor's
  compendium entry or named "Organic Armor". `self:wearingItem` (new) asks each equipped armor with `&`-joined tags;
  `item:hasUpgrade` checks the attached upgrades. RollModifiers also reach Initiative (dice.mjs `prepareInitiativeRoll`), which
  the old roll source never did, hence `not:roll:initiative`.
- **Everything is Inspiration.** Old: when New Session bumps the session counter, each Player Character holding the Perk
  asks for 1 Story Point (`requestStoryPointGrant`, the players' pool). The `sessionStart` Trigger fires on that same counter
  bump for every world actor; `gainResource {storyPoints}` makes the same grant call with `poolFor(actor)` (the players' pool
  for a Player Character) and the pool's own "granted" announcement.
- **Nobility.** Old: the New Session reset of the primary Party was trimmed by 1 for each roster member holding the Hang-Up,
  never below 0. Now each holder's `sessionStart` takes 1 from the Party it is on (`partyActor`: the primary Party first),
  never below 0 - the same total, since the reset sets the pool to the roster size, which is at least the number of holders.

Tests (`module/rules/conv7-slE7.test.js`, loading each pack item): Hardware Training's Qualification (Restricted / Limited /
no-tier two-handed Ballistic yes; one-handed, no hands, Prototype, not Ballistic, no Perk no; an owned weapon read through its
attack items) and its Use (the `findItems` filter's type, tiers and per-entry tests, the grant with `qualified` and
`grantedBy`); Roaming the Land's training (melee + Fire, Reach + Laser, Element yes; ranged, no energy trait, no Perk no);
Cobra-La's battledress Snag (plain worn armor on any Skill Test; none with Organic Armor by source, renamed, by name only, a
Cobra-La / Bio-Mech / Biomech name, unworn armor, a worn shield, on Initiative; an Organic Armor on other gear doesn't lift
it); Everything is Inspiration's grant (a PC holder only, only on `sessionStart`); Nobility (1 per holder, floor 0, nothing
off the roster or on another event).

## Behaviour differences worth a decision

1. **Hardware Training (same line, presentation).** The Use posts the rules' "Granted" line instead of "takes X (Qualified - no
   Requisition needed)"; its button label is the rule's. A weapon whose stored base Availability is an empty string now counts
   as untiered (Qualified) rather than unknown (not) - no compendium weapon has one.
2. **Roaming the Land (same line, small).** `item:trait:` also reads traits an attached upgrade adds (the old code read only
   `system.traits` - its `totalTraits` field doesn't exist), so an upgrade adding Fire / Laser... makes a melee weapon
   energized. An owned weapon with no attack items now falls back to its stored entries (the old code then found none).
3. **Cobra-La battledress (same line, presentation / edge).** The Roll Options Dialog source is labelled "Wearing
   non-Biomechanical battledress (The Glory of Cobra-La: Snag)" rather than "The Glory of Cobra-La (<armor name>)". Organic
   Armor is matched by its one printing's uuid (the old code matched the bare `_id` in any pack - it has one printing) or by name.
4. **Everything is Inspiration (same line, presentation).** One rule card per holder ("<name> adds a Story Point...") instead of
   one summary line naming them all; the pool's own grant announcement is unchanged.
5. **Nobility (same line).** (a) The point comes off in a write right after the reset rather than inside it. (b) A holder on
   only a non-primary Party takes 1 from that Party's pool (one New Session never resets; the old code touched only the primary
   Party's roster). (c) A matured Hang-Up flagged `maturedIgnored` no longer counts (rules treat it as inactive; the old code
   counted it). (d) One card per holder instead of one line with the total; a holder on no roster gets the card with no change.
6. **Both sessionStart rules - several GMs connected.** `rules/triggers.mjs` fires `sessionStart` on every GM client
   (`game.user.isGM`), so with two GMs logged in each holder would gain / lose 2. The old code ran only on the GM who pressed New
   Session. See "Edits outside my files" - with that one-word edit there is no difference.

## Still skipped (67), and what each still needs

Round-7 pieces looked at and why they don't reach these: `self:onCanvas` covers One Last Chance's on-scene test but not the
offer itself; `self:actionUsed` is the holder's own ledger, while Data-Link asks whether the drone was Commanded;
`@count.items` / `itemCount` don't find "their own Zord" (Sky Morpher); `pick from: team` picks an ally but not one of their
weapons / vehicles (Training Evolution); `pickGrant` always grants a copy, while the chosen-item Perks only record the pick;
`item:word` matches whole words, but Weapon Enthusiast's type test is a mix of flag, trait, handedness and name words.

### qualify1 (13)
- **Danger Sense** - an Initiative-formula reroll.
- **Ignite**, **Fireball** - the turn-end attack at the burning creature's turn, hit-card note, two action-costed buttons.
- **Addicted (Dark Energon)** - a resource-cost multiplier while craving, a d20 + recorded-die attack, a day counter.
- **Best-Laid Plans**, **One Last Chance** - reroll offers on any roll card, pressed by the roller, pooled per Party.
- **Service, Trade Goods, For The Syndicate, Good To Go, Ninpõ JOEs** - a recorded compendium pick read by a Qualification
  (Good To Go also its kit-prerequisite hook).
- **Nothing Personal** - attach a compendium upgrade to a picked weapon.
- **Tenacity** - `roll:save` and a turn-start "end what expires this turn" step.
- (Partial unchanged: **Nu, Pogodi!**'s weapon pick and seat swap.)

### qualify2 (11)
- **Upgrade Training** - a recording compendium picker read by a Qualification.
- **Weapon Enthusiast (Perk / Hang-Up)** - a weapon-type tag (flag / trait / one-handed / name words, filled from a pick) and
  the Hang-Up's set-aside of banked Lend Assistance.
- **Training Evolution** - a mission-scoped pick over another actor's weapons / vehicles, read as a Qualification.
- **Destructive Overcharge, Cascading Failure** - delayed button cards and a blast test around a point.
- **Sensitive, Detail Oriented** - a cost on another item's daily counter and a round-scoped ignore of the banked Snag.
- **Do Or Die** - add a die to a posted check; a Moxie cost that rises on a second use.
- **Wild Idea** - a DialogSwitch bonus pool die.
- **Timeline Anomaly** - a swap-Initiative step (`writeInitiative` can't read the other combatant's Initiative).
- (Partial unchanged: **Oorah!** - its shared vehicle ↑1 is in `dice.mjs`.)

### data1 + data21 (12)
- **Reinforced Shell** - static `rule:host:` tags and a dealt note with no damage value.
- **Over Brawn, The Heavy, Pack Mule** - an equipment-requirement Brawn rule.
- **Dino Thunder ×4** - picks read across items / actors, a single-use pool with fallback, a custom-hook step.
- **Stinger Spray (attacks)** - a preRoll per-attack cost that warns instead of refusing.
- **Larger Than Life** - `@other.<path>` in ItemModifier and "leave a missing value alone".
- **Sky Morpher** - a "driving your own Zord" tag (listed on the Ranger's sheet or linked as its owner).
- **Alternate Officer** - a recorded compendium pick (a Limited melee weapon) read as Qualified.

### data22 + mlp1 + mlp2 (26)
- **Data-Link** - a "companion drone not Commanded this round" tag.
- **Fresh Mark, Natural Style** - per-creature memory on the holder.
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
- **Friendship Is Mystical** - its Magically Fit In branch needs `magicallyFitInValue`, and a heal capped by the Mystical
  Points held (the new `choose` option `when` would gate the branches, but not those two).
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

1. `module/rules/triggers.mjs`, the `sessionStart` hook (around line 452) - fire on one GM client only, as the old
   `startNewSession` grant did:

   ```js
   if (setting?.key != 'essence20.q2SessionEpoch' || !globalThis.game?.user?.isGM) {
   ```
   becomes
   ```js
   if (setting?.key != 'essence20.q2SessionEpoch' || !globalThis.game?.user?.isActiveGM) {
   ```
   (Without it the conversions still work with one GM connected - the normal case - see difference 6.)

## Unused strings

`lang/en.json` keys no longer used by any code: `E20.Q2InspirationSession`, `E20.Q1NobilitySession`.

## Rule count

6 rules added: 2 on Hardware Training (Qualification, Use); 1 Qualification on Roaming the Land; 1 RollModifier on The Glory of
Cobra-La; 1 Trigger on Everything is Inspiration; 1 Trigger on Nobility.

## Engine pieces the remaining skips need (most useful first)

1. **Recorded compendium pick read by a Qualification** - a `pickGrant`-style browser with a `record` (no grant) mode that
   keeps the uuid and name under a key (several per key, filters per slot, one slot's pick narrowing the next), and a
   Qualification `items` tag `item:pickedSource:<key>` matching any printing or the name. Unblocks Service, Trade Goods, For The
   Syndicate, Good To Go, Ninpõ JOEs, Upgrade Training, Alternate Officer, Nu, Pogodi!'s weapon pick; with an ally-weapon source
   and a mission duration, Training Evolution. Medium.
2. **Weapon-type tag** `item:weaponType:<type>` (the flag a pick tagged the weapon with, the same-named trait, one-handed, the
   name words) with `{choice.<key>}`, plus a RollModifier `immune: ["lendAssistance"]` that sets banked Lend Assistance aside
   for that roll. Unblocks Weapon Enthusiast (Perk and Hang-Up). Small-medium.
3. **Reroll offers on any roll card, pressed by the roller** (any roll message, a pool sized by a formula and shared by a
   Party, posting a fresh card). Unblocks Best-Laid Plans, One Last Chance, Sorcerous Support (and Do Or Die with an "add a die"
   mode). Medium.
4. **SpellCost rule** (cast-dialog checkboxes: set / add / multiply the cost, plus a "re-cast free" step). Unblocks Brilliant
   Sight, Illusion Casting, Reach Out, Extra Effective Spell, Long Lasting Spell, Sharpcaster, part of Mystical Understanding.
   Medium.
5. **Incoming DialogSwitch** (on the roller's dialog, from the target's item) with a conditional default. Unblocks Something
   Is Off, Shadow. Medium.
6. **Marks that carry rules** (the marked creature gets rules from the setter's item while marked) + a roll step against a
   recipient's Defense with a formula downshift. Unblocks Waterrunning, Demolecularization Gun, Softenblows (with outgoing
   negate-damage), Ignite + Fireball. Medium-large.
7. **Initiative steps** (re-roll / swap with another combatant / formula reroll). Unblocks Danger Sense, Reactionary, Timeline
   Anomaly. Medium.
8. **Per-creature memory on the holder** (a keyed set of creatures, optionally scene-stamped, tags `target:remembered:<key>`).
   Unblocks Fresh Mark, Natural Style. Small.
9. **Canvas-point step + recipients around a point + delayed button cards.** Unblocks Smoke Screen, Smoke Bomb, Destructive
   Overcharge, Cascading Failure. Medium.
10. **Equipment requirement rule** (Brawn offset / ignore). Unblocks Over Brawn, The Heavy, Pack Mule. Small.
11. **`roll:save` tag + "end an effect expiring this turn" step.** Unblocks Tenacity. Small.
12. **Hit-card note for a watcher before damage lands** (holder anywhere in the world). Unblocks Staggering Sway. Medium.
13. **Companion tags:** `companion:commanded` (this round) and `vehicle:ownZord` (driving a Zord listed on / linked to the
    driver). Unblocks Data-Link (with a turn-end mark), Sky Morpher. Small.
14. **Smaller one-offs:** `@other.` in ItemModifier (Larger Than Life); `ignoreDownshift` / per-Skill `specialize` on a
    DialogSwitch (Third Eye, Dog Person); a preRoll cost that warns (Stinger Spray attacks); an Active-Effect toggle step
    (Thick Skin); a cost on another item's daily counter (Sensitive, Detail Oriented); a DialogSwitch bonus pool die (Wild
    Idea). Small each.
15. **Effectively permanent code** (bespoke UI or whole subsystems): Shape-Shift / Face-Shift / Master Morph / Size-Shift and
    Basic Shape-Shifting / Ponymorph's shape half, Dino Thunder ×4, Dominate, Addicted (Dark Energon), Primeon Blade, Assault
    Claw (`rules/grappled.mjs`), Reinforced Shell, Friendship Is Mystical, Prize Honey's half, Nothing Personal, Nu, Pogodi!'s
    seat swap, Oorah!'s half (in `dice.mjs`).
