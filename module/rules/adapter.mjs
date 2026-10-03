import {
  registerApplyDialog, registerConsumer, registerDamageModifier, registerDefenseAdjust, registerDerived, registerDialogToggles, registerHitRider,
  registerMissionAdvanced, registerPreRoll, registerRerollGrant, registerRest, registerRollSources, registerSceneAdvanced,
  registerSpecializes,
} from "../helpers/extensions.mjs";
import { bankedSources, bankedSpecializes, consumeBanked } from "./bank.mjs";
import { recordUse, usesLeft } from "./limits.mjs";
import { ruleHelper } from "./code.mjs";
import { resolveValue } from "./formula.mjs";
import { hostOf, rebuildIndex, ruleId, ruleLabel, rulesOfType } from "./index.mjs";
import { contextFor, evaluate, interpolate, isStatic } from "./predicate.mjs";
import { canAfford, readResource } from "./steps.mjs";
import { linkedEntries } from "./links.mjs";

/**
 * The rules of a type that change this actor: its own (in the given scopes) and any reaching it from
 * a linked actor (rules/links.mjs). Each carries `holder` - the actor whose item it is - which is what
 * its formulas read.
 */
function affecting(actor, type, scopes = ['self']) {
  const own = scopes.flatMap(scope => rulesOfType(actor, type, scope)).map(entry => ({ ...entry, holder: actor }));
  return [...own, ...linkedEntries(actor, type)];
}

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
  const first = targets?.first?.() ?? (typeof targets?.[Symbol.iterator] == 'function' ? [...targets][0] : null);
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
    for (const entry of affecting(actor, type, ['self', 'host'])) {
      if ((entry.rule.scope ?? 'self') == 'host' && !hostMatches(entry.item, roll.item)) {
        continue;
      }

      const ctx = contextFor({ ...facts, self: actor, ruleItem: entry.item, other: target });
      // A modifier with a limit stops applying once its uses are spent (spent when a roll takes it).
      const spent = entry.rule.limit?.per && usesLeft(entry.holder, entry.rule, entry.item, entry.index) <= 0;
      out.push({ ...entry, owner: entry.holder, answer: spent ? false : evaluate(entry.rule.when, ctx) });
    }

    if (target && type == 'RollModifier') {
      for (const entry of rulesOfType(target, type, 'incoming')) {
        const ctx = contextFor({ ...facts, self: target, ruleItem: entry.item, other: actor });
        // The same limit check as the roller's own rules - counted on the defender who holds it.
        const spent = entry.rule.limit?.per && usesLeft(target, entry.rule, entry.item, entry.index) <= 0;
        out.push({ ...entry, owner: target, answer: spent ? false : evaluate(entry.rule.when, ctx) });
      }
    }
  }

  return out;
}

