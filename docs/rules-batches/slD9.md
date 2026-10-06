# Batch slD9: re-check of slD8 (`react`, `resource`, `other1`, `other3`) against the round-9 engine pieces

**Scope:** every item `docs/rules-batches/slD8.md` left Still skip (74 items, plus the code halves of Repair Progress
and Solarix Shard), and slD8's behaviour differences. Each was re-checked against "Engine features added 2026-10-06
(round 9, after the local round-8 conversions)" in `docs/RULES_CONVERSION_GUIDE.md` (`to: picked:<key>`,
`rollVsEach`, `disarm`, `takeItem`, `spendAction`, `pick from: targetItem`, pick skill `minShift` / `maxShift`,
`pickGrant record` + `item:pickedSource:`, tracked temporary Health, grant `appendTraits`, `ladderMax` / `ladderMin`,
`quiet` steps, `@sum.equippedTrait`, `removed` / `droppedToZero`, afterRoll `@var.skill`) and the earlier sections.

| Verdict (re-checked items) | react | resource | other1 | other3 | Total |
|---|---|---|---|---|---|
| Convert (was skip) | 1 | 0 | 0 | 1 | **2** |
| Partial | 0 | 0 | 0 | 0 | **0** |
| Still skip | 13 | 20 (+1 code half) | 20 | 19 (+1 code half) | **72** (+2) |
| Re-checked | 14 | 20 (+1) | 20 | 20 (+1) | **74** (+2) |

Rules fixed on items converted earlier (no new item): **Fuel Efficient** (slD8 difference 1a, the dice line) and
**EM Protective Lining** (slD8 difference 3, mixed armor).

