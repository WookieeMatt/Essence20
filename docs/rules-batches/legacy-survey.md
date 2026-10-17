# Legacy-code survey (2026-10-06)

Every compendium item with no `system.rules` whose `_id` still appeared in non-test module code (1,173 items) was read
and given one verdict: **convert** (the engine can express it exactly today), **piece** (needs a new engine piece),
**data** (the id is only data: a grant list, kit contents, a lookup, a vestigial reference), **permanent** (bespoke UI /
whole subsystem), **dead** (code that cannot run). Per-item results with rule sketches: scratchpad `survey/result-<part>.json`;
per-part write-ups `survey/result-<part>.md`.

## Totals

| Part | Items | convert | piece | data | permanent | dead |
|---|---|---|---|---|---|---|
| dice | 208 | 89 | 102 | 16 | 1 | 0 |
| banked | 150 | 104 | 45 | 1 | 0 | 0 |
| uses | 184 | 49 | 86 | 22 | 26 | 1 |
| systems | 188 | 36 | 105 | 9 | 34 | 4 |
| items1 | 145 | 50 | 72 | 18 | 5 | 0 |
| items2 | 145 | 45 | 63 | 15 | 22 | 0 |
| rest-other | 153 | 24 | 72 | 23 | 33 | 1 |
| **all** | **1173** | **397** | **545** | **104** | **121** | **6** |

Piece names as the survey wrote them: 281 distinct (many are one-item pieces; similar ones should be built together).

## Pieces unblocking the most items

