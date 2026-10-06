# Plain-English rule conditions (round 18)

The Rules tabs (item sheet, actor sheet) read a rule's `when` out through `describeWhen`. It used to know a handful of
tag families and print everything else raw. It now lives in `module/rules/describe-when.mjs` (re-exported from
`types.mjs`) and reads every family the predicate knows, every plug-in tag (each `registerTag` call now carries a
`meta.phrase`), every `check:` name, data paths, `calc:` formulas and stored picks. Negation reads naturally
("if you haven't ...", "except on ...", "unless ..."). An unknown tag is humanized, never raw.

Coverage: all 2,434 distinct `when` tags in the packs (7,342 uses), the 216 plug-in tag registrations and the 44
checks. `describe-when.test.js` runs every pack tag and fails on a raw `family:` token, a camelCase key, a stored
path, a formula or a raw pick.

Summaries also lost their jargon: no "(derived)" stage labels, "add 2 -> system.health.max" became
"+2 maximum Health", Grants show the label (or the item's name), step names read as words.

## Before / after

| Tag | Before | After |
| --- | --- | --- |
| `self:morphed` | while Morphed | while you are Morphed |
| `not:self:actionUsed:standard` | not while actionUsed standard | if you haven't taken your Standard action yet |
| `self:data:system.movement.ground.total>0` | while data system.movement.ground.total>0 | while you have a Ground Movement |
| `self:toggle:on` | while toggle on | while it is switched on |
| `self:type:zord` | while type zord | if you are a Zord |
| `item:own` | with own | with this item |
| `not:self:hasItem:Compendium.essence20.tf_crb.Item.AVVUjFaqNYhl5q4m` | not while hasItem Compendium.essence20.tf_crb.Item.AVVUjFaqNYhl5q4m | while you don't have Ram |
| `target:tag:robot` | when the target is tag robot | if the target counts as Robot |
| `not:roll:dataset:isInitiative` | not roll:dataset:isInitiative | except on Initiative rolls |
| `skill:{item.choice}` | on {item.choice} tests | on tests of the chosen Skill |
| `rule:data:system.choice=shipIntegration` | rule:data:system.choice=shipIntegration | if you chose Ship Integration |
| `self:marked:overcharge` | while marked overcharge | while you have the Overcharge mark |
| `not:self:windowUsed:emotionalStrengthUsedThisEncounter:encounter` | not while windowUsed emotionalStrengthUsedThisEncounter:encounter | if you haven't used Emotional Strength this encounter |
| `var:ok>=1` | var:ok>=1 | if that worked |
| `calc:@level>=10` | calc:@level>=10 | if your level is at least 10 |
| `calc:@owned.eMliZALtmapa7zoo>0` | calc:@owned.eMliZALtmapa7zoo>0 | if you have Complete System Failure |
| `check:monsterForm` | check:monsterForm | if you are in Monster Form |
| `self:skill:driving>=d2` | while skill driving>=d2 | while your Driving is at least d2 |
| `rule:pickedItem:victim:item:type:weapon` | rule:pickedItem:victim:item:type:weapon | if the victim you picked is an item where it is a weapon |
| `roll:switch:menacingGlare` | roll:switch:menacingGlare | if you tick Menacing Glare |
| `combat:enemyStatus:surprised` | in combat | while an enemy in the fight is Surprised |

Yo Joe!, whole summary:

- Before: `Ground Movement + 10 (derived) in combat, while combatant, not while actionUsed standard, while data system.movement.ground.total>0`
- After: `Ground Movement +10 in round 1, while you are in the combat, if you haven't taken your Standard action yet, while you have a Ground Movement`

## For plug-in authors

`registerTag(name, fn, { phrase })`, where `phrase` is a clause, a `[clause, negated clause]` pair, or
`(arg, w) => either` (return null to fall back on the core reading). Templates fill `{arg}` (as words), `{raw}`,
`{name}` (an item's name from a uuid / id), `{ft}`, and `{who}` / `{is}` / `{isnt}` / `{has}` / `{hasnt}` / `{poss}` /
`{its}` / `{s}` for whoever the tag asks about. A `self:` phrase also reads `target:` and `holder:` tags of the same name.
`w` carries `humanize`, `itemName`, `pathName`, `comparison`, `skillName`, `items(tags, name?)`, `facts(tags, name?)`,
`describe(tags)` and `formula(text)`. A tag registered elsewhere can get one later with `registerTagPhrase`.

## Formula amounts

Summaries no longer show formulas either. `formulaWords` (describe-when.mjs) parses a formula and reads it out:
`@refs` become words (your level, your Strength, your Might ranks, this item's / the host item's / the rolled item's
fields, the chosen pick, a pool, a mark, the amount spent, your copies of an item, size steps, Reach...),
`max(n, x)` / `min(n, x)` read "x (at least n)" / "x (at most n)", other `max` / `min` read "the higher / lower of",
`floor` / `ceil` read "rounded down / up", `abs(a - b)` reads "the difference between a and b", and arithmetic reads
plus / minus / times / divided by, with brackets kept where grouping matters. A long step formula (over 80 characters
of words) reads as "an amount based on your level". Shifts read "↑ equal to ...", additions "+ ... to Toughness" (or
"- ..." for a negative), limits "up to ... per scene", attack counts "attacks equal to ...". Stored objects and words
read too ("Secondary Damage becomes 1 Sharp", "Skill becomes the chosen skill", "Gains Acid resistance").

The pack-summary test now fails on any `@`, `max(` / `min(` / `floor(` / `ceil(` / `abs(` / `round(` or an unparsed
"calculated amount" in any of the 4,202 pack rule summaries (about 170 of them carried a formula).

| Rule | Before | After |
| --- | --- | --- |
| Power Boost | +(max(1, @item.system.advances.currentValue)) damage dealt | + this item's Advances (at least 1) damage dealt |
| Pyromania | ↑(1 + floor(min(@level, 20) / 10)) on attacks | ↑ equal to 1 plus ((your level (at most 20)) divided by 10, rounded down) on attacks |
| Nose for Trouble | ↑(max(0, @skill.streetwise.rank - @skill.alertness.rank)) | ↑ equal to your Streetwise ranks minus your Alertness ranks (at least 0) |
| Bend A Knee Or Stand Tall | ↑(abs(@size - @target.size)) | ↑ equal to the difference between your size step and the target's size step |
| Obscuring Matrix | +(-@item.system.armorBonus.value) Evasion | - this item's Armor Bonus to Evasion |
| Gravity Optional | Aerial Movement becomes (5 + 5 * floor(@level / 5)) | Aerial Movement becomes 5 plus 5 times (your level divided by 5, rounded down) |
| Amphibious Assault | Swim Movement becomes (max(@actor.system.movement.swim.total, @actor.system.movement.ground.total) + 15) | Swim Movement becomes (the higher of your Swim Movement and your Ground Movement) plus 15 |
| Personal Power Supply | +(1 + floor(@level / 5)) maximum Personal Power | + 1 plus (your level divided by 5, rounded down) to maximum Personal Power |
| Extra Attack | 1 + max(1, @item.system.advances.currentValue) attacks per Attack action | attacks equal to 1 plus (this item's Advances (at least 1)) per Attack action |
| Tight Bond | 1 + max(0, floor((@level - 3) / 3))/turn | up to 1 plus ((your level minus 3) divided by 3, rounded down (at least 0)) per turn |
| Colony Changeling | +(min(3, @tokensHolding.FRUWPAePJzm7Mlf0.5)) Evasion | + the creatures within 5 ft holding Colony Changeling (at most 3) to Evasion |
| Meat Shield | +(2 * min(1, max(0, @level - 6)) + ...) Toughness | + an amount based on your level to Toughness |
| Defensive Flexibility | +true system.resistances.acid | Gains Acid resistance |
