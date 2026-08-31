/**
 * Generic "nearby allies" lookup, generalizing the same scan already duplicated privately in
 * helpers/personal-shield.mjs#getShieldUpgradeBonus and helpers/enemy-number-one.mjs (which scans
 * for nearby ENEMIES instead - the same idiom, opposite disposition check). Foundry has no
 * first-class "ally" concept of its own; every aura/ally-facing Perk automated in this system
 * keys off a token's own Disposition (set per-token on the scene) as the ally/enemy proxy, and
 * canvas.grid.measurePath for distance, same as everywhere else range gets measured in this file
 * tree (dice.mjs#_getDistanceFeet, etc.).
 */

/**
 * Finds every OTHER token within radiusFeet of the given actor's own token, sharing the same
 * Disposition (friendly/neutral/hostile) - i.e. its allies on the current scene. Excludes the
 * actor's own token. Returns an empty array if the actor has no token placed on the canvas at
 * all (no scene loaded, or the actor isn't represented on this one).
 * @param {Actor} actor
 * @param {Number} radiusFeet
 * @returns {Array<Token>}
 */
export function getNearbyAllyTokens(actor, radiusFeet) {
  const actorToken = actor?.getActiveTokens?.()?.[0];
  if (!actorToken || !canvas?.tokens || !canvas?.grid) {
    return [];
  }

  return canvas.tokens.placeables.filter(token =>
    token !== actorToken && token.actor
    && token.document.disposition === actorToken.document.disposition
    && canvas.grid.measurePath([token.center, actorToken.center]).distance <= radiusFeet,
  );
}
