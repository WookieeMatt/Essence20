import { poolMax } from "./adapter.mjs";
import { rulesOf, ruleState } from "./index.mjs";
import { askChoice, choiceOptions } from "./lifecycle.mjs";
import { rulesAreInherited } from "./inherit.mjs";
import { ruleHelper } from "./code.mjs";
import { RULE_TYPES, summarizeRule, validateRule } from "./types.mjs";

/**
 * The item sheet's Rules tab (docs/RULES_ENGINE_PLAN.md §9) - a read-out of the item's rules in
 * plain English, their live state on an owned copy (toggles, pools, choices), and a JSON editor.
 * The guided editor comes in a later phase; this is the raw view it will sit beside.
 */

/** A starting rule of each type, for "Add rule" - valid enough to edit, never valid enough to do harm. */
export const SKELETONS = {
  RollModifier: { type: 'RollModifier', when: ['skill:athletics'], upshift: 1 },
  DialogSwitch: { type: 'DialogSwitch', label: 'Situational', upshift: 1 },
  Reroll: { type: 'Reroll', mode: 'ones', reset: 'scene', maxUses: 1 },
  SkillSubstitution: { type: 'SkillSubstitution', from: 'might', to: 'finesse' },
  Defense: { type: 'Defense', defense: 'toughness', amount: 1 },
  DerivedStat: { type: 'DerivedStat', path: 'system.health.max', op: 'add', value: 1 },
  DamageModifier: { type: 'DamageModifier', direction: 'taken', amount: -1 },
  Grant: { type: 'Grant', uuid: '' },
  Toggle: { type: 'Toggle', key: 'active', label: 'Active' },
  Pool: { type: 'Pool', key: 'uses', label: 'Uses', max: 1, reset: 'scene' },
  ChoiceSet: { type: 'ChoiceSet', key: 'skill', label: 'Skill', from: 'skill' },
  Code: { type: 'Code', helper: '' },
};

/**
 * The tab's context.
 * @param {Item} item
 * @returns {Object}
 */
export function rulesContext(item) {
  const actor = item.parent?.documentName == 'Actor' ? item.parent : null;
  const state = ruleState(item);
  const rules = rulesOf(item).map((rule, index) => {
    const entry = { rule, index, summary: summarizeRule(rule), errors: validateRule(rule) };
    if (rule?.type == 'Code' && rule.helper && !ruleHelper(rule.helper)) {
      entry.errors.push(`no helper named "${rule.helper}" is registered`);
    }

    if (rule?.type == 'Toggle' && rule.key) {
      entry.toggle = { value: !!(state.toggles?.[rule.key] ?? rule.default) };
    }

    if (rule?.type == 'Pool' && rule.key) {
      const max = poolMax(rule, actor, item);
      entry.pool = { value: state.pools?.[rule.key]?.value ?? max, max };
    }

    if (rule?.type == 'ChoiceSet' && rule.key) {
      const value = state.choices?.[rule.key];
      entry.choice = { value, label: choiceOptions(rule).find(option => option.value == value)?.label ?? (value ?? '') };
    }

    return entry;
  });

  return {
    rules,
    rulesOwned: !!actor && item.isOwner,
    rulesInherited: rulesAreInherited(item),
    rulesJson: JSON.stringify(rulesOf(item), null, 2),
    ruleTypes: Object.keys(RULE_TYPES),
  };
}

/**
 * Parse the JSON editor's text into a rules list.
 * @param {String} text
 * @returns {{rules: Array<Object>}|{error: String}}
 */
export function parseRulesJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? '').trim() || '[]');
  } catch (error) {
    return { error: error.message };
  }

  if (!Array.isArray(parsed)) {
    return { error: 'expected a list: [ ... ]' };
  }

  if (parsed.some(rule => !rule || typeof rule != 'object' || Array.isArray(rule))) {
    return { error: 'every rule must be an object: { "type": ... }' };
  }

  return { rules: parsed };
}

/* -------------------------------------------- */
/*  Actions                                      */
/* -------------------------------------------- */

export async function saveRulesJson(item, root) {
  const textarea = root.querySelector('[data-rules-json]');
  const errorSpan = root.querySelector('[data-rules-json-error]');
  const result = parseRulesJson(textarea?.value);
  if (result.error) {
    if (errorSpan) {
      errorSpan.textContent = result.error;
    }

    return false;
  }

  await item.update({ 'system.rules': result.rules });
  return true;
}

export async function addRule(item, type) {
  const skeleton = SKELETONS[type];
  if (!skeleton) {
    return;
  }

  await item.update({ 'system.rules': [...rulesOf(item), foundry.utils.deepClone(skeleton)] });
}

export async function deleteRule(item, index) {
  const rules = [...rulesOf(item)];
  if (index < 0 || index >= rules.length) {
    return;
  }

  rules.splice(index, 1);
  await item.update({ 'system.rules': rules });
}

export async function setToggle(item, key, value) {
  await item.update({ [`flags.essence20.rules.toggles.${key}`]: !!value });
}

export async function stepPool(item, key, delta) {
  const rule = rulesOf(item).find(r => r?.type == 'Pool' && r.key == key);
  if (!rule) {
    return;
  }

  const max = poolMax(rule, item.parent, item);
  const current = ruleState(item).pools?.[key]?.value ?? max;
  const value = Math.max(0, Math.min(max, current + delta));
  await item.update({ [`flags.essence20.rules.pools.${key}.value`]: value });
}

export async function changeChoice(item, index) {
  const rule = rulesOf(item)[index];
  if (rule?.type != 'ChoiceSet' || !rule.key) {
    return;
  }

  const value = await askChoice(rule, item);
  if (value !== null && value !== undefined) {
    await item.update({ [`flags.essence20.rules.choices.${rule.key}`]: value });
  }
}
