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

    for (const essence in role.system.essenceLevels) {
      let totalIncrease = 0;
      for (let i =0; i<role.system.essenceLevels[essence].length; i++) {
        const essenceLevel = role.system.essenceLevels[essence][i].replace(/[^0-9]/g, '');
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

    if (role.system.powers.personal.starting) {
      let totalIncrease = 0;
      for (let i =0; i<role.system.powers.personal.levels.length; i++) {
        const powerIncreaseLevel = role.system.powers.personal.levels[i].replace(/[^0-9]/g, '');
        if (powerIncreaseLevel <= this._actor.system.level ) {
          totalIncrease += 1;
        }
      }

      const newPersonalPowerMax = parseInt(this._actor.system.powers.personal.max) + parseInt(role.system.powers.personal.starting) + parseInt(role.system.powers.personal.increase * totalIncrease);

      await this._actor.update({
        "system.powers.personal.max": newPersonalPowerMax,
      })
    }

    for (const [,perk] of role.system.items) {
      if (perk.level <=this._actor.system.level) {

      }
    }
    const newRoleList = await dropFunc();
    const newRole = newRoleList[0];

    this._actor.setFlag('essence20', 'lastLevelUp', this._actor.system.level);


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
