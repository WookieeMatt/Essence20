/**
 * Pulling item descriptions out of a GM's own copy of a rulebook PDF.
 *
 * This module is deliberately free of any PDF or Foundry API: it takes plain arrays of text
 * runs - `{ s, x, y, size }`, exactly the shape pdf.js's getTextContent() yields once flattened
 * - and returns strings. The PDF reading, the file picking and the writing all live in
 * apps/book-description-importer.mjs, so everything with real judgement in it stays testable.
 *
 * Why any of this exists: the compendium ships with 5,065 of its 5,136 items carrying an empty
 * description, because this system does not redistribute Renegade's text. A GM who owns the book
 * already has that text; this lets them fill their OWN world from their OWN file. Nothing
 * extracted here is ever written back into packs/ - see the importer for where it does go.
 */

/**
 * The item types worth reading out of a book.
 *
 * These are the ones written up as prose entries. Weapons, armor, gear, shields, upgrades,
 * weaponEffects and equipmentPackages are deliberately absent: they appear in the books as stat
 * table rows, not descriptive entries, and most of the compendium's copies of them are generated
 * permutations ("Ballistic Armor (Radar Tempered Camo)") that no page describes at all. Measured
 * against the GI Joe CRB, those types matched a heading 0% of the time while the types below
 * averaged about 85%.
 */
export const NARRATIVE_TYPES = [
  'alteration', 'altMode', 'faction', 'feature', 'focus', 'hangUp', 'influence', 'magicBauble',
  'megaformTrait', 'origin', 'perk', 'power', 'role', 'rolePoints', 'spell',
];

/**
 * Renegade's purchase stamp, which sits on every page of a watermarked PDF.
 *
 * Both spellings are matched on purpose: the earlier print runs shipped it as "Downloded ...
 * Unathorized" (GI Joe CRB, 2022) and later ones corrected it to "Downloaded ... Unauthorized"
 * (Power Rangers CRB 2nd printing, 2025).
 */
const WATERMARK_RE = /Downlo(?:a)?ded by (.+?) on (\d{1,2}\/\d{1,2}\/\d{4})/i;

/**
 * `system.source.book` is free text that was typed in by hand, so the same book is spelled a few
 * different ways. Keys are normalized (lowercased, whitespace-collapsed) misspellings; values are
 * the spelling the rest of the system uses.
 *
 * "Core Book" is deliberately absent: 32 items use it and it does not say WHICH line's core book,
 * so there is nothing to map it to. Those items are reported as unmatched rather than guessed at.
 */
export const BOOK_ALIASES = {
  'gi joe core rulebook': 'GI Joe Core Rulebook',
  'transfomers core rulebook': 'Transformers Core Rulebook',
  'transformers core ruelbook': 'Transformers Core Rulebook',
  'my little pony core rulebook': 'My Little Pony Core Rulebook',
  "finster's monster-magic cookbook": "Finster's Monster-Matic Cookbook",
};

/**
 * Collapse a book title to the spelling the compendium uses.
 * @param {string} title   A raw `system.source.book` value.
 * @returns {string} The canonical title, or the input trimmed if it is already canonical.
 */
