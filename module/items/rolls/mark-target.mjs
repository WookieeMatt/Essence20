import { getUses } from "../../mechanics/resources/scene-clock.mjs";
import { isExpired } from "../../rules/expiry.mjs";

/**
 * Mark Target (Scout, 2nd level, p.84): at a scene's start, name a creature in view or expected there; +1 on Skill
 * Tests about it until the scene ends.
 *
 * The designation is a Use rule on the Perk (rules/conv15-banked.test.js): a per-setter `markTarget` mark on the targeted
 * creature until the scene ends, kept on the newest one only - or, with Additional Marks (Transformers CRB, Scout, 14th
 * level, p.85: five marks at once instead of one), the newest five. This file is the reader the
 * roll pipeline (dice.mjs), On My Mark (mechanics/combat/target-riders.mjs) and `check:markTarget` ask.
 */

// Mark Everybot (Transformers CRB, Scout, 18th level, p.85): once a day, Mark Target covers every creature in the scene,
// latecomers included. Its Use is a rule too - a markWindow on this flag; while the window is
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
