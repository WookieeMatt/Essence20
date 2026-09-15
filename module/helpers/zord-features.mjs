/**
 * The Zord-Feature-side mirror of helpers/perks.mjs#findPerk/actorHasPerk (see helpers/
 * powers.mjs's own identical doc comment) - Zord Features (PR CRB p.134-140) are modeled as
 * bare `feature` items directly on the Zord actor, not `perk` items, so a live combat check for
 * "does this Zord have Martial Zord/Zero-G/etc." needs its own lookup rather than widening
 * findPerk's actor-agnostic but type-locked contract.
 */

/**
 * @param {Actor} actor   Expected to be a Zord actor, but not enforced here - same
 *   caller-scopes-the-actor-type convention findPerk itself uses.
 * @param {String} featureId   The Zord Feature's own compendium sourceId.
 * @returns {Item|undefined}
 */
export function findZordFeature(actor, featureId) {
  return actor?.items?.find(item =>
    item.type == 'feature'
    && (item.flags?.core?.sourceId == featureId || item._stats?.compendiumSource == featureId),
  );
}

/**
 * @param {Actor} actor
 * @param {String} featureId
 * @returns {Boolean}
 */
export function actorHasZordFeature(actor, featureId) {
  return !!findZordFeature(actor, featureId);
}
