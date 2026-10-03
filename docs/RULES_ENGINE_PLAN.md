# Essence20 Rules Engine — Design Plan (v6.1)

Goal: let any item in the game be **built in the system**, not in code. Today an item's behaviour
lives in a hand-written helper keyed to its compendium id; a homebrew Perk, or a copy of a book
Perk with one number changed, gets nothing. The rules engine moves that behaviour onto the item
itself as data: a list of typed **rules**, edited in a Rules tab, run by one interpreter that
plugs into the hooks the system already has.

This is the same idea as Pathfinder 2e's Rule Elements, sized to Essence20.

> **Target: Foundry VTT v14.** Phase 1 (the engine) is built on branch `Rules-Engine-Phase-1`; see §0a.
> Status of the measurements below: 2026-10-01, against the `30-remaining-still-open-items`
> tree (d24837739).

---

## 0a. Status: Phase 1 (2026-10-01)

Built on `Rules-Engine-Phase-1`, branched from `30-remaining-still-open-items`. It has unit tests but has not been tried in a live world yet. No pack item carries rules yet.

| File | What it is |
|---|---|
| `module/data/item/templates/item-description.mjs` | `system.rules`: an `ArrayField` of `ObjectField`s on every item type except Specialization |
| `module/rules/predicate.mjs` | The `when` language: `TAGS`, `evaluate` (true / false / null), `isStatic`, `{choice.x}` interpolation |
| `module/rules/formula.mjs` | The whitelist formula parser: `@level`, `@essence.x`, `@pool.x`, `@choice.x`, + − × ÷, min / max / floor / ceil / abs |
| `module/rules/types.mjs` | The type catalogue: validator and plain-English summaries |
| `module/rules/index.mjs` | The per-actor rule index, rebuilt in derived data and cached on the actor; when an item counts as active |
| `module/rules/adapter.mjs` | One registration into `helpers/extensions.mjs` for every hook the Phase 1 types use |
| `module/rules/lifecycle.mjs` | When an item is added: ChoiceSet prompt, Toggle default, Pool filled, Grant items. When it is removed: the items it granted are removed too |
| `module/rules/sheet.mjs`, `templates/item/tabs/rules.hbs`, `sass/views/_rules.scss` | The Rules tab: summaries, errors, live toggle / pool / choice state, Add rule, JSON editor |
| `scripts/check-rules.mjs` | Validates every pack rule; added to the unit-test CI workflow |
| `module/rules/rules.test.js` | 34 tests |

**Types built:** RollModifier, DialogSwitch, Reroll, SkillSubstitution (`replace` / `bestOf`, wildcard `from`), Defense, DerivedStat, DamageModifier (dealt / taken), Grant, Toggle, Pool, ChoiceSet, and Code (validated and summarised, not run yet).

**Scopes built:** `self`, `incoming`, `host`.

**Different from the plan below:**

- **One catalogue file.** The types live in one `types.mjs`, not one file per type. They are small enough that one table reads better. They can be split when Use and Trigger arrive.
- **Unknown conditions become switches.** For a RollModifier whose condition is unknown (an `ask:` tag, or a tag this version doesn't recognise), the engine offers a Roll Options Dialog switch, off by default. That gives §5.1's rule, "unknown means ask", without a separate mechanism.
- **Defense and DerivedStat split on their condition.**
  - If the condition only reads `self:` or the situation, the rule applies in derived data, shows on the sheet and adds to the `.string` breakdown.
  - A Defense whose condition reads the roll applies per attack through `defenseAdjust`.
  - A DerivedStat with a roll condition is skipped.
- **Where `incoming` tags point.** In an `incoming` rule, `self:` is the defender carrying the rule and `target:` is the roller.
- **Deferred to a later phase:**
  - Qualification, which needs the qualification helpers reshaped first.
  - RollModifier `immune` and `autoSuccess`, which need a hook after the sum is taken.
  - DialogSwitch's numeric input.
  - Granting a condition or Active Effect while the item is active. Grant adds items only.
- **Pools reset** on the existing scene, mission and rest hooks. Until Use arrives in Phase 2, they can only be spent from the Rules tab.

### Overnight build, 2026-10-01/02 (Phases 2–3 and the editor)

**Phase 2: buttons and triggers**
- **Use** (`rules/triggers.mjs`): an item's Use button. It checks a condition, a limit and a cost (an
  action, then a resource), then runs steps. It plugs into the same `registerUse` path the
  hand-written buttons use; an item with several Uses asks which.
- **Trigger** events: turnStart, turnEnd, roundStart, rest, sceneStart, missionStart, takesDamage,
  wouldBeDefeated (its steps can change the damage), defeated, morph/unmorph,
  transform/untransform, afterRoll, hit, miss, added (the item joins an actor) and conditionGained.
  `prompt` asks first.
- **Steps** (`rules/steps.mjs`):

  | Group | Steps |
  |---|---|
  | Messages and resources | chat, spend (onFail), gainResource |
  | Health and conditions | heal, damage, applyCondition, removeCondition |
  | Rolls and choices | roll (onSuccess / onFail / onCrit), choose, target |
  | Items, bonuses and actions | grant, bank, grantActions, setToggle |
  | Damage, inside damage events | negateDamage, leaveAt |

  Each step can carry `to: self | target | targets` and its own condition. Writes to actors the user
  doesn't own go through the GM relay.
- **Banked bonuses** (`rules/bank.mjs`) are spent at roll time, next to `clearPendingBonus` in
  dice.mjs, so plain rolls with no target spend them too.
- **Limits** (`rules/limits.mjs`): per turn, round, scene, encounter, mission or rest; a shared `key`
  lets items share one limit.

**The guided editor** (`apps/rule-editor.mjs`, `rules/editor-spec.mjs`, `rules/editor-render.mjs`)
- One form per rule type in game words, with dropdowns, a condition picker (with suggestions), and
  step lists you can nest, reorder and remove.
- Drop an item onto it to fill an item field. The live summary updates as you type.
- Save validates first and only writes when the rule is clean.
- Add and the pencil on each rule both open it; JSON is now the "advanced" option.

**Phase 3: the rest of the language**
- **Scopes** (`rules/links.mjs`): `crew`, `pilot`, `vehicle`, `companion`, `owner`. They work for
  roll modifiers and switches, skill swaps, Defense, numbers and damage.
  - The lookup is skipped entirely unless some actor holds a linked rule.
  - The Party scope is not built yet; nothing in the sample needs it.
- **Durations** (`rules/expiry.mjs`): `until: endOfTurn | endOfRound | scene` on `setToggle`, `grant`
  and `bank`. Granted items are swept when they expire.
- **New tags:**
  - `vehicle:crew` and `vehicle:driving`
  - `ally:within:N` and `enemy:within:N`
  - `scene:name~text`, `terrain:<biome>`, `terrain:wild`, `environment:<env>`
  - `item:element`, `item:damageType`, `attack:unarmed`
  - `roll:shove`, `roll:downshifted`
  - `self:` / `target:name~text`
- **RollModifier `immune`** (snag, downshift) applies after the dialog.
- **Stacking groups** (`stack`): only the strongest in a group counts. They work for roll modifiers
  and Defense.
- **ActionCost** (`rules/actions.mjs`): "Sprint costs a Free action once per turn". It comes through
  a new `registerCostRuleProvider`, so the action economy offers, limits and logs it like its own
  cost rules.
- **Not yet built:** the Party scope; ItemModifier, Sense, SurpriseExemption, Aura, MovementAction
  and Qualification; `@count` / `@spent` formulas; Lend Assistance and marked-target events.

**Conversion batches 2–4**
- **Batch 2, Use buttons:** Calm Hearted, Able To Adapt, Capable of Anything, The Nine Hand Seals,
  Rightful Place. Able To Adapt and The Nine Hand Seals now charge the Free action their own notes
  say they cost.
- **Batch 3, Night Vale roll switches:** Community Martial Arts, Vehicle Whisperer, Acute Senses,
  Nobility, Gridlock Authority. Only the switch half of each converted; Community Martial Arts'
  dice code, Gridlock Authority's Contacts part and Nobility's Use stay code for now.
- **Batch 4, Night Vale riders:** Chunky, In the Rain.

**Conversion batches 5–9** (Phase 4, overnight)
- **Batch 5:** Scientific Method, Animal (×3), Mind Like a Steel Trap, The Road Calls, Public Television.
- **Batch 6, My Little Pony:** Honorary Apple, Hand Axe, Handsaw, Net, Snare Trap, Hard Habit to Break,
  Hidden in Plain Sight, Mired in Academia, Acute Sense, Bad with People, Jarring, Wanderlust, Competitor.
- **Batch 7, Transformers and GI Joe:** Second Skin, Brutish, Once a Marauder, Broadcaster (Perk),
  Petrolhead, Bootlicker, Collection of Secrets, Storage Compartments, Hindsight, Mimicry Vocoder,
  Nose for Trouble (TF), Subordinate, Tow Cable & Hook, Water Cannon. Also Chemist (Hang-Up).
