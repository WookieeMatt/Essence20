/**
 * Team-wide Grid Science/Grid Tech choices and the Graphite Ranger capstone: Instructor's legacy students
 * (Beneath the Helmet, Aqua Ranger, p.41-42) and Graphite Ranger Prime (Beneath the Helmet, p.48). Primal Rage,
 * Bend Physics, Instructor and Aim Apparatus (PR CRB, p.38) are their items' own rules.
 */
import { registerDerived } from "../../mechanics/item-hooks.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";
import { applyDerivedHookMovement } from "../../rules/plugins/effects/derived-hook-movement.mjs";
import {
  PR2, itemsOf, sourceOf,
} from "../shared/ranger-leftover-item-ids.mjs";

/* -------------------------------------------- */
/*  Movement rules at this place                 */
/* -------------------------------------------- */

// Movement rules at stage derivedHook apply here among the derived hooks - before the rules' own DerivedStats (Beneath
// the Helmet's Bend Physics doubling, the Unique Weapon (Two-Handed Melee)'s -10 ft; Beast Morpher's Cheetah +20 is not
// doubled). (A teammate prepared before the world loaded is prepared again once it has - rules/plugins/zords/zord-timing-hooks.mjs.)
registerDerived(applyDerivedHookMovement);

/* -------------------------------------------- */
/*  Instructor                                   */
/* -------------------------------------------- */

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
