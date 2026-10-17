# Essence20 Prerequisites — Design Plan

Goal: the system knows what an item requires and says so. If a character doesn't qualify for a
Perk, or a weapon can't take an Upgrade, the system tells you when the item is added, and the
Compendium Browser can hide what you can't take. The GM always has the last word.

> **Status (2026-10-02):** Phases 1, 3 and 4 are built and staged, and live-tested in dev-v14.
> - **Phase 2:**
>   - 536 pack items have `system.prerequisites`: 396 read exactly, 72 GM-approval (`ask:`) and 68
>     approximate ones the user approved. The list is in `docs/PREREQUISITES_REVIEW.md`.
>   - `scripts/check-rules.mjs` validates them.
>   - Tag `self:hasType:<type>:<name>` tells an Influence from an Origin of the same name.
>
> - **Phase 1:**
>   - `module/rules/prerequisites.mjs`: the check, plain-word descriptions, the `prerequisiteMode` world
>     setting (off / warn / strict), the strict-mode refusal, and the GM notes on add, on attach and when
>     a prerequisite is later lost.
>   - The tags in `rules/predicate.mjs`.
>   - `system.prerequisites` on every item type.
> - **Phase 3:**
>   - On the Rules tab, a "Requires" block lists each prerequisite with ✓ / ✗ / ? against the owner.
>   - The Compendium Browser has a "Qualifies" picker.
>   - Choosers do not grey out options yet.
> - **Phase 4:** the pencil on the Requires block opens the guided editor's condition picker.
> - **Not built:** `self:max:` is covered by `self:data:...`; `self:canShapechange` is not built.

---

## 1. What exists today

- **The field.** `system.prerequisite` is a free-text string on Perks and Upgrades. It is shown on
  the sheet and checked nowhere.
- **The text in the packs:**

  | | Items |
  |---|---:|
  | With the field | 2,644 (2,212 Perks, 432 Upgrades) |
  | With text in it | 537 (355 Perks, 182 Upgrades) |
  | Different phrasings | 385 |

- **What the text asks about.** A rough sort of the 537; one item can fall in several kinds.

  | Kind | Items | Examples |
  |---|---:|---|
  | A Skill rank | ~140 | "Brawn d2", "Targeting d6", "Might, Finesse, or Targeting d6" |
  | The host item's trait or kind (Upgrades) | ~103 | "Computerized", "Grenade", "Ballistic", "Two-handed targeting weapon" |
  | Another item: Perk, Influence, Origin, Role, Focus | ~90 | "Favorite Command", "Mutant Beast Influence", "Insecticon or Monstrosity only" |
  | Vehicle or Alt Mode | ~41 | "Land vehicle", "Alt Mode with Crew 1 or more" |
  | An Essence score | ~32 | "Smarts Essence 4", "Social 3 or higher" |
  | Level | ~29 | "Level 12", "5th Level or higher", "Level 4 or lower" |
  | Size | ~16 | "Size Huge+", "Medium or Large" |
  | A resource maximum | ~14 | "maximum Personal Power 6 or higher" |
  | Armor | ~13 | "Medium or heavier armor" |
  | Training | ~10 | "Heavy Armor Training" |
  | Other | ~92 | "Ability to change shape", poison application types, "three or more permanent Cybernetic Alterations", "GM Approval", story events |

- **The two shapes.**
  - **Perks** ask about the **character**.
  - **Upgrades** ask about the **item they attach to** (its traits, kind, size, hands) and sometimes
    its owner.

---

## 2. Data

Prerequisites become structured data on the item, reusing the rules engine's condition language:

```json
"prerequisites": {
  "when": ["self:level>=5", {"any": ["self:skill:might>=d6", "self:skill:finesse>=d6"]}],
  "text": "5th Level or higher; Might or Finesse d6"
}
```

- **`when`** is the same tag list rules use (`rules/predicate.mjs`). Every tag must hold;
  `{"any": [...]}` means "or". There is no second language to learn, and the guided rule editor's
  condition picker edits it as it stands.
- **`text`** is the printed prerequisite, kept as written for display and for anything not yet
  machine-readable. It is the existing `system.prerequisite` field, which stays.
