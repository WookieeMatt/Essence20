# Role level check: General Perk and Grid Power levels

Every `type: "role"` item in `packs/*/_source` was checked against its own Role level table in its own book.
The book's level table is the source of truth; where the table and the prose disagree, the table wins.

- "General" means `system.perkLevels.general`.
- "Grid" means `system.gridPowerLevels`. It is checked only for Power Rangers Roles, because the level-up picker only offers Grid Powers for Power Rangers. Other Roles carry the template default 6,11,16, which is left alone.
- How the tables were read: positional pdf.js row readers. One handles ordinal "1st..20th" tables. The other handles the plain-number tables in the MLP, Through the Shattered Grid and Night Vale books. Split cells, such as Purple Ranger's and Path of Venom's two-line rows, were read by hand.

## Changed

| Role | book (page) | book General levels | Grid levels | pack before | result |
|---|---|---|---|---|---|
| Commando (gijcrbitems) | GI JOE Core Rulebook, Table 5-2 (PDF p.71) | 4, 8, 11, 15, 19 | n/a | 4, 8, 12, 16, 19 | **FIXED** to 4, 8, 11, 15, 19 |
| Officer (gijcrbitems) | GI JOE Core Rulebook, Table 5-13 (PDF p.85) | 4, 12, 16, 19 (8th is Essence Improvement) | n/a | 4, 8, 12, 16, 19 | **FIXED** to 4, 12, 16, 19 |

## Verified, no change

| Role | book (page) | book General levels | Grid levels | pack before | result |
|---|---|---|---|---|---|
| Infantry (gijcrbitems) | GI JOE CRB, Table 5-6 (p.79) | 4, 6, 8, 12, 14, 16, 19 | n/a | 4, 6, 8, 12, 14, 16, 19 (already staged) | OK |
| Ranger (gijcrbitems) | GI JOE CRB, Table 5-17 (p.90) | 4, 8, 12, 16, 19 | n/a | 4, 8, 12, 16, 19 | OK |
| Renegade (gijcrbitems) | GI JOE CRB, Table 5-21 (p.96) | 4, 8, 12, 16, 19 | n/a | 4, 8, 12, 16, 19 | OK |
| Technician (gijcrbitems) | GI JOE CRB, Table 5-24 (p.102) | 4, 8, 12, 16, 19 | n/a | 4, 8, 12, 16, 19 | OK |
| Vanguard (gijcrbitems) | GI JOE CRB, Table 5-28 (p.108) | 4, 8, 12, 16, 19 | n/a | 4, 8, 12, 16, 19 | OK |
| Old Hand (ghpfitems) | Hawk's Personnel Files, Table 5-1 (p.166) | Old Hand Role levels 4, 8, 11, 15 (effective character levels 8, 12, 15, 19) | n/a | 4, 8, 11, 15 | OK. The pack stores the Old Hand's own track, which is what level-picks.mjs expects for an additive Role. |
| Envoy (fgtaaitems) | Field Guide to Action and Adventure, Table 3-8 (p.67) | 4, 8, 11, 15, 19 | n/a | 4, 8, 11, 15, 19 | OK |
| Black Ranger (prcrbitems) | PR CRB, Table 4-2 (p.33; 2nd printing p.34) | 4, 8, 12, 16, 19 | 6, 11, 16 | 4, 8, 12, 16, 19 / 6, 11, 16 | OK |
| Blue Ranger (prcrbitems) | PR CRB, Table 4-3 (p.38 / 39) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK |
| Green Ranger (prcrbitems) | PR CRB, Table "4-3" (p.44 / 45) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK |
| Pink Ranger (prcrbitems) | PR CRB, Table 4-5 (p.48 / 49) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK |
| Red Ranger (prcrbitems) | PR CRB, Table 4-6 (p.52 / 53) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK |
| Yellow Ranger (prcrbitems) | PR CRB, Table 4-7 (p.56 / 57) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK |
| White Ranger (prcrbitems) | PR CRB, Table 4-9 (p.61 / 62) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK |
| Gold Ranger (atsitems) | Across the Stars, Table 2-11 (p.53) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK |
| Silver Ranger (atsitems) | Across the Stars, Table 2-12 (p.57); reprinted in Beneath the Helmet, Table 2-12 (p.46) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK |
| Phantom Ranger (atsitems) | Across the Stars, Table 2-14 (p.61) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK |
| Dark Ranger (bthitems) | Beneath the Helmet, Table 2-5 (p.40) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK |
| Aqua Ranger (bthitems) | Beneath the Helmet p.43-44: a Role shift on the Blue Ranger table (PR CRB 4-3) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK. None of its replacement features (Grid Science, Elemental Shield, Elemental Storm) replaces a General Perk or Grid Power row. |
| Graphite Ranger (bthitems) | Beneath the Helmet p.48-50: a Role shift on the Silver Ranger table (BtH 2-12) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK. Its replacements (Fight Me!, Brute Force, Duty of the Graphite, Prime) don't touch General Perk or Grid Power rows. |
| Orange Ranger (jttitems) | A Jump Through Time, Table 2-12 (p.33) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK |
| Purple Ranger (jttitems) | A Jump Through Time, Table 2-13 (p.38) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK. The 12th-level cell is split over two lines ("Extra Attack (2), / General Perk"), and the first-pass parse missed it. |
| Quantum Ranger (jttitems) | A Jump Through Time, Table 2-15 (p.44) | 8, 12, 16, 19 | 6, 11, 16 | 8, 12, 16, 19 / 6, 11, 16 | OK |
| The Magna Defender (ttsgitems) | Through the Shattered Grid, Table 2-4 (p.25) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK |
| Guardian of Eltar (ttsgitems) | Through the Shattered Grid, Table 3-2 (p.73, plain-number layout) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK |
| Path of Cruelty (fmmcitems) | Finster's Cookbook, Table 5-2 (p.285) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK |
| Path of Flame (fmmcitems) | Finster's Cookbook, Table 5-3 (p.288) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK |
| Path of Frost (fmmcitems) | Finster's Cookbook, Table 5-4 (p.292) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK |
| Path of Stone (fmmcitems) | Finster's Cookbook, Table 5-5 (p.296) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK |
| Path of Thorns (fmmcitems) | Finster's Cookbook, Table 5-6 (p.299) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK |
| Path of Venom (fmmcitems) | Finster's Cookbook, Table 5-7 (p.303) | 4, 8, 12, 16, 19 | 6, 11, 16 | same | OK. The 8th-level cell wraps across two lines ("General / Perk, Zordbane"). |
| Spirit of Generosity (mlpcrbitems) | MLP CRB (p.75) | 4, 8, 12, 16, 19 | n/a | 4, 8, 12, 16, 19 | OK |
| Spirit of Honesty (mlpcrbitems) | MLP CRB (p.79) | 4, 8, 12, 16, 19 | n/a | same | OK |
| Spirit of Kindness (mlpcrbitems) | MLP CRB (p.83) | 4, 8, 12, 16, 19 | n/a | same | OK |
| Spirit of Laughter (mlpcrbitems) | MLP CRB (p.87) | 4, 8, 12, 16, 19 | n/a | same | OK |
| Spirit of Loyalty (mlpcrbitems) | MLP CRB (p.91) | 4, 8, 12, 16, 19 | n/a | same | OK |
| Spirit of Magic (mlpcrbitems) | MLP CRB (p.95) | 4, 8, 12, 16, 19 | n/a | same | OK |
| Farmer, Journalist, Politician, Scientist, Soldier (wtnvcgitems) | Night Vale Citizens' Guide, Table 2-9: Level Up Benefits (p.56), which is shared by all Roles; Night Vale has no per-Role level tables | 2, 3, 5, then every level 6-20 | n/a | 2, 3, 5, 6, 7, ..., 20 | OK (see the notes) |
| Raider (dditems) | Decepticon Directive | 4, 8, 11, 15, 19 | n/a | same | OK (confirmed earlier) |
| Analyst, Gunner, Modemaster, Scientist, Scout, Warrior (tfcrbitems) | Transformers CRB | 4, 8, 11, 15, 19 | n/a | same | OK (confirmed earlier) |
| Field Commander (tfcrbitems) | Transformers CRB | 4, 8, 11, 16, 19 | n/a | same | OK (confirmed earlier) |

