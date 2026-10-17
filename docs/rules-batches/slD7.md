# Batch slD7: re-check of slD6 (`react`, `resource`, `other1`, `other3`) against the round-7 engine pieces

**Scope:** every item `docs/rules-batches/slD6.md` left Still skip (83 items, plus the code halves of Repair Progress
and Solarix Shard), re-checked against "Engine features added 2026-10-06 (round 7, after the local round-6
conversions)" in `docs/RULES_CONVERSION_GUIDE.md` (`onCanvas`, `itemCount`, `actionUsed`, `wearingItem`,
`hasItem:name~`, `item:word`, `item:hasAttack`, `roll:targets` / `@var.targets`, `host:` at roll time,
`combat:enemy|ally:<tags>`, `dice(count, faces)`, `@count.items|equipped`, `endOfNextTurnOrScene`,
`turnOrUntilCombat`, `partyActor`, `choose` option `when` + `auto`, `pick skill essence|specializedOnly`, `pick team`,
`pick auto`, `pickGrant fields|replace`, `difDefenseSelf`, `button whisper|usedWhenDone`, the clicker's selected
token, `sessionStart`, `resourceSpent` ignoring loss / refund / rest writes, the worldTime sweep) and the earlier
sections. The behaviour differences recorded in slD3-slD6 were looked at again too.

| Verdict (re-checked items) | react | resource | other1 | other3 | Total |
|---|---|---|---|---|---|
| Convert (was skip) | 0 | 1 | 4 | 0 | **5** |
| Partial (was skip) | 0 | 1 | 0 | 0 | **1** |
| Still skip | 14 | 21 (+1 code half) | 20 | 22 (+1 code half) | **77** (+2) |
| Re-checked | 14 | 23 (+1) | 24 | 22 (+1) | **83** (+2) |

Rules fixed on items converted earlier (no new item): **Cruel Conflagration** (slD6 differences 3a and 3b) and
**Defender (PR CRB)** (slD4 difference 5). slD5 difference 5a (Body of Energy's drained Power firing the
`resourceSpent` Perks) is gone with no rule change, since the engine now skips writes flagged `essence20Loss`.

**10 rules were added to 6 pack items, and 3 existing rules were edited on 2 more.** With them,
`scripts/check-rules.mjs` reports 0 errors and 0 warnings. ESLint is clean on the four slice folders and the new test
file. Jest: see "Checks" below. No conversion needs anything outside my files.

## Converted

All are inserted as text (every one of these pack files is CRLF). Each new item gets a `system.rules` array as the
first key of `system`.

- **Extensive Research** (`packs/mlpcrbitems/_source/Extensive_Research_TwW8c51b3bCL9Rul.json`), 1 Use:
  - `pickGrant` of a spell, `from.fields: ["system.tier"]` (the index field the old `findItems` call loaded), with tags
    that are the old `canResearch`: `self:skill:spellcasting>=d4`, plus `any` of "not Superior" / `>=d8` and `any` of
    "not Virtuoso" / `>=d12` (an untiered spell needs d4, as before).
  - `replace: true`: what the Perk granted before (the earlier researched spell) goes only once a new pick is made, so
    a cancelled pick keeps it.
  - `until: "worldTime:604800"`: a week of game time, swept by the engine when game time moves on (the old
    `updateWorldTime` hook).
