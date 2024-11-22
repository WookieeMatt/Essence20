const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export default class TraitSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    form: {
      handler: TraitSelector.choose,
      submitOnChange: false,
      closeOnSubmit: false
    }
  }

  static PARTS = {
    template: "templates/app/trait-selector.hbs",
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

  }

  static choose() {

  }
}
