/**
 * Item identity and lookups shared by the item files: which compendium entry an embedded item was
 * copied from, the actor's items as a plain array, and "does this actor hold that item". Light on
 * purpose - imports nothing, so any item or mechanics file can use it without an import loop.
 *
 * Two readings differ on purpose and are kept apart:
 * - sourceOf answers null for an unsourced item; sourceOfOrUndefined answers undefined (one caller
 *   compares it against uuids that may themselves be undefined).
 * - itemsOf reads a Collection or any iterable; itemsOfAny also unwraps a plain Map's [key, value]
 *   entries and hands an array back as-is. The *Any lookups below use itemsOfAny.
 */

/**
 * Compendium items that moved to another pack, keeping their _id (2026-10-07, docs/rules-batches/pr-followups.md):
 * the seven A Jump Through Time Spectrum Modification Perks out of the PR core pack, and the Power Rangers Pre Gen
 * Characters weapons into their own pack. A copy made before the move still carries the old uuid in its source
 * fields until migration.mjs#migrateMovedItemSources rewrites them; sourceOf and rules/inherit.mjs read the old uuid
 * as the new one meanwhile. Fallback only - drop it at 6.1, once every world has migrated.
 */
const MOVED_IDS = {
  'pr_crb>jump_through_time': ['iVpoqL7ZY4SK4iLc', 'DAqOZsEq03rJWWQo', '7kHQ53hZFgwhSFVi', 'E4hk9pHESLuYQuO7', '8bmqJ7hyOAcVNB1Y',
    'hSu10Kgj9g1LSmyv', 'M3pQgNMsU5hU5dMN'],
  'pr_crb>power_rangers_pre_gens': ['bMF0bpeywVj9CYYz', 'EtQ5EsNbPspUJrU4', 'Nr1vOg4xCPApJ27G', '1EmLoN9DRgps867P', 'A6OtrWu1AJhSJiPO',
    'fi9SgjBN2FhW47D3', 'XmZCw5vdjrMmQmbA', 'yY5u7ocQAx7mTgzk', 'Y6qVhMeJE5FHixNh', 'HBkOFDpX3EjGAm9x', '6PHGfFowZAZBQ6Q3'],
};

/** Old compendium uuid => new, for every moved item. */
export const MOVED_ITEM_UUIDS = Object.freeze(Object.fromEntries(Object.entries(MOVED_IDS).flatMap(([move, ids]) => {
  const [from, to] = move.split('>');
  return ids.map(id => [`Compendium.essence20.${from}.Item.${id}`, `Compendium.essence20.${to}.Item.${id}`]);
})));

/** A compendium uuid with a moved item's old uuid read as its new one; anything else (null too) unchanged. */
export function currentUuid(uuid) {
  return (typeof uuid == 'string' && MOVED_ITEM_UUIDS[uuid]) || uuid;
}

/** The compendium uuid an item was copied from, or null. */
export function sourceOf(item) {
  return currentUuid(item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null);
}

/** sourceOf, but undefined (not null) for an unsourced item. */
export function sourceOfOrUndefined(item) {
  return currentUuid(item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource);
}

/** The last segment of a compendium uuid (the item _id), matching reprints across packs; '' for none. */
export const idOf = value => String(value ?? '').split('.').pop();

/** Every embedded item as a plain array: a Collection's contents, else any iterable spread, else []. */
export function itemsOf(actor) {
  const items = actor?.items;
  if (!items) {
    return [];
  }

  return Array.isArray(items.contents) ? items.contents : (typeof items[Symbol.iterator] == 'function' ? [...items] : []);
}

/** Every embedded item as a plain array (Collections, arrays and Maps all work). */
export function itemsOfAny(actor) {
  const items = actor?.items;
  if (!items) {
    return [];
  }

  if (Array.isArray(items)) {
    return items;
  }

  if (Array.isArray(items.contents)) {
    return items.contents;
  }

  return typeof items[Symbol.iterator] == 'function' ? [...items].map(entry => (Array.isArray(entry) ? entry[1] : entry)) : [];
}

/** Whether this item is (a copy of) the given compendium item. Never matches an empty uuid. */
export function isItem(item, uuid) {
  const source = sourceOf(item);
  return !!source && !!uuid && source == uuid;
}

/** isItem as a predicate: `items.filter(isFrom(uuid))`. */
export const isFrom = uuid => item => !!uuid && sourceOf(item) == uuid;

/** The actor's first item copied from this compendium uuid (any type), or null. Guards an undefined uuid. */
export function findSourced(actor, uuid) {
  return uuid ? itemsOf(actor).find(item => sourceOf(item) == uuid) ?? null : null;
}

/** Every item on the actor copied from this compendium uuid, of any type. */
export function allSourced(actor, uuid) {
  return uuid ? itemsOf(actor).filter(item => sourceOf(item) == uuid) : [];
}

export const has = (actor, uuid) => !!findSourced(actor, uuid);

/** An item's name for labels, or the fallback when the actor doesn't hold it. */
export const nameOf = (actor, uuid, fallback) => findSourced(actor, uuid)?.name ?? fallback;

/** findSourced over itemsOfAny. */
export function findSourcedAny(actor, uuid) {
  return uuid ? itemsOfAny(actor).find(item => sourceOf(item) == uuid) ?? null : null;
}

/** allSourced over itemsOfAny. */
export function allSourcedAny(actor, uuid) {
  return uuid ? itemsOfAny(actor).filter(item => sourceOf(item) == uuid) : [];
}

export const hasAny = (actor, uuid) => !!findSourcedAny(actor, uuid);

/** One of the system's flags on a document. */
export const flagOf = (doc, key) => doc?.flags?.essence20?.[key];
