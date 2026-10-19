// An unlinked token's actor, read from inside its own data preparation.
//
// Foundry v14 builds an unlinked token's ActorDelta - and with it the token's synthetic Actor - lazily, on the first
// read of token.delta (common/documents/token.mjs ActorDeltaField#initialize), and only stores it on the token once
// that Actor's constructor, data preparation included, has returned. A read of the SAME token's .actor from inside
// that preparation (any scan of the canvas's tokens - the passengers rule scope, the Hiss Column, aura and
// within-range tags) finds the delta still unbuilt and builds it again, which prepares again, which scans again...
// "Maximum call stack size exceeded" on world load, whenever a scan happened to reach a token before anything else
// had built its actor. Essence20Actor#prepareData marks its token while it prepares, and
// Essence20TokenDocument#actor answers null for a marked token whose actor isn't built yet.

const preparing = new Set();

/** Runs fn with this token document marked as having its actor prepared. */
export function whilePreparing(tokenDoc, fn) {
  if (!tokenDoc || preparing.has(tokenDoc)) {
    return fn();
  }

  preparing.add(tokenDoc);
  try {
    return fn();
  } finally {
    preparing.delete(tokenDoc);
  }
}

/** Whether reading this token document's actor now would build it again, from inside its own data preparation. */
export function actorMidBuild(tokenDoc) {
  if (!preparing.has(tokenDoc) || tokenDoc.actorLink) {
    return false;
  }

  // Unbuilt, token.delta is a getter that builds it; built, a plain value.
  return typeof Object.getOwnPropertyDescriptor(tokenDoc, 'delta')?.get == 'function';
}
