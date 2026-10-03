/**
 * Numeric values for item rules (docs/RULES_ENGINE_PLAN.md §5.2). Any numeric rule parameter may be
 * a number or a formula string such as "1 + floor(@level / 10)".
 *
 * A small whitelist parser - numbers, + - * /, parentheses, min/max/floor/ceil/abs, and references:
 *   @target.size        the roll's target's size place (also @target.level, @target.<path>); 0 with no target
 *   @size               the actor's size as a place in the size order (small 0, common 1, large 2 ... titanic 10)
 *   @level              the actor's level
 *   @essence.<key>      an Essence's current value (strength, speed, smarts, social)
 *   @pool.<key>         a Pool on the rule's item
 *   @choice.<key>       a ChoiceSet pick on the rule's item, when it's a number
 *   @skill.<key>.rank   a skill's trained rank: d20 (untrained) 0, d2 1, d4 2 ... d12 6, 2d8 7, 3d6 8
 *   @spent              what the last variable `spend` step in this run took
 *   @var.<key>          a value a step stored in this run
 *   @count.allies.<ft>  allied tokens within that many feet (also @count.enemies.<ft>); 0 off the canvas
 *   @actor.<path>       any number stored on the actor: @actor.system.movement.swim.total
 *   @item.<path>        any number stored on the rule's item
 *   @base.<path>        the effect a generated alternate copies (AlternateEffect formulas)
 * Never eval. Anything it can't read is 0, and the validator reports the formula.
 */

import { SKILL_RANKS, sideActorsWithin } from "./predicate.mjs";

const FUNCTIONS = { min: Math.min, max: Math.max, floor: Math.floor, ceil: Math.ceil, abs: Math.abs };

function tokenize(text) {
  const tokens = [];
  const pattern = /\s*(?:(\d+(?:\.\d+)?)|(@[A-Za-z][\w.]*)|([A-Za-z]+)|([-+*/(),]))/y;
  let index = 0;
  while (index < text.length) {
    pattern.lastIndex = index;
    const match = pattern.exec(text);
    if (!match) {
      if (/^\s*$/.test(text.slice(index))) {
        break;
      }

      throw new Error(`Unexpected "${text.slice(index, index + 8)}"`);
    }

    index = pattern.lastIndex;
    if (match[1] !== undefined) {
      tokens.push({ type: 'num', value: Number(match[1]) });
    } else if (match[2] !== undefined) {
      tokens.push({ type: 'ref', value: match[2].slice(1) });
    } else if (match[3] !== undefined) {
      tokens.push({ type: 'fn', value: match[3].toLowerCase() });
    } else {
      tokens.push({ type: 'op', value: match[4] });
    }
  }

  return tokens;
}

const REFS = ['level', 'essence', 'pool', 'choice', 'skill', 'spent', 'var', 'count', 'actor', 'item', 'base', 'size', 'target'];
const SIZE_ORDER = ['small', 'common', 'large', 'long', 'huge', 'extended', 'gigantic', 'extended2', 'towering', 'extended3', 'titanic'];

