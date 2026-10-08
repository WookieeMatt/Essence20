# One definition of "unarmed" (2026-10-07)

## The problem

"Is this attack unarmed?" had two answers.

| Reader | Old definition |
| --- | --- |
| core tag `attack:unarmed` (rules/predicate.mjs), used by about 42 pack items: Ninja Power, Relentless Blows, Power Strike, Zeo Crystal Boost, Puissance, the Warlords and more | a weaponEffect with **no parent weapon** (`!flags.essence20.parentId`) |
| `attack:barehanded` (rules/plugins/tags/barehanded-tags.mjs, 7 items) and dice.mjs#_isUnarmedWeaponEffect | no parent weapon **or** a parent that is a printed unarmed weapon (GI JOE / Transformers Unarmed Combat, Night Vale Unarmed Strike) |
| action-perks.mjs#describeAttack().unarmed, target-riders.mjs#buildRiderContext().isUnarmed, dice.mjs Striking Hands / Emotional Mastery: Anger | no parent weapon |

The narrow reading missed every attack made with the printed unarmed weapon. Every character has one, at Automatic availability. The wide list was also missing Power Rangers.

## The new definition

`module/items/shared/unarmed-attacks.mjs`:

- `isUnarmedAttack(item, actor = null, weapon = undefined)` is true when the item is a weaponEffect and either
  - it has no parentId, or
  - its parent weapon is a printed unarmed weapon.
- `parentWeaponOf(item, actor)` finds the parent weapon by its parentId. It looks on the item's own actor (`item.parent` / `item.actor`) first, then on the actor passed in.
- `isPrintedUnarmedWeapon(weapon)` matches the weapon's `sourceOf` (`flags.core.sourceId` / `_stats.compendiumSource` / `flags.essence20.rulesSource`), so embedded copies count whatever their name. The pack item's own `uuid` also counts.
- `UNARMED_WEAPON_IDS` is the list (below).
- If a parentId resolves to nothing (a dangling id, or no actor to look on), the attack counts as a **weapon** attack. The core tag always read it that way, and `phase3.test.js` pins it.
- A caller that already has the weapon can pass it as the third argument. `null` means "no weapon", so the attack is unarmed.

## Readers switched

- `attack:unarmed` (predicate.mjs) now calls `isUnarmedAttack(item, ctx.self)`. It still needs `ctx.isAttack`.
- `attack:barehanded` is kept as an alias. `isBarehandedAttack` now calls `isUnarmedAttack`. The tag keeps one real difference: it only refuses when `ctx.isAttack === false`, so it also answers on the item alone (e.g. DamageType rules such as Cold Touch). `UNARMED_WEAPON_IDS` and `isPrintedUnarmedWeapon` are re-exported from it.
- `self:holdingWeapon` / `target:holdingWeapon` were unchanged, but now pick up the new list, so a PR Unarmed Combat is not "holding a weapon".
- dice.mjs:
  - `_isUnarmedWeaponEffect` now delegates to the shared definition. It feeds the roll context's `isUnarmedAttack`, which mechanics/rolls/reroll.mjs `REROLL_CONDITIONS.unarmedAttack` reads (Focused Strike).
  - Striking Hands (Power Adaptation) and Emotional Mastery: Anger used `!this._getParentWeapon(...)` and now use `_isUnarmedWeaponEffect`.
  - The "no parent weapon proxy" comments were updated.
- action-perks.mjs `describeAttack().unarmed` drives the action filters' `unarmed`, e.g. Relentless Blows' extra strikes.
- target-riders.mjs `buildRiderContext().isUnarmed` (Hate Plague). Its now-unused `isWeaponEffect` helper was removed.
- items/zords/megaform-attacks.mjs `isUnarmedish` now uses `isUnarmedAttack` for its unarmed half. Ram and Fly-by stay in `isUnarmedish` only, not in the shared definition. The Enigma of Combination p.44 lists them beside "unarmed" ("unarmed, ram, fly-by or natural attack"), not as unarmed. Behaviour is unchanged, because printed unarmed weapons are integrated and were already counted.
- Comments in util/config.mjs (`rerollConditions.unarmedAttack`) and items/forms/power-adaptation.mjs were updated.

Not changed:

- The Quiet One's Silent check in dice.mjs is a trait check, not an unarmed check.
- `item:attachedAttack` (megaform.mjs) means "has a parentId", which is a different question.
- Primal Rage's extra `item:name~unarmed` / `weapon:name~unarmed` clauses are now redundant but harmless.

## Printed unarmed weapons (from the books)

