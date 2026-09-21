import { applyThemeClass } from "../settings.js";
import { getGroupedItemPacks, getVisibleItemPacks } from "../helpers/compendium-browser.mjs";
import CompendiumBrowserSourceConfig from "./compendium-browser-sources.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Item types merged into one tab instead of getting a tab each. A group's tab gets
 * its own "Type" filter (see #_getSecondaryFilterDefinition) to tell its members apart.
 */
const TYPE_GROUPS = {
  equipment: {
    labelKey: "E20.CompendiumBrowserEquipmentTab",
    types: ["armor", "equipmentPackage", "gear", "magicBauble", "shield", "upgrade", "weapon", "weaponEffect"],
  },
};

/**
 * Per-item-type sub-filters, keyed by item type. Each entry adds an extra filter
 * group to the sidebar whenever that type's tab is active, sourced from a `system.*`
 * field. `choices` returns a static {key: labelKey} map (usually a CONFIG.E20 enum);
 * set `dynamic: true` instead when the choices have to be read off the built index
 * (e.g. Focus's parent Role isn't a fixed enum) - see #getDynamicChoices. `extract`
 * is only needed when the raw field isn't already the value to filter on.
 */
const SUBTYPE_FILTERS = {
  focus: {
    // A Focus references its parent Role as a "role"-type entry inside its own
    // system.items snapshot (see module/sheet-handlers/role-handler.mjs onFocusDrop) -
    // there's no simpler field for this, and no fixed enum of Role names to filter by.
    field: "items",
    labelKey: "E20.CompendiumBrowserFilterRole",
    extract: systemItems => Object.values(systemItems ?? {}).find(item => item.type === "role")?.name ?? null,
    dynamic: true,
  },
  perk: {
    field: "type",
    labelKey: "E20.CompendiumBrowserFilterPerkType",
    choices: () => CONFIG.E20.perkTypes,
  },
};

/**
 * Extra "facet" filters: the ones that narrow by a property of the item rather than by its type.
 *
 * Deliberately separate from SUBTYPE_FILTERS above, which works by EXCLUSION - everything starts
 * checked and you uncheck what you do not want. That is wrong here. The question a player has is
 * "which weapons are Silent?", which under exclusion semantics would mean unchecking forty other
 * traits to ask. A facet works the other way round: nothing checked means no filtering, and
 * checking narrows to the items that match.
 *
 * Each facet declares:
 *   types   which item types it applies to, and where that type's choices come from. A facet only
 *           appears on a tab that holds at least one of them.
 *   values  the entry's value(s) for this facet, always as an array.
 *   match   how several checked values combine, and this differs per facet for a real reason:
 *
 *           "all" for a multi-valued field. Picking Silent and Sniper means "a silenced sniper",
 *           which is the question worth asking; OR is already available by picking one at a time.
 *
 *           "any" for a single-valued one. No gear is both Tools and Kits, so AND there would
 *           always return nothing - checking two can only sensibly mean "either".
 */
const FACETS = {
  traits: {
    labelKey: "E20.CompendiumBrowserFilterTraits",
    hintKey: "E20.CompendiumBrowserFilterTraitsHint",
    match: "all",
    types: {
      armor: () => CONFIG.E20.armorTraits,
      // A shield carries ARMOR traits, not weapon ones - see data/item/shield.mjs.
      shield: () => CONFIG.E20.armorTraits,
      weapon: () => CONFIG.E20.weaponTraits,
    },
    values: entry => entry.traits,
  },
  /* Gear has no traits at all - checked against the schema and all 256 pack entries, not one has
     the field. What it has is gearType, a single category (Tools, Kits, Medical...), which is the
     same question asked of the one kind of equipment that cannot answer the trait one. */
  gearType: {
    labelKey: "E20.CompendiumBrowserFilterGearType",
    hintKey: "E20.CompendiumBrowserFilterGearTypeHint",
    match: "any",
    types: {
      gear: () => CONFIG.E20.gearTypes,
    },
    values: entry => (entry.gearType ? [entry.gearType] : []),
  },
};

/** The tab key a given item type shows up under - its group's key, or just itself. */
function tabKeyForType(type) {
  for (const [key, group] of Object.entries(TYPE_GROUPS)) {
    if (group.types.includes(type)) return key;
  }

  return type;
}

/** The value an entry is compared against for its tab's secondary filter, if any. */
function getSecondaryFilterValue(entry, tabKey) {
  return TYPE_GROUPS[tabKey] ? entry.type : entry.subtype;
}

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
      booksExpanded: true,
      activeType: null,
      excludedSubtypes: {},
      /* Values the user has REQUIRED, not excluded, keyed by facet - see FACETS. All empty means
         no facet filtering, which is the state the browser opens in. */
      requiredFacets: Object.fromEntries(Object.keys(FACETS).map(key => [key, new Set()])),
    };
  }

  static DEFAULT_OPTIONS = {
    id: "essence20-compendium-browser",
    classes: ["essence20", "theme-wrapper", "e20-window", "compendium-browser"],
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
      selectAllBooksInGroup: this.#onSelectAllBooksInGroup,
      selectNoBooksInGroup: this.#onSelectNoBooksInGroup,
      selectAllSubtypes: this.#onSelectAllSubtypes,
      selectNoSubtypes: this.#onSelectNoSubtypes,
      clearTraits: this.#onClearTraits,
      selectType: this.#onSelectType,
    },
  };

  static PARTS = {
    tabs: {
      template: "systems/essence20/templates/app/compendium-browser-tabs.hbs",
    },
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

    // Resolves/repairs this._filters.activeType, so this has to run before the book
    // list below, which only shows books relevant to whichever tab that ends up being.
    const tabs = this._getTabs();
    const relevantBookIds = this._getBookIdsForTab(this._filters.activeType);

    const groups = getGroupedItemPacks()
      .map(group => ({
        name: group.name,
        packs: group.packs
          .filter(pack => relevantBookIds.has(pack.metadata.id))
          .map(pack => ({
            id: pack.metadata.id,
            label: pack.metadata.label,
            checked: !this._filters.excludedBooks.has(pack.metadata.id),
          })),
      }))
      .filter(group => group.packs.length);

    const results = this._getFilteredResults();

    return {
      groups,
      booksExpanded: this._filters.booksExpanded,
      tabs,
      subtypeFilter: this._getSubtypeFilterContext(),
      facets: this._getFacetContexts(),
      search: this._filters.search,
      results,
      resultCount: results.length,
      isGM: game.user.isGM,
    };
  }

  /** Builds the tab list and resolves/repairs the active tab (e.g. after its last book gets disabled). */
  _getTabs() {
    const tabCounts = this._getTabCounts();
    const tabKeys = new Set(this._availableTypes.map(tabKeyForType));

    const tabs = Array.from(tabKeys)
      .map(key => {
        const group = TYPE_GROUPS[key];
        return {
          key,
          label: group ? game.i18n.localize(group.labelKey) : game.i18n.localize(`TYPES.Item.${key}`),
          count: tabCounts.get(key) ?? 0,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    if (!tabs.some(tab => tab.key === this._filters.activeType)) {
      this._filters.activeType = tabs[0]?.key ?? null;
    }

    for (const tab of tabs) {
      tab.active = tab.key === this._filters.activeType;
    }

    return tabs;
  }

  /** Builds the context for the active tab's extra ("Perk Type" / grouped-tab "Type") filter, if it has one. */
  _getSubtypeFilterContext() {
    const activeType = this._filters.activeType;
    const definition = this._getSecondaryFilterDefinition(activeType);
    if (!definition) return null;

    const excluded = this._filters.excludedSubtypes[activeType] ??= new Set();
    const options = Object.entries(definition.choices())
      .map(([key, labelKey]) => ({
        key,
        label: game.i18n.localize(labelKey),
        checked: !excluded.has(key),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return { label: game.i18n.localize(definition.labelKey), options };
  }

  /**
   * The trait filter for the active tab, or null when nothing on it has filterable traits.
   *
   * The choices are the union of every trait enum in play on this tab - the Equipment tab holds
   * both weapons and armor, and a few traits (Sturdy, for one) appear in both enums - narrowed to
   * the traits actually present on the entries the rest of the filters have already left. That
   * last part is what keeps the list usable: the raw weapon enum alone is over forty entries, most
   * of which match nothing in the books the user has enabled.
   */
  /**
   * Every facet that applies to the active tab, in FACETS order, as sidebar groups.
   *
   * A facet's choices are the union of the enums of whichever of its types are on this tab - the
   * Equipment tab holds weapons, armor and shields at once, and a few traits appear in more than
   * one enum - narrowed to the values actually present on the entries the other filters have left.
   * That narrowing is what keeps the list usable: the weapon enum alone is over forty entries, most
   * of which match nothing in the books a given table has enabled.
   */
  _getFacetContexts() {
    return Object.entries(FACETS)
      .map(([key, facet]) => this._getFacetContext(key, facet))
      .filter(Boolean);
  }

  /**
   * One facet's sidebar group, or null when it has nothing to offer on this tab.
   *
   * @param {String} key     A key of FACETS.
   * @param {Object} facet   Its definition.
   * @returns {Object|null}
   */
  _getFacetContext(key, facet) {
    const types = this._typesOnTab(this._filters.activeType).filter(type => facet.types[type]);
    if (!types.length) {
      return null;
    }

    const labels = {};
    for (const type of types) {
      Object.assign(labels, facet.types[type]());
    }

    const required = this._requiredFor(key);
    const present = new Set();
    for (const entry of this._getBookAndSearchFiltered()) {
      if (tabKeyForType(entry.type) !== this._filters.activeType) {
        continue;
      }

      for (const value of facet.values(entry) ?? []) {
        present.add(value);
      }
    }

    /* A required value stays listed even if nothing currently shows it - otherwise picking two
       values with no overlap would make the second vanish from the sidebar, leaving no way to
       un-pick it. */
    for (const value of required) {
      present.add(value);
    }

    const options = Array.from(present)
      .filter(value => labels[value])
      .map(value => ({
        key: value,
        label: game.i18n.localize(labels[value]),
        checked: required.has(value),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    if (!options.length) {
      return null;
    }

    return {
      key,
      label: game.i18n.localize(facet.labelKey),
      hint: game.i18n.localize(facet.hintKey),
      options,
      any: !required.size,
    };
  }

  /**
   * The required-value set for a facet, created on demand so an older stored filter state still
   * works.
   *
   * Refuses a key that is not a real facet rather than making a bucket for it. That distinction
   * matters: a checkbox whose data-facet renders empty - which is exactly what a mistaken `../`
   * in front of a Handlebars block parameter produces - used to drop every click into a bucket
   * nothing reads, so the filter did nothing at all and said nothing about why. Now it complains
   * once and the cause is in the console.
   *
   * @param {String} key   A key of FACETS.
   * @returns {Set|null}
   */
  _requiredFor(key) {
    if (!FACETS[key]) {
      console.warn(`Essence20 | Compendium Browser: no such filter facet "${key}"`);
      return null;
    }

    return this._filters.requiredFacets[key] ??= new Set();
  }
  /** The item types that appear under a tab - a group's members, or the tab itself. */
  _typesOnTab(tabKey) {
    return TYPE_GROUPS[tabKey]?.types ?? [tabKey];
  }

  /**
   * The extra ("secondary") filter definition for a tab, if it has one: a type-group
   * tab's own "Type" filter over its member types, a plain type's SUBTYPE_FILTERS
   * entry, or - for a `dynamic` entry - the same shape built from whatever values are
   * actually present in the index (e.g. Focus's parent Role isn't a fixed enum). All
   * three shapes are {labelKey, choices: () => ({key: labelKey})} so they share one
   * rendering/filtering code path.
   */
  _getSecondaryFilterDefinition(tabKey) {
    const group = TYPE_GROUPS[tabKey];
    if (group) {
      return {
        labelKey: "E20.CompendiumBrowserFilterType",
        choices: () => Object.fromEntries(
          group.types
            .filter(type => this._availableTypes.includes(type))
            .map(type => [type, `TYPES.Item.${type}`]),
        ),
      };
    }

    const config = SUBTYPE_FILTERS[tabKey];
    if (!config) return null;
    if (!config.dynamic) return config;

    const values = new Set();
    for (const entry of this._index) {
      if (entry.type === tabKey && entry.subtype) values.add(entry.subtype);
    }

    return {
      labelKey: config.labelKey,
      choices: () => Object.fromEntries(Array.from(values).sort().map(value => [value, value])),
    };
  }

  /** Pull a flat, filterable index of every visible Item pack's contents. */
  async _buildIndex() {
    const packs = getVisibleItemPacks();
    this._visiblePackIds = new Set(packs.map(pack => pack.metadata.id));

    const subtypeFields = [...new Set(Object.values(SUBTYPE_FILTERS).map(config => `system.${config.field}`))];
    const entries = [];
    const types = new Set();

    for (const pack of packs) {
      const index = await pack.getIndex({
        fields: ["img", "type", "system.source.book", "system.source.page", "system.traits", "system.gearType", ...subtypeFields],
      });

      for (const entry of index.values()) {
        types.add(entry.type);
        const subtypeConfig = SUBTYPE_FILTERS[entry.type];
        const rawSubtypeField = subtypeConfig ? entry.system?.[subtypeConfig.field] : undefined;
        entries.push({
          uuid: entry.uuid,
          name: entry.name,
          img: entry.img || "icons/svg/item-bag.svg",
          type: entry.type,
          typeLabel: game.i18n.localize(`TYPES.Item.${entry.type}`),
          subtype: subtypeConfig ? (subtypeConfig.extract ? subtypeConfig.extract(rawSubtypeField) : rawSubtypeField) : null,
          /* Only for the types a facet actually covers, so an index of several thousand rows does
             not carry an array each for the types nobody filters by. A compendium item has no
             upgrades attached, so traits here is its own authored list - which is the right thing
             to browse by anyway: you are looking for what the book prints. */
          traits: FACETS.traits.types[entry.type] ? (entry.system?.traits ?? []) : null,
          gearType: FACETS.gearType.types[entry.type] ? (entry.system?.gearType ?? null) : null,
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

  /** Entries matching everything except the active tab/secondary filter - the base for both the results list and each tab's count. */
  _getBookAndSearchFiltered() {
    const search = this._filters.search.trim().toLowerCase();

    return this._index.filter(entry => {
      if (this._filters.excludedBooks.has(entry.bookId)) return false;
      if (search && !entry.name.toLowerCase().includes(search)) return false;
      return true;
    });
  }

  _getTabCounts() {
    const counts = new Map();
    for (const entry of this._getBookAndSearchFiltered()) {
      const key = tabKeyForType(entry.type);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return counts;
  }

  _getFilteredResults() {
    const activeType = this._filters.activeType;
    const excluded = this._filters.excludedSubtypes[activeType];

    return this._getBookAndSearchFiltered().filter(entry => {
      if (tabKeyForType(entry.type) !== activeType) return false;
      if (excluded?.has(getSecondaryFilterValue(entry, activeType))) return false;
      return this._matchesFacets(entry);
    });
  }

  /**
   * Whether an entry satisfies every facet that has something required.
   *
   * Facets combine with AND - requiring a weapon trait and a gear category matches nothing, which
   * is honest, since nothing is both. Within a facet, `match` decides: see FACETS.
   *
   * An entry with no value for a facet fails it as soon as that facet requires anything. That is
   * what keeps a coil of rope out of the results for "Silent" while it shares the Equipment tab.
   *
   * @param {Object} entry   An index row.
   * @returns {Boolean}
   */
  _matchesFacets(entry) {
    for (const [key, facet] of Object.entries(FACETS)) {
      const required = this._requiredFor(key);
      if (!required?.size) {
        continue;
      }

      const values = facet.values(entry);
      if (!values?.length) {
        return false;
      }

      if (facet.match === "any") {
        if (!values.some(value => required.has(value))) return false;
      } else {
        for (const value of required) {
          if (!values.includes(value)) return false;
        }
      }
    }

    return true;
  }

  /** The (visible) pack ids that hold at least one item belonging to the given tab, e.g. only the Transformers books have any Alt Mode items. */
  _getBookIdsForTab(tabKey) {
    const ids = new Set();
    for (const entry of this._index) {
      if (this._visiblePackIds.has(entry.bookId) && tabKeyForType(entry.type) === tabKey) {
        ids.add(entry.bookId);
      }
    }

    return ids;
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

    if (options.parts.includes("tabs")) {
      this._activateTabListeners();
    }

    if (options.parts.includes("filters")) {
      this._activateFilterListeners();
    }

    if (options.parts.includes("results")) {
      this._activateResultListeners();
    }
  }

  _activateTabListeners() {
    const tabsEl = this.element.querySelector('[data-application-part="tabs"]');
    tabsEl?.querySelector(".active")?.scrollIntoView({ block: "nearest", inline: "center" });
  }

  _activateFilterListeners() {
    const filtersEl = this.element.querySelector('[data-application-part="filters"]');
    if (!filtersEl) return;

    const booksGroup = filtersEl.querySelector(".compendium-browser-books-group");
    booksGroup?.addEventListener("toggle", () => {
      this._filters.booksExpanded = booksGroup.open;
    });

    for (const checkbox of filtersEl.querySelectorAll("[data-pack-id]")) {
      checkbox.addEventListener("change", () => {
        const id = checkbox.dataset.packId;
        if (checkbox.checked) this._filters.excludedBooks.delete(id);
        else this._filters.excludedBooks.add(id);
        this.render({ parts: ["tabs", "results"] });
      });
    }

    for (const checkbox of filtersEl.querySelectorAll("[data-subtype]")) {
      checkbox.addEventListener("change", () => {
        const excluded = this._filters.excludedSubtypes[this._filters.activeType] ??= new Set();
        if (checkbox.checked) excluded.delete(checkbox.dataset.subtype);
        else excluded.add(checkbox.dataset.subtype);
        this.render({ parts: ["results"] });
      });
    }

    /* Facet values are required rather than excluded, so checked means "must match" - the
       opposite of the two filters above. The filters part re-renders as well as the results,
       because each facet list is narrowed to what the visible entries actually have. */
    for (const checkbox of filtersEl.querySelectorAll("[data-facet-value]")) {
      checkbox.addEventListener("change", () => {
        const required = this._requiredFor(checkbox.dataset.facet);
        if (!required) {
          return;
        }

        if (checkbox.checked) required.add(checkbox.dataset.facetValue);
        else required.delete(checkbox.dataset.facetValue);
        this.render({ parts: ["filters", "results"] });
      });
    }

    const searchInput = filtersEl.querySelector('input[name="search"]');
    if (searchInput) {
      searchInput.addEventListener("input", foundry.utils.debounce(() => {
        this._filters.search = searchInput.value;
        this.render({ parts: ["tabs", "results"] });
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

  /** The pack ids belonging to one Book-filter group, e.g. "My Little Pony", currently shown for the active tab. */
  _packIdsForGroup(groupName) {
    const group = getGroupedItemPacks().find(g => g.name === groupName);
    if (!group) return [];

    const relevant = this._getBookIdsForTab(this._filters.activeType);
    return group.packs
      .filter(pack => relevant.has(pack.metadata.id))
      .map(pack => pack.metadata.id);
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
    for (const id of this._getBookIdsForTab(this._filters.activeType)) {
      this._filters.excludedBooks.delete(id);
    }

    this.render({ parts: ["tabs", "filters", "results"] });
  }

  static #onSelectNoBooks() {
    for (const id of this._getBookIdsForTab(this._filters.activeType)) {
      this._filters.excludedBooks.add(id);
    }

    this.render({ parts: ["tabs", "filters", "results"] });
  }

  static #onSelectAllBooksInGroup(event, target) {
    for (const id of this._packIdsForGroup(target.dataset.group)) {
      this._filters.excludedBooks.delete(id);
    }

    this.render({ parts: ["tabs", "filters", "results"] });
  }

  static #onSelectNoBooksInGroup(event, target) {
    for (const id of this._packIdsForGroup(target.dataset.group)) {
      this._filters.excludedBooks.add(id);
    }

    this.render({ parts: ["tabs", "filters", "results"] });
  }

  static #onSelectAllSubtypes() {
    this._filters.excludedSubtypes[this._filters.activeType]?.clear();
    this.render({ parts: ["filters", "results"] });
  }

  /**
   * Drop everything required in one facet, back to not filtering by it.
   *
   * The counterpart of Select All / Select None on the exclusion filters, but there is only one of
   * it: "require nothing" is a useful state and the one the browser opens in, while "require every
   * value" would match nothing at all.
   */
  static #onClearTraits(event, target) {
    this._requiredFor(target.dataset.facet)?.clear();
    this.render({ parts: ["filters", "results"] });
  }

  static #onSelectNoSubtypes() {
    const definition = this._getSecondaryFilterDefinition(this._filters.activeType);
    if (!definition) return;

    this._filters.excludedSubtypes[this._filters.activeType] = new Set(Object.keys(definition.choices()));
    this.render({ parts: ["filters", "results"] });
  }

  static #onSelectType(event, target) {
    const type = target.dataset.type;
    if (type === this._filters.activeType) return;

    this._filters.activeType = type;
    this.render({ parts: ["tabs", "filters", "results"] });
  }
}
