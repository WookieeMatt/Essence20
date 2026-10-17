# Perk choice migration plan (old `hasChoice` picker -> rules choices)

Status: designed 2026-10-06; Phases 0, 1, 2 and 3 built 2026-10-07 (see the "done" sections at the end); P4 (6.1) to do. Branch Rules-Engine-Phase-1.
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
12. (P2) All-Terrain Alt Mode offers every Movement type (TF CRB 2nd printing p.110); enforcing "one your Alt Mode lacks" would
    need a filter on the Alt Mode's own movement - not built, the player picks.
13. (P2) 21 old choice types never stored their pick (old picker bug): those characters pick on the Rules tab (the migration
    reports them). Prompt on sheet open instead (see 11)?
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

## Phase 1 - done 2026-10-07

Engine only: no pack item, no world migration, no Details-tab change. check-rules passes (the new assertions included) and
the Phase 0 pack-parity harness is still green (no pack ChoiceSet was added). Reference for authors:
docs/RULES_CONVERSION_GUIDE.md, "Engine features added (Perk choice P1)". Tests: `module/rules/perk-choice-p1.test.js`.

What was built (plan §2.2):

| §2.2 | Built | Where |
|---|---|---|
| 1. ChoiceSet sources | ChoiceSet keeps skill / essence / defense / list / text; every other `from` goes through `steps.pickOptions` with the actor (exactly the pick step's list). New pick sources `sense`, `environment`, `movement`, `element`; the existing `config` source takes `table` (= `path`) and list tables with `labels`. `from` validates against every registered source. | lifecycle.mjs#choiceOptions, plugins/picks/choice-sources.mjs, plugins/tags/role-points-and-flag-lists.mjs |
| 1. params | `only` (any source, and pick steps), `essence`, `notHeld` / `held` (sense / environment / movement), `excludeCopies` (re-checked on confirm), `count` (a list; no value twice), `rename` (+ `flags.essence20.rules.baseName`), `required`, `primary`, `table` / `path` / `labels` / `exceptAt` | types.mjs ChoiceSet, lifecycle.mjs#askRule / initialState / renameUpdate / setUpItem |
| 1. re-pick | Rules tab "change" (owner + GM, the existing button) runs askRule for a ChoiceSet (list picks too) and repickSubPerks for an added Trigger's pickSubPerk; labels of lists joined | sheet.mjs#changeChoice / rulesContext, actor-view.mjs |
| ask queue | per-actor `queueAsk`: onCreateItem's asks, "change", pickSubPerk | rules/ask-queue.mjs |
| 2. fills | DamageType `to: "{choice.x}"` (updateItem text already filled) | adapter.mjs#ruleDamageType |
| 3. Q3 | DerivedStat `op: append` (derived only, each entry once, list picks add every entry) - the user's "derive it" decision, so no Trigger pair is needed | adapter.mjs#ruleDerived, types.mjs |
| 4. | `@choiceCount` | plugins/picks/choice-count.mjs |
| 5. | step `pickSubPerk` + `repickSubPerks`; `perk-handler.mjs#createSubPerk` (onPerkDrop's 'perks' branch moved into it, unchanged behaviour); grouped `chooseSelect` (`<optgroup>`) | plugins/picks/pick-sub-perk.mjs, sheet-handlers/perk-handler.mjs, mechanics/resources/grants.mjs |
| 6. | check-rules assertions: no double ask; no `system.choice` / `{item.choice}` in a converted item's rules; a `legacy: "system.choice"` ChoiceSet has a fixed-list source | rules/choice-checks.mjs, scripts/check-rules.mjs |
| list reads | a tag with a list `{choice.x}` is true when any entry is (`not:` negates the whole); a DerivedStat path with a list `{choice.x}` applies once per entry | predicate.mjs#evaluateTag, adapter.mjs#choicePaths |
| editor | form fields for every new ChoiceSet param, `from` options for the new sources, DerivedStat append (a text value field), a pickSubPerk step form (`editor-spec.mjs#registerStepForm`); en.json labels | editor-spec.mjs, lang/en.json |

How each Phase 2 group should use it:

- **P2a (family A, 28):** `{type: ChoiceSet, key: <short key>, from: config, table: <the E20 table the old switch read>,
  rename: true, required: true, legacy: "system.choice"}`. Tables: fightingStyle, airBornMovement, alwaysReadyOptions,
  powerAdaptationOptions, electromagneticDisruptionOptions, defensiveFlexibilityOptions, energyConnectionOptions,
  viciousOrVenomOptions, toothAndClawOptions, overTheCandlestickOptions, sparedNoExpenseSkills, communityHelperSkills,
  roamingTheLandOptions, twoHandedAssaultOptions, elementDamageTypes (or `from: element`), stoneWarlordDamageTypes,
  wisdomOfTheEldersOptions, phantomFocusOptions, experimentOptions. Field: `from: skill, only: [culture, science,
  technology]`. vehicleType: `from: movement, only: [aerial, ground, swim]` (no `held` - any actor may pick any of the
  three). essence: `from: essence`. Rewrites: `rule:data:system.choice=x` -> `rule:choiceHas:<key>:x`, `{item.choice}` ->
  `{choice.<key>}`, DamageType `to: "choice"` -> `to: "{choice.element}"`. Set `hasChoice: false` in the same edit
  (check-rules refuses both), and update choice-read-packs.test.js's "no primary pick yet" assertion for these items.
- **P2b (family B, 32):** `from: skill` (+ `essence` for I've Done My Research, `excludeCopies: true` for GIJ
  Expertise), `rename`, `required`, `legacy: "system.choice"`; the three multi-pick Perks add `count` (2 / 3 / 2). A list
  is read by `skill:{choice.skill}` tags, DerivedStat paths and `rule:choiceHas` with no extra work; decide the other
  single-value readers (Phase 0 list above). Reroll scope `skills: ["{choice.skill}"]` still needs the audit's Reroll-rule
  move.
- **P2c (family C, 10):** Acute Sense `from: sense, notHeld: true` + DerivedStat `system.senses.{choice.sense}.acute =
  true`; Environmental Expertise / Environment Choice `from: environment, notHeld: true` + DerivedStat `path:
  system.environments, op: append, value: "{choice.environment}"`; Fast `from: movement, held: true` (the old list offered
  only movements with base > 0) + Movement / DerivedStat on `system.movement.{choice.movement}.bonus`; All-Terrain Alt
  Mode `from: movement, only: [aerial, ground, swim]` + DerivedStat on `system.movement.{choice.movement}.altMode`. Then
  the M2 unbake.
- **P2d (family D, 46):** `{type: Trigger, event: added, removeOnStop: true, steps: [{do: pickSubPerk, key: perks, count:
  "<numChoices> + @choiceCount"}]}` (count 1 needs no `@choiceCount` unless a ChoiceCount names the item); Nobody Like Me
  `anyGeneral: true` (retire AnyGeneralPerkChoice). `system.items` stays. A child that still has `hasChoice` goes through
  the old setPerkValues, so D can convert before A-C.
- **P2e:** Augmented `{ChoiceSet, key: damageType, from: damageType, legacy: "system.choice"}`; Mode Attachment's Bot Mode
  branch can be a list pick or a `pick` with `only`.

Phase 2 must know:

- `removeOnStop` deletes an item when the run stops, granted or not; ChoiceSet `required` keeps a granted copy (grantedBy
  / parentId). If open question 5 is decided as "keep it", drop `required` / `removeOnStop` from the converted items.
- `notHeld` / `held` read the actor's prepared data. Once family C derives acute senses / environments from the rules, a
  re-pick from the Rules tab still offers the current pick (it is the item's own), but another copy's pick reads as held.
- excludeCopies reads other copies' `flags.essence20.rules.choices[key]`, else (with `legacy`) their `system.choice`, so
  GIJ Expertise copies dropped before the migration still count.
- The M1 copy should wrap a scalar in a list for a `count` ChoiceSet (legacyChoiceUpdates doesn't yet); the migration that
  folds duplicate GIJ Expertise copies into one list item is still to write.
- Asks are queued only on this client and only for onCreateItem / "change" / pickSubPerk; a `pick` step in another added
  Trigger still opens at once. Don't call queueAsk from inside a queued ask for the same actor.
- The prompt is still a plain select (grouped for pickSubPerk's any-General list); the old ChoicesSelector's search box was
  not carried over.
- repickSubPerks deletes the old children with `deleteEmbeddedDocuments` (rule grants come off through onDeleteItem);
  entries an any-General pick wrote onto the parent's `system.items` stay.
- `perkChoiceProblems` counts `pick` / `pickEach` steps in added Triggers as rules picks: an item converted that way must
  drop `hasChoice` in the same edit.

- Cancelling a pick (user, 2026-10-07): a DROPPED item whose required pick is cancelled is not added (the drop fails); one GRANTED by a Role or another item (parentId / grantedBy) cannot be cancelled - it asks again until something is picked (lifecycle.mjs#setUpItem; after 10 re-asks with nothing picked it is left unpicked with a warning, so an empty option list cannot loop forever). Phase 2 marks every converted choice `required: true`.

## Phase 2 - done 2026-10-07

All 116 old-picker items are converted (P2a-P2e in one pass), with the world migration for every group. check-rules is clean
(the P1 assertions plus two new ones), the full jest suite passes. Pack edits were text-only (one script, each file read just
before it was written, its line endings kept, the result checked against the same edit made on the parsed object); no book
text. Pre-conversion snapshot of every converted item and every cross reader: `module/rules/test-data/perk-choice-p2-baseline.json`
(the parity tests compare against it). Tests: `module/rules/perk-choice-p2.test.js`.

Every converted pick is `required: true` (a ChoiceSet's `required`, a pickSubPerk step's new `required` - see below), so
per the user's ruling a dropped item whose pick is cancelled isn't added and a granted one asks again until picked. Every
converted item has `hasChoice: false` and `choiceType: "none"` (Augmented: `null`) in the same edit.

Counts: A 27 (the inventory table's rows add up to 27, not 28 - 27 + 32 + 10 + 46 + 1 = 116), B 32, C 10, D 46, E 1.

### Per group

| Group | Items | New shape | Rule rewrites |
|---|---|---|---|
| P2a (A, 27) | Air Born, Always Ready, Community Helper, Defensive Flexibility, Electromagnetic Disruption, Adapted Wavelength, Energy Affinity, Ninja Power, Energy Connection, Adaptable, Experiment, Field, Fighting Style, Over the Candlestick, Phantom Focus, Power Adaptation, Roaming the Land, Spared No Expense, Stone Warlord, Tooth and Claw x2, Two-Handed Assault, For The Syndicate, Good To Go, Petrolhead, Vicious or Venom, Wisdom of the Eldars | `ChoiceSet {key, from: config, table}` (the E20 table the old switch read); Field `from: skill, only: [culture, science, technology]`; vehicleType `from: movement, only: [aerial, ground, swim]` (key `vehicle`); essence `from: essence`; elementDamageType `from: element`. All `rename, required, legacy: "system.choice"`. Keys: `style` (Fighting Style), `skill` (Field, Community Helper, Spared No Expense), `damageType` (Tooth and Claw, Stone Warlord), `element`, `vehicle`, `essence`, else `option` | `rule:data:system.choice=x` -> `rule:choiceHas:<key>:x`; Vicious or Venom's bare `rule:data:system.choice` -> `rule:choiceHas:option` (new bare form: "some pick"); `{item.choice}` -> `{choice.<key>}`; `to: "choice"` -> `to: "{choice.<key>}"` |
| P2b (B, 32) | the 32 `skills` Perks | `ChoiceSet {key: skill, from: skill, essence? (I've Done My Research: smarts; Totally Awesome: social), count? (GI Joe Expertise 2, I've Done My Research 3, Low Tech Priorities 2), excludeCopies? (GI Joe Expertise - its UniqueChoice rule removed), rename, required, legacy}` | `{item.choice}` -> `{choice.skill}`; Agency's DieSubstitution `skills: ["choice"]` -> `["{choice.skill}"]`; a Reroll rule with no Skills of its own (MLP / PR Expertise, Aptitude Augmenter, Trade Experience) gains `skills: ["{choice.skill}"]` |
| P2c (C, 10) | Acute Sense x3, Acute (Sense), Environmental Expertise, Environment Choice, Fast x2, All-Terrain Alt Mode, Transmetal | Acute: `from: sense, notHeld` + DerivedStat `system.senses.{choice.sense}.acute = true`. Environments: `from: environment, notHeld` (Environment Choice `count: 2` - book) + DerivedStat `system.environments` `op: append` `{choice.environment}`. Fast: `from: movement, held`, its five Movement rules kept. All-Terrain Alt Mode: `from: movement` (every type - book) + DerivedStat `system.movement.{choice.movement}.altMode` `op: set` 20; its three bundled Active Effects removed from the pack item. Transmetal: `from: movement, only: [aerial, ground, swim]` | Transmetal's 9 and Fast's 5 `rule:data:system.choice=x` -> `rule:choiceHas:movement:x`; Fast's and GI Joe Expertise's gate `rule:data:flags.essence20.perkValueRule` -> `not:rule:data:system.value>0` (see below); GI Joe Expertise's DerivedStat path -> `system.skills.{choice.skill}.shiftUp` |
| P2d (D, 46) | the 46 `perks` Perks | `Trigger {event: added, removeOnStop: true, steps: [{do: pickSubPerk, key: perks, count?, anyGeneral?, required: true}]}`; count = numChoices (2 on Modified Shell I-III and Metamorphosed Changeling; `"2 + @choiceCount"` on Grid Science I-IV / Grid Tech I-IV, Grid Tap's ChoiceCount); Nobody Like Me `anyGeneral: true` (its AnyGeneralPerkChoice rule removed). `system.items` stays | none (nothing read the pick) |
| P2e | Augmented (Hang-Up) | `ChoiceSet {key: damageType, from: damageType, required, legacy}` (no rename - the old prompt didn't rename) | `{item.choice}` -> `{choice.damageType}` |
| P2e rule-written picks | Favorite Weapon, Mode Attachment | Favorite Weapon: the `weapon` pick step gains `legacy: "system.choice"`, its `updateItem set system.choice` step is gone; condition-damage-buttons reads `chosenOf(perk, 'weapon')`. Mode Attachment: key `mode` - Bot Mode sets `flags.essence20.rules.choices.mode` (updateItem), the Alt Mode branch is `pick {key: mode, legacy: "system.choice"}`; its Trigger reads `var:mode={choice.mode}` | - |
| P2e cross readers | Gallantry, Self-Preservation, Volatile Delivery | - | `item:data:system.choice=triggerHappy` -> `item:choiceHas:style:triggerHappy` (new tag); `{sourced.DgFY0ZmAtClAobiA.system.choice}` -> `{sourced.DgFY0ZmAtClAobiA.flags.essence20.rules.choices.element}` (with Volatile Delivery's `|fire` default). The `choiceOf:` readers (19) need no text change |

Book checks (book is truth): Environment Choice picks two environments (GI Joe CRB p.92; the old picker asked one).
All-Terrain Alt Mode is "a Movement Type you do not have access to in your Alt Mode ... of 20ft" (TF CRB 2nd printing p.110):
every Movement type is offered (the old picker offered ground / aerial / aquatic), and it sets 20 ft as the old Active
Effect (mode Override 20) did. Fast keeps the old picker's "a Movement you have" (`held`).

Found on the way: the old picker never stored `system.choice` for 21 of its 29 choice types (onPerkDrop wrote it only for
environments / senses / movement / altModeMovement / skills / fightingStyle / field): Air Born, Always Ready, Power Adaptation,
Defensive Flexibility, the element / vehicle / essence picks etc. never had a pick on existing characters, so their
`rule:data:system.choice=` rules never fired. Those copies have nothing to migrate; the migration reports them as "nothing
picked yet - pick it on the Rules tab".

### Engine pieces added in P2

- `choice-read.mjs#choiceValue(item, key)`: the rules choice, else - while an item converted from the old picker (a
  ChoiceSet or pick step carrying `legacy: "system.choice"`) has none - its old pick (system.choice / the 6.1 flag; a list
  ChoiceSet gets `[old]`). Read by `{choice.x}` (interpolate, ruleLabel, DerivedStat paths and append values, Grant uuids),
  `rule:choiceHas`, `item:choiceHas`, `{sourced.<id>.flags.essence20.rules.choices.<key>}` (predicate and the step-text
  `sourced` ref) and `chosenOf`. So a converted pack item works on an old copy before the migration has run (and for an
  unmatched old value the migration leaves alone - the same reading the old rules gave). Also `legacyChoiceRule`,
  `firstChosen`.
- Tags: `rule:choiceHas:<key>` (no value: some pick made), `item:choiceHas:<key>[:<value>]` (the tag's item). Loaded with
  `rules/adapter.mjs` so they exist wherever rules are read.
- `lifecycle.mjs#matchedLegacyChoice`: a copy added to an actor that already carries an old pick matching an option (a world
  copy made before the conversion, dragged to another actor) takes it without asking.
- pickSubPerk `required` (with an editor field): a granted item (grantedBy / parentId) is asked again after a cancel (up to
  10 times) and, with nothing to offer, stays unpicked with a warning - its Trigger's removeOnStop no longer deletes it; a
  dropped one stops the run (removeOnStop takes it off).
- `choice-checks.mjs#hasRulesPick` / `hasSubPerkPick`; perkChoiceProblems also refuses a converted item that still has a
  choiceType or a UniqueChoice / AnyGeneralPerkChoice rule.
- Exactly one dialog per pick: `setPerkValues`, `createSubPerk`, `setRoleVatiantPerks` and the Hang-Up prompt
  (`hang-up-choice.mjs#applyHangUpChoice`) skip the old picker for anything with a rules pick (even a world copy still saying
  hasChoice); `grantPerkEquipmentMap` treats a pickSubPerk Perk's `system.items` as its option list, not a grant;
  `onPerkDelete` leaves a copy flagged `choiceMigration.unbaked` alone; `legacyChoiceUpdates` (the linking pass) no longer
  copies `legacy: "system.choice"` as-is (the value-matched migration does).
- The Fast / GI Joe Expertise gate: their rules apply unless the copy still stores `system.value > 0` - the copies whose
  drop baked the bonus and that the Details cleanup's migratePerkValue hasn't processed yet (it resets the value). A new
  drop stores 0, so the perkValueRule flag isn't needed by the new rules. perkValueRules' `has` accepts the `{choice.skill}`
  path, so migratePerkValue never adds the old rule beside the converted one.

P2b list-awareness (Phase 0's open point, decided):

| Reader | A list pick reads |
|---|---|
| tags with `{choice.x}`, `rule:choiceHas`, `item:choiceHas`, `skill:choiceOf`, `holder:choiceOf`, AttackResistance `choiceOf` | any entry |
| DerivedStat path / append, Reroll `skills: ["{choice.x}"]`, DieSubstitution `skills` (`"choice"` / `"{choice.x}"`; best: the best of them, use: the first) | every entry |
| `{choice.x}` in chat text and in labels | every entry, joined with ", " ("…" when the list is empty) |
| Grant `uuid: "{choice.x}"` | every entry granted |
| `skill: "choiceOf:..."` (roll / rollVsEach), DialogSwitch `useSkill: "choiceOf:..."`, DamageType `to` (`"choice"` and `"{choice.x}"`), DamageImmunity `choiceOf`, the `sourced` step-text ref, Energy Affinity's JS readers | the first entry (one Skill rolled, one damage type) |
| Over the Candlestick (dice.mjs), Phantom Focus | any entry (`hasChosen`) |

### World migration (migration.mjs, "Perk choice P2" block)

- `migratePerkChoiceItem(item, actor?)` - M1: the old pick into `flags.essence20.rules.choices.<key>` only when the slot is
  empty and every value is one of the rule's options (a ChoiceSet's every option, held / notHeld off; an ownedItem pick: the
  actor's items of that type; Mode Attachment also `botMode`); a list ChoiceSet gets `[value]`. Unmatched and unpicked are
  reported, never copied. `system.hasChoice` goes back to false (RESET_TO - the field can't be deleted in v14) unless
  something was left unmatched; `system.choice` stays as the backup until 6.1. Family D: the children already under the copy
  (`flags.essence20.parentId`) are recorded under the pickSubPerk key. A copy whose own rules are only what the Details
  cleanup wrote onto it (perkValueRules) gets `system.rules: []` so it inherits the converted rules. Flag
  `flags.essence20.choiceMigration.copied`.
- `unbakePerkChoice(item, actor, state)` - M2 for acute senses (stored `acute` back to false), environments (one entry out of
  the stored list) and All-Terrain Alt Mode (the one enabled bundled AE disabled, as a nested `effects` update); only for a
  copy whose rules are converted and that isn't flagged `choiceMigration.unbaked`. A value already gone is reported
  ("clamped") and the copy flagged. Fast / GI Joe Expertise: migratePerkValue, reused.
- `planActorPerkChoices(actor)` - M1 + M2 + the sub-Perk record for one actor as data (`actorUpdate`, `itemUpdates`), merged
  into `migrateActorData`'s update, so the actor change and each copy's flag are ONE `actor.update`.
- `planPerkCopyFold` - the multi-Skill Perks' old one-copy-per-Skill shape folded into one list item per grant (same book
  item, parentId, collectionId, grantedBy - so Commando's 1st-level and 7th-level Expertise stay two items of two Skills):
  every value kept, no value twice, renamed "Name (A, B)" (baseName kept), the other copies' rule state (toggles, pools,
  limits...) and perkValueRule flag carried where the kept copy has none; the others deleted after the update. A copy with an
  unmatched pick stays out. The baked +2s come off through migratePerkValue first, so the total bonus is unchanged.
- `migrateActorPerkChoices(actor)` - all of it for one live actor: one `actor.update` (actor fields + item updates), then the
  folded copies deleted. Run by `migrateWorld` and `migrateCompendium` after each actor's update, and by
  `migratePerkChoices`.
- `migratePerkChoices()` - at `ready` (essence20.mjs, after linkExistingCopies), GM only: every world actor, every unlinked
  token actor (`scene.tokens` with `!actorLink`), every world Item; gated by the new world setting
  `perkChoiceMigrationVersion` < `PERK_CHOICE_MIGRATION_VERSION` (1). Console summary and a GM whisper listing what was
  left alone. `migrateItemData` runs M1 for an item with no actor (world / compendium items).
- Idempotent: every step fills only empty slots or undoes only what isn't flagged; a second run changes nothing (tested,
  including after a fold).

The old fields stay in the data model with "deprecated until 6.1" comments (data/item/perk.mjs, hangUp.mjs).

### Left / P3 needs

- **P3 (Details tab)**: hide `hasChoice` / `choiceType` / movement `value` / `numChoices` / `choiceEssence` on the Perk
  Details tab and `hasChoice` / `choiceType` on the Hang-Up tab; every pack item is converted, so the "hidden when every
  pack item is converted" condition holds now. A world copy the migration left with `hasChoice: true` (an unmatched pick)
  gets the read-only "Legacy choice" notice. Retitle the `items` id-drop "Choice list (used by the Pick Sub-Perk rule)" and
  show it only with a pickSubPerk rule. `E20.perkChoiceTypes` stays until 6.1.
- **P4 (6.1)**: unchanged - plus `choiceValue`'s legacy fallback reads the 6.1 `legacyChoice` flag already, so the
  migrateData shim keeps old copies working. Code now dead for pack content (kept until 6.1): the setPerkValues switch and
  its helpers, onMultiSkillPerkDrop / getAlreadyChosenExpertiseSkills, MultiChoiceSelector, the perk branches of
  ChoicesSelector, hang-up-choice.mjs, UniqueChoice / AnyGeneralPerkChoice (no pack item uses them now), the
  `choiceType == 'skills'` Reroll-scope fallback in ruleRerollGrants.
- Not live-tested: the whole drop / grant / re-pick flow in Foundry, the nested `effects` update in `actor.update` (All-Terrain
  Alt Mode unbake), the GM whisper. Packs need a recompile.
- The baseline snapshot (~200 KB) lives under module/ and so ships in the release zip; move it if that matters.

### Open (added to §5)

12. All-Terrain Alt Mode now offers every Movement type (book). If the GM wants only types the Alt Mode lacks enforced, that
    needs an `exceptAt`-style filter on the Alt Mode's own movement (not built; the player picks).
13. The 21 choice types whose pick was never stored: existing characters must pick them on the Rules tab (reported). Should the
    sheet prompt on open instead (Q11)?

- 2026-10-07 (user): the Perk choice pass is part of the main migration - `migrateWorld` calls `migratePerkChoices` at its end. The separate `ready` hook, the `perkChoiceMigrationVersion` setting and `PERK_CHOICE_MIGRATION_VERSION` are gone. It runs when `needsMigrationVersion` (bumped at release) says so; to test, force it with `game.settings.set("essence20", "systemMigrationVersion", "4.1.2")` and reload.

## Phase 3 - done 2026-10-07

The old picker's inputs are off the Details tab (plan §2.5). No pack, migration or engine change; check-rules clean.

Hidden / changed:

- **templates/item/details/perk.hbs**: the `hasChoice` checkbox (and its two-way disable with `canAdvance` - Can Advance is
  always editable now), the `choiceType` select, the `numChoices` input. (`choiceEssence` and the movement `value` had no input
  left on the tab already; nothing else edits these fields.)
- **Legacy notice**: an item that still has `hasChoice: true` shows a read-only "Legacy Choice: <type label> = <pick>" row -
  "(old picker - convert it to a ChoiceSet rule)" for a homebrew item with no rules pick, "(not carried over - pick it on the
  Rules tab)" for a converted copy the migration left unmatched. The pick is read with `choice-read.mjs#chosenList` (joined).
- **Sub-Perk list**: the `system.items` id-drop is retitled "Choice list (used by the Pick Sub-Perk rule)" and shows only
  when the item has a pickSubPerk rule, or is a legacy `choiceType: perks` item (the old picker still reads the list).
- The context comes from the new pure `module/rules/perk-choice-details.mjs#perkChoiceDetails(item, E20.perkChoiceTypes)`,
  set as `context.perkChoice` in item-sheet.mjs for Perks.
- **Hang-Up**: its Details template had no choice inputs (Augmented's pick was always a drop prompt), so nothing to hide.
- The current pick keeps showing on the Rules tab's ChoiceSet / pickSubPerk row with "change" (P1); the Details tab had no
  display of `system.choice` to switch.
- Data model: every old field (perk.mjs `choice`, `choiceEssence`, `choiceType`, `hasChoice`, `numChoices`, `value`;
  hangUp.mjs `hasChoice`, `choiceType`, `choice`) is marked "Deprecated 2026-10-07: replaced by rules choices; remove from the
  data model in 6.1."
- lang/en.json: removed `PerkHasChoice`, `PerkChoiceType`, `PerkChoiceQuantity`, `PerkNumChoices` (already unused),
  `PerkPlural` (only the old id-drop label); added `PerkLegacyChoice`, `PerkLegacyChoiceConvert`, `PerkLegacyChoiceRepick`,
  `PerkSubPerkChoiceList`. The `PerkChoice<Type>` labels stay (E20.perkChoiceTypes, read by the schema and the notice).
- Tours: none pointed at the removed inputs.
- Code: no sheet listener served only these inputs, so nothing to remove there. The drop-time old picker (setPerkValues,
  onMultiSkillPerkDrop, MultiChoiceSelector, the ChoicesSelector perk branches, hang-up-choice.mjs) stays: a homebrew world
  item with `hasChoice: true` still asks through it until 6.1 - but its type / count can no longer be edited on the sheet
  (only through the item's data, or by converting it to a ChoiceSet).
- Tests: `module/rules/perk-choice-details.test.js` - the helper's cases, and the perk / Hang-Up Details templates read as
  text: no `name="system.<field>"` input for any old field, the old labels gone, the new lang keys present and the removed ones
  absent.

Left for 6.1 (P4), unchanged: remove the fields and `E20.perkChoiceTypes` (and with them the `PerkChoice<Type>` labels and the
legacy notice / perk-choice-details.mjs's legacy half), the migrateData shim, and the dead old-picker code listed under
"Left / P3 needs". Not live-tested in Foundry.
