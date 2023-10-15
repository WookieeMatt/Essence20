import {
  parseId,
} from "../helpers/utils.mjs";

export class PerkHandler {

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

    if (perkUuid == "xUBOE1s5pgVyUrwj") {
      Item.create(
        {
          name: game.i18n.localize('E20.SorcerousPower'),
          type: 'classFeature',
          data: {},
        },
        { parent: this._actor},
      );
    }

    const newPerkList = await dropFunc();
    const newPerk = newPerkList[0];

    await newPerk.update ({
      "system.originalId": perkUuid,
    });

  }
}
