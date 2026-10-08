import { worldActors } from "../companions/companion-link.mjs";
/**
 * GM relay for writes to a target the current user doesn't own.
 *
 * On-hit effects (a Perk knocking the target Prone, a flag marking it, Frightened from an attack...)
 * write to the TARGET's actor from the ATTACKER's client. When a player hits an NPC - an unlinked
 * token they don't own - Foundry refuses the write ("User ... lacks permission to update ActorDelta").
 * Rather than route each of those call sites separately, Essence20Actor's own update / setFlag /
 * unsetFlag / toggleStatusEffect check first: if this user can't modify the actor and a GM is
 * connected, the call is sent to the active GM over the system socket and run there.
 *
 * Guarded, since the relay acts with the GM's permissions: the GM only carries out a request when
 * the requesting player is currently targeting that actor's token, and only for the methods in
 * RELAY_METHODS. Anything else is refused and logged. The caller waits for the GM to finish (up to
 * RELAY_TIMEOUT_MS), so code that reads the new state afterwards still works.
 */

export const RELAY_METHODS = new Set(['update', 'setFlag', 'unsetFlag', 'toggleStatusEffect']);
const RELAY_TIMEOUT_MS = 5000;
const SOCKET = "system.essence20";

// requestId -> resolve, for this client's own requests awaiting the GM.
const pending = new Map();

/**
 * Whether a write to this document should go through the GM: this user may not modify it, isn't a
 * GM, and a GM is connected to do it for them.
 * @param {Document} doc
 * @returns {Boolean}
 */
export function needsGmRelay(doc) {
  const user = game.user;
  if (!user || user.isGM || !game.users?.activeGM) {
    return false;
  }

  return doc?.canUserModify ? !doc.canUserModify(user, 'update') : !doc?.isOwner;
}

/**
 * Sends one method call to the active GM and waits for it to be done.
 * @param {Document} doc
 * @param {String} method   One of RELAY_METHODS.
 * @param {Array} args
 * @returns {Promise<Boolean>}   True once the GM confirms it; false if refused or timed out.
 */
export function relayToGm(doc, method, args) {
  const requestId = foundry.utils.randomID();
  const done = new Promise((resolve) => {
    pending.set(requestId, resolve);
    setTimeout(() => {
      if (pending.delete(requestId)) {
        resolve(false);
      }
    }, RELAY_TIMEOUT_MS);
  });

  game.socket.emit(SOCKET, { action: 'gmRelay', requestId, userId: game.user.id, uuid: doc.uuid, method, args });
  return done;
}

/**
 * Whether the GM should carry out a relayed write for this user: the user must be targeting a token
 * of this very actor (the target of whatever they just did).
 * @param {Document} doc
 * @param {User} user
 * @returns {Boolean}
 */
export function isRelayAllowed(doc, user) {
  // A write to an actor tied to one the user owns - their Contact, companion or summoned vehicle, a
  // Combiner they're part of (Better As One), a commander or partner they act with.
  if (isLinkedToOwnedActor(doc, user)) {
    return true;
  }

  // The targeted token itself (a push moves it), or an Item carried by the targeted actor (a
  // disarm drops it) - see mechanics/combat/forced-movement.mjs and mechanics/combat/target-riders.mjs.
  const uuids = [doc?.uuid, doc?.parent?.documentName == 'Actor' ? doc.parent.uuid : null].filter(Boolean);
  return [...(user?.targets ?? [])].some(token => uuids.some(uuid =>
    token?.actor?.uuid == uuid || token?.document?.actor?.uuid == uuid || token?.document?.uuid == uuid));
}

/**
 * A Power Shield changing hands (items/defenses/power-shield.mjs): creating or deleting that one kind of Active Effect
 * on an actor the player doesn't own - the shield "can be transferred to others" (PR CRB p.100). Only effects stamped as
 * a Power Shield summoned by a character the player owns, so nothing else rides on it.
 */
