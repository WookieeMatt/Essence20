/**
 * Recall for Repairs (PR CRB p.136), the part after the Zord drops: at 0 Health it goes Prone and its crew bail out
 * (vehicle-defeat.mjs), then lies dormant until its Ranger recalls it to its Morphin Grid lair. A recalled Zord can't
 * be called again until the scene is over, and when it is it comes back at full Health with no lingering Conditions.
 *
 * The recall is the Use button on the Zord's Recall for Repairs feature. It leaves any Megaform it is part of, its
 * tokens leave the map, and the scene it was recalled in is noted on the Zord (Call to Action - zord-summon.mjs - reads
 * that note: refused in the same scene, restored after it). Anyone aboard (its driver and passengers) climbs out first:
 * their seats are cleared and their tokens come back onto the map beside the Zord.
 */
import { registerUse } from "../item-hooks.mjs";
import { getSceneEpoch } from "../resources/scene-clock.mjs";
import { sourceOf } from "../../items/shared/item-lookups.mjs";

export const RECALL_FOR_REPAIRS_ID = "Compendium.essence20.pr_crb.Item.r1S0Sc4oq8axDL6C";
export const RECALL_FLAG = 'zordRecalled';

const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

/**
 * Where the recall is kept: the world Zord, also when it is clicked on an unlinked token's copy (that copy lives in the
 * token, which the recall deletes - writing to it afterwards failed with "id does not exist in the EmbeddedCollection").
 */
export function recallRecordOf(zord) {
  return zord?.isToken ? (zord.baseActor ?? globalThis.game?.actors?.get?.(zord.id) ?? zord) : zord;
}

/** The scene the Zord was recalled in, or null. */
export function recalledEpoch(zord) {
  const epoch = recallRecordOf(zord)?.flags?.essence20?.[RECALL_FLAG]?.epoch;
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

  const record = recallRecordOf(zord);
  const uuids = new Set([zord.uuid, record.uuid]);
  const { megaformsContaining } = await import("../../items/zords/combiner-roster-helpers.mjs");
  for (const form of new Set([...megaformsContaining(zord), ...megaformsContaining(record)])) {
    const keys = Object.entries(form.system.actors ?? {}).filter(([, entry]) => uuids.has(entry?.uuid)).map(([key]) => key);
    if (keys.length) {
      await form.update(Object.fromEntries(keys.map(key => [`system.actors.${key}`, new foundry.data.operators.ForcedDeletion()])));
    }
  }

  // Everything that writes to the Zord happens before its token goes - an unlinked token's actor goes with it.
  const zordToken = zord.isToken ? zord.token : (record.getActiveTokens?.(false, true) ?? []).find(token => token.parent == globalThis.canvas?.scene) ?? null;
  await disembarkCrew(zord, zordToken);
  await record.setFlag('essence20', RECALL_FLAG, { epoch: getSceneEpoch() });
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: zord }), content: T('ZordRecalled', { name: zord.name }) });

  // Off the map: the token this copy lives in, and the world Zord's linked tokens - each once, if still there.
  const tokens = new Set([zord.isToken ? zord.token : null, ...(record.getActiveTokens?.(false, true) ?? [])].filter(Boolean));
  for (const token of tokens) {
    if (token.isOwner && token.parent?.tokens?.has?.(token.id)) {
      await token.delete();
    }
  }

  return true;
}

/**
 * Where the crew stand when they climb out: the column of squares just right of the Zord's token, top down (left of it
 * when that runs off the scene), then further columns if there are more of them than the Zord is tall. Exported for tests.
 * @param {{x, y, width, height}} zordToken   The Zord's token (grid units for width/height)
 * @param {Number} count
 * @param {Number} size   Grid size (px)
 * @param {{x, y, width, height}|null} rect   The scene's area
 */
export function disembarkPositions(zordToken, count, size = 100, rect = null) {
  const tall = Math.max(1, Math.round(Number(zordToken.height) || 1));
  const wide = (Number(zordToken.width) || 1) * size;
  const right = !rect || zordToken.x + wide + size <= rect.x + rect.width;
  return Array.from({ length: count }, (_, i) => {
    const column = Math.floor(i / tall);
    const x = right ? zordToken.x + wide + column * size : zordToken.x - (column + 1) * size;
    return { x, y: zordToken.y + (i % tall) * size };
  });
}

/**
 * Everyone aboard leaves the Zord: their seats are cleared, and those without a token on the Zord's scene get one
 * beside it (boarding took theirs away - zord-arrival.mjs).
 * @param {Actor} zord
 * @param {TokenDocument|null} zordToken
 */
async function disembarkCrew(zord, zordToken) {
  const seats = [zord, recallRecordOf(zord)].filter((actor, i, all) => actor && all.indexOf(actor) == i)
    .map(actor => [actor, Object.entries(actor.system?.actors ?? {}).filter(([, entry]) => entry?.vehicleRole)]);
  const crew = [...new Set(seats.flatMap(([, entries]) => entries.map(([, entry]) => entry.uuid)))]
    .map(uuid => globalThis.fromUuidSync?.(uuid, { strict: false })).filter(Boolean);

  const { needsGmRelay, relayToGm, createViaGm } = await import("../world/gm-relay.mjs");
  for (const [actor, entries] of seats) {
    if (entries.length) {
      const update = Object.fromEntries(entries.map(([key]) => [`system.actors.${key}`, new foundry.data.operators.ForcedDeletion()]));
      await (needsGmRelay(actor) ? relayToGm(actor, 'update', [update]) : actor.update(update));
    }
  }

  const scene = zordToken?.parent;
  if (!scene) {
    return;
  }

  const ashore = crew.filter(member => !member.isToken && !scene.tokens.some(token => token.actorId == member.id));
  const size = scene.grid?.size ?? globalThis.canvas?.grid?.size ?? 100;
  const positions = disembarkPositions(zordToken, ashore.length, size, globalThis.canvas?.dimensions?.sceneRect ?? null);
  for (const [i, member] of ashore.entries()) {
    await createViaGm('token', { actorUuid: member.uuid, sceneId: scene.id, ...positions[i] });
  }
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

  await zord.update({ 'system.health.value': zord.system.health.max, 'system.stun.value': 0 });
  await recallRecordOf(zord).unsetFlag('essence20', RECALL_FLAG);
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
