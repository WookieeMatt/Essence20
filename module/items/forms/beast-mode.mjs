/**
 * Beast Mode (Cobra Codex, Ranger Guerilla Focus, 1st level, p.61): "You can spend an Adaptation
 * Point as a Free action to gain the Engrafted Mutation General Perk (see page 80) for 1 scene...
 * You do not need to meet the prerequisites of these General Perks, and you do not count as
 * having these General Perks for the purpose of meeting prerequisites or otherwise qualifying for
 * options."
 *
 * Engrafted Mutation's own base effect ("Gain a permanent Standard Genetic Alteration") is itself
 * a bare, unautomated gate in this codebase - confirmed by reading its own compendium item
 * directly (0 effects, no hasChoice/items map at all) - the earlier "Already built, no new code
 * needed" categorization of the Alteration-grant Perks means the PERK just permits the player to
 * separately drop a Genetic Alteration item (alteration-handler.mjs handles that drop generically),
 * not that the Perk itself auto-grants one. So Beast Mode's own grant only needs to add/remove
 * that same bare marker Item, same as Engrafted Mutation's normal, permanent pick - just via a
 * temporary copy instead.
 *
 * Only the 1st-level case (1 Engrafted Mutation) is built this pass - the 10th-level (2 Engrafted,
 * or 1 Evolving Mutation) and 20th-level (3 Engrafted / 2 Evolving / 1 Outright) scaling would need
 * their own "which of several escalating options" picker, not yet added.
 * "For 1 scene" has no scene-boundary hook to auto-expire against (this codebase has none) - the
 * same "approximate duration, toggle off manually" idiom Dig In/Power Boost/etc. already use.
 */

const ENGRAFTED_MUTATION_ID = "Compendium.essence20.cobra_codex.Item.zuR9YJ2Wy956VGGy";
const BEAST_MODE_GRANT_FLAG = 'beastModeGrantedItemId';

/**
 * Whether Beast Mode is currently active (has a live granted Engrafted Mutation copy).
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isBeastModeActive(actor) {
  const grantedId = actor.getFlag?.('essence20', BEAST_MODE_GRANT_FLAG);
  return !!grantedId && !!actor.items.get(grantedId);
}

/**
 * Toggles Beast Mode - switching ON spends 1 Adaptation Point (the Ranger base's own rolePoints
 * resource, the same actor._getBaseRolePoints() lookup Guidance/Heart of the Team already use)
 * and grants a temporary Engrafted Mutation Perk copy; switching OFF deletes it, no refund.
 * @param {Actor} actor
 * @returns {Promise<Boolean|null>}   The new active state, or null if unaffordable.
 */
export async function toggleBeastMode(actor) {
  if (isBeastModeActive(actor)) {
    const grantedId = actor.getFlag('essence20', BEAST_MODE_GRANT_FLAG);
    await actor.items.get(grantedId)?.delete();
    await actor.unsetFlag('essence20', BEAST_MODE_GRANT_FLAG);
    return false;
  }

  const rolePoints = actor._getBaseRolePoints?.();
  if (!rolePoints?.system.resource.value) {
    return null;
  }

  await rolePoints.update({ 'system.resource.value': rolePoints.system.resource.value - 1 });
  const engraftedMutation = await fromUuid(ENGRAFTED_MUTATION_ID);
  const [created] = await actor.createEmbeddedDocuments('Item', [engraftedMutation.toObject()]);
  await actor.setFlag('essence20', BEAST_MODE_GRANT_FLAG, created.id);
  return true;
}