- **Batch 8, Transformers 2:** Acute Sense, Caterpillar Tread (new tag `self:canTransform`),
  Supporting Cast, Distressed, Earthspoiled, For The Allspark!
- **Batch 9, GI Joe 2:** Acute Sense (a switch), Enhanced Sensors, Nose For Trouble, Swerve!, Diver,
  Earth Defense Command (its zero-G half), Every Trick in the Book, Thermal Scope.
- **Batch 10, Power Rangers:** Can't Catch Me, Clawed Armor, Lightspeed Rescue Injector, Phantom
  Ranger Prime, Power Wing, S.W.A.T. Upgrade, Warzord, Xeno-Location Study, Cloud Hatchet, Mobile
  Headquarters, Time Displaced, Privileged, Keen Eye, Graphite Ranger Prime, Vast Wealth, Eltarian
  Camouflage, Morphin Navigator. Packs rebuilt after this batch: 104 rules on 89 items.
- **Engine changes found along the way:**
  - A `session` limit window, counted against the Story Points app's New Session.
  - Story Point costs in steps now check `canSpendForActor` first and then spend; the old path
    always failed because `requestStoryPointSpend` returns nothing. Gains go to the actor's own pool.
  - Step formulas are validated; `heal` never lowers Health; dice passes `rolledEssence` so
    `essence:` tags work in Specialization rules.
### Rest of Phase 3, 2026-10-02

Everything Phase 3 listed as not built yet is now built, except the optional skill swap as a switch
and the numeric dialog input.

- **New rule types:**

  | Type | What it does |
  |---|---|
  | SurpriseExemption | Act normally while Surprised, keep a Move action, or act with Speed equal to level. |
  | Sense | Darkvision to a range (a formula), offered alongside items' own vision. |
  | MovementAction | Ignore Rough Terrain; Push Yourself further per Free action, or with no limit. |
  | ItemModifier | A number on the actor's other items, picked by `item:` tags. |
  | Qualification | Trained or Qualified for Requisition, picked by `item:` tags. Only widens access. |

- **New scopes:**
  - `party`: everyone else on a Party roster with the holder.
  - `aura`: needs `radius` (feet) and `affects` (allies / enemies / all). A token moving re-prepares
    its scene's actors, so sheet numbers follow, but only while someone there holds a linked rule.
- **New tags:**
  - `self:data:<path><op><value>`, `target:data:...` and `item:data:...` read any stored value.
  - `item:name~`, `attack:ram`, `self:marked:` / `target:marked:`, `self:recklessAbandon`.
  - `assist:skill` / `assist:attack`.
  - `{item.choice}` reads the item's own `system.choice`.
- **New steps:** `mark` / `unmark`. A `spend` may let the player pick the amount (`amount: {min, max}`),
  which sets `@spent`.
- **New formula references:** `@skill.<key>.rank`, `@spent`, `@var.<key>`, and
  `@count.allies.<ft>` / `@count.enemies.<ft>`.
- **New events:** `lendAssistance` (on the helper) and `assisted` (on the ally).
- **Other changes:**
  - Switches in one `stack` group are alternatives: only the biggest ticked one applies.
  - `limit.onlyOnSuccess` uses up a limit only when the run's last roll succeeds.
  - ChoiceSet can take typed text (`from: 'text'`), and labels can fill in `{choice.x}`.
  - A Hang-Up ignored through Matured has no rules.
- **Items converted with these:**
  - Security, Unsurprising and Ready For Anything (SurpriseExemption). Their ids are gone from
    `actor.mjs`.
  - The movement halves of Over the Candlestick, Sewer Tunneler, Urban Jungle, Hard Tread Wheels,
    Clawed Feet, Earlier is Better Than Later and Burn Rubber (MovementAction).
- **Batches 11–16:**
  - other1: Distill His Essence.
  - other2: Pit Plate.
  - other3: Dazed, Naive, Dr. K's Modified Morpher, Gluten-Tolerant, What Cover?
  - zord: Plated Carapace, Titan Frame, Dozer Blade, Adaptable Future Tech.
  - react / fix3: Martial Artist ×2, Object Alt Mode, Surgical Operators, Mega Training Regimen,
    One With Your Weapon. `fix3-prmlp` is gone.
  - sit2: Stumble Through the City, Bookworm, Tracking Outfit, Stubbornly Loyal.

### Second conversion pass and Phase 5, 2026-10-02

- **Second pass over the skipped items** with the new features: 3 + 8 + 10 + 11 more items, including:
  - Bullbar, Dragon Dagger, Student, Not From Around Here (Hartunian), The Returned and Siren;
  - Champion His Way, See Through Him and Path of Stone;
  - Mastery Power, Spell Focus, Fool Me Twice, Traveler, Return In Kind, Trade Experience, Means To
    An End, Cover Job and Double Life.

  Total: **189 rules on 146 pack items**.
- **More tags:** `weapon:` (the weapon a rolled effect belongs to), `$path` comparisons in data tags,
  and `default: true` on a RollModifier switch that has to ask.
- **Picks kept** (`rules/legacy-choices.mjs`): six items that stored their own picks now use
  ChoiceSets. The GM's linking pass copies the old picks into the rule choices, without overwriting
  any choice already made.
- **Name-linking made safer:** a copy whose own compendium original still exists is no longer linked
  to a same-named item. Only homebrew, world-made items and copies of a removed duplicate are.
- **Phase 5:**
  - Every id lookup in the hard-coded code accepts `flags.essence20.rulesSource` as a last fallback.
    That is 186 lookups in 105 files, changed by a codemod, so an item with no source of its own still
    works.
  - The Rules tab has an **Acts as** box on such items. Drop a compendium item on it, and the item
    runs that book item's rules and everything hard-coded for it. A real copy is its book item
    already, so it isn't offered there.
  - Multi-line lookups the codemod's patterns didn't match still only know the real source.

### dice.mjs conversions, 2026-10-02

- **Batches:** dice1 to dice4, plus dice2b and dice4b. That is about 95 more items whose code lived in `dice.mjs`, with their ids, blocks and tests removed.
  Total: **316 rules on 256 pack items**.
- **Engine fix:** `_getAutomaticCombatModifiers` used to return early for a non-attack roll with a target. That return came before the per-target riders, so item rules, incoming rules, banked bonuses and limits never applied to such rolls. Earlier conversions such as Animal were affected too.
  The riders, Fanatic and the result are now a `finish()` closure called from both returns. A regression test is at the end of `dice.test.js`.
