const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export class ShieldOptions extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: [
      "window-app",
      "window-content"
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
    },
    footer: {
      template: "templates/generic/form-footer.hbs"
    }
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    console.log(this)
    if (this.options.system.passiveEffect.type == 'defenseBonusOption') {
      const option1 = {
        id: 1,
        name: '+' + this.options.system.passiveEffect.option1.value + ' ' + this.options.system.passiveEffect.option1.defense,
        value: 1,
      };
      const option2 = {
        id: 2,
        name: '+' + this.options.system.passiveEffect.option2.value + ' ' + this.options.system.passiveEffect.option2.defense,
        value: 2,
      };
      context.selection = 'passiveEffect';
      context.options = [
        option1,
        option2
      ]

    } else if (this.options.system.activeEffect.type == 'defenseBonusOption') {
      const option1 = {
        id: 1,
        name: '+' + this.options.system.activeEffect.option1.value + ' ' + this.options.system.activeEffect.option1.defense,
        value: 1,
      };
      const option2 = {
        id: 2,
        name: '+' + this.options.system.activeEffect.option2.value + ' ' + this.options.system.activeEffect.option2.defense,
        value: 2,
      };
      context.selection = 'activeEffect';
      context.options = [
        option1,
        option2
      ]
    }
    const buttons = [
      {type: "submit", label: "Submit"},
      {type: "cancel", label: "Cancel"},
    ];
    context.buttons = buttons;
    console.log(context)
    return context
  }

  static async onSubmit(event, form, formData) {
    console.log(event)
    console.log(form)
    console.log(formData)
  }
}
