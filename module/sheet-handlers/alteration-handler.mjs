import {
  compareShift,
  getShiftedSkill,
  parseId,
  rememberOptions,
  rememberValues,
} from "../helpers/utils.mjs";

export class AlterationHandler {

  /**
  * Constructor
  * @param {Essence20ActorSheet} actorSheet The actor sheet
  */
  constructor(actorSheet) {
    this._actorSheet = actorSheet;
    this._actor = actorSheet.actor;
  }

  /**
  * Handle the dropping of an alterations on to a character
  * @param {Alteration} alteration The alteration
  * @param {Function} dropFunc   The function to call to complete the Alteration drop
  */
  async alterationUpdate(alteration, dropFunc) {
    const alterationUuid = parseId(alteration.uuid);

    for (let actorItem of this._actor.items) {
      if (actorItem.type == 'alteration') {
        if (actorItem.system.originalId == alterationUuid) {
          ui.notifications.warn(game.i18n.localize('E20.AlterationAlreadyTaken'));
          return;
        }
      }
    }

    if (alteration.system.type == 'essence') {
      await this._showAlterationBonusSkillDialog(alteration, alterationUuid, dropFunc);
    } else if (alteration.system.type == 'movement') {
      await this._showAlterationCostMovementDialog(alteration, alterationUuid, dropFunc);
    }
  }

  /**
  * Handles the creation of a dialog to create alteration movement reduction
  * @param {Alteration} alteration The alteration
  * @param {String} alterationUuid The original ID of the alteration
  * @param {Function} dropFunc   The function to call to complete the Alteration drop
  */
  async _showAlterationCostMovementDialog (alteration, alterationUuid, dropFunc) {

    //This validates that no base movement has been set for the actor yet.
    if (!this._actor.system.movement.ground.base && !this._actor.system.movement.aerial.base
      && !this._actor.system.movement.climb.base && !this._actor.system.movement.swim.base) {

      ui.notifications.warn(game.i18n.localize('E20.AlterationNoMovement'));
      return;
    }

    const choices = {};
    for (const movementType in this._actor.system.movement) {
      let maxValue = 0;
      if (alteration.system.bonusMovementType != movementType) {
        if (this._actor.system.movement[movementType].base) {
          if (movementType == 'ground') {
            maxValue = (this._actor.system.movement[movementType].base / 5 - 2);
          }else {
            maxValue = (this._actor.system.movement[movementType].base / 5 - 1);
          }

          choices[movementType] = {
            chosen: false,
            label: CONFIG.E20.movementTypes[movementType],
            value: 0,
            maxValue: [maxValue],
          };
        }
      }
    }

    new Dialog(
      {
        title: game.i18n.localize('E20.AlterationMovementCost'),
        content: await renderTemplate("systems/essence20/templates/dialog/alteration-movement.hbs", {
          choices,
        }),
        buttons: {
          save: {
            label: game.i18n.localize('E20.AcceptButton'),
            callback: html => this._processAlterationMovementCost(alteration, rememberValues(html), alterationUuid, dropFunc),
          },
        },
      },
    ).render(true);
  }

  /**
  * Handles the movements choices and updating the actors movements
  * @param {Alteration} alteration The alteration
  * @param {Options} options  The options selected from the dialog
  * @param {string} alterationUuid The original ID of the alteration
  * @param {Function} dropFunc   The function to call to complete the Alteration drop
  */
  async _processAlterationMovementCost(alteration, options, alterationUuid, dropFunc) {
    let additionalBonusMovement = 0;

    for (const movementReductionType in options) {
      const movementReduction = Number(options[movementReductionType].value);
      const movementReductionMax = options[movementReductionType].max;

      if (movementReduction > movementReductionMax) {
        ui.notifications.warn(game.i18n.localize('E20.AlterationMovementTooBig'));
        return;
      }

      additionalBonusMovement += movementReduction;
      let newMovementValue = 0;

      if (movementReductionType == alteration.system.costMovementType) {
        newMovementValue = this._actor.system.movement[movementReductionType].base - ((movementReduction * 5) + alteration.system.costMovement);
      } else {
        newMovementValue = this._actor.system.movement[movementReductionType].base - (movementReduction * 5);
      }

      const movementReductionString = `system.movement.${movementReductionType}.base`;
      await this._actor.update ({
        [movementReductionString]: newMovementValue,
      });
    }

    const newAlterationList = await dropFunc();
    const newAlteration = newAlterationList[0];

    const totalBonusMovement = alteration.system.bonusMovement + (additionalBonusMovement * 5);
    const bonusMovementString = `system.movement.${alteration.system.bonusMovementType}.base`;
    await this._actor.update ({
      [bonusMovementString]: totalBonusMovement,
    });

    await newAlteration.update ({
      "system.movementCost": options,
      "system.originalId": alterationUuid,
    });
  }

