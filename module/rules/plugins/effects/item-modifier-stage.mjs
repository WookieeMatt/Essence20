import { formulaError, resolveValue } from "../../formula.mjs";
import { isItemActive, ruleStacks, rulesOf } from "../../index.mjs";
import { rulesSourceOf } from "../../inherit.mjs";
import { contextFor, evaluate, interpolate } from "../../predicate.mjs";
import { RULE_TYPES } from "../../types.mjs";

/**
 * ItemModifier `stage: "item"` (round 15, systems - docs/rules-batches/slSystems15.md): the change is made inside the
 * changed item's OWN prepareDerivedData - where items/attacks/weapon-upgrades.mjs#applyToEffect / #applyToWeapon run,
 * before a weapon effect's Reach (totalReach) and a weapon's Load Out hands are worked out from it - instead of in the
 * actor's derived pass, which lands after both. The rule sits on the actor's item (an upgrade attached to a weapon:
 * `items: ["item:onHost"]` for its weapon's attacks, `["item:isHost"]` for the weapon itself; a Perk: any tags), and
 * it may write any kind of value:
 *
 *   op: set       `value` a number / formula, a text ("cone", "{choice.skill}" - an unmade pick changes nothing), true /
 *                 false, or an object of values ({contact: true, ...}) set as it is
 *   op: add | multiply | max | min    numbers, as the actor-pass ItemModifier (`@other.<path>` reads the item changed)
 *   op: step      move a value along a `ladder` by `value` steps (never past either end; a value not on the ladder
 *                 is left alone). `ladder: weaponSize` - integrated, sidearm, medium, long, heavy - and a weapon with
 *                 no hands of its own (system.hands) then takes its new size's (CONFIG.E20.weaponSizeHands).
 *
 * `slot` (weapon effects only) - where in applyToEffect: `start` (with the vehicle's own attack changes, first), `element`
 * (after the weapon's chosen Element / Elemental Projector), `end` (default - after every hand-written change). A
 * weapon has one slot. Within a slot rules apply by `priority` (lowest first), then in item order, each one's `items`
 * asked of the item as it stands then - so a later rule sees an earlier one's change, and of several `set`s on one
 * path the last applied wins. Every changed path is listed in the item's system.upgradeTouched (the item sheet keeps
 * editing the stored value). The actor pass (rules/adapter.mjs#ruleDerived) leaves these rules alone.
 */

export const LADDERS = {
  weaponSize: ['integrated', 'sidearm', 'medium', 'long', 'heavy'],
};

/** A set value that is a word ("cone", "finesse" - also "{choice.skill}" and what it fills to) rather than a formula. */
const isText = value => /^[A-Za-z][\w-]*$/.test(value) || /\{choice\.[\w-]+\}/.test(value);

const SLOTS = ['start', 'element', 'end'];
const OPS = ['add', 'set', 'multiply', 'max', 'min', 'step'];

{
  const definition = RULE_TYPES.ItemModifier;
  const inner = definition.validate;
  definition.params = {
    ...definition.params,
    // A number or formula; on stage item also text, true / false or an object (validate below).
    value: { kind: 'any', required: true },
    op: { kind: 'enum', options: OPS },
    stage: { kind: 'enum', options: ['item'] },
    slot: { kind: 'enum', options: SLOTS },
    ladder: { kind: 'enum', options: Object.keys(LADDERS) },
  };
  definition.validate = rule => {
    const errors = [...(inner?.(rule) ?? [])];
    if (rule.stage != 'item') {
      const error = formulaError(rule.value);
      if (error) {
        errors.push(`value: ${error}`);
      }

      for (const key of ['slot', 'ladder']) {
        if (rule[key] !== undefined) {
          errors.push(`${key} only goes with stage: item`);
        }
      }

      if (rule.op == 'step') {
        errors.push('op step only goes with stage: item');
      }

      return errors;
    }

    if (rule.op == 'step' && !rule.ladder) {
      errors.push('op step needs a ladder');
    }

    if (rule.ladder !== undefined && rule.op != 'step') {
      errors.push('ladder only goes with op: step');
    }

    if ((rule.op ?? 'add') != 'set' || typeof rule.value == 'number' || (typeof rule.value == 'string' && !isText(rule.value))) {
      const error = formulaError(rule.value);
      if (error) {
        errors.push(`value: ${error}`);
      }
    }

    return errors;
  };
}

function itemsOf(actor) {
  const items = actor?.items;
  return Array.isArray(items?.contents) ? items.contents : items && typeof items[Symbol.iterator] == 'function' ? [...items] : [];
}

