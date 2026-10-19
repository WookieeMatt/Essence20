import { applyThemeClass } from "../settings.js";
import { HOUSE_RULES_SETTING, WORLD_HOUSE_RULES_SETTING, houseRuleEnabled, worldHouseRules } from "../rules/house-rules.mjs";
import { summarizeRule, validateRule } from "../rules/types.mjs";
import { serializeFormSubmits } from "./serialize-form-submits.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A world's own house rule, made in Foundry (House Rules > New House Rule, or the pencil on one): its name, its
 * description, whether it's on, and its rules - each edited with the same guided Rules editor an item's Rules tab opens
 * (apps/rule-editor.mjs), so nobody writes JSON. Dropping an Item here copies its rules in: build a rule on a test item's
 * Rules tab, try it on a character, then drop the item.
 *
 * Nothing is kept until Save; it then lands in the world setting essence20.worldHouseRules (rules/house-rules.mjs), and
 * every actor picks it up.
 */
export default class HouseRuleEditor extends serializeFormSubmits(HandlebarsApplicationMixin(ApplicationV2)) {
  static DEFAULT_OPTIONS = {
    classes: ["essence20", "theme-wrapper", "e20-window", "house-rule-editor"],
    tag: "form",
    window: { icon: "fa-solid fa-scroll", resizable: true },
    position: { width: 560, height: "auto" },
    form: { handler: HouseRuleEditor.#onSubmit, submitOnChange: false, closeOnSubmit: false },
    actions: {
      addRule: HouseRuleEditor.#onAddRule,
      editRule: HouseRuleEditor.#onEditRule,
      removeRule: HouseRuleEditor.#onRemoveRule,
      cancel: HouseRuleEditor.#onCancel,
    },
  };

  static PARTS = {
    form: { template: "systems/essence20/templates/app/house-rule-editor.hbs" },
    footer: { template: "templates/generic/form-footer.hbs" },
  };

  /**
   * @param {String|null} id   A world house rule's id, or null for a new one.
   */
  constructor(id = null) {
    const stored = id ? worldHouseRules().find(entry => entry.id == id) : null;
    const draftId = stored?.id ?? `world-${foundry.utils.randomID(12)}`;
    super({ id: `essence20-house-rule-editor-${draftId}` });
    this.isNew = !stored;
    this.draft = {
      id: draftId, label: stored?.label ?? "", hint: stored?.hint ?? "",
      rules: foundry.utils.deepClone(stored?.rules ?? []),
      on: stored ? houseRuleEnabled(draftId) : true,
    };
  }

  /** Open the editor on a world house rule, or on a new one. */
  static open(id = null) {
    return new HouseRuleEditor(id).render({ force: true });
  }

  get title() {
    const base = game.i18n.localize(this.isNew ? "E20.HouseRuleNewTitle" : "E20.HouseRuleEditTitle");
    return this.draft.label ? `${base}: ${this.draft.label}` : base;
  }

  /**
   * What the Rules editor edits: enough of an item for it (id, name, system.rules, update). Its Save hands the whole list
   * back through update, which only changes this draft.
   */
  #ruleHost() {
    const app = this;
    return {
      id: `house-${this.draft.id}`,
      name: this.draft.label || game.i18n.localize("E20.HouseRuleNewTitle"),
      flags: { essence20: {} },
      system: { rules: this.draft.rules },
      async update(data) {
        if (Array.isArray(data?.["system.rules"])) {
          app.draft.rules = foundry.utils.deepClone(data["system.rules"]);
          app.render();
        }

        return this;
      },
    };
  }

