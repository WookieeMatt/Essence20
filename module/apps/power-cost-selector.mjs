import { _powerCountUpdate } from "../sheet-handlers/power-handler.mjs";
import { getFormData } from "../helpers/application.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class PowerCostSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, power, maxPower, powerType, title){
    super();
    this._actor = actor;
    this._power = power;
    this._maxPower = maxPower;
    this._powerType = powerType;
    this._title = title;
  }

  static DEFAULT_OPTIONS = {
    id: "power-cost",
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
      handler: PowerCostSelector.myFormHandler,
      submitOnChange: false,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/power-cost.hbs",
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
    context.power = this._power;
    context.maxPower = this._maxPower;
    context.buttons = [
      { type: "submit", icon: "fa-solid fa-battery-bolt", label: "E20.PowerRollTitle" },
    ];
    return context;
  }

  static async myFormHandler(event, form, formData) {
    const newCost = getFormData(formData.object);

    _powerCountUpdate(this._actor, this._maxPower, this._powerType, newCost);
    this.close();
  }
}
