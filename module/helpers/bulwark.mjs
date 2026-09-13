/**
 * Bulwark (GI Joe CRB, Tank Focus, 17th level, p.99): "You can plant yourself as a Free action,
 * becoming a one-soldier fortress. Your movement becomes zero and you are immune to forced
 * movement and the Frightened Condition, and provide cover to allies adjacent to you."
 *
 * A plain on/off actor flag, the same "ongoing stance, no existing bank-now/consume-later shape
 * fits" idiom Dig In already established:
 * - Movement zeroed in documents/actor.mjs#_prepareMovement, the same permitted movement-math
 *   touch-point Warrior Rush/Air Born/etc. already use.
 * - Frightened immunity via condition-immunity.mjs's own `isActive` escape hatch (same shape as
 *   Dig In's own conditional Prone immunity).
 * - "Provide cover to adjacent allies" is a live reciprocal check in dice.mjs's own per-target
 *   cover block - see isBulwarkActive's own consumption there - rather than toggling a real
 *   `cover` status on every ally as the Bulwark holder moves (this codebase has no
 *   movement-completion hook to keep that in sync).
 * - "Immune to forced movement" is a no-op - forced movement isn't modeled as a distinct effect
 *   anywhere in this codebase (the same confirmed gap already blocking Explosive Aftershock's own
 *   push clause and Wrecking Ball entirely).
 */
const BULWARK_FLAG = 'bulwarkActive';

export function isBulwarkActive(actor) {
  return !!actor.getFlag?.('essence20', BULWARK_FLAG);
}

/**
 * Flips the actor's own planted stance. Returns the new state (true = now planted).
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function toggleBulwark(actor) {
  const nowPlanted = !isBulwarkActive(actor);
  await actor.setFlag('essence20', BULWARK_FLAG, nowPlanted);
  return nowPlanted;
}
