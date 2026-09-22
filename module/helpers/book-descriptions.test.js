import {
  NARRATIVE_TYPES, normalizeBookTitle, nameKey, itemKeys, headingKeys, findWatermark,
  findBodyFontSize, findTextFloor, calibrateFolioOffset, buildReadingOrder, extractEntry,
  findEntry, mapSymbolGlyphs, pluralKeys, findFurnitureBands, findBodyFonts,
} from './book-descriptions.mjs';

// A stand-in page built the way pdf.js reports one: a flat list of positioned runs, y growing
// upward, in no particular order. 612pt wide, matching the actual books.
const run = (s, { x = 63, y = 700, size = 10.5 } = {}) => ({ s, x, y, size });

const WATERMARK = 'Downloded by Justin Franklin on 4/3/2022 . Unathorized distribution prohibited.';

/** A page of two columns with the standard footer furniture underneath. */
function page({ left = [], right = [], folio = null } = {}) {
  const runs = [];
  // The column x is forced, not defaulted: run() already sets one, so `r.x ?? 321` would never
  // have applied and the right column would sit on top of the left.
  left.forEach((r, i) => runs.push({ ...r, x: 63, y: 700 - (i * 13) }));
  right.forEach((r, i) => runs.push({ ...r, x: 321, y: 700 - (i * 13) }));
  runs.push(run('G.I. JOE ROLEPLAYING GAME- CHAPTER 05: ROLES', { x: 98, y: 19, size: 15 }));
  if (folio !== null) runs.push(run(String(folio), { x: 32, y: 29, size: 18 }));
  runs.push(run(WATERMARK, { x: 15, y: 40, size: 15 }));
  return runs;
}

describe("nameKey", () => {
  // The PDFs kern headings per glyph pair, so pdf.js reports Sneak Attack as "SNEAK AT TACK".
  test("ignores whitespace, case and punctuation", () => {
    expect(nameKey('SNEAK AT TACK')).toBe(nameKey('Sneak Attack'));
    expect(nameKey('YOU’RE AN EXPERT')).toBe(nameKey("You're an Expert"));
  });

  test("does not conflate different names", () => {
    expect(nameKey('Sneak Attack')).not.toBe(nameKey('Sneak'));
  });
});

describe("itemKeys", () => {
  test("offers the bare name when the compendium qualifies it and the book does not", () => {
    expect(itemKeys('Adapted Vehicle (Environmental)')).toEqual(['adaptedvehicleenvironmental', 'adaptedvehicle']);
  });

  test("an unqualified name yields one key", () => {
    expect(itemKeys('Mobility')).toEqual(['mobility']);
  });
});

describe("headingKeys", () => {
  // "COVERT OPS ORIGIN" / "ORIGIN BENEFIT: ALWAYS IN CONTACT" - the books label what an entry is
  // on either side of its name, and every origin in the GI Joe CRB missed before this.
  test("strips a trailing type word", () => {
    expect([...headingKeys('COVERT OPS ORIGIN', 'origin')]).toContain(nameKey('Covert Ops'));
  });

  test("strips a leading label", () => {
    expect([...headingKeys('ORIGIN BENEFIT: ALWAYS IN CONTACT', 'perk')]).toContain(nameKey('Always in Contact'));
  });

  // The My Little Pony CRB heads every spell with its school - "ADAPT (ENCHANTMENT)" for the
  // item named "Adapt". 27 of that book's 28 spells were missed for want of this.
  test("strips a qualifier the heading carries and the item name does not", () => {
    expect([...headingKeys('ADAPT (ENCHANTMENT)', 'spell')]).toContain(nameKey('Adapt'));
  });

  test("only strips the trailing word when it is the type being looked for", () => {
    // Without the type check this would also offer "sneak", and a "Sneak" perk would swallow it.
    expect([...headingKeys('SNEAK ATTACK', 'perk')]).not.toContain('sneak');
  });
});

describe("normalizeBookTitle", () => {
  test.each([
    ['Transfomers Core Rulebook', 'Transformers Core Rulebook'],
    ['Transformers Core Ruelbook', 'Transformers Core Rulebook'],
    ['Gi Joe Core Rulebook', 'GI Joe Core Rulebook'],
  ])("corrects %s", (input, expected) => {
    expect(normalizeBookTitle(input)).toBe(expected);
  });

  test("leaves a title it does not know alone", () => {
    expect(normalizeBookTitle('  Cobra  Codex ')).toBe('Cobra Codex');
  });
});

