/**
 * Generic request/response layer over the "system.essence20" socket channel this project's
 * existing Story Point spend/grant requests already use (see story-points.mjs's own doc comment:
 * that channel is fire-and-forget only - "this codebase's socket layer isn't a request/response
 * channel"). This file is what turns it into one, for the first time - needed by
 * helpers/defense-choice.mjs, which has to ask a SPECIFIC other connected user a question and
 * wait for their actual answer before an attack roll can finish resolving, rather than firing a
 * message and moving on the way every prior socket use in this project does.
 *
 * Foundry's socket.emit() is a broadcast to every connected client - there's no client-to-client
 * addressing built into the platform itself. This layers a request/response protocol on top of
 * that broadcast: every request carries a random requestId and the intended recipient's own
 * targetUserId; every client's own listener (essence20.mjs's existing socket.on handler,
 * extended to dispatch here) drops any request whose targetUserId isn't its own game.user.id; and
 * the ORIGINAL requester waits on a Promise that resolves once a response carrying the same
 * requestId comes back - with a timeout, since the target user's client might never answer at all
 * (disconnected mid-request, tabbed away, or simply doesn't respond).
 */

const PENDING_REQUESTS = new Map(); // requestId -> {resolve, timeoutHandle}
const DEFAULT_TIMEOUT_MS = 60000;

// promptType -> async (payload) => answer. Populated by whichever files define an actual remote
// prompt (defense-choice.mjs's "chooseDefense" is the first) via registerRemotePrompt below - kept
// separate from this file's own request/response plumbing so this file has no knowledge of what
// any particular prompt looks like or how it's answered.
const PROMPT_HANDLERS = {};

/**
 * Registers the handler that runs on whichever client actually receives a given promptType -
 * typically shows a local dialog and returns the user's choice.
 * @param {String} promptType
 * @param {Function} handler   async (payload) => answer
 */
export function registerRemotePrompt(promptType, handler) {
  PROMPT_HANDLERS[promptType] = handler;
}

/**
 * Sends promptType/payload to a specific user's client and waits for their answer.
 * @param {String} targetUserId
 * @param {String} promptType    A key registered via registerRemotePrompt.
 * @param {Object} payload
 * @param {Number} [timeoutMs]
 * @returns {Promise<*>}   The answer the target user's client sent back, or null on timeout.
 */
export function requestChoiceFromUser(targetUserId, promptType, payload, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const requestId = foundry.utils.randomID();

  return new Promise(resolve => {
    const timeoutHandle = setTimeout(() => {
      PENDING_REQUESTS.delete(requestId);
      resolve(null);
    }, timeoutMs);

    PENDING_REQUESTS.set(requestId, { resolve, timeoutHandle });

    game.socket.emit("system.essence20", {
      action: "remoteChoiceRequest", requestId, targetUserId, promptType, payload,
    });
  });
}

/**
 * Called from essence20.mjs's socket listener for every "remoteChoiceRequest" message. A no-op on
 * every client except the one the request was actually addressed to, and if no handler is
 * registered for the given promptType (shouldn't happen in practice - every requester goes
 * through a promptType that also registered its own handler at module load).
 * @param {Object} data   {requestId, targetUserId, promptType, payload}
 */
export async function handleRemoteChoiceRequest(data) {
  if (data.targetUserId != game.user.id) {
    return;
  }

  const handler = PROMPT_HANDLERS[data.promptType];
  const answer = handler ? await handler(data.payload) : null;

  game.socket.emit("system.essence20", {
    action: "remoteChoiceResponse", requestId: data.requestId, answer,
  });
}

/**
 * Called from essence20.mjs's socket listener for every "remoteChoiceResponse" message. A no-op
 * if this client isn't the one waiting on that particular requestId - every client sees every
 * response (Foundry sockets are a broadcast), but only the original requester has it pending, and
 * a response arriving after that request's own timeout already fired is simply too late to matter.
 * @param {Object} data   {requestId, answer}
 */
export function handleRemoteChoiceResponse(data) {
  const pending = PENDING_REQUESTS.get(data.requestId);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timeoutHandle);
  PENDING_REQUESTS.delete(data.requestId);
  pending.resolve(data.answer);
}