- **Zap Apple Jam** (`packs/iajitems/_source/Zap_Apple_Jam_L5B7d8mw0xeOHVkw.json`), **partial**, 1 Use + 1
  RollModifier (both `stacks: true`, so a second jar works on its own as before):
  - The Use is a `choose` whose options carry their own `when`, reading the old counters on the jar
    (`flags.essence20.zapCups`, `zapPastries`, so existing jars keep their counts). Cups: unset means 3 per
    quantity, as `cupsLeft` did. Each cup option first takes a cup: `updateItem add -1` when the count is stored, else
    `set 3 * quantity - 1`.
    - Eat a cup: `healEssence` of every point of Essence damage (the sum of max - value over the four Essences),
      then `setToggle jam` until the scene ends.
    - Bake: +6 pastries. Barter: a line.
    - Eat a pastry (offered while pastries > 0): -1 pastry, `healEssence 1`. In a combat (`combat:exists`),
      `setToggle pastry` until `turnOrUntilCombat` (that turn; in a set-up combat, until it starts - the old stamp's
      round/turn check). Out of combat, a banked Edge (`replace: true`) for the next roll (the old consumer).
  - The RollModifier gives Edge while either toggle is on (the old two roll sources).
  - **Stays code:** the shelf-life sweep (`registerMissionAdvanced`: gone after the second mission advance). There is
    no mission duration.
- **Good with Both** (`packs/atsitems/_source/Good_with_Both_bUfVm0jmCcAxu2M3.json`), 1 DialogSwitch: ↓1 "Off-hand
  attack", `forget: true` (the old checkbox always started unticked), when `item:type:weaponEffect`,
  `item:data:system.numHands=1` (the field is an integer defaulting to 1), and `self:itemCount:weapon:equipped>=2`.
- **Eat the Weak** (`packs/dditems/_source/Eat_the_Weak_hzCEZfTNDsQcOjUB.json`), 1 Use:
  - Two `require` steps, one gated on a target being there (`target:data:id`), one on none: the target (else the
    holder) must have an item named like "Addicted (Dark Energon)" (`hasItem:name~`).
  - `roll` Culture with `difDefense: willpower` and `difDefenseSelf` (with no target, the holder's own Willpower -
    the old `firstTarget() ?? actor`).
  - On a success, `deleteItem` of that Hang-Up on `targetOrSelf`; on a failure, a line.
  - The removed duplicate printing (`kIeIcRQVWg4v9CZL`) is linked to these rules by name
    (`rules/inherit.mjs#linkExistingCopies`), so `RITE_COPIES` isn't needed.
- **Disenfranchised** (`packs/ccitems/_source/Disenfranchised_bLBiNpqobnTDH769.json`), 1 Use:
  - A line naming the Willpower to beat, then a `button` with `who: anyone`, `runAs: clicker`, `once: false` (the old
    buttons stayed live). It acts as the presser's selected token, else their character (the old
    `canvas.tokens.controlled[0]?.actor ?? game.user.character`).
  - Pressed, it asks Deception / Intimidation / Persuasion and rolls it against
    `@item.parent.system.defenses.willpower.total`, with a pass or fail line.
- **Thick Hide** (`packs/ccitems/_source/Thick_Hide_yFlxX1ErTOlXXjz7.json`), 4 rules:
  - an `added` Trigger: `grant` the Riot Shield named "Thick Hide", `system.equipped: true` (the old `createItem`
    hook);
  - a Use, `when: not:rule:granted:type:shield`: the same grant (the old Use and its `canUse`);
  - an `unequipped` Trigger, `when: item:granted`: `updateItem granted set system.equipped true` (the old "always
    equipped" `updateItem` hook);
  - a Defense on Evasion, `@count.items.alteration - 2`, while the granted shield is raised and equipped
    (`rule:granted:data:system.active`, `...system.equipped`). That is the old `thickHideDelta` with the Riot Shield's
    +2. Shields made by the old code carry `grantedBy` too, so they are recognised.

Fixed rules on items converted earlier:
- **Cruel Conflagration** (`packs/fmmcitems/_source/Cruel_Conflagration_c22iQeKZY1TmPzFe.json`): both offer buttons
  gain `whisper: "owners"` and `usedWhenDone: true`. Only the holder's owners and the GM see the cards (as the old
  whispered cards), and a press without enough Personal Power, or backing out of the Fumble question, leaves the card
  pressable (as before). The inner GM damage buttons are unchanged.