describe("findWatermark", () => {
  test("reads the purchaser and date off a stamped book", () => {
    expect(findWatermark([page({ left: [run('anything')], folio: 1 })])).toMatchObject({
      purchaser: 'Justin Franklin', date: '4/3/2022',
    });
  });

  test("matches the corrected spelling used by later printings", () => {
    const later = [[run('Downloaded by A Person on 1/29/2025 . Unauthorized distribution prohibited.')]];
    expect(findWatermark(later)).toMatchObject({ purchaser: 'A Person', date: '1/29/2025' });
  });

  // The MLP Core Rulebook and Field Guide carry none, which is exactly why this is attestation
  // and not a gate - returning null has to be an ordinary outcome, not a failure.
  test("returns null for a book with no watermark", () => {
    expect(findWatermark([[run('Just some text')]])).toBeNull();
  });
});

describe("findBodyFontSize / findTextFloor", () => {
  // Real-length body lines: the measure weighs characters, so single letters would be
  // outweighed by the watermark that every page carries.
  const pages = [page({
    left: [
      run('You live for the roar of the crowd and the exhilaration'),
      run('of a game well played. Whether you were college or pro,'),
      run('your athletic career dovetailed into work for the Joes.'),
    ],
    folio: 1,
  })];

  test("body size is the most common size, not the largest", () => {
    expect(findBodyFontSize(pages)).toBe(10.5);
  });

  // Measured in characters, not runs. A book with big stat tables has far more short size-9
  // runs than long size-10.5 ones; counting runs picks the table and everything downstream
  // breaks, because a body size one step too small makes every line of prose look like a
  // heading.
  test("a size with many short runs loses to the one holding more text", () => {
    const table = Array.from({ length: 40 }, () => run('x', { size: 9 }));
    const prose = Array.from({ length: 10 }, () => run('a fairly long line of body prose here'));
    expect(findBodyFontSize([[...table, ...prose]])).toBe(10.5);
  });

  // The counter-intuitive one: header (15), folio (18) and watermark (15) are all set LARGER
  // than the 10.5 body, so only position separates them.
  test("the text floor sits above the footer furniture", () => {
    const floor = findTextFloor(pages, 10.5);
    expect(floor).toBeGreaterThan(40);
    expect(floor).toBeLessThan(674);
  });
});

describe("calibrateFolioOffset", () => {
  test("derives the offset between PDF index and printed page", () => {
    // Three PDF pages printing 1, 2, 3 - i.e. one page of front matter ahead of the folios.
    const pages = [page({ folio: 0 }), page({ folio: 1 }), page({ folio: 2 })];
    expect(calibrateFolioOffset(pages, 60)).toMatchObject({ offset: 1, agreement: 3, samples: 3 });
  });

  test("a stray reading loses to the majority", () => {
    const pages = [page({ folio: 0 }), page({ folio: 1 }), page({ folio: 99 })];
    expect(calibrateFolioOffset(pages, 60).offset).toBe(1);
  });
});

describe("findFurnitureBands", () => {
  // A running head at the TOP of the page, which findTextFloor cannot see - the My Little Pony
  // CRB puts one there, and an entry carrying on overleaf resumes right into it.
  const withHead = (bodyText) => [
    { s: 'MY LITTLE PONY ROLEPLAYING GAME', x: 63, y: 737, size: 17.1 },
    { s: bodyText, x: 63, y: 600, size: 10.5 },
  ];

  test("finds a head that repeats at the same height on most pages", () => {
    const pages = [withHead('one'), withHead('two'), withHead('three'), withHead('four')];
    // The band is keyed by a rounded y, so assert that one was found rather than its key.
    expect(findFurnitureBands(pages, 10.5).size).toBe(1);
  });

  test("body-sized runs are never furniture, however repetitive", () => {
    // Otherwise a book with a standing line of prose could lose it.
    const pages = Array.from({ length: 5 }, () => [{ s: 'Same line', x: 63, y: 600, size: 10.5 }]);
    expect(findFurnitureBands(pages, 10.5).size).toBe(0);
  });

  // The discriminator that matters: a chapter of headings can sit at a constant height too,
  // but says something different every time.
  test("headings at a constant height are not mistaken for a running head", () => {
    const pages = Array.from({ length: 10 }, (unused, i) => [
      { s: `UNIQUE HEADING ${i}`, x: 63, y: 700, size: 22 },
      { s: 'body', x: 63, y: 600, size: 10.5 },
    ]);
    expect(findFurnitureBands(pages, 10.5).has(700)).toBe(false);
  });

  test("something appearing on only a few pages is not furniture", () => {
    const pages = [
      [{ s: 'RARE', x: 63, y: 737, size: 17.1 }],
      [{ s: 'body', x: 63, y: 600, size: 10.5 }],
      [{ s: 'body', x: 63, y: 600, size: 10.5 }],
      [{ s: 'body', x: 63, y: 600, size: 10.5 }],
    ];
    expect(findFurnitureBands(pages, 10.5).has(736)).toBe(false);
  });
});

