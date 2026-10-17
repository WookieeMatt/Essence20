import { ruleIgnoresMissEffects } from "../../rules/plugins/combat/immunity-readers.mjs";

/**
 * Whether a miss has no effect at all on a target (Seconds Between Click & Boom), read inside the roll - called
 * from dice.mjs and mechanics/world/rough-terrain.mjs. Kept synchronous and light (it imports only the rules'
 * immunity readers), so dice.mjs can import it at the top.
 */

function resolveActor(actorOrUuid) {
  if (!actorOrUuid) {
    return null;
  }

  if (typeof actorOrUuid != 'string') {
    return actorOrUuid;
  }

  try {
    const doc = fromUuidSync(actorOrUuid);
    return doc?.documentName == 'Token' ? doc.actor : (doc ?? null);
  } catch (error) {
    return null;
  }
}

/**
 * Whether a miss has no effect at all on this target - the miss-effects this system applies (Trigger
 * Happy's Frightened, Explosive Aftershock, a Wrecker weapon's Rough Terrain) are skipped. The
 * target's MissImmunity rules answer (Seconds Between Click & Boom: against its Evasion - rules/plugins/combat/immunity-readers.mjs).
 * @param {String} defenseType   The Defense the attack was compared against.
 * @param {Actor|String} target   The defender, or its uuid.
 * @returns {Boolean}   True when a miss must have no effect at all on this target.
 */
export function ignoresMissEffects(target, defenseType = 'evasion') {
  const actor = resolveActor(target);
  return !!actor && ruleIgnoresMissEffects(actor, defenseType);
}
