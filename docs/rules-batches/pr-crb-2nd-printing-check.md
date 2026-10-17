# PR CRB: 2nd-printing check (2026-10-07)

Source of truth: *Power Rangers Core Rulebook (2nd Printing)* (PDF + its .docx). The 1st printing was used
only to diff the two printings and find leftovers. Pages are printed page numbers (2nd printing PDF index =
printed + 2; both printings keep the same printed pagination).

Scope: every document in `packs/prcrbitems/_source` (576 files: 491 items + 85 folders) and
`packs/prcrbeffects/_source` (5 effects). system.json has no other PR CRB pack: there is no PR CRB actor pack, so
the book's vehicles, example Zords/Megaforms and Threats are out of scope (listed below).

Method: a word-level diff of the two printings, page by page (normalised for the 1st printing's dropped "s"
glyphs and hyphenation), plus a direct comparison of every pack category against the 2nd printing: weapon
tables 8-3.1 to 8-3.3, armor 8-5, upgrades 8-4.1 to 8-4.3, gear, Origins, Influences and Hang-Ups, all seven
Role tables (perks by level, Essence increases, Power capacity, role points, skill die), role perks,
General Perks, Grid Powers, Zord Features and Megaform Traits. A page check matched each item's name against
its cited page.

Most of the pack already carried 2nd-printing values: Role tables, Prime perks, Grid Tech wording, Blast
Attack, Light Chassis, Megaform Traits, Origin perks, Influences, Unarmed Combat. The changes below are what
was left.

## Changes

| Item | Field | 1st printing / pack value | 2nd printing value (p.) | Action |
|---|---|---|---|---|
| Turbo Blade (+ its 2 effects) | effect `classification.skill` | Might (1st: "Melee energy", no skill) | Finesse (p.108) | fixed, weapon cache and notes too |
| Close Combat Heavy Blade | `traits` | Sharp, Silent | Sharp, Silent, Versatile (p.113) | added `versatile` |
| Anti-Sonic Foam Gun | `traits` | Stun (1st: Paralyzing) | none listed (p.113) | cleared |
| Thunder Slinger Alternate Effect 1 (`qf9N60YZPMIxa1l5`) | effect | Energy 1, the 1st printing's separate "Thunder Attack" | the base Stun 1 also does Sonic 1 to Putty Threats; the only alternate is the Energy 1 blast (p.111) | repurposed (same `_id`): renamed "Thunder Slinger Effect (Sonic vs Putty)", Sonic, projectile; weapon cache and notes updated |
| Zeo Power Tonfas Alternate Effect (Maneuver) | `numHands` | 1 | 2 (weapon is 2 hands, p.111) | fixed, weapon cache too |
| Star Slinger Effect, Alternate Effect 1 | `classification.style` | energy | projectile (Targeting medium projectile, p.110) | fixed, weapon cache too (Booster Mode left energy) |
| Long Blade, Medium Blade (+ 3 effects each) | skill | Finesse only (1st printing) | Finesse or Might, requirement Finesse or Might d6 / d4 (p.113) | effects got the same best-of SkillSubstitution rules as Unarmed Combat; `requirements.custom` "or Might"; notes |
| Power Axe Alt, Power Sword Alt 2, Power Daggers Alt 2 (Energy Attack), Lunar Lance Alt 2 (Double Slash), Spiral Saber Alt 2 (Booster Mode) | `system.rules` | no limit | 1x/Encounter (pp.109, 111) | added the once-per-encounter BeforeRoll/markWindow pair used by Turbo Lightning Sword, plus notes |
| Folder "Turbo Thunder Canon" (`rKbv2VhncPgS7qdI`) | name | Turbo Thunder Canon (1st spelling) | Turbo Thunder Cannon (p.110) | renamed |
| Zord Melee Attack, Zord Ranged Attack | `source.page` | 136 | 134 (Baseline Zord Statistics) | fixed |
| Automated (upgrade) | `traits`, notes | Computerized (1st: "gains the Computerized condition") | no trait (p.117) | removed, notes updated |
| Smart Scope (upgrade) | `traits` | Computerized (1st: "gains the computerized trait") | no trait (p.118) | removed |
| 25 PR weapon upgrades | `system.prerequisites.when` | none (Corrosive Tip: "Melee weapon") | printed prerequisites (pp.116-118) | added: `host:trait:` for Automount (mounted), Bewildering (blunt); `not:host:trait:` for Scary, Waterproof, Amphibious; `ask:` for the rest. Corrosive Tip aligned |
| Power Blast (Grid Power) | `actionType`, rules, notes | Free; Athletics only (1st: Throwing-based ranged attack) | Standard action, Athletics or Targeting (Thrown), 40ft/100ft (p.100) | `actionType` standard; rule now asks Athletics or Targeting; status full |
| Grid Champion | `prerequisites.when` | none (1st: had vanquished a Towering foe) | 4th level (p.95) | `self:level>=4` |
| Wrestler | `prerequisites.when` | none | Strength 3+ (p.99) | `self:essence:strength>=3` |
| Keen Eye | `prerequisites.when` | none | Alertness (Perception) (p.96) | `self:skill:alertness>=d2`, `ask:Perception Specialization` |
| Peerless Pilot | `prerequisites.when` | none | a Driving Specialization at d6+ (p.97) | `self:skill:driving>=d6`, `ask:A Driving Specialization` (the G.I. JOE pattern) |
| Terran Study | `prerequisites.when` | none | not originally from Earth (p.98) | `ask:Not originally from Earth` |
| Keep 'Em Laughing, Secret Knowledge | perk `type` | general | Origin Benefits (pp.23, 24) | `origin` |
| "I remember reading about...." | name | four dots | the Brainy Origin Benefit's title (p.23) | renamed to `"I remember reading about..."`, Brainy's entry too |
| Vision Focusers | name | Vision Focusers | Vision Focuser (p.38) | renamed, plus the Grid Tech II/III/IV entries |
| Increase Essence (feature) | name | Increase Essence | Increase (Essence) (p.137) | renamed |
| Recall For Repairs (feature) | name | Recall For Repairs | Recall for Repairs (p.135) | renamed (`_id` kept) |
| Yellow Ranger | `skillDie.levels` | 5, 9, **14**, 17 | Follow-Up die d8 from **13th** (Table 4-7, p.55) | level14 changed to level13 |
| Blue, Green, Pink, Red, Yellow Ranger | role `system.items` | no Zord Feature entries (only Black had them) | Zord Feature at 6, 10, 14, 17 (Tables 4-3 to 4-7) | added the `Zd2ZordFeatSlot1` entries Black uses |
| White Ranger | role `system.items` | no Zord Feature entries | Zord Feature at 3, 6, 10, 14, 17 (Table 4-9, p.60) | added 5 entries |
| Zord Feature (`Zd2ZordFeatSlot1`) | `selectionLimit`, page | 4, p.32 | the White Ranger gains five; the Role Perk text is on p.33 | 5, p.33 |
| Clothes, Mighty Morphin, Zeo, Turbo, In Space, Metallic Body Armor | `source.page` | 118 | 119 (Table 8-5) | fixed |
| Acid, Binoculars, Book, Caltrops, Candle, Chain, Climber's Kit, Computer Tablet, Crowbar, Lock, Power Morpher | `source.page` | 119 | 120 | fixed |
| Rope, Wrist Communicator, Engineering Kit, Med Kit, Power Boxes | `source.page` | 120 | 121 | fixed |
| Core Ability (Megaform Trait) | `source.page` | 140 (1st printing) | 139 (the 2nd printing moved it to the head of the list) | fixed |

