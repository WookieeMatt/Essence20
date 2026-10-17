# slItems214 - round 14, part items2

Scope: the 45 "convert" items of the items2 survey (per-item files under `module/items/`, healing/preventative-measures
onward), plus Snortle at the Spooky (not surveyed - its file holds Play to the Crowd's whole behaviour, so it converts
with it). 44 converted, 1 explained. 65 rules added on 41 pack items. Tests: `module/rules/conv14-items2.test.js`
(61 tests).

## Engine features added 2026-10-06 (round 14, items2)

- **Tag `self:holdsActive:<uuid>`** (`rules/plugins/tags/active-item-and-own-zord.mjs`) - the actor holds a copy of that
  book item which counts for rules (`rules/index.mjs#isItemActive`: a Hang-Up a Matured Perk ignores doesn't). The
  hand-written `actorHasHangUp` reading; `self:hasItem:<uuid>` counts any copy. (Laypony Terms on Reverse Engineer.)
- **Tag `self:ownsZord`** - the actor lists a Zord on its sheet. **Recipient `ownZord`** - the first Zord listed there
  (`combat.mjs#getOwnedZord`'s "your Zord"); `ownZords` still reaches every one. (Zord Alterations.)
- **`bank {grantDouble: true}`** (rules/steps.mjs) - upshifts banked on another actor first offer the granter's
  GrantDouble rules (`plugins/resources/grant-double.mjs#offerGrantDouble`), the same hook the hand-written
  `perks.mjs#bankPendingBonus({granter})` calls; yes doubles the ↑. Opt-in, so earlier bank conversions are unchanged.
- **`roll {open: true, sheetShifts: false}`** - the open roll without the Skill's standing shifts / Specialized flag, for
  a hand-written `rollSkill({skill, shiftUp: 0, shiftDown: 0})` Use (On Target).
- **SkillSubstitution `carryShifts: true`** (`plugins/dialog/dialog-select.mjs`, mode ask) - when the player picks
  another Skill, its own sheet shifts (`system.skills.<skill>.shiftUp / shiftDown`) are added to the roll's - for a roll
  made without them (a Requisition Test re-pointed at Wealth).
- **Validator fix** (rules/steps.mjs#stepErrors): a `setVar` text value (the handler's own test: no leading digit / `@` /
  `(` / `-`, no call) and `shiftSize`'s `min` / `max` (sizes such as `"huge"`) are no longer read as formulas. This also
  clears the two check-rules errors Mind Over Matter's pack rules had.

## Verdict table

| Item | Verdict | Why / how |
|---|---|---|
| Play To The Crowd | converted | through Snortle at the Spooky's Use rule (`self:hasItem` gate on the one-target cut) |
| Snortle At The Spooky (extra) | converted | Use rule replaces the sheet's Activate button |
| Survival Training | converted | `added` Trigger: pick from team, +1 health.bonus |
| Unbeatable | converted | turnStart Trigger |
| Primal Movement | converted | `added` Trigger: choose a type the actor lacks |
| Bravado | converted | combatStart Trigger |
| Energon Parasite | converted | Use rule |
| Avast! | converted | Use rule: rollVsEach Willpower, Initiative reroll steps |
| Consult Memories | converted | Use (pick + mark) + RollModifier |
| Nemesis (Perk) | converted | Use (keeps the decepticonNemesisUuid flag) + RollModifier |
| Nemesis (Hang-Up) | converted | RollModifier |
| On Target | converted | Use: open Targeting roll, per round |
| Hardened | converted | RollModifier (medium armor); Reckless Abandon's own light-armor ↑2 stays code (its Racer Abandon coupling) |
| Resourceful | converted | Use (choose, mark until combat) + Initiative RollModifier |
| Extremely Resourceful | converted | no rule of its own: Resourceful's "both" option, unasked |
| Reverse Engineer | converted | Use, 3 per scene |
| Thesis | converted | Use, max formula reads Technobabble / Multiplication |
| Infiltrator | converted | Use, 1 per scene |
| Chatter Flashback | converted | Use, 3 per scene |
| Muscle Over Panache | converted | Use, 3 per scene |
| Technobabble | converted | no rule of its own: Thesis's limit max |
| Laypony Terms | converted | no rule of its own: Reverse Engineer's choose (self:holdsActive) |
| Acting! | converted | Use costing 1 Cheer Point |
| Tactical Meditation | converted | RollModifier self + ally aura (one stack group) |
| The Returned | converted | Use: pick + bank Edge |
| Show Respect | converted | watch Trigger (enemy crit) + turnStart Trigger + BeforeRoll warn |
| Again and Again and Again | converted | hit Triggers -> button -> attack step; RollModifiers by dataset |
| Money Talks | converted | SkillSubstitution ask (carryShifts) |
| Capable Freelancer | converted | same rule |
| Urban Adaptation | converted | Use (limit per rest by level, Free action) + 2 RollModifiers + MovementAction |
| Environmental Expertise | **not converted** | see below |
| Izuna Drop | converted | Use rule (askNumber, choose skill, roll vs Toughness, GM button) |
| Augment Power | converted | two Use rules (↑1 per turn / ↑2 per encounter) |
| Enemy Number One | converted | enemy-aura RollModifier + targeted Trigger mark |
| Exemplary | converted | afterRoll Trigger records the Skill on the item; ally-aura RollModifier `skill:{choice.lastSkill}` (one rule, not 17) |
| Face Me! | converted | Use (rollVsEach + mark) + marked RollModifier + marked afterRoll Trigger (unmark) |
| Remote Operations | converted | Use (roll DIF 10 -> mark until combat) + Assist anyRank |
| One For All | converted | Use rule |
| Power Burst | converted | Use rule |
| Shining Leader | converted | Use (mark, in combat) + marked RollModifier |
| Rallying Cry | converted | Use (mark, in combat) + marked RollModifier |
| Heart Of The Team | converted | Use rule (Story Point cost) |
| Nano-Med Mastery | converted | Use (heal, mark) + marked RollModifier + self RollModifier |
| Vainglorious | converted | turnStart Trigger |
| Bio-Energy Conversion | converted | Use (two marks) + RollModifier + scaled DamageModifier |
| Zord Alterations | converted | `added` Trigger: choose -> updateActor / shiftSize / pick on `ownZord` |

**Environmental Expertise - not converted.** Its Edge / Specialized / Rough Terrain are answered by
`mechanics/world/environmental-expertise.mjs#hasActiveEnvironmentalExpertise`, which also grants them to Read The Land holders
(without the Perk) and to an In Their Element pet - and dice.mjs's shared block serves Guidance's banked marker too. A rule on
this item can't reach those, so the code would have to be rewritten to leave out exactly "the actor holds Environmental
Expertise itself", keeping a second copy of the logic; and its Roll Options Dialog label (the Perk's name plus the scene's
terrain) has no rule equivalent. It needs Read The Land and In Their Element converted with it (a companion-scoped rule)
before it can move.

## Converted

- **Snortle At The Spooky / Play To The Crowd** - Use: the targets with Frightened or Mesmerized; only the first unless the
  actor holds Play To The Crowd; 1 Cheer Point each (`spend` stops the run when short); Mesmerized is lifted only where
  there's no Frightened, then Frightened. Nothing eligible: the old warning. Its sheet button, template block and
  `snortle-at-the-spooky.mjs` are gone.
- **Survival Training** - `added` Trigger: pick any Player Character (the actor too); +1 `system.health.bonus` on them.
- **Unbeatable** - turnStart: not Defeated, Health above 0 and at most half its max -> +1 Health, capped at the max.
- **Primal Movement** - `added` Trigger: warns when every type has a base speed; else choose among those without one; +20 to
  that type's `bonus`.
- **Bravado** - combatStart: holding Reckless Abandon with 0 uses -> its Role Points item to 1.
- **Energon Parasite** - Use: first target; warn unless Defeated; drain = min(target Energon, lowest Essence, room left);
  nothing when 0.
- **Avast!** - Use, once per encounter: Intimidation vs the first target's Willpower (rollVsEach, the same targeted roll the
  old Use made); on a hit, if they have Initiative, reroll it and put back the old value when the new one is higher.
