# Batch slB: Transformers extension slices (`tf1`, `tf2`, `tf3`, `fix3-tf`, `other2`)

**Scope:** every item in the id tables of `module/helpers/extensions/tf1/`, `tf2/`, `tf3/`, `fix3-tf/` and
`other2/`, plus every other place in `module/` that uses those ids. The batch was done in four parts on separate
branches (`rules/slB-tf1` for tf1 + fix3-tf, `rules/slB-tf2`, `rules/slB-tf3`, `rules/slB-other2`), all from
`rules/slA` at 3305a9bc, and merged into `rules/slB`. Each part's full write-up follows below, in the same layout as
the reg*.md files.

| Verdict | tf1 + fix3-tf | tf2 | tf3 | other2 | Total |
|---|---|---|---|---|---|
| Convert | 3 | 0 | 1 | 1 | **5** |
| Partial | 4 | 0 | 1 | 0 | **5** |
| Skip | 24 | 21 | 21 | 26 | **92** |
| Items | 31 | 21 | 23 | 27 | **102** |

14 rules were added to 10 pack items. After the merge, `scripts/check-rules.mjs` counts 1348 rules on 964 items (slA
left 1334 rules on 956 items), with 0 errors and 0 warnings. ESLint is clean and jest passes (502 suites; 9596
passed, 2 skipped).

No slice file became empty, so `extensions/index.mjs` is unchanged. The only merge conflicts were the parts' test
blocks appended at the end of `module/rules/conversions.test.js`; all are kept.

