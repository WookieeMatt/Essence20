import { _processAlterationMovementCost} from "../sheet-handlers/alteration-handler.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class AlterationMovementSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, alteration, choices, alterationUuid, title, dropFunc){
    super();
    this._actor = actor;
    this._alteration = alteration;
    this._choices = choices;
    this._alterationUuid = alterationUuid;
    this._title = title;
    this._dropFunc = dropFunc;
  }

  static DEFAULT_OPTIONS = {
    id: "alteration-movement",
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
      handler: AlterationMovementSelector.myFormHandler,
      submitOnChange: false,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/alteration-movement.hbs",
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

  static async myFormHandler(event, form, formData) {
    const data = {};
    for (const [key, value] of Object.entries(formData.object)) {
      data[key] = {
        max: this._choices[key].maxValue,
        value: value,
      };
    }

    _processAlterationMovementCost(this._actor, this._alteration, data, this._alterationUuid, this._dropFunc);
  }
}
