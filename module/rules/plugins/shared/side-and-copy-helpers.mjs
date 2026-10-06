/**
 * Group F plug-ins (round 11): shared helpers. Plain Node safe - Foundry globals are only read inside functions.
 */

export function resolve(uuid) {
  try {
    return uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null;
  } catch (error) {
    return null;
  }
}

export const worldList = collection => collection?.contents ?? (collection ? [...collection] : []);
export const worldActors = () => worldList(globalThis.game?.actors);
export const itemsOf = actor => worldList(actor?.items);
export const sourceOf = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;

/** The last part of a book uuid - the 16-character compendium id. */
export const shortId = uuid => String(uuid ?? '').split('.').pop();

/** The holder's copy of the book item with that compendium id (its own item when the id is the rule item's). */
export function copyOf(actor, id) {
  return id ? itemsOf(actor).find(item => shortId(sourceOf(item)) == id) ?? null : null;
}

/** An actor's side: its active token's disposition, else its prototype token's (0 when neither). */
export function dispositionOf(actor) {
  return actor?.getActiveTokens?.()?.[0]?.document?.disposition ?? actor?.prototypeToken?.disposition ?? 0;
}

/** Same side by disposition, never itself. */
export function sideAlly(a, b) {
  return !!a && !!b && a !== b && a.uuid != b.uuid && dispositionOf(a) == dispositionOf(b);
}

/** Opposite sides by disposition, neither neutral. */
export function sideEnemy(a, b) {
  const da = dispositionOf(a);
  const db = dispositionOf(b);
  return !!a && !!b && da != db && da != 0 && db != 0;
}

/** Update a document, through the GM when this user can't write to it. */
export async function write(doc, method, args) {
  const { needsGmRelay, relayToGm } = await import("../../../mechanics/world/gm-relay.mjs");
  if (needsGmRelay(doc)) {
    return relayToGm(doc, method, args);
  }

  return doc[method](...args);
}

/** A localized string: an `E20.` key is looked up (formatted with data), anything else is returned as written. */
export function localized(text, data = null) {
  const i18n = globalThis.game?.i18n;
  if (!String(text ?? '').startsWith('E20.') || !i18n) {
    return String(text ?? '');
  }

  const out = data ? i18n.format?.(text, data) : i18n.localize?.(text);
  return out ?? String(text);
}

/** A localized RulesExtF string (E20.RulesExtF.<key>), or the key when there's no game (tests). */
export function T(key, data) {
  const i18n = globalThis.game?.i18n;
  const full = `E20.RulesExtF.${key}`;
  const text = data ? i18n?.format?.(full, data) : i18n?.localize?.(full);
  return text && text != full ? text : `${key}${data ? ` ${JSON.stringify(data)}` : ''}`;
}

export const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
