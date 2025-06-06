import ChoicesSelector from "../apps/choices-selector.mjs";
import EssenceProgressionSelector from "../apps/essence-progression-selector.mjs";
import { getItemsOfType } from "../helpers/utils.mjs";
import { createItemCopies, deleteAttachmentsForItem } from "./attachment-handler.mjs";
import MultiEssenceSelector from "../apps/multi-essence-selector.mjs";
import { onPerkDrop, setMorphedToughnessBonus } from "./perk-handler.mjs";
import { onFactionDrop } from "./faction-handler.mjs";

const MORPHIN_TIME_PERK_ID = "Compendium.essence20.pr_crb.Item.UFMTHB90lA9ZEvso";
/**
 * Handles setting the values and Items for an Actor's Role
 * @param {Role} role The Actor's Role
 * @param {Actor} actor The Actor that has the Role
 * @param {Number} newLevel (Optional) The new level that you are changing to
 * @param {Number} previousLevel (Optional) The last level processed for the Actor
 */
export async function setRoleValues(role, actor, newLevel=null, previousLevel=null) {
  for (const essence in role.system.essenceLevels) {
    const totalChange = roleValueChange(actor.system.level, role.system.essenceLevels[essence], previousLevel);
    const essenceMax = actor.system.essences[essence].max + totalChange;
    const essenceMaxString = `system.essences.${essence}.max`;
    const essenceValue = actor.system.essences[essence].value+ totalChange;
    const essenceString = `system.essences.${essence}.value`;

    await actor.update({
      [essenceString]: essenceValue,
      [essenceMaxString]: essenceMax,
    });
  }

  if (role.system.powers.personal.starting) {
    const totalChange = roleValueChange(actor.system.level, role.system.powers.personal.levels, previousLevel);
    let newPersonalPowerMax = 0;
    if (actor.system.powers.personal.max > 0) {
      newPersonalPowerMax = actor.system.powers.personal.max + role.system.powers.personal.increase * totalChange;
    } else {
      newPersonalPowerMax = role.system.powers.personal.starting;
    }

    await actor.update({
      "system.powers.personal.max": newPersonalPowerMax,
      "system.powers.personal.regeneration": role.system.powers.personal.regeneration,
    });
  }

  if (role.system.adjustments.health.length) {
    const totalChange = roleValueChange(actor.system.level, role.system.adjustments.health, previousLevel);
    const newHealthBonus = actor.system.health.bonus + totalChange;

    await actor.update({
      "system.health.bonus": newHealthBonus,
    });
  }

  if (role.system.skillDie.isUsed) {
    const skillName = "roleSkillDie";
    const shiftList = CONFIG.E20.skillShiftList;
    const totalChange = roleValueChange(actor.system.level, role.system.skillDie.levels, previousLevel);
    let initialShiftIndex = shiftList.findIndex(s => s == "d2");
    if (actor.system.skills[skillName].shift) {
      initialShiftIndex = shiftList.findIndex(s => s == actor.system.skills[skillName].shift);
    }

    const finalShiftIndex = Math.max(
      0,
      Math.min(shiftList.length - 1, initialShiftIndex-totalChange),
    );

    const skillStringShift = `system.skills.${skillName}.shift`;
    const skillStringIsSpecialized = `system.skills.${skillName}.isSpecialized`;

    let isSpecialized = false;
    for (const arrayLevel of role.system.skillDie.specializedLevels) {
      const level = arrayLevel.replace(/[^0-9]/g, '');
      if (actor.system.level == level) {
        isSpecialized = true;
        break;
      }
    }

    await actor.update({
      [skillStringShift]: shiftList[finalShiftIndex],
      [skillStringIsSpecialized] : isSpecialized,
    });
  }

  for (const [,item] of Object.entries(role.system.items)) {
    if (item.type == "rolePoints" && actor.flags.essence20.roleDrop) {
      await createItemCopies(role.system.items, actor, "rolePoints", role);
      // Set points value to max?
    }
  }

  if (newLevel && previousLevel && newLevel > previousLevel || (!newLevel && !previousLevel)) {
    // Drop or level up
    await createItemCopies(role.system.items, actor, "perk", role, previousLevel);
  } else {
    // Level down
    await deleteAttachmentsForItem(role, actor, previousLevel);
  }

  actor.setFlag('essence20', 'roleDrop', false);
}

/**
 * For a value that increases at specific levels, this returns the difference
 * in that value for the Actor's current and previous levels
 * @param {Actor} actor The Actor that the Role is attached to
 * @param {String[]} arrayLevels An array of the levels at which a value changes
 * @param {Number} lastProcessedLevel The value of actor.system.level the last
 *                                    time a level change was processed
 * @returns {Number} The number of level changes
 */
