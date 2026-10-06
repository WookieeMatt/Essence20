import { registerDefenseAdjust } from "../../../mechanics/item-hooks.mjs";
import { RULE_TYPES } from "../../types.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { resolveValue } from "../../formula.mjs";
import { linkedEntries } from "../../links.mjs";
import { recordUse, usesLeft } from "../../limits.mjs";
import { registerStep, recipients } from "../../steps.mjs";
import { strongestPerGroup } from "../../adapter.mjs";
import { lazy } from "../shared/lazy-helpers-and-targets.mjs";

/**
 * Defenses (round 10, group C) - two more Defense modes, decided per attack AFTER the rules' own best / halve /
 * fail (rules/adapter.mjs#ruleDefenseAdjust), at the same point in dice.mjs the hand-written Defense adjusts land
 * (before Unseen Strike / Augmented halve the final number):
 *
 *   addAfter  `amount` added on top (Business' +2 Cleverness against StrexCorp; the exposure clothes taking their
 *             sheet +2 back off against an attack). Rules sharing a `stack` group are alternatives: only the
 *             biggest counts.
 *   instead   the attack meets the `from` Defense instead: its sheet total minus this Defense's (Stoic, and with
 *             outgoing: true Thorn Warlord's Acid against Evasion).
 *
 * `outgoing` and `limit` work as for the other per-attack modes. Plus a step:
 *   grantNextTurn {free?, move?, standard?, to} - actions the recipients gain on their next turn in the combat
 *   (mechanics/actions/action-economy.mjs#setNextTurn - Stoic's Free actions for the allies).
 */

const DEFENSE = RULE_TYPES.Defense;
for (const mode of ['addAfter', 'instead']) {
  if (!DEFENSE.params.mode.options.includes(mode)) {
    DEFENSE.params.mode.options.push(mode);
  }
}

{
  const inner = DEFENSE.validate;
  DEFENSE.validate = rule => [
    ...inner(rule),
    ...(rule.mode == 'addAfter' && (rule.amount === undefined || rule.amount === '') ? ['amount is required'] : []),
    ...(rule.mode == 'instead' && !(Array.isArray(rule.from) && rule.from.length == 1) ? ['instead needs from (the one Defense to use)'] : []),
  ];
}

const LATE = ['addAfter', 'instead'];

/**
 * What the late Defense modes change for this attack (a number to add to the difficulty).
 * @param {Actor} attacker
 * @param {Actor} defender
 * @param {String} defenseType
 * @param {Object} ctx   {item, isAttack, difficulty, ext, rolledSkill, rolledEssence}
 */
export function lateDefenseAdjust(attacker, defender, defenseType, ctx = {}) {
  if (!defender) {
    return 0;
  }

  const own = [...rulesOfType(defender, 'Defense', 'self').map(entry => ({ ...entry, holder: defender })), ...linkedEntries(defender, 'Defense')];
  const entries = [
    ...own.filter(({ rule }) => !rule.outgoing).map(entry => ({ ...entry, self: defender, other: attacker })),
    ...(attacker ? [...rulesOfType(attacker, 'Defense', 'self').map(entry => ({ ...entry, holder: attacker })), ...linkedEntries(attacker, 'Defense')]
      .filter(({ rule }) => rule.outgoing).map(entry => ({ ...entry, self: attacker, other: defender })) : []),
  ];
  const isAttack = ctx.isAttack ?? ctx.item?.type == 'weaponEffect';
  const facts = { ...ctx, isAttack, isMelee: ctx.isMelee ?? (isAttack && ctx.item?.system?.classification?.style == 'melee'), defenseType };
  const added = [];
  let total = 0;
  for (const entry of entries) {
    const { rule, item, holder, index, self, other } = entry;
    if (!LATE.includes(rule.mode) || (rule.defense != 'any' && rule.defense != defenseType)) {
      continue;
    }

    if (rule.limit?.per && usesLeft(holder, rule, item, index) <= 0) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ ...facts, self, holder, ruleItem: item, other })) !== true) {
      continue;
    }

    if (rule.limit?.per) {
      recordUse(holder, rule, item, index);
    }

    if (rule.mode == 'instead') {
      const sheet = key => Number(defender.system?.defenses?.[key]?.total) || 0;
      total += sheet(rule.from[0]) - sheet(defenseType);
      continue;
    }

    added.push({ ...entry, amount: Math.round(resolveValue(rule.amount, { actor: holder, item, other })) });
  }

  for (const { amount } of strongestPerGroup(added, entry => entry.amount)) {
    total += amount;
  }

  return total;
}

registerDefenseAdjust(lateDefenseAdjust);

/* -------------------------------------------- */
/*  grantNextTurn                                */
/* -------------------------------------------- */

registerStep('grantNextTurn', async (step, ctx) => {
  const setNextTurn = lazy.setNextTurn ?? (await import("../../../mechanics/actions/action-economy.mjs")).setNextTurn;
  const resolve = value => Math.max(0, Math.round(resolveValue(value ?? 0, { actor: ctx.actor, item: ctx.item, vars: ctx.vars, other: ctx.targets?.[0] ?? null }, 0)));
  const grant = Object.fromEntries(['free', 'move', 'standard'].map(kind => [kind, resolve(step[kind])]).filter(([, amount]) => amount > 0));
  if (!Object.keys(grant).length) {
    return;
  }

  for (const actor of recipients(step, ctx)) {
    await setNextTurn(actor, { grant }, ctx.item?.name ?? null);
  }
}, {
  errors: (step, where) => (['free', 'move', 'standard'].some(kind => step[kind] !== undefined) ? [] : [`${where}: grantNextTurn needs free, move or standard`]),
});
