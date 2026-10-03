/**
 * Team-wide Grid Science/Grid Tech choices and the Graphite Ranger capstone:
 * Bend Physics, Primal Rage, Instructor (Beneath the Helmet, Aqua Ranger, p.41-42), Aim Apparatus
 * (PR CRB, Blue Ranger Grid Tech, p.38) and Graphite Ranger Prime (Beneath the Helmet, p.48).
 */
import {
  registerDefenseAdjust, registerDerived, registerRollSources, registerUse,
} from "../../extensions.mjs";
import { worldActors } from "../../companion-link.mjs";
import {
  PR2, T, holds, isRangedAttack, itemsOf, parentOf, sourceOf, teamHolds,
} from "./common.mjs";
import { postLine, writeActor } from "../zord1/common.mjs";

/* -------------------------------------------- */
/*  Bend Physics                                 */
/* -------------------------------------------- */

// Bend Physics (p.42): "While morphed, you and your Power Ranger team can double your Movement and
// gain a +2 Evasion against ranged attacks." Read per member - each member's own Morphed state.
export function bendPhysicsDerived(actor) {
  if (!actor?.system?.isMorphed || !teamHolds(actor, PR2.bendPhysics)) {
    return;
  }

  for (const movement of Object.values(actor.system.movement ?? {})) {
    if (movement && Number.isFinite(movement.total)) {
      movement.total *= 2;
    }
  }
}

export function bendPhysicsDefense(attacker, defender, defenseType, ctx = {}) {
  if (defenseType != 'evasion' || !isRangedAttack(ctx.item) || !defender?.system?.isMorphed) {
    return 0;
  }

  return teamHolds(defender, PR2.bendPhysics) ? 2 : 0;
}

registerDerived(bendPhysicsDerived);
registerDefenseAdjust(bendPhysicsDefense);

// A teammate's Movement is prepared before the whole world has loaded, so the team scan can miss
// the Aqua Ranger on first load - prepare the team again once everyone exists.
globalThis.Hooks?.once?.('ready', () => {
  const team = worldActors().filter(a => a?.type == 'playerCharacter');
  if (team.some(a => holds(a, PR2.bendPhysics))) {
    for (const member of team) {
      member.reset?.();
    }
  }
});

/* -------------------------------------------- */
/*  Primal Rage                                  */
/* -------------------------------------------- */

// Primal Rage (p.42): "You and your Power Ranger team gain ↑1 on unarmed Attacks." Unarmed is an
// attack with no parent weapon, or the Unarmed Combat weapon itself (a real item in this system).
export function isUnarmedAttack(actor, item) {
  if (item?.type != 'weaponEffect') {
    return false;
  }

  const weapon = parentOf(actor, item);
  return !weapon || /unarmed/i.test(weapon.name ?? '') || /unarmed/i.test(item.name ?? '');
}

export function primalRageSources(actor, target, ctx = {}) {
  if (!ctx.isAttack || !isUnarmedAttack(actor, ctx.item) || !teamHolds(actor, PR2.primalRage)) {
    return null;
  }

  return { sources: [{ id: 'pr2-primalRage', label: T('Pr2PrimalRage'), shiftUp: 1 }] };
}

registerRollSources(primalRageSources);

/* -------------------------------------------- */
/*  Instructor                                   */
/* -------------------------------------------- */

// Instructor (p.41): "Choose one Smarts Skill in which you have a specialty. You may teach that
// Skill to another Ranger. They may roll that Skill without a Snag if they have no Ranks in the
// Skill. You gain ↑1 on any Skill Test you make with this Skill, but your Skill Tests may only
// benefit from the Instructor bonus once, no matter how many times you teach this Skill."
export const INSTRUCTOR_FLAG = 'pr2Instructor';

const instructorOf = actor => itemsOf(actor).find(i => sourceOf(i) == PR2.instructor && i.flags?.essence20?.[INSTRUCTOR_FLAG]?.skill) ?? null;

export function instructorSources(actor, target, ctx = {}) {
  const skill = instructorOf(actor)?.flags?.essence20?.[INSTRUCTOR_FLAG]?.skill;
  if (!skill || ctx.rolledSkill != skill) {
    return null;
  }

  return { sources: [{ id: 'pr2-instructor', label: T('Pr2Instructor'), shiftUp: 1 }] };
}

registerRollSources(instructorSources);

