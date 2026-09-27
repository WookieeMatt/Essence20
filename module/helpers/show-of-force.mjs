import { getNearbyEnemyTokens } from "./enemies.mjs";

/**
 * Show of Force (Decepticon Directive, Tyrant Focus, 3rd level, p.46): "you automatically add
 * 'Critical Effect: All enemies within 20ft are Frightened until the end of their next turn' to
 * all of your Might-based attacks."
 *
 * Same overall shape as Absolute Menace (helpers/absolute-menace.mjs) for the actual AoE catch -
 * getNearbyEnemyTokens, RAW says "enemies" specifically here (unlike Avalanche Stomp's "all
 * creatures") - but triggered as a Critical Success RIDER on the attack's own roll (isCrit,
 * Combat p.205's natural-max-die concept - a real weapon Attack, the same isCrit reasoning
 * Metallikato/Tire Strike already use, not the flat-Skill-Test Degrees-of-Success multiplier),
 * gated on checkContext.isMightAttack, rather than a separate Use-triggered roll - there's no
 * second Skill Test here, RAW piggybacks entirely on the attack that already happened.
 */
export const SHOW_OF_FORCE_ID = "Compendium.essence20.decepticon_directive.Item.8BXIvBamlet1BQ2l";
const RADIUS_FEET = 20;

/**
 * Frightens every enemy within 20ft of the attacker's own token.
 * @param {Actor} actor
 * @returns {Promise<Array<Token>>}   The tokens Frightened.
 */
export async function applyShowOfForce(actor) {
  const enemies = getNearbyEnemyTokens(actor, RADIUS_FEET);
  for (const token of enemies) {
    if (token.actor) {
      await token.actor.toggleStatusEffect('frightened', { active: true });
    }
  }

  return enemies;
}
