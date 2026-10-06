/**
 * Right Behind You (Finster's Monster-Matic Cookbook, Path of Flame, 5th level, p.287): "At the
 * beginning of a combat scene, spend 1 Personal Power to change your result in the Initiative
 * order to take place immediately after an ally's result."
 *
 * Writes directly to the actor's own Combatant#initiative, the same field Boost Initiative/
 * Splinter Defense already establish writing to - set just below whichever ally is currently
 * targeted (the same auto-detect-via-currently-targeted-token idiom Mark Target/Splinter Defense's
 * own attacker-marking already use, since RAW names no other way to pick the ally). "The beginning
 * of a combat scene" is read as round 1, the same round-gate idiom Sucker Punch's own identical
 * RAW phrasing already established.
 */
const NUDGE = 0.01;

/**
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether Initiative was actually adjusted.
 */
export async function activateRightBehindYou(actor) {
  if (!game.combat || game.combat.round != 1) {
    return false;
  }

  const allyActor = game.user.targets.first()?.actor;
  if (!allyActor) {
    return false;
  }

  const combatant = game.combat.combatants.find(c => c.actor?.id == actor.id);
  const allyCombatant = game.combat.combatants.find(c => c.actor?.id == allyActor.id);
  if (!combatant || !allyCombatant || allyCombatant.initiative == null) {
    return false;
  }

  await combatant.update({ initiative: allyCombatant.initiative - NUDGE });
  return true;
}