**Same-line behaviour differences** (the cross-line ones are in each part's section):

- **Helical Spring (tf3):** its Convert reminder is now a rule `chat` step: fixed English text under a bold label,
  not the old localized "Helical Spring: ..." string (`E20.Tf3HelicalAlt` / `E20.Tf3HelicalBot` removed). A renamed
  copy still says "Helical Spring".
- **Eidetic Buffer (tf1):** its result sentence is no longer localized (`E20.Tf1RecallYes` / `No` removed) and gains a
  title line.
- **Fearsome Additions (tf1):** its ↑1 now also reaches Initiative when Intimidation is the Initiative Skill (slA
  accepted the same for Gorilla), and it stops applying while the gear is unequipped.
- **Peaceable (other2):** label "Peaceable (healing)" and its place in the dialog's source list change; nothing else.

**Most common engine pieces the skips need, across all four parts** (each part's list has the detail):

- **Marks:** read by the marked actor's own rolls, ending at the end of the marked creature's next turn, combat-scoped,
  and with counters (Cage, Diversion, Duke It Out, Covering Fire, Watchful Eyes, Loaded Questions, Laser Designator,
  Right Of All Sentient Beings, Martyr).
- **A "combat exists" tag** (started or not): Broad Understanding, Right Of All Sentient Beings, Martyr.
- **Trigger events on other actors:** an ally's roll or miss, an attack against me missing, enemy movement into
  Reach, moving on one's own turn, another item being added.
- **Chat-card action buttons:** Sustained Beam, Scramble Modulator, Not Like That Like This!, Rust Derivatives,
  Stasis Cuffs, Frequency Interference, Temper Tempest.
- **Steps that change items or other actors:** create from data, lend a copy, act on a target's item, give a resource
  to another actor, Origin / chassis / Alt Mode pickers, push / contested-roll / Initiative-reset steps.
- **Rolls:** an open-ended roll step (no DIF), dice in formulas and steps.
- **Defense and damage:** a per-attack "use instead" / ignore-armor Defense mode that lands after best/halve, a hit-time
  Blunt→Sharp override, a switch-gated flat hit-damage note.
- **Tags:** "this weapon was granted by the rule's item" (would convert Rotor Blades' and Tow Cable's ↑1), whole-word
  name match, host tags at roll time, Requisition tags for one-handed weapons.
- **Other:** a late derived stage (Rotor Blades' Aerial, as in slA), pre-update vetoes, incoming rules through the
  `driven` link, a rule that cancels a roll, a Combiner-component scope, chat text placeholders.

---

## Batch slB (part): the `tf1` and `fix3-tf` extension slices

**Scope:** every item in the id tables of `module/helpers/extensions/tf1/` (`TF1` in `common.mjs`, plus the Alt
Mode Mastery id written inline in `support.mjs`) and `module/helpers/extensions/fix3-tf/` (`FIX3_TF` in
`tf-fixes.mjs`), plus every other place in `module/` that uses those ids (`dice.mjs` holds Watchful Eyes and
Predacon; `mechanics/combat/weapon-traits.mjs` holds Experiment's Hardpoint option; `items/attacks/favorite-weapon.mjs` holds
Favorite Weapon). Branch `rules/slB-tf1`, from `rules/slA` at 3305a9bc.

| Verdict | Items |
|---|---|
| Convert | 3 |
| Partial | 4 |
| Skip | 24 |

That is 31 items with behaviour of their own. Three more table entries are only references: Favorite Weapon (its
chosen weapon is read by Steady Firepower and Target-Rich Environment), Disappear (Easy In, Easy Out checks it is
owned), and Alt Mode Mastery (it raises Alt Mode Mimicry's count). The personal-vehicle Edge, Dig Deep and Get To
Know code in `fix3-tf` is keyed by other tables (`SUMMON`, banked-buffs, a spell flag), not `FIX3_TF`, so it is out
of scope here.

This part added 10 rules to 7 pack items. After it, `scripts/check-rules.mjs` counts 1344 rules on 962 items
(the base was 1334 rules on 956 items), with 0 errors and 0 warnings.

### Converted (3)

| Item | Rule | Why it is exact |
|---|---|---|
| Eidetic Buffer | Use (no cost): `roll` Alertness DIF 14, with a chat line on success and on failure | The `roll` step calls the same `grants.mjs#rollTest(actor, 'alertness', 14)` the old Use did. Neither pays an action or has a limit. `TF1.eideticBuffer`, the Use entry and the `Tf1RecallYes` / `Tf1RecallNo` strings are removed. |
| Dinobot, Maximal (Influences) | Two DialogSwitches each, Edge, `forget`: `skill:{item.choice}` + the Perk's Skill list (`{any: [...]}`), one with `roll:dataset:specializationKey` and `default: true`, the other with `not:roll:dataset:specializationKey` and off | The old toggle was shown when the Perk's choice was the rolled Skill and in its list, on by default exactly when `dataset.specializationKey` was set. Exactly one of the two switches is offered for any roll, starting where the old one did. The old ext toggles were never remembered, hence `forget`. Old ext toggles and rule switches come through the same `extDialogToggles` / `runApplyDialog` calls (skill rolls and Initiative alike), with the same `dataset`. The old `giveEdge` cleared a Snag instead of adding the Edge, which is the same as Edge + Snag cancelling at roll time. `FIX3_TF.dinobot` / `maximal`, `INFLUENCE_EDGE`, `giveEdge` and the influence toggle code are removed, with `E20.Fix3TfSpecializationEdge`. |

### Partial (4)

| Item | Converted | Rule | Still code |
|---|---|---|---|
| Predacon (Influence) | The Specialization Edge switch | The same two DialogSwitches as Dinobot / Maximal, list `skill:intimidation` | The Frightened end at the end of the target's next turn (`tfFixPostRoll` / `tfFixTurnEnd`, fed by `dice.mjs`'s `PREDACON_ID` attempt). `FIX3_TF.predacon` stays. |
| Experiment | Shove option: ↑1 when Shoving | RollModifier ↑1, `roll:shove` + `rule:data:system.choice=shove` (appended after the item's two existing rules, so their indices don't move) | The "breaking free of a grapple" switch (see the skips). `roll:shove` reads `ctx.isShove`, which `dice.mjs` sets from `rollDataset.isShove`, the old source's only input (and `dataset.isShove` itself, the same flag). |
| Fearsome Additions (gear) | Bot Mode: ↑1 on Intimidation | RollModifier ↑1, `not:self:transformed` + `skill:intimidation` | The Alt Mode ↑1 on Flyby / Ram / Slam attacks: the old test includes a whole-word name match (`/\b(ram\|slam\|flyby)\b/i`), and `item:name~` is a substring match ("Program", "Frame" would match). The two halves are mutually exclusive (Bot / Alt Mode), so splitting them changes nothing. |
| Partnered | The Free-action Lend Assistance | ActionCost `lendAssistance` → `free`, `ask: "E20.Tf1AskPartnered"`, `rule:data:flags.essence20.partner` | The partner pick (its Use), which sets the flag the rule reads. `PARTNERED_RULE` and its `registerCostRule` call are removed. ActionCost rules reach `getCostOptions` through `registerCostRuleProvider` in the same shape (`matches` on `ctx.key == 'lendAssistance'`, the same `ask` question, the same label). |

### Behaviour differences

1. **Dialog sources and switch names.** The converted sources and switches carry rule ids (`rule-<item>-<n>`)
   where they had `fearsomeAdditions`, `fix3ExperimentShove` or `fix3Influence-<key>`. The influence switch label
   is the rule's own ("Dinobot: Edge (chosen Specialization)") instead of the localized "<item name>: Edge (your
   chosen Specialization comes into play)", so a renamed copy of the Perk no longer shows its own name.
2. **Fearsome Additions on Initiative (same-line).** Initiative reads rule sources but never read extension roll
   sources. A Transformer in Bot Mode whose Initiative Skill is set to Intimidation now gets the ↑1 on Initiative
   too. slA accepted the same change for Gorilla.
3. **Fearsome Additions unequipped (same-line).** Gear rules only apply while the gear is equipped (gear defaults
   to equipped). The old code read the item whether equipped or not, so an unequipped Fearsome Additions no longer
   gives the Bot Mode ↑1. Its Alt Mode half (still code) ignores equipped as before.
4. **Eidetic Buffer's chat card.** The card now has a title line ("Eidetic Buffer: Recall a fact (DIF 14
   Alertness)") above the same result sentence, and the sentence is no longer localized. The roll now carries the
   item's uuid (`dataset.itemUuid`), so `afterRoll` Triggers can tell it was made with this item; nothing reads that
   for this item.
5. **Duplicate copies.** A rule applies once per copy of its item unless the item can be taken more than once;
   the old code read the first copy. None of these items is taken twice in an ordinary build.

### Skipped (24)

#### tf1: combat (`combat.mjs`)

- **Brutal Display.** Use: needs a Defeated target, every non-Defeated ally of it within 100 ft (by disposition),
  1 Energon, then an Intimidation roll against each one's Willpower whose post-roll applies Frightened for 1 round
  or 10 on a Critical Success. *Needs:* a recipient "allies of the target within N ft", a "target is Defeated"
  gate, and a per-target crit-scaled Condition duration.
- **Make An Example.** Same shape (foes within 30 ft of the Defeated target), a Fearsome Voice roll, damage
  buttons. *Needs:* the same recipients plus chat damage buttons per hit.
- **Fearsome Voice.** Its Use creates a natural weapon and weapon effect from inline data, and a hit rider gives
  Frightened on a crit. *Needs:* a step that creates an item from data (not a compendium uuid).
- **Comms Assault.** Standard + 1 Energon, Technology against every enemy within 100 ft, Toughness without armor
  for that roll only, then 1 EMP damage button and Stunned per hit. *Needs:* a per-roll "ignore armor" Defense
  mode and chat damage buttons.
- **Focused Blast.** A three-way select (none / ↑1 / +1 damage) on area attacks; the damage is a flat post-hit
  note per hit. A DialogSwitch `damage` joins the scaled damage bonus (multiplied by Degrees of Success), and
  converting only the ↑1 would break the exclusive choice. *Needs:* a switch-gated unscaled hit damage note.
- **Steady Firepower.** A per-target, per-scene running count of consecutive favorite-weapon attacks lowering
  that target's Defense. *Needs:* counters on marks and an outgoing Defense amount from them.
- **Target-Rich Environment.** Pick an attack of the favorite weapon, target every enemy within its range, Story
  Point + whole turn, once per scene. *Needs:* a step that rolls an owned weapon effect against computed targets.
- **My Allies Are My Shield.** +1 Defense per ally within 30 ft at attack time (never on the sheet), minus what
  was traded for +10 ft Movement per trade until the next turn. *Needs:* a per-attack additive Defense from
  `@count.allies` and a tradeable counter feeding Movement.
- **Show Respect (Hang-Up).** Records foes' crits in combat and warns before the next turn's attack. *Needs:*
  Trigger events for other actors' rolls and a pre-roll warning.
- **Easy In, Easy Out (invisibility half).** Invisibility gained through Disappear in combat ends at the start of
  the next turn. *Needs:* a timed removal of a Condition ("until your next turn starts") tied to `conditionGained`.
  Its Alertness Snag was already a rule.

#### tf1: support (`support.mjs`)

- **Loaded Questions.** Cumulative ↑1 per earlier Deception / Persuasion test on the same target this scene.
  *Needs:* per-target counters on marks and a shift formula reading them.
- **Comms Probe.** Free action, DIF 12 Technology, then a scene flag that False Data's Use (still code) reads.
  Converting it alone would leave False Data unable to see it. *Needs:* False Data converted with it (below).
- **False Data.** Opens a plain Deception test (no DIF), gated on Comms Probe's scene flag. *Needs:* a `roll`
  step that opens an ordinary Skill Test without a DIF.
- **Feedback Field.** Convertible as a Use (Move, 1 Energon, once per scene) except its chat line, which posts the
  holder's Willpower total as the DIF (the item's automation notes promise it). *Needs:* data / formula
  placeholders in `chat` step text.