- **What can't be checked becomes `ask:` tags**, e.g. `ask:GM approval` or `ask:defeated the Joes at
  Red Quarry`. An `ask:` tag is never decided by the system; it becomes a tick-box in the check
  dialog (§4). That is the rules engine's "unknown means ask", reused.

### New condition tags this needs

| Tag | Meaning | Covers |
|---|---|---|
| `self:skill:<key>>=<die>` | Skill rank at least d2…d20 (also `<=`) | ~140 |
| `self:essence:<key>>=<n>` | Essence score | ~32 |
| `self:level>=N` / `self:level<=N` | already exists | ~29 |
| `self:size>=<size>` / `<=` | Size class, ordered | ~16 |
| `self:has:<name>` | Owns an item of that name, any printing; `self:hasItem:<uuid>` is the exact one | ~90 |
| `self:count:<type>>=N` | How many items of a type: Alterations, Contacts… | "three or more Alterations", "One or more Contacts" |
| `self:max:<path>>=N` | A resource maximum: Personal Power, Allegiance | ~14 |
| `self:trained:<armor or weapon class>` | Training | ~10 |
| `self:canTransform`, `self:canShapechange` | Alt Mode / shape-change ability | ~10 |
| `host:trait:<t>`, `host:type:<t>`, `host:style:<s>`, `host:damageType:<d>`, `host:hands:N`, `host:size>=<s>`, `host:class:<armor class>`, `host:vehicle:<land/sea/air>`, `host:crew>=N` | The item an Upgrade attaches to | ~140 Upgrades |

Most of these are a dozen lines each in `predicate.mjs`. The `host:` family evaluates against the
item being attached to, the same "host" the rules engine already resolves for Upgrades.

---

## 3. Converting the text that exists

A one-time parser turns the 385 phrasings into `when` lists. It writes them into the packs as text,
as the rules conversions do, and reports what it couldn't parse.

- **Estimate.** By the survey above, about 75–80% of the 537 parse mechanically: Skill ranks, Essence,
  Level, Size, named items, traits and vehicle kinds.
- **The rest get an `ask:` tag carrying their own text**, so nothing is lost and they're still
  enforced as a GM tick-box. These are things like "Ability to change shape", poison application
  types and story events.
- **A review list** in the Item Review shows every parsed prerequisite next to its text, for a
  human pass, line by line.
- **No rulebook text is added anywhere.** The parser only restructures the short prerequisite strings
  already in the packs.

---

## 4. Where it's checked

1. **Adding an item to a character** (sheet drop, Compendium Browser, Role or level-up choosers),
   and **attaching an Upgrade**:
   - Everything met: nothing happens.
   - Something unmet: a dialog lists what's missing in plain words (✗ Might d6, you have d4), and
     ticks for any `ask:` items.
   - The GM can always click "Add anyway". What a player can do depends on a world setting:

     | Setting | What happens for a player |
     |---|---|
     | Off | No checking |
     | Warn (default) | A player can add anyway; a chat note tells the GM |
     | Strict | Only the GM can add anyway |

2. **The item sheet** shows the prerequisites in plain words. On a character's copy, each line
   shows ✓ or ✗ against that character.
3. **The Compendium Browser** gets a "Qualifies: <character>" filter that hides what the chosen
   character can't take. Unchecked `ask:` items count as met for filtering.
4. **Choosers** (Role Perk picks, Influence and Origin choices, the Skill Picker's Perk lists)
   grey out options the character doesn't qualify for, with the reason on hover.

Nothing is ever removed automatically when a character later stops qualifying. That's a table
decision; the sheet just shows the ✗.

---

## 5. Editing

The item sheet's Details tab gets a "Prerequisites" row with the same condition picker as the
guided rule editor (`apps/rule-editor.mjs`), and the printed text beside it. Homebrew items get
prerequisites the same way book items do.

---

## 6. Phases

1. **Tags and the check.**
   - The new tags (§2), with tests.
   - `system.prerequisites` on Perks and Upgrades.
   - The check dialog on add and attach, and the world setting.
2. **The parser and review.** Convert the 537, put the unparsed list in the Item Review, then do the
   human pass.
3. **Display and filtering.** ✓/✗ on the sheet, the Compendium Browser filter, greyed-out chooser
   options.
4. **Editing.** The Details-tab picker.

Phase 1 alone makes every hand-entered prerequisite enforceable. Phase 2 does the bulk of the book.

---

## 7. Decisions (answered 2026-10-02)

1. **Strictness is a world setting**, with both modes available:
   - **Warn:** anyone can add the item, and the GM is told.
   - **Strict:** only the GM can override.
   Warn is the default.
2. **"GM Approval" prerequisites never block**, in either mode. Adding such an item always notifies
   the GM.
3. **Losing a prerequisite later** (a lost Perk, a lowered Skill) shows ✗ on the sheet and also
   posts a note to the GM.
