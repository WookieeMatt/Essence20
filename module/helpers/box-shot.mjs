import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

/**
 * Box Shot (Quartermaster's Guide to Gear, General Perk, p.28): "Once per combat, you can attack
 * two targets who are no further than 10 feet apart from each other with one Attack action."
 *
 * A plain on/off actor flag (the same "ongoing stance, not bank-now-consume-later" shape Dig In/
 * Metallikato's own Multiple Targets toggle already establish), gated on `hasUsedThisEncounter` to
 * TURN ON (RAW's own "once per combat" cap) but free to turn back off - "once per combat" is read
 * as capping how many times you can ACTIVATE it, not a forced auto-deactivate after one attack;
 * remembering to toggle it back off is the same unenforced player-bookkeeping detail this project
 * already accepts for every Free-action cost. The "10 feet apart" distance criterion between the
 * two targets isn't validated - no other Multiple Targets grant in this codebase enforces a
 * radius/range check either (Charge Into Battle's own unconditional grant has none), so this
 * matches existing precedent rather than being a new gap. See helpers/multiple-targets.mjs's own
 * isMultipleTargetsWeapon, which reads this flag directly.
 */
const BOX_SHOT_FLAG = 'boxShotActive';
const BOX_SHOT_ENCOUNTER_FLAG = 'boxShotUsedThisEncounter';

export function isBoxShotActive(actor) {
  return !!actor.getFlag?.('essence20', BOX_SHOT_FLAG);
}

export function canUseBoxShot(actor) {
  return isBoxShotActive(actor) || !hasUsedThisEncounter(actor, BOX_SHOT_ENCOUNTER_FLAG);
}

/**
 * Flips the actor's own Box Shot stance. Turning it ON marks the scene used (see canUseBoxShot);
 * turning it back OFF is always free. Caller is responsible for the canUseBoxShot gate.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   The new state (true = now active).
 */
export async function toggleBoxShot(actor) {
  const nowActive = !isBoxShotActive(actor);
  await actor.setFlag('essence20', BOX_SHOT_FLAG, nowActive);
  if (nowActive) {
    await markUsedThisEncounter(actor, BOX_SHOT_ENCOUNTER_FLAG);
  }
  return nowActive;
}
