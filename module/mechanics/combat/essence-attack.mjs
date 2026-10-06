import { E20 } from "../../util/config.mjs";

/**
 * Attacks that deal Essence damage instead of Health damage.
 *
 * Essence damage (GI Joe CRB p.207, TF CRB p.161): "Some attacks and effects don't damage your
 * Health, they reduce your Essence Scores." It is a point off an Essence's current value - the gap
 * mechanics/combat/essence-damage.mjs reads and a Rest restores - and it only bites once a score reaches 0,
 * each Essence in its own way (Strength: "forced shutdown", Speed: "paralyzed", Smarts: "a stupor",
 * Social: "lethargic"). Those are posted to chat for the GM rather than applied as Conditions.
 *
 * A weaponEffect deals it by carrying one of the Essence damage types (E20.essenceDamageTypes):
 * - a fixed Essence or pair - the Antimatter Pistol's "1 Strength Essence damage" and the Catalytic
 *   Cannon's "2 Strength and Speed Essence damage" alternate effects (Decepticon Directive p.72-73);
 * - 'any', Sludge (Cobra Codex p.94): "One dose of Sludge deals 1 Essence damage... If Science is
 *   used for the Skill Test, the attacker chooses the Essence affected. Otherwise, randomly
 *   determine the Essence affected." Every point of the hit lands on that one Essence;
 * - 'swap', V.E.N.O.M. (same page): "+1 to one Essence, and -1 to one Essence", chosen or random the
 *   same way, "two different Essences must be affected". A lasting change to both scores (max and
 *   current), logged on the target so a GM can see and undo it. Not scaled by Degrees of Success -
 *   one dose is one change.
 *
 * chat.mjs#onApplyDamage routes an Apply Damage button of one of these types here, and
 * combat.mjs#applyDamage does too for any other caller.
 */

export const ESSENCE_MUTATIONS_FLAG = 'essenceMutations';

const ESSENCES = ['strength', 'speed', 'smarts', 'social'];

const ZERO_EFFECT_KEYS = {
  strength: 'E20.EssenceZeroStrength',
  speed: 'E20.EssenceZeroSpeed',
  smarts: 'E20.EssenceZeroSmarts',
  social: 'E20.EssenceZeroSocial',
};

/**
 * @param {String} damageType
 * @returns {Boolean}   Whether it is one of the Essence damage types.
 */
export function isEssenceDamageType(damageType) {
  return !!damageType && Object.hasOwn(E20.essenceDamageTypes ?? {}, damageType);
}

/**
 * The Essences this actor tracks as a score it can lose (PCs, NPCs, companions). Vehicles and
 * other machines keep a flat number instead, and a Megaform's scores are read off its members,
 * so they have none.
 * @param {Actor} actor
 * @returns {Array<String>}
 */
export function essenceKeysOf(actor) {
  if (actor?.type == 'megaform') {
    return [];
  }

  return ESSENCES.filter(key => typeof actor?.system?.essences?.[key]?.value == 'number');
}

/**
 * @param {Array<String>} keys
 * @param {Function} [random]   Returns [0, 1).
 * @returns {String|null}
 */
export function randomEssence(keys, random = Math.random) {
  if (!keys.length) {
    return null;
  }

  return keys[Math.min(keys.length - 1, Math.floor(random() * keys.length))];
}

function essenceLabel(essence) {
  return game.i18n.localize(E20.essences?.[essence] ?? essence);
}

