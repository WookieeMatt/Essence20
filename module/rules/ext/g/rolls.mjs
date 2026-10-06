import { recipients, registerStep, runSteps } from "../../steps.mjs";
import { escape, T } from "./common.mjs";

/**
 * rollVsAll {skill, defense, to?, onSuccess?, onFail?, cancelFails?} (round 11, group G) - ONE ordinary Skill Test
 * (the Skill's own shifts and Specialization, no DIF - as a roll from the sheet), its total compared with each
 * recipient's (default: the targets) Defense - a list: the best of them ("the higher of their Willpower or
 * Cleverness"). It succeeds only when it meets every one; the branch runs with the recipients as the targets (on a
 * success, all of them). @var.rollTotal, @var.beaten (how many it met). No recipients - a chat line, stop. A cancelled
 * roll stops the run, or (cancelFails) takes the onFail branch.
 */

const DEFENSES = ['toughness', 'evasion', 'willpower', 'cleverness'];

/** The roll itself (replaced in tests): the total of an ordinary Skill Test, or null when it didn't happen. */
export const rolls = {
  async total(actor, skill) {
    const essence = globalThis.CONFIG?.E20?.skillToEssence?.[skill] ?? 'smarts';
    const fields = actor?.system?.skills?.[skill] ?? {};
    const result = await actor?._dice?.rollSkill?.({
      rollType: 'skill', skill, essence: essence == 'any' ? 'smarts' : essence, shift: fields.shift,
      shiftUp: fields.shiftUp ?? 0, shiftDown: fields.shiftDown ?? 0, isSpecialized: fields.isSpecialized,
    }, actor);
    if (!result || result.cancelled) {
      return null;
    }

    const outcome = result.outcomes?.[0];
    const total = outcome?.roll?.total ?? outcome?.total ?? result.total ?? null;
    return total === null || total === undefined ? null : Number(total);
  },
};

/** A creature's best of the listed Defenses. */
export function bestDefense(actor, defenses) {
  return Math.max(...[defenses].flat().map(key => Number(actor?.system?.defenses?.[key]?.total) || 0));
}

registerStep('rollVsAll', async (step, ctx) => {
  const others = recipients({ ...step, to: step.to ?? 'targets' }, ctx);
  if (!others.length) {
    ctx.chat.push(escape(T('NeedsTarget', { item: ctx.item?.name ?? '' })));
    return false;
  }

  const total = await rolls.total(ctx.actor, step.skill);
  if (total === null && !step.cancelFails) {
    return false;
  }

  const beaten = total === null ? [] : others.filter(other => total >= bestDefense(other, step.defense));
  ctx.vars.rollTotal = total ?? 0;
  ctx.vars.beaten = beaten.length;
  const success = beaten.length == others.length;
  const branch = success ? step.onSuccess : step.onFail;
  if (!Array.isArray(branch)) {
    return;
  }

  const saved = ctx.targets;
  ctx.targets = others;
  const finished = await runSteps(branch, ctx);
  ctx.targets = saved;
  return finished === false ? false : undefined;
}, {
  errors: (step, where) => [
    ...(step.skill ? [] : [`${where}: rollVsAll needs a skill`]),
    ...([step.defense ?? []].flat().length && [step.defense].flat().every(key => DEFENSES.includes(key)) ? [] : [`${where}: rollVsAll's defense must be ${DEFENSES.join(', ')} or a list of them`]),
  ],
});
