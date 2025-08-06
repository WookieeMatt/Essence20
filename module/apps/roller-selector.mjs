import { handleActorSelector } from "../sheet-handlers/listener-misc-handler.mjs";
import { getFormData } from "../helpers/application.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class RollerSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, choices, event, title){
    super();
    this._actor = actor;
    this._choices = choices;
    this._event = event;
    this._title = title;
  }

  static DEFAULT_OPTIONS = {
    id: "roller",
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
      handler: RollerSelector.myFormHandler,
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
    const key = getFormData(formData.object);

    handleActorSelector(this._actor, key, this._event);
  }
}
