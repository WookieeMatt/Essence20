const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class MultiSelect extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(title, prompt, actor, item, dropFunc, choices1, choices2, choices3) {
    super(title, prompt, actor, item, dropFunc, choices1, choices2, choices3);
    this._actor = actor;
    this._choices1 = choices1;
    this._choices2 = choices2;
    this._choices3 = choices3;
    this._dropFunc = dropFunc;
    this._item = item;
    this._prompt = prompt;
    this._title = title;
  }

  static DEFAULT_OPTIONS = {
    actions: {
      origin: MultiSelect.origin,
    },
    id: "multi-select",
    classes: [
      "essence20",
      "trait-selector",
      "window-app",
    ],
    tag: "form",
    title: "E20.MultSelectDefaultTitle",
    form: {
      submitOnChange: false,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/multi-select.hbs",
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
    context.choices1 = this._choices1;
    context.choices2 = this._choices2;
    context.choices3 = this._choices3;
    return context;
  }

  static origin(event, selection) {
    setOriginValues(this._actor, this._item, this._previousSelection1, this._previousSelection2, this._dropFunc, selection.value);
    this.close();
  }
}
