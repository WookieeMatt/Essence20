import { applyThemeClass } from "../settings.js";
import {
  computeEssenceSpend, getNewEssenceOverspend, getSkillAttributionStatus, getSkillEssences,
} from "../helpers/skill-picker.mjs";
import { addSpecialization, deleteSpecialization } from "../sheet-handlers/specialization-handler.mjs";
import { serializeFormSubmits } from "./serialize-form-submits.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// Display order for the 4 real Essences' tally boxes and fieldsets - a 2x2 grid, Strength/Speed
// on top and Smarts/Social below, rather than CONFIG.E20.originEssences' own key order
// (strength, speed, smarts, social).
const ESSENCE_GRID_ORDER = ["strength", "speed", "smarts", "social"];

// Must match the "Custom…" <option>'s own value in skill-picker-specializations.hbs exactly - a
// dedicated sentinel rather than "" (what it used to be) so "" is free to mean "the leading
// placeholder is still selected, nothing chosen yet" instead. Both used to share "", which meant
// the placeholder now added there couldn't be told apart from a deliberate Custom pick.
const CUSTOM_SPECIALIZATION_VALUE = "__custom__";

/**
 * Sets every skill's shift in one place, with a live per-Essence spend tally, and - for the two
 * "any"-Essence skills (Spellcasting, Weird) - lets their spend be split across more than one
 * real Essence via essenceAttribution. Shared by two rather different use cases:
 *  - NPC-like actors: also chooses which skills show on the actor sheet at all
 *    (system.skills.<skill>.isChosen, replacing the old automatic "does this deviate from
 *    default" display heuristic - see base-actor-sheet.mjs#_prepareChosenNpcSkills).
 *  - PCs: always show every skill already (essence-skills.hbs's inline shift-selects on
 *    pc-skills.hbs/the sidebar/the Spells tab become read-only once this app exists - see those
 *    templates' `readOnly` param), so this is purely where shifts + any-skill attribution get
 *    set; no isChosen checkbox.
 * Conditioning (a flat Strength value, not a system.skills entry) is editable here for every
 * actor type - pc-skills.hbs's own Conditioning field is a read-only display once this is the
 * one place it's edited, same as the skill shifts.
 *
 * Uses submitOnChange/no-close-on-submit (unlike most apps in this folder, which submit once on
 * close) so the essence-spend tally stays live as edits happen, without having to close and
 * reopen the window to see the effect.
 */
export default class SkillPicker extends serializeFormSubmits(HandlebarsApplicationMixin(ApplicationV2)) {
  /**
   * @param {Actor} actor The actor whose skills are being edited.
   */
  constructor(actor) {
    super({ id: `essence20-skill-picker-${actor.id}` });
    this._actor = actor;
    this._isPc = actor.type === 'playerCharacter';
  }

  static DEFAULT_OPTIONS = {
    actions: {
      addSpecialization: this.#onAddSpecialization,
      removeSpecialization: this.#onRemoveSpecialization,
    },
    classes: ["essence20", "sheet", "theme-wrapper", "skill-picker"],
    tag: "form",
    position: {
      width: 640,
      height: 640,
    },
    window: {
      resizable: true,
    },
    form: {
      handler: SkillPicker.#onSubmit,
      submitOnChange: true,
      closeOnSubmit: false,
    },
  };

  static PARTS = {
    form: {
      scrollable: [""],
      template: "systems/essence20/templates/app/skill-picker.hbs",
    },
  };

