/**
 * Drop-time behaviour for the Zord Features that configure something when they are taken. None is left here: Enhance
 * (Attack), Blast Attack, Multi-Limb Attack, Increase (Essence), Light Chassis, Movement Booster, Additional Attack Type,
 * Restraining Chains and the Zord Mega-Weapon System make their choice (or their weapon) through an `added` Trigger on the
 * Feature (rules/plugins/zords/drop-configure.mjs - a cancelled choice takes the Feature off again). The Mega-Weapon's
 * summon and attack count are its Use and afterRoll rules.
 */

/**
 * Entry point from the drop dispatcher (drop-handler.mjs): every Feature drops straight through.
 * @param {Actor} actor
 * @param {Item} sourceItem
 * @param {Function} dropFunc
 * @returns {Promise<Array<Item>|null>}
 */
export async function onZordFeatureDrop(actor, sourceItem, dropFunc) {
  return dropFunc();
}
