import { rememberOptions } from "../helpers/utils.mjs";

/**
 * Creates dialog window for Crossover Options
 * @param {Event} event   The originating click event
 * @param {Essence20ActorSheet} actorSheet The actor sheet
 */
export async function onConfigureEntity(event, actorSheet) {
  const actor = actorSheet.actor;
  event.preventDefault();

  new Dialog(
    {
      title: game.i18n.localize('E20.Crossover'),
      content: await renderTemplate("systems/essence20/templates/dialog/crossover-options.hbs", {
        actor: actor,
        system: actor.system,
      }),
      buttons: {
        save: {
          label: game.i18n.localize('E20.AcceptButton'),
          callback: html => crossoverSettings(rememberOptions(html), actorSheet),
        },
      },
    },
  ).render(true);
}

/**
 * Sets the options from the Crossover Dialog
 * @param {Options} options The options from the dialog
 * @param {Essence20ActorSheet} actorSheet The actor sheet
 */
export function crossoverSettings(options, actorSheet) {
  const actor = actorSheet.actor;

  for (const option in options) {
    const updateString = `system.${option}`;
    if (options[option]) {
      actor.update({
        [updateString]: true,
      }).then(actorSheet.render(false));
    } else {
      actor.update({
        [updateString]: false,
      }).then(actorSheet.render(false));
    }
  }
}
