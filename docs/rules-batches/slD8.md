# Batch slD8: re-check of slD7 (`react`, `resource`, `other1`, `other3`) against the round-8 engine pieces

**Scope:** every item `docs/rules-batches/slD7.md` left Still skip (77 items, plus the code halves of Repair Progress
and Solarix Shard) and the code half of the slD7 partial (Zap Apple Jam's shelf life). Each was re-checked against
"Engine features added 2026-10-06 (round 8, after the local round-7 conversions)" in
`docs/RULES_CONVERSION_GUIDE.md` (marks per setter + `@target.myMark`, `@sum.items|equipped`, `@count.named`,
`atLeast()`, `until: mission`, `self:combatant`, `scene:token:`, `pick from: actors`, `setVar` and Trigger chains
passing a changed `@var` on, the `updateActor` ladder, `itemAdded` / `movedOnTurn`, WeaponTrait rules seeing the
weapon id, button limits counting finished runs, the flagged Rest) and the earlier sections. The behaviour
differences recorded in slD3-slD7 were looked at again too.

| Verdict (re-checked items) | react | resource | other1 | other3 | Total |
|---|---|---|---|---|---|
| Convert (was skip) | 0 | 1 | 0 | 2 | **3** |
| Completed (was partial) | 0 | 1 | 0 | 0 | **1** |
| Still skip | 14 | 20 (+1 code half) | 20 | 20 (+1 code half) | **74** (+2) |
| Re-checked | 14 | 22 (+1) | 20 | 22 (+1) | **78** (+2) |

Rules fixed on an item converted earlier (no new item): **Inner Conservation** (slD5 difference 5b). slD5
difference 5a's Rest half and slD7's "a Rest that lowers Power from above its maximum fires the Inner Conservation /
Power Efficiency / Dino Charged Triggers" are gone with no rule change: the sheet's Rest update is now flagged
`essence20Rest`, which `resourceSpent` skips.

**6 rules were added to 4 pack items, and 1 existing rule was edited on 1 more.** With them,
`scripts/check-rules.mjs` reports 0 errors and 0 warnings. ESLint is clean on the four slice folders and the new test
file. Jest: see "Checks" below. No conversion needs anything outside my files.

## Converted

All are inserted as text. Every one of these pack files is CRLF. Each new item gets a `system.rules` array as the
first key of `system`.

- **Fuel Efficient** (`packs/tfcrbitems/_source/Fuel_Efficient_hW6ESJ1p7GvIGzBe.json`), 1 Trigger:
  - `resourceSpent`, `when: var:resource=energon`. Writes flagged as a loss, a refund or a Rest are skipped by the
    engine. The old hook skipped the same writes; it recognised a Rest by its shape (all three strains written at
    once).
  - `setVar regained = atLeast(@var.spent, 4, 4)`: one d4 per point spent, the 4s counted.
  - When `var:regained>0`: `gainResource` of that much Energon with `overMax` (the old refund wasn't capped), and a
    line.
- **Same Principle** (`packs/tfcrbitems/_source/Same_Principle_GTUn1LOxb3D4FgHF.json`), 2 rules:
  - a Use: `pick` key `weapon`, `from: ownedItem`, `itemType: weapon`, `filter: not:item:trait:ballistic` (the old
    list of weapons that aren't already Ballistic). It asks each time, as the old button did.
    `legacy: flags.essence20.o3SameWeapon` keeps an existing character's weapon.
  - a WeaponTrait `ballistic` with `items: item:picked:weapon`. The rule now sees the weapon's id, so the picked
    weapon reads as Ballistic in its derived traits (`system.traits` / `itemAndUpgradeTraits`), as the old derived
    pass did.
- **EM Protective Lining** (`packs/eocitems/_source/EM_Protective_Lining_SIGEfpjEe1H06dVM.json`), 2 rules. Both
  carry the old `isLined` gate: the armor it is attached to is equipped, or, when it isn't attached to anything, the
  wearer can transform. This is written as two `any` groups:
  `[rule:hostEquipped | not:rule:data:flags.essence20.parentId]` and `[rule:hostEquipped | self:canTransform]`. Both
  rules also need the old `isElectromagnetic`: `item:data:system.damageType=emp` or `weapon:trait:electromagnetic`.
  - an `incoming` RollModifier, ↓6, on an `attack` against a wearer with `self:data:system.traits.computerized` (the
    old roll source);
  - a Defense on Evasion, `@sum.equipped.armor.system.totalBonusEvasion`, while the wearer has an equipped computerized
    armor and no equipped armor that isn't computerized. That is the old `registerDefenseAdjust` sum (see difference
    3). Its `item:` tags make it a per-attack Defense, never added to the sheet.
- **Zap Apple Jam** (`packs/iajitems/_source/Zap_Apple_Jam_L5B7d8mw0xeOHVkw.json`), now **complete**, 1 Trigger
  added beside the slD7 Use and RollModifier:
  - `missionStart` (the GM's mission advance, run for every world actor), `stacks: true` so every jar keeps its own
    clock.
  - A fresh jar gets `updateItem self set flags.essence20.zapStale true` (the old flag, so jars already marked stale
    before the update keep their place).
  - A stale jar posts a line and is deleted with `deleteItem self`.
  - `until: mission` doesn't fit: the jar is bought, not granted, and it lasts for two advances.

Fixed rules on an item converted earlier:
- **Inner Conservation** (`packs/ttsgitems/_source/Inner_Conservation_NkHKAb5TFc7n7C8k.json`): `priority: -1`, so it
  runs before the other `resourceSpent` Triggers on the actor whatever the item order, and a closing
  `setVar spent = ceil(@var.spent / 2)`. Dino Charged, after it, now charges the halved spend in Essence, as the old
  chain did (`spent -= back`). Power Efficiency and Solarix Shard don't read `@var.spent`, so running after it
  changes nothing for them.

Removed with these:
- **`resource/energon.mjs`:** the Fuel Efficient half of `onEnergonSpend` (and its now-unused `spent` argument);
  the header now points to the rule. The Repair Progress half stays.
- **`resource/common.mjs`:** `IDS.fuelEfficient`, `IDS.zapAppleJam`.
- **`resource/mlp.mjs`:** the Zap Apple Jam `registerMissionAdvanced` shelf-life sweep; the imports
  `registerMissionAdvanced` and `say`.
- **`other3/tf.mjs`:** the EM Protective Lining block (`isLined`, `isElectromagnetic`, its roll source, its
  `registerDefenseAdjust`) and the Same Principle block (`SAME_FLAG`, its Use, its derived pass). Each is replaced by
  a one-line pointer. Every import is still used by the code that stays.
- **`other3/shared.mjs`:** `O3.emLining`, `O3.samePrinciple`.
- **`other3/other3.test.js`:** the `isLined` test.
- **`react/core.mjs`:** unchanged; every export stays.

New tests (`module/rules/conv8-slD8.test.js`, 17) assert what the old ones did, and more:
- every rule on the six items validates;
- Fuel Efficient:
  - the 4s are counted and given back, past the maximum;
  - no 4 gives nothing back;
  - Power and Dark Energon spends don't roll;
  - through the real actor-update hooks, Rest, refund and loss writes don't roll, and a plain spend does;
- Same Principle:
  - only weapons that aren't Ballistic are offered, and the pick is stored;
  - Ballistic goes on the picked weapon only, and on nothing before a pick;
  - the old `o3SameWeapon` flag carries over;
- EM Protective Lining:
  - ↓6 and the armor's Evasion back on an Electromagnetic attack, by trait or by EMP damage;
  - nothing on other attacks or on Toughness;
  - the ↓6 needs a Computerized wearer, but the Evasion doesn't;
  - unequipped armor or an unattached lining on a non-Transformer gives nothing, while Alt Mode works;
  - two computerized armors sum;
  - the Defense is decided per attack (the old `isLined` test, widened);
- Zap Apple Jam:
  - marked stale at the first advance and gone at the second;
  - a jar marked stale before the update goes at the next advance;
  - each jar keeps its own clock;
- Inner Conservation + Dino Charged:
  - with Dino Charged first on the sheet, a halved spend of 4 costs 2 Essence and of 3 costs 2;
  - a declined halving costs the whole spend.

## Behaviour differences worth a decision

1. **Fuel Efficient**
   - Every Energon spend posts a small rules card with the d4s rolled ("Rolled 2d4 (1, 3): 0"), even when nothing
     comes back. Before, the dice were silent and a line was posted only on a 4. A step amount that rolls dice
     always reports them, and there is no quiet option.
   - The line is the rule's ("Bot regains 2 Energon Point(s)."), not `ResFuelEfficientLine`.
   - A Rest is recognised by the sheet's `essence20Rest` flag. The old hook recognised it by its shape: any update
     writing normal, Dark and Red Energon at once. Only the sheet's Rest writes like that today.
2. **Same Principle**
   - Ballistic is added through the WeaponTrait path, like Demolisher or Big Lobber. That path doesn't list
     `traits` in `upgradeTouched`, so the weapon's item sheet shows the derived Ballistic as the other rule-granted
     traits do. Before, the sheet showed the weapon's own stored traits.
   - The pick posts the engine's "Picked" line, not `O3SamePrincipleChosen`.
   - With no weapon to offer, the Use posts "nothing to pick". Before, it opened an empty list.
3. **EM Protective Lining**
   - The Evasion is given back only while every equipped armor is computerized. On a wearer with one computerized and
     one non-computerized armor both equipped, the old code gave back the computerized one's Evasion; now nothing is
     given back. `@sum` can't filter by trait. Ordinary wearers have one armor equipped, and for them it is exact.
   - The roll source carries the rule label "EM Protective Lining", with the same text as before and the rule's id.
4. **Zap Apple Jam**
   - The spoiled card is a rules card ("Zap Apple Jam: Shelf life", "…'s Zap Apple jam is gone.", and the engine's
     "removed" line), not `ResZapJamSpoiled`.
5. **Inner Conservation**: none beyond the fix. Running first changes nothing for the other `resourceSpent` Perks.

## Still skipped (74), and what each still needs

Marked **(permanent)** where it is effectively code for good.

### react (14)
- **Defender (Megaform Trait)** (permanent): a Reaction `who` for the pilots of a Megaform's members.
- **Junker**: an "equipment broke" event, and a drop-to-0 event for vehicles.
- **Not On My Watch (IA)**: a drop-to-0 Health event outside `applyDamage`.
- **All For One**: a drop-to-0 Health / Power event, and a two-answer card whose 1d2 / 1 Health gift lands on the
  caller.
- **Agency** (permanent until dice.mjs reads a rule): dice.mjs's Fumble Story Point grant.
- **Revengeful**: a "stored uuid = this target" tag (the `pendingRevengeful` stamp that dice.mjs sets). Marks per
  setter don't reach it, because dice.mjs sets the window.
- **Inspirational Leader (combat half)**: the rolled Skill as an afterRoll `@var` / text, so it can be stored, and an
  ally aura reading it until the end of the round.
- **Monster Morph** (permanent): a roll against every creature within 10 ft at once, and a per-Path rule home.
- **Iron Bravado (share half)** (permanent): copying Condition immunities to picked allies for a while.
- **Cyborg** (permanent): an Essence damage redirect and a heal lock.
- **Mind Beam**: a rule reading the spell's pre-roll effect choice.
- **Energized**, **Spiked**, **Energy Field**: an incoming DialogSwitch (one per targeted wearer) and a "plain Reach"
  tag.

### resource (20, plus the code half of Repair Progress)
- **Play Favorites**, **Play Favorites Against Each Other**, **This, I Command**, **Ruthless Efficiency**: a personal
  Story Point pool resource.
- **Money Talks**, **Capable Freelancer** (permanent): a confirmable pre-roll Skill swap that rewrites the dataset.
- **Motor Pool Connections** (permanent): a vehicle picker, per-vehicle budgets, and a grant onto another actor.
- **Repair Progress (code half)**: a Rest Trigger that runs inside the Rest's own write (the `rest` event fires
  before the sheet writes the capped Energon), and an Energon cap extra.
- **Body of Energy (damage / unmorph halves)**: a pooled-resource damage modifier, and an unmorph Trigger with the
  pre-update values.
- **Dark Energon**, **Primal Energon**, **Red Energon**, **Synth-En**, **Word of Unicron** (permanent): the
  addiction subsystem.
- **Together We Stand**: a recipient list of "team members who are combatants" with a two-member gate, one grant per
  member across several holders, and ledger-recorded temporary Health / Energon taken back at the scene's end.
  `self:combatant` covers the holder only.
- **Think Fast!**: `storyPointSpent` with the spend kind.
- **We Improvise**: a per-combat ledger of the points it added and the pool's spends.
- **Beast Mode** (permanent): an event on its flag and level-gated packages.
- **Camper**: a per-recipient `choose` (Health or 2 Essence, asked per member).
- **Circle of Magical Friends** (permanent): Circle recipients and copying items.
- **History Buff (Use half)**: a blind (GM-only) roll of a die one size smaller.

### other1 (20)
- **Interspatial Pause**, **Timeslide** (permanent): hiding and moving tokens.
- **Quantum Trigger**: retrying the last Skill Test with a cumulative ↓n.
- **Time Strike**, **Onslaught**: hit-card rider options from sibling effects.
- **Special Program** (permanent): compendium-Perk picks with prerequisite labels.
- **Savant Skill**: a reroll-result Trigger.
- **Unlucky (For You)**: the Snag half is dice.mjs's, armed on the target's next Skill Test, with a per-target limit.
- **Altered**, **Additional Alteration**: an Alteration cost waiver.
- **Overload**, **Genetic Support**, **Advanced Alteration Emulator**: a lent Alteration benefit.
- **Standard Deflecting Weapon**, **Limited Deflecting Weapon** (permanent): a linked shield granted per upgrade,
  equipped with its host weapon, and an attack refusal while raised.
- **Shield Fighter**: an Element offered as a rider option on the attack card, paid from Personal Shield's pool.
- **Armor Matrix (Light / Medium / Heavy)** (permanent): a create veto (`itemAdded` fires after the item is made, not
  before) and a best-of Defense.
- **Multimorph** (permanent): an origin-perk picker.

### other3 (20, plus the code half of Solarix Shard)
- **Betrayal**: the assisted roll's result for the assister, and a "split from the party" state that
  `getNearbyAllyTokens` reads.
- **Dabbler**: the `updateActor` ladder now exists. It still needs a Skill pick filtered by the die (can be lowered
  / raised) and by the first pick's Essence (or Spellcasting), and a ladder path read from a pick
  (`system.skills.{choice.lower}.shift`) for the Rest revert.
- **Self Improvement**: per-target, per-scene stored Essence picks applied in derived data.
- **Follow Me!**: a count of "actors carrying my mark", a per-follower d4, and those followers as recipients.
- **Better Together (+ Hang-Up)** (permanent): a pair read from either actor.
- **Guardian Blast** (permanent): a group test with a tally.
- **Mega Defender** (permanent): a stored form with DerivedStat `set`, and shared action economy.
- **Metallic Armor Power Up!**: the end is shared with the crit / Defeat paths and power-handler's switch-on, and the
  minion damage cut needs a `taken` modifier that sees the attacker and an "is a minion" tag.
- **Solarix Shard (code half)**: the Power Weapon pick and its hit-card rider option.
- **Void Touched**: a step that writes Essence maxima from picks, with an undo on delete.
- **Holographic Sights**: `@rolled.<path>` (the rolled effect's own ↓ as the ↑).
- **Scramble Field Generator**: marks with a mode, read by the marker's whole side. Per-setter marks reach only the
  setter.
- **Again and Again and Again**: a repeat-attack step.
- **Balance and Compensation**: a die-ladder op for ItemModifier on the weapon-requirement ladder
  (`effectiveBrawnReq`). The new ladder is `updateActor`-only and uses the Skill ladder.
- **Bump & Run**: a "moved N ft since the attack" tag. `movedOnTurn` fires on any move and doesn't measure distance.
- **Perfect Placement** (permanent): placed zones.
- **Precise Chronometrics**: a distribute-points step (Initiative bonuses to several combatants, capped at Smarts).
- **Now You Don't (+5)**: a flat result bonus, and the Hide state as data.
- **Pop Out**, **Telltale Sign**: a roll against several targets' best Defense, and the Hidden state.
- **Gluten-Tolerant** (permanent): a create veto. `itemAdded` would let the Weird Perk land and then delete it.

## Edits outside my files

None needed. Optional and comment-only: `module/dice.mjs` line 1308-1309 still says Fuel Efficient "rolls on every
Energon spend, from the actor update hooks - items/resources/energon-spend-strains.mjs". It could read "...rolls on
every Energon spend - its item's own resourceSpent Trigger rule." `module/dice.test.js`'s Fuel Efficient
`describe.skip` block is dead and could go.

## Unused strings

These `lang/en.json` keys (under `E20`) have no code use left:
- resource: `ResFuelEfficientLine`, `ResZapJamSpoiled`;
- other3: `O3SamePrinciplePick`, `O3SamePrincipleChosen`.

## Files touched

- Packs (rules inserted as text, CRLF like these files):
  - `packs/tfcrbitems/_source/Fuel_Efficient_hW6ESJ1p7GvIGzBe.json` (1 rule)
  - `packs/tfcrbitems/_source/Same_Principle_GTUn1LOxb3D4FgHF.json` (2)
  - `packs/eocitems/_source/EM_Protective_Lining_SIGEfpjEe1H06dVM.json` (2)
  - `packs/iajitems/_source/Zap_Apple_Jam_L5B7d8mw0xeOHVkw.json` (1 appended)
  - `packs/ttsgitems/_source/Inner_Conservation_NkHKAb5TFc7n7C8k.json` (1 rule edited)
- Slice (CRLF kept): `resource/energon.mjs`, `resource/common.mjs`, `resource/mlp.mjs`, `other3/tf.mjs`,
  `other3/shared.mjs`, `other3/other3.test.js`.
- New: `module/rules/conv8-slD8.test.js` (17 tests, CRLF) and this file.

**Rules added: 6** (on 4 items), plus 1 rule edited on 1 item.

## Checks

- ESLint (`--ext .js,.mjs`, linebreak-style off) on `react/`, `resource/`, `other1/`, `other3/` and
  `conv8-slD8.test.js`: clean.
- `node scripts/check-rules.mjs`: 1913 rules on 1186 items, 0 errors, 0 warnings. The totals include other agents'
  work.
- Jest:
  - the four slice folders, `conv8-slD8`, `conv7-slD7`, `conv6-slD6`, `conv5-slD5`, `conv4-slD4`, `conv3-slD3` and
    `engine8`: 11 suites, 209 tests, all pass;
  - all of `module/rules`: 1722 tests, all pass.

## Engine pieces the remaining skips need (most useful first)

1. **A drop-to-0 event from any Health / Power write, and an "equipment broke" event** (small to medium). Unblocks
   Not On My Watch (IA) and Junker (both halves). With a two-answer card whose payment is the presser's, it also
   unblocks All For One.
2. **Hit-card rider option step** (medium): an alternate damage button on the attack card's own row. Unblocks Shield
   Fighter, Solarix Shard's Fire half, Time Strike and Onslaught.
3. **Personal Story Point pool resource** (medium). Unblocks Play Favorites, Play Favorites Against Each Other,
   This, I Command and Ruthless Efficiency.
4. **Pick refinements** (small): a Skill pick filtered by die (`minShift` / `maxShift`) and by another pick's Essence
   (`essence: "{choice.lower}"`, plus Spellcasting), and `{choice.<key>}` in `updateActor` ladder paths. Unblocks
   Dabbler.
5. **The rolled Skill as an afterRoll var** (`@var.skill` / `{var.skill}`, small), plus a stored-Skill ally aura
   until the end of the round (small). Unblocks Inspirational Leader.
6. **Per-recipient `choose`** (small to medium). Unblocks Camper.
7. **Initiative helpers** (medium): recipients "actors carrying my mark", a count of them, and a distribute-points
   step. Unblocks Follow Me! and Precise Chronometrics.
8. **An incoming DialogSwitch** (medium): a switch on the attacker's dialog that the defender's item offers (one per
   targeted wearer), with a "plain Reach" attack tag. Unblocks Energized, Spiked and Energy Field.
9. **Small one-offs** (small each):
   - a ladder op for ItemModifier on the weapon-requirement ladder: Balance and Compensation;
   - `storyPointSpent` with the spend kind: Think Fast!;
   - a "stored uuid = target" tag: Revengeful;
   - `@rolled.<path>` (the rolled item's own numbers): Holographic Sights;
   - a `quiet` option on step amounts (no dice line when nothing comes of it): removes Fuel Efficient's difference 1;
   - a trait filter on `@sum` (`@sum.equipped.armor[trait:computerized].system.totalBonusEvasion`): removes EM
     Protective Lining's difference 3;
   - a "moved N ft since <mark>" tag: Bump & Run.
10. **A retry-the-last-test step with a cumulative ↓** (medium). Unblocks Quantum Trigger. With a reroll-result
    event, it also unblocks Savant Skill.
11. **A lent Alteration benefit** (large design). Unblocks Overload, Genetic Support and Advanced Alteration Emulator.
12. **Effectively permanent code** (bespoke UI or whole subsystems):
    - Motor Pool Connections; Circle of Magical Friends.
    - Interspatial Pause and Timeslide (tokens); Perfect Placement (zones).
    - Beast Mode packages; the Energon strains and Word of Unicron (addiction).
    - Monster Morph; Mega Defender; Guardian Blast.
    - Better Together (world-PC pairing).
    - Armor Matrix and Gluten-Tolerant (create vetoes); Special Program / Multimorph pickers.
    - Money Talks / Capable Freelancer (dataset rewrite); Agency (dice.mjs's Fumble grant).
    - Megaform Defender (pilot lookup); Cyborg; Iron Bravado's share; Metallic Armor's on/off shared with
      power-handler; the Deflecting Weapons' linked shield.
    - Repair Progress's Rest carry-over and Together We Stand's ledger are close to this too, unless Rest and
      scene-end ledgers become rule events.
