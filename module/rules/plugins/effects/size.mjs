import { registerDerived, registerRollSources } from "../../../mechanics/item-hooks.mjs";
import { ruleLabel, rulesOfType } from "../../index.mjs";
import { contextFor, evaluate, isStatic } from "../../predicate.mjs";
import { resolveValue } from "../../formula.mjs";
import { registerStep } from "../../steps.mjs";
import { registerRuleType } from "../../types.mjs";
import { T, driverOf, itemsOf, rememberChoice as remember, sourceOf, write } from "../shared/zord-crew-lookups.mjs";

/**
 * Group A: size classes as data. (Group A's askChoiceText step is dialog/ask-choice-text-step.mjs and its
 * self:clockActive tag tags/clock-active-tag.mjs, registered right after this file.)
 *
 * - Rule type `Size` {steps?, set?, atLeast?, atMost?, ladder?, min?, max?}: the actor's derived size (system.size),
 *   worked out after the other derived data. In order: every `steps` rule moves it along its ladder (by priority,
 *   each clamped to its own min / max - never past a limit, and never back across one for a size already beyond it),
 *   then `set` (the last one wins), then `atLeast` / `atMost`. `ladder`: full (default - every rung of E20.actorSizes,
 *   long / extended included) or class (the Size Class ladder small, common, large, huge, gigantic, towering,
 *   titanic; an extended / long size counts as the class below it).
 * - Steps `shiftSize` {steps, ladder?, min?, max?, record?} (the stored size, on every recipient; `record`: the size
 *   before is kept on the rule's item under rules.choices.<record>, once) and `restoreSize` {record, legacy?} (puts the
 *   recorded size back and forgets it; `legacy`: an older flag on the item that held it).
 * - Rule type `ArmorAccommodation` {level: limited | restricted}: putting on armor without an Alteration Accommodation
 *   upgrade of that level (Restricted also covers Limited) is refused (Enlarged / Shrunk).
 * - Rule type `SizeMatrixCancel` (on a driver): an attacker smaller than the vehicle they drive loses the Size Class
 *   Combat Adjustment Matrix upshifts when the rule's `when` holds (defense: the attacked Defense, target: the attacker)
 *   - a ↓ source on the attacker's roll for the matrix's shift (Big Rigger, Bigger Rigger). Only the first one by
 *   priority counts.
 */

export const FULL_SIZES = ['small', 'common', 'large', 'long', 'huge', 'extended', 'gigantic', 'extended2', 'towering', 'extended3', 'titanic'];
export const CLASS_SIZES = ['small', 'common', 'large', 'huge', 'gigantic', 'towering', 'titanic'];
const CLASS_BASE = { long: 'large', extended: 'huge', extended2: 'gigantic', extended3: 'towering' };

const fullSizes = () => {
  const configured = Object.keys(globalThis.CONFIG?.E20?.actorSizes ?? {});
  return configured.length ? configured : FULL_SIZES;
};

/**
 * A size moved `steps` along a ladder. Full ladder: clamped to min / max, never back across one for a size already
 * beyond it. Class ladder: an extended / long size starts from the class below it; clamped to the ends.
 */
export function stepSize(size, steps, { ladder = 'full', min = null, max = null } = {}) {
  if (!steps) {
    return size;
  }

  if (ladder == 'class') {
    const index = CLASS_SIZES.indexOf(CLASS_BASE[size] ?? size);
    if (index < 0) {
      return size;
    }

    const top = max && CLASS_SIZES.includes(max) ? CLASS_SIZES.indexOf(max) : CLASS_SIZES.length - 1;
    const bottom = min && CLASS_SIZES.includes(min) ? CLASS_SIZES.indexOf(min) : 0;
    return CLASS_SIZES[Math.max(bottom, Math.min(top, index + steps))];
  }

  const sizes = fullSizes();
  const index = sizes.indexOf(size);
  if (index < 0) {
    return size;
  }

  const top = max && sizes.includes(max) ? sizes.indexOf(max) : sizes.length - 1;
  const bottom = min && sizes.includes(min) ? sizes.indexOf(min) : 0;
  const target = index + steps;
  const clamped = steps > 0 ? Math.min(target, Math.max(top, index)) : Math.max(target, Math.min(bottom, index));
  return sizes[Math.max(0, Math.min(sizes.length - 1, clamped))] ?? size;
}

