# Batch slE10: group E's round-10 engine pieces (picks, grants, item data, small tags / events) and the items they unblock

**Scope:** section "## E" of the round-10 groups list - the skips that slB9 (2, 8, 12, 13: Training Through Familiarity),
slC9 (1, 2, 5, 6: Weather Gear, Acclimating, Misguide, Plow; 9: Peak Performance; 10), slD9 (1, 2, 3, 9, 12: Revengeful) and slE9
(7, 8, 9, 15: Thick Skin, Sensitive, Detail Oriented, Good To Go; 16) traced to "Picks, grants, item data, small tags / events".
Every piece was built as a plug-in (`module/rules/ext/e.mjs` + `module/rules/ext/e/`) plus a few small engine edits, and every
item it unblocks was converted. Edited in place in the shared checkout (no branch, no commit).

| Verdict | Count |
|---|---|
| Converted | **30** |
| Partial | **3** (We Are One!, Early Adopter, Detail Oriented) |
| Still code | **0** of the listed items (two halves stay code - see below) |

51 rules were added to 30 pack items (plus a `legacy` field on the existing mark steps of Fresh Mark and Natural Style).
`scripts/check-rules.mjs`: 2250 rules on 1335 items (with the other groups' work), 0 errors, 0 warnings. ESLint (`--ext .js,.mjs`) is
clean on every file I touched. Jest: `engine10-e.test.js` (26) and `conv10-slE10.test.js` (30) pass, and so do the older suites of my
items (`conv5-slC5`, `conv7-slC7`, `conv8-slC8`, `conv8-slE8`, `conv9-slE9`, `conversions`) and all fourteen slice folders I edited
(289 tests) plus `combat.test.js`.

## Engine features added 2026-10-06 (round 10, group E)

- **Steps** (rules/ext/e/steps.mjs):
  - `pickEntry {from: {type, availabilities?, tags?, fields?} | children: {of: <var>, type}, var?, title?, prompt?, auto?, record?,
    key?, max?, until?, legacy?}` - choose a compendium entry WITHOUT granting it. The run keeps `@var.<var>` (default `picked`, its
    uuid) and `<var>Name`, `<var>Availability`, `<var>Dif` (its Availability DIF, CONFIG.E20.availabilityDifficulties),
    `<var>DifHarder` (one step harder - Scavenger), `<var>Skill` (the Requisition Skill of a weapon / armor) and `<var>Traits`
    (comma-joined). `from.tags` see the run's vars (`var:includes:<var>Traits:martialArts` - one pick narrowing the next).
    `children` offers the entries a picked entry carries (an Origin's Alt Modes; `auto` takes a lone one). `record: true` also keeps
    it on the rule's item like pickGrant's record (`item:pickedSource:<key>`), with `until`. A cancelled pick stops the run. Grant it
    later with `grant {uuid: "{var.picked}"}` (twice in `onCrit` for "an extra copy on a Critical Success"), roll against it with
    `roll {dif: "@var.pickedDif"}` / `roll {skill: "{var.pickedSkill}"}`.
  - `pickActorItem {actor: picked:<key> | target | self, itemType?, vehicles?, key, record: true, max?, until?, legacy?}` - one of
    another actor's items (or, `vehicles`, a vehicle / Zord they crew), recorded on the rule's item as {kind, uuid (its book source),
    name, ally, until}. Read by `item:recorded:<key>` / `self:crewsRecorded:<key>` (Training Evolution).
  - `pickMany {key, from, count (formula), ...that source's options}` - up to `count` of anything a `pick` offers (a checkbox
    list), kept as a list. None is a valid answer; closing stops the run.
  - `repeat {steps, max?, var?}` - run the steps until one stops (a cancelled pick); `@var.repeats` counts finished rounds.
  - `forEach {to, steps}` - the steps once per recipient, it as the target; one recipient's stop doesn't stop the rest (a `choose`
    asked per member - Camper).
  - `focus {to}` - the recipients become the run's targets (no change to the user's targeting); stops when there are none.
  - `setEffects {effects: [{name?, changeKey?, on: tags | true | false}]}` - switch the rule item's own Active Effects; each
    effect takes the first entry it matches (name contains / first change key contains / an entry with neither = any).
  - `unbank` - take back what this rule's item banked on the recipients.
  - `appendToName {text}` - rename the rule's own item "<name> (<text>)" (text may be an i18n key).
  - `recordScene {path}` - write {sceneId, terrain} of the actor's scene at a `flags.` path on the actor (stops with no scene).
  - `grantTopRolePerks {notRole?, notRoleName?, excludeName?}` - the actor's Role's highest-level Role Perks, not already owned.
  - `fitUpgrade {uuid, onto: choice:<key>, flags?}` - a compendium upgrade attached to an owned item a pick stored, the way
    dropping it on the item does (no grantedBy - it stays when the rule's item goes).
  - `giveCopy {uuid, to?, flags?}` - a compendium item (no attachments) copied onto each recipient through the GM relay.
- **Recipients:** `allParties` (the actor and everyone on any Party roster with it), `targetOrCombatant` (the first target, else
  whoever's turn it is).
- **Pick sources:** `skills` {essence?, minShift?, maxShift?, exclude?, also? (count whatever their Essence), sameEssenceAs: <key>,
  differentEssenceFrom: <key>, notChoice: <key>, partner: {same spec; sameEssence: true = the candidate's Essence}} - "has a
  partner" filtering; `defense` {exclude?, notChoices: [keys]}; `partyMates` {orTargets?}; `ownedItems` {itemType, prefer: [item
  tags]} (the preferred ones when any, else all).
- **Tags:** `self:inTeamOf:holder[:others]` (on the holder's team - the primary Party roster, else every player-owned PC; for a
  clicker's button run, self is the presser) and `self:hasTeammates`; `item:recorded:<key>` / `self:crewsRecorded:<key>` (a
  recorded pick that hasn't run out; an old `{mission}` stamp counts only in its mission); `var:includes:<key>:<text>`;
  `self:` / `target:healthDamaged`, `self:` / `target:essenceDamaged`; `target:ownTurn`; `roll:damaging` (the hit / targeted row
  came with damage); `self:` / `holder:onRecordedScene:<path>`; `self:itemEffect:<uuid>:<change key>` (that book item's copy has an
  enabled effect changing the key).
- **Formula ref** `@alliesWearing.<compendium id>.<ft>` - allies within range (the system's ally count) wearing that upgrade.
- **Rule types** read by the hand-written registries (rules/ext/e/types.mjs, joined at `setup`):
  - `HazardProtection {categories?, environments?}` - environment-hazards.mjs ENVIRONMENT_PROTECTORS; `{choice.x}` in
    environments reads a pick (an unmade pick covers nothing); labelled with the item's name.
  - `RoughTerrainImposer {}` - rough-terrain.mjs ROUGH_TERRAIN_IMPOSERS; `when` is asked with self = the holder and target = the
    creature moving (`target:marked:misguided`, `target:ownTurn`).
  - `MultipleTargets {}` (scopes self, driven) - multiple-targets.mjs MULTIPLE_TARGETS_GRANTS; `when` sees the attack (`attack:ram`).
  - `KitPrerequisite {mode: lower | waive, tiers?, skipEssenceKits?}` - the essence20.kitPrerequisite hook (one Rank lower, never
    past d2 / no prerequisite).
- **Scope** `alliesAnywhere` (RollModifier) - every other actor on the holder's side, anywhere (token dispositions, else PC or
  not - react/core.mjs#areAllies).
- **Trigger event** `equipmentBroke` - a weapon / armor / shield flagged broken, or a vehicle / Zord / Megaform brought to 0
  Health, fired for every world actor that has such a Trigger (on the client that made the change).
- **Stages:** DerivedStat `stage: "early"` (before the poison training is worked out - documents/actor.mjs); Movement
  `stage: "derived"` (inside the extensions' derived pass, before `afterDerived`). Actors holding a Movement rule that reads the
  combat (`combat:`, `actionUsed`, `ownTurn`) are re-prepared on combat / combatant updates.
- **Legacy marks:** a `mark` step with `perSetter` may carry `legacy: "flags.essence20.<old list>"` (+ `legacyScene: true`); once, at
  start-up on the active GM, the creatures in that old holder-side list (or map) get the holder's mark (never over one there).
- **Engine edits:** a `roll` step's `skill` fills `{var.x}`; `updateActor` ladder paths fill `{choice.x}` (no pick, no change);
  `pickGrant {appendTraits}`; a `choose` prompt fills `{target}`, `{name}`, `{choice.x}`, `{var.x}`; the linking pass moves the
  `legacy` of any `record: true` step; SurpriseExemption rules see `holder:` tags; Trigger `when` lists see the roll's rows
  (`roll:damaging`).

## Verdicts

| Item | Pack file | Verdict |
|---|---|---|
| Extract Poison (its Use) | `ccitems/_source/Extract_Poison_0kcuvCeRhmneAJTl.json` | converted (was partial) |
| Improvise Bomb | `ccitems/_source/Improvise_Bomb_BUqXOt90M4yAsA7b.json` | converted |
| Demolition Artist | (read by Improvise Bomb's rules) | converted |
| Scavenger | `ccitems/_source/Scavenger_VjLTohjkJJtJPXdE.json` | converted |
| Early Adopter (team picks) | `qgtgitems/_source/Early_Adopter_WrRChund2zAcHYfe.json` | partial (its Requisition DIF half is requisition.mjs) |
| Field Trials | `qgtgitems/_source/Field_Trials_HBSVeVpRVBXiPgSW.json` | converted |
| Mutant Beast | `tsitems/_source/Mutant_Beast_gkcyg7KWih6QAZlq.json` | converted |
| We Are One! | `eocitems/_source/We_Are_One__1MtovibPOMw9O2hP.json` | partial (the effect sync stays in tf2/modes.mjs) |
| Dabbler | `mlpcrbitems/_source/Dabbler_Tnr6LTI2yBHUxC7r.json` | converted |
| Ninpō JOEs | `iafav2items/_source/Ninp__JOEs_8oZYgik001Dxxxa6.json` | converted |
| Nothing Personal | `iafav2items/_source/Nothing_Personal_WsB4CydGzKF2g7Yi.json` | converted |
| Training Evolution | `qgtgitems/_source/Training_Evolution_zqy47bzuJHaON2TP.json` | converted |
| In His Image | `dditems/_source/In_His_Image_DegS9JawsaAzOCR1.json` | converted |
| Camper | `kocitems/_source/Camper_dMEFcqcain5oS2mJ.json` | converted |
| Metier | `ccitems/_source/Metier_EcVOkUJE40sKSg8v.json` | converted |
| Peak Performance | `ghpfitems/_source/Peak_Performance_Uzs2Ms6MgPsxV8uU.json` | converted |
| Weather Gear | `gijcrbitems/_source/Weather_Gear_toav8R7TF92WnQ8G.json` | converted |
| Acclimating | `gijcrbitems/_source/Acclimating_HSmtPttbJvaNy5Tf.json` | converted |
| Misguide | `ccitems/_source/Misguide_IaxNOucyCcF6QDU1.json` | converted |
| Plow (Multiple Targets half) | `tfcrbitems/_source/Plow_y7VBydpKD8O63C3b.json` | converted (was partial) |
| Training Through Familiarity | `tfcrbitems/_source/Training_Through_Familiarity_9XITV6O09Up8QiwL.json` | converted |
| Good To Go (Kit half) | `iafav2items/_source/Good_To_Go_Yt3muowN1aALcqOj.json` | converted (was partial) |
| Junker | `qgtgitems/_source/Junker_fiokYoWguE1eBVda.json` | converted |
| Cartography Suite | `eocitems/_source/Cartography_Suite_l2dioJyakPropGEx.json` | converted |
| Lay of the Land (Rough Terrain half) | `eocitems/_source/Lay_of_the_Land_CTt9gmibpffGC0N4.json` | converted (was partial) |
| Uniform | `ccitems/_source/Uniform_VkSI68BkpXLOC5ys.json` | converted |
| Revengeful | `dditems/_source/Revengeful_n1CZfponNlZ9I8uN.json` | converted |
| Yo Joe! (Battle Cry) | `gijcrbitems/_source/Yo_Joe__8pFYTMSWUsVsfLPD.json` | converted |
| Inspirational Leader (combat half) | `atsitems/_source/Inspirational_Leader_JH6xyTYUHCxAKkTP.json` | converted (was partial) |
| Thick Skin | `mlpcrbitems/_source/Thick_Skin_KakotlRk6PO2CRqu.json` | converted |
| Sensitive | `mlpcrbitems/_source/Sensitive_cLe7ettmAIaBUYIj.json` | converted |
| Detail Oriented | (its spend is Sensitive's rule) | partial (its own Finesse Move-action stays in action-perks.mjs) |
| Fresh Mark / Natural Style (old memories) | `mlpcrbitems/_source/Fresh_Mark_LWCNfr3eEU2y9MyP.json`, `Natural_Style_IgjtNiGBXQinE1GO.json` | slE8's difference 1 closed |

## Converted

- **Extract Poison:** a Use, `not:self:combatant`: `pickEntry` over weapons with `system.isPoison`; Science against `@var.pickedDif`;
  `grant {var.picked}` on a success. (Its Qualified DerivedStats were already rules.)
- **Improvise Bomb / Demolition Artist:** two Uses - Standard action without Demolition Artist (`not:self:hasItem:<uuid>`), Free
  with it. `pickEntry` (before the cost: a cancelled pick costs nothing) over consumable, not mounted / vehicular weapons with an
  explosive attack or a bomb / grenade / explosive / charge / dynamite name; Technology against `@var.pickedDif`; one copy, two on a
  crit (`onCrit`).
- **Scavenger:** a Use, `not:combat:exists`, `limit {per: encounter}`: choose weapon / armor / shield / gear, `pickEntry`, a roll
  with the entry's Requisition Skill (Technology for shields and gear) against `@var.pickedDifHarder`, then the copy with
  `appendTraits: [temperamental]` and flags `scavenged`, `temperamental`. The limit is spent once the pick is made, success or not.
- **Early Adopter / Field Trials:** a mission-limited Use posting a `button {who: anyone, runAs: clicker, once: false, limit: {per:
  mission, key}}`; the presser must pass `self:inTeamOf:holder:others` (Early Adopter) / `self:inTeamOf:holder` (Field Trials).
  Early Adopter chooses a Standard weapon upgrade, battledress upgrade or Kit (`pickGrant`); Field Trials picks a Limited weapon
  upgrade with `flags: {gij3FieldTrials}` and `appendTraits: [temperamental]`. Early Adopter refuses with no teammates.
- **Mutant Beast:** a Use while `self:itemCount:altMode<2`: `pickEntry` over non-Fuzor Origins, then its Alt Modes (`children`,
  `auto`), granted.
- **We Are One! (partial):** a Use: `pickMany team` (partyMates, else targets; `ceil(Social max / 2)`), `pick skillA` and
  `skillB` (`differentEssenceFrom`), then bumps `tf2WeAreOneSync`. tf2/modes.mjs#weAreOneTeam reads those picks (an older
  `tf2WeAreOne` actor flag still counts) and keeps the team's reroll effects in step - that sync stays code.
- **Dabbler:** Use "swap" (not swapped): `pick lower` (trained, not Conditioning, with a raisable partner) and `pick raise` (same
  Essence or Spellcasting, below d12), a ladder update, toggle `swapped`. Use "undo" and a `rest` Trigger (swapped, or an old
  `o3Dabbler` flag): the reverse ladder, toggle off, clear the old flag. Both picks carry `legacy` paths into `o3Dabbler`.
- **Ninpō JOEs:** a Use: `pickEntry` record (melee or reach attack, Limited), then a projectile one whose tags need
  `var:includes:meleeTraits:martialArts` or its own Martial Arts trait; a Qualification over `item:pickedSource:chosen`.
- **Nothing Personal:** a Use while not fitted: `pick` from `ownedItems` weapons preferring pistol / revolver / handgun names,
  `fitUpgrade` the Silencer with `q1FreeSilencer`, then `q1SilencerFitted`.
- **Training Evolution:** a Use: `pick ally from team notSelf`, `pickActorItem` (their weapons and crewed vehicles, `until: mission`,
  `legacy: flags.essence20.q2Evolution`); a Qualification (Trained, `item:recorded:evolution`) and two RollModifiers `specialize`
  (`weapon:recorded:evolution`; `skill:driving` + `self:crewsRecorded:evolution`).
- **In His Image:** a Use: one target, `require` Defeated and not done before; Culture against
  `max(0, toughness total - armor)`; on a success `repeat` [pick an un-exchanged Hang-Up of the target, `pickEntry` a Hang-Up,
  `deleteItem` the old, `giveCopy` the new], then flag the target when at least one was exchanged.
- **Camper:** a Use at half Health or more: toggle `camp` for the scene, and `forEach allParties` a `choose` (auto when one fits)
  of 1 Health / 2 Essence, offered only when damaged. RollModifiers ↑1 for the holder (`self:toggle:camp`, not under half) and for
  its party (`holder:toggle:camp`, `not:holder:hp<half`).
- **Metier:** an `added` Trigger and a Use while unpicked: `pick metier` (legacy `gij1Choice.choice`), `appendToName` with the
  option's label, Weapon Training granted (no grantedBy) when picked and not owned. DerivedStat stage early −1 poison training
  (picked, not poisons, training > 0, the Assassin's poison effect on); DerivedStat Trained in Silent weapons.
- **Peak Performance:** a Use while unflagged: `grantTopRolePerks` (not Old Hand, not "Plan of Action..."), then the flag.
- **Weather Gear:** a Use picking the environment (legacy `s1Environment`); HazardProtection temperature, `{choice.environment}`,
  while on worn armor (`host:type:armor`, `rule:hostEquipped`). **Acclimating:** the same without the environment.
- **Misguide:** a Use in a combat, a Story Point: `require` not known outside the environment of expertise, `focus` the target or
  the creature whose turn it is, not yourself; mark `misguided` until the end of this turn (its turn now) or of its next turn. A
  RoughTerrainImposer `target:marked:misguided`, `target:ownTurn`.
- **Plow:** MultipleTargets `attack:ram` (self, and `driven` for the vehicle it drives).
- **Training Through Familiarity / Good To Go:** KitPrerequisite waive (Standard / Limited, not Essence kits) / lower.
- **Junker:** an `equipmentBroke` Trigger, `combat:exists`, `not:rule:banked`: bank a Snag (`replace`).
- **Cartography Suite:** a Use `recordScene flags.essence20.s2CartographySurvey`; SurpriseExemption `move` for itself and as a 60 ft
  ally aura (`holder:onRecordedScene:...`). **Lay of the Land:** MovementAction ignoreRoughTerrain on the surveyed scene.
- **Uniform:** an incoming RollModifier with `ask:identify` (a switch on rolls against the wearer, unticked each time):
  ↓ `1 + @alliesWearing.VkSI68BkpXLOC5ys.100000`.
- **Revengeful:** a `targeted` Trigger (`outcome: success`, `roll:damaging`) marks the attacker (`perSetter`, `exclusive`: the latest
  attacker); a RollModifier ↑1 on attacks with `markedByMe:revengeful`; a `defeatedEnemy` Trigger with it grants a Story Point.
- **Yo Joe!:** Movement ground +10 at stage derived, `combat:roundIs:1`, `self:combatant`, `not:self:actionUsed:standard`, ground > 0.
- **Inspirational Leader:** an afterRoll Trigger (`anySucceeded`, in a started combat) stores `{var.skill}` as `inspiring` and marks
  itself until the round ends; an `alliesAnywhere` RollModifier ↑1 with `holder:marked:inspiring` and `skill:{choice.inspiring}`.
- **Thick Skin:** a Use: `pick thick7` (level 7+), `pick thick15` (level 15+, another Defense), clears an out-of-level pick, then
  `setEffects` (each Defense effect on when picked; 15th-level Health at 15+; the rest at 7+).
- **Sensitive (+ Detail Oriented):** a `takesDamage` Trigger (not while `sensitiveIgnore`) banks a Snag (`replace`); a Use, with
  Detail Oriented and fewer than 3 of its daily uses spent: count one, mark `sensitiveIgnore` until the round (or scene) ends,
  `unbank`.
- **Fresh Mark / Natural Style:** their mark steps carry `legacy` (`d22Deceived`; `d22Met`, this scene's ones `legacyScene`), so the
  old memories become marks at the next GM start-up.

## Behaviour differences worth a decision

1. **Early Adopter / Field Trials (presentation + small).** One card with one button instead of a button per ally; the presser acts
   as their selected token, else their own character (a GM with nothing selected acts as the holder, who is refused for Early
   Adopter). Picks made earlier this mission under the old `gij3FreePick*` flags aren't seen (transient). Granted items carry the
   holder's Perk id as `grantedBy` (inert on another actor). No teammates: a short card instead of a notification.
2. **Uses limited per encounter / mission (transient).** Scavenger's, Early Adopter's and Field Trials' limits count under rule keys,
   so a use made with the old code earlier in the same encounter / mission isn't seen.
3. **Grants (same line).** Extract Poison, Improvise Bomb, Scavenger, Mutant Beast use the `grant` step (`_stats.compendiumSource`)
   instead of grantCopy (`flags.core.sourceId`) - both are what `sourceOf` reads. Chat lines are the rule's (Picked / Granted).
4. **Camper / Inspirational Leader (stacking edge).** Two campers with live camps, or two leaders succeeding on the same Skill in a
   round, give ↑2 (the old code took the first). Inspirational Leader reaches allies through world actors holding it; a success in a
   combat that hasn't started (round 0) no longer inspires (it would otherwise last the scene).
5. **Revengeful (same line).** The memory is a per-setter mark on the attacker instead of `pendingRevengeful` on the holder (old
   flags aren't read - transient); the Defeat Story Point uses the `defeatedEnemy` event's damage source.
6. **Sensitive / Junker (transient + small).** Old banked `pendingSensitiveSnag` / `junkerSnag` flags aren't read. Sensitive's ignore
   out of combat lasts the scene (the old stamp lasted until some combat began). Junker fires on the client that broke the gear.
7. **Misguide (presentation + edge).** The Story Point spend is announced the usual way; the Use is hidden when no Story Point can be
   spent (the old one warned). A creature stays misguided only while its setter still holds Misguide.
8. **Yo Joe! (ordering edge).** The +10 lands at the plug-in's place in the derived pass (still before `afterDerived`).
9. **Dabbler / Metier (legacy).** An old swap / pick works once the GM's linking pass has moved `o3Dabbler` / `gij1Choice` into the
   rule picks (at start-up); Dabbler uses the d20..3d6 ladder.
10. **In His Image (small).** Exchanges are written one at a time (the old code wrote them together at the end); the new Hang-Ups carry
    the rite's `grantedBy`, which is how they're kept off the list.
11. **We Are One! (edge).** Skills offered are the actor's own; cancelling after the team pick keeps the new team pick but changes no
    effects until a full run.
12. **Uniform (presentation).** The switch label doesn't count the wearers.
13. **Cartography Suite (edge).** Move while Surprised follows SurpriseExemption's rules (an actor acting while Defeated through a Story
    Point could move; the old check refused Defeated outright).

## Still code, and why

- **We Are One!'s reroll-effect sync** (tf2/modes.mjs) - effects created on other actors; it reads the rule's picks. Effectively permanent.
- **Early Adopter's Requisition DIF −5** (helpers/requisition.mjs) - not in this list.
- **Detail Oriented's Finesse test as a Move action** (helpers/action-perks.mjs) - a day-limited ActionCost (ActionCost limits have no
  day window).

## Shared-file edits

- `module/rules/steps.mjs`: `pickOptions` exported; `skillFor` fills `{var.x}`; `updateActor` ladder paths fill `{choice.x}`;
  `pickGrant {appendTraits}`; `askOption`'s prompt filled.
- `module/rules/legacy-choices.mjs`: `legacyPaths` takes any `record: true` step's `key` / `legacy`.
- `module/rules/adapter.mjs`: `ruleSurpriseModes` passes `holder`; the DerivedStat pass skips `stage: "early"`.
- `module/rules/triggers.mjs`: a Trigger's `when` context carries `results`.
- `module/rules/types.mjs`: DerivedStat `stage` (early); Movement stage `derived`.
- `module/documents/actor.mjs`: imports `earlyDerivedStats` (rules/ext/e/derived.mjs) and calls it before `_preparePoisonTraining`.
- `module/dice.mjs`: Sensitive's banked-Snag read, Revengeful's const / ↑1 source / hit-time flag removed (Now I'm Angry's loop kept),
  `PENDING_SENSITIVE_SNAG_FLAG_KEY` import removed. `module/dice.test.js`: the Sensitive and two Revengeful describe blocks.
- `module/helpers/combat.mjs` (+ `combat.test.js`): Sensitive's `grantSensitiveSnag`, its two calls, the constants, the
  `bankPendingBonus` import.
- Slices (code of my items only): `gij1/perks.mjs`, `gij1/shared.mjs`, `gij1/gear.mjs`, `gij1.test.js`; `gij3/gij3.mjs`,
  `gij3.test.js`; `tf2/uses.mjs`, `tf2/modes.mjs` (We Are One! reads the picks; `WE_ARE_ONE_FLAG` moved here), `tf2.test.js`;
  `other3/mlp.mjs`, `other3/shared.mjs`, `other3.test.js`; `other2/decepticon.mjs` (now an empty module - the generated
  `helpers/extensions/index.mjs` imports it), `other2/gij.mjs`, `other2.test.js`; `resource/mlp.mjs`, `resource.test.js`;
  `qualify1/qualification.mjs`, `qualify1/common.mjs`, `qualify1.test.js`; `qualify2/qualifications.mjs`, `qualify2/field-ops.mjs`,
  `qualify2/common.mjs`, `qualify2.test.js`; `tf3/reactions.mjs`, `tf3/common.mjs`, `tf3.test.js`; `react/triggers.mjs`,
  `react.test.js`; `situational1/situational1.mjs`, `situational1.test.js`; `situational2/situational2.mjs`,
  `situational2/common.mjs`, `situational2.test.js`; `mlp2/mlp2.mjs`.

## Unused strings

`E20.G1MetierPrompt`, `E20.G1CraftFailed`, `E20.G1BombMade`, `E20.G1PoisonExtracted`, `E20.G1ScavengerType`, `E20.G1ScavengerWeapon`,
`E20.G1ScavengerArmor`, `E20.G1ScavengerShield`, `E20.G1ScavengerGear`, `E20.G1ScavengerFailed`, `E20.G1ScavengerFound`,
`E20.G1UniformToggle`, `E20.Gij3NoAllies`, `E20.Gij3EarlyAdopterCard`, `E20.Gij3FieldTrialsCard`, `E20.Gij3AlreadyPicked`,
`E20.Gij3EarlyAdopterCardTitle`, `E20.Gij3EarlyAdopterPick`, `E20.Gij3WeaponUpgrade`, `E20.Gij3ArmorUpgrade`, `E20.Gij3Kit`,
`E20.Gij3FreePickDone`, `E20.Gij3PeakPerformanceNoRole`, `E20.Gij3PeakPerformanceRanger`, `E20.Gij3PeakPerformanceDone`,
`E20.Tf2WeAreOnePickAllies`, `E20.Tf2WeAreOneNoTeam`, `E20.Tf2WeAreOneSkill`, `E20.Tf2WeAreOneSet`, `E20.Tf2MutantBeastOrigin`,
`E20.Tf2MutantBeastAltMode`, `E20.Tf2MutantBeastAdded`, `E20.O3DabblerReverted`, `E20.O3DabblerLower`, `E20.O3DabblerRaise`,
`E20.O3DabblerSwapped`, `E20.O2InHisImageOnce`, `E20.O2RiteFailed`, `E20.O2InHisImagePickOld`, `E20.O2Done`, `E20.O2InHisImageDone`,
`E20.ResCamperSource`, `E20.ResCamperHeal`, `E20.ResCamperLine`, `E20.ResStressPrompt`, `E20.ResStressHealth`, `E20.ResStressEssence`,
`E20.Q1PickMeleeWeapon`, `E20.Q1PickProjectileWeapon`, `E20.Q1QualifiedChosen`, `E20.Q1SilencerAlready`, `E20.Q1SilencerPrompt`,
`E20.Q1SilencerFitted`, `E20.Q2EvolutionAlly`, `E20.Q2EvolutionItem`, `E20.Q2EvolutionChosen`, `E20.Q2SensitiveNoUses`,
`E20.Q2SensitiveIgnored`, `E20.S1MisguideNoTarget`, `E20.S1NotInEnvironmentOfExpertise`, `E20.S1NoStoryPoint`, `E20.S1MisguideUsed`,
`E20.S2CartographyNoScene`, `E20.S2CartographySurveyed`, `E20.ReactRevengeful`, `E20.Mlp2ThickSkinPick`, `E20.Mlp2ThickSkinSet`.
(`E20.G1Metier*` options and `E20.S1EnvExtreme*` are still read - by the pack rules.)

New strings: `<scratchpad>/r10/lang-e.json` (`E20.RulesExtE.NoScene`, `SceneRecorded`, `NoRolePerks`, `Fitted`, `PickUpTo`).

## Rule count

51 rules added on 30 items (Extract Poison 1, Improvise Bomb 2, Scavenger 1, Early Adopter 1, Field Trials 1, Mutant Beast 1,
We Are One! 1, Dabbler 3, In His Image 1, Camper 3, Metier 4, Peak Performance 1, Weather Gear 2, Acclimating 1, Misguide 2, Plow 2,
Training Through Familiarity 1, Good To Go 1, Junker 1, Cartography Suite 3, Lay of the Land 1, Uniform 1, Revengeful 3, Yo Joe! 1,
Inspirational Leader 2, Training Evolution 4, Thick Skin 1, Sensitive 2, Ninpō JOEs 2, Nothing Personal 1); Fresh Mark's and Natural
Style's existing mark steps gained `legacy`.

## For the merge

- **Group C's `registerTag('combat:round', ...)` (rules/ext/c/tags.mjs) shadows the core `combat:round:<n>` tag** - with it,
  `combat:round:1` / `not:combat:round:0` answer false (Inspirational Leader's existing Assist rule uses `not:combat:round:0`). It
  should hand plain numbers back to the core reading (or use another name). Yo Joe! uses group D's `combat:roundIs:1` meanwhile.
- Not mine, seen while checking: `other2/magic.mjs` and `mlp2/mlp2.mjs` have unused imports after other groups' removals; `dice.test.js`
  "Takedown Expert also Immobilizes on a miss" fails; `conv3-slA3`, `conv5-slA5`, `conv6-slA6`, `conv5-slD5` fail validation on rule
  types other groups registered (those tests don't import `rules/ext/index.mjs`).
- Insert `lang-e.json` under `E20`.
