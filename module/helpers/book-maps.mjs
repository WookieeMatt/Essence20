/**
 * Finding the map on a page of an adventure PDF.
 *
 * The same shape as its siblings - no PDF or Foundry API, plain objects in and out - so the
 * judgement stays testable. The rectangles come from helpers/pdf-reader.mjs, which walks the
 * page's operator list and works out where each image was actually placed.
 *
 * The problem is not finding images; it is telling the map from everything else on the page. A
 * map page of Operation: Cold Iron paints three: a two-page spread background that bleeds off the
 * sheet, the decorative frame the whole book is set inside, and the map. Largest-wins picks the
 * spread, and second-largest picks the frame.
 *
 * What separates them is the same thing that separates a running head from a heading - repetition.
 * The frame is on 84 of Cold Iron's 146 pages and the spread background on nearly all of them; a
 * map is on one. So a footprint that recurs across the book is furniture, whatever its size, and
 * the map is the biggest of what is left that actually fits on the page.
 */

/**
 * How much of the book a footprint has to appear on before it counts as furniture.
 *
 * A fifth is far below the frame (58% of Cold Iron) and far above any map, and the gap between
 * the two is the whole book, so there is nothing delicate about where in between this sits.
 */
const FURNITURE_SHARE = 0.2;

/** How far an image may hang off the sheet and still be considered part of the page, in points. */
const BLEED = 12;

/** A map is a feature of its page: anything smaller than this is a photo or a logo. */
const MIN_COVER = 0.05;

/**
 * A placed image's footprint, rounded, which is how the same one is recognised on another page.
 *
 * Position is deliberately not part of it. The frame sits at x=54 on a right-hand page and x=39
 * on a left-hand one, so including x would make a verso frame and a recto frame two different
 * things and halve the count that decides whether either is furniture.
 * @param {{w: number, h: number}} rect
 * @returns {string}
 */
export function footprint(rect) {
  return `${Math.round(rect.w)}x${Math.round(rect.h)}`;
}

/**
 * The footprints that belong to the book's furniture rather than to any one page.
 * @param {Array<{images: Array<Object>}>} sampled   Pages read, in any order.
 * @returns {Set<string>} Footprints to ignore.
 */
export function findPageFurniture(sampled) {
  const counts = new Map();
  for (const page of sampled ?? []) {
    // Counted once per page: a frame drawn twice on one sheet is still one page's worth of
    // evidence that it is a frame.
    for (const key of new Set((page.images ?? []).map(footprint))) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const threshold = (sampled?.length ?? 0) * FURNITURE_SHARE;
  return new Set([...counts].filter(([, n]) => n >= threshold).map(([key]) => key));
}

/**
 * Pick the map out of the images on a page.
 * @param {Array<{x: number, y: number, w: number, h: number}>} images
 * @param {number} pageWidth
 * @param {number} pageHeight
 * @param {Set<string>} furniture   From findPageFurniture().
 * @returns {?Object} The chosen image's rectangle in PDF points, or null if the page has none.
 */
export function pickMapImage(images, pageWidth, pageHeight, furniture) {
  const area = pageWidth * pageHeight;
  const candidates = (images ?? []).filter(rect => !furniture?.has(footprint(rect))
    && rect.x >= -BLEED && rect.y >= -BLEED
    && rect.x + rect.w <= pageWidth + BLEED && rect.y + rect.h <= pageHeight + BLEED
    && rect.w * rect.h >= area * MIN_COVER);

  return candidates.sort((a, b) => b.w * b.h - a.w * a.h)[0] ?? null;
}

/**
 * Which pages to read the images of.
 *
 * Reading a page's operator list costs a quarter of a second, so a 150-page adventure would spend
 * most of a minute on pages that cannot contain a map. The map pages are read because they are the
 * answer; the rest are a sample, read only to establish what the furniture is, and a sample of
 * forty is plenty when the frame is on more than half the book.
 * @param {number} pageCount
 * @param {Array<number>} wanted   Page indices that must be read.
 * @param {number} [sample]   How many pages to read in total.
 * @returns {Array<number>} Ascending, distinct.
 */
export function samplePages(pageCount, wanted, sample = 40) {
  const pages = new Set(wanted ?? []);
  const step = Math.max(1, Math.floor(pageCount / Math.max(1, sample - pages.size)));
  for (let i = 0; i < pageCount && pages.size < sample; i += step) pages.add(i);

  return [...pages].filter(i => i >= 0 && i < pageCount).sort((a, b) => a - b);
}

/**
 * A file name for a map, safe on every platform Foundry runs on.
 * @param {string} title   The map's name, with the outline's "MAP: " already removed.
 * @returns {string} Lower case, hyphenated, never empty.
 */
export function mapFileName(title) {
  const slug = (title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'map';
}

/**
 * A distinct file name for every map in one import.
 *
 * An adventure prints the same place more than once: Operation: Cold Iron has two maps called
 * "Extensive Enterprises" and two called "Area 4, Floor 1", drawn at different scales for
 * different scenes. Left alone they would write over each other, so the ones that clash carry
 * the printed page they came from and the ones that do not are left clean.
 * @param {Array<{title: string, page: number}>} maps
 * @returns {Array<string>} One name per map, in the same order, without an extension.
 */
export function mapFileNames(maps) {
  const slugs = (maps ?? []).map(map => mapFileName(map.title));
  const counts = new Map();
  for (const slug of slugs) counts.set(slug, (counts.get(slug) ?? 0) + 1);

  return slugs.map((slug, i) => (counts.get(slug) > 1 ? `${slug}-p${maps[i].page + 1}` : slug));
}
