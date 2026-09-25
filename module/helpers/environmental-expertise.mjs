/**
 * Environmental Expertise (GI Joe CRB, Ranger base, 1st/9th/18th level, p.90): "When subject to
 * the conditions of your environment of expertise, you gain several benefits: You ignore the
 * penalties for moving through Rough Terrain in your environment of expertise. You gain an Edge
 * on non-combat Skill Tests in your environment of expertise, and all of your attacks in your
 * environment of expertise are considered Specialized."
 *
 * "Environment of expertise" (which specific environment(s) the actor picked) is already recorded
 * generically via the existing `hasChoice: true, choiceType: "environments"` mechanism - but
 * whether the actor is CURRENTLY physically in one of their own chosen environments has no hook
 * to check automatically (this system tracks no scene/terrain tagging at all - the same gap
 * already documented for Environmental Armor/Prowl/Stalk/Recon). Unlike those PASSIVE, always-on
 * effects, this is built as a plain on/off toggle (same shape as Dig In/Bulwark) the player
 * switches themselves when they judge themselves to be in-environment - the same "player
 * self-polices the fictional trigger" idiom this project already accepts for Natural Movement's
 * own identical precondition, rather than either forcing the bonus on unconditionally (too large
 * an over-grant for a Role-defining ability) or leaving it fully unbuilt.
 *
 * "Ignore Rough Terrain penalties" stays unbuilt - Rough Terrain isn't a distinct movement-cost
 * concept anywhere in this system (grepped, zero hits), so there's no penalty to waive in the
 * first place, the same "no existing penalty to intercept" no-op class as Over Brawn/Ordnance
 * Expert's own weapon-requirements waivers earlier this project.
 */
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
// a scene." This project's own Environmental Expertise mechanism already collapsed "which specific
// environment" down to a single blanket toggle (see this file's own top doc comment - no per-
// environment tracking exists to check "in your environment of expertise" against in the first
// place), so Read The Land's own "a DIFFERENT environment" nuance was already unenforceable before
// this Perk even existed - it reuses the exact same toggle/flag, just reachable without holding
// the base Perk, and costing a Story Point to switch ON (free to switch back OFF, the same
// "pay only to activate" idiom Power Boost/Power Adaptation's own toggles already established).
export const READ_THE_LAND_ID = "Compendium.essence20.intercontinental_adventures.Item.j8wVLLK4XvVEuP6F";

// Adaptation (GI Joe CRB, Ranger base, 2nd level, p.91): "you gain a pool of Adaptation Points. As
// a Free action, you can spend an Adaptation Point to use one of your Environment Expertise or
// environment exposure abilities outside of your environments of expertise." Same "which specific
// environment" collapse as Read The Land above - reuses the identical toggle/flag, just costing an
// Adaptation Point (the actor's own base rolePoints resource, same actor._getBaseRolePoints()
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
 * Whether this actor currently qualifies for Environmental Expertise's own bonuses - holds at
 * least one instance of the Perk (any of their up to 3 chosen environments) AND has the toggle
 * switched on.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function hasActiveEnvironmentalExpertise(actor) {
  return (actorHasPerk(actor, ENVIRONMENTAL_EXPERTISE_ID) || actorHasPerk(actor, READ_THE_LAND_ID))
    && isEnvironmentalExpertiseActive(actor);
}
