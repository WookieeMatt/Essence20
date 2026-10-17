# Round 15, part Other (rest-other)

Scope: the 72 "piece" entries of the rest-other survey (`survey/result-rest-other.json`). Round 14 left no rest-other
"convert" entry unconverted. 24 engine pieces built (plug-ins under `module/rules/plugins/`, block "Round 15 (rest-other)"
at the end of `plugins/index.mjs`), 57 survey items converted, 3 partial, 13 still code (+ Guidance, converted by the
items2 part this round). Tests: `module/rules/engine15-other.test.js` (pieces) and `module/rules/conv15-other.test.js`
(the pack items); several old suites were moved onto the pack rules instead of being deleted (listed below).

## Engine features added 2026-10-07 (round 15, rest-other)

### Action economy
- **ActionCost kinds `reload` and `morph`** (`plugins/resources/action-kinds.mjs`, new `rules/actions.mjs#registerActionKind(name)`
  - adds a cost kind to `KINDS` and the ActionCost `action` options). documents/item.mjs passes `{kind: 'reload', item: <the
  weapon>}` to the reload spend and morph-state.mjs#payForMorph `{kind: 'morph'}`, so `item:` tags read the weapon
  (`item:isHost` - an upgrade's own weapon; the limit counts per rule item, so per weapon). Rapid Reload `{action: reload,
  to: free}`, Ammo Belt `{..., when: [item:isHost], limit: {per: scene}, stacks: true}`, Rev Morpher `{action: morph, to: move}`.
- **`ActionCount {action: free, essence? | add?}`** (`plugins/resources/action-count.mjs`) - action-counts.mjs#getNumActions:
  Free actions from another Essence (an `essence` rule wins - the old else-if) or Speed + the summed `add`s.

### Reloads, Sneak Attack, drawbacks, untrained Snag
- **`ReloadSkip {limit, combatOnly?, message?}`** (`plugins/combat/reload-skip.mjs`) - reload-trait.mjs#requireReload skips a
  required reload while the limit lasts; `when` sees the weapon as `item:`; `priority` orders several; `message` (E20. key,
  {name} {weapon}) is an info toast.
- **`SneakAttackGrant {items?, qualifies?, range?, anyCircumstance?, cost?, limit?}`** (`plugins/combat/sneak-attack-grant.mjs`) -
  sneak-attack.mjs: `qualifies` (default true) a non-Silent weapon qualifies (`items` narrows, `weapon:` reads its weapon);
  `range` ft | `weapon` | `unlimited` (the widest wins); `anyCircumstance` + `cost {storyPoints}` + `limit` - offered whatever
  the circumstances, paid (sneak-attack.mjs#paySneakAttackGrant, from dice.mjs) only when the ordinary checks would have
  failed. In My Sights would be `{items: [weapon:trait:sniper], range: weapon}`, Ballistic Advantage `range: unlimited`.
- **IgnoreDrawback `temperamentalFumble`** (+ `limit`, `message`; `plugins/rolls/ignore-drawback.mjs#useIgnoredDrawback`) - a
  Temperamental weapon's Fumble is only a failure; dice.mjs posts the rule's `message`.
- **`UntrainedSnagImmunity {limit, freeOutOfCombat?}`** (`plugins/rolls/untrained-snag-immunity.mjs`) - a LIMITED lift of the
  untrained Snag, asked last in roll-dialog.mjs#_isUntrainedSnag (after every unlimited lift), so its use is spent only when
  it is what lifted the Snag. `freeOutOfCombat`: no combat - always, uncounted. (An unlimited lift stays RollModifier
  `immune: [untrainedSnag]`.)

### The Defeat-save chain and Essence to 0
- **wouldBeDefeated `stage`** (`plugins/combat/defeat-stage.mjs` + `triggers.mjs#wouldBeDefeated {stage}`): `first` (default),
  `beforeAegis` (where Immortal Rebel Soul, Life Supporting, Not Done Yet sat), `last` (after Aegis - We Are The Coinless).
  combat.mjs#applyDamage calls the chain at each place. Each Trigger now runs only while the hit still would Defeat
  (`fireTriggers {only}` - a new caller filter).
