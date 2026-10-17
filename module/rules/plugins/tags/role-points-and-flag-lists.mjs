import { registerRef } from "../../formula.mjs";
import { evaluate, registerTag } from "../../predicate.mjs";
import { registerPickSource, registerStep, rolePointsOf } from "../../steps.mjs";
import { getPath } from "../shared/base-actor-helpers.mjs";

/**
 * Small values and pickers (round 12, group I):
 *
 *   @rolePoints / @rolePoints.<name>   what the actor's base Role Points item holds (Mystical Points, Cheer...), or
 *                                      the Role Points item of that name ("_" for a space); 0 with none
 *   @flagList.<flag>[.<value>]         how many entries the list at flags.essence20.<flag> on the actor holds (that
 *                                      value only, with one) - 0 when there is no list
 *   step flagList {flag, add?, clear?, to?}
 *                                      add a text ({choice.x}, {var.x} filled) to that list on each recipient, or
 *                                      empty it (clear: true; nothing written when it's already empty)
 *   pick from: config {path}           the entries of CONFIG.E20.<path> (weaponTypes, damageTypes...), labelled by
 *                                      their localised names
 *   tag holder:asOther:<self tag>      a self: tag asked of the rule's holder, the actor the rule reaches (the one
 *                                      rolling) being the other party - holder:asOther:sizeDiff>=0 (the holder is
 *                                      no smaller than them)
 */

function rolePointsValue(actor, key) {
  const name = key ? String(key).replace(/_/g, ' ') : null;
  return Number(rolePointsOf(actor, name)?.system?.resource?.value) || 0;
}

registerRef('rolePoints', (key, scope) => rolePointsValue(scope.actor, key));

function flagListOf(actor, flag) {
  const list = actor?.flags?.essence20?.[flag];
  return Array.isArray(list) ? list : [];
}

registerRef('flagList', (key, scope, parts = []) => {
  const [flag, value] = Array.isArray(parts) && parts.length ? parts : String(key ?? '').split('.');
  const list = flagListOf(scope.actor, flag);
  return value === undefined || value === '' ? list.length : list.filter(entry => String(entry) == String(value)).length;
});

registerStep('flagList', async (step, ctx) => {
  const { recipients, fillTextFor } = await stepsApi();
  const flag = String(step.flag ?? '');
  for (const actor of recipients({ ...step, to: step.to ?? 'self' }, ctx)) {
    const list = flagListOf(actor, flag);
    if (step.clear) {
      if (list.length) {
        await actor.update({ [`flags.essence20.${flag}`]: [] });
      }

      continue;
    }

    const value = fillTextFor(String(step.add ?? ''), ctx);
    if (value) {
      await actor.update({ [`flags.essence20.${flag}`]: [...list, value] });
    }
  }
}, {
  errors: (step, where) => [
    ...(step.flag && /^[\w-]+$/.test(String(step.flag)) ? [] : [`${where}: flagList needs a flag name`]),
    ...(step.clear || step.add ? [] : [`${where}: flagList needs add or clear`]),
  ],
});

async function stepsApi() {
  const steps = await import("../../steps.mjs");
  const { interpolate } = await import("../../predicate.mjs");
  const fillTextFor = (text, ctx) => (interpolate(text, ctx.item) ?? '').replace(/\{var\.([\w-]+)\}/g, (match, key) => String(ctx.vars?.[key] ?? ''));
  return { recipients: steps.recipients, fillTextFor };
}

// exceptAt (round 17, split2): leave out the keys the actor already has set at that path (system.qualified.weapons -
// Armchair General's weapon type it isn't Qualified in yet).
// Perk choice P1: `table` names the CONFIG.E20 table too (the ChoiceSet spelling - the same as path); a list table
// (fieldSkills) offers its entries, labelled from the `labels` table when given (skills).
registerPickSource('config', (step, ctx) => {
  const table = getPath(globalThis.CONFIG?.E20 ?? {}, step.path ?? step.table) ?? {};
  const localize = key => globalThis.game?.i18n?.localize?.(key) ?? key;
  const held = step.exceptAt ? getPath(ctx?.actor ?? {}, step.exceptAt) ?? {} : {};
  if (Array.isArray(table)) {
    const labels = step.labels ? getPath(globalThis.CONFIG?.E20 ?? {}, step.labels) ?? {} : {};
    return table.map(String).filter(value => !held?.[value]).map(value => ({ value, label: localize(typeof labels[value] == 'string' ? labels[value] : value) }));
  }

  return Object.entries(table && typeof table == 'object' ? table : {}).filter(([value]) => !held?.[value])
    .map(([value, label]) => ({ value, label: localize(typeof label == 'string' ? label : value) }));
});

registerTag('holder:asOther', (rest, ctx) => {
  if (!rest) {
    return null;
  }

  const holder = ctx.holder ?? ctx.self;
  return evaluate([`self:${rest}`], { ...ctx, self: holder, holder, other: ctx.self });
}, { phrase: (arg, w) => w.facts([`holder:${arg}`]).replace("the target's", 'yours') });
