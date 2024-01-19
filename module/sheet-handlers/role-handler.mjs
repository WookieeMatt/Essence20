import {
  createItemCopies,
  deleteAttachmentsForItem,
  getItemsOfType,
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
   * @param {Roles} roles The role item that is being dropped on the actor
   * @param {Function} dropFunc The drop Function that will be used to complete the drop of the role
   */
  async roleUpdate(roles, dropFunc) {
    const hasRole = await getItemsOfType("role", this._actor.items);

    // Characters can only have one Role
    if (hasRole.length > 0) {
      ui.notifications.error(game.i18n.format(game.i18n.localize('E20.RoleMultipleError')));
      return false;
    }

    const newRoleList = await dropFunc();
    const newRole = newRoleList[0];

    this._actor.setFlag('essence20', 'previousLevel', this._actor.system.level);

    if (roles.system.version == 'myLittlePony') {
      await essenceSelect(newRole);
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

    await createItemCopies(newRole.system.items, this._actor, "perk", newRole);
  }

  /**
   * Removes the role and role features that are on the actor.
   * @param {Role} role The role item that is being deleted on the actor
   */
  async onRoleDelete(role){
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

    await deleteAttachmentsForItem(role, this._actor);
    this._actor.setFlag('essence20', 'previousLevel', 0);
  }
}
