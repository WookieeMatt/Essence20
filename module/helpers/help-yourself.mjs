/**
 * Help Yourself (MLP CRB, Elementary Utility spell, p.136): "You call forth a magical helper.
 * 2 Spellcasting, 1 scene, 15ft. An illusory clone of yourself that seeks to help appears anywhere
 * within the range of the spell. This clone is mostly intangible and immune to anything but
 * magical damage. It uses the same statistics as the caster if required and disappears before the
 * duration if 'killed'. The clone can do nothing except Lend Assistance, which it can do once each
 * round to anyone within 15 feet of the caster that the caster indicates for as long as the
 * duration."
 *
 * RE-CATEGORIZED 2026-09-15, and the one item on the stale-Lend-Assistance-note queue whose
 * recorded blocker was both stale AND correctly aimed: the clone genuinely can do nothing else, so
 * until that action existed there was nothing to build. It exists now
 * (helpers/lend-assistance.mjs), and this rides it directly.
 *
 * No token is summoned. Nothing in this codebase places or drives an NPC minion, and the clone
 * needs none: everything it actually DOES is expressible from the caster's own side - it "uses the
 * same statistics as the caster," so canAssistWithSkill/getAssistShiftUp already compute exactly
 * the right numbers when passed the caster, and its reach is defined relative to the caster ("within
 * 15 feet of the caster"), not to wherever the clone is standing. What the spell really grants,
 * mechanically, is a once-per-round Lend Assistance at 15ft that costs the caster no action. The
 * clone being intangible, magic-vulnerable, and 'killable' is left to the table - there is no body
 * to shoot at here, and inventing one would add a whole actor to the scene to represent something
 * with no statistics of its own.
 *
 * "For as long as the duration" (1 scene) is pinned to the scene the spell was cast on, which is a
 * real, checkable end rather than this project's usual never-expires approximation: leave that
 * scene and the clone is gone. It still won't notice a second, later scene-in-fiction played out on
 * the same map - the usual limit - and a 'killed' clone is dismissed by simply not using it.
 */
export const HELP_YOURSELF_ID = "Compendium.essence20.mlp_crb.Item.EKCz40TU8BYtcSkN";
export const HELP_YOURSELF_FLAG = 'helpYourselfClone';
export const HELP_YOURSELF_ROUND_FLAG = 'helpYourselfCloneUsedThisRound';

// RAW's own 15ft, deliberately NOT the 50ft the ordinary Lend Assistance action reaches (see
// lend-assistance.mjs#LEND_ASSISTANCE_RADIUS_FEET) - the clone is a short-range helper, and
// handing it the full action's reach would quietly make the spell better than it is.
export const HELP_YOURSELF_RADIUS_FEET = 15;

/**
 * Summons the clone - called from dice.mjs's own post-roll success handling, so a failed cast
 * summons nothing.
 * @param {Actor} actor   The caster.
 */
export async function summonHelpYourselfClone(actor) {
  await actor.setFlag('essence20', HELP_YOURSELF_FLAG, { sceneId: canvas?.scene?.id ?? null });
}

/**
 * Whether the caster's clone is still around: summoned, and the caster hasn't left the scene it
 * was cast on. A clone summoned with no scene at all (no canvas, e.g. a sheet-only session) stays
 * active rather than being treated as expired - failing closed there would silently make the spell
 * do nothing in exactly the case where there's no map to walk off of.
 * @param {Actor} actor   The caster.
 * @returns {Boolean}
 */
export function isHelpYourselfCloneActive(actor) {
  const clone = actor?.getFlag?.('essence20', HELP_YOURSELF_FLAG);
  if (!clone) {
    return false;
  }

  const currentSceneId = canvas?.scene?.id ?? null;
  return !clone.sceneId || !currentSceneId || clone.sceneId == currentSceneId;
}
