import { registerSpellCost } from "../../../mechanics/item-hooks.mjs";
import { resolveValue } from "../../formula.mjs";
import { ruleId, rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { changeResource, readResource, runSteps, stepContext, stepErrors } from "../../steps.mjs";
import { registerRuleType } from "../../types.mjs";
import { escape } from "../shared/chat-speaker-helpers.mjs";

/**
 * SpellCost rules (round 10, group D) - checkboxes in a dialog before a spell is cast, changing its casting cost.
 *
 * {type: SpellCost, label, op: set | add | multiply | spend, value?, spend?: {resource, max?}, note?, steps?, when?}
 *   set / add / multiply  the cost becomes / gains / is multiplied by `value` when ticked;
 *   spend                 a number box (0 up to what `spend.resource` holds, and `max`): that much is paid and taken
 *                         off the cost (never below 0).
 * Every SpellCost rule of the caster whose `when` holds (item: the spell - `item:own` for a spell's own option) is one
 * row in ONE dialog; ticked rows apply in that order: every set, then every add, then every multiply, then every spend.
 * A ticked row posts its `note` (or its label; nothing with `quiet`) and runs its `steps`. Cancelling the dialog cancels the cast. A spell
 * cast with dataset.freeCast (the recastFree step) costs nothing and asks nothing.
 */

const OPS = ['set', 'add', 'multiply', 'spend'];

registerRuleType('SpellCost', {
  params: {
    op: { kind: 'enum', options: OPS, required: true }, value: { kind: 'formula' }, spend: { kind: 'object' },
    note: { kind: 'string' }, quiet: { kind: 'bool' }, steps: { kind: 'object' },
  },
  scopes: ['self'],
  validate: rule => [
    ...(rule.op != 'spend' && rule.value === undefined ? ['value is required'] : []),
    ...(rule.op == 'spend' && !rule.spend?.resource ? ['spend needs a resource'] : []),
    ...(rule.steps !== undefined ? stepErrors(rule.steps) : []),
  ],
});

/** The SpellCost rows offered for this spell: [{rule, item, index, name, max?}]. */
export function spellCostRows(actor, spell) {
  return rulesOfType(actor, 'SpellCost')
    .filter(({ rule, item }) => evaluate(rule.when, contextFor({ self: actor, ruleItem: item, item: spell })) === true)
    .map(({ rule, item, index }) => {
      const row = { rule, item, index, name: ruleId(item, index) };
      if (rule.op == 'spend') {
        const have = readResource(rule.spend.resource, { actor, item });
        const cap = rule.spend.max === undefined ? have : Math.min(have, Math.round(resolveValue(rule.spend.max, { actor, item }, have)));
        row.max = Math.max(0, cap);
      }

      return row;
    })
    .filter(row => row.rule.op != 'spend' || row.max > 0);
}

/** The cost once the ticked rows apply: {cost, ticked: [{row, amount}]}. */
export function applySpellCost(cost, rows, answers) {
  let next = Number(cost) || 0;
  const ticked = [];
  for (const op of OPS) {
    for (const row of rows.filter(r => r.rule.op == op)) {
      const answer = answers?.[row.name];
      if (op == 'spend') {
        const spent = Math.max(0, Math.min(row.max ?? 0, Math.round(Number(answer) || 0)));
        if (spent) {
          next = Math.max(0, next - spent);
          ticked.push({ row, amount: spent });
        }

        continue;
      }

      if (!answer) {
        continue;
      }

      const value = Math.round(resolveValue(row.rule.value, { actor: row.item?.parent, item: row.item }, 0));
      next = op == 'set' ? value : op == 'add' ? next + value : next * value;
      ticked.push({ row, amount: value });
    }
  }

  return { cost: next, ticked };
}

async function askRows(spell, rows) {
  const { DialogV2 } = globalThis.foundry.applications.api;
  const label = row => escape(row.rule.label || row.item?.name || '');
  const answer = await DialogV2.wait({
    window: { title: spell.name },
    classes: ['window-app', 'e20-window'],
    content: rows.map(row => (row.rule.op == 'spend'
      ? `<div class="form-group"><label>${label(row)} (0-${row.max})</label><input type="number" name="${row.name}" value="0" min="0" max="${row.max}" /></div>`
      : `<label class="flexrow"><input type="checkbox" name="${row.name}" /> ${label(row)}</label>`)).join(''),
    buttons: [
      { action: 'ok', label: globalThis.game.i18n.localize('E20.DialogConfirmButton'), default: true, callback: (event, button) => Object.fromEntries(rows.map(row => [
        row.name, row.rule.op == 'spend' ? Number(button.form.elements[row.name]?.value) || 0 : !!button.form.elements[row.name]?.checked,
      ])) },
      { action: 'cancel', label: globalThis.game.i18n.localize('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  return answer && typeof answer == 'object' ? answer : null;
}

/**
 * The spell-cost hook (mechanics/item-hooks.mjs#runSpellCost): null cancels the cast.
 * @param {Item} spell
 * @param {Number} cost
 * @param {Object} dataset
 * @param {Function} [ask]   (spell, rows) => answers - tests.
 */
export async function ruleSpellCost(spell, cost, dataset = {}, ask = askRows) {
  if (dataset?.freeCast) {
    return 0;
  }

  const actor = spell?.actor ?? spell?.parent;
  const rows = spellCostRows(actor, spell);
  if (!rows.length) {
    return cost;
  }

  const answers = await ask(spell, rows);
  if (!answers) {
    return null;
  }

  const { cost: next, ticked } = applySpellCost(cost, rows, answers);
  const notes = [];
  for (const { row, amount } of ticked) {
    if (row.rule.op == 'spend' && !(await changeResource(row.rule.spend.resource, -amount, { actor, item: row.item }))) {
      continue;
    }

    if (!row.rule.quiet) {
      notes.push(escape(String(row.rule.note || row.rule.label || row.item?.name || '').replace(/\{amount\}/g, String(amount))));
    }

    if (Array.isArray(row.rule.steps) && row.rule.steps.length) {
      const ctx = stepContext({ actor, item: row.item, rule: row.rule, targets: [] });
      ctx.vars.spellUuid = spell.uuid ?? '';
      await runSteps(row.rule.steps, ctx);
    }
  }

  if (notes.length && globalThis.ChatMessage?.create) {
    await globalThis.ChatMessage.create({ speaker: globalThis.ChatMessage.getSpeaker?.({ actor }), content: `<p>${escape(spell.name)}: ${notes.join(' ')}</p>` });
  }

  return next;
}

registerSpellCost((spell, cost, dataset) => ruleSpellCost(spell, cost, dataset));

