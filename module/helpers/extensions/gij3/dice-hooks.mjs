import { actorHasPerk } from "../../perks.mjs";
import { ruleIgnoresMissEffects } from "../../../rules/ext/b/readers.mjs";

/**
 * The few gij3 rules that have to sit inside the roll itself, called from dice.mjs and
 * helpers/rough-terrain.mjs (SCRATCH/integration/gij3-patch.cjs adds the calls). Kept synchronous
 * and light - this file imports nothing heavier than perks.mjs and the rules index, so dice.mjs can import it at the top.
 * (Takedown Expert's choice is a miss Trigger on its pack item now.)
 */

const HAWK = "Compendium.essence20.general_hawk_s_personel_files.Item.";

export const BETTER_THAN_THE_BEST_ID = `${HAWK}1Xy3GpglIFAq3sqc`;

function resolveActor(actorOrUuid) {
  if (!actorOrUuid) {
    return null;
  }

  if (typeof actorOrUuid != 'string') {
    return actorOrUuid;
  }

  try {
    const doc = fromUuidSync(actorOrUuid);
    return doc?.documentName == 'Token' ? doc.actor : (doc ?? null);
  } catch (error) {
    return null;
  }
}

/**
 * Better than the Best (Hawk's Personnel Files, Old Hand, 10th level, p.165): "when you roll a 20
 * on the d20 during a Skill Test, you succeed at the Skill Test. If you would already succeed at
 * the Skill Test normally, it is considered a Critical Success." Read off the kept d20 (the one
 * an Edge/Snag keeps - Foundry's `values` are the active results only).
 * @param {Actor} actor   The roller.
 * @param {Roll} roll
 * @param {Number} multiplier   This entry's Degrees of Success so far (0 miss, 1 success, 2+ crit).
 * @returns {Number}   The new multiplier.
 */
export function betterThanTheBestMultiplier(actor, roll, multiplier) {
  if (!actorHasPerk(actor, BETTER_THAN_THE_BEST_ID)) {
    return multiplier;
  }

  const d20 = (roll?.dice ?? []).find(pool => pool.faces === 20);
  const values = d20?.values ?? (d20?.results ?? []).filter(r => r.active !== false).map(r => r.result);
  if (!values?.includes?.(20)) {
    return multiplier;
  }

  return multiplier > 0 ? Math.max(multiplier, 2) : 1;
}

/**
 * Whether a miss has no effect at all on this target - the miss-effects this system applies (Trigger
 * Happy's Frightened, Explosive Aftershock, a Wrecker weapon's Rough Terrain) are skipped. The
 * target's MissImmunity rules answer (Seconds Between Click & Boom: against its Evasion - rules/ext/b/readers.mjs).
 * @param {String} defenseType   The Defense the attack was compared against.
 * @param {Actor|String} target   The defender, or its uuid.
 * @returns {Boolean}   True when a miss must have no effect at all on this target.
 */
export function ignoresMissEffects(target, defenseType = 'evasion') {
  const actor = resolveActor(target);
  return !!actor && ruleIgnoresMissEffects(actor, defenseType);
}
