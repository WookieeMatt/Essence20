import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

/**
 * Timely Teammate (Factions in Action Vol. 1: Ferocious Fighters, General Perk, p.39,
 * prerequisite Initiative +d4): "Before the start of combat, after rolling Initiative, you can
 * choose to trade places (earlier or later) in the Initiative order with a willing ally. Once
 * you've traded places, you can't trade back this combat. However, you and the ally you trade
 * with can reset their Initiative with a Move action, as usual."
 *
 * Same auto-detect "Use" button shape as Mark Target/Timeline Anomaly - "trading places" is
 * exactly swapping the two Combatants' own numeric `initiative` values (Splinter Defense's own
 * precedent for writing that field), since Foundry's own Combat Tracker sorts turn order strictly
 * by that number - no confirm dialog, the click itself is the commitment, same as those two.
 * "A willing ally" is the same unenforced consent precondition every other such clause in this
 * project already accepts. Naturally once-per-combat: RAW's own window is "before the start of
 * combat," and "can't trade back" forbids undoing it, so this is gated the same
 * hasUsedThisEncounter way as every other daily/per-scene resource in this project - kept as its
 * own separate implementation (not Timeline Anomaly's shared swapInitiativeWithTarget) since its
 * warning messages and encounter-gate are specific to this Perk.
 */
const TIMELY_TEAMMATE_ENCOUNTER_FLAG = 'timelyTeammateUsedThisEncounter';

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseTimelyTeammate(actor) {
  return !!game.combat && !hasUsedThisEncounter(actor, TIMELY_TEAMMATE_ENCOUNTER_FLAG);
}

/**
 * Swaps the holder's and the currently-targeted ally's own Combatant#initiative values.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether the swap actually happened.
 */
export async function activateTimelyTeammate(actor) {
  if (!canUseTimelyTeammate(actor)) {
    return false;
  }

  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.TimelyTeammateNoTarget'));
    return false;
  }

  const actorCombatant = game.combat.combatants.find(c => c.actor?.id == actor.id);
  const targetCombatant = game.combat.combatants.find(c => c.actor?.id == targetActor.id);
  if (!actorCombatant || !targetCombatant) {
    ui.notifications.warn(game.i18n.localize('E20.TimelyTeammateNotInCombat'));
    return false;
  }

  const actorInitiative = actorCombatant.initiative;
  const targetInitiative = targetCombatant.initiative;
  await actorCombatant.update({ initiative: targetInitiative });
  await targetCombatant.update({ initiative: actorInitiative });

  await markUsedThisEncounter(actor, TIMELY_TEAMMATE_ENCOUNTER_FLAG);
  return true;
}