## Notes and ambiguities (pack values left as they are)

- **Officer:** the 8th-level row of the table gives Essence Improvement in place of a General Perk, and no prose contradicts it, so 8 is dropped.
- **Commando:** the table runs 4, 8, 11, 15, 19, the Transformers-style cadence, not the 4/8/12/16/19 used by the other GI JOE Roles. The table wins.
- **Night Vale:** Table 2-9 gives General Perks at 2, 3 and 5. The text right below it says a General Perk comes at every level after 5. The table doesn't list one at level 1. Character creation (Step 3, p.11) grants one starting General Perk, but that's a creation step, not a level-up pick, so `level1` was not added. Separately, the p.56 bullet "Gain a new Perk, either a Role Perk or a General Perk" is vague prose, and the table wins over it.
- **Old Hand:** the Hawk's table has two level columns. The pack stores the Old Hand Role-level track (4, 8, 11, 15), not the effective character levels (8, 12, 15, 19). That matches the additive-Role handling in level-picks.mjs.
- **Grid Powers:** every Power Rangers Role and Path is 6, 11, 16, and every pack value matches. Non-PR Roles were not touched.

## Checks

- `node scripts/check-rules.mjs`: 0 errors, 0 warnings.
- Jest (`--experimental-vm-modules`): `module/mechanics/characters/level-picks.test.js` and `module/tours/demo-content.test.js` (the only tests that mention perkLevels) both pass, 74 tests.
- Staged: `packs/gijcrbitems/_source/Commando_M2ZYoyByNLkHtLzw.json` and `packs/gijcrbitems/_source/Officer_VBEsSU8jqBpoGueE.json`.
