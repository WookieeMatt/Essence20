/**
 * Concentrate Fire (GI Joe CRB, Vanguard base, 15th level, p.109): "you can direct your allies to
 * concentrate fire once per encounter. On your turn, spend a Story Point and designate a target
 * as a Free action. You and each ally who attacks that target gain an upshift 2 to their attack
 * roll."
 *
 * Unlike Mark Target's own actor-owned flag (only the marker themselves benefits from it - see
 * mark-target.mjs's own doc comment), this needs to be readable by ANY attacker, not just whoever
 * called it - so the mark lives on the TARGET's own actor instead, the same "state stored on
 * whoever it's read back against" shape Splinter Defense/Watchful Eyes' own per-target flags
 * already establish, just flipped (a buff for attackers rather than a debuff on the target). RAW
 * states no explicit duration - lasts until a new target is designated, the same "no scene
 * boundary to expire it against" idiom Mark Target itself already accepts. The once-per-encounter
 * gate and the Story Point spend are handled by banked-buffs.mjs's own dispatch (same
 * isGmConnected()/hasStoryPointsAvailable() shape Bait and Switch already establishes); this file
 * covers marking the target and reading the mark back.
 */

const CONCENTRATE_FIRE_FLAG = 'concentrateFireTargetMark';

/**
 * Marks the actor's currently-targeted token as the Concentrate Fire designee.
 * @param {Actor} _actor   Unused - kept only for a consistent onPerkUse dispatch signature.
 * @returns {Promise<Boolean>}   False (and no flag set) if nothing is targeted.
 */
export async function markConcentrateFireTarget(_actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.ConcentrateFireNoTarget'));
    return false;
  }

  await targetActor.setFlag('essence20', CONCENTRATE_FIRE_FLAG, true);
  return true;
}

/**
 * Whether the given target currently carries a Concentrate Fire mark.
 * @param {Actor} target
 * @returns {Boolean}
 */
export function isConcentrateFireTarget(target) {
  return !!target?.getFlag?.('essence20', CONCENTRATE_FIRE_FLAG);
}
