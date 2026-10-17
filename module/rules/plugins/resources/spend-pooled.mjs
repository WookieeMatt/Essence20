import { resolveValue } from "../../formula.mjs";
import { recipients, registerStep } from "../../steps.mjs";
import { localize, write } from "../shared/copy-and-data-helpers.mjs";

/**
 * Round 15 (items2) - step `spendPooled {to, path, amount, message?}`: one cost drawn from several creatures in turn (Zord
 * Mega-Weapon System's "5 Personal Power expended from any combination of the Crew"). The recipients' numbers at `path`
 * (system.powers.personal.value) are added up; short of `amount` (a formula): `message` (an E20. key, {cost} / {available}
 * filled) as a warning, nothing spent, and the run stops. Otherwise each gives what it can, in order, until it's paid.
 * @var.contributors lists who gave what ("Jason (3), Trini (2)").
 */
registerStep('spendPooled', async (step, ctx) => {
  const path = String(step.path ?? '');
  const read = actor => Math.max(0, Number(path.split('.').reduce((at, key) => at?.[key], actor)) || 0);
  const pool = recipients(step, ctx).filter(actor => read(actor) > 0);
  const cost = Math.max(0, Math.round(resolveValue(step.amount ?? 1, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 1)));
  const available = pool.reduce((sum, actor) => sum + read(actor), 0);
  if (available < cost) {
    if (step.message) {
      globalThis.ui?.notifications?.warn?.(String(localize(step.message, { cost, available })).replace(/\{cost\}/g, String(cost)).replace(/\{available\}/g, String(available)));
    }

    return false;
  }

  let left = cost;
  const given = [];
  for (const actor of pool) {
    if (left <= 0) {
      break;
    }

    const share = Math.min(left, read(actor));
    await write(actor, 'update', [{ [path]: read(actor) - share }]);
    given.push(`${actor.name} (${share})`);
    left -= share;
  }

  ctx.vars.contributors = given.join(', ');
}, {
  errors: (step, where) => (/^system\.[\w.]+$/.test(String(step.path ?? '')) ? [] : [`${where}: spendPooled needs a system.<...> path`]),
});
