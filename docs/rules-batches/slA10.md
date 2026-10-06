# Batch slA10: group A's round-10 engine pieces (Zords, Megaforms, Forms, size) and the items they unblock

**Scope:** section "## A" of the round-10 groups list - slA9 1-7 and 13-14, slB9 13 (Roller Drum, Scramble Modulator,
Roll Out, Big / Bigger Rigger), slE9 14 (Sky Morpher, Data-Link) and slD9 15 (Megaform Defender). Every piece was built
as a plug-in (`module/rules/ext/a.mjs` + `module/rules/ext/a/`) plus four small engine edits, and every item a piece
unblocks was converted. Edited in place in the shared checkout (no branch, no commit).

## Engine features added 2026-10-06 (round 10, group A)

Everything below is registered on import of `module/rules/ext/a.mjs` (loaded first by `module/rules/ext/index.mjs`).
Strings are under `E20.RulesExtA.*`.

### Linked scopes

- **`registerLinkScope(name, holdersOf)`** (new in `rules/links.mjs`): a plug-in scope. `holdersOf(actor)` names the
  actors whose rules of that scope reach `actor`; `linkedEntries` walks them after the built-in scopes, and a rule with
  `stacks: false` counts once per book item however many holders carry it. The scope is also added to `LINK_SCOPES`
  and (through the new `addLinkedScope` in `rules/index.mjs`) to the index's linked list, so holders are tracked.
- **`scope: megaform`** - on a participant's item: reaches every Megaform the participant is part of (Accurate
  Combiner, Assault Weapon, Roller Drum, Warzord's reminder, Restraining Gear's Megaform half).
- **`scope: ownZord`** - on a character's item: reaches every Zord listed on their sheet (Terrorzord Nature, Megaform
  Expeditor).
- **`scope: zordOwner`** - on a Zord's item: reaches the characters listing that Zord (Power Matrix's refill on rest).
- All three are accepted by every rule type that already takes `vehicle`.
- **The rule holder in roll contexts:** `rollRules` (rules/adapter.mjs) now passes `holder: entry.holder`, so a linked
  RollModifier / DialogSwitch can ask about the actor holding it (`megaform:holderAttack`, `holder:...`).

### Tags

