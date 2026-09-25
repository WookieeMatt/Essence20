import { actorHasPerk, hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

/**
 * Mark Target (Scout, 2nd level, p.84): "At the beginning of a scene (including Combat),
 * designate a creature you see or a specific individual you expect will be in the scene. You gain
 * +1 on Skill Tests related to that creature until the end of the scene."
 *
 * No roll involved - "designate" is a plain declaration - so this is a sheet "Use" button
 * (wired the same way as banked-buffs.mjs's own controls) that marks whichever token is currently
 * targeted, rather than a dialog. Only one creature can be marked at a time here (Additional
 * Marks, which lets higher-level Scouts mark several individual creatures at once, isn't built -
 * a single-target flag has nothing to extend into a list without a real redesign).
 */

const MARK_TARGET_FLAG = 'markedTargetUuid';

// Mark Everybot (Transformers CRB, Scout, 18th level, p.85): "once per day, you can use Mark
// Target on every creature in a scene, even those who enter the scene later." Unlike Additional
// Marks above, this doesn't need the single-target flag's own list redesign - "every creature,
// including ones not here yet" is a scene-wide toggle, not a set of specific targets, so it's a
// second, independent boolean flag OR'd into checkMarkTarget below. "Once per day" approximated
// as "once per scene" (this project's own standard idiom, see helpers/trade-school.mjs's own doc
// comment); reusing the SAME flag for both the once-per-day gate AND "is it currently active"
// works because the two windows are identical here - RAW's own "until the end of the scene"
// duration (inherited from Mark Target itself) is exactly the scene-clock encounter window
// markUsedThisEncounter already stamps.
const MARK_EVERYBOT_ENCOUNTER_FLAG = 'markEverybotUsedThisEncounter';

// Additional Marks (Transformers CRB, Scout, 14th level, p.85): "You can have up to five Mark
// Targets active at a time instead of one." Rather than redesign MARK_TARGET_FLAG itself (which
// every other Scout without this Perk still relies on being a single uuid), Additional Marks gets
// its own list flag that markTarget appends to instead of overwriting when the Perk is held, and
// checkMarkTarget OR's membership in that list into its normal single-target check.
const ADDITIONAL_MARKS_ID = "Compendium.essence20.tf_crb.Item.sapOdu2VHIJLeZdE";
const ADDITIONAL_MARKS_LIMIT = 5;
const ADDITIONAL_MARKS_FLAG = 'additionalMarkedTargetUuids';

/**
 * Marks the actor's currently-targeted token as their Mark Target designee. With Additional Marks
 * held, this instead adds the target to a list of up to ADDITIONAL_MARKS_LIMIT designees (the
 * oldest is dropped once the list is full) rather than replacing the single designee.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   False (and no flag set) if nothing is targeted.
 */
export async function markTarget(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.MarkTargetNoTarget'));
    return false;
  }

  if (actorHasPerk(actor, ADDITIONAL_MARKS_ID)) {
    const existing = (actor.getFlag?.('essence20', ADDITIONAL_MARKS_FLAG) ?? [])
      .filter((uuid) => uuid != targetActor.uuid);
    existing.push(targetActor.uuid);
    while (existing.length > ADDITIONAL_MARKS_LIMIT) {
      existing.shift();
    }

    await actor.setFlag('essence20', ADDITIONAL_MARKS_FLAG, existing);
    return true;
  }

  await actor.setFlag('essence20', MARK_TARGET_FLAG, targetActor.uuid);
  return true;
}

/**
 * Whether the given target is the actor's own current Mark Target designee (or one of their
 * Additional Marks designees) - or, with Mark Everybot active, ANY target at all (see
 * MARK_EVERYBOT_ENCOUNTER_FLAG's own comment above).
 * @param {Actor} actor
 * @param {Actor} target
 * @returns {Boolean}
 */
export function checkMarkTarget(actor, target) {
  if (!target?.uuid) {
    return false;
  }

  if (hasUsedThisEncounter(actor, MARK_EVERYBOT_ENCOUNTER_FLAG)) {
    return true;
  }

  const markedUuid = actor.getFlag?.('essence20', MARK_TARGET_FLAG);
  if (!!markedUuid && markedUuid == target.uuid) {
    return true;
  }

  const additionalMarks = actor.getFlag?.('essence20', ADDITIONAL_MARKS_FLAG);
  return Array.isArray(additionalMarks) && additionalMarks.includes(target.uuid);
}

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseMarkEverybot(actor) {
  return !hasUsedThisEncounter(actor, MARK_EVERYBOT_ENCOUNTER_FLAG);
}

/**
 * Activates Mark Everybot for the rest of the scene - see MARK_EVERYBOT_ENCOUNTER_FLAG's own
 * comment above.
 * @param {Actor} actor
 */
export async function activateMarkEverybot(actor) {
  await markUsedThisEncounter(actor, MARK_EVERYBOT_ENCOUNTER_FLAG);
}
