/* eslint-disable no-unused-vars */
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export default class ChoicesPrompt extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(data, item, actor) {
    super(data, item, actor);
    this._data = data;
    this._item = item;
    this._actor = actor;
  }

  static DEFAULT_OPTIONS = {
    id: "choices-prompt",
    classes: [
      "essence20",
      "trait-selector",
      "subconfig",
      "window-app"
    ],
    tag: "form",
    form: {
      handler: ChoicesPrompt.pick,
      submitOnChange: false,
      closeOnSubmit: true
    },
  }

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/choice-select-prompt.hbs"
    }
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.choices = this._data;
    context.prompt = "Select a HangUp";
    console.log(context)
    return context
  }

  static pick(event, form, formData) {
    console.log(event)
    console.log(form)
    console.log(formData)
  }
}
