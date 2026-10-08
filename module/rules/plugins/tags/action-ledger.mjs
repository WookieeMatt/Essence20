import { registerRef } from "../../formula.mjs";
import { registerTag } from "../../predicate.mjs";
import { lazy } from "../shared/lazy-helpers-and-targets.mjs";

/**
 * The action economy's ledger for this turn (mechanics/actions/action-economy.mjs#getLedger), as tags and refs (round 15,
 * systems - docs/rules-batches/slSystems15.md):
 *
 *   self:actionLog:<what>[:<cost>]<op><n>   how many of this turn's logged spends were <what> - a named action key
 *                                           (lendAssistance, sprint...) or flag:<key> (a spend logged with that fact:
 *                                           flag:snapShotWeapon - an attack with a pistol or a thrown Finesse weapon);
 *                                           with <cost> (standard | move | free) only those that spent one. op: = != >= <=
 *                                           > <. Outside a combat (no ledger) the count is 0.
 *                                           (Here To Help's Free, then Move Lend Assistance; Desperate Times' "already
 *                                           used your Standard action to Lend Assistance".)
 *   @ledger.<path>                          a number on the ledger (@ledger.perkUses.<key> - how many times a cost rule
 *                                           with limit.key <key> paid this turn: Ground and Pound's ↓ per earlier
 *                                           attack); 0 when unset.
 */

const ledgerOf = actor => (actor && lazy.getLedger ? lazy.getLedger(actor) : null);

function compare(count, op, n) {
  switch (op) {
  case '=': return count == n;
  case '!=': return count != n;
  case '>=': return count >= n;
  case '<=': return count <= n;
  case '>': return count > n;
  case '<': return count < n;
  }

  return null;
}

/** How many of the actor's logged spends this turn match. */
export function actionLogCount(actor, what, cost = null) {
  const log = ledgerOf(actor)?.log ?? [];
  return log.filter(entry => (String(what).startsWith('flag:') ? !!entry?.[String(what).slice(5)] : entry?.namedKey == what)
    && (!cost || !!entry?.cost?.[cost])).length;
}

registerTag('self:actionLog', (rest, ctx) => {
  const match = /^(flag:[\w-]+|[\w-]+)(?::(standard|move|free))?(=|!=|>=|<=|>|<)(\d+)$/.exec(String(rest ?? ''));
  if (!match) {
    return null;
  }

  return compare(actionLogCount(ctx.self, match[1], match[2] ?? null), match[3], Number(match[4]));
}, { phrase: (arg, w) => {
  const match = /^(flag:[\w-]+|[\w-]+)(?::(standard|move|free))?(=|!=|>=|<=|>|<)(\d+)$/.exec(arg);
  if (!match) {
    return null;
  }

  const what = match[1].startsWith('flag:') ? w.humanize(match[1].slice(5)) : w.humanize(match[1]);
  const cost = match[2] ? ` as a ${w.humanize(match[2])} action` : '';
  const times = n => (n == 1 ? 'once' : `${n} times`);
  const count = { '>=': `at least ${times(match[4])}`, '<=': `at most ${times(match[4])}`, '>': `more than ${times(match[4])}`, '<': `fewer than ${times(match[4])}`, '=': match[4] == '0' ? 'not at all' : `exactly ${times(match[4])}`, '!=': `other than ${times(match[4])}` }[match[3]];
  return match[3] == '>=' && match[4] == '1' ? [`{who} used ${what}${cost} this turn`, `{who} {havent} used ${what}${cost} this turn`]
    : [`{who} used ${what}${cost} ${count} this turn`, `{who} didn't use ${what}${cost} ${count} this turn`];
} });

registerRef('ledger', (key, scope) => {
  const value = String(key ?? '').split('.').reduce((at, part) => (at === null || at === undefined ? at : at[part]), ledgerOf(scope.actor));
  return Number(value) || 0;
});
