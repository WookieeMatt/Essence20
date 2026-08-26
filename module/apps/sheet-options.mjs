import { applyThemeClass } from "../settings.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class SheetOptions extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, ev) {
    super();
    this._ev = ev;
    this._actor = actor;
  }

  static DEFAULT_OPTIONS = {
    allowCustom: false,
    id: "sheet-options",
    classes: [
      "theme-wrapper",
      "window-app",
      "sheet-options",
    ],
    tag: "form",
    title: "E20.SheetOptions",
    form: {
      handler: SheetOptions.myFormHandler,
      submitOnChange: false,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/sheet-options.hbs",
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  get title() {
    return game.i18n.localize(this.options.title) || super.title;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.role = this._actor.items.documentsByType.role.find(role => !role.system.isAdditive);
    const origin = await this._actor.items.documentByType?.origin;
    if (origin?.length > 1) {
      context.altMode = true;
    }

    context.actor = this._actor;
    context.system = this._actor.system;
    context.buttons = [
      { type: "submit", icon: "fa-solid fa-save", label: "SETTINGS.Save" },
    ];
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);

    applyThemeClass(this.element);
  }

  static async myFormHandler(event, form, formData) {
    for (const [key, value] of Object.entries(formData.object)) {
      this._actor.update({
        [key]: value,
      });
    }
  }
}
