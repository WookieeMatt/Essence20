import { actorHasPerk } from "../../mechanics/characters/perks.mjs";

/**
 * Taking a hit for someone else, at the chat card's Apply Damage (chat.mjs#onApplyDamage): the protector Perks - Interpose
 * (both printings), Body Shield, Heroic Sacrifice, Golden Guardian (+ Counterstrike) and Stand By Me - are their items'
 * own applyingDamage rules (rules/plugins/combat/applying-damage.mjs). What stays here is the one that redirects to a
 * vehicle rather than to an ally, asked first:
 *
 * Impenetrable Armor (G.I. Joe CRB, Mechanized Infantry Focus, 10th level, p.81, RAW-verified
 * 2026-09-15): "While piloting a vehicle, you may redirect attacks targeting you to your vehicle." A
 * genuinely different SHAPE of protector than the ally ones (self-to-VEHICLE, not ally-to-self) -
 * found via the same crew/pilot-assignment lookup (`actor._dice._getPilotedVehicle(actor, 'driver')`)
 * Heavy Ordnance/Dogfighter/Relic Key already established for "is this actor currently piloting a
 * vehicle." No frequency cap in RAW. The redirected amount is re-run through the ordinary applyDamage()
 * pipeline for the vehicle, not a raw subtraction.
 */
const IMPENETRABLE_ARMOR_ID = "Compendium.essence20.gi_joe_crb.Item.vanN7kRYUhgHew7q";

/**
 * The hand-written protector for a hit against targetActor, or null. Doesn't consume anything (Impenetrable Armor has
 * nothing to spend).
 * @param {Actor} targetActor   The actor the hit currently applies to.
 * @returns {{protector: Actor, perkId: String}|null}
 */
export function findEligibleProtector(targetActor) {
  if (actorHasPerk(targetActor, IMPENETRABLE_ARMOR_ID)) {
    const pilotedVehicle = targetActor._dice?._getPilotedVehicle(targetActor, 'driver');
    if (pilotedVehicle) {
      return { protector: pilotedVehicle, perkId: IMPENETRABLE_ARMOR_ID };
    }
  }

  return null;
}
