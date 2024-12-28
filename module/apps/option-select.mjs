const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class OptionSelectPrompt extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(){
    super();

  }

  static DEFAULT_OPTIONS = {
    id: "option-select",
    classes: [
      "essence20",
      "trait-selector",
      "subconfig",
      "window-app",
    ],
    tag: "form",
    title: "E20.SelectDefaultTitle",
    form: {
      handler: OptionSelectPrompt.myFormHandler,
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
    context.buttons = [
      { type: "submit", icon: "fa-solid fa-battery-bolt", label: "E20.PowerRollTitle" },
    ];
    return context;
  }

  static async myFormHandler(event, form, formData) {

  }

}
