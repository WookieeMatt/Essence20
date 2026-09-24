/**
 * Reading a PDF in the browser, for the importers that build things out of a GM's own rulebooks.
 *
 * Shared by apps/book-description-importer.mjs and apps/adventure-importer.mjs, which both need
 * exactly the same thing: every page's text as positioned runs, plus the outline if the book has
 * one. Keeping it here means the two cannot drift - the run shape in particular is depended on by
 * helpers/book-descriptions.mjs, helpers/book-journal.mjs and helpers/book-tables.mjs alike.
 *
 * Nothing here is uploaded. The File comes from a plain input, is read into an ArrayBuffer in the
 * browser, and never reaches the Foundry server.
 */

/** Where the vendored reader lives. See lib/pdfjs/README.md for why it is vendored at all. */
const PDFJS = "systems/essence20/lib/pdfjs/pdf.mjs";
const PDFJS_WORKER = "systems/essence20/lib/pdfjs/pdf.worker.mjs";

/** The most a page is ever magnified: past this the render costs more than the detail is worth. */
const MAX_SCALE = 4;

let pdfjsPromise = null;

/**
 * Load pdf.js on first use.
 *
 * Deliberately a dynamic import rather than a top-level one: the reader is 2.4MB and all but a
 * handful of sessions never open an importer, so it should not be in the startup path.
 * @returns {Promise<Object>} The pdf.js module.
 */
export function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(`/${PDFJS}`).then(module => {
      module.GlobalWorkerOptions.workerSrc = `/${PDFJS_WORKER}`;
      return module;
    });
  }

  return pdfjsPromise;
}

/**
 * Resolve an outline's destinations to page indices.
 *
 * A destination is either a named one that has to be looked up or an explicit array, and either
 * way the page arrives as a reference rather than a number. Resolved here so the helpers that
 * work on the outline never need the PDF document.
 *
 * Only the page survives, not the position: every destination in these books records the top of
 * its page (y=783 throughout Operation: Cold Iron), so several sections landing on one page all
 * point at the same spot. helpers/book-journal.mjs separates those by their titles instead.
 * @param {Object} doc   A pdf.js document.
 * @param {Array<Object>} items   Raw outline items.
 * @returns {Promise<Array<{title: string, page: number, items: Array}>>}
 */
async function resolveOutline(doc, items) {
  const resolved = [];
  for (const item of items ?? []) {
    let page = 0;
    try {
      const dest = typeof item.dest === "string" ? await doc.getDestination(item.dest) : item.dest;
      if (dest?.[0]) page = await doc.getPageIndex(dest[0]);
    } catch {
      page = 0;   // a destination that will not resolve still names a real section
    }

    resolved.push({
      title: item.title ?? "",
      page,
      items: item.items?.length ? await resolveOutline(doc, item.items) : [],
    });
  }

  return resolved;
}

/**
 * Read every page of a PDF as positioned text runs.
 *
 * @param {File} file   From a file input; never uploaded.
 * @param {Function} [onProgress]   Called with (pageNumber, total) every so often.
 * @returns {Promise<{pages: Array<Array<Object>>, widths: Array<number>, outline: Array<Object>,
 *   doc: Object}>} `doc` is the open pdf.js document, for reading images out of it afterwards.
 */
export async function readPdf(file, onProgress) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

  const pages = [];
  const widths = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    widths.push(page.getViewport({ scale: 1 }).width);
    pages.push(content.items
      .filter(item => item.str && item.str.trim())
      .map(item => ({
        s: item.str.trim(),
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
        size: Math.round(item.height * 10) / 10,
        font: item.fontName,
        // Text turned on its side. A PDF matrix that leans more on b than on a is rotated,
        // and in these books that means the chapter tab printed down the edge of the sheet -
        // "NON-PLAYER CHARCTERS AND THREATS" running down 46 of Cold Iron's pages. It sits at
        // a different y on every one of them, so no band catches it; its angle does.
        rotated: Math.abs(item.transform[1]) > Math.abs(item.transform[0]),
      })));

    // Every 25 rather than every page: re-rendering a progress line is slower than the parse.
    if (onProgress && n % 25 === 0) {
      await onProgress(n, doc.numPages);
    }
  }

  const outline = await doc.getOutline();
  return { pages, widths, doc, outline: outline ? await resolveOutline(doc, outline) : [] };
}