| Tag | True when |
|---|---|
| `megaform:in[:zord\|:combiner]` | this actor is part of a Megaform (a Megazord / a Combiner form) |
| `megaform:is[:zord\|:combiner]` | this actor is a Megaform (of that kind) |
| `megaform:participantAttack` | the Megaform's rolled attack is one of its participants' attacks |
| `megaform:holderAttack` | ...the rule holder's own attack |
| `megaform:generated` | the rolled attack (or its weapon) was generated on the Megaform |
| `self:megaformTrait:<type>` / `target:megaformTrait:<type>` | holds a Megaform Trait of that type (`defender`, `coreBody`...) |
| `item:attachedAttack` | the item is a weapon's own attack |
| `target:combinerForm` | the other party is a Combiner form |
| `vehicle:ownZord` | crewing a Zord that is theirs (listed on the sheet, or linked as its owner) |
| `self:ownedByHolder` | this Zord is the rule holder's own |
| `self:ownsZordOnCanvas` | a Zord on this sheet has a token in the viewed scene |
| `self:advancedRole` | the actor's Role is an Advanced one |
| `self:commanded` / `target:commanded` / `holder:commanded` | Commanded this round (companions.mjs's `petCommand` stamp) |
| `companion:uncommanded[:<type>]` | one of this actor's companions (of that companion type) wasn't Commanded this round |
| `item:heldBy:picked:<key>` | the item / compendium entry asked about is already on the actor a pick stored under `key` |
| `target:userOwns` | this user may act for the other party (GM, or its owner) |
| `self:hasDriver`, `self:drivenByHolder` | the vehicle has a driver / its driver is the rule holder |
| `self:markedByHolder:<key>`, `vehicle:markedByMe:<key>` | carries mark `key` set by the holder / the crewed vehicle carries mark `key` set by me |
| `self:specializedAtLeast:<skill>:<die>` | a Specialization of that Skill at that die or better |
| `movement:<type>` / `movement:has` | in a Movement rule: the type being worked out / it already has speed |
| `form:active` / `form:any` | the rule's item is the active Form / some Form is active |
| `target:notBeyond:<ft>` | the other party is no farther away (off the canvas counts as near enough) |
| `team:holds:<uuid>` | another Player Character holds that compendium item |
| `scene:tokenWithin:<ft>:<tag>&<tag>` | another token within that range meets the tags (asked as the target) |
| `self:clockActive:<flag>` | a Scene Clock window flag is live this scene or mission |

### Recipients, pick sources, refs

- **Recipients:** `megaform` (the Megaforms the actor is in), `participants` (a Megaform's roster), `ownZords`,
  `holder` (the actor holding the rule's item - group D registers the same name with the same meaning), `driver`,
  `drivenVehicle`, `combinerTop` (the first target's active Combiner components with the most Health, ties all count).
- **Pick sources:** `ownedZords` (value: uuid), `crew {filter?}` (a vehicle's seated crew, `filter` tags asked as the
  target), `remaining {options, exclude: [keys]}` (a list less what the item's other picks hold), `noted {list,
  listLegacy?}` (the uuids `noteEntries` kept on the item; labels from the documents).
- **Ref `@sourced.<16-char id>.<path>`** - a number on the actor's copy of that compendium item (0 when none).

### Steps

- `megaformSync` - every Megaform the actor is in mirrors its MegaformMirror items again; `@var.megaforms`,
  `@var.megaformCount`.
- `shiftSize {steps, ladder?: full|class, min?, max?, record?}` - moves each recipient's stored size; `record` keeps
  the size before on the rule's item (once). `restoreSize {record, legacy?}` puts it back and forgets it (skips the
  write when the item is already gone, as in a `removed` Trigger).
- `askChoiceText {key, prompt?}` - a typed text kept as `{choice.<key>}` and `@var.<key>`; empty / cancelled stops the run.
  (Named so because group D's `askText` exists.)
- `spendFrom {to, resource, amount}` - each recipient pays from its own resource; stops (with a chat line) when one
  can't; `@var.paidBy`.
- `formStart` / `formEnd` - activate the rule item's Form / end the active one (helpers/extensions/zord1/forms.mjs).
- `rollAs {to, skill, dif, snag?, onSuccess?, onFail?}` - each recipient rolls; its branch runs with it as the target.
- `transformInto {item}` - convert into the Alt Mode the item selector finds (`choice:<key>` after a pick); `@var.mode`.
- `noteEntries {key, count, from: {type}, title?, legacy?}` - choose up to `count` different compendium entries one
  at a time and note them on the rule's item (a uuid list), leaving out what the actor's other copies noted. Stopping
  part way keeps those chosen; stopping at the first keeps the old list and stops the run. Read back with
  `pick {from: noted, list: <key>}`.

### Rule types

- **`Size {steps?, set?, atLeast?, atMost?, ladder?, min?, max?}`** - the actor's derived `system.size`, after the
  hand-written size code: `steps` (each clamped to its own min / max, never back across a limit), then `set`, then
  `atLeast` / `atMost`. `ladder: class` walks small, common, large, huge, gigantic, towering, titanic (an
  extended / long size counts as the class below it).
- **`ArmorAccommodation {level: limited|restricted}`** - putting on armor without that Alteration Accommodation
  upgrade is refused (Restricted also covers Limited).
- **`SizeMatrixCancel`** (on a driver) - an attacker smaller than the vehicle loses the Size Class matrix upshift while
  `when` holds (`defense:` the attacked Defense, `target:` the attacker); a labelled ↓ source on the attack.
- **`MegaformHealth {amount}`** (scope megaform) - the holder's row of the Megaform's Health and the combined Health.
- **`MegaformMirror {items: [item tags]}`** - the participant's matching items are mirrored onto every Megaform it is in
  (kept in step on roster changes and by `megaformSync`).
- **`SummonLimit`** - only one of the holder's Zords per scene (refused in preUpdateActor as zord-summon.mjs summons).
- **`JoinTime {amount, min?}`** (self / ownZord) - the Zord is ready to combine sooner (combiner-timer.mjs).
- **`SummonTime {mode: halve|subtract, amount?, min?}`** - summoner's rules then the Zord's (zord-summon.mjs).
- **`AutoDisembark {who?: driver|pilots}`** - passes the emergency disembark outright (vehicle-defeat.mjs).
- **`KnownOptions {key, count, options, labels?, title?, prompt?, legacy?}`** - the options a helper may offer are only
  those noted, topped up by asking (emotional-mastery.mjs reads `ensureKnownOptions`).
- **`Form {cost?, swaps?: [{replaces, uuids|pick, when?}], grants?, element?}`** - what activating a Form Perk does;
  zord1/forms.mjs reads `ruleFormSpec` / `ruleFormUuids`.

### Events and the Movement stage

- **`beforeRoll`** - fired from the extensions' preRoll (before the dialog) on an actor holding such Triggers; the
  rolled item is the roll item (`item:own`), `roll:dataset:` reads the dataset.
- **`groupTestResult`** - once a Group Test card has every result, on each participant: `@var.success` (1/0),
  `@var.successes`, `@var.participants`.
- **`megaformCombined`** - a Megaform's roster changed (on the client that changed it): `@var.participants`,
  `@var.zords`; participants reach it with `scope: megaform`.
- **Movement `stage: derivedHook`** - applied where a slice calls `applyDerivedHookMovement` among the derived hooks
  (`module/rules/ext/a/movement-hook.mjs`, import-free so a slice can load it early; pr2/team.mjs registers it).
  A `ready` hook re-prepares the Player Characters when one holds team-scoped Movement / DerivedStat / Defense rules.

### Helper hooks

- `helpers/grants.mjs#pickPerkFrom` takes `pack` (only that compendium's Roles / Focuses) - the `pickPerk` step passes it.

Tests: `module/rules/engine10-a.test.js` (32 tests).

## Verdicts

| Verdict | Count |
|---|---|
| Converted | **39** |
| Partial | **5** (Tactical Size Shift, Hybridization, Advanced Dino Gem Integration, Dino Drive Mode, Ninja Storm Wind Ranger) |
| Converted by another group | **1** (Restraining Gear - group D, with its `contest` step) |
| Still code | **5** |

## Converted

Each item's rules are on its pack source; `module/rules/conv10-slA10.test.js` (53 tests) loads each from the pack and
checks what the removed code did.

- **Megaform roster:** Accurate Combiner (RollModifier ↑1, scope megaform, `megaform:holderAttack`, by its attack
  type), Assault Weapon (DamageModifier +1, scope megaform, participant melee, not generated, `stacks: false`), Roller
  Drum (MegaformHealth +1 on a Combiner form), Power Master / Target Master (MegaformMirror of Perks + Powers /
  weapons, an `added` megaformSync, a Use), Scramble Modulator (hit Trigger on a Combiner form, a GM button: 1 Sonic to
  `combinerTop`), Warzord (megaformCombined reminder once per scene, scope megaform; Size `set: titanic`),
  Multi-Megaform (an `added` noteEntries of three Megaform Traits; Use "Apply a noted Megaform Trait": pick from noted,
  deleteItem granted, grant `{choice.active}`; Use "Re-choose the three").
- **Size:** Enlarged / Shrunk (added `shiftSize` ±1 class with record, removed `restoreSize` with the old flag as
  legacy, ArmorAccommodation), Revolutionary Shape-Shifting (Uses: askChoiceText creature + a size choose + mark for the
  scene / end; scene-start restore; a ↑1 switch), Big Rigger / Bigger Rigger (SizeMatrixCancel), Warrior Mode (Size
  `atLeast: towering` while active), Mesh Zord (Size `atLeast: towering` + its 13 Megaform-Trait rules using
  `pick from: remaining`).
- **Zords:** Rex Feature (added + Use: pick ownedZords, pickGrant a Feature not `item:heldBy:picked:zord`), Additional
  Zord (Auxiliary Zord once + two Features; SummonLimit), Terrorzord Nature (Essences via scope ownZord, Terror switch
  on both sides, fumble Power loss, the turn-start control button), Phantom Focus (Ship Integration Uses + driven-scope
  modifiers with `@sourced`), Sky Morpher (↑1 Driving their own Zord, both sides), Data-Link (turn-end mark when a
  drone wasn't Commanded, +1 Evasion until the next turn), Power Matrix (draw Use, zordOwner rest refill), Overdrive
  (crew pick + spendFrom, three options per turn by mark count, the pilot's Group Test switch).
- **Helper hooks:** Megaform Expeditor (JoinTime 1d4, ownZord), Unique Weapon (Small Melee) (SummonTime halve), Unique
  Weapon (Two-Handed Melee) (Movement derivedHook -10), Peerless Pilot PR / GI Joe (AutoDisembark; PR's Edge on
  Initiative and Driving while driving with a d6+ Driving Specialization), Bend Physics (team Movement derivedHook
  doubling), Emissary's Gift (pickPerk `pack: pr_crb`, level-capped, once), Emotional Range (KnownOptions).
- **Events:** Aura of Decay (beforeRoll: 1 Health, never below 0), Roll Out / For The Allspark (initiativeRolled: pick
  an Alt Mode, `transformInto`).
- **Forms:** Lightspeed Response, Turbo, Ranger Operator, Time Force, Beast Morpher, Supersonic (Form rules + Uses +
  their switches / Triggers; group B did Supersonic's damage half).
- **Partial:** Tactical Size Shift (its size is Size rules; the picker and Active Effect stay code), Hybridization
  (Change Size is Size rules; the Mass Shift pool stays code), Advanced Dino Gem Integration (Genetic Resonance is
  SummonTime; Primordial stays code), Dino Drive Mode (Amplified is a rule; engaging and Reflective Armor stay code),
  Ninja Storm Wind Ranger (Form, element, blasts, Duplication are rules; the incoming mind-control toggle stays code -
  group C's piece).

Removed code (with now-unused constants / imports / tests): zord1 `megaform.mjs` (Accurate Combiner, Assault Weapon,
Power / Target Master, Multi-Megaform), `bodies.mjs` (deleted), `zord-slots.mjs` (all but Megafauna), `emotions.mjs`
(Emotional Range), `forms.mjs` (every Form but Solar Power and Dino); tf2 `modes.mjs` (Roller Drum, Scramble, Roll Out)
and `common.mjs`; pr1 `ats.mjs` (Warzord combine + size shift), `misc.mjs` (Genetic Resonance), `jtt.mjs` (Overdrive);
zord2 `zord-features2.mjs` (Warrior / Mesh size, Mesh, Power Matrix), `hybridization.mjs` (Change Size); other2
`gij.mjs` (Big / Bigger Rigger); `data21/gear.mjs` and `data22/gear.mjs` (+ test) deleted; pr3 `pr-crb.mjs` (Megaform
Expeditor, Peerless Pilot, Unique Weapon small / two-handed), `ttsg.mjs` (Emissary's Gift); gij2 `vehicles.mjs`
(autoPassesDisembark); pr2 `team.mjs` / `finster.mjs` / `zords.mjs` (Bend Physics, Aura of Decay, Amplified); `dice.mjs`
(the PR Peerless Pilot Edge).

## Behaviour differences worth a decision

- Accurate Combiner's modifier label no longer names the owner.
- Power / Target Master, Sky Morpher: gear-type items count only while equipped.
- `pick` posts its "Picked" chat line even when it auto-picks the only option.
- Revolutionary Shape-Shifting: cancelling the size choice now stops the run (no shape taken).
- GI Joe Peerless Pilot no longer rolls a test it ignores.
- Genetic Resonance's chat line is gone (the rounds still change).
- Mesh Zord: Layered Systems is offered before Core Body in a different order; partial picks are kept on cancel.
- Overdrive: out of combat the three-option limit holds through a mark count; the group mark uses `nextTurn` and does
  not expire as combat starts; the group switch is pilot-scoped.
- Phantom Unseen Strike: the once-per-turn limit counts on the pilot; halving applies to the adjusted Evasion.
- Fumble Triggers don't fire on open rolls (no DIF).
- Beast Morpher carrots / berserk: legacy flags are honoured, new state is marks.
- Ninja Storm element marks clear on un-Morph only, not on a Form switch.
- Form Use buttons are hidden while not Morphed, instead of warning.
- Emissary's Gift lists Roles through getVisibleItemPacks (hidden packs are left out).
- Big / Bigger Rigger: the roll source id changed to `rulesSizeMatrixCancel`.
- Multi-Megaform: two Use buttons (apply / re-choose) instead of one chooser with a "re-choose" row; with nothing
  noted the apply Use says there is nothing to pick instead of opening the noting; the granted Trait carries
  `grantedBy` only (the old `zord1MultiMegaform` flag is still honoured when removing an older copy, since it also
  carried `grantedBy`).
- Spending through `spendFrom` posts a chat line when short, instead of a notification.

## Still code (5), and why

- **Signature Finishing Move**, **Megaform Advanced Signature Finishing Move** - need a hit-time damage multiplier
  across the participants' join; no step multiplies a posted hit's damage.
- **Emotional Strength** - the shame / shyness halves need dialog facts, there is a once-per-scene shared with
  emotional-mastery's Anger, and the watches are canvas-only. (`groupTestResult` was built for it anyway.)
- **Mobile Headquarters (Megaform half)** - a "best of" text shift between participants; no rule reads it.
- **Megaform Defender** - its reactor is the defending participant's pilot (a PC not on the canvas), found from a
  Megaform Trait of type `defender` on any participant (homebrew traits too). `rules/reactions.mjs` only offers to
  canvas tokens holding the Reaction rule; a `who: holderPilot` would need a reactor lookup there. Left as
  `helpers/extensions/react/reactions.mjs` code rather than reshape a shared core file another group may also touch.

## Shared-file edits

- `module/rules/index.mjs`: `addLinkedScope(name)`.
- `module/rules/links.mjs`: `EXTRA_LINKS`, `registerLinkScope`, the plug-in loop in `linkedEntries` (`stacks: false`
  dedupe).
- `module/rules/adapter.mjs`: `rollRules` passes `holder: entry.holder`.
- `module/helpers/grants.mjs`: `pickPerkFrom` `spec.pack` filter + JSDoc.
- `module/helpers/combiner-timer.mjs`, `zord-summon.mjs`, `vehicle-defeat.mjs`, `emotional-mastery.mjs`: dynamic
  imports of `ruleJoinTime`, `ruleSummonRounds`, `ruleAutoDisembark`, `ensureKnownOptions` (dynamic so the derived-hook
  order doesn't change).
- `module/dice.mjs` / `dice.test.js`: the PR Peerless Pilot Edge and its tests removed.
- `module/helpers/extensions/index.mjs`: the bodies / data21 gear / data22 gear imports removed.
- Slices: zord1, zord2, tf2, pr1, pr2, pr3, gij2, other2, data21, data22 (files above) and their tests.
- `module/rules/conv3-slA3.test.js`, `conv5-slA5.test.js`, `conv6-slA6.test.js`: import `./ext/index.mjs` so
  their validity checks know the plug-in types (Advanced Dino Gem's SummonTime, Bend Physics' `derivedHook`).
- Pack sources (text inserts, EOL kept): the 44 items above; Beast Morpher's existing `zord1Beast` tags became
  `{any: [choices.beast=X, zord1Beast=X]}`.

## Unused strings

Now unreferenced in `lang/en.json` (each checked with grep over module/, templates/, tours/):

Tf2RollOutPrompt, Tf2ScrambleButton, Tf2ScrambleOffer, Tf2ScrambleDone, Pr1DinoResonanceLine, Pr1Overdrive,
Pr1OverdriveAccurateLabel, Pr1OverdriveGroupToggle, Pr1OverdriveLine, Pr1OverdriveNoPayer, Pr1OverdrivePick,
Pr1OverdrivePickPayer, Pr1OverdriveSpent, Pr1WarzordCombine, Pr2AmplifiedDino, Pr2AuraOfDecayCost, Pr3EmissaryPrompt,
Zord1FormStart, Zord1FormStartCost, Zord1FormEnd, Zord1FormUsePrompt, Zord1TurboCart, Zord1TurboCartSummoned,
Zord1ElectroBooster, Zord1VectorWeapon, Zord1BeastPrompt, Zord1BeastChosen, Zord1BeastCheetah, Zord1BeastGorilla,
Zord1BeastJackrabbit, Zord1CheetahVortex, Zord1CheetahVortexHit, Zord1CheetahVortexMiss, Zord1CheetahDog,
Zord1CheetahDogFail, Zord1CheetahDogPass, Zord1GorillaBerserk, Zord1GorillaCalm, Zord1GorillaCalmed,
Zord1JackrabbitFumble, Zord1JackrabbitExhausted, Zord1JackrabbitCarrots, Zord1JackrabbitAte, Zord1NinjaElementPrompt,
Zord1NinjaElementAir, Zord1NinjaElementEarth, Zord1NinjaElementWater, Zord1NinjaElementChosen,
Zord1NinjaElementStart, Zord1NinjaElementStarted, Zord1NinjaAirBlast, Zord1NinjaWaterBlast, Zord1NinjaBlastMiss,
Zord1NinjaAirBlastHit, Zord1NinjaWaterBlastHit, Zord1NinjaDuplicate, Zord1NinjaMerge, Zord1NinjaDuplicated,
Zord1NinjaMerged, Zord1EmotionalRangeTitle, Zord1EmotionalRangePrompt, Zord1NoZord, Zord1PickZord,
Zord1ZordFeatureTitle, Zord1ZordFeatureGained, Zord1AdditionalZordPick, Zord1OneZordPerScene, Zord1TerrorzordFumble,
Zord1TerrorzordControl, Zord1TerrorzordRoll, Zord1TerrorzordHeld, Zord1TerrorzordLoose, Zord1ShipNotPiloting,
Zord1ShipIntegrated, Zord1ShipIntegrationEnded, Zord1MultiPick, Zord1MultiNoted, Zord1MultiApplyPrompt,
Zord1MultiRenote, Zord1MultiApplied, Zord1MastersSynced, Zord1NeedsAccommodation, Zord1Restricted, Zord1Limited,
Zord1ShapeCreature, Zord1ShapeSize, Zord1ShapeSmaller, Zord1ShapeSame, Zord1ShapeLarger, Zord1ShapeTaken,
Zord1ShapeEnded, Zord2Mesh, Zord2MeshPick, Zord2MeshChosen, Zord2PowerMatrixDrawn, Zord2PowerMatrixEmpty,
Zord2PowerMatrixHowMuch, Zord2PowerMatrixNoDriver.

(Zord1NoZordWeapon is unreferenced too, but an earlier round removed its user.) New strings:
`<scratchpad>/r10/lang-a.json` (`RulesExtA`: NeedsAccommodation, Restricted, Limited, NotEnough, OneZordPerScene,
NoteNth, Noted).

## Rule count

132 rules added to 44 pack items. `scripts/check-rules.mjs` (with every group's work so far): 2341 rules on 1366
items, 0 errors, 0 warnings. ESLint (`--ext .js,.mjs`, linebreak-style off) is clean on every file I touched. Jest:
`engine10-a.test.js` (32) and `conv10-slA10.test.js` (53) pass, and so do the touched slices and helpers; the full
suite ran at 550 suites / 10351 tests with only the three older conv tests failing on the plug-in types, now fixed
(their import of `./ext/index.mjs`).
