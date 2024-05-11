import { rememberOptions, rememberSelect } from "../helpers/dialog.mjs";
import {
  deleteAttachmentsForItem,
  getItemsOfType,
  roleValueChange,
  setFocusValues,
  setRoleValues,
} from "../helpers/utils.mjs";

/**
 * Handles dropping a Focus on an Actor.
 * @param {Actor} actor The Actor receiving the Focus
 * @param {Focus} focus The Focus that is being dropped on the Actor
 * @param {Function} dropFunc The drop function that will be used to complete the drop of the Focus
 * @returns
 */
export async function focusUpdate(actor, focus, dropFunc) {
  if (!focus.system.essences.length) {
    ui.notifications.error(game.i18n.format(game.i18n.localize('E20.FocusNoEssenceError')));
    return false;
  }

  const hasFocus = getItemsOfType("focus", actor.items).length > 0;
  const role = getItemsOfType("role", actor.items);
  const attachedRole = [];

  for (const [, item] of Object.entries(focus.system.items)) {
    if (item.type == "role") {
      attachedRole.push(item);
    }
  }

  // Actors can only have one Focus
  if (hasFocus) {
    ui.notifications.error(game.i18n.localize('E20.FocusMultipleError'));
    return false;
  }

  if (!role[0]) {
    ui.notifications.error(game.i18n.localize('E20.FocusNoRoleError'));
    return false;
  }

  if (role[0].flags.core.sourceId != attachedRole[0].uuid) {
    ui.notifications.error(game.i18n.localize('E20.FocusRoleMismatchError'));
    return false;
  }

  if (focus.system.essences.length > 1) {
    await _showEssenceDialog(actor, focus, dropFunc);
  } else {
    const newFocusList = await dropFunc();
    const newFocus = newFocusList[0];
    await actor.update({
      "system.focusEssence": newFocus.system.essences[0],
    });
    await setFocusValues(newFocus, actor);
  }
}

/**
 * Handles selecting an Essence when the Focus has more then one.
 * @param {Actor} actor The Actor receiving the Focus
 * @param {Focus} focus The Focus that is being dropped on the Actor
 * @param {Function} dropFunc The drop function that will be used to complete the drop of the Focus
 */
async function _showEssenceDialog(actor, focus, dropFunc) {
  const choices = {};
  for (const essence of focus.system.essences) {
    choices[essence] = {
      chosen: false,
      label: CONFIG.E20.originEssences[essence],
    };
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
          callback: html => _focusStatUpdate(actor, rememberOptions(html), dropFunc),
        },
      },
    },
  ).render(true);
}

/**
 * Handles writing the selected Essence to the Actor.
 * @param {Actor} actor The Actor receiving the Focus
 * @param {Object} options The options resulting from _showFocusSkillDialog()
 * @param {Function} dropFunc The drop function that will be used to complete the drop of the Focus
 */
async function _focusStatUpdate(actor, options, dropFunc) {
  let selectedEssence = "";
  for (const essence in CONFIG.E20.essences) {
    if (options[essence]) {
      selectedEssence = essence;
    }
  }

  const newFocusList = await dropFunc();
  const newFocus = newFocusList[0];

  await actor.update({
    "system.focusEssence": selectedEssence,
  });
  await setFocusValues(newFocus, actor);
}

/**
 * Handles deleting a focus from an actor.
 * @param {Actor} actor The Actor deleting the Focus
 * @param {Focus} focus The Focus that is being deleted from the Actor
 */
export async function onFocusDelete(actor, focus) {
  const previousLevel = actor.getFlag('essence20', 'previousLevel');
  const totalDecrease = roleValueChange(0, focus.system.essenceLevels, previousLevel);
  const essenceValue = Math.max(0, actor.system.essences[actor.system.focusEssence] + totalDecrease);
  const essenceString = `system.essences.${actor.system.focusEssence}`;

  await actor.update({
    [essenceString]: essenceValue,
    "system.focusEssence": null,
  });

  deleteAttachmentsForItem(focus, actor);
}

/**
 * Handles dropping a Role onto an Actor.
 * @param {Actor} actor The Actor receiving the Role
 * @param {Role} role The Role being dropped
 * @param {Function} dropFunc The drop Function that will be used to complete the drop of the Role
 */
