# Role level picks: General Perks and Grid Powers (2026-10-07)

User ruling (2026-10-07): a Role's `perkLevels.general` and `gridPowerLevels` are the levels at which the
character gains a General Perk or a Grid Power, so reaching one should ask the player to **pick** one. This
closes two of the three UNSURE rows in `details-audit.md`. The third, Origin `languages`, is answered below.

Page numbers are PDF pages ("PDF p."), with the printed page in brackets where it differs.

## What the books say (paraphrased)

### General Perk
In every line it is a Role Perk on the Role's level table that says: at these levels, choose a General Perk
whose prerequisites you meet.

| Line / book | Where | Levels | Pack data |
|---|---|---|---|
| Power Rangers CRB (2nd printing) | every Spectrum Role, e.g. Red PDF p.36 [34], also p.43, 47, 50, 54, 65 | 4, 8, 12, 16, 19 | matches |
| Across the Stars, Beneath the Helmet, Through the Shattered Grid, Finster's | every Role (ATS PDF p.55/59/62, BTH p.42/47, TTSG p.26/74, Finster's p.285-301) | 4, 8, 12, 16, 19 | matches |
| A Jump Through Time | Orange / Purple PDF p.35/40; Quantum Ranger PDF p.47 | 4, 8, 12, 16, 19; Quantum: 8, 12, 16, 19 (it can't be taken before the 4th-level one, PDF p.45) | matches |
| G.I. JOE CRB | most Roles, e.g. Commando PDF p.74 [73], PDF p.86 | 4, 8, 12, 16, 19 | matches |
| G.I. JOE CRB, **Infantry** | PDF p.81 [80]; PDF p.80 ties Fighting Style changes to the same levels | 4, **6**, 8, 12, **14**, 16, 19 | **was 4, 8, 12, 16, 19 - fixed** (the Role has no Role or Focus Perk at 6 or 14) |
| Hawk's Personnel Files, Old Hand | Advanced Role table PDF p.166; PDF p.167: once Old Hand, you stop getting the base Role's Focus Perks and General Perks | Old Hand levels 4, 8, 11, 15 | matches |
| Field Guide to Action and Adventure, Envoy | table PDF p.67, text PDF p.68 | 4, 8, 11, 15, 19 | matches |
| Transformers CRB (2nd printing) | Analyst table PDF p.59 [57]; the Role text (PDF p.61, 66, 70, 76) says 4, 8, 12, 16, 19 | table: 4, 8, 11, 15, 19 (Field Commander 4, 8, 11, 16, 19) | matches the **tables**; the prose disagrees with its own table - left as the tables, worth a ruling |
| Decepticon Directive, Raider | PDF p.63 text says 4, 8, 12, 16, 19 | pack 4, 8, 11, 15, 19 | same table-vs-prose question as the TF CRB |
| My Little Pony CRB | every Spirit, e.g. PDF p.76/80/84 | 4, 8, 12, 16, 19 | matches |
| Night Vale Citizen's Guide | Table 2-9 PDF p.56 [54], text PDF p.49 [47] | 2, 3, 5, then every level 6-20 | matches. The 1st-level General Perk is part of character creation (Step 3), not the Role table, so it is not a level pick |

Not handled here (not Role-table picks): Origin perks that give a General Perk at 1st level (MLP Earth Pony
"Grounded", G.I. JOE Civilian "Well-Rounded"), and Perks such as Extra Grid Power or Nobody Like Me.

Field Guide PDF p.32-33: General Perks are mostly usable in any setting. The picker therefore also offers
books that belong to no game line (Field Guide), when the GM has them switched on.

### Grid Power
Power Rangers only. A Role Perk at 6, 11 and 16 in every Power Rangers Role checked (PR CRB PDF p.36 and the
supplements above, Finster's Psycho Paths included). PR CRB PDF p.101 [99], the Grid Powers section: Grid
Powers come from levels in a Spectrum Role, work right away, and each can be taken once unless it says
otherwise. Field Guide PDF p.42 lets a Role adapted to Power Rangers gain one at 6, 10 and 17 - a crossover
option, not handled (gridPowerLevels is only read for a Power Rangers Role).

### Origin `languages` - keep
Origins do grant languages in three lines: Power Rangers CRB (each Origin's Languages line, PDF p.24-26
[22-24]: your native language plus more per point(s) of Smarts or Social), G.I. JOE CRB (PDF p.58 [57]
Languages, and each Origin, e.g. PDF p.60 [59]) and Transformers CRB (PDF p.48 [46]: Cybertronian plus an
Adopted Earth language; each Origin PDF p.50-53 [48-51] adds more per Social or Smarts). My Little Pony
(PDF p.108: one shared language) and Night Vale (PDF p.15: count from Smarts) don't put them on Origins.
So the field stays, the Origin sheet input stays, and no migration was written. The packs still leave it empty
(filling it in is content work, not done here). A comment on the schema field records this.

## Design

New file `module/mechanics/characters/level-picks.mjs`.

- **When.** `role-handler.mjs#onLevelChange` (the sheet's level field and arrows) calls
  `updateLevelPicks(actor, previousLevel, newLevel)` after the Role and Focus work. `setRoleValues` calls it on
  a base-Role drop (0 to the character's level), so a Role dropped onto a 9th-level character asks for the 4th
  and 8th-level picks. Both run only on the client that made the change, so there is one run per change.
- **Level crossing** (`crossedLevels`, pure): going up gains every listed level L with previous < L <= new;
  going down loses every L with new < L <= previous. Multi-level jumps cross every level between.
- **Tracks.** Each pick has a key `kind-track-level` (`generalPerk-base-4`, `gridPower-base-6`,
  `generalPerk-additive-4`). Under an additive Role (Old Hand) the base Role only counts levels below the
  transition (Hawk's PDF p.167), and the additive Role's list runs on its own level (character level -
  transition + 1, the same arithmetic `onLevelChange` uses).
- **Pending.** `flags.essence20.levelPicks` is an array of `{key, kind, track, level}`. `nextPending` adds the
  gained keys (never twice, and never one an item was already chosen for) and drops the lost ones.
- **Level down / Role delete.** A lost level's pending pick goes, and so does the item chosen for it
  (`flags.essence20.levelPick.key`), through `onPerkDelete` for a Perk - the way a level down already removes
  Role Perks. Without this a 4 > 3 > 4 cycle would hand out a second General Perk. Deleting a Role
  (`onRoleDelete`) clears its track the same way.
- **The picker** reuses `apps/choices-selector.mjs`, which already has the search box, the game-line filter,
  the item info link, and the prerequisite marking (`rules/prerequisites.mjs#choicePrerequisites`: unmet
  options are marked with what's missing, and are disabled for a player in strict mode). The one change is a
  generic `choose` action that calls the opener's `_onChoose`.
- **Eligible items** (`eligibleLevelPickEntries`, pure): General Perks (`perk`, `system.type` general) or Grid
  Powers (`power`, `system.type` grid), from the packs the Compendium Browser shows (GM-enabled), in the Role's
  game-line folder (`E20.gameLinePackFolders`) plus books in no folder. An item already held is left out unless
  its `system.selectionLimit` allows another copy. Held means the same compendium source, or the same name
  (a reprint in another book).
- **The pick** runs the sheet's own drop handler, `sheet-handlers/drop-handler.mjs#onDropItem`, with the same
  create `ActorSheetV2#_onDropItem` makes (`game.items.fromCompendium`). So a Perk's own choice dialog, a Power's
  selection limit, and the strict-mode GM "add anyway?" check all run as they do for a drop. A one-shot
  `createItem` hook (this user, this actor, this source) tags the new item with `flags.essence20.levelPick` and
  only then clears the pending pick. That means a Perk whose own sub-choice is cancelled, or a strict-mode
  refusal, leaves the pick pending. Each pick made opens the next pending one, so a 1 > 20 jump walks through
  all eight.
- **Cancel and reopen.** Closing the picker leaves the pick pending. The character sheet header shows a star
  button with the count next to the level arrows (when the sheet is unlocked); its tooltip lists the picks.
  The button opens a dialog with one button per pending pick, plus "Mark all as done" for characters whose
  perks were added by hand before this existed.
- **Two clients.** The pick re-reads the pending list before it creates anything and refuses a pick that's
  already gone. Two people choosing in the same instant could still both add an item; the key check keeps the
  pending list itself free of duplicates.
- **Role sheet.** Both fields were already shown and editable on the Role's Details tab ("General Perks" for
  every line, "Grid Power Levels" for Power Rangers, through the level trait selector). No change needed.

## Files

- `module/mechanics/characters/level-picks.mjs` (new), `level-picks.test.js` (new, 24 tests: level crossing,
  tracks, pending idempotence, eligibility, level down, Role delete)
- `module/sheet-handlers/role-handler.mjs`: `setRoleValues` (drop), `onLevelChange`, `onRoleDelete` hooks
- `module/apps/choices-selector.mjs`: generic `choose` action
- `module/sheets/character-sheet.mjs` + `templates/actor/headers/character.hbs`: pending-picks button
- `module/data/item/origin.mjs`: comment on `languages`
- `lang/en.json`: `E20.LevelPick*`
- `packs/gijcrbitems/_source/Infantry_SvByuJ6hUITwR5Q7.json`: General Perk levels 4, 6, 8, 12, 14, 16, 19
  (needs a pack rebuild)

## Live-test

1. Rebuild packs (Infantry), reload.
2. PR character, Red Ranger, level 3 > 4: General Perk picker opens over the level-up card ("a choice is
   still waiting"). Only Power Rangers books plus folder-less ones; the game-line filter is present. Perks
   already held are missing; unmet prerequisites are marked (and greyed for a player in strict mode).
3. Pick a Perk that has a choice of its own: its dialog follows. Cancel it, and the
   header star should still show 1. Pick a plain one, and the star should go and the Perk carry
   `flags.essence20.levelPick`.
4. 5 > 6: a Grid Power picker. A GI Joe / MLP / TF character at 6 gets no Grid Power picker.
5. Type 20 at level 1: pickers open one after another (General 4/8/12/16/19, Grid 6/11/16). Close one
   midway, and the star should show the rest.
6. Level 6 > 3: the Grid Power and General Perk chosen for 4 and 6 are removed; back up to 6 offers them again.
7. Drop a Role on a level-9 character: 4th and 8th-level General Perk picks (and the 6th Grid Power for PR).
8. Old Hand at character level 6: base General Perks stop; Old Hand level 4 (character level 9) asks.
9. Delete the Role: the picks for it go. "Mark all as done" empties the list.
10. A player and the GM with the sheet open: one picks, and the other's later pick says it's already made.
11. GI Joe Infantry 5 > 6 (after the rebuild): a General Perk pick.
