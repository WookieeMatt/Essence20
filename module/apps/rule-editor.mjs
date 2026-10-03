import { applyThemeClass } from "../settings.js";
import { applyEdit, prerequisitesFormHtml, previewLine, readInput, ruleFormHtml, tidy } from "../rules/editor-render.mjs";
import { describePrerequisite, prerequisitesOf } from "../rules/prerequisites.mjs";
import { unknownTags } from "../rules/predicate.mjs";
import { rulesOf } from "../rules/index.mjs";
import { ruleHelperNames } from "../rules/code.mjs";
import { validateRule } from "../rules/types.mjs";
import { SKELETONS } from "../rules/sheet.mjs";

const { ApplicationV2 } = foundry.applications.api;

/**
 * The guided rule editor (docs/RULES_ENGINE_PLAN.md §9) - one rule as a form in game words, so
 * nobody has to write JSON. Opened from the item sheet's Rules tab: the pencil on a rule, or Add.
 *
 * The form itself is built and read by rules/editor-render.mjs from the field descriptions in
 * rules/editor-spec.mjs; this window only holds the rule being edited, wires the inputs, and saves.
 * Nothing is written until Save - Cancel (or closing) leaves the item as it was, which also means a
 * rule picked from Add and then abandoned never lands on the item.
 *
 * Typing in a text box updates the preview line in place rather than redrawing the form, so a click
 * straight from a text box to Save isn't swallowed by a redraw; choices that change the shape of the
 * form (a select, a checkbox, adding a step) redraw it.
 */
