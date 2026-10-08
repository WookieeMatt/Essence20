/**
 * Instructor's legacy students (Beneath the Helmet, Aqua Ranger, p.41-42): the one reader left for students taught
 * before the rules version. (Primal Rage, Bend Physics, Instructor and Aim Apparatus (PR CRB, p.38) are their items'
 * own rules. Movement rules at stage derivedHook are registered by rules/plugins/effects/derived-hook-movement.mjs.)
 */
import { worldActors } from "../../mechanics/companions/companion-link.mjs";
import { PR2 } from "../shared/ranger-leftover-item-ids.mjs";
import { itemsOfAny as itemsOf, sourceOf } from "../shared/item-lookups.mjs";

// Instructor (p.41) is the Perk's own rules now: the Smarts Skill pick (an `added` Trigger, and the
// Use if it was skipped - legacy: the old flag's skill), the ↑1 on it, the Use that marks a picked
// teammate, and a team-scoped RollModifier lifting the untrained Snag for a marked student.
//
// Only a legacy reader stays: students taught before the rules version are listed in the old flag
// (flags.essence20.pr2Instructor.students), which no pick can carry over, so they keep their lift here.
export const INSTRUCTOR_FLAG = 'pr2Instructor';

/**
 * Whether a student taught before the rules version skips the untrained Snag on this Skill (patched
 * into mechanics/rolls/roll-dialog.mjs#_isUntrainedSnag, which only asks once the shift is still untrained).
 */
export function pr2NoUntrainedSnag(actor, skill) {
  if (!actor?.uuid || !skill) {
    return false;
  }

  return worldActors().some(teacher => itemsOf(teacher).some(item => {
    const data = sourceOf(item) == PR2.instructor ? item.flags?.essence20?.[INSTRUCTOR_FLAG] : null;
    return data?.skill == skill && (data.students ?? []).includes(actor.uuid);
  }));
}
