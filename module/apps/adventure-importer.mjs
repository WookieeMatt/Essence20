import { applyThemeClass } from "../settings.js";
import { readPdf, readImageRects, renderRegion } from "../helpers/pdf-reader.mjs";
import {
  findBodyFontSize, findTextFloor, findFurnitureBands, buildReadingOrder,
} from "../helpers/book-descriptions.mjs";
import {
  flattenOutline, readSections, buildJournalEntries, mapSections,
} from "../helpers/book-journal.mjs";
import {
  findPageFurniture, pickMapImage, samplePages, mapFileName, mapFileNames,
} from "../helpers/book-maps.mjs";
import {
  findThreatSpans, spanText, actorTypeFor, markerPages,
} from "../helpers/book-threats.mjs";
import { splitStatBlocks, parseStatBlock } from "../helpers/stat-block-parser.mjs";
import { extractRollTables } from "../helpers/book-tables.mjs";
import { createActorFromStatBlock } from "../helpers/stat-block-import.mjs";
import { loadCompendiumEntries, buildMatchIndex, findMatches } from "../helpers/stat-block-match.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * The longest side of an imported map, in pixels.
 *
 * These maps are printed about 480pt across, so this renders them at roughly four times their
 * printed size - enough that a five-foot square is around sixty pixels, which is what Foundry's
 * own default grid expects, without making a twenty-megabyte file out of a single page.
 */
const MAP_PIXELS = 1600;

/** Maps are written here, under the world, so an import can be found and removed as a whole. */
const MAP_DIR = "adventure-maps";

/**
 * GM screen for turning an adventure PDF the GM owns into Journal Entries.
 *
 * Separate from the description importer because it makes DOCUMENTS rather than filling in fields:
 * real Journal Entries in the world, which the GM then owns and edits like anything else. There is
 * no render-time injection and no world setting - once imported, the text is theirs.
 *
 * The structure is the book's own. These adventures carry a PDF outline (Operation: Cold Iron has
 * 244 nested entries, down to individual rooms) so nothing has to be guessed about what is a
 * chapter and what is a section. A book with no outline cannot be imported here, and says so,
 * rather than being carved up by a heuristic that would get it wrong quietly.
 *
 * As with the description importer: the PDF is read in the browser through a plain file input and
 * never uploaded, and nothing is written until the GM has seen what was found and said yes.
 */
