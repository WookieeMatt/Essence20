import { applyThemeClass } from "../settings.js";
import { computeEssenceSpend, getAnySkillAttributionStatus } from "../helpers/skill-picker.mjs";
import { serializeFormSubmits } from "./serialize-form-submits.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// Display order for the 4 real Essences' tally boxes and fieldsets - a 2x2 grid, Strength/Speed
// on top and Smarts/Social below, rather than CONFIG.E20.originEssences' own key order
// (strength, speed, smarts, social).
const ESSENCE_GRID_ORDER = ["strength", "speed", "smarts", "social"];

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

    // Not every actor type has every skill CONFIG.E20.skillsByEssence knows about - Zord/
    // Megaform's schema (zord-base.mjs), for one, has no `weird` entry at all.
    context.essenceGroups = ESSENCE_GRID_ORDER.map((essence) => ({
      essence,
      label: CONFIG.E20.essences[essence],
      skills: CONFIG.E20.skillsByEssence[essence]
        .filter((skill) => system.skills[skill])
        .map((skill) => ({
          key: skill,
          label: CONFIG.E20.skills[skill],
          fields: system.skills[skill],
        })),
    }));

    context.anySkills = CONFIG.E20.skillsByEssence.any
      .filter((skill) => system.skills[skill])
      .map((skill) => {
        const fields = system.skills[skill];
        return {
          key: skill,
          label: CONFIG.E20.skills[skill],
          fields,
          attribution: getAnySkillAttributionStatus(fields),
        };
      });

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
  }

  _onClose(options) {
    super._onClose(options);

    if (this._updateHook) {
      Hooks.off("updateActor", this._updateHook);
      this._updateHook = null;
    }
  }

  static async #onSubmit(event, form, formData) {
    await this._actor.update(formData.object);
  }
}
