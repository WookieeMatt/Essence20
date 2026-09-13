/**
 * Grid Soldier (A Jump Through Time, General Perk, p.54): "As a Free action, you may spend 1
 * Personal Power to remove the Impaired condition from yourself or an ally within 5 feet." (The
 * Threat-Level-comparison shiftUp half lives directly in dice.mjs's own
 * _getAutomaticCombatModifiers, right alongside Hierarchy Rank's identical-shaped check.)
 *
 * Same "non-enemy" disposition-equality ally proxy and click-time range validation Comic Flair's
 * own applyComicFlair already established, scoped to Impaired only and a 5ft radius, with self
 * (distance 0) always eligible as its own explicit target rather than needing to be the resolved
 * `game.user.targets.first()`.
 */

const RADIUS_FEET = 5;

/**
 * Resolves the actor whose Impaired condition Grid Soldier should remove - the roller if no
 * target is set, or their currently-targeted non-enemy ally within 5ft.
 * @param {Actor} actor
 * @returns {Actor|null}   The actor to remove Impaired from, or null if there's nothing valid
 *   (no eligible target in range, or the resolved target isn't actually Impaired) - surfaced as a
 *   single warning by the caller, same idiom Comic Flair's own no-valid-target case already uses.
 */
export function getGridSoldierImpairedTarget(actor) {
  const actorToken = actor?.getActiveTokens?.()?.[0];
  if (!actorToken || !canvas?.grid) {
    return null;
  }

  const targetToken = game.user.targets.first() ?? actorToken;
  if (!targetToken?.actor) {
    return null;
  }

  const isSelf = targetToken === actorToken;
  const isNonEnemy = isSelf || targetToken.document.disposition === actorToken.document.disposition;
  const distance = isSelf ? 0 : canvas.grid.measurePath([targetToken.center, actorToken.center]).distance;
  if (!isNonEnemy || distance > RADIUS_FEET) {
    return null;
  }

  return targetToken.actor.statuses?.has('impaired') ? targetToken.actor : null;
}
