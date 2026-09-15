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

/**
 * Finds every OTHER token within radiusFeet of the given actor's own token, regardless of
 * Disposition - i.e. allies AND enemies alike. First needed by Ground Suppression
 * (Quartermaster's Guide to Gear, Strafer Focus, Vanguard, 3rd level, p.28), whose own "friend
 * and foe" AoE is the first Perk in this project to hit BOTH dispositions at once - every prior
 * AoE either only ever hit allies (getNearbyAllyTokens) or only enemies (getNearbyEnemyTokens).
 * Excludes the actor's own token, matching both of those siblings.
 * @param {Actor} actor
 * @param {Number} radiusFeet
 * @returns {Array<Token>}
 */
export function getAllNearbyTokens(actor, radiusFeet) {
  const actorToken = actor?.getActiveTokens?.()?.[0];
  if (!actorToken || !canvas?.tokens || !canvas?.grid) {
    return [];
  }

  return canvas.tokens.placeables.filter(token =>
    token !== actorToken && token.actor
    && canvas.grid.measurePath([token.center, actorToken.center]).distance <= radiusFeet,
  );
}

/**
 * H.I.S.S. Column (GI Joe CRB, Vehicle Trait, p.302): "Every H.I.S.S. on a battlefield gains a
 * bonus to Evasion equal to the number of other H.I.S.S. on the battlefield." Unlike
 * getNearbyAllyTokens/getAllNearbyTokens above, this has no radius (the whole current scene is
 * "the battlefield") and matches by actor identity (same actor name) rather than Disposition -
 * RAW's own "other H.I.S.S." clearly means other copies of this specific named vehicle, not any
 * unrelated vehicle that happens to also carry this Trait. Excludes the actor's own token.
 * @param {Actor} actor
 * @returns {Number}
 */
export function getHissColumnBonus(actor) {
  const actorToken = actor?.getActiveTokens?.()?.[0];
  if (!actorToken || !canvas?.tokens) {
    return 0;
  }

  return canvas.tokens.placeables.filter(token =>
    token !== actorToken && token.actor
    && token.actor.name === actor.name
    && token.actor.system.traits?.hissColumn,
  ).length;
}
