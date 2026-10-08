/**
 * Jury Rig (Factions in Action Vol. 2: Intercontinental Adventures, Engineer Troop Focus, 17th level, p.73) - the
 * benefit a vehicle carries. The Use (pick the action type and the benefit, the Technology test against 10 + the
 * vehicle's Threat Level, once per scene as a Standard action) is a rule on the Perk (rules/conv15-banked.test.js); on a
 * success it writes `flags.essence20.pendingJuryRigBenefit` {option, expiresRound} on the vehicle - the round after the
 * current one for the Free action, 999999 plus `scene` (the Scene Clock's scene it ends with) for the Standard one. The
 * Use is once per turn, its Standard version once per scene (book check 2026-10-06). The readers below are what the vehicle's
 * Defenses (dice.mjs), damage, long-range Snag, Movement (documents/actor.mjs) and Push Yourself
 * (mechanics/combat/token-movement.mjs) ask.
 *
 * Benefits: alignSuspension (+1 Evasion), cleanBarrels (no long-range Snag), engineTurboBoost (Aerial Movement = Ground),
 * hardenArmor (+1 Toughness), improveAerodynamics (Push Yourself moves 10 ft), jacketAmmunition (+1 damage on its
 * attacks), watertightSeals (Aquatic Movement = Ground).
 */

import { epochFor } from "../../mechanics/resources/scene-clock.mjs";

const FLAG_KEY = 'pendingJuryRigBenefit';

/**
 * Whether the given vehicle currently has the given Jury Rig benefit active: in a combat, through the stored round;
 * out of combat, always once granted.
 * @param {Actor} targetActor
 * @param {String} option
 * @returns {Boolean}
 */
export function isJuryRigBenefitActive(targetActor, option) {
  const flag = targetActor?.getFlag?.('essence20', FLAG_KEY);
  if (!flag || flag.option != option) {
    return false;
  }

  // The Standard-action version lasts the scene: it stores the Scene Clock's scene (@clock.scene) and ends with it.
  if (Number(flag.scene) > 0 && Number(flag.scene) != Number(epochFor('scene'))) {
    return false;
  }

  return game.combat ? game.combat.round <= flag.expiresRound : true;
}

/**
 * The live, non-consumed Defense bonus Align Suspension/Harden Armor grant, for the given Defense
 * comparison - same shape as items/magic/bolster-defense.mjs#getBolsterDefenseBonus.
 * @param {Actor} targetActor
 * @param {String} defenseType
 * @returns {Number}
 */
export function getJuryRigDefenseBonus(targetActor, defenseType) {
  if (defenseType == 'evasion' && isJuryRigBenefitActive(targetActor, 'alignSuspension')) {
    return 1;
  }

  if (defenseType == 'toughness' && isJuryRigBenefitActive(targetActor, 'hardenArmor')) {
    return 1;
  }

  return 0;
}