**4 rules were added to 2 pack items, and 2 existing rules were edited on 2 more.** With them,
`scripts/check-rules.mjs` reports 0 errors and 0 warnings (1964 rules on 1202 items, other agents' work included).
ESLint is clean on the four slice folders and the test files I touched. Jest: see "Checks" below. One test line
outside my new file was changed (see "Edits outside my files").

## Converted

All are inserted as text. Every one of these pack files is CRLF.

- **Not On My Watch (Intercontinental Adventures)** (`packs/iafav2items/_source/Not_On_My_Watch_xH3iQ0NcXp1eFO35.json`),
  1 Trigger appended beside its existing Defense rule:
  - `droppedToZero`, `watch: ally`, `when: ["var:resource=health", "not:target:type:vehicle"]` - an ally's Health
    reaching 0 from above (any write), never the holder's own, never a vehicle.
  - One `button` step, whispered to the holder's owners (`whisper: owners`, `who: owner`, `once`), as the old
    whispered card was. Pressing it runs `grantActions {move: 1}` when a combat exists (the old `game.combat`
    check, `combat:exists`) and posts "{name} rushes up to {ground movement} ft toward their fallen teammate."
- **Void Touched** (`packs/ttsgitems/_source/Void_Touched_NHH2nlllyFMBOB38.json`), 3 rules, a new `system.rules`
  array as the first key of `system`:
  - an `added` Trigger and a Use with the same steps, both gated on
    `not:rule:data:flags.essence20.o3VoidTouched` (the old flag, so an Origin traded before the update stays done):
    - `pick down` from Strength / Social, then `pick up` from Smarts / Speed (backing out of either stops the run
      before anything changes, like the old two dialogs);
    - four conditional `updateActor` steps: −1 to the `down` Essence's maximum, +1 to the `up` one's (the Origin
      drop already gave the first point);
    - `updateItem self set flags.essence20.o3VoidTouched.applied: true` (hides the Use, as `canUse` did);
    - a chat line.
    - Both picks carry `legacy: flags.essence20.o3VoidTouched.down` / `.up`, so the GM's linking pass moves an old
      trade into `rules.choices`.
  - a `removed` Trigger (when the flag is set): the trade undone, +1 / −1. Each step reads the new pick or the old
    flag (`any`), so an old Origin is undone once whether or not the linking pass has run.

Fixed rules on items converted earlier:
- **Fuel Efficient** (`packs/tfcrbitems/_source/Fuel_Efficient_hW6ESJ1p7GvIGzBe.json`): the `setVar regained =
  atLeast(...)` step is `quiet: true`. The d4s are no longer told in chat, and a spend with no 4 posts no card at all,
  as the old silent roll did. A 4 posts only the "regains" line.
- **EM Protective Lining** (`packs/eocitems/_source/EM_Protective_Lining_SIGEfpjEe1H06dVM.json`): the Defense's amount is
  `@sum.equippedTrait.computerized.armor.system.totalBonusEvasion`, and the two `wearingItem` gates are gone. A wearer
  with one computerized and one plain armor equipped now gets the computerized one's Evasion back, exactly as the old
  `registerDefenseAdjust` sum did.

Removed with these:
- **`react/triggers.mjs`:** `TRIG.notOnMyWatchIa`, the `notOnMyWatch` call in `onDropToZero` (a one-line pointer
  instead), the `notOnMyWatch` function, the `reactNomwMove` chat button, `whisperCard` (only it used it) and the
  `ownerIds` import. `onDropToZero` stays (Junker, All For One).
- **`other3/pr.mjs`:** the whole Void Touched block (`VOID_FLAG`, `voidTouchedUpdate`, `applyVoidTouched`, its Use, its
  `createItem` and `deleteItem` hooks); the header now points to the rules. Every import is still used.
- **`other3/shared.mjs`:** `O3.voidTouched`.
- **`other3/other3.test.js`:** the `voidTouchedUpdate` test.
- **`react/core.mjs`:** unchanged; every export stays.

New tests (`module/rules/conv9-slD9.test.js`, 12) assert what the old code did:
- every rule on the four items validates;
- Not On My Watch (IA), through the real actor-update hooks:
  - an ally at 0 Health posts one whispered button card for the holder's owners, used once;
  - pressed in a combat, it grants one Move (`grantActionsThisTurn(holder, {move: 1})`) and posts the line; out of
    combat only the line;
  - nothing for the holder's own drop, an enemy, a vehicle, Power at 0, or a write that leaves Health at 0;
- Void Touched:
  - added: both questions, the trade, the flag; the Use is hidden after, and a second add does nothing;
  - backing out changes nothing and leaves the Use; the Use makes the trade;
  - deleting undoes it; deleting an untraded Origin does nothing;
  - an old `o3VoidTouched` trade hides the Use, carries over through `legacyChoiceUpdates`, and is undone once with
    or without the linking pass (the old `voidTouchedUpdate` test, widened);
- Fuel Efficient: a 4 gives one line and no dice line; no 4 posts nothing;
- EM Protective Lining: computerized + plain armor gives the computerized Evasion only; two computerized armors sum;
  an unequipped one doesn't count.

## Behaviour differences worth a decision

1. **Not On My Watch (IA)**
   - Watch rules see only actors with a token on the viewed scene (slD3 difference 1, slD4 difference 1). The old
     code searched every world actor holding the Perk, and with no tokens judged sides by PC / non-PC. The Perk asks
     for an ally "you can see", so both need a token anyway.
   - Allies are counted the system way (`getNearbyAllyTokens`: token disposition, plus Frenemy / Betrayal / Ally
     Awareness). The old `areAllies` was disposition only.
   - The trigger runs on the client that wrote the Health (the engine's `droppedToZero`), not on the holder's
     responsible client. The card is the same whisper either way.
   - The card is a rule-button card: the intro reads "An ally dropped to 0 Health: an extra Move toward them." and
     doesn't name the fallen ally (a button intro isn't filled in). The press posts a rules card with the line,
     headed by the button label, instead of `ReactNomwMoved`.
2. **Void Touched**
   - The questions are the engine's pick dialogs with my own prompts, and each pick posts the engine's "Picked" line;
     the result line is "Ranger: strength -1, speed +1 (Void Touched)." (raw Essence keys) instead of
     `O3VoidTouchedLine`.
   - The trade lands in two actor updates (down, then up), not one.
   - The `added` Trigger runs as soon as the Origin item exists; the old hook waited 1.5 s for the Origin drop's own
     Essence update. The picks wait for the player, so the drop's update has landed long before the trade is written
     unless both dialogs are answered in a few milliseconds.
3. **Fuel Efficient** / **EM Protective Lining**: none left beyond slD8's remaining notes (the rule's line text; the
   rule label on the roll source). `@sum.equippedTrait` also counts a computerized trait an attached upgrade adds
   (`itemAndUpgradeTraits`); the old sum read only the armor's own traits. No armor upgrade adds Computerized today.

## Still skipped (72), and what each still needs

Marked **(permanent)** where it is effectively code for good; otherwise the missing piece and its size.

