# Round 16, part b - the last convertible leftovers (2026-10-07)

Scope: the 23 entries of `survey/left-b.json` that rounds 14 and 15 left as code. 20 converted (plus Technical Mastery's
Tech Specs Edge and the Night Vale Science / Travel Reporter kits, which shared code with them), 1 still code, 2 permanent.
Tests: `module/rules/engine16-b.test.js` (10) and `module/rules/conv16-b.test.js` (39).

## Engine features added 2026-10-07 (round 16, b)

All new plug-in files are imported in `rules/plugins/index.mjs`'s "Round 16 (part b)" block. Strings are under
`E20.RulesExtLeftB16.*`.

### Durations (`plugins/effects/combat-round-durations.mjs`)

- **`until: "combatRound"`** - while the combat the effect started in is the current one and its round is the same. Set
  out of combat, it never counts. Ground Suppression's -5 ("until the start of your next turn", read at round
  granularity).
- **`until: "combatThroughNextRound"`** - the same combat, through the round after the one it started in. Tech Specs.

### Banks, borrowed Specializations, Conditions (`plugins/resources/bank-keys-and-borrowing.mjs`)

- **Pick source `allySpecializations`** - every Skill Specialization an ally on the scene holds (the system's ally count,
  any range): value the Skill, label "<Specialization> (<Skill>) - <ally>". **`perAlly: true`** - one option per ally
  (allies of the same name count as one), value every Skill they're Specialized in joined by "|". Data Bridge, Think Tank.