export function isPowerShieldHandoff(doc, method, args, user) {
  if (doc?.documentName != 'Actor' || !user || !Array.isArray(args) || args[0] != 'ActiveEffect') {
    return false;
  }

  // The summoner's player, or the player of whoever holds that summoner's shield now (passing it on).
  const ownsSummoner = uuid => {
    const summoner = uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) : null;
    if (summoner?.testUserPermission?.(user, 'OWNER')) {
      return true;
    }

    return !!uuid && [...(globalThis.game?.actors ?? [])].some(actor => actor.testUserPermission?.(user, 'OWNER')
      && [...(actor.effects ?? [])].some(effect => effect.flags?.essence20?.powerShield?.summoner == uuid));
  };

  if (method == 'createEmbeddedDocuments') {
    const list = Array.isArray(args[1]) ? args[1] : [];
    return list.length > 0 && list.every(entry => ownsSummoner(entry?.flags?.essence20?.powerShield?.summoner));
  }

  if (method == 'deleteEmbeddedDocuments') {
    const ids = Array.isArray(args[1]) ? args[1] : [];
    return ids.length > 0 && ids.every(id => ownsSummoner(doc.effects?.get?.(id)?.flags?.essence20?.powerShield?.summoner));
  }

  return false;
}

/**
 * Whether this document is an actor, or an item on an actor, linked to one the user owns.
 * @param {Document} doc
 * @param {User} user
 * @returns {Boolean}
 */
function isLinkedToOwnedActor(doc, user) {
  const actor = doc?.documentName == 'Actor' ? doc : null;
  if (!actor || !user) {
    return false;
  }

  const owns = uuid => {
    try {
      return !!uuid && !!fromUuidSync(uuid)?.testUserPermission?.(user, 'OWNER');
    } catch (error) {
      return false;
    }
  };

  const flags = actor.flags?.essence20 ?? {};
  if (owns(flags.companionOf) || owns(flags.contactOf) || owns(flags.bond?.partner)) {
    return true;
  }

  // Listed on an owned actor's sheet (a Contact, a Combiner component), or listing one.
  const listedBy = worldActors().some(other => other.testUserPermission?.(user, 'OWNER')
    && Object.values(other.system?.actors ?? {}).some(entry => entry?.uuid == actor.uuid));
  const lists = Object.values(actor.system?.actors ?? {}).some(entry => owns(entry?.uuid));
  return listedBy || lists;
}

/**
 * GM side: carry out a relayed call, then tell the requester it's done. Only the active GM acts, so
 * several connected GMs don't each apply it.
 * @param {Object} data   {requestId, userId, uuid, method, args}
 * @returns {Promise<Boolean>}   Whether it was carried out.
 */
export async function handleGmRelayRequest(data) {
  if (!game.users?.activeGM?.isSelf) {
    return false;
  }

  const reply = (ok) => game.socket.emit(SOCKET, { action: 'gmRelayDone', requestId: data.requestId, userId: data.userId, ok });
  const user = game.users.get(data.userId);
  const doc = await fromUuid(data.uuid);
  const shieldHandoff = isPowerShieldHandoff(doc, data.method, data.args, user);
  if (!shieldHandoff && (!RELAY_METHODS.has(data.method) || !doc || typeof doc[data.method] != 'function' || !isRelayAllowed(doc, user))) {
    console.warn(`Essence20 | refused a relayed ${data.method} on ${data.uuid} from ${user?.name ?? data.userId}`);
    reply(false);
    return false;
  }

  try {
    await doc[data.method](...(data.args ?? []));
    reply(true);
    return true;
  } catch (error) {
    console.error(`Essence20 | relayed ${data.method} on ${data.uuid} failed`, error);
    reply(false);
    return false;
  }
}

/**
 * Requester side: the GM finished one of this client's requests.
 * @param {Object} data   {requestId, userId, ok}
 */
export function handleGmRelayDone(data) {
  if (data.userId != game.user?.id) {
    return;
  }

  const resolve = pending.get(data.requestId);
  if (resolve) {
    pending.delete(data.requestId);
    // A create request answers with the new document's uuid; a write with true or false.
    resolve(typeof data.ok == 'string' ? data.ok : !!data.ok);
  }
}

/* -------------------------------------------- */
/*  Creating and removing companions            */
/* -------------------------------------------- */

/**
 * A player gaining a pet, a Mini-Con or a Contact makes a new actor, and deploying one places a
 * token - neither of which a player may do by default. These go to the GM the same way, guarded so
 * the GM only makes or removes things that belong to an actor the player owns.
 */
const CREATE_KINDS = new Set(['actor', 'token', 'deleteActor', 'deleteToken']);

