import { handleActorSelector } from "../sheet-handlers/listener-misc-handler.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class SelectPrompt extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, choices, event, title){
    super(actor, choices, event, title);
    this._actor = actor;
    this._choices = choices;
    this._event = event;
    this._title = title;

  }
  static DEFAULT_OPTIONS = {
    id: "select-prompt",
    classes: [
      "essence20",
      "trait-selector",
      "subconfig",
      "window-app",
    ],
    tag: "form",
    title: "E20.SelectDefaultTitle",
    form: {
      handler: SelectPrompt.myFormHandler,
      submitOnChange: false,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/select-prompt.hbs",
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
        { type: "submit", label: "E20.AcceptButton" },
      ];
    return context;
  }

  static async myFormHandler(event, form, formData){
    let key = null;
    for (const [, value] of Object.entries(formData.object)) {
      key = value;
    }
    handleActorSelector(this._actor, key, this._event);
  }
}