/* -------------------------------------------- */
/*  Images                                      */
/* -------------------------------------------- */

/**
 * Multiply two PDF matrices, in the [a b c d e f] order pdf.js uses.
 * @param {Array<number>} a
 * @param {Array<number>} b
 * @returns {Array<number>}
 */
function multiply(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

/**
 * Where each image on a page was actually placed, in PDF points.
 *
 * pdf.js reports an image only by name, because a PDF draws every image into the unit square
 * and lets the current transform decide where it lands. So the operator list is walked keeping
 * that transform - which is what save, restore and transform are doing in the switch below - and
 * the unit square is pushed through it to get the rectangle the image really occupies.
 *
 * That rectangle is the whole point: it is what tells a full-bleed spread background from the
 * frame from the map, none of which can be told apart by name. See helpers/book-maps.mjs.
 * @param {Object} doc   A pdf.js document.
 * @param {Array<number>} indices   Zero-based page indices.
 * @param {Function} [onProgress]   Called with (done, total).
 * @returns {Promise<Map<number, {pageSize: Array<number>, images: Array<Object>}>>}
 */
export async function readImageRects(doc, indices, onProgress) {
  const { OPS } = await loadPdfjs();
  const byPage = new Map();

  let done = 0;
  for (const index of indices) {
    const page = await doc.getPage(index + 1);
    const ops = await page.getOperatorList();
    const viewport = page.getViewport({ scale: 1 });

    let ctm = [1, 0, 0, 1, 0, 0];
    const stack = [];
    const images = [];
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      if (fn === OPS.save) stack.push(ctm.slice());
      else if (fn === OPS.restore) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
      else if (fn === OPS.transform) ctm = multiply(ctm, ops.argsArray[i]);
      else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject
        || fn === OPS.paintImageMaskXObject) {
        const corners = [[0, 0], [1, 0], [1, 1], [0, 1]]
          .map(([x, y]) => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]]);
        const xs = corners.map(c => c[0]);
        const ys = corners.map(c => c[1]);
        images.push({
          name: ops.argsArray[i][0],
          x: Math.min(...xs), y: Math.min(...ys),
          w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys),
        });
      }
    }

    byPage.set(index, { pageSize: [viewport.width, viewport.height], images });
    done++;
    if (onProgress && done % 10 === 0) await onProgress(done, indices.length);
  }

  return byPage;
}

/**
 * Draw one rectangle of a page onto a canvas.
 *
 * The region is rendered rather than the image extracted, which matters: these maps carry their
 * area labels and room numbers as vector text drawn OVER the raster, so pulling the raster out
 * would hand back an unlabelled map. Rendering the region keeps everything printed inside it and
 * leaves the page frame, running head and folio outside.
 *
 * Rendered with the print intent, which is not cosmetic. pdf.js schedules the next chunk of a
 * DISPLAY render on an animation frame, and a window that is not being painted - minimised, or a
 * pane the app has hidden - never fires one, so the render stops partway and its promise never
 * settles. A GM who looks away mid-import would watch it hang for ever with no error. The print
 * intent schedules on a promise instead, which is right in any case: this canvas is off-screen.
 * @param {Object} doc   A pdf.js document.
 * @param {number} index   Zero-based page index.
 * @param {{x: number, y: number, w: number, h: number}} rect   In PDF points.
 * @param {number} [target]   The longest side of the result, in pixels.
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderRegion(doc, index, rect, target = 1600) {
  const page = await doc.getPage(index + 1);
  const scale = Math.min(MAX_SCALE, Math.max(1, target / Math.max(rect.w, rect.h)));
  const viewport = page.getViewport({ scale });

  // y runs up the page in PDF space and down it on a canvas, so the corners swap.
  const [left, bottom] = viewport.convertToViewportPoint(rect.x, rect.y);
  const [right, top] = viewport.convertToViewportPoint(rect.x + rect.w, rect.y + rect.h);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(right - left);
  canvas.height = Math.round(bottom - top);

  const context = canvas.getContext("2d");
  // A map drawn on a transparent background would come out black in Foundry.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: context,
    viewport,
    transform: [1, 0, 0, 1, -left, -top],
    intent: "print",
  }).promise;

  return canvas;
}
