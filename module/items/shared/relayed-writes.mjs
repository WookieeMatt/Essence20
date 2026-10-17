/**
 * Writes to a document the clicking user may not own (an attacked target, an ally's sheet) -
 * directly when they can, else relayed through the active GM (mechanics/world/gm-relay.mjs, which
 * is imported lazily so this file stays light).
 *
 * The variants differ in what they hand back and how they call the document, and are kept apart:
 * - writeDoc(doc, method, args): skips a missing doc, resolves to nothing.
 * - writeDocResult(doc, method, args): resolves to the relay's answer, or true after a direct write.
 * - updateRelayed(doc, update) / updateRelayedWithOptions(doc, update, options): doc.update, the
 *   second always passing an options object along.
 */

const gmRelay = () => import("../../mechanics/world/gm-relay.mjs");

/** doc[method](...args), relayed through the GM when this user can't write to that document. */
export async function writeDoc(doc, method, args) {
  if (!doc) {
    return;
  }

  const { needsGmRelay, relayToGm } = await gmRelay();
  if (needsGmRelay(doc)) {
    await relayToGm(doc, method, args);
    return;
  }

  await doc[method](...args);
}

/**
 * writeDoc that reports back: the relay's answer, or true once a direct write is done. (The relay
 * only accepts writes to a targeted token's actor - the callers target first.)
 */
export async function writeDocResult(doc, method, args) {
  const { needsGmRelay, relayToGm } = await gmRelay();
  if (needsGmRelay(doc)) {
    return relayToGm(doc, method, args);
  }

  await doc[method](...args);
  return true;
}

/** doc.update(update), through the GM relay when needed. */
export async function updateRelayed(doc, update) {
  const { needsGmRelay, relayToGm } = await gmRelay();
  if (needsGmRelay(doc)) {
    return relayToGm(doc, 'update', [update]);
  }

  return doc.update(update);
}

/** doc.update(update, options), through the GM relay when needed. */
export async function updateRelayedWithOptions(doc, update, options = {}) {
  const { needsGmRelay, relayToGm } = await gmRelay();
  if (needsGmRelay(doc)) {
    return relayToGm(doc, 'update', [update, options]);
  }

  return doc.update(update, options);
}

/** doc.setFlag('essence20', key, value), through the GM relay when needed. */
export async function setFlagRelayed(doc, key, value) {
  const { needsGmRelay, relayToGm } = await gmRelay();
  if (needsGmRelay(doc)) {
    return relayToGm(doc, 'setFlag', ['essence20', key, value]);
  }

  return doc.setFlag('essence20', key, value);
}

/** doc.unsetFlag('essence20', key), through the GM relay when needed. */
export async function unsetFlagRelayed(doc, key) {
  const { needsGmRelay, relayToGm } = await gmRelay();
  if (needsGmRelay(doc)) {
    return relayToGm(doc, 'unsetFlag', ['essence20', key]);
  }

  return doc.unsetFlag('essence20', key);
}

/**
 * Put a Condition on someone, through the GM when this user can't write to them (then always
 * untimed); a timed Condition when rounds is given, else a plain status toggle.
 */
export async function applyStatus(actor, statusId, rounds = null) {
  if (!actor) {
    return;
  }

  const { needsGmRelay } = await gmRelay();
  if (needsGmRelay(actor)) {
    await writeDoc(actor, 'toggleStatusEffect', [statusId, { active: true }]);
    return;
  }

  if (rounds) {
    const { applyTimedCondition } = await import("../../mechanics/combat/timed-status.mjs");
    await applyTimedCondition(actor, statusId, rounds);
  } else {
    await actor.toggleStatusEffect(statusId, { active: true });
  }
}