| Items | Size | Piece | Unblocks |
|---|---|---|---|
| 30 | small | powerUsed Trigger event: power-handler#powerCost -> onPowerUse fires the power's own Triggers after its cost is paid (@var.spent = amountSpent; nanomite free switch-off reads a rule toggle) | Dominate, Metallic Armor Power Up, Power Heal, Relentless Blows, Speed Boost, Rapid Morph, Power Shield, Faster Regeneration, ... |
| 15 | medium | ItemModifier effect stage: host-scoped upgrade changes applied inside weaponEffect/weapon prepareDerivedData (where applyToEffect/applyToWeapon run, before totalReach), in code order, able to set strings / null / booleans and step a size ladder | Refined Grip, Reinforced Grip, Automated, Microtech Weapon, Bullpup, Chemical Sprayer, Power Weapon Element Damage Assignment, Biomechanical Weapon, ... |
| 11 | medium | companion recipients (to: companions[:<type>] / owner) + companion-link tags (target:ownCompanion, target:rolledAgainstBy:<partner>, companion:deployedThisRound, companion:docked, companion:adjacent) + companion scope on HitRider | Command & Control, Pack Attack, Constrictor, Acid Sacs, Telemetry Data, Terminal Guidance, Automatic Harmonics, Buzz The Tower, ... |
| 9 | medium | beforeDamage interception Trigger: prompt as damage is about to land; steps can redirect the hit to another actor (protector), change the amount (halve/negate) or convert it to Essence damage | Cyborg, Fe-BURN!, Golden Guardian, Counterstrike, Interpose, Interpose, Body Shield, Heroic Sacrifice, ... |
| 8 | small | item selector by item tags (item: "where:<tags>") + @count.where.<tags> ref | Environmental Weapon (Environmental), Forage, Integrated Specialized Weapon, Multifaceted, Multifaceted, Brainstorm, Inventive Application 1, Inventive Application 2 |
| 8 | medium | grant via the sheet drop handlers (grantPerkOutright / onFactionDrop) + grant every child entry of a picked entry + index tags item:line:<gij/pr/tf/mlp/wtnv> / item:folder~<name> | Animalize, Faction Reservist, Field Promotion, On-The-Job Training, Cybertronian Military, Cybertronian with Attitude, Cybertronian Perk, Factions |
| 8 | small | ActionCost action:any + to:downgrade (one step cheaper) + limit.freeIsUnlimited, and scope marked | A Talent For Generosity, A Talent For Honesty, A Talent For Kindness, A Talent For Laughter, A Talent for Loyalty, A Talent for Magic, Talented, Harmony Unleashed |
| 7 | medium | Drop-time configurator: added Trigger whose stopped run removes the item again; pick a weaponEffect and act on its parent weapon; updateItem formulas reading the target item's own values | Light Chassis, Enhance (Attack), Additional Attack Type, Blast Attack, Increase Essence, Movement Booster, Multi-Limb Attack |
| 6 | small | Story Point grant step (grantStoryPoint {count}: requestStoryPointGrant through the GM relay, honouring canWriteStoryPoints) | We Improvise, Stay Humble, Shoots and Scores, Vibrating Palm, Til All Are One, It's Right There |
| 6 | medium | pickGrant through the item type's drop handler (Alteration: benefit/cost applied, cybernetic/genetic form flag, owned-by-originalId exclusion) | Cybernetic Part, Enhanced Part, Optimized Part, Engrafted Mutation, Evolving Mutation, Outright Mutation |
| 6 | medium | Card damage-apply hook: applyingDamage Trigger in chat.mjs#onApplyDamage (confirm via choose, setVar damage set/reduce/negate, clear secondary, attacker as target, turn/round/encounter limits) | Just a Graze, Fortitude, Extra Plates, Didn't Even Feel It, Hard Corps, Invincibility Through Invisibility |
| 6 | medium | Bonded-partner link scope + tags (bond:linked, partner rank ref, partner within reach) | Synaptic Linkage, Advanced Link, Perfect Link, Armored Connection, Bonded Proficiency, Hit Someone Your Own Size! |
| 5 | small | Defense mode best reads the per-attack Defense value (getDefenseValue with Driving Strike's ignoreArmor + shield-upgrade bonus + the item's own additions), not system.defenses.total | Evasive, Tactical Gymnastics, Split-Second Reaction, Psychological Warfare, Scapegoat |
| 5 | small | ActionCost action kinds personalShield / rouse / analyzeTarget / vehicleRepair (rules/actions.mjs KINDS + ACTION_KEYS) | Quick Shield, Rousing Presence, Quick Study, Swift Study, Quick Fix |
| 5 | small | pickGrant from.notOwned (+ selectionLimit, visible packs only), tested on the recipient | Torozord Feature, Nobody Like Me, Basal Nano Infusion, Intricate Nano Infusion, Profound Nano Infusion |
| 5 | medium | Weapon mutation step/state: per-weapon changes read by the weapon-upgrades overlay (blast add/set, x3 next attack, damage type, added traits, Stun instead, backblast/airburst riders), cleared on a Fumble or after the next attack | Explosive Ammo, Firestorm, Utility Loaders, Backblast, Airburst |
| 4 | medium | Flat d20 substitution (DialogSwitch flatD20: N with a both-d20s option, decided after the dialog against the resolved Edge/Snag) | Dependable, Dependable, Old Reliable, Legendary Dependability |
| 4 | small | attack:unarmed counts the printed Unarmed weapons (UNARMED_WEAPON_IDS), as dice.mjs _isUnarmedWeaponEffect does | Show Of Hands, Empty Hands, Brazen Strike, Smash! |
| 4 | small | Switch-granted damage on a non-weapon roll (DialogSwitch syntheticDamage {value, type}: the roll's rows get Apply Damage buttons x Degrees of Success) | Coax Surrender, Psychoanalyst, Grinder, Deceptive Warfare |
| 4 | small | bank step passes the run actor as granter so GrantDouble (This, I Command) can double a banked upshift | Plan of Action, Inspiring Words, Forward Observation, Plan of Action |
| 4 | small | moveTo step - place recipient(s) at a pickPoint point (optional max range from self) | Checkmate, Teleporting Beam, Ghillie Suit Sniping, Wrist Communicator |
| 4 | small | tokenLight step - set the holder token light {bright, dim, angle} and restore the saved light on the next press (toggle) | Candle, Torch, Headlamp, Candlesprite Lantern |
| 4 | small | consumable pieces: @takeMine ref (the Take Mine multiplier of the rule item) + a lasting actor roll bonus that survives the item being used up (bank {persist, until}) | Med Kit, Automated Repair Kit, Imaginary Corn, Medicine Kit |
| 4 | small | CriticalOption defense: <defense> (1 damage to a Defense, mechanics/combat/essence-damage.mjs) | Bewildering, Traumatic, Maiming, Surgical |
| 4 | small | action-ledger tags/refs: self:actionLog:<namedKey/kind>[:<cost>]<op>n, @ledger.perkUses.<id>, a logged-attack weapon filter (snapShotWeapon) | Snap Shots, Ground and Pound, Here To Help, Desperate Times |
| 4 | small | grantNextTurn gains block / prespend (action-economy#setNextTurn) | Stealth Helper, Subtle Helper, Laughtracting, Distraughter |
| 4 | small | fitUpgrade with a duration (until: rounds:N / endOfNextTurn / scene / untilUsed = removed after the host weapon next attacks) | Kitbash Upgrade, Armament Upgrade, Traps and Obstacles, Grid Connection |
| 4 | medium | Shape-change state as rule data: a shapeChanged event / shape mark that several items (Shape-Shift, Face-Shift, Master Morph, Size-Shift, spells) add picks to and read | Face-Shift, Master Morph, Size-Shift, Shape-Shift |
| 4 | medium | Megaform participant contributions: Defense counted as armor bonus on the Megaform, keep-together defeat hold, Specialization merge, Energon donor for the Combiner | Armored Defense, Keep IT Together!, Better As One, Hardened Chassis |
| 4 | small | ActionCost kinds reload and morph (+ per-weapon limit for host scope) | Rev Morpher, Rapid Reload, Rapid Reload, Ammo Belt |

## Bugs found in the current code (need a fix or a ruling)

- **Dino Thunder Boost / Extra / White Ranger Uses do nothing**: they pay and set `d1DinoThunderActive` / fire
  `essence20.dinoThunderActivated`, which nothing reads; the real effects key on `zord1DinoPower`.
- **Fighting Style Careful (+2) / Defense (+1) count twice against attacks** (in the Defense total, then again in dice.mjs).
- **Augur gets Anti-Tank** (treated like Ram Cone); the Perk only grants Armor Piercing.
- **Engine `heal` step doesn't clear Defeated**; the old heal-skill-test code did (Nano-Med Mastery too).
- **Exploit Weakness** mark never cleared ("for the scene"), and any roller - the target's allies too - ignores its armor.
- **Didn't Even Feel It**: once-per-encounter checked on the holder, marked on the target (never spent when redirected).
- **Expertise** id check ignores `flags.core.sourceId`, unlike the rest of dice.mjs.
- **Gang Up** counts the attacker as the nearby Psycho Path character.
- **Try, Try Again / Arashikage Graduate** may bank on rolls with no DIF (the all-failed check passes on an empty list).
- **Augmented Combat / Codename Jolt** share one flag, so toggling one toggles both.
- **weapon-traits.mjs** adds Temperamental from a weapon flag without checking for the Perk.
- **Kitted Out**'s kit re-specialize option is offered on every kit to everyone; **Pinpoint** on every ranged attack, not only
  when Aiming; **Manifest Enhancement**'s once-per-round isn't enforced; **Command & Control** has no range check.
- Never-expiring / never-cleared: Mass Shift's reach flag, Nemesis Drain's penalty, Words Can Hurt's immunity, Whatever We
  Need's Edge, Extra Rough Training's mission flag, Flight Conversion outside its combat, Mobile Mode, Swiftness.
- Dead code: dice.mjs `pendingAngrySnag` (never set), `BOND.linkLock`, `COMP.attackMlp` and a few other never-read
  constants; `markPsychoStrikeSnag` only called by its test.

## Code disagrees with the item notes / book (rulings needed - the conversion keeps the code's behaviour)

Penetrating Shot (adds damage, no Personal Power - notes: upshift costing Power); Just a Graze (per round vs per turn);
Faster Regeneration (per encounter vs per scene); Weapon Implant (no limit vs once per scene); Dig Deep (one roll vs end of
next turn); Trade School (one roll vs scene); Box Shot (until clicked off vs next attack); Animal Gait (one movement type vs
three); Martial Leadership (Snag vs down-1); Green (automatic vs a switch); Remote Operations (whole combat vs this turn);
Preventative Measures ("per day" = calendar date); Thermal Scope / Skybound (promised effects missing); Meat Shield (13th /
18th-level parts missing); Primeon Blade (element vs Energy damage); Deconstructionist (any target vs vehicles); Extended
Attack (no Move cost / expiry); eight Perks' action costs never charged; several "while Morphed" gates and seven Condition
durations missing. Full detail per item in each part's result-<part>.md / the round-14 write-ups.

## Other

- Many dice.mjs comments quote rulebook text verbatim - worth trimming to paraphrase.
