# Batch regB - dice.mjs `rollSkill`, after the Roll Options Dialog

Scope: the id-keyed checks in `module/dice.mjs#rollSkill` from `getSkillRollOptions(...)` to the end of
`rollSkill` (before `_actorHasPerk`). 152 id constants are referenced there (96 in code, 56 only in
comments pointing at their checks elsewhere), plus the `PRIME_DEFENSE_SNAG_PERKS` table (3 Perks), the
`DOWNSHIFT_IMMUNITY_GEAR` table (2 gear items) and `RIDER.precisionIsPerfection`. Leaving out the three
constants that are not items in their own right here (`LONG_RANGE_RIFLE_ID` belongs to Drilling Shot,
`SORCERY_PERK_ID` / `ZORD_PERK_ID` are only named in a JSDoc), that is 155 items.

| Verdict | Count |
|---|---|
| convert | 5 |
| partial | 0 |
| skip | 150 |

## Converted

Each one was a `difficulty += N` on the TARGET's side of the per-target `checkEntries` construction.
Now each is a `Defense` rule on the item, read per attack by `rules/adapter.mjs#ruleDefenseAdjust`
through `riderDefenseAdjust`. A `defense:` tag in each `when` makes the rule roll-time only, so it never
lands on the sheet, the same as the old code. The `{any: [defense:toughness, ...evasion, ...willpower,
...cleverness]}` entry is how that is said for "every Defense".

| Item | Rule | Notes |
|---|---|---|
| Skier (ghpf) | `Defense evasion +1`, when `defense:evasion`, `check:skiing` | Exact. The old line sat after Roll With the Punches' doubling, with only additive terms between it and `riderDefenseAdjust`. Skier's Use button (banked-buffs.mjs) and Movement rule are unchanged. |
| Stronger Together (tfcrb) | `Defense any`, amount `@count.allies.60` | Its banked self-reduction (an existing Use rule) is unchanged. |
| Heroic Intervention (prcrb) | `Defense any +1`, when `ally:within:5` | The Story Point / move Use (banked-buffs.mjs) is unchanged, and the disabled Active Effect stays disabled. |
| Environmental Armor (gijcrb) | `Defense any +1`, when `check:environmentalExpertise` | The disabled Active Effect stays disabled. |
| Impenetrable Armor (gijcrb) | `Defense any +2`, scope `driven`, when `self:type:vehicle` | Only the dice.mjs half. The interpose.mjs redirect stays code (outside this region). |

Code removed: the five `difficulty +=` blocks, the constants `SKIER_ID`, `STRONGER_TOGETHER_ID`,
`IMPENETRABLE_ARMOR_ID`, `ENVIRONMENTAL_ARMOR_ID` and `HEROIC_INTERVENTION_ID`, and the `isSkiing` import in
dice.mjs. From dice.test.js: the Skier, Impenetrable Armor, Environmental Armor and Heroic Intervention
describes, and Stronger Together's three per-ally tests. Its banked-reduction test is kept, now with no
ally, expecting 9.

New tests: `module/rules/conversions.test.js`, describe `regB: per-attack Defense rules`. They assert what
the old tests did (per Defense, with and without the condition, and that the bonus doesn't touch the
sheet), plus a range edge for each ally count and the passenger / Zord / no-Perk-driver cases.

### Behaviour differences

