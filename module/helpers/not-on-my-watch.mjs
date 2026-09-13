import { getNearbyAllyTokens } from "./allies.mjs";

/**
 * Not On My Watch (Factions in Action Vol. 2: Intercontinental Adventures, Oktober Guard General
 * Perk, p.95): "If a member of your unit that you can see gains the Defeated Condition, you can
 * immediately Move your Ground Movement towards them. You gain +1 Toughness and +1 Evasion while
 * a Defeated teammate is within your Reach."
 *
 * Only the second clause is built - the first ("immediately Move towards a newly-Defeated ally")
 * is a genuine reaction to a Condition being applied to someone ELSE, needing the same still-
 * missing "react to an event" hook this project has flagged many times before (Fe-BURN!, Defender
 * Step, Projectile Deflector, etc.). The Defense-bonus half is a plain live proximity check with
 * no reaction involved at all - same "any Defeated ally" idiom Field Aid's own
 * hasNearbyDefeatedAlly already established, but scoped to a real finite radius ("within your
 * Reach," this system's own 5ft melee range) instead of Field Aid's own unscoped "anywhere on the
 * scene" (Field Aid drops the range because it can't verify movement DIRECTION either way, so an
 * unscoped check is the closest approximation available; this Perk's own "within your Reach" is a
 * plain distance check with nothing else to approximate away).
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

/**
 * The live, non-consumed Defense bonus Not On My Watch grants while a Defeated teammate is within
 * Reach - +1 to both Toughness and Evasion, same shape as helpers/bolster-defense.mjs's own
 * getBolsterDefenseBonus but unconditional on holding the Perk rather than an activated flag.
 * @param {Actor} actor
 * @param {String} defenseType
 * @returns {Number}
 */
export function getNotOnMyWatchDefenseBonus(actor, defenseType) {
  if (defenseType != 'toughness' && defenseType != 'evasion') {
    return 0;
  }

  return hasDefeatedAllyInReach(actor) ? 1 : 0;
}
