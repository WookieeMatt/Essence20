import {
  parseId,
} from "../helpers/utils.mjs";

const SORCERY_PERK_ID = "xUBOE1s5pgVyUrwj";

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
    const perkUuid = parseId(perk.uuid);
    let timesTaken = 0;

    if (perkUuid == SORCERY_PERK_ID) {
      await this._actor.update ({
        "system.power.sorcerous.levelTaken": this._actor.system.level,
      });
    }

    for (let actorItem of this._actor.items) {
      if (actorItem.type == 'perk' && actorItem.system.originalId == perkUuid) {
        timesTaken++;
        if (perk.system.selectionLimit == timesTaken) {
          ui.notifications.error(game.i18n.localize('E20.PerkAlreadyTaken'));
          return;
        }
      }
    }

    const newPerkList = await dropFunc();
    const newPerk = newPerkList[0];

    await newPerk.update ({
      "system.originalId": perkUuid,
    });
  }
}
