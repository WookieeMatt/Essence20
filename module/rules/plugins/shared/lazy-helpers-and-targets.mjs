/**
 * Shared bits for the group C plug-ins (module/rules/ext/c/*.mjs): item / actor lookups and the heavy helpers,
 * loaded lazily so these files import under plain Node (tests, scripts/check-rules.mjs).
 */

/** Helpers the plug-ins read from the system's own modules, filled at init (tests set them directly). */
export const lazy = {
  // items/rolls/angry-influence.mjs#angrySnagSkill
  angrySnagSkill: null,
  // mechanics/actions/action-economy.mjs#getLedger / setNextTurn
  getLedger: null,
  setNextTurn: null,
  // mechanics/world/environment.mjs#getEnvironment / getTerrain
  getEnvironment: null,
  getTerrain: null,
  // items/attacks/favorite-weapon.mjs#getFavoriteWeaponItem
  favoriteWeapon: null,
  // mechanics/resources/scene-clock.mjs#getSceneEpoch
  getSceneEpoch: null,
};

export async function loadLazy() {
  const [angry, economy, environment, favorite, clock] = await Promise.all([
    import("../../../items/rolls/angry-influence.mjs"),
    import("../../../mechanics/actions/action-economy.mjs"),
    import("../../../mechanics/world/environment.mjs"),
    import("../../../items/attacks/favorite-weapon.mjs"),
    import("../../../mechanics/resources/scene-clock.mjs"),
  ]);
  lazy.angrySnagSkill = angry.angrySnagSkill;
  lazy.getLedger = economy.getLedger;
  lazy.setNextTurn = economy.setNextTurn;
  lazy.getEnvironment = (actor, options) => environment.getEnvironment(actor, options);
  lazy.getTerrain = actor => environment.getTerrain(actor);
  lazy.favoriteWeapon = favorite.getFavoriteWeaponItem;
  lazy.getSceneEpoch = clock.getSceneEpoch;
}

globalThis.Hooks?.once?.('setup', () => {
  loadLazy().catch(error => console.error('Essence20 | rules group C helpers failed to load', error));
});

export function itemsOf(actor) {
  const items = actor?.items;
  if (Array.isArray(items?.contents)) {
    return items.contents;
  }

  if (Array.isArray(items)) {
    return items;
  }

  return items && typeof items[Symbol.iterator] == 'function' ? [...items] : [];
}

export function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;
}

export const lower = value => String(value ?? '').toLowerCase();

/** A localized string under E20.RulesExtC, or the fallback when there's no game (tests, the CI script). */
export function T(key, data = null, fallback = key) {
  const full = `E20.RulesExtC.${key}`;
  const i18n = globalThis.game?.i18n;
  const text = data ? i18n?.format?.(full, data) : i18n?.localize?.(full);
  return text && text != full ? text : fallback;
}

export function getPath(object, path) {
  return String(path ?? '').split('.').reduce((at, part) => (at === null || at === undefined ? at : at[part]), object);
}

/** The first targeted token's actor. */
export function firstTarget() {
  const targets = globalThis.game?.user?.targets;
  const first = targets?.first?.() ?? (targets && typeof targets[Symbol.iterator] == 'function' ? [...targets][0] : null);
  return first?.actor ?? null;
}

export function targetedActors() {
  const targets = globalThis.game?.user?.targets;
  return targets && typeof targets[Symbol.iterator] == 'function' ? [...targets].map(token => token?.actor).filter(Boolean) : [];
}

export function resolveUuid(uuid) {
  try {
    return uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null;
  } catch (error) {
    return null;
  }
}
