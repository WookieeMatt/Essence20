/**
 * Mark Target (Scout, 2nd level, p.84): "At the beginning of a scene (including Combat),
 * designate a creature you see or a specific individual you expect will be in the scene. You gain
 * +1 on Skill Tests related to that creature until the end of the scene."
 *
 * No roll involved - "designate" is a plain declaration - so this is a sheet "Use" button
 * (wired the same way as banked-buffs.mjs's own controls) that marks whichever token is currently
 * targeted, rather than a dialog. Only one creature can be marked at a time here (Additional
 * Marks/Mark Everybot, which let higher-level Scouts mark several at once, aren't built - a
 * single-target flag has nothing to extend into a list without a real redesign).
 */

const MARK_TARGET_FLAG = 'markedTargetUuid';

/**
 * Marks the actor's currently-targeted token as their Mark Target designee.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   False (and no flag set) if nothing is targeted.
 */
export async function markTarget(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.MarkTargetNoTarget'));
    return false;
  }

  await actor.setFlag('essence20', MARK_TARGET_FLAG, targetActor.uuid);
  return true;
}

/**
 * Whether the given target is the actor's own current Mark Target designee.
 * @param {Actor} actor
 * @param {Actor} target
 * @returns {Boolean}
 */
export function checkMarkTarget(actor, target) {
  const markedUuid = actor.getFlag?.('essence20', MARK_TARGET_FLAG);
  return !!markedUuid && !!target?.uuid && markedUuid == target.uuid;
}
