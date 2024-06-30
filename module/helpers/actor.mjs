/**
 * Handle looking up tokens associated with actor and changing size
 * @param {Actor} actor  The actor
 * @param {Number} width The actor's new width
 * @param {Number} height The actor's new width
 */
export function resizeTokens(actor, width, height) {
  const tokens = actor?.getActiveTokens();
  for (const token of tokens) {
    token.document.update({
      "height": height,
      "width": width,
    });
  }
}

/**
 * Displays an error message if the sheet is locked
 * @returns {boolean} True if the sheet is locked, and false otherwise
 */
export function checkIsLocked(actor) {
  if (actor.system.isLocked) {
    ui.notifications.error(game.i18n.localize('E20.ActorLockError'));
    return true;
  }

  return false;
}

/**
 * Prepare the number of actions available for the given actor
 * @param {Actor} actor The actor to get actions for
 * @return {Object} Action types mapped to an action count
 */
export function getNumActions(actor) {
  const speed = actor.system.essences.speed.max;

  return {
    free: Math.max(0, speed - 2),
    movement: speed > 0 ? 1 : 0,
    standard: speed > 1 ? 1 : 0,
  };
}
