import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

/**
 * At All Cost (Through the Shattered Grid, Magna Defender, 18th level, p.25): "Once per day, you
 * can fight beyond reaching 0 Health while Morphed. Instead of being Defeated or returning to your
 * normal form, you may continue to fight normally. During this time, when an enemy successfully
 * hits you, you lose Personal Power instead of Health. If, at any time during this Role Perk's
 * use, you reach 0 Personal Power, you immediately return to your normal form with 0 Health, with
 * the Conditions Unconscious and Defeated."
 *
 * A plain on/off toggle (like Power Boost/Dig In) rather than a bank-now/consume-later flag - it
 * doesn't grant a bonus to a future roll, it changes how ALL of this actor's incoming damage
 * resolves for as long as it's active. "Once per day" is approximated as once per scene
 * (hasUsedThisEncounter, this codebase's own standing idiom for every "once per day" resource -
 * see Grid Surges/Idea Points' own daily refresh, which is manual too) - gates only ACTIVATING it,
 * matching every other once-per-scene toggle in this project (Elemental Storm, Curb Your
 * Enthusiasm) rather than the toggle itself, which can still be switched back off freely.
 *
 * The damage-conversion half (applyAtAllCostDamage) is called from helpers/combat.mjs#applyDamage
 * in place of the normal Health subtraction, whenever this is active - "return to your normal
 * form" is approximated as simply toggling Unconscious + Defeated (the same "grant the Conditions,
 * let a GM narrate the actual un-Morph" idiom this project uses for the closely analogous 0-Health
 * auto-revert every Morphed Role already has via hasMorphedToughnessBonus, which this codebase
 * doesn't otherwise intercept in code either).
 */
const AT_ALL_COST_FLAG = 'atAllCostActive';
const AT_ALL_COST_ENCOUNTER_FLAG = 'atAllCostUsedThisEncounter';

/**
 * Whether At All Cost is currently converting this actor's incoming damage to Power loss.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isAtAllCostActive(actor) {
  return !!actor.getFlag?.('essence20', AT_ALL_COST_FLAG);
}

/**
 * Whether the actor may switch At All Cost ON right now - Morphed, not already active, and
 * (approximating "once per day") not already used this scene.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canActivateAtAllCost(actor) {
  return !!actor.system.isMorphed && !isAtAllCostActive(actor)
    && !hasUsedThisEncounter(actor, AT_ALL_COST_ENCOUNTER_FLAG);
}

/**
 * Switches At All Cost on, marking the scene's own once-per-day use.
 * @param {Actor} actor
 */
export async function activateAtAllCost(actor) {
  await actor.setFlag('essence20', AT_ALL_COST_FLAG, true);
  await markUsedThisEncounter(actor, AT_ALL_COST_ENCOUNTER_FLAG);
}

/**
 * Switches At All Cost back off manually (a Free action per RAW's own framing of "you may
 * continue to fight normally" as an ongoing choice, though RAW never explicitly names a way to end
 * it early other than the automatic Power-exhaustion revert below).
 * @param {Actor} actor
 */
export async function deactivateAtAllCost(actor) {
  await actor.unsetFlag('essence20', AT_ALL_COST_FLAG);
}

/**
 * Applies At All Cost's own damage-conversion in place of the normal Health subtraction: the
 * actor loses Personal Power equal to the incoming amount instead. If Power would hit 0, the
 * actor immediately reverts (0 Health, Unconscious + Defeated, toggle switches back off).
 * @param {Actor} actor
 * @param {Number} amount   The damage that would otherwise be subtracted from Health (already
 *   reduced by Immunity/Elemental Shield/Adapted Wavelength/Resilient Armor upstream).
 * @returns {Promise<Number>}   The amount actually converted, matching applyDamage's own
 *   "amount actually applied" return contract.
 */
export async function applyAtAllCostDamage(actor, amount) {
  const currentPower = actor.system.powers.personal.value;
  const newPower = Math.max(0, currentPower - amount);
  await actor.update({ 'system.powers.personal.value': newPower });

  if (newPower <= 0) {
    await actor.unsetFlag('essence20', AT_ALL_COST_FLAG);
    await actor.update({ 'system.health.value': 0 });
    await actor.toggleStatusEffect('unconscious', { active: true });
    await actor.toggleStatusEffect('defeated', { active: true });
  }

  return currentPower - newPower;
}
