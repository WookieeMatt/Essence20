const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class TraitSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(owner, data) {
    super();
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
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  get title() {
    return game.i18n.localize(this.options.title) || super.title;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    options.value = this._data.valueKey;
    const data = this._data;
    const variableName = data.name.split(".");
    let attr = [];
    if (this._owner.documentName == 'Actor') {
      for (const [key, value] of Object.entries(this._owner.system[variableName[1]])) {
        if (value) {
          attr.push(key);
        }
      }

    } else {
      attr = foundry.utils.getProperty(this._owner, data.name);
    }

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
    context.buttons = [
      { type: "submit", icon: "fa-solid fa-save", label: "SETTINGS.Save" },
    ];

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
    if (this._owner.documentName == 'Actor') {
      const variableName = this._data.name.split(".");
      for (const key of Object.keys(this._owner.system[variableName[1]])){
        const updateString = `${this._data.name}.${key}`;
        let newValue = false;
        for (const update of updateData[`${this._data.name}`]) {
          if (update == key) {
            newValue = true;
            break;
          }
        }

        this._owner.update ({
          [updateString]: newValue,
        });
      }
    } else {
      this._owner.update(updateData);
    }

  }

}
