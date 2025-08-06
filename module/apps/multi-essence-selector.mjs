import { _selectEssenceProgression } from "../sheet-handlers/role-handler.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class MultiEssenceSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(choices, actor, role, dropFunc, title){
    super();
    this._choices = choices;
    this._actor = actor;
    this._role = role;
    this._dropFunc = dropFunc;
    this._title = title;
  }

  static DEFAULT_OPTIONS = {
    id: "mutli-essence",
    classes: [
      "essence20",
      "trait-selector",
      "subconfig",
      "e20-window theme-dark", // TODO: get light/dark from settings/browser
      "theme-default", // TODO: get border theme from settings
      "sliced-border --thick",
    ],
    tag: "form",
    title: "E20.SelectDefaultTitle",
    form: {
      handler: MultiEssenceSelector.myFormHandler,
      submitOnChange: false,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/multi-select-essence.hbs",
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
    let selectionAmount = 0;
    for (const [, selection] of Object.entries(formData.object)) {
      if (selection == true) {
        selectionAmount += 1;
      }
    }

    if (selectionAmount != 2) {
      throw new Error(game.i18n.localize("E20.EssencesRequiredError"));
    }

    _selectEssenceProgression(this._actor, this._role, this._dropFunc, formData.object);
  }
}
