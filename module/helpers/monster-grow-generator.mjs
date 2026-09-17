/**
 * Builds a "Grown" version of a parsed stat block, following Finster's Monster-Matic Cookbook's
 * own "Step 8: Does It Grow?" construction rules (p.18-19). Phase 5 of
 * docs/STAT_BLOCK_IMPORTER_PLAN.md.
 *
 * Pure: IR in, IR out, no Foundry documents. The result is a **starting point the GM edits**, not
 * an oracle - see §6.3 of the plan, where the published Grown blocks are shown to deviate from
 * the book's own published algorithm in three places (ranges doubled where the rule says x1.5,
 * Movement left unchanged where the rule says to grow it, and extra Conditioning granted on top).
 * Every one of those is exposed here as an option rather than baked in, and the defaults follow
 * the RULE; the tests assert the rule and keep the published deviations as override-path fixtures.
 *
 * Nothing is silently dropped or silently rewritten: anything the GM should look at by hand comes
 * back in the returned `review` list.
 */

/** RAW: x1.5 for a +2/+3 Threat Level increase, x2 for +4. */
export const RAW_RANGE_MULTIPLIER = 1.5;
/** What the published Grown blocks actually print, regardless of TL increase. */
export const PUBLISHED_RANGE_MULTIPLIER = 2;

/** RAW: damage x2 for a +2/+3 increase, x3 for +4. */
export const RAW_DAMAGE_MULTIPLIER = 2;
export const RAW_DAMAGE_MULTIPLIER_LARGE = 3;

/** Which Essence governs which Defense - mirrors data/actor/templates/character.mjs. */
const DEFENSE_ESSENCES = {
  toughness: 'strength',
  evasion: 'speed',
  willpower: 'smarts',
  cleverness: 'social',
};

/** Which Essence governs which skill, read off CONFIG rather than duplicated here. */
function essenceForSkill(skillKey) {
  for (const [essence, skills] of Object.entries(CONFIG.E20.skillsByEssence ?? {})) {
    if (essence !== 'any' && skills.includes(skillKey)) {
      return essence;
    }
  }

  return null;
}

/**
 * Moves a skill shift up the die ladder. `CONFIG.E20.skillShiftList` runs best-to-worst, so
 * shifting up means moving towards index 0 - the same arithmetic helpers/utils.mjs#getShiftedSkill
 * does, reimplemented here without its Actor dependency so this file stays pure.
 */
export function shiftUp(shift, amount = 1) {
  const ladder = CONFIG.E20.skillShiftList;
  const current = ladder.indexOf(shift ?? 'd20');
  if (current === -1) {
    return shift;
  }

  return ladder[Math.max(0, current - amount)];
}

/** Ranges are adjusted "rounding to the nearest 5-foot increment". */
export function roundToFive(value) {
  return Math.round(value / 5) * 5;
}

/** RAW multipliers for a given Threat Level increase. */
export function multipliersForIncrease(tlIncrease) {
  return {
    range: tlIncrease >= 4 ? 2 : RAW_RANGE_MULTIPLIER,
    damage: tlIncrease >= 4 ? RAW_DAMAGE_MULTIPLIER_LARGE : RAW_DAMAGE_MULTIPLIER,
  };
}

/**
 * Default split of the new Essence points.
 *
 * The book's advice is that a Grown form is "generally focused on a tougher combat scene", so the
 * points go to the Essences governing the Threat's own attack skills, split as evenly as the total
 * allows (largest remainder, best attack Essence first). Checked against the published Polluticorn:
 * its two attacks use Might (Strength) and Targeting (Speed), and those are exactly the two
 * Essences its Grown form gained - the book split them 4/2 where this splits 3/3, which is the
 * kind of taste call the GM makes in the dialog.
 *
 * Falls back to Strength when a stat block has no attacks to read.
 */
export function defaultEssenceAllocation(ir, points) {
  const allocation = { strength: 0, speed: 0, smarts: 0, social: 0 };
  if (points <= 0) {
    return allocation;
  }

  const weights = new Map();
  for (const attack of ir.attacks ?? []) {
    const essence = attack.skill ? essenceForSkill(attack.skill) : null;
    if (essence) {
      weights.set(essence, (weights.get(essence) ?? 0) + 1);
    }
  }

  const targets = weights.size
    ? [...weights.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([e]) => e)
    : ['strength'];

  for (let i = 0; i < points; i++) {
    allocation[targets[i % targets.length]] += 1;
  }

  return allocation;
}

