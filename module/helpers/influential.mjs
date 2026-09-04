import { findPerk } from "./perks.mjs";
import { getNearbyAllyTokens } from "./allies.mjs";

/**
 * Influential (Technician/Expert Focus, 3rd level, p.104): "your tendency to carry on about your
 * Field and use scientific terms in daily language rubs off on those who have to listen to you.
 * Your allies gain [an upshift of] 1 in Skill Tests related to your Field." Unlike Eureka/Expert
 * in Your Field (both self-only, keyed on the ROLLER's own Field), this buffs an ALLY's roll based
 * on the Perk-holder's own Field - the cross-actor "an ally's Perk buffs YOUR roll, resolved at
 * roll time" shape Shield Upgrade already established (helpers/personal-shield.mjs), just keyed on
 * a skill match instead of a Defense type.
 *
 * "Rubs off on those who have to listen to you" gives no explicit range, the same gap Got To Get
 * Tough's own "can see or hear you" hit - approximated at the same 30ft this codebase already
 * settled on there, rather than inventing a second unstated-range guess.
 */
const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
const INFLUENTIAL_ID = `${GI_JOE_CRB}TyQoZb2RTZWUwbpu`;
const FIELD_ID = `${GI_JOE_CRB}qHLeKSMin2F19O3C`;
const INFLUENTIAL_RADIUS_FEET = 30;

/**
 * The shiftUp a nearby Influential ally extends to the given actor's roll, if any. Doesn't stack
 * beyond +1 even with multiple qualifying allies nearby - the Perk only ever grants one upshift,
 * same "no piling on" precedent Shield Upgrade's own bestBonus already established.
 * @param {Actor} actor   The actor about to roll (not the Influential holder).
 * @param {String} rolledSkill   The skill being rolled, e.g. from dataset.skill.
 * @returns {Number}   0 or 1.
 */
export function getInfluentialShiftUp(actor, rolledSkill) {
  if (!rolledSkill) {
    return 0;
  }

  for (const token of getNearbyAllyTokens(actor, INFLUENTIAL_RADIUS_FEET)) {
    const ally = token.actor;
    if (!ally || ally == actor || !findPerk(ally, INFLUENTIAL_ID)) {
      continue;
    }

    const fieldPerk = findPerk(ally, FIELD_ID);
    if (fieldPerk?.system.choice == rolledSkill) {
      return 1;
    }
  }

  return 0;
}
