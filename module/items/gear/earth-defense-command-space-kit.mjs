import { registerUse } from "../../mechanics/item-hooks.mjs";
import { getUses, markUsed } from "../../mechanics/resources/scene-clock.mjs";
import { S1 } from "../shared/terrain-perk-ids-and-readers.mjs";
import { T } from "../shared/item-lang.mjs";
import { sourceOf } from "../shared/item-lookups.mjs";

/**
 * Earth Defense Command, Space Kit: "During Equipment Requisition, you receive a free Limited Kit
 * tied to a Driving, Culture, Science, or Technology Specialization." Once per mission. (Its Driving ↑2 and
 * zero-G attack ↑2 are item rules - rules/conv8-slC8.test.js.)
 */
const SPACE_KIT_FLAG = 's1SpaceKit';

export const SPACE_KIT_USE = {
  id: 's1-spaceKit',
  matches: item => sourceOf(item) == S1.earthDefenseCommand,
  canUse: item => getUses(item.parent, SPACE_KIT_FLAG, 'mission') < 1,
  run: async (item) => {
    const actor = item.parent;
    const { chooseSelect } = await import("../../mechanics/resources/grants.mjs");
    const specs = [];
    for (const skill of ['driving', 'culture', 'science', 'technology']) {
      for (const spec of Object.values(actor.system?.skills?.[skill]?.specializations ?? {})) {
        if (spec?.name) {
          specs.push({ value: `${skill}|${spec.name}`, label: `${game.i18n.localize(CONFIG.E20?.skills?.[skill] ?? skill)} (${spec.name})` });
        }
      }
    }

    if (!specs.length) {
      ui.notifications.warn(T('S1SpaceKitNoSpec'));
      return null;
    }

    const picked = await chooseSelect(item.name, T('S1SpaceKitPrompt'), specs);
    if (!picked) {
      return null;
    }

    const [skill, spec] = picked.split('|');
    const { makeKit } = await import("../../mechanics/resources/kits.mjs");
    await makeKit(actor, item, 'limited', skill, spec);
    await markUsed(actor, SPACE_KIT_FLAG, { window: 'mission' });
    return T('S1SpaceKit', { actor: actor.name, spec: `${skill} (${spec})` });
  },
};

registerUse(SPACE_KIT_USE);
