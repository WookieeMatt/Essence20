/**
 * Handle skill and specialization rolls.
 * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event
 * @param {Object} skillRollOptions   The result of getSkillRollOptions()
 * @param {Actor} actor   The actor performing the roll
 * @private
 */
 export function rollSkill(dataset, skillRollOptions, actor) {
  let roll = null;

  // Create roll label
  const rolledSkill = dataset.skill;
  const rolledSkillStr = dataset.specialization
    ? dataset.specialization
    : game.i18n.localize(CONFIG.E20.skills[rolledSkill]);
  const rollingForStr = game.i18n.localize(CONFIG.E20.rollingFor)
  let label = `${rollingForStr} ${rolledSkillStr}`;

  // Create roll formula
  const actorSkillData = actor.getRollData().skills;
  const rolledEssence = CONFIG.E20.skillToEssence[rolledSkill];
  const skillShift = actorSkillData[rolledEssence][rolledSkill].shift;

  // Apply the skill roll options dialog shifts to the roller's normal shift
  const optionsShiftTotal = skillRollOptions.shiftUp - skillRollOptions.shiftDown;
  const skillShiftIndex = CONFIG.E20.shiftList.findIndex(s => s == skillShift);
  const finalShiftIndex = Math.max(0, Math.min(CONFIG.E20.shiftList.length - 1, skillShiftIndex - optionsShiftTotal));
  const finalShift = CONFIG.E20.shiftList[finalShiftIndex];

  if (!_handleAutofail(finalShift, label, actor)) {
    const edge = skillRollOptions.edge;
    const snag = skillRollOptions.snag;
    const operands = [];
    operands.push(_getd20Operand(edge, snag));

    // We already have the d20 operand, now apply bonus dice if needed
    if (finalShift != 'd20') {
      if (dataset.specialization) {
        // For specializations, keep adding dice until you reach your shift level
        for (const shift of CONFIG.E20.rollableShifts) {
          operands.push(shift);
          if (shift == finalShift) {
            break;
          }
        }
      }
      else {
        // For non-specialized, just add the single bonus die
        operands.push(finalShift);
      }
    }

    // Include the skill modifier and generate final formula
    const modifier = actorSkillData[rolledEssence][rolledSkill].modifier;
    operands.push(modifier);
    const formula = _arrayToFormula(operands);

    let roll = new Roll(formula, actor.getRollData());
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: label + _getEdgeSnagText(edge, snag),
      rollMode: game.settings.get('core', 'rollMode'),
    });
  }
}

/**
 * Handle rolls that automatically fail.
 * @param {String} skillShift   The shift of the skill being rolled.
 * @param {String} label   The label generated so far for the roll, which will be appended to.
 * @param {Actor} actor   The actor performing the roll
 * @returns {Boolean}   True if autofail occurs and false otherwise.
 * @private
 */
 function _handleAutofail(skillShift, label, actor) {
  let autofailed = false;

  if (CONFIG.E20.automaticShifts.includes(skillShift)) {
    const chatData = {
      speaker: ChatMessage.getSpeaker({ actor }),
    };
    switch(skillShift) {
      case 'autoFail':
        label += ` ${game.i18n.localize(CONFIG.E20.autoFail)}`;
        break;
      case 'fumble':
        label += ` ${game.i18n.localize(CONFIG.E20.autoFailFumble)}`;
        break;
    }
    chatData.content = label;
    ChatMessage.create(chatData);
    autofailed = true;
  }

  return autofailed;
}

/**
 * Returns the d20 portion of skill roll formula.
 * @param {Boolean} edge   If the roll is using an Edge.
 * @param {Boolean} snag   If the roll is using a snag.
 * @returns {String}   The d20 portion of skill roll formula.
 * @private
 */
 function _getd20Operand(edge, snag) {
  // Edge and Snag cancel eachother out
  if (edge == snag) {
    return 'd20';
  }
  else {
    return edge ? '2d20kh' : '2d20kl';
  }
}

/**
 * Returns the d20 portion of skill roll formula.
 * @param {Boolean} edge   If the roll is using an Edge.
 * @param {Boolean} snag   If the roll is using a snag.
 * @returns {String}   The ' with an Edge/Snag' text of the roll label.
 * @private
 */
function _getEdgeSnagText(edge, snag) {
  let result = "";

  // Edge and Snag cancel eachother out
  if (edge != snag) {
    const withAnEdge = game.i18n.localize(CONFIG.E20.withAnEdge)
    const withASnag = game.i18n.localize(CONFIG.E20.withASnag)
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
function _arrayToFormula(operands) {
  let result = "";
  const len = operands.length;

  for (let i=0; i < len; i+=1) {
    const operand = operands[i];
    result += i == len - 1 ? operand : `${operand} +`;
  }

  return result;
}

/**
 * Displays the dialog used for skill and specialization rolls.
 */
export async function getSkillRollOptions() {
  const template = "systems/essence20/templates/dialog/roll-dialog.hbs"

  const html = await renderTemplate(template, {});

  return new Promise(resolve => {
    const data = {
      title: game.i18n.format("Configure your skill roll"),
      content: html,
      buttons: {
        normal: {
          label: "Roll",
          callback: html => resolve(_processSkillRollOptions(html[0].querySelector("form"))),
        },
        cancel: {
          label: "Cancel",
          callback: html => resolve({canceled: true}),
        },
      },
      default: "normal",
      close: () => resolve({cancelled: true}),
    }
    new Dialog(data, null).render(true);
  });
}

/**
 * Processes options for the skill and specialization roll dialog.
 * @returns {Object}   The processed roll options.
 * @private
 */
function _processSkillRollOptions(form) {
  return {
    shiftUp: parseInt(form.shiftUp.value),
    shiftDown: parseInt(form.shiftDown.value),
    snag: form.snag.checked,
    edge: form.edge.checked,
  }
}
