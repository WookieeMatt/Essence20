import { getTokensInShape, feetToPixels } from "./aoe-targeting.mjs";

/**
 * Avalanche Stomp (Finster's Monster-Matic Cookbook, Path of Stone, 9th level, p.296): "As a
 * Standard action, spend 1 Personal Power to make an Athletics Skill Test against the Toughness
 * Defense of all creatures within 30 feet of you and on the ground. On a success, a target takes
 * Stun 2; on a Critical Success, the target is also knocked Prone."
 *
 * RAW targets "all creatures" (not just enemies), so - unlike Absolute Menace's own
 * getNearbyEnemyTokens - this reuses Mighty Strikes' own disposition-agnostic
 * getTokensInShape(aoe-targeting.mjs) centered on the actor's token, same "no click to place, the
 * area is automatic" idiom. This codebase has no elevation/flight-state tracking anywhere
 * (confirmed - no toggleable "flying" status in config.mjs's own statusEffects list), so "and on
 * the ground" can't be filtered on; every creature in range is targeted, the same "no numeric
 * Condition levels" style approximation this project already accepts for Flashy's "Blinded 2".
 * "Stun 2" likewise collapses to the plain boolean 'stunned' status toggle.
 *
 * The actual Athletics-vs-Toughness roll and its Stun/Prone application both go through
 * dice.mjs's existing shared-roll-vs-every-target pipeline (isAvalancheStompAttempt, mirroring
 * Absolute Menace/Undo Engine's own post-hit blocks), keyed on each result's own
 * multiplier (>= 2 is this system's Critical Success threshold) for the Prone rider.
 */
export const AVALANCHE_STOMP_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.NyK58rUo6jiwX5Aq";
const RADIUS_FEET = 30;

/**
 * Targets every creature within 30ft and kicks off the Athletics-vs-Toughness Skill Test. The
 * Personal Power spend happens the same way any other Power-costing "Use" dispatch does
 * (banked-buffs.mjs), before this is ever called.
 * @param {Actor} actor
 * @returns {Promise<Array<Token>>}   The tokens targeted, or [] if the actor has no token.
 */
export async function activateAvalancheStomp(actor) {
  const originToken = actor.getActiveTokens?.()?.[0];
  if (!originToken) {
    return [];
  }

  const radius = feetToPixels(RADIUS_FEET);
  const origin = originToken.center;
  const shapeData = { type: 'circle', x: origin.x, y: origin.y, radius };

  const tokens = getTokensInShape(shapeData).filter(token => token !== originToken);
  canvas.tokens.setTargets(tokens.map(token => token.id));

  await actor._dice.rollSkill({
    skill: 'athletics',
    essence: 'strength',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'toughness',
    isAvalancheStomp: true,
  }, actor);

  return tokens;
}

/**
 * Applies Stun to a successfully-hit target, and Prone as well on a Critical Success.
 * @param {Actor} targetActor
 * @param {Boolean} isCriticalSuccess   True if this result's own multiplier was >= 2.
 */
export async function applyAvalancheStompEffect(targetActor, isCriticalSuccess) {
  await targetActor.toggleStatusEffect('stunned', { active: true });
  if (isCriticalSuccess) {
    await targetActor.toggleStatusEffect('prone', { active: true });
  }
}
