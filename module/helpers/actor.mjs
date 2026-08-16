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
 * Changes the image for all tokens tied to the actor
 * @param {Actor} actor The actor who is changing
 * @param {String} newImage The location of the image file
 */
export function changeTokenImage(actor, newImage){
  const tokens = actor?.getActiveTokens();
  for (const token of tokens) {
    token.document.update({
      "texture.src": newImage,
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

/**
 * Set the --e20-system-color CSS variables used to drive the e20-border-accent
 * coloring (header/profile-img border, sheet tabs, skill headers, etc.) from the
 * actor's chosen system.color.
 * @param {HTMLElement} element The sheet's root element
 * @param {Actor} actor The actor being rendered
 */
export function applySystemColorCssVariables(element, actor) {
  const color = actor?.system?.color;
  if (!element || !color) return;

  const normalizedColor = String(color).trim();
  element.style.setProperty('--e20-system-color', normalizedColor);

  const hexColor = normalizedColor.startsWith('#') ? normalizedColor : null;
  const alphaColor = hexColor && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hexColor)
    ? (() => {
      const hex = hexColor.length === 4
        ? hexColor.split('').map((char, index) => index === 0 ? char : char + char).join('').slice(1)
        : hexColor.slice(1);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, 0.5)`;
    })()
    : 'rgba(0, 0, 0, 0.5)';

  element.style.setProperty('--e20-system-color-50', alphaColor);
}
