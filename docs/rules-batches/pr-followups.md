# PR CRB follow-ups (2026-10-07)

The four follow-ups the user decided after `pr-crb-2nd-printing-check.md`. Book: *Power Rangers Core Rulebook (2nd
Printing)* only. Pages are printed pages; the PDF index is shown where it differs.

## 1. Generic weapons renamed to each line's printed name

Each line was checked against its own core book. G.I. JOE and Transformers print different names from PR, so the
shared `_id`s now carry different names in different packs. `_id`s and file names are unchanged. Effects and folders
follow the pattern "<weapon> Effect" / "<weapon> Alternate Effect N".

| Pack | Old | New (book) |
|---|---|---|
| PR (`prcrbitems`) | Frag Grenade (+ Effect, folder) | **Grenade** (Table 8-3.3 "Other Weapons", p.112 / PDF 114) |
| PR | Close Combat Bludgeoning (+ Effect, Alternate Effect 1, folder) | **Close Combat Bludgeon** (book: "Close combat bludgeon", p.112) |
| PR | Martial Arts Long Bludgeoning; effects and folder "Long Bludgeoning ..." | **Martial Arts Long Bludgeon** (+ Effect, Alternate Effect 1-3, folder) (p.112) |
| PR | Long Blade (+ Effect, Alternate Effect 1-2, folder) | **Martial Arts Long Blade** (p.112) |
| PR | Medium Blade (+ Effect, Alternate Effect, Alternate Effect 2, folder) | **Martial Arts Medium Blade** (p.112) |
| PR | Zeo Laser Pistol (+ Effect, the six colour effects, folder) | **Zeo Laser Pistols**, "Zeo Laser Pistols (Black) Effect" etc. (Table 8-3.1, p.108 / PDF 110) |
| G.I. JOE (`gijcrbitems`) | Close Combat Bludgeoning (+ effects) | **Close Combat Bludgeon** (weapons table, PDF p.141; pack cites p.141) |
| G.I. JOE | Long Bludgeoning (+ effects) | **Long Bludgeon** (PDF p.143; pack cites p.142) |
| Transformers (`tfcrbitems`) | Close Combat Bludgeoning (+ effects) | **Close Combat Bludgeon** (2nd printing PDF p.123; pack cites p.121) |
| Transformers | Long Bludgeoning (+ effects) | **Long Bludgeon** (PDF p.125; pack cites p.123) |
| Cobra Codex (`ccitems`) | Close Combat Bludgeoning (Manipulative) (+ effects, Command Branch and Shield Fighter entries/notes) | **Close Combat Bludgeon (Manipulative)** (Cobra Codex PDF p.92: "Close combat bludgeon with Manipulative upgrade") |

Kept, because their books print them that way: Frag Grenade, Long Blade and Medium Blade in G.I. JOE (PDF p.141) and
Transformers (PDF pp.123-124), plus the Quartermaster's Guide "Frag Grenade (...)" and Cobra Codex "Medium Blade
(Ceremonial)" variants.

Casing: title case, as the packs use. "Close combat bludgeon" becomes Close Combat Bludgeon, "Martial Arts long blade"
becomes Martial Arts Long Blade, and so on.

References: no module code, importer map or Threat stat block matched these names. The only name references were the
weapons' own effect caches, the Cobra Codex notes and entries above, and one test mock (`conv14-items1.test.js`, Create
Weapon). No pack carries a `name~` tag for them. World copies keep their old names.

Not in scope, left as they are: the other "-ing" bludgeon names, which the books print as "... bludgeon" (Close Combat
Heavy Bludgeoning, Short Bludgeoning, Thrown Bludgeoning).

## 2. Stray items moved out of the PR core pack

`git mv`, with `_id` and `_key` kept and `folder` fixed. The uuid changes from `Compendium.essence20.pr_crb.Item.X` to
the new pack.

- **A Jump Through Time** (`jump_through_time`, `packs/jttitems`): Brainstorm, Contingency Shot, Defensive Flexibility,
  Heavy Force, Iron Bravado, Mysterious Aura and Pay It Forward. They are the Spectrum Modification Perks (JTT p.45 / PDF
  47). They go in a new folder, **Spectrum Modification** (`S0TVSZfMxXIqPYj4`), under JTT Perks > Role.
- **New pack: Power Rangers Pre Gen Characters** (`power_rangers_pre_gens`, `packs/prpgitems`). No existing pack fits:
  Power Rangers Adventures holds the adventures, and the Pre Gens are separate character-sheet PDFs. The pack is defined
  in `system.json` like the others and placed in the Power Rangers pack folder. It holds Power Crossbow, Power Hammer,
  Power Spear and Power Tetsubo, with their 7 effects. Folders: **Weapons** (the old "Unique" folder `Cp5ngUHeZZt7nlpL`,
  now a root folder) and **Weapon Effects** (new, `49heUbi6A1Hl45yV`) with the four per-weapon effect folders. The
  weapons' effect entries point at the new pack. Their stray `classFeatureId` / `alternateEffects` keys were dropped and
  the effects' `numHands` are numbers (pack-schema-keys).
