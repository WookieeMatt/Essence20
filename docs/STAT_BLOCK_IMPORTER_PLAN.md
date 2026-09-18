# Stat Block Importer & "Make My Monster Grow" — Design Plan

Status: **design only, nothing implemented.** Written 2026-09-15 against branch
`Vehicles-Zords-Megaforms`.

**Target: Foundry VTT v14** (local install is 14.364). Every API fact below was read out of
the v14 client source, not v13. See §9 for the v14 verification pass and the one manifest
change this needs.

Both features are planned together because they share one core: a normalized, in-memory
**stat block IR** (intermediate representation). The importer is `text -> IR -> Actor`.
Grow is `Actor -> IR -> transform -> Actor`. Building them separately would mean writing the
IR twice.

---

## 0. Why this is worth building

The system ships **32 compendium packs, every one of them `Item`** — there is not a single
`Actor` pack. Every Threat, vehicle, and NPC a GM runs is hand-built field by field through
the sheet, the Skill Picker, and the Stat Editor. A Power Rangers CRB Threat like Polluticorn
is ~9 skills, 2 Perks, 2 Powers, 2 attacks (each an Item **pair**), a Hang-Up, 4 Essences,
4 Defenses, 2 movement types and a Size — call it 40+ manual edits, times two if you also
want its Grown form.

---

## 1. The source material: three real dialects

Stat blocks get pasted out of PDFs, and the layout differs per book line. All three of the
following are shaped exactly like a real paste.

**Dialect A — Power Rangers CRB (2nd printing)**: pipe-separated header pairs, bare skill
lines, `GROUND MOVEMENT` / `AERIAL MOVEMENT` as separate labels.

```
THREAT LEVEL: 7
SIZE: LARGE | HEALTH: 7
GROUND MOVEMENT: 30ft | AERIAL
MOVEMENT: 60ft
STRENGTH: 6 | SPEED: 6
SMARTS: 3 | SOCIAL: 5
TOUGHNESS: 16 | EVASION: 16
WILLPOWER: 13 | CLEVERNESS: 15
SKILLS
Alertness (Insight) +d4*
Melee (Unarmed Combat) +d6*
Languages: English
ATTACKS
Unarmed Combat (Might): +d6*, Reach (1 Blunt damage)
Blasting Horn (Targeting): +d4, Range 30ft/60ft (1 Energy damage)
```

**Dialect B — Finster's Monster-Matic Cookbook**: no pipes, one `MOVEMENT:` line with
semicolon-separated types, bulleted skills, letter-spaced headings (`AT TACKS`), and
sub-lines under each attack.

```
SIZE: Towering HEALTH: 18
MOVEMENT: 45ft Ground; 35ft Aerial
SKILLS
- Might (Brawling) +d8*
- Conditioning +1
AT TACKS
Golden Sword (Finesse): +d6*, Reach x2 (5 Sharp damage)
Alternate Effects: 2 Energy damage
Hands: 1
Traits: Energy, Magical, Sharp, Silent
```

**Dialect C — G.I. JOE CRB vehicles**: `--` for absent Essences, colon-separated skills,
bulleted attacks with `min` ranges and `Blast:` shapes.

```
SIZE: Extended | HEALTH: 5
MOVEMENT: 45 ft Ground
STRENGTH: 4 | SPEED: 1 | SMARTS: -- | SOCIAL: --
TOUGHNESS: 15 | EVASION: 11
WILLPOWER: -- | CLEVERNESS: --
SKILLS
- Might: +d4
ATTACKS
- 105mm Recoilless Cannon (Targeting): Gunner's Targeting Skill,
  Range 100ft/200ft; min 30ft (1 Sharp Damage, Blast: 20ft radius)
- Traits: Anti-Tank, Reload
```

The parser must be **tolerant, not strict**: one grammar with per-field alternatives, never
three parsers.

---

## 2. Architecture

Three layers, deliberately split so the hard part is testable.

| Layer | File | Foundry globals? | Tested |
|---|---|---|---|
| Parser | `module/helpers/stat-block-parser.mjs` | none | yes, heavily |
| Builder | `module/helpers/stat-block-import.mjs` | yes | pure parts only |
| UI | `module/apps/stat-block-importer.mjs` | yes | no (per QA_PLAN) |

`module/helpers/**` is inside `jest.config.js`'s `collectCoverageFrom`, so **both helper files
need test files or the coverage floor silently drops.** That is the point: the parser is pure
`String -> Object` and is the natural home for essentially all the logic.

Supporting files: `templates/app/stat-block-importer.hbs`,
`sass/views/_stat-block-importer.scss` (plus `@use` in `sass/views/_index.scss`), and
`lang/en.json` keys under an `E20.StatBlockImport*` prefix.

### 2.1 The IR

One plain object, no Foundry types, serializable:

```js
{
  name, threatLevel, size, health, conditioning,
  essences:  { strength, speed, smarts, social },       // null for "--"
  defenses:  { toughness, evasion, willpower, cleverness },
  movement:  { ground, aerial, swim, climb },
  languages: [],
  skills:    [{ key, shift, isSpecialized, specialization, modifier }],
  perks:     [{ name, text }],
  powers:    [{ name, text, usesPer, usesInterval, actionType }],
  hangUps:   [{ name, text }],
  attacks:   [{ name, skill, shift, isSpecialized, damageValue, damageType,
                range: { value, long, min, reachMultiplier },
                radius, shape, numHands, traits, defenseType,
                alternateEffects: [ /* same shape */ ] }],
  equipment: [{ kind: 'armor'|'weapon'|'other', name, text, bonus }],
  diagnostics: [{ severity, line, message }],
}
```

`diagnostics` is not decoration — it is the contract. **Nothing is ever silently dropped.** An
unrecognized trait, an unmapped skill name, an unparsed line all become a diagnostic the UI
shows before anything is created.

---

## 3. Parser design

### 3.1 Preprocessing (the unglamorous half)

PDF paste is filthy. In order:

1. Strip page furniture: `Downloaded by ... Unauthorized distribution prohibited.`, running
   headers (`POWER RANGERS ROLEPLAYING GAME - CHAPTER 13: THREATS216`), and page-number/title
   mashes (`102102POWER RANGERS ROLEPLAYING GAME...`).
2. Collapse letter-spaced headings: `T H R E A T S` becomes `THREATS`, `AT TACKS` becomes
   `ATTACKS` (a ligature artifact, not a typo).
