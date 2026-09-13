/**
 * Boost Initiative (Power Rangers Core Rulebook, Grid Power, p.99): "Anytime after your Initiative
 * order is determined, you may spend Power to increase your current Initiative standing at a
 * ratio of +2 per Power spent." A variable-cost Power with no printed maximum - the actual amount
 * spent is only known once the player confirms it in apps/power-cost-selector.mjs's own dialog
 * (sheet-handlers/power-handler.mjs#_powerCountUpdate), which is why onPowerUse now threads that
 * amount through as its own 3rd param. Writes directly to the actor's own Combatant#initiative,
 * the same field Splinter Defense's own post-hit penalty already established writing to (dice.mjs,
 * ~line 5037) - just adding instead of subtracting, and gated on the actor actually being in the
 * current combat at all (RAW assumes Initiative has already been rolled).
 */

/**
 * @param {Actor} actor
 * @param {Number} amountSpent   How much Power was spent on this activation.
 * @returns {Promise<Boolean>}   Whether the actor's Initiative was actually adjusted.
 */
export async function activateBoostInitiative(actor, amountSpent) {
  if (!amountSpent || !game.combat) {
    return false;
  }

  const combatant = game.combat.combatants.find(c => c.actor?.id == actor.id);
  if (!combatant || combatant.initiative == null) {
    return false;
  }

  await combatant.update({ initiative: combatant.initiative + (2 * amountSpent) });
  return true;
}
