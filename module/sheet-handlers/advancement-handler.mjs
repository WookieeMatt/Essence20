export class AdvancementHandler {
  /**
  * Constructor
  * @param {Essence20ActorSheet} actorSheet The actor sheet
  */
  constructor(actorSheet) {
    this._actorSheet = actorSheet;
    this._actor = actorSheet.actor;
  }

  async onLevelChange(actor) {
    const lastLevelUp = this._actor.getFlag('essence20', 'lastLevelUp');
    if (lastLevelUp) {
      if (this._actor.system.level != actor.flags.essence20.lastLevelUp) {
        if (this._actor.system.level > actor.flags.essence20.lastLevelUp) {
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
        }




        this._actor.setFlag('essence20', 'lastLevelUp', this._actor.system.level);

      }
    }
  }
}
