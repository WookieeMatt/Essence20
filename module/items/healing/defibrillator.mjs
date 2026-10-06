import { registerRoundStart, registerUse } from "../../mechanics/item-hooks.mjs";
import { GIJ } from "../shared/gm-relayed-item-writes.mjs";
import { T } from "../shared/item-lang.mjs";
import { firstTargetedActor as firstTarget } from "../shared/sides.mjs";
import { isFrom } from "../shared/item-lookups.mjs";
import { num } from "../shared/numbers.mjs";
import { say as post } from "../shared/chat-lines.mjs";

/**
 * Defibrillator (GI Joe CRB p.162): "A single use resuscitation device, this item can be used by an
 * untrained character to grant 1 Health to a Defeated character. Doing so requires 30 seconds (6
 * combat rounds) of operation." Out of combat it is simply done.
 */
export const DEFIBRILLATOR_ID = GIJ('IP0hnNhERC4OCc0k');
const DEFIB_FLAG = 'o2Defibrillating';

async function useUpDefibrillator(actor, itemId) {
  const item = actor?.items?.get?.(itemId);
  if (!item) {
    return;
  }

  if (num(item.system?.quantity) > 1) {
    await item.update({ 'system.quantity': num(item.system.quantity) - 1 });
  } else {
    await item.delete();
  }
}

async function finishDefibrillator(actor, record) {
  const target = await fromUuid(record.targetUuid);
  if (target?.statuses?.has?.('defeated')) {
    const { applyHealSkillTestResult } = await import("./heal-skill-test.mjs");
    await applyHealSkillTestResult(target, 1);
    await post(actor, T('O2DefibDone', { name: actor.name, target: target.name }));
  }

  await useUpDefibrillator(actor, record.itemId);
}

registerUse({
  id: 'o2Defibrillator',
  matches: isFrom(DEFIBRILLATOR_ID),
  canUse: item => !item.parent?.flags?.essence20?.[DEFIB_FLAG],
  async run(item, economy, pay) {
    const actor = item.parent;
    const target = firstTarget();
    if (!target?.statuses?.has?.('defeated')) {
      ui.notifications?.warn?.(T('O2NeedDefeatedTarget'));
      return null;
    }

    const combat = game.combat;
    if (!combat) {
      await finishDefibrillator(actor, { targetUuid: target.uuid, itemId: item.id });
      return null;
    }

    if (!(await pay('standard'))) {
      return null;
    }

    await actor.setFlag('essence20', DEFIB_FLAG, { targetUuid: target.uuid, itemId: item.id, combatId: combat.id, readyRound: combat.round + 6 });
    return T('O2DefibStarted', { name: actor.name, target: target.name, round: combat.round + 6 });
  },
});

/** Whose Defibrillator has run its six rounds. */
export function defibrillatorReady(record, combat) {
  return !!record && !!combat && record.combatId == combat.id && combat.round >= record.readyRound;
}

registerRoundStart(async (combat) => {
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant.actor;
    const record = actor?.flags?.essence20?.[DEFIB_FLAG];
    if (!record) {
      continue;
    }

    if (record.combatId != combat.id) {
      await actor.unsetFlag('essence20', DEFIB_FLAG);
    } else if (defibrillatorReady(record, combat)) {
      await actor.unsetFlag('essence20', DEFIB_FLAG);
      await finishDefibrillator(actor, record);
    }
  }
});