/**
 * Whether a taught student skips the untrained Snag on this Skill (patched into
 * helpers/roll-dialog.mjs#_isUntrainedSnag, which only asks once the shift is still untrained).
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

function smartsSkills(actor) {
  const toEssence = globalThis.CONFIG?.E20?.skillToEssence ?? {};
  const all = Object.keys(toEssence).filter(skill => toEssence[skill] == 'smarts');
  const specialized = all.filter(skill => Object.keys(actor?.system?.skills?.[skill]?.specializations ?? {}).length);
  return specialized.length ? specialized : all;
}

export async function chooseInstructorSkill(item) {
  const actor = item.parent;
  const { chooseSelect } = await import("../../grants.mjs");
  const skills = globalThis.CONFIG?.E20?.skills ?? {};
  const skill = await chooseSelect(item.name, T('Pr2InstructorPickSkill'),
    smartsSkills(actor).map(value => ({ value, label: game.i18n.localize(skills[value] ?? value) })));
  if (!skill) {
    return null;
  }

  await item.setFlag('essence20', INSTRUCTOR_FLAG, { skill, students: item.flags?.essence20?.[INSTRUCTOR_FLAG]?.students ?? [] });
  return skill;
}

registerUse({
  id: 'pr2Instructor',
  matches: item => sourceOf(item) == PR2.instructor,
  run: async item => {
    const actor = item.parent;
    let skill = item.flags?.essence20?.[INSTRUCTOR_FLAG]?.skill;
    if (!skill) {
      skill = await chooseInstructorSkill(item);
      if (!skill) {
        return null;
      }
    }

    const { chooseSelect } = await import("../../grants.mjs");
    const students = item.flags?.essence20?.[INSTRUCTOR_FLAG]?.students ?? [];
    const options = worldActors()
      .filter(a => a?.type == 'playerCharacter' && a.id != actor.id && !students.includes(a.uuid))
      .map(a => ({ value: a.uuid, label: a.name }));
    const uuid = await chooseSelect(item.name, T('Pr2InstructorPickStudent'), options);
    if (!uuid) {
      return null;
    }

    await item.setFlag('essence20', INSTRUCTOR_FLAG, { skill, students: [...students, uuid] });
    const student = worldActors().find(a => a.uuid == uuid);
    const skills = globalThis.CONFIG?.E20?.skills ?? {};
    return T('Pr2InstructorTaught', { name: actor.name, student: student?.name ?? '', skill: game.i18n.localize(skills[skill] ?? skill) });
  },
});

/* -------------------------------------------- */
/*  Aim Apparatus                                */
/* -------------------------------------------- */

// Aim Apparatus (PR CRB, Grid Tech, p.38): "One member of your Power Ranger team gains a level in
// the Targeting skill. This Grid Tech may be chosen multiple times, once per team member." Picked
// once when the Grid Tech is taken, the same build-time self-or-teammate picker Wind Whispers uses;
// the Targeting shift steps up one rank (never past d12) on whoever is chosen, and steps back down
// if the Grid Tech is removed.
export const AIM_FLAG = 'pr2AimApparatusTarget';

export function stepShift(shift, steps) {
  const list = globalThis.CONFIG?.E20?.skillShiftList ?? [];
  const from = list.indexOf(shift ?? 'd20');
  if (from < 0) {
    return shift;
  }

  const best = list.indexOf('d12');
  const worst = list.indexOf('d20');
  return list[Math.min(worst, Math.max(best, from - steps))];
}

async function stepTargeting(target, steps) {
  const shift = target?.system?.skills?.targeting?.shift;
  const next = stepShift(shift, steps);
  if (next && next != shift) {
    await writeActor(target, 'update', [{ 'system.skills.targeting.shift': next }]);
  }
}

export async function grantAimApparatus(item) {
  const actor = item.parent;
  const { pickSelfOrTeamMember } = await import("../../team-member-picker.mjs");
  const target = await pickSelfOrTeamMember(actor, item.name);
  if (!target) {
    return;
  }

  await stepTargeting(target, 1);
  await item.setFlag('essence20', AIM_FLAG, target.uuid);
  await postLine(actor, T('Pr2AimApparatusGranted', { name: actor.name, target: target.name }));
}

/* -------------------------------------------- */
/*  Drop / remove hooks                          */
/* -------------------------------------------- */

export async function onTeamItemCreated(item, options, userId) {
  if (userId != globalThis.game?.user?.id || item?.parent?.documentName != 'Actor') {
    return;
  }

  const source = sourceOf(item);
  if (source == PR2.instructor && !item.flags?.essence20?.[INSTRUCTOR_FLAG]?.skill) {
    await chooseInstructorSkill(item);
  } else if (source == PR2.aimApparatus && !item.flags?.essence20?.[AIM_FLAG]) {
    await grantAimApparatus(item);
  }
}

export async function onTeamItemDeleted(item, options, userId) {
  if (userId != globalThis.game?.user?.id || sourceOf(item) != PR2.aimApparatus) {
    return;
  }

  const uuid = item.flags?.essence20?.[AIM_FLAG];
  const target = uuid ? worldActors().find(a => a.uuid == uuid) : null;
  if (target) {
    await stepTargeting(target, -1);
  }
}

globalThis.Hooks?.on?.('createItem', (...args) => onTeamItemCreated(...args).catch(error => console.error('Essence20 | pr2', error)));
globalThis.Hooks?.on?.('deleteItem', (...args) => onTeamItemDeleted(...args).catch(error => console.error('Essence20 | pr2', error)));
