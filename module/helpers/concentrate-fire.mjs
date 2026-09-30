import { epochFor, isActiveForWindow } from "./scene-clock.mjs";

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
 * already establish, just flipped (a buff for attackers rather than a debuff on the target).
 *
 * How long it lasts: the designation is a once-per-encounter call, so the mark is a scene-clock
 * encounter-window record (helpers/scene-clock.mjs) and ends by itself with the encounter (a
 * combat ending, or the GM starting a new scene). Designating a new target also clears the
 * designator's previous one, which the designator remembers in CONCENTRATE_FIRE_BY_FLAG. (The mark
 * used to be a bare `true` that nothing ever cleared - a marked enemy gave every attacker ↑2
 * forever. Such old marks carry no epoch, so they now read as expired.)
 *
 * The once-per-encounter gate and the Story Point spend are handled by banked-buffs.mjs's own
 * dispatch; this file covers marking the target and reading the mark back.
 */

const CONCENTRATE_FIRE_FLAG = 'concentrateFireTargetMark';
const CONCENTRATE_FIRE_BY_FLAG = 'concentrateFireDesignee';

/**
 * Marks the actor's currently-targeted token as the Concentrate Fire designee for the rest of
 * the encounter, clearing the actor's own previous designee first.
 * @param {Actor} actor   The one designating.
 * @returns {Promise<Boolean>}   False (and no flag set) if nothing is targeted.
 */
export async function markConcentrateFireTarget(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.ConcentrateFireNoTarget'));
    return false;
  }

  const previousUuid = actor?.getFlag?.('essence20', CONCENTRATE_FIRE_BY_FLAG);
  if (previousUuid && previousUuid != targetActor.uuid && typeof fromUuid == 'function') {
    const previous = await fromUuid(previousUuid);
    if (previous?.getFlag?.('essence20', CONCENTRATE_FIRE_FLAG)) {
      await previous.unsetFlag('essence20', CONCENTRATE_FIRE_FLAG);
    }
  }

  await targetActor.setFlag('essence20', CONCENTRATE_FIRE_FLAG, {
    epoch: epochFor('encounter'), window: 'encounter', count: 1, by: actor?.uuid ?? null,
  });
  if (actor?.setFlag && targetActor.uuid) {
    await actor.setFlag('essence20', CONCENTRATE_FIRE_BY_FLAG, targetActor.uuid);
  }

  return true;
}

/**
 * Whether the given target currently carries a Concentrate Fire mark from this encounter.
 * @param {Actor} target
 * @returns {Boolean}
 */
export function isConcentrateFireTarget(target) {
  return !!target?.getFlag && isActiveForWindow(target, CONCENTRATE_FIRE_FLAG, 'encounter');
}
