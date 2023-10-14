export class AlterationHandler {

  /**
  * Constructor
  * @param {Essence20ActorSheet} actorSheet The actor sheet
  */
  constructor(actorSheet) {
    this._actorSheet = actorSheet;
    this._actor = actorSheet.actor;
  }

  async perkUpdate(perk, dropFunc) {
    const perkUuid = parseId(perk.uuid);

    const newPerkList = await dropFunc();
    const newPerk = newPerkList[0];


  }
}
