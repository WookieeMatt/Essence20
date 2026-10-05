# Extension slices → rules: cloud batch plan

The extension slices (`module/helpers/extensions/<slice>/`, ~37,000 lines in 31 folders) are the hand-written
Perk/item code that registers into `helpers/extensions.mjs`. No conversion round has targeted them yet. This
plan splits them into five **chained** cloud batches: each one starts from the branch the previous one pushed,
so they never conflict with each other.

| Batch | Slices | ~Lines | Starts from | Pushes |
|---|---|---|---|---|
| **slA** – Power Rangers & Zords | `zord1`, `zord2`, `pr1`, `pr2`, `pr3` | 8,500 | `Rules-Engine-Phase-1` | `rules/slA` |
| **slB** – Transformers | `tf1`, `tf2`, `tf3`, `fix3-tf`, `other2` | 6,600 | `rules/slA` | `rules/slB` |
| **slC** – G.I. Joe & situational | `gij1`, `gij2`, `gij3`, `fix3-gij`, `situational1`, `situational2` | 5,800 | `rules/slB` | `rules/slC` |
| **slD** – reactions, resources, cross-line | `react`, `resource`, `other1`, `other3` | 8,800 | `rules/slC` | `rules/slD` |
| **slE** – qualification, data, MLP, Night Vale | `qualify1`, `qualify2`, `data1`, `data21`, `data22`, `mlp1`, `mlp2`, `wtnv`, `r2misc`, `rules`, `fix3-dice` | 7,100 | `rules/slD` | `rules/slE` |

Bring each branch back for local verification (lint, rules check, full jest, a pack rebuild) before starting the
next one is ideal but not required - chaining is what prevents conflicts.

## How the slices work (for the cloud session)

- Each slice folder has a `common.mjs` / `shared.mjs` with its item-id table (e.g. `TF1 = { brutalDisplay: dd('…') }`)
  and files that call the `register*` functions of `module/helpers/extensions.mjs` (Use buttons, roll sources,
  dialog toggles, post-roll riders, defense adjusts, derived data...). `extensions/index.mjs` imports every file.
- Converting an item = writing its rules into its pack `_source` JSON, then removing its entry from the slice:
  the id-table key, the code that reads it, and its tests (replace them with rule-based tests in
  `module/rules/conversions.test.js` / `conversions-uses.test.js`, under a `// <batch>` header).
- When a slice FILE becomes empty, delete it, its import line in `extensions/index.mjs`, and its test file. Keep a
  file's test file while any of its code stays (CI has a coverage floor - code without tests fails it).
- A shared helper used by items that stay code stays; only remove what nothing references any more.
- Many slice entries are Use buttons with costs, limits, pickers and chat - the Use/Trigger steps in the guide
  cover most of that (`pickAlly`, `pickPerk`, `grant`, `bank`, `mark`, `applyCondition`, `roll`, `save`...).

## Prompt (one per batch - change the batch name, slices and branches)

> Read `docs/RULES_CONVERSION_GUIDE.md` in full and follow it, including every engine section at the end, then
> read `docs/rules-batches/SLICES_PLAN.md`.
> Batch **slA**: convert the items handled by the extension slices `zord1`, `zord2`, `pr1`, `pr2` and `pr3`
> (`module/helpers/extensions/<slice>/`) into item rules, wherever existing rule types, tags and steps reproduce
> the current behaviour exactly; skip or partly convert the rest with the missing engine piece named.
> Start from the branch `Rules-Engine-Phase-1` and push the branch `rules/slA`.
> Write `docs/rules-batches/slA.md` with the verdict counts, every item's verdict, every behaviour difference, and
> the engine pieces the skips need (the same layout as the reg*.md files).

For the next batches, change: **slB** – slices `tf1`, `tf2`, `tf3`, `fix3-tf`, `other2`, start from `rules/slA`,
push `rules/slB`; **slC** – `gij1`, `gij2`, `gij3`, `fix3-gij`, `situational1`, `situational2`, from `rules/slB`,
push `rules/slC`; **slD** – `react`, `resource`, `other1`, `other3`, from `rules/slC`, push `rules/slD`;
**slE** – `qualify1`, `qualify2`, `data1`, `data21`, `data22`, `mlp1`, `mlp2`, `wtnv`, `r2misc`, `rules`,
`fix3-dice`, from `rules/slD`, push `rules/slE`.

## Round 2 (re-check the slice skips against the 2026-10-04 engine pieces)

Same five groups, chained again, each re-checking its round-1 write-up's **Skipped** and **Partial** items against the
newest engine sections of `docs/RULES_CONVERSION_GUIDE.md` (targeted / dealtDamage / defeatedEnemy Triggers, the item
steps, `pick`, `button`, SkillSubstitution `scope: item`, `defaultWhen`, the new `check:` names). Each batch stands on
its own, so stopping after any one of them leaves a usable branch.

| Batch | Slices | Re-checks | Starts from | Pushes |
|---|---|---|---|---|
| **slA2** | `zord1`, `zord2`, `pr1`, `pr2`, `pr3` | `slA.md` | `Rules-Engine-Phase-1` | `rules/slA2` |
| **slB2** | `tf1`, `tf2`, `tf3`, `fix3-tf`, `other2` | `slB.md` | `rules/slA2` | `rules/slB2` |
| **slC2** | `gij1`, `gij2`, `gij3`, `fix3-gij`, `situational1`, `situational2` | `slC.md` | `rules/slB2` | `rules/slC2` |
| **slD2** | `react`, `resource`, `other1`, `other3` | `slD.md` | `rules/slC2` | `rules/slD2` |
| **slE2** | `qualify1`, `qualify2`, `data1`, `data21`, `data22`, `mlp1`, `mlp2`, `wtnv`, `r2misc`, `rules`, `fix3-dice` | `slE.md` | `rules/slD2` | `rules/slE2` |
