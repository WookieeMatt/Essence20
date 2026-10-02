import {
  registerApplyDialog, registerDamageModifier, registerDefenseAdjust, registerDerived, registerDialogToggles, registerHitRider,
  registerMissionAdvanced, registerPreRoll, registerRerollGrant, registerRest, registerRollSources, registerSceneAdvanced,
  registerSpecializes,
} from "../helpers/extensions.mjs";
import { ruleHelper } from "./code.mjs";
import { resolveValue } from "./formula.mjs";
import { hostOf, rebuildIndex, ruleId, ruleLabel, rulesOfType } from "./index.mjs";
import { contextFor, evaluate, interpolate, isStatic } from "./predicate.mjs";

/**
 * The rules engine's one connection to the rest of the system (docs/RULES_ENGINE_PLAN.md §6).
 *
 * Item rules don't get hook sites of their own. This file registers once into the same extension
 * registry the hand-written Perk slices use (helpers/extensions.mjs), and each registration reads
 * the actor's rule index (rules/index.mjs) instead of checking compendium ids. The roll pipeline
 * doesn't know rules exist.
 *
 * Scopes:
 *  - self      the rule changes its own actor's rolls, Defenses, damage and numbers;
 *  - incoming  the rule sits on a defender and changes rolls made against them;
 *  - host      the rule sits on an upgrade and applies to rolls made with the item it's attached to
 *              (or that item's own weapon effects), and to that item's numbers.
 *
 * A rule whose condition can't be known (an `ask:` tag, an unrecognised tag) is never applied
 * automatically - it becomes a Roll Options Dialog switch, off by default.
 */

/* -------------------------------------------- */
/*  Shared                                       */
/* -------------------------------------------- */

function firstTarget() {
  const targets = globalThis.game?.user?.targets;
  const first = targets?.first?.() ?? (targets ? [...targets][0] : null);
  return first?.actor ?? null;
}

/** The roll facts the dialog hooks aren't handed - derived the way dice.mjs derives them. */
function rollFacts(item, ctx = {}) {
  const isAttack = ctx.isAttack ?? item?.type == 'weaponEffect';
  return {
    isAttack,
    isMelee: ctx.isMelee ?? (isAttack && item?.system?.classification?.style == 'melee'),
  };
}

/** Whether a host-scoped rule's upgrade is attached to the item rolled (or that item's weapon). */
export function hostMatches(ruleItem, item) {
  const host = hostOf(ruleItem);
  if (!host || !item) {
    return false;
  }

  return item.id == host.id || item.flags?.essence20?.parentId == host.id;
}

/**
 * Every roll-changing rule that bears on this roll, with its condition's answer.
 * @param {Actor} actor    The roller.
 * @param {Actor} target   The roll's target, if any.
 * @param {Object} roll    {item, rolledSkill, rolledEssence, isAttack, isMelee, dataset}
 * @param {Array<String>} types   Rule types to gather.
 * @returns {Array<{rule, item, index, answer, owner}>}
 */
export function rollRules(actor, target, roll, types = ['RollModifier']) {
  const out = [];
  const facts = { ...roll, ...rollFacts(roll.item, roll) };
  for (const type of types) {
    for (const entry of [...rulesOfType(actor, type, 'self'), ...rulesOfType(actor, type, 'host')]) {
      if ((entry.rule.scope ?? 'self') == 'host' && !hostMatches(entry.item, roll.item)) {
        continue;
      }

      const ctx = contextFor({ ...facts, self: actor, ruleItem: entry.item, other: target });
      out.push({ ...entry, owner: actor, answer: evaluate(entry.rule.when, ctx) });
    }

    if (target && type == 'RollModifier') {
      for (const entry of rulesOfType(target, type, 'incoming')) {
        const ctx = contextFor({ ...facts, self: target, ruleItem: entry.item, other: actor });
        out.push({ ...entry, owner: target, answer: evaluate(entry.rule.when, ctx) });
      }
    }
  }

  return out;
}

