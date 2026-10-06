# Batch slB10: round 10, group B - hit card, damage, defeat, vetoes

**Scope:** the group B list of `r10/groups.md` (pieces 1-8: hit-card riders and damage-type overrides, armor shred and
ignore-armor, a watcher's hit note, the roll dataset in hit / miss Triggers, vetoes, push and act-while-Defeated, attacks
against everyone / flat-dice tests, and the damage odds and ends) and every item those pieces unblock, drawn from slA9,
slB9, slC9, slD9 and slE9. Built as plug-ins in `module/rules/ext/b.mjs` + `module/rules/ext/b/` (hit-rider, veto, armor,
steps, readers, attack, common), edited in place in the shared checkout (no branch, no commit).

**Result:** 8 pieces built (as 6 plug-in files), **42 items converted** (37 fully, 5 partly), **3 still code** (counting the
three Armor Matrix sizes, the two plates and the five Psycho Paths separately).
**62 rules added on 43 pack items.** `scripts/check-rules.mjs`: 2328 rules on 1358 items, 0 errors, 0 warnings (the other
groups' work included).

## Engine features added 2026-10-06 (round 10, group B)

- **`HitRider` rule type** (`ext/b/hit-rider.mjs`) - what a landed hit does on the check card. Read on each hit of a weapon
  attack that has damage (target-riders.mjs#attackRiders through `registerHitRider`), or with **`on: "cast"`** on each
  successful row with damage of a spell / power cast (`registerPostRoll`). Params:
  - `note: <formula>` - an unscaled "+N damage" note on the hit (like an unscaled dealt DamageModifier, but able to read the
    roll's switches); `negate: true` takes all the hit's damage off.
  - `damageType: <type | {choice.key}>` / `damageTypeFrom: <path on the holder>` - the hit deals that type instead ("Apply as
    X"); `retypeFrom: <type>` only when it deals that type now; `retypeCrit: true` retypes the Critical "double" option too.
  - `option: {damage, damageType, label?, key?, ignoreImmunity?}` - an extra Apply button (a rider option). Formulas read
    `@var.damage` (the hit's damage) and `@var.base` (the rolled attack's own damage value).
  - `siblings: {label?, fallback?}` - every other attack of the rolled weapon as an option (its damage and type; `{effect}` in
    the label is its name); with none, the `fallback` option.
  - `watch: "ally"` - the rule acts on hits by OTHER actors on the holder's side (token disposition, else prototype), the holder
    anywhere in the world (game.actors); one book item counts once however many hold it.
  - `marked: <key>` - the rule acts on hits by whoever carries that mark set by the holder (the "mark carries a rule" shape for
    hits: Softenblows).
  - `when` sees the hit: `item:` (the rolled attack), `weapon:`, `skill:`, `attack:melee`, `roll:switch:<key>`,
    `roll:dataset:<key>`, `item:damageType:<type>` (the attack's own type, else the hit's); `self:` is the one who hit,
    `holder:` the rule's holder, `target:` the one hit. Scope `self` or `host` (an upgrade: only its weapon's attacks).
- **The roll's dataset reaches hit / miss / afterRoll Triggers** - target-riders.mjs#buildRiderContext keeps the dataset's
  plain values (`rider.dataset`) and rules/triggers.mjs passes it on, so `roll:dataset:<key>` works there (Takedown Expert's
  `roll:dataset:isTakedown`). hit / miss Triggers also get **`@var.rolledItem`** (the rolled attack's uuid).
- **`defeated` Triggers get the damage's source as their target** (applyDamage's `source`, the card's speaker) - "the creature
  that Defeated you".
- **`Veto` rule type** (`ext/b/veto.mjs`) - refuses a change to its actor: `on: "create"` / `"equip"` with `items: [item tags]`
  (asked of the new / equipped item), or `on: "update"` with `path`, `change: up | down | any` and `clamp: true` (put the old
  value back and let the rest of the update through; else the whole update is refused). `message` ({name} = the actor) is a
  warning toast. **`marked: <key>`** - the veto lands on whoever carries that mark set by the holder ("while cuffed...", "can't
  regain Health until treated"); it lasts while the mark does and the setter still holds the rule.
- **`ArmorPair` rule type** {items, other} - two sets of armor matching these tags may be worn together without the "two
  armors" warning (other2/gij.mjs asks `ruleAllowsArmorPair`).
- **Defense `mode: "ignoreArmor"`** (outgoing only) with **`armor: "defense" | "worn"`** (`ext/b/armor.mjs`) - the attack
  ignores armor: the attacked Defense's armor value (its Morphed value while Morphed; nothing on an Armor Stripped target), or
  for `worn` Toughness' armor value plus every equipped armor's Toughness bonus. Added beside the other per-attack Defense
  changes (registerDefenseAdjust), the same plain subtraction the hand-written code made.
- **Armor shred** - step **`shredArmor {amount, to, until?}`** leaves a counted `armorShred` mark (default until the scene ends;
  repeated, it adds up); while it lasts the carrier's Toughness loses that much, never more than its armor share (Morphed
  Toughness while Morphed, else Toughness' armor value plus equipped armor) - derived data, noted on the Toughness breakdown.
- **Steps** (`ext/b/steps.mjs`, `ext/b/attack.mjs`):
  - `push {feet, to?, from?}` - the recipients (default the actor) pushed `feet` away from the run's first target (`from: self`:
    away from the actor) - forced-movement.mjs#pushActor; `@var.pushed` counts who moved.
  - `actAs {to, steps}` - run steps as each recipient (their rolls; `to: self` is them). Chat and vars shared.
  - `healAction {amount, to}` - Health restored the way the Heal action restores it (other2/medic.mjs#restoreHealth: the
    healer's I've Got You applies, a Defeated creature gets back up).
  - `actWhileDefeated {}` - the actor may act this turn as though not Defeated (the action economy's stamp, no Story Point).
  - `collect {to, filter?, without: "targets"?, required?}` - the run's targets become the recipients, without touching the
    user's own targets; `without: targets` leaves out who was targeted; `required` stops when none.
  - `rollFormulaVsEach {formula, defense, to?, onHit?, onMiss?}` - a flat-dice roll (any Foundry formula, `2d20kh + 1d8`)
    against each recipient's Defense (a list: the best of them), one roll per recipient; `@var.hits`.
  - `rollFlat {skill, dif, onSuccess?, onFail?}` - a Skill Test against a flat DIF formula (`@target.<path>` reads the run's
    first target) with the user's targets cleared first (react/core.mjs#rollVs); a cancelled roll stops the run.
  - `attack {item, to?, dataset?}` - roll an attack the ordinary way (its dialog, card, damage) at the recipients (default the
    first target), who become the user's targets. `item: "rolled"` is `@var.rolledItem`; else an item selector. `dataset`:
    flags the roll carries (`roll:dataset:<key>` in its own Triggers - a follow-up that mustn't offer itself again).
  - `attackEach {item, filter?, action?, pay?, dataset?, message?}` - one roll of the attack against every creature within its
    range (its Range, else 5 ft per Reach multiplier) meeting `filter` (asked as the target); none - stop with `message`. Then
    `action` (free, move, standard, fullAction, standardAndMove, wholeTurn) is spent and the `pay` steps run, before the roll;
    `@var.attacked`.
- **Recipient `markedByMe:<key>`** - every actor (world, and unlinked tokens on the canvas) carrying that mark set by the run's
  actor (perSetter marks too).
- **Tags:** `self:limitUsed:<key>[:<per>]` (a limit counted under that key - a button's `limit.key` - was used in its window,
  turn by default); `damage:attack` / `damage:melee` (the damage a takesDamage Trigger answers came off an attack - a melee one -
  card the GM applied to this actor, react/core.mjs#lastApplyContext); `self:canSpendStoryPoints` (the Story Point gate).
- **Event `patchedUp`** - a successful Patch Up / Repair test (patch-up.mjs): `@var.amount` (the Health it restores),
  `skill:` the Skill, the patched creature as target.
- **Rule types read by hand-written code** (`ext/b/readers.mjs`): `MissImmunity {}` (a miss against the holder has no effect -
  `when` sees `defense:`; gij3/dice-hooks.mjs#ignoresMissEffects), `SneakAttackImmunity {}` (sneak-attack.mjs),
  `CrashProtection {}` (the vehicle the holder pilots protects its crew while Defeated - gij2/vehicles.mjs),
  `HideBonus {amount}` (a roll declared as the Hide action adds `amount` - other3/hide.mjs).

## Verdicts

| Item | Verdict | Where it was |
|---|---|---|
| Takedown Expert | converted (now fully rules) | dice.mjs + gij3/dice-hooks.mjs |
| Seconds Between Click & Boom | converted (now fully rules) | gij3/dice-hooks.mjs |
| Every Trick in the Book | converted (now fully rules) | sneak-attack.mjs |
| Roll Cage (Perk) | converted | gij2/vehicles.mjs |
| Flames of Hate (its two attacks) | converted | pr2/finster.mjs |
| Comms Assault | converted (now fully rules) | tf1/combat.mjs |
| Anti-Armor (Attack) | converted | zord1/zord-slots.mjs |
| Pit Plate (Sharp half), Junkplate (Sharp half) | converted (both now fully rules) | other2/decepticon.mjs |
| Rust Derivatives | converted | other2/decepticon.mjs |
| Stasis Cuffs | converted | other2/decepticon.mjs |
| Gluten-Tolerant | converted | other3/wtnv.mjs |
| Armor Matrix (Light / Medium / Heavy) | **partial** | other1/more.mjs |
| Bio-Tech Armor | converted | other2/gij.mjs |
| S.W.A.T. Upgrade (Incapacitation Ammo) | converted (now fully rules) | pr1/ats.mjs |
| Solar Power [Form] (hit half) | **partial** | zord1/forms.mjs |
| Supersonic [Form] (damage half) | converted (its half) | zord1/forms.mjs |
| Shield Fighter | converted | other1/cobra-gear.mjs |
| Onslaught | converted | other1/cobra-gear.mjs |
| Time Strike | converted | other1/jtt.mjs |
| Solarix Shard (Fire half) | converted (now fully rules) | other3/pr.mjs |
| Power Construct | converted | pr3/ttsg.mjs |
| Staggering Sway | converted | wtnv/wtnv.mjs |
| More Bang for your Buck | **partial** | other2/magic.mjs |
| Softenblows | converted | mlp1/mlp1.mjs |
| Last Stand | converted | tf3/reactions.mjs |
| Roll With It | converted | tf3/reactions.mjs |
| Intensive | converted | tf3/reactions.mjs |
| Stim Dart | converted | other2/medic.mjs |
| Focused Blast | converted | tf1/combat.mjs |
| Tox-En | converted | tf1/support.mjs |
| Target-Rich Environment | converted | tf1/combat.mjs |
| Sustained Beam | converted | tf2/rolls.mjs + tf2/modes.mjs |
| Now You Don't (+5) | converted (now fully rules) | other3/hide.mjs |
| Monster Morph riders (Paths of Cruelty, Frost, Flame, Thorns, Venom) | converted | react/forms.mjs |
| Fearsome Presence | converted | banked-buffs.mjs, fearsome-presence.mjs, dice.mjs, gij2/perks.mjs |
| Warhead Magazines | still code | pr1/jtt.mjs |
| Pop Out | still code | other3/hide.mjs |
| Telltale Sign | still code | other3/hide.mjs |

Fully converted: 37 (the five Paths count five). Partial: 5 - Armor Matrix x3 (the best-only Toughness), Solar Power (the
element pick is group A's Form lifecycle) and More Bang for your Buck (Temper Tempest's storm). Still code: 3.

## Converted

- **Takedown Expert** (`gijcrbitems`) - a `miss` Trigger, `when: [roll:dataset:isTakedown, not:target:levelDiff>0]`: a
  `choose` of Disarmed (`disarm {to: target, maxHands: 2}`), Immobilized or Silenced (`applyCondition`), each with its chat
  line. dice.mjs still Grapples on that miss (the Trigger runs after, in the post-roll hooks); its direct call is gone.
- **Seconds Between Click & Boom** - `MissImmunity {when: [defense:evasion]}`; `ignoresMissEffects` asks the rules (dice.mjs's
  Trigger Happy / Explosive Aftershock and rough-terrain.mjs keep calling it).
- **Every Trick in the Book** - `SneakAttackImmunity`; the three sneak-attack.mjs checks ask `ruleSneakAttackImmune`.
- **Roll Cage** (Perk) - `CrashProtection`; vehicles.mjs's crash window and its chat line ask `crashProtectionOf` (the window
  code itself is the generic vehicle-defeat bookkeeping and stays).
- **Flames of Hate** - each of its two attack items: Defense `{defense: any, mode: ignoreArmor, outgoing: true, when: [item:own]}`.
- **Comms Assault** - Defense `{defense: toughness, mode: ignoreArmor, armor: worn, outgoing: true, when: [self:marked:tf1CommsAssault]}`
  (the Use's roll mark from slB9).
- **Anti-Armor (Attack)** - an `added` Trigger and a Use (on a Zord): `pick weapon from ownedItem weapon` (auto with one,
  `legacy: flags.essence20.zord1AntiArmorWeapon`); `WeaponTrait {traits: [antiTank, wrecker], items: [item:picked:weapon]}`; a
  `hit` Trigger `outcome: crit`, `when: [item:picked:weapon]`: `shredArmor {to: target, amount: 2}` and a line.
- **Pit Plate / Junkplate** - HitRider `{damageType: sharp, retypeFrom: blunt, retypeCrit: true, when: [attack:unarmed]}` on each
  (the upgrade's rules count while it is loose or on equipped armor - the old `wears`).
- **Rust Derivatives** - a `hit` Trigger `when: [item:onHost, not:target:marked:o2Rusted]`: mark the target `o2Rusted`, a line,
  and a "Treat the corrosion" button (`who: anyone, runAs: clicker, once: false`: Science or Technology DIF 20, success unmarks);
  a Veto `{on: update, marked: o2Rusted, path: system.health.value, change: up, clamp: true}`.
- **Stasis Cuffs** - a Use (Standard action; before the cost: a target that isn't the user, d2 Technology): mark the target
  `o2StasisCuffs`, Impaired, a line, a "Break free" button for the target's owners (`actAs` the target: Brawn DIF 19, success
  unmarks and lifts Impaired) and a "Release" button for anyone; three marked Vetoes (converting; lowering normal or Dark Energon).
- **Gluten-Tolerant** - Veto `{on: create, items: [item:id:RO0a3eX8MIo5g1Tv]}` (the Weird Perk) with the old warning.
- **Armor Matrix (partial)** - each size: Veto `{on: create, when: [not:rule:data:flags.essence20.parentId], items: [an upgrade
  that is one of the three matrices or named "armor matrix", not attached]}`. Stays code: the "only the best matrix's Toughness"
  derived pass (`extraMatrixToughness`) - no rule sums other items' bonuses and takes all but the best off.
- **Bio-Tech Armor** - `ArmorPair {items: [item:hasUpgrade:name~organic], other: [item:trait:computerized]}`; the generic
  two-armor warning in other2/gij.mjs asks `ruleAllowsArmorPair`.
- **S.W.A.T. Upgrade** - DialogSwitch `{key: pr1SwatStun, forget}` on a Zord's ranged attacks (a set style that isn't melee) and
  HitRider `{option: {damage: "@var.damage + 1", damageType: stun}, when: [roll:switch:pr1SwatStun]}`.
- **Solar Power (partial)** - HitRiders gated on the active Form (`self:morphed`, `self:data:flags.essence20.zord1Form.uuid=...`):
  a Power Weapon not named Blaster gets `note: 1` and `damageTypeFrom: flags.essence20.zord1Form.element`; a Blaster or Targeting
  weapon gets a 1 Fire option. Stays code: picking the element at Morph (group A's Form lifecycle stores it in that flag).
- **Supersonic** (its damage half) - DialogSwitch `{key: zord1SupersonicEnergy}` on unarmed attacks; HitRiders: Blade Blaster
  deals Sonic, an unarmed hit with the switch deals Energy (`element`). The Form's lifecycle is group A's.
- **Shield Fighter** - a Use (Free action, 1 Personal Shield use - `cost.amount: "1 - @actor.system.useUnlimitedResource"`): the
  Element pick first (`pick from: list`, before the cost), a self mark `o1ShieldElement` for `rounds:10`, a line; HitRider option
  `{damage: "@var.damage", damageType: "{choice.element}"}` on the close-combat blade / bludgeon's hits while marked.
- **Onslaught** - HitRider `{siblings: {label: "Onslaught: {effect}", fallback: Maneuver 1}}` on melee attacks.
- **Time Strike** - DialogSwitch `{key: o1TimeStrike, cost: 1 Personal Power}` on a Chrono Saber attack while Morphed; HitRider
  `{note: "@var.base", siblings: {label: "Time Strike: {effect}"}, when: [roll:switch:o1TimeStrike]}`.
- **Solarix Shard** - a Use: `pick weapon from ownedItem` filtered to Power Weapons (`legacy: flags.essence20.o3SolarixWeapon`);
  HitRider option 1 Fire `when: [item:picked:weapon]`.
- **Power Construct** - HitRider option 2 Energy on melee hits; a `takesDamage` Trigger `when: [damage:melee, target:data:uuid]`
  posting a GM button "Apply 1 Energy to {target}"; a `droppedToZero` Trigger (Health) with the vanishing line.
- **Staggering Sway** - HitRider `{watch: ally, note: 1, when: [item:damageType:stun]}`.
- **More Bang for your Buck (partial)** - HitRider `{on: cast, note: 1, when: [item:type:spell, any of Fireball / Temper
  Tempest / item:damageType:fire]}`. Stays code: Temper Tempest's own storm (permanent code) still adds 1 for More Bang.
- **Softenblows** - an `afterRoll` Trigger (success, `item:own`): `target` (min 0), mark the target `softenblows` until the end of
  its next turn (`untilOf: recipient`); HitRider `{negate: true, marked: softenblows}`.
- **Last Stand** - a `defeated` Trigger `when: [combat:exists]`: a whispered button for the owners: `actWhileDefeated`,
  `grantActions {standard: 1, move: 1}`, `setTargets` at the one who did it, a line.
- **Roll With It** - a `takesDamage` Trigger `when: [self:data:system.health.value>0, not:self:limitUsed:tf3RollWithIt]`: a
  whispered button (limit 1 per turn, key `tf3RollWithIt`): `push {feet: 10}` away from the damage's source, and a line (moved,
  or "by hand").
- **Intensive** - a `patchedUp` Trigger `when: [skill:technology, var:amount>0]`: `collect` the injured (`allies+self:30`,
  Health below max) without the patched one (required), then a whispered button healing them `@var.amount`.
- **Stim Dart** - a Use (Standard action; `limit: {per: mission, max: "@count.named.stim_dart"}` - the Perk plus each carried
  dart): out of 20 ft refused before the cost; beyond 5 ft a Targeting roll against Evasion (a miss posts its line and uses the
  dart); a Defeated target `healAction 2`, a conscious one 2 Temporary Health; nobody targeted - the medic.
- **Focused Blast** - group C's DialogSelect (keep / ↑1 / +1 damage with key `tf1FocusedDamage`) on area attacks and HitRider
  `{note: 1, when: [roll:switch:tf1FocusedDamage]}`.
- **Tox-En** - a Use (targets required): `choose` near / touching, then `rollFormulaVsEach` `1d20 + 1d8` / `2d20kh + 1d8` against
  Toughness; a hit: 1 Strength and 1 Speed Essence damage and Impaired 10 rounds (a timed Impaired in a combat lasts 10 longer).
- **Target-Rich Environment** - a Use (once per scene): `pick` the favorite weapon's attack (`check:favoriteWeaponRolled`, auto
  with one), `require self:canSpendStoryPoints`, `attackEach` (not allies, not Defeated; a whole turn; then 1 Story Point), a line.
- **Sustained Beam** - a `hit` Trigger on the upgrade `when: [item:onHost, not:roll:dataset:rulesFollowUp=sustainedBeam,
  not:self:limitUsed:tf2SustainedBeam:round]`: a button (once per round, used only when it finishes): Energon >= 1, a Free action,
  1 Energon, a banked Edge on the next attack, `attack {item: rolled, dataset: {rulesFollowUp: sustainedBeam}}` at the target.
- **Now You Don't** - `HideBonus {amount: 5, when: [self:transformed]}`; hide.mjs's Hide switch adds `ruleHideBonus`.
- **Monster Morph** (the Path Roles) - Cruelty / Frost: a `takesDamage` Trigger in Monster Form for `damage>=2` from an attack
  (`damage:attack`) - a whispered button: `collect all:10` (required), `rollVsEach` Intimidation vs Willpower (Cruelty, once per
  round: a GM "Apply 1 Void" button per hit) or Brawn vs Toughness (Frost: Immobilized 1 round). Flame / Thorns / Venom: a melee
  `hit` Trigger in Monster Form - a whispered "Follow-up attack" button: `rollFlat` Might / (Might or Finesse) / Survival against
  the better of the target's Toughness and Evasion, success a GM button for 1 Fire / Acid / Poison.
- **Fearsome Presence** - a Use `when: [self:recklessAbandon]`: targets, `rollVsEach` Intimidation vs Willpower; on each hit
  the count goes up, and the first three within 20 ft (or off the canvas) are Frightened and marked (per setter); a `turnStart`
  Trigger lifts Frightened from, and unmarks, everyone the Renegade marked (`markedByMe:gij2FearsomeFrightened`).

Tests: `module/rules/engine10-b.test.js` (28, every piece) and `module/rules/conv10-slB10.test.js` (47, every item loaded from
its pack source, asserting what the old tests did and more).

## Behaviour differences worth a decision

1. **Rule hit riders run after the hand-written ones** (the plug-ins load after the slices), so a damage-type change made by a
   rule is seen by nothing after it; before, other slices' riders and the dealt DamageModifiers saw the Sharp / Sonic / Energy
   type. The one dealt DamageModifier with a damage type (Roller Drum, Stun) isn't affected.
2. **Names compare without case and by "contains":** Blaster / Blade Blaster / Chrono Saber (Solar, Supersonic, Time Strike),
   "armor matrix" (was "starts with").
3. **Corrosion and cuffs are rule marks now.** An actor corroded or cuffed under the old code (flags `o2Rusted`,
   `o2StasisCuffs`) is free after the update. A marked veto lasts while the setter still holds the rule: unequipping the Stasis
   Cuffs gear, removing the Rust Derivatives upgrade or deleting the setter lifts it. Stasis Cuffs posts its two buttons as two
   cards, refusals are card lines instead of toasts, and the tether's Health (which nothing ever read) isn't counted.
4. **Rust Derivatives** corrodes on any hit with the weapon (the old rider needed the hit to have damage).
5. **Anti-Armor's traits come from the rule**, not a write to the weapon: removing the Feature takes them away (weapons picked
   under the old code keep the written traits as well). The crit note is a chat line instead of a line on the card; an old
   `zord1ArmorShred` flag (scene-long) is no longer read.
6. **Shield Fighter's Element** lasts 10 rounds from its use (`rounds:10`; the old flag ended at round + 10 of that combat or the
   scene); its line shows the Element's key.
7. **Solarix Shard's rules** (both the old discount Trigger and the new Fire option) count only while the gear is equipped.
8. **Power Construct:** the attacker for the 1 Energy is the applied card's speaker (`source`), the vanishing line fires on any
   write that takes Health to 0 (droppedToZero), not only damage.
9. **Softenblows:** a cast with no result rows (no DIF at all) no longer marks the target.
10. **Last Stand:** "the creature that Defeated you" is the damage's source (the card's speaker) rather than the last applied
    card's attacker. **Roll With It / Intensive / Monster Morph:** their buttons are rule button cards (Intensive's intro doesn't
    list the allies by name; a Monster Morph burst with nobody near leaves the button pressable instead of a toast; Flame and
    Venom roll their one Skill without a one-option question).
11. **Stim Dart:** a dart used this mission under the old counter isn't seen; the dart count includes the Perk by name ("Stim
    Dart" - a renamed Perk changes it); "out of range" is a card line.
12. **Monster Morph's `damage:attack`** needs the applied card's target to be this actor (the old check took any Apply click in
    the last two minutes).
13. **Gluten-Tolerant** no longer vetoes when the Hang-Up is matured-ignored; **Bio-Tech Armor's** Computerized test reads traits
    attached upgrades add too.
14. **Target-Rich Environment's** button shows without a favorite weapon (the pick then says there's nothing to pick); its
    refusals are card lines.
15. **Sustained Beam** offers a follow-up per target hit (the old code: the first hit only); the follow-up is recognised by its
    roll's dataset instead of an actor flag.
16. **Fearsome Presence** needs a target (the old roll went ahead with none), has no pre-roll warning for too many / too far
    targets (the three-within-20-ft cap still applies), and Frightens only the allowed ones (the old code Frightened every hit,
    then lifted the extras - which also lifted a Frightened they already had). An old `gij2FearsomeFrightened` flag isn't read.
17. **Tox-En** on a victim the user doesn't own goes through the GM (the old code warned and skipped).
18. **The roll dataset in Triggers:** `roll:specialized` / `roll:initiative` / `roll:dataset:` now answer in hit / miss /
    afterRoll Triggers (they were false or unknown there). **`defeated` Triggers** now get the source as target (Martyr and the
    S.W.A.T. watch Triggers don't use it).

## Still code (3), and why

- **Warhead Magazines** - needs a DialogSelect whose options are the Zord's picked types only (per-option `when`, or options
  from data) and a three-pick per copy excluding the other copies' picks. Small-medium; not effectively permanent.
- **Pop Out** - needs the Hidden state as data (a "broke hiding" event fired by hide.mjs's generic Hide code, a `hide` step) and
  one roll against every observer's better of Willpower / Cleverness, success only if all are beaten. Medium.
- **Telltale Sign** - its buttons live on Pop Out's success card and count presses per card (three, each a Free action in
  combat, the Frightened rounds growing with each success); needs Pop Out first plus a per-card counter. Medium.
- **Armor Matrix's "best matrix only" Toughness** (the partial's code half) - a derived pass over other items' bonuses.
- (Not items of mine but still code beside these: Temper Tempest's storm reading More Bang - permanent with Temper Tempest;
  Solar Power's element pick - group A's Form lifecycle; Rust Derivatives' +1 Acid in weapon-upgrades.mjs.)

## Shared-file edits

- `module/mechanics/combat/target-riders.mjs` - `buildRiderContext` keeps the roll's plain dataset values (`dataset`).
- `module/rules/triggers.mjs` - post-roll Trigger context gets `dataset: rider.dataset`; hit / miss Triggers get
  `vars: {rolledItem}`; the afterDamage `defeated` call passes `targets: [source]`.
- `module/dice.mjs` - the import line (no `takedownExpertChoice`), the Takedown Expert call and `TAKEDOWN_EXPERT_ID`, a comment;
  the Fearsome Presence checkContext flag and its Frightened block.
- `module/dice.test.js` - the Takedown Expert outcome test (dice.mjs now only Grapples), the Fearsome Presence describe block.
- `module/mechanics/resources/banked-buffs.mjs` (+ `.test.js`) - Fearsome Presence's id, its two branches, the `activateFearsomePresence` and
  `isRecklessAbandonActive` imports; its describe block.
- **Deleted:** `module/helpers/fearsome-presence.mjs` and its test (their only use was the activation), and
  `module/helpers/extensions/wtnv/wtnv.test.js` (it held only the Staggering Sway test).
- `module/mechanics/combat/sneak-attack.mjs` (+ `.test.js` fixtures) - the three Every Trick checks ask `ruleSneakAttackImmune`.
- `module/items/rolls/better-than-the-best-miss-immunity.mjs` - `ignoresMissEffects` reads MissImmunity rules; `takedownExpertChoice`, the two
  ids and `GIJ_CRB` gone. `gij3/gij3.mjs` header comment; `gij3/gij3.test.js` (Seconds Between via a rule item; Takedown test gone).
- `gij2/vehicles.mjs`, `gij2/shared.mjs`, `gij2/gij2.test.js`, `gij2/perks.mjs` (Fearsome Presence section, its helpers and imports).
- `pr2/finster.mjs`, `pr2/common.mjs`, `pr2/pr2.test.js`; `pr1/ats.mjs`; `pr3/ttsg.mjs`, `pr3/common.mjs`.
- `tf1/combat.mjs` (Focused Blast, Target-Rich Environment, the Comms armor; `COMBAT_USES` is now `[]`), `tf1/support.mjs` (Tox-En),
  `tf1/common.mjs`, `tf1/tf1.test.js`; `tf2/rolls.mjs`, `tf2/modes.mjs`, `tf2/common.mjs`; `tf3/reactions.mjs`, `tf3/common.mjs`,
  `tf3/tf3.test.js`.
- `zord1/zord-slots.mjs`, `zord1/forms.mjs` (formHitRider, the Supersonic switch, `pendingHit`), `zord1/zord1.test.js`.
- `other1/more.mjs`, `other1/cobra-gear.mjs`, `other1/jtt.mjs`, `other1/other1.test.js`; `other2/decepticon.mjs`, `other2/gij.mjs`,
  `other2/magic.mjs`, `other2/medic.mjs`, `other2/other2.test.js`; `other3/wtnv.mjs` (now an empty module - helpers/extensions/
  index.mjs and other3/index.mjs import it), `other3/pr.mjs`, `other3/hide.mjs`, `other3/shared.mjs`, `other3/other3.test.js`.
- `wtnv/wtnv.mjs` (now an empty module - items/index.mjs imports it); `mlp1/mlp1.mjs`; `react/forms.mjs`,
  `react/react.test.js`.
- `module/rules/conv9-slB9.test.js` (Comms Assault drives `ignoreArmorAdjust`), `module/rules/conv5-slD5.test.js` (imports
  `ext/index.mjs` - Solarix Shard's pack item carries a HitRider now).

## Unused strings

`E20.Gij3TakedownExpert`, `E20.Gij3TakedownExpertChat`, `E20.Gij3TakedownExpertPrompt`, `E20.Gij3TakedownDisarmed`,
`E20.Gij3TakedownImmobilized`, `E20.Gij3TakedownSilenced`, `E20.Zord1AntiArmorPrompt`, `E20.Zord1AntiArmorSet`,
`E20.Zord1AntiArmorNote`, `E20.Zord1AntiArmorLabel`, `E20.Zord1NoZordWeapon`, `E20.Zord1ToggleSupersonicEnergy`,
`E20.Pr1SwatStunApply`, `E20.Pr1SwatStunToggle`, `E20.Pr3ConstructRetaliate`, `E20.Pr3ConstructVanish`, `E20.O2RustApplied`,
`E20.O2RustCured`, `E20.O2RustNoHeal`, `E20.O2RustTreat`, `E20.O2NeedHealer`, `E20.O2CuffsApplied`, `E20.O2CuffsBreak`,
`E20.O2CuffsFreed`, `E20.O2CuffsNeedTech`, `E20.O2CuffsNoConvert`, `E20.O2CuffsNoEnergon`, `E20.O2CuffsRelease`,
`E20.O2CuffsUsed`, `E20.O2StimDartBoost`, `E20.O2StimDartMissed`, `E20.O2StimDartRevived`, `E20.O2OutOfRange`,
`E20.O3GlutenTolerantNoWeird`, `E20.O1ArmorMatrixOne`, `E20.O1OnslaughtAlternate`, `E20.O1OnslaughtManeuver`,
`E20.O1ShieldElement`, `E20.O1ShieldElementHit`, `E20.O1ShieldElementPrompt`, `E20.O1TimeStrikeAlternate`,
`E20.O1TimeStrikeSecond`, `E20.O1TimeStrikeToggle`, `E20.O3SolarixApplied`, `E20.O3SolarixPick`, `E20.Mlp1Softenblows`,
`E20.Tf3LastStandPrompt`, `E20.Tf3LastStandTaken`, `E20.Tf3TheirFoe`, `E20.Tf3RollWithItPrompt`, `E20.Tf3RollWithItMoved`,
`E20.Tf3RollWithItManual`, `E20.Tf3IntensivePrompt`, `E20.Tf3IntensiveDone`, `E20.Tf1FocusedBlastNone`, `E20.Tf1FocusedBlastUp`,
`E20.Tf1FocusedBlastDamage`, `E20.Tf1ToxPrompt`, `E20.Tf1ToxNear`, `E20.Tf1ToxTouch`, `E20.Tf1ToxHit`, `E20.Tf1ToxMiss`,
`E20.Tf1PickTargets`, `E20.Tf1TargetRichDone`, `E20.Tf1NoFavorite`, `E20.Tf1PickAttack`, `E20.Tf1NoFoes`, `E20.Tf1NoStoryPoint`,
`E20.Tf2SustainedBeamOffer`, `E20.Tf2SustainedBeamButton`, `E20.Tf2OncePerRound`, `E20.ReactMonster_cruelty`,
`E20.ReactMonster_frost`, `E20.ReactMonster_flame`, `E20.ReactMonster_thorns`, `E20.ReactMonster_venom`, `E20.ReactMonsterVoid`,
`E20.ReactMonsterFrozen`, `E20.ReactFollowUp`, `E20.ReactFollowHit`, `E20.ReactPickSkill`, `E20.ReactAlreadyUsed`,
`E20.ReactNobodyNear`, `E20.Gij2FearsomeCard`, `E20.Gij2FearsomeLimits`, `E20.FearsomePresenceNotActive`.
(`E20.O2TwoArmors` stays - the generic warning. New strings are in `r10/lang-b.json` under `RulesExtB`.)

## Rule count

**62 rules added on 43 pack items** (all CRLF, inserted as text): Takedown Expert 1, Seconds Between 1, Every Trick 1, Roll Cage 1,
Flames of Hate 1 + 1, Comms Assault 1, Anti-Armor 4, Pit Plate 1, Junkplate 1, Rust Derivatives 2, Stasis Cuffs 4,
Gluten-Tolerant 1, Armor Matrix 1 x3, Bio-Tech Armor 1, S.W.A.T. Upgrade 2, Solar Power 2, Supersonic 3, Shield Fighter 2,
Onslaught 1, Time Strike 2, Solarix Shard 2, Power Construct 3, Staggering Sway 1, More Bang 1, Softenblows 2, Last Stand 1,
Roll With It 1, Intensive 1, Stim Dart 1, Focused Blast 2, Tox-En 1, Target-Rich Environment 1, Sustained Beam 1,
Now You Don't 1, the five Paths 1 each, Fearsome Presence 2.

## Checks

- ESLint (`--ext .js,.mjs`, linebreak-style off) on every file above: clean.
- `node scripts/check-rules.mjs`: 2328 rules on 1358 items, 0 errors, 0 warnings.
- Jest: `engine10-b` (28) and `conv10-slB10` (47) pass; all of `module/rules` passes except other groups' in-progress suites
  (`conv3-slA3`, `conv5-slA5` - group A's `SummonTime` type not loaded there; `conv6-slA6` - a Movement `stage: derived`;
  `conv10-slC10` Synch Up); the touched slice folders, `sneak-attack`, `banked-buffs`, `dice.test.js` pass except
  `zord1.test.js`'s Forms tests (group A's Form lifecycle) and `items/index.test.js` (a missing
  `react/auras.mjs` - not mine).
