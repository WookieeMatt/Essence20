import { rememberOptions } from "../helpers/dialog.mjs";
import { getItemsOfType, getShiftedSkill } from "../helpers/utils.mjs";
import { createItemCopies, deleteAttachmentsForItem } from "./attachment-handler.mjs";

/**
 * Handle the dropping of an influence on to a character
 * @param {Actor} actor The Actor with the Influence
 * @param {Influence} influence The Influence being updated
 * @param {Function} dropFunc The function to call to complete the Influence drop
 */
export async function influenceUpdate(actor, influence, dropFunc) {
  let addHangUp = false;

  for (const item of actor.items) {
    if (item.type == 'influence' || influence.system.mandatoryHangUp) {
      addHangUp = true;
      break;
    }
  }

  const newInfluenceList = await dropFunc();
  await createItemCopies(influence.system.items, actor, "perk", newInfluenceList[0]);

  if (addHangUp) {
    const hangUpIds = [];
    for (const [, item] of Object.entries(influence.system.items)) {
      if (item.type == 'hangUp') {
        hangUpIds.push(item.uuid);
      }
    }

    if (hangUpIds.length > 1) {
      _chooseHangUp(actor, influence);
    } else {
      await createItemCopies(influence.system.items, actor, "hangUp", newInfluenceList[0]);
    }
  }
}

/**
 * Handle the dropping of an Origin on to a character
 * @param {Actor} actor The Actor receiving the Origin
 * @param {Origin} origin The Origin being dropped
 * @param {Function} dropFunc The function to call to complete the Origin drop
 */
export async function originUpdate(actor, origin, dropFunc) {
  if (!origin.system.essences.length) {
    ui.notifications.error(game.i18n.format(game.i18n.localize('E20.OriginNoEssenceError')));
    return false;
  }

  for (let actorItem of actor.items) {
    // Characters can only have one Origin
    if (actorItem.type == 'origin') {
      ui.notifications.error(game.i18n.format(game.i18n.localize('E20.OriginMulitpleError')));
      return false;
    }
  }

  await _showOriginEssenceDialog(actor, origin, dropFunc);
}

/**
 * Displays a dialog for selecting an Essence for the given Origin.
 * @param {Actor} actor The Actor receiving the Origin
 * @param {Object} origin The Origin being dropped
 * @param {Function} dropFunc The function to call to complete the Origin drop
 */
async function _showOriginEssenceDialog(actor, origin, dropFunc) {
  const choices = {};
  for (const essence of origin.system.essences) {
    choices[essence] = {
      chosen: false,
      label: CONFIG.E20.originEssences[essence],
    };
  }

  const influences = getItemsOfType("influence", actor.items);
  for (const influence of influences) {
    if (influence.system.skills.length) {
      for (const skill of influence.system.skills) {
        for (const influenceEssence in actor.system.skills[skill].essences) {
          if (actor.system.skills[skill].essences[influenceEssence]) {
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
          callback: html => _showOriginSkillDialog(actor, origin, rememberOptions(html), dropFunc),
        },
      },
    },
  ).render(true);
}

/**
 * Displays a dialog for selecting a Skill for the given Origin.
 * @param {Actor} actor The Actor receiving the Origin
 * @param {Object} origin The Origin being dropped
 * @param {Object} options The options resulting from _showOriginEssenceDialog()
 * @param {Function} dropFunc The function to call to complete the Origin drop
 */
async function _showOriginSkillDialog(actor, origin, options, dropFunc) {
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

  const influences = getItemsOfType("influence", actor.items);
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
          callback: html => _checkForAltModes(
            actor, origin, selectedEssence, rememberOptions(html), dropFunc,
          ),
        },
      },
    },
  ).render(true);
}

/**
 * Determine if the Origin has an altMode and if there is more than one and a selection needs to be made.
 * @param {Actor} actor The Actor receiving the Origin
 * @param {Origin} origin The Origin being dropped
 * @param {String} essence The essence selected in the _showOriginEssenceDialog()
 * @param {Object} options The options resulting from _showOriginSkillDialog()
 * @param {Function} dropFunc The function to call to complete the Origin drop
 */

export async function _checkForAltModes(actor, origin, essence, options, dropFunc) {
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

  const choices = {};
  const altModes = getItemsOfType('altMode', Object.values(origin.system.items));

  if (altModes.length > 1) {
    for (const altMode of altModes) {
      choices[altMode.name] = {
        chosen: false,
        label: altMode.name,
      };
    }

    new Dialog(
      {
        title: game.i18n.localize('E20.OriginAltModeSelect'),
        content: await renderTemplate("systems/essence20/templates/dialog/option-select.hbs", {
          choices,
        }),
        buttons: {
          save: {
            label: game.i18n.localize('E20.AcceptButton'),
            callback: html => setOriginValues(
              actor, origin, essence, selectedSkill, dropFunc, rememberOptions(html),
            ),
          },
        },
      },
    ).render(true);
  } else {
    setOriginValues(actor, origin, essence, selectedSkill, dropFunc);
  }
}

