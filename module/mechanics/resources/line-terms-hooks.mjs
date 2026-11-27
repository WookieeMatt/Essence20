import { RULES_LINE_FLAG, customLine, lineFamily } from "./custom-game-lines.mjs";
import { LINE_CODES, actorLineOf } from "./game-lines.mjs";
import { replaceInMessage, rewriteTranslations, termPairs, termReplacer } from "./line-terms.mjs";

/**
 * Words per line, put to work (mechanics/resources/line-terms.mjs):
 *  - World-wide: at i18nInit (after settings.js has read the homebrew lines), the world line's words go into the system's
 *    own strings, so every window, tooltip and chat line reads "Lion" for "Zord". Changing them needs a reload.
 *  - On sheets and chat cards: names in the data (items, compendium content) are swapped too, after each render. In an
 *    every-line (Crossover) world - or with the older Crossover setting on - each actor reads in its own line's words
 *    instead of the world's (a G.I. Joe in a Voltron world still sees "Zord") - its Role's line, or for a Zord, Vehicle
 *    or Megaform its pilot's (termsLineOf).
 * Inputs, text boxes and editors are left alone: what is typed is stored as typed.
 */

/** The world setting: each actor in its own line's words (settings.js). */
export const CROSSOVER_TERMS_SETTING = 'crossoverTerms';

const worldLineId = () => game.settings?.get('essence20', 'gameLine') ?? '';
const worldTerms = () => customLine(worldLineId())?.terms ?? {};

/** Each actor in its own line's words: always in an every-line (Crossover) world, else by the older setting. */
function crossoverOn() {
  if (!worldLineId()) {
    return true;
  }

  try {
    return !!game.settings.get('essence20', CROSSOVER_TERMS_SETTING);
  } catch {
    return false;
  }
}

/**
 * The 'element' damage type is one type with two book names: Power Rangers, My Little Pony and Transformers call it
 * Energy ("1 Energy damage"); G.I. Joe calls it Element. The system's own label says both ("Element/Energy"); a line
 * with a word of its own reads in that word instead. A homebrew line reads as its family does. By family; '' for none.
 */
export const ELEMENT_DAMAGE_WORDS = Object.freeze({ powerRangers: 'energy', myLittlePony: 'energy', transformers: 'energy', giJoe: 'element' });

/** A line's family, from a key (giJoe), a short code (gij) or a homebrew id. */
function familyOf(line) {
  const text = String(line ?? '').trim();
  return lineFamily(text) || Object.keys(LINE_CODES).find(key => LINE_CODES[key] == text) || '';
}

const translationsE20 = () => game.i18n?.translations?.E20 ?? {};

/**
 * The 'element' damage type's name in a line's own book (ELEMENT_DAMAGE_WORDS); null for a line with no word of its
 * own (Night Vale, every line).
 * @param {String} line   A line key, short code or homebrew id.
 * @returns {String|null}
 */
export function elementDamageWord(line) {
  const word = ELEMENT_DAMAGE_WORDS[familyOf(line)];
  return word ? translationsE20().DamageElementWord?.[word] ?? null : null;
}

/** Whether a line's own Words already rename the damage label (the GM's own word wins). */
function termsRename(terms, label) {
  return Object.keys(terms ?? {}).some(word => word.toLowerCase() == String(label).toLowerCase());
}

/**
 * The labels that say both names: the damage type, and the weapon trait and weapon style that go with it (G.I. Joe's
 * Element trait and "element" classification; Power Rangers' and Transformers' "Traits: Energy").
 */
export const ELEMENT_LABEL_KEYS = Object.freeze(['DamageElement', 'WeaponTraitEnergy', 'WeaponStyleEnergy']);

/** The both-names texts those labels hold (normally just "Element/Energy"). */
const bothNameLabels = () => [...new Set(ELEMENT_LABEL_KEYS.map(key => translationsE20()[key]).filter(Boolean))];

/**
 * The world line's name for the 'element' damage type (and its trait and style) into the labels themselves - and into
 * CONFIG.E20's lists, which Foundry localized before i18nInit. Not under Crossover: there each actor's sheet and chat
 * cards swap it for its own line's (replacerFor).
 * @returns {Number}   How many labels changed.
 */
export function applyElementDamageWord() {
  const strings = translationsE20();
  const word = elementDamageWord(worldLineId());
  if (!word || crossoverOn()) {
    return 0;
  }

  const labels = bothNameLabels().filter(label => label != word && !termsRename(worldTerms(), label));
  let changed = 0;
  for (const key of ELEMENT_LABEL_KEYS) {
    if (labels.includes(strings[key])) {
      strings[key] = word;
      changed++;
    }
  }

  for (const list of Object.values(globalThis.CONFIG?.E20 ?? {})) {
    if (list && typeof list == 'object' && !Array.isArray(list)) {
      for (const [key, value] of Object.entries(list)) {
        if (labels.includes(value)) {
          list[key] = word;
        }
      }
    }
  }

  return changed;
}

/** The world line's words into the system's strings (TYPES and E20). Run once, at i18nInit. */
export function applyWorldTerms() {
  const changed = applyElementDamageWord();
  const replace = termReplacer(termPairs({}, worldTerms()));
  if (!replace) {
    return changed;
  }

  const translations = game.i18n?.translations ?? {};
  return changed + ['TYPES', 'E20'].reduce((sum, key) => sum + rewriteTranslations(translations[key], replace), 0);
}

const hasRole = actor => (actor?.items?.contents ?? [...(actor?.items ?? [])]).some(item => item?.type == 'role');

/**
 * Whose words an actor reads in under Crossover: the line the GM picked for it, or its Role's line; with neither (a Zord, a Vehicle, a Megaform), the line
 * of the first one aboard that has one (its pilot, or a member's pilot); else the world's.
 * @param {Actor} actor
 * @param {Number} [depth]
 * @returns {String}   A line id or code.
 */
export function termsLineOf(actor, depth = 0) {
  if (hasRole(actor) || actor?.flags?.essence20?.[RULES_LINE_FLAG]) {
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
  const crossover = actor && crossoverOn();
  const own = crossover ? customLine(termsLineOf(actor))?.terms ?? {} : world;
  const pairs = termPairs(world, own);
  // Under Crossover the damage label (and its trait and style) still say both names: each actor's things read in its own line's.
  const word = crossover ? elementDamageWord(termsLineOf(actor)) : null;
  for (const label of word ? bothNameLabels() : []) {
    if (label != word && !termsRename(own, label)) {
      pairs.push({ from: label, to: word });
    }
  }

  return termReplacer(pairs);
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
