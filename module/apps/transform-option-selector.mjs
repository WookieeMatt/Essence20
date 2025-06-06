import { _altModeSelect } from "../sheet-handlers/transformer-handler.mjs";
import { getFormData } from "../helpers/application.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class TransformOptionSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(choices, actorSheet, altModes, title){
    super();
    this._choices = choices;
    this._actorSheet = actorSheet;
    this._altModes = altModes;
    this._title = title;
  }

  static DEFAULT_OPTIONS = {
    id: "transform-options",
    classes: [
      "essence20",
      "trait-selector",
      "subconfig",
      "window-app",
    ],
    tag: "form",
    title: "E20.SelectDefaultTitle",
    form: {
      handler: TransformOptionSelector.myFormHandler,
      submitOnChange: false,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/option-select.hbs",
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  get title() {
    return game.i18n.localize(this._title) || game.i18n.localize(super.title);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.choices = this._choices;
    context.buttons = [
      { type: "submit", icon: "fa-solid fa-save", label: "SETTINGS.Save" },
    ];
    return context;
  }

  static async myFormHandler(event, form, formData) {
    const selectedForm = getFormData(formData.object);

    _altModeSelect(this._actorSheet, this._altModes, selectedForm);
  }
}