/** A RollModifier/DialogSwitch's shifts, resolved against its own actor and item. */
export function shiftsOf(rule, owner, item) {
  const scope = { actor: owner, item };
  return {
    shiftUp: Math.max(0, Math.round(resolveValue(rule.upshift, scope))),
    shiftDown: Math.max(0, Math.round(resolveValue(rule.downshift, scope))),
    edge: !!rule.edge,
    snag: !!rule.snag,
    specialize: !!rule.specialize,
  };
}

/**
 * Call one hook on every Code rule's helper (rules/code.mjs). A rule whose condition is known false
 * is skipped; a helper that isn't registered (yet) does nothing. One failing helper can't stop a roll.
 * @returns {Array<*>}   What each helper returned.
 */
export function callCodeHelpers(actor, hook, ...args) {
  const out = [];
  for (const { rule, item } of rulesOfType(actor, 'Code')) {
    const fn = ruleHelper(rule.helper)?.[hook];
    if (typeof fn != 'function' || evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === false) {
      continue;
    }

    try {
      out.push(fn(...args, { rule, item }));
    } catch (error) {
      console.error(`Essence20 | rule helper "${rule.helper}" failed in ${hook}`, error);
    }
  }

  return out;
}

/* -------------------------------------------- */
/*  Rolls                                        */
/* -------------------------------------------- */

/** Automatic modifiers, listed with their source in the Roll Options Dialog. */
export function ruleRollSources(actor, target, ctx = {}) {
  const sources = [];
  for (const { rule, item, index, answer, owner } of rollRules(actor, target, ctx)) {
    if (answer !== true) {
      continue;
    }

    const shifts = shiftsOf(rule, owner, item);
    if (!shifts.shiftUp && !shifts.shiftDown && !shifts.edge && !shifts.snag) {
      continue;
    }

    sources.push({ id: ruleId(item, index), label: ruleLabel(rule, item), ...shifts });
  }

  for (const result of callCodeHelpers(actor, 'rollSources', actor, target, ctx)) {
    sources.push(...(result?.sources ?? []));
  }

  return { sources };
}

/** A RollModifier with `specialize` makes the roll count as Specialized. */
export function ruleSpecializes(actor, skill, item, dataset) {
  const roll = { item, rolledSkill: skill, dataset };
  return rollRules(actor, firstTarget(), roll).some(({ rule, answer }) => rule.specialize && answer === true);
}

/** The state this actor last left a rule switch in (flags.essence20.ruleSwitches), or undefined. */
export function rememberedSwitch(actor, name) {
  const value = actor?.flags?.essence20?.ruleSwitches?.[name];
  return typeof value == 'boolean' ? value : undefined;
}

/**
 * The switches: every DialogSwitch whose condition isn't false, and every rule that has to ask. Each
 * starts where this actor last left it, else at its default (a DialogSwitch's own, off for the rest).
 */
export function ruleDialogSwitches(actor, ctx = {}) {
  const switches = [];
  for (const entry of rollRules(actor, firstTarget(), ctx, ['DialogSwitch', 'RollModifier'])) {
    const { rule, item, index, answer, owner } = entry;
    if (answer === false || (rule.type == 'RollModifier' && answer === true)) {
      continue;
    }

    switches.push({
      name: ruleId(item, index),
      label: ruleLabel(rule, item),
      type: 'checkbox',
      value: rememberedSwitch(actor, ruleId(item, index)) ?? (rule.type == 'DialogSwitch' ? !!rule.default : false),
      entry: { rule, item, owner },
    });
  }

  return switches;
}

/**
 * What the ticked switches do, once the dialog closes - and remember each switch's state for the
 * next roll. The options change before the first await, so a caller that doesn't wait still sees them.
 */
