import { getNearbyEnemyTokens } from "./enemies.mjs";

/**
 * Frightening Display (Enigma of Combination, Cannoneer Focus, Gunner, 10th level, p.32): "If you
 * are wielding a two-handed ballistic weapon or have fired one during your previous turn, you can
 * spend a Standard action and attempt an Intimidation Skill Test versus the Willpower Defense of
 * all enemies that can see you within 100 feet. On a success, the enemy is Frightened for 1d4
 * rounds."
 *
 * Same Absolute-Menace-style AoE shape as helpers/absolute-menace.mjs - "a single... Skill Test
 * against... all enemies" maps directly onto this system's own existing generic multi-target roll
 * mechanic (one roll, compared against each targeted enemy's own Defense), so this needed no new
 * roll-comparison logic. Only the auto-targeting (canvas.tokens.setTargets()) and the synthetic
 * rollSkill() trigger (stamped isFrighteningDisplay so dice.mjs can apply Frightened post-hit) are
 * new. The two-handed-ballistic-weapon precondition and "can see you" clause are dropped, the same
 * "trust the player to use it at the right narrative moment" idiom this project already applies to
 * several similarly-gated Perks (Powered Plating, Explosive Morph).
 */
const RADIUS_FEET = 100;

/**
 * Targets every enemy within 100ft and kicks off the Intimidation-vs-Willpower Skill Test.
 * @param {Actor} actor
 */
export async function activateFrighteningDisplay(actor) {
  const enemies = getNearbyEnemyTokens(actor, RADIUS_FEET);
  canvas.tokens.setTargets(enemies.map(token => token.id));

  await actor._dice.rollSkill({
    skill: 'intimidation',
    essence: 'social',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'willpower',
    isFrighteningDisplay: true,
  }, actor);
}
