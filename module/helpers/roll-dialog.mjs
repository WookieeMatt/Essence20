import { E20 } from "./config.mjs";

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
   * @returns {Promise<Dialog>}   The dialog to be displayed.
   */
  async getSkillRollOptions(dataset, skillDataset, actor) {
    const template = "systems/essence20/templates/dialog/roll-dialog.hbs";
    const snag =
      skillDataset.snag ||
      E20.skillShiftList.indexOf('d20') == E20.skillShiftList.indexOf(dataset.shift);
    const edge = skillDataset.edge;
    const html = await renderTemplate(
      template,
      {
        shiftUp: dataset.shiftUp || 0,
        shiftDown: dataset.shiftDown || 0,
        isSpecialized: dataset.isSpecialized,
        snag: snag && !edge,
        edge: edge && !snag,
        normal: edge == snag,
        rolePoints: dataset.rolePoints,
      },
    );

    return new Promise(resolve => {
      const data = {
        title: this._localize('E20.RollDialogTitle', {actor: actor.name}),
        content: html,
        buttons: {
          normal: {
            label: this._localize('E20.RollDialogRollButton'),
            callback: html => resolve(this._processSkillRollOptions(html[0].querySelector("form"))),
          },
          cancel: {
            label: this._localize('E20.RollDialogCancelButton'),
            /* eslint-disable no-unused-vars */
            callback: html => resolve({ cancelled: true }),
          },
        },
        default: "normal",
        close: () => resolve({ cancelled: true }),
      };

      new Dialog(data, null).render(true);
    });
  }

  /**
   * Processes options for the skill and specialization roll dialog.
   * @returns {Object}   The processed roll options.
   * @private
   */
  _processSkillRollOptions(form) {
    return {
      edge: form.snagEdge.value == 'edge',
      shiftDown: parseInt(form.shiftDown.value),
      shiftUp: parseInt(form.shiftUp.value),
      snag: form.snagEdge.value == 'snag',
      isSpecialized: form.isSpecialized.checked,
      timesToRoll: parseInt(form.timesToRoll.value),
      applyRolePointsUpshift: form?.applyRolePointsUpshift?.checked,
    };
  }
}