export async function applyRuleSwitches(actor, options, ctx = {}) {
  const ticked = options?.ext ?? {};
  const remember = {};
  for (const { name, value, entry } of ruleDialogSwitches(actor, ctx)) {
    if (!!ticked[name] != value) {
      remember[`flags.essence20.ruleSwitches.${name}`] = !!ticked[name];
    }

    if (!ticked[name]) {
      continue;
    }

    const shifts = shiftsOf(entry.rule, entry.owner, entry.item);
    options.shiftUp = (Number(options.shiftUp) || 0) + shifts.shiftUp;
    options.shiftDown = (Number(options.shiftDown) || 0) + shifts.shiftDown;
    options.edge ||= shifts.edge;
    options.snag ||= shifts.snag;
    options.isSpecialized ||= shifts.specialize;
  }

  if (Object.keys(remember).length && actor?.isOwner && typeof actor.update == 'function') {
    await actor.update(remember);
  }
}

/** Lower index in skillShiftList = better. */
function shiftRank(actor, skill) {
  const list = globalThis.CONFIG?.E20?.skillShiftList ?? [];
  const index = list.indexOf(actor?.system?.skills?.[skill]?.shift);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

/** SkillSubstitution: use one Skill in place of another, or the better of the two. Mutates dataset. */
export function applySkillSubstitution(actor, dataset, item) {
  if (!dataset?.skill) {
    return null;
  }

  for (const { rule, item: ruleItem } of [...rulesOfType(actor, 'SkillSubstitution', 'self'), ...rulesOfType(actor, 'SkillSubstitution', 'host')]) {
    if ((rule.scope ?? 'self') == 'host' && !hostMatches(ruleItem, item)) {
      continue;
    }

    const from = interpolate(String(rule.from ?? ''), ruleItem);
    const to = interpolate(String(rule.to ?? ''), ruleItem);
    if (!from || !to || (from != '*' && from != dataset.skill) || to == dataset.skill) {
      continue;
    }

    const ctx = contextFor({ ...rollFacts(item), item, rolledSkill: dataset.skill, dataset, self: actor, ruleItem, other: firstTarget() });
    if (evaluate(rule.when, ctx) !== true) {
      continue;
    }

    if (rule.mode == 'bestOf' && shiftRank(actor, to) >= shiftRank(actor, dataset.skill)) {
      continue;
    }

    dataset.skill = to;
    dataset.essence = globalThis.CONFIG?.E20?.skillToEssence?.[to] ?? dataset.essence;
    if (dataset.shift && actor.system?.skills?.[to]) {
      dataset.shift = actor.system.skills[to].shift;
    }

    return to;
  }

  return null;
}

/* -------------------------------------------- */
/*  Defenses, numbers and damage                 */
/* -------------------------------------------- */

const DEFENSES = ['toughness', 'evasion', 'willpower', 'cleverness'];

function addToDefense(defense, amount, label) {
  if (!defense || !amount) {
    return;
  }

  defense.total = (Number(defense.total) || 0) + amount;
  if (typeof defense.string == 'string') {
    defense.string += ` ${amount < 0 ? '-' : '+'} ${Math.abs(amount)} (${label})`;
  }
}

/** A conditional Defense rule on the defender: what it adds against this roll. */
export function ruleDefenseAdjust(attacker, defender, defenseType, ctx = {}) {
  let total = 0;
  for (const { rule, item } of rulesOfType(defender, 'Defense', 'self')) {
    if (isStatic(rule.when) || (rule.defense != 'any' && rule.defense != defenseType)) {
      continue;
    }

    const answer = evaluate(rule.when, contextFor({ ...ctx, ...rollFacts(ctx.item, ctx), defenseType, self: defender, ruleItem: item, other: attacker }));
    if (answer === true) {
      total += Math.round(resolveValue(rule.amount, { actor: defender, item }));
    }
  }

  for (const value of callCodeHelpers(defender, 'defenseAdjust', attacker, defender, defenseType, ctx)) {
    total += Number(value) || 0;
  }

  return total;
}

function applyOp(current, op, value) {
  const base = Number(current) || 0;
  switch (op) {
  case 'set': return value;
  case 'multiply': return base * value;
  case 'max': return Math.max(base, value);
  case 'min': return Math.min(base, value);
  }

  return base + value;
}

/** Set a number at a path, and note an addition on a sibling `.string` breakdown when there is one. */
function writeNumber(target, path, op, value, label) {
  const getProperty = globalThis.foundry?.utils?.getProperty ?? ((object, key) => key.split('.').reduce((o, k) => o?.[k], object));
  const setProperty = globalThis.foundry?.utils?.setProperty ?? ((object, key, v) => {
    const keys = key.split('.');
    const last = keys.pop();
    const parent = keys.reduce((o, k) => (o[k] ??= {}), object);
    parent[last] = v;
  });
  const current = getProperty(target, path);
  if (current !== undefined && typeof current != 'number' && !Number.isFinite(Number(current))) {
    return;
  }

  setProperty(target, path, applyOp(current, op, value));
  const stringPath = path.replace(/\.(max|total|value)$/, '.string');
  if ((op ?? 'add') == 'add') {
    const breakdown = stringPath != path ? getProperty(target, stringPath) : undefined;
    if (typeof breakdown == 'string' && value) {
      setProperty(target, stringPath, `${breakdown} ${value < 0 ? '-' : '+'} ${Math.abs(value)} (${label})`);
    }
  }
}

/**
 * The derived-data pass: rebuild the rule index, then always-on Defenses and DerivedStat rules.
 * A DerivedStat or Defense whose condition depends on a roll doesn't belong here - a DerivedStat
 * with one is skipped (the validator says so), a Defense with one is applied per attack instead
 * (ruleDefenseAdjust).
 */
export function ruleDerived(actor) {
  rebuildIndex(actor);
  const staticCtx = item => contextFor({ self: actor, ruleItem: item });

  for (const { rule, item } of rulesOfType(actor, 'Defense', 'self')) {
    if (!isStatic(rule.when) || evaluate(rule.when, staticCtx(item)) !== true) {
      continue;
    }

    const amount = Math.round(resolveValue(rule.amount, { actor, item }));
    for (const key of rule.defense == 'any' ? DEFENSES : [rule.defense]) {
      addToDefense(actor.system?.defenses?.[key], amount, ruleLabel(rule, item));
    }
  }

  for (const { rule, item } of [...rulesOfType(actor, 'DerivedStat', 'self'), ...rulesOfType(actor, 'DerivedStat', 'host')]) {
    if (!isStatic(rule.when) || evaluate(rule.when, staticCtx(item)) !== true || !String(rule.path ?? '').startsWith('system.')) {
      continue;
    }

    const target = (rule.scope ?? 'self') == 'host' ? hostOf(item) : actor;
    if (!target) {
      continue;
    }

    writeNumber(target, rule.path, rule.op, resolveValue(rule.value, { actor, item }), ruleLabel(rule, item));
  }

  callCodeHelpers(actor, 'derived', actor);
}

/** Damage about to land on this actor: its own `taken` DamageModifiers. */
export function ruleDamageTaken(actor, amount, damageType) {
  let value = amount;
  for (const { rule, item } of rulesOfType(actor, 'DamageModifier', 'self')) {
    if (rule.direction != 'taken' || (rule.damageType && rule.damageType != damageType)) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) !== true) {
      continue;
    }

    if (rule.immune) {
      return 0;
    }

    value += Math.round(resolveValue(rule.amount, { actor, item }));
  }

  for (const { rule, item } of rulesOfType(actor, 'Code')) {
    const fn = ruleHelper(rule.helper)?.damageTaken;
    if (typeof fn == 'function') {
      try {
        const next = fn(actor, value, damageType, { rule, item });
        value = Number.isFinite(next) ? next : value;
      } catch (error) {
        console.error(`Essence20 | rule helper "${rule.helper}" failed in damageTaken`, error);
      }
    }
  }

  return Math.max(0, value);
}

