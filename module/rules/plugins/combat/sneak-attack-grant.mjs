// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): SneakAttackGrant.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: mechanics/combat/sneak-attack.mjs loads it directly.
import { rulesOfType } from "../../index.mjs";
import { recordUse, usesLeft } from "../../limits.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `SneakAttackGrant` - what widens the Commando's Sneak Attack (mechanics/combat/sneak-attack.mjs#
 * checkSneakAttackEligibility). Every rule's `when` sees the actor; `items` (item tags, `item:` = the rolled weapon
 * effect, `weapon:` its weapon) narrows which attacks it covers.
 *
 *   qualifies       (default true) the weapon qualifies although it isn't Silent - {} is "any weapon" (Everything's a
 *                   Weapon); {items: [...]} only those (Focused Charge's explosives and electromagnetic weapons).
 *                   `qualifies: false` for a rule that only changes the range.
 *   range           the range cap instead of 20 ft: a number of feet (Never Heard It Coming: 60), "weapon" (the
 *                   attack's own long / normal range) or "unlimited". The widest applies (unlimited, then weapon,
 *                   then the biggest number).
 *   anyCircumstance Sneak Attack applies whatever the circumstances (Sudden Strike), with `cost: {storyPoints: N}`
 *                   paid and `limit` counted only when it was needed - when the ordinary checks would have failed.
 *   bypass          (round 18, convC) the attack is a sneak attack whatever its weapon, range, Edge or allies - still
 *                   once a round and never against a target immune to sneak attack damage, and free (Perfect Disguise,
 *                   while the disguise is on). `reason`: the Roll Options line it shows (an E20. key or text).
 */
registerRuleType('SneakAttackGrant', {
  params: {
    items: { kind: 'object' },
    qualifies: { kind: 'bool' },
    range: { kind: 'object' },
    anyCircumstance: { kind: 'bool' },
    cost: { kind: 'object' },
    limit: { kind: 'object' },
    bypass: { kind: 'bool' },
    reason: { kind: 'string' },
  },
  scopes: ['self'],
  validate: rule => {
    const errors = [];
    if (rule.items !== undefined && !Array.isArray(rule.items)) {
      errors.push('items must be a list of item tags');
    }

    if (rule.range !== undefined && !(Number(rule.range) > 0 || ['weapon', 'unlimited'].includes(rule.range))) {
      errors.push('range must be feet, "weapon" or "unlimited"');
    }

    if (rule.cost !== undefined && !(Number(rule.cost?.storyPoints) > 0)) {
      errors.push('cost must be {storyPoints: N}');
    }

    return errors;
  },
});

function holds(actor, entry, weaponEffect) {
  const { rule, item } = entry;
  const ctx = contextFor({ self: actor, holder: actor, ruleItem: item, item: weaponEffect ?? null, isAttack: true });
  return evaluate(rule.when, ctx) === true && evaluate(rule.items, ctx) === true;
}

/**
 * What the actor's SneakAttackGrant rules do for this attack.
 * @param {Actor} actor
 * @param {Item} weaponEffect
 * @returns {{qualifies: Boolean, range: (Number|'weapon'|'unlimited'|undefined)}}   range undefined when no rule sets one.
 */
export function sneakAttackWeaponGrants(actor, weaponEffect) {
  const entries = rulesOfType(actor, 'SneakAttackGrant').filter(entry => !entry.rule.anyCircumstance && !entry.rule.bypass && holds(actor, entry, weaponEffect));
  const qualifies = entries.some(({ rule }) => rule.qualifies !== false);
  const ranges = entries.map(({ rule }) => rule.range).filter(range => range !== undefined);
  let range;
  if (ranges.includes('unlimited')) {
    range = 'unlimited';
  } else if (ranges.includes('weapon')) {
    range = 'weapon';
  } else if (ranges.length) {
    range = Math.max(...ranges.map(Number));
  }

  return { qualifies, range };
}

/**
 * The actor's first "any circumstance" grant with a use left (its Story Point cost isn't checked here).
 * @param {Actor} actor
 * @returns {?{rule: Object, item: Item, index: Number}}
 */
export function anyCircumstanceGrant(actor) {
  return rulesOfType(actor, 'SneakAttackGrant').find(entry => entry.rule.anyCircumstance
    && usesLeft(actor, entry.rule, entry.item, entry.index) > 0 && holds(actor, entry, null)) ?? null;
}

/**
 * The actor's first `bypass` grant whose `when` / `items` hold for this attack (round 18, convC), or null.
 * @param {Actor} actor
 * @param {Item} weaponEffect
 * @returns {?{rule: Object, item: Item, index: Number}}
 */
export function bypassGrant(actor, weaponEffect) {
  return rulesOfType(actor, 'SneakAttackGrant').find(entry => entry.rule.bypass && holds(actor, entry, weaponEffect)) ?? null;
}

/** The Story Points an "any circumstance" grant costs (0 for none). */
export function grantStoryPointCost(entry) {
  return Math.max(0, Math.round(Number(entry?.rule?.cost?.storyPoints) || 0));
}

/** Count one use of an "any circumstance" grant against its limit. */
export async function recordGrantUse(actor, entry) {
  if (entry) {
    await recordUse(actor, entry.rule, entry.item, entry.index);
  }
}
