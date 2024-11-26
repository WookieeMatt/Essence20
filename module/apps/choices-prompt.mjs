import { _checkForAltModes, _hangUpSelect, _showOriginSkillDialog, setOriginValues } from "../sheet-handlers/background-handler.mjs"
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class ChoicesPrompt extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(data, item, actor, prompt, dropFunc, previousSelection1, previousSelection2) {
    super(data, item, actor, prompt, dropFunc, previousSelection1, previousSelection2);
    this._data = data;
    this._item = item;
    this._actor = actor;
    this._prompt = prompt;
    this._dropFunc = dropFunc;
    this._previousSelection1 = previousSelection1;
    this._previousSelection2 = previousSelection2;
  }

  static DEFAULT_OPTIONS = {
    actions: {
      influence: ChoicesPrompt.influence,
      origin: ChoicesPrompt.origin,
    },
    id: "choices-prompt",
    classes: [
      "essence20",
      "trait-selector",
      "subconfig",
      "window-app",
    ],
    tag: "form",
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

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.choices = this._data;
    context.prompt = this._prompt;
    context.type = this._item.type;

    return context;
  }

  static influence(event, selection) {
    _hangUpSelect(this._actor, selection.value);
    this.close();
  }

  static origin(event,selection) {
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
}
