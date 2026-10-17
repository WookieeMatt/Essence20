# Book check - effects group (2026-10-06)

Scope: the effects items from scratchpad questions.md, plus Growl and Deadstick (added by the coordinator), plus the
conversion-order questions the book settles, plus the `E20.MegaWeaponCreated` string. Each printing was read in its own
book. Where the book is silent or ambiguous the current behaviour is kept and marked "book silent - kept".

| Item | Printing (book p.) | What the book says (paraphrase) | What changed |
| --- | --- | --- | --- |
| Meat Shield | Sgt Slaughter Sourcebook p.14-15 | Free action, Personal Shield Benefit to Toughness/Evasion until the start of your next turn; from 5th also allies in your Reach; permanent +2/+3/+4 from 7th/12th/20th (doesn't stack with the temporary one); 13th: Resistance to a chosen type while it lasts; 18th: instead immunity to one type and Resistance to all others | Use now costs a Free action and lasts until your next turn (`until: nextTurn`; out of combat until switched off); two aura Defense rules (radius 5, allies, `holder:level>=5`) share the temporary bonus; 13th: pick a type -> DerivedStat Resistance; 18th: pick a type -> DerivedStat immunity + Resistance to the 12 other damage types. Notes rewritten |
| Animal Gait | Cobra Codex p.59 | Standard action, in your environment of expertise, ONE of Aerial/Climb/Swim = Ground Movement until the end of your turn | Rules already picked one type (notes were wrong). Added `cost.action: standard` (gate and pick run before the cost) and `until: endOfTurn`. Notes fixed |
| Better You Than Me | Finster's p.289 | 1 PP, touch a willing ally: you regain 1 Health, they take 1 Void damage that can't be reduced in any way | `loseHealth` -> new step `unreducibleDamage` (Void, through applyDamage with `unreducible`: no Resistance/Immunity/DamageReduction/damage shield; the Defeat chain and damage Triggers still run) |
| Acting! | MLP CRB p.86 | Spend 1 Cheer to use Performance in place of Persuasion/Deception/Infiltration (disguises) | The Use (a bare 1-Cheer spend) became a DialogSwitch `{useSkill: performance, cost: 1 Cheer}` on those three Skills. "Involves a disguise" left to the table |
| Heart Of The Team (GIJ) | GI JOE CRB p.109 | Once per encounter, Standard action, a Story Point: allies within 30 ft may move their full Movement now and either end a Condition or gain 1 Temporary Health | Added `cost.action: standard`. The granted Move is the system's "move right away" idiom (as Not On My Watch) - kept. The Condition-instead choice stays left to the table |
| Deconstructionist | QGtG p.26 | Standard action vs equipment (contest with its operator); success: tests using/made by the equipment take Snag for 1 turn | Any target kept (the target stands for the equipment or its operator - the book contests the operator). The Snag bank now covers every test (uses 99) until the end of the target's next turn (`endOfNextTurnOrScene`, untilOf target) instead of one test until combat ends. Notes list what's left |
| Catch Off Guard | Sgt Slaughter Sourcebook p.15 | A successful Attack on a surprised target deals Stun 1 more | `target:notActed` -> `target:status:surprised` (the Surprised Condition exists) |
| Might Makes Right | Decepticon Directive p.66 | On a Persuasion Critical Success you CAN impose Frightened, for 1 minute | Trigger now `prompt: true`, Frightened `rounds: 12` (1 minute; 5 s rounds per the Defibrillator's "30 seconds (6 combat rounds)") |
| Ice Flechettes (Effect, Alternate Effect, weapon, Perk) | Finster's p.291/302 | Critical Success: target loses armor Defense bonuses until the end of its next turn | Already matches (crit rider rule). Notes no longer say "left to the table" |
| Avalanche Stomp (Effect, weapon, Perk) | Finster's p.294/296 | Success: Stun 2; Critical Success: also Prone | Crit Prone already matched (notes fixed). The Perk's Use applied the Stunned Condition - now deals Stun 2 (damage) on a hit, plus Prone on a double |
| Ground and Pound | Hawk's Personnel Files p.174 | Box in a Prone target: Unarmed attacks against THIS target as Free actions, each at ↓1 per earlier attack this turn | The Use marks the target (`groundAndPound`, endOfTurn); the downshift now needs `target:markedByMe:groundAndPound`. The Free-action cost still covers any Unarmed attack (ActionCost can't see the target) - in the notes |
| Hydraulic Bounce | QGtG p.55 | The DRIVER gains Edge on Driving tests on Rough Terrain | Rule scope `crew` -> `pilot` (driver only) |
| Solid-State Energon | Decepticon Directive p.79 | Damage: 1d2 + damage vs stored points - it explodes; DIF 14 Science refines one crystal | Code already matches the book (used up only by exploding or a successful refine). Notes fixed |
| Personnel Munitions Pack | Enigma of Combination p.58 | ALL friendly characters near it (in Reach) may reload a weapon as a Free action; d20 = 1 uses it up | The fallback to your own weapon is book (you are friendly too) - kept. Notes fixed |
| Terror (+ Menacing Glare, Absolute Menace) | Beneath the Helmet p.39-40 | 1 Terror whenever you deal damage or inflict a Condition through an Edge test (target not immune to Frightened) | Terror gets a hit Trigger for Absolute Menace's roll (`roll:dataset:absoluteMenace`, set by its rollVsEach) with Edge; Menacing Glare's hit Trigger is split into a no-Edge one (`roll:noEdge`) and an Edge one whose Frightened branch gains 1 Terror (`self:has:Terror`, not immune). Other Edge-roll Conditions stay left to the table |
| Constrictor | Cobra Codex p.103 | Automatically 1 Blunt at the start of its turn to a target it is grappling | A hit Trigger on the pet's Grapple / Maneuver / Grapple-trait attacks marks the target (`constrictorHold`); the turnStart squeeze hits `markedByMe:constrictorHold` still Grappled (the old `grappling` flag was never written) |
| Not On My Watch (IA) | Factions in Action V2 p.95 | An ally you can see gains the Defeated Condition: you may Move toward them | A Stun Defeat now gets the same button: new event `defeatedByStun` (combat.mjs's Stun branch fires it on the Defeated) and a second watch Trigger on it. The old code chat prompt is gone |
| Not On My Watch (TF) | TF CRB p.68 | A different Perk (forces a re-roll with Snag) | Not part of the question - untouched |
| Favorite Command (WTNV) | Citizens' Guide p.77 | An Animal Perk ON THE PET: command it to use that Skill as a Move action | Removed the commander-side ActionCost rule; the pet's copy is read by action-perks.mjs (all printings). Notes say it goes on the pet |
| Favorite Command (GIJ, MLP) | GI JOE CRB p.166-167, MLP CRB | Same (pet's Perk) | Already matches |
| Inner Magic | MLP CRB p.94-96 | Standard action: Willpower -1 until the end of the scene, ↑1 Spellcasting on your next action; repeatable | Rules already lowered Willpower (stale notes fixed); added `cost.action: standard` |
| Growl | Cobra Codex p.69 | Free action vs a creature within reach: on a success ↑1 on ALL your attacks against it this turn; once per target per turn | The mark lasts `endOfTurn` (was until combat) and isn't used up by the first attack; no `exclusive` (several targets can be Growled); new `target:withinReach` gate (off the canvas counts as near) |
| Deadstick | QGtG p.26 | Standard action vs a ROBOT within 100 ft | New `require` (before the cost): the target carries a robot tag (the ROBOT_TAGS list) and `target:notBeyond:100` |
| Deadly x2 / Lingering x2 on one weapon | GI JOE CRB p.149-150, TF CRB p.127 | Only an upgrade that says so (Compact) may go on the same weapon twice | New tag `rule:firstOnHost`; Deadly's and Lingering's ItemModifiers count once per weapon (a second copy on the same host adds nothing; copies on different weapons each count) |
| Chrono-Trigger x2 | A Jump Through Time p.71 | The weapon gains the Multiple Attacks (3, ↓2) trait | Same tag on its RollModifier: two copies give ↓2, not ↓4 |
| Charge It Up! + Armor Piercing | A Jump Through Time p.59; GI JOE CRB p.147 | Both ignore armor - it can only be ignored once | dice.mjs passes `armorIgnored` (key/Void ignore or any ignore-armor recompute) to the Defense adjusts; ignoreArmorAdjust then takes nothing more off (it subtracted the armor a second time) |
| Two copies, different choices (Good To Go + For The Syndicate, two Fighting Styles) | Factions in Action V2 p.103-104; GI JOE CRB | Silent on holding two | book silent - kept (each copy's choice counts) |
| Shaped Charges | GI JOE CRB p.82 | Explosives deal double damage to objects and structures | HitMultiplier `stage: late`: the whole row is doubled, flat hit bonuses (Reveal Weakness, All Out Attack) included - as the old code did |
| Quantum Cut | A Jump Through Time p.46 | Ignore armor bonuses and force the target to use Toughness | Already matches (the resolved Defense really is Toughness) |
| Light Chassis | PR CRB p.137 | A level increase to the Megaform's Initiative | book silent on how it's shown - kept (switch-off-able source) |
| Evasive Handling | QGtG p.55 | Halve the vehicle's speed (round down) | Removed the Aerial-halved Movement rule: the evasive flag already halves Aerial in actor.mjs, so Aerial was quartered |
| Shield Upgrade | GI JOE CRB p.108-110 | The Personal Shield's benefit reaches allies in 10 ft; a Personal Shield isn't armor (Armor Piercing ignores battledress deflection) | The four ignore-armor recomputes in dice.mjs (Armor Piercing, Electro Mode, noArmor rules, marked noArmor) now add the lent DefenseAura bonus back, as the base Defense line does |
| Beast Mode + Engrafted / Evolving / Outright Mutation | Cobra Codex p.59, 80-81 | Beast Mode gives the benefits of the Mutation Perk for 1 scene - and that benefit is the Alteration | Each Mutation Perk gets a third rule: on a Beast Mode copy (`flags.beastMode`) it picks its tier's genetic Alteration with `until: scene` |
| Manifested Zord / Q-Rex Portal / Assisted Summoning | Through the Shattered Grid; A Jump Through Time p.46 | Chosen as part of summoning | Already matches (offered at summon) |
| Defibrillator | GI JOE CRB p.162 | Single use, 1 Health to a Defeated character after 6 rounds | Already matches; quantity-0 refusal: book silent - kept |
| APS / Slat / Reactive order | QGtG p.59-61 | No order given | book silent - kept |
| Nanomite gear-held Powers | QGtG p.92 | The equipment grants the nanomite Power (single use or N uses) | The gear runs the linked Power's lasting rules as its own (documents/item.mjs adds them at prep), and the Power's powerUsed steps act on the gear (its toggles) - a gear-held Protection / Augmented Combat / Swiftness now applies to the holder |
| E20.MegaWeaponCreated | - | - | Reworded: summon with the Feature's Use button (lang/en.json, one line, EOL kept) |

## Engine features added (book check, effects) - `module/rules/plugins/book/effects.mjs`

- **Tag `rule:firstOnHost`** - the rule's item is the first copy of its book item attached to its host (same
  `flags.essence20.parentId`, same source, in the actor's item order); true for an unattached item. Use with `stacks: true`
  upgrade rules that the book doesn't allow twice on one weapon (Deadly, Lingering, Chrono-Trigger).
- **Tag `roll:noEdge`** - the roll had no Edge (unknown counts as none; `roll:edge` answers null then).
- **Tag `target:withinReach`** - the other party is within this actor's melee Reach (@reach.melee); off the canvas: true.
- **Step `unreducibleDamage {amount?, damageType?, to?}`** - damage through `applyDamage(..., {unreducible: true})`: no
  Resistance, Immunity, DamageReduction rules, Wisdom of the Elders or damage shields. Owners only (else the GM line).
- **Event `defeatedByStun`** - fired on an actor newly Defeated by Stun reaching its Health (combat.mjs); watch Triggers hear it.
- **Nanomite gear**: `gearPowerRules(gear)` (the linked Power's rules minus powerUsed Triggers and FreeUse, added to the gear's
  rules in documents/item.mjs#prepareDerivedData) and `gearHolding(actor, power)` (power-used.mjs runs a gear-held Power's
  powerUsed steps with the gear as the item).
- **Defense adjust ctx `armorIgnored`** (dice.mjs -> riderDefenseAdjust -> ignore-armor.mjs): the outgoing ignoreArmor rules
  take nothing off when the attack's Defense was already worked out without armor.

## Behaviour differences worth a decision

- Meat Shield's 18th-level "Resistance to all other damage types" lists acid, blunt, cold, electric, emp, fire, laser,
  poison, psychic, sharp, sonic, stun and void; the choice list is the same 13. The aura shares the temporary Defense only
  (not the 13th/18th Resistance - the book gives that to "you").
- Better You Than Me on an ally the user doesn't own still posts the "for the GM" line, and the GM's Apply is a normal
  (reducible) hit.
- Deconstructionist: when the target is the operator, ALL its tests take the Snag for the turn (the book: tests using the
  equipment) - noted as left to the table.
- Ground and Pound: Free-action Unarmed attacks still aren't limited to the boxed-in target (ActionCost rules can't see
  the attack's target).
- Constrictor: a Maneuver hit marks the target even if the pet then shoves or trips; the squeeze still needs the target
  Grappled at the pet's turn start.
- Beast Mode Alterations go through the Alteration drop handler (its Skill/Essence/Movement dialogs); an Alteration that
  writes stats onto the actor when dropped may leave them when the scene copy expires.
- Nanomite gear: the gear's rules view shows the Power's rules (derived, not saved); an Active Effect on the Power (e.g.
  Protection's always-on +1) is still not carried by gear.
- Shield Upgrade: the recomputes still drop Bypassing's ignoreShield and the defender's Story Point / Defend bonus - existing
  behaviour, not changed here.

## Shared-file edits

- `module/mechanics/combat/combat.mjs` - applyDamage option `unreducible`; Stun branch fires `defeatedByStun` instead of
  `grantNotOnMyWatchReaction`; that import removed.
- `module/items/defenses/not-on-my-watch.mjs` - `grantNotOnMyWatchReaction` and its constants/imports removed (doc updated).
- `module/dice.mjs` - the four ignore-armor recomputes add `ruleDefenseAura` back and set `armorIgnored`; `armorIgnored` passed
  to riderDefenseAdjust; comment at the DefenseAura import.
- `module/rules/plugins/combat/ignore-armor.mjs` - `ctx.armorIgnored` -> 0.
- `module/rules/plugins/resources/power-used.mjs` - a gear-held Power's steps act on the holding gear.
- `module/documents/item.mjs` - gear adds `gearPowerRules` at prep (+ import).
- `module/mechanics/actions/action-perks.mjs` - a stale comment about the WTNV Favorite Command rule.
- `module/rules/plugins/index.mjs` - the book (effects) block at the end.
- `lang/en.json` - `E20.MegaWeaponCreated` reworded.
- Tests updated: combat.test.js, not-on-my-watch.test.js, conv9-slD9 (NOMW Stun + plug-in import), conv14-dice (Catch Off
  Guard, Might Makes Right), conv14-items2 (old Acting! test removed), conv15-banked (Avalanche Stomp), conv15-systems
  (Ground and Pound), conv15-uses (Constrictor, Shaped Charges), conv15-items1 (Beast Mode copies), conv16-LeftA (Growl),
  conversions.test.js (Favorite Command), book-costs.test.js (the costs agent's lead-step lists for Deadstick / Growl now
  include my `require` gates).

## Tests

`module/rules/book-effects.test.js` (19) plus the updated old tests above. eslint clean on every touched file;
`node scripts/check-rules.mjs` 0 errors; full jest suite 7825 passed.

## Unused strings

- `E20.NotOnMyWatchReactionPrompt`
