/**
 * Turning a rulebook or adventure PDF into Journal Entries.
 *
 * The same shape as its siblings - no PDF or Foundry API, positioned text runs in, plain objects
 * out - so the judgement stays testable. Reading order, furniture removal and body-size detection
 * come from helpers/book-descriptions.mjs.
 *
 * The structure comes from the PDF's own outline rather than from guessing at headings, which is
 * a far better source when a book has one: Operation: Cold Iron carries a complete nested table
 * of contents down to individual rooms, and Operation: Snakebit eleven top-level entries. Nothing
 * has to be inferred about what is a chapter and what is a section, because the book says.
 *
 * Where the outline stops being enough is WITHIN a page. A destination resolves to a page and
 * nothing finer - every one of Cold Iron's is recorded at y=783, the top of the sheet - so several
 * sections landing on one page all point at the same place. Those are separated by finding each
 * title among the page's own runs, which is the same name-matching the description importer does.
 */

import { joinRuns, nameKey } from './book-descriptions.mjs';

/**
 * How many consecutive runs to join when looking for a title.
 *
 * Titles wrap and are kerned exactly as headings are ("Part 1: \nRolling Brief" arrives in
 * pieces), so this matches HEADING_PIECES in the description extractor.
 */
const TITLE_PIECES = 12;

/**
 * How far a line has to start in from its column before it counts as a new paragraph.
 *
 * These books indent a first line by 9pt (x=72 against a column left of 63, and x=324 against
 * 315 in the second column). Four is low enough to catch a smaller indent and high enough not to
 * be tripped by the sub-pixel drift of a justified line.
 */
const INDENT = 4;

/** How close two line starts have to be before they are taken to be the same column. */
const COLUMN_GAP = 60;

/** A run this much larger than the body is a heading inside the section ("MAIN GATE", 13 vs 10.5). */
const HEADING_RISE = 1.5;

/** Past this a large-type line is display prose or a pull quote, not a heading. */
const HEADING_MAX = 100;

/** A line opening with one of these is a new bullet, however it is indented. */
const BULLET = /^[\u2022\u25AA\u25E6\u2023\u2043\u00B7]/;

/**
 * Flatten a nested outline into a list, keeping the depth.
 *
 * Takes the outline already resolved to page indices - working out what page a destination
 * points at needs the PDF document, which is the importer's job, not this module's.
 * @param {Array<{title: string, page: number, items?: Array}>} items
 * @param {number} [depth]
 * @returns {Array<{title: string, page: number, depth: number}>} In document order.
 */
export function flattenOutline(items, depth = 0) {
  const flat = [];
  for (const item of items ?? []) {
    // Outline titles carry the line breaks the printed heading has ("Part 1: \nRolling Brief").
    flat.push({ title: (item.title ?? '').replace(/\s+/g, ' ').trim(), page: item.page, depth });
    if (item.items?.length) {
      flat.push(...flattenOutline(item.items, depth + 1));
    }
  }

  return flat;
}

/**
 * Sections whose content is not prose and should not become a journal page.
 *
 * A book's own front matter is not part of the adventure, and a MAP: entry points at an image -
 * it belongs to a Scene, not a page of text. Both are recognised here rather than filtered by the
 * caller so the reason stays with the rule.
 */
const SKIP_TITLE = /^(table of contents|credits|back cover|front cover|index)$/i;
const MAP_TITLE = /^map\s*:/i;

/**
 * Whether an outline entry points at a map rather than at prose.
 * @param {string} title
 * @returns {boolean}
 */
export function isMapEntry(title) {
  return MAP_TITLE.test((title ?? '').trim());
}

/**
 * Find where on its page a section actually begins.
 *
 * Needed because a destination only resolves to a page: Cold Iron puts five sections on page 77,
 * all pointing at the top of it. Without this they would all be handed the whole page.
 * @param {Array<Object>} page   Runs in reading order.
 * @param {string} title
 * @param {number} from   Index to search from, so a later section cannot match an earlier heading.
 * @returns {?{start: number, end: number}} The runs the title occupies, or null.
 */
