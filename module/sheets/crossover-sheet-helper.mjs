import { rememberOptions } from "../helpers/utils.mjs";

export class CrossoverSheetHandler {
  /**
   * Constructor
   * @param {Essence20ActorSheet} actorSheet The actor sheet
   */
  constructor(actorSheet) {
    this._actorSheet = actorSheet;
    this._actor = actorSheet.actor;
  }

  /**
   * Creates dialog window for Crossover Options
   * @param {Event} event   The originating click event
   */
  async showCrossoverOptions(event) {
    event.preventDefault();

    new Dialog(
      {
        title: game.i18n.localize('E20.Crossover'),
        content: await renderTemplate("systems/essence20/templates/dialog/crossover-options.hbs", {
          actor: this._actor,
          system: this._actor.system,
        }),
        buttons: {
          save: {
            label: game.i18n.localize('E20.AcceptButton'),
            callback: html => this._crossoverSettings(rememberOptions(html)),
          },
        },
      },
    ).render(true);
  }

  /**
   * Sets the options from the Crossover Dialog
   * @param {Options} options The options from the dialog
   */
  _crossoverSettings(options) {
    for (const option in options) {
      const updateString = `system.${option}`;
      if (options[option]) {
        this._actor.update({
          [updateString]: true,
        }).then(this._actorSheet.render(false));
      } else {
        this._actor.update({
          [updateString]: false,
        }).then(this._actorSheet.render(false));
      }
    }
  }
}
