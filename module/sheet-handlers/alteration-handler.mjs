
import AlterationMovementSelector from "../apps/alteration-movement-selector.mjs";
import AlterationEssenceSelector from "../apps/alteration-essence-selector.mjs";
import {
  getShiftedSkill,
  parseId,
} from "../helpers/utils.mjs";

/**
* Handle the dropping of an Alteration onto an Actor
* @param {Actor} actor The Actor receiving the Alteration
* @param {Alteration} alteration The Alteration being dropped
* @param {Function} dropFunc The function to call to complete the Alteration drop
*/
export async function onAlterationDrop(actor, alteration, dropFunc) {
  const alterationUuid = parseId(alteration.uuid);

  for (let actorItem of actor.items) {
    if (actorItem.type == 'alteration') {
      if (actorItem.system.originalId == alterationUuid) {
        ui.notifications.warn(game.i18n.localize('E20.AlterationAlreadyTaken'));
        return;
      }
    }
  }

  if (alteration.system.type == 'essence') {
    await _showAlterationBonusSkillDialog(actor, alteration, alterationUuid, dropFunc);
  } else if (alteration.system.type == 'movement') {
    await _showAlterationCostMovementDialog(actor, alteration, alterationUuid, dropFunc);
  } else {
    const newAlterationList = await dropFunc();
    const newAlteration = newAlterationList[0];
    await newAlteration.update ({
      "system.originalId": alterationUuid,
    });
  }
}

/**
* Handles the creation of a dialog to create Alteration movement reduction
* @param {Actor} actor The Actor receiving the Alteration
* @param {Alteration} alteration The Alteration being dropped
* @param {String} alterationUuid The original ID of the Alteration
* @param {Function} dropFunc The function to call to complete the Alteration drop
*/
async function _showAlterationCostMovementDialog(actor, alteration, alterationUuid, dropFunc) {
  //sal validates that no base movement has been set for the actor yet.
  if (!actor.system.movement.ground.base && !actor.system.movement.aerial.base
    && !actor.system.movement.climb.base && !actor.system.movement.swim.base) {

    ui.notifications.warn(game.i18n.localize('E20.AlterationNoMovement'));
    return;
  }

  const choices = {};
  for (const movementType in actor.system.movement) {
    let maxValue = 0;
    if (alteration.system.bonusMovementType != movementType) {
      if (actor.system.movement[movementType].base > 0) {
        if (movementType == 'ground') {
          maxValue = (actor.system.movement[movementType].base / 5 - 2);
        }else {
          maxValue = (actor.system.movement[movementType].base / 5 - 1);
        }

        choices[movementType] = {
          chosen: false,
          label: CONFIG.E20.movementTypes[movementType],
          value: 0,
          maxValue: maxValue,
        };
      }
    }
  }

  const title = "E20.AlterationMovementCost";
  new AlterationMovementSelector(actor, alteration, choices, alterationUuid, title, dropFunc).render(true);
}

/**
* Handles the movement choices and updating the Actor's movements
* @param {Actor} actor The Actor receiving the Alteration
* @param {Alteration} alteration The Alteration being dropped
* @param {Options} options The options selected from the dialog
* @param {String} alterationUuid The original ID of the Alteration
* @param {Function} dropFunc The function to call to complete the Alteration drop
*/
export async function _processAlterationMovementCost(actor, alteration, data, alterationUuid, dropFunc) {
  let additionalBonusMovement = 0;

  for (const movementReductionType in data) {
    const movementReduction = Number(data[movementReductionType].value);
    const movementReductionMax = data[movementReductionType].max;

    if (movementReduction > movementReductionMax) {
      ui.notifications.warn(game.i18n.localize('E20.AlterationMovementTooBig'));
      return;
    }

    additionalBonusMovement += movementReduction;
    let newMovementValue = 0;

    if (movementReductionType == alteration.system.costMovementType) {
      newMovementValue = actor.system.movement[movementReductionType].base - ((movementReduction * 5) + alteration.system.costMovement);
    } else {
      newMovementValue = actor.system.movement[movementReductionType].base - (movementReduction * 5);
    }

    const movementReductionString = `system.movement.${movementReductionType}.base`;
    await actor.update ({
      [movementReductionString]: newMovementValue,
    });
  }

  const newAlterationList = await dropFunc();
  const newAlteration = newAlterationList[0];

  const totalBonusMovement = alteration.system.bonusMovement + (additionalBonusMovement * 5);
  const bonusMovementString = `system.movement.${alteration.system.bonusMovementType}.base`;
  await actor.update ({
    [bonusMovementString]: totalBonusMovement,
  });

  await newAlteration.update ({
    "system.movementCost": data,
    "system.originalId": alterationUuid,
  });
}

