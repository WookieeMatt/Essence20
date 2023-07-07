import {
  getSkillChange,
  rememberOptions,
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

  async alterationUpdate(alteration, dropFunc) {
    if (alteration.system.essenceBonus) {
      await this._showAlterationBonusSkillDialog(alteration, dropFunc);
    }
  }

  async _showAlterationBonusSkillDialog(alteration, dropFunc) {
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
      const skill = "initiatve";
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
        title: game.i18n.localize('E20.AlterationIncrease'),
        content: await renderTemplate("systems/essence20/templates/dialog/option-select.hbs", {
          choices,
        }),
        buttons: {
          save: {
            label: game.i18n.localize('E20.AcceptButton'),
            callback: html => this._alterationBonusSet(alteration, rememberOptions(html), dropFunc),
          },
        },
      },
    ).render(true);
  }

  async _alterationBonusSet(alteration, options, dropFunc) {
    let bonusSkill = "";
    for (const [skill, isSelected] of Object.entries(options)) {
      if (isSelected) {
        bonusSkill = skill;
        break;
      }
    }

    if (!bonusSkill) {
      ui.notifications.warn(game.idemo8n.localize('E20.AlterationSelectNoSkill'));
      return;
    }

    if (alteration.system.essenceCost.length > 1) {
      await this._showAlterationCostEssenceDialog (alteration, bonusSkill, dropFunc);
    } else {
      await this._showAlterationCostSkillDialog (alteration, bonusSkill, dropFunc);
    }
  }

  async _showAlterationCostEssenceDialog(alteration, bonusSkill, dropFunc) {
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
            callback: html => this._showAlterationCostSkillDialog(alteration, bonusSkill, dropFunc, rememberOptions(html)),
          },
        },
      },
    ).render(true);
  }

  async _showAlterationCostSkillDialog(alteration, bonusSkill, dropFunc, options) {
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
              choices[skill] = {
                chosen: false,
                label: CONFIG.E20.originSkills[skill],
              };
            }
          }
        }
      }
    } else {
      const essence = alteration.system.essenceCost;
      for (const skill in this._actor.system.skills) {
        if (this._actor.system.skills[skill].essences[essence]) {
          choices[skill] = {
            chosen: false,
            label: CONFIG.E20.originSkills[skill],
          };
        }
      }

      costEssence = essence;
    }

    if (costEssence == 'speed') {
      const skill = "initiative";
      choices[skill] = {
        chosen: false,
        label: CONFIG.E20.originSkills[skill],
      };
    } else if (costEssence == 'strength') {
      const skill = "conditioning";
      choices[skill] = {
        chosen: false,
        label: CONFIG.E20.originSkills[skill],
      };
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
            callback: html => this._alterationStatUpdate(alteration, bonusSkill, dropFunc, costEssence, rememberOptions(html)),
          },
        },
      },
    ).render(true);
  }

  async _alterationStatUpdate(alteration, bonusSkill, dropFunc, costEssence, options) {
    let costSkill = "";
    for (const [skill, isSelected] of Object.entries(options)) {
      if (isSelected) {
        costSkill = skill;
        break;
      }
    }

    if (!costSkill) {
      ui.notifications.warn(game.idemo8n.localize('E20.AlterationSelectNoSkill'));
      return;
    }

    const bonusEssence = alteration.system.essenceBonus;
    const bonusEssenceValue = this._actor.system.essences[bonusEssence] + 1;
    const costEssenceValue  = this._actor.system.essences[costEssence] - 1;
    const bonusEssenceString = `system.essences.${bonusEssence}`;
    const costEssenceString = `system.essences.${costEssence}`;

    const [bonusNewShift, bonusSkillString] = await getSkillChange(bonusSkill, 1, this._actor);
    const [costNewShift, costSkillString] = await getSkillChange(costSkill, -1, this._actor);

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
      "system.selectedEssence": costEssence,
    });
  }

  async _onAlterationDelete(alteration) {
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

    const [bonusNewShift, bonusSkillString] = await getSkillChange(bonusSkill, -1, this._actor);
    const [costNewShift, costSkillString] = await getSkillChange(costSkill, 1, this._actor);

    await this._actor.update ({
      [bonusEssenceString]: bonusEssenceValue,
      [costEssenceString]: costEssenceValue,
      [bonusSkillString]: bonusNewShift,
      [costSkillString]: costNewShift,
    });
  }
}
