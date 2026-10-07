/**
 * Recall for Repairs (PR CRB p.136), the part after the Zord drops: at 0 Health it goes Prone and its crew bail out
 * (vehicle-defeat.mjs), then lies dormant until its Ranger recalls it to its Morphin Grid lair. A recalled Zord can't
 * be called again until the scene is over, and when it is it comes back at full Health with no lingering Conditions.
 *
 * The recall is the Use button on the Zord's Recall for Repairs feature. It leaves any Megaform it is part of, its
 * tokens leave the map, and the scene it was recalled in is noted on the Zord (Call to Action - zord-summon.mjs - reads
 * that note: refused in the same scene, restored after it).
 */
import { registerUse } from "../item-hooks.mjs";
import { getSceneEpoch } from "../resources/scene-clock.mjs";
import { sourceOf } from "../../items/shared/item-lookups.mjs";

export const RECALL_FOR_REPAIRS_ID = "Compendium.essence20.pr_crb.Item.r1S0Sc4oq8axDL6C";
export const RECALL_FLAG = 'zordRecalled';

const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

/** The scene the Zord was recalled in, or null. */
export function recalledEpoch(zord) {
  const epoch = zord?.flags?.essence20?.[RECALL_FLAG]?.epoch;
  return epoch === undefined || epoch === null ? null : Number(epoch);
}

/** Recalled in this scene: it can't be called again yet. */
export function recalledThisScene(zord, epoch = getSceneEpoch()) {
  const recalled = recalledEpoch(zord);
  return recalled !== null && recalled == epoch;
}

/**
 * Send the Zord to its lair: out of any Megaform, off the map, noted with this scene.
 * @param {Actor} zord
 */
export async function recallZord(zord) {
  if (zord?.type != 'zord') {
    return false;
  }

  const { megaformsContaining } = await import("../../items/zords/combiner-roster-helpers.mjs");
  for (const form of megaformsContaining(zord)) {
    const key = Object.entries(form.system.actors ?? {}).find(([, entry]) => entry?.uuid == zord.uuid)?.[0];
    if (key) {
      await form.update({ [`system.actors.-=${key}`]: null });
    }
  }

  for (const token of zord.getActiveTokens?.(false, true) ?? []) {
    if (token.isOwner) {
      await token.delete();
    }
  }

  await zord.setFlag('essence20', RECALL_FLAG, { epoch: getSceneEpoch() });
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: zord }), content: T('ZordRecalled', { name: zord.name }) });
  return true;
}

/**
 * Called when the Zord is summoned: back from repairs (an earlier scene) at full Health, no Stun, no Conditions.
 * @param {Actor} zord
 * @returns {Promise<Boolean>}   Whether it came back from repairs
 */
export async function returnFromRepairs(zord) {
  const recalled = recalledEpoch(zord);
  if (recalled === null || recalledThisScene(zord)) {
    return false;
  }

  for (const status of [...(zord.statuses ?? [])]) {
    await zord.toggleStatusEffect(status, { active: false });
  }

  await zord.update({
    'system.health.value': zord.system.health.max,
    'system.stun.value': 0,
    [`flags.essence20.-=${RECALL_FLAG}`]: null,
  });
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: zord }), content: T('ZordRepaired', { name: zord.name }) });
  return true;
}

registerUse({
  id: 'zord-recall-for-repairs',
  matches: item => item?.parent?.type == 'zord' && sourceOf(item) == RECALL_FOR_REPAIRS_ID,
  run: async item => {
    await recallZord(item.parent);
    return null;
  },
});
