import { registerUse } from "../../mechanics/item-hooks.mjs";
import { epochFor } from "../../mechanics/resources/scene-clock.mjs";
import { HAWK } from "../shared/gm-relayed-item-writes.mjs";
import { T } from "../shared/item-lang.mjs";
import { firstTargetedActor as firstTarget } from "../shared/sides.mjs";
import { isFrom } from "../shared/item-lookups.mjs";
import { num } from "../shared/numbers.mjs";

/**
 * Delegate (Hawk's Personnel Files, Old Hand, 6th level, p.165): "you can use one of your Moxie
 * Points to allow an ally within sight one additional use of one of their Role Perks or General
 * Perks." A use is a counted record on the ally (mechanics/resources/scene-clock.mjs's {epoch, count}, or a
 * this-turn/this-round stamp from mechanics/characters/perks.mjs) - the pick hands one of them back.
 */
export const DELEGATE_ID = HAWK('DQFDOrYUZmZZxmi1');

export function refundableUses(ally, combat = game?.combat) {
  const rows = [];
  for (const [key, record] of Object.entries(ally?.flags?.essence20 ?? {})) {
    if (!record || typeof record != 'object') {
      continue;
    }

    if (record.window && typeof record.count == 'number' && record.count > 0 && record.epoch === epochFor(record.window)) {
      rows.push({ key, kind: 'count', record });
    } else if (record.combatId && combat && record.combatId == combat.id && record.round == combat.round
      && (record.turn === undefined || record.turn == combat.turn) && Object.keys(record).length <= 3) {
      rows.push({ key, kind: 'stamp', record });
    }
  }

  return rows;
}

export const labelOf = key => key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();

registerUse({
  id: 'o2Delegate',
  matches: isFrom(DELEGATE_ID),
  async run(item) {
    const actor = item.parent;
    const ally = firstTarget();
    if (!ally || ally.id == actor.id) {
      ui.notifications?.warn?.(T('O2NeedAlly'));
      return null;
    }

    const { findRolePointsItem } = await import("../../mechanics/rolls/reroll.mjs");
    const moxie = findRolePointsItem(actor, 'Moxie');
    if (!moxie || (!actor.system?.useUnlimitedResource && num(moxie.system?.resource?.value) < 1)) {
      ui.notifications?.warn?.(T('O2NoMoxie'));
      return null;
    }

    const rows = refundableUses(ally);
    if (!rows.length) {
      ui.notifications?.warn?.(T('O2DelegateNothing', { name: ally.name }));
      return null;
    }

    const { chooseSelect } = await import("../../mechanics/resources/grants.mjs");
    const key = await chooseSelect(item.name, T('O2DelegatePick', { name: ally.name }), rows.map(r => ({ value: r.key, label: labelOf(r.key) })));
    const row = rows.find(r => r.key == key);
    if (!row) {
      return null;
    }

    if (row.kind == 'count' && row.record.count > 1) {
      await ally.setFlag('essence20', row.key, { ...row.record, count: row.record.count - 1 });
    } else {
      await ally.unsetFlag('essence20', row.key);
    }

    if (!actor.system?.useUnlimitedResource) {
      await moxie.update({ 'system.resource.value': num(moxie.system.resource.value) - 1 });
    }

    return T('O2Delegated', { name: actor.name, ally: ally.name, use: labelOf(row.key) });
  },
});