export async function roleUpdate(actor, role, dropFunc) {
  // Actors can only have one Role
  const hasRole = getItemsOfType("role", actor.items).length > 0;
  if (hasRole) {
    ui.notifications.error(game.i18n.localize('E20.RoleMultipleError'));
    return false;
  }

  if (role.system.skillDie.isUsed && !role.system.skillDie.name) {
    ui.notifications.error(game.i18n.localize('E20.RoleSkillDieError'));
    return false;
  }

  actor.setFlag('essence20', 'previousLevel', actor.system.level);
  actor.setFlag('essence20', 'roleDrop', true);

  if (role.system.skillDie.isUsed) {
    const skillName = "roleSkillDie";
    const skillStringShift = `system.skills.${skillName}.shift`;
    const skillStringDisplayName = `system.skills.${skillName}.displayName`;
    const skillStringEdge = `system.skills.${skillName}.edge`;
    const skillStringEssencesSmarts = `system.skills.${skillName}.essences.smarts`;
    const skillStringEssencesSocial = `system.skills.${skillName}.essences.social`;
    const skillStringEssencesSpeed = `system.skills.${skillName}.essences.speed`;
    const skillStringEssencesSrength = `system.skills.${skillName}.essences.strength`;
    const skillStringIsSpecialized = `system.skills.${skillName}.isSpecialized`;
    const skillStringModifier = `system.skills.${skillName}.modifier`;
    const skillStringSnag = `system.skills.${skillName}.snag`;
    const skillStringShiftUp = `system.skills.${skillName}.shiftUp`;
    const skillStringShiftDown = `system.skills.${skillName}.shiftDown`;

    await actor.update({
      [skillStringShift]: "d2",
      [skillStringEssencesSmarts] : false,
      [skillStringEssencesSocial] : false,
      [skillStringEssencesSpeed] : false,
      [skillStringEssencesSrength] : false,
      [skillStringEdge] : false,
      [skillStringSnag] : false,
      [skillStringShiftUp] : 0,
      [skillStringShiftDown] : 0,
      [skillStringIsSpecialized] : false,
      [skillStringModifier] : 0,
      [skillStringDisplayName] : role.system.skillDie.name,
    });
  }

  if (role.system.version == 'myLittlePony') {
    await _selectEssenceProgression(actor, role, dropFunc);
  } else if (role.system.hasSpecialAdvancement) {
    await _selectFirstEssences(actor, role, dropFunc);
  } else {
    const newRoleList = await dropFunc();
    const newRole = newRoleList[0];
    await setRoleValues(newRole, actor);
  }
}

/**
 * Handles deleting the Role and Role features that are on the Actor.
 * @param {Actor} actor The Actor whose Role is being deleted
 * @param {Role} role The Role that is being deleted on the Actor
 */
export async function onRoleDelete(actor, role) {
  const previousLevel = actor.getFlag('essence20', 'previousLevel');
  const focus = getItemsOfType("focus", actor.items);

  for (const essence in role.system.essenceLevels) {
    const totalDecrease = roleValueChange(0, role.system.essenceLevels[essence], previousLevel);
    const essenceValue = Math.max(0, actor.system.essences[essence] + totalDecrease);
    const essenceString = `system.essences.${essence}`;

    await actor.update({
      [essenceString]: essenceValue,
    });
  }

  if (role.system.powers.personal.starting) {
    const totalDecrease = roleValueChange(0, role.system.powers.personal.levels, previousLevel);
    const newPersonalPowerMax = Math.max(0, parseInt(actor.system.powers.personal.max) - role.system.powers.personal.starting + (role.system.powers.personal.increase * totalDecrease));

    await actor.update({
      "system.powers.personal.max": newPersonalPowerMax,
      "system.powers.personal.regeneration": 0,
    });
  }

  if (role.system.skillDie.isUsed) {
    const skillName = "roleSkillDie";
    const skillString = `system.skills.-=${skillName}`;

    await actor.update({[skillString] : null});
  }

  if (role.system.adjustments.health.length) {
    const totalDecrease = roleValueChange(0, role.system.adjustments.health, previousLevel);
    const newHealthBonus = Math.max(0, actor.system.health.bonus + totalDecrease);

    await actor.update({
      "system.health.bonus": newHealthBonus,
    });
  }

  if (focus[0]) {
    await this.onFocusDelete(focus[0]);
    await focus[0].delete();
  }

  if (role.system.version == 'myLittlePony' || role.system.hasSpecialAdvancement) {
    await actor.update({
      "system.essenceRanks.smarts": null,
      "system.essenceRanks.social": null,
      "system.essenceRanks.speed": null,
      "system.essenceRanks.strength": null,
    });
  }

  deleteAttachmentsForItem(role, actor);
  actor.setFlag('essence20', 'previousLevel', 0);
}

