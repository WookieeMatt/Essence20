const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api
import { E20 } from "../helpers/config.mjs";

export class TraitSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "trait-selector",
    classes: ["essence20", "trait-selector", "subconfig"],
    tag: "form",
    form: {
      handler: TraitSelector.myFormHandler,
      submitOnChange: false,
      closeOnSubmit: true
    },
  }

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/trait-selector.hbs"
    }
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    console.log(context)
  }

  static async myFormHandler(event, form, formData) {
    console.log(form)
  }

}
