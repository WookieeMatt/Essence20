import { poolMax } from "./adapter.mjs";
import { rulesOf, ruleState } from "./index.mjs";
import { askChoice, askRule, choiceLabel, choiceUpdate } from "./lifecycle.mjs";
import { queueAsk } from "./ask-queue.mjs";
import { sourceOf } from "../items/shared/item-lookups.mjs";
import { rulesAreInherited } from "./inherit.mjs";
import { ruleHelper } from "./code.mjs";
import { RULE_TYPES, summarizeRule, validateRule } from "./types.mjs";
import { describePrerequisite, prerequisitesOf, prerequisiteText } from "./prerequisites.mjs";
import { contextFor, evaluate } from "./predicate.mjs";

/**
 * "Acts as" (docs/RULES_ENGINE_PLAN.md §10, phase 5): an item with no compendium source of its own -
 * homebrew, or made in the world - can name a book item it stands in for. It then runs that item's
 * rules (rules/inherit.mjs) and every hard-coded behaviour keyed on that item's id, which falls back
 * to flags.essence20.rulesSource. A real copy already is its book item, so it isn't offered there.
 */
export function actsAsContext(item) {
  const own = item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource;
  if (own && !item?.flags?.essence20?.rulesSource) {
    return null;
  }

  const uuid = item?.flags?.essence20?.rulesSource ?? null;
  const name = uuid ? globalThis.fromUuidSync?.(uuid, { strict: false })?.name ?? uuid : null;
  return { uuid, name };
}

/**
 * The item's prerequisites for its sheet: each in plain words and, on a character's copy, whether
 * that character meets it ("met", "unmet", "ask"); "none" off a character.
 */
export function prerequisiteLines(item) {
  const actor = item.parent?.documentName == 'Actor' ? item.parent : null;
  const parentId = item.flags?.essence20?.parentId;
  const host = actor && parentId ? actor.items?.get?.(parentId) ?? null : null;
  return prerequisitesOf(item).map(entry => {
    const answer = actor ? evaluate([entry], contextFor({ self: actor, ruleItem: item, host, combat: null })) : undefined;
    return { words: describePrerequisite(entry), state: answer === undefined ? 'none' : answer === true ? 'met' : answer === false ? 'unmet' : 'ask' };
  });
}

/** The Rules tab's prerequisites block: the lines, plus an unmigrated item's old typed text when it has no tags. */
function prerequisitesContext(item) {
  const lines = prerequisiteLines(item);
  return { text: lines.length ? '' : prerequisiteText(item), lines };
}

/**
 * The item sheet's Rules tab (docs/RULES_ENGINE_PLAN.md §9) - everything the item does, in one list:
 * its Active Effects (always-on stat changes, shown as "Always on") and its rules, each in plain
 * English, with a rule's live state on an owned copy (toggles, pools, choices), and a JSON editor.
 * One Add button asks what the author wants in game words and makes the right kind - an Active Effect
 * for a flat stat change, a rule for anything with a condition, a button or a choice - so nobody has
 * to know there are two. The data stays two things: Active Effects are core Foundry documents the
 * system relies on for conditions, expiry and area effects.
 */

/** A starting rule of each type, for "Add rule" - valid enough to edit, never valid enough to do harm. */
export const SKELETONS = {
  RollModifier: { type: 'RollModifier', when: ['skill:athletics'], upshift: 1 },
  DialogSwitch: { type: 'DialogSwitch', label: 'Situational', upshift: 1 },
  Reroll: { type: 'Reroll', mode: 'ones', reset: 'scene', maxUses: 1 },
  SkillSubstitution: { type: 'SkillSubstitution', from: 'might', to: 'finesse' },
  Defense: { type: 'Defense', defense: 'toughness', amount: 1, when: ['self:morphed'] },
  DerivedStat: { type: 'DerivedStat', path: 'system.health.max', op: 'add', value: 1, when: ['self:morphed'] },
  DamageModifier: { type: 'DamageModifier', direction: 'taken', amount: -1 },
  Grant: { type: 'Grant', uuid: '' },
  Toggle: { type: 'Toggle', key: 'active', label: 'Active' },
  Pool: { type: 'Pool', key: 'uses', label: 'Uses', max: 1, reset: 'scene' },
  ChoiceSet: { type: 'ChoiceSet', key: 'skill', label: 'Skill', from: 'skill' },
  Code: { type: 'Code', helper: '' },
  ActionCost: { type: 'ActionCost', action: 'sprint', to: 'free', limit: { per: 'turn', max: 1 } },
  SurpriseExemption: { type: 'SurpriseExemption', mode: 'normal' },
  Sense: { type: 'Sense', mode: 'darkvision', range: 30 },
  MovementAction: { type: 'MovementAction', ignoreRoughTerrain: true },
  ConditionImmunity: { type: 'ConditionImmunity', conditions: ['frightened'] },
  Assist: { type: 'Assist', side: 'receive', effect: 'refuse' },
  AimBonus: { type: 'AimBonus', atLeast: 2 },
  CritOnD2: { type: 'CritOnD2', when: ['roll:edge'] },
  Cover: { type: 'Cover', mode: 'reduce', amount: 1 },
  DieSubstitution: { type: 'DieSubstitution', mode: 'best', skills: ['finesse'] },
  RollDice: { type: 'RollDice', thirdD20: true, when: ['roll:edge'] },
  DamageType: { type: 'DamageType', to: 'sharp', when: ['attack:unarmed'] },
  Movement: { type: 'Movement', movement: 'ground', op: 'add', value: 10 },
  AlternateEffect: { type: 'AlternateEffect', scope: 'host', key: 'stun', name: 'E20.DamageStun', changes: { damageType: 'stun' }, formulas: { damageValue: '@base.damageValue' } },
  AttackCount: { type: 'AttackCount', count: 2, when: ['weapon:trait:ballistic'] },
  WeaponTrait: { type: 'WeaponTrait', traits: ['wrecker'] },
  CriticalOption: { type: 'CriticalOption', damageValue: 2, damageType: 'stun', when: ['item:own'] },
  Hardpoints: { type: 'Hardpoints', integrated: 1 },
  Qualification: { type: 'Qualification', items: ['item:type:weapon', 'item:data:system.availability=standard'], access: 'qualified' },
  ItemModifier: { type: 'ItemModifier', items: ['item:type:weapon'], path: 'system.range.max', op: 'add', value: 10 },
  Use: { type: 'Use', label: 'Use', cost: { action: 'standard' }, limit: { per: 'scene', max: 1 }, steps: [{ do: 'chat', text: '{name} uses it.' }] },
  Trigger: { type: 'Trigger', event: 'turnStart', steps: [{ do: 'chat', text: 'Turn start for {name}.' }] },
  Reaction: { type: 'Reaction', label: 'React', who: 'target', outcome: 'hit', limit: { per: 'scene', max: 1 }, steps: [{ do: 'lowerTotal', amount: 2 }] },
};

