/**
 * Which items give something to pick - a free upgrade, another Role's Perk, a made-on-the-spot
 * weapon, a light - and so get a Use button. The picking and granting is in mechanics/resources/grants.mjs;
 * this table stays apart from it so mechanics/actions/action-perks.mjs can ask about the button without
 * importing everything grants.mjs does (which would loop back round to action-perks.mjs).
 */

// (A Hint of Independence and Personal Power Supply are Use rules on their Perks - rules/conv16-b.test.js,
// rules/conv17-split3.test.js. Nothing is left here; a new grant Use goes in the table.)
export const GRANT = {};

const USE_KINDS = new Set([]);

const BY_SOURCE = Object.fromEntries(Object.entries(GRANT).filter(([kind]) => USE_KINDS.has(kind)).map(([kind, id]) => [id, kind]));

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
}

export function grantKindOf(item) {
  return BY_SOURCE[sourceOf(item)] ?? null;
}

export function isGrantUse(item) {
  return !!grantKindOf(item);
}

/**
 * Whether the Use button shows right now.
 * @param {Item} item
 * @returns {Boolean}
 */
export function canUseGrant(item) {
  const kind = grantKindOf(item);
  const actor = item?.parent;
  if (!kind || !actor) {
    return false;
  }

  return true;
}

/**
 * A Hint of Independence's imperfection, if the actor has one: {n, imperfectionType} - kept on the Perk by its Use rule
 * (flags.essence20.imperfection), read where it applies (dice.mjs, documents/actor.mjs, target-riders.mjs, action-perks.mjs,
 * listener-misc-handler.mjs).
 * @param {Actor} actor
 * @returns {Object|null}
 */
export function imperfectionOf(actor) {
  const items = actor?.items;
  const kept = item => !!item?.flags?.essence20?.imperfection;
  const found = Array.isArray(items?.contents) ? items.contents.find(kept)
    : typeof items?.[Symbol.iterator] == 'function' ? [...items].find(kept) : items?.find?.(kept);
  return found?.flags.essence20.imperfection ?? null;
}
