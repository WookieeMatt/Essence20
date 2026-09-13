/**
 * The Power-side mirror of helpers/perks.mjs#findPerk/actorHasPerk - those two are explicitly
 * scoped to item.type == 'perk' by design (pervasively relied on throughout dice.mjs/
 * banked-buffs.mjs), so a Grid/Sorcerous Power item needs its own equivalent lookup rather than
 * widening that shared contract.
 */

/**
 * @param {Actor} actor
 * @param {String} powerId   The Power's own compendium sourceId.
 * @returns {Item|undefined}
 */
export function findPower(actor, powerId) {
  return actor?.items?.find(item =>
    item.type == 'power'
    && (item.flags?.core?.sourceId == powerId || item._stats?.compendiumSource == powerId),
  );
}

/**
 * @param {Actor} actor
 * @param {String} powerId
 * @returns {Boolean}
 */
export function actorHasPower(actor, powerId) {
  return !!findPower(actor, powerId);
}