/**
 * What "Add" offers, in game words, in this order. `effect` makes an Active Effect; every other key
 * is a rule type (SKELETONS). Labels and hints are i18n keys under E20.Rules.Add.
 */
export const ADD_CHOICES = [
  { key: 'effect', icon: 'fa-solid fa-sliders' },
  { key: 'Use', icon: 'fa-solid fa-hand-pointer' },
  { key: 'Trigger', icon: 'fa-solid fa-bolt' },
  { key: 'Reaction', icon: 'fa-solid fa-hand' },
  { key: 'RollModifier', icon: 'fa-solid fa-dice-d20' },
  { key: 'ActionCost', icon: 'fa-solid fa-person-running' },
  { key: 'Sense', icon: 'fa-solid fa-eye' },
  { key: 'MovementAction', icon: 'fa-solid fa-shoe-prints' },
  { key: 'ConditionImmunity', icon: 'fa-solid fa-shield-heart' },
  { key: 'Assist', icon: 'fa-solid fa-handshake-angle' },
  { key: 'AimBonus', icon: 'fa-solid fa-crosshairs' },
  { key: 'CritOnD2', icon: 'fa-solid fa-dice-two' },
  { key: 'Cover', icon: 'fa-solid fa-shield-halved' },
  { key: 'DieSubstitution', icon: 'fa-solid fa-dice-d20' },
  { key: 'RollDice', icon: 'fa-solid fa-dice' },
  { key: 'DamageType', icon: 'fa-solid fa-fire' },
  { key: 'Movement', icon: 'fa-solid fa-person-running' },
  { key: 'AlternateEffect', icon: 'fa-solid fa-code-branch' },
  { key: 'AttackCount', icon: 'fa-solid fa-burst' },
  { key: 'WeaponTrait', icon: 'fa-solid fa-tags' },
  { key: 'CriticalOption', icon: 'fa-solid fa-star' },
  { key: 'Hardpoints', icon: 'fa-solid fa-gears' },
  { key: 'Qualification', icon: 'fa-solid fa-id-card' },
  { key: 'ItemModifier', icon: 'fa-solid fa-screwdriver-wrench' },
  { key: 'SurpriseExemption', icon: 'fa-solid fa-person-rays' },
  { key: 'DialogSwitch', icon: 'fa-solid fa-toggle-on' },
  { key: 'Reroll', icon: 'fa-solid fa-rotate' },
  { key: 'SkillSubstitution', icon: 'fa-solid fa-right-left' },
  { key: 'Defense', icon: 'fa-solid fa-shield-halved' },
  { key: 'DerivedStat', icon: 'fa-solid fa-hashtag' },
  { key: 'DamageModifier', icon: 'fa-solid fa-burst' },
  { key: 'Grant', icon: 'fa-solid fa-gift' },
  { key: 'Toggle', icon: 'fa-solid fa-power-off' },
  { key: 'Pool', icon: 'fa-solid fa-battery-half' },
  { key: 'ChoiceSet', icon: 'fa-solid fa-list-check' },
  { key: 'Code', icon: 'fa-solid fa-code' },
];

/**
 * Ask what to add. Resolves to an ADD_CHOICES key, or null when the dialog is closed.
 * @returns {Promise<String|null>}
 */