describe("buildReadingOrder", () => {
  test("reads the left column top-down, then the right, and drops the furniture", () => {
    const runs = page({
      left: [run('LEFT ONE'), run('left two')],
      right: [run('RIGHT ONE'), run('right two')],
      folio: 71,
    });

    const order = buildReadingOrder(runs, 612, 60).map(r => r.s);
    expect(order).toEqual(['LEFT ONE', 'left two', 'RIGHT ONE', 'right two']);
  });

  test("drops runs sitting in a furniture band", () => {
    const runs = [
      { s: 'MY LITTLE PONY ROLEPLAYING GAME', x: 63, y: 737, size: 17.1 },
      { s: 'real text', x: 63, y: 600, size: 10.5 },
    ];

    // Bands come from the finder rather than a literal, so the two stay in step whatever
    // rounding the finder uses.
    const furniture = findFurnitureBands([runs, runs, runs, runs], 10.5);
    const order = buildReadingOrder(runs, 612, 60, furniture).map(r => r.s);
    expect(order).toEqual(['real text']);
  });
});

describe("mapSymbolGlyphs", () => {
  // These books draw their shift arrows from a symbol font, which carries no Unicode mapping,
  // so pdf.js reports the raw private-use codepoint and a sheet renders an empty box. Each
  // mapping was read off the books themselves; all four appear in the GI Joe, Power Rangers and
  // My Little Pony core rulebooks alike.
  test.each([
    ['\uF0E1', '\u2191', 'upshift'],
    ['\uF0E2', '\u2193', 'downshift'],
    ['\uF0E0', '\u2192', 'the dice progression arrow'],
    ['\uF06E', '\u25A0', 'a legend bullet'],
    // A different symbol font, and the book states the meaning itself rather than implying it:
    // "An Upshift ( [F068] ) or Downshift ( [F069] )".
    ['\uF068', '\u2191', 'upshift, Welcome to Night Vale'],
    ['\uF069', '\u2193', 'downshift, Welcome to Night Vale'],
  ])("maps %s to %s (%s)", (from, to) => {
    expect(mapSymbolGlyphs(`a ${from} b`)).toBe(`a ${to} b`);
  });

  test("lands on the same arrows the rest of the system uses for a shift", () => {
    // So imported text reads identically to text written by hand - see lang/en.json.
    expect(mapSymbolGlyphs('\uF0E1')).toBe('\u2191');
    expect(mapSymbolGlyphs('\uF0E2')).toBe('\u2193');
  });

  test("leaves an unidentified private-use glyph alone rather than dropping it", () => {
    // Dropping it would quietly change what a rule says; left in, it shows up in the
    // importer's preview where a GM can see it.
    expect(mapSymbolGlyphs('a \uF0FF b')).toBe('a \uF0FF b');
  });

  test("leaves ordinary text untouched", () => {
    expect(mapSymbolGlyphs('Choose two skills.')).toBe('Choose two skills.');
  });
});

