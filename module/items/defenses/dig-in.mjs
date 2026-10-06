/**
 * Dig In (Decepticon Directive Raider, Siegemaster Focus, 10th level, p.64): "As a Move action,
 * you can become dug in. Attacks that attempt to grapple, shove, or trip you while dug in suffer
 * Snag, and you're immune to the Prone Condition. This lasts until you move or are forcibly
 * moved."
 *
 * A plain on/off actor flag, toggled by the Perk's own sheet "Use" button - the first Perk-item
 * (as opposed to rolePoints-item, e.g. Reckless Abandon's isActive) toggle in this codebase, since
 * nothing existing fits ("bank now, consume on the next roll" doesn't apply - this is an ongoing
 * stance, not a one-shot). "Until you move or are forcibly moved" has no active enforcement (this
 * system has no movement-completion hook to clear it automatically) - the same documented
 * "approximate duration, don't hard-enforce it" idiom used throughout this project (see Got To Get
 * Tough's own doc comment) - a player/GM toggles it off manually via the same button.
 *
 * The Snag-vs-maneuver-attacks half is read directly in dice.mjs's own per-target modifier loop
 * (checks isDugIn() alongside actorHasPerk); the Prone-immunity half is read in
 * condition-immunity.mjs's own CONDITION_IMMUNITY_PERKS table via its requiresFlag field.
 */
const DIG_IN_FLAG = 'digInActive';

export function isDugIn(actor) {
  return !!actor.getFlag?.('essence20', DIG_IN_FLAG);
}

/**
 * Flips the actor's own dug-in stance. Returns the new state (true = now dug in).
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function toggleDigIn(actor) {
  const nowDugIn = !isDugIn(actor);
  await actor.setFlag('essence20', DIG_IN_FLAG, nowDugIn);
  return nowDugIn;
}
