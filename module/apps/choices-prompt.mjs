import { _checkForAltModes, _hangUpSelect, _showOriginSkillPrompt, setOriginValues } from "../sheet-handlers/background-handler.mjs";
import { _attachSelectedItemOptionHandler } from "../sheet-handlers/attachment-handler.mjs";
import { _focusStatUpdate } from "../sheet-handlers/role-handler.mjs";
import { setShieldOptions } from "../sheet-handlers/listener-item-handler.mjs";
import { _flipDriverAndPassenger } from "../sheet-handlers/vehicle-handler.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class ChoicesPrompt extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(choices, actor, prompt, title, item, key, dropFunc, staticValue, previousSelection1, previousSelection2) {
    super(choices, actor, prompt, title, item, key, dropFunc, staticValue, previousSelection1, previousSelection2);
    this._choices = choices;
    this._actor = actor;
    this._prompt = prompt;
    this._title = title;
    this._item = item;
    this._key = key;
    this._dropFunc = dropFunc
    this._staticValue = staticValue;
    this._previousSelection1 = previousSelection1;
    this._previousSelection2 = previousSelection2;
  }

  static DEFAULT_OPTIONS = {
    actions: {
      focus: ChoicesPrompt.focus,
      influence: ChoicesPrompt.influence,
      origin: ChoicesPrompt.origin,
      passenger: ChoicesPrompt.passenger,
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
    if (this._item) {
      context.type = this._item.type;
    } else if (this._key) {
      context.type = "passenger";

    }

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
    _hangUpSelect(this._actor, selection.value, this._dropFunc);
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
      _showOriginSkillPrompt(this._actor, this._item, selection.value, this._dropFunc);
      this.close();
    }
  }

  static async passenger(event, selection) {
    _flipDriverAndPassenger( this._actor, this._key, this._staticValue, selection.value);
    this.close();
  }

  static async shield(event, selection) {
    setShieldOptions(this._actor, this._item, this._staticValue, selection.value, selection.name);
    this.close();
  }

  static async view(event, selection) {
    const item = await fromUuid(selection.dataset.uuid);
    if (item) {
      item.sheet.render(true);
    }
  }
}
