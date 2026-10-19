import { applyThemeClass } from "../settings.js";
import { HOUSE_RULES_SETTING, houseRuleEnabled, houseRules } from "../rules/house-rules.mjs";
import { serializeFormSubmits } from "./serialize-form-submits.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM-only House Rules screen (Configure Settings > House Rules): every house rule (rules/house-rules.mjs), grouped by
 * the module that added it - the world's own under "This World", with New House Rule, edit and delete
 * (apps/house-rule-editor.mjs) - each with an on/off switch, its description and what its rules do.
 */
export default class HouseRulesConfig extends serializeFormSubmits(HandlebarsApplicationMixin(ApplicationV2)) {
  static DEFAULT_OPTIONS = {
    id: "essence20-house-rules",
    classes: ["essence20", "theme-wrapper", "e20-window", "house-rules-config"],
    tag: "form",
    window: {
      icon: "fa-solid fa-scroll",
      title: "E20.HouseRulesTitle",
    },
    position: {
      width: 520,
      height: "auto",
    },
    form: {
      handler: HouseRulesConfig.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: true,
    },
    actions: {
      newHouseRule: HouseRulesConfig.#onNew,
      editHouseRule: HouseRulesConfig.#onEdit,
      deleteHouseRule: HouseRulesConfig.#onDelete,
    },
  };

  static PARTS = {
    form: {
      template: "systems/essence20/templates/app/house-rules.hbs",
      scrollable: [".house-rules-groups"],
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  // Switches ticked but not saved yet - kept when the list redraws (a house rule added or edited meanwhile).
  #pending = {};

  async _prepareContext() {
    const { summarizeRule } = await import("../rules/types.mjs");
    const worldTitle = game.i18n.localize("E20.HouseRulesWorld");
    // The world's own first, so its New button sits at the top.
    const groups = new Map([[worldTitle, []]]);
    for (const rule of houseRules()) {
      const title = rule.world ? worldTitle : (game.modules.get(rule.module)?.title ?? (rule.module || worldTitle));
      if (!groups.has(title)) {
        groups.set(title, []);
      }

      groups.get(title).push({
        id: rule.id,
        world: rule.world,
        label: game.i18n.localize(rule.label),
        hint: rule.hint ? game.i18n.localize(rule.hint) : "",
        enabled: this.#pending[rule.id] ?? houseRuleEnabled(rule.id),
        // What its rules do, in the same plain words the Rules tab uses; none for a switch the module's own code reads.
        does: rule.rules.map(entry => {
          try {
            return summarizeRule(entry);
          } catch {
            return entry.type;
          }
        }).filter(Boolean),
      });
    }

    return {
      groups: [...groups].map(([name, rules]) => ({ name, rules, world: name == worldTitle })),
      buttons: [{ type: "submit", icon: "fa-solid fa-save", label: "SETTINGS.Save" }],
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    applyThemeClass(this.element);
    for (const checkbox of this.element.querySelectorAll("[data-house-rule]")) {
      checkbox.addEventListener("change", () => {
        this.#pending[checkbox.dataset.houseRule] = checkbox.checked;
      });
    }
  }

  static async #onNew() {
    const { default: HouseRuleEditor } = await import("./house-rule-editor.mjs");
    HouseRuleEditor.open(null);
  }

  static async #onEdit(event, target) {
    const { default: HouseRuleEditor } = await import("./house-rule-editor.mjs");
    HouseRuleEditor.open(target.dataset.id);
  }

  static async #onDelete(event, target) {
    const { deleteWorldHouseRule } = await import("./house-rule-editor.mjs");
    if (await deleteWorldHouseRule(target.dataset.id)) {
      delete this.#pending[target.dataset.id];
    }
  }

  static async #onSubmit(event, form) {
    const chosen = { ...(game.settings.get("essence20", HOUSE_RULES_SETTING) ?? {}) };
    for (const checkbox of form.querySelectorAll("[data-house-rule]")) {
      chosen[checkbox.dataset.houseRule] = checkbox.checked;
    }

    this.#pending = {};
    await game.settings.set("essence20", HOUSE_RULES_SETTING, chosen);
  }
}
