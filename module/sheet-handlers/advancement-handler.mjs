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
    for (const item of actor.items) {
      if (item.type == "role") {

      }
    }
  }

}
