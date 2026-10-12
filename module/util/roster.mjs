/**
 * Taking an entry off a roster (`system.actors`: crew, Zords, Megaform members, a Party).
 *
 * An unlinked token's actor is its base actor plus the token's own changes (its ActorDelta), merged. A deletion leaves
 * nothing in those changes, so an entry the base actor has came straight back - deleting a crew card from a token's
 * sheet did nothing, from the actor's own sheet it worked. Foundry v14 has no way to delete a base key through a
 * delta (ForcedDeletion, ForcedReplacement and the old "-=" syntax all lose it), but a null does stick: the token
 * stores the entry as null, which outweighs the base's. Essence20Actor#prepareBaseData then drops null entries, so
 * nothing reading a roster ever sees one.
 */

/**
 * The value that removes a roster entry from this actor: a deletion, or null on an unlinked token's actor.
 * @param {Actor} actor
 */
export function rosterRemoval(actor) {
  return actor?.isToken ? null : new foundry.data.operators.ForcedDeletion();
}

/** An update removing these roster keys from the actor. */
export function rosterRemovalUpdate(actor, keys) {
  return Object.fromEntries(keys.map(key => [`system.actors.${key}`, rosterRemoval(actor)]));
}

/**
 * Drop the null entries a token's actor keeps for removed ones (prepared data only - its stored changes keep them).
 * @param {Object} system   The actor's system data, being prepared.
 */
export function dropRemovedRosterEntries(system) {
  const actors = system?.actors;
  if (!actors || typeof actors != 'object') {
    return;
  }

  for (const [key, entry] of Object.entries(actors)) {
    if (entry === null || entry === undefined) {
      delete actors[key];
    }
  }
}