| uuid | Item | Book |
| --- | --- | --- |
| `Compendium.essence20.gi_joe_crb.Item.OU9rXvoKfXtcpvFy` | Unarmed Combat | G.I. JOE CRB p.141 (equipment table, Automatic, Finesse or Might, integrated melee) |
| `Compendium.essence20.tf_crb.Item.OU9rXvoKfXtcpvFy` | Unarmed Combat | Transformers CRB p.120 |
| `Compendium.essence20.wtnv_citizens_guide.Item.Cwd1FASmKXWiAFom` | Unarmed Strike | Night Vale Citizens' Guide p.62 (Availability: Automatic) |
| `Compendium.essence20.pr_crb.Item.5Y0qpK0gnsupCNHX` | Unarmed Combat (was "Brawling"), Might | Power Rangers CRB (2nd Printing) p.108 |
| `Compendium.essence20.pr_crb.Item.YUm8S0ztubmNytbg` | Strike, Finesse | Power Rangers CRB (2nd Printing) p.108 |

The PR CRB (2nd Printing) p.108 prints one weapon, "Unarmed Combat (Finesse or Might)". The pack splits it in two by skill: the Might half (formerly "Brawling") and the Finesse half ("Strike"). Both are the printed unarmed weapon, so both are on the list. The book's Threats also print "Unarmed Combat (Might)" (pp.211-219).

No other printed unarmed weapon was found:

- A scan of every pack's weapons by name (unarmed / brawl / punch / fist / natural / kick / claw / bite / martial) found only claws, bites, Massive Fists, Natural Weapon (Technorganic Secrets) and the like. These are natural or integrated weapons, not the Automatic unarmed entry.
- The MLP CRB has no unarmed weapon item. There, unarmed is a mechanic (pp.179-180).

## Rename

`packs/prcrbitems/_source/` was changed with text-only edits. The `_id`s, file names and LF endings were kept.

- `Brawling_5Y0qpK0gnsupCNHX.json`: "Brawling" became "Unarmed Combat", including the three embedded `system.items` names.
- `Brawling_Effect_IOenNqdotgidwRTa.json` became "Unarmed Combat Effect".
- `Brawling_Alternate_Effect_1_JK2fJIoMMEmrX3pF.json` / `_2_WgxbC8HBSTE6i1Yb.json` became "Unarmed Combat Alternate Effect 1/2".
- `Brawling_agZ0btQpymAY7YIq.json` (the folder holding the effects) became "Unarmed Combat".

No other pack or module code referenced the weapon by its old name:

- There are no `item:name~brawl` tags.
- "Brawling" in the stat-block importer comments and tests, and in config.mjs ("Brawl"), is the Might **specialization** from Finster's Cookbook, not this weapon.
- The companions.mjs comment quotes a book.

Existing world copies keep the old name and still match through their compendium source id. The packs still need a recompile (`npm run build:db`), which was not done here.

## Tests

- New file `module/items/shared/unarmed-attacks.test.js` (23 tests) covers:
  - the definition: no parent; each printed weapon including PR Unarmed Combat and Strike; all three source fields; the pack item's own uuid; an ordinary weapon; an unsourced weapon; a dangling parentId; non-attacks; the actor fallback; a caller-supplied weapon;
  - `attack:unarmed`, `attack:barehanded` (including the isAttack difference and the re-export), `Dice#_isUnarmedWeaponEffect`, `describeAttack().unarmed` and `buildRiderContext().isUnarmed`;
  - a pack scan: every `UNARMED_WEAPON_IDS` entry exists in its pack's `_source` as an integrated weapon, and the PR weapon and its effects carry the Unarmed Combat names.
- Updated: `module/rules/conversions.test.js`, "Puissance / Frost Warlord / Venom Warlord". It pinned the narrow reading, expecting 0 for a printed Unarmed Strike attack. It now expects +1, per the books:
  - Puissance, Enigma of Combination p.38: "attacks that do not require any kind of hardpoint or weapon. This includes Unarmed strike...".
  - The Warlords, Finster's Cookbook: "any attack made using your natural Reach".
  - The test also adds PR Unarmed Combat (+1) and an ordinary sword (0).
- Still passing unchanged: `phase3.test.js` (a dangling parentId is not unarmed), `conv15-dice.test.js` (attack:barehanded), `action-perks.test.js`, `dice.test.js`.

## One Power Rangers Unarmed Combat (2026-10-07, user)

The 2nd printing prints a single Unarmed Combat (Finesse or Might). The pack's separate Finesse "Strike" weapon was a 1st-printing leftover and is removed (weapon, its three effects and its folder). Unarmed Combat's three effects now carry the same two `SkillSubstitution bestOf` rules as G.I. JOE's, so it rolls the better of Finesse and Might. Characters' existing Strike copies still count as unarmed (`LEGACY_UNARMED_WEAPON_IDS`).
