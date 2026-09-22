/**
 * Pulling roll tables out of a GM's own copy of a rulebook PDF.
 *
 * A companion to helpers/book-descriptions.mjs and the same shape: no PDF or Foundry API, just
 * arrays of positioned text runs in, plain objects out, so the judgement stays testable. The
 * reading order, furniture removal and body-size detection it relies on all come from that
 * module - this one only knows how a table is laid out once the page has been tidied.
 *
 * A table is found by its DIE, not by its title. The GI Joe Core Rulebook has 77 titled tables
 * of which only 17 are rolled on - the rest are reference charts, Role progressions and Focus
 * lists - and the die in the header is the one thing that tells the two apart. Titles are no
 * use for finding them either way: GI Joe heads its tables "TABLE 5-2: ADVENTURER BONDS" and
 * the My Little Pony CRB just writes "BACKGROUND BONDS", so a rule built on the numbering
 * would read seventeen tables out of one book and none at all out of the other.
 *
 * Rows are found by their NUMBERS, not by their lines, which is the whole of the difficulty. The
 * books set these two quite different ways and both have to work:
 *
 *  - Two pairs of columns side by side, 1-6 on the left and 7-12 on the right, so one printed
 *    line reads "1 Acting 7 Music" and is two rows, not one called "Acting 7 Music".
 *  - One pair, with the text wrapped over two or three lines and the number set against the
 *    MIDDLE of them ("I seek out treasures to return them" / "1" / "to their homeland."), so a
 *    row's own number is neither the first thing in it nor on the same line as most of its text.
 *
 * Grouping by line handles the first and fails the second. What handles both is to let every
 * number open a row and give each piece of text to the nearest number to its left.
 */

/**
 * A numbered title line: "TABLE 5-4.1: ATHLETIC PURSUITS".
 *
 * Used to recognise and strip the numbering where a book has it, never to find a table. The
 * number is required, so "TABLE OF CONTENTS" is not mistaken for a table called "OF CONTENTS".
 */
const TABLE_TITLE = /^TABLE\s+[\d][\w.-]*\s*[:.]\s*(.+)$/i;

/** The die a table is rolled on, as its own run in the header row. */
const DIE = /^d\d+$/i;

/**
 * A row's range: a single number, or a span written with any of the dashes these books use.
 */
const RANGE = /^(\d+)\s*(?:[-‐-―]\s*(\d+))?$/;

/**
 * How far past the last row's own number that row's text can still reach.
 *
 * Taken from the table rather than fixed, because the last row is no taller than the rest and
 * the rest are as tall as the gaps between their numbers. A fixed allowance has to suit both a
 * GI Joe row (35pt between numbers) and a My Little Pony one (42pt), and anything small enough
 * to be safe for the first cuts the last line off the second.
 * @param {Array<{run: Object}>} numbers   From rowNumbers().
 * @returns {number} In points.
 */
function rowTail(numbers) {
  const gaps = [];
  for (let i = 1; i < numbers.length; i++) {
    // Zero where a side-by-side table prints two numbers on one line; those say nothing about
    // how tall a row is.
    const gap = numbers[i - 1].run.y - numbers[i].run.y;
    if (gap > 0) gaps.push(gap);
  }

  if (!gaps.length) return ROW_TAIL_MIN;

  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  return Math.min(ROW_TAIL_MAX, Math.max(ROW_TAIL_MIN, median));
}

/** Bounds on that allowance: enough for one line, never more than a tall row. */
const ROW_TAIL_MIN = 14;
const ROW_TAIL_MAX = 50;

/**
 * How far below its title a table's die header can sit, in points.
 *
 * Without a bound, a table with no die of its own finds the NEXT table's header further down
 * the page and reads that table's rows under this one's name. Forty is comfortably more than
 * the sixteen or so these books leave, and comfortably less than the height of a table.
 */
const HEADER_GAP = 40;

/** Die headers within this many points of each other are the same header row. */
const HEADER_BAND = 3;

/** How far to either side of the die a title can start, in points. */
const TITLE_REACH = 260;

/** A single row is a coincidence; two is a table. */
const MIN_ROWS = 2;

/** Display lines this close together are one title wrapped, not two. */
const TITLE_LINE = 25;

/** How close two baselines have to be to count as the same line, in points. */
const ALIGN_BAND = 2;

/**
 * Which column of the page a run sits in.
 * @param {Object} run
 * @param {number} pageWidth
 * @returns {number} 0 or 1.
 */
function columnOf(run, pageWidth) {
  return run.x < pageWidth / 2 ? 0 : 1;
}

/**
 * The size a table's rows are set in.
 *
 * Read from the page rather than assumed, because it is not the body size - these tables are set
 * smaller than the prose around them (8.5 against a 10.5 body in the GI Joe CRB). Taking the most
 * common size among the runs just under the header gets it without a rule about how much smaller.
 * @param {Array<Object>} below   Runs beneath the header, in the table's column.
 * @param {number} bodySize
 * @returns {?number}
 */
