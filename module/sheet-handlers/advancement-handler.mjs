export class AdvancementHandler {
  /**
  * Constructor
  * @param {Essence20ActorSheet} actorSheet The actor sheet
  */
  constructor(actorSheet) {
    this._actorSheet = actorSheet;
    this._actor = actorSheet.actor;
  }

  onLevelChange(actor) {
    const lastLevelUp = this._actor.getFlag('essence20', 'lastLevelUp');
    if (lastLevelUp) {
      if (this._actor.system.level != actor.flags.essence20.lastLevelUp) {
        this._actor.setFlag('essence20', 'lastLevelUp', this._actor.system.level);
      }
    }
  }
}
