/**
 * The actor's chosen system.color as CSS variables on its sheet (and on the attached-actor rows), with the text tone
 * that reads on it.
 */

/**
 * WCAG relative luminance of a hex colour: 0 for black, 1 for white.
 * @param {String} hex   "#rgb" or "#rrggbb".
 * @returns {Number|null}   Null for anything that is not a hex colour.
 */
export function relativeLuminance(hex) {
  const value = String(hex ?? "").trim();
  if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) {
    return null;
  }

  const full = value.length === 4 ? value.slice(1).split("").map(c => c + c).join("") : value.slice(1);
  const channel = (i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  return (0.2126 * channel(0)) + (0.7152 * channel(2)) + (0.0722 * channel(4));
}

/**
 * Above this luminance, dark text out-contrasts light text on the colour - WCAG's black/white
 * crossover, where the two contrast ratios are equal.
 */
export const LIGHT_FILL_LUMINANCE = 0.179;

/**
 * Given a system.color string, work out the values for --e20-system-color and its
 * 50%-alpha counterpart --e20-system-color-50, and which tone of text reads on it.
 * @param {String} color The raw system.color value (expected to be a hex color)
 * @returns {{normalizedColor: String, alphaColor: String, fillTone: "light"|"dark"|null}}
   fillTone is null for a colour that is not a hex value, where the luminance is unknown.
 */
export function computeSystemColorVars(color) {
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

  const luminance = relativeLuminance(normalizedColor);
  const fillTone = luminance === null ? null : (luminance > LIGHT_FILL_LUMINANCE ? "light" : "dark");

  return { normalizedColor, alphaColor, fillTone };
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

  const { normalizedColor, alphaColor, fillTone } = computeSystemColorVars(color);
  element.style.setProperty('--e20-system-color', normalizedColor);
  element.style.setProperty('--e20-system-color-50', alphaColor);

  // Text laid straight on the colour - the unselected sheet tabs (actors/_tabs.scss). Whichever
  // of dark or near-white text contrasts more (the WCAG crossover): a light fill gets dark text
  // and no halo, a dark one near-white over the stylesheet's dark halo. The old one-size light
  // grey read at under 2:1 on mid-tones like magenta and purple, and all but vanished on yellow.
  // An unparseable colour keeps the stylesheet default; the properties are removed rather than
  // left behind, since the sheet can change colour without being re-created.
  //
  // --e20-system-color-inset is the wash behind a field set into that colour - the Essence chips'
  // number boxes (actors/_essence.scss). The stylesheet's dark wash suits a dark fill; on a light
  // one it turned the box mid-grey behind grey digits, so a light fill gets a light wash to carry
  // the dark text instead.
  if (fillTone === "light") {
    element.style.setProperty('--e20-system-color-contrast', '#1a1a1a');
    element.style.setProperty('--e20-system-color-halo', 'transparent');
    element.style.setProperty('--e20-system-color-inset', 'rgba(255, 255, 255, 0.55)');
  } else if (fillTone === "dark") {
    element.style.setProperty('--e20-system-color-contrast', '#f2f2f2');
    element.style.removeProperty?.('--e20-system-color-halo');
    element.style.removeProperty?.('--e20-system-color-inset');
  } else {
    element.style.removeProperty?.('--e20-system-color-contrast');
    element.style.removeProperty?.('--e20-system-color-halo');
    element.style.removeProperty?.('--e20-system-color-inset');
  }
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