export function findTitle(page, title, from = 0) {
  const key = nameKey(title);
  if (!key) return null;

  for (let i = Math.max(0, from); i < page.length; i++) {
    let joined = page[i].s ?? '';
    if (nameKey(joined) === key) return { start: i, end: i };

    // Titles wrap, and a wrapped one arrives as several runs - join forward until it matches or
    // the run of pieces gets implausibly long. The END matters as much as the start: a title
    // matched but only partly consumed leaves its own tail at the front of the section's text
    // ("into My Campaign? While it is not necessary...").
    for (let j = i + 1; j < page.length && j <= i + TITLE_PIECES; j++) {
      joined += (joined.endsWith('-') ? '' : ' ') + (page[j].s ?? '');
      if (nameKey(joined) === key) return { start: i, end: j };
      if (nameKey(joined).length > key.length) break;
    }
  }

  return null;
}

/**
 * Find the x each text column starts at, across the whole book.
 *
 * Worked out book-wide rather than per section because it has to separate a column left edge
 * from a paragraph indent, and one section is far too little to tell them apart: both x=63 and
 * x=72 look frequent in a page of prose. Over a whole book the column edge is an order of
 * magnitude commoner, so taking the commonest first and refusing anything within a column-width
 * of one already taken leaves exactly the edges - 63 and 315 in Operation: Snakebit - and drops
 * the indents, which is what makes an indent detectable at all.
 * @param {Array<Array<Object>>} readingOrders   Runs per page, in reading order.
 * @returns {Array<number>} Ascending.
 */
export function findColumnLefts(readingOrders) {
  const counts = new Map();
  let total = 0;
  for (const page of readingOrders ?? []) {
    for (const run of page) {
      if (!run.startsLine) continue;
      counts.set(run.x, (counts.get(run.x) ?? 0) + 1);
      total++;
    }
  }

  const lefts = [];
  for (const [x, n] of [...counts].sort((a, b) => b[1] - a[1])) {
    if (n < total * 0.02) break;
    if (!lefts.some(left => Math.abs(left - x) < COLUMN_GAP)) lefts.push(x);
  }

  return lefts.sort((a, b) => a - b);
}

/**
 * Break a section's runs into paragraphs and the headings printed inside it.
 *
 * The outline gives a section its name and nothing about its insides, so a five-thousand
 * character section would otherwise arrive as one unbroken paragraph - which is what a GM would
 * then have to read at the table. Three cues in the print recover the shape: a line that starts
 * further in than the one before it, a bullet, and a line set larger than the body and alone on
 * its line - a heading the outline did not record ("MAIN GATE", "WATCHTOWERS").
 *
 * What a line is measured against is the block it is in, not the column edge and not the line
 * before it. A book indents more things than paragraphs: a bulleted block set in from the margin
 * has every line indented, so measuring each against the column made all sixteen lines of
 * Operation: Snakebit's debrief separate paragraphs. Measuring against the previous line fixes
 * that but breaks a hanging indent, where the bullet sits OUT and its text runs IN - each bullet
 * was then split from its own second line.
 *
 * So a block takes its measure from its SECOND line. The first line says nothing useful either
 * way, since a paragraph indents it and a bullet outdents it; the second is where the block
 * settles, and a line that leaves that level by a clear step is a new block - whether it steps
 * in (the next paragraph) or back out (the prose after a list).
 *
 * The column edges are still needed, to normalise across a column break: a paragraph running
 * from the foot of one column to the head of the next must not be split by the 250pt jump in x.
 * @param {Array<Object>} runs   In reading order.
 * @param {Array<number>} lefts   From findColumnLefts().
 * @param {number} bodySize
 * @returns {Array<{type: string, text: string}>} type is "heading" or "p".
 */
export function buildBlocks(runs, lefts, bodySize) {
  const blocks = [];
  let current = null;

  const close = () => {
    if (!current) return;
    const text = joinRuns(current.runs);
    // Large type that runs on for a hundred characters is display prose, not a heading.
    const type = current.heading && text.length <= HEADING_MAX ? 'heading' : 'p';
    if (text) blocks.push({ type, text });
    current = null;
  };

  for (const run of runs) {
    const heading = !!run.alone && run.size >= bodySize + HEADING_RISE;
    let inset = null;
    let stepped = false;
    let bullet = false;

    if (run.startsLine) {
      inset = run.x - (lefts.filter(left => left <= run.x + 1).pop() ?? 0);
      bullet = BULLET.test(run.s ?? '');
      if (bullet) stepped = true;
      else if (current?.body !== null && current?.body !== undefined) {
        stepped = Math.abs(inset - current.body) >= INDENT;
      } else if (current?.lines === 1 && !current.bullet) {
        // The second line has not set the block's level yet, so it is judged against the first.
        // A first line is never less indented than the body it introduces - unless it is a
        // bullet, whose text hangs in from it, which is why a bullet block is exempt.
        stepped = inset >= current.first + INDENT;
      }
    }

    if (!current || heading !== current.heading || (stepped && !heading)) {
      close();
      current = { heading, runs: [], lines: 0, first: inset ?? 0, body: null, bullet };
    }

    if (run.startsLine) {
      current.lines++;
      if (current.lines === 2) current.body = inset;
    }

    current.runs.push(run);
  }

  close();
  return blocks;
}