3. De-hyphenate line-wrapped words: `doz-\nens` to `dozens`, `passen-\ngers` to `passengers`.
   Only when the next line starts lowercase, so `Anti-\nTank` survives.
4. Normalize typography: curly quotes/apostrophes, en/em dashes, the multiplication sign to
   `x`, non-breaking spaces; `--` to a null sentinel.
5. Re-join continuation lines. A line continues the previous one unless it starts a known
   section heading, a bullet, or matches an entry pattern (`Name:` / `Name +dN`). This is what
   repairs Dialect A's split `GROUND MOVEMENT: 30ft | AERIAL` / `MOVEMENT: 60ft`.

### 3.2 Header fields

| Printed | IR / target |
|---|---|
| `THREAT LEVEL: n` | `system.threatLevel` |
| `SIZE: <label>` | `system.size` via label-to-key map |
| `HEALTH: n` | see §4.2 |
| `GROUND MOVEMENT:` / `MOVEMENT: 45ft Ground; 35ft Aerial` | `system.movement.<type>.base` |
| `STRENGTH/SPEED/SMARTS/SOCIAL` | `system.essences.<e>.max` **and** `.value` |
| `TOUGHNESS/EVASION/WILLPOWER/CLEVERNESS` | see §4.1 |

Size labels need an explicit map, because two keys don't match their printed names:
`Extended II` to `extended2`, `Extended III` to `extended3`. Everything else lowercases cleanly
against `E20.actorSizes`.

### 3.3 Skills

Patterns, in one alternation:

```
Alertness (Insight) +d4*      ->  Name (Spec) +dN*
Might: +d4                    ->  Name: +dN
Conditioning +3               ->  system.conditioning
Languages: English, Putty     ->  system.languages
```

- `+dN` becomes `shift` (`d4`, `d6`, ...), validated against `E20.skillShifts`. Absent means
  `d20`.
- Trailing `*` means `isSpecialized: true`.
- The parenthetical becomes an entry in `system.skills.<skill>.specializations`, keyed via
  `slugifySpecializationName()` (helpers/utils.mjs), with `granted: true`.
- Every parsed skill sets `isChosen: true`, which is what makes it visible on the NPC sheet
  (see `base-actor-sheet.mjs#_prepareChosenNpcSkills`).

**Known alias problem.** The PR CRB prints `Melee (Unarmed Combat)`, but `E20.skills` has no
`melee` — the CRB is using a category label where FMMC correctly prints `Might (Brawling)`.
Two-part fix:

1. A small explicit alias table, with `melee -> might` as the first entry.
2. A cross-check pass: attack lines name their own skill in parentheses
   (`Unarmed Combat (Might): +d6*`), so an unmapped skill line whose name matches an attack's
   *name* can adopt that attack's *skill*. Anything still unresolved becomes a diagnostic with
   a dropdown in the UI, never a silent drop.

### 3.4 Attacks become Weapon + WeaponEffect pairs

An attack is **two** documents in this system: a `weapon` Item, and one or more child
`weaponEffect` Items registered into the parent's `system.items` map with
`flags.essence20.parentId` / `collectionId` (see `sheet-handlers/attachment-handler.mjs`'s
`createEntry` / `setEntryAndAddItem`, and `documents/actor.mjs#_preUpdate`, which walks exactly
that structure when Size changes).

| Printed fragment | `weaponEffect` field |
|---|---|
| `(Targeting)` | `classification.skill` |
| `+d6` / `*` | parent weapon's requirement + `isSpecialized` |
| `Reach` / `Reach x2` | `range.reachMultiplier` (null / 2) |
| `Range 30ft/60ft` | `range.value` / `range.long` |
| `; min 30ft` | `range.min` |
| `(1 Blunt damage)` | `damageValue` / `damageType` |
| `Blast: 20ft radius` | `radius: 20, shape: 'burst'` |
| `Blast: 15ft cone` | `radius: 15, shape: 'cone'` |
| `Hands: 1` | `numHands` |
| `Traits: Energy, Magical` | parent weapon's `system.traits` |
| `Alternate Effects: 2 Energy damage` | a **second** `weaponEffect` on the same weapon |
| `against the Evasion Defense` (in Powers text) | `defenseType` |

`damageType` and `traits` map against `E20.damageTypes` / `E20.weaponTraits` by slugified name.
Unknown values (`Reload`, `Magical`, `Silent` are all real and all need checking against the
config) become diagnostics with a "map to..." picker.

`style` (`melee`/`energy`/`explosive`/`projectile`) is inferred: `Reach` means melee, a `Range`
plus an energy-ish damage type means energy, `Blast` means explosive, otherwise projectile.
Inference is always shown in the preview and always overridable.

### 3.5 Perks / Powers / Hang-Ups

`Name: body text`, the body continuing until the next such pattern or section. Items are
created as `perk`, `power` (`system.type: 'threat'`, which exists in `E20.powerTypes`), and
`hangUp`.

Powers additionally parse the parenthetical: `(2/scene, Standard)` / `(1/scene; Standard)` /
`(Special)` into `usesPer: 2`, `usesInterval: 'perScene'`, `actionType: 'standard'` against
`E20.actionTypes` (`free`, `move`, `standard`, `standardAndMove`, `fullAction`, `wholeTurn`,
...).

**Copyright boundary.** Body text goes into the `description` of an Item **in the GM's own
world**, from text the GM pasted out of a book they own. That is categorically different from
the project's standing rule against pasting book text into *shipped compendium* items. The
importer must therefore hard-refuse to write into a compendium pack — world documents only,
enforced in the builder, not left to convention.

---

## 4. Builder: reconciling printed stats against derived stats

This is where an importer that "just sets the fields" would produce wrong actors. The system
**derives** Health and Defenses; you cannot write the printed number into them.

### 4.1 Defenses

`documents/actor.mjs#_prepareDefenses`:

```
total = base(10) + essences[e].max + bonus + rolePoints + perkBonus + (morphed|armor) + shield
```

So the importer computes the residual:

```
system.defenses.<t>.bonus = printed - 10 - essence
```

Verified against real blocks: Polluticorn STR 6 gives Toughness 16 = 10+6, bonus 0. Goldar
(Grown) STR 14 gives Toughness 30 = 10+14+6, where the 6 is his Golden Plate Mail — so if the
`EQUIPMENT` section yields `Armor: ... (+6 deflective to Toughness)`, that 6 goes to `.armor`
and comes out of the residual. A negative residual means the parse is wrong somewhere: emit a
diagnostic, don't write.

