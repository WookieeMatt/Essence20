/**
 * Shared bits for the group H rules-engine plug-ins (module/rules/ext/h/*.mjs, round 12). Plain Node safe: heavy
 * helpers are imported lazily inside functions.
 */

/** A string from the RulesExtH block of the language file (E20.RulesExtH.<key>), or the key itself. */
export function T(key, data = null) {
  const i18n = globalThis.game?.i18n;
  const full = `E20.RulesExtH.${key}`;
  const text = data ? i18n?.format?.(full, data) : i18n?.localize?.(full);
  return text && text != full ? text : `${key}${data ? ` ${JSON.stringify(data)}` : ''}`;
}

/** A text that may be an i18n key (E20....): localised (formatted with data) when the language file has it, else as written. */
export function localize(text, data = null) {
  const value = String(text ?? '');
  const i18n = globalThis.game?.i18n;
  if (!/^E20\./.test(value) || !i18n?.has?.(value)) {
    return value;
  }

  return data ? i18n.format(value, data) : i18n.localize(value);
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

/** A value at a dotted path. */
export const read = (doc, path) => String(path ?? '').split('.').reduce((at, key) => (at === null || at === undefined ? at : at[key]), doc);

/**
 * The same reading as the core `data:` tags (rules/predicate.mjs): `<path>` (set), `<path>=<v>`, `!=`, `>=`, `<=`, `>`, `<`.
 * Undefined when the text isn't a data test.
 */
export function dataTest(doc, rest) {
  const match = /^data:([\w.-]+?)(?:(>=|<=|!=|>|<|=)(.*))?$/.exec(String(rest ?? ''));
  if (!match) {
    return undefined;
  }

  const value = read(doc, match[1]);
  if (!match[2]) {
    return !!value;
  }

  const wanted = match[3];
  const numeric = Number.isFinite(Number(value)) && Number.isFinite(Number(wanted)) && wanted !== '' && value !== null && value !== '';
  if (match[2] == '=' || match[2] == '!=') {
    const same = numeric ? Number(value) == Number(wanted) : String(value ?? '').toLowerCase() == String(wanted).toLowerCase();
    return match[2] == '=' ? same : !same;
  }

  return compare(Number(value), match[2], Number(wanted));
}

export function compare(a, op, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return false;
  }

  switch (op) {
  case '>=': return a >= b;
  case '<=': return a <= b;
  case '>': return a > b;
  case '<': return a < b;
  case '!=': return a != b;
  default: return a == b;
  }
}

/** The copies of a book item on an actor (the rule's own item included), matched by book source. */
export function copiesOf(actor, item) {
  const source = sourceOf(item);
  if (!actor || !item) {
    return [];
  }

  return itemsOf(actor).filter(other => other === item || other.id == item.id || (!!source && sourceOf(other) == source));
}

/** Update a document, through the GM when this user can't write to it. */
export async function write(doc, method, args) {
  const { needsGmRelay, relayToGm } = await import("../../../helpers/gm-relay.mjs");
  if (needsGmRelay(doc)) {
    return relayToGm(doc, method, args);
  }

  return doc[method](...args);
}

/** The actor's side: its active token's disposition, else its prototype token's (0 when neither). */
export function dispositionOf(actor) {
  return actor?.getActiveTokens?.()?.[0]?.document?.disposition ?? actor?.prototypeToken?.disposition ?? 0;
}

/** Actors with a token on the viewed scene. */
export function sceneActors() {
  return listOf(globalThis.canvas?.tokens?.placeables).map(token => token?.actor).filter(Boolean);
}