/** A hit: the attacker's `dealt` DamageModifiers add to the damage, labelled on the card. */
export function ruleDamageDealt(actor, target, result, rider = {}, tools = {}) {
  callCodeHelpers(actor, 'hitRider', actor, target, result, rider, tools);
  if (!result?.damageValue || !tools.damageBonusNote) {
    return;
  }

  const item = rider.itemUuid ? globalThis.fromUuidSync?.(rider.itemUuid) ?? null : null;
  const damageType = result.damageType ?? rider.damageType;
  const roll = { item, rolledSkill: rider.skill, isAttack: true, isMelee: rider.style == 'melee' };
  for (const { rule, item: ruleItem } of [...rulesOfType(actor, 'DamageModifier', 'self'), ...rulesOfType(actor, 'DamageModifier', 'host')]) {
    if (rule.direction != 'dealt' || (rule.damageType && rule.damageType != damageType)) {
      continue;
    }

    if ((rule.scope ?? 'self') == 'host' && !hostMatches(ruleItem, item)) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ ...roll, self: actor, ruleItem, other: target })) !== true) {
      continue;
    }

    const amount = Math.round(resolveValue(rule.amount, { actor, item: ruleItem }));
    if (amount) {
      tools.damageBonusNote(result, amount, ruleLabel(rule, ruleItem));
    }
  }
}

