import {
  deleteAttachmentsForItem,
  getItemsOfType,
  rememberSelect,
  roleValueChange,
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

  async focusUpdate(focus, dropFunc){
    const hasFocus = await getItemsOfType("focus", this._actor.items).length > 0;
    const role = await getItemsOfType("role", this._actor.items);
     const attachedRole = [];
    for (const [, item] of Object.entries(focus.system.items)) {
      if (item.type == "role") {
        attachedRole.push(item);
      }
    }

    // Characters can only have one Role
    if (hasFocus) {
      ui.notifications.error(game.i18n.format(game.i18n.localize('E20.FocusMultipleError')));
      return false;
    }

    if (role) {
      if (role[0].flags.core.sourceId == attachedRole[0].uuid) {
        const newFocusList = await dropFunc();
        const newFocus = newFocusList[0];

        await this._focusStatUpdate(newFocus);

      } else {
        ui.notifications.error(game.i18n.format(game.i18n.localize('E20.FocusRoleMismatchError')));
      return false;
      }
    } else {
      ui.notifications.error(game.i18n.format(game.i18n.localize('E20.FocusNoRoleError')));
      return false;
    }
  }

  async _focusStatUpdate(newFocus) {
    const totalIncrease = await roleValueChange(this._actor.system.level, newFocus.system.essenceLevels);
    const essenceValue = this._actor.system.essences[newFocus.system.essences] + totalIncrease;
    const essenceString = `system.essences.${newFocus.system.essences}`;

    await this._actor.update({
      [essenceString]: essenceValue,
    });

    await createItemCopies(newFocus.system.items, this._actor, "perk", newFocus);
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

    this._actor.setFlag('essence20', 'previousLevel', this._actor.system.level);

    if (role.system.version == 'myLittlePony') {
      await this._selectEssenceProgression(role,dropFunc);
    } else {
      const newRoleList = await dropFunc();
      const newRole = newRoleList[0];
      await this._roleDropSetValues(newRole);
    }
  }

  /**
   * Removes the role and role features that are on the actor.
   * @param {Role} role The role item that is being deleted on the actor
   */
  async onRoleDelete(role) {
    const previousLevel = this._actor.getFlag('essence20', 'previousLevel');

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

    if (role.system.adjustments.health.length) {
      const totalDecrease = await roleValueChange(0, role.system.adjustments.health, previousLevel);
      const newHealthBonus = Math.max(0, this._actor.system.health.bonus + totalDecrease);

      await this._actor.update({
        "system.health.bonus": newHealthBonus,
      });
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

    this._roleDropSetValues(newRole);
  }

  /**
   * Handles setting the Values from the role that was dropped
   * @param {Object} role The newly created role on the actor.
   */
  async _roleDropSetValues(role) {
    setRoleValues(role, this._actor);
  }
}
