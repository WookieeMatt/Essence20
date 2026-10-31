import { customLine } from "./custom-game-lines.mjs";
import { actorLineOf } from "./game-lines.mjs";
import { replaceInMessage, rewriteTranslations, termPairs, termReplacer } from "./line-terms.mjs";

/**
 * Words per line, put to work (mechanics/resources/line-terms.mjs):
 *  - World-wide: at i18nInit (after settings.js has read the homebrew lines), the world line's words go into the system's
 *    own strings, so every window, tooltip and chat line reads "Lion" for "Zord". Changing them needs a reload.
 *  - On sheets and chat cards: names in the data (items, compendium content) are swapped too, after each render. With
 *    the Crossover setting on, each actor reads in its own line's words instead of the world's (a G.I. Joe in a Voltron
 *    world still sees "Zord") - its Role's line, or for a Zord, Vehicle or Megaform its pilot's (termsLineOf).
 * Inputs, text boxes and editors are left alone: what is typed is stored as typed.
 */

/** The world setting: each actor in its own line's words (settings.js). */
export const CROSSOVER_TERMS_SETTING = 'crossoverTerms';

const worldLineId = () => game.settings?.get('essence20', 'gameLine') ?? '';
const worldTerms = () => customLine(worldLineId())?.terms ?? {};

function crossoverOn() {
  try {
    return !!game.settings.get('essence20', CROSSOVER_TERMS_SETTING);
  } catch {
    return false;
  }
}

/** The world line's words into the system's strings (TYPES and E20). Run once, at i18nInit. */
export function applyWorldTerms() {
  const replace = termReplacer(termPairs({}, worldTerms()));
  if (!replace) {
    return 0;
  }

  const translations = game.i18n?.translations ?? {};
  return ['TYPES', 'E20'].reduce((sum, key) => sum + rewriteTranslations(translations[key], replace), 0);
}

const hasRole = actor => (actor?.items?.contents ?? [...(actor?.items ?? [])]).some(item => item?.type == 'role');

/**
 * Whose words an actor reads in under Crossover: its Role's line; with no Role (a Zord, a Vehicle, a Megaform), the line
 * of the first one aboard that has one (its pilot, or a member's pilot); else the world's.
 * @param {Actor} actor
 * @param {Number} [depth]
 * @returns {String}   A line id or code.
 */
export function termsLineOf(actor, depth = 0) {
  if (hasRole(actor)) {
    return actorLineOf(actor, worldLineId());
  }

  if (depth < 2) {
    for (const entry of Object.values(actor?.system?.actors ?? {})) {
      const aboard = entry?.uuid ? globalThis.fromUuidSync?.(entry.uuid) : null;
      const line = aboard && aboard != actor ? termsLineOf(aboard, depth + 1) : '';
      if (line) {
        return line;
      }
    }
  }

  return depth ? '' : worldLineId();
}

/**
 * The swap for something belonging to this actor (or to the world, with none).
 * @param {Actor|null} actor
 * @returns {Function|null}
 */
export function replacerFor(actor) {
  const world = worldTerms();
  const own = actor && crossoverOn() ? customLine(termsLineOf(actor))?.terms ?? {} : world;
  return termReplacer(termPairs(world, own));
}

const SKIP = 'input, textarea, select, script, style, code, prose-mirror, [contenteditable="true"], .editor-content';
const ATTRIBUTES = ['data-tooltip', 'title', 'placeholder', 'aria-label'];
// Text already swapped: a part re-rendered is new text, the rest must not be swapped twice (A -> B, then B -> C).
const done = new WeakSet();

/**
 * The words swapped in a rendered element's text and tooltips.
 * @param {HTMLElement} element
 * @param {Function|null} replace
 */
export function applyTermsToElement(element, replace) {
  if (!replace || !element) {
    return;
  }

  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (done.has(node) || !node.nodeValue.trim() || node.parentElement?.closest(SKIP)) {
      continue;
    }

    const next = replace(node.nodeValue);
    if (next != node.nodeValue) {
      node.nodeValue = next;
    }

    done.add(node);
  }

  for (const attribute of ATTRIBUTES) {
    for (const el of element.querySelectorAll(`[${attribute}]`)) {
      if (el.dataset.e20Terms?.includes(attribute)) {
        continue;
      }

      // A tooltip may hold HTML: its tags are left alone.
      el.setAttribute(attribute, replaceInMessage(el.getAttribute(attribute), replace));
      el.dataset.e20Terms = `${el.dataset.e20Terms ?? ''} ${attribute}`;
    }
  }
}

if (typeof Hooks != 'undefined') {
  Hooks.on('renderActorSheetV2', sheet => applyTermsToElement(sheet.element, replacerFor(sheet.document)));
  Hooks.on('renderItemSheetV2', sheet => applyTermsToElement(sheet.element, replacerFor(sheet.document?.actor ?? null)));
  Hooks.on('renderChatMessageHTML', (message, html) => applyTermsToElement(html, replacerFor(message.speakerActor ?? null)));
}