- **Mine!** Asks open or unnoticed before paying a Free action; unnoticed opens a plain Infiltration test.
  *Needs:* the open-ended `roll` step, and a `choose` that can run before the cost.
- **Picking Up the Trail.** Choose Alertness or Survival, then a plain test. *Needs:* the open-ended `roll` step.
- **They Called It A Glitch!** Out of combat on a targeted ally: General Perk picker, DIF 20 Technology, grants the
  Perk to the ally with a -2 maximum Health effect, and a reverse option. *Needs:* granting to another actor with
  an Active Effect, and an undo branch.
- **Flexible Switch.** Its Use picks two Alt Modes; its cost rule (conversion → Free) applies only when the
  current Alt Mode is one of them. *Needs:* a tag comparing the actor's `altModeId` with a list stored on the rule
  item.
- **Alt Mode Mimicry.** Compendium Origin / Alt Mode index, size-class and different-Origin filters, a count raised
  by Alt Mode Mastery, then grant + `canTransform`. *Needs:* an Origin-aware chassis picker.
- **Drone (Origin).** Copies another Origin's chassis: grants its Alt Mode and writes base Movement and size.
  *Needs:* the same picker plus steps that write actor data from the picked entry.
- **Tox-En.** A GM tool rolling `1d20 + 1d8` (or with Edge) against each target's Toughness, Essence damage and a
  stacking Impaired duration. *Needs:* dice in roll steps and an extend-Condition step.
- **Solid-State Energon.** A stored-points dialog, `1d2 + damage` explosion check, radius damage buttons, or a DIF 14
  Science refine that uses one up. *Needs:* dice in formulas, item-quantity steps and radius damage.

#### fix3-tf (`tf-fixes.mjs`)

- **Covering Fire.** A miss marks the target; it takes a Snag on attacks made on its own turn until the end of its
  next turn (once, out of combat). *Needs:* a mark that lasts to the end of the marked creature's next turn, and
  an own-turn tag that holds out of combat.
- **Watchful Eyes.** `dice.mjs` flags the DIF 10 Alertness attempt; a success marks each targeted enemy with a Snag
  on its first Skill Test on its own turn. *Needs:* the same mark expiry and own-turn tag, and a use-once mark
  consumed by a roll.
- **Experiment (the rest of the partial).** The "breaking free of a grapple" switch is on by default for
  `extensions/rules/grappled.mjs#grappleEscapeSkills(actor)`, a list that depends on the actor's game line. *Needs:* a `check:` name for
  the grapple escape Skills.
- **Predacon (the rest of the partial).** Frightened (from `dice.mjs`) comes off at the end of the target's next
  turn. *Needs:* a Condition duration "until the end of the target's next turn" on a hit.

### Engine pieces the skips need

- **An open-ended `roll` step** (a plain Skill Test with no DIF): False Data, Mine!, Picking Up the Trail (and Comms
  Probe with them).
- **Chat text placeholders** for data / formulas: Feedback Field.
- **"Until the end of <the marked creature's> next turn"** for marks and Conditions, and an own-turn tag that holds
  out of combat: Covering Fire, Watchful Eyes, Predacon's Frightened, Easy In, Easy Out.
- **Counters on marks** read by shifts / Defense: Loaded Questions, Steady Firepower, My Allies Are My Shield.
- **Recipients around a target** ("allies of the Defeated target within N ft") and a Defeated-target gate: Brutal
  Display, Make An Example.
- **Item creation from data**, Origin / chassis pickers and actor-data writes: Fearsome Voice, Alt Mode Mimicry,
  Drone, They Called It A Glitch!.
