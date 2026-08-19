import { E20 } from "./helpers/config.mjs";
import { buildCheckChatData, computeMultiplier, getDefenseValue } from "./helpers/combat.mjs";

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
    const initSkill = actor.system.initiative.skill;
    const dataset = {
      shift: actor.system.skills[initSkill].shift,
      shiftUp: actor.system.skills[initSkill].shiftUp + actor.system.essenceShifts.speed.shiftUp,
      shiftDown: actor.system.skills[initSkill].shiftDown + actor.system.essenceShifts.speed.shiftDown,
      skill: initSkill,
    };
    const skillDataset = {
      edge: actor.system.skills[initSkill].edge,
      shift: actor.system.skills[initSkill].shift,
      snag: actor.system.skills[initSkill].snag,
    };
    const skillRollOptions = await this._rollDialog.getSkillRollOptions(dataset, skillDataset, actor);

    if (skillRollOptions.cancelled) {
      return false;
    }


    const finalShift = this._getFinalShift(
      skillRollOptions, actor.system.skills[initSkill].shift, E20.initiativeShiftList);
    await actor.update({
      "system.initiative.formula": this._getFormula(
        skillRollOptions.isSpecialized, skillRollOptions, finalShift, actor.system.skills[initSkill].modifier),
    });

    return true;
  }

  /**
   * Handle skill and specialization rolls.
   * @param {Event.currentTarget.element.dataset} rawDataset   The dataset of the click event.
   * @param {Actor} actor   The actor performing the roll.
   * @param {Item} item   The item being used, if any.
   */
  async rollSkill(rawDataset, actor, item=null) {
    const dataset = { // Converting strings to usable types
      ...rawDataset,
      shiftDown: parseInt(rawDataset.shiftDown),
      shiftUp: parseInt(rawDataset.shiftUp),
      isSpecialized: rawDataset.isSpecialized
        && rawDataset.isSpecialized != 'false'
        || !!item?.system?.isSpecialized,
      canCritD2: rawDataset.canCritD2 && rawDataset.canCritD2 != 'false',
    };
    const rolledSkill = dataset.skill;
    const rolledEssence = dataset.essence || E20.skillToEssence[rolledSkill];
    const essenceShifts = actor.system.essenceShifts;
    const combatModifiers = this._getAutomaticCombatModifiers(actor, item);
    let calculatedShiftUp = 0;
    let calculatedShiftDown = 0;
    if (rolledEssence) {
      calculatedShiftUp = dataset.shiftUp + essenceShifts[rolledEssence].shiftUp + essenceShifts.any.shiftUp;
      calculatedShiftDown = dataset.shiftDown + essenceShifts[rolledEssence].shiftDown + essenceShifts.any.shiftDown;
    } else {
      calculatedShiftUp = dataset.shiftUp + essenceShifts.any.shiftUp;
      calculatedShiftDown = dataset.shiftDown + essenceShifts.any.shiftDown;
    }

    calculatedShiftUp += combatModifiers.shiftUp;
    calculatedShiftDown += combatModifiers.shiftDown;

    const updatedShiftDataset = {
      ...dataset,
      shiftUp: calculatedShiftUp,
      shiftDown: calculatedShiftDown,
    };
    const actorSkillData = actor.getRollData().skills[rolledSkill];
    const initialShift = essenceShifts[rolledEssence]?.untrainedBonus && dataset.shift == "d20"
      ? "d2"
      : dataset.shift || actorSkillData.shift;
    const skillDataset = {
      shift: initialShift,
      edge: actorSkillData.edge || !!essenceShifts[rolledEssence]?.edge || combatModifiers.edge,
      snag: actorSkillData.snag || !!essenceShifts[rolledEssence]?.snag || combatModifiers.snag,
    };

    // Pre-select the Roll Options Dialog's Defense dropdown from the weaponEffect's configured
    // Defense (p.168-169). A plain skill roll defaults to 'none' unless the caller already set
    // dataset.defenseType (e.g. a @Check[defense=...] enricher link, see helpers/enrichers.mjs),
    // and the player can always still choose a Defense manually to roll a Skill Test against a
    // targeted actor.
    updatedShiftDataset.defenseType = item?.type == 'weaponEffect'
      ? item.system.defenseType
      : (dataset.defenseType || 'none');

    updatedShiftDataset.rolePoints = null;

    let rolePoints = null;
    if (item?.type == 'weaponEffect') {
      rolePoints = actor._getBaseRolePoints?.();
      if (rolePoints?.system.bonus.type == 'attackUpshift' && (rolePoints.system.isActive || !rolePoints.system.isActivatable)) {
        updatedShiftDataset.rolePoints = rolePoints;
      } else {
        rolePoints = null;
      }
    }

    const skillRollOptions = await this._rollDialog.getSkillRollOptions(updatedShiftDataset, skillDataset, actor);

    if (skillRollOptions.cancelled) {
      return;
    }

    let label = '';
    let roleSkillDieName = '';

    switch(item?.type) {
    case 'weaponEffect':
      {
        const roleList = actor.items?.documentsByType?.role;
        const baseRole = roleList?.find(role => !role.system.isAdditive);
        roleSkillDieName = baseRole ? baseRole.system.skillDie.name : null;
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

    const canCritD2 = dataset.canCritD2 || skillRollOptions.canCritD2;
    const isSpecialized = dataset.isSpecialized || skillRollOptions.isSpecialized;
    const modifier = actorSkillData.modifier || 0;
    const formula = this._getFormula(isSpecialized, skillRollOptions, finalShift, modifier);

    // If a Defense was chosen (either from the weaponEffect's own configured Defense, or picked
    // manually in the dialog) and there's at least one targeted token, the roll is compared
    // against each target's Defense (p.168-169). Alternatively, a @Check[dif=...] enricher link
    // (helpers/enrichers.mjs) sets a flat Difficulty with no target at all - dataset.dif is only
    // ever present on the roller's own dataset when that roller is the GM, per that enricher's
    // GM-only-visibility design. Either way this produces one or more "entries" to compare the
    // roll total against; with neither, this falls back to a plain roll message below.
    const targets = Array.from(game.user.targets);
    let checkEntries = null;
    if (skillRollOptions.defenseType && skillRollOptions.defenseType != 'none' && targets.length) {
      checkEntries = targets.map(token => ({
        name: token.actor.name,
        targetUuid: token.actor.uuid,
        difficulty: getDefenseValue(token.actor, skillRollOptions.defenseType),
      }));
    } else if (dataset.dif) {
      checkEntries = [{ name: actor.name, targetUuid: null, difficulty: parseInt(dataset.dif) }];
    }

    const checkContext = checkEntries
      ? {
        entries: checkEntries,
        damageValue: item?.type == 'weaponEffect' ? item.system.damageValue : null,
        damageType: item?.type == 'weaponEffect' ? item.system.damageType : null,
      }
      : null;

    // Repeat the roll as many times as specified in the skill roll options dialog
    for (let i = 0; i < skillRollOptions.timesToRoll; i++) {
      let repeatText = '';
      if (skillRollOptions.timesToRoll > 1) {
        repeatText = this._i18n.format("E20.RollRepeatText", {
          index: i + 1,
          total: skillRollOptions.timesToRoll,
        }) + '<br>';
      }

      this._rollSkillHelper(formula, actor, repeatText + label, canCritD2, checkContext);
    }
  }

  /**
   * Computes the automatic dice-shift/Edge/Snag modifiers that come from Size Class
   * differences (Table 10-2: Size Class Combat Adjustment Matrix) and active Conditions,
   * rather than anything the actor chose. Size and target-Condition effects only apply to
   * weapon attack rolls; Impaired and a Prone attacker's own melee penalty are Condition
   * effects that come from the roller's own statuses.
   * @param {Actor} actor   The actor performing the roll.
   * @param {Item} item   The item being used, if any.
   * @returns {Object}   { shiftUp, shiftDown, edge, snag }
   * @private
   */
  _getAutomaticCombatModifiers(actor, item) {
    let shiftUp = 0;
    let shiftDown = 0;
    let edge = false;
    let snag = false;

    const selfStatuses = actor.statuses;
    if (selfStatuses.has('impaired')) {
      shiftDown += 1;
    }

    const isAttack = item?.type == 'weaponEffect';
    if (!isAttack) {
      return { shiftUp, shiftDown, edge, snag };
    }

    const isMelee = item.system.classification.style == 'melee';

    if (selfStatuses.has('blinded')) {
      snag = true;
    }

    if (isMelee && selfStatuses.has('prone')) {
      shiftDown += 1;
    }

    const target = game.user.targets.first()?.actor;
    if (target) {
      shiftUp += this._getSizeShift(actor.system.size, target.system.size);

      const targetStatuses = target.statuses;
      const targetGrantsEdge = targetStatuses.has('blinded')
        || targetStatuses.has('grappled')
        || targetStatuses.has('restrained')
        || targetStatuses.has('stunned')
        || targetStatuses.has('unconscious')
        || (isMelee && targetStatuses.has('prone'));

      if (targetGrantsEdge) {
        edge = true;
      }

      if (targetStatuses.has('immobilized')) {
        shiftUp += 1;
      }

      if (targetStatuses.has('invisible') || (!isMelee && targetStatuses.has('prone'))) {
        snag = true;
      }

      // Resistance to this attack's damage type always imposes a Snag on the roll to apply it
      // (p.170) - unlike Immunity, it does not reduce the damage itself once the attack lands.
      if (target.system.resistances?.[item.system.damageType]) {
        snag = true;
      }
    }

    return { shiftUp, shiftDown, edge, snag };
  }

  /**
   * Computes the dice shift bonus from Table 10-2: Size Class Combat Adjustment Matrix.
   * The table's values reduce to a simple rule: the shift equals half the distance
   * (rounded down) between the two Size Classes on the actorSizes ladder, applied as a
   * shift up regardless of which side is larger.
   * @param {String} attackerSize   The attacking actor's system.size.
   * @param {String} targetSize   The targeted actor's system.size.
   * @returns {Number}   The dice shift bonus, 0 if either size is unrecognized.
   * @private
   */
  _getSizeShift(attackerSize, targetSize) {
    const sizeOrder = Object.keys(E20.actorSizes);
    const attackerIndex = sizeOrder.indexOf(attackerSize);
    const targetIndex = sizeOrder.indexOf(targetSize);

    if (attackerIndex == -1 || targetIndex == -1) {
      return 0;
    }

    return Math.floor(Math.abs(attackerIndex - targetIndex) / 2);
  }

  /**
   * Executes the skill roll.
   * @param {String} formula   The formula to be rolled.
   * @param {Actor} actor   The actor performing the roll.
   * @param {String} flavor   The html to use for the roll message.
   * @param {Boolean} canCritD2   Whether a shift-2 result counts as a Critical Success.
   * @param {Object} checkContext   Optional { defenseType, targets, damageValue, damageType }
   *   built in rollSkill() - when present, the roll is compared against each target's Defense
   *   (p.168-169) instead of posting a plain dice-roll message.
   * @private
   */
  async _rollSkillHelper(formula, actor, flavor, canCritD2, checkContext=null) {
    const roll = new Roll(formula, actor.getRollData());
    const speaker = this._chatMessage.getSpeaker({ actor });

    if (!checkContext) {
      roll.toMessage({
        flags: {
          essence20: {
            canCritD2: canCritD2,
          },
        },
        speaker,
        flavor,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return;
    }

    await roll.evaluate();

    const results = checkContext.entries.map(entry => {
      const multiplier = computeMultiplier(roll.total, entry.difficulty);
      const success = multiplier > 0;
      // Only a resolved target actor (not a flat @Check[dif=...] entry) can take Health damage.
      const canApplyDamage = success && entry.targetUuid && checkContext.damageValue;

      return {
        name: entry.name,
        targetUuid: entry.targetUuid,
        difficulty: entry.difficulty,
        showDifficulty: true,
        success,
        multiplier,
        damageValue: canApplyDamage ? checkContext.damageValue * multiplier : null,
        damageType: checkContext.damageType,
        damageTypeLabel: checkContext.damageType ? this._localize(E20.damageTypes[checkContext.damageType]) : null,
      };
    });

    const chatData = await buildCheckChatData(roll, { flavor, results, speaker, canCritD2 });
    this._chatMessage.create(chatData);
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
    } else if (dataset.skill == 'wealth') {
      rolledSkillStr = this._localize('E20.Wealth');
    } else if (dataset.isSpecialized) {
      rolledSkillStr = dataset.specializationName || E20.skills[dataset.skill];
    } else {
      rolledSkillStr = E20.skills[dataset.skill];
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
    const descStr = this._localize('E20.ItemDescription');
    const noneStr = "";

    let label = `<b>${attackRollStr}</b> - ${weaponEffect.name} (${rolledSkillStr})`;
    label += `${this._getEdgeSnagText(skillRollOptions.edge, skillRollOptions.snag)}<br>`;
    label += `<b>${effectStr}</b> - ${weaponEffect.system.damageValue || noneStr} ${damageType}<br>`;
    label += `<b>${descStr}</b>:${weaponEffect.system.description || noneStr}<br>`;

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
