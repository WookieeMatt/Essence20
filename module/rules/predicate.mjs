import { creatureTagsOf } from "../helpers/creature-tags.mjs";

/**
 * The `when` condition language for item rules (docs/RULES_ENGINE_PLAN.md §5.1).
 *
 * A rule's `when` is a list of tags that must all hold. An entry can also be `{any: [...]}` (at
 * least one holds) or a string starting `not:` (the tag doesn't hold).
 *
 * Every tag answers one of three ways:
 *  - true / false - known;
 *  - null - unknown. An `ask:` tag is always unknown, and so is any tag this file doesn't know.
 *    An unknown condition is never guessed: the rule is offered as a Roll Options Dialog switch
 *    instead (rules/adapter.mjs), and the player decides.
 *
 * Evaluated against a context built by contextFor() - the same facts the roll pipeline already
 * hands the extension hooks (helpers/extensions.mjs), so nothing new is computed per roll.
 *
 * Plain Node safe: no Foundry globals at import time, so the CI validator and Jest can use TAGS.
 */

/** Tag families for the editor's picker and the validator. `param` is what follows the prefix. */
export const TAGS = {
  // The roll
  'skill': { family: 'roll', param: 'skill' },
  'essence': { family: 'roll', param: 'essence' },
  'attack': { family: 'roll', param: 'attackKind', optionalParam: true },
  'defense': { family: 'roll', param: 'defense' },
  'roll': { family: 'roll', param: 'rollKind' },
  // The item being used for the roll
  'item': { family: 'item', param: 'itemTag' },
  // The rule's own actor
  'self': { family: 'self', param: 'selfTag' },
  // The other side: the roll's target, or for an `incoming` rule, the roller
  'target': { family: 'target', param: 'targetTag' },
  // The situation
  'combat': { family: 'situation', optionalParam: true },
  'ownTurn': { family: 'situation' },
  'ask': { family: 'ask', param: 'text' },
};

/** Tags whose answer doesn't depend on the roll - safe to evaluate in derived data. */
export const STATIC_FAMILIES = ['self', 'situation'];

/**
 * Builds the evaluation context. Every field is optional; a tag whose fact is missing answers false
 * (for a fact that's simply absent, like no target) - never null, which is reserved for "can't know".
 * @param {Object} parts
 * @param {Actor} parts.self        The rule's own actor.
 * @param {Item} [parts.ruleItem]   The item carrying the rule.
 * @param {Actor} [parts.other]     The target (self scope) or the roller (incoming scope).
 * @param {Item} [parts.item]       The item the roll is made with.
 * @param {String} [parts.rolledSkill]
 * @param {String} [parts.rolledEssence]
 * @param {Boolean} [parts.isAttack]
 * @param {Boolean} [parts.isMelee]
 * @param {String} [parts.defenseType]
 * @param {Object} [parts.dataset]
 * @param {Object} [parts.combat]   game.combat, passed in so tests don't need globals.
 * @returns {Object}
 */
export function contextFor(parts = {}) {
  return { ...parts, combat: parts.combat === undefined ? globalThis.game?.combat ?? null : parts.combat };
}

const lower = value => String(value ?? '').toLowerCase();

function itemTraits(item) {
  const own = item?.system?.traits;
  const parent = item?.flags?.essence20?.parentId ? item.parent?.items?.get?.(item.flags.essence20.parentId) : null;
  return new Set([...(Array.isArray(own) ? own : []), ...(Array.isArray(parent?.system?.traits) ? parent.system.traits : [])].map(lower));
}

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? null;
}

function hasItem(actor, uuid) {
  const items = actor?.items?.contents ?? (actor?.items ? [...actor.items] : []);
  return items.some(item => sourceOf(item) == uuid || item.uuid == uuid);
}

function statusOf(actor, status) {
  return !!actor?.statuses?.has?.(status);
}

const isArea = item => !!(item?.system?.shape || Number(item?.system?.radius) > 0);

/** Compare `a op b` for "level>=5"-style tags. */
function compare(a, op, b) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return false;
  }

  return { '>=': x >= y, '<=': x <= y, '>': x > y, '<': x < y, '=': x == y }[op] ?? false;
}

/** Facts about an actor, shared by `self:` and `target:`. Returns undefined for an unknown tag. */
function actorTag(actor, ruleItem, rest) {
  const [key, ...more] = rest.split(':');
  const arg = more.join(':');
  if (!actor) {
    return false;
  }

  const level = /^level(>=|<=|>|<|=)(\d+)$/.exec(rest);
  if (level) {
    return compare(actor.system?.level, level[1], level[2]);
  }

  switch (key) {
  case 'morphed': return !!actor.system?.isMorphed;
  case 'transformed': return !!actor.system?.isTransformed;
  case 'status': return statusOf(actor, arg);
  case 'type': return actor.type == arg;
  case 'hasItem': return hasItem(actor, arg);
  case 'tag': return creatureTagsOf(actor).has(lower(arg));
  case 'hp<half': {
    const health = actor.system?.health;
    return !!health && Number(health.value) < Number(health.max) / 2;
  }
  case 'toggle': return !!toggleOf(ruleItem, arg);
  }

  return undefined;
}

/**
 * A toggle's state on the rule's item (flags.essence20.rules.toggles). Kept here, not in index.mjs,
 * so the predicate has no import loop.
 */