async function pickEssence(prompt, keys) {
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.EssenceAttackChooseTitle') },
    classes: ["window-app", "e20-window"],
    content: `<p>${prompt}</p><div class="form-group"><select name="choice">${
      keys.map(key => `<option value="${key}">${foundry.utils.escapeHTML?.(essenceLabel(key)) ?? essenceLabel(key)}</option>`).join('')
    }</select></div>`,
    buttons: [
      { action: 'ok', label: game.i18n.localize('E20.DialogConfirmButton'), default: true, callback: (event, button) => button.form.elements.choice.value },
      { action: 'cancel', label: game.i18n.localize('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });

  return result && result != 'cancel' && keys.includes(result) ? result : null;
}

/**
 * Which Essences an Essence damage type hits on this target.
 * @param {Actor} actor
 * @param {String} damageType
 * @param {Object} [options]
 * @param {Boolean} [options.attackerChooses]   The attack used Science ('any' and 'swap' only).
 * @param {Function} [options.random]
 * @returns {Promise<Array<String>|{up: String, down: String}|null>}   null when there is nothing
 *   to hit, or the chooser cancelled.
 */
export async function resolveEssenceTargets(actor, damageType, { attackerChooses = false, random = Math.random } = {}) {
  const spec = E20.essenceDamageTypes?.[damageType];
  const keys = essenceKeysOf(actor);
  if (Array.isArray(spec)) {
    const hit = spec.filter(essence => keys.includes(essence));
    return hit.length ? hit : null;
  }

  if (spec == 'any') {
    const essence = attackerChooses
      ? await pickEssence(game.i18n.format('E20.EssenceAttackChoose', { name: actor.name }), keys)
      : randomEssence(keys, random);
    return essence ? [essence] : null;
  }

  if (spec == 'swap') {
    if (keys.length < 2) {
      return null;
    }

    const up = attackerChooses
      ? await pickEssence(game.i18n.format('E20.EssenceSwapChooseUp', { name: actor.name }), keys)
      : randomEssence(keys, random);
    if (!up) {
      return null;
    }

    const rest = keys.filter(key => key != up);
    const down = attackerChooses
      ? await pickEssence(game.i18n.format('E20.EssenceSwapChooseDown', { name: actor.name }), rest)
      : randomEssence(rest, random);
    return down ? { up, down } : null;
  }

  return null;
}

/**
 * V.E.N.O.M.'s +1/-1: raises one Essence score (max and current) and lowers another, never below 0.
 * @param {Actor} actor
 * @param {String} up
 * @param {String} down
 * @returns {Promise<void>}
 */
export async function applyEssenceSwap(actor, up, down) {
  const essences = actor.system.essences;
  const mutations = actor.flags?.essence20?.[ESSENCE_MUTATIONS_FLAG] ?? [];
  await actor.update({
    [`system.essences.${up}.max`]: (Number(essences[up].max) || 0) + 1,
    [`system.essences.${up}.value`]: (Number(essences[up].value) || 0) + 1,
    [`system.essences.${down}.max`]: Math.max(0, (Number(essences[down].max) || 0) - 1),
    [`system.essences.${down}.value`]: Math.max(0, (Number(essences[down].value) || 0) - 1),
    [`flags.essence20.${ESSENCE_MUTATIONS_FLAG}`]: [...mutations, { up, down }],
  });
}

/**
 * Applies an Essence damage type to an actor.
 * @param {Actor} actor
 * @param {Number} amount   Points per Essence hit (already scaled by Degrees of Success).
 * @param {String} damageType   One of E20.essenceDamageTypes' keys.
 * @param {Object} [options]
 * @param {Boolean} [options.attackerChooses]   The attack used Science.
 * @param {Boolean} [options.ignoreImmunity]
 * @param {Function} [options.random]
 * @returns {Promise<{applied: Number, damaged: Object<String, Number>, zeroed: Array<String>,
 *   swap: ?{up: String, down: String}, cancelled: ?Boolean}>}   `applied` is the total points
 *   taken; `cancelled` means the attacker's choice dialog was closed.
 */
export async function applyEssenceAttack(actor, amount, damageType, { attackerChooses = false, ignoreImmunity = false, random = Math.random } = {}) {
  const result = { applied: 0, damaged: {}, zeroed: [], swap: null };
  if (!actor || !(amount > 0) || (!ignoreImmunity && actor.system?.immunities?.[damageType])) {
    return result;
  }

  const targets = await resolveEssenceTargets(actor, damageType, { attackerChooses, random });
  if (!targets) {
    // The chooser closed the dialog without picking - nothing happened, so the button stays live.
    const spec = E20.essenceDamageTypes?.[damageType];
    result.cancelled = attackerChooses && essenceKeysOf(actor).length >= (spec == 'swap' ? 2 : 1) && !Array.isArray(spec);
    return result;
  }

  if (!Array.isArray(targets)) {
    await applyEssenceSwap(actor, targets.up, targets.down);
    result.swap = targets;
    return result;
  }

  // environment-hazards.mjs takes each point (it also holds Immortal Rebel Soul's "stays at 1").
  // Imported here rather than at the top: it imports combat.mjs, which imports this file.
  const { applyEssenceDamage } = await import("../world/environment-hazards.mjs");
  const before = Object.fromEntries(targets.map(essence => [essence, Number(actor.system.essences[essence].value) || 0]));
  for (let i = 0; i < amount; i++) {
    const damaged = await applyEssenceDamage(actor, targets);
    for (const essence of damaged) {
      result.damaged[essence] = (result.damaged[essence] ?? 0) + 1;
      result.applied++;
    }
  }

  result.zeroed = Object.entries(result.damaged)
    .filter(([essence, taken]) => before[essence] - taken <= 0)
    .map(([essence]) => essence);
  return result;
}

/**
 * The chat line for an applyEssenceAttack result.
 * @param {Actor} actor
 * @param {Object} result
 * @returns {String}
 */
export function describeEssenceAttack(actor, result) {
  if (result.swap) {
    return game.i18n.format('E20.EssenceSwapApplied', {
      name: actor.name, up: essenceLabel(result.swap.up), down: essenceLabel(result.swap.down),
    });
  }

  if (!result.applied) {
    return game.i18n.format('E20.EssenceAttackNone', { name: actor.name });
  }

  const list = Object.entries(result.damaged).map(([essence, taken]) => `${taken} ${essenceLabel(essence)}`).join(', ');
  const lines = [game.i18n.format('E20.EssenceAttackApplied', { name: actor.name, list })];
  for (const essence of result.zeroed) {
    lines.push(game.i18n.format('E20.EssenceAttackZero', {
      name: actor.name, essence: essenceLabel(essence), effect: game.i18n.localize(ZERO_EFFECT_KEYS[essence]),
    }));
  }

  return lines.join('<br>');
}
