import { rememberSelect } from "../helpers/dialog.mjs";
import { createId } from "../helpers/utils.mjs";

export async function zordDrop(targetActor, dropActor) {
  if (targetActor.type == 'zord') {
    await _positionSelect(targetActor, dropActor);
  } else if (targetActor.type == 'megaformZord') {
    await _attachSelectedActor(targetActor, dropActor);
  }
}

async function _positionSelect(targetActor,dropActor){
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
          callback: html => _attachSelectedActor(targetActor, dropActor, rememberSelect(html)),
        },
      },
    },
  ).render(true);
}

async function _attachSelectedActor(targetActor, dropActor, options) {
  let selectedRole = '';
  if (options) {
    for (const [ ,role] of Object.entries(options)){
        selectedRole = role;
    }
  }
  const passengers = targetActor.system.passengers;
  let ownerSet = false;
  if (targetActor.type == 'zord') {
    for (const [, passenger] of Object.entries(passengers)) {
      if (passenger.role == 'owner') {
        ownerSet = true;
      }
    }

    if (!ownerSet) {
      const entry = {
        img: dropActor.img,
        name: dropActor.name,
        type: dropActor.type,
        uuid: dropActor.uuid,
        color: dropActor.system.color,
        level: dropActor.system.level,
        role: "owner",
        }

      const pathPrefix = "system.passengers";
      const key = createId(actors);

      await targetActor.update({
        [`${pathPrefix}.${key}`]: entry,
      });
    }
  }

  if (passengers) {
    for (const [, actor] of Object.entries(passengers)) {
      if (actor.uuid === dropActor.uuid) {
        return;
      }
    }
  }

  const entry = {
    img: dropActor.img,
    name: dropActor.name,
    type: dropActor.type,
    uuid: dropActor.uuid,
    color: dropActor.system.color,
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
