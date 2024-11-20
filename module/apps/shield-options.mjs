const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export class ShieldOptions extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: [
      "window-app"
    ],
    tag: "form",
    form: {
      handler: ShieldOptions.onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    }
  }

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/shield-options.hbs",
    }
  }

  static async onSubmit(event, form, formData) {
    console.log(event)
    console.log(form)
    console.log(formData)
  }
}
