import { actorHasZordFeature } from "./zord-features.mjs";

/**
 * R.R.R. (Rapid Rescue Response) (Across the Stars, Zord Feature, p.104, prerequisite Crew
 * Compartment): "Any damaged being currently inside the cockpit or Crew Compartment of your Zord
 * has a 50% chance to regain 1 Health at the end of every round (roll 1d2; Health is regained on a
 * 2)." Same "crew" resolution (system.actors, live-resolved) as helpers/zord-mega-weapon.mjs's own
 * private getCrew() - not imported from there since that one additionally filters to crew who can
 * afford a Personal Power spend, a condition specific to the Mega-Weapon and not this heal.
 *
 * Wired into essence20.mjs's own "combatRound" hook - unlike Regenerating Shell's per-TURN heal
 * (helpers/power-adaptation.mjs), R.R.R. is a once-per-ROUND tick with no "whose turn is it"
 * scoping at all, so it iterates every Zord actually in the fight (combat.combatants) rather than
 * reading combat.combatant for a single ending turn.
 */
export const RAPID_RESCUE_RESPONSE_ID = "Compendium.essence20.across_the_stars.Item.pcavWqFi6FZ8QBAf";

/**
 * Every living being currently resolvable as a "crew" member of this Zord - see this file's own
 * doc comment for why this isn't zord-mega-weapon.mjs's own getCrew().
 * @param {Actor} zord
 * @returns {Actor[]}
 */
function getRapidRescueResponseCrew(zord) {
  return Object.values(zord.system?.actors ?? {})
    .map(entry => fromUuidSync(entry.uuid))
    .filter(crew => crew);
}

/**
 * Rolls R.R.R.'s own 1d2-on-a-2 chance for every damaged crew member of every Zord in the given
 * Combat that holds the Feature, healing 1 Health on a hit. A no-op for a crew member already at
 * full Health, or for a Zord without the Feature.
 * @param {Combat} combat
 * @returns {Promise<void>}
 */
export async function healRapidRescueResponseAtRoundEnd(combat) {
  for (const combatant of combat?.combatants ?? []) {
    const zord = combatant.actor;
    if (zord?.type != 'zord' || !actorHasZordFeature(zord, RAPID_RESCUE_RESPONSE_ID)) {
      continue;
    }

    for (const crewMember of getRapidRescueResponseCrew(zord)) {
      const { value, max } = crewMember.system.health ?? {};
      if (value == null || value >= max) {
        continue;
      }

      const roll = await new Roll('1d2').evaluate();
      if (roll.total == 2) {
        await crewMember.update({ 'system.health.value': Math.min(max, value + 1) });
      }
    }
  }
}
