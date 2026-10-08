/**
 * My Little Pony CRB - Betrayal (Hang-Up). (Self Improvement is the spell's own rules - rules/conv15-items2.test.js;
 * Dabbler is an item rule - rules/conv10-slE10.test.js.)
 */
import { isExpired } from "../../rules/expiry.mjs";

/*
 * Betrayal (MLP CRB, Hang-Up, p.59): when an assisted creature fails, the pony stops counting as the
 * other PCs' ally for Perks and abilities for the rest of the scene, unless another PC spends a
 * Friendship Point to mend it.
 *
 * The Hang-Up's own rules (rules/conv17-perm.test.js) do the rest: a rollSeen Trigger marks the pony who lent the
 * assistance (`betrayal`, until the scene ends) when the roll it helped fails, and posts the card whose button lets
 * another PC spend a Friendship Point to take the mark off. What stays here is the reader: the "not an ally" half is
 * mechanics/combat/nearby-allies.mjs#getNearbyAllyTokens (the one ally test Perks use), which skips a pair split by
 * betrayalSplits.
 */
export const BETRAYAL_MARK = 'betrayal';

/** Whether this actor carries a live Betrayal mark (its Hang-Up's rule set it this scene, and nobody healed it). */
export function isBetrayed(actor) {
  const mark = actor?.flags?.essence20?.ruleMarks?.[BETRAYAL_MARK];
  return !!mark && !isExpired(mark);
}

/** Whether two PCs are kept from counting as allies by a Betrayal. */
export function betrayalSplits(actor, other) {
  if (!actor || !other || actor === other || actor.uuid == other.uuid) {
    return false;
  }

  if (actor.type != 'playerCharacter' || other.type != 'playerCharacter') {
    return false;
  }

  return isBetrayed(actor) || isBetrayed(other);
}
