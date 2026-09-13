/**
 * Protected Target (GI Joe CRB, Bodyguard Focus, 1st level, p.110): "Once per combat, before
 * rolling Initiative, you may designate one character to be your protected target. The target
 * gains +1 Temporary Health from your protection and other benefits as you level up in this
 * Focus." "Other benefits as you level up" are this Focus's own later Perks (Protector's Shield's
 * crit immunity, Defender's Oath's Defeat prevention), which read getProtectedTargetUuid()
 * directly rather than duplicating this flag.
 *
 * A sheet "Use" button (same "mark whichever token is currently targeted" idiom as Mark Target),
 * gated once per encounter via hasUsedThisEncounter/markUsedThisEncounter - "before rolling
 * Initiative" is approximated the same way every other "at the start of an encounter" trigger in
 * this project already is (no hook fires specifically before Initiative, only the general
 * once-per-encounter gate). Re-designating a different target mid-encounter (should the GM allow
 * it) correctly moves the +1 Temporary Health from the old target to the new one, rather than
 * letting it silently accumulate on whoever was marked first - system.health.bonus is a plain
 * additive delta pool (the same "each source owns and reverses its own fixed delta" idiom Boosted
 * Vigor's own Temporary Health grant already establishes), so this only ever adds/removes the
 * exact 1 point it granted.
 */
import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

const PROTECTED_TARGET_FLAG = 'protectedTargetUuid';
const PROTECTED_TARGET_ENCOUNTER_FLAG = 'protectedTargetUsedThisEncounter';
const PROTECTED_TARGET_HEALTH_BONUS = 1;

/**
 * The uuid of the actor's own current protected target, if any.
 * @param {Actor} actor
 * @returns {String|undefined}
 */
export function getProtectedTargetUuid(actor) {
  return actor.getFlag?.('essence20', PROTECTED_TARGET_FLAG);
}

/**
 * Whether the given target is the actor's own current protected target.
 * @param {Actor} actor
 * @param {Actor} target
 * @returns {Boolean}
 */
export function isProtectedTarget(actor, target) {
  const protectedUuid = getProtectedTargetUuid(actor);
  return !!protectedUuid && !!target?.uuid && protectedUuid == target.uuid;
}

/**
 * Whether the actor can still designate a protected target this encounter.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canDesignateProtectedTarget(actor) {
  return !hasUsedThisEncounter(actor, PROTECTED_TARGET_ENCOUNTER_FLAG);
}

/**
 * Designates the actor's currently-targeted token as their protected target for the encounter,
 * granting +1 Temporary Health (and removing it from whoever was previously designated, if
 * anyone).
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   False (and nothing changed) if nothing is targeted.
 */
export async function designateProtectedTarget(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.MarkTargetNoTarget'));
    return false;
  }

  const previousUuid = getProtectedTargetUuid(actor);
  if (previousUuid && previousUuid != targetActor.uuid) {
    const previousTarget = await fromUuid(previousUuid);
    if (previousTarget) {
      await previousTarget.update({
        'system.health.bonus': Math.max(0, (previousTarget.system.health.bonus || 0) - PROTECTED_TARGET_HEALTH_BONUS),
      });
    }
  }

  await actor.setFlag('essence20', PROTECTED_TARGET_FLAG, targetActor.uuid);
  await markUsedThisEncounter(actor, PROTECTED_TARGET_ENCOUNTER_FLAG);

  if (previousUuid != targetActor.uuid) {
    await targetActor.update({
      'system.health.bonus': (targetActor.system.health.bonus || 0) + PROTECTED_TARGET_HEALTH_BONUS,
    });
  }

  return true;
}