- **Scope `renegadeVehicle`** (every rule type taking `vehicle`) - on a Renegade Perk: reaches the vehicle its holder drives while
  Racer Abandon moves the Perk onto it (summons.mjs#renegadeHolderFor, handed in with `registerRenegadeLookup`). Tag
  **`self:ownRenegade`** - the actor's own Renegade Perks protect it (not while Racer Abandon moved them, unless Rigged Rider).
- **Event `essenceWouldEmpty`** (`@var.essence`) - environment-hazards.mjs#applyEssenceDamage is about to take an Essence to 0;
  `negateDamage` keeps the point (Immortal Rebel Soul shares its Health half's limit through `limit.key`).

### The chat card's Apply Damage
- **applyingDamage `stage`** (`plugins/combat/applying-damage-stages.mjs#applyingDamageStage`; items1's unstaged applyingDamage
  pass skips staged Triggers): `attacker` - on the attacker's items before anything else, the one hit as `target:`, the card's
  facts as `roll:dataset:<key>`, `@var.handled` 1 = the hit is dealt with, no damage (Sudden Death); `reductions` - right
  after the unstaged pass (Fortitude, Extra Plates, Didn't Even Feel It); `lateReductions` - after Hard Corps (Invincibility
  Through Invisibility, Just a Graze). `priority` orders a stage; each runs while damage is left; `@var.damage` /
  `@var.dropSecondary` as items1's; `prompt` + `promptText` ({name} = the one hit, {amount}); linked scopes reach (limit
  on the holder - `renegadeVehicle`).

### Casting, assisting, items and actors
- **`SpellCostDefer {}`** (`plugins/resources/spell-cost-defer.mjs`) - the spell's Casting Cost lands after its Skill Test.
- **`PreCast {steps}`** on a spell (`plugins/picks/pre-cast.mjs#runPreCast`, item.mjs's cast before the roll): a stopped run cancels
  the cast (no roll, no cost). Step **`grantSpecialization {skill, name, to, until: scene}`** - a scene-long Specialization
  (listed in flags.essence20.bestowedExpertise, swept by bestow-expertise-scene-expiry.mjs).
- **Assist effects `persist` and `rollFor`** (+ `limit`; `plugins/rolls/assist-extras.mjs`) - lend-assistance.mjs: a lent Skill
  assist lasts (persistent bank) while the limit lasts; a helper may roll the holder's test for them (`rollFor`, side
  receive; its limit counted on the helper per holder).
- **`AvailabilityShift {steps, items?}`** (`plugins/resources/availability-shift.mjs`) - owned items' totalAvailability, read off
  the items themselves in item prepare (a new rule counts at once).
- **`SenseMultiplier {multiply}`** (`plugins/effects/sense-multiplier.mjs`) - another darkvision source's best range multiplied;
  the rule item's own visionGrant isn't that other source.
- **`AreaRadius {add, items?}`** (`plugins/combat/area-radius.mjs`) - feet on the PLACED area radius (aoe-targeting.mjs), before
  multipliers; the stored system.radius is untouched.
- **`AllyFilter {anyDisposition: true}`** (`plugins/combat/ally-filter.mjs`) - nearby-allies.mjs#getNearbyAllyTokens counts every
  token as the holder's ally.
- **`AttackTraits {traits: [armorPiercing | antiTank]}`** (`plugins/combat/attack-traits.mjs`) - attacks matching `when` (weaponless
  ones too) count as having those traits where dice.mjs reads them.
- **`RequisitionShift {upshift, items?}`** (`plugins/resources/requisition-shift.mjs`) - the Requisition Test's own starting ↑.
- **`GroupTestBonus {upshift?, edge?, who: self | led}`** (`plugins/rolls/group-test-bonus.mjs`) - group-tests.mjs#groupBonuses.
- **`JoinDie {steps}`** (`plugins/zords/join-die.mjs`; `stacks: true` per copy) - the Combiner join die steps down (d6, d4, d2, 1).
- **`VehicleDefeat {brawnDif}`** (`plugins/zords/vehicle-defeat-dif.mjs`) - the explosion Brawn DIF (the lowest).
- **`SummonTimeBonus {amount, sceneAllies?}`** (`plugins/zords/summon-time-bonus.mjs`) - rounds off the rolled Zord arrival time
  before SummonTime; `sceneAllies` - held by any same-Disposition token on the scene; the biggest only.
- **Tags `self:inRoughTerrain` / `target:inRoughTerrain`** (`plugins/tags/rough-terrain-tag.mjs`; the lookup loads at `setup`).
- **Event `posted`** (an item posted to chat from its sheet - item.mjs's gear branch, the item's own rules) and step
  **`placeRoughTerrain {prompt?, chat?}`** (`plugins/effects/rough-terrain-space.mjs`; rough-terrain.mjs#placeRoughTerrainSpace).
- **Bonded partners** (`plugins/picks/bond-link.mjs`): scopes **`bondPartner`** (the bond holder's rule reaches the partner) and
  **`bondHolder`** (the partner's rule reaches the holder); tags `self:bondLinked`, `self:bondHolder`,
  `roll:bondAllySpecialized`, `roll:bondPairTrained`.
- **Drop-time configurator** (`plugins/zords/drop-configure.mjs`): Trigger **`removeOnStop: true`** on an `added` Trigger - a
  stopped run deletes the item again (triggers.mjs#fireItemAdded); step **`adjustItem {item, onParent?, add?, multiply?,
  atLeast?, set?, defaults?, addTraits?, required?, message?}`** - change the found items (`choice:<key>`) from their own
  values (`{var.adjustedName}` / `{var.adjustedItemName}` after); step **`notify {text, data?, level?, stop?}`** - a toast
  (E20. key formatted with filled data); tag **`self:hasItemWhere:<item tags joined by &>`**.

## Verdicts

| Item(s) | Verdict | How |
|---|---|---|
| Rapid Reload x2, Ammo Belt (2 printings), Rev Morpher | converted | ActionCost reload / morph |
| Deep Magazines, Extended Mag | converted | ReloadSkip |
| Quick Thinker, University Days, Foot Soldier | converted | ActionCount |
| Everything's A Weapon, Never Heard It Coming, Focused Charge, Sudden Strike | converted | SneakAttackGrant |
| Field Test Expert | converted | IgnoreDrawback temperamentalFumble |
| Snipe From The Hip | converted | items1's TraitIgnore {items: [item:name~long range rifle]} |
| Green x2 | converted | UntrainedSnagImmunity |
| Immortal Rebel Soul, Not Done Yet, We Are The Coinless | converted | wouldBeDefeated stages, renegadeVehicle, essenceWouldEmpty, aura |
| Life Supporting | partial | Defeat save is a Trigger; the DIF 20 recharge Use stays code (its own chat lines) |
| Power Conservationist, Power Mastery | converted | SpellCostDefer |
| Enchant, Get To Know, Bestow Expertise | converted | PreCast + afterRoll Triggers (bank / grantSpecialization) |
| Conniving | converted | Assist rollFor |
| Those Who Know, Teach | partial | Assist persist; its id stays in LEND_ASSISTANCE_PERK_IDS (the button) |
| Fieldtest | converted | AvailabilityShift |
| Used to the Dark | converted | SenseMultiplier |
| Bigger Booms | converted | AreaRadius |
| Hardened Armor | converted | takesDamage Trigger + items1's grantResistance (not:damage:resisted) |
| Frenemy | converted | AllyFilter |
| Ram Cone | converted | AttackTraits + RollModifier |
| Expert Guidance | converted | RequisitionShift |
| Bowling Team | converted | GroupTestBonus led |
| Fast Modulation | converted | JoinDie |
| Heavy Water Coolant | converted | VehicleDefeat |
| Enhanced Summoner | converted | SummonTimeBonus |
| Take Point | converted | MovementAction + Cover grant (self:inRoughTerrain) |
| Piledriver | converted | posted Trigger + placeRoughTerrain |
| Advanced Link, Perfect Link, Armored Connection, Bonded Proficiency | converted | bondPartner / bondHolder |
| Synaptic Linkage | partial | Edge is a DialogSwitch (limit scene); the pass-a-Condition Use stays code |
| Blast Attack, Multi-Limb Attack, Enhance (Attack), Increase (Essence), Movement Booster | converted | added Trigger removeOnStop + adjustItem / setEffects / addEffect / notify |
| Light Chassis | converted | the same, + megaform RollModifier for the Initiative ↑1 |
| Sudden Death, Fortitude, Extra Plates, Didn't Even Feel It, Invincibility Through Invisibility, Just a Graze | converted | applyingDamage stages |
| Hard Corps | still code | its debt is stamped with the combat id and settled on deleteCombat (hard-corps.mjs) - no rule writes that stamp |
| Exploit Weakness | still code | card button + Alertness roll + per-scene marker-side armor-ignore (the bug-fixed reader in dice.mjs) |
| Armored Defense, Hardened Chassis | still code | add to the Megaform's Toughness ARMOR part (armor-ignoring attacks); a Defense rule adds to the total |
| Keep IT Together!, Better As One | still code | Combiner isDefeated override; Specialization merge + Energon donor - Megaform internals |
| Team Player, Let's Bring 'Em Together!, In The Right Hands | still code | bespoke lending / join-roster / wielder subsystems (team-actions.mjs) |
| Try Me | still code | GM-accept card that moves a token and rolls a contest with ties to the challenger |
| Rally Guardians Features | still code | grant onto the Guardian-company companion (a flagged companion, no recipient) + name/prerequisite regex + level counter |
| Additional Attack Type | still code | the weapon / attack it builds must stay when the Feature goes (createItem sets grantedBy) and keep localized names |
| Hit Someone Your Own Size! | still code | an incoming ↓2 reaching from the holder onto the partner's attackers + the 5 ft Toughness swap |
| Guidance | - | converted by the items2 part this round |
| Headmaster Body/Head, Powermaster, Targetmaster | permanent | (survey) bond-making Uses |

## Smaller differences the engine brings (no ruling needed unless you disagree)

- Reload / morph spends now carry a cost context, so asked "any action" discounts (the MLP Talents, Talented, Harmony
  Unleashed) can be offered on a reload or a Morph. Ammo Belt and Rapid Reload only apply when the action economy prices the
  spend (tracking on, in combat) - the old belt was also used up out of combat, where the reload cost nothing. A Bullpup (still
  code) no longer shares the belt's once-a-scene use. Rev Morpher and Ram Cone are gear: unequipped, they do nothing. The log
  reads "Morph (Rev Morpher)".
- Limits moved onto the rules' own counters (`flags.essence20.ruleUses.*`): Sudden Strike, Field Test Expert, Green, Immortal
  Rebel Soul, Not Done Yet, Didn't Even Feel It, Those Who Know Teach, Just a Graze, Extra Plates, Invincibility, Sudden Death,
  Synaptic Linkage (old flags not migrated - v6 is unreleased). Conniving's flag is `assistRollFor.<id>`. A round / turn limit
  needs a started combat (the old round/turn stamps also counted in an unstarted one).
- Immortal Rebel Soul no longer brings an already-Defeated actor hit again back to 1 Health (the engine's wouldBeDefeated needs
  Health above 0).
- We Are The Coinless asks each eligible teammate in turn (confirm) instead of one picker, says it in chat, and counts allies
  the system's way (Frenemy / Betrayal / Ally Awareness) - see questions.md.
- Focused Charge's `weapon:trait:electromagnetic` sees upgrade-added traits and finds the weapon through the effect's owner.
- Enchant / Get To Know bank through the rules bank (labelled by the spell, one per caster spell - `replace`), offer the
  caster's own sheet Skills, and fire on the cast's summary success. Bestow Expertise asks Skill, then name (two dialogs).
- Bowling Team / Synaptic / Armored Connection / Advanced Link list their item label instead of "Companion Bonds"; Synaptic's
  Edge and a Snag now cancel at roll time (old: edge = !snag - the same result).
- Take Point reads the holder's first active token (the old check read the targeted token).
- Light Chassis' Megazord Initiative ↑1 is a switch-off-able source now (was silent). Configuring Zord Features make their
  choice just after the Feature lands (a cancel deletes it), with the engine's plain-English pick prompts; Movement Booster's
  new-type 45 ft is a fresh effect (the shipped +30 one stays disabled); the chat card lists the picks.
- Extra Plates no longer spends its once-a-turn on a hit Fortitude already took to 0. Card prompts are the engine's confirm
  (titled with the item name).

## Bugs found and fixed

- **Defeat saves spending each other** (rules/triggers.mjs#wouldBeDefeated): every wouldBeDefeated Trigger ran on one hit even
  after an earlier one had already saved it, so a second save (Avoid The Inevitable + Rise Again, or any two) spent its
  once-per-X limit for nothing. Each now runs only while the hit still would Defeat. Test: engine15-other / conv15-other
  "Immortal Rebel Soul goes before Life Supporting (one save, not both)".

## Code vs notes - needs a ruling

- **Heavy Water Coolant**: the notes add "counts as Specialized if the vehicle has Brawn ranks"; the code (and its rule) only
  lowers the DIF to 10 (questions.md).
- **Immortal Rebel Soul**: notes say "the first time in a scene"; code and rule count per encounter (unchanged).

## Shared-file edits (all surgical)

- Engine: `rules/actions.mjs` (registerActionKind), `rules/triggers.mjs` (fireTriggers `only`; wouldBeDefeated `stage` +
  still-would-Defeat check; fireItemAdded `removeOnStop`), `rules/plugins/index.mjs` (my block), `rules/plugins/rolls/ignore-drawback.mjs`
  (temperamentalFumble, limit, message, useIgnoredDrawback), `rules/plugins/combat/applying-damage.mjs` (items1's: one line - staged
  Triggers skipped).
- `module/dice.mjs` - Sudden Strike spend -> paySneakAttackGrant; Field Test Expert -> useIgnoredDrawback; TRAIT_PERK import,
  Ram Cone source + trait reads -> ruleAttackHasTrait; Take Point Cover; Enchant / Get To Know / Bestow Expertise dataset
  flags, pending readers and post-cast blocks; Bonded Proficiency (socialSpecializes) and Synaptic (socialDialogFlags /
  applySocialDialog); Light Chassis initiative shift. `module/dice.test.js` - the matching tests removed.
- `module/chat.mjs` - Sudden Death / Fortitude / Extra Plates / Didn't Even Feel It / Invincibility / Just a Graze blocks and
  constants -> three applyingDamageStage calls; imports. `module/chat.test.js` - reads the pack rules (packRules), confirm
  answered from the mocked wait, rule-limit flag keys.
- `documents/item.mjs` (+test) - reload cost context, SpellCostDefer, PreCast, AvailabilityShift, `posted` event; constants.
- `documents/actor.mjs` (+test) - bondBonuses, Light Chassis flag; `data/actor/megaform.mjs` - hasLightChassisInitiativeUpshift.
- `apps/roll-options-dialog.mjs`, `templates/dialog/roll-dialog.hbs`, `mechanics/rolls/roll-dialog.mjs` (+test) - Synaptic switch,
  Green.
- mechanics: `combat/reload-trait.mjs` (+test), `combat/weapon-traits.mjs`, `combat/sneak-attack.mjs` (+test), `combat/combat.mjs`
  (+test), `combat/aoe-targeting.mjs` (+test), `combat/nearby-allies.mjs` (+test), `characters/morph-state.mjs` (+test),
  `characters/vision-grant.mjs` (+test), `actions/action-counts.mjs` (+test), `actions/lend-assistance.mjs` (+test),
  `rolls/group-tests.mjs`, `resources/requisition.mjs` (+test), `world/environment-hazards.mjs`, `world/rough-terrain.mjs` (+test),
  `vehicles/combiner-timer.mjs` (+test), `vehicles/vehicle-defeat.mjs` (+test), `vehicles/zord-summon.mjs` (+test),
  `vehicles/vehicle-upgrades.test.js`, `companions/summons.mjs` (registerRenegadeLookup), `companions/bonded-partners.mjs`,
  `companions/companions.test.js`.
- `items/attacks/mounted-weapons.mjs`, `items/attacks/bring-it-all-down.mjs` (comment), `items/social/social-rolls.mjs`,
  `items/index.mjs` (get-to-know-scene-expiry import); `sheet-handlers/zord-feature-handler.mjs` (+test, rewritten around
  the two still-code Features); `rules/conv14-other.test.js` (Read the Land's helper counts Use rules only - another part
  added an EnvironmentalExpertise rule to that item).
- Deleted (git rm): `items/magic/enchant.mjs`, `get-to-know.mjs`, `get-to-know-scene-expiry.mjs`, `bestow-expertise.mjs` and
  their tests.

## Unused strings

E20.WeAreTheCoinlessRescue, E20.EnchantPickSkillTitle, E20.EnchantPickSkillLabel, E20.GetToKnowPickSkillTitle,
E20.GetToKnowPickSkillLabel, E20.BestowExpertisePickTitle, E20.BestowExpertiseSkillLabel, E20.BestowExpertiseNameLabel,
E20.BowlingTeam, E20.GearRamCone, E20.RollDialogSynapticEdge, E20.SuddenDeathConfirmTitle, E20.SuddenDeathApplied,
E20.JustAGrazeConfirmTitle, E20.DidntEvenFeelItConfirmTitle, E20.ZordFeatureEnhanceTitle, E20.ZordFeatureEnhancePickAttack,
E20.ZordFeatureEnhancePickOption, E20.ZordFeatureBlastTitle, E20.ZordFeatureBlastPickAttack, E20.ZordFeatureLightChassisTitle,
E20.ZordFeatureMovementBoosterTitle, E20.ZordFeatureMovementPickType, E20.ZordFeatureIncreaseEssenceTitle,
E20.ZordFeatureIncreaseEssencePickEssence, E20.MultiLimbAttackTitle.
(No new strings: `E20.RulesExtOther` is empty. The pack rules reuse E20.FieldTestExpertSaved, E20.DeepMagazinesSkippedReload,
E20.ExtendedMagSkippedReload, E20.RoughTerrainPiledriver*, E20.ZordFeature*Applied / No*, E20.*ConfirmContent and others.)

## Rule count

72 rules on 59 pack files. `scripts/check-rules.mjs`: 0 errors. Full suite at the end: 74 failures in 9 suites, all in other
parts' in-progress work (`SCRAMBLE_ID is not defined`, a missing `items/defenses/stand-by-me.mjs`, Environmental Expertise /
Elemental Adaptation conversions); lint errors left in `dice.mjs` (RIDER, hasUpgrade, UPGRADE, findHangUp), `dice.test.js`
(legacyPoolParty) and `chat.test.js` (INTERPOSE_ID, BODY_SHIELD_ID, FE_BURN_ID, TERROR_ID) are other parts' too.
