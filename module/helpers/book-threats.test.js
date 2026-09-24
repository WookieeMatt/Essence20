import {
  pageLines, hasStatBlock, startsSection, findThreatSpans, spanText, actorTypeFor, markerPages,
} from './book-threats.mjs';

/** A run as buildReadingOrder leaves one. */
const run = (s, { size = 9, startsLine = true } = {}) => ({ s, x: 63, y: 700, size, startsLine });

/** A page from its printed lines, each line's runs joined back up by pageLines. */
const page = (...lines) => lines.map(line => run(line));

/** The opening of a printed stat block, which is what a span is recognised by. */
const BLOCK = () => page('COBRA VIPER', 'THREAT LEVEL: 1', 'SIZE: Common HEALTH: 2');

describe("pageLines", () => {
  test("runs that continue a line are joined back onto it", () => {
    expect(pageLines([
      run('SIZE: Common'), run('HEALTH: 2', { startsLine: false }), run('MOVEMENT: 30ft Ground'),
    ])).toEqual(['SIZE: Common HEALTH: 2', 'MOVEMENT: 30ft Ground']);
  });

  test("blank runs do not become blank lines", () => {
    expect(pageLines([run('THREAT LEVEL: 1'), run('   ')])).toEqual(['THREAT LEVEL: 1']);
  });

  test("an empty page has no lines", () => {
    expect(pageLines([])).toEqual([]);
  });
});

describe("hasStatBlock", () => {
  test.each([
    [['COBRA VIPER', 'THREAT LEVEL: 1'], true],
    [['THREAT LEVEL: 7'], true],
    [['The threat level of a Cobra rises with its rank.'], false],
    [[], false],
  ])("%s -> %s", (lines, expected) => {
    expect(hasStatBlock(lines)).toBe(expected);
  });
});

describe("startsSection", () => {
  test("a page opening in display type starts something new", () => {
    expect(startsSection([run('HANDOUTS', { size: 22 })], 10.5)).toBe(true);
  });

  test("a page opening in body type is carrying on", () => {
    expect(startsSection([run('Unstable Mutation: When Hydro-Vipers push')], 10.5)).toBe(false);
  });

  test("an empty page starts nothing", () => {
    expect(startsSection([], 10.5)).toBe(false);
  });
});

describe("findThreatSpans", () => {
  test("one block on one page", () => {
    expect(findThreatSpans([page('prose'), BLOCK(), [run('HANDOUTS', { size: 22 })]], 10.5))
      .toEqual([{ start: 1, end: 1 }]);
  });

  // The Hydro-Viper's Powers overrun onto the next page. Cut there, the actor loses them.
  test("a block follows onto the page it overruns onto", () => {
    const orders = [BLOCK(), page('Unstable Mutation: When Hydro-Vipers push')];
    expect(findThreatSpans(orders, 10.5)).toEqual([{ start: 0, end: 1 }]);
  });

  test("blocks on consecutive pages are one span", () => {
    expect(findThreatSpans([BLOCK(), BLOCK(), BLOCK()], 10.5)).toEqual([{ start: 0, end: 2 }]);
  });

  // Otherwise the run of handouts at the back is swallowed by the threat printed before them.
  test("a span stops at a page that opens a new section", () => {
    const orders = [BLOCK(), [run('HANDOUTS', { size: 22 })], [run('more handout text')]];
    expect(findThreatSpans(orders, 10.5)).toEqual([{ start: 0, end: 0 }]);
  });

  test("a span stops at a page with nothing printed on it", () => {
    expect(findThreatSpans([BLOCK(), [], BLOCK()], 10.5))
      .toEqual([{ start: 0, end: 0 }, { start: 2, end: 2 }]);
  });

  // The S.H.A.R.C. is printed among Cold Iron's handouts, pages after the threat chapter ends.
  test("a block far away from the others is its own span", () => {
    const orders = [BLOCK(), [run('HANDOUTS', { size: 22 })], [], [], BLOCK()];
    expect(findThreatSpans(orders, 10.5)).toEqual([{ start: 0, end: 0 }, { start: 4, end: 4 }]);
  });

  test("a book with no stat blocks in it", () => {
    expect(findThreatSpans([page('prose'), page('more prose')], 10.5)).toEqual([]);
  });
});

describe("spanText", () => {
  test("reads as a paste of those pages would", () => {
    const orders = [BLOCK(), page('SKILLS', '- Athletics +d2')];
    expect(spanText(orders, { start: 0, end: 1 })).toBe([
      'COBRA VIPER', 'THREAT LEVEL: 1', 'SIZE: Common HEALTH: 2', 'SKILLS', '- Athletics +d2',
    ].join('\n'));
  });
});

describe("actorTypeFor", () => {
  // The books print an em dash for a vehicle's Smarts and Social; the parser records null.
  test("both of Smarts and Social missing means a machine", () => {
    expect(actorTypeFor({ essences: { strength: 8, speed: 18, smarts: null, social: null } }))
      .toBe('vehicle');
  });

  test("a person has all four", () => {
    expect(actorTypeFor({ essences: { strength: 2, speed: 2, smarts: 1, social: 1 } })).toBe('npc');
  });

  // One missing is a block that did not parse cleanly, not a vehicle.
  test("only one of them missing is still a person", () => {
    expect(actorTypeFor({ essences: { strength: 2, speed: 2, smarts: null, social: 1 } })).toBe('npc');
  });

  test("nothing to go on", () => {
    expect(actorTypeFor({})).toBe('npc');
  });
});

describe("markerPages", () => {
  // A span can run over six pages; saying every threat on it was printed on the first is worse
  // than saying nothing.
  test("one page per block, in the order the blocks come out", () => {
    const orders = [BLOCK(), page('SKILLS'), BLOCK(), BLOCK()];
    expect(markerPages(orders, { start: 0, end: 3 })).toEqual([0, 2, 3]);
  });

  test("two blocks printed on one page", () => {
    const orders = [page('A', 'THREAT LEVEL: 1', 'B', 'THREAT LEVEL: 2')];
    expect(markerPages(orders, { start: 0, end: 0 })).toEqual([0, 0]);
  });
});
