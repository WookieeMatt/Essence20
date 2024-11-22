const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

class ChoicesPrompt extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    form: {
      handler: ChoicesPrompt.pick,
      submitOnChange: false,
      closeOnSubmit: false
    }
  }

  static PARTS = {
    template: "templates/app/choice-select-prompt.hbs",
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

  }

  static pick() {

  }
}
