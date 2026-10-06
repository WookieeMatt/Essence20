import {
  flattenOutline, findTitle, readSections, buildJournalEntries, isMapEntry, mapSections,
  findColumnLefts, buildBlocks,
} from './book-journal.mjs';

const run = (s) => ({ s, x: 63, y: 700, size: 10.5 });

/** A page as buildReadingOrder leaves it: runs already in reading order. */
const page = (...texts) => texts.map(run);

describe("flattenOutline", () => {
  test("keeps document order and records depth", () => {
    const outline = [
      { title: 'Mission 1', page: 8, items: [
        { title: 'Part 1', page: 10, items: [{ title: 'Briefing', page: 11 }] },
        { title: 'Part 2', page: 12 },
      ] },
      { title: 'Mission 2', page: 28 },
    ];

    expect(flattenOutline(outline)).toEqual([
      { title: 'Mission 1', page: 8, depth: 0 },
      { title: 'Part 1', page: 10, depth: 1 },
      { title: 'Briefing', page: 11, depth: 2 },
      { title: 'Part 2', page: 12, depth: 1 },
      { title: 'Mission 2', page: 28, depth: 0 },
    ]);
  });

  // Outline titles carry the line breaks of the printed heading.
  test("collapses the whitespace an outline title carries", () => {
    expect(flattenOutline([{ title: 'Part 1: \nRolling Brief', page: 5 }])[0].title)
      .toBe('Part 1: Rolling Brief');
  });

  test("an absent outline yields nothing", () => {
    expect(flattenOutline(undefined)).toEqual([]);
  });
});

describe("findTitle", () => {
  test("finds a title that is one run", () => {
    expect(findTitle(page('Intro', 'Sit Rep', 'Some prose.'), 'Sit Rep')).toEqual({ start: 1, end: 1 });
  });

  // The end matters as much as the start: a title matched but only partly consumed leaves its own
  // tail at the front of the section's text ("into My Campaign? While it is not necessary...").
  test("reports the last run of a title that wrapped", () => {
    const p = page('How Do I Put This Adventure', 'into My Campaign?', 'While it is not necessary...');
    expect(findTitle(p, 'How Do I Put This Adventure into My Campaign?')).toEqual({ start: 0, end: 1 });
  });

  test("returns null when the title is not on the page", () => {
    expect(findTitle(page('Something else'), 'Sit Rep')).toBeNull();
  });

  test("can be told to start looking past an earlier match", () => {
    const p = page('Rewards', 'first', 'Rewards', 'second');
    expect(findTitle(p, 'Rewards', 1)).toEqual({ start: 2, end: 2 });
  });
});

describe("readSections", () => {
  // A destination only resolves to a page - Cold Iron records every one at the top of the sheet -
  // so sections sharing a page all point at the same place and must be split at their headings.
  test("splits two sections that share a page", () => {
    const orders = [page('Summary', 'The summary text.', 'Overview', 'The overview text.')];
    const sections = readSections([
      { title: 'Summary', page: 0, depth: 1 },
      { title: 'Overview', page: 0, depth: 1 },
    ], orders);

    expect(sections.map(s => s.text)).toEqual(['The summary text.', 'The overview text.']);
  });

  test("a section runs on across pages until the next one starts", () => {
    const orders = [page('Part 1', 'starts here'), page('and continues'), page('Part 2', 'later')];
    const sections = readSections([
      { title: 'Part 1', page: 0, depth: 0 },
      { title: 'Part 2', page: 2, depth: 0 },
    ], orders);

    expect(sections[0].text).toBe('starts here and continues');
    expect(sections[1].text).toBe('later');
  });

  test("the heading itself is not part of the text", () => {
    const orders = [page('Sit Rep', 'The briefing.')];
    expect(readSections([{ title: 'Sit Rep', page: 0, depth: 1 }], orders)[0].text).toBe('The briefing.');
  });

  // Its destination pointed at the top of the page, so that is where it starts.
  test("a section whose heading cannot be found starts at the top of its page", () => {
    const orders = [page('Some prose with no heading.')];
    expect(readSections([{ title: 'Missing Heading', page: 0, depth: 1 }], orders)[0].text)
      .toBe('Some prose with no heading.');
  });
});

describe("isMapEntry / mapSections", () => {
  test.each([
    ['MAP: Dallol Testing Site', true],
    ['MAP: Area 4, Floor 1', true],
    ['Sit Rep', false],
  ])("%s -> %s", (title, expected) => {
    expect(isMapEntry(title)).toBe(expected);
  });

  test("map sections come back named and paged, without the prefix", () => {
    const sections = [
      { title: 'MAP: Dallol Testing Site', page: 21, depth: 2, isMap: true, text: '' },
      { title: 'Sit Rep', page: 9, depth: 1, isMap: false, text: 'x' },
    ];
    expect(mapSections(sections)).toEqual([{ title: 'Dallol Testing Site', page: 21 }]);
  });
});

