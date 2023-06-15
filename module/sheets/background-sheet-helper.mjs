import {
  createItemCopies,
  getItemsOfType,
  itemDeleteById,
  rememberOptions,
  searchCompendium
} from "../helpers/utils.mjs";

/**
* Creates the Perk from the Origin on the Actor
* @param {Origin} origin    The original Origin to get Perks from
* @param {Origin} newOrigin The new Origin being created
* @param {Actor} owner      The Origin's owner
*/
export async function originPerkCreate(origin, newOrigin, owner) {
  const perkIds = [];
  for (const id of origin.system.originPerkIds) {
    let data = game.items.get(id);
    if (!data) {
      data = searchCompendium(id);
    }

    const perk = await Item.create(data, { parent: owner });
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
* @param {Actor} owner            The HangUps' owner
*/
export async function chooseHangUp(influence, perkIds, newInfluence, owner) {
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
          callback: html => hangUpSelect(
            itemArray, rememberOptions(html), perkIds, newInfluence, owner,
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
* @param {Actor} owner            The HangUps' owner
*/
export async function hangUpSelect(hangUps, options, perkIds, newInfluence, owner) {
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

  const newHangUp = await Item.create(hangUpToCreate, { parent: owner });
  hangUpIds.push(newHangUp._id);
  await newInfluence.update({
    ["system.perkIds"]: perkIds,
    ["system.hangUpIds"]: hangUpIds,
  });
}

/**
* Handle deleting of an Influence from an Actor Sheet
* @param {Influence} influence The Influence
* @param {Actor} owner         The Influence's owner
*/
export function onInfluenceDelete(influence, owner) {
  const influenceDelete = owner.items.get(influence._id);

  for (const perk of influenceDelete.system.perkIds) {
    if (perk) {
      itemDeleteById(perk, owner);
    }
  }

  for (const hangUp of influenceDelete.system.hangUpIds) {
    itemDeleteById(hangUp, owner);
  }
}

/**
* Handle deleting of an Origin from an Actor Sheet
* @param {Object} origin The Origin
* @param {Actor} owner   The Origin's owner
*/
export async function onOriginDelete(origin, owner) {
  let essence = owner.system.originEssencesIncrease;
  let essenceValue = owner.system.essences[essence] - 1;

  let skillString = "";
  let currentShift = "";
  let newShift = "";

  let selectedSkill = owner.system.originSkillsIncrease;
  if (selectedSkill == "initiative") {
    skillString = `system.${selectedSkill}.shift`;
    currentShift = owner.system[selectedSkill].shift;
    newShift = CONFIG.E20.skillShiftList[Math.max(0, (CONFIG.E20.skillShiftList.indexOf(currentShift) + 1))];
  } else if (selectedSkill == "conditioning") {
    skillString = `system.${selectedSkill}`;
    currentShift = owner.system[selectedSkill];
    newShift = currentShift - 1;
  } else {
    currentShift = owner.system.skills[selectedSkill].shift;
    skillString = `system.skills.${selectedSkill}.shift`;
    newShift = CONFIG.E20.skillShiftList[Math.max(0, (CONFIG.E20.skillShiftList.indexOf(currentShift) + 1))];
  }

  const originDelete = owner.items.get(origin._id);
  for (const perk of originDelete.system.originPerkIds) {
    itemDeleteById(perk, owner);
  }

  const essenceString = `system.essences.${essence}`;

  await owner.update({
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


/**
 * Handle the dropping of an influence on to a character
 * @param {Influence} influence The Influence
 * @param {Function} dropFunc   The function to call to complete the Influence drop
 * @param {Actor} owner         The Influence's owner
 */
export async function influenceUpdate(influence, dropFunc, owner) {
  let addHangUp = false;

  for (const item of owner.items) {
    if (item.type == 'influence') {
      addHangUp = true;
      break;
    }
  }

  const newInfluenceList = await dropFunc();
  const newInfluence = newInfluenceList[0];
  const perkIds = await createItemCopies(influence.system.perkIds, owner);

  if (addHangUp) {
    if (influence.system.hangUpIds.length > 1) {
      chooseHangUp(influence, perkIds, newInfluence, owner);
    } else {
      const hangUpIds = await createItemCopies(influence.system.hangUpIds, owner);
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
* Updates the actor with the information selected for the Origin
* @param {Object} origin     The Origin
* @param {Object} options    The options resulting from _showOriginSkillDialog()
* @param {Object} essence    The essence selected in the _showOriginEssenceDialog()
* @param {Function} dropFunc The function to call to complete the Origin drop
* @param {Actor} owner       The Origin's owner
*/
export async function originStatUpdate(origin, essence, options, dropFunc, owner) {
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

  const essenceValue = owner.system.essences[essence] + 1;
  const essenceString = `system.essences.${essence}`;
  let skillString = "";
  let currentShift = "";
  let newShift = "";

  if (selectedSkill == "initiative") {
    skillString = `system.${selectedSkill}.shift`;
    currentShift = owner.system[selectedSkill].shift;
    newShift = CONFIG.E20.skillShiftList[Math.max(0, (CONFIG.E20.skillShiftList.indexOf(currentShift) - 1))];
  } else if (selectedSkill == "conditioning") {
    skillString = `system.${selectedSkill}`;
    currentShift = owner.system[selectedSkill];
    newShift = currentShift + 1;
  } else {
    currentShift = owner.system.skills[selectedSkill].shift;
    skillString = `system.skills.${selectedSkill}.shift`;
    newShift = CONFIG.E20.skillShiftList[Math.max(0, (CONFIG.E20.skillShiftList.indexOf(currentShift) - 1))];
  }

  const newOriginList = await dropFunc();
  originPerkCreate(origin, newOriginList[0], owner);

  await owner.update({
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
 * Displays a dialog for selecting a Skill for the given Origin.
 * @param {Object} origin     The Origin
 * @param {Object} options    The options resulting from _showOriginEssenceDialog()
 * @param {Function} dropFunc The function to call to complete the Origin drop
 * @param {Actor} owner       The Origin's owner
 */
export async function showOriginSkillDialog(origin, options, dropFunc, owner) {
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

  const influences = await getItemsOfType("influence", owner.items);
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
          callback: html => originStatUpdate(
            origin, selectedEssence, rememberOptions(html), dropFunc, owner,
          ),
        },
      },
    },
  ).render(true);
}


/**
 * Displays a dialog for selecting an Essence for the given Origin.
 * @param {Object} origin     The Origin
 * @param {Function} dropFunc The function to call to complete the Origin drop
 * @param {Actor} owner       The Origin's owner
 */
export async function showOriginEssenceDialog(origin, dropFunc, owner) {
  const choices = {};
  for (const essence of origin.system.essences) {
    choices[essence] = {
      chosen: false,
      label: CONFIG.E20.originEssences[essence],
    };
  }

  const influences = await getItemsOfType("influence", owner.items);
  for (const influence of influences) {
    if (influence.system.skills.length) {
      const skill = influence.system.skills;
      for (const influenceEssence in owner.system.skills[skill].essences) {
        if (owner.system.skills[skill].essences[influenceEssence]) {
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
          callback: html => showOriginSkillDialog(origin, rememberOptions(html), dropFunc, owner),
        },
      },
    },
  ).render(true);
}
