import { rememberSelect } from "../helpers/dialog.mjs";
import { createId } from "../helpers/utils.mjs";

export async function zordDrop(targetActor, dropActor) {
const choices = {};
for (const value of CONFIG.E20.VehicleRoles) {
  choices[value] = {
    chosen: false,
    key: value,
    label: value,
  };
}

new Dialog(
    {
      title: game.i18n.localize('E20.PassengerSelect'),
      content: await renderTemplate("systems/essence20/templates/dialog/passenger-select.hbs", {
        choices,
      }),
      buttons: {
        save: {
          label: game.i18n.localize('E20.AcceptButton'),
          callback: html => _attachSelectedActor(targetActor, rememberSelect(html), dropActor),
        },
      },
    },
  ).render(true);

}

async function _attachSelectedActor(targetActor, options, dropActor) {
  let selectedRole = '';
  console.log(options)
  for (const [ ,role] of Object.entries(options)){
      selectedRole = role;
  }

  const passengers = targetActor.system.passengers;
  if (passengers) {
    for (const [, actor] of Object.entries(passengers)) {
      if (actor.uuid === dropActor.uuid) {
        return;
      }
    }
  }

  const entry = {
    health: dropActor.system.health,
    img: dropActor.img,
    name: dropActor.name,
    type: dropActor.type,
    uuid: dropActor.uuid,
  }
  if (targetActor.type == 'zord') {
    entry['level'] = dropActor.system.level;
    entry['role'] = selectedRole;
  }

  const pathPrefix = "system.passengers";
  const key = createId(actors);

  await targetActor.update({
    [`${pathPrefix}.${key}`]: entry,
  });

}
