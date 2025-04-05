const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class DefenseModificationSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(choices, actor, prompt, title, selected) {
    super();
    this._choices = choices;
    this._actor = actor;
    this._prompt = prompt;
    this._title = title;
    this._selected = selected;
  }

  static DEFAULT_OPTIONS = {
    id: "defense-modification",
    classes: [
      "essence20",
      "trait-selector",
      "subconfig",
      "window-app",
    ],
    tag: "form",
    title: "E20.SelectDefaultTitle",
    form: {
      handler: DefenseModificationSelector.myFormHandler,
      submitOnChange: false,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/defense-modfication.hbs",
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
    context.selected = this._selected;
    context.buttons = [
      { type: "submit", label: "E20.AcceptButton" },
    ];
    return context;
  }

  static async myFormHandler(event, form, formData) {
    for (const [, selection] of Object.entries(formData.object)) {
      this._actor.update({
        "system.defenses.toughness.morphed": this._choices[selection].value,
      });
    }
  }
}