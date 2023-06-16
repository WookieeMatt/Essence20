import {
  createItemCopies,
  getItemsOfType,
  itemDeleteById,
  rememberOptions,
  searchCompendium,
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
      if (item.type == 'influence') {
        addHangUp = true;
        break;
      }
    }

    const newInfluenceList = await dropFunc();
    const newInfluence = newInfluenceList[0];
    const perkIds = await createItemCopies(influence.system.perkIds, this._actor);

    if (addHangUp) {
      if (influence.system.hangUpIds.length > 1) {
        this._chooseHangUp(influence, perkIds, newInfluence);
      } else {
        const hangUpIds = await createItemCopies(influence.system.hangUpIds, this._actor);
        await newInfluence.update({
          ["system.perkIds"]: perkIds,
          ["system.hangUpIds"]: hangUpIds,
        });
      }
    }

    await newInfluence.update({
      ["system.perkIds"]: perkIds,
    });
  }

  /**
   * Handle the dropping of an influence on to a character
   * @param {Origin} origin     The Origin
   * @param {Function} dropFunc The function to call to complete the Origin drop
   */
  async originUpdate(origin, dropFunc) {
    for (let actorItem of this._actor.items) {
      // Characters can only have one Origin
      if (actorItem.type == 'origin') {
        ui.notifications.error(game.i18n.format(game.i18n.localize('E20.MulitpleOriginError')));
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
        const skill = influence.system.skills;
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
        const essence = CONFIG.E20.skillToEssence[influence.system.skills];
        if (options[essence] && essences.includes(essence)) {
          selectedEssence = essence;
          choices[influence.system.skills] = {
            chosen: false,
            label: CONFIG.E20.originSkills[influence.system.skills],
          };
        }
      }
    }

    if (!selectedEssence) {
      ui.notifications.warn(game.idemo8n.localize('E20.OriginSelectNoEssence'));
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
    let skillString = "";
    let currentShift = "";
    let newShift = "";

    if (selectedSkill == "initiative") {
      skillString = `system.${selectedSkill}.shift`;
      currentShift = this._actor.system[selectedSkill].shift;
      newShift = CONFIG.E20.skillShiftList[Math.max(0, (CONFIG.E20.skillShiftList.indexOf(currentShift) - 1))];
    } else if (selectedSkill == "conditioning") {
      skillString = `system.${selectedSkill}`;
      currentShift = this._actor.system[selectedSkill];
      newShift = currentShift + 1;
    } else {
      currentShift = this._actor.system.skills[selectedSkill].shift;
      skillString = `system.skills.${selectedSkill}.shift`;
      newShift = CONFIG.E20.skillShiftList[Math.max(0, (CONFIG.E20.skillShiftList.indexOf(currentShift) - 1))];
    }

    const newOriginList = await dropFunc();
    this._originPerkCreate(origin, newOriginList[0]);

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
  * Creates the Perk from the Origin on the Actor
  * @param {Origin} origin    The original Origin to get Perks from
  * @param {Origin} newOrigin The new Origin being created
  * @private
  */
  async _originPerkCreate(origin, newOrigin) {
    const perkIds = [];
    for (const id of origin.system.originPerkIds) {
      let data = game.items.get(id);
      if (!data) {
        data = searchCompendium(id);
      }

      const perk = await Item.create(data, { parent: this._actor });
      perkIds.push(perk._id);
    }

    await newOrigin.update({
      ["system.originPerkIds"]: perkIds,
    });
  }

  /**
  * Displays a dialog for selecting a Hang Up from an Influence
  * @param {Influence} influence    The Influence
  * @param {Perk[]} perkIds         The Perk IDs that go with the new Influence
  * @param {Influence} newInfluence The new Influence that was created.
  * @private
  */
  async _chooseHangUp(influence, perkIds, newInfluence) {
    const choices = {};
    let itemArray = [];
    let compendiumData = null;

    for (const id of influence.system.hangUpIds) {
      compendiumData = game.items.get(id);
      if (!compendiumData) {
        compendiumData = searchCompendium(id);
        if (compendiumData) {
          itemArray.push(compendiumData);
          choices[compendiumData._id] = {
            chosen: false,
            label: compendiumData.name,
          };
        }
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
              itemArray, rememberOptions(html), perkIds, newInfluence,
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
  async _hangUpSelect(hangUps, options, perkIds, newInfluence) {
    let selectedHangUp = null;
    const hangUpIds = [];
    let hangUpToCreate = null;

    for (const [hangUp, isSelected] of Object.entries(options)) {
      if (isSelected) {
        selectedHangUp = hangUp;
        break;
      }
    }

    if (!selectedHangUp) {
      return;
    }

    for (const item of hangUps) {
      if (item._id == selectedHangUp) {
        hangUpToCreate = item;
      }
    }

    const newHangUp = await Item.create(hangUpToCreate, { parent: this._actor });
    hangUpIds.push(newHangUp._id);
    await newInfluence.update({
      ["system.perkIds"]: perkIds,
      ["system.hangUpIds"]: hangUpIds,
    });
  }

  /**
  * Handle deleting of an Influence from an Actor Sheet
  * @param {Influence} influence The Influence
  */
  onInfluenceDelete(influence) {
    const influenceDelete = this._actor.items.get(influence._id);

    for (const perk of influenceDelete.system.perkIds) {
      if (perk) {
        itemDeleteById(perk, this._actor);
      }
    }

    for (const hangUp of influenceDelete.system.hangUpIds) {
      itemDeleteById(hangUp, this._actor);
    }
  }

  /**
  * Handle deleting of an Origin from an Actor Sheet
  * @param {Object} origin The Origin
  */
  async onOriginDelete(origin) {
    let essence = this._actor.system.originEssencesIncrease;
    let essenceValue = this._actor.system.essences[essence] - 1;

    let skillString = "";
    let currentShift = "";
    let newShift = "";

    let selectedSkill = this._actor.system.originSkillsIncrease;
    if (selectedSkill == "initiative") {
      skillString = `system.${selectedSkill}.shift`;
      currentShift = this._actor.system[selectedSkill].shift;
      newShift = CONFIG.E20.skillShiftList[Math.max(0, (CONFIG.E20.skillShiftList.indexOf(currentShift) + 1))];
    } else if (selectedSkill == "conditioning") {
      skillString = `system.${selectedSkill}`;
      currentShift = this._actor.system[selectedSkill];
      newShift = currentShift - 1;
    } else {
      currentShift = this._actor.system.skills[selectedSkill].shift;
      skillString = `system.skills.${selectedSkill}.shift`;
      newShift = CONFIG.E20.skillShiftList[Math.max(0, (CONFIG.E20.skillShiftList.indexOf(currentShift) + 1))];
    }

    const originDelete = this._actor.items.get(origin._id);
    for (const perk of originDelete.system.originPerkIds) {
      itemDeleteById(perk, this._actor);
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