export async function chooseAddKind() {
  const T = key => game.i18n.localize(`E20.Rules.Add.${key}`);
  // The Active Effect choice first, then a heading over every rule kind.
  const items = ADD_CHOICES.map(({ key, icon }) => `<li><button type="button" data-kind="${key}"><i class="${icon}"></i><span class="e20-rules-add-label">${T(`${key}.Label`)}</span><span class="e20-rules-add-hint">${T(`${key}.Hint`)}</span></button></li>`
    + (key == 'effect' ? `<li class="e20-rules-add-heading">${T('RulesHeading')}</li>` : '')).join('');
  const { DialogV2 } = foundry.applications.api;
  return new Promise(resolve => {
    let picked = null;
    const dialog = new DialogV2({
      window: { title: T('Title') },
      classes: ['essence20', 'e20-window', 'e20-rules-add-dialog'],
      position: { width: 640 },
      content: `<p>${T('Prompt')}</p><ul class="e20-rules-add-choices">${items}</ul>`,
      buttons: [{ action: 'cancel', label: game.i18n.localize('Cancel'), default: true }],
      submit: () => resolve(picked),
    });
    dialog.addEventListener('close', () => resolve(picked));
    dialog.render({ force: true }).then(() => {
      for (const button of dialog.element.querySelectorAll('[data-kind]')) {
        button.addEventListener('click', () => {
          picked = button.dataset.kind;
          dialog.close();
        });
      }
    });
  });
}

/**
 * The item's Active Effects as entries in the same list as its rules.
 * @param {Array<ActiveEffect>} effects   Each already given e20Summaries (mechanics/characters/active-effect-controls.mjs).
 * @returns {Array<Object>}
 */
export function effectEntries(effects) {
  return [...(effects ?? [])].map(effect => ({
    effect,
    state: effect.disabled ? 'off' : effect.isTemporary ? 'temporary' : 'on',
    summaries: effect.e20Summaries ?? [],
  }));
}

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

    // A list pick (count) shows every label; "change" asks the whole list again.
    if (rule?.type == 'ChoiceSet' && rule.key) {
      const value = state.choices?.[rule.key];
      entry.choice = { value, label: choiceLabel(rule, value, { actor, item }) };
    }

    // An added Trigger's pickSubPerk (Perk choice P1): the picked sub-Perks, and "change" picks them again.
    const subPerk = subPerkStepOf(rule);
    if (subPerk) {
      const value = state.choices?.[subPerk.key ?? 'perks'];
      entry.choice = { value, label: subPerkNames(item, value).join(', ') };
    }

    return entry;
  });

  return {
    rules,
    rulesOwned: !!actor && item.isOwner,
    rulesInherited: rulesAreInherited(item),
    rulesJson: JSON.stringify(rulesOf(item), null, 2),
    // The lines are the prerequisites; `text` is only an unmigrated item's old typed text (no tags), until 6.1.
    prerequisites: prerequisitesContext(item),
    actsAs: actsAsContext(item),
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

/** An added Trigger's first top-level pickSubPerk step, or null. */
export function subPerkStepOf(rule) {
  return rule?.type == 'Trigger' && rule.event == 'added' && Array.isArray(rule.steps) ? rule.steps.find(step => step?.do == 'pickSubPerk') ?? null : null;
}

/** The names of picked sub-Perks (compendium uuids): the actor's child copy, else the compendium item, else the uuid. */
export function subPerkNames(item, value) {
  const actor = item?.parent?.documentName == 'Actor' ? item.parent : null;
  const children = (actor?.items?.contents ?? [...(actor?.items ?? [])]).filter(other => other.flags?.essence20?.parentId == item.id);
  return (Array.isArray(value) ? value : value ? [value] : []).map(uuid => children.find(child => sourceOf(child) == uuid)?.name
    ?? globalThis.fromUuidSync?.(uuid, { strict: false })?.name ?? String(uuid));
}

/**
 * "Change" on the Rules tab (GM and owner - the tab shows it to whoever owns the copy): a ChoiceSet asks again (a list
 * pick asks its whole list, excludeCopies and the rename apply as when it was added); an added Trigger's pickSubPerk
 * picks its sub-Perks again (plugins/picks/pick-sub-perk.mjs#repickSubPerks). Queued with the actor's other asks.
 */
export async function changeChoice(item, index, { ask = askChoice } = {}) {
  const rule = rulesOf(item)[index];
  const subPerk = subPerkStepOf(rule);
  if (subPerk) {
    const { repickSubPerks } = await import("./plugins/picks/pick-sub-perk.mjs");
    await repickSubPerks(item, subPerk, rule);
    return;
  }

  if (rule?.type != 'ChoiceSet' || !rule.key) {
    return;
  }

  const actor = item.parent?.documentName == 'Actor' ? item.parent : null;
  await queueAsk(actor ?? item, async () => {
    const value = await askRule(rule, item, actor, { ask });
    if (value !== null && value !== undefined) {
      await item.update(choiceUpdate(item, rule, value));
    }
  });
}
