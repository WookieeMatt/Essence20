import * as react from "../../../mechanics/combat/reaction-engine.mjs";
import { registerPostRoll } from "../../../mechanics/item-hooks.mjs";
import { formulaError, resolveValue } from "../../formula.mjs";
import { usesInWindow } from "../../limits.mjs";
import { registerTag } from "../../predicate.mjs";
import { recipients, registerRecipient, registerStep, runSteps } from "../../steps.mjs";
import { registerEvent } from "../../types.mjs";
import { isExpired } from "../../expiry.mjs";
import { T, escape, num, worldActors } from "../shared/hit-rider-lookups.mjs";

/**
 * Group B steps, tags and events (round 10):
 *
 * Steps
 *  - push {feet, to?, from?}           the recipients (default: the actor) are pushed `feet` away from the run's first
 *                                      target (from: "self" - away from the actor) - mechanics/combat/forced-movement.mjs#pushActor;
 *                                      @var.pushed counts who moved.
 *  - actAs {to, steps}                 run `steps` as each recipient (they are the actor: their rolls, `to: self` is
 *                                      them) - "the cuffed creature rolls Brawn to break free". Chat and vars are shared.
 *  - healAction {amount, to}           Health restored the way the Heal action restores it (helpers/extensions/other2/
 *                                      medic.mjs#restoreHealth): the healer's I've Got You applies, and a Defeated
 *                                      creature gets back up.
 *  - rollFlat {skill, dif, onSuccess?, onFail?}
 *                                      a Skill Test against a flat DIF (a formula - @target.<path> reads the run's
 *                                      first target) with the user's own targets cleared first, so it isn't compared
 *                                      against a targeted creature's Defense (react/core.mjs#rollVs); a cancelled roll
 *                                      stops the run.
 *  - actWhileDefeated {}               the actor may act this turn as though not Defeated (the action economy's
 *                                      act-while-Defeated stamp, without a Story Point).
 *  - collect {to, filter?, without?, required?}
 *                                      the run's targets become the recipients (no change to the user's own targets);
 *                                      without: "targets" leaves out whoever was targeted; required: stop when none.
 *  - rollFormulaVsEach {formula, defense, to?, onHit?, onMiss?}
 *                                      a flat-dice roll (any Foundry formula - "2d20kh + 1d8") against each recipient's
 *                                      Defense (a list: the best of them), rolled once per recipient; onHit / onMiss run
 *                                      with it as the target; @var.hits.
 *  - shredArmor {amount, to, until?}   the recipients' armor counts `amount` less (Toughness, never more than their
 *                                      armor share) until the scene ends (or `until`); repeated, it adds up.
 *
 * Recipients
 *  - markedByMe:<key>                 every actor carrying that mark set by the run's actor (perSetter ones too).
 *
 * Tags
 *  - self:limitUsed:<key>[:<per>]      a limit counted under that key (a button's `limit.key`) was used in its window
 *                                      (per: turn by default).
 *  - damage:attack / damage:melee      the damage a takesDamage Trigger answers came off an attack (a melee one) card the
 *                                      GM applied to this actor (react/core.mjs#lastApplyContext).
 *
 * Events
 *  - patchedUp                         a successful Patch Up / Repair test (Patch Up's Use rule): @var.amount is the
 *                                      Health it restores, skill: the Skill, the patched creature the target.
 */

registerStep('push', async (step, ctx) => {
  const feet = Math.max(0, Math.round(resolveValue(step.feet ?? 5, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 5)));
  const { pushActor } = await import("../../../mechanics/combat/forced-movement.mjs");
  let moved = 0;
  for (const actor of recipients(step, ctx)) {
    const from = (step.from ?? ((step.to ?? 'self') == 'self' ? 'target' : 'self')) == 'self' ? ctx.actor : ctx.targets[0];
    if (from && from !== actor && (await pushActor(actor, from, feet))) {
      moved++;
    }
  }

  ctx.vars.pushed = moved;
}, { errors: (step, where) => [...(formulaError(step.feet) ? [`${where}.feet: ${formulaError(step.feet)}`] : []), ...(step.from && !['self', 'target'].includes(step.from) ? [`${where}: from must be self or target`] : [])] });

registerStep('actAs', async (step, ctx) => {
  for (const actor of recipients(step, ctx)) {
    if (!(await runSteps(step.steps ?? [], { ...ctx, actor }))) {
      return false;
    }
  }
}, { errors: (step, where) => (Array.isArray(step.steps) && step.steps.length ? [] : [`${where}: actAs needs steps`]), branches: ['steps'] });

registerStep('healAction', async (step, ctx) => {
  const amount = Math.max(0, Math.round(resolveValue(step.amount ?? 1, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 1)));
  const { restoreHealth } = await import("../../../mechanics/actions/heal-action.mjs");
  for (const actor of recipients(step, ctx)) {
    await restoreHealth(ctx.actor, actor, amount);
    ctx.chat.push(T('Restored', { name: escape(actor.name), amount }));
  }
});

registerStep('rollFlat', async (step, ctx) => {
  const dif = Math.round(resolveValue(step.dif ?? 10, { actor: ctx.actor, item: ctx.item, vars: ctx.vars, other: ctx.targets?.[0] ?? null }, 10));
  const result = await react.rollVs?.(ctx.actor, String(step.skill ?? ''), dif, ctx.item?.uuid ? { itemUuid: ctx.item.uuid } : {});
  if (!result || result.cancelled) {
    return false;
  }

  ctx.vars.lastRoll = result;
  const branch = result.success ? step.onSuccess : step.onFail;
  return Array.isArray(branch) ? runSteps(branch, ctx) : undefined;
}, { errors: (step, where) => (step.skill ? [] : [`${where}: rollFlat needs a skill`]), branches: ['onSuccess', 'onFail'] });