/** A RollModifier/DialogSwitch's shifts, resolved against its own actor and item. */
export function shiftsOf(rule, owner, item, vars = undefined, other = null) {
  // vars: {spent} for a switch that spends an amount (@spent); other: the roll's target (@target.*).
  const scope = { actor: owner, item, vars, other };
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

/**
 * Only the strongest rule of each stacking group counts (`stack: "armor"`) - the sum of its shifts,
 * with Edge worth one. Rules with no group all count.
 */
export function strongestPerGroup(entries, strength) {
  const best = new Map();
  const out = [];
  for (const entry of entries) {
    const group = entry.rule.stack;
    if (!group) {
      out.push(entry);
      continue;
    }

    const current = best.get(group);
    if (!current || strength(entry) > strength(current)) {
      best.set(group, entry);
    }
  }

  return [...out, ...best.values()];
}

const shiftStrength = ({ rule, owner, item, other }) => {
  const s = shiftsOf(rule, owner, item, undefined, other);
  return s.shiftUp - s.shiftDown + (s.edge ? 1 : 0) - (s.snag ? 1 : 0);
};

/** Automatic modifiers, listed with their source in the Roll Options Dialog. */
export function ruleRollSources(actor, target, ctx = {}) {
  const sources = [];
  const live = rollRules(actor, target, ctx).filter(entry => entry.answer === true);
  const consumes = [];
  for (const { rule, item, index, owner } of strongestPerGroup(live.map(entry => ({ ...entry, other: target })), shiftStrength)) {
    if (rule.limit?.per) {
      consumes.push({ ext: 'rulesLimit', actorUuid: owner.uuid, itemId: item.id, index });
    }

    const shifts = shiftsOf(rule, owner, item, undefined, target);
    if (!shifts.shiftUp && !shifts.shiftDown && !shifts.edge && !shifts.snag) {
      continue;
    }

    sources.push({ id: ruleId(item, index), label: ruleLabel(rule, item), ...shifts });
  }

  for (const result of callCodeHelpers(actor, 'rollSources', actor, target, ctx)) {
    sources.push(...(result?.sources ?? []));
  }

  // Bonuses a Use or Trigger banked for a later roll (rules/bank.mjs), used up when the roll is made.
  const banked = bankedSources(actor, target, { ...ctx, ...rollFacts(ctx.item, ctx) });
  sources.push(...banked.sources);
  return { sources, consumes: [...consumes, ...banked.consumes] };
}

/**
 * Immunity (`immune: ["snag", "downshift"]`): once the dialog closes, a RollModifier whose condition
 * holds clears the Snag or the downshifts from the roll - after everything else has added them.
 */
export function applyRuleImmunity(actor, options, ctx = {}) {
  const kinds = new Set();
  let ignore = 0;
  for (const { rule, answer, owner, item } of rollRules(actor, firstTarget(), ctx)) {
    if (answer === true) {
      ignore += Math.max(0, Math.round(resolveValue(rule.ignoreDownshift ?? 0, { actor: owner, item })));
      for (const kind of rule.immune ?? []) {
        kinds.add(kind);
      }
    }
  }

  if (kinds.has('snag')) {
    options.snag = false;
  }

  if (kinds.has('downshift')) {
    options.shiftDown = 0;
  }

  // "Ignore the first ↓1" - a set number of downshifts off, never below none.
  if (ignore > 0) {
    options.shiftDown = Math.max(0, (Number(options.shiftDown) || 0) - ignore);
  }
}

/**
 * Whether a rule lifts the automatic untrained Snag on this Skill (immune: ["untrainedSnag"]) -
 * asked by helpers/roll-dialog.mjs#_isUntrainedSnag, before the dialog opens.
 */
/**
 * Whether a rule lifts the automatic long-range Snag on this ranged attack (immune: ["longRangeSnag"]) -
 * read where dice.mjs adds that Snag, so Nowhere to Run can still see that it is already ignored.
 */
export function ruleNoLongRangeSnag(actor, target, roll = {}) {
  return rollRules(actor, target, roll).some(({ rule, answer }) => answer === true && (rule.immune ?? []).includes('longRangeSnag'));
}

export function ruleNoUntrainedSnag(actor, skill) {
  return rollRules(actor, null, { rolledSkill: skill }).some(({ rule, answer }) => answer === true && (rule.immune ?? []).includes('untrainedSnag'));
}

/** A roll took a limited modifier: count the use against its rule's limit. */
export async function consumeLimited(consume, load = uuid => globalThis.fromUuid?.(uuid)) {
  const actor = await load(consume?.actorUuid);
  const item = actor?.items?.get?.(consume.itemId);
  const rule = item?.system?.rules?.[consume.index];
  if (rule) {
    await recordUse(actor, rule, item, consume.index);
  }
}

/** A RollModifier with `specialize` makes the roll count as Specialized. */
export function ruleSpecializes(actor, skill, item, dataset) {
  // dice.mjs hands over the Essence it settled on (Academic Studies and friends included) as
  // dataset.rolledEssence; otherwise fall back to the dataset's own or the Skill's usual one.
  const rolledEssence = dataset?.rolledEssence ?? dataset?.essence ?? globalThis.CONFIG?.E20?.skillToEssence?.[skill];
  const roll = { item, rolledSkill: skill, rolledEssence, dataset };
  const target = firstTarget();
  return rollRules(actor, target, roll).some(({ rule, answer }) => rule.specialize && answer === true) || bankedSpecializes(actor, target, roll);
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

    // "Roll <Skill> instead" only for a Skill the actor has, and not on that Skill's own roll.
    if (rule.useSkill && (!actor?.system?.skills?.[rule.useSkill] || rule.useSkill == ctx.rolledSkill)) {
      continue;
    }

    // A switch that spends an amount (spend: {resource, max}): a number box, 0 up to what can be paid.
    // With no resource it's a plain 0..max box (nothing is paid).
    if (rule.type == 'DialogSwitch' && (rule.spend?.resource || rule.spend?.max !== undefined)) {
      const have = rule.spend.resource ? readResource(rule.spend.resource, { actor: owner, item }) : Infinity;
      const max = Math.min(have, rule.spend.max === undefined ? Infinity : Math.round(resolveValue(rule.spend.max, { actor: owner, item }, 0)));
      if (max > 0) {
        switches.push({ name: ruleId(item, index), label: ruleLabel(rule, item), type: 'number', value: 0, max, entry: { rule, item, owner, index, max } });
      }

      continue;
    }

    // A switch that costs something is offered only when it can be paid, and never starts ticked.
    const cost = rule.type == 'DialogSwitch' ? rule.cost : null;
    if (cost?.resource && !canAfford(cost.resource, Math.round(resolveValue(cost.amount ?? 1, { actor: owner, item }, 1)), { actor: owner, item })) {
      continue;
    }

    switches.push({
      name: ruleId(item, index),
      label: ruleLabel(rule, item),
      type: 'checkbox',
      // A DialogSwitch starts at its own default; a RollModifier that has to ask starts off unless it
      // says `default: true`.
      // forget (or a limit): always starts at its default, like a plain one-roll checkbox.
      value: cost?.resource ? false : rule.forget || rule.limit ? !!rule.default : rememberedSwitch(actor, ruleId(item, index)) ?? !!rule.default,
      entry: { rule, item, owner, index },
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
  const on = [];
  for (const { name, value, entry } of ruleDialogSwitches(actor, ctx)) {
    // An amount to spend: on when above 0, never remembered.
    if (entry.rule.spend?.resource || entry.rule.spend?.max !== undefined) {
      const spent = Math.max(0, Math.min(entry.max, Math.round(Number(ticked[name]) || 0)));
      if (spent > 0) {
        on.push({ ...entry, spent });
      }

      continue;
    }

    if (!!ticked[name] != value) {
      remember[`flags.essence20.ruleSwitches.${name}`] = !!ticked[name];
    }

    if (ticked[name]) {
      on.push(entry);
      // "Instead of the normal benefits of Aim": the Aiming switch's bonus is not added (dice.mjs).
      if (entry.rule.replacesAim) {
        options.isAiming = false;
      }
    }
  }

  // Switches sharing a `stack` group are alternatives ("↑2 or ↑1"): of those ticked, only the
  // biggest change counts.
  for (const entry of strongestPerGroup(on, e => Math.abs(shiftStrength(e)))) {
    const shifts = shiftsOf(entry.rule, entry.owner, entry.item, entry.spent ? { spent: entry.spent } : undefined, firstTarget());
    options.shiftUp = (Number(options.shiftUp) || 0) + shifts.shiftUp;
    options.shiftDown = (Number(options.shiftDown) || 0) + shifts.shiftDown;
    options.edge ||= shifts.edge;
    options.snag ||= shifts.snag;
    options.isSpecialized ||= shifts.specialize;
    // clearSnag: the switch's Edge wins outright - the Snag goes, rather than the two cancelling.
    if (entry.rule.clearSnag) {
      options.snag = false;
    }
  }

  // "Roll <Skill> instead": the difference between the two Skills' dice, as shifts (the first ticked one).
  const swap = on.find(entry => entry.rule.useSkill);
  const rolledShift = ctx.baseShift ?? actor?.system?.skills?.[ctx.rolledSkill]?.shift;
  if (swap && rolledShift) {
    const list = globalThis.CONFIG?.E20?.skillShiftList ?? [];
    const from = list.indexOf(rolledShift);
    const to = list.indexOf(actor.system.skills[swap.rule.useSkill]?.shift);
    if (from >= 0 && to >= 0 && from != to) {
      options[from > to ? 'shiftUp' : 'shiftDown'] = (Number(options[from > to ? 'shiftUp' : 'shiftDown']) || 0) + Math.abs(from - to);
    }
  }

  // Ticked switches' damage joins the attack's own damage bonus (dice.mjs damageBonusValue).
  for (const entry of on) {
    const damage = entry.rule.type == 'DialogSwitch' && entry.rule.damage
      ? Math.round(resolveValue(entry.rule.damage, { actor: entry.owner, item: entry.item, vars: { spent: entry.spent ?? 0 } }, 0)) : 0;
    if (damage) {
      options.ruleDamage = (Number(options.ruleDamage) || 0) + damage;
      options.ruleDamageSources = [...(options.ruleDamageSources ?? []), ruleLabel(entry.rule, entry.item)];
    }
  }

  if (Object.keys(remember).length && actor?.isOwner && typeof actor.update == 'function') {
    await actor.update(remember);
  }

  // A ticked switch with a limit (once per round...) uses one up.
  for (const { rule, item, owner, index } of on) {
    if (rule.limit?.per && index !== undefined) {
      await recordUse(owner ?? actor, rule, item, index);
    }
  }

  // Amounts spent are paid now.
  for (const entry of on.filter(e => e.spent && e.rule.spend.resource)) {
    const { changeResource } = await import("./steps.mjs");
    await changeResource(entry.rule.spend.resource, -entry.spent, { actor: entry.owner ?? actor, item: entry.item, chat: [] });
  }

  // Ticked switches that cost something are paid now.
  for (const entry of on) {
    const cost = entry.rule.type == 'DialogSwitch' ? entry.rule.cost : null;
    if (cost?.resource) {
      const { changeResource } = await import("./steps.mjs");
      const amount = Math.round(resolveValue(cost.amount ?? 1, { actor: entry.owner, item: entry.item }, 1));
      await changeResource(cost.resource, -amount, { actor: entry.owner ?? actor, item: entry.item, chat: [] });
    }
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

  for (const { rule, item: ruleItem } of affecting(actor, 'SkillSubstitution', ['self', 'host'])) {
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
  for (const { rule, item, holder } of affecting(defender, 'Defense')) {
    if (isStatic(rule.when) || (rule.defense != 'any' && rule.defense != defenseType)) {
      continue;
    }

    const answer = evaluate(rule.when, contextFor({ ...ctx, ...rollFacts(ctx.item, ctx), defenseType, self: defender, ruleItem: item, other: attacker }));
    if (answer === true) {
      total += Math.round(resolveValue(rule.amount, { actor: holder, item }));
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
 * Critical Effects from CriticalOption rules (helpers/target-riders.mjs#critRiders): the options to
 * add, and how many steps to improve the damage ones by (the strongest per `stack` group).
 * @param {Actor} actor     The attacker.
 * @param {Actor} target
 * @param {Item} item       The weapon effect that scored the Critical Success.
 * @returns {{options: Object[], improve: Number, improvedBy: String[]}}
 */
export function ruleCriticalOptions(actor, target, item) {
  const facts = { item, isAttack: true, isMelee: item?.system?.classification?.style == 'melee' };
  const holding = rulesOfType(actor, 'CriticalOption', 'self')
    .filter(({ rule, item: ruleItem }) => evaluate(rule.when, contextFor({ ...facts, self: actor, other: target, ruleItem })) === true);
  const options = [];
  const improvers = [];
  for (const entry of holding) {
    const { rule, item: ruleItem } = entry;
    if (rule.improve !== undefined) {
      improvers.push(entry);
      continue;
    }

    options.push({
      key: `rule-${ruleItem.id}-${entry.index}`,
      label: ruleLabel(rule, ruleItem),
      damageValue: Math.max(0, Math.round(resolveValue(rule.damageValue ?? 1, { actor, item: ruleItem }, 1))),
      damageType: rule.essence || rule.status || rule.effect ? 'special' : rule.damageType,
      ...(rule.essence ? { essence: rule.essence } : {}),
      ...(rule.status ? { status: rule.status } : {}),
      ...(rule.effect ? { rider: rule.effect } : {}),
    });
  }

  const chosen = strongestPerGroup(improvers, e => resolveValue(e.rule.improve, { actor, item: e.item }, 0));
  return {
    options,
    improve: chosen.reduce((sum, e) => sum + Math.max(0, Math.round(resolveValue(e.rule.improve, { actor, item: e.item }, 0))), 0),
    improvedBy: chosen.map(e => ruleLabel(e.rule, e.item)),
  };
}

/** The rules of a type on this actor whose own condition holds (self tags only). */
function heldRules(actor, type) {
  return rulesOfType(actor, type, 'self').filter(({ rule, item }) => evaluate(rule.when, contextFor({ self: actor, ruleItem: item, combat: null })) === true);
}

/**
 * Traits WeaponTrait rules give this weapon (helpers/weapon-traits.mjs#perkGrantedTraits).
 * @param {Actor} actor
 * @param {Item} weapon
 * @param {String[]} traits   Its traits so far - `items` tags see these.
 * @returns {String[]}
 */
export function ruleWeaponTraits(actor, weapon, traits) {
  const seen = { ...weapon, name: weapon?.name, flags: weapon?.flags, parent: weapon?.parent, system: { ...(weapon?.system ?? {}), traits } };
  const out = [];
  for (const { rule, item } of heldRules(actor, 'WeaponTrait')) {
    if (!Array.isArray(rule.items) || !rule.items.length || evaluate(rule.items, contextFor({ self: actor, item: seen, ruleItem: item, combat: null })) === true) {
      out.push(...(rule.traits ?? []));
    }
  }

  return out;
}

/**
 * Hardpoints rules: {external, integrated, nonWeapon, perWeapon} to add. Read while the actor's
 * loadout is prepared, before the derived pass - so the index is rebuilt first.
 */
export function ruleHardpoints(actor) {
  rebuildIndex(actor);
  const out = { external: 0, integrated: 0, nonWeapon: 0, perWeapon: 0 };
  for (const { rule, item } of heldRules(actor, 'Hardpoints')) {
    for (const key of Object.keys(out)) {
      out[key] += Math.round(resolveValue(rule[key] ?? 0, { actor, item }, 0));
    }
  }

  return out;
}

/** Whether a Hardpoints rule makes this Integrated weapon fire as Reinforced. */
export function ruleFiresAsReinforced(actor, weapon) {
  return heldRules(actor, 'Hardpoints').some(({ rule, item }) => rule.reinforced
    && (!Array.isArray(rule.items) || !rule.items.length || evaluate(rule.items, contextFor({ self: actor, item: weapon, ruleItem: item, combat: null })) === true));
}

/**
 * AttackCount rules that apply to this attack: [{count?, additional?, label}] (helpers/action-perks.mjs
 * #getAttacksPerAction picks the best count and adds the additional ones).
 * @param {Actor} actor
 * @param {Item} item   The weapon effect being attacked with.
 */
export function ruleAttackCounts(actor, item) {
  const facts = { item, isAttack: true, isMelee: item?.system?.classification?.style == 'melee' };
  return affecting(actor, 'AttackCount')
    .filter(({ rule, item: ruleItem }) => evaluate(rule.when, contextFor({ ...facts, self: actor, ruleItem })) === true)
    .map(({ rule, item: ruleItem, holder }) => {
      const scope = { actor: holder, item: ruleItem };
      const when = Array.isArray(rule.when) && rule.when.length ? rule.when : null;
      return rule.additional !== undefined
        ? { additional: Math.max(0, Math.round(resolveValue(rule.additional, scope, 0))), label: ruleLabel(rule, ruleItem), when }
        : { count: Math.max(1, Math.round(resolveValue(rule.count, scope, 1))), label: ruleLabel(rule, ruleItem), when };
    });
}

/** Whether a CritOnD2 rule lets this roll critically succeed on the d2. */
export function ruleCritD2(actor, target, roll = {}) {
  return affecting(actor, 'CritOnD2', ['self', 'host']).some(({ rule, item }) => ((rule.scope ?? 'self') != 'host' || hostMatches(item, roll.item))
    && evaluate(rule.when, contextFor({ ...roll, ...rollFacts(roll.item, roll), self: actor, other: target, ruleItem: item })) === true);
}

/**
 * Cover rules on a ranged attack: the attacker's (ignore / reduce) and the target's (against: grant /
 * base / add). `when` sees the roll, with other = the other party.
 * @returns {{ignore: Boolean, reduce: Number, grant: Boolean, base: Number, add: Number}}
 */
export function ruleCover(actor, target, roll = {}) {
  const out = { ignore: false, reduce: 0, grant: false, base: 0, add: 0 };
  const facts = { ...roll, ...rollFacts(roll.item, roll) };
  for (const [holder, other, against] of [[actor, target, false], [target, actor, true]]) {
    if (!holder) {
      continue;
    }

    for (const { rule, item, holder: owner } of affecting(holder, 'Cover', ['self', 'host'])) {
      if (!!rule.against != against || ((rule.scope ?? 'self') == 'host' && (against || !hostMatches(item, roll.item)))) {
        continue;
      }

      if (evaluate(rule.when, contextFor({ ...facts, self: holder, other, ruleItem: item })) !== true) {
        continue;
      }

      const amount = Math.max(0, Math.round(resolveValue(rule.amount ?? 0, { actor: owner, item }, 0)));
      switch (rule.mode) {
      case 'ignore': out.ignore = true; break;
      case 'reduce': out.reduce = Math.max(out.reduce, amount); break;
      case 'grant': out.grant = true; break;
      case 'base': out.base = Math.max(out.base, amount); break;
      case 'add': out.add += amount; break;
      }
    }
  }

  return out;
}

/**
 * AimBonus rules on this ranged attack: the base Aim bonus is raised to atLeast and extra added; `spend`
 * is what to record (limits, toggles) once the shot is fired aimed.
 * @returns {{atLeast: Number, extra: Number, spend: Function}}
 */
export function ruleAimBonus(actor, target, roll = {}) {
  let atLeast = 0;
  let extra = 0;
  const used = [];
  for (const entry of affecting(actor, 'AimBonus', ['self', 'host'])) {
    const { rule, item, index, holder } = entry;
    if ((rule.scope ?? 'self') == 'host' && !hostMatches(item, roll.item)) {
      continue;
    }

    if (usesLeft(holder, rule, item, index) <= 0
      || evaluate(rule.when, contextFor({ ...roll, ...rollFacts(roll.item, roll), self: actor, other: target, ruleItem: item })) !== true) {
      continue;
    }

    const scope = { actor: holder, item };
    atLeast = Math.max(atLeast, Math.round(resolveValue(rule.atLeast ?? 0, scope, 0)));
    extra += Math.round(resolveValue(rule.extra ?? 0, scope, 0));
    used.push(entry);
  }

  const spend = async () => {
    for (const { rule, item, index, holder } of used) {
      if (rule.limit) {
        await recordUse(holder, rule, item, index);
      }

      if (rule.clearToggle) {
        await item.update?.({ [`flags.essence20.rules.toggles.${rule.clearToggle}`]: false });
      }
    }
  };

  return { atLeast, extra, spend };
}

/**
 * Assist rules between a helper and the ally they would Lend Assistance to, on one Skill: any refusal
 * (from either side), whether either side lifts the Skill-rank requirement, and the boosts to the help.
 * @returns {{refused: Boolean, anyRank: Boolean, anyRange: Boolean, self: Boolean, atLeast: Number, extra: Number, edge: Boolean}}
 */
export function ruleAssist(helper, ally, skill, essence = null) {
  const result = { refused: false, anyRank: false, anyRange: false, self: false, atLeast: 0, extra: 0, edge: false };
  const check = (holder, other, side) => {
    for (const { rule, item } of affecting(holder, 'Assist')) {
      if ((rule.side ?? 'give') != side
        || evaluate(rule.when, contextFor({ self: holder, other, ruleItem: item, rolledSkill: skill, rolledEssence: essence })) !== true) {
        continue;
      }

      result.refused ||= rule.effect == 'refuse';
      result.anyRank ||= rule.effect == 'anyRank';
      result.anyRange ||= rule.effect == 'anyRange';
      result.self ||= rule.effect == 'self';
      if (rule.effect == 'boost') {
        const scope = { actor: holder, item };
        result.atLeast = Math.max(result.atLeast, Math.round(resolveValue(rule.atLeast ?? 0, scope, 0)));
        result.extra += Math.round(resolveValue(rule.extra ?? 0, scope, 0));
        result.edge ||= !!rule.edge;
      }
    }
  };

  check(helper, ally, 'give');
  check(ally, helper, 'receive');
  return result;
}

/** Whether a ConditionImmunity rule keeps this Condition off the actor right now. */
export function ruleConditionImmune(actor, statusId) {
  return affecting(actor, 'ConditionImmunity').some(({ rule, item }) => (rule.conditions ?? []).includes(statusId)
    && evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === true);
}

const ACCESS_ORDER = ['unknown', 'none', 'trained', 'qualified'];

/**
 * Requisition access from Qualification rules: 'qualified', 'trained' or null for this item.
 * @param {Actor} actor
 * @param {Item} item   The item being requisitioned.
 */
export function ruleRequisitionAccess(actor, item) {
  let best = null;
  const effectiveAvailability = requisitionTier(actor, item);
  for (const { rule, item: ruleItem } of affecting(actor, 'Qualification')) {
    if (!Array.isArray(rule.items) || !rule.items.length || evaluate(rule.when, contextFor({ self: actor, ruleItem })) !== true) {
      continue;
    }

    if (evaluate(rule.items, contextFor({ self: actor, item, ruleItem, effectiveAvailability })) === true) {
      const access = rule.access ?? 'qualified';
      if (!best || ACCESS_ORDER.indexOf(access) > ACCESS_ORDER.indexOf(best)) {
        best = access;
      }
    }
  }

  return best;
}

/**
 * The Availability tier this actor requisitions the item at: its combined total, lowered by every
 * listener that leaves Qualified upgrades out (helpers/requisition.mjs#requisitionDif asks the same).
 */
export function requisitionTier(actor, item) {
  const out = { availability: item?.system?.totalAvailability ?? item?.system?.availability ?? 'standard' };
  globalThis.Hooks?.call?.('essence20.requisitionAvailability', actor, item, out);
  return out.availability;
}

/**
 * Whether a Qualification rule's `upgrades` covers this upgrade - an upgrade Item, or a weapon's
 * attached entry {uuid, name, availability}.
 */
export function ruleQualifiedUpgrade(actor, upgrade) {
  const probe = upgrade?.system ? upgrade : {
    name: upgrade?.name, uuid: upgrade?.uuid, type: 'upgrade', flags: { core: { sourceId: upgrade?.uuid } },
    system: { availability: upgrade?.availability },
  };
  return affecting(actor, 'Qualification').some(({ rule, item: ruleItem }) => Array.isArray(rule.upgrades) && rule.upgrades.length
    && evaluate(rule.when, contextFor({ self: actor, ruleItem })) === true
    && evaluate(rule.upgrades, contextFor({ self: actor, item: probe, ruleItem })) === true);
}

// helpers/requisition.mjs asks every listener, and keeps the widest answer.
globalThis.Hooks?.on?.('essence20.requisitionAccess', (actor, item, out) => {
  const access = ruleRequisitionAccess(actor, item);
  if (access && ACCESS_ORDER.indexOf(access) > ACCESS_ORDER.indexOf(out.access ?? 'unknown')) {
    out.access = access;
  }
});

/**
 * What MovementAction rules allow this actor right now: {ignoreRoughTerrain, pushFeet, pushUnlimited}.
 * Read when a token moves (helpers/rough-terrain.mjs, helpers/token-movement.mjs) - the index is
 * already current by then.
 */
export function ruleMovement(actor) {
  const out = { ignoreRoughTerrain: false, pushFeet: 0, pushUnlimited: false };
  for (const { rule, item, holder } of affecting(actor, 'MovementAction')) {
    if (evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) !== true) {
      continue;
    }

    out.ignoreRoughTerrain ||= !!rule.ignoreRoughTerrain;
    out.pushUnlimited ||= !!rule.pushUnlimited;
    out.pushFeet = Math.max(out.pushFeet, Math.round(resolveValue(rule.pushFeet ?? 0, { actor: holder, item })));
  }

  return out;
}

/**
 * Movement rules for documents/actor.mjs#_prepareMovement: a function (stage, type, value) => the
 * new value, or null when no rule applies - so the hand-written path is untouched without rules.
 * The index is rebuilt here (movement is prepared before the derived-data pass), and each rule's
 * condition is asked when it's applied, so it can read speeds set earlier.
 */
const MOVEMENT_OPS = ['set', 'multiply', 'add', 'max', 'min'];
export function ruleMovementStages(actor) {
  rebuildIndex(actor);
  const entries = affecting(actor, 'Movement', ['self', 'host']).filter(({ rule, item }) => (rule.scope ?? 'self') != 'host' || hostOf(item));
  if (!entries.length) {
    return () => null;
  }

  return (stage, type, value) => {
    let result = value;
    let changed = false;
    const live = entries.filter(({ rule }) => (rule.stage ?? 'final') == stage && (rule.movement == 'all' || rule.movement == type));
    for (const op of MOVEMENT_OPS) {
      for (const { rule, item, holder } of live) {
        if (rule.op != op || evaluate(rule.when, contextFor({ self: actor, ruleItem: item, movementType: type })) !== true) {
          continue;
        }

        const amount = resolveValue(rule.value, { actor: holder, item }, 0);
        result = { set: amount, multiply: result * amount, add: result + amount, max: Math.max(result, amount), min: Math.min(result, amount) }[op];
        changed = true;
      }
    }

    return changed ? Math.max(0, Math.round(result)) : null;
  };
}

/**
 * Vision from Sense rules (helpers/vision-grant.mjs#getBestVisionGrant): [{mode, range}] for every
 * one whose condition holds. Vision is prepared before the derived-data pass, so the index is
 * rebuilt here too - but only when some item on the actor (or a linked one) has rules.
 */
export function ruleSenses(actor) {
  rebuildIndex(actor);
  return affecting(actor, 'Sense')
    .filter(({ rule, item }) => evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === true)
    .map(({ rule, item, holder }) => ({ mode: rule.mode ?? 'darkvision', range: Math.max(0, Math.round(resolveValue(rule.range, { actor: holder, item }))) }))
    .filter(grant => grant.range > 0);
}

/**
 * How rules let a Surprised actor act (documents/actor.mjs#_prepareActions): the set of modes -
 * "normal", "move", "speedAsLevel" - whose conditions hold. Actions are prepared before the
 * derived-data pass rebuilds the index, so this rebuilds it - only asked while Surprised.
 */
export function ruleSurpriseModes(actor) {
  rebuildIndex(actor);
  const modes = new Set();
  for (const { rule, item } of affecting(actor, 'SurpriseExemption')) {
    if (evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === true) {
      modes.add(rule.mode ?? 'normal');
    }
  }

  return modes;
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

  const defenses = affecting(actor, 'Defense').filter(({ rule, item }) => isStatic(rule.when) && evaluate(rule.when, staticCtx(item)) === true);
  for (const { rule, item, holder } of strongestPerGroup(defenses, e => resolveValue(e.rule.amount, { actor: e.holder, item: e.item }))) {
    const amount = Math.round(resolveValue(rule.amount, { actor: holder, item }));
    for (const key of rule.defense == 'any' ? DEFENSES : [rule.defense]) {
      addToDefense(actor.system?.defenses?.[key], amount, ruleLabel(rule, item));
    }
  }

  for (const { rule, item, holder } of affecting(actor, 'DerivedStat', ['self', 'host'])) {
    if (!isStatic(rule.when) || evaluate(rule.when, staticCtx(item)) !== true || !String(rule.path ?? '').startsWith('system.')) {
      continue;
    }

    const target = (rule.scope ?? 'self') == 'host' ? hostOf(item) : actor;
    if (!target) {
      continue;
    }

    writeNumber(target, rule.path, rule.op, resolveValue(rule.value, { actor: holder, item }), ruleLabel(rule, item));
  }

  // ItemModifier: numbers on the actor's other items. Items prepare before their actor, so these
  // stand until the item is next prepared from its source.
  for (const { rule, item } of rulesOfType(actor, 'ItemModifier', 'self')) {
    if (!isStatic(rule.when) || evaluate(rule.when, staticCtx(item)) !== true || !Array.isArray(rule.items)) {
      continue;
    }

    const value = resolveValue(rule.value, { actor, item });
    for (const other of actor.items?.contents ?? [...(actor.items ?? [])]) {
      if (other !== item && evaluate(rule.items, contextFor({ self: actor, item: other, ruleItem: item })) === true) {
        writeNumber(other, rule.path, rule.op, value, ruleLabel(rule, item));
        // Derived only - listed like an upgrade's own changes (helpers/weapon-upgrades.mjs), so the
        // item sheet keeps editing the stored value rather than saving the changed one back.
        if (other.system && typeof other.system == 'object') {
          other.system.upgradeTouched = [...new Set([...(other.system.upgradeTouched ?? []), rule.path.slice(7)])];
        }
      }
    }
  }

  callCodeHelpers(actor, 'derived', actor);
}

/** Damage about to land on this actor: its own `taken` DamageModifiers. */
export function ruleDamageTaken(actor, amount, damageType) {
  let value = amount;
  for (const { rule, item, holder } of affecting(actor, 'DamageModifier')) {
    if (rule.direction != 'taken' || (rule.damageType && rule.damageType != damageType)) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) !== true) {
      continue;
    }

    if (rule.immune) {
      return 0;
    }

    value += Math.round(resolveValue(rule.amount, { actor: holder, item }));
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
  for (const { rule, item: ruleItem, holder } of affecting(actor, 'DamageModifier', ['self', 'host'])) {
    if (rule.direction != 'dealt' || rule.scaled || (rule.damageType && rule.damageType != damageType)) {
      continue;
    }

    if ((rule.scope ?? 'self') == 'host' && !hostMatches(ruleItem, item)) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ ...roll, self: actor, ruleItem, other: target })) !== true) {
      continue;
    }

    const amount = Math.round(resolveValue(rule.amount, { actor: holder, item: ruleItem }));
    if (amount) {
      tools.damageBonusNote(result, amount, ruleLabel(rule, ruleItem));
    }
  }
}

/**
 * The attacker's `scaled` dealt DamageModifiers, decided when the attack is rolled: they join the
 * attack's own damage bonus, so Degrees of Success multiply them like any other bonus damage.
 * @returns {{amount: Number, sources: String[]}}
 */
export function ruleScaledDamage(actor, target, roll = {}) {
  let amount = 0;
  const sources = [];
  const damageType = roll.item?.system?.damageType ?? null;
  for (const { rule, item: ruleItem, holder } of affecting(actor, 'DamageModifier', ['self', 'host'])) {
    if (rule.direction != 'dealt' || !rule.scaled || (rule.damageType && rule.damageType != damageType)) {
      continue;
    }

    if ((rule.scope ?? 'self') == 'host' && !hostMatches(ruleItem, roll.item)) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ ...roll, ...rollFacts(roll.item, roll), self: actor, holder, other: target, ruleItem })) !== true) {
      continue;
    }

    const value = Math.round(resolveValue(rule.amount, { actor: holder, item: ruleItem }));
    if (value) {
      amount += value;
      sources.push(ruleLabel(rule, ruleItem));
    }
  }

  return { amount, sources };
}

/* -------------------------------------------- */
/*  Rerolls and pools                            */
/* -------------------------------------------- */

/** Reroll rules as reroll configs (helpers/reroll.mjs#getRerollConfigs). */
const RULE_KEYS = ['type', 'label', 'when', 'scope', 'priority', 'disabled', 'stacks'];

export function ruleRerollGrants(actor) {
  const configs = [];
  for (const { rule, item, index } of rulesOfType(actor, 'Reroll', 'self')) {
    if (!isStatic(rule.when) || evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) !== true) {
      continue;
    }

    // The rule's own keys aren't reroll settings.
    const settings = Object.fromEntries(Object.entries(rule).filter(([key]) => !RULE_KEYS.includes(key)));
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
registerConsumer('rulesBank', consume => consumeBanked(consume));
registerConsumer('rulesLimit', consume => consumeLimited(consume));
registerSpecializes(ruleSpecializes);
registerDialogToggles((actor, ctx) => ruleDialogSwitches(actor, ctx).map(({ entry: _entry, ...toggle }) => toggle));
registerApplyDialog(applyRuleSwitches);
registerApplyDialog(applyRuleImmunity);
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
