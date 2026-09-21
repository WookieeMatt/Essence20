import { applyThemeClass } from "../settings.js";
import {
  NARRATIVE_TYPES, normalizeBookTitle, findWatermark, findBodyFontSize, findTextFloor,
  calibrateFolioOffset, buildReadingOrder, findEntry,
} from "../helpers/book-descriptions.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Where the vendored reader lives. See lib/pdfjs/README.md for why it is vendored at all. */
const PDFJS = "systems/essence20/lib/pdfjs/pdf.mjs";
const PDFJS_WORKER = "systems/essence20/lib/pdfjs/pdf.worker.mjs";

/**
 * Load pdf.js on first use.
 *
 * Deliberately a dynamic import rather than a top-level one: the reader is 2.4MB and all but a
 * handful of sessions never open this screen, so it should not be in the startup path.
 * @returns {Promise<Object>} The pdf.js module.
 */
let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(`/${PDFJS}`).then(module => {
      module.GlobalWorkerOptions.workerSrc = `/${PDFJS_WORKER}`;
      return module;
    });
  }

  return pdfjsPromise;
}

/**
 * GM screen for filling in compendium descriptions from a rulebook PDF the GM owns.
 *
 * The compendium ships with almost every description empty on purpose - this system does not
 * redistribute Renegade's text. This reads a GM's OWN copy of a book and writes what it finds
 * into their OWN world, so a table that has bought the book can see the rules on the sheet.
 *
 * Three things about the shape of this are deliberate:
 *
 *  - The PDF never leaves the browser. It is read through a plain file input into an ArrayBuffer;
 *    nothing is uploaded to the Foundry server and nothing is written to the data directory.
 *  - Nothing is written into packs/. The extracted text goes into a world setting and is applied
 *    at render time (see documents/item.mjs), so it stays in the GM's world, never reaches the
 *    system's own files, and cannot end up in a release.
 *  - The watermark is recorded, not enforced. Renegade stamps most PDFs with a purchase line, but
 *    not all of them - the My Little Pony Core Rulebook and Field Guide to Action and Adventure
 *    carry none - so requiring one would lock out books a GM legitimately owns. It is kept as an
 *    attestation next to the import, and its absence is reported rather than punished.
 */
