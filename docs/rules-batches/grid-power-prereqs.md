# Grid Power prerequisites

Every Grid Power the level-up picker offers (items of type `power`, `system.type` `grid`: 68 across five Power Rangers books), read in its own book. Where the book gives a prerequisite it is now on the item: checkable tags in `system.prerequisites.when` (rules/prerequisites.mjs, the rules predicate language), what the system cannot check as an `ask:` tag, and a short paraphrase in `system.prerequisite` (the display text; new on the Power data model, shown on the item sheet's Details tab and on the actor sheet's power chips). Paraphrases only, no book text.

Page numbers are the printed ones (the packs' `system.source.page`). Each section's intro was checked for a section-wide restriction; none of the five restricts its Grid Powers to a team, Ranger or Zord. Only a printed prerequisite (or Prior Experience's "only if your backstory..." line) counts; a condition on using a power once taken (Time Strike needs Chrono Sabers) is not a prerequisite.

## Power Rangers Core Rulebook (prcrbitems, pp.99-101)

| Grid Power | Book p. | Prerequisite (paraphrase) | Encoded as |
|---|---|---|---|
| Augment Power Weapon | 99 | None | - |
| Boost Initiative | 99 | None | - |
| Environmentally Sealed | 99 | None | - |
| Faster Regeneration | 100 | None | - |
| Harden Armor | 100 | None | - |
| Illuminate | 100 | None | - |
| Machine Merge | 100 | None | - |
| Mnemonic Recall | 100 | None | - |
| Penetrating Strikes | 100 | None | - |
| Power Blast | 100 | None | - |
| Power Heal | 100 | None | - |
| Power Quake | 100 | None | - |
| Power Shield | 100 | None | - |
| Power Strike | 100 | None | - |
| Power Transfer | 101 | None | - |
| Relentless Blows | 101 | None | - |
| Repair Zord | 101 | None | - |
| Sharkcycle Rider | 101 | None | - |
| Speed Boost | 101 | None | - |
| Super Leap | 101 | None | - |
| Translation Grid | 101 | None | - |
| Unseen Hand | 101 | None | - |

## A Jump Through Time (jttitems, pp.57-58) - section open to all Power Rangers characters

| Grid Power | Book p. | Prerequisite (paraphrase) | Encoded as |
|---|---|---|---|
| Brazen Strike | 57 | None | - |
| Charge It Up! | 57 | None | - |
| Chrono-File Access | 57 | None (Time Force flavour text only) | - |
| Cryogenic Touch | 57 | None | - |
| Fortified Shell | 57 | None | - |
| Future Vision | 57 | None | - |
| Gremlins' Mischief | 57 | None | - |
| Guardian Strikes | 57 | None | - |
| Megazord Link | 58 | None | - |
| Morphblast | 58 | None | - |
| Rapid Morph | 58 | None | - |
| Rev Your Engines | 58 | None | - |
| Stylish Strike | 58 | None | - |
| Time Jet | 58 | None | - |
| Time Strike | 58 | None (needs Chrono Sabers to use, not to take) | - |
| Vector/Strata Cycle | 58 | None | - |
| Willful Strength | 58 | None | - |

## Across the Stars (atsitems, pp.72-73) - section open to all Power Rangers characters

| Grid Power | Book p. | Prerequisite (paraphrase) | Encoded as |
|---|---|---|---|
| Astro-Sense | 72 | None | - |
| Blazing Strikes | 72 | None | - |
| Civilian Superpower | 72 | None (superpower picked with the GM when taken) | - |
| Elemental Adaptation | 72 | None | - |
| Faster Recharge | 72 | None | - |
| Galaxy Glider | 72 | None | - |
| Jet Jammer | 73 | None | - |
| Morph Modulation | 73 | None | - |
| Power Battery | 73 | None | - |
| Prismatic Boon | 73 | None (limits the Role Perk chosen, not who takes it) | - |
| Rescue Response | 73 | None | - |
| Temporal Awareness | 73 | None | - |
| Void Warrior | 73 | None | - |
| Zeo Crystal Boost | 73 | None (Zeo Rangers get it free as a team perk, TSG p.27; open to all here) | - |

## Beneath the Helmet (bthitems, pp.56-57) - open to all, though some carry prerequisites

| Grid Power | Book p. | Prerequisite (paraphrase) | Encoded as |
|---|---|---|---|
| Dimensional Attunement | 56 | None | - |
| Dino Charged | 56 | An Energem and Dino Charged gear | `self:has:Energem`, `{any: [self:has:Dino Charger, self:has:Dino Charge Morpher, ask:Other Dino Charged gear]}` |
| Dino Raptor | 56 | A dinosaur-themed Ranger team | `ask:On a dinosaur-themed Ranger team` |
| Dino Thunder Boost | 56 | Dino Thunder Form | `self:hasType:perk:Dino Thunder (Form)` |
| Extra Dino Thunder Form Power | 57 | Dino Thunder Form; GM permission (the extra power must fit the first) | `self:hasType:perk:Dino Thunder (Form)`, `ask:GM permission, and a power related to your Dino Thunder Form power` |
| Grid Tap | 57 | Able to use Grid Science or Grid Tech | `{any: [self:has:Grid Tech I, self:has:Grid Science I]}` (both are Level 2 Role Perks of the Roles that have them) |
| Longevity | 57 | None (the sidebar only advises a long-lived backstory) | - |
| Prior Experience | 57 | A past as a Ranger on a different team (backstory) | `ask:Backstory: was a Power Ranger before, on a different team` |
| White Ranger Extra Dino Thunder | 57 | White Ranger only; Dino Thunder Form | `self:hasType:role:White Ranger`, `self:hasType:perk:Dino Thunder (Form)` |

## Through the Shattered Grid (ttsgitems, pp.26, 74, 115) - open to all who meet any prerequisites

| Grid Power | Book p. | Prerequisite (paraphrase) | Encoded as |
|---|---|---|---|
| Metallic Armor Power Up | 26 | Level 6+; Personal Power maximum 4+ | `self:level>=6`, `self:data:system.powers.personal.max>=4` |
| Mobile Mode | 26 | None | - |
| Power Efficiency | 26 | Level 8+ | `self:level>=8` |
| Grid Empowered | 74 | None | - |
| Shattered Memories | 115 | None | - |
| Zephyr Grace | 115 | None | - |

## Counts

- Grid Powers read: 68
- No prerequisite: 59
- Fully checkable: 5 (Dino Thunder Boost, Grid Tap, White Ranger Extra Dino Thunder, Metallic Armor Power Up, Power Efficiency)
- Checkable part plus an `ask:`: 2 (Dino Charged, Extra Dino Thunder Form Power)
- `ask:` only: 2 (Dino Raptor, Prior Experience)
- In short: none 59 / checkable 7 (2 of them with an ask as well) / ask-only 2.

## The picker

The level-up picker (mechanics/characters/level-picks.mjs) already treats Grid Powers as it does General Perks: `levelPickChoices` reads `system.prerequisites` into the compendium index, and the ChoicesSelector checks each option through `rules/prerequisites.mjs#choicePrerequisites`. An unmet one is marked with what is missing, and blocked for a player in strict mode (the GM can still pick it). An `ask:`-only prerequisite is not marked in the picker; the GM gets the usual chat note when the item is added. Covered by "Grid Power prerequisites in the picker" in level-picks.test.js.