/**
 * Handles display the dialog to select Essences during a Role drop.
 * @param {Actor} actor The Actor receiving the Role
 * @param {Role} role The Role that is being dropped on the Actor
 * @param {Function} dropFunc The drop function that will be used to complete the drop of the Role
 */
async function _selectFirstEssences(actor, role, dropFunc) {
  const choices = {};
  for (const essence in CONFIG.E20.originEssences) {
    choices[essence] = {
      chosen: false,
      label: CONFIG.E20.originEssences[essence],
    };
  }

  new Dialog(
    {
      title: game.i18n.localize('E20.EssenceIncrease'),
      content: await renderTemplate("systems/essence20/templates/dialog/multi-select-essence.hbs", {
        choices,
      }),
      buttons: {
        save: {
          label: game.i18n.localize('E20.AcceptButton'),
          callback: html => {
            _verifySelection(rememberOptions(html)),
            _selectEssenceProgression(actor, role, dropFunc, rememberOptions(html));
          },
        },
      },
    },
  ).render(true);

}

/**
 * Displays an error to the user if invalid Essence dialog selections were made.
 * @param {Object} options The options selected in the previous dialog
 */
function _verifySelection(options) {
  let selectionAmount = 0;
  for (const [, selection] of Object.entries(options)) {
    if (selection == true) {
      selectionAmount += 1;
    }
  }

  if (selectionAmount != 2) {
    throw new Error(game.i18n.localize("E20.EssencesRequiredError"));
  }

  return;
}

/**
 * Handles the selection of the Essence progression Ranks.
 * @param {Actor} actor The Actor receiving the Role
 * @param {Object} role The Role that was dropped on the Actor
 * @param {Function} dropFunc The drop function that will be used to complete the drop of the Role
 */
async function _selectEssenceProgression(actor, role, dropFunc, level1Essences) {
  const choices = {};
  let rankNames = "";
  if (role.system.version == "transformers") {
    rankNames = CONFIG.E20.TFEssenceRankNames;
  } else {
    rankNames = CONFIG.E20.EssenceRankNames;
  }

  for (const rankName of rankNames) {
    choices[rankName] = {
      chosen: false,
      key: rankName,
      label: game.i18n.localize(`E20.EssenceRank${rankName.capitalize()}`),
    };
  }

  new Dialog(
    {
      title: game.i18n.localize('E20.EssenceProgressionSelect'),
      content: await renderTemplate("systems/essence20/templates/dialog/essence-select.hbs", {
        choices,
      }),
      buttons: {
        save: {
          label: game.i18n.localize('E20.AcceptButton'),
          callback: (html) => {
            _verifyEssenceProgression(rememberSelect(html));
            _setEssenceProgression(actor, rememberSelect(html), role, dropFunc, level1Essences);
          },
        },
      },
    },
  ).render(true);
}

/**
 * Handles verifying that all of the Essences have a different Rank.
 * @param {Object} options The selections made in the dialog window
 * @returns {Boolean} True if all of the Essences have a different rank and false otherwise
 */
function _verifyEssenceProgression(options) {
  const rankArray = [];
  for (const [, rank] of Object.entries(options)) {
    rankArray.push(rank);
  }

  const isUnique = rankArray.length === new Set(rankArray).size;
  if (!isUnique) {
    throw new Error('Selections must be unique');
  }

  return isUnique;
}

/**
 * Handles setting the values of what was selected in the Essence selection dialog.
 * @param {Object} options The selections made in the dialog window
 * @param {Role} role The Role that was dropped on the Actor
 * @param {Function} dropFunc The drop function that will be used to complete the drop of the Role
 */
async function _setEssenceProgression(actor, options, role, dropFunc, level1Essences) {
  const newRoleList = await dropFunc();
  const newRole = newRoleList[0];

  for (const[essence, rank] of Object.entries(options)) {
    const essenceString = `system.essenceLevels.${essence}`;
    const essenceRankString = `system.essenceRanks.${essence}`;
    let rankValue = [];
    if (role.system.version == "transformers"){
      rankValue = CONFIG.E20.TFSpecialAdvancement[rank];
      if (level1Essences[essence]) {
        rankValue.push("level1");
      }
    } else {
      rankValue = CONFIG.E20.MLPAdvancement[rank];
    }

    await newRole.update({
      [essenceString]: rankValue,
    });
    await actor.update({
      [essenceRankString]: rank,
    });
  }

  setRoleValues(newRole, actor);
}