  get title() {
    return game.i18n.format("E20.SkillPickerTitle", { name: this._actor.name });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this._actor.system;

    context.config = CONFIG.E20;
    context.isPc = this._isPc;
    context.conditioning = system.conditioning;
    context.essenceSpend = computeEssenceSpend(this._actor);
    // Only PCs have a per-Essence spend budget to show/enforce at all (see
    // getEssenceOverspend's own doc comment) - undefined for every other actor type, which the
    // tally partial (skill-rank-allocation.hbs) takes as "don't show a max at all".
    context.essenceMax = this._isPc ? system.essences : undefined;

    // Not every actor type has every skill CONFIG.E20.skillsByEssence knows about - Zord/
    // Megaform's schema (zord-base.mjs), for one, has no `weird` entry at all. isMultiEssence
    // covers both a normal skill a Perk has extended to a second Essence at runtime (e.g. GI Joe
    // CRB's Terrifying Presence targeting system.skills.intimidation.essences.social - see
    // getSkillEssences) and (for the "any"-Essence skills below) the built-in case - either way
    // the Skill Picker needs the same essenceAttribution split UI, just conditionally here since
    // most regular skills never have a reason to show it.
    context.essenceGroups = ESSENCE_GRID_ORDER.map((essence) => ({
      essence,
      label: CONFIG.E20.essences[essence],
      skills: CONFIG.E20.skillsByEssence[essence]
        .filter((skill) => system.skills[skill])
        .map((skill) => {
          const fields = system.skills[skill];
          const isMultiEssence = getSkillEssences(fields).length > 1;
          return {
            key: skill,
            label: CONFIG.E20.skills[skill],
            fields,
            isMultiEssence,
            attribution: isMultiEssence ? getSkillAttributionStatus(fields) : null,
          };
        }),
    }));

    context.anySkills = CONFIG.E20.skillsByEssence.any
      .filter((skill) => system.skills[skill])
      .map((skill) => {
        const fields = system.skills[skill];
        return {
          key: skill,
          label: CONFIG.E20.skills[skill],
          fields,
          isMultiEssence: true,
          attribution: getSkillAttributionStatus(fields),
        };
      });

    // The Specialization dropdown's own catalog (templates/actor/parts/misc/
    // skill-picker-specializations.hbs) is per game line, since each sourcebook suggests its own
    // set for the same shared skill list - keyed off the actor's own Role, same lookup item-
    // sheet.mjs's _getVersionRoles already does for a Role's own version. Actor types with no
    // Role (Vehicle, Zord, ...) just get no standard suggestions - the dropdown still offers free
    // text either way. Whichever names the skill already has a Specialization for (case/
    // whitespace-insensitive, matching addSpecialization's own duplicate check) are filtered out
    // here so the dropdown can't offer picking the same one twice - the actual guard against a
    // duplicate lives in specialization-handler.mjs#addSpecialization, since it also needs to
    // catch the free-text input, but there's no reason to let the dropdown offer a pick that
    // would just be rejected.
    const role = this._actor.items.documentsByType.role[0];
    const standardSpecializationsForVersion = role
      ? CONFIG.E20.standardSpecializations[role.system.version] || {}
      : {};

    context.standardSpecializations = {};
    for (const [skill, names] of Object.entries(standardSpecializationsForVersion)) {
      const alreadyAddedNames = new Set(
        Object.values(system.skills[skill]?.specializations || {})
          .map((specialization) => specialization.name?.trim().toLowerCase()),
      );
      context.standardSpecializations[skill] = names.filter(
        (name) => !alreadyAddedNames.has(name.toLowerCase()),
      );
    }

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);

    applyThemeClass(this.element);

    // Not a DocumentSheet, so re-renders aren't automatic when something else (a specialization
    // item drop, a shift change made directly on the actor sheet) changes the actor this app is
    // showing - keep the live tally accurate without requiring the GM to close/reopen.
    if (!this._updateHook) {
      this._updateHook = Hooks.on("updateActor", (actor) => {
        if (actor.id === this._actor.id) {
          this.render();
        }
      });
    }