/**
 * Default choice of which skills absorb a shift.
 *
 * RAW is "adding skill ranks equal to the increases in applicable Essence Scores", which would
 * touch every skill under a grown Essence - but the published Polluticorn shifts only its two
 * attack skills plus Initiative, leaving its other four Speed/Smarts skills alone. That narrower
 * reading is the default here, because it reproduces the published block exactly and matches the
 * book's own "focus on the Threat's primary attack-based Skills" advice.
 */
export function defaultSkillAllocation(ir, essenceIncreases) {
  const allocation = {};
  const grown = new Set(Object.entries(essenceIncreases)
    .filter(([, value]) => value > 0).map(([essence]) => essence));

  for (const attack of ir.attacks ?? []) {
    if (attack.skill && grown.has(essenceForSkill(attack.skill))) {
      allocation[attack.skill] = 1;
    }
  }

  const hasInitiative = (ir.skills ?? []).some(skill => skill.key === 'initiative');
  if (hasInitiative && grown.has(essenceForSkill('initiative'))) {
    allocation.initiative = 1;
  }

  return allocation;
}

/** Scales every "<n>ft" in a body of text, for a Power whose reach grows with the monster. */
export function scaleTextRanges(text, multiplier) {
  if (!text || multiplier === 1) {
    return text;
  }

  return text.replace(/(\d+)\s*ft/gi, (whole, feet) =>
    whole.replace(feet, String(roundToFive(Number.parseInt(feet, 10) * multiplier))));
}

function scaleEffect(effect, { rangeMultiplier, damageMultiplier }) {
  const scaled = {
    ...effect,
    range: { ...effect.range },
  };

  if (typeof scaled.damageValue === 'number' && scaled.damageValue > 0) {
    scaled.damageValue = Math.round(scaled.damageValue * damageMultiplier);
  }

  for (const key of ['value', 'long', 'min']) {
    if (typeof scaled.range[key] === 'number') {
      scaled.range[key] = roundToFive(scaled.range[key] * rangeMultiplier);
    }
  }

  if (scaled.radius) {
    scaled.radius = roundToFive(scaled.radius * rangeMultiplier);
  }

  return scaled;
}

/**
 * Anything in a carried-over Perk/Power/Hang-Up that reads like it assumed the Normal form, so the
 * GM is pointed at it instead of it quietly coming along wrong. RAW: "being sure to remove or
 * replace anything requiring the Threat to be in its Normal Size or form."
 */
const FORM_DEPENDENT = /\b(normal|small(?:er)?|human[- ]siz|its size|this size|grown|shrink)\b/i;

/**
 * @param {Object} ir   A parsed stat block IR (from the parser, or actorToIr).
 * @param {Object} [options]
 * @param {Number} [options.tlIncrease]            2-4 per RAW. Default 3.
 * @param {String} [options.newSize]               Target Size class. Default gigantic.
 * @param {Number} [options.rangeMultiplier]       Defaults to RAW for the TL increase.
 * @param {Number} [options.damageMultiplier]      Defaults to RAW for the TL increase.
 * @param {Object} [options.essenceAllocation]     Per-Essence point split. Defaults as above.
 * @param {Object} [options.skillAllocation]       {skillKey: shifts}. Defaults as above.
 * @param {Boolean} [options.growMovement]         RAW says yes; the published blocks don't.
 * @param {Number} [options.conditioningIncrease]  RAW grants none; the published blocks often do.
 * @param {Boolean} [options.scalePowerText]       Scale "<n>ft" inside Power descriptions.
 * @param {String} [options.nameSuffix]
 * @returns {{ir: Object, review: Object[], essenceIncreases: Object}}
 */
