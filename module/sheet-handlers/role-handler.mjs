import {
  createItemCopies,
  deleteAttachmentsForItem,
  getItemsOfType,
  rememberSelect,
  roleValueChange,
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

    const newRoleList = await dropFunc();
    const newRole = newRoleList[0];

    this._actor.setFlag('essence20', 'previousLevel', this._actor.system.level);

    if (role.system.version == 'myLittlePony') {
      try {
        const essenceTypes = await this._essenceSelect(newRole);
        if (!essenceTypes) {
          console.warn("Essences Not selected")
        } else {
          console.log(essenceTypes)
        }
      } catch(error) {
        console.error(error);
      }
    }

    for (const essence in newRole.system.essenceLevels) {
      const totalIncrease = await roleValueChange(this._actor.system.level, newRole.system.essenceLevels[essence]);
      const essenceValue = this._actor.system.essences[essence] + totalIncrease;
      const essenceString = `system.essences.${essence}`;

      await this._actor.update({
        [essenceString]: essenceValue,
      });
    }

    if (newRole.system.powers.personal.starting) {
      const totalIncrease = await roleValueChange(this._actor.system.level, role.system.powers.personal.levels);
      const newPersonalPowerMax = parseInt(this._actor.system.powers.personal.max)
        + parseInt(newRole.system.powers.personal.starting)
        + parseInt(newRole.system.powers.personal.increase * totalIncrease);

      await this._actor.update({
        "system.powers.personal.max": newPersonalPowerMax,
      });
    }

    if (newRole.system.adjustments.health.length) {
      const totalIncrease = await roleValueChange(this._actor.system.level, newRole.system.adjustments.health);
      const newHealthBonus = this._actor.system.health.bonus + totalIncrease;

      await this._actor.update({
        "system.health.bonus": newHealthBonus,
      });
    }

    await createItemCopies(newRole.system.items, this._actor, "perk", newRole);
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

    await deleteAttachmentsForItem(role, this._actor);
    this._actor.setFlag('essence20', 'previousLevel', 0);
  }

  async _essenceSelect(role) {
    const choices = {};

    for (const advancementName of  CONFIG.E20.AdvancementNames) {
      choices[advancementName] = {
        chosen: false,
        key: advancementName,
        label: advancementName,
      };
    }

    await new Dialog(
      {
        title: game.i18n.localize('E20.EssenceSelect'),
        content: await renderTemplate("systems/essence20/templates/dialog/essence-select.hbs", {
          choices,
        }),
        buttons: {
          save: {
            label: game.i18n.localize('E20.AcceptButton'),
            callback: (html) => {this._verifySelection(rememberSelect(html)); this._essenceSetValues(rememberSelect(html), role); }
          },
        },
      },
    ).render(true);
  }

  async _verifySelection (options) {
    const rankArray = []
    for (const [, rank] of Object.entries(options)) {
      rankArray.push (rank);
    }
    const isUnique = rankArray.length === new Set(rankArray).size;
    if (!isUnique) {
      throw new Error('Selections must be unique');
    }
    return isUnique;
  }

  async _essenceSetValues (options, role) {
    for (const[essence, rank] of Object.entries(options)) {
      const essenceString = `system.essenceLevels.${essence}`;
      const rankValue = CONFIG.E20.MLPAdvancement[rank];
      await role.update({
        [essenceString]: rankValue,
      });
    }
  }
}
