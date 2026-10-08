/**
 * Environmental Expertise (GI Joe CRB, Ranger base, 1st/9th/18th level, p.90): in the environment
 * of expertise, Rough Terrain costs nothing extra, non-combat tests have Edge, and attacks count as
 * Specialized.
 *
 * "Environment of expertise" (which specific environment(s) the actor picked) is recorded via the
 * existing `hasChoice: true, choiceType: "environments"` mechanism, onto the actor's own
 * `system.environments` array (perk-handler.mjs). Whether the actor is CURRENTLY in one of them is
 * read off the scene: a GM can set a scene's terrain (biome) on its Scene Config, and override it
 * for part of the map with an Environment Region (mechanics/world/environment.mjs#getTerrain).
 *   - Terrain known: the actor is in their environment of expertise exactly when that terrain is
 *     one of their chosen environments - automatic, no toggle needed. Outside it, the toggle flag
 *     below still grants the benefits: that's how Adaptation / Read The Land (which buy the
 *     benefits OUTSIDE your environments of expertise) keep working, and the base Perk's own free
 *     toggle stays available as a GM-visible manual override (it posts a chat card) for a map the
 *     GM hasn't tagged precisely.
 *   - No terrain set anywhere: exactly the old behavior - a plain on/off toggle (same shape as Dig
 *     In/Bulwark) the player switches themselves when they judge themselves to be in-environment.
 * Who has the benefits themselves is the item rules' EnvironmentalExpertise rule type
 * (rules/plugins/effects/environmental-expertise-rule.mjs - on Environmental Expertise, Read The Land, and In Their
 * Element for a pet). Every "in your environment of expertise" Perk reads the same answer through this file
 * (hasActiveEnvironmentalExpertise for the ones that need the benefits, meetsEnvironmentOfExpertise /
 * isKnownOutsideEnvironmentOfExpertise for the rest): Environmental Armor, Prowl, Recon, Tracker,
 * Survivalist, Taking Point, Stalk, Natural Movement, Dirty Trick, Animal Gait.
 *
 * "Ignore the penalties for moving through Rough Terrain" is mechanics/world/rough-terrain.mjs's
 * ignoresRoughTerrain, which reads hasActiveEnvironmentalExpertise below.
 */
import { E20 } from "../../util/config.mjs";
import { getTerrain } from "./environment.mjs";
import {
  expertiseHelpers, ruleEnvironmentalExpertise, sharedExpertiseEnvironments,
} from "../../rules/plugins/effects/environmental-expertise-rule.mjs";

const ENVIRONMENTAL_EXPERTISE_FLAG = 'environmentalExpertiseActive';

// (Guidance's one-roll grant, Read The Land's and Adaptation's switches are Use rules on those items; the base Perk's
// own toggle too. They all set the same toggle flag, or a guidance mark the Guidance item's rules read.)

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isEnvironmentalExpertiseActive(actor) {
  return !!actor.getFlag?.('essence20', ENVIRONMENTAL_EXPERTISE_FLAG);
}

/**
 * The environments of expertise the actor chose (E20.environments keys).
 * @param {Actor} actor
 * @returns {Array<String>}
 */
export function getExpertiseEnvironments(actor) {
  const own = actor?.system?.environments ?? [];
  // An owner's companion-scoped EnvironmentalExpertise rule with shareEnvironments (In Their Element) adds theirs.
  const shared = sharedExpertiseEnvironments(actor);
  return shared.length ? [...new Set([...own, ...shared])] : own;
}

/**
 * Whether the scene says the actor is in one of their environments of expertise: true/false when
 * a terrain is set for where their token stands (see mechanics/world/environment.mjs#getTerrain), or null
 * when no terrain is set anywhere and only the manual toggle can say.
 * @param {Actor} actor
 * @param {?String} [terrain]   The terrain to test; defaults to the actor's own current terrain.
 * @returns {Boolean|null}
 */
export function isInEnvironmentOfExpertise(actor, terrain = getTerrain(actor)) {
  if (!terrain) {
    return null;
  }

  return getExpertiseEnvironments(actor).includes(terrain);
}

/**
 * Whether "in your environment of expertise" currently holds for the actor, for any Perk: the
 * scene's terrain is one of their environments of expertise, or the toggle flag is on (the manual
 * toggle when no terrain is set; an Adaptation / Read The Land purchase when it is).
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function meetsEnvironmentOfExpertise(actor) {
  return isInEnvironmentOfExpertise(actor) === true || isEnvironmentalExpertiseActive(actor);
}

/**
 * Whether the scene positively says the actor is OUTSIDE their environments of expertise (a
 * terrain is set, it isn't one of theirs, and no Adaptation / Read The Land flag covers it). False
 * when no terrain is set anywhere, so a Perk whose "in your environment of expertise" clause was
 * previously left to the player (Stalk, Natural Movement, Dirty Trick, Animal Gait) still works
 * exactly as before on an untagged scene, and is only switched off where the GM's tagging rules
 * it out.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isKnownOutsideEnvironmentOfExpertise(actor) {
  return isInEnvironmentOfExpertise(actor) === false && !isEnvironmentalExpertiseActive(actor);
}

/**
 * Whether this actor currently has Environmental Expertise's own bonuses: one of the EnvironmentalExpertise rules
 * reaching it holds (rules/plugins/effects/environmental-expertise-rule.mjs - on the Perk and Read The Land: in an
 * environment of expertise or switched on; on In Their Element for a pet: the owner's switch or the pet's terrain).
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function hasActiveEnvironmentalExpertise(actor) {
  return !!ruleEnvironmentalExpertise(actor);
}

// The rule type's terrain tag (self:inExpertiseTerrain) reads this file's terrain answer.
expertiseHelpers.inEnvironment = (actor, ...terrain) => isInEnvironmentOfExpertise(actor, ...terrain);
expertiseHelpers.terrainOf = actor => getTerrain(actor) ?? null;

/**
 * The Roll Options Dialog source label for a bonus an "environment of expertise" Perk grants:
 * the Perk's name, plus the terrain in parentheses when it's the scene's terrain (rather than the
 * toggle) that put the actor in their environment of expertise - so the player can see why.
 * @param {Actor} actor
 * @param {String} perkName
 * @returns {String}
 */
export function getEnvironmentOfExpertiseSourceLabel(actor, perkName) {
  const terrain = getTerrain(actor);
  if (!terrain || !getExpertiseEnvironments(actor).includes(terrain)) {
    return perkName;
  }

  return `${perkName} (${game.i18n.localize(E20.environments[terrain])})`;
}
