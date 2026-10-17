# Typed prerequisite text retired (2026-10-07)

Approved by the user 2026-10-07. An item's prerequisite used to live twice: the typed text
`system.prerequisite` (a string, edited on the Details tab) and the tags `system.prerequisites.when`
(edited on the Rules tab, checked by `rules/prerequisites.mjs`). 545 pack items had both and they agreed;
none had tags without text. The text is retired: everything shows the tags in words.

## What changed

- **`prerequisiteText(item)`** (`module/rules/prerequisites.mjs`): `describePrerequisite` over
  `system.prerequisites.when`, joined with "; ". It also takes a parent item's attachment entry (an
  Upgrade's `system.items` snapshot on its weapon or armor) and reads the attached item's tags live
  through the entry's `uuid`. Until 6.1, an item (or entry) with no tags falls back to its old typed
  text, for anything not migrated yet. Registered as the Handlebars helper `prerequisiteText`.
- **`describePrerequisite`** learned the tag forms the packs' prerequisites use that used to fall
  through as raw tags: `self:tag:<trait>` ("Robot trait"), `self:type:<type>` ("Is a Threat"),
  `self:data:system.traits.<trait>` ("Land trait"), `self:data:system.qualified.<path>`,
  `self:data:<path><op><value>` ("Maximum Personal Power 4+", "Aerial Movement 50+") and a bare
  `self:data:<path>`.
- **Typed input removed** from the item sheet Details tabs: `templates/item/details/perk.hbs`,
  `power.hbs`, `upgrade.hbs`. The Zord / Megaform actor header inputs (`templates/actor/headers/zord.hbs`,
  `megaform.hbs`) are the actor's own field and are untouched.
- **Schema fields kept** in `module/data/item/perk.mjs`, `power.mjs`, `upgrade.mjs`, marked
  `// Deprecated 2026-10-07: shown from system.prerequisites now; remove from the data model in 6.1.`
- **Strings:** no lang key became unused. `E20.PerkPrerequisite` still labels the Perk and Power chips,
  `E20.UpgradePrerequisite` the Upgrade line, `E20.ZordPrerequisite` the Zord header.

## Readers switched

| Reader | Was | Now |
|---|---|---|
| Actor sheet Perk chip (`templates/actor/parts/items/perk/details.hbs`) | `item.system.prerequisite` | `prerequisiteText item` |
| Actor sheet Power chip (`templates/actor/parts/items/power/details.hbs`) | `item.system.prerequisite` | `prerequisiteText item` |
| Actor sheet Upgrade line, on the Upgrade and on its attachment entry under a weapon / armor (`templates/actor/parts/items/upgrade/details.hbs`, 6 places) | `item.system.prerequisite` / entry `item.prerequisite`, unescaped | `prerequisiteText item` (escaped) |
| Perk chat card (`module/documents/item.mjs`, "Prerequisite: ...") | `this.system.prerequisite` | `prerequisiteText(this)` |
| Item sheet Rules tab summary (`module/rules/sheet.mjs`) | the typed text beside the tag lines | the tag lines; the text only for an item with no tags (unmigrated) |
| `item:mentions` tag (`rules/plugins/picks/flagged-companion-and-mentions.mjs`) | name + typed text | name + `prerequisiteText` (tags in words, old text as the no-tags fallback) |
| Pack rules' pickGrant index `fields` (Rally Guardians Features, Special Program x2) | `"system.prerequisite"` | `"system.prerequisites"` |

**Attachment entries.** `module/sheet-handlers/attachment-handler.mjs` (armor and weapon Upgrade
branches) and the legacy `upgradeIds` migration in `module/migration.mjs` still copy `prerequisite` into
the parent's `system.items` entry. The only reader was the Upgrade line above, which now reads the
attached item's tags through the entry's uuid, and the copy only as a fallback when there are none (an
attached item that no longer resolves, say). The copies are left, marked deprecated, and go with the field in 6.1.
The 100 such entry copies inside pack items are left as they are, for the same reason.

## World migration

`migratePrerequisiteText(item)` in `module/migration.mjs`, run from `migrateItemData`, so it covers
world items, actor-embedded items and compendium documents:

- non-empty `system.prerequisite` text and no `system.prerequisites.when` tags: the text (whitespace
  collapsed, trimmed, cut at a word with an ellipsis past `PREREQUISITE_ASK_MAX` = 200 characters)
  becomes one `ask:<text>` tag. An `ask:` tag never blocks; the GM is always told.
- then, in every case, the text goes back to the schema default (`null`: `makeStr(null)`) through
  `unset`/`RESET_TO`, never a ForcedDeletion (v14 rejects deleting a field the data model still has).
- value-matched: it fires only while the text is a non-empty string, so a re-run does nothing. An item
  that already has tags is never given another.
- copies of Welcome to Night Vale's Acute Senses (`Compendium.essence20.wtnv_citizens_guide.Item.ygxNBnUhFIfqg349`)
  get no tag: that item's text was a note about its choice, not a prerequisite.

Tests: `module/migration.test.js` ("typed prerequisite text retired"): ask tag + reset, tags kept,
non-nullable schema default, Acute Senses, empty / null / missing / whitespace, the length cut, and
`migrateItemData` on a world and an embedded item with a re-run that does nothing.

## Packs

- `system.prerequisite` emptied (`""`) on all 546 pack items that had text (354 Perks with tags + 1
  without, 9 Powers, 182 Upgrades), one line per file, each file's CRLF and formatting kept.
- Acute Senses (wtnvcgitems): its text was a note about its choice; it is just removed (no tag).
- `module/rules/prereq-text-retired.test.js` checks that no pack item carries non-empty
  `system.prerequisite` and no pack rule asks the index for it.

## Parity (`item:mentions`)

Only one pattern is used in the packs: `combiner|mega weapon` (Rally Guardians Features, which bans
Combiner, Zord Mega-Weapon System and anything needing Combiner from the Guardians' Feature pick).
Before removing the text, old (name + typed text) and new (name + tags in words) were compared over
every top-level pack document (6,364): **0 differences**. Both match the same 9 items, all by name.
The old answers are recorded in `module/rules/prereq-text-retired.test.js` (`OLD_ANSWERS`), which
re-checks the new reader against them over every pack item, and fails if a pack rule starts using a
pattern without recorded answers. No rule pattern needed changing.

## Checks

- eslint on touched files: clean.
- `node scripts/check-rules.mjs`: 4276 rules on 2381 items, 545 prerequisite lists, 0 errors, 0 warnings.
- Full jest: 363 suites, 8560 tests, all passing.

## 6.1 removal

- Drop `prerequisite` from `module/data/item/perk.mjs`, `power.mjs`, `upgrade.mjs`.
- Drop the `prerequisite` copies in `attachment-handler.mjs#createEntry` and the legacy `upgradeIds`
  entry migration, and the `RESET_TO['system.prerequisite']` reset (the field deletion then goes
  through ForcedDeletion, or is not needed).
- Drop the old-text fallback in `prerequisiteText` (and with it the Rules tab `prerequisites.text`).
- Drop the `system.prerequisite` keys from the pack JSON (the values are already empty).
