import { actorHasPerk } from "./perks.mjs";
import { getNearbyAllyTokens } from "./allies.mjs";

/**
 * Exemplary (GI Joe CRB, Focus: Frontline Leader, 10th level, p.87): "when a teammate who can see
 * you takes an action that requires a Skill Test that you took on your last turn, they gain an
 * Edge on their Skill Test."
 *
 * "On your last turn" is approximated as "the last Skill Test this actor rolled at all" (the same
 * "approximate duration/turn-scoping" idiom this project already applies everywhere a strict
 * per-turn window isn't practically trackable), recorded on every roll the holder makes,
 * regardless of success - RAW cares that they "took" the Skill Test, not that they succeeded.
 * "Can see you" is dropped, same unenforceable-precondition idiom as elsewhere; "teammate" is
 * approximated as "any nearby ally," the same disposition-based proxy every other ally-facing
 * check in this project already uses.
 */
const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
export const EXEMPLARY_ID = `${GI_JOE_CRB}jpu756uKYfydTu16`;
const EXEMPLARY_LAST_SKILL_FLAG = 'exemplaryLastSkill';

/**
 * Records the skill just rolled, if this actor holds Exemplary - a no-op otherwise.
 * @param {Actor} actor
 * @param {String} skill
 */
export async function recordExemplaryRoll(actor, skill) {
  if (actorHasPerk(actor, EXEMPLARY_ID)) {
    await actor.setFlag('essence20', EXEMPLARY_LAST_SKILL_FLAG, skill);
  }
}

/**
 * Whether any nearby ally holds Exemplary and last rolled this same skill - if so, this roll
 * gains the Edge Exemplary grants.
 * @param {Actor} actor   The actor about to roll.
 * @param {String} rolledSkill
 * @returns {Boolean}
 */
export function hasNearbyExemplaryMatch(actor, rolledSkill) {
  return getNearbyAllyTokens(actor, Infinity).some(token => (
    actorHasPerk(token.actor, EXEMPLARY_ID)
    && token.actor.getFlag?.('essence20', EXEMPLARY_LAST_SKILL_FLAG) == rolledSkill
  ));
}
