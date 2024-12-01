import { _checkForAltModes, _hangUpSelect, _showOriginSkillDialog, setOriginValues } from "../sheet-handlers/background-handler.mjs";
import { _attachSelectedItemOptionHandler } from "../sheet-handlers/attachment-handler.mjs";
import { _focusStatUpdate } from "../sheet-handlers/role-handler.mjs";
import { setShieldOptions } from "../sheet-handlers/listener-item-handler.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class ChoicesPrompt extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(data, item, actor, prompt, title, dropFunc, previousSelection1, previousSelection2) {
    super(data, item, actor, prompt, title, dropFunc, previousSelection1, previousSelection2);
    this._data = data;
    this._item = item;
    this._actor = actor;
    this._prompt = prompt;
    this._dropFunc = dropFunc;
    this._previousSelection1 = previousSelection1;
    this._previousSelection2 = previousSelection2;
    this._title = title;
  }

  static DEFAULT_OPTIONS = {
    actions: {
      focus: ChoicesPrompt.focus,
      influence: ChoicesPrompt.influence,
      origin: ChoicesPrompt.origin,
      shield: ChoicesPrompt.shield,
      upgrade: ChoicesPrompt.attach,
      weaponEffect: ChoicesPrompt.attach,
      view: ChoicesPrompt.view,
    },
    id: "choices-prompt",
    classes: [
      "essence20",
      "trait-selector",
      "subconfig",
      "window-app",
    ],
    tag: "form",
    title: "E20.SelectDefaultTitle",
    form: {
      submitOnChange: false,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/choice-select-prompt.hbs",
    },
  };

  get title() {
    return game.i18n.localize(this._title) || game.i18n.localize(super.title);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.choices = this._data;
    context.prompt = this._prompt;
    context.type = this._item.type;

    return context;
  }

  static attach(event, selection) {
    _attachSelectedItemOptionHandler(this._actor, selection.value, this._dropFunc);
    this.close();
  }

  static focus(event, selection) {
    _focusStatUpdate(this._actor, selection.value, this._dropFunc);
    this.close();
  }

  static influence(event, selection) {
    _hangUpSelect(this._actor, selection.value);
    this.close();
  }

  static origin(event, selection) {
    if (this._previousSelection1 && this._previousSelection2) {
      setOriginValues(this._actor, this._item, this._previousSelection1, this._previousSelection2, this._dropFunc, selection.value);
      this.close();
    } else if (this._previousSelection1 && !this._previousSelection2) {
      _checkForAltModes(this._actor, this._item, this._previousSelection1, selection.value, this._dropFunc);
      this.close();
    } else {
      _showOriginSkillDialog(this._actor, this._item, selection.value, this._dropFunc);
      this.close();
    }
  }

  static async shield(event, selection) {
    setShieldOptions(this._actor, this._item, selection.value, selection.name, this._dropFunc);
    this.close();
  }

  static async view(event, selection) {
    const item = await fromUuid(selection.dataset.uuid);
    if (item) {
      item.sheet.render(true);
    }
  }
}