- References updated: the Black Ranger's Iron Bravado entry (`choiceGroup: black-2`); `IRON_BRAVADO` in
  `module/items/defenses/iron-bravado-shared-immunity.mjs`; and the tests' pack paths and uuid (dice, book-costs,
  book-followups, conv14-dice, conv14-items1, conv15-banked, conv15-uses, conv17-split3, conversions). No other rule, Role
  list or module constant named these ids.
- **Existing world copies.** Two things cover them:
  - Alias fallback: `item-lookups.mjs#MOVED_ITEM_UUIDS` / `currentUuid`, read by `sourceOf`, `sourceOfOrUndefined` and
    `rules/inherit.mjs` (`rulesSourceOf`). An old copy finds its original and its rules, and code matches it by the new
    uuid. Drop it at 6.1.
  - Migration: `migration.mjs#migrateMovedItemSources`, called from `migrateItemData` (world items, actor items, world and
    module packs). It rewrites an old uuid in `flags.core.sourceId`, `_stats.compendiumSource` and
    `flags.essence20.rulesSource`, in `system.items.*.uuid` (a copied Black Ranger Role's level list), and in
    `flags.essence20.rules.choices` (pick lists). It is value-matched and idempotent.
  - Not aliased: the automation notes and the book-description lookups in `documents/item.mjs` read the raw source. An
    old copy shows its inherited notes again once the migration has run (or after `npm run build:db` plus migration).
- Packs not compiled. The new pack needs `npm run build:db` to exist as a LevelDB.

## 3. Grid Relic Weapon: two Relic Weapon Traits at 1st level (p.61 / PDF 63)

The book's Grid Relic starts with two traits from its list of eight. The White Ranger gains one more at 7th, 12th and
17th level (Table 4-9, p.60).

- **Grid Relic Weapon** (`82Ld65NsKwfMZaSC`): new `added` Trigger, `pickSubPerk {key: perks, count: 2, required: true}`
  (PCs only), with `system.items` listing the eight "Relic Weapon Trait: ..." Perks. Each pick becomes its own Perk. The
  weapon creation is unchanged and runs first.
- **Relic Weapon Trait** (`U8hcTqLqPyMGyz22`, `_id` kept; the White Ranger's 7/12/17 entries): it was the manual
  placeholder, and is now a `pickSubPerk` of 1 from the same list. The default `notOwned` leaves out the traits already
  held. Status full.
- The traits' rules, where the engine can express them:
  - Zord Control: `RollModifier` scope `ownZord` ↑1 on the Zord's attacks, plus `SummonTime mode: halve`. Full.
  - Energy Blasts: a Grid Relic attack `DialogSwitch`, ↑1, `limit {per: rest, max: 3}` ("per day", as the packs' other
    daily uses). The 100-foot Reach is left to the table. Partial.
  - Fast Draw: Edge on Initiative while the Grid Relic is equipped
    (`self:wielding:item:data:flags.essence20.pr2GridRelic`). This replaces the old switch-on Active Effect. Summoning it
    as a Free action is left to the table. Partial.
  - Intelligence: `ChoiceSet` of 3 Smarts / Social Skills, plus Edge on them (`skill:{choice.skills}`). The Relic's own
    Smarts / Social 6 is left to the table. Partial.
  - Shatter Strike: a Grid Relic attack `DialogSwitch`, ↑2, ticked against an object. Full.
  - Multi-Strike, Proximity Alarm and Thunderous stay manual. The book gives no Skill or Defense for the roar or the
    two-target strike, and no mechanic for the alarm.
- Notes are short paraphrases. World copies inherit the rules. A character who already holds the Grid Relic Weapon is
  not asked again (`added` only), and can add the traits by hand.

## 4. Expertise: "Choose a Skill at d4 or higher" (p.95 / PDF 97)

Per the coordinator's clarification, this applies only to the PR General Perk Expertise (`uoCQgYOCeIQNzF0q`). The
G.I. JOE (Commando, p.72) and My Little Pony (p.123) Expertise print no such prerequisite and stay unfiltered.

- Its `ChoiceSet` gets `minShift: "d4"`. The skill source already filtered on `minShift` / `maxShift`
  (`steps.mjs#filterSkills`); `types.mjs` now accepts both on a ChoiceSet.
- `lifecycle.mjs#choiceOptions`: with `allOptions` (label lookups, old-pick matching), the die filters are left off. A
  character already holding a pick below d4 keeps it, still sees its name and rename suffix, and an old `system.choice`
  pick below d4 still matches in the migration. Nothing is forced to change. A re-pick ("change") offers only d4+.
- `count`, `excludeCopies`, `rename`, `required` and `legacy` are unchanged and tested with the filter.

## Tests and checks

- New: `module/rules/pr-followups.test.js` (21 tests, one block per part).
- `node scripts/check-rules.mjs`: 4538 rules on 2502 items, 575 prerequisite lists, 0 errors, 0 warnings.
- `node scripts/check-pack-cross-references.mjs`: 5272 uuid references, all resolve.
- `node scripts/check-manifest-sync.mjs`: one problem, the stray `packs/gij_crb` LevelDB folder, which is not in
  system.json. It is untracked, already on disk, and not from this change.
- eslint on the touched JS (`--rule 'linebreak-style: off'`): clean.
- Full jest: 371 suites, 8582 tests, all passing.
