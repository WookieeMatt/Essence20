import {
  createItemCopies,
  getItemsOfType,
  getShiftedSkill,
  // itemDeleteById,
  rememberOptions,
  // searchCompendium,
} from "../helpers/utils.mjs";

export class BackgroundHandler {
  /**
   * Constructor
   * @param {Essence20ActorSheet} actorSheet The actor sheet
   */
  constructor(actorSheet) {
    this._actorSheet = actorSheet;
    this._actor = actorSheet.actor;
  }

  /**
   * Handle the dropping of an influence on to a character
   * @param {Influence} influence The Influence
   * @param {Function} dropFunc   The function to call to complete the Influence drop
   */
  async influenceUpdate(influence, dropFunc) {
    let addHangUp = false;

    for (const item of this._actor.items) {
      if (item.type == 'influence' || influence.system.mandatoryHangUp) {
        addHangUp = true;
        break;
      }
    }

    const newInfluenceList = await dropFunc();
    await createItemCopies(influence.system.items, this._actor, "perk", newInfluenceList[0]);

    if (addHangUp) {
      const hangUpIds = [];
      for (const [key,item] of Object.entries(influence.system.items)) {
        console.log(key);
        if (item.type == 'hangUp') {
          hangUpIds.push(item.uuid);
        }
      }

      if (hangUpIds.length > 1) {
        this._chooseHangUp(influence);
      } else {
        await createItemCopies(influence.system.items, this._actor, "hangUp", newInfluenceList[0]);
      }
    }

  }

  /**
   * Handle the dropping of an Origin on to a character
   * @param {Origin} origin     The Origin
   * @param {Function} dropFunc The function to call to complete the Origin drop
   */
  async originUpdate(origin, dropFunc) {
    if (!origin.system.essences.length) {
      ui.notifications.error(game.i18n.format(game.i18n.localize('E20.OriginNoEssenceError')));
      return false;
    }

    for (let actorItem of this._actor.items) {
      // Characters can only have one Origin
      if (actorItem.type == 'origin') {
        ui.notifications.error(game.i18n.format(game.i18n.localize('E20.OriginMulitpleError')));
        return false;
      }
    }

    await this._showOriginEssenceDialog(origin, dropFunc);
  }

  /**
   * Displays a dialog for selecting an Essence for the given Origin.
   * @param {Object} origin     The Origin
   * @param {Function} dropFunc The function to call to complete the Origin drop
   */
  async _showOriginEssenceDialog(origin, dropFunc) {
    const choices = {};
    for (const essence of origin.system.essences) {
      choices[essence] = {
        chosen: false,
        label: CONFIG.E20.originEssences[essence],
      };
    }

    const influences = await getItemsOfType("influence", this._actor.items);
    for (const influence of influences) {
      if (influence.system.skills.length) {
        for (const skill of influence.system.skills) {
          for (const influenceEssence in this._actor.system.skills[skill].essences) {
            if (this._actor.system.skills[skill].essences[influenceEssence]) {
              choices[influenceEssence] = {
                chosen: false,
                label: CONFIG.E20.originEssences[influenceEssence],
              };
            }
          }
        }
      }
    }

    new Dialog(
      {
        title: game.i18n.localize('E20.EssenceIncrease'),
        content: await renderTemplate("systems/essence20/templates/dialog/option-select.hbs", {
          choices,
        }),
        buttons: {
          save: {
            label: game.i18n.localize('E20.AcceptButton'),
            callback: html => this._showOriginSkillDialog(origin, rememberOptions(html), dropFunc),
          },
        },
      },
    ).render(true);
  }

  /**
   * Displays a dialog for selecting a Skill for the given Origin.
   * @param {Object} origin     The Origin
   * @param {Object} options    The options resulting from _showOriginEssenceDialog()
   * @param {Function} dropFunc The function to call to complete the Origin drop
   */
  async _showOriginSkillDialog(origin, options, dropFunc) {
    const essences = Object.keys(options);
    const choices = {};
    let selectedEssence = "";

    for (const skill of origin.system.skills) {
      const essence = CONFIG.E20.skillToEssence[skill];
      if (options[essence] && essences.includes(essence)) {
        selectedEssence = essence;
        choices[skill] = {
          chosen: false,
          label: CONFIG.E20.originSkills[skill],
        };
      }
    }

    const influences = await getItemsOfType("influence", this._actor.items);
    for (const influence of influences) {
      if (influence.system.skills) {
        for (const skill of influence.system.skills) {
          const essence = CONFIG.E20.skillToEssence[skill];
          if (options[essence] && essences.includes(essence)) {
            selectedEssence = essence;
            choices[skill] = {
              chosen: false,
              label: CONFIG.E20.originSkills[skill],
            };
          }
        }
      }
    }

    if (!selectedEssence) {
      ui.notifications.error(game.i18n.localize('E20.OriginSelectNoEssence'));
      return;
    }

    new Dialog(
      {
        title: game.i18n.localize('E20.OriginBonusSkill'),
        content: await renderTemplate("systems/essence20/templates/dialog/option-select.hbs", {
          choices,
        }),
        buttons: {
          save: {
            label: game.i18n.localize('E20.AcceptButton'),
            callback: html => this._originStatUpdate(
              origin, selectedEssence, rememberOptions(html), dropFunc,
            ),
          },
        },
      },
    ).render(true);
  }