- **Defender (PR CRB)** (`packs/prcrbitems/_source/Defender_4kt5qBpgTEgY8cGF.json`): `not:target:self` added to its
  Reaction's `when`, so the holder isn't offered Defender against their own attack on an adjacent ally (the old code
  excluded the attacker).

Removed with these:
- **`resource/mlp.mjs`:** Zap Apple Jam's `JAM_EDGE_FLAG` / `PASTRY_FLAG`, `cupsLeft`, `pastriesLeft`,
  `pastryActive`, its `registerRollSources`, the `resZapPastry` `registerConsumer`, `useJam` and its `registerUse`
  (the shelf-life sweep stays). The whole Extensive Research block (`RESEARCH_FLAG`, `TIER_SHIFT`, `SHIFT_ORDER`,
  `canResearch`, its `registerUse`, the `updateWorldTime` hook). The imports `registerConsumer` and `onHook`. The book
  quote above the jam is cut down to a one-line summary.
- **`resource/common.mjs`:** `IDS.extensiveResearch`.
- **`resource/resource.test.js`:** the `cupsLeft` / `pastriesLeft` / `canResearch` asserts (the Camper gate test
  stays) and the two Use-registration ids.
- **`other1/jtt.mjs`:** the Good with Both `registerDialogToggles` / `registerApplyDialog` and `oneHanded`;
  `O1_JTT.goodWithBoth`; the `ATS` import.
- **`other1/more.mjs`:** the Eat the Weak Use, `addictionOf`, the `o1RemoveItem` chat button, `RITE_COPIES`,
  `isRite`, `O1_MORE.eatTheWeak` and `.addictedDarkEnergon`; the imports `registerChatButton`, `firstTarget`, `post`.
- **`other1/cobra-gear.mjs`:** the Disenfranchised Use and its `o1Disenfranchised` chat button;
  `O1_CC.disenfranchised`; the imports `registerChatButton`, `post`.
- **`other1/alterations.mjs`:** the Thick Hide block (`thickHideDelta`, `grantThickHideShield`, the `createItem` and
  `updateItem` hooks, its Use) and its line in the derived pass; `O1_ALT.thickHide` / `.riotShield`; the imports
  `findSourced`, `sourceOf`.
- **`other1/other1.test.js`:** the Thick Hide delta test, the duplicate-Eat-the-Weak test and `o1EatTheWeak` in the
  registration list.
- **`react/core.mjs`:** unchanged; every export stays.

New tests (`module/rules/conv7-slD7.test.js`, 21) assert what the old ones did, and more:
- every rule on the eight items validates;
- Cruel Conflagration: both cards whispered to the owners and the GM, a short or backed-out press leaves the card
  pressable, a paid press uses it up;
- Defender: offered when someone else hits the adjacent ally, not on the holder's own card;
- Extensive Research: the spells offered for d8 / d6 / d12 / 2d8 / d2 (the old `canResearch` cases), the index field
  asked for, a cancelled pick keeping the old spell, a pick replacing it, the week's expiry;
- Zap Apple Jam: eating heals all Essence damage with scene Edge and 2 cups left, 6 cups for a jar of 2, baking,
  bartering, only a pastry offered once the cups are gone, an empty jar doing nothing, a pastry's banked Edge out of
  combat and its one-turn Edge in a combat;
- Good with Both: the unticked ↓1 and its gates (two equipped weapons, one-handed);
- Eat the Weak: the target's Willpower, success removing the Hang-Up, failure keeping it, no roll against a clean
  target, the holder's own Willpower with no target;
- Disenfranchised: the repeatable anyone-button, the selected token rolling first, else the character;
- Thick Hide: the shield granted on adding the Perk, the Use only when it's gone, the Alteration-count Evasion while
  raised, re-equipping only its own shield.

## Behaviour differences worth a decision

Same-line unless marked.

