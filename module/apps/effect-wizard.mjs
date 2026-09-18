import { applyThemeClass } from "../settings.js";
import {
  EFFECT_GROUPS,
  appendChanges,
  buildChange,
  buildChanges,
  summarize,
} from "../helpers/effect-catalog.mjs";
import { slugifySpecializationName, titleCaseSpecializationName } from "../helpers/utils.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Builds Active Effect changes from game vocabulary instead of schema paths - "Skills,
 * Infiltration, Shift, +1" rather than `system.skills.infiltration.shiftUp` / add / 1.
 *
 * Deliberately NOT a replacement for Foundry's own effect sheet: anyone who already knows the
 * keys keeps the editor they have, and this is an opt-in tool reached from the Effects tab's add
 * button (see helpers/effects.mjs#onCreateActiveEffect) or an effect sheet's own header menu.
 * The rows it writes are ordinary changes with core change types, indistinguishable from
 * hand-authored ones - see docs/ACTIVE_EFFECTS_UI_PLAN.md §2.
 *
 * Search is the primary path, not the three dropdowns: the whole point is helping someone who
 * does not know what the keys look like, and "infiltration" or "sneak" is what they actually
 * have in their head.
 */
export default class EffectWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {ActiveEffect|null} effect The effect the built changes are added to, or null when the
   *   effect does not exist yet - see EffectWizard.forNewEffect.
   * @param {Object} [options]
   * @param {Boolean} [options.openSheetWhenDone] Open the effect's normal sheet on finish, so the
   *   author sees the rows the wizard produced rather than being left guessing.
   * @param {Document} [options.owner] The Actor/Item the effect will be created on, for the
   *   deferred case.
   * @param {Object} [options.createData] The effect document data to create, for the deferred case.
   */
  constructor(effect, { openSheetWhenDone = false, owner = null, createData = null } = {}) {
    super({ id: `essence20-effect-wizard-${effect?.id ?? `new-${owner?.id ?? foundry.utils.randomID()}`}` });
    this._effect = effect;
    this._owner = owner ?? effect?.parent ?? null;
    this._createData = createData;
    this._openSheetWhenDone = openSheetWhenDone;

    // Rows built so far but not yet written - a multi-part Perk is one pass through the wizard.
    this._pending = [];

    // The in-progress selection.
    this._groupId = EFFECT_GROUPS[0].id;
    this._propertyId = EFFECT_GROUPS[0].properties[0].id;
    this._target = null;
    this._target2 = null;
    this._value = 1;
    this._search = "";
  }

  /**
   * Open the wizard for an effect that does not exist yet.
   *
   * Nothing is written until "Add to Effect" is clicked: cancelling leaves the sheet exactly as it
   * was, rather than an empty "New Effect" the author now has to notice and delete. The effect is
   * then created in ONE operation with its changes already on it, so it never briefly exists in a
   * do-nothing state.
   * @param {Document} owner        The Actor or Item to create the effect on.
   * @param {Object} createData     The effect document data (name, img, duration, disabled).
   * @param {Object} [options]
   * @param {Boolean} [options.openSheetWhenDone]
   * @returns {EffectWizard}
   */
  static forNewEffect(owner, createData, { openSheetWhenDone = false } = {}) {
    return new this(null, { owner, createData, openSheetWhenDone });
  }

  static DEFAULT_OPTIONS = {
    actions: {
      addPending: EffectWizard.#onAddPending,
      removePending: EffectWizard.#onRemovePending,
      pickSearchResult: EffectWizard.#onPickSearchResult,
      finish: EffectWizard.#onFinish,
      cancel: EffectWizard.#onCancel,
    },
    classes: ["essence20", "sheet", "theme-wrapper", "effect-wizard"],
    tag: "form",
    position: { width: 560, height: "auto" },
    window: {
      title: "E20.EffectWizardTitle",
      icon: "fa-solid fa-wand-magic-sparkles",
      resizable: true,
    },
  };

  static PARTS = {
    form: { template: "systems/essence20/templates/app/effect-wizard.hbs" },
  };

  /* -------------------------------------------- */

  /** The group currently selected. */
  get group() {
    return EFFECT_GROUPS.find(group => group.id === this._groupId);
  }

  /** The property currently selected, falling back to the group's first. */
  get property() {
    return this.group.properties.find(property => property.id === this._propertyId)
      ?? this.group.properties.find(property => !property.readOnly);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const group = this.group;
    const property = this.property;

    // readOnly properties are computed fields - reachable by hand in the normal editor, never
    // offered here (see the catalog's own doc comment).
    context.groups = EFFECT_GROUPS.map(g => ({
      value: g.id,
      label: game.i18n.localize(g.label),
      selected: g.id === this._groupId,
    }));

    context.properties = group.properties
      .filter(p => !p.readOnly)
      .map(p => ({
        value: p.id,
        label: game.i18n.localize(p.label),
        selected: p.id === property.id,
      }));

    const targetTable = property.targetless
      ? null
      : (property.targetsOverride?.() ?? group.targets?.() ?? null);

    context.targets = targetTable
      ? Object.entries(targetTable).map(([value, label]) => ({
        value,
        label: game.i18n.localize(label),
        selected: value === this._target,
      }))
      : null;

    context.targets2 = property.target2
      ? Object.entries(property.target2()).map(([value, label]) => ({
        value,
        label: game.i18n.localize(label),
        selected: value === this._target2,
      }))
      : null;

    // Specializations have no table to pick from - they're named freely, and only exist once an
    // actor has them. So: a text box, with whatever the owning actor already has offered as
    // suggestions, which is the difference between "type it exactly right" and "pick the one you
    // meant". An effect on an unowned compendium item simply gets no suggestions.
    context.dynamicTarget2 = !!group.dynamicTarget2;
    context.target2Value = this._target2 ?? "";
    context.target2Suggestions = group.dynamicTarget2
      ? this.#existingSpecializations(this._target)
      : [];
    const target2LabelKey = property.target2Label ?? group.target2Label;
    context.target2Label = target2LabelKey ? game.i18n.localize(target2LabelKey) : "";

    context.widget = property.widget;
    context.hideValue = !!group.dynamicTarget2 && property.widget === "text";
    context.value = this._value;
    context.hint = property.hint ? game.i18n.localize(property.hint) : "";
    context.choices = property.choices
      ? Object.entries(property.choices()).map(([value, label]) => ({
        value,
        label: game.i18n.localize(label),
        selected: value === this._value,
      }))
      : null;

    context.search = this._search;
    context.preview = this.#preview();
    context.pending = this._pending.map((change, index) => ({
      index,
      summary: summarize(change) ?? change.key,
    }));
    context.effectName = this._effect?.name ?? this._createData?.name ?? "";
    context.canFinish = this._pending.length > 0 || !!context.preview;

    return context;
  }

  /* -------------------------------------------- */

  /**
   * The sentence for the current selection, or null when it wouldn't build a change (a shift of
   * zero, an Edge/Snag control still on neither).
   * @returns {String|null}
   */
  #preview() {
    const change = this.#buildCurrent();

    return change ? summarize(change) : null;
  }

  /**
   * The selection as the catalog wants it. A dynamic second target (a Specialization) is typed
   * as a display name and has to become a slug first - the same slug
   * sheet-handlers/specialization-handler.mjs would have produced for a bought one, so an effect
   * and a hand-added Specialization land on the same entry rather than two near-duplicates.
   * @returns {Object}
   */
  #selection() {
    const dynamic = this.group.dynamicTarget2 && this._target2;
    const target2 = dynamic ? slugifySpecializationName(this._target2) : this._target2;

    // A grant stores the Specialization's own display name, and that name is also what the key
    // slug was made from - so the one text box supplies both rather than asking twice.
    const value = (dynamic && this.property.widget === "text")
      ? titleCaseSpecializationName(this._target2)
      : this._value;

    return {
      groupId: this._groupId,
      propertyId: this.property.id,
      target: this._target,
      target2,
      value,
    };
  }

  /** @returns {Object|null} The change the current selection would build. */
  #buildCurrent() {
    return buildChange(this.#selection());
  }

  /** @returns {Array<Object>} Every change the current selection would build. */
  #buildCurrentAll() {
    return buildChanges(this.#selection());
  }

  /**
   * Free-text search across group, property and target names plus each property's own keywords,
   * so "infiltration", "sneak", "upshift" and "toughness" all land somewhere useful.
   * @param {String} query
   * @returns {Array<Object>} Up to 12 {groupId, propertyId, target, label} matches.
   */
  #search(query) {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) {
      return [];
    }

    const results = [];

    for (const group of EFFECT_GROUPS) {
      const groupLabel = game.i18n.localize(group.label);

      for (const property of group.properties) {
        if (property.readOnly) {
          continue;
        }

        const propertyLabel = game.i18n.localize(property.label);
        const keywords = (property.keywords ?? []).join(" ");
        const targetTable = property.targetless
          ? null
          : (property.targetsOverride?.() ?? group.targets?.() ?? null);
        const targets = targetTable ? Object.entries(targetTable) : [[null, null]];

        for (const [target, targetLabelKey] of targets) {
          const targetLabel = targetLabelKey ? game.i18n.localize(targetLabelKey) : "";
          const score = this.#scoreMatch(needle, { targetLabel, propertyLabel, groupLabel, keywords });
          if (!score) {
            continue;
          }

          results.push({
            score,
            groupId: group.id,
            propertyId: property.id,
            target,
            label: [groupLabel, targetLabel, propertyLabel].filter(part => !!part).join(" › "),
          });
        }
      }
    }

    // Rank before truncating, or the cheapest match wins purely by catalog order. Keywords live on
    // the PROPERTY and are therefore shared by all its targets - the Defenses bonus lists
    // "toughness evasion willpower cleverness" - so an unranked search for "toughness" returns
    // Cleverness first and the thing you asked for third. That matters more than it looks: Enter
    // takes the first result.
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }

  /**
   * How well one catalog entry matches what was typed. Higher is better, 0 means no match.
   * @param {String} needle
   * @param {Object} parts  The entry's own target/property/group labels and keyword blob.
   * @returns {Number}
   */
  #scoreMatch(needle, { targetLabel, propertyLabel, groupLabel, keywords }) {
    const target = targetLabel.toLowerCase();
    const property = propertyLabel.toLowerCase();
    const groupName = groupLabel.toLowerCase();

    // What you name is almost always the thing you want: an exact target ("Infiltration") beats a
    // target that merely starts with it, which beats a property or group name, which beats a
    // keyword the property happens to carry for all of its targets.
    if (target === needle) {
      return 100;
    }

    if (target.startsWith(needle)) {
      return 80;
    }

    if (target.includes(needle)) {
      return 60;
    }

    // Naming a group exactly ("health") means "show me the Health things", and within a group the
    // catalog's own order is the curated priority - Bonus before Origin Health. Without this, the
    // property whose LABEL happens to repeat the group name ("Origin Health") outranks the field
    // that is actually the supported way to do the job, and Enter picks it.
    if (groupName === needle) {
      return 50;
    }

    if (property.includes(needle)) {
      return 40;
    }

    if (groupName.includes(needle)) {
      return 20;
    }

    return keywords.toLowerCase().includes(needle) ? 10 : 0;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRender(context, options) {
    super._onRender(context, options);
    applyThemeClass(this.element);

    // Every control re-renders the window so the preview sentence and the value widget stay in
    // step with the selection. Cheap - this is a small form - and it keeps all the state in one
    // place rather than duplicating the catalog's rules in DOM juggling.
    this.element.querySelectorAll("[data-wizard-field]").forEach(input => {
      // Read the value off the element rather than the event: the search box's handler is
      // debounced, and by the time a debounced callback runs the event has finished dispatching,
      // so event.currentTarget is already null.
      input.addEventListener("change", () => {
        this.#applyField(input.dataset.wizardField, input.value);
      });
    });

    const search = this.element.querySelector('[data-wizard-field="search"]');
    if (search) {
      // Searching deliberately does NOT go through #applyField/render: a full re-render replaces
      // this very input element while the user is typing into it, and the browser puts the caret
      // back at position 0 of the new one - which reads as the cursor jumping to the start of the
      // field mid-word. Only the results list needs to change, so only the results list is
      // touched, and the input is left completely alone.
      search.addEventListener("input", foundry.utils.debounce(() => {
        this._search = search.value;
        this.#refreshSearchResults();
      }, 200));

      // The wizard's root element is a <form>, so Enter would otherwise try to submit it. Taking
      // the first result instead is what the key is obviously for while a search is open.
      search.addEventListener("keydown", event => {
        if (event.key !== "Enter") {
          return;
        }

        event.preventDefault();
        const first = this.element.querySelector('[data-search-results] [data-action="pickSearchResult"]');
        first?.click();
      });
    }

    this.#refreshSearchResults();
  }

  /**
   * Rebuild just the search results, leaving every other element - the search box above all -
   * exactly as it is. See the input listener above for why this is not a render().
   * @returns {Promise<void>}
   */
  async #refreshSearchResults() {
    const container = this.element?.querySelector("[data-search-results]");
    if (!container) {
      return;
    }

    container.innerHTML = await foundry.applications.handlebars.renderTemplate(
      "systems/essence20/templates/app/effect-wizard-results.hbs",
      { searchResults: this.#search(this._search) },
    );
  }

  /**
   * The Specializations the effect's own actor already has under a skill, offered as suggestions
   * in the free-text box.
   *
   * The effect may sit on an Actor directly, or on an Item that an Actor owns (the usual case -
   * a Perk), or on an Item in a compendium with no actor at all, which simply yields nothing.
   * @param {String|null} skillKey
   * @returns {String[]} Display names, not slugs - the box takes a name.
   */
  #existingSpecializations(skillKey) {
    if (!skillKey) {
      return [];
    }

    const parent = this._effect?.parent ?? this._owner;
    const actor = parent?.documentName === "Actor" ? parent : parent?.parent;
    const specializations = actor?.system?.skills?.[skillKey]?.specializations;
    if (!specializations) {
      return [];
    }

    return Object.values(specializations)
      .map(specialization => specialization?.name)
      .filter(name => !!name);
  }

  /**
   * The value a freshly picked property should start on, so every widget opens on something
   * valid - a choice widget in particular has no sensible numeric default.
   * @param {Object} property
   * @returns {Number|String}
   */
  #defaultValueFor(property) {
    switch (property.widget) {
    case "edgeSnag":
      return "plus";
    case "choice":
      return Object.keys(property.choices())[0];
    case "bool":
      return "true";
    case "text":
      return "";
    default:
      return 1;
    }
  }

  /**
   * Track a control's new value, resetting anything downstream of it that no longer applies.
   * @param {String} field
   * @param {String} value
   */
  #applyField(field, value) {
    switch (field) {
    case "group":
      this._groupId = value;
      this._propertyId = this.group.properties.find(p => !p.readOnly).id;
      this._target = null;
      this._target2 = null;
      this._value = this.#defaultValueFor(this.property);
      break;
    case "property":
      this._propertyId = value;
      // A second target chosen from a table belongs to the property that offered it, so it is
      // cleared. A free-text one (a Specialization name) belongs to the GROUP - it is the same
      // Specialization whether you are shifting it, giving it an Edge, or granting it - so
      // clearing it here would silently throw away what the author just typed.
      if (!this.group.dynamicTarget2) {
        this._target2 = null;
      }

      this._value = this.#defaultValueFor(this.property);
      break;
    case "target":
      this._target = value;
      break;
    case "target2":
      this._target2 = value;
      break;
    case "value":
      this._value = value;
      break;
    }

    this.render();
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  /**
   * Take a search result as the current selection, so searching and browsing end in the same
   * place rather than being two separate modes.
   * @this {EffectWizard}
   */
  static #onPickSearchResult(event, target) {
    this._groupId = target.dataset.groupId;
    this._propertyId = target.dataset.propertyId;
    this._target = target.dataset.target || null;
    this._target2 = null;
    this._value = this.#defaultValueFor(this.property);
    this._search = "";
    this.render();
  }

  /**
   * Bank the current selection and start a fresh one, for a multi-part effect.
   * @this {EffectWizard}
   */
  static #onAddPending() {
    const changes = this.#buildCurrentAll();
    if (!changes.length) {
      ui.notifications.warn(game.i18n.localize("E20.EffectWizardNothingToAdd"));
      return;
    }

    this._pending.push(...changes);
    this._value = this.#defaultValueFor(this.property);
    this.render();
  }

  /**
   * Drop a banked row.
   * @this {EffectWizard}
   */
  static #onRemovePending(event, target) {
    this._pending.splice(Number(target.dataset.index), 1);
    this.render();
  }

  /**
   * Write every banked row (plus whatever is still in the builder) onto the effect.
   * @this {EffectWizard}
   */
  static async #onFinish() {
    const changes = [...this._pending, ...this.#buildCurrentAll()];

    if (this._createData) {
      // Deferred creation: build the document complete, in one go. Creating it empty first and
      // updating it afterwards would fire two document operations and leave a do-nothing effect
      // on the sheet in between.
      const [created] = await this._owner.createEmbeddedDocuments("ActiveEffect", [
        foundry.utils.mergeObject(this._createData, { system: { changes } }, { inplace: false }),
      ]);
      this._effect = created;
    } else if (changes.length) {
      await appendChanges(this._effect, changes);
    }

    await this.close();

    if (this._openSheetWhenDone) {
      this._effect?.sheet.render(true);
    }
  }

  /**
   * Close without writing anything.
   *
   * For a wizard opened on a not-yet-created effect this leaves the sheet exactly as it was -
   * which is the point of deferring creation until "Add to Effect". For one opened on an existing
   * effect, that effect is simply left alone.
   * @this {EffectWizard}
   */
  static async #onCancel() {
    return this.close();
  }
}
