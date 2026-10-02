import { formulaError } from "./formula.mjs";
import { unknownTags } from "./predicate.mjs";

/**
 * The rule type catalogue (docs/RULES_ENGINE_PLAN.md §4) - what each type takes, how it's checked
 * and how it reads in plain English. One table, several consumers: the validator
 * (scripts/check-rules.mjs and the Rules tab), the summaries, and later the guided editor.
 *
 * Phase 1 types only. A rule of any other type is kept as it is and shown as "not supported yet" -
 * never stripped, so data written by a newer version survives.
 *
 * Param kinds: 'formula' (a number or formula - rules/formula.mjs), 'bool', 'string', 'enum'
 * (`options`), 'strings' (an array of strings), 'object' and 'any' (checked by the type's own
 * validate, or by whatever reads it).
 *
 * Plain Node safe.
 */

const SHIFT_PARAMS = {
  upshift: { kind: 'formula' },
  downshift: { kind: 'formula' },
  edge: { kind: 'bool' },
  snag: { kind: 'bool' },
  specialize: { kind: 'bool' },
};

export const SCOPES = ['self', 'incoming', 'host'];

/** Every type's own params; label, when, scope, priority and disabled are common to all. */
export const RULE_TYPES = {
  RollModifier: {
    params: SHIFT_PARAMS,
    scopes: ['self', 'incoming', 'host'],
    validate: rule => (['upshift', 'downshift', 'edge', 'snag', 'specialize'].some(key => rule[key]) ? [] : ['changes nothing']),
  },
  DialogSwitch: {
    params: { ...SHIFT_PARAMS, default: { kind: 'bool' } },
    scopes: ['self', 'host'],
    validate: rule => (['upshift', 'downshift', 'edge', 'snag', 'specialize'].some(key => rule[key]) ? [] : ['changes nothing']),
  },
  // The same settings as a Perk's own system.reroll (data/reroll-schema.mjs), checked there - so
  // existing reroll data moves into a rule unchanged. helpers/reroll.mjs#normalizeRerollConfig
  // fills the defaults.
  Reroll: {
    params: Object.fromEntries(['mode', 'target', 'reset', 'maxUses', 'values', 'cost', 'condition', 'skills', 'essence',
      'scopeToOriginSkill', 'recursive', 'minDieFaces', 'grantsCanCritD2', 'bonus', 'shiftUp'].map(key => [key, { kind: 'any' }])),
    scopes: ['self'],
  },
  SkillSubstitution: {
    params: {
      from: { kind: 'string', required: true },
      to: { kind: 'string', required: true },
      mode: { kind: 'enum', options: ['replace', 'bestOf'] },
    },
    scopes: ['self', 'host'],
  },
  Defense: {
    params: {
      defense: { kind: 'enum', required: true, options: ['toughness', 'evasion', 'willpower', 'cleverness', 'any'] },
      amount: { kind: 'formula', required: true },
    },
    scopes: ['self'],
  },
  DerivedStat: {
    params: {
      path: { kind: 'string', required: true },
      op: { kind: 'enum', options: ['add', 'set', 'multiply', 'max', 'min'] },
      value: { kind: 'formula', required: true },
    },
    scopes: ['self', 'host'],
    validate: rule => (String(rule.path ?? '').startsWith('system.') ? [] : ['path must start with "system."']),
  },
  DamageModifier: {
    params: {
      direction: { kind: 'enum', required: true, options: ['dealt', 'taken'] },
      amount: { kind: 'formula' },
      damageType: { kind: 'string' },
      immune: { kind: 'bool' },
    },
    scopes: ['self', 'host'],
    validate: rule => (rule.amount || rule.immune ? [] : ['changes nothing']),
  },
  Grant: {
    params: {
      uuid: { kind: 'string', required: true },
      skipIfOwned: { kind: 'bool' },
    },
    scopes: ['self'],
    validate: rule => (/^Compendium\.|^Item\./.test(String(rule.uuid ?? '')) ? [] : ['uuid must be an Item or Compendium uuid']),
  },
  Toggle: {
    params: { key: { kind: 'string', required: true }, default: { kind: 'bool' } },
    scopes: ['self'],
  },
  Pool: {
    params: {
      key: { kind: 'string', required: true },
      max: { kind: 'formula', required: true },
      reset: { kind: 'enum', options: ['none', 'scene', 'mission', 'rest'] },
    },
    scopes: ['self'],
  },
  ChoiceSet: {
    params: {
      key: { kind: 'string', required: true },
      from: { kind: 'enum', required: true, options: ['skill', 'essence', 'defense', 'list'] },
      options: { kind: 'object' },
    },
    scopes: ['self'],
    validate: rule => (rule.from != 'list' || (Array.isArray(rule.options) && rule.options.length) ? [] : ['a list choice needs options']),
  },
  Code: {
    params: { helper: { kind: 'string', required: true } },
    scopes: ['self'],
  },
};

