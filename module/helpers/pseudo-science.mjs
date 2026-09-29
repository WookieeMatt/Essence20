import { activateForWindow, isActiveForWindow } from "./scene-clock.mjs";

/**
 * "Pseudo"-Science (WTNV Citizen's Guide, Scientist Role, Night Vale Community College Focus,
 * p.44): "Once per session, you can substitute Science for any other Skill as you can make up a
 * new law of science or mathematics. You can use this substitution until the end of the session."
 *
 * A one-shot activation (not a toggle a player would ever switch back off early, unlike Power
 * Boost/Gravity Optional - there's no in-fiction reason to stop being able to invoke pseudo-
 * science once you've started) - the flag itself, once set, IS the "already used this session"
 * marker (unlike hasUsedThisEncounter's own combat-scoped bucket, this persists across scenes,
 * matching RAW's own "until the end of the session" wording more closely than an
 * encounter-scoped flag would). A session is the Scene Clock's 'mission' window, this system's
 * closest stand-in: the flag is stamped with the mission epoch, so once the GM starts a new
 * mission it reads as expired and the Perk can be used again.
 *
 * While active, dice.mjs offers a "Use Science instead" checkbox on any Skill Test other than
 * Science itself - the same shift-position-delta substitution mechanism
 * How Strange!/Mightier Than the Sword already establish, just unscoped to any skill instead of
 * one.
 */
const PSEUDO_SCIENCE_FLAG = 'pseudoScienceActive';

export function isPseudoScienceActive(actor) {
  return !!actor?.getFlag && isActiveForWindow(actor, PSEUDO_SCIENCE_FLAG, 'mission');
}

export async function activatePseudoScience(actor) {
  await activateForWindow(actor, PSEUDO_SCIENCE_FLAG, 'mission');
}
