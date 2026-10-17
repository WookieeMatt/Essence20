import { registerRef } from "../../formula.mjs";
import { registerRecipient } from "../../steps.mjs";
import { listOf, worldActors } from "../shared/chat-speaker-helpers.mjs";

/**
 * The teamCombatants recipient and @teamCombatants ref (round 10, group D - docs/rules-batches/slD10.md): an actor's
 * Party teammates who are in the running combat.
 */

/** The actor's teammates: everyone on any Party roster with it (itself included). */
export function teamOf(actor, actors = worldActors()) {
  const seen = new Map([[actor?.uuid, actor]]);
  for (const party of actors.filter(other => other?.type == 'party' && Object.values(other.system?.actors ?? {}).some(entry => entry?.uuid == actor?.uuid))) {
    for (const member of listOf(party.members)) {
      seen.set(member.uuid, member);
    }
  }

  return [...seen.values()].filter(Boolean);
}

/** Teammates (teamOf) who are combatants in the running combat - the actor too when it is one. */
export function teamCombatants(actor, combat = globalThis.game?.combat) {
  const uuids = new Set(listOf(combat?.combatants).map(c => c.actor?.uuid).filter(Boolean));
  return teamOf(actor).filter(member => uuids.has(member.uuid));
}

registerRecipient('teamCombatants', (match, ctx) => teamCombatants(ctx.actor));
registerRef('teamCombatants', (key, scope) => teamCombatants(scope.actor).length);
