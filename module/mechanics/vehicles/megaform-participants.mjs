/** The actor types a GM can let into a Megaform (its system.joinTypes - the Combiners tab, GM only). */
export const MEGAFORM_JOIN_TYPES = ['zord', 'vehicle', 'playerCharacter', 'npc'];

/** The GM's own list of who may join this Megaform, or null for the book's rules below. */
export function customJoinTypes(megaformActor) {
  const types = (megaformActor?.system?.joinTypes ?? []).filter(type => MEGAFORM_JOIN_TYPES.includes(type));
  return types.length ? types : null;
}

/**
 * Who can be part of a Megaform.
 *  - A homebrew form (Voltron's Lions or vehicles, a Gestalt team): the actor types its GM ticked (customJoinTypes),
 *    whichever rules it forms under. Never another Megaform.
 *  - A Power Rangers Megazord: Zords - and a Cybertronian (any actor that can transform), which Field Guide to Action
 *    and Adventure p.134 lets join Combiner Zords as a plain component under the Megazord rules.
 *  - A Transformers Combiner: characters (not Zords, Vehicles or Megaforms). A Zord joining Cybertronians makes a
 *    Megazord instead (the same Field Guide passage), so a Combiner refuses it.
 * @param {Actor} megaformActor
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canBeParticipant(megaformActor, actor, kind = null) {
  if (!actor?.type || actor.type == 'megaform') {
    return false;
  }

  const custom = customJoinTypes(megaformActor);
  if (custom) {
    return custom.includes(actor.type);
  }

  if (actor.type == 'vehicle') {
    return false;
  }

  return (kind ? kind == 'combiner' : megaformActor?.system?.subtype?.includes?.('megaformCombiner'))
    ? actor.type != 'zord'
    : actor.type == 'zord' || !!actor.system?.canTransform;
}

/**
 * A Cybertronian in a Megazord (Field Guide p.134): it adds no Megaform Traits unless it holds a Combiner Perk. A Vehicle
 * or a character the GM let in (customJoinTypes) that can't transform is a full component, like a Zord.
 */
export const isGuestComponent = (megaformActor, actor) => !megaformActor?.system?.subtype?.includes?.('megaformCombiner')
  && actor?.type != 'zord' && !!actor?.system?.canTransform;

/**
 * Needed to form (the GM's system.requiredMembers): who must be among the members on the scene before it can Join -
 * Voltron's five Lions. mechanics/vehicles/megaform-join.mjs refuses the Join and names them.
 * @param {Actor} megaformActor
 * @param {Actor[]} present   The members whose tokens are here
 * @returns {String[]}        The names of those still missing
 */
export function missingToForm(megaformActor, present) {
  // By actor id: an unlinked token's actor has a token uuid, but the id of the actor it was placed from.
  const here = new Set(present.filter(Boolean).map(actor => actor.id));
  // Only those still on its roster: the sheet lists no one else, so a member taken off it can't hold the form up unseen.
  const roster = Object.values(megaformActor?.system?.actors ?? {}).filter(entry => entry?.uuid);
  return (megaformActor?.system?.requiredMembers ?? [])
    .map(uuid => roster.find(entry => entry.uuid == uuid))
    .filter(entry => entry && !here.has(String(entry.uuid).split('.').pop()))
    .map(entry => entry.name);
}

/**
 * The actors currently linked to this Megaform that count as its participants (canBeParticipant). Shared by
 * Essence20Actor#_prepareMegaformZordData/_prepareMegaformCombinerData, mechanics/vehicles/megaform-damage.mjs's damage
 * distribution and mechanics/combat/combat.mjs's Stun-healing redirect - all need the same "who actually makes up this
 * Megaform right now" resolution.
 * @param {Actor} megaformActor
 * @param {String} [kind]   'combiner' or 'megazord' when the caller already knows (else read from the subtype)
 * @returns {Actor[]}
 */
export function getMegaformParticipants(megaformActor, kind = null) {
  return Object.values(megaformActor.system.actors ?? {})
    .map(entry => fromUuidSync(entry.uuid))
    .filter(actor => canBeParticipant(megaformActor, actor, kind));
}

/**
 * The Crew of a Megaform: the characters riding in its participants (Zords' drivers and passengers). PR CRB p.140 -
 * the Megaform has the highest scores of its components AND Crew, and the Crew keep their own skills.
 * @param {Actor} megaformActor
 * @param {Actor[]} [participants]
 * @returns {Actor[]}
 */
export function getMegaformCrew(megaformActor, participants = getMegaformParticipants(megaformActor)) {
  const crew = new Set();
  for (const participant of participants) {
    for (const entry of Object.values(participant?.system?.actors ?? {})) {
      if (['playerCharacter', 'npc'].includes(entry?.type)) {
        const actor = fromUuidSync(entry.uuid);
        if (actor) {
          crew.add(actor);
        }
      }
    }
  }

  return [...crew];
}

/**
 * Changing a Megaform's subtype with people in it: who would stop counting. A mixed Megazord (Zords and a Cybertronian,
 * Field Guide p.134) can't become a Transformers Combiner - its Zords can't be in one - and a Combiner's characters who
 * can't transform can't be in a Megazord. Essence20Actor#_preUpdate refuses such a change and names them.
 * @param {Actor} megaformActor
 * @param {String[]} subtype   The new subtype
 * @returns {Actor[]}
 */
export function subtypeChangeBlockers(megaformActor, subtype) {
  const kind = (Array.isArray(subtype) ? subtype : [subtype]).includes('megaformCombiner') ? 'combiner' : 'megazord';
  return Object.values(megaformActor?.system?.actors ?? {})
    .map(entry => fromUuidSync(entry.uuid))
    .filter(actor => actor && !canBeParticipant(megaformActor, actor, kind));
}

// A Megaform's Size is worked out from who is in it (Essence20Actor#_prepareMegaformZordData / CombinerData), so its token
// follows the roster: whoever changed the roster (or the type) resizes the prototype and the placed tokens.
if (typeof Hooks != 'undefined') {
  Hooks.on('updateActor', async (actor, changes, options, userId) => {
    if (actor?.type != 'megaform' || userId != game.user?.id
      || (changes?.system?.actors === undefined && changes?.system?.subtype === undefined)) {
      return;
    }

    const size = CONFIG.E20?.tokenSizes?.[actor.system?.size];
    if (!size || (actor.prototypeToken?.width == size.width && actor.prototypeToken?.height == size.height)) {
      return;
    }

    const { resizeTokens } = await import("../world/token-sync.mjs");
    resizeTokens(actor, size.width, size.height);
    await actor.update({ 'prototypeToken.width': size.width, 'prototypeToken.height': size.height });
  });
}
