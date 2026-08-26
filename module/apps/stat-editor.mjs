import { applyThemeClass } from "../settings.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Bulk editor for the sidebar's Defenses/Speeds panels, opened by clicking either panel's
 * label. Player Characters compute their defense/speed totals from other fields (essence,
 * armor, shield, etc - see Essence20Actor#_prepareDefenses/#_prepareMovement), so the only
 * thing worth bulk-editing there is the flat .bonus add-on shared by all 4 entries. Every other
 * actor type just stores a flat value/total per entry (no derived computation), so this edits
 * that value directly instead.
 */
export default class StatEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {Actor} actor The actor whose defenses/speeds are being edited
   * @param {"defense"|"speed"} statType Which panel this editor was opened from
   */
  constructor(actor, statType) {
    super({ id: `essence20-stat-editor-${actor.id}-${statType}` });
    this._actor = actor;
    this._statType = statType;
  }

  static DEFAULT_OPTIONS = {
    classes: ["essence20", "sheet", "theme-wrapper", "stat-editor"],
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

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/stat-editor.hbs",
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  get title() {
    const isPc = this._actor.type === "playerCharacter";
    const titleKey = this._statType === "defense"
      ? (isPc ? "E20.StatEditorDefensesBonusTitle" : "E20.StatEditorDefensesTitle")
      : (isPc ? "E20.StatEditorSpeedsBonusTitle" : "E20.StatEditorSpeedsTitle");

    return game.i18n.localize(titleKey);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const isPc = this._actor.type === "playerCharacter";

    context.entries = this._statType === "defense"
      ? this.#getDefenseEntries(isPc)
      : this.#getSpeedEntries(isPc);
    context.buttons = [
      { type: "submit", icon: "fa-solid fa-save", label: "SETTINGS.Save" },
    ];

    return context;
  }

  #getDefenseEntries(isPc) {
    const defenses = this._actor.system.defenses;
    const field = isPc ? "bonus" : "value";

    return Object.entries(CONFIG.E20.defenses).map(([key, labelKey]) => ({
      label: game.i18n.localize(labelKey),
      name: `system.defenses.${key}.${field}`,
      value: defenses[key][field],
    }));
  }

  #getSpeedEntries(isPc) {
    const movement = this._actor.system.movement;
    const field = isPc ? "bonus" : "total";

    return Object.entries(CONFIG.E20.movementTypes).map(([key, labelKey]) => ({
      label: game.i18n.localize(labelKey),
      name: `system.movement.${key}.${field}`,
      value: movement[key][field],
    }));
  }

  _onRender(context, options) {
    super._onRender(context, options);

    applyThemeClass(this.element);
  }

  static async #onSubmit(event, form, formData) {
    await this._actor.update(formData.object);
  }
}