- **Tags** `self:allySpecializations`; `skill:in:<a|b>` (the rolled Skill is one of them - `skill:in:{var.picked}` in a
  bank's appliesWhen); `self:bankKey:<key>` / `target:bankKey:<key>` (a live bank under that `key`);
  `self:sideBankKey:<key>` and `self:sideStatus:<a|b>` (the actor - with a token - or an ally on the scene).
- **`hasBankKey(actor, key)` / `bankKeySideCount(actor, key)`** for hand-written readers: dice.mjs's DataBridgeBonus
  (Tactical Triangulation) now asks for `key: dataBridge`.
- **Step `moveCondition {conditions, from?, to?, toFilter?, title?, fromLabel?, toLabel?}`** - one dialog: which
  (creature, Condition) pair among `from` (default the actor with a token and its allies) loses its Condition, and which
  of `to` (narrowed by `toFilter`, asked as the target) gains it. Nothing to choose, a cancel or the same creature twice
  stops the run. Misery Loves Company: `toFilter: ["target:bankKey:dataBridge"]`.

### Defenses and targets (`plugins/combat/defense-facts.mjs`)

- **Step `defenseFacts {of?}`** - the first target's (or the actor's) Defenses as an attack meets them
  (combat.mjs#getDefenseValue): `{var.highestDefense}` (ties to the first in Toughness, Evasion, Willpower, Cleverness),
  `{var.defenseValues}` ("Toughness 12, ..."), `{var.hangUpNames}` (or "none known"). No target: stops.
- **`rollVsEach` `defense` fills `{var.x}` / `{choice.x}`** (rules/steps.mjs) - `defense: "{var.highestDefense}"`.
- **Tag `target:amongUserTargets:<formula>`** - the other party is one of the first N of this user's targets. Danger
  Close: `filter: ["not:target:amongUserTargets:@actor.system.essences.smarts.value * @owned.<Danger Close id>"]`.

### Marks (`plugins/marks/counted-marks.mjs`, `plugins/rolls/marked-row-outcome.mjs`)

- **RollModifier `consumeCount: true`** (with `consumeMark`) - the roll takes ONE off the mark's count; the mark goes when
  it runs out. The consume (`rulesMarkOne`) is spent at roll time with the other rule consumes (dice.mjs,
  target-riders.mjs). Eye For Appraisal's "next 2d2 ranged attacks".
- **`inMarkedArea(attacker, target, token, key)`** - the mark keeps a point (`mark {text: "{var.pointX},{var.pointY},
  {var.pointScene}"}`) and the attacker stands in the 20 x 20 ft square around it. `check:inAppraisedArea` reads it.
- **`pickPoint {optional: true}`** - no point picked, the run goes on (empty point vars).
- **Rule type `MarkedRowOutcome {promote?, consume: promoted | x2}`** (scope `marked` + `mark`) - on the carrier's own rows
  (dice.mjs#_rollSkillHelper, after the Multiplier rules' early stage): `promote` turns a plain success into a Critical
  Success; `consume` uses the carrier's mark up once a row was promoted / reached x2. Powerful Suggestion.

### Picks, items, cards

- **Recipient `companionFlagged:<flag>`**, tags **`self:companionFlagged:<flag>`** and **`item:mentions:<a|b>`** (name or
  `system.prerequisite` contains one, hyphens counting as spaces) - `plugins/picks/flagged-companion-and-mentions.mjs`.
  Rally Guardians Features.
- **`createItem`** (rules/steps.mjs): `unlinked: true` (no grantedBy - it stays when the rule's item goes);
  `knownTraits: true` (system.traits keeps only CONFIG.E20.weaponTraits keys); a name that is an `E20.` key is localized,
  and `nameData: {key: text}` formats it (children too). Additional Attack Type.
- **`choose`**: option labels and the prompt that are `E20.` keys are localized; **`pick`**: an `E20.` prompt is localized
  and **`optional: true`** (nothing to pick or a cancel: the choice stays unmade, the run goes on);
  **`pickGeneralPerk {optional: true}`**. A Hint of Independence.
- **`roll {downshift}`** - ↓ on the roll, a formula (`@target.myMark.dominated`). **Tag `target:exists`**
  (`plugins/tags/target-exists-tag.mjs`). Dominate.
- **Step `placeBeside {to?}`** (`plugins/combat/place-beside.mjs`) - the recipients' tokens go just right of the actor's.
  **`contest`**: `best: true` on a side rolls its best listed Skill (a tie to the first listed); `tieWins: true` gives a tie
  to this actor. Try Me.

### Turn-start schedule (`plugins/combat/next-round-schedule.mjs`)

- **Step `scheduleNextRound {steps, replace?}`** - the steps run at the first turn start a round later at or past this
  point in the turn order (or any turn of the round after), in the combat the run happened in; never when set out of
  combat. `replace` - one per item. `{var.actorUuid}` when they run. `runScheduledNextRound(combat)` is called from
  documents/combat.mjs#_onStartTurn (the active GM). Self-Destruct.

### Hits, Powers, minions (`plugins/combat/incoming-hits-and-minions.mjs`)

- **HitRider `scope: "incoming"`** - acts on hits landing on its holder (self: = the one who hit, holder: = the holder).
- **Tags `self:minion` / `target:minion`** - not a Player Character and tagged minion / minions / foot soldier /
  footsoldier / foot-soldier / mook / grunt, or a Putty or Tenga.
- **Step `activatePower`** - the rule's own Power activated the sheet's way (power-handler.mjs#powerCost); the run then
  stops quietly. Metallic Armor Power Up's Use (switch on, or end).

### Kits (`plugins/resources/kit-options.mjs`, read by mechanics/resources/kits.mjs)

- **`KitOption {label, cost?, steps}`** - another choice in the kit's own Use list, first, while `when` holds; the action is
  paid, the steps run, their chat lines are the kit's message. WTNV Medicine Kit's heal.
- **`KitSkill {skill, spec?}`** - the kit's Skill / Specialization where its name doesn't say (kitInfo).

### Bonded partners (`plugins/combat/bond-partner-guard.mjs`)

- **RollModifier `scope: "bondPartnerIncoming"`** - on the bond holder's item: rolls against its bonded partner by anyone
  but the holder.
- **Defense `mode: "holderBest"`** (scope `bondPartner`) - per attack, the partner meets the better of its own and the
  holder's Defense.
- **Tags `target:inHolderReach`** (5 ft per holder token width), **`self:nearHolder:<ft>`**. Hit Someone Your Own Size!

### Engine edits

- `rules/adapter.mjs#ruleDerived`: a linked always-on Defense rule's `when` now sees its `holder` (In The Right Hands'
  `holder:transformed` on the wearer's sheet).
- `rules/adapter.mjs` consumeMark: `consumeCount` -> `rulesMarkOne`.

## Verdicts

| Item | Pack file | Verdict |
|---|---|---|
| Dominate | `qgtgitems/_source/Dominate_HwREY90wo09Hkdt1.json` | converted (3 rules: powerUsed Trigger, Command / Recall CardButtons) |
| Metallic Armor Power Up | `ttsgitems/_source/Metallic_Armor_Power_Up_LotTM0zOcCBLkki4.json` | converted (7 rules) |
| Data Bridge (+ Think Tank) | `eocitems/_source/Data_Bridge_uLtZ0zbfx0K4jcSK.json` | converted (1 Use; Think Tank's per-ally borrow is an option of it) |
| Misery Loves Company | `eocitems/_source/Misery_Loves_Company_JJ8ffuxjYeXJ9KJ2.json` | converted (1 Use) |
| Ground Suppression (+ Danger Close) | `qgtgitems/_source/Ground_Suppression_nCjrhYaUuN4omhDm.json` | converted (3 rules; Danger Close is read by its filter) |
| Tech Specs (+ Technical Mastery's Edge) | `qgtgitems/_source/Tech_Specs_Ii4gXQePcG8xg0hB.json`, `Technical_Mastery_QKlXoVgNMq7Kv58L.json` | converted (2 + 1 rules) |
| Eye For Appraisal | `dditems/_source/Eye_For_Appraisal_JlwxiwZDpq7UkYXn.json` | converted (2 rules) |
| Powerful Suggestion | `eocitems/_source/Powerful_Suggestion_QRGflsYQcDN16l10.json` | converted (4 rules) |
| Pack Attack | `ccitems/_source/Pack_Attack_spxYtWFQPj7bBt0g.json` | converted (2 rules; reads part a's `growl` mark) |
| Rig Upgrade | `ccitems/_source/Rig_Upgrade_FmJF8idUZpHAxIPM.json` | converted (1 Use) |
| Rally Guardians Features | `ttsgitems/_source/Rally_Guardians_Features_vJYXOqRQIDEUmuDE.json` | converted (1 Use) |
| Self-Destruct | `qgtgitems/_source/Self_Destruct_0xonF9tJvSOcn6Ow.json` | converted (1 Use) |
| Additional Attack Type | `prcrbitems/_source/Additional_Attack_Type_j5arWXvkd5fHbe0Q.json` | converted (1 `added` Trigger) |
| In The Right Hands | `dditems/_source/In_The_Right_Hands_z5xX6kylwvCblYkl.json` | converted (10 rules) |
| Hit Someone Your Own Size! | `eocitems/_source/Hit_Someone_Your_Own_Size__zDeWS4koDbfN98hB.json` | converted (2 rules) |
| Try Me | `sssitems/_source/Try_Me_ZyWXJTkPqv8S6K3b.json` | converted (Use + CardButtons) |
| A Hint of Independence | `dditems/_source/A_Hint_of_Independence_TkzfZUNiGvv5iWDh.json` | converted (1 Use); the imperfection's six readers stay code but read the Perk's flag, not its id |
| Medicine Kit (WTNV) (+ Science, Travel Reporter kits) | `wtnvcgitems/_source/Medicine_Kit_3mgHGQRzVaKtwnWb.json` (+ `Science_Kit_alcXH1wbroHciYlS`, `Travel_Reporter_Kit_gG1nTctk40oLyJJH`) | converted (KitOption + KitSkill; KitSkill on the other two) |
| Trade School | - | **still code** - see below |
| Team Player | - | **permanent** - see below |
| Let's Bring 'Em Together! | - | **permanent** - see below |

### Still code (1)

- **Trade School** - the grant is a two-phase state: a pending grant that survives scene changes, turned into a scene-long
  "coach" on the ally's first Technology roll. Converting it needs a DieSubstitution reading the coach's (holder's) die, a
  CritOnD2 carried by a mark (Technical Mastery's "extends to allies benefiting from your Trade School") whose check runs
  before the pending mark is used up, and a mark set on the coach's behalf at that first roll. Without them it can only be
  approximated (the scene counted from the grant), so it stays in `items/rolls/trade-school.mjs` /
  `items/gear/qualification-perks.mjs`.

### Permanent (2)

- **Team Player** - a lending ledger: the giver's Survival Boon leaves their sheet into a flag list, a teammate takes it
  from a card (paying their own Personal Power), it returns on the giver's next Morph and leaves the taker when they
  unmorph (team-actions.mjs#onMorphChanged). A cross-actor hand-off protocol tied to Morph state, not item rules.
- **Let's Bring 'Em Together!** - a join roster across players on one card (Join, paid by each joiner; Fire by the leader)
  that builds a temporary attack whose damage is the member count and rolls it through the item's own roll (and the
  action economy). A bespoke multi-player card flow.

## Bugs found and fixed

- **Rally Guardians Features** could pick "Zord Mega-Weapon System": the exclusion was `/combiner|mega weapon/`, which a
  hyphen defeats. `item:mentions` treats a hyphen as a space. (Test: conv16-b "Rally Guardians Features".)
- **Metallic Armor Power Up's upkeep** ran from the `combatTurn` / `combatRound` hooks on every client that owned the
  actor, so a player-owned Ranger could be charged once per owning client. It is now a turnStart Trigger, run once on the
  GM. (It is also charged on the combat's first turn, which those hooks skipped.)
- **Choose labels and prompts that are `E20.` keys showed raw** (Afterburners' "E20.MovementGround" options); `choose` and
  `pick` now localize them.
- **Linked always-on Defense rules read `holder:` tags of the carrier** in rules/adapter.mjs#ruleDerived (the holder
  wasn't passed); fixed. No pack rule relied on the old reading.

## Behaviour differences worth a decision

None needs a ruling; listed so they're known.

- Ground Suppression's -5 is an early Defense add: it lands after early "use the better Defense" rules without `plus`
  (before them in the old code). Nobody in the area: the Use says "needs a target" instead of rolling at no one. The
  user's targets aren't left set to the area after the roll. Danger Close compares the spared targets by actor.
- Tech Specs' reveal line is in the Use card, with localized Defense names; the ↑1 / Edge reach whoever is on the
  officer's side now (`self:sameSideAsHolder`) rather than the disposition stamped at mark time.
- Data Bridge's borrowed Specialization shows as a "Data Bridge" row in the dialog; its once-per-turn limit needs a
  started combat (the old flag any combat); its bank goes with the combat when the combat is deleted.
- Eye For Appraisal's 2d2 is told in the Use card (no separate dice message).
- Powerful Suggestion asks the Skill, then the fate (two dialogs); the ↓3 is a dialog source.
- Rig Upgrade / Rally Guardians Features: the pickGrant "Granted" line instead of the "gained" line.
- Self-Destruct posts a "Defeated" line when it goes off.
- Additional Attack Type configures after the Feature is added (a cancel takes it off again), also when the Feature comes
  by a grant, and the new attack is attached under its weapon like a compendium weapon's.
- Metallic Armor's "Defeated" end listens to Health damage that leaves 0 or less (takesDamage), not to any after-damage
  pass with 0 Health.
- Dominate's Command / Recall buttons can be pressed again (Recall then finds no victim); a cancelled command effect
  stops there (no "follows your command" line, no new card). The victim is found by its mark.
- In The Right Hands' ↑1 is labelled "In The Right Hands (...)" rather than the Cybertronian's name; the wielder is picked
  from the system's ally list (Frenemy and the rest count).
- Pack Attack's grant no longer ends early when the scene changes during the combat.
- Try Me's result is the contest's line; a cancelled roll stops it.

## Shared-file edits

module/dice.mjs, module/dice.test.js, module/documents/combat.mjs, module/documents/actor.mjs, module/essence20.mjs,
module/items/index.mjs, module/items/forms/mega-defender.mjs (comment), module/items/rolls/trade-school.mjs (comments),
module/items/attacks/wrestler-pin.mjs (comment), module/items/shared/mlp-pr-tf-ids-and-skill-total.mjs,
module/items/social/social-rolls.mjs, module/items/social/social-cards.mjs, module/items/tests/hidden-state-mega-defender-zones.test.js,
module/mechanics/actions/action-perks.mjs, module/mechanics/actions/team-actions.mjs, module/mechanics/characters/power-use.mjs
(+ test), module/mechanics/combat/multiple-targets.mjs (+ test), module/mechanics/combat/target-riders.mjs,
module/mechanics/companions/bonded-partners.mjs, module/mechanics/companions/summons.mjs, module/mechanics/companions/companions.test.js,
module/mechanics/resources/banked-buffs.mjs (+ test), module/mechanics/resources/grant-uses.mjs, module/mechanics/resources/grants.mjs
(+ test), module/mechanics/resources/kits.mjs, module/mechanics/vehicles/vehicle-upgrades.mjs (+ test),
module/sheet-handlers/zord-feature-handler.mjs, module/rules/steps.mjs, module/rules/adapter.mjs, module/rules/plugins/index.mjs,
module/rules/plugins/combat/canvas-points.mjs, module/rules/plugins/tags/dice-checks.mjs,
module/rules/plugins/picks/general-perk-step.mjs, module/rules/plugins/rolls/contest.mjs.

Removed files: items/attacks/{eye-for-appraisal, pack-attack, pack-attack-ally-shift, tech-specs, gm-apply-damage-button}.mjs,
items/defenses/{metallic-armor, metallic-armor-minions-and-ending}.mjs, items/healing/misery-loves-company.mjs,
items/magic/dominate-nanomites.mjs, items/social/{data-bridge, powerful-suggestions}.mjs, items/vehicles/ground-suppression.mjs, and
their tests.

## Unused strings

E20.GroundSuppressionPickTitle, E20.GroundSuppressionPickLabel, E20.TechSpecsNoTarget, E20.TechSpecsResult,
E20.DataBridgePickSpecializationTitle, E20.DataBridgePickSpecializationLabel, E20.ThinkTankPickAllyLabel,
E20.DataBridgeNoSpecialization, E20.MiseryLovesCompanyNoEnergon, E20.EyeForAppraisalNoTarget, E20.EyeForAppraisalPickArea,
E20.PowerfulSuggestionsPickOptionsTitle, E20.PowerfulSuggestionsPickSkillLabel, E20.PowerfulSuggestionsPickEffectLabel,
E20.PowerfulSuggestionsExcel, E20.PowerfulSuggestionsFail, E20.PowerfulSuggestionsNoTarget, E20.O3MetallicArmorEnds,
E20.R2DominateHolds, E20.R2DominateCommand, E20.R2DominateRecall, E20.R2DominateMissed, E20.R2DominateInfected,
E20.R2DominateDefensePrompt, E20.R2DominateEffectPrompt, E20.R2DominateStandStill, E20.R2DominateMesmerize,
E20.R2DominateOrder, E20.R2DominateResisted, E20.R2DominateStoodStill, E20.R2DominateMesmerized, E20.R2DominateOrdered,
E20.R2DominateRecalled, E20.O1ApplyDamageButton, E20.O1NotOwner, E20.VehicleUseSelfDestruct, E20.ZordFeatureAttackTypeTitle,
E20.ZordFeatureAttackTypePickStyle, E20.RightHandsKind, E20.RightHandsWielder, E20.RightHandsSet, E20.KitHeal, E20.KitHealed,
E20.ImperfectionSet, E20.TryMeAccept, E20.TryMeResult, E20.GmOnly, E20.OncePerCombat, E20.HitSomeoneYourOwnSize.

New string (r16/lang-b.json): E20.RulesExtLeftB16.ConditionMoved.

The questions.md entry "[uses] A Hint of Independence: ... option labels" is answered by this round: the labels are the
existing `E20.Imperfection.N` keys, now localized by `choose`, so no names sit in the pack.

## Rule count

49 rules on 21 pack items.
