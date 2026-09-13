import { actorHasPerk } from "./perks.mjs";

const GROWTH_BOOST_ID = "Compendium.essence20.jump_through_time.Item.BVrwQKqvOdyNW0KR";
const GROWTH_BOOST_HEALTH_BONUS = 2;

/**
 * Growth Boost (A Jump Through Time, Orange Ranger, Modified Shell III option, p.33): "you gain 2
 * temporary Health while Morphed." Same flat system.health.bonus add/remove shape as Boosted
 * Vigor (helpers/phantom-focus.mjs) - called from
 * sheet-handlers/power-ranger-handler.mjs#onMorph right before it flips isMorphed, so
 * isAboutToMorph reflects the state being entered, not the one being left. The Perk's other two
 * automated clauses (Edge on Brawn; +1 base Unarmed Strike damage) are a plain compendium Active
 * Effect and a dice.mjs damage-bonus check respectively - "double carry weight" is Not automatable
 * (no encumbrance subsystem exists anywhere in this codebase).
 * @param {Actor} actor
 * @param {Boolean} isAboutToMorph   True if this call is about to Morph the actor, false if it's
 *   about to un-Morph them.
 */
export async function applyGrowthBoostHealth(actor, isAboutToMorph) {
  if (!actorHasPerk(actor, GROWTH_BOOST_ID)) {
    return;
  }

  const delta = isAboutToMorph ? GROWTH_BOOST_HEALTH_BONUS : -GROWTH_BOOST_HEALTH_BONUS;
  await actor.update({ 'system.health.bonus': actor.system.health.bonus + delta });
}
