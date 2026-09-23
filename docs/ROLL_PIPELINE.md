# The Roll Pipeline

A deep dive on `module/dice.mjs` — the largest and least approachable file in the system, and the
one you are most likely to need to change.

Read [`DEVELOPER_BIBLE.md` §6](DEVELOPER_BIBLE.md#6-the-roll-pipeline) first for the altitude view.
This document is the detail: the real phase boundaries, the two context objects, the timing
constraint that shapes everything, and where to put a new rule.

> **Line numbers here are landmarks, not addresses.** They drift with every change. Search for the
> method or the quoted comment instead.

| | |
| --- | --- |
| [1. Shape of the file](#1-shape-of-the-file) | ~13,800 lines, one class |
| [2. The four phases](#2-the-four-phases) | Gather, modify, choose, execute |
| [3. The critical timing constraint](#3-the-critical-timing-constraint) | Modifiers run *before* the dialog |
| [4. checkEntries and checkContext](#4-checkentries-and-checkcontext) | What makes a roll an attack |
| [5. addSource](#5-addsource) | The contract |
| [6. Inside _rollSkillHelper](#6-inside-_rollskillhelper) | The two paths, and post-hit processing |
| [7. Where to put a new rule](#7-where-to-put-a-new-rule) | Decision table |
| [8. Testing a roll rule](#8-testing-a-roll-rule) | |

---

## 1. Shape of the file

One class, roughly 13,800 lines, in four unequal parts:

| Part | Roughly | What |
| --- | --- | --- |
| Compendium UUID constants | 89–3,000 | Several hundred `const X_ID = "Compendium.essence20…"` declarations, grouped by book, each with a comment quoting its rule |
| `prepareInitiativeRoll` | 3,034 | Initiative's own path |
| `rollSkill` | 3,367–8,641 | The main entry point |
| `_getAutomaticCombatModifiers` | 8,681–10,872 | Modifier accumulation |
| Predicates, appliers, `_rollSkillHelper`, formatting | 10,872–13,796 | Everything else |

The constant block at the top is not noise — it is the index. If you want to know whether an
ability is already automated, search that block for its name.

---

## 2. The four phases

### Phase 1 — Gather (`rollSkill`, ~3,367 onward)

```js
async rollSkill(rawDataset, actor, item = null)
```

`rawDataset` comes from a DOM dataset, so **everything arrives as a string**. The first thing the
method does is coerce `shiftUp`, `shiftDown`, `isSpecialized` and `canCritD2` into real types.

Then, in order:

1. Resolve `rolledSkill` and `rolledEssence` (falling back to `E20.skillToEssence`).
2. Pre-roll interactions that can change whether the roll happens at all — most visibly the
   Defeated prompt: *"spend a Story Point to momentarily act as though it has not been Defeated."*
   Declining does **not** block the roll; this system has never refused a Defeated actor's dice.
3. Record anything that keys off the attempt itself, regardless of outcome.
4. Apply abilities that change which Essence a skill uses.

### Phase 2 — Modify (`_getAutomaticCombatModifiers`, called at ~3,429)

```js
const combatModifiers = this._getAutomaticCombatModifiers(actor, item, rolledEssence, rolledSkill);
```

Called **once**, early, and before the dialog. It walks statuses, conditions, Perks, Hang-Ups,
gear, the target and the situation, accumulating `shiftUp` / `shiftDown` / `edge` / `snag`, and
records each contribution through `addSource` (§5).

Below it sit dozens of small predicates and appliers:

| Kind | Examples |
| --- | --- |
| Attack-shape predicates | `_isSideswipeAttack` · `_isAlphaStrikeAttack` · `_isPenetratingRoundsAttack` · `_isTriggerHappyAttack` · `_isEmptyTheMagAttack` · `_isHeavyOrdnanceAttack` |
| Situation predicates | `_hasNearbyBulwarkCover` · `_hasNearbyProtectorsShieldImmunity` · `_getDistanceFeet` · `_getSizeShift` |
| Vehicle helpers | `_getVehicleDriver` · `_getPilotedVehicle` · `_hasDrivingSpecializationAtOrAboveD6` |
| Damage appliers | `_applySmashDamage` · `_applyRazeAndRuinDamage` · `_applyPlatePiercingVehicleDamage` · `_applyFlameWarlordCritDamage` · `_applyNowhereIsSafe` |

Between phase 2 and the dialog sit ~2,400 lines of **pre-dialog, per-ability handling** — mostly
target-scoped grants that resolve the target directly with `game.user.targets.first()?.actor`
rather than going through the modifier function.

### Phase 3 — Choose (the dialog, ~5,853)

```js
const skillRollOptions = await this._rollDialog.getSkillRollOptions(
  updatedShiftDataset, skillDataset, actor);

if (skillRollOptions.cancelled) {
  return { cancelled: true };
}
```

`helpers/roll-dialog.mjs` builds the fields — including `buildCombatModifierSourceFields`, which
turns the recorded sources into the labelled **Automatic Modifiers** list — and
`apps/roll-options-dialog.mjs` renders them.

> That `cancelled` return is the **only** early return in `rollSkill` that means "the user backed
> out". Every other early return is a real outcome and stays bare. Preserve that distinction.

After the dialog resolves, `rollSkill` applies the player's decisions: a **disabled source's own
`shiftUp`/`shiftDown` is subtracted back out**, and any checkbox that overrides the final Edge/Snag
choice is consumed here.

### Phase 4 — Execute (`_rollSkillHelper`, invoked ~8,604)

```js
await this._rollSkillHelper(formula, actor, flavor, canCritD2,
                            checkContext, rollContext, drivingStrikeReroll);
```

See §6.

---

## 3. The critical timing constraint

**`_getAutomaticCombatModifiers` runs before the dialog.** The codebase calls this "the documented
`_getAutomaticCombatModifiers`-runs-before-the-dialog timing gap", and it is the single most
important structural fact about this file.

Consequences:

- Anything that must **react to what the player chose in the dialog** cannot live in that
  function. It has to be consumed after the dialog resolves, by writing to `skillRollOptions`
  directly — for example forcing `skillRollOptions.snag = false`.
- Anything **reciprocal** — "and the target suffers a Snag on their next roll" — cannot be
  resolved there either, because the roll has not happened yet. Several abilities are documented
  as blocked on exactly this.
- Target-scoped grants that only need to know *who* the target is, not the outcome, are commonly
  resolved pre-dialog with `game.user.targets.first()?.actor`.

When you add a rule, decide **which side of the dialog it belongs on** before you write anything.
That choice determines where the code goes and is the most common thing to get wrong.

---

## 4. `checkEntries` and `checkContext`

`checkEntries` is the per-target list built when a roll is resolved against Defences. It is what
decides the shape of everything downstream:

```js
const checkContext = checkEntries
  ? { defenseType, targets, damageValue, damageType, /* plus rule-specific flags */ }
  : null;
```

| | |
| --- | --- |
| `checkContext` **present** | Attack or roll against a Difficulty — resolve against each target |
| `checkContext` **null** | Plain Skill Test — post a dice message |

> An attack **rolled with no target selected has no `checkContext`** and falls down the plain-roll
> path. That is intentional, and it is why so much post-hit code is guarded.

Rules that need to influence post-hit behaviour thread a flag onto `checkContext` during phase 1
or 3, and `_rollSkillHelper` reads it later — the established pattern for "decide now, act on the
result".

The second context object carries what was rolled, for the chat card:

```js
rollContext = { skill, essence, snag, isPowerWeaponAttack }
```

On the `checkContext` path a `rollFailed` flag is added once the outcome is known, so chat-side
features (rerolls that only apply to failures, for instance) can read it back off the message.

### Areas of effect

An area attack still rolls **once**. `helpers/aoe-targeting.mjs` turns a placed shape into a set
of targeted tokens, and the existing `checkEntries` machinery compares that single result against
each one — exactly what the rules require. Nothing in the roll pipeline changes for areas.

---

## 5. `addSource`

```js
const addSource = (id, label, mods) => {
  sources.push({
    id, label,
    shiftUp:   mods.shiftUp   || 0,
    shiftDown: mods.shiftDown || 0,
    edge:  !!mods.edge,
    snag:  !!mods.snag,
  });
};
```

Call it **alongside** every mutation, never instead of one:

```js
if (selfStatuses.has('impaired')) {
  shiftDown += 1;
  addSource('impaired', this._localize('E20.StatusImpaired'), { shiftDown: 1 });
}
```

```js
addSource('debilitatingStrike',
  findPerk(actor, DEBILITATING_STRIKE_ID)?.name ?? 'Debilitating Strike',
  { snag: true });
```

Note the label idiom: prefer the **item's own name** so the player sees the Perk as it is written
on their sheet, with a hardcoded fallback for when the item is not present.

### What it buys

- The player sees *why* their shift number is what it is, itemised.
- Shift sources become **individually toggleable** for a roll they should not apply to.
- Edge/Snag sources annotate the existing Edge/Snag radio rather than adding a second,
  overlapping control — that radio is already the one interactive control for edge and snag.

`addSource` never changes totals. It parallels them.

> **A modifier without an `addSource` call is a bug.** It folds into an opaque number and the
> player has no way to discover it.

---

## 6. Inside `_rollSkillHelper`

```js
async _rollSkillHelper(formula, actor, flavor, canCritD2,
                       checkContext = null, rollContext = {}, drivingStrikeReroll = false)
```

### Path A — no `checkContext` (~11,571–11,589)

```js
await roll.evaluate();
const chatData = await buildCheckChatData(roll, { /* … */ });
return { results: [], rollFailed: false, isFumble: false, roll };
```

A flat Skill Test. Short, and the end of it.

### Path B — with `checkContext` (~11,592 onward)

1. `await roll.evaluate()`.
2. `drivingStrikeReroll` is applied immediately if set — a pre-declared reroll of all skill dice,
   applied unconditionally rather than offered as a chat button, because the ability triggers
   "before making a melee attack".
3. **Per-target resolution** (~11,811): `for (const targetToken of game.user.targets)` — compare
   the single result against each target's Defence and build `results`.
4. **Post-hit processing** (~11,900–13,460) — the longest stretch in the file. Damage application,
   conditions applied to targets, marks and flags set, reroll configs enabled, triggered rolls
   fired on *other* actors, capstone effects.
5. `rollFailed` is computed (`results.every(entry => !entry.success)`) and folded into
   `fullRollContext` so chat-side features can read it.
6. `buildCheckChatData` renders the card.
7. A Fumble grants a Story Point where the pool and permissions allow it.

### Triggering another actor's roll

An established pattern lives here: a rule can fire a *different* actor's roll from inside this
one's resolution, via `actor._dice.rollSkill()`. Used for things like "the target's driver must
succeed on a DIF 20 Driving Skill Test". Follow the existing examples rather than inventing a new
shape.

### Chat-side continuation

`_rollSkillHelper` ends at the posted message. Anything the player does *to* that message —
rerolls, applying damage — lives in `module/chat.mjs` and is wired through the
`renderChatMessageHTML` hook. `chat.mjs` exports `onApplyDamage`; the reroll buttons call into
`helpers/reroll.mjs`.

---

## 7. Where to put a new rule

| The rule... | Put it | Notes |
| --- | --- | --- |
| is a flat passive number | **an Active Effect**, not code | Always try this first |
| always modifies a qualifying roll | a block in `_getAutomaticCombatModifiers` | **+ `addSource`** |
| needs the target's identity but not the outcome | pre-dialog in `rollSkill` | `game.user.targets.first()?.actor` |
| must react to a dialog choice | post-dialog in `rollSkill` | Write to `skillRollOptions` |
| offers the player a choice at roll time | a control in `templates/dialog/roll-dialog.hbs` | Consume it post-dialog |
| fires on hit / crit / failure | post-hit processing in `_rollSkillHelper` | Thread a flag onto `checkContext` |
| grants a reroll | a `system.reroll` config on the item | Never hand-roll |
| fires another actor's roll | post-hit, via `actor._dice.rollSkill()` | Follow existing examples |
| acts on the chat message | `chat.mjs` | |

### House style for a new rule

1. Add the compendium UUID to the constant block at the top, **with a comment quoting the rule and
   citing book and page.**
2. Put the logic in its own `module/helpers/<ability>.mjs`, with a `.test.js`.
3. Call into it from the right side of the dialog.
4. `addSource` if it changes a roll.
5. If part of the rule cannot be enforced, say so in the helper's header comment rather than
   half-implementing it.

`dice.mjs` should read as a sequence of "does this apply? then ask its module" — not as the rules
themselves. The file is already long; keep the rules out of it.

---

## 8. Testing a roll rule

`module/dice.test.js` covers the pipeline, and each ability has its own test beside its helper.

Because Foundry is mocked (`module/jest.setup.js`), the practical approach is:

- Keep the **decision** pure — a function taking actor-ish data and returning what should happen.
  Test that directly.
- Leave the Foundry I/O (`actor.update`, chat creation, target iteration) in a thin wrapper.

This is why `helpers/` carries ~299 test files: the decisions are separable. A rule written as one
long block inside `_getAutomaticCombatModifiers` is effectively untestable, which is a good reason
not to write it that way.

Before pushing:

```bash
npm run lint && npm test
```

And if you touched any compendium effect keys:

```bash
node scripts/check-effect-keys.mjs --verbose
```
