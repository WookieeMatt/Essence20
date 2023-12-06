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
    if (actor.flags.essence20.lastLevelUp) {
      if (this._actor.system.level != actor.flags.essence20.lastLevelUp) {
        this._actor.seFlag('essence20', 'lastLevelUp', this._actor.system.level);
      }
    }
  }
}