export function roleValueChange(currentLevel, arrayLevels, lastProcessedLevel=null) {
  const levelDiff = currentLevel - lastProcessedLevel;
  if (!levelDiff) {
    return 0;
  }

  const isLevelUp = currentLevel > lastProcessedLevel;
  const changeIncrement = isLevelUp ? 1 : -1;
  let totalChange = 0;

  for (const arrayLevel of arrayLevels) {
    const level = arrayLevel.replace(/[^0-9]/g, '');
    const actorReachedLevel =
          isLevelUp && level <= currentLevel
      || !isLevelUp && level > currentLevel;
    const levelNotYetProcessed =
      !lastProcessedLevel
      || (isLevelUp  && level >  lastProcessedLevel)
      || (!isLevelUp && level <= lastProcessedLevel);
    const valueChange = actorReachedLevel && levelNotYetProcessed;
    totalChange += valueChange ? changeIncrement : 0;
  }

  return totalChange;
}

/**
 * Handles dropping a Focus on an Actor.
 * @param {Actor} actor The Actor receiving the Focus
 * @param {Focus} focus The Focus that is being dropped on the Actor
 * @param {Function} dropFunc The drop function that will be used to complete the drop of the Focus
 * @returns
 */
export async function onFocusDrop(actor, focus, dropFunc) {
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

  const sourceId = role[0]._stats.compendiumSource;

  if (sourceId != attachedRole[0].uuid) {
    ui.notifications.error(game.i18n.localize('E20.FocusRoleMismatchError'));
    return false;
  }

  if (focus.system.essences.length > 1) {
    return await _showEssenceDialog(actor, focus, dropFunc);
  } else {
    const newFocusList = await dropFunc();
    const newFocus = newFocusList[0];
    await actor.update({
      "system.focusEssence": newFocus.system.essences[0],
    });
    return await _setFocusValues(newFocus, actor);
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
      value: essence,
    };
  }

  const prompt = "E20.SelectFocus";
  const title = "E20.SelectFocusSkills";

  new ChoicesSelector(choices, actor, prompt, title, focus, null, dropFunc, null, null, null).render(true);
}

/**
 * Handles writing the selected Essence to the Actor.
 * @param {Actor} actor The Actor receiving the Focus
 * @param {Object} options The options resulting from _showFocusSkillDialog()
 * @param {Function} dropFunc The drop function that will be used to complete the drop of the Focus
 */
export async function _focusStatUpdate(actor, selectedEssence, dropFunc) {
  const newFocusList = await dropFunc();
  const newFocus = newFocusList[0];

  await actor.update({
    "system.focusEssence": selectedEssence,
  });
  await _setFocusValues(newFocus, actor);
}

/**
 * Handles setting the values and Items for an Actor's Focus
 * @param {Focus} focus The Actor's Focus
 * @param {Actor} actor The Actor that has the Focus
 * @param {Number} newLevel (Optional) The new level that you are changing to
 * @param {Number} previousLevel (Optional) The last level processed for the Actor
 */
export async function _setFocusValues(focus, actor, newLevel=null, previousLevel=null) {
  const totalChange = roleValueChange(actor.system.level, focus.system.essenceLevels, previousLevel);
  const essenceMax = actor.system.essences[actor.system.focusEssence].max + totalChange;
  const essenceValue = actor.system.essences[actor.system.focusEssence].value + totalChange;
  const essenceMaxString = `system.essences.${actor.system.focusEssence}.max`;
  const essenceValueString = `system.essences.${actor.system.focusEssence}.value`;

  await actor.update({
    [essenceMaxString]: essenceMax,
    [essenceValueString]: essenceValue,
  });

  if (newLevel && previousLevel && newLevel > previousLevel || (!newLevel && !previousLevel)) {
    // Drop or level up
    return await createItemCopies(focus.system.items, actor, "perk", focus, previousLevel);
  } else {
    // Level down
    return await deleteAttachmentsForItem(focus, actor, previousLevel);
  }
}

/**
 * Handles deleting a focus from an actor.
 * @param {Actor} actor The Actor deleting the Focus
 * @param {Focus} focus The Focus that is being deleted from the Actor
 */
