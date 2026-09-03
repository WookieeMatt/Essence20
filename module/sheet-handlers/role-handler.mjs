import ChoicesSelector from "../apps/choices-selector.mjs";
import EssenceProgressionSelector from "../apps/essence-progression-selector.mjs";
import { createItemCopies, deleteAttachmentsForItem } from "./attachment-handler.mjs";
import MultiEssenceSelector from "../apps/multi-essence-selector.mjs";
import { onPerkDelete, onPerkDrop, setMorphedToughnessBonus } from "./perk-handler.mjs";
import { onFactionDrop } from "./faction-handler.mjs";
import { actorHasPerk } from "../helpers/perks.mjs";
import {
  actorHadMagicalBeforeGrant,
  actorHasPrincessOfLaughter,
  applySpellcastingUpshift,
  roleGrantsPrincessOfLaughter,
} from "../helpers/princess-of-laughter.mjs";

const MORPHIN_TIME_PERK_ID = "Compendium.essence20.pr_crb.Item.UFMTHB90lA9ZEvso";

/**
 * Performs a Spectrum Shift: retroactively swaps the Actor's current Role for a new one, per
 * the Spectrum Shift Perk rules (core rulebook p.58). Health, Essence scores, weapon/armor
 * training, and general Skill ranks are left untouched - only Power Regeneration/Capacity,
 * the Role's own skill die (e.g. a Grid Relic Weapon), and Role Perks (including Zord access)
 * retroactively become the new Role's values, computed fresh as if the Actor had always been
 * this Role up to their current level. Zord Features already chosen on a linked Zord actor
 * aren't touched here - reflavoring or replacing the Zord itself is left to the GM/player.
 *
 * A Role with system.hasSpectrumShifted set (currently only the Quantum Ranger) is a partial
 * exception to this: per its own "Spectrum Shifted" Role Perk, it builds off an existing
 * Ranger's early talents rather than fully replacing them, so the old Role's Perks from levels
 * 1-3 are kept (reparented onto the new Role) instead of being deleted like everything else.
 * @param {Actor} actor The Actor performing the Spectrum Shift
 * @param {Role} newRole The new Role to shift into
 */