    // The free-text name only makes sense once "Custom..." (CUSTOM_SPECIALIZATION_VALUE) is
    // picked - hidden the rest of the time (including the initial, nothing-chosen-yet placeholder
    // state) so a standard-catalog skill defaults to a clean single dropdown instead of an
    // always-visible, usually-irrelevant text box.
    for (const select of this.element.querySelectorAll('.skill-picker-specialization-select')) {
      const customInput = select.parentElement.querySelector('.skill-picker-specialization-custom');
      customInput.hidden = select.value !== CUSTOM_SPECIALIZATION_VALUE;
      select.addEventListener('change', () => {
        customInput.hidden = select.value !== CUSTOM_SPECIALIZATION_VALUE;
        if (!customInput.hidden) {
          customInput.focus();
        }
      });
    }
  }

  _onClose(options) {
    super._onClose(options);

    if (this._updateHook) {
      Hooks.off("updateActor", this._updateHook);
      this._updateHook = null;
    }
  }

  static async #onSubmit(event, form, formData) {
    // FormDataExtended#object is already flat dotted-key data (e.g.
    // "system.skills.might.shift": "d20") - no expandObject/flattenObject round-trip needed to
    // read it below.
    const updateData = { ...formData.object };

    // PCs can't spend MORE skill points on one Essence than that Essence's own max score allows
    // (system.essences.<essence>.max) - checked against a throwaway in-memory preview of what
    // this submission would actually produce (Document#clone merges updateData into a NEW unsaved
    // instance, same dotted-key merge actor.update() itself would do) rather than the currently-
    // saved actor, since the whole point is to catch this BEFORE it's saved. getNewEssenceOverspend
    // (not the plain getEssenceOverspend the passive tally display uses) only blocks an Essence
    // this specific change actually pushes newly over its max - see that function's own doc
    // comment for why a PC already over budget for an unrelated, historical reason must still be
    // able to save everything else. NPC-like actors have no essence-spend budget to check at all,
    // so this never runs for them.
    if (this._isPc) {
      const previewActor = this._actor.clone(updateData);
      const overspend = getNewEssenceOverspend(this._actor, previewActor);
      for (const [essence, { spent, max }] of Object.entries(overspend)) {
        ui.notifications.warn(game.i18n.format('E20.SkillPickerEssenceMaxExceeded', {
          essence: game.i18n.localize(CONFIG.E20.essences[essence]),
          spent,
          max,
        }));
      }

      if (Object.keys(overspend).length) {
        // Nothing was saved - re-render from the actor's own still-unchanged data so the field
        // that triggered this (a shift <select>, the Conditioning number input, ...) visibly
        // snaps back instead of continuing to show the rejected value it was just changed to.
        this.render();
        return;
      }
    }

    // Every sourcebook requires at least a d2 Rank to hold a Specialization. This form's own
    // shift <select> is the only path back down to d20 (untrained) - hiding that skill's
    // Specializations here (see skill-picker-specializations.hbs) isn't enough on its own, since
    // it'd leave them as dead data the player can never see or remove again without upshifting
    // first; clear them in the same update as the shift change instead. Deleted key-by-key
    // (same as specialization-handler.mjs's own deleteSpecialization) rather than overwriting the
    // whole specializations object with {} - Document#update merges a plain object field's
    // changes into its existing value rather than replacing it, so {} as a "change" has no keys
    // to merge and is a silent no-op against data that's already there. A plain key (no "-="
    // prefix - that's the old, now-deprecated deletion syntax) paired with `new
    // foundry.data.operators.ForcedDeletion()` as the value is what actually deletes it, same as
    // item-sheet.mjs's own _onObjectDelete for system.items.
    for (const [path, value] of Object.entries(formData.object)) {
      const match = path.match(/^system\.skills\.(\w+)\.shift$/);
      if (match && value === 'd20') {
        const skill = match[1];
        const specializations = this._actor.system.skills[skill]?.specializations || {};
        for (const id of Object.keys(specializations)) {
          updateData[`system.skills.${skill}.specializations.${id}`] = new foundry.data.operators.ForcedDeletion();
        }
      }
    }

    await this._actor.update(updateData);
  }

  /**
   * Adds a Specialization to the skill the clicked "+" belongs to - the free-text input wins
   * over the standard-catalog dropdown when both are filled in, since typing a custom name is a
   * deliberate override of whatever the dropdown happened to be sitting on.
   */
  static async #onAddSpecialization(event, target) {
    const container = target.closest('.skill-picker-add-specialization');
    const skill = container.dataset.skill;
    const customInput = container.querySelector('.skill-picker-specialization-custom');
    const select = container.querySelector('.skill-picker-specialization-select');
    // Neither the sentinel itself nor the empty placeholder value is ever a real name -
    // addSpecialization already no-ops on an empty/blank name (e.g. the player clicked + with
    // nothing chosen and nothing typed), so this only needs to keep those two out of what's
    // passed to it rather than raise its own warning for the same case.
    const selectedName = select.value && select.value !== CUSTOM_SPECIALIZATION_VALUE ? select.value : '';
    const name = customInput.value.trim() || selectedName;

    // A Specialization always costs exactly 1 point (specialization-handler.mjs#addSpecialization
    // writes a flat, un-scaled entry), credited to the skill's own primary Essence - the same
    // essence computeEssenceSpend itself would credit it to (see that function's own "Always
    // credited to the skill's own primary Essence" comment), so this doesn't need
    // getEssenceOverspend's full actor-clone preview like #onSubmit does for shift changes.
    if (this._isPc && name) {
      const skillData = this._actor.system.skills[skill];
      const essence = getSkillEssences(skillData)[0] || CONFIG.E20.skillToEssence[skill];
      const max = this._actor.system.essences?.[essence]?.max;
      const spent = computeEssenceSpend(this._actor)[essence].value + 1;
      if (typeof max === 'number' && spent > max) {
        ui.notifications.warn(game.i18n.format('E20.SkillPickerEssenceMaxExceeded', {
          essence: game.i18n.localize(CONFIG.E20.essences[essence]),
          spent,
          max,
        }));
        return;
      }
    }

    await addSpecialization(this._actor, skill, name);
    // Belt-and-suspenders reset (this._updateHook's render already replaces this markup wholesale
    // once the update above resolves) - avoids a flash of stale values if that render is slow.
    // Index 0 is the "Choose a specialization" placeholder, not a real name - see
    // skill-picker-specializations.hbs's own comment on why leaving a real name showing here was
    // misleading (nothing stops it being silently re-added by clicking + again unchanged).
    customInput.value = '';
    select.selectedIndex = 0;
  }

  static async #onRemoveSpecialization(event, target) {
    await deleteSpecialization(this._actor, target.dataset.skill, target.dataset.specializationKey);
  }
}
