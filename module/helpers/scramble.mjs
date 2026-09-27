/**
 * Scramble (Transformers CRB, Scout, 6th level, p.86): "as a Standard action, you can force
 * attacks to target your Evasion, even if the attack normally dictates the Defense it targets. If
 * the attack hits and normally has an Effect with a numeric value (such as 1 Sharp), reduce the
 * numeric Effect by 1."
 *
 * The defense-forcing half is a plain on/off flag on the defender, read by dice.mjs's own
 * resolvedDefenseType resolution (see Fly In The Future's own identical shape,
 * helpers/evasive-maneuvers.mjs) - toggled here rather than measured, since "as a Standard
 * action" has no fictional trigger to detect. Unlike Fly In The Future (which only overrides a
 * Toughness default), Scramble's own "even if the attack normally dictates the Defense it
 * targets" is unconditional - it always resolves to Evasion while active, regardless of what the
 * attack (or the defender's own choice) would otherwise pick.
 *
 * The "reduce the numeric Effect by 1" half is NOT built - this codebase has no numeric-Effect-
 * value field anywhere (Stun/Sharp/etc. Effects are chat-card text, not a tracked number a script
 * could decrement), so there is nothing here to subtract 1 from.
 *
 * "Until when" is left as a manual toggle-off, same accepted duration idiom as Dig In/Evasive
 * Maneuvers - this project has no per-actor turn-boundary hook to clear it automatically.
 */
export const SCRAMBLE_ID = "Compendium.essence20.tf_crb.Item.Lo0GW0XGQ7caNb4P";
const SCRAMBLE_FLAG = 'scrambleActive';

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isScrambleActive(actor) {
  return !!actor?.getFlag?.('essence20', SCRAMBLE_FLAG);
}

/**
 * Toggles Scramble on the given actor.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   The new state.
 */
export async function toggleScramble(actor) {
  const nowActive = !isScrambleActive(actor);
  await actor.setFlag('essence20', SCRAMBLE_FLAG, nowActive);
  return nowActive;
}
