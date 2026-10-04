/**
 * Shared bits for the qualify2 extension modules: the compendium ids this slice automates, and
 * small item/actor lookups (same shapes as helpers/perks.mjs, but for any item type).
 */

const ID = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;

export const Q2 = {
  // G.I. Joe
  upgradeTraining: ID('intercontinental_adventures', 'zhwJbYTopQB2RuuM'),
  whisperWarrior: ID('intercontinental_adventures', 'T4p7oPq8Kk0SHVb3'),
  doOrDie: ID('general_hawk_s_personel_files', '4NG56r746V7BLt8W'),
  wildIdea: ID('general_hawk_s_personel_files', 'CVl4P0zoArmY5mp1'),
  atEaseDisease: ID('sgt_slaughter_sourcebook', 'MHPffqgwDx7u3tlZ'),
  oorah: ID('sgt_slaughter_sourcebook', '7CuDik9Vtpou9iDJ'),
  cascadingFailure: ID('quartermasters_guide_to_gear', 'plJkKBuGrkxIYCnS'),
  destructiveOvercharge: ID('quartermasters_guide_to_gear', 'RpNG4KelUPWm54xv'),
  tradeSchool: ID('quartermasters_guide_to_gear', 'yR5QrBHWNUnbuiG7'),
  technicalMastery: ID('quartermasters_guide_to_gear', 'QKlXoVgNMq7Kv58L'),
  trainingEvolution: ID('quartermasters_guide_to_gear', 'zqy47bzuJHaON2TP'),
  weaponEnthusiastHangUp: ID('quartermasters_guide_to_gear', 'GcMPz5MICXwTzKOq'),
  weaponEnthusiast: ID('quartermasters_guide_to_gear', 'pwpCtdsf8l7T6Sii'),
  // Transformers
  hardwareTraining: ID('enigma_of_combination', '6Ov5odRU8tGhQJzu'),
  moraleBooster: ID('enigma_of_combination', 'TQCvGZe5npeJ4heO'),
  mentor: ID('tf_crb', 'aMrMtyNJUsSYyMId'),
  opportunist: ID('tf_crb', '8JpfjvHVDHWKjMc9'),
  // My Little Pony
  sensitive: ID('mlp_crb', 'cLe7ettmAIaBUYIj'),
  detailOriented: ID('mlp_crb', 'FBIg9BWG2CyjqgBP'),
  // Welcome to Night Vale
  everythingIsInspiration: ID('wtnv_citizens_guide', 'c1gIi1A6MKHkOwdy'),
  realAngels: ID('wtnv_citizens_guide', 'i5hL9SSARFDMf6UH'),
  timelineAnomaly: ID('wtnv_citizens_guide', 'NQXcQL05DLCs75xb'),
};

// The "silent battledress upgrade" (G.I. Joe CRB) Oorah! qualifies with.
export const SILENT_BATTLEDRESS = ID('gi_joe_crb', 'nftZIaQ3MVn2nviU');

export const T = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

export function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;
}

export function itemsOf(actor) {
  const items = actor?.items;
  if (!items) {
    return [];
  }

  if (Array.isArray(items.contents)) {
    return items.contents;
  }

  if (Array.isArray(items)) {
    return items;
  }

  return typeof items[Symbol.iterator] == 'function' ? [...items] : [];
}

/** The actor's item copied from this compendium uuid, of any type. */
export function itemOf(actor, uuid) {
  if (!uuid) {
    return null;
  }

  return itemsOf(actor).find(item => sourceOf(item) == uuid) ?? null;
}

export function has(actor, uuid) {
  return !!itemOf(actor, uuid);
}

export function escape(text) {
  return foundry?.utils?.escapeHTML ? foundry.utils.escapeHTML(String(text ?? '')) : String(text ?? '');
}

/** A weapon's traits, as prepared (itemAndUpgradeTraits) or stored. */
export function traitsOf(item) {
  const traits = item?.system?.itemAndUpgradeTraits ?? item?.system?.traits ?? [];
  return Array.isArray(traits) ? traits : Object.keys(traits).filter(key => traits[key]);
}

/** The attacks of a weapon, owned (an actor's weaponEffect Items) or as its stored entries. */
export function effectsOf(weapon) {
  const owned = weapon?.parent ? itemsOf(weapon.parent).filter(item => item.type == 'weaponEffect' && item.flags?.essence20?.parentId == weapon.id) : [];
  if (owned.length) {
    return owned.map(effect => effect.system ?? {});
  }

  return Object.values(weapon?.system?.items ?? {}).filter(entry => entry?.type == 'weaponEffect');
}

/** The weapon a weaponEffect Item belongs to. */
export function parentWeapon(actor, effect) {
  const parentId = effect?.flags?.essence20?.parentId;
  return parentId ? actor?.items?.get?.(parentId) ?? null : null;
}
