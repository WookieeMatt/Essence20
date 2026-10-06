/**
 * Threat creation and audit rules - the maths behind apps/threat-builder.mjs.
 *
 * Four rule sets, because the books disagree with each other:
 *
 * - fieldGuide: Field Guide to Action & Adventure, "Creating Threats" (p.144-150). The original,
 *   shared by G.I. JOE, Power Rangers and Transformers. Health by Threat type, Size limits, Perks
 *   on a per-type cadence, Powers bought with Perks, up to 2 Hang-Ups each worth a Perk, and
 *   extra Smarts/Social Essence for Threats that do more than fight.
 * - finster: Finster's Monster-Matic Cookbook, "Threat Creation" (p.11-19). The Power Rangers
 *   rewrite: a flat Perk cadence adjusted by type, "Advanced" Essence for TL4+, at least one
 *   Hang-Up, and two extra steps (Equipment, Does it Grow?).
 * - canterlot: Knights of Canterlot (My Little Pony), "Creating Statistics and Abilities" (p.64).
 *   Threat Level -> Essence, an attack, 1-2 Perks - and "more than that, raise the Threat Level".
 * - vehicle: G.I. JOE Factions in Action, vehicle creation: Strength and Speed only, Threat Level
 *   + 3 Essence points; with an A.I. (Smarts and Social) the ordinary Threat Level x 2 + 6.
 *
 * Also from the developers' own threat spreadsheet (the "DIFs" sheet the user shared, 2026-09-30),
 * not printed in any book: Animal Threats get 75% of the usual Essence points, an Essence score
 * can be worked out from the skill ranks under it (the "skills first" route the books mention in
 * passing), and a typical and a maximum skill die for each level.
 *
 * All four read Threat Level the same way (Essence = TL x 2 + 6, so TL = (Essence - 6) / 2 - the
 * Knights of Canterlot spells out that reverse, which is what the audit leans on).
 *
 * Every number here is guidance: each book says to bend its own rules. The builder shows where a
 * Threat departs from them; it never refuses one.
 *
 * Pure - no Foundry globals - so all of it is unit-tested.
 */

export const ESSENCES = ['strength', 'speed', 'smarts', 'social'];
export const THREAT_TYPES = ['typical', 'resilient', 'canny'];
export const MOVEMENT_TYPES = ['aerial', 'swim', 'climb', 'burrow'];

/** Defense -> governing Essence, as data/actor/templates/character.mjs builds them. */
export const DEFENSE_ESSENCES = {
  toughness: 'strength',
  evasion: 'speed',
  willpower: 'smarts',
  cleverness: 'social',
};

/** Skill -> Essence, mirroring CONFIG.E20.skillsByEssence (Spellcasting/Weird can draw on any). */
export const SKILLS_BY_ESSENCE = {
  strength: ['athletics', 'brawn', 'intimidation', 'might'],
  speed: ['acrobatics', 'driving', 'finesse', 'infiltration', 'initiative', 'targeting'],
  smarts: ['alertness', 'culture', 'science', 'survival', 'technology'],
  social: ['animalHandling', 'deception', 'performance', 'persuasion', 'streetwise'],
};

/** A skill rank's cost in skill points: one per step up from untrained (d20). */
export const SHIFT_COST = { d20: 0, d2: 1, d4: 2, d6: 3, d8: 4, d10: 5, d12: 6, '2d8': 7, '3d6': 8 };
export const RANKED_SHIFTS = ['d2', 'd4', 'd6', 'd8', 'd10', 'd12'];

/** The size ladder, tall then long, as the Field Guide's "+1 Size Class" Perk climbs it. */
export const SIZE_LADDER = ['small', 'common', 'large', 'huge', 'gigantic', 'towering', 'titanic'];

/**
 * Where a Threat sits against the party (Field Guide p.146; Finster's p.12): an interesting
 * lackey 2 below, a special lackey 1 below, the lackeys' leader level with them, the second-most
 * significant fight 1 above, the mastermind 2 above.
 */
export const ROLE_PRESETS = {
  lackey: -2,
  specialLackey: -1,
  leader: 0,
  lieutenant: 1,
  mastermind: 2,
};