describe("extractEntry", () => {
  const bodySize = 10.5;
  const order = (p) => buildReadingOrder(p, 612, 60);

  test("takes a display heading's body and stops at the next heading", () => {
    const p = page({
      right: [
        run('SNEAK AT TACK', { size: 22 }),
        run('Once per turn, when using a silent weapon'),
        run('you deal extra damage.'),
        run('FRIEND OF DARKNESS', { size: 22 }),
        run('You can see in darkness.'),
      ],
      folio: 71,
    });

    expect(extractEntry([order(p)], 0, 'Sneak Attack', bodySize, 'perk')).toMatchObject({
      kind: 'heading',
      text: 'Once per turn, when using a silent weapon you deal extra damage.',
    });
  });

  // Roughly one perk in six is written this way rather than as a display heading, and a
  // heading-only matcher misses every one of them.
  test("takes a run-in label's body and stops at the next label", () => {
    const p = page({
      right: [
        run('Environment Choice:'),
        run('Choose two additional environments.'),
        run('Armor Training:'),
        run('You gain training in heavy armor.'),
      ],
      folio: 90,
    });

    expect(extractEntry([order(p)], 0, 'Environment Choice', bodySize, 'perk')).toMatchObject({
      kind: 'label',
      text: 'Choose two additional environments.',
    });
  });

  test("a bare name without its colon does not start an entry", () => {
    // Otherwise any sentence opening with the name would be mistaken for its definition.
    const p = page({ right: [run('Environment Choice'), run('is mentioned in passing here.')], folio: 90 });
    expect(extractEntry([order(p)], 0, 'Environment Choice', bodySize, 'perk')).toBeNull();
  });

  test("rejoins a word broken across lines", () => {
    const p = page({ right: [run('MOBILITY', { size: 22 }), run('Choose two addi-'), run('tional moves.')], folio: 1 });
    expect(extractEntry([order(p)], 0, 'Mobility', bodySize, 'perk').text).toBe('Choose two additional moves.');
  });

  // These PDFs often set the break hyphen as a run of its own, which left a space where the
  // hyphen had been: "an aggres sive and brash approach".
  test("rejoins a word whose hyphen is a separate run", () => {
    const p = page({
      right: [run('MOBILITY', { size: 22 }), run('an aggres'), run('-'), run('sive approach.')],
      folio: 1,
    });

    expect(extractEntry([order(p)], 0, 'Mobility', bodySize, 'perk').text).toBe('an aggressive approach.');
  });

  test("carries on to the next page when the entry runs off this one", () => {
    const first = page({ right: [run('MOBILITY', { size: 22 }), run('You move well')], folio: 1 });
    const second = page({ left: [run('and quickly.'), run('NEXT THING', { size: 22 }), run('Other text.')], folio: 2 });

    const found = extractEntry([order(first), order(second)], 0, 'Mobility', bodySize, 'perk');
    expect(found).toMatchObject({ continued: true, text: 'You move well and quickly.' });
  });

  test("turns a shift arrow into a real character, attached to its number", () => {
    // The arrow is drawn as its own run, so a naive join reads "gain a  1 dice shift".
    const p = page({
      right: [
        run('MOBILITY', { size: 22 }),
        run('You may gain a'),
        run('\uF0E1'),
        run('1 dice shift.'),
      ],
      folio: 1,
    });

    expect(extractEntry([order(p)], 0, 'Mobility', bodySize, 'perk').text)
      .toBe('You may gain a \u21911 dice shift.');
  });

  // The General Perks chapter is set in a narrower column, so its headings wrap far more often
  // than elsewhere - a fifth of them went undescribed before this.
  test("matches a heading that wrapped onto a second line", () => {
    const p = page({
      right: [run('BATTLE-', { size: 26 }), run('HARDENED', { size: 26 }), run('You shrug off hits.')],
      folio: 129,
    });

    expect(extractEntry([order(p)], 0, 'Battle Hardened', bodySize, 'perk')).toMatchObject({
      kind: 'heading',
      text: 'You shrug off hits.',
    });
  });

  test("matches a wrapped heading with no hyphen at the break", () => {
    const p = page({
      right: [run("SHARPSHOOTER'S", { size: 26 }), run('GRACE', { size: 26 }), run('You aim well.')],
      folio: 132,
    });

    expect(extractEntry([order(p)], 0, "Sharpshooter's Grace", bodySize, 'perk').text)
      .toBe('You aim well.');
  });

  test("does not join across a change of size when looking for a wrapped heading", () => {
    // "BATTLE-" followed by body text is not a two-line heading, and joining them would start
    // the entry in the wrong place.
    const p = page({
      right: [run('BATTLE-', { size: 26 }), run('HARDENED')],
      folio: 129,
    });

    expect(extractEntry([order(p)], 0, 'Battle Hardened', bodySize, 'perk')).toBeNull();
  });

  // The GI Joe CRB writes two Ranger abilities as "Lookout: (environmental)", putting the colon
  // before the qualifier rather than after it. Requiring it last left both undescribed.
  test("matches a label whose colon is not the last thing on the line", () => {
    const p = page({
      right: [
        run('Lookout: (environmental)'),
        run('You spot trouble early.'),
        run('Tracker: (environmental)'),
        run('You follow a trail.'),
      ],
      folio: 90,
    });

    expect(extractEntry([order(p)], 0, 'Lookout (Environmental)', bodySize, 'perk')).toMatchObject({
      kind: 'label',
      text: 'You spot trouble early.',
    });
  });

  // These books indent a run-in label past the body text it introduces. Measuring the boundary
  // from the column edge instead of the entry's own indent meant a label never closed the one
  // before it, and Adapted Vehicle came out at 2820 characters instead of about a hundred.
  test("a label ends at the next label even when both are indented past the body", () => {
    const runs = [
      { s: 'Adapted Vehicles (Environmental):', x: 72, y: 412, size: 10.5 },
      { s: 'Vehicles you drive there are better.', x: 63, y: 400, size: 10.5 },
      { s: 'Animal Whisperer:', x: 72, y: 370, size: 10.5 },
      { s: 'Animals like you.', x: 63, y: 358, size: 10.5 },
    ];

    const found = extractEntry([buildReadingOrder(runs, 612, 60)], 0, 'Adapted Vehicles (Environmental)', bodySize, 'perk');
    expect(found.text).toBe('Vehicles you drive there are better.');
  });

  // A display face that starts a new run at every change of case. The My Little Pony CRB
  // writes "Spirit of Generosity" as nine runs, which is every Role in the book.
  test("matches a heading broken into many pieces by its display font", () => {
    const p = page({
      left: [
        run('Spi', { size: 30 }), run('R', { size: 30 }), run('it', { size: 30 }),
        run('O', { size: 30 }), run('f', { size: 30 }), run('gE', { size: 30 }),
        run('n', { size: 30 }), run('EROS', { size: 30 }), run('ity', { size: 30 }),
        run('You put others before yourself.'),
      ],
      folio: 72,
    });

    expect(extractEntry([order(p)], 0, 'Spirit of Generosity', bodySize, 'role')).toMatchObject({
      kind: 'heading',
      text: 'You put others before yourself.',
    });
  });

  // The piece that gets separated is usually the colon itself: a bullet, the name, ":", then
  // the prose. Without joining, the name run carries no colon and is not a label at all.
  test("matches a run-in label whose colon is a separate run", () => {
    const p = page({
      right: [
        run('\u2022'), run("So Funny, It's Scary"), run(':'), run('You can use Performance.'),
        run('\u2022'), run('Comic Relief'), run(':'), run('You crack a joke.'),
      ],
      folio: 86,
    });

    expect(extractEntry([order(p)], 0, "So Funny, It's Scary", bodySize, 'perk')).toMatchObject({
      kind: 'label',
      text: 'You can use Performance.',
    });
  });

  test("a split label also closes the entry before it", () => {
    // Recognising a split label one way and not the other let the first Laugh Tactic swallow
    // every one after it.
    const p = page({
      right: [
        run('\u2022'), run('Comic Relief'), run(':'), run('You crack a joke.'),
        run('\u2022'), run('Slapstick'), run(':'), run('You take a pratfall.'),
      ],
      folio: 86,
    });

    expect(extractEntry([order(p)], 0, 'Comic Relief', bodySize, 'perk').text)
      .toBe('You crack a joke.');
  });

  // A heading can carry its level as a separate, smaller run - "CHEER" then "(1" then
  // "LEVEL)". Not part of the heading, and not part of the description either.
  // The book writes the tag at least four ways, and the superscript of "1ST" is a run of its
  // own that arrives ahead of the bracket.
  test.each([
    [['(1', 'LEVEL)'], 'a plain tag'],
    [['ST', '(1', 'LEVEL)'], 'a tag behind a superscript ordinal'],
    [['(3RD LEVEL – ALSO 11TH)'], 'a compound tag'],
    [['(7 LEVEL- ALSO 15 LEVEL)'], 'a compound tag with no space'],
  ])("drops %#: %s", (pieces) => {
    const p = page({
      right: [run('AFTER YOU', { size: 14 }), ...pieces.map(x => run(x)), run('It is rude to go first.')],
      folio: 122,
    });

    expect(extractEntry([order(p)], 0, 'After You', bodySize, 'perk').text)
      .toBe('It is rude to go first.');
  });

  test("drops a level tag the heading trails behind it", () => {
    const p = page({
      right: [
        run('AFTER YOU', { size: 14 }), run('(6'), run('LEVEL)'),
        run('It\u2019s rude to go first.'),
      ],
      folio: 122,
    });

    expect(extractEntry([order(p)], 0, 'After You', bodySize, 'perk').text)
      .toBe('It\u2019s rude to go first.');
  });

  test("the watermark never ends up in an entry", () => {
    const p = page({ right: [run('MOBILITY', { size: 22 }), run('You move well.')], folio: 1 });
    expect(extractEntry([order(p)], 0, 'Mobility', bodySize, 'perk').text).not.toMatch(/Downloded/);
  });
});

