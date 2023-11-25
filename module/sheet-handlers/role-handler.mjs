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
    const newRoleList = await dropFunc();
    const newRole = newRoleList[0];

    console.log(newRole)

  }

  async onRoleDelete(role){
    for (const essence in role.system.essenceLevels) {
      let totalDecrease = 0;
      for (let i =0; i<role.system.essenceLevels[essence].length; i++) {
        const essenceLevel = role.system.essenceLevels.strength[i].replace(/[^0-9]/g, '');
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
  }
}
