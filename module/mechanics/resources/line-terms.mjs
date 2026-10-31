/**
 * Words per line (Configure Settings > Game Lines, each line's Words): a homebrew line's own names for the book's words -
 * Zord -> Lion, Megazord -> Voltron, Role Point -> Mask Charge. Kept on the line (custom-game-lines.mjs, `terms`).
 *
 * World-wide, the world's line rewrites the system's text (mechanics/resources/line-terms-hooks.mjs, at i18nInit). With
 * the Crossover setting on, each actor's sheet and chat cards read in its own line's words instead - a G.I. Joe in a
 * Voltron world still sees "Zord".
 *
 * Whole words only, matched in any case ("zord", "Zord", "ZORD") with an -s/-es/-ed/-ing ending carried over, never inside
 * a {placeholder} or an <html tag>.
 *
 * Import-free (jest loads it without Foundry).
 */

/** The book words the editor offers a box for; any other word can be added too. */
export const SUGGESTED_TERMS = Object.freeze([
  'Zord', 'Megazord', 'Megaform', 'Combiner', 'Morph', 'Ranger', 'Grid Power', 'Spectrum', 'Energon', 'Alt Mode',
  'Bot Mode', 'Transform', 'Cybertronian', 'Role Point', 'Personal Power', 'Story Point', 'Party',
]);

const ENDINGS = 's|es|ed|ing';

/**
 * A line's words, tidied: {book word: its own word}, both trimmed, neither empty, never a word mapped to itself.
 * @param {Object} raw
 * @returns {Object<String, String>}
 */
export function normalizeTerms(raw) {
  const out = {};
  for (const [from, to] of Object.entries(raw && typeof raw == 'object' ? raw : {})) {
    const word = String(from ?? '').trim();
    const own = String(to ?? '').trim();
    if (word && own && word != own) {
      out[word] = own;
    }
  }

  return out;
}

/**
 * "Book word = Your word", one to a line (the editor's Other words box), into terms.
 * @param {String} text
 * @returns {Object<String, String>}
 */
export function parseTermLines(text) {
  const out = {};
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const [from, ...rest] = line.split('=');
    if (rest.length) {
      out[from.trim()] = rest.join('=').trim();
    }
  }

  return normalizeTerms(out);
}

/**
 * What to swap on something of one line, when the text in front of it already reads in the world's words (the system's
 * strings) or the book's (names in the data): each of those becomes the line's own word, or the book's if it has none.
 * @param {Object} worldTerms   The world line's words ({} for a book line).
 * @param {Object} ownTerms     The line it belongs to (the same as worldTerms unless it's a crossover).
 * @returns {Array<{from: String, to: String}>}
 */
export function termPairs(worldTerms = {}, ownTerms = {}) {
  const pairs = [];
  const seen = new Set();
  for (const word of new Set([...Object.keys(worldTerms ?? {}), ...Object.keys(ownTerms ?? {})])) {
    const target = ownTerms?.[word] || word;
    for (const from of [word, worldTerms?.[word]]) {
      const key = String(from ?? '').toLowerCase();
      if (from && from != target && !seen.has(key)) {
        seen.add(key);
        pairs.push({ from, to: target });
      }
    }
  }

  return pairs;
}

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The new word in the case the old one was written in. */
function inCase(found, word) {
  if (found.length > 1 && found == found.toUpperCase() && found != found.toLowerCase()) {
    return word.toUpperCase();
  }

  return found == found.toLowerCase() && found != found.toUpperCase() ? word.toLowerCase() : word;
}

/**
 * A function that swaps the pairs' words in a piece of plain text, or null when there's nothing to swap.
 * @param {Array<{from: String, to: String}>} pairs
 * @returns {((text: String) => String)|null}
 */
export function termReplacer(pairs) {
  const list = (pairs ?? []).filter(pair => pair?.from && pair?.to);
  if (!list.length) {
    return null;
  }

  const byWord = new Map(list.map(pair => [pair.from.toLowerCase(), pair.to]));
  const words = [...byWord.keys()].sort((a, b) => b.length - a.length).map(escape);
  const pattern = new RegExp(`(?<!\\w)(${words.join('|')})(${ENDINGS})?(?!\\w)`, 'gi');
  return text => String(text ?? '').replace(pattern, (whole, found, ending = '') => {
    const to = byWord.get(found.toLowerCase());
    return to ? inCase(found, to) + ending : whole;
  });
}

/**
 * A string from the language file with its words swapped - not inside a {placeholder} or an <html tag>.
 * @param {String} text
 * @param {Function} replace   termReplacer's.
 * @returns {String}
 */
export function replaceInMessage(text, replace) {
  return String(text).split(/(\{[^}]*\}|<[^>]*>)/).map((part, index) => (index % 2 ? part : replace(part))).join('');
}

/**
 * Every string in a translations tree, swapped in place.
 * @param {Object} tree
 * @param {Function} replace
 * @returns {Number}   How many strings changed.
 */
export function rewriteTranslations(tree, replace) {
  let changed = 0;
  for (const [key, value] of Object.entries(tree ?? {})) {
    if (typeof value == 'string') {
      const next = replaceInMessage(value, replace);
      if (next != value) {
        tree[key] = next;
        changed++;
      }
    } else if (value && typeof value == 'object') {
      changed += rewriteTranslations(value, replace);
    }
  }

  return changed;
}
