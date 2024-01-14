import {
  createItemCopies,
  deleteAttachmentsForItem,
  getItemsOfType,
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
    const hasRole = await getItemsOfType("role", this._actor.items);
    console.log(hasRole)
      // Characters can only have one Role
      if (hasRole.length > 0) {
        ui.notifications.error(game.i18n.format(game.i18n.localize('E20.RoleMultipleError')));
        return false;
      }

    const newRoleList = await dropFunc();
    const newRole = newRoleList[0];

    this._actor.setFlag('essence20', 'lastLevelUp', this._actor.system.level);

    if (role.system.version == 'myLittlePony') {
      await essenceSelect(newRole);
    }

    for (const essence in newRole.system.essenceLevels) {
      let totalIncrease = 0;
      for (let i =0; i<newRole.system.essenceLevels[essence].length; i++) {
        const essenceLevel = newRole.system.essenceLevels[essence][i].replace(/[^0-9]/g, '');
        if (essenceLevel <= this._actor.system.level ) {
          totalIncrease += 1;
        }
      }

      const essenceValue = this._actor.system.essences[essence] + totalIncrease;
      const essenceString = `system.essences.${essence}`;

      await this._actor.update({
        [essenceString]: essenceValue,
      });

    }

    if (newRole.system.powers.personal.starting) {
      let totalIncrease = 0;
      for (let i =0; i<newRole.system.powers.personal.levels.length; i++) {
        const powerIncreaseLevel = newRole.system.powers.personal.levels[i].replace(/[^0-9]/g, '');
        if (powerIncreaseLevel <= this._actor.system.level ) {
          totalIncrease += 1;
        }
      }

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
    for (const essence in role.system.essenceLevels) {
      let totalDecrease = 0;
      for (let i =0; i<role.system.essenceLevels[essence].length; i++) {
        const essenceLevel = role.system.essenceLevels[essence][i].replace(/[^0-9]/g, '');
        if (essenceLevel <=this._actor.system.level ) {
          totalDecrease += 1;
        }
      }

      const essenceValue = Math.max(0, this._actor.system.essences[essence] - totalDecrease);
      const essenceString = `system.essences.${essence}`;

      await this._actor.update({
        [essenceString]: essenceValue,
      });
    }

    if (role.system.powers.personal.starting) {
      let totalDecrease = 0;
      for (let i =0; i<role.system.powers.personal.levels.length; i++) {
        const powerDecreaseLevel = role.system.powers.personal.levels[i].replace(/[^0-9]/g, '');
        if (powerDecreaseLevel <= this._actor.system.level ) {
          totalDecrease += 1;
        }
      }

      let newPersonalPowerMax = parseInt(this._actor.system.powers.personal.max) - role.system.powers.personal.starting - (role.system.powers.personal.increase * totalDecrease);

      if (newPersonalPowerMax < 0) {
        newPersonalPowerMax = 0;
      }

      await this._actor.update({
        "system.powers.personal.max": newPersonalPowerMax,
      });
    }

    await deleteAttachmentsForItem(role, this._actor);
    this._actor.setFlag('essence20', 'lastLevelUp', 0);
  }
}