1. **Extensive Research**
   - A spell researched before the update carries the old `resResearchedUntil` flag, not a rules expiry, so it no
     longer goes after its week. It still goes when the next spell is researched (it carries `grantedBy`), or by hand.
   - The card is the engine's "Granted" line, not `ResResearchLine`.
   - A Spellcasting shift stored as `autoSuccess` / `criticalSuccess` counted as above d12 before. The prerequisite
     tag doesn't know those, so nothing would be offered. Skills don't store those shifts in practice.
2. **Zap Apple Jam**
   - Out of combat, a pastry's Edge is a banked bonus, used by the next roll even while a cup's scene-long Edge also
     applies. Before, the scene Edge took precedence and the pastry waited.
   - An empty jar does nothing. Before, a warning toast.
   - The question no longer shows the counts. The result lines show what is left instead.
   - The Edge sources carry the rule labels ("Zap Apple jam (Edge)", "Zap Apple jam pastry"), not the old ones.
   - The scene Edge lives on the jar (its toggle). If the jar spoils mid-scene, the Edge ends with it. Before, it was a
     flag on the actor.
3. **Eat the Weak**
   - The Hang-Up is found by a name containing "Addicted (Dark Energon)", on any item type. Before: a Hang-Up copied
     from that compendium item or whose name started with it.
   - On a target the user doesn't own, the Hang-Up is removed at once through the GM. Before, a "Remove Hang-Up"
     button was posted for the owner.
   - "Not addicted" is a rules card (the `require` message), not a toast.
   - The removed duplicate copy needs the GM's name-linking pass (`linkExistingCopies`, once per system version)
     before it runs the rules.