- **Done after that:**
  - **Dialog-checkbox pass:** Machinist, Bootlicker, Good Society, Tongues, Hunter's Prowess, Cube Player, Wealth, Beast of Burden and Charge.
  - **All-Around Vision:** the user approved switching it on. It never showed before, because it's a nanomite power and the check only looked for Perks.
  - **actor.mjs pass:** Personal Power Supply, Fireproof, Mind Palace and Overprotective Upgrade. Movement and Energon items stay code, because the order they're computed in matters.
  - **Wheel Struggle:** now a rule (`vehicle:crew` + `not:vehicle:driving`). The old code looked up a Hang-Up with the Perk-only helper, so it never fired.
  - **New tags:** `self:wearing:<class>`, `self:wearing>=<class>` (equipped armor) and `rule:data:<path>` (the rule's own item).
- **Afternoon, 2026-10-02:**
  - **target-riders / combat batch:** Grid Champion, Bot-Hunter, Frag It, Earth Defenders, Air Supply and Knock, Knock! in full; Machinist Revolutionary, Monster Hunter, Tough Enough, Stone Warlord and Frost Warlord in part.
  - **New rule type: ConditionImmunity**, with aura support. The Condition-immunity table moved onto 17 items, including Battlefield Titan as a 10 ft aura. The ones that read a stance or buff state stay code.
  - **Engine features from the code survey:**
    - Upgrades that change their host weapon's effects (`item:isHost`, `item:onHost`).
    - `@actor.` and `@item.` formula references.
    - Role Points as a resource.
    - A roll step against the target's Defense (`difDefense`).
    - Allies or enemies within range as recipients.
    - `{choice.x}` item ids for Grants.
    - The events `combatStart`, `combatEnd`, `initiativeRolled` and `storyPointSpent`.
    - An `askNumber` step.
    - `roll:untrained`, `vehicle:moves:` and `immune: ["untrainedSnag"]`.
  - Total at that point: **372 rules on 296 pack items**.
- **Later the same afternoon:**
  - **Banked-bonus Use buttons:** 12 items.
  - **Action costs** (`action-perks.mjs`): 36 items.
  - **Perk grants** (`perk-handler` / `lend-assistance` / `team-buffs`): 23 items. `chosen-specialization.mjs` was removed as dead code.
  - **Vehicle upgrades:** 35 items, covering traits, Defenses, crew and incoming modifiers, Redundant Backups and All-Terrain Wheels.
  - **Engine:**
    - `pickGrant` step.
    - Story Point gains refuse when no GM is connected.
    - Incoming roll modifiers now honour their use limits.
    - `findSourced` no longer matches every unsourced item when an id is missing. That fixes Balance Your Enthusiasm, which made Curb Your Enthusiasm a Move action for everyone.
- **Evening, 2026-10-02:**
  - **Powers / Princess Perks / Monster Form:** 21 items. 12 helper modules became dead and were removed.
  - **Weapon upgrades:** only Fluid Motion converts. ItemModifier now records what it changes in `system.upgradeTouched`, so saving the item sheet doesn't write the derived number back. The rest are blocked because an upgrade's rules switch off when its weapon is unequipped, and by the order the overlay applies its changes.
  - **Once-ever grants:** Spotter's Scope, Customized Armor and Y-Series Weaponization. They use a never-expiring toggle, and also read the old `granted` flag.
  - **Unblocked items:**
    - 18 Story Point grant Uses.
    - JAFF and Tricked-Out Hydraulics.
    - 12 untrained-Snag immunities.
  - **Engine:** a Use that stops with nothing to say posts no chat card.
  - **Lint:** the project lints with `--ext .js,.mjs`. Earlier runs without it had skipped every `.mjs` file; 27 leftovers were fixed.
  - Total at that point: **576 rules on 456 pack items**.
- **Late evening, 2026-10-02:**
  - **New rule type: AttackCount** (attacks per Attack action, whose condition also filters the chained attacks).
    Converted: Extra Attack ×2, Rough and Tough, Bang Bang, Bang Bang Bang, Throwing Lead, Blink of an Eye and the Zord Extra Attack.
  - **New step: `bonusAttack`.**
    Converted: Shoot First, Fight or Flight, The Hits Keep Coming, Ambush Predator, Mayhem Attack, Surface Invasion, Follow Through and Triple Strike Attacks.
  - **New tag: `vehicle:type:<zord|vehicle>`.** Zord, Phantom Ship and Quantasaurus Rex get untrained-Snag immunity while driving a Zord; Torozord gets Snag immunity.
  - Total at that point: 596 rules on 472 pack items.
  - **New rule types: WeaponTrait** (traits on the actor's matching weapons) **and Hardpoints** (extra slots, slots per weapon, Reinforced fire).
    Converted: Demolisher, Big Lobber, Fireball, Armament, Experiment (its hardpoint option), In Case of Emergency, The Fiercest Among You, Quick Draw, Gun Runner and Titan Hardpoint Upgrades.
  - Total at that point: 606 rules on 479 pack items.
  - **New rule type: CriticalOption**, which either adds a Critical Effect option or improves the damage ones by a step.
    - New tags: `item:own` (attacks with the rule's own weapon) and `target:within:N`.
    - Converted: Mauler, Arm Claws, Chest Blast, Blazing Strikes, Machinist Revolutionary's and Monster Hunter's critical halves, and Ravaging Critical (two improve rules in one stack group).
  - Total: **614 rules on 484 pack items**.
  - **Code survey of the helper files:** in the session scratchpad (`rules/hsurvey/out-*.tsv`).
    - 1,102 ids across 197 files.
    - The biggest remaining gaps: a pick-and-grant step (~30 items), Critical Effect options (~8), weapon-alteration overlays (~11), a save-card step (~7), damage redirect (~7) and assist eligibility (~15).
- **Afternoon, 2026-10-02 (round 12 and the Defeat saves):**
  - Round 12 batch applied: Armor Expert, Poison Resistance, Push Through Pain, Spark of the Ancients, Who Dares Wins,
    Student of Divine Manuals, Projectile Dancer, Static Slide Inhibitor, How I Got These Dents, and Pressure Cooker (in part).
  - **`wouldBeDefeated` moved:** it now fires inside `combat.mjs#applyDamage`, first in the Defeat-save chain,
    after immunity and every reduction (it used to be a damage modifier, so it ran before Elemental Shield / Dig Deep).
  - **New tag `damage:crit`; new step `setForm`** (Morph / Alt Mode on or off).
  - Converted Defeat saves: Avoid The Inevitable, Do Not Go Quietly, Renegade Commander, Rise Again (its Defeat half),
    It's Morphin Time! and Let's Go Psycho!.
  - **New step `save`** (a save card, `helpers/save-riders.mjs`), new recipients `all:<ft>` and `targetOrSelf`.
    Converted: Power Quake and Sorcerous Tremors.
  - **Trigger outcomes:** `outcome: success` now takes a Critical Success too, and `failure` takes a Fumble.
  - **Linked Triggers:** a Trigger with a linked scope (aura, party, vehicle, crew, pilot, companion, owner and the new
    `driven`) fires for the actor it reaches, never for its holder. Its limit counts on the holder.
    - The new `driven` scope is a rule on a vehicle's driver that changes the vehicle.
    - Converted: We All Go Home Or Nobody's Going Home and Baby Hold Together.
  - **New rule type `Assist`** {side: give|receive, effect: refuse|anyRank}, read by `lend-assistance.mjs#canAssistWithSkill`.
    - Converted: Conniving, Skeptical, Show Off, Greenshirt and Acrobatic Outlook (Hang-Ups), Walk Them Through It,
      and the eligibility halves of Many Minds Make Light Work and Ship's Crew.
    - Ship's Crew now counts aboard a Zord too, since it reads `vehicle:crew`.
  - Total at that point: 643 rules on 512 pack items.
  - **Spells:**
    - afterRoll Triggers on the spell's own item (`item:own`, `outcome: success`) converted Healing Bandages,
      Bellowbreath, Big Honking Boom, Lullaby and Flower Power.
    - `hit` / `miss` Triggers now fire for a spell cast against a Defense too (each target, as `target`).
      That converted Smoke Beam, The Stare, Rope Trick, Shower Power and Super Sticky Celebration String.
  - **Assist**, in more detail:
    - effects `boost` {atLeast, extra, edge}, `anyRange` and `self`, plus the tag `roll:outranks`;
    - converted Putting Others Before Yourself, Psychological Sway, Better Together, Armchair General, Bureaucrat,
      Greenshirt, Teacher, Lesson Plan, Treacherous, Lackey and One Pony Show.
  - **New tag family `holder:`** (the actor whose item a linked rule is on) and `holder:protects`. Converted Defender's Oath (an aura Trigger).
  - **New rule type `AlternateEffect`** feeds `weapon-upgrades.mjs#desiredGeneratedEffects`. It also adds the formula ref `@base.<path>`.
    - Converted: Nonlethal, Strobe, Covering, Heavy Hitting, Folding Stock, Manipulative, Tracer Rounds, Big Swing,
      Pistol Whip and Specialty Flexibility.
    - The other3 sync is gone. Its old effects (`o3GeneratedKey`) are adopted under the same keys rather than made again.
  - Team Player no longer pays out for a Help Yourself clone's assist.
  - Total at that point: 681 rules on 544 pack items.
- **Evening, 2026-10-02:**
  - **Batches applied:**
    - qualify (If It Shoots..., plus 6 partials);
    - grants2 (Grid Power, Altered Pet, Bowl-Over MLP, Prowl, Perch, Agreeable in part);
    - perkadd (Battlizer Access ×2, Speak Your Truth, Natural Science and Sorcery in part; `helpers/speak-your-truth.mjs` deleted);
    - banked2 (Think On It, Auxiliary Brain, Street Smarts, Brutish, If I Recall Correctly, Trick Shot, Hidden Whispers,
      Mind of No Mind, Can't Afford to Miss, Grid Gifted).
  - **New engine pieces:**
    - **Steps:** `pickAlly` (the targeted ally, else a picker over `getNearbyAllyTokens`; `pickAllyTargets` moved to
      `helpers/allies.mjs`) and `pickPerk` (`grants.mjs#pickPerkFrom`, a Perk from another Role / Focus / the Branch).
    - **`bank` Defense bonuses:** `defense` / `defenseBonus` / `persist`, read by `rules/bank.mjs#bankedDefense` in `dice.mjs` beside
      `riderDefenseAdjust`.
    - **Tags:** `rule:banked` (an unspent bonus this item banked); `item:availability<=tier`, read against the effective tier via
      `adapter.mjs#requisitionTier`; `item:id:<_id>`.
    - **Qualification `upgrades`:** read by `adapter.mjs#ruleQualifiedUpgrade`, which both qualify slices' `isQualifiedUpgrade` ask.
    - **Use costs** may be paid in Role Points.
  - Total at that point: 716 rules on 567 pack items.
- **Night, 2026-10-02 (Phase 4 continued, overnight):**
  - **Batches applied:**
    - grants3: Cross-Training ×2, Split Focus, Branch Perk, Grid Spectrum Echo, Prismatic Boon.
    - qualify2: Standard Weapon Training, Minimalists, and the upgrade halves of six more.
    - banked3 and banked4: ally banks, ally heals, Defense banks, Bait and Switch, Menacing Laugh, Wild Tales, Heart of the
      Team, You Got This!, Sword And Board, and others. `helpers/wild-tales.mjs` is deleted.
    - tf2 and zord2: Electro-Disruptor, Dominant Thought, Combat Nunchaku, Excalibur; Obscuring Matrix and Roller Drum in part.
    - Bestial Articulation, as a switch on each Monstrosity Alt Mode.
  - **Aiming:**
    - The Aim double-count is fixed. Taking the Aim action now pre-ticks the dialog's Aiming switch; the separate automatic ↑1 is gone.
    - `roll:aimed`, the `AimBonus` type, and DialogSwitch `replacesAim` / `cost`.
    - Converted: Distance Vision, Dig In (its Aim half), Calculated Attack (`calculated-attack.mjs` deleted), In My Sights (GI Joe;
      its old switch was never rendered), Unshakeable Aim, Long Shot, Sharpshooter's Grace ×3 (`immune: ["longRangeSnag"]`).
  - **Crit on the d2:** the `CritOnD2` type and `roll:edge` tag, used by Piercing Shot ×2, Assault Precision, Coin Toss, Ripple Effect,
    Forward Observation (TF), Let Cool Heads Prevail, Miracle Worker, Technical Mastery (direct half), Perimeter Defender ×2,
    Fancy Flier, Eureka (`skill:choiceOf:<uuid>`) and Competitive Strength (Brawn).
  - **Other engine pieces:**
    - **Steps:** `pickAlly` (`includeSelf`, `all`, and it runs before the cost is paid); `heal` with `temporary`; `roll` with `edge` / `edgeWhen`.
    - **Durations:** `until: nextTurn` / `endOfNextRound`.
    - **Banks:** a list of Defenses for one bank.
    - **Resources:** Role Points by name.
    - **Tags:** `rule:altMode`, `markedBy:` / `markedByMe:`, `specializedIn:`.
    - **Grants:** they now bring a weapon's or armor's attached items, and `grant` / `pickGrant` take `flags` / `system` overrides.
    - **pickPerk:** `notAdvanced`.
  - **Fixes:**
    - Prismatic Boon no longer offers Advanced Roles.
    - I Got You's ↑1 now lands; it banks through the rules bank, where before nothing consumed it.
    - Battlizer Access and Natural Science automation notes reworded.
    - Firefox's solid-panel sheet bug: the `mask-border` fallback.
  - Total: **809 rules on 641 pack items**. Packs rebuilt 22:33.
- **Night, 2026-10-02/03 (Phase 4 engine pieces, Phase 5 gaps):**
  - **Engine:**
    - DamageModifier `scaled` (dealt): joins the attack's own damage bonus, so Degrees of Success multiply it
      (`adapter#ruleScaledDamage`, summed into `damageBonusValue`).
    - DialogSwitch `damage` (ticked: added to that bonus) and `useSkill` (ticked: roll that Skill's die instead, as the
      shift difference - the optional die-substitution checkboxes).
    - Initiative reads item rules: `roll:initiative` RollModifiers, DialogSwitches, limits and banks.
    - Trigger hit / miss fire for any roll against a target, not only attacks; a Use's `roll` step carries its item.
    - Trigger outcome `double`: a success by double the DIF (or a crit).
    - `Cover` rule type: ignore / reduce on the holder's attacks; counts-as-Cover / base / add against the holder.
    - Tags `self:` / `target:sizeDiff>=N`; formula `@size`.
    - `ally:within` (and pickAlly, `@count.allies`) count allies the system way: Frenemy, Betrayal, Ally Awareness.
    - `fitAttack` step (Alt Mode special attacks: damage, Blunt/Sharp, Finesse/Might), `helpers/weapon-fit.mjs`.
  - **Fixes:**
    - Exploit Trust and Hard Hitter's Edge never applied: it was set after the dice were picked. Now set before.
    - Phase 5: ten id lookups that missed the "Acts as" fallback now have it (Quantum Defender, Drilling Shot,
      Augmented Hang-Up, Avalanche Stomp, Expertise, the any-General-Perk and Nano Infusion grants, Metamorphosed
      Changeling, Morphin Time, and a homebrew Role's Focus check).
  - **More engine, later that night:** DialogSwitch `forget`, `spend` (a number box, `@spent`), and its `limit` is
    now used up when ticked; bank `damage`; `check:<name>` tags answered by the system's own helpers
    (`CHECK_NAMES` in rules/predicate.mjs, registered in essence20.mjs); `@target.size` / `@target.<path>`;
    `roll:snag`, `roll:dataset:`, `roll:specialization~`, `combat:first`; Initiative reads `specialize`;
    `gainResource` on a `.value` path stops at its `.max`.
  - **Batches applied:** dmgA, dmgB, dmgC (damage-bonus terms), init (Initiative), subst (die substitution),
    cover, move (all Movement Perks, Wildfire included), misc6 (combat / item / chat), misc7 (newly unblocked).
    Each batch's `why` lines in its proposals file record the small behaviour differences.
  - Total: **1205 rules on 880 pack items**. Packs rebuilt 2026-10-03 00:19.
- **2026-10-03, cloud round + engine pieces:** regA/regB/regC ran as cloud sessions (docs/RULES_CONVERSION_GUIDE.md,
  per-batch notes in docs/rules-batches/) - 1254 rules on 912 items. Then, for their skip lists: Trigger outcomes
  x2/anyFailed/allFailed/fumbled; notActed / aheadOfTarget / highestInitiative / levelDiff tags; DieSubstitution and
  RollDice types; Defense modes best/halve/fail, outgoing and limit; late RollModifiers; ally auras counted the
  getNearbyAllyTokens way with non-stacking stacks:false; Cover aura scope; DialogSwitch key (roll:switch:) and steps;
  DamageType; scaled-damage limit/steps; loseHealth; eight more check: names; roll:specialization=. The guide lists them.
- **Known issues, noted for later:**
  - Two Steps to the Right: its allies-within-60 ft Cover/Edge share needs an aura that counts allies the
    getNearbyAllyTokens way (Frenemy, Betrayal, Ally Awareness).
  - Pressure Cooker's Moxie Edge forces Edge over a Snag; a DialogSwitch Edge cancels against it instead.
  - Flux Additives' free action now comes after the roll (an afterRoll Trigger), not while the dialog opens.
  - Two "roll X instead" switches ticked together: only the first counts (Explosive Engineer, Cobra Battle Cry,
    Spoof, Rapid Deployment Drills used to add both).
  - Still code for want of an engine piece: interpose.mjs damage redirects, sneak-attack.mjs eligibility,
    prompt-and-limit damage reductions, Defeat-save flag writes, turn-order tags (Oorah!, Goin' Heels), the
    core Ram size bonus.
  - Pinpoint (ignore N Armor Upgrades) and Drilling Shot (ignore Defense bonuses) need a Defense-side rule piece.
  - Spell save cards post on any successful cast; before, a cast whose attacks all missed posted none.
  - Several conversions change small edge cases, each recorded in its proposals file: banks stacking instead of overwriting,
    the `combat` tag meaning a started combat, and the GM relay for unowned allies.
  - Movement Perks (Fast, Bulwark, Sprinter...) need a rule phase inside `_prepareMovement`, before climb/swim derive
    from ground and before the doublings and gravity; a plain DerivedStat lands too late.
  - Defeat saves still in code: Immortal Rebel Soul (it shares its use with the Essence half), Life Supporting
    (recharge), Defender's Oath (needs the protected-target link), Not Done Yet and Aegis (they share flags with
    reckless-abandon.mjs), and We are the Coinless (it asks the rescuer).

- **Left for later (superseded above):**
  - A dedicated pass for the simple dialog-checkbox Perks. Several batches would edit the same five expected-dataset fixtures in `dice.test.js`, so it should be one pass.
  - Wheel Struggle never fires: it is a Hang-Up checked with `actorHasPerk`.

- **Held back**, needing a decision or a feature: Key to Whinnypeg and Subtle Snake (exclusivity
  between items), The Right Of All Sentient Beings, Bullbar, Wheel Excited, Spacewalker,
  Trade Experience.

### First conversion batch (2026-10-01)

Eleven pack items moved from code to rules: Broadcaster (Hang-Up), Traitor, Universal Translator, Stellar Experience, Eager to Explode, Whimsical, Lifelike (both printings), Insectoid Components (both printings) and Pet Venom Adaptation.

- **Code removed** from `dice.mjs`, `target-riders.mjs`, `rider-uses.mjs`, and the `gij1`, `gij3`, `mlp1`, `tf1`, `tf3` and `wtnv` extension slices, along with their unused language strings.
- **Tests.** The old tests are replaced by `module/rules/conversions.test.js`, which loads each item from its pack source and checks the same behaviour.
- **Changes you might notice:**
  - Lifelike's Edge is now its own switch, on by default, rather than the dialog's Edge box being pre-ticked.
  - Insectoid Components' ↑2 is now listed under its own name.
- **Kept as Active Effects:** Insectoid Components' Toughness and Pet Venom Adaptation's Resistance, because those are flat stat changes.
- **Not converted from the sample's "fits now" group**, because each needs something Phase 1 doesn't have:
  - Spacewalker: environment and crewing tags.
  - Larger Than Life: reach by size.
  - Triassic Battlizer: a toggle bought with Personal Power, and a grant while the toggle is on.
  - Extra Crew Capacity: cage capacity is computed, not stored.
  - Zordbane: tangled into dice.mjs's damage-bonus plumbing.
  - Ice Flechettes: an effect-specific downshift.
  - Stapler: an optional substitution.
  - Screech and Visual Scanner: their grants are made by other items.
  - Light Armor: armor-trait code.

## 0. Summary

- **What exists today.** 2,155 compendium items are referenced by id from `module/`. About
  33,600 lines in 139 extension slice files (`module/helpers/extensions/*/`), 477 helper files,
  and `dice.mjs` at 21,000 lines. 554 of 6,364 pack items carry Active Effects. One field is
  already data-driven end to end: `system.reroll` (`module/data/reroll-schema.mjs`), shared by
  Perks and Active Effects. It is the proof that the approach works here.
- **Coverage check.** A stratified random sample of 150 of the 2,155 coded items was taken across
  all lines. Each item's live code was then classified against the draft rule types (§2).
  - **27%** fit the draft as it stands.
  - **89%** fit once the additions in §3 are made; that is the catalogue in §4.
  - **7%** are mostly data, with one piece left in code.
  - **4%** stay code.
  - Details are in §2.
- **Shape.** About 24 rule types plus a step language for buttons and triggers. A `when`
  condition language uses tags. Five scopes say *whose* roll, defense or item a rule touches.
  The engine is an adapter that registers once into the existing extension registry (§6). The
  roll pipeline does not change.
- **Active Effects stay.** They remain the tool for flat stat changes. Rules are for behaviour:
  conditional modifiers, buttons, triggers and choices. An item can carry both.
- **Migration** is line by line, keeping every existing unit test as the oracle (§9).

---

## 1. What "an item built in the system" means

An item's `system.rules` is an array. Each rule is a plain object:

```json
{ "type": "RollModifier", "label": "Morphed Might", "when": ["skill:might", "self:morphed"], "upshift": 1 }
```

- **`type`** picks the behaviour.
- **`when`** is the condition: a list of tags that must all hold.
- The rest are that type's parameters.
- Rules do nothing on their own. The interpreter reads them at the points in the pipeline where
  the hard-coded helpers run today.

The field lives in `module/data/item/templates/item-description.mjs`, next to
`system.automation`, so every item type gets it. It is an `ArrayField` of `ObjectField`s, not a
per-type `TypedSchemaField`. Rules are validated by the engine (§7) rather than by the
DataModel. That keeps unknown or newer rule types from making an item fail to load.

---

## 2. Coverage check

### Method

- **Population.** Every compendium item whose id appears in `module/**/*.mjs` (not tests):
  2,155 items.
  - By line: G.I. Joe 719, Transformers 554, Power Rangers 437, My Little Pony 189,
    Night Vale 67, cross-line 48, unattributed 141.
- **Sample.** 150 items, seeded and stratified: 10 per line, plus a share proportional to the
  line's size.
  - By type: 94 Perks, 12 Upgrades, 10 Hang-Ups, 8 Gear, 8 Weapon Effects, 5 Powers, 4 Weapons,
    3 Features, 2 Armor, 2 Roles, 1 Spell, 1 Alt Mode.
- **Classification.** Each item was classified from its automation notes plus the code that
  references its id.
  - Its behaviour was split into separate *behaviours*, 278 in total.
  - Each behaviour was mapped to a draft rule type, or marked as needing something new.
- **Item verdicts:**
  - **data**: fits the draft as it stands.
  - **data+**: fits once a named addition is made.
  - **partial**: one behaviour has to stay code.
  - **code**: bespoke throughout.

### Results

| Verdict | Items | Share |
|---|---:|---:|
| data | 41 | 27% |
| data+ | 93 | 62% |
| partial | 10 | 7% |
| code | 6 | 4% |

With n = 150 the margin is about ±5 points. Read the headline as: **roughly 85–93% of the
behaviour now hard-coded per item can become data, given the additions in §3.**

By line:

| Line | data | data+ | partial | code |
|---|---:|---:|---:|---:|
| G.I. Joe | 6 | 26 | 2 | 3 |
| Transformers | 10 | 19 | 2 | 0 |
| Power Rangers | 6 | 15 | 5 | 0 |
| My Little Pony | 7 | 8 | 1 | 1 |
| Welcome to Night Vale | 3 | 9 | 0 | 0 |
| Cross-line & other | 3 | 7 | 0 | 2 |
| Unattributed | 6 | 9 | 0 | 0 |

By item type: Perks are 84/94 data or data+. Upgrades are 12/12 data+, and every one needs the
`host` scope. Roles are 0/2: both are partial, because the Psycho Morpher weapon pick stays code.

Rule types used, counted as items needing each one:

| Rule type | Items |
|---|---:|
| Use | 48 |
| RollModifier | 30 |
| DialogSwitch | 20 |
| DerivedStat | 18 |
| Grant | 16 |
| Trigger | 14 |
| DamageModifier | 13 |
| Defense | 13 |
| OnHit | 12 |
| ActionCost | 9 |
| Pool | 7 |
| SkillSubstitution | 7 |
| ChoiceSet | 7 |
| Qualification | 6 |
| Toggle | 5 |

`Use` is the backbone: a third of all items have a button. `GrantActions`, `MovementAction` and
`Aura` each came up once or less. They stay in the catalogue because whole subsystems depend on
them, but they are not where the effort goes.

### What stays code (16 items)

| Item | Line | Why |
|---|---|---|
| Robotic Animal Pet | Cross-line | Builds a companion actor through its own UI |
| Direct Control | G.I. Joe | Rebuilds the drone companion actor |
| Contact Connection | Cross-line | Is the Contacts subsystem |
| Artillery Support | G.I. Joe | Delayed area strike rolled against many tokens |
| Scavenger | G.I. Joe | Lives inside the Requisition test pipeline |
| Help Yourself | MLP | Summons a clone (its assist half is data) |
| *partial:* Necroscientist | G.I. Joe | Raising a corpse as an allied actor |
| *partial:* Targetmaster | Transformers | Bonding two actors as partners |
| *partial:* Hybridization | Transformers | Each option's own effect is hand-written |
| *partial:* Carrier | Power Rangers | Carried Zords take no damage (actor link) |
| *partial:* Shaped Charges | G.I. Joe | Picker that removes tokens from a blast |
| *partial:* Shape-Shift | MLP | Other Perks add options to its dialog |
| *partial:* Path of Cruelty / Path of Venom | Power Rangers | Psycho Weapon pick lives on the Morpher |
| *partial:* Metallic Armor Power Up | Power Rangers | Personal Power upkeep and end conditions |
| *partial:* Terror | Power Rangers | Earns a point when another item Frightens |

The pattern is consistent. What stays code **creates or links actors** (companions, summons,
contacts, carried Zords), **owns a whole subsystem** (Contacts, Requisition), or **builds a
bespoke dialog**. These remain `Code` rules that name a helper (§4.19). The item is still
authored in the system; only that one piece points at code.

---

## 3. What the sample added to the draft

The 93 *data+* items asked for about 120 distinct additions. They cluster into ten themes,
listed here by how many sampled items each one unlocks. These are folded into the catalogue in
§4–§5. The numbers are items in the sample that need the theme; an item can need several.

1. **Scopes: whose roll is it? (~20 items).** The draft assumed a rule always changes its own
   actor's rolls. In practice:
   - **incoming:** a rule on a defender that changes the attacker's roll (Evasive Fighting,
     Escapist, Tough Enough, Word of Unicron).
   - **host:** an Upgrade changing the weapon, vehicle or armor it is attached to (all 12
     Upgrades; Folding Stock, Swift, Nonlethal).
   - **crew:** a vehicle item changing its driver or occupants (Pressurized Cabin, Cowcatcher,
     Camo Netting).
   - **linked:** a pilot and their Zord, or a companion and its owner (Overdrive, Zeo Crystal
     Boost, Favorite Command).
   - **party:** a rule touching the Party actor's pool (Nobility, Story Point spends).

   This became the `scope` field (§5.3), and it is the single biggest change from the draft.
2. **Choices that later rules can read (~18).** A pick made when the item is added or used: a
   Skill, a Specialization, an Alt Mode pair, an item from a compendium filter, or a number. The
   pick is stored on the item, and later rules reference it as `{choice.skill}`. Examples:
   Former Senator, Monstrosity, Upgrade Training, Consult Memories, Stand Together, Customized
   Armor, Grid Power. This is pf2e's ChoiceSet, and it became a rule type (§4.16).
3. **Durations (~14).** Grants, toggles and banked bonuses that last until end of turn, until the
   next roll, until the start of the granter's next turn, or for the scene or mission. Examples:
   Roar!, Psycho Assault, Dino Drive Mode, Shots Fired, Unlucky (For You). This became one
   shared `duration` parameter (§5.4).
4. **More Trigger events (~15).** Added events:
   - `wouldBeDefeated`: before damage lands, and it can cancel (Iron Hide, Do Not Go Quietly,
     Avoid the Inevitable).
   - `lendAssistance`: four items.
   - `afterAttack`, `dealsDamage`, `rollResult`: Mayhem Attack, Shots Fired, Misplaced
     Confidence.
   - `markedActorRolls`, `allyRollsSameSkill`: Unlucky, Competitive.
   - `itemAdded`, `resourceZero:<r>`, `sessionReset`.
5. **Tag vocabulary (~20).** Mostly cheap:
   - `defense:<key>`, `roll:initiative`, `roll:groupTest`, `action:aim`, `action:command`,
     `action:lendAssistance`.
   - `attack:ram`, `attack:noWeapon`, `item:element:<e>`, `item:equipped`,
     `item:availability:<tier>`.
   - `self:type:<actorType>`, `self:hasItem:<uuid>`, `target:hasItem:<uuid>`,
     `self:specialized:<spec>`, `target:marked:<key>`, `vs:<hazard>`, `scene:name~<text>`.
   - `ask:<key>`, for qualifiers only the player can confirm (§5.2).
6. **Steps (~14).** Added steps: `attack` / `repeatAttack`, `grantActions`, `lendAssistance`,
   `mark`, `setHealth`, `negateDamage`, `defeat`, `removeItem`, `replaceItem`, `attachUpgrade`,
   `equipSwap`, `createContact`. The steps `summon` and `requisition` are listed in §5.5 as
   code-backed.
7. **SkillSubstitution modes (7).** `bestOf` (Finesse-or-Might weapon effects, Turbo-Pliers),
   a wildcard `from: "*"` ("Pseudo"-Science), and offering a substitution as a dialog switch
   (Technically Correct).
8. **Formula values (~6).** Formulas such as `@level`, `@essence.speed`, `@spent`, `@choice.n`
   and `@count(allies within 10ft)`. Examples: Rev Your Engines, University Days, My Allies
   Are My Shield, Uniform, Stoic.
9. **Small parameters (~10).**
   - On RollModifier: `immune` (Snag immunity) and `resultMultiplier`.
   - On ActionCost: `confirm` and `attacksPerAction` (Bang Bang).
   - On DamageModifier: `unpreventable` and `redirectTo`.
   - `limit.distinctOptions`, a Pool shared across items by key, `Grant.skipIfOwned`, and
     stacking groups where only the highest counts (Armor Matrix, Specialized Defenses).
10. **New rule types (6 single uses).** `ItemModifier` adjusts another item's rules
    (Inspiration). Also `Sense` (Vision Focusers), `SurpriseExemption` (Ready For Anything),
    `KitProvider` (Medicine Kit) and `RequisitionModifier` (Upgrade Training). `HostWeapon`
    came up twice but folds into `scope: host` plus the existing weapon-upgrade overlay.

---

## 4. Rule type catalogue

These are the parameters that matter; every rule also takes `label`, `when`, `scope`,
`priority` and `disabled` (§5). In the hook column, *hook* names the registry kind each rule
type is run from (§6).

| # | Type | Does | Key params | Hook |
|---|---|---|---|---|
| 4.1 | **RollModifier** | Shift, Edge/Snag, flat bonus, auto-success, specialize, immunity | `upshift`, `downshift`, `edge`, `snag`, `bonus`, `autoSuccess`, `specialize`, `immune: ["snag"]`, `resultMultiplier` | rollSources, specializes |
| 4.2 | **DialogSwitch** | A labelled switch in the Roll Options Dialog that applies a RollModifier or SkillSubstitution when ticked | `default`, `modifier` or `substitution`, `input: {number, from: pool}`, `limit` | dialogToggles, applyDialog |
| 4.3 | **Reroll** | A reroll after a roll. Wraps today's `rerollSchema` so existing data moves without change | `dice`, `cost`, `limit`, `resource` | rerollGrants |
| 4.4 | **SkillSubstitution** | Use skill X in place of Y | `from` (or `"*"`), `to`, `mode: replace / bestOf`, `limit` | preRoll |
| 4.5 | **Defense** | Change a Defense, or use another defense or skill in its place | `defense`, `amount`, `substitute`, `ignoreArmor`, `stack` | defenseAdjust |
| 4.6 | **DerivedStat** | Change any derived number: Health, Movement, Reach, Initiative, Size, resource maximum, another item's field | `path`, `op: add / set / multiply / max / min`, `value` (formula) | derived |
| 4.7 | **DamageModifier** | Damage dealt or taken: extra, resist, immune, reduce, change type, redirect | `direction`, `amount`, `damageType`, `unpreventable`, `redirectTo` | damageModifiers |
| 4.8 | **OnHit** | After a hit, miss, crit or fumble, on attacks or (`anyTest: true`) any test | `outcome`, `steps[]` | hitRiders, postRoll |
| 4.9 | **ActionCost** | What an action, item, spell or conversion costs | `target`, `cost`, `confirm`, `attacksPerAction`, `limit` | costRules, spellCost |
| 4.10 | **GrantActions** | Extra actions this turn or next, for self or targets | `actions`, `timing`, `targets` | via `grantActionsThisTurn` / `setNextTurn` |
| 4.11 | **MovementAction** | Token movement options and costs | `action`, `costMultiplier`, `allowed` | `CONFIG.Token.movement.actions` |
| 4.12 | **Use** | A Use button: cost, limit, then steps | `cost`, `limit`, `steps[]`, `canUse` (tags) | uses |
| 4.13 | **Trigger** | Run steps on an event | `event`, `steps[]`, `prompt` (ask first) | turnStart/End, roundStart, rest, sceneAdvanced, missionAdvanced, afterDamage, + new |
| 4.14 | **Pool** | A counter on the item or actor: charges, points, uses | `key`, `max` (formula), `reset`, `shared` | derived + reset hooks |
| 4.15 | **Grant** | Give an item, Active Effect or condition, now or while active | `uuid` / `condition` / `effect`, `duration`, `skipIfOwned`, `overrides` | onCreate / toggle |
| 4.16 | **ChoiceSet** | A pick stored on the item, readable by other rules as `{choice.<key>}` | `key`, `from: skills / specializations / compendium filter / list / number`, `count`, `when: onAdd / onUse` | item create / use |
| 4.17 | **Toggle** | A named on/off or enum state other rules test (`self:toggle:<key>`) | `key`, `options`, `cost`, `duration` | sheet + steps |
| 4.18 | **Aura** | Apply a rule to allies or enemies within N ft (or the whole scene) | `radius`, `affects`, `rule` | derived (with token positions) |
| 4.19 | **Code** | Escape hatch: names a registered helper | `helper`, `params` | whatever the helper registers |
| 4.20 | **Qualification** | Training, Qualification and Requisition access | `category`, `tier`, `countsAsKit`, `ignorePrereqs`, `item` | existing qualification helpers |
| 4.21 | **ItemModifier** | Change another owned item's rules or fields (by uuid or tag) | `target`, `patch` | derived |
| 4.22 | **Sense** | Vision or senses on the token | `sense`, `range` | token prep |
| 4.23 | **SurpriseExemption** | Act normally in a surprise round | — | combat start |
| 4.24 | **KitProvider / RequisitionModifier** | Kit and requisition hooks; one each in the sample, could become `Code` until more appear | — | kits, requisition |

`HostWeapon` (Folding Stock, Anti-V.E.N.O.M.) is **not** a separate type. An Upgrade's rules
with `scope: "host"` run against the item it is attached to. The weapon-upgrade overlay built in
2026-09 (`project_essence20_weapon_upgrades`) already does that derivation for hard-coded
upgrades.

---

## 5. The shared language

### 5.1 `when` — tags

`when: [tag, …]` means all of the tags must hold. `{"any": [...]}` means at least one, and
`"not:tag"` negates a tag. Tags are evaluated against a **roll context**. That context is the
object the pipeline already builds: actor, item, skill, essence, attack type, targets, combat
state, and the dialog's own switches.

Families and examples:

| Family | Examples |
|---|---|
| Roll | `skill:<key>`, `essence:<key>`, `roll:initiative`, `roll:groupTest`, `roll:assisted`, `roll:edge`, `test:<named test>`, `specialization:<key>` |
| Attack | `attack`, `attack:melee/ranged/unarmed/area/ram/noWeapon`, `defense:<key>`, `action:aim/command/lendAssistance` |
| Item | `item:type:<t>`, `item:trait:<t>`, `item:element:<e>`, `item:source:<uuid>`, `item:equipped`, `item:availability:<tier>` |
| Self | `self:morphed`, `self:transformed`, `self:status:<c>`, `self:toggle:<k>`, `self:hp<half`, `self:level>=N`, `self:type:<t>`, `self:hasItem:<uuid>`, `self:specialized:<s>`, `self:faction:<f>`, `self:attached` |
| Target | `target:status:<c>`, `target:tag:<creature tag>`, `target:size<self`, `target:tl<level`, `target:type:<t>`, `target:hasItem:<uuid>`, `target:marked:<k>` |
| Situation | `combat`, `combat:round:N`, `ownTurn`, `environment:<e>`, `terrain:<t>`, `vs:<hazard>`, `scene:name~<text>`, `ally:within:<ft>`, `enemy:within:<ft>`, `ally:within:<ft>:has:<uuid>` |
| Vehicle | `vehicle:driving`, `vehicle:crew`, `vehicle:toggle:<k>` |
| Ask | `ask:<key>` |

**`ask:` tags** are the honest answer to qualifiers no code can check, such as "while
protecting someone". When such a tag is unresolved, the Roll Options Dialog shows the rule as a
switch, defaulting off, instead of guessing.

That is the Tracking Outfit `askIfUnknown` case, generalised. It also gives the engine a safe
fallback for any tag the context cannot answer: **unknown means ask, never assume.**

Tags may interpolate a stored choice: `skill:{choice.skill}`.

### 5.2 Values and formulas

Any numeric parameter may be a number or a formula string.

- Formula terms: `@level`, `@essence.<key>`, `@skill.<key>.rank`, `@pool.<key>`, `@spent`
  (the amount a variable `spend` step took), `@choice.<key>`, `@count(<tag>)`.
- Formulas are evaluated by a small whitelist evaluator (`+ - * / min max floor ceil`), never
  `eval`.

### 5.3 `scope` — whose thing it changes

| Scope | Meaning | Sample uses |
|---|---|---|
| `self` (default) | The item's own actor | most |
| `incoming` | Rolls *against* this actor, e.g. a defender's rule that hits the attacker | Evasive Fighting, Escapist, Tough Enough |
| `host` | The item this one is attached to (Upgrade → weapon / armor / vehicle) | all Upgrades |
| `crew` | Actors driving or riding the vehicle that owns the item | Pressurized Cabin, Cowcatcher |
| `linked:<role>` | A linked actor: `pilot`, `zord`, `owner`, `companion` | Overdrive, Favorite Command |
| `party` | The primary Party actor (Story Points, Requisition) | Nobility, International Network |

The interpreter resolves a scope to a set of actors or items when it indexes rules (§8). Most of
the "multi-actor" cost in the sample disappears once scope exists.

### 5.4 `duration`, `limit`, stacking

- **`duration`**: `{until: "endOfTurn" | "nextRoll" | "startOfNextTurn" | "endOfRound" | "scene" | "mission", rounds?}`.
  - Durations attach to Grants, Toggles, `bank` and `mark`.
  - They are stored as ActiveEffect `duration` where v14 can express it, otherwise as a flag
    that the existing turn, scene and mission hooks clear.
- **`limit`**: `{per: "turn" | "round" | "scene" | "mission" | "session" | "rest", max, key?, distinctOptions?}`.
  - Built on the existing `getUses` / `markUsed` scene-clock helpers.
  - `key` lets two items share one limit (Wing Missile Salvo).
- **`stack`**: a group name. Within a group only the highest value applies (Armor Matrix,
  Specialized Defenses). `exclusive: true` blocks other rules in the group.

### 5.5 Steps (Use, Trigger, OnHit)

A step is `{do: "<step>", ...params, when?}`. A step's `when` is evaluated at run time.

| Step | Does |
|---|---|
| `spend` | Actions or a resource. `amount` may be a range the player picks; it sets `@spent` and has an `onFail` branch |
| `roll` | A Skill test vs a DIF or a Defense, with `onSuccess`, `onFail`, `onCrit` and `perTarget` |
| `attack` / `repeatAttack` | A full weapon attack through the normal pipeline |
| `damage` / `heal` / `setHealth` / `negateDamage` | Health changes; `negateDamage` only inside `wouldBeDefeated` / `takesDamage` |
| `applyCondition` / `removeCondition` | With `duration` |
| `gainResource` | Add to a pool or resource, including the Party's Story Points |
| `bank` | A pending bonus on self, target or ally (wraps `bankPendingBonus`, with granter) |
| `grant` / `removeItem` / `replaceItem` / `attachUpgrade` / `equipSwap` | Item changes |
| `grantActions` | Wraps `grantActionsThisTurn` / `setNextTurn` |
| `choose` | The player picks one of several step lists, or a value (ChoiceSet at use time) |
| `target` | Pick allies or enemies in range; sets the targets for later steps |
| `move` | Push or pull |
| `mark` | Tag a target with a key and duration (`target:marked:<key>`) |
| `setToggle` | Set a Toggle, with `duration` |
| `lendAssistance` / `createContact` | Wrap the existing helpers |
| `defeat` | Mark Defeated |
| `chat` | A chat line (the Use run's return value) |
| `summon` / `requisition` | Code-backed, named for the editor but implemented by the existing helpers; see §2 |

### 5.6 Trigger events

- Turn and time: `turnStart`, `turnEnd`, `roundStart`, `combatStart`, `combatEnd`, `rest`,
  `sceneAdvanced`, `missionAdvanced`, `sessionReset`.
- Morph and actor state: `morph`, `unmorph`, `transform`, `defeated`, `allyDefeated`,
  `itemAdded`, `resourceZero:<r>`.
- Damage: `takesDamage`, `wouldBeDefeated` (pre-damage, cancellable), `takesCrit`,
  `dealsDamage`.
- Rolls and actions: `afterAttack`, `rollResult`, `lendAssistance`, `markedActorRolls`,
  `allyRollsSameSkill`, `conditionApplied`.

Each event maps to an existing registry hook or to an `essence20.*` hook the system already
fires. The new ones (`wouldBeDefeated`, `conditionApplied`, `markedActorRolls`) need one emit
site each.

---

## 6. Engine architecture

```
item.system.rules ──► RuleIndex (per actor, built in prepareDerivedData)
                        │  byHook: { rollSources: [...], defenseAdjust: [...], uses: [...], ... }
                        ▼
              module/rules/adapter.mjs  — registers ONCE into helpers/extensions.mjs
                        │  registerRollSources(ctx => index(actor).rollSources.filter(when).map(toSource))
                        │  registerDefenseAdjust(...), registerUse({matches: item => item.system.rules.some(Use)}), ...
                        ▼
          existing pipeline (dice.mjs, roll-options-dialog, action-economy, reroll, ...)
```

- **The roll pipeline does not change.** The rules engine is one more extension that registers
  into the 25 registry kinds (`preRoll`, `rollSources`, `defenseAdjust`, `specializes`,
  `dialogToggles`, `applyDialog`, `postRoll`, `hitRiders`, `damageModifiers`, `afterDamage`,
  `turnStart`, `turnEnd`, `roundStart`, `rest`, `sceneAdvanced`, `missionAdvanced`, `derived`,
  `chatDecorators`, `uses`, `costRules`, `spellCost`, `rerollGrants`, …). Hard-coded slices and
  rules coexist for the whole migration.
- **Modifier sources.** Every RollModifier, DialogSwitch and Defense rule goes through
  `addSource(...)` with the item's name as its label. The Roll Options Dialog then shows where
  every modifier came from, the same as hard-coded Perks do today (`project_essence20_modifier_sources`).
- **Files:**
  - `module/rules/`: `index.mjs` (the RuleIndex), `predicate.mjs` (tags), `formula.mjs`,
    `steps.mjs`, `types/*.mjs` (one per rule type, each `{schema, validate, index, summarize}`),
    `adapter.mjs`.
  - Each type file is small and unit-tested in plain Node, like `effect-catalog.mjs`.
- **Code rules:**
  - `{type: "Code", helper: "companions.robotPet"}` looks the name up in a `CODE_HELPERS` map.
  - Existing helpers export into that map instead of matching on compendium ids.
  - That is the bridge that lets an item be fully authored in the system even when one piece
    of it is code. A homebrew copy of Robotic Animal Pet then works too.

---

## 7. Validation

- **Each type file has a `validate(rule) → errors[]`.** Errors show:
  - on the Rules tab, inline;
  - in a pack check script (`scripts/check-rules.mjs`, alongside `check-effect-keys.mjs`), which
    runs in CI;
  - as a console warning at index time, after which the rule is skipped and not thrown.
- **Unknown types and tags** are kept and shown as "unrecognised". They never strip data, so a
  newer item opened on an older system survives the round trip.
- **Tag catalogue.** One table (`predicate.mjs#TAGS`) feeds the validator, the editor's tag
  picker and the plain-English summaries. This is the same one-vocabulary-several-consumers
  pattern as `effect-catalog.mjs`.

---

## 8. Performance

- **Index once.** Rules are indexed by hook at `prepareDerivedData`, so the actor's
  RuleIndex is rebuilt only when its items change. Each registry call then only scans the rules
  indexed under its own hook. Today every registered slice function runs on every roll and
  checks its own ids, so this should be no slower and is likely faster.
- **Evaluate conditions at roll time.** Predicates are evaluated against the roll context when a
  roll happens. Scopes `incoming`, `crew` and `linked` read the other actor's index. Those
  indexes are cached on the actor, never recomputed per roll.
- **Auras need positions.** Aura rules are the only ones that need token positions. They are
  evaluated lazily, only when an aura rule is indexed, as the action-economy ruler already does.

---

## 9. Editor

> **Built 2026-10-01: one tab for everything an item does.** The item sheet no longer has an
> Effects tab.
>
> - **One list.** The Rules tab lists the item's Active Effects (tagged "Always on", "Off" or
>   "Temporary", each with its Effect Wizard summary) and its rules (tagged "Rule") together.
> - **One Add button.** It asks "What should it do?" in game words. "Change a stat" goes straight
>   to the Effect Wizard and makes an Active Effect, or a blank effect for users whose
>   `effectAddBehavior` is "always blank". Every other choice adds a rule and opens the JSON editor
>   on it until the guided forms exist.
> - **Defense and number changes start with a condition.** "Change a Defense, only when…" and
>   "Change a number, only when…" start with a `when`, so a flat change has one obvious home.
> - **The data is still two things.** Active Effects remain core documents, needed for conditions,
>   expiry and area effects.
> - **The actor sheet keeps its Effects tab for now.** Merging it the same way is to be looked at
>   later.
> - The item-authoring tour now points at the Rules tab.

The editor is a **Rules tab** on every item sheet. It builds on the Effect Wizard
(`module/apps/effect-wizard.mjs`, `docs/ACTIVE_EFFECTS_UI_PLAN.md`) and keeps its two-audience
shape:

- **Guided.** The flow is "Add rule", then pick a type from a list written in game words
  ("Change a roll", "Add a button", "When something happens…", "Let the player choose…"), then
  fill in that type's form.
  - Tags come from a picker grouped by family (§5.1), and steps from a list.
  - Every rule shows a plain-English summary on the tab, e.g. "↑1 on Might tests while
    Morphed", generated by its type's `summarize()`.
- **Raw.** A JSON view of `system.rules` for people who know the vocabulary, validated on save.
- **Automation status.** The automation badge (`system.automation`) can be derived: an item
  whose rules contain no `Code` rule and validate cleanly is *full* by construction. The Item
  Review can then show a **data vs code** share per line, which is the measure of the migration.

The Effects tab keeps working as it does now. Advice in the editor: a flat, always-on change to a
stat is an Active Effect, and anything with a condition, a button, a choice or an event is a
rule.

---

## 10. Migration plan

The migration runs in five phases, smallest risk first. Each phase ships on its own.

1. **Engine plus the high-volume types (v6.1).**
   - Build the engine with: RollModifier, DialogSwitch, Defense, DerivedStat, DamageModifier,
     Reroll (wrapping `rerollSchema`), Grant, Toggle, Pool, Qualification, ChoiceSet, scopes
     `self` / `incoming` / `host`, and the predicate, formula and validator.
   - Read-only Rules tab, with summaries and the raw JSON editor.
   - Convert the 41 *data* items' equivalents first; they need nothing new.
2. **Use, Trigger and steps.** The button and event layer: about half the sample. Then the
   guided editor.
3. **The remaining scopes** (`crew`, `linked`, `party`), durations, the new events
   (`wouldBeDefeated`, `lendAssistance`, …) and the small parameters in §3.9.
4. **Line-by-line conversion.** One game line per PR, Night Vale first (smallest, all
   data/data+), then MLP, Transformers, Power Rangers and G.I. Joe.
   - For each item, write its rules, then delete the id-keyed code.
   - **The existing unit tests stay as the oracle.** Each test is re-pointed at an item built
     from rules and must pass unchanged, before the hard-coded slice is removed.
5. **Code rules.** The 4–11% that stays code is re-pointed from compendium ids to named
   `Code` helpers. Copies and homebrew of those items then work too.

**Pack edits** follow the existing rule:
- Rules are written into `packs/*/_source/*.json` by a scratch batch script that edits text
  (the `apply.cjs` pattern). Never JSON-round-trip pack files.
- `npm run build:db` runs only with the world closed.
- No rulebook text is ever written into any field. Rule `label`s are short names, not
  descriptions.

**Size estimate.**
- Phase 1–3 engine: about 4–6k lines plus tests.
- Phase 4: about 2,000 items' rules, mostly generated from the existing slice code by script,
  with a human pass per line.
- It should remove most of the ~33,600 extension-slice lines and a large share of the id-keyed
  code in `dice.mjs`.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| The sample over-reads *data+*: classification was from notes plus code reading, not running items | Phase 4 converts against the existing tests; anything that won't pass stays a `Code` rule. The verdict can only fall back to *partial*, never break an item |
| Two systems (slices and rules) running at once double-apply a modifier | An item with any rules is skipped by its old id-keyed slice (one guard in `extensions.mjs`); every conversion PR removes the slice in the same change |
| The tag language grows without bound | One `TAGS` table with a validator; unknown tags fall back to `ask:` (§5.1) rather than silently false |
| Authoring complexity puts off GMs | Guided editor in game words; summaries on the tab; the 2,000 book items ship pre-built, so authors start from a working copy |
| `Code` becomes a dumping ground | The Item Review shows the data/code share per line; a `Code` rule must name a helper in `CODE_HELPERS`, which is reviewed |
| Performance on big actors (Zords, Parties) | Index at prepare, hook-bucketed (§8); measure with the existing dice tests' timings before and after Phase 1 |

---

## 12. Decisions (answered 2026-10-01)

1. **Code rules may name any helper.** There's no way to know what rules a GM will want to add.
   - Helpers register with `game.essence20.registerRuleHelper(name, hooks)` (`module/rules/code.mjs`), from the system, a module or a world script.
   - Any item's `{type: "Code", helper: name}` runs the helper, with no allow-list.
   - The Rules tab flags a helper nobody has registered.
2. **No fallback to the old id-keyed code.** Converted code is deleted.
   - Characters made before a conversion keep working in two ways:
     - **Inheritance:** a compendium copy with no rules of its own runs its original's rules live (`module/rules/inherit.mjs`), as its automation notes already do.
     - **A linking migration** (`linkExistingCopies`, GM, once per system version) for copies that lost that link, such as imported, hand-built, or copied from a world item. It links each one to the compendium item of the same type and name when that name is unique. The link is stored in `flags.essence20.rulesSource`.
   - Token actors' own embedded copies (unlinked tokens with changed items) aren't migrated yet.
3. **Rule switches remember their state per actor.** Each one starts where the actor last left it (`flags.essence20.ruleSwitches`), otherwise at its default.
4. **Stacking depends on the item, per the rules.**
   - A rule's own `stacks: true/false` decides when it is set.
   - Otherwise an item that can be taken more than once (a Perk with `selectionLimit` above 1) stacks.
   - Anything else counts once, however many copies an actor has.
   - Copies count as the same when they share a rules source, a rule position and ChoiceSet picks. So a Perk taken twice with two different chosen skills is two benefits (`rules/index.mjs#ruleStacks`).
5. **Leftover disabled Active Effects** that repeat a converted rule are removed from the pack. Whimsical's ↓1 Infiltration effect was the one in batch 1.

---

## Appendix — reproducing the coverage check

The scripts lived in the session scratchpad, not the repo.

1. **Draw the sample.**
   - Walk `module/**/*.mjs` (excluding tests) for 16-character ids.
   - Match them to `packs/*/_source`.
   - Group by line using the Item Review data.
   - Draw a seeded (20261001), stratified sample: 10 per line, plus a proportional share, 150 in
     total.
2. **Classify** in five batches of 30. For each item, read its automation notes and the code
   at each id reference, then write one JSON record per item: verdict, its behaviours with rule,
   tags, params and fits, and its new types.
3. **Aggregate** the records into the tables in §2.

To re-run after Phase 1, use the same seed. The *data* share should rise to the *data+* share as
the additions in §3 land.