export const RULESETS = {
  fieldGuide: {
    key: 'fieldGuide',
    source: 'Field Guide to Action & Adventure p.144-150',
    healthRule: true,
    sizeRule: true,
    socialBonus: true,
    advancedEssence: false,
    perkCadence: { resilient: 4, typical: 3, canny: 2 },
    powersCostPerks: true,
    hangUps: { min: 0, max: 2, perkEach: 1 },
    equipmentStep: false,
    growStep: false,
  },
  finster: {
    key: 'finster',
    source: "Finster's Monster-Matic Cookbook p.11-19",
    healthRule: true,
    sizeRule: false,
    socialBonus: false,
    advancedEssence: true,
    perkCadence: null,
    powersCostPerks: false,
    hangUps: { min: 1, max: null, perkEach: 0 },
    equipmentStep: true,
    growStep: true,
  },
  canterlot: {
    key: 'canterlot',
    source: 'Knights of Canterlot p.64',
    healthRule: false,
    sizeRule: false,
    socialBonus: false,
    advancedEssence: false,
    perkCadence: null,
    powersCostPerks: true,
    hangUps: { min: 0, max: null, perkEach: 0 },
    equipmentStep: false,
    growStep: false,
  },
  vehicle: {
    key: 'vehicle',
    source: 'G.I. JOE Factions in Action (vehicle creation)',
    healthRule: true,
    sizeRule: false,
    socialBonus: false,
    advancedEssence: false,
    perkCadence: { resilient: 4, typical: 3, canny: 2 },
    powersCostPerks: true,
    hangUps: { min: 0, max: 2, perkEach: 1 },
    equipmentStep: false,
    growStep: false,
  },
};

/**
 * The rule set a world's Game Line starts from. Power Rangers defaults to the Field Guide too -
 * Finster's is offered beside it, since its Threats are built that way.
 * @param {String} gameLine   A key of E20.gameVersions, or '' for an all-lines world.
 * @returns {String}
 */
export function defaultRulesetFor(gameLine) {
  return gameLine == 'myLittlePony' ? 'canterlot' : 'fieldGuide';
}

const rulesOf = key => RULESETS[key] ?? RULESETS.fieldGuide;
const intOf = value => (Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0);

/**
 * Health by Threat type (Field Guide p.146-147; Finster's p.12-13): Typical = TL, Resilient =
 * TL x 1.5, Canny = TL x 0.75 (minimum 1). TL 0 is capped at 2. Remainders round up, the
 * Essence20 default the Field Guide itself names on p.145.
 * @returns {Number}
 */
export function threatHealth(tl, type = 'typical') {
  const level = Math.max(0, intOf(tl));
  const multiplier = { resilient: 1.5, canny: 0.75 }[type] ?? 1;
  let health = Math.ceil(level * multiplier);
  if (type == 'canny') {
    health = Math.max(1, health);
  }

  if (level == 0) {
    health = Math.min(2, Math.max(health, 1));
  }

  return health;
}

/**
 * Ground Movement by type: Typical 40ft, Resilient and Canny 30ft (Field Guide p.147; the full
 * text of Finster's p.13 - its summary box on p.11 has these the other way round). Finster's
 * also trades 5ft of Ground for each extra Movement type.
 * @param {String} type
 * @param {Object} [options]
 * @param {String} [options.ruleset]
 * @param {Number} [options.extraTypes]   How many non-Ground Movement types the Threat has.
 * @returns {Number}
 */
export function threatGroundMovement(type = 'typical', { ruleset = 'fieldGuide', extraTypes = 0 } = {}) {
  const base = type == 'typical' ? 40 : 30;
  return ruleset == 'finster' ? Math.max(5, base - 5 * extraTypes) : base;
}

/**
 * The extra Movement types a Field Guide Perk buys, from the Threat's Ground Movement (p.148):
 * Aquatic at twice Ground, Aerial at Ground - 10ft, Climbing equal to Ground. Burrowing has no
 * printed rate, so it follows Climbing.
 */
export function extraMovementRate(movementType, ground) {
  const value = intOf(ground);
  if (movementType == 'swim') {
    return value * 2;
  }

  if (movementType == 'aerial') {
    return Math.max(5, value - 10);
  }

  return value;
}

