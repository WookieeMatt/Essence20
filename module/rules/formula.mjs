/**
 * Numeric values for item rules (docs/RULES_ENGINE_PLAN.md §5.2). Any numeric rule parameter may be
 * a number or a formula string such as "1 + floor(@level / 10)".
 *
 * A small whitelist parser - numbers, + - * /, parentheses, min/max/floor/ceil/abs, and references:
 *   @target.size        the roll's target's size place (also @target.level, @target.<path>); 0 with no target
 *   @size               the actor's size as a place in the size order (small 0, common 1, large 2 ... titanic 10)
 *   @level              the actor's level
 *   @essence.<key>      an Essence score (strength, speed, smarts, social): an NPC's or PC's max, a Zord's value
 *   @essence.<key>.current  what is left of it after Essence damage
 *   @pool.<key>         a Pool on the rule's item
 *   @choice.<key>       a ChoiceSet pick on the rule's item, when it's a number
 *   @skill.<key>.rank   a skill's trained rank: d20 (untrained) 0, d2 1, d4 2 ... d12 6, 2d8 7, 3d6 8
 *   @spent              what the last variable `spend` step in this run took
 *   @var.<key>          a value a step stored in this run
 *   @mark.<key>         the count on the actor's mark (a mark step with `count`); 0 unmarked or run out (also
 *                       @target.mark.<key> for the other party's)
 *   @count.allies.<ft>  allied tokens within that many feet (also @count.enemies.<ft>); 0 off the canvas
 *   @count.items.<type> the actor's items of a type (@count.equipped.<type>: equipped ones)
 *   @count.named.<text> the actor's items whose name contains the text (spaces as _)
 *   @sum.items.<type>.<path> / @sum.equipped.<type>.<path>  a number added up over those items
 *                       (@sum.equippedTrait.<trait>.<type>.<path>: equipped ones with that trait)
 *                       (@sum.equipped.armor.system.totalBonusToughness)
 * atLeast(count, faces, min) rolls dice and counts those showing min or more: atLeast(@var.spent, 4, 4).
 * dice(count, faces) rolls dice whose count is a formula: dice(@var.spent, 4).
 *   @actor.<path>       any number stored on the actor: @actor.system.movement.swim.total
 *   @item.<path>        any number stored on the rule's item
 *   @base.<path>        the effect a generated alternate copies (AlternateEffect formulas)
 *   @host.<path>        the item the rule's item is attached to (an upgrade's weapon or armor)
 *   @recipient.<path>   the actor a step is acting on right now (updateActor - each recipient's own value)
 * and dice: 1d2, 2d4, d6 - rolled each time the formula is worked out (scope.dice collects the rolls,
 * scope.random replaces Math.random in tests).
 * Never eval. Anything it can't read is 0, and the validator reports the formula.
 */

import { isExpired } from "./expiry.mjs";
import { SKILL_RANKS, sideActorsWithin } from "./predicate.mjs";

const FUNCTIONS = { min: Math.min, max: Math.max, floor: Math.floor, ceil: Math.ceil, abs: Math.abs };

function tokenize(text) {
  const tokens = [];
  const pattern = /\s*(?:(\d*)d(\d+)(?![\w.])|(\d+(?:\.\d+)?)|(@[A-Za-z][\w.]*)|([A-Za-z]+)|([-+*/(),]))/y;
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
    if (match[2] !== undefined) {
      tokens.push({ type: 'dice', count: Math.min(100, Number(match[1] || 1)), faces: Number(match[2]) });
    } else if (match[3] !== undefined) {
      tokens.push({ type: 'num', value: Number(match[3]) });
    } else if (match[4] !== undefined) {
      tokens.push({ type: 'ref', value: match[4].slice(1) });
    } else if (match[5] !== undefined) {
      tokens.push({ type: 'fn', value: match[5].toLowerCase() });
    } else {
      tokens.push({ type: 'op', value: match[6] });
    }
  }

  return tokens;
}

