# Batch slA2: re-check of slA (`zord1`, `zord2`, `pr1`, `pr2`, `pr3`) against the 2026-10-04 engine pieces

**Scope:** every item `docs/rules-batches/slA.md` marked Skipped, plus the code half of every item it marked Partial,
re-checked against the engine sections "Engine features added 2026-10-04 (after the slice round)" and "(the bigger
pieces)": SkillSubstitution `scope: item`, DialogSwitch `defaultWhen`, the new `check:` names, the `targeted` /
`dealtDamage` / `defeatedEnemy` Trigger events, the item steps (`createItem`, `deleteItem`, `updateItem`,
`spendQuantity`), `pick` with `{choice.<key>}` / `item:picked:`, and `button`. The batch was done in three parts
(`rules/slA2-zord`, `rules/slA2-pr1`, `rules/slA2-pr23`), all from `Rules-Engine-Phase-1` at 8001924e, and merged into
`rules/slA2`. Each part's full write-up follows below.

| Verdict (re-checked items) | zord1 + zord2 | pr1 | pr2 + pr3 | Total |
|---|---|---|---|---|
| Convert (was skip) | 0 | 0 | 1 | **1** |
| Partial (was skip) | 1 | 0 | 0 | **1** |
| Partial, nothing more converts | 9 | 2 | 0 | **11** |
| Still skip | 48 | 17 | 28 | **93** |
| Re-checked | 58 | 19 | 29 | **106** |

2 rules were added to 2 pack items. After the merge, `scripts/check-rules.mjs` counts 1534 rules on 1056 items (the base
had 1532 on 1054), with 0 errors and 0 warnings. ESLint is clean and jest passes (503 suites; 9628 passed, 2 skipped).
The parts merged without conflicts; no slice file became empty.

**Converted:**
- **Dedicated Carrier (pr2):** an `added` Trigger that deletes the Combiner Feature (`deleteItem`, `all`) and grants
  Carrier unless one is held. `applyDedicatedCarrier`, three `PR2` ids, a slice test and a lang key are removed.
- **Mercurial Nature (zord2), partial:** its automatic Hybridization grant is a `Grant` rule (the old hook always
  granted, even beside a bought Hybridization - so does the rule). Unlimited Mass Shift stays code.

**Behaviour differences** (detail in each part):
- **Dedicated Carrier (same-line):** the chat line becomes the rules card ("loses Combiner" / "gains Carrier"), and
  nothing is posted when there was nothing to change. "Already has a Carrier" is matched by name, not compendium source.
  A world copy made before this change has no rule, so dropping it no longer swaps the Features.
- **Both:** the granted copy records its source in `_stats.compendiumSource` instead of `flags.core.sourceId`; every
  reader in `module/` checks both.

