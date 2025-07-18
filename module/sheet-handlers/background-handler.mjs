import ChoicesSelector from "../apps/choices-selector.mjs";
import { getItemsOfType, getShiftedSkill } from "../helpers/utils.mjs";
import { createItemCopies, deleteAttachmentsForItem } from "./attachment-handler.mjs";

/**
 * Handle the dropping of an influence on to a character
 * @param {Actor} actor The Actor with the Influence
 * @param {Influence} influence The Influence being updated
 * @param {Function} dropFunc The function to call to complete the Influence drop
 */
export async function onInfluenceDrop(actor, influence, dropFunc) {
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
      _chooseHangUp(actor, influence, newInfluenceList[0]);
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
export async function onOriginDrop(actor, origin, dropFunc) {
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

  await _showOriginEssencePrompt(actor, origin, dropFunc);
}

/**
 * Displays a prompt for selecting an Essence for the given Origin.
 * @param {Actor} actor The Actor receiving the Origin
 * @param {Object} origin The Origin being dropped
 * @param {Function} dropFunc The function to call to complete the Origin drop
 */
async function _showOriginEssencePrompt(actor, origin, dropFunc) {
  const choices = {};
  for (const essence of origin.system.essences) {
    choices[essence] = {
      chosen: false,
      value: essence,
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
              value: influenceEssence,
              label: CONFIG.E20.originEssences[influenceEssence],
            };
          }
        }
      }
    }
  }

  const prompt = "E20.SelectEssence";
  const title = "E20.SelectOriginEssence";
  new ChoicesSelector(choices, actor, prompt, title, origin, null, dropFunc, null, null, null).render(true);
}

/**
 * Displays a prompt for selecting a Skill for the given Origin.
 * @param {Actor} actor The Actor receiving the Origin
 * @param {Object} origin The Origin being dropped
 * @param {String} selectedEssence The essence selected from _showOriginEssencePrompt()
 * @param {Function} dropFunc The function to call to complete the Origin drop
 */
export async function _showOriginSkillPrompt(actor, origin, selectedEssence, dropFunc) {
  if (!selectedEssence) {
    ui.notifications.error(game.i18n.localize('E20.OriginSelectNoEssence'));
    return;
  }

  const choices = {};
  for (const skill of origin.system.skills) {
    const essence = CONFIG.E20.skillToEssence[skill];
    if (selectedEssence == essence) {
      choices[skill] = {
        chosen: false,
        label: CONFIG.E20.originSkills[skill],
        value: skill,
      };
    }
  }

  const influences = getItemsOfType("influence", actor.items);
  for (const influence of influences) {
    if (influence.system.skills) {
      for (const skill of influence.system.skills) {
        const essence = CONFIG.E20.skillToEssence[skill];
        if (selectedEssence == essence) {
          choices[skill] = {
            chosen: false,
            label: CONFIG.E20.originSkills[skill],
            value: skill,
          };
        }
      }
    }
  }

  const prompt = "E20.SelectSkill";
  const title = "E20.SelectOriginSkill";
  new ChoicesSelector(choices, actor, prompt, title, origin, null, dropFunc, null, selectedEssence, null).render(true);
}

/**
 * Determine if the Origin has an altMode and if there is more than one and a selection needs to be made.
 * @param {Actor} actor The Actor receiving the Origin
 * @param {Origin} origin The Origin being dropped
 * @param {String} essence The essence selected in the _showOriginEssencePrompt()
 * @param {String} selectedSkill The skill selected from _showOriginSkillPrompt()
 * @param {Function} dropFunc The function to call to complete the Origin drop
 */

export async function _checkForAltModes(actor, origin, essence, selectedSkill, dropFunc) {
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
        img: altMode.img,
        label: altMode.name,
        uuid: altMode.uuid,
        value: altMode.name,
      };
    }

    const prompt = "E20.SelectAltMode";
    const title = "E20.SelectOriginAltMode";
    new ChoicesSelector(choices, actor, prompt, title, origin, null, dropFunc, null, essence, selectedSkill).render(true);
  } else {
    setOriginValues(actor, origin, essence, selectedSkill, dropFunc);
  }
}

/**
 * Updates the actor with the information selected for the Origin
 * @param {Actor} actor The Actor receiving the Origin
 * @param {Origin} origin The Origin being dropped
 * @param {String} essence The essence selected in the _showOriginEssencePrompt()
 * @param {String} skill the skill selected in the _showOriginSkillEssencePrompt()
 * @param {Function} dropFunc The function to call to complete the Origin drop
 * @param {String} selectedAltMode The selected altMode resulting from _checkForAltModes()
 */
export async function setOriginValues(actor, origin, essence, skill, dropFunc, selectedAltMode) {
  const altModes = getItemsOfType('altMode', Object.values(origin.system.items));
  let altModeToCreate = null;

  if (altModes.length > 0) {
    for (const altMode of altModes) {
      if (selectedAltMode) {
        if (selectedAltMode == altMode.name) {
          altModeToCreate = altMode;
        }
      } else {
        altModeToCreate = altMode;
      }
    }

    if (!altModeToCreate) {
      ui.notifications.warn(game.i18n.localize('E20.OriginSelectNoAltMode'));
      return;
    }
  }

  const essenceValue = actor.system.essences[essence].max + 1;
  const essenceString = `system.essences.${essence}.max`;

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
 * Displays a Prompt for selecting a Hang Up from an Influence
 * @param {Actor} actor The Actor receiving the Influence
 * @param {Influence} influence The Influence being dropped
 * @param {Object} newInfluence The new Influence created as part of the drop
 * @private
 */
async function _chooseHangUp(actor, influence, newInfluence) {
  const choices = {};
  let itemArray = [];
  for (const [, item] of Object.entries(influence.system.items)) {
    if (item.type == 'hangUp') {
      itemArray.push(item);
      choices[item.uuid] = {
        chosen: false,
        img: item.img,
        label: item.name,
        uuid: item.uuid,
        value: item.uuid,
      };
    }
  }

  const prompt = "E20.SelectHangUp";
  const title = "E20.SelectInfluenceHangUp";
  new ChoicesSelector (choices, actor, prompt, title, influence, null, null, newInfluence, null, null).render(true);
}

/**
 * Adds the chosen HangUp to the character
 * @param {Actor} actor The Actor receiving the HangUp
 * @param {String} uuid The uuid of the item selected from the choice-prompt application
 * @param {Object} parentItem The new Influence created as part of the drop
 */
export async function _hangUpSelect(actor, uuid, parentItem) {

  const itemToCreate = await fromUuid(uuid);
  const newItem = await Item.create(itemToCreate, { parent: actor });
  newItem.setFlag('core', 'sourceId', uuid);
  newItem.setFlag('essence20', 'parentId', parentItem._id);
}

/**
 * Handle deleting of an Origin from an Actor Sheet
 * @param {Actor} actor The Actor with the Origin
 * @param {Object} origin The Origin being deleted
 */
export async function onOriginDelete(actor, origin) {
  let essence = actor.system.originEssencesIncrease;
  let essenceValue = actor.system.essences[essence].max - 1;

  let selectedSkill = actor.system.originSkillsIncrease;
  const [newShift, skillString] = getShiftedSkill(selectedSkill, -1, actor);
  await deleteAttachmentsForItem(origin, actor);

  const hasAltMode = !!getItemsOfType("altMode", actor.items).length;

  const essenceString = `system.essences.${essence}.max`;

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