`.bonus` is explicitly the GM's manual catch-all (see the doc comment in `_prepareDefenses` and
`apps/stat-editor.mjs`), so an importer writing there is using it exactly as intended — unlike
runtime Perk code, which must not.

### 4.2 Health

`_prepareHealth`: `max = origin + rolePoints + conditioning + bonus`. For non-PC types,
`system.health.origin` is the flat "starting Health" field. The printed HEALTH **includes**
Conditioning — confirmed by Polluticorn: Normal is TL7 / Health 7 with no Conditioning; Grown
is TL10 / Health 13 with `Conditioning +3`, i.e. 7 + 3 (TL) + 3 (Conditioning). So:

```
system.health.origin = printedHealth - parsedConditioning
system.health.value  = printedHealth
```

### 4.3 Token size at creation

`_preUpdate` resizes tokens when `system.size` *changes*, but `_preCreate` does **not** set
width/height from Size at all. A freshly created Gigantic Threat would get a 1x1 token. The
builder must set `prototypeToken.width/height` explicitly from `CONFIG.E20.tokenSizes[size]`.
(Worth a follow-up issue on its own — this affects every hand-made actor too.)

### 4.4 Compendium matching — the highest-value decision

Before creating a bare Item for a named Perk/Power/weapon, search enabled Item packs
(reuse `helpers/compendium-browser.mjs#getVisibleItemPacks`, which respects the GM's sourcebook
setting) for a name match, preferring packs in the detected game line's folder.

On a hit, create via `game.items.fromCompendium(source)` — the same idiom
`documents/actor.mjs#_preCreate` already uses for auto-added Zord Features, chosen there
specifically because it preserves **Active Effects** and **`_stats.compendiumSource`**.

That matters enormously here: `compendiumSource` is the provenance every `actorHasPerk` and
sourceId check in this codebase matches on. A Threat imported with matched compendium Perks
gets the system's existing automation — reroll grants, modifier sources, defense bonuses — for
free. An importer that built bare items instead would produce actors that look right and do
nothing.

Fallback on no match: a bare world Item carrying the parsed name and text, flagged in the
preview as unmatched.

### 4.5 Provenance flag

Store both the raw pasted text and the final IR on the created actor:
`flags.essence20.statBlockSource = { raw, ir, importedAt, version }`. This enables re-parsing
after a parser fix, an "export stat block" reverse path, and — critically — Grow.

---

## 5. UI

`Essence20StatBlockImporter extends serializeFormSubmits(HandlebarsApplicationMixin(ApplicationV2))`,
following `apps/skill-picker.mjs` exactly (same mixin stack, `classes: ["essence20", "sheet",
"theme-wrapper", "stat-block-importer"]`, `applyThemeClass`).

Two panes:

- **Left**: paste textarea; actor-type select (`npc` / `vehicle` / `zord`); game-line select
  (biases compendium matching); a "detected: Power Rangers CRB" readout.
