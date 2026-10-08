import { registerDialogToggles } from "../../../mechanics/item-hooks.mjs";
import { resolveValue } from "../../formula.mjs";
import { ruleId, rulesOfType } from "../../index.mjs";
import { limitKey, recordUse, usesInWindow } from "../../limits.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { canAfford, changeResource } from "../../steps.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Round 16 (part a): `FlatD20` - "treat a d20 result as N without rolling it" (dice.mjs#_getd20Operand's flatD20Value /
 * flatBothD20s), offered as Roll Options Dialog boxes and decided AFTER the dialog, once the roll's Edge / Snag is known.
 *
 *   {type: FlatD20, key, label, value, priority?, limit?, cost?: {resource, amount}, costLabel?, lateWhen?,
 *    both?: {label, uses? | cost?}}
 *       A box (offered while `when` holds, a use is left under `limit` and `cost` can be paid). Ticked, one d20 counts as
 *       `value`. `both` adds a second box: with an Edge or a Snag (not both) BOTH d20s count as the value - using `uses`
 *       of the limit (instead of 1), or paying `cost` more. Offered only while that many uses are left / that much can
 *       be paid. `lateWhen` is asked once the dialog closes (roll:edge, roll:snag): when it fails the ticked box does
 *       nothing and costs nothing. Several ticked boxes: the lowest `priority` that can apply wins, the rest do nothing.
 *       The cost is paid and the uses counted only when the box applies.
 *   {type: FlatD20, of: <key>, addUses?, lateWhen?, upgrade?: {label, value, cost?, limit?}}
 *       Another item changing the box named `key`: `addUses` more uses under its limit; its `lateWhen` must hold too (a
 *       Hang-Up's "only with an Edge"); `upgrade` - one more box, offered with it while its own limit lasts and the
 *       combined cost can be paid: ticked, the value is `upgrade.value` instead, for `cost` more.
 *
 * Labels may be E20. keys; a cost adds "(N <costLabel>)" (the resource's name: costLabel, an E20. key, else the Role
 * Points item's name), "+N" on the both / upgrade boxes. Never on an Initiative roll.
 */

const localize = key => {
  const text = globalThis.game?.i18n?.localize?.(key);
  return text && text != key ? text : key;
};

const LATE_TAGS = { kind: 'object' };
registerRuleType('FlatD20', {
  params: {
    key: { kind: 'string' }, of: { kind: 'string' }, value: { kind: 'formula' }, limit: { kind: 'object' }, cost: { kind: 'object' },
    costLabel: { kind: 'string' }, lateWhen: LATE_TAGS, both: { kind: 'object' }, addUses: { kind: 'formula' }, upgrade: { kind: 'object' },
  },
  scopes: ['self'],
  validate: rule => [
    ...(!rule.key && !rule.of ? ['a FlatD20 needs key (its own box) or of (the box it changes)'] : []),
    ...(rule.key && rule.of ? ['a FlatD20 has key or of, not both'] : []),
    ...(rule.key && rule.value === undefined ? ['a FlatD20 box needs value'] : []),
    ...(rule.lateWhen !== undefined && !Array.isArray(rule.lateWhen) ? ['lateWhen must be a list'] : []),
    ...(rule.upgrade && rule.upgrade.value === undefined ? ['upgrade needs value'] : []),
  ],
});

const num = (value, actor, item, fallback = 0) => Math.round(resolveValue(value ?? fallback, { actor, item }, fallback));

const holds = (when, actor, item, roll) => evaluate(when, contextFor({ ...roll, self: actor, holder: actor, ruleItem: item })) === true;

/** The FlatD20 rules of the actor: the boxes (by priority) and the changes other items make to them. */
function flatRules(actor, roll) {
  const all = rulesOfType(actor, 'FlatD20');
  const boxes = all.filter(({ rule }) => rule.key).sort((a, b) => (Number(a.rule.priority) || 0) - (Number(b.rule.priority) || 0));
  const mods = all.filter(({ rule, item }) => rule.of && holds(rule.when, actor, item, roll));
  return { boxes, mods };
}

/** What one box can offer now: uses left, its own cost, and its both / upgrade boxes. */
function boxState(actor, entry, mods, roll) {
  const { rule, item, index } = entry;
  const own = mods.filter(mod => mod.rule.of == rule.key);
  let left = Infinity;
  if (rule.limit?.per) {
    const max = num(rule.limit.max, actor, item, 1) + own.reduce((sum, mod) => sum + num(mod.rule.addUses, actor, mod.item, 0), 0);
    left = Math.max(0, max - usesInWindow(actor, limitKey(rule, item, index), rule.limit.per));
  }

  const resource = rule.cost?.resource ?? null;
  const amount = resource ? num(rule.cost.amount, actor, item, 1) : 0;
  const ctx = { actor, item };
  const affords = extra => !resource || canAfford(resource, amount + extra, ctx);
  const offered = holds(rule.when, actor, item, roll) && left >= 1 && affords(0);
  const both = rule.both ? (rule.both.uses !== undefined ? left >= num(rule.both.uses, actor, item, 2) : affords(num(rule.both.cost, actor, item, 0))) : false;
  const upgrades = own.filter(mod => mod.rule.upgrade).map(mod => {
    const upgradeRule = { limit: mod.rule.upgrade.limit };
    const upgradeLeft = upgradeRule.limit?.per
      ? Math.max(0, num(upgradeRule.limit.max, actor, mod.item, 1) - usesInWindow(actor, limitKey(upgradeRule, mod.item, mod.index), upgradeRule.limit.per))
      : Infinity;
    const cost = num(mod.rule.upgrade.cost, actor, mod.item, 0);
    return { mod, cost, offered: upgradeLeft >= 1 && affords(cost), limitRule: upgradeRule };
  });
  return { left, resource, amount, offered, both, upgrades, mods: own };
}

function costName(rule) {
  if (rule.costLabel) {
    return localize(rule.costLabel);
  }

  const points = rule.cost?.resource?.rolePoints;
  return typeof points == 'string' ? points : '';
}

const skip = roll => !!roll?.dataset?.isInitiative;

/**
 * The FlatD20 boxes for the Roll Options Dialog (mechanics/item-hooks.mjs#registerDialogToggles).
 * @param {Actor} actor
 * @param {Object} roll   {item, rolledSkill, rolledEssence, dataset}
 * @returns {Array<Object>}
 */
export function flatD20Toggles(actor, roll = {}) {
  if (!actor || skip(roll)) {
    return [];
  }

  const { boxes, mods } = flatRules(actor, roll);
  const toggles = [];
  for (const entry of boxes) {
    const state = boxState(actor, entry, mods, roll);
    if (!state.offered) {
      continue;
    }

    const { rule, item, index } = entry;
    const name = costName(rule);
    const suffix = (n, plus) => (state.resource && n ? ` (${plus ? '+' : ''}${n}${name ? ` ${name}` : ''})` : '');
    toggles.push({ name: `${ruleId(item, index)}-flat`, label: `${localize(rule.label || item.name)}${suffix(state.amount, false)}`, type: 'checkbox', value: false });
    if (state.both) {
      toggles.push({ name: `${ruleId(item, index)}-both`, label: `${localize(rule.both.label || item.name)}${rule.both.uses === undefined ? suffix(num(rule.both.cost, actor, item, 0), true) : ''}`, type: 'checkbox', value: false });
    }

    for (const upgrade of state.upgrades.filter(u => u.offered)) {
      toggles.push({ name: `${ruleId(upgrade.mod.item, upgrade.mod.index)}-up`, label: `${localize(upgrade.mod.rule.upgrade.label || upgrade.mod.item.name)}${suffix(upgrade.cost, true)}`, type: 'checkbox', value: false });
    }
  }

  return toggles;
}

registerDialogToggles((actor, ctx) => flatD20Toggles(actor, ctx ?? {}));

/**
 * Once the dialog has closed: which ticked box applies, its cost paid and its uses counted. dice.mjs#rollSkill, where the
 * d20 operand is built.
 * @param {Actor} actor
 * @param {Object} options   The dialog's options (ext, edge, snag).
 * @param {Object} roll      {item, rolledSkill, rolledEssence, dataset}
 * @returns {Promise<{value: Number, both: Boolean}>}
 */
export async function ruleFlatD20(actor, options = {}, roll = {}) {
  const none = { value: 0, both: false };
  if (!actor || skip(roll)) {
    return none;
  }

  const ticked = options.ext ?? {};
  const late = { ...roll, edge: !!options.edge, snag: !!options.snag };
  const { boxes, mods } = flatRules(actor, roll);
  for (const entry of boxes) {
    const { rule, item, index } = entry;
    if (!ticked[`${ruleId(item, index)}-flat`]) {
      continue;
    }

    const state = boxState(actor, entry, mods, roll);
    if (!state.offered) {
      continue;
    }

    // lateWhen: the box's own and every changing item's, asked now the Edge / Snag is settled.
    if ([rule, ...state.mods.map(mod => mod.rule)].some(one => Array.isArray(one.lateWhen) && one.lateWhen.length && !holds(one.lateWhen, actor, item, late))) {
      continue;
    }

    const bothUses = rule.both?.uses !== undefined ? num(rule.both.uses, actor, item, 2) : null;
    const wantsBoth = !!rule.both && state.both && !!ticked[`${ruleId(item, index)}-both`] && late.edge != late.snag
      && (bothUses === null || state.left >= bothUses);
    const upgrades = state.upgrades.filter(u => u.offered && ticked[`${ruleId(u.mod.item, u.mod.index)}-up`]);
    const cost = state.amount + (wantsBoth && bothUses === null ? num(rule.both.cost, actor, item, 0) : 0) + upgrades.reduce((sum, u) => sum + u.cost, 0);
    if (state.resource && !canAfford(state.resource, cost, { actor, item })) {
      continue;
    }

    if (state.resource && cost) {
      await changeResource(state.resource, -cost, { actor, item, chat: [] });
    }

    if (rule.limit?.per) {
      for (let i = 0; i < (wantsBoth && bothUses !== null ? bothUses : 1); i++) {
        await recordUse(actor, rule, item, index);
      }
    }

    for (const upgrade of upgrades) {
      if (upgrade.limitRule.limit?.per) {
        await recordUse(actor, upgrade.limitRule, upgrade.mod.item, upgrade.mod.index);
      }
    }

    const value = Math.max(num(rule.value, actor, item, 10), ...upgrades.map(u => num(u.mod.rule.upgrade.value, actor, u.mod.item, 10)));
    return { value, both: wantsBoth };
  }

  return none;
}
