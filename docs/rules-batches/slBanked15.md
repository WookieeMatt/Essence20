# Round 15, part Banked

Scope: the 45 "piece" entries of the banked survey (`survey/result-banked.json`), the 13 items round 14 left unconverted
(`docs/rules-batches/slBanked14.md`), and Plan of Action together with its chat decorator
(`items/shared/gij-crb-item-lookups.mjs`). Most of these were Use buttons in `mechanics/resources/banked-buffs.mjs`; their
readers lived in `dice.mjs`, `documents/actor.mjs`, `mechanics/combat/combat.mjs` and per-item files under `module/items/`.

**Result:** 50 pack items carry rules from this part: 47 converted and 3 partial. 8 items are still code. **76 rules on 50
items.** Engine plug-ins are in the block "Round 15 (banked)" at the end of `rules/plugins/index.mjs`. Tests:
`module/rules/engine15-banked.test.js` covers the pieces (32 tests). `module/rules/conv15-banked.test.js` covers the pack
items (61 tests). `scripts/check-rules.mjs` reports 0 errors and 0 warnings for this part's items. Nothing is committed and
the packs are not compiled.

## Engine features added 2026-10-07 (round 15, banked)

### Rolling against creatures
- **`rollVsEach` `damage`, `dataset` and `onDouble`** (`rules/steps.mjs`):
  - `damage {value, type}` puts Apply Damage buttons on the card, multiplied by Degrees of Success. It travels as
    `dataset.stepDamage`, one generic key in dice.mjs's synthetic-damage chain.
  - `dataset {key: value}` adds flags to the roll, which Triggers read as `roll:dataset:<key>`. For example, Outwit's
    `isOutwit` is read by Deceptive Warfare and Inundation.
  - `onDouble` runs instead of `onHit` on a success of x2 Degrees or better.
  - `mechanics/combat/reaction-engine.mjs#rollVsMany` takes an optional 6th `extra` dataset, and its rows now carry
    `multiplier`. The extra arguments are passed only when a step sets them, so existing callers are unchanged.
- **`skill: "actor:<path>"`** rolls the Skill named at that path on the actor. Menace and Distracting Offer use
  `actor:system.originSkillsIncrease`. **`skill: "choiceOf:<uuid>"`** rolls the Skill picked on the actor's copy of that
  item (Tender reads the Empathy pick). With no such Skill the run stops before rolling.
- **`roll` `dataset`**: the same flag object, added to a plain `roll` step. Rouse uses `isRouseAttempt`, which Brutal
  Verbalities reads.
- **Tag `self:choiceOf:<uuid>`** (also `target:`; `plugins/tags/choice-of-tag.mjs`): true when the actor holds that item
  with a pick made on it.
- **Ref `@skillDie.<skill>`** (`plugins/rolls/skill-die-ref.mjs`): rolls the Skill's own die (d2 up to 3d6, d20 when
  untrained), with no shifts. Like other formula dice, the roll is shown in the step's chat and uses `scope.random` in
  tests. Hard Target and Resilience use it as `bank {defenseBonus: "@skillDie.acrobatics"}`; Surface Read uses it too.
- **Rule type `SnagImmunity {}`** with `when` (`plugins/rolls/snag-immunity.mjs`): the roll can't suffer a Snag. It is
  checked after the Roll Options Dialog and after every Snag the system adds, at the point where Time Traveler's code used
  to clear it. This is later than RollModifier `immune: ["snag"]`. dice.mjs calls `ruleSnagImmune`.

### Picking and reporting
- **`pick from: conditions {of?: self | target, exclude?: [ids], all?: true}`** (`plugins/picks/condition-pick.mjs`) offers
  the Conditions the actor (or the first target) has on now. They come in `CONFIG.E20.statusEffects` order; `all` offers
  every status. Follow it with `removeCondition {condition: "{choice.<key>}"}`. `removeCondition` now fills
  `{choice.x}` and `{var.x}`.
- **Step `targetFacts {of?}`** (`plugins/shared/target-facts-step.mjs`) puts facts about the first target (or the actor)
  into the run's vars:
  - `{var.name}`, `{var.health}`, `{var.healthMax}`;
  - `{var.hangUps}`, `{var.perks}`, `{var.powers}` (item names, comma-joined, or "none");
  - `{var.resistances}` (immunities marked as immune);
  - `{var.defenses}` and `{var.lowestDefense}`.

  With no target, the run stops with a "needs a target" line. Studious Measures, Breaking Point and Study Weaknesses use it.
