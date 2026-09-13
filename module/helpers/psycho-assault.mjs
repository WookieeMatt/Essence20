import { hasUsedThisTurn, markUsedThisTurn } from "./perks.mjs";
import { isMonsterFormActive } from "./monster-morph.mjs";

/**
 * Psycho Assault (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 5th level, p.285 etc.):
 * "Spend 1 Personal Power as a Free action to gain an upshift and +1 damage of the respective type
 * to all attacks this turn. Usable only when Morphed and not in Monster Form."
 *
 * Unlike every other one-shot "bank now, consumed by the next matching roll" Perk in this project
 * (banked-buffs.mjs's own BANKABLE_PERKS shape), this needs to keep applying across POTENTIALLY
 * SEVERAL attacks made the same turn, not just the first one - so rather than a single-consume
 * flag, it reuses this codebase's existing hasUsedThisTurn/markUsedThisTurn turn-identity stamp
 * (perks.mjs) with its "already used" semantics repurposed as "still valid this turn" - marking on
 * activation, then simply re-checking that same stamp on every roll for the rest of the turn. No
 * new turn-tracking infrastructure needed.
 */
export const PSYCHO_ASSAULT_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.yZ3rXt8z1jlCHlu7";
const PSYCHO_ASSAULT_FLAG = 'psychoAssaultActiveThisTurn';

export function isPsychoAssaultActive(actor) {
  return hasUsedThisTurn(actor, PSYCHO_ASSAULT_FLAG);
}

/**
 * Spends 1 Personal Power and marks the buff active for the rest of the current turn.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   True if activated, false if it couldn't be (not Morphed, in
 *   Monster Form, or can't afford 1 Personal Power).
 */
export async function activatePsychoAssault(actor) {
  if (!actor.system.isMorphed || isMonsterFormActive(actor) || (actor.system.powers?.personal?.value ?? 0) < 1) {
    return false;
  }

  await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
  await markUsedThisTurn(actor, PSYCHO_ASSAULT_FLAG);
  return true;
}
