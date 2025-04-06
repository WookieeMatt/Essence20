import ChoicesSelector from "../apps/choices-selector.mjs";
import { E20 } from "../helpers/config.mjs";
import { deleteAttachmentsForItem } from "./attachment-handler.mjs";

const SORCERY_PERK_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.xUBOE1s5pgVyUrwj";
const ZORD_PERK_ID = "Compendium.essence20.pr_crb.Item.rCpCrfzMYPupoYNI";
const MORPHIN_TIME_PERK_ID = "Compendium.essence20.pr_crb.Item.UFMTHB90lA9ZEvso";

/**
 * Handle the dropping of a Perk onto an Actor
 * @param {Actor} actor The Actor receiving the Perk
 * @param {Perk} perk The Perk being dropped
 * @param {Function} dropFunc The function to call to complete the Power drop
 */
export async function onPerkDrop(actor, perk, dropFunc, selection, selectionType, parentPerk) {
  let updateString = null;
  let updateValue = null;
  let newPerk = null;

  if (selectionType == 'environments') {
    updateString = "system.environments";
    updateValue = actor.system.environments;
    updateValue.push(selection);
    actor.update({
      [updateString]: updateValue,
    });
  } else if (selectionType == 'senses') {
    updateString = `system.senses.${selection}.acute`;
    actor.update({
      [updateString]: true,
    });
  }

  let timesTaken = 0;

  for (let actorItem of actor.items) {
    const itemSourceId = foundry.utils.isNewerVersion('12', game.version)
      ? await actor.items.get(actorItem._id).getFlag('core', 'sourceId')
      : await actor.items.get(actorItem._id)._stats.compendiumSource;
    if (actorItem.type == 'perk' && itemSourceId == perk.uuid) {
      timesTaken++;
      if (perk.system.selectionLimit == timesTaken) {
        ui.notifications.error(game.i18n.localize('E20.PerkAlreadyTaken'));
        return;
      }
    }
  }

  if (parentPerk) {
    newPerk = await Item.create(perk, { parent: actor });
    for (const [key, attachment] of Object.entries(parentPerk.system.items)) {
      if (perk.uuid == attachment.uuid){
        newPerk.setFlag('essence20', 'collectionId', key);
      }
    }

    newPerk.setFlag('essence20', 'parentId', parentPerk._id);
    newPerk.update({
      "_stats.compendiumSource": perk.uuid,
    });

  } else {
    const perkDrop = await dropFunc();
    newPerk = perkDrop[0];
  }

  if (selectionType == 'environments' || selectionType == 'senses') {
    let localizedSelection = null;
    if (selectionType == 'environments') {
      localizedSelection = game.i18n.localize(E20.environments[selection]);
    } else if (selectionType == 'senses') {
      localizedSelection = game.i18n.localize(E20.senses[selection]);
    }
    const newName = `${newPerk.name} (${localizedSelection})`;
    newPerk.update({
      "name": newName,
      "system.choice": selection,
    })
  } else if (selectionType == 'perks') {
    const chosenPerk = perk.system.items[selection];
    const itemToCreate = await fromUuid(chosenPerk.uuid);

    if (itemToCreate.system.choiceType != 'none') {
      setPerkValues(actor, itemToCreate, newPerk, null)
    }
  }

}

/**
 * Handles setting values for specific perks and creating an options for perks
 * @param {Actor} actor The Actor receiving the Perk
 * @param {Perk} perk The Perk being dropped
 * @param {Function} dropFunc The function to call to complete the Power drop
 */
