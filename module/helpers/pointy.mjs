/**
 * Pointy (Dark Skies Over Equestria, General Perk, p.21): "You have the ability to manifest
 * sharp claws or teeth... Manifesting the natural weapon costs you a Free action and lasts until
 * the end of the combat scene. The weapon grants you ↑1 on attacks, and does Sharp damage."
 *
 * A plain on/off actor flag, toggled by the Perk's own sheet "Use" button - same shape as Dig In
 * (an ongoing stance, not a one-shot bank). "Until the end of the combat scene" has no active
 * enforcement (no scene-boundary hook exists in this codebase) - the same "approximate duration,
 * don't hard-enforce it" idiom Dig In's own doc comment already documents; a player/GM toggles it
 * back off manually.
 *
 * Only the ↑1-on-attacks half is read (dice.mjs, scoped to an unarmed weaponEffect attack, same
 * "no parent weapon" proxy Iron Hooves/Phantom Ranger Prime already use) - forcing the attack's
 * own damageType to Sharp isn't built, see POINTY_ID's own comment in dice.mjs for why.
 */
const POINTY_FLAG = 'pointyActive';

export function isPointyActive(actor) {
  return !!actor.getFlag?.('essence20', POINTY_FLAG);
}

/**
 * Flips the actor's own manifested-claws stance. Returns the new state (true = now active).
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function togglePointy(actor) {
  const nowActive = !isPointyActive(actor);
  await actor.setFlag('essence20', POINTY_FLAG, nowActive);
  return nowActive;
}