/** Sizes a Threat type starts at (Field Guide p.147); Perks can raise it from there. */
export function allowedSizes(type = 'typical', ruleset = 'fieldGuide') {
  if (!rulesOf(ruleset).sizeRule) {
    return null;
  }

  return type == 'resilient' ? ['small', 'common', 'large'] : ['small', 'common'];
}

/**
 * The Essence points a Threat has to spend.
 *
 * - base: TL x 2 + 6, every rule set (vehicle: TL + 3 without an A.I.).
 * - social (Field Guide p.147): a Threat that does more than fight gets +2 at TL1 and +5 more at
 *   each of TL10, 15 and 20 - all of it to be spent on Smarts and Social.
 * - animal (developers' spreadsheet): 75% of TL x 2 + 6.
 * - advanced (Finster's p.13): from TL4, up to TL - 3 extra points, at the GM's choice.
 *
 * @param {Object} options
 * @returns {{base: Number, social: Number, advancedMax: Number, advanced: Number, total: Number}}
 */
export function essenceBudget({ tl = 0, ruleset = 'fieldGuide', social = false, advanced = 0, vehicleAi = false, animal = false } = {}) {
  const level = Math.max(0, intOf(tl));
  const rules = rulesOf(ruleset);
  let base = ruleset == 'vehicle' && !vehicleAi ? level + 3 : level * 2 + 6;
  // The developers' spreadsheet: an Animal Threat has 75% of the usual points (rounded down).
  if (animal && ruleset != 'vehicle') {
    base = Math.floor(base * 0.75);
  }


  let socialPoints = 0;
  if (rules.socialBonus && social && level >= 1) {
    socialPoints = 2 + [10, 15, 20].filter(threshold => level >= threshold).length * 5;
  }

  const advancedMax = rules.advancedEssence && level >= 4 ? level - 3 : 0;
  const advancedPoints = Math.min(Math.max(0, intOf(advanced)), advancedMax);
  return {
    base,
    social: socialPoints,
    advancedMax,
    advanced: advancedPoints,
    total: base + socialPoints + advancedPoints,
  };
}

/** The Threat Level a set of Essence scores fits - Knights of Canterlot's reverse formula. */
export function threatLevelForEssence(total, { ruleset = 'fieldGuide', vehicleAi = false } = {}) {
  const points = intOf(total);
  if (ruleset == 'vehicle' && !vehicleAi) {
    return Math.max(0, points - 3);
  }

  return Math.max(0, Math.floor((points - 6) / 2));
}

/**
 * How many Perks a Threat gets.
 *
 * - Field Guide (p.148): one at TL1, then one more every 4 (Resilient), 3 (Typical) or 2 (Canny)
 *   Threat Levels. Each Hang-Up (up to two) is worth one more. Powers are bought from this.
 * - Finster's (p.14): one at TL0 plus one every 4 levels; Resilient one fewer, Canny one more.
 *   Powers are separate.
 * - Knights of Canterlot (p.64): one or two, besides the attack.
 *
 * @returns {{perks: Number, max: Number|null, includesPowers: Boolean}}
 */
export function perkBudget({ tl = 0, type = 'typical', ruleset = 'fieldGuide', hangUps = 0 } = {}) {
  const level = Math.max(0, intOf(tl));
  const rules = rulesOf(ruleset);

  if (ruleset == 'canterlot') {
    return { perks: 1, max: 2, includesPowers: true };
  }

  let perks;
  if (rules.perkCadence) {
    const every = rules.perkCadence[type] ?? rules.perkCadence.typical;
    perks = level >= 1 ? 1 + Math.floor(level / every) : 0;
  } else {
    const adjust = { resilient: -1, canny: 1 }[type] ?? 0;
    perks = Math.max(0, 1 + Math.floor(level / 4) + adjust);
  }

  const counted = rules.hangUps.max == null ? intOf(hangUps) : Math.min(intOf(hangUps), rules.hangUps.max);
  perks += counted * rules.hangUps.perkEach;
  return { perks, max: null, includesPowers: rules.powersCostPerks };
}

/** Skill points spent per Essence: rank steps, one per bought Specialization, Conditioning on Strength. */
export function skillSpend({ skills = {}, conditioning = 0 } = {}) {
  const spend = Object.fromEntries(ESSENCES.map(essence => [essence, 0]));
  for (const [essence, keys] of Object.entries(SKILLS_BY_ESSENCE)) {
    for (const key of keys) {
      const skill = skills[key];
      if (!skill) {
        continue;
      }

      spend[essence] += SHIFT_COST[skill.shift] ?? 0;
      if (skill.specialization) {
        spend[essence] += 1;
      }
    }
  }

  spend.strength += Math.max(0, intOf(conditioning));
  return spend;
}

