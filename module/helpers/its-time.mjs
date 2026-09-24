/**
 * It's Time (Field Guide to Action and Adventure, General Perk, p.70): "Prerequisite: Role without
 * the It's Morphin Time! Faction Perk. As a Standard action, you gain the benefits of all Perks
 * that require you to be Morphed until the end of the scene."
 *
 * The prerequisite means a holder never has a real Morph action of their own (isMorphed's usual
 * driver, sheet-handlers/power-ranger-handler.mjs#onMorph, is gated behind Role Perks this actor
 * doesn't have) - so there's no risk of double-toggling against a real Morph. Since every existing
 * "while Morphed" check throughout this codebase reads the plain data/actor/templates/character.mjs
 * isMorphed boolean directly, granting "the benefits of all Perks that require you to be Morphed"
 * is exactly toggling that same field - deliberately NOT calling onMorph() itself, which carries
 * Power-Ranger-specific side effects (image-swap via system.image.morphed/unmorphed, Boosted Vigor,
 * Growth Boost, Powered Plating cleanup) that have nothing to do with this Perk's own RAW effect and
 * could visibly swap this actor's token image for no in-fiction reason.
 *
 * "Until the end of the scene" has no active enforcement (no scene-boundary hook exists anywhere in
 * this codebase - the same accepted "approximate duration, GM/player manages the edges" idiom as
 * Dig In's own "until you move" clause) - a player/GM toggles it back off manually via the same
 * button.
 */
export function isItsTimeActive(actor) {
  return !!actor.system.isMorphed;
}

/**
 * Flips the actor's own isMorphed flag directly, bypassing onMorph()'s Power-Ranger-specific side
 * effects. Returns the new state (true = now benefiting from Morphed-gated Perks).
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function toggleItsTime(actor) {
  const nowActive = !isItsTimeActive(actor);
  // The Morphed status and ring tint follow the flag (helpers/morph-state.mjs); the chat line
  // does not - this Perk is not a Morph, and its own card already said what happened.
  await actor.update({ "system.isMorphed": nowActive }, { essence20: { silentState: true } });
  return nowActive;
}
