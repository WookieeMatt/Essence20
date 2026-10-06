import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { registerRuleType, RULE_TYPES } from "../../types.mjs";

/**
 * Round 15 (dice part): the roll's Skill die as rules see it, and what can be done with it late in dice.mjs.
 *
 *   roll:baseDie:<die>          the die the roll starts from, before the dialog (ctx.baseShift - d2, d4...)
 *   roll:finalDie:<op><die>     the die the roll settled on (ctx.finalShift), compared by quality: `<=d4` is d4 or worse,
 *                               `>=d8` d8 or better, `=d6`
 *   DialogSwitch noCrit: true   ticked, the roll can't be a Critical Success (Jack Of All Trades' d4)
 *   DialogSwitch capDie: "d12"  ticked, the final die can't go above d12 however many ↑ it has (Programmable)
 *   FumbleRange {upTo}          a natural d20 of `upTo` or less also Fumbles (Time Traveler's Hang-Up: 2 on a d4 or lower)
 *                               - dice.mjs#_rollSkillHelper, after Consistent and Xenotech; `when` sees roll:finalDie:
 *   DownshiftCap {max}          the dialog's settled ↓ total is at most `max` (Advantageous Fighter: 2 on a melee attack
 *                               with Edge) - right before the final die is worked out; `when` sees roll:edge
 */

const SHIFTS = () => globalThis.CONFIG?.E20?.skillShiftList ?? ['criticalSuccess', 'autoSuccess', '3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20', 'autoFail', 'fumble'];

registerTag('roll:baseDie', (rest, ctx) => (ctx.baseShift ? ctx.baseShift == rest : null));

registerTag('roll:finalDie', (rest, ctx) => {
  const match = /^(<=|>=|<|>|=)(.+)$/.exec(String(rest ?? ''));
  if (!match || !ctx.finalShift) {
    return null;
  }

  // Lower index = better die. "<=d4" (no better than d4) is index >= d4's.
  const list = SHIFTS();
  const at = list.indexOf(ctx.finalShift);
  const want = list.indexOf(match[2]);
  if (at < 0 || want < 0) {
    return null;
  }

  return { '<=': at >= want, '>=': at <= want, '<': at > want, '>': at < want, '=': at == want }[match[1]];
});

const SWITCH = RULE_TYPES.DialogSwitch;
SWITCH.params.noCrit ??= { kind: 'bool' };
SWITCH.params.capDie ??= { kind: 'string' };
{
  const inner = SWITCH.validate;
  SWITCH.validate = rule => inner(rule).filter(error => !((rule.noCrit || rule.capDie) && error == 'changes nothing'));
}

registerRuleType('FumbleRange', {
  params: { upTo: { kind: 'formula', required: true } },
  scopes: ['self'],
});

/** The highest natural d20 that Fumbles for this roll under the actor's FumbleRange rules (1 with none). */
export function ruleFumbleUpTo(actor, roll = {}) {
  let upTo = 1;
  for (const { rule, item } of actor ? rulesOfType(actor, 'FumbleRange') : []) {
    if (evaluate(rule.when, contextFor({ ...roll, self: actor, holder: actor, ruleItem: item })) === true) {
      upTo = Math.max(upTo, Math.round(resolveValue(rule.upTo, { actor, item }, 1)));
    }
  }

  return upTo;
}

registerRuleType('DownshiftCap', {
  params: { max: { kind: 'formula', required: true } },
  scopes: ['self'],
});

/** The ↓ cap the actor's DownshiftCap rules put on this roll, or null. */
export function ruleDownshiftCap(actor, roll = {}) {
  let cap = null;
  for (const { rule, item } of actor ? rulesOfType(actor, 'DownshiftCap') : []) {
    if (evaluate(rule.when, contextFor({ ...roll, self: actor, holder: actor, ruleItem: item })) === true) {
      const max = Math.max(0, Math.round(resolveValue(rule.max, { actor, item }, 0)));
      cap = cap === null ? max : Math.min(cap, max);
    }
  }

  return cap;
}

/**
 * `BonusPoolDie {skill}` - the roll also rolls that Skill's die into its kept-highest pool, like a Specialization die
 * (dice.mjs#_getFormula's bonus pool die - one in Specialization's staircase); an untrained (d20) Skill adds nothing.
 * Decided once the dialog has closed; `when` sees the roll, the target as the other party (Rumble in the Jungle: its
 * Intimidation die against a target that hasn't acted, with a weapon that isn't Silent). The first rule that holds counts.
 */
registerRuleType('BonusPoolDie', {
  params: { skill: { kind: 'string', required: true } },
  scopes: ['self'],
});

/** The bonus pool die (a Skill's shift, d2...d12) the actor's BonusPoolDie rules add to this roll, or null. */
export function ruleBonusPoolDie(actor, roll = {}, target = null) {
  for (const { rule, item } of actor ? rulesOfType(actor, 'BonusPoolDie') : []) {
    if (evaluate(rule.when, contextFor({ ...roll, self: actor, holder: actor, ruleItem: item, other: target })) !== true) {
      continue;
    }

    const shift = actor.system?.skills?.[rule.skill]?.shift;
    if (shift && shift != 'd20') {
      return shift;
    }
  }

  return null;
}