/**
 * Each Essence as the sum of the skill points under it - the developers' spreadsheet works a
 * Threat out this way round when the GM knows the skills they want first.
 */
export function essencesFromSkills(options = {}) {
  return skillSpend(options);
}

/**
 * The skill die a Threat of this level typically has, and the most it should have, from the
 * developers' spreadsheet: [from level, typical, max].
 */
export const SKILL_GUIDE = [
  [0, 'd2', 'd6'],
  [3, 'd4', 'd8'],
  [4, 'd6', 'd10'],
  [8, 'd8', 'd12'],
  [12, 'd10', 'd12'],
  [16, 'd12', 'd12'],
];

/** @returns {{typical: String, max: String}} */
export function skillGuideFor(tl) {
  const level = Math.max(0, intOf(tl));
  const row = [...SKILL_GUIDE].reverse().find(([from]) => level >= from) ?? SKILL_GUIDE[0];
  return { typical: row[1], max: row[2] };
}

/** Defense totals: 10 + the governing Essence + any bonus. */
export function threatDefenses(essences = {}, bonuses = {}) {
  return Object.fromEntries(Object.entries(DEFENSE_ESSENCES)
    .map(([defense, essence]) => [defense, 10 + intOf(essences[essence]) + intOf(bonuses[defense])]));
}

/** Defenses are balanced when the highest minus the lowest is the Threat Level or less (Field Guide p.147). */
export function defenseSpread(defenses = {}) {
  const values = Object.values(defenses).map(intOf);
  return values.length ? Math.max(...values) - Math.min(...values) : 0;
}

/** The Threat Level a party of PCs should face: their total levels / 4, rounded down (Field Guide p.145). */
export function appropriateThreatLevel(levels = []) {
  const total = levels.reduce((sum, level) => sum + intOf(level), 0);
  return Math.floor(total / 4);
}

/** Threat Level for a role, given the party's average level. */
export function threatLevelForRole(role, partyLevel) {
  return Math.max(0, intOf(partyLevel) + (ROLE_PRESETS[role] ?? 0));
}

/** Guess the Threat type from Health and Threat Level, for an NPC that wasn't built here. */
export function inferThreatType(health, tl) {
  const level = intOf(tl);
  const value = intOf(health);
  if (level <= 0) {
    return 'typical';
  }

  const candidates = THREAT_TYPES.map(type => [type, Math.abs(threatHealth(level, type) - value)]);
  candidates.sort((a, b) => a[1] - b[1]);
  return candidates[0][0];
}

/**
 * Check a Threat against its rule set. Used both live while building and by the audit of an
 * existing NPC.
 *
 * @param {Object} threat   The builder's state shape (or one read from an actor - see
 *   threatFromActor): {ruleset, type, tl, social, advanced, vehicleAi, size, health, essences,
 *   skills, conditioning, defenses, movement, perks, powers, hangUps, attacks}.
 * @returns {Array<{key: String, level: 'warn'|'info', data: Object}>}   Findings, each a
 *   localization key suffix plus its format data. Empty when the Threat follows the book.
 */