- **Consult Memories** - Use, once per encounter: pick a Skill, mark for the encounter; RollModifier ↑2 + Specialized on it.
- **Nemesis (Perk / Hang-Up)** - Use declares the first target (the same flag the check: helpers read); ↑1 on non-attack
  tests aimed at them; the Hang-Up's ↓1 while the nemesis has a token in the scene unless aimed at them.
- **On Target** - Use, once per round: Targeting (Speed), no sheet shifts, as the old call.
- **Hardened** - RollModifier ↑2 on Strength tests while acting with Reckless Abandon in Medium armor (none heavier, the same
  Racer Abandon / Rigged Rider exception the RA code has); `getRecklessAbandonStrengthShiftUp` now only covers light / no armor.
- **Resourceful / Extremely Resourceful** - Use, once per encounter: Edge on Initiative (mark until the combat ends) or 1
  Temporary Health; both unasked with Extremely Resourceful.
- **Infiltrator, Chatter Flashback, Muscle Over Panache, Reverse Engineer, Thesis (+ Technobabble), Acting!** - Uses with
  their per-scene counts (Thesis `(1 + 2·Technobabble) × (1 + Multiplication)`), Acting! costing 1 Cheer; Reverse
  Engineer asks (only with an active Laypony Terms) and "yes" banks a Snag on the next Technology test.