  /**
  * Updates the actor with the information selected for the Origin
  * @param {Object} origin     The Origin
  * @param {Object} options    The options resulting from _showOriginSkillDialog()
  * @param {Object} essence    The essence selected in the _showOriginEssenceDialog()
  * @param {Function} dropFunc The function to call to complete the Origin drop
  */
  async _originStatUpdate(origin, essence, options, dropFunc) {
    let selectedSkill = "";
    for (const [skill, isSelected] of Object.entries(options)) {
      if (isSelected) {
        selectedSkill = skill;
        break;
      }
    }

    if (!selectedSkill) {
      ui.notifications.warn(game.i18n.localize('E20.OriginSelectNoSkill'));
      return;
    }

    const essenceValue = this._actor.system.essences[essence] + 1;
    const essenceString = `system.essences.${essence}`;

    const [newShift, skillString] = await getShiftedSkill(selectedSkill, 1, this._actor);

    const newOriginList = await dropFunc();
    await createItemCopies(origin.system.items, this._actor, "perk", newOriginList[0]);

    await this._actor.update({
      [essenceString]: essenceValue,
      [skillString]: newShift,
      "system.health.max": origin.system.startingHealth,
      "system.health.value": origin.system.startingHealth,
      "system.movement.aerial.base": origin.system.baseAerialMovement,
      "system.movement.swim.base": origin.system.baseAquaticMovement,
      "system.movement.ground.base": origin.system.baseGroundMovement,
      "system.originEssencesIncrease": essence,
      "system.originSkillsIncrease": selectedSkill,
    });
  }

  /**
  * Displays a dialog for selecting a Hang Up from an Influence
  * @param {Influence} influence    The Influence
  * @param {Perk[]} perkIds         The Perk IDs that go with the new Influence
  * @param {Influence} newInfluence The new Influence that was created.
  * @private
  */
  async _chooseHangUp(influence) {
    const choices = {};
    let itemArray = [];
    let compendiumData = null;

    for (const [key,item] of Object.entries(influence.system.items)) {
      if (item.type == 'hangUp') {
        itemArray.push(item);
          choices[item.uuid] = {
          chosen: false,
          label: item.name,
        };
      }
    }

    new Dialog(
      {
        title: game.i18n.localize('E20.HangUpChoice'),
        content: await renderTemplate(
          "systems/essence20/templates/dialog/option-select.hbs",
          { choices },
        ),
        buttons: {
          save: {
            label: game.i18n.localize('E20.AcceptButton'),
            callback: html => this._hangUpSelect(
              influence, rememberOptions(html),
            ),
          },
        },
      },
    ).render(true);
  }

  /**
  * Adds the chosen HangUp to the character
  * @param {HangUp[]} hangUps       An Array of the HangUps that could be picked
  * @param {Object} options         The selections from the dialog
  * @param {String[]} perkIds       The IDs from any Perk that were added with the Influence
  * @param {Influence} newInfluence The new Influence that was created
  */
  async _hangUpSelect(influence, options) {
    let selectedHangUp = null;
    let hangUpToCreate = null;
    const owner = this._actor;

    for (const [hangUp, isSelected] of Object.entries(options)) {
      if (isSelected) {
        selectedHangUp = hangUp;
        break;
      }
    }

    if (!selectedHangUp) {
      return;
    }
    const itemToCreate = await fromUuid(selectedHangUp)
    const newItem = await Item.create(itemToCreate, { parent: owner })
    newItem.setFlag('core', 'sourceId', selectedHangUp)

  }

  /**
  * Handle deleting of an Influence from an Actor Sheet
  * @param {Influence} influence The Influence
  */
  onInfluenceDelete(influence) {
    const influenceDelete = this._actor.items.get(influence._id);
    for (const [key,deletedItem] of Object.entries(influenceDelete.system.items)) {
      for (const actorItem of this._actor.items) {
        const itemSourceId = this._actor.items.get(actorItem._id).getFlag('core', 'sourceId')
        const parentId = this._actor.items.get(actorItem._id).getFlag('essence20', 'parentId')
        if (itemSourceId == deletedItem.uuid) {
          if (influence._id == parentId) {
            actorItem.delete();
          }
        }
      }
    }
  }

  /**
  * Handle deleting of an Origin from an Actor Sheet
  * @param {Object} origin The Origin
  */
  async onOriginDelete(origin) {
    let essence = this._actor.system.originEssencesIncrease;
    let essenceValue = this._actor.system.essences[essence] - 1;

    let selectedSkill = this._actor.system.originSkillsIncrease;
    const [newShift, skillString] = await getShiftedSkill(selectedSkill, -1, this._actor);
    const originDelete = this._actor.items.get(origin._id);
    for (const [key,deletedItem] of Object.entries(originDelete.system.items)) {
      for (const actorItem of this._actor.items) {
        const itemSourceId = this._actor.items.get(actorItem._id).getFlag('core', 'sourceId')
        const parentId = this._actor.items.get(actorItem._id).getFlag('essence20', 'parentId')
        if (itemSourceId == deletedItem.uuid) {
          if (origin._id == parentId) {
            actorItem.delete();
          }
        }
      }
    }

    const essenceString = `system.essences.${essence}`;

    await this._actor.update({
      [essenceString]: essenceValue,
      [skillString]: newShift,
      "system.health.max": 0,
      "system.health.value": 0,
      "system.movement.aerial.base": 0,
      "system.movement.swim.base": 0,
      "system.movement.ground.base": 0,
      "system.originEssencesIncrease": "",
      "system.originSkillsIncrease": "",
    });
  }
}