describe("pluralKeys", () => {
  // The book heads its entry "Adapted Vehicles (Environmental)"; the item is named with the
  // singular. The plural belongs on the name, not after the qualifier.
  test("pluralises the name rather than the trailing qualifier", () => {
    expect(pluralKeys('Adapted Vehicle (Environmental)')).toContain('adaptedvehiclesenvironmental');
  });

  test("also covers a compendium name that is plural where the book is not", () => {
    expect(pluralKeys('Adapted Vehicles (Environmental)')).toContain('adaptedvehicleenvironmental');
  });

  test("never repeats what a strict match would already have tried", () => {
    expect(pluralKeys('Mobility')).not.toContain('mobility');
  });
});

describe("extractEntry plural fallback", () => {
  const bodySize = 10.5;
  const order = (p) => buildReadingOrder(p, 612, 60);

  test("falls back to a plural heading and says the match was loose", () => {
    const p = page({
      right: [run('Adapted Vehicles (Environmental):'), run('Vehicles you drive there are better.')],
      folio: 90,
    });

    expect(extractEntry([order(p)], 0, 'Adapted Vehicle (Environmental)', bodySize, 'perk')).toMatchObject({
      loose: true,
      text: 'Vehicles you drive there are better.',
    });
  });

  // A plural is not always a spelling difference - it can be a different item. Grid Surge (a
  // Perk) and Grid Surges (its RolePoints) sit on the same page of the same book, so an item
  // with an entry of its own must never be diverted to its neighbour's.
  test("an exact match always beats a plural neighbour on the same page", () => {
    const p = page({
      right: [
        run('GRID SURGES', { size: 22 }), run('The RolePoints pool.'),
        run('GRID SURGE', { size: 22 }), run('The Perk itself.'),
      ],
      folio: 56,
    });

    expect(extractEntry([order(p)], 0, 'Grid Surge', bodySize, 'perk')).toMatchObject({
      loose: false,
      text: 'The Perk itself.',
    });
  });

  test("an ordinary match is not flagged loose", () => {
    const p = page({ right: [run('MOBILITY', { size: 22 }), run('You move well.')], folio: 1 });
    expect(extractEntry([order(p)], 0, 'Mobility', bodySize, 'perk').loose).toBe(false);
  });
});

