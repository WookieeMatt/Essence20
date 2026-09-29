/**
 * Small, import-light checks the core roll code asks (patched in by zord2-patch.cjs):
 *
 * - zord2NoUntrainedSnag (roll-dialog.mjs#_isUntrainedSnag):
 *   Shinobi of the 63rd Hexagram (Intercontinental Adventures, p.9): "You roll Driving Skill Tests
 *   to drive motorcycles without a Snag, even if you have no Ranks in the Driving Skill."
 *   Steady Hands Hybridization (TF CRB, Modemaster, p.74): "You do not suffer a Snag on unskilled
 *   Skill Tests" - for the Mass Shift's duration (./hybridization.mjs).
 * - zord2IgnoresLimitedArticulation (dice.mjs, Limited Articulation block):
 *   Helping Hand Hybridization (TF CRB p.74): "Ignore your Origin's Limited Articulation drawback."
 */
import { isActiveForWindow } from "../../scene-clock.mjs";
import { holds, itemsOf, sourceOf, ZORD2 } from "./common.mjs";

export const STEADY_HANDS_FLAG = 'zord2SteadyHands';
export const HYBRID_FLAG = 'zord2Hybrid';

/** The Hybridization choices an actor holds. */
export const hybridsOf = actor => itemsOf(actor).filter(i => sourceOf(i) == ZORD2.hybridization)
  .map(i => i.flags?.essence20?.[HYBRID_FLAG]).filter(Boolean);

const MOTORCYCLE = /(cycle|motorbike|bike|chopper)/i;

export function zord2NoUntrainedSnag(actor, skill) {
  if (hybridsOf(actor).includes('steadyHands') && isActiveForWindow(actor, STEADY_HANDS_FLAG, 'scene')) {
    return true;
  }

  if (skill == 'driving' && holds(actor, ZORD2.shinobi)) {
    const vehicle = actor?._dice?._getPilotedVehicle?.(actor, 'driver');
    return !!vehicle && MOTORCYCLE.test(vehicle.name ?? '');
  }

  return false;
}

export function zord2IgnoresLimitedArticulation(actor) {
  return hybridsOf(actor).includes('helpingHand');
}
