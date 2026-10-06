import { registerTag } from "../../predicate.mjs";

/**
 * Round 15 (items2): `combat:lowestInitiative` - no other combatant that has rolled has a lower Initiative than this
 * actor (ties count: everyone tied for last), in the current combat. The mirror of the core `combat:highestInitiative`.
 * False when the actor isn't a combatant or hasn't rolled.
 */
export function lowestInitiativeTag(rest, ctx) {
  const combat = ctx?.combat;
  const list = combat?.combatants?.contents ?? (combat?.combatants ? [...combat.combatants] : []);
  const self = ctx?.self;
  const mine = list.find(c => c?.actor && self && (c.actor === self || (!!c.actor.uuid && c.actor.uuid == self.uuid)));
  if (!mine || mine.initiative == null) {
    return false;
  }

  // Combatants with no actor don't count (the old Time To Think check left them out).
  return list.every(c => c === mine || !c?.actor || c.initiative == null || c.initiative >= mine.initiative);
}

registerTag('combat:lowestInitiative', lowestInitiativeTag);

/** `combat:currentRolled` - whoever is acting now in the current combat has an Initiative (so @initiative.afterCurrent means something). */
export function currentRolledTag(rest, ctx) {
  const combat = ctx?.combat;
  const current = combat?.turns?.[combat?.turn ?? 0];
  return current?.initiative != null;
}

registerTag('combat:currentRolled', currentRolledTag);
