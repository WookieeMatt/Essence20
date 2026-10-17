import { registerEvent } from "../../types.mjs";
import { rulesOfType } from "../../index.mjs";
import { worldActors } from "../shared/team-and-availability-helpers.mjs";

/**
 * Group E (round 10): the `equipmentBroke` Trigger event (Junker) - a weapon / armor / shield broke, or a vehicle was
 * destroyed. installEquipmentBroke() (called from picks/picks-and-grants-setup.mjs) watches for both.
 */

registerEvent('equipmentBroke');

/** Run every world actor's equipmentBroke Triggers (a weapon / armor / shield broke, or a vehicle was destroyed). */
export async function equipmentBroke(item = null) {
  const { fireTriggers } = await import("../../triggers.mjs");
  for (const actor of worldActors().filter(other => rulesOfType(other, 'Trigger').some(entry => entry.rule.event == 'equipmentBroke'))) {
    await fireTriggers(actor, 'equipmentBroke', { roll: item ? { item } : {} });
  }
}

const HEALTH_BEFORE = 'e20ExtEHealthBefore';

export function installEquipmentBroke() {
  const Hooks = globalThis.Hooks;
  if (!Hooks?.on) {
    return;
  }

  // equipmentBroke, on the client that made the change: a weapon / armor / shield flagged broken (Desperate Parry),
  // or a vehicle / Zord / Megaform brought to 0 Health.
  Hooks.on('updateItem', (item, changes, options, userId) => {
    if (userId == globalThis.game?.user?.id && globalThis.foundry?.utils?.getProperty?.(changes, 'flags.essence20.broken') === true
      && ['weapon', 'armor', 'shield'].includes(item.type)) {
      equipmentBroke(item).catch(error => console.error('Essence20 | equipmentBroke failed', error));
    }
  });
  Hooks.on('preUpdateActor', (actor, changes, options) => {
    options[HEALTH_BEFORE] = actor.system?.health?.value ?? null;
  });
  Hooks.on('updateActor', (actor, changes, options, userId) => {
    const health = globalThis.foundry?.utils?.getProperty?.(changes, 'system.health.value');
    if (userId == globalThis.game?.user?.id && ['vehicle', 'zord', 'megaform'].includes(actor.type)
      && health !== undefined && Number(health) <= 0 && (options?.[HEALTH_BEFORE] ?? 1) > 0) {
      equipmentBroke().catch(error => console.error('Essence20 | equipmentBroke failed', error));
    }
  });
}
