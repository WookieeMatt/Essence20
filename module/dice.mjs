export class Dice {
  /**
   * Dice constructor.
   * @param {i18n} i18n   The i18n to use for text localization.
   * @param {Object} config   The config to use for constants.
   * @param {ChatMessage} chatMessage   The ChatMessage to use.
   */
  constructor(i18n, config, chatMessage) {
    this._i18n = i18n;
    this._config = config;
    this._chatMessage = chatMessage;
  }

  /**
   * Displays the dialog used for skill and specialization rolls.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event.
   * @param {Actor} actor   The actor performing the roll.
   * @returns {Promise<Dialog>}   The dialog to be displayed.
   */
  async getSkillRollOptions(dataset, actor) {
    const template = "systems/essence20/templates/dialog/roll-dialog.hbs"
    const rolledSkill = dataset.skill;
    const rolledEssence = this._config.skillToEssence[rolledSkill];
    const rolledShift = actor.system.skills[rolledEssence][rolledSkill].shift
    const snag = this._config.shiftList.indexOf('d20') == this._config.shiftList.indexOf(rolledShift);
    const html = await renderTemplate(
      template,
      {
        specialized: !!dataset.specialization,
        snag,
        edge: false,
        normal: !snag
      }
    );

    return new Promise(resolve => {
      const data = {
        title: this._i18n.localize('E20.rollDialogTitle'),
        content: html,
        buttons: {
          normal: {
            label: this._i18n.localize('E20.rollDialogRollButton'),
            callback: html => resolve(this._processSkillRollOptions(html[0].querySelector("form"))),
          },
          cancel: {
            label: this._i18n.localize('E20.rollDialogCancelButton'),
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
      shiftUp: parseInt(form.shiftUp.value),
      shiftDown: parseInt(form.shiftDown.value),
      snag: form.snagEdge.value == 'snag',
      edge: form.snagEdge.value == 'edge',
      specialized: form.specialized.checked,
    }
  }

  /**
   * Handle skill and specialization rolls.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event.
   * @param {Object} skillRollOptions   The result of getSkillRollOptions().
   * @param {Actor} actor   The actor performing the roll.
   * @param {Item} weapon   The weapon being used, if any.
   */
  rollSkill(dataset, skillRollOptions, actor, weapon) {
    let label = weapon
      ? this._getWeaponRollLabel(dataset, skillRollOptions, weapon)
      : this._getSkillRollLabel(dataset, skillRollOptions);
    const rolledSkill = dataset.skill;
    const rolledEssence = this._config.skillToEssence[rolledSkill];
    const actorSkillData = actor.getRollData().skills;
    const initialShift = actorSkillData[rolledEssence][rolledSkill].shift;
    let finalShift = this._getFinalShift(skillRollOptions, initialShift);

    if (this._handleAutoFail(finalShift, label, actor)) {
      return;
    }

    if (this._config.autoSuccessShifts.includes(finalShift)) {
      finalShift = this._config.rollableShifts[this._config.rollableShifts.length - 1];
    }

    const modifier = actorSkillData[rolledEssence][rolledSkill].modifier;
    const formula = this._getFormula(
      !!dataset.specialization || skillRollOptions.specialized, skillRollOptions, finalShift, modifier);

    let roll = new Roll(formula, actor.getRollData());
    roll.toMessage({
      speaker: this._chatMessage.getSpeaker({ actor }),
      flavor: label,
      rollMode: game.settings.get('core', 'rollMode'),
    });
  }

  /**
   * Create skill roll label.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event.
   * @param {Object} skillRollOptions   The result of getSkillRollOptions().
   * @returns {String}   The resultant roll label.
   * @private
   */
  _getSkillRollLabel(dataset, skillRollOptions) {
    const rolledSkill = dataset.skill;
    const rolledSkillStr = dataset.specialization
      ? dataset.specialization
      : this._i18n.localize(this._config.essenceSkills[rolledSkill]);
    const rollingForStr = this._i18n.localize('E20.rollRollingFor')
    return `${rollingForStr} ${rolledSkillStr}` + this._getEdgeSnagText(skillRollOptions.edge, skillRollOptions.snag);
  }

  /**
   * Create weapon roll label.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event.
   * @param {Object} skillRollOptions   The result of getSkillRollOptions().
   * @returns {String}   The resultant roll label.
   * @param {Item} weapon   The weapon being used.
   * @private
   */
  _getWeaponRollLabel(dataset, skillRollOptions, weapon) {
    const rolledSkill = dataset.skill;
    const rolledSkillStr = this._i18n.localize(this._config.essenceSkills[rolledSkill]);
    const attackRollStr = this._i18n.localize('E20.rollAttackRoll')
    const effectStr = this._i18n.localize('E20.weaponEffect')
    const alternateEffectsStr = this._i18n.localize('E20.weaponAlternateEffects')
    const noneStr = this._i18n.localize('E20.none')

    let label = `<b>${attackRollStr}</b> - ${weapon.name} (${rolledSkillStr})`
    label += `${this._getEdgeSnagText(skillRollOptions.edge, skillRollOptions.snag)}<br>`;
    label += `<b>${effectStr}</b> - ${weapon.system.effect || noneStr}<br>`;
    label += `<b>${alternateEffectsStr}</b> - ${weapon.system.alternateEffects || noneStr}`;

    return label;
  }

  /**
   * Create final shift from actor skill shift + skill roll options.
   * @param {Object} skillRollOptions   The result of getSkillRollOptions().
   * @param {String} initialShift   The initial shift of the skill being rolled.
   * @returns {String}   The resultant shift.
   * @private
   */
  _getFinalShift(skillRollOptions, initialShift) {
    // Apply the skill roll options dialog shifts to the roller's normal shift
    const optionsShiftTotal = skillRollOptions.shiftUp - skillRollOptions.shiftDown;
    const initialShiftIndex = this._config.shiftList.findIndex(s => s == initialShift);
    const finalShiftIndex = Math.max(0, Math.min(this._config.shiftList.length - 1, initialShiftIndex - optionsShiftTotal));

    return this._config.shiftList[finalShiftIndex];
  }

  /**
   * Handle rolls that automatically fail.
   * @param {String} skillShift   The shift of the skill being rolled.
   * @param {String} label   The label generated so far for the roll, which will be appended to.
   * @param {Actor} actor   The actor performing the roll.
   * @returns {Boolean}   True if autofail occurs and false otherwise.
   * @private
   */
  _handleAutoFail(skillShift, label, actor) {
    let autoFailed = false;

    if (this._config.autoFailShifts.includes(skillShift)) {
      const chatData = {
        speaker: this._chatMessage.getSpeaker({ actor }),
      };
      switch (skillShift) {
        case 'autoFail':
          label += ` ${this._i18n.localize('E20.rollAutoFail')}`;
          break;
        case 'fumble':
          label += ` ${this._i18n.localize('E20.rollAutoFailFumble')}`;
          break;
      }
      chatData.content = label;
      this._chatMessage.create(chatData);
      autoFailed = true;
    }

    return autoFailed;
  }

  /**
   * Returns the d20 portion of skill roll formula.
   * @param {Boolean} edge   If the roll is using an Edge.
   * @param {Boolean} snag   If the roll is using a Snag.
   * @returns {String}   The d20 portion of skill roll formula.
   * @private
   */
  _getd20Operand(edge, snag) {
    // Edge and Snag cancel eachother out
    if (edge == snag) {
      return 'd20';
    }
    else {
      return edge ? '2d20kh' : '2d20kl';
    }
  }

  /**
   * Creates the Edge/Snag text of the skill roll label.
   * @param {Boolean} edge   If the roll is using an Edge.
   * @param {Boolean} snag   If the roll is using a Snag.
   * @returns {String}   The ' with an Edge/Snag' text of the roll label.
   * @private
   */
  _getEdgeSnagText(edge, snag) {
    let result = '';

    // Edge and Snag cancel eachother out
    if (edge != snag) {
      const withAnEdge = this._i18n.localize('E20.rollWithAnEdge')
      const withASnag = this._i18n.localize('E20.rollWithASnag')
      result = edge ? ` ${withAnEdge}` : ` ${withASnag}`;
    }

    return result;
  }

  /**
   * Converts given operands into a formula.
   * @param {Array<String>} edge   The operands to be used in the formula.
   * @returns {String}   The resultant formula.
   * @private
   */
  _arrayToFormula(operands) {
    let result = '';
    const len = operands.length;

    for (let i = 0; i < len; i += 1) {
      const operand = operands[i];
      result += i == len - 1 ? operand : `${operand},`;
    }

    return result;
  }

  /**
   * Create formula for skill roll.
   * @param {Boolean} dataset   Whether the roll is specialized.
   * @param {Object} skillRollOptions   The result of getSkillRollOptions().
   * @param {String} finalShift   The shift to be used for the skill roll.
   * @param {Number} modifier   The modifier to be used for the skill roll.
   * @returns {String}   The resultant shift.
   * @private
   */
  _getFormula(isSpecialized, skillRollOptions, finalShift, modifier) {
    const edge = skillRollOptions.edge;
    const snag = skillRollOptions.snag;
    const shiftOperands = [];
    let formula = this._getd20Operand(edge, snag);

    // We already have the d20 operand, now apply bonus dice if needed
    if (finalShift != 'd20') {
      if (isSpecialized) {
        // For specializations, keep adding dice until you reach your shift level
        for (const shift of this._config.rollableShifts) {
          shiftOperands.push(shift);
          if (shift == finalShift) {
            break;
          }
        }
        formula += ` + {${this._arrayToFormula(shiftOperands)}}kh`;
      }
      else {
        // For non-specialized, just add the single bonus die
        formula += ` + ${finalShift}`;
      }
    }

    return `${formula} + ${modifier}`;
  }
}
