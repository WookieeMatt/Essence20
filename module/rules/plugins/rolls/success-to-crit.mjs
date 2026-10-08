// Round 15 (items1): rule type SuccessToCrit - No Factor.
import { registerRuleType } from "../../types.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { runSteps, stepContext, stepErrors } from "../../steps.mjs";

/**
 * `SuccessToCrit {when, steps?}` - a plain success (Degrees of Success x1) on one of the holder's rolls against a target
 * the `when` holds for becomes a Critical Success (x2), where dice.mjs#_rollSkillHelper bumps an Unconscious target's
 * row (before Better than the Best and Consistent, so those still apply). A roll that already succeeded by double, crit
 * or failed is left alone. `when` sees self = the roller, target = the row's target, item: / skill: / attack the roll.
 * `steps` run once the roll's rows are worked out, once per rule that turned some row (as the holder, the turned rows'
 * targets as its targets) - "afterwards, the disguise is gone".
 */
registerRuleType('SuccessToCrit', {
  params: { steps: { kind: 'object' } },
  scopes: ['self'],
  validate: rule => [
    ...(Array.isArray(rule.when) && rule.when.length ? [] : ['needs when (the targets it works against)']),
    ...(rule.steps !== undefined ? stepErrors(rule.steps) : []),
  ],
});

const lookup = uuid => {
  try {
    return uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null;
  } catch (error) {
    return null;
  }
};

/**
 * Whether a row's plain success becomes a Critical Success. Synchronous (dice.mjs works the rows out in a map); the
 * rules that did it are added to `applied` ([{entry, item, rule, targets}]) for runSuccessToCritSteps.
 * @param {Actor} actor
 * @param {Object} entry          The row: {targetUuid, ...}.
 * @param {Object} checkContext   The roll's context (riderContext, isAttack).
 * @param {Array} [applied]
 * @returns {Boolean}
 */
export function successToCrit(actor, entry, checkContext = {}, applied = []) {
  const target = lookup(entry?.targetUuid);
  if (!actor || !target) {
    return false;
  }

  const rider = checkContext?.riderContext ?? {};
  const item = lookup(rider.itemUuid);
  let turned = false;
  for (const { rule, item: ruleItem, index } of rulesOfType(actor, 'SuccessToCrit')) {
    const ctx = contextFor({
      self: actor, ruleItem, other: target, item, rolledSkill: rider.skill ?? undefined,
      isAttack: checkContext?.isAttack ?? item?.type == 'weaponEffect', isMelee: rider.style == 'melee',
    });
    if (evaluate(rule.when, ctx) !== true) {
      continue;
    }

    turned = true;
    const known = applied.find(one => one.item === ruleItem && one.index == index);
    if (known) {
      known.targets.push(target);
    } else {
      applied.push({ item: ruleItem, rule, index, targets: [target] });
    }
  }

  return turned;
}

/** Run the steps of the SuccessToCrit rules that turned a row of this roll (see successToCrit). */
export async function runSuccessToCritSteps(actor, applied = []) {
  for (const { item, rule, targets } of applied) {
    if (!Array.isArray(rule.steps) || !rule.steps.length) {
      continue;
    }

    const ctx = stepContext({ actor, item, rule, targets });
    await runSteps(rule.steps, ctx);
    if (ctx.chat.length && globalThis.ChatMessage?.create) {
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker?.({ actor }), content: ctx.chat.join('<br>') });
    }
  }
}
