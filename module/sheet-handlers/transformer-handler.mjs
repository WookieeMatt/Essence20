import { spend } from "../mechanics/actions/action-economy.mjs";
import TransformOptionSelector from "../apps/transform-option-selector.mjs";
import { changeTokenImage, resizeTokens } from "../mechanics/world/token-sync.mjs";
import { warnMissingStateImage } from "../mechanics/characters/morph-state.mjs";
import { triggerModeAttachmentCheck } from "../items/forms/mode-attachment.mjs";


/**
 * Handles AltModes being deleted
 * @param {ActorSheet} actorSheet The ActorSheet having an Alt Mode deleted
 * @param {AltMode} altMode The deleted Alt Mode.
 */
export async function onAltModeDelete(actorSheet, altMode) {
  const altModes = actorSheet.actor.items.documentsByType.altMode;
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
 * @param {Actor} actor The Actor being transformed
 */
export async function onTransform(actor) {
  // Mode Lock (Enigma of Combination, Weapon Traits/Conditions, p.49) - see dice.mjs#_applyModeLock's
  // own doc comment. "Can't convert from their current Mode" blocks the transform button outright,
  // the one point every Bot Mode <-> Alt Mode conversion in this codebase funnels through.
  if (actor.statuses?.has('modeLock')) {
    ui.notifications.warn(game.i18n.format('E20.ModeLockPreventsConversion', { name: actor.name }));
    return;
  }

  const altModes = actor.items.documentsByType.altMode;
  const isTransformed = actor.system.isTransformed;

  // Converting is a Standard action (TF CRB p.111: Quick Change makes "that sequence require a Free
  // action to enact instead of a Standard action"). Charged only in combat; a player who backs out
  // of the "how do you pay?" question hasn't converted.
  if (altModes.length || isTransformed) {
    const paid = await spend(actor, 'standard', {
      source: game.i18n.localize('E20.ActionConvert'), context: { kind: 'conversion' },
    });
    if (paid.blocked) {
      if (!paid.cancelled) {
        ui.notifications.warn(game.i18n.format('E20.ActionEconomyUnaffordable', {
          name: actor.name, action: game.i18n.localize('E20.ActionConvert'),
        }));
      }

      return;
    }
  }

  if (!actor.system.isTransformed ) {
    await actor.update ({
      "system.image.botmode": actor.prototypeToken.texture.src,
    });
  }

  if (!altModes.length && !isTransformed) {      // No alt-modes to transform into
    ui.notifications.warn(game.i18n.localize('E20.AltModeNone'));
  } else if (altModes.length > 1) {              // Select from multiple alt-modes
    if (!isTransformed) {
      _showAltModeChoiceDialog(actor, altModes, false); // More than 1 altMode and not transformed
    } else {
      _showAltModeChoiceDialog(actor, altModes, true);  // More than 1 altMode and transformed
    }
  } else {                                       // Alt-mode/bot-mode toggle
    isTransformed
      ? _transformBotMode(actor)
      : _transformAltMode(actor, altModes[0]);
  }
}

/**
 * Handles transforming into the given alt-mode, or bot-mode if none is provided
 * @param {Actor} actor The Actor being transformed
 * @param {String} altModeUuid The UUID of the alt-mode being transformed into
 */
export async function onTransformUuid(actor, altModeUuid=null) {
  if (altModeUuid) {
    await actor.update ({
      "system.image.botmode": actor.prototypeToken.texture.src,
    });

    const altMode = await fromUuid(altModeUuid);
    _transformAltMode(actor, altMode);
  } else {
    _transformBotMode(actor);
  }
}

/**
 * Handle Transforming back into the Bot Mode
 * @param {Actor} actor The Actor being transformed
 * @private
 */
async function _transformBotMode(actor) {
  await triggerModeAttachmentCheck(actor, true);

  const width = CONFIG.E20.tokenSizes[actor.system.size].width;
  const height = CONFIG.E20.tokenSizes[actor.system.size].height;
  resizeTokens(actor, width, height);
  changeTokenImage(actor, actor.system.image.botmode);

  await actor.update({
    "prototypeToken.height": height,
    "prototypeToken.width": width,
    "system.movement.aerial.altMode": 0,
    "system.movement.swim.altMode": 0,
    "system.movement.ground.altMode": 0,
    "system.isTransformed": false,
    "system.altModeId": "",
    "system.altModesize": "",
  });
}

/**
 * Handles Transforming into an Alt Mode
 * @param {Actorheet} actor The Actor being transformed
 * @param {AltMode} altMode The alt-mode that was selected to transform into
 * @private
 */
async function _transformAltMode(actor, altMode) {
  await triggerModeAttachmentCheck(actor, false, altMode.id);
  warnMissingStateImage(actor, "altMode", altMode);
  const width = CONFIG.E20.tokenSizes[altMode.system.altModesize].width;
  const height = CONFIG.E20.tokenSizes[altMode.system.altModesize].height;
  resizeTokens(actor, width, height);
  changeTokenImage(actor, altMode.system.tokenImage);

  await actor.update({
    "prototypeToken.height": height,
    "prototypeToken.width": width,
    "system.movement.aerial.altMode": altMode.system.altModeMovement.aerial,
    "system.movement.swim.altMode": altMode.system.altModeMovement.aquatic,
    "system.movement.ground.altMode": altMode.system.altModeMovement.ground,
    "system.altModesize": altMode.system.altModesize,
    "system.altModeId": altMode._id,
    "system.isTransformed": true,
  });
}

/**
 * Creates the Alt Mode choice list dialog
 * @param {Actor} actor The Actor being transformed
 * @param {AltMode[]} altModes A list of the available Alt Modes
 * @param {Boolean} isTransformed Whether the Transformer is transformed or not
 * @private
 */
async function _showAltModeChoiceDialog(actor, altModes, isTransformed) {
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
  new TransformOptionSelector(choices, actor, altModes, title).render(true);
}

/**
 * Handles selecting an Alt Mode from the Alt Mode dialog
 * @param {Actor} actor The Actor being transformed
 * @param {AltMode[]} altModes A list of the available Alt Modes
 * @param {Object} options The options resulting from _showAltModeDialog()
 * @private
 */
export async function _altModeSelect(actor, altModes, selectedForm) {
  let transformation = null;

  if (!selectedForm) {
    return;
  }

  if (selectedForm == "BotMode") {
    _transformBotMode(actor);
  } else {
    for (const mode of altModes) {
      if (selectedForm == mode._id) {
        transformation = mode;
        break;
      }
    }

    if (transformation) {
      _transformAltMode(actor, transformation);
    }
  }
}
