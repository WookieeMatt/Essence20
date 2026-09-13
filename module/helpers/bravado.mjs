import { actorHasPerk } from "./perks.mjs";
import { isRecklessAbandonItem } from "./reckless-abandon.mjs";

/**
 * Bravado (GI Joe CRB, Renegade base, 13th level, p.97): "if you begin a combat encounter with no
 * uses of Reckless Abandon remaining, you regain one use of Reckless Abandon." Checked once,
 * when combat actually begins (Foundry's own "combatStart" hook, essence20.mjs), the same
 * "settle everyone's state once at the top of the encounter" shape Time To Think's own
 * applyTimeToThinkEdge already establishes - iterates every combatant, not just one actor, since
 * this can apply to any Renegade in the fight.
 * @param {Combat} combat
 */
const BRAVADO_ID = "Compendium.essence20.gi_joe_crb.Item.dB5C6frDKWJKXVay";

export async function applyBravado(combat) {
  const combatants = (combat?.combatants ?? []).filter(c => c.actor);
  for (const combatant of combatants) {
    const actor = combatant.actor;
    if (!actorHasPerk(actor, BRAVADO_ID)) {
      continue;
    }

    const rolePoints = actor._getBaseRolePoints?.();
    if (isRecklessAbandonItem(rolePoints) && rolePoints.system.resource.value === 0) {
      await rolePoints.update({ 'system.resource.value': 1 });
    }
  }
}