export function auditThreat(threat) {
  const findings = [];
  const add = (key, level, data = {}) => findings.push({ key, level, data });
  const ruleset = threat.ruleset ?? 'fieldGuide';
  const rules = rulesOf(ruleset);
  const tl = Math.max(0, intOf(threat.tl));
  const type = threat.type ?? 'typical';

  // Essence: the total against the budget, and the Threat Level the total actually fits.
  const budget = essenceBudget({ tl, ruleset, social: threat.social, advanced: threat.advanced, vehicleAi: threat.vehicleAi, animal: threat.animal });
  const essences = threat.essences ?? {};
  const counted = ruleset == 'vehicle' && !threat.vehicleAi ? ['strength', 'speed'] : ESSENCES;
  const total = counted.reduce((sum, essence) => sum + intOf(essences[essence]), 0);
  const maxBudget = budget.base + budget.social + budget.advancedMax;
  if (total > maxBudget) {
    add('EssenceOver', 'warn', { total, budget: maxBudget, fits: threatLevelForEssence(total, { ruleset, vehicleAi: threat.vehicleAi }) });
  } else if (total < budget.total) {
    add('EssenceUnder', 'info', { total, budget: budget.total, fits: threatLevelForEssence(total, { ruleset, vehicleAi: threat.vehicleAi }) });
  }

  if (budget.social) {
    const mental = intOf(essences.smarts) + intOf(essences.social);
    if (mental < budget.social) {
      add('SocialUnspent', 'info', { social: budget.social, spent: mental });
    }
  }

  for (const essence of counted) {
    if (intOf(essences[essence]) < 1) {
      add('EssenceZero', 'warn', { essence });
    }
  }

  // Skills against each Essence.
  const spend = skillSpend({ skills: threat.skills, conditioning: threat.conditioning });
  for (const essence of counted) {
    if (spend[essence] > intOf(essences[essence])) {
      add('SkillsOver', 'warn', { essence, spent: spend[essence], max: intOf(essences[essence]) });
    }
  }

  const guide = skillGuideFor(tl);
  const above = Object.entries(threat.skills ?? {})
    .filter(([, skill]) => (SHIFT_COST[skill?.shift] ?? 0) > SHIFT_COST[guide.max])
    .map(([key]) => key);
  if (above.length) {
    add('SkillsAboveGuide', 'info', { skills: above, max: guide.max });
  }

  if (!threat.skills?.initiative?.shift || threat.skills.initiative.shift == 'd20') {
    add('NoInitiative', 'info');
  }

  if (threat.skills?.might?.shift && threat.skills?.finesse?.shift
    && threat.skills.might.shift != 'd20' && threat.skills.finesse.shift != 'd20') {
    add('MightAndFinesse', 'info');
  }

  // Health.
  if (rules.healthRule && threat.health != null) {
    const expected = threatHealth(tl, type) + intOf(threat.healthBonus);
    if (intOf(threat.health) != expected) {
      add('Health', 'info', { health: intOf(threat.health), expected, type });
    }
  }

  // Size.
  const sizes = allowedSizes(type, ruleset);
  if (sizes && threat.size && !sizes.includes(threat.size) && !intOf(threat.sizeSteps)) {
    add('Size', 'info', { size: threat.size, type });
  }

  // Defenses.
  const defenses = threat.defenses ?? threatDefenses(essences);
  if (ruleset != 'vehicle' && defenseSpread(defenses) > tl) {
    add('DefenseSpread', 'info', { spread: defenseSpread(defenses), tl });
  }

  // Perks, Powers and Hang-Ups.
  const hangUps = intOf(threat.hangUps);
  const perkCount = intOf(threat.perks);
  const powerCount = intOf(threat.powers);
  const allowance = perkBudget({ tl, type, ruleset, hangUps });
  const spent = allowance.includesPowers ? perkCount + powerCount : perkCount;
  if (allowance.max != null ? spent > allowance.max : spent > allowance.perks) {
    add('PerksOver', 'warn', { spent, budget: allowance.max ?? allowance.perks, includesPowers: allowance.includesPowers });
  } else if (allowance.max == null && spent < allowance.perks) {
    add('PerksUnder', 'info', { spent, budget: allowance.perks });
  }

  if (rules.hangUps.max != null && hangUps > rules.hangUps.max) {
    add('HangUpsOver', 'warn', { hangUps, max: rules.hangUps.max });
  }

  if (hangUps < rules.hangUps.min) {
    add('HangUpsUnder', 'info', { min: rules.hangUps.min });
  }

  // Attacks: at least one, ideally one melee and one ranged.
  const attacks = threat.attacks ?? [];
  if (!attacks.length) {
    add('NoAttacks', 'warn');
  } else if (ruleset != 'canterlot') {
    if (!attacks.some(attack => attack.melee)) {
      add('NoMelee', 'info');
    }

    if (!attacks.some(attack => !attack.melee)) {
      add('NoRanged', 'info');
    }
  }

  return findings;
}

