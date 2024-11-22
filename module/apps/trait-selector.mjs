const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api
import { E20 } from "../helpers/config.mjs";

export class TraitSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(owner, data) {
    super(owner, data);
    this._owner = owner;
    this._data = data;
  }

  static DEFAULT_OPTIONS = {
    allowCustom: false,
    id: "trait-selector",
    classes: [
      "essence20",
      "trait-selector",
      "subconfig",
      "window-app"
    ],
    choices: {},
    customKey: "custom",
    tag: "form",
    title: "E20.TraitSelectorTitle",
    form: {
      handler: TraitSelector.myFormHandler,
      submitOnChange: false,
      closeOnSubmit: true
    },
    minimum: 0,
    maximum: null,
  }

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/trait-selector.hbs"
    }
  }

  get title() {
    return game.i18n.localize(this.options.title) || super.title;
  }

  get attribute() {
    return this.options.name;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    options.value = this._data.valueKey;
    const attr = foundry.utils.getProperty(this._owner, this._data.name);
    const o = this._data;
    const value = (o.valueKey) ? foundry.utils.getProperty(attr, o.valueKey) ?? [] : attr;
    const custom = (o.customKey) ? foundry.utils.getProperty(attr, o.customKey) ?? "" : "";

    // Populate choices
    const choices = Object.entries(o.choices).reduce((obj, e) => {
      let [k, v] = e;
      obj[k] = { label: v, chosen: attr ? value.includes(k) : false };
      return obj;
    }, {});

    // Return data
    context.allowCustom =  o.allowCustom;
    context.choices = choices;
    context.custom = custom;

    return context
  }

  static async myFormHandler(event, form, formData) {
    const o = this.options;

    // Obtain choices
    const chosen = [];
    for ( let [k, v] of Object.entries(formData.object) ) {
      if ( (k !== "custom") && v ) chosen.push(k);
    }

    console.log(chosen)
    // Object including custom data
    const updateData = {};
    if ( o.valueKey ) updateData[`${this._data.name}.${o.valueKey}`] = chosen;
    else updateData[this._data.name] = chosen;
    if ( o.allowCustom ) updateData[`${this._data.name}.${o.customKey}`] = formData.custom;

    // Validate the number chosen
    if ( o.minimum && (chosen.length < o.minimum) ) {
      return ui.notifications.error(`You must choose at least ${o.minimum} options`);
    }

    if ( o.maximum && (chosen.length > o.maximum) ) {
      return ui.notifications.error(`You may choose no more than ${o.maximum} options`);
    }

    console.log(updateData)
    // Update the object
    this._owner.update(updateData);
  }

}
