/**
 * Shared bits for the group I rules-engine plug-ins (module/rules/ext/i/*.mjs, round 12). Plain Node safe: Foundry
 * globals are only read inside functions.
 */

export const listOf = collection => {
  if (Array.isArray(collection?.contents)) {
    return collection.contents;
  }

  if (Array.isArray(collection)) {
    return collection;
  }

  return collection && typeof collection[Symbol.iterator] == 'function' ? [...collection] : [];
};

export const worldActors = () => listOf(globalThis.game?.actors);

export const getPath = (object, key) => String(key ?? '').split('.').reduce((at, part) => (at === null || at === undefined ? at : at[part]), object);

/** The world actor behind an actor (itself for a world actor, the base actor for an unlinked token's). */
export function baseActorOf(actor) {
  if (!actor) {
    return null;
  }

  return actor.isToken ? globalThis.game?.actors?.get?.(actor.id) ?? actor : actor;
}