### react (13)
- **Defender (Megaform Trait)** (permanent): a Reaction `who` for the pilots of a Megaform's members.
- **Junker**: `droppedToZero` covers the vehicle half, but a watch Trigger needs the holder's token on the scene, and
  crew aboard a vehicle usually have none (the old code reached every world holder). Needs an off-canvas watch
  (`watch` with `scope: world`, small) and an "equipment broke" event (an `itemUpdated` / `broken` event, small).
- **All For One**: `droppedToZero` covers the call, but the answer needs a per-card, per-kind claim for each presser
  (button `limit` counts windows, not cards), a recipient for the card's holder from a clicker's run (`to: holder`),
  and the old giver choice (own character, else an owned PC on the recipient's side). Small to medium.
- **Agency** (permanent until dice.mjs reads a rule): dice.mjs's Fumble Story Point grant.
- **Revengeful**: a "stored uuid = this target" tag for dice.mjs's `pendingRevengeful` window (small).
- **Inspirational Leader (combat half)**: afterRoll `@var.skill` exists now, but nothing can keep it where a tag can
  compare it: `updateItem` `set` doesn't fill `{var.x}` in text (so `skill:{choice.x}` can't be written), and
  `updateActor` can fill it but no tag compares the rolled Skill with a stored value. Needs `{var}` filling in
  `updateItem` text values (small); then a self mark `until: roundOrScene` and an ally aura
  `skill:{choice.inspiring}` with `stacks: false` would do it.
- **Monster Morph** (permanent, close): `rollVsEach` with `to: all:10` fits the Cruelty / Frost bursts, but
  `takesDamage` can't tell damage from an attack (the old `lastApplyContext().isAttack`), the riders belong on the six
  Path Role items, and the old hits post GM damage buttons per creature. Needs a `damage:attack` tag (small).
- **Iron Bravado (share half)** (permanent): copying Condition immunities to picked allies for a while.
- **Cyborg** (permanent): an Essence damage redirect and a heal lock.
- **Mind Beam**: a rule reading the spell's pre-roll effect choice (medium).
- **Energized**, **Spiked**, **Energy Field**: an incoming DialogSwitch (one per targeted wearer) and a "plain Reach"
  tag (medium).

### resource (20, plus the code half of Repair Progress)
- **Play Favorites**, **Play Favorites Against Each Other**, **This, I Command**, **Ruthless Efficiency**: a personal
  Story Point pool resource (medium).
- **Money Talks**, **Capable Freelancer** (permanent): a confirmable pre-roll Skill swap that rewrites the dataset.
- **Motor Pool Connections** (permanent): a vehicle picker, per-vehicle budgets, and a grant onto another actor.
- **Repair Progress (code half)** (near permanent): a Rest Trigger running inside the Rest's own write, and an Energon
  cap extra.
- **Body of Energy (damage / unmorph halves)**: a pooled-resource damage modifier, and an unmorph Trigger with the
  pre-update values (medium).
- **Dark Energon**, **Primal Energon**, **Red Energon**, **Synth-En**, **Word of Unicron** (permanent): the
  addiction subsystem.
- **Together We Stand**: tracked temporary Health exists now, but not tracked temporary Energon; plus recipients
  "team members who are combatants" with a two-member gate, and one grant per member across several holders. Medium.
- **Think Fast!**: `storyPointSpent` with the spend kind (small).
- **We Improvise**: a per-combat ledger of the points it added and the pool's spends (medium).
- **Beast Mode** (permanent): an event on its flag and level-gated packages.
- **Camper**: a per-recipient `choose` (Health or 2 Essence, asked per member) (small to medium).
- **Circle of Magical Friends** (permanent): Circle recipients and copying items.
- **History Buff (Use half)**: a blind (GM-only) roll of a die one size smaller (small).

