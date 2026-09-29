/**
 * Eye for Appraisal (Decepticon Directive Raider, 1st level, p.61) - the "marked target" half
 * only. RAW: "as a Free action, once per scene, make a DIF 12 Alertness Skill Test. On a success,
 * you may... know the best 20x20ft area from which to fire on a specific target, granting an
 * upshift 1 to your next 2 ranged attacks against that target from that area." The other half of
 * the Perk (learning the scene's 3 most valuable items) is pure GM-narrative judgment, not
 * automatable - see the project plan's own Decepticon Directive categorization writeup.
 *
 * The DIF 12 Alertness Skill Test itself isn't gated here - this system's own generic Skill Test
 * tools already let a player roll Alertness against a DIF the GM sets, the same "the player rolls
 * it themselves, then clicks Use once they know they succeeded" idiom this codebase already
 * accepts for narrative-gated Perks elsewhere - so this is a sheet "Use" button (same shape as
 * Mark Target) that marks whichever token is currently targeted, dropping the "specific 20x20ft
 * area" restriction (this system has no scene-geometry tracking to check it against, the same
 * approximation every other area/LOS clause in this project already accepts). "Your next 2 ranged
 * attacks" is self-only (unlike Spot's "anyone") and consumed one use per matching attack - see
 * dice.mjs's own eyeForAppraisalTarget comment for the read/consume half.
 */

const EYE_FOR_APPRAISAL_FLAG = 'eyeForAppraisalMark';
const VANTAGE_POINT_ID = "Compendium.essence20.decepticon_directive.Item.j8s0vIsIEUJzAAvy";

/**
 * Marks the actor's currently-targeted token with a 2-use Eye for Appraisal bonus against the
 * marking actor's own next ranged attacks.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   False (and no flag set) if nothing is targeted.
 */
export async function markEyeForAppraisal(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.EyeForAppraisalNoTarget'));
    return false;
  }

  // "know the best 20x20ft area from which to fire on a specific target" - the spot is picked on the
  // canvas when it matters to something: Vantage Point's "from within an area defined by the Eye
  // For Appraisal Role Perk gain Edge" (Decepticon Directive p.64).
  let area = null;
  if (actor.items?.some?.(item => (item.flags?.core?.sourceId ?? item._stats?.compendiumSource) == VANTAGE_POINT_ID)) {
    const { pickCanvasPoint } = await import("./forced-movement.mjs");
    const point = await pickCanvasPoint(game.i18n.localize('E20.EyeForAppraisalPickArea'));
    area = point ? { x: point.x, y: point.y, sceneId: canvas?.scene?.id ?? null } : null;
  }

  await targetActor.setFlag('essence20', EYE_FOR_APPRAISAL_FLAG, { attackerId: actor.id, usesRemaining: 2, ...(area ? { area } : {}) });
  return true;
}

/**
 * Whether the attacker is standing in the 20x20ft area its Eye for Appraisal picked against this
 * target.
 * @param {Actor} attacker
 * @param {Actor} target
 * @param {Token} attackerToken
 * @returns {Boolean}
 */
export function isInAppraisedArea(attacker, target, attackerToken) {
  const mark = target?.getFlag?.('essence20', EYE_FOR_APPRAISAL_FLAG);
  const area = mark?.area;
  if (!area || mark.attackerId != attacker?.id || !attackerToken || area.sceneId != canvas?.scene?.id) {
    return false;
  }

  const half = 10 * (canvas.dimensions?.distancePixels ?? 1);
  return Math.abs(attackerToken.center.x - area.x) <= half && Math.abs(attackerToken.center.y - area.y) <= half;
}
