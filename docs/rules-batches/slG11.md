# Batch slG11: round 11, group G - Warhead Magazines, Pop Out, Telltale Sign (and Armor Matrix's code half)

**Scope:** the "Still code (3)" list of `slB10.md` - Warhead Magazines, Pop Out, Telltale Sign - plus Armor Matrix's
"best matrix only" Toughness (the code half of B's partial). Built as plug-ins in `module/rules/ext/g.mjs` +
`module/rules/ext/g/` (common, select, select-rule, picks, hidden, cards, rolls, best), edited in place in the shared
checkout (no branch, no commit).

**Result:** 6 pieces built, **4 items converted** (3 fully, plus Armor Matrix x3 now fully rules), **0 still code**.
**10 rules added on 6 pack items.** `scripts/check-rules.mjs`: 2350 rules on 1369 items, 0 errors, 0 warnings (the other
group's work included).

## Engine features added 2026-10-06 (round 11, group G)

- **DialogSelect extras** (`ext/g/select.mjs`, params in `ext/g/select-rule.mjs`; group C's `ext/c/dialog.mjs` asks them):
  - `options[i].when: [tags]` - the option is offered only while the tags hold (asked as the select itself is: `self:` the
    roller, `holder:`, `item:` the rolled item, `target:`).
  - `options[i].pay: [steps]` - run as the holder when the option is chosen, before it applies; a stopped run (an action
    that can't be spent) means the option doesn't apply at all.
  - `optionsFrom: {picked, legacy?, copies?, labels?: "damageType", label?, key?, pay?, steps?}` - one more option per value
    a pick stored on the rule's item under `picked` (a list - `pickEach` / `pickMany` - or one value); `legacy` - where an
    older version kept it; `copies: true` - the values the actor's other copies of the same book item hold too; `labels:
    damageType` labels them from CONFIG.E20.damageTypes; `label` / `key` fill `{value}` and `{label}` (`key: "ammo:{value}"`).
    With optionsFrom, one authored option (the default, "keep it as it is") is enough.
  - A select left with fewer than two options isn't shown. Values are stable: an authored option is its index, a generated
    one `v:<value>`.
- **HitRider `option.damageType: "{switch.<prefix>}"`** - the rest of the first ticked switch key `<prefix>:<value>` (a
  generated DialogSelect option's key); none ticked - no option.
- **Step `pickEach {key, count, from, only?, excludeCopies?, prompt?, legacy?}`** (`ext/g/picks.mjs`) - choose `count`
  different values one at a time (a select each time; `prompt` fills `{n}` and may be an E20. key), kept as a list on the
  rule's item. Each pick leaves out the earlier ones; `excludeCopies` also leaves out what the actor's other copies of the
  same book item hold under the key; `only` narrows the source. Running out ends early and keeps what was chosen; a
  cancelled pick stops the run and keeps nothing. `@var.picked` (the list), `@var.pickedLabels` (", "-joined). Give it
  `record: true` with `legacy` so the start-up linking pass moves an old pick.
- **Tag `rule:firstCopy`** - the rule's item is the first copy of its book item on the actor (a rule read once per actor
  when the copies' picks differ, so collectRules keeps both).
- **The Hidden state** (`ext/g/hidden.mjs`) - `flags.essence20.o3Hidden {epoch, at}`, live for the scene it was set in
  (the generic Hide action in other3/hide.mjs sets it). Tags **`self:hidden`** / **`target:hidden`**; step **`hide {to?,
  value?}`** (`value: false` ends it); event **`brokeHiding`** - the actor attacked while Hidden (hide.mjs ends Hidden first,
  then fires it): the attack's targets (once each) are the Trigger's targets, `@var.targets` how many.
- **Cards other items add buttons to** (`ext/g/cards.mjs`):
  - Step **`postCard {key, text?}`** - a chat card for the actor with `text` (`{name}`, `{target}`, `{var.x}`; an E20. key is
    localised) and a button for each `CardButtons` rule the actor holds for that `key` whose `when` holds.
  - Rule **`CardButtons {card, label, steps, each?: "target", who?}`** - the buttons an item adds to cards posted under
    `card`: one, or (`each: target`) one per target of the card, that target its own (`{target}` in the label). Pressed,
    the steps run as the card's actor with the button's targets; `who` as the `button` step's (owner by default); a button
    can be pressed again and again.
  - Step **`buttonCount {key, add?, max?, check?, message?}`** - in a button's steps (these cards', or a `button` step's): a
    counter kept on the pressed button (each button its own), read as `@var.<key>` after it. `check: true` only checks; at
    `max` or more it stops with `message` (an E20. key is localised) as a warning. Otherwise it adds `add` (default 1).
- **Step `rollVsAll {skill, defense, to?, onSuccess?, onFail?, cancelFails?}`** (`ext/g/rolls.mjs`) - ONE ordinary Skill
  Test (the Skill's own shifts / Specialization, no DIF), its total compared with each recipient's (default: the targets)
  Defense - a list: the best of them. A success only when it meets every one; the branch runs with the recipients as
  targets. `@var.rollTotal`, `@var.beaten`. No recipients - a chat line, stop; a cancelled roll stops (`cancelFails`: the
  onFail branch).
- **Rule `OnlyBest {defense, items, path?, key?}`** (`ext/g/best.mjs`) - of the actor's items matching `items` (item tags),
  only the biggest bonus (the number at `path`, default `system.armorBonus.value`) counts toward that Defense: a derived
  pass takes every other one off the total, noted "- N (label)". `when` sees the actor. Rules sharing a `key` apply once per
  actor, so each of a family of items can carry the same rule.

## Verdicts

| Item | Verdict | Where it was |
|---|---|---|
| Warhead Magazines | converted | pr1/jtt.mjs (+ pr1/common.mjs) |
| Pop Out | converted | other3/hide.mjs |
| Telltale Sign | converted | other3/hide.mjs |
| Armor Matrix (Light / Medium / Heavy) - best-only Toughness | converted (now fully rules) | other1/more.mjs |

## Converted

- **Warhead Magazines** (`jttitems`) - an `added` Trigger and a Use, both `when` nothing is picked yet (the new pick or the
  old `pr1WarheadTypes` flag): `pickEach` three of acid, blunt, cold, electric, EMP, element, fire, sharp, sonic, stun
  (`excludeCopies`, prompt `E20.Pr1WarheadPick`, `legacy: flags.essence20.pr1WarheadTypes`) and the "{name}'s Warhead
  Magazines: ..." line. A DialogSelect `when: [self:type:zord, rule:firstCopy, any of attack:area / weapon:trait:area]`
  with "Base damage type" and `optionsFrom` the copies' picks (key `pr1Warhead:<type>`, pay: a Free action in combat). A
  HitRider `when: [self:type:zord, rule:firstCopy]` with option `{damage: @var.damage, damageType: {switch.pr1Warhead}}`
  labelled Warhead Magazines.
- **Pop Out** (`tfcrbitems`) - a `brokeHiding` Trigger `when: [var:targets>0]`: a button "Pop Out: roll Infiltration" (the
  owners): `rollVsAll` Infiltration against Willpower / Cleverness of every target; success - `hide` and `postCard popOut`
  ("{name} pops out and stays Hidden."); failure - the "is seen" line. The generic Hide code in hide.mjs ends Hidden on any
  attack and fires the event.
- **Telltale Sign** (`tfcrbitems`) - `CardButtons {card: popOut, each: target, label: E20.O3TelltaleFrighten}`: `buttonCount
  presses` check (max 3, `E20.O3TelltaleMax`), a Free action in combat, count the press, `rollVsAll` Infiltration against the
  target (`cancelFails`); success - count `rounds`, Frightened for `@var.rounds` rounds, the calling-card line; failure -
  the "isn't frightened" line.
- **Armor Matrix** x3 (`dditems`) - `OnlyBest {key: armorMatrix, defense: toughness, when: [self:canTransform], items:
  [an upgrade that is one of the three matrices or named "armor matrix", not attached, with a Toughness bonus]}` beside B's
  Veto.

Tests: `module/rules/engine11-g.test.js` (16, every piece) and `module/rules/conv11-slG11.test.js` (10, every item loaded
from its pack source, asserting what the old tests did and more).

## Behaviour differences worth a decision

1. **Card text:** Pop Out's and Telltale's lines come in the rule cards' format (a pressed button's lines under its label
   header; Warhead's chosen line under the Trigger / Use label); the texts are the old ones in English in the pack data, not
   the old i18n keys (except the pick prompt, Telltale's button label and its "three times" warning, which still use theirs).
2. **Telltale's counters live on the card** (message flags), so they survive a re-render / reload; the old ones were DOM
   attributes and reset when the card re-rendered.
3. **Telltale on a creature this user doesn't own** is Frightened for the counted rounds through the GM (the engine's
   applyCondition), where the old code gave an untimed Frightened through the relay; the target's token is no longer
   targeted on the way. The engine's applyCondition also adds its own "{name} is frightened" line.
4. **A Pop Out with the same creature hit twice** offers one Telltale button for it (targets are deduplicated).
5. **Pop Out's button card** is a rule `button` card (`once`, marked used on the card - the old one was a DOM flag per
   render).
6. **Armor Matrix's name match** is "contains armor matrix" (was "starts with", the same as B's Veto); a homebrew matrix
   only counts when one of the three book matrices (which carry the rule) is also present. The pass runs in the rules'
   derived step (after the slices' own derived hooks).
7. **Warhead's Free action** is spent through the engine's `spendAction` (`source`: the Feature's name), as before; a Zord
   with two copies shows one select and one Apply button (`rule:firstCopy`), as before.

## Still code (0), and why

None of my list. (Unchanged and not mine: Temper Tempest's storm reading More Bang, Solar Power's element pick, Rust
Derivatives' +1 Acid in weapon-upgrades.mjs - see slB10.)

## Shared-file edits

- `module/rules/ext/index.mjs` - `import "./g.mjs";`.
- `module/rules/ext/c/dialog.mjs` - imports `payOption`, `selectChoices`, `selectOption` from `../g/select.mjs`; `ask`
  context on incoming / own select entries; `control` builds a DialogSelect's options from `selectChoices` (null - no
  select - under two); `registerDialogToggles` filters nulls; the apply step reads `selectOption` and runs `payOption` first.
- `module/rules/ext/b/hit-rider.mjs` - imports `fillSwitch`; an option's damageType fills `{switch.<prefix>}`.
- `module/helpers/extensions/other3/hide.mjs` - Pop Out / Telltale code, `observerDefense` and the Hidden helpers gone (now
  `ext/g/hidden.mjs`, `isHidden` re-exported); the postRoll ends Hidden and calls `fireBrokeHiding`.
- `module/helpers/extensions/other3/shared.mjs` - `O3.popOut`, `O3.telltaleSign` removed.
- `module/helpers/extensions/other3/other3.test.js` - the observerDefense test removed.
- `module/helpers/extensions/pr1/jtt.mjs` - the Warhead section, its dialog / apply / hit-rider / createItem hooks and imports
  gone (the shared `clearPending` preRoll stays - misc.mjs's Primordial Power uses it).
- `module/helpers/extensions/pr1/common.mjs` - `PR1.warheadMagazines`, `parentWeaponOf`, `isAreaAttack`, `payAction` removed.
- `module/helpers/extensions/pr1/pr1.test.js` - the Warhead use id and `warheadChoices` test removed.
- `module/helpers/extensions/other1/more.mjs` - `isArmorMatrix`, `extraMatrixToughness`, the matrix ids and the derived pass
  gone; `other1/other1.test.js` - its test removed.

## Unused strings

`E20.Pr1WarheadApply`, `E20.Pr1WarheadBase`, `E20.Pr1WarheadChosen`, `E20.Pr1WarheadToggle`, `E20.O3PopOutFailed`,
`E20.O3PopOutPrompt`, `E20.O3PopOutRoll`, `E20.O3PopOutSuccess`, `E20.O3TelltaleFrightened`, `E20.O3TelltaleMissed`,
`E20.O1ArmorMatrixLabel`. (`E20.Pr1WarheadPick`, `E20.O3TelltaleFrighten`, `E20.O3TelltaleMax` stay - the pack rules use
them. New strings are in `r11/lang-g.json` under `RulesExtG`: `ButtonMax`, `NeedsTarget`.)

## Rule count

**10 rules added on 6 pack items** (CRLF, inserted as text): Warhead Magazines 4, Pop Out 1, Telltale Sign 1, Armor Matrix
1 x3.

## Checks

- ESLint (`--ext .js,.mjs`, linebreak-style off) on every file above: clean.
- `node scripts/check-rules.mjs`: 2350 rules on 1369 items, 0 errors, 0 warnings.
- Jest: `engine11-g` (16) and `conv11-slG11` (10) pass; `engine10-c`, `conv10-slC10`, the other1 / other3 / pr1 slice tests
  pass. Full suite: 550 / 552 suites, 10286 tests pass; the two failures are `engine10-b` and `conv10-slB10`, which fail to
  load because group F's `ext/f/reactors.mjs` now pulls `rules/reactions.mjs` into `ext/index.mjs`, and those suites' mock of
  `react/core.mjs` has no `areAllies` (etc.). With the mock given those exports (a temporary copy), both pass (75 tests) with
  my changes.