### other1 (20)
- **Interspatial Pause**, **Timeslide** (permanent): hiding and moving tokens.
- **Quantum Trigger**: retrying the last Skill Test with a cumulative ↓n (medium).
- **Time Strike**, **Onslaught**: hit-card rider options from sibling effects (medium).
- **Special Program** (permanent): compendium-Perk picks with prerequisite labels.
- **Savant Skill**: a reroll-result Trigger (small, with Quantum Trigger's step).
- **Unlucky (For You)**: the Snag half is dice.mjs's, armed on the target's next Skill Test, with a per-target limit.
- **Altered**, **Additional Alteration**: an Alteration cost waiver (medium).
- **Overload**, **Genetic Support**, **Advanced Alteration Emulator**: a lent Alteration benefit (large).
- **Standard Deflecting Weapon**, **Limited Deflecting Weapon** (permanent): a linked shield granted per upgrade,
  equipped with its host weapon, and an attack refusal while raised.
- **Shield Fighter**: an Element offered as a rider option on the attack card, paid from Personal Shield's pool
  (medium).
- **Armor Matrix (Light / Medium / Heavy)** (permanent): a create veto and a best-of Defense.
- **Multimorph** (permanent): an origin-perk picker.

### other3 (19, plus the code half of Solarix Shard)
- **Betrayal**: the assisted roll's result for the assister, and a "split from the party" state that
  `getNearbyAllyTokens` reads (medium).
- **Dabbler**: `minShift` / `maxShift` and `ladderMax` exist, but the lowered Skill must be one with a raisable
  partner, the raised one must share the lowered one's Essence (or be Spellcasting, never Conditioning), and the
  `updateActor` ladder paths can't read a pick (`system.skills.{choice.lower}.shift` isn't filled). Needs pick
  `sameEssenceAs: <key>` + `also` / `exclude` lists and `{choice}` in ladder paths (small), plus the Use's toggle-back
  and the Rest revert (a `rest` Trigger with the same steps would do).
- **Self Improvement**: per-target, per-scene stored Essence picks applied in derived data (medium).
- **Follow Me!**: a count of "actors carrying my mark", a per-follower d4, and those followers as recipients (medium).
- **Better Together (+ Hang-Up)** (permanent): a pair read from either actor.
- **Guardian Blast** (permanent): a group test with a tally.
- **Mega Defender** (permanent): a stored form with DerivedStat `set`, and shared action economy.
- **Metallic Armor Power Up!** (permanent): its end is shared with the crit / Defeat paths and power-handler's
  switch-on; the minion cut needs a `taken` modifier that sees the attacker and an "is a minion" tag.
- **Solarix Shard (code half)**: the Power Weapon pick and its hit-card rider option (medium, the rider-option step).
- **Holographic Sights**: `@rolled.<path>` (the rolled effect's own ↓ as the ↑) (small).
- **Scramble Field Generator**: marks with a mode, read by the marker's whole side (medium).
- **Again and Again and Again**: a repeat-attack step (medium).
- **Balance and Compensation**: a die-ladder op for ItemModifier on the weapon-requirement ladder (small).
- **Bump & Run**: a "moved N ft since the attack" tag (small).
- **Perfect Placement** (permanent): placed zones.
- **Precise Chronometrics**: a distribute-points step (medium).
- **Now You Don't (+5)**: a flat result bonus, and the Hide state as data (medium, with Pop Out).
- **Pop Out**, **Telltale Sign**: `rollVsEach` rolls against one named Defense; these need the better of Willpower and
  Cleverness per creature, success only when every observer is beaten, the Hidden state (hide.mjs) as data, and
  Telltale's per-creature button pressable three times with a growing Frightened count (each a Free action -
  `spendAction` covers that part). Medium.
- **Gluten-Tolerant** (permanent): a create veto.

## Edits outside my files

