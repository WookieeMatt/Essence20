/**
 * Growl (Cobra Codex, Vanguard Warthog Focus, 1st level, p.69): "As a Free action, you can
 * attempt an Intimidation Skill Test against the Willpower of a creature within reach. On a
 * success, you gain shiftUp 1 on your attacks against that target this turn. You can use Growl
 * multiple times, but only once per target per turn."
 *
 * Same single-target "trigger a real dialog roll via actor._dice.rollSkill()" shape as Menace/
 * Duty Of The Graphite. The once-per-target-per-turn gate needs its own per-target tracking (not
 * the plain hasUsedThisTurn single flag) - a {combatId, round, turn, targetIds} record, the same
 * combatant-turn-identity triple hasUsedThisTurn/markUsedThisTurn key on, widened to a list. The
 * granted shiftUp is banked on the ACTOR (Growl's own user), scoped to the specific target's id -
 * the same "self-bonus that only applies against one particular other actor" shape Menacing
 * Glare's own Edge effect already established, just a shiftUp instead of an Edge, and gated on
 * isAttack ("your attacks against that target," not any Skill Test).
 */

const GROWL_FLAG = 'growlTargetsThisTurn';

function isCurrentTurnRecord(stored) {
  return !!game.combat && stored?.combatId == game.combat.id
    && stored?.round == game.combat.round && stored?.turn == game.combat.turn;
}

/**
 * Whether the actor can still Growl at this target this turn (hasn't already this turn).
 * @param {Actor} actor
 * @param {String} targetId
 * @returns {Boolean}
 */
export function canUseGrowl(actor, targetId) {
  if (!game.combat) {
    return false;
  }

  const stored = actor.getFlag?.('essence20', GROWL_FLAG);
  const targetIds = isCurrentTurnRecord(stored) ? stored.targetIds : [];
  return !targetIds.includes(targetId);
}

async function markGrowlUsed(actor, targetId) {
  const stored = actor.getFlag?.('essence20', GROWL_FLAG);
  const targetIds = isCurrentTurnRecord(stored) ? stored.targetIds : [];
  await actor.setFlag('essence20', GROWL_FLAG, {
    combatId: game.combat.id,
    round: game.combat.round,
    turn: game.combat.turn,
    targetIds: [...targetIds, targetId],
  });
}

export async function activateGrowl(actor) {
  const targetToken = game.user.targets.first();
  const targetActor = targetToken?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.GrowlNoTarget'));
    return;
  }

  if (!canUseGrowl(actor, targetActor.id)) {
    ui.notifications.warn(game.i18n.localize('E20.GrowlUnavailable'));
    return;
  }

  await markGrowlUsed(actor, targetActor.id);
  await actor._dice.rollSkill({
    skill: 'intimidation',
    essence: 'strength',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'willpower',
    isGrowl: true,
  }, actor);
}
