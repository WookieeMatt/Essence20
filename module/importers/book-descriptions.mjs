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
 * The font size of body text: the size that the most TEXT is set in.
 *
 * Measured in characters rather than runs, which matters more than it sounds. A book with big
 * stat tables has far more size-9 runs than size-10.5 ones, because every cell is its own short
 * run while a paragraph of prose is a handful of long ones - counting runs picks the table.
 * A Jump Through Time has 9790 runs at 9pt against 6591 at 10.5pt, but 198k characters against
 * 245k, so only the character count gets it right.
 *
 * Getting this wrong is not a near miss. Everything keys off it: a heading is "bigger than body
 * text" and an entry ends at the first run bigger than body text, so a body size one step too
 * small makes every line of prose look like a heading and every entry ends immediately, empty.
 * That was 2 matches out of 138 in A Jump Through Time and 1 out of 125 in Across the Stars.
 * @param {Array<Array<Object>>} pages
 * @returns {number}
 */
export function findBodyFontSize(pages) {
  const tally = new Map();
  for (const runs of pages) {
    for (const run of runs) {
      tally.set(run.size, (tally.get(run.size) ?? 0) + (run.s?.length ?? 0));
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

/** How far apart two y-bands can be and still be the same piece of furniture, in points. */
const BAND_DRIFT = 6;

/**
 * The bands of the page where a running head or foot sits.
 *
 * findTextFloor() only deals with furniture BELOW the text, which is where the GI Joe and Power
 * Rangers books put all of theirs. The My Little Pony CRB puts its running head at the TOP
 * instead, above the body, so nothing below-the-floor catches it - and because an entry that
 * carries on overleaf resumes at the top of the next page, the head landed in the middle of 24
 * of that book's descriptions.
 *
 * Position cannot answer this on its own, so repetition does: a running head is the same few
 * words at the same height on page after page, while a heading is different words every time.
 * A band therefore has to be BOTH nearly ubiquitous and highly repetitive, which is what keeps
 * a chapter of similarly-placed headings from being mistaken for one.
 *
 * Body-sized runs are never considered, so no amount of coincidence can drop actual prose.
 * @param {Array<Array<Object>>} pages
 * @param {number} bodySize
 * @returns {Set<number>} Rounded y values whose runs are furniture.
 */
export function findFurnitureBands(pages, bodySize) {
  if (!pages.length) return new Set();

  const bands = new Map();
  for (let i = 0; i < pages.length; i++) {
    for (const run of pages[i]) {
      if (run.size === bodySize) continue;

      // Rounded, because the same running head drifts a point or two between pages.
      const y = Math.round(run.y / 2) * 2;
      if (!bands.has(y)) bands.set(y, { pages: new Set(), texts: new Set(), total: 0 });

      const band = bands.get(y);
      band.pages.add(i);
      band.texts.add(nameKey(run.s));
      band.total++;
    }
  }

  // A running head drifts further than one band is wide: Operation: Snakebit sets the same line
  // at y=750 on twenty-two pages and y=754 on three, and neither half reaches the threshold on
  // its own. Bands within a line-height of each other are judged together, then all of them are
  // marked, so a head that wanders is still recognised as one.
  const merged = [];
  for (const y of [...bands.keys()].sort((a, b) => a - b)) {
    const group = merged[merged.length - 1];
    if (group && y - group.ys[group.ys.length - 1] <= BAND_DRIFT) group.ys.push(y);
    else merged.push({ ys: [y] });
  }

  const ubiquitous = pages.length * 0.6;
  const furniture = new Set();
  for (const group of merged) {
    const seen = new Set();
    const texts = new Set();
    let total = 0;
    for (const y of group.ys) {
      const band = bands.get(y);
      for (const page of band.pages) seen.add(page);
      for (const text of band.texts) texts.add(text);
      total += band.total;
    }

    // The floor of 4 distinct strings is for a head that names the chapter: it changes a
    // dozen times in a book but is still the same handful of words over hundreds of pages.
    if (seen.size >= ubiquitous && texts.size <= Math.max(4, total * 0.25)) {
      for (const y of group.ys) furniture.add(y);
    }
  }

  return furniture;
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
 * @param {Set<number>} [furniture]   From findFurnitureBands().
 * @returns {Array<Object>} Runs in reading order.
 */
export function buildReadingOrder(runs, pageWidth, textFloor, furniture = new Set()) {
  const content = runs.filter(run => run.y >= textFloor
    && !run.rotated
    && !WATERMARK_RE.test(run.s ?? '')
    && !furniture.has(Math.round(run.y / 2) * 2));
  const middle = pageWidth / 2;
  const byColumn = [[], []];
  for (const run of content) {
    byColumn[run.x < middle ? 0 : 1].push(run);
  }

  for (const column of byColumn) {
    column.sort((a, b) => b.y - a.y);   // PDF y grows upward, so descending is top-down

    // Flag each run with whether it has its line to itself, which is what separates a heading
    // set in bold from a bold phrase inside a sentence. Computed here, once per page, because
    // the alternative is re-deriving it inside a matcher that runs thousands of times.
    const perLine = new Map();
    for (const run of column) {
      const line = Math.round(run.y / 2) * 2;
      perLine.set(line, (perLine.get(line) ?? 0) + 1);
    }

    // Leftmost run on its line, which is where a heading sits when it shares the line with the
    // prose it introduces - a run-in heading with no colon to give it away.
    const leftmost = new Map();
    for (const run of column) {
      const line = Math.round(run.y / 2) * 2;
      if (!leftmost.has(line) || run.x < leftmost.get(line)) {
        leftmost.set(line, run.x);
      }
    }

    for (const run of column) {
      const line = Math.round(run.y / 2) * 2;
      run.alone = perLine.get(line) === 1;
      run.startsLine = leftmost.get(line) === run.x;
    }
  }

  return [...byColumn[0], ...byColumn[1]];
}

/**
 * The fonts body text is set in.
 *
 * Needed because size alone cannot find every heading: the Decepticon Directive sets its
 * replacement-Perk headings at 10pt against a 10.5pt body, so they are SMALLER than the prose
 * they introduce and are marked out by weight instead. Without this, 168 of that book's Perks
 * had no heading to match and only 35% of them resolved.
 *
 * A set rather than a single font, because body text routinely uses several - a roman and an
 * italic, or two subsetted copies of the same face. Anything holding a real share of the body
 * text counts, so only a font used sparingly (a bold used for headings, say) falls outside it.
 * @param {Array<Array<Object>>} pages
 * @param {number} bodySize
 * @returns {Set<string>} Font names that carry body text.
 */
export function findBodyFonts(pages) {
  const tally = new Map();
  let total = 0;
  for (const runs of pages) {
    for (const run of runs) {
      if (!run.font) continue;

      // Every size counts, not just the book's dominant one. A book whose page count is
      // dominated by stat blocks has its "body size" set by those, and restricting the tally to
      // that size would collect the stat-block fonts and call the actual prose font a heading.
      const chars = (run.s ?? '').length;
      tally.set(run.font, (tally.get(run.font) ?? 0) + chars);
      total += chars;
    }
  }

  const fonts = new Set();
  for (const [font, chars] of tally) {
    if (chars >= total * 0.15) {
      fonts.add(font);
    }
  }

  return fonts;
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

  // The My Little Pony CRB heads every spell with its school - "ADAPT (ENCHANTMENT)" for the
  // item named "Adapt" - which is the mirror of the case itemKeys() handles, where the
  // compendium qualifies a name the book does not. 27 of that book's 28 spells were missed for
  // want of this.
  const unqualified = raw.replace(/\s*\([^)]*\)\s*$/, '');
  if (unqualified && unqualified !== raw) {
    keys.add(nameKey(unqualified));
  }

  const typeWord = nameKey(type ?? "");
  const full = nameKey(raw);
  if (typeWord && full.length > typeWord.length && full.endsWith(typeWord)) {
    keys.add(full.slice(0, -typeWord.length));
  }

  return keys;
}

/**
 * How many following runs to try joining onto a heading before giving up.
 *
 * Sized for the worst real case seen: "Spirit of Generosity" in the My Little Pony CRB arrives
 * as nine pieces. Twelve leaves room without letting the search wander far.
 */
const HEADING_PIECES = 12;

/**
 * How many runs to try joining into a run-in label.
 *
 * Far smaller than HEADING_PIECES, because a label is body-sized and so are the sentences
 * around it - the more pieces joined, the more chance of building a colon out of ordinary
 * prose. Three covers what the books actually do: the My Little Pony CRB sets its Laugh Tactics
 * as a bullet, the name, and the colon, each its own run.
 */
const LABEL_PIECES = 3;

/**
 * How far either side of the recorded page to widen the search when nothing is found nearby.
 *
 * Some books record the page a SECTION starts on rather than the page an entry is printed on -
 * all 34 of Welcome to Night Vale's General Perks say p.47, where that chapter opens, while the
 * entries run over the pages after it.
 *
 * 30 covers a chapter comfortably and keeps the cost bounded. Searching the whole book instead
 * is quadratic in its length and locked up the browser for minutes on a 250-page one, for no
 * gain: an entry filed under its section start is a few pages away, never a hundred.
 */
const WIDE_SEARCH_PAGES = 30;

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
 * The generic sub-headings an item of a given type is written under, inside a parent entry.
 *
 * An Influence's Perk and Hang Up share the Influence's name - the compendium has three items
 * all called "Athlete" - but the book names them only by what they are: ATHLETE, then INFLUENCE
 * PERK, then HANG-UP. So matching on the item name alone can only ever find the parent, and all
 * three items end up with the same text.
 *
 * Keys are nameKey()d, which is why "Hang-Up" and "HANG UP" are one entry rather than two.
 */
const SECTION_KEYS = {
  perk: new Set([nameKey('Influence Perk'), nameKey('Perk')]),
  hangUp: new Set([nameKey('Hang Up'), nameKey('Influence Hang Up')]),
};

/**
 * Find the sub-heading an item of this type lives under, within the entry just matched.
 *
 * Searches only as far as the next heading of the parent's own weight - that is the start of
 * the NEXT Influence, and its sections belong to it, not to this one.
 * @param {Array<Object>} page   Runs in reading order.
 * @param {number} from   Index just past the parent heading.
 * @param {Object} start   The parent heading run.
 * @param {number} bodySize
 * @param {string} type   The item type being looked for.
 * @returns {number} The index of the section heading, or -1.
 */
function findSection(page, from, start, bodySize, type, bodyFonts) {
  const keys = SECTION_KEYS[type];
  if (!keys) return -1;

  for (let i = from; i < page.length; i++) {
    const run = page[i];
    if (run.size >= start.size && run.size > bodySize) break;

    if (isHeading(run, bodySize, bodyFonts) && keys.has(nameKey(run.s ?? ''))) {
      return i;
    }
  }

  return -1;
}

/**
 * The whole line starting at `index`, if it reads "Label: Name".
 *
 * Only a line that the colon splits into a short label and something after it qualifies, so an
 * ordinary sentence containing a colon is not taken for one.
 * @param {Array<Object>} page   Runs in reading order.
 * @param {number} index
 * @returns {?{text: string, end: number}}
 */
function runInLine(page, index) {
  const y = page[index].y;
  let text = '';
  let end = index;
  for (let j = index; j < page.length && Math.abs(page[j].y - y) <= 2; j++) {
    text += (text ? ' ' : '') + (page[j].s ?? '');
    end = j;
  }

  const afterColon = text.split(':').slice(1).join(':');
  return looksLikeLabel(text) && afterColon.trim() && end > index ? { text, end } : null;
}

/**
 * Join runs from `index` into a run-in label, if they make one.
 *
 * Stops as soon as the text so far reads like a label, so the shortest join wins and the prose
 * that follows the colon is left out of the name.
 * @param {Array<Object>} page   Runs in reading order.
 * @param {number} index
 * @param {number} bodySize
 * @returns {?{text: string, end: number}} The label text and the index of its last run.
 */
function joinLabel(page, index, bodySize) {
  if (!page[index] || page[index].size > bodySize) return null;

  let joined = '';
  for (let j = index; j < page.length && j <= index + LABEL_PIECES; j++) {
    if (page[j].size > bodySize) break;

    joined += (joined ? ' ' : '') + (page[j].s ?? '');
    if (looksLikeLabel(joined)) {
      return { text: joined, end: j };
    }
  }

  return null;
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
/**
 * Whether a run is a heading, by size or by weight.
 *
 * Bigger than body text is the usual sign and needs nothing else. The second case is for books
 * that mark a heading by weight instead: the Decepticon Directive sets "Nowhere to Run" at 10pt
 * over a 10.5pt body, in a font used nowhere in the prose.
 *
 * That second case is guarded tightly, because bold at body size is also how a run-in label and
 * an emphasised phrase are set, and treating either as a heading would cut entries in half:
 *
 *   - it must have its line to itself, which an inline phrase never does and a run-in label
 *     never does either (the prose it introduces continues on the same line);
 *   - it must be short, so a whole sentence set in an unusual font is not mistaken for a title;
 *   - it must not be dramatically smaller than the body, which would make it a caption.
 * @param {Object} run
 * @param {number} bodySize
 * @param {Set<string>} bodyFonts   From findBodyFonts(); empty disables the weight test.
 * @returns {boolean}
 */
function isHeading(run, bodySize, bodyFonts) {
  if (!run) return false;
  if (run.size > bodySize) return true;

  // Book-wide, deliberately. Books that subset a font per page - whose book-wide "body font" is
  // absent from most of their pages - are handled before this is reached: extractEntry() swaps in
  // that page's own prose fonts via pageBodyFonts(), but only on such pages.
  //
  // A per-page list for every page was tried, both instead of this one and unioned with it, and both lost: on a
  // page with a large display heading, the heading's own font can be a quarter of that page's
  // characters and so be counted as body, at which point the heading stops being a heading. It
  // cost the GI Joe CRB 50 matches and the My Little Pony CRB 49.
  const fonts = bodyFonts;
  if (!fonts?.size || !run.font || fonts.has(run.font)) return false;

  // Having the line to itself stays required, even though that costs the run-in headings the
  // Enigma of Combination uses. Accepting a run that merely STARTS its line was tried and is too
  // loose to live with: it finds those, but it also promotes the first run of ordinary paragraphs
  // to headings, which then end the entry above them. It cost the GI Joe CRB 54 matches and the
  // My Little Pony CRB 44, and halved the median length of what survived.

  // A point and a half below the body, which is a narrow window chosen from both sides. The
  // Enigma of Combination sets its Perk headings at 9pt against a 10.5pt body, so anything
  // tighter rejects every one of them; the GI Joe CRB sets captions and table text at 8.5pt
  // against the same body, and anything looser promotes those to headings, which then cut short
  // the entries above them - that cost it 50 matches and halved the median length of the rest.
  //
  // And it must not read like a run-in label. "Prerequisite: Anti-Air Combat Training, Level 8"
  // is bold, short and alone on its line under every Perk in the Quartermaster's Guide to Gear,
  // so without this it passed as the NEXT heading and every one of those Perks came back empty.
  // Capitals are the exception: "TABLE 4-3: BRUTE" has the same shape, and is the heading that
  // closes each of the Decepticon Directive's Focuses before its level table.
  const text = run.s ?? '';
  const isLabel = looksLikeLabel(text) && text !== text.toUpperCase();

  // Nor read like a line of prose. Some books start a new font subset every few lines, so a
  // stray line of ordinary text can sit in a font nothing else on the page uses - "but Marines
  // fight where they're needed. Beyond" cut Sgt Slaughter's Marine off after one line. A heading
  // never opens in lower case or closes on a full stop.
  const isProse = /^\p{Ll}/u.test(text) || /[.,;]$/.test(text);
  return run.alone === true && run.size >= bodySize - 1.5 && text.length <= 60 && !isLabel && !isProse;
}

function entryStart(run, keys, bodySize, type, bodyFonts) {
  const text = run.s ?? '';
  const matches = (candidates) => keys.some(key => candidates.has(key));

  if (isHeading(run, bodySize, bodyFonts) && matches(headingKeys(text, type))) {
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
function entryEnd(run, start, kind, bodySize, labelMargin, bodyFonts) {
  // ANY heading closes what came before it, not merely one of the same weight.
  //
  // Weight alone is not enough because these books nest: an Influence is headed at 38pt and
  // then subdivided at 22pt into INFLUENCE PERK, HANG-UP and SUGGESTED CHARACTERISTICS. Ending
  // only at the next 38pt heading swallowed all of that, which is why a third of the entries in
  // some books came out several thousand characters long - the Athlete Influence, its Perk and
  // its Hang Up were three separate items all handed the same whole-page writeup.
  // The weight-based case counts here too, or a book that heads by weight would have each
  // entry run on through every sibling after it.
  if (isHeading(run, bodySize, bodyFonts)) {
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

  // Welcome to Night Vale uses a different symbol font and so different codepoints, but it
  // defines them in its own text - "An Upshift ( [F068] ) or Downshift ( [F069] )" - so these
  // two are not inferred from context but stated by the book.
  '\uF068': '\u2191',
  '\uF069': '\u2193',
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
 * Whether the entry ends at `index`.
 *
 * Wraps entryEnd() with the lookahead a split label needs: the run at `index` may be only the
 * first piece of the next label ("So Funny, It's Scary" with its colon in the run after it), in
 * which case entryEnd() alone sees no colon and the entry runs on through every sibling.
 * @param {Array<Object>} page   Runs in reading order.
 * @param {number} index
 * @param {Object} start
 * @param {string} kind
 * @param {number} bodySize
 * @param {number} labelMargin
 * @returns {boolean}
 */
function endsHere(page, index, start, kind, bodySize, labelMargin, bodyFonts) {
  const run = page[index];
  if (entryEnd(run, start, kind, bodySize, labelMargin, bodyFonts)) {
    return true;
  }

  if (kind !== 'label' || Math.abs(run.x - labelMargin) > 3) {
    return false;
  }

  return !!joinLabel(page, index, bodySize);
}

/**
 * Join runs into a paragraph.
 *
 * pdf.js emits one run per styled span, so a single sentence arrives in pieces and line-broken
 * words arrive hyphenated ("addi-" / "tional"). Both are put back together here.
 * @param {Array<Object>} runs
 * @returns {string}
 */
export function joinRuns(runs) {
  let text = '';
  for (const run of runs) {
    const piece = mapSymbolGlyphs(run.s ?? '').trim();
    if (!piece) continue;

    if (text.endsWith('-')) {
      // Rejoin a word split across lines. The whitespace before the hyphen has to go too: these
      // PDFs often put the hyphen in a run of its own, so the join above has already inserted a
      // separator in front of it and "exhil" + "-" + "aration" would come back as "exhil aration"
      // rather than "exhilaration".
      text = text.replace(/\s*-$/, '') + piece;
    } else if (!text) {
      text = piece;
    } else {
      text += ` ${piece}`;
    }
  }

  // A heading can carry the level it is gained at as separate, smaller runs - the My Little Pony
  // CRB sets "CHEER" then "(1" then "LEVEL)". That is not part of the heading (different size, so
  // the join above will not take it) and not part of the description either. Left in, entries in
  // that book opened with "(6 LEVEL)".
  //
  // Matched as "a leading parenthetical that talks about levels" rather than one exact shape,
  // because the book writes at least four: "(1 LEVEL)", "(3RD LEVEL - ALSO 11TH)" and
  // "(7 LEVEL- ALSO 15 LEVEL)". The optional ordinal in front is the superscript of "1ST", which
  // is a run of its own at a smaller size again and so arrives ahead of the bracket.
  // Several ordinals can stack up ("TH TH TH (6 LEVEL - ALSO 14 AND 18 LEVEL))"), one per level
  // the tag mentions, and the bracket is sometimes doubled - hence the repeats on both.
  text = text.replace(/^(?:(?:st|nd|rd|th)\s*)*\([^)]*level[^)]*\)+\s*/i, '');

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
/**
 * Per-page body size, memoized. See pageBodySize() for why a book-wide figure is not enough.
 * @type {WeakMap<Array<Object>, number>}
 */
const pageBodySizes = new WeakMap();

/**
 * The size body text is set in on THIS page.
 *
 * A single figure for a whole book only holds while the book has one layout. General Hawk's
 * Personnel Files has 300k characters of 9pt stat blocks against 77k of 10.5pt prose, so the
 * book-wide answer is 9 - and on the pages that actually carry entries, where the prose is 10.5
 * and the heading 15, that makes every line of prose look like a heading and ends every entry
 * before it starts. All 52 of that book's items were missed, and 77 of 79 in Ferocious Fighters.
 *
 * A page with too little text to judge keeps the book-wide figure, so a mostly-art page or a
 * half-empty one does not invent its own.
 * @param {Array<Object>} page   Runs in reading order.
 * @param {number} fallback   The book-wide size.
 * @returns {number}
 */
function pageBodySize(page, fallback) {
  if (pageBodySizes.has(page)) {
    return pageBodySizes.get(page);
  }

  const tally = new Map();
  let total = 0;
  for (const run of page) {
    const chars = (run.s ?? '').length;
    tally.set(run.size, (tally.get(run.size) ?? 0) + chars);
    total += chars;
  }

  let best = fallback;
  if (total >= 400) {
    let bestChars = -1;
    for (const [size, chars] of tally) {
      if (chars > bestChars) {
        best = size;
        bestChars = chars;
      }
    }
  }

  // Only ever raise, never lower. The failure this exists for is a book-wide size too SMALL for
  // the page in hand (General Hawk's Personnel Files, where 300k characters of stat block set the
  // book's size to 9 while the pages carrying entries are 10.5). A page answering SMALLER is the
  // opposite case - a page given over to a table, which would drag the threshold below the prose
  // of any entry sharing it, and cost the GI Joe CRB ten matches. A book whose headings are
  // genuinely smaller than its body is handled by isHeading()'s weight test instead, which does
  // not depend on this figure being exact.
  const size = Math.max(best, fallback);
  pageBodySizes.set(page, size);
  return size;
}

/**
 * Per-page answer to pageBodyFonts(), memoized like pageBodySizes but also by body size, since an
 * entry can raise the size it is judged at (see entryBodySize()).
 * @type {WeakMap<Array<Object>, Map<number, Set<string>>>}
 */
const pageBodyFontSets = new WeakMap();

/**
 * The book-wide body fonts, or none at all on a page they do not actually set.
 *
 * isHeading()'s weight test calls any short line in a non-body font a heading, which is only
 * safe where the body font really is the one the prose is in. Some PDFs embed a separate subset
 * of the same face on every page, under a new name each time: the Quartermaster's Guide to Gear
 * has 63 fonts, and the one findBodyFonts() settles on sets the prose on 26 of its 119 text
 * pages. On the other 93 every line of prose passed the weight test, so each entry ended at its
 * own first line and came back empty - 0 of its 81 Perks, and 69 pages of the Enigma of
 * Combination the same way.
 *
 * This keeps the book-wide list wherever it holds (a per-page list everywhere lost matches -
 * see isHeading()) and only falls back to the page's own prose fonts where the book-wide ones
 * are not what the page is written in. A page with too little text to judge keeps the
 * book-wide list, as pageBodySize() does.
 * @param {Array<Object>} page   Runs in reading order.
 * @param {Set<string>} bodyFonts   From findBodyFonts().
 * @returns {Set<string>}
 */
function pageBodyFonts(page, bodyFonts, bodySize) {
  if (!bodyFonts?.size) return bodyFonts;
  if (!pageBodyFontSets.has(page)) pageBodyFontSets.set(page, new Map());
  const memo = pageBodyFontSets.get(page);
  if (memo.has(bodySize)) return memo.get(bodySize);

  const tally = new Map();
  let total = 0;
  let body = 0;
  let atBodySize = 0;
  for (const run of page) {
    const chars = (run.s ?? '').length;
    total += chars;
    if (bodyFonts.has(run.font)) body += chars;
    if (run.font && run.size === bodySize) {
      tally.set(run.font, (tally.get(run.font) ?? 0) + chars);
      atBodySize += chars;
    }
  }

  let fonts = bodyFonts;
  if (total >= 400 && body < total * 0.25) {
    // The fonts this page sets its prose in: anything carrying a real share of the text at the
    // page's body size. Not simply "no weight test here" - the same book heads its Focuses by
    // weight alone (CHAMELEONITE at 10pt over a 10.5pt body), and those pages need the test as
    // much as any other. And not the share-of-page rule findBodyFonts() uses book-wide, because
    // these PDFs can also start a new subset per PARAGRAPH: Finster's sets one page's prose in
    // five fonts, none holding 15% of it, so every prose line on it passed as a heading.
    //
    // Added to the book-wide list, never in place of it: a rare subset can fall under 5% of a page
    // and still be the one the book-wide tally caught, and dropping it cut Sgt Slaughter's Marine
    // and two others off mid-sentence. Both lists name prose, so the union only ever makes FEWER
    // lines look like headings.
    fonts = new Set(bodyFonts);
    for (const [font, chars] of tally) {
      if (chars >= atBodySize * 0.05) fonts.add(font);
    }
  }

  memo.set(bodySize, fonts);
  return fonts;
}

/**
 * How many runs under a heading to read the entry's own body size from.
 */
const ENTRY_SIZE_RUNS = 15;

/**
 * The size an entry's own prose is set in, read from the lines directly under its heading.
 *
 * pageBodySize() answers for the page as a whole, and a page can be mostly something else: the
 * Fireball in Finster's Monster-Matic Cookbook shares its page with a spell-cost table - 2,000
 * characters at 8.5pt against 1,000 of 10.5pt prose - in a book whose 9pt stat blocks set the
 * book-wide figure. Judged at 9, every line of the spell's 10.5pt prose read as a heading and
 * ended it. Only raises, for the same reason pageBodySize() only raises; runs at the heading's
 * own size or bigger are left out so a sub-heading cannot pass for body text.
 * @param {Array<Object>} page   Runs in reading order.
 * @param {number} headingEnd   Index of the heading's last run.
 * @param {Object} start   The heading run.
 * @param {number} bodySize   The page's body size.
 * @returns {number}
 */
function entryBodySize(page, headingEnd, start, bodySize) {
  const tally = new Map();
  for (let i = headingEnd + 1; i < page.length && i <= headingEnd + ENTRY_SIZE_RUNS; i++) {
    const run = page[i];
    if (run.size >= start.size) continue;
    tally.set(run.size, (tally.get(run.size) ?? 0) + (run.s ?? '').length);
  }

  let local = bodySize;
  let localChars = -1;
  for (const [size, chars] of tally) {
    if (chars > localChars) {
      local = size;
      localChars = chars;
    }
  }

  return Math.max(bodySize, local);
}

export function extractEntry(readingOrders, pageIndex, name, bodySize, type, bodyFonts) {
  const page = readingOrders[pageIndex];
  if (!page) return null;

  const bookBodyFonts = bodyFonts;
  const bookBodySize = bodySize;
  bodySize = pageBodySize(page, bodySize);
  bodyFonts = pageBodyFonts(page, bookBodyFonts, bodySize);

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
      const found = entryStart(page[i], keys, bodySize, type, bodyFonts);
      if (found) {
        return { startIndex: i, headingEnd: i, kind: found };
      }

      // A display heading routinely arrives in pieces, and pdf.js reports each one as its own
      // run. Two reasons, both common:
      //
      //   - it wrapped. "BATTLE-" then "HARDENED" - a fifth of the GI Joe CRB's General Perks
      //     are set in a narrow column and wrap this way.
      //   - it is set in a display face that starts a new run at every change of case. The My
      //     Little Pony CRB writes "Spirit of Generosity" as nine runs: Spi R it O f gE n EROS
      //     ity. Every Role in that book was missed for want of joining them.
      //
      // Hence a generous limit. Cost is bounded (the join stops at the first size change, and
      // headings are a small fraction of a page) and each step is tested as it is built, so the
      // shortest run of pieces that actually spells the name is the one that wins.
      //
      // Only a heading set LARGER than the body is joined. One marked by weight alone is a single
      // line by construction (isHeading() requires it to have its line to itself), and joining
      // onto it walks straight into the prose below: in Finster's, twelve lines of an
      // introduction were joined until they ended "...Influence: Infiltrator." and the
      // introduction was taken for the Infiltrator's heading.
      if (page[i].size > bodySize && isHeading(page[i], bodySize, bodyFonts)) {
        let joined = page[i].s ?? '';
        for (let j = i + 1; j < page.length && j <= i + HEADING_PIECES; j++) {
          if (page[j].size !== page[i].size) break;

          // No space after a hyphen: that hyphen is the wrap itself, not part of the name.
          joined += (joined.endsWith('-') ? '' : ' ') + (page[j].s ?? '');
          if (matches(joined)) {
            return { startIndex: i, headingEnd: j, kind: 'heading' };
          }
        }
      }

      // A whole line reading "Origin Benefit: Always Seeking" - a generic label, then the item's
      // own name after the colon, both at body size and split across runs. Across the Stars and
      // Through the Shattered Grid name their Origin Perks this way. Nothing else recognised
      // them: the line is not a heading by size or weight, and as a label its name is the part
      // BEFORE the colon.
      if (page[i].startsLine && page[i].size <= bodySize) {
        const line = runInLine(page, i);
        if (line && keys.some(key => headingKeys(line.text, type).has(key)) && nameKey(line.text.split(':')[0]) !== keys[0]) {
          return { startIndex: i, headingEnd: line.end, kind: 'heading' };
        }
      }

      // A run-in label can arrive in pieces as well, and the piece that gets separated is
      // usually the colon itself: the My Little Pony CRB sets each Laugh Tactic as a bullet,
      // then the name, then ":", then the prose. Without joining, the name run carries no colon
      // and is not recognised as a label at all - that was every Laugh Tactic in the book.
      if (page[i].size <= bodySize) {
        const label = joinLabel(page, i, bodySize);
        if (label && keys.includes(nameKey(label.text))) {
          return { startIndex: i, headingEnd: label.end, kind: 'label' };
        }

        // The piece carrying the colon can carry the prose's first word as well: Ferocious
        // Fighters wraps "Hypergenetic / Manipulation" and then sets ": Whether you descend..."
        // as one run, so the joined label never equals the name. Matched on what precedes the
        // colon, and that last piece is left to the body rather than swallowed with the name.
        if (label && keys.includes(nameKey(label.text.split(':')[0]))) {
          const tail = (page[label.end].s ?? '').split(':').slice(1).join(':').trim();
          return { startIndex: i, headingEnd: tail ? label.end - 1 : label.end, kind: 'label' };
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

  let { startIndex, headingEnd, kind } = hit;
  let start = page[startIndex];

  // A Perk or Hang Up that shares its name with an Influence has just matched the Influence.
  // Its own text is a section inside that entry, so step down into it. When there is no such
  // section - an ordinary Perk with a heading of its own - nothing changes.
  if (kind === 'heading') {
    const section = findSection(page, headingEnd + 1, start, bodySize, type, bodyFonts);
    if (section !== -1) {
      startIndex = section;
      headingEnd = section;
      start = page[section];
    }
  }

  // Measured at the size the entry is actually set in, which can be larger than the page's: on
  // Finster's Icy Breath page the page-size fonts were a single stray 9pt run, so every line of
  // the spell's 10.5pt prose was "not in a body font" and the second one ended it.
  bodySize = entryBodySize(page, headingEnd, start, bodySize);
  bodyFonts = pageBodyFonts(page, bookBodyFonts, bodySize);

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
    // The first line under a heading never ends it by weight alone. Finster's Monster-Matic
    // Cookbook opens every spell with a one-line italic tagline ("A projected eruption of
    // flame."), short and alone and in a minor font, which is everything the weight test asks
    // of a heading - so each spell came back empty. A heading with nothing under it is not an
    // entry, so the line directly beneath is prose, whatever it is set in.
    //
    // Nor does the wrapped second line of something already under way. Ferocious Fighters sets
    // Big Swing's prerequisite in its own font over two lines, and "Ballistic weapon" - short,
    // alone, capitalised - passed as the next heading. A line in the same font as the one just
    // above it, at ordinary line spacing, is that line continuing.
    const weightOnly = page[i].size <= bodySize;
    const previous = page[i - 1];
    const wrapped = weightOnly && previous?.font && previous.font === page[i].font
      && previous.y - page[i].y > 0 && previous.y - page[i].y <= page[i].size * 1.5;
    if (!((body.length === 0 || wrapped) && weightOnly) && endsHere(page, i, start, kind, bodySize, labelMargin, bodyFonts)) {
      reachedEnd = false;
      break;
    }

    body.push(page[i]);
  }

  // Ran to the bottom of the page without being closed, so the entry keeps going overleaf.
  if (reachedEnd) {
    const next = readingOrders[pageIndex + 1] ?? [];
    const nextBodyFonts = pageBodyFonts(next, bookBodyFonts, pageBodySize(next, bookBodySize));
    for (let i = 0; i < next.length; i++) {
      if (endsHere(next, i, start, kind, bodySize, labelMargin, nextBodyFonts)) break;
      body.push(next[i]);
      continued = true;
    }
  }

  // A label whose colon arrived with the prose leaves that colon at the front of the body.
  const text = joinRuns(body).replace(/^:\s*/, '');
  return text ? { text, kind, continued, loose } : null;
}

/**
 * Work out the page offset by trying offsets and seeing which one finds the most entries.
 *
 * calibrateFolioOffset() reads the answer off the printed page numbers, which is exact when
 * there are any to read. Some books have none it can see - the Enigma of Combination yields zero
 * folio samples - and the offset then falls back to 0 with no evidence behind it, which puts
 * every lookup on the wrong page. That book matched 9 of 105 items.
 *
 * So: ask the content instead. The right offset is the one under which the book's own item names
 * actually turn up as headings, and a wrong one finds almost nothing, so the signal is stark.
 *
 * Sampled rather than exhaustive, because this runs once per candidate offset over the whole
 * item list and only needs to tell a clear winner from noise.
 * @param {Array<Array<Object>>} readingOrders
 * @param {Array<{name: string, type: string, page: number}>} items
 * @param {number} bodySize
 * @param {Set<string>} bodyFonts
 * @param {Array<number>} candidates   Offsets to try.
 * @param {number} [sampleSize]
 * @returns {{offset: number, matched: number}}
 */
export function findBestOffset(readingOrders, items, bodySize, bodyFonts, candidates, sampleSize = 40) {
  const step = Math.max(1, Math.floor(items.length / sampleSize));
  const sample = items.filter((unused, index) => index % step === 0).slice(0, sampleSize);

  let best = { offset: candidates[0] ?? 0, matched: -1 };
  for (const offset of candidates) {
    let matched = 0;
    for (const item of sample) {
      if (findEntry(readingOrders, item.page, offset, item.name, bodySize, item.type, bodyFonts)) {
        matched++;
      }
    }

    if (matched > best.matched) {
      best = { offset, matched };
    }
  }

  return best;
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
export function findEntry(readingOrders, printedPage, offset, name, bodySize, type, bodyFonts, wide = false) {
  const target = printedPage + offset - 1;   // -1 because readingOrders is 0-based
  const at = (delta) => {
    const found = extractEntry(readingOrders, target + delta, name, bodySize, type, bodyFonts);
    return found ? { ...found, page: printedPage + delta, exact: delta === 0 } : null;
  };

  for (const delta of [0, -1, 1]) {
    const found = at(delta);
    if (found) return found;
  }

  // Nothing within a page either way, so widen to the whole book, working outward from where the
  // data said to look.
  //
  // Some books record the page a SECTION starts on rather than the page the entry is printed on:
  // all 34 of Welcome to Night Vale's General Perks say p.47, which is where that chapter opens,
  // while the entries themselves run over the pages after it. A one-page window cannot reach
  // them, and 99 of that book's 165 items were missed for it.
  //
  // Outward rather than front-to-back so the nearest candidate wins, which is almost always the
  // right one, and the result is flagged `loose` either way - the importer shows it as a match to
  // look at rather than one to take on trust. A stray match is unlikely regardless, because the
  // whole heading still has to BE the item's name.
  // Opt-in, because the caller that identifies WHICH book a PDF is runs every book's items
  // against it, and for the 35 books it is not, essentially every item goes unmatched. Widening
  // the search for each of those turns identification from one page-scan per item into sixty,
  // which locked the browser up for minutes. Identification passes wide=false and only the
  // winning book is scanned again with it on.
  if (!wide) {
    return null;
  }

  // Bounded, not the whole book. A section start is a handful of pages from its entries, never a
  // hundred, and scanning the lot is quadratic in the book's length for no gain.
  const span = Math.min(WIDE_SEARCH_PAGES, Math.max(target, readingOrders.length - target));
  for (let delta = 2; delta <= span; delta++) {
    for (const signed of [delta, -delta]) {
      const found = at(signed);
      if (found) return { ...found, loose: true };
    }
  }

  return null;
}
