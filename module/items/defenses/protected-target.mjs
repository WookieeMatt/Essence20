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
// Named by the Perk's own Use rule (an updateActor on this flag, once per encounter, moving the +1 Temporary Health).
const PROTECTED_TARGET_FLAG = 'protectedTargetUuid';

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
