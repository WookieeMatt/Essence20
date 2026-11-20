import { applyThemeClass } from "../../settings.js";
import { termsLineOf } from "./line-terms-hooks.mjs";

/**
 * A line's look (mechanics/resources/line-look.mjs) on what belongs to a character: its sheet, its items' sheets and its
 * chat cards are stamped with its line (data-e20-line - its Role's, or for a Zord, Vehicle or Megaform its pilot's), and
 * settings.js#applyThemeClass reads it. A character whose line has no look of its own gets the world line's.
 */

/**
 * Stamp a rendered element with an actor's line and re-theme it.
 * @param {HTMLElement} element
 * @param {Actor|null} actor
 */
export function stampLine(element, actor) {
  if (!element?.dataset) {
    return;
  }

  const line = actor ? termsLineOf(actor) : '';
  if (line) {
    element.dataset.e20Line = line;
  } else {
    delete element.dataset.e20Line;
  }

  applyThemeClass(element);
}

if (typeof Hooks != 'undefined') {
  Hooks.on('renderActorSheetV2', sheet => stampLine(sheet.element, sheet.document));
  Hooks.on('renderItemSheetV2', sheet => stampLine(sheet.element, sheet.document?.actor ?? null));
  Hooks.on('renderChatMessageHTML', (message, html) => stampLine(html, message.speakerActor ?? null));
}
