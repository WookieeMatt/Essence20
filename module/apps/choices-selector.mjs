import { _checkForAltModes, _hangUpSelect, _showOriginSkillPrompt, setOriginValues } from "../sheet-handlers/background-handler.mjs";
import { _attachSelectedItemOptionHandler, grantItemEntry } from "../sheet-handlers/attachment-handler.mjs";
import { _focusStatUpdate } from "../sheet-handlers/role-handler.mjs";
import { setShieldOptions } from "../sheet-handlers/listener-item-handler.mjs";
import { onPerkDrop } from "../sheet-handlers/perk-handler.mjs";
import { _flipDriverAndPassenger } from "../sheet-handlers/vehicle-handler.mjs";
import { applyThemeClass } from "../settings.js";

import { serializeFormSubmits } from "./serialize-form-submits.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** More choices than this and the dialog gets a search box. */
const SEARCHABLE_AT = 12;

export default class ChoicesSelector extends serializeFormSubmits(HandlebarsApplicationMixin(ApplicationV2)) {
  constructor(choices, actor, prompt, title, item, key, dropFunc, staticValue, previousSelection1, previousSelection2, actionType) {
    // A long list's window can be resized (see _onRender); a short one keeps its fixed size.
    super({ window: { resizable: Object.keys(choices ?? {}).length > SEARCHABLE_AT } });
    this._choices = choices;
    this._actor = actor;
    this._prompt = prompt;
    this._title = title;
    this._item = item;
    this._key = key;
    this._dropFunc = dropFunc;
    this._staticValue = staticValue;
    this._previousSelection1 = previousSelection1;
    this._previousSelection2 = previousSelection2;
    // Overrides the default type-derived-from-item/key action dispatch below - needed when the
    // dialog's choices aren't about the passed-in item itself (e.g. a role-level Perk choice,
    // where `item` is the Role but the action to dispatch is "rolePerk", not "role").
    this._actionType = actionType;
  }

  static DEFAULT_OPTIONS = {
    actions: {
      focus: ChoicesSelector.focus,
      influence: ChoicesSelector.influence,
      origin: ChoicesSelector.origin,
      perk: ChoicesSelector.perk,
      passenger: ChoicesSelector.passenger,
      rolePerk: ChoicesSelector.rolePerk,
      shield: ChoicesSelector.shield,
      upgrade: ChoicesSelector.attach,
      weaponEffect: ChoicesSelector.attach,
      view: ChoicesSelector.view,
    },
    // "{id}" - Foundry's own ApplicationV2 substitutes a fresh per-instance uniqueId here (see
    // application.mjs's this.#id = this.options.id.replace("{id}", this.options.uniqueId)).
    // Without it (a bare "choices", as this used to be), two ChoicesSelectors created back-to-back
    // - e.g. a Role granting the same choice-driven Perk twice in one level-up batch, like
    // Commando's Expertise at 1st level - collide on the same Application registry id/DOM id, and
    // the second instance's render silently replaces the first before the player ever sees or
    // resolves it. That's what "only got to pick one of two skills" actually was.
    id: "choices-{id}",
    classes: [
      "essence20",
      "theme-wrapper",
      "e20-window",
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
    context.choices = this._choices;
    context.prompt = this._prompt;

    // A long list gets a search box, and a game-line filter when its choices carry one (Nobody
    // Like Me offers every General Perk in every enabled book - hundreds of buttons otherwise).
    // Short lists render exactly as before.
    const choices = Object.values(this._choices);
    context.searchable = choices.length > SEARCHABLE_AT;
    if (context.searchable) {
      context.choices = Object.fromEntries(Object.entries(this._choices).map(([key, choice]) => [key, {
        ...choice,
        search: `${choice.label ?? ''} ${choice.detail ?? ''}`.toLowerCase(),
      }]));
    }

    const groups = [...new Set(choices.map(choice => choice.group).filter(Boolean))].sort();
    context.groups = groups.length > 1 ? groups : [];
    context.defaultGroup = groups.includes(this.defaultGroup) ? this.defaultGroup : '';
    if (this._actionType) {
      context.type = this._actionType;
    } else if (this._item) {
      context.type = this._item.type;
    } else if (this._key) {
      context.type = "passenger";
    }

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);

    applyThemeClass(this.element);
    this._activateFilter();

    // A long list is sized to the screen once, on first render, and its window made resizable:
    // left to size itself to hundreds of buttons, the window ran off the bottom of a short screen
    // with its own content clipped, so the list could not be scrolled to the end.
    if (context.searchable) {
      this.element.classList.add('choice-selector-long');
      if (options.isFirstRender) {
        this.setPosition({ height: Math.min(680, Math.round(window.innerHeight * 0.85)), width: 560 });
      }
    }
  }

  /**
   * Shows only the choices matching the search text and the chosen game line. Done in place on
   * the rendered buttons rather than by re-rendering, so typing stays instant on a list of
   * hundreds and keeps focus in the box.
   */
  _activateFilter() {
    const search = this.element.querySelector('input[name="choiceSearch"]');
    if (!search) return;

    const group = this.element.querySelector('select[name="choiceGroup"]');
    const count = this.element.querySelector('.choice-count');
    const rows = [...this.element.querySelectorAll('.choice-buttons .choice')];
    const apply = () => {
      const text = search.value.trim().toLowerCase();
      const line = group?.value ?? '';
      let shown = 0;
      for (const row of rows) {
        const visible = (!text || row.dataset.search.includes(text)) && (!line || row.dataset.group === line);
        row.hidden = !visible;
        if (visible) shown++;
      }

      if (count) count.textContent = game.i18n.format("E20.ChoiceSearchCount", { shown, total: rows.length });
    };

    search.addEventListener('input', apply);
    group?.addEventListener('change', apply);
    // Enter would submit the form, and this dialog has no submit - the choice buttons are it.
    search.addEventListener('keydown', event => {
      if (event.key === 'Enter') event.preventDefault();
    });
    apply();
    search.focus();
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

  static async perk (event, selection) {
    onPerkDrop(this._actor, this._item, this._dropFunc, selection.value, this._choices[selection.value].type, this._previousSelection1);
    this.close();
  }

  static async rolePerk(event, selection) {
    const choice = this._choices[selection.value];
    await grantItemEntry(selection.value, choice.entry, this._actor, this._item);
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
