export class Dice {
  /**
   * Dice constructor.
   * @param {Object} config   The config to use for constants.
   * @param {ChatMessage} chatMessage   The ChatMessage to use.
   * @param {i18n} i18n   The i18n to use for text localization.
   */
  constructor(config, chatMessage, i18n=null) {
    this._i18n = i18n;
    this._config = config;
    this._chatMessage = chatMessage;
  }

  /**
   * Localizes the given text.
   * @param {String} text   The text to localize.
   * @returns {String}   The localized text.
   * @private
   */
  _localize(text) {
    return this._i18n ? this._i18n.localize(text) : game.i18n.localize(text);
  }

  /**
   * Displays the dialog used for skill and specialization rolls.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event.
   * @returns {Promise<Dialog>}   The dialog to be displayed.
   */
  async getSkillRollOptions(dataset) {
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
        title: this._localize('E20.RollDialogTitle'),
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
   * Handles rolling initiative.
   * @param {Actor} actor   The actor performing the roll.
   */
  async handleInitiativeRoll(actor) {
    const dataset = {
      shift: actor.system.initiative.shift,
      upshift: actor.system.initiative.shiftUp,
      downshift: actor.system.initiative.shiftDown,
    };

    const skillRollOptions = await this.getSkillRollOptions(dataset, this.actor);
    const finalShift = this._getFinalShift(
      skillRollOptions, actor.system.initiative.shift, this._config.initiativeShiftList)
    await actor.update({
      "system.initiative.formula": this._getFormula(
        skillRollOptions.isSpecialized, skillRollOptions, finalShift, actor.system.initiative.modifier),
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

  /**
   * Handle skill and specialization rolls.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event.
   * @param {Object} skillRollOptions   The result of getSkillRollOptions().
   * @param {Actor} actor   The actor performing the roll.
   * @param {Item} item   The item being used, if any.
   */
  rollSkill(dataset, skillRollOptions, actor, item) {
    const rolledSkill = dataset.skill;
    const actorSkillData = actor.getRollData().skills;
    const rolledEssence = dataset.essence || this._config.skillToEssence[rolledSkill];
    const initialShift = dataset.shift || actorSkillData[rolledEssence][rolledSkill].shift;
    const completeDataset = {
      ...dataset,
      // Weapon partial can't populate these easily
      essence : rolledEssence,
      shift: initialShift,
    }

    let label = '';

    switch(item?.type) {
      case 'weapon':
        label = this._getWeaponRollLabel(completeDataset, skillRollOptions, actor, item);
        break;
      case 'spell':
          label = this._getSpellRollLabel(skillRollOptions, item);
          break;
      case 'magicBauble':
        label = this._getMagicBaubleRollLabel(skillRollOptions, item);
        break;
      default:
        label = this._getSkillRollLabel(completeDataset, skillRollOptions);
    }

    let finalShift = this._getFinalShift(skillRollOptions, initialShift);

    if (this._handleAutoFail(finalShift, label, actor)) {
      return;
    }

    // Auto success rules let the player choose to roll, which uses the best dice pool
    if (this._config.autoSuccessShifts.includes(finalShift)) {
      finalShift = this._config.skillRollableShifts[this._config.skillRollableShifts.length - 1];
    }

    const isSpecialized = dataset.isSpecialized === 'true' || skillRollOptions.isSpecialized;
    const modifier = actorSkillData[rolledEssence][rolledSkill].modifier || 0;
    const formula = this._getFormula(isSpecialized, skillRollOptions, finalShift, modifier);

    // Repeat the roll as many times as specified in the skill roll options dialog
    for (let i = 0; i < skillRollOptions.timesToRoll; i++) {
      let repeatText = '';
      if (skillRollOptions.timesToRoll > 1) {
        repeatText = this._i18n.format("E20.RollRepeatText", {
          index: i + 1,
          total: skillRollOptions.timesToRoll,
        }) + '<br>';
      }

      this._rollSkillHelper(formula, actor, repeatText + label);
    }
  }

  /**
   * Executes the skill roll.
   * @param {String} formula   The formula to be rolled.
   * @param {Actor} actor   The actor performing the roll.
   * @param {String} flavor   The html to use for the roll message.
   * @private
   */
  _rollSkillHelper(formula, actor, flavor) {
    let roll = new Roll(formula, actor.getRollData());
    roll.toMessage({
      speaker: this._chatMessage.getSpeaker({ actor }),
      flavor,
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
    const rolledSkillStr = dataset.isSpecialized === 'true'
      ? dataset.specializationName
      : this._localize(this._config.essenceSkills[rolledSkill]);
    const rollingForStr = this._localize('E20.RollRollingFor')
    return `${rollingForStr} ${rolledSkillStr}` + this._getEdgeSnagText(skillRollOptions.edge, skillRollOptions.snag);
  }

  /**
   * Handles rolling items that require skill rolls.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event.
   * @param {Item} item   The weapon being used.
   * @param {Actor} actor   The actor performing the roll.
   */
  async handleSkillItemRoll(dataset, actor, item) {
      const skillRollOptions = await this.getSkillRollOptions(dataset);

      if (skillRollOptions.cancelled) {
        return;
      }

      this.rollSkill(dataset, skillRollOptions, actor, item);
  }

  /**
   * Create weapon roll label.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event.
   * @param {Object} skillRollOptions   The result of getSkillRollOptions().
   * @param {Actor} actor   The actor performing the roll.
   * @param {Item} weapon   The weapon being used.
   * @returns {String}   The resultant roll label.
   * @private
   */
  _getWeaponRollLabel(dataset, skillRollOptions, actor, weapon) {
    const rolledSkill = dataset.skill;
    const rolledSkillStr = this._localize(this._config.essenceSkills[rolledSkill]);
    const attackRollStr = this._localize('E20.RollTypeAttack');
    const effectStr = this._localize('E20.WeaponEffect');
    const alternateEffectsStr = this._localize('E20.WeaponAlternateEffects');
    const classFeatureStr = this._localize('ITEM.TypeClassfeature');
    const noneStr = this._localize('E20.None');
    const classFeatureId = weapon.system.classFeatureId;

    let label = `<b>${attackRollStr}</b> - ${weapon.name} (${rolledSkillStr})`
    label += `${this._getEdgeSnagText(skillRollOptions.edge, skillRollOptions.snag)}<br>`;
    label += `<b>${effectStr}</b> - ${weapon.system.effect || noneStr}<br>`;
    label += `<b>${alternateEffectsStr}</b> - ${weapon.system.alternateEffects || noneStr}<br>`;
    label += `<b>${classFeatureStr}</b> - ${classFeatureId ? actor.items.get(classFeatureId).name : noneStr}`;

    return label;
  }

  /**
   * Create spell roll label.
   * @param {Object} skillRollOptions   The result of getSkillRollOptions().
   * @param {Item} spell   The spell being used.
   * @returns {String}   The resultant roll label.
   * @private
   */
  _getSpellRollLabel(skillRollOptions, spell) {
    const rolledSkillStr = this._localize('E20.EssenceSkillSpellcasting');
    const spellRollStr = this._localize('E20.RollTypeSpell');
    const descStr = this._localize('E20.ItemDescription');
    const noneStr = this._localize('E20.None');

    let label = `<b>${spellRollStr}</b> - ${spell.name} (${rolledSkillStr})`
    label += `${this._getEdgeSnagText(skillRollOptions.edge, skillRollOptions.snag)}<br>`;
    label += `<b>${descStr}</b> - ${spell.system.description || noneStr}<br>`;

    return label;
  }

  _getMagicBaubleRollLabel(skillRollOptions, magicBauble) {
    const rolledSkillStr = this._localize('E20.EssenceSkillSpellcasting');
    const magicBaubleRollStr = this._localize('E20.RollTypeMagicBauble');
    const descStr = this._localize('E20.ItemDescription');
    const noneStr = this._localize('E20.None');

    let label = `<b>${magicBaubleRollStr}</b> - ${magicBauble.name} (${rolledSkillStr})`
    label += `${this._getEdgeSnagText(skillRollOptions.edge, skillRollOptions.snag)}<br>`;
    label += `<b>${descStr}</b> - ${magicBauble.system.description || noneStr}<br>`;

    return label;
  }

  /**
   * Create final shift from actor skill shift + skill roll options.
   * @param {Object} skillRollOptions   The result of getSkillRollOptions().
   * @param {String} initialShift   The initial shift of the skill being rolled.
   * @param {Object} shiftList   The list of available shifts to use for this roll.
   * @returns {String}   The resultant shift.
   * @private
   */
  _getFinalShift(skillRollOptions, initialShift, shiftList=this._config.skillShiftList) {
    // Apply the skill roll options dialog shifts to the roller's normal shift
    const optionsShiftTotal = skillRollOptions.shiftUp - skillRollOptions.shiftDown;
    const initialShiftIndex = shiftList.findIndex(s => s == initialShift);
    const finalShiftIndex = Math.max(
      0,
      Math.min(shiftList.length - 1, initialShiftIndex - optionsShiftTotal)
    );

    return shiftList[finalShiftIndex];
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
          label += ` ${this._localize('E20.RollAutoFail')}`;
          break;
        case 'fumble':
          label += ` ${this._localize('E20.RollAutoFailFumble')}`;
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
      const withAnEdge = this._localize('E20.RollWithAnEdge')
      const withASnag = this._localize('E20.RollWithASnag')
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
        for (const shift of this._config.skillRollableShifts) {
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