/* -------------------------------------------- */
/*  Rerolls and pools                            */
/* -------------------------------------------- */

/** Reroll rules as reroll configs (helpers/reroll.mjs#getRerollConfigs). */
export function ruleRerollGrants(actor) {
  const configs = [];
  for (const { rule, item, index } of rulesOfType(actor, 'Reroll', 'self')) {
    if (!isStatic(rule.when) || evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) !== true) {
      continue;
    }

    const { type, label, when, scope, priority, disabled, stacks, ...settings } = rule;
    configs.push({
      ...settings,
      maxUses: settings.maxUses === undefined ? undefined : resolveValue(settings.maxUses, { actor, item }, 1),
      source: `${item.uuid ?? item.id}#rule${index}`,
      name: ruleLabel(rule, item),
    });
  }

  return configs;
}

/** A pool's maximum. */
export function poolMax(rule, actor, item) {
  return Math.max(0, Math.round(resolveValue(rule.max, { actor, item })));
}

/** The flag update that fills every Pool on these items whose reset matches. */
export function poolResets(actor, reset) {
  const updates = new Map();
  for (const { rule, item } of rulesOfType(actor, 'Pool', 'self')) {
    if (rule.reset != reset) {
      continue;
    }

    const update = updates.get(item.id) ?? { _id: item.id };
    update[`flags.essence20.rules.pools.${rule.key}.value`] = poolMax(rule, actor, item);
    updates.set(item.id, update);
  }

  return [...updates.values()];
}

async function resetPools(actor, reset) {
  const updates = poolResets(actor, reset);
  if (updates.length) {
    await actor.updateEmbeddedDocuments('Item', updates);
  }
}

async function resetAllPools(reset) {
  for (const actor of globalThis.game?.actors ?? []) {
    await resetPools(actor, reset);
  }
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

registerRollSources(ruleRollSources);
registerSpecializes(ruleSpecializes);
registerDialogToggles((actor, ctx) => ruleDialogSwitches(actor, ctx).map(({ entry, ...toggle }) => toggle));
registerApplyDialog(applyRuleSwitches);
registerPreRoll(async (actor, dataset, item) => {
  applySkillSubstitution(actor, dataset, item);
});
registerDefenseAdjust(ruleDefenseAdjust);
registerDerived(ruleDerived);
registerDamageModifier((actor, amount, damageType) => ruleDamageTaken(actor, amount, damageType));
registerHitRider(ruleDamageDealt);
registerRerollGrant(ruleRerollGrants);
registerSceneAdvanced(() => resetAllPools('scene'));
registerMissionAdvanced(() => resetAllPools('mission'));
registerRest(actor => resetPools(actor, 'rest'));