/**
* Handles creating a list to select a skill to increase
* @param {Actor} actor The Actor receiving the Alteration
* @param {Alteration} alteration The Alteration being dropped
* @param {String} alterationUuid The original ID of the Alteration
* @param {Function} dropFunc The function to call to complete the Alteration drop
*/
export async function _showAlterationBonusSkillDialog(actor, alteration, alterationUuid, dropFunc) {
  const choices = {};
  for (const skill in actor.system.skills) {
    if (actor.system.skills[skill].essences[alteration.system.essenceBonus]) {
      choices[skill] = {
        chosen: false,
        label: CONFIG.E20.originSkills[skill],
      };
    }
  }

  if (alteration.system.essenceBonus == 'speed') {
    const skill = "initiative";
    choices[skill] = {
      chosen: false,
      label: CONFIG.E20.originSkills[skill],
    };
  }

  if (alteration.system.essenceBonus == 'strength') {
    const skill = "conditioning";
    choices[skill] = {
      chosen: false,
      label: CONFIG.E20.originSkills[skill],
    };
  }

  const title = "E20.AlterationSkillIncrease";
  new AlterationEssenceSelector(choices, actor, alteration, alterationUuid, dropFunc, title, null, null).render(true);
}

/**
* Handles choosing a skill to increase
* @param {Actor} actor The Actor receiving the Alteration
* @param {Alteration} alteration The Alteration being dropped
* @param {Object} options The options resulting from _showAlterationBonusSkillDialog()
* @param {String} alterationUuid The original ID of the Alteration
* @param {Function} dropFunc The function to call to complete the Alteration drop
*/
export async function _processAlterationSkillIncrease(actor, alteration, bonusSkill, alterationUuid, dropFunc) {
  if (!bonusSkill) {
    ui.notifications.warn(game.i18n.localize('E20.AlterationSelectNoSkill'));
    return;
  }

  if (alteration.system.essenceCost.length > 1) {
    await _showAlterationCostEssenceDialog(actor, alteration, bonusSkill, alterationUuid, dropFunc);
  } else {
    const options = null;
    await _showAlterationCostSkillDialog(actor, alteration, bonusSkill, alterationUuid, options, dropFunc);
  }
}

/**
* Handles creating a dialog to choose an Essence to decrease
* @param {Actor} actor The Actor receiving the Alteration
* @param {Object} alteration The Alteration being dropped
* @param {String} bonusSkill The skill selected from _processAlterationSkillIncrease()
* @param {String} alterationUuid The original ID of the alteration
* @param {Function} dropFunc The function to call to complete the Alteration drop
*/
async function _showAlterationCostEssenceDialog(actor, alteration, bonusSkill, alterationUuid, dropFunc) {
  const choices = {};
  for (const essence of alteration.system.essenceCost) {
    choices[essence] = {
      chosen: false,
      label: CONFIG.E20.originEssences[essence],
    };
  }

  const title = "E20.AlterationCost";
  new AlterationEssenceSelector(choices, actor, alteration, alterationUuid, dropFunc, title, bonusSkill, null).render(true);
}

/**
* Handles creating a dialog to select a skill to decrease
* @param {Actor} actor The Actor receiving the Alteration
* @param {Alteration} alteration The Alteration being dropped
* @param {String} bonusSkill The skill selected from _processAlterationSkillIncrease()
* @param {Object} options The options resulting from _showAlterationCostEssenceDialog()
* @param {String} alterationUuid The original ID of the Alteration
* @param {Function} dropFunc The function to call to complete the Alteration drop
*/
export async function _showAlterationCostSkillDialog(actor, alteration, bonusSkill, alterationUuid, costEssence, dropFunc) {
  const choices = {};
  if (!costEssence) {
    costEssence = alteration.system.essenceCost;
  }

  for (const skill in actor.system.skills) {
    if (actor.system.skills[skill].essences[costEssence]) {
      if (_compareShift(actor.system.skills[skill].shift, "d20", "greater")) {
        choices[skill] = {
          chosen: false,
          label: CONFIG.E20.originSkills[skill],
        };
      }
    }
  }

  if (costEssence == 'speed') {
    const skill = "initiative";
    if (CONFIG.E20.skillShiftList.indexOf(actor.system.initiative.shift) < 10) {
      choices[skill] = {
        chosen: false,
        label: CONFIG.E20.originSkills[skill],
      };
    }
  } else if (costEssence == 'strength') {
    const skill = "conditioning";
    if (actor.system.conditioning > 0) {
      choices[skill] = {
        chosen: false,
        label: CONFIG.E20.originSkills[skill],
      };
    }
  }

  if (!Object.keys(choices).length) {
    ui.notifications.error(
      game.i18n.format(
        'E20.AlterationNoOptions',
        {name: alteration.name, essence: CONFIG.E20.essences[costEssence]},
      ));
    return;
  }

  const title = "E20.AlterationSkillCost";
  new AlterationEssenceSelector(choices, actor, alteration, alterationUuid, dropFunc, title, bonusSkill, costEssence).render(true);
}

/** Handle comparing skill rank
 * @param {String} shift1 The first skill
 * @param {String} shift2 The second skill
 * @param {String} operator The type of comparison
 * @return {Boolean} The result of the comparison
 */
