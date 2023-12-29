import {
  createItemCopies
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

  async roleUpdate(role, dropFunc) {
    for (let actorItem of this._actor.items) {
      // Characters can only have one Role
      if (actorItem.type == 'role') {
        ui.notifications.error(game.i18n.format(game.i18n.localize('E20.RoleMulitpleError')));
        return false;
      }
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
      })

    }

    if (newRole.system.powers.personal.starting) {
      let totalIncrease = 0;
      for (let i =0; i<newRole.system.powers.personal.levels.length; i++) {
        const powerIncreaseLevel = newRole.system.powers.personal.levels[i].replace(/[^0-9]/g, '');
        if (powerIncreaseLevel <= this._actor.system.level ) {
          totalIncrease += 1;
        }
      }

      const newPersonalPowerMax = parseInt(this._actor.system.powers.personal.max) + parseInt(newRole.system.powers.personal.starting) + parseInt(newRole.system.powers.personal.increase * totalIncrease);

      await this._actor.update({
        "system.powers.personal.max": newPersonalPowerMax,
      })
    }

    await createItemCopies(newRole.system.items, this._actor, "perk", newRole);

  }

  async essenceSelect(role) {

  }

  async onRoleDelete(role){
    for (const essence in role.system.essenceLevels) {
      let totalDecrease = 0;
      for (let i =0; i<role.system.essenceLevels[essence].length; i++) {
        const essenceLevel = role.system.essenceLevels[essence][i].replace(/[^0-9]/g, '');
        if (essenceLevel <=this._actor.system.level ) {
          totalDecrease += 1;
        }
      }
      const essenceValue = this._actor.system.essences[essence] - totalDecrease;
      const essenceString = `system.essences.${essence}`;

      await this._actor.update({
        [essenceString]: essenceValue,
      })
    }

    if (role.system.powers.personal.starting) {
      let totalDecrease = 0;
      for (let i =0; i<role.system.powers.personal.levels.length; i++) {
        const powerDecreaseLevel = role.system.powers.personal.levels[i].replace(/[^0-9]/g, '');
        if (powerDecreaseLevel <= this._actor.system.level ) {
          totalDecrease += 1;
        }
      }
      const newPersonalPowerMax = parseInt(this._actor.system.powers.personal.max) - role.system.powers.personal.starting - (role.system.powers.personal.increase * totalDecrease);

      await this._actor.update({
        "system.powers.personal.max": newPersonalPowerMax,
      })
    }

    this._actor.setFlag('essence20', 'lastLevelUp', 0);
  }
}