- **Order against Roll With the Punches.** Stronger Together, Heroic Intervention and Environmental Armor
  used to be added BEFORE that doubling (`difficulty *= 2`). The rule is added after it. So a target
  holding one of them while a banked Roll With the Punches is consumed now gets `2×base + N` instead of
  `2×(base + N)`.
  - Roll With the Punches is a GI Joe Renegade Perk (and Slammer's). Stronger Together is Transformers
    and Heroic Intervention is Power Rangers, so those combinations cross lines.
  - Environmental Armor is GI Joe, but on the Predator Focus rather than Renegade.
  - Impenetrable Armor (a vehicle target) and Skier (already after the doubling) are unaffected.
  - Nothing else between the old and new positions is multiplicative or a reset; the only other line
    there is the Trustworthy Infinity, which is unaffected.
- **Counting allies.** Stronger Together and Heroic Intervention count allies through the
  `alliesWithin` world lookup, which is `getNearbyAllyTokens` (Frenemy, Betrayal and Ally Awareness
  included). The engine de-duplicates by actor and drops the actor's own extra tokens; the old code
  counted tokens. Two tokens of one linked ally used to count twice and now count once.
- **More than one driver.** Impenetrable Armor used to read only the first driver entry
  (`getVehicleDriver`). The `driven` scope reads every crew entry with the driver role. That differs
  only if a vehicle lists two drivers.

## Skipped (150), by reason

### The id check lives in another region, or its effect is consumed there

- **Checkbox Perks whose id check (the `xxxAvailable` flag) is in the pre-dialog region (regA).** These
  ids appear in this region only in comments, on the post-dialog consequence. Converting them means
  removing regA's offering code, so they are left to that batch to avoid conflicting edits:
  - Always Ready, Ambitious, Analyze Target, Angry (and its Hang-Up), Beloved, Bring It All Down,
    Bump & Run, Catch Off Guard, Caution To The Wind, Coax Surrender, Cost of Sorcery, Crippling Blow,
    Cunning Plan;
  - Deceptive Warfare, Deconstructionist, Dependable, Dependable Tanker, Devastating Strike,
    Dirty Blows, Double Agent;
  - Eltarian Tech, Eureka (PR), Exterminator, Fast Draw, Get A Grip, Get The Horns, Grinder,
    Guardian Strikes, Hacking Algorithms, Heavy Force, Hobble;
  - Instill Weakness, Interdiction, Inventor, Isolated, I Remember Reading About, Kind But Firm,
    Menacing Glare, Military Formality, Misled (Hang-Up), Mystical Understanding;
  - No Factor, Old Reliable, Pointy, Pressure Cooker, Programmable, Rumble in the Jungle,
    Savant Skill, Stick In The Spokes, Talk Them Down ×2, Terrifying Presence;
  - Time Traveler (Perk and Hang-Up), Withering Fire and Worth A Shot.

  Many of them also carry an attempt flag that `_rollSkillHelper` (regC) consumes after the roll.
- **Attempt flags read after the roll by `_rollSkillHelper` (regC) or chat.mjs.** Converting needs the
  consumer removed in regC:
  - Stunning Surprise, Undo Engine, Leech Siphons, Ice Flechettes, Avalanche Stomp (weapon effect);
  - Stay Humble, Snarl, Might Makes Right, Predacon;
  - Supportive / Extra Supportive / Super Supportive Friend (and the Empathy choice they read);
  - Everything Is Inspiration, Outfoxed, Shoots and Scores, Vibrating Palm, 'Til All Are One,
    But I Should Know That, Instinctual Caster;
  - Sucker Punch, Flashy, Explosive Aftershock, Brute Force Works Best, Roaming the Land (Stun half),
    Debilitating Strike, Shock and Awe, No Fighting?! (Hang-Up).
- **Damage-bonus label lookups only** (`findPerk(...)?.name` for the card's damage-source list). The
  bonus itself comes from a bank, checkbox or helper that stays code, and each label goes when its
  item converts: Now I'm Angry, Demolition Driver, Combat Stance, Retribution, Psycho Assault,
  Growing Smolder, Oorah!, Goin' Heels, Tear Down, Emotional Mastery, Ricochet, Size Matters,
  Penetrating Shot and Quiet as the Grave.
- **Show Of Hands.** It marks a scene flag here for its Edge grant elsewhere; it would need a mark step
  plus that grant to convert together.

### Needs an engine piece

- **Order inside the Defense computation.** The old code adds Bulked Up Frame BEFORE the Defense
  recomputes (Armor Piercing, Drilling Shot, Quantum Cut, Charge It Up, Exploit Weakness and others
  reset `difficulty` and drop it) and before the Evasion substitutions. A rule lands after them.
  - Needs: a Defense-rule phase before the recomputes.
- **Use the better Defense.** Psychological Warfare, Scapegoat (once per scene), Evasive (IAF2),
  Tactical Gymnastics (plus its Acrobatics-ranks Evasion bonus) and Split-Second Reaction swap in
  `max(current, other Defense)`. Over the Candlestick (Agile Reflexes) swaps Evasion in once per
  encounter.
  - Needs: a Defense-substitution rule type.
- **The attacker lowers the target's Defense.** Shatter Resolve (−2 Willpower / Cleverness on
  Deception / Persuasion).
  - Needs: an outgoing Defense modifier on the attacker.
- **Ignore part of the armor.**
  - Penetrating Aim and Metallikato ignore N armor points. Needs: an ignore-armor-points piece; both
    are also checkbox-gated in regA.
  - Drilling Shot (with its Long Range Rifle) ignores Defense bonuses. This is already a known gap.
  - Weak Point gives Armor Piercing / Anti-Tank to every melee attack, unarmed included. A WeaponTrait
    rule only reaches weapons, so unarmed attacks would lose it.
- **Forced failure or a halved Defense.**
  - Just the Facts and Trustworthy (the roller's half) set the difficulty to Infinity.
  - Unseen Strike halves Evasion and marks once per turn.
  - Augmented (Hang-Up) halves the Defenses against the chosen damage type.
  - Needs: a difficulty-override piece.
- **A Snag after the dialog, keyed on the settled Defense.** Silver, Graphite and Orange Ranger Prime set
  the attacker's Snag after the dialog, before Ambitious / Observer can clear it. An incoming
  RollModifier is decided before the dialog, and its Snag is an informational source.
- **Downshift immunity at a later point.** Emergency Care Equipment and Vehicle Repair Equipment zero
  `shiftDown` after Observer, Ricochet, Saber-Toothed and the die-substitution deltas.
  `immune: ["downshift"]` applies earlier, in `runApplyDialog`.
- **Roll mechanics with no rule piece:**
  - Silver Tongue (d20 floor of 10);
  - Kill Shot and Precision is Perfection (a third d20);
  - Super Specialized (a step up after the final shift, after the caps and autofail);
  - Advantageous Fighter (caps the total downshift at 2 with Edge);
  - Storm of Lead (Fanning's first-shot ↑1, inside items/attacks/fanning.mjs).
- **Energon box consequences:**
  - Imaginative Engineering (↑1 extra when the core Energon box is ticked, once per round). Needs: a tag
    for that box.
  - Energon Efficiency (a d6 refund on the last Energon Point).
- **Hard Hitter.** Edge when the damage Role Points box is ticked on that specific Role Points item.
  Needs: a tag for the ticked damage Role Points item.
- **Force (and the Fleeting Energy Hang-Up).** A once-per-encounter scaled damage bonus that also banks
  a ↓1. Needs: `limit` on a scaled DamageModifier, plus a side-effect bank.
- **Damage-type overrides.** Cryogenic Touch (Power), Ninja Power, Saber-Toothed, Tooth And Claw ×2,
  Energy Affinity and Bear Hug. Needs: a damage-type override rule.
- **Ultimate Magna Defender (Defender Torozord).** No scope reaches a Megaform from the Ranger who formed
  it.
- **Titan Body (Zord Feature).** A damage floor, not a bonus.
- **Sudden Strike.** Sneak Attack eligibility (sneak-attack.mjs), already a known gap.
- **Pay It Forward.** The `aura` scope stacks per holder (old: +1 once however many holders) and doesn't
  count allies the `getNearbyAllyTokens` way.
  - Needs: a non-stacking aura that counts allies the system way.
- **Without a Word.** Needs a tag for "an enemy anywhere has one of these statuses".
- **Not On My Watch.** Needs a check `defeatedAllyInReach` (items/defenses/not-on-my-watch.mjs#hasDefeatedAllyInReach).
  The existing `nearbyDefeatedAlly` is Field Aid's unlimited range.
- **The Dependable Hang-Up.** It only gates the Dependable checkbox (regA).
- **Spell damage tables:** Energy Beam, Lancing Beam, Explosive Beam, Beam Volley and Fireball (KoC).
  These are not rules work: they belong on the spell's own authored `damageValue` / `damageType`, which
  already wins over the table. The `element` type's resolution needs checking first.

## Engine features the skips would need (summary)

1. Post-roll / attempt-flag consumers as Triggers. This is the regC side, and the biggest group.
2. A Defense-substitution rule ("use the better of these Defenses", optionally limited).
3. An outgoing Defense modifier (the attacker changes the target's Defense).
4. Defense-rule phases inside the per-target construction: before the recomputes, before the
   Roll With the Punches doubling, and a difficulty override (Infinity / halve).
5. An ignore-armor-points piece.
6. A damage-type override rule.
7. Dice-formula pieces: a d20 floor, an extra d20 with Edge, a shift cap, and a post-final shift step.
8. A post-dialog Snag keyed on the settled Defense.
9. `limit` on scaled DamageModifiers.
10. A non-stacking aura that counts allies via `getNearbyAllyTokens`.
11. Checks `defeatedAllyInReach` and "enemy with status anywhere".
12. Tags for the core Energon box and for the ticked damage Role Points item.
