/**
 * Essence damage and Defense damage.
 *
 * Essence damage (GI Joe CRB p.207, TF CRB p.161): "Some attacks and effects don't deal damage to
 * Health, but instead reduce a character's Essence Points." It is what an Essence's current value
 * sits below its max - environment-hazards.mjs#applyEssenceDamage takes the point, EMT Crash Course
 * gives it back. This file reads that gap as a number (Headache, WTNV Citizen's Guide p.47: "deal
 * additional Psychic damage equal to your current Essence damage") and heals it (Uninterrupted
 * Break, Quartermaster's Guide p.28: "All allies heal 1 point of Essence damage").
 *
 * Defense damage is the Transformers version of the crit-rider upgrades - Bewildering "deals 1
 * damage to the target's Cleverness", Maiming to Evasion, Surgical to Toughness, Traumatic to
 * Willpower (TF CRB p.129-131). It is kept on the actor as a flag and taken off that Defense in
 * documents/actor.mjs#_prepareDefenses until the actor rests.
 */

const DEFENSE_DAMAGE_FLAG = 'defenseDamage';

/**
 * How much Essence damage the actor has taken, across every Essence.
 * @param {Actor} actor
 * @returns {Number}
 */
export function essenceDamageOf(actor) {
  let total = 0;
  for (const essence of Object.values(actor?.system?.essences ?? {})) {
    const max = Number(essence?.max);
    const value = Number(essence?.value);
    if (Number.isFinite(max) && Number.isFinite(value) && max > value) {
      total += max - value;
    }
  }

  return total;
}

/**
 * Heal Essence damage, the most-damaged Essence first.
 * @param {Actor} actor
 * @param {Number} [amount]
 * @returns {Promise<Number>}   How much was healed.
 */
export async function healEssenceDamage(actor, amount = 1) {
  const essences = actor?.system?.essences ?? {};
  const update = {};
  const values = Object.fromEntries(Object.entries(essences).map(([key, e]) => [key, { max: Number(e?.max), value: Number(e?.value) }]));
  let healed = 0;
  for (let i = 0; i < amount; i++) {
    const [key] = Object.entries(values)
      .filter(([, e]) => Number.isFinite(e.max) && Number.isFinite(e.value) && e.max > e.value)
      .sort(([, a], [, b]) => (b.max - b.value) - (a.max - a.value))[0] ?? [];
    if (!key) {
      break;
    }

    values[key].value += 1;
    update[`system.essences.${key}.value`] = values[key].value;
    healed++;
  }

  if (healed) {
    await actor.update(update);
  }

  return healed;
}

/**
 * The Defense damage the actor carries, keyed by Defense.
 * @param {Actor} actor
 * @returns {Object<String, Number>}
 */
export function defenseDamageOf(actor) {
  return actor?.flags?.essence20?.[DEFENSE_DAMAGE_FLAG] ?? {};
}

/**
 * Deal damage to one of the actor's Defenses.
 * @param {Actor} actor
 * @param {String} defense   A key of CONFIG.E20.defenses.
 * @param {Number} [amount]
 */
export async function applyDefenseDamage(actor, defense, amount = 1) {
  const current = defenseDamageOf(actor);
  await actor.setFlag('essence20', DEFENSE_DAMAGE_FLAG, { ...current, [defense]: (current[defense] ?? 0) + amount });
}

/**
 * A rest clears it.
 * @param {Actor} actor
 */
export async function clearDefenseDamage(actor) {
  if (Object.keys(defenseDamageOf(actor)).length) {
    await actor.unsetFlag('essence20', DEFENSE_DAMAGE_FLAG);
  }
}
