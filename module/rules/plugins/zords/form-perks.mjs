import { rulesOf } from "../../index.mjs";
import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { resolveValue } from "../../formula.mjs";
import { registerStep } from "../../steps.mjs";
import { registerRuleType } from "../../types.mjs";
import { flagOf, itemsOf, sourceOf } from "../shared/zord-crew-lookups.mjs";

/**
 * Group A: Form General Perks as data.
 *
 * - Rule type `Form` {cost?, swaps?, grants?, element?} on a Form Perk: what activating it does - its Personal Power
 *   cost, the weapons it swaps in ({replaces: blaster | power | both, uuids: [...] | pick: [...], when?: [tags]}) and
 *   the gear it hands over for the duration (grants). items/forms/ranger-form-perks.mjs's Morph prompt, activation and
 *   de-Morph clean-up read it (ruleFormSpec / ruleFormUuids) - one Form active at a time, kept in flags.essence20.zord1Form.
 * - Steps `formStart` (activate the rule's own item's Form) and `formEnd` (end the active Form).
 * - Tags `form:active` (the rule's item is the active Form), `form:any` (some Form is active).
 *
 * Group A's tag target:notBeyond and steps rollAs / transformInto, which used to sit here, are
 * tags/target-not-beyond.mjs, rolls/roll-as-step.mjs and ./transform-into-step.mjs (registered right after this file).
 */

registerRuleType('Form', {
  params: {
    cost: { kind: 'formula' },
    swaps: { kind: 'object' },
    grants: { kind: 'strings' },
    element: { kind: 'bool' },
  },
  scopes: ['self'],
  validate: rule => (Array.isArray(rule.swaps ?? []) && (rule.swaps ?? []).every(swap => ['blaster', 'power', 'both'].includes(swap?.replaces)
    && (Array.isArray(swap.uuids) || Array.isArray(swap.pick))) ? [] : ['swaps: each needs replaces (blaster | power | both) and uuids or pick']),
});

/** The Form rule on an actor's copy of a Form Perk (by its book source), with the item. */
function formRuleOf(actor, uuid) {
  for (const item of itemsOf(actor)) {
    if (sourceOf(item) != uuid) {
      continue;
    }

    const rule = rulesOf(item).find(candidate => candidate?.type == 'Form' && !candidate.disabled
      && evaluate(candidate.when, contextFor({ self: actor, ruleItem: item })) === true);
    if (rule) {
      return { rule, item };
    }
  }

  return null;
}

/** The book sources of the Form Perks this actor holds as rules, in item order. */
export function ruleFormUuids(actor) {
  return [...new Set(itemsOf(actor).filter(item => rulesOf(item).some(rule => rule?.type == 'Form' && !rule.disabled))
    .map(item => sourceOf(item)).filter(Boolean))];
}

/** A Form rule as forms.mjs's spec ({key, cost, swaps, grants, element}), or null. */
export function ruleFormSpec(actor, uuid) {
  const found = formRuleOf(actor, uuid);
  if (!found) {
    return null;
  }

  const { rule, item } = found;
  const swaps = (rule.swaps ?? []).filter(swap => !swap.when || evaluate(swap.when, contextFor({ self: actor, ruleItem: item })) === true)
    .map(swap => ({ replaces: swap.replaces, ...(swap.pick ? { pick: [...swap.pick] } : { uuids: [...swap.uuids] }) }));
  return {
    key: uuid, cost: Math.max(0, Math.round(resolveValue(rule.cost ?? 0, { actor, item }, 0))), swaps,
    ...(rule.grants?.length ? { grants: [...rule.grants] } : {}), ...(rule.element ? { element: true } : {}),
  };
}

/** The active Form's book source, or null. */
const activeUuid = actor => flagOf(actor, 'zord1Form')?.uuid ?? null;

registerTag('form', (rest, ctx) => {
  const active = activeUuid(ctx.self);
  if (rest == 'any') {
    return !!active;
  }

  if (rest == 'active') {
    return !!active && !!ctx.ruleItem && sourceOf(ctx.ruleItem) == active;
  }

  return null;
}, { family: 'self', param: 'formTag', phrase: arg => ({ any: ['a Form is active', 'no Form is active'], active: ['this Form is active', "this Form isn't active"] }[arg] ?? null) });
registerStep('formStart', async (step, ctx) => {
  const { activateForm } = await import("../../../items/forms/ranger-form-perks.mjs");
  const uuid = sourceOf(ctx.item);
  return uuid && (await activateForm(ctx.actor, uuid)) ? undefined : false;
});

registerStep('formEnd', async (step, ctx) => {
  const { endForm } = await import("../../../items/forms/ranger-form-perks.mjs");
  await endForm(ctx.actor);
});