export async function onFocusDelete(actor, focus) {
  const previousLevel = actor.getFlag('essence20', 'previousLevel');
  const totalDecrease = roleValueChange(0, focus.system.essenceLevels, previousLevel);
  const essenceMax = Math.max(0, actor.system.essences[actor.system.focusEssence].max + totalDecrease);
  const essenceValue = Math.max(0, actor.system.essences[actor.system.focusEssence].value + totalDecrease);
  const essenceMaxString = `system.essences.${actor.system.focusEssence}.max`;
  const essenceValueString = `system.essences.${actor.system.focusEssence}.value`;

  await actor.update({
    [essenceMaxString]: essenceMax,
    [essenceValueString]: essenceValue,
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
export async function onRoleDrop(actor, role, dropFunc) {
  // Actors can only have one Role
  const hasRole = getItemsOfType("role", actor.items).length > 0;
  if (hasRole) {
    ui.notifications.error(game.i18n.localize('E20.RoleMultipleError'));
    return false;
  }

  // Faction updates
  const factionList = getItemsOfType("faction", actor.items);
  if (factionList.length) {
    addFactionPerks(actor, role);
  } else {
    let defaultFaction = null;
    for (const item of Object.values(role.system.items)) {
      if (item.type == 'faction') {
        defaultFaction = item;
        break;
      }
    }

    if (defaultFaction) {
      const factionToCreate = await fromUuid(defaultFaction.uuid);
      const newFaction = await Item.create(factionToCreate, { parent: actor });
      onFactionDrop(actor, null, newFaction);
    }
  }

  if (role.system.skillDie.isUsed && !role.system.skillDie.name) {
    ui.notifications.error(game.i18n.localize('E20.RoleSkillDieError'));
    return false;
  }

  actor.setFlag('essence20', 'previousLevel', actor.system.level);
  actor.setFlag('essence20', 'roleDrop', true);

  // Skill updates
  if (role.system.skillDie.isUsed) {
    const skillName = "roleSkillDie";
    const skillStringShift = `system.skills.${skillName}.shift`;
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
    });
  }

  // Role version updates
  if (role.system.version =='powerRangers') {
    await actor.update({
      "system.canMorph": true,
    });
  } else if (role.system.version =='myLittlePony') {
    await actor.update({
      "system.canSpellcast": true,
    });
  } else  if (role.system.version == 'giJoe') {
    await actor.update({
      "system.canQualify": true,
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

  // Training updates
  await _trainingUpdate(actor, 'armors', 'qualified', true, role);
  await _trainingUpdate(actor, 'armors', 'trained', true, role);
  await _trainingUpdate(actor, 'weapons', 'qualified', true, role);
  await _trainingUpdate(actor, 'weapons', 'trained', true, role);
  await _trainingUpdate(actor, 'armors', 'trained', true, role, true);

  // Morphed toughness bonus updates
  for (const item of actor.items) {
    if (item._stats.compendiumSource == MORPHIN_TIME_PERK_ID) {
      setMorphedToughnessBonus(actor);
    }
  }
}

/**
* Updates the Actor based on a level change from the attached Role
* @param {Actor}  actor    The Actor whose level has changed
* @param {Number} newLevel The new level that you are changing to
*/
export async function onLevelChange(actor, newLevel) {
  const previousLevel = actor.getFlag('essence20', 'previousLevel');
  if (!previousLevel || previousLevel == newLevel) {
    return;
  }

  const roles = getItemsOfType("role", actor.items);
  if (roles.length == 1) {
    await setRoleValues(roles[0], actor, newLevel, previousLevel);
  } else {
    return;
  }

  const focus = getItemsOfType("focus", actor.items);
  if (focus.length == 1) {
    await _setFocusValues(focus[0], actor, newLevel, previousLevel);
  }

  actor.setFlag('essence20', 'previousLevel', newLevel);
}

/**
 * Handles deleting the Role and Role features that are on the Actor.
 * @param {Actor} actor The Actor whose Role is being deleted
 * @param {Role} role The Role that is being deleted on the Actor
 */
export async function onRoleDelete(actor, role) {
  const previousLevel = actor.getFlag('essence20', 'previousLevel');
  const focus = getItemsOfType("focus", actor.items);
  const factionList = getItemsOfType("faction", actor.items);

  // Faction updates
  if (factionList.length) {
    for (const item of actor.items) {
      if (item.type == "perk" && item.system.isRoleVariant) {
        deleteAttachmentsForItem(item, actor);
      }
    }
  }

  // Essence updates
  for (const essence in role.system.essenceLevels) {
    const totalDecrease = roleValueChange(0, role.system.essenceLevels[essence], previousLevel);
    const essenceMaxValue = Math.max(0, actor.system.essences[essence].max + totalDecrease);
    const essenceValue = Math.max(0, actor.system.essences[essence].value + totalDecrease);
    const essenceMaxString = `system.essences.${essence}.max`;
    const essenceString = `system.essences.${essence}.value`;

    await actor.update({
      [essenceString]: essenceValue,
      [essenceMaxString]: essenceMaxValue,
    });
  }

  // Role version updates
  if (role.system.version =='powerRangers') {
    await actor.update({
      "system.canMorph": false,
    });
  } else if (role.system.version =='myLittlePony') {
    await actor.update({
      "system.canSpellcast": false,
    });
  } else if (role.system.version == 'giJoe') {
    await actor.update({
      "system.canQualify": false,
    });
  }

  if (role.system.version == 'myLittlePony' || role.system.hasSpecialAdvancement) {
    await actor.update({
      "system.essenceRanks.smarts": null,
      "system.essenceRanks.social": null,
      "system.essenceRanks.speed": null,
      "system.essenceRanks.strength": null,
    });
  }

  // Personal Power updates
  if (role.system.powers.personal.starting) {
    const totalDecrease = roleValueChange(0, role.system.powers.personal.levels, previousLevel);
    const newPersonalPowerMax = Math.max(0, parseInt(actor.system.powers.personal.max) - role.system.powers.personal.starting + (role.system.powers.personal.increase * totalDecrease));

    await actor.update({
      "system.powers.personal.max": newPersonalPowerMax,
      "system.powers.personal.regeneration": 0,
    });
  }

  // Skill updates
  if (role.system.skillDie.isUsed) {
    const skillName = "roleSkillDie";
    const skillStringShift = `system.skills.${skillName}.shift`;
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
      [skillStringShift]: "d20",
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
    });
  }

  // Health updates
  if (role.system.adjustments.health.length) {
    const totalDecrease = roleValueChange(0, role.system.adjustments.health, previousLevel);
    const newHealthBonus = Math.max(0, actor.system.health.bonus + totalDecrease);

    await actor.update({
      "system.health.bonus": newHealthBonus,
    });
  }

  // Focus updates
  if (focus[0]) {
    await onFocusDelete(actor, focus[0]);
    await focus[0].delete();
  }

  // Training updates
  await _trainingUpdate(actor, 'armors', 'qualified', false, role);
  await _trainingUpdate(actor, 'armors', 'trained', false, role);
  await _trainingUpdate(actor, 'weapons', 'qualified', false, role);
  await _trainingUpdate(actor, 'weapons', 'trained', false, role);
  await _trainingUpdate(actor, 'armors', 'trained', false, role, true);

  // Misc updates
  await actor.update ({
    "system.defenses.toughness.morphed": 0,
    "system.level": 1,
  });

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

  const title = "E20.EssenceIncrease";
  new MultiEssenceSelector(choices, actor, role, dropFunc, title).render(true);

}

/**
 * Handles the selection of the Essence progression Ranks.
 * @param {Actor} actor The Actor receiving the Role
 * @param {Object} role The Role that was dropped on the Actor
 * @param {Function} dropFunc The drop function that will be used to complete the drop of the Role
 */
export async function _selectEssenceProgression(actor, role, dropFunc, level1Essences) {
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

  const title = "E20.EssenceProgressionSelect";
  new EssenceProgressionSelector(choices, actor, role, dropFunc, level1Essences, title).render(true);
}

/**
 * Handles setting the values of what was selected in the Essence selection dialog.
 * @param {Object} options The selections made in the dialog window
 * @param {Role} role The Role that was dropped on the Actor
 * @param {Function} dropFunc The drop function that will be used to complete the drop of the Role
 */
export async function _setEssenceProgression(actor, options, role, dropFunc, level1Essences) {
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

/**
 * Adds or removes Item type training for the given Actor.
 * @param {Actor} actor The Actor whose training is being updated
 * @param {String} itemType The type of item that we are training
 * @param {String} trainingType The type of training we are applying
 * @param {Boolean} updateType Whether we are adding (true) or removing (false) training
 * @param {Object} role The role that actor has
 * @param {Boolean} useUpgradesAccessor Whether this is targeting Upgrades or not
 */
async function _trainingUpdate(actor, itemType, trainingType, updateType, role, useUpgradesAccessor) {
  const profs = useUpgradesAccessor ? role.system.upgrades[itemType][trainingType] : role.system[itemType][trainingType];
  for (const prof of profs) {
    const profString = `system.${trainingType}.${useUpgradesAccessor ? 'upgrades.' : ''}${itemType}.${prof}`;
    await actor.update({
      [profString] : updateType,
    });
  }
}

/**
 * Handles adding subperks for existing factions for the role being added.
 * @param {Faction} faction The Existing Faction.
 * @param {Actor} actor The actor the role is being added to.
 * @param {Role} role The role that is being added.
 */
async function addFactionPerks(actor, role) {
  for (const item of actor.items) {
    if (item.type == "perk" && item.system.isRoleVariant) {
      for (const [, attachment] of Object.entries(item.system.items)) {
        if (attachment.role == role.name) {
          const itemToCreate = await fromUuid(attachment.uuid);
          await onPerkDrop(actor, itemToCreate, null, null, null, item);
        }
      }
    }
  }
}