export async function setPerkValues(actor, perk, parentPerk, dropFunc) {
  let selection = null;
  if (perk.uuid == SORCERY_PERK_ID) {
    await actor.update ({
      "system.powers.sorcerous.levelTaken": actor.system.level,
    });
  } else if (perk.uuid == ZORD_PERK_ID) {
    await actor.update ({
      "system.canHaveZord": true,
    });
  } else if (perk.uuid == MORPHIN_TIME_PERK_ID) {
    setMorphedToughnessBonus(actor);
  }

  if (perk.system.choiceType != 'none') {
    let choices = {};
    let prompt = null;
    let title = game.i18n.localize("E20.PerkSelect");;

    if (perk.system.choiceType == 'environments') {
      prompt = game.i18n.localize("E20.SelectEnvironment");
      for (const environment of Object.keys(CONFIG.E20.environments)) {
        if (!actor.system.environments.includes(environment)) {
          const localizedLabel = game.i18n.localize(E20.environments[environment]);
          choices[environment] = {
            chosen: false,
            value: environment,
            label: localizedLabel,
            type: perk.system.choiceType,
          };
        }
      }

    } else if (perk.system.choiceType == 'senses') {
      prompt = game.i18n.localize("E20.SelectSense");
      for (const sense of Object.keys(CONFIG.E20.senses)) {
        if (!actor.system.senses[sense].acute) {
          const localizedLabel = game.i18n.localize(E20.senses[sense]);
          choices[sense] = {
            chosen: false,
            value: sense,
            label: localizedLabel,
            type: perk.system.choiceType,
          };
        }
      }

    } else if (perk.system.choiceType == 'perks') {
      prompt = game.i18n.localize("E20.SelectPerk");
      for (const [key, item] of Object.entries(perk.system.items)) {
        choices[key] = {
          chosen: false,
          value: key,
          label: item.name,
          uuid: item.uuid,
          type: perk.system.choiceType,
        }
      }
    }
    if (parentPerk){
      selection = await new ChoicesSelector (choices, actor, prompt, title, perk, null, dropFunc, null, parentPerk, null).render(true)
    } else {
      selection = await new ChoicesSelector (choices, actor, prompt, title, perk, null, dropFunc, null, null, null).render(true)
    }

  } else {
    return await onPerkDrop(actor, perk, dropFunc, null, null)
  }

}
/**
 * Handle the deleting of a Perk on an Actor
 * @param {Actor} actor The Actor receiving the Perk
 * @param {Perk} perk The perk
 */
export async function onPerkDelete(actor, perk) {
  if (perk.flags.core?.sourceId == SORCERY_PERK_ID || perk._stats.compendiumSource == SORCERY_PERK_ID ) {
    await actor.update ({
      "system.powers.sorcerous.levelTaken": 0,
    });
  }

  if (perk.flags.core?.sourceId == ZORD_PERK_ID || perk._stats.compendiumSource == ZORD_PERK_ID ) {
    await actor.update ({
      "system.canHaveZord": false,
    });
  }
  if (perk.flags.core?.sourceId == MORPHIN_TIME_PERK_ID || perk._stats.compendiumSource == MORPHIN_TIME_PERK_ID ) {
    await actor.update ({
      "system.canSetToughnessBonus": false,
      "system.defenses.toughness.morphed": 0,
    });
  }

  let updateString = null;
  let updateValue = null;
  if (perk.system.choiceType != "none") {
    const selectionType = perk.system.choiceType;
    if (selectionType == 'environments') {
      updateString = "system.environments";
      updateValue = actor.system.environments;
      const index = updateValue.indexOf(perk.system.choice);
      updateValue.splice(index, 1);
      actor.update({
        [updateString]: updateValue,
      })
    } else if (selectionType == 'senses') {
      updateString = `system.senses.${perk.system.choice}.acute`;
      actor.update({
        [updateString]: false,
      })
    }
  }

  deleteAttachmentsForItem(perk, actor)
}

/**
 * Handles the changing of the Defense Toughness Morphed bonus.
 * @param {Actor} actor The Actor whose bonus is changing
 */
export async function setMorphedToughnessBonus(actor) {
  let morphedBonus = 0;
  if (actor.system.trained.armors.ultraHeavy) {
    morphedBonus = CONFIG.E20.morphedToughness.ultraHeavy;
  } else if (actor.system.trained.armors.heavy) {
    morphedBonus = CONFIG.E20.morphedToughness.heavy;
  } else if (actor.system.trained.armors.medium) {
    morphedBonus = CONFIG.E20.morphedToughness.medium;
  } else if (actor.system.trained.armors.light) {
    morphedBonus = CONFIG.E20.morphedToughness.light;
  }

  await actor.update ({
    "system.canSetToughnessBonus": true,
    "system.defenses.toughness.morphed": morphedBonus,
  });
}

