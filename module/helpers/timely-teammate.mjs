import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

/**
 * Timely Teammate (Ferocious Fighters, Tiger Force General Perk, p.39; prerequisite: Initiative
 * +d4): "Before the start of combat, after rolling Initiative, you can choose to trade places
 * (earlier or later) in the Initiative order with a willing ally. Once you've traded places, you
 * can't trade back this combat. However, you and the ally you trade with can reset their
 * Initiative with a Move action, as usual." A one-time swap of two Combatant#initiative values -
 * the same direct-write mechanism Boost Initiative/Splinter Defense already established, just
 * swapping both instead of adjusting one. The target ally is whichever token is currently
 * targeted (the same auto-detect idiom Mark Target/Fight Me!/Splinter Defense already use) -
 * "willing" isn't enforced (no consent-prompt mechanism anywhere in this codebase, the same
 * accepted simplification every other "with a willing ally" clause in this project already
 * uses). Gated once per combat via the existing hasUsedThisEncounter/markUsedThisEncounter idiom
 * ("you can't trade back this combat") - the "reset with a Move action as usual" clause needs no
 * code, it's just the ordinary Initiative-reset flow this system already has.
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
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether the trade actually happened.
 */
export async function activateTimelyTeammate(actor) {
  if (!canUseTimelyTeammate(actor)) {
    return false;
  }

  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize("E20.TimelyTeammateNoTarget"));
    return false;
  }

  const actorCombatant = game.combat.combatants.find(c => c.actor?.id == actor.id);
  const targetCombatant = game.combat.combatants.find(c => c.actor?.id == targetActor.id);
  if (!actorCombatant || !targetCombatant
    || actorCombatant.initiative == null || targetCombatant.initiative == null) {
    ui.notifications.warn(game.i18n.localize("E20.TimelyTeammateNotInCombat"));
    return false;
  }

  const actorInitiative = actorCombatant.initiative;
  const targetInitiative = targetCombatant.initiative;
  await actorCombatant.update({ initiative: targetInitiative });
  await targetCombatant.update({ initiative: actorInitiative });
  await markUsedThisEncounter(actor, TIMELY_TEAMMATE_ENCOUNTER_FLAG);
  return true;
}
