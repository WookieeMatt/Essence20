/**
 * Comic Flair (A Jump Through Time, Orange Ranger, Modified Shell I option, p.32): "eliminate the
 * Frightened or Impaired Condition in one non-enemy target within 10 feet of you as a Standard
 * action."
 *
 * "Non-enemy" is this project's own established disposition-equality ally proxy (see
 * helpers/allies.mjs#getNearbyAllyTokens's own doc comment) - matching the actor's own token's
 * Disposition, or the actor's own token itself (a self-target is trivially non-enemy). A plain
 * "Use" button dispatch (like Mark Target/Fight Me!) acting on whichever token is currently
 * targeted, rather than a picker - the "10 feet" range and "non-enemy" checks are validated at
 * click time, surfacing a warning instead of hiding the button entirely (same idiom Mark Target's
 * own no-target case already uses).
 */

const RADIUS_FEET = 10;
const CONDITIONS = ['frightened', 'impaired'];

/**
 * Removes whichever of Frightened/Impaired the actor's currently-targeted non-enemy within 10ft
 * actually has.
 * @param {Actor} actor
 * @returns {Promise<Array<String>|null>}   The Condition keys actually removed, or null if there
 *   was nothing valid to target (surfaced as a warning by the caller).
 */
export async function applyComicFlair(actor) {
  const actorToken = actor?.getActiveTokens?.()?.[0];
  const targetToken = game.user.targets.first();
  if (!actorToken || !targetToken?.actor || !canvas?.grid) {
    return null;
  }

  const isNonEnemy = targetToken === actorToken
    || targetToken.document.disposition === actorToken.document.disposition;
  const distance = canvas.grid.measurePath([targetToken.center, actorToken.center]).distance;
  if (!isNonEnemy || distance > RADIUS_FEET) {
    return null;
  }

  const removed = CONDITIONS.filter(condition => targetToken.actor.statuses?.has(condition));
  for (const condition of removed) {
    await targetToken.actor.toggleStatusEffect(condition, { active: false });
  }

  return removed;
}
