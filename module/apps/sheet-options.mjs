import { getItemsOfType } from "../helpers/utils.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class SheetOptions extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor) {
    super(actor);
    this._actor = actor;
  }

  static DEFAULT_OPTIONS = {
    allowCustom: false,
    id: "sheet-options",
    classes: [
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
    context.role = await getItemsOfType("role", this._actor.items);
    const origin = await getItemsOfType("altMode", this._actor.items);
    if (origin.length > 1) {
      context.altMode = true;
    }

    context.actor = this._actor;
    context.system = this._actor.system;
    context.buttons = [
      { type: "submit", icon: "fa-solid fa-save", label: "SETTINGS.Save" },
    ];
    return context;
  }

  static async myFormHandler(event, form, formData) {
    for (const [key, value] of Object.entries(formData.object)) {
      this._actor.update({
        [key]: value,
      });
    }
  }
}
