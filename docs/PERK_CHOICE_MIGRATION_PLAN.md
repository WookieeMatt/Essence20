# Perk choice migration plan (old `hasChoice` picker -> rules choices)

Status: design only, 2026-10-06. Branch Rules-Engine-Phase-1. Nothing here is built yet.
Goal: move every pack item that uses the old Perk choice fields (`hasChoice`, `choiceType`, `numChoices`, `choiceEssence`,
`value`, and the stored `system.choice`) onto the rules choice system (ChoiceSet, pick steps, `flags.essence20.rules.choices`).
The old Details fields get hidden in 6.0.x, existing characters' picks get migrated, and the fields come out of the data model in 6.1.

Inputs read: docs/rules-batches/details-audit.md, docs/RULES_CONVERSION_GUIDE.md (ChoiceSet, pick / pickEach / pickMany,
`{choice.x}`, `choiceOf:`, `legacy`), module/rules/legacy-choices.mjs, module/rules/lifecycle.mjs, module/rules/steps.mjs
(pick, pickOptions, pickGrant), module/sheet-handlers/perk-handler.mjs (onPerkDrop, setPerkValues, onPerkDelete),
module/apps/choices-selector.mjs, module/apps/multi-choice-selector.mjs, plus a scan of `packs/*/_source`.

---

## 1. Inventory

### 1.1 Pack items by `choiceType` (116 = 115 perks + 1 Hang-Up)