/**
 * Updates the actor with the information selected for the Origin
 * @param {Actor} actor The Actor receiving the Origin
 * @param {Origin} origin The Origin being dropped
 * @param {String} essence The essence selected in the _showOriginEssenceDialog()
 * @param {String} skill the skill selected in the _showOriginSkillEssenceDialog()
 * @param {Function} dropFunc The function to call to complete the Origin drop
 * @param {Object} options The options resulting from _checkForAltModes()
 */
export async function setOriginValues(actor, origin, essence, skill, dropFunc, options) {
  let selectedAltMode = "";
  if (options) {
    for (const [altMode, isSelected] of Object.entries(options)) {
      if (isSelected) {
        selectedAltMode = altMode;
        break;
      }
    }

    if (!selectedAltMode) {
      ui.notifications.warn(game.i18n.localize('E20.OriginSelectNoAltMode'));
      return;
    }
  }

  let altModeToCreate = null;
  for (const [, item] of Object.entries(origin.system.items)) {
    if (item.type == "altMode") {
      if (selectedAltMode) {
        if (selectedAltMode == item.name) {
          altModeToCreate = item;
        }
      } else {
        altModeToCreate = item;
      }
    }
  }

  const essenceValue = actor.system.essences[essence] + 1;
  const essenceString = `system.essences.${essence}`;

  const [newShift, skillString] = getShiftedSkill(skill, 1, actor);

  const newOriginList = await dropFunc();
  await createItemCopies(origin.system.items, actor, "perk", newOriginList[0]);

  if (altModeToCreate) {
    const itemToCreate = await fromUuid(altModeToCreate.uuid);
    const newItem = await Item.create(itemToCreate, { parent: actor });
    if (newItem.type == "altMode") {
      await actor.update({
        "system.canTransform": true,
      });
    }

    newItem.setFlag('core', 'sourceId', itemToCreate.uuid);
    newItem.setFlag('essence20', 'parentId', newOriginList[0]._id);
  }

  await actor.update({
    [essenceString]: essenceValue,
    [skillString]: newShift,
    "system.health.max": origin.system.startingHealth,
    "system.health.value": origin.system.startingHealth,
    "system.movement.aerial.base": origin.system.baseAerialMovement,
    "system.movement.swim.base": origin.system.baseAquaticMovement,
    "system.movement.ground.base": origin.system.baseGroundMovement,
    "system.originEssencesIncrease": essence,
    "system.originSkillsIncrease": skill,
  });
}

/**
 * Displays a dialog for selecting a Hang Up from an Influence
 * @param {Actor} actor The Actor receiving the Influence
 * @param {Influence} influence The Influence being dropped
 * @private
 */
async function _chooseHangUp(actor, influence) {
  const choices = {};
  let itemArray = [];

  for (const [, item] of Object.entries(influence.system.items)) {
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
          callback: html => _hangUpSelect(
            actor, influence, rememberOptions(html),
          ),
        },
      },
    },
  ).render(true);
}

/**
 * Adds the chosen HangUp to the character
 * @param {Actor} actor The Actor receiving the HangUp
 * @param {Object} options The selections from the dialog
 */
async function _hangUpSelect(actor, options) {
  let selectedHangUp = null;
  const owner = actor;

  for (const [hangUp, isSelected] of Object.entries(options)) {
    if (isSelected) {
      selectedHangUp = hangUp;
      break;
    }
  }

  if (!selectedHangUp) {
    return;
  }

  const itemToCreate = await fromUuid(selectedHangUp);
  const newItem = await Item.create(itemToCreate, { parent: owner });
  newItem.setFlag('core', 'sourceId', selectedHangUp);
}

/**
 * Handle deleting of an Origin from an Actor Sheet
 * @param {Actor} actor The Actor with the Origin
 * @param {Object} origin The Origin being deleted
 */
export async function onOriginDelete(actor, origin) {
  let essence = actor.system.originEssencesIncrease;
  let essenceValue = actor.system.essences[essence] - 1;

  let selectedSkill = actor.system.originSkillsIncrease;
  const [newShift, skillString] = getShiftedSkill(selectedSkill, -1, actor);
  await deleteAttachmentsForItem(origin, actor);

  const hasAltMode = !!getItemsOfType("altMode", actor.items).length;

  const essenceString = `system.essences.${essence}`;

  await actor.update({
    [essenceString]: essenceValue,
    [skillString]: newShift,
    "system.canTransform": hasAltMode,
    "system.health.max": 0,
    "system.health.value": 0,
    "system.movement.aerial.base": 0,
    "system.movement.swim.base": 0,
    "system.movement.ground.base": 0,
    "system.originEssencesIncrease": "",
    "system.originSkillsIncrease": "",
  });
}