export default class BookDescriptionImporter extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "book-description-importer",
    classes: ["essence20", "theme-wrapper", "e20-window", "book-description-importer"],
    tag: "div",
    window: {
      icon: "fa-solid fa-book-open-reader",
      title: "E20.BookImportTitle",
      resizable: true,
    },
    position: {
      width: 720,
      height: 640,
    },
    actions: {
      chooseFile: BookDescriptionImporter.#onChooseFile,
      apply: BookDescriptionImporter.#onApply,
      toggleEntry: BookDescriptionImporter.#onToggleEntry,
      clearBook: BookDescriptionImporter.#onClearBook,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/book-description-importer.hbs",
      scrollable: [".book-import-results"],
    },
  };

  /** @type {?Object} The result of the last scan, awaiting the GM's confirmation. */
  #scan = null;

  /** @type {string} A progress line shown while a scan runs. */
  #status = "";

  /** @type {Set<string>} Item uuids the GM has unticked in the preview. */
  #excluded = new Set();

  async _prepareContext() {
    const stored = game.settings.get("essence20", "bookDescriptions") ?? {};
    const books = Object.entries(stored).map(([book, data]) => ({
      book,
      count: Object.keys(data.descriptions ?? {}).length,
      purchaser: data.purchaser ?? null,
      purchaseDate: data.purchaseDate ?? null,
      importedAt: data.importedAt ? new Date(data.importedAt).toLocaleDateString() : null,
    })).sort((a, b) => a.book.localeCompare(b.book));

    // The excluded set is flagged onto each entry here rather than tested in the template:
    // Handlebars has no membership helper registered in this system, and a Set is not something
    // a template can look into anyway.
    const scan = this.#scan && {
      ...this.#scan,
      entries: this.#scan.entries.map(entry => ({
        ...entry,
        excluded: this.#excluded.has(entry.uuid),
      })),
    };

    return {
      books,
      status: this.#status,
      scan,
      hasScan: !!scan,
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    applyThemeClass(this.element);

    // The file input is intentionally a real <input type="file"> rather than Foundry's FilePicker:
    // FilePicker browses the SERVER's data directory, which would mean uploading the book first.
    // This way the bytes go straight from the GM's disk into this tab and no further.
    const input = this.element.querySelector('input[type="file"]');
    input?.addEventListener("change", event => this.#scanFile(event.target.files?.[0]));
  }

  /* -------------------------------------------- */
  /*  Scanning                                    */
  /* -------------------------------------------- */

  /**
   * Read a PDF and work out which compendium items it can describe.
   * @param {File} file
   */
  async #scanFile(file) {
    if (!file) return;

    try {
      this.#status = game.i18n.localize("E20.BookImportStatusLoading");
      this.#scan = null;
      await this.render();

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
          })));

        // Re-rendering every page would be slower than the parse itself; every 25 is enough to
        // show the bar moving on a 350-page book.
        if (n % 25 === 0) {
          this.#status = game.i18n.format("E20.BookImportStatusReading", { page: n, total: doc.numPages });
          await this.render();
        }
      }

      this.#status = game.i18n.localize("E20.BookImportStatusMatching");
      await this.render();

      this.#scan = await this.#matchItems(file.name, pages, widths);
      this.#excluded = new Set();
      this.#status = "";
      await this.render();
    } catch (error) {
      console.error("Essence20 | Book description import failed", error);
      ui.notifications.error(game.i18n.localize("E20.BookImportError"));
      this.#status = "";
      this.#scan = null;
      await this.render();
    }
  }

  /**
   * Decide which book this PDF is, then pull an entry for each of its items.
   * @param {string} fileName
   * @param {Array<Array<Object>>} pages
   * @param {Array<number>} widths
   * @returns {Promise<Object>} The scan result for the preview.
   */
  async #matchItems(fileName, pages, widths) {
    const watermark = findWatermark(pages);
    const bodySize = findBodyFontSize(pages);
    const textFloor = findTextFloor(pages, bodySize);
    const folio = calibrateFolioOffset(pages, textFloor);
    const orders = pages.map((runs, index) => buildReadingOrder(runs, widths[index], textFloor));

    const candidates = await this.#candidateItems();

    // Which book is this? Try each book the compendium knows about and keep whichever produces
    // the most matches. That is more reliable than reading the PDF's title - these files are
    // named inconsistently and their embedded metadata is often blank or wrong - and it costs
    // only one pass per book, over the books' own item lists rather than the whole PDF.
    let best = null;
    for (const [book, items] of candidates) {
      const matched = [];
      for (const item of items) {
        const found = findEntry(orders, item.page, folio.offset, item.name, bodySize, item.type);
        if (found) {
          matched.push({
            ...item, text: found.text, foundPage: found.page,
            continued: found.continued, loose: found.loose,
          });
        }
      }

      if (!best || matched.length > best.matched.length) {
        best = { book, matched, total: items.length };
      }
    }

    // A PDF of something this compendium has no items for (or a completely unrelated file) should
    // say so rather than quietly present a nearly-empty list as a result.
    const ratio = best && best.total ? best.matched.length / best.total : 0;
    return {
      fileName,
      pageCount: pages.length,
      watermark,
      folio,
      bodySize,
      recognised: ratio >= 0.25,
      book: best?.book ?? null,
      total: best?.total ?? 0,
      entries: (best?.matched ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  /**
   * Every narrative item in the compendium that records a book and page, grouped by book.
   * @returns {Promise<Map<string, Array<Object>>>}
   */
  async #candidateItems() {
    const byBook = new Map();

    for (const pack of game.packs) {
      if (pack.documentName !== "Item") continue;

      // The index carries type but not system.source, so ask for the two fields we need. This is
      // one indexing pass per pack, not a document load.
      const index = await pack.getIndex({ fields: ["system.source.book", "system.source.page"] });
      for (const entry of index) {
        if (!NARRATIVE_TYPES.includes(entry.type)) continue;
        const source = entry.system?.source;
        if (!source?.book || !source.page) continue;

        const book = normalizeBookTitle(source.book);
        if (!byBook.has(book)) byBook.set(book, []);
        byBook.get(book).push({
          uuid: `Compendium.${pack.metadata.id}.Item.${entry._id}`,
          name: entry.name,
          type: entry.type,
          page: source.page,
        });
      }
    }

    return byBook;
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  /** Opens the OS file dialog by way of the hidden input. */
  static #onChooseFile() {
    this.element.querySelector('input[type="file"]')?.click();
  }

  /**
   * Untick (or re-tick) one entry so it is left out of the import.
   * @param {PointerEvent} event
   */
  static #onToggleEntry(event) {
    const uuid = event.target.closest("[data-uuid]")?.dataset.uuid;
    if (!uuid) return;

    if (this.#excluded.has(uuid)) this.#excluded.delete(uuid);
    else this.#excluded.add(uuid);
    this.render();
  }

  /** Writes the confirmed entries into the world. */
  static async #onApply() {
    if (!this.#scan) return;

    const descriptions = {};
    for (const entry of this.#scan.entries) {
      if (this.#excluded.has(entry.uuid)) continue;
      descriptions[entry.uuid] = entry.text;
    }

    const stored = foundry.utils.deepClone(game.settings.get("essence20", "bookDescriptions") ?? {});
    stored[this.#scan.book] = {
      descriptions,
      purchaser: this.#scan.watermark?.purchaser ?? null,
      purchaseDate: this.#scan.watermark?.date ?? null,
      importedAt: Date.now(),
      importedBy: game.user.name,
      fileName: this.#scan.fileName,
    };

    await game.settings.set("essence20", "bookDescriptions", stored);

    // Items already prepared are holding the old (empty) description, so re-prepare everything
    // that could be showing one.
    for (const actor of game.actors) actor.prepareData();
    for (const app of foundry.applications.instances.values()) app.render?.();

    ui.notifications.info(game.i18n.format("E20.BookImportApplied", {
      count: Object.keys(descriptions).length,
      book: this.#scan.book,
    }));

    this.#scan = null;
    this.#excluded = new Set();
    this.render();
  }

  /**
   * Forgets everything imported for one book.
   * @param {PointerEvent} event
   */
  static async #onClearBook(event) {
    const book = event.target.closest("[data-book]")?.dataset.book;
    if (!book) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("E20.BookImportClearTitle") },
      content: `<p>${game.i18n.format("E20.BookImportClearConfirm", { book })}</p>`,
    });
    if (!confirmed) return;

    const stored = foundry.utils.deepClone(game.settings.get("essence20", "bookDescriptions") ?? {});
    delete stored[book];
    await game.settings.set("essence20", "bookDescriptions", stored);

    for (const actor of game.actors) actor.prepareData();
    for (const app of foundry.applications.instances.values()) app.render?.();
    this.render();
  }
}
