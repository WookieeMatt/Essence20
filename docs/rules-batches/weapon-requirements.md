# Weapon requirements as prerequisites (2026-10-07)

Approved by the user 2026-10-07 ("Convert weapon custom requirements to prerequisites"). Follows up
`small-cleanups.md` section "Weapon `requirements.custom`". The free-text part of a pack weapon's Requirements
(`system.requirements.custom`) is now `system.prerequisites.when` tags where it names something the
prerequisite check can read, so the warn/strict `prerequisiteMode` setting checks it when the weapon is added
(`module/rules/prerequisites.mjs`; weapons get the field through `templates/item-description.mjs`). Each value was
read against its book (PR: Core Rulebook 2nd Printing only). No code, lang or schema change.

Rules followed:

- Fully converted: the text is cleared to `""` so the sheet's "Requirements:" chip doesn't repeat the tags.
- Partly converted: only the part with no tag stays as text.
- Notes about using the weapon (combined weapons, Alt Mode only, a test to equip, a Snag for low Brawn) stay as text.
- "Nil" cleared to `""`.
- Where the book prints the requirement as "X or Y" (or "X/Y") and the pack had split it, X in the structured
  `requirements.skill/shift` and Y in the text, the tag is the whole alternative (`{"any":[X,Y]}`). Otherwise only the
  text part is encoded; the structured Skill/Brawn requirement is unchanged and still shown by its own chip.
- Origins, Perks, Roles and Foci are `self:hasType:<type>:<pack item name>`; an item merely owned is `self:has:<name>`;
  sizes are `self:size>=<size>`.

Totals: 108 weapons. Fully converted: 94; Partly converted (remainder kept as text): 2; Kept as text (usage notes): 7; Cleared ("Nil"): 5. Skipped for code: 0.

## Fully converted