const COMMON = ['type', 'label', 'when', 'scope', 'priority', 'disabled', 'stacks'];

/**
 * Everything wrong with one rule.
 * @param {Object} rule
 * @returns {Array<String>}   Empty when the rule is fine. An unsupported type is one message.
 */
export function validateRule(rule) {
  if (!rule || typeof rule != 'object' || Array.isArray(rule)) {
    return ['not a rule object'];
  }

  const definition = RULE_TYPES[rule.type];
  if (!definition) {
    return [`type "${rule.type ?? ''}" is not supported yet`];
  }

  const errors = [];
  if (rule.when !== undefined && !Array.isArray(rule.when)) {
    errors.push('when must be a list');
  }

  for (const tag of unknownTags(rule.when)) {
    errors.push(`unknown tag "${tag}"`);
  }

  if (rule.stacks !== undefined && typeof rule.stacks != 'boolean') {
    errors.push('stacks must be true or false');
  }

  if (rule.scope !== undefined && !definition.scopes.includes(rule.scope)) {
    errors.push(`scope "${rule.scope}" can't be used with ${rule.type}`);
  }

  for (const [key, param] of Object.entries(definition.params)) {
    const value = rule[key];
    if (value === undefined || value === null || value === '') {
      if (param.required) {
        errors.push(`${key} is required`);
      }

      continue;
    }

    if (param.kind == 'formula') {
      const error = formulaError(value);
      if (error) {
        errors.push(`${key}: ${error}`);
      }
    } else if (param.kind == 'bool' && typeof value != 'boolean') {
      errors.push(`${key} must be true or false`);
    } else if (param.kind == 'enum' && !param.options.includes(value)) {
      errors.push(`${key} must be one of ${param.options.join(', ')}`);
    } else if (param.kind == 'strings' && !(Array.isArray(value) && value.every(v => typeof v == 'string'))) {
      errors.push(`${key} must be a list of names`);
    } else if (param.kind == 'string' && typeof value != 'string') {
      errors.push(`${key} must be text`);
    }
  }

  // A Code rule may carry any settings of its own - its helper reads them.
  for (const key of rule.type == 'Code' ? [] : Object.keys(rule)) {
    if (!COMMON.includes(key) && !definition.params[key]) {
      errors.push(`unknown setting "${key}"`);
    }
  }

  errors.push(...(definition.validate?.(rule) ?? []));
  return errors;
}

/* -------------------------------------------- */
/*  Plain-English summaries                      */
/* -------------------------------------------- */

const loc = key => {
  const text = globalThis.game?.i18n?.localize?.(key);
  return text && text != key ? text : null;
};

/** A localized word, or the fallback when there's no game (tests, the CI script). */
const word = (key, fallback) => loc(key) ?? fallback;

function skillName(key) {
  return word(globalThis.CONFIG?.E20?.skills?.[key] ?? `E20.Skill${key}`, key);
}

function shiftPhrase(rule) {
  const parts = [];
  const number = value => (typeof value == 'number' ? value : `(${value})`);
  if (rule.upshift) {
    parts.push(`↑${number(rule.upshift)}`);
  }

  if (rule.downshift) {
    parts.push(`↓${number(rule.downshift)}`);
  }

  if (rule.edge) {
    parts.push('Edge');
  }

  if (rule.snag) {
    parts.push('Snag');
  }

  if (rule.specialize) {
    parts.push('Specialized');
  }

  return parts.join(', ');
}