/** The actor's live stage-item ItemModifier rules, by priority (fresh: items prepare before the actor's rule index). */
export function stageRules(actor) {
  const found = [];
  const seen = new Set();
  for (const item of itemsOf(actor)) {
    const rules = rulesOf(item);
    if (!rules.length || !isItemActive(item)) {
      continue;
    }

    rules.forEach((rule, index) => {
      if (rule?.type != 'ItemModifier' || rule.stage != 'item' || rule.disabled || !Array.isArray(rule.items)) {
        return;
      }

      // A second copy whose rule doesn't stack adds nothing (rules/index.mjs#collectRules).
      const source = ruleStacks(rule, item) ? null : rulesSourceOf(item);
      const key = source ? `${source}#${index}#${JSON.stringify(item.flags?.essence20?.rules?.choices ?? {})}` : null;
      if (key && seen.has(key)) {
        return;
      }

      if (key) {
        seen.add(key);
      }

      found.push({ rule, item, index });
    });
  }

  return found.sort((a, b) => (Number(a.rule.priority) || 0) - (Number(b.rule.priority) || 0));
}

const getPath = (object, path) => String(path).split('.').reduce((at, key) => (at === null || at === undefined ? at : at[key]), object);

function setPath(object, path, value) {
  const keys = String(path).split('.');
  const last = keys.pop();
  const parent = keys.reduce((at, key) => (at[key] && typeof at[key] == 'object' ? at[key] : (at[key] = {})), object);
  parent[last] = value;
}

/** What one rule writes at its path now, or undefined for "no change". */
function nextValue(rule, ruleItem, target, system, actor) {
  const path = rule.path.slice(7);
  const current = getPath(system, path);
  const op = rule.op ?? 'add';
  const scope = { actor, item: ruleItem, otherItem: target };
  if (op == 'set') {
    if (rule.value !== null && typeof rule.value == 'object') {
      return JSON.parse(JSON.stringify(rule.value));
    }

    if (typeof rule.value == 'boolean' || typeof rule.value == 'number') {
      return rule.value;
    }

    const text = interpolate(String(rule.value), ruleItem);
    if (text === null || text === '') {
      return undefined;
    }

    return isText(text) ? text : resolveValue(text, scope);
  }

  if (op == 'step') {
    const ladder = LADDERS[rule.ladder] ?? [];
    const at = ladder.indexOf(current);
    if (at < 0) {
      return undefined;
    }

    return ladder[Math.max(0, Math.min(ladder.length - 1, at + Math.round(resolveValue(rule.value, scope))))];
  }

  const value = resolveValue(rule.value, scope);
  const base = Number(current) || 0;
  switch (op) {
  case 'multiply': return base * value;
  case 'max': return Math.max(base, value);
  case 'min': return Math.min(base, value);
  }

  return base + value;
}

/**
 * Apply the actor's stage-item ItemModifiers to one item being prepared.
 * @param {Object} system   The item's system data (derived - changed in place).
 * @param {Item} target     The item.
 * @param {String} [slot]   start | element | end (a weapon effect); a weapon has one.
 * @param {Function} [set]  (path, value) - the caller's own writer, which keeps its own list of changed paths
 *   (applyToEffect's); without one the paths are added to system.upgradeTouched here.
 * @returns {String[]}      The paths (under system) it changed.
 */
export function applyItemStage(system, target, slot = 'end', set = null) {
  const actor = target?.parent;
  if (!actor || !system) {
    return [];
  }

  const touched = [];
  const isWeapon = target.type == 'weapon';
  for (const { rule, item } of stageRules(actor)) {
    if (item === target || (!isWeapon && (rule.slot ?? 'end') != slot) || !String(rule.path ?? '').startsWith('system.')) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) !== true
      || evaluate(rule.items, contextFor({ self: actor, item: target, ruleItem: item })) !== true) {
      continue;
    }

    const value = nextValue(rule, item, target, system, actor);
    const path = rule.path.slice(7);
    if (value === undefined || (typeof value != 'object' && getPath(system, path) === value)) {
      continue;
    }

    const writes = value && typeof value == 'object' ? Object.entries(value).map(([key, v]) => [`${path}.${key}`, v]) : [[path, value]];
    for (const [at, v] of writes) {
      if (set) {
        set(at, v);
      } else {
        setPath(system, at, v);
      }

      touched.push(at);
    }

    // A weapon with no hands of its own takes its new size's.
    if (rule.op == 'step' && rule.ladder == 'weaponSize' && isWeapon && (system.hands === null || system.hands === undefined)) {
      system.derivedHands = globalThis.CONFIG?.E20?.weaponSizeHands?.[value] ?? system.derivedHands;
    }
  }

  if (touched.length && !set) {
    system.upgradeTouched = [...new Set([...(system.upgradeTouched ?? []), ...touched])];
  }

  return touched;
}
