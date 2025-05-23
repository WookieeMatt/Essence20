import ChoicesSelector from "../apps/choices-selector.mjs";
import MultiChoiceSelector from "../apps/multi-choice-selector.mjs";
import { E20 } from "../helpers/config.mjs";
import { deleteAttachmentsForItem } from "./attachment-handler.mjs";

const SORCERY_PERK_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.xUBOE1s5pgVyUrwj";
const ZORD_PERK_ID = "Compendium.essence20.pr_crb.Item.rCpCrfzMYPupoYNI";

/**
 * Handle the dropping of a Perk onto an Actor
 * @param {Actor} actor The Actor receiving the Perk
 * @param {Perk} perk The Perk being dropped
 * @param {Function} dropFunc The function to call to complete the Power drop
 * @param {String} selection The selection from the Choices Selector App
 * @param {String} selectionType The type of selection that was made in the Choices Selector App
 * @param {Perk} parentPerk The Perk that the current Perk was attached to
 */
export async function onPerkDrop(actor, perk, dropFunc=null, selection=null, selectionType=null, parentPerk=null) {
  let updateString = null;
  let updateValue = null;
  let newPerk = null;
  let currentRole = null;

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
  } else if (selectionType == 'movement') {
    updateString = `system.movement.${selection}.bonus`;
    const updateValue = actor.system.movement[selection].bonus + perk.system.value;
    actor.update({
      [updateString]: updateValue,
    });
  }

  let timesTaken = 0;

  for (let actorItem of actor.items) {
    if (actorItem.type == "role"){
      currentRole = actorItem;
    }

    const itemSourceId = await actor.items.get(actorItem._id)._stats.compendiumSource;
    if (actorItem.type == 'perk' && itemSourceId == perk.uuid) {
      timesTaken++;
      if (perk.system.selectionLimit == timesTaken || (perk.system.selectionLimit == actorItem.system.advances.currentValue/actorItem.system.advances.increaseValue)) {
        ui.notifications.error(game.i18n.localize('E20.PerkAlreadyTaken'));
        return;
      }

      if (perk.system.advances.canAdvance) {
        const newValue = actorItem.system.advances.currentValue + actorItem.system.advances.increaseValue;
        await actorItem.update({
          "system.advances.currentValue": newValue,
        });
        setPerkAdvancesName (actorItem, perk.name);
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
  } else if (!dropFunc) {
    newPerk = perk;
  } else {
    const perkDrop = await dropFunc();
    newPerk = perkDrop[0];
  }

  if (['environments', 'senses', 'movement'].includes(selectionType)) {
    const localizedSelection = (selectionType == 'movement') ? game.i18n.localize(E20.movementTypes[selection]) : game.i18n.localize(E20[selectionType][selection]);
    const newName = `${newPerk.name} (${localizedSelection})`;
    newPerk.update({
      "name": newName,
      "system.choice": selection,
    });
  } else if (selectionType == 'perks') {
    const chosenPerk = perk.system.items[selection];
    const itemToCreate = await fromUuid(chosenPerk.uuid);

    if (itemToCreate.system.hasChoice) {
      setPerkValues(actor, itemToCreate, newPerk, null);
    } else {
      const createdPerk = await Item.create(itemToCreate, { parent: actor });
      createdPerk.setFlag('essence20', 'collectionId', selection);
      createdPerk.setFlag('essence20', 'parentId', newPerk._id);
      createdPerk.update({
        "_stats.compendiumSource": itemToCreate.uuid,
      });
    }
  }

  if (newPerk?.system.isRoleVariant) {
    setRoleVatiantPerks(newPerk, currentRole, actor);
  }

  if (newPerk.system.advances.canAdvance) {
    await newPerk.update({
      "system.advances.currentValue": newPerk.system.advances.baseValue,
    });
    const originalName = newPerk.name;
    setPerkAdvancesName(newPerk, originalName);
  }

  return newPerk;
}

/**
 * Handles setting values for specific Perks and and displays a ChoicesSelector if needed
 * @param {Actor} actor The Actor receiving the Perk
 * @param {Perk} perk The Perk being dropped
 * @param {Perk} parentPerk The Perk this perk is attached to
 * @param {Function} dropFunc The function to call to complete the Perk drop
 */
export async function setPerkValues(actor, perk, parentPerk=null, dropFunc=null) {
  if (perk.uuid == SORCERY_PERK_ID) {
    await actor.update ({
      "system.powers.sorcerous.levelTaken": actor.system.level,
    });
  } else if (perk.uuid == ZORD_PERK_ID) {
    await actor.update ({
      "system.canHaveZord": true,
    });
  } else if (perk.system.hasMorphedToughnessBonus) {
    setMorphedToughnessBonus(actor);
  }

  if (perk.system.hasChoice) {
    let choices = {};
    let prompt = null;
    let title = game.i18n.localize("E20.PerkSelect");

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
    } else if (perk.system.choiceType == 'movement') {
      prompt = game.i18n.localize("E20.SelectMovement");
      for (const movement of Object.keys(actor.system.movement)) {
        if (actor.system.movement[movement].base > 0){
          const localizedLabel = game.i18n.localize(E20.movementTypes[movement]);
          choices[movement] = {
            chosen: false,
            value: movement,
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
      if (perk.system.numChoices > 1) {
        prompt = game.i18n.format(
          'E20.SelectMultiplePerks',
          {
            numChoices: perk.system.numChoices,
          },
        );
      } else {
        prompt = game.i18n.localize("E20.SelectPerk");
      }

      for (const [key, item] of Object.entries(perk.system.items)) {
        let taken = false;
        for (const attachedItem of actor.items) {
          if (item.uuid == attachedItem._stats.compendiumSource) {
            taken = true;
            break;
          }
        }

        if (!taken) {
          choices[key] = {
            chosen: false,
            value: key,
            label: item.name,
            uuid: item.uuid,
            type: perk.system.choiceType,
          };
        }
      }
    }

    if (Object.entries(choices).length){
      ui.notifications.error(game.i18n.localize('E20.NoChoicesError'));
      return false;
    }

    if (perk.system.numChoices > 1 && perk.system.choiceType == "perks") {
      await new MultiChoiceSelector(choices, actor, prompt, title, perk, dropFunc, parentPerk).render(true);
    } else {
      await new ChoicesSelector(choices, actor, prompt, title, perk, null, dropFunc, null, parentPerk, null).render(true);
    }

  } else {
    return await onPerkDrop(actor, perk, dropFunc, null, null);
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

  if (perk.system.hasMorphedToughnessBonus ) {
    await actor.update ({
      "system.canSetToughnessBonus": false,
      "system.defenses.toughness.morphed": 0,
    });
  }

  let updateString = null;
  let updateValue = null;
  const selectionType = perk.system.choiceType;
  if (selectionType == 'environments') {
    updateString = "system.environments";
    updateValue = actor.system.environments;
    const index = updateValue.indexOf(perk.system.choice);
    updateValue.splice(index, 1);
    actor.update({
      [updateString]: updateValue,
    });
  } else if (selectionType == 'senses') {
    updateString = `system.senses.${perk.system.choice}.acute`;
    actor.update({
      [updateString]: false,
    });
  } else if (selectionType == 'movement') {
    updateString = `system.movement.${perk.system.choice}.bonus`;
    const updateValue = actor.system.movement[perk.system.choice].bonus - perk.system.value;
    actor.update({
      [updateString]: updateValue,
    });
  }

  deleteAttachmentsForItem(perk, actor);
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

/**
 * Handles adding subperks that have an associated role
 * @param {Perk} newPerk The new perk that is being added to the actor from the faction.
 * @param {Role} currentRole The current role assigned to the actor.
 * @param {Actor} actor The actor that the faction is being dropped on.
 */
async function setRoleVatiantPerks(newPerk, currentRole, actor) {
  for (const [key, perk] of Object.entries(newPerk.system.items)) {
    if (currentRole?.name == perk.role) {
      const itemToCreate = await fromUuid(perk.uuid);
      if (itemToCreate.system.choiceType != 'none') {
        setPerkValues(actor, itemToCreate, perk, null);
      } else {
        const createdPerk = await Item.create(itemToCreate, { parent: actor });
        createdPerk.setFlag('essence20', 'collectionId', key);
        createdPerk.setFlag('essence20', 'parentId', newPerk._id);
        createdPerk.update({
          "_stats.compendiumSource": newPerk.uuid,
        });
      }
    }
  }
}

/**
 * Handles updating the perk name with the advancement data.
 * @param {Perk} perk The perk whose name is getting updated.
 * @param {String} originalName The name from the perk being added.
 */
function setPerkAdvancesName(perk, originalName) {
  let localizedString = null;
  switch (perk.system.advances.type) {
  case 'area':
    localizedString = perk.system.advances.currentValue + "' x " + perk.system.advances.currentValue + "'";
    break;
  case 'die':
    localizedString = '1d' + perk.system.advances.currentValue;
    break;
  case 'seconds':
    localizedString = perk.system.advances.currentValue + "s";
    break;
  case 'upshift':
    localizedString = '\u2191' + perk.system.advances.currentValue;
    break;
  }

  const newName = `${originalName} (${localizedString})`;

  perk.update({
    "name": newName,
  });
}