export function normalizeBookTitle(title) {
  const trimmed = (title ?? '').replace(/\s+/g, ' ').trim();
  return BOOK_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

/**
 * Compare two pieces of text as names, ignoring whitespace entirely.
 *
 * Whitespace is dropped rather than collapsed because the headings in these PDFs are kerned per
 * glyph pair, and pdf.js reports the result verbatim - the Commando's Sneak Attack heading comes
 * out as "SNEAK AT TACK". Case, punctuation and curly apostrophes go the same way, so
 * "You're an Expert" matches "YOU'RE AN EXPERT".
 * @param {string} text
 * @returns {string} A comparison key.
 */
export function nameKey(text) {
  return (text ?? '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Find the purchase watermark, if the PDF carries one.
 *
 * Not every book has one - the My Little Pony Core Rulebook and Field Guide to Action and
 * Adventure both extract no watermark at all - which is exactly why this is attestation and not
 * a gate. A book without one still imports; the importer simply records that it was unattested.
 * @param {Array<Array<Object>>} pages   Text runs per page.
 * @returns {?{purchaser: string, date: string, raw: string, page: number}}
 */
export function findWatermark(pages) {
  for (let i = 0; i < pages.length; i++) {
    for (const run of pages[i]) {
      const match = WATERMARK_RE.exec(run.s ?? '');
      if (match) {
        return { purchaser: match[1].trim(), date: match[2], raw: match[0], page: i + 1 };
      }
    }
  }

  return null;
}

/**
 * The font size of body text: simply the most common size in the book.
 * @param {Array<Array<Object>>} pages
 * @returns {number}
 */
export function findBodyFontSize(pages) {
  const tally = new Map();
  for (const runs of pages) {
    for (const run of runs) {
      tally.set(run.size, (tally.get(run.size) ?? 0) + 1);
    }
  }

  let best = 0;
  let bestCount = -1;
  for (const [size, count] of tally) {
    if (count > bestCount) {
      best = size;
      bestCount = count;
    }
  }

  return best;
}

/**
 * The lowest y any real body text reaches, which is what separates the page's content from its
 * furniture.
 *
 * Size cannot do that job here, which is the counter-intuitive part: the running header, folio
 * and watermark are all set LARGER than body text (15, 18 and 15 against a 10.5 body in the GI
 * Joe CRB), so a "bigger than body text means heading" rule reads all three as headings. They are
 * separable by position instead - they sit below everything else on the page.
 * @param {Array<Array<Object>>} pages
 * @param {number} bodySize
 * @returns {number} The y below which a run is furniture.
 */
export function findTextFloor(pages, bodySize) {
  let floor = Infinity;
  for (const runs of pages) {
    for (const run of runs) {
      if (run.size === bodySize && run.y < floor) {
        floor = run.y;
      }
    }
  }

  return floor === Infinity ? 0 : floor - 1;
}

/**
 * Work out how far the PDF's page numbering runs ahead of the book's printed numbering.
 *
 * `system.source.page` records the PRINTED folio, but a PDF's first page is its cover, so the two
 * are offset by however much front matter the book has. Rather than keep a table of that per
 * book, read it off the pages themselves: a bare integer sitting in the footer furniture is the
 * folio, and its distance from the PDF index is the offset. It is strikingly consistent in
 * practice - 77 of 77 readings agreed for the GI Joe CRB, 146 of 147 for My Little Pony.
 * @param {Array<Array<Object>>} pages
 * @param {number} textFloor   From findTextFloor().
 * @returns {{offset: number, agreement: number, samples: number}}
 */
export function calibrateFolioOffset(pages, textFloor) {
  const tally = new Map();
  let samples = 0;

  for (let i = 0; i < pages.length; i++) {
    for (const run of pages[i]) {
      if (run.y >= textFloor) continue;              // content, not footer furniture
      if (!/^\d{1,3}$/.test(run.s ?? '')) continue;  // the folio is a bare number
      const offset = (i + 1) - Number(run.s);
      tally.set(offset, (tally.get(offset) ?? 0) + 1);
      samples++;
    }
  }

  let offset = 0;
  let agreement = 0;
  for (const [value, count] of tally) {
    if (count > agreement) {
      offset = value;
      agreement = count;
    }
  }

  return { offset, agreement, samples };
}

/**
 * Put one page's runs into reading order, dropping the page furniture.
 *
 * These books are two-column, and pdf.js emits runs in the PDF's own drawing order, which is not
 * reading order. Splitting on the page's midpoint and reading each column top-down recovers it.
 * A page that is genuinely single-column (a full-width table or a splash page) leaves one side
 * nearly empty, which costs nothing - the empty column contributes no runs.
 * @param {Array<Object>} runs
 * @param {number} pageWidth
 * @param {number} textFloor
 * @returns {Array<Object>} Runs in reading order.
 */
export function buildReadingOrder(runs, pageWidth, textFloor) {
  const content = runs.filter(run => run.y >= textFloor && !WATERMARK_RE.test(run.s ?? ''));
  const middle = pageWidth / 2;
  const byColumn = [[], []];
  for (const run of content) {
    byColumn[run.x < middle ? 0 : 1].push(run);
  }

  for (const column of byColumn) {
    column.sort((a, b) => b.y - a.y);   // PDF y grows upward, so descending is top-down
  }

  return [...byColumn[0], ...byColumn[1]];
}

/**
 * The keys an item could reasonably be printed under.
 *
 * The compendium sometimes qualifies a name that the book does not: "Adapted Vehicle
 * (Environmental)" is printed simply as "Adapted Vehicle", the parenthetical being this
 * system's own note about which variant it is. The bare name is offered as a fallback, never
 * in place of the full one.
 * @param {string} name
 * @returns {Array<string>} Comparison keys, most specific first.
 */
export function itemKeys(name) {
  const keys = [nameKey(name)];
  const bare = (name ?? "").replace(/\s*\([^)]*\)\s*$/, "");
  if (bare && nameKey(bare) !== keys[0]) {
    keys.push(nameKey(bare));
  }

  return keys;
}

/**
 * Keys to fall back on when nothing matched, allowing for the book and the compendium
 * disagreeing about a plural - the GI Joe CRB heads its entry "Adapted Vehicles
 * (Environmental):" while the item is named "Adapted Vehicle (Environmental)".
 *
 * Kept apart from itemKeys(), and tried only after a strict pass has found nothing anywhere on
 * the page, because a plural is not always a spelling difference - it can be a different item.
 * The packs hold 11 singular/plural name pairs, and Grid Surge (a Perk) and Grid Surges (its
 * RolePoints) are both on page 57 of the same book. Strict-first means an item with a heading
 * of its own always takes that one, and only an item with no heading at all reaches for its
 * neighbour's.
 * @param {string} name
 * @returns {Array<string>} Keys not already covered by itemKeys(), possibly empty.
 */
export function pluralKeys(name) {
  const raw = name ?? '';

  // A trailing qualifier is kept where it is: the plural belongs on the name itself, so
  // "Adapted Vehicle (Environmental)" has to become "Adapted Vehicles (Environmental)" rather
  // than "Adapted Vehicle (Environmental)s".
  const trailing = raw.match(/\s*\([^)]*\)\s*$/)?.[0] ?? '';
  const bare = trailing ? raw.slice(0, raw.length - trailing.length) : raw;
  if (!bare) return [];

  const variants = new Set([
    nameKey(`${bare}s${trailing}`),
    nameKey(`${bare}s`),
  ]);

  // And the other way round, for a compendium name that is plural where the book is not.
  if (bare.endsWith('s')) {
    variants.add(nameKey(`${bare.slice(0, -1)}${trailing}`));
  }

  const strict = new Set(itemKeys(name));
  return [...variants].filter(key => key && !strict.has(key));
}

/**
 * The keys a heading could be naming, once the book's own decoration is taken off.
 *
 * These books wrap a name in boilerplate that says what kind of thing it is, and do it on both
 * sides: the Covert Ops origin is headed "COVERT OPS ORIGIN", while the perk it grants is headed
 * "ORIGIN BENEFIT: ALWAYS IN CONTACT". Neither matches the item name on its own, which is why
 * every origin in the GI Joe CRB went unmatched before this.
 *
 * The trailing form is only stripped when the trailing word is the item's OWN type, so this
 * cannot quietly turn "Sneak Attack" into "Sneak".
 * @param {string} text   The run's text.
 * @param {string} type   The item type being looked for.
 * @returns {Set<string>}
 */
export function headingKeys(text, type) {
  const raw = (text ?? "").trimEnd().replace(/:$/, "");
  const keys = new Set([nameKey(raw)]);

  const afterColon = raw.split(":").slice(1).join(":");
  if (afterColon.trim()) {
    keys.add(nameKey(afterColon));
  }

  const typeWord = nameKey(type ?? "");
  const full = nameKey(raw);
  if (typeWord && full.length > typeWord.length && full.endsWith(typeWord)) {
    keys.add(full.slice(0, -typeWord.length));
  }

  return keys;
}

/**
 * Whether a run reads like a run-in label rather than a line of prose.
 *
 * The colon is the signal, but it does not have to end the line: the GI Joe CRB writes
 * "Lookout: (environmental)", putting the qualifier after it. What has to hold is that the part
 * BEFORE the colon reads like a name - short, and not the tail of a sentence - which is what
 * keeps an ordinary paragraph containing a colon from being taken for the start of a new entry.
 *
 * Used at both ends deliberately. Recognising a label one way and not the other is what let
 * "Lookout:" start an entry that then ran straight through "Tracker:" and everything after it.
 * @param {string} text
 * @returns {boolean}
 */
function looksLikeLabel(text) {
  const at = (text ?? '').indexOf(':');
  if (at <= 0) return false;

  const before = text.slice(0, at);
  return before.length <= 40 && !/[.!?]/.test(before);
}

/**
 * Whether a run begins an entry called `key`, and how.
 *
 * Two shapes appear in these books and both have to be recognised:
 *   - a display heading, set much larger than body text ("SNEAK ATTACK");
 *   - a run-in label at body size ending in a colon ("Environment Choice:"), which is how the
 *     options inside a list are written. Roughly a sixth of the GI Joe CRB's perks are these,
 *     and a heading-only matcher misses every one of them.
 * @param {Object} run
 * @param {Array<string>} keys   From itemKeys().
 * @param {number} bodySize
 * @param {string} type   The item type, for undecorating the heading.
 * @returns {?('heading'|'label')}
 */
function entryStart(run, keys, bodySize, type) {
  const text = run.s ?? '';
  const matches = (candidates) => keys.some(key => candidates.has(key));

  if (run.size > bodySize && matches(headingKeys(text, type))) {
    return 'heading';
  }

  // A run-in label must carry a colon somewhere. Without that requirement the name would also
  // match any sentence in the prose that happens to open with it, and the entry would start in
  // the wrong place.
  //
  // Anywhere, not at the end: the GI Joe CRB writes two of its Ranger abilities as
  // "Lookout: (environmental)" and "Tracker: (environmental)", putting the colon before the
  // qualifier rather than after it. Requiring it last left both without a description. The
  // guard is still tight, because the WHOLE run has to be the name - nameKey drops the colon
  // and the brackets either way, so a prose line merely mentioning the name does not match.
  //
  // Only the undecorated name counts here - a label sits inside the section that already names
  // its kind, so it never carries the "ORIGIN BENEFIT:" style prefix a display heading does.
  if (run.size <= bodySize && looksLikeLabel(text) && keys.includes(nameKey(text))) {
    return 'label';
  }

  return null;
}

/**
 * Whether a run ends the entry that `start` began.
 * @param {Object} run
 * @param {Object} start   The run entryStart() matched.
 * @param {'heading'|'label'} kind
 * @param {number} bodySize
 * @param {number} labelMargin   The x of the column's left edge, for spotting the next label.
 * @returns {boolean}
 */
function entryEnd(run, start, kind, bodySize, labelMargin) {
  // Any heading of the same weight or heavier closes what came before it.
  if (run.size >= start.size && run.size > bodySize) {
    return true;
  }

  // A run-in entry also ends at the NEXT run-in label, which is recognisable by starting at the
  // column margin and carrying a colon. Requiring the margin is what keeps a mid-sentence colon
  // ("DIF 10 Alertness Skill Test:") from cutting the entry short.
  if (kind === 'label' && run.size <= bodySize) {
    if (looksLikeLabel(run.s) && Math.abs(run.x - labelMargin) <= 3) {
      return true;
    }
  }

  return false;
}

/**
 * Glyphs the books draw from a symbol font rather than a text one.
 *
 * A symbol font carries no Unicode mapping, so pdf.js has nothing to report but the raw
 * private-use codepoint - which renders as a blank box on a sheet. The dice shift arrows are
 * the ones that matter: they appear 68 times in the GI Joe Core Rulebook alone, and an
 * upshift is most of what a Perk's text is actually saying.
 *
 * Each mapping was read off the books rather than assumed from a font table, and the same four
 * codepoints appear across the GI Joe, Power Rangers and My Little Pony core rulebooks:
 *
 *   F0E1  "gain a [F0E1] 1 dice shift"                      -> up
 *   F0E2  "they suffer [F0E2] 1 on all attacks"             -> down
 *   F0E0  "d2 [F0E0] d4 [F0E0] d6 [F0E0] d8"                -> right
 *   F06E  "[F06E] = These are steps on the dice shift scale" -> a legend bullet
 *
 * The arrows deliberately land on the same characters the rest of this system already uses for
 * a shift (see lang/en.json), so imported text reads the same as text written by hand.
 *
 * Anything else in the private-use range is left exactly as it is: it would be a glyph nobody
 * has identified yet, and dropping it silently would quietly change what a rule says. It shows
 * up in the importer's preview, where a GM can see it and decide.
 */
const SYMBOL_GLYPHS = {
  '\uF0E0': '\u2192',
  '\uF0E1': '\u2191',
  '\uF0E2': '\u2193',
  '\uF06E': '\u25A0',
};

/**
 * Replace the symbol-font glyphs a run carries with their real characters.
 * @param {string} text
 * @returns {string}
 */
export function mapSymbolGlyphs(text) {
  return (text ?? '').replace(/[\uE000-\uF8FF]/g, ch => SYMBOL_GLYPHS[ch] ?? ch);
}

/**
 * Join runs into a paragraph.
 *
 * pdf.js emits one run per styled span, so a single sentence arrives in pieces and line-broken
 * words arrive hyphenated ("addi-" / "tional"). Both are put back together here.
 * @param {Array<Object>} runs
 * @returns {string}
 */
function joinRuns(runs) {
  let text = '';
  for (const run of runs) {
    const piece = mapSymbolGlyphs(run.s ?? '').trim();
    if (!piece) continue;

    if (text.endsWith('-')) {
      text = text.slice(0, -1) + piece;   // rejoin a word split across lines
    } else if (!text) {
      text = piece;
    } else {
      text += ` ${piece}`;
    }
  }

  // A shift arrow is drawn as its own run, so joining leaves a space on each side of it and
  // the text reads "gain a  1 dice shift" instead of "gain a 1 dice shift". Close the
  // gap after an arrow so the number reads as attached to it.
  return text
    .replace(/([\u2191\u2193\u2192])\s+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pull one named entry's text out of a book.
 *
 * Reads from the entry's own page and, when the entry runs to the foot of that page without
 * hitting the next heading, carries on into the page after it - a column or page break in the
 * middle of an entry is common and truncating there would lose half of it.
 * @param {Array<Array<Object>>} readingOrders   Per page, already in reading order.
 * @param {number} pageIndex   0-based index of the page to start on.
 * @param {string} name   The item's name.
 * @param {number} bodySize
 * @param {string} [type]   The item type, for undecorating the heading.
 * @returns {?{text: string, kind: string, continued: boolean}}
 */
export function extractEntry(readingOrders, pageIndex, name, bodySize, type) {
  const page = readingOrders[pageIndex];
  if (!page) return null;

  /**
   * Look for an entry opening with any of `keys`.
   * @param {Array<string>} keys
   * @returns {?{startIndex: number, headingEnd: number, kind: string}}
   */
  const scanFor = (keys) => {
    const matches = (text) => {
      const candidates = headingKeys(text, type);
      return keys.some(key => candidates.has(key));
    };

    for (let i = 0; i < page.length; i++) {
      const found = entryStart(page[i], keys, bodySize, type);
      if (found) {
        return { startIndex: i, headingEnd: i, kind: found };
      }

      // A display heading can wrap, and pdf.js reports each line of it as a separate run -
      // "BATTLE-" then "HARDENED". Neither half matches the item on its own, which is what left
      // a fifth of the GI Joe CRB's General Perks (a chapter set in a narrower column, so its
      // headings wrap far more often) without a description. Try the neighbours at the same size.
      if (page[i].size > bodySize) {
        let joined = page[i].s ?? '';
        for (let j = i + 1; j < page.length && j <= i + 2; j++) {
          if (page[j].size !== page[i].size) break;

          // No space after a hyphen: that hyphen is the wrap itself, not part of the name.
          joined += (joined.endsWith('-') ? '' : ' ') + (page[j].s ?? '');
          if (matches(joined)) {
            return { startIndex: i, headingEnd: j, kind: 'heading' };
          }
        }
      }
    }

    return null;
  };

  // Strict first. Only an item with no entry of its own anywhere on the page reaches for a
  // plural variant, and when it does the result says so, so the importer can show it as a
  // match the GM should look at rather than one to take on trust.
  let hit = scanFor(itemKeys(name));
  let loose = false;
  if (!hit) {
    const fallback = pluralKeys(name);
    if (fallback.length) {
      hit = scanFor(fallback);
      loose = !!hit;
    }
  }

  if (!hit) return null;

  const { startIndex, headingEnd, kind } = hit;
  const start = page[startIndex];
  // The margin the NEXT label would start at. It is this entry's own x, not the column's:
  // these books indent a run-in label past the body text it introduces (labels at x=72 against
  // body at x=63 in the GI Joe CRB), so measuring from the column edge never matched a label and
  // an entry ran on through every sibling after it - Adapted Vehicle came out at 2820 characters
  // instead of about a hundred.
  const labelMargin = start.x;

  const body = [];
  let continued = false;
  let reachedEnd = true;
  for (let i = headingEnd + 1; i < page.length; i++) {
    if (entryEnd(page[i], start, kind, bodySize, labelMargin)) {
      reachedEnd = false;
      break;
    }

    body.push(page[i]);
  }

  // Ran to the bottom of the page without being closed, so the entry keeps going overleaf.
  if (reachedEnd) {
    const next = readingOrders[pageIndex + 1] ?? [];
    for (const run of next) {
      if (entryEnd(run, start, kind, bodySize, labelMargin)) break;
      body.push(run);
      continued = true;
    }
  }

  const text = joinRuns(body);
  return text ? { text, kind, continued, loose } : null;
}

/**
 * Find an item's entry, allowing for the recorded page being one out.
 *
 * `system.source.page` is hand-entered and an entry that begins near a page boundary is easy to
 * attribute to the wrong side of it, so the pages either side are tried before giving up. The
 * recorded page is always tried first, so a name that legitimately appears on both only ever
 * resolves to the one the data points at.
 * @param {Array<Array<Object>>} readingOrders
 * @param {number} printedPage   From `system.source.page`.
 * @param {number} offset   From calibrateFolioOffset().
 * @param {string} name
 * @param {number} bodySize
 * @param {string} [type]   The item type, for undecorating the heading.
 * @returns {?{text: string, kind: string, continued: boolean, page: number, exact: boolean}}
 */
export function findEntry(readingOrders, printedPage, offset, name, bodySize, type) {
  const target = printedPage + offset - 1;   // -1 because readingOrders is 0-based
  for (const delta of [0, -1, 1]) {
    const found = extractEntry(readingOrders, target + delta, name, bodySize, type);
    if (found) {
      return { ...found, page: printedPage + delta, exact: delta === 0 };
    }
  }

  return null;
}
