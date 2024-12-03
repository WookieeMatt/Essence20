const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

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
      "window-app",
    ],
    choices: {},
    customKey: "custom",
    tag: "form",
    title: "E20.TraitSelectorTitle",
    form: {
      handler: TraitSelector.myFormHandler,
      submitOnChange: false,
      closeOnSubmit: true,
    },
    minimum: 0,
    maximum: null,
  };

  static PARTS = {
    form: {
      scrollable: "",
      template: "systems/essence20/templates/app/trait-selector.hbs",
    },
  };

  get title() {
    return game.i18n.localize(this.options.title) || super.title;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    options.value = this._data.valueKey;
    const attr = foundry.utils.getProperty(this._owner, this._data.name);
    const data = this._data;
    const value = (data.valueKey) ? foundry.utils.getProperty(attr, data.valueKey) ?? [] : attr;
    const custom = (data.customKey) ? foundry.utils.getProperty(attr, data.customKey) ?? "" : "";

    // Populate choices
    const choices = Object.entries(data.choices).reduce((obj, expanded) => {
      let [key, name] = expanded;
      obj[key] = { label: name, chosen: attr ? value.includes(key) : false };
      return obj;
    }, {});

    // Return data
    context.allowCustom =  data.allowCustom;
    context.choices = choices;
    context.custom = custom;

    return context;
  }

  static async myFormHandler(event, form, formData) {
    const options = this.options;

    // Obtain choices
    const chosen = [];
    for ( let [key, name] of Object.entries(formData.object) ) {
      if ( (key !== "custom") && name ) chosen.push(key);
    }

    // Object including custom data
    const updateData = {};
    if ( options.valueKey ) updateData[`${this._data.name}.${options.valueKey}`] = chosen;
    else updateData[this._data.name] = chosen;
    if ( options.allowCustom ) updateData[`${this._data.name}.${options.customKey}`] = formData.custom;

    // Validate the number chosen
    if ( options.minimum && (chosen.length < options.minimum) ) {
      return ui.notifications.error(`You must choose at least ${options.minimum} options`);
    }

    if ( options.maximum && (chosen.length > options.maximum) ) {
      return ui.notifications.error(`You may choose no more than ${options.maximum} options`);
    }

    // Update the object
    this._owner.update(updateData);
  }

}
