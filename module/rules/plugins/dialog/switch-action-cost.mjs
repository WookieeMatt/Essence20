import { resolveValue } from "../../formula.mjs";
import { RULE_TYPES } from "../../types.mjs";

/**
 * Round 16 (part a): three DialogSwitch settings dice.mjs reads.
 *
 *   action: "free" | "move" | "standard"   ticked, the roller spends that action as the roll is made - before anything
 *                                          else the dialog's choices do; when the action economy refuses it, the roll is
 *                                          cancelled (dice.mjs#rollSkill returns {cancelled: true}). actionKind names the
 *                                          action for the cost changers (Quick Study / Swift Study's analyzeTarget).
 *                                          The spend's source is the switch's item (Analyze Target, Surging).
 *   baseDamageMultiply: N                  ticked, the attack's own damage value (not its damage bonus) is multiplied by N
 *                                          (Surging: "double the element damage").
 *   backfireOn: N                          ticked, when any d20 of the roll shows N, the roller takes the roll's damage
 *                                          (its card damage before Degrees of Success) - Surging's natural 1.
 */

const SWITCH = RULE_TYPES.DialogSwitch;
SWITCH.params.action ??= { kind: 'enum', options: ['free', 'move', 'standard'] };
SWITCH.params.actionKind ??= { kind: 'string' };
SWITCH.params.baseDamageMultiply ??= { kind: 'formula' };
SWITCH.params.backfireOn ??= { kind: 'formula' };
{
  const inner = SWITCH.validate;
  SWITCH.validate = rule => (inner?.(rule) ?? []).filter(error => !((rule.action || rule.baseDamageMultiply || rule.backfireOn) && error == 'changes nothing'))
    .concat(rule.actionKind !== undefined && !rule.action ? ['actionKind goes with action'] : []);
}

/** The actor's ticked switches (by their dialog name) that carry one of these settings. */
async function tickedSwitches(actor, options, ctx) {
  const { ruleDialogSwitches } = await import("../../adapter.mjs");
  const ticked = options?.ext ?? {};
  return ruleDialogSwitches(actor, ctx).filter(({ name, entry }) => !!ticked[name] && entry?.rule?.type == 'DialogSwitch')
    .map(({ entry }) => entry);
}

/**
 * Pay the ticked switches' actions, and note their damage multiplier / backfire on the options. Resolves false when an
 * action can't be paid - the roll is then cancelled.
 * @param {Actor} actor
 * @param {Object} options   The dialog's options.
 * @param {Object} ctx       {item, rolledSkill, rolledEssence, dataset, baseShift}
 * @returns {Promise<Boolean>}
 */
export async function applySwitchActions(actor, options, ctx = {}) {
  const on = await tickedSwitches(actor, options, ctx);
  for (const { rule, item, owner } of on.filter(entry => entry.rule.action)) {
    const { spend } = await import("../../../mechanics/actions/action-economy.mjs");
    const paid = await spend(owner ?? actor, rule.action, { source: item?.name ?? null, ...(rule.actionKind ? { context: { kind: rule.actionKind } } : {}) });
    if (paid?.blocked) {
      return false;
    }
  }

  for (const { rule, item, owner } of on) {
    if (rule.baseDamageMultiply !== undefined) {
      const times = Math.round(resolveValue(rule.baseDamageMultiply, { actor: owner ?? actor, item }, 1));
      options.ruleBaseDamageMultiplier = (Number(options.ruleBaseDamageMultiplier) || 1) * Math.max(0, times);
    }

    if (rule.backfireOn !== undefined) {
      options.ruleBackfireOn = [...new Set([...(options.ruleBackfireOn ?? []), Math.round(resolveValue(rule.backfireOn, { actor: owner ?? actor, item }, 1))])];
    }
  }

  return true;
}

/** Whether a roll's d20s show one of the backfire numbers (dice.mjs, once the dice have landed). */
export function backfires(roll, numbers) {
  if (!Array.isArray(numbers) || !numbers.length) {
    return false;
  }

  const pool = (roll?.dice ?? []).find(die => die.faces === 20);
  return !!pool && (pool.values ?? []).some(value => numbers.includes(value));
}