**Engine pieces the remaining skips need** (most useful first; each part's list has the detail):
- **Use precedence:** a rule Use is hidden when the item also has an extension Use. Fixing that alone unblocks
  Jackrabbit's carrots, Turbo Cart, Time Force's Electro Booster / Vector Weapon and Ninja Storm's element rows.
- **Old-flag picks:** a way to move picks stored in old flags (`pr1DinoGem`, `pr1LightspeedBoost`, Anti-Armor's) to
  where `pick` stores them; `pick {from: ownedItem}` with item-tag filters and auto-pick of a single option
  (Dino Gem Integration, Energem Infusion, Anti-Armor).
- **Hit pieces:** the hit's damage value as a `hit` Trigger variable, a hit-time damage-type override, switch keys
  visible to the post-hit damage note (Incapacitation Ammo, Warhead Magazines, Solar Power, Supersonic, Primordial
  Power).
- **The Form lifecycle:** a Morph-time Form choice plus un-equip / restore steps.
- **Movement / derived:** a stage after the derived hooks and gravity (Carapaced, Additional Pair of Limbs,
  Two-Handed Melee, Bend Physics).
- **Scopes:** a team scope (every PC), an owned-Zord link scope and recipient, Megaform roster reading.
- **Dice in formulas and steps,** and a random option on `choose` / `pick`.
- **More events:** before a roll, moving on one's own turn, an Essence change, an item removed, equip / unequip, other
  actors' rolls and Conditions, a Group Test result; `takesDamage` knowing melee and the targeted Defense;
  `defeatedEnemy` credit for "last hit by this actor" (S.W.A.T.).
- **Other:** size class as text, rules granting Resistances / Immunities, `until: {rounds: N}` and `until: mission`, a
  bank holding a bonus die, a button on the roll's own card, a GM Story Point resource, an opposed-roll step, a
  `pickPerk` pack filter, a Defense "ignore armor" mode after best / halve, an incoming DialogSwitch.

---

## Batch slA2 (part): the `zord1` and `zord2` extension slices, second pass

**Scope:** every item `slA.md` (the zord1 + zord2 part) left skipped, plus the code half of each of its partials.
Each was re-checked against the engine pieces added on 2026-10-04: SkillSubstitution `scope: item`, DialogSwitch
`defaultWhen`, the new `check:` names, the `targeted` / `dealtDamage` / `defeatedEnemy` Triggers (and the target that
`takesDamage` now gets), the item steps (`createItem` / `deleteItem` / `updateItem` / `spendQuantity`), `pick` with
`{choice.<key>}` / `item:picked` / `self|target:picked`, and `button`. Engine pieces that were already there in round 1
were looked at again too. The `pr1`, `pr2` and `pr3` slices are done by other agents on other branches.

**Counts** (58 items re-checked: slA's 49 zord skips plus the code halves of its 9 zord partials. Primate and
Carapaced are counted per item, as slA counted them):

| Verdict | Items |
|---|---|
| Convert | 0 |
| Partial | 1 (Mercurial Nature, a skip before) |
| Still partial (nothing more converts) | 9 |
| Still skip | 48 |

1 rule was added to 1 pack item. After this batch, `scripts/check-rules.mjs` counts 1533 rules on 1055 items, with 0
errors and 0 warnings. No slice file became empty, so `extensions/index.mjs` is unchanged.

Most of what is left in these slices is Form, Megaform and Zord-link machinery. The new pieces don't reach any of it.
Use buttons are the exception, and those are blocked by Use precedence: an extension Use hides a rule Use on the same
item.

### Partial (1)

| Item | Converted | Rule | Stays code |
|---|---|---|---|
| Mercurial Nature | The Hybridization it grants when it is added | Grant `uuid: Compendium.essence20.tf_crb.Item.R5SobOsimfa7mvdy` (no `skipIfOwned`) | Unlimited Mass Shift. `massShiftUsesPerDay` reads `ZORD2.mercurialNature`, so that key stays |

Why it is exact:

- **No `skipIfOwned`.** The old `createItem` hook granted a Hybridization unless the actor already held one *granted
  by this copy* (`grantedBy == item.id`). On `createItem` the copy has just been made, so nothing can carry its id
  yet, and the check always passed. A Hybridization bought separately never stopped the grant. `skipIfOwned` would
  stop it, so the rule leaves it off and always grants, as the old hook did.
- **Same hook, same picker.** `rules/lifecycle.mjs#onCreateItem` runs on `createItem` for the same user
  (`userId == game.user.id`). It creates the copy with `createEmbeddedDocuments`, and that copy's own `createItem`
  still runs the slice's Hybridization picker (`pickHybridization`), as the old `grantCopy` path did. Neither path
  posts a chat line for the grant.
- **Removal.** `onDeleteItem` already removed every item whose `grantedBy` is the deleted item, for any item. The old
  grant was marked `grantedBy` too, so removing Mercurial Nature takes its Hybridization with it, as before.

Removed: the `ZORD2.mercurialNature` branch of the `createItem` hook in `zord2/hybridization.mjs`, and the `sourced`
import it alone used. Nothing tested that branch. The new test is in `module/rules/conversions.test.js` (the
`// slA2 zord` block).

### Behaviour differences

1. **How the granted copy is marked (same line).** The old `grantCopy` wrote `flags.core.sourceId`. The Grant rule
   writes `_stats.compendiumSource`. Every reader of the Hybridization's identity (`zord2/snag.mjs#hybridsOf`,
   `holds` / `sourced` in `zord2/common.mjs`, the rules index) checks both, so nothing reads it differently. The test
   checks that `hybridsOf` sees the granted copy.
2. **Batch creation with kept ids (edge case).** Suppose Mercurial Nature and a Hybridization it granted elsewhere are
   created together, with `keepId`, in one `createEmbeddedDocuments` call. The old guard could then have seen the
   Hybridization and skipped the grant. The rule grants a second one. Ordinary play (a sheet drop, a level-up grant)
   never creates them that way.

### Still partial (9): what stays code, re-checked

| Item | Still code | Why it still can't convert |
|---|---|---|
| Ranger Operator [Form] | The gear swap | Needs the Form lifecycle (un-equip by weapon class, restore on de-Morph). `deleteItem` / `createItem` can't restore what was un-equipped, and nothing runs them at Morph time |
| Beast Morpher [Form] | The animal pick, Cheetah's vortex / dog check, Gorilla's berserk, Jackrabbit's carrots | The pick is stored in `flags.essence20.zord1Beast`, and four existing rules plus the Form Use read it. A `pick` step stores under `flags.essence20.rules.choices`. Every row of the Form Use (vortex, dog, calm, carrots) sits inside the extension Use, which hides a rule Use (Use precedence). The berserk needs dice in a step (1d4 rounds). Jackrabbit's Fumble Snag could be a `fumbled` Trigger + `mark` + RollModifier, but the carrots Use that clears it is a Form Use row |
| Ninja Storm Wind Ranger [Form] | The element, the blasts, Duplication, the mind-control Snag | The element runs from a Form Use row (Use precedence). Duplication's −1 Health runs after `ruleDerived`. The Snag is offered to whoever targets the Ranger: it needs an `incoming` DialogSwitch |
| Time Force [Form] | The gear swap, Electro Booster / Vector Weapon | The Form lifecycle; the two rows sit in the Form Use (Use precedence) |
| Supersonic [Form] | The Xenotech armor ↑ per worn piece, the unarmed Energy switch, the Blade Blaster's Sonic damage, the Gridwide Communicator | The ↑ needs `@count.items:<tags>`. The two damage-type changes happen on the hit card, while a `DamageType` rule is decided at roll time and also feeds the Resistance Snag. The Communicator is Form lifecycle |
| Megafauna | Smarts/Social 3, the summon-in-form flag, the Use, the Animal Handling swap, the combine warning | Smarts/Social 3 must land after Terrorzord's 5/4, which stays code. A `pilot`-scope SkillSubstitution (driving → animalHandling) is close, but `applySkillSubstitution` gives `holder:` tags no holder, so the Zord's `zord1Megafauna` flag can't be read. There is no `vehicle:data:` tag either. It would also start rewriting `dataset.shift`, which the old pre-roll left alone. The flag is set by `preUpdateActor` / `createItem` hooks, and the Use toggles it |
| Hybridization | The pick, the daily Mass Shift pool, the H Uses, Steady Hands, Helping Hand, Evasive Conversion | The H Uses spend a daily pool that the Mass Shift Role Perk shares and that scales with level (no rule resource), inside the extension Use. Change Size writes the size class (text). Steady Hands and Helping Hand are read by patched core checks |
| Carapaced (Common), Carapaced (Large) | The +20 Ground when Underground isn't picked | Rotor Blades (`tf3/rolls.mjs`) still reads Ground between `ruleDerived` and this hook: it needs a late DerivedStat stage |

### Still skipped (48)

#### zord1: Forms

- **Lightspeed Response.** Needs the Form lifecycle: a Morph-time choice between Forms, plus un-equip / restore. The
  item steps can grant and delete but can't undo an un-equip when the Morph ends.
- **Solar Power.** Needs a hit-time damage-type override and a per-hit rider option (+1 Fire). The element pick could
  be a `pick` from `damageType`, but nothing downstream can use it on the hit card.
- **Turbo.** Form lifecycle. The Turbo Cart row is inside the Form Use (Use precedence).
- **Dino Thunder.** Fourteen per-copy powers, each a timed state with its own costs, canvas point picks and a
  generated natural weapon. `createItem` could make Ptera Scream, but the Use still has to branch on the per-copy pick
  (stored in `zord1DinoPower`), and canvas point steps are missing.

#### zord1: Purple Ranger

- **Emotional Range.** Needs a list ChoiceSet that grows with a Role Points value and is read by
  `emotional-mastery.mjs`.
- **Emotional Strength.** `targeted` covers only rolls made *against* the holder. The triggers need other actors'
  rolls (an ally's or enemy's crit / Fumble), Conditions gained by allies, a Group Test event and a roll-total outcome.
  They also share a per-scene flag with `emotional-mastery.mjs`, and the regain is 1d2 (dice in steps).

#### zord1: Zord-side Perks and Features

- **Rex Feature, Additional Zord.** Need a `pickGrant` recipient for "my owned Zord" (from `system.actors`) with an
  "exclude held" filter. Additional Zord also needs a pre-update veto (one Zord per scene).
- **Terrorzord Nature.** Needs an `ownedZord` link scope (the owner's Zord isn't a crewed link) and a `spend` switch
  paid from the linked pilot.
- **Anti-Armor.** The Critical Effect needs an armor-shred CriticalOption. The trait half could be a `pick`
  (`ownedItem`, weapon) plus a WeaponTrait with `item:picked:`, but that is not exact. The old code writes the traits
  into the weapon permanently, and it auto-picks when there is only one weapon (a `pick` step always asks). The
  shred, which stays code, reads the old flag.
- **Phantom Focus: Ship Integration.** Needs a timed link from the driver to the vehicle that `driven`-scope rules can
  read.

#### zord1: Megaforms

- **Multi-Megaform, Signature Finishing Move, Advanced Signature Finishing Move, Power Master, Target Master,
  Accurate Combiner, Assault Weapon.** Need Megaform roster links (participants' traits, which participant's attack is
  used, ×4/×5 hit damage, mirrored items).

#### zord1: Bodies

- **Enlarged, Shrunk.** Need a step or DerivedStat that changes the size class (text), plus an equip veto.
  `updateItem` changes items, not the actor.
- **Revolutionary Shape-Shifting.** Needs a text prompt step, a size-step step, and a scene-timed state that a switch
  can read.
- **Additional Pair of Limbs.** The +10 Ground needs a late DerivedStat stage (Rotor Blades again). The unarmed ↓1
  needs a `roll:targets>=2` tag. The stand-up is a mode-picker row.

#### zord2: Combiners (Enigma of Combination)

- **Gestalt Combiner, Matched Combiner, Universal Component, Efficient Combination, Invigorating Connection,
  Macro-Magnetic Linkage, Safe Release, Core Body (EoC), Titan Hardpoint, Enhanced Attack (EoC), Universal
  Receptors.** Read by the merge, break-apart and generated-attack code: they need Megaform roster reading.
- **Gestalt Hunter.** Needs a rule that changes another switch's effect (↓1 instead of the focus Snag).

#### zord2: Power Rangers Zords

- **Enhanced Melee Attack, Enhanced Ranged Attack.** Generated weapons on the Megaform, used once per scene per copy.
  `createItem` can't regenerate them as the roster changes.
- **Warrior Mode (size), Mesh Zord.** Need a size-class DerivedStat (text). Mesh Zord also needs flag-list picks and a
  Megaform-membership test.
- **Power Matrix.** A reserve that scales with the number of copies, drawn to the driver, and refilled on the pilot's
  rest.
- **Versatile Combiner.** A Trait granted by the owner's spectrum colour, taken from the Role's name.
- **Adaptable Future Tech.** A combine-eligibility check.
- **Zord Feature (slot).** Needs the owned-Zord recipient.
- **Zord Ultra Mode.** Turns other Features' Active Effects on and off. Needs an "end when Defeated" lifecycle.
- **Defender Torozord.** Creates a Megaform actor.

#### zord2: Gear and Transformers

- **Shinobi of the 63rd Hexagram.** The Defense picks turn on two of the item's four Active Effects, and copies that
  already exist keep them. Rules gated by a `pick` would add in `ruleDerived` with a different breakdown. The
  motorcycle untrained-Snag immunity needs a `vehicle:name~` tag.
- **Rotary Blade (weapon), Rotary Blade (shield).** These would need a grant-unless-held step (the `grant` step has no
  `skipIfOwned`), plus the shield's two-way Use. The weapon's "can't attack in shield mode" check reads an old
  slice flag.
- **Dozer Blade (Alt Mode).** Needs a step that deletes a Rough Terrain Region (or asks the GM to). A `button` with
  `who: gm` could carry the ask, but no step clears the Region.

### Engine pieces the remaining skips need

1. **Use precedence.** Let a rule Use show beside an extension Use on the same item (or split the Form Use). This
   alone would unlock Jackrabbit's carrots, Turbo Cart, Time Force's rows and parts of Ninja Storm.
2. **The Form lifecycle.** A Morph-time choice between held Forms (with costs), and un-equip / restore steps.
3. **Hit-time damage-type overrides and per-hit rider options** (Solar Power, Supersonic, Signature Finishing Move).
4. **A late DerivedStat stage**, after the hand-written derived hooks (Carapaced, Additional Pair of Limbs).
5. **An `ownedZord` link scope and recipient** (Terrorzord, Rex Feature, Additional Zord, Zord Feature slot). Also a
   holder context in `applySkillSubstitution` or a `vehicle:data:` tag (Megafauna's Animal Handling swap).
6. **A text-valued size DerivedStat / size step** (Warrior Mode, Mesh Zord, Enlarged/Shrunk, Shape-Shifting, Change
   Size).
7. **Trigger events on other actors' rolls and Conditions, a Group Test event, and a roll-total outcome** (Emotional
   Strength). Dice in steps (1d2, 1d4).
8. **An `incoming` DialogSwitch** (Ninja Storm), and a rule that changes another switch's effect (Gestalt Hunter).
9. **`@count.items:<tags>`** (Supersonic), **`roll:targets>=N`** (Additional Pair of Limbs), **`vehicle:name~`**
   (Shinobi).
10. **`grant` with `skipIfOwned`** (Rotary Blade) and a Region-clearing step (Dozer Blade).
11. **Megaform roster reading** (a larger design).

### Files touched outside the slices

- `packs/tfcrbitems/_source/Mercurial_Nature_G5LYO99aCFly6oq0.json`: the Grant rule (inserted as text, LF kept).
- `module/rules/conversions.test.js`: the `// slA2 zord` block, appended at the end. The import line is unchanged.
- `docs/rules-batches/slA2-zord.md`: this file.

---

## Batch slA2, part pr1: `module/helpers/extensions/pr1/`, second pass

**Scope:** every item `slA.md` (slice pr1) left skipped, and the "stays code" half of each of its two partials,
re-checked against the engine pieces added on 2026-10-04 ("after the slice round" and "the bigger pieces"):
SkillSubstitution `scope: item`, DialogSwitch `defaultWhen`, the new `check:` names, the `targeted` / `dealtDamage` /
`defeatedEnemy` Trigger events (and `takesDamage`'s target), the item steps (`createItem`, `deleteItem`,
`updateItem`, `spendQuantity`), `pick` with `{choice.<key>}` / `item:picked:` / `self:` / `target:picked:`, and the
`button` step. Each item was checked against the code in `extensions/pr1/` and the new pieces' code in
`module/rules/` (`steps.mjs`, `triggers.mjs`, `buttons.mjs`, `predicate.mjs`, `adapter.mjs`, `bank.mjs`,
`expiry.mjs`, `limits.mjs`).

**Counts** (19 items re-checked: slA pr1's 17 skips plus the code halves of its 2 partials):

| Verdict | Items |
|---|---|
| Convert | 0 |
| Partial | 2 (unchanged: Advanced Dino Gem Integration, Lightspeed Boost) |
| Still skip | 17 |

No rules were added and no code was removed. `scripts/check-rules.mjs` still counts 1532 rules on 1054 items. No
slice file became empty, so `extensions/index.mjs` is unchanged.

### Converted (0)

None. Each new piece got close to some items, but none reproduces an item exactly. The notes below say why for each
one.

### Partial (2, unchanged)

| Item | Already rules (slA) | Still code, and why the new pieces don't cover it |
|---|---|---|
| Advanced Dino Gem Integration | Sense / Stealth ↑2, Shield's Snag | **The picker:** `pick {from: list}` would store the option under `flags.essence20.rules.choices.<key>`. Every existing copy keeps its option in `flags.essence20.pr1DinoGem`, and the Stealth / Primordial / Resonance code still reads that flag, so moving it would break existing worlds. The auto-ask when the Feature lands on a Zord (the `createItem` hook, for the dropping user only) has no rule counterpart either. **Primordial Power:** the +2 is a flat post-hit `damageBonusNote`. `ruleDamageDealt` (unscaled dealt DamageModifier) still builds its `when` context without the roll's switch keys, so `roll:switch:` can't gate it. A DialogSwitch `damage` is scaled by Degrees of Success. **Stealth's +10 ft:** added after gravity, only to speeds above 0. A Movement rule's `final` stage runs before gravity. **Genetic Resonance:** rewrites the summon-ready round. No event or step reaches it. |
| Lightspeed Boost | Medical's ↑2 | **The picker** needs sub-choices (Hazmat: resist two or be immune to one, then which types), and its storage has the same problem as Dino Gem's. **Aerial / Swim at least 40 ft and Medical's +10 ft:** added after gravity (see above). **+2 Evasion:** depends on token elevation, and there is still no elevation tag. **Hazmat / Pyrotechnic:** these set boolean Resistances / Immunities, which DerivedStat can't do. **The Pyrotechnic Use** shares the item's Use button with the picker. |

### Behaviour differences

None. Nothing changed.

### Still skipped (17), and what each still needs

| Item | What is still missing (re-checked against the 2026-10-04 pieces) |
|---|---|
| Mobile Headquarters (rest) | Unchanged. The holder's own Initiative Edge is derived data (`skill.edge = true`), and DerivedStat writes only numbers. A RollModifier would add a source the player could untick. The Megaform half needs a Megaform-to-component link. The scene-wide Edge for allied Zords and vehicles needs a scene-wide aura (not a radius) that filters by actor type. |
| Overdrive | The cost is paid by a seated crew member (Personal Power max 4+). `pick {from: ally}` lists allies by token distance, not the crew, and costs are paid by the rule's actor. It also needs a per-turn "options already taken" memory (up to 3 different options per turn) and per-turn derived / hit effects gated on it. The pilot's ↑2 reads `flags.essence20.pr1OverdriveGroup` with `isUntilLive`. `self:data:` sees only that the flag exists, not whether it is still live. |
| Profiteer (Hang-Up) | No `until` gives "10 rounds of the combat it started in, else the rest of the scene" (`expiry.mjs#UNTIL` is endOfTurn / endOfRound / endOfNextRound / nextTurn / encounter / scene). Needs `until: {rounds: N}` for marks and banks. |
| Prospector Toolkit | Banks a bonus *die* (1d4, or 1d8 after a DIF 16 Survival test) onto the next Wealth Test through the More Heads bonus-die bank. If a Wealth dialog is cancelled, the die goes back. `bank` still carries only shifts, Edge / Snag, specialize, damage and Defense. Needs a bonus-die bank. |
| Spectrum Shifted | Role-change logic (`role-handler.mjs` asks `spectrumShiftedRetains` / `afterSpectrumShifted`). No rule type says what an old Role keeps. |
| Time Displaced (Use half) | A picker over the Continuum Anomaly risk dice, which then rolls the chosen die one size larger as a blind roll. `pick {from: list}` could ask, but no step rolls a formula with a die-size step to a blind chat card. |
| Warhead Magazines | The three picks per copy come from a fixed list and leave out types already taken. `pick` stores one value per key from a static list. The dialog *select* (Free action) on Area attacks has no DialogSwitch form. The "apply as this type" option on the hit card needs the hit's damage value: `hit` Triggers get no `@var` for it, so a `button` with a `damage` step can't post the same amount. Needs a multi-pick, a select switch with an action cost, and a rider-option step (or the hit's damage as a var). |
| Be an Example | The ↑1 banks onto `system.originSkillsIncrease` (actor data). A picker is only the fallback. `bank`'s `appliesWhen` is evaluated without the rule item (`bank.mjs` passes no `ruleItem`), so `skill:{choice.skill}` would never match. A `pick` would also ask every time instead of reading the origin. Needs `skill:data:<path>` (the rolled Skill equals an actor-data value), or `appliesWhen` interpolated when it is banked. |
| Destiny (Hang-Up) | A GM-only button on the *failed roll's own card* (not a new card) that spends a **GM** Story Point, turns the failure into a Fumble (message flag + the team's Story Point), once per scene. A `button {who: gm}` from an `afterRoll` Trigger would post a separate card. Resources have no GM pool (`storyPoints` spends the actor's pool). No step converts a result to a Fumble. Outcome `failure` also matches a Fumble, which the old offer excluded. |
| Lightspeed Boost (rest) | See the partial table above. |
| Nemesis (Specific Threat) (the reroll) | A once-per-scene reroll of that roll's own formula, shown against every DIF. `button` can run steps, but no step rerolls a finished roll. |
| Power Flux | Fires on a new scene for Zords with a token on the canvas, and tops up each crew member's Personal Power by up to 6. `recipients` still has no `crew`, and there is no "on the canvas" tag. |
| Power Wing (rest) | Current Personal Power ±2 when it is equipped or unequipped. There are still no equip / unequip Trigger events. |
| S.W.A.T. Upgrade (rest) | **Incarceration Protocols:** `defeatedEnemy` fires on the damage card's speaker (`combat.mjs#applyDamage` `source`). The old code credits the Zord when the defeated enemy was the last target the Zord *hit*, whoever dealt the final damage (including damage applied without a card). It also checks sides only when both tokens are on the canvas, and its chat line counts the cards left. A `defeatedEnemy` Trigger with `limit {per: scene, max: 6}` would differ for finishing blows by others and for card-less damage, and it couldn't post the count. Needs "defeated after being hit by this actor" attribution (or accepting the change) and a counter readout. **Incapacitation Ammo:** needs the hit's damage value in a `hit` Trigger (`@var`) for a Stun-damage `button`, or a rider-option step. |
| Stand Behind Me! | The turn-start DIF 14 Alertness buttons could be a `turnStart`-like event plus `button`, but the Trigger would have to fire on *enemies* within 60 ft of the holder. Blocking an attack on anyone else (`dataset.cancelRoll`) has no rule counterpart. Needs a roll-cancelling / forced-target rule. |
| Tactical Size Shift | The direction is picked once and locked across copies. Picking also creates an Active Effect and steps a chosen Skill up a die (undone on delete). Size shifts with clamps. The item steps change *items*, not the actor's Skill dice or size. Needs a text-valued DerivedStat for size, and an actor-update step with undo. |
| Warzord (rest) | Titanic size is text and must land after Tactical Size Shift. The Combiner Story Point reminder needs a Megaform-combines event. |

### Engine pieces the remaining skips need

- `until: {rounds: N}` ("N rounds, else the scene") for marks / banks (Profiteer).
- A bonus-die `bank` (Prospector Toolkit).
- `skill:data:<path>`, or `appliesWhen` interpolated at bank time (Be an Example).
- The hit's damage value as a `@var` in `hit` Triggers, or a rider-option step (Warhead Magazines, S.W.A.T.
  Incapacitation Ammo).
- Roll-switch keys in `ruleDamageDealt`'s `when` context, for an unscaled post-hit note gated on a ticked switch
  (Primordial Power).
- A Movement stage after gravity (Dino Gem Stealth, Lightspeed Boost, Overdrive).
- Boolean Resistance / Immunity grants (Lightspeed Hazmat / Pyrotechnic). An elevation tag (Lightspeed Evasion).
- Recipient `crew` and an "on the canvas" tag (Power Flux). Equip / unequip Trigger events (Power Wing).
- A GM Story Point resource, a Fumble conversion and a button on the roll's own card (Destiny). A reroll step
  (Nemesis).
- "Defeated after being hit by this actor" attribution and a counter readout (S.W.A.T. Incarceration Protocols).
- A roll-cancelling / forced-target rule (Stand Behind Me!). Text-valued size DerivedStat (Tactical Size Shift,
  Warzord). A Megaform-combines event (Warzord). Linked-actor costs and per-turn option memory (Overdrive).
- A migration path for picks already stored in legacy flags (`pr1DinoGem`, `pr1LightspeedBoost`) before `pick` can
  replace those pickers.

### Files touched outside the slices

- `docs/rules-batches/slA2-pr1.md` (this file). Nothing else: no pack, lang, test or module file changed.

---

## Batch slA2, part pr23: re-check of the pr2 and pr3 slice skips

**Scope:** every item that `docs/rules-batches/slA.md` ("Batch slA, slices pr2 and pr3") marked Skipped (29) or
Partial (0), re-checked against the 2026-10-04 engine pieces in `docs/RULES_CONVERSION_GUIDE.md`. Those pieces are the
targeted / dealtDamage / defeatedEnemy Triggers, takesDamage's target, the item steps (createItem, deleteItem,
updateItem, spendQuantity), `pick` and its tags, `button`, SkillSubstitution `scope: item`, `defaultWhen`, and the new
`check:` names. The code is in `module/helpers/extensions/pr2/` and `module/helpers/extensions/pr3/`. The branch is
`rules/slA2-pr23`, from `Rules-Engine-Phase-1` at 8001924e.

**Counts (the 29 re-checked items):**

| Verdict | Items |
|---|---|
| Convert | 1 |
| Partial | 0 |
| Still skip | 28 |

**Totals:** 1 rule was added to 1 pack item. `scripts/check-rules.mjs` now counts 1533 rules on 1055 items, with
0 errors and 0 warnings. No slice file became empty, so `extensions/index.mjs` is unchanged.

#### Converted (1)

| Item | Rule | Note |
|---|---|---|
| Dedicated Carrier (BtH, Zord Feature) | Trigger `added`: `deleteItem {item: "source:<Combiner>", all: true}`, then `grant` Carrier with step `when: ["not:self:has:Carrier"]` | Was `applyDedicatedCarrier` plus its branch in the pr2 `createItem` hook (`pr2/zords.mjs`). The Feature's Active Effect (+3 Toughness plating, +2 Health) is unchanged. Removed: `PR2.dedicatedCarrier`, `PR2.combiner` and `PR2.carrier` (nothing else in pr2 or pr3 read them), the slice test "Dedicated Carrier removes Combiner", and the lang key `E20.Pr2DedicatedCarrierDone`. |

The new tests are in `module/rules/conversions-uses.test.js` under `// slA2 pr23`.

#### Behaviour differences

1. **Chat (same line).** The old code posted "X becomes a Dedicated Carrier: Combiner replaced by Carrier." The rules
   card now lists what happened: "X loses Combiner." and/or "X gains Carrier.". If the Zord had no Combiner and
   already had a Carrier, nothing changes on the Zord and nothing is posted. The old code still posted its line.
2. **"Already has Carrier" is checked by name (same line).** The old code checked for a copy of the PR CRB Carrier by
   source. `self:has:Carrier` matches any item named "Carrier", ignoring case. That only differs for a renamed copy, or
   for a homebrew item named "Carrier". No pack holds another item of that name.
3. **How the Carrier is stamped.** The `grant` step writes `_stats.compendiumSource` where `grantCopy` wrote
   `flags.core.sourceId`. Every reader of the Carrier id (`team-actions.mjs`, `summons.mjs`, the rules engine) reads
   both. `grantedBy` is the same, so deleting Dedicated Carrier still deletes the Carrier it granted.
4. **Which copies react (cross-line, the usual for any conversion).** The `added` Trigger runs only when the dropped
   copy carries the rule: a fresh compendium copy, or one that inherits the rules. An old world-level copy without
   the rule no longer swaps the Features when dropped. Copies already on Zords are unaffected, because the swap only
   ever ran on drop.

#### Still skipped (28)

##### Team-wide (pr2/team.mjs)

| Item | What is still missing |
|---|---|
| Bend Physics | A "team" scope (every Player Character in the world). Also a Movement stage after `registerDerived` / gravity. |
| Primal Rage | The same "team" scope. |
| Instructor | `pick {from: skill}` offers every Skill. It can't be limited to the specialized Smarts Skills, falling back to all Smarts Skills. Also needs a student list of other world actors, and an untrained-Snag lift on those students (`roll-dialog.mjs`). |
| Aim Apparatus | A self-or-teammate picker over the world's Player Characters, a persistent cross-actor Skill-shift step, and a "removed" Trigger event to step it back down. |

##### Zord Features (pr2/zords.mjs)

| Item | What is still missing |
|---|---|
| Dino Gem Integration, Energem Infusion | `pick {from: ownedItem}` filters only by item type and `equipped`. It can't offer just the ranged weaponEffects, energy ones first. It also always asks, where the old code auto-picked a single attack. `updateItem` and `item:picked:` would cover the edit and the Dino Gem ↑1 once such a filter exists. |
| Dino Drive Mode | Dice in formulas (Reflective Armor's 1d2). Also an Active Effect step on a chosen movement type, a Speed penalty until the next turn starts, and a tag for "a Zord within 30 ft holding item X". |

##### Finster's (pr2/finster.mjs) and Grid Relic (pr2/perks.mjs)

| Item | What is still missing |
|---|---|
| Aura of Decay | A before-roll Trigger event. An afterRoll `loseHealth` would land after the roll, not before it. |
| Flames of Hate | An "ignore armor" Defense mode, or an outgoing Defense add applied after the `best` / `halve` reshaping. |
| Incineration Blast | A "token moved on its own turn" Trigger event. |
| Grid Relic Weapon | `createItem` can make the weapon, but it can't attach the second created item (the weaponEffect) to it. That needs `parentId` = the first item's new id, or `attachGrantedChildren` on createItem with inline children. The labels are also localized at run time. |

##### PR CRB (pr3/pr-crb.mjs)

| Item | What is still missing |
|---|---|
| Megaform Expeditor | A rule hook in `combiner-timer.mjs`, and dice in formulas (1d4). |
| Ninja Power | Its Use shares one button with the Power-upkeep on/off state in `ninja-power.mjs`. That state isn't rule data. |
| Peerless Pilot (PR) | A rule hook in `vehicle-defeat.mjs`'s emergency disembark. |
| Power Heal | A step that runs `power-handler.mjs#powerCost`. Also a `pick` over a creature's current negative Conditions: `pick {from: list}` options are fixed. |
| Survivor | An "Essence changed / dropped to 0" Trigger event and a d20 roll. |
| Unique Weapon (Green Ranger) | A random option on `choose` / `pick` (roll 1d4 on the list). |
| Unique Weapon (Ranged) | Drawing Power back isn't capped at the maximum, but `gainResource` is. The Fumble costs 1d4 Power (dice in formulas). |
| Unique Weapon (Small Melee) | A rule hook in `zord-summon.mjs`. |
| Unique Weapon (Two-Handed Melee) | A Movement stage after `registerDerived` and gravity: with Bend Physics, the old result is 2x−10, and the `final` stage would give 2x−20. |

##### Through the Shattered Grid (pr3/ttsg.mjs)

| Item | What is still missing |
|---|---|
| Elemental Fury | `createItem` with computed values (twice the strongest ranged attack's damage, its range), the child weaponEffect linked to the created weapon, deletion once rolled, and per-element crit riders. |
| Overload | Dice in formulas (1d2 Health). |
| Power Construct | `takesDamage` now knows the dealer, but not whether the hit was a melee attack against Toughness. The alternate rider option and the 0-Health note also stay code. |
| Restraining Gear | An opposed-roll step. Also, the Power is paid by the pilot, and it is shared through Megaform participants. A hit `button` could carry it once those exist. |
| Zord Mount | `pick {from: ally}` reads tokens in range, not every Zord in the world. Also needs a once-per-turn note on the first melee attack that fires on a hit or a miss. |
| Emissary's Gift | A pack/book filter on `pickPerk`: `line: pr` offers every Power Rangers book's Roles. |
| Morphin Navigator | Dice in formulas (1d2 per team member) and the team reach. |
| Protector of Safehaven | `until: mission` for toggles and choices, and a temp-resource step (`resource/temp-resources.mjs`). |

#### Engine pieces the remaining skips need

1. **Dice in formulas, or a dice step:** Overload, Unique Weapon (Ranged), Megaform Expeditor, Dino Drive Mode,
   Survivor, Morphin Navigator, and a random option for Unique Weapon (Green Ranger).
2. **A "team" scope / recipient** (every Player Character in the world): Bend Physics, Primal Rage, Instructor, Aim
   Apparatus, Morphin Navigator.
3. **A Movement stage after the derived hooks and gravity:** Unique Weapon (Two-Handed Melee), Bend Physics.
4. **`pick {from: ownedItem}` with item-tag filters** (e.g. `filter: ["item:type:weaponEffect", "not:attack:melee"]`)
   and auto-pick of a single option: Dino Gem Integration, Energem Infusion.
5. **`createItem` children** (weaponEffects linked to the created weapon) and computed data: Grid Relic Weapon,
   Elemental Fury.
6. **Trigger events:** before a roll (Aura of Decay), a token moving on its own turn (Incineration Blast), an Essence
   change (Survivor), an item removed (Aim Apparatus).
7. **takesDamage facts about the hit** (melee / the Defense it targeted): Power Construct.
8. **An opposed-roll step:** Restraining Gear.
9. **A Defense "ignore armor" mode** after `best` / `halve`: Flames of Hate.
10. **A pack filter on `pickPerk`:** Emissary's Gift.
11. **Hooks in other helpers:** the Megaform join time, emergency disembark, the Zord summon time.

#### Files touched outside the two slices

- `module/rules/conversions-uses.test.js`: the `// slA2 pr23` block appended at the end. The import line is unchanged.
- `lang/en.json`: `E20.Pr2DedicatedCarrierDone` removed (one line, edited as text).
- `packs/bthitems/_source/Dedicated_Carrier_GShizr9G3xrMB3O5.json`: the `rules` array added (text insertion, LF kept).