const SIZE_KEYS = ['set', 'atLeast', 'atMost', 'min', 'max'];

registerRuleType('Size', {
  params: {
    steps: { kind: 'formula' }, set: { kind: 'string' }, atLeast: { kind: 'string' }, atMost: { kind: 'string' },
    ladder: { kind: 'enum', options: ['full', 'class'] }, min: { kind: 'string' }, max: { kind: 'string' },
  },
  scopes: ['self'],
  validate: rule => [
    ...(['steps', 'set', 'atLeast', 'atMost'].some(key => rule[key] !== undefined) ? [] : ['changes nothing']),
    ...SIZE_KEYS.filter(key => rule[key] !== undefined && !FULL_SIZES.includes(rule[key])).map(key => `${key} must be a size (${FULL_SIZES.join(', ')})`),
  ],
});

/** The actor's Size rules, worked into system.size (registered derived data - after the hand-written size code). */
export function sizeDerived(actor) {
  const system = actor?.system;
  if (!system?.size) {
    return;
  }

  const live = rulesOfType(actor, 'Size').filter(({ rule, item }) => isStatic(rule.when) && evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === true);
  if (!live.length) {
    return;
  }

  let size = system.size;
  for (const { rule, item } of live) {
    if (rule.steps !== undefined) {
      size = stepSize(size, Math.round(resolveValue(rule.steps, { actor, item }, 0)), rule);
    }
  }

  for (const { rule } of live) {
    if (rule.set) {
      size = rule.set;
    }
  }

  const sizes = fullSizes();
  for (const { rule } of live) {
    if (rule.atLeast && sizes.indexOf(size) < sizes.indexOf(rule.atLeast)) {
      size = rule.atLeast;
    }

    if (rule.atMost && sizes.indexOf(size) > sizes.indexOf(rule.atMost)) {
      size = rule.atMost;
    }
  }

  system.size = size;
}

registerDerived(sizeDerived);

/* -------------------------------------------- */
/*  Steps                                        */
/* -------------------------------------------- */

const choiceOf = (item, key) => item?.flags?.essence20?.rules?.choices?.[key];

registerStep('shiftSize', async (step, ctx) => {
  const { recipients } = await import("../../steps.mjs");
  const steps = Math.round(resolveValue(step.steps ?? 0, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 0));
  for (const actor of recipients(step, ctx)) {
    const size = actor?.system?.size;
    if (!size) {
      continue;
    }

    if (step.record && ctx.item && !choiceOf(ctx.item, step.record)) {
      await remember(ctx.item, step.record, size);
    }

    const next = stepSize(size, steps, step);
    if (next != size) {
      await write(actor, 'update', [{ 'system.size': next }]);
    }
  }
}, { errors: (step, where) => (step.ladder && !['full', 'class'].includes(step.ladder) ? [`${where}: ladder must be full or class`] : []) });

registerStep('restoreSize', async (step, ctx) => {
  const recorded = choiceOf(ctx.item, step.record) || (step.legacy ? globalThis.foundry?.utils?.getProperty?.(ctx.item, step.legacy) : null);
  if (!recorded || !ctx.actor) {
    return;
  }

  await write(ctx.actor, 'update', [{ 'system.size': recorded }]);
  // Forgotten - unless the item is on its way out (a removed Trigger), when there's nothing left to write to.
  if (choiceOf(ctx.item, step.record) && ctx.item?.parent?.items?.get?.(ctx.item.id)) {
    try {
      await write(ctx.item, 'update', [{ [`flags.essence20.rules.choices.${step.record}`]: new foundry.data.operators.ForcedDeletion() }]);
    } catch (error) {
      // The item went while the size was being put back.
    }
  }

  if (ctx.item?.flags?.essence20?.rules?.choices) {
    delete ctx.item.flags.essence20.rules.choices[step.record];
  }
}, { errors: (step, where) => (step.record ? [] : [`${where}: restoreSize needs record`]) });

