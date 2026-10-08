# Round 17, split1 - the split items' remaining code

Scope: the 47 items of `r17-split-1.json` - items that already carried `system.rules` but still had hand-written code
for part of their behaviour. Nothing Personal and Good To Go (not on the list) rode along: they were the last two
entries of the same dice.mjs vehicle-Qualification table.

## Engine features added 2026-10-07 (round 17, split1)

- **Link scope `formedBy`** (`plugins/zords/formed-by-scope.mjs`): a rule with `scope: formedBy` on a character's item
  reaches the Megaform that character formed - the one whose `flags.essence20.<flag>` names the character's uuid
  (`FORMED_BY_FLAGS`: `zord2DefenderTorozord`, the Defender Torozord). Taken by every rule type that takes `vehicle`.
  Ultimate Magna Defender: `{type: DamageModifier, direction: dealt, scaled: true, amount: 1, scope: formedBy, when:
  ["attack:melee"]}`.
- **Ref `@tokensHolding.<16-character id>.<feet>`** (`plugins/tags/tokens-holding-ref.mjs`): how many OTHER tokens in the
  viewed scene, of any side, stand within that many feet of the actor's token (centre to centre,
  `canvas.grid.measurePath`) and belong to an actor holding an item from that compendium entry (any printing). 0 off
  the canvas. Colony Changeling: `{type: Defense, defense: evasion, amount: "min(3, @tokensHolding.FRUWPAePJzm7Mlf0.5)"}`.