function rowSize(below, bodySize) {
  const tally = new Map();
  for (const run of below.slice(0, 40)) {
    if (run.size > bodySize) continue;
    tally.set(run.size, (tally.get(run.size) ?? 0) + 1);
  }

  let best = null;
  let bestCount = 0;
  for (const [size, count] of tally) {
    if (count > bestCount) {
      best = size;
      bestCount = count;
    }
  }

  return best;
}

/**
 * The numbers that open the rows of one table, in the order they are printed.
 *
 * Where the table ends is decided here, and by repetition rather than by position: a number the
 * table has already used means the page has moved on to the next table, which starts again at 1.
 * That cannot be judged by whether the numbers ascend, because in a side-by-side table they go
 * 1, 7, 2, 8 down the page quite correctly.
 *
 * The printed die is deliberately NOT used as a bound. The GI Joe CRB heads its Martial Arts
 * Specialty table "D12" over rows numbered 1 to 20, and cutting the table off at 12 to honour
 * that left five rows of nonsense. The rows are the table; the die is a label on it.
 * @param {Array<Object>} body   Runs beneath the header, at the row size.
 * @returns {{numbers: Array<{low: number, high: number, run: Object}>, endedAt: ?number}}
 *   `endedAt` is the height at which the next table began, where there was one.
 */
function rowNumbers(body) {
  const numbers = [];
  const seen = new Set();

  for (const run of body) {
    const range = RANGE.exec(run.s ?? '');
    if (!range) continue;

    const low = Number(range[1]);
    const high = Number(range[2] ?? range[1]);
    // A number the table has already used is the next table starting again at 1, and where it
    // starts is a harder boundary than any guess at how far the last row reaches.
    if (seen.has(low)) return { numbers, endedAt: run.y };

    for (let face = low; face <= high; face++) seen.add(face);
    numbers.push({ low, high, run });
  }

  return { numbers, endedAt: null };
}


/**
 * Whether a table sets its row numbers level with the first line of the row.
 *
 * The books do this two ways and the difference decides which lines belong to which row. The GI
 * Joe and Power Rangers CRBs centre the number against the whole row, on a baseline of its own
 * between the printed lines; the My Little Pony CRB puts it on the first line. Read as though it
 * were centred, a top-aligned three-line row gives its last line away to the row below, and
 * every row after the first comes out a line short and a line late.
 *
 * Which it is can simply be looked at: a number that shares a baseline with text is on a line.
 * It has to be MOST of them, though, not any of them - a centred number lands level with a line
 * by chance often enough that three of the GI Joe Adventurer Bonds table's twelve do, and taking
 * that for a top-aligned table shifted every row of it down by a line.
 * @param {Array<Object>} numbers   From rowNumbers().
 * @param {Array<Object>} texts
 * @returns {boolean}
 */
function isTopAligned(numbers, texts) {
  const level = numbers.filter(number =>
    texts.some(run => Math.abs(run.y - number.run.y) <= ALIGN_BAND));

  return level.length > numbers.length / 2;
}

/**
 * The row a piece of text belongs to.
 *
 * A number always sits to the LEFT of its own text, which is what stops the right-hand half of a
 * side-by-side table stealing the left-hand half's text when the two share a line exactly.
 * Vertically it depends on how the table is set (see isTopAligned): the nearest number when they
 * are centred, the lowest number at or above the line when they are not.
 * @param {Object} run
 * @param {Array<Object>} numbers   From rowNumbers().
 * @param {boolean} topAligned
 * @returns {?Object} The number's entry, or null if nothing is to its left.
 */
function rowFor(run, numbers, topAligned) {
  let best = null;
  for (const number of numbers) {
    if (number.run.x >= run.x) continue;
    if (topAligned && number.run.y < run.y - ALIGN_BAND) continue;

    const distance = topAligned ? number.run.y : Math.abs(number.run.y - run.y);
    const bestDistance = best
      ? (topAligned ? best.run.y : Math.abs(best.run.y - run.y))
      : Infinity;
    // A tie is broken by whichever number is closer along the line, which is what separates the
    // two halves of a side-by-side table where both are exactly level.
    if (distance < bestDistance || (distance === bestDistance && number.run.x > best.run.x)) {
      best = number;
    }
  }

  return best;
}

/**
 * The heading a die header belongs to.
 *
 * The nearest display-size line above it, except that a numbered title wins outright wherever
 * the book has one. Page 46 of the GI Joe CRB is why: its Athlete Bonds table has a HANG-UP
 * column heading set between the title and the die, and the nearest line alone would have
 * named the table after the column.
 * @param {Array<Object>} page
 * @param {Object} header   The die run.
 * @param {number} bodySize
 * @returns {?Object} The title run.
 */
