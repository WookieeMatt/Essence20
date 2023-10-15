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

  /**
  * Handle the dropping of a power on to a character
  * @param {Perk} perk The perk
  * @param {Function} dropFunc   The function to call to complete the Power drop
  */
  async perkUpdate(perk, dropFunc) {
    const SORCERY_PERK_ID = "xUBOE1s5pgVyUrwj";
    const perkUuid = parseId(perk.uuid);

    if (perkUuid == SORCERY_PERK_ID) {
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
