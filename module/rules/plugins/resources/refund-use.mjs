import { epochFor } from "../../../mechanics/resources/scene-clock.mjs";
import { rulesOf } from "../../index.mjs";
import { sessionEpoch } from "../../limits.mjs";
import { recipients, registerStep } from "../../steps.mjs";
import { escape, localize, write } from "../shared/copy-and-data-helpers.mjs";

/**
 * Round 15 (items2) - step `refundUse {to?, prompt?, message?}` (Delegate's extra use of one Role or General
 * Perk): the (first) recipient's spent uses that still count, one picked by the player, is given
 * back - a counted Scene Clock record ({epoch, window, count}, mechanics/resources/scene-clock.mjs) or a this-turn /
 * this-round stamp on its flags, or one of its rule limits (flags.essence20.ruleUses - rules/limits.mjs) still spent in
 * its window. A count above 1 goes down by one; otherwise the record goes. Nothing to give back: `message` (an E20.
 * key, {name} the recipient) as a warning, and the run stops. @var.refunded is the use's label.
 */

export const labelOf = key => String(key).replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();

function current(record, combat) {
  if (!record || typeof record != 'object') {
    return false;
  }

  if (record.window && typeof record.count == 'number') {
    return record.count > 0 && record.epoch === epochFor(record.window);
  }

  if (record.combatId) {
    return !!combat && record.combatId == combat.id && record.round == combat.round && (record.turn === undefined || record.turn == combat.turn);
  }

  if (record.session !== undefined) {
    return record.session == sessionEpoch() && Number(record.count) > 0;
  }

  // A rest-long count.
  return Number(record.count) > 0 && record.epoch === undefined;
}

/** A rule limit's key as a name: "<item>: <rule label>" for an item's own (<item id>-<index>), else the shared key. */
function ruleUseLabel(actor, key) {
  const match = /^(\w+)-(\d+)$/.exec(key);
  const item = match ? actor?.items?.get?.(match[1]) : null;
  if (!item) {
    return labelOf(key);
  }

  const rule = rulesOf(item)[Number(match[2])];
  return rule?.label ? `${item.name}: ${rule.label}` : item.name;
}

/** Every spent use the actor could get back: [{path, label, record}]. */
export function refundableUses(actor, combat = globalThis.game?.combat) {
  const rows = [];
  for (const [key, record] of Object.entries(actor?.flags?.essence20 ?? {})) {
    if (key == 'ruleUses') {
      continue;
    }

    // A loose record: a Scene Clock count, or a this-turn / this-round stamp (nothing else on it).
    const loose = record?.window ? current(record, combat) : record?.combatId && Object.keys(record).length <= 3 && current(record, combat);
    if (loose) {
      rows.push({ path: key, label: labelOf(key), record });
    }
  }

  for (const [key, record] of Object.entries(actor?.flags?.essence20?.ruleUses ?? {})) {
    if (current(record, combat)) {
      rows.push({ path: `ruleUses.${key}`, label: ruleUseLabel(actor, key), record });
    }
  }

  return rows;
}

registerStep('refundUse', async (step, ctx) => {
  const [actor] = recipients({ ...step, to: step.to ?? 'target' }, ctx);
  const rows = refundableUses(actor);
  if (!actor || !rows.length) {
    if (actor && step.message) {
      globalThis.ui?.notifications?.warn?.(String(localize(step.message, { name: actor.name })).replace(/\{name\}/g, actor.name));
    }

    return false;
  }

  const { chooseSelect } = ctx.grantHelpers ?? await import("../../../mechanics/resources/grants.mjs");
  const path = await chooseSelect(ctx.item?.name ?? '', escape(String(localize(step.prompt ?? '', { name: actor.name })).replace(/\{name\}/g, actor.name)),
    rows.map(row => ({ value: row.path, label: row.label })));
  const row = rows.find(entry => entry.path == path);
  if (!row) {
    return false;
  }

  const count = Number(row.record.count);
  if (Number.isFinite(count) && count > 1) {
    await write(actor, 'update', [{ [`flags.essence20.${row.path}`]: { ...row.record, count: count - 1 } }]);
  } else {
    await write(actor, 'update', [{ [`flags.essence20.${row.path}`]: new foundry.data.operators.ForcedDeletion() }]);
  }

  ctx.vars.refunded = row.label;
});