registerStep('actWhileDefeated', async (step, ctx) => {
  const { ACT_WHILE_DEFEATED_FLAG } = await import("../../../mechanics/actions/action-economy.mjs");
  const { markUsedThisTurn } = await import("../../../mechanics/characters/perks.mjs");
  await markUsedThisTurn(ctx.actor, ACT_WHILE_DEFEATED_FLAG);
});

registerStep('collect', async (step, ctx) => {
  const skip = step.without == 'targets' ? new Set(ctx.targets) : new Set();
  ctx.targets = recipients(step, ctx).filter(actor => !skip.has(actor));
  if (step.required && !ctx.targets.length) {
    return false;
  }
}, { errors: (step, where) => (step.without && step.without != 'targets' ? [`${where}: without can only be targets`] : []) });

/** A Defense's total, or (a list) the best of them. */
function defenseOf(actor, defense) {
  return Math.max(...[defense ?? 'toughness'].flat().map(key => num(actor?.system?.defenses?.[key]?.total)));
}

registerStep('rollFormulaVsEach', async (step, ctx) => {
  const others = recipients({ ...step, to: step.to ?? 'targets' }, ctx);
  if (!others.length) {
    ctx.chat.push(T('NeedsTarget', { item: escape(ctx.item?.name) }));
    return false;
  }

  const saved = ctx.targets;
  ctx.vars.hits = 0;
  for (const other of others) {
    const roll = await new globalThis.Roll(String(step.formula)).evaluate();
    const dif = defenseOf(other, step.defense);
    const hit = num(roll.total) >= dif;
    ctx.vars.hits += hit ? 1 : 0;
    ctx.chat.push(T(hit ? 'FormulaHit' : 'FormulaMiss', { name: escape(other.name), total: num(roll.total), dif }));
    ctx.targets = [other];
    const branch = hit ? step.onHit : step.onMiss;
    if (Array.isArray(branch)) {
      await runSteps(branch, ctx);
    }
  }

  ctx.targets = saved;
}, {
  errors: (step, where) => [
    ...(step.formula ? [] : [`${where}: rollFormulaVsEach needs a formula`]),
    ...([step.defense ?? 'toughness'].flat().every(key => ['toughness', 'evasion', 'willpower', 'cleverness'].includes(key)) ? [] : [`${where}: defense must be toughness, evasion, willpower or cleverness (or a list of them)`]),
  ],
  branches: ['onHit', 'onMiss'],
});

registerStep('shredArmor', async (step, ctx) => {
  const amount = Math.max(0, Math.round(resolveValue(step.amount ?? 1, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 1)));
  if (!amount) {
    return;
  }

  return runSteps([{ do: 'mark', key: 'armorShred', to: step.to ?? 'target', count: amount, add: true, until: step.until ?? 'scene' }], ctx);
});

/** markedByMe:<key> - every actor (world, and unlinked tokens on the canvas) carrying that mark set by the run's actor. */
registerRecipient(/^markedByMe:([\w-]+)$/, (match, ctx) => {
  const setter = ctx.actor;
  const found = new Set();
  const consider = actor => {
    const marks = actor?.flags?.essence20?.ruleMarks ?? {};
    const mark = marks[`${match[1]}--${setter?.id}`] ?? marks[match[1]];
    if (mark && setter?.uuid && mark.by == setter.uuid && !isExpired(mark)) {
      found.add(actor);
    }
  };

  worldActors().forEach(consider);
  (globalThis.canvas?.tokens?.placeables ?? []).forEach(token => consider(token.actor));
  return [...found];
});

registerTag('self:limitUsed', (rest, ctx) => {
  const [key, per = 'turn'] = String(rest).split(':');
  return ctx.self && key ? usesInWindow(ctx.self, key, per) > 0 : null;
});

/** The attack card the GM last applied, when it was applied to this actor (no target recorded counts too). */
function appliedTo(actor) {
  const applied = react.lastApplyContext?.() ?? null;
  return applied && (!applied.targetUuid || !actor?.uuid || applied.targetUuid == actor.uuid) ? applied : null;
}

registerTag('damage:attack', (rest, ctx) => (ctx.damageAmount === undefined && ctx.damageType === undefined ? null : !!appliedTo(ctx.self)?.isAttack));
registerTag('damage:melee', (rest, ctx) => (ctx.damageAmount === undefined && ctx.damageType === undefined ? null : !!appliedTo(ctx.self)?.isMelee));

registerEvent('patchedUp');

/** A successful Patch Up test: patchedUp Triggers on the one who rolled it. */
export async function firePatchedUp(actor, results, checkContext = {}, { rider = {} } = {}) {
  if (!checkContext?.isPatchUpAttempt || !results?.[0]?.success) {
    return;
  }

  const { fireTriggers } = await import("../../triggers.mjs");
  const patched = globalThis.game?.user?.targets?.first?.()?.actor ?? actor;
  const skill = rider?.skill ?? checkContext?.skill;
  await fireTriggers(actor, 'patchedUp', { roll: { rolledSkill: skill }, targets: patched ? [patched] : [], vars: { amount: num(checkContext.patchUpAmount), skill: skill ?? '' } });
}

registerPostRoll(firePatchedUp);
