import {
  deleteAttachmentsForItem,
  getItemsOfType,
  rememberOptions,
  rememberSelect,
  roleValueChange,
  setFocusValues,
  setRoleValues,
} from "../helpers/utils.mjs";

export class RoleHandler {
  /**
  * Constructor
  * @param {Essence20ActorSheet} actorSheet The actor sheet
  */
  constructor(actorSheet) {
    this._actorSheet = actorSheet;
    this._actor = actorSheet.actor;
  }

  /**
   * Handles dropping a Focus on an Actor Sheet
   * @param {Focus} focus The focus that is being dropped on the actor
   * @param {Function} dropFunc The drop Function that will be used to complete the drop of the focus
   * @returns
   */
  async focusUpdate(focus, dropFunc) {
    if (!focus.system.essences.length) {
      ui.notifications.error(game.i18n.format(game.i18n.localize('E20.FocusNoEssenceError')));
      return false;
    }

    const hasFocus = await getItemsOfType("focus", this._actor.items).length > 0;
    const role = await getItemsOfType("role", this._actor.items);
    const attachedRole = [];
    for (const [, item] of Object.entries(focus.system.items)) {
      if (item.type == "role") {
        attachedRole.push(item);
      }
    }

    // Characters can only have one Focus
    if (hasFocus) {
      ui.notifications.error(game.i18n.format(game.i18n.localize('E20.FocusMultipleError')));
      return false;
    }

    if (!role[0]) {
      ui.notifications.error(game.i18n.format(game.i18n.localize('E20.FocusNoRoleError')));
      return false;
    }

    if (role[0].flags.core.sourceId != attachedRole[0].uuid) {
      ui.notifications.error(game.i18n.format(game.i18n.localize('E20.FocusRoleMismatchError')));
      return false;
    }

    if (focus.system.essences.length > 1) {
      await this._showEssenceDialog(focus, dropFunc);
    } else {
      const newFocusList = await dropFunc();
      const newFocus = newFocusList[0];
      await this._actor.update({
        "system.focusEssence": newFocus.system.essences[0],
      });
      await setFocusValues(newFocus, this._actor);
    }
  }

