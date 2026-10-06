// Whatever We Need (Power Rangers CRB, Black Ranger, 2nd level, p.33): "by expending one of your
// Quips & Speeches per long rest and asking the non-player character in question for a favor,
// you can gain Edge on all Alertness, Deception, and Persuasion Skill Tests targeting them for 5
// minutes." A self-Edge scoped to one specific other actor (the same shape Menacing Glare's own
// Edge effect already established) AND scoped to 3 named skills (like Get To Know's own dual
// scoping), but marked via the "designate whichever token is currently targeted" idiom Mark
// Target already established, rather than banked off a roll. "5 minutes" is approximated as "the
// next matching roll," this project's usual duration idiom.

const WHATEVER_WE_NEED_FLAG = 'pendingWhateverWeNeedEdge';

/**
 * Marks the actor's currently-targeted token as the Whatever We Need favor's subject.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   False (and no flag set) if nothing is targeted.
 */
export async function markWhateverWeNeed(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.MarkTargetNoTarget'));
    return false;
  }

  await actor.setFlag('essence20', WHATEVER_WE_NEED_FLAG, targetActor.id);
  return true;
}

const WHATEVER_WE_NEED_SKILLS = ['alertness', 'deception', 'persuasion'];

/**
 * Whether the actor currently holds Edge against the given target via Whatever We Need, for the
 * rolled Skill.
 * @param {Actor} actor
 * @param {Actor} target
 * @param {String} rolledSkill
 * @returns {Boolean}
 */
export function checkWhateverWeNeed(actor, target, rolledSkill) {
  if (!WHATEVER_WE_NEED_SKILLS.includes(rolledSkill)) {
    return false;
  }

  const markedId = actor.getFlag?.('essence20', WHATEVER_WE_NEED_FLAG);
  return !!markedId && !!target?.id && markedId == target.id;
}