describe("buildJournalEntries", () => {
  const section = (title, depth, text, isMap = false) => ({ title, depth, text, isMap, page: 0 });

  test("one entry per top-level section, with a page for each one beneath it", () => {
    const entries = buildJournalEntries([
      section('Mission 1', 0, 'Mission intro.'),
      section('Part 1', 1, 'Part one.'),
      section('Briefing', 2, 'The briefing.'),
      section('Mission 2', 0, 'Second mission.'),
    ]);

    expect(entries).toHaveLength(2);
    expect(entries[0].name).toBe('Mission 1');
    expect(entries[0].pages.map(p => p.name)).toEqual(['Mission 1', 'Part 1', 'Briefing']);
    expect(entries[1].pages.map(p => p.name)).toEqual(['Mission 2']);
  });

  // An adventure's third level is individual rooms, which is exactly what a GM wants to open on
  // its own at the table - so depth is kept rather than folded away.
  test("keeps the depth of each page", () => {
    const entries = buildJournalEntries([section('Mission 1', 0, 'x'), section('Area 3', 2, 'y')]);
    expect(entries[0].pages.map(p => p.depth)).toEqual([0, 2]);
  });

  test("leaves out the book's own front matter", () => {
    const entries = buildJournalEntries([
      section('Table of Contents', 0, 'listing'),
      section('Credits', 0, 'names'),
      section('Mission 1', 0, 'real content'),
    ]);

    expect(entries.map(e => e.name)).toEqual(['Mission 1']);
  });

  // A MAP: entry points at an image; it belongs to a Scene, not a page of text.
  test("leaves out map entries", () => {
    const entries = buildJournalEntries([
      section('Mission 1', 0, 'intro'),
      section('MAP: Dallol Testing Site', 2, 'caption', true),
    ]);

    expect(entries[0].pages.map(p => p.name)).toEqual(['Mission 1']);
  });

  test("a section with no text contributes no page", () => {
    const entries = buildJournalEntries([section('Mission 1', 0, 'intro'), section('Empty', 1, '')]);
    expect(entries[0].pages).toHaveLength(1);
  });

  test("an entry that ends up with no pages at all is dropped", () => {
    expect(buildJournalEntries([section('Mission 1', 0, '')])).toEqual([]);
  });
});

/** A line as buildReadingOrder leaves one: startsLine set, and alone when nothing shares its y. */
const line = (s, x = 63, size = 10.5, alone = true) => ({ s, x, y: 700, size, startsLine: true, alone });

describe("findColumnLefts", () => {
  // The whole point: x=63 and x=72 are BOTH common in a page of prose, and only the relative
  // frequency over a whole book says which is the column and which the paragraph indent.
  test("separates a column edge from the paragraph indent inside it", () => {
    const body = [];
    for (let i = 0; i < 50; i++) body.push(line("continuation", 63), line("continuation", 315));
    for (let i = 0; i < 6; i++) body.push(line("A new paragraph", 72), line("A new paragraph", 324));

    expect(findColumnLefts([body])).toEqual([63, 315]);
  });

  test("a one-column book yields one edge", () => {
    const body = [];
    for (let i = 0; i < 40; i++) body.push(line("prose", 90));
    expect(findColumnLefts([body])).toEqual([90]);
  });

  test("no pages, no columns", () => {
    expect(findColumnLefts([])).toEqual([]);
  });
});