  /**
   * Handles selecting an Essence when the Focus has more then one.
   * @param {Focus} focus The focus that is being dropped on the actor
   * @param {Function} dropFunc The drop Function that will be used to complete the drop of the focus
   */
  async _showEssenceDialog(focus, dropFunc) {
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
            callback: html => this._focusStatUpdate(rememberOptions(html), dropFunc),
          },
        },
      },
    ).render(true);
  }

  /**
   *Handles writing the selected Essence to the actor.
   * @param {Object} options    The options resulting from _showFocusSkillDialog()
   * @param {Function} dropFunc The drop Function that will be used to complete the drop of the focus
   */
  async _focusStatUpdate(options, dropFunc) {
    let selectedEssence = "";
    for (const essence in CONFIG.E20.essences) {
      if (options[essence]) {
        selectedEssence = essence;
      }
    }

    const newFocusList = await dropFunc();
    const newFocus = newFocusList[0];
    await this._actor.update({
      "system.focusEssence": selectedEssence,
    });
    await setFocusValues(newFocus, this._actor);
  }

  /**
   * Handles deleting a focus from an actor.
   * @param {Focus} focus The focus that is being removed from the actor
   */
  async onFocusDelete(focus) {
    const previousLevel = this._actor.getFlag('essence20', 'previousLevel');
    const totalDecrease = await roleValueChange(0, focus.system.essenceLevels, previousLevel);
    const essenceValue = Math.max(0, this._actor.system.essences[this._actor.system.focusEssence] + totalDecrease);
    const essenceString = `system.essences.${this._actor.system.focusEssence}`;

    await this._actor.update({
      [essenceString]: essenceValue,
      "system.focusEssence": null,
    });

    await deleteAttachmentsForItem(focus, this._actor);
  }

  /**
   * Updates the actor wirh the role features that are there based on the level of the character.
   * @param {Role} role The role item that is being dropped on the actor
   * @param {Function} dropFunc The drop Function that will be used to complete the drop of the role
   */
  async roleUpdate(role, dropFunc) {
    const hasRole = await getItemsOfType("role", this._actor.items).length > 0;

    // Characters can only have one Role
    if (hasRole) {
      ui.notifications.error(game.i18n.format(game.i18n.localize('E20.RoleMultipleError')));
      return false;
    }

    if (role.system.skillDie.isUsed && !role.system.skillDie.name) {
      ui.notifications.error(game.i18n.localize('E20.RoleSkillDieError'));
      return false;
    }

    this._actor.setFlag('essence20', 'previousLevel', this._actor.system.level);
    this._actor.setFlag('essence20', 'roleDrop', true);

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

      await this._actor.update({
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
      await this._selectEssenceProgression(role,dropFunc);
    } else {
      const newRoleList = await dropFunc();
      const newRole = newRoleList[0];
      await setRoleValues(newRole, this._actor);
    }
  }

  /**
   * Removes the role and role features that are on the actor.
   * @param {Role} role The role item that is being deleted on the actor
   */
  async onRoleDelete(role) {
    const previousLevel = this._actor.getFlag('essence20', 'previousLevel');
    const focus = getItemsOfType("focus", this._actor.items);

    for (const essence in role.system.essenceLevels) {
      const totalDecrease = await roleValueChange(0, role.system.essenceLevels[essence], previousLevel);
      const essenceValue = Math.max(0, this._actor.system.essences[essence] + totalDecrease);
      const essenceString = `system.essences.${essence}`;

      await this._actor.update({
        [essenceString]: essenceValue,
      });
    }

    if (role.system.powers.personal.starting) {
      const totalDecrease = await roleValueChange(0, role.system.powers.personal.levels, previousLevel);
      const newPersonalPowerMax = Math.max(0, parseInt(this._actor.system.powers.personal.max) - role.system.powers.personal.starting + (role.system.powers.personal.increase * totalDecrease));

      await this._actor.update({
        "system.powers.personal.max": newPersonalPowerMax,
      });
    }

    if (role.system.skillDie.isUsed) {
      const skillName = "roleSkillDie"
      const skillString = `system.skills.-=${skillName}`;

      await this._actor.update({[skillString] : null});
    }

    if (role.system.adjustments.health.length) {
      const totalDecrease = await roleValueChange(0, role.system.adjustments.health, previousLevel);
      const newHealthBonus = Math.max(0, this._actor.system.health.bonus + totalDecrease);

      await this._actor.update({
        "system.health.bonus": newHealthBonus,
      });
    }

    if (focus[0]) {
      await this.onFocusDelete(focus[0]);
      await focus[0].delete();
    }

    if (role.system.version == 'myLittlePony') {
      await this._actor.update({
        "system.essenceRanks.smarts": null,
        "system.essenceRanks.social": null,
        "system.essenceRanks.speed": null,
        "system.essenceRanks.strength": null,
      });
    }

    await deleteAttachmentsForItem(role, this._actor);
    this._actor.setFlag('essence20', 'previousLevel', 0);
  }

  /**
   * Handles the selection of the Essence Progression Ranks
   * @param {Object} role The role that was dropped on the actor
   * @param {Function} dropFunc The function for the drop of the character
   */
  async _selectEssenceProgression(role, dropFunc) {
    const choices = {};

    for (const rankName of  CONFIG.E20.EssenceRankNames) {
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
              this._verifyEssenceProgression(rememberSelect(html));
              this._setEssenceProgression(rememberSelect(html), role, dropFunc);
            },
          },
        },
      },
    ).render(true);
  }

  /**
   * Handles verifying that all of the Essences have a different rank
   * @param {Object} options The selections made in the dialog window.
   * @returns {Boolean} If all of the Essences have a different rank
   */
  _verifyEssenceProgression (options) {
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
   * Handles setting the values of what was selected in the Essence Selection Dialog
   * @param {Object} options The selections made in the dialog window.
   * @param {Role} role The role that was dropped on the actor
   * @param {Function} dropFunc The function for the drop of the role
   */
  async _setEssenceProgression (options, role, dropFunc) {
    const newRoleList = await dropFunc();
    const newRole = newRoleList[0];

    for (const[essence, rank] of Object.entries(options)) {
      const essenceString = `system.essenceLevels.${essence}`;
      const essenceRankString = `system.essenceRanks.${essence}`;
      const rankValue = CONFIG.E20.MLPAdvancement[rank];
      await newRole.update({
        [essenceString]: rankValue,
      });
      await this._actor.update({
        [essenceRankString]: rank,
      });
    }

    setRoleValues(newRole, this._actor);
  }

}
