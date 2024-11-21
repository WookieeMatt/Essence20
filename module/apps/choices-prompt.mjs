const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

class choicesPrompt extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    form: {
      handler: choicesPrompt.pick,
      submitOnChange: false,
      closeOnSubmit: false
    }
  }

  static PARTS = {
    template: "templates/app/choice-select-prompt.hbs",
  }

  _prepareContext(options) {
    super._prepareContext(options)
  }

  static pick() {

  }
}
