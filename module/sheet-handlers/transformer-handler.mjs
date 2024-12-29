import TransformOptionPrompt from "../apps/transform-option-prompt.mjs";
import { resizeTokens } from "../helpers/actor.mjs";
import { getItemsOfType } from "../helpers/utils.mjs";

/**
 * Handles AltModes being deleted
 * @param {ActorSheet} actorSheet The ActorSheet having an Alt Mode deleted
 * @param {AltMode} altMode The deleted Alt Mode.
 */
export async function onAltModeDelete(actorSheet, altMode) {
  const altModes = getItemsOfType("altMode", actorSheet.actor.items);
  if (altModes.length > 1) {
    if (altMode._id == actorSheet.actor.system.altModeId) {
      _transformBotMode(actorSheet);
    }
  } else {
    _transformBotMode(actorSheet);
  }
}

/**
 * Handles clicking the transform button
 * @param {ActorSheet} actorSheet The ActorSheet being transformed
 */
export async function onTransform(actorSheet) {
  const actor = actorSheet.actor;
  const altModes = getItemsOfType("altMode", actor.items);
  const isTransformed = actor.system.isTransformed;

  if (!altModes.length && !isTransformed) {      // No alt-modes to transform into
    ui.notifications.warn(game.i18n.localize('E20.AltModeNone'));
  } else if (altModes.length > 1) {              // Select from multiple alt-modes
    if (!isTransformed) {
      _showAltModeChoiceDialog(actorSheet, altModes, false); // More than 1 altMode and not transformed
    } else {
      _showAltModeChoiceDialog(actorSheet, altModes, true);  // More than 1 altMode and transformed
    }
  } else {                                       // Alt-mode/bot-mode toggle
    isTransformed
      ? _transformBotMode(actorSheet)
      : _transformAltMode(actorSheet, altModes[0]);
  }
}

/**
 * Handle Transforming back into the Bot Mode
 * @param {ActorSheet} actorSheet The ActorSheet being transformed
 * @private
 */
async function _transformBotMode(actorSheet) {
  const actor = actorSheet.actor;
  const width = CONFIG.E20.tokenSizes[actor.system.size].width;
  const height = CONFIG.E20.tokenSizes[actor.system.size].height;
  resizeTokens(actor, width, height);

  await actor.update({
    "prototypeToken.height": height,
    "prototypeToken.width": width,
    "system.movement.aerial.altMode": 0,
    "system.movement.swim.altMode": 0,
    "system.movement.ground.altMode": 0,
    "system.isTransformed": false,
    "system.altModeId": "",
    "system.altModesize": "",
  }).then(actorSheet.render(false));
}

/**
 * Handles Transforming into an Alt Mode
 * @param {ActorSheet} actorSheet The ActorSheet being transformed
 * @param {AltMode} altMode The alt-mode that was selected to transform into
 * @private
 */
async function _transformAltMode(actorSheet, altMode) {
  const actor = actorSheet.actor;
  const width = CONFIG.E20.tokenSizes[altMode.system.altModesize].width;
  const height = CONFIG.E20.tokenSizes[altMode.system.altModesize].height;
  resizeTokens(actor, width, height);

  await actor.update({
    "prototypeToken.height": height,
    "prototypeToken.width": width,
    "system.movement.aerial.altMode": altMode.system.altModeMovement.aerial,
    "system.movement.swim.altMode": altMode.system.altModeMovement.aquatic,
    "system.movement.ground.altMode": altMode.system.altModeMovement.ground,
    "system.altModesize": altMode.system.altModesize,
    "system.altModeId": altMode._id,
    "system.isTransformed": true,
  }).then(actorSheet.render(false));
}

/**
 * Creates the Alt Mode choice list dialog
 * @param {ActorSheet} actorSheet The ActorSheet being transformed
 * @param {AltMode[]} altModes A list of the available Alt Modes
 * @param {Boolean} isTransformed Whether the Transformer is transformed or not
 * @private
 */
async function _showAltModeChoiceDialog(actorSheet, altModes, isTransformed) {
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

  const title = "E20.AltModeChoice";
  new TransformOptionPrompt(choices, actorSheet, altModes, title).render(true);
}

/**
 * Handles selecting an Alt Mode from the Alt Mode dialog
 * @param {ActorSheet} actorSheet The ActorSheet being transformed
 * @param {AltMode[]} altModes A list of the available Alt Modes
 * @param {Object} options The options resulting from _showAltModeDialog()
 * @private
 */
export async function _altModeSelect(actorSheet, altModes, selectedForm) {
  let transformation = null;

  if (!selectedForm) {
    return;
  }

  if (selectedForm == "BotMode") {
    _transformBotMode(actorSheet);
  } else {
    for (const mode of altModes) {
      if (selectedForm == mode._id) {
        transformation = mode;
        break;
      }
    }

    if (transformation) {
      _transformAltMode(actorSheet, transformation);
    }
  }
}
