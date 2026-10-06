/**
 * Small helpers shared by the data22 extension modules.
 */

export const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

export function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
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

export function has(actor, uuid) {
  return !!findSourced(actor, uuid);
}

/** Hooks.on that is a no-op in tests (no Hooks global). */
export function onHook(name, fn) {
  globalThis.Hooks?.on?.(name, fn);
}

export function onceHook(name, fn) {
  globalThis.Hooks?.once?.(name, fn);
}

export async function say(actor, content) {
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}