/**
 * Read an existing NPC (or vehicle) into auditThreat's shape. The rule set and Threat type come
 * from the flag a built Threat carries, or are inferred.
 * @param {Actor} actor
 * @param {Object} [options]
 * @param {String} [options.ruleset]   Overrides the stored/default rule set.
 * @param {String} [options.gameLine]
 * @returns {Object}
 */
export function threatFromActor(actor, { ruleset = null, gameLine = '' } = {}) {
  const system = actor?.system ?? {};
  const stored = actor?.flags?.essence20?.threatBuild ?? {};
  const tl = intOf(system.threatLevel);
  const health = system.health?.max ?? null;
  const items = [...(actor?.items ?? [])];
  const isVehicle = actor?.type == 'vehicle';
  const chosenRuleset = ruleset ?? stored.ruleset ?? (isVehicle ? 'vehicle' : defaultRulesetFor(gameLine));

  const skills = {};
  for (const [key, data] of Object.entries(system.skills ?? {})) {
    const bought = Object.values(data?.specializations ?? {}).some(spec => !spec?.granted);
    skills[key] = { shift: data?.shift ?? 'd20', specialization: bought ? 'yes' : '' };
  }

  const weapons = items.filter(item => item.type == 'weapon');
  const attacks = weapons.map(weapon => {
    const effect = items.find(item => item.type == 'weaponEffect' && item.flags?.essence20?.parentId == weapon.id);
    const range = effect?.system?.range ?? {};
    return { name: weapon.name, melee: !range.value || !!range.reachMultiplier };
  });

  return {
    ruleset: chosenRuleset,
    type: stored.type ?? inferThreatType(health, tl),
    typeInferred: !stored.type,
    tl,
    social: !!stored.social,
    animal: !!stored.animal,
    advanced: intOf(stored.advanced),
    vehicleAi: !!stored.vehicleAi || (isVehicle && intOf(system.essences?.smarts?.value) > 0),
    size: system.size ?? null,
    health,
    // Conditioning is part of the printed Health, on top of the type's Health.
    healthBonus: intOf(system.conditioning) + intOf(stored.healthPerks),
    essences: Object.fromEntries(ESSENCES.map(essence => [essence, system.essences?.[essence]?.max ?? system.essences?.[essence]?.value ?? 0])),
    skills,
    conditioning: intOf(system.conditioning),
    defenses: Object.fromEntries(Object.keys(DEFENSE_ESSENCES).map(defense => [defense, system.defenses?.[defense]?.total ?? 10])),
    perks: items.filter(item => item.type == 'perk' && item.system?.type != 'contact').length,
    powers: items.filter(item => item.type == 'power').length,
    hangUps: items.filter(item => item.type == 'hangUp').length,
    attacks,
  };
}

/**
 * The Field Guide's quick Perks (p.148) a builder can apply in one click. Each changes the stat
 * block directly where the book allows it (a self-explanatory Perk may just be folded into the
 * stat block instead of listed).
 */
export const QUICK_PERKS = ['health', 'size', 'movement', 'aquatic', 'aerial', 'climbing', 'damage', 'extraAttack', 'defense', 'immunity'];

/**
 * Apply the stat-changing quick Perks to a draft stat block.
 * @param {Object} stats   {health, size, movement: {ground, aerial, swim, climb, burrow}, attacks}
 * @param {Array<{key: String, attack?: Number}>} quickPerks
 * @returns {Object}   A new stat block.
 */
export function applyQuickPerks(stats, quickPerks = []) {
  const out = {
    ...stats,
    movement: { ...(stats.movement ?? {}) },
    attacks: (stats.attacks ?? []).map(attack => ({ ...attack })),
  };

  for (const perk of quickPerks) {
    switch (perk.key) {
    case 'health':
      out.health = intOf(out.health) + 1;
      break;
    case 'size': {
      const index = SIZE_LADDER.indexOf(out.size ?? 'common');
      out.size = SIZE_LADDER[Math.min(SIZE_LADDER.length - 1, (index < 0 ? 1 : index) + 1)];
      break;
    }

    case 'movement':
      out.movement.ground = intOf(out.movement.ground) + 10;
      break;
    case 'aquatic':
      out.movement.swim = extraMovementRate('swim', out.movement.ground);
      break;
    case 'aerial':
      out.movement.aerial = extraMovementRate('aerial', out.movement.ground);
      break;
    case 'climbing':
      out.movement.climb = extraMovementRate('climb', out.movement.ground);
      break;
    case 'damage': {
      const attack = out.attacks[intOf(perk.attack)];
      if (attack) {
        attack.damageValue = intOf(attack.damageValue) + 1;
      }

      break;
    }

    default:
      break;
    }
  }

  return out;
}

