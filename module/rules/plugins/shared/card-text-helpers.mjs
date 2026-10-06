/**
 * Shared bits for the group G rules-engine plug-ins (module/rules/ext/g/*.mjs, round 11). Plain Node safe: heavy
 * helpers are imported lazily inside functions.
 */

/** A string from the RulesExtG block of the language file (E20.RulesExtG.<key>), or the key itself. */
export function T(key, data = null) {
  const i18n = globalThis.game?.i18n;
  const full = `E20.RulesExtG.${key}`;
  const text = data ? i18n?.format?.(full, data) : i18n?.localize?.(full);
  return text && text != full ? text : `${key}${data ? ` ${JSON.stringify(data)}` : ''}`;
}

/** A text that may be an i18n key (E20....): localised when the language file has it, else as written. */
export function localize(text) {
  const value = String(text ?? '');
  const i18n = globalThis.game?.i18n;
  return /^E20\./.test(value) && i18n?.has?.(value) ? i18n.localize(value) : value;
}

export const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** A collection (Foundry's, an array, a Set) as an array. */
export function listOf(collection) {
  if (Array.isArray(collection?.contents)) {
    return collection.contents;
  }

  if (Array.isArray(collection)) {
    return collection;
  }

  return collection && typeof collection[Symbol.iterator] == 'function' ? [...collection] : [];
}

export const itemsOf = actor => listOf(actor?.items);

/** An item's book source (or the item it acts as). */
export const sourceOf = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;

export const getPath = (object, key) => String(key ?? '').split('.').reduce((at, part) => (at === null || at === undefined ? at : at[part]), object);

/** A document by uuid, synchronously (null when unknown). */
export const lookup = uuid => (uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null);

/** Update a document, through the GM when this user can't write to it. */
export async function write(doc, method, args) {
  const { needsGmRelay, relayToGm } = await import("../../../mechanics/world/gm-relay.mjs");
  if (needsGmRelay(doc)) {
    return relayToGm(doc, method, args);
  }

  return doc[method](...args);
}

/** Post a chat card for an actor. */
export async function say(actor, content, extra = {}) {
  if (!content || !globalThis.ChatMessage?.create) {
    return null;
  }

  return globalThis.ChatMessage.create({ speaker: globalThis.ChatMessage.getSpeaker?.({ actor }), content, ...extra });
}

/** {name} (the actor), {target} (the first target) and {var.<key>} in a text. */
export function fillText(text, ctx, extra = {}) {
  return localize(text)
    .replace(/\{var\.([\w-]+)\}/g, (match, key) => String(ctx.vars?.[key] ?? ''))
    .replace(/\{name\}/g, ctx.actor?.name ?? '')
    .replace(/\{target\}/g, extra.target?.name ?? ctx.targets?.[0]?.name ?? '');
}