export function computeGrownStatBlock(ir, options = {}) {
  const tlIncrease = options.tlIncrease ?? 3;
  const raw = multipliersForIncrease(tlIncrease);
  const rangeMultiplier = options.rangeMultiplier ?? raw.range;
  const damageMultiplier = options.damageMultiplier ?? raw.damage;
  const newSize = options.newSize ?? 'gigantic';
  const growMovement = options.growMovement ?? true;
  const conditioningIncrease = options.conditioningIncrease ?? 0;
  const scalePowerText = options.scalePowerText ?? true;
  const nameSuffix = options.nameSuffix ?? ' (Grown)';

  const essencePoints = 2 * tlIncrease;
  const essenceIncreases = options.essenceAllocation ?? defaultEssenceAllocation(ir, essencePoints);
  const skillAllocation = options.skillAllocation ?? defaultSkillAllocation(ir, essenceIncreases);

  const review = [];
  // The IR is JSON by definition - it is stored verbatim in `flags.essence20.statBlockSource` -
  // so a JSON round-trip is a complete deep clone here, and keeps this module free of both
  // `structuredClone` (absent in the Jest environment) and `foundry.utils.deepClone` (a global
  // this deliberately-pure file should not need).
  const grown = JSON.parse(JSON.stringify(ir));

  grown.name = `${ir.name}${nameSuffix}`;
  grown.threatLevel = (ir.threatLevel ?? 0) + tlIncrease;
  grown.size = newSize;
  grown.conditioning = (ir.conditioning ?? 0) + conditioningIncrease;

  // "Gain Health equal to the increase in Threat Level." Note ir.health is the PRINTED total,
  // which already includes Conditioning - so extra Conditioning raises it a second time, exactly
  // as the published blocks do.
  if (typeof ir.health === 'number') {
    grown.health = ir.health + tlIncrease + conditioningIncrease;
  }

  for (const [essence, increase] of Object.entries(essenceIncreases)) {
    if (increase && typeof grown.essences[essence] === 'number') {
      grown.essences[essence] += increase;
    }
  }

  // Defenses follow their own Essence. Adding the increase (rather than recomputing from 10)
  // preserves whatever armour/bonus residual the printed block already had.
  for (const [defense, essence] of Object.entries(DEFENSE_ESSENCES)) {
    if (typeof grown.defenses[defense] === 'number') {
      grown.defenses[defense] += essenceIncreases[essence] ?? 0;
    }
  }

  // "Add to all Movement Type values a number of feet equal to the increase of the Threat's
  // natural Reach for the new Size."
  const reachGain = (CONFIG.E20.tokenSizes[newSize]?.reach ?? 0)
    - (CONFIG.E20.tokenSizes[ir.size]?.reach ?? 0);
  if (growMovement && reachGain > 0) {
    for (const [type, value] of Object.entries(grown.movement)) {
      if (typeof value === 'number') {
        grown.movement[type] = value + reachGain;
      }
    }
  }

  for (const skill of grown.skills ?? []) {
    const shifts = skillAllocation[skill.key];
    if (shifts) {
      skill.shift = shiftUp(skill.shift, shifts);
      if (skill.specialization) {
        skill.specializationShift = skill.shift;
      }
    }
  }

  grown.attacks = (grown.attacks ?? []).map(attack => ({
    ...scaleEffect(attack, { rangeMultiplier, damageMultiplier }),
    alternateEffects: (attack.alternateEffects ?? [])
      .map(effect => scaleEffect(effect, { rangeMultiplier, damageMultiplier })),
  }));

  if (scalePowerText) {
    grown.powers = (grown.powers ?? []).map(power => ({
      ...power,
      text: scaleTextRanges(power.text, rangeMultiplier),
    }));
  }

  // Perk text is deliberately NOT scaled: RAW says to adjust Perk ranges too, but the published
  // Polluticorn leaves its Powerful Leap at 40ft while doubling both its Powers' own areas. Rather
  // than pick a side silently, Perks come through untouched and land in the review list.
  for (const [section, label] of [['perks', 'Perk'], ['powers', 'Power'], ['hangUps', 'Hang-Up']]) {
    for (const entry of grown[section] ?? []) {
      if (FORM_DEPENDENT.test(entry.text ?? '')) {
        review.push({
          section, name: entry.name,
          reason: `${label} text refers to the Threat's size or form - RAW says to remove or replace anything requiring its Normal form.`,
        });
      } else if (section === 'perks' && /\d+\s*ft/i.test(entry.text ?? '')) {
        review.push({
          section, name: entry.name,
          reason: `${label} text names a distance. RAW says to scale Perk ranges, but the published Grown blocks often don't - left unchanged.`,
        });
      }
    }
  }

  if (!growMovement || reachGain <= 0) {
    review.push({
      section: 'movement', name: null,
      reason: growMovement
        ? 'Reach did not increase for the chosen Size, so Movement was left unchanged.'
        : 'Movement growth was switched off, so Movement was left unchanged (matching the published blocks).',
    });
  }

  return { ir: grown, review, essenceIncreases, skillAllocation };
}
