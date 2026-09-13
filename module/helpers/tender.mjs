/**
 * Tender (MLP CRB, Spirit of Kindness, 6th level, p.85): "You can make an Empathy Skill Test
 * targeting a creature's Willpower. On a success, the creature gets a downshift on all Skill
 * Tests for aggressive actions. This penalty lasts until you or one of your friends acts
 * aggressively towards the creature or the scene ends."
 *
 * "Empathy" here means whichever skill the actor chose via the Empathy Perk's own
 * choiceType:'skills' pick (see dice.mjs's own EMPATHY_MLP_ID comment) - a real Skill Test, so
 * this triggers via actor._dice.rollSkill() with a synthetic dataset, the same "trigger a real
 * dialog roll" shape Duty Of The Graphite/Absolute Menace already established, aimed at whichever
 * ONE enemy the player has targeted. "For aggressive actions" has no fixed action-type
 * classification to scope a Snag to, so - same idiom as Bits To Spare/Truthseeker's own dropped
 * qualifiers - the penalty applies unscoped, consumed on the target's own next roll (this
 * project's usual "until removed" approximation) rather than tracked until an aggressive act or
 * scene end.
 */
import { actorHasPerk } from "./perks.mjs";

const EMPATHY_MLP_ID = "Compendium.essence20.mlp_crb.Item.7k1UXzSKyoV8EtXZ";
const TENDER_ID = "Compendium.essence20.mlp_crb.Item.xR4z6mV7Ab72TyVs";

export function hasTender(actor) {
  return actorHasPerk(actor, TENDER_ID);
}

/**
 * The Empathy skill the actor chose, or null if they haven't taken Empathy at all.
 * @param {Actor} actor
 * @returns {String|null}
 */
export function getEmpathyChoice(actor) {
  return actor.items?.find(
    i => i.type == 'perk' && i.flags?.core?.sourceId == EMPATHY_MLP_ID,
  )?.system.choice ?? null;
}

/**
 * Triggers the real Empathy-vs-Willpower Skill Test against whichever token is currently
 * targeted.
 * @param {Actor} actor
 */
export async function activateTender(actor) {
  const skill = getEmpathyChoice(actor);
  if (!skill) {
    return;
  }

  await actor._dice.rollSkill({
    skill,
    essence: CONFIG.E20.skillToEssence[skill] ?? 'social',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'willpower',
    isTender: true,
  }, actor);
}
