import { getNearbyAllyTokens } from "./allies.mjs";

/**
 * Stay In Formation (Quartermaster's Guide to Gear, General Perk, p.31): "At the start of combat,
 * instead of rolling their own Initiative Skill Tests, your allies may choose to set their
 * Initiatives as 1d4 lower than yours (minimum result of 1)." Dispatched as the holder's own "Use"
 * button (once per encounter, same idiom as every other "at the start of combat" grant this
 * project has built) rather than gating on each individual ally's own confirmation - the same
 * "grant, don't gate on a second actor's individual confirmation" idiom Danger Sense's own
 * cross-actor Initiative write already establishes, applied to every nearby ally at once (Infinity
 * radius, same as BRRRRRRRRRRRRRRT's own broadcast) instead of a single Protected Target.
 */

/**
 * Sets every nearby ally's own Combatant#initiative to the actor's own result minus a real 1d4
 * roll, floored at 1, for every ally seated in the current combat.
 * @param {Actor} actor   The Stay In Formation holder.
 * @returns {Promise<Boolean>}   Whether at least one ally's Initiative was actually set.
 */
export async function activateStayInFormation(actor) {
  if (!game.combat) {
    ui.notifications.warn(game.i18n.localize('E20.StayInFormationNoCombat'));
    return false;
  }

  const myCombatant = game.combat.combatants.find(c => c.actor?.id == actor.id);
  if (!myCombatant || myCombatant.initiative == null) {
    ui.notifications.warn(game.i18n.localize('E20.StayInFormationNotSeated'));
    return false;
  }

  let applied = false;
  for (const token of getNearbyAllyTokens(actor, Infinity)) {
    const combatant = game.combat.combatants.find(c => c.actor?.id == token.actor?.id);
    if (!combatant) {
      continue;
    }

    const roll = await new Roll('1d4').evaluate();
    const initiative = Math.max(1, myCombatant.initiative - roll.total);
    await combatant.update({ initiative });
    applied = true;
  }

  return applied;
}
