import { E20 } from "./helpers/config.mjs";
import { getItemsOfType } from "./helpers/utils.mjs";

export class Dice {
  /**
   * Dice constructor.
   * @param {ChatMessage} chatMessage   The ChatMessage to use.
   * @param {RollDialog} rollDialog   The RollDialog to use.
   * @param {i18n} i18n   The i18n to use for text localization.
   */
  constructor(chatMessage, rollDialog, i18n=null) {
    this._chatMessage = chatMessage;
    this._rollDialog = rollDialog;
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
   * Prepares the given actor for rolling initiative.
   * @param {Actor} actor   The actor performing the roll.
   */
  async prepareInitiativeRoll(actor) {
    const dataset = {
      shift: actor.system.initiative.shift,
      shiftUp: actor.system.initiative.shiftUp + actor.system.essenceShifts.speed.shiftUp,
      shiftDown: actor.system.initiative.shiftDown + actor.system.essenceShifts.speed.shiftDown,
    };
    const skillDataset = {
      edge: actor.system.initiative.edge,
      snag: actor.system.initiative.snag,
    };
    const skillRollOptions = await this._rollDialog.getSkillRollOptions(dataset, skillDataset, actor);

    if (skillRollOptions.cancelled) {
      return false;
    }

    const finalShift = this._getFinalShift(
      skillRollOptions, actor.system.initiative.shift, E20.initiativeShiftList);
    await actor.update({
      "system.initiative.formula": this._getFormula(
        skillRollOptions.isSpecialized, skillRollOptions, finalShift, actor.system.initiative.modifier),
    });

    return true;
  }

  /**
   * Handle skill and specialization rolls.
   * @param {Event.currentTarget.element.dataset} rawDataset   The dataset of the click event.
   * @param {Actor} actor   The actor performing the roll.
   * @param {Item} item   The item being used, if any.
   */
  async rollSkill(rawDataset, actor, item) {
    const dataset = { // Converting strings to usable types
      ...rawDataset,
      shiftDown: parseInt(rawDataset.shiftDown),
      shiftUp: parseInt(rawDataset.shiftUp),
      isSpecialized: rawDataset.isSpecialized && rawDataset.isSpecialized != 'false',
    };
    const rolledSkill = dataset.skill;
    const rolledEssence = dataset.essence || E20.skillToEssence[rolledSkill];
    const essenceShifts = actor.system.essenceShifts;
    let calculatedShiftUp = 0;
    let calculatedShiftDown = 0;
    if (rolledEssence) {
      calculatedShiftUp = dataset.shiftUp + essenceShifts[rolledEssence].shiftUp + essenceShifts.any.shiftUp;
      calculatedShiftDown = dataset.shiftDown + essenceShifts[rolledEssence].shiftDown + essenceShifts.any.shiftDown;
    } else {
      calculatedShiftUp = dataset.shiftUp + essenceShifts.any.shiftUp;
      calculatedShiftDown = dataset.shiftDown + essenceShifts.any.shiftDown;
    }

    const updatedShiftDataset = {
      ...dataset,
      shiftUp: calculatedShiftUp,
      shiftDown: calculatedShiftDown,
    };
    const actorSkillData = actor.getRollData().skills[rolledSkill];
    let calculatedEdge = false;
    let calculatedSnag = false;

    if (actorSkillData.edge || essenceShifts[rolledEssence].edge) {
      calculatedEdge = true;
    }

    if (actorSkillData.snag || essenceShifts[rolledEssence].snag) {
      calculatedSnag = true;
    }

    const skillDataset = {
      edge: calculatedEdge,
      snag: calculatedSnag,
    };

    updatedShiftDataset.rolePoints = null;
    const rolePointsList = getItemsOfType('rolePoints', actor.items);

    let rolePoints = null;
    if (item?.type == 'weaponEffect' && rolePointsList.length) {
      rolePoints = rolePointsList[0]; // There should only be one RolePoints
      if (rolePoints.system.bonus.type == 'attackUpshift' && (rolePoints.system.isActive || !rolePoints.system.isActivatable)) {
        updatedShiftDataset.rolePoints = rolePoints;
      }
    }

    const skillRollOptions = await this._rollDialog.getSkillRollOptions(updatedShiftDataset, skillDataset, actor);

    if (skillRollOptions.cancelled) {
      return;
    }

    const initialShift = dataset.shift || actorSkillData.shift;
    let label = '';
    let roleSkillDieName = '';

    switch(item?.type) {
    case 'weaponEffect':
      {
        const roleList = getItemsOfType('role', actor.items);
        roleSkillDieName = roleList.length ? roleList[0].system.skillDie.name : null;
      }

      label = this._getWeaponRollLabel(dataset, skillRollOptions, item, roleSkillDieName);
      break;
    case 'spell':
      label = this._getSpellRollLabel(skillRollOptions, item);
      break;
    case 'magicBauble':
      label = this._getMagicBaubleRollLabel(skillRollOptions, item);
      break;
    default:
      label = this._getSkillRollLabel(dataset, skillRollOptions);
    }

    let finalShift = this._getFinalShift(skillRollOptions, initialShift, E20.skillShiftList, rolePoints);

    if (this._handleAutoFail(finalShift, label, actor)) {
      return;
    }

    // Auto success rules let the player choose to roll, which uses the best dice pool
    if (E20.autoSuccessShifts.includes(finalShift)) {
      finalShift = E20.skillRollableShifts[E20.skillRollableShifts.length - 1];
    }

    const isSpecialized = dataset.isSpecialized || skillRollOptions.isSpecialized;
    const modifier = actorSkillData.modifier || 0;
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
    let rolledSkillStr;
    if (dataset.skill == 'roleSkillDie') {
      rolledSkillStr = dataset.roleSkillName;
    } else if (dataset.isSpecialized) {
      rolledSkillStr = dataset.specializationName;
    } else {
      const rolledSkill = dataset.skill;
      rolledSkillStr = this._localize(E20.skills[rolledSkill]);
    }

    const rollingForStr = this._localize('E20.RollRollingFor');
    return `${rollingForStr} ${rolledSkillStr}` + this._getEdgeSnagText(skillRollOptions.edge, skillRollOptions.snag);
  }

  /**
   * Handles rolling items that require skill rolls.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event.
   * @param {Item} item   The weapon being used.
   * @param {Actor} actor   The actor performing the roll.
   */
  async handleSkillItemRoll(dataset, actor, item) {
    this.rollSkill(dataset, actor, item);
  }

  /**
   * Create weapon roll label.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event.
   * @param {Object} skillRollOptions   The result of getSkillRollOptions().
   * @param {Item} weaponEffect   The weapon effect being used.
   * @param {String} roleSkillDieName The name of the Role skill die
   * @returns {String}   The resultant roll label.
   * @private
   */
  _getWeaponRollLabel(dataset, skillRollOptions, weaponEffect, roleSkillDieName=null) {
    const rolledSkill = dataset.skill;
    const rolledSkillStr = this._localize(E20.skills[rolledSkill]) || roleSkillDieName;
    const attackRollStr = this._localize('E20.RollTypeAttack');
    const effectStr = this._localize('E20.WeaponEffect');
    const damageType = this._localize(E20.damageTypes[weaponEffect.system.damageType]);
    const noneStr = "";

    let label = `<b>${attackRollStr}</b> - ${weaponEffect.name} (${rolledSkillStr})`;
    label += `${this._getEdgeSnagText(skillRollOptions.edge, skillRollOptions.snag)}<br>`;
    label += `<b>${effectStr}</b> - ${weaponEffect.system.damageValue || noneStr} ${damageType}<br>`;

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
    const rolledSkillStr = this._localize('E20.SkillSpellcasting');
    const spellRollStr = this._localize('E20.RollTypeSpell');
    const descStr = this._localize('E20.ItemDescription');
    const noneStr = this._localize('E20.None');

    let label = `<b>${spellRollStr}</b> - ${spell.name} (${rolledSkillStr})`;
    label += `${this._getEdgeSnagText(skillRollOptions.edge, skillRollOptions.snag)}<br>`;
    label += `<b>${descStr}</b> - ${spell.system.description || noneStr}<br>`;

    return label;
  }

  _getMagicBaubleRollLabel(skillRollOptions, magicBauble) {
    const rolledSkillStr = this._localize('E20.SkillSpellcasting');
    const magicBaubleRollStr = this._localize('E20.RollTypeMagicBauble');
    const descStr = this._localize('E20.ItemDescription');
    const noneStr = this._localize('E20.None');

    let label = `<b>${magicBaubleRollStr}</b> - ${magicBauble.name} (${rolledSkillStr})`;
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
  _getFinalShift(skillRollOptions, initialShift, shiftList=E20.skillShiftList, rolePoints=null) {
    // Apply the skill roll options dialog shifts to the roller's normal shift
    let optionsShiftTotal = skillRollOptions.shiftUp - skillRollOptions.shiftDown;
    optionsShiftTotal += rolePoints && skillRollOptions.applyRolePointsUpshift ? rolePoints.system.bonus.value : 0;

    const initialShiftIndex = shiftList.findIndex(s => s == initialShift);
    const finalShiftIndex = Math.max(
      0,
      Math.min(shiftList.length - 1, initialShiftIndex - optionsShiftTotal),
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

    if (E20.autoFailShifts.includes(skillShift)) {
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
    } else {
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
      const withAnEdge = this._localize('E20.RollWithAnEdge');
      const withASnag = this._localize('E20.RollWithASnag');
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
        for (const shift of E20.skillRollableShifts) {
          shiftOperands.push(shift);
          if (shift == finalShift) {
            break;
          }
        }

        formula += ` + {${this._arrayToFormula(shiftOperands)}}kh`;
      } else {
        // For non-specialized, just add the single bonus die
        formula += ` + ${finalShift}`;
      }
    }

    return `${formula} + ${modifier}`;
  }
}