Module references updated for the renames: the comment in `module/mechanics/vehicles/machine-essences.mjs`
(Increase (Essence)), the comment in `module/dice.mjs` ("I remember reading about..."), and the mock names in
`module/documents/actor.test.js` (Recall for Repairs). No module code matched any of these by name.

Test updated: `module/rules/conv15-systems.test.js`, "Power Blast". It pinned the Athletics-only roll; it now
picks Athletics, then Targeting.

## Removed

None. The only item that existed in the 1st printing alone, the separate Finesse "Strike" weapon, had already
been removed (`LEGACY_UNARMED_WEAPON_IDS` keeps its id). The Thunder Slinger's 1st-printing "Thunder Attack"
alternate was repurposed rather than removed, so characters' copies keep their `_id`.

## Renamed (`_id`s kept)

- Vision Focusers -> Vision Focuser (`c2XlLY69AX3laWPh`)
- "I remember reading about...." -> "I remember reading about..." (`m3yGoT712SFkaV7W`)
- Increase Essence -> Increase (Essence) (`oKGzWCOUCuefWuqD`)
- Recall For Repairs -> Recall for Repairs (`r1S0Sc4oq8axDL6C`)
- Thunder Slinger Alternate Effect 1 -> Thunder Slinger Effect (Sonic vs Putty) (`qf9N60YZPMIxa1l5`)
- Folder Turbo Thunder Canon -> Turbo Thunder Cannon (`rKbv2VhncPgS7qdI`)

File names are unchanged.

## Added