describe("buildBlocks", () => {
  const LEFTS = [63, 315];

  test("an indented line starts a new paragraph", () => {
    const blocks = buildBlocks([
      line("The first paragraph", 72), line("runs on to here.", 63),
      line("The second one", 72), line("also runs on.", 63),
    ], LEFTS, 10.5);

    expect(blocks).toEqual([
      { type: "p", text: "The first paragraph runs on to here." },
      { type: "p", text: "The second one also runs on." },
    ]);
  });

  // Each column indents from its OWN edge - x=324 is an indent, not a column start.
  test("the indent is measured from the run's own column", () => {
    const blocks = buildBlocks([
      line("Column one prose", 63), line("A new paragraph", 324), line("running on.", 315),
    ], LEFTS, 10.5);

    expect(blocks.map(b => b.text)).toEqual(["Column one prose", "A new paragraph running on."]);
  });

  test("a line set larger than the body, alone, is a heading", () => {
    const blocks = buildBlocks([
      line("Some prose.", 63), line("MAIN GATE", 63, 13), line("The guards were on duty.", 63),
    ], LEFTS, 10.5);

    expect(blocks).toEqual([
      { type: "p", text: "Some prose." },
      { type: "heading", text: "MAIN GATE" },
      { type: "p", text: "The guards were on duty." },
    ]);
  });

  // Large type sharing its line with body text is a run-in label, not a heading of its own.
  test("large type that is not alone on its line is left in the paragraph", () => {
    const blocks = buildBlocks([
      line("Some prose", 63, 10.5, false),
      { s: "LOUD", x: 200, y: 700, size: 13, startsLine: false, alone: false },
    ], LEFTS, 10.5);

    expect(blocks).toEqual([{ type: "p", text: "Some prose LOUD" }]);
  });

  test("a hundred characters of large type is display prose, not a heading", () => {
    const long = "Pull quotes are set large and run on for far longer than any heading would, "
      + "which is how you tell the two apart.";
    expect(buildBlocks([line(long, 63, 16)], LEFTS, 10.5)).toEqual([{ type: "p", text: long }]);
  });

  test("nothing in, nothing out", () => {
    expect(buildBlocks([], LEFTS, 10.5)).toEqual([]);
  });
});

describe("readSections blocks", () => {
  // The description importer asks for text only and has no body size to hand, so a section
  // stays one paragraph rather than being carved up by a measurement nobody supplied.
  test("without a body size a section is one paragraph", () => {
    const orders = [[line("Sit Rep"), line("A paragraph", 72), line("and another", 72)]];
    const [section] = readSections([{ title: "Sit Rep", page: 0, depth: 1 }], orders);

    expect(section.blocks).toEqual([{ type: "p", text: "A paragraph and another" }]);
  });

  test("with a body size the section is broken up", () => {
    const body = [line("Sit Rep")];
    for (let i = 0; i < 40; i++) body.push(line("continuing", 63));
    body.push(line("A new paragraph", 72));

    const [section] = readSections([{ title: "Sit Rep", page: 0, depth: 1 }], [body], 10.5);
    expect(section.blocks).toHaveLength(2);
    expect(section.blocks[1].text).toBe("A new paragraph");
  });
});

describe("buildBlocks indentation", () => {
  const LEFTS = [63, 315];

  // Measured against the column, every line of an indented bulleted block looked like a new
  // paragraph - sixteen lines of Operation: Snakebit's debrief became sixteen paragraphs.
  test("an indented block that stays level is one paragraph", () => {
    const blocks = buildBlocks([
      line("Ordinary prose.", 63),
      line("A set-in block", 80), line("that stays", 80), line("level.", 80),
    ], LEFTS, 10.5);

    expect(blocks.map(b => b.text)).toEqual(["Ordinary prose.", "A set-in block that stays level."]);
  });

  test("coming back out to the margin does not start a paragraph", () => {
    const blocks = buildBlocks([line("A set-in line", 80), line("back at the margin", 63)], LEFTS, 10.5);
    expect(blocks).toHaveLength(1);
  });

  test("each bullet is its own paragraph however it is set", () => {
    const blocks = buildBlocks([
      line("\u2022 The first point", 80), line("wraps to here.", 80),
      line("\u2022 The second point.", 80),
    ], LEFTS, 10.5);

    expect(blocks.map(b => b.text)).toEqual([
      "\u2022 The first point wraps to here.", "\u2022 The second point.",
    ]);
  });

  // A paragraph running from the foot of one column to the head of the next must not be cut in
  // two by the 250pt jump in x, which is the only reason the column edges are needed at all.
  // A bullet hangs OUT and its text runs IN, so measuring against the line before split every
  // bullet from its own second line. A bullet block takes its level from that second line.
  test("a bullet keeps the lines that hang in from it", () => {
    const blocks = buildBlocks([
      line("Ordinary prose.", 63),
      line("• The first point", 72), line("hangs in to here", 80), line("and ends.", 80),
      line("• The second point", 72), line("also hangs in.", 80),
      line("Prose after the list.", 63),
    ], LEFTS, 10.5);

    expect(blocks.map(b => b.text)).toEqual([
      "Ordinary prose.",
      "• The first point hangs in to here and ends.",
      "• The second point also hangs in.",
      "Prose after the list.",
    ]);
  });

  test("a paragraph is not split at a column break", () => {
    const blocks = buildBlocks([line("The end of column one", 63), line("and the top of two.", 315)], LEFTS, 10.5);
    expect(blocks).toEqual([{ type: "p", text: "The end of column one and the top of two." }]);
  });
});
