import {
  footprint, findPageFurniture, pickMapImage, samplePages, mapFileName, mapFileNames,
} from './book-maps.mjs';

/** A placed image, as helpers/pdf-reader.mjs reports one. */
const rect = (name, x, y, w, h) => ({ name, x, y, w, h });

/** The three images a map page of Operation: Cold Iron paints, on a 612x783 sheet. */
const SPREAD = rect('bg', -10, -10, 1244, 803);
const FRAME = rect('frame', 54, 43, 521, 703);
const MAP = rect('map', 75, 57, 480, 669);

/** The book, with the map page in it. The frame is on most pages, the map on one. */
const book = () => {
  const pages = [];
  for (let i = 0; i < 40; i++) pages.push({ pageSize: [612, 783], images: [SPREAD, FRAME] });
  pages[20] = { pageSize: [612, 783], images: [SPREAD, FRAME, MAP] };
  return pages;
};

describe("footprint", () => {
  test("is the placed size, rounded", () => {
    expect(footprint({ x: 75, y: 57, w: 480.4, h: 668.7 })).toBe('480x669');
  });

  // The frame sits at x=54 on a right-hand page and x=39 on a left-hand one. Including x would
  // make those two different things and halve the count that decides whether either is furniture.
  test("ignores where the image sits", () => {
    expect(footprint({ x: 54, y: 43, w: 521, h: 703 }))
      .toBe(footprint({ x: 39, y: 43, w: 521, h: 703 }));
  });
});

describe("findPageFurniture", () => {
  test("the frame and the spread background are furniture, the map is not", () => {
    const furniture = findPageFurniture(book());
    expect(furniture.has(footprint(FRAME))).toBe(true);
    expect(furniture.has(footprint(SPREAD))).toBe(true);
    expect(furniture.has(footprint(MAP))).toBe(false);
  });

  // Otherwise a thing drawn three times on one sheet would count as three pages' worth of
  // evidence that it is on every sheet. Ten pages puts the threshold at two, so the three
  // paintings would cross it and the one page it is actually on does not.
  test("an image counts once per page however often it is painted", () => {
    const pages = [{ images: [FRAME, FRAME, FRAME] }];
    for (let i = 1; i < 10; i++) pages.push({ images: [MAP] });

    expect(findPageFurniture(pages).has(footprint(FRAME))).toBe(false);
  });

  test("nothing read, nothing to ignore", () => {
    expect(findPageFurniture([]).size).toBe(0);
  });
});

describe("pickMapImage", () => {
  const furniture = findPageFurniture(book());

  test("picks the map rather than the frame or the spread behind it", () => {
    expect(pickMapImage([SPREAD, FRAME, MAP], 612, 783, furniture)).toBe(MAP);
  });

  // Largest-wins picks the spread, second-largest the frame: size alone cannot do this.
  test("size alone would get it wrong", () => {
    const bySize = [SPREAD, FRAME, MAP].sort((a, b) => b.w * b.h - a.w * a.h);
    expect(bySize[0]).toBe(SPREAD);
  });

  test("a page with two maps on it yields the bigger one", () => {
    const upper = rect('upper', 82, 60, 461, 250);
    const lower = rect('lower', 123, 345, 379, 381);
    expect(pickMapImage([FRAME, upper, lower], 612, 783, furniture)).toBe(lower);
  });

  test("a photo too small to be a map is passed over", () => {
    const photo = rect('photo', 100, 100, 90, 60);
    expect(pickMapImage([FRAME, photo], 612, 783, furniture)).toBeNull();
  });

  test("an image that bleeds off the sheet is not the map", () => {
    expect(pickMapImage([rect('bleed', -200, -10, 1000, 800)], 612, 783, new Set())).toBeNull();
  });

  test("a page with no images at all", () => {
    expect(pickMapImage([], 612, 783, furniture)).toBeNull();
  });

  // A map printed with no frame around it is still a map.
  test("nothing known to be furniture is needed", () => {
    expect(pickMapImage([MAP], 612, 783, new Set())).toBe(MAP);
  });
});

describe("samplePages", () => {
  test("every wanted page is read", () => {
    const pages = samplePages(146, [14, 21, 84, 139]);
    for (const wanted of [14, 21, 84, 139]) expect(pages).toContain(wanted);
  });

  test("the rest are spread across the book, up to the sample size", () => {
    const pages = samplePages(146, [21], 40);
    expect(pages.length).toBeLessThanOrEqual(40);
    expect(pages[0]).toBe(0);
    expect(Math.max(...pages)).toBeGreaterThan(100);
  });

  test("comes back ascending and without repeats", () => {
    const pages = samplePages(60, [30, 4, 30]);
    expect(pages).toEqual([...new Set(pages)].sort((a, b) => a - b));
  });

  test("a book shorter than the sample is read whole", () => {
    expect(samplePages(12, [], 40)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  test("a page that is not in the book is dropped", () => {
    expect(samplePages(10, [99, -1], 2).every(i => i >= 0 && i < 10)).toBe(true);
  });
});

describe("mapFileName", () => {
  test.each([
    ['Dallol Testing Site', 'dallol-testing-site'],
    ['Area 4, Floor 1', 'area-4-floor-1'],
    ['International Research Station, Below Decks', 'international-research-station-below-decks'],
    ['', 'map'],
    ['???', 'map'],
  ])("%s -> %s", (title, expected) => {
    expect(mapFileName(title)).toBe(expected);
  });
});

describe("mapFileNames", () => {
  // Cold Iron prints Extensive Enterprises twice and Area 4, Floor 1 twice. Left alone the
  // second of each pair writes over the first.
  test("only the names that clash carry their page", () => {
    expect(mapFileNames([
      { title: "Extensive Enterprises", page: 14 },
      { title: "Dallol Testing Site", page: 21 },
      { title: "Extensive Enterprises", page: 139 },
    ])).toEqual(["extensive-enterprises-p15", "dallol-testing-site", "extensive-enterprises-p140"]);
  });

  test("names that differ only in punctuation still clash", () => {
    expect(mapFileNames([
      { title: "Area 4, Floor 1", page: 25 },
      { title: "Area 4 Floor 1", page: 68 },
    ])).toEqual(["area-4-floor-1-p26", "area-4-floor-1-p69"]);
  });

  test("one map of each name is left clean", () => {
    expect(mapFileNames([{ title: "The Facility", page: 84 }])).toEqual(["the-facility"]);
  });

  test("no maps, no names", () => {
    expect(mapFileNames([])).toEqual([]);
  });
});