/* -------------------------------------------- */
/*  Armor accommodation                          */
/* -------------------------------------------- */

registerRuleType('ArmorAccommodation', {
  params: { level: { kind: 'enum', required: true, options: ['limited', 'restricted'] } },
  scopes: ['self'],
});

/** Whether this armor carries the Alteration Accommodation upgrade the level needs. */
export function hasAccommodation(actor, armor, level) {
  const tiers = level == 'limited' ? /limited|restricted/i : /restricted/i;
  const upgrades = [
    ...itemsOf(actor).filter(item => item.type == 'upgrade' && item.flags?.essence20?.parentId == armor.id).map(item => item.name),
    ...Object.values(armor.system?.items ?? {}).map(entry => entry?.name),
  ].filter(Boolean);
  return upgrades.some(name => /accomm?odation/i.test(name) && tiers.test(name));
}

/** @returns {Boolean} false to refuse putting the armor on. */
export function checkAccommodation(item, changes) {
  const actor = item?.parent;
  if (item?.type != 'armor' || changes?.system?.equipped !== true || !actor) {
    return true;
  }

  const levels = rulesOfType(actor, 'ArmorAccommodation').filter(({ rule, item: ruleItem }) => evaluate(rule.when, contextFor({ self: actor, ruleItem })) === true)
    .map(({ rule }) => rule.level);
  const need = levels.includes('restricted') ? 'restricted' : levels.includes('limited') ? 'limited' : null;
  if (need && !hasAccommodation(actor, item, need)) {
    globalThis.ui?.notifications?.warn?.(T('NeedsAccommodation', {
      name: actor.name, armor: item.name, level: T(need == 'restricted' ? 'Restricted' : 'Limited'),
    }));
    return false;
  }

  return true;
}

globalThis.Hooks?.on?.('preUpdateItem', (item, changes) => checkAccommodation(item, changes));

/* -------------------------------------------- */
/*  The size matrix against a driven vehicle     */
/* -------------------------------------------- */

registerRuleType('SizeMatrixCancel', { params: {}, scopes: ['self'] });

/** dice.mjs#_getSizeShift: half the ladder distance, rounded down. */
export function sizeShift(attacker, target) {
  const sizes = fullSizes();
  const a = sizes.indexOf(attacker?.system?.size);
  const t = sizes.indexOf(target?.system?.size);
  return a < 0 || t < 0 ? 0 : Math.floor(Math.abs(a - t) / 2);
}

/** The ↓ an attack on a vehicle gets from its driver's SizeMatrixCancel rules: {label, shift} or null. */
export function sizeMatrixCancel(attacker, vehicle, defense) {
  const sizes = fullSizes();
  if (!['vehicle', 'zord'].includes(vehicle?.type) || sizes.indexOf(attacker?.system?.size) >= sizes.indexOf(vehicle.system?.size)) {
    return null;
  }

  const driver = driverOf(vehicle);
  const shift = sizeShift(attacker, vehicle);
  if (!driver || !shift) {
    return null;
  }

  const entry = rulesOfType(driver, 'SizeMatrixCancel')
    .find(({ rule, item }) => evaluate(rule.when, contextFor({ self: driver, holder: driver, ruleItem: item, other: attacker, defenseType: defense })) === true);
  return entry ? { label: ruleLabel(entry.rule, entry.item), shift } : null;
}

registerRollSources((actor, target, ctx) => {
  if (!target || !ctx?.isAttack) {
    return { sources: [] };
  }

  const cancel = sizeMatrixCancel(actor, target, ctx.dataset?.defenseType ?? ctx.item?.system?.defenseType);
  return { sources: cancel ? [{ id: 'rulesSizeMatrixCancel', label: cancel.label, shiftDown: cancel.shift }] : [] };
});

export { sourceOf };
