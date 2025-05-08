import { onPerkDrop } from "../sheet-handlers/perk-handler.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class MultiChoiceSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(choices, actor, prompt, title, perk, dropFunc, parentPerk){
    super();
    this._choices = choices;
    this._actor = actor;
    this._prompt = prompt;
    this._title = title;
    this._perk = perk;
    this._dropFunc = dropFunc;
    this._parentPerk = parentPerk;
  }

  static DEFAULT_OPTIONS = {
    actions: {
      view: MultiChoiceSelector.view,
    },
    id: "mutli-choice",
    classes: [
      "essence20",
      "window-app",
    ],
    tag: "form",
    title: "E20.SelectDefaultTitle",
    form: {
      handler: MultiChoiceSelector.myFormHandler,
      submitOnChange: false,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/multi-choice-selector.hbs",
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
    context.prompt = this._prompt;
    context.buttons = [
      { type: "submit", icon: "fa-solid fa-save", label: "SETTINGS.Save" },
    ];
    return context;
  }
  static async myFormHandler(event, form, formData) {
    let selectionAmount = 0;
    const selectionUuids = [];
    for (const [key, selection] of Object.entries(formData.object)) {
      if (selection == true) {
        selectionAmount += 1;
        selectionUuids.push(this._perk.system.items[key].uuid);
      }
    }

    if (selectionAmount != this._perk.system.choiceQuantity) {
      throw new Error(
        game.i18n.format(
          'E20.SelectionsRequiredError',
          {
            selections: this._perk.system.choiceQuantity,
          },
        ),
      );
    }

    const newPerk = await onPerkDrop(this._actor, this._perk, this._dropFunc, null, null, this._parentPerk);

    for (const uuid of selectionUuids) {
      const createdPerk = await fromUuid(uuid);
      onPerkDrop(this._actor, createdPerk, null, null, null, newPerk);
    }

  }

  static async view(event, selection) {
    const item = await fromUuid(selection.dataset.uuid);
    if (item) {
      item.sheet.render(true);
    }
  }
}
