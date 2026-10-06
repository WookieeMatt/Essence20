# Audit fixes (2026-10-07)

Fixes for the read-only audit of ruled items whose ids still appear in module code (`result-ruled.md`): the two
doubles, the lost Disarming Shot rider, the Favorite Command watch item, every `vestigial` entry and the stale
comments. No pack compile was run; the one pack change (Disarming Shot) is in `_source` only.

## 1. Rallying Cry (WTNV, `Qdb9Jj4UAAE0YbhE`): Surprised was applied twice

- Checked first: the item's `afterRoll` / `success` Trigger matches what the code did. It uses `skill:performance`,
  `roll:dataset:dif=10` and `combat:roundIs:1`. It Surprises the first `1 + 2 * @var.crit` targets (1, or 3 on a
  Critical Success, since `outcome: success` also hears a crit) whose token disposition differs from the crier's.
  `rules/conv15-items1.test.js` already covers all of this, so the rule is unchanged.
- Removed the hand-written path from `module/dice.mjs`: the `isWtnvRallyingCryAttempt` const and its comment, the
  checkContext entry, the post-roll Surprised sweep, and the `surprise-perks.mjs` import.
- `module/items/attacks/surprise-perks.mjs` had nothing left in it once `WTNV_RALLYING_CRY_ID`, both limits,
  `isSurpriseRound` and `getRallyingCryTargetLimit` went, so it was deleted along with its test
  (`surprise-perks.test.js`).
- Test: `module/dice.test.js`. Its three old cases became one regression case: a successful roll that still carries
  the old `isWtnvRallyingCryAttempt` flag Surprises nobody from dice.mjs.

## 2. Not On My Watch (`xH3iQ0NcXp1eFO35`): two prompts when an ally dropped to 0 Health

- Removed the Health-path `grantNotOnMyWatchReaction` call in `module/mechanics/combat/combat.mjs#applyDamage`.
  The item's `droppedToZero` watch Trigger handles that case.
- Kept the Stun-Defeat call as the Perk's only code path. The engine has no event an ally can watch for a Stun
  Defeat: `droppedToZero` only hears Health writes, and a Stun Defeat leaves Health alone. `defeatedEnemyStun` fires
  on the one who dealt the Stun, not on the Defeated actor. So the rule can't take this over yet, and there is no
  double: one path per case.
- Comments updated in `combat.mjs` and `module/items/defenses/not-on-my-watch.mjs`.
- Tests: `module/mechanics/combat/combat.test.js`. A Health Defeat now posts no code prompt. A Stun Defeat still
  posts exactly one. The "already Defeated" and "not Defeated" cases now use Stun damage.
  `module/items/defenses/not-on-my-watch.test.js` has a scope note.

## 3. Disarming Shot (`b4v1GUBwSqnCTozq`): the disarm-on-hit and crit discharge never ran

- `packs/ghpfitems/_source/Disarming_Shot_b4v1GUBwSqnCTozq.json`: the DialogSwitch now has `"key":"disarmingShot"`.
- `module/mechanics/combat/target-riders.mjs#buildRiderContext`: `disarmingShot` is now read from
  `options.ruleKeys` instead of the `applyDisarmingShot` option, which nothing set. The disarm and the Critical
  discharge rider (`RIDER.disarmingShot` in rider-uses.mjs, still in use) are unchanged.
- Tests: `module/rules/conv15-dice.test.js` gets a new case. It loads the pack item, ticks its switch through
  `applyRuleSwitches`, and checks that `buildRiderContext` turns the disarm on, and leaves it off when the switch is
  unticked. This would have caught the bug. `module/mechanics/combat/target-riders.test.js` now uses `ruleKeys` and
  checks that the old flag is ignored.

## 4. Favorite Command (WTNV, `GeHPKfuWe24HpYcQ`): only one Move-discount offer

- The `COST_RULES` `favoriteCommand` entry in `module/mechanics/actions/action-perks.mjs` stays. The rule does not
  cover what it covers. The entry fires on the commander for a pet holding the Perk, in all three printings (GI Joe
  and MLP have no ActionCost rule, only their Use). It also covers Attack-build pets. The WTNV rule only fires when
  the commander holds the Perk.
- So that only one offer can ever reach the player, `getCostOptions` now drops an offer that asks the same question
  (`ask`) for the same cost as an offer it already has. The two Favorite Command offers ask
  `E20.ActionPerkAskFavoriteCommand` for commandPet to Move.