export async function performSpectrumShift(actor, newRole) {
  const oldRole = actor.items.documentsByType.role.find(r => !r.system.isAdditive);
  if (!oldRole) {
    return;
  }

  const newRoleItem = await Item.create(newRole, { parent: actor });

  for (const item of [...actor.items]) {
    if (item.getFlag('essence20', 'parentId') == oldRole.id) {
      if (newRole.system.hasSpectrumShifted && item.type == 'perk') {
        const sourceId = item.flags.core?.sourceId ?? item._stats?.compendiumSource;
        const oldAttachment = Object.values(oldRole.system.items).find(entry => entry.uuid == sourceId);
        if (oldAttachment?.level && oldAttachment.level <= 3) {
          await item.setFlag('essence20', 'parentId', newRoleItem._id);
          continue;
        }
      }

      if (item.type == 'perk') {
        await onPerkDelete(actor, item);
      }

      await item.delete();
    }
  }

  // Power Regeneration Rate & Personal Power Capacity: recomputed fresh for the new Role, as
  // if the Actor had always been this Role up to their current level.
  const powerLevelsReached = roleValueChange(actor.system.level, newRole.system.powers.personal.levels, null);
  const newPersonalPowerMax = newRole.system.powers.personal.starting
    ? newRole.system.powers.personal.starting + newRole.system.powers.personal.increase * powerLevelsReached
    : 0;

  await actor.update({
    "system.powers.personal.max": newPersonalPowerMax,
    "system.powers.personal.regeneration": newRole.system.powers.personal.regeneration,
  });

  // The Role's own skill die (e.g. White Ranger's Grid Relic Weapon): reset to a neutral
  // baseline, then, if the new Role uses one, recompute fresh for the Actor's current level.
  await actor.update({
    "system.skills.roleSkillDie.shift": "d20",
    "system.skills.roleSkillDie.essences.smarts": false,
    "system.skills.roleSkillDie.essences.social": false,
    "system.skills.roleSkillDie.essences.speed": false,
    "system.skills.roleSkillDie.essences.strength": false,
    "system.skills.roleSkillDie.edge": false,
    "system.skills.roleSkillDie.snag": false,
    "system.skills.roleSkillDie.shiftUp": 0,
    "system.skills.roleSkillDie.shiftDown": 0,
    "system.skills.roleSkillDie.isSpecialized": false,
    "system.skills.roleSkillDie.modifier": 0,
  });

  if (newRole.system.skillDie.isUsed) {
    const shiftList = CONFIG.E20.skillShiftList;
    const dieLevelsReached = roleValueChange(actor.system.level, newRole.system.skillDie.levels, null);
    const initialShiftIndex = shiftList.findIndex(s => s == "d2");
    const finalShiftIndex = Math.max(0, Math.min(shiftList.length - 1, initialShiftIndex - dieLevelsReached));

    const isSpecialized = newRole.system.skillDie.specializedLevels.some(arrayLevel => {
      const level = arrayLevel.replace(/[^0-9]/g, '');
      return level <= actor.system.level;
    });

    await actor.update({
      "system.skills.roleSkillDie.shift": shiftList[finalShiftIndex],
      "system.skills.roleSkillDie.isSpecialized": isSpecialized,
    });
  }

  // The old Role item itself is no longer needed - newRoleItem (created above, before the Perk
  // cleanup loop) already stands in for it as the parent of every retained/newly granted Perk.
  await oldRole.delete();

  // Role Perks (including Zord access): grant every Perk the new Role provides at or below
  // the Actor's current level.
  await createItemCopies(newRole.system.items, actor, "perk", newRoleItem);

  // Role version updates (canMorph/canSpellcast/canQualify) - in practice a Spectrum Shift
  // always stays within the same game line, so this is usually a no-op.
  await actor.update({
    "system.canMorph": newRole.system.version == 'powerRangers',
    "system.canSpellcast": newRole.system.version == 'myLittlePony',
    "system.canQualify": newRole.system.version == 'giJoe',
  });
}

/**
 * Handles setting the values and Items for an Actor's Role
 * @param {Role} role The Actor's Role
 * @param {Actor} actor The Actor that has the Role
 * @param {Number} newLevel (Optional) The new level that you are changing to
 * @param {Number} previousLevel (Optional) The last level processed for the Actor
 * @param {Number} essenceLevel (Optional) The level to use for Essence/Power/Health/skill-die
 *                               progression, in place of actor.system.level. Used by a base
 *                               Role once an "additive" Role (system.isAdditive, e.g. Old Hand)
 *                               is present: Essence Score Increases keep running off the
 *                               Actor's real level (so this stays null/unset for that case).
 * @param {Number} perkLevel (Optional) The level to use for this Role's OWN Role Perk grants,
 *                            in place of actor.system.level - the "Effective Base Role Level"
 *                            for a base Role once an additive Role is present, or the additive
 *                            Role's own independent level for its own Role Perks.
 * @param {Number} previousPerkLevel (Optional) The previously-processed value of perkLevel,
 *                                    in place of previousLevel, for the same reason.
 */
