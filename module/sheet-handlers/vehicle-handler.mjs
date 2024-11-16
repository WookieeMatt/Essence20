import { checkIsLocked } from "../helpers/actor.mjs";
import { rememberOptions } from "../helpers/dialog.mjs";
import { _getItemDeleteConfirmDialog } from "./listener-item-handler.mjs";

/**
 * Prepare Actors that are attached to other actors
 * @param {Actor} actor The actor that has attached actors
 * @param {Object} context The actor data to prepare
*/
export function prepareSystemActors(actor, context) {
  if (Object.keys(actor.system.actors).length > 0) {
    const actors = {};


    for (const [ key, embeddedActor] of Object.entries(actor.system.actors)) {
      const fullActor = fromUuidSync(embeddedActor.uuid);
      actors[key] = fullActor;
    }

    context.actors = actors;
  }
}

/**
 * Handle deleting of actors from other actors
 * @param {Event} event The originating click event
 * @param {ActorSheet} actorSheet The ActorSheet whose actor is being deleted
 */
export async function onSystemActorsDelete(event, actorSheet) {
  const actor = actorSheet.actor;
  if (checkIsLocked(actor)) {
    return;
  }

  const li = $(event.currentTarget).closest(".systemActors");
  const systemActorsId = li.data("systemActorsUuid");

  // return if no item is found.
  if (!systemActorsId) {
    return;
  }

  let keyId = null;
  let selectedActor = {};
  for (const [ key , embeddedActor] of Object.entries(actor.system.actors)) {
    if (embeddedActor.uuid == systemActorsId) {
      keyId = key;
      selectedActor = embeddedActor;
      break;
    }
  }

  // Confirmation dialog
  const confirmation = await _getItemDeleteConfirmDialog(selectedActor);
  if (confirmation.cancelled) {
    return;
  }

  const updateString = `system.actors.-=${keyId}`;

  await actor.update({[updateString]: null});
  li.slideUp(200, () => actorSheet.render(false));
}

export async function onVehicleRoleUpdate(event, actorSheet) {
  const actor = actorSheet.actor;
  if (checkIsLocked(actor)) {
    return;
  }

  const key = event.currentTarget.attributes.key.value;
  const newRole = event.currentTarget.value;
  let numberOfType = 0;
  let updateValue = false;

  for (const [,passenger] of Object.entries(actor.system.actors)) {
    if (passenger.vehicleRole == newRole) {
      numberOfType++;
    }
  }

  if (newRole == 'driver') {
    if (numberOfType < actor.system.crew.numDrivers) {
      updateValue = true;
    }
  } else {
    if (numberOfType < actor.system.crew.numPassengers) {
      updateValue = true;
    }
  }

  if (updateValue) {
    const updateString = `system.actors.${key}.vehicleRole`;

    await actor.update ({
      [updateString]: newRole,
    });
  } else {
    const dialogResult = await Dialog.wait({
      title: "Flip Driver and Passenger?",
      content: game.i18n.localize('E20.VehicleDialogSwap'),
      buttons: {
        yes: {
          label: "Yes",
        },
        no: {
          label: "No",
        },
      },
    });

    if (dialogResult == "no") {
      ui.notifications.error(game.i18n.localize('E20.VehicleRoleError'));
      actor.render();
    } else {
      let choices = {};
      for (const [selectedKey,passenger] of Object.entries(actor.system.actors)) {
        if (selectedKey != key && passenger.vehicleRole == newRole) {
          choices[selectedKey] = {
            chosen: false,
            label: passenger.name,
          };
        }
      }

      await Dialog.wait({
        title: game.i18n.localize('E20.VehicleDialogSwapSelect'),
        content: await renderTemplate("systems/essence20/templates/dialog/option-select.hbs", {
          choices,
        }),
        buttons: {
          ok: {
            label: game.i18n.localize('E20.DialogConfirmButton'),
            callback: html => _flipDriverAndPassenger(actor, key, newRole, rememberOptions(html)),
          },
          cancel: {
            label: game.i18n.localize('E20.DialogCancelButton'),
            callback: actor.render(),
          },
        },
      });
    }
  }
}

function _flipDriverAndPassenger(actor, key, newRole, options) {
  let flippedRole = "";
  for (const [optionKey, value] of Object.entries(options)) {
    if (value) {
      const updateString = `system.actors.${optionKey}.vehicleRole`;
      if (newRole == 'driver') {
        flippedRole = 'passenger';
      } else {
        flippedRole = 'driver';
      }

      actor.update ({
        [updateString]: flippedRole,
      });

    }
  }

  const updateString = `system.actors.${key}.vehicleRole`;
  actor.update ({
    [updateString]: newRole,
  });

}

export async function onCrewNumberUpdate(event, actorSheet) {
  const target = event.currentTarget.name;
  let targetShortName = "";
  if (target == "system.crew.numDrivers") {
    targetShortName = "driver";
  } else if (target == "system.crew.numPassengers") {
    targetShortName = "passenger";
  }

  const actor = actorSheet.actor;
  const newValue = event.currentTarget.value;

  let numberOfType = 0;

  for (const [,driver] of Object.entries(actor.system.actors)) {
    if (driver.vehicleRole == targetShortName) {
      numberOfType++;
    }
  }

  if (numberOfType > newValue) {
    ui.notifications.error(game.i18n.localize('E20.VehicleRoleErrorTooManyCrew'));
    await actor.update({
      [target]: numberOfType,
    });
    actor.render();
  }
}
