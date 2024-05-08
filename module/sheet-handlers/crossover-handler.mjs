import { rememberOptions } from "../helpers/utils.mjs";

/**
 * Creates dialog window for crossover options
 * @param {ActorSheet} actorSheet The ActorSheet whose options are being shown
 * @param {Event} event The originating click event
 */
export async function showCrossoverOptions(actorSheet, event) {
  event.preventDefault();

  new Dialog(
    {
      title: game.i18n.localize('E20.Crossover'),
      content: await renderTemplate("systems/essence20/templates/dialog/crossover-options.hbs", {
        actor: actorSheet.actor,
        system: actorSheet.actor.system,
      }),
      buttons: {
        save: {
          label: game.i18n.localize('E20.AcceptButton'),
          callback: html => _crossoverSettings(actorSheet, rememberOptions(html)),
        },
      },
    },
  ).render(true);
}

/**
 * Sets the options from the crossover dialog
 * @param {ActorSheet} actorSheet The ActorSheet whose options are being shown
 * @param {Options} options The options from the dialog
 */
function _crossoverSettings(actorSheet, options) {
  for (const option in options) {
    const updateString = `system.${option}`;
    if (options[option]) {
      actorSheet.actor.update({
        [updateString]: true,
      }).then(actorSheet.render(false));
    } else {
      actorSheet.actor.update({
        [updateString]: false,
      }).then(actorSheet.render(false));
    }
  }
}