No new items. Every 2nd-printing item in these categories is in the pack: 37 General Perks, 22 Grid Powers, 35
weapon upgrades, all Table 8-3 weapons, 6 armors, the gear and kits, 10 Origins, 10 Influences, 7 Roles and
their perks, 27 Zord Features and 6 Megaform Traits. The 24 role grant entries above (Zord Feature slots) are
new entries on existing Roles.

## Perk fixes left for Phase 2 (rules / choice fields not touched)

- **Caretaker** (`4q2SPRzdbGosL62k`, p.67): the 2nd printing narrowed the Edge to Science (Medicine) Skill Tests
  plus Group Skill Tests. The 1st printing gave Group Checks and Lend Assistance. The rule gives Edge on every
  Science test, and the notes leave the Medicine restriction to the table. Add
  `roll:specialization=medicine` to the RollModifier's `when`, as EMT Crash Course does.
- **Expertise** (`uoCQgYOCeIQNzF0q`, p.95): the prerequisite is "a Skill at d4 or higher", which is a filter on
  its own Skill choice (ChoiceSet), so it needs a choice-side fix.
- **Grid Relic Weapon** (`82Ld65NsKwfMZaSC`) / **Relic Weapon Trait** (`U8hcTqLqPyMGyz22`), p.61: the Grid Relic
  starts with two Relic Weapon Traits at 1st level, plus one more at 7th, 12th and 17th. This is the same in both
  printings. The Grid Relic Weapon's rule grants no traits, and Relic Weapon Trait is a manual placeholder with no
  pick. It could pickGrant one of the eight "Relic Weapon Trait: ..." perks, with two picks at 1st level.

## Book unclear / deliberately left

- **Turbo Blade classification** prints as "Melee / Finesse energy" (1st: "Melee energy"). Read as Finesse.
- **Martial Arts short projectile**: the main effect prints "Sharp 1 (1)" with the shift arrow lost in both
  printings. Left with no shift.
- **Zeo Power Tonfas** print "Reach, Range 10/30" (thrown). The pack has no thrown effect. Not added.
- **Weapon names kept as the cross-line convention**: Frag Grenade (book: Grenade), Close Combat Bludgeoning
  (Close combat bludgeon), Martial Arts Long Bludgeoning (Martial Arts long bludgeon), Long Blade / Medium Blade
  (Martial Arts long / medium blade), Zeo Laser Pistol (Zeo Laser Pistols). These names are the same in both
  printings, and they share names and `_id`s with the G.I. JOE / Transformers packs, so renaming only the PR
  copies would split the convention. A ruling is needed.
- **Non-CRB items in the CRB pack**: 7 A Jump Through Time perks (Brainstorm, Contingency Shot, Defensive
  Flexibility, Heavy Force, Iron Bravado, Mysterious Aura, Pay It Forward). They are wired as Spectrum
  Modification alternatives (`choiceGroup`), e.g. Iron Bravado beside Whatever We Need on the Black Ranger.
  There are also 4 Pre Gen Characters weapons (Power Crossbow, Hammer, Spear, Tetsubo, cited p.2). Not 1st-printing
  leftovers, so kept.
- **Upgrade prerequisites** are missing for the same upgrades in the G.I. JOE and Transformers packs. Only the PR
  copies were filled in here.
- **Aim Apparatus applied effect** (`prcrbeffects`): it applies Targeting ↑1. The book gives a Targeting rank,
  which the perk's own rule already handles. Left as is.
- **Lightning Fast**: the book's heading misprints it "Lighting Fast" (both printings). The pack name is kept.
- **Power Ranger faction** cites p.31; the book has no such item (it carries It's Morphin Time!).
- **Code-level glossary changes** are not pack data and were not checked here. These are the trait definitions
  on pp.106-107 and 114 (Indirect, Smoke, Stun, the new Power Weapon trait entry) and Zord growth every 5 levels,
  now Plating and ↑1 to Driving/Initiative tests (p.134). Neither is implemented as item data. The baseline Zord
  stat block also changed (Might / Targeting skills, Plating, p.134). It is actor data, and no PR Zord actor pack
  exists.
- **Not in any PR CRB pack** (actors): the vehicles (pp.122-129), the example Zords and Megaforms
  (pp.141-205) and the Threats (pp.207+).

## Checks

- `node scripts/check-rules.mjs`: 4425 rules on 2445 items, 575 prerequisite lists, 0 errors, 0 warnings.
- eslint on the touched JS (`--rule 'linebreak-style: off'`, because the Windows checkout is CRLF): clean.
- Full jest: 366 suites, 8524 tests, all passing (after the Power Blast test update).
- Packs not compiled (`npm run build:db` still needed).