// An Influence, its Perk and its Hang Up are three compendium items sharing one name - the GI
// Joe CRB has an Athlete influence, perk and hangUp, all on p.46. The book heads the writeup
// once with the shared name and then subdivides it by what each part IS, so matching on the
// name alone found the parent three times and handed all three the whole page.
describe("influence sub-sections", () => {
  const bodySize = 10.5;
  const order = (p) => buildReadingOrder(p, 612, 60);

  // The real shape: a 38pt Influence heading subdivided at 22pt.
  const athlete = () => page({
    left: [
      run('ATHLETE', { size: 38 }),
      run('You live for the roar of the crowd.'),
      run('INFLUENCE PERK', { size: 22 }),
      run('You gain an Edge on Social Skill Tests.'),
      run('HANG-UP', { size: 22 }),
      run('You suffer a Snag when breaking rules.'),
      run('SUGGESTED CHARACTERISTICS', { size: 22 }),
      run('Roll on the tables.'),
      run('BOOKWORM', { size: 38 }),
      run('The next influence entirely.'),
    ],
    folio: 45,
  });

  test("the Influence keeps only its own prose", () => {
    expect(extractEntry([order(athlete())], 0, 'Athlete', bodySize, 'influence').text)
      .toBe('You live for the roar of the crowd.');
  });

  test("the Perk descends into INFLUENCE PERK", () => {
    expect(extractEntry([order(athlete())], 0, 'Athlete', bodySize, 'perk').text)
      .toBe('You gain an Edge on Social Skill Tests.');
  });

  test("the Hang Up descends into HANG-UP", () => {
    expect(extractEntry([order(athlete())], 0, 'Athlete', bodySize, 'hangUp').text)
      .toBe('You suffer a Snag when breaking rules.');
  });

  test("all three end up with different text", () => {
    const p = order(athlete());
    const texts = ['influence', 'perk', 'hangUp']
      .map(type => extractEntry([p], 0, 'Athlete', bodySize, type).text);
    expect(new Set(texts).size).toBe(3);
  });

  // Otherwise a Perk would reach past its own Influence and pick up the next one's section.
  test("a section belonging to the next Influence is not taken", () => {
    const p = page({
      left: [
        run('ATHLETE', { size: 38 }),
        run('You live for the roar of the crowd.'),
        run('BOOKWORM', { size: 38 }),
        run('INFLUENCE PERK', { size: 22 }),
        run('This belongs to Bookworm.'),
      ],
      folio: 45,
    });

    expect(extractEntry([order(p)], 0, 'Athlete', bodySize, 'perk').text)
      .toBe('You live for the roar of the crowd.');
  });

  test("an ordinary Perk with a heading of its own is unaffected", () => {
    const p = page({
      right: [run('SNEAK ATTACK', { size: 22 }), run('You deal extra damage.')],
      folio: 71,
    });

    expect(extractEntry([order(p)], 0, 'Sneak Attack', bodySize, 'perk').text)
      .toBe('You deal extra damage.');
  });

  // The rule that makes the above work: weight alone cannot say where an entry stops, because
  // these books nest a 22pt section under a 38pt heading.
  test("an entry stops at a sub-heading lighter than its own", () => {
    const p = page({
      left: [
        run('ATHLETE', { size: 38 }),
        run('Only this.'),
        run('A SMALLER HEADING', { size: 16 }),
        run('Not this.'),
      ],
      folio: 45,
    });

    expect(extractEntry([order(p)], 0, 'Athlete', bodySize, 'influence').text).toBe('Only this.');
  });
});

