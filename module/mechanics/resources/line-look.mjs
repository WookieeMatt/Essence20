/**
 * A line's look (Configure Settings > Game Lines, each line's Look): its own frame theme, accent colour, logo and sheet
 * header art, kept on the line (custom-game-lines.mjs, `look`). Every part is optional; a blank one leaves the system's.
 *
 * settings.js#applyThemeClass puts it on every Essence20 window it themes: the line an element is stamped with
 * (data-e20-line - an actor's sheet, its items, its chat cards: mechanics/resources/line-look-hooks.mjs), else the
 * world's line.
 *
 *  - frame:     'default' (Sci-fi) or 'pony'; '' leaves each player's own Sheet Theme.
 *  - accent:    a #rrggbb colour for --e20-theme-accent (highlights, labels).
 *  - logo:      an image shown in the window's title bar.
 *  - headerArt: an image behind an actor sheet's header.
 *
 * DOM-only, no Foundry imports (jest loads it with jsdom).
 */

/** The frame themes a line can pick (FRAME_THEME_CLASSES in settings.js, without the theme- prefix). */
export const LOOK_FRAMES = Object.freeze(['default', 'pony']);

const COLOUR = /^#[0-9a-f]{6}$/i;
const path = value => String(value ?? '').trim();

/**
 * A line's look, tidied: every part a string, '' when unset or not usable.
 * @param {Object} raw
 * @returns {{frame: String, accent: String, logo: String, headerArt: String}}
 */
export function normalizeLook(raw) {
  const look = raw && typeof raw == 'object' ? raw : {};
  const accent = String(look.accent ?? '').trim();
  return {
    frame: LOOK_FRAMES.includes(look.frame) ? look.frame : '',
    accent: COLOUR.test(accent) ? accent.toLowerCase() : '',
    logo: path(look.logo),
    headerArt: path(look.headerArt),
  };
}

/** Whether a look sets anything. */
export const hasLook = look => !!(look && (look.frame || look.accent || look.logo || look.headerArt));

// A path inside url("..."): its quotes and backslashes can't end the string early. Made absolute against the page first -
// a relative url() in a custom property resolves against the stylesheet that reads it (css/), not the Data folder.
const cssUrl = (src, base) => `url("${new URL(src, base).href.replace(/["\\\n]/g, encodeURIComponent)}")`;

/**
 * Put a look's accent, header art and logo on a rendered window (or chat card), or take a previous one's off. The frame
 * is applyThemeClass's own.
 * @param {HTMLElement} element
 * @param {Object|null} look   normalizeLook's.
 */
export function applyLook(element, look) {
  if (!element?.style) {
    return;
  }

  if (look?.accent) {
    element.style.setProperty('--e20-theme-accent', look.accent);
  } else {
    element.style.removeProperty('--e20-theme-accent');
  }

  const art = look?.headerArt && element.querySelector('.sheet-header');
  element.classList.toggle('e20-line-art', !!art);
  if (art) {
    element.style.setProperty('--e20-line-header-art', cssUrl(look.headerArt, element.ownerDocument.baseURI));
  } else {
    element.style.removeProperty('--e20-line-header-art');
  }

  // The title bar isn't re-rendered with the window's parts: one logo, kept up to date.
  const title = element.querySelector(':scope > .window-header .window-title');
  let logo = element.querySelector(':scope > .window-header .e20-line-logo');
  if (!look?.logo || !title) {
    logo?.remove();
    return;
  }

  if (!logo) {
    logo = element.ownerDocument.createElement('img');
    logo.className = 'e20-line-logo';
    logo.alt = '';
    title.before(logo);
  }

  if (logo.getAttribute('src') != look.logo) {
    logo.setAttribute('src', look.logo);
  }
}
