/**
 * The current amount of an Essence: what Essence damage spends, healing and a Rest give back.
 *
 * A Player Character, NPC or Companion keeps it as `system.essences.<key>.value` under a `max` score. A Zord, Vehicle or
 * Megaform has no such pair - its `value` IS the score (worked out from its base, mechanics/vehicles/machine-essences.mjs,
 * or from its Zords), and a write to it moves the base for good. The books say nothing on machines taking Essence damage;
 * the user's ruling (2026-10-07) is that they take it, temporarily: it is kept apart, as `system.essences.<key>.damage`,
 * comes off the score for the current amount, and a Rest heals it, without ever touching the score.
 *
 * Every Essence damage / heal / Rest write goes through here, so the two shapes stay one rule.
 */

const MACHINE_TYPES = ['zord', 'vehicle', 'megaform'];

/** Whether the actor keeps Essence damage apart from its score. */
export function tracksEssenceDamage(actor) {
  return MACHINE_TYPES.includes(actor?.type);
}

const num = value => (Number.isFinite(Number(value)) && value !== null && value !== '' ? Number(value) : null);

/**
 * The Essence's score: the most the current amount can be. Null for an Essence the actor does not have (a Vehicle's
 * blank Smarts, which uses its driver's).
 */
export function essenceScore(actor, key) {
  const essence = actor?.system?.essences?.[key];
  if (!essence || typeof essence != 'object') {
    return null;
  }

  return tracksEssenceDamage(actor) ? num(essence.value) : num(essence.max ?? essence.value);
}

/** What is left of the Essence now (null when the actor does not have it). */
export function currentEssence(actor, key) {
  const essence = actor?.system?.essences?.[key];
  if (!essence || typeof essence != 'object') {
    return null;
  }

  if (!tracksEssenceDamage(actor)) {
    return num(essence.value);
  }

  const score = num(essence.value);
  return score === null ? null : Math.max(0, score - (Number(essence.damage) || 0));
}

/**
 * The update that sets the Essence's current amount to `amount` ({path: value}), held between 0 and the score.
 * @param {Actor} actor
 * @param {String} key
 * @param {Number} amount
 * @returns {Object}
 */
export function currentEssenceUpdate(actor, key, amount) {
  const score = essenceScore(actor, key);
  const wanted = Math.max(0, Math.round(Number(amount) || 0));
  if (!tracksEssenceDamage(actor)) {
    return { [`system.essences.${key}.value`]: wanted };
  }

  return { [`system.essences.${key}.damage`]: Math.max(0, (score ?? 0) - Math.min(wanted, score ?? 0)) };
}

/** How far the Essence sits below its score. */
export function essenceDamageIn(actor, key) {
  const score = essenceScore(actor, key);
  const current = currentEssence(actor, key);
  return score === null || current === null ? 0 : Math.max(0, score - current);
}