- **Tactical Meditation** - ↑2 on Alertness and Initiative for the holder and allies within 10 ft, once.
- **The Returned** - Use, once per scene: pick a Skill, bank an Edge on its next test.
- **Show Respect** - an enemy's attack Critical Success (with a target, in a combat, the holder a combatant) marks them
  "owed"; at the holder's turn start owed -> respect for that turn; attacking a respected foe while another foe is present
  warns.
- **Again and Again and Again** - a hit with a weaponless attack (with Puissance) posts a button for the same attack at the same
  target at ↓1 (dataset o3AgainStep 1), whose hit offers one at ↓3 (step 2); the buttons share a two-per-turn limit.
- **Money Talks / Capable Freelancer** - a Requisition roll (not already Wealth) asks once whether to roll Wealth; picked,
  the Wealth Skill's own shifts come with it.
- **Urban Adaptation** - Use (Free action, limit per rest = the Ranger Adaptation Points for half the level): choose an Urban
  Jungle ability not yet bought this scene; Edge on non-attack tests / Specialized attacks / ignoring Rough Terrain while the
  terrain isn't urban (or none is set).
- **Izuna Drop** - Use (Free action): first target, not yourself; fall height; the better of Acrobatics / Athletics vs
  Toughness; hit: the fall to the target and Prone (a GM button for a target this user can't act for), overflow past its
  Health to the faller; miss: the fall and Prone to the faller.
- **Augment Power** - Use ↑1 (per turn) / ↑2 (per encounter) on a picked ally, doubled and twice each with Multiplication;
  one banked bonus per ally; GrantDouble offered.
- **Enemy Number One** - enemies within 30 ft (in a combat) take a Snag on attacks at a target other than the Tank, unless
  marked as having attacked it this turn.
- **Exemplary** - every roll the holder makes records its Skill on the item; allies rolling that Skill get an Edge.
- **Face Me!** - Use: Intimidation vs Willpower (rollVsEach); on a hit the foe carries the mark until the combat ends; their
  attacks at anyone but the holder get ↓2; any attack with a target ends it.
- **Remote Operations** - Use: DIF 10 Alertness; success marks the holder for the combat; Assist anyRank while marked.
- **One For All / Power Burst** - Use, once per encounter: Morphed allies anywhere gain 1d2 / 1d(advances) Power, no cap; One
  For All costs 3 Power.
- **Shining Leader / Rallying Cry** - Use: allies (Morphed, anywhere / within 60 ft) marked through the next round, in a
  combat; Edge on their attacks. Shining Leader: 1 Power, once per encounter.
- **Heart Of The Team** - Use, once per encounter, 1 Story Point: allies within 30 ft +1 Temporary Health and a Move action.
- **Nano-Med Mastery** - Use, once per encounter: the holder and allies within 60 ft heal 2 and carry an Edge on every test
  (not Initiative) through the next round.
- **Vainglorious** - turnStart: the first turn of each combat spends the Standard action.
- **Bio-Energy Conversion** - Use: two marks (this round / through the next); ↑2 and +2 scaled damage on attacks only in
  the next round.
- **Zord Alterations** - `added` Trigger on the first owned Zord: +2 Strength / +2 Speed / +1 both / size up and +1 Health /
  size down (Huge at least) and +10 ft to aerial, climb, ground, swim / Resistance to a picked Element; no Zord: the old
  warning.

## Code vs notes - needs a ruling

| Item | The code does | Notes / book say | Converted to |
|---|---|---|---|
| Acting! | Use button that only spends 1 Cheer | notes: a Roll Options Dialog spend that rolls Performance | the code (Use, 1 Cheer) |
| Consult Memories | lasts the encounter (hasUsedThisEncounter window) | notes: for the scene | the encounter |
| Remote Operations | lasts the whole combat (out of combat: until a combat changes it) | notes / book: the rest of this turn | the combat (mark until combat) |
| Heart Of The Team | grants each ally a Move action | notes: "Left to the table: letting them move right away" | the code (grantActions) |
| Nano-Med Mastery | no action spent by the Use | notes: spend your Standard action | the code (no cost) |
| One For All | no Morphed gate on the holder; once per encounter | notes: "(while Morphed)", can't be used twice in one scene | the code |
| Shining Leader | no Morphed gate on the holder | notes: while Morphed | the code |
| Rallying Cry | Edge this round and the next; never ends early | notes / book: until the end of your next turn or you're Defeated | the code (endOfNextRound) |
| Bio-Energy Conversion | active for the whole next round | notes: on the Zord's next turn | the code (two marks) |
| Unbeatable / Vainglorious / Survival Training etc. | - | - | (no disagreement) |

## Bugs fixed (user-approved)

- **Nano-Med Mastery** - its heal is the engine `heal` step, which now brings a Defeated creature back when real Health rises
  above 0 (as its notes say); the old code only raised Health.

## Small differences (engine idioms)

- Unbeatable / Vainglorious run from the combat's turn start (documents/combat.mjs#_onStartTurn, the active GM) instead of
  the `combatTurn` / `combatRound` hooks - so Unbeatable now also heals on the very first turn of a combat. Vainglorious no
  longer checks whether the world tracks actions (`spend` simply does nothing then).
- Buttons that used to hide: Energon Parasite (needed a Defeated target with Energon to drain) and Snortle (always shown)
  are Use buttons that refuse with the old warning instead.
- Silent shifts became labelled Roll Options Dialog sources (switch-off-able): Nemesis x2, Tactical Meditation, Consult
  Memories, Hardened, Exemplary, Bio-Energy Conversion, Resourceful, The Returned.
- Banked bonuses (The Returned, Augment Power, Laypony Terms) don't go stale when the combat they were banked in ends.
- Exemplary records the Skill when the roll is made, not before its dialog (a cancelled roll no longer counts).
- Show Respect / Enemy Number One / Exemplary read sides the engine way (token dispositions; a neutral token is no enemy);
  Enemy Number One marks the exemption on any attack at the Tank (old: only within 30 ft).
- Again and Again: a multi-target hit offers a button per hit target (old: the first hit), and a button can be posted after
  the two-a-turn count is spent (pressing it is refused).
- Izuna Drop's fall-height box starts at 0 (old: 30).
- Reverse Engineer: closing the Laypony Terms question cancels the use (old: the use still counted).
- Shining Leader / Rallying Cry / Nano-Med / Bio-Energy used in a combat that exists but hasn't started set nothing.
- Snortle's spend doesn't honour an actor's unlimited Role Points (`useUnlimitedResource`).
- Zord Alterations' size-down leaves a Zord already below Huge alone (old: set it to Huge).

## Shared-file edits

- `module/dice.mjs` - imports (team-buffs flags, nemesis-decepticon, bio-energy, consult-memories, resourceful,
  remote-operations, avast, tactical-meditation, the-returned, exemplary, enemy-number-one, face-me); Initiative's Tactical
  Meditation ↑2 and Resourceful Edge; recordExemplaryRoll; the Enemy Number One mark / check / `enemyNumberOneTankId` (field
  and doc); Nemesis x2; Bio-Energy ↑2 and its damage term (removed from the damageBonusValue sum); Consult Memories;
  Exemplary's Edge; Remote Operations / Avast dataset, checkContext and post-roll; The Returned; Tactical Meditation's
  Alertness ↑2; pendingAugmentPower; pendingLayponyTermsSnag; Shining Leader / Rallying Cry / Nano-Med flags; Face Me!'s
  compeller and post-roll; a few comments naming removed files.
- `module/dice.test.js` - removed those items' tests; `defaultModifiers` loses `enemyNumberOneTankId`; the Reckless
  Abandon + Hardened expectation (now 0 from the code); the two Relic Key tests make their own roll-dialog mock (they had
  been inheriting the one the removed Bio-Energy Conversion test left behind).
- `module/mechanics/resources/banked-buffs.mjs` (+ `.test.js`) - every canUse / onUse branch and import for Energon
  Parasite, Avast!, Consult Memories, Nemesis DD, On Target, Resourceful, the skill substitution Perks, Acting!, The Returned,
  Face Me!, Remote Operations, Augment Power, Bio-Energy Conversion; their tests.
- `module/sheet-handlers/perk-handler.mjs` - Survival Training, Primal Movement, Zord Alterations branches and imports.
- `module/essence20.mjs` - Unbeatable (combatTurn) and Bravado (combatStart) calls and imports.
- `module/documents/combat.mjs` (+ `.test.js`) - Vainglorious.
- `module/mechanics/actions/lend-assistance.mjs` - Remote Operations bypass (now its Assist rule).
- `module/sheets/base-actor-sheet.mjs`, `templates/actor/parts/items/perk/details.hbs` - Snortle's Activate button.
- `module/items/index.mjs` - again-and-again, wealth-tests, urban-adaptation, izuna-drop, show-respect imports.
- `module/items/shared/condition-damage-buttons.mjs` - now registers the `tf1Damage` chat button (Solid-State Energon's,
  registered by show-respect.mjs before); `TF1.showRespect` gone. `resource-team-lookups.mjs` (moneyTalks,
  capableFreelancer), `mlp-pr-tf-ids-and-skill-total.mjs` (againAndAgain, puissance), `terrain-perk-ids-and-readers.mjs`
  (urbanAdaptation, izunaDrop) ids.
- `module/items/rolls/reckless-abandon.mjs` (+ test) - Hardened left the armor gate. `items/rolls/nemesis-decepticon.mjs`
  (+ test) - down to the two check readers. `items/social/team-buffs.mjs` (+ test) - only Elemental Shield left.
- Tests: `items/tests/terrain-environment-perks.test.js`, `show-respect-mimicry-support.test.js`,
  `hidden-state-mega-defender-zones.test.js`, `resources-energon-wealth.test.js`, `rules/conv9-slB9.test.js`.
- Comments: `items/defenses/clever-mind.mjs`, `mechanics/combat/nearby-allies.mjs`, `mechanics/rolls/reroll.mjs`.
- Engine: `rules/steps.mjs` (bank grantDouble, open-roll sheetShifts, the validator fix), `rules/plugins/dialog/dialog-select.mjs`
  (carryShifts), `rules/plugins/index.mjs` (new import at the end).
- Deleted (git rm): healing/snortle-at-the-spooky, healing/survival-training, healing/unbeatable, movement/primal-movement,
  resources/bravado, resources/energon-parasite, resources/wealth-tests, rolls/avast, rolls/consult-memories, rolls/on-target,
  rolls/resourceful, rolls/skill-substitution-perks, rolls/tactical-meditation, rolls/the-returned, rolls/urban-adaptation,
  attacks/show-respect, attacks/again-and-again, attacks/izuna-drop, social/augment-power, social/enemy-number-one,
  social/exemplary, social/face-me, social/remote-operations, social/vainglorious, zords/bio-energy-conversion,
  zords/zord-alteration (each `.mjs` and its `.test.js` where there was one).
- Pack notes reworded (they named the old silent shift): Nemesis x2, Tactical Meditation, Exemplary.

## Unused strings

E20.AugmentPowerBenefitCombat, E20.AugmentPowerBenefitTurn, E20.AugmentPowerPickBenefitLabel,
E20.AugmentPowerPickBenefitTitle, E20.ConsultMemoriesPickSkillLabel, E20.ConsultMemoriesPickSkillTitle,
E20.EnergonParasiteNotification, E20.FaceMeNoTarget, E20.HangUpVainglorious, E20.LayponyTermsPromptLabel,
E20.LayponyTermsPromptTitle, E20.PrimalMovementPickType, E20.PrimalMovementTitle, E20.ResourcefulBenefitEdge,
E20.ResourcefulBenefitTempHealth, E20.ResourcefulPickBenefitLabel, E20.ResourcefulPickBenefitTitle, E20.SnortleActivate,
E20.SnortleCured, E20.SnortleNoTarget, E20.TheReturnedPickSkillLabel, E20.TheReturnedPickSkillTitle,
E20.ZordAlterationEssenceBoth, E20.ZordAlterationEssenceSpeed, E20.ZordAlterationEssenceStrength,
E20.ZordAlterationPickLabel, E20.ZordAlterationPickTitle, E20.ZordAlterationResistance, E20.ZordAlterationSizeDecrease,
E20.ZordAlterationSizeIncrease, E20.O3AgainButton, E20.O3AgainMax, E20.ResWealthRequisitionPrompt,
E20.ResWealthRequisitionWealth, E20.S1GmOnly, E20.S1IzunaApplyButton, E20.S1IzunaGmApply, E20.S1IzunaHit,
E20.S1IzunaMissed, E20.S1IzunaPrompt, E20.S1UrbanAdaptationPrompt, E20.S1UrbanAdaptationUsed, E20.S1UrbanAbilityEdge,
E20.S1UrbanAbilitySpecialized, E20.S1UrbanAbilityRoughTerrain, E20.Tf1RespectWarn, E20.Tf1ShowRespect.
Still used by the rules: E20.SnortleNothingToCure, E20.EnergonParasiteNoTarget, E20.PrimalMovementNoNewType,
E20.ZordAlterationNoZord, E20.S1IzunaNoTarget. New (lang fragment `r14/lang-items2.json`): E20.RulesExtItems2.RespectWarn,
E20.RulesExtItems2.WealthPrompt.

## Found in passing

- `target:markedByMe:<key>` passes the validator but always answers unknown (null) - `markedByMe` is its own tag family
  (`markedByMe:<key>`, the other party carrying this actor's mark). A RollModifier using it turns into an unticked switch.
  Show Respect uses the bare form; `gijcrbitems/_source/Inundation_Q09tkHIaVX65lokl.json` (not this part) has the
  `target:` form.

## Rule count

65 rules on 41 pack items.
