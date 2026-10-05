# Batch slE: qualification, data, MLP, Night Vale and misc extension slices

Slices: `qualify1`, `qualify2`, `data1`, `data21`, `data22`, `mlp1`, `mlp2`, `wtnv`, `r2misc`, `rules`, `fix3-dice`.

**Scope:** every item in the id tables of those slices under `module/helpers/extensions/`, plus every other place in
`module/` that uses those ids. Code not keyed by an item id is out of scope; each part lists those files. Notably,
the `rules` slice is the Grappled condition's Snag switch and escape helpers (keyed by status), not the rules
engine's glue, and `r2misc/commander.mjs` is keyed by item type. The batch was done in five parts on separate branches
(`rules/slE-q1`, `rules/slE-q2`, `rules/slE-data` for data1 + data21, `rules/slE-dmlp` for data22 + mlp1 + mlp2,
`rules/slE-misc` for wtnv + r2misc + rules + fix3-dice), all from `rules/slD` at 426d9555, and merged into
`rules/slE`. Each part's full write-up follows below, in the same layout as the reg*.md files.

| Verdict | qualify1 | qualify2 | data1 + data21 | data22 + mlp1 + mlp2 | wtnv + r2misc + rules + fix3-dice | Total |
|---|---|---|---|---|---|---|
| Convert | 0 | 2 | 4 | 1 | 4 | **11** |
| Partial | 2 | 2 | 0 | 2 | 0 | **6** |
| Skip | 21 | 16 | 21 | 33 | 11 | **102** |
| Items | 23 | 20 | 25 | 36 | 15 | **119** |

32 rules were added to 17 pack items. Unread id-table keys removed: qualify1's `acclimating` / `silentBattledress`,
qualify2's Trade School / Technical Mastery. One slice file became empty: `data21/compassionate.mjs` is deleted with
its import. After the merge, `scripts/check-rules.mjs` counts 1400 rules on 988 items (slD left 1368 rules on 975
items), with 0 errors and 0 warnings. ESLint is clean and jest passes (502 suites; 9618 passed, 2 skipped). The only
merge conflicts were the parts' test blocks appended at the end of `module/rules/conversions.test.js` and
`conversions-uses.test.js`; all are kept.

**Behaviour differences worth a decision** (every difference is listed in its part's section):

- **Uses already spent are forgotten once** on the day this ships, because rules count under new keys: The List,
  Double Vision, Nobility's Wealth (misc), Real Angels this session and Morale Booster since the last Rest (q2).
- **Chat text no longer localized** for every converted Use (The List, Double Vision, Nobility, More Than Worldly,
  Real Angels, Morale Booster, Whisper Warrior, Oorah!, Compassionate), and labels on Key to Whinnypeg, Prize Honey and
  Wheel Excited; 25 now-unused `lang/en.json` keys are removed. Morale Booster's card no longer names the cleared
  allies or the uses left.
- **Nu, Pogodi! (q1):** "Standard or lower" now reads the effective tier, which Upgrade Training (qualify2) also lowers -
  the same tier the Requisition DIF uses, as Glory of Cobra-La and Ultra-Secret Strike Force already do.
- **Gear now respects equipped:** Key to Whinnypeg and Prize Honey's switches turn off while unequipped; the Key's
  None / ↑2 / ↑1 dropdown is now two checkboxes, and only the first active copy counts.
- **Real Angels (q2):** its once-per-session limit now also holds on unlinked token actors (it used to reset at the end
  of the encounter). Morale Booster no longer changes the user's targets.
- **More Than Worldly (misc):** the per-turn limit counts only once the combat has started; a pending Edge granted
  under the old flag is lost.
- **Compassionate (data), cross-line:** its Edge now applies after the other slices' apply hooks. With an mlp1 Edge and
  a Snag from Grappled or a zord1 form, one Edge now survives where both used to cancel.

**Most common engine pieces the skips need, across all five parts** (each part's list has the detail):

- **Stored picks:** a picker step that records chosen items on the Perk, a tag / Qualification that reads them (Service,
  Trade Goods, For The Syndicate, Good To Go, Ninpõ JOEs, Hardware Training, Weapon Enthusiast, Upgrade Training,
  Dino Thunder, Obsessive), stat paths built from those choices, per-scene picks with an undo (shape-shifting).
- **Requisition / item tags:** traits added by attached upgrades, two-handed and weapon-type tags, crewed-vehicle size
  and name, "has an attached upgrade with this id", a melee-weapon item tag, a static host tag.
- **A SpellCost rule:** Illusion Casting, Reach Out, Brilliant Sight, Extra Effective Spell, Long Lasting Spell,
  Mystical Understanding.
- **SkillSubstitution read from the rolled item itself** (the "Finesse or Might" weapon effects: 5 in these slices
  plus 52 elsewhere), so crew and pilots rolling a vehicle's weapon keep the swap.
- **Marks:** marks that carry their own rule (so an actor without the item is affected) and marks that remember each
  setter.
- **Grants from inline data** (Delicate Stomach, Pincers, Quills, Serrated Tail, Screech), and removing a granted
  weapon's attached attacks with the grant.
- **Rerolls granted to other actors,** an Initiative reroll, chat buttons on other actors' cards, canvas point / area
  steps, delayed explosives with timers.
- **Other:** a Brawn-requirement rule type, a session-start Trigger, a burning state with turn-end rolls, a heal Skill
  Test step, `ignoreDownshift` on a DialogSwitch at a fixed point (Third Eye, as Inventor in regA2), `@other.<path>`
  in ItemModifier, an incoming DialogSwitch.

---

## Batch slE (part): the `qualify1` extension slice

**Scope:** every item in the id tables of `module/helpers/extensions/qualify1/`: `Q1` in `common.mjs` (22 keys), plus
Fireball (its uuid is written inline in `ignite.mjs`), 23 items in all. The upgrade table `Q1_UPGRADE` names items the
Perks test for (Organic Armor, Biomechanical Weapon, Acclimating, the Silencer that Nothing Personal grants); those
upgrades have no behaviour of their own here. Each item was checked against the slice's code and every other use of
its id in `module/`. Branch `rules/slE-q1`, from `rules/slD` at 426d9555.

These parts hold no item-specific behaviour, so they are out of scope:

- `common.mjs`: the item lookup helpers (`sourceOf`, `itemsFrom`, `has`...) and the `q1Relay` GM socket relay.
- `index.mjs`: wiring only.
- `misc.mjs`: the Effective Threat Level readout on the combat tracker (`effectiveThreatLevel`, `combatThreatSummary`,
  `onRenderCombatTracker`). It is a GM tool and no item turns it on.
- `qualification.mjs`: the Requisition plumbing (`effectiveAvailability`, `combine`, `step`, `attachedUpgrades`, and
  the `essence20.requisitionAccess` / `requisitionAvailability` hook bodies), which also serves the Qualification
  rules through `rules/adapter.mjs#requisitionTier`.
- `rerolls.mjs`: the reroll chat plumbing (`postReroll`, `addButton`).

| Verdict | Items |
|---|---|
| Convert | 0 |
| Partial | 2 |
| Skip | 21 |

3 rules were added to 2 pack items. After this part, `scripts/check-rules.mjs` counts 1371 rules on 975 items (slD
left 1368 rules on 975 items), with 0 errors and 0 warnings. No slice file became empty, so `extensions/index.mjs` is
unchanged.

### Partial (2)

| Item | Converted | Rules | Still code |
|---|---|---|---|
| Nu, Pogodi! | "Qualified in all Standard weapons", and Qualified in the Acclimating upgrade | Qualification `access: qualified`, items `item:type:weapon` + `item:availability<=standard`. Qualification `upgrades` `{"any": ["item:id:HSmtPttbJvaNy5Tf", "item:data:name=acclimating"]}`. | The chosen two-handed Limited weapon (Use button pick, stored in `flags.essence20.q1Chosen`), the seat swap, and the Use button's menu (which also offers `helpers/nu-pogodi.mjs`' Condition removal). `dice.mjs` / `banked-buffs.mjs` code for its other effects isn't in this slice. |
| Mega Training Regimen | ↑1 on attacks with vehicle weapon systems and Integrated hardpoint weapons | RollModifier `upshift: 1`, when `attack`, `item:type:weaponEffect`, any of `item:data:parent.type=vehicle`, `item:data:parent.type=zord`, `weapon:data:system.hardpoint.type=integrated`. No label, so it shows the owned copy's name, as before. | The driving Qualification (Huge and larger land vehicles: ↑1 driving with Ranks, no untrained Snag) in `vehicleQualifier` / `qualificationSources` / `qualificationApplyDialog`. |

Why these are exact:

- **Nu, Pogodi!'s Standard weapons.** The old test was `item.type == 'weapon'` and
  `tierRank(effectiveAvailability) <= tierRank('standard')`. The rule tests the same type and the effective tier. Both
  only add `qualified` to `essence20.requisitionAccess`, and the widest answer wins whatever order the listeners run
  in. This is the same rule The Glory of Cobra-La and Ultra-Secret Strike Force already carry.
- **Nu, Pogodi!'s Acclimating.** The old test was the upgrade's `idOf(sourceOf(upgrade) ?? upgrade.uuid)` against
  `HSmtPttbJvaNy5Tf`, or its trimmed, lower-cased name against `acclimating`. `item:id:` reads the same `sourceOf`
  chain (`flags.core.sourceId`, `_stats.compendiumSource`, `flags.essence20.rulesSource`), with the uuid as the
  fallback. `item:data:name=` compares case-insensitively. qualify1's `isQualifiedUpgrade` asks
  `ruleQualifiedUpgrade`, so `effectiveAvailability` still leaves the upgrade out, as before.
- **Mega Training Regimen's ↑1.** The old test was `ctx.isAttack && ctx.item.type == 'weaponEffect'` and
  `isVehicleOrHardpointWeapon`: the effect's parent actor is a vehicle or zord, or its weapon
  (`parent.items.get(flags.essence20.parentId)`) has `system.hardpoint.type == 'integrated'`. The `attack` tag is
  `ctx.isAttack`. `item:data:parent.type` reads the effect's parent, as LIDAR Targeting Unit's rule does. `weapon:` finds
  the weapon the same way. Both sources reach the roll through `extRollSources` (the rules adapter registers
  `ruleRollSources` there), with the same roller and ctx, and each source can be switched off in the dialog.

Removed: `STANDARD_WEAPON_QUALIFIERS` and its check in `perkAccess` (and the `effectiveAvailability` call that only fed
it); `UPGRADE_QUALIFIERS` (so `isQualifiedUpgrade` now just asks `ruleQualifiedUpgrade`); `isVehicleOrHardpointWeapon`
and the `q1MegaVehicleWeapon` source; and the `Q1_UPGRADE` keys `acclimating` (only read by the removed table) and
`silentBattledress` (nothing read it). In `qualify1.test.js`, the Nu, Pogodi! Standard test and the Acclimating
upgrade test moved to the `slE q1` block in `module/rules/conversions.test.js`. In their place there is a no-upgrade
availability check and a Trade Goods access-widening check. The Mega half of the Cobra-La / Mega test was dropped,
and the `itemsFrom` test now uses the Organic Armor id.

### Behaviour differences

1. **Nu, Pogodi! with Upgrade Training (same-line: both are Intercontinental Adventures).** The Standard-weapon test
   now reads the effective tier from `requisitionTier`. That is the total lowered by every `requisitionAvailability`
   listener, qualify2's included. So an upgrade picked for Upgrade Training (qualify2) is also left out when deciding
   whether a weapon is Standard for Nu, Pogodi!. The old code read only qualify1's tier. The new answer matches the
   tier the Requisition DIF is rolled against. The Glory of Cobra-La and Ultra-Secret Strike Force rules already
   behave this way.
2. **Mega Training Regimen's source (same-line, cosmetic).** The source's id is now the rule's id instead of
   `ext-q1MegaVehicleWeapon`, and it can sit in a different place in the dialog's source list. Two copies of the Perk
   still give one ↑1, because rules are deduplicated by source and rule index.

No cross-line differences.

### Skipped (21)

- **Danger Sense.** The Initiative reroll of 1s and 2s is written into `system.initiative.formula` (`r<=2` on each
  Skill die) in a derived hook. (Its Edge switch was already a rule.) *Needs:* an Initiative-formula reroll rule (or
  a `Reroll` that applies to Initiative).
- **Ignite.** A Fire hit marks the target burning. At the end of the target's turn, the igniter's Science is rolled
  against its Evasion: a hit deals 1 Fire, a miss puts it out. The target has chat buttons to fight the fire (↓1 that
  stacks) or drop prone. *Needs:* a per-target state step with a counter, a turn-end Trigger on the marked creature
  that rolls for the marker, and target-side chat buttons.
- **Fireball.** It only gives Edge to Ignite's fire roll (the WeaponTrait half was already a rule). It goes with
  Ignite.
- **Addicted (Dark Energon).** A Use with three branches (new-day attack or withdrawal Essence damage, fed,
  treatment), and doubled Energon spending while craving (`preUpdateActor`). *Needs:* a resource-cost multiplier and a
  day counter. `other1` / `resource` also read the id.
- **Best-Laid Plans.** A planning test opens a d20 reroll pool for the scene, shared with the Party, and offered as a
  chat button on members' cards. *Needs:* a shared, scene-scoped reroll pool that grants chat rerolls to other actors.
- **One Last Chance.** Once per scene, an ally's failed Skill Test card gets a reroll-all-dice button while the holder
  is on the scene. *Needs:* a reroll granted to other actors (ally scope on `Reroll`) with an on-scene check and the
  holder's scene limit.
- **Nobility.** It lowers the Party's Story Points at the New Session reset (it recognizes the reset write in
  `preUpdateActor`). *Needs:* a Story Point session-reset modifier rule.