export async function setRoleValues(role, actor, newLevel=null, previousLevel=null, essenceLevel=null, perkLevel=null, previousPerkLevel=null) {
  const currentEssenceLevel = essenceLevel ?? newLevel;
  console.log(currentEssenceLevel);
  for (const essence in role.system.essenceLevels) {
    const totalChange = roleValueChange(currentEssenceLevel, role.system.essenceLevels[essence], previousLevel);
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
    const totalChange = roleValueChange(currentEssenceLevel, role.system.powers.personal.levels, previousLevel);
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
    const totalChange = roleValueChange(currentEssenceLevel, role.system.adjustments.health, previousLevel);
    const newHealthBonus = actor.system.health.bonus + totalChange;

    await actor.update({
      "system.health.bonus": newHealthBonus,
    });
  }

  if (role.system.skillDie.isUsed) {
    const skillName = "roleSkillDie";
    const shiftList = CONFIG.E20.skillShiftList;
    const totalChange = roleValueChange(currentEssenceLevel, role.system.skillDie.levels, previousLevel);
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
      if (currentEssenceLevel == level) {
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

  const currentPerkLevel = perkLevel ?? actor.system.level;
  const lastPerkLevel = previousPerkLevel ?? previousLevel;
  if (newLevel && previousLevel && newLevel > previousLevel || (!newLevel && !previousLevel)) {
    // Drop or level up
    // MLP CRB "Princess of Laughter" (p.86-87): "If you already have Magical, you gain an
    // ongoing upshift 1 to Spellcasting" - "already have" must be checked BEFORE this exact
    // grant also hands out a fresh copy of Magical alongside Princess of Laughter itself. See
    // helpers/princess-of-laughter.mjs's own doc comment.
    const grantsPrincessOfLaughter = roleGrantsPrincessOfLaughter(role) && !actorHasPrincessOfLaughter(actor);
    const hadMagicalBeforeGrant = grantsPrincessOfLaughter && actorHadMagicalBeforeGrant(actor);

    await createItemCopies(role.system.items, actor, "perk", role, lastPerkLevel, currentPerkLevel);

    if (grantsPrincessOfLaughter && hadMagicalBeforeGrant && actorHasPrincessOfLaughter(actor)) {
      await applySpellcastingUpshift(actor);
    }
  } else {
    // Level down
    await deleteAttachmentsForItem(role, actor, lastPerkLevel, currentPerkLevel);
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

  const hasFocus = actor.items.documentsByType.focus.length > 0;
  const role = actor.items.documentsByType.role;
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
  // Actors can only have one base Role, and (separately) at most one "additive" Role that
  // stacks on top of it (e.g. G.I. Joe's Old Hand) - an additive Role requires a base Role to
  // already be present.
  const existingRoles = actor.items.documentsByType.role;
  const hasBaseRole = existingRoles.some(r => !r.system.isAdditive);
  const hasAdditiveRole = existingRoles.some(r => r.system.isAdditive);

  if (role.system.isAdditive) {
    if (!hasBaseRole) {
      ui.notifications.error(game.i18n.localize('E20.OldHandNoBaseRoleError'));
      return false;
    }

    if (hasAdditiveRole) {
      ui.notifications.error(game.i18n.localize('E20.RoleMultipleError'));
      return false;
    }
  } else if (hasBaseRole) {
    ui.notifications.error(game.i18n.localize('E20.RoleMultipleError'));
    return false;
  }

  // Faction updates
  const factionList = actor.items.documentsByType.faction;
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

  await actor.setFlag('essence20', 'previousLevel', actor.system.level);
  await actor.setFlag('essence20', 'roleDrop', true);

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

  if (role.system.isAdditive) {
    // An additive Role (e.g. Old Hand) starts its own independent level track at 1 the moment
    // it's dropped, regardless of the Actor's real character level - record that transition
    // point, then grant Level 1 of the additive Role's own table (both the essence and perk
    // level overrides are 1, since an additive Role's Essence progression - if it has any - and
    // its Role Perks both run on this same independent track, unlike a base Role under one).
    await actor.update({
      "system.oldHandTransitionLevel": actor.system.level,
    });

    const newRoleList = await dropFunc();
    const newRole = newRoleList[0];
    await setRoleValues(newRole, actor, null, null, 1, 1);
  } else if (role.system.version == 'myLittlePony') {
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
  console.log(newLevel);
  const previousLevel = actor.getFlag('essence20', 'previousLevel');
  console.log(previousLevel);
  if (!previousLevel || previousLevel == newLevel) {
    return;
  }

  const roles = await actor.items.documentsByType.role;
  const baseRole = roles.find(r => !r.system.isAdditive);
  const additiveRole = roles.find(r => r.system.isAdditive);
  console.log(baseRole);
  if (!baseRole) {
    return;
  }

  if (!additiveRole) {
    // The common case: a single Role, unchanged from before this Actor could have a second one.
    await setRoleValues(baseRole, actor, newLevel, previousLevel);
  } else {
    // An additive Role (e.g. Old Hand) is present: its own level runs independently of the
    // Actor's real level, starting at 1 the level it was dropped
    // (system.oldHandTransitionLevel). The base Role's Essence progression keeps using the
    // Actor's real level unchanged; only its own Role Perk grants slow to the "Effective Base
    // Role Level" - see setRoleValues()'s essenceLevel/perkLevel params.
    const transitionLevel = actor.system.oldHandTransitionLevel;
    const additiveLevel = newLevel - transitionLevel + 1;
    const previousAdditiveLevel = previousLevel - transitionLevel + 1;
    const effectiveBaseRoleLevel = (transitionLevel - 1) + Math.floor(additiveLevel / baseRole.system.effectiveLevelDivisor);
    const previousEffectiveBaseRoleLevel = (transitionLevel - 1) + Math.floor(previousAdditiveLevel / baseRole.system.effectiveLevelDivisor);

    await setRoleValues(baseRole, actor, newLevel, previousLevel, null, effectiveBaseRoleLevel, previousEffectiveBaseRoleLevel);
    await setRoleValues(additiveRole, actor, additiveLevel, previousAdditiveLevel, additiveLevel, additiveLevel);
  }

  const focus = actor.items.documentsByType.focus;
  if (focus.length == 1) {
    await _setFocusValues(focus[0], actor, newLevel, previousLevel);
  }

  await actor.setFlag('essence20', 'previousLevel', newLevel);
}

/**
 * Handles deleting the Role and Role features that are on the Actor.
 * @param {Actor} actor The Actor whose Role is being deleted
 * @param {Role} role The Role that is being deleted on the Actor
 */
export async function onRoleDelete(actor, role) {
  const previousLevel = actor.getFlag('essence20', 'previousLevel');
  const focus = actor.items.documentsByType.focus;
  const factionList = actor.items.documentsByType.faction;
  const isAdditive = role.system.isAdditive;

  // Deleting the base Role also removes any additive Role stacked on top of it (e.g. Old
  // Hand) - an additive Role can't exist without the base Role it runs on top of. Do this
  // first, while oldHandTransitionLevel/previousLevel are still intact, so the additive
  // Role's own perk/RolePoints unwind computes against valid state.
  if (!isAdditive) {
    const additiveRole = actor.items.documentsByType.role.find(r => r.system.isAdditive);
    if (additiveRole) {
      await onRoleDelete(actor, additiveRole);
      await additiveRole.delete();
    }
  }

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

  // Role version updates - only when deleting the base Role. Deleting an additive Role (e.g.
  // Old Hand) shouldn't turn off canMorph/canSpellcast/canQualify out from under a base Role
  // that's still there granting the exact same flag.
  if (!isAdditive) {
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

  // Focus updates - a Focus is tied to the base Role, not any additive one.
  if (!isAdditive && focus[0]) {
    await onFocusDelete(actor, focus[0]);
    await focus[0].delete();
  }

  // Training updates
  await _trainingUpdate(actor, 'armors', 'qualified', false, role);
  await _trainingUpdate(actor, 'armors', 'trained', false, role);
  await _trainingUpdate(actor, 'weapons', 'qualified', false, role);
  await _trainingUpdate(actor, 'weapons', 'trained', false, role);
  await _trainingUpdate(actor, 'armors', 'trained', false, role, true);

  // Misc updates - deleting an additive Role (e.g. Old Hand) only clears its own transition
  // bookkeeping; the character's real level and the base Role stay exactly as they were. Only
  // deleting the base Role itself resets the character back to level 1.
  if (isAdditive) {
    await actor.update({
      "system.oldHandTransitionLevel": null,
    });
  } else {
    await actor.update ({
      "system.defenses.toughness.morphed": 0,
      "system.level": 1,
    });

    await actor.setFlag('essence20', 'previousLevel', 0);
  }

  await deleteAttachmentsForItem(role, actor);
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