- **A switch-gated unscaled hit damage note**: Focused Blast.
- **Dice in steps and formulas**: Tox-En, Solid-State Energon.
- **Tags:** a whole-word item name match (Fearsome Additions' Alt Mode half), a check for the grapple escape
  Skills (Experiment), the actor's `altModeId` in a list on the rule item (Flexible Switch).

### Files touched outside the slices

- `packs/dditems/_source/`: Eidetic Buffer, Fearsome Additions, Partnered; `packs/tfcrbitems/_source/Experiment`;
  `packs/tsitems/_source/`: Dinobot, Maximal, Predacon (rules inserted as text, LF kept).
- `lang/en.json`: removed `E20.Tf1RecallYes`, `E20.Tf1RecallNo`, `E20.Fix3TfSpecializationEdge`.
- `module/rules/conversions.test.js` and `module/rules/conversions-uses.test.js`: one `describe('slB tf1')` block
  appended at the end of each (the Partnered test imports `./actions.mjs` dynamically, so neither import line was
  edited).

No slice file became empty, so `extensions/index.mjs` is unchanged. Inside the slices: `tf1/common.mjs` (the
`eideticBuffer` key), `tf1/combat.mjs` (Fearsome Additions' Bot Mode branch), `tf1/support.mjs` (the Eidetic Buffer
Use, `PARTNERED_RULE`), `fix3-tf/tf-fixes.mjs` (the influence switches, the Experiment Shove source, the
`dinobot` / `maximal` keys) and both slices' test files.

---

## Batch slB, slice tf2: `module/helpers/extensions/tf2/`

**Scope:** every item in the `TF2` id table of `module/items/shared/weapon-target-lookups.mjs` (Technorganic Secrets,
The Enigma of Combination, Transformers Core Rulebook), plus every other place in `module/` that uses those ids.
Outside the slice, only `mechanics/combat/rider-uses.mjs` uses an id from the table (the G.I. JOE printings of All Out Attack
and Evasive Fighting, which are not tf2 items). Several of these items already carry rules from earlier rounds
(Roller Drum's damage, For The Allspark!'s Infiltration ↑1, and the Alt Mode special attacks that tf2 used to grant).
This part looks only at what is still code in the slice.

| Verdict | Items |
|---|---|
| Convert | 0 |
| Partial | 0 |
| Skip | 21 |

That is 21 items with behaviour of their own. Four more table entries are references only. Multiplication doubles
Applied Science's uses. Extra Crew Capacity adds to Cage's capacity. The G.I. JOE All Out Attack and Evasive Fighting
turn off the TF controls when the actor holds both printings. One key, `mutantBeastPerk`, was already unused before
this batch. It is left as it was, as slA did with its unused keys.

No rules were added and no slice code was removed. After this part, `scripts/check-rules.mjs` still counts 1334 rules
on 956 items, with 0 errors and 0 warnings.

### Converted (0)

None.

### Partial (0)

None. One partial was considered and turned down: Broad Understanding outside combat, as a RollModifier with
`specialize` plus a ↓2 with `not:roll:specialized`. The reasons are under Skipped.

### Behaviour differences

None. No behaviour changed.

### Skipped (21)

#### Roll hooks (tf2/rolls.mjs)

- **Broad Understanding** (with **Applied Science**). Science tests count as Specialized when the actor has a Science
  Specialization, and a test outside that Specialization takes ↓2. This holds outside combat, or in combat once
  Applied Science has set its flag. The flag is used up by the next Science roll that qualifies. Applied Science
  allows one use per scene, or two with Multiplication. The old check is `!game.combat`, so a combat that exists but
  has not started counts as combat. The `combat` tag means a combat that has started. The off-combat half alone would
  therefore apply in an unstarted combat. Together with the code that still reads the flag, a flagged actor would then
  get ↓4. *Needs:* a tag for a combat existing (started or not); a one-roll "lift" that Applied Science banks and that
  both of Broad Understanding's rules read; and a Use `limit.max` that depends on another item the actor holds
  (Multiplication).
- **Cage.** A prisoner's Infiltration/Brawn escape tests take ↓2, and a Snag after the captor focuses on them. The
  mark lives in `riderMarks`, and the focus is used up by one roll. The prisoner does not hold the Cage item, so a rule
  would have to reach it from the captor. Capacity is the Alt Mode's Crew rating (+4 with Extra Crew Capacity), or 1 in
  Bot Mode. *Needs:* a "linked by mark" scope (a rule on the marker that applies to the marked actor's own rolls), a
  mark consumed by one roll, and a capacity check on a mark step.
- **Deconstruct (the weapon Snag).** A Snag on attacks with a weapon that carries the `tf2Deconstructed` flag.
  Whoever wields the weapon does not hold Deconstruct. *Needs:* an item-flag mark step, and a rule that applies to
  anyone attacking with a marked item.
- **Diversion (the Snag and the allies' Edge).** The diverted creature takes a Snag when it attacks the diverter.
  The diverter's allies get an Edge against it, and that Edge ends once it has attacked the diverter (updated from a
  post-roll hit). "Ally" means the same token disposition anywhere on the scene, not a radius. *Needs:* an incoming
  mark-reading RollModifier, a scene-wide disposition `ally` scope (aura needs a radius), and a hit Trigger on the
  marked creature that changes the mark.
- **Duke It Out (refused: Edge on tests targeting them).** It reads a `riderMarks` mark that the Use button sets.
  See Duke It Out under Use buttons.
- **Sustained Beam.** It is offered on a hit, once per round, on a chat card with a button. The button costs 1 Energon
  and a Free action, re-rolls the same weapon at the same target with Edge, and is never offered for the follow-up
  roll. *Needs:* hit-card buttons that start a re-attack, and an "is a follow-up" roll tag.
- **All Out Attack / Evasive Fighting (TF printings).** A 0 to 5 number control on your own turn, for Might, Finesse
  or Targeting attacks, which you don't get if you hold the G.I. JOE printing. The count is taken as ↓, also written
  to `options.allOutAttackShifts` (extra damage per target hit), and saved to target-riders' `riderStance` flag until
  your next turn. `DialogSwitch {spend: {max: 5}, downshift: "@spent"}` covers the number box and the ↓. *Needs:* a
  switch step that sets the rider stance and the per-target damage, and a `self:has:` exclusion for the other
  printing (by id, not name, since both printings share one name).
- **Arrogant.** On your first turn of a combat, the attack is cancelled (`dataset.cancelRoll`) when a single target, or
  every target of an area attack, has a lower Threat Level. *Needs:* a roll-cancel / forbid rule decided before the
  roll, with tags that read every target's Threat Level.

#### Use buttons (tf2/uses.mjs)

- **Diversion (the Use).** You pick Deception, Intimidation or Persuasion and then Willpower or Cleverness, and roll
  against the target's Defense. Nested `choose` steps with `roll {difDefense}` could do this part. The mark it sets
  is read only by the roll hooks above, so it can't move without them.
- **Duke It Out.** Once per encounter. It needs a target of your level or higher (an unrated 0 passes), and it is
  refused if you have spent a Standard action this turn. The target accepts or refuses, and a refusal marks it until
  your next turn. The cost is paid after the choice, so cancelling costs nothing. *Needs:* a tag for "Standard action
  not used this turn", and a Use that pays its cost after a `choose` step.
- **Deconstruct.** You pick one of an adjacent enemy's Kit / Gear / Weapon items. It costs 1 Energon and rolls
  Technology against that item's Requisition Difficulty. A Kit is deleted; Gear or a Weapon gets a flag with DIF 10,
  or DIF 20 on a crit. The repair Use is matched by the flag on any item. *Needs:* steps that pick from and act on the
  target's items, and a DIF taken from an item's availability.
- **Determine Probability.** Once per turn in combat, as a Free action. You pick any Skill and make a full dialog
  roll with it. *Needs:* a `roll` step that asks for the Skill and goes through the normal roll dialog
  (`actor._dice.rollSkill`).
- **Energon Bank.** One Energon moves from you to a targeted ally within 30 ft, with no cap on the ally's side.
  *Needs:* `gainResource` with `to`. Also, `gainResource` on a `.value` path stops at `.max`, which the old code
  doesn't.
- **Flexible Directives.** Once per scene, you pick one of your other Perks and chat names it. *Needs:* a step that
  picks one of the actor's own items.
- **Applied Science.** See Broad Understanding.
- **We Are One!** Teammates come from the Party roster, or else from the targets, up to ⌈Social/2⌉. You then pick two
  Skills from different Essences. Every member gets a reroll Active Effect, kept in step through `updateActor` by the
  responsible client. *Needs:* a team-pick step and a linked Reroll grant (a party scope on a Reroll rule, limited to
  the picked members and Skills).
- **Cage.** It imprisons, focuses or releases prisoners, within the capacity. See Cage above.
- **Mutant Beast.** It picks a non-Fuzor Origin and then one of that Origin's Alt Modes, and grants it. It can be used
  while you hold fewer than two Alt Modes. *Needs:* a `pickGrant` that picks a child item of a picked item, and a
  `self:count:altMode<2` gate on the Use (the tag exists as `>=`, so this needs a `not:` of a count).

#### Reactions (tf2/modes.mjs)

- **Roller Drum (the Combiner Health).** In a Combiner form, +1 Health for each component that holds Roller Drum
  (participant row, combined totals, and `health`). *Needs:* a megaform-component link scope for DerivedStat.
- (Not counted: the Mode Lock Energon flush is a Condition, not an id-table item. Its chat button stays.)
- **Dust Up.** Moving on your own turn in a started combat gives the Cover status until your next turn, unless you
  were already in Cover. *Needs:* a Trigger event for moving on your own turn.
- **For The Allspark! (Roll Out).** When you roll Initiative in round 1, not Surprised and not Mode-Locked, you can
  pick one of your Alt Modes and `actor.transform` into it. `initiativeRolled` exists, but `setForm` only flips
  `isTransformed`. *Needs:* a `setForm` that picks which Alt Mode, and `self:status:` gates (or a `check:` name) for
  the Surprised and Mode Lock exceptions.
- **Not Like That, Like This!** A chat-card decorator button lets a holder within 60 ft reroll a teammate's Skill
  Test. The holder then owes a test with that Skill next turn, or loses the Move action. *Needs:* chat-card reroll
  buttons for other actors' rolls, and an "owed" state with turn-start and turn-end handling.
- **Scramble Modulator.** On a hit against a Combiner form, a GM button deals 1 Sonic to the component(s) with the
  most Health. *Needs:* hit-card buttons, and a recipient "the healthiest components of the hit Combiner".
- **Lingering Side Effects.** A warning when a third Alt Mode arrives. *Needs:* a Trigger for another item being
  added (`added` fires only for the rule's own item).

### Engine pieces the skips need

- **Marks read by the marked actor's own rolls**, from a rule on the marker: Cage, Diversion, Duke It Out. A
  disposition-based "ally anywhere on the scene" scope for Diversion's Edge.
- **A tag for a combat existing, started or not**, and a one-roll lift banked by one item and read by another's rules
  (Broad Understanding / Applied Science). A Use `limit.max` that depends on another item (Multiplication).
- **Chat-card buttons** for hit follow-ups, re-attacks and rerolls of other actors' rolls (Sustained Beam, Scramble
  Modulator, Not Like That, Like This!).
- **Steps:** `gainResource` with `to` and no `.max` cap (Energon Bank); a step that picks an own item (Flexible
  Directives); a step that picks a target's item and flags or deletes it (Deconstruct); a full dialog roll with a
  picked Skill (Determine Probability); a `pickGrant` of a picked Origin's child (Mutant Beast); a `setForm` that picks
  the Alt Mode (Roll Out); a team pick with a linked Reroll (We Are One!); a switch step that writes the rider stance
  (All Out Attack / Evasive Fighting).
- **Trigger events:** moving on your own turn (Dust Up), and another item being added (Lingering Side Effects).
- **Other:** a roll-cancel rule (Arrogant), a megaform-component scope (Roller Drum), and a "Standard action unused
  this turn" tag (Duke It Out).

### Files touched outside the slice

Only this file. No pack sources, tests, `lang/en.json` or engine files changed. The `tf2` slice files are also
unchanged.

---

## Batch slB, slice tf3: `module/helpers/extensions/tf3/`

**Scope:** every item in the tf3 id table (`TF3` in `extensions/tf3/common.mjs`): Transformers Core Rulebook and
Transformers One Sourcebook items. Each was checked against the slice's code and every other use of its id in
`module/` (`items/healing/patch-up.mjs` also reads Intensive). `TF3.multiplication` is not read by any tf3 code: it is an
unused reference (Multiplication's code lives in tf2, other3, flashy.mjs, skill-substitution-perks.mjs and
augment-power.mjs), so it is left as it was and not counted. `TF3_WEAPON` holds the compendium weapons the Alt Mode
Gear "counts as" (references only).

| Verdict | Items |
|---|---|
| Convert | 1 |
| Partial | 1 |
| Skip | 21 |

That is 23 items. This slice added 3 rules to 2 pack items. After it, `scripts/check-rules.mjs` counts 1337 rules on
958 items (the base `rules/slA` had 1334 rules on 956 items), with 0 errors and 0 warnings.

### Converted (1)

| Item | Rules | Why it is exact |
|---|---|---|
| Helical Spring | Two Triggers: `untransform` and `transform`, each a `chat` step with the reminder for that direction | The old code was a chat reminder posted from tf3's `updateActor` hook when `system.isTransformed` was in the change, by the user who made the change. The rules engine's `transform` / `untransform` events come from the same hook, with the same check (`hasProperty(changed, 'system.isTransformed')`) and the same same-user test. The direction is read from `actor.system.isTransformed` in both. `TF3.helicalSpring`, its block in `onConverted`, and the strings `E20.Tf3HelicalAlt` / `E20.Tf3HelicalBot` have been removed. |

### Partial (1)

| Item | Converted | Rule | Still code |
|---|---|---|---|
| Training Through Familiarity | Trained in Limited weapons for Requisition | Qualification `access: trained`, items `item:type:weapon` + `item:data:system.availability=limited` | The Kit prerequisite waiver (`onKitPrerequisite` on `essence20.kitPrerequisite`). There is no rule type for Kit prerequisites. |

Why the Qualification is exact:

- **Same hook.** Both answer `essence20.requisitionAccess`, and both only raise `out.access`. The two listeners
  rank `none` and `unknown` in a different order, but `trained` is above both in each, and the result is the best
  answer across all listeners whatever order they run in.
- **Same test.** The old code read the RAW `item.system.availability == 'limited'` (default `standard`) on a
  `weapon`. The rule uses `item:data:system.availability=limited`, which reads the same field. It does not use
  `item:availability`, which would read the effective tier (lowered by Qualified upgrades) and differ.
- **With Unassuming / One Bot Over Another.** Those still answer `qualified` from the tf3 listener, which beats
  `trained` as before.

### Behaviour differences

1. **Helical Spring's chat card** (same-line: the item itself). It now reads "**Helical Spring**" on one line and
   "<name> can ..." on the next, where it read "Helical Spring: <name> can ...". The text is fixed English in the
   rule rather than a localized string, and the header is the rule's label, not the owned copy's name (a renamed
   copy shows "Helical Spring").
2. **Helical Spring's card order** (cross-line within Transformers only). The card is now posted by the rules
   engine's `updateActor` handler instead of tf3's. When the same Convert also makes tf3 post a card (Unexpected
   Alternative's Edge) or re-equip an Alt Mode Gear weapon, the cards can come in a different order. Nothing reads
   the order.
3. **Item copies.** The rules apply once per copy of the item and travel with the item's data; the old code matched
   the compendium source id once. Two copies of one Perk are not an ordinary build. A Perk created by hand without
   the source id but with the rules now works.

No existing conversion test changed. The tf3 test "Unassuming qualifies one-handed Limited weapons; Training Through
Familiarity trains Limited" lost its Training Through Familiarity half, which moved to the `slB tf3` block in
`module/rules/conversions.test.js`.

### Skipped (21)

- **Holographic Doubles.** A count of doubles per scene (Standard action for the first, Free for each more, up to 8),
  ↓1 per double on attacks against the holder, and one double lost on each of the holder's rolls and on each missed
  attack against them. *Needs:* a counter resource with a scene expiry, read as a formula on an `incoming`
  RollModifier, and Trigger events for "an attack against me missed".
- **Intensive.** A successful Technology Patch Up offers the same Repair to every other injured ally within 30 ft (a
  chat button). `items/healing/patch-up.mjs` also reads its id to lift the once-per-turn Patch Up limit. *Needs:* a Patch Up
  event carrying the amount, and a `check:` or rule hook for patch-up.mjs's limit.
- **Irrefutable Order.** A level-gated Persuasion test against a chosen Defense, a typed one-word order, and the
  target's Move action spent when its next turn starts. *Needs:* a text prompt step, a step that spends another
  actor's action at its next turn start, and a `target:levelDiff` gate on a Use.
- **Ladder.** The Alt Mode Use (extend/stow, scene-scoped), allies of the same or smaller size using another actor's
  ladder (↑2 switch, world-wide, no range), and the Bot Mode unarmed Reach ×2. *Needs:* a scope for "any allied actor
  with this state" and an actor-Reach formula ref (`@reach`) for an ItemModifier on unarmed effects.
- **Last Stand.** On Defeat in combat: a chat button that marks "acting while Defeated" this turn, grants a Standard
  and Move action, and targets the attacker. *Needs:* a step for the act-while-Defeated stamp and an "attacker"
  recipient on `defeated`.
- **Martyr.** On Defeat in combat, every ally gains an Edge for the rest of that combat. *Needs:* a combat-scoped
  mark that a `party`/ally-scoped RollModifier on the holder can read after Defeat.
- **No Escape.** An enemy's move ending inside the holder's melee Reach offers a free attack. *Needs:* a Trigger
  event for other tokens' movement, and a melee-Reach value.
- **Roll With It.** Once per turn, on damage that doesn't Defeat, a chat button pushes the holder 10 ft away from the
  attacker. *Needs:* a push / forced-movement step and the attacker as a recipient on `takesDamage`.
- **Rotor Blades.**
  - The Bot Mode ↑1 (Trained with a Close Combat Heavy Blade) on attacks with the generated weapon. *Needs:* a
    `weapon:` tag for "this weapon was granted by the rule's item" (its `flags.essence20.grantedBy` is the gear's id,
    which a static tag can't name).
  - The +1 damage against organic targets (hit rider). *Needs:* an organic-creature tag.
  - The Alt Mode Aerial = half Ground. `ruleDerived` runs before some hand-written derived hooks (situational2,
    tf2, zord1/zord2 among them, per slA), which can change Ground before tf3's hook reads it. *Needs:* a late DerivedStat stage (same as slA's Additional Pair of Limbs / Carapaced).
  - The weapon Use and the equip/stow on Convert. *Needs:* steps that equip or stow a granted item on mode change.
- **Stoic.** A chosen −1..−3 Evasion until the holder's next turn, Toughness attacks met with Evasion, and that many
  Free actions for each ally next turn. *Needs:* a Use that stores a picked number for a Defense formula, a Defense
  `mode` that swaps Toughness for Evasion, and a next-turn action grant for allies.
- **Synch Up.** Once per turn, when an ally's attack misses a target within the holder's range, a reaction attack.
  *Needs:* Trigger events for other actors' misses and an attack-range value.
- **Target Breakdown.** Free actions equal to the Analyze Target count on the target, banked as ↑N on a picked
  ally's next attack against that target only. *Needs:* `@` refs for the Analyze Target count, a repeated action
  cost, and a bank `appliesWhen` that names a specific target.
- **The Right Of All Sentient Beings.** The protect switch (only while no fall is recorded in this combat), the Use
  that records the fall, and the Edge for the rest of the combat. The old gates read `game.combat` (any combat, even
  unstarted) and the combat's id. The `combat` tag needs a started combat, and a mark with `until: encounter` uses the
  scene clock's encounter epoch. *Needs:* `until: "combat"` (the current combat's id) and a tag for "a combat exists".
- **Third Dimension.** Changes how `essence20.movementUsed` counts distance after a movement-type change. *Needs:* a
  MovementAction option for it.
- **Tow Cable & Hook.** The Bot Mode ↑1 switch on attacks with the generated Grappler. *Needs:* the same "granted by
  this item" `weapon:` tag as Rotor Blades. The weapon Use / equip swap too. (Its Alt Mode Edge was already a rule.)
- **Unassuming.** Qualified in one-handed Limited weapons. *Needs:* a tag for "every weapon effect is one-handed"
  (`numHands` on the weapon's effects or its `system.items`).
- **Unexpected Alternative.** Tracks which Alt Modes each enemy on the scene has seen, then gives an Edge against
  enemies seeing the second for the first time until the end of the next turn. *Needs:* per-enemy seen-mode memory.
- **Water Cannon.** The generated rifle uses one hardpoint instead of two. *Needs:* a Hardpoints option that lowers
  a specific weapon's slot use. The weapon Use / equip swap too. (Its Alt Mode Edge was already a rule.)
- **Whisper Campaign.** A Deception (Edge) vs Persuasion contest against the targeted creature, with a GM chat button
  when this user can't roll for the target. *Needs:* a contested-roll step.
- **Deceptive Warfare.** The Initiative reset Use (round 2+, two Free or a Move action, keep the better place).
  *Needs:* an Initiative-reset step. (Its Deception/Infiltration Initiative switches were already rules.)
- **One Bot Over Another.** A plan pick (Limited melee + Limited projectile, or one Restricted) from the compendium,
  stored on the Perk and read as Qualified. *Needs:* a `pickGrant`-style picker that records a choice instead of
  granting, plus a Qualification tag reading the recorded uuids.

### Engine pieces the skips need

1. **A "granted by this rule's item" weapon tag** (Rotor Blades ↑1, Tow Cable ↑1). This is the smallest gap: it
   would convert two roll bonuses.
2. **Combat-scoped marks and a "combat exists" tag** (The Right Of All Sentient Beings, Martyr).
3. **Trigger events for other actors' actions:** an ally's miss (Synch Up), an attack against me missing
   (Holographic Doubles), enemy movement into Reach (No Escape).
4. **A late derived stage** (Rotor Blades' Aerial), shared with slA.
5. **Forced-movement and contested-roll steps** (Roll With It, Whisper Campaign), and an Initiative-reset step
   (Deceptive Warfare).
6. **Requisition tags:** one-handed weapons (Unassuming), a recorded-picks Qualification (One Bot Over Another).
7. **Kit prerequisite rules** (Training Through Familiarity's other half).
8. **Hardpoint use per weapon and actor-Reach formulas** (Water Cannon, Ladder).

### Files touched outside the slice

- `module/rules/conversions.test.js`: the `// slB tf3` block, appended at the end (no import change; `fireTriggers`
  is imported inside the test).
- `lang/en.json`: `E20.Tf3HelicalAlt` and `E20.Tf3HelicalBot` removed.
- Pack sources: Helical Spring and Training Through Familiarity (`packs/tfcrbitems/_source`).
- `extensions/index.mjs` is unchanged: no tf3 file became empty.

---

## Batch slB, slice other2: `module/helpers/extensions/other2/`

**Scope:** every item in the other2 id tables: `O2_DD` (`decepticon.mjs`), `O2_MED` (`medic.mjs`), `O2_GIJ` (`gij.mjs`) and
`O2_MAGIC` (`magic.mjs`). Each item was checked against the slice's code and every other use of its id in `module/`.
Two entries are references only and are not counted: I've Got You (`O2_MED.iveGotYou`: the Heal action hands its result
to `i-ve-got-you.mjs`) and Fireball (`O2_MAGIC.fireball`: on More Bang for your Buck's list of elemental spells). The
two-light-weapons select and the Armored Cabin cancel are not keyed by an item id, so they are not counted either.

**Counts** (27 items):

| Verdict | Items |
|---|---|
| Convert | 1 |
| Partial | 0 |
| Skip | 26 |

1 rule was added to 1 pack item. After this slice, `scripts/check-rules.mjs` counts 1335 rules on 956 items (the base
was 1334 rules on 956 items), with 0 errors and 0 warnings. No slice file became empty, so `extensions/index.mjs` is
unchanged.

### Converted (1)

| Item | Rule | Why it is exact |
|---|---|---|
| Peaceable (Hawk's Personnel Files) | RollModifier ↑1, `when: [{any: ["roll:dataset:isIveGotYou", "roll:dataset:isMindOverMatter", "roll:dataset:isRegeneration", "roll:dataset:isPatchUp", "roll:dataset:isPreventativeMeasures", "roll:dataset:isToughItOut", "roll:dataset:o2Heal"]}]` | The old roll source tested `dataset[flag] && dataset[flag] !== 'false'` for those seven flags. `roll:dataset:<key>` tests `!!value && value !== 'false'`. The old source and the rule's source both come through `extRollSources` (the adapter's `ruleRollSources` is a registered roll-source hook), so they reach the dialog in the same place. Every caller passes a dataset (`_getAutomaticCombatModifiers` defaults it to `{}`; Initiative passes its own), so the tag never answers "unknown". |

Removed: the Peaceable roll-source hook, `HEAL_FLAGS`, `isHealingRoll`, `O2_MED.peaceable`, the `registerRollSources` and
`findSourced` imports in `medic.mjs`, and the `isHealingRoll` lines of the medic test in `other2.test.js` (that test was
renamed "restore DIF"). Peaceable's two attack rules were already on the item.

### Behaviour differences

1. **Label and id.** The source is labelled "Peaceable (healing)" (it was the item's name) and carries a rule id
   (`ext-rule-<item>-2`) where it had `ext-o2Peaceable`. Rule sources are listed after the hand-written extension
   sources, so only its place in the dialog's list changes. Same-line (Peaceable alone), but label and order only.
2. **Initiative.** Initiative reads rule sources but never read extension roll sources. An Initiative dataset has none of
   the healing flags, so nothing changes in practice.

### Skipped (26)

#### Decepticon Directive (`decepticon.mjs`)

| Item | Why |
|---|---|
| Junkplate | **Sharp unarmed hits** are changed on the hit card (Blunt only, the crit-repeat option included). A DamageType rule is decided when the roll is made, also feeds the Resistance Snag, and doesn't test "was Blunt". **The fumble retaliation** (1 Sharp to the attacker whose unarmed attack Fumbled against the wearer) is a post-roll hook on the attacker. No Trigger event fires on the defender for another actor's Fumble. |
| Pit Plate (Sharp half; its ↑1 Intimidation was already a rule) | The same hit-time Sharp change as Junkplate. |
| Rust Derivatives | A hit flags the target, a `preUpdateActor` veto blocks Health gains, and a chat-card button runs the DIF 20 cure. Needs a "can't regain Health" state (a heal veto) and a chat-card action rule. |
| Stasis Cuffs | Vetoes converting and Energon spending while cuffed, a tether with its own Health regenerating each round, and Break/Release chat buttons. Needs a pre-update veto rule and chat-card actions. |
| Grant His Hunger | `1d2` Energon loss or Essence damage to a random Essence. Formulas have no dice, and there is no Essence-damage step. |
| In His Image | Swaps a Defeated target's Hang-Ups for picked ones (create and delete items on another actor), once per target. No step removes or replaces items. |

#### Healing (`medic.mjs`)

| Item | Why |
|---|---|
| Hearty Meal | Its Culture/Performance choice lives in the Heal action's own dialog (once per mission, out of combat). `banked-buffs.mjs` also keys a separate dispatch on its id. No rule type adds a Skill to a named action's skill list. |
| Proper Protection | Poison/Disease immunity only while a medicine kit is carried (`kits.mjs#activeKits`), plus the Poisoned veto and the cure crit note. Needs a `check:` name for "carries a medicine kit" (and a boolean Immunity derived stat); the crit note is inside the Heal action. |
| Stim Dart | One dart per mission plus one per carried "stim dart" item, a range-dependent attack roll, then heal-or-temporary-Health by the target's Defeated state. Needs a Use limit counted by carried items, and a step branch on the target's state. |
| Defibrillator | A six-round delayed heal tracked across round starts, then the item's quantity used up. Needs a delayed-step Trigger and a consume-item step. |

#### GI Joe / Factions in Action / Hawk's / Intercontinental Adventures (`gij.mjs`)

| Item | Why |
|---|---|
| Support, Tech Support | Lends a temporary copy of a picked Upgrade (onto a picked weapon) to an ally until the lender's next turn, or the scene. Needs a "pick an owned item and grant a copy to the target" step. |
| Extended Support | Changes Support's action cost and duration inside that same Use. |
| Laser Designator | The ↑2 goes to **anyone** rolling Targeting against the designated target, not just the holder. A rule on the Designator only reaches its holder; a mark's `target:marked:` tag is read from rules the roller holds. Needs a mark that carries its own roll modifier for every roller. `companions.mjs` also keys on the id. |
| Yo Joe! (Battle Cry) | +10 Ground in round 1 while no Standard action was spent this turn, refreshed on combat updates. Needs a round-number tag and an action-ledger tag in derived data. |
| Bio-Tech Armor | An equip warning (`preUpdateItem`) that allows two armors for a qualifying pair. Needs an equip-veto rule. |
| Big Rigger, Bigger Rigger | The cancel is on the **attacker's** roll, by the driver of the targeted vehicle, against the Defense named. An incoming RollModifier lives on the target (the vehicle), not its driver. Needs an incoming scope through the `driven` link, and a size-matrix shift value in formulas. |
| Gunport | The ↓1 needs the upgrade's host to be an equipped shield that is active (or a weapon with the Shield trait). Roll-time rules can't read the host's data (`host:` tags are prerequisite-only), and a loose Gunport would count for a rule but not for the old code. Needs `host:` tags at roll time. |
| Delegate | Refunds a picked use record on an ally (scene-clock counters / turn stamps). No step edits another actor's use records. |
| Explosive Engineer (Hang-Up) | Switches off two dice.mjs dialog flags on a grenade attack. No rule type can clear another option's flag. |
| Frequency Interference | Jams a picked Computerized item (contested roll by the operator, or the item's Availability DIF), with a reboot chat button, a roll cancel and an armor Defense removal. Needs item-state steps, a roll-cancel rule and chat-card actions. |

#### Magic (`magic.mjs`)

| Item | Why |
|---|---|
| Thorn Warlord | "Can't be defended with Toughness": the old hook adds Evasion − Toughness as a separate defense adjust, after `ruleDefenseAdjust` has reshaped the Defense. A Defense rule's amount is added before the `best` / `halve` reshaping, so the results differ against such Defenses (the same reason Flames of Hate was skipped in slA). Needs a "use this Defense instead" mode, or an add that lands after the reshaping. Its other half in `dice.mjs` is outside this slice. |
| More Bang for your Buck | +1 on each successful damaging result of an elemental spell, after the roll, not multiplied. A scaled DamageModifier is multiplied by Degrees of Success; an unscaled one is the post-hit note. Temper Tempest's strike also reads it. Needs a flat post-roll damage add for spells. |
| Temper Tempest | A storm state with turn-start chat cards (strike up to 3 targets, Stress, DIF 20 calm). Needs chat-card actions and a persistent state with turn-start cards. |
| Sorcery (Build a Sorcerous Power) | A builder dialog that creates a Power item from data. No "create an item from data" step. |

### Engine pieces the skips need

1. **Chat-card action rules** (buttons on a card that run steps): Rust Derivatives, Stasis Cuffs, Frequency Interference, Temper Tempest.
2. **Pre-update vetoes** (no healing, no converting/Energon spend, equip warning): Rust Derivatives, Stasis Cuffs, Bio-Tech Armor.
3. **Item-changing steps** (grant a copy of a picked owned item to another actor, replace items, create from data, use up quantity): Support/Tech Support, In His Image, Sorcery, Defibrillator.
4. **Hit-time damage-type overrides** (Blunt → Sharp on the hit card): Junkplate, Pit Plate.
5. **`host:` tags at roll time**: Gunport.
6. **A mark that modifies everyone's rolls against the marked actor**: Laser Designator.
7. **Incoming rules through the `driven` link**: Big Rigger, Bigger Rigger.
8. **A Defense "use instead" mode / add after reshaping**: Thorn Warlord.
9. **Dice in formulas**: Grant His Hunger.
10. **Round-number and action-ledger tags**: Yo Joe!.
11. **A `check:` for a carried medicine kit**: Proper Protection.

### Files touched outside the slice

- `packs/ghpfitems/_source/Peaceable_BHum6Sd6Zz7cra5b.json`: one rule line added to the existing `rules` array.
- `module/rules/conversions.test.js`: the `// slB other2` describe block, appended at the end.
- No lang strings became unused. `extensions/index.mjs` is unchanged.