| Family | choiceType (count) | Where the pick goes today | Pack items |
|---|---|---|---|
| A. Fixed option lists, read by rule tags | fightingStyle 1, airBornMovement 1, alwaysReadyFunction 1, communityHelperSkill 1, defensiveFlexibility 1, electromagneticDisruption 1, energyConnectionOption 1, experiment 1, overTheCandlestick 1, phantomFocus 1, powerAdaptation 1, roamingTheLand 1, sparedNoExpenseSkill 1, toothAndClaw 2, twoHandedAssault 1, viciousOrVenom 1, wisdomOfTheElders 1, stoneWarlordDamageType 1, elementDamageType 3, vehicleType 3, essence 1, field 1 | `system.choice` only (plus a rename to "Name (Pick)") | 28 |
| B. Skills | skills 32 (numChoices > 1 on 3: GIJ Expertise 2, I've Done My Research 3, Low Tech Priorities 2; `choiceEssence` on I've Done My Research; UniqueChoice on GIJ Expertise) | `system.choice`, `system.reroll.skills = [pick]`; multi-pick makes one item per Skill (onMultiSkillPerkDrop) | 32 |
| C. Picks written into actor data ("baked") | senses 4 (`system.senses.<pick>.acute = true`), environments 2 (pushed onto `system.environments`), movement 2 (Fast: `system.movement.<pick>.bonus += value`), altModeMovement 2 (All-Terrain Alt Mode enables one bundled Active Effect; Transmetal reads `system.choice` in 9 rules) | actor data + `system.choice`; onPerkDelete undoes senses/environments/movement (not GIJ Expertise's `shiftUp`, which family B also bakes - existing bug) | 10 |
| D. Sub-Perk lists | perks 46 (numChoices 2 on 12 Grid Science / Grid Tech / Modified Shell / Metamorphosed Changeling; AnyGeneralPerkChoice on Nobody Like Me; ChoiceCount (Grid Tap) adds to numChoices) | no `system.choice`: the picked child Perks are created with `flags.essence20.parentId` / `collectionId` | 46 |
| E. Hang-Up | damageType 1 (Augmented, atsitems) | `system.choice` via mechanics/characters/hang-up-choice.mjs | 1 |

No actor or adventure packs embed these items (checked: 0 embedded copies with a stored `system.choice`), so the only stored
picks to migrate live in worlds.

Note: the config table `E20.perkChoiceTypes` lists only 8 of these 29 values (none, environments, field, fightingStyle,
movement, perks, senses, skills), but perk-handler handles all 29. The other 21 can't be picked on the sheet and are set only
in the pack JSON.

### 1.2 Pack rule references that read or write the old pick (158 hits in 69 items)

The audit's figure of "94" counts only the `system.choice` path forms. This scan also counts `{item.choice}` and `choiceOf`.

| Form | Hits | Example | Rewrite |
|---|---|---|---|
| `rule:data:system.choice=<v>` | 88 | Fighting Style, Defensive Flexibility (11), Wisdom of the Eldars (11), Power Adaptation (10), Transmetal (9) | `rule:choiceHas:<key>:<v>` (existing tag; works for one value or a list) |
| `{item.choice}` in tags / labels / steps | 43 | `skill:{item.choice}` on 26 skills perks; vehicleType, essence | `{choice.<key>}` |
| `choiceOf:<uuid>` (skill / self / target / holder tags, AttackResistance, DamageImmunity) | 19 | Tender, Forgiving, Support Yourself (MLP Empathy); Eureka, Expert in Your Field (GIJ Field); Energy Mastery, Numbness | no text change: the resolver (2.1) reads the new choice |
| DamageType `to: "choice"` | 4 | Energy Affinity, Ninja Power, Tooth and Claw x2 | `to: "{choice.element}"` (DamageType `to` has to fill `{choice.x}`, a small engine edit) |
| `{sourced.<id>.system.choice}` | 3 | Self-Preservation (2), Volatile Delivery (`|fire` default) | `{sourced.<id>.flags.essence20.rules.choices.element}` |
| `item:data:system.choice=<v>` (another item's pick) | 1 | Gallantry reads the target's Fighting Style = triggerHappy | `item:data:flags.essence20.rules.choices.style=triggerHappy` |
| `updateItem set system.choice` (rules writing the old field) | 2 | Favorite Weapon, Mode Attachment | drop the updateItem; the `pick` key already stores it (`weapon`, `altMode`; Mode Attachment's Bot Mode branch adds a `setChoice` / list pick) |
| `choiceFrom` | 1 | Megaform Advanced Signature Finishing Move | already reads rules choices - no change |

### 1.3 Code paths that read or write the old fields

- **Picker:** sheet-handlers/perk-handler.mjs (`setPerkValues` ~30-case switch, `onPerkDrop`, `onMultiSkillPerkDrop`,
  `onPerkDelete`, `getAlreadyChosenExpertiseSkills`, `setRoleVatiantPerks`), apps/choices-selector.mjs (perk choice types),
  apps/multi-choice-selector.mjs (perks only), sheet-handlers/attachment-handler.mjs:94 and drop-handler.mjs:86 (call
  setPerkValues), rules/plugins/picks/entry-grants.mjs (`grantPerk runPicker`), choice-count.mjs, unique-choice.mjs.
- **JS readers of `system.choice`:** dice.mjs:2195 (Over the Candlestick), items/attacks/energy-affinity.mjs:48/80,
  items/healing/phantom-focus.mjs:16, items/shared/condition-damage-buttons.mjs:34 (Favorite Weapon),
  mechanics/companions/companions.mjs:624, mechanics/rolls/reroll.mjs:195, mechanics/characters/hang-up-choice.mjs:60 (writes).
- **Rules engine readers:** rules/index.mjs:212 and predicate.mjs:690 (`{item.choice}`), predicate.mjs:749, steps.mjs:254,
  adapter.mjs:536 (choiceOf useSkill), adapter.mjs:827 (DamageType `to: choice`), adapter.mjs:898 (dieOf `choice`),
  plugins/tags/choice-of-tag.mjs, plugins/tags/holder-choice-of-tag.mjs, plugins/combat/attack-resistance.mjs:54,
  plugins/combat/damage-immunity.mjs:29, describe-when.mjs:66/215/329.
- **Templates:** templates/item/details/perk.hbs:78-85 (`hasChoice` checkbox; it and `canAdvance` disable each other),
  :235-260 (`choiceType`, movement `value`, `numChoices`, the `items` id-drop). Hang-Up details (`hasChoice`, `choiceType`).
- **Schemas:** data/item/perk.mjs (`choice`, `choiceEssence`, `choiceType`, `hasChoice`, `numChoices`, `value`), data/item/hangUp.mjs.
- **Tests:** 38 test files, about 116 lines, use these fields.

---

## 2. Target design

### 2.1 One way to read a pick (phase 0, no behaviour change)

New module `module/rules/choice-read.mjs`:

- `primaryChoiceKey(item)`: the key of the item's ChoiceSet marked `primary: true`, else its first ChoiceSet, else the first
  `pick` / `pickEach` key in an `added` Trigger.
- `chosenOf(item, key = primaryChoiceKey(item))`: `flags.essence20.rules.choices[key]`, else `flags.essence20.legacyChoice`
  (the 6.1 safety net, 2.6), else `system.choice` (removed in 6.1).

Every reader in 1.3 goes through it, and `{item.choice}`, `to: "choice"` and dieOf `choice` become aliases for it. Because of
this, a converted pack item works for an old character whose pick is still only in `system.choice`, even before the world
migration has run, and `choiceOf:<uuid>` keeps its grammar. (Optional `choiceOf:<uuid>:<key>` for items with two picks.)

### 2.2 Engine additions (phase 1)

1. **ChoiceSet gets the pick-step sources.** Make `lifecycle.choiceOptions` delegate to `steps.pickOptions` with an actor
   context, so a ChoiceSet and a `pick` step offer exactly the same lists. New sources/params:
   - `from: config, table: "<E20 key>"` (fightingStyle, airBornMovement, alwaysReadyOptions, ...) - the option values are the
     table keys, which are the exact strings now stored in `system.choice`;
   - `from: sense | environment | movement | damageType | element`;
   - `only: [...]` (Field: E20.fieldSkills; vehicleType: aerial/ground/swim), `essence` (replaces `choiceEssence`);
   - `notHeld: true`: leave out what the actor already has (acute senses, known environments, `movement` with base > 0);
   - `excludeCopies: true` (replaces UniqueChoice, the same as pickEach);
   - `count: <formula>`: several picks kept as a list (pickEach semantics); `@choiceCount` reads ChoiceCount rules (2.2.4);
   - `rename: true`: append " (<label>)" to the item name, like the old picker (a re-pick replaces the suffix);
   - `required: true`: cancelling the first ask deletes a freshly dropped item, like closing the old dialog (which never ran
     dropFunc).
   ChoiceSet, not an `added` Trigger, is the default shape because the Rules tab and the actor rules view already show its value
   and offer "change" (rules/sheet.mjs#changeChoice). Use an `added` Trigger only when the pick has side effects (family D).
2. DamageType `to` and `updateItem` text fill `{choice.x}` (if they don't already).
3. **DerivedStat array op** `append` (environments), or keep baking through `added`/`removed` Triggers - open question Q3.
4. **ChoiceCount retargeted:** `@choiceCount` = the sum of ChoiceCount `add` for this item's source. The `items` uuids stay.
5. **Step `pickSubPerk {key, count, notOwned: true, anyGeneral?: true}`** (plugins/picks/): offers the rule item's own
   `system.items` entries (or the any-General-Perk list for Nobody Like Me), sorted, defaulting to the item's game line. It
   creates each pick as onPerkDrop's `perks` branch does now (moved into a shared helper: `parentId`, `collectionId`,
   `setEntryAndAddItem`), and records the uuids under `key`. The child's own rules then ask their own choices through
   onCreateItem. This replaces MultiChoiceSelector.
6. **Static checks** in scripts/check-rules.mjs:
   - no item has both `hasChoice` and a ChoiceSet / added-pick (that would double-ask);
   - no pack rule text contains `system.choice` or `{item.choice}` once a family is converted;
   - every ChoiceSet with `legacy: "system.choice"` has a stable list of option values.

### 2.3 Per family

| Family | New shape | Carry-over (`legacy`) | Rule rewrite |
|---|---|---|---|
| A (28) | `ChoiceSet {key: option | style | element | vehicle | essence | skill, from: config/table, or element / essence / skill+only, rename: true, required: true, legacy: "system.choice"}` | `legacy: "system.choice"` read as-is (values unchanged) | `rule:data:system.choice=x` -> `rule:choiceHas:<key>:x`; `{item.choice}` -> `{choice.<key>}`; `to: "choice"` -> `to: "{choice.element}"` |
| B (32) | `ChoiceSet {key: skill, from: skill, essence?, excludeCopies? (GIJ Expertise), count? (3 items), rename, required, legacy: "system.choice"}`; reroll scope `skills: ["{choice.skill}"]` (coordinate with the audit's Reroll-rule move) | as A; with `count`, a scalar is wrapped into a 1-item list | `skill:{item.choice}` -> `skill:{choice.skill}` (needs list-aware `{choice.x}` in `skill:` for the 3 multi-pick items, or Q1 option b) |
| C (10) | ChoiceSet `from: sense | environment | movement, notHeld` plus a rule doing the effect: DerivedStat `system.senses.{choice.sense}.acute = true`; DerivedStat append on `system.environments` (or Trigger pair); Movement / DerivedStat `system.movement.{choice.movement}.bonus + 10` (Fast); All-Terrain Alt Mode a DerivedStat on `system.movement.{choice.movement}.altMode` +20 instead of 3 bundled AEs; GIJ Expertise DerivedStat `system.skills.{choice.skill}.shiftUp + 2` | `legacy` plus the **unbake** step (3.2) | Transmetal's 9 `rule:data` -> `rule:choiceHas:movement:<v>` |
| D (46) | `Trigger {event: added, removeOnStop: true, steps: [{do: pickSubPerk, key: perks, count: "N + @choiceCount"}]}`; Nobody Like Me `anyGeneral: true` (AnyGeneralPerkChoice retired). `system.items` stays (grant data, audit KEEP) | nothing to copy: children already exist with `parentId`. Optionally record `choices.perks` from them for display | none (no rule reads it) |
| E (1) | Augmented: `ChoiceSet {key: damageType, from: damageType, legacy: "system.choice"}`; delete hang-up-choice.mjs | as A | `{item.choice}` -> `{choice.damageType}` |
| Rule-written picks | Favorite Weapon: drop the updateItem, condition-damage-buttons reads `chosenOf(perk, 'weapon')`, LEGACY reader turns the stored id into the `weapon` choice. Mode Attachment: `mode` key, Bot Mode branch sets `choices.mode = botMode` (a `setChoice` step, or a list pick with a Bot Mode option) | LEGACY readers in legacy-choices.mjs (keyed by compendium id) | Gallantry / Self-Preservation / Volatile Delivery per 1.2 |

Keys stay short and per family (`skill`, `sense`, `element`, `option`...), not one universal key, so tags read clearly.
`primary` disambiguates `choiceOf` when an item has more than one pick.

### 2.4 UI on drop

- The drop handlers stop calling the picker for converted items, because `hasChoice` is false on them. lifecycle#onCreateItem
  asks the ChoiceSets (in rule order), then the `added` Triggers run. This happens on every path that creates the item: sheet
  drop, Role/level grants (attachment-handler), grantPerk, pickGrant, sub-perk picks.
- The prompts reuse ChoicesSelector's searchable, grouped list (for long lists: skills, perks) through `chooseSelect`, so long
  lists keep their search box.
- Duplicate protection (Commando's two Expertise at once): `excludeCopies` is checked again when the player confirms, not only
  when the dialog opens, keeping today's guard. Asks are queued per actor, so two dialogs never open at once.

### 2.5 What the Details tab loses

- Perk: the `hasChoice` checkbox (and its two-way disable with `canAdvance`), `choiceType` select, movement `value`,
  `numChoices`, and the hidden `choiceEssence`. The `items` id-drop stays, retitled "Choice list (used by the Pick Sub-Perk
  rule)", and shows only when such a rule exists.
- Hang-Up: `hasChoice`, `choiceType`.
- The current pick shows on the Rules tab's ChoiceSet row, with "change" (GM only, or owner, per Q4), and in the item name suffix.
- 6.0.x: hidden when every item in the pack is converted. A world item that still has `hasChoice: true` shows a read-only
  "Legacy choice: <type> = <value> (convert to a ChoiceSet)" notice in place of the editable fields.

### 2.6 The 6.1 removal

- Remove `choice`, `choiceEssence`, `choiceType`, `hasChoice`, `numChoices`, `value` from data/item/perk.mjs, and
  `hasChoice`, `choiceType`, `choice` from data/item/hangUp.mjs. Remove `E20.perkChoiceTypes`.
- Add a document-level `Essence20Item.migrateData(source)` shim: when `source.system.choice` is set, copy it to
  `flags.essence20.legacyChoice`, before the schema drops the field. The resolver and the legacy pass read that, so a world
  that skipped 6.0.x still keeps its picks.
- Delete the perk-handler switch and its helpers (about 600 lines), multi-choice-selector.mjs, the perk branches of
  choices-selector.mjs, hang-up-choice.mjs, unique-choice.mjs (AnyGeneralPerkChoice/UniqueChoice), and the `system.choice`
  fallback in choice-read.mjs.

---

## 3. World migration

The migration runs on the GM's client and runs again when a new version ships. Every step only fills a missing value or
undoes data that is still marked as baked, so running it twice changes nothing.

### 3.1 Copy (M1)

This is the existing `legacyChoiceUpdates` path, extended:
1. For every owned item whose rules declare `legacy: "system.choice"` (or that has a LEGACY reader), read the old value.
2. **Value-matched:** keep it only if it is one of the rule's option values (for skills, a real Skill key). Anything else is
   not copied. Its `system.choice` stays, and the item is listed in the GM report, so nothing is guessed.
3. Wrap the value in a list when the ChoiceSet has `count`.
4. Write `flags.essence20.rules.choices.<key>` only when it is unset (as today).
5. Leave `system.choice` alone in 6.0.x as a backup (Q7). The resolver prefers the new value.

### 3.2 Unbake (M2, family C and GIJ Expertise)

For each owned copy without `flags.essence20.choiceMigration.unbaked`, where X is the stored pick:

| Item | Undo on the actor |
|---|---|
| Acute Sense | `system.senses.<X>.acute = false` |
| Environmental Expertise / Environment Choice | remove one `X` from `system.environments` |
| Fast | `system.movement.<X>.bonus -= value` (floor 0) |
| GIJ Expertise | `system.skills.<X>.shiftUp -= 2` (floor 0) |
| All-Terrain Alt Mode | disable / delete the bundled AE whose change key is `system.movement.<X>.altMode` |

- Write the actor change and the item flag in **one** `actor.update({system..., items: [{_id, flags}]})`, so a crash can't
  undo the bonus twice.
- An actor value lower than expected (the player already removed it by hand) is clamped and reported.
- The new rules supply the effect from then on. The derived stat should come out the same before and after (see the test
  strategy in section 4).

### 3.3 Scope and gating (M3)

- `game.actors`, **unlinked token actors** in every scene (`token.delta`; linkExistingCopies skips these today), and world
  Items.
- World compendium actors are the user's own packs: the existing "migrate compendium" action, documented in the release notes.
- **Gating:** use its own setting, `perkChoiceMigrationVersion`, an integer bumped by each conversion batch. It doesn't use
  `game.system.version`, which reads "This is auto replaced" in dev, so in dev the version-keyed gate only ever re-runs if
  the setting is cleared. M1 then M2, after linkExistingCopies (M2 needs `rulesSource` to find copies).
- **Report:** console summary and a GM whisper: copied N, unbaked N, unmatched (actor, item, value).

### 3.4 Family D

Nothing to copy. Existing children keep `parentId`/`collectionId`, and `added` never fires again for old items. Optional:
record `choices.perks` (the children's uuids) so the Rules tab can show them.

---

## 4. Phased rollout

| Phase | Content | Ships | Size |
|---|---|---|---|
| P0 | choice-read.mjs resolver; switch every reader in 1.3; `{item.choice}` / `to: choice` / dieOf aliases. No pack change. | 6.0.x | S: ~25 call sites, 1-2 days |
| P1 | Engine 2.2: ChoiceSet sources/params via pickOptions, rename/required/count/excludeCopies/notHeld, `@choiceCount`, DamageType fill, DerivedStat append, pickSubPerk, ask queue, check-rules assertions; guide sections | 6.0.x | M-L: 3-5 days |
| P2a | Family A (28) + 1.2 rewrites for them (about 95 refs) + M1 | with P1 | S-M: 1-2 days (scripted) |
| P2b | Family B (32) + Reroll scope + multi-pick (Q1) | next | M: 2 days |
| P2c | Family C (10) + M2 unbake | next | M: 2 days (migration tests matter most here) |
| P2d | Family D (46) via pickSubPerk; retire MultiChoiceSelector use, AnyGeneralPerkChoice, numChoices | next | L: 3-4 days |
| P2e | Family E + rule-written picks (Favorite Weapon, Mode Attachment) + cross refs (Gallantry, Self-Preservation, Volatile Delivery) | any | S: 1 day |
| P3 | Hide Details fields (2.5), legacy notice | after P2 complete | S: 0.5 day |
| P4 (6.1) | Schema removal + migrateData shim + code deletion (2.6) | 6.1 | M: 1-2 days |

Each P2 batch is one scripted pack rewrite (a `scripts/` one-off, deterministic per choiceType). In the same edit it sets
`hasChoice: false` / `choiceType: none`, adds the ChoiceSet, and rewrites the tags. check-rules must pass before commit.

### Test strategy

- **Unit (jest, conv-style):**
  - per family: create the item on a mock actor -> the ChoiceSet asks with the expected option values (same set the old
    switch built, including notHeld/essence/excludeCopies filters) -> the rules read the pick (tag true/false, derived value).
  - a legacy item with only `system.choice` works through the resolver.
- **Migration tests:**
  - value-matched copy;
  - unmatched value left alone and reported;
  - a second run is a no-op;
  - unbake runs once, clamps at 0, and leaves an unrelated manual value alone;
  - the list wrap;
  - unlinked token actors are covered.
- **Parity harness (dev console script):** in a copy of a real world, snapshot `actor.system` (derived) and each roll's
  modifier list for every character, migrate, snapshot again, and diff. The diff should be empty apart from item flags.
- **Static:** check-rules assertions (2.2.6), `check-pack-content`, eslint, the full jest suite (update the 38 test files as
  each family flips).
- **Manual QA:** drop one perk per family from the sheet, through a Role level grant, through grantPerk, and as a sub-perk
  pick. Cancel each, then re-pick from the Rules tab.

### Risks

- **Double ask** if an item keeps `hasChoice` and gains a ChoiceSet -> check-rules assertion.
- **Double unbake** -> one combined update plus a per-item flag; clamp at 0.
- **Missed actors:** unlinked tokens and user compendia -> include token deltas; document compendium migration.
- **Hand-edited baked fields** (a manually set acute sense) may be cleared -> value-matched only, reported.
- **Concurrent dialogs** (batch creates fire onCreateItem in parallel) -> per-actor ask queue, recheck on confirm.
- **Option drift:** the old movement list offered only base > 0, and Field offered 3 Skills -> `notHeld` / `only`, tested
  against the old switch.
- **Homebrew world items** using `{item.choice}` / `rule:data:system.choice` / `hasChoice`:
  - aliases stay through 6.x with a console deprecation warning;
  - the `rule:data:system.choice` path breaks at 6.1 unless the migrateData shim plus a tag alias cover it (Q10).
- **Reroll overlap** with the audit's `system.reroll` -> Reroll-rule move; do B together with it or after it.
- **The version gate in dev** -> separate integer setting.

---

## 5. Open questions

1. Multi-pick Skills (GIJ Expertise 2, I've Done My Research 3, Low Tech Priorities 2):
   (a) one item holding a list (pickEach, simpler engine, list-aware tags), or
   (b) one item per Skill as today (keeps old characters' shape, needs a "split into copies" step)?
2. Family D (46 sub-perk lists): in this project (pickSubPerk), or leave those on the old picker for now and retire only
   `system.choice` first?
3. Senses / environments / movement / alt-mode: derive them through rules and unbake (recommended), or keep writing actor data
   through `added`/`removed` Triggers (no unbake, but still baked)?
4. Re-picking after creation from the Rules tab: GM only, owner, or off? The old system had no re-pick.
5. Cancel on drop: delete the item (old sheet-drop behaviour), or keep it unpicked so the player can pick later? Grants
   currently keep it.
6. Keep renaming items "Name (Pick)"?
7. Clear `system.choice` on migrated copies in 6.0.x, or keep it as a backup until 6.1 (recommended: keep)?
8. Include the Hang-Up fields (Augmented) in the same retirement? (Recommended: yes.)
9. Retire perk `value` here too (the audit's HIDE: Fast, GIJ Expertise; Transmetal's 40 and MLP Attack's 1 are unread)?
10. Homebrew compatibility at 6.1: keep `{item.choice}` and a `rule:data:system.choice` alias permanently, or break with a
    release-note warning?
11. Unmatched legacy values: report and leave, or prompt the owner to re-pick the next time the sheet opens?
## Decisions (user, 2026-10-07)

- Multi-Skill Perks: ONE item holding a LIST of Skills (not one copy per Skill). The ChoiceSet takes `count` and stores an array; rules read every entry. GI Joe Expertise's "a different Skill each time" becomes "no Skill twice in the list" (plus the existing per-copy check for anyone who still adds a second copy). The migration folds existing duplicate copies into one item with a list.
- Sub-Perk lists (46 items): INCLUDED in this project (pickSubPerk step), so the old picker code can go in 6.1.
- Senses / Environments / Fast / alt-mode movement: DERIVED from rules; the migration removes the old written-in values once (idempotent, flagged per item).
- Re-picking from the Rules tab: GM and owner, as other rule picks today.
- Still open: whether cancelling a pick on drop deletes the item, and whether `{item.choice}` keeps working for homebrew after 6.1 (see the open questions above).

## Phase 0 - done 2026-10-07

`module/rules/choice-read.mjs` (pure, no imports, plain-Node safe):

- `primaryChoiceKey(item)`: the ChoiceSet marked `primary: true`, else the first ChoiceSet, else the first `pick` / `pickEach`
  key in an `added` Trigger (nested steps too). A `pick` in a Use rule (Favorite Command, Favorite Weapon) or a `pickGrant`
  (For The Syndicate, Good To Go) is not a primary pick. Null when there is none.
- `chosenOf(item, key = primaryChoiceKey(item))`: `flags.essence20.rules.choices[key]` when made, else
  `flags.essence20.legacyChoice` when made, else `system.choice` **as stored** ('' / null / undefined included, so a switched
  reader sees exactly the value it saw before). "Made" = not undefined / null / '' / an empty list. A list is returned as
  stored.
- `legacyChoiceOf(item)`: only the old tiers (legacy flag, then `system.choice`). For readers that reshape or undo what the
  old picker wrote, which must never see a rules choice.
- List-ready companions (user decision: multi-Skill Perks hold one list): `chosenList(item, key?)` (always an array, empty
  entries dropped, a scalar wrapped), `hasChosen(item, value, key?)` (value, or any list entry, `==`; false for an empty value),
  `hasAnyChoice(item, key?)`.

Readers switched (every code READ of the pick; writers unchanged):

| Reader | Now |
|---|---|
| rules/predicate.mjs `interpolate` - `{item.choice}` | `chosenOf(ruleItem)` |
| rules/predicate.mjs `sourcedValue` - `{sourced.<id>.system.choice}` | `chosenOf(copy)` (other paths still getProperty) |
| rules/predicate.mjs `dataTag` - `rule:data:system.choice...` and `item:data:system.choice...` | alias `{ choiceAlias: true }` on the `rule` and `item` families only (not `self:` / vehicle data); `=` / `!=` match any entry of a list pick |
| rules/predicate.mjs `skill:choiceOf:<uuid>` | `hasChosen(copy, rolledSkill)` |
| rules/index.mjs `ruleLabel` - `{item.choice}` | `chosenOf(item)` |
| rules/steps.mjs `skillFor` - `skill: "choiceOf:<uuid>"` (rollVsEach / roll steps) | `chosenOf(copy) \|\| null` |
| rules/adapter.mjs `useSkillOf` - DialogSwitch `useSkill: "choiceOf:<uuid>"` | `chosenOf(copy) \|\| null` |
| rules/adapter.mjs `ruleDamageType` - DamageType `to: "choice"` | `chosenOf(item)` |
| rules/adapter.mjs `ruleDieSubstitution` - `skills: ["choice"]` (dieOf) | `chosenOf(item)` |
| rules/adapter.mjs `ruleRerollGrants` - a choiceType `skills` Perk's Reroll scope | `chosenList(item)` (a list pick covers every Skill) |
| rules/plugins/tags/choice-of-tag.mjs `self:` / `target:choiceOf` | `hasAnyChoice(copy)` |
| rules/plugins/tags/holder-choice-of-tag.mjs `holder:choiceOf` | `hasChosen(copy, rolledSkill)` |
| rules/plugins/combat/attack-resistance.mjs `choiceOf` | `chosenList(copy)` (any entry, "energy" as before) |
| rules/plugins/combat/damage-immunity.mjs `choiceOf` | `chosenOf(copy) == damageType` (kept scalar: the old reader had no empty guard) |
| rules/legacy-choices.mjs TF CRB Influence `"skill::name"` reader; `legacyValue('system.choice')` | `legacyChoiceOf(item)` |
| sheet-handlers/perk-handler.mjs `getAlreadyChosenExpertiseSkills` | `flatMap(chosenList)` |
| sheet-handlers/perk-handler.mjs `onPerkDelete` (environments / senses / movement undo) | `legacyChoiceOf(perk)` - it undoes what the old picker baked, so never a rules choice |
| migration.mjs `migratePerkValue` (baked Fast / GIJ Expertise value off the actor) | `legacyChoiceOf({system, flags})` from stored data |
| dice.mjs Over the Candlestick (Agile Reflexes) | `chosenOf(findPerk(...)) == 'agileReflexes'` |
| items/attacks/energy-affinity.mjs (element match, activation card) | `chosenOf(findPerk(...))` |
| items/healing/phantom-focus.mjs `hasPhantomFocusOption` | `chosenOf(item) == option` |
| items/shared/condition-damage-buttons.mjs `favoriteWeaponOf` | `chosenOf(perk)` (default key: none yet, so system.choice) |
| mechanics/companions/companions.mjs Favorite Command `favoriteSkill` | `favoriteSkill flag \|\| chosenOf(perk)` |

Left alone on purpose: writers (perk-handler `setPerkValues` / `onPerkDrop` `system.choice` writes, hang-up-choice.mjs, the
Favorite Weapon / Mode Attachment `updateItem set system.choice` pack rules), describe-when.mjs (it phrases the tag text, reads
no value), migration.mjs's generated `rule:data:system.choice=` / `{item.choice}` rule text (read through the aliases above),
the Details templates (they edit the field itself).

Tests (all pass; full suite unchanged otherwise):

- `module/rules/choice-read.test.js` - precedence, explicit / missing keys, empty values falling through, legacy-only items
  returning the raw field exactly, lists (`chosenList`, `hasChosen`, `hasAnyChoice`), primaryChoiceKey shapes.
- `module/rules/choice-read-readers.test.js` - each switched reader with the pick held three ways (legacy `system.choice`
  only; the 6.1 `legacyChoice` flag only; a rules choice with a ChoiceSet and a stale `system.choice`), plus the old empty-pick
  edge cases. Readers already covered with legacy-only items and still passing: dice.test.js (Agile Reflexes),
  companions.test.js (Favorite Command), perk-handler.test.js, migration.test.js, engine15-banked / engine17-* tests.
- `module/rules/choice-read-packs.test.js` - parity harness over the shipped packs: the 116 old-picker items, and every item
  whose rules read the pick (`{item.choice}`, `rule:` / `item:data:system.choice`, `choiceOf`, `to: "choice"`,
  `{sourced.<id>.system.choice}`, `skills: ["choice"]`), each with a legacy-only world copy (and copies of the items it points
  at) for every value its own rules test plus 'sample' / 'none' / '': new interpolation, data tags, `skill:choiceOf` and labels
  equal the old raw-field reading. It also asserts every form was really exercised, and that none of these items (or their
  choiceOf targets) has a primary rules pick yet.

Phase 1 / 2 must know:

- `primary: true` on ChoiceSet is honoured by the reader but not yet a declared ChoiceSet param in rules/types.mjs -
  add it (and to editor-spec) before any pack item uses it.
- The pack harness's "no primary pick yet" assertion is meant to fail once Phase 2 adds ChoiceSets to these items; update it
  per family (the tag rewrites happen in the same edit, so `{item.choice}` / `rule:data:system.choice` should be gone from those
  items by then).
- A multi-pick list returned to a single-Skill reader (`skillFor` / `useSkillOf` choiceOf, DamageType `to: "choice"`, dieOf,
  `{item.choice}` text, `chosenOf(...) ==` JS readers) is still the raw array. Decide per reader in P2b whether it means
  "first entry" or "any entry" (switch those to `hasChosen` / `chosenList`).
- `onPerkDelete` and `migratePerkValue` read `legacyChoiceOf` - after the M2 unbake (3.2) they must also skip copies flagged
  `choiceMigration.unbaked`, or the delete would take the value off a second time.
- `legacyValue('system.choice')` already reads the 6.1 flag, so `legacy: "system.choice"` ChoiceSets keep working after the
  migrateData shim.
- `{item.choice}` on an item with a ChoiceSet now reads that ChoiceSet's pick: a homebrew item mixing both will see the rules
  choice first (none in the packs).