- Test: `module/mechanics/actions/action-perks.test.js`, "the same discount offered twice".

## 5. Vestigial entries (each grepped across module/, templates/, scripts/ and lang/ before deletion)

- `action-perks.mjs`: deleted `ACTION_PERK_IDS` and its `ID`/`GIJ`/`TF`/`PR` helpers. Dropped the two `P[rule.id]`
  lookups (`labelFor` and `getAttacksPerAction`), which already resolved to undefined.
  - Test: `action-perks.test.js` keeps the three uuids it needs as local constants.
- `qualification-gm-relay.mjs` `Q1`: removed `goodToGo`, `ninpoJoes` and `nothingPersonal`.
  - Test: `items/tests/qualifications-addicted.test.js` uses `Q1.nuPogodi` instead.
- `resource-team-lookups.mjs` `IDS`: removed `motorPool`, `beastMode`, `engraftedMutation`, `evolvingMutation`,
  `outrightMutation` and `camper`.
  - Test: `items/tests/resources-energon-wealth.test.js` uses `IDS.weImprovise` and literal uuids.
- `alteration-adjustments.mjs` `O1_ALT`: removed `cyberneticPart` and `engraftedMutation`. TIERS only reads
  enhanced, evolving, optimized and outright.
- `condition-damage-buttons.mjs` `TF1`: removed `brutalDisplay`, `commsAssault`, `flexibleSwitch` and `makeAnExample`.
- `pr-jtt-ats-item-ids.mjs` `PR1`: removed `swatUpgrade`.
- `terrain-perk-ids-and-readers.mjs` `S1`: removed `urbanJungle`.
- `tf-crb-tf-one-item-ids.mjs` `TF3`: removed `oneBotOverAnother`.
- `tf-technorganic-enigma-item-ids.mjs`: deleted the whole `TF2` object (nothing imported it) and its `C` helper.
  `parentWeaponOf` stays.
- `combiner-roster-helpers.mjs` `ZORD2`: removed `warriorMode`, `zordFeatureSlot`, `assaultWeapon` and
  `zordUltraMode`. `warrior-mode.mjs` keeps its own `WARRIOR_MODE_ID`.
- `weapon-traits.mjs`: removed the `demolisher`, `bigLobber` and `fireball` entries from `TRAIT_PERK`, and deleted
  the whole `HARDPOINT_PERK` object and its `TF` helper.
  - Test: `mechanics/vehicles/vehicle-upgrades.test.js` keeps the uuids it loads rules from as local constants.
- `lend-assistance.mjs`: deleted `I_GOT_YOU_ID`, the never-called `pickIGotYouAction()` and the comments about them.
  The item's two Use rules replace them. Also deleted the four `E20.IGotYouPick*` strings in `lang/en.json`.
- `rider-uses.mjs` `RIDER.disarmingShot`: kept. It is live again through fix 3.

## Stale comments fixed

Each of these comments said a clause "lives in dice.mjs / roll-dialog.mjs / actor.mjs" after a rule had taken it
over:

- `items/rolls/nose-for-trouble.mjs` (Initiative bullet)
- `items/resources/we-improvise-continuum-anomalies.mjs` (who adds the point)
- `mechanics/combat/combat.mjs` (Zord Sentience's Driving ↑1)
- `mechanics/resources/banked-buffs.mjs` (Venom Warlord's damage, Heroic Intervention's Defenses)
- `items/movement/sprinter-boost.mjs` (the removed actor.mjs `SPRINTER_ID` check)
- `sheet-handlers/perk-handler.mjs` (Cost of Sorcery's Fumble, Quantasaurus Rex and Phantom Ship's Snag immunity)
- `documents/actor.mjs` (Fighting Style options "not automated")

## Checks

- eslint (`--ext .js,.mjs --rule 'linebreak-style: off'`) on every touched file: clean except one
  `padding-line-between-statements` error at `module/dice.test.js` ~11180 (the Tactical Triangulation case). That
  is another agent's in-progress hunk, not this pass.
- `node scripts/check-rules.mjs`: 0 errors, 0 warnings.
- jest, touched suites: 13 suites, 1807 tests pass.
- jest, full suite: 365 suites, 8121 tests pass.
