import { applyThemeClass } from "../settings.js";
import { serializeFormSubmits } from "./serialize-form-submits.mjs";
import { RULES_LINE_FLAG, customLines, worldLineId } from "../mechanics/resources/custom-game-lines.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** The actor types with no Role of their own whose GM picks the line they play by (Megaforms do it in Forming Rules). */
const RULES_LINE_TYPES = ['npc', 'companion', 'vehicle', 'zord'];

/**
 * The lines an actor can play by, for its "Plays by the rules of" picker: none (the core rules), the book lines, then
 * the homebrew ones.
 * @returns {Object<String, String>}
 */
export function rulesLineChoices() {
  return {
    "": game.i18n.localize("E20.RulesLineNone"),
    ...Object.fromEntries(Object.entries(CONFIG.E20.gameVersions).map(([key, label]) => [key, game.i18n.localize(label)])),
    ...Object.fromEntries(customLines().map(line => [line.id, line.label])),
  };
}

/**
 * Whether this actor's GM picks its line here: a GM, in a Crossover world (no world line - with one, the world's rules
 * apply to everyone), on a Role-less actor of a type that has one.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function picksRulesLine(actor) {
  return !!game.user?.isGM && !worldLineId() && RULES_LINE_TYPES.includes(actor?.type)
    && !actor.items.some(item => item.type == 'role');
}

export default class SheetOptions extends serializeFormSubmits(HandlebarsApplicationMixin(ApplicationV2)) {
  constructor(actor, ev) {
    super();
    this._ev = ev;
    this._actor = actor;
  }

  static DEFAULT_OPTIONS = {
    allowCustom: false,
    id: "sheet-options",
    classes: [
      // "essence20" was missing here, alone among this system's apps, so this one silently skipped
      // every rule the system scopes to that class - the Rajdhani font, the themed colours, all of
      // it. Found while auditing what the apps actually carry on their window roots.
      "essence20",
      "theme-wrapper",
      "e20-window",
      "window-app",
      "sheet-options",
    ],
    tag: "form",
    title: "E20.SheetOptions",
    form: {
      handler: SheetOptions.myFormHandler,
      submitOnChange: false,
      closeOnSubmit: true,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/sheet-options.hbs",
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  get title() {
    return game.i18n.localize(this.options.title) || super.title;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.role = this._actor.items.documentsByType.role.find(role => !role.system.isAdditive);
    const origin = await this._actor.items.documentByType?.origin;
    if (origin?.length > 1) {
      context.altMode = true;
    }

    context.actor = this._actor;
    // Crossover: the line a Role-less actor plays by (mechanics/resources/custom-game-lines.mjs#actorRulesLine).
    context.rulesLine = picksRulesLine(this._actor) ? {
      name: `flags.essence20.${RULES_LINE_FLAG}`,
      value: this._actor.getFlag("essence20", RULES_LINE_FLAG) ?? "",
      choices: rulesLineChoices(),
    } : null;
    context.system = this._actor.system;
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
    for (const [key, value] of Object.entries(formData.object)) {
      this._actor.update({
        [key]: value,
      });
    }
  }
}
