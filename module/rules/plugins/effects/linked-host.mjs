import { registerPreRoll } from "../../../mechanics/item-hooks.mjs";
import { itemsFor, registerStep } from "../../steps.mjs";
import { listOf, write } from "../shared/chat-speaker-helpers.mjs";

/**
 * Granted items linked to a host (round 15, items1).
 *
 *  - Step `linkToHost {name?, warn?}` - the newest item the rule's item granted (a pickGrant just before) is linked to the
 *    item the rule's item is attached to (its parentId host - a weapon upgrade's weapon): `flags.essence20.linkedHost`
 *    holds the host's id, it is equipped exactly as the host is and starts lowered (system.active false). `name`: an E20
 *    key (or text) for its new name, filled with {weapon} / {host} (the host's name) and {shield} / {item} (its own).
 *    `warn`: an E20 key shown (with {weapon}) when the host is rolled while the linked item is active.
 *  - The link holds: equipping / unequipping the host equips / unequips the linked item (an active shield going down
 *    is lowered and its Defense bonus cleared), and deleting the host deletes it (deleting the granting item already
 *    does - grantedBy).
 *  Limited / Standard Deflecting Weapon: the chosen shield the weapon also counts as.
 */

const linkedTo = (actor, hostId) => listOf(actor?.items).filter(item => hostId && item.flags?.essence20?.linkedHost == hostId);

const label = (key, data) => {
  const text = String(key ?? '');
  return text.startsWith('E20.') ? globalThis.game?.i18n?.format?.(text, data) ?? text : text.replace(/\{(\w+)\}/g, (m, k) => data[k] ?? m);
};

registerStep('linkToHost', async (step, ctx) => {
  const actor = ctx.actor;
  const host = actor?.items?.get?.(ctx.item?.flags?.essence20?.parentId);
  const linked = itemsFor({ item: 'granted', all: true }, actor, ctx).filter(item => !item.flags?.essence20?.linkedHost).pop();
  if (!host || !linked) {
    return false;
  }

  const update = { 'flags.essence20.linkedHost': host.id, 'system.equipped': !!host.system?.equipped, 'system.active': false };
  if (step.warn) {
    update['flags.essence20.linkedWarn'] = String(step.warn);
  }

  if (step.name) {
    update.name = label(step.name, { weapon: host.name, host: host.name, shield: linked.name, item: linked.name });
  }

  await write(linked, 'update', [update]);
}, {
  errors: (step, where) => ['name', 'warn'].filter(key => step[key] !== undefined && typeof step[key] != 'string')
    .map(key => `${where}: linkToHost ${key} must be text`),
});

// The linked item is only in hand while its host is.
export async function syncLinked(item, changes, options, userId) {
  const equipped = globalThis.foundry?.utils?.getProperty?.(changes, 'system.equipped');
  if (userId != globalThis.game?.user?.id || equipped === undefined || !item.parent) {
    return;
  }

  for (const linked of linkedTo(item.parent, item.id)) {
    if (!!linked.system?.equipped == !!equipped) {
      continue;
    }

    if (!equipped && linked.type == 'shield' && linked.system?.active) {
      const update = {};
      for (const defense of Object.keys(globalThis.CONFIG?.E20?.defenses ?? {})) {
        update[`system.defenses.${defense}.shield`] = 0;
      }

      await write(item.parent, 'update', [update]);
    }

    await write(linked, 'update', [{ 'system.equipped': !!equipped, ...(equipped ? {} : { 'system.active': false }) }]);
  }
}

/** A deleted host takes its linked items along. */
export async function removeLinked(item, options, userId) {
  if (userId != globalThis.game?.user?.id || !item.parent) {
    return;
  }

  const ids = linkedTo(item.parent, item.id).map(linked => linked.id).filter(id => item.parent.items?.get?.(id));
  if (ids.length) {
    await write(item.parent, 'deleteEmbeddedDocuments', ['Item', ids]);
  }
}

globalThis.Hooks?.on?.('updateItem', syncLinked);
globalThis.Hooks?.on?.('deleteItem', removeLinked);

/** Rolling a host (or one of its attacks) while a linked item is active: that item's warning. */
export function linkedWarning(actor, item) {
  const host = item?.type == 'weapon' ? item : actor?.items?.get?.(item?.flags?.essence20?.parentId);
  const raised = host ? linkedTo(actor, host.id).find(linked => linked.system?.active && linked.flags?.essence20?.linkedWarn) : null;
  return raised ? label(raised.flags.essence20.linkedWarn, { weapon: host.name, host: host.name }) : null;
}

registerPreRoll(async (actor, dataset, item) => {
  const text = linkedWarning(actor, item);
  if (text) {
    globalThis.ui?.notifications?.warn?.(text);
  }
});