/** The value of one @reference. */
export function resolveRef(ref, scope = {}) {
  const [head, ...rest] = ref.split('.');
  const key = rest.join('.');
  const actor = scope.actor;
  const flags = scope.item?.flags?.essence20?.rules ?? {};
  switch (head) {
  case 'level': return Number(actor?.system?.level) || 0;
  // The actor's size as its place in the size order: small 0, common 1, large 2 ... titanic 10.
  case 'size': return Math.max(0, SIZE_ORDER.indexOf(actor?.system?.size ?? 'common'));
  // @target.size / @target.level / @target.<path>: the roll's target (scope.other), 0 when there is none.
  case 'target': {
    const other = scope.other;
    if (!other) {
      return 0;
    }

    if (key == 'size') {
      return Math.max(0, SIZE_ORDER.indexOf(other.system?.size ?? 'common'));
    }

    if (key == 'level') {
      return Number(other.system?.level) || 0;
    }

    return Number(rest.reduce((at, part) => (at === null || at === undefined ? at : at[part]), other)) || 0;
  }

  case 'essence': {
    const essence = actor?.system?.essences?.[key];
    return Number(typeof essence == 'object' ? essence?.value ?? essence?.max : essence) || 0;
  }

  case 'pool': return Number(flags.pools?.[key]?.value) || 0;
  case 'choice': return Number(flags.choices?.[key]) || 0;
  case 'skill': {
    const [skill, field] = rest;
    if (field != 'rank') {
      break;
    }

    return Math.max(0, SKILL_RANKS.indexOf(actor?.system?.skills?.[skill]?.shift ?? 'd20'));
  }

  case 'actor':
  case 'item': {
    const doc = head == 'actor' ? actor : scope.item;
    return Number(rest.reduce((at, part) => (at === null || at === undefined ? at : at[part]), doc)) || 0;
  }

  case 'base': return Number(rest.reduce((at, part) => (at === null || at === undefined ? at : at[part]), scope.base)) || 0;
  case 'spent': return Number(scope.vars?.spent) || 0;
  case 'var': return Number(scope.vars?.[key]) || 0;
  case 'count': {
    const [side, feet] = rest;
    if (!['allies', 'enemies'].includes(side) || !Number.isFinite(Number(feet))) {
      break;
    }

    return sideActorsWithin(actor, Number(feet), side == 'allies' ? 'ally' : 'enemy').length;
  }
  }

  throw new Error(`Unknown reference @${ref}`);
}

function parse(tokens, scope) {
  let position = 0;
  const peek = () => tokens[position];
  const next = () => tokens[position++];
  const expect = value => {
    const token = next();
    if (token?.value !== value) {
      throw new Error(`Expected "${value}"`);
    }
  };

  function primary() {
    const token = next();
    if (!token) {
      throw new Error('Unexpected end');
    }

    if (token.type == 'num') {
      return token.value;
    }

    if (token.type == 'ref') {
      return resolveRef(token.value, scope);
    }

    if (token.type == 'op' && token.value == '-') {
      return -primary();
    }

    if (token.type == 'op' && token.value == '(') {
      const value = sum();
      expect(')');
      return value;
    }

    if (token.type == 'fn' && FUNCTIONS[token.value]) {
      expect('(');
      const args = [sum()];
      while (peek()?.value == ',') {
        next();
        args.push(sum());
      }

      expect(')');
      return FUNCTIONS[token.value](...args);
    }

    throw new Error(`Unexpected "${token.value}"`);
  }

  function product() {
    let value = primary();
    while (['*', '/'].includes(peek()?.value)) {
      const op = next().value;
      const right = primary();
      value = op == '*' ? value * right : right == 0 ? 0 : value / right;
    }

    return value;
  }

  function sum() {
    let value = product();
    while (['+', '-'].includes(peek()?.value)) {
      const op = next().value;
      const right = product();
      value = op == '+' ? value + right : value - right;
    }

    return value;
  }

  const value = sum();
  if (position < tokens.length) {
    throw new Error(`Unexpected "${tokens[position].value}"`);
  }

  return value;
}

/**
 * A rule parameter's number.
 * @param {Number|String} value   A number, a numeric string, or a formula.
 * @param {Object} scope          {actor, item} - the rule's actor and item.
 * @param {Number} [fallback=0]
 * @returns {Number}
 */
export function resolveValue(value, scope = {}, fallback = 0) {
  if (typeof value == 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  try {
    const result = parse(tokenize(String(value)), scope);
    return Number.isFinite(result) ? result : fallback;
  } catch (error) {
    return fallback;
  }
}

/** Validator: a parse error message, or null. References are checked by name only. */
export function formulaError(value) {
  if (value === undefined || value === null || value === '' || typeof value == 'number') {
    return null;
  }

  try {
    const tokens = tokenize(String(value));
    for (const token of tokens) {
      if (token.type == 'ref' && !REFS.includes(token.value.split('.')[0])) {
        return `Unknown reference @${token.value}`;
      }

      if (token.type == 'fn' && !FUNCTIONS[token.value]) {
        return `Unknown function ${token.value}`;
      }
    }

    parse(tokens, { actor: { system: {} } });
    return null;
  } catch (error) {
    return error.message;
  }
}
