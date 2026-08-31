import { actorHasPerk } from "./perks.mjs";

/**
 * GI Joe CRB p.113 - the Renegade Tank Focus's Enemy Number One (3rd level): "your presence on
 * the battlefield can't be ignored by your enemies. Attacks made by enemies within 30 feet suffer
 * a Snag unless they include you in one of their attacks on their turn."
 *
 * Unlike Paranoia's unconditional "attacks against you suffer a Snag" (dice.mjs), this has two
 * extra wrinkles: it's not the current target who needs the Perk (any nearby enemy Tank
 * qualifies, whether or not they're this roll's target), and it has an exemption clause that
 * needs its own per-turn tracking - an attacker who already targeted the Tank earlier this same
 * turn is exempt from the Snag for the rest of it. That's a per-TURN flag (who's acting, not just
 * which round), distinct from every other once-per-round flag already tracked via
 * helpers/perks.mjs#hasUsedThisRound.
 */

const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
const ENEMY_NUMBER_ONE_ID = `${GI_JOE_CRB}zvzta73A3ROyxv0J`;
const ATTACKED_TANK_FLAG = 'attackedEnemyNumberOneThisTurn';

/**
 * Finds a nearby enemy Tank (an opposing-disposition token within 30 feet of the attacker) who
 * has Enemy Number One - "your enemies," so only tokens on the opposite side of the attacker
 * qualify, same disposition-comparison idiom already used by helpers/personal-shield.mjs (there,
 * for allies; here, inverted for enemies).
 * @param {Token} attackerToken
 * @returns {Token|null}
 * @private
 */
function _findNearbyTank(attackerToken) {
  if (!attackerToken || !canvas?.tokens) {
    return null;
  }

  for (const token of canvas.tokens.placeables) {
    if (token === attackerToken || !token.actor || token.document.disposition === attackerToken.document.disposition) {
      continue;
    }

    if (!actorHasPerk(token.actor, ENEMY_NUMBER_ONE_ID)) {
      continue;
    }

    if (canvas.grid.measurePath([token.center, attackerToken.center]).distance <= 30) {
      return token;
    }
  }

  return null;
}

/**
 * Computes Enemy Number One's effect on this specific roll: whether it should suffer a Snag, and
 * (independently) which Tank's "you attacked me this turn" flag - if any - needs recording
 * afterward. Attacking the Tank itself is always exempt from its own Snag (that attack IS
 * "including" them), and is exactly the case that should mark the flag for the rest of the turn's
 * other attacks.
 * @param {Actor} actor   The attacking actor.
 * @param {Actor|null} target   The roll's resolved target actor, if any.
 * @returns {{snag: Boolean, attackedTankId: String|null}}
 */
export function checkEnemyNumberOne(actor, target) {
  const attackerToken = actor.getActiveTokens?.()?.[0];
  const tankToken = _findNearbyTank(attackerToken);
  if (!tankToken) {
    return { snag: false, attackedTankId: null };
  }

  if (tankToken.actor === target) {
    return { snag: false, attackedTankId: tankToken.actor.id };
  }

  if (!game.combat) {
    // "on their turn" has no meaning without a combat tracker running - same reasoning as
    // helpers/perks.mjs#hasUsedThisRound's own combat-only enforcement, and matches First
    // Strike's own explicit "doesn't apply outside of combat" behavior (dice.mjs). Without this
    // guard, an absent flag and an absent game.combat would both read as undefined and compare
    // equal below, wrongly treating "no active combat" as "already attacked this turn."
    return { snag: false, attackedTankId: null };
  }

  const flag = actor.getFlag?.('essence20', ATTACKED_TANK_FLAG);
  const alreadyAttackedThisTurn = flag?.combatId == game.combat.id
    && flag?.round == game.combat.round
    && flag?.turn == game.combat.turn
    && flag?.tankId == tankToken.actor.id;

  return { snag: !alreadyAttackedThisTurn, attackedTankId: null };
}

/**
 * Records that the actor just attacked (targeted) this specific Enemy Number One Tank, exempting
 * their other attacks against anyone else for the rest of this same turn. No-ops outside of
 * combat, matching every other once-per-round/turn flag in this codebase - "this turn" has no
 * meaning without a combat tracker running.
 * @param {Actor} actor
 * @param {String} tankId
 */
export async function markAttackedEnemyNumberOne(actor, tankId) {
  if (!game.combat) {
    return;
  }

  await actor.setFlag('essence20', ATTACKED_TANK_FLAG, {
    combatId: game.combat.id,
    round: game.combat.round,
    turn: game.combat.turn,
    tankId,
  });
}