const REFS = ['level', 'essence', 'pool', 'choice', 'skill', 'spent', 'var', 'count', 'actor', 'item', 'base', 'size', 'target', 'mark', 'host', 'recipient', 'sum'];

const EXTRA_REFS = new Map();

/** Add an @reference family (module/rules/ext/*.mjs): `fn(key, scope, parts)` returns a number for @<head>.<key>. */
export function registerRef(head, fn) {
  if (!REFS.includes(head)) {
    REFS.push(head);
  }

  EXTRA_REFS.set(head, fn);
}

/** A mark's count (1 for a mark set without one), 0 when there's none or it ran out. */
function markCount(actor, key, setter = null) {
  // With a setter: that setter's own mark (perSetter, or the shared one when they set it); else the key's own mark.
  const marks = actor?.flags?.essence20?.ruleMarks ?? {};
  const mark = setter ? marks[`${key}--${setter.id}`] ?? (marks[key]?.by == setter.uuid ? marks[key] : null) : marks[key];
  if (!mark || isExpired(mark)) {
    return 0;
  }

  return Number.isFinite(Number(mark.count)) ? Number(mark.count) : 1;
}

const SIZE_ORDER = ['small', 'common', 'large', 'long', 'huge', 'extended', 'gigantic', 'extended2', 'towering', 'extended3', 'titanic'];

/** The value of one @reference. */
export function resolveRef(ref, scope = {}) {
  const [head, ...rest] = ref.split('.');
  const key = rest.join('.');
  const actor = scope.actor;
  const flags = scope.item?.flags?.essence20?.rules ?? {};
  if (EXTRA_REFS.has(head)) {
    return Number(EXTRA_REFS.get(head)(key, scope, rest)) || 0;
  }

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

    if (rest[0] == 'mark' && rest.length == 2) {
      return markCount(other, rest[1]);
    }

    // @target.myMark.<key> - the count on the mark this actor put on the target.
    if (rest[0] == 'myMark' && rest.length == 2) {
      return markCount(other, rest[1], actor);
    }

    return Number(rest.reduce((at, part) => (at === null || at === undefined ? at : at[part]), other)) || 0;
  }

  case 'essence': {
    // The score: a PC's / NPC's max (a Zord's or Vehicle's value - it has no max). .current reads what is left after
    // Essence damage. This used to read the current amount, so a damaged character's Essence-scaled rules shrank
    // (2026-10-07, mechanics/characters/creature-essences.mjs).
    const [name, field] = rest;
    const essence = actor?.system?.essences?.[name];
    if (typeof essence != 'object' || essence === null) {
      return Number(essence) || 0;
    }

    return Number(field == 'current' ? essence.value : essence.max ?? essence.value) || 0;
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

  // @sum.items.<type>.<path> / @sum.equipped.<type>.<path> - a number added up over the actor's items of that type.
  case 'sum': {
    // equippedTrait.<trait>.<type>.<path> - equipped items of the type that carry the trait.
    const traited = rest[0] == 'equippedTrait';
    const [which, type, ...path] = traited ? ['equipped', ...rest.slice(2)] : rest;
    const trait = traited ? String(rest[1] ?? '').toLowerCase() : null;
    if (!['items', 'equipped'].includes(which) || !type || !path.length) {
      break;
    }

    const items = actor?.items?.contents ?? (actor?.items ? [...actor.items] : []);
    const hasTrait = item => !trait || [...(item.system?.traits ?? []), ...(item.system?.itemAndUpgradeTraits ?? [])].map(t => String(t).toLowerCase()).includes(trait);
    return items.filter(item => item.type == type && (which == 'items' || item.system?.equipped) && hasTrait(item))
      .reduce((total, item) => total + (Number(path.reduce((at, part) => (at === null || at === undefined ? at : at[part]), item)) || 0), 0);
  }

  case 'recipient': return Number(rest.reduce((at, part) => (at === null || at === undefined ? at : at[part]), scope.recipient)) || 0;
  case 'host': {
    const parentId = scope.item?.flags?.essence20?.parentId;
    const host = parentId ? (scope.item.parent ?? scope.actor)?.items?.get?.(parentId) : null;
    return Number(rest.reduce((at, part) => (at === null || at === undefined ? at : at[part]), host)) || 0;
  }

  case 'base': return Number(rest.reduce((at, part) => (at === null || at === undefined ? at : at[part]), scope.base)) || 0;
  case 'mark': return markCount(actor, key);
  case 'spent': return Number(scope.vars?.spent) || 0;
  case 'var': return Number(scope.vars?.[key]) || 0;
  case 'count': {
    // @count.named.<text> - items whose name contains the text (underscores stand for spaces).
    if (rest[0] == 'named' && rest[1]) {
      const text = rest.slice(1).join('.').replace(/_/g, ' ').toLowerCase();
      const items = actor?.items?.contents ?? (actor?.items ? [...actor.items] : []);
      return items.filter(item => String(item.name ?? '').toLowerCase().includes(text)).length;
    }

    // @count.items.<type> / @count.equipped.<type> - how many items of a type the actor has (equipped ones).
    if (['items', 'equipped'].includes(rest[0]) && rest[1]) {
      const items = actor?.items?.contents ?? (actor?.items ? [...actor.items] : []);
      return items.filter(item => item.type == rest[1] && (rest[0] == 'items' || item.system?.equipped)).length;
    }

    const [side, feet] = rest;
    if (!['allies', 'enemies'].includes(side) || !Number.isFinite(Number(feet))) {
      break;
    }

    return sideActorsWithin(actor, Number(feet), side == 'allies' ? 'ally' : 'enemy').length;
  }
  }

  throw new Error(`Unknown reference @${ref}`);
}

