import {
  actorHasPerk, getUsesThisEncounter, hasUsedThisEncounter, markUsedThisEncounter, markUsedThisEncounterCount,
  postPerkUseChatCard,
} from "./perks.mjs";

/**
 * Cache I (Decepticon Directive, Raider base, 5th level, p.61): "Once per game session, you can
 * gain temporary access to a minor piece of equipment or tool useful in the scene or
 * automatically acquire a Limited weapon or armor upgrade. This is similar to one benefit from
 * spending a Story Point... but you don't have to spend a Story Point."
 *
 * RE-CATEGORIZED - previously tagged "item-grant mechanism," but RAW's own "similar to one
 * benefit from spending a Story Point" framing is the key: exactly like every other Story-Point-
 * flavored narrative payoff this project already ships un-mechanized (I Know A Guy's own "your
 * acquaintance helps you out with whatever you're lacking," Keep 'Em Laughing's own unscoped
 * grant), the actual GEAR isn't a fixed, mechanically-tracked item - the GM narrates what shows up
 * on the spot, the same way they'd narrate a Story Point's own "find a useful item" benefit. This
 * needs no item-grant plumbing at all, just a resource-gated "Use" button whose own standard
 * postPerkUseChatCard confirmation (Perk name included) is the complete build, matching this
 * project's "the roll/click's own chat output is all the GM needs to narrate from" idiom exactly.
 *
 * Cache II (9th level, p.61) and Cache III (13th level, p.62) have no activation of their own -
 * RAW is explicit both just widen Cache I's own once-per-session use count ("twice per session" /
 * "three times per session" respectively), read here as the max-uses cap. "Once per session" has
 * no matching primitive in this codebase, approximated down to once per encounter (per-use, not
 * per-scene, matching the escalating-count shape Roll With the Punches' own identical "twice per
 * combat at 6th level" upgrade already established via the SAME getUsesThisEncounter/
 * markUsedThisEncounterCount counting primitive).
 *
 * Private Barter (16th level, p.62): "when you use your Cache I Role Perk, you can acquire any
 * item, weapon, or piece of equipment to use for a single scene. However, you can do so only once
 * per session." A separate escalation layered onto the SAME trigger, gated on its own independent
 * once-per-session cap (approximated as once per encounter, the plain boolean shape here since
 * unlike Cache I/II/III there's no scaling count to track) - when both are available on a given
 * use, the posted chat card names the upgrade explicitly so the table knows this specific use is
 * the unrestricted one.
 */
const CACHE_I_ID = "Compendium.essence20.decepticon_directive.Item.EEGQqqgqZEJkJDHB";
const CACHE_II_ID = "Compendium.essence20.decepticon_directive.Item.iyfXCEAkkoC8vODL";
const CACHE_III_ID = "Compendium.essence20.decepticon_directive.Item.VMd10Qb4ByeCla5q";
const PRIVATE_BARTER_ID = "Compendium.essence20.decepticon_directive.Item.mzOtnEnXRhCM0v9O";
const CACHE_ENCOUNTER_FLAG = 'cacheUsedThisEncounter';
const PRIVATE_BARTER_ENCOUNTER_FLAG = 'privateBarterUsedThisEncounter';

/**
 * @param {Actor} actor
 * @returns {Number}   0 (Cache I not held), 1, 2, or 3.
 */
function getCacheMaxUses(actor) {
  if (actorHasPerk(actor, CACHE_III_ID)) {
    return 3;
  }

  if (actorHasPerk(actor, CACHE_II_ID)) {
    return 2;
  }

  return actorHasPerk(actor, CACHE_I_ID) ? 1 : 0;
}

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseCache(actor) {
  const maxUses = getCacheMaxUses(actor);
  return maxUses > 0 && getUsesThisEncounter(actor, CACHE_ENCOUNTER_FLAG) < maxUses;
}

/**
 * Marks one use and posts the narrative payoff chat card - see this file's own doc comment. If
 * the actor also holds Private Barter and hasn't spent its own once-per-session upgrade yet, this
 * specific use is the unrestricted "acquire any item" version instead of Cache's own default
 * "minor equipment or a Limited upgrade" wording.
 * @param {Actor} actor
 * @param {String} itemName   The clicked Perk's own display name, for the chat card.
 * @returns {Promise<Boolean>}   Whether it actually fired.
 */
export async function activateCache(actor, itemName) {
  if (!canUseCache(actor)) {
    return false;
  }

  await markUsedThisEncounterCount(actor, CACHE_ENCOUNTER_FLAG);

  const usePrivateBarter = actorHasPerk(actor, PRIVATE_BARTER_ID) && !hasUsedThisEncounter(actor, PRIVATE_BARTER_ENCOUNTER_FLAG);
  if (usePrivateBarter) {
    await markUsedThisEncounter(actor, PRIVATE_BARTER_ENCOUNTER_FLAG);
  }

  const message = usePrivateBarter
    ? game.i18n.format('E20.CachePrivateBarterUsedNotification', { perk: itemName, actor: actor.name })
    : game.i18n.format('E20.PerkUsedNotification', { perk: itemName, actor: actor.name });
  postPerkUseChatCard(actor, message);
  return true;
}

export { CACHE_I_ID };
