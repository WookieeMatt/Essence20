import {
  parseId,
} from "../helpers/utils.mjs";

const SORCERY_PERK_ID = "xUBOE1s5pgVyUrwj";

/**
 * Handle the dropping of a Perk onto an Actor
 * @param {Actor} actor The Actor receiving the Perk
 * @param {Perk} perk The Perk being dropped
 * @param {Function} dropFunc The function to call to complete the Power drop
 */
export async function perkUpdate(actor, perk, dropFunc) {
  const perkUuid = parseId(perk.uuid);
  let timesTaken = 0;

  if (perkUuid == SORCERY_PERK_ID) {
    await actor.update ({
      "system.powers.sorcerous.levelTaken": actor.system.level,
    });
  }

  for (let actorItem of actor.items) {
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

/**
 * Handle the deleting of a Perk on an Actor
 * @param {Actor} actor The Actor receiving the Perk
 * @param {Perk} perk The perk
 */
export async function onPerkDelete(actor, perk) {
  const perkUuid = perk.system.originalId;

  if (perkUuid == SORCERY_PERK_ID) {
    await actor.update ({
      "system.powers.sorcerous.levelTaken": 0,
    });
  }
}
