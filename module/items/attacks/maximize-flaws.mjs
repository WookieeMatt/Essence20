/**
 * Maximize Flaws (Finster's Monster-Matic Cookbook, Path of Thorns, 7th level, p.297): "As a Free
 * action, spend 1 Personal Power; your attacks for the rest of your turn ignore a single target's
 * Resistances. If the target has no Resistances [to the damage type being used], you gain Edge on
 * these attacks instead."
 *
 * "Resistance" in this system already manifests as an automatic Snag on the ATTACKER's own roll
 * (see combat.mjs's own doc comment on applyDamage - Resistance never reduces damage directly,
 * dice.mjs's `_getAutomaticCombatModifiers` applies the Snag instead), so "ignore Resistances"
 * means suppressing that one specific Snag check for this Perk's own chosen target.
 *
 * Needs BOTH a turn-scope (like Psycho Assault's own hasUsedThisTurn/markUsedThisTurn reuse) AND a
 * specific target lock (like Menacing Glare's own per-target-uuid Edge scoping) at once - since
 * neither existing helper carries the other's extra payload, this stores its own flag object
 * directly ({combatId, round, turn, targetUuid}), the same shape those two generic helpers already
 * use internally, just with the target added.
 */
const MAXIMIZE_FLAWS_FLAG = 'maximizeFlawsTarget';
const ACTIVATION_COST = 1;

function isFlagCurrent(flag) {
  return !!flag && !!game.combat
    && flag.combatId == game.combat.id && flag.round == game.combat.round && flag.turn == game.combat.turn;
}

/**
 * @param {Actor} actor
 * @returns {String|null}   The targeted actor's own uuid, if the bank is still valid this turn.
 */
export function getMaximizeFlawsTargetUuid(actor) {
  const flag = actor?.getFlag?.('essence20', MAXIMIZE_FLAWS_FLAG);
  return isFlagCurrent(flag) ? flag.targetUuid : null;
}

/**
 * Spends 1 Personal Power and locks in the currently-targeted actor for the rest of this turn.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether activation actually happened.
 */
export async function activateMaximizeFlaws(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor || (actor.system.powers?.personal?.value ?? 0) < ACTIVATION_COST) {
    return false;
  }

  await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - ACTIVATION_COST });
  await actor.setFlag('essence20', MAXIMIZE_FLAWS_FLAG, {
    combatId: game.combat?.id,
    round: game.combat?.round,
    turn: game.combat?.turn,
    targetUuid: targetActor.uuid,
  });
  return true;
}
