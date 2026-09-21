import {
  NARRATIVE_TYPES, normalizeBookTitle, nameKey, itemKeys, headingKeys, findWatermark,
  findBodyFontSize, findTextFloor, calibrateFolioOffset, buildReadingOrder, extractEntry,
  findEntry, mapSymbolGlyphs, pluralKeys,
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
  const pages = [page({ left: [run('a'), run('b'), run('c')], folio: 1 })];

  test("body size is the most common size, not the largest", () => {
    expect(findBodyFontSize(pages)).toBe(10.5);
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