4. **Disenfranchised**
   - One button asks the Skill, instead of three Skill buttons.
   - The Use posts its own rules card (the Willpower line) and then the button card.
   - The DIF is the holder's Willpower when the button is pressed, not when it was posted.
   - A GM with no token selected rolls as the Disenfranchised character (the button's GM fallback). A player with no
     token and no character finds the button disabled. Before, both got a "need a helper" warning.
5. **Thick Hide**
   - The raised shield's own bonus is taken as the Riot Shield's +2. The old code read the copy's
     `activeEffect.option1.value`, so it differs only for a hand-edited copy.
   - Adding the Perk posts a "Granted" card. Before, nothing.
   - The shield is known by `grantedBy`, not the `o1ThickHide` flag. Old shields carry both.
   - The Evasion line reads "Thick Hide (raised shield: one per Alteration)".

## Still skipped (77), and what each still needs

### react (14)
- **Defender (Megaform Trait)**: Reaction `who` for the pilots of a Megaform's members (permanent code: pilot lookup).
- **Junker**: an "equipment broke" event, and a drop-to-0 event for vehicles.
- **Not On My Watch (IA)**: a drop-to-0 Health event outside `applyDamage` (`whisper: owners` now exists for its card).
- **All For One**: a drop-to-0 Health / Power event, and a two-answer card whose 1d2 / 1 Health gift is restored on
  the caller.
- **Agency**: a rule read by dice.mjs's Fumble Story Point grant (permanent code until dice.mjs reads a rule).
- **Revengeful**: a "stored attacker = this target" tag (the `pendingRevengeful` set by dice.mjs).
- **Inspirational Leader (combat half)**: an aura keyed on the leader's last successful Skill until the end of the round.
- **Monster Morph**: a roll against every creature within 10 ft at once, and a per-Path rule home.
- **Iron Bravado (share half)**: copying Condition immunities to picked allies for a while.
- **Cyborg**: an Essence damage redirect and a heal lock.
- **Mind Beam**: a rule reading the spell's pre-roll effect choice.
- **Energized**, **Spiked**, **Energy Field**: an incoming DialogSwitch (per targeted wearer) and a "plain Reach" tag.

### resource (21, plus the code half of Repair Progress)
- **Play Favorites**, **Play Favorites Against Each Other**, **This, I Command**, **Ruthless Efficiency**: a personal
  Story Point pool resource.
- **Money Talks**, **Capable Freelancer**: a confirmable pre-roll Skill swap that rewrites the dataset.
- **Motor Pool Connections**: a vehicle picker, per-vehicle budgets, a grant onto another actor (permanent code).
- **Fuel Efficient**: `dice(@var.spent, 4)` sums the dice, but the Perk counts the 4s (one Energon back per 4), and every
  rolled amount posts a dice line where the old code posted only on a 4. The sheet's Rest update also isn't flagged
  (`isRest` / `essence20Rest`), so a Rest that lowers Energon would roll it; the old code skipped Rest updates.
- **Repair Progress (code half)**: the Rest carry-over and the "spent" mark (an Energon cap rule).
- **Body of Energy (damage / unmorph halves)**: a pooled-resource damage modifier, and an unmorph Trigger with the
  pre-update values.
- **Dark Energon**, **Primal Energon**, **Red Energon**, **Synth-En**, **Word of Unicron**: the addiction subsystem
  (permanent code).
- **Together We Stand**: a "two or more team members" combat-start gate and ledger-recorded temporary Health taken
  back at scene end.
- **Think Fast!**: `storyPointSpent` with the spend kind.
- **We Improvise**: a per-combat ledger.
- **Beast Mode**: an event on its flag and level-gated packages (permanent code).
- **Camper**: a per-recipient `choose` (Health or 2 Essence asked per member).
- **Circle of Magical Friends**: Circle recipients and copying items (permanent code).
- **History Buff (Use half)**: a blind one-die-smaller roll.

### other1 (20)
- **Interspatial Pause**, **Timeslide**: hiding / moving tokens (permanent code).
- **Quantum Trigger**: retrying the last Skill Test with a cumulative ↓n.
- **Time Strike**, **Onslaught**: hit-card rider options from sibling effects.
- **Special Program**: compendium-Perk picks with prerequisite labels.
- **Savant Skill**: a reroll-result Trigger.
- **Unlucky (For You)**: the Snag half is dice.mjs's, armed on the target's next Skill Test, with a per-target limit.
- **Altered**, **Additional Alteration**: an Alteration cost waiver.
- **Overload**, **Genetic Support**, **Advanced Alteration Emulator**: a lent Alteration benefit.
- **Standard Deflecting Weapon**, **Limited Deflecting Weapon**: a linked shield granted per upgrade, equipped with its
  host weapon, and an attack refusal while raised.
- **Shield Fighter**: an Element offered as a rider option on the attack card, paid from Personal Shield's pool.
- **Armor Matrix (Light / Medium / Heavy)**: a create veto, and a best-of Defense.
- **Multimorph**: an origin-perk picker.

### other3 (22, plus the code half of Solarix Shard)
- **Betrayal**: the assisted roll's result for the assister, and a "split from the party" state.
- **Dabbler**: a die-ladder step for `updateActor` (`pick skill essence` now covers the filtered pick).
- **Self Improvement**: per-target per-scene stored Essence picks.
- **Follow Me!**: a count of "actors carrying my mark", a per-follower d4, and those followers as recipients.
- **Better Together (+ Hang-Up)**: a pair read from either actor (permanent code; `pick from: team` covers the pick).
- **Guardian Blast**: a group test with a tally (permanent code).
- **Mega Defender**: a stored form with DerivedStat `set`, and shared action economy (permanent code).
- **Metallic Armor Power Up!**: the end is shared with the crit / Defeat paths and power-handler's switch-on, and the
  minion damage cut needs a `taken` modifier that sees the attacker and an "is a minion" tag.
- **Solarix Shard (code half)**: the Power Weapon pick and its hit-card rider option.
- **Void Touched**: a step that writes Essence maxima from picks, with an undo on delete.
- **Holographic Sights**: `@rolled.<path>` (the rolled effect's own ↓ as the ↑).
- **Scramble Field Generator**: marks with a mode read by the marker's side.
- **Again and Again and Again**: a repeat-attack step.
- **Balance and Compensation**: a die-ladder ItemModifier op.
- **Bump & Run**: a "moved N ft since" tag.
- **EM Protective Lining**: the ↓6 half would fit (an incoming RollModifier with `rule:hostEquipped`), but the Defense
  half needs a sum over the defender's equipped computerized armors' Evasion, so `isLined` stays code either way.
- **Perfect Placement**: placed zones (permanent code).
- **Precise Chronometrics**: a distribute-points step (Initiative bonuses to several combatants, capped at Smarts).
- **Now You Don't (+5)**: a flat result bonus, and the Hide state as data.
- **Pop Out**, **Telltale Sign**: a roll against several targets' best Defense, and the Hidden state.
- **Same Principle**: `ruleWeaponTraits` copies the weapon without its `id`, so `item:picked:` can't match it.
- **Gluten-Tolerant**: a "forbids" rule (create veto).

## Edits outside my files

None.

## Unused strings

These `lang/en.json` keys (under `E20`) have no code use left:
- other1: `O1GoodWithBothToggle`, `O1NotAddicted`, `O1EatTheWeakFail`, `O1EatTheWeak`, `O1RemoveHangUp`,
  `O1DisenfranchisedGate`, `O1NeedHelper`, `O1DisenfranchisedPass`, `O1DisenfranchisedFail`, `O1ThickHideGranted`;
- resource: `ResResearchLine`, `ResZapJamSource`, `ResZapPastrySource`, `ResZapJamEat`, `ResZapJamBake`,
  `ResZapJamBarter`, `ResZapJamPastry`, `ResZapJamEmpty`, `ResZapJamPrompt`, `ResZapJamEatLine`,
  `ResZapJamBakeLine`, `ResZapJamBarterLine`, `ResZapJamPastryLine`.

Still used: `ResZapJamSpoiled` (the shelf life), `O1NotOwner` (other1's remaining chat buttons).

## Files touched

- Packs (rules inserted as text, CRLF like these files):
  - `packs/mlpcrbitems/_source/Extensive_Research_TwW8c51b3bCL9Rul.json` (1 rule)
  - `packs/iajitems/_source/Zap_Apple_Jam_L5B7d8mw0xeOHVkw.json` (2)
  - `packs/atsitems/_source/Good_with_Both_bUfVm0jmCcAxu2M3.json` (1)
  - `packs/dditems/_source/Eat_the_Weak_hzCEZfTNDsQcOjUB.json` (1)
  - `packs/ccitems/_source/Disenfranchised_bLBiNpqobnTDH769.json` (1)
  - `packs/ccitems/_source/Thick_Hide_yFlxX1ErTOlXXjz7.json` (4)
  - `packs/fmmcitems/_source/Cruel_Conflagration_c22iQeKZY1TmPzFe.json` (2 rules edited)
  - `packs/prcrbitems/_source/Defender_4kt5qBpgTEgY8cGF.json` (1 rule edited)
- Slice (CRLF kept): `resource/mlp.mjs`, `resource/common.mjs`, `resource/resource.test.js`, `other1/jtt.mjs`,
  `other1/more.mjs`, `other1/cobra-gear.mjs`, `other1/alterations.mjs`, `other1/other1.test.js`.
- New: `module/rules/conv7-slD7.test.js` (21 tests) and this file.

**Rules added: 10** (on 6 items), plus 3 rules edited on 2 items.

## Checks

- ESLint (`--ext .js,.mjs`, linebreak-style off) on `react/`, `resource/`, `other1/`, `other3/` and
  `conv7-slD7.test.js`: clean.
- `node scripts/check-rules.mjs`: 1893 rules on 1177 items, 0 errors, 0 warnings (the totals include other agents'
  work).
- Jest: the four slice folders, `conv7-slD7.test.js`, `conv6-slD6.test.js`, `conv5-slD5.test.js`,
  `conv4-slD4.test.js`, `conv3-slD3.test.js` and `engine7.test.js` - 10 suites, 194 tests, all pass. Across
  `module/rules`, one failure is another agent's: `conversions.test.js` "Bookworm: ↓1 in a library scene, but not on
  Initiative" now gets an Initiative source.

## Engine pieces the remaining skips need (most useful first)

1. **A drop-to-0 event from any Health / Power write, and an "equipment broke" event** (small to medium). Unblocks
   Not On My Watch (IA), Junker (both halves) and, with a two-answer card whose payment is the presser's, All For One.
2. **Hit-card rider option step** (medium): an alternate damage button on the attack card's own row. Unblocks Shield
   Fighter, Solarix Shard's Fire half, Time Strike and Onslaught.
3. **Personal Story Point pool resource** (medium). Unblocks Play Favorites, Play Favorites Against Each Other, This,
   I Command and Ruthless Efficiency.
4. **Fuel Efficient pair** (small each): a formula that counts dice showing a face or more
   (`count(@var.spent, 4, 4)`), with no dice line when nothing comes of it; and the sheet's Rest update
   (`sheet-handlers/listener-misc-handler.mjs#_applyRestBenefits`) passing `{essence20Rest: true}` so `resourceSpent`
   skips it, as the old Energon hook skipped Rest updates. The Rest flag would also keep the Inner Conservation /
   Power Efficiency / Dino Charged Triggers from firing on a Rest that lowers Power from above its maximum.
5. **Per-recipient `choose`** (small to medium). Unblocks Camper.
6. **Initiative helpers** (medium): recipients "actors carrying my mark", a count of them, and a distribute-points
   step. Unblocks Follow Me! and Precise Chronometrics.
7. **An incoming DialogSwitch** (medium): a switch on the attacker's dialog that the defender's item offers (one per
   targeted wearer), with a "plain Reach" attack tag. Unblocks Energized, Spiked and Energy Field.
8. **Small one-offs** (small each):
   - a die-ladder op for `updateActor` / ItemModifier: Dabbler, Balance and Compensation;
   - `ruleWeaponTraits` passing the weapon's `id`: Same Principle;
   - `storyPointSpent` with the spend kind: Think Fast!;
   - a "stored uuid = target" tag: Revengeful;
   - a stored-Skill aura until the end of the round: Inspirational Leader;
   - a sum-over-items formula (`@sum.<item tags>.<path>`): EM Protective Lining's Defense half;
   - a refund Trigger lowering `@var.spent` for later `resourceSpent` Triggers: slD5 difference 5b (Inner
     Conservation + Dino Charged);
   - `until: "mission"` counted in mission advances: Zap Apple Jam's shelf life;
   - `@rolled.<path>` (the rolled item's own numbers): Holographic Sights.
9. **A retry-the-last-test step with a cumulative ↓** (medium). Unblocks Quantum Trigger, and Savant Skill with a
   reroll-result event.
10. **A lent Alteration benefit** (large design). Unblocks Overload, Genetic Support and Advanced Alteration Emulator.
11. **Effectively permanent code** (bespoke UI or whole subsystems):
    - Motor Pool Connections; Circle of Magical Friends.
    - Interspatial Pause and Timeslide (tokens); Perfect Placement (zones).
    - Beast Mode packages; the Energon strains and Word of Unicron (addiction).
    - Monster Morph; Mega Defender; Guardian Blast.
    - Better Together (world-PC pairing).
    - Armor Matrix and Gluten-Tolerant (create vetoes); Special Program / Multimorph pickers.
    - Money Talks / Capable Freelancer (dataset rewrite); Agency (dice.mjs's Fumble grant).
    - Megaform Defender (pilot lookup); Cyborg; Iron Bravado's share; Metallic Armor's on/off shared with
      power-handler; the Deflecting Weapons' linked shield.
