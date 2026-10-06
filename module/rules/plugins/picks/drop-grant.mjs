import { registerDropGrant } from "../../steps.mjs";
import { listOf } from "../shared/chat-speaker-helpers.mjs";

/**
 * pickGrant through the item type's drop handler (round 15, items1).
 *
 *  - `pickGrant {from: {type: alteration, availabilities, notOwned: true, byOriginalId: true}, viaDrop: true, flags}` -
 *    the picked Alteration is added as a dragged-in one would be (sheet-handlers/alteration-handler.mjs#onAlterationDrop:
 *    the Skill / Essence / Movement dialogs, "already taken", system.originalId). `flags` (cyberneticAlteration,
 *    geneticAlteration) and grantedBy ride on the copy. Nothing made (a closed dialog) stops the run.
 *    `from.byOriginalId`: an owned Alteration's system.originalId counts as holding that entry (core pickGrant).
 *  Cybernetic Part, Enhanced Part, Optimized Part, Engrafted / Evolving / Outright Mutation.
 */

registerDropGrant('alteration', async (actor, uuid, { grantedBy = null, flags = {}, system = {} } = {}) => {
  const source = await globalThis.fromUuid?.(uuid);
  if (!source || !actor) {
    return null;
  }

  const set = globalThis.foundry.utils.setProperty;
  const data = source.toObject();
  delete data._id;
  set(data, 'flags.core.sourceId', uuid);
  if (grantedBy?.id) {
    set(data, 'flags.essence20.grantedBy', grantedBy.id);
  }

  for (const [key, value] of Object.entries(flags ?? {})) {
    set(data, `flags.essence20.${key}`, value);
  }

  for (const [path, value] of Object.entries(system ?? {})) {
    set(data, `system.${path}`, value);
  }

  const before = new Set(listOf(actor.items).map(item => item.id));
  const { onAlterationDrop } = await import("../../../sheet-handlers/alteration-handler.mjs");
  await onAlterationDrop(actor, source, () => actor.createEmbeddedDocuments('Item', [data]));
  return listOf(actor.items).find(item => !before.has(item.id) && item.type == 'alteration') ?? null;
});
