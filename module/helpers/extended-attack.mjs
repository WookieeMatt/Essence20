/**
 * Extended Attack (Transformers CRB, Outrider Focus, 13th level, p.90): "By extending yourself
 * through gumption and partial conversion, you can hit further targets. As a Move action, you can
 * double the Reach of a Melee weapon until the beginning of your next turn."
 *
 * A plain on/off flag on the actor, same Use-button toggle shape as Scramble/Dig In/Evasive
 * Maneuvers ("as a Move action" has no fictional trigger to detect, so it's toggled rather than
 * measured). Read directly from data/item/weapon-effect.mjs#prepareDerivedData - the exact same
 * range.reachMultiplier -> totalReach pipeline Heavy Chassis/Increase (Essence)/Enhance (Attack)
 * already feed into for a PERMANENT reach doubling - rather than dice.mjs, since totalReach is
 * derived data on the weapon item itself, prepared well before any roll happens.
 *
 * "Until the beginning of your next turn" is not actively expired - this project has no per-actor
 * turn-boundary hook to clear a flag on, so it's a manual toggle-off, the same accepted duration
 * idiom as every other on/off toggle here.
 */
export const EXTENDED_ATTACK_ID = "Compendium.essence20.tf_crb.Item.bpTOPVRx3hKkq4Yr";
export const EXTENDED_ATTACK_FLAG = 'extendedAttackActive';

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isExtendedAttackActive(actor) {
  return !!actor?.getFlag?.('essence20', EXTENDED_ATTACK_FLAG);
}

/**
 * Toggles Extended Attack on the given actor.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   The new state.
 */
export async function toggleExtendedAttack(actor) {
  const nowActive = !isExtendedAttackActive(actor);
  await actor.setFlag('essence20', EXTENDED_ATTACK_FLAG, nowActive);
  return nowActive;
}