export function toggleOf(item, key) {
  return item?.flags?.essence20?.rules?.toggles?.[key] ?? null;
}

/**
 * `skill:{choice.skill}` - a ChoiceSet's pick on the rule's item, filled in. Null when the choice
 * hasn't been made yet, so the tag answers false rather than matching the literal braces.
 * @param {String} text
 * @param {Item} ruleItem
 * @returns {String|null}
 */
export function interpolate(text, ruleItem) {
  let missing = false;
  const filled = text.replace(/\{choice\.([\w-]+)\}/g, (match, key) => {
    const value = ruleItem?.flags?.essence20?.rules?.choices?.[key];
    if (value === undefined || value === null || value === '') {
      missing = true;
      return '';
    }

    return String(value);
  });

  return missing ? null : filled;
}

/**
 * One tag.
 * @param {String} tag
 * @param {Object} ctx   From contextFor().
 * @returns {Boolean|null}
 */
export function evaluateTag(tag, ctx) {
  const text = interpolate(String(tag ?? '').trim(), ctx.ruleItem);
  if (text === null) {
    return false;
  }

  if (!text) {
    return true;
  }

  if (text.startsWith('not:')) {
    const inner = evaluateTag(text.slice(4), ctx);
    return inner === null ? null : !inner;
  }

  const separator = text.indexOf(':');
  const family = separator < 0 ? text : text.slice(0, separator);
  const rest = separator < 0 ? '' : text.slice(separator + 1);
  const { item } = ctx;

  switch (family) {
  case 'skill': return ctx.rolledSkill == rest;
  case 'essence': return ctx.rolledEssence == rest;
  case 'defense': return (ctx.defenseType ?? item?.system?.defenseType) == rest;
  case 'attack':
    if (!ctx.isAttack) {
      return false;
    }

    switch (rest) {
    case '': return true;
    case 'melee': return !!ctx.isMelee;
    case 'ranged': return !ctx.isMelee;
    case 'area': return isArea(item);
    }

    return null;
  case 'roll':
    switch (rest) {
    case 'initiative': return ctx.rolledSkill == 'initiative' || !!ctx.dataset?.isInitiative;
    case 'specialized': return !!ctx.dataset?.isSpecialized;
    }

    return null;
  case 'item': {
    const [key, ...more] = rest.split(':');
    const arg = more.join(':');
    switch (key) {
    case 'type': return item?.type == arg;
    case 'trait': return itemTraits(item).has(lower(arg));
    case 'source': return sourceOf(item) == arg || item?.uuid == arg;
    case 'equipped': return ctx.ruleItem?.system?.equipped !== false;
    }

    return null;
  }
  case 'self': {
    const answer = actorTag(ctx.self, ctx.ruleItem, rest);
    return answer === undefined ? null : answer;
  }
  case 'target': {
    if (!ctx.other) {
      return false;
    }

    const answer = actorTag(ctx.other, null, rest);
    return answer === undefined ? null : answer;
  }
  case 'combat':
    if (!rest) {
      return !!ctx.combat?.started;
    }

    if (rest.startsWith('round:')) {
      return Number(ctx.combat?.round) == Number(rest.slice(6));
    }

    return null;
  case 'ownTurn': return !!ctx.combat?.started && ctx.combat.combatant?.actor?.id == ctx.self?.id;
  case 'ask': return null;
  }

  return null;
}

/**
 * A whole `when` list. Known-false anywhere wins over unknown; otherwise any unknown makes the whole
 * thing unknown.
 * @param {Array<String|Object>} when
 * @param {Object} ctx
 * @returns {Boolean|null}
 */
export function evaluate(when, ctx) {
  let unknown = false;
  for (const entry of Array.isArray(when) ? when : []) {
    let answer;
    if (entry && typeof entry == 'object' && Array.isArray(entry.any)) {
      const answers = entry.any.map(inner => evaluate([inner], ctx));
      answer = answers.some(a => a === true) ? true : answers.some(a => a === null) ? null : false;
    } else {
      answer = evaluateTag(entry, ctx);
    }

    if (answer === false) {
      return false;
    }

    if (answer === null) {
      unknown = true;
    }
  }

  return unknown ? null : true;
}

/** Whether every tag in a `when` can be answered without a roll (so it can apply in derived data). */
export function isStatic(when) {
  const flat = [];
  const walk = list => {
    for (const entry of Array.isArray(list) ? list : []) {
      if (entry && typeof entry == 'object' && Array.isArray(entry.any)) {
        walk(entry.any);
      } else {
        flat.push(String(entry ?? '').replace(/^not:/, ''));
      }
    }
  };

  walk(when);
  return flat.every(tag => STATIC_FAMILIES.includes(TAGS[tag.split(':')[0]]?.family) || tag == 'item:equipped');
}

/** Validator: the tags in a `when` this file doesn't recognise. */
export function unknownTags(when) {
  const bad = [];
  const walk = list => {
    for (const entry of Array.isArray(list) ? list : []) {
      if (entry && typeof entry == 'object') {
        if (Array.isArray(entry.any)) {
          walk(entry.any);
        } else {
          bad.push(JSON.stringify(entry));
        }

        continue;
      }

      const tag = String(entry ?? '').replace(/^not:/, '');
      if (!TAGS[tag.split(':')[0]]) {
        bad.push(tag);
      }
    }
  };

  walk(when);
  return bad;
}
