import { onMultiSkillPerkDrop, onPerkDrop } from "../sheet-handlers/perk-handler.mjs";
import { applyThemeClass } from "../settings.js";

import { serializeFormSubmits } from "./serialize-form-submits.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class MultiChoiceSelector extends serializeFormSubmits(HandlebarsApplicationMixin(ApplicationV2)) {
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
    // "{id}" - see choices-selector.mjs's own DEFAULT_OPTIONS.id comment for why a static id here
    // (this used to be a bare "mutli-choice") breaks whenever two of this same dialog type get
    // triggered back-to-back with no player interaction in between.
    id: "mutli-choice-{id}",
    classes: [
      "essence20",
      "theme-wrapper",
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

  _onRender(context, options) {
    super._onRender(context, options);

    applyThemeClass(this.element);
  }

  static async myFormHandler(event, form, formData) {
    const selectedKeys = Object.entries(formData.object)
      .filter(([, isSelected]) => isSelected)
      .map(([key]) => key);

    if (selectedKeys.length != this._perk.system.numChoices) {
      throw new Error(
        game.i18n.format(
          'E20.SelectionsRequiredError',
          {
            numChoices: this._perk.system.numChoices,
          },
        ),
      );
    }

    // Expertise (GI Joe CRB, Commando base, p.72) - see onMultiSkillPerkDrop's own doc comment.
    // Unlike the 'perks' case below, a 'skills' choice has no perk.system.items map of its own
    // grantable sub-Perks to look selections up in - the selected keys ARE the chosen skills.
    if (this._perk.system.choiceType == 'skills') {
      await onMultiSkillPerkDrop(this._actor, this._perk, selectedKeys, this._dropFunc, this._parentPerk);
      return;
    }

    const selectedUuids = selectedKeys.map(key => this._perk.system.items[key].uuid);
    const newPerk = await onPerkDrop(this._actor, this._perk, this._dropFunc, null, null, this._parentPerk);

    for (const uuid of selectedUuids) {
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
