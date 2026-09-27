/**
 * Blindsight - sensing at close range without sight, independent of the Blinded Condition.
 *
 * Built 2026-09-15 for Visionless Sight (Technorganic Secrets, Swimmer Bot Mode Origin Perk,
 * p.44): "While under the effects of the Blinded condition, you are still able to detect creatures
 * and objects within 10 feet of you as if you were not Blinded."
 *
 * CORRECTS THIS PROJECT'S OWN RECORDED BLOCKER, which read "E20.visionModes has no
 * blindsight-equivalent mode." That named the wrong mechanism: a vision MODE
 * (TokenDocument#sight.visionMode, which helpers/actor.mjs#applyVisionToTokens already writes) is
 * useless here, because Foundry disables sight-based perception wholesale under
 * CONFIG.specialStatusEffects.BLIND - the exact status this Perk is defined against. The right
 * hook is a DETECTION mode, which this system had never touched at all.
 *
 * Reading Foundry's own DetectionMode#_canDetect settles precisely what is needed, and neither
 * stock non-sight mode provides it:
 *   - the BLIND status is only consulted for modes whose `type` is SIGHT, so any other type
 *     survives it;
 *   - `walls: false` bypasses the line-of-sight polygon entirely, and BOTH stock non-sight modes
 *     (feelTremor, senseAll) set it, so both would sense straight through walls;
 *   - feelTremor additionally detects only Tokens and refuses flying or hovering ones, which would
 *     under-grant a Perk that says plainly "creatures and objects."
 * RAW's own "as if you were not Blinded" means ordinary perception rules inside the radius - walls
 * included - so this registers one small mode of its own: walls: true (so the LOS polygon is
 * tested, per DetectionMode#_testLOS), angle: false (360 degrees - you are not facing anything),
 * and a non-SIGHT type so the BLIND status never switches it off.
 *
 * It is registered for every actor that has a grant, not only while actually Blinded: within its
 * radius it detects exactly what ordinary sight would, so it changes nothing until sight is gone.
 */
export const BLINDSIGHT_DETECTION_MODE_ID = 'essence20Blindsight';

/**
 * Registers the detection mode with Foundry. Called once at init, before any token is drawn.
 */
export function registerBlindsightDetectionMode() {
  const modes = CONFIG.Canvas?.detectionModes;
  if (!modes || modes[BLINDSIGHT_DETECTION_MODE_ID]) {
    return;
  }

  const DetectionModeAll = CONFIG.Canvas.detectionModes.senseAll?.constructor;
  if (!DetectionModeAll) {
    return;
  }

  modes[BLINDSIGHT_DETECTION_MODE_ID] = new DetectionModeAll({
    id: BLINDSIGHT_DETECTION_MODE_ID,
    label: 'E20.DetectionModeBlindsight',
    walls: true,
    angle: false,
    type: foundry.canvas.perception.DetectionMode.DETECTION_TYPES.MOVE,
  });
}

/**
 * The best blindsight radius an actor's items grant, or 0 for none. Same "largest range wins,
 * gear only while equipped" rule documents/actor.mjs#_prepareVision already applies to
 * visionGrant - see its own doc comment for why grants are picked rather than stacked.
 *
 * Unlike visionGrant, this is NOT suppressed while Asleep/Unconscious: that suppression exists so
 * an unconscious actor doesn't keep benefiting from equipped goggles, and it is enforced by
 * applying the real Blinded status - which is precisely the state this sense is defined to work
 * in. Suppressing it here would cancel the one Perk it implements.
 * @param {Actor} actor
 * @returns {Number}
 */
export function getBlindsightRange(actor) {
  let best = 0;
  for (const item of actor?.items ?? []) {
    const grant = item.system?.blindsight;
    if (!grant?.enabled) {
      continue;
    }

    if (item.type == 'gear' && !item.system.equipped) {
      continue;
    }

    best = Math.max(best, grant.range || 0);
  }

  return best;
}

/**
 * The detectionModes array to write onto a token, preserving any entry the GM or another module
 * put there and replacing only this system's own.
 * @param {Array<Object>} existing   The token's current detectionModes.
 * @param {Number} range
 * @returns {Array<Object>}
 */
export function buildDetectionModes(existing, range) {
  const others = (existing ?? []).filter(mode => mode.id != BLINDSIGHT_DETECTION_MODE_ID);
  if (range <= 0) {
    return others;
  }

  return [...others, { id: BLINDSIGHT_DETECTION_MODE_ID, enabled: true, range }];
}