export default class RuleEditor extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ['essence20', 'e20-window', 'e20-rule-editor'],
    window: { title: 'E20.Rules.Editor.Title', resizable: true, icon: 'fa-solid fa-scroll' },
    position: { width: 640, height: 'auto' },
    actions: {
      save: RuleEditor.#onSave,
      cancel: RuleEditor.#onCancel,
    },
  };

  /**
   * @param {Item} item
   * @param {Number} index   Which rule - rulesOf(item).length for a new one.
   * @param {Object} [rule]  The starting rule, for a new one.
   */
  constructor(item, index, rule = null, { prerequisites = false } = {}) {
    super({ id: `essence20-rule-editor-${item.id}-${prerequisites ? 'prerequisites' : index}` });
    this.item = item;
    this.index = index;
    // Prerequisites mode edits system.prerequisites ({when}) with the same condition picker.
    this.prerequisites = prerequisites;
    this.rule = prerequisites
      ? { when: foundry.utils.deepClone(prerequisitesOf(item)) }
      : foundry.utils.deepClone(rule ?? rulesOf(item)[index] ?? { type: 'RollModifier' });
    this.errors = [];
  }

  /** Open the editor on an item's rule, or on a new one. */
  static open(item, index, rule = null) {
    return new RuleEditor(item, index, rule).render({ force: true });
  }

  /** Open the editor on an item's prerequisites. */
  static openPrerequisites(item) {
    return new RuleEditor(item, 0, null, { prerequisites: true }).render({ force: true });
  }

  get title() {
    const key = this.prerequisites ? 'E20.Rules.Editor.PrerequisitesTitle' : 'E20.Rules.Editor.Title';
    return `${game.i18n.localize(key)}: ${this.item.name}`;
  }

  /** The line above the form: the rule's summary, or the prerequisites in plain words. */
  #preview() {
    if (this.prerequisites) {
      const when = tidy(this.rule).when ?? [];
      return when.length ? when.map(describePrerequisite).join('; ') : game.i18n.localize('E20.Rules.Editor.NoPrerequisites');
    }

    return previewLine(this.rule);
  }

  async _renderHTML() {
    const context = { helpers: ruleHelperNames() };
    const errors = this.errors.length
      ? `<ul class="e20-editor-errors">${this.errors.map(e => `<li>${foundry.utils.escapeHTML(e)}</li>`).join('')}</ul>`
      : '';
    return `<form class="e20-editor-form" autocomplete="off">
      <p class="e20-editor-preview">${foundry.utils.escapeHTML(this.#preview())}</p>
      ${errors}
      <div class="e20-editor-fields">${this.prerequisites ? prerequisitesFormHtml(this.rule, context) : ruleFormHtml(this.rule, context)}</div>
      <label class="e20-editor-advanced-toggle"><input type="checkbox" data-advanced${this._showAdvanced ? ' checked' : ''}> ${game.i18n.localize('E20.Rules.Field.ShowAdvanced')}</label>
      <footer class="e20-editor-footer">
        <button type="button" data-action="cancel">${game.i18n.localize('Cancel')}</button>
        <button type="button" data-action="save"><i class="fas fa-save"></i> ${game.i18n.localize('E20.Rules.Editor.Save')}</button>
      </footer>
    </form>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
    content.classList.toggle('show-advanced', !!this._showAdvanced);
  }

  /** Listeners on the window itself - it outlives every redraw, so these are added once. */
  _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);
    const root = this.element;
    root.addEventListener('change', event => this.#onChange(event));
    root.addEventListener('input', event => {
      if (['text', 'formula', 'number'].includes(event.target.dataset?.kind)) {
        this.#write(event.target);
        const preview = root.querySelector('.e20-editor-preview');
        if (preview) {
          preview.textContent = this.#preview();
        }
      }
    });

    // Drop an Item on the editor to fill an item field (Grant, the grant step).
    root.addEventListener('dragover', event => event.preventDefault());
    root.addEventListener('drop', event => this.#onDrop(event));
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    applyThemeClass(this.element);
    const root = this.element;

    root.querySelector('[data-advanced]')?.addEventListener('change', event => {
      this._showAdvanced = event.currentTarget.checked;
      root.querySelector('.window-content')?.classList.toggle('show-advanced', this._showAdvanced);
    });

    for (const control of root.querySelectorAll('[data-edit]')) {
      control.addEventListener('click', event => {
        event.preventDefault();
        applyEdit(this.rule, control.dataset.edit, control.dataset.path, Number(control.dataset.index) || 0);
        this.render();
      });
    }

  }

  /** Write one input into the rule. */
  #write(input) {
    const kind = input.dataset.kind;
    let row = null;
    if (kind?.startsWith('tag')) {
      const li = input.closest('.e20-tag-row');
      row = {
        not: li?.querySelector('[data-kind="tagNot"]')?.checked,
        family: li?.querySelector('[data-kind="tagFamily"]')?.value,
        arg: li?.querySelector('[data-kind="tagArg"]')?.value ?? '',
      };
    }

    readInput(this.rule, input.name, kind, input.type == 'checkbox' ? input.checked : input.value, row);
  }

  #onChange(event) {
    const input = event.target;
    const kind = input?.dataset?.kind;
    if (!kind || !input.name) {
      return;
    }

    if (kind == 'ruleType') {
      // A different kind of rule starts from that kind's own skeleton, keeping its name and condition.
      const { label, when } = this.rule;
      this.rule = { ...foundry.utils.deepClone(SKELETONS[input.value] ?? { type: input.value }), ...(label ? { label } : {}), ...(when ? { when } : {}) };
      this.errors = [];
      this.render();
      return;
    }

    this.#write(input);
    if (!['text', 'formula', 'number'].includes(kind)) {
      this.render();
    }
  }

  async #onDrop(event) {
    event.preventDefault();
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (data?.type != 'Item' || !data.uuid) {
      return;
    }

    const field = event.target.closest?.('[data-field="uuid"]') ?? this.element.querySelector('[data-field="uuid"]');
    const input = field?.querySelector('input');
    if (input) {
      readInput(this.rule, input.name, 'text', data.uuid);
      this.render();
    }
  }

  static async #onSave() {
    if (this.prerequisites) {
      const when = tidy(this.rule).when ?? [];
      this.errors = unknownTags(when).map(tag => `unknown tag "${tag}"`);
      if (this.errors.length) {
        this.render();
        return;
      }

      await this.item.update({ 'system.prerequisites': when.length ? { when } : {} });
      await this.close();
      return;
    }

    const rule = tidy(this.rule);
    this.errors = validateRule(rule);
    if (this.errors.length) {
      this.render();
      return;
    }

    const rules = foundry.utils.deepClone(rulesOf(this.item));
    rules[Math.min(this.index, rules.length)] = rule;
    await this.item.update({ 'system.rules': rules });
    await this.close();
  }

  static async #onCancel() {
    await this.close();
  }
}
