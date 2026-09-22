/**
 * Finding the stat blocks in an adventure PDF.
 *
 * The same shape as its siblings - no PDF or Foundry API, positioned text runs in, plain text out.
 * What comes out is fed straight to helpers/stat-block-parser.mjs, which already understands three
 * printed dialects and has done since the Stat Block Importer was built. Nothing here parses a
 * stat block; this module only decides WHERE they are and hands over the text.
 *
 * That division is the whole point. The parser wants a paste, exactly as a GM would make one by
 * selecting a page in a PDF reader, and it already knows how to split a multi-block paste on
 * "THREAT LEVEL:". So the job is to reconstruct the printed lines from the runs and work out which
 * pages to include - not to reimplement a grammar that exists and is tested.
 *
 * The book's own outline is deliberately NOT used to find them, unlike the journal and the maps.
 * A stat block announces itself with "THREAT LEVEL:" far more reliably than a contents entry does:
 * Operation: Cold Iron's outline has no roster at all, and the S.H.A.R.C. is printed among the
 * handouts at the back where no reader of the contents would look for it. Searching the text finds
 * all 36 of them, including that one.
 */

/** The line every printed stat block carries exactly once, in every dialect. */
const MARKER = /^THREAT\s+LEVEL:/i;

/** A run this much larger than the body opens a new section rather than continuing one. */
const HEADING_RISE = 1.5;

/**
 * Rebuild a page's printed lines from its runs.
 *
 * The description importer wants a paragraph and joins everything with spaces; a stat block wants
 * the lines the publisher set, because the parser reads "SIZE: Common HEALTH: 2" as one line and
 * the skills as one per line. buildReadingOrder has already marked where each line starts.
 * @param {Array<Object>} runs   One page, in reading order.
 * @returns {Array<string>}
 */
export function pageLines(runs) {
  const lines = [];
  for (const run of runs ?? []) {
    if (run.startsLine || !lines.length) lines.push(run.s ?? '');
    else lines[lines.length - 1] += ` ${run.s ?? ''}`;
  }

  return lines.filter(line => line.trim());
}

/**
 * Whether a page carries the start of a stat block.
 * @param {Array<string>} lines   From pageLines().
 * @returns {boolean}
 */
export function hasStatBlock(lines) {
  return (lines ?? []).some(line => MARKER.test(line));
}

/**
 * Whether a page opens something new rather than carrying on from the page before.
 *
 * A stat block that overruns its page resumes in body type at the top of the next one, so the
 * question is only whether the first thing printed is a display heading. Cold Iron's continuation
 * pages start at 9pt against a 10.5pt body, while its HANDOUTS and PART 3 pages start at 14pt and
 * 22pt - not a close call in either direction.
 * @param {Array<Object>} runs   One page, in reading order.
 * @param {number} bodySize
 * @returns {boolean}
 */
export function startsSection(runs, bodySize) {
  const first = (runs ?? [])[0];
  return !!first && first.size >= bodySize + HEADING_RISE;
}

/**
 * The page ranges that hold stat blocks.
 *
 * A span opens on a page carrying "THREAT LEVEL:" and runs on through pages that carry no marker
 * of their own, as long as they have text and do not open a new section. That is what keeps the
 * Hydro-Viper's Powers, which overrun onto the next page, attached to the Hydro-Viper - and what
 * stops the run of handouts at the back of the book being swallowed by the threat before them.
 * @param {Array<Array<Object>>} orders   Runs per page, in reading order.
 * @param {number} bodySize
 * @returns {Array<{start: number, end: number}>} Inclusive page indices.
 */
export function findThreatSpans(orders, bodySize) {
  const spans = [];
  for (let i = 0; i < (orders?.length ?? 0); i++) {
    if (!hasStatBlock(pageLines(orders[i]))) continue;

    const span = spans[spans.length - 1];
    if (span && span.end === i - 1) span.end = i;
    else spans.push({ start: i, end: i });

    // Follow the block onto pages that only continue it.
    const current = spans[spans.length - 1];
    for (let j = i + 1; j < orders.length; j++) {
      const lines = pageLines(orders[j]);
      if (hasStatBlock(lines) || !lines.length || startsSection(orders[j], bodySize)) break;
      current.end = j;
    }

    i = current.end;
  }

  return spans;
}

/**
 * The text of one span, as a paste of it would look.
 * @param {Array<Array<Object>>} orders
 * @param {{start: number, end: number}} span
 * @returns {string}
 */
export function spanText(orders, span) {
  const lines = [];
  for (let i = span.start; i <= span.end; i++) lines.push(...pageLines(orders[i]));

  return lines.join('\n');
}

/**
 * Whether a stat block describes a machine rather than a person.
 *
 * The books print an em dash for a vehicle's Smarts and Social, because a Ferret has neither,
 * and the parser records that as null. Nothing else in a stat block is missing both of those,
 * so it is a clean test - and it has to be made, because an adventure mixes the two freely:
 * Operation: Cold Iron runs from the Cobra Viper straight on into the H.I.S.S. Tank.
 * @param {Object} ir   From parseStatBlock().
 * @returns {string} An Actor type.
 */
export function actorTypeFor(ir) {
  const essences = ir?.essences ?? {};
  const machine = essences.smarts === null && essences.social === null;
  return machine ? 'vehicle' : 'npc';
}

/**
 * The page each stat block in a span begins on.
 *
 * splitStatBlocks divides a span on the same marker this module finds it by, and in the same
 * order, so counting markers page by page says where each block was printed without the parser
 * having to report offsets it does not track. Worth the few lines: a span can run over six
 * pages, and telling the GM every threat on it was on the first one is worse than telling them
 * nothing.
 * @param {Array<Array<Object>>} orders
 * @param {{start: number, end: number}} span
 * @returns {Array<number>} One page index per block, in the order splitStatBlocks yields them.
 */
export function markerPages(orders, span) {
  const pages = [];
  for (let i = span.start; i <= span.end; i++) {
    for (const line of pageLines(orders[i])) {
      if (MARKER.test(line)) pages.push(i);
    }
  }

  return pages;
}
