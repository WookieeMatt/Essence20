import { extractRollTables } from './book-tables.mjs';

// Runs as pdf.js reports them, on a 612pt page. The tables sit in the right-hand column, which
// is where the books usually put them, with prose running down the left.
const run = (s, x, y, size) => ({ s, x, y, size });

const BODY = 10.5;
const ROW = 8.5;

/** A table in the right column: title, a die header, then numbered rows. */
function tablePage({ title = 'TABLE 5-4.1: ATHLETIC PURSUITS', die = 'D12', rows = [], prose = true } = {}) {
  const runs = [run(title, 321, 675, 16), run(die, 321, 657, BODY), run('STYLE', 380, 657, BODY)];
  rows.forEach((cells, i) => {
    const y = 642 - (i * 15);
    let x = 321;
    for (const cell of cells) {
      runs.push(run(cell, x, y, ROW));
      x += 60;
    }
  });

  // Prose in the other column, running through the same vertical space - the thing most likely
  // to end up inside a row if the column split is not respected.
  if (prose) {
    for (let i = 0; i < 8; i++) {
      runs.push(run('a line of ordinary body prose in the other column', 63, 672 - (i * 12), BODY));
    }
  }

  return runs;
}

describe("extractRollTables", () => {
  test("reads a plain table: name, die and rows", () => {
    const page = tablePage({ rows: [['1', 'American Football'], ['2', 'Baseball'], ['3', 'Basketball']] });
    const [table] = extractRollTables(page, BODY, 612);

    expect(table).toMatchObject({ name: 'ATHLETIC PURSUITS', die: 'd12' });
    expect(table.rows).toEqual([
      { low: 1, high: 1, text: 'American Football' },
      { low: 2, high: 2, text: 'Baseball' },
      { low: 3, high: 3, text: 'Basketball' },
    ]);
  });

  // These tables are often set as two pairs of columns side by side, 1-6 on the left and 7-12 on
  // the right, so one line reads "1 Acting 7 Music" - two entries, not one called "Acting 7 Music".
  test("splits a line holding two side-by-side entries", () => {
    const page = tablePage({ rows: [['1', 'Acting', '7', 'Music'], ['2', 'Architecture', '8', 'Painting']] });
    const [table] = extractRollTables(page, BODY, 612);

    expect(table.rows).toEqual([
      { low: 1, high: 1, text: 'Acting' },
      { low: 2, high: 2, text: 'Architecture' },
      { low: 7, high: 7, text: 'Music' },
      { low: 8, high: 8, text: 'Painting' },
    ]);
  });

  test("keeps rows in the order the die rolls them, not the order they are printed", () => {
    const page = tablePage({ rows: [['1', 'First', '7', 'Seventh']] });
    expect(extractRollTables(page, BODY, 612)[0].rows.map(r => r.low)).toEqual([1, 7]);
  });

  test("reads a span written with a dash", () => {
    const page = tablePage({ rows: [['1', 'Low'], ['2-4', 'Middle'], ['5', 'High']] });
    expect(extractRollTables(page, BODY, 612)[0].rows[1]).toEqual({ low: 2, high: 4, text: 'Middle' });
  });

  test("leaves the other column's prose out of the rows", () => {
    const page = tablePage({ rows: [['1', 'American Football'], ['2', 'Baseball']] });
    expect(extractRollTables(page, BODY, 612)[0].rows.map(row => row.text))
      .toEqual(['American Football', 'Baseball']);
  });

  // Most "TABLE n:" blocks in these books are reference charts, not roll tables - ROLE CALL,
  // the Role progression charts, the Focus charts. 58 of the GI Joe CRB's 77 have no die at all,
  // and none of them should become a RollTable.
  test("ignores a table with no die - a reference chart, not something to roll on", () => {
    const page = [
      run('TABLE 5-1: ROLE CALL', 321, 675, 16),
      run('ROLE', 321, 657, BODY), run('DESCRIPTION', 380, 657, BODY),
      run('Commando', 321, 642, ROW), run('Shadow operative', 380, 642, ROW),
    ];
    expect(extractRollTables(page, BODY, 612)).toEqual([]);
  });

  // A book that numbers its tables is filing them, not naming them.
  test("strips the numbering from a title that has it", () => {
    const page = tablePage({
      title: 'TABLE 5-4.1: ATHLETIC PURSUITS', rows: [['1', 'Baseball'], ['2', 'Boxing']],
    });
    expect(extractRollTables(page, BODY, 612)[0].name).toBe('ATHLETIC PURSUITS');
  });

  // "TABLE OF CONTENTS" is set at 38pt on page 5 of every book, over a list of numbers. What
  // keeps it out is that a contents page has no die on it.
  test("ignores a contents page", () => {
    const page = [
      run('TABLE OF CONTENTS', 321, 675, 38),
      run('1', 321, 642, ROW), run('Welcome', 380, 642, ROW),
      run('2', 321, 627, ROW), run('Character Creation', 380, 627, ROW),
    ];
    expect(extractRollTables(page, BODY, 612)).toEqual([]);
  });

  test("stops at the first line that does not begin with a number", () => {
    const page = tablePage({
      rows: [['1', 'American Football'], ['2', 'Baseball'], ['Some following prose heading', '']],
    });
    expect(extractRollTables(page, BODY, 612)[0].rows).toHaveLength(2);
  });

  // The GI Joe CRB heads its Martial Arts Specialty table "D12" over rows numbered 1 to 20.
  // Honouring the header there left five rows of nonsense: the rows are the table, the die is a
  // label on it.
  test("widens the die when the rows run past what the header says", () => {
    const rows = Array.from({ length: 20 }, (unused, i) => [String(i + 1), `Entry ${i + 1}`]);
    const [table] = extractRollTables(tablePage({ die: 'D12', rows }), BODY, 612);

    expect(table.rows).toHaveLength(20);
    expect(table).toMatchObject({ die: 'd20', printedDie: 'd12' });
  });

  // The next table down the page starts again at 1, which is how this one knows it has ended.
  test("stops at a number the table has already used", () => {
    const rows = [['1', 'American Football'], ['2', 'Baseball'], ['1', 'Acting'], ['2', 'Dance']];
    const [table] = extractRollTables(tablePage({ rows }), BODY, 612);

    expect(table.rows).toEqual([
      { low: 1, high: 1, text: 'American Football' },
      { low: 2, high: 2, text: 'Baseball' },
    ]);
  });

  test("a number with no text beside it is not a row", () => {
    const page = tablePage({ rows: [['1', 'American Football'], ['2', 'Baseball'], ['3', '']] });
    expect(extractRollTables(page, BODY, 612)[0].rows).toEqual([
      { low: 1, high: 1, text: 'American Football' },
      { low: 2, high: 2, text: 'Baseball' },
    ]);
  });

  // Found by the die now, so a stray one in prose with a heading above it could otherwise make
  // a table out of a single coincidental number.
  test("one row is not a table", () => {
    const page = tablePage({ rows: [['1', 'American Football']] });
    expect(extractRollTables(page, BODY, 612)).toEqual([]);
  });

  // The My Little Pony CRB numbers none of its tables; it just heads them.
  test("reads a table whose title carries no number", () => {
    const page = tablePage({
      title: 'BACKGROUND BONDS', rows: [['1', 'A bond'], ['2', 'Another bond']],
    });
    expect(extractRollTables(page, BODY, 612)[0]).toMatchObject({ name: 'BACKGROUND BONDS' });
  });
});