One test line, already made (the rule fix needs it):
- `module/rules/conv8-slD8.test.js` (my slice's round-8 test), Fuel Efficient's first test:
  `expect(allChat()).toContain('DiceRolled');` became
  `// slD9: the d4s are quiet now (the old hook rolled them silently).` +
  `expect(allChat()).not.toContain('DiceRolled');`. Revert both if Fuel Efficient's `quiet` is not wanted.

Nothing else needed. Optional and comment-only: `module/dice.mjs` lines 1308-1309 still say Fuel Efficient
"rolls on every Energon spend, from the actor update hooks - items/resources/energon-spend-strains.mjs" (slD8 note).

## Unused strings

These `lang/en.json` keys (under `E20`) have no code use left:
- react: `ReactNomwPrompt`, `ReactNomwMoved`;
- other3: `O3VoidTouchedDown`, `O3VoidTouchedUp`, `O3VoidTouchedLine`.

## Files touched

- Packs (rules inserted as text, CRLF like these files):
  - `packs/iafav2items/_source/Not_On_My_Watch_xH3iQ0NcXp1eFO35.json` (1 rule appended)
  - `packs/ttsgitems/_source/Void_Touched_NHH2nlllyFMBOB38.json` (3 rules)
  - `packs/tfcrbitems/_source/Fuel_Efficient_hW6ESJ1p7GvIGzBe.json` (1 rule edited)
  - `packs/eocitems/_source/EM_Protective_Lining_SIGEfpjEe1H06dVM.json` (1 rule edited)
- Slice (CRLF kept): `react/triggers.mjs`, `other3/pr.mjs`, `other3/shared.mjs`, `other3/other3.test.js`.
- `module/rules/conv8-slD8.test.js` (one assertion, see above).
- New: `module/rules/conv9-slD9.test.js` (12 tests, CRLF) and this file.

**Rules added: 4** (on 2 items), plus 2 rules edited on 2 items.

## Checks

- ESLint (`--ext .js,.mjs`, linebreak-style off) on `react/`, `resource/`, `other1/`, `other3/`,
  `conv9-slD9.test.js` and `conv8-slD8.test.js`: clean.
- `node scripts/check-rules.mjs`: 1964 rules on 1202 items, 0 errors, 0 warnings.
- Jest: the four slice folders, `conv9-slD9`, `conv8-slD8`, `conv7-slD7`, `conv6-slD6`, `conv3-slD3`, `engine9` and
  `conversions`: 11 suites, 888 tests, all pass.

## Engine pieces the remaining skips need (most useful first)

1. **`{var.x}` filled in `updateItem` text values** (small). With it, Inspirational Leader's combat half converts
   (store the afterRoll `@var.skill` as a pick, a self mark `until: roundOrScene`, an ally aura on
   `skill:{choice.inspiring}`).
2. **Pick refinements** (small): `pick from: skill` with `sameEssenceAs: <key>`, `also: [skills]`,
   `exclude: [skills]` and "has a partner" filtering, and `{choice.<key>}` in `updateActor` ladder paths. Unblocks
   Dabbler (its Rest revert is a `rest` Trigger with the same steps).
3. **Off-canvas watch and an "equipment broke" event** (small each). Unblocks Junker (both halves).
4. **Per-card button claims and a `to: holder` recipient for clicker runs** (small to medium). With the giver rule,
   unblocks All For One.
5. **Hit-card rider option step** (medium): Shield Fighter, Solarix Shard's Fire half, Time Strike, Onslaught.
6. **Personal Story Point pool resource** (medium): Play Favorites x2, This, I Command, Ruthless Efficiency.
7. **`rollVsEach` with a best-of Defense and an "all must fail" outcome, plus the Hidden state as data** (medium):
   Pop Out, Telltale Sign, Now You Don't's +5.
8. **Tracked temporary Energon and "team combatants" recipients with one grant per member** (medium): Together We
   Stand.
9. **Per-recipient `choose`** (small to medium): Camper.
10. **Initiative helpers** (medium): recipients "actors carrying my mark", a count of them, and a distribute-points
    step - Follow Me! and Precise Chronometrics.
11. **An incoming DialogSwitch** with a "plain Reach" tag (medium): Energized, Spiked, Energy Field.
12. **Small one-offs** (small each): `damage:attack` on `takesDamage` (Monster Morph, with its per-Path homes);
    the weapon-requirement ladder op (Balance and Compensation); `storyPointSpent` with the spend kind (Think Fast!);
    a "stored uuid = target" tag (Revengeful); `@rolled.<path>` (Holographic Sights); a "moved N ft since" tag
    (Bump & Run); a blind roll (History Buff).
13. **A retry-the-last-test step with a cumulative ↓** (medium): Quantum Trigger; with a reroll-result event, Savant
    Skill.
14. **A lent Alteration benefit** (large): Overload, Genetic Support, Advanced Alteration Emulator.
15. **Effectively permanent code** (bespoke UI or whole subsystems):
    - Motor Pool Connections; Circle of Magical Friends.
    - Interspatial Pause and Timeslide (tokens); Perfect Placement (zones).
    - Beast Mode packages; the Energon strains and Word of Unicron (addiction).
    - Monster Morph (unless piece 12's tag lands); Mega Defender; Guardian Blast.
    - Better Together (world-PC pairing).
    - Armor Matrix and Gluten-Tolerant (create vetoes); Special Program / Multimorph pickers.
    - Money Talks / Capable Freelancer (dataset rewrite); Agency (dice.mjs's Fumble grant).
    - Megaform Defender (pilot lookup); Cyborg; Iron Bravado's share; Metallic Armor's on/off shared with
      power-handler; the Deflecting Weapons' linked shield.
    - Repair Progress's Rest carry-over.
