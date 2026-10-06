/**
 * Shared bits for the data21 slice of the Item Review (data errors and missing items across the
 * lines): compendium ids, item lookups and the owner-or-GM write every rider here needs.
 */

const uuid = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
const fmmc = id => uuid('finster_s_monster_matic_cookbook', id);

export const D21 = {
  // Finster's Monster-Matic Cookbook
  mystic: fmmc('SBlOGEnend5WYwgd'),
  sorcery: fmmc('xUBOE1s5pgVyUrwj'),
};

export const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

export function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;
}

export function itemsOf(actor) {
  const items = actor?.items;
  if (Array.isArray(items?.contents)) {
    return items.contents;
  }

  return items && typeof items[Symbol.iterator] == 'function' ? [...items] : [];
}

export function findSourced(actor, uuid) {
  return uuid ? itemsOf(actor).find(item => sourceOf(item) == uuid) ?? null : null;
}

export function escape(text) {
  return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Write to a document the user may not own (an attacked target) - through the GM when needed. */
export async function writeDoc(doc, method, args) {
  if (!doc) {
    return;
  }

  const { needsGmRelay, relayToGm } = await import("../../mechanics/world/gm-relay.mjs");
  if (needsGmRelay(doc)) {
    await relayToGm(doc, method, args);
    return;
  }

  await doc[method](...args);
}

export function postLine(actor, content) {
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${content}</p>` });
}

/** The weapon an embedded weaponEffect belongs to. */
export function parentWeaponOf(actor, item) {
  const parentId = item?.flags?.essence20?.parentId;
  return parentId ? actor?.items?.get?.(parentId) ?? null : null;
}
