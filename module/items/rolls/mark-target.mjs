import { getUses } from "../../mechanics/resources/scene-clock.mjs";
import { isExpired } from "../../rules/expiry.mjs";

/**
 * Mark Target (Scout, 2nd level, p.84): "At the beginning of a scene (including Combat), designate a creature you see or a
 * specific individual you expect will be in the scene. You gain +1 on Skill Tests related to that creature until the end
 * of the scene."
 *
 * The designation is a Use rule on the Perk (rules/conv15-banked.test.js): a per-setter `markTarget` mark on the targeted
 * creature until the scene ends, kept on the newest one only - or, with Additional Marks (Transformers CRB, Scout, 14th
 * level, p.85: "up to five Mark Targets active at a time instead of one"), the newest five. This file is the reader the
 * roll pipeline (dice.mjs), On My Mark (mechanics/combat/target-riders.mjs) and `check:markTarget` ask.
 */

// Mark Everybot (Transformers CRB, Scout, 18th level, p.85): "once per day, you can use Mark Target on every creature in a
// scene, even those who enter the scene later." Its Use is a rule too - a markWindow on this flag; while the window is
// live, every creature counts as marked.
const MARK_EVERYBOT_ENCOUNTER_FLAG = 'markEverybotUsedThisEncounter';

/**
 * Whether the given target is one of the actor's own current Mark Target designees - or, with Mark Everybot active, ANY
 * target at all.
 * @param {Actor} actor
 * @param {Actor} target
 * @returns {Boolean}
 */
export function checkMarkTarget(actor, target) {
  if (!target?.uuid) {
    return false;
  }

  if (getUses(actor, MARK_EVERYBOT_ENCOUNTER_FLAG, 'encounter') > 0) {
    return true;
  }

  const mark = actor?.id ? target.flags?.essence20?.ruleMarks?.[`markTarget--${actor.id}`] : null;
  return !!mark && mark.by == actor.uuid && !isExpired(mark);
}
