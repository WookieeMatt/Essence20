import { actorHasHangUp, findPerk } from "../../mechanics/characters/perks.mjs";

export const AGENCY = {
  hangUp: "Compendium.essence20.across_the_stars.Item.QZpWbKjMxMdahpoL",
  perk: "Compendium.essence20.across_the_stars.Item.bGKG7artYs7uHHz4",
};

/**
 * Agency (Across the Stars, Hang-Up, p.42): "When you Fumble in your agency's Skill, you do not
 * generate a Story Point as you normally would." The agency's Skill is the Agency Influence Perk's
 * own skill choice. Read by dice.mjs's Fumble grant (scratchpad integration/react-patch.cjs).
 * @param {Actor} actor
 * @param {String} skill
 * @returns {Boolean}
 */
export function suppressesFumbleStoryPoint(actor, skill) {
  if (!skill || !actorHasHangUp(actor, AGENCY.hangUp)) {
    return false;
  }

  const choice = findPerk(actor, AGENCY.perk)?.system?.choice;
  return !!choice && choice == skill;
}