| Pack | Weapon | p. | Old text | Tags (in words) | Text now |
|---|---|---|---|---|---|
| Across the Stars (atsitems) | Auto Blaster | 76 | Turbocharged | Has Turbocharged (Form) (perk) | (cleared) |
| Across the Stars (atsitems) | Lightspeed Rescue Claw | 79 | Lightspeed Response | Has Lightspeed Response (Form) (perk) | (cleared) |
| Across the Stars (atsitems) | Lightspeed Rescue Cutter | 78 | Lightspeed Response | Has Lightspeed Response (Form) (perk) | (cleared) |
| Across the Stars (atsitems) | Lightspeed Rescue Laser | 78 | Lightspeed Response | Has Lightspeed Response (Form) (perk) | (cleared) |
| Across the Stars (atsitems) | Phantom Laser | 80 | Phantom Ranger | Has Phantom Ranger (role) | (cleared) |
| Across the Stars (atsitems) | Rescue Blaster | 78 | Lightspeed Response | Has Lightspeed Response (Form) (perk) | (cleared) |
| Across the Stars (atsitems) | Silverizer | 80 | Silver Ranger | Has Silver Ranger (role) | (cleared) |
| Across the Stars (atsitems) | Super Silverizer | 80 | SIlver Ranger | Has Silver Ranger (role) | (cleared) |
| Across the Stars (atsitems) | Thermo Blaster | 78 | Lightspeed Response | Has Lightspeed Response (Form) (perk) | (cleared) |
| Across the Stars (atsitems) | Turbo Blade | 76 | Turbocharged | Has Turbocharged (Form) (perk) | (cleared) |
| Across the Stars (atsitems) | Turbo Hand Blaster | 78 | Turbocharged | Has Turbocharged (Form) (perk) | (cleared) |
| Across the Stars (atsitems) | Turbo Lightning Sword | 78 | Turbocharged | Has Turbocharged (Form) (perk) | (cleared) |
| Across the Stars (atsitems) | Turbo Star Chargers | 78 | Turbocharged | Has Turbocharged (Form) (perk) | (cleared) |
| Across the Stars (atsitems) | Turbo Thunder Cannon | 78 | Turbocharged | Has Turbocharged (Form) (perk) | (cleared) |
| Across the Stars (atsitems) | Turbo Wind Fire | 78 | Turbocharged | Has Turbocharged (Form) (perk) | (cleared) |
| Across the Stars (atsitems) | V-Lancer | 76 | Lightspeed Response | Has Lightspeed Response (Form) (perk) | (cleared) |
| Beneath The Helmet (bthitems) | Dino Blade Blaster | 68 | Requires a Dino Charge Morpher and a Dino Saber | Has Dino Charge Morpher; Has Dino Saber | (cleared) |
| Beneath The Helmet (bthitems) | Dino Charge Morpher | 68 | Requires a Dino Charger | Has Dino Charger | (cleared) |
| Cobra Codex (ccitems) | Compound Z | 94 | Science d8 | Infiltration d8+ or Science d8+ | (cleared) |
| Cobra Codex (ccitems) | Dangerous Digestive | 94 | Science d4 | Infiltration d4+ or Science d4+ | (cleared) |
| Cobra Codex (ccitems) | Deadly Touch | 94 | Science d4 | Infiltration d4+ or Science d4+ | (cleared) |
| Cobra Codex (ccitems) | Deadly Touch (Chemical Sprayer) | 94 | Science d4 | Infiltration d4+ or Science d4+ | (cleared) |
| Cobra Codex (ccitems) | Elemental Poison | 94 | Science d6 | Infiltration d6+ or Science d6+ | (cleared) |
| Cobra Codex (ccitems) | Funhouse | 94 | Science d8 | Infiltration d8+ or Science d8+ | (cleared) |
| Cobra Codex (ccitems) | Incapacitating Agent | 94 | Science d2 | Infiltration d2+ or Science d2+ | (cleared) |
| Cobra Codex (ccitems) | Inebriant | 94 | Science d2 | Infiltration d2+ or Science d2+ | (cleared) |
| Cobra Codex (ccitems) | Irritant | 94 | Science d2 | Infiltration d2+ or Science d2+ | (cleared) |
| Cobra Codex (ccitems) | Mental Disrupter | 94 | Science d2 | Infiltration d2+ or Science d2+ | (cleared) |
| Cobra Codex (ccitems) | Neuromuscular Blocker | 94 | Science d6 | Infiltration d6+ or Science d6+ | (cleared) |
| Cobra Codex (ccitems) | Particle Toxin | 94 | Science d4 | Infiltration d4+ or Science d4+ | (cleared) |
| Cobra Codex (ccitems) | Sludge | 94 | Science d8 | Infiltration d8+ or Science d8+ | (cleared) |
| Cobra Codex (ccitems) | Soporific | 94 | Science d6 | Infiltration d6+ or Science d6+ | (cleared) |
| Cobra Codex (ccitems) | V.E.N.O.M | 94 | Science d8 | Infiltration d8+ or Science d8+ | (cleared) |
| Decepticon Directive (dditems) | Catalytic Cannon | 73 | Brawn d4 | Brawn d4+ | (cleared) |
| The Enigma of Combination (eocitems) | Blaster Knuckles | 50 | Towering | Size Towering or larger | (cleared) |
| The Enigma of Combination (eocitems) | Breaker Bar | 49 | Technology d2 | Technology d2+ | (cleared) |
| The Enigma of Combination (eocitems) | Cycler Warhead Array | 50 | Towering | Size Towering or larger | (cleared) |
| The Enigma of Combination (eocitems) | Dual Cannon | 51 | Towering | Size Towering or larger | (cleared) |
| The Enigma of Combination (eocitems) | Ender's Rail | 53 | Towering | Size Towering or larger | (cleared) |
| The Enigma of Combination (eocitems) | Energon Claymore | 51 | Towering | Size Towering or larger | (cleared) |
| The Enigma of Combination (eocitems) | Forge of Solus Prime | 57 | Huge-Towering | Size Huge or larger; Brawn d8+; Brawn d10+ or Size Towering or larger; Brawn d12+ or Size Gigantic or larger | (cleared) |
| The Enigma of Combination (eocitems) | Magna-Blast Gun | 52 | Tech d2 | Technology d2+ | (cleared) |
| The Enigma of Combination (eocitems) | Mortar Shell Cannon | 51 | Huge | Size Huge or larger | (cleared) |
| The Enigma of Combination (eocitems) | Negavator Beam | 53 | Gigantic | Size Gigantic or larger | (cleared) |
| The Enigma of Combination (eocitems) | Rail Rifle | 52 | Alertness d4 | Alertness d4+ | (cleared) |
| The Enigma of Combination (eocitems) | Star Cannon | 52 | Towering | Size Towering or larger | (cleared) |
| The Enigma of Combination (eocitems) | Titansword | 50 | Towering | Size Towering or larger | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Avalanche Stomp | 296 | Path of Stone | Has Path of Stone (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Blast of Cold | 302 | Path of Frost | Has Path of Frost (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Flames of Hate | 302 | Path of Cruelty | Has Path of Cruelty (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Focused Rage Flare | 302 | Path of Cruelty | Has Path of Cruelty (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Hurl Stones | 302 | Path of Stone | Has Path of Stone (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Ice Flechettes | 302 | Path of Frost | Has Path of Frost (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Incineration Blast | 302 | Path of Flame | Has Path of Flame (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Massive Fists | 302 | Path of Stone | Has Path of Stone (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Monstrous Talons | 302 | Path of Cruelty, Path of Flame, Path of Frost, or Path of Thorns | Has Path of Cruelty (role) or Has Path of Flame (role) or Has Path of Frost (role) or Has Path of Thorns (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Pollen Cloud | 302 | Path of Thorns | Has Path of Thorns (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Psycho Axe | 302 | Psycho Rangers only | Has Path of Cruelty (role) or Has Path of Flame (role) or Has Path of Frost (role) or Has Path of Stone (role) or Has Path of Thorns (role) or Has Path of Venom (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Psycho Blade | 302 | Psycho Rangers only | Has Path of Cruelty (role) or Has Path of Flame (role) or Has Path of Frost (role) or Has Path of Stone (role) or Has Path of Thorns (role) or Has Path of Venom (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Psycho Blast | 302 | Psycho Ranger Only | Has Path of Cruelty (role) or Has Path of Flame (role) or Has Path of Frost (role) or Has Path of Stone (role) or Has Path of Thorns (role) or Has Path of Venom (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Psycho Blaster | 302 | Psycho Rangers only | Has Path of Cruelty (role) or Has Path of Flame (role) or Has Path of Frost (role) or Has Path of Stone (role) or Has Path of Thorns (role) or Has Path of Venom (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Psycho Bow | 302 | Psycho Rangers only | Has Path of Cruelty (role) or Has Path of Flame (role) or Has Path of Frost (role) or Has Path of Stone (role) or Has Path of Thorns (role) or Has Path of Venom (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Psycho Dagger | 302 | Psycho Rangers only | Has Path of Cruelty (role) or Has Path of Flame (role) or Has Path of Frost (role) or Has Path of Stone (role) or Has Path of Thorns (role) or Has Path of Venom (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Psycho Scythe | 302 | Psycho Rangers only | Has Path of Cruelty (role) or Has Path of Flame (role) or Has Path of Frost (role) or Has Path of Stone (role) or Has Path of Thorns (role) or Has Path of Venom (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Psycho Slinger | 302 | Psycho Rangers only | Has Path of Cruelty (role) or Has Path of Flame (role) or Has Path of Frost (role) or Has Path of Stone (role) or Has Path of Thorns (role) or Has Path of Venom (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Psycho Staff | 302 | Psycho Rangers only | Has Path of Cruelty (role) or Has Path of Flame (role) or Has Path of Frost (role) or Has Path of Stone (role) or Has Path of Thorns (role) or Has Path of Venom (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Psycho Strike | 302 | Psycho Ranger Only | Has Path of Cruelty (role) or Has Path of Flame (role) or Has Path of Frost (role) or Has Path of Stone (role) or Has Path of Thorns (role) or Has Path of Venom (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Psycho Sword | 302 | Psycho Rangers only | Has Path of Cruelty (role) or Has Path of Flame (role) or Has Path of Frost (role) or Has Path of Stone (role) or Has Path of Thorns (role) or Has Path of Venom (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Psycho Trident | 302 | Psycho Rangers only | Has Path of Cruelty (role) or Has Path of Flame (role) or Has Path of Frost (role) or Has Path of Stone (role) or Has Path of Thorns (role) or Has Path of Venom (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Sap Spray | 302 | Path of Thorns | Has Path of Thorns (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Scything Limbs | 302 | Path of Venom | Has Path of Venom (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Stinger Spray | 302 | Path of Venom | Has Path of Venom (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Tentacle Vine | 302 | Path of Thorns | Has Path of Thorns (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Toxic Spit | 302 | Path of Venom | Has Path of Venom (role) | (cleared) |
| Finster's Monster-Matic Cookbook (fmmcitems) | Venomous Bite | 302 | Path of Venom | Has Path of Venom (role) | (cleared) |
| GI Joe Core Rulebook (gijcrbitems) | Long Range Automatic Rifle | 143 | Alertness d2 | Alertness d2+ | (cleared) |
| A Jump Through Time (jttitems) | Bullwhip | 78 | Acrobatics d4 | Athletics d4+ or Acrobatics d4+ | (cleared) |
| A Jump Through Time (jttitems) | Eltarian Blaster | 76 | Access to Alien Technology | Access to alien technology | (cleared) |
| A Jump Through Time (jttitems) | Footman's Flail | 76 | Brawn d2 | Brawn d2+ | (cleared) |
| A Jump Through Time (jttitems) | Kusarigama | 78 | Acrobatics d4 | Athletics d4+ or Acrobatics d4+ | (cleared) |
| Power Ranger Core Rulebook (prcrbitems) | Large Thrown Weapon | 112 | Huge | Brawn d4+ or Size Huge or larger | (cleared) |
| Power Ranger Core Rulebook (prcrbitems) | Martial Arts Long Blade | 112 | or Might | Finesse d6+ or Might d6+ | (cleared) |
| Power Ranger Core Rulebook (prcrbitems) | Martial Arts Medium Blade | 112 | or Might | Finesse d4+ or Might d4+ | (cleared) |
| Quartermaster's Guide to Gear (qgtgitems) | Pillage | 25 | Freebooter Focus, Pillage Perk | Has Freebooter (focus); Has Pillage (perk) | (cleared) |
| Story of the Seasons (sotsitems) | Screech | 131 | Griffon Origin, Screech Perk | Has Griffon (origin); Has Screech (perk) | (cleared) |
| Transformers Core Rulebook (tfcrbitems) | Artillery Cannon | 125 | Gigantic | Brawn d6+ or Size Gigantic or larger | (cleared) |
| Transformers Core Rulebook (tfcrbitems) | Large Thrown Weapon | 123 | Huge | Brawn d4+ or Size Huge or larger | (cleared) |
| Transformers Core Rulebook (tfcrbitems) | Missile | 125 | Gigantic | Brawn d6+ or Size Gigantic or larger | (cleared) |
| Transformers Core Rulebook (tfcrbitems) | Rocket Launcher | 124 | Huge | Brawn d4+ or Size Huge or larger | (cleared) |
| Technorganic Secrets (tsitems) | Redirection Gauntlets | 48 | Targeting d4, Technology d4 | Targeting d4+; Technology d4+ | (cleared) |
| Through The Shattered Grid (ttsgitems) | Eltarian Dualblade | 77 | Access to Alien Technology | Access to alien technology | (cleared) |
| Through The Shattered Grid (ttsgitems) | Pteradon Sniper Rifle | 31 | Targeting d4 | Targeting d4+ | (cleared) |
| Citizens' Guide (wtnvcgitems) | Fangs | 62 | Dragon Origin | Has Dragon (origin) | (cleared) |
| Citizens' Guide (wtnvcgitems) | Fire Breath | 68 | Dragon Origin, Fire Breath Perk | Has Dragon (origin); Has Fire Breathing (perk) | (cleared) |

## Partly converted (remainder kept as text)

| Pack | Weapon | p. | Old text | Tags (in words) | Text now |
|---|---|---|---|---|---|
| Power Ranger Core Rulebook (prcrbitems) | Power Cannon | 112 | Brawn | Brawn d4+ or Targeting d4+ | 3 Rangers |
| Power Ranger Core Rulebook (prcrbitems) | Zeo Cannon | 112 | Brawn | Brawn d4+ or Targeting d4+ | 5 Rangers |

## Kept as text (usage notes)

| Pack | Weapon | p. | Old text | Tags (in words) | Text now |
|---|---|---|---|---|---|
| Beneath The Helmet (bthitems) | Dino Spike | 68 | See combined weapon rules, pg. 115 CRB | - | See combined weapon rules, pg. 115 CRB |
| Beneath The Helmet (bthitems) | Z-Rex Blaster | 68 | See combined weapon rules, pg. 115 CRB | - | See combined weapon rules, pg. 115 CRB |
| Finster's Monster-Matic Cookbook (fmmcitems) | The Black Blade | 275 | Anyone without at least Brawn +d2 suffers Snag on melee attacks with it | - | Anyone without at least Brawn +d2 suffers Snag on melee attacks with it |
| Power Ranger Core Rulebook (prcrbitems) | Auto Blaster | 108 | Combined Weapon | - | Combined Weapon |
| Power Ranger Core Rulebook (prcrbitems) | Power Blaster | 108 | Combined Weapon | - | Combined Weapon |
| Transformers Extras (tfextitems) | Polarity Gauntlet | 1 | DIF 16 (Cybertronian) | - | DIF 16 (Cybertronian) |
| Technorganic Secrets (tsitems) | Natural Weapon Flyby | 39 | Alt Mode; move 10 ft first | - | Alt Mode; move 10 ft first |

## Cleared ("Nil")

| Pack | Weapon | p. | Old text | Tags (in words) | Text now |
|---|---|---|---|---|---|
| The Enigma of Combination (eocitems) | Cluster Grenade | 49 | Nil | - | (cleared) |
| The Enigma of Combination (eocitems) | Gyro-Gun | 51 | Nil | - | (cleared) |
| The Enigma of Combination (eocitems) | Nebulanese Blaster | 50 | Nil | - | (cleared) |
| Transformers Core Rulebook (tfcrbitems) | Blaster | 121 | Nil | - | (cleared) |
| Transformers Core Rulebook (tfcrbitems) | Mini-Laser | 75 | Nil | - | (cleared) |

## Book checks and judgement calls (for a decision if wanted)

- **"/" read as "or".** TF Core (2nd Printing) prints "Brawn d4/Huge", "Brawn d6/Gigantic"; PR Core (2nd Printing) prints
  "Brawn d4/Huge" and "Brawn/Targeting d4". Enigma of Combination spells both-needed as "and" and its upscaling table
  says "Size Class 3 or Brawn d6", so "/" was taken as "or". If it should be "and", drop the `any` wrapper.
- **Sizes are minimums** (`size>=`): a bigger character meets "Towering". Enigma of Combination's Cannoneer Focus
  (size requirements lowered two classes for hardpoint weapons) and Titan Hardpoint Upgrades (size requirements
  ignored) are not read by the check; in warn mode that is only a GM note.
- **Forge of Solus Prime**: the book gives three pairs (Brawn d12 and Huge, or d10 and Gigantic, or d8 and Towering).
  The tag language has `any` but no nested "all", so it is written as the equivalent four checks (Huge+, Brawn d8+,
  Brawn d10+ or Towering+, Brawn d12+ or Gigantic+). The unit test walks the cases.
- **Cobra Codex poisons/toxins**: the book prints "Infiltration or Science dX"; the pack had Infiltration structured and
  "Science dX" as text, now one `any`.
- **Fire Breath**: the book's weapon line says "Fire Breath Perk"; the Perk is printed (and packed) as Fire Breathing, so
  the tag names Fire Breathing.
- **Psycho weapons** ("Psycho Rangers only"): a Psycho Ranger is a character on one of the six Psycho Paths (Roles), so
  the tag is any of the six Path Roles. The book's table leaves the Psycho Staff's note column empty (every other
  Psycho weapon has it); the pack already said "Psycho Rangers only" and it was converted like its siblings. Clear it if
  the book is to be read literally.
- **Power Cannon / Zeo Cannon**: book "Brawn/Targeting d4 (3 Rangers)" / "(5 Rangers)". The pack text was just "Brawn";
  the skill part is now tags and the crew size, which no tag can check, is the remaining text.
- **"Access to Alien Technology"** (Eltarian Blaster, Eltarian Dualblade): no item grants it, so it is an `ask:` tag
  (never blocks; the GM is told).
- **Kept as text**: combined-weapon notes (Dino Spike, Z-Rex Blaster, PR Auto Blaster, Power Blaster), Natural Weapon
  Flyby (Alt Mode only and a move first: a use condition, not a prerequisite), Polarity Gauntlet (a DIF 16 Technology
  test to equip it), The Black Blade (a Snag below Brawn d2, not a bar to taking it).
- Structured Skill/Brawn requirements (`requirements.skill/shift`) were left alone; they still show as their own chip.