- **Right**: live parse preview — a section-by-section tree with every field editable inline,
  unmatched or uncertain fields highlighted, and the diagnostics list at the bottom.
  `submitOnChange: true, closeOnSubmit: false` so the preview stays live as the paste is
  edited (same rationale as SkillPicker's live Essence tally).
- **Footer**: target folder picker; `Import` (disabled while any `error`-severity diagnostic is
  unresolved) and `Import anyway`.

Entry point: a footer button on the Actors directory via a `renderActorDirectory` hook,
mirroring `essence20.mjs#addCompendiumBrowserFooterButton` one-for-one. GM-only.
(Note the Actors sidebar is already customized — see the `Essence20ActorDirectory` work on the
Hardpoints/Party branch — so check for interaction there before wiring the hook.)

**Batch mode**: split the paste on `THREAT LEVEL:` boundaries and import N actors into a folder
in one pass. Cheap once single-block import works, and it is how you would actually populate a
campaign.

---

## 6. Make My Monster Grow

### 6.1 What exists today

- `helpers/monster-grow.mjs` — the FMMC Sorcerous Power "Monster... Grow!". Toggles the
  target's `system.size` to `gigantic` and back, saving the original. **Nothing else.**
- `helpers/monster-morph.mjs` — the Psycho Path `Monster Morph` and its 10th-level `Grow!`;
  size plus flat Health/Toughness/Evasion/damage riders, for a *player* character.

One correction to make to `monster-grow.mjs` along the way: its doc comment claims "the actual
VISUAL token-scale change on the canvas is NOT built — this codebase has no precedent
anywhere." That is now wrong. `documents/actor.mjs#_preUpdate` calls
`resizeTokens(actor, width, height)` on every Size change, so the existing toggle **already**
resizes tokens. Fix the comment rather than leaving it to mislead the next reader.

### 6.2 The rules

Finster's Monster-Matic Cookbook, "Step 8: Does It Grow?" (p. 18-19) gives an explicit
construction algorithm. Paraphrased:

- New Threat Level is **+2 to +4** over Normal.
- Size becomes a larger class, "often anywhere between Gigantic and Titanic."
- **Health** increases by the TL increase.
- **Movement** (every type) increases by the gain in natural Reach for the new Size.
- **Essences** increase by twice the TL increase, distributed.
- **Skills** gain ranks equal to the applicable Essence increases, favouring attack skills.
- **Ranges** x1.5 (round to nearest 5 ft) at +2/+3 TL; x2 at +4 TL.
- **Damage** x2 at +2/+3 TL; x3 at +4 TL.
- Perks / Powers / Hang-Ups: replace anything requiring the Normal size or form.

### 6.3 The published blocks do not obey the published algorithm

Checked against Polluticorn (PR CRB p.216 to p.217, TL 7 to 10, i.e. +3):

| Quantity | Algorithm predicts | Book prints | Match |
|---|---|---|---|
| Essence total | +6 (2x3) | 20 to 26 | yes |
| Health | +3 | 7 to 13 (10 + Conditioning 3) | yes |
| Defenses | derived from Essences | 16/16/13/15 to 20/18/13/15 | yes |
| Damage | x2 | 1 to 2 | yes |
| Ranges | x1.5, i.e. 45ft/90ft | **60ft/120ft** (x2) | **no** |
| AoE | x1.5, i.e. 30ft | **40ft** (x2) | **no** |
| Movement | +10ft (Reach 5 to 15) | **unchanged** 30/60 | **no** |

So the generator is a **starting point the GM edits**, never an oracle. Two consequences: the
range multiplier must be a GM-visible, per-run choice (x1.5 / x2 / custom), and the unit tests
assert *the documented rule*, with the Polluticorn deviations kept as fixtures proving the
GM-override path works — not as expected outputs.

The Defenses row is the happy one. Because this system derives Defenses from Essences, growing
the Essences reproduces the printed Defenses automatically with no extra work; only the
`.bonus` residual carries across.

### 6.4 Design: a Grown-form generator, not an Active Effect

`module/helpers/monster-grow-generator.mjs`, pure:

```js
computeGrownStatBlock(ir, {
  tlIncrease = 3,              // 2..4
  newSize = 'gigantic',
  rangeMultiplier = 2,         // 1.5 per RAW, 2 per the published blocks
  damageMultiplier = 2,
  essenceAllocation,           // {strength, speed, smarts, social}, sums to 2*tlIncrease
  skillAllocation,             // which skills absorb the shifts
  growMovement = true,
}) -> ir
```

Deliberately **not** Active Effects. AEs cannot multiply damage on nested `weaponEffect` items,
cannot do "add N shifts" arithmetic on a string enum like `system.skills.<s>.shift`, and cannot
swap out Perks whose text no longer applies. And the books themselves treat Grown as a separate
stat block with *different content*, not a modified one — Goldar (Grown) has Perks his Normal
form doesn't. A generated sibling Actor is inspectable, hand-editable and shareable; a stack of
AEs is none of those.

### 6.5 Three delivery modes over one core

**A. "Grow" button on the NPC sheet header** (GM-only). Opens a dialog showing the algorithm's
proposal with every knob editable: TL delta, target Size, a per-Essence allocation grid, which
skills absorb the shifts, range and damage multipliers, and a checklist of Perks/Powers/Hang-Ups
to keep, edit or drop. Creates a **new Actor** named `<Name> (Grown)` and cross-links the pair
via `flags.essence20.grownFormId` / `normalFormId`. This is exactly how the books model it.

**B. In-combat swap.** A "Make My Monster Grow" control (sheet header and/or token HUD) that
swaps a placed token to the linked Grown actor in place: same position, same disposition, token
dimensions from the new Size. A setting controls damage carry-over — Heximas's own stat block
says he "carries any damage suffered from his Grown size," so both behaviours are canon; default
to carrying proportional damage with a toggle for full-heal-on-grow.

*This is the one genuinely uncertain piece and needs a spike before committing.* Repointing an
existing `TokenDocument` at a different `actorId` interacts with `delta` / unlinked-token state
in ways worth verifying live in v14 rather than reasoning about. Fallback if it proves ugly:
delete and re-create the token at the same coordinates in one transaction, preserving
combat-tracker position by updating the `Combatant`'s `tokenId`.

**C. Upgrade the existing Power.** `helpers/monster-grow.mjs#toggleMonsterGrow` gains one
branch: if the target has a linked Grown form, do the mode-B swap; otherwise fall back to
today's size-only toggle. Existing behaviour is preserved for any Threat nobody has generated a
Grown form for, and the Power's existing tests keep passing.

### 6.6 Shared core with the importer

```
text  --parse-->  IR  --build-->  Actor                    (importer)
Actor --read-->   IR  --grow-->   IR  --build-->  Actor    (grow)
```

Grow needs one function the importer doesn't: `actorToIr(actor)`. Prefer
`flags.essence20.statBlockSource.ir` when present (lossless), fall back to reading the live
document (which also works for hand-built actors). `actorToIr` additionally gives "export this
Threat as a text stat block" for free — a genuinely useful third feature for sharing homebrew.

---

## 7. Phasing

| Phase | Deliverable | Gate |
|---|---|---|
| 1 | ✅ **Done** 2026-09-16 — `helpers/stat-block-parser.mjs` + 41 tests | all three dialects green, and three real book blocks parse with only legitimate diagnostics |
| 2 | ✅ **Done** 2026-09-16 — `helpers/stat-block-import.mjs` + 38 tests | four real printed blocks reproduce every printed Defense and Health exactly |
| 3 | ✅ **Done** 2026-09-16 — `apps/stat-block-importer.mjs`, hbs, scss, 28 lang keys, directory button | live-tested in Foundry v14.364: a real pasted block imported to a correct sheet |
| 4 | ✅ **Done** 2026-09-16 — `helpers/stat-block-match.mjs` + 19 tests | proved live: a matched Perk's Active Effect actually applied to the imported actor |
| 5 | ✅ **Done** 2026-09-16 — `helpers/monster-grow-generator.mjs` + `actorToIr` + 50 tests | the real printed Normal block grows to **26/26** exact against the real printed Grown block |
| 6 | ✅ **Done** 2026-09-16 — `apps/monster-grow-dialog.mjs` + sheet header control | live: drove the dialog to the published block's choices and created a Grown actor matching it on every field |
| 7 | ✅ **Done** 2026-09-16 — spike resolved, `helpers/monster-grow-swap.mjs` + 21 tests, modes B and C | a placed token swapped both ways on real documents, damage and Combatant following |
| 8 | ✅ **Done** 2026-09-16 — batch import, vehicle/Zord types, `helpers/stat-block-export.mjs` + 26 tests | live: two real blocks imported in one pass, a real vehicle imported, and a Grow-built actor round-tripped through text |

Phases 1-2 are useful on their own. Phase 5 is useful the moment Phase 2 exists.

---

## 8. Risks and open questions

1. **Token swap (mode B)** — needs a live spike in Foundry v14. Everything else is ordinary
   document work. In v14 `TokenDocument#actorId` is a `ForeignDocumentField({idOnly: true})`
   and the `delta` (ActorDelta) is rebuilt around `actorLink` in `_preCreate`/`_initialize`
   (`common/documents/token.mjs`, lines ~250 and ~1030-1055) — repointing `actorId` on an
   **unlinked** token is precisely where that reconciliation happens, which is what the spike
   has to establish.
2. **Skill aliases** — `Melee` is the known case; a full pass over every Threat block across
   the five game lines will likely surface a handful more. The alias table plus the attack-line
   cross-check plus a UI dropdown should cover it, but budget for iteration.
3. **`E20.perkTypes` has no `threat` value** (`E20.powerTypes` does). Either add one, or import
   Threat Perks as `general` and accept the mislabel. Adding a key is a schema change with
   migration implications — decide before Phase 2.
4. **Copyright** — enforce world-only writes in the builder (§3.5). No parsed book text ever
   reaches a compendium pack.
5. **Coverage gate** — both new helper files sit inside `collectCoverageFrom`. Untested helpers
   drag the floor down and fail CI quietly. Run jest directly on Windows:
   `node --experimental-vm-modules ./node_modules/.bin/jest`.
6. **Test fixtures** — use *synthesized* stat blocks in the format rather than verbatim book
   text, so the repo doesn't carry pasted rulebook content. Format fidelity is what's under
   test, not any specific monster.
7. **Branch** — `Vehicles-Zords-Megaforms` is live and shared; re-check git state before
   starting, and do not target `Beta-v6.0`.

---

## 9. Foundry v14 verification pass

Every API this plan leans on was checked against the local **v14 build 364** source, not
inferred from v13.

| API this plan uses | v14 status |
|---|---|
| `foundry.applications.api.ApplicationV2` + `HandlebarsApplicationMixin` | present; v14 also exports the same class as `Application`, with `ApplicationV2` kept as an alias |
| `foundry.documents.collections.Actors.registerSheet` | present (`client/documents/abstract/world-collection.mjs:156`), forwards to `DocumentSheetConfig.registerSheet` |
| `renderActorDirectory` hook | valid — the class is still `ActorDirectory` (`client/applications/sidebar/tabs/actor-directory.mjs:11`), unchanged from v13 |
| `game.items.fromCompendium()` | present on `WorldCollection` |
| `foundry.abstract.TypeDataModel` | present (`common/abstract/type-data.mjs:81`) |
| `foundry.data.fields` schema classes | unchanged |
| `TokenDocument#actorId` / `delta` | present; see §8 risk 1 — the one thing needing a live spike |

**No v14 blockers for this feature.** The importer is additive application + document code,
which is the most stable part of the v14 surface.

### The manifest

`system.json` on this branch still declares `compatibility: { minimum: "13", verified: "13" }`,
which produces an incompatibility warning under v14 and blocks nothing else. It was bumped to
`{ minimum: "14", verified: "14" }` on the `Tours` branch (2026-09-16, at the user's direction)
and will arrive here when the branches merge — **no action needed on this branch**, and nothing
in this feature should guard a v13 code path.

Two v14 notes worth carrying into any new code written here:

- Prefer `foundry.applications.*` namespaced access over bare globals. v14 keeps an `appv1`
  compatibility layer, but nothing new should reach into it.
- `ApplicationV2` is being renamed to `Application` in v14's exports. Keep using
  `ApplicationV2` for consistency with the 20 existing apps in `module/apps/`, and change
  all of them together later if ever — not one new file out of step with the rest.

---

## 10. Phase 1 results (2026-09-16)

`module/helpers/stat-block-parser.mjs` + `stat-block-parser.test.js` are in. 41 parser tests
green; full suite 5247 tests / 265 suites green; both files lint clean.

Validated against **real extracted book text**, not only the synthesized fixtures:

| Real block | Result |
|---|---|
| Polluticorn (Normal), PR CRB p.216 | **zero diagnostics** — all 9 skills, 2 Perks, 2 Powers, 1 Hang-Up, 2 attacks, split MOVEMENT label |
| Goldar (Grown), Finster's Cookbook p.106 | 4 attacks with reach multipliers/alternate effects/hands/traits; 3 diagnostics, all legitimate |
| A.P.C., G.I. JOE CRB p.174 | `--` Essences null, `Reach (Toughness, 2 Blunt Damage)`; 1 diagnostic, legitimate |

Aliases **confirmed by evidence** rather than guessed:

- `Energy damage` → `element`. `E20.DamageElement`'s own en.json label is literally
  "Element/Energy", and `element` is the second most-used damageType across the shipped packs
  (375 weaponEffects). Not a config gap.
- `Melee` → `might` (the CRB's category label). The attack cross-check of §3.3 is built and
  tested separately, for labels the alias table doesn't know.
- A vehicle attack's printed `Traits:` line mixes `E20.weaponTraits` **and** `E20.vehicleTraits`
  — "Drive-By" only exists in the latter. The trait lookup now spans both.

Two **real content gaps** the parser surfaces rather than papering over:

1. **"Magical" is not a weapon trait anywhere** in `E20.weaponTraits`, `E20.vehicleTraits`,
   `E20.armorTraits` or `en.json`, yet Finster's Cookbook prints it on multiple attacks.
   Either it needs adding to the config or an alias onto an existing key — a content decision,
   not a parser one.
2. **`(Special)` has no `E20.actionTypes` equivalent**, and is printed as a Power's action
   ("Forced Morph (Special)"). Currently recorded as an `info` diagnostic with `actionType`
   left null.

---

## 11. Phase 2 results (2026-09-16)

`module/helpers/stat-block-import.mjs` + `stat-block-import.test.js` are in. 38 builder tests
green; full suite 5285 tests / 266 suites green; all four new files lint clean.

The gate was "a Polluticorn paste produces a correct sheet". Checked harder than that: four real
printed blocks were parsed, built, and then run back through the system's own derivation formulas
(`total = 10 + essence.max + bonus + armor`, `max = origin + conditioning + bonus`) to confirm the
sheet would display exactly what the book prints.

| Real block | Result |
|---|---|
| Polluticorn (Normal) | 4/4 Defenses + Health exact; Large → 2x2 token |
| Polluticorn (grown) | 4/4 + Health exact (13 = 10 origin + 3 Conditioning); Gigantic → 4x4 |
| Goldar (Grown) | 4/4 + Health exact — Toughness 30 via `.armor` 6 read out of the EQUIPMENT line, bonus 0; Towering → 5x5 |
| A.P.C. | 2/2 + Health exact — Toughness 15 needed a +1 residual, correctly absorbing the "+1 plating" printed in its PERKS rather than EQUIPMENT; Extended → 4x2 |

Design notes worth carrying forward:

- **The `.armor` / `.bonus` split works out of real data.** Armour named in EQUIPMENT with an
  explicit "+N … to \<Defense\>" goes to `.armor`; anything else the block grants implicitly falls
  into the `.bonus` residual. Goldar and the A.P.C. exercise both halves.
- **`isReach` was added to the parser's effect clause.** A plain "Reach" and "Reach x2" are both
  melee, but a `reachMultiplier` of null is also what a non-Reach attack has — the builder needs
  to tell those apart to infer `classification.style`.
- **`setEntryAndAddItem` is imported dynamically** inside `createActorFromStatBlock`, not at module
  scope. `attachment-handler.mjs` pulls in `apps/choices-selector.mjs`, which reads the `foundry`
  global at load — a static import would make the pure half of the builder unloadable outside a
  live client, defeating the point of the split.
- **The copyright guard is real code, not a convention**: `createActorFromStatBlock` throws on a
  `pack` option before touching anything, and that is under test.

Still unbuilt from §4: compendium matching (§4.4) is Phase 4, so Perks/Powers are created as bare
world Items for now. The `createActorFromStatBlock` orchestrator itself has had no live Foundry
run yet — only its pure inputs are tested.

---

## 12. Phase 3 results (2026-09-16)

`module/apps/stat-block-importer.mjs`, `templates/app/stat-block-importer.hbs`,
`sass/views/_stat-block-importer.scss`, 28 `E20.StatBlockImport*` lang keys, and a
`renderActorDirectory` footer button in `essence20.mjs`.

**Live-tested in Foundry v14.364** on the `foundrydata-importer` instance (port 30001), as the
GM user, by pasting a real Polluticorn (Normal) block *with its PDF artifacts left in* — running
header, download watermark, the split `GROUND MOVEMENT: 30ft | AERIAL` / `MOVEMENT: 60ft` label
and wrapped attack lines:

- Preview parsed it to zero diagnostics and enabled the Import button.
- The created `npc` reproduced every printed number on its actual sheet: Toughness 16, Evasion 16,
  Willpower 13, Cleverness 15, Health 7/7, Ground 30 / Aerial 60, Threat Level 7, Size Large,
  prototype token 2x2.
- **The weapon/weaponEffect nesting works**, which Phase 2 could only assert by construction: each
  weaponEffect carries `flags.essence20.parentId` plus a `collectionId` that matches a real key in
  its weapon's `system.items`, and `totalReach` computed to 5 — i.e. `prepareDerivedData` resolved
  the effect's actor parent, so the structure is genuinely equivalent to a hand-dropped attack.
- Skills, specializations (`might` at d6 with an "Unarmed Combat" specialization) and the
  `statBlockSource` provenance flag all landed.

One real bug the live test caught that no unit test could: **ApplicationV2 requires each PART to
render exactly one root element**, and the template had a `<div>` and a `<footer>` side by side,
so the app failed to render at all. Fixed with a single `.stat-block-importer-root` wrapper.

**Deliberately not built in this phase** (the plan's §5 describes them, they remain open):

- Per-field inline editing of the preview. The textarea is the correction surface instead —
  editing the paste re-parses live, which handles most bad parses. Field-level overrides and
  "map this unknown trait to…" dropdowns for diagnostics are still to do.
- Batch import of several blocks at once, and vehicle/zord actor types — both Phase 8. The type
  selector exists but currently offers only `npc`.

Two pre-existing problems observed in passing, neither caused by this work: the dev world logs two
`Failed to initialize Actor … "party" is not a valid type` errors (leftover `party` actors from the
uncommitted Hardpoints/Party work, whose DataModel isn't registered on this branch), and
`sass` emits a `lighten()` deprecation warning from `_story-points.scss:83`, which carries its own
`// TODO: needs to use variable`.

---

## 13. Phase 4 results (2026-09-16)

`module/helpers/stat-block-match.mjs` + `stat-block-match.test.js` (19 tests), plus
`applyCompendiumMatches` in the builder, a game-line selector in the app, and per-entry match
labels in the preview. Full suite 5309 tests / 267 suites green; lint clean.

**Proved live**, which is the only proof that counts for this phase. Importing a Threat whose
Perks match real compendium entries produced items carrying `_stats.compendiumSource` and their
Active Effects — and the effect *applied*: a matched "Never Back Down" (whose effect is
`system.health.bonus add 2`) turned a printed Health of 4 into a derived Health of 6 on the
imported actor. That is the difference between an inert item and working automation.

Also verified against the live packs (2425 matchable entries: 2153 Perks, 169 Hang-Ups,
103 Powers, across all five game-line folders):

- **Game-line preference works.** "Danger Sense" exists in both *Across the Stars* (Power Rangers)
  and the *GI Joe Core Rulebook*; selecting each line picks the right one and clears the ambiguity
  flag, while "Any game line" picks deterministically and marks it `(2 matches)`.
- **Type-awareness works.** The Polluticorn's "Weak Point" is a Hang-Up in the stat block and a
  Perk in the compendium — correctly left unmatched rather than cross-matched.
- **Threat-only content correctly finds nothing.** "Powerful Leap" and "Super Strike" exist only
  inside their own stat block, so they are created as new items, as they should be.
- Matched items keep the pasted description when the compendium entry has none — which is the
  normal case, since the shipped packs omit descriptions for copyright reasons.

### The double-counting problem (real, surfaced, not solved)

A printed stat block's Defenses, Health and shifts **already include that Threat's own Perks** —
the book did the arithmetic. A matched Perk whose Active Effect ADDs to the same field therefore
applies a bonus that is already in the printed number, and the imported actor comes out stronger
than the page says. The Health 4 → 6 result above is exactly this, not a bug in the matcher.

Phase 4 surfaces it rather than hiding it: the preview shows a caution naming how many matched
items carry Active Effects. Fixing it properly means subtracting an effect's contribution from
the residual `.bonus` the builder computes (§4.1), which needs the effects resolved and evaluated
at preview time — a bigger job, and arguably one the GM should arbitrate per import.

### Scope decision: attacks are not matched

Perks, Powers and Hang-Ups only. A printed block's own damage/range numbers are authoritative for
that Threat (a Grown form's attack is not the compendium's weapon), and a compendium weapon's
nested weaponEffects are referenced by uuid rather than embedded, so reconstructing one is a
different job from copying a Perk. Weapons keep being built from the printed numbers.

### Environment note that cost real time

**A fresh git worktree has no compiled compendium packs.** Only `packs/*/_source/*.json` is
tracked; the LevelDB databases are generated and gitignored. Worse, starting Foundry against a
worktree *creates empty* LevelDB databases in those folders, which then makes `npm run build:db`
fail with `Iterator is not open: cannot call all() after close()`. The fix: stop Foundry, delete
the generated files (everything under `packs/*/` that is not in `_source/`), then run
`npm run build:db`. Until that is done every compendium in that worktree silently indexes as
empty — which looks exactly like a broken matcher.

---

## 14. Phase 5 results (2026-09-16)

`module/helpers/monster-grow-generator.mjs` (pure, 42 tests) and `actorToIr` in the builder
(8 more). Full suite 5358 tests / 268 suites green; lint clean.

**The gate, measured against real printed pages.** Both Polluticorn blocks were parsed out of the
PR CRB (p.216 and p.217), the Normal one grown, and the result diffed field by field against the
printed Grown one — Threat Level, Size, Health, Conditioning, all four Essences, all four
Defenses, both Movement types, all eight skill shifts, and both attacks' damage and ranges:

| Run | Result |
|---|---|
| RAW defaults (the book's stated algorithm) | 16/26 |
| With the published block's own choices supplied as options | **26/26 exact** |

The ten RAW-default differences are precisely the deviations §6.3 documented, and nothing else:
the extra Conditioning (and the Health it brings), the 4/2 vs 3/3 Essence split, the unchanged
Movement, and the doubled ranges. That is the intended result — **the generator implements the
rule, and every published deviation is reachable through an option**, which is what makes it a
starting point a GM edits rather than an oracle.

Two defaults worth recording, both derived from the rules text rather than invented:

- **Essence points go to the Essences behind the Threat's own attacks.** The book says a Grown
  form is "generally focused on a tougher combat scene". Polluticorn attacks with Might (Strength)
  and Targeting (Speed) — exactly the two Essences its printed Grown form gains. The generator
  splits 3/3 where the book chose 4/2; that is a taste call for the dialog.
- **Only attack skills plus Initiative are shifted.** RAW reads as "every skill under a grown
  Essence", but the printed block shifts Might, Targeting and Initiative while leaving its other
  four Speed/Smarts skills alone. The narrower reading reproduces the page exactly.

`review` is the "remove or alter anything requiring the Normal form" clause, as a checklist rather
than a silent rewrite. On Polluticorn it correctly flags **Powerful Leap**, whose text names 40ft:
RAW says to scale Perk ranges, the printed Grown block doesn't, so the generator leaves it and says
so. Power text *is* scaled (the printed block doubles both of Polluticorn's Power areas).

`actorToIr` prefers the lossless `statBlockSource` flag and otherwise re-reads the document, so it
works on hand-built actors too. Reading it is the exact inverse of `buildActorData`:
`defenses.<d>.total` and `health.max` are already the printed numbers, so neither reconciliation
has to be undone.

Still unbuilt: the Grow dialog (Phase 6), the token-swap spike and modes B/C (Phase 7). The
generator has no UI yet — it is reachable only from code.

---

## 15. Phase 6 results (2026-09-16)

`module/apps/monster-grow-dialog.mjs`, `templates/app/monster-grow-dialog.hbs`,
`sass/views/_monster-grow-dialog.scss`, 20 `E20.MonsterGrow*` lang keys, and a `growMonster`
header control on the base actor sheet (GM-only, npc-only) following the existing `sheetOptions`
control's own shape exactly. Suite 5358 / 268 green; lint clean.

**Live-tested in Foundry v14.** Opened on the imported Polluticorn, driven through the UI to the
published Grown block's own choices (ranges x2, Movement growth off, +3 Conditioning, Essences
split 4/2), and the preview tracked every change live. Creating from it produced an Actor matching
the printed Grown Polluticorn on every field checked:

| | Printed | Created |
|---|---|---|
| Threat Level / Size / token | 10 / Gigantic | 10 / gigantic / 4x4 |
| Health (Conditioning) | 13 (+3) | 13 (+3) |
| Defenses | 20 / 18 / 13 / 15 | 20 / 18 / 13 / 15 |
| Essences | 10 / 8 / 3 / 5 | 10 / 8 / 3 / 5 |
| Movement | 30 / 60 | 30 / 60 |
| Attacks | 2 Blunt Reach, 2 Energy 60/120ft | 2 blunt reach, 2 element 60/120ft |
| Skill shifts | Might d8, Targeting d6, Initiative d6 | same, others unchanged |

Both cross-link flags were written (`grownFormId` on the Normal form, `normalFormId` on the
Grown one) — Phase 7's in-combat swap reads exactly those. The Grown actor's weaponEffects came
out with `totalReach` 15, recomputed from the new Gigantic Size, which confirms the nested
weapon structure survives being rebuilt through `createActorFromStatBlock`.

The dialog reuses the importer's whole pipeline: `actorToIr` reads the Normal form,
`computeGrownStatBlock` transforms it, and `createActorFromStatBlock` writes it. No second
document-creation path exists.

**A v14 UI note:** sheet header controls no longer sit directly in the window header — they live
in a controls dropdown that only materializes in the DOM when opened. `_getHeaderControls()`
confirms `growMonster` is registered beside the pre-existing `sheetOptions`, and the dialog was
driven directly for the live test. Worth knowing before hunting for a missing button in the DOM.

Still open: the token-swap spike and modes B/C (Phase 7), and batch import / vehicle types
(Phase 8).

---

## 16. Phase 7 results (2026-09-16)

`module/helpers/monster-grow-swap.mjs` + 21 tests, a `renderTokenHUD` button (mode B), a new branch
in `helpers/monster-grow.mjs` (mode C), and a `monsterGrowHealthMode` world setting. Suite 5379 /
269 green; new files lint clean.

### The spike, resolved — and it resolved well

This was §8 risk 1, the one genuinely uncertain piece. Answered by experiment in live v14.364:

1. **`TokenDocument#update({actorId})` works directly on an unlinked token.** No delete-and-recreate
   is needed; the whole swap fits in ONE atomic update, so there is never a half-swapped frame.
   The fallback plan (delete and re-create at the same coordinates) is not needed and is dropped.
2. **The ActorDelta is merged, not replaced.** Passing an empty `delta` does *not* clear it, so
   carried-over Health is written explicitly via `delta.system.health.value` rather than by hoping
   whatever is already in the delta happens to be right.
3. **Token dimensions do not follow a repointed `actorId`.** `_preUpdate` resizes tokens when an
   *actor's* Size changes; here the actor doesn't change, the token is repointed at a different
   one — so width/height are set from the target's Size explicitly.
4. **A Combatant survives, but its `actorId` goes stale**, which silently breaks
   `Combat#getCombatantsByActor` — measured: 0 matches before updating it, 1 after. The swap
   updates the Combatant too.

### Verified on real documents

| | Before | After |
|---|---|---|
| Grow | Large, 2x2, 3/7 | Gigantic, 4x4, 6/13 |
| Shrink (same token, back) | Gigantic, 4x4, 6/13 | Large, 2x2, 3/7 |

Health carry-over defaults to **proportional** — a Threat worn to 3/7 grows into 6/13 rather than
getting a fresh health bar. `absolute` (the shape Heximas's own stat block describes) and `full`
are settings. A standing Threat can never be rounded down to 0 by growing.

Mode C was exercised through `activateMonsterGrow` itself on real documents: a **linked** Threat
swaps forms, an **unlinked** one falls back to the original Size-only toggle unchanged, and no
target returns null. So every Threat nobody has built a Grown form for behaves exactly as before.

### Not verified live

**The canvas cannot be initialized in this headless browser pane** (PIXI fails with
`Impossible to create a PIXI plugin for OccludableSamplerShader`). Two consequences:

- The **token HUD button was never clicked**. The `renderTokenHUD` hook is registered and its
  predicate (`canSwapTokenForm`) was verified true for a linked Threat and false for an unlinked
  one, but the button itself needs a click-through with a drawn canvas.
- The mode C fallback's *token* resize could not be observed, because `resizeTokens` works through
  `actor.getActiveTokens()`, which is empty without a drawn canvas. The actor's Size changed
  correctly. This is pre-existing behaviour, not something this phase changed.

A correction recorded in `helpers/monster-grow.mjs`: its own doc comment used to claim the
Size-only toggle had no visual effect on the canvas because "this codebase has no precedent for a
Perk/Power resizing a token". That was wrong — `_preUpdate` has always called `resizeTokens()` on
every Size change.

---

## 17. Phase 8 results (2026-09-16)

`splitStatBlocks` in the parser, batch handling in the app, machine-type support in the builder,
and `module/helpers/stat-block-export.mjs` + 26 tests. Suite 5405 / 270 green; lint clean.

**Batch import needs no mode switch.** The paste is split on its own `THREAT LEVEL:` lines, every
block is parsed, the first is previewed, and Import creates all of them. A one-block paste is the
one-element case. Live: both printed Polluticorn blocks pasted together (watermark included) were
detected as *"2 stat blocks found: Polluticorn (Normal), Polluticorn (grown)"*, and importing
created both correctly — TL 7/10, Large/Gigantic, 2x2/4x4 tokens, Health 7/13, Toughness 16/20,
Might d6/d8.

**Vehicle and Zord types** write `essences.<e>` as `{value}` only, because
`data/actor/templates/machine.mjs` has no `.max` (`_prepareDefenses` already falls back to
`.value`, so Defense arithmetic is unchanged), and Zords skip `threatLevel`, which their data
model does not define. Live: the real G.I. JOE A.P.C. imported as a `vehicle` with Extended size,
a 4x2 token, `--` Essences left absent, Toughness 15 / Evasion 11, and its Blast attack.

> One thing that looks wrong and is not: the A.P.C.'s Ground Movement shows **22ft where the book
> prints 45ft**. `_prepareMovement` halves every movement type when a Vehicle has fewer qualified
> drivers than `crew.numDrivers` (the GI Joe CRB driver-count rule). The stored `base` is 45; the
> halving is correct system behaviour with no driver seated. A future pass could parse the printed
> `Crew: 1 driver, 25 passengers` line into `system.crew`, which is a real vehicle-specific gap.

**Export** renders an IR back to printed-style text, so any Threat — imported, grown, or hand-built
— can be shared as text and read back by this same importer. Live: a Grown Polluticorn that was
*built by the Grow dialog and never pasted as text* was read off the document with `actorToIr`,
exported, and re-parsed with **zero error diagnostics** and every Essence, Defense, skill and
attack preserved.

The round-trip test caught a real design flaw before it shipped: the exporter originally emitted
**localized** labels from `CONFIG.E20`, which would have produced text this system's own parser
could not read back on a non-English client. It now derives names from the config *keys*
(`animalHandling` → "Animal Handling"), so output is canonical English regardless of client
language. That is exactly what a round-trip test is for.

Known round-trip asymmetry: `actorToIr` reads `movement.<type>.total`, so derived Climb/Swim
speeds (the half-Ground default) appear in exported text where a printed block would omit them.
Harmless — re-importing writes them as explicit bases and the half-Ground floor still applies —
but it means an exported block is not byte-identical to the page it came from.

---

## 18. Follow-ups after review (2026-09-16)

**The token HUD button is verified.** The user clicked it in a real browser (Claude's own pane
reports `screen 0x0`, so PIXI can never build a framebuffer there and the canvas cannot draw —
the HUD is untestable from inside this app). Result, read back off the documents: the token went
Large 2x2 → Gigantic 4x4, Health **3/7 → 6/13** proportional, and the token now resolves to the
Grown actor. Phase 7 mode B is no longer an open item.

**Linking an actor that already exists** — `getLinkCandidates` / `linkGrownForm` /
`unlinkGrownForm` in `helpers/monster-grow-swap.mjs`, plus a mode switch in the Grow dialog.

This closed a real hole. Until now the `grownFormId`/`normalFormId` pairing was written *only*
when the dialog generated a new Actor — so the most common way a GM ends up with both forms, the
importer's own **batch mode** creating the printed Normal and Grown blocks from one paste, left
two Actors that could never be swapped between. Verified live on exactly that pair: both were
`UNLINKED`, linking them through the dialog wrote both halves, and a placed token then swapped
Large 2x2 4/7 → Gigantic 4x4 7/13.

Design points worth keeping:

- The candidate list excludes the actor itself, other actor types, and anything already claimed as
  **some other** actor's form — so linking can never silently steal an existing pairing. An actor
  already paired with *this* one stays listed, so the current pairing shows rather than vanishing.
- `linkGrownForm` clears any previous pairing on **both** actors first. Otherwise a re-link would
  leave the old partner still pointing here, and the HUD would offer a swap that lands somewhere
  unexpected.
- Unlink works from either half of the pair and clears both sides.

Also renamed the Actors-directory footer button from "Create an NPC from a pasted stat block" to
simply **"Stat Block Importer"**.

Unrelated to this feature, found while running the suite: **`npm test -- --coverage` cannot run
locally at all** — the
installed `node_modules` is missing `test-exclude` and `make-dir`, in the main checkout as well
as the worktrees. Unrelated to this feature, but it means the coverage floor is CI-only until
the dependency tree is repaired.
