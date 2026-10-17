import { ruleFreeActionEssence } from "../../rules/plugins/resources/action-count.mjs";

/**
 * How many Free, Move and Standard actions an actor gets from its Speed (or, with an ActionCount rule - Quick Thinker,
 * University Days, Foot Soldier - another Essence or a raised Speed: rules/plugins/resources/action-count.mjs).
 */

/**
 * Prepare the number of actions available for the given actor
 * @param {Actor} actor The actor to get actions for
 * @return {Object} Action types mapped to an action count
 */
export function getNumActions(actor) {
  // Character/NPC/Companion essences use .max (character.mjs); Vehicle/Zord/Megaform's
  // machine-based essences (machine.mjs, zord-base.mjs) use .value instead - there's no .max
  // on those to read. Actor types with no Essence scores at all (e.g. Party) have no action
  // economy.
  const speedEssence = actor.system.essences?.speed;
  if (!speedEssence) {
    return { free: 0, movement: 0, standard: 0 };
  }

  const speed = speedEssence.max ?? speedEssence.value ?? 0;

  const freeActionEssence = ruleFreeActionEssence(actor, speed);

  return {
    free: Math.max(0, freeActionEssence - 2),
    movement: speed > 0 ? 1 : 0,
    standard: speed > 1 ? 1 : 0,
  };
}
