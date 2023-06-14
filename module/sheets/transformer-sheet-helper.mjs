import { getItemsOfType, rememberOptions } from "../helpers/utils.mjs";

/**
 * Handle clicking the transform button
 * @param {Essence20ActorSheet} actorSheet The actor sheet
 */
export async function onTransform(actorSheet) {
  const actor = actorSheet.actor;
  const altModes = getItemsOfType("altMode", actor.items);

  if (!altModes.length && !actor.system.isTransformed) {      // No alt-modes to transform into
    ui.notifications.warn(game.i18n.localize('E20.AltModeNone'));
  } else if (altModes.length > 1) {                           // Select from multiple alt-modes
    if (!actor.system.isTransformed) {
      showAltModeChoiceDialog(altModes, false, actorSheet);   // More than 1 altMode and not transformed
    } else {
      showAltModeChoiceDialog(altModes, true, actorSheet);    // More than 1 altMode and transformed
    }
  } else {                                                    // Alt-mode/bot-mode toggle
    actor.system.isTransformed
      ? transformBotMode(actorSheet)
      : transformAltMode(altModes[0], actorSheet);
  }
}

/**
 * Handle Transforming back into the Bot Mode
 * @param {Essence20ActorSheet} actorSheet The actor sheet
 */
export async function transformBotMode(actorSheet) {
  const actor = actorSheet.actor;
  await actor.update({
    "system.movement.aerial.altMode": 0,
    "system.movement.swim.altMode": 0,
    "system.movement.ground.altMode": 0,
    "system.isTransformed": false,
    "system.altModeId": "",
    "system.altModeSize": "",
  }).then(actorSheet.render(false));
}

/**
 * Handles Transforming into an AltMode
 * @param {AltMode} altMode                The alt-mode that was selected to Transform into
 * @param {Essence20ActorSheet} actorSheet The actor sheet
 */
export async function transformAltMode(altMode, actorSheet) {
  const actor = actorSheet.actor;
  await actor.update({
    "system.movement.aerial.altMode": altMode.system.altModeMovement.aerial,
    "system.movement.swim.altMode": altMode.system.altModeMovement.aquatic,
    "system.movement.ground.altMode": altMode.system.altModeMovement.ground,
    "system.altModeSize": altMode.system.altModesize,
    "system.altModeId": altMode._id,
    "system.isTransformed": true,
  }).then(actorSheet.render(false));
}

/**
 * Creates the Alt Mode Choice List Dialog
 * @param {AltMode[]} altModes  A list of the available Alt Modes
 * @param {Boolean} isTransformed Whether the Transformer is transformed or not
 * @param {Essence20ActorSheet} actorSheet The actor sheet
 * @private
 */
export async function showAltModeChoiceDialog(altModes, isTransformed, actorSheet) {
  const actor = actorSheet.actor;
  const choices = {};
  if (isTransformed) {
    choices["BotMode"] = {
      chosen: false,
      label: "BotMode",
    };
  }

  for (const altMode of altModes) {
    if (actor.system.altModeId != altMode._id) {
      choices[altMode._id] = {
        chosen: false,
        label: altMode.name,
      };
    }
  }

  new Dialog(
    {
      title: game.i18n.localize('E20.AltModeChoice'),
      content: await renderTemplate("systems/essence20/templates/dialog/option-select.hbs", {
        choices,
      }),
      buttons: {
        save: {
          label: game.i18n.localize('E20.AcceptButton'),
          callback: html => altModeSelect(altModes, rememberOptions(html), actorSheet),
        },
      },
    },
  ).render(true);
}

/**
 * Handle selecting an alt-mode from the Alt-mode Dialog
 * @param {AltMode[]} altModes  A list of the available Alt Modes
 * @param {Object} options   The options resulting from _showAltModeDialog()
 * @param {Essence20ActorSheet} actorSheet The actor sheet
 */
export async function altModeSelect(altModes, options, actorSheet) {
  let selectedForm = null;
  let transformation = null;

  for (const [altMode, isSelected] of Object.entries(options)) {
    if (isSelected) {
      selectedForm = altMode;
      break;
    }
  }

  if (!selectedForm) {
    return;
  }

  if (selectedForm == "BotMode") {
    transformBotMode(actorSheet);
  } else {
    for (const mode of altModes) {
      if (selectedForm == mode._id) {
        transformation = mode;
        break;
      }
    }

    if (transformation) {
      transformAltMode(transformation, actorSheet);
    }
  }
}

/**
 * Handle AltModes being deleted
 * @param {AltMode} altMode                The deleted AltMode.
 * @param {Essence20ActorSheet} actorSheet The actor sheet
 */
export async function onAltModeDelete(altMode, actorSheet) {
  const actor = actorSheet.actor;

  const altModes = getItemsOfType("altMode", actor.items);
  if (altModes.length > 1) {
    if (altMode._id == actor.system.altModeId) {
      transformBotMode(actorSheet);
    }
  } else {
    transformBotMode(actorSheet);
  }
}
