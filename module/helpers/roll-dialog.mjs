export class RollDialog {
  /**
   * RollDialog constructor.
   * @param {i18n} i18n   The i18n to use for text localization.
   * @param {Object} config   The config to use for constants.
   */
  constructor(config, i18n=null) {
    this._config = config;
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
  async getSkillRollOptions(dataset, actor) {
    const template = "systems/essence20/templates/dialog/roll-dialog.hbs"
    const snag = this._config.skillShiftList.indexOf('d20') == this._config.skillShiftList.indexOf(dataset.shift);
    const html = await renderTemplate(
      template,
      {
        shiftUp: dataset.upshift || 0,
        shiftDown: dataset.downshift || 0,
        isSpecialized: dataset.isSpecialized === 'true',
        snag,
        edge: false,
        normal: !snag
      }
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
    }
  }
}
