import { hasUsedThisTurn, markUsedThisTurn } from "./perks.mjs";

/**
 * Power Bleed (Finster's Monster-Matic Cookbook, Path of Frost, 5th level, p.292): "Spend 1
 * Personal Power as a Free action to apply a small amount of entropic energy to your attacks.
 * Until the end of your turn, any successful attack you make causes the target to lose 1 Personal
 * Power if possible, in addition to the attack's normal effects."
 *
 * Same turn-scoped shape as Psycho Assault (helpers/psycho-assault.mjs's own doc comment) - reuses
 * hasUsedThisTurn/markUsedThisTurn's "already used this turn" semantics as "still valid this
 * turn," checked passively on every subsequent roll rather than consumed by just the first one.
 */
const POWER_BLEED_FLAG = 'powerBleedActiveThisTurn';
const ACTIVATION_COST = 1;

export function isPowerBleedActive(actor) {
  return hasUsedThisTurn(actor, POWER_BLEED_FLAG);
}

/**
 * Spends 1 Personal Power and marks the drain active for the rest of the current turn.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function activatePowerBleed(actor) {
  if ((actor.system.powers?.personal?.value ?? 0) < ACTIVATION_COST) {
    return false;
  }

  await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - ACTIVATION_COST });
  await markUsedThisTurn(actor, POWER_BLEED_FLAG);
  return true;
}

/**
 * Docks 1 Personal Power from a successfully-hit target, floored at 0 (a no-op if the target has
 * no Personal Power pool at all).
 * @param {Actor} targetActor
 */
export async function drainPowerBleedTarget(targetActor) {
  if (targetActor.system.powers?.personal) {
    await targetActor.update({
      'system.powers.personal.value': Math.max(0, targetActor.system.powers.personal.value - 1),
    });
  }
}
