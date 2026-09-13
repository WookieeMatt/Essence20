/**
 * Dig In (Enigma of Combination, Cannoneer Focus, Gunner, 17th level, p.32): "As a Move action,
 * you can Dig In to any physical object at least half your size that provides Cover. Once Dug In,
 * the Cover imposes an additional -1 to attacks against you; in addition, you ignore the Mounted
 * trait of your weapons, and when you spend a Free action to Aim, you gain +2 instead of +1. You
 * no longer benefit from Dig In if you move or are moved for any reason."
 *
 * A same-named but textually distinct Perk from Decepticon Directive's own Dig In (grapple/shove/
 * trip Snag + Prone immunity) - a separate flag/toggle, not a shared mechanic. Same plain on/off
 * actor-flag toggle shape as that other Dig In (helpers/dig-in.mjs), switched by the Perk's own
 * sheet "Use" button. "Until you move or are forcibly moved" has no active enforcement (no
 * movement-completion hook exists) - the same documented "approximate duration, don't hard-enforce
 * it" idiom used throughout this project - a player/GM toggles it off manually.
 *
 * The "physical object at least half your size providing Cover" precondition isn't verified (no
 * object-size/Cover-source tracking exists to check against) - the same "trust the player to use
 * it at the right narrative moment" idiom already applied elsewhere. "Ignore the Mounted trait" is
 * a no-op - Mounted has zero mechanical effect anywhere in this codebase (same confirmed finding
 * as Snipe From The Hip/Ordnance Expert).
 *
 * The Cover-penalty-additional-1 half is read directly in dice.mjs's own Cover shift-down check
 * (right alongside Maximize Cover/What Cover?); the Aim-bonus-becomes-2 half is read in
 * dice.mjs's own aimBonus computation, alongside Distance Vision's identical "2 instead of 1"
 * upgrade.
 */
const CANNONEER_DIG_IN_FLAG = 'cannoneerDugIn';

export function isCannoneerDugIn(actor) {
  return !!actor.getFlag?.('essence20', CANNONEER_DIG_IN_FLAG);
}

/**
 * Flips the actor's own Cannoneer Dig In stance. Returns the new state (true = now dug in).
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function toggleCannoneerDigIn(actor) {
  const nowDugIn = !isCannoneerDugIn(actor);
  await actor.setFlag('essence20', CANNONEER_DIG_IN_FLAG, nowDugIn);
  return nowDugIn;
}