- **Ref `@effectiveLevel.self | target`**: an NPC's or vehicle's Threat Level, otherwise the level.
- **Step `keepTargets {max}`** (`plugins/picks/keep-targets-step.mjs`): the run's targets are cut to the first `max` (a
  formula) - "the first N enemies in range". Below 1 the run stops. Bumper Crop and Entropic Sponge use it.
- **Step `lendAssistance`** (`plugins/rolls/lend-assistance-step.mjs`) runs `activateLendAssistance` and puts its report in
  chat. A cancelled assist stops the run (I Got You).

### Who it acts on
- **Recipient `pilotedVehicleOrTarget`** (`plugins/zords/piloted-vehicle-or-target.mjs`): the vehicle or Zord the actor
  crews, else the first target if it is a vehicle. Use it with `focus`. Engine Override, Jury Rig and Improvise Armor use it.
- **Tag `self:holdsItem:<item tags joined by &>`** (also `target:`; `plugins/picks/owned-item-steps.mjs`): the actor owns an
  item that meets every one of those item tags.
- **Step `flagItem {item, flag, exclusive?: [item tags], loneEffect?}`** sets `flags.essence20.<flag>` on the picked item.
  - `exclusive` first takes the flag off the actor's other items that match those tags.
  - `loneEffect` switches the item's single Active Effect off, and back on when the flag comes off.

  Matured uses `maturedIgnored`, which the rules index and `findHangUp` already skip.
- **`updateItem` `multiply`, `parent` and `appendTraits`**:
  - `multiply {path: factor}` multiplies the number at that path and rounds down; empty values stay empty.
  - `parent: true` acts on the picked weaponEffect's weapon.
  - `appendTraits` adds traits, each one once.

  Weapon Conversion uses all three.

### Turn order and combat stamps
- **Tags `self:stamped:<flag>[:round | :turn]`** (also `target:`; `plugins/tags/combat-stamps.mjs`): `flags.essence20.<flag>`
  holds a `{combatId, round, turn}` stamp from the running combat, this round or this turn. The Quiet One uses
  `combat:ally:target:stamped:quietOneNoisyActionThisRound`.
- **Step `stamp {flag, to?}`** writes that stamp, with nulls out of combat. Stand Behind Me! uses it for the taunt flag its
  reader keys on.
- **Tag `target:turnNeighbour:up | down`** (also `self:`) is true when a combatant with rolled Initiative sits directly
  above or below. **Ref `@turnOrder.up | down`** gives that combatant's Initiative. It is read for the step's recipient,
  else the first target, else the actor. Work the Numbers uses
  `writeInitiative {value: "@turnOrder.up + 0.01", exact: true}`.
- **Ref `@combat.round` / `@combat.turn`** (`plugins/effects/round-durations.mjs`): 0 with no combat.

### Durations (`plugins/effects/round-durations.mjs`)
- **`until: "thisRound"`** lasts while the combat round stays the one it started in. Out of combat, it lasts until a combat
  round is running (Engine Override).