/**
 * Read the text belonging to each outline section.
 *
 * A section runs from its own heading to wherever the next one starts, across as many pages as
 * that takes. Sections that share a page are split at their headings; a section whose heading
 * cannot be found falls back to starting at the top of its page, which is where its destination
 * pointed anyway.
 * @param {Array<{title: string, page: number, depth: number}>} nodes   From flattenOutline().
 * @param {Array<Array<Object>>} readingOrders   Runs per page, in reading order.
 * @param {number} [bodySize]   When given, each section is also broken into blocks.
 * @returns {Array<{title: string, depth: number, page: number, text: string, isMap: boolean,
 *   blocks: Array<{type: string, text: string}>}>}
 */
export function readSections(nodes, readingOrders, bodySize) {
  const lefts = bodySize ? findColumnLefts(readingOrders) : [];
  const located = nodes.map(node => {
    const page = readingOrders[node.page] ?? [];
    const found = findTitle(page, node.title);
    return { ...node, start: found ? found.start : 0, after: found ? found.end + 1 : 0 };
  });

  return located.map((node, i) => {
    const next = located[i + 1];
    const runs = [];

    for (let p = node.page; p < readingOrders.length; p++) {
      const page = readingOrders[p] ?? [];

      // Skip the whole heading: it becomes the section's name, not part of its text.
      const start = p === node.page ? node.after : 0;
      const end = next && p === next.page ? next.start : page.length;

      runs.push(...page.slice(start, end));

      if (!next || p >= next.page) break;
    }

    const text = joinRuns(runs);
    return {
      title: node.title,
      depth: node.depth,
      page: node.page,
      isMap: isMapEntry(node.title),
      text,
      // Without a body size there is nothing to measure a heading against, so the section stays
      // one paragraph - which is all the description importer ever wanted from it.
      blocks: bodySize ? buildBlocks(runs, lefts, bodySize) : (text ? [{ type: 'p', text }] : []),
    };
  });
}

/**
 * Group sections into Journal Entries.
 *
 * One entry per top-level outline node, with a page for every section beneath it. That matches
 * how these adventures are built - Cold Iron's top level is its four Missions plus the threat
 * roster - and keeps a journal browsable rather than one entry of two hundred pages.
 *
 * Deeper sections become pages too rather than being folded into their parent: an adventure's
 * third level is individual rooms ("Area 3: Testing Field"), and those are exactly what a GM
 * wants to open on its own at the table. Their depth is kept so the importer can show the shape.
 * @param {Array<Object>} sections   From readSections().
 * @returns {Array<{name: string, pages: Array<{name: string, text: string, depth: number,
 *   blocks: Array<{type: string, text: string}>}>}>}
 */
export function buildJournalEntries(sections) {
  const entries = [];

  for (const section of sections) {
    if (SKIP_TITLE.test(section.title) || section.isMap) continue;

    if (!entries.length || section.depth === 0) {
      entries.push({ name: section.title, pages: [] });

      // A top-level section usually has introductory text of its own before its first child.
      if (section.text) {
        entries[entries.length - 1].pages.push({
          name: section.title, text: section.text, blocks: section.blocks ?? [], depth: 0,
        });
      }

      continue;
    }

    if (section.text) {
      entries[entries.length - 1].pages.push({
        name: section.title, text: section.text, blocks: section.blocks ?? [], depth: section.depth,
      });
    }
  }

  return entries.filter(entry => entry.pages.length);
}

/**
 * The outline entries that point at a map.
 *
 * Kept separate from the journal because they are Scene candidates: the page they name holds the
 * map image, and the text on it is a caption at best.
 * @param {Array<Object>} sections   From readSections().
 * @returns {Array<{title: string, page: number}>}
 */
export function mapSections(sections) {
  return sections
    .filter(section => section.isMap)
    .map(section => ({ title: section.title.replace(MAP_TITLE, '').trim(), page: section.page }));
}