function titleFor(page, header, bodySize, pageWidth) {
  // Same column as the die: a title sits over its own table. Without that, the Athlete Bonds
  // table takes its name from a HANG-UP heading set in the other column at the same height.
  const above = page.filter(run => run.y > header.y && run.y < header.y + HEADER_GAP
    && run.size > bodySize && Math.abs(run.x - header.x) < TITLE_REACH
    && columnOf(run, pageWidth) === columnOf(header, pageWidth))
    .sort((a, b) => b.y - a.y);

  // Adjacent lines of the same size are one title. The Power Rangers CRB wraps its titles, so
  // "TABLE 5-1.1:" and "ARTISAN ART STYLES" are printed as separate lines and each is useless
  // alone - read singly, the first of them names the table "1:".
  const blocks = [];
  for (const run of above) {
    const block = blocks[blocks.length - 1];
    const previous = block?.[block.length - 1];
    if (block && previous.size === run.size && previous.y - run.y <= TITLE_LINE) block.push(run);
    else blocks.push([run]);
  }

  const titles = blocks.map(block => ({
    text: block.map(run => run.s ?? '').join(' ').replace(/\s+/g, ' ').trim(),
    y: Math.min(...block.map(run => run.y)),
  }));

  // A numbered title wins outright wherever the book has one; otherwise the nearest line above.
  return titles.find(title => TABLE_TITLE.test(title.text)) ?? titles[0] ?? null;
}

/**
 * Read every roll table on one page.
 *
 * @param {Array<Object>} page   Runs in reading order (see buildReadingOrder).
 * @param {number} bodySize
 * @param {number} pageWidth
 * @returns {Array<{name: string, die: string, rows: Array<{low: number, high: number, text: string}>}>}
 */
export function extractRollTables(page, bodySize, pageWidth) {
  const tables = [];

  const dice = page.filter(run => DIE.test(run.s ?? ''));

  for (const header of dice) {
    // A table set across the full width of the page prints a die header over each half, and its
    // right-hand numbers sit just left of the page's midpoint while their text sits just right
    // of it - so splitting by page column loses every row in the right half. The header row is
    // what says how wide the table really is, and it is read once, from its leftmost die.
    const headers = dice
      .filter(run => Math.abs(run.y - header.y) <= HEADER_BAND)
      .sort((a, b) => a.x - b.x);
    if (headers[0] !== header) continue;

    const title = titleFor(page, header, bodySize, pageWidth);
    if (!title) continue;

    const wide = headers.length > 1;
    // The other column's prose runs through the same vertical space and has to be left out, or
    // the rows fill up with sentences.
    const within = wide
      ? page.filter(run => run.x >= headers[0].x - ROW_TAIL_MIN && run.y < title.y)
      : page.filter(run => columnOf(run, pageWidth) === columnOf(header, pageWidth)
        && run.y < title.y);

    const size = rowSize(within.filter(run => run.y < header.y - 1), bodySize);
    if (!size) continue;

    // Top-down, because both what ends the table and which row a line belongs to are decided by
    // vertical position.
    const body = within
      .filter(run => run.y < header.y - 1 && run.size === size)
      .sort((a, b) => b.y - a.y);

    const printed = Number(header.s.slice(1));
    const { numbers, endedAt } = rowNumbers(body);
    if (!numbers.length) continue;

    const texts = body.filter(run => !RANGE.test(run.s ?? ''));
    const topAligned = isTopAligned(numbers, texts);

    const parts = new Map(numbers.map(number => [number, []]));
    // Where the next table starts if one does, and otherwise a row's height below the last
    // number - the last row has its own lines below it like any other.
    const floor = endedAt !== null
      ? endedAt + 1
      : numbers[numbers.length - 1].run.y - rowTail(numbers);
    for (const run of texts) {
      // Below the last row's number is whatever the page does next, not more of this table. The
      // row size alone does not say so: the table's own last line sits below its number too, so
      // the bound is a line or two past it rather than the number itself.
      if (run.y < floor) continue;

      const row = rowFor(run, numbers, topAligned);
      if (row) parts.get(row).push(run);
    }

    const rows = numbers.map(number => ({
      low: number.low,
      high: number.high,
      // Left to right, then top to bottom - the order a wrapped row is read in.
      text: parts.get(number)
        .sort((a, b) => (Math.abs(a.y - b.y) <= 2 ? a.x - b.x : b.y - a.y))
        .map(run => run.s ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    }));

    // A number that picked up no text is not a row - it is a stray the column sweep took in.
    const complete = rows.filter(row => row.text);
    if (complete.length < MIN_ROWS) continue;

    const named = TABLE_TITLE.exec(title.text);
    tables.push({
      // The numbering is the book's own filing, not part of the table's name.
      name: (named ? named[1] : title.text).replace(/\s+/g, ' ').trim(),
      // Whichever of the two covers the rows. A table read only as far as its eighth row is
      // still a d12 if the book says so; one numbered to 20 needs a d20 whatever the book says.
      die: `d${Math.max(printed, ...numbers.map(number => number.high))}`,
      printedDie: header.s.toLowerCase(),
      // Left to right within a line put a side-by-side table's right-hand rows before the
      // left-hand ones below them, so order by what the die actually rolls.
      rows: complete.sort((a, b) => a.low - b.low),
    });
  }

  return tables;
}
