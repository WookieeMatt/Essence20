/**
 * The Zords (Megazord subtype) or non-Zord/Vehicle/Megaform components (Combiner subtype)
 * currently linked to this Megaform, mirroring the identical filter Essence20Actor#
 * _prepareMegaformZordData/_prepareMegaformCombinerData already use to define "participants" for
 * the same actor. Shared (rather than duplicated) by helpers/megaform-damage.mjs's own damage
 * distribution and helpers/combat.mjs's Stun-healing redirect - both need the same "who actually
 * makes up this Megaform right now" resolution.
 * @param {Actor} megaformActor
 * @returns {Actor[]}
 */
export function getMegaformParticipants(megaformActor) {
  const linked = Object.values(megaformActor.system.actors)
    .map(entry => fromUuidSync(entry.uuid))
    .filter(actor => actor);

  const isCombiner = megaformActor.system.subtype.includes('megaformCombiner');
  return linked.filter(actor => (
    isCombiner
      ? actor.type != 'zord' && actor.type != 'vehicle' && actor.type != 'megaform'
      : actor.type == 'zord'
  ));
}