  /**
  * Handles creating a list to select a skill to increase
  * @param {Alteration} alteration The alteration
  * @param {String} alterationUuid The original ID of the alteration
  * @param {Function} dropFunc   The function to call to complete the Alteration drop
  */
  async _showAlterationBonusSkillDialog(alteration, alterationUuid, dropFunc) {
    const choices = {};
    for (const skill in this._actor.system.skills) {
      if (this._actor.system.skills[skill].essences[alteration.system.essenceBonus]) {
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

    new Dialog(
      {
        title: game.i18n.localize('E20.AlterationSkillIncrease'),
        content: await renderTemplate("systems/essence20/templates/dialog/option-select.hbs", {
          choices,
        }),
        buttons: {
          save: {
            label: game.i18n.localize('E20.AcceptButton'),
            callback: html => this._processAlterationSkillIncrease(alteration, rememberOptions(html), alterationUuid, dropFunc),
          },
        },
      },
    ).render(true);
  }

  /**
  * Handles choosing a skill to increase
  * @param {Alteration} alteration The alteration
  * @param {Object} options    The options resulting from _showAlterationBonusSkillDialog()
  * @param {AlterationUUID} alterationUuid The original ID of the alteration
  * @param {Function} dropFunc   The function to call to complete the Alteration drop
  */
  async _processAlterationSkillIncrease(alteration, options, alterationUuid, dropFunc) {
    let bonusSkill = "";
    for (const [skill, isSelected] of Object.entries(options)) {
      if (isSelected) {
        bonusSkill = skill;
        break;
      }
    }

    if (!bonusSkill) {
      ui.notifications.warn(game.i18n.localize('E20.AlterationSelectNoSkill'));
      return;
    }

    if (alteration.system.essenceCost.length > 1) {
      await this._showAlterationCostEssenceDialog(alteration, bonusSkill, alterationUuid, dropFunc);
    } else {
      await this._showAlterationCostSkillDialog(alteration, bonusSkill, alterationUuid, dropFunc);
    }
  }

  /**
  * Handles creating a dialog to choose an essencd to decrease
  * @param {Object} alteration The alteration
  * @param {String} bonusSkill    The skill selected from _processAlterationSkillIncrease()
  * @param {String} alterationUuid The original ID of the alteration
  * @param {Function} dropFunc   The function to call to complete the Alteration drop
  */
  async _showAlterationCostEssenceDialog(alteration, bonusSkill, alterationUuid, dropFunc) {
    const choices = {};
    for (const essence of alteration.system.essenceCost) {
      choices[essence] = {
        chosen: false,
        label: CONFIG.E20.originEssences[essence],
      };
    }

    new Dialog(
      {
        title: game.i18n.localize('E20.AlterationCost'),
        content: await renderTemplate("systems/essence20/templates/dialog/option-select.hbs", {
          choices,
        }),
        buttons: {
          save: {
            label: game.i18n.localize('E20.AcceptButton'),
            callback: html => this._showAlterationCostSkillDialog(alteration, bonusSkill, rememberOptions(html), alterationUuid, dropFunc),
          },
        },
      },
    ).render(true);
  }

  /**
  * Handles creating a dialog to select a skill to decrease
  * @param {Alteration} alteration The alteration
  * @param {String} bonusSkill    The skill selected from _processAlterationSkillIncrease()
  * @param {Object} options    The options resulting from _showAlterationCostEssenceDialog()
  * @param {AlterationUUID} alterationUuid The original ID of the alteration
  * @param {Function} dropFunc   The function to call to complete the Alteration drop
  */
  async _showAlterationCostSkillDialog(alteration, bonusSkill, options, alterationUuid, dropFunc) {
    const choices = {};
    let costEssence = "";

    if (options) {
      const essences = Object.keys(options);

      for (const essence of essences) {
        if (options[essence]) {
          costEssence = essence;
        }
      }

      for (const skill in this._actor.system.skills) {
        for (const essence of essences) {
          if (options[essence]) {
            if (this._actor.system.skills[skill].essences[essence]) {
              if (compareShift(this._actor.system.skills[skill].shift, "d20", "greater")) {
                choices[skill] = {
                  chosen: false,
                  label: CONFIG.E20.originSkills[skill],
                };
              }
            }
          }
        }
      }
    } else {
      const essence = alteration.system.essenceCost;
      for (const skill in this._actor.system.skills) {
        if (this._actor.system.skills[skill].essences[essence]) {
          if (compareShift(this._actor.system.skills[skill].shift, "d20", "greater")) {
            choices[skill] = {
              chosen: false,
              label: CONFIG.E20.originSkills[skill],
            };
          }
        }
      }

      costEssence = essence;
    }

    if (costEssence == 'speed') {
      const skill = "initiative";
      if (CONFIG.E20.skillShiftList.indexOf(this._actor.system.initiative.shift) < 10) {
        choices[skill] = {
          chosen: false,
          label: CONFIG.E20.originSkills[skill],
        };
      }
    } else if (costEssence == 'strength') {
      const skill = "conditioning";
      if (this._actor.system.conditioning > 0) {
        choices[skill] = {
          chosen: false,
          label: CONFIG.E20.originSkills[skill],
        };
      }
    }

    new Dialog(
      {
        title: game.i18n.localize('E20.AlterationSkillCost'),
        content: await renderTemplate("systems/essence20/templates/dialog/option-select.hbs", {
          choices,
        }),
        buttons: {
          save: {
            label: game.i18n.localize('E20.AcceptButton'),
            callback: html => this._alterationStatUpdate(alteration, bonusSkill, costEssence, rememberOptions(html), alterationUuid, dropFunc),
          },
        },
      },
    ).render(true);
  }

  /**
  * Handles the setting of values from a essence bonus alteration
  * @param {Alteration} alteration The alteration
  * @param {String} bonusSkill    The skill selected from _processAlterationSkillIncrease()
  * @param {String} costEssence    The essence selected from _showAlterationCostEssenceDialog()
  * @param {Object} options    The options resulting from _showAlterationCostSkillDialog()
  * @param {String} alterationUuid The original ID of the alteration
  * @param {Function} dropFunc   The function to call to complete the Alteration drop
  */
  async _alterationStatUpdate(alteration, bonusSkill, costEssence, options, alterationUuid, dropFunc) {
    let costSkill = "";
    for (const [skill, isSelected] of Object.entries(options)) {
      if (isSelected) {
        costSkill = skill;
        break;
      }
    }

    if (!costSkill) {
      ui.notifications.warn(game.i18n.localize('E20.AlterationSelectNoSkill'));
      return;
    }

    const bonusEssence = alteration.system.essenceBonus;
    const bonusEssenceValue = this._actor.system.essences[bonusEssence] + 1;
    const costEssenceValue  = this._actor.system.essences[costEssence] - 1;
    const bonusEssenceString = `system.essences.${bonusEssence}`;
    const costEssenceString = `system.essences.${costEssence}`;

    const [bonusNewShift, bonusSkillString] = await getShiftedSkill(bonusSkill, 1, this._actor);
    const [costNewShift, costSkillString] = await getShiftedSkill(costSkill, -1, this._actor);

    const newAlterationList = await dropFunc();
    const newAlteration = newAlterationList[0];

    await this._actor.update ({
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
  * Handle the deleting of the alteration from a character
  * @param {Alteration} alteration The alteration
  */
  async _onAlterationDelete(alteration) {
    if (alteration.system.movementCost) {
      let totalMovementDecrease = 0;
      for (const movementReductionType in alteration.system.movementCost) {
        const movementReductionValue = alteration.system.movementCost[movementReductionType].value;

        let movementUpdate = 0;
        if (movementReductionType == alteration.system.costMovementType) {
          movementUpdate = this._actor.system.movement[movementReductionType].base + (movementReductionValue * 5) + alteration.system.costMovement;
        } else {
          movementUpdate = this._actor.system.movement[movementReductionType].base + (movementReductionValue * 5);
        }

        const movementReductionString = `system.movement.${movementReductionType}.base`;
        await this._actor.update ({
          [movementReductionString]: movementUpdate,
        });
        totalMovementDecrease += movementReductionValue;
      }

      const bonusMovementRemovalString = `system.movement.${alteration.system.bonusMovementType}.base`;
      const newMovement = this._actor.system.movement[alteration.system.bonusMovementType].base - ((totalMovementDecrease * 5) + alteration.system.bonusMovement);
      await this._actor.update ({
        [bonusMovementRemovalString]: newMovement,
      });

    } else {
      const bonusEssence = alteration.system.essenceBonus;
      const bonusEssenceValue = this._actor.system.essences[bonusEssence] - 1;
      const bonusEssenceString = `system.essences.${bonusEssence}`;
      let costEssence = "";

      if (alteration.system.selectedEssence) {
        costEssence = alteration.system.selectedEssence;
      } else {
        costEssence = alteration.system.essenceCost;
      }

      const costEssenceValue = this._actor.system.essences[costEssence] + 1;
      const costEssenceString = `system.essences.${costEssence}`;
      const bonusSkill = alteration.system.bonus;
      const costSkill = alteration.system.cost;

      const [bonusNewShift, bonusSkillString] = await getShiftedSkill(bonusSkill, -1, this._actor);
      const [costNewShift, costSkillString] = await getShiftedSkill(costSkill, 1, this._actor);

      await this._actor.update ({
        [bonusEssenceString]: bonusEssenceValue,
        [costEssenceString]: costEssenceValue,
        [bonusSkillString]: bonusNewShift,
        [costSkillString]: costNewShift,
      });
    }
  }
}