- **DialogSwitch `setDie: <die>`** (`plugins/dialog/switch-set-die.mjs`): ticked, the roll's final Skill Die is that one
  whatever the shifts made it, and the roll has neither Edge nor Snag - decided in dice.mjs#rollSkill after a capDie
  switch's d12 cap and BEFORE the automatic-failure check (so a roll shifted down to auto-fail still gets the die); a
  Fanning volley's later shots get the d4 too. Savant Skill: `{type: DialogSwitch, setDie: "d4", forget: true, when:
  ["skill:{item.choice}"]}`.
- **Defense `ignoreArmor` with `lookup: true`** (`plugins/combat/lookup-armor-points.mjs`): `{type: Defense, defense,
  mode: ignoreArmor, outgoing: true, lookup: true, points}` - the points of armor ignored are taken off where dice.mjs
  first looks the target's Defense up (getDefenseValue's `ignoreArmorPoints`), not added afterwards with the other
  per-attack changes (ignore-armor.mjs skips these). So an attack that ignores the armor outright anyway (a ticked
  `ignoreArmor` key, Void, a later Armor Piercing / noArmor recompute) doesn't take the points off a second time. The
  biggest such rule counts; `when` sees the roll (`roll:switch:<key>`) and the target. Metallikato's Bot Mode switch:
  a DialogSwitch `key: metallikatoIgnoreArmor` plus `{... lookup: true, points: "@actor.system.essences.smarts.value",
  when: ["roll:switch:metallikatoIgnoreArmor"]}`.
- **AttackResistance `choiceOf` / `fromMark` / `consumeMark`** (`plugins/combat/attack-resistance.mjs`): the resisted
  types may come from elsewhere instead of `damageTypes` - `choiceOf: <uuid>`: the type chosen (system.choice) on the
  actor's copy of that item, `"energy"` standing for every Energy type (Numbness: Stone Warlord's extra type);
  `fromMark: <key>`: the text of the holder's own mark under that key (a `mark {text: "{choice.type}"}` step);
  `consumeMark: true` (with fromMark): the mark comes off the first time an attack of that type is weighed against it,
  even when another Resistance already gives the Snag (Righteous Heart's banked Resistance). Every AttackResistance
  rule is now asked, not just up to the first that resists. dice.mjs asks ruleResistsAttack before the other "live"
  resistances, so the mark is used up exactly when the old banked flag was.

## Verdicts

| # | Item | Verdict | What the rules do now / why it stays |
|---|------|---------|--------------------------------------|
| 0 | No Fighting?! | converted | combatEnd Trigger marks `noFighting`; the Social Snag reads and uses up the mark |
| 1 | Pressure Cooker | converted | DialogSwitch at exactly 1 Health: Edge that clears the Snag, costs 1 Moxie |
| 2-5 | Air / Land / Sea Vehicle Qualification, Skyward | converted | RollModifier ↑1 on Driving while driving that movement type, with Ranks (`stack: vehicleQualification`) |
| 6 | Weak Point | converted | AttackTraits armorPiercing + antiTank on melee attacks |
| 7 | Nu, Pogodi! | partial | the ↑1 is a rule; its once-per-encounter Condition removal (items/healing/nu-pogodi.mjs via banked-buffs) and the seat-swap reader (qualification-gm-relay / nu-pogodi-seat-swap.mjs) stay - two code Uses share that state |
| 8, 9, 10 | The Promise of Riches, For The Syndicate, Oorah! | converted | the same ↑1 RollModifier (For The Syndicate on `vehicle:moves:{item.choice}`) |
| - | Nothing Personal, Good To Go | converted | same table, same rule |
| 11 | Roaming the Land | converted | hit Trigger: 1 Stun to a larger creature (largerStun choice, melee) |
| 12 | Penetrating Rounds | converted | AttackTraits armorPiercing with the Shotgun / Submachine Gun |
| 13 | Fighting Style | partial | Careful / Defense are static Defense rules; Trigger Happy stays code - permanent (the second Willpower compare on every check entry and its Frightened, read by Gallantry) |
| 14 | Gallantry | still code | its Snag reads Trigger Happy, which stays code |
| 15 | Cryogenic Touch | converted | DamageType cold on bare-handed attacks (priority -3, ahead of Ninja Power and the other rules) |
| 16 | Ultimate Magna Defender | converted | scope formedBy DamageModifier on the Defender Torozord |
| 17 | Exterminator | still code (reader) | it only sets the roll fact the Reroll subsystem's `smallerTarget` condition reads; Reroll rules have no roll-time condition |
| 18 | Metallikato | converted | MultipleTargets rule; on / off Uses (updateActor on the same flag); Bot Mode ignore-armor switch + lookup Defense |
| 19 | Over the Candlestick | still code (permanent) | Agile Reflexes replaces the per-attack Toughness with Evasion mid-pipeline (after the Armor Piercing recomputes), once a scene - no rule point there |
| 20 | Predacon | converted | its hit Trigger now applies Frightened before marking |
| 21 | On Your Feet | converted | aura RollModifier (allies, any distance via the system's ally lookup): Initiative Edge |
| 22 | Everything is Inspiration | converted | afterRoll Trigger `outcome: anyFailed`, limit per encounter, grantStoryPoint |
| 23 | Dogfighter | converted | RollModifier Edge on Driving / Targeting vs an aerial vehicle while driving an aerial vehicle up to Extended II |
| 24 | Eltarian Training | converted | DownshiftCancel on Finesse |
| 25 | Savant Skill | converted | DialogSwitch setDie d4 on the chosen Skill |
| 26, 27 | Silver / Graphite Ranger Prime | converted | late incoming RollModifier Snag on `defense:willpower` / `defense:cleverness` |
| 28 | Ninja Power | partial | the chosen element is a DamageType rule; the dead banked-buffs on/off branches are gone; items/movement/ninja-power-jump.mjs stays - a bespoke chooser Use (jump or switch off) |
| 29 | Colony Changeling | converted | Defense rule over @tokensHolding |
| 30 | Brutal Might | still code | the Might-to-Brawn swap happens when the weapon builds its roll dataset (documents/item.mjs), before the Skill's shifts are read; SkillSubstitution acts later, at pre-roll |
| 31, 32 | Obscuring Matrix (Basic / Advanced) | still code (permanent) | the armor's own total over its attached-upgrade entries (plain data, no rules) in documents/item.mjs#_prepareArmorBonuses |
| 33 | Energy Affinity | still code (reader) | the `check:energyAffinityAttack` helper and the scene alteration its Use writes are read by Energy Connection and Energy Mastery |
| 34, 35 | Beatdown, Jackhammer | converted | combat-only Free-action Uses (by level: Standard / +Limited at 10 / +Restricted at 17): pick a weapon, pickEntry an upgrade, fitUpgrade until endOfTurn |
| 36 | Motor Lancer | converted | combat-only Free-action Use marks `motorLancer` until endOfTurn; ItemModifier stage item sets a 2+-handed weapon's derivedHands to 1 |
| 37 | Bullpup | converted | ActionCost reload to free, once a scene per upgrade |
| 38 | Rust Derivatives | converted | ItemModifier stage item (slot end, first): 1 Acid secondary on its weapon's attacks without one |
| 39 | Fluid Motion | converted | AlternateEffect Maneuver on Silent Martial Arts weapons (key fluidMotion kept) |
| 40 | Scramble Wave | converted | ItemModifier stage item (slot start, first): 1 EMP secondary on every damaging attack without one |
| 41 | Impenetrable Armor | still code | the redirect to the pilot's own vehicle is asked before the ally protectors at Apply Damage; applyingDamage only redirects to allies |
| 42 | Iron Bravado | still code (permanent) | a snapshot of the holder's immunities shared with allies, enforced in preCreateActiveEffect |
| 43 | Numbness | converted | AttackResistance choiceOf Stone Warlord |
| 44 | Protector's Shield | still code (permanent) | stored temporary Health written when the Personal Shield is toggled (sheet + its Use); a derived bonus would never be used up by damage |
| 45 | Righteous Heart | converted | Use while Morphed: pick a type, mark it; AttackResistance fromMark + consumeMark |
| 46 | Rise Again | converted | once-a-scene Use: choose a Defense, bank +5 against the next attack on it |

Converted fully 34 (+ Nothing Personal, Good To Go); partial 3; still code 10 (Exterminator and Energy Affinity are
readers; Over the Candlestick, Obscuring Matrix x2, Iron Bravado and Protector's Shield permanent; Gallantry, Brutal
Might and Impenetrable Armor would need a new engine piece each).

Files removed: items/rolls/no-fighting.mjs, items/attacks/metallikato.mjs, items/defenses/rise-again.mjs,
items/defenses/righteous-heart.mjs, items/defenses/numbness.mjs (and their tests). Tests replaced by
rules/conv17-Split1.test.js (and a Fluid Motion test in items/attacks/weapon-upgrades.test.js).

## Bugs found and fixed

- Pressure Cooker: dice.mjs read `moxie`, a variable that no longer existed in the working tree (an earlier round's
  Old Reliable conversion had removed its declaration) - a ReferenceError on any roll by a holder at exactly 1 Health.
  Gone with the code; the rule reads the Moxie Role Points item itself.
- Ninja Power: banked-buffs.mjs's on/off branches were dead (items/movement/ninja-power-jump.mjs's registered Use is
  found first) - removed.

## Code vs notes - needs a ruling

- Rise Again: the old picker text said "+5 ... until the start of your next turn"; the code (and now the rule) banks it
  until the next attack against that Defense. (questions.md)

## Behaviour differences worth a decision (all in questions.md)

- Pressure Cooker's Edge is in place when the dialog closes, so Old Reliable's "both d20s" box and RollDice rules see it.
- Silver / Graphite Ranger Prime: as late incoming RollModifiers (like Orange Ranger Prime) Observer and immune: snag
  act on their Snag.
- Two vehicle-choice Perks (Good To Go + For The Syndicate) or two Fighting Style copies with different choices: each
  copy's choice counts (the code read the first copy only).
- Smaller ones, left without a question: No Fighting?! now banks only when a started combat is deleted (the combatEnd
  event, as for Hard Corps); Ninja Power with no element chosen lets the other DamageType rules decide (the code
  stopped there); the vehicle ↑1, Dogfighter and On Your Feet are listed sources in the dialog now; Bullpup and an Ammo
  Belt on one weapon spend whichever cost rule comes first (two Free reloads a scene either way); Beatdown / Jackhammer /
  Motor Lancer post the rule steps' chat lines.

## Shared-file edits

module/dice.mjs (vehicle table, Pressure Cooker, Weak Point, Penetrating Rounds, Roaming the Land, Cryogenic Touch,
Ninja Power, Ultimate Magna Defender, Metallikato, Predacon, On Your Feet, Everything is Inspiration, Dogfighter,
Eltarian Training, Savant Skill, Prime Snags, No Fighting?!, Rise Again, Numbness / Righteous Heart resistance; imports
ruleSetDie / ruleLookupArmorPoints; dead constants and imports), module/dice.test.js, module/essence20.mjs,
module/chat.mjs (comment), module/documents/actor.mjs (+ test), module/mechanics/combat/nearby-allies.mjs (+ test),
module/mechanics/combat/multiple-targets.mjs (+ test), module/mechanics/combat/reload-trait.mjs,
module/mechanics/resources/banked-buffs.mjs (+ test), module/mechanics/actions/action-perks.mjs,
module/mechanics/rolls/roll-dialog.mjs, module/apps/roll-options-dialog.mjs, templates/dialog/roll-dialog.hbs,
module/items/attacks/weapon-upgrades.mjs (+ test), module/items/attacks/weapon-perk-uses.mjs (+ test),
module/items/attacks/ninja-power.mjs (comment), module/sheet-handlers/perk-handler.mjs (comment),
module/rules/plugins/combat/attack-resistance.mjs, module/rules/plugins/combat/ignore-armor.mjs,
module/rules/plugins/index.mjs (own block at the end), module/rules/conversions.test.js, module/rules/conv4-slB4.test.js.

## Unused strings

E20.RollDialogPressureCooker, E20.RollDialogSavantSkill, E20.RollDialogMetallikatoIgnoreArmor,
E20.MetallikatoMultipleTargetsActivated, E20.MetallikatoMultipleTargetsDeactivated, E20.RiseAgainPickDefenseTitle,
E20.RiseAgainPickDefenseLabel, E20.RighteousHeart, E20.RighteousHeartPickLabel, E20.WeaponUsePickWeapon,
E20.WeaponUsePickUpgrade, E20.WeaponUseTemporaryUpgrade, E20.WeaponUseMotorLancer. (No new strings: the lang fragment
`RulesExtSplit117` is empty.)

## Rule count

51 rules added on 39 pack items, 2 changed (No Fighting?!'s RollModifier, Predacon's hit Trigger).