- **Service.** Trained in one chosen Limited weapon (Use-button pick stored on the Perk). *Needs:* a picker step that
  records a choice instead of granting, and a Qualification tag that reads the recorded uuids (the same as slB's One
  Bot Over Another).
- **Trade Goods.** Qualified in one chosen Limited/Restricted weapon. *Needs:* the same recorded-pick Qualification.
- **For The Syndicate.** The chosen-item Qualification with a plan choice. *Needs:* the same, plus a choice step that
  shapes the picks.
- **Good To Go.** The chosen-item Qualification (as above), and Kit prerequisites one Rank lower
  (`essence20.kitPrerequisite`). *Needs:* the recorded-pick Qualification and a Kit-prerequisite rule (as slB's
  Training Through Familiarity).
- **Ninpõ JOEs.** Two chosen Limited weapons, one of which must be Martial Arts. *Needs:* the recorded-pick
  Qualification with a dependent second pick.
- **Nothing Personal.** A free Silencer fitted to a chosen pistol, once. *Needs:* a step that attaches a granted
  upgrade to a picked owned weapon.
- **Spared No Expense.** Only the driving Qualification (Large/Long and smaller land vehicles) is left in code.
  *Needs:* `vehicle:size` and `vehicle:data:` tags (the crewed vehicle's own fields). The ↑1 comes only from the first
  qualifying Perk, so several of these Perks don't stack; the rules would also need a shared `stack` group. The
  untrained Snag is cleared as `options.snag = false` (any Snag), which isn't `immune: untrainedSnag`.
- **Surgical Operators.** Only the driving Qualification (vehicles that carry passengers) is left in code. *Needs:* the
  same `vehicle:data:` tag and dedup.
- **Ultra-Secret Strike Force.** Only the driving Qualification (Python Paint, or a name containing "python") is left
  in code. *Needs:* `vehicle:data:` and a vehicle name tag.
- **The Glory of Cobra-La.** The Biomechanical vehicle Qualification, and Snags for non-Biomechanical weapons
  (name regex, trait, or an attached Biomechanical Weapon upgrade; unarmed attacks exempt), worn battledress (name, or
  an attached Organic Armor upgrade) and vehicles. *Needs:* a tag for "has an attached upgrade with id X" (weapon and
  worn armor), a "wearing armor that matches X" tag, and the vehicle tags above. Its Qualification also stops the
  driving untrained-Snag lift.
- **Roaming the Land.** Trained in energized close-combat weapons: a melee weapon (some effect is melee style or has
  Reach) with an energy trait. *Needs:* an item tag for "this weapon has a melee effect" (it reads `system.items`
  entries or owned weaponEffects). Its upgrade Qualification was already a rule; `dice.mjs` reads the id for another
  half.
- **Tenacity.** Edge on save-card rolls (`dataset.riderSpec` JSON with `kind: 'save'`), and the turn-start card that
  ends effects running out this turn. *Needs:* a `roll:save` tag (`roll:dataset:` compares the whole JSON string), and
  a turn-start step that lists and ends expiring marks and Conditions.
- **Dome Generator.** A Free-action Use, once per scene for each copy on the same armor, that adds the host armor's
  Toughness/Evasion bonus again until the start of the next turn. *Needs:* a limit multiplied by the number of copies,
  and `@host.<path>` formula refs for a Defense rule (with a toggle that lasts until the next turn).

### Engine pieces the skips need

1. **A recorded-pick Qualification:** a picker step that stores chosen compendium uuids on the item, and a
   Qualification tag that reads them. That covers Service, Trade Goods, For The Syndicate, Good To Go, Ninpõ JOEs and
   Nu, Pogodi!'s weapon half, and slB's One Bot Over Another.
2. **Vehicle data tags** (`vehicle:size>=`, `vehicle:data:<path>`, a vehicle name tag), a shared `stack` group across
   the driving-Qualification ↑1s, and an "any Snag" lift. That covers the five driving Qualifications (Mega Training
   Regimen, Spared No Expense, Surgical Operators, Ultra-Secret Strike Force, The Glory of Cobra-La).
3. **Attached-upgrade and worn-armor tags** (The Glory of Cobra-La's Snags) and a "melee weapon" item tag (Roaming the
   Land).
4. **`roll:save`** (Tenacity's Edge).
5. **Rerolls granted to other actors** (Best-Laid Plans, One Last Chance) and an Initiative-formula reroll (Danger
   Sense).
6. **A Kit-prerequisite rule** (Good To Go), shared with slB.
7. **Per-target burning state with a turn-end roll by the marker** (Ignite, Fireball).
8. **A resource-cost multiplier** (Addicted), **a Story Point session modifier** (Nobility), **an attach-upgrade step**
   (Nothing Personal), and **per-copy limits with `@host.` refs** (Dome Generator).

### Files touched outside the slice

- `module/rules/conversions.test.js`: the `// slE q1` block, appended at the end. The import line is unchanged.
- Pack sources: `packs/iafav2items/_source/Nu__Pogodi__sItc8nD7ockbQ1mn.json` (2 rules) and
  `packs/fffav1items/_source/Mega_Training_Regimen_nLT8HSCCGWEBiRlq.json` (1 rule).
- No `lang/en.json` key became unused.

---

## Batch slE (part): the `qualify2` extension slice

**Scope:** every item in the id table of `module/helpers/extensions/qualify2/` (`Q2` in `common.mjs`, 22 items),
plus every other place in `module/` that uses those ids (`helpers/banked-buffs.mjs`, `dice.mjs`,
`helpers/combat.mjs`, `helpers/action-perks.mjs`, `helpers/trade-school.mjs`, `helpers/tech-specs.mjs`). Started
from `rules/slD` at 426d9555, pushed as `rules/slE-q2`.

Not item-specific (no verdict): `common.mjs` (the id table plus item/actor lookups shared by the other files),
`session.mjs`'s session counter (the `essence20.q2SessionEpoch` setting that the rules engine's `per: "session"`
limit reads, and the New Session detection), the "a granted copy flagged `qualified` is Qualified" branch of
`perkAccess` (keyed by a flag, not an id), the Trade School scene coach in `qualifications.mjs` (keyed by the
`pendingTradeSchool` flag), and the Upgrade-stacking helpers `isQualifiedUpgrade` / `effectiveAvailability` (they
also serve every Qualification rule's `upgrades`). All of these stay.

| Verdict | Count |
|---|---|
| Convert | **2** |
| Partial | **2** |
| Skip | **16** |
| Dead table entry, removed | **2** |
| Items | **22** |

4 rules were added to 4 pack items (Real Angels, Morale Booster, Whisper Warrior, Oorah!). `scripts/check-rules.mjs`
counts 1372 rules on 978 items, 0 errors, 0 warnings. No slice file became empty, so `extensions/index.mjs` is
unchanged.

#### Converted (2)

| Item | Rule | Why it's exact | Removed |
|---|---|---|---|
| Real Angels (WTNV) | Use, no cost, `limit: {per: session}`, steps `applyCondition cover` | The old Use (`banked-buffs.mjs`) toggled the `cover` status on the actor with no action cost, in or out of combat, and was gated by an encounter record that `session.mjs` re-stamped onto each new encounter until New Session cleared it - i.e. once per session. The `session` limit reads the same `q2SessionEpoch` counter New Session advances. `applyCondition` with no rounds is `toggleStatusEffect('cover', {active: true})` on the actor's own (owned) document. The button hides once used, as `canUsePerk` did. | `REAL_ANGELS_ID` / `REAL_ANGELS_ENCOUNTER_FLAG` and both branches in `banked-buffs.mjs` and their 4 tests; `Q2.realAngels`; its `SESSION_GATED` entry in `session.mjs` (the session test now uses Timeline Anomaly's record) |
| Morale Booster (EoC Perk) | Use, `cost: {action: standard}`, `limit: {per: rest, max: "@actor.system.essences.social.max"}`, steps `removeCondition frightened` and `removeCondition impaired` to `allies:30`, then a chat line | The old Use paid a Standard action through the same `pay`, counted uses on the Perk up to the Social Essence's max (the schema always has `max`) and cleared them on the sheet's Rest (`registerRest`), which is where the rules engine clears `rest` limits too. Allies came from `getNearbyAllyTokens(actor, 30)`; `allies:30` uses the same lookup (`worldLookups.alliesWithin`). Only a present Condition is toggled off, as before. The button hides with no uses left, as `canUse` did. A refused action spends nothing. | `Q2.moraleBooster`, `moraleBooster`, `moraleUsesLeft`, `moraleRest`, `MORALE_FLAG`, its `USES` / `canUse` entries and `registerRest` (and import) in `field-ops.mjs`, its test, `E20.Q2MoraleNoUses`, `E20.Q2MoraleUsed`, `E20.Q2Nobody` |

#### Partial (2)

| Item | Converted | Rule | Still code |
|---|---|---|---|
| Whisper Warrior (IA) | The "take a qualifying weapon" Use button | Use, steps `pickGrant {from: {type: weapon, tags: [item:trait:martialArts, item:trait:silent]}, flags: {qualified: true}}` | Requisition access for Silent Martial Arts weapons (`perkAccess`) - the old test reads `itemAndUpgradeTraits` (traits an attached upgrade adds count) and `item:trait:` reads only the stored `system.traits`; Defend as a Free action while wielding one (`WHISPER_WARRIOR_RULE`) - no tag for "has an equipped weapon with traits X and Y". |
| Oorah! (SSS) | The Use button (a Standard weapon or the Silent battledress upgrade, flagged Qualified) - its last qualify2 code; the Qualification / RollModifier / damage rules were already there | Use, steps `choose` between `pickGrant {from: {type: weapon, availabilities: [standard]}, flags: {qualified: true}}` and `grant {uuid: <G.I. Joe CRB Silent upgrade>, flags: {qualified: true}}` | The Land-vehicle Driving ↑1 in `dice.mjs` (`VEHICLE_QUALIFICATION_PERKS_BY_MOVEMENT_TYPE`): one shared, non-stacking ↑1 with the hand-written vehicle Qualifications, so a RollModifier (`vehicle:moves:ground`) would add a second ↑1 when combined - not in this slice either. |

Why the two Use buttons are exact: the old code ran `grants.mjs#pickAndGrant` = `findItems({type, availabilities?,
matches})`, `pickOne(perk.name, rows)`, `grantCopy(actor, uuid, {grantedBy: perk, flags: {qualified: true}})`.
`pickGrant` makes the same three calls (`integrated: false` and empty `system` change nothing). Compendium index rows
carry `system.traits` only (no `itemAndUpgradeTraits`), so `item:trait:` tests exactly what `traitsOf` did there
(both camelCase keys; the tag lowercases both sides). Oorah!'s two-button `chooseButtons` is a `choose` step with
the same two options in the same order; closing it does nothing and posts nothing, as before; a cancelled weapon pick
posts nothing.

#### Behaviour differences (all same-line - each affects only the item itself; none cross-line)

1. **Chat cards (all four).** The Use card is now the rules card: "**Item: label**" plus the step lines (Real Angels:
   the Condition line instead of `E20.PerkUsedNotification`; Morale Booster: a fixed line without the cleared allies'
   names or the uses left; Whisper Warrior / Oorah!: "Granted" instead of `E20.Q2TookQualified`). Oorah!'s choice
   dialog has no prompt line (`E20.Q2OorahPrompt` / `Q2StandardWeapon` / `Q2SilentUpgrade` are removed; the button
   labels are the rule's).
2. **Real Angels / Morale Booster: old counts are dropped once.** A Real Angels use made this session under the old
   code (`realAngelsUsedThisEncounter`) and a Morale Booster count since the last Rest (`flags.essence20.q2MoraleUses`
   on the Perk) aren't read by the rules' limits, so each is free again until the next session / Rest.
3. **Real Angels on unlinked token actors.** The old session carry only re-stamped world actors (active GM client), so
   a token actor's use expired with the encounter; the `session` limit holds for any actor.
4. **Morale Booster no longer changes your targets.** The old Use set the user's targets to the cleared allies (to let
   the GM relay the Condition removal); `removeCondition` relays through `gm-relay` for actors the user can't modify,
   without touching targets.
5. **Oorah!'s Silent upgrade copy** is made by the `grant` step: its source is stamped in `_stats.compendiumSource`
   instead of `flags.core.sourceId` (every reader in `module/` checks both), and it is created without
   `grantCopy`'s child-copy pass, which does nothing for an upgrade.

#### Skipped (16)

##### Qualification and training (`qualifications.mjs`)

- **Upgrade Training** - picks three Limited or one Restricted weapon upgrade, records them on the Perk and treats
  them as Qualified. *Needs:* a picker that records its picks (several, from one tier chosen first) plus a
  Qualification `upgrades` tag reading the recorded uuids.
- **Hardware Training** - Qualified in Restricted-or-lower two-handed Ballistic weapons, plus a take-one Use. *Needs:*
  an item tag for two-handed (any weaponEffect with `numHands` 2) and one reading `itemAndUpgradeTraits`.
- **Weapon Enthusiast (Perk)** - a chosen weapon type (flag), weapons matched by trait / one-handedness / name words
  or a manual tag, Qualified in Limited ones; a three-way Use (take / tag / change). *Needs:* a weapon-type choice and
  a "weapon is of type X" tag (the name heuristics), plus a Use that tags an owned item.
- **Weapon Enthusiast (Hang-Up)** - sets banked Lend Assistance aside for attacks with that type and restores it
  later. *Needs:* the weapon-type tag above and an Assist `refuse` that works on an already-banked assist.
- **Training Evolution** - picks an ally's weapon or crewed vehicle each mission; Trained and Specialized with it.
  *Needs:* a mission-scoped picker over another actor's items / vehicles and Qualification / specialize tags reading it.
- **Mentor** - a chosen Skill gains a chosen extra Essence (`skills.<skill>.essences.<essence>`). *Needs:* a two-step
  Skill + Essence choice and a DerivedStat whose path takes the choices.

##### Field ops (`field-ops.mjs`)

- **At Ease, Disease** - combat only, living target or self, the healing amount picker, Intimidation vs 5 + 5 per
  Health, `applyHealSkillTestResult`. *Needs:* a heal-Skill-Test step (the amount picker, DIF and result helper) and
  a "living target" condition.
- **Destructive Overcharge** - rigs an item (own or held by the target), explodes at the end of the next turn with a
  chat button: 3 Fire to the holder, Technology vs Toughness/Evasion in 20 ft. *Needs:* delayed rigs with chat
  buttons and a blast Skill Test over tokens around a point.
- **Cascading Failure** - rigs a device with a timer, Disable/Explode buttons, grenade or Table 9-4 explosion, vehicle
  explosion. *Needs:* the same rig/blast pieces plus timed expiry.
- **Opportunist** - a hit on a Stunned target extends the Stun by a round (Condition duration or `system.stun`).
  *Needs:* a step that extends a Condition's duration / Stun count.
- **Sensitive** - spends a Detail Oriented daily use to ignore the banked Snag this round. *Needs:* a Use cost on
  another item's daily counter (`actionPerkDailyUses.detailOriented`) and a round-scoped "ignore" mark read by the
  Snag bank.
- **Detail Oriented** - only read here for Sensitive's count; its own uses are `helpers/action-perks.mjs`
  (`ACTION_PERK_USES`). Goes with Sensitive.

##### Old Hand (`old-hand.mjs`)

- **Do Or Die** - a button on the posted check card: spend Moxie (2 for a second use per scene), roll a level-scaled
  die, rescore every target, extra damage buttons. *Needs:* a card reaction Use that adds to a posted total.
- **Wild Idea** - a dialog checkbox that spends Moxie and adds the Do Or Die die to the kept-highest pool. *Needs:* a
  DialogSwitch bonus pool die (`extBonusPoolDie`) with a level-scaled die.

##### Sessions (`session.mjs`)

- **Timeline Anomaly** - once per session, swaps Initiative with the target (`banked-buffs.mjs`,
  `swapInitiativeWithTarget`). *Needs:* a swap-Initiative step. Its session carry stays in `session.mjs`.
- **Everything is Inspiration** - a Story Point for each holder when a session begins (and, in `dice.mjs`, one when a
  Skill Test fails, once per scene). *Needs:* a `sessionStart` Trigger event.

#### Dead table entries, removed (2)

- **Trade School** and **Technical Mastery** - nothing in the slice read `Q2.tradeSchool` / `Q2.technicalMastery`.
  Their code lives elsewhere and stays: Trade School's Use (`helpers/trade-school.mjs`, `banked-buffs.mjs`) and its
  scene-long coach die (`qualifications.mjs`, keyed by the `pendingTradeSchool` flag) - *needs* a lend-another-actor's
  Skill die for a scene piece; Technical Mastery's remaining halves (`tech-specs.mjs`, `trade-school.mjs`).

#### Engine pieces the skips need

- **Requisition tags:** an item tag reading `itemAndUpgradeTraits`; two-handed / one-handed weapons; a weapon-type
  match (Weapon Enthusiast); a recorded-picks Qualification (Upgrade Training).
- **Recorded choices:** pickers that store their result on the item instead of granting (Upgrade Training, Training
  Evolution, Mentor, Weapon Enthusiast) and DerivedStat paths built from choices (Mentor).
- **An actor tag for wielded weapons:** "has an equipped weapon with traits X and Y" (Whisper Warrior's Free Defend).
- **Delayed effects:** rigs with chat buttons, end-of-next-turn / timed expiry, and a blast Skill Test around a point
  (Destructive Overcharge, Cascading Failure).
- **Steps:** heal Skill Test (At Ease, Disease), extend a Condition / Stun (Opportunist), swap Initiative (Timeline
  Anomaly), a cost on another item's daily counter (Sensitive).
- **A card reaction Use** on a posted check (Do Or Die) and a **DialogSwitch bonus pool die** (Wild Idea).
- **A `sessionStart` Trigger event** (Everything is Inspiration).
- **A shared stack group with hand-written roll sources** (Oorah!'s vehicle ↑1).

#### Files touched outside the slice

- `module/helpers/banked-buffs.mjs` - Real Angels' constants and both branches removed (one stale comment reference fixed).
- `module/helpers/banked-buffs.test.js` - Real Angels' tests and id removed.
- `module/rules/conversions-uses.test.js` - the `// slE q2` block appended at the end (import line unchanged).
- `lang/en.json` - removed `E20.Q2MoraleNoUses`, `E20.Q2MoraleUsed`, `E20.Q2Nobody`, `E20.Q2OorahPrompt`,
  `E20.Q2SilentUpgrade`, `E20.Q2StandardWeapon`.
- Pack sources: `packs/wtnvcgitems/_source/Real_Angels_i5hL9SSARFDMf6UH.json`,
  `packs/eocitems/_source/Morale_Booster_TQCvGZe5npeJ4heO.json`,
  `packs/iafav2items/_source/Whisper_Warrior_T4p7oPq8Kk0SHVb3.json`, `packs/sssitems/_source/Oorah__7CuDik9Vtpou9iDJ.json`.

---

## Batch slE (part): the `data1` and `data21` extension slices

**Scope:** every item in the id tables of `module/helpers/extensions/data1/` and `module/helpers/extensions/data21/`,
plus every other place in `module/` that uses those ids. Branch `rules/slE-data`, from `rules/slD` at 426d9555.

The id tables are:

- **data1:** `REINFORCED_SHELL` and `BRAWN_PERK` (Over Brawn, The Heavy, Pack Mule x2) in `armor-rules.mjs`, and
  `DINO` (Dino Thunder [Form], Dino Thunder Boost, Extra Dino Thunder Form Power, White Ranger Extra Dino Thunder) in
  `dino-thunder.mjs`.
- **data21:** `D21` in `common.mjs` (40 uuids: Stinger Spray, the Psycho Morpher, 6 Psycho Path Roles, 10 Psycho
  Weapons, the Psycho Blade / Staff effects, Larger Than Life, Mystic, Sorcery, the Hobnailed Boot / Iron Claw / BtH
  Melee Weapon effects, the three drone Defenses upgrades, Sky Morpher, Compassionate, Alternate Officer), and the
  "Finesse or Might" id lists in `weapons.mjs` (`CORE_BOOK_MELEE_EFFECTS`, `WTNV_MELEE_EFFECTS`,
  `TF_EXTRA_MELEE_EFFECTS`, 52 weapon effects).

| Verdict | data1 | data21 | Total |
|---|---|---|---|
| Convert | 0 | 4 | **4** |
| Partial | 0 | 0 | **0** |
| Skip | 8 | 13 | **21** |
| Reference only | 0 | 17 | **17** |

Counting: Pack Mule's two printings are one item. Stinger Spray's Perk, weapon and three attack effects are two items
(the Perk's grant, the attacks' cost). The 52 core-book / Night Vale / Transformers "Finesse or Might" effects are one
entry. "Reference only" are ids that carry no behaviour of their own: they only say which other item's behaviour
applies (Sorcery marks an actor as Mystical; the 6 Path Roles and 10 Psycho Weapons are the Psycho Kit's lists).

15 rules were added to 4 pack items. After this part, `scripts/check-rules.mjs` counts 1383 rules on 979 items (the
base was 1368 rules on 975 items), with 0 errors and 0 warnings.

**Files with no item-specific behaviour (out of scope):**

- `data1/equip-gate.mjs` - suppresses transferred Active Effects on unequipped armor (any armor; keyed by item type).
- `data1/weapon-rules.mjs` - the on-hit Condition button (keyed by the effect's `flags.essence20.onHitStatus`) and
  the Drive-By movement gate (keyed by `system.isRam` / `system.isFlyby`).
- `data1/armor-rules.mjs`'s Brawn requirement source (keyed by the armor's `flags.essence20.brawnRequirement`). Only
  `brawnRequirementBonus`, which reads `BRAWN_PERK`, is item-keyed.
- `data1/index.mjs`, `data21/data21.mjs` (imports only).
- `data21/weapons.mjs`'s Psycho Weapon alternate riders and the halved-Movement mark (keyed by the effects'
  `flags.essence20.d21Shove` / `d21HalveMovement` / `d21Disarm`).
- `data21/common.mjs`'s helpers (`sourceOf`, `findSourced`, `writeDoc`, `postLine`, `parentWeaponOf`...).

### Converted (4)

| Item | Pack file | Rules | Replaces |
|---|---|---|---|
| Compassionate | `packs/mlpcrbitems/_source/Compassionate_TARp0NItPetoMUv2.json` | DialogSwitch `{edge: true, forget: true, when: ["skill:persuasion"]}`; DialogSwitch `{edge: true, forget: true}`; Use `{steps: [{do: "roll", skill: "persuasion", dif: 12, onSuccess: [{do: "heal", amount: 1, to: "targetOrSelf"}], onFail: [{do: "chat", ...}]}]}` | `data21/compassionate.mjs` (all of it): the two dialog checkboxes, the apply-dialog Edge and the `d21Compassionate` Use |
| Basic Defenses | `packs/gijcrbitems/_source/Basic_Defenses_CQYBJKyLfPIUp1JG.json` | 4 x Defense `{defense: <d>, amount: "@item.system.armorBonus.value", stack: "droneDefenses-<d>", when: ["self:data:type=companion", "self:data:system.type=drone", "rule:data:system.type=drone", "rule:data:system.armorBonus.defense=<d>", "rule:data:system.armorBonus.value>0"]}`, one per Defense | `data21/gear.mjs#droneDefenseBonus` / `applyDroneDefenses` (registerDerived) |
| Advanced Defenses | `packs/gijcrbitems/_source/Advanced_Defenses_kow4o1ubo29p8b0D.json` | the same 4 rules | the same |
| Specialized Defenses | `packs/gijcrbitems/_source/Specialized_Defenses_qPYov7nAiPjYrD4Q.json` | the same 4 rules | the same |

Why these are exact:

- **Compassionate, switches.** The old toggles were extension checkboxes with no `value`, so they always started
  unticked. `forget: true` does the same. The first was offered only when `rolledSkill == 'persuasion'`, and the
  `skill:persuasion` tag is that same comparison. Both are offered wherever the old toggles were, because the rule
  switches come through the same `registerDialogToggles` call (skill rolls and Initiative). A ticked switch sets
  `options.edge`, as `compassionateApply` did. The Peace switch is listed before the Needs switch, as before.
- **Compassionate, Use.** The old Use took no action (`run` never called `pay`) and had no limit; the rule has no
  `cost` and no `limit`. `rollTest(actor, 'persuasion', 12)` is the same call the `roll` step makes. The heal target
  was `game.user.targets.first()?.actor ?? actor`, taken before the roll; `targetOrSelf` reads the targets collected
  when the run starts. The heal raises Health by 1, never past a positive maximum, and writes through the GM when the
  user can't, as `healOne` / `writeDoc` did.
- **Drone Defenses.** The old pass ran only on a `companion` actor whose `system.type` is `drone`, read only
  `upgrade` items of `system.type` `drone` with these ids, took `armorBonus.value` when above 0, kept the best value
  per Defense and added it to that Defense's total with ` + N (Drone Defenses)`. Each rule's `when` holds the same
  tests; the `stack` group per Defense (only these three items use it) keeps the strongest one; `addToDefense` writes
  the same total and breakdown. The upgrade's Defense may be any of the four (`E20.defenses`), so there is one rule
  per Defense. Both passes run in `registerDerived`. Every derived hook between the old position and the rules
  adapter that can reach a drone companion only adds to Defense totals, so the order doesn't matter. The one hook
  that sets a total outright, `other3/pr.mjs#applyMegaDefender`, applies only to a Ranger in a Mega Defender
  combination.

Removed: `data21/compassionate.mjs` (file, its import in `data21/data21.mjs` and in `extensions/index.mjs`); the drone
half of `data21/gear.mjs` (`DRONE_DEFENSES`, `droneDefenseBonus`, `applyDroneDefenses`, its `registerDerived` and the
now-unused `registerDerived` / `T` / `itemsOf` / `sourceOf` imports); the `basicDefenses`, `advancedDefenses`,
`specializedDefenses` and `compassionate` keys of `D21`; the "drone Defense upgrades" and "Compassionate toggles"
tests in `data21/data21.test.js`; the six now-unused `lang/en.json` keys `D21CompassionateFailed`,
`D21CompassionateNeeds`, `D21CompassionatePeace`, `D21CompassionateHealed`, `D21CompassionateFull`,
`D21DroneDefenses`. The replacement tests are in `module/rules/conversions-uses.test.js` (`// slE data`).

### Partial (0)

None.

### Behaviour differences

1. **Compassionate: chat text (same item, same line).** The Use card is the rules card: a success shows the step's
   heal line (0 when the target is already at full Health, where the old text said there was no damage to heal); a
   failure shows a fixed English line instead of the localized one.
2. **Compassionate: a maximum of 0 (same line).** The old heal did nothing when Health was at or above a maximum of 0;
   the `heal` step treats a maximum of 0 as no cap and adds 1. A maximum of 0 doesn't happen on a real character.
3. **Compassionate: switch order (cross-line, cosmetic + one corner).** The switches now come after every slice's
   dialog toggles, and their Edge is set after every slice's apply-dialog hook instead of before data22 onwards. The
   slices that cancel an Edge with a Snag (`mlp1`'s Face Shift Pass / Identity Crisis, `rules/grappled.mjs`, `zord1`
   forms) end with the same result, since an Edge and a Snag cancel at roll time - except that with two Edges (this
   one and another slice's) and one such Snag, the old order cleared both Edges and the new order leaves one.
4. **Drone Defenses: an upgrade attached to an unequipped item (same line).** A rule on an upgrade whose `parentId`
   host is unequipped is inactive (`isItemActive`); the old pass ignored attachment. Drone upgrades are not attached
   to anything in practice.
5. **Both: other copies.** The old code matched these compendium uuids; the rules follow the item, so any copy with
   the rules counts. There is one printing of each.

### Skipped (21)

#### data1

- **Reinforced Shell** (`armor-rules.mjs`: `countedShell` / `applyShellMode` derived, `shellStunBonus` hit rider).
  The derived half needs "counted" exactly as `documents/actor.mjs` counts the upgrade: a loose upgrade only with
  `canTransform` / `alterationWorn`, an attached one only when its host exists, is armor and is worn. `host:` tags are
  not static, so a DerivedStat can't ask about the host (a dangling `parentId` would subtract Toughness the actor
  never got). The Stun half: the old note was added for any copy even on an unworn host and whatever the hit's
  damage value; a dealt DamageModifier needs the item active and `result.damageValue` above 0. *Needs:* a static
  `rule:host:` tag (the rule item's host and its `equipped`), and an unscaled dealt DamageModifier that doesn't need
  a damage value.
- **Over Brawn, The Heavy, Pack Mule (x2)** (`brawnRequirementBonus`: ignore / +2 / +2 die sizes for the armor Brawn
  requirement). *Needs:* a rule type for equipment-requirement Brawn (ignore, or N die sizes), read by
  `brawnShortfall` (and the weapon requirement code, which reads these Perks separately).
- **Dino Thunder [Form], Dino Thunder Boost, Extra Dino Thunder Form Power, White Ranger Extra Dino Thunder**
  (`dino-thunder.mjs`). Uses that pick a power from a fixed list once and store it on another item's flag, a
  3-point Boost pool that pays only for the holder's own Form power before Personal Power, refilled on Rest, a
  picker over every teammate's stored powers, an `essence20.dinoThunderActivated` hook call and an actor flag that
  Morphing clears. *Needs:* a stored pick on another item, a pool restricted to one use with fallback to another
  resource, a world-wide picker over other actors' picks, a custom hook call step, and a `morph` Trigger that clears
  a flag set by a step (the Form id is also read by `zord1/forms.mjs`).

#### data21

- **Stinger Spray (Perk)** (`psycho.mjs#grantStingerSpray` / `dropStingerSpray`). A Grant rule with `skipIfOwned`
  would add the weapon, but removing the Perk deletes only the granted weapon, not the attack effects attached to it
  (the old code deleted those too). *Needs:* Grant removal that also removes the granted items' attached children.
- **Stinger Spray (attack, 3 effects)** (`stingerSprayCost`, preRoll): pays 1 Personal Power as the attack is rolled,
  with warnings (not a block) when not in Monster Form or out of Power. *Needs:* a per-attack cost on a weapon effect
  that warns instead of refusing.
- **Psycho Morpher** (`usePsychoKit`): a Use whose options depend on the holder's Path Role (6 lists), granted once
  and offered again only once that weapon is gone (`d21PsychoKitWeapon`). *Needs:* role-dependent ChoiceSet options
  and a "granted item still exists" tag.
- **Larger Than Life** (`largerThanLifeReach`): every melee effect's `totalReach` becomes at least Large reach times
  that effect's own `reachMultiplier`, skipping non-finite reach. ItemModifier formulas resolve against the rule's
  item, not the modified one, and it would write a reach where there was none. *Needs:* an `@other.<path>` formula
  ref in ItemModifier, and an ItemModifier that leaves a missing value alone.
- **Mystic** (`mysticSources` ↑1 on attacks against a Non-Mystical target; `mysticDefense` ignores Toughness armor).
  *Needs:* `check:nonMystical` (`threats.mjs#isNonMystical`: the `d21Mystical` override flag, Mystic/Sorcery items,
  sorcerous Powers and traits), and an outgoing Defense mode that removes the armor part (`armor` / `morphed`) unless
  the target is `armorStripped`.
- **Sky Morpher** (`skyMorpherSources`): ↑1 Driving only while driving the Ranger's OWN Zord (listed on the sheet or
  `companionOf`), from the Ranger or from the Zord with its driver's Morpher; the Morpher counts whether or not it's
  equipped. *Needs:* a "driving own Zord" tag, and a way to count unequipped gear.
- **Alternate Officer Equipment Training** (`officer.mjs`): a Use that rewrites `system.trained.*`, then a picker of
  Limited melee weapons whose choice is stored and made Qualified at Requisition (`essence20.requisitionAccess`).
  *Needs:* a step that writes actor fields once, and a Qualification for a stored pick.
- **Hobnailed Boot, Iron Claw, BtH Melee Weapon, Psycho Blade, Psycho Staff effects, and the 52 core-book / Night Vale /
  Transformers "Finesse or Might" effects** (`weapons.mjs#finesseOrMight`, preRoll: roll the better of Finesse and
  Might). SkillSubstitution `bestOf` with `item:own` and `stacks: true` matches the swap itself, but it reads only
  rules on the roller's own items: a crew member or pilot rolling a vehicle's or Zord's weapon effect
  (`childRoller` in `documents/item.mjs`) would no longer swap. *Needs:* SkillSubstitution read from the rolled item
  itself (an "item" scope), whoever rolls it.

### Reference only (17)

- **Sorcery** - only marks its holder as Mystical for Mystic (stays with Mystic). Its id is also used by
  `other2/magic.mjs` and `sheet-handlers/perk-handler.mjs`, not touched.
- **Path of Cruelty / Flame / Frost / Stone / Thorns / Venom** (6 Roles) - the Psycho Kit's lists (stay with the
  Psycho Morpher). Path of Cruelty's id is also used by `monster-morph.mjs` and `react/forms.mjs`, not touched.
- **Psycho Axe / Blade / Blaster / Bow / Dagger / Scythe / Staff / Slinger / Sword / Trident** (10 weapons) - the
  Psycho Kit's options (stay with the Psycho Morpher).

### Engine pieces the skips need

- **SkillSubstitution on the rolled item** (whoever rolls it) - all the "Finesse or Might" weapons.
- **Grant removal that takes the granted item's attached children** - Stinger Spray.
- **Static host tags** (`rule:host:equipped`, host exists) and a dealt note without a damage value - Reinforced Shell.
- **`@other.<path>` in ItemModifier** (the modified item) - Larger Than Life.
- **`check:nonMystical`** and an outgoing "ignore armor" Defense mode - Mystic.
- **An equipment-requirement Brawn rule** - Over Brawn, The Heavy, Pack Mule.
- **Stored picks**: on another item, role-dependent options, a granted-item-exists tag, a Qualification for a stored
  pick, a one-time actor-field write - Dino Thunder x4, Psycho Morpher, Alternate Officer.
- **A per-attack cost that warns instead of refusing** - Stinger Spray's attacks.
- **A "driving own Zord" tag** - Sky Morpher.

### Files touched outside the slices

- `packs/mlpcrbitems/_source/Compassionate_TARp0NItPetoMUv2.json`,
  `packs/gijcrbitems/_source/{Basic,Advanced,Specialized}_Defenses_*.json` (rules inserted as text, LF kept).
- `module/helpers/extensions/index.mjs` (the `data21/compassionate.mjs` import line removed).
- `lang/en.json` (six keys removed as lines).
- `module/rules/conversions-uses.test.js` (one `describe('slE data')` block appended at the end; import line
  unchanged).

---

## Batch slE (part): the `data22`, `mlp1` and `mlp2` extension slices

**Scope:** every item in the id tables of `module/helpers/extensions/data22/`, `mlp1/` and `mlp2/`, plus every other
place in `module/` that uses those ids. The tables are `GEAR22` (`data22/gear.mjs`, 2 keys), `MLP22` (`data22/mlp.mjs`,
3 keys), `WEAPON22` (`data22/weapons.mjs`, 4 keys), `MLP1` (`mlp1/mlp1.mjs`, 18 keys) and `MLP2` (`mlp2/mlp2.mjs`, 10
keys). That is 37 entries: 36 items, plus the Demolecularization Gun Effect, which only says which weapon effect counts
as the Demolecularization Gun. Branch `rules/slE-dmlp`, from `rules/slD` at 426d9555.

Outside the slices, two places touch these ids or flags:
- `helpers/magically-fit-in.mjs` reads the Mystical Understanding id. It stays, because Mystical Understanding stays code.
- `extensions/rules/grappled.mjs` reads the `d22AssaultClawGrapple` flag that the Assault Claw sets. It belongs to the
  `rules` slice and is unchanged.

| Verdict | data22 | mlp1 | mlp2 | Total |
|---|---|---|---|---|
| Convert | 0 | 1 | 0 | **1** |
| Partial | 0 | 1 | 1 | **2** |
| Skip | 8 | 16 | 9 | **33** |
| Items | 8 | 18 | 10 | **36** |

6 rules were added to 3 pack items. `scripts/check-rules.mjs` now counts 1374 rules on 978 items (the base was 1368
rules on 975 items), with 0 errors and 0 warnings. ESLint is clean and jest passes (502 suites; 9613 passed,
2 skipped). No slice file became empty, so `extensions/index.mjs` is unchanged.

**Files with no item-specific behaviour (out of scope):**
- `data22/conditions.mjs`, all of it. The Poisoned and Hate Plague rules are keyed by a status id (`poisoned`,
  `hatePlague`), not by an item: poison damage, held healing, the Rest damage, the Hate Plague status and its roll
  sources, Resistance, immunity and spreading.
- `data22/shared.mjs`: helpers only.
- `mlp1/mlp1.mjs`, the `deleteCombat` hook that clears `pointyActive`. It is keyed by a flag; Pointy's own code is
  elsewhere.
- `mlp2/mlp2.mjs`, the `registerSceneAdvanced` hook that removes Bestow Expertise's Specializations. It is keyed by the
  `bestowedExpertise` flag, and Bestow Expertise has no id in these tables. The `registerRest` Essential Research undo
  belongs to Mystical Understanding and stays with it.

#### Converted (1)

- **Key to Whinnypeg** (`packs/iajitems/_source/Key_to_Whinnypeg_6HJlO4qnOTRqrOmF.json`)
  - Two DialogSwitches with `forget: true` and `stack: "keyToWhinnypeg"`: ↑2 ("Dealing with Whinnypeg VIPs") and ↑1
    ("Dealing with other VIPs").
  - Their `when` is `{any: [skill:animalHandling, skill:deception, skill:performance, skill:persuasion,
    skill:streetwise]}` plus `not:rule:data:system.quantity<=0`.
  - The Skill list is exactly the Skills that `E20.skillToEssence` maps to `social`. The old code asked
    `skillToEssence[rolledSkill]`, not the roll's Essence, so `essence:social` would not match it.
  - `not:...<=0` keeps the old `quantity ?? 1` default: a missing quantity counts as carried.
  - The stack group means that ticking both counts only ↑2. The old select allowed only one choice.
  - Removed from `mlp1.mjs`: the `keyToWhinnypeg` key, the `carries` helper, the select toggle, its apply line and the
    now-unused `essenceOf`. Removed from `lang/en.json`: `Mlp1ToggleWhinnypeg`, `Mlp1WhinnypegLocal` and
    `Mlp1WhinnypegOther`. No old test covered it.

#### Partial (2)

- **Mrs. Doubleshoe's Prize Honey** (`packs/dsoeitems/_source/Mrs__Doubleshoe_s_Prize_Honey_tbBjkVhSSc3Zj9zp.json`)
  - The dialog switch is now a DialogSwitch `{upshift: 2, forget: true, when: ["not:rule:data:flags.essence20.usesLeft<=0"]}`.
    That matches the old `(usesLeft ?? 3) > 0`.
  - Removed: the `prizeHoney` toggle and its apply line in `mlp1.mjs`, and `Mlp1ToggleHoney`.
  - **Stays code:** the `mlp1Honey` Use (heal the target or self by up to 3, three uses), which writes the
    `usesLeft` flag the switch reads, so the `prizeHoney` key stays.
  - Why the Use stays: the uses live in `flags.essence20.usesLeft`. A `Pool` would keep them somewhere else, and owned
    copies would start with an empty pool, so they could not be used (lifecycle only fills a pool when an item is added).
    The `heal` step also differs: it never lowers Health that is already above the maximum, and the old code did.
- **Wheel Excited** (`packs/mlpcrbitems/_source/Wheel_Excited_nJP3Jv15O5MFTNcA.json`)
  - The dialog switch is now three DialogSwitches `{edge: true, forget: true}`, one each for
    `rule:data:flags.essence20.vehicleType=land` / `sea` / `air`, labelled "Land / Sea / Air vehicle test (Wheel
    Excited: Edge)".
  - Removed: the toggle, its apply line and the unused `label` helper in `mlp2.mjs`, and `Mlp2ToggleVehicle`.
  - **Stays code:** the `mlp2Wheel` Use that picks the type into that flag, so the `wheelExcited` key stays.
  - Why the Use stays: a ChoiceSet would store the pick under `flags.essence20.rules.choices`, and the picks already
    made on owned copies would be lost.

New tests are appended to `module/rules/conversions.test.js` under `// slE dmlp`.

#### Behaviour differences

All are same-line. None is cross-line: every converted switch only adds its shift or Edge, and the old apply
functions only added theirs too (the guide's Edge/Snag equivalence covers `edge()`).

- **Key to Whinnypeg and Prize Honey (gear):**
  - Gear rules only apply while the gear is equipped. Gear defaults to equipped, and the old code did not check it,
    so unequipped gear no longer offers its switches.
  - With two copies, the first active copy decides (`collectRules` counts a non-stacking item once). The old Key
    toggle appeared if any copy had a quantity above 0.
- **Key to Whinnypeg:** two checkboxes replace the "None / ↑2 / ↑1" select.
- **All three:** labels are fixed English rule labels instead of localized strings. Wheel Excited's label no longer
  shows the Perk's (possibly renamed) item name or a localized vehicle-type word.

#### Skipped (33)

**data22**

| Item | Why it stays code / what is missing |
|---|---|
| Data-Link | At the owner's turn end: +1 Evasion until their next turn, if any of their drones carrying the upgrade (on the drone or the owner) was not commanded this round (the `petCommand` flag). Needs a tag for "a companion drone with this item, not commanded this round" (no companion-state tags exist). |
| Transmetal | In Alt Mode, the chosen Movement gets +20 (if the Alt Mode already has 2+ types and this one) or is raised to 40. It is added in `registerDerived`, after `_applyGravityMovement`, so Movement's `final` stage (before gravity) changes Low/Zero Gravity results. Also needs a movement type taken from `system.choice` and comparisons in formulas. |
| Fresh Mark | Edge on the first Deception test against each creature. A `mark` on the target plus `markedByMe` comes close, but a mark key holds one setter: a second Fresh Mark holder deceiving the same creature overwrites `by`, and the first holder would get Edge again. It would also write to enemy actors through the GM instead of to the holder. Needs per-setter marks (or a holder-side remembered-creature list). |
| Natural Style | ↑1 on Social tests with a creature for the scene of first meeting only, never in later scenes. Needs a permanent per-creature "met" stamp written only for creatures not met before. That means per-recipient conditional steps, plus the per-setter marks above. |
| Smoke Screen | Use: a Standard action, a clicked canvas point, Blinded for 1 round on every token within 20 ft, quantity −1. Needs a canvas-point / area recipient step and a quantity-spend step. |
| Assault Claw | A Grapple hit sets `d22AssaultClawGrapple`, which `extensions/rules/grappled.mjs` (another slice) reads for the escape Snag. A rule mark would be a different flag. It can move only together with grappled.mjs. |
| Demolecularization Gun (+ its Effect) | A hit marks the target for the scene; then anyone's attacks that deal Sharp damage (primary or secondary) against it get Edge. The Edge must apply to attackers who don't hold the gun. Needs a mark that carries its own rule (or a global "against marked targets" source), and a secondary-damage-type tag. |
| Primeon Blade | A hit on a Combiner Megaform posts one button per component member; the button deals 1 Energy damage to that member. Needs chat buttons and a megaform-participant recipient. |

**mlp1**

| Item | Why it stays code / what is missing |
|---|---|
| Shape-Shift (Origin), Face-Shift, Master Morph, Size-Shift | Shared Use: a dialog of Face/Morph Skill picks and a size step per Size-Shift copy, stored as the per-scene `mlpShape` flag (size restored when it ends). Needs a multi-pick dialog step with stored per-scene choices and a size-change step with an undo. |
| Face-Shift (sources), Master Morph (sources) | ↑1 / ↑2 on the Skill picked in the shape flag. Depends on that stored per-scene pick. |
| Basic Shape-Shifting, Ponymorph | A successful cast sets `mlpShape.spell`; then Edge on Deception/Infiltration, labelled by which spell. Depends on the shape state (scene-stamped flag). |
| Identity Crisis | Edge switch while shaped (`mlpShape` this scene) or disguised (`dsoeDisguiseActive`). "This scene" means a flag stamp compared to the scene epoch, which no tag reads. Needs a `check:` for shape-shifted, or a scene-epoch data compare. |
| Brilliant Sight | Spell-cost +1 option (fog), and on a success a temporary darkvision 120 item for the scene on the target or self. Needs a spell-cost rule and a "temporary Sense on another actor" step. |
| Far-Sighted | Default-ticked Snag switch on Alertness tests while an equipped weapon has a non-melee effect. Needs an "equipped ranged weapon" tag or check. |
| Illusion Casting, Reach Out | Spell-cost dialog options (cost 1; +1 for double range). Needs a SpellCost rule type. |
| Pinkie Sense | On a successful cast, rolls a d8 and posts a table result. Needs a dice-roll / table chat step. |
| Softenblows | On a success, marks the target until the end of *its* next turn; its hits then deal no damage. Needs `until: endOfNextTurn` of the target and an outgoing-damage negation for a marked attacker. |
| Sharpcaster | After a cast that hit no targets, a free re-cast button. Needs chat buttons and a "repeat this roll free" step (also zeroes the spell cost). |
| Smoke Bomb | Use: a clicked canvas point stores a 10x10 cloud for the scene; anyone rolling Alertness inside one takes ↓1. Needs a canvas-point step and a positional area roll source. |
| Sorcerous Support | Readies a once-per-mission re-roll button on an ally's fumbled chat card. Needs chat-card buttons on other actors' rolls. |

**mlp2**

| Item | Why it stays code / what is missing |
|---|---|
| Waterrunning | A successful cast activates a scene window on the target or self, whose own Acrobatics rolls then offer a ↓1 switch. The switch sits on an actor who doesn't hold the spell. Needs a mark that carries its own rule (a status-like effect). |
| Extra Effective Spell, Long Lasting Spell | Spell-cost dialog: double the cost. Needs a SpellCost rule type. |
| Mystical Understanding | Use: Refocus (Standard, 2 Mystical Points, Spellcasting shiftDown reset), Essential Research (Essence +1 until Rest, 3 per day) or Magically Fit In. Also Spellcosting in the spell-cost dialog. Needs a SpellCost rule, a Skill-shift write step and Essence-maximum changes with an undo on Rest. |
| Friendship Is Mystical | Use on a targeted friend: Fit In / Fortify / Heal, paid from the holder's Mystical Points, written to the friend's flags. Needs writes to other helpers' flags, and a heal amount capped by both missing Health and points. |
| Reactionary | Free action, once per round, if not first: re-roll Initiative. Needs an Initiative re-roll step and a per-round limit counted by round number. |
| Thick Skin | Use: pick one Defense per tier (7th/15th) and enable or disable the item's Active Effects. Needs an Active-Effect toggle step. |
| Screech | Use: creates an inline natural weapon and its effect (no compendium entry), offered once. Needs a "create item from data" step (Grant needs a uuid). |
| Something Is Off | The roller's switch "conning the target", offered when a target holds it; +1 Cleverness per copy (up to 4) on that defense. Needs an incoming DialogSwitch / defender rule that reads the roller's switch. |

#### Engine pieces the skips need

- **A SpellCost rule** (spell-cost dialog options: set, add, double, spend points): Illusion Casting, Reach Out, Brilliant
  Sight, Extra Effective Spell, Long Lasting Spell, Mystical Understanding (Spellcosting).
- **Marks that carry a rule,** so someone without the item is affected: Demolecularization Gun, Waterrunning.
  **Per-setter marks:** Fresh Mark, Natural Style.
- **Canvas / area steps:** a picked point and recipients within a radius, plus positional roll sources (Smoke Screen,
  Smoke Bomb).
- **Chat buttons on other actors' cards** and a "repeat this roll free" step: Sharpcaster, Sorcerous Support, Primeon
  Blade.
- **Stored per-scene picks** (Skills, size) with undo: the shape-shifting group. Also a `check:` for shape-shifted
  (Identity Crisis).
- **Item / document steps:** create an item from data (Screech), toggle Active Effects (Thick Skin), quantity spend
  (Smoke Screen), Skill-shift and Essence-maximum writes with a Rest undo (Mystical Understanding), Initiative re-roll
  (Reactionary).
- **Tags:** an equipped ranged weapon (Far-Sighted), secondary damage type (Demolecularization Gun), companion drones
  not commanded this round (Data-Link).
- **Movement after gravity** (a post-`_applyGravityMovement` stage) and comparisons in formulas (Transmetal).
- **Durations:** `until: endOfNextTurn` of the target (Softenblows).
- **An incoming DialogSwitch** (Something Is Off), also wanted by slD.

#### Files touched outside the slices

- `packs/iajitems/_source/Key_to_Whinnypeg_6HJlO4qnOTRqrOmF.json`,
  `packs/dsoeitems/_source/Mrs__Doubleshoe_s_Prize_Honey_tbBjkVhSSc3Zj9zp.json`,
  `packs/mlpcrbitems/_source/Wheel_Excited_nJP3Jv15O5MFTNcA.json`: rules inserted as text (LF kept).
- `lang/en.json`: removed `Mlp2ToggleVehicle`, `Mlp1ToggleHoney`, `Mlp1ToggleWhinnypeg`, `Mlp1WhinnypegLocal` and
  `Mlp1WhinnypegOther` (line deletions only).
- `module/rules/conversions.test.js`: the `describe('slE dmlp', ...)` block appended at the end. The import line is
  unchanged.

---

## Batch slE (part): the `wtnv`, `r2misc`, `rules` and `fix3-dice` extension slices

**Scope:** every item in the id tables of `module/helpers/extensions/wtnv/`, `r2misc/`, `rules/` and `fix3-dice/`, plus
every other place in `module/` that uses those ids. The tables are `WTNV` (`wtnv.mjs`, 13 keys), `DOMINATE_ID`
(`r2misc/dominate.mjs`, also read by `helpers/power-use.mjs`) and `SHADOW_ID` (`fix3-dice/shadow.mjs`, also read by
`helpers/banked-buffs.mjs` and `dice.test.js`). That makes 15 items. Branch `rules/slE-misc`, from `rules/slD` at 426d9555.

| Verdict | wtnv | r2misc | rules | fix3-dice | Total |
|---|---|---|---|---|---|
| Convert | 4 | 0 | 0 | 0 | **4** |
| Partial | 0 | 0 | 0 | 0 | **0** |
| Skip | 9 | 1 | 0 | 1 | **11** |
| Items | 13 | 1 | 0 | 1 | **15** |

This part added 4 rules to 4 pack items (Nobility already had a rule). After it, `scripts/check-rules.mjs` counts 1372
rules on 978 items, with 0 errors and 0 warnings.

Out of scope (nothing keyed by an item id):

- `r2misc/commander.mjs`: the Commander Use matches any `megaformTrait` whose `system.type` is `commander`. It is keyed by
  item type, not by a compendium id.
- `rules/grappled.mjs`: the Grappled condition's own Snag switch, plus `grappleEscapeSkills` / `clawGrappled`, which
  other slices use. It is keyed by the `grappled` status and the Assault Claw scene mark. It is condition code, not
  the rules engine's registration glue, and not item behaviour, so it is left alone.

No slice file became empty, so `extensions/index.mjs` and every slice test file stay.

### Converted (4)

| Item | Pack file | Rule | Removed |
|---|---|---|---|
| The List | `wtnvcgitems/_source/The_List_uqGXmxShRuAWsJd1.json` | Use `{limit: {per: scene, max: 1}, steps: [chat]}` | `WTNV.theList`, the `wtnvTheList` Use |
| Double Vision | `wtnvcgitems/_source/Double_Vision_lyQvLPv3enKlVpHj.json` | Use `{limit: {per: mission, max: 1}, steps: [{do: grantActions, standard: 1}, chat]}` | `WTNV.doubleVision`, the `wtnvDoubleVision` Use |
| Nobility (Wealth Use) | `fgtaaitems/_source/Nobility_5ZUcDuVx1pJ1R1RG.json` | second rule: Use `{limit: {per: mission, max: 1}, steps: [chat]}`, next to the existing ↑1 DialogSwitch | `WTNV.nobility`, the `wtnvNobility` Use |
| More Than Worldly | `fgtaaitems/_source/More_Than_Worldly_NtRsn6nTuys26ltH.json` | Use `{cost: {action: free}, limit: {per: turn}, steps: [{do: bank, edge: true, appliesWhen: ["not:roll:initiative"], to: targetOrSelf}]}` | `WTNV.moreThanWorldly`, the `wtnvMoreThanWorldly` Use, the `moreThanWorldlyEdge` roll source and its `moreThanWorldly` consumer |

Why the rules are exact:

- **The List / Nobility / Double Vision:** the old `canUse` was `getUses(actor, key, window) < 1` and the old `run` called
  `markUsed(actor, key, {window})`. A Use `limit` with `per: scene` / `mission` does the same through the same Scene
  Clock (`limits.mjs#usesInWindow` / `recordUse`), only under a `ruleUses.*` key. None of these Uses had an action cost.
- **Double Vision's action:** the old code called `grantActionsThisTurn(actor, {standard: 1}, item.name)` when
  `game.combat` existed. The `grantActions` step calls the same function with `{free: 0, move: 0, standard: 1}`, the
  item name and `granter: actor`. `grantActionsThisTurn` does nothing (returns false) when the actor has no combatant,
  which covers "no combat". `offerThisICommand` returns false when the granter is the actor itself, so the extra
  `granter` changes nothing.
- **More Than Worldly:** the old flag was offered as an Edge roll source on every roll that reaches
  `rollRiderSources` -> `extRollSources`, and was used up by that roll. The rules bank goes through the same channel
  (`ruleRollSources` is a registered roll source). Initiative calls `ruleRollSources` directly, but never called the old
  wtnv source, so `appliesWhen: ["not:roll:initiative"]` keeps initiative out. The recipient is `targetOrSelf`, the
  same as `game.user.targets.first()?.actor ?? actor`. The bank is written through the GM relay, like the old
  `relayToGm(... 'setFlag' ...)`. Its label defaults to the item name, which is what the old source used. Two pending Edges
  (from two turns) are both used up by the next roll, the same as the old flag, which was overwritten and used up once.
  The Free action is paid through the same `pay`.

Removed alongside them: the `getUses` / `markUsed` import and `registerConsumer` from `wtnv.mjs`, the More Than Worldly
test in `wtnv.test.js`, and five `lang/en.json` keys that are now unused (`WtnvDoubleVision`, `WtnvTheList`,
`WtnvNobilityWealth`, `WtnvOncePerTurn`, `WtnvMoreThanWorldly`). The new tests are the `describe('slE misc')` block
at the end of `module/rules/conversions-uses.test.js`.

### Partial (0)

None.

### Behaviour differences

All of these are same-line (each item on its own, all Night Vale / Field Guide); none is cross-line.

1. **The List, Double Vision, Nobility, More Than Worldly: chat text (same-line).** The card is now
   `<strong>Item</strong><br>` plus a fixed English line from the rule, instead of a localized `lang/en.json` string.
   More Than Worldly's line is the bank step's generic "banked Edge" line, which names the ally.
2. **The List, Double Vision, Nobility: use already spent (same-line, one-off).** A use marked under the old Scene
   Clock keys (`theList`, `doubleVision`, `nobilityWealth`) isn't seen by the rule's `ruleUses.*` key. So on the day
   this ships, a use already spent in the current scene / mission is available again once.
3. **More Than Worldly: a combat that exists but hasn't started (same-line).** The old once-per-turn check
   (`hasUsedThisTurn` / `markUsedThisTurn`) counted in any existing combat. The rule's `per: turn` limit counts only in
   a started combat, so before the first turn the button can be pressed more than once. It is still unlimited outside
   combat, as before.
4. **More Than Worldly: pending Edge (same-line, one-off).** An Edge already granted through the old
   `moreThanWorldlyEdge` flag but not yet rolled is no longer offered after the update.

### Skipped (11)

- **Obsessive (wtnv).** The Use picks a Skill and stores it on the Hang-Up's flag. Every other Skill's roll gets a
  ↓1 source. Needs: a Use step that (re)sets a stored Skill choice on the item (a re-choosable ChoiceSet), plus a
  `skill:` tag that compares with it, or `not:skill:{item.choice}` with that choice in `system.choice`.
- **Dog Person (wtnv).** ↑1 and Specialized in Animal Handling against a target whose creature tags or name match
  `/\b(dog|coyote|canine)s?\b/`. Without such a target it is a ↑1 dialog switch that also specializes Animal Handling.
  `target:name~` is a plain "contains" test and can't read creature tags. Needs: a creature-kind / regex target tag, and
  a DialogSwitch whose `specialize` holds only for one Skill.
- **Third Eye (wtnv).** A switch that removes the first ↓1 at the wtnv apply-dialog position. That is before the
  zord slices' hooks and the rules' own DialogSwitch downshifts. RollModifier `ignoreDownshift` applies after all of
  them, so a later downshift would be removed when it wasn't before. Needs: `ignoreDownshift` on a DialogSwitch,
  applied at a fixed point (the same gap as regA2's Inventor).
- **Delicate Stomach, Pincers, Quills, Serrated Tail (wtnv).** On a companion, adding the Perk (`createItem` hook)
  and the Use both build a natural weapon + weaponEffect pair in code (Hairball / Pincers / Quills / Serrated Tail).
  Those weapons are not compendium entries, so a Grant has nothing to point at. Needs: compendium natural-attack items
  (then a Grant rule `{scope: companion?}` or an `added` Trigger), or a grant step that builds an item from inline data.
- **Replacement Teeth (wtnv).** The old Use checks for a target BEFORE paying the Standard action (no target: a
  warning, nothing spent), then applies Immobilized for 1 round. A `target` step runs after the cost (the same gap as
  slD's Lance of Light). Needs: a target check before the cost.
- **Staggering Sway (wtnv).** +1 Stun on any hit dealing Stun, by anyone with the same token disposition anywhere in the
  world (not only allies in range or on a Party roster). No scope reaches "every same-side actor". Needs: a
  world/disposition-wide scope for a dealt DamageModifier (note mode).
- **Dominate (r2misc).** A nanomite power: activation runs through `power-use.mjs#onPowerUse` (infect on a Targeting
  test vs Evasion, refund the daily use when there's no target or a victim is already held), a stored victim, and chat
  buttons (Command: Persuasion with Edge and a cumulative ↓1 vs a chosen Willpower / Cleverness, then a Restrained /
  Mesmerized / order choice; Recall: 1 damage to both). Needs: power-activation rules, stored victim state, chat-card
  buttons and range gates.
- **Shadow (fix3-dice).** A switch on the ROLLER's dialog, offered when the roller's target holds Shadow and is
  Infiltrating, ticked by default for a non-attack Alertness test, ↓2 when ticked. `banked-buffs.mjs` also gives it an
  Infiltrating toggle Use, which it shares with Silent Strider. Needs: an incoming DialogSwitch (one on the target's item
  shown to the attacker) with a per-roll default, and `check:infiltrating`.

### Engine pieces the skips need

- An incoming DialogSwitch with a conditional default (Shadow; also listed by slD).
- `ignoreDownshift` on a DialogSwitch, applied at a fixed point (Third Eye; also regA2's Inventor).
- A target check before a Use's cost (Replacement Teeth; also slD's Lance of Light).
- A re-choosable stored Skill on an item, readable by `skill:` tags (Obsessive).
- A creature-kind / regex target tag (Dog Person).
- Building a granted item from inline data, or compendium natural attacks (the four pet attack Perks).
- A world-wide same-disposition scope for dealt damage notes (Staggering Sway).
- Power-activation hooks, stored victim state and chat buttons (Dominate).

### Files touched outside the slices

- `packs/wtnvcgitems/_source/The_List_uqGXmxShRuAWsJd1.json`, `packs/wtnvcgitems/_source/Double_Vision_lyQvLPv3enKlVpHj.json`,
  `packs/fgtaaitems/_source/Nobility_5ZUcDuVx1pJ1R1RG.json`, `packs/fgtaaitems/_source/More_Than_Worldly_NtRsn6nTuys26ltH.json`
  (rules inserted as text, LF kept).
- `lang/en.json` (five lines removed).
- `module/rules/conversions-uses.test.js` (one `describe('slE misc')` block appended at the end; the import line is unchanged).
