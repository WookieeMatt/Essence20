import { actorHasPerk } from "./perks.mjs";

/**
 * Sneak Attack (Ferocious Fighters, Force Recon Focus, 6th level, p.47): "once per combat, when
 * you attack a target within 30 feet who isn't fully aware of you, such as if they are surprised
 * or you successfully used the Hide action against them, your strike deals additional damage
 * equal to the sneak attack of a Commando of your Infantry Level." Veiled Attacker (17th level,
 * p.48): "you can use Sneak Attack twice per combat instead of once but never more than once per
 * attack."
 *
 * A genuinely different trigger shape from GI Joe CRB's own Sneak Attack Damage/Predator's Sneak
 * Attack (helpers/sneak-attack.mjs) - no silent-weapon requirement, no Edge-or-nearby-ally
 * requirement, a flat 30ft range instead of 20/60ft, and a per-COMBAT use cap (optionally doubled
 * by Veiled Attacker) rather than per-round - so it gets its own dedicated file rather than being
 * folded into that one, matching this project's own established practice of NOT generalizing every
 * similarly-shaped Sneak-Attack-family Perk into one shared implementation (Commando's own version
 * and Predator's own version are already two separately-coded functions in that file). The damage
 * AMOUNT itself is the identical "sneak attack of a Commando of your [Role] Level" table already
 * exposed as getPredatorSneakAttackDamage() - reused directly here rather than duplicated, since
 * RAW ties both Perks to the exact same underlying progression.
 *
 * The range check (30ft) is auto-detectable and checked here; "isn't fully aware of you" has no
 * hook anywhere in this codebase (no Surprised status, no Hide-action/stealth-success tracking) -
 * same "can't auto-detect, player confirms" limitation Predator's own version already accepts.
 */
const FORCE_RECON_SNEAK_ATTACK_ID = "Compendium.essence20.ferocious_fighters.Item.FWN6697ESy9ua6VI";
const VEILED_ATTACKER_ID = "Compendium.essence20.ferocious_fighters.Item.6OxGuWzQz0Fiivas";
const RANGE_FEET = 30;
const FORCE_RECON_SNEAK_ATTACK_ENCOUNTER_FLAG = 'forceReconSneakAttackUsesThisEncounter';

/**
 * @param {Actor} actor
 * @returns {Number}   0, 1, or 2 uses already spent this combat.
 */
function _getUsesThisEncounter(actor) {
  const pending = actor.getFlag?.('essence20', FORCE_RECON_SNEAK_ATTACK_ENCOUNTER_FLAG);
  if (!pending || pending.combatId != game.combat?.id) {
    return 0;
  }

  return pending.uses;
}

/**
 * Whether the actor still has an unused Sneak Attack this combat (1 normally, 2 with Veiled
 * Attacker).
 * @param {Actor} actor
 * @returns {Boolean}
 */
function _hasUsesRemaining(actor) {
  if (!game.combat) {
    return false;
  }

  const maxUses = actorHasPerk(actor, VEILED_ATTACKER_ID) ? 2 : 1;
  return _getUsesThisEncounter(actor) < maxUses;
}

/**
 * Computes whether Force Recon's own Sneak Attack is currently eligible, to seed the Roll Options
 * Dialog checkbox's starting state - same "auto-detect what's checkable, player confirms the rest"
 * role as checkSneakAttackEligibility()/checkPredatorSneakAttackEligibility().
 * @param {Actor} actor
 * @returns {{eligible: Boolean, reason: String}}
 */
export function checkForceReconSneakAttackEligibility(actor) {
  if (!_hasUsesRemaining(actor)) {
    return { eligible: false, reason: game.i18n.localize('E20.SneakAttackReasonAlreadyUsed') };
  }

  const attackerToken = actor.getActiveTokens()[0];
  const targetToken = game.user.targets.first();
  if (!attackerToken || !targetToken) {
    return { eligible: false, reason: game.i18n.localize('E20.SneakAttackReasonNoTarget') };
  }

  const distance = canvas.grid.measurePath([attackerToken.center, targetToken.center]).distance;
  if (distance > RANGE_FEET) {
    return { eligible: false, reason: game.i18n.localize('E20.SneakAttackReasonOutOfRange') };
  }

  return { eligible: false, reason: game.i18n.localize('E20.PredatorSneakAttackReasonManual') };
}

/**
 * Records that this actor just spent one of their Sneak Attack uses this combat.
 * @param {Actor} actor
 */
export async function markForceReconSneakAttackUsed(actor) {
  if (!game.combat) {
    return;
  }

  await actor.setFlag('essence20', FORCE_RECON_SNEAK_ATTACK_ENCOUNTER_FLAG, {
    combatId: game.combat.id,
    uses: _getUsesThisEncounter(actor) + 1,
  });
}

export { FORCE_RECON_SNEAK_ATTACK_ID };
