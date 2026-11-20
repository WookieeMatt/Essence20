import { applyThemeClass } from "../settings.js";
import { MISSION_TEMPLATES_SETTING } from "../mechanics/campaign/episode-tools.mjs";
import { missionDefaults, missionHtml, missionTitle, rollSection, sectionOrder } from "../mechanics/campaign/mission.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM-only Mission Generator: pick a folder (or compendium) of your own roll tables, roll each one as a section of the
 * episode, reroll any you don't like, then write it up as a journal entry - with the title and outline below it, which
 * the world remembers per source (mechanics/campaign/mission.mjs has the format).
 */
export default class MissionGenerator extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "essence20-mission-generator",
    classes: ["essence20", "theme-wrapper", "e20-window", "mission-generator"],
    tag: "form",
    window: {
      icon: "fa-solid fa-scroll",
      title: "E20.MissionTitle",
      resizable: true,
    },
    position: {
      width: 540,
      height: "auto",
    },
    form: {
      handler: MissionGenerator.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true,
    },
    actions: {
      roll: MissionGenerator.#onRoll,
      reroll: MissionGenerator.#onReroll,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/mission-generator.hbs",
      scrollable: [".mission-sections"],
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  static #instance = null;

  /** Open (or bring forward) the one Mission Generator. */
  static open() {
    this.#instance ??= new this();
    return this.#instance.render({ force: true });
  }

  /**
   * The places tables can come from: world folders of tables, then compendiums of them.
   * @returns {{key: String, name: String, group: String, defaults: Object, tables: Function}[]}
   */
  static sources() {
    const folders = game.folders.filter(folder => folder.type == "RollTable" && folder.contents.length)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(folder => ({ key: `folder:${folder.id}`, name: folder.name, group: "world", defaults: missionDefaults(folder.flags), tables: async () => folder.contents }));
    // A compendium, then each folder inside it (one compendium can hold an episode's tables and a race's).
    const packs = game.packs.filter(pack => pack.documentName == "RollTable" && pack.visible)
      .sort((a, b) => a.title.localeCompare(b.title))
      .flatMap(pack => [
        { key: `pack:${pack.collection}`, name: pack.title, group: "pack", defaults: missionDefaults(pack.metadata.flags), tables: () => pack.getDocuments() },
        ...pack.folders.contents.sort((a, b) => a.name.localeCompare(b.name)).map(folder => ({
          key: `pack:${pack.collection}:${folder.id}`, name: `${pack.title}: ${folder.name}`, group: "pack",
          defaults: missionDefaults(folder.flags), tables: () => pack.getDocuments({ folder: folder.id }),
        })),
      ]);
    return [...folders, ...packs];
  }

  #source = null;
  #title = "";
  #outline = "";
  #sections = [];

  /** Pick a source: its title and outline as last written here, else its own. */
  #setSource(key) {
    const sources = MissionGenerator.sources();
    const saved = game.settings.get("essence20", MISSION_TEMPLATES_SETTING) ?? {};
    const source = sources.find(entry => entry.key == key) ?? sources.find(entry => entry.key == saved._last) ?? sources[0] ?? null;
    this.#source = source?.key ?? null;
    ({ title: this.#title, outline: this.#outline } = saved[this.#source] ?? source?.defaults ?? { title: "", outline: "" });
    this.#sections = [];
  }

  async _prepareContext() {
    if (this.#source === null) {
      this.#setSource(null);
    }

    const sources = MissionGenerator.sources();
    return {
      groups: [
        { label: game.i18n.localize("E20.MissionWorldTables"), sources: sources.filter(source => source.group == "world") },
        { label: game.i18n.localize("E20.MissionCompendiums"), sources: sources.filter(source => source.group == "pack") },
      ].filter(group => group.sources.length),
      source: this.#source,
      title: this.#title,
      outline: this.#outline,
      sections: this.#sections.map((section, index) => ({ ...section, index })),
      buttons: [{ type: "submit", icon: "fa-solid fa-book-open", label: "E20.MissionWrite", disabled: !this.#source }],
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    applyThemeClass(this.element);
  }

  _onChangeForm(formConfig, event) {
    super._onChangeForm?.(formConfig, event);
    if (event.target?.name == "source") {
      this.#setSource(event.target.value);
      this.render();
    }
  }

  /** The title and outline as typed, kept across re-renders. */
  #capture() {
    if (this.form) {
      this.#title = this.form.elements.title?.value ?? this.#title;
      this.#outline = this.form.elements.outline?.value ?? this.#outline;
    }
  }

  async #rollAll() {
    const source = MissionGenerator.sources().find(entry => entry.key == this.#source);
    const tables = sectionOrder(await source?.tables() ?? []);
    if (!tables.length) {
      ui.notifications.warn("E20.MissionNoTables", { localize: true });
      return false;
    }

    this.#sections = await Promise.all(tables.map(rollSection));
    return true;
  }

  static async #onRoll() {
    this.#capture();
    if (await this.#rollAll()) {
      this.render();
    }
  }

  static async #onReroll(event, target) {
    this.#capture();
    const index = Number(target.dataset.index);
    const table = await fromUuid(this.#sections[index]?.uuid);
    if (table) {
      this.#sections[index] = await rollSection(table);
      this.render();
    }
  }

  static async #onSubmit() {
    this.#capture();
    if (!this.#sections.length && !(await this.#rollAll())) {
      return;
    }

    const source = MissionGenerator.sources().find(entry => entry.key == this.#source);
    const saved = foundry.utils.deepClone(game.settings.get("essence20", MISSION_TEMPLATES_SETTING) ?? {});
    saved[this.#source] = { title: this.#title, outline: this.#outline };
    saved._last = this.#source;
    await game.settings.set("essence20", MISSION_TEMPLATES_SETTING, saved);

    const entry = await JournalEntry.implementation.create({
      name: missionTitle(this.#title, this.#sections, source?.name ?? game.i18n.localize("E20.MissionTitle")),
      pages: [{ name: game.i18n.localize("E20.MissionPage"), type: "text", text: { content: missionHtml(this.#sections, this.#outline) } }],
    });
    this.#sections = [];
    entry?.sheet.render(true);
  }
}
