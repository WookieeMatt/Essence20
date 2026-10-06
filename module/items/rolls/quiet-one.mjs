/**
 * The Quiet One (Factions in Action Vol. 2, Dreadnok General Perk, p.63; prerequisite: Infiltration +d6): "If, since your
 * last turn, an ally operated a vehicle or attacked with a weapon without the Silent trait, you can spend a Free action to
 * gain an Edge on Infiltration Skill Tests this turn."
 *
 * The Use and its Edge are rules on the Perk (rules/conv15-banked.test.js): offered while a combatant on the holder's side
 * carries this round's "noisy action" stamp (`combat:ally:target:stamped:quietOneNoisyActionThisRound`). This file is the
 * stamp itself - every actor that drives or attacks with a non-Silent weapon gets it (dice.mjs#rollSkill), held The Quiet
 * One or not, since anyone's noise can set up someone else's Edge. "Since your last turn" is read at round granularity.
 */
const QUIET_ONE_NOISY_FLAG = 'quietOneNoisyActionThisRound';

/**
 * Records that the given actor just did something "noisy" (drove a vehicle, or attacked with a
 * non-Silent weapon) - called unconditionally, regardless of whether the actor holds The Quiet One
 * themselves (any actor's own noisy action can set up someone ELSE's Edge).
 * @param {Actor} actor
 */
export async function markQuietOneNoisyAction(actor) {
  if (!game.combat || !actor?.setFlag) {
    return;
  }

  await actor.setFlag('essence20', QUIET_ONE_NOISY_FLAG, {
    combatId: game.combat.id,
    round: game.combat.round,
  });
}
