/**
 * Known Accomplices (Decepticon Directive, Tracker Focus, 6th level, p.55/56): "One way to a
 * target is through their allies. Upon reaching 6th level, you are skilled at tracking down your
 * Primary Target through the actions and activities of those around them. You can spend an Energon
 * Point to gain [up 1] on Skill Tests to track and find a single known ally of your Primary Quarry
 * for one scene."
 *
 * Same "plain designation flag, applied as a per-target shiftUp in dice.mjs" shape as
 * helpers/primary-quarry.mjs's own PRIMARY_QUARRY_FLAG - "an ally of your Primary Quarry" isn't
 * itself verified (this codebase has no relationship-graph data to check "is this creature a known
 * ally of that one" against), so designating a Known Accomplice is self-policed the same way
 * Primary Quarry's own "spending 1 hour" cost already is - the Energon Point is the one part of
 * this Perk that IS actually enforced. "For one scene" is approximated the same "lasts until
 * re-designated" way Primary Quarry's own "unenforced duration gap" already is, since this
 * codebase's own scene-clock (helpers/scene-clock.mjs) tracks USAGE windows, not standing
 * designations like this one.
 */

const KNOWN_ACCOMPLICES_FLAG = 'knownAccompliceUuid';

/**
 * Spends 1 Energon Point and designates the actor's currently-targeted token as their Known
 * Accomplice - called once the "Use" button's own affordability check has already passed.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   False (Energon unspent, no flag set) if nothing is targeted.
 */
export async function designateKnownAccomplice(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.KnownAccomplicesNoTarget'));
    return false;
  }

  await actor.update({ 'system.energon.normal.value': actor.system.energon.normal.value - 1 });
  await actor.setFlag('essence20', KNOWN_ACCOMPLICES_FLAG, targetActor.uuid);
  return true;
}

/**
 * Whether the given target is the actor's currently-designated Known Accomplice.
 * @param {Actor} actor
 * @param {Actor} target
 * @returns {Boolean}
 */
export function checkKnownAccomplice(actor, target) {
  return !!target?.uuid && actor?.getFlag?.('essence20', KNOWN_ACCOMPLICES_FLAG) == target.uuid;
}
