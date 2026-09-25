import { actorHasPerk } from "./perks.mjs";

/**
 * Secret Helper (MLP CRB, Spirit of Generosity, 3rd level, p.74): "if a friend fails a Skill Test,
 * you can roll your Skill Die (for the Skill they were using) and add it to their total. On your
 * next turn, you can't take a Standard action."
 *
 * RE-CATEGORIZED 2026-09-15. Its recorded blocker was "the general Lend Assistance action doesn't
 * exist" - now false, but reading the actual RAW shows that claim was wrong on its own terms too:
 * this is not Lend Assistance at all. Lend Assistance is declared BEFORE an ally rolls and feeds
 * into their roll options; Secret Helper fires AFTER a roll has already failed and adds a die to
 * an outcome that is on the table. So it rides the reactive post-roll chat-button path (Spite,
 * One-Upping, Suffer!) rather than helpers/lend-assistance.mjs, and nothing in that module is
 * touched here.
 *
 * Like One-Upping - and unlike Spite/Suffer!, which belong to whoever made the roll - the
 * beneficiary is a bystander, so the claimant is resolved from the VIEWING user's own character
 * rather than the message speaker, and each viewer only ever sees the button if their own
 * character qualifies.
 *
 * "On your next turn, you can't take a Standard action" is NOT enforced: this system has no
 * action-economy budget anywhere to spend against (the same confirmed gap that blocks Extra Attack
 * and this Perk's own later upgrades - Subtle Helper at 11th and Stealth Helper at 18th do nothing
 * BUT reduce that cost, so both remain genuinely unbuildable until an action economy exists).
 * Here the cost is simply left to the table, the way every other unenforceable action cost in this
 * project already is.
 */
export const SECRET_HELPER_ID = "Compendium.essence20.mlp_crb.Item.Vb3CAaAj9d1a63p7";

/**
 * The viewing user's own character, if it can help with this particular failed roll - it holds
 * Secret Helper and isn't the actor who just failed (RAW scopes this to "a FRIEND"). Disposition
 * isn't checked, matching findOneUppingClaimant's own reasoning: the button only ever appears to a
 * player whose own character holds the Perk, so the player self-polices the fiction.
 * @param {Actor} rollingActor   The actor whose Skill Test just failed.
 * @returns {Actor|null}
 */
export function findSecretHelperClaimant(rollingActor) {
  const claimant = game.user?.character;
  if (!claimant || claimant.id == rollingActor?.id || !actorHasPerk(claimant, SECRET_HELPER_ID)) {
    return null;
  }

  return claimant;
}

/**
 * The helper's own Skill Die for the skill the friend was using, or null if they have none. An
 * untrained skill sits at the bottom 'd20' shift, which contributes no die of its own to a roll
 * (see dice.mjs#_getFormula) - RAW asks for "your Skill Die," and an untrained helper simply
 * hasn't got one, so there is nothing to add rather than some substitute die.
 * @param {Actor} actor   The Secret Helper holder.
 * @param {String} skill
 * @returns {String|null}   A die formula such as 'd4', or null.
 */
export function getSecretHelperDie(actor, skill) {
  const shift = actor?.system?.skills?.[skill]?.shift;
  return (!shift || shift == 'd20') ? null : shift;
}

/**
 * Rolls the helper's Skill Die on top of the friend's already-resolved total.
 *
 * The Roll is built as "{their total} + {my die}" so the posted card shows the assisted number
 * outright, rather than a bare die the reader has to add up themselves. Nothing re-compares that
 * number against the original Difficulty - exactly the choice chat.mjs#rerollMessage already made
 * for a reroll ("the original message above it already showed that"), and for the same reason: the
 * failed roll's own card is still sitting right there with the Difficulty on it.
 * @param {Actor} actor   The Secret Helper holder.
 * @param {String} skill
 * @param {Number} originalTotal   The friend's failed total.
 * @returns {Promise<Roll|null>}   The evaluated Roll, or null if the helper has no Skill Die.
 */
export async function rollSecretHelperAssist(actor, skill, originalTotal) {
  const die = getSecretHelperDie(actor, skill);
  if (!die) {
    return null;
  }

  return new Roll(`${originalTotal} + ${die}`, actor.getRollData()).evaluate();
}
