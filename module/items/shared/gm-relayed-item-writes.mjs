/**
 * Shared bits for the other2 extension modules (Decepticon Directive, GI Joe CRB, Factions in
 * Action, Hawk's Personnel Files, Knights of Canterlot and Finster's items): their compendium
 * packs, a flat-DIF Skill Test, and the GM-relayed Item writes. The generic lookups, lang, chat,
 * target and distance helpers live in item-lookups.mjs, item-lang.mjs, chat-lines.mjs, sides.mjs,
 * numbers.mjs and hooks-and-clients.mjs.
 */

const pack = name => id => `Compendium.essence20.${name}.Item.${id}`;
export const DD = pack('decepticon_directive');
export const GIJ = pack('gi_joe_crb');
export const FF = pack('ferocious_fighters');
export const IA = pack('intercontinental_adventures');
export const HAWK = pack('general_hawk_s_personel_files');
export const KOC = pack('knights_of_canterlot');
export const FMMC = pack('finster_s_monster_matic_cookbook');

export function parentOf(item) {
  const parentId = item?.flags?.essence20?.parentId;
  return parentId ? item.parent?.items?.get?.(parentId) ?? null : null;
}

/** A Skill Test against a flat DIF (mechanics/resources/grants.mjs#rollTest). */
export async function rollDif(actor, skill, dif, extra = {}) {
  const { rollTest } = await import("../../mechanics/resources/grants.mjs");
  return rollTest(actor, skill, dif, extra);
}

/* -------------------------------------------- */
/*  Item writes on an actor this user may not own */
/* -------------------------------------------- */

const SOCKET = 'system.essence20';
const ITEMS_ACTION = 'o2Items';

/**
 * Create and/or delete embedded Items on an actor. A player lending an Upgrade to an ally, or
 * rewriting a Defeated foe's Hang-Ups, does not own that actor - the active GM does it for them.
 * Only Items this slice stamps (flags.essence20.o2Granted) may be created, and only those or
 * Hang-Ups may be deleted, so the socket can't be used for anything else.
 * @param {Actor} actor
 * @param {Object} change   {create: Array<Object>, remove: Array<String>}
 */
export async function writeItems(actor, { create = [], remove = [] } = {}) {
  const stamped = create.map(data => {
    const copy = foundry.utils.deepClone(data);
    foundry.utils.setProperty(copy, 'flags.essence20.o2Granted', true);
    return copy;
  });
  if (actor?.isOwner || game.user?.isGM || !game.users?.activeGM) {
    return applyItems(actor, { create: stamped, remove });
  }

  game.socket?.emit(SOCKET, { action: ITEMS_ACTION, actorUuid: actor.uuid, create: stamped, remove, userId: game.user?.id });
  return [];
}

async function applyItems(actor, { create, remove }) {
  const removable = remove.filter(id => {
    const item = actor?.items?.get?.(id);
    return item && (item.flags?.essence20?.o2Granted || item.type == 'hangUp');
  });
  if (removable.length) {
    await actor.deleteEmbeddedDocuments('Item', removable);
  }

  const allowed = create.filter(data => data?.flags?.essence20?.o2Granted);
  return allowed.length ? actor.createEmbeddedDocuments('Item', allowed) : [];
}

/** The GM side of writeItems. */
export async function handleItemsRequest(data) {
  if (data?.action != ITEMS_ACTION || !game.user?.isGM || game.users?.activeGM?.id != game.user.id) {
    return;
  }

  const actor = await fromUuid(data.actorUuid);
  if (actor) {
    await applyItems(actor, { create: data.create ?? [], remove: data.remove ?? [] });
  }
}

globalThis.Hooks?.once?.('ready', () => game.socket?.on?.(SOCKET, handleItemsRequest));
