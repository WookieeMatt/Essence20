/**
 * Environmental Expertise (GI Joe CRB, Ranger base, 1st/9th/18th level, p.90): "When subject to
 * the conditions of your environment of expertise, you gain several benefits: You ignore the
 * penalties for moving through Rough Terrain in your environment of expertise. You gain an Edge
 * on non-combat Skill Tests in your environment of expertise, and all of your attacks in your
 * environment of expertise are considered Specialized."
 *
 * "Environment of expertise" (which specific environment(s) the actor picked) is recorded via the
 * existing `hasChoice: true, choiceType: "environments"` mechanism, onto the actor's own
 * `system.environments` array (perk-handler.mjs). Whether the actor is CURRENTLY in one of them is
 * read off the scene: a GM can set a scene's terrain (biome) on its Scene Config, and override it
 * for part of the map with an Environment Region (helpers/environment.mjs#getTerrain).
 *   - Terrain known: the actor is in their environment of expertise exactly when that terrain is
 *     one of their chosen environments - automatic, no toggle needed. Outside it, the toggle flag
 *     below still grants the benefits: that's how Adaptation / Read The Land (which buy the
 *     benefits OUTSIDE your environments of expertise) keep working, and the base Perk's own free
 *     toggle stays available as a GM-visible manual override (it posts a chat card) for a map the
 *     GM hasn't tagged precisely.
 *   - No terrain set anywhere: exactly the old behavior - a plain on/off toggle (same shape as Dig
 *     In/Bulwark) the player switches themselves when they judge themselves to be in-environment.
 * Every "in your environment of expertise" Perk reads the same answer through this file
 * (hasActiveEnvironmentalExpertise for the ones that need the base Perk, meetsEnvironmentOfExpertise /
 * isKnownOutsideEnvironmentOfExpertise for the rest): Environmental Armor, Prowl, Recon, Tracker,
 * Survivalist, Taking Point, Stalk, Natural Movement, Dirty Trick, Animal Gait.
 *
 * "Ignore the penalties for moving through Rough Terrain" is helpers/rough-terrain.mjs's
 * ignoresRoughTerrain, which reads hasActiveEnvironmentalExpertise below.
 */
import { E20 } from "./config.mjs";
import { getTerrain } from "./environment.mjs";
import { actorHasPerk } from "./perks.mjs";

const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
export const ENVIRONMENTAL_EXPERTISE_ID = `${GI_JOE_CRB}EbbSUA2vSHyv3MjQ`;
const ENVIRONMENTAL_EXPERTISE_FLAG = 'environmentalExpertiseActive';

// Guidance (Focus: Scout, 10th level, p.94): "as a Free action in your environment of expertise,
// you can spend an Adaptation Point to grant an ally the benefits of your Environmental Expertise
// until the beginning of your next turn." Dispatched via BANKABLE_PERKS in banked-buffs.mjs
// (spendsRolePoint: true, target: 'ally') - banks this bare marker flag (no data payload needed),
// read back in dice.mjs's own Environmental Expertise check alongside the toggle itself. "Until
// the beginning of your next turn" is this project's usual "consumed on the very next roll"
// approximation.
export const GUIDANCE_ID = `${GI_JOE_CRB}yVxdYbSfMWfaDQZR`;
export const PENDING_GUIDANCE_FLAG_KEY = 'pendingGuidance';

// Read The Land (Factions in Action Vol. 2, Ranger Focus, p.68): "At the beginning of a mission,
// choose an environment other than one of your Environments of Expertise. You may spend a Story
// Point to gain the benefits of Environmental Expertise in that environment for the remainder of
// a scene." It switches on the same toggle flag the base Perk uses, which is what grants the
// benefits wherever the scene's terrain ISN'T one of your environments of expertise (see this
// file's own top doc comment) - costing a Story Point to switch ON (free to switch back OFF, the
// same "pay only to activate" idiom Power Boost/Power Adaptation's own toggles already
// established). Which one environment it was bought for isn't recorded, so the flag covers any
// terrain for the rest of the scene.
export const READ_THE_LAND_ID = "Compendium.essence20.intercontinental_adventures.Item.j8wVLLK4XvVEuP6F";

// Adaptation (GI Joe CRB, Ranger base, 2nd level, p.91): "you gain a pool of Adaptation Points. As
// a Free action, you can spend an Adaptation Point to use one of your Environment Expertise or
// environment exposure abilities outside of your environments of expertise." Same toggle/flag as
// Read The Land above, just costing an Adaptation Point (the actor's own base rolePoints resource, same actor._getBaseRolePoints()
// lookup Guidance/Heart of the Team already use) instead of a Story Point to switch ON.
export const ADAPTATION_ID = `${GI_JOE_CRB}PmY8jGTiemnSdsHi`;

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isEnvironmentalExpertiseActive(actor) {
  return !!actor.getFlag?.('essence20', ENVIRONMENTAL_EXPERTISE_FLAG);
}

/**
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   The new active state.
 */
export async function toggleEnvironmentalExpertise(actor) {
  const nowActive = !isEnvironmentalExpertiseActive(actor);
  await actor.setFlag('essence20', ENVIRONMENTAL_EXPERTISE_FLAG, nowActive);
  return nowActive;
}

/**
 * The environments of expertise the actor chose (E20.environments keys).
 * @param {Actor} actor
 * @returns {Array<String>}
 */
export function getExpertiseEnvironments(actor) {
  return actor?.system?.environments ?? [];
}

/**
 * Whether the scene says the actor is in one of their environments of expertise: true/false when
 * a terrain is set for where their token stands (see helpers/environment.mjs#getTerrain), or null
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
 * Whether this actor currently qualifies for Environmental Expertise's own bonuses - holds the
 * Perk (or Read The Land) AND meetsEnvironmentOfExpertise() above.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function hasActiveEnvironmentalExpertise(actor) {
  return (actorHasPerk(actor, ENVIRONMENTAL_EXPERTISE_ID) || actorHasPerk(actor, READ_THE_LAND_ID))
    && meetsEnvironmentOfExpertise(actor);
}

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