/** "while Morphed, on Might tests" - the `when` read out. */
export function describeWhen(when) {
  const parts = [];
  for (const entry of Array.isArray(when) ? when : []) {
    if (entry && typeof entry == 'object' && Array.isArray(entry.any)) {
      parts.push(`(${entry.any.map(inner => describeWhen([inner])).join(' or ')})`);
      continue;
    }

    const text = String(entry ?? '');
    const negated = text.startsWith('not:');
    const tag = negated ? text.slice(4) : text;
    const [family, ...rest] = tag.split(':');
    const arg = rest.join(':');
    let phrase;
    switch (family) {
    case 'skill': phrase = `on ${skillName(arg)} tests`; break;
    case 'essence': phrase = `on ${arg} tests`; break;
    case 'attack': phrase = arg ? `on ${arg} attacks` : 'on attacks'; break;
    case 'defense': phrase = `against ${arg}`; break;
    case 'self': phrase = arg == 'morphed' ? 'while Morphed' : arg == 'transformed' ? 'while in Alt Mode' : `while ${arg.replace(':', ' ')}`; break;
    case 'target': phrase = `when the target is ${arg.replace(':', ' ')}`; break;
    case 'item': phrase = `with ${arg.replace(':', ' ')}`; break;
    case 'combat': phrase = 'in combat'; break;
    case 'ownTurn': phrase = 'on your turn'; break;
    case 'ask': phrase = `when ${arg}`; break;
    default: phrase = tag;
    }

    parts.push(negated ? `not ${phrase}` : phrase);
  }

  return parts.join(', ');
}

/**
 * One line for the Rules tab: "↑1 on Might tests, while Morphed".
 * @param {Object} rule
 * @returns {String}
 */
export function summarizeRule(rule) {
  if (!rule || typeof rule != 'object') {
    return '';
  }

  const when = describeWhen(rule.when);
  const tail = when ? ` ${when}` : '';
  const who = rule.scope == 'incoming' ? 'Rolls against you: ' : rule.scope == 'host' ? 'Attached item: ' : '';
  switch (rule.type) {
  case 'RollModifier': return `${who}${shiftPhrase(rule)}${tail}`;
  case 'DialogSwitch': return `Roll option "${rule.label ?? ''}": ${shiftPhrase(rule)}${tail}`;
  case 'Reroll': return `Reroll (${rule.mode ?? 'all'})${rule.skills?.length ? ` on ${rule.skills.map(skillName).join(', ')}` : ''}${rule.reset && rule.reset != 'none' ? `, once per ${rule.reset}` : ''}`;
  case 'SkillSubstitution': return `${rule.mode == 'bestOf' ? 'Better of' : 'Use'} ${skillName(rule.to)} ${rule.mode == 'bestOf' ? 'and' : 'for'} ${skillName(rule.from)}${tail}`;
  case 'Defense': return `${signed(rule.amount)} ${rule.defense == 'any' ? 'every Defense' : word(`E20.Defense${capital(rule.defense)}`, capital(rule.defense))}${tail}`;
  case 'DerivedStat': return `${rule.op ?? 'add'} ${rule.value} → ${rule.path}${tail}`;
  case 'DamageModifier': return `${rule.immune ? 'Immune to' : `${signed(rule.amount)}`} ${rule.damageType ? `${rule.damageType} ` : ''}damage ${rule.direction == 'dealt' ? 'dealt' : 'taken'}${tail}`;
  case 'Grant': return `Grants ${rule.label ?? rule.uuid}`;
  case 'Toggle': return `Toggle: ${rule.label ?? rule.key}`;
  case 'Pool': return `Pool: ${rule.label ?? rule.key} (max ${rule.max}${rule.reset && rule.reset != 'none' ? `, resets each ${rule.reset}` : ''})`;
  case 'ChoiceSet': return `Choice: ${rule.label ?? rule.key} (${rule.from})`;
  case 'Code': return `Runs ${rule.helper}`;
  }

  return `${rule.type ?? 'Rule'} (not supported yet)`;
}

const capital = text => String(text ?? '').charAt(0).toUpperCase() + String(text ?? '').slice(1);

function signed(value) {
  if (typeof value == 'number') {
    return value < 0 ? `${value}` : `+${value}`;
  }

  return value ? `+(${value})` : '+0';
}
