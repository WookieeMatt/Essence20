import { _setEssenceProgression } from "../sheet-handlers/role-handler.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class EssenceSelectPrompt extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(choices, actor, role, dropFunc, level1Essences, title){
    super();
    this._choices = choices;
    this._actor = actor;
    this._role = role;
    this._dropFunc = dropFunc;
    this._level1Essences = level1Essences;
    this._title = title;
  }

  static DEFAULT_OPTIONS = {
    id: "essence-select",
    classes: [
      "essence20",
      "trait-selector",
      "subconfig",
      "window-app",
    ],
    tag: "form",
    title: "E20.SelectDefaultTitle",
    form: {
      handler: EssenceSelectPrompt.myFormHandler,
      submitOnChange: false,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/essence-select.hbs",
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
    const rankArray = [];
    for (const [, rank] of Object.entries(formData.object)) {
      rankArray.push(rank);
    }

    const isUnique = rankArray.length === new Set(rankArray).size;
    if (!isUnique) {
      throw new Error('Selections must be unique');
    }

    _setEssenceProgression(this._actor, formData.object, this._role, this._dropFunc, this._level1Essences);
  }
}
