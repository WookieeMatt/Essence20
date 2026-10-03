/**
 * Small helpers shared by the other2 extension modules (Decepticon Directive, GI Joe CRB, Factions
 * in Action, Hawk's Personnel Files, Knights of Canterlot and Finster's items).
 */

const pack = name => id => `Compendium.essence20.${name}.Item.${id}`;
export const DD = pack('decepticon_directive');
export const GIJ = pack('gi_joe_crb');
export const FF = pack('ferocious_fighters');
export const IA = pack('intercontinental_adventures');
export const HAWK = pack('general_hawk_s_personel_files');
export const KOC = pack('knights_of_canterlot');
export const FMMC = pack('finster_s_monster_matic_cookbook');

export const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

export function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;
}

export function itemsOf(actor) {
  const items = actor?.items;
  if (!items) {
    return [];
  }

  return items.contents ?? [...items];
}

export function findSourced(actor, uuid) {
  if (!uuid) {
    return null;
  }

  return itemsOf(actor).find(item => sourceOf(item) == uuid) ?? null;
}

export const has = (actor, uuid) => !!findSourced(actor, uuid);

export const isFrom = uuid => item => !!uuid && sourceOf(item) == uuid;

/** An upgrade counts while loose on the actor, or attached to something equipped. */
export function isWorn(upgrade) {
  const parentId = upgrade?.flags?.essence20?.parentId;
  return !parentId || !!upgrade.parent?.items?.get?.(parentId)?.system?.equipped;
}

export function wears(actor, uuid) {
  return itemsOf(actor).some(item => item.type == 'upgrade' && sourceOf(item) == uuid && isWorn(item));
}

export function parentOf(item) {
  const parentId = item?.flags?.essence20?.parentId;
  return parentId ? item.parent?.items?.get?.(parentId) ?? null : null;
}

/** The user's first targeted token's actor, if any. */
export function firstTarget() {
  const targets = game.user?.targets;
  const first = targets?.first?.() ?? (targets ? [...targets][0] : null);
  return first?.actor ?? null;
}

export function targetedActors() {
  return [...(game.user?.targets ?? [])].map(token => token.actor).filter(Boolean);
}

export async function post(actor, content) {
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

export function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** The Hooks object, when there is one (not in every test). */
export function onHook(name, fn) {
  globalThis.Hooks?.on?.(name, fn);
}

/** Distance between two actors' first tokens in feet, or null off-canvas. */
export function feetBetween(a, b) {
  const ta = a?.getActiveTokens?.()?.[0];
  const tb = b?.getActiveTokens?.()?.[0];
  if (!ta || !tb || !globalThis.canvas?.grid?.measurePath) {
    return null;
  }

  return canvas.grid.measurePath([ta.center, tb.center]).distance;
}

/** A Skill Test against a flat DIF (helpers/grants.mjs#rollTest). */
export async function rollDif(actor, skill, dif, extra = {}) {
  const { rollTest } = await import("../../grants.mjs");
  return rollTest(actor, skill, dif, extra);
}

/** A combat stamp for "this turn". */
export function turnStamp() {
  const combat = game?.combat;
  return combat ? { combatId: combat.id, round: combat.round, turn: combat.turn } : {};
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
