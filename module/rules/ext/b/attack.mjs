import { contextFor, evaluate, registerTag, sideActorsWithin } from "../../predicate.mjs";
import { canAfford, itemsFor, recipients, registerStep, runSteps } from "../../steps.mjs";
import { T, escape, num, resolve } from "./common.mjs";

/**
 * Attacks made by a rule (round 10, group B):
 *
 *  - attack {item, to?, dataset?}      the attack `item` is rolled the ordinary way (its own dialog, card, damage and
 *                                      riders) against the recipients (default: the run's first target), who become the
 *                                      user's targets. item: "rolled" - the attack a hit / miss / afterRoll Trigger
 *                                      answered (@var.rolledItem); else an item selector (choice:<key>, name~...).
 *                                      dataset: flags the roll carries (roll:dataset:<key> in its own Triggers).
 *  - attackEach {item, filter?, action?, pay?, dataset?, message?}
 *                                      one roll of the attack against EVERY creature within its range (its Range, or 5 ft
 *                                      per Reach multiplier) that meets `filter` (asked as the target); none - the run stops
 *                                      with `message`. Then `action` (free, move, standard, fullAction, standardAndMove,
 *                                      wholeTurn) is spent and the `pay` steps run (a Story Point), each able to stop it,
 *                                      before the roll. @var.attacked counts them.
 *
 * Tag
 *  - self:canSpendStoryPoints          the actor's Story Point pool can pay 1 (the gate the hand-written spends use).
 */

const ACTIONS = ['free', 'move', 'standard', 'fullAction', 'standardAndMove', 'wholeTurn'];

function attackItem(step, ctx) {
  const pick = String(step.item ?? 'rolled');
  if (pick == 'rolled') {
    return resolve(ctx.vars?.rolledItem);
  }

  return itemsFor({ ...step, item: pick }, ctx.actor, ctx)[0] ?? null;
}

/** An attack's reach: its Range, else 5 ft per Reach multiplier. */
export function attackRange(effect) {
  return num(effect?.system?.range?.value) || 5 * Math.max(1, num(effect?.system?.range?.reachMultiplier));
}

async function rollAt(effect, targets, dataset) {
  const ids = targets.map(actor => actor.getActiveTokens?.()?.[0]?.id).filter(Boolean);
  globalThis.canvas?.tokens?.setTargets?.(ids);
  return effect.roll({ bypassEconomy: true, ...(dataset && typeof dataset == 'object' ? dataset : {}) });
}

const datasetErrors = (step, where) => (step.dataset !== undefined && (typeof step.dataset != 'object' || Array.isArray(step.dataset)) ? [`${where}: dataset must be {key: value}`] : []);

registerStep('attack', async (step, ctx) => {
  const effect = attackItem(step, ctx);
  if (effect?.type != 'weaponEffect') {
    ctx.chat.push(T('NoAttack', { item: escape(ctx.item?.name) }));
    return false;
  }

  const targets = recipients({ ...step, to: step.to ?? 'target' }, ctx);
  if (!targets.length) {
    ctx.chat.push(T('NeedsTarget', { item: escape(ctx.item?.name) }));
    return false;
  }

  const result = await rollAt(effect, targets, step.dataset);
  return result?.cancelled ? false : undefined;
}, { errors: datasetErrors });

registerStep('attackEach', async (step, ctx) => {
  const effect = attackItem(step, ctx);
  if (effect?.type != 'weaponEffect') {
    ctx.chat.push(T('NoAttack', { item: escape(ctx.item?.name) }));
    return false;
  }

  const filter = Array.isArray(step.filter) ? step.filter : [];
  const foes = sideActorsWithin(ctx.actor, attackRange(effect), 'any')
    .filter(other => !filter.length || evaluate(filter, contextFor({ self: ctx.actor, holder: ctx.actor, ruleItem: ctx.item, other })) === true);
  if (!foes.length) {
    ctx.chat.push(escape(step.message ?? T('NobodyInRange')));
    return false;
  }

  if (step.action) {
    const { spend } = await import("../../../helpers/action-economy.mjs");
    const paid = await spend(ctx.actor, step.action, { source: ctx.item?.name ?? null });
    if (paid?.blocked) {
      return false;
    }
  }

  if (Array.isArray(step.pay) && !(await runSteps(step.pay, ctx))) {
    return false;
  }

  ctx.targets = foes;
  ctx.vars.attacked = foes.length;
  const result = await rollAt(effect, foes, step.dataset);
  return result?.cancelled ? false : undefined;
}, {
  errors: (step, where) => [...datasetErrors(step, where), ...(step.action && !ACTIONS.includes(step.action) ? [`${where}: action must be ${ACTIONS.join(', ')}`] : [])],
  branches: ['pay'],
});

registerTag('self:canSpendStoryPoints', (rest, ctx) => (ctx.self ? canAfford({ storyPoints: true }, 1, { actor: ctx.self }) : null));