/** The +1 damage Perk is limited to one per full Size Class above Small (Field Guide p.148). */
export function maxDamagePerks(size) {
  const index = SIZE_LADDER.indexOf(size ?? 'common');
  return Math.max(0, index);
}

/**
 * Turn the builder's state into the stat block importer's IR (importers/stat-block-import.mjs), so
 * the Threat is created through the same, already-tested path an imported stat block takes.
 * @param {Object} state   The builder's state.
 * @param {Object} [labels]   Display names for quick Perks: {quickPerk: {key: name}}.
 * @returns {Object}   The IR.
 */
export function buildThreatIr(state, labels = {}) {
  const ruleset = state.ruleset ?? 'fieldGuide';
  const tl = Math.max(0, intOf(state.tl));
  const extraTypes = MOVEMENT_TYPES.filter(type => state.movementTypes?.[type]).length;
  const ground = intOf(state.ground ?? threatGroundMovement(state.type, { ruleset, extraTypes }));
  const movement = { ground };
  for (const type of MOVEMENT_TYPES) {
    if (state.movementTypes?.[type]) {
      movement[type] = intOf(state.movementRates?.[type] ?? extraMovementRate(type, ground));
    }
  }

  const quickPerks = state.quickPerks ?? [];
  const attacks = (state.attacks ?? []).map(attack => ({
    name: attack.name || 'Attack',
    skill: attack.skill || (attack.melee ? 'might' : 'targeting'),
    shift: null,
    isSpecialized: false,
    numHands: intOf(attack.numHands ?? 1),
    traits: [],
    damageValue: intOf(attack.damageValue ?? 1),
    damageType: attack.damageType || 'blunt',
    defenseType: attack.defenseType || 'toughness',
    isReach: !!attack.melee,
    range: attack.melee
      ? { value: null, long: null, min: null, reachMultiplier: null }
      : { value: intOf(attack.range) || 30, long: intOf(attack.longRange) || null, min: null, reachMultiplier: null },
    radius: 0,
    shape: null,
    alternateEffects: [],
  }));

  const stats = applyQuickPerks({
    health: state.health ?? threatHealth(tl, state.type),
    size: state.size ?? 'common',
    movement,
    attacks,
  }, quickPerks);

  const essences = Object.fromEntries(ESSENCES.map(essence => [essence, intOf(state.essences?.[essence])]));
  const skills = Object.entries(state.skills ?? {})
    .filter(([, skill]) => skill?.shift && skill.shift != 'd20')
    .map(([key, skill]) => ({
      key,
      shift: skill.shift,
      modifier: 0,
      isSpecialized: !!skill.specialization,
      specialization: skill.specialization || null,
    }));

  const quickNames = labels.quickPerk ?? {};
  const perks = [
    ...quickPerks.map(perk => ({ name: perk.name || quickNames[perk.key] || perk.key, text: perk.text ?? '' })),
    ...(state.customPerks ?? []).filter(perk => perk.name).map(perk => ({ name: perk.name, text: perk.text ?? '' })),
  ];

  return {
    name: state.name || '',
    threatLevel: tl,
    size: stats.size,
    // Printed Health includes Conditioning, the way the importer reads it (buildHealth).
    health: stats.health + intOf(state.conditioning),
    conditioning: intOf(state.conditioning),
    essences,
    defenses: threatDefenses(essences, state.defenseBonuses),
    movement: stats.movement,
    languages: [...(state.languages ?? [])],
    skills,
    perks,
    powers: (state.customPowers ?? []).filter(power => power.name).map(power => ({
      name: power.name,
      text: power.text ?? '',
      actionType: power.actionType || null,
      usesPer: null,
      usesInterval: null,
    })),
    hangUps: (state.customHangUps ?? []).filter(hangUp => hangUp.name).map(hangUp => ({ name: hangUp.name, text: hangUp.text ?? '' })),
    attacks: stats.attacks,
    equipment: [],
    contact: null,
    diagnostics: [],
  };
}
