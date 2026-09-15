import { getNearbyAllyTokens } from "./allies.mjs";
import { actorHasPerk } from "./perks.mjs";

/**
 * Not On My Watch (Factions in Action Vol. 2: Intercontinental Adventures, Oktober Guard General
 * Perk, p.95): "If a member of your unit that you can see gains the Defeated Condition, you can
 * immediately Move your Ground Movement towards them. You gain +1 Toughness and +1 Evasion while
 * a Defeated teammate is within your Reach."
 *
 * The first clause ("immediately Move towards a newly-Defeated ally") is a reaction to a
 * Condition being applied to someone ELSE - the "an ally's own Health just crossed to 0" hook
 * this project has repeatedly flagged as missing (Fe-BURN!, Defender Step, Projectile Deflector,
 * etc.). This is that hook's first real use: helpers/combat.mjs#applyDamage calls
 * grantNotOnMyWatchReaction() below at the exact moment ANY actor's Health crosses from >0 to 0,
 * for both the Stun-crosses-remaining-Health branch and the ordinary Health-loss branch.
 *
 * "You can see" has no visibility check to hook (same unenforceable-narrative-precondition idiom
 * already accepted throughout this project) - approximated as "anywhere on the scene," the same
 * Infinity-radius idiom Field Aid's own hasNearbyDefeatedAlly already established for an
 * identical "no way to verify LOS/direction" gap.
 *
 * "You can immediately Move your Ground Movement towards them" has no action-economy or
 * token-movement-execution concept to grant into (this system has none, for any Perk) - the
 * closest honest automation is a chat prompt telling the eligible player their reaction is
 * available, same as every other movement-granting Perk in this codebase already settles for.
 * Actually moving the token remains the player's own action.
 */
const NOT_ON_MY_WATCH_ID = "Compendium.essence20.intercontinental_adventures.Item.xH3iQ0NcXp1eFO35";
const REACH_FEET = 5;

/**
 * Whether any allied token within 5ft of the actor is currently Defeated.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function hasDefeatedAllyInReach(actor) {
  return getNearbyAllyTokens(actor, REACH_FEET).some(token => token.actor?.statuses?.has('defeated'));
}

/**
 * The live, non-consumed Defense bonus Not On My Watch grants while a Defeated teammate is within
 * Reach - +1 to both Toughness and Evasion, same shape as helpers/bolster-defense.mjs's own
 * getBolsterDefenseBonus but unconditional on holding the Perk rather than an activated flag.
 * @param {Actor} actor
 * @param {String} defenseType
 * @returns {Number}
 */
export function getNotOnMyWatchDefenseBonus(actor, defenseType) {
  if (defenseType != 'toughness' && defenseType != 'evasion') {
    return 0;
  }

  return hasDefeatedAllyInReach(actor) ? 1 : 0;
}

/**
 * Called from combat.mjs#applyDamage the moment defeatedActor's Health crosses from >0 to 0.
 * Posts a chat prompt for every nearby ally holding Not On My Watch, letting that player know
 * they can now move their own token towards defeatedActor.
 * @param {Actor} defeatedActor The actor who was just Defeated.
 */
export async function grantNotOnMyWatchReaction(defeatedActor) {
  const reactors = getNearbyAllyTokens(defeatedActor, Infinity)
    .map(token => token.actor)
    .filter(actor => actor && actorHasPerk(actor, NOT_ON_MY_WATCH_ID));

  for (const reactor of reactors) {
    ChatMessage.create({
      content: game.i18n.format('E20.NotOnMyWatchReactionPrompt', {
        reactor: reactor.name, ally: defeatedActor.name,
      }),
      speaker: ChatMessage.getSpeaker({ actor: reactor }),
    });
  }
}
