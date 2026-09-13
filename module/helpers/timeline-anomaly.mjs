/**
 * Timeline Anomaly (WTNV Citizen's Guide, General Perk, p.47, Weird +d8): "Once per session, you
 * can use your Standard action to swap your Initiative in combat with another Citizen."
 *
 * A plain declaration (no roll) against whichever token is currently targeted - same auto-detect
 * "Use" button shape as Mark Target - swapping the two Combatants' own `initiative` values
 * directly, the same real Combat/Combatant#update write Splinter Defense's own reciprocal
 * Initiative dock already established in this project (dice.mjs's own
 * `attackerCombatant.update({ initiative: ... })` call).
 */

/**
 * Swaps the acting actor's own Combatant Initiative with the currently-targeted token's own
 * Combatant, if both exist in the active Combat.
 * @param {Actor} actor
 * @param {Object} [options]
 * @param {Boolean} [options.requireLowerTarget]   After You (MLP CRB, Spirit of Generosity, 6th
 *   level, p.76) only lets you trade places with a friend who rolled LOWER than you ("it's rude
 *   to go first") - unlike Timeline Anomaly's own unrestricted swap, reusing this same function
 *   rather than duplicating its combat/target validation.
 * @returns {Promise<Boolean>}   Whether the swap actually happened.
 */
export async function swapInitiativeWithTarget(actor, { requireLowerTarget = false } = {}) {
  if (!game.combat) {
    ui.notifications.warn(game.i18n.localize('E20.TimelineAnomalyNoCombat'));
    return false;
  }

  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.TimelineAnomalyNoTarget'));
    return false;
  }

  const actorCombatant = game.combat.combatants.find(c => c.actor?.id == actor.id);
  const targetCombatant = game.combat.combatants.find(c => c.actor?.id == targetActor.id);
  if (!actorCombatant || !targetCombatant) {
    ui.notifications.warn(game.i18n.localize('E20.TimelineAnomalyNoTarget'));
    return false;
  }

  const actorInitiative = actorCombatant.initiative;
  const targetInitiative = targetCombatant.initiative;
  if (requireLowerTarget && targetInitiative >= actorInitiative) {
    ui.notifications.warn(game.i18n.localize('E20.AfterYouMustRollLower'));
    return false;
  }

  await actorCombatant.update({ initiative: targetInitiative });
  await targetCombatant.update({ initiative: actorInitiative });
  return true;
}
