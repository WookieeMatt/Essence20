import { getItemsOfType, rememberOptions } from "../helpers/utils.mjs";

export class TransformerHandler {
  /**
   * Constructor
   * @param {Essence20ActorSheet} actorSheet The actor sheet
   */
  constructor(actorSheet) {
    this._actorSheet = actorSheet;
    this._actor = actorSheet.actor;
  }

  /**
   * Handle AltModes being deleted
   * @param {AltMode} altMode The deleted AltMode.
   */
  async onAltModeDelete(altMode) {
    const altModes = getItemsOfType("altMode", this._actor.items);
    if (altModes.length > 1) {
      if (altMode._id == this._actor.system.altModeId) {
        this._transformBotMode();
      }
    } else {
      this._transformBotMode();
    }
  }

  /**
   * Handle clicking the transform button
   */
  async onTransform() {
    const altModes = getItemsOfType("altMode", this._actor.items);
    const isTransformed = this._actor.system.isTransformed;

    if (!altModes.length && !isTransformed) {           // No alt-modes to transform into
      ui.notifications.warn(game.i18n.localize('E20.AltModeNone'));
    } else if (altModes.length > 1) {                   // Select from multiple alt-modes
      if (!isTransformed) {
        this._showAltModeChoiceDialog(altModes, false); // More than 1 altMode and not transformed
      } else {
        this._showAltModeChoiceDialog(altModes, true);  // More than 1 altMode and transformed
      }
    } else {                                             // Alt-mode/bot-mode toggle
      isTransformed
        ? this._transformBotMode()
        : this._transformAltMode(altModes[0]);
    }
  }

  /**
   * Handle Transforming back into the Bot Mode
   * @private
   */
  async _transformBotMode() {
    const tokens = this._actor.getActiveTokens();
    const width = CONFIG.E20.tokenSizesWidth[this._actor.system.size];
    const height = CONFIG.E20.tokenSizesHeight[this._actor.system.size];
    for (const token of tokens) {
      token.document.update({
        "height": height,
        "width": width,
      })
    }
    await this._actor.update({
      "prototypeToken.height": height,
      "prototypeToken.width": width,
      "system.movement.aerial.altMode": 0,
      "system.movement.swim.altMode": 0,
      "system.movement.ground.altMode": 0,
      "system.isTransformed": false,
      "system.altModeId": "",
      "system.altModeSize": "",
    }).then(this._actorSheet.render(false));
  }

  /**
   * Handles Transforming into an AltMode
   * @param {AltMode} altMode The alt-mode that was selected to Transform into
   * @private
   */
  async _transformAltMode(altMode) {
      const tokens = this._actor.getActiveTokens();
      const width = CONFIG.E20.tokenSizesWidth[altMode.system.altModesize];
      const height = CONFIG.E20.tokenSizesHeight[altMode.system.altModesize];
      for (const token of tokens) {
        token.document.update({
          "height": height,
          "width": width,
        })
      }
    await this._actor.update({
      "prototypeToken.height": height,
      "prototypeToken.width": width,
      "system.movement.aerial.altMode": altMode.system.altModeMovement.aerial,
      "system.movement.swim.altMode": altMode.system.altModeMovement.aquatic,
      "system.movement.ground.altMode": altMode.system.altModeMovement.ground,
      "system.altModeSize": altMode.system.altModesize,
      "system.altModeId": altMode._id,
      "system.isTransformed": true,
    }).then(this._actorSheet.render(false));
  }

  /**
   * Creates the Alt Mode Choice List Dialog
   * @param {AltMode[]} altModes    A list of the available Alt Modes
   * @param {Boolean} isTransformed Whether the Transformer is transformed or not
   * @private
   */
  async _showAltModeChoiceDialog(altModes, isTransformed) {
    const choices = {};
    if (isTransformed) {
      choices["BotMode"] = {
        chosen: false,
        label: "BotMode",
      };
    }

    for (const altMode of altModes) {
      if (this._actor.system.altModeId != altMode._id) {
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
            callback: html => this._altModeSelect(altModes, rememberOptions(html)),
          },
        },
      },
    ).render(true);
  }

  /**
   * Handle selecting an alt-mode from the Alt-mode Dialog
   * @param {AltMode[]} altModes A list of the available Alt Modes
   * @param {Object} options     The options resulting from _showAltModeDialog()
   * @private
   */
  async _altModeSelect(altModes, options) {
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
      this._transformBotMode();
    } else {
      for (const mode of altModes) {
        if (selectedForm == mode._id) {
          transformation = mode;
          break;
        }
      }

      if (transformation) {
        this._transformAltMode(transformation);
      }
    }
  }
}