  async _prepareContext() {
    return {
      draft: this.draft,
      rules: this.draft.rules.map((rule, index) => {
        let summary = rule?.type ?? "";
        try {
          summary = summarizeRule(rule) || summary;
        } catch {
          // Shown as its type.
        }

        return { index, summary, errors: validateRule(rule) };
      }),
      buttons: [
        { type: "button", action: "cancel", label: "Cancel" },
        { type: "submit", icon: "fa-solid fa-save", label: "E20.HouseRuleSave" },
      ],
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    applyThemeClass(this.element);
    // Typed values live in the draft, so redrawing the rule list keeps them.
    for (const input of this.element.querySelectorAll("[data-draft]")) {
      input.addEventListener("input", () => this.#read(input));
      input.addEventListener("change", () => this.#read(input));
    }
  }

  _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);
    // Drop an Item to copy its rules in.
    this.element.addEventListener("dragover", event => event.preventDefault());
    this.element.addEventListener("drop", event => this.#onDrop(event));
  }

  #read(input) {
    this.draft[input.dataset.draft] = input.type == "checkbox" ? input.checked : input.value;
  }

  async #onDrop(event) {
    event.preventDefault();
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (data?.type != "Item" || !data.uuid) {
      return;
    }

    const item = await fromUuid(data.uuid);
    const rules = Array.isArray(item?.system?.rules) ? item.system.rules : [];
    if (!rules.length) {
      ui.notifications.warn(game.i18n.format("E20.HouseRuleDropNone", { name: item?.name ?? "" }));
      return;
    }

    this.draft.rules.push(...foundry.utils.deepClone(rules));
    if (!this.draft.label) {
      this.draft.label = item.name;
    }

    ui.notifications.info(game.i18n.format("E20.HouseRuleDropped", { count: rules.length, name: item.name }));
    this.render();
  }

  static async #onAddRule() {
    const { default: RuleEditor } = await import("./rule-editor.mjs");
    RuleEditor.open(this.#ruleHost(), this.draft.rules.length);
  }

  static async #onEditRule(event, target) {
    const { default: RuleEditor } = await import("./rule-editor.mjs");
    RuleEditor.open(this.#ruleHost(), Number(target.dataset.index));
  }

  static #onRemoveRule(event, target) {
    this.draft.rules.splice(Number(target.dataset.index), 1);
    this.render();
  }

  static #onCancel() {
    this.close();
  }

  static async #onSubmit() {
    const label = String(this.draft.label ?? "").trim();
    if (!label) {
      ui.notifications.warn(game.i18n.localize("E20.HouseRuleNeedsName"));
      return;
    }

    const broken = this.draft.rules.findIndex(rule => validateRule(rule).length);
    if (broken >= 0) {
      ui.notifications.warn(game.i18n.format("E20.HouseRuleBrokenRule", { number: broken + 1 }));
      return;
    }

    const entry = { id: this.draft.id, label, hint: String(this.draft.hint ?? "").trim(), rules: this.draft.rules };
    const list = worldHouseRules().filter(other => other.id != entry.id);
    const at = worldHouseRules().findIndex(other => other.id == entry.id);
    list.splice(at < 0 ? list.length : at, 0, entry);
    // Whether it's on first, so the list's own change finds it already decided.
    await game.settings.set("essence20", HOUSE_RULES_SETTING, { ...(game.settings.get("essence20", HOUSE_RULES_SETTING) ?? {}), [entry.id]: !!this.draft.on });
    await game.settings.set("essence20", WORLD_HOUSE_RULES_SETTING, list);
    await this.close();
  }
}

/**
 * Delete a world house rule, after asking. Exported for the House Rules page.
 * @param {String} id
 * @returns {Promise<Boolean>}   Whether it was deleted.
 */
export async function deleteWorldHouseRule(id) {
  const entry = worldHouseRules().find(other => other.id == id);
  if (!entry) {
    return false;
  }

  const { DialogV2 } = foundry.applications.api;
  const sure = await DialogV2.confirm({
    window: { title: game.i18n.localize("E20.HouseRuleDeleteTitle") },
    content: `<p>${game.i18n.format("E20.HouseRuleDeleteConfirm", { name: foundry.utils.escapeHTML(entry.label) })}</p>`,
    rejectClose: false,
  });
  if (!sure) {
    return false;
  }

  const choices = { ...(game.settings.get("essence20", HOUSE_RULES_SETTING) ?? {}) };
  delete choices[id];
  await game.settings.set("essence20", HOUSE_RULES_SETTING, choices);
  await game.settings.set("essence20", WORLD_HOUSE_RULES_SETTING, worldHouseRules().filter(other => other.id != id));
  return true;
}
