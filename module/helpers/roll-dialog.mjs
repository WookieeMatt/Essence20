import { E20 } from "./config.mjs";
import RollOptionsDialog from "../apps/roll-options-dialog.mjs";

export class RollDialog {
  /**
   * RollDialog constructor.
   * @param {i18n} i18n   The i18n to use for text localization.
   */
  constructor(i18n=null) {
    this._i18n = i18n;
  }

  /**
   * Localizes the given text.
   * @param {String} text   The text to localize.
   * @param {Object} fmtVars   Optional formatting variables.
   * @returns {String}   The localized text.
   * @private
   */
  _localize(text, fmtVars=null) {
    if (fmtVars) {
      return this._i18n ? this._i18n.format(text, fmtVars) : game.i18n.format(text, fmtVars);
    } else {
      return this._i18n ? this._i18n.localize(text) : game.i18n.localize(text);
    }
  }

  /**
   * Displays the dialog used for skill and specialization rolls.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event.
   * @param {Actor} actor   The actor performing the roll.
   * @returns {Promise<Object>}   The processed roll options, or { cancelled: true }.
   */
  async getSkillRollOptions(dataset, skillDataset, actor) {
    const snag =
      skillDataset.snag ||
      E20.skillShiftList.indexOf('d20') == E20.skillShiftList.indexOf(skillDataset.shift);
    const edge = skillDataset.edge;
    const context = {
      canCritD2: dataset.canCritD2,
      shiftUp: dataset.shiftUp || 0,
      shiftDown: dataset.shiftDown || 0,
      isSpecialized: dataset.isSpecialized,
      snag: snag && !edge,
      edge: edge && !snag,
      normal: edge == snag,
      rolePoints: dataset.rolePoints,
      aimBonus: dataset.aimBonus,
      energonAvailable: dataset.energonAvailable,
      defenseType: dataset.defenseType || 'none',
      defenseTypes: { none: 'E20.None', ...E20.defenses },
    };
    const title = this._localize('E20.RollDialogTitle', {
      actor: actor.name, skill: E20.originSkills[dataset.skill], shift: E20.skillShifts[skillDataset.shift],
    });

    return new Promise(resolve => {
      new RollOptionsDialog(context, title, resolve).render(true);
    });
  }
}
