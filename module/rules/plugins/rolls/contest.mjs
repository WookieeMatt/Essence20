import { recipients, registerStep, runSteps } from "../../steps.mjs";
import { escape, T } from "../shared/chat-speaker-helpers.mjs";

/**
 * Contested rolls (round 10, group D).
 *
 * contest {skill | skills, edge?, plain?, against: {skill | skills}, to?, onWin?, onLose?}
 *   This actor's Skill against the recipient's own roll (`to` defaults to the first target); a tie goes to the one
 *   resisting. With `plain` both sides roll their best listed Skill die as plain dice (1d20 + the die) with no dialog;
 *   otherwise each makes an ordinary Skill Test (the roll dialog, Edge when `edge`). When this user can't roll for the
 *   other side, a card asks its owner to roll (the button runs the rest). onWin / onLose run with the other side as the
 *   target; @var.mine / @var.theirs hold the totals.
 *   Round 16 (part b - Try Me): `best: true` on a side (the step itself, or `against`) rolls that side's best listed Skill
 *   (by its die; a tie to the first listed) in the ordinary roll; `tieWins: true` gives a tie to this actor instead.
 */

const SHIFT_ORDER = ['d20', 'd2', 'd4', 'd6', 'd8', 'd10', 'd12', '2d8', '3d6'];

/** The best of the actor's listed Skills' dice. */
export function bestShift(actor, skills) {
  const order = globalThis.CONFIG?.E20?.skillShiftList ?? null;
  const shifts = skills.map(skill => actor?.system?.skills?.[skill]?.shift ?? 'd20');
  if (Array.isArray(order) && order.length) {
    return shifts.sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
  }

  return shifts.sort((a, b) => SHIFT_ORDER.indexOf(b) - SHIFT_ORDER.indexOf(a))[0];
}

/** The listed Skill with the best die (a tie goes to the first listed). */
export function bestSkill(actor, skills) {
  const order = globalThis.CONFIG?.E20?.skillShiftList ?? null;
  const rank = skill => {
    const shift = actor?.system?.skills?.[skill]?.shift ?? 'd20';
    return Array.isArray(order) && order.length ? -order.indexOf(shift) : SHIFT_ORDER.indexOf(shift);
  };

  return skills.reduce((best, skill) => (rank(skill) > rank(best) ? skill : best), skills[0]);
}

/** A Skill die as plain dice: the d20 plus the die ("d6" -> "1d20 + 1d6"); untrained is the d20 alone. */
export function plainFormula(shift) {
  const match = /^(\d*)d(\d+)$/.exec(String(shift ?? ''));
  return !match || shift == 'd20' ? '1d20' : `1d20 + ${match[1] || 1}d${match[2]}`;
}

const skillsOf = side => [side?.skills ?? side?.skill ?? []].flat().filter(Boolean);

/** One side's total. */
async function rollSide(actor, side, { plain = false, edge = false } = {}) {
  const skills = skillsOf(side);
  if (plain) {
    const roll = await new globalThis.Roll(plainFormula(bestShift(actor, skills))).evaluate();
    return Number(roll.total) || 0;
  }

  // best: the side's best listed Skill by its die (a tie to the first listed) - round 16, part b.
  const skill = side?.best ? bestSkill(actor, skills) : skills[0];
  const essence = globalThis.CONFIG?.E20?.skillToEssence?.[skill] ?? 'social';
  const result = await actor?._dice?.rollSkill?.({ skill, essence, shiftUp: 0, shiftDown: 0, ...(edge ? { edge: true } : {}) }, actor);
  if (!result || result.cancelled) {
    return null;
  }

  return Number(result?.outcomes?.[0]?.results?.[0]?.total ?? result?.total ?? 0);
}

/** Settle it: the result line, then the branch. */
async function settle(step, ctx, other, mine, theirs) {
  const won = mine > theirs || (!!step.tieWins && mine == theirs);
  ctx.vars.mine = mine;
  ctx.vars.theirs = theirs;
  ctx.chat.push(escape(T(won ? 'ContestWon' : 'ContestLost', { name: ctx.actor?.name ?? '', target: other.name, mine, theirs })));
  const saved = ctx.targets;
  ctx.targets = [other];
  const branch = won ? step.onWin : step.onLose;
  const finished = Array.isArray(branch) ? await runSteps(branch, ctx) : true;
  ctx.targets = saved;
  return finished;
}

registerStep('contest', async (step, ctx) => {
  const [other] = recipients({ ...step, to: step.to ?? 'target' }, ctx);
  if (!other) {
    ctx.chat.push(escape(T('ContestNeedsTarget', { item: ctx.item?.name ?? '' })));
    return false;
  }

  const mine = await rollSide(ctx.actor, step, { plain: !!step.plain, edge: !!step.edge });
  if (mine === null) {
    return false;
  }

  if (step.plain || other.isOwner) {
    const theirs = await rollSide(other, step.against, { plain: !!step.plain });
    if (theirs === null) {
      return false;
    }

    return (await settle(step, ctx, other, mine, theirs)) === false ? false : undefined;
  }

  // The other side's owner rolls from a card.
  ctx.vars.contestMine = mine;
  ctx.targets = [other];
  return runSteps([{
    do: 'button', who: 'targets', label: T('ContestRoll', { target: other.name }),
    intro: T('ContestAsk', { name: ctx.actor?.name ?? '', target: other.name, total: mine }),
    steps: [{ do: 'contestAnswer', against: step.against, onWin: step.onWin, onLose: step.onLose, ...(step.tieWins ? { tieWins: true } : {}) }],
  }], ctx);
}, {
  errors: (step, where) => [
    ...(skillsOf(step).length ? [] : [`${where}: contest needs a skill`]),
    ...(skillsOf(step.against).length ? [] : [`${where}: contest needs against.skill`]),
  ],
  branches: ['onWin', 'onLose'],
});

// contestAnswer: the other side's roll for a contest card (pressed by its owner); compares with @var.contestMine.
registerStep('contestAnswer', async (step, ctx) => {
  const other = ctx.targets[0];
  if (!other) {
    return false;
  }

  const theirs = await rollSide(other, step.against);
  if (theirs === null) {
    return false;
  }

  return (await settle(step, ctx, other, Number(ctx.vars.contestMine) || 0, theirs)) === false ? false : undefined;
}, { branches: ['onWin', 'onLose'] });
