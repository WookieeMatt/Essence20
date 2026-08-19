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
  // Character/NPC/Companion essences use .max (character.mjs); Vehicle/Zord/Megaform's
  // machine-based essences (machine.mjs, zord-base.mjs) use .value instead - there's no .max
  // on those to read.
  const speedEssence = actor.system.essences.speed;
  const speed = speedEssence.max ?? speedEssence.value ?? 0;

  return {
    free: Math.max(0, speed - 2),
    movement: speed > 0 ? 1 : 0,
    standard: speed > 1 ? 1 : 0,
  };
}

/**
 * Given a system.color string, work out the values for --e20-system-color and its
 * 50%-alpha counterpart --e20-system-color-50.
 * @param {String} color The raw system.color value (expected to be a hex color)
 * @returns {{normalizedColor: String, alphaColor: String}}
 */
function computeSystemColorVars(color) {
  const normalizedColor = String(color).trim();

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

  return { normalizedColor, alphaColor };
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

  const { normalizedColor, alphaColor } = computeSystemColorVars(color);
  element.style.setProperty('--e20-system-color', normalizedColor);
  element.style.setProperty('--e20-system-color-50', alphaColor);
}

/**
 * The Contacts/Combiners/Crew list (system-actors.hbs) shows other actors attached to this
 * one - each row's e20-border-accent trim should read as THAT attached actor's own
 * system.color, not the sheet owner's color it would otherwise inherit from the root element
 * above. Each row carries its attached actor's color in a data-e20-color attribute already;
 * this sets the same --e20-system-color/-50 pair locally on each row so it overrides (rather
 * than inherits) the root value for just that row's subtree.
 * @param {HTMLElement} element The sheet's root element
 */
export function applySystemActorsColorCssVariables(element) {
  if (!element) return;

  for (const row of element.querySelectorAll('.systemActors[data-e20-color]')) {
    const color = row.dataset.e20Color;
    if (!color) continue;

    const { normalizedColor, alphaColor } = computeSystemColorVars(color);
    row.style.setProperty('--e20-system-color', normalizedColor);
    row.style.setProperty('--e20-system-color-50', alphaColor);
  }
}
