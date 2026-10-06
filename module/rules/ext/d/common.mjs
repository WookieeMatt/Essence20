/**
 * Shared bits for the group D rules-engine plug-ins (module/rules/ext/d/*.mjs). Plain Node safe: heavy
 * helpers are imported lazily inside functions.
 */

/** A string from the RulesExtD block of the language file (E20.RulesExtD.<key>), or the key itself. */
export function T(key, data = null) {
  const i18n = globalThis.game?.i18n;
  const full = `E20.RulesExtD.${key}`;
  const text = data ? i18n?.format?.(full, data) : i18n?.localize?.(full);
  return text && text != full ? text : `${key}${data ? ` ${JSON.stringify(data)}` : ''}`;
}

export const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** A collection (Foundry's, an array, a Set) as an array. */
export function listOf(collection) {
  if (Array.isArray(collection?.contents)) {
    return collection.contents;
  }

  if (Array.isArray(collection)) {
    return collection;
  }

  return collection && typeof collection[Symbol.iterator] == 'function' ? [...collection] : [];
}

export const worldActors = () => listOf(globalThis.game?.actors);

/** Update a document, through the GM when this user can't write to it. */
export async function write(doc, method, args) {
  const { needsGmRelay, relayToGm } = await import("../../../helpers/gm-relay.mjs");
  if (needsGmRelay(doc)) {
    return relayToGm(doc, method, args);
  }

  return doc[method](...args);
}

/** The actor a chat message speaks for (its token's actor first). */
export function speakerOf(message) {
  const speaker = message?.speaker;
  if (!speaker) {
    return null;
  }

  const viaApi = globalThis.ChatMessage?.getSpeakerActor?.(speaker);
  if (viaApi) {
    return viaApi;
  }

  const token = speaker.token ? globalThis.game?.scenes?.get?.(speaker.scene)?.tokens?.get?.(speaker.token) : null;
  return token?.actor ?? (speaker.actor ? globalThis.game?.actors?.get?.(speaker.actor) ?? null : null);
}

/** Post a chat line for an actor. */
export async function say(actor, content, extra = {}) {
  if (!content || !globalThis.ChatMessage?.create) {
    return null;
  }

  return globalThis.ChatMessage.create({ speaker: globalThis.ChatMessage.getSpeaker?.({ actor }), content, ...extra });
}

/** The combatant of an actor in a combat (the running one by default). */
export function combatantOf(actor, combat = globalThis.game?.combat) {
  return listOf(combat?.combatants).find(c => c.actor === actor || (actor?.id && c.actor?.id == actor.id) || (actor?.id && c.actorId == actor.id)) ?? null;
}

/** Same side: token dispositions on the canvas, else player character or not. */
export function sameSide(a, b) {
  const ta = a?.getActiveTokens?.()?.[0];
  const tb = b?.getActiveTokens?.()?.[0];
  if (ta && tb) {
    return (ta.document?.disposition ?? 0) == (tb.document?.disposition ?? 0);
  }

  return (a?.type == 'playerCharacter') == (b?.type == 'playerCharacter');
}