function ownedBy(uuid, user) {
  const owner = uuid ? fromUuidSync(uuid) : null;
  return !!owner && !!user && (user.isGM || owner.testUserPermission?.(user, 'OWNER'));
}

/**
 * Whether the GM should make or remove this for the user.
 * @param {String} kind   actor, token, deleteActor or deleteToken.
 * @param {Object} payload
 * @param {User} user
 * @returns {Boolean}
 */
export function isCreateAllowed(kind, payload, user) {
  if (!CREATE_KINDS.has(kind) || !user) {
    return false;
  }

  if (kind == 'actor') {
    const flags = payload?.data?.flags?.essence20 ?? {};
    return ['companion', 'vehicle', 'npc'].includes(payload?.data?.type) && ownedBy(flags.companionOf ?? flags.contactOf, user);
  }

  const actor = payload?.actorUuid ? fromUuidSync(payload.actorUuid) : null;
  if (!actor) {
    return false;
  }

  const owner = actor.flags?.essence20?.companionOf ?? actor.flags?.essence20?.contactOf;
  return ownedBy(actor.uuid, user) || ownedBy(owner, user);
}

async function carryOut(kind, payload, user) {
  if (kind == 'actor') {
    const data = foundry.utils.deepClone(payload.data);
    data.ownership = { ...(data.ownership ?? {}), [user.id]: 3 };
    const actor = await Actor.create(data);
    return actor?.uuid ?? null;
  }

  const actor = fromUuidSync(payload.actorUuid);
  if (kind == 'deleteActor') {
    await actor.delete();
    return true;
  }

  const scene = game.scenes.get(payload.sceneId) ?? canvas?.scene;
  if (!scene) {
    return null;
  }

  if (kind == 'deleteToken') {
    const ids = scene.tokens.filter(t => t.actorId == actor.id).map(t => t.id);
    if (ids.length) {
      await scene.deleteEmbeddedDocuments('Token', ids);
    }

    return true;
  }

  const tokenData = await actor.getTokenDocument({ x: payload.x, y: payload.y, hidden: false });
  const [token] = await scene.createEmbeddedDocuments('Token', [tokenData.toObject()]);
  return token?.uuid ?? null;
}

/**
 * Make or remove a companion actor or token - directly when this user may, through the GM otherwise.
 * @param {String} kind   actor, token, deleteActor or deleteToken.
 * @param {Object} payload   {data} for an actor; {actorUuid, sceneId, x, y} for the rest.
 * @returns {Promise<*>}   The new document's uuid, true for a removal, or null.
 */
export async function createViaGm(kind, payload) {
  const user = game.user;
  const may = {
    actor: () => user.isGM || user.can?.('ACTOR_CREATE'),
    token: () => user.isGM || user.can?.('TOKEN_CREATE'),
    deleteActor: () => user.isGM || fromUuidSync(payload.actorUuid)?.isOwner,
    deleteToken: () => user.isGM || user.can?.('TOKEN_DELETE'),
  }[kind];
  if (may?.()) {
    return carryOut(kind, payload, user);
  }

  if (!game.users?.activeGM) {
    ui.notifications.warn(game.i18n.localize('E20.CompanionNeedsGm'));
    return null;
  }

  const requestId = foundry.utils.randomID();
  const done = new Promise((resolve) => {
    pending.set(requestId, resolve);
    setTimeout(() => {
      if (pending.delete(requestId)) {
        resolve(null);
      }
    }, RELAY_TIMEOUT_MS);
  });
  game.socket.emit(SOCKET, { action: 'gmCreate', requestId, userId: user.id, kind, payload });
  return done;
}

/**
 * GM side of createViaGm.
 * @param {Object} data   {requestId, userId, kind, payload}
 */
export async function handleGmCreateRequest(data) {
  if (!game.users?.activeGM?.isSelf) {
    return;
  }

  const user = game.users.get(data.userId);
  let result = null;
  if (isCreateAllowed(data.kind, data.payload, user)) {
    try {
      result = await carryOut(data.kind, data.payload, user);
    } catch (error) {
      console.error(`Essence20 | relayed ${data.kind} failed`, error);
    }
  } else {
    console.warn(`Essence20 | refused a relayed ${data.kind} from ${user?.name ?? data.userId}`);
  }

  game.socket.emit(SOCKET, { action: 'gmRelayDone', requestId: data.requestId, userId: data.userId, ok: result });
}