/** NdM: the sum of N rolls of an M-sided die, noted in scope.dice. */
function rollDice(count, faces, scope) {
  if (!(faces >= 1) || !(count >= 1)) {
    throw new Error(`Bad dice ${count}d${faces}`);
  }

  const random = scope.random ?? Math.random;
  const results = Array.from({ length: count }, () => 1 + Math.floor(random() * faces));
  const total = results.reduce((a, b) => a + b, 0);
  scope.dice?.push?.({ formula: `${count}d${faces}`, results, total });
  scope.lastDice = results;
  return total;
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

    if (token.type == 'dice') {
      return rollDice(token.count, token.faces, scope);
    }

    if (token.type == 'op' && token.value == '-') {
      return -primary();
    }

    if (token.type == 'op' && token.value == '(') {
      const value = sum();
      expect(')');
      return value;
    }

    // atLeast(count, faces, min) - roll count dice and count those showing min or more (Fuel Efficient's 4s).
    if (token.type == 'fn' && token.value == 'atleast') {
      expect('(');
      const count = Math.max(0, Math.round(sum()));
      expect(',');
      const faces = Math.max(1, Math.round(sum()));
      expect(',');
      const min = Math.round(sum());
      expect(')');
      if (!count) {
        return 0;
      }

      rollDice(Math.min(100, count), faces, scope);
      return (scope.lastDice ?? []).filter(result => result >= min).length;
    }

    // dice(count, faces) - dice whose count (or size) is itself a formula: dice(@var.spent, 4).
    if (token.type == 'fn' && token.value == 'dice') {
      expect('(');
      const count = Math.max(0, Math.round(sum()));
      expect(',');
      const faces = Math.max(1, Math.round(sum()));
      expect(')');
      return count ? rollDice(Math.min(100, count), faces, scope) : 0;
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

      if (token.type == 'fn' && !FUNCTIONS[token.value] && !['dice', 'atleast'].includes(token.value)) {
        return `Unknown function ${token.value}`;
      }
    }

    parse(tokens, { actor: { system: {} } });
    return null;
  } catch (error) {
    return error.message;
  }
}
