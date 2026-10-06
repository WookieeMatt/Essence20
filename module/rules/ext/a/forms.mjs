import { rulesOf } from "../../index.mjs";
import { contextFor, evaluate, feetBetween, registerTag } from "../../predicate.mjs";
import { resolveValue } from "../../formula.mjs";
import { itemsFor, recipients, registerStep, runSteps } from "../../steps.mjs";
import { registerRuleType } from "../../types.mjs";
import { flagOf, itemsOf, sourceOf } from "./common.mjs";

/**
 * Group A: Form General Perks as data.
 *
 * - Rule type `Form` {cost?, swaps?, grants?, element?} on a Form Perk: what activating it does - its Personal Power
 *   cost, the weapons it swaps in ({replaces: blaster | power | both, uuids: [...] | pick: [...], when?: [tags]}) and
 *   the gear it hands over for the duration (grants). helpers/extensions/zord1/forms.mjs's Morph prompt, activation and
 *   de-Morph clean-up read it (ruleFormSpec / ruleFormUuids) - one Form active at a time, kept in flags.essence20.zord1Form.
 * - Steps `formStart` (activate the rule's own item's Form) and `formEnd` (end the active Form).
 * - Tags `form:active` (the rule's item is the active Form), `form:any` (some Form is active), `target:notBeyond:<ft>`
 *   (the other party is no farther than that - off the canvas counts as near enough).
 * - Steps `rollAs` {to, skill, dif, snag?, onSuccess?, onFail?} (each recipient rolls the Skill Test; its branch runs
 *   with that recipient as the target) and `transformInto` {item} (convert into the Alt Mode the item selector finds -
 *   `choice:<key>` after a pick).
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
}, { family: 'self', param: 'formTag' });

// target:notBeyond:<ft> - the other party isn't farther away than that (off the canvas counts as near enough - the old
// "warn only when measured too far" checks: Ninja Storm's blasts).
registerTag('target:notBeyond', (rest, ctx) => {
  if (!ctx.other) {
    return false;
  }

  const feet = feetBetween(ctx.self, ctx.other);
  return feet === null || !Number.isFinite(feet) || feet <= Number(rest) + 0.5;
});

registerStep('formStart', async (step, ctx) => {
  const { activateForm } = await import("../../../helpers/extensions/zord1/forms.mjs");
  const uuid = sourceOf(ctx.item);
  return uuid && (await activateForm(ctx.actor, uuid)) ? undefined : false;
});

registerStep('formEnd', async (step, ctx) => {
  const { endForm } = await import("../../../helpers/extensions/zord1/forms.mjs");
  await endForm(ctx.actor);
});

registerStep('rollAs', async (step, ctx) => {
  const { rollTest } = await import("../../../helpers/grants.mjs");
  const saved = ctx.targets;
  for (const roller of recipients({ ...step, to: step.to ?? 'target' }, ctx)) {
    const dif = Math.round(resolveValue(step.dif ?? 10, { actor: ctx.actor, item: ctx.item, vars: ctx.vars, other: roller }, 10));
    const result = await rollTest(roller, step.skill, dif, step.snag ? { snag: true } : {});
    ctx.vars.lastRoll = result;
    ctx.targets = [roller];
    const branch = result?.success ? step.onSuccess : step.onFail;
    if (Array.isArray(branch) && !(await runSteps(branch, ctx))) {
      ctx.targets = saved;
      return false;
    }
  }

  ctx.targets = saved;
}, {
  errors: (step, where) => (step.skill ? [] : [`${where}: rollAs needs a skill`]),
  branches: ['onSuccess', 'onFail'],
});

registerStep('transformInto', async (step, ctx) => {
  const [mode] = itemsFor(step, ctx.actor, ctx).filter(item => item.type == 'altMode');
  if (!mode || typeof ctx.actor?.transform != 'function') {
    return false;
  }

  await ctx.actor.transform(mode.uuid);
  ctx.vars.mode = mode.name;
}, { errors: (step, where) => (step.item ? [] : [`${where}: transformInto needs an item`]) });
