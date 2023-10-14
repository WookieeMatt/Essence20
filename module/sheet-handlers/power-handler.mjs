export class PowerHandler {
  /**
  * Constructor
  * @param {Essence20ActorSheet} actorSheet The actor sheet
  */
  constructor(actorSheet) {
    this._actorSheet = actorSheet;
    this._actor = actorSheet.actor;
  }

  /**
  * Handle the dropping of a power on to a character
  * @param {Power} power The power
  * @param {Function} dropFunc   The function to call to complete the Power drop
  */

  async powerUpdate(power, dropFunc) {
    const newPowerList = await dropFunc();
    const newPower = newPowerList[0];
    console.log(power, newPower);
  }
}
