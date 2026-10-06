/**
 * Temporary Health and temporary Energon that go away again - the part every "temporary Health"
 * grant in this codebase left out. The grant itself stays the house shape (system.health.bonus
 * plus .value, so it can exceed the normal maximum); this file records each grant on the actor
 * and takes it back when its duration ends.
 *
 * Got To Get Tough (GI Joe CRB, Officer, 2nd level, p.85): "This temporary Health lasts for the
 * entire scene, until they take damage, or until you are Defeated." The grant is made by
 * items/healing/got-to-get-tough.mjs, which records it here (see the integration patch).
 *
 * Together We Stand (Enigma of Combination) grants through here from its item rule (rules/plugins/resources/temp-resource-step.mjs tempResource).
 */
import { registerAfterDamage, registerSceneAdvanced } from "../item-hooks.mjs";
import { num } from "../../items/shared/numbers.mjs";
import { worldActors } from "../companions/companion-link.mjs";
import { updateRelayedWithOptions as writeActor } from "../../items/shared/relayed-writes.mjs";

export const TEMP_FLAG = 'resTempGrants';

/**
 * Energon an actor may legitimately hold over its maximum for other reasons (the Repair Progress
 * bonus point) - fn(actor) => Number. Clamping temporary Energon away must leave that alone.
 */
export const ENERGON_CAP_EXTRAS = [];

/** The grants recorded on an actor. */
export function tempGrants(actor) {
  const list = actor?.flags?.essence20?.[TEMP_FLAG];
  return Array.isArray(list) ? list : [];
}

/**
 * The update that takes some grants back: the bonus comes off the maximum and the current value
 * can no longer sit above the new maximum. Temporary Health is spent first, so damage already
 * taken simply comes out of it.
 * @param {Object} system   actor.system
 * @param {Array} removing   Grants being removed.
 * @returns {Object}   A flat update (without the flag).
 */
export function revokeUpdate(system, removing, energonExtra = 0) {
  const update = {};
  const health = removing.filter(g => g.kind == 'health').reduce((sum, g) => sum + num(g.amount), 0);
  if (health > 0) {
    const bonus = Math.max(0, num(system?.health?.bonus) - health);
    const max = Math.max(0, num(system?.health?.max) - health);
    update['system.health.bonus'] = bonus;
    update['system.health.value'] = Math.min(num(system?.health?.value), max);
  }

  if (removing.some(g => g.kind == 'energon')) {
    const max = num(system?.energon?.normal?.max) + energonExtra;
    update['system.energon.normal.value'] = Math.min(num(system?.energon?.normal?.value), max);
  }

  return update;
}

/**
 * Give temporary Health or Energon and remember it.
 * @param {Actor} actor
 * @param {Object} grant
 * @param {'health'|'energon'} grant.kind
 * @param {Number} grant.amount
 * @param {String} grant.source   A short key naming what granted it.
 * @param {String} [grant.by]   Uuid of the granter (for "until you are Defeated").
 * @param {Boolean} [grant.untilDamage]
 * @param {Boolean} [grant.apply]   Also raise the resource (default true). Got To Get Tough
 *   already raised it itself.
 */
export async function grantTemp(actor, { kind, amount, source, by = null, untilDamage = false, apply = true }) {
  if (!actor || !(amount > 0)) {
    return;
  }

  const update = {};
  if (apply && kind == 'health') {
    update['system.health.bonus'] = num(actor.system?.health?.bonus) + amount;
    update['system.health.value'] = num(actor.system?.health?.value) + amount;
  } else if (apply && kind == 'energon') {
    update['system.energon.normal.value'] = num(actor.system?.energon?.normal?.value) + amount;
  }

  update[`flags.essence20.${TEMP_FLAG}`] = [...tempGrants(actor), { kind, amount, source, by, untilDamage }];
  await writeActor(actor, update);
}

/** Record a grant something else already applied (Got To Get Tough). */
export async function recordTempHealth(actor, amount, { source, by = null, untilDamage = false } = {}) {
  return grantTemp(actor, { kind: 'health', amount, source, by, untilDamage, apply: false });
}

/**
 * Take back the grants matching a test.
 * @param {Actor} actor
 * @param {Function} test   grant => Boolean
 */
export async function revokeTemp(actor, test) {
  const grants = tempGrants(actor);
  const removing = grants.filter(test);
  if (!removing.length) {
    return 0;
  }

  const extra = ENERGON_CAP_EXTRAS.reduce((sum, fn) => sum + (Number(fn(actor)) || 0), 0);
  const update = revokeUpdate(actor.system, removing, extra);
  update[`flags.essence20.${TEMP_FLAG}`] = grants.filter(g => !test(g));
  await writeActor(actor, update);
  return removing.length;
}

// Taking damage ends "until they take damage" grants; being Defeated ends grants you made.
registerAfterDamage(async (actor, dealt, damageType, { newValue, wasAlreadyDefeated } = {}) => {
  if (dealt > 0) {
    await revokeTemp(actor, g => g.untilDamage);
  }

  if (newValue <= 0 && !wasAlreadyDefeated && actor?.uuid) {
    for (const other of worldActors()) {
      await revokeTemp(other, g => g.by && g.by == actor.uuid);
    }
  }
});

// The scene is over: every temporary resource from this file ends.
registerSceneAdvanced(async () => {
  for (const actor of worldActors()) {
    await revokeTemp(actor, () => true);
  }
});