describe("findBodyFonts", () => {
  const line = (s, font, size = 10.5) => ({ s, x: 63, y: 600, size, font });

  test("keeps the fonts that carry the text and leaves a sparse one out", () => {
    const prose = Array.from({ length: 20 }, () => line('a long line of ordinary body prose', 'body'));
    const heading = [line('NOWHERE TO RUN', 'bold', 10)];
    const fonts = findBodyFonts([[...prose, ...heading]]);

    expect(fonts.has('body')).toBe(true);
    expect(fonts.has('bold')).toBe(false);
  });

  // Body text routinely uses more than one face - a roman and an italic, or two subsetted
  // copies of the same one - so this has to be a set, not a single winner.
  test("keeps several fonts when the text is split between them", () => {
    const a = Array.from({ length: 10 }, () => line('a long line of ordinary body prose', 'roman'));
    const b = Array.from({ length: 10 }, () => line('a long line of ordinary body prose', 'italic'));
    expect(findBodyFonts([[...a, ...b]]).size).toBe(2);
  });

  // A book dominated by stat blocks has its size set by those; tallying only at that size
  // would collect the stat-block fonts and call the actual prose font a heading.
  test("counts every size, not just the book's dominant one", () => {
    const stats = Array.from({ length: 30 }, () => line('9pt stat block text here', 'statfont', 9));
    const prose = Array.from({ length: 20 }, () => line('10.5pt prose that carries the entries', 'prosefont'));
    const fonts = findBodyFonts([[...stats, ...prose]]);

    expect(fonts.has('prosefont')).toBe(true);
  });
});

describe("headings marked by weight rather than size", () => {
  const bodySize = 10.5;
  // The Decepticon Directive sets "Nowhere to Run" at 10pt over a 10.5pt body, in a font used
  // nowhere in the prose - smaller than the text it introduces. 168 of its Perks needed this.
  const bodyFonts = new Set(['body']);
  const order = (p) => buildReadingOrder(p, 612, 60);

  // Realistically prose-heavy. The page's own fonts decide what counts as body, and on a toy
  // page two headings can be a third of the characters and so qualify as body themselves - a
  // real page is overwhelmingly prose, which is what makes the heading font stand out.
  const filler = (n) => Array.from({ length: n }, () => (
    { s: 'a full line of ordinary body prose running the width of the column', size: 10.5, font: 'body' }));
  const withWeightHeading = (headingText) => page({
    left: [
      { s: headingText, size: 10, font: 'bold' },
      { s: 'When you pour on the firepower, nothing is safe.', size: 10.5, font: 'body' },
      ...filler(6),
      { s: 'ANOTHER PERK', size: 10, font: 'bold' },
      { s: 'Some other rule.', size: 10.5, font: 'body' },
      ...filler(6),
    ],
    folio: 45,
  });

  test("a bold run is a heading even when smaller than the body", () => {
    const found = extractEntry([order(withWeightHeading('Nowhere to Run'))], 0, 'Nowhere to Run', bodySize, 'perk', bodyFonts);
    expect(found.kind).toBe('heading');
    expect(found.text.startsWith('When you pour on the firepower, nothing is safe.')).toBe(true);
  });

  // The font list is the whole basis of the weight test, so without one this falls back to size
  // alone and a heading smaller than the body is simply not found. Books that subset a font per
  // page land here - see isHeading() for why a per-page list was tried and rejected.
  test("without a font list, a heading smaller than the body is not found", () => {
    expect(extractEntry([order(withWeightHeading('Nowhere to Run'))], 0, 'Nowhere to Run', bodySize, 'perk', new Set()))
      .toBeNull();
  });

  // The font is the whole signal: a short run starting a line in the SAME font as the prose is
  // just a short line of prose.
  test("a run in the prose font is not a heading, however short", () => {
    const p = page({
      left: [
        { s: 'MOBILITY', size: 22, font: 'display' },
        { s: 'You move well.', size: 10.5, font: 'body' },
        { s: 'Short line.', size: 10.5, font: 'body' },
        ...filler(6),
      ],
      folio: 45,
    });

    expect(extractEntry([order(p)], 0, 'Short line', bodySize, 'perk', bodyFonts)).toBeNull();
  });

  // The guard that matters: bold is also how an emphasised phrase inside a sentence is set,
  // and treating one as a heading would cut entries in half.
  test("a bold run sharing its line with prose is not a heading", () => {
    const runs = [
      { s: 'MOBILITY', x: 63, y: 700, size: 22, font: 'display' },
      { s: 'You move well, and', x: 63, y: 680, size: 10.5, font: 'body' },
      { s: 'Nowhere to Run', x: 200, y: 680, size: 10.5, font: 'bold' },
      { s: 'is not a heading here.', x: 330, y: 680, size: 10.5, font: 'body' },
    ];

    const found = extractEntry([buildReadingOrder(runs, 612, 60)], 0, 'Mobility', bodySize, 'perk', bodyFonts);
    expect(found.text).toBe('You move well, and Nowhere to Run is not a heading here.');
  });
});