export default class AdventureImporter extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "essence20-adventure-importer",
    classes: ["essence20", "theme-wrapper", "e20-window", "adventure-importer"],
    tag: "div",
    window: {
      icon: "fa-solid fa-book-atlas",
      title: "E20.AdventureImportTitle",
      resizable: true,
    },
    position: {
      width: 720,
      height: 640,
    },
    actions: {
      chooseFile: AdventureImporter.#onChooseFile,
      apply: AdventureImporter.#onApply,
      toggleEntry: AdventureImporter.#onToggleEntry,
      toggleMap: AdventureImporter.#onToggleMap,
      toggleThreat: AdventureImporter.#onToggleThreat,
      toggleTable: AdventureImporter.#onToggleTable,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/adventure-importer.hbs",
      // The whole panel scrolls, and the entry list again inside it - an adventure can have two
      // hundred sections and the Import button should not be two hundred lines down.
      scrollable: ["", ".adventure-import-results"],
    },
  };

  /** @type {?Object} The result of the last scan, awaiting the GM's confirmation. */
  #scan = null;

  /** @type {string} A progress line shown while a scan runs. */
  #status = "";

  /** @type {Set<string>} Entry names the GM has unticked in the preview. */
  #excluded = new Set();

  /** @type {Set<number>} Indices of threats the GM has unticked in the preview. */
  #excludedThreats = new Set();

  /** @type {Set<number>} Indices of roll tables the GM has unticked in the preview. */
  #excludedTables = new Set();

  /**
   * @type {Set<number>} Pages whose map the GM has unticked in the preview.
   *
   * Kept by page rather than by name because a book prints the same place twice - unticking
   * one "Extensive Enterprises" would otherwise untick both.
   */
  #excludedMaps = new Set();

  async _prepareContext() {
    const scan = this.#scan && {
      ...this.#scan,
      entries: this.#scan.entries.map(entry => ({
        ...entry,
        pageCount: entry.pages.length,
        // Foundry has no plural forms, so the two spellings are chosen here rather than in the
        // template, where a chapter with one section would read "1 pages".
        pageLabel: game.i18n.localize(entry.pages.length === 1
          ? "E20.AdventureImportPageSuffix"
          : "E20.AdventureImportPagesSuffix"),
        chars: entry.pages.reduce((total, page) => total + page.text.length, 0),
        excluded: this.#excluded.has(entry.name),
      })),
      maps: this.#scan.maps.map(map => ({
        ...map,
        size: map.rect ? `${Math.round(map.rect.w)} \u00d7 ${Math.round(map.rect.h)}` : "",
        excluded: this.#excludedMaps.has(map.page),
      })),
      threats: this.#scan.threats.map((threat, index) => ({
        index,
        name: threat.ir.name,
        threatLevel: threat.ir.threatLevel,
        isVehicle: threat.type === "vehicle",
        page: threat.page + 1,
        // Shown rather than hidden: the parser reports what it could not read instead of
        // dropping it, and a GM would rather know before the Actor exists than after.
        warnings: threat.ir.diagnostics?.length ?? 0,
        excluded: this.#excludedThreats.has(index),
      })),
      tables: this.#scan.tables.map((table, index) => ({
        index,
        name: table.name,
        die: table.die,
        page: table.page + 1,
        rowCount: table.rows.length,
        // Worth saying: a book that heads a d20 table "D12" would otherwise make a table whose
        // last eight entries could never come up.
        widened: table.die !== table.printedDie,
        excluded: this.#excludedTables.has(index),
      })),
    };

    return { status: this.#status, scan, hasScan: !!scan };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    applyThemeClass(this.element);

    const input = this.element.querySelector('input[type="file"]');
    input?.addEventListener("change", event => this.#scanFile(event.target.files?.[0]));
  }

  /* -------------------------------------------- */
  /*  Scanning                                    */
  /* -------------------------------------------- */

  /**
   * Read an adventure PDF and work out what journal it would make.
   * @param {File} file
   */
  async #scanFile(file) {
    if (!file) return;

    try {
      this.#status = game.i18n.localize("E20.AdventureImportStatusReading");
      this.#scan = null;
      await this.render();

      const { pages, widths, outline, doc } = await readPdf(file, async (page, total) => {
        this.#status = game.i18n.format("E20.BookImportStatusReading", { page, total });
        await this.render();
      });

      this.#status = game.i18n.localize("E20.AdventureImportStatusBuilding");
      await this.render();

      const bodySize = findBodyFontSize(pages);
      const textFloor = findTextFloor(pages, bodySize);
      const furniture = findFurnitureBands(pages, bodySize);
      const orders = pages.map((runs, index) => buildReadingOrder(runs, widths[index], textFloor, furniture));

      const nodes = flattenOutline(outline);
      const sections = nodes.length ? readSections(nodes, orders, bodySize) : [];

      const maps = await this.#findMaps(doc, mapSections(sections));
      const threats = AdventureImporter.#findThreats(orders, bodySize);
      const tables = orders.flatMap((runs, index) =>
        extractRollTables(runs, bodySize, widths[index]).map(table => ({ ...table, page: index })));

      this.#scan = {
        fileName: file.name,
        pageCount: pages.length,
        hasOutline: nodes.length > 0,
        entries: buildJournalEntries(sections),
        maps,
        threats,
        tables,
        doc,
      };
      this.#excluded = new Set();
      this.#excludedMaps = new Set();
      this.#excludedThreats = new Set();
      this.#excludedTables = new Set();
      this.#status = "";
      await this.render();
    } catch (error) {
      console.error("Essence20 | Adventure import failed", error);
      ui.notifications.error(game.i18n.localize("E20.AdventureImportError"));
      this.#status = "";
      this.#scan = null;
      await this.render();
    }
  }

  /**
   * Work out which part of each map page is the map.
   *
   * Nothing is rendered here - a map page is only measured, so the preview can say what was
   * found and how big it is before the GM commits to writing any files.
   * @param {Object} doc   The open pdf.js document.
   * @param {Array<{title: string, page: number}>} found   From mapSections().
   * @returns {Promise<Array<Object>>} Each with the rectangle to render, or null if it has none.
   */
  async #findMaps(doc, found) {
    if (!found.length) return [];

    this.#status = game.i18n.localize("E20.AdventureImportStatusMaps");
    await this.render();

    const wanted = found.map(map => map.page);
    const rects = await readImageRects(doc, samplePages(doc.numPages, wanted), async (done, total) => {
      this.#status = game.i18n.format("E20.AdventureImportStatusMapPages", { page: done, total });
      await this.render();
    });

    const furniture = findPageFurniture([...rects.values()]);
    return found.map(map => {
      const page = rects.get(map.page);
      const [width, height] = page?.pageSize ?? [0, 0];
      return { ...map, rect: page ? pickMapImage(page.images, width, height, furniture) : null };
    });
  }

  /**
   * Read every stat block printed in the book.
   *
   * Nothing here parses a stat block. helpers/stat-block-parser.mjs has understood three printed
   * dialects since the Stat Block Importer was built, and it takes exactly what a GM would get by
   * selecting a page in a PDF reader - so the work is to rebuild those lines and hand them over.
   * @param {Array<Array<Object>>} orders   Runs per page, in reading order.
   * @param {number} bodySize
   * @returns {Array<{page: number, ir: Object}>}
   */
  static #findThreats(orders, bodySize) {
    const threats = [];
    for (const span of findThreatSpans(orders, bodySize)) {
      const blocks = splitStatBlocks(spanText(orders, span));
      const pages = markerPages(orders, span);
      for (const [i, block] of blocks.entries()) {
        const ir = parseStatBlock(block);
        // The printed text is kept so the stat editor can re-parse it later, exactly as it
        // can for a block the GM pasted in by hand.
        if (!ir.name) continue;
        threats.push({
          page: pages[i] ?? span.start, ir, raw: block, type: actorTypeFor(ir),
        });
      }
    }

    return threats;
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
    const name = event.target.closest("[data-entry]")?.dataset.entry;
    if (!name) return;

    if (this.#excluded.has(name)) this.#excluded.delete(name);
    else this.#excluded.add(name);
    this.render();
  }

  /**
   * Render one section as the HTML of a journal page.
   *
   * The paragraphs and sub-headings helpers/book-journal.mjs recovered from the print, escaped:
   * this is the GM's own PDF but it is still untrusted text going into a document, and a stray
   * angle bracket in a stat line should read as one rather than open a tag.
   * @param {{blocks: Array<{type: string, text: string}>, text: string}} page
   * @returns {string}
   */
  static #toHtml(page) {
    const escape = foundry.utils.escapeHTML;
    const blocks = page.blocks?.length ? page.blocks : [{ type: "p", text: page.text }];
    // h4 rather than h3: the page's own title is already rendered at up to level 3.
    return blocks
      .map(block => (block.type === "heading"
        ? `<h4>${escape(block.text)}</h4>`
        : `<p>${escape(block.text)}</p>`))
      .join("");
  }

  /**
   * Untick (or re-tick) one map so it is left out of the import.
   * @param {PointerEvent} event
   */
  static #onToggleMap(event) {
    const page = Number(event.target.closest("[data-map]")?.dataset.map);
    if (!Number.isInteger(page)) return;

    if (this.#excludedMaps.has(page)) this.#excludedMaps.delete(page);
    else this.#excludedMaps.add(page);
    this.render();
  }

  /**
   * Untick (or re-tick) one roll table so it is left out of the import.
   * @param {PointerEvent} event
   */
  static #onToggleTable(event) {
    const index = Number(event.target.closest("[data-table]")?.dataset.table);
    if (!Number.isInteger(index)) return;

    if (this.#excludedTables.has(index)) this.#excludedTables.delete(index);
    else this.#excludedTables.add(index);
    this.render();
  }

  /**
   * Make a RollTable of each chosen table.
   *
   * Cheap next to the maps and the threats - nothing is rendered and nothing is matched against
   * the compendium, so they all go in one call.
   * @param {string} folderName
   * @returns {Promise<number>} How many RollTables were created.
   */
  async #createTables(folderName) {
    const wanted = this.#scan.tables.filter((table, index) => !this.#excludedTables.has(index));
    if (!wanted.length) return 0;

    const folder = await AdventureImporter.#folder("RollTable", folderName);
    const created = await RollTable.createDocuments(wanted.map(table => ({
      name: table.name,
      folder: folder.id,
      formula: `1${table.die}`,
      results: table.rows.map(row => ({
        type: CONST.TABLE_RESULT_TYPES.TEXT,
        // A text result keeps its words in `name`; there is no `text` field any more.
        name: row.text,
        range: [row.low, row.high],
      })),
    })));

    return created.length;
  }

  /**
   * Untick (or re-tick) one threat so it is left out of the import.
   * @param {PointerEvent} event
   */
  static #onToggleThreat(event) {
    const index = Number(event.target.closest("[data-threat]")?.dataset.threat);
    if (!Number.isInteger(index)) return;

    if (this.#excludedThreats.has(index)) this.#excludedThreats.delete(index);
    else this.#excludedThreats.add(index);
    this.render();
  }

  /**
   * Make an Actor of each chosen stat block.
   *
   * Compendium matching is done once for the whole import rather than per threat: loading the
   * index is the expensive part, and an adventure has three dozen blocks sharing one cast of
   * Perks and Powers. A matched Perk arrives as a real compendium copy with its Active Effects,
   * rather than as a bare Item carrying only its printed name.
   * @param {string} folderName
   * @returns {Promise<number>} How many Actors were created.
   */
  async #createThreats(folderName) {
    const wanted = this.#scan.threats.filter((threat, index) => !this.#excludedThreats.has(index));
    if (!wanted.length) return 0;

    this.#status = game.i18n.localize("E20.AdventureImportStatusThreats");
    await this.render();

    const index = buildMatchIndex(await loadCompendiumEntries());
    const folder = await AdventureImporter.#folder("Actor", folderName);

    let made = 0;
    for (const threat of wanted) {
      this.#status = game.i18n.format("E20.AdventureImportStatusThreat", { name: threat.ir.name });
      await this.render();

      try {
        const actor = await createActorFromStatBlock(threat.ir, {
          matches: findMatches(threat.ir, index),
          folder: folder.id,
          type: threat.type,
          raw: threat.raw,
        });
        if (actor) made++;
      } catch (error) {
        // One stat block the builder cannot make an Actor of should not cost the GM the other
        // thirty-five, so it is reported and the import carries on.
        console.error(`Essence20 | Could not create the threat "${threat.ir.name}"`, error);
        ui.notifications.warn(game.i18n.format("E20.AdventureImportThreatFailed", {
          name: threat.ir.name,
        }));
      }
    }

    return made;
  }

  /**
   * Render the chosen maps, write them under the world and make a Scene of each.
   *
   * The image has to be a real file before a Scene can point at it, so this is the one part of
   * the importer that writes outside the world database. Everything lands in one directory named
   * after the book, so an import the GM regrets is one folder to delete.
   * @param {string} folderName   The book, which names both the directory and the Scene folder.
   * @returns {Promise<number>} How many Scenes were created.
   */
  async #createScenes(folderName) {
    const wanted = this.#scan.maps.filter(map => map.rect && !this.#excludedMaps.has(map.page));
    if (!wanted.length) return 0;

    const fileNames = mapFileNames(wanted);

    const FilePicker = foundry.applications.apps.FilePicker.implementation;
    const base = `worlds/${game.world.id}/${MAP_DIR}`;
    const directory = `${base}/${mapFileName(folderName)}`;
    // createDirectory throws when the directory is already there, which is not a failure.
    for (const path of [base, directory]) {
      try {
        await FilePicker.createDirectory("data", path);
      } catch {
        // already present
      }
    }

    const folder = await AdventureImporter.#folder("Scene", folderName);
    const data = [];
    for (const [i, map] of wanted.entries()) {
      this.#status = game.i18n.format("E20.AdventureImportStatusMapRender", { name: map.title });
      await this.render();

      const canvas = await renderRegion(this.#scan.doc, map.page, map.rect, MAP_PIXELS);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.92));
      const name = `${fileNames[i]}.webp`;
      const upload = await FilePicker.upload("data", directory, new File([blob], name, {
        type: "image/webp",
      }), {}, { notify: false });

      if (!upload?.path) continue;
      data.push({
        name: map.title,
        folder: folder.id,
        width: canvas.width,
        height: canvas.height,
        padding: 0,
        // Foundry's own default, because nothing here knows what a square on this map is worth.
        // The GM aligns it with the grid tool, which is a job for eyes rather than for this.
        grid: { type: CONST.GRID_TYPES.SQUARE },
        levels: [{ name: map.title, background: { src: upload.path } }],
      });
    }

    const scenes = await Scene.createDocuments(data);
    // A thumbnail is what the sidebar shows; without one every imported scene is a grey square.
    for (const scene of scenes) {
      try {
        const thumb = await scene.createThumbnail();
        await scene.update({ thumb: thumb.thumb }, { diff: false });
      } catch (error) {
        console.warn(`Essence20 | No thumbnail for scene "${scene.name}"`, error);
      }
    }

    return scenes.length;
  }

  /**
   * The folder an import lands in, made if it is not there already.
   * @param {string} type   A document type.
   * @param {string} name
   * @returns {Promise<Folder>}
   */
  static async #folder(type, name) {
    return game.folders.find(folder => folder.type === type && folder.name === name)
      ?? await Folder.create({ name, type });
  }

  /** Creates the Journal Entries. */
  static async #onApply() {
    if (!this.#scan) return;

    const wanted = this.#scan.entries.filter(entry => !this.#excluded.has(entry.name));
    const maps = this.#scan.maps.filter(map => map.rect && !this.#excludedMaps.has(map.page));
    const threats = this.#scan.threats.filter((t, i) => !this.#excludedThreats.has(i));
    const tables = this.#scan.tables.filter((t, i) => !this.#excludedTables.has(i));
    if (!wanted.length && !maps.length && !threats.length && !tables.length) return;

    // A folder named for the book, so an import lands in one place and can be removed in one.
    const folderName = this.#scan.fileName.replace(/\.pdf$/i, "");
    const folder = await AdventureImporter.#folder("JournalEntry", folderName);

    const data = wanted.map(entry => ({
      name: entry.name,
      folder: folder.id,
      pages: entry.pages.map((page, index) => ({
        name: page.name,
        type: "text",
        // The section's own nesting, so a room stays visibly a room rather than becoming a
        // sibling of the Mission it sits in.
        title: { show: true, level: Math.min(3, page.depth + 1) },
        sort: (index + 1) * 100,
        text: { content: AdventureImporter.#toHtml(page), format: 1 },
      })),
    }));

    const created = data.length ? await JournalEntry.createDocuments(data) : [];
    const scenes = await this.#createScenes(folderName);
    const actors = await this.#createThreats(folderName);
    const rollTables = await this.#createTables(folderName);

    ui.notifications.info(game.i18n.format("E20.AdventureImportDone", {
      entries: created.length,
      pages: data.reduce((total, entry) => total + entry.pages.length, 0),
      scenes,
      threats: actors,
      tables: rollTables,
      folder: folderName,
    }));

    this.#scan = null;
    this.#excluded = new Set();
    this.#excludedMaps = new Set();
    this.#excludedThreats = new Set();
    this.#excludedTables = new Set();
    this.#status = "";
    this.render();
  }
}
