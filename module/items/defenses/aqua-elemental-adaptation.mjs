const AQUA_ELEMENTAL_ADAPTATION_FLAG = 'aquaElementalAdaptations';

/**
 * Elemental Adaptation (Beneath the Helmet, Aqua Ranger, Grid Science III choice, p.42) - the element choice and the
 * teammate it goes to are the Perk's own added Trigger rule (pick an element, pick a Player Character, flagList
 * aquaElementalAdaptations on them). This reads that list: dice.mjs's Acid / Fire damage-type bonus is skipped for an
 * actor that has adapted to the element.
 * @param {Actor} actor
 * @param {String} damageType
 * @returns {Boolean}
 */
export function hasAquaElementalAdaptation(actor, damageType) {
  const adaptations = actor?.getFlag?.('essence20', AQUA_ELEMENTAL_ADAPTATION_FLAG);
  return Array.isArray(adaptations) && adaptations.includes(damageType);
}
