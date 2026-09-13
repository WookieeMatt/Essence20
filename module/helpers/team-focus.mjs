import { actorHasPerk } from "./perks.mjs";

/**
 * Team Focus (Red Ranger, 9th/18th level, p.53): "You add a [+1, then +2 at 18th] to any melee
 * attack that targets a target that has already been attacked by your teammate since your last
 * turn."
 *
 * "Since your last turn" is approximated at round granularity - the same accepted simplification
 * every other "since/until X" clause in this codebase already uses (Alpha Strike, Debilitating
 * Strike) - tracked here as "attacked by an ally THIS ROUND" rather than a precise per-roller
 * window relative to their own last turn. The flag is stamped on the TARGET (not the attacker,
 * unlike Enemy Number One's own round-flag), recording which disposition made the earlier attack,
 * so a later attacker sharing that disposition (an ally of whoever landed it) gets credit for
 * "following up," while the same attacker rolling again solo, or an attacker of the OPPOSING
 * disposition, doesn't.
 */

const TEAM_FOCUS_ROUND_FLAG = 'attackedByAllyThisRound';

/**
 * Records that the given target was just attacked, for a later Team Focus check this round to
 * read back - called for every weaponEffect attack with a resolved target, regardless of the
 * attacker holding Team Focus themselves (any actor's attack can set up someone ELSE's bonus).
 * @param {Actor} attacker
 * @param {Actor} target
 */
export async function markAttackedByAlly(attacker, target) {
  if (!game.combat || !target?.setFlag) {
    return;
  }

  const attackerToken = attacker.getActiveTokens?.()?.[0];
  await target.setFlag('essence20', TEAM_FOCUS_ROUND_FLAG, {
    combatId: game.combat.id,
    round: game.combat.round,
    disposition: attackerToken?.document?.disposition,
    attackerId: attacker.id,
  });
}

/**
 * Whether the given actor's melee attack against target should get Team Focus's own shiftUp -
 * true when the target was already attacked this round by someone sharing the roller's own
 * disposition (an ally), other than the roller's own earlier attack.
 * @param {Actor} actor   The actor rolling (must hold the given Team Focus Perk).
 * @param {Actor} target
 * @param {String} teamFocusId
 * @returns {Boolean}
 */
export function checkTeamFocus(actor, target, teamFocusId) {
  if (!game.combat || !target || !actorHasPerk(actor, teamFocusId)) {
    return false;
  }

  const flag = target.getFlag?.('essence20', TEAM_FOCUS_ROUND_FLAG);
  if (!flag || flag.combatId != game.combat.id || flag.round != game.combat.round) {
    return false;
  }

  if (flag.attackerId == actor.id) {
    return false;
  }

  const actorToken = actor.getActiveTokens?.()?.[0];
  return !!actorToken && flag.disposition === actorToken.document.disposition;
}
