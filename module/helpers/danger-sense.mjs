import { getProtectedTargetUuid } from "./protected-target.mjs";

/**
 * Danger Sense (GI Joe CRB, Bodyguard Focus, 6th level, p.110): "Your Protected Target can choose
 * to set their Initiative score equal to yours at the start of an encounter." Only the Bodyguard
 * holds this Perk, so it's dispatched as their own "Use" button rather than needing the Protected
 * Target's own separate confirmation - the same "grant, don't gate on a second actor's individual
 * confirmation" idiom Knight's Jump's own cross-actor Initiative write already establishes. The
 * Alertness-for-Initiative +2 half lives in dice.mjs#prepareInitiativeRoll instead (a Cunning-Plan-
 * shaped shift-position-delta substitution, same shape as Ever Vigilant). "Can't be Surprised" and
 * "Protected Target is also immune to surprise" aren't built - no Surprised status exists.
 */

/**
 * Sets the actor's own currently-designated Protected Target's Combatant#initiative equal to the
 * actor's own, if both are seated in the current combat and the actor has already rolled.
 * @param {Actor} actor   The Bodyguard.
 * @returns {Promise<Boolean>}   Whether the sync actually happened.
 */
export async function syncDangerSenseInitiative(actor) {
  if (!game.combat) {
    ui.notifications.warn(game.i18n.localize('E20.DangerSenseNoCombat'));
    return false;
  }

  const protectedUuid = getProtectedTargetUuid(actor);
  const protectedTarget = protectedUuid ? await fromUuid(protectedUuid) : null;
  if (!protectedTarget) {
    ui.notifications.warn(game.i18n.localize('E20.DangerSenseNoProtectedTarget'));
    return false;
  }

  const myCombatant = game.combat.combatants.find(c => c.actor?.id == actor.id);
  const targetCombatant = game.combat.combatants.find(c => c.actor?.id == protectedTarget.id);
  if (!myCombatant || myCombatant.initiative == null || !targetCombatant) {
    ui.notifications.warn(game.i18n.localize('E20.DangerSenseNotSeated'));
    return false;
  }

  await targetCombatant.update({ initiative: myCombatant.initiative });
  return true;
}
