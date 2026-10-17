import { applyThemeClass } from "../settings.js";
import { serializeFormSubmits } from "./serialize-form-submits.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Bulk editor for the sidebar's Health/Defenses/Speeds panels, opened by clicking any of their
 * labels. Every actor type now computes these the same way a playerCharacter always has (base,
 * armor, bonus, morphed, shield, etc - see Essence20Actor#_prepareHealth/_prepareDefenses/
 * _prepareMovement), but a Player Character's sheet already has its own dedicated surface for
 * every field besides the flat .bonus/.origin add-on (essence from its Essence Score, armor from
 * equipped Armor items, Origin from its Origin Item, etc) - so PC (and Megaform, whose own base
 * fields are always recomputed from its linked participants, never GM-typed) only bulk-edit that
 * one add-on field here. Every other actor type (npc/companion/vehicle/zord) has no such other
 * surface, so this exposes every field the formula actually reads - one row per Defense/Speed
 * type, one column per field, rather than a long flat list (easier to scan when there are 4-5
 * fields across all 4 Defenses/Speeds at once).
 */
export default class StatEditor extends serializeFormSubmits(HandlebarsApplicationMixin(ApplicationV2)) {
  /**
   * @param {Actor} actor The actor whose Health/Defenses/Speeds are being edited
   * @param {"health"|"defense"|"speed"} statType Which panel this editor was opened from
   */
  constructor(actor, statType) {
    super({
      id: `essence20-stat-editor-${actor.id}-${statType}`,
      position: { width: StatEditor.#computeWidth(actor, statType) },
    });
    this._actor = actor;
    this._statType = statType;
  }

  static DEFAULT_OPTIONS = {
    classes: ["essence20", "sheet", "theme-wrapper", "e20-window", "stat-editor"],
    tag: "form",
    position: {
      width: 320,
    },
    form: {
      handler: StatEditor.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true,
    },
  };

  /**
   * The table layout needs a wider window than the old single-column list did, scaled to how
   * many field columns this actor type/statType combination will actually show (1 for the
   * minimal PC/Megaform bonus-only case, up to 5 for a non-PC Defenses table).
   */
  static #computeWidth(actor, statType) {
    const isMinimal = ["playerCharacter", "megaform"].includes(actor.type);
    if (isMinimal) {
      return 320;
    }

    const columnCount = { health: 2, defense: 5, speed: 4 }[statType];
    return 110 + (columnCount * 70);
  }

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/stat-editor.hbs",
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  /**
   * @returns {Boolean}   True for the two actor types whose base fields are never GM-typed
   *   directly (a playerCharacter derives them from Items/Essence Scores; a Megaform recomputes
   *   them fresh every render from its linked participants - Essence20Actor#
   *   _prepareMegaformData) - both only bulk-edit the one flat add-on field here.
   */
  get #isMinimalEditor() {
    return ["playerCharacter", "megaform"].includes(this._actor.type);
  }

  get title() {
    const isMinimal = this.#isMinimalEditor;
    const titleKey = {
      health: isMinimal ? "E20.StatEditorHealthBonusTitle" : "E20.StatEditorHealthTitle",
      defense: isMinimal ? "E20.StatEditorDefensesBonusTitle" : "E20.StatEditorDefensesTitle",
      speed: isMinimal ? "E20.StatEditorSpeedsBonusTitle" : "E20.StatEditorSpeedsTitle",
    }[this._statType];

    return game.i18n.localize(titleKey);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const isMinimal = this.#isMinimalEditor;

    const { columns, rows } = {
      health: () => this.#getHealthTable(isMinimal),
      defense: () => this.#getDefenseTable(isMinimal),
      speed: () => this.#getSpeedTable(isMinimal),
    }[this._statType]();

    context.columns = columns;
    context.rows = rows;
    context.buttons = [
      { type: "submit", icon: "fa-solid fa-save", label: "SETTINGS.Save" },
    ];

    return context;
  }

  /**
   * Builds the {columns, rows} shape stat-editor.hbs renders as a table: one column per field in
   * `fields`, one row per key in `typeConfig` (e.g. CONFIG.E20.defenses).
   * @param {Object} dataByKey   The actor's own system.defenses/system.movement object.
   * @param {Object} typeConfig   CONFIG.E20.defenses or CONFIG.E20.movementTypes.
   * @param {{field: String, labelKey: String}[]} fields
   * @param {String} pathPrefix   e.g. "system.defenses" or "system.movement".
   */
  #buildTable(dataByKey, typeConfig, fields, pathPrefix) {
    const columns = fields.map(({ field, labelKey }) => ({
      field, label: game.i18n.localize(labelKey),
    }));

    const rows = Object.entries(typeConfig).map(([key, labelKey]) => ({
      label: game.i18n.localize(labelKey),
      cells: fields.map(({ field }) => ({
        name: `${pathPrefix}.${key}.${field}`,
        value: dataByKey[key][field],
      })),
    }));

    return { columns, rows };
  }

  #getHealthTable(isMinimal) {
    const health = this._actor.system.health;
    const fields = isMinimal
      ? [{ field: "bonus", labelKey: "E20.Bonus" }]
      : [{ field: "origin", labelKey: "E20.Origin" }, { field: "bonus", labelKey: "E20.Bonus" }];

    // A single row (there's only one Health, unlike the 4 Defenses/Speed types) - built by hand
    // rather than through #buildTable, whose column-building generic path assumes an extra
    // "which type" key segment (system.defenses.<type>.<field>) that Health doesn't have.
    return {
      columns: fields.map(({ field, labelKey }) => ({ field, label: game.i18n.localize(labelKey) })),
      rows: [{
        label: game.i18n.localize("E20.ActorHealth"),
        cells: fields.map(({ field }) => ({ name: `system.health.${field}`, value: health[field] })),
      }],
    };
  }

  #getDefenseTable(isMinimal) {
    const fields = isMinimal
      ? [{ field: "bonus", labelKey: "E20.Bonus" }]
      : [
        { field: "base", labelKey: "E20.DefenseBase" },
        { field: "armor", labelKey: "E20.DefenseArmor" },
        { field: "bonus", labelKey: "E20.Bonus" },
        { field: "morphed", labelKey: "E20.DefenseMorphed" },
        { field: "shield", labelKey: "E20.DefenseShield" },
      ];

    return this.#buildTable(
      this._actor.system.defenses, CONFIG.E20.defenses, fields, "system.defenses",
    );
  }

  #getSpeedTable(isMinimal) {
    const fields = isMinimal
      ? [{ field: "bonus", labelKey: "E20.Bonus" }]
      : [
        { field: "base", labelKey: "E20.DefenseBase" },
        { field: "bonus", labelKey: "E20.Bonus" },
        { field: "altMode", labelKey: "E20.AltMode" },
        { field: "morphed", labelKey: "E20.DefenseMorphed" },
      ];

    return this.#buildTable(
      this._actor.system.movement, CONFIG.E20.movementTypes, fields, "system.movement",
    );
  }

  _onRender(context, options) {
    super._onRender(context, options);

    applyThemeClass(this.element);
  }

  static async #onSubmit(event, form, formData) {
    await this._actor.update(formData.object);
  }
}