describe("findEntry", () => {
  const order = (p) => buildReadingOrder(p, 612, 60);
  const withEntry = (name) => page({ right: [run(name, { size: 22 }), run('Some rules text.')], folio: 1 });

  test("looks on the recorded page first", () => {
    const pages = [order(withEntry('MOBILITY')), order(withEntry('MOBILITY'))];
    expect(findEntry(pages, 1, 0, 'Mobility', 10.5, 'perk')).toMatchObject({ page: 1, exact: true });
  });

  // source.page is hand-entered and an entry near a page break is easy to mis-record.
  test("falls back to the page after", () => {
    const pages = [order(page({ folio: 1 })), order(withEntry('MOBILITY'))];
    expect(findEntry(pages, 1, 0, 'Mobility', 10.5, 'perk')).toMatchObject({ page: 2, exact: false });
  });

  test("returns null when the book simply does not have it", () => {
    expect(findEntry([order(page({ folio: 1 }))], 1, 0, 'Mobility', 10.5, 'perk')).toBeNull();
  });
});

describe("NARRATIVE_TYPES", () => {
  // Weapons/armor/gear appear in the books as stat table rows and matched a heading 0% of the
  // time; most compendium copies of them are generated permutations no page describes.
  test("covers the prose types and excludes the stat-table ones", () => {
    expect(NARRATIVE_TYPES).toEqual(expect.arrayContaining(['perk', 'role', 'focus', 'origin', 'influence', 'hangUp']));
    for (const type of ['weapon', 'armor', 'gear', 'upgrade', 'weaponEffect', 'shield', 'equipmentPackage']) {
      expect(NARRATIVE_TYPES).not.toContain(type);
    }
  });
});

describe("findFurnitureBands drift", () => {
  // Operation: Snakebit sets the same running head at y=750 on twenty-two pages and y=754 on
  // three. Judged apart neither half reaches the threshold and the head survives into the text.
  test("a head that wanders between two bands is still furniture", () => {
    const pages = [];
    for (let i = 0; i < 40; i++) {
      const y = i < 30 ? 750 : 754;
      pages.push([
        { s: "G.I.JOE ROLEPLAYING GAME", x: 176, y, size: 10 },
        { s: "Prose on the page.", x: 63, y: 700, size: 10.5 },
      ]);
    }

    const bands = findFurnitureBands(pages, 10.5);
    expect(bands.has(750)).toBe(true);
    expect(bands.has(754)).toBe(true);
  });

  // Merging must not make the test weaker: a band of genuine headings is still many different
  // strings, and stays out however its neighbours are grouped.
  test("neighbouring bands of real headings are still not furniture", () => {
    const pages = [];
    for (let i = 0; i < 40; i++) {
      pages.push([
        { s: `Heading number ${i}`, x: 63, y: i % 2 ? 750 : 754, size: 14 },
        { s: "Prose on the page.", x: 63, y: 700, size: 10.5 },
      ]);
    }

    expect(findFurnitureBands(pages, 10.5).size).toBe(0);
  });
});
