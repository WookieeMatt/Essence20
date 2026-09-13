import { getNearbyEnemyTokens } from "./enemies.mjs";

/**
 * Absolute Menace (Beneath the Helmet, Dark Ranger, 18th level, p.40): "When you start your turn,
 * you may expend 2 Personal Power to make a single Intimidation Skill Test against the Willpower
 * of every enemy within 10 feet of you. Each enemy your Skill Test is successful against is
 * Frightened of you until the end of your next turn."
 *
 * "A single... Skill Test against... EVERY enemy" maps directly onto this system's own existing
 * generic multi-target roll mechanic: a plain (non-weaponEffect) Skill Test rolled with several
 * tokens targeted evaluates ONE roll and compares that ONE total against each target's own
 * Defense (dice.mjs's own checkEntries construction only splits into independent per-target rolls
 * for a weaponEffect actually carrying the Multiple Targets trait - a bare Skill Test never does).
 * So this needed no new roll-comparison logic at all - only:
 * - Auto-targeting every enemy within 10ft via canvas.tokens.setTargets(), the same
 *   Mighty Strikes/Shaped Charges/AoE-targeting pattern this codebase already uses for "no click
 *   to place, the area is automatic" effects (see helpers/mighty-strikes.mjs's own doc comment).
 * - Triggering the actual roll via actor._dice.rollSkill() with a synthetic dataset (skill,
 *   essence, and a pre-filled Willpower defenseType so the player isn't asked to pick it
 *   manually), the same "bypass the button-click flow, still go through the full interactive
 *   Roll Options Dialog" shape helpers/consummate-performer.mjs#activateConsummatePerformer
 *   already established - stamped with isAbsoluteMenace so dice.mjs can flag the resulting
 *   checkContext for its own post-hit Frightened application (see dice.mjs's own
 *   isAbsoluteMenaceAttempt comment).
 */
const RADIUS_FEET = 10;

/**
 * Targets every enemy within 10ft and kicks off the Intimidation-vs-Willpower Skill Test. The
 * actual Power spend happens the same way any other Power-costing "Use" dispatch does
 * (banked-buffs.mjs), before this is ever called.
 * @param {Actor} actor
 */
export async function activateAbsoluteMenace(actor) {
  const enemies = getNearbyEnemyTokens(actor, RADIUS_FEET);
  canvas.tokens.setTargets(enemies.map(token => token.id));

  await actor._dice.rollSkill({
    skill: 'intimidation',
    essence: 'social',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'willpower',
    isAbsoluteMenace: true,
  }, actor);
}