- **`until: "throughNextRound"`** lasts through the round after the one it started in, and never runs out out of combat
  (Hup!, Jury Rig's Free mode).
- **`until: "mapScene"`** lasts while the viewed scene (`game.scenes.current`) is the one it started on. Distracting Offer
  uses it because the old code keyed on the map, not the Scene Clock.

### Banks and marks
- **`bank` `defenseMultiply`**: that Defense is multiplied against the next matching attack instead of added to. Read it with
  `rules/bank.mjs#bankedDefenseMultiplier`; dice.mjs applies it where Roll With The Punches used to double the Defense.
- **`bank` `key` and `stackMax`**:
  - `replace: true, key: k` replaces only this item's banks under `k`, so one item can keep two kinds of bank (Grid
    Surge's Edge and its Toughness Boost).
  - `stackMax: N` adds the replaced bank's Defense bonus to the new one, up to N ("stacking to +3").
  - Entries keep their `key`.
- **Steps `splitBank` and `scaleBank`, tag `self:bankedFrom:<uuid>`** (`plugins/resources/bank-steps.mjs`):
  - `splitBank` is a button step. It moves part of the ↑ this item banked on the first target to another ally the presser
    picks (Plan of Action's Split).
  - `scaleBank {from: <uuid>, multiply}` multiplies the live banks made by that book item (Stand Firm doubles Stalwart
    Defense).
  - `self:bankedFrom:<uuid>` is true while such a bank is live.
- **`mark` `keep: N`** (a formula): the setter's mark under that key stays on the newest N creatures only. Mark Target uses
  `keep: "1 + 4 * @owned.<Additional Marks id>"`. Order stamps always increase, so marks set in the same millisecond still
  have an order.
- **`DieSubstitution` `from: [dice]` and `consumeMark`** (`rules/adapter.mjs#ruleDieSubstitution`):
  - `from` applies only when the roll starts at one of those dice.
  - `consumeMark` means the roll uses up the roller's mark.

  Ageless Knowledge uses `{mode: floor, die: d4, from: [d2], consumeMark}`.
- **`HitRider` `consumeMark: <key>`** (`plugins/combat/hit-rider.mjs`): the first hit the rule acts on uses up the hitter's
  own mark. This gives a one-shot "+1 damage on your next damaging hit" (Smashmouth Offense). `hitRiderOnAttack` returns
  the write only when a mark was used.

### Costs and movement
- **Use `cost.kind`** (a name, only with `cost.action`): `pay()` receives `{kind}` so the action economy's cost changers can
  read it. Rouse's `kind: "rouse"` gets Rousing Presence's discount. See `rules/triggers.mjs` and
  `mechanics/actions/action-perks.mjs`.
- **Movement `@recipient`**: a Movement rule's value can read the actor whose movement it is. Hup! uses
  `@recipient.flags.essence20.ruleMarks.hupHup.count` on a marked rule.

## Verdicts

| Item | Pack file | Verdict |
|---|---|---|
| Avalanche Stomp | `fmmcitems/_source/Avalanche_Stomp_NyK58rUo6jiwX5Aq.json` | converted |
| Your Safety's On | `qgtgitems/_source/Your_Safety_s_On_CLwsh2pCwbrgYGru.json` | converted (bug fixed, below) |
| Human Bullet | `ccitems/_source/Human_Bullet_KGdGal1EWQ3m4HTw.json` | converted |
| Explosive Morph | `jttitems/_source/Explosive_Morph_ExplosiveMorphJT.json` | converted |
| Menace | `ccitems/_source/Menace_t0QDESiNz7GEDYHL.json` | converted |
| Tender | `mlpcrbitems/_source/Tender_xR4z6mV7Ab72TyVs.json` | converted |
| Takedown | `gijcrbitems/_source/Takedown_Yev7VrgEKtsTGdrx.json` | converted |
| Surface Read | `gijcrbitems/_source/Surface_Read_5YfAL40M8FlZvBVb.json` | converted |
| Hard Target | `prcrbitems/_source/Hard_Target_9oFOf0qSLJCwCGmZ.json` | converted |
| Resilience | `prcrbitems/_source/Resilience_TomU7e31oHoRsIrT.json` | converted |
| Roll With The Punches (GIJ) | `gijcrbitems/_source/Roll_With_The_Punches_5hBral7hiCPv3GqF.json` | converted |
| Roll with the Punches (Slammer) | `sssitems/_source/Roll_with_the_Punches_b1MNR5CPCitDTj4n.json` | converted |
| Plan of Action (GIJ) | `gijcrbitems/_source/Plan_of_Action_7wsu99k8v620IB2N.json` | converted, with its chat decorator and Split button |
| Plan of Action (WTNV) | `wtnvcgitems/_source/Plan_of_Action_D3uXlXL7jNn0eD8T.json` | converted |
| Inspiring Words | `gijcrbitems/_source/Inspiring_Words_0cGhuapOhkdwYC9G.json` | converted |
| Forward Observation | `ghpfitems/_source/Forward_Observation_wOxrMAMHJWFs1DBN.json` | converted |
| Eltarian Mettle | `ttsgitems/_source/Eltarian_Mettle_bDgQ7jyTgisY42kt.json` | converted (`items/healing/eltarian-mettle.mjs` stays for Venom Warlord / Nu, Pogodi!) |
| Balance and Harmony | `iafav2items/_source/Balance_and_Harmony_YydXnrEdfZpl6DU6.json` | converted |
| Talk Them Up | `fgtaaitems/_source/Talk_Them_Up_H6hSIGrG2zCQa6Kr.json` | converted |
| Studious Measures | `dditems/_source/Studious_Measures_ADj30QljJZ7iNt52.json` | converted |
| Study Weaknesses | `ccitems/_source/Study_Weaknesses_AIkpuWVylCFyuLuX.json` | converted |
| Breaking Point | `qgtgitems/_source/Breaking_Point_KYgAj14jx4BkjCfl.json` | converted |
| Engine Override | `iafav2items/_source/Engine_Override_rouaWvDWhwCB5XEO.json` | converted |
| Jury Rig | `iafav2items/_source/Jury_Rig_PV4QvqJgT1orMm1D.json` | partial: the Use is a rule that writes `pendingJuryRigBenefit`; the benefit readers stay in `items/vehicles/jury-rig.mjs` (bug fixed, below) |
| Improvise Armor | `iafav2items/_source/Improvise_Armor_P9JXwQ2991e1Bw1G.json` | converted |
| Stalwart Defense | `tfcrbitems/_source/Stalwart_Defense_uhp3JOTYZJfHrz7q.json` | converted (bug fixed, below) |
| Stand Firm | `tfcrbitems/_source/Stand_Firm_rAxKrR4ObFGeH5yP.json` | converted |
| I Got You | `eocitems/_source/I_Got_You_h8DuSX4N1buJb6uN.json` | converted |
| Rouse | `gijcrbitems/_source/Rouse_AVhNGB1h4e4eeNPD.json` | converted |
| Time Traveler | `jttitems/_source/Time_Traveler_bXkXXr0VMXpoAiv0.json` | converted |
| Entropic Sponge | `fmmcitems/_source/Entropic_Sponge_dpxjT9eTAKcZuRXs.json` | converted |
| Bumper Crop | `wtnvcgitems/_source/Bumper_Crop_5GDpvzG3x2ZgrrQj.json` | converted |
| Ageless Knowledge | `atsitems/_source/Ageless_Knowledge_peGPrJKYlx79ybbu.json` | converted |
| Weapon Conversion | `dditems/_source/Weapon_Conversion_WbXurpieXjFkmS8h.json` | converted |
| Matured | `ccitems/_source/Matured_bf4nxa6WKKhuQcEH.json` | converted |
| The Quiet One | `iafav2items/_source/The_Quiet_One_eKmiGE7NChwZ2E96.json` | converted (the "noisy action" stamp writer `items/rolls/quiet-one.mjs#markQuietOneNoisyAction` stays: every roller writes it) |
| Work the Numbers | `tfcrbitems/_source/Work_the_Numbers_aFgXXk1gMMb4saVf.json` | converted |
| Outwit | `gijcrbitems/_source/Outwit_DVBrtxa9iiXXhDoS.json` | converted (the roll still carries `dataset.isOutwit`) |
| Mark Target | `tfcrbitems/_source/Mark_Target_T2mm6VmvcUxagsjc.json` | converted (`items/rolls/mark-target.mjs#checkMarkTarget` now reads the rule mark plus the Mark Everybot window) |
| Hup! Hup! Hup! Hup! Hup! | `sssitems/_source/Hup__Hup__Hup__Hup__Hup__xsIHUoZaFoadsmma.json` | converted |
| Distracting Offer | `ccitems/_source/Distracting_Offer_fUSF6fxRyTniN2wT.json` | converted |
| Omega Enhancement (Form) | `atsitems/_source/Omega_Enhancement__Form__8GtRpU81iPJUCBEw.json` | converted (dice.mjs's Electro ignore-armor reads the roll's `dataset.omegaEnhancementMode`) |
| Dig Deep (WTNV) | `wtnvcgitems/_source/Dig_Deep_A2Xay6rHrBK9l8eo.json` | converted |
| Dig Deep (GIJ) | `gijcrbitems/_source/Dig_Deep_QJkcVXT7K4yNWFoT.json` | converted |
| Dig Deep (MLP) | `mlpcrbitems/_source/Dig_Deep_geBN3DkixaCXvnSO.json` | converted |
| Dig Deep (TF) | `tfcrbitems/_source/Dig_Deep_uPxkVrCLuBdx9kty.json` | converted (once per combat; the 1d2 heal clause stays unbuilt, as before) |
| Smashmouth Offense | `ccitems/_source/Smashmouth_Offense_3OPswxxHjsYrQggY.json` | converted |
| Grid Surge | `atsitems/_source/Grid_Surge_PEDHPJkoGvvJed5u.json` | converted |
| Stand Behind Me! | `atsitems/_source/Stand_Behind_Me__PcezfGdjUtNUZHYH.json` | partial: the Use (Power, taunt stamp) is a rule; the turn-start Alertness button and the roll block stay in `items/attacks/stand-behind-me-taunt.mjs` |
| Mysterious Aura | `prcrbitems/_source/Mysterious_Aura_hSu10Kgj9g1LSmyv.json` | partial: the Use (Power, aura and Defense pick) is a rule; the Imposing / Protective / Resplendent readers and the de-Morph clear stay in `items/defenses/mysterious-aura.mjs` |
| Pack Attack | `ccitems/_source/Pack_Attack_spxYtWFQPj7bBt0g.json` | still code: it reads Growl's pending flag (its `targetId`), and Growl is still code |
| Eye For Appraisal | `dditems/_source/Eye_For_Appraisal_JlwxiwZDpq7UkYXn.json` | still code: a 2d2 counted mark that one attack decrements, plus Vantage Point's picked 20 ft area that `isInAppraisedArea` reads |
| Powerful Suggestion | `eocitems/_source/Powerful_Suggestion_QRGflsYQcDN16l10.json` | still code: no rule turns "the next success" into a Critical Success outside a Reaction |
| Trade School | `qgtgitems/_source/Trade_School_yR5QrBHWNUnbuiG7.json` | still code: tied into the qualification-perks scene coach, and Technical Mastery's crit-on-d2 has to reach the ally |
| Data Bridge | `eocitems/_source/Data_Bridge_uLtZ0zbfx0K4jcSK.json` | still code: needs an allies'-Specializations pick source and a "borrowed Specialization" bank (Think Tank variant too) |
| Misery Loves Company | `eocitems/_source/Misery_Loves_Company_JJ8ffuxjYeXJ9KJ2.json` | still code: moves a (holder, Condition) pair to a Data-Bridged ally, so it depends on Data Bridge |
| Tech Specs | `qgtgitems/_source/Tech_Specs_Ii4gXQePcG8xg0hB.json` | still code: compares against the highest Defense through the full dice pipeline, and Technical Mastery reads `techSpecsMarked` |
| Ground Suppression | `qgtgitems/_source/Ground_Suppression_nCjrhYaUuN4omhDm.json` | still code: Danger Close spares the first N targeted tokens from the area, and no recipient filter does that yet |

Code removed (each file with its `.test.js` where it had one):

| Folder | Deleted files |
|---|---|
| `items/attacks/` | avalanche-stomp, explosive-morph, forward-observation, human-bullet, menace, takedown, weapon-conversion |
| `items/forms/` | omega-enhancement |
| `items/healing/` | balance-and-harmony, talk-them-up |
| `items/resources/` | grid-surge, rouse |
| `items/rolls/` | ageless-knowledge, dig-deep-skill-snag, entropic-sponge, time-traveler, work-the-numbers |
| `items/senses/` | breaking-point, studious-measures |
| `items/social/` | bumper-crop, distracting-offer, hup-hup-hup-hup-hup, inspiring-words, matured, outwit, plan-of-action-split, tender, your-safetys-on |
| `items/vehicles/` | engine-override, improvise-armor |

Rewritten as readers only: `items/vehicles/jury-rig.mjs`, `items/rolls/mark-target.mjs` and `items/rolls/quiet-one.mjs`, with
their tests. In `banked-buffs.mjs`, the dispatch of every converted item is gone (constants, canUse and onUse blocks,
consume helpers, pickers and imports). `BANKABLE_PERKS` now holds only Guidance, which the items2 part is converting.

Accepted differences:
- **Limits and Use buttons**:
  - Rule `limit`s count only in a started combat.
  - Some Use buttons stay visible where the old code hid them; the steps still refuse. Examples: Distracting Offer's
    target check and Tender.
- **Ranges and stages**:
  - Avalanche Stomp reaches everyone within 30 ft (`all:30`).
  - Hup!'s and Engine Override's movement bonuses are at stage `final`, so they order differently against Lightning
    Speed / Mobile Mode.
- **Small reading changes**:
  - The Quiet One's side test uses token disposition.
  - Omega Enhancement's Power Mode is a labelled Edge source, not a pre-dialog dataset edge.
  - Stand Firm doesn't re-stamp the bank's duration.
  - The GIJ and Slammer Roll With The Punches no longer share one pending flag.
- **Dig Deep**:
  - The one-shot damage reduction is a `DamageReduction {consumeMark: digDeep}` rule, read in `runDamageModifiers`. That is
    the same shape as the PR CRB printing (items1), and it runs before the damage shields rather than after them. Totals
    are unchanged; the only difference is which of two one-shot reductions gets spent when a hit is already brought to 0.
  - It also shares the `digDeep` mark with the PR CRB printing: a holder of both gets one reduction per use.
  - The Snag is a mark until the end of the next turn (in combat). Out of combat it is a one-roll mark that the next Skill
    Test uses up.
- **Smashmouth Offense** labels its +1 on the hit ("+1 from Smashmouth Offense"). Before, the +1 was silent.

## Bugs found and fixed

- **Your Safety's On**: the Critical Success Snag was applied to whoever attacked the flagged enemy, not to the enemy's own
  attacks. It is now a marked RollModifier that applies on the marked creature's rolls (conv15 test).
- **Jury Rig**: Standard mode stored `Infinity` as the expiry round. That serialises to `null`, so the benefit was never
  active in combat. It now stores 999999 (conv15 test).
- **Stalwart Defense**: the pending flag stayed until an attack cleared it, which blocked the Use on the next turn. The bank
  now runs out at `nextTurn` (conv15 test).
- **`bank` step** (engine): each number used to be worked out twice, once for the bank and once for the chat line. A
  formula with dice (`@skillDie`) therefore rolled twice and could report a different number than it banked. Each number
  is now worked out once (engine15 test).
- **`items/rolls/mark-target.mjs`** imported `hasUsedThisEncounter` from `mechanics/characters/perks.mjs`. Since the
  uses-rider tag plug-in imports mark-target.mjs, every engine suite that mocks perks.mjs (engine10-b, conv10-slB10) failed
  to load. It now reads the window through `scene-clock.mjs#getUses`, with the same behaviour.

## Code vs notes - needs a ruling

| Item | Notes say | Code does (kept) |
|---|---|---|
| Resilience | while Morphed, and until your next turn | No Morphed gate; the first attack against any Defense spends it |
| Stand Behind Me! | while Morphed | No Morphed gate |
| Mysterious Aura | while Morphed, and costs a Move action | No Morphed gate, no action charged |
| Takedown | a Standard action | No action charged |
| Stand Firm | a Move action | No action charged |
| Distracting Offer | "this scene" | Keyed to the viewed map (`until: mapScene`), not the Scene Clock |
| Jury Rig | a once-per-turn limit, and scene-long benefits ending with the scene | Neither is enforced |

## Shared-file edits

Engine:
- **`rules/steps.mjs`**:
  - `rollVsEach`: `damage`, `dataset`, `onDouble`, skill check before rolling, validator.
  - `skillFor`: `actor:` and `choiceOf:`.
  - `removeCondition`: `{choice}` / `{var}` filling.
  - `bank`: each number worked out once; `defenseMultiply`, `key`, `stackMax`; chat "xN".
  - `roll`: `dataset`.
  - `updateItem`: `multiply`, `parent`, `appendTraits`.
  - `mark`: `keep`, with an increasing order stamp.
  - Formula-validated keys: `defenseMultiply`, `keep` (mark only), `stackMax`.
- **`rules/bank.mjs`**: entries carry `defenseMultiply` and `key`; new export `bankedDefenseMultiplier`.
- **`rules/adapter.mjs`**: `ruleDieSubstitution` handles `from` and `consumeMark`; the Movement value scope has `recipient`.
- **`rules/types.mjs`**: `cost.kind`; DieSubstitution params `from` and `consumeMark`.
- **`rules/triggers.mjs`**: `runUse` passes `{kind}` to `pay`.
- **`rules/plugins/index.mjs`**: the "Round 15 (banked)" block.
- **`rules/plugins/combat/hit-rider.mjs`**: HitRider `consumeMark`.

Mechanics:
- **`mechanics/combat/reaction-engine.mjs`**: `rollVsMany` takes a 6th `extra` argument; rows carry `multiplier`.
- **`mechanics/actions/action-perks.mjs`**: `pay(cost, context)` passes `context` to `economy.spend`.
- **`mechanics/combat/combat.mjs`**: Dig Deep's `PENDING_DIG_DEEP_FLAG_KEY` and `consumeDigDeepReduction` removed; unused
  perks imports dropped.
- **`mechanics/resources/banked-buffs.mjs`**: dispatch removed for every converted item; unused imports dropped.

Roll pipeline, actor and items:
- **`dice.mjs`**:
  - The converted items' readers, checkContext entries, post-roll blocks and imports are removed.
  - `ruleSnagImmune` and `bankedDefenseMultiplier` calls are added.
  - Stale comments that pointed at deleted files are updated.
- **`documents/actor.mjs`**: the Engine Override and Hup! movement lines are removed.
- **`items/index.mjs`**: the plan-of-action-split and dig-deep-skill-snag imports are removed.
- **`items/shared/gij-crb-item-lookups.mjs`**: Plan of Action's chat decorator is removed.
- **`items/defenses/mysterious-aura.mjs`**: the picker and activation are removed.
- **Comments only**: `items/attacks/stand-behind-me-taunt.mjs` (header) and `items/forms/power-adaptation.mjs`.

Tests:
- `dice.test.js`, `mechanics/resources/banked-buffs.test.js`, `documents/actor.test.js`, `mechanics/combat/combat.test.js` and
  `items/defenses/mysterious-aura.test.js`: old tests for the converted items are removed or moved onto the rules.
- `dice.test.js` also gains a SnagImmunity test, a `dataset.stepDamage` test and a ruleBank `defenseMultiply` test. The
  Mark Target tests now give the target a rule mark.

## Unused strings

These `lang/en.json` keys are no longer read anywhere in `module/`, the templates or the packs:

- **Ageless Knowledge**: `E20.AgelessKnowledgePickSkillLabel`, `E20.AgelessKnowledgePickSkillTitle`
- **Balance and Harmony**: `E20.BalanceAndHarmonyPickConditionLabel`, `E20.BalanceAndHarmonyPickConditionTitle`
- **Breaking Point**:
  - `E20.BreakingPointNoTarget`, `E20.BreakingPointPickLabel`, `E20.BreakingPointPickTitle`
  - `E20.BreakingPointResultDefenses`, `E20.BreakingPointResultHealth`, `E20.BreakingPointResultItems`,
    `E20.BreakingPointResultNoneKnown`
- **Distracting Offer**: `E20.DistractingOfferNoTarget`, `E20.DistractingOfferUnavailable`
- **Entropic Sponge**: `E20.EntropicSpongePickSpendLabel`, `E20.EntropicSpongePickSpendTitle`
- **Plan of Action**: `E20.Gij2PlanSplit`, `E20.Gij2PlanSplitDone`, `E20.Gij2PlanSplitHowMany`, `E20.Gij2PlanSplitNothing`,
  `E20.Gij2PlanSplitWho`
- **Grid Surge**: `E20.GridSurgeConstruct`, `E20.GridSurgeConstructSkillLabel`, `E20.GridSurgePickOptionLabel`,
  `E20.GridSurgePickOptionTitle`, `E20.GridSurgeReshape`, `E20.GridSurgeToughnessBoost`
- **Human Bullet**: `E20.HumanBulletPickRadiusLabel`, `E20.HumanBulletPickRadiusTitle`, `E20.HumanBulletTightBlast`,
  `E20.HumanBulletWideBlast`
- **Inspiring Words**: `E20.InspiringWordsPickConditionLabel`, `E20.InspiringWordsPickConditionTitle`,
  `E20.InspiringWordsPickEffectLabel`, `E20.InspiringWordsPickEffectTitle`, `E20.InspiringWordsRemoveCondition`,
  `E20.InspiringWordsShiftUp`, `E20.InspiringWordsTempHealth`
- **Jury Rig**:
  - `E20.JuryRigActionTypeFree`, `E20.JuryRigActionTypeStandard`
  - `E20.JuryRigOptionAlignSuspension`, `E20.JuryRigOptionCleanBarrels`, `E20.JuryRigOptionEngineTurboBoost`,
    `E20.JuryRigOptionHardenArmor`, `E20.JuryRigOptionImproveAerodynamics`, `E20.JuryRigOptionJacketAmmunition`,
    `E20.JuryRigOptionWatertightSeals`
  - `E20.JuryRigPickActionTypeLabel`, `E20.JuryRigPickOptionLabel`, `E20.JuryRigPickOptionTitle`
- **Matured**: `E20.MaturedIgnoredNotification`, `E20.MaturedPickHangUpLabel`, `E20.MaturedPickHangUpTitle`
- **Mysterious Aura**: `E20.MysteriousAuraImposing`, `E20.MysteriousAuraPickDefenseLabel`, `E20.MysteriousAuraPickTitle`,
  `E20.MysteriousAuraPickTypeLabel`, `E20.MysteriousAuraProtective`, `E20.MysteriousAuraResplendent`
- **Omega Enhancement**:
  - `E20.OmegaEnhancementOptionBlast`, `E20.OmegaEnhancementOptionChargedUp`, `E20.OmegaEnhancementOptionElectro`,
    `E20.OmegaEnhancementOptionHyper`, `E20.OmegaEnhancementOptionLightBeam`, `E20.OmegaEnhancementOptionMuscle`,
    `E20.OmegaEnhancementOptionPower`
  - `E20.OmegaEnhancementPickEssenceLabel`, `E20.OmegaEnhancementPickOptionLabel`, `E20.OmegaEnhancementPickOptionTitle`
- **Outwit**: `E20.OutwitDeceptionButton`, `E20.OutwitIntimidationButton`, `E20.OutwitPickSkillLabel`,
  `E20.OutwitPickSkillTitle`
- **Defense allocation picker**: `E20.PickDefenseAllocationLabel`, `E20.PickDefenseAllocationTitle`
- **Roll With The Punches**: `E20.RollWithThePunchesPickDefenseLabel`, `E20.RollWithThePunchesPickDefenseTitle`
- **Stalwart Defense**: `E20.StalwartDefenseBothOption`, `E20.StalwartDefenseEvasionOption`,
  `E20.StalwartDefenseToughnessOption`
- **Stand Firm**: `E20.StandFirmActivated`
- **Studious Measures**: `E20.StudiousMeasuresImmuneTo`, `E20.StudiousMeasuresNoHangUps`,
  `E20.StudiousMeasuresNoResistances`, `E20.StudiousMeasuresNoTarget`, `E20.StudiousMeasuresResistantTo`,
  `E20.StudiousMeasuresResult`
- **Surface Read**: `E20.SurfaceReadResult`
- **Takedown**: `E20.TakedownPickSkillLabel`, `E20.TakedownPickSkillTitle`
- **Talk Them Up**: `E20.TalkThemUpNoCondition`, `E20.TalkThemUpNoTarget`, `E20.TalkThemUpPickCondition`,
  `E20.TalkThemUpTitle`
- **Time Traveler**: `E20.TimeTravelerActivated`, `E20.TimeTravelerDeactivated`, `E20.TimeTravelerPickSkillLabel`,
  `E20.TimeTravelerPickSkillTitle`
- **Weapon Conversion**: `E20.WeaponConversionNoEligibleWeapon`, `E20.WeaponConversionPickWeaponLabel`,
  `E20.WeaponConversionPickWeaponTitle`
- **Work the Numbers**: `E20.WorkTheNumbersDownOption`, `E20.WorkTheNumbersNoValidTarget`,
  `E20.WorkTheNumbersPickDirectionLabel`, `E20.WorkTheNumbersPickDirectionTitle`, `E20.WorkTheNumbersUpOption`

New strings are in `<scratchpad>/r15/lang-banked.json` under `RulesExtBanked`: `Immune`, `NeedsTarget`, `None`,
`SplitBankDone`, `SplitBankHowMany`, `SplitBankNothing`, `SplitBankWho`.

## Rule count

**76 rules on 50 items** (47 converted, 3 partial).
