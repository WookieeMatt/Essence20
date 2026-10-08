import { getNearbyAllyTokens } from "../../mechanics/combat/nearby-allies.mjs";

/**
 * Not On My Watch (Factions in Action Vol. 2: Intercontinental Adventures, Oktober Guard General
 * Perk, p.95): an ally gaining the Defeated Condition lets you move toward them at once, and you
 * get +1 Toughness and Evasion while a Defeated teammate is within your Reach.
 *
 * The "move toward them" half is the item's own watch Triggers (a button granting the Move): one on
 * droppedToZero (Health reaching 0) and one on defeatedByStun (Stun reaching the remaining Health -
 * mechanics/combat/combat.mjs#applyDamage fires it, rules/plugins/book/effects.mjs). The Defense half
 * is a Defense rule reading check:defeatedAllyInReach, answered by hasDefeatedAllyInReach below.
 */
const REACH_FEET = 5;

/**
 * Whether any allied token within 5ft of the actor is currently Defeated.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function hasDefeatedAllyInReach(actor) {
  return getNearbyAllyTokens(actor, REACH_FEET).some(token => token.actor?.statuses?.has('defeated'));
}
