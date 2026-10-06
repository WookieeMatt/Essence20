import { isExpired } from "../../expiry.mjs";

/**
 * Group B plug-ins (round 10): small shared helpers. Plain Node safe - Foundry globals are only read inside functions.
 */

export const listOf = collection => collection?.contents ?? (collection && typeof collection[Symbol.iterator] == 'function' ? [...collection] : []);
export const itemsOf = actor => listOf(actor?.items);
export const worldActors = () => listOf(globalThis.game?.actors);
export const num = value => Number(value) || 0;
export const sourceOf = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;

export function resolve(uuid) {
  try {
    return uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null;
  } catch (error) {
    return null;
  }
}

/** A value at a dotted path (foundry.utils.getProperty when there is one). */
export function readPath(object, path) {
  const get = globalThis.foundry?.utils?.getProperty;
  return get ? get(object, path) : String(path).split('.').reduce((at, key) => (at === null || at === undefined ? at : at[key]), object);
}

export function localize(key, data = null) {
  const i18n = globalThis.game?.i18n;
  const text = data ? i18n?.format?.(key, data) : i18n?.localize?.(key);
  return text ?? key;
}

/** E20.RulesExtB.<key>, with the key itself (and its data) when there's no translation (tests, the CI script). */
export function T(key, data = null) {
  const full = `E20.RulesExtB.${key}`;
  const text = localize(full, data);
  return text && text != full ? text : `${key}${data ? ` ${JSON.stringify(data)}` : ''}`;
}

export const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** A damage type's display name (CONFIG.E20.damageTypes). */
export const damageTypeLabel = type => localize(globalThis.CONFIG?.E20?.damageTypes?.[type] ?? type);

/** The live rules marks an actor carries (flags.essence20.ruleMarks): [{key, mark}], a per-setter key's own suffix dropped. */
export function marksOf(actor) {
  return Object.entries(actor?.flags?.essence20?.ruleMarks ?? {}).filter(([, mark]) => mark && !isExpired(mark))
    .map(([key, mark]) => ({ key: key.split('--')[0], mark }));
}

/** An actor's token disposition (its active token, else its prototype token), 1 when neither says. */
export function dispositionOf(actor) {
  return actor?.getActiveTokens?.()?.[0]?.document?.disposition ?? actor?.prototypeToken?.disposition ?? 1;
}
