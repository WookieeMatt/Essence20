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
  return [...(user?.targets ?? [])].some(token => token?.actor?.uuid == doc?.uuid || token?.document?.actor?.uuid == doc?.uuid);
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
  if (!RELAY_METHODS.has(data.method) || !doc || typeof doc[data.method] != 'function' || !isRelayAllowed(doc, user)) {
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
    resolve(!!data.ok);
  }
}