function _compareShift(shift1, shift2, operator) {
  if (operator == 'greater') {
    return CONFIG.E20.skillShiftList.indexOf(shift1) < CONFIG.E20.skillShiftList.indexOf(shift2);
  } else if (operator == 'lesser') {
    return CONFIG.E20.skillShiftList.indexOf(shift1) > CONFIG.E20.skillShiftList.indexOf(shift2);
  } else if (operator == 'equal') {
    return CONFIG.E20.skillShiftList.indexOf(shift1) == CONFIG.E20.skillShiftList.indexOf(shift2);
  } else {
    throw new Error(`Operator ${operator} not expected`);
  }
}

/**
* Handles the setting of values from an Essence bonus alteration
* @param {Actor} actor The Actor receiving the Alteration
* @param {Alteration} alteration The Alteration being dropped
* @param {String} bonusSkill The skill selected from _processAlterationSkillIncrease()
* @param {String} costEssence The Essence selected from _showAlterationCostEssenceDialog()
* @param {Object} options The options resulting from _showAlterationCostSkillDialog()
* @param {String} alterationUuid The original ID of the Alteration
* @param {Function} dropFunc The function to call to complete the Alteration drop
*/
export async function _alterationStatUpdate(actor, alteration, bonusSkill, costEssence, costSkill, alterationUuid, dropFunc) {
  if (!costSkill) {
    ui.notifications.warn(game.i18n.localize('E20.AlterationSelectNoSkill'));
    return;
  }

  const bonusEssence = alteration.system.essenceBonus;
  const bonusEssenceValue = actor.system.essences[bonusEssence].max + 1;
  const costEssenceValue  = actor.system.essences[costEssence].max - 1;
  const bonusEssenceString = `system.essences.${bonusEssence}.max`;
  const costEssenceString = `system.essences.${costEssence}.max`;

  const [bonusNewShift, bonusSkillString] = getShiftedSkill(bonusSkill, 1, actor);
  const [costNewShift, costSkillString] = getShiftedSkill(costSkill, -1, actor);

  const newAlterationList = await dropFunc();
  const newAlteration = newAlterationList[0];

  await actor.update ({
    [bonusEssenceString]: bonusEssenceValue,
    [costEssenceString]: costEssenceValue,
    [bonusSkillString]: bonusNewShift,
    [costSkillString]: costNewShift,
  });

  await newAlteration.update ({
    "system.bonus": bonusSkill,
    "system.cost": costSkill,
    "system.originalId": alterationUuid,
    "system.selectedEssence": costEssence,
  });
}

/**
* Handle the deleting of the Alteration from an Actor
* @param {Actor} actor The Actor whose Alteration is being deleted
* @param {Alteration} alteration The Alteration being deleted
*/
export async function onAlterationDelete(actor, alteration) {
  if (alteration.system.type == 'movement') {
    let totalMovementDecrease = 0;
    for (const movementReductionType in alteration.system.movementCost) {
      const movementReductionValue = alteration.system.movementCost[movementReductionType].value;
      let movementUpdate = 0;
      if (movementReductionType == alteration.system.costMovementType) {
        movementUpdate = actor.system.movement[movementReductionType].base + (movementReductionValue * 5) + alteration.system.costMovement;
      } else {
        movementUpdate = actor.system.movement[movementReductionType].base + (movementReductionValue * 5);
      }

      const movementReductionString = `system.movement.${movementReductionType}.base`;
      await actor.update ({
        [movementReductionString]: movementUpdate,
      });
      totalMovementDecrease += movementReductionValue;
    }

    const bonusMovementRemovalString = `system.movement.${alteration.system.bonusMovementType}.base`;
    const newMovement = actor.system.movement[alteration.system.bonusMovementType].base - ((totalMovementDecrease * 5) + alteration.system.bonusMovement);
    await actor.update ({
      [bonusMovementRemovalString]: newMovement,
    });
  } else if (alteration.system.type == 'essence') {
    const bonusEssence = alteration.system.essenceBonus;
    const bonusEssenceValue = actor.system.essences[bonusEssence].max - 1;
    const bonusEssenceString = `system.essences.${bonusEssence}.max`;
    let costEssence = "";

    if (alteration.system.selectedEssence) {
      costEssence = alteration.system.selectedEssence;
    } else {
      costEssence = alteration.system.essenceCost;
    }

    const costEssenceValue = actor.system.essences[costEssence].max + 1;
    const costEssenceString = `system.essences.${costEssence}.max`;
    const bonusSkill = alteration.system.bonus;
    const costSkill = alteration.system.cost;

    const [bonusNewShift, bonusSkillString] = getShiftedSkill(bonusSkill, -1, actor);
    const [costNewShift, costSkillString] = getShiftedSkill(costSkill, 1, actor);

    await actor.update ({
      [bonusEssenceString]: bonusEssenceValue,
      [costEssenceString]: costEssenceValue,
      [bonusSkillString]: bonusNewShift,
      [costSkillString]: costNewShift,
    });
  }
}
