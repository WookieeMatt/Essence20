/**
 * The Quiet One (Factions in Action Vol. 2, Dreadnok General Perk, p.63; prerequisite:
 * Infiltration +d6): "If, since your last turn, an ally operated a vehicle or attacked with a
 * weapon without the Silent trait, you can spend a Free action to gain an Edge on Infiltration
 * Skill Tests this turn."
 *
 * Unlike Team Focus/Withering Fire's own "attacked by an ally this round" check (which is scoped
 * to a specific TARGET, since their own bonus applies to attacking that same target), this Perk's
 * trigger has no target at all - it's "did ANY ally act noisily," a party-wide fact. Modeled as: a
 * plain per-actor "I just did something noisy" flag (stamped on whoever rolls Driving or attacks
 * with a non-Silent weapon, in dice.mjs#rollSkill, unconditional on the roll's own outcome), and a
 * whole-combat scan for a same-disposition combatant carrying that flag this round (no RAW-stated
 * range to scope a nearby-only scan to, unlike most aura-shaped Perks in this project - the same
 * "whole encounter" scan Iconoclast's own reciprocal check already establishes for a similarly
 * range-unstated trigger). "Since your last turn" is approximated at round granularity, the same
 * idiom Team Focus's own identical wording already uses. The banked Edge is scoped to "this turn"
 * (the same combatId/round/turn identity hasUsedThisTurn already keys on), not just "this round."
 */
const QUIET_ONE_NOISY_FLAG = 'quietOneNoisyActionThisRound';
const QUIET_ONE_EDGE_FLAG = 'quietOneEdgeActive';

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

/**
 * Whether any OTHER combatant sharing the actor's own disposition acted noisily this round.
 * @param {Actor} actor
 * @returns {Boolean}
 */
function _hasNoisyAlly(actor) {
  const actorToken = actor.getActiveTokens?.()?.[0];
  if (!game.combat || !actorToken) {
    return false;
  }

  return game.combat.combatants.some(combatant => {
    if (!combatant.actor || combatant.actor.id == actor.id
      || combatant.token?.disposition !== actorToken.document?.disposition) {
      return false;
    }

    const flag = combatant.actor.getFlag?.('essence20', QUIET_ONE_NOISY_FLAG);
    return !!flag && flag.combatId == game.combat.id && flag.round == game.combat.round;
  });
}

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseQuietOne(actor) {
  return _hasNoisyAlly(actor);
}

/**
 * Spends the Free action, banking an Edge on Infiltration for the rest of this turn.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function activateQuietOne(actor) {
  if (!canUseQuietOne(actor)) {
    return false;
  }

  await actor.setFlag('essence20', QUIET_ONE_EDGE_FLAG, {
    combatId: game.combat.id,
    round: game.combat.round,
    turn: game.combat.turn,
  });
  return true;
}

/**
 * The live, non-consumed Infiltration Edge The Quiet One grants for the rest of the current turn.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function getQuietOneEdge(actor) {
  const flag = actor.getFlag?.('essence20', QUIET_ONE_EDGE_FLAG);
  return !!flag && !!game.combat && flag.combatId == game.combat.id
    && flag.round == game.combat.round && flag.turn == game.combat.turn;
}
