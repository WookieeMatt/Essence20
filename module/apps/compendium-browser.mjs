import { applyThemeClass } from "../settings.js";
import { getGroupedItemPacks, getVisibleItemPacks } from "../helpers/compendium-browser.mjs";
import CompendiumBrowserSourceConfig from "./compendium-browser-sources.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A filterable, searchable browser for every Item across the enabled sourcebook
 * compendiums. Books a GM has disabled (see CompendiumBrowserSourceConfig) are
 * excluded for everyone except the GM, who always sees every book.
 */
export default class Essence20CompendiumBrowser extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);

    this._index = null;
    this._visiblePackIds = new Set();
    this._availableTypes = [];
    this._filters = {
      search: "",
      excludedBooks: new Set(),
      excludedTypes: new Set(),
    };
  }

  static DEFAULT_OPTIONS = {
    id: "essence20-compendium-browser",
    classes: ["essence20", "theme-wrapper", "compendium-browser"],
    tag: "div",
    window: {
      icon: "fa-solid fa-book-atlas",
      title: "E20.CompendiumBrowserTitle",
      resizable: true,
    },
    position: {
      width: 900,
      height: 700,
    },
    actions: {
      configureSources: this.#onConfigureSources,
      openItem: this.#onOpenItem,
      selectAllBooks: this.#onSelectAllBooks,
      selectNoBooks: this.#onSelectNoBooks,
      selectAllTypes: this.#onSelectAllTypes,
      selectNoTypes: this.#onSelectNoTypes,
    },
  };

  static PARTS = {
    filters: {
      template: "systems/essence20/templates/app/compendium-browser-filters.hbs",
      scrollable: [""],
    },
    results: {
      template: "systems/essence20/templates/app/parts/compendium-browser-results.hbs",
      scrollable: [""],
    },
  };

  /* -------------------------------------------- */
  /*  Context                                      */
  /* -------------------------------------------- */

  async _prepareContext() {
    if (!this._index) {
      await this._buildIndex();
    }

    const groups = getGroupedItemPacks()
      .map(group => ({
        name: group.name,
        packs: group.packs
          .filter(pack => this._visiblePackIds.has(pack.metadata.id))
          .map(pack => ({
            id: pack.metadata.id,
            label: pack.metadata.label,
            checked: !this._filters.excludedBooks.has(pack.metadata.id),
          })),
      }))
      .filter(group => group.packs.length);

    const types = this._availableTypes
      .map(type => ({
        key: type,
        label: game.i18n.localize(`TYPES.Item.${type}`),
        checked: !this._filters.excludedTypes.has(type),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const results = this._getFilteredResults();

    return {
      groups,
      types,
      search: this._filters.search,
      results,
      resultCount: results.length,
      isGM: game.user.isGM,
    };
  }

  /** Pull a flat, filterable index of every visible Item pack's contents. */
  async _buildIndex() {
    const packs = getVisibleItemPacks();
    this._visiblePackIds = new Set(packs.map(pack => pack.metadata.id));

    const entries = [];
    const types = new Set();

    for (const pack of packs) {
      const index = await pack.getIndex({
        fields: ["img", "type", "system.source.book", "system.source.page"],
      });

      for (const entry of index.values()) {
        types.add(entry.type);
        entries.push({
          uuid: entry.uuid,
          name: entry.name,
          img: entry.img || "icons/svg/item-bag.svg",
          type: entry.type,
          typeLabel: game.i18n.localize(`TYPES.Item.${entry.type}`),
          book: pack.metadata.label,
          bookId: pack.metadata.id,
          page: entry.system?.source?.page ?? null,
        });
      }
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));
    this._index = entries;
    this._availableTypes = Array.from(types).sort();
  }

  _getFilteredResults() {
    const search = this._filters.search.trim().toLowerCase();

    return this._index.filter(entry => {
      if (this._filters.excludedBooks.has(entry.bookId)) return false;
      if (this._filters.excludedTypes.has(entry.type)) return false;
      if (search && !entry.name.toLowerCase().includes(search)) return false;
      return true;
    });
  }

  /** Drop the cached index and fully re-render, e.g. after the GM changes enabled sources. */
  refresh() {
    this._index = null;
    return this.render();
  }

  /* -------------------------------------------- */
  /*  Rendering                                    */
  /* -------------------------------------------- */

  _onRender(context, options) {
    super._onRender(context, options);

    applyThemeClass(this.element);

    if (options.parts.includes("filters")) {
      this._activateFilterListeners();
    }

    if (options.parts.includes("results")) {
      this._activateResultListeners();
    }
  }

  _activateFilterListeners() {
    const filtersEl = this.element.querySelector('[data-application-part="filters"]');
    if (!filtersEl) return;

    for (const checkbox of filtersEl.querySelectorAll("[data-pack-id]")) {
      checkbox.addEventListener("change", () => {
        const id = checkbox.dataset.packId;
        if (checkbox.checked) this._filters.excludedBooks.delete(id);
        else this._filters.excludedBooks.add(id);
        this.render({ parts: ["results"] });
      });
    }

    for (const checkbox of filtersEl.querySelectorAll("[data-item-type]")) {
      checkbox.addEventListener("change", () => {
        const type = checkbox.dataset.itemType;
        if (checkbox.checked) this._filters.excludedTypes.delete(type);
        else this._filters.excludedTypes.add(type);
        this.render({ parts: ["results"] });
      });
    }

    const searchInput = filtersEl.querySelector('input[name="search"]');
    if (searchInput) {
      searchInput.addEventListener("input", foundry.utils.debounce(() => {
        this._filters.search = searchInput.value;
        this.render({ parts: ["results"] });
      }, 200));
    }
  }

  _activateResultListeners() {
    const resultsEl = this.element.querySelector('[data-application-part="results"]');
    if (!resultsEl) return;

    new CONFIG.ux.DragDrop({
      dragSelector: "[data-uuid]",
      dropSelector: null,
      permissions: { dragstart: () => true },
      callbacks: { dragstart: this._onDragStart.bind(this) },
    }).bind(resultsEl);
  }

  _onDragStart(event) {
    const uuid = event.currentTarget.dataset.uuid;
    if (!uuid) return;

    event.dataTransfer.setData("text/plain", JSON.stringify({ type: "Item", uuid }));
  }

  /* -------------------------------------------- */
  /*  Actions                                      */
  /* -------------------------------------------- */

  static #onConfigureSources() {
    new CompendiumBrowserSourceConfig().render(true);
  }

  static async #onOpenItem(event, target) {
    const uuid = target.dataset.uuid;
    if (!uuid) return;

    const item = await fromUuid(uuid);
    item?.sheet?.render(true);
  }

  static #onSelectAllBooks() {
    this._filters.excludedBooks.clear();
    this.render({ parts: ["filters", "results"] });
  }

  static #onSelectNoBooks() {
    this._filters.excludedBooks = new Set(this._visiblePackIds);
    this.render({ parts: ["filters", "results"] });
  }

  static #onSelectAllTypes() {
    this._filters.excludedTypes.clear();
    this.render({ parts: ["filters", "results"] });
  }

  static #onSelectNoTypes() {
    this._filters.excludedTypes = new Set(this._availableTypes);
    this.render({ parts: ["filters", "results"] });
  }
}
