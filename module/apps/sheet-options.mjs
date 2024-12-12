import { getItemsOfType } from "../helpers/utils.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class SheetOptions extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actorSheet) {
    super(actorSheet);
    this._actorSheet = actorSheet;
  }

  static DEFAULT_OPTIONS = {
    actions: {},
    id: "shet-options",
    classes: [
      "essence20",
      "subconfig",
      "trait-selector",
      "window-app",
    ],
    tag: "form",
    title: "E20.SheetOptions",
    form: {
        handler: SheetOptions.myFormHandler,
      submitOnChange: false,
      closeOnSubmit: true,
    },
    minimum: 0,
    maximum: null,
  };

  static PARTS = {
    form: {
      scrollable: "",
      template: "systems/essence20/templates/app/sheet-options.hbs",
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  }

  get title() {
    return game.i18n.localize(this.options.title) || super.title;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.role = await getItemsOfType("role", this._actorSheet.actor.items);
    const origin = await getItemsOfType("altMode", this._actorSheet.actor.items);
    if (origin.length > 1) {
      context.altMode = true;
    }
    context.actor = this._actorSheet.actor;
    context.system = this._actorSheet.actor.system;
    context.buttons = [
      { type: "submit", icon: "fa-solid fa-save", label: "SETTINGS.Save" },
    ];
    return context;
  }

  static async myFormHandler(event, form, formData) {

    for (const [key, value] of Object.entries(formData.object)) {
      this._actorSheet.actor.update({
        [key]: value,
      }).then(this._actorSheet.render(false));
    }
  }
}
